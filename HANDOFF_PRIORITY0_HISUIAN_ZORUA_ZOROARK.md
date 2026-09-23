# Handoff — Priority 0: Hisuian Zorua / Hisuian Zoroark typing correction

## Checkpoint

This document closes **Priority 0** of `PTU_Companion_Handoff_Forms_Roster_QoL.md` and intentionally stops before Stage A.

- Repository: `pedrobucci/ptu-companion`
- Base branch: `main`
- Base commit used to start this round: `2b43ef7465b7d0f1b4b078be5e94726dd64f4ab1`
- Working branch: `feature/pokemon-forms-roster-qol`
- Validated generated-content commit: `768aef369fae9820fb4c6f3c1c4d4231dc4bb065`
- Merge policy: **do not merge without owner approval**.

## Scope completed

The campaign PDF value `Fairy` is now treated as the approved source typo for the two Hisuian regional definitions.

The corrected definitions are:

```text
zorua-hisui.types    = [Normal, Ghost]
zoroark-hisui.types  = [Normal, Ghost]
```

The canonical species remain independent and are not overlaid by the Fakemon pack:

```text
zorua.types    = [Dark]
zoroark.types  = [Dark]
```

The regional identities remain `zorua-hisui` and `zoroark-hisui`; no canonical species ID was replaced.

## Source-of-truth and generated data changes

### Source definition

`PTU_Companion_Windows_Source/scripts/add_fakemon_1_leva.mjs`

- changed Hisuian Zorua from `Fairy` to `Normal/Ghost`;
- changed Hisuian Zoroark from `Fairy` to `Normal/Ghost`;
- preserved `regional_form: Hisui` and the existing regional IDs;
- added an explicit `data_notes` exception documenting that the source PDF's `Fairy` typing is intentionally corrected by owner approval;
- bumped the bundled Fakemon content pack from `2.0.0` to `2.0.1` so the corrected archive is distinguishable from the already distributed bad revision.

### Default definition databases

Regenerated and cross-checked:

- `PTU_Companion_Windows_Source/seed/definitions/ptu_seed_v1.0.sqlite3`;
- `PTU_Companion_Windows_Source/data/definitions/ptu_definitions.sqlite3`;
- `seed/ptu_seed_v1.0.sqlite3`.

All three report the Fakemon pack as `2.0.1` and store both Hisuian records exactly as `Normal/Ghost`.

### Bundled `.ptucp`

Rebuilt for both platforms:

- `PTU_Companion_Windows_Source/bundled-packs/campaign-homebrew-fakemon-1-leva-2.0.1.ptucp`;
- `PTU_Companion_Android_Tauri/bundled-packs/campaign-homebrew-fakemon-1-leva-2.0.1.ptucp`.

The old platform-bundled `2.0.0` archive/checksum was superseded. Windows and Android are verified against the same corrected logical content and the regression suite checks that their bundled archives are identical.

### Android runtime overlay

Regenerated:

- `PTU_Companion_Android_Tauri/www/fakemon-v2-data.js`.

The Android `all-provided-material` resolved definitions now expose the corrected types for `zorua-hisui` and `zoroark-hisui`.

## Resolution / save behavior

No save-by-save write of `Normal/Ghost` was introduced.

The typing correction is definition-driven: regional Pokémon continue to reference their species definition, so Pokédex/runtime resolution receives the corrected `types` from the active definition. This keeps the change compatible with existing saves instead of copying a correction into every campaign record.

No evidence was found in this scope that a separate persistent Fairy type snapshot must be migrated. The regressions therefore guard the definition, bundled pack and Android resolved runtime rather than mutating individual saves.

Type-dependent UI/mechanics that consume the resolved species types receive `Normal/Ghost` from the corrected definition rather than the old `Fairy` value.

## New regression coverage

### Windows / shared data

Added `PTU_Companion_Windows_Source/scripts/verify_hisuian_zorua_types.mjs` and included it in `npm run verify`.

It fails if:

