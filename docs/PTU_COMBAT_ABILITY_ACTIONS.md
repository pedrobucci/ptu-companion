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

## Conservative exclusions

Hydration and Ice Body resolve to February 2016 but remain gated pending explicit weather/healing session semantics. Regal Challenge retains its Core definition but remains gated pending a physical AC4 attack against an abstract target. Sprint is also deferred even though its Ability text agrees across supplied sources: its trigger is the separate Sprint Maneuver, which costs a Standard Action in PTU Core, and that Maneuver is not yet modeled in this Ability action surface.
