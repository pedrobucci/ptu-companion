# Handoff — PTU Forms combat ergonomics 11

## Branch / PR

- Repository: `pedrobucci/ptu-companion`
- Working branch: `content/ptu-parametrized-forms-catalog`
- Draft PR: `#11` (`docs: audit PTU Mega, Primal and alternate Forms`)
- Base: `feature/pokemon-shiny-d`
- Previous handoff: `HANDOFF_PTU_FORMS_PERSISTENCE_FEEDBACK_10.md`
- Source checkpoint before generated runtime: `b3cd7fd473a90ff6a728dced790ee54e825aeef1`
- Generated runtime/audit checkpoint: `449e3c36d7b5bb012c54020667c08516df6de35f`
- Do not merge or release without explicit owner approval.

## Purpose of this pass

This pass audits whether the existing campaign combat model can consume Form lifecycle `actionCost` / `frequency` values losslessly and improves combat visibility of current Form state.

It deliberately does **not** broaden the PTU source scope and does not introduce an isolated Form-only action economy.

## Combat resource audit

Added deterministic audit artifacts:

- `docs/PTU_FORMS_COMBAT_RESOURCE_AUDIT.md`
- `docs/data/PTU_FORMS_COMBAT_RESOURCE_AUDIT.json`

The audit conclusion is:

- automatic spending supported by current combat state: **No**;
- exact safe automatic-spending subset: **0**;
- lifecycle action/frequency metadata remains **informational only**.

### Existing state that was inspected

The current campaign has:

- global `round`, `scene`, and `day` counters;
- Trainer Action Points (`trainer.details.currentAp`), which are Trainer resources and cannot be reused as Pokémon actions;
- Pokémon HP, Temporary HP, injuries, Combat Stages and Form state;
- Move/Ability/Form frequency text for display/reference;
- lifecycle `appliedRules.actionCost` and `appliedRules.frequency` source labels.

It does **not** currently have:

- per-Pokémon Free/Swift/Standard/Full Action expenditure;
- turn-level action slots;
- a per-Pokémon/per-source Daily or Scene usage ledger;
- Extended Action progress/completion state.

### Reset boundaries

The existing cycle helpers are also insufficient as usage ledgers:

- `nextRound()` increments the global round;
- `endScene()` increments scene, resets round and Combat Stages and dispatches Form `scene-end` hooks;
- `newDay()` increments day and resets scene/round.

None of those functions currently resets authoritative per-Pokémon frequency counters because such counters do not exist.

### Spending policy

For this reason, this pass keeps all of the following as source metadata only:

- Free Action
- Swift Action
- Standard Action
- Full Action
- Extended Action
- Daily
- Scene

The code must not reinterpret Trainer AP as Pokémon action economy or create hidden Form-only usage counters that other Moves/Abilities would not share.

## Compact current-Form feedback

Added deterministic patch:

`PTU_Companion_Windows_Source/scripts/apply_stage_b_form_combat_ergonomics.py`

Both Windows and Android clients now include:

- `pokemonFormCombatPresentation()`
- `pokemonFormCombatIndicator()`

The Pokémon sheet's **Active State** section displays a compact current-Form indicator without requiring the user to open the Forms manager.

The indicator:

- uses the existing readable catalog-name resolver;
- visually distinguishes an active transformation from a permanent/base-only state;
- shows the most recent `Pokémon Form changed` Trainer History entry for that Pokémon when present;
- preserves raw-ID fallback for unresolved/custom Forms;
- does not rewrite persisted Form IDs.

## Validation

Added:

`PTU_Companion_Windows_Source/scripts/verify_stage_b_form_combat_ergonomics.mjs`

It verifies:

- resource audit conclusion remains informational-only / zero exact auto-spend subset;
- no hidden Pokémon action/frequency ledger was introduced;
- Windows/Android compact Form helpers are byte-identical;
- known catalog Forms render readable current-Form names;
- latest automatic transition is visible in the compact indicator;
- all previous Form campaign-state tests still pass.

Final validation:

- workflow: `Stage B Form Campaign State`
- run: `36340271014`
- job: `108678864066`
- conclusion: **success**

Passed:

- campaign-state integration patch;
- campaign hardening patch;
- persistence/readable-feedback patch;
- combat-resource audit / compact Form patch;
- lifecycle metadata refresh;
- all focused Form verifiers;
- full Windows `npm run verify`;
- full Android `npm run verify`;
- integration/audit invariants;
- no `.ptucp` mutation;
- `git diff --check`.

The successful workflow generated:

`449e3c36d7b5bb012c54020667c08516df6de35f` — `feat(forms): add combat resource audit and Form indicator [skip ci]`.

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

- Darmanitan regular Zen remains manual because supplied activation rules conflict;
- Necrozma Ultra Burst remains manual because activation is source-insufficient;
- Mega/Primal review gates remain conservative where activation/action/equipment semantics are not represented losslessly;
- no default pack conversion while deferred families remain;
- no remote artwork URL is invented.

## Useful next pass

The next implementation pass should decide whether to build a **shared Pokémon combat-resource ledger** rather than a Form-specific one.

Before any automatic Form spending, that model should cover the same resources used by ordinary Moves and Abilities, including:

1. explicit per-Pokémon turn identity / round reset semantics;
2. Standard / Swift / Shift / Full Action relationships as represented by the app's chosen PTU combat model;
3. source-keyed Scene and Daily frequency usage shared by Moves, Abilities and Form lifecycle rules;
4. Extended Action progress where source mechanics require it;
5. persistence/export/import and history of resource expenditure;
6. GM correction/override without corrupting usage history.

If that cross-cutting combat ledger is out of scope for this PR, keep `actionCost` and `frequency` informational and continue with UI/runtime stabilization instead. Do not add a Form-only approximation.
