# Handoff — PTU Combat Non-Move Resource Ledger 16

## Repository / delivery state

- Repository: `pedrobucci/ptu-companion`
- Branch: `content/ptu-parametrized-forms-catalog`
- Draft PR: #11 — `docs: audit PTU Mega, Primal and alternate Forms`
- Base: `feature/pokemon-shiny-d`
- Keep the PR **Draft/Open**. Do not merge or publish a Release without explicit owner approval.
- Do not mutate bundled/default `.ptucp` while the ten source-insufficient Form families remain deferred.

## Product invariants retained

- The Combat menu manages only Pokémon controlled by the current Trainer.
- Opposing Pokémon/NPCs remain abstract; no enemy HP/Defense/Evasion/type/action ledger is created.
- Attack, damage and extra effect rolls remain physical/manual.
- No generic Move/Ability prose interpreter was introduced.
- Trainer AP is not reused as Pokémon action economy.
- Windows and Android keep equivalent resource/runtime functions.

## Non-Move Combat Resource model v1

New artifacts:

- `docs/PTU_COMBAT_NON_MOVE_RESOURCES.md`
- `docs/data/PTU_COMBAT_NON_MOVE_RESOURCES.json` — schema **1**
- `PTU_Companion_Windows_Source/scripts/apply_stage_b_combat_non_move_resources.py`
- `PTU_Companion_Windows_Source/scripts/verify_stage_b_combat_non_move_resources.mjs`
- `.github/workflows/stage-b-combat-non-move-resources.yml`

The non-Move layer uses the same per-Pokémon `pokemonCombatSpendAction` / frequency ledger as Moves. It does not maintain a parallel Ability/Form action economy.

### Generic API

The shared runtime now exposes source-neutral helpers for exact non-Move resource costs:

- `pokemonCombatNonMoveSpec`
- `pokemonCombatNonMoveAvailability`
- `pokemonCombatSpendNonMoveResource`
- `pokemonCombatRefundNonMoveResourceCore`
- `pokemonCombatApplyNonMoveFormEvent`

Resource frequency keys are namespaced as `nonmove:<source-kind>:<source-key>`, preventing a Move, Ability, Form action or Capability with a similar visible name from consuming another source's counter.

## Exact source-backed integrations

### Schooling

Supplied source: `Daily – Free Action`.

Runtime:

- successful Schooling activation uses its own Daily source key;
- Free Action remains unlimited as expected, while Daily use is consumed;
- a second activation before Day reset is rejected;
- Day reset restores availability.

### Power Construct

Supplied source: `Daily – Swift Action`.

Runtime:

- successful activation consumes the Pokémon's Swift Action plus its source-keyed Daily use;
- if Swift is already spent and Standard remains available, the existing Standard → Swift conversion can satisfy the cost;
- the resource transaction records exactly which token/conversion it created so refund does not erase a Swift Action that was already spent before the activation.

### Aegislash manual Stance Change

Supplied source: Aegislash may change Stance as a `Full Action`.

Runtime:

- the explicit manual Stance Change button spends the existing Full Action implementation: Standard + Shift;
- automatic Stance Change caused by source-defined Move triggers remains automatic and does **not** spend the manual Full Action.

### Ice Face Hail restoration

Supplied source: `Standard Action in Hail` to gain two ticks of Ice Face THP.

Runtime:

- the lifecycle action uses the same Standard Action ledger;
- the event still carries the exact Hail condition to the source lifecycle resolver;
- an invalid/no-op lifecycle result refunds the reserved action.

### Weapon Bond

Supplied source: entry and voluntary relinquish are `Extended Action`.

Runtime:

- Weapon Bond entry/relinquish is explicitly labeled Extended Action;
- Extended Action is **not** converted into Standard/Shift/Swift turn economy;
- no fake Extended Action progress model is introduced;
- trigger item and existing Form gates remain in the lifecycle layer.

## Atomic lifecycle spending

`pokemonCombatApplyNonMoveFormEvent` performs the resource/event operation transactionally at the UI layer:

1. validate action/frequency availability;
2. reserve only the exact tracked resources;
3. dispatch the source Form/Ability/Capability event;
4. if the event is invalid or produces no source lifecycle result, refund the reservation automatically;
5. if meaningful, retain the resource spend and commit the campaign state.

