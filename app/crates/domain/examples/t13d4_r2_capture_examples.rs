//! T13D4-R2: prints REAL serialized success/invalid/stale/replay examples
//! for `preview_trainer_milestone_reconciliation`/
//! `commit_trainer_milestone_reconciliation` (Core pp19-20) against the
//! actual shipped `ptu-core-1.05.ptucp` pack and isolated SQLite — the
//! evidence behind `T13D4_R2_SERIALIZED_EXAMPLES.md`.
//! Run with: `cargo run -p ptu-domain --example t13d4_r2_capture_examples`.
//! Not part of the test suite; a one-off evidence-capture tool. The same
//! fixtures are exercised, and pass, in
//! `app/crates/domain/tests/trainer_milestone_reconciliation.rs`.

use ptu_domain::content::context::get_content_context;
use ptu_domain::content::import::import_pack_file;
use ptu_domain::content::ruleset::load_preset;
use ptu_domain::engine::datasets::load_trainer_build_rules;
use ptu_domain::engine::trainer_build::{
    commit_trainer_milestone_reconciliation, compute_base_revision, compute_rules_fingerprint, preview_trainer_milestone_reconciliation, CommitTrainerMilestoneReconciliationRequest,
    PreviewTrainerMilestoneReconciliationRequest,
};
use ptu_domain::persistence::definitions::open_and_migrate_definitions;
use ptu_domain::persistence::profiles::open_and_migrate_profiles;
use ptu_domain::profile::model::{StatAllocationEntry, StatAllocationSource, TrainerCombatStat, TrainerProfile, TrainerStatAllocation};
use ptu_domain::profile::repository::{load_trainer_profile, new_id, save_trainer_profile};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::path::Path;

fn skills_map(entries: &[(&str, &str)]) -> Value {
    let mut map = serde_json::Map::new();
    for (id, rank) in entries {
        map.insert(id.to_string(), json!({"base_rank": rank}));
    }
    Value::Object(map)
}

fn seed_legacy_level_10_trainer(profiles: &mut Connection) -> TrainerProfile {
    let profile = TrainerProfile {
        id: new_id(),
        name: "Legacy Reconciliation Example".to_string(),
        level: 10,
        skills: skills_map(&[("acrobatics", "novice"), ("focus", "novice")]),
        stat_allocation: TrainerStatAllocation { entries: vec![StatAllocationEntry { stat: TrainerCombatStat::Hp, source: StatAllocationSource::Creation, level: 1, points: 3, note: None, source_id: None }] },
        progression: vec![],
        build_state: Some(json!({"status": "published"})),
        ..TrainerProfile::default()
    };
    save_trainer_profile(profiles, &profile).unwrap();
    profile
}

fn base_revision_for(definitions: &Connection, revision: &str, profile: &TrainerProfile) -> String {
    let rules = load_trainer_build_rules(definitions, "ptu-core-1.05").unwrap();
    let fingerprint = compute_rules_fingerprint("ptu-core-1.05", &rules, revision);
    compute_base_revision(profile, &fingerprint)
}

fn not_received(note: &str) -> Value {
    json!({"disposition": "not_received", "note": note})
}

