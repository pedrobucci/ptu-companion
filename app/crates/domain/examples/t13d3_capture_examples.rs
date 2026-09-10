//! T13D3: prints REAL serialized success/invalid/stale/legacy examples for
//! `preview_trainer_build`/`commit_trainer_build` (level-1 Trainer creation,
//! Core pp12-18) against the actual shipped `ptu-core-1.05.ptucp` pack and
//! isolated SQLite — the evidence behind `T13D3_SERIALIZED_EXAMPLES.md`.
//! Run with: `cargo run -p ptu-domain --example t13d3_capture_examples`.
//! Not part of the test suite; a one-off evidence-capture tool, kept in the
//! repo so the examples are reproducible rather than hand-typed. The same
//! fixtures (`full_valid_intent`) are exercised, and pass, in
//! `app/crates/domain/tests/trainer_build_creation.rs`.

use ptu_domain::content::authoring::soft_delete_definition;
use ptu_domain::content::context::get_content_context;
use ptu_domain::content::import::import_pack_file;
use ptu_domain::content::ruleset::load_preset;
use ptu_domain::content::ContentKind;
use ptu_domain::engine::trainer_build::{commit_build, preview_build, AcquisitionIntent, BackgroundIntent, CommitTrainerBuildRequest, PreviewTrainerBuildRequest, TrainerBuildCreationIntent};
use ptu_domain::engine::trainer_core::StatAllocationDraftEntry;
use ptu_domain::persistence::definitions::open_and_migrate_definitions;
use ptu_domain::persistence::profiles::open_and_migrate_profiles;
use ptu_domain::profile::model::TrainerCombatStat;
use ptu_domain::profile::repository::load_trainer_profile;
use serde_json::json;
use std::path::Path;

fn acq(kind: &str, dvi: &str, parameters: serde_json::Value) -> AcquisitionIntent {
    AcquisitionIntent { kind: kind.to_string(), definition_version_id: dvi.to_string(), parameters, is_free_training_feature: false }
}
fn free_training(dvi: &str) -> AcquisitionIntent {
    AcquisitionIntent { kind: "feature".to_string(), definition_version_id: dvi.to_string(), parameters: serde_json::Value::Null, is_free_training_feature: true }
}

fn full_valid_intent() -> TrainerBuildCreationIntent {
    TrainerBuildCreationIntent {
        name: "Ash".to_string(),
        background: BackgroundIntent {
            name: "Rookie".to_string(),
            story: Some("Grew up chasing Pokémon in the hills.".to_string()),
            adept_skill: "acrobatics".to_string(),
            novice_skill: "command".to_string(),
            pathetic_skills: vec!["stealth".to_string(), "intimidate".to_string(), "survival".to_string()],
        },
        acquisitions: vec![
            acq("edge", "edges:basic-skills@core", json!({"skill": "perception"})),
            acq("feature", "features:chronicler@core", serde_json::Value::Null),
            acq("edge", "edges:basic-skills@core", json!({"skill": "guile"})),
            acq("feature", "features:ace-trainer@core", serde_json::Value::Null),
            acq("edge", "edges:acrobat@core", serde_json::Value::Null),
            acq("feature", "features:commander@core", serde_json::Value::Null),
            acq("edge", "edges:categoric-inclination@core", json!({"category": "spirit"})),
            acq("feature", "features:hex-maniac@core", serde_json::Value::Null),
            free_training("features:brutal-training@core"),
        ],
        stat_desired_points: vec![
            StatAllocationDraftEntry { stat: TrainerCombatStat::Hp, points: 2 },
            StatAllocationDraftEntry { stat: TrainerCombatStat::Attack, points: 3 },
            StatAllocationDraftEntry { stat: TrainerCombatStat::Speed, points: 5 },
        ],
        weight_lb: Some(150),
        elemental_connection_mode: None,
    }
}

