//! T13D4-R4 (D4): dedicated respec stale/invalid/inventory-preservation
//! evidence, and the corrected Legacy disposition across all four D4
//! command families (advancement, GM change, respec, milestone
//! reconciliation) — real `build_state: None` Trainer fixtures, NOT
//! produced by D3 immediately before the test, exercising the ACTUAL
//! command boundary (not an inverse guard on unrelated legacy routes).
//! Per the R4 handoff: a successful case never stands in for an invalid
//! test, and an operation-conflict test never stands in for stale.

use std::path::{Path, PathBuf};

use ptu_domain::content::context::get_content_context;
use ptu_domain::content::import::import_pack_file;
use ptu_domain::content::ruleset::{load_preset, CampaignRuleset};
use ptu_domain::engine::datasets::load_trainer_build_rules;
use ptu_domain::engine::trainer_build::{
    commit_trainer_advancement, commit_trainer_gm_change, commit_trainer_milestone_reconciliation, commit_trainer_respec, compute_base_revision, compute_rules_fingerprint,
    preview_trainer_milestone_reconciliation, preview_trainer_respec, CommitTrainerAdvancementRequest, CommitTrainerGmChangeRequest, CommitTrainerMilestoneReconciliationRequest,
    CommitTrainerRespecRequest, PreviewTrainerMilestoneReconciliationRequest,
    PreviewTrainerRespecRequest, TrainerBuildError,
};
use ptu_domain::persistence::definitions::open_and_migrate_definitions;
use ptu_domain::persistence::profiles::open_and_migrate_profiles;
use ptu_domain::profile::model::{ItemStack, StatAllocationEntry, StatAllocationSource, TrainerCombatStat, TrainerProfile, TrainerStatAllocation};
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
    let dir = std::env::temp_dir().join(format!("ptu-d4-legacy-{name}-{}", uuid::Uuid::new_v4()));
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

/// A genuinely LEGACY Trainer — `build_state: None` (never went through
/// D3's guided creation), carrying independent/unrelated/unknown extra
/// state (money, an inventory item, a legacy-sourced Edge with no
/// `source_id`) that every positive test below must prove survives
/// untouched.
fn seed_genuine_legacy_trainer(profiles: &mut Connection, level: i64) -> TrainerProfile {
    let profile = TrainerProfile {
        id: new_id(),
        name: "Genuine Legacy Trainer".to_string(),
        level,
        money: 250,
        skills: skills_map(&[("acrobatics", "novice"), ("focus", "novice")]),
        edges: vec![json!({"definition_version_id": "edges:acrobat@core", "source": "legacy", "level": 1, "sequence": 0})],
        stat_allocation: TrainerStatAllocation { entries: vec![StatAllocationEntry { stat: TrainerCombatStat::Hp, source: StatAllocationSource::Creation, level: 1, points: 3, note: None, source_id: None }] },
        inventory: ptu_domain::profile::model::InventoryRecord { backpack: vec![ItemStack { item_id: "potion".to_string(), quantity: 1 }], storage: vec![], equipped: Default::default() },
        progression: vec![],
        build_state: None,
        ..TrainerProfile::default()
    };
    save_trainer_profile(profiles, &profile).unwrap();
    // `save_trainer_profile` assigns a stable `acquisition_id` to the
    // pushed legacy Edge (D1) — reload so every subsequent
    // `base_revision_for`/`expected_value` call reflects the REAL
    // persisted shape, not the pre-save literal (the same fix already
    // established for R3A/R4's other new fixtures).
    load_trainer_profile(profiles, &profile.id).unwrap().unwrap()
}

// =======================================================================
// D4 — dedicated respec stale/invalid/inventory-preservation evidence
// =======================================================================

