# Handoff — PTU Combat Source-Explicit Ability Actions 17

This handoff supersedes `HANDOFF_PTU_COMBAT_NON_MOVE_RESOURCES_16.md` for continuation.

Validated implementation checkpoint: `d75ea931e29911ccebfbb68d3e74765f71674cb0`.

Repository: `pedrobucci/ptu-companion`; branch `content/ptu-parametrized-forms-catalog`; Draft PR #11; base `feature/pokemon-shiny-d`. Keep Draft/Open. Do not merge/release without owner approval. Do not mutate bundled/default `.ptucp` while deferred Form families remain.

## Ability Action model v1

The shared non-Move resource ledger is now used by an explicit Combat Ability allowlist. Resources are keyed by source kind + source key and share the same per-Pokémon action/frequency economy as Moves and source-explicit Form actions. Resource Undo restores only spent action/frequency tokens, never already-applied game effects.

New deterministic patch: `PTU_Companion_Windows_Source/scripts/apply_stage_b_combat_ability_actions.py`.

New docs: `docs/PTU_COMBAT_ABILITY_ACTIONS.md` and `docs/data/PTU_COMBAT_ABILITY_ACTIONS.json` (schema 1).

New verifier: `PTU_Companion_Windows_Source/scripts/verify_stage_b_combat_ability_actions.mjs`.

New workflow: `.github/workflows/stage-b-combat-ability-actions.yml`.

The Combat screen now exposes `AVAILABLE ABILITIES` before Moves when an audited source-explicit Ability is known by the active Pokémon.

### Audited allowlist

- **Dodge** — `Daily – Free Action`; manually confirm the user was hit by a Damaging Move; triggering Move is logged as missing; attacker remains abstract.
- **Parry** — `Scene – Free Action`; manually confirm the user was hit by a Melee Attack; attack is logged as missing; attacker remains abstract.
- **Effect Spore** — `Scene – Free Action`; manually confirm the Melee trigger, then enter a **physical d6**: 1–2 Poisoned, 3–4 Paralyzed, 5–6 Asleep. Result is logged against the abstract attacker only; no opponent status entity is persisted.
- **Stalwart** — `Scene – Free Action, Reaction`; manually confirm Massive Damage; controlled user Attack, Special Attack, Defense and Special Defense each +1 CS with normal [-6,+6] caps.

`pokemonCombatAbilityActionSourceMatches` is a conservative source-signature guard: a content pack that keeps the name but changes the effect does not receive the audited automation.

## Existing Form/non-Move resource subset

Still wired through the same resource API:

- Schooling — `Daily – Free Action`;
- Power Construct — `Daily – Swift Action`;
- Aegislash manual Stance Change — `Full Action`;
- Ice Face Hail restore — `Standard Action`;
- Weapon Bond entry/relinquish — Extended Action remains source-labeled/informational; Extended Action progress is not mapped to Standard/Shift/Swift turn actions.

## Deliberate exclusions

Prime Fury, Hydration, Ice Body and Regal Challenge remain manual because supplied source versions conflict.

Sprint is source-consistent as an Ability but remains deferred here because its trigger is the separate **Sprint Maneuver**, which itself costs a Standard Action. Automating only the Ability's `Scene – Swift Action` would undercount action economy. Rattled/Steadfast and other playtest-changed Abilities likewise need source-resolution first.

No generic Ability prose parser, opponent entity, persistent target-status ledger, or generated dice is introduced.

## CI / validation

- Full Form/campaign rebuild: run `36449143419`, job `109019071180`, **success**.
- Dedicated Ability Actions: run `36449673641`, job `109020881791`, **success**.
- Shared non-Move resources after race-safe push fix: run `36450265241`, job `109022920510`, **success**.

Covered: all prior Form/campaign checks, shared Combat ledger, Move Outcome v2, source-keyed non-Move spending/refund, no-double-spend, Scene/Day reset, Effect Spore physical d6 mapping, Stalwart stage caps, source-signature guard, Windows/Android parity, full Windows/Android `npm run verify`, no `.ptucp` mutation, and `git diff --check`.

Earlier non-Move workflow failures in this pass were final-push races after all validations had already passed. The workflow now fetches the current branch, regenerates deterministically, and retries the generated push; final run `36450265241` is green.

## Next pass

Use **Sprint** as the first composite Maneuver + Ability integration:

1. model the Core Sprint Maneuver as a Standard Action in the Pokémon Combat ledger;
2. trigger the source-explicit Sprint Ability from that maneuver and spend its `Scene – Swift Action` without double-spending/undercounting;
3. apply +2 Speed CS;
4. distinguish Maneuver vs Ability resource transactions/refunds;
5. test insufficient Standard/Swift resources, conversion rules, Scene reset, repeated-trigger prevention, Windows/Android parity;
6. preserve abstract opponents and physical/manual dice.

Do not expand this into conflicting Ability automation until their supplied-source conflicts are explicitly resolved.
