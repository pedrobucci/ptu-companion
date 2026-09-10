//! T13D4-R3C/R4: the fixed-grant category matrix — every supported
//! numeric target (`SUPPORTED_FIXED_STAT_TARGETS` + the
//! `trainer.skill.<id>.check_bonus` pattern) and every supported
//! definitional target (`trainer.edge`/`trainer.feature`/`trainer.move`/
//! `trainer.capability`) against the REAL shipped `ptu-core-1.05.ptucp`
//! pack, with real resolved effects, preview/commit agreement, and
//! source-preserving edit/remove/respec/portability persistence. Reuses
//! `commit_trainer_gm_change`'s actual implementation, not a mock.
//!
//! R3C found (and R4 fixed, D1) a real defect: Move/Capability fixed
//! grants were merged into `.features` instead of `.moves`/
//! `.capabilities`. R4 also adds the approved D2 collision policy
//! (Move/Capability rows are a per-owner definition-version-unique SET
//! at the storage layer — a second independent grant of the same
//! definition is rejected before any write, never silently overwritten).

use std::path::{Path, PathBuf};

use ptu_domain::content::context::get_content_context;
use ptu_domain::content::import::import_pack_file;
use ptu_domain::content::ruleset::{load_preset, CampaignRuleset};
use ptu_domain::engine::datasets::load_trainer_build_rules;
use ptu_domain::engine::trainer_build::{
    commit_trainer_gm_change, commit_trainer_respec, compute_base_revision, compute_rules_fingerprint, preview_trainer_gm_change, preview_trainer_respec, CommitTrainerGmChangeRequest,
    CommitTrainerRespecRequest, PreviewTrainerGmChangeRequest, PreviewTrainerRespecRequest, TrainerBuildError,
};
use ptu_domain::persistence::definitions::open_and_migrate_definitions;
use ptu_domain::persistence::profiles::open_and_migrate_profiles;
use ptu_domain::profile::model::{StatAllocationEntry, StatAllocationSource, TrainerCombatStat, TrainerProfile, TrainerStatAllocation};
use ptu_domain::profile::repository::{load_trainer_profile, new_id, save_trainer_profile};
use ptu_domain::portability::backup::{export_backup, import_backup};
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
    let dir = std::env::temp_dir().join(format!("ptu-gm-fixed-matrix-{name}-{}", uuid::Uuid::new_v4()));
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

fn seed_managed_trainer(profiles: &mut Connection) -> TrainerProfile {
    let profile = TrainerProfile {
        id: new_id(),
        name: "Fixed Grant Matrix".to_string(),
        level: 1,
        skills: skills_map(&[("acrobatics", "novice"), ("guile", "untrained")]),
        stat_allocation: TrainerStatAllocation { entries: vec![StatAllocationEntry { stat: TrainerCombatStat::Hp, source: StatAllocationSource::Creation, level: 1, points: 3, note: None, source_id: None }] },
        build_state: Some(json!({"status": "published"})),
        ..TrainerProfile::default()
    };
    save_trainer_profile(profiles, &profile).unwrap();
    profile
}

