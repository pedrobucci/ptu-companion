# Changelog — v0.4

## Fixed

- Storage `STORED` panel no longer occupies the obsolete 104px transfer column.
- Both Storage panels now use equal-width responsive panes.
- Stored Pokémon wrap into a complete card grid.
- Pokédex & Rules search no longer loses focus after each debounced request.
- Stale search requests are ignored when the query changes while a request is running.

## Added

- Species-linked Pokémon creation flow.
- Real Species search from the active Ruleset.
- Species preview with Base Stats, Types, Ability Slots and Level-Up Moves.
- Individual fields for nickname, level, Nature, Ability, Poké Ball, Loyalty, Maximum HP and initial location.
- SQLite schema migration 2 with `pokemon.details_json`.
- Definition provenance on created Pokémon: logical ID, version ID, Content Pack and Ruleset.
- Generic local Pokémon artwork placeholder for instances created before custom/default species art is connected.
- `VERIFY_V04.bat`.
