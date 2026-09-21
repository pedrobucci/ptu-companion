#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import time
import urllib.request
import zipfile
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "seed" / "content-packs" / "campaign-homebrew-fakemon-1-leva" / "assets" / "species"
OLD_PACK = ROOT / "bundled-packs" / "campaign-homebrew-fakemon-1-leva-1.1.0.ptucp"
ART_SOURCE = ROOT / "docs" / "source" / "Fakemon_1_leva_art"

# These four already have the exact campaign artwork in the previous bundled pack.
LEGACY_CAMPAIGN_ART = (
    "panthore",
    "panzeus",
    "clefable-w",
    "clefable-k",
)

# These are official Pokemon/forms. Their artwork is materialized from PokeAPI's
# official-artwork entry during generation, so the final pack remains offline.
OFFICIAL_ART = (
    "greavard",
    "houndstone",
    "maschiff",
    "mabosstiff",
    "fidough",
    "dachsbun",
    "zorua-hisui",
    "zoroark-hisui",
)

ALL_SPECIES = (*LEGACY_CAMPAIGN_ART, *OFFICIAL_ART, "urania")
USER_AGENT = "PTU-Companion-Fakemon-v2/2.0 (+https://github.com/pedrobucci/ptu-companion)"


def request_bytes(url: str, *, attempts: int = 3) -> bytes:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=45) as response:
                return response.read()
        except Exception as exc:  # pragma: no cover - network retry path
            last_error = exc
            if attempt < attempts:
                time.sleep(attempt * 2)
    raise RuntimeError(f"Unable to download {url}: {last_error}")


def write_webp(raw: bytes, logical_id: str) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    with Image.open(BytesIO(raw)) as source:
        source.load()
        mode = "RGBA" if "A" in source.getbands() else "RGB"
        image = source.convert(mode)
        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        target = OUT / f"{logical_id}.webp"
        image.save(target, "WEBP", quality=90, method=6)
    print(f"artwork: {logical_id} -> {target.relative_to(ROOT)} ({target.stat().st_size} bytes)")
    return target


def materialize_legacy_campaign_art() -> None:
    if not OLD_PACK.exists():
        raise RuntimeError(f"Missing previous pack used as artwork source: {OLD_PACK}")
    with zipfile.ZipFile(OLD_PACK) as archive:
        names = archive.namelist()
        for logical_id in LEGACY_CAMPAIGN_ART:
            prefix = f"assets/species/{logical_id}."
            candidates = [
                name for name in names
                if name.lower().startswith(prefix) and name.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
            ]
            if not candidates:
                raise RuntimeError(f"Previous pack has no artwork for {logical_id}")
            write_webp(archive.read(candidates[0]), logical_id)


def materialize_official_art() -> None:
    for logical_id in OFFICIAL_ART:
        api_url = f"https://pokeapi.co/api/v2/pokemon/{logical_id}"
        record = json.loads(request_bytes(api_url).decode("utf-8"))
        sprites = record.get("sprites") or {}
        official = ((sprites.get("other") or {}).get("official-artwork") or {}).get("front_default")
        image_url = official or sprites.get("front_default")
        if not image_url:
            raise RuntimeError(f"PokeAPI returned no artwork for {logical_id}")
        write_webp(request_bytes(image_url), logical_id)


def materialize_urania() -> None:
    parts = sorted(ART_SOURCE.glob("urania.webp.b64.part*"))
    if len(parts) != 4:
        raise RuntimeError(f"Expected four Urania artwork source parts, found {len(parts)}")
    encoded = "".join(part.read_text(encoding="ascii").strip() for part in parts)
    try:
        raw = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise RuntimeError(f"Invalid embedded Urania artwork source: {exc}") from exc
    write_webp(raw, "urania")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    materialize_legacy_campaign_art()
    materialize_official_art()
    materialize_urania()

    missing = [logical_id for logical_id in ALL_SPECIES if not (OUT / f"{logical_id}.webp").exists()]
    if missing:
        raise RuntimeError(f"Artwork materialization incomplete: {', '.join(missing)}")
    print(f"Materialized {len(ALL_SPECIES)} species artwork files.")


if __name__ == "__main__":
    main()
