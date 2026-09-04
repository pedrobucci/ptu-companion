# PTU Companion — Technical Specification

Version: 1.0 (final implementation handoff)  
Target: Windows 10/11 and Android 10+  
Primary ruleset: Pokémon Tabletop United 1.05 with selectable supplements, playtests, unofficial Pokédex material, and campaign homebrew.

## 1. Product goal

PTU Companion is an offline-first digital character-sheet and rules companion for Pokémon Tabletop United. It replaces most paper-sheet bookkeeping while intentionally leaving physical dice rolls and narrative adjudication at the table.

The application shall manage:

- Trainer creation, advancement, retraining, equipment, inventory, money, moves, edges, features, abilities, capabilities, temporary/permanent modifiers, and combat state.
- Pokémon species data and individual Pokémon sheets, including stats, moves, abilities, capabilities, loyalty-relevant capture information, images, progression, injuries, combat state, rosters, and storage.
- Multiple simultaneously active rosters, configurable by campaign purpose and restrictions. A single Pokémon may belong to multiple rosters.
- A separate item storage and Trainer backpack.
- Item shops, shop presets, buying, selling, variable prices, and inventory transfer.
- NPC notes with tags, descriptions, affiliation, favorites, and optional image.
- A searchable rules library.
- GM-authored content and permanent campaign grants/overrides.
- Portable Trainer/content exports that work fully offline.

The application does **not** roll dice or adjudicate attack results. It does calculate all deterministic values available before a roll, such as final Move DB, STAB-adjusted DB, final damage expression, AC modifiers, derived stats, type matchups, and equipment-derived variants.

## 2. Source/rules philosophy

The data model must separate **definitions** from **instances** and **campaign overrides**.

### 2.1 Definition layers

Default precedence is configurable by a Campaign Ruleset. Seed priority is only a suggested starting point.

1. PTU 1.05 Core
2. Official supplements
3. Official playtest packets selected by the GM
4. Unofficial Pokédex/update packs selected by the GM
5. Campaign/homebrew content packs
6. GM overrides

No imported source record is destructively edited. A change creates a new version/override with provenance.

### 2.2 Provenance

Every rule definition and every permanent character change must be traceable to a source:

- `core`
- `supplement`
- `playtest`
- `unofficial_pokedex`
- `homebrew_pack`
- `gm_grant`
- `level_progression`
- `item`
- `feature`
- `edge`
- `ability`
- `manual_correction`

The UI should expose provenance when the user taps/clicks a derived value or a GM-modified marker.

## 3. Recommended technology stack

### 3.1 Desktop/mobile shell

- **Tauri 2**
- Rust stable
- Targets:
  - Windows x86_64 installer / portable build where feasible
  - Android arm64-v8a release APK first; optional universal APK later

Tauri is preferred because it permits one UI codebase, native file access, local SQLite, compact binaries, and Android/Windows packaging.

### 3.2 Frontend

- React 19 + TypeScript
- Vite
- Zustand for ephemeral UI state
- TanStack Query for async Tauri command state/cache invalidation
- React Router
- CSS variables/design tokens; no heavyweight component suite required
- Virtualized lists for Pokédex/rules/storage search

### 3.3 Rust application layer

Recommended crates:

- `tauri`
- `serde`, `serde_json`
- `rusqlite` with bundled SQLite and FTS5 where supported, or `sqlx` SQLite if async migrations are preferred
- `uuid`
- `chrono`
- `zip`
- `sha2`
- `image` for user-image import/downscale/WebP conversion
- `thiserror`

Keep domain/rules code independent from Tauri commands so it can be unit-tested without a UI runtime.

### 3.4 Persistence

- SQLite is the canonical runtime store.
- JSON is the canonical interchange/content-authoring format.
- CSV is a review/editing convenience format only; it must not be the canonical format for complex records.
- User images are files referenced by UUID/path, not BLOBs in normal tables.

## 4. High-level architecture

