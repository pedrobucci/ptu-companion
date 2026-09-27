# Handoff — PTU Combat Session Ledger 12

## Repository / delivery state

- Repository: `pedrobucci/ptu-companion`
- Branch: `content/ptu-parametrized-forms-catalog`
- Draft PR: #11 — `docs: audit PTU Mega, Primal and alternate Forms`
- PR base: `feature/pokemon-shiny-d`
- Keep PR **Draft/Open**. Do not merge or publish a Release without explicit owner approval.
- Do not mutate bundled/default `.ptucp` while the ten source-insufficient Form families remain deferred.

## Checkpoints

- Source / CI trigger checkpoint: `14327676a09338712610016e6156e8892286d72b`
- Generated Combat runtime/docs checkpoint: `0da6253f68284dab2bc7b54a1957abaa39a0c366`
- GitHub Actions run: `36358383751`
- Job: `108730534343`
- Conclusion: **success**

The successful run executed all previous Stage B Form campaign/lifecycle verifiers, the new Combat Session Ledger verifier, full Windows `npm run verify`, full Android `npm run verify`, invariants, `.ptucp` guard, and `git diff --check`.

## User-facing goal delivered

A new **Combat** navigation menu now provides a shared Pokémon combat-session ledger rather than a Form-specific counter.

The Trainer can:

1. choose one of the existing Rosters;
2. put carried Pokémon from that Roster into the Combat session;
3. switch the focused combatant among the session participants;
4. see and modify the Pokémon's real campaign HP/THP, rather than a parallel copy;
5. see the current Form and Form transition feedback already supplied by Stage B;
6. see the Pokémon's resolved Moves from the active Ruleset;
7. track per-turn Standard / Shift / Swift resources and unlimited Free Actions;
8. track supported source frequencies (`At-Will`, `EOT`, `Scene`, `Scene xN`, `Daily`, `Daily xN`);
9. roll attacks using an actual randomized d20 or enter the natural result from a physical die;
10. record hit / miss / Critical Hit and actual Damage Base dice in the combat log.

Session state is stored in `state.ui.combat`, so the browser/Tauri JSON save/export/import path round-trips it through the existing state object. SQLite persists it through `ui_state.data_json`. The repository semantic revision hash now includes `inCombat` and `combat`, so actual combat-resource changes are campaign state rather than navigation-only noise.

## PTU source rules implemented in this pass

Only supplied PTU material was used.

### Action economy — Core pp. 227–228

The supplied Core states that each participant has one Standard Action, one Shift Action and one Swift Action on their turn, plus any number of Free Actions. It also permits giving up a Standard Action for another Swift or Shift Action under its stated restrictions.

The Core separately defines Full Actions as consuming both Standard and Shift Actions.

The Combat ledger therefore tracks Standard / Shift / Swift independently, treats Free as unlimited, consumes Standard+Shift for Full Action, and supports Standard -> Swift / Standard -> Shift conversion.

Trainer AP is not reused as Pokémon action economy.

### Accuracy and Critical Hits — Core p. 236

The resolver follows the supplied source model:

- Accuracy Roll is a natural `1d20`;
- target Evasion is added to Move AC;
- natural 1 always misses;
- natural 20 always hits;
- Critical / Effect ranges use the natural die rather than the modified total;
- a damaging Critical Hit adds the Damage Dice Roll a second time but does not add the attack Stat a second time.

The UI therefore asks for target Evasion and optionally target Defense / Special Defense. It also exposes a critical-threshold input and target-critical-immunity toggle so modifiers not yet represented generically are not silently guessed.

### Defense Curl — Core p. 394

Using Defense Curl creates the tracked `Curled Up` condition:

- immune to Critical Hits;
- DR 10;
- normally Slowed and -4 Accuracy;
- if Rollout or Ice Ball is in the Move List, the user is not Slowed by Curled Up;
- Rollout / Ice Ball while Curled Up ignore that Accuracy penalty and gain +10 to their Damage Roll;
- leaving Curled Up spends a Swift Action.

Important implementation fix: Move action cost is detected from the Move action/range declaration, not incidental text in the effect. Therefore Defense Curl itself remains a normal Standard-Action Move even though its effect says Curled Up may later be ended as a Swift Action.

### Rollout — Core p. 427

The source defines Rollout as Rock / At-Will / AC 4 / DB 3 / Physical and says it continues on later turns until it misses a target or cannot hit a target. Each successive use raises Damage Base by +4 to a maximum of DB 15.

The ledger therefore tracks a Rollout chain:

- first base DB: 3;
- hit -> next base DB 7;
- hit -> 11;
- hit -> 15;
- further hits stay at 15;
- miss -> chain ends and next use returns to DB 3;
- successful chain disables other Moves until the source-defined chain exit;
- UI exposes `No valid target · end chain` for the other source-defined exit.

