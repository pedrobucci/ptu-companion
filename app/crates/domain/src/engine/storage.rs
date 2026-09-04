//! Pokémon Storage transfer (technical spec section 8.3, 39): entering
//! Storage clears dynamic battle state and returns the Held Item to the
//! Trainer backpack; a Pokémon with `injuries > 0` can never enter Storage.
//!
//! The injury gate has **no override parameter anywhere in this module** —
//! not "override defaults to false", there is no code path that can skip
//! it, matching spec 8.3's "not bypassed by ordinary GM Override" as a
//! structural guarantee rather than caller discipline.

use rusqlite::{params, Connection};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("pokemon \"{0}\" has injuries and cannot enter storage")]
    HasInjuries(String),
    #[error("pokemon \"{0}\" not found")]
    PokemonNotFound(String),
    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct StorageTransferOutcome {
    pub held_item_returned: Option<String>,
    pub battle_state_cleared: bool,
}

/// The injury invariant, checked in isolation so it's independently
/// testable and has exactly one implementation the transfer function below
/// also relies on.
pub fn can_enter_storage(injuries: i64) -> bool {
    injuries <= 0
}

/// Moves a carried Pokémon into Storage. Atomic: state flag, battle-state
/// clear, and held-item return all happen in one transaction.
pub fn transfer_to_storage(conn: &mut Connection, pokemon_id: &str) -> Result<StorageTransferOutcome, StorageError> {
    let (trainer_id, injuries, held_item_id): (String, i64, Option<String>) = conn
        .query_row(
            "SELECT trainer_id, injuries, held_item_id FROM pokemon_instances WHERE id = ?1",
            params![pokemon_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => StorageError::PokemonNotFound(pokemon_id.to_string()),
            other => StorageError::Sqlite(other),
        })?;

    if !can_enter_storage(injuries) {
        return Err(StorageError::HasInjuries(pokemon_id.to_string()));
    }

    let now = chrono::Utc::now().to_rfc3339();
    let tx = conn.transaction()?;

    tx.execute(
        "UPDATE pokemon_instances SET storage_state = 'stored', held_item_id = NULL, updated_at = ?2 WHERE id = ?1",
        params![pokemon_id, now],
    )?;

    // Dynamic battle state only exists while carried/active (spec 8.2);
    // entering Storage removes it rather than zeroing it in place.
    let battle_state_cleared = tx.execute(
        "DELETE FROM combat_states WHERE owner_type = 'pokemon' AND owner_id = ?1",
        params![pokemon_id],
    )? > 0;

    if let Some(item_id) = &held_item_id {
        return_item_to_backpack(&tx, &trainer_id, item_id, &now)?;
    }

    tx.commit()?;

    Ok(StorageTransferOutcome {
        held_item_returned: held_item_id,
        battle_state_cleared,
    })
}

/// Moves a stored Pokémon back to carried (no injury restriction applies
/// to this direction).
pub fn transfer_to_carried(conn: &Connection, pokemon_id: &str) -> Result<(), StorageError> {
    let now = chrono::Utc::now().to_rfc3339();
    let changed = conn.execute(
        "UPDATE pokemon_instances SET storage_state = 'carried', updated_at = ?2 WHERE id = ?1",
        params![pokemon_id, now],
    )?;
    if changed == 0 {
        return Err(StorageError::PokemonNotFound(pokemon_id.to_string()));
    }
    Ok(())
}