```text
React/TypeScript UI
        |
Tauri command boundary
        |
Rust application services
  |       |       |       |
Rules   Modifier  Progression  Inventory
Engine  Engine    Engine       Service
  |       |       |       |
Validation / Provenance / History
        |
Repository layer
        |
SQLite + image files + import/export archives
```

Hard rule: UI components must not contain PTU rules. They request a resolved view model from the Rust domain layer.

## 5. Core domain concepts

### 5.1 Definition vs instance

Examples:

- `MoveDefinition`: universal definition of Crunch.
- `ResolvedMove`: Crunch after applying the current Pokémon/Trainer, STAB, equipment, features, and modifiers.
- `PokemonSpeciesDefinition`: Bulbasaur species mechanics.
- `PokemonInstance`: one captured Bulbasaur with level, Nature, chosen abilities, learned moves, etc.
- `ItemDefinition`: Potion definition.
- `InventoryStack`: 7 Potions in one Trainer backpack.

Definitions are content. Instances are character state.

### 5.2 IDs

Never use displayed Pokédex number/name as a primary key.

Use UUIDs for instances and stable slug IDs for shipped definitions.

Species/form display identifiers may be rendered as `151`, `151-1`, `151-2`, etc. but the database uses a stable definition ID.

Suggested fields:

```json
{
  "id": "species:rapidash:galar",
  "national_dex_number": 78,
  "variant_index": 1,
  "variant_of": "species:rapidash:base",
  "variant_kind": "regional",
  "display_name": "Galarian Rapidash"
}
```

Homebrew regional variants may use the same model.

## 6. Campaign Ruleset

A Campaign Ruleset selects and orders content packs.

```json
{
  "id": "campaign-ruleset-main",
  "name": "Current Campaign",
  "packs": [
    {"id":"ptu-core-1.05","enabled":true,"priority":100},
    {"id":"game-of-throhs","enabled":true,"priority":110},
    {"id":"feb-2016-playtest","enabled":true,"priority":130},
    {"id":"gen8ish-pokedex","enabled":true,"priority":140},
    {"id":"campaign-homebrew","enabled":true,"priority":200}
  ]
}
```

When two records share a logical definition ID, the highest enabled version wins unless the ruleset explicitly pins a version.

The application must retain all versions so a GM can compare/revert them.

## 7. Trainer model

Major persisted groups:

- identity: name, gender, age, height, weight, description, portrait
- level / EXP
- background name and background skill changes
- combat stats
- skills
- AP state
- HP / temp HP / injuries / combat state
- capabilities
- edges
- features/classes
- abilities
- unlimited Trainer Move list
- equipment slots
- backpack
- item storage
- money
- progression ledger by level
- GM grants
- modifiers
- NPC notebook
- history timeline

### 7.1 Background

Background is free-form and rule-validated, not selected from a mandatory predefined list.

Persist:

```json
{
  "name": "Former Investigator",
  "raised_skills": ["perception", "intuition"],
  "lowered_skills": ["charm"]
}
```

The rules engine decides whether the chosen configuration is legal for the active ruleset.

## 8. Pokémon model

### 8.1 Species definition

Species/form definitions must support all PTU mechanical fields exposed by the supplied Pokédex material:

- types
- base stats
- Basic / Advanced / High ability slots
- evolution data
- height/size
- weight/weight class
- gender ratio
- egg groups
- hatch information where present
- diet
- habitat
- capabilities
- skills
- level-up move list
- TM/HM list
- egg move list
- tutor move list
- form/mega/special-form data
- source/provenance
- completeness/enabled status

Additional non-PTU display fields:

- Pokédex flavor entries, each with game/language/source
- type defense matrix: immunity/resistance/neutral/weakness
- sprite/image references

Species without complete PTU mechanics may exist with `enabled_for_character_creation=false` and remain browseable/editable.

### 8.2 Pokémon instance

Persist permanent state:

