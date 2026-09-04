//! Content-version resolver (technical spec section 6; `seed/DATA_FORMAT_v1.0.md`
//! "Content resolution"): for one logical definition, picks the winning
//! version under a Campaign Ruleset. Precedence: **explicit valid pin** >
//! **enabled packs only** > **highest ruleset pack priority** > **ruleset
//! declaration order** (later entry in `ruleset.packs` wins a priority tie).
//!
//! This never mutates or deletes any stored version — switching the active
//! ruleset only changes which row this function returns.

use rusqlite::{params, Connection};
use serde::Serialize;

use super::ruleset::CampaignRuleset;
use super::ContentKind;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ResolutionReason {
    /// Won via `ruleset.version_pins`.
    Pinned,
    /// Won via enabled-packs + priority + ruleset-order.
    Priority,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResolvedDefinition {
    pub definition_version_id: String,
    pub logical_id: String,
    pub content_pack_id: String,
    pub name: String,
    pub needs_review: bool,
    pub data_json: String,
    pub reason: ResolutionReason,
}

struct Candidate {
    definition_version_id: String,
    content_pack_id: String,
    name: String,
    needs_review: bool,
    data_json: String,
}

const CANDIDATE_COLUMNS: &str =
    "definition_version_id, content_pack_id, name, needs_review, data_json";

fn row_to_candidate(row: &rusqlite::Row) -> rusqlite::Result<Candidate> {
    Ok(Candidate {
        definition_version_id: row.get(0)?,
        content_pack_id: row.get(1)?,
        name: row.get(2)?,
        needs_review: row.get::<_, i64>(3)? != 0,
        data_json: row.get(4)?,
    })
}

fn finish(candidate: Candidate, logical_id: &str, reason: ResolutionReason) -> ResolvedDefinition {
    ResolvedDefinition {
        definition_version_id: candidate.definition_version_id,
        logical_id: logical_id.to_string(),
        content_pack_id: candidate.content_pack_id,
        name: candidate.name,
        needs_review: candidate.needs_review,
        data_json: candidate.data_json,
        reason,
    }
}

/// Resolves the winning version of `kind:logical_id` under `ruleset`.
/// Soft-deleted rows (`enabled = 0`) are never returned, pinned or not.
pub fn resolve_definition(
    conn: &Connection,
    ruleset: &CampaignRuleset,
    kind: ContentKind,
    logical_id: &str,
) -> rusqlite::Result<Option<ResolvedDefinition>> {
    let table = kind.table_name();

    // 1. Explicit version pin, if valid (row still exists and is not
    //    soft-deleted). A valid pin wins even over a pack that is currently
    //    disabled/absent from this ruleset's pack list.
    let pin_key = format!("{}:{}", kind.kind_slug(), logical_id);
    if let Some(pinned_version_id) = ruleset.version_pins.get(&pin_key) {
        let sql = format!(
            "SELECT {CANDIDATE_COLUMNS} FROM {table}
             WHERE definition_version_id = ?1 AND logical_id = ?2 AND enabled = 1"
        );
        let pinned = conn.query_row(&sql, params![pinned_version_id, logical_id], |r| {
            row_to_candidate(r)
        });
        match pinned {
            Ok(candidate) => return Ok(Some(finish(candidate, logical_id, ResolutionReason::Pinned))),
            Err(rusqlite::Error::QueryReturnedNoRows) => {} // invalid pin: fall through
            Err(e) => return Err(e),
        }
    }

    // 2. Enabled packs only, ranked by (ruleset priority, ruleset order).
    let sql = format!("SELECT {CANDIDATE_COLUMNS} FROM {table} WHERE logical_id = ?1 AND enabled = 1");
    let mut stmt = conn.prepare(&sql)?;
    let candidates: Vec<Candidate> = stmt
        .query_map(params![logical_id], |r| row_to_candidate(r))?
        .collect::<rusqlite::Result<_>>()?;

    Ok(pick_priority_winner(ruleset, candidates).map(|c| finish(c, logical_id, ResolutionReason::Priority)))
}

fn pick_priority_winner(ruleset: &CampaignRuleset, candidates: Vec<Candidate>) -> Option<Candidate> {
    let mut best: Option<((i64, usize), Candidate)> = None;
    for candidate in candidates {
        let Some((declaration_index, pack_ref)) = ruleset
            .packs
            .iter()
            .enumerate()
            .find(|(_, p)| p.id == candidate.content_pack_id)
        else {
            continue; // pack is not part of this ruleset at all
        };
        if !pack_ref.enabled {
            continue;
        }
        let rank = (pack_ref.priority, declaration_index);
        let is_better = match &best {
            None => true,
            Some((best_rank, _)) => rank > *best_rank,
        };
        if is_better {
            best = Some((rank, candidate));
        }
    }
    best.map(|(_, candidate)| candidate)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::ruleset::RulesetPackRef;
    use crate::persistence::definitions::open_and_migrate_definitions;

    fn seed_db() -> (std::path::PathBuf, Connection) {
        let dir = std::env::temp_dir().join(format!("ptu-resolver-unit-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("definitions.sqlite");
        let conn = open_and_migrate_definitions(&path).unwrap();
        (dir, conn)
    }

    fn insert_pack(conn: &Connection, id: &str, priority: i64) {
        conn.execute(
            "INSERT INTO content_packs (id, name, version, priority, kind, format_version, dependencies_json, manifest_json, imported_at, updated_at)
             VALUES (?1, ?1, '1.0.0', ?2, NULL, 1, '[]', '{}', 'now', 'now')",
            params![id, priority],
        )
        .unwrap();
    }

    fn insert_ability(conn: &Connection, definition_version_id: &str, logical_id: &str, content_pack_id: &str) {
        conn.execute(
            "INSERT INTO abilities (definition_version_id, logical_id, content_pack_id, source_id, source_kind, source_priority, name, needs_review, enabled, data_json, search_text, updated_at)
             VALUES (?1, ?2, ?3, NULL, NULL, NULL, ?2, 0, 1, '{}', ?2, 'now')",
            params![definition_version_id, logical_id, content_pack_id],
        )
        .unwrap();
    }

    fn ruleset(packs: Vec<(&str, bool, i64)>, pins: &[(&str, &str)]) -> CampaignRuleset {
        CampaignRuleset {
            id: "test".into(),
            name: "Test".into(),
            version: "1.0.0".into(),
            description: None,
            packs: packs
                .into_iter()
                .map(|(id, enabled, priority)| RulesetPackRef {
                    id: id.to_string(),
                    enabled,
                    priority,
                })
                .collect(),
            version_pins: pins
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
            gm_overrides_enabled: true,
        }
    }

    #[test]
    fn higher_priority_pack_wins() {
        let (dir, conn) = seed_db();
        insert_pack(&conn, "low", 100);
        insert_pack(&conn, "high", 200);
        insert_ability(&conn, "abilities:foo@low", "foo", "low");
        insert_ability(&conn, "abilities:foo@high", "foo", "high");

        let rs = ruleset(vec![("low", true, 100), ("high", true, 200)], &[]);
        let resolved = resolve_definition(&conn, &rs, ContentKind::Ability, "foo").unwrap().unwrap();
        assert_eq!(resolved.definition_version_id, "abilities:foo@high");
        assert_eq!(resolved.reason, ResolutionReason::Priority);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn disabled_pack_is_excluded_even_if_highest_priority() {
        let (dir, conn) = seed_db();
        insert_pack(&conn, "low", 100);
        insert_pack(&conn, "high", 200);
        insert_ability(&conn, "abilities:foo@low", "foo", "low");
        insert_ability(&conn, "abilities:foo@high", "foo", "high");

        let rs = ruleset(vec![("low", true, 100), ("high", false, 200)], &[]);
        let resolved = resolve_definition(&conn, &rs, ContentKind::Ability, "foo").unwrap().unwrap();
        assert_eq!(resolved.definition_version_id, "abilities:foo@low");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn valid_pin_wins_over_higher_priority_pack() {
        let (dir, conn) = seed_db();
        insert_pack(&conn, "low", 100);
        insert_pack(&conn, "high", 200);
        insert_ability(&conn, "abilities:foo@low", "foo", "low");
        insert_ability(&conn, "abilities:foo@high", "foo", "high");

        let rs = ruleset(
            vec![("low", true, 100), ("high", true, 200)],
            &[("ability:foo", "abilities:foo@low")],
        );
        let resolved = resolve_definition(&conn, &rs, ContentKind::Ability, "foo").unwrap().unwrap();
        assert_eq!(resolved.definition_version_id, "abilities:foo@low");
        assert_eq!(resolved.reason, ResolutionReason::Pinned);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn invalid_pin_falls_back_to_priority_resolution() {
        let (dir, conn) = seed_db();
        insert_pack(&conn, "low", 100);
        insert_ability(&conn, "abilities:foo@low", "foo", "low");

        let rs = ruleset(
            vec![("low", true, 100)],
            &[("ability:foo", "abilities:foo@does-not-exist")],
        );
        let resolved = resolve_definition(&conn, &rs, ContentKind::Ability, "foo").unwrap().unwrap();
        assert_eq!(resolved.definition_version_id, "abilities:foo@low");
        assert_eq!(resolved.reason, ResolutionReason::Priority);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn tie_break_uses_later_ruleset_declaration_order() {
        let (dir, conn) = seed_db();
        insert_pack(&conn, "a", 100);
        insert_pack(&conn, "b", 100);
        insert_ability(&conn, "abilities:foo@a", "foo", "a");
        insert_ability(&conn, "abilities:foo@b", "foo", "b");

        // "b" is declared after "a" at the same priority: "b" should win.
        let rs = ruleset(vec![("a", true, 100), ("b", true, 100)], &[]);
        let resolved = resolve_definition(&conn, &rs, ContentKind::Ability, "foo").unwrap().unwrap();
        assert_eq!(resolved.definition_version_id, "abilities:foo@b");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn no_candidates_returns_none() {
        let (dir, conn) = seed_db();
        let rs = ruleset(vec![], &[]);
        let resolved = resolve_definition(&conn, &rs, ContentKind::Ability, "nonexistent").unwrap();
        assert!(resolved.is_none());

        let _ = std::fs::remove_dir_all(&dir);
    }
}
