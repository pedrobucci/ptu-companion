# Handoff — PTU Forms runtime requirements 6

## Branch / PR

- Repository: `pedrobucci/ptu-companion`
- Working branch: `content/ptu-parametrized-forms-catalog`
- Draft PR: `#11` (`docs: audit PTU Mega, Primal and alternate Forms`)
- Base: `feature/pokemon-shiny-d`
- Runtime integration checkpoint: `5f5edc4e13cf40334ecc508a427974fcf830e3e1`
- Latest validated implementation checkpoint before this handoff: `6bf89b5003473555b7114204dbd52272cfec0c60`
- Do not merge or release without explicit owner approval.

## Purpose of this pass

Replace review-only `manual` gates with structured Stage B requirements where the supplied PTU sources define the relevant eligibility/state exactly.

This pass deliberately does **not** attempt to unlock any of the ten source-insufficient families and does **not** mutate bundled/default `.ptucp` packs.

## Source mechanics represented

### Wishiwashi — Schooling

Supplied SuMo rules define Schooling as a Daily Free Action that changes Wishiwashi to Schooling Forme, grants Temporary HP equal to half its maximum HP, prevents other Temporary HP while Schooling, and returns to Solo when below half maximum HP and no Temporary HP remain.

Runtime representation:

- general requirement: Ability `Schooling`;
- persistence condition: active Schooling is invalid only when both `HP < 50%` and `Temporary HP <= 0`;
- action frequency remains source metadata; choosing `activeFormId=schooling` is still the explicit transformation request.

### Minior — Shields Down

Supplied SuMo rules define Meteor/Core as same-HP Base Stat sets. Meteor changes to Core at half maximum HP or lower. Core returns to Meteor outside combat if above half maximum HP.

Runtime representation:

- general requirement: Ability `Shields Down`;
- activation requirement: `HP <= 50%`;
- persistence requirement: `in combat OR HP <= 50%`.

This distinction matters: healing above half HP during combat does not incorrectly force an immediate return to Meteor, while resolving the same state outside combat does.

### Eiscue — Ice Face

Supplied rules say Eiscue is Ice Face only while it has Temporary HP specifically granted by Ice Face; otherwise it is Noice Face.

Runtime representation:

- general requirement: Ability `Ice Face`;
- Noice Face requires tracked `ice-face` Temporary HP provenance to be exhausted (`<= 0`).

The resolver intentionally does **not** treat generic total Temporary HP as Ice Face Temporary HP. If provenance is not tracked, the source-specific requirement is unmet rather than guessed.

### Meloetta — Relic Song

Supplied Core 1.05 Relic Song says the switch between Aria and Step is available as long as Meloetta knows Relic Song; using Relic Song permits a Swift switch, otherwise the switch is a Standard Action.

Runtime representation:

- Step Forme requires known Move `Relic Song`;
- action cost remains source metadata / caller responsibility; Stage B validates eligibility without pretending to spend an action.

### Zygarde — Power Construct

Supplied SuMo rules allow Power Construct only below 50% HP and change the user to Complete Forme until end of Scene. Existing mixed builders already preserve prior 10%/50% HP by applying only non-HP Complete deltas.

Runtime representation:

- general requirement: Ability `Power Construct`;
- activation requirement: `HP < 50%`;
- `complete-from-10-percent` is compatible only with base `10-percent`;
- `complete-from-50-percent` is compatible only with base `50-percent`.

Automatic end-of-Scene clearing is still not invented. The duration remains explicit source metadata until a scene-lifecycle state primitive exists.

### Zacian / Zamazenta — Weapon Bond

Supplied Weapon Bond defines an Extended Action using Ancestral Sword/Shield to enter Crowned Forme, grants Behemoth Blade/Bash, and lasts until Fainted or voluntarily relinquished as an Extended Action.

Runtime representation:

- general requirement: Capability `Weapon Bond`;
- activation trigger item: `Ancestral Sword` for Zacian, `Ancestral Shield` for Zamazenta;
- Crowned forms remain compatible only with `hero-of-many-battles`;
- the trigger item is required for entry, not continuously for persistence, matching the supplied duration wording.

## Shared runtime requirement model v2

`PTU_Companion_Windows_Source/rules/pokemon-forms.mjs` and `PTU_Companion_Android_Tauri/www/rules/pokemon-forms.mjs` remain byte-identical.

New requirement primitives:

- `hp_fraction_lte`
- `hp_fraction_lt`
- `hp_fraction_gte`
- `hp_fraction_gt`
- `temp_hp_lte`
- `temp_hp_gt`
- `temp_hp_source_lte`
- `temp_hp_source_gt`
- `known_move`
- `in_combat`
- `trigger_item`

Existing Ability/Capability checks now also resolve against the effective Species layer rather than relying only on stored Pokémon detail arrays.

Normalized Forms now also support:

