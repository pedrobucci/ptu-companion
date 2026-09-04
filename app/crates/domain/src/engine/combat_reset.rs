//! Frequency-scoped resource usage and its round/scene/day resets
//! (technical spec section 13/15: "Each resource definition must use
//! structured reset metadata... `{"frequency": {"scope":"scene","uses":2}}`").
//!
//! A missing `usage_counters` row means "not consumed in the current
//! window" — resetting a window deletes rows for that scope (and any
//! shorter-lived scope it also closes) rather than writing a fresh zeroed
//! row, so "never used" and "just reset" are the same state, not two
//! representations of it.

use rusqlite::{params, Connection};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OwnerKind {
    Trainer,
    Pokemon,
}

impl OwnerKind {
    fn as_str(self) -> &'static str {
        match self {
            OwnerKind::Trainer => "trainer",
            OwnerKind::Pokemon => "pokemon",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Scope {
    Round,
    Scene,
    Day,
}

impl Scope {
    fn as_str(self) -> &'static str {
        match self {
            Scope::Round => "round",
            Scope::Scene => "scene",
            Scope::Day => "day",
        }
    }
}

/// Records that one use of `resource_key` was spent by `owner`, in `scope`.
/// `uses_remaining` is optional display bookkeeping (e.g. "1 of 2 left");
/// the presence of the row alone is what a caller checks to know the
/// resource has been touched this window.
pub fn record_usage(
    conn: &Connection,
    owner: OwnerKind,
    owner_id: &str,
    resource_key: &str,
    scope: Scope,
    uses_remaining: Option<i64>,
) -> rusqlite::Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO usage_counters (owner_type, owner_id, resource_key, scope, uses_remaining, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(owner_type, owner_id, resource_key) DO UPDATE SET
            scope = excluded.scope, uses_remaining = excluded.uses_remaining, updated_at = excluded.updated_at",
        params![owner.as_str(), owner_id, resource_key, scope.as_str(), uses_remaining, now],
    )?;
    Ok(())
}

pub fn is_used(conn: &Connection, owner: OwnerKind, owner_id: &str, resource_key: &str) -> rusqlite::Result<bool> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM usage_counters WHERE owner_type = ?1 AND owner_id = ?2 AND resource_key = ?3)",
        params![owner.as_str(), owner_id, resource_key],
        |row| row.get(0),
    )
}

fn clear_scopes_for_trainer(conn: &Connection, trainer_id: &str, scopes: &[Scope]) -> rusqlite::Result<usize> {
    let placeholders = scopes.iter().map(|s| format!("'{}'", s.as_str())).collect::<Vec<_>>().join(",");
    let sql = format!(
        "DELETE FROM usage_counters
         WHERE scope IN ({placeholders})
           AND ((owner_type = 'trainer' AND owner_id = ?1)
             OR (owner_type = 'pokemon' AND owner_id IN (SELECT id FROM pokemon_instances WHERE trainer_id = ?1)))"
    );
    conn.execute(&sql, params![trainer_id])
}

/// `Next Round`: clears round-scoped counters only.
pub fn next_round(conn: &Connection, trainer_id: &str) -> rusqlite::Result<usize> {
    clear_scopes_for_trainer(conn, trainer_id, &[Scope::Round])
}

/// `End Scene`: a new scene also starts a new round, so both reset.
pub fn end_scene(conn: &Connection, trainer_id: &str) -> rusqlite::Result<usize> {
    clear_scopes_for_trainer(conn, trainer_id, &[Scope::Round, Scope::Scene])
}

/// `New Day`: everything resets.
pub fn new_day(conn: &Connection, trainer_id: &str) -> rusqlite::Result<usize> {
    clear_scopes_for_trainer(conn, trainer_id, &[Scope::Round, Scope::Scene, Scope::Day])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::persistence::profiles::open_and_migrate_profiles;
    use crate::profile::model::{PokemonInstance, StorageState, TrainerProfile};
    use crate::profile::repository::save_trainer_profile;

    fn seed() -> (std::path::PathBuf, Connection) {
        let dir = std::env::temp_dir().join(format!("ptu-reset-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut conn = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
        let profile = TrainerProfile {
            id: "t1".to_string(),
            name: "Reset Test".to_string(),
            level: 5,
            exp: 0,
            money: 0,
            pokemon: vec![PokemonInstance {
                id: "pkm-1".to_string(),
                species_definition_id: "sableye".to_string(),
                nickname: None,
                level: 20,
                exp: None,
                capture_ball_item_id: None,
                injuries: 0,
                held_item_id: None,
                storage_state: StorageState::Carried,
                roster_memberships: vec![],
                battle_state: None,
                ..Default::default()
            }],
            ..TrainerProfile::default()
        };
        save_trainer_profile(&mut conn, &profile).unwrap();
        (dir, conn)
    }

    #[test]
    fn next_round_clears_only_round_scope() {
        let (dir, conn) = seed();
        record_usage(&conn, OwnerKind::Pokemon, "pkm-1", "move:quick-attack", Scope::Round, None).unwrap();
        record_usage(&conn, OwnerKind::Pokemon, "pkm-1", "move:hyper-beam", Scope::Scene, None).unwrap();
        record_usage(&conn, OwnerKind::Trainer, "t1", "feature:daily-charge", Scope::Day, None).unwrap();

        next_round(&conn, "t1").unwrap();

        assert!(!is_used(&conn, OwnerKind::Pokemon, "pkm-1", "move:quick-attack").unwrap());
        assert!(is_used(&conn, OwnerKind::Pokemon, "pkm-1", "move:hyper-beam").unwrap());
        assert!(is_used(&conn, OwnerKind::Trainer, "t1", "feature:daily-charge").unwrap());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn end_scene_clears_round_and_scene_but_not_day() {
        let (dir, conn) = seed();
        record_usage(&conn, OwnerKind::Pokemon, "pkm-1", "move:quick-attack", Scope::Round, None).unwrap();
        record_usage(&conn, OwnerKind::Pokemon, "pkm-1", "move:hyper-beam", Scope::Scene, None).unwrap();
        record_usage(&conn, OwnerKind::Trainer, "t1", "feature:daily-charge", Scope::Day, None).unwrap();

        end_scene(&conn, "t1").unwrap();

        assert!(!is_used(&conn, OwnerKind::Pokemon, "pkm-1", "move:quick-attack").unwrap());
        assert!(!is_used(&conn, OwnerKind::Pokemon, "pkm-1", "move:hyper-beam").unwrap());
        assert!(is_used(&conn, OwnerKind::Trainer, "t1", "feature:daily-charge").unwrap());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn new_day_clears_everything_for_this_trainer_only() {
        let (dir, conn) = seed();
        record_usage(&conn, OwnerKind::Pokemon, "pkm-1", "move:quick-attack", Scope::Round, None).unwrap();
        record_usage(&conn, OwnerKind::Trainer, "t1", "feature:daily-charge", Scope::Day, None).unwrap();
        record_usage(&conn, OwnerKind::Trainer, "other-trainer", "feature:daily-charge", Scope::Day, None).unwrap();

        new_day(&conn, "t1").unwrap();

        assert!(!is_used(&conn, OwnerKind::Pokemon, "pkm-1", "move:quick-attack").unwrap());
        assert!(!is_used(&conn, OwnerKind::Trainer, "t1", "feature:daily-charge").unwrap());
        assert!(is_used(&conn, OwnerKind::Trainer, "other-trainer", "feature:daily-charge").unwrap(), "other trainers' counters must be untouched");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