Existing STAB calculation remains a separate +2 DB layer after the dynamic Rollout base DB. Defense Curl's +10 is a Damage Roll bonus, not DB.

## Attack resolution behavior

`pokemonCombatResolveMove` performs the first shared real-roll attack path:

- random natural d20 via `crypto.getRandomValues` when available, with `Math.random` fallback;
- optional manually-entered natural d20 for physical dice;
- hit/miss resolution against base/effective AC + target Evasion;
- Critical Hit determination against the natural roll;
- dynamic Rollout DB when relevant;
- existing STAB / resolved attacking Stat / Mixed Power integration;
- actual Damage Base dice fetched from the active Ruleset `/api/damage-base/:db` data;
- Critical repeats DB dice/flat DB roll component but not the attack Stat;
- optional Defense / Sp. Defense subtraction;
- combat log records the natural roll, target number, result, DB, dice and relevant bonuses.

No arbitrary type-effectiveness or textual Move-effect interpreter was invented in this first pass.

## Form integration

The shared Combat session uses the existing Form lifecycle rather than duplicating it:

- entering Combat -> existing `battle-start` Form event;
- leaving/ending Combat -> existing `battle-end` Form event;
- resolved Move use -> existing `move-used` Form event;
- HP +/- continues through the existing campaign-state HP/Form path;
- current Form remains visible in the active combatant panel.

Form lifecycle `actionCost` / `frequency` is **not yet auto-spent** from this new ledger. The ledger is now the proper shared target for that next integration, but wiring it should be a separate tested pass so ordinary Moves, Abilities and Forms all consume the same source-keyed resources.

## Deterministic implementation files

Source patch / fixup:

- `PTU_Companion_Windows_Source/scripts/apply_stage_b_combat_session_ledger.py`
- `PTU_Companion_Windows_Source/scripts/apply_stage_b_combat_session_fixups.py`

Verification:

- `PTU_Companion_Windows_Source/scripts/verify_stage_b_combat_session_ledger.mjs`

Generated/versioned docs:

- `docs/PTU_COMBAT_SESSION_LEDGER.md`
- `docs/data/PTU_COMBAT_SESSION_LEDGER.json`

Generated runtime surfaces:

- `PTU_Companion_Windows_Source/static-preview/app.js`
- `PTU_Companion_Android_Tauri/www/app.js`
- `PTU_Companion_Windows_Source/persistence/repository.mjs`

CI:

- `.github/workflows/stage-b-form-campaign-state.yml`

The old `PTU_FORMS_COMBAT_RESOURCE_AUDIT` is intentionally kept as a **historical pre-ledger checkpoint** and points to the new Combat Session Ledger document.

## Validation result

Run `36358383751` / job `108730534343` — **success**.

Validated:

- Stage B Form campaign-state lifecycle tests;
- campaign hardening tests;
- persistence/readable-feedback tests;
- historical pre-ledger combat ergonomics verifier;
- shared Combat Session Ledger verifier;
- Windows full `npm run verify`;
- Android full `npm run verify`;
- Form runtime invariants;
- Combat menu/runtime/document invariants;
- SQLite semantic combat-state persistence guard;
- no `.ptucp` mutation;
- `git diff --check`.

## Known conservative boundaries / next work

1. **Form action/frequency spending:** connect source-explicit Form lifecycle costs to this shared ledger, not to a new Form-only counter.
2. **Abilities:** use the same ledger for activated Ability action/frequency usage.
3. **Target model:** a future pass may allow another campaign Pokémon/NPC combatant to be selected as target so Evasion, Defense, typing, HP and status can be resolved without manual target fields.
4. **Type effectiveness:** not automated yet in this pass.
5. **Move effect handlers:** Defense Curl + Rollout is the first complex pair. Add additional source-explicit handlers incrementally rather than interpreting arbitrary prose.
6. **EOT / extra-turn hardening:** current EOT baseline keys its cooldown to combat round boundaries. Before supporting effects that grant extra turns in one round, promote this to an explicit per-Pokémon turn serial so EOT remains lossless.
7. **Extended Actions:** placeholder exists but progress/completion semantics are not automated yet.
8. **GM correction/override:** add ledger correction UI before relying on the ledger for every combat resource.
9. Keep the exact ten deferred Form families blocked: Deoxys, Giratina, Hoopa, Kyurem, Landorus, Oricorio, Rotom, Shaymin, Thundurus, Tornadus.
10. Keep Darmanitan regular Zen, Necrozma Ultra activation and other unresolved manual gates conservative.

## Recommended next pass

Use the new shared ledger for **source-explicit Form and Ability costs**, starting only with rules already represented losslessly. In parallel, introduce a generic combat-target abstraction so attacks can target another known campaign Pokémon without re-entering Evasion/Defense manually. Preserve manual target values for external/NPC targets.
