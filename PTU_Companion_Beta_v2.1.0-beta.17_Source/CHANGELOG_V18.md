# PTU Companion v1.8 — Resolved Trainer Rules Engine

v1.8 makes Trainer build sources mechanically participate in the rest of the sheet instead of being passive labels.

## Added

- `rules/trainer-engine.mjs` resolved Trainer model.
- Feature Stat Tags and supported compiled modifiers affect effective Stats.
- Edges, Features, GM Grants and equipment can affect Skills, Capabilities, Evasions, DR and derived values.
- deterministic granted Moves are collected automatically with provenance.
- Trainer Move damage is resolved in the Combat tab from Damage Base, Physical/Special Stat, current Combat Stages, STAB and supported modifiers.
- contextual effects remain explicitly contextual instead of being applied permanently.
- choice-dependent effects expose unresolved choices to the UI rather than guessing.

## Design rule

Stored build data remains the source of truth. `Resolved Trainer` is a derived view rebuilt from active sources. Removing a source therefore removes its automatic contribution without destructive reverse-mutations.
