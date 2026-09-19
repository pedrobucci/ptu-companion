# Creature Tabs, Attack Conflict and Stat Redistribution — v1.1

## Design intent

The Pokémon instance and the Species definition remain separate. The Creature Sheet displays instance state while reference tabs resolve definitions from the current Campaign Ruleset.

## Functional tabs

### Sheet
Mutable active state and the most important permanent data.

### Moves
Known Moves are joined against the resolved Move definition. The acquisition record remains on the Pokémon instance, so the UI can distinguish a natural Move from a Move learned by TM, Tutor, Natural Tutor, Egg Tutor, pre-evolution history, evolution, or GM Override.

`Move Limit` and `TM/Tutor Move Pool` are independent counters. The default non-natural pool is 3; Moves already natural to the Level-Up list and Natural Tutor Moves do not consume it.

### Abilities
The instance's Ability names are joined against active Ruleset definitions. Slot labels remain instance/progression data.

### Species
Shows Species Base Stats, Nature-adjusted Base Stats, permanent allocation, final Stats, Species Capabilities, Species Skills, Poké Edges and Base Relations exemptions.

### Type
Uses the PTU Type chart and PTU effectiveness multipliers from the definition database rather than video-game damage multipliers.

### Pokédex
Shows Species facts already present in supplied data plus exact PTU source/pack provenance. External video-game flavor-text entries are not invented.

## Attack Conflict

Attack Conflict is represented as a typed rule record:

```json
{
  "id": "attack-conflict",
  "targetStat": "attack",
  "targetNote": "Attack"
}
```

or:

```json
{
  "id": "attack-conflict",
  "targetStat": "special_attack",
  "targetNote": "Special Attack"
}
```

The Rules Engine derives `baseRelationExemptStats` from owned Poké Edges rather than trusting a duplicated user-entered flag.

## Underdog

Eligibility is derived from the resolved Species Capability list. A name containing “Underdog” in notes or prose is not enough; the parsed Capability must be present.

## Stat redistribution

The v1.1 restat endpoint accepts the existing Pokémon and a proposed full permanent allocation. Its budget is the Pokémon's recorded allocation total; if a legacy record has no allocation total it falls back to `Level + 10`.

This is deliberately separate from level-up. A level-up only allocates newly gained points; redistribution rewrites the full permanent allocation.

GM Override may bypass remaining Base Relations but does not create extra allocation points.
