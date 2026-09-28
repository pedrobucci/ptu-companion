# Handoff — PTU Combat Physical Dice 13

## Repository / delivery state

- Repository: `pedrobucci/ptu-companion`
- Branch: `content/ptu-parametrized-forms-catalog`
- Draft PR: #11 — `docs: audit PTU Mega, Primal and alternate Forms`
- PR base: `feature/pokemon-shiny-d`
- Keep PR **Draft/Open**. Do not merge or publish a Release without explicit owner approval.
- Do not mutate bundled/default `.ptucp` while the ten source-insufficient Form families remain deferred.

## Checkpoints

- Physical-dice patch source: `dcd75c3c65f7998bf589bd50e9cf17dacf67e98d`
- Combat verifier update: `364a80357f49f8b665083c9b74bdc28bca2b28bb`
- Fixup integration / CI trigger: `f549c58d2e1ae35612080e66f5aaeb080db6fd6a`
- Generated runtime/docs checkpoint: `6578981c27002b53d513cd92829c6c3baf110da7`
- GitHub Actions run: `36375188738`
- Job: `108779470190`
- Conclusion: **success**

The successful run executed all previous Form campaign/lifecycle verifiers, the updated Combat Session Ledger verifier, full Windows `npm run verify`, full Android `npm run verify`, invariants, `.ptucp` guard, and `git diff --check`.

## Product invariant established in this pass

**The Combat screen never generates attack or damage dice.**

This is now a hard product behavior, not a toggle or fallback:

- Accuracy rolls are made with physical dice and the natural d20 is entered manually.
- Damage Base dice are made with physical dice and their rolled result is entered manually.
- The digital random helpers remain guarded so an accidental future call fails instead of silently generating a roll.
- Hit/Miss is explicitly confirmed by the player and is authoritative.
- Critical Hit is explicitly confirmed by the player and is authoritative.
- The natural d20 is still retained in the log because PTU effects and critical/effect ranges can depend on the natural roll.
- For a damaging hit, the UI shows the normal PTU Damage Base expression and the doubled Critical expression when available.
- The Companion adds only values belonging to the controlled Pokémon that it actually knows, such as attacking Stat, Mixed Power and source-explicit local bonuses.

## Abstract-target model

The opposing Pokémon/NPC remains intentionally abstract.

The Combat menu does not create or persist an enemy entity and does not attempt to own the opponent's:

- HP;
- Defense / Special Defense;
- Evasion;
- DR;
- type effectiveness;
- Abilities / Features / Shields;
- conditions;
- Moves or action ledger.

Instead the user records the authoritative external outcome when relevant.

The Move-resolution UI now includes an optional `Damage actually taken by target` value. This is deliberately separate from the controlled Pokémon's physical Damage Roll. It is the correct input for future Move handlers whose effect depends on damage that actually passed through the opposing side's unknown defenses/effectiveness.

## Current Rollout behavior

Rollout still uses the source-explicit combat state from the previous pass:

- base DB 3;
- successful reported hit -> next DB +4, capped at 15;
- miss -> reset to DB 3;
- `No valid target · end chain` remains the other explicit chain exit;
- while the chain is active, other Moves remain blocked.

The important change is that the app no longer rolls Rollout's d20 or damage dice. The player rolls them physically and records the result; only the reported Hit/Miss advances or resets the chain.

## Critical damage entry

PTU Core defines a Critical Hit as adding the Damage Dice Roll a second time without adding the attacking Stat a second time. The Combat UI therefore shows a doubled physical-dice expression when it can resolve one from the Damage Base chart.

Example: a normal `2d6+8` Damage Roll is shown as `4d6+16` for a Critical. The user rolls those dice physically and enters that rolled Damage Base component. The Companion then adds the controlled Pokémon's attacking Stat/local bonuses once.

## Deterministic implementation files

Source patch:

- `PTU_Companion_Windows_Source/scripts/apply_stage_b_combat_manual_physical_dice.py`

The existing fixup runner now invokes the physical-dice patch after rebuilding the Combat ledger:

- `PTU_Companion_Windows_Source/scripts/apply_stage_b_combat_session_fixups.py`

Verification:

- `PTU_Companion_Windows_Source/scripts/verify_stage_b_combat_session_ledger.mjs`

Generated/versioned docs:

- `docs/PTU_COMBAT_SESSION_LEDGER.md`
- `docs/data/PTU_COMBAT_SESSION_LEDGER.json` — schema version **2**

Generated runtime surfaces:

- `PTU_Companion_Windows_Source/static-preview/app.js`
- `PTU_Companion_Android_Tauri/www/app.js`

## Validation result

Run `36375188738` / job `108779470190` — **success**.

Validated:

- no Combat resolver call to digital d20 RNG;
- no Combat resolver call to digital damage-dice RNG;
- physical natural d20 input;
- explicit reported Hit/Miss;
- explicit reported Critical Hit;
- manual physical Damage Roll input;
- optional actual target-damage outcome;
- Critical physical dice-expression doubling;
- Defense Curl + Rollout behavior;
- Windows/Android parity;
- full Windows and Android regressions;
- persistence/import/export invariants;
- no `.ptucp` mutation;
- `git diff --check`.

## Next recommended pass

Build a small, source-explicit **Move Outcome handler layer** on top of the abstract target result rather than modeling enemies.

Good first handlers:

1. draining Moves whose user heals from a fraction of **damage actually dealt** (`Mega Drain`, `Giga Drain`, `Drain Punch`, `Draining Kiss`, `Leech Life`, etc. where the supplied source explicitly uses that wording);
2. `Fury Cutter`, which needs successful consecutive use on the same target and resets on miss or failure to damage;
3. `Fell Stinger`, which needs an authoritative `target fainted` outcome before raising Attack;
4. other Move effects that depend on the natural Accuracy Roll can consume the already-entered physical d20 without generating a new value.

Keep each handler source-explicit. Do not build a generic prose interpreter.

After that, connect source-explicit Ability and Form action/frequency costs to the same shared Pokémon Combat ledger.

## Conservative gates retained

- The exact ten deferred Form families remain blocked: Deoxys, Giratina, Hoopa, Kyurem, Landorus, Oricorio, Rotom, Shaymin, Thundurus, Tornadus.
- Darmanitan regular Zen and Necrozma Ultra activation remain conservative/manual where supplied-source semantics are conflicting or incomplete.
- No remote artwork URL is invented.
- No bundled/default `.ptucp` mutation.
- No merge or release.
