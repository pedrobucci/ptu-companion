# Fakemon 1 leva — Content Pack v2.0.0

This document records the default campaign content generated from the **Fakemon 1 leva** material and bundled with PTU Companion for Windows and Android.

## Pack identity

- Pack ID: `campaign-homebrew-fakemon-1-leva`
- Version: `2.0.0`
- Priority: `180`
- Source ID: `fakemon-1-leva`
- Default Ruleset: `all-provided-material`

## Definitions

The v2 pack contains:

- 13 Species
- 8 Moves
- 3 Abilities
- 7 evolution families
- 9 evolution edges
- 13 offline Species portraits

### Species

- Panthore
- Panzeus
- Clefable W.
- Clefable K.
- Greavard
- Houndstone
- Maschiff
- Mabosstiff
- Fidough
- Dachsbun
- Hisuian Zorua (`zorua-hisui`)
- Hisuian Zoroark (`zoroark-hisui`)
- Urania

Greavard, Houndstone, Maschiff, Mabosstiff, Fidough and Dachsbun intentionally use the campaign definitions supplied by this pack when it has priority in the active Ruleset. Hisuian Zorua and Hisuian Zoroark use independent logical IDs and do not overwrite the normal forms.

Panzeus begins its level-up list with both **Scratch at Level 4** and **Growl at Level 4**, matching the campaign correction adopted for v2.

### Moves

- Poltergeist
- Last Respects
- Comeuppance
- Alluring Voice
- Snowscape
- Burning Jealousy
- Skitter Smack
- Silk Trap

### Abilities

- Guard Dog
- Well-Baked Body
- Néctar Queen

## Normalization

Source spelling and formatting errors are normalized to the application's definition conventions without intentionally changing the supplied campaign mechanics. Examples include `Stakeout`, `Eerie Impulse`, `Destiny Bond`, `Fake Tears`, `Forest`, and the regional-form naming for Hisuian Zorua/Zoroark.

## Artwork

All 13 Species definitions carry offline portraits. The `.ptucp` stores them under `assets/species/*.webp`, and the Windows default databases embed the portrait as `portrait_data_url`.

Android also receives a generated runtime overlay in `PTU_Companion_Android_Tauri/www/fakemon-v2-data.js`. It is loaded after `mobile-data.js` and before `mobile-runtime.js`, replacing stale definitions from the same pack ID and making v2 content available as bundled/default content without requiring a manual pack import.

## Regeneration

The source-of-truth generation scripts are:

- `scripts/add_fakemon_1_leva.mjs`
- `scripts/extract_fakemon_1_leva_art.py`
- `scripts/build_fakemon_1_leva_pack.py`
- `scripts/build_fakemon_1_leva_mobile_bundle.py`
- `scripts/verify_fakemon_1_leva_v2.mjs`

The repository workflow `.github/workflows/regenerate-fakemon-v2.yml` regenerates the three default SQLite databases, both bundled `.ptucp` archives, the Android runtime overlay and artwork, then runs Windows and Android regression verification before committing generated outputs.

## Validation

The v2 verifier checks, among other things:

- pack version and definition counts;
- Panzeus Level 4 move correction;
- Pokédex numbers for the six official Species overlays;
- independent Hisuian logical IDs and regional metadata;
- the eight new Moves and three new Abilities;
- typo normalization;
- all 13 offline portraits;
- the generated `.ptucp` contents.

Android has an additional runtime verifier that executes the embedded mobile data plus the v2 overlay and confirms the resolved `all-provided-material` definitions point to the v2 records.
