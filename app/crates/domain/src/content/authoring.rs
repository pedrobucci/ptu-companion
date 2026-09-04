//! Content authoring (spec §21): the Windows editor's backend. Creating or
//! updating a definition never overwrites another pack's row — it always
//! writes into a GM-owned homebrew pack the caller names, and the record's
//! own `definition_version_id` (scoped to that pack, e.g.
//! `"moves:crunch@my-homebrew"`) is what keeps it a separate row from the
//! original `"moves:crunch@core"` — both coexist, and T03's resolver picks
//! between them by ruleset priority/pin, exactly like any two packs that
//! define the same logical id.
//!
//! Soft-delete (spec §23/§39: "Soft delete/inactive for definição
//! referenciada") lives here too: it flips `enabled` to 0 so the resolver
//! stops offering the row as a winner, without deleting it — a historical
//! Pokémon/Trainer record that still names this exact
//! `definition_version_id` can look it up by id regardless (see
//! `content::repository::get_definition_by_version_id`, which never
//! filters by `enabled`).

use rusqlite::{params, Connection};
use serde_json::Value;
use thiserror::Error;

use super::import::{extract_definition_fields, upsert_definition};
use super::ContentKind;

#[derive(Debug, Error)]
pub enum AuthoringError {
    #[error("record failed validation: {0}")]
    InvalidRecord(String),

    #[error("record's content_pack_id \"{found}\" does not match the target pack \"{expected}\" — authoring never writes into a pack it wasn't told to")]
    PackMismatch { expected: String, found: String },

    #[error("definition \"{0}\" not found")]
    DefinitionNotFound(String),

    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

/// Ensures a GM-owned homebrew pack (`pack_id`) exists — creating it if
/// this is its first definition — then upserts one definition into it.
/// `record.content_pack_id` must already equal `pack_id`; a mismatch is
/// rejected rather than silently redirected, so a typo can never land a
/// definition in the wrong pack.
pub fn save_definition(
    conn: &mut Connection,
    pack_id: &str,
    pack_name: &str,
    priority: i64,
    kind: ContentKind,
    record: &Value,
) -> Result<(), AuthoringError> {
    let fields = extract_definition_fields(record).map_err(AuthoringError::InvalidRecord)?;
    if fields.content_pack_id != pack_id {
        return Err(AuthoringError::PackMismatch {
            expected: pack_id.to_string(),
            found: fields.content_pack_id,
        });
    }

    let now = chrono::Utc::now().to_rfc3339();
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO content_packs (id, name, version, priority, kind, format_version, dependencies_json, manifest_json, imported_at, updated_at)
         VALUES (?1, ?2, '1.0.0', ?3, 'homebrew_authored', 1, '[]', '{}', ?4, ?4)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            priority = excluded.priority,
            updated_at = excluded.updated_at",
        params![pack_id, pack_name, priority, now],
    )?;
    upsert_definition(&tx, kind, &fields, &now).map_err(|e| AuthoringError::InvalidRecord(e.to_string()))?;
    tx.commit()?;
    Ok(())
}

/// Marks a definition inactive (spec §23) without deleting it. Idempotent.
pub fn soft_delete_definition(conn: &Connection, kind: ContentKind, definition_version_id: &str) -> Result<(), AuthoringError> {
    let table = kind.table_name();
    let now = chrono::Utc::now().to_rfc3339();
    let changed = conn.execute(
        &format!("UPDATE {table} SET enabled = 0, updated_at = ?2 WHERE definition_version_id = ?1"),
        params![definition_version_id, now],
    )?;
    if changed == 0 {
        return Err(AuthoringError::DefinitionNotFound(definition_version_id.to_string()));
    }
    Ok(())
}