/// **Evidence index — numeric fixed-grant targets** (all 7
/// `SUPPORTED_FIXED_STAT_TARGETS` + the `trainer.skill.<id>.check_bonus`
/// pattern). Each row: real add via `commit_trainer_gm_change`, real
/// resolved effect confirmed in `core_result`, preview/commit agreement.
#[test]
fn every_supported_numeric_fixed_grant_target_applies_its_real_effect() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);

    // Deltas, not hardcoded absolute baselines — `combat_stats.X.base`/
    // `max_hp.base` (unaffected by this Trainer's own GM grant) is read
    // directly off the SAME commit response, so this matrix stays
    // correct regardless of the seed fixture's exact formula outputs.
    let delta = 3.0;
    let targets = ["trainer.stat.hp", "trainer.stat.attack", "trainer.stat.defense", "trainer.stat.special_attack", "trainer.stat.special_defense", "trainer.stat.speed", "trainer.stat.max_hp"];
    for target in targets {
        let profile = seed_managed_trainer(&mut profiles);
        let base_revision = base_revision_for(&definitions, &revision, &profile);
        let request = CommitTrainerGmChangeRequest {
            trainer_id: profile.id.clone(),
            content_pack_id: "ptu-core-1.05".to_string(),
            expected_base_revision: base_revision.clone(),
            action: "add".to_string(),
            grant_kind: "fixed".to_string(),
            payload: json!({"target": target, "operation": "add", "value": delta}),
            note: None,
            confirm: true,
            operation_id: op_id(),
        };
        // Preview/commit agreement: same request must resolve the same
        // STABLE grant shape — `id`/`created_at` legitimately differ
        // between the two calls (each mints its own), so only the
        // caller-meaningful fields are compared.
        let preview_request = PreviewTrainerGmChangeRequest { trainer_id: request.trainer_id.clone(), content_pack_id: request.content_pack_id.clone(), expected_base_revision: request.expected_base_revision.clone(), action: request.action.clone(), grant_kind: request.grant_kind.clone(), payload: request.payload.clone(), note: request.note.clone() };
        let preview = preview_trainer_gm_change(&definitions, &profiles, &ruleset, &revision, &preview_request).unwrap();
        let commit = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
        let preview_grant = preview.resolution.effective_grant.clone().unwrap();
        let commit_grant = commit.resolution.effective_grant.clone().unwrap();
        for field in ["target", "operation", "value", "kind"] {
            assert_eq!(preview_grant[field], commit_grant[field], "target {target}, field {field}: preview and commit must resolve the SAME grant shape");
        }

        let (base, final_value) = match target {
            "trainer.stat.hp" => (commit.core_result.combat_stats.hp.base, commit.core_result.combat_stats.hp.final_value),
            "trainer.stat.attack" => (commit.core_result.combat_stats.attack.base, commit.core_result.combat_stats.attack.final_value),
            "trainer.stat.defense" => (commit.core_result.combat_stats.defense.base, commit.core_result.combat_stats.defense.final_value),
            "trainer.stat.special_attack" => (commit.core_result.combat_stats.special_attack.base, commit.core_result.combat_stats.special_attack.final_value),
            "trainer.stat.special_defense" => (commit.core_result.combat_stats.special_defense.base, commit.core_result.combat_stats.special_defense.final_value),
            "trainer.stat.speed" => (commit.core_result.combat_stats.speed.base, commit.core_result.combat_stats.speed.final_value),
            "trainer.stat.max_hp" => (commit.core_result.max_hp.base, commit.core_result.max_hp.final_value),
            other => panic!("unhandled target in test matrix: {other}"),
        };
        assert_eq!(final_value - base, delta, "target {target}: real resolved effect — final_value must be exactly base + the GM grant's own delta");
    }

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_skill_check_bonus_numeric_fixed_grant_is_accepted_and_persisted() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_managed_trainer(&mut profiles);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let request = CommitTrainerGmChangeRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        action: "add".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"target": "trainer.skill.guile.check_bonus", "operation": "add", "value": 2}),
        note: Some("GM boon on Guile checks.".to_string()),
        confirm: true,
        operation_id: op_id(),
    };
    let commit = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    assert!(commit.resolution.issues.is_empty(), "{:?}", commit.resolution.issues);
    let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.gm_grants[0]["target"], "trainer.skill.guile.check_bonus");
    assert_eq!(reloaded.gm_grants[0]["value"], 2.0);

    // An unrecognized skill id rejects, distinguishing this from a
    // generic numeric target that would silently accept anything.
    let bad_request = CommitTrainerGmChangeRequest { expected_base_revision: base_revision_for(&definitions, &revision, &reloaded), payload: json!({"target": "trainer.skill.not-a-real-skill.check_bonus", "operation": "add", "value": 2}), operation_id: op_id(), ..request };
    let bad_result = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &bad_request);
    assert!(matches!(bad_result, Err(TrainerBuildError::ValidationFailed { .. })), "{bad_result:?}");

    let _ = std::fs::remove_dir_all(&dir);
}