fn main() {
    let repo_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let dir = std::env::temp_dir().join(format!("ptu-d4-r2-capture-examples-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let mut definitions = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    let mut profiles = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
    let packs_dir = repo_root.join("content_packs");
    let rulesets_dir = repo_root.join("rulesets");
    import_pack_file(&mut definitions, &packs_dir.join("ptu-core-1.05.ptucp")).unwrap();
    let ruleset = load_preset(&rulesets_dir, "ptu-core-only").unwrap().unwrap();
    let revision = get_content_context(&definitions, &ruleset, &rulesets_dir, &packs_dir).unwrap().revision;

    println!("=== 1. preview_trainer_milestone_reconciliation — SUCCESS (level-10 legacy Trainer, level-5 stream, not_received) ===");
    let profile = seed_legacy_level_10_trainer(&mut profiles);
    let base_revision = base_revision_for(&definitions, &revision, &profile);
    let preview_request = PreviewTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision.clone(),
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: not_received("GM confirmed: this legacy Trainer never received any level-5 stream benefit before today."),
    };
    let preview = preview_trainer_milestone_reconciliation(&definitions, &profiles, &ruleset, &revision, &preview_request).unwrap();
    println!("{}", serde_json::to_string_pretty(&preview).unwrap());

    println!("\n=== 2. commit_trainer_milestone_reconciliation — SUCCESS (same request, real persisted effect) ===");
    let commit_request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: not_received("GM confirmed: this legacy Trainer never received any level-5 stream benefit before today."),
        confirm: true,
        operation_id: uuid::Uuid::new_v4().to_string(),
    };
    let commit = commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &commit_request).unwrap();
    println!("{}", serde_json::to_string_pretty(&commit).unwrap());
    let persisted = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    println!("\n--- persisted TrainerProfile (reloaded from SQLite): level={} (unchanged), progression entries={}, milestone stat entries={} ---", persisted.level, persisted.progression.len(), persisted.stat_allocation.entries.iter().filter(|e| e.source_id.is_some()).count());

    println!("\n=== 3. commit_trainer_milestone_reconciliation — INVALID (already resolved) ===");
    let profile_after = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    let repeat_request = CommitTrainerMilestoneReconciliationRequest { expected_base_revision: base_revision_for(&definitions, &revision, &profile_after), operation_id: uuid::Uuid::new_v4().to_string(), ..commit_request.clone() };
    let repeat_result = commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &repeat_request);
    println!("{}", serde_json::to_string_pretty(&repeat_result.unwrap_err()).unwrap());

    println!("\n=== 4. GM change resource grant, then map_existing prior_benefits — ADOPT an existing stat entry instead of granting a new one ===");
    let mapping_profile = seed_legacy_level_10_trainer(&mut profiles);
    let mut with_legacy = mapping_profile.clone();
    let legacy_entry = StatAllocationEntry { stat: TrainerCombatStat::SpecialAttack, source: StatAllocationSource::GmOverride, level: 3, points: 2, note: Some("Legacy campaign note: GM granted +2 Special Attack around level 3.".to_string()), source_id: None };
    with_legacy.stat_allocation.entries.push(legacy_entry.clone());
    save_trainer_profile(&mut profiles, &with_legacy).unwrap();
    let expected_value = serde_json::to_value(&legacy_entry).unwrap();
    let mapping_request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: mapping_profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &with_legacy),
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("special_attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: json!({
            "disposition": "map_existing",
            "note": "GM confirmed: the level-3 +2 Special Attack entry IS the level-5 retroactive stream bonus, granted early by mistake.",
            "mappings": [{"benefit_id": "reconcile:5:retroactive", "kind": "stat_entry", "index": 1, "expected_value": expected_value}],
        }),
        confirm: true,
        operation_id: uuid::Uuid::new_v4().to_string(),
    };
    let mapping_commit = commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &mapping_request).unwrap();
    println!("{}", serde_json::to_string_pretty(&mapping_commit.resolution).unwrap());

    println!("\n=== 5. commit_trainer_milestone_reconciliation — STALE (content changed underneath a held base_revision) ===");
    let stale_profile = seed_legacy_level_10_trainer(&mut profiles);
    let stale_base_revision = base_revision_for(&definitions, &revision, &stale_profile);
    let mut mutated = load_trainer_profile(&profiles, &stale_profile.id).unwrap().unwrap();
    mutated.stat_allocation.entries.push(StatAllocationEntry { stat: TrainerCombatStat::Defense, source: StatAllocationSource::Creation, level: 1, points: 1, note: None, source_id: None });
    save_trainer_profile(&mut profiles, &mutated).unwrap();
    let stale_request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: stale_profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: stale_base_revision,
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: not_received("n/a"),
        confirm: true,
        operation_id: uuid::Uuid::new_v4().to_string(),
    };
    let stale_result = commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &stale_request);
    println!("{}", serde_json::to_string_pretty(&stale_result.unwrap_err()).unwrap());

    let _ = std::fs::remove_dir_all(&dir);
}
