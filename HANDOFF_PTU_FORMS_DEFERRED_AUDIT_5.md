# Handoff — PTU Forms deferred source audit 5

## Branch / PR

- Repository: `pedrobucci/ptu-companion`
- Working branch: `content/ptu-parametrized-forms-catalog`
- Draft PR: `#11` (`docs: audit PTU Mega, Primal and alternate Forms`)
- Base: `feature/pokemon-shiny-d`
- Validated source-audit checkpoint before this handoff: `736d4481654aa292c3ecdda081a1e2e1429a14c6`
- Validation workflow: `Validate PTU Deferred Source Review` run `36285068507`, job `108524138923` — **success**
- Do not merge or release without explicit owner approval.

## Purpose of this pass

Re-audit the ten families still marked `defer` using only the supplied PTU sources. The goal was to determine whether any previously missed PTU transition mechanic was sufficient to move a family out of the ambiguity gate.

Result: **0 families reclassified; all 10 remain deferred**.

Exact set:

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

No bundled/default `.ptucp` was modified.

## Main new source finding — `Forme Change` does not define a universal switch action

The supplied February 2016 Playtest Packet contains the generic `Forme Change` capability. It says a user is capable of changing formes **through a Move, Ability, or other effect**, then establishes multi-form Base Stat handling and the same-total-HP invariant.

This is useful mechanical evidence, but it does not itself specify the action that changes a particular Species. Therefore:

- a Species carrying `Forme Change` is positive evidence that multiple Forms are mechanically supported;
- it is **not** permission to invent an At-Will/manual form selector;
- each family still needs the supplied Move, Ability, item, action, or other effect that actually drives its transition.

This distinction is versioned in `docs/data/PTU_FORMS_DEFERRED_SOURCE_REVIEW_4.json` and regression-checked by CI.

## Family-specific capability-label audit

Exact-text review of the supplied Gen 8ish PokéDex found the previously suspicious family labels only on their Species/Form records, with no separate mechanical definition in that source:

- `Multiform` — Deoxys records;
- `Dragon Fusion` — Kyurem records;
- `Sky Forme` — Shaymin records;
- `Therian Forme` — Tornadus/Thundurus/Landorus records;
- `Nectar Dancer` — Oricorio entry.

These labels therefore remain evidence that a Form family exists, not evidence of a transition action.

## Trigger-name hypothesis audit

Common external Pokémon trigger names were checked as hypotheses against the supplied PTU corpus rather than imported as rules.

No usable supplied PTU switching rule was established for:

- Prison Bottle / Hoopa;
- Reveal Glass / Kami trio;
- Gracidea / Shaymin;
- DNA Splicers / Kyurem;
- a Deoxys Meteorite interaction.

`Game of Throhs` does contain `Griseous Orb`, but the reviewed occurrence is only a reagent in the Kaladanda legendary-alchemy recipe. It does not define Giratina's Altered/Origin transition and therefore cannot unlock Giratina.

## Family decisions

### Deoxys

Positive: four parameter records, `Forme Change`, `Multiform`, and supplied lore that explicitly describes Deoxys as highly adaptive and capable of many forms.

Missing: the supplied Move/Ability/item/effect that selects or changes Normal/Attack/Defense/Speed Formes.

Decision: `defer`.

### Giratina

Positive: Altered/Origin records and Form-related capability labels.

Missing: supplied action, requirement, duration, and reversal. The Griseous Orb occurrence reviewed is unrelated crafting data.

Decision: `defer`.

### Hoopa

Positive: complete Confined/Unbound records with different Types/Base Stats/Abilities and explicit linked-Move substitutions.

Missing: supplied activation/release/duration/reversal for Confined <-> Unbound.

Decision: `defer`.

### Kyurem

Positive: normal, White Fusion, and Black Fusion records; `Dragon Fusion`; `Forme Change`.

Missing: supplied fusion action, target/counterpart requirement, and termination rule.

Decision: `defer`.

### Landorus / Thundurus / Tornadus

Positive: Incarnate/Therian records and `Therian Forme` labels.

Missing: supplied switch action, requirement, and duration.

Decision: all remain `defer`.

### Oricorio

Positive: source Type is written `Special / Flying (see Nectar Dancer)` and the Species carries `Forme Change` + `Nectar Dancer`.

Missing: supplied style/Type mapping and form-change action/requirement.

Decision: `defer`.

### Rotom

Positive: strongest unresolved result data. Gen 8ish explicitly defines Normal plus five Appliance Forms and their Type/size/capability/skill/Move changes; February 2016 `Poltergeist` maps the Form to source-defined Ability and Move effects.

Missing: supplied enter/leave-appliance action, appliance requirement, and frequency. Generic `Forme Change` says some Move/Ability/other effect is required but does not define it.

Decision: `defer`.

### Shaymin

Positive: complete Land/Sky records, `Forme Change`, `Sky Forme`, plus supplied lore.

Missing: supplied trigger/action/requirement/duration/reversion.

Decision: `defer`.

## Versioned artifacts

Added:

- `docs/PTU_FORMS_DEFERRED_SOURCE_REVIEW_4.md`
- `docs/data/PTU_FORMS_DEFERRED_SOURCE_REVIEW_4.json`
- `PTU_Companion_Windows_Source/scripts/validate_ptu_deferred_source_review.py`
- `.github/workflows/validate-ptu-deferred-source-review.yml`

The dedicated workflow is read-only and asserts:

- pass 4 / schema 2;
- exactly 10 reviewed / 0 reclassified / 10 still deferred;
- exact deferred-family set;
- the `Forme Change` non-trigger invariant;
- all ten remain `defer -> none` in classification;
- none of them is emitted in Stage B candidate Forms;
- all ten stay represented in `not_materialized`;
- no `.ptucp` mutation;
- `git diff --check`.

## Counts unchanged

Because no family was unlocked, the classification and Stage B catalog counts remain unchanged from the mixed pass:

Classification:

- 106 candidate records
- 69 candidate families
- 36 permanent/base
- 2 persistent-form
- 5 transformation
- 6 runtime-state
- 5 mixed
- 10 deferred
- 5 false positives

Stage B schema v5:

- 48 candidate-family entries
- 32 generic record-backed family entries
- 16 source-specific family entries
- 82 candidate/derived Forms
- 37 generic record-backed Forms
- 45 source-specific Forms
- 21 not directly materialized
- 50 synthetic transforms = 48 Mega + 2 Primal
- 0 synthetic Ultra Burst; Necrozma has one composed Ultra Burst active overlay

## Recommended next pass

The supplied-source search for the ten deferred families is now substantially exhausted without importing external rules. Keep their gate closed unless another PTU source is supplied.

The next useful implementation pass is to improve the Stage B runtime requirement model for **already source-explicit** Forms, replacing review-only `manual` gates where the existing PTU rule can be represented losslessly. Candidates include:

- current/max HP threshold requirements;
- Temporary HP state requirements;
- known-Move requirements;
- active/base Form compatibility constraints;
- scene/action lifecycle metadata or state flags where exact automatic lifecycle support is not yet possible.

Good first targets are Zygarde Power Construct, Minior Shields Down, Eiscue Ice Face, Wishiwashi Schooling, Meloetta Relic Song, and Weapon Bond. Do not use those runtime primitives to unlock the ten deferred families unless their missing source transition mechanics are actually found.
