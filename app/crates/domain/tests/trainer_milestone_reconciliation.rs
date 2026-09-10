//! T13D4-R2 integration tests: dedicated pending-milestone reconciliation
//! (Core pp19-20) against the REAL shipped `ptu-core-1.05.ptucp` pack and
//! isolated SQLite — `preview_trainer_milestone_reconciliation`/
//! `commit_trainer_milestone_reconciliation`'s actual implementation, not
//! a mock. Complements (never replaces) R1Q's own gap-diagnostic test in
//! `trainer_advancement.rs`.

use std::path::{Path, PathBuf};

use ptu_domain::content::authoring::soft_delete_definition;
use ptu_domain::content::context::get_content_context;
use ptu_domain::content::import::import_pack_file;
use ptu_domain::content::ruleset::{load_preset, CampaignRuleset};
use ptu_domain::content::ContentKind;
use ptu_domain::engine::datasets::load_trainer_build_rules;
use ptu_domain::engine::trainer_build::{
    commit_trainer_advancement, commit_trainer_milestone_reconciliation, compute_base_revision, compute_rules_fingerprint, preview_trainer_milestone_reconciliation, CommitTrainerAdvancementRequest,
    CommitTrainerMilestoneReconciliationRequest, PreviewTrainerMilestoneReconciliationRequest, TrainerBuildError,
};
use ptu_domain::persistence::definitions::open_and_migrate_definitions;
use ptu_domain::persistence::profiles::open_and_migrate_profiles;
use ptu_domain::profile::model::{StatAllocationEntry, StatAllocationSource, TrainerCombatStat, TrainerProfile, TrainerStatAllocation};
use ptu_domain::profile::repository::{load_trainer_profile, new_id, save_trainer_profile};
use rusqlite::Connection;
use serde_json::{json, Value};

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..")
}
fn rulesets_dir() -> PathBuf {
    repo_root().join("rulesets")
}
fn content_packs_dir() -> PathBuf {
    repo_root().join("content_packs")
}
fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("ptu-trainer-reconciliation-{name}-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn setup() -> (PathBuf, Connection, Connection, CampaignRuleset) {
    let dir = temp_dir("setup");
    let mut definitions = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    import_pack_file(&mut definitions, &content_packs_dir().join("ptu-core-1.05.ptucp")).unwrap();
    let profiles = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
    let ruleset = load_preset(&rulesets_dir(), "ptu-core-only").unwrap().unwrap();
    (dir, definitions, profiles, ruleset)
}

fn e02_revision(definitions: &Connection, ruleset: &CampaignRuleset) -> String {
    get_content_context(definitions, ruleset, &rulesets_dir(), &content_packs_dir()).unwrap().revision
}

fn op_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn base_revision_for(definitions: &Connection, revision: &str, profile: &TrainerProfile) -> String {
    let rules = load_trainer_build_rules(definitions, "ptu-core-1.05").unwrap();
    let fingerprint = compute_rules_fingerprint("ptu-core-1.05", &rules, revision);
    compute_base_revision(profile, &fingerprint)
}

fn skills_map(entries: &[(&str, &str)]) -> Value {
    let mut map = serde_json::Map::new();
    for (id, rank) in entries {
        map.insert(id.to_string(), json!({"base_rank": rank}));
    }
    Value::Object(map)
}

fn not_received(note: &str) -> Value {
    json!({"disposition": "not_received", "note": note})
}

