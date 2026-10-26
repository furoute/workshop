from __future__ import annotations

"""Run joint FTS5 + vector retrieval across two knowledge-base indexes.

Usage:
    python scripts/query.py \
        --query "<question>" \
        --main-dir <main-index-output> \
        --others-dir <secondary-index-output>
"""

import argparse
import json
import re
import sqlite3
import sys
import time
from dataclasses import dataclass
from pathlib import Path, PurePosixPath


MODEL_DIR: Path | None = None
MODEL_NAME = "BAAI/bge-small-zh-v1.5"
MODEL_REVISION: str | None = None
QUERY_PREFIX = "为这个句子生成表示以用于检索相关文章："
QUERY_PREFIX_OVERRIDE = False
RRF_K = 60
TOP_CANDIDATES = 1_000


@dataclass(frozen=True)
class Dataset:
    dataset_id: str
    database: Path
    vectors: Path
    chunk_ids: Path
    vector_meta: Path


DATASETS: tuple[Dataset, ...] = ()


def quoted(term: str) -> str:
    return '"' + term.replace('"', '""') + '"'


def fts_expressions(query: str) -> tuple[str, str]:
    tokens = [
        token
        for token in re.findall(r"[\w\u3400-\u9fff]+", query, flags=re.UNICODE)
        if len(token) >= 3
    ]
    if not tokens:
        return "", ""
    unique_tokens = list(dict.fromkeys(tokens))
    latin_tokens = [quoted(token) for token in unique_tokens if token.isascii()]
    cjk_tokens = [quoted(token) for token in unique_tokens if not token.isascii()]
    groups = []
    if len(latin_tokens) >= 2:
        groups.append("(" + " AND ".join(latin_tokens) + ")")
    if len(cjk_tokens) >= 2:
        groups.append("(" + " AND ".join(cjk_tokens) + ")")
    if not groups:
        groups.append(
            "("
            + " AND ".join(quoted(token) for token in unique_tokens)
            + ")"
        )
    return " OR ".join(groups), " OR ".join(
        quoted(token) for token in unique_tokens
    )


def like_terms(query: str) -> list[str]:
    terms = re.findall(r"[\w\u3400-\u9fff]+", query, flags=re.UNICODE)
    return list(dict.fromkeys(term for term in terms if len(term) >= 2))


def chunk_key(dataset_id: str, chunk_id: str) -> str:
    return f"{dataset_id}\0chunk\0{chunk_id}"


def file_key(dataset_id: str, source_relpath: str) -> str:
    return f"{dataset_id}\0file\0{source_relpath}"


def locate_first(root: Path, candidates: tuple[str, ...], label: str) -> Path:
    for relative in candidates:
        path = root / relative
        if path.is_file():
            return path
    choices = ", ".join(candidates)
    raise FileNotFoundError(f"{label} not found under {root}; tried: {choices}")


def dataset_from_root(dataset_id: str, root: Path) -> Dataset:
    database = root / "kb.sqlite3"
    if not database.is_file():
        raise FileNotFoundError(f"database not found: {database}")
    return Dataset(
        dataset_id=dataset_id,
        database=database,
        vectors=locate_first(
            root,
            ("vectors.f16.npy", "package/vectors/vectors.f16.npy"),
            "vectors",
        ),
        chunk_ids=locate_first(
            root,
            ("chunk_ids.json", "package/chunks/chunk_ids.json"),
            "chunk_ids",
        ),
        vector_meta=root / "vector_meta.json",
    )


