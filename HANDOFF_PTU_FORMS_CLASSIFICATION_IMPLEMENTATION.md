# Handoff — PTU Forms classification implementation

## Context

- Repository: `pedrobucci/ptu-companion`
- Working branch: `content/ptu-parametrized-forms-catalog`
- Draft PR: `#11` — `docs: audit PTU Mega, Primal and alternate Forms`
- Stacked base: `feature/pokemon-shiny-d`
- Validated generated-catalog checkpoint: `4f76b1c304008b8263b55d1be61a94bf845896b5`
- Validation workflow run: `36258431064` — **success**
- Do **not** use `fix/android-pokedex-artwork-beta20-apk` as an implementation base for this work.
- Do **not** merge or create a release without explicit owner approval.

## What changed in this pass

The classification/audit scope remains the expanded source census rather than regressing to the original first-pass count:

- **104 candidate records**
- **67 candidate families**
- 34 permanent/base families
- 4 persistent-form families
- 5 transformation families
- 4 runtime-state families
- 5 mixed base + transformation families
- **10 deferred/source-insufficient families**
- **5 false-positive families**

### Mimikyu

Mimikyu was reclassified from `defer` to `false_positive` for the generic Forms layer.

The supplied Gen 8ish PokéDex exposes Mimikyu as one Species with Disguise. The supplied `SuMo References` defines Disguise as an Ability reaction: when hit by a damaging Move, the triggering attack instead misses and Mimikyu gains +1 CS in a Stat of its choice. The audited PTU sources do not define Disguised/Busted as separate Form states. Therefore the app must not invent a Stage B `activeFormId` transition for it.

False positives are now:

- `cramorant`
- `mimikyu`
- `nidoran-f`
- `nidoran-m`
- `solosis`

### Remaining deferred families

These remain deliberately blocked from automatic conversion because a PTU-specific switching requirement/duration was not found in the supplied audited material:

- `deoxys`
- `giratina`
- `hoopa`
- `kyurem`
- `landorus`
- `oricorio`
- `rotom`
- `shaymin`
- `thundurus`
- `tornadus`

No main-series rule was substituted for missing PTU mechanics.

## Mega / Primal / Ultra Burst

The synthetic transformation inventory remains complete and guarded by tests:

- **48 Mega Evolutions across 46 Species**
- **2 Primal Reversions** — Groudon and Kyogre
- **2 Ultra Burst source blocks** — Necrozma Dusk Mane and Dawn Wings

All are generated as Stage B `mode: "transformation"` entries.

The completeness validator explicitly requires:

- Mega Charizard X + Mega Charizard Y as separate Forms;
- Mega Mewtwo X + Mega Mewtwo Y as separate Forms;
- exactly 48 Mega Forms / 46 Mega Species;
- exactly 2 Primal Forms;
- exactly 2 Ultra Burst transforms.

Missing Mega Stone IDs, Primal/Ultra activation requirements, and other source gaps are not fabricated. Where Stage B needs a requirement but the structured source cannot yet provide a stable generic condition, the generated catalog uses a `manual` requirement as a review gate.

## Local artwork audit

New deterministic script:

- `PTU_Companion_Windows_Source/scripts/audit_ptu_form_assets.py`

Generated artifacts:

- `docs/PTU_FORM_ASSET_AUDIT.md`
- `docs/data/PTU_FORM_ASSET_AUDIT.json`

Current result:

- 1 local creature-art root found: `PTU_Companion_Android_Tauri/www/creatures`
- 9 local image files scanned
- 0 safe audited Species/Form filename matches
- 0 normal matches
- 0 form-specific matches
- 0 shiny matches
- 0 explicit artwork/image references in the transformation inventory

The audit never constructs a remote URL or guesses a local filename. Missing artwork remains unset so the existing Stage B fallback remains authoritative.

## Deterministic Stage B catalog

New generator:

- `PTU_Companion_Windows_Source/scripts/generate_ptu_stage_b_forms.py`

Generated artifacts:

- `docs/PTU_FORMS_STAGE_B.md`
- `docs/data/PTU_FORMS_STAGE_B.json`

Current generated catalog:

- 37 candidate-family entries with directly materializable source records
- 48 candidate-record Stage B Forms
- **52 synthetic transformations** = 48 Mega + 2 Primal + 2 Ultra Burst
- 30 families intentionally not directly materialized

The generated `forms[]` objects use only Stage B modes `permanent` and `transformation`. Candidate records currently emit source-backed Type/Base Stats overrides. Ability/capability snapshots are retained as adjacent versioned metadata instead of being guessed into definition-layer objects.

For Mega/Primal/Ultra, stat/type effects are emitted when explicitly parsed. Added Ability and special extra effects remain source metadata until a lossless Stage B ability/capability mapping is implemented.

This is deliberately a **conversion catalog only**. It does not write to any `.ptucp` file.

## Completeness validator

New validator:

- `PTU_Companion_Windows_Source/scripts/validate_ptu_forms_catalog.py`

It fails if any of these invariants drift:

- 104 candidate records / 67 families;
- 10 deferred / 5 false positives;
- exact deferred-family set;
- Mimikyu must remain `false_positive` unless new supplied PTU evidence is introduced;
- 48 Megas / 46 Mega Species;
- Charizard X/Y and Mewtwo X/Y remain distinct;
- 2 Primals and 2 Ultra Burst transforms;
- unsafe classifications (`defer`, `false_positive`, `runtime_state`, `mixed`) may not be emitted as direct candidate Forms;
- synthetic transforms must use `mode: transformation`;
- no remote `http://` or `https://` artwork is embedded in the generated Stage B catalog.

## GitHub Actions

`.github/workflows/inspect-ptu-form-candidates.yml` now runs, in order:

1. existing source/inventory/discovery/mechanics audits;
2. family classification;
3. local asset audit;
4. deterministic Stage B catalog generation;
5. catalog completeness validation;
6. generated-artifact checks;
7. `.ptucp` working-tree diff guard;
8. `git diff --check`;
9. generated documentation commit with `[skip ci]`.

Validation run `36258431064` completed successfully and produced checkpoint commit `4f76b1c304008b8263b55d1be61a94bf845896b5` (`docs(content): refresh PTU forms catalog [skip ci]`).

## Default packs / releases

No bundled/default `.ptucp` pack was modified in this pass.

The workflow now has an explicit `git diff --exit-code -- '*.ptucp'` guard during generation/validation.

No merge was performed. No release was created. PR #11 remains Draft/Open.

## Important limitation before pack conversion

The generated Stage B catalog is intentionally conservative and is **not yet equivalent to a final default-pack migration**.

Two blockers remain:

1. the 10 deferred families still need source-backed PTU switching semantics;
2. rule-defined one-record families and source Ability/Capability effects need lossless definition-layer builders before their mechanics can be written into default `forms[]` without dropping information or inventing schema data.

Examples intentionally not directly materialized yet include Aegislash, Basculin, Burmy, Deerling, Furfrou and Sawsbuck, even though their family classification is already known. Their alternate mechanics are source-defined but not represented as independent candidate Species rows suitable for the generic record converter.

## Recommended next step

Continue source review only for the 10 deferred families using the supplied PTU documents. In parallel, add source-specific deterministic builders for already-classified rule-defined families and a lossless Ability/Capability mapping for candidate/synthetic Forms. Keep output in the generated Stage B catalog until the deferred queue is resolved; do not mutate default packs before that gate is explicitly cleared.
