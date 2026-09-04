//! Roster membership operations (technical spec section 9): a Pokémon may
//! belong to multiple simultaneously active rosters. Membership is a
//! targeted mutation (add/remove one row), unlike T04's whole-profile save,
//! since combat/roster screens will call this per-action.

use rusqlite::{params, Connection};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum RosterError {
    #[error("roster \"{0}\" not found")]
    RosterNotFound(String),
    #[error("roster \"{roster_id}\" is at capacity ({max_members} members)")]
    AtCapacity { roster_id: String, max_members: i64 },
    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

/// Adds `pokemon_id` to `roster_id`. Idempotent (adding an existing member
/// again is a no-op, not an error). Enforces the roster's `max_members`
/// restriction when set (spec 9) — a capacity limit is a normal,
/// GM-overridable-by-editing-the-roster restriction, unlike the storage
/// injury invariant, so this is a plain error the caller can choose to
/// resolve (e.g. by raising `max_members`) rather than a non-bypassable gate.
pub fn add_membership(conn: &Connection, roster_id: &str, pokemon_id: &str) -> Result<(), RosterError> {
    let max_members: Option<i64> = conn
        .query_row("SELECT max_members FROM rosters WHERE id = ?1", params![roster_id], |row| row.get(0))
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => RosterError::RosterNotFound(roster_id.to_string()),
            other => RosterError::Sqlite(other),
        })?;

    let already_member: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM roster_memberships WHERE roster_id = ?1 AND pokemon_id = ?2)",
        params![roster_id, pokemon_id],
        |row| row.get(0),
    )?;
    if already_member {
        return Ok(());
    }

    if let Some(max) = max_members {
        let current_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM roster_memberships WHERE roster_id = ?1",
            params![roster_id],
            |row| row.get(0),
        )?;
        if current_count >= max {
            return Err(RosterError::AtCapacity {
                roster_id: roster_id.to_string(),
                max_members: max,
            });
        }
    }

    let next_sequence: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sequence) + 1, 0) FROM roster_memberships WHERE pokemon_id = ?1",
        params![pokemon_id],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT INTO roster_memberships (roster_id, pokemon_id, sequence) VALUES (?1, ?2, ?3)",
        params![roster_id, pokemon_id, next_sequence],
    )?;
    Ok(())
}

pub fn remove_membership(conn: &Connection, roster_id: &str, pokemon_id: &str) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM roster_memberships WHERE roster_id = ?1 AND pokemon_id = ?2",
        params![roster_id, pokemon_id],
    )?;
    Ok(())
}

pub fn list_roster_member_ids(conn: &Connection, roster_id: &str) -> rusqlite::Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT pokemon_id FROM roster_memberships WHERE roster_id = ?1 ORDER BY sequence")?;
    let rows = stmt.query_map(params![roster_id], |row| row.get(0))?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::persistence::profiles::open_and_migrate_profiles;
    use crate::profile::model::{PokemonInstance, RosterRecord, StorageState, TrainerProfile};
    use crate::profile::repository::save_trainer_profile;
    use serde_json::json;

    fn seed(max_members: Option<i64>) -> (std::path::PathBuf, Connection) {
        let dir = std::env::temp_dir().join(format!("ptu-roster-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut conn = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();

        let pokemon = |id: &str| PokemonInstance {
            id: id.to_string(),
            species_definition_id: "sableye".to_string(),
            nickname: None,
            level: 5,
            exp: None,
            capture_ball_item_id: None,
            injuries: 0,
            held_item_id: None,
            storage_state: StorageState::Carried,
            roster_memberships: vec![],
            battle_state: None,
            ..Default::default()
        };

        let profile = TrainerProfile {
            id: "t1".to_string(),
            name: "Roster Test".to_string(),
            level: 5,
            exp: 0,
            money: 0,
            rosters: vec![
                RosterRecord { id: "personal".to_string(), name: "Personal".to_string(), active: true, max_members, rules: json!({}) },
                RosterRecord { id: "company".to_string(), name: "Company".to_string(), active: true, max_members: None, rules: json!({}) },
            ],
            pokemon: vec![pokemon("pkm-1"), pokemon("pkm-2")],
            ..TrainerProfile::default()
        };
        save_trainer_profile(&mut conn, &profile).unwrap();
        (dir, conn)
    }

    /// `test_vectors/storage_roster.json` "overlapping-active-rosters".
    #[test]
    fn a_pokemon_can_belong_to_two_active_rosters_at_once() {
        let (dir, conn) = seed(None);
        add_membership(&conn, "personal", "pkm-1").unwrap();
        add_membership(&conn, "company", "pkm-1").unwrap();

        let personal_members = list_roster_member_ids(&conn, "personal").unwrap();
        let company_members = list_roster_member_ids(&conn, "company").unwrap();
        assert_eq!(personal_members, vec!["pkm-1"]);
        assert_eq!(company_members, vec!["pkm-1"]);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn adding_the_same_member_twice_is_idempotent() {
        let (dir, conn) = seed(None);
        add_membership(&conn, "personal", "pkm-1").unwrap();
        add_membership(&conn, "personal", "pkm-1").unwrap();
        assert_eq!(list_roster_member_ids(&conn, "personal").unwrap().len(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn max_members_capacity_is_enforced() {
        let (dir, conn) = seed(Some(1));
        add_membership(&conn, "personal", "pkm-1").unwrap();
        let result = add_membership(&conn, "personal", "pkm-2");
        assert!(matches!(result, Err(RosterError::AtCapacity { .. })));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn removing_a_member_does_not_affect_other_rosters() {
        let (dir, conn) = seed(None);
        add_membership(&conn, "personal", "pkm-1").unwrap();
        add_membership(&conn, "company", "pkm-1").unwrap();
        remove_membership(&conn, "personal", "pkm-1").unwrap();
        assert!(list_roster_member_ids(&conn, "personal").unwrap().is_empty());
        assert_eq!(list_roster_member_ids(&conn, "company").unwrap(), vec!["pkm-1"]);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
