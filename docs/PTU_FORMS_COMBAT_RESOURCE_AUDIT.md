# PTU Forms — Combat Resource Audit

> Historical checkpoint: this audit describes the application **before** the shared Combat Session Ledger was introduced. Current behavior is documented in `PTU_COMBAT_SESSION_LEDGER.md`.

Audit of the **existing** campaign combat state before any automatic spending of Form action/frequency costs.

- Conclusion: **informational only**
- Automatic spending supported by the current combat model: **No**
- Exact automatic-spending subset: **0**

The lifecycle engine may continue to return exact source labels such as `Daily`, `Scene`, `Free Action`, `Swift Action`, `Standard Action`, `Full Action`, and `Extended Action`, but the current application does not have a lossless Pokémon resource ledger in which those costs can be consumed.

## Existing state

| Resource | Existing support | Missing for automatic Form spending |
| --- | --- | --- |
| `global_round_scene_day` | time boundaries only | per-Pokémon action expenditure or per-source usage counts |
| `trainer_action_points` | Trainer AP only | Pokémon Free/Swift/Standard/Full/Extended Action economy |
| `pokemon_combat_state` | HP, THP, injuries, Combat Stages and Form state | action slots, turn expenditure, Daily/Scene usage ledger or Extended Action progress |
| `definition_frequency_text` | display/reference metadata | authoritative remaining-use counters |
| `form_lifecycle_applied_rules` | exact source labels returned to the caller | resource consumption without a ledger |

## Reset / time boundaries

- `nextRound`: increments global round only.
- `endScene`: increments scene, resets round and Combat Stages, dispatches scene-end Form events.
- `newDay`: increments day and resets scene/round only.

## Why no cost is auto-spent yet

- **Free Action:** No per-Pokémon turn/action ledger exists.
- **Swift Action:** No per-Pokémon turn/action ledger exists.
- **Standard Action:** No per-Pokémon turn/action ledger exists.
- **Full Action:** No per-Pokémon turn/action ledger exists.
- **Extended Action:** No Extended Action progress/completion model exists.
- **Daily:** No per-Pokémon/per-source Daily usage ledger exists.
- **Scene:** No per-Pokémon/per-source Scene usage ledger exists.

## Policy

- Do not infer Trainer Action Points as Pokémon action economy.
- Do not create usage counters implicitly inside the Form engine without a shared combat-resource model.
- Continue surfacing actionCost and frequency as source metadata/history.
- A future resource ledger must define reset boundaries and source identity before automatic spending is enabled.

This audit does not change any PTU source mechanics, persisted Form IDs, deferred-family status, or default content packs.
