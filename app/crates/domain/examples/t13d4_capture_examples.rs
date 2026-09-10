//! T13D4: prints REAL serialized success/invalid/stale/replay examples for
//! `preview_trainer_advancement`/`commit_trainer_advancement`/
//! `preview_trainer_gm_change`/`commit_trainer_gm_change`/
//! `preview_trainer_respec`/`commit_trainer_respec` (Core pp17-20) against
//! the actual shipped `ptu-core-1.05.ptucp` pack and isolated SQLite — the
//! evidence behind `T13D4_SERIALIZED_EXAMPLES.md`.
//! Run with: `cargo run -p ptu-domain --example t13d4_capture_examples`.
//! Not part of the test suite; a one-off evidence-capture tool, kept in the
//! repo so the examples are reproducible rather than hand-typed. The same
//! fixtures are exercised, and pass, in
//! `app/crates/domain/tests/trainer_advancement.rs`.

use ptu_domain::content::context::get_content_context;
use ptu_domain::content::import::import_pack_file;
use ptu_domain::content::ruleset::load_preset;
use ptu_domain::engine::trainer_build::{
    commit_trainer_advancement, commit_trainer_gm_change, commit_trainer_respec, compute_base_revision, compute_rules_fingerprint, preview_trainer_advancement, CommitTrainerAdvancementRequest,
    CommitTrainerGmChangeRequest, CommitTrainerRespecRequest,
};
use ptu_domain::engine::datasets::load_trainer_build_rules;
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