- `activationRequirements` / `activation_requirements`;
- `persistenceRequirements` / `persistence_requirements`;
- `compatibleBaseForms` / `compatible_base_forms`.

The active resolver uses the Pokémon's previous `activeFormId` to select activation vs persistence checks. Base/active compatibility is enforced centrally before applying the active overlay. GM Override continues to permit an otherwise-unmet Form while preserving explicit warnings.

## Runtime context additions

Windows `server.mjs` and Android `mobile-api.mjs` now expose the same Form requirement context:

- current HP;
- maximum HP;
- total Temporary HP;
- Temporary HP by source (`tempHpBySource` / persisted `formTempHpBySource` when available);
- in-combat state;
- known Moves;
- transformation trigger item;
- selected/stored Abilities;
- previous base/active Form state.

No save-schema migration was introduced. `POKEMON_FORM_SCHEMA_VERSION` remains `1`; this pass extends requirement semantics, not the persisted Form-state shape.

## Stage B generated catalog

Catalog schema is now **6** with `requirement_model_version: 2`.

Counts remain unchanged:

- 48 candidate-family entries;
- 32 generic record-backed family entries;
- 16 source-specific family entries;
- 82 candidate/derived Forms;
- 37 generic record-backed Forms;
- 45 source-specific Forms;
- 21 not directly materialized;
- 50 synthetic transforms = 48 Mega + 2 Primal;
- 0 synthetic Ultra Burst transforms;
- one composed Necrozma Ultra Burst active overlay from two source blocks.

Exactly **8 Forms** were upgraded from review-only manual eligibility gates to structured source requirements:

1. Wishiwashi Schooling;
2. Minior Core;
3. Eiscue Noice Face;
4. Meloetta Step Forme;
5. Zygarde Complete from 10%;
6. Zygarde Complete from 50%;
7. Zacian Crowned Sword;
8. Zamazenta Crowned Shield.

`docs/PTU_FORMS_STAGE_B.md` and JSON version these semantics.

## Scripts / tests

Added:

- `PTU_Companion_Windows_Source/scripts/apply_stage_b_form_requirements_v2.py`
- `PTU_Companion_Windows_Source/scripts/augment_ptu_runtime_requirements.py`
- `PTU_Companion_Windows_Source/scripts/verify_stage_b_form_requirements_v2.mjs`
- `.github/workflows/stage-b-form-requirements-v2.yml`

Updated:

- `PTU_Companion_Windows_Source/scripts/validate_ptu_mixed_forms.py`
- `.github/workflows/inspect-ptu-mixed-forms.yml`

The requirement overlay and mixed pipeline are idempotent: a catalog that is already mixed/schema-v6 is validated/re-overlaid rather than requiring the old two synthetic Ultra Burst entries to be recreated.

## Validation

### Requirement model v2

GitHub Actions:

- run `36288580783`
- job `108534068188`
- conclusion: **success**

Passed:

- shared Windows/Android runtime patch;
- deterministic Stage B requirement overlay;
- requirement-v2 focused regression tests;
- full Windows `npm run verify`;
- full Android `npm run verify`;
- no `.ptucp` diff;
- `git diff --check`;
- runtime integration commit `5f5edc4e13cf40334ecc508a427974fcf830e3e1`.

### Mixed regeneration compatibility

An intermediate run (`36288633929`) exposed a CI-only idempotency problem: the old mixed augmenter expected exactly two pre-existing synthetic Ultra Burst entries even when the catalog was already composed. No runtime/default-pack regression occurred.

The workflow was corrected to detect whether mixed composition is already present, and the final validation passed:

- run `36288797340`
- job `108534689665`
- conclusion: **success**

It validates the mixed catalog, reapplies requirement model v2, reruns the focused verifier, checks catalog invariants, and confirms no `.ptucp` mutation.

## Deferred gate unchanged

The exact ten deferred families remain:

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

The new runtime primitives must **not** be used to fabricate the missing species-specific transition rules for these families. Their default-pack gate remains closed.

## Remaining manual gates / next useful pass

Structured requirements do not mean every transformation lifecycle is now automatic. Important remaining cases:

- Aegislash Stance Change: exact move/event triggers are source-defined, but the current model does not yet consume move events automatically;
- Darmanitan regular Zen Mode: supplied Core and February 2016 activation semantics conflict, so its manual review gate must remain until a source policy is explicitly chosen;
- Necrozma Ultra Burst: transformation effects are explicit but activation is still source-insufficient, so its manual gate must remain;
- Mega/Primal forms: review gates remain where source activation/equipment/action context is not yet represented losslessly.

A useful next pass is to introduce explicit **form transition events/lifecycle state** (scene expiration, move-use trigger, battle-start hook, faint/relinquish transitions, and source-specific Temporary HP grants) so source-defined effects such as Stance Change, Ice Face restoration, Power Construct scene expiry, Schooling activation, and Weapon Bond relinquish can update `activeFormId` automatically instead of only validating a requested state.
