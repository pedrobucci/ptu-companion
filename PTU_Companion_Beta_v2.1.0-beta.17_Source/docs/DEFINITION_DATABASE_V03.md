# PTU Definition Database & Ruleset Resolver — v0.3

v0.3 introduces the first real connection between the functional UI and the prepared PTU data handoff.

## Two databases

The prototype now intentionally uses two SQLite databases:

1. `data/ptu_companion.sqlite3`
   - writable campaign/profile state;
   - Trainer, Pokémon instances, Rosters, inventory, NPCs, revisions.

2. `seed/definitions/ptu_seed_v1.0.sqlite3`
   - read-only PTU definition seed;
   - Moves, Abilities, Capabilities, Features, Edges, Poké Edges, Items, Species;
   - Content Pack metadata;
   - Campaign Rulesets and version precedence;
   - structural tables such as Damage Base and type matchups.

A future Tauri build may copy/migrate the definition seed into an application-managed definitions database, but profile data must remain separate.

## Definition resolution

The active ruleset determines which version wins for a logical definition.

Resolution order implemented by `definitions/repository.mjs`:

1. explicit version pin;
2. definition must belong to an enabled pack;
3. highest effective ruleset priority;
4. later ruleset position breaks equal-priority ties;
5. deterministic version ID tie-break.

No source version is deleted.

## Functional UI

The sidebar now includes **Pokédex & Rules**.

This screen can:

- search resolved definitions;
- switch definition categories;
- switch Campaign Rulesets;
- show which Content Pack supplied the active version;
- show source page when available;
- inspect alternate versions;
- display Species Base Stats, Ability slots, evolution text and Level-Up Move previews;
- display Move DB/AC/Range/Frequency/Effect;
- display prerequisites/effects for Features, Edges and Poké Edges;
- display item prices and categories.

This is deliberately read-only in v0.3. Editing/importing packs remains a later milestone.

## HTTP API

New local endpoints:

- `GET /api/definitions/status`
- `GET /api/rulesets`
- `GET /api/rulesets/active`
- `PUT /api/rulesets/active`
- `GET /api/content-packs`
- `GET /api/definitions?kind=species&q=...`
- `GET /api/definitions/:kind/:logicalId`
- `GET /api/damage-base/:db`

The UI never parses PDFs or resolves rule precedence itself.
