# Pokémon Build Rules Engine — v0.6

## Purpose

v0.6 extends the v0.5 creation engine without moving rule logic into UI components.

The server resolves the active Species definition, evolution ancestry, and current Campaign Ruleset, then calls `rules/pokemon-engine.mjs`.

## Stat allocation

The total allocation remains:

`Level + 10 Stat Points`

Nature is applied to Species Base Stats before allocated points.

### PTU Companion campaign rule: HP exemption

For this project, HP is deliberately excluded from Base Relations validation.

Consequences:

- HP may become greater or lower than any other Combat Stat;
- HP never causes another stat to violate ordering;
- HP itself is never invalidated by an ordering comparison;
- Attack, Defense, Special Attack, Special Defense, and Speed still use Base Relations normally.

This differs from the PTU Core baseline and must remain identifiable as a campaign/application rule rather than silently rewriting the source material.

Maximum HP is still calculated from the final HP Stat:

`Max HP = Level + (HP Stat × 3) + 10`

## Move sources

A Pokémon instance can now record Move provenance.

### `current_species`

Moves resolved from the selected Species' current Level-Up/Evolution Move List.

Numeric Level-Up Moves use current-level eligibility. Evolution Moves are offered but not automatically selected for direct creation.

### `pre_evolution`

Moves present on prior Species in the resolved PTU evolution ancestry.

These are exposed as historical natural choices. They are intentionally not auto-selected because direct creation does not tell the app what the individual Pokémon actually learned before evolving.

Each saved Move can retain:

- `sourceSpeciesId`
- `sourceSpeciesName`
- original learn level
- evolution-move flag

### `gm_override`

With GM Override enabled, any Move definition available in the active Campaign Ruleset may be added manually.

The rule engine does not pretend the Move is naturally compatible. It persists the source as `gm_override`.

## Evolution ancestry

`DefinitionRepository.getEvolutionAncestry()` follows safe incoming PTU evolution edges and resolves each prior Species through the active Ruleset.

The ancestry result is supplied to the build engine instead of being inferred by the browser.

## Move limit

The base Move Limit remains represented as a resolved value rather than a fixed-size array:

`effective = base 6 + modifiers`

This is important because Features and Abilities may later change the limit.