This prevents a failed Form activation from silently consuming a Daily/Scene use or turn action.

## Correction / refund

Combat now records recent non-Move resource transactions per Pokémon and exposes correction controls.

Refund behavior is deliberately narrow:

- restores only action flags/conversions created by that transaction;
- decrements only that transaction's namespaced Scene/Daily/EOT counter when still in the applicable boundary;
- never rewinds HP, THP, Form state, Move outcomes or other later campaign state;
- never resurrects an old Round/Scene/Day resource after that boundary has already reset it;
- cannot refund the same transaction twice.

This is a **resource correction** mechanism, not a general game-state rollback.

## Shared ledger documentation

`docs/PTU_COMBAT_SESSION_LEDGER.md` and `.json` now describe the non-Move resource layer as current behavior rather than a future feature.

The former `PTU_FORMS_COMBAT_RESOURCE_AUDIT` is explicitly retained as a `historical_pre_ledger_snapshot`; its pre-ledger conclusion is no longer interpreted as current runtime behavior.

Deterministic documentation patches:

- `apply_stage_b_combat_manual_physical_dice.py` now accepts the already-upgraded physical-dice section on rebuild;
- `apply_stage_b_combat_non_move_session_docs.py` keeps shared-ledger docs current and idempotent;
- `apply_stage_b_form_combat_ergonomics.py` / its verifier accept the current shared-ledger lifecycle note while preserving the old audit as historical.

## Deterministic stack

`apply_stage_b_combat_session_fixups.py` now rebuilds, in order:

1. physical-dice layer;
2. Move Outcome v1 layer;
3. controlled-Pokémon Move Outcome v2 layer;
4. non-Move Ability/Form/Capability resource layer;
5. current shared-ledger documentation;
6. duplicate-`async` normalization guard.

## Validation

Final full Form/Campaign/Combat rebuild after historical-audit hardening:

- GitHub Actions run: `36433118553`
- job: `108964104610`
- result: **success**
- includes all prior Form lifecycle/campaign verifiers, historical audit verifier, Combat ledger rebuild, Move Outcomes, full Windows/Android `npm run verify`, invariants and `.ptucp` guard.

Final dedicated non-Move resource validation:

- GitHub Actions run: `36434058488`
- job: `108967284423`
- result: **success**
- verifies deterministic rebuild, shared Combat ledger, Move Outcomes v2, exact non-Move mappings, no double-spend, Standard→Swift conversion, resource-only refund, source-key separation, Scene/Day resets, Extended Action conservatism, Windows/Android full regressions, no `.ptucp` mutation and `git diff --check`.

Validated source/fixup checkpoint before this handoff: `ffd7315eaf4c6b2a8a043a3644edd9f5be5a2638`.

## Conservative boundaries retained

- No enemy combat entity.
- No generated Combat RNG.
- No generic Ability prose interpreter.
- Only exact source-backed non-Move action/frequency rules are consumed automatically.
- Extended Action progress remains unmodeled.
- Resource Undo does not rewind the actual lifecycle effect.
- Darmanitan regular Zen remains manual because supplied sources conflict.
- Necrozma Ultra activation remains manual because supplied activation semantics are incomplete.
- Deferred Form families remain blocked: Deoxys, Giratina, Hoopa, Kyurem, Landorus, Oricorio, Rotom, Shaymin, Thundurus, Tornadus.
- No bundled/default `.ptucp` mutation.
- No merge or Release.

## Recommended next pass

Build a source-explicit **Combat Ability Action layer** on top of this shared resource API.

Suggested scope:

1. audit supplied Ability definitions for unambiguous action/frequency declarations and controlled-Pokémon effects;
2. expose only an explicit allowlist in the Combat UI rather than parsing arbitrary Ability prose;
3. reuse `pokemonCombatSpendNonMoveResource` for action/frequency costs;
4. for Abilities requiring random effect checks, keep physical dice/manual outcome entry;
5. reuse existing controlled-Pokémon Combat Stage/status/HP/Form helpers where the source effect is lossless;
6. leave target-side effects abstract unless the controlled Pokémon needs one small external result;
7. add source-specific tests plus no-double-spend/refund/reset tests for every newly automated Ability.

Before expanding Ability coverage, do not change the conservative Form gates or deferred-family decisions.
