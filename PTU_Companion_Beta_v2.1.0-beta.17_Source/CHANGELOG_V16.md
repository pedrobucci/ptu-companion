# PTU Companion — Changelog v1.6

## Visual dialog system

- Removed all browser-native `prompt()`, `confirm()`, and `alert()` usage from the functional preview.
- Added a reusable Pokédex-styled modal framework with blue/red/yellow visual accents, rounded cards, styled form fields, confirmations, warnings, and destructive actions.
- Migrated destructive and input workflows such as Pokémon deletion, Poké Edge refund, Move replacement, manual prerequisite confirmation, Held Item configuration, Roster creation, Trainer editing, GM Grants, NPC editing, revision restore, and campaign reset.

## Trainer Sheet — Phase 1

The Trainer screen is now a functional persistent sheet instead of a static mockup.

Tabs:
- Profile
- Skills
- Stats
- Features
- Edges
- Combat
- History

Implemented:
- custom Background name + PTU Skill rank adjustments;
- all 17 Trainer Skills with persistent Rank values;
- editable Basic Stats;
- calculated Trainer Max HP, Evasions, AP, Power, Overland, Swim, High Jump, and Long Jump;
- persistent Features and Edges selected from the active Ruleset definition database;
- optional Training Feature marker;
- Trainer Moves selected from the Ruleset, with no hard six-Move limit;
- Current HP, Injuries, AP, and Combat Stages;
- persistent Trainer history and GM Grants.

## Persistence

- SQLite schema migration 3 adds `trainers.details_json`.
- Background, Skill Ranks, Features, Edges, Trainer Moves, active combat state, and Trainer tab state survive restart.

## Deferred intentionally

v1.6 does **not** yet claim complete Trainer creation/progression validation. The next Trainer Engine phase will connect Feature/Edge prerequisites, starting resource budgets, classes, milestone progression, feature-granted Moves/Abilities, equipment modifiers, and Ruleset-aware retraining/respec logic.