/// A managed level-10 LEGACY Trainer with an EMPTY progression ledger —
/// never made its level-5 or level-10 milestone choices through this
/// engine. The exact scenario R1Q proved has no other resolution path.
fn seed_legacy_level_10_trainer(profiles: &mut Connection) -> TrainerProfile {
    let profile = TrainerProfile {
        id: new_id(),
        name: "Legacy Reconciliation Target".to_string(),
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

#[test]
fn reconciling_the_level_5_stream_grants_retroactive_plus_ongoing_catch_up_to_level_10() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_legacy_level_10_trainer(&mut profiles);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let request = CommitTrainerMilestoneReconciliationRequest {
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
        operation_id: op_id(),
    };
    let commit = commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    assert!(commit.resolution.issues.is_empty(), "{:?}", commit.resolution.issues);
    assert_eq!(commit.resolution.from_level, 10, "reconciliation never changes level");
    assert_eq!(commit.resolution.to_level, 10);
    assert_eq!(commit.resolution.milestone_level, 5);
    // Core p19 worked example, now via reconciliation instead of live
    // advancement: retroactive +2, plus +1 each at 6/8/10 = 5 total.
    let total_points: i64 = commit.resolution.stat_allocation_entries.iter().map(|e| e.points).sum();
    assert_eq!(total_points, 5, "{:?}", commit.resolution.stat_allocation_entries);
    assert!(commit.resolution.stat_allocation_entries.iter().all(|e| e.stat == TrainerCombatStat::Attack));
    assert_eq!(commit.resolution.benefits.len(), 4, "1 retroactive + 3 ongoing (6/8/10)");
    assert!(commit.resolution.benefits.iter().all(|b| b.status == "new"));
    assert!(commit.resolution.remaining_pending_milestone_levels.contains(&10), "level 10's own choice is still pending");
    assert!(!commit.resolution.remaining_pending_milestone_levels.contains(&5));

    let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.level, 10, "ordinary level/budgets never touched");
    assert_eq!(reloaded.stat_allocation.entries.len(), 5, "the original Creation entry plus 4 separate Milestone benefit entries (1 retroactive + 3 ongoing), each its own source_id");
    let milestone_entries: Vec<_> = reloaded.stat_allocation.entries.iter().filter(|e| e.source == StatAllocationSource::Milestone).collect();
    let milestone_total: i64 = milestone_entries.iter().map(|e| e.points).sum();
    assert_eq!(milestone_total, 5);
    assert!(milestone_entries.iter().all(|e| e.source_id.as_deref().map(|id| id.starts_with("reconcile:5:")).unwrap_or(false)));

    let entry5 = reloaded.progression.iter().find(|p| p["level"] == 5).expect("a level-5 ledger entry must be created");
    assert_eq!(entry5["milestone_option_kind"], "stat_stream");
    assert_eq!(entry5["stat_stream_choice"], "attack");
    assert_eq!(entry5["stat_points"], 0, "no ordinary stat points from reconciliation");
    assert_eq!(entry5["edges"], 0);
    assert_eq!(entry5["features"], 0);
    assert_eq!(entry5["reconciliation"]["option"], "stat_stream");
    assert_eq!(entry5["reconciliation"]["prior_benefits_disposition"], "not_received");
    assert_eq!(entry5["reconciliation"]["benefits"].as_array().unwrap().len(), 4);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn reconciling_level_10s_own_choice_is_a_separate_operation_after_level_5() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_legacy_level_10_trainer(&mut profiles);

    let l5_request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile),
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("special_attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: not_received("No prior benefit received."),
        confirm: true,
        operation_id: op_id(),
    };
    commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &l5_request).unwrap();

    let profile_after_l5 = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    let l10_request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile_after_l5),
        milestone_level: 10,
        milestone_option_id: Some("edges".to_string()),
        acquired_choices: vec![
            json!({"role": "milestone_alternative", "kind": "edge", "definition_version_id": "edges:acrobat@core", "parameters": Value::Null}),
            json!({"role": "milestone_alternative", "kind": "edge", "definition_version_id": "edges:iron-mind@core", "parameters": Value::Null}),
        ],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        prior_benefits: not_received("No prior benefit received."),
        confirm: true,
        operation_id: op_id(),
    };
    let commit = commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &l10_request).unwrap();
    assert!(commit.resolution.issues.is_empty(), "{:?}", commit.resolution.issues);
    assert_eq!(commit.resolution.to_level, 10, "still level 10 — level 10's own reconciliation never advances further");
    assert_eq!(commit.resolution.edges.len(), 2);
    assert!(commit.resolution.remaining_pending_milestone_levels.is_empty(), "both 5 and 10 (the only milestones <= level 10) are now resolved");

    let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.level, 10);
    assert!(reloaded.edges.iter().any(|e| e["definition_version_id"] == "edges:acrobat@core" && e["source"] == "milestone"));
    assert!(reloaded.edges.iter().any(|e| e["definition_version_id"] == "edges:iron-mind@core" && e["source"] == "milestone"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_future_milestone_level_rejects() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_legacy_level_10_trainer(&mut profiles);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let request = PreviewTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        milestone_level: 20,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        prior_benefits: not_received("n/a"),
    };
    let preview = preview_trainer_milestone_reconciliation(&definitions, &profiles, &ruleset, &revision, &request).unwrap();
    assert!(preview.resolution.issues.iter().any(|i| i.issue.code == "reconciliation_target_future_level"), "{:?}", preview.resolution.issues);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_non_milestone_level_rejects() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_legacy_level_10_trainer(&mut profiles);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let request = PreviewTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        milestone_level: 7,
        milestone_option_id: None,
        acquired_choices: vec![],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        prior_benefits: not_received("n/a"),
    };
    let preview = preview_trainer_milestone_reconciliation(&definitions, &profiles, &ruleset, &revision, &request).unwrap();
    assert!(preview.resolution.issues.iter().any(|i| i.issue.code == "reconciliation_target_not_a_milestone"), "{:?}", preview.resolution.issues);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn an_already_resolved_milestone_rejects_a_new_reconciliation() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_legacy_level_10_trainer(&mut profiles);

    let request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile),
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: not_received("No prior benefit received."),
        confirm: true,
        operation_id: op_id(),
    };
    commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();

    let profile_after = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    let second_request = CommitTrainerMilestoneReconciliationRequest {
        expected_base_revision: base_revision_for(&definitions, &revision, &profile_after),
        operation_id: op_id(),
        ..request
    };
    let result = commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &second_request);
    match result {
        Err(TrainerBuildError::ValidationFailed { issues }) => assert!(issues.iter().any(|i| i.issue.code == "reconciliation_target_already_resolved"), "{issues:?}"),
        other => panic!("expected ValidationFailed, got {other:?}"),
    }

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn reconciling_level_10_as_a_stream_without_level_5_ever_being_resolved_rejects() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_legacy_level_10_trainer(&mut profiles);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let request = PreviewTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        milestone_level: 10,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        prior_benefits: not_received("n/a"),
    };
    let preview = preview_trainer_milestone_reconciliation(&definitions, &profiles, &ruleset, &revision, &request).unwrap();
    assert!(preview.resolution.issues.iter().any(|i| i.issue.code == "advancement_stat_stream_not_started"), "{:?}", preview.resolution.issues);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn mapping_an_existing_stat_entry_to_the_retroactive_benefit_adopts_it_instead_of_granting_a_new_one() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let mut profile = seed_legacy_level_10_trainer(&mut profiles);
    // A pre-existing, GM-attributed legacy entry the GM now declares
    // already covers the level-5 retroactive bonus.
    let legacy_entry = StatAllocationEntry { stat: TrainerCombatStat::Attack, source: StatAllocationSource::GmOverride, level: 3, points: 2, note: Some("Legacy campaign note: GM granted +2 Attack around level 3.".to_string()), source_id: None };
    profile.stat_allocation.entries.push(legacy_entry.clone());
    save_trainer_profile(&mut profiles, &profile).unwrap();
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let expected_value = serde_json::to_value(&legacy_entry).unwrap();
    let request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: json!({
            "disposition": "map_existing",
            "note": "GM confirmed: the level-3 +2 Attack entry IS the level-5 retroactive stream bonus, granted early by mistake.",
            "mappings": [{"benefit_id": "reconcile:5:retroactive", "kind": "stat_entry", "index": 1, "expected_value": expected_value}],
        }),
        confirm: true,
        operation_id: op_id(),
    };
    let commit = commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    assert!(commit.resolution.issues.is_empty(), "{:?}", commit.resolution.issues);
    let retroactive = commit.resolution.benefits.iter().find(|b| b.benefit_id == "reconcile:5:retroactive").unwrap();
    assert_eq!(retroactive.status, "adopted");
    // Only the 3 ongoing benefits (6/8/10) are NEW — the retroactive one was adopted, not re-granted.
    let new_points: i64 = commit.resolution.stat_allocation_entries.iter().map(|e| e.points).sum();
    assert_eq!(new_points, 3, "{:?}", commit.resolution.stat_allocation_entries);

    let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.stat_allocation.entries.len(), 5, "Creation + adopted legacy entry + 3 new ongoing entries (6/8/10) — the retroactive benefit was adopted, not separately granted");
    let adopted = reloaded.stat_allocation.entries.iter().find(|e| e.note.as_deref() == Some("Legacy campaign note: GM granted +2 Attack around level 3.")).unwrap();
    assert_eq!(adopted.source_id.as_deref(), Some("reconcile:5:retroactive"), "the adopted entry now carries the benefit's identity, nothing else about it changed");
    assert_eq!(adopted.points, 2, "adopting never rewrites the quantity");
    assert_eq!(adopted.source, StatAllocationSource::GmOverride, "adopting never rewrites the source");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_stale_mapped_value_rejects_and_a_double_mapped_index_rejects() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let mut profile = seed_legacy_level_10_trainer(&mut profiles);
    let legacy_entry = StatAllocationEntry { stat: TrainerCombatStat::Attack, source: StatAllocationSource::GmOverride, level: 3, points: 2, note: Some("Legacy note.".to_string()), source_id: None };
    profile.stat_allocation.entries.push(legacy_entry);
    save_trainer_profile(&mut profiles, &profile).unwrap();
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let stale_expected_value = json!({"stat": "attack", "source": "gm_override", "level": 3, "points": 999, "note": "wrong"});
    let request = PreviewTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision.clone(),
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: json!({
            "disposition": "map_existing",
            "note": "GM note.",
            "mappings": [{"benefit_id": "reconcile:5:retroactive", "kind": "stat_entry", "index": 1, "expected_value": stale_expected_value}],
        }),
    };
    let preview = preview_trainer_milestone_reconciliation(&definitions, &profiles, &ruleset, &revision, &request).unwrap();
    assert!(preview.resolution.issues.iter().any(|i| i.issue.code == "reconciliation_mapping_value_mismatch"), "{:?}", preview.resolution.issues);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn prior_benefits_disposition_and_note_are_required() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_legacy_level_10_trainer(&mut profiles);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let missing_disposition = PreviewTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision.clone(),
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: json!({}),
    };
    let preview = preview_trainer_milestone_reconciliation(&definitions, &profiles, &ruleset, &revision, &missing_disposition).unwrap();
    assert!(preview.resolution.issues.iter().any(|i| i.issue.code == "reconciliation_prior_benefits_disposition_required"), "{:?}", preview.resolution.issues);

    let missing_note = PreviewTrainerMilestoneReconciliationRequest { prior_benefits: json!({"disposition": "not_received"}), ..missing_disposition };
    let preview2 = preview_trainer_milestone_reconciliation(&definitions, &profiles, &ruleset, &revision, &missing_note).unwrap();
    assert!(preview2.resolution.issues.iter().any(|i| i.issue.code == "reconciliation_prior_benefits_note_required"), "{:?}", preview2.resolution.issues);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_general_feature_alternative_at_level_5_rejects_a_non_general_feature() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_legacy_level_10_trainer(&mut profiles);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let request = PreviewTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        milestone_level: 5,
        milestone_option_id: Some("general_feature".to_string()),
        acquired_choices: vec![json!({"role": "milestone_alternative", "kind": "feature", "definition_version_id": "features:ace-trainer@core", "parameters": Value::Null})],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        prior_benefits: not_received("n/a"),
    };
    let preview = preview_trainer_milestone_reconciliation(&definitions, &profiles, &ruleset, &revision, &request).unwrap();
    assert!(preview.resolution.issues.iter().any(|i| i.issue.code == "milestone_alternative_not_general_feature"), "{:?}", preview.resolution.issues);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_parameterized_skill_edge_as_an_alternative_choice_applies_the_real_rank_change() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_legacy_level_10_trainer(&mut profiles);

    let l5_request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile),
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: not_received("No prior benefit received."),
        confirm: true,
        operation_id: op_id(),
    };
    commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &l5_request).unwrap();

    let profile_after_l5 = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    let l10_request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile_after_l5),
        milestone_level: 10,
        milestone_option_id: Some("edges".to_string()),
        acquired_choices: vec![
            json!({"role": "milestone_alternative", "kind": "edge", "definition_version_id": "edges:basic-skills@core", "parameters": {"skill": "guile"}}),
            json!({"role": "milestone_alternative", "kind": "edge", "definition_version_id": "edges:acrobat@core", "parameters": Value::Null}),
        ],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        prior_benefits: not_received("No prior benefit received."),
        confirm: true,
        operation_id: op_id(),
    };
    let commit = commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &l10_request).unwrap();
    assert!(commit.resolution.issues.is_empty(), "{:?}", commit.resolution.issues);

    let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.skills["guile"]["base_rank"], "novice", "the milestone-alternative Skill Edge pick must apply its real effect, not just validate and discard it");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn commit_replay_returns_the_same_result_and_rejects_a_conflicting_reuse() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_legacy_level_10_trainer(&mut profiles);
    let base_revision = base_revision_for(&definitions, &revision, &profile);
    let shared_op = op_id();

    let request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: not_received("No prior benefit received."),
        confirm: true,
        operation_id: shared_op,
    };
    let first = commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    let replay = commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    assert_eq!(replay.resolution.benefits.len(), first.resolution.benefits.len());
    let entries_after_replay: i64 = {
        let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
        reloaded.stat_allocation.entries.iter().filter(|e| e.source == StatAllocationSource::Milestone).count() as i64
    };
    assert_eq!(entries_after_replay, 4, "a replay must not grant the benefits a second time");

    let conflicting = CommitTrainerMilestoneReconciliationRequest { stat_stream_choice: Some("special_attack".to_string()), ..request };
    let result = commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &conflicting);
    assert!(matches!(result, Err(TrainerBuildError::OperationConflict { .. })), "{result:?}");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_stale_base_revision_rejects_the_commit() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_legacy_level_10_trainer(&mut profiles);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let mut mutated = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    mutated.stat_allocation.entries.push(StatAllocationEntry { stat: TrainerCombatStat::Defense, source: StatAllocationSource::Creation, level: 1, points: 1, note: None, source_id: None });
    save_trainer_profile(&mut profiles, &mutated).unwrap();

    let request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: not_received("n/a"),
        confirm: true,
        operation_id: op_id(),
    };
    let result = commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &request);
    assert!(matches!(result, Err(TrainerBuildError::StaleRevision { .. })), "{result:?}");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn preview_never_persists_and_reopen_preserves_a_real_commit() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
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
        prior_benefits: not_received("n/a"),
    };
    preview_trainer_milestone_reconciliation(&definitions, &profiles, &ruleset, &revision, &preview_request).unwrap();
    let untouched = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert!(untouched.progression.is_empty(), "preview must never persist anything");

    let commit_request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: not_received("n/a"),
        confirm: true,
        operation_id: op_id(),
    };
    commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &commit_request).unwrap();

    drop(profiles);
    let reopened = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
    let reloaded = load_trainer_profile(&reopened, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.level, 10);
    assert!(reloaded.progression.iter().any(|p| p["level"] == 5));
    assert_eq!(reloaded.stat_allocation.entries.iter().filter(|e| e.source == StatAllocationSource::Milestone).count(), 4);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn an_unrelated_inventory_write_between_preview_and_commit_survives() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
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
        prior_benefits: not_received("n/a"),
    };
    preview_trainer_milestone_reconciliation(&definitions, &profiles, &ruleset, &revision, &preview_request).unwrap();

    let mut mid_profile = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    mid_profile.inventory.backpack.push(ptu_domain::profile::model::ItemStack { item_id: "potion".to_string(), quantity: 1 });
    save_trainer_profile(&mut profiles, &mid_profile).unwrap();

    let commit_request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: not_received("n/a"),
        confirm: true,
        operation_id: op_id(),
    };
    commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &commit_request).unwrap();

    let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.inventory.backpack.len(), 1, "the interleaved inventory write must survive the reconciliation commit");

    let _ = std::fs::remove_dir_all(&dir);
}

