//! `profiles.sqlite`: Trainer/Pokémon/NPC/history/combat state. Physically
//! separate from `definitions.sqlite` (spec section 34) so content import
//! (T02) can never touch it — verified by `content_import_never_touches_profiles_database`
//! in `tests/ptucp_import.rs`.
//!
//! Schema shape follows technical spec sections 7-13/17-18/23 and the
//! provided `fixtures/trainer_profile_full.json`. As in `definitions.rs`,
//! fields nothing here needs to query relationally yet stay in a
//! `data_json` column (GM grants, NPC records, progression-ledger entries,
//! timeline/history events) rather than being exploded into columns ahead
//! of the engine that will actually interpret them (T05+). Fields that
//! upcoming tasks are already known to filter/mutate relationally (Pokémon
//! `injuries`/`storage_state` for T06's storage invariant, roster
//! memberships for T06's multi-roster support) get real columns now.

use super::open_and_migrate;
use rusqlite::Connection;
use std::path::Path;

pub(crate) fn migrations() -> Vec<String> {
    vec![r#"
        CREATE TABLE IF NOT EXISTS trainers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            level INTEGER NOT NULL,
            exp INTEGER NOT NULL,
            money INTEGER NOT NULL,
            background_json TEXT,
            skills_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        -- GM Fixed/Resource grants (spec 16). Interpreting/applying a grant
        -- is the modifier engine's job; this just persists the input
        -- faithfully (spec 15: "persist inputs/modifiers", never only a
        -- derived value) so it can survive a respec (spec 17.3).
        CREATE TABLE IF NOT EXISTS trainer_gm_grants (
            id TEXT PRIMARY KEY,
            trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            sequence INTEGER NOT NULL,
            data_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_trainer_gm_grants_trainer ON trainer_gm_grants(trainer_id);

        CREATE TABLE IF NOT EXISTS rosters (
            id TEXT PRIMARY KEY,
            trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            max_members INTEGER,
            sequence INTEGER NOT NULL,
            rules_json TEXT,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_rosters_trainer ON rosters(trainer_id);

        CREATE TABLE IF NOT EXISTS pokemon_instances (
            id TEXT PRIMARY KEY,
            trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
            species_definition_id TEXT NOT NULL,
            nickname TEXT,
            level INTEGER NOT NULL,
            exp INTEGER,
            capture_ball_item_id TEXT,
            injuries INTEGER NOT NULL DEFAULT 0,
            held_item_id TEXT,
            storage_state TEXT NOT NULL DEFAULT 'carried' CHECK (storage_state IN ('carried', 'stored')),
            sequence INTEGER NOT NULL,
            portrait_media_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_pokemon_trainer ON pokemon_instances(trainer_id);

        -- A Pokémon may belong to multiple simultaneously active Rosters (spec 9).
        CREATE TABLE IF NOT EXISTS roster_memberships (
            roster_id TEXT NOT NULL REFERENCES rosters(id) ON DELETE CASCADE,
            pokemon_id TEXT NOT NULL REFERENCES pokemon_instances(id) ON DELETE CASCADE,
            sequence INTEGER NOT NULL,
            PRIMARY KEY (roster_id, pokemon_id)
        );
        CREATE INDEX IF NOT EXISTS idx_roster_memberships_pokemon ON roster_memberships(pokemon_id);

        -- Dynamic battle state (spec 8.2/13): only meaningful while a
        -- Trainer or Pokémon is actively carried/in play. One row per
        -- owner; owner_type distinguishes the two so both share one table
        -- per spec 23's suggested `combat_states`, rather than duplicating
        -- HP/AP/combat-stage columns on both `trainers` and `pokemon_instances`.
        CREATE TABLE IF NOT EXISTS combat_states (
            owner_type TEXT NOT NULL CHECK (owner_type IN ('trainer', 'pokemon')),
            owner_id TEXT NOT NULL,
            current_hp INTEGER,
            temp_hp INTEGER,
            combat_stages_json TEXT,
            statuses_json TEXT,
            ap_current INTEGER,
            ap_bound INTEGER,
            ap_drained INTEGER,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (owner_type, owner_id)
        );

        CREATE TABLE IF NOT EXISTS inventory_stacks (
            id TEXT PRIMARY KEY,
            trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
            location TEXT NOT NULL CHECK (location IN ('backpack', 'storage')),
            item_id TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            sequence INTEGER NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_inventory_trainer ON inventory_stacks(trainer_id, location);

        CREATE TABLE IF NOT EXISTS equipment_slots (
            trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
            slot_key TEXT NOT NULL,
            item_id TEXT,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (trainer_id, slot_key)
        );

        CREATE TABLE IF NOT EXISTS npcs (
            id TEXT PRIMARY KEY,
            trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
            sequence INTEGER NOT NULL,
            data_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_npcs_trainer ON npcs(trainer_id);

        -- Structured per-level progression ledger (spec 17.1), distinct
        -- from the free-form timeline below.
        CREATE TABLE IF NOT EXISTS trainer_progression (
            trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
            level INTEGER NOT NULL,
            data_json TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (trainer_id, level)
        );

        -- Append-oriented event timeline (spec 18); the fixture's
        -- top-level "timeline" array maps directly to this table.
        CREATE TABLE IF NOT EXISTS history_events (
            id TEXT PRIMARY KEY,
            trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            sequence INTEGER NOT NULL,
            data_json TEXT NOT NULL,
            occurred_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_history_trainer ON history_events(trainer_id, sequence);

        -- Media references (spec 20/23): portraits etc. are files on disk
        -- referenced by id/path, never SQLite BLOBs. Actual image
        -- decode/WebP-derivative processing is a later task; this is only
        -- the reference table.
        CREATE TABLE IF NOT EXISTS media_assets (
            id TEXT PRIMARY KEY,
            owner_type TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            file_path TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_media_owner ON media_assets(owner_type, owner_id);
    "#
    .to_string(),
    // Migration 2 (T06): frequency-based resource usage counters (spec 13/23),
    // e.g. a Move/Ability/Feature limited to N uses per round/scene/day. A
    // missing row means "not consumed yet in the current window"; resetting
    // a window (Next Round/End Scene/New Day) deletes the rows for that
    // scope rather than zeroing them, so "never used" and "reset" look
    // identical, which is the correct state either way.
    r#"
        CREATE TABLE IF NOT EXISTS usage_counters (
            owner_type TEXT NOT NULL CHECK (owner_type IN ('trainer', 'pokemon')),
            owner_id TEXT NOT NULL,
            resource_key TEXT NOT NULL,
            scope TEXT NOT NULL CHECK (scope IN ('round', 'scene', 'day')),
            uses_remaining INTEGER,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (owner_type, owner_id, resource_key)
        );
        CREATE INDEX IF NOT EXISTS idx_usage_counters_owner ON usage_counters(owner_type, owner_id, scope);
    "#
    .to_string(),
    // Migration 3 (T07): Shop Presets (spec 11/23) and transaction history.
    // A shop's catalog price = base item price (from definitions.sqlite,
    // not referenced here) × the shop's buy/sell multiplier, unless
    // overridden per-item; a checkout may further override per-line. See
    // `engine::shop`.
    r#"
        CREATE TABLE IF NOT EXISTS shops (
            id TEXT PRIMARY KEY,
            trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            buy_multiplier REAL NOT NULL DEFAULT 1.0,
            sell_multiplier REAL NOT NULL DEFAULT 0.5,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_shops_trainer ON shops(trainer_id);

        CREATE TABLE IF NOT EXISTS shop_items (
            shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
            item_id TEXT NOT NULL,
            available INTEGER NOT NULL DEFAULT 1,
            buy_override REAL,
            sell_override REAL,
            sequence INTEGER NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (shop_id, item_id)
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
            shop_id TEXT,
            kind TEXT NOT NULL CHECK (kind IN ('buy', 'sell')),
            total_amount INTEGER NOT NULL,
            lines_json TEXT NOT NULL,
            occurred_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_transactions_trainer ON transactions(trainer_id);
    "#
    .to_string(),
    mechanical_collections_migration(),
    ]
}

/// Migration 4 (T09a): the mechanical collections spec §23 names
/// explicitly (`trainer_moves`/`trainer_edges`/`trainer_features`/
/// `trainer_abilities`/`trainer_capabilities`/`pokemon_moves`/
/// `pokemon_abilities`/`pokemon_poke_edges`/`pokemon_capabilities`) but
/// that were never created before this task. Each row references a
/// definition by `definition_version_id` only — the instance never copies
/// or mutates the definition's own text (spec: "instância referencia
/// definição/version/provenance sem copiá-la/mutá-la"). A Trainer's own
/// tables have no size limit (unlimited Move list is a hard requirement);
/// nothing here imposes one — a rules-driven Pokémon move-count limit is a
/// validation-layer concern, not a schema one.
///
/// New tables only — no existing table is altered, so every previously
/// saved Trainer/Pokémon simply has zero rows in these until something
/// adds one: "profiles existentes migrados para coleções vazias" holds by
/// construction, not by a data-migration step.
fn mechanical_collections_migration() -> String {
    let mut sql = String::new();
    for table in ["trainer_moves", "trainer_edges", "trainer_features", "trainer_abilities", "trainer_capabilities"] {
        sql.push_str(&format!(
            "CREATE TABLE IF NOT EXISTS {table} (
                trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
                definition_version_id TEXT NOT NULL,
                sequence INTEGER NOT NULL,
                data_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (trainer_id, definition_version_id)
            );
            CREATE INDEX IF NOT EXISTS idx_{table}_trainer ON {table}(trainer_id);
            "
        ));
    }
    for table in ["pokemon_moves", "pokemon_abilities", "pokemon_poke_edges", "pokemon_capabilities"] {
        sql.push_str(&format!(
            "CREATE TABLE IF NOT EXISTS {table} (
                pokemon_id TEXT NOT NULL REFERENCES pokemon_instances(id) ON DELETE CASCADE,
                definition_version_id TEXT NOT NULL,
                sequence INTEGER NOT NULL,
                data_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (pokemon_id, definition_version_id)
            );
            CREATE INDEX IF NOT EXISTS idx_{table}_pokemon ON {table}(pokemon_id);
            "
        ));
    }
    sql
}

/// Opens (creating if absent) `profiles.sqlite` at `path` and applies
/// migrations. This connection must never be reachable from content-pack
/// import code.
pub fn open_and_migrate_profiles(path: &Path) -> rusqlite::Result<Connection> {
    let migrations = migrations();
    let refs: Vec<&str> = migrations.iter().map(String::as_str).collect();
    open_and_migrate(path, &refs)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_and_is_a_valid_empty_database() {
        let dir = std::env::temp_dir().join(format!("ptu-profiles-test-{}", uuid::Uuid::new_v4()));
        let path = dir.join("profiles.sqlite");
        let conn = open_and_migrate_profiles(&path).unwrap();
        let ok: String = conn
            .query_row("PRAGMA integrity_check", [], |r| r.get(0))
            .unwrap();
        assert_eq!(ok, "ok");
        drop(conn);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn creates_all_expected_tables() {
        let conn = Connection::open_in_memory().unwrap();
        let migrations = migrations();
        let refs: Vec<&str> = migrations.iter().map(String::as_str).collect();
        super::super::apply_migrations(&conn, &refs).unwrap();

        for table in [
            "trainers",
            "trainer_gm_grants",
            "rosters",
            "pokemon_instances",
            "roster_memberships",
            "combat_states",
            "inventory_stacks",
            "equipment_slots",
            "npcs",
            "trainer_progression",
            "history_events",
            "media_assets",
            "usage_counters",
            "shops",
            "shop_items",
            "transactions",
            "trainer_moves",
            "trainer_edges",
            "trainer_features",
            "trainer_abilities",
            "trainer_capabilities",
            "pokemon_moves",
            "pokemon_abilities",
            "pokemon_poke_edges",
            "pokemon_capabilities",
        ] {
            let exists: i64 = conn
                .query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?1",
                    [table],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(exists, 1, "expected table {table} to exist");
        }
    }

    /// T09a acceptance: "migration de profile anterior sem perda e com
    /// listas vazias" — a database already on the pre-T09a schema (4
    /// migrations applied, before the mechanical-collections step existed)
    /// upgrades to the current schema without losing any existing Trainer/
    /// Pokémon data, and the new collection tables start empty for it.
    #[test]
    fn pre_t09a_database_upgrades_without_data_loss() {
        use crate::profile::repository::load_trainer_profile;

        let conn = Connection::open_in_memory().unwrap();
        let all_migrations = migrations();
        assert_eq!(all_migrations.len(), 4, "expected exactly 4 migrations: T02 core, T06 usage_counters, T07 shops/transactions, T09a collections");

        // Simulate a database that only ever saw the first 3 migrations
        // (everything before T09a's, the last one).
        let pre_t09a: Vec<&str> = all_migrations[..3].iter().map(String::as_str).collect();
        super::super::apply_migrations(&conn, &pre_t09a).unwrap();

        let now = "2026-01-01T00:00:00Z";
        conn.execute(
            "INSERT INTO trainers (id, name, level, exp, money, created_at, updated_at) VALUES ('t1','Pre-T09a Trainer',5,0,100,?1,?1)",
            [now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO pokemon_instances (id, trainer_id, species_definition_id, level, sequence, created_at, updated_at)
             VALUES ('pkm-1','t1','sableye',10,0,?1,?1)",
            [now],
        )
        .unwrap();

        // Now bring it up to the full current schema (all migrations, T09a included).
        let all_refs: Vec<&str> = all_migrations.iter().map(String::as_str).collect();
        super::super::apply_migrations(&conn, &all_refs).unwrap();

        let profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(profile.name, "Pre-T09a Trainer", "pre-existing Trainer data must survive the upgrade");
        assert_eq!(profile.pokemon.len(), 1);
        assert_eq!(profile.pokemon[0].id, "pkm-1", "pre-existing Pokémon data must survive the upgrade");
        assert_eq!(profile.moves, Vec::<serde_json::Value>::new(), "new collections start empty, not missing/erroring");
        assert_eq!(profile.pokemon[0].moves, Vec::<serde_json::Value>::new());
    }
}