/// **Evidence index — definitional fixed-grant targets**
/// (`trainer.edge`/`trainer.feature`/`trainer.move`/`trainer.capability`).
/// `trainer.feature` was already covered by
/// `trainer_advancement.rs::add_fixed_definitional_grant_creates_a_real_linked_acquisition`
/// (reused, not duplicated here); this closes the other three, which had
/// NO real test anywhere before this round.
#[test]
fn every_supported_definitional_fixed_grant_target_creates_a_real_linked_acquisition() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);

    let cases: [(&str, &str, &str); 3] = [("trainer.edge", "edges:acrobat@core", "edge"), ("trainer.move", "moves:absorb@core", "move"), ("trainer.capability", "capabilities:amorphous@core", "capability")];
    for (target, dvi, expected_policy_kind) in cases {
        let profile = seed_managed_trainer(&mut profiles);
        let base_revision = base_revision_for(&definitions, &revision, &profile);
        let request = CommitTrainerGmChangeRequest {
            trainer_id: profile.id.clone(),
            content_pack_id: "ptu-core-1.05".to_string(),
            expected_base_revision: base_revision,
            action: "add".to_string(),
            grant_kind: "fixed".to_string(),
            payload: json!({"target": target, "definition_version_id": dvi, "parameters": Value::Null}),
            note: None,
            confirm: true,
            operation_id: op_id(),
        };
        // NOTE: this asserts only the RESOLUTION-level linked_acquisition
        // shape (real, correct for all three targets) — NOT the
        // persisted profile state, which has a confirmed separate defect
        // for move/capability targets specifically. See
        // `confirmed_defect_a_move_fixed_grant_is_misfiled_into_features_instead_of_moves`
        // below for that isolated reproduction.
        let commit = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
        assert!(commit.resolution.issues.is_empty(), "target {target}: {:?}", commit.resolution.issues);
        let link = commit.resolution.linked_acquisition.clone().unwrap_or_else(|| panic!("target {target}: no linked_acquisition returned"));
        assert_eq!(link["definition_version_id"], dvi);
        assert_eq!(link["source"], "gm_fixed");
        assert_eq!(link["policy_kind"], expected_policy_kind, "target {target}: policy_kind should match its own content kind slug");
    }

    let _ = std::fs::remove_dir_all(&dir);
}

/// **T13D4-R4 (D1): FIXED — the confirmed move/capability misrouting
/// defect from R3C.** `commit_trainer_gm_change`'s merge step previously
/// branched ONLY on `link.get("policy_kind") == Some("edge")`, pushing
/// everything else — including the two real, supported `"move"`/
/// `"capability"` policy kinds — into `updated_profile.features`. Now
/// routes all four kinds to their own collection. This test was
/// previously `#[ignore]`d as a documented failing reproduction (see
/// `T13D4_R3_WORKER_RESULT.md`); it is now a normal, un-ignored,
/// passing regression — the assertions were never changed to match the
/// old wrong behavior, only the production code was corrected.
#[test]
fn a_move_fixed_grant_persists_in_moves_not_features() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_managed_trainer(&mut profiles);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let request = CommitTrainerGmChangeRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        action: "add".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"target": "trainer.move", "definition_version_id": "moves:absorb@core", "parameters": Value::Null}),
        note: None,
        confirm: true,
        operation_id: op_id(),
    };
    commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();

    let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.moves.len(), 1, "a trainer.move fixed grant's linked acquisition must be persisted in .moves");
    assert_eq!(reloaded.features.len(), 0, "...and must NOT be misfiled into .features");

    let _ = std::fs::remove_dir_all(&dir);
}

/// The capability counterpart, required alongside the move fix per the
/// R4 handoff ("add capability coverage").
#[test]
fn a_capability_fixed_grant_persists_in_capabilities_not_features() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_managed_trainer(&mut profiles);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let request = CommitTrainerGmChangeRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        action: "add".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"target": "trainer.capability", "definition_version_id": "capabilities:amorphous@core", "parameters": Value::Null}),
        note: None,
        confirm: true,
        operation_id: op_id(),
    };
    commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();

    let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.capabilities.len(), 1, "a trainer.capability fixed grant's linked acquisition must be persisted in .capabilities");
    assert_eq!(reloaded.features.len(), 0, "...and must NOT be misfiled into .features");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn editing_a_definitional_fixed_grants_definition_is_rejected_immutable() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_managed_trainer(&mut profiles);
    let add = CommitTrainerGmChangeRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile),
        action: "add".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"target": "trainer.move", "definition_version_id": "moves:absorb@core", "parameters": Value::Null}),
        note: None,
        confirm: true,
        operation_id: op_id(),
    };
    let after_add = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &add).unwrap();
    let grant_id = after_add.resolution.grant_id.clone().unwrap();

    let profile_after_add = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    let edit = PreviewTrainerGmChangeRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile_after_add),
        action: "edit".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"grant_id": grant_id, "definition_version_id": "moves:acid@core"}),
        note: None,
    };
    let preview = preview_trainer_gm_change(&definitions, &profiles, &ruleset, &revision, &edit).unwrap();
    assert!(preview.resolution.issues.iter().any(|i| i.issue.code == "gm_change_definitional_grant_immutable"), "{:?}", preview.resolution.issues);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn removing_a_definitional_fixed_grant_removes_its_linked_acquisition_source_preserving_other_state() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_managed_trainer(&mut profiles);
    // Uses `trainer.edge` deliberately (not `trainer.capability`/
    // `trainer.move`) — this test validates REMOVE semantics, which is
    // orthogonal to the separate confirmed merge-target defect isolated
    // in `confirmed_defect_a_move_fixed_grant_is_misfiled_into_features_instead_of_moves`.
    let add = CommitTrainerGmChangeRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile),
        action: "add".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"target": "trainer.edge", "definition_version_id": "edges:acrobat@core", "parameters": Value::Null}),
        note: None,
        confirm: true,
        operation_id: op_id(),
    };
    let after_add = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &add).unwrap();
    let grant_id = after_add.resolution.grant_id.clone().unwrap();
    let profile_after_add = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(profile_after_add.edges.len(), 1);

    let remove = CommitTrainerGmChangeRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile_after_add),
        action: "remove".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"grant_id": grant_id}),
        note: None,
        confirm: true,
        operation_id: op_id(),
    };
    commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &remove).unwrap();
    let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.edges.len(), 0, "the linked edge acquisition is removed with its grant");
    assert_eq!(reloaded.gm_grants.len(), 0);

    let _ = std::fs::remove_dir_all(&dir);
}

