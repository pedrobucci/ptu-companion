# Handoff — PTU Forms campaign-state integration 8

## Branch / PR

- Repository: `pedrobucci/ptu-companion`
- Working branch: `content/ptu-parametrized-forms-catalog`
- Draft PR: `#11` (`docs: audit PTU Mega, Primal and alternate Forms`)
- Base: `feature/pokemon-shiny-d`
- Lifecycle runtime integration checkpoint: `2b4e4f0d1ddd43f21c8a27f87ed42c4aeddcb71a`
- Final clean-validation checkpoint before this handoff: `4b76476aaed3b5fabd178990fb016f182a4e6145`
- Do not merge or release without explicit owner approval.

## Purpose of this pass

The previous pass could resolve lifecycle events and return the next `formState`, but did not yet apply those results to the live campaign Pokémon record.

This pass connects source-explicit Form lifecycle events to campaign state and the Windows/Android UI while keeping the same conservative source policy:

- no default `.ptucp` mutation;
- no unlocking of source-insufficient families;
- no silent action/frequency spending;
- no invented transition rules or HP rounding rules.

## New shared campaign-state runtime

Added byte-identical modules:

- `PTU_Companion_Windows_Source/rules/pokemon-form-campaign-state.mjs`
- `PTU_Companion_Android_Tauri/www/rules/pokemon-form-campaign-state.mjs`

`FORM_CAMPAIGN_STATE_MODEL_VERSION = 1`.

The high-level `applyPokemonFormGameEvent()` primitive now:

1. receives a real game event plus the current Pokémon record;
2. applies HP/Temporary-HP changes when relevant;
3. derives secondary lifecycle events such as `hp-changed`, `temp-hp-changed`, and `faint`;
4. runs the shared Form lifecycle resolver;
5. writes the resulting `formState` back into the Pokémon details;
6. applies source-defined effect directives such as Temporary HP grants;
7. preserves Temporary HP provenance by Form/Ability source;
8. returns the updated Pokémon record for persistence/UI replacement.

## Temporary HP integration

The supplied PTU Core states that Temporary Hit Points are lost before real Hit Points and that multiple grants do not stack; only the highest current value applies.

Campaign representation:

- top-level `pokemon.tempHp` is kept synchronized with `pokemon.details.tempHp`;
- Form-origin Temporary HP is tracked in `details.formTempHpBySource`;
- damage reduces tracked Form Temporary HP before real HP;
- if a stronger Temporary-HP source replaces the current grant, provenance is replaced with that source;
- generic mixed/overflow Temporary HP deliberately drops source attribution rather than falsely assigning it to a Form;
- source rules that prohibit other Temporary HP while active use `formTempHpBlockOtherSources`.

The existing campaign behavior where healing beyond maximum HP becomes Temporary HP remains intact unless the active source-defined Form explicitly blocks other Temporary HP.

## Power Construct / Complete HP calculation

The supplied Zygarde Complete record has Base HP `22`, while Power Construct explicitly says the user keeps the actual HP total and HP Maximum of the previous 10%/50% Form and separately gains Temporary HP equal to half the maximum HP that Complete Forme **would have**.

To preserve both rules simultaneously:

- Complete still does not replace the Pokémon's live HP/max HP;
- lifecycle metadata now includes source Base HP `22` as `target_form_base_hp`;
- the campaign-state layer computes the hypothetical Complete max HP using the same saved build deltas and the application's existing PTU HP formula;
- only that hypothetical maximum is used for the Power Construct Temporary-HP grant.

No main-series rule or alternate formula is imported.

## API integration

Windows `server.mjs` and Android `mobile-api.mjs` now expose:

`POST /api/pokemon/forms/apply-event`

The endpoint resolves the current Ruleset/Species, executes `applyPokemonFormGameEvent()`, and returns the updated Pokémon record, Form state, applied transitions, effect directives, effect applications, warnings, and errors.

The lower-level `/api/pokemon/forms/transition` endpoint remains available for pure transition previews.

## Persistence

Windows campaign persistence now mirrors Pokémon Temporary HP through the existing `details_json` payload:

- load exposes `pokemon.tempHp` from `details.tempHp`;
- save writes the current top-level `pokemon.tempHp` back into `details.tempHp`;
- `formState`, `formTempHpBySource`, and the source-specific THP block metadata remain inside the existing details object and therefore round-trip without a database/save-schema migration.