#[test]
fn respec_preview_and_commit_both_reject_a_truly_stale_relevant_revision() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = TrainerProfile {
        id: new_id(),
        name: "Respec Stale".to_string(),
        level: 1,
        stat_allocation: TrainerStatAllocation { entries: vec![StatAllocationEntry { stat: TrainerCombatStat::Hp, source: StatAllocationSource::Creation, level: 1, points: 3, note: None, source_id: None }] },
        build_state: Some(json!({"status": "published"})),
        ..TrainerProfile::default()
    };
    save_trainer_profile(&mut profiles, &profile).unwrap();
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    // A relevant (stat_allocation) write lands, making the held
    // base_revision genuinely stale — not a same-operation conflict.
    let mut mutated = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    mutated.stat_allocation.entries.push(StatAllocationEntry { stat: TrainerCombatStat::Attack, source: StatAllocationSource::Creation, level: 1, points: 1, note: None, source_id: None });
    save_trainer_profile(&mut profiles, &mutated).unwrap();

    let preview_request = PreviewTrainerRespecRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision.clone(),
        proposed_normal_rebuild: json!([{"stat": "hp", "points": 5}]),
        authorized_resource_reallocations: vec![],
    };
    let preview_result = preview_trainer_respec(&definitions, &profiles, &ruleset, &revision, &preview_request);
    assert!(matches!(preview_result, Err(TrainerBuildError::StaleRevision { .. })), "{preview_result:?}");

    let commit_request = CommitTrainerRespecRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        proposed_normal_rebuild: json!([{"stat": "hp", "points": 5}]),
        authorized_resource_reallocations: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    let commit_result = commit_trainer_respec(&definitions, &mut profiles, &ruleset, &revision, &commit_request);
    assert!(matches!(commit_result, Err(TrainerBuildError::StaleRevision { .. })), "{commit_result:?}");

    // No profile mutation, no operation receipt written.
    let unchanged = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(unchanged.stat_allocation.entries.len(), 2, "still exactly the mutated state, the rejected respec changed nothing further");
    let receipt_count: i64 = profiles.query_row("SELECT COUNT(*) FROM trainer_build_operations", [], |r| r.get(0)).unwrap();
    assert_eq!(receipt_count, 0, "a rejected stale commit must not write a receipt");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn respec_rejects_a_malformed_normal_rebuild_payload_without_mutation() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = TrainerProfile {
        id: new_id(),
        name: "Respec Invalid".to_string(),
        level: 1,
        stat_allocation: TrainerStatAllocation { entries: vec![StatAllocationEntry { stat: TrainerCombatStat::Hp, source: StatAllocationSource::Creation, level: 1, points: 3, note: None, source_id: None }] },
        build_state: Some(json!({"status": "published"})),
        ..TrainerProfile::default()
    };
    save_trainer_profile(&mut profiles, &profile).unwrap();
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    // A real malformed payload — an unrecognized stat name, not a
    // structurally-valid-but-blocked-by-a-rule request.
    let request = CommitTrainerRespecRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        proposed_normal_rebuild: json!([{"stat": "not_a_real_stat", "points": 5}]),
        authorized_resource_reallocations: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    let result = commit_trainer_respec(&definitions, &mut profiles, &ruleset, &revision, &request);
    match result {
        Err(TrainerBuildError::ValidationFailed { issues }) => assert!(issues.iter().any(|i| i.issue.code == "respec_invalid_normal_rebuild"), "{issues:?}"),
        other => panic!("expected ValidationFailed, got {other:?}"),
    }
    let unchanged = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(unchanged.stat_allocation.entries.len(), 1, "the malformed payload changed nothing");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_valid_respec_commit_preserves_an_unrelated_interleaved_inventory_write() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = TrainerProfile {
        id: new_id(),
        name: "Respec Inventory".to_string(),
        level: 1,
        stat_allocation: TrainerStatAllocation { entries: vec![StatAllocationEntry { stat: TrainerCombatStat::Hp, source: StatAllocationSource::Creation, level: 1, points: 3, note: None, source_id: None }] },
        build_state: Some(json!({"status": "published"})),
        ..TrainerProfile::default()
    };
    save_trainer_profile(&mut profiles, &profile).unwrap();
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let preview_request = PreviewTrainerRespecRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision.clone(),
        proposed_normal_rebuild: json!([{"stat": "hp", "points": 5}]),
        authorized_resource_reallocations: vec![],
    };
    preview_trainer_respec(&definitions, &profiles, &ruleset, &revision, &preview_request).unwrap();

    let mut mid_profile = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    mid_profile.inventory.backpack.push(ItemStack { item_id: "potion".to_string(), quantity: 1 });
    save_trainer_profile(&mut profiles, &mid_profile).unwrap();

    let commit_request = CommitTrainerRespecRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        proposed_normal_rebuild: json!([{"stat": "hp", "points": 5}]),
        authorized_resource_reallocations: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    commit_trainer_respec(&definitions, &mut profiles, &ruleset, &revision, &commit_request).unwrap();

    let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.inventory.backpack.len(), 1, "the interleaved inventory write must survive the respec commit");

    let _ = std::fs::remove_dir_all(&dir);
}