- species/form definition ID
- nickname
- capture Poké Ball type
- gender
- level/EXP
- Nature
- stats and stat-point allocation
- skills and permanent skill adjustments
- abilities
- learned moves and move source
- Tutor Points
- Poké Edges
- permanent capabilities
- loyalty
- permanent GM grants/modifiers
- custom image reference
- history

Persist dynamic state only while carried/active:

- current HP
- temp HP
- Combat Stages
- status conditions
- frequency-use counters
- scene/round effects

### 8.3 Storage invariant

A Pokémon with one or more Injuries **cannot enter Pokémon Storage**.

This invariant is not bypassed by ordinary GM Override.

When a Pokémon enters Storage:

- dynamic battle state is cleared/reset;
- Held Item is moved back to the Trainer backpack;
- permanent data remains;
- custom image remains on disk but storage lists should use lightweight default imagery;
- roster memberships may be preserved as presets but are marked unavailable while stored.

Heavily Injured is displayed according to the active ruleset but does not by itself prevent returning to a Poké Ball unless a campaign rule adds that restriction.

## 9. Rosters

Roster is a logical collection/preset, **not** the Pokémon storage state.

Requirements:

- zero or more rosters may be active simultaneously;
- default capacity may be 6 but capacity is data-driven;
- a Pokémon may belong to multiple rosters;
- a roster may define purpose, affiliation, icon, notes, allowed uses, restrictions, and max members;
- a membership may override/add restrictions for that Pokémon.

Example:

```json
{
  "name":"Company Team",
  "active":true,
  "max_members":6,
  "rules":{
    "combat":true,
    "personal_use":false,
    "trade":false,
    "mount":true
  }
}
```

## 10. Inventory/equipment

Distinct locations:

- Trainer backpack
- Trainer item storage
- equipped Trainer slots
- Pokémon Held Item

Trainer equipment slots must be data-driven but seed with PTU slots such as Head, Body, Main Hand, Off-Hand, Feet, Accessory.

An item definition can declare:

- categories
- usable_by: Trainer / Pokémon / both
- equippable slots
- consumable flag
- base price
- description
- structured modifiers/effects
- narrative/conditional effects

If a Pokémon enters Storage, its Held Item returns to the Trainer backpack.

## 11. Shop system

Support:

- categorized PTU catalog
- persistent Shop Presets
- available/unavailable items
- global buy multiplier
- global sell multiplier (default 0.5)
- item-specific buy/sell override
- transaction-specific override
- cart checkout
- atomic money deduction/addition + inventory mutation
- transaction history

Checkout must be one database transaction.

## 12. NPC notebook

NPC fields:

- UUID
- name
- tags/characterizers
- description
- notes
- affiliation
- favorite
- optional image
- first-seen timestamp/session note

## 13. Active combat sheet

The app tracks state but does not roll dice.

Controls:

- current HP / temp HP
- injuries
- status conditions
- Combat Stages
- AP / Bound AP / Drained AP for Trainer
- move/feature/ability usage counters
- `Next Round`
- `End Scene`
- `New Day`

Each resource definition must use structured reset metadata, not string parsing at runtime.

Example:

```json
{
  "frequency": {"scope":"scene","uses":2,"cooldown":"none"}
}
```

The original `frequency_text` is retained for display/source fidelity.

## 14. Resolved Move model

The database stores MoveDefinition. The rules engine generates ResolvedMove.

```text
Move Definition
 + actor attack/sp.attack
 + STAB
 + feature/edge/ability modifiers
 + equipment/weapon modifiers
 + temporary/permanent modifiers
 = Resolved Move
```

ResolvedMove should contain at minimum:

```json
{
  "move_id":"move:crunch",
  "display_name":"Crunch",
  "final_type":"Dark",
  "final_class":"Physical",
  "final_ac":2,
  "base_db":8,
  "final_db":10,
  "damage_expression":"3d8+31",
  "range":"Melee, 1 Target",
  "frequency":"EOT",
  "modifier_breakdown":[]
}
```

