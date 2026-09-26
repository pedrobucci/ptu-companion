# Handoff — PTU Forms Stage B transformation builders 2

## Branch / PR

- Repository: `pedrobucci/ptu-companion`
- Working branch: `content/ptu-parametrized-forms-catalog`
- Draft PR: `#11` (`docs: audit PTU Mega, Primal and alternate Forms`)
- Base: `feature/pokemon-shiny-d`
- Validated implementation checkpoint before this handoff: `abc044f9ec6121325c77029035db25d016079f35`
- Validation workflow: GitHub Actions run `36277010457`, job `108501616134` — **success**
- Do not merge or release without explicit owner approval.

## What this pass added

`PTU_Companion_Windows_Source/scripts/generate_ptu_stage_b_forms.py` now has source-backed builders for four additional transformation families. These builders read the bundled Gen 8ish Species rows and preserve the supplied PTU transition rules in `source_mechanics` metadata.

The current Stage B requirement tree cannot faithfully encode HP thresholds, Temporary-HP provenance, Move-known/action triggers, or event-driven transitions. For those cases `requirements.manual` is deliberately only a review gate; it is not a replacement rule and must not be interpreted as the canonical PTU trigger.

### Wishiwashi — Schooling

- Implicit base: `WISHIWASHI Solo` (Gen 8ish p.766).
- Active Form: `schooling` / Schooling Forme (Gen 8ish p.767).
- Source rule: SuMo References p.4.
- Schooling is a Daily Free Action, grants Temporary HP equal to half Maximum HP, blocks Temporary HP from other sources while active, and returns to Solo below half Max HP once those Temporary HP are gone.
- Solo and Schooling retain the same HP Base Stat.
- Builder copies every differing supported structured field from Schooling over Solo, including Base Stats, Capabilities and Skills.

### Minior — Shields Down

- Implicit base: `MINIOR Meteor` (Gen 8ish p.752).
- Active Form: `core` / Core Forme (Gen 8ish p.753).
- Source rule: SuMo References p.4.
- At half Maximum HP or lower Meteor changes to Core. Outside combat, above half Maximum HP, it returns to Meteor.
- Meteor and Core retain the same HP Base Stat.
- Builder copies the different Base Stats, Capabilities and Skills.

### Eiscue — Ice Face

- Implicit base: `EISCUE Ice Face` (Gen 8ish p.723).
- Active Form: `noice-face` / Noice Face (Gen 8ish p.724).
- Source rule: New Abilities and Moves p.1.
- Ice Face starts battle with two ticks of Temporary HP. While those source-specific Temporary HP remain, the user is in Ice Face; otherwise it is in Noice Face. In Hail the Temporary HP may be restored as the source-defined Standard Action. The source also grants Hail damage immunity.
- Builder copies the Noice Base Stats and differing Capabilities over the Ice Face base state.

### Meloetta — Relic Song

- Conversion base: `MELOETTA Aria Forme` (Gen 8ish p.922).
- Active Form: `step-forme` / Step Forme (Gen 8ish p.923).
- Source rule: PTU Core 1.05 p.405.
- While Meloetta knows Relic Song it may switch between Aria and Step as a Swift Action when using Relic Song, or as a Standard Action otherwise.
- Aria and Step retain the same HP Stat.
- Builder copies the Step Type, Base Stats, Ability slots and Skills. This preserves the source `Drown Out -> Spinning Dance` Ability-slot change instead of treating the two records as stat-only variants.

## Generator / validator changes

The generated Stage B catalog is now schema version `3`.

Rule-defined builders now cover eight families:

1. Aegislash — Stance Change
2. Basculin — Red/Blue embedded Ability variant
3. Burmy — Quick Cloak
4. Eiscue — Ice Face
5. Furfrou — Fabulous Trim
6. Meloetta — Relic Song
7. Minior — Shields Down
8. Wishiwashi — Schooling

A generic record-pair helper copies every differing supported structured mechanical field from the target source row. Current supported copied fields are Type, Base Stats, Ability slots, Capabilities, Skills, level-up Moves, TM Moves, Tutor Moves and Egg Moves. It intentionally does not invent or synthesize missing mechanics.

`validate_ptu_forms_catalog.py` regression-locks the four new builders, including exact source Base Stats, Meloetta's Type/Ability change, required Capabilities/Skills differences, and the presence of the manual review gate.

## Current deterministic catalog

`docs/PTU_FORMS_STAGE_B.md` / JSON currently report:

- 41 candidate-family entries
- 33 record-backed family entries
- 8 rule-defined family entries
- 59 candidate-record/derived Stage B Forms
- 40 record-backed Forms
- 19 rule-defined Forms
- 26 families intentionally not directly materialized
- 52 synthetic transformations: 48 Mega + 2 Primal + 2 Ultra Burst

Mega Evolution, Primal Reversion and Ultra Burst remain `mode: transformation`. Charizard Mega X/Y and Mewtwo Mega X/Y remain separate and regression-locked.

## CI

GitHub Actions run `36277010457` passed after the workflow assertions were updated to the new catalog counts and new builder names.

The Action also regenerated and committed the deterministic Stage B artifacts as:

- `abc044f9ec6121325c77029035db25d016079f35` — `docs(content): refresh PTU forms catalog [skip ci]`

The workflow still enforces:

- exact classification counts and exact ten-family deferred set;
- five false positives;
- 48 Mega / 46 Species, including Charizard X/Y and Mewtwo X/Y;
- 2 Primal + 2 Ultra Burst transforms;
- no direct materialization of deferred/runtime/mixed/false-positive families;
- no invented remote artwork URLs;
- no `.ptucp` working-tree changes;
- `git diff --check`.

## Ambiguity gate remains closed

The ten deferred families remain unchanged:

`deoxys`, `giratina`, `hoopa`, `kyurem`, `landorus`, `oricorio`, `rotom`, `shaymin`, `thundurus`, `tornadus`.

Do not add them to default packs simply because alternate stat blocks exist. Their switching/activation semantics are still not sufficiently defined by the supplied PTU sources.

No default `.ptucp` pack was modified in this pass.

## Recommended next pass

Keep the default-pack gate closed and continue with source-resolved data that can be modeled losslessly. The next useful audit is the embedded/permanent parameter families, especially Wormadam and the Pumpkaboo/Gourgeist size blocks. Before calling the conversion fully lossless, review whether Stage B should explicitly support structured height/weight/size overrides, because the bundled Species records contain `height`, `height_text`, `weight` and `weight_text` but the current Form override aliases were originally focused on combat mechanics.

After permanent/embedded variants are stabilized, handle the `mixed` families individually: Darmanitan, Necrozma, Zacian, Zamazenta and Zygarde. Those require deliberate `baseFormId` + `activeFormId` composition and should not be bulk-generated.