/// **T13D4-R4 (D1 lifecycle requirement)**: add -> replay -> reload ->
/// normal respec -> remove, for BOTH Move and Capability, alongside an
/// independent unrelated Edge fixed grant that must survive every step
/// untouched.
#[test]
fn move_and_capability_lifecycle_add_replay_reload_respec_remove_preserves_independent_state() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_managed_trainer(&mut profiles);

    let add_edge = CommitTrainerGmChangeRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile),
        action: "add".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"target": "trainer.edge", "definition_version_id": "edges:acrobat@core", "parameters": Value::Null}),
        note: None,
        confirm: true,
        operation_id: op_id(),
    };
    commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &add_edge).unwrap();

    let profile_after_edge = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    let add_move = CommitTrainerGmChangeRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile_after_edge),
        action: "add".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"target": "trainer.move", "definition_version_id": "moves:absorb@core", "parameters": Value::Null}),
        note: None,
        confirm: true,
        operation_id: op_id(),
    };
    let move_commit = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &add_move).unwrap();
    let move_grant_id = move_commit.resolution.grant_id.clone().unwrap();

    let profile_after_move = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    let add_capability = CommitTrainerGmChangeRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile_after_move),
        action: "add".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"target": "trainer.capability", "definition_version_id": "capabilities:amorphous@core", "parameters": Value::Null}),
        note: None,
        confirm: true,
        operation_id: op_id(),
    };
    commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &add_capability).unwrap();

    // Replay: same operation_id/payload for the move add returns the same result, no duplication.
    let replay = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &add_move).unwrap();
    assert_eq!(replay.resolution.grant_id, Some(move_grant_id.clone()));

    drop(profiles);
    let mut reopened = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
    let reloaded = load_trainer_profile(&reopened, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.edges.len(), 1);
    assert_eq!(reloaded.moves.len(), 1, "a replay must not duplicate the move acquisition");
    assert_eq!(reloaded.capabilities.len(), 1);
    assert_eq!(reloaded.gm_grants.len(), 3);

    // Normal respec (stat rebuild only) must preserve all three fixed
    // grants and their correctly-routed linked acquisitions untouched.
    let respec_request = CommitTrainerRespecRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &reloaded),
        proposed_normal_rebuild: json!([{"stat": "hp", "points": 3}]),
        authorized_resource_reallocations: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    let respec_commit = commit_trainer_respec(&definitions, &mut reopened, &ruleset, &revision, &respec_request).unwrap();
    assert!(!respec_commit.resolution.has_blocking_issue(), "{:?}", respec_commit.resolution.issues);

    let after_respec = load_trainer_profile(&reopened, &profile.id).unwrap().unwrap();
    assert_eq!(after_respec.edges.len(), 1, "independent edge grant survives respec");
    assert_eq!(after_respec.moves.len(), 1, "move grant survives respec");
    assert_eq!(after_respec.capabilities.len(), 1, "capability grant survives respec");
    assert_eq!(after_respec.gm_grants.len(), 3, "all three fixed grants survive respec");

    // Remove the move grant — only it and its linked acquisition disappear.
    let remove_move = CommitTrainerGmChangeRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &after_respec),
        action: "remove".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"grant_id": move_grant_id}),
        note: None,
        confirm: true,
        operation_id: op_id(),
    };
    commit_trainer_gm_change(&definitions, &mut reopened, &ruleset, &revision, &remove_move).unwrap();

    let final_profile = load_trainer_profile(&reopened, &profile.id).unwrap().unwrap();
    assert_eq!(final_profile.moves.len(), 0, "the move grant's linked acquisition is removed");
    assert_eq!(final_profile.edges.len(), 1, "the independent edge grant remains untouched");
    assert_eq!(final_profile.capabilities.len(), 1, "the independent capability grant remains untouched");
    assert_eq!(final_profile.gm_grants.len(), 2, "only the removed grant is gone");

    let _ = std::fs::remove_dir_all(&dir);
}

