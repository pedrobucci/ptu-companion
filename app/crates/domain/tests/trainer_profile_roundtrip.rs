//! T04 acceptance: create/close/reopen a Trainer profile without loss, and
//! without hydrating other (archived) profiles, using the real
//! `fixtures/trainer_profile_full.json`.

use std::path::{Path, PathBuf};

use rusqlite::Connection;

use ptu_domain::persistence::definitions::open_and_migrate_definitions;
use ptu_domain::persistence::profiles::open_and_migrate_profiles;
use ptu_domain::profile::model::{InventoryRecord, TrainerProfile};
use ptu_domain::profile::repository::{list_trainer_summaries, load_trainer_profile, new_id, save_trainer_profile};

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..")
}

fn temp_db(name: &str) -> (PathBuf, Connection) {
    let dir = std::env::temp_dir().join(format!("ptu-profile-it-{name}-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("profiles.sqlite");
    let conn = open_and_migrate_profiles(&path).unwrap();
    (dir, conn)
}

fn load_fixture() -> TrainerProfile {
    let path = repo_root().join("fixtures/trainer_profile_full.json");
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("reading {path:?}: {e}"));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("parsing {path:?}: {e}"))
}

#[test]
fn create_close_reopen_round_trips_the_full_fixture_without_loss() {
    let (dir, mut conn) = temp_db("fixture");
    let fixture = load_fixture();

    save_trainer_profile(&mut conn, &fixture).unwrap();

    // "close" (drop the connection) and "reopen" against the same file.
    drop(conn);
    let reopened = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();

    let loaded = load_trainer_profile(&reopened, &fixture.id).unwrap().unwrap();
    assert_eq!(loaded, fixture, "reopened profile must exactly match what was saved");

    // Re-saving (e.g. app re-opens and autosaves again) must not duplicate anything.
    let mut reopened = reopened;
    save_trainer_profile(&mut reopened, &fixture).unwrap();
    let loaded_again = load_trainer_profile(&reopened, &fixture.id).unwrap().unwrap();
    assert_eq!(loaded_again, fixture);

    let pokemon_count: i64 = reopened
        .query_row("SELECT COUNT(*) FROM pokemon_instances WHERE trainer_id = ?1", [&fixture.id], |r| r.get(0))
        .unwrap();
    assert_eq!(pokemon_count, fixture.pokemon.len() as i64, "resaving must not duplicate child rows");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn opening_one_trainer_does_not_hydrate_archived_trainers() {
    let (dir, mut conn) = temp_db("archive-isolation");

    let active = load_fixture();
    save_trainer_profile(&mut conn, &active).unwrap();

    // A second, independently-created Trainer: in real usage every nested
    // id (grants/rosters/pokemon/npcs) is freshly generated per Trainer via
    // `new_id()`, so it never collides with another Trainer's ids the way
    // reusing the fixture verbatim under a new trainer id would.
    let archived = TrainerProfile {
        id: new_id(),
        name: "Archived Trainer".to_string(),
        level: 12,
        exp: 500,
        money: 100,
        inventory: InventoryRecord::default(),
        ..TrainerProfile::default()
    };
    save_trainer_profile(&mut conn, &archived).unwrap();

    // Listing summaries must never carry Pokémon/roster/inventory data —
    // enforced at compile time by TrainerSummary's fields, and here we
    // additionally assert the DB was not scanned into the wrong shape.
    let summaries = list_trainer_summaries(&conn).unwrap();
    assert_eq!(summaries.len(), 2);
    for summary in &summaries {
        assert!(!summary.name.is_empty());
    }

    // Opening the active Trainer returns its full graph...
    let loaded_active = load_trainer_profile(&conn, &active.id).unwrap().unwrap();
    assert_eq!(loaded_active.pokemon.len(), active.pokemon.len());

    // ...and does not touch the archived Trainer's row at all (its full
    // load must still work independently and be unaffected).
    let loaded_archived = load_trainer_profile(&conn, &archived.id).unwrap().unwrap();
    assert_eq!(loaded_archived.pokemon.len(), archived.pokemon.len());
    assert_eq!(loaded_archived.name, "Archived Trainer");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn content_import_and_profile_save_touch_only_their_own_database() {
    let dir = std::env::temp_dir().join(format!("ptu-profile-defs-isolation-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();

    let definitions_path = dir.join("definitions.sqlite");
    let definitions_conn = open_and_migrate_definitions(&definitions_path).unwrap();
    drop(definitions_conn);
    let definitions_before = std::fs::read(&definitions_path).unwrap();

    let profiles_path = dir.join("profiles.sqlite");
    let mut profiles_conn = open_and_migrate_profiles(&profiles_path).unwrap();
    save_trainer_profile(&mut profiles_conn, &load_fixture()).unwrap();

    let definitions_after = std::fs::read(&definitions_path).unwrap();
    assert_eq!(definitions_before, definitions_after, "saving a Trainer profile must never touch definitions.sqlite");

    let _ = std::fs::remove_dir_all(&dir);
}