// =======================================================================
// D4 (Legacy disposition, Reviewer alternative (a)) — real positive +
// negative evidence against genuinely `build_state: None` Trainers, for
// all four D4 command families. No Published-only guard exists or is
// added; these commands accept legacy profiles by design (reconciliation
// is intentionally FOR legacy data).
// =======================================================================

#[test]
fn advancement_accepts_a_genuine_legacy_trainer_and_preserves_its_independent_state() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_genuine_legacy_trainer(&mut profiles, 1);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let request = CommitTrainerAdvancementRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        next_level: 2,
        milestone_option_id: None,
        acquired_choices: vec![
            json!({"role": "ordinary_edge", "kind": "edge", "definition_version_id": "edges:iron-mind@core", "parameters": Value::Null}),
            json!({"role": "restricted_bonus_edge", "kind": "edge", "definition_version_id": "edges:basic-skills@core", "parameters": {"skill": "guile"}}),
        ],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    let commit = commit_trainer_advancement(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    assert!(commit.resolution.issues.is_empty(), "no Published-only guard blocks a genuine legacy Trainer: {:?}", commit.resolution.issues);

    let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.level, 2, "ordinary advancement applied normally");
    assert_eq!(reloaded.money, 250, "unrelated legacy field preserved");
    assert_eq!(reloaded.inventory.backpack.len(), 1, "unrelated legacy inventory preserved");
    assert!(reloaded.edges.iter().any(|e| e["definition_version_id"] == "edges:acrobat@core" && e["source"] == "legacy"), "the pre-existing legacy Edge is preserved untouched, not silently reclassified");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn advancement_on_a_legacy_trainer_still_rejects_incomplete_input_without_a_partial_write() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_genuine_legacy_trainer(&mut profiles, 4);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    // Level 5 requires a milestone choice — omitted here. Legacy status
    // does not weaken this validation, and does not crash instead of
    // rejecting cleanly.
    let request = CommitTrainerAdvancementRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        next_level: 5,
        milestone_option_id: None,
        acquired_choices: vec![json!({"role": "ordinary_feature", "kind": "feature", "definition_version_id": "features:let-me-help-you-with-that@core", "parameters": Value::Null})],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    let result = commit_trainer_advancement(&definitions, &mut profiles, &ruleset, &revision, &request);
    match result {
        Err(TrainerBuildError::ValidationFailed { issues }) => assert!(issues.iter().any(|i| i.issue.code == "milestone_choice_required"), "{issues:?}"),
        other => panic!("expected ValidationFailed, got {other:?}"),
    }
    let unchanged = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(unchanged.level, 4, "no partial level change on rejection");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn gm_change_accepts_a_genuine_legacy_trainer_and_preserves_its_independent_state() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_genuine_legacy_trainer(&mut profiles, 1);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let request = CommitTrainerGmChangeRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        action: "add".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"target": "trainer.stat.hp", "operation": "add", "value": 3}),
        note: None,
        confirm: true,
        operation_id: op_id(),
    };
    let commit = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    assert!(commit.resolution.issues.is_empty(), "{:?}", commit.resolution.issues);

    let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.gm_grants.len(), 1, "the real GM grant applied normally to a legacy Trainer");
    assert_eq!(reloaded.money, 250, "unrelated legacy field preserved");
    assert!(reloaded.edges.iter().any(|e| e["definition_version_id"] == "edges:acrobat@core" && e["source"] == "legacy"), "pre-existing legacy Edge preserved untouched");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn gm_change_on_a_legacy_trainer_still_rejects_an_unsupported_target_without_a_partial_write() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_genuine_legacy_trainer(&mut profiles, 1);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let request = CommitTrainerGmChangeRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        action: "add".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"target": "trainer.stat.not_a_real_stat", "operation": "add", "value": 3}),
        note: None,
        confirm: true,
        operation_id: op_id(),
    };
    let result = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &request);
    match result {
        Err(TrainerBuildError::ValidationFailed { issues }) => assert!(issues.iter().any(|i| i.issue.code == "gm_change_unsupported_target"), "{issues:?}"),
        other => panic!("expected ValidationFailed, got {other:?}"),
    }
    let unchanged = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(unchanged.gm_grants.len(), 0, "no partial grant written on rejection");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn respec_accepts_a_genuine_legacy_trainer_and_preserves_its_independent_state() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_genuine_legacy_trainer(&mut profiles, 1);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let request = CommitTrainerRespecRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        proposed_normal_rebuild: json!([{"stat": "attack", "points": 3}]),
        authorized_resource_reallocations: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    let commit = commit_trainer_respec(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    assert!(!commit.resolution.has_blocking_issue(), "{:?}", commit.resolution.issues);

    let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.money, 250, "unrelated legacy field preserved");
    assert!(reloaded.edges.iter().any(|e| e["definition_version_id"] == "edges:acrobat@core" && e["source"] == "legacy"), "pre-existing legacy Edge preserved — respec never rebuilds Edges/Features");
    assert_eq!(reloaded.stat_allocation.entries.iter().find(|e| e.stat == TrainerCombatStat::Attack).map(|e| e.points), Some(3));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn respec_on_a_legacy_trainer_still_rejects_a_malformed_rebuild_without_a_partial_write() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_genuine_legacy_trainer(&mut profiles, 1);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let request = CommitTrainerRespecRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        proposed_normal_rebuild: json!([{"stat": "not_a_real_stat", "points": 5}]),
        authorized_resource_reallocations: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    let result = commit_trainer_respec(&definitions, &mut profiles, &ruleset, &revision, &request);
    match result {
        Err(TrainerBuildError::ValidationFailed { issues }) => assert!(issues.iter().any(|i| i.issue.code == "respec_invalid_normal_rebuild"), "{issues:?}"),
        other => panic!("expected ValidationFailed, got {other:?}"),
    }
    let unchanged = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(unchanged.stat_allocation.entries.len(), 1, "unchanged — no partial write");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn milestone_reconciliation_accepts_a_genuine_legacy_trainer_and_preserves_its_independent_state() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_genuine_legacy_trainer(&mut profiles, 10);
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
        prior_benefits: json!({"disposition": "not_received", "note": "GM confirmed: this legacy Trainer never received any level-5 stream benefit."}),
        confirm: true,
        operation_id: op_id(),
    };
    let commit = commit_trainer_milestone_reconciliation(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    assert!(commit.resolution.issues.is_empty(), "reconciliation is intentionally FOR legacy data: {:?}", commit.resolution.issues);

    let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.level, 10, "unchanged — reconciliation never advances level");
    assert_eq!(reloaded.money, 250, "unrelated legacy field preserved");
    assert!(reloaded.edges.iter().any(|e| e["definition_version_id"] == "edges:acrobat@core" && e["source"] == "legacy"), "pre-existing legacy Edge preserved untouched, not silently marked reconciled");
    assert!(reloaded.progression.iter().any(|p| p["level"] == 5), "the target milestone level gained a real ledger entry");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn milestone_reconciliation_on_a_legacy_trainer_still_requires_an_explicit_prior_benefits_note() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_genuine_legacy_trainer(&mut profiles, 10);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    // No scalar defaulting/inference from an empty ledger — a genuinely
    // legacy Trainer's pending milestone still requires the SAME
    // explicit GM disposition any other Trainer would.
    let request = PreviewTrainerMilestoneReconciliationRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        milestone_level: 5,
        milestone_option_id: Some("stat_stream".to_string()),
        acquired_choices: vec![],
        stat_stream_choice: Some("attack".to_string()),
        manual_adjudications: vec![],
        prior_benefits: json!({}),
    };
    let preview = preview_trainer_milestone_reconciliation(&definitions, &profiles, &ruleset, &revision, &request).unwrap();
    assert!(preview.resolution.issues.iter().any(|i| i.issue.code == "reconciliation_prior_benefits_disposition_required"), "{:?}", preview.resolution.issues);

    let _ = std::fs::remove_dir_all(&dir);
}
