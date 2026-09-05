#!/usr/bin/env python3
"""T13D1 narrow packaging step.

Adds exactly one new dataset file (content/datasets/trainer_build_rules.json,
built from seed/json/trainer_build_rules.json) into the existing
content_packs/ptu-core-1.05.ptucp archive, and nothing else.

This intentionally does NOT touch scripts/build_final_handoff_v10.py (the
omnibus handoff generator) or rebuild any other record/file in the pack.
Every pre-existing zip entry is copied through byte-for-byte, so every
manifest sha256 already declared for those entries stays valid untouched;
only the new dataset's manifest entry is added. See T13D_TRAINER_BUILD_REPLAN.md
task T13D1's scope ("choose a narrow generator without unrelated rewrites").

Usage: python scripts/pack_trainer_build_rules.py
"""
import hashlib
import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
PACK_PATH = ROOT / "content_packs" / "ptu-core-1.05.ptucp"
DATASET_SOURCE = ROOT / "seed" / "json" / "trainer_build_rules.json"
DATASET_ARCHIVE_PATH = "content/datasets/trainer_build_rules.json"


def main() -> None:
    dataset_obj = json.loads(DATASET_SOURCE.read_text(encoding="utf-8"))
    dataset_bytes = (json.dumps(dataset_obj, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    dataset_sha256 = hashlib.sha256(dataset_bytes).hexdigest()
    # Top level is a JSON object (not an array): one logical record, so
    # record_count is 1 — matches import.rs's `Value::Array(_) => len, _ => 1`.
    dataset_records = 1

    with zipfile.ZipFile(PACK_PATH, "r") as existing:
        names = existing.namelist()
        if DATASET_ARCHIVE_PATH in names:
            raise SystemExit(f"{DATASET_ARCHIVE_PATH} already present in {PACK_PATH.name} — refusing to run twice")
        manifest = json.loads(existing.read("manifest.json"))
        entries = {name: existing.read(name) for name in names if name != "manifest.json"}

    manifest["files"][DATASET_ARCHIVE_PATH] = {
        "sha256": dataset_sha256,
        "bytes": len(dataset_bytes),
        "records": dataset_records,
        "media_type": "application/json",
    }
    manifest.setdefault("content_counts", {})["dataset:trainer_build_rules"] = dataset_records

    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")

    with zipfile.ZipFile(PACK_PATH, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as out:
        out.writestr("manifest.json", manifest_bytes)
        for name, data in entries.items():
            out.writestr(name, data)
        out.writestr(DATASET_ARCHIVE_PATH, dataset_bytes)

    print(f"added {DATASET_ARCHIVE_PATH} ({len(dataset_bytes)} bytes, sha256 {dataset_sha256}) to {PACK_PATH}")
    print(f"pack now has {len(entries) + 2} files (was {len(entries) + 1})")


if __name__ == "__main__":
    main()