/// **T13D4-R4 (D2, approved collision policy)**: a second, independent
/// grant of a Move/Capability the Trainer already owns rejects BEFORE
/// any write — never silently overwritten, deleted, or adopted.
#[test]
fn adding_a_move_fixed_grant_for_an_already_owned_definition_rejects_before_any_write() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let mut profile = seed_managed_trainer(&mut profiles);
    profile.moves.push(json!({"definition_version_id": "moves:absorb@core", "source": "legacy", "sequence": 0}));
    save_trainer_profile(&mut profiles, &profile).unwrap();
    let profile = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    let request = CommitTrainerGmChangeRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision,
        action: "add".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"target": "trainer.move", "definition_version_id": "moves:absorb@core", "parameters": Value::Null}),
        note: None,
        confirm: true,
        operation_id: op_id(),
    };
    let result = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &request);
    match result {
        Err(TrainerBuildError::ValidationFailed { issues }) => assert!(issues.iter().any(|i| i.issue.code == "gm_change_move_capability_already_owned"), "{issues:?}"),
        other => panic!("expected ValidationFailed, got {other:?}"),
    }
    let grant_count: i64 = profiles.query_row("SELECT COUNT(*) FROM trainer_gm_grants WHERE trainer_id = ?1", [&profile.id], |r| r.get(0)).unwrap();
    assert_eq!(grant_count, 0, "no grant written on collision rejection");
    let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(reloaded.moves.len(), 1, "the existing independent move entry is untouched");
    assert_eq!(reloaded.moves[0]["source"], "legacy", "not overwritten/adopted");

    let _ = std::fs::remove_dir_all(&dir);
}