// =======================================================================
// T13D4-R3A — a mapped legacy entry must genuinely satisfy the claimed
// benefit, not merely be CURRENT (T13D4_R2_IMPLEMENTATION_REVIEW.md
// confirmed BLOCKER: `adopt_mapping` checked freshness/ownership only,
// never whether the mapped entry's own stat/points, or the mapped
// acquisition's own real eligibility, actually correspond to the benefit
// being claimed — the review's own concrete example: an unrelated +1 HP
// entry could "settle" a level-5 Attack retroactive benefit just because
// its `expected_value` happened to match its own current JSON).
// =======================================================================

#[test]
fn mapping_an_unrelated_hp_entry_to_the_attack_retroactive_benefit_rejects_the_reviews_own_concrete_scenario() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let mut profile = seed_legacy_level_10_trainer(&mut profiles);
    // Exactly the review's own concrete attack scenario: an ordinary,
    // completely unrelated +1 HP entry — wrong stat AND wrong points for
    // the level-5 Attack retroactive benefit (which needs Attack, +2).
    let unrelated_entry = StatAllocationEntry { stat: TrainerCombatStat::Hp, source: StatAllocationSource::LevelUp, level: 3, points: 1, note: None, source_id: None };
    profile.stat_allocation.entries.push(unrelated_entry.clone());
    save_trainer_profile(&mut profiles, &profile).unwrap();
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let expected_value = serde_json::to_value(&unrelated_entry).unwrap();
    let request = PreviewTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: json!({
            "disposition": "map_existing",
            "note": "GM attempt to map an unrelated entry (should be rejected).",
            "mappings": [{"benefit_id": "reconcile:5:retroactive", "kind": "stat_entry", "index": 1, "expected_value": expected_value}],
        }),
    };
    let preview = preview_trainer_milestone_reconciliation(&definitions, &profiles, &ruleset, &revision, &request).unwrap();
    assert!(preview.resolution.issues.iter().any(|i| i.issue.code == "reconciliation_mapping_wrong_stat"), "{:?}", preview.resolution.issues);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn mapping_the_right_stat_but_wrong_quantity_rejects() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let mut profile = seed_legacy_level_10_trainer(&mut profiles);
    // Right stat (Attack), but only +1 — the level-5 retroactive benefit
    // requires exactly +2. A fresh, current, correctly-STATTED entry
    // must still be rejected if the QUANTITY doesn't match.
    let wrong_quantity_entry = StatAllocationEntry { stat: TrainerCombatStat::Attack, source: StatAllocationSource::GmOverride, level: 3, points: 1, note: Some("GM boon.".to_string()), source_id: None };
    profile.stat_allocation.entries.push(wrong_quantity_entry.clone());
    save_trainer_profile(&mut profiles, &profile).unwrap();
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let expected_value = serde_json::to_value(&wrong_quantity_entry).unwrap();
    let request = PreviewTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: json!({
            "disposition": "map_existing",
            "note": "GM attempt to map a right-stat-wrong-quantity entry (should be rejected).",
            "mappings": [{"benefit_id": "reconcile:5:retroactive", "kind": "stat_entry", "index": 1, "expected_value": expected_value}],
        }),
    };
    let preview = preview_trainer_milestone_reconciliation(&definitions, &profiles, &ruleset, &revision, &request).unwrap();
    assert!(preview.resolution.issues.iter().any(|i| i.issue.code == "reconciliation_mapping_wrong_points"), "{:?}", preview.resolution.issues);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn mapping_a_currently_disabled_definition_rejects() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let mut profile = seed_legacy_level_10_trainer(&mut profiles);
    profile.edges.push(json!({"definition_version_id": "edges:acrobat@core", "parameters": Value::Null, "policy_kind": "edge", "source": "legacy", "level": 1, "sequence": 0}));
    save_trainer_profile(&mut profiles, &profile).unwrap();
    // `save_trainer_profile` assigns a stable `acquisition_id` to a
    // pushed edge/feature that didn't already have one (D1) — reload so
    // `expected_value`/`base_revision` reflect the REAL persisted shape,
    // not the pre-save literal.
    let profile = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    let legacy_edge = profile.edges[0].clone();
    soft_delete_definition(&definitions, ContentKind::Edge, "edges:acrobat@core").unwrap();
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let request = PreviewTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        milestone_level: 10,
        milestone_option_id: Some("edges".to_string()),
        acquired_choices: vec![json!({"role": "milestone_alternative", "kind": "edge", "definition_version_id": "edges:iron-mind@core", "parameters": Value::Null})],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        prior_benefits: json!({
            "disposition": "map_existing",
            "note": "GM attempt to map a now-disabled definition (should be rejected).",
            "mappings": [{"benefit_id": "reconcile:10:alternative:0", "kind": "edge", "index": 0, "expected_value": legacy_edge}],
        }),
    };
    // L5 was never resolved on this Trainer, so L10's stat_stream is
    // unreachable — but its "edges" alternative doesn't need the stream
    // to have been chosen at all, so this must still be evaluable.
    let preview = preview_trainer_milestone_reconciliation(&definitions, &profiles, &ruleset, &revision, &request).unwrap();
    assert!(preview.resolution.issues.iter().any(|i| i.issue.code == "acquisition_definition_disabled"), "{:?}", preview.resolution.issues);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn mapping_an_edge_that_no_longer_meets_its_own_prerequisite_rejects() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let mut profile = seed_legacy_level_10_trainer(&mut profiles);
    // Legacy inconsistency: this Trainer somehow already has Kip Up
    // (Prerequisites: Expert Acrobatics) despite only Novice Acrobatics —
    // a real, currently-unmet prerequisite. Reusing the SAME eligibility
    // check a fresh choice would face must reject this adoption too.
    profile.edges.push(json!({"definition_version_id": "edges:kip-up@core", "parameters": Value::Null, "policy_kind": "edge", "source": "legacy", "level": 1, "sequence": 0}));
    save_trainer_profile(&mut profiles, &profile).unwrap();
    let profile = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    let legacy_edge = profile.edges[0].clone();
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let request = PreviewTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        milestone_level: 10,
        milestone_option_id: Some("edges".to_string()),
        acquired_choices: vec![json!({"role": "milestone_alternative", "kind": "edge", "definition_version_id": "edges:iron-mind@core", "parameters": Value::Null})],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        prior_benefits: json!({
            "disposition": "map_existing",
            "note": "GM attempt to map an edge whose prerequisite is not currently met (should be rejected).",
            "mappings": [{"benefit_id": "reconcile:10:alternative:0", "kind": "edge", "index": 0, "expected_value": legacy_edge}],
        }),
    };
    let preview = preview_trainer_milestone_reconciliation(&definitions, &profiles, &ruleset, &revision, &request).unwrap();
    assert!(preview.resolution.issues.iter().any(|i| i.issue.code == "reconciliation_mapping_ineligible"), "{:?}", preview.resolution.issues);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn mapping_an_eligible_existing_edge_adopts_it_without_reapplying_any_effect() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_legacy_level_10_trainer(&mut profiles);

    let l5_request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile),
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: not_received("No prior benefit received."),
        confirm: true,
        operation_id: op_id(),
    };
    commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &l5_request).unwrap();

    let mut profile_after_l5 = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    // A legacy Edge the Trainer already legitimately qualifies for
    // (Novice Acrobatics is already on the sheet) — GM declares this
    // pre-existing Edge IS one of the two level-10 "edges" alternative
    // slots.
    profile_after_l5.edges.push(json!({"definition_version_id": "edges:acrobat@core", "parameters": Value::Null, "policy_kind": "edge", "source": "legacy", "level": 1, "sequence": 0}));
    save_trainer_profile(&mut profiles, &profile_after_l5).unwrap();
    // Reload: `save_trainer_profile` assigns a stable `acquisition_id` to
    // the newly-pushed edge, so `expected_value`/`base_revision` must
    // reflect the REAL persisted shape, not the pre-save literal.
    let profile_after_l5 = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    let legacy_edge = profile_after_l5.edges[0].clone();
    let base_revision = base_revision_for(&definitions, &revision, &profile_after_l5);

    let l10_request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        milestone_level: 10,
        milestone_option_id: Some("edges".to_string()),
        acquired_choices: vec![json!({"role": "milestone_alternative", "kind": "edge", "definition_version_id": "edges:iron-mind@core", "parameters": Value::Null})],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        prior_benefits: json!({
            "disposition": "map_existing",
            "note": "GM confirmed: the pre-existing Acrobat Edge already satisfies one of the two level-10 alternative slots.",
            "mappings": [{"benefit_id": "reconcile:10:alternative:0", "kind": "edge", "index": 0, "expected_value": legacy_edge}],
        }),
        confirm: true,
        operation_id: op_id(),
    };
    let commit = commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &l10_request).unwrap();
    assert!(commit.resolution.issues.is_empty(), "{:?}", commit.resolution.issues);
    let adopted_outcome = commit.resolution.benefits.iter().find(|b| b.benefit_id == "reconcile:10:alternative:0").unwrap();
    assert_eq!(adopted_outcome.status, "adopted");
    assert_eq!(commit.resolution.edges.len(), 1, "only the SECOND slot is a genuinely new acquisition");

    let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    let adopted_edge = reloaded.edges.iter().find(|e| e["definition_version_id"] == "edges:acrobat@core").unwrap();
    assert_eq!(adopted_edge["source"], "legacy", "adoption never rewrites the acquisition's own source");
    assert_eq!(adopted_edge["source_id"], "reconcile:10:alternative:0");
    assert_eq!(reloaded.edges.iter().filter(|e| e["definition_version_id"] == "edges:acrobat@core").count(), 1, "never duplicated");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn mapping_an_eligible_existing_general_feature_adopts_it() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let mut profile = seed_legacy_level_10_trainer(&mut profiles);
    profile.features.push(json!({"definition_version_id": "features:let-me-help-you-with-that@core", "parameters": Value::Null, "policy_kind": "feature", "source": "legacy", "level": 1, "sequence": 0}));
    save_trainer_profile(&mut profiles, &profile).unwrap();
    let profile = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    let legacy_feature = profile.features[0].clone();
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        milestone_level: 5,
        milestone_option_id: Some("general_feature".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        prior_benefits: json!({
            "disposition": "map_existing",
            "note": "GM confirmed: the pre-existing General Feature already satisfies the level-5 alternative.",
            "mappings": [{"benefit_id": "reconcile:5:alternative:0", "kind": "feature", "index": 0, "expected_value": legacy_feature}],
        }),
        confirm: true,
        operation_id: op_id(),
    };
    let commit = commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    assert!(commit.resolution.issues.is_empty(), "{:?}", commit.resolution.issues);
    assert_eq!(commit.resolution.features.len(), 0, "no new Feature — the one slot was fully adopted");
    assert_eq!(commit.resolution.benefits[0].status, "adopted");

    let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.features.len(), 1, "never duplicated");
    assert_eq!(reloaded.features[0]["source_id"], "reconcile:5:alternative:0");
    assert_eq!(reloaded.features[0]["source"], "legacy");

    let _ = std::fs::remove_dir_all(&dir);
}