For Trainer Moves, equipment-compatible Weapon Moves may expose both normal and weapon-resolved variants. A toggle selects the presentation; equipping another weapon triggers recalculation.

Trainer moves have no hardcoded maximum collection size. Pokémon move limits are supplied by rules and may be altered by Abilities/Features/Edges/modifiers.

## 15. Modifier Engine

This is a central subsystem.

A modifier contains:

- source
- target path
- operation
- value
- optional condition
- duration
- stacking group/rule
- priority
- provenance

Supported operations should include:

- add
- multiply
- set
- min/max clamp
- type-resistance step adjustment
- grant/remove entity/capability/move

Example:

```json
{
  "id":"gm-123",
  "source":{"kind":"gm_grant","id":"grant-123"},
  "target":"trainer.skills.stealth.bonus",
  "operation":"add",
  "value":2,
  "duration":"permanent",
  "priority":500
}
```

Do not persist a derived final value as the sole truth. Persist inputs/modifiers and compute the resolved value. Materialized caches may be stored for performance but must be rebuildable.

### 15.1 Explainability

Every resolved numeric field should support an explanation list, e.g.:

```text
Stealth 5d6+2
Base Rank             3d6
Skill Edge            +1 rank
GM Permanent Grant    +2 bonus
Equipment             +1 bonus
Temporary Effect      -1 bonus
```

## 16. GM Grants and GM Override

GM Override is available on both Windows and Android.

Two persistent grant types:

### Fixed Grant

Bound to a specific result/property until edited/removed by GM.

Examples:

- +2 Stealth permanent
- grant a specific Move
- add a specific Capability

### Resource Grant

Adds a build resource that may be reallocated during an authorized respec.

Examples:

- +1 Edge choice
- +1 Feature choice
- +2 Stat Points

A Resource Grant stores its origin independently from its current allocation.

GM changes are displayed with a small indicator and provenance popover.

No authentication/PIN is required for v1; architecture should permit future protection.

## 17. Progression and respec

### 17.1 Trainer

Implement a guided Character Creation wizard and Level-Up wizard. The engine reads progression rules from the active ruleset. Do not hardcode unlocks in UI components.

Progression ledger stores, per level:

- stat point allocations
- Edge/Feature choices
- milestone selections
- retraining changes

### 17.2 Pokémon

Level-up workflow identifies:

- stat points
- new level-up moves
- evolution eligibility
- Tutor Point awards
- Ability unlocks
- Poké Edge opportunities

It must validate Base Stat Relation according to active ruleset and active overrides.

### 17.3 Respec

Respec rebuilds normal progression allocations while preserving external grants unless the grant itself is explicitly removed.

## 18. History model

Maintain two related views:

1. **Progression ledger**: structured mechanical history by level.
2. **Timeline**: important events and edits.

Suggested timeline event types:

- level_up
- evolution
- gm_grant_added/edited/removed
- retrain
- item_purchase/sale
- storage_transfer
- roster_change
- ruleset_change
- import

History is append-oriented. Undo may create compensating events rather than deleting history.

## 19. Search/UI architecture

Use virtualized lists and SQLite FTS5 for:

- Pokédex
- Moves
- Abilities
- Capabilities
- Edges
- Poké Edges
- Features
- Items

Search should support name, type/category, tags, source, and description text.

General UX pattern:

- compact cards
- icons and abbreviations
- tabs for dense sheets
- desktop popovers/tooltips for descriptions
- Android bottom sheets/modals for descriptions
- no giant always-expanded rule text

Example Pokémon tabs:

- Sheet
- Moves
- Abilities
- Species
- Type
- Pokédex
- History

## 20. Images

Default imagery should be lightweight and offline.

Custom Pokémon images are permitted only for owned Pokémon/roster use.

On import:

1. decode selected image;
2. enforce reasonable maximum dimensions;
3. create app-managed WebP derivative;
4. store derivative under application data by UUID;
5. keep only reference metadata in SQLite.