- either Hisuian record is not exactly `Normal/Ghost` in any default DB;
- either Hisuian record contains `Fairy`;
- either regional definition loses `Hisui` identity;
- the Fakemon pack starts overriding canonical `zorua` or `zoroark`;
- canonical Zorua/Zoroark stop resolving their normal Dark typing;
- either corrected Windows/Android bundled pack contains the wrong type;
- Windows and Android bundled corrected archives diverge.

### Android

Added `PTU_Companion_Android_Tauri/scripts/verify-hisuian-zorua-types.mjs` and included it in Android `npm run verify`.

It checks the actual bundled mobile runtime data and resolved `all-provided-material` mapping, including both top-level and raw species types, the pack source, regional identity, and preservation of canonical Zorua/Zoroark.

### Existing regressions kept in sync

Version-pinned Fakemon tests were updated from pack `2.0.0` to `2.0.1`, including the older pack-image/Trainer-XP regression and Android Fakemon runtime verification.

## Regeneration workflow

`.github/workflows/regenerate-fakemon-v2.yml` was extended so this correction can be regenerated reproducibly on the working feature branch.

The workflow now:

1. refuses direct regeneration on `main`;
2. applies the strict/idempotent source correction helper;
3. regenerates all three definition databases;
4. rebuilds the corrected Windows and Android `.ptucp` files;
5. rebuilds the Android runtime overlay;
6. verifies definition counts, pack version and exact Hisuian typing;
7. verifies canonical Zorua/Zoroark are not overridden;
8. runs the complete Windows regression suite;
9. runs the complete Android regression suite;
10. commits generated artifacts back only to the active feature/content branch.

The helper is `PTU_Companion_Windows_Source/scripts/fix_hisuian_zorua_types.py`.

## Validation results

GitHub Actions run `35761984823` (`Regenerate Fakemon v2 defaults`, run #10) completed successfully.

Validated successfully:

- source correction helper;
- all 3 SQLite definition databases;
- corrected Fakemon pack generation;
- Android Fakemon runtime overlay generation;
- Fakemon definition counts: 13 species, 8 moves, 3 abilities;
- explicit database checks for `Normal/Ghost` and absence of `Fairy`;
- canonical species non-overwrite checks;
- full Windows `npm run verify`;
- full Android `npm run verify`;
- the new Windows/shared Hisuian typing regression;
- the new Android resolved-runtime Hisuian typing regression.

An earlier run (`35761667347`) correctly failed because one legacy verification script still referenced the superseded `2.0.0` archive. That hard-coded version pin was corrected and the full workflow was rerun successfully; this is now covered by the regeneration helper.

## Release status

No application executable release is created at this checkpoint. Priority 0 is a content/data correction inside the still-open development branch and does not bump the Windows or Android application version by itself.

Per the repository release policy, the next executable/testable milestone should publish generated Windows `.exe` and Android `.apk` artifacts through a new GitHub Release, with SHA-256 and non-secret build/signing metadata tied to the exact release commit/tag. Binaries must not be committed to `main`.

## What remains

### Stage A — QoL and corrections

Not started in this checkpoint:

1. Naturewalk with multiple terrains;
2. remove Notifications;
3. delete Trainer;
4. Trainer Notes;
5. Pokémon Notes;
6. edit Roster;
7. delete Roster without deleting Pokémon;
8. Android Roster Pokémon tap -> select + scroll to actions/details, without navigating to Creatures;
9. Move Keyword descriptions/catalog/UI.

### Stage B — Forms foundation

Not started: Form schema, override semantics, add/remove/replace, requirements, permanent/base form, active transformation, central resolver, `.ptucp` support and persistence.

### Stage C — Forms UI

Not started: available Forms, inspection, Activate/Deactivate, requirements and Pokédex Form details.

### Stage D — Shiny

Not started: `is_shiny`, shiny artwork and Form + Shiny resolution.

### Stage E — compatibility/regression

Not started beyond the Priority 0-specific regressions: final SQLite/save/load/export/import/Content Pack/Windows/Android/old-save validation for the new features.

## Exact stop point

**Priority 0 is implemented and validated. Stage A has not been started.**

Continue only after the owner reviews this checkpoint. The next implementation item is **Stage A.1 — Naturewalk with multiple terrains**.
