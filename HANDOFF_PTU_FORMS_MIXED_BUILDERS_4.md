# Handoff — PTU Forms mixed builders 4

## Branch / PR

- Repository: `pedrobucci/ptu-companion`
- Working branch: `content/ptu-parametrized-forms-catalog`
- Draft PR: `#11` (`docs: audit PTU Mega, Primal and alternate Forms`)
- Base: `feature/pokemon-shiny-d`
- Validated generated-artifact checkpoint: `d7b6a8bae84b9b313ff798ad485a0f7414146650`
- Validation workflow: GitHub Actions `Inspect PTU Mixed Forms` run `36284301917`, job `108522004261` — **success**
- Do not merge or release without explicit owner approval.

## What this pass added

This pass materialized the five source-classified `mixed` families into the deterministic Stage B catalog while preserving the ambiguity gate for the ten deferred families and leaving bundled/default `.ptucp` packs untouched.

The five mixed families are now explicit `baseFormId + activeFormId` compositions:

- Darmanitan
- Necrozma
- Zacian
- Zamazenta
- Zygarde

`augment_ptu_mixed_stage_b.py` reads the bundled Gen 8ish Species rows plus the already-versioned supplied-source classification and emits source-specific builders after the permanent-form catalog pass. `validate_ptu_mixed_forms.py` regression-locks the composition and source invariants.

## Darmanitan

Builder: `mixed_darmanitan_standard_zen`

Base layer:

- `standard-mode` — source record `darmanitan-standard-mode` (Gen 8ish p.419)
- `galar-standard-mode` — source record `darmanitan-galar-standard-mode` (Gen 8ish p.808)

Active layer:

- `zen-mode` — source record `darmanitan-zen-mode` (p.420), compatible only with `standard-mode`
- `galar-zen-mode` — source record `darmanitan-galar-zen-mode` (p.809), compatible only with `galar-standard-mode`

All four copy the complete supported structured source mechanics: Type, Base Stats, Ability slots, Capabilities, Skills and Move lists.

The supplied regular Zen Mode sources conflict on activation semantics, so automation is deliberately not invented:

- PTU Core 1.05 defines the HP-gated Free Action form change, reverse change at 50%+, and once-per-Scene switching.
- February 2016 Playtest defines Zen Mode as a Scene Swift Action lasting the rest of the Scene and grants access to Flamethrower/Psychic.

Both are preserved in `source_mechanics` with `activation_status: conflicting_supplied_activation_rules_preserved_for_review`. The active Form has only a `manual` review gate.

Galarian `Zen Snowed` is source-explicit in New Abilities and Moves: Scene Swift Action, Zen Mode for the rest of the Scene, with Ice Punch/Fire Punch access. Those effects are preserved in metadata; the manual gate is not treated as the PTU rule.

## Necrozma

Builder: `mixed_necrozma_fusion_ultra_burst`

Base layer:

- `dusk-mane` — full source record p.945
- `dawn-wings` — full source record p.946

Viral Fusion from supplied SuMo References remains the persistent base-layer rule. It bonds Necrozma to a willing/helpless Pokemon by Extended Action; Solgaleo and Lunala use the specific Dusk Mane/Dawn Wings states and their source signature moves.

Active layer:

- one shared `ultra-burst` overlay, compatible with both Dusk Mane and Dawn Wings.

The two supplied Ultra Burst blocks have different stat deltas but converge to the same final PTU Base Stats and Type:

- HP 10 / Atk 17 / Def 10 / SpA 17 / SpD 10 / Spe 13
- Psychic / Dragon

The source also explicitly says Neuroforce, Advanced Ability 1 becomes Illuminate, and gains Glow. Those effects are retained in `source_mechanics`; Ability/Capability slot structures are not guessed where the source does not fully define a Stage B-compatible slot replacement.

The previous two synthetic Ultra Burst entries were removed from `synthetic_transform_species`. This avoids duplicate Ultra Burst semantics. Catalog summary now records 0 synthetic Ultra Burst transforms, 2 source blocks, and 1 composed Necrozma Ultra Burst active overlay.

Ultra Burst activation remains source-insufficient in the supplied project material, so its Stage B manual requirement remains review-only.

## Zacian / Zamazenta

Builder: `mixed_weapon_bond`

Zacian:

- base `hero-of-many-battles` from p.963
- active `crowned-sword` from p.964
- Weapon Bond source item: Ancestral Sword
- source-granted Move: Behemoth Blade

Zamazenta:

- base `hero-of-many-battles` from p.965
- active `crowned-shield` from p.966
- Weapon Bond source item: Ancestral Shield
- source-granted Move: Behemoth Bash

The supplied Weapon Bond rule is preserved exactly in metadata: Extended Action with the named ancestral weapon; Crowned Form lasts until Fainted or voluntarily relinquished as an Extended Action. The Stage B manual condition is only a review gate rather than a replacement for that action/duration rule.

Both Hero and Crowned records copy all supported structured mechanics from the supplied Species rows.

## Zygarde

Builder: `mixed_zygarde_cells_power_construct`

Persistent base layer:

- `10-percent` from Gen 8ish p.927
- `50-percent` from p.928

SuMo `Zygarde Cells` is preserved in metadata: the Cube forms 10%/50% states as an Extended Action; a 100-cell Zygarde may have Power Construct instead of Aura Break, cannot be disassembled, and can switch between 10% and 50% using the Cube as an Extended Action.

Active Complete layer uses two contextual overlays with the same display name:

- `complete-from-10-percent`
- `complete-from-50-percent`

This is deliberate. Power Construct says the user keeps the HP total and HP Maximum of the prior 10%/50% Forme. Stage B has no dynamic "preserve prior HP" primitive, so a single full Base Stats replacement would be incorrect. Each Complete overlay therefore copies the non-Base-Stats Complete mechanics from p.929 and applies only non-HP Base Stat deltas:

- from 10%: Def +5, SpA +3, SpD +1, Spe -3
- from 50%: SpA +1, Spe -1

HP is intentionally absent from both deltas.

Power Construct source mechanics remain explicit: Daily Swift Action, only below 50% HP, Complete Forme until end of Scene, Temporary HP equal to half the Complete maximum, no other Temporary HP while Complete, and preservation of the prior Forme HP total/maximum. The generic Stage B requirement tree cannot express this whole rule, so the manual gates remain review-only.

## Current Stage B catalog

Schema version: `5`

- **48** candidate-family entries
- **32** generic record-backed family entries
- **16** rule-defined/source-specific family entries
- **82** candidate/derived Stage B Forms
- **37** generic record-backed Forms
- **45** rule-defined/source-specific Forms
- **21** families not directly materialized
- **50** synthetic transformations: 48 Mega + 2 Primal
- **0** synthetic Ultra Burst transforms
- **1** composed Necrozma Ultra Burst active overlay from 2 source blocks

Charizard Mega X/Y and Mewtwo Mega X/Y remain separate and regression-locked.

## CI / workflow architecture

A dedicated follow-up workflow was added at `.github/workflows/inspect-ptu-mixed-forms.yml`.

It runs:

1. directly when the mixed scripts/workflow change; and
2. after successful completion of `Inspect PTU Form Candidates` through `workflow_run`.

This is intentional because the original catalog workflow still validates/generates the schema-v4 pre-mixed checkpoint. The follow-up workflow deterministically composes the five mixed families, validates schema v5, and commits only `docs/PTU_FORMS_STAGE_B.md` / JSON. Thus any future upstream catalog regeneration is followed by reapplication of the mixed composition instead of silently regressing it.

Run `36284301917` passed:

- mixed materialization;
- mixed validator;
- exact catalog counts;
- Darmanitan base/active compatibility and source-rule conflict preservation;
- Necrozma fusion + single composed Ultra Burst and removal of synthetic duplicates;
- Zacian/Zamazenta Weapon Bond mechanics;
- Zygarde 10%/50% + contextual Complete overlays with no HP replacement;
- 48 Mega + 2 Primal synthetic transforms;
- no remote artwork URLs;
- no `.ptucp` mutation;
- `git diff --check`.

## Safety state

The ambiguity/default-pack gate remains closed.

The exact deferred set is unchanged:

`deoxys`, `giratina`, `hoopa`, `kyurem`, `landorus`, `oricorio`, `rotom`, `shaymin`, `thundurus`, `tornadus`.

Do not materialize those families from known alternate stat blocks alone. Do not mutate default `.ptucp` packs until the source gate is explicitly resolved or the owner changes the policy.

## Recommended next pass

The remaining direct catalog gap is no longer the five mixed families. Next work should focus on one of two tracks:

1. source-review the ten deferred families for any supplied PTU switching rule still missed; or
2. design/implement runtime primitives for event-driven Forms (HP thresholds, scene duration, move/action triggers, temporary-HP state, compatible-base constraints) so manual review gates can be replaced only where the supplied rule is already explicit.

Do not merge or release.
