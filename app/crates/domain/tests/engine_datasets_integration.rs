//! Proves the full pipeline: `.ptucp` import (T02) -> `content_datasets` ->
//! `engine::datasets` loaders -> engine functions, using the real
//! `ptu-core-1.05` pack rather than hand-copied dataset rows.

use std::path::{Path, PathBuf};

use ptu_domain::content::import::import_pack_file;
use ptu_domain::engine::datasets::{
    load_damage_chart, load_pokemon_progression_rules, load_trainer_milestones, load_trainer_progression,
};
use ptu_domain::engine::progression::{resolve_pokemon_level_up, resolve_trainer_level_up};
use ptu_domain::engine::resolved_move::resolve_damage;
use ptu_domain::persistence::definitions::open_and_migrate_definitions;

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..")
}

#[test]
fn real_core_pack_datasets_drive_the_same_engine_results() {
    let dir = std::env::temp_dir().join(format!("ptu-engine-datasets-it-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();

    let core_pack_path = repo_root().join("content_packs/ptu-core-1.05.ptucp");
    import_pack_file(&mut conn, &core_pack_path).unwrap();

    let damage_chart = load_damage_chart(&conn, "ptu-core-1.05").unwrap();
    let resolved = resolve_damage(4, "Dark", &["Dark".to_string()], 15, &damage_chart).unwrap();
    assert_eq!(resolved.damage_expression, "2d6+23");

    let pokemon_rules = load_pokemon_progression_rules(&conn, "ptu-core-1.05").unwrap();
    let level5 = resolve_pokemon_level_up(5, &pokemon_rules);
    assert!(level5.tutor_point_awarded);
    assert!(!level5.ability_unlock);
    let level20 = resolve_pokemon_level_up(20, &pokemon_rules);
    assert!(level20.ability_unlock);

    let trainer_progression = load_trainer_progression(&conn, "ptu-core-1.05").unwrap();
    let trainer_milestones = load_trainer_milestones(&conn, "ptu-core-1.05").unwrap();
    let level5_trainer = resolve_trainer_level_up(5, &trainer_progression, &trainer_milestones).unwrap();
    assert_eq!(level5_trainer.baseline_stat_point, 1);
    assert_eq!(level5_trainer.baseline_feature, 1);
    assert!(level5_trainer.milestone_choice_required);

    let _ = std::fs::remove_dir_all(&dir);
}
