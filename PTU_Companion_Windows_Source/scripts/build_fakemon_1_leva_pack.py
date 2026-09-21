#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, sqlite3, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent
PACK_ID = "campaign-homebrew-fakemon-1-leva"
VERSION = "2.0.0"
SOURCE_ID = "fakemon-1-leva"
DB = ROOT / "seed" / "definitions" / "ptu_seed_v1.0.sqlite3"
ASSETS = ROOT / "seed" / "content-packs" / PACK_ID / "assets" / "species"
WINDOWS_OUT = ROOT / "bundled-packs" / f"{PACK_ID}-{VERSION}.ptucp"
ANDROID_OUT = REPO_ROOT / "PTU_Companion_Android_Tauri" / "bundled-packs" / f"{PACK_ID}-{VERSION}.ptucp"

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def json_bytes(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")

def ndjson_bytes(rows) -> bytes:
    return "".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n" for r in rows).encode("utf-8")

def main():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    defs = list(con.execute(
        "SELECT definition_kind, raw_json FROM definition_versions WHERE content_pack_id=? ORDER BY definition_kind, logical_id",
        (PACK_ID,),
    ))
    by_kind = {}
    for row in defs:
        raw = json.loads(row["raw_json"])
        if row["definition_kind"] == "species":
            asset = ASSETS / f"{raw['logical_id']}.webp"
            if asset.exists():
                raw["portrait_asset_path"] = f"assets/species/{asset.name}"
                raw.pop("portrait_data_url", None)
        by_kind.setdefault(row["definition_kind"], []).append(raw)
    families = [json.loads(r["raw_json"]) for r in con.execute(
        "SELECT raw_json FROM ptu_evolution_families WHERE source_id=? ORDER BY id", (SOURCE_ID,)
    )]
    edges = [json.loads(r["raw_json"]) for r in con.execute(
        "SELECT raw_json FROM ptu_evolution_edges WHERE source_id=? ORDER BY family_id, id", (SOURCE_ID,)
    )]
    con.close()

    if len(by_kind.get("species", [])) != 13:
        raise SystemExit(f"Expected 13 species, got {len(by_kind.get('species', []))}")
    if len(by_kind.get("moves", [])) != 8:
        raise SystemExit(f"Expected 8 moves, got {len(by_kind.get('moves', []))}")
    if len(by_kind.get("abilities", [])) != 3:
        raise SystemExit(f"Expected 3 abilities, got {len(by_kind.get('abilities', []))}")

    entries = {}
    for kind in ("species", "moves", "abilities"):
        entries[f"content/{kind}.ndjson"] = ndjson_bytes(by_kind.get(kind, []))
    entries["content/datasets/ptu_evolution_families.json"] = json_bytes(families)
    entries["content/datasets/ptu_evolution_edges.json"] = json_bytes(edges)
    for asset in sorted(ASSETS.glob("*.webp")):
        entries[f"assets/species/{asset.name}"] = asset.read_bytes()

    files = {}
    for path, payload in entries.items():
        records = None
        if path.endswith(".ndjson"):
            records = sum(1 for line in payload.decode("utf-8").splitlines() if line.strip())
        elif path.endswith(".json") and path.startswith("content/datasets/"):
            records = len(json.loads(payload))
        meta = {"bytes": len(payload), "sha256": sha(payload)}
        if records is not None:
            meta["records"] = records
        files[path] = meta

    manifest = {
        "format": "ptu-content-pack",
        "format_version": 1,
        "id": PACK_ID,
        "name": "Campaign Homebrew — Fakemon 1 leva",
        "version": VERSION,
        "priority": 180,
        "kind": "homebrew_species",
        "source_ids": [SOURCE_ID],
        "description": "Campaign species, official campaign overlays, Hisuian regional forms, new moves and abilities from Fakemon 1 leva.",
        "files": files,
    }
    manifest_payload = json_bytes(manifest)

    for out in (WINDOWS_OUT, ANDROID_OUT):
        out.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            z.writestr("manifest.json", manifest_payload)
            for path, payload in entries.items():
                z.writestr(path, payload)
        digest = sha(out.read_bytes())
        out.with_name(out.stem + "_SHA256.txt").write_text(f"{digest}  {out.name}\n", encoding="utf-8")
        print(f"Wrote {out} ({out.stat().st_size} bytes, sha256={digest})")

if __name__ == "__main__":
    main()
