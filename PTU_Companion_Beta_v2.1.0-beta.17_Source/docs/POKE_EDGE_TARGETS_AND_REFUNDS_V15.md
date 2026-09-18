# Poké Edge Targets & Refunds — v1.5

## Core design

Poké Edges that modify a specific Move or Capability must not store only narrative free text. v1.5 stores a stable target identity so the Modifier Engine can re-resolve the effect after reload, evolution, Ruleset changes, or stat correction.

### Advanced Mobility

The target picker is derived from the Pokémon's resolved Movement Capabilities. Examples include Overland, Swim, Sky, Burrow, Levitate, Teleporter, and supplemental numerical Movement Capabilities when present in the Species data.

Effect: selected Movement Capability +2.

The same target is removed from later Advanced Mobility target lists because the Core says the Edge cannot be applied more than once to the same Movement Capability.

### Capability Training

Valid targets are:

- Power
- High Jump
- Long Jump

Effect: selected Capability +1.

Each target can be selected only once for Capability Training.

### Accuracy Training

The target list comes from the individual's currently known Moves, not the entire Species learnset.

A Move is eligible only when its resolved source definition has base AC >= 3. Previously targeted Moves are removed from later selections.

Effect: selected Move's effective AC is reduced by 1 while its source definition remains unchanged.

## Refund model

Each newly acquired Poké Edge receives a unique `instanceId` and stores its Tutor Point cost. The correction refund removes that instance and subtracts its cost from `tutorPointsSpent`.

Derived effects are recalculated from the remaining permanent records rather than destructively editing Species data.

## Ability refresh fix

All Ruleset-backed Creature tabs now request a fresh resolved model when opened. This prevents a stale cache from hiding a newly selected Level 20/40 Ability or a granted Ability such as Twisted Power.
