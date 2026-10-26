from __future__ import annotations

"""Build a reusable secondary SQLite/FTS5 index from a completed run directory.

Usage:
    python scripts/build_others.py \
        --source-dir <corpus-root> \
        --run-root <extract-chunk-embed-output> \
        --output-root <index-output>
"""

import argparse
import hashlib
import json
import shutil
import sqlite3
import time
from pathlib import Path, PurePosixPath

import numpy as np


DATASET_ID = "others-v1"
BATCH_SIZE = 10_000


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as stream:
        return [json.loads(line) for line in stream if line.strip()]


def copy_atomic(source: Path, destination: Path) -> None:
    temporary = destination.with_name(destination.name + ".tmp")
    shutil.copy2(source, temporary)
    temporary.replace(destination)


def filename_of(relative_path: str) -> str:
    return PurePosixPath(relative_path).name


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build the secondary knowledge-base index."
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        required=True,
        help="原始语料根目录（写入索引元数据）",
    )
    parser.add_argument(
        "--run-root",
        type=Path,
        required=True,
        help="已包含抽取、切块和向量产物的工作目录",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        required=True,
        help="第二套索引输出目录",
    )
    parser.add_argument(
        "--dataset-id",
        default="others-v1",
        help="写入索引的数据集标识",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=10_000,
        help="写入 chunks 表时每批处理的行数",
    )
    args = parser.parse_args()

    global DATASET_ID, BATCH_SIZE
    DATASET_ID = args.dataset_id
    BATCH_SIZE = args.batch_size
    source_root = args.source_dir.resolve()
    run_root = args.run_root.resolve()
    output_root = args.output_root.resolve()
    database_path = output_root / "kb.sqlite3"
    marker_path = output_root / "INDEX_COMPLETE.json"
    if database_path.exists() or marker_path.exists():
        raise RuntimeError(f"refusing to overwrite existing index: {output_root}")
    if not run_root.is_dir():
        raise RuntimeError(f"run root not found: {run_root}")
    if not source_root.is_dir():
        raise RuntimeError(f"source root not found: {source_root}")
    if BATCH_SIZE < 1:
        parser.error("--batch-size must be at least 1")

    extract_summary = json.loads(
        (run_root / "EXTRACT_COMPLETE.json").read_text(encoding="utf-8")
    )
    embed_summary = json.loads(
        (run_root / "vectors/_EMBED_COMPLETE.json").read_text(encoding="utf-8")
    )
    count_keys = (
        "manifest_rows",
        "content_rows",
        "catalog_only_rows",
        "filename_only_old",
    )
    missing_counts = [key for key in count_keys if key not in extract_summary]
    if missing_counts:
        raise RuntimeError(
            "extract summary is missing counts: " + ", ".join(missing_counts)
        )
    expected_counts = {key: int(extract_summary[key]) for key in count_keys}
    if expected_counts["manifest_rows"] != (
        expected_counts["content_rows"] + expected_counts["catalog_only_rows"]
    ):
        raise RuntimeError(
            "extract summary count mismatch: manifest_rows must equal "
            "content_rows + catalog_only_rows"
        )
    if embed_summary.get("status") != "DONE":
        raise RuntimeError("embedding stage is not DONE")

    documents = read_jsonl(run_root / "documents.jsonl")
    catalog_only = read_jsonl(run_root / "catalog_only.jsonl")
    filename_only = read_jsonl(run_root / "filename_only.jsonl")
    if len(documents) != expected_counts["content_rows"]:
        raise RuntimeError(f"documents row count mismatch: {len(documents)}")
    if len(catalog_only) != expected_counts["catalog_only_rows"]:
        raise RuntimeError(f"catalog_only row count mismatch: {len(catalog_only)}")
    if len(filename_only) != expected_counts["filename_only_old"]:
        raise RuntimeError(f"filename_only row count mismatch: {len(filename_only)}")
    catalog_paths = {row["source_relpath"] for row in catalog_only}
    filename_paths = {row["source_relpath"] for row in filename_only}
    if catalog_paths & filename_paths:
        raise RuntimeError("catalog_only and filename_only paths overlap")
    chunks_path = run_root / "chunks.jsonl"
    vector_input_path = run_root / "vector_input.jsonl"
    vectors_path = run_root / "vectors/vectors.f16.npy"
    chunk_ids_path = run_root / "vectors/chunk_ids.json"
    chunk_ids = json.loads(chunk_ids_path.read_text(encoding="utf-8"))

    started = time.perf_counter()
    output_root.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path)
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
            dataset_id TEXT NOT NULL,
            source_relpath TEXT NOT NULL,
            source_sha256 TEXT NOT NULL,
            source_bytes INTEGER NOT NULL,
            layer TEXT NOT NULL,
            parser TEXT NOT NULL,
            text_chars INTEGER NOT NULL,
            text_sha256 TEXT NOT NULL,
            status TEXT NOT NULL,
            error TEXT NOT NULL,
            text_path TEXT NOT NULL
        ) WITHOUT ROWID;

        CREATE TABLE catalog_only (
            source_relpath TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            dataset_id TEXT NOT NULL,
            source_sha256 TEXT NOT NULL,
            source_bytes INTEGER NOT NULL,
            extension TEXT NOT NULL,
            reason TEXT NOT NULL
        ) WITHOUT ROWID;

        CREATE TABLE filename_only (
            doc_id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            dataset_id TEXT NOT NULL,
            source_relpath TEXT NOT NULL UNIQUE,
            source_sha256 TEXT NOT NULL,
            source_bytes INTEGER NOT NULL,
            extension TEXT NOT NULL,
            layer TEXT NOT NULL,
            status TEXT NOT NULL,
            reason TEXT NOT NULL
        ) WITHOUT ROWID;

        CREATE TABLE chunks (
            row_idx INTEGER PRIMARY KEY,
            vector_idx INTEGER,
            chunk_id TEXT UNIQUE NOT NULL,
            doc_id TEXT NOT NULL REFERENCES documents(doc_id),
            dataset_id TEXT NOT NULL,
            source_relpath TEXT NOT NULL,
            layer TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            char_start INTEGER NOT NULL,
            char_end INTEGER NOT NULL,
            char_count INTEGER NOT NULL,
            locator TEXT NOT NULL,
            text TEXT NOT NULL,
            chunk_version TEXT NOT NULL
        );
        """
    )
    connection.executemany(
        "INSERT INTO documents VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [
            (
                row["doc_id"],
                DATASET_ID,
                row["source_relpath"],
                row["source_sha256"],
                int(row["source_bytes"]),
                row["layer"],
                row["parser"],
                int(row["text_chars"]),
                row["text_sha256"],
                row["status"],
                row.get("error", ""),
                row.get("text_path", ""),
            )
            for row in documents
        ],
    )
    connection.executemany(
        "INSERT INTO catalog_only VALUES (?,?,?,?,?,?,?)",
        [
            (
                row["source_relpath"],
                filename_of(row["source_relpath"]),
                DATASET_ID,
                row["source_sha256"],
                int(row["source_bytes"]),
                row["extension"],
                row["reason"],
            )
            for row in catalog_only
        ],
    )
    connection.executemany(
        "INSERT INTO filename_only VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
            (
                row["doc_id"],
                filename_of(row["source_relpath"]),
                DATASET_ID,
                row["source_relpath"],
                row["source_sha256"],
                int(row["source_bytes"]),
                PurePosixPath(row["source_relpath"]).suffix.casefold(),
                row["layer"],
                row["status"],
                row.get("error", ""),
            )
            for row in filename_only
        ],
    )

    vector_ids: list[str] = []
    with vector_input_path.open(encoding="utf-8") as stream:
        for line in stream:
            if line.strip():
                vector_ids.append(json.loads(line)["chunk_id"])
    if vector_ids != chunk_ids:
        raise RuntimeError("vector_input and chunk_ids order mismatch")

    vectors = np.load(vectors_path, mmap_mode="r")
    expected_shape = tuple(embed_summary.get("shape", vectors.shape))
    if vectors.dtype != np.dtype(embed_summary.get("dtype", vectors.dtype)) or (
        vectors.shape != expected_shape or vectors.shape[0] != len(chunk_ids)
    ):
        raise RuntimeError(f"invalid vector shape/dtype: {vectors.shape} {vectors.dtype}")
    embedding_dim = int(vectors.shape[1])

    chunk_count = 0
    vector_chunk_count = 0
    chunk_versions: set[str] = set()
    batch: list[tuple] = []
    vector_position = {chunk_id: index for index, chunk_id in enumerate(chunk_ids)}
    with chunks_path.open(encoding="utf-8") as stream:
        for line in stream:
            row = json.loads(line)
            chunk_count += 1
            chunk_versions.add(row["chunk_version"])
            vector_idx = vector_position.get(row["chunk_id"])
            if vector_idx is not None:
                vector_chunk_count += 1
            batch.append(
                (
                    chunk_count,
                    vector_idx,
                    row["chunk_id"],
                    row["doc_id"],
                    DATASET_ID,
                    row["source_relpath"],
                    row["layer"],
                    int(row["chunk_index"]),
                    int(row["char_start"]),
                    int(row["char_end"]),
                    int(row["char_count"]),
                    row.get("locator", ""),
                    row["text"],
                    row["chunk_version"],
                )
            )
            if len(batch) == BATCH_SIZE:
                connection.executemany(
                    "INSERT INTO chunks VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    batch,
                )
                batch.clear()
                print(f"loaded {chunk_count:,} chunks", flush=True)
    if batch:
        connection.executemany(
            "INSERT INTO chunks VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", batch
        )
    if vector_chunk_count != len(chunk_ids):
        raise RuntimeError(
            f"vector chunks found in chunks table: {vector_chunk_count} != {len(chunk_ids)}"
        )
    if len(chunk_versions) != 1:
        raise RuntimeError(f"mixed or missing chunk versions: {sorted(chunk_versions)}")
    chunk_version = next(iter(chunk_versions))
    connection.executescript(
        """
        CREATE VIRTUAL TABLE chunks_fts USING fts5(
            text,
            source_relpath UNINDEXED,
            dataset_id UNINDEXED,
            content='chunks',
            content_rowid='row_idx',
            tokenize='trigram'
        );
        """
    )
    print("building FTS5 trigram index", flush=True)
    connection.execute(
        """
        INSERT INTO chunks_fts(rowid, text, source_relpath, dataset_id)
        SELECT row_idx, text, source_relpath, dataset_id FROM chunks
        """
    )
    connection.execute("INSERT INTO chunks_fts(chunks_fts) VALUES('optimize')")

    connection.execute(
        """
        CREATE VIRTUAL TABLE file_fts USING fts5(
            filename,
            source_relpath,
            record_id UNINDEXED,
            record_type UNINDEXED,
            dataset_id UNINDEXED,
            tokenize='trigram'
        )
        """
    )
    print("building filename/path FTS5 trigram index", flush=True)
    connection.execute(
        """
        INSERT INTO file_fts(
            filename, source_relpath, record_id, record_type, dataset_id
        )
        SELECT
            filename,
            source_relpath,
            doc_id,
            'filename_only',
            dataset_id
        FROM filename_only
        """
    )
    connection.execute(
        """
        INSERT INTO file_fts(
            filename, source_relpath, record_id, record_type, dataset_id
        )
        SELECT
            filename,
            source_relpath,
            source_relpath,
            'catalog_only',
            dataset_id
        FROM catalog_only
        """
    )
    connection.execute("INSERT INTO file_fts(file_fts) VALUES('optimize')")

    vector_copy = output_root / "vectors.f16.npy"
    chunk_ids_copy = output_root / "chunk_ids.json"
    copy_atomic(vectors_path, vector_copy)
    copy_atomic(chunk_ids_path, chunk_ids_copy)
    vector_sha256 = sha256_file(vector_copy)
    metadata = {
        "schema_version": "kb-multi-dataset-v1",
        "dataset_id": DATASET_ID,
        "source_root": str(source_root),
        "source_files": str(extract_summary["manifest_rows"]),
        "content_files": str(extract_summary["content_rows"]),
        "content_success": str(extract_summary["success"]),
        "content_no_text": str(extract_summary["no_text"]),
        "content_errors": str(extract_summary["errors"]),
        "filename_only_files": str(len(filename_only)),
        "catalog_only_files": str(extract_summary["catalog_only_rows"]),
        "chunk_count": str(chunk_count),
        "vector_chunks": str(len(chunk_ids)),
        "model_name": embed_summary["model"],
        "model_revision": embed_summary["model_revision"],
        "embedding_dtype": str(vectors.dtype),
        "embedding_dim": str(embedding_dim),
        "normalize_embeddings": str(
            embed_summary.get("normalize_embeddings", True)
        ).lower(),
        "chunk_version": chunk_version,
        "fts_tokenizer": "trigram",
        "file_fts_records": str(len(filename_only) + len(catalog_only)),
        "vector_path": str(vector_copy),
        "vector_sha256": vector_sha256,
        "source_manifest_sha256": extract_summary["manifest_sha256"],
        "built_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }
    connection.executemany(
        "INSERT INTO metadata VALUES (?,?)", metadata.items()
    )
    connection.execute("ANALYZE")
    connection.commit()
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA synchronous=NORMAL")
    connection.commit()
    connection.close()

    vector_meta = {
        "model_name": metadata["model_name"],
        "model_revision": metadata["model_revision"],
        "dimension": embedding_dim,
        "dtype": str(vectors.dtype),
        "normalize_embeddings": metadata["normalize_embeddings"] == "true",
        "query_prefix": (
            "为这个句子生成表示以用于检索相关文章："
            if "bge" in metadata["model_name"].casefold()
            else ""
        ),
    }
    (output_root / "vector_meta.json").write_text(
        json.dumps(vector_meta, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    marker = {
        "status": "DONE",
        "dataset_id": DATASET_ID,
        "database": str(database_path),
        "database_bytes": database_path.stat().st_size,
        "database_sha256": sha256_file(database_path),
        "vectors": str(vector_copy),
        "vectors_bytes": vector_copy.stat().st_size,
        "vectors_sha256": vector_sha256,
        "chunk_ids": str(chunk_ids_copy),
        "documents": len(documents),
        "filename_only": len(filename_only),
        "catalog_only": len(catalog_only),
        "chunks": chunk_count,
        "vector_chunks": len(chunk_ids),
        "file_fts_records": len(filename_only) + len(catalog_only),
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "completed_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }
    marker_path.write_text(
        json.dumps(marker, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(marker, ensure_ascii=False, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
