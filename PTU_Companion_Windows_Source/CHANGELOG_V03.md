# Changelog — v0.3

## Fixed

- Pokémon Storage no longer collapses visually to a single-card-wide Stored pane.
- Carried and Stored collections now use equal flexible space on desktop.
- Pokémon cards wrap through `auto-fill/minmax` instead of forcing four squeezed columns.
- narrow layouts stack the storage panes vertically.

## Added

- read-only PTU definition SQLite database from the prepared v1.0 handoff;
- `DefinitionRepository` separated from campaign persistence;
- Campaign Ruleset resolution with enabled-pack priority and version-pin support;
- real Pokédex & Rules UI screen;
- real searchable Moves, Abilities, Features, Edges, Poké Edges, Capabilities, Items and Species;
- source Content Pack and page provenance;
- alternate-version visibility;
- Ruleset switching from the UI;
- definition HTTP API;
- Damage Base lookup endpoint;
- definition inspection utility;
- v0.3 verification suite.

## Architectural boundary

Campaign state remains writable and separate from the read-only definition seed. No UI component is allowed to decide source precedence itself.