/// Reactivates a previously soft-deleted definition.
pub fn reactivate_definition(conn: &Connection, kind: ContentKind, definition_version_id: &str) -> Result<(), AuthoringError> {
    let table = kind.table_name();
    let now = chrono::Utc::now().to_rfc3339();
    let changed = conn.execute(
        &format!("UPDATE {table} SET enabled = 1, updated_at = ?2 WHERE definition_version_id = ?1"),
        params![definition_version_id, now],
    )?;
    if changed == 0 {
        return Err(AuthoringError::DefinitionNotFound(definition_version_id.to_string()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::import::import_pack_file;
    use crate::content::repository::get_definition_by_version_id;
    use crate::content::resolver::resolve_definition;
    use crate::content::ruleset::CampaignRuleset;
    use crate::persistence::definitions::open_and_migrate_definitions;
    use serde_json::json;
    use std::path::Path;

    fn seed_with_core() -> (std::path::PathBuf, Connection) {
        let dir = std::env::temp_dir().join(format!("ptu-authoring-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
        let core_pack = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../content_packs/ptu-core-1.05.ptucp");
        import_pack_file(&mut conn, &core_pack).unwrap();
        (dir, conn)
    }

    /// T09 acceptance: "editor Windows cria nova versão/pack sem overwrite".
    #[test]
    fn saving_a_homebrew_edit_never_overwrites_the_original() {
        let (dir, mut conn) = seed_with_core();

        let original_before = get_definition_by_version_id(&conn, ContentKind::Move, "moves:crunch@core")
            .unwrap()
            .unwrap();

        let homebrew_record = json!({
            "id": "crunch",
            "name": "Crunch (Homebrew Buff)",
            "needs_review": false,
            "logical_id": "crunch",
            "definition_version_id": "moves:crunch@my-homebrew",
            "content_pack_id": "my-homebrew",
            "effect_text": "Homebrew: Crunch lowers Defense 2 stages instead of 1."
        });
        save_definition(&mut conn, "my-homebrew", "My Homebrew Pack", 500, ContentKind::Move, &homebrew_record).unwrap();

        let original_after = get_definition_by_version_id(&conn, ContentKind::Move, "moves:crunch@core")
            .unwrap()
            .unwrap();
        assert_eq!(original_before.data_json, original_after.data_json, "original definition must be byte-identical after a homebrew save");

        let homebrew_row = get_definition_by_version_id(&conn, ContentKind::Move, "moves:crunch@my-homebrew")
            .unwrap()
            .unwrap();
        assert_eq!(homebrew_row.name, "Crunch (Homebrew Buff)");

        // Both versions coexist; a ruleset that enables and prioritizes the
        // homebrew pack picks it, one that doesn't still picks core — the
        // save never mutated which version "core" resolves to.
        let both_enabled = CampaignRuleset {
            id: "test".into(), name: "test".into(), version: "1".into(), description: None,
            packs: vec![
                ptu_domain_ruleset_pack("ptu-core-1.05", true, 100),
                ptu_domain_ruleset_pack("my-homebrew", true, 500),
            ],
            version_pins: Default::default(), gm_overrides_enabled: true,
        };
        let winner = resolve_definition(&conn, &both_enabled, ContentKind::Move, "crunch").unwrap().unwrap();
        assert_eq!(winner.definition_version_id, "moves:crunch@my-homebrew");

        let core_only = CampaignRuleset {
            id: "test2".into(), name: "test2".into(), version: "1".into(), description: None,
            packs: vec![ptu_domain_ruleset_pack("ptu-core-1.05", true, 100)],
            version_pins: Default::default(), gm_overrides_enabled: true,
        };
        let winner2 = resolve_definition(&conn, &core_only, ContentKind::Move, "crunch").unwrap().unwrap();
        assert_eq!(winner2.definition_version_id, "moves:crunch@core");

        let _ = std::fs::remove_dir_all(&dir);
    }

    fn ptu_domain_ruleset_pack(id: &str, enabled: bool, priority: i64) -> crate::content::ruleset::RulesetPackRef {
        crate::content::ruleset::RulesetPackRef { id: id.to_string(), enabled, priority }
    }

    #[test]
    fn resaving_the_same_homebrew_version_updates_in_place_without_duplicating() {
        let (dir, mut conn) = seed_with_core();
        let record = |text: &str| {
            json!({
                "id": "crunch", "name": "Crunch", "needs_review": false, "logical_id": "crunch",
                "definition_version_id": "moves:crunch@my-homebrew", "content_pack_id": "my-homebrew",
                "effect_text": text
            })
        };
        save_definition(&mut conn, "my-homebrew", "Pack", 500, ContentKind::Move, &record("v1")).unwrap();
        save_definition(&mut conn, "my-homebrew", "Pack", 500, ContentKind::Move, &record("v2")).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM moves WHERE definition_version_id = 'moves:crunch@my-homebrew'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1, "iterating on a draft must update in place, not accumulate rows");

        let row = get_definition_by_version_id(&conn, ContentKind::Move, "moves:crunch@my-homebrew").unwrap().unwrap();
        assert!(row.data_json.contains("v2"));

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn mismatched_pack_id_is_rejected() {
        let (dir, mut conn) = seed_with_core();
        let record = json!({
            "id": "x", "name": "X", "needs_review": false, "logical_id": "x",
            "definition_version_id": "moves:x@other-pack", "content_pack_id": "other-pack"
        });
        let result = save_definition(&mut conn, "my-homebrew", "Pack", 500, ContentKind::Move, &record);
        assert!(matches!(result, Err(AuthoringError::PackMismatch { .. })));
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Spec §23: soft-delete an existing (referenced) definition.
    #[test]
    fn soft_deleted_definition_stops_resolving_but_stays_readable_by_id() {
        let (dir, conn) = seed_with_core();

        soft_delete_definition(&conn, ContentKind::Move, "moves:crunch@core").unwrap();

        let ruleset = CampaignRuleset {
            id: "test".into(), name: "test".into(), version: "1".into(), description: None,
            packs: vec![ptu_domain_ruleset_pack("ptu-core-1.05", true, 100)],
            version_pins: Default::default(), gm_overrides_enabled: true,
        };
        let resolved = resolve_definition(&conn, &ruleset, ContentKind::Move, "crunch").unwrap();
        assert!(resolved.is_none(), "a soft-deleted definition must not win resolution");

        // But a historical reference by exact version id (e.g. a Pokémon
        // that already learned this Move) must still be able to look it up.
        let by_id = get_definition_by_version_id(&conn, ContentKind::Move, "moves:crunch@core").unwrap().unwrap();
        assert!(!by_id.enabled);
        assert!(by_id.data_json.contains("Crunch"));

        reactivate_definition(&conn, ContentKind::Move, "moves:crunch@core").unwrap();
        let resolved_again = resolve_definition(&conn, &ruleset, ContentKind::Move, "crunch").unwrap();
        assert!(resolved_again.is_some());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn soft_deleting_unknown_definition_is_a_clean_error() {
        let (dir, conn) = seed_with_core();
        let result = soft_delete_definition(&conn, ContentKind::Move, "moves:does-not-exist@core");
        assert!(matches!(result, Err(AuthoringError::DefinitionNotFound(_))));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
