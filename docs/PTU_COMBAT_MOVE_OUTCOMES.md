# PTU Combat Move Outcome Handlers

This layer consumes **player-reported outcomes from physical dice and an abstract opposing target**. It never creates an enemy/NPC entity and never generates dice.

## v1 handlers

### Draining Moves

Source-explicit half-damage draining is enabled for Absorb, Drain Punch, Draining Kiss, Dream Eater, Giga Drain, Horn Leech, Leech Life, and Mega Drain. On a reported hit, `Damage actually taken by target` is required. The controlled Pokémon gains half of that value in HP. PTU Core's general decimal rule rounds down, so odd damage uses `floor(damage / 2)`. Healing is routed through the campaign HP/Form path rather than bypassing it.

### Fury Cutter

The handler tracks only the controlled Pokémon's chain state: DB 4 → 8 → 12 → 16 on successful consecutive damaging uses against the same abstract target. A miss, a hit that deals 0 actual damage, a different Move, or a Scene/Day boundary resets the chain to DB 4. When a chain exists, the user confirms only whether the current Fury Cutter is against the same abstract target; no target entity or identifier is persisted.

### Fell Stinger

After a reported hit, the user confirms whether Fell Stinger knocked out the target. A confirmed knockout raises the controlled Pokémon's Attack by 2 Combat Stages, respecting normal Combat Stage bounds.

## Physical-dice invariant

Attack and damage dice are always rolled physically. The Companion records the natural d20, player-confirmed Hit/Miss and Critical result, manual Damage Roll, and only those external outcome values required by a source-explicit handler.

## Conservative boundary

Handlers are explicit by Move name and supplied PTU rule. This pass does not parse arbitrary effect prose and does not infer opponent Defense, Evasion, HP, typing, Features, Abilities, DR, conditions, or type effectiveness.
