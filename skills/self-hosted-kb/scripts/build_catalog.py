from __future__ import annotations

"""Build a file-catalog SQLite/FTS5 database.

Usage:
    python scripts/build_catalog.py \
        --source-dir <corpus-root> \
        [--source-dir <another-root> ...] \
        --output-dir <catalog-output>
"""

import argparse
import csv
import json
import os
import re
import sqlite3
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath


OUTPUT_ROOT: Path
DATABASE_PATH: Path
BUILD_RECEIPT_PATH: Path
PRIVACY_JSON_PATH: Path
PRIVACY_CSV_PATH: Path
SYSTEM_CSV_PATH: Path
SOURCE_ROOTS: tuple[Path, ...] = ()
PRIVACY_DIRECTORY_NAMES: tuple[str, ...] = ()
SYSTEM_DIRECTORY_NAMES = ("System Volume Information", "$RECYCLE.BIN", "Recycler")
TAG_RULES = (
    ("客户案例", (r"(?i)(?:^|/)case(?:/|$)", r"案例")),
    ("维护记录", (r"(?i)(?:^|/)maintain(?:/|$)", r"维护")),
    ("升级实施", (r"(?i)(?:^|/)upgrade(?:/|$)", r"升级")),
    ("安装部署", (r"(?i)(?:^|/)install(?:/|$)", r"安装")),
    ("故障处理", (r"(?i)(?<![a-z])sr(?![a-z])", r"工单")),
    ("培训资料", (r"(?i)(?:^|/)training(?:/|$)", r"培训")),
)
TAG_VALUES = (
    "客户案例",
    "维护记录",
    "升级实施",
    "安装部署",
    "故障处理",
    "培训资料",
    "未分类",
)


def normalized_absolute_key(path: str | Path) -> str:
    return os.path.normcase(
        os.path.normpath(os.path.abspath(str(path)))
    ).casefold()


def normalized_relative_key(path: str) -> str:
    return os.path.normcase(path.replace("\\", "/")).casefold()


def infer_tag(relative_path: str) -> str:
    path = relative_path.replace("\\", "/")
    for tag, patterns in TAG_RULES:
        if any(re.search(pattern, path) for pattern in patterns):
            return tag
    return "未分类"


def exclusion_type(directory_name: str) -> tuple[str, str] | None:
    folded = directory_name.casefold()
    for name in PRIVACY_DIRECTORY_NAMES:
        if folded == name.casefold():
            return "privacy", f"directory_name:{name}"
    for name in SYSTEM_DIRECTORY_NAMES:
        if folded == name.casefold():
            return "system", f"directory_name:{name}"
    return None


def excluded_tree_summary(directory: Path) -> tuple[int, int, int]:
    files = 0
    size_bytes = 0
    errors = 0
    stack = [directory]
    while stack:
        current = stack.pop()
        try:
            entries = list(os.scandir(current))
        except OSError:
            errors += 1
            continue
        for entry in entries:
            try:
                if entry.is_dir(follow_symlinks=False):
                    stack.append(Path(entry.path))
                elif entry.is_file(follow_symlinks=False):
                    stat = entry.stat(follow_symlinks=False)
                    files += 1
                    size_bytes += stat.st_size
            except OSError:
                errors += 1
    return files, size_bytes, errors


