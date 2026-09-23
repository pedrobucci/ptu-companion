#!/usr/bin/env python3
"""Apply the owner-approved Hisuian Zorua/Zoroark typing correction.

This migration is intentionally strict and idempotent. It updates the Fakemon v2
source-of-truth entries from the campaign-PDF typo (Fairy) to the canonical
Normal/Ghost typing, bumps the content-pack patch version so an already
installed pack can be distinguished from the corrected archive, and updates
version-pinned verification/build helpers.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent


def replace_or_verify(path: Path, old: str, new: str) -> bool:
    text = path.read_text(encoding="utf-8")
    if old in text:
        path.write_text(text.replace(old, new), encoding="utf-8", newline="\n")
        print(f"updated {path.relative_to(REPO_ROOT)}")
        return True
    if new in text:
        print(f"already correct {path.relative_to(REPO_ROOT)}")
        return False
    raise RuntimeError(
        f"Expected neither old nor corrected text in {path.relative_to(REPO_ROOT)}; "
        "the source format changed and must be reviewed manually."
    )


def main() -> None:
    source = ROOT / "scripts" / "add_fakemon_1_leva.mjs"

    replace_or_verify(
        source,
        "const PACK_VERSION = '2.0.0';",
        "const PACK_VERSION = '2.0.1';",
    )
    replace_or_verify(
        source,
        "id:'zorua-hisui',name:'Hisuian Zorua',page:11,dex:570,variant:'Hisui',types:['Fairy']",
        "id:'zorua-hisui',name:'Hisuian Zorua',page:11,dex:570,variant:'Hisui',types:['Normal','Ghost']",
    )
    replace_or_verify(
        source,
        "id:'zoroark-hisui',name:'Hisuian Zoroark',page:12,dex:571,variant:'Hisui',types:['Fairy']",
        "id:'zoroark-hisui',name:'Hisuian Zoroark',page:12,dex:571,variant:'Hisui',types:['Normal','Ghost']",
    )

    old_note = "data_notes:['Spelling and list-boundary errors were normalized to the project Pokédex conventions; source mechanics were otherwise preserved.']"
    new_note = "data_notes:['Spelling and list-boundary errors were normalized to the project Pokédex conventions.',...(s.id==='zorua-hisui'||s.id==='zoroark-hisui'?['Owner-approved correction: the source PDF Fairy typing is a typo; Hisuian Zorua and Hisuian Zoroark use Normal/Ghost.']:['Source mechanics were otherwise preserved.'])]"
    replace_or_verify(source, old_note, new_note)

    for path in (
        ROOT / "scripts" / "build_fakemon_1_leva_pack.py",
        ROOT / "scripts" / "build_fakemon_1_leva_mobile_bundle.py",
    ):
        replace_or_verify(path, 'VERSION = "2.0.0"', 'VERSION = "2.0.1"')

    replace_or_verify(
        ROOT / "scripts" / "verify_fakemon_1_leva_v2.mjs",
        "`${packId}-2.0.0.ptucp`",
        "`${packId}-2.0.1.ptucp`",
    )
    replace_or_verify(
        ROOT / "scripts" / "verify_fakemon_1_leva_v2.mjs",
        "inspected.manifest.version!=='2.0.0'",
        "inspected.manifest.version!=='2.0.1'",
    )

    # Older regression coverage also opens the bundled Fakemon archive directly;
    # keep its version pin synchronized with the corrected content-pack revision.
    windows_beta9 = ROOT / "scripts" / "verify_beta9_pack_images_trainer_xp.mjs"
    replace_or_verify(
        windows_beta9,
        "campaign-homebrew-fakemon-1-leva-2.0.0.ptucp",
        "campaign-homebrew-fakemon-1-leva-2.0.1.ptucp",
    )
    replace_or_verify(
        windows_beta9,
        "assert.equal(pack.manifest.version,'2.0.0');",
        "assert.equal(pack.manifest.version,'2.0.1');",
    )

    android_verify = REPO_ROOT / "PTU_Companion_Android_Tauri" / "scripts" / "verify-fakemon-v2-runtime.mjs"
    replace_or_verify(android_verify, "assert.equal(pack.version,'2.0.0');", "assert.equal(pack.version,'2.0.1');")
    replace_or_verify(
        android_verify,
        "assert.equal(context.window.__PTU_FAKEMON_V2_BUNDLED_PACK__?.manifest?.version,'2.0.0');",
        "assert.equal(context.window.__PTU_FAKEMON_V2_BUNDLED_PACK__?.manifest?.version,'2.0.1');",
    )

    print("Hisuian typing source correction ready: Normal/Ghost; Fakemon pack version 2.0.1.")


if __name__ == "__main__":
    main()