`POKEMON_FORM_SCHEMA_VERSION` remains `1`.

## UI / live event wiring

Both Windows and Android clients now share the same event-facing behavior:

- HP `+/-` controls use the campaign Form-event endpoint for linked Pokémon;
- damage consumes source-tracked Temporary HP first and may derive `faint`;
- Move cards expose `Use Move`, allowing Stance Change to react to actual Move-use events;
- Schooling and Power Construct expose `Use Ability` actions;
- the Forms manager exposes source lifecycle actions such as Aegislash Full Action Stance Change, Eiscue Hail restoration, Weapon Bond entry, and voluntary Weapon Bond relinquish;
- battle start/end is explicit in the combat controls so Ice Face battle-start hooks and Minior out-of-combat synchronization can run;
- `endScene()` dispatches `scene-end`, allowing Power Construct Complete to expire automatically.

Move metadata passed to lifecycle includes Move name, class, damaging state, keyword tags, and a conservative Defense-Combat-Stage raise detector for the source-defined Stance Change return condition.

## Action economy / frequency policy

Lifecycle `appliedRules` now surface:

- `actionCost`
- `frequency`

These values are displayed/available to callers but are **not silently consumed**. The current Trainer/Pokémon action/frequency subsystems do not yet provide a single lossless accounting primitive for all source cases, so this pass avoids inventing one.

Examples that remain caller-visible rather than auto-spent:

- Schooling — Daily / Free Action;
- Power Construct — Daily / Swift Action;
- Eiscue Hail restoration — Standard Action;
- Aegislash voluntary Stance Change — Full Action;
- Weapon Bond enter/relinquish — Extended Action.

## Runtime semantics covered by focused tests

The new verifier covers:

- Core Temporary-HP non-stacking behavior;
- source provenance replacement/consumption;
- Aegislash Move-triggered state mutation;
- Wishiwashi Schooling THP persistence and Solo return;
- Eiscue battle-start Ice Face THP;
- Minior HP/combat synchronization;
- Power Construct hypothetical Complete max-HP calculation while preserving live 10%/50% HP;
- Power Construct scene expiry without inventing a THP-removal rule;
- Zacian Weapon Bond entry and Faint exit;
- Windows/Android byte parity;
- API/UI integration surfaces;
- persistence of top-level Temporary HP through the existing details JSON.

Legacy Beta 8 HP/identity verifiers were updated only to understand that the Pokémon HP wrapper is now async for linked-Species lifecycle resolution; their original HP/Temporary-HP assertions remain unchanged.

## Validation

Final clean GitHub Actions validation:

- workflow: `Stage B Form Campaign State`
- run: `36325706932`
- job: `108637957636`
- conclusion: **success**

Passed:

- deterministic campaign-state/UI patch;
- deterministic lifecycle metadata refresh;
- focused campaign-state Form tests;
- full Windows `npm run verify`;
- full Android `npm run verify`;
- Windows/Android campaign-state module parity;
- Windows/Android event-engine parity;
- API/UI/persistence invariants;
- no `.ptucp` diff;
- `git diff --check`.

The final clean run followed the generated runtime checkpoint `2b4e4f0d1ddd43f21c8a27f87ed42c4aeddcb71a` and ran from clean checkpoint `4b76476aaed3b5fabd178990fb016f182a4e6145`.

## Deferred/source gates unchanged

The exact ten deferred families remain blocked:

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

Also unchanged:

- Darmanitan regular Zen Mode remains manual because supplied activation rules conflict;
- Necrozma Ultra Burst remains manual because activation is source-insufficient;
- Mega/Primal review gates remain conservative where activation/action/equipment semantics are not yet lossless;
- no default pack conversion while deferred families remain.

## Remaining useful next pass

The lifecycle path is now connected end-to-end from UI event -> runtime -> campaign Pokémon -> persistence. The next pass should harden the surrounding campaign integrations rather than broaden source scope:

1. clear/reconcile Form THP provenance in every existing storage/recall path that already clears Temporary HP;
2. revalidate Form state after healing/items or other HP mutations that bypass the standard `changeHp` control;
3. connect action/frequency accounting only where the existing combat subsystem can consume the exact source cost without approximation;
4. add visible UI feedback/history for automatic Form transitions and blocked Temporary-HP grants;
5. keep the ten deferred families and unresolved manual gates closed.
