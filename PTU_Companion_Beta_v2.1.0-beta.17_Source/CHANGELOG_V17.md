# PTU Companion — Changelog v1.7

## Fixed

- Trainer edit/input modals no longer close when the pointer leaves the modal or when clicking/dragging on the backdrop. Modals close only through their explicit close/cancel actions.
- Trainer sheet tab validation now includes the dedicated `Moves` tab.

## Added

- Structured GM Grant targets.
  - Resource Grants select from known Trainer build resources such as Edge, Feature, Stat Point, Skill Edge, Training Feature, and Trainer Move.
  - Fixed Grants select a concrete Trainer Stat, Skill, Capability, derived field, or Evasion field.
  - The canonical target ID is persisted with the grant so later Trainer rules/respec logic can resolve it without parsing free text.
- Multiple Trainer profiles in SQLite.
  - Create a new Trainer profile.
  - Switch active Trainer from the top-right Trainer badge.
  - Each profile keeps separate Pokémon, Rosters, Backpack, NPC notes, Shop state, and Trainer sheet.
- Trainer sheet reset/correction workflow.
  - Resets the active Trainer mechanical build while preserving campaign assets and GM Grants.
- Dedicated Trainer `Moves` tab.
  - No fixed Move-slot limit.
  - Move provenance stored as Feature, Edge, Weapon, GM Grant, Ruleset, or Manual source.
  - Ruleset Move definitions are searchable and linked to the Trainer record.
- Empty-state handling for newly created profiles without Pokémon or NPCs.

## Persistence/API

- `GET /api/profiles`
- `POST /api/profiles`
- `PUT /api/profiles/active`
- Repository profile listing/switching support.

No database schema migration was necessary; the existing `profiles` / `trainers` model already supported multiple Trainer records.