Do not eagerly load custom images for storage/Pokédex lists.

NPC images use the same image service.

## 21. Content editor (Windows)

Windows exposes full content authoring UI for:

- Species/Form
- Moves
- Abilities
- Items
- Edges
- Poké Edges
- Features
- Capabilities
- Shop catalog/presets
- Ruleset management

Android consumes/imports content packs and allows character/GM sheet changes, but v1 does not need the full structural rule editor.

Editor validates schemas and shows references before publishing a pack.

## 22. Import/export formats

### 22.1 Content Pack: `.ptucp`

A `.ptucp` file is a ZIP archive with no encryption in v1.

```text
manifest.json
content/
  moves.ndjson
  abilities.ndjson
  capabilities.ndjson
  edges.ndjson
  poke_edges.ndjson
  features.ndjson
  items.ndjson
  species.ndjson
  shops.ndjson
assets/
  ...optional images...
```

Manifest includes:

```json
{
  "format":"ptu-content-pack",
  "format_version":1,
  "id":"campaign-homebrew",
  "name":"Campaign Homebrew",
  "version":"1.0.0",
  "priority":200,
  "dependencies":[],
  "sha256":{}
}
```

NDJSON is recommended inside packs because records can be streamed and individually validated.

### 22.2 Trainer Pack: `.ptutrainer`

ZIP archive:

```text
manifest.json
trainer.json
pokemon.ndjson
rosters.json
inventory.json
npcs.json
history.ndjson
embedded_content/
assets/
```

Any custom definition referenced by the exported Trainer must be embedded unless the exporter explicitly chooses a dependency-only export.

### 22.3 Full backup: `.ptubackup`

ZIP archive containing all Trainers, content packs, campaign rulesets, application settings, and referenced assets.

### 22.4 Seed binary

The data bundle delivered with this specification includes `ptu_seed.sqlite3`. This is a **build-time seed/reference database**, not a user-save database.

Recommended install behavior:

1. ship `ptu_seed.sqlite3` as an application resource;
2. on first run, copy/import seed definitions into the writable application database;
3. store `seed_dataset_version` in metadata;
4. future app updates perform idempotent definition migrations/upserts while preserving user overrides.

Do not write user state into the shipped seed file.

## 23. SQLite schema outline

Suggested definition tables:

- `content_sources`
- `content_packs`
- `definition_versions`
- `moves`
- `abilities`
- `capabilities`
- `edges`
- `poke_edges`
- `features`
- `items`
- `species`
- `species_move_lists`
- `species_ability_slots`
- `pokedex_entries`
- `type_chart`

Suggested character-state tables:

- `trainers`
- `trainer_progression`
- `trainer_moves`
- `trainer_edges`
- `trainer_features`
- `trainer_abilities`
- `trainer_capabilities`
- `pokemon_instances`
- `pokemon_moves`
- `pokemon_abilities`
- `pokemon_poke_edges`
- `pokemon_capabilities`
- `rosters`
- `roster_memberships`
- `inventory_stacks`
- `equipment_slots`
- `modifiers`
- `gm_grants`
- `combat_states`
- `usage_counters`
- `shops`
- `shop_items`
- `transactions`
- `npcs`
- `history_events`
- `assets`

Use foreign keys. Use soft-delete or inactive flags for user-authored definitions referenced by historical records.

## 24. Type effectiveness

Type defense should be precomputed/cached for display but derived from a versioned type chart.

Species type tab should display grouped categories such as:

- immune
- resistant
- neutral
- weak

Do not bake the chart into UI code.

## 25. Validation Engine

Validation returns structured issues rather than throwing for normal user mistakes:

```json
{
  "severity":"error",
  "code":"POKEMON_STORAGE_INJURED",
  "message":"Pokémon with Injuries cannot enter Storage.",
  "override_allowed":false
}
```

Other violations normally support GM Override:

```json
{
  "severity":"error",
  "code":"EDGE_PREREQUISITE_NOT_MET",
  "override_allowed":true
}
```

A successful override creates persistent provenance/history.

## 26. Performance requirements

Target behavior on mid-range Android hardware:

- app usable offline after first launch;
- launch should not deserialize the entire Pokédex into memory;
- search results should be paginated/virtualized;
- use FTS indexes and database queries;
- only active Trainer plus compact summaries of archived Trainers are loaded;
- only visible roster Pokémon load full active sheets;
- custom images lazy-load;
- derived values may use cache keyed by `(entity_revision, ruleset_revision)`.

Profiles are independent save roots logically even if stored in one SQLite database. Opening one Trainer must not hydrate all archived Trainer data.

## 27. Security/data integrity

- local-only, no account/server required;
- imports must validate archive paths to prevent ZIP path traversal;
- JSON/NDJSON validated against schema before persistence;
- import into temporary staging tables/transaction then commit atomically;
- SHA-256 hashes in pack manifests;
- never execute scripts from content packs;
- user text is data only;
- database migrations are versioned and tested.

## 28. Seed-data quality policy

The supplied seed files were extracted from the PDFs using deterministic text parsing. PDF layout, particularly multi-column class/feature pages, can produce extraction ambiguity.

Therefore:

- every record keeps source provenance and raw text where useful;
- `needs_review=true` means the agent must not silently treat the parsed structure as unquestionably authoritative;
- versioned JSON files preserve multiple source versions;
- canonical JSON files use a seed priority only as a convenience;
- campaign ruleset precedence is authoritative at runtime;
- missing data remains nullable/incomplete rather than guessed.

The agent should prioritize code construction over manually retyping rules, and perform targeted review only for records marked incomplete/ambiguous.

## 29. Testing strategy

### Rust unit tests

- modifier stacking
- STAB/DB resolution
- damage-expression lookup
- BSR validation
- GM grant persistence across respec
- storage injury invariant
- held-item return on storage transfer
- round/scene/day reset behavior
- roster multi-membership
- shop atomic checkout/sell
- import precedence/version resolution

### Integration tests

- create Trainer from scratch
- level Trainer several times
- import Pokémon from species definition
- add Pokémon to two simultaneous rosters
- enter/leave storage
- equip item and observe resolved values
- export/import Trainer with embedded homebrew

### UI E2E

- Android compact navigation
- large searchable Pokédex
- move/ability description modal
- GM Override path
- offline file picker import/export

## 30. Recommended implementation order

1. Workspace/Tauri 2 Windows + Android skeleton.
2. SQLite migrations/repositories.
3. Import the provided seed database/content JSON.
4. Ruleset/content-version resolver.
5. Trainer/Pokémon core domain.
6. Modifier + explainability engine.
7. Character creation/progression validators.
8. Pokédex/rules search screens.
9. Rosters/storage/combat state.
10. Inventory/equipment/shops.
11. GM grants/history/respec.
12. Import/export packs.
13. Windows content editor.
14. Android optimization and packaging.
15. Targeted cleanup of `needs_review` seed records.

## 31. Non-goals for v1

- online accounts/cloud synchronization
- multiplayer networking
- dice roller
- automated combat resolution
- GM campaign server
- full structural content editor on Android

## 32. Acceptance criteria for first useful release

The first release is useful when a player can:

1. create/load one active Trainer;
2. use a rules-valid creation wizard with GM override;
3. add Pokémon from the catalog;
4. manage at least two simultaneously active rosters with overlapping membership;
5. manage Pokémon storage with the injury invariant;
6. use the active combat sheet without physical paper bookkeeping;
7. see precomputed Move damage expressions and STAB/equipment variants;
8. search Moves/Abilities/Edges/Capabilities/Pokédex quickly offline;
9. buy/sell/equip/store items and track money;
10. level Trainer/Pokémon with guided unresolved-choice indicators;
11. preserve GM grants through respec;
12. export/import the Trainer and any referenced homebrew content.