// =======================================================================
// T13D4-R3B — reconciliation followed by REAL advancement
// (T13D4_R2_IMPLEMENTATION_REVIEW.md confirmed MAJOR: reconciliation-only
// tests never proved settled events stay settled, and future eligible
// stream bonuses occur exactly once, through the EXISTING, unmodified
// `commit_trainer_advancement` command). Every level transition below is
// a REAL production command call — only the STARTING Trainer state is a
// fixture (a legacy Trainer with a pending milestone has no other way to
// exist, since normal advancement always resolves its own milestone as
// it happens).
// =======================================================================

fn edge(dvi: &str) -> Value {
    json!({"role": "ordinary_edge", "kind": "edge", "definition_version_id": dvi, "parameters": Value::Null})
}
fn restricted(dvi: &str, parameters: Value) -> Value {
    json!({"role": "restricted_bonus_edge", "kind": "edge", "definition_version_id": dvi, "parameters": parameters})
}
fn feature(dvi: &str) -> Value {
    json!({"role": "ordinary_feature", "kind": "feature", "definition_version_id": dvi, "parameters": Value::Null})
}

fn milestone_points(profile: &TrainerProfile) -> i64 {
    profile.stat_allocation.entries.iter().filter(|e| e.source == StatAllocationSource::Milestone).map(|e| e.points).sum()
}

