//! Paginated full-text search over `content_search_index` (technical spec
//! section 19). Every query is `LIMIT`/`OFFSET`-bound so a search never
//! loads the whole catalog into memory, regardless of catalog size.
//!
//! This does not apply ruleset resolution — it is a raw search across every
//! stored version. A caller that needs only the ruleset-active winner per
//! logical id should pair this with [`super::resolver::resolve_definition`];
//! fusing the two here would mean guessing at a UI-specific dedupe policy
//! this task has no concrete consumer for yet.

use rusqlite::{params, Connection};
use serde::Serialize;

use super::ContentKind;

#[derive(Debug, Clone, Serialize)]
pub struct SearchHit {
    /// [`ContentKind::kind_slug`] (singular, e.g. `"capability"`) — the
    /// same form `resolve_definition`/`parse_definition_ref` expect, so a
    /// caller can pass this straight through without translating it.
    pub kind: String,
    pub definition_version_id: String,
    pub logical_id: String,
    pub content_pack_id: String,
    pub name: String,
}

/// Runs a paginated FTS5 search. `kind` optionally restricts to one content
/// kind. Returns at most `limit` rows starting at `offset`.
pub fn search(
    conn: &Connection,
    query: &str,
    kind: Option<ContentKind>,
    limit: i64,
    offset: i64,
) -> rusqlite::Result<Vec<SearchHit>> {
    let fts_query = build_fts_query(query);
    if fts_query.is_empty() {
        return Ok(Vec::new());
    }

    let kind_filter: Option<&str> = kind.map(ContentKind::kind_slug);
    let mut stmt = conn.prepare(
        "SELECT kind, definition_version_id, logical_id, content_pack_id, name
         FROM content_search_index
         WHERE content_search_index MATCH ?1
           AND (?2 IS NULL OR kind = ?2)
         ORDER BY rank, definition_version_id
         LIMIT ?3 OFFSET ?4",
    )?;
    let rows = stmt.query_map(params![fts_query, kind_filter, limit, offset], |row| {
        Ok(SearchHit {
            kind: row.get(0)?,
            definition_version_id: row.get(1)?,
            logical_id: row.get(2)?,
            content_pack_id: row.get(3)?,
            name: row.get(4)?,
        })
    })?;
    rows.collect()
}

/// Turns free text into a safe FTS5 query: each whitespace-separated token
/// becomes an escaped, prefix-matched phrase (implicit AND between tokens),
/// so user input can never inject FTS5 operators/syntax.
fn build_fts_query(raw: &str) -> String {
    raw.split_whitespace()
        .map(|token| format!("\"{}\"*", token.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::persistence::definitions::open_and_migrate_definitions;

    fn seed_db() -> (std::path::PathBuf, Connection) {
        let dir = std::env::temp_dir().join(format!("ptu-search-unit-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("definitions.sqlite");
        let conn = open_and_migrate_definitions(&path).unwrap();
        (dir, conn)
    }

    fn insert_hit(conn: &Connection, kind: &str, definition_version_id: &str, name: &str, text: &str) {
        conn.execute(
            "INSERT INTO content_search_index (kind, definition_version_id, logical_id, content_pack_id, name, search_text)
             VALUES (?1, ?2, ?2, 'test-pack', ?3, ?4)",
            params![kind, definition_version_id, name, text],
        )
        .unwrap();
    }

    #[test]
    fn finds_matching_rows_and_respects_kind_filter() {
        let (dir, conn) = seed_db();
        insert_hit(&conn, "move", "moves:ember@core", "Ember", "A weak fire move.");
        insert_hit(&conn, "ability", "abilities:blaze@core", "Blaze", "Powers up fire moves.");

        let all_fire = search(&conn, "fire", None, 10, 0).unwrap();
        assert_eq!(all_fire.len(), 2);

        let moves_only = search(&conn, "fire", Some(ContentKind::Move), 10, 0).unwrap();
        assert_eq!(moves_only.len(), 1);
        assert_eq!(moves_only[0].definition_version_id, "moves:ember@core");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn pagination_bounds_result_size_and_does_not_repeat_rows() {
        let (dir, conn) = seed_db();
        for i in 0..20 {
            insert_hit(
                &conn,
                "move",
                &format!("moves:test-{i}@core"),
                &format!("Test Move {i}"),
                "shared searchable text token",
            );
        }

        let page1 = search(&conn, "shared", None, 5, 0).unwrap();
        let page2 = search(&conn, "shared", None, 5, 5).unwrap();
        assert_eq!(page1.len(), 5);
        assert_eq!(page2.len(), 5);
        for hit in &page2 {
            assert!(!page1.iter().any(|h| h.definition_version_id == hit.definition_version_id));
        }

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn query_syntax_characters_are_treated_as_literal_text() {
        let (dir, conn) = seed_db();
        insert_hit(&conn, "move", "moves:weird@core", "Weird", "text");
        // A raw FTS5 syntax error (unbalanced quote / bad operator) must not
        // panic or error the caller — it should just be escaped away.
        let result = search(&conn, "\"unterminated OR *", None, 10, 0);
        assert!(result.is_ok());

        let _ = std::fs::remove_dir_all(&dir);
    }
}
