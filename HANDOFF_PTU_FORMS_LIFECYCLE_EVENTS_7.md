# Handoff — PTU Forms lifecycle events 7

## Branch / PR

- Repository: `pedrobucci/ptu-companion`
- Working branch: `content/ptu-parametrized-forms-catalog`
- Draft PR: `#11` (`docs: audit PTU Mega, Primal and alternate Forms`)
- Base: `feature/pokemon-shiny-d`
- Validated lifecycle runtime checkpoint: `c35f73e26c3466e4b671ccc1775e8df545fa3ae7`
- Validation workflow: `Stage B Form Lifecycle Events` run `36291122777`, job `108541283946` — **success**
- Do not merge or release without explicit owner approval.

## Purpose of this pass

Add source-explicit Form transition events and lifecycle handling on top of requirement model v2. The event engine updates `activeFormId` in a returned transition state and emits explicit effect directives without silently spending actions, consuming frequencies, mutating campaign state, or inventing unsupported mechanics.

No bundled/default `.ptucp` was modified and the ten deferred families remain blocked.

## Runtime model

Added byte-identical modules:

- `PTU_Companion_Windows_Source/rules/pokemon-form-events.mjs`
- `PTU_Companion_Android_Tauri/www/rules/pokemon-form-events.mjs`

Exports:

- `FORM_EVENT_SCHEMA_VERSION = 1`
- `FORM_LIFECYCLE_MODEL_VERSION = 1`
- `normalizePokemonFormEvent(...)`
- `applyPokemonFormTransitionEvent(...)`

The event engine supports source-backed matching for:

- Move use / Move identity / damaging status / Defense-CS-raising Status Moves / tags such as Blessing;
- Ability use;
- Capability use;
- explicit Form actions;
- battle start;
- HP changes;
- Temporary-HP changes;
- combat-state changes;
- scene end;
- Faint;
- weather;
- trigger item;
- base/active Form compatibility.

Actions currently supported by lifecycle rules:

- activate active Form;
- deactivate active Form;
- toggle active Form;
- synchronize an automatic state;
- validate persistence after state changes.

Temporary-HP effects are returned as directives. Fixed fractions are resolved when their required HP value is available; source tick effects retain the exact source definition that one Tick is `1/10` of maximum HP. No extra rounding rule is invented. Power Construct can consume `targetFormMaxHp` to resolve its Complete-Forme Temporary HP grant; if that value is unavailable the directive preserves the formula instead of guessing.

## API integration

Windows `server.mjs` and Android `mobile-api.mjs` now expose:

`POST /api/pokemon/forms/transition`

The route accepts the same Form/Pokémon context as the existing resolve endpoint plus an `event` object. It returns:

- next `formState`;
- whether the state changed;
- applied lifecycle rule IDs;
- source-backed effect directives;
- normal Form resolution / errors / warnings.

This is a transition preview/runtime primitive. It does not silently persist state or deduct actions/frequency uses.

## Source-explicit automated Forms

Catalog schema is now **7**, requirement model remains **2**, lifecycle model is **1**.

Exactly **8 Forms** carry lifecycle automation with **24 event rules**.

### Aegislash — Stance Change

Source: Core 1.05 p.331.

- damaging Move use -> Sword Stance;
- King’s Shield -> Shield;
- Protect -> Shield;
- Status Move that raises Defense Combat Stages -> Shield;
- Blessing -> Shield;
- explicit `stance-change-full-action` event toggles Stance.

The previous manual review gate on Sword Stance is removed because the supplied source now has an exact event representation.

### Wishiwashi — Schooling

Source: SuMo References p.4.

- `ability-used: Schooling` -> Schooling Forme;
- returns a Temporary-HP directive equal to half own maximum HP;
- directive marks other Temporary-HP sources as blocked while active;
- HP/Temporary-HP/state-check events revalidate the exact source exit condition: below half maximum HP AND no Temporary HP -> Solo.

Frequency/action metadata remains `Daily – Free Action`; the event engine does not consume it automatically.

### Minior — Shields Down

Source: SuMo References p.4.

- HP-change, combat-state-change and explicit state-check events synchronize Meteor/Core;
- Meteor -> Core at HP <= 50%;
- Core may stay above half while still in combat;
- outside combat above half -> Meteor.

