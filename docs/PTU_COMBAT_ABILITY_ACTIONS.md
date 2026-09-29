# PTU Combat Ability Actions

This layer exposes an explicit allowlist of **source-backed Pokémon Abilities** in the Combat screen. It reuses the same per-Pokémon action/frequency ledger already used by Moves and Form actions. It does not parse arbitrary Ability prose.

## Audited allowlist

- **Dodge** — `Daily – Free Action`; when the user is hit by a Damaging Move, the triggering Move instead misses. The trigger is confirmed manually and no attacker entity is created. Source: PTU Core p.316.
- **Parry** — `Scene – Free Action`; when the user is hit by a Melee Attack, the attack instead misses. The trigger is confirmed manually and no attacker entity is created. Source: PTU Core p.325.
- **Effect Spore** — `Scene – Free Action`; when the user is hit by a Melee Attack, roll **1d6**. The roll is always physical/manual: 1–2 Poisoned, 3–4 Paralyzed, 5–6 Asleep. The result is logged for the abstract attacker only; no opponent status record is persisted. Source: PTU Core p.316.
- **Stalwart** — `Scene – Free Action, Reaction`; when the user receives Massive Damage, its Attack, Special Attack, Defense and Special Defense each rise by +1 Combat Stage. Source: New Abilities and Moves p.3.

## Source signature guard

Automation is enabled only when the active Ruleset Ability effect still matches the conservative signature audited above. A content pack that replaces one of these Ability definitions with materially different text leaves the Ability manual instead of silently applying the wrong mechanics.

## Physical-dice and abstract-target invariants

Effect Spore never rolls digitally. The player rolls the d6 physically and enters the result. Dodge and Parry record only that the triggering attack is treated as a miss. Effect Spore records only the resulting status label against an abstract attacker. No enemy HP, defenses, conditions, action ledger or entity is created.

## Shared resource / Undo behavior

Ability frequency and action costs use `pokemonCombatSpendNonMoveResource`, including source-keyed Scene/Daily counters and the existing correction/refund UI. `Undo` corrects only the action/frequency spend; it deliberately does not rewind Stalwart Combat Stages or an already-recorded abstract outcome.

## Source-precedence integration

**Prime Fury** resolves to the February 2016 definition: `Scene – Swift Action`, becoming Enraged and gaining +1 Attack and +1 Special Attack Combat Stage. It is an explicit controlled-Pokémon action using the same ledger; Undo remains resource-only.

## Resolved February 2016 actions

- **Hydration** — `Scene – Swift Action`; cures one Status Affliction. During Rainy Weather its frequency is ignored, but the Swift Action remains. Weather and the supported Status Afflictions are tracked explicitly; no prose parser or inferred condition detection is used.
- **Ice Body** — `Daily x5 – Swift Action`; heals one Tick (1/10 maximum HP, rounded down to whole HP with a minimum of 1). Usable only below 50% HP or during Hail. Its Hail HP-loss immunity is displayed as a rules reminder; damage resolution remains manual. Source: February 2016 Playtest Packet p.6; Tick value from PTU Core p.237.

These later definitions supersede the earlier Core definitions under the documented source order. Both use the shared ledger; resource Undo does not rewind cured afflictions or HP.

## Conservative exclusions

Regal Challenge retains its Core definition but remains gated pending a physical AC4 attack against an abstract target. Sprint is deferred: its trigger is the Sprint Maneuver, which costs a Standard Action in PTU Core, and that Maneuver is not yet modeled in this Ability action surface.

## Composite Quick Curl + Defense Curl

Quick Curl is integrated through a dedicated composite layer rather than the standalone Ability allowlist. Its `Scene – Free Action` resource and Defense Curl's overridden Swift Action are spent through the same shared ledger. The normal Defense Curl Move remains unchanged. See `PTU_COMBAT_QUICK_CURL.md`.