#[test]
fn reconciling_level_5_then_climbing_by_real_advancement_applies_each_ongoing_bonus_exactly_once() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    // A level-5 Trainer with a PENDING level-5 milestone — the only way
    // such a Trainer can exist, since `commit_trainer_advancement` always
    // resolves a milestone level's choice as part of reaching it.
    let profile = TrainerProfile {
        id: new_id(),
        name: "R3B Chain".to_string(),
        level: 5,
        skills: skills_map(&[("acrobatics", "novice"), ("focus", "novice")]),
        stat_allocation: TrainerStatAllocation { entries: vec![StatAllocationEntry { stat: TrainerCombatStat::Hp, source: StatAllocationSource::Creation, level: 1, points: 3, note: None, source_id: None }] },
        progression: vec![],
        build_state: Some(json!({"status": "published"})),
        ..TrainerProfile::default()
    };
    save_trainer_profile(&mut profiles, &profile).unwrap();

    // Step 1: reconcile the pending level-5 stream via the REAL command.
    // At current_level == 5 exactly, only the retroactive benefit is due
    // — none of the ongoing levels (6/8/10) have been reached yet.
    let reconcile_request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile),
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: not_received("No prior benefit received."),
        confirm: true,
        operation_id: op_id(),
    };
    let reconcile_commit = commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &reconcile_request).unwrap();
    assert_eq!(reconcile_commit.resolution.benefits.len(), 1, "{:?}", reconcile_commit.resolution.benefits);
    assert_eq!(reconcile_commit.resolution.benefits[0].benefit_id, "reconcile:5:retroactive");
    let at_5 = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(milestone_points(&at_5), 2, "only the retroactive +2, from reconciliation");

    // Step 2: real advancement 5 -> 6 — the level-6 ongoing bonus must
    // apply AUTOMATICALLY (the earlier T13D4 corrective round's own
    // fix), reading the stream choice THIS reconciliation recorded.
    let advance_to_6 = CommitTrainerAdvancementRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &at_5),
        next_level: 6,
        milestone_option_id: None,
        acquired_choices: vec![edge("edges:acrobat@core"), restricted("edges:basic-skills@core", json!({"skill": "guile"}))],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    let advance_commit = commit_trainer_advancement(&definitions, &mut profiles, &ruleset, &revision, &advance_to_6).unwrap();
    assert!(advance_commit.resolution.issues.is_empty(), "{:?}", advance_commit.resolution.issues);
    let l6_bonus: i64 = advance_commit.resolution.stat_allocation_milestone_entries.iter().map(|e| e.points).sum();
    assert_eq!(l6_bonus, 1, "the level-6 ongoing bonus applies via REAL advancement");
    let at_6 = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(milestone_points(&at_6), 3, "retroactive(2, reconciliation) + ongoing@6(1, real advancement) — each counted exactly once");

    // Step 3: 6 -> 7 (ordinary only — 7 is not one of L5's ongoing
    // levels; no bonus on an ineligible level).
    let advance_to_7 = CommitTrainerAdvancementRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &at_6),
        next_level: 7,
        milestone_option_id: None,
        acquired_choices: vec![feature("features:let-me-help-you-with-that@core")],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    commit_trainer_advancement(&definitions, &mut profiles, &ruleset, &revision, &advance_to_7).unwrap();
    let at_7 = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(milestone_points(&at_7), 3, "unchanged — level 7 owes nothing to the stream");

    // Step 4: 7 -> 8 (ordinary Edge required; the level-8 ongoing bonus
    // applies).
    let advance_to_8 = CommitTrainerAdvancementRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &at_7),
        next_level: 8,
        milestone_option_id: None,
        acquired_choices: vec![edge("edges:iron-mind@core")],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    let advance_commit_8 = commit_trainer_advancement(&definitions, &mut profiles, &ruleset, &revision, &advance_to_8).unwrap();
    assert!(advance_commit_8.resolution.issues.is_empty(), "{:?}", advance_commit_8.resolution.issues);
    let at_8 = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(milestone_points(&at_8), 4, "retroactive(2) + ongoing@6(1) + ongoing@8(1)");

    // Step 5: 8 -> 9 (ordinary Feature; unchanged).
    let advance_to_9 = CommitTrainerAdvancementRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &at_8),
        next_level: 9,
        milestone_option_id: None,
        acquired_choices: vec![feature("features:let-me-help-you-with-that@core")],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    commit_trainer_advancement(&definitions, &mut profiles, &ruleset, &revision, &advance_to_9).unwrap();
    let at_9 = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(milestone_points(&at_9), 4, "unchanged — level 9 owes nothing to the stream");

    // Step 6: 9 -> 10 — the FINAL endpoint of L5's ongoing interval
    // ([6,8,10]) AND level 10's own separate milestone choice
    // ("continuation to the next interval") in the SAME real advancement
    // step. Choosing "stat_stream" for level 10 must read back the SAME
    // stat reconciliation locked in at level 5 (`locked_offensive_stat`),
    // never inventing a new unresolved choice.
    let advance_to_10 = CommitTrainerAdvancementRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &at_9),
        next_level: 10,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![edge("edges:dynamism@core")],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    let advance_commit_10 = commit_trainer_advancement(&definitions, &mut profiles, &ruleset, &revision, &advance_to_10).unwrap();
    assert!(advance_commit_10.resolution.issues.is_empty(), "{:?}", advance_commit_10.resolution.issues);
    assert_eq!(advance_commit_10.resolution.milestone.as_ref().unwrap().option_chosen.as_deref(), Some("stat_stream"), "level 10 legitimately continues the SAME stream reconciliation started at level 5");
    let l10_ongoing: i64 = advance_commit_10.resolution.stat_allocation_milestone_entries.iter().map(|e| e.points).sum();
    assert_eq!(l10_ongoing, 1, "the final endpoint of L5's own ongoing interval (level 10) still applies exactly once");

    let final_profile = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(final_profile.level, 10);
    assert_eq!(milestone_points(&final_profile), 5, "Core p19's own worked total (2+1+1+1=5), split across ONE reconciliation commit and FOUR real advancement commits, with zero duplication anywhere in the chain");
    let milestone_entries_count = final_profile.stat_allocation.entries.iter().filter(|e| e.source == StatAllocationSource::Milestone).count();
    assert_eq!(milestone_entries_count, 4, "retroactive + 3 ongoing (6/8/10) — one entry per real event, none doubled");

    // Repeated operation adds nothing: replay the level-10 commit.
    let replay = commit_trainer_advancement(&definitions, &mut profiles, &ruleset, &revision, &advance_to_10).unwrap();
    assert_eq!(replay.resolution.to_level, 10);
    let after_replay = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(milestone_points(&after_replay), 5, "a replay of the final step must not add a second copy of anything");

    drop(profiles);
    let reopened = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
    let reloaded = load_trainer_profile(&reopened, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.level, 10);
    assert_eq!(milestone_points(&reloaded), 5, "source identities/ledger state survive a fresh-connection reopen");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn catching_up_the_level_5_stream_at_level_10_then_real_advancement_to_12_never_recurs_the_settled_benefits() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_legacy_level_10_trainer(&mut profiles);

    // Reconcile at the higher current level — all of L5's ongoing levels
    // (6/8/10) are already <= 10, so the FULL catch-up (retroactive + 3
    // ongoing = 5 points) is due in this ONE reconciliation.
    let reconcile_request = CommitTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile),
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("special_attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: not_received("No prior benefit received."),
        confirm: true,
        operation_id: op_id(),
    };
    commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &reconcile_request).unwrap();
    let at_10 = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(milestone_points(&at_10), 5, "the full catch-up settles in one reconciliation");

    // Real advancement 10 -> 11 -> 12: NEITHER level is one of L5's
    // ongoing levels (nor level 10's own, since level 10's tier was
    // never separately reconciled/continued here) — the settled benefit
    // must never recur, and no bonus fires on these ineligible levels.
    let advance_to_11 = CommitTrainerAdvancementRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &at_10),
        next_level: 11,
        milestone_option_id: None,
        acquired_choices: vec![feature("features:let-me-help-you-with-that@core")],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    let advance_commit_11 = commit_trainer_advancement(&definitions, &mut profiles, &ruleset, &revision, &advance_to_11).unwrap();
    assert!(advance_commit_11.resolution.stat_allocation_milestone_entries.is_empty(), "level 11 owes nothing — the settled level-5 stream benefits must never recur");
    let at_11 = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(milestone_points(&at_11), 5, "unchanged");

    let advance_to_12 = CommitTrainerAdvancementRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &at_11),
        next_level: 12,
        milestone_option_id: None,
        acquired_choices: vec![edge("edges:acrobat@core"), restricted("edges:basic-skills@core", json!({"skill": "intuition"}))],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    let advance_commit_12 = commit_trainer_advancement(&definitions, &mut profiles, &ruleset, &revision, &advance_to_12).unwrap();
    assert!(advance_commit_12.resolution.issues.is_empty(), "{:?}", advance_commit_12.resolution.issues);
    assert!(advance_commit_12.resolution.stat_allocation_milestone_entries.is_empty(), "level 12 owes nothing to the level-5 stream either");

    let final_profile = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(final_profile.level, 12);
    assert_eq!(milestone_points(&final_profile), 5, "the settled catch-up total stays exactly 5 through two more real advancement levels — ordinary awards (stat points/edges/features) occurred normally at 11/12, but the milestone total never recurs");
    let milestone_entries_count = final_profile.stat_allocation.entries.iter().filter(|e| e.source == StatAllocationSource::Milestone).count();
    assert_eq!(milestone_entries_count, 4, "still exactly 4 — no fifth/sixth entry invented by real advancement");

    let _ = std::fs::remove_dir_all(&dir);
}