class JointSearchEngine:
    def __init__(self) -> None:
        import numpy as np
        import torch
        from transformers import AutoModel, AutoTokenizer

        self.np = np
        self.torch = torch
        global MODEL_REVISION
        index_revisions = {
            meta["model_revision"]
            for dataset in DATASETS
            if dataset.vector_meta.is_file()
            for meta in [
                json.loads(dataset.vector_meta.read_text(encoding="utf-8"))
            ]
            if meta.get("model_revision")
        }
        if len(index_revisions) > 1:
            raise RuntimeError(
                f"index model revisions differ: {sorted(index_revisions)}"
            )
        if MODEL_REVISION and index_revisions and MODEL_REVISION not in index_revisions:
            raise RuntimeError(
                f"model revision mismatch: {MODEL_REVISION!r} "
                f"not in {sorted(index_revisions)}"
            )
        if MODEL_REVISION is None and index_revisions:
            MODEL_REVISION = next(iter(index_revisions))
        model_source: str | Path = MODEL_DIR or MODEL_NAME
        if isinstance(model_source, Path) and not model_source.is_dir():
            raise RuntimeError(f"model directory not found: {model_source}")
        model_options: dict = {"local_files_only": True}
        if MODEL_REVISION and not isinstance(model_source, Path):
            model_options["revision"] = MODEL_REVISION
        self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.tokenizer = AutoTokenizer.from_pretrained(model_source, **model_options)
        self.model = (
            AutoModel.from_pretrained(model_source, **model_options)
            .eval()
            .to(self.device)
        )
        self.connections = {
            dataset.dataset_id: sqlite3.connect(dataset.database) for dataset in DATASETS
        }
        self.chunk_id_lists = {
            dataset.dataset_id: json.loads(
                dataset.chunk_ids.read_text(encoding="utf-8")
            )
            for dataset in DATASETS
        }
        self.vector_arrays = {
            dataset.dataset_id: np.load(dataset.vectors, mmap_mode="r")
            for dataset in DATASETS
        }
        self.query_prefix = self._validate_index_metadata()
        self.file_schemas = {
            dataset.dataset_id: self._file_schema(dataset.dataset_id)
            for dataset in DATASETS
        }

    def _validate_index_metadata(self) -> str:
        metas: list[dict] = []
        for dataset in DATASETS:
            vectors = self.vector_arrays[dataset.dataset_id]
            chunk_ids = self.chunk_id_lists[dataset.dataset_id]
            if vectors.shape[0] != len(chunk_ids):
                raise RuntimeError(
                    f"{dataset.dataset_id}: vector/chunk count mismatch "
                    f"{vectors.shape[0]} != {len(chunk_ids)}"
                )
            if not dataset.vector_meta.is_file():
                continue
            meta = json.loads(dataset.vector_meta.read_text(encoding="utf-8"))
            metas.append(meta)
            if meta.get("model_name") and meta["model_name"] != MODEL_NAME:
                raise RuntimeError(
                    f"{dataset.dataset_id}: model mismatch "
                    f"{meta['model_name']!r} != {MODEL_NAME!r}"
                )
            if MODEL_REVISION and meta.get("model_revision") not in {
                None,
                MODEL_REVISION,
            }:
                raise RuntimeError(
                    f"{dataset.dataset_id}: model revision mismatch "
                    f"{meta['model_revision']!r} != {MODEL_REVISION!r}"
                )
            if int(meta.get("dimension", vectors.shape[1])) != vectors.shape[1]:
                raise RuntimeError(
                    f"{dataset.dataset_id}: embedding dimension mismatch"
                )
        if metas:
            revisions = {
                meta["model_revision"]
                for meta in metas
                if meta.get("model_revision")
            }
            if len(revisions) > 1:
                raise RuntimeError(f"index model revisions differ: {sorted(revisions)}")
            prefixes = {
                meta.get("query_prefix", "")
                for meta in metas
                if "query_prefix" in meta
            }
            if len(prefixes) > 1:
                raise RuntimeError("index query prefixes differ")
            if QUERY_PREFIX_OVERRIDE:
                return QUERY_PREFIX
            return next(iter(prefixes), QUERY_PREFIX)
        return QUERY_PREFIX

    def _file_schema(self, dataset_id: str) -> str:
        connection = self.connections[dataset_id]
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type IN ('table', 'view')"
            )
        }
        if {"filename_only", "catalog_only"} <= tables:
            return "filename_only"
        if "files_ruled" in tables:
            return "files_ruled"
        return "none"

    def close(self) -> None:
        for connection in self.connections.values():
            connection.close()

    def encode_queries(self, queries: list[str]):
        inputs = self.tokenizer(
            [self.query_prefix + query for query in queries],
            truncation=True,
            max_length=512,
            padding=True,
            return_tensors="pt",
        )
        inputs = {key: value.to(self.device) for key, value in inputs.items()}
        with self.torch.inference_mode():
            hidden = self.model(**inputs).last_hidden_state[:, 0]
            encoded = self.torch.nn.functional.normalize(
                hidden.float(), p=2, dim=1
            )
        return encoded.cpu().numpy().astype(self.np.float32)

    def _search_chunks(
        self, dataset_id: str, query: str
    ) -> tuple[list[str], dict[str, dict]]:
        connection = self.connections[dataset_id]
        rows: list[tuple[str, str, int, str]] = []
        for expression in fts_expressions(query):
            if not expression:
                continue
            rows = connection.execute(
                """
                SELECT
                    c.chunk_id,
                    c.source_relpath,
                    c.chunk_index,
                    c.text
                FROM chunks_fts
                JOIN chunks AS c ON c.row_idx = chunks_fts.rowid
                WHERE chunks_fts MATCH ?
                ORDER BY bm25(chunks_fts), c.row_idx
                LIMIT ?
                """,
                (expression, TOP_CANDIDATES),
            ).fetchall()
            if rows:
                break
        keys: list[str] = []
        details: dict[str, dict] = {}
        for chunk_id, source_relpath, chunk_index, text in rows:
            key = chunk_key(dataset_id, chunk_id)
            keys.append(key)
            details[key] = {
                "dataset_id": dataset_id,
                "result_type": "chunk",
                "chunk_id": chunk_id,
                "source_relpath": source_relpath,
                "chunk_index": chunk_index,
                "snippet": text[:320].replace("\n", " "),
            }
        return keys, details

    def _search_vectors(
        self, dataset_id: str, query_vector
    ) -> list[str]:
        np = self.np
        vectors = self.vector_arrays[dataset_id]
        chunk_ids = self.chunk_id_lists[dataset_id]
        indices: list[np.ndarray] = []
        scores: list[np.ndarray] = []
        for start in range(0, vectors.shape[0], 25_000):
            block = np.asarray(vectors[start : start + 25_000], dtype=np.float32)
            block_scores = block @ query_vector
            local_count = min(TOP_CANDIDATES, block_scores.shape[0])
            local_indices = (
                np.argpartition(block_scores, -local_count)[-local_count:]
                if local_count < block_scores.shape[0]
                else np.arange(block_scores.shape[0])
            )
            indices.append(local_indices.astype(np.int64) + start)
            scores.append(block_scores[local_indices])
        all_indices = np.concatenate(indices)
        all_scores = np.concatenate(scores)
        keep = min(TOP_CANDIDATES, all_scores.shape[0])
        positions = np.argpartition(all_scores, -keep)[-keep:]
        order = positions[np.argsort(-all_scores[positions])]
        return [
            chunk_key(dataset_id, chunk_ids[int(all_indices[position])])
            for position in order
        ]

    def _file_rows(self, dataset_id: str, query: str) -> dict[str, dict]:
        connection = self.connections[dataset_id]
        rows: list[tuple[str, str, str, str]] = []
        term_sets = list(
            dict.fromkeys(
                [query.strip().strip('"')] + like_terms(query)
            )
        )
        for terms in ([term_sets[0]], term_sets[1:]):
            if not terms:
                continue
            if self.file_schemas[dataset_id] == "filename_only":
                conditions = " OR ".join(
                    "(filename LIKE ? OR source_relpath LIKE ?)" for _ in terms
                )
                parameters: list[str] = []
                for term in terms:
                    parameters.extend((f"%{term}%", f"%{term}%"))
                rows.extend(
                    connection.execute(
                        f"""
                        SELECT filename, source_relpath, doc_id, 'filename_only'
                        FROM filename_only
                        WHERE {conditions}
                        LIMIT 500
                        """,
                        parameters,
                    ).fetchall()
                )
                rows.extend(
                    connection.execute(
                        f"""
                        SELECT filename, source_relpath, source_relpath, 'catalog_only'
                        FROM catalog_only
                        WHERE {conditions}
                        LIMIT 500
                        """,
                        parameters,
                    ).fetchall()
                )
            elif self.file_schemas[dataset_id] == "files_ruled":
                conditions = " OR ".join("source_relpath LIKE ?" for _ in terms)
                parameters = [f"%{term}%" for term in terms]
                rows.extend(
                    (
                        PurePosixPath(path).name,
                        path,
                        path,
                        "files_ruled",
                    )
                    for (path,) in connection.execute(
                        f"""
                        SELECT source_relpath
                        FROM files_ruled
                        WHERE {conditions}
                        LIMIT 500
                        """,
                        parameters,
                    )
                )

        if connection.execute(
            "SELECT 1 FROM sqlite_master WHERE name='file_fts'"
        ).fetchone():
            for expression in fts_expressions(query):
                if not expression:
                    continue
                fts_rows = connection.execute(
                    """
                    SELECT filename, source_relpath, record_id, record_type
                    FROM file_fts
                    WHERE file_fts MATCH ?
                    ORDER BY bm25(file_fts), rowid
                    LIMIT ?
                    """,
                    (expression, TOP_CANDIDATES),
                ).fetchall()
                if fts_rows:
                    rows = fts_rows + rows
                    break

        details: dict[str, dict] = {}
        for filename, source_relpath, record_id, record_type in rows:
            key = file_key(dataset_id, source_relpath)
            details[key] = {
                "dataset_id": dataset_id,
                "result_type": "file",
                "filename": filename,
                "source_relpath": source_relpath,
                "record_id": record_id,
                "record_type": record_type,
            }
        return details

    def _load_chunk_details(
        self, dataset_id: str, chunk_ids: list[str]
    ) -> dict[str, dict]:
        if not chunk_ids:
            return {}
        connection = self.connections[dataset_id]
        placeholders = ",".join("?" for _ in chunk_ids)
        rows = connection.execute(
            f"""
            SELECT chunk_id, source_relpath, chunk_index, text
            FROM chunks
            WHERE chunk_id IN ({placeholders})
            """,
            chunk_ids,
        ).fetchall()
        return {
            chunk_key(dataset_id, chunk_id): {
                "dataset_id": dataset_id,
                "result_type": "chunk",
                "chunk_id": chunk_id,
                "source_relpath": source_relpath,
                "chunk_index": chunk_index,
                "snippet": text[:320].replace("\n", " "),
            }
            for chunk_id, source_relpath, chunk_index, text in rows
        }

    def search(
        self, query: str, query_vector, top: int = 10
    ) -> dict:
        started = time.perf_counter()
        channels: dict[str, list[str]] = {}
        details: dict[str, dict] = {}
        for dataset in DATASETS:
            dataset_id = dataset.dataset_id
            fts_keys, fts_details = self._search_chunks(dataset_id, query)
            channels[f"{dataset_id}:chunk_fts"] = fts_keys
            details.update(fts_details)
            channels[f"{dataset_id}:vector"] = self._search_vectors(
                dataset_id, query_vector
            )
            filename_query = bool(
                re.search(r"\.[A-Za-z0-9]{1,8}\s*$", query)
                or "/" in query
                or "\\" in query
            )
            file_details = (
                self._file_rows(dataset_id, query)
                if self.file_schemas[dataset_id] != "none" or filename_query
                else {}
            )
            file_keys = list(file_details)
            channels[f"{dataset_id}:file_metadata"] = file_keys[:200]
            exact_query = query.strip().casefold()
            channels[f"{dataset_id}:file_exact"] = [
                key
                for key, detail in file_details.items()
                if exact_query
                and (
                    exact_query in detail["filename"].casefold()
                    or exact_query in detail["source_relpath"].casefold()
                )
            ][:50]
            details.update(file_details)

        fused_scores: dict[str, float] = {}
        support: dict[str, list[dict]] = {}
        for channel, keys in channels.items():
            weight = (
                5.0
                if channel.endswith(":file_exact")
                else 1.5
                if channel.endswith(":file_metadata")
                else 1.0
            )
            for rank, key in enumerate(keys, start=1):
                fused_scores[key] = fused_scores.get(key, 0.0) + weight / (
                    RRF_K + rank
                )
                support.setdefault(key, []).append({"channel": channel, "rank": rank})
        ranked = sorted(fused_scores.items(), key=lambda item: (-item[1], item[0]))

        needed: dict[str, list[str]] = {}
        for key, _ in ranked[: top * 8]:
            if key in details:
                continue
            dataset_id, record_type, record_id = key.split("\0", 2)
            if record_type == "chunk":
                needed.setdefault(dataset_id, []).append(record_id)
        for dataset_id, chunk_ids in needed.items():
            details.update(self._load_chunk_details(dataset_id, chunk_ids))

        results: list[dict] = []
        seen_paths: set[tuple[str, str]] = set()
        for key, score in ranked:
            detail = details.get(key)
            if detail is None:
                continue
            path_key = (detail["dataset_id"], detail["source_relpath"])
            if path_key in seen_paths:
                continue
            seen_paths.add(path_key)
            results.append(
                {
                    **detail,
                    "rrf_score": round(score, 8),
                    "matched_channels": support[key],
                }
            )
            if len(results) >= top:
                break

        dataset_counts: dict[str, int] = {}
        for result in results:
            dataset_id = result["dataset_id"]
            dataset_counts[dataset_id] = dataset_counts.get(dataset_id, 0) + 1
        return {
            "status": "DONE",
            "query": query,
            "dataset_ids": [dataset.dataset_id for dataset in DATASETS],
            "channels": {name: len(keys) for name, keys in channels.items()},
            "top_dataset_counts": dataset_counts,
            "top_results": results,
            "elapsed_ms": round((time.perf_counter() - started) * 1000, 3),
        }


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(
        description="Run joint FTS5 + vector retrieval across two indexes."
    )
    parser.add_argument("--query", required=True, help="检索问题")
    parser.add_argument(
        "--main-dir",
        type=Path,
        required=True,
        help="主库输出目录",
    )
    parser.add_argument(
        "--others-dir",
        type=Path,
        required=True,
        help="第二个库输出目录",
    )
    parser.add_argument(
        "--model-dir",
        type=Path,
        default=None,
        help="本地 embedding 模型目录，缺省从 HF 缓存加载",
    )
    parser.add_argument(
        "--model",
        default="BAAI/bge-small-zh-v1.5",
        help="embedding 模型名",
    )
    parser.add_argument(
        "--model-revision",
        default=None,
        help="模型 revision；缺省从 vector_meta.json 读取",
    )
    parser.add_argument(
        "--query-prefix",
        default=None,
        help="检索 query 前缀；缺省从 vector_meta.json 读取",
    )
    parser.add_argument("--top", type=int, default=10)
    args = parser.parse_args()

    global MODEL_DIR, MODEL_NAME, MODEL_REVISION, QUERY_PREFIX
    global QUERY_PREFIX_OVERRIDE, DATASETS
    MODEL_DIR = args.model_dir.resolve() if args.model_dir else None
    MODEL_NAME = args.model
    MODEL_REVISION = args.model_revision
    if args.query_prefix is not None:
        QUERY_PREFIX = args.query_prefix
        QUERY_PREFIX_OVERRIDE = True
    main_dir = args.main_dir.resolve()
    others_dir = args.others_dir.resolve()
    if not main_dir.is_dir():
        parser.error(f"main index directory not found: {main_dir}")
    if not others_dir.is_dir():
        parser.error(f"secondary index directory not found: {others_dir}")
    if args.top < 1:
        parser.error("--top must be at least 1")
    DATASETS = (
        dataset_from_root("main", main_dir),
        dataset_from_root("others", others_dir),
    )

    engine = JointSearchEngine()
    try:
        query_vector = engine.encode_queries([args.query])[0]
        result = engine.search(args.query, query_vector, args.top)
    finally:
        engine.close()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