/// **T13D4-R4 (D1 portability requirement)**: correctly-typed Move/
/// Capability fixed-grant acquisitions — not merely a `linked_acquisition`
/// response — survive a real full backup export/import round trip, in
/// their OWN collections, with `source_id` intact.
#[test]
fn move_and_capability_fixed_grants_survive_a_full_backup_round_trip() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_managed_trainer(&mut profiles);
    let add_move = CommitTrainerGmChangeRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile),
        action: "add".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"target": "trainer.move", "definition_version_id": "moves:absorb@core", "parameters": Value::Null}),
        note: None,
        confirm: true,
        operation_id: op_id(),
    };
    let move_commit = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &add_move).unwrap();
    let move_grant_id = move_commit.resolution.grant_id.clone().unwrap();

    let profile_after_move = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    let add_capability = CommitTrainerGmChangeRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision_for(&definitions, &revision, &profile_after_move),
        action: "add".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"target": "trainer.capability", "definition_version_id": "capabilities:amorphous@core", "parameters": Value::Null}),
        note: None,
        confirm: true,
        operation_id: op_id(),
    };
    let capability_commit = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &add_capability).unwrap();
    let capability_grant_id = capability_commit.resolution.grant_id.clone().unwrap();

    let outcome = export_backup(&definitions, &profiles, None).unwrap();
    let restore_dir = std::env::temp_dir().join(format!("ptu-move-capability-backup-restore-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&restore_dir).unwrap();
    let mut fresh_definitions = open_and_migrate_definitions(&restore_dir.join("definitions.sqlite")).unwrap();
    let mut fresh_profiles = open_and_migrate_profiles(&restore_dir.join("profiles.sqlite")).unwrap();
    import_backup(&mut fresh_definitions, &mut fresh_profiles, &outcome.bytes).unwrap();

    let restored = load_trainer_profile(&fresh_profiles, &profile.id).unwrap().unwrap();
    assert_eq!(restored.moves.len(), 1);
    assert_eq!(restored.moves[0]["definition_version_id"], "moves:absorb@core");
    assert_eq!(restored.moves[0]["source_id"], move_grant_id);
    assert_eq!(restored.capabilities.len(), 1);
    assert_eq!(restored.capabilities[0]["definition_version_id"], "capabilities:amorphous@core");
    assert_eq!(restored.capabilities[0]["source_id"], capability_grant_id);
    assert_eq!(restored.features.len(), 0, "neither is misfiled into features after a full backup round trip");

    let _ = std::fs::remove_dir_all(&dir);
    let _ = std::fs::remove_dir_all(&restore_dir);
}

// =======================================================================
// T13D4-R5A — safe handling of a genuinely PERSISTED, historically
// misfiled fixed grant (T13D4_R4_FINAL_GATE_REVIEW.md: D1/D2's own fix
// only proves correct routing GOING FORWARD; it never proved what
// happens to a grant whose linked acquisition was ALREADY sitting in the
// wrong collection before this correction existed — e.g. a Move fixed
// grant added under the pre-D1 code, which pushed it into `.features`).
// This is constructed directly as a persisted fixture (never by calling
// the old buggy code path, which no longer exists) and reloaded from
// SQLite before every assertion, per the handoff's own Key Risk ("an
// in-memory vector alone does not reproduce historical stored data").
// =======================================================================

/// Returns `(profile, misfiled_grant_id, independent_grant_id)` for a
/// Trainer carrying: (1) a "historically misfiled" fixed grant whose
/// `target` is `trainer.move` (or `trainer.capability`) but whose linked
/// acquisition is persisted in `.features` — exactly what pre-D1 code
/// would have produced — and (2) a fully independent, correctly-routed
/// Edge fixed grant that must survive every operation below untouched.
fn seed_trainer_with_a_historically_misfiled_grant(profiles: &mut Connection, move_or_capability_dvi: &str, table_kind_slug: &str) -> (TrainerProfile, String, String) {
    let misfiled_grant_id = new_id();
    let independent_grant_id = new_id();
    let misfiled_acquisition = json!({
        "definition_version_id": move_or_capability_dvi,
        "parameters": Value::Null,
        "policy_kind": table_kind_slug,
        "source": "gm_fixed",
        "source_id": misfiled_grant_id,
        "level": 1,
        "sequence": 0,
    });
    let independent_acquisition = json!({
        "definition_version_id": "edges:acrobat@core",
        "parameters": Value::Null,
        "policy_kind": "edge",
        "source": "gm_fixed",
        "source_id": independent_grant_id,
        "level": 1,
        "sequence": 0,
    });
    let profile = TrainerProfile {
        id: new_id(),
        name: "Historically Misfiled Grant".to_string(),
        level: 1,
        skills: skills_map(&[("acrobatics", "novice")]),
        stat_allocation: TrainerStatAllocation { entries: vec![StatAllocationEntry { stat: TrainerCombatStat::Hp, source: StatAllocationSource::Creation, level: 1, points: 3, note: None, source_id: None }] },
        gm_grants: vec![
            json!({"id": misfiled_grant_id, "kind": "fixed", "target": format!("trainer.{}", table_kind_slug), "definition_version_id": move_or_capability_dvi, "parameters": Value::Null, "note": null, "created_at": "2026-01-01T00:00:00Z"}),
            json!({"id": independent_grant_id, "kind": "fixed", "target": "trainer.edge", "definition_version_id": "edges:acrobat@core", "parameters": Value::Null, "note": null, "created_at": "2026-01-01T00:00:00Z"}),
        ],
        // The misfiled acquisition sits in `.features` — the WRONG
        // collection for a move/capability — simulating genuine pre-D1
        // persisted state. `.moves`/`.capabilities` are correctly empty
        // (nothing was ever routed there for this grant).
        features: vec![misfiled_acquisition],
        edges: vec![independent_acquisition],
        build_state: Some(json!({"status": "published"})),
        ..TrainerProfile::default()
    };
    save_trainer_profile(profiles, &profile).unwrap();
    // Reload — an in-memory vector alone does not reproduce historical
    // stored data (the Key Risk this fixture is specifically built to
    // avoid).
    let reloaded = load_trainer_profile(profiles, &profile.id).unwrap().unwrap();
    (reloaded, misfiled_grant_id, independent_grant_id)
}

#[test]
fn a_normal_respec_never_silently_loses_or_reclassifies_a_historically_misfiled_grant() {
    for (dvi, kind_slug) in [("moves:absorb@core", "move"), ("capabilities:amorphous@core", "capability")] {
        let (dir, definitions, mut profiles, ruleset) = setup();
        let revision = e02_revision(&definitions, &ruleset);
        let (profile, misfiled_grant_id, independent_grant_id) = seed_trainer_with_a_historically_misfiled_grant(&mut profiles, dvi, kind_slug);
        let base_revision = base_revision_for(&definitions, &revision, &profile);

        let preview_request = PreviewTrainerRespecRequest {
            trainer_id: profile.id.clone(),
            content_pack_id: "ptu-core-1.05".to_string(),
            expected_base_revision: base_revision.clone(),
            proposed_normal_rebuild: json!([{"stat": "attack", "points": 3}]),
            authorized_resource_reallocations: vec![],
        };
        let preview = preview_trainer_respec(&definitions, &profiles, &ruleset, &revision, &preview_request).unwrap();
        assert!(!preview.resolution.has_blocking_issue(), "kind {kind_slug}: {:?}", preview.resolution.issues);

        let commit_request = CommitTrainerRespecRequest {
            trainer_id: profile.id.clone(),
            content_pack_id: "ptu-core-1.05".to_string(),
            expected_base_revision: base_revision,
            proposed_normal_rebuild: json!([{"stat": "attack", "points": 3}]),
            authorized_resource_reallocations: vec![],
            confirm: true,
            operation_id: op_id(),
        };
        commit_trainer_respec(&definitions, &mut profiles, &ruleset, &revision, &commit_request).unwrap();

        let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
        assert_eq!(reloaded.features.len(), 1, "kind {kind_slug}: the misfiled acquisition is NOT silently lost by an unrelated normal respec");
        assert_eq!(reloaded.features[0]["source_id"], misfiled_grant_id, "kind {kind_slug}: still linked to its real grant, not orphaned");
        assert_eq!(reloaded.features[0]["policy_kind"], kind_slug, "kind {kind_slug}: NOT silently reclassified/relabeled — respec never guesses at repair");
        assert!(reloaded.moves.is_empty() && reloaded.capabilities.is_empty(), "kind {kind_slug}: no automatic migration into the 'correct' collection happened either — D3 forbids inferred repair");
        assert_eq!(reloaded.edges.len(), 1, "kind {kind_slug}: the fully independent Edge grant survives untouched");
        assert_eq!(reloaded.gm_grants.len(), 2, "kind {kind_slug}: both grants (misfiled and independent) survive respec");
        assert_eq!(reloaded.gm_grants.iter().find(|g| g["id"] == independent_grant_id).unwrap()["target"], "trainer.edge");

        let _ = std::fs::remove_dir_all(&dir);
    }
}

#[test]
fn explicit_source_specific_removal_safely_removes_a_historically_misfiled_grant_wherever_it_actually_is() {
    for (dvi, kind_slug) in [("moves:absorb@core", "move"), ("capabilities:amorphous@core", "capability")] {
        let (dir, definitions, mut profiles, ruleset) = setup();
        let revision = e02_revision(&definitions, &ruleset);
        let (profile, misfiled_grant_id, independent_grant_id) = seed_trainer_with_a_historically_misfiled_grant(&mut profiles, dvi, kind_slug);
        let base_revision = base_revision_for(&definitions, &revision, &profile);

        // Preview the removal first: dependent_invalidations must find
        // and name the misfiled acquisition even though it is NOT in the
        // collection its own policy_kind would suggest — proving the
        // scan is by `source_id`, never by an assumed "correct" location.
        let preview_request = PreviewTrainerGmChangeRequest {
            trainer_id: profile.id.clone(),
            content_pack_id: "ptu-core-1.05".to_string(),
            expected_base_revision: base_revision.clone(),
            action: "remove".to_string(),
            grant_kind: "fixed".to_string(),
            payload: json!({"grant_id": misfiled_grant_id}),
            note: None,
        };
        let preview = preview_trainer_gm_change(&definitions, &profiles, &ruleset, &revision, &preview_request).unwrap();
        assert_eq!(preview.resolution.dependent_invalidations.len(), 1, "kind {kind_slug}: {:?}", preview.resolution.dependent_invalidations);
        assert!(preview.resolution.dependent_invalidations[0].contains(dvi), "kind {kind_slug}: the misfiled acquisition is correctly named despite being in the wrong collection: {:?}", preview.resolution.dependent_invalidations);

        let remove_request = CommitTrainerGmChangeRequest {
            trainer_id: profile.id.clone(),
            content_pack_id: "ptu-core-1.05".to_string(),
            expected_base_revision: base_revision,
            action: "remove".to_string(),
            grant_kind: "fixed".to_string(),
            payload: json!({"grant_id": misfiled_grant_id}),
            note: None,
            confirm: true,
            operation_id: op_id(),
        };
        commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &remove_request).unwrap();

        let reloaded = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
        assert_eq!(reloaded.features.len(), 0, "kind {kind_slug}: the misfiled acquisition is safely removed from wherever it ACTUALLY was, not left behind because it wasn't in the 'expected' collection");
        assert!(reloaded.moves.is_empty() && reloaded.capabilities.is_empty(), "kind {kind_slug}: nothing was created in the 'correct' collection either — this is an explicit removal, not an inferred repair/migration");
        assert_eq!(reloaded.gm_grants.len(), 1, "kind {kind_slug}: only the explicitly targeted grant is gone");
        assert_eq!(reloaded.gm_grants[0]["id"], independent_grant_id, "kind {kind_slug}: the independent grant remains, untouched, exact-source removal only");
        assert_eq!(reloaded.edges.len(), 1, "kind {kind_slug}: the independent Edge acquisition remains");

        let _ = std::fs::remove_dir_all(&dir);
    }
}

