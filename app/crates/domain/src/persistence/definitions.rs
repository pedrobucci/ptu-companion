//! `definitions.sqlite`: imported content pack metadata, one table per
//! definition kind (per technical spec section 23), auxiliary rule datasets,
//! and a unified FTS5 search index. Read-mostly; never receives user/profile
//! state.

use super::open_and_migrate;
use rusqlite::Connection;
use std::path::Path;

/// One physical table per PTU content kind. Every table shares the same
/// core shape: identity/provenance/quality columns plus a `data_json` column
/// holding the full parsed record. Mechanical fields stay in `data_json`
/// rather than being exploded into columns here — the engines that actually
/// interpret them (modifier/progression/resolved-move, later tasks) decode
/// what they need; this crate does not speculatively model fields nobody
/// consumes yet.
const DEFINITION_TABLE_SQL: &str = r#"
    definition_version_id TEXT PRIMARY KEY,
    logical_id TEXT NOT NULL,
    content_pack_id TEXT NOT NULL REFERENCES content_packs(id),
    source_id TEXT,
    source_kind TEXT,
    source_priority INTEGER,
    name TEXT NOT NULL,
    needs_review INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    data_json TEXT NOT NULL,
    search_text TEXT NOT NULL,
    updated_at TEXT NOT NULL
"#;

fn definition_table_migration(table: &str) -> String {
    format!(
        "CREATE TABLE IF NOT EXISTS {table} ({DEFINITION_TABLE_SQL});
         CREATE INDEX IF NOT EXISTS idx_{table}_logical_id ON {table}(logical_id);
         CREATE INDEX IF NOT EXISTS idx_{table}_pack ON {table}(content_pack_id);"
    )
}

pub(crate) fn migrations() -> Vec<String> {
    let mut m = Vec::new();

    m.push(
        r#"
        CREATE TABLE IF NOT EXISTS content_packs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            version TEXT NOT NULL,
            priority INTEGER NOT NULL,
            kind TEXT,
            format_version INTEGER NOT NULL,
            dependencies_json TEXT NOT NULL,
            manifest_json TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            imported_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS content_datasets (
            content_pack_id TEXT NOT NULL REFERENCES content_packs(id),
            dataset_name TEXT NOT NULL,
            data_json TEXT NOT NULL,
            record_count INTEGER NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (content_pack_id, dataset_name)
        );
        "#
        .to_string(),
    );

    // One migration step per definition-kind table.
    for table in [
        "moves",
        "abilities",
        "capabilities",
        "edges",
        "poke_edges",
        "features",
        "items",
        "shops",
    ] {
        m.push(definition_table_migration(table));
    }

    // Species share the common shape plus a few browse/filter columns that
    // are explicit requirements (spec 8.1/23): dex number, mechanical
    // completeness, and character-creation eligibility.
    m.push(format!(
        "CREATE TABLE IF NOT EXISTS species (
            {DEFINITION_TABLE_SQL},
            national_dex_number INTEGER,
            mechanical_completeness TEXT,
            enabled_for_character_creation INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_species_logical_id ON species(logical_id);
        CREATE INDEX IF NOT EXISTS idx_species_pack ON species(content_pack_id);
        CREATE INDEX IF NOT EXISTS idx_species_dex ON species(national_dex_number);"
    ));

    m.push(
        r#"
        CREATE VIRTUAL TABLE IF NOT EXISTS content_search_index USING fts5(
            kind UNINDEXED,
            definition_version_id UNINDEXED,
            logical_id UNINDEXED,
            content_pack_id UNINDEXED,
            name,
            search_text
        );
        "#
        .to_string(),
    );

    m
}

/// Opens (creating if absent) `definitions.sqlite` at `path` and applies
/// migrations. This connection must never be used to write profile/Trainer
/// state.
pub fn open_and_migrate_definitions(path: &Path) -> rusqlite::Result<Connection> {
    let migrations = migrations();
    let refs: Vec<&str> = migrations.iter().map(String::as_str).collect();
    open_and_migrate(path, &refs)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_all_expected_tables() {
        let conn = Connection::open_in_memory().unwrap();
        let migrations = migrations();
        let refs: Vec<&str> = migrations.iter().map(String::as_str).collect();
        super::super::apply_migrations(&conn, &refs).unwrap();

        for table in [
            "content_packs",
            "content_datasets",
            "moves",
            "abilities",
            "capabilities",
            "edges",
            "poke_edges",
            "features",
            "items",
            "shops",
            "species",
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

        let fts_exists: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE name='content_search_index'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(fts_exists, 1);
    }
}