fn main() {
    let repo_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let dir = std::env::temp_dir().join(format!("ptu-d3-capture-examples-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let mut definitions = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    let mut profiles = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
    let packs_dir = repo_root.join("content_packs");
    let rulesets_dir = repo_root.join("rulesets");
    import_pack_file(&mut definitions, &packs_dir.join("ptu-core-1.05.ptucp")).unwrap();
    let ruleset = load_preset(&rulesets_dir, "ptu-core-only").unwrap().unwrap();
    let revision = get_content_context(&definitions, &ruleset, &rulesets_dir, &packs_dir).unwrap().revision;

    let intent = full_valid_intent();
    let intent_value = serde_json::to_value(&intent).unwrap();

    println!("=== 1. preview_trainer_build — SUCCESS (with one deliberate manual_review-eligible issue surfaced, not yet overridden) ===");
    let preview_request = PreviewTrainerBuildRequest { trainer_id: None, content_pack_id: "ptu-core-1.05".to_string(), base_revision: None, intent: intent_value.clone(), manual_adjudications: vec![] };
    let preview = preview_build(&definitions, &profiles, &ruleset, &revision, &preview_request).unwrap();
    println!("{}", serde_json::to_string_pretty(&preview).unwrap());

    println!("\n=== 2. commit_trainer_build — INVALID (blocking issue not adjudicated) ===");
    let invalid_commit = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value.clone(),
        expected_base_revision: preview.base_revision.clone(),
        manual_adjudications: vec![],
        confirm: true,
        operation_id: uuid::Uuid::new_v4().to_string(),
    };
    let invalid_result = commit_build(&definitions, &mut profiles, &ruleset, &revision, &invalid_commit);
    println!("{}", serde_json::to_string_pretty(&invalid_result.unwrap_err()).unwrap());

    println!("\n=== 3. commit_trainer_build — SUCCESS (adjudicated) ===");
    let commit_operation_id = uuid::Uuid::new_v4().to_string();
    let commit_request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value.clone(),
        expected_base_revision: preview.base_revision.clone(),
        manual_adjudications: vec![json!({"code": "prerequisite_not_met", "field": "acquisitions[7]", "note": "GM approved: campaign lets Occult apprentices learn Hex Maniac early."})],
        confirm: true,
        operation_id: commit_operation_id.clone(),
    };
    let commit = commit_build(&definitions, &mut profiles, &ruleset, &revision, &commit_request).unwrap();
    println!("{}", serde_json::to_string_pretty(&commit).unwrap());
    let persisted = load_trainer_profile(&profiles, &commit.trainer_id).unwrap().unwrap();
    println!("\n--- persisted TrainerProfile (reloaded from SQLite) ---");
    println!("{}", serde_json::to_string_pretty(&persisted).unwrap());

    println!("\n=== 3b. commit_trainer_build — REPLAY (T13D3-R1A: same operation_id, same payload, trainer_id still None — the confirmed BLOCKER's fix) ===");
    let replay = commit_build(&definitions, &mut profiles, &ruleset, &revision, &commit_request).unwrap();
    println!("replayed trainer_id == first trainer_id: {}", replay.trainer_id == commit.trainer_id);
    let trainer_count: i64 = profiles.query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0)).unwrap();
    println!("trainers table row count after replay: {trainer_count}");

    println!("\n=== 3c. commit_trainer_build — OPERATION_CONFLICT (same operation_id, different payload) ===");
    let mut different_intent = intent.clone();
    different_intent.name = "Misty".to_string();
    let conflicting_request = CommitTrainerBuildRequest { intent: serde_json::to_value(&different_intent).unwrap(), ..commit_request };
    let conflict_result = commit_build(&definitions, &mut profiles, &ruleset, &revision, &conflicting_request);
    println!("{}", serde_json::to_string_pretty(&conflict_result.unwrap_err()).unwrap());

    println!("\n=== 3d. commit_trainer_build — PACK_NOT_ACTIVE (content_pack_id not enabled in the active ruleset) ===");
    let unactivated_pack_request = CommitTrainerBuildRequest {
        content_pack_id: "not-a-real-or-enabled-pack".to_string(),
        operation_id: uuid::Uuid::new_v4().to_string(),
        ..conflicting_request
    };
    let pack_result = commit_build(&definitions, &mut profiles, &ruleset, &revision, &unactivated_pack_request);
    println!("{}", serde_json::to_string_pretty(&pack_result.unwrap_err()).unwrap());

    println!("\n=== 4. preview_trainer_build — STALE (E02 content changed underneath a held base_revision) ===");
    soft_delete_definition(&definitions, ContentKind::Edge, "edges:acrobat@core").unwrap();
    let revision_after_disable = get_content_context(&definitions, &ruleset, &rulesets_dir, &packs_dir).unwrap().revision;
    let stale_preview_request = PreviewTrainerBuildRequest { trainer_id: None, content_pack_id: "ptu-core-1.05".to_string(), base_revision: Some(preview.base_revision.clone()), intent: intent_value.clone(), manual_adjudications: vec![] };
    let stale_result = preview_build(&definitions, &profiles, &ruleset, &revision_after_disable, &stale_preview_request);
    println!("{}", serde_json::to_string_pretty(&stale_result.unwrap_err()).unwrap());
    // Re-enable so the LEGACY example below still resolves edges:acrobat@core normally.
    ptu_domain::content::authoring::reactivate_definition(&definitions, ContentKind::Edge, "edges:acrobat@core").unwrap();
    let revision = get_content_context(&definitions, &ruleset, &rulesets_dir, &packs_dir).unwrap().revision;

    println!("\n=== 5. commit_trainer_build — LEGACY reconciliation (pre-existing GM grant/Pokémon/roster/inventory/legacy edge all survive untouched) ===");
    let legacy = ptu_domain::profile::model::TrainerProfile {
        id: "legacy-example-1".to_string(),
        name: "Old Save".to_string(),
        level: 1,
        exp: 0,
        money: 250,
        gm_grants: vec![json!({"id": "grant-1", "kind": "fixed", "target": "trainer.stat.hp", "operation": "add", "value": 2})],
        edges: vec![json!({"definition_version_id": "edges:acrobat@core", "source": "legacy"})],
        pokemon: vec![ptu_domain::profile::model::PokemonInstance {
            id: "pkm-1".to_string(),
            species_definition_id: "sableye".to_string(),
            storage_state: ptu_domain::profile::model::StorageState::Carried,
            level: 5,
            ..Default::default()
        }],
        rosters: vec![ptu_domain::profile::model::RosterRecord { id: "r1".to_string(), name: "Team".to_string(), active: true, max_members: None, rules: serde_json::Value::Null }],
        inventory: ptu_domain::profile::model::InventoryRecord {
            backpack: vec![ptu_domain::profile::model::ItemStack { item_id: "potion".to_string(), quantity: 2 }],
            storage: vec![],
            equipped: Default::default(),
        },
        ..Default::default()
    };
    ptu_domain::profile::repository::save_trainer_profile(&mut profiles, &legacy).unwrap();
    println!("--- legacy TrainerProfile BEFORE reconciliation ---");
    println!("{}", serde_json::to_string_pretty(&legacy).unwrap());

    let legacy_preview_request = PreviewTrainerBuildRequest { trainer_id: Some("legacy-example-1".to_string()), content_pack_id: "ptu-core-1.05".to_string(), base_revision: None, intent: intent_value.clone(), manual_adjudications: vec![] };
    let legacy_preview = preview_build(&definitions, &profiles, &ruleset, &revision, &legacy_preview_request).unwrap();
    let legacy_commit_request = CommitTrainerBuildRequest {
        trainer_id: Some("legacy-example-1".to_string()),
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value,
        expected_base_revision: legacy_preview.base_revision,
        manual_adjudications: vec![json!({"code": "prerequisite_not_met", "field": "acquisitions[7]"})],
        confirm: true,
        operation_id: uuid::Uuid::new_v4().to_string(),
    };
    commit_build(&definitions, &mut profiles, &ruleset, &revision, &legacy_commit_request).unwrap();
    let reconciled = load_trainer_profile(&profiles, "legacy-example-1").unwrap().unwrap();
    println!("--- legacy TrainerProfile AFTER reconciliation (money/gm_grants/pokemon/rosters/inventory/legacy edge unchanged; skills/background-sourced edges+features/stat_allocation/build_state updated) ---");
    println!("{}", serde_json::to_string_pretty(&reconciled).unwrap());

    println!("\n=== 6. commit_trainer_build — SUCCESS with T13D3-R1B automatic Feature stat tags (Athlete + Training Regime, Core p14-16's own worked example: 13 -> 15 HP -> 57 Max HP at L1) ===");
    let tag_intent = TrainerBuildCreationIntent {
        name: "Lisa".to_string(),
        background: BackgroundIntent {
            name: "Rookie".to_string(),
            story: None,
            adept_skill: "acrobatics".to_string(),
            novice_skill: "command".to_string(),
            pathetic_skills: vec!["stealth".to_string(), "intimidate".to_string(), "survival".to_string()],
        },
        acquisitions: vec![
            acq("edge", "edges:basic-skills@core", json!({"skill": "perception"})),
            acq("feature", "features:chronicler@core", serde_json::Value::Null),
            acq("edge", "edges:basic-skills@core", json!({"skill": "athletics"})),
            acq("feature", "features:athlete@core", serde_json::Value::Null),
            acq("edge", "edges:basic-skills@core", json!({"skill": "guile"})),
            acq("feature", "features:training-regime@core", serde_json::Value::Null),
            acq("edge", "edges:acrobat@core", serde_json::Value::Null),
            acq("feature", "features:let-me-help-you-with-that@core", serde_json::Value::Null),
            free_training("features:brutal-training@core"),
        ],
        stat_desired_points: vec![StatAllocationDraftEntry { stat: TrainerCombatStat::Hp, points: 3 }],
        weight_lb: Some(150),
        elemental_connection_mode: None,
    };
    let tag_intent_value = serde_json::to_value(&tag_intent).unwrap();
    let tag_preview_request = PreviewTrainerBuildRequest { trainer_id: None, content_pack_id: "ptu-core-1.05".to_string(), base_revision: None, intent: tag_intent_value.clone(), manual_adjudications: vec![] };
    let tag_preview = preview_build(&definitions, &profiles, &ruleset, &revision, &tag_preview_request).unwrap();
    println!("resolution.feature_tag_modifiers: {}", serde_json::to_string_pretty(&tag_preview.resolution.feature_tag_modifiers).unwrap());
    let tag_commit_request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: tag_intent_value,
        expected_base_revision: tag_preview.base_revision,
        // Two REAL, pre-existing seed data-quality issues unrelated to
        // R1B (Athlete's own prerequisite AST mis-parses "Novice
        // Athletics, One of [...]" as an all/AND instead of any/OR;
        // Training Regime's "Athlete" prerequisite leaf is mislabeled
        // ambiguous_entity instead of has_feature) — both adjudicated
        // explicitly here exactly like the accepted `hex-maniac` case
        // above, never silently patched.
        manual_adjudications: vec![
            json!({"code": "prerequisite_not_met", "field": "acquisitions[3]", "note": "GM confirmed: Athlete's prerequisite AST is mis-parsed in the seed; Novice Athletics alone is satisfied."}),
            json!({"code": "manual_review_required", "field": "acquisitions[5]", "note": "GM confirmed Athlete was legally acquired first; the seed mislabels this leaf."}),
        ],
        confirm: true,
        operation_id: uuid::Uuid::new_v4().to_string(),
    };
    let tag_commit = commit_build(&definitions, &mut profiles, &ruleset, &revision, &tag_commit_request).unwrap();
    println!("HP: {} (expected 15.0 = 10 floor + 3 allocated + 2 tags)", tag_commit.core_result.combat_stats.hp.final_value);
    println!("Max HP: {} (expected 57.0 = level*2 + HP*3 + 10 = 1*2 + 15*3 + 10)", tag_commit.core_result.max_hp.final_value);
    println!("{}", serde_json::to_string_pretty(&tag_commit.core_result.combat_stats.hp).unwrap());

    let _ = std::fs::remove_dir_all(&dir);
}