## 33. Final handoff data contract (v1.0)

The implementation MUST bootstrap rule content from the `.ptucp` files in this handoff. `seed/ptu_seed_v1.0.sqlite3` is a build/reference snapshot and must not be used as the writable Trainer database. On first run/app upgrade, import definitions into versioned runtime tables or ship a read-only definitions database beside the writable profile database.

Required content fields include logical ID, definition version ID, content pack ID, source provenance, quality flags, raw/source text where available, and compiled semantics where safe.

The final bundle contains deterministic test vectors. Those vectors are acceptance contracts for the rules layer, especially STAB/DB resolution, progression, GM grants, storage invariants, overlapping Rosters, content-version resolution, and shop arithmetic.

## 34. Runtime database separation

Recommended physical split:

```text
definitions.sqlite   read-mostly imported content/version/search indexes
profiles.sqlite      Trainer/Pokémon/NPC/shop/history state
media/               portraits and custom Pokémon/NPC images
```

A single SQLite file is acceptable for v1 only if archived profiles are not eagerly hydrated and definition updates are transactionally isolated from user state. Never overwrite user state by replacing the seed DB.

## 35. `.ptucp` import transaction

1. Open archive with ZIP-slip/path traversal checks.
2. Parse `manifest.json`; reject unsupported `format_version`.
3. Verify every manifest SHA-256 before parsing payload.
4. Validate JSON/NDJSON records.
5. Check required pack dependencies.
6. Stage all rows in a transaction/temp tables.
7. Upsert by `definition_version_id`; never overwrite a different source version.
8. Rebuild/refresh FTS indexes.
9. Re-resolve affected Campaign Rulesets.
10. Commit atomically; rollback on any error.

Scripts inside packs are never executed.

## 36. Resolved Move acceptance contract

For a damaging Move, deterministic display resolution is:

```text
base DB
→ multi-strike DB rule when applicable
→ DB modifiers such as STAB
→ damage-chart expression
→ add Attack or Special Attack and static bonuses
→ display expression
```

Do not subtract target Defense or apply effectiveness until presenting a target-specific preview; the normal sheet Move card should represent the attacker's pre-roll expression. No dice are rolled by the application.

Required fixture: DB4 Dark Physical Move, Dark user, Attack 15 => STAB DB6 => `2d6+23`.

## 37. Quality/fallback behavior

- Unknown values are nullable, never coerced to zero.
- `needs_review=true` must not be hidden.
- `manual_text` effects are not auto-applied.
- `hybrid` effects apply only explicitly structured atoms.
- Incomplete species remain browseable but not selectable for character creation unless a GM-authored complete definition/override is active.
- Source mechanics are not silently “corrected” to videogame canon.

## 38. External Pokédex display enrichment

The supplied PTU documents do not contain the complete console-game Pokédex flavor corpus. The model supports flavor entries, but the final seed deliberately omits that corpus. A separately licensed/user-supplied content pack may add records with `species_key`, `game`, `language`, `text`, and `source_id`.

Likewise, older National Dex numbers should be imported from a factual species mapping rather than guessed from Gen8ish PDF order. A build-time importer is included in the handoff.

## 39. Final acceptance gates

Before a release candidate is considered usable:
- all JSON and manifests parse;
- all `.ptucp` hashes verify;
- SQLite integrity check passes;
- test vectors pass;
- Trainer profile can be created, closed, reopened without loading archived profiles;
- one Pokémon can belong to two active Rosters;
- injured Pokémon Storage transfer is rejected;
- healthy transfer returns Held Item to Backpack and clears dynamic battle state;
- GM Resource Grant survives respec;
- Windows editor can create a new definition version/content pack;
- Android can import that pack and use it offline.

## 40. Handoff files

Use `README_FIRST.md` as the authoritative file map. `DATA_QUALITY_REPORT_v1.0.md` and `KNOWN_GAPS_v1.0.md` describe what remains deliberately manual/incomplete.
