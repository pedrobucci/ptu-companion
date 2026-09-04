//! Verifies T06 directly against the real `test_vectors/storage_roster.json`.

use std::path::{Path, PathBuf};

use serde_json::Value;

use ptu_domain::engine::roster::{add_membership, list_roster_member_ids};
use ptu_domain::engine::storage::{can_enter_storage, transfer_to_storage};
use ptu_domain::persistence::profiles::open_and_migrate_profiles;
use ptu_domain::profile::model::{BattleState, PokemonInstance, RosterRecord, StorageState, TrainerProfile};
use ptu_domain::profile::repository::{load_trainer_profile, save_trainer_profile};

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..")
}

fn load_vectors() -> Vec<Value> {
    let path = repo_root().join("test_vectors/storage_roster.json");
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("reading {path:?}: {e}"));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("parsing {path:?}: {e}"))
}

fn temp_db(name: &str) -> (PathBuf, rusqlite::Connection) {
    let dir = std::env::temp_dir().join(format!("ptu-storage-roster-it-{name}-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let conn = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
    (dir, conn)
}

#[test]
fn storage_roster_vectors_pass() {
    let vectors = load_vectors();
    assert_eq!(vectors.len(), 3, "expected the 3 documented storage_roster.json vectors");

    for v in &vectors {
        let id = v["id"].as_str().unwrap();
        let input = &v["input"];
        let expected = &v["expected"];

        if input.get("injuries").is_some() {
            let injuries = input["injuries"].as_i64().unwrap();
            let allowed = can_enter_storage(injuries);
            assert_eq!(allowed, expected["allowed"].as_bool().unwrap(), "vector {id}");

            if allowed {
                // Full end-to-end transfer, matching "storage-accept-healthy".
                let (dir, mut conn) = temp_db(id);
                let held_item_id = input["held_item_id"].as_str().unwrap();
                let profile = TrainerProfile {
                    id: "t1".to_string(),
                    name: "Vector Trainer".to_string(),
                    level: 1,
                    exp: 0,
                    money: 0,
                    pokemon: vec![PokemonInstance {
                        id: "pkm-1".to_string(),
                        species_definition_id: "sableye".to_string(),
                        nickname: None,
                        level: 1,
                        exp: None,
                        capture_ball_item_id: None,
                        injuries,
                        held_item_id: Some(held_item_id.to_string()),
                        storage_state: StorageState::Carried,
                        roster_memberships: vec![],
                        battle_state: Some(BattleState {
                            current_hp: 10,
                            temporary_hp: 0,
                            combat_stages: Default::default(),
                            statuses: vec![],
                        }),
                        ..Default::default()
                    }],
                    ..TrainerProfile::default()
                };
                save_trainer_profile(&mut conn, &profile).unwrap();

                let outcome = transfer_to_storage(&mut conn, "pkm-1").unwrap_or_else(|e| panic!("vector {id}: {e}"));
                assert_eq!(outcome.held_item_returned.as_deref(), Some(held_item_id), "vector {id}");
                assert!(outcome.battle_state_cleared, "vector {id}");

                let reloaded = load_trainer_profile(&conn, "t1").unwrap().unwrap();
                assert_eq!(
                    expected["held_item_destination"].as_str().unwrap(),
                    "trainer_backpack",
                    "vector {id}"
                );
                assert_eq!(reloaded.inventory.backpack[0].item_id, held_item_id, "vector {id}");
                assert!(reloaded.pokemon[0].battle_state.is_none(), "vector {id}");

                let _ = std::fs::remove_dir_all(&dir);
            }
        } else if input.get("rosters").is_some() {
            let (dir, conn) = temp_db(id);
            let pokemon_id = input["pokemon_id"].as_str().unwrap();
            let roster_ids: Vec<String> = input["rosters"]
                .as_array()
                .unwrap()
                .iter()
                .map(|r| r["id"].as_str().unwrap().to_string())
                .collect();

            let mut profile = TrainerProfile {
                id: "t1".to_string(),
                name: "Vector Trainer".to_string(),
                level: 1,
                exp: 0,
                money: 0,
                pokemon: vec![PokemonInstance {
                    id: pokemon_id.to_string(),
                    species_definition_id: "sableye".to_string(),
                    nickname: None,
                    level: 1,
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
            for roster_id in &roster_ids {
                profile.rosters.push(RosterRecord {
                    id: roster_id.clone(),
                    name: roster_id.clone(),
                    active: true,
                    max_members: None,
                    rules: serde_json::json!({}),
                });
            }
            let mut conn = conn;
            save_trainer_profile(&mut conn, &profile).unwrap();

            for roster_id in &roster_ids {
                add_membership(&conn, roster_id, pokemon_id).unwrap_or_else(|e| panic!("vector {id}: {e}"));
            }

            let mut total_memberships = 0;
            for roster_id in &roster_ids {
                total_memberships += list_roster_member_ids(&conn, roster_id).unwrap().len();
            }
            assert!(expected["valid"].as_bool().unwrap());
            assert_eq!(total_memberships as i64, expected["membership_count"].as_i64().unwrap(), "vector {id}");

            let _ = std::fs::remove_dir_all(&dir);
        } else {
            panic!("vector {id}: unrecognized storage_roster.json vector shape");
        }
    }
}
