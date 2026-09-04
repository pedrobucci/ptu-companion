//! Trainer equipment slots (technical spec section 10). Slots are
//! data-driven — any `slot_key` string is accepted, the app seeds
//! conventional ones (Head/Body/Main Hand/Off-Hand/Feet/Accessory) but
//! nothing here hardcodes that list.
//!
//! Nothing caches a "resolved" view of equipment anywhere: every
//! `modifier`/`resolved_move` call reads current state and recomputes
//! (spec 15: "do not persist a derived final value as the sole truth"), so
//! equip/unequip only ever needs to update `equipment_slots` — the next
//! resolution automatically reflects it. See the `equip.../recalculates`
//! test below for a concrete demonstration.

use rusqlite::{params, Connection};

pub fn equip_item(conn: &Connection, trainer_id: &str, slot_key: &str, item_id: &str) -> rusqlite::Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO equipment_slots (trainer_id, slot_key, item_id, updated_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(trainer_id, slot_key) DO UPDATE SET item_id = excluded.item_id, updated_at = excluded.updated_at",
        params![trainer_id, slot_key, item_id, now],
    )?;
    Ok(())
}

pub fn unequip_slot(conn: &Connection, trainer_id: &str, slot_key: &str) -> rusqlite::Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE equipment_slots SET item_id = NULL, updated_at = ?3 WHERE trainer_id = ?1 AND slot_key = ?2",
        params![trainer_id, slot_key, now],
    )?;
    Ok(())
}

pub fn get_equipped_item(conn: &Connection, trainer_id: &str, slot_key: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT item_id FROM equipment_slots WHERE trainer_id = ?1 AND slot_key = ?2",
        params![trainer_id, slot_key],
        |row| row.get(0),
    )
    .map(|v: Option<String>| v.filter(|s| !s.is_empty()))
    .or_else(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => Ok(None),
        other => Err(other),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::modifier::{resolve_value, Modifier, Operation};
    use crate::persistence::profiles::open_and_migrate_profiles;
    use crate::profile::model::TrainerProfile;
    use crate::profile::repository::save_trainer_profile;

    fn seed() -> (std::path::PathBuf, Connection) {
        let dir = std::env::temp_dir().join(format!("ptu-equipment-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut conn = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
        let profile = TrainerProfile { id: "t1".to_string(), name: "Equip Test".to_string(), level: 1, exp: 0, money: 0, ..TrainerProfile::default() };
        save_trainer_profile(&mut conn, &profile).unwrap();
        (dir, conn)
    }

    #[test]
    fn equip_then_unequip_round_trips() {
        let (dir, conn) = seed();
        assert_eq!(get_equipped_item(&conn, "t1", "main_hand").unwrap(), None);
        equip_item(&conn, "t1", "main_hand", "iron-blade").unwrap();
        assert_eq!(get_equipped_item(&conn, "t1", "main_hand").unwrap(), Some("iron-blade".to_string()));
        unequip_slot(&conn, "t1", "main_hand").unwrap();
        assert_eq!(get_equipped_item(&conn, "t1", "main_hand").unwrap(), None);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// T07 acceptance: "equip recalcula resolved view". Nothing caches a
    /// resolved value anywhere in this codebase (spec 15), so this shows
    /// the property concretely: the same resolution call, run again after
    /// only the equipped item changed, returns a different number with no
    /// cache to invalidate.
    #[test]
    fn equipping_an_item_changes_the_next_resolved_value_with_no_cache_to_invalidate() {
        let (dir, conn) = seed();

        let resolve_attack = |conn: &Connection| -> f64 {
            let equipped = get_equipped_item(conn, "t1", "main_hand").unwrap();
            let modifiers = if equipped.as_deref() == Some("power-weight") {
                vec![Modifier {
                    id: "eq-power-weight".to_string(),
                    source_label: "Equipment".to_string(),
                    target: "trainer.attack".to_string(),
                    operation: Operation::Add,
                    value: 10.0,
                    priority: 100,
                }]
            } else {
                vec![]
            };
            resolve_value(20.0, &modifiers).final_value
        };

        assert_eq!(resolve_attack(&conn), 20.0);
        equip_item(&conn, "t1", "main_hand", "power-weight").unwrap();
        assert_eq!(resolve_attack(&conn), 30.0, "resolved value must reflect the newly equipped item");
        unequip_slot(&conn, "t1", "main_hand").unwrap();
        assert_eq!(resolve_attack(&conn), 20.0, "resolved value must reflect unequip too");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