fn seed_managed_trainer(profiles: &mut Connection, level: i64) -> TrainerProfile {
    let profile = TrainerProfile {
        id: new_id(),
        name: "Advancement Example".to_string(),
        level,
        exp: 0,
        money: 0,
        skills: skills_map(&[("acrobatics", "novice"), ("focus", "novice")]),
        stat_allocation: TrainerStatAllocation { entries: vec![StatAllocationEntry { stat: TrainerCombatStat::Hp, source: StatAllocationSource::Creation, level: 1, points: 3, note: None, source_id: None }] },
        build_state: Some(json!({"status": "published", "campaign_setup_pending": true})),
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

fn main() {
    let repo_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let dir = std::env::temp_dir().join(format!("ptu-d4-capture-examples-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let mut definitions = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    let mut profiles = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
    let packs_dir = repo_root.join("content_packs");
    let rulesets_dir = repo_root.join("rulesets");
    import_pack_file(&mut definitions, &packs_dir.join("ptu-core-1.05.ptucp")).unwrap();
    let ruleset = load_preset(&rulesets_dir, "ptu-core-only").unwrap().unwrap();
    let revision = get_content_context(&definitions, &ruleset, &rulesets_dir, &packs_dir).unwrap().revision;

    println!("=== 1. preview_trainer_advancement — SUCCESS (L1->L2, 1 ordinary Edge + 1 restricted bonus Skill Edge) ===");
    let profile = seed_managed_trainer(&mut profiles, 1);
    let base_revision = base_revision_for(&definitions, &revision, &profile);
    let ordinary_edge = json!({"role": "ordinary_edge", "kind": "edge", "definition_version_id": "edges:acrobat@core", "parameters": Value::Null});
    let restricted_bonus = json!({"role": "restricted_bonus_edge", "kind": "edge", "definition_version_id": "edges:basic-skills@core", "parameters": {"skill": "guile"}});
    let preview_request = ptu_domain::engine::trainer_build::PreviewTrainerAdvancementRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision.clone(),
        next_level: 2,
        milestone_option_id: None,
        acquired_choices: vec![ordinary_edge.clone(), restricted_bonus.clone()],
        stat_stream_choice: None,
        manual_adjudications: vec![],
    };
    let preview = preview_trainer_advancement(&definitions, &profiles, &ruleset, &revision, &preview_request).unwrap();
    println!("{}", serde_json::to_string_pretty(&preview).unwrap());

    println!("\n=== 2. commit_trainer_advancement — INVALID (level 5 milestone_choice_required, not supplied) ===");
    let l4_profile = seed_managed_trainer(&mut profiles, 4);
    let l4_base_revision = base_revision_for(&definitions, &revision, &l4_profile);
    let invalid_request = CommitTrainerAdvancementRequest {
        trainer_id: l4_profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: l4_base_revision,
        next_level: 5,
        milestone_option_id: None,
        acquired_choices: vec![json!({"role": "ordinary_feature", "kind": "feature", "definition_version_id": "features:let-me-help-you-with-that@core", "parameters": Value::Null})],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        confirm: true,
        operation_id: uuid::Uuid::new_v4().to_string(),
    };
    let invalid_result = commit_trainer_advancement(&definitions, &mut profiles, &ruleset, &revision, &invalid_request);
    println!("{}", serde_json::to_string_pretty(&invalid_result.unwrap_err()).unwrap());

    println!("\n=== 3. commit_trainer_advancement — SUCCESS, then REPLAY (same operation_id/payload), then OPERATION_CONFLICT (same operation_id, different next_level) ===");
    let commit_operation_id = uuid::Uuid::new_v4().to_string();
    let commit_request = CommitTrainerAdvancementRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        next_level: 2,
        milestone_option_id: None,
        acquired_choices: vec![ordinary_edge, restricted_bonus],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        confirm: true,
        operation_id: commit_operation_id.clone(),
    };
    let commit = commit_trainer_advancement(&definitions, &mut profiles, &ruleset, &revision, &commit_request).unwrap();
    println!("{}", serde_json::to_string_pretty(&commit).unwrap());
    let persisted = load_trainer_profile(&profiles, &commit.trainer_id).unwrap().unwrap();
    println!("\n--- persisted TrainerProfile (reloaded from SQLite): level={}, edges={} ---", persisted.level, persisted.edges.len());

    let replay = commit_trainer_advancement(&definitions, &mut profiles, &ruleset, &revision, &commit_request).unwrap();
    println!("replayed to_level == first to_level: {}", replay.resolution.to_level == commit.resolution.to_level);

    let conflicting_request = CommitTrainerAdvancementRequest { next_level: 3, ..commit_request };
    let conflict_result = commit_trainer_advancement(&definitions, &mut profiles, &ruleset, &revision, &conflicting_request);
    println!("{}", serde_json::to_string_pretty(&conflict_result.unwrap_err()).unwrap());

    println!("\n=== 4. GM change — add fixed NUMERIC grant (real +3 HP applied to core_result) ===");
    let gm_profile = seed_managed_trainer(&mut profiles, 1);
    let gm_base_revision = base_revision_for(&definitions, &revision, &gm_profile);
    let add_numeric = CommitTrainerGmChangeRequest {
        trainer_id: gm_profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: gm_base_revision,
        action: "add".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"target": "trainer.stat.hp", "operation": "add", "value": 3}),
        note: Some("GM boon for surviving the gauntlet.".to_string()),
        confirm: true,
        operation_id: uuid::Uuid::new_v4().to_string(),
    };
    let numeric_commit = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &add_numeric).unwrap();
    println!("{}", serde_json::to_string_pretty(&numeric_commit).unwrap());

    println!("\n=== 5. GM change — add fixed DEFINITIONAL grant (real linked Feature acquisition, source_id traceable), then REMOVE it (dependent_invalidations reported) ===");
    let gm_profile_after_numeric = load_trainer_profile(&profiles, &gm_profile.id).unwrap().unwrap();
    let add_definitional = CommitTrainerGmChangeRequest {
        trainer_id: gm_profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &gm_profile_after_numeric),
        action: "add".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"target": "trainer.feature", "definition_version_id": "features:let-me-help-you-with-that@core", "parameters": Value::Null}),
        note: None,
        confirm: true,
        operation_id: uuid::Uuid::new_v4().to_string(),
    };
    let definitional_commit = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &add_definitional).unwrap();
    println!("{}", serde_json::to_string_pretty(&definitional_commit).unwrap());
    let grant_id = definitional_commit.resolution.grant_id.clone().unwrap();

    let gm_profile_after_definitional = load_trainer_profile(&profiles, &gm_profile.id).unwrap().unwrap();
    let remove = CommitTrainerGmChangeRequest {
        trainer_id: gm_profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &gm_profile_after_definitional),
        action: "remove".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"grant_id": grant_id}),
        note: None,
        confirm: true,
        operation_id: uuid::Uuid::new_v4().to_string(),
    };
    let remove_commit = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &remove).unwrap();
    println!("{}", serde_json::to_string_pretty(&remove_commit).unwrap());

    println!("\n=== 6. Respec — normal stat rebuild (Milestone/GmOverride entries preserved), then a resource-grant reallocation (id/kind/resource/amount immutable, only allocation moves) ===");
    let mut respec_profile = seed_managed_trainer(&mut profiles, 1);
    respec_profile.stat_allocation.entries.push(StatAllocationEntry { stat: TrainerCombatStat::Speed, source: StatAllocationSource::Milestone, level: 5, points: 1, note: Some("Offensive stream ongoing bonus.".to_string()), source_id: None });
    save_trainer_profile(&mut profiles, &respec_profile).unwrap();
    let respec_base_revision = base_revision_for(&definitions, &revision, &respec_profile);
    let respec_request = CommitTrainerRespecRequest {
        trainer_id: respec_profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: respec_base_revision,
        proposed_normal_rebuild: json!([{"stat": "hp", "points": 5}]),
        authorized_resource_reallocations: vec![],
        confirm: true,
        operation_id: uuid::Uuid::new_v4().to_string(),
    };
    let respec_commit = commit_trainer_respec(&definitions, &mut profiles, &ruleset, &revision, &respec_request).unwrap();
    println!("{}", serde_json::to_string_pretty(&respec_commit).unwrap());

    let respec_profile_after = load_trainer_profile(&profiles, &respec_profile.id).unwrap().unwrap();
    let grant = CommitTrainerGmChangeRequest {
        trainer_id: respec_profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &respec_profile_after),
        action: "add".to_string(),
        grant_kind: "resource".to_string(),
        payload: json!({"resource": "edge", "amount": 1, "allocation": "edges:acrobat@core"}),
        note: None,
        confirm: true,
        operation_id: uuid::Uuid::new_v4().to_string(),
    };
    let grant_commit = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &grant).unwrap();
    let resource_grant_id = grant_commit.resolution.grant_id.clone().unwrap();
    let profile_with_grant = load_trainer_profile(&profiles, &respec_profile.id).unwrap().unwrap();
    let reallocation_request = CommitTrainerRespecRequest {
        trainer_id: respec_profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile_with_grant),
        proposed_normal_rebuild: json!([]),
        authorized_resource_reallocations: vec![json!({"grant_id": resource_grant_id, "new_allocation": "edges:iron-mind@core"})],
        confirm: true,
        operation_id: uuid::Uuid::new_v4().to_string(),
    };
    let reallocation_commit = commit_trainer_respec(&definitions, &mut profiles, &ruleset, &revision, &reallocation_request).unwrap();
    println!("{}", serde_json::to_string_pretty(&reallocation_commit).unwrap());

    println!("\n=== 7. commit_trainer_advancement — STALE (content changed underneath a held base_revision) ===");
    let stale_profile = seed_managed_trainer(&mut profiles, 1);
    let stale_base_revision = base_revision_for(&definitions, &revision, &stale_profile);
    let mut mutated = load_trainer_profile(&profiles, &stale_profile.id).unwrap().unwrap();
    mutated.stat_allocation.entries.push(StatAllocationEntry { stat: TrainerCombatStat::Attack, source: StatAllocationSource::Creation, level: 1, points: 2, note: None, source_id: None });
    save_trainer_profile(&mut profiles, &mutated).unwrap();
    let stale_request = CommitTrainerAdvancementRequest {
        trainer_id: stale_profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: stale_base_revision,
        next_level: 2,
        milestone_option_id: None,
        acquired_choices: vec![json!({"role": "ordinary_edge", "kind": "edge", "definition_version_id": "edges:acrobat@core", "parameters": Value::Null}), json!({"role": "restricted_bonus_edge", "kind": "edge", "definition_version_id": "edges:basic-skills@core", "parameters": {"skill": "guile"}})],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        confirm: true,
        operation_id: uuid::Uuid::new_v4().to_string(),
    };
    let stale_result = commit_trainer_advancement(&definitions, &mut profiles, &ruleset, &revision, &stale_request);
    println!("{}", serde_json::to_string_pretty(&stale_result.unwrap_err()).unwrap());

    println!("\n=== 8. GM change — add a PARAMETERIZED resource Skill Edge grant (T13D4-R1B: real rank change, not a permanently-rejecting Value::Null) ===");
    let r1b_profile = seed_managed_trainer(&mut profiles, 1);
    let r1b_base_revision = base_revision_for(&definitions, &revision, &r1b_profile);
    let r1b_request = CommitTrainerGmChangeRequest {
        trainer_id: r1b_profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: r1b_base_revision,
        action: "add".to_string(),
        grant_kind: "resource".to_string(),
        payload: json!({"resource": "edge", "amount": 1, "allocation": {"definition_version_id": "edges:basic-skills@core", "parameters": {"skill": "guile"}}}),
        note: None,
        confirm: true,
        operation_id: uuid::Uuid::new_v4().to_string(),
    };
    let r1b_commit = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &r1b_request).unwrap();
    println!("{}", serde_json::to_string_pretty(&r1b_commit).unwrap());
    let r1b_persisted = load_trainer_profile(&profiles, &r1b_profile.id).unwrap().unwrap();
    println!("persisted skills[\"guile\"].base_rank = {} (expected \"novice\" — real, persisted, not just validated)", r1b_persisted.skills["guile"]["base_rank"]);

    let _ = std::fs::remove_dir_all(&dir);
}
