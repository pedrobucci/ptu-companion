//! T13D1 acceptance: "Source matrix covers exact Background, eight Skill
//! Edges, restricted pools and all five choice milestones; expected values
//! pinned with page/source." `test_vectors/trainer_build/trainer_build_rules.json`
//! is the pinned, source-cited contract; this test loads the REAL
//! narrowly-packaged `trainer_build_rules` dataset (via the actual
//! `ptu-core-1.05.ptucp` file, the same one the app ships) and cross-checks
//! every vector — never comparing the dataset against itself.

use std::path::{Path, PathBuf};

use ptu_domain::content::import::import_pack_file;
use ptu_domain::engine::datasets::{load_trainer_build_rules, TrainerBuildRules};
use ptu_domain::persistence::definitions::open_and_migrate_definitions;
use serde_json::Value;

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..")
}

fn load_rules() -> TrainerBuildRules {
    let dir = std::env::temp_dir().join(format!("ptu-trainer-build-vectors-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    let core_pack_path = repo_root().join("content_packs/ptu-core-1.05.ptucp");
    import_pack_file(&mut conn, &core_pack_path).unwrap();
    let rules = load_trainer_build_rules(&conn, "ptu-core-1.05").unwrap();
    let _ = std::fs::remove_dir_all(&dir);
    rules
}

fn vectors() -> Vec<Value> {
    let text = std::fs::read_to_string(repo_root().join("test_vectors/trainer_build/trainer_build_rules.json")).unwrap();
    serde_json::from_str(&text).unwrap()
}

fn find<'a>(vectors: &'a [Value], id: &str) -> &'a Value {
    vectors.iter().find(|v| v["id"] == id).unwrap_or_else(|| panic!("golden vector \"{id}\" not found"))
}

