# PTU Forms — Combat Resource Audit

**Historical checkpoint:** this document records the application state before the shared Pokémon Combat ledger was introduced. Current behavior is documented in `docs/PTU_COMBAT_SESSION_LEDGER.md` and the non-Move resource model.

- Historical conclusion: **informational only**
- Automatic spending supported at this historical checkpoint: **No**
- Exact automatic-spending subset: **0**

At this checkpoint, the lifecycle engine could return exact source labels such as `Daily`, `Scene`, `Free Action`, `Swift Action`, `Standard Action`, `Full Action`, and `Extended Action`, but the application did not yet have a lossless Pokémon resource ledger in which those costs could be consumed.

## Historical state

| Resource | Existing support | Missing for automatic Form spending |
| --- | --- | --- |
| `global_round_scene_day` | time boundaries only | per-Pokémon action expenditure or per-source usage counts |
| `trainer_action_points` | Trainer AP only | Pokémon Free/Swift/Standard/Full/Extended Action economy |
| `pokemon_combat_state` | HP, THP, injuries, Combat Stages and Form state | action slots, turn expenditure, Daily/Scene usage ledger or Extended Action progress |
| `definition_frequency_text` | display/reference metadata | authoritative remaining-use counters |
| `form_lifecycle_applied_rules` | exact source labels returned to the caller | resource consumption without a ledger |

## Historical reset / time boundaries

- `nextRound`: increments global round only.
- `endScene`: increments scene, resets round and Combat Stages, dispatches scene-end Form events.
- `newDay`: increments day and resets scene/round only.

## Why no cost was auto-spent at this checkpoint

- **Free Action:** No per-Pokémon turn/action ledger existed at this checkpoint.
- **Swift Action:** No per-Pokémon turn/action ledger existed at this checkpoint.
- **Standard Action:** No per-Pokémon turn/action ledger existed at this checkpoint.
- **Full Action:** No per-Pokémon turn/action ledger existed at this checkpoint.
- **Extended Action:** No Extended Action progress/completion model existed at this checkpoint.
- **Daily:** No per-Pokémon/per-source Daily usage ledger existed at this checkpoint.
- **Scene:** No per-Pokémon/per-source Scene usage ledger existed at this checkpoint.

## Historical policy

- Do not infer Trainer Action Points as Pokémon action economy.
- Do not create usage counters implicitly inside the Form engine without a shared combat-resource model.
- Continue surfacing actionCost and frequency as source metadata/history.
- A shared resource ledger must define reset boundaries and source identity before automatic spending is enabled.

This historical audit does not change any PTU source mechanics, persisted Form IDs, deferred-family status, or default content packs.
