from __future__ import annotations

"""Verify output hashes and vector/chunk structure against run_manifest.json.

Usage:
    python scripts/verify.py --output-dir <build-output>
"""

import argparse
import csv
import hashlib
import json
import time
from collections import Counter
from pathlib import Path

import numpy as np


OUTPUT_LAYOUT = {
    "vectors": "vectors/vectors.f16.npy",
    "chunks": "chunks/chunks.jsonl",
    "chunk_ids": "chunks/chunk_ids.json",
    "files_ruled": "extract/files_ruled.csv",
    "documents": "extract/documents.jsonl",
}


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify knowledge-base outputs against run_manifest.json."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="建库输出目录（包含 package/）",
    )
    parser.add_argument(
        "--package-dir",
        type=Path,
        default=None,
        help="package 目录，缺省为 <output-dir>/package",
    )
    args = parser.parse_args()

    output_dir = args.output_dir.resolve()
    package = (
        args.package_dir.resolve() if args.package_dir else output_dir / "package"
    )
    manifest_path = package / "run_manifest.json"
    if not manifest_path.is_file():
        parser.error(f"run manifest not found: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    outputs = manifest.get("outputs", {})
    missing_outputs = [key for key in OUTPUT_LAYOUT if key not in outputs]
    if missing_outputs:
        parser.error(
            "run manifest is missing expected outputs: " + ", ".join(missing_outputs)
        )
    expected = {
        OUTPUT_LAYOUT[key]: (
            int(outputs[key]["bytes"]),
            outputs[key]["sha256"],
        )
        for key in OUTPUT_LAYOUT
    }

    started = time.perf_counter()
    file_checks = {}
    all_files_pass = True
    for relative, (expected_size, expected_sha) in expected.items():
        path = package / relative
        actual_size = path.stat().st_size
        actual_sha = file_sha256(path)
        passed = actual_size == expected_size and actual_sha == expected_sha
        all_files_pass &= passed
        file_checks[relative] = {
            "pass": passed,
            "bytes": actual_size,
            "expected_bytes": expected_size,
            "sha256": actual_sha,
            "expected_sha256": expected_sha,
        }
        print(f"[{'PASS' if passed else 'FAIL'}] {relative}", flush=True)

    chunk_ids: list[str] = []
    seen_chunk_ids: set[str] = set()
    doc_ids: set[str] = set()
    chunk_versions: Counter[str] = Counter()
    chunk_count = 0
    max_chars = 0
    character_count = 0
    duplicate_count = 0
    order_mismatch_count = 0
    chunks_path = package / "chunks/chunks.jsonl"
    with chunks_path.open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, start=1):
            row = json.loads(line)
            chunk_id = row["chunk_id"]
            if chunk_id in seen_chunk_ids:
                duplicate_count += 1
            seen_chunk_ids.add(chunk_id)
            doc_ids.add(row["doc_id"])
            chunk_versions[row.get("chunk_version", "")] += 1
            length = len(row["text"])
            if length != row["char_count"]:
                raise ValueError(f"char_count mismatch at line {line_number}")
            max_chars = max(max_chars, length)
            character_count += length
            chunk_ids.append(chunk_id)
            chunk_count += 1
            if chunk_count % 100_000 == 0:
                print(f"scanned {chunk_count:,} chunks", flush=True)

    expected_chunk_ids = json.loads(
        (package / "chunks/chunk_ids.json").read_text(encoding="utf-8")
    )
    for position, (actual, expected) in enumerate(
        zip(chunk_ids, expected_chunk_ids, strict=False), start=1
    ):
        if actual != expected:
            order_mismatch_count += 1
            if order_mismatch_count <= 3:
                print(
                    f"chunk_ids mismatch at row {position}: "
                    f"{actual!r} != {expected!r}",
                    flush=True,
                )

    vectors = np.load(package / "vectors/vectors.f16.npy", mmap_mode="r")
    embed_stage = manifest["stages"]["embed"]
    expected_shape = tuple(int(value) for value in embed_stage["shape"])
    expected_dtype = np.dtype(embed_stage["dtype"])
    expected_max_chars = int(manifest["chunking"]["chunk_size_chars"])
    normalize_embeddings = bool(
        manifest.get("model", {}).get(
            "normalize_embeddings",
            embed_stage.get("normalize_embeddings", True),
        )
    )
    finite = True
    nonzero = True
    norm_min = float("inf")
    norm_max = 0.0
    for start in range(0, vectors.shape[0], 20_000):
        block = np.asarray(vectors[start : start + 20_000], dtype=np.float32)
        finite &= bool(np.isfinite(block).all())
        norms = np.linalg.norm(block, axis=1)
        nonzero &= bool((norms > 0).all())
        norm_min = min(norm_min, float(norms.min()))
        norm_max = max(norm_max, float(norms.max()))

    documents: list[dict] = []
    with (package / "extract/documents.jsonl").open(encoding="utf-8") as stream:
        documents = [json.loads(line) for line in stream if line.strip()]
    document_statuses = Counter(item["status"] for item in documents)
    document_ids = {item["doc_id"] for item in documents}

    with (package / "extract/files_ruled.csv").open(
        encoding="utf-8-sig", newline=""
    ) as stream:
        ruled = list(csv.DictReader(stream))
    decisions = Counter(item["decision"] for item in ruled)

    structural_checks = {
        "chunks": chunk_count,
        "chunk_ids": len(expected_chunk_ids),
        "document_rows": len(documents),
        "files_ruled": len(ruled),
        "row_count_match": (
            chunk_count == len(expected_chunk_ids) == vectors.shape[0]
        ),
        "unique_chunk_ids": len(seen_chunk_ids),
        "duplicate_chunk_ids": duplicate_count,
        "chunk_ids_order_mismatches": order_mismatch_count,
        "chunk_length_max": max_chars,
        "chunk_character_count": character_count,
        "chunk_versions": dict(chunk_versions),
        "vectors_shape": list(vectors.shape),
        "vectors_expected_shape": list(expected_shape),
        "vectors_dtype": str(vectors.dtype),
        "vectors_expected_dtype": str(expected_dtype),
        "vectors_finite": finite,
        "vectors_all_rows_nonzero": nonzero,
        "vectors_norm_min": norm_min,
        "vectors_norm_max": norm_max,
        "document_statuses": dict(document_statuses),
        "files_ruled_decisions": dict(decisions),
        "documents_unique_ids": len(document_ids),
        "chunks_doc_ids_in_documents": doc_ids <= document_ids,
        "chunks_doc_ids_missing_from_documents": len(doc_ids - document_ids),
    }
    structural_pass = all(
        (
            structural_checks["row_count_match"],
            duplicate_count == 0,
            order_mismatch_count == 0,
            max_chars <= expected_max_chars,
            tuple(vectors.shape) == expected_shape,
            vectors.dtype == expected_dtype,
            finite,
            nonzero,
            (
                not normalize_embeddings
                or (
                    norm_min >= 0.99
                    and norm_max <= 1.01
                )
            ),
            structural_checks["chunks_doc_ids_in_documents"],
        )
    )
    result = {
        "status": "PASS" if all_files_pass and structural_pass else "FAIL",
        "files": file_checks,
        "structural": structural_checks,
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "verified_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }
    output = package.parent / "acceptance_verify.json"
    output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(structural_checks, ensure_ascii=False, indent=2), flush=True)
    print(f"OVERALL={result['status']} output={output}", flush=True)
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
