# Handoff — PTU Combat Move Outcomes 14

## Repository / delivery state

- Repository: `pedrobucci/ptu-companion`
- Branch: `content/ptu-parametrized-forms-catalog`
- Draft PR: #11 — `docs: audit PTU Mega, Primal and alternate Forms`
- PR base: `feature/pokemon-shiny-d`
- Keep PR **Draft/Open**. Do not merge or publish a Release without explicit owner approval.
- Do not mutate bundled/default `.ptucp` while the ten source-insufficient Form families remain deferred.

## Checkpoints

- Move-outcome patch source: `a784dd6058d80bb79be0dafc5953b60123e4cd4e`
- Combat fixup integration: `36f58d8a7485f8f80b676508ea9f3a76941b1efb`
- Move-outcome verifier: `538828000bcc113b2fb7fb599de146d1d597540c`
- CI integration trigger: `e9891831e554b9b32f148a7d952e0e0ff4b83689`
- Generated runtime/docs checkpoint: `db4ce11e95a813bcb36b37a829ed0a41477c9472`
- GitHub Actions run: `36418297243`
- Job: `108914620734`
- Conclusion: **success**

The successful run executed all previous Form campaign/lifecycle verifiers, the Combat Session Ledger verifier, the new Move Outcome verifier, full Windows `npm run verify`, full Android `npm run verify`, invariants, `.ptucp` guard, and `git diff --check`.

## Product invariants retained

### Physical dice only

The Combat screen still never generates attack or damage dice.

- The natural Accuracy d20 is rolled physically and entered manually.
- Hit/Miss is player-confirmed and authoritative.
- Critical Hit is player-confirmed and authoritative.
- Damage dice are rolled physically and their result is entered manually.
- If a Move later needs an additional roll, that roll must also be requested as a physical/manual result rather than generated digitally.

### Abstract opposing target

Opposing Pokémon/NPCs are not stored as combat entities. Their HP, defenses, type effectiveness, Abilities, conditions, and other state remain outside this Companion.

The UI asks only for external outcomes that are mechanically needed by the controlled Pokémon or its Move state.

## Move Outcome model v1

Versioned documentation:

- `docs/PTU_COMBAT_MOVE_OUTCOMES.md`
- `docs/data/PTU_COMBAT_MOVE_OUTCOMES.json` — schema **1**

Deterministic implementation:

- `PTU_Companion_Windows_Source/scripts/apply_stage_b_combat_move_outcomes.py`
- invoked after the physical-dice patch by `apply_stage_b_combat_session_fixups.py`

Verification:

- `PTU_Companion_Windows_Source/scripts/verify_stage_b_combat_move_outcomes.mjs`

Generated runtime surfaces remain Windows/Android-parallel:

- `PTU_Companion_Windows_Source/static-preview/app.js`
- `PTU_Companion_Android_Tauri/www/app.js`

## Handler 1 — half-damage draining Moves

The supplied Core uses the same source-explicit rule for these eight Moves: after the target takes damage, the user gains HP equal to half of the damage actually dealt to the target.

Implemented Moves:

1. Absorb
2. Drain Punch
3. Draining Kiss
4. Dream Eater
5. Giga Drain
6. Horn Leech
7. Leech Life
8. Mega Drain

Behavior:

- `Damage actually taken by target` is requested only when one of these Moves reports a hit.
- The target remains abstract.
- The healing amount is `floor(actual target damage / 2)` because PTU Core's general decimal rule rounds down.
- Healing routes through the existing campaign `changeHp` / Form lifecycle path instead of directly editing HP outside the campaign model.
- The healing consequence is recorded in Combat history.

## Handler 2 — Fury Cutter

Supplied Core behavior represented:

- initial DB 4;
- successful consecutive damaging use on the same target: DB 4 → 8 → 12 → 16;
- DB remains capped at 16;
- miss resets the chain;
- failure to damage the target resets the chain.

Because the opposing target is abstract, no target identity is persisted. When a Fury Cutter chain already exists, the player is asked only:

`Same target as current Fury Cutter chain? Yes / No`

If the answer is No, the current use starts from DB 4 as a new sequence. The UI shows both the same-target and new-target DB/dice possibilities before the player rolls physical damage dice.

Additional local chain reset boundaries:

- using a different Move;
- Scene boundary;
- Day boundary.

These resets prevent stale sequence state from surviving unrelated actions or encounter boundaries.

## Handler 3 — Fell Stinger

After a reported hit, the UI asks whether Fell Stinger successfully knocked out the abstract target.

Only a confirmed knockout applies the source-explicit effect:

- controlled Pokémon Attack +2 Combat Stages;
- normal Combat Stage [-6,+6] bounds remain enforced;
- change is logged in Combat history.

No target HP is stored.

## Contextual outcome UI

`Damage actually taken by target` is no longer shown as a generic field for every damaging Move.

It appears only where the source-explicit handler needs that value, currently draining Moves and Fury Cutter. Fell Stinger instead asks only whether the target was knocked out. This keeps the abstract-target model minimal and avoids collecting opponent data the Companion does not own.

## Source policy

This implementation is explicit by Move and supplied PTU rule. It does not attempt to parse arbitrary Move effect prose.

That boundary is intentional: source-supported handler behavior can be tested deterministically, while a generic prose interpreter would risk silently inventing mechanics.

## Validation result

Run `36418297243` / job `108914620734` — **success**.

Validated:

- exact eight draining Move handlers;
- drain arithmetic and PTU round-down model;
- Fury Cutter 4→8→12→16 chain;
- Fury Cutter reset on miss and zero actual damage;
- new abstract target restarts Fury Cutter at DB 4 without creating an enemy entity;
- Fell Stinger target-KO outcome and Attack +2 CS path;
- physical-dice invariant retained;
- no Combat resolver digital d20 RNG;
- no Combat resolver digital damage RNG;
- contextual external-outcome fields;
- Windows/Android function parity;
- full Windows and Android regressions;
- no `.ptucp` mutation;
- `git diff --check`.

## Next recommended pass

Continue the same source-explicit pattern for Moves whose effects change only the controlled Pokémon or require a small manual external outcome.

Good candidates to audit and implement next:

1. self Combat Stage changes after use/damage, such as Close Combat and Leaf Storm;
2. self status changes after damage, such as Petal Dance;
3. effects that require an extra roll after a successful hit, such as Charge Beam — **the extra d20 must be rolled physically and entered manually**;
4. other source-explicit natural Accuracy-roll effects where the already-entered physical d20 is sufficient.

Do not introduce a generic prose interpreter or enemy entity.

After that, connect source-explicit Ability and Form `actionCost` / `frequency` to the shared Pokémon Combat ledger.

## Conservative gates retained

- Exact ten deferred Form families remain blocked: Deoxys, Giratina, Hoopa, Kyurem, Landorus, Oricorio, Rotom, Shaymin, Thundurus, Tornadus.
- Darmanitan regular Zen and Necrozma Ultra activation remain conservative/manual where supplied-source semantics are conflicting or incomplete.
- No remote artwork URL is invented.
- No bundled/default `.ptucp` mutation.
- No merge or release.
