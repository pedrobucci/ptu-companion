# Handoff — PTU Forms rule-defined builders pass 1

## Repository state

- Repository: `pedrobucci/ptu-companion`
- Branch: `content/ptu-parametrized-forms-catalog`
- Draft PR: `#11`
- Validated implementation checkpoint: `3d44f12e825458d107edaf9c9b5fca35b838dbfa`
- GitHub Actions: `36275836054` — **success**
- Job: `108498288713`
- PR remains Draft/Open.
- No merge and no Release were performed.
- Bundled/default `.ptucp` packs remain unchanged.

## What changed in this pass

### 1. Third source pass over the ten deferred families

A targeted supplied-source review was recorded in:

- `docs/PTU_FORMS_DEFERRED_SOURCE_REVIEW_3.md`
- `docs/data/PTU_FORMS_DEFERRED_SOURCE_REVIEW_3.json`

All ten families remain deferred:

- Deoxys
- Giratina
- Hoopa
- Kyurem
- Landorus
- Oricorio
- Rotom
- Shaymin
- Thundurus
- Tornadus

The supplied material proves that their alternate records/states exist, but still does not define the missing activation/switching/duration semantics safely enough for automatic Stage B materialization.

Rotom is the most mechanically complete deferred family: Gen 8ish supplies Normal + five Appliance parameter blocks and February 2016 `Poltergeist` supplies the form-specific Ability / level-40 Move mapping. It remains deferred only because the appliance-change action/requirement itself was not found in the supplied PTU sources.

No main-series item or switching rule was imported to fill any of these gaps.

### 2. Seasonal correction

The previous supplemental audit overclaimed `Seasonal` as a persistent form with an Extended Action change.

The supplied February 2016 Playtest rule actually states only that `Seasonal` is Static and grants an Ability based on the current season:

- Spring → Run Away
- Summer → Grass Pelt
- Autumn → Rivalry
- Winter → Thick Fat

Therefore Deerling and Sawsbuck were corrected from:

- `persistent_form -> baseFormId`

to:

- `runtime_state -> runtime_resolver`

No persistent/manual season selector is generated.

Current family-classification counts are now:

- 34 permanent/base
- 2 persistent-form
- 5 transformation
- 6 runtime-state
- 5 mixed base + transformation
- 10 deferred/source-insufficient
- 5 false positives

Total scope remains **104 candidate records / 67 candidate families**.

### 3. Source-backed supplemental rules hardened

`docs/data/PTU_FORM_SUPPLEMENTAL_RULES.json` is now schema version 2 and contains 17 explicit rule records.

Added/strengthened source entries for:

- Aegislash / Stance Change — PTU Core p.331
- Burmy / Quick Cloak — PTU Core p.327
- Furfrou / Fabulous Trim — PTU Core p.317
- Basculin Red/Blue Ability parameter — Gen 8ish p.764
- Deerling/Sawsbuck / Seasonal — corrected to runtime-state semantics from February 2016 p.13

The Markdown companion was updated to match.

### 4. First lossless rule-defined Stage B builders

`PTU_Companion_Windows_Source/scripts/generate_ptu_stage_b_forms.py` now reads the bundled Gen 8ish Species NDJSON directly and adds four deterministic builders.

#### Aegislash

- Shield Stance remains the implicit base state.
- Emits `sword-stance` as a Stage B `transformation`.
- Source Base Stats are swapped exactly as Stance Change specifies:
  - Attack ↔ Defense
  - Special Attack ↔ Special Defense
  - HP and Speed unchanged
- The current generic requirement tree cannot express automatic Move-event transitions, so a `manual` condition is retained only as a Stage B review gate; the exact source triggers are versioned in `source_mechanics`.

#### Burmy

Emits three persistent/base selections:

- `plant-cloak` → Bug / Grass
- `sandy-cloak` → Bug / Ground
- `trash-cloak` → Bug / Steel

These Types come directly from Quick Cloak. The generated metadata records the At-Will Standard Action, required nearby material, replacement/destruction rule, and evolution consequence without fabricating any extra mechanical effect.

#### Furfrou

Emits all nine Fabulous Trim hairstyles:

- Star → Celebrate
- Diamond → Defiant
- Heart → Cute Tears
- Pharaoh → Sand Veil
- Kabuki → Inner Focus
- La Reine → Intimidate
- Matron → Friend Guard
- Dandy → Moxie
- Debutante → Confidence

The builder clones the entire source `ability_slots` array and replaces **only** the `Fabulous Trim` slot, preserving slot/category metadata and every unaffected Ability.

#### Basculin

Emits permanent `red` and `blue` forms.

The builder clones the source Ability slots and resolves only the explicitly parameterized Advanced Ability 2:

- Red → Reckless
- Blue → Rock Head

No runtime color-switch rule is added.

## Generated Stage B catalog after this pass

`docs/PTU_FORMS_STAGE_B.md` / JSON now reports:

- **41** candidate-family entries
- **37** record-backed family entries
- **4** rule-defined family entries
- **63** candidate/derived Stage B forms
- **48** record-backed forms
- **15** rule-defined forms
- **26** families intentionally not directly materialized
- **52** synthetic transformations
  - 48 Mega
  - 2 Primal
  - 2 Ultra Burst

Charizard X/Y and Mewtwo X/Y remain separate Mega transformations.

No artwork URL is generated and no `.ptucp` file is written by the generator.

## Validation

GitHub Actions run `36275836054` completed successfully.

The workflow validates, among other invariants:

- 104 candidate records / 67 families;
- exact 10-family deferred set;
- 5 false positives;
- corrected `Seasonal` counts: 2 persistent-form / 6 runtime-state;
- 17 supplemental source rules;
- Aegislash Sword Stance stat swap;
- Burmy Plant/Sandy/Trash Type overrides;
- all 9 Furfrou Ability-slot substitutions;
- Basculin Red/Reckless and Blue/Rock Head substitutions;
- 48 Mega Forms across 46 Species;
- separate Charizard X/Y and Mewtwo X/Y;
- 2 Primals and 2 Ultra Burst blocks;
- no unsafe deferred/runtime/mixed/false-positive family emitted as direct `forms[]`;
- no remote artwork URL in the Stage B catalog;
- no `.ptucp` working-tree mutation;
- `git diff --check`.

## Recommended next pass

Continue in this branch and keep the default-pack gate closed.

The next useful work is to add lossless builders for source-backed families that are still classified but not directly materialized, prioritizing cases where the current supplied rules are already explicit enough to avoid guessing. Good candidates include:

- Wishiwashi / Schooling
- Minior / Shields Down
- Eiscue / Ice Face
- Meloetta / Relic Song
- Wormadam embedded cloak handling review
- Pumpkaboo / Gourgeist embedded size blocks

After that, tackle the `mixed` families (Darmanitan, Necrozma, Zacian, Zamazenta, Zygarde) one at a time because they require both `baseFormId` and `activeFormId` semantics.

Do **not** convert the ten deferred families merely because their alternate stat blocks are available. Do **not** change bundled/default `.ptucp` files until the ambiguity gate is deliberately cleared. Do not merge or publish a Release without owner approval.
