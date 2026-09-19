# Data Persistence Architecture — v0.2

## Goal

Move PTU Companion from browser-only persistence toward the architecture planned for the desktop application while keeping the current frontend immediately runnable.

## Runtime

```text
Browser UI
   |
   | HTTP JSON
   v
Node local server
   |
   v
CampaignRepository
   |
   v
SQLite: data/ptu_companion.sqlite3
```

If the local server is not present, the browser UI falls back to localStorage so the prototype remains viewable.

## SQLite tables

- `profiles`
- `trainers`
- `pokemon`
- `rosters`
- `roster_memberships`
- `inventory_items`
- `gm_grants`
- `trainer_history`
- `npcs`
- `npc_notes`
- `shop_state`
- `ui_state`
- `save_revisions`
- `app_meta`
- `schema_migrations`

## Why this is hybrid-normalized

Core entities and relations are normalized now because they will need querying, constraints and future migrations.
Flexible substructures such as Trainer skill maps, Combat Stages and temporary modifiers remain JSON columns in v0.2.

The intent is not to freeze the final database schema yet; it is to establish the repository boundary and stop UI code from owning persistence.

## Write strategy

`CampaignRepository.saveState()` performs a transaction and replaces child collections for the active profile.

This is intentionally simple and safe for the current small prototype. Later milestones can replace whole-state writes with command-level updates without changing the frontend contract.

## Revisions

A semantic SHA-256 hash is calculated for the campaign state.
Pure navigation state, selections, the shopping cart and toast messages are excluded from this hash so they do not produce noisy revisions.

The database keeps the latest 30 revisions per profile.

## API

### `GET /api/health`
Returns runtime/persistence information.

### `GET /api/state`
Loads the current campaign state reconstructed from normalized tables.

### `PUT /api/state`
Validates and transactionally saves campaign state.

### `POST /api/reset`
Restores the bundled sample campaign.

### `GET /api/revisions`
Lists recent semantic revisions.

### `POST /api/revisions/:id/restore`
Restores a revision.

### `GET /api/export`
Returns the active campaign as JSON.

## Future Tauri migration

The UI should eventually call a repository/service interface rather than raw HTTP.
The Node server is a development implementation of that boundary. A Tauri/Rust adapter can later implement equivalent methods while keeping the frontend use-cases and SQLite schema/migrations conceptually intact.