def scan_files() -> tuple[
    list[tuple],
    list[dict],
    dict[str, dict],
    list[dict],
]:
    rows: list[tuple] = []
    exclusions: list[dict] = []
    errors: list[dict] = []
    by_root = {
        str(root): {
            "source_root": str(root),
            "raw_files": 0,
            "indexed_files": 0,
            "raw_bytes": 0,
            "indexed_bytes": 0,
            "privacy_excluded_files": 0,
            "privacy_excluded_bytes": 0,
            "system_excluded_files": 0,
            "system_excluded_bytes": 0,
        }
        for root in SOURCE_ROOTS
    }

    for root in SOURCE_ROOTS:
        if not root.is_dir():
            raise FileNotFoundError(f"source root is not a directory: {root}")
        root_stats = by_root[str(root)]
        stack = [root]
        while stack:
            directory = stack.pop()
            try:
                entries = list(os.scandir(directory))
            except OSError as exc:
                errors.append(
                    {
                        "path": str(directory),
                        "error": f"{type(exc).__name__}: {exc}",
                    }
                )
                continue

            for entry in entries:
                path = Path(entry.path)
                try:
                    if entry.is_dir(follow_symlinks=False):
                        excluded = exclusion_type(entry.name)
                        if excluded is None:
                            stack.append(path)
                            continue

                        category, rule = excluded
                        file_count, size_bytes, tree_errors = (
                            excluded_tree_summary(path)
                        )
                        exclusions.append(
                            {
                                "absolute_directory": str(path),
                                "category": category,
                                "rule": rule,
                                "intentional_exclusion": True,
                                "files_excluded": file_count,
                                "bytes_excluded": size_bytes,
                                "scan_errors": tree_errors,
                            }
                        )
                        root_stats["raw_files"] += file_count
                        root_stats["raw_bytes"] += size_bytes
                        root_stats[f"{category}_excluded_files"] += file_count
                        root_stats[f"{category}_excluded_bytes"] += size_bytes
                        if tree_errors:
                            errors.append(
                                {
                                    "path": str(path),
                                    "error": (
                                        f"could not read {tree_errors} "
                                        "entries in excluded directory"
                                    ),
                                }
                            )
                        continue

                    if not entry.is_file(follow_symlinks=False):
                        continue
                    stat = entry.stat(follow_symlinks=False)
                except OSError as exc:
                    errors.append(
                        {
                            "path": entry.path,
                            "error": f"{type(exc).__name__}: {exc}",
                        }
                    )
                    continue

                absolute_path = str(path.absolute())
                relative_path = path.relative_to(root).as_posix()
                filename = path.name
                mtime_utc = datetime.fromtimestamp(
                    stat.st_mtime, tz=timezone.utc
                ).isoformat(timespec="microseconds")
                rows.append(
                    (
                        str(root),
                        relative_path,
                        filename,
                        filename.casefold(),
                        normalized_relative_key(relative_path),
                        stat.st_size,
                        PurePosixPath(filename).suffix.casefold(),
                        stat.st_mtime_ns,
                        mtime_utc,
                        absolute_path,
                        normalized_absolute_key(absolute_path),
                        infer_tag(relative_path),
                    )
                )
                root_stats["raw_files"] += 1
                root_stats["indexed_files"] += 1
                root_stats["raw_bytes"] += stat.st_size
                root_stats["indexed_bytes"] += stat.st_size

    if errors:
        raise RuntimeError(
            "source scan errors:\n"
            + json.dumps(errors, ensure_ascii=False, indent=2)
        )

    rows.sort(key=lambda row: (row[10], row[9]))
    absolute_keys = [row[10] for row in rows]
    if len(absolute_keys) != len(set(absolute_keys)):
        raise RuntimeError("case-insensitive absolute path collision found")
    exclusions.sort(
        key=lambda row: (row["category"], row["absolute_directory"].casefold())
    )
    return rows, exclusions, by_root, errors


