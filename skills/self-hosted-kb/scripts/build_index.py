from __future__ import annotations

"""Build the SQLite FTS5 index for a completed full-kb output directory.

Usage:
    python scripts/build_index.py --output-dir <build-output>
"""

import argparse
import csv
import hashlib
import json
import sqlite3
import time
from pathlib import Path

import numpy as np


ROOT: Path
PACKAGE: Path
DATABASE: Path
MARKER: Path
BATCH_SIZE = 5_000


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build the SQLite FTS5 index from extracted/chunked outputs."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="包含 package/ 的建库输出目录",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=5_000,
        help="写入 FTS5 时每批处理的块数",
    )
    args = parser.parse_args()

    global ROOT, PACKAGE, DATABASE, MARKER, BATCH_SIZE
    ROOT = args.output_dir.resolve()
    PACKAGE = ROOT / "package"
    DATABASE = ROOT / "kb.sqlite3"
    MARKER = ROOT / "INDEX_COMPLETE.json"
    BATCH_SIZE = args.batch_size
    if BATCH_SIZE < 1:
        parser.error("--batch-size must be at least 1")
    if not PACKAGE.is_dir():
        parser.error(f"package directory not found: {PACKAGE}")

    if DATABASE.exists():
        raise RuntimeError(f"refusing to overwrite existing database: {DATABASE}")
    if MARKER.exists():
        raise RuntimeError(f"refusing to overwrite existing marker: {MARKER}")

    run_manifest = json.loads(
        (PACKAGE / "run_manifest.json").read_text(encoding="utf-8")
    )
    vector_path = PACKAGE / "vectors/vectors.f16.npy"
    chunk_ids_path = PACKAGE / "chunks/chunk_ids.json"
    vectors = np.load(vector_path, mmap_mode="r")
    chunk_ids = json.loads(chunk_ids_path.read_text(encoding="utf-8"))
    embedding_dim = int(vectors.shape[1])
    embedding_dtype = str(vectors.dtype)
    run_chunk_count = int(run_manifest["stages"]["chunk"]["chunk_count"])
    if vectors.shape[0] != run_chunk_count or len(chunk_ids) != run_chunk_count:
        raise RuntimeError(
            "vector/chunk count mismatch: "
            f"manifest={run_chunk_count}, vectors={vectors.shape[0]}, "
            f"chunk_ids={len(chunk_ids)}"
        )
    started = time.perf_counter()

    connection = sqlite3.connect(DATABASE)
    connection.executescript(
        """
        PRAGMA page_size=4096;
        PRAGMA journal_mode=OFF;
        PRAGMA synchronous=OFF;
        PRAGMA temp_store=MEMORY;
        PRAGMA cache_size=-262144;

        CREATE TABLE metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE documents (
            doc_id TEXT PRIMARY KEY,
            source_relpath TEXT NOT NULL,
            source_sha256 TEXT NOT NULL,
            parser TEXT NOT NULL,
            text_chars INTEGER NOT NULL,
            text_sha256 TEXT NOT NULL,
            status TEXT NOT NULL,
            error TEXT NOT NULL,
            text_path TEXT NOT NULL
        ) WITHOUT ROWID;

        CREATE TABLE chunks (
            row_idx INTEGER PRIMARY KEY,
            chunk_id TEXT UNIQUE NOT NULL,
            doc_id TEXT NOT NULL REFERENCES documents(doc_id),
            source_relpath TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            char_start INTEGER NOT NULL,
            char_end INTEGER NOT NULL,
            char_count INTEGER NOT NULL,
            text TEXT NOT NULL,
            chunk_version TEXT NOT NULL
        );

        CREATE TABLE files_ruled (
            source_relpath TEXT PRIMARY KEY,
            size_bytes INTEGER NOT NULL,
            sha256 TEXT NOT NULL,
            extension TEXT NOT NULL,
            decision TEXT NOT NULL,
            reason TEXT NOT NULL
        ) WITHOUT ROWID;
        """
    )

    metadata = {
        "schema_version": "kb-acceptance-v1",
        "snapshot_id": run_manifest["snapshot_id"],
        "source_manifest_sha256": run_manifest["source_manifest_sha256"],
        "model_name": run_manifest["model"]["name"],
        "model_revision": run_manifest["model"]["revision"],
        "embedding_dtype": embedding_dtype,
        "embedding_dim": str(embedding_dim),
        "normalize_embeddings": str(
            run_manifest["model"].get("normalize_embeddings", True)
        ).lower(),
        "chunk_version": run_manifest["chunking"]["chunk_version"],
        "producer_chunk_version": run_manifest["chunking"]["chunk_version"],
        "chunk_size_chars": str(run_manifest["chunking"]["chunk_size_chars"]),
        "overlap_chars": str(run_manifest["chunking"]["overlap_chars"]),
        "chunk_count": str(run_manifest["stages"]["chunk"]["chunk_count"]),
        "source_files": str(run_manifest["source_files"]),
        "vector_path": str(vector_path.relative_to(ROOT)),
        "vector_sha256": run_manifest["stages"]["embed"]["vectors_sha256"],
        "vector_index_type": "exact_flat_fp16_numpy",
        "fts_tokenizer": "trigram",
        "built_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }
    connection.executemany(
        "INSERT INTO metadata(key, value) VALUES (?, ?)", metadata.items()
    )

    documents_path = PACKAGE / "extract/documents.jsonl"
    with documents_path.open(encoding="utf-8") as stream:
        documents = [
            (
                row["doc_id"],
                row["source_relpath"],
                row["source_sha256"],
                row["parser"],
                row["text_chars"],
                row["text_sha256"],
                row["status"],
                row["error"],
                row["text_path"],
            )
            for row in (json.loads(line) for line in stream if line.strip())
        ]
    connection.executemany(
        """
        INSERT INTO documents(
            doc_id, source_relpath, source_sha256, parser, text_chars,
            text_sha256, status, error, text_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        documents,
    )

    rules_path = PACKAGE / "extract/files_ruled.csv"
    with rules_path.open(encoding="utf-8-sig", newline="") as stream:
        rules = [
            (
                row["source_relpath"],
                int(row["size_bytes"]),
                row["sha256"],
                row["extension"],
                row["decision"],
                row["reason"],
            )
            for row in csv.DictReader(stream)
        ]
    connection.executemany(
        """
        INSERT INTO files_ruled(
            source_relpath, size_bytes, sha256, extension, decision, reason
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        rules,
    )
    connection.commit()
    print(f"loaded {len(documents):,} documents, {len(rules):,} rules", flush=True)

    chunks_path = PACKAGE / "chunks/chunks.jsonl"
    batch: list[tuple] = []
    chunk_count = 0
    with chunks_path.open(encoding="utf-8") as stream:
        for line in stream:
            row = json.loads(line)
            chunk_count += 1
            batch.append(
                (
                    chunk_count,
                    row["chunk_id"],
                    row["doc_id"],
                    row["source_relpath"],
                    row["chunk_index"],
                    row["char_start"],
                    row["char_end"],
                    row["char_count"],
                    row["text"],
                    row["chunk_version"],
                )
            )
            if len(batch) == BATCH_SIZE:
                connection.executemany(
                    """
                    INSERT INTO chunks(
                        row_idx, chunk_id, doc_id, source_relpath, chunk_index,
                        char_start, char_end, char_count, text, chunk_version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    batch,
                )
                batch.clear()
                if chunk_count % 50_000 == 0:
                    elapsed = time.perf_counter() - started
                    print(f"loaded {chunk_count:,} chunks in {elapsed:.1f}s", flush=True)
        if batch:
            connection.executemany(
                """
                INSERT INTO chunks(
                    row_idx, chunk_id, doc_id, source_relpath, chunk_index,
                    char_start, char_end, char_count, text, chunk_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                batch,
            )
    connection.commit()

    connection.execute(
        """
        CREATE VIRTUAL TABLE chunks_fts USING fts5(
            text,
            source_relpath UNINDEXED,
            content='chunks',
            content_rowid='row_idx',
            tokenize='trigram'
        )
        """
    )
    print("loading FTS5 trigram index", flush=True)
    for lower in range(1, chunk_count + 1, 50_000):
        upper = min(lower + 50_000 - 1, chunk_count)
        connection.execute(
            """
            INSERT INTO chunks_fts(rowid, text, source_relpath)
            SELECT row_idx, text, source_relpath
            FROM chunks
            WHERE row_idx BETWEEN ? AND ?
            """,
            (lower, upper),
        )
        connection.commit()
        print(f"indexed FTS rows {lower:,}-{upper:,}", flush=True)
    connection.execute("INSERT INTO chunks_fts(chunks_fts) VALUES('optimize')")
    connection.execute("ANALYZE")
    connection.commit()

    fts_count = connection.execute("SELECT count(*) FROM chunks_fts").fetchone()[0]
    if fts_count != chunk_count:
        raise RuntimeError(f"FTS row count mismatch: {fts_count} != {chunk_count}")
    metadata_count = connection.execute("SELECT count(*) FROM metadata").fetchone()[0]
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA synchronous=NORMAL")
    connection.execute("PRAGMA mmap_size=268435456")
    connection.commit()
    connection.close()

    elapsed = time.perf_counter() - started
    db_size = DATABASE.stat().st_size
    wal_path = DATABASE.with_suffix(DATABASE.suffix + "-wal")
    shm_path = DATABASE.with_suffix(DATABASE.suffix + "-shm")
    wal_size = wal_path.stat().st_size if wal_path.exists() else 0
    shm_size = shm_path.stat().st_size if shm_path.exists() else 0
    vector_size = (PACKAGE / "vectors/vectors.f16.npy").stat().st_size
    marker = {
        "status": "DONE",
        "database": str(DATABASE),
        "database_bytes": db_size,
        "wal_bytes": wal_size,
        "shm_bytes": shm_size,
        "vector_index": metadata["vector_path"],
        "vector_index_bytes": vector_size,
        "total_index_bytes": db_size + wal_size + shm_size + vector_size,
        "fts_index_bytes": db_size,
        "database_sha256": file_sha256(DATABASE),
        "chunks": chunk_count,
        "documents": len(documents),
        "files_ruled": len(rules),
        "metadata_rows": metadata_count,
        "fts_probe_rows": fts_count,
        "elapsed_seconds": round(elapsed, 3),
        "completed_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }
    MARKER.write_text(
        json.dumps(marker, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    vector_meta = {
        "model_name": metadata["model_name"],
        "model_revision": metadata["model_revision"],
        "dimension": embedding_dim,
        "dtype": embedding_dtype,
        "normalize_embeddings": metadata["normalize_embeddings"] == "true",
        "query_prefix": (
            "为这个句子生成表示以用于检索相关文章："
            if "bge" in metadata["model_name"].casefold()
            else ""
        ),
    }
    (ROOT / "vector_meta.json").write_text(
        json.dumps(vector_meta, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(marker, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
