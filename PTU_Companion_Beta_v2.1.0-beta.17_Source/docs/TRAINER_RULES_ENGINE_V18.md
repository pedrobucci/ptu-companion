# Resolved Trainer Rules Engine — v1.8

The Trainer sheet now follows the same source-to-resolution architecture used by Pokémon.

```
Base Trainer
+ Background / Skill Ranks
+ Features / Classes
+ Edges
+ GM Grants
+ Equipped Items
+ Granted Abilities / Moves / Capabilities
+ Current Combat Stages
= Resolved Trainer Model
```

The model exposes stored and effective Stats, resolved Skill expressions, Capabilities, HP/AP, Evasions, Initiative, Damage Reduction, automatic Trainer Moves, provenance and contextual effects.

Automatic effects are only executed when the source has deterministic semantics in the definition database or an explicit engine adapter. Conditional text remains visible in the contextual-effect ledger.
