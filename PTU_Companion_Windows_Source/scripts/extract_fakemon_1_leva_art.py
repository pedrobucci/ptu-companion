#!/usr/bin/env python3
from __future__ import annotations
from io import BytesIO
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "docs" / "source" / "Fakemon_1_leva.pdf"
OUT = ROOT / "seed" / "content-packs" / "campaign-homebrew-fakemon-1-leva" / "assets" / "species"
PAGE_SPECIES = [
    "panthore", "panzeus", "clefable-w", "clefable-k", "greavard", "houndstone",
    "maschiff", "mabosstiff", "fidough", "dachsbun", "zorua-hisui", "zoroark-hisui", "urania",
]


def extract_page_image(doc: fitz.Document, page_index: int) -> bytes:
    images = doc[page_index].get_images(full=True)
    if not images:
        raise RuntimeError(f"Page {page_index + 1} contains no embedded image")
    image = max(images, key=lambda row: int(row[2]) * int(row[3]))
    xref, smask = int(image[0]), int(image[1])
    if smask:
        base = fitz.Pixmap(doc, xref)
        mask = fitz.Pixmap(doc, smask)
        pix = fitz.Pixmap(base, mask)
        return pix.tobytes("png")
    return doc.extract_image(xref)["image"]


def main() -> None:
    if not PDF.exists():
        raise SystemExit(f"Missing source PDF: {PDF}")
    OUT.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(PDF)
    if doc.page_count < len(PAGE_SPECIES):
        raise SystemExit(f"Expected at least {len(PAGE_SPECIES)} pages, got {doc.page_count}")
    for page_index, logical_id in enumerate(PAGE_SPECIES):
        raw = extract_page_image(doc, page_index)
        with Image.open(BytesIO(raw)) as source:
            source.load()
            mode = "RGBA" if "A" in source.getbands() else "RGB"
            image = source.convert(mode)
            image.thumbnail((512, 512), Image.Resampling.LANCZOS)
            target = OUT / f"{logical_id}.webp"
            image.save(target, "WEBP", quality=90, method=6)
            print(f"page {page_index + 1:02d}: {logical_id} -> {target.relative_to(ROOT)} ({image.width}x{image.height})")
    doc.close()


if __name__ == "__main__":
    main()
