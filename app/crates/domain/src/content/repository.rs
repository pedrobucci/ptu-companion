//! Minimal read access over `definitions.sqlite`, enough to verify import
//! results and to give later tasks (ruleset resolver, search) a starting
//! point. It intentionally does not implement version resolution (pin >
//! enabled > priority > ruleset order) — that is T03's job.

use rusqlite::Connection;
use serde::Serialize;

use super::ContentKind;

#[derive(Debug, Clone, Serialize)]
pub struct ContentPackRow {
    pub id: String,
    pub name: String,
    pub version: String,
    pub priority: i64,
    pub kind: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct DefinitionRow {
    pub definition_version_id: String,
    pub logical_id: String,
    pub content_pack_id: String,
    pub name: String,
    pub needs_review: bool,
    pub enabled: bool,
    pub data_json: String,
}

pub fn count_packs(conn: &Connection) -> rusqlite::Result<i64> {
    conn.query_row("SELECT COUNT(*) FROM content_packs", [], |row| row.get(0))
}

pub fn get_pack(conn: &Connection, id: &str) -> rusqlite::Result<Option<ContentPackRow>> {
    conn.query_row(
        "SELECT id, name, version, priority, kind, enabled FROM content_packs WHERE id = ?1",
        [id],
        |row| {
            Ok(ContentPackRow {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                priority: row.get(3)?,
                kind: row.get(4)?,
                enabled: row.get::<_, i64>(5)? != 0,
            })
        },
    )
    .map(Some)
    .or_else(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => Ok(None),
        other => Err(other),
    })
}

pub fn list_packs(conn: &Connection) -> rusqlite::Result<Vec<ContentPackRow>> {
    let mut stmt =
        conn.prepare("SELECT id, name, version, priority, kind, enabled FROM content_packs ORDER BY priority ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok(ContentPackRow {
            id: row.get(0)?,
            name: row.get(1)?,
            version: row.get(2)?,
            priority: row.get(3)?,
            kind: row.get(4)?,
            enabled: row.get::<_, i64>(5)? != 0,
        })
    })?;
    rows.collect()
}

pub fn count_definitions(conn: &Connection, kind: ContentKind) -> rusqlite::Result<i64> {
    conn.query_row(
        &format!("SELECT COUNT(*) FROM {}", kind.table_name()),
        [],
        |row| row.get(0),
    )
}

pub fn get_definition_by_version_id(
    conn: &Connection,
    kind: ContentKind,
    definition_version_id: &str,
) -> rusqlite::Result<Option<DefinitionRow>> {
    let sql = format!(
        "SELECT definition_version_id, logical_id, content_pack_id, name, needs_review, enabled, data_json
         FROM {} WHERE definition_version_id = ?1",
        kind.table_name()
    );
    conn.query_row(&sql, [definition_version_id], |row| {
        Ok(DefinitionRow {
            definition_version_id: row.get(0)?,
            logical_id: row.get(1)?,
            content_pack_id: row.get(2)?,
            name: row.get(3)?,
            needs_review: row.get::<_, i64>(4)? != 0,
            enabled: row.get::<_, i64>(5)? != 0,
            data_json: row.get(6)?,
        })
    })
    .map(Some)
    .or_else(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => Ok(None),
        other => Err(other),
    })
}

pub fn list_definitions_by_logical_id(
    conn: &Connection,
    kind: ContentKind,
    logical_id: &str,
) -> rusqlite::Result<Vec<DefinitionRow>> {
    let sql = format!(
        "SELECT definition_version_id, logical_id, content_pack_id, name, needs_review, enabled, data_json
         FROM {} WHERE logical_id = ?1",
        kind.table_name()
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([logical_id], |row| {
        Ok(DefinitionRow {
            definition_version_id: row.get(0)?,
            logical_id: row.get(1)?,
            content_pack_id: row.get(2)?,
            name: row.get(3)?,
            needs_review: row.get::<_, i64>(4)? != 0,
            enabled: row.get::<_, i64>(5)? != 0,
            data_json: row.get(6)?,
        })
    })?;
    rows.collect()
}

/// T13E02: every distinct `logical_id` for a kind, ordered by (a
/// representative) name then logical_id — the stable listing
/// `browse_selectable_content` walks for an empty query, before per-id
/// ruleset resolution filters out anything that doesn't actually resolve.
pub fn list_distinct_logical_ids(conn: &Connection, kind: ContentKind) -> rusqlite::Result<Vec<String>> {
    let sql = format!(
        "SELECT logical_id, MIN(name) AS rep_name FROM {} GROUP BY logical_id ORDER BY rep_name ASC, logical_id ASC",
        kind.table_name()
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    rows.collect()
}

/// Runs `PRAGMA integrity_check` and returns the raw result (`"ok"` on a
/// healthy database).
pub fn integrity_check(conn: &Connection) -> rusqlite::Result<String> {
    conn.query_row("PRAGMA integrity_check", [], |row| row.get(0))
}