// =======================================================================
// T13D4-R5B — real GM-change StaleRevision, in BOTH preview and commit
// (T13D4_R4_FINAL_GATE_REVIEW.md: the six-command index's GM-change
// "Stale" cell cited `gm_change_replay_returns_the_same_result_and_rejects_a_conflicting_reuse`,
// which asserts `OperationConflict` — a DIFFERENT rejection reason —
// never `StaleRevision`. No GM-change test anywhere ever asserted
// `StaleRevision`. This closes that gap directly, mirroring the exact
// pattern already correctly applied to advancement and respec.)
// =======================================================================

#[test]
fn gm_change_preview_and_commit_both_reject_a_truly_stale_relevant_revision() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let profile = seed_managed_trainer(&mut profiles);
    let base_revision = base_revision_for(&definitions, &revision, &profile);

    // A relevant (stat_allocation) write lands, making the held
    // base_revision genuinely stale — not a same-operation-id conflict.
    let mut mutated = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    mutated.stat_allocation.entries.push(StatAllocationEntry { stat: TrainerCombatStat::Attack, source: StatAllocationSource::Creation, level: 1, points: 1, note: None, source_id: None });
    save_trainer_profile(&mut profiles, &mutated).unwrap();

    let preview_request = PreviewTrainerGmChangeRequest {
        trainer_id: profile.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: base_revision.clone(),
        action: "add".to_string(),
        grant_kind: "fixed".to_string(),
        payload: json!({"target": "trainer.stat.hp", "operation": "add", "value": 3}),
        note: None,
    };
    let preview_result = preview_trainer_gm_change(&definitions, &profiles, &ruleset, &revision, &preview_request);
    assert!(matches!(preview_result, Err(TrainerBuildError::StaleRevision { .. })), "{preview_result:?}");

    // Commit: a FRESH, never-before-used operation_id — this is NOT an
    // operation_id reuse/conflict scenario, it is a genuinely stale
    // revision on a brand-new operation.
    let commit_request = CommitTrainerGmChangeRequest {
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
    let commit_result = commit_trainer_gm_change(&definitions, &mut profiles, &ruleset, &revision, &commit_request);
    assert!(matches!(commit_result, Err(TrainerBuildError::StaleRevision { .. })), "{commit_result:?}");

    // No profile mutation, no operation receipt written by either call.
    let unchanged = load_trainer_profile(&profiles, &profile.id).unwrap().unwrap();
    assert_eq!(unchanged.gm_grants.len(), 0, "the rejected stale commit wrote no grant");
    assert_eq!(unchanged.stat_allocation.entries.len(), 2, "still exactly the interleaved mutated state, nothing further changed");
    let receipt_count: i64 = profiles.query_row("SELECT COUNT(*) FROM trainer_build_operations", [], |r| r.get(0)).unwrap();
    assert_eq!(receipt_count, 0, "a rejected stale GM-change commit must not write a receipt");

    let _ = std::fs::remove_dir_all(&dir);
}