### Eiscue — Ice Face

Source: New Abilities and Moves p.1.

- battle start returns two Ice Face Tick Temporary HP;
- `ice-face-hail-restore` in Hail returns two Ice Face Tick Temporary HP and clears Noice state;
- Temporary-HP/state-check events synchronize Ice Face vs Noice using Ice Face-specific provenance;
- Hail restoration remains marked as a Standard Action; action economy is caller responsibility.

### Zygarde — Power Construct

Source: SuMo References p.3.

- `ability-used: Power Construct` chooses the Complete overlay compatible with current 10%/50% base;
- requirement model v2 still enforces below 50% HP;
- event returns half of Complete Forme maximum HP as a Temporary-HP formula/directive and marks other Temporary-HP sources blocked;
- `scene-end` clears Complete automatically;
- prior 10%/50% HP total and maximum remain preserved by the existing mixed builder.

### Zacian / Zamazenta — Weapon Bond

Source: New Abilities and Moves p.1.

- `capability-used: Weapon Bond` with matching Ancestral Sword/Shield enters Crowned;
- `faint` clears Crowned;
- explicit `weapon-bond-relinquish` Form action clears Crowned;
- relinquish is marked Extended Action; action economy remains caller responsibility.

## Scripts / CI

Added:

- `PTU_Companion_Windows_Source/scripts/apply_stage_b_form_lifecycle_events.py`
- `PTU_Companion_Windows_Source/scripts/augment_ptu_form_lifecycle_events.py`
- `PTU_Companion_Windows_Source/scripts/verify_stage_b_form_lifecycle_events.mjs`
- `.github/workflows/stage-b-form-lifecycle-events.yml`

The integration script patches both Windows and Android API surfaces and keeps the shared event modules aligned. It also fixed an explicit-null previous-Form-state bug discovered by the first focused run: `previousActiveFormId: null` must remain null during a new activation rather than being replaced with the just-selected active Form.

## Validation

Final successful workflow:

- run: `36291122777`
- job: `108541283946`
- conclusion: **success**

Passed:

- API transition endpoint integration;
- lifecycle metadata overlay;
- focused event-transition regression tests;
- Aegislash automatic Stance tests;
- Wishiwashi Schooling activation/reversion tests;
- Minior combat/out-of-combat synchronization tests;
- Eiscue battle-start/Hail/THP-provenance tests;
- Zygarde base-compatible Power Construct + scene expiry tests;
- Zacian/Zamazenta Weapon Bond enter/Faint/relinquish tests;
- Windows/Android lifecycle modules byte-identical;
- full Windows `npm run verify`;
- full Android `npm run verify`;
- no `.ptucp` diff;
- `git diff --check`.

## Catalog counts

Unchanged structural counts:

- 48 candidate-family entries;
- 32 generic record-backed family entries;
- 16 source-specific family entries;
- 82 candidate/derived Forms;
- 37 generic record-backed Forms;
- 45 source-specific Forms;
- 21 not directly materialized;
- 50 synthetic transforms = 48 Mega + 2 Primal;
- 0 synthetic Ultra Burst transforms.

New runtime metadata:

- requirement model: 2;
- lifecycle model: 1;
- lifecycle-automated Forms: 8;
- lifecycle event rules: 24.

## Deferred gate unchanged

Still blocked:

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

Do not use lifecycle events to fabricate the missing transition mechanics for these families.

## Remaining deliberate gaps / next useful pass

The event engine now returns state/effect directives, but the application UI/state layer does not yet automatically persist/apply every directive. The next useful pass is **campaign-state integration**:

1. apply returned `formState` to the Pokémon record through explicit user/game events;
2. apply source-tagged Temporary HP directives into `formTempHpBySource` / total `tempHp` without mixing provenance;
3. route battle start, HP/THP changes, scene end, Faint, Move use, Ability use and Capability/Form actions from the actual combat UI/runtime into `/api/pokemon/forms/transition`;
4. enforce Daily/Scene/action consumption only where the existing combat/action subsystem has an exact source-backed accounting primitive;
5. keep Darmanitan regular Zen, Necrozma Ultra Burst, Mega/Primal review gates and all ten deferred families conservative until their missing semantics are resolved.