def write_exclusion_manifests(exclusions: list[dict]) -> None:
    privacy_rows = [
        row for row in exclusions if row["category"] == "privacy"
    ]
    system_rows = [row for row in exclusions if row["category"] == "system"]
    privacy_report = {
        "status": "INTENTIONALLY_EXCLUDED",
        "notice": "以下目录被有意排除，其目录内文件从不进入 file-catalog-v2。",
        "policy": {
            "privacy_directory_names": list(PRIVACY_DIRECTORY_NAMES),
            "matching": "目录名大小写不敏感；命中后整棵子树不扫描入索引",
            "system_directory_names": list(SYSTEM_DIRECTORY_NAMES),
        },
        "privacy_directory_count": len(privacy_rows),
        "privacy_files_excluded": sum(
            row["files_excluded"] for row in privacy_rows
        ),
        "privacy_bytes_excluded": sum(
            row["bytes_excluded"] for row in privacy_rows
        ),
        "directories": privacy_rows,
    }
    PRIVACY_JSON_PATH.write_text(
        json.dumps(privacy_report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    fields = (
        "absolute_directory",
        "category",
        "rule",
        "intentional_exclusion",
        "files_excluded",
        "bytes_excluded",
        "scan_errors",
    )
    with PRIVACY_CSV_PATH.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(privacy_rows)
    with SYSTEM_CSV_PATH.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(system_rows)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build a file-catalog SQLite/FTS5 database."
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        action="append",
        required=True,
        help="待扫描目录，可重复传入多个",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="文件目录库输出目录",
    )
    parser.add_argument(
        "--privacy-dir-name",
        action="append",
        default=[],
        help="整棵子树排除的目录名，可重复传入",
    )
    args = parser.parse_args()

    global OUTPUT_ROOT, DATABASE_PATH, BUILD_RECEIPT_PATH, PRIVACY_JSON_PATH
    global PRIVACY_CSV_PATH, SYSTEM_CSV_PATH, SOURCE_ROOTS
    global PRIVACY_DIRECTORY_NAMES
    OUTPUT_ROOT = args.output_dir.resolve()
    DATABASE_PATH = OUTPUT_ROOT / "catalog.sqlite3"
    BUILD_RECEIPT_PATH = OUTPUT_ROOT / "BUILD_RECEIPT.json"
    PRIVACY_JSON_PATH = OUTPUT_ROOT / "privacy-exclusions.json"
    PRIVACY_CSV_PATH = OUTPUT_ROOT / "privacy-exclusions.csv"
    SYSTEM_CSV_PATH = OUTPUT_ROOT / "system-exclusions.csv"
    SOURCE_ROOTS = tuple(dict.fromkeys(path.resolve() for path in args.source_dir))
    PRIVACY_DIRECTORY_NAMES = tuple(args.privacy_dir_name)

    if DATABASE_PATH.exists():
        raise RuntimeError(f"refusing to overwrite existing catalog: {DATABASE_PATH}")

    started = time.perf_counter()
    rows, exclusions, by_root, _ = scan_files()
    indexed_files = len(rows)
    indexed_bytes = sum(row[5] for row in rows)
    raw_files = sum(stats["raw_files"] for stats in by_root.values())
    raw_bytes = sum(stats["raw_bytes"] for stats in by_root.values())
    privacy_files = sum(
        row["files_excluded"]
        for row in exclusions
        if row["category"] == "privacy"
    )
    system_files = sum(
        row["files_excluded"]
        for row in exclusions
        if row["category"] == "system"
    )
    if raw_files != indexed_files + privacy_files + system_files:
        raise RuntimeError(
            "file count mismatch: "
            f"raw={raw_files}, indexed={indexed_files}, "
            f"privacy={privacy_files}, system={system_files}"
        )
    for stats in by_root.values():
        stats["coverage_percent"] = (
            round(stats["indexed_files"] / stats["raw_files"] * 100, 4)
            if stats["raw_files"]
            else 0.0
        )

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    temporary_database = DATABASE_PATH.with_suffix(".sqlite3.tmp")
    if temporary_database.exists():
        raise RuntimeError(
            f"refusing to overwrite temporary catalog: {temporary_database}"
        )

    connection = sqlite3.connect(temporary_database)
    connection.executescript(
        """
        PRAGMA page_size=4096;
        PRAGMA journal_mode=DELETE;
        PRAGMA synchronous=NORMAL;
        PRAGMA temp_store=MEMORY;
        PRAGMA cache_size=-131072;

        CREATE TABLE metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        ) WITHOUT ROWID;

        CREATE TABLE files (
            id INTEGER PRIMARY KEY,
            source_root TEXT NOT NULL,
            relpath TEXT NOT NULL,
            filename TEXT NOT NULL,
            filename_key TEXT NOT NULL,
            relpath_key TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            extension TEXT NOT NULL,
            mtime_ns INTEGER NOT NULL,
            mtime_utc TEXT NOT NULL,
            absolute_path TEXT NOT NULL,
            absolute_path_key TEXT NOT NULL UNIQUE,
            sha256 TEXT,
            tags TEXT NOT NULL,
            UNIQUE (source_root, relpath)
        );

        CREATE INDEX files_filename_key_idx ON files(filename_key);
        CREATE INDEX files_relpath_key_idx ON files(relpath_key);
        CREATE INDEX files_extension_idx ON files(extension);
        CREATE INDEX files_source_root_idx ON files(source_root);
        CREATE INDEX files_tags_idx ON files(tags);
        """
    )

    try:
        with connection:
            connection.executemany(
                """
                INSERT INTO files(
                    source_root, relpath, filename, filename_key, relpath_key,
                    size_bytes, extension, mtime_ns, mtime_utc, absolute_path,
                    absolute_path_key, sha256, tags
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL,?)
                """,
                rows,
            )
            connection.execute(
                """
                CREATE VIRTUAL TABLE files_fts USING fts5(
                    filename,
                    relpath,
                    source_root,
                    absolute_path,
                    content='files',
                    content_rowid='id',
                    tokenize='trigram'
                )
                """
            )
            connection.execute(
                """
                INSERT INTO files_fts(
                    rowid, filename, relpath, source_root, absolute_path
                )
                SELECT id, filename, relpath, source_root, absolute_path
                FROM files
                """
            )
            connection.execute("INSERT INTO files_fts(files_fts) VALUES('optimize')")

            elapsed = round(time.perf_counter() - started, 3)
            metadata = {
                "catalog_version": "file-catalog-v2",
                "built_at": datetime.now().astimezone().isoformat(
                    timespec="seconds"
                ),
                "source_roots": json.dumps(
                    [str(root) for root in SOURCE_ROOTS], ensure_ascii=False
                ),
                "raw_files_total": str(raw_files),
                "indexed_files_total": str(indexed_files),
                "privacy_excluded_files": str(privacy_files),
                "system_excluded_files": str(system_files),
                "raw_bytes_total": str(raw_bytes),
                "indexed_bytes_total": str(indexed_bytes),
                "unique_filenames_casefold": str(
                    len({row[3] for row in rows})
                ),
                "unique_extensions": str(len({row[6] for row in rows})),
                "sha256_status": "not_computed_optional",
                "fts_tokenizer": "trigram",
                "privacy_directory_names": json.dumps(
                    list(PRIVACY_DIRECTORY_NAMES), ensure_ascii=False
                ),
                "system_directory_names": json.dumps(
                    list(SYSTEM_DIRECTORY_NAMES), ensure_ascii=False
                ),
                "tags_values": json.dumps(TAG_VALUES, ensure_ascii=False),
                "build_elapsed_seconds": str(elapsed),
                "by_root": json.dumps(by_root, ensure_ascii=False),
            }
            connection.executemany(
                "INSERT INTO metadata(key, value) VALUES (?, ?)",
                metadata.items(),
            )

        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
        file_count = connection.execute("SELECT count(*) FROM files").fetchone()[0]
        fts_count = connection.execute(
            "SELECT count(*) FROM files_fts"
        ).fetchone()[0]
        database_bytes = connection.execute(
            "SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()"
        ).fetchone()[0]
        tag_counts = dict(
            connection.execute(
                "SELECT tags, COUNT(*) FROM files GROUP BY tags ORDER BY COUNT(*) DESC"
            ).fetchall()
        )
        if integrity != "ok":
            raise RuntimeError(f"SQLite integrity_check failed: {integrity}")
        if file_count != indexed_files or fts_count != indexed_files:
            raise RuntimeError(
                "row count mismatch: "
                f"files={file_count}, fts={fts_count}, expected={indexed_files}"
            )
    except Exception:
        connection.close()
        raise
    connection.close()

    os.replace(temporary_database, DATABASE_PATH)
    write_exclusion_manifests(exclusions)
    receipt = {
        "status": "DONE",
        "database": str(DATABASE_PATH),
        "raw_files_total": raw_files,
        "indexed_files_total": indexed_files,
        "privacy_excluded_files": privacy_files,
        "system_excluded_files": system_files,
        "coverage_percent": round(indexed_files / raw_files * 100, 4)
        if raw_files
        else 0.0,
        "eligible_coverage_percent": 100.0,
        "bytes": {
            "raw": raw_bytes,
            "indexed": indexed_bytes,
            "indexed_gib": round(indexed_bytes / 1024**3, 3),
        },
        "by_root": by_root,
        "exclusions": {
            "privacy_directory_count": sum(
                row["category"] == "privacy" for row in exclusions
            ),
            "system_directory_count": sum(
                row["category"] == "system" for row in exclusions
            ),
            "privacy_manifest": str(PRIVACY_JSON_PATH),
        },
        "database_bytes": database_bytes,
        "file_fts_rows": fts_count,
        "integrity_check": integrity,
        "tag_counts": tag_counts,
        "sha256_status": "not_computed_optional",
        "elapsed_seconds": round(time.perf_counter() - started, 3),
    }
    BUILD_RECEIPT_PATH.write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