fn return_item_to_backpack(
    tx: &rusqlite::Transaction,
    trainer_id: &str,
    item_id: &str,
    now: &str,
) -> rusqlite::Result<()> {
    let existing_stack: Option<(String, i64)> = tx
        .query_row(
            "SELECT id, quantity FROM inventory_stacks WHERE trainer_id = ?1 AND location = 'backpack' AND item_id = ?2",
            params![trainer_id, item_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map(Some)
        .or_else(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            other => Err(other),
        })?;

    match existing_stack {
        Some((stack_id, quantity)) => {
            tx.execute(
                "UPDATE inventory_stacks SET quantity = ?2, updated_at = ?3 WHERE id = ?1",
                params![stack_id, quantity + 1, now],
            )?;
        }
        None => {
            let next_sequence: i64 = tx.query_row(
                "SELECT COALESCE(MAX(sequence) + 1, 0) FROM inventory_stacks WHERE trainer_id = ?1 AND location = 'backpack'",
                params![trainer_id],
                |row| row.get(0),
            )?;
            tx.execute(
                "INSERT INTO inventory_stacks (id, trainer_id, location, item_id, quantity, sequence, updated_at)
                 VALUES (?1, ?2, 'backpack', ?3, 1, ?4, ?5)",
                params![crate::profile::repository::new_id(), trainer_id, item_id, next_sequence, now],
            )?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::persistence::profiles::open_and_migrate_profiles;
    use crate::profile::model::{BattleState, InventoryRecord, PokemonInstance, StorageState, TrainerProfile};
    use crate::profile::repository::{load_trainer_profile, save_trainer_profile};

    fn seed_carried_pokemon(injuries: i64, held_item_id: Option<&str>) -> (std::path::PathBuf, Connection, String) {
        let dir = std::env::temp_dir().join(format!("ptu-storage-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut conn = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();

        let pokemon_id = "pkm-1".to_string();
        let profile = TrainerProfile {
            id: "t1".to_string(),
            name: "Storage Test".to_string(),
            level: 5,
            exp: 0,
            money: 0,
            pokemon: vec![PokemonInstance {
                id: pokemon_id.clone(),
                species_definition_id: "sableye".to_string(),
                nickname: None,
                level: 20,
                exp: None,
                capture_ball_item_id: None,
                injuries,
                held_item_id: held_item_id.map(str::to_string),
                storage_state: StorageState::Carried,
                roster_memberships: vec![],
                battle_state: Some(BattleState {
                    current_hp: 10,
                    temporary_hp: 0,
                    combat_stages: Default::default(),
                    statuses: vec!["poisoned".to_string()],
                }),
                ..Default::default()
            }],
            inventory: InventoryRecord::default(),
            ..TrainerProfile::default()
        };
        save_trainer_profile(&mut conn, &profile).unwrap();
        (dir, conn, pokemon_id)
    }

    /// `test_vectors/storage_roster.json` "storage-reject-injured".
    #[test]
    fn injured_pokemon_is_rejected_with_no_override_path() {
        let (dir, mut conn, pokemon_id) = seed_carried_pokemon(1, Some("leftovers"));
        let result = transfer_to_storage(&mut conn, &pokemon_id);
        assert!(matches!(result, Err(StorageError::HasInjuries(_))));

        // Nothing changed: still carried, still holding the item.
        let profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(profile.pokemon[0].storage_state, StorageState::Carried);
        assert_eq!(profile.pokemon[0].held_item_id.as_deref(), Some("leftovers"));

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// `test_vectors/storage_roster.json` "storage-accept-healthy".
    #[test]
    fn healthy_pokemon_transfer_returns_item_and_clears_battle_state() {
        let (dir, mut conn, pokemon_id) = seed_carried_pokemon(0, Some("leftovers"));
        let outcome = transfer_to_storage(&mut conn, &pokemon_id).unwrap();
        assert_eq!(outcome.held_item_returned.as_deref(), Some("leftovers"));
        assert!(outcome.battle_state_cleared);

        let profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(profile.pokemon[0].storage_state, StorageState::Stored);
        assert_eq!(profile.pokemon[0].held_item_id, None, "held item must leave the Pokémon");
        assert!(profile.pokemon[0].battle_state.is_none(), "dynamic battle state must be cleared");
        assert_eq!(profile.inventory.backpack.len(), 1);
        assert_eq!(profile.inventory.backpack[0].item_id, "leftovers");
        assert_eq!(profile.inventory.backpack[0].quantity, 1);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn returned_item_stacks_onto_an_existing_backpack_stack() {
        let (dir, mut conn, pokemon_id) = seed_carried_pokemon(0, Some("potion"));
        // Trainer already has one Potion in the backpack.
        let mut profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        profile.inventory.backpack.push(crate::profile::model::ItemStack {
            item_id: "potion".to_string(),
            quantity: 3,
        });
        save_trainer_profile(&mut conn, &profile).unwrap();

        transfer_to_storage(&mut conn, &pokemon_id).unwrap();

        let reloaded = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(reloaded.inventory.backpack.len(), 1, "must stack, not create a second row");
        assert_eq!(reloaded.inventory.backpack[0].quantity, 4);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn transfer_is_atomic_on_a_pokemon_with_no_held_item() {
        let (dir, mut conn, pokemon_id) = seed_carried_pokemon(0, None);
        let outcome = transfer_to_storage(&mut conn, &pokemon_id).unwrap();
        assert_eq!(outcome.held_item_returned, None);

        let profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(profile.pokemon[0].storage_state, StorageState::Stored);
        assert!(profile.inventory.backpack.is_empty());

        let _ = std::fs::remove_dir_all(&dir);
    }
}