#[test]
fn trainer_build_rules_vectors_pass() {
    let rules = load_rules();
    let vectors = vectors();

    let v = find(&vectors, "skills-catalog-is-exactly-17-across-three-groups");
    assert_eq!(rules.skills.count, v["expected"]["count"].as_i64().unwrap());
    assert_eq!(rules.skills.groups.body.len(), v["expected"]["body_count"].as_u64().unwrap() as usize);
    assert_eq!(rules.skills.groups.mind.len(), v["expected"]["mind_count"].as_u64().unwrap() as usize);
    assert_eq!(rules.skills.groups.spirit.len(), v["expected"]["spirit_count"].as_u64().unwrap() as usize);
    let body_ids: Vec<&str> = rules.skills.groups.body.iter().map(|s| s.id.as_str()).collect();
    let expected_body_ids: Vec<&str> = v["expected"]["body_ids"].as_array().unwrap().iter().map(|s| s.as_str().unwrap()).collect();
    assert_eq!(body_ids, expected_body_ids);

    let v = find(&vectors, "core-rank-ordinal-table");
    let expected_ranks = v["expected"]["ranks"].as_array().unwrap();
    assert_eq!(rules.rank_table.ranks.len(), expected_ranks.len());
    for (actual, expected) in rules.rank_table.ranks.iter().zip(expected_ranks) {
        assert_eq!(actual.name, expected["name"].as_str().unwrap());
        assert_eq!(actual.ordinal, expected["ordinal"].as_i64().unwrap());
        assert_eq!(actual.dice, expected["dice"].as_i64().unwrap());
    }

    let v = find(&vectors, "ordinary-rank-caps-by-level");
    let caps = &rules.rank_table.ordinary_rank_caps_by_level;
    assert_eq!(caps.novice_available_at_level, v["expected"]["novice_available_at_level"].as_i64().unwrap());
    assert_eq!(caps.adept_available_at_level, v["expected"]["adept_available_at_level"].as_i64().unwrap());
    assert_eq!(caps.expert_available_at_level, v["expected"]["expert_available_at_level"].as_i64().unwrap());
    assert_eq!(caps.master_available_at_level, v["expected"]["master_available_at_level"].as_i64().unwrap());
    assert_eq!(caps.background_adept_is_level_1_exception, v["expected"]["background_adept_is_level_1_exception"].as_bool().unwrap());

    let v = find(&vectors, "background-rule");
    assert_eq!(rules.background.adept_skill_count, v["expected"]["adept_skill_count"].as_i64().unwrap());
    assert_eq!(rules.background.novice_skill_count, v["expected"]["novice_skill_count"].as_i64().unwrap());
    assert_eq!(rules.background.pathetic_skill_count, v["expected"]["pathetic_skill_count"].as_i64().unwrap());
    assert_eq!(rules.background.remaining_skills_rank, v["expected"]["remaining_skills_rank"].as_str().unwrap());
    assert!(rules.background.pathetic_skills_locked_during_creation);

    let v = find(&vectors, "eight-skill-edges-exactly");
    let expected_ids: Vec<&str> = v["expected"]["ids"].as_array().unwrap().iter().map(|s| s.as_str().unwrap()).collect();
    let actual_ids: Vec<&str> = rules.skill_edges.entries.iter().map(|e| e.id.as_str()).collect();
    assert_eq!(actual_ids, expected_ids, "must be exactly the eight Core p52 Skill Edges, in this order, no more/less");
    let virtuoso = rules.skill_edges.entries.iter().find(|e| e.id == "virtuoso").unwrap();
    assert_eq!(virtuoso.effective_rank_for_effects, v["expected"]["virtuoso_effective_rank_for_effects"].as_i64());
    assert_eq!(virtuoso.grants_extra_dice, v["expected"]["virtuoso_grants_extra_dice"].as_bool());
    let skill_enhancement = rules.skill_edges.entries.iter().find(|e| e.id == "skill-enhancement").unwrap();
    assert_eq!(skill_enhancement.check_bonus, v["expected"]["skill_enhancement_check_bonus"].as_i64());
    let categoric = rules.skill_edges.entries.iter().find(|e| e.id == "categoric-inclination").unwrap();
    assert_eq!(categoric.check_bonus, v["expected"]["categoric_inclination_check_bonus"].as_i64());
    assert_eq!(categoric.repeatable, v["expected"]["categoric_inclination_repeatable"].as_bool().unwrap());

    let v = find(&vectors, "elemental-connection-modes");
    let ec = &rules.elemental_connection;
    assert_eq!(ec.definition_version_id, v["expected"]["definition_version_id"].as_str().unwrap());
    assert_eq!(ec.conflicts_with_definition_version_id, v["expected"]["conflicts_with_definition_version_id"].as_str().unwrap());
    assert_eq!(ec.check_bonus, v["expected"]["check_bonus"].as_i64().unwrap());
    assert_eq!(ec.modes.core.allow_repeat, v["expected"]["core_mode_allow_repeat"].as_bool().unwrap());
    assert_eq!(ec.modes.campaign_variant_distinct_type.allow_repeat, v["expected"]["campaign_variant_allow_repeat"].as_bool().unwrap());
    assert_eq!(
        ec.modes.campaign_variant_distinct_type.repeat_rule.as_deref(),
        v["expected"]["campaign_variant_repeat_rule"].as_str()
    );
    assert_eq!(ec.mutual_exclusion_applies_in_all_modes, v["expected"]["mutual_exclusion_applies_in_all_modes"].as_bool().unwrap());

    let v = find(&vectors, "four-free-training-features");
    let expected_dvis: Vec<&str> = v["expected"]["definition_version_ids"].as_array().unwrap().iter().map(|s| s.as_str().unwrap()).collect();
    let actual_dvis: Vec<&str> = rules.training_features.options.iter().map(|o| o.definition_version_id.as_str()).collect();
    assert_eq!(actual_dvis, expected_dvis);

    let v = find(&vectors, "creation-budget");
    assert_eq!(rules.creation_budget.paid_edges, v["expected"]["paid_edges"].as_i64().unwrap());
    assert_eq!(rules.creation_budget.paid_features, v["expected"]["paid_features"].as_i64().unwrap());
    assert_eq!(rules.creation_budget.free_training_features, v["expected"]["free_training_features"].as_i64().unwrap());

    let v = find(&vectors, "offensive-stat-streams-l5-10-20-30-40");
    let expected_streams = v["expected"]["streams"].as_array().unwrap();
    assert_eq!(rules.offensive_stat_streams.streams.len(), expected_streams.len());
    for (actual, expected) in rules.offensive_stat_streams.streams.iter().zip(expected_streams) {
        assert_eq!(actual.milestone_level, expected["milestone_level"].as_i64().unwrap());
        assert_eq!(actual.ongoing_bonus_levels, expected["ongoing_bonus_levels"].as_array().unwrap().iter().map(|n| n.as_i64().unwrap()).collect::<Vec<_>>());
        assert_eq!(actual.ongoing_bonus_points_each, expected["ongoing_bonus_points_each"].as_i64().unwrap());
    }
    // Level 5's retroactive bonus is unique to that milestone.
    let level5 = rules.offensive_stat_streams.streams.iter().find(|s| s.milestone_level == 5).unwrap();
    assert_eq!(level5.retroactive_bonus_levels, vec![2, 4]);
    assert_eq!(level5.retroactive_bonus_points_each, Some(2));
}
