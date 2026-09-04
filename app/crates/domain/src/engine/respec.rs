//! Respec (technical spec 17.3, 39): "Respec rebuilds normal progression
//! allocations while preserving external grants unless the grant itself is
//! explicitly removed." Concretely, this means a respec only ever touches
//! `trainer_progression` — `trainer_gm_grants` is never written by
//! anything in this module, which is what makes both Fixed and Resource
//! Grants survive a respec. A Resource Grant can still have its
//! *allocation* changed (spec 16: "may be reallocated during an authorized
//! respec") without losing the grant's origin (its `id`/`kind`/`resource`/
//! `amount`).

use rusqlite::{params, Connection};
use serde_json::Value;
use thiserror::Error;

use crate::error::ProfileError;

#[derive(Debug, Error)]
pub enum RespecError {
    #[error("grant is not a JSON object")]
    NotAnObject,
    #[error("grant kind is \"{0}\", expected \"resource\"")]
    NotAResourceGrant(String),
}

#[derive(Debug, Error)]
pub enum RespecApplyError {
    #[error(transparent)]
    Respec(#[from] RespecError),
    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("gm grant \"{0}\" not found for this trainer")]
    GrantNotFound(String),
}

/// Pure transform: keeps a Resource Grant's origin (`id`/`kind`/`resource`/
/// `amount`) and replaces only `allocation`.
pub fn reallocate_resource_grant(grant: &Value, new_allocation: Value) -> Result<Value, RespecError> {
    let obj = grant.as_object().ok_or(RespecError::NotAnObject)?;
    let kind = obj.get("kind").and_then(Value::as_str).unwrap_or("");
    if kind != "resource" {
        return Err(RespecError::NotAResourceGrant(kind.to_string()));
    }
    let mut updated = obj.clone();
    updated.insert("allocation".to_string(), new_allocation);
    Ok(Value::Object(updated))
}

/// Replaces a Trainer's structured progression ledger only — every other
/// table (including `trainer_gm_grants`) is left completely untouched.
pub fn respec_trainer_progression(
    conn: &mut Connection,
    trainer_id: &str,
    new_progression: &[Value],
) -> Result<(), ProfileError> {
    let tx = conn.transaction()?;
    tx.execute("DELETE FROM trainer_progression WHERE trainer_id = ?1", params![trainer_id])?;
    let now = chrono::Utc::now().to_rfc3339();
    for (index, entry) in new_progression.iter().enumerate() {
        let level = entry
            .get("level")
            .and_then(Value::as_i64)
            .ok_or(ProfileError::ProgressionMissingLevel { index })?;
        tx.execute(
            "INSERT INTO trainer_progression (trainer_id, level, data_json, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![trainer_id, level, serde_json::to_string(entry).unwrap_or_default(), now],
        )?;
    }
    tx.commit()?;
    Ok(())
}

/// Updates one Resource Grant's `allocation` with a targeted `UPDATE`
/// (not a whole-profile resave), per T04's guidance for narrow mutations.
pub fn apply_resource_reallocation(
    conn: &Connection,
    trainer_id: &str,
    grant_id: &str,
    new_allocation: Value,
) -> Result<Value, RespecApplyError> {
    let data_json: String = conn
        .query_row(
            "SELECT data_json FROM trainer_gm_grants WHERE trainer_id = ?1 AND id = ?2",
            params![trainer_id, grant_id],
            |row| row.get(0),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => RespecApplyError::GrantNotFound(grant_id.to_string()),
            other => RespecApplyError::Sqlite(other),
        })?;

    let grant: Value = serde_json::from_str(&data_json).unwrap_or(Value::Null);
    let updated = reallocate_resource_grant(&grant, new_allocation)?;

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE trainer_gm_grants SET data_json = ?1, updated_at = ?2 WHERE trainer_id = ?3 AND id = ?4",
        params![serde_json::to_string(&updated).unwrap_or_default(), now, trainer_id, grant_id],
    )?;

    Ok(updated)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::persistence::profiles::open_and_migrate_profiles;
    use crate::profile::model::TrainerProfile;
    use crate::profile::repository::{load_trainer_profile, save_trainer_profile};
    use serde_json::json;

    fn seed_db() -> (std::path::PathBuf, Connection) {
        let dir = std::env::temp_dir().join(format!("ptu-respec-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("profiles.sqlite");
        let conn = open_and_migrate_profiles(&path).unwrap();
        (dir, conn)
    }

    /// `test_vectors/modifier_engine.json` "resource-grant-reallocation".
    #[test]
    fn resource_grant_reallocation_matches_fixture() {
        let grant = json!({
            "id": "grant-edge",
            "kind": "resource",
            "resource": "edge",
            "amount": 1,
            "allocation": "skill-edge:charm"
        });
        let updated = reallocate_resource_grant(&grant, json!("skill-edge:command")).unwrap();
        assert_eq!(updated["allocation"], "skill-edge:command");
        assert_eq!(updated["amount"], 1);
        assert_eq!(updated["resource"], "edge");
        assert_eq!(updated["id"], "grant-edge");
    }

    #[test]
    fn fixed_grant_cannot_be_reallocated() {
        let grant = json!({"id": "grant-stealth", "kind": "fixed"});
        let result = reallocate_resource_grant(&grant, json!("anything"));
        assert!(matches!(result, Err(RespecError::NotAResourceGrant(_))));
    }

    /// spec 39: "GM Resource Grant survives respec".
    #[test]
    fn grants_survive_a_targeted_progression_respec() {
        let (dir, mut conn) = seed_db();
        let mut profile = TrainerProfile {
            id: "t1".to_string(),
            name: "Respec Test".to_string(),
            level: 5,
            exp: 0,
            money: 0,
            ..TrainerProfile::default()
        };
        profile.gm_grants = vec![
            json!({"id": "grant-stealth", "kind": "fixed", "target": "trainer.skill.stealth.check_bonus", "operation": "add", "value": 2}),
            json!({"id": "grant-edge", "kind": "resource", "resource": "edge", "amount": 1, "allocation": "skill-edge:charm"}),
        ];
        profile.progression = vec![json!({"level": 1, "stat_points": 10})];
        save_trainer_profile(&mut conn, &profile).unwrap();

        respec_trainer_progression(&mut conn, "t1", &[json!({"level": 1, "stat_points": 99})]).unwrap();

        let reloaded = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(reloaded.gm_grants.len(), 2, "both grants must survive the respec untouched");
        assert_eq!(reloaded.progression, vec![json!({"level": 1, "stat_points": 99})]);

        let updated = apply_resource_reallocation(&conn, "t1", "grant-edge", json!("skill-edge:command")).unwrap();
        assert_eq!(updated["allocation"], "skill-edge:command");

        let reloaded_again = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        let resource_grant = reloaded_again
            .gm_grants
            .iter()
            .find(|g| g["id"] == "grant-edge")
            .unwrap();
        assert_eq!(resource_grant["allocation"], "skill-edge:command");
        assert_eq!(resource_grant["amount"], 1, "grant origin/amount preserved through reallocation");

        let fixed_grant = reloaded_again.gm_grants.iter().find(|g| g["id"] == "grant-stealth").unwrap();
        assert_eq!(fixed_grant["value"], 2, "fixed grant untouched by the resource grant's reallocation");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
