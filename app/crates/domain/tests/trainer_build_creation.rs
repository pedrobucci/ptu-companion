//! T13D3 integration tests: level-1 Trainer creation (Core pp12-18) against
//! the REAL shipped `ptu-core-1.05.ptucp` pack and isolated SQLite —
//! `preview_trainer_build`/`commit_trainer_build`'s actual implementation,
//! not a mock. Every definition_version_id used below is real Core content
//! (verified present in the shipped pack before writing these tests).

use std::path::{Path, PathBuf};

use ptu_domain::content::authoring::soft_delete_definition;
use ptu_domain::content::context::get_content_context;
use ptu_domain::content::import::import_pack_file;
use ptu_domain::content::ruleset::{load_preset, CampaignRuleset};
use ptu_domain::content::ContentKind;
use ptu_domain::engine::trainer_build::{
    commit_build, commit_trainer_advancement, preview_build, resolve_creation, AcquisitionIntent, BackgroundIntent, CommitTrainerAdvancementRequest, CommitTrainerBuildRequest,
    PreviewTrainerBuildRequest, TrainerBuildCreationIntent, TrainerBuildError,
};
use ptu_domain::engine::trainer_core::StatAllocationDraftEntry;
use ptu_domain::persistence::definitions::open_and_migrate_definitions;
use ptu_domain::persistence::profiles::open_and_migrate_profiles;
use ptu_domain::profile::model::{TrainerCombatStat, TrainerProfile};
use ptu_domain::profile::repository::{load_trainer_profile, new_id, save_trainer_profile};
use rusqlite::Connection;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

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
    let dir = std::env::temp_dir().join(format!("ptu-trainer-build-creation-{name}-{}", uuid::Uuid::new_v4()));
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

/// The real `base_revision` a brand-new (no `trainer_id`) creation candidate
/// must present at commit time — obtained the same way a real caller would,
/// via `preview_build`, never guessed or substituted with the raw E02
/// content revision (a different, related-but-distinct value).
fn fresh_base_revision(definitions: &Connection, profiles: &Connection, ruleset: &CampaignRuleset, e02_revision: &str, intent_value: &Value) -> String {
    let preview_request = PreviewTrainerBuildRequest { trainer_id: None, content_pack_id: "ptu-core-1.05".to_string(), base_revision: None, intent: intent_value.clone(), manual_adjudications: vec![] };
    preview_build(definitions, profiles, ruleset, e02_revision, &preview_request).unwrap().base_revision
}

/// A fresh, client-generated operation identity for one new intended
/// commit mutation — T13D3-R1A requires this on every
/// `CommitTrainerBuildRequest`. A test exercising an actual RETRY reuses
/// the same request (or spreads `..request`) rather than calling this
/// again, so the id is reused verbatim exactly like a real client retry.
fn op_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn acq(kind: &str, dvi: &str, parameters: Value) -> AcquisitionIntent {
    AcquisitionIntent { kind: kind.to_string(), definition_version_id: dvi.to_string(), parameters, is_free_training_feature: false }
}
fn free_training(dvi: &str) -> AcquisitionIntent {
    AcquisitionIntent { kind: "feature".to_string(), definition_version_id: dvi.to_string(), parameters: Value::Null, is_free_training_feature: true }
}

fn valid_background() -> BackgroundIntent {
    BackgroundIntent {
        name: "Rookie".to_string(),
        story: Some("Grew up chasing Pokémon in the hills.".to_string()),
        adept_skill: "acrobatics".to_string(),
        novice_skill: "command".to_string(),
        pathetic_skills: vec!["stealth".to_string(), "intimidate".to_string(), "survival".to_string()],
    }
}

/// The full, deliberately non-trivial ordered acquisition list this test
/// module's "happy path" (with one intentional override) exercises — see
/// the module doc comment for why each entry was chosen. Interleaves
/// Edges/Features exactly as Core p18 permits, and is order-DEPENDENT:
/// `chronicler` (Novice Perception) is only satisfiable because the
/// `basic-skills` pick raising Perception comes before it.
fn full_valid_acquisitions() -> Vec<AcquisitionIntent> {
    vec![
        acq("edge", "edges:basic-skills@core", json!({"skill": "perception"})),
        acq("feature", "features:chronicler@core", Value::Null),
        acq("edge", "edges:basic-skills@core", json!({"skill": "guile"})),
        acq("feature", "features:ace-trainer@core", Value::Null),
        acq("edge", "edges:acrobat@core", Value::Null),
        acq("feature", "features:commander@core", Value::Null),
        acq("edge", "edges:categoric-inclination@core", json!({"category": "spirit"})),
        acq("feature", "features:hex-maniac@core", Value::Null), // deliberately unmet (Novice Occult Education) — overridden at commit
        free_training("features:brutal-training@core"),
    ]
}

fn full_valid_intent() -> TrainerBuildCreationIntent {
    TrainerBuildCreationIntent {
        name: "Ash".to_string(),
        background: valid_background(),
        acquisitions: full_valid_acquisitions(),
        stat_desired_points: vec![
            StatAllocationDraftEntry { stat: TrainerCombatStat::Hp, points: 2 },
            StatAllocationDraftEntry { stat: TrainerCombatStat::Attack, points: 3 },
            StatAllocationDraftEntry { stat: TrainerCombatStat::Speed, points: 5 },
        ],
        weight_lb: Some(150),
        elemental_connection_mode: None,
    }
}

// =======================================================================
// Background (Core p13/18/33-34)
// =======================================================================

#[test]
fn background_resolves_correct_skill_map_including_all_17_and_locked_pathetic() {
    let (dir, definitions, _profiles, ruleset) = setup();
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();
    let intent = TrainerBuildCreationIntent { acquisitions: vec![], ..full_valid_intent() };
    let resolution = resolve_creation(&definitions, &ruleset, &rules, &intent, &[]);

    assert_eq!(resolution.skills["acrobatics"]["base_rank"], "adept");
    assert_eq!(resolution.skills["command"]["base_rank"], "novice");
    for p in ["stealth", "intimidate", "survival"] {
        assert_eq!(resolution.skills[p]["base_rank"], "pathetic", "{p} must be pathetic");
    }
    for other in ["combat", "athletics", "guile", "perception", "focus", "charm", "intuition", "general-education", "medicine-education", "occult-education", "pokemon-education", "technology-education"] {
        assert_eq!(resolution.skills[other]["base_rank"], "untrained", "{other} must default to untrained");
    }
    assert_eq!(resolution.skills.as_object().unwrap().len(), 17, "all 17 Core skills must be present");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn background_rejects_wrong_pathetic_count_and_non_distinct_and_unknown_skill() {
    let (dir, definitions, _profiles, ruleset) = setup();
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();

    let too_few = TrainerBuildCreationIntent {
        background: BackgroundIntent { pathetic_skills: vec!["stealth".to_string(), "intimidate".to_string()], ..valid_background() },
        acquisitions: vec![],
        ..full_valid_intent()
    };
    let r = resolve_creation(&definitions, &ruleset, &rules, &too_few, &[]);
    assert!(r.issues.iter().any(|i| i.issue.code == "background_pathetic_count_invalid"));

    let not_distinct = TrainerBuildCreationIntent {
        background: BackgroundIntent { novice_skill: "acrobatics".to_string(), ..valid_background() }, // same as adept_skill
        acquisitions: vec![],
        ..full_valid_intent()
    };
    let r = resolve_creation(&definitions, &ruleset, &rules, &not_distinct, &[]);
    assert!(r.issues.iter().any(|i| i.issue.code == "background_skills_not_distinct"));

    let unknown = TrainerBuildCreationIntent {
        background: BackgroundIntent { adept_skill: "not-a-real-skill".to_string(), ..valid_background() },
        acquisitions: vec![],
        ..full_valid_intent()
    };
    let r = resolve_creation(&definitions, &ruleset, &rules, &unknown, &[]);
    assert!(r.issues.iter().any(|i| i.issue.code == "background_unknown_skill"));

    let _ = std::fs::remove_dir_all(&dir);
}

// =======================================================================
// Skill Edges (Core p52)
// =======================================================================

#[test]
fn basic_skills_only_allows_pathetic_to_untrained_or_untrained_to_novice() {
    let (dir, definitions, _profiles, ruleset) = setup();
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();

    // Legal: guile (untrained) -> novice.
    let legal = TrainerBuildCreationIntent { acquisitions: vec![acq("edge", "edges:basic-skills@core", json!({"skill": "guile"}))], ..full_valid_intent() };
    let r = resolve_creation(&definitions, &ruleset, &rules, &legal, &[]);
    assert_eq!(r.skills["guile"]["base_rank"], "novice");
    // Only budget-incompleteness issues are expected here (this intent
    // deliberately has just the one Edge, not the full 4+4+1 spread) — the
    // Basic Skills pick itself must not add any error.
    assert!(!r.issues.iter().any(|i| i.issue.severity == ptu_domain::engine::validation::Severity::Error && i.issue.code != "free_training_feature_required" && i.issue.code != "edges_incomplete" && i.issue.code != "features_incomplete"));

    // Illegal: acrobatics is already Adept (from Background) — Basic
    // Skills cannot touch Adept+ skills at all (Core p52's exact two
    // named transitions).
    let illegal = TrainerBuildCreationIntent { acquisitions: vec![acq("edge", "edges:basic-skills@core", json!({"skill": "acrobatics"}))], ..full_valid_intent() };
    let r = resolve_creation(&definitions, &ruleset, &rules, &illegal, &[]);
    assert!(r.issues.iter().any(|i| i.issue.code == "basic_skills_illegal_step"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn basic_skills_cannot_raise_a_background_locked_pathetic_skill() {
    let (dir, definitions, _profiles, ruleset) = setup();
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();
    let intent = TrainerBuildCreationIntent { acquisitions: vec![acq("edge", "edges:basic-skills@core", json!({"skill": "stealth"}))], ..full_valid_intent() };
    let r = resolve_creation(&definitions, &ruleset, &rules, &intent, &[]);
    assert!(r.issues.iter().any(|i| i.issue.code == "background_locked_skill"), "Core p18: may not use Edges to Rank Up a skill lowered to Pathetic");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn adept_expert_master_skills_are_always_illegal_at_level_1_creation() {
    let (dir, definitions, _profiles, ruleset) = setup();
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();
    for dvi in ["edges:adept-skills@core", "edges:expert-skills@core", "edges:master-skills@core"] {
        let intent = TrainerBuildCreationIntent { acquisitions: vec![acq("edge", dvi, json!({"skill": "command"}))], ..full_valid_intent() };
        let r = resolve_creation(&definitions, &ruleset, &rules, &intent, &[]);
        assert!(r.issues.iter().any(|i| i.issue.code == "skill_edge_level_unmet"), "{dvi} must be rejected at creation (Core p18/34: Level 2/6/12 required)");
    }
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn skill_enhancement_grants_check_bonus_once_per_skill_across_acquisitions() {
    let (dir, definitions, _profiles, ruleset) = setup();
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();
    let intent = TrainerBuildCreationIntent {
        acquisitions: vec![
            acq("edge", "edges:skill-enhancement@core", json!({"skills": ["guile", "perception"]})),
            acq("edge", "edges:skill-enhancement@core", json!({"skills": ["guile", "focus"]})), // guile repeats -> rejected for guile, focus still gets it
        ],
        ..full_valid_intent()
    };
    let r = resolve_creation(&definitions, &ruleset, &rules, &intent, &[]);
    assert_eq!(r.check_bonuses.get("guile"), Some(&2));
    assert_eq!(r.check_bonuses.get("perception"), Some(&2));
    assert_eq!(r.check_bonuses.get("focus"), Some(&2));
    assert!(r.issues.iter().any(|i| i.issue.code == "skill_enhancement_repeat"));
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn categoric_inclination_is_not_repeatable() {
    let (dir, definitions, _profiles, ruleset) = setup();
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();
    let intent = TrainerBuildCreationIntent {
        acquisitions: vec![
            acq("edge", "edges:categoric-inclination@core", json!({"category": "body"})),
            acq("edge", "edges:categoric-inclination@core", json!({"category": "mind"})),
        ],
        ..full_valid_intent()
    };
    let r = resolve_creation(&definitions, &ruleset, &rules, &intent, &[]);
    assert!(r.issues.iter().any(|i| i.issue.code == "categoric_inclination_not_repeatable"));
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn skill_stunt_requires_novice_and_rejects_the_exact_same_circumstance_twice() {
    let (dir, definitions, _profiles, ruleset) = setup();
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();

    let rank_unmet = TrainerBuildCreationIntent { acquisitions: vec![acq("edge", "edges:skill-stunt@core", json!({"skill": "stealth", "circumstance": "spot traps"}))], ..full_valid_intent() };
    let r = resolve_creation(&definitions, &ruleset, &rules, &rank_unmet, &[]);
    assert!(r.issues.iter().any(|i| i.issue.code == "skill_stunt_rank_unmet"), "stealth is Pathetic here, below Novice");

    let repeat = TrainerBuildCreationIntent {
        acquisitions: vec![
            acq("edge", "edges:skill-stunt@core", json!({"skill": "command", "circumstance": "rally a crowd"})),
            acq("edge", "edges:skill-stunt@core", json!({"skill": "command", "circumstance": "rally a crowd"})),
        ],
        ..full_valid_intent()
    };
    let r = resolve_creation(&definitions, &ruleset, &rules, &repeat, &[]);
    assert!(r.issues.iter().any(|i| i.issue.code == "skill_stunt_repeat"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn virtuoso_is_always_illegal_at_level_1_creation() {
    let (dir, definitions, _profiles, ruleset) = setup();
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();
    let intent = TrainerBuildCreationIntent { acquisitions: vec![acq("edge", "edges:virtuoso@core", json!({"skill": "command"}))], ..full_valid_intent() };
    let r = resolve_creation(&definitions, &ruleset, &rules, &intent, &[]);
    assert!(r.issues.iter().any(|i| i.issue.code == "virtuoso_level_unmet"), "Core p52: Virtuoso requires Level 20");
    let _ = std::fs::remove_dir_all(&dir);
}

// =======================================================================
// Elemental Connection (Core p19/56) + Mystic Senses + Basic Psionics
// =======================================================================

#[test]
fn elemental_connection_core_mode_rejects_a_second_acquisition() {
    let (dir, definitions, _profiles, ruleset) = setup();
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();
    let intent = TrainerBuildCreationIntent {
        acquisitions: vec![
            acq("edge", "edges:elemental-connection@core", json!({"type": "Fire"})),
            acq("edge", "edges:elemental-connection@core", json!({"type": "Water"})),
        ],
        elemental_connection_mode: Some("core".to_string()),
        ..full_valid_intent()
    };
    let r = resolve_creation(&definitions, &ruleset, &rules, &intent, &[]);
    assert!(r.issues.iter().any(|i| i.issue.code == "elemental_connection_core_no_repeat"));
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn elemental_connection_variant_mode_allows_distinct_types_rejects_duplicate() {
    let (dir, definitions, _profiles, ruleset) = setup();
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();
    let ok = TrainerBuildCreationIntent {
        acquisitions: vec![
            acq("edge", "edges:elemental-connection@core", json!({"type": "Fire"})),
            acq("edge", "edges:elemental-connection@core", json!({"type": "Water"})),
        ],
        elemental_connection_mode: Some("campaign_variant_distinct_type".to_string()),
        ..full_valid_intent()
    };
    let r = resolve_creation(&definitions, &ruleset, &rules, &ok, &[]);
    assert!(!r.issues.iter().any(|i| i.issue.code.starts_with("elemental_connection")), "distinct types under the variant must be legal: {:?}", r.issues);
    assert_eq!(r.elemental_connection_mode.as_deref(), Some("campaign_variant_distinct_type"));

    let dup = TrainerBuildCreationIntent {
        acquisitions: vec![
            acq("edge", "edges:elemental-connection@core", json!({"type": "Fire"})),
            acq("edge", "edges:elemental-connection@core", json!({"type": "Fire"})),
        ],
        elemental_connection_mode: Some("campaign_variant_distinct_type".to_string()),
        ..full_valid_intent()
    };
    let r = resolve_creation(&definitions, &ruleset, &rules, &dup, &[]);
    assert!(r.issues.iter().any(|i| i.issue.code == "elemental_connection_variant_duplicate_type"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn elemental_connection_and_mystic_senses_are_mutually_exclusive_both_orders() {
    let (dir, definitions, _profiles, ruleset) = setup();
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();

    let elemental_first = TrainerBuildCreationIntent {
        acquisitions: vec![acq("edge", "edges:elemental-connection@core", json!({"type": "Fire"})), acq("edge", "edges:mystic-senses@core", Value::Null)],
        elemental_connection_mode: Some("core".to_string()),
        ..full_valid_intent()
    };
    let r = resolve_creation(&definitions, &ruleset, &rules, &elemental_first, &[]);
    assert!(r.issues.iter().any(|i| i.issue.code == "elemental_connection_mystic_senses_exclusive"));

    let mystic_first = TrainerBuildCreationIntent {
        acquisitions: vec![acq("edge", "edges:mystic-senses@core", Value::Null), acq("edge", "edges:elemental-connection@core", json!({"type": "Fire"}))],
        elemental_connection_mode: Some("core".to_string()),
        ..full_valid_intent()
    };
    let r = resolve_creation(&definitions, &ruleset, &rules, &mystic_first, &[]);
    assert!(r.issues.iter().any(|i| i.issue.code == "elemental_connection_mystic_senses_exclusive"), "exclusion must hold regardless of acquisition order");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn basic_psionics_requires_the_psychic_typed_elemental_connection_specifically() {
    let (dir, definitions, _profiles, ruleset) = setup();
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();

    let wrong_type = TrainerBuildCreationIntent {
        acquisitions: vec![acq("edge", "edges:elemental-connection@core", json!({"type": "Fire"})), acq("edge", "edges:basic-psionics@core", Value::Null)],
        elemental_connection_mode: Some("core".to_string()),
        ..full_valid_intent()
    };
    let r = resolve_creation(&definitions, &ruleset, &rules, &wrong_type, &[]);
    assert!(r.issues.iter().any(|i| i.issue.code == "prerequisite_not_met"), "Basic Psionics must reject a non-Psychic Elemental Connection");

    let right_type = TrainerBuildCreationIntent {
        acquisitions: vec![acq("edge", "edges:elemental-connection@core", json!({"type": "Psychic"})), acq("edge", "edges:basic-psionics@core", Value::Null)],
        elemental_connection_mode: Some("core".to_string()),
        ..full_valid_intent()
    };
    let r = resolve_creation(&definitions, &ruleset, &rules, &right_type, &[]);
    assert!(!r.issues.iter().any(|i| i.issue.code == "prerequisite_not_met"), "Basic Psionics must accept the Psychic-typed Elemental Connection: {:?}", r.issues);

    let _ = std::fs::remove_dir_all(&dir);
}

// =======================================================================
// Budgets (Core p18)
// =======================================================================

#[test]
fn budget_is_exactly_4_paid_edges_4_paid_features_and_1_free_training_feature() {
    let (dir, definitions, _profiles, ruleset) = setup();
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();

    let intent = full_valid_intent();
    let r = resolve_creation(&definitions, &ruleset, &rules, &intent, &[]);
    assert_eq!(r.paid_edges_used, 4);
    assert_eq!(r.paid_features_used, 4);
    assert!(r.free_training_feature_used);
    assert!(!r.issues.iter().any(|i| i.issue.code == "edge_budget_exceeded" || i.issue.code == "feature_budget_exceeded" || i.issue.code == "free_training_feature_required"));

    // A 5th Edge is rejected.
    let mut too_many = intent.clone();
    too_many.acquisitions.push(acq("edge", "edges:basic-skills@core", json!({"skill": "combat"})));
    let r = resolve_creation(&definitions, &ruleset, &rules, &too_many, &[]);
    assert!(r.issues.iter().any(|i| i.issue.code == "edge_budget_exceeded"));

    // Missing the free Training Feature is flagged.
    let mut missing_free = intent.clone();
    missing_free.acquisitions.retain(|a| !a.is_free_training_feature);
    let r = resolve_creation(&definitions, &ruleset, &rules, &missing_free, &[]);
    assert!(r.issues.iter().any(|i| i.issue.code == "free_training_feature_required"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn free_training_feature_waives_prerequisites_even_against_a_locked_skill() {
    let (dir, definitions, _profiles, ruleset) = setup();
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();
    // Brutal Training needs "Novice Intimidate, Untrained Command" —
    // Intimidate is one of THIS intent's Pathetic (locked) skills, so this
    // would fail hard as a PAID pick; as the free pick it must not.
    let intent = TrainerBuildCreationIntent { acquisitions: vec![free_training("features:brutal-training@core")], ..full_valid_intent() };
    let r = resolve_creation(&definitions, &ruleset, &rules, &intent, &[]);
    assert!(!r.issues.iter().any(|i| i.issue.code == "prerequisite_not_met"), "the free Training Feature slot must waive prerequisites: {:?}", r.issues);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn free_training_feature_must_be_one_of_the_four_named_options() {
    let (dir, definitions, _profiles, ruleset) = setup();
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();
    let intent = TrainerBuildCreationIntent { acquisitions: vec![free_training("features:ace-trainer@core")], ..full_valid_intent() };
    let r = resolve_creation(&definitions, &ruleset, &rules, &intent, &[]);
    assert!(r.issues.iter().any(|i| i.issue.code == "free_training_feature_invalid_choice"));
    let _ = std::fs::remove_dir_all(&dir);
}

// =======================================================================
// T13D3-R1C: the publication gate — a required manual prerequisite,
// a non-overridable Error, and budget incompleteness must all actually
// block `commit_build`, never just `preview_build`'s reporting.
// =======================================================================

/// `features:calculated-assault@core` has a real, shipped
/// `prerequisite_semantics.ast` of `{"kind":"manual","raw":"Smart Scheme
/// Rank 1"}` — not one of the auto-evaluated leaf kinds, so it resolves to
/// `PrereqEval::ManualReview`, i.e. a real "unsupported source, needs a
/// human" case, not a hand-typed placeholder.
fn intent_with_manual_review_feature() -> TrainerBuildCreationIntent {
    TrainerBuildCreationIntent {
        name: "Ash".to_string(),
        background: valid_background(),
        acquisitions: vec![
            acq("edge", "edges:basic-skills@core", json!({"skill": "perception"})),
            acq("feature", "features:chronicler@core", Value::Null),
            acq("edge", "edges:basic-skills@core", json!({"skill": "guile"})),
            acq("feature", "features:ace-trainer@core", Value::Null),
            acq("edge", "edges:acrobat@core", Value::Null),
            acq("feature", "features:commander@core", Value::Null),
            acq("edge", "edges:categoric-inclination@core", json!({"category": "spirit"})),
            acq("feature", "features:calculated-assault@core", Value::Null),
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

#[test]
fn a_required_manual_prerequisite_blocks_publish_without_adjudication_and_succeeds_when_adjudicated() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();
    let intent = intent_with_manual_review_feature();

    // Preview reports it (Warning-turned-Error is still just reporting —
    // preview never rejects on issues) but the ONE issue must be exactly
    // this manual-review case, not something else.
    let resolution = resolve_creation(&definitions, &ruleset, &rules, &intent, &[]);
    let blocking: Vec<_> = resolution.issues.iter().filter(|i| i.issue.severity == ptu_domain::engine::validation::Severity::Error).collect();
    assert_eq!(blocking.len(), 1, "{:?}", blocking);
    assert_eq!(blocking[0].issue.code, "manual_review_required");
    assert!(blocking[0].issue.override_allowed);

    let intent_value = serde_json::to_value(&intent).unwrap();
    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &intent_value);

    // No adjudication -> commit rejects with exactly that issue, no Trainer/receipt/partial write.
    let unadjudicated = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value.clone(),
        expected_base_revision: base_revision.clone(),
        manual_adjudications: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    let result = commit_build(&definitions, &mut profiles, &ruleset, &revision, &unadjudicated);
    match result {
        Err(TrainerBuildError::ValidationFailed { issues }) => {
            assert_eq!(issues.len(), 1);
            assert_eq!(issues[0].issue.code, "manual_review_required");
        }
        other => panic!("expected ValidationFailed, got {other:?}"),
    }
    let count: i64 = profiles.query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0)).unwrap();
    assert_eq!(count, 0, "an unadjudicated required manual prerequisite must not publish a Trainer");

    // Explicit, attributed adjudication -> succeeds, with the issue still
    // present in the returned resolution (traceable, not erased). Reuses
    // the SAME operation_id as the rejected attempt above — proving
    // (T13D3-R1A+R1C together) that the earlier invalid publish never
    // consumed the operation identity: this is a fresh, first-time write
    // for that operation_id, not a replay.
    let adjudicated = CommitTrainerBuildRequest {
        manual_adjudications: vec![json!({"code": "manual_review_required", "field": "acquisitions[7]", "note": "GM reviewed Smart Scheme Rank 1 manually and approves."})],
        ..unadjudicated
    };
    let commit = commit_build(&definitions, &mut profiles, &ruleset, &revision, &adjudicated).unwrap();
    assert!(commit.resolution.issues.iter().any(|i| i.issue.code == "manual_review_required"), "adjudication overrides the BLOCK, not the record of the issue");
    let receipt = ptu_domain::profile::repository::load_build_operation(&profiles, &adjudicated.operation_id).unwrap().expect("the successful commit must have recorded a receipt");
    assert_eq!(receipt.trainer_id, commit.trainer_id);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_supplied_adjudication_cannot_bypass_a_disabled_definition_even_with_matching_code() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    soft_delete_definition(&definitions, ContentKind::Feature, "features:ace-trainer@core").unwrap();

    let intent = full_valid_intent(); // features:ace-trainer@core is acquisitions[3]
    let intent_value = serde_json::to_value(&intent).unwrap();
    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &intent_value);

    for adjudications in [
        vec![json!({"code": "acquisition_definition_disabled", "field": "acquisitions[3]"})],
        vec![json!({"code": "acquisition_definition_disabled"})], // omitted field: a wildcard for code, still must not bypass a non-overridable issue
    ] {
        let request = CommitTrainerBuildRequest {
            trainer_id: None,
            content_pack_id: "ptu-core-1.05".to_string(),
            draft_id: None,
            intent: intent_value.clone(),
            expected_base_revision: base_revision.clone(),
            manual_adjudications: adjudications.clone(),
            confirm: true,
            operation_id: op_id(),
        };
        let result = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request);
        match result {
            Err(TrainerBuildError::ValidationFailed { issues }) => {
                assert!(issues.iter().any(|i| i.issue.code == "acquisition_definition_disabled"), "adjudications={adjudications:?} issues={issues:?}");
            }
            other => panic!("a disabled definition must never publish, even with a matching adjudication (adjudications={adjudications:?}): {other:?}"),
        }
    }
    let count: i64 = profiles.query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0)).unwrap();
    assert_eq!(count, 0);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_supplied_adjudication_cannot_bypass_the_missing_free_training_feature_slot() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let mut intent = full_valid_intent();
    intent.acquisitions.retain(|a| !a.is_free_training_feature);
    let intent_value = serde_json::to_value(&intent).unwrap();
    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &intent_value);

    let request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value,
        expected_base_revision: base_revision,
        manual_adjudications: vec![json!({"code": "free_training_feature_required"})],
        confirm: true,
        operation_id: op_id(),
    };
    let result = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request);
    match result {
        Err(TrainerBuildError::ValidationFailed { issues }) => {
            assert!(issues.iter().any(|i| i.issue.code == "free_training_feature_required"));
        }
        other => panic!("expected ValidationFailed, got {other:?}"),
    }

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn fewer_than_4_paid_edges_rejects_publish_but_preview_and_draft_still_work() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    // Built explicitly (not derived from `full_valid_intent`) so this
    // isolates budget-incompleteness as the ONLY issue: 3 paid Edges, but
    // a full 4 valid paid Features (using `features:let-me-help-you-with-
    // that@core`, the one Core Feature with literally "Prerequisites:
    // None", as the 4th in place of `full_valid_intent`'s deliberately-
    // unmet `hex-maniac`) + the free Training Feature slot.
    let intent = TrainerBuildCreationIntent {
        acquisitions: vec![
            acq("edge", "edges:basic-skills@core", json!({"skill": "perception"})),
            acq("feature", "features:chronicler@core", Value::Null),
            acq("edge", "edges:basic-skills@core", json!({"skill": "guile"})),
            acq("feature", "features:ace-trainer@core", Value::Null),
            acq("edge", "edges:acrobat@core", Value::Null),
            acq("feature", "features:commander@core", Value::Null),
            acq("feature", "features:let-me-help-you-with-that@core", Value::Null),
            free_training("features:brutal-training@core"),
        ],
        ..full_valid_intent()
    };

    let intent_value = serde_json::to_value(&intent).unwrap();

    // Preview must still succeed (never rejects on issues).
    let preview_request = PreviewTrainerBuildRequest { trainer_id: None, content_pack_id: "ptu-core-1.05".to_string(), base_revision: None, intent: intent_value.clone(), manual_adjudications: vec![] };
    let preview = preview_build(&definitions, &profiles, &ruleset, &revision, &preview_request).unwrap();
    assert!(preview.resolution.issues.iter().any(|i| i.issue.code == "edges_incomplete"));
    assert_eq!(preview.resolution.paid_edges_used, 3);

    // Draft save still works for an incomplete intent.
    let draft_id = ptu_domain::profile::repository::save_trainer_build_draft(&profiles, None, None, &intent_value).unwrap();
    assert!(ptu_domain::profile::repository::load_trainer_build_draft(&profiles, &draft_id).unwrap().is_some());

    // Commit rejects.
    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &intent_value);
    let request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value,
        expected_base_revision: base_revision,
        manual_adjudications: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    let result = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request);
    match result {
        Err(TrainerBuildError::ValidationFailed { issues }) => {
            assert!(issues.iter().any(|i| i.issue.code == "edges_incomplete"), "{issues:?}");
        }
        other => panic!("expected ValidationFailed for 3-of-4 paid Edges, got {other:?}"),
    }
    let count: i64 = profiles.query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0)).unwrap();
    assert_eq!(count, 0);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn fewer_than_4_paid_features_rejects_publish_but_preview_and_draft_still_work() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let mut intent = full_valid_intent();
    // Drop hex-maniac (the deliberately-unmet one) entirely rather than
    // replacing it — 3 paid Features, all 4 paid Edges + free slot intact,
    // no other pending issue.
    intent.acquisitions.retain(|a| a.definition_version_id != "features:hex-maniac@core");
    let intent_value = serde_json::to_value(&intent).unwrap();

    let preview_request = PreviewTrainerBuildRequest { trainer_id: None, content_pack_id: "ptu-core-1.05".to_string(), base_revision: None, intent: intent_value.clone(), manual_adjudications: vec![] };
    let preview = preview_build(&definitions, &profiles, &ruleset, &revision, &preview_request).unwrap();
    assert!(preview.resolution.issues.iter().any(|i| i.issue.code == "features_incomplete"));
    assert_eq!(preview.resolution.paid_features_used, 3);

    let draft_id = ptu_domain::profile::repository::save_trainer_build_draft(&profiles, None, None, &intent_value).unwrap();
    assert!(ptu_domain::profile::repository::load_trainer_build_draft(&profiles, &draft_id).unwrap().is_some());

    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &intent_value);
    let request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value,
        expected_base_revision: base_revision,
        manual_adjudications: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    let result = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request);
    match result {
        Err(TrainerBuildError::ValidationFailed { issues }) => {
            assert!(issues.iter().any(|i| i.issue.code == "features_incomplete"), "{issues:?}");
        }
        other => panic!("expected ValidationFailed for 3-of-4 paid Features, got {other:?}"),
    }
    let count: i64 = profiles.query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0)).unwrap();
    assert_eq!(count, 0);

    let _ = std::fs::remove_dir_all(&dir);
}

// =======================================================================
// Full preview/commit flow — real SQLite, real production functions.
// =======================================================================

#[test]
fn full_valid_creation_preview_then_commit_then_reopen() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);

    let mut intent = full_valid_intent();
    intent.acquisitions.iter_mut().find(|a| a.definition_version_id == "features:hex-maniac@core").unwrap();

    let preview_request = PreviewTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        base_revision: None,
        intent: serde_json::to_value(&intent).unwrap(),
        manual_adjudications: vec![],
    };
    let preview = preview_build(&definitions, &profiles, &ruleset, &revision, &preview_request).unwrap();
    assert_eq!(preview.resolution.paid_edges_used, 4);
    assert_eq!(preview.resolution.paid_features_used, 4);
    assert!(preview.resolution.free_training_feature_used);
    let blocking: Vec<_> = preview.resolution.issues.iter().filter(|i| i.issue.severity == ptu_domain::engine::validation::Severity::Error).collect();
    assert_eq!(blocking.len(), 1, "exactly the one deliberate hex-maniac unmet prerequisite: {:?}", blocking);
    assert_eq!(blocking[0].issue.code, "prerequisite_not_met");
    assert!(blocking[0].issue.override_allowed);

    let commit_request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: serde_json::to_value(&intent).unwrap(),
        expected_base_revision: preview.base_revision.clone(),
        manual_adjudications: vec![json!({"code": "prerequisite_not_met", "field": "acquisitions[7]", "note": "GM approved: campaign lets Occult apprentices learn Hex Maniac early."})],
        confirm: true,
        operation_id: op_id(),
    };
    let commit = commit_build(&definitions, &mut profiles, &ruleset, &revision, &commit_request).unwrap();
    let trainer_id = commit.trainer_id.clone();
    assert!(!trainer_id.is_empty());

    // Reopen from a fresh connection to prove durable persistence, not an
    // in-memory artifact of this one call.
    drop(profiles);
    let reopened = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
    let reloaded = load_trainer_profile(&reopened, &trainer_id).unwrap().unwrap();
    assert_eq!(reloaded.name, "Ash");
    assert_eq!(reloaded.skills["acrobatics"]["base_rank"], "adept");
    assert_eq!(reloaded.skills["command"]["base_rank"], "novice");
    assert_eq!(reloaded.edges.len(), 4);
    assert_eq!(reloaded.features.len(), 5); // 4 paid + 1 free
    assert!(reloaded.edges.iter().all(|e| e["acquisition_id"].as_str().map(|s| !s.is_empty()).unwrap_or(false)), "every acquisition must have a real, non-empty id");
    let build_state: Value = reloaded.build_state.clone().unwrap();
    assert_eq!(build_state["status"], "published");
    assert_eq!(build_state["campaign_setup_pending"], true, "steps 8-9 (starter/items) are GM decisions D3 never marks ready");
    assert_eq!(reloaded.stat_allocation.entries.iter().filter(|e| e.source == ptu_domain::profile::model::StatAllocationSource::Creation).map(|e| e.points).sum::<i64>(), 10);
    assert_eq!(reloaded.weight_lb, Some(150));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn commit_rejects_without_confirm_and_without_overriding_the_blocking_issue() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let intent = full_valid_intent();
    let intent_value = serde_json::to_value(&intent).unwrap();
    let preview_request = PreviewTrainerBuildRequest { trainer_id: None, content_pack_id: "ptu-core-1.05".to_string(), base_revision: None, intent: intent_value.clone(), manual_adjudications: vec![] };
    let preview_base_revision = preview_build(&definitions, &profiles, &ruleset, &revision, &preview_request).unwrap().base_revision;

    let base = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value.clone(),
        expected_base_revision: preview_base_revision,
        manual_adjudications: vec![],
        confirm: false,
        operation_id: op_id(),
    };
    let result = commit_build(&definitions, &mut profiles, &ruleset, &revision, &base);
    assert!(matches!(result, Err(TrainerBuildError::ConfirmationRequired { .. })));

    let no_override = CommitTrainerBuildRequest { confirm: true, ..base };
    let result = commit_build(&definitions, &mut profiles, &ruleset, &revision, &no_override);
    match result {
        Err(TrainerBuildError::ValidationFailed { issues }) => {
            assert_eq!(issues.len(), 1);
            assert_eq!(issues[0].issue.code, "prerequisite_not_met");
        }
        other => panic!("expected ValidationFailed with the unoverridden issue, got {other:?}"),
    }

    // Nothing was created by either rejected attempt.
    let count: i64 = profiles.query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0)).unwrap();
    assert_eq!(count, 0);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn stale_base_revision_is_rejected_on_preview_and_commit() {
    let (dir, definitions, profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let intent = full_valid_intent();

    let preview_request = PreviewTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        base_revision: Some("not-the-real-revision".to_string()),
        intent: serde_json::to_value(&intent).unwrap(),
        manual_adjudications: vec![],
    };
    let result = preview_build(&definitions, &profiles, &ruleset, &revision, &preview_request);
    assert!(matches!(result, Err(TrainerBuildError::StaleRevision { .. })));

    let mut profiles_mut = profiles;
    let commit_request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: serde_json::to_value(&intent).unwrap(),
        expected_base_revision: "not-the-real-revision".to_string(),
        manual_adjudications: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    let result = commit_build(&definitions, &mut profiles_mut, &ruleset, &revision, &commit_request);
    assert!(matches!(result, Err(TrainerBuildError::StaleRevision { .. })));

    let _ = std::fs::remove_dir_all(&dir);
}

// =======================================================================
// T13D3-R1A: durable operation identity. This is the confirmed BLOCKER
// fix from the independent BUILD/CONTRACT review — a `trainer_id: None`
// (brand-new creation) retry with an unchanged `expected_base_revision`
// (the common real case: nothing about content/rules changed between the
// two attempts) is NOT caught by staleness alone, since a fresh-creation
// candidate's base revision is a pure content/rules hash, identical
// across two back-to-back identical requests. `operation_id` is what
// actually gives "one Trainer on retry".
// =======================================================================

#[test]
fn a_repeated_commit_of_a_brand_new_creation_with_the_same_operation_id_returns_the_same_trainer() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let intent = full_valid_intent();
    let intent_value = serde_json::to_value(&intent).unwrap();
    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &intent_value);
    let shared_operation_id = op_id();

    let request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value,
        expected_base_revision: base_revision,
        manual_adjudications: vec![json!({"code": "prerequisite_not_met", "field": "acquisitions[7]"})],
        confirm: true,
        operation_id: shared_operation_id,
    };
    let first = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    let count_after_first: i64 = profiles.query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0)).unwrap();
    assert_eq!(count_after_first, 1);

    // The exact real-world retry scenario: same `operation_id`, same
    // payload, `trainer_id: None` on BOTH calls (the client never learned
    // the server-generated id from the first attempt — network retry,
    // double-submit before a button disables). Must return the SAME
    // Trainer, not create a second one.
    let retry = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    assert_eq!(retry.trainer_id, first.trainer_id, "a retried operation must return the SAME Trainer id, not a new one");
    assert_eq!(retry.base_revision, first.base_revision);

    let count_after_retry: i64 = profiles.query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0)).unwrap();
    assert_eq!(count_after_retry, 1, "a replayed operation must never create a second Trainer");
    let operation_count: i64 = profiles.query_row("SELECT COUNT(*) FROM trainer_build_operations", [], |r| r.get(0)).unwrap();
    assert_eq!(operation_count, 1, "a replay must not write a second receipt row either");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_repeated_commit_reusing_an_operation_id_with_a_different_payload_rejects_operation_conflict() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let intent = full_valid_intent();
    let intent_value = serde_json::to_value(&intent).unwrap();
    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &intent_value);
    let shared_operation_id = op_id();

    let request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value,
        expected_base_revision: base_revision,
        manual_adjudications: vec![json!({"code": "prerequisite_not_met", "field": "acquisitions[7]"})],
        confirm: true,
        operation_id: shared_operation_id,
    };
    let first = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();

    // Same operation_id, but a genuinely DIFFERENT intent (different
    // Trainer name) — a client bug or id collision, never a legitimate
    // retry of the same mutation.
    let mut different_intent = intent;
    different_intent.name = "Misty".to_string();
    let conflicting = CommitTrainerBuildRequest { intent: serde_json::to_value(&different_intent).unwrap(), ..request };
    let result = commit_build(&definitions, &mut profiles, &ruleset, &revision, &conflicting);
    assert!(matches!(result, Err(TrainerBuildError::OperationConflict { .. })), "{result:?}");

    // Nothing about the original successful commit is disturbed.
    let reloaded = load_trainer_profile(&profiles, &first.trainer_id).unwrap().unwrap();
    assert_eq!(reloaded.name, "Ash");
    let count: i64 = profiles.query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0)).unwrap();
    assert_eq!(count, 1, "a rejected conflicting reuse must not create a second Trainer");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_replay_still_works_after_reopening_the_profiles_database() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let intent = full_valid_intent();
    let intent_value = serde_json::to_value(&intent).unwrap();
    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &intent_value);
    let request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value,
        expected_base_revision: base_revision,
        manual_adjudications: vec![json!({"code": "prerequisite_not_met", "field": "acquisitions[7]"})],
        confirm: true,
        operation_id: op_id(),
    };
    let first = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    drop(profiles);

    let mut reopened = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
    let replay = commit_build(&definitions, &mut reopened, &ruleset, &revision, &request).unwrap();
    assert_eq!(replay.trainer_id, first.trainer_id);
    let count: i64 = reopened.query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0)).unwrap();
    assert_eq!(count, 1);

    let _ = std::fs::remove_dir_all(&dir);
}

/// Draft cleanup is explicitly OUTSIDE the atomic receipt/Trainer
/// transaction (best-effort, non-critical, never reapplies anything) —
/// this proves a replay behaves identically whether or not that cleanup
/// already ran, i.e. the draft's prior existence/absence is irrelevant to
/// operation identity.
#[test]
fn a_replay_behaves_identically_whether_or_not_draft_cleanup_already_ran() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let intent = full_valid_intent();
    let intent_value = serde_json::to_value(&intent).unwrap();
    let draft_id = ptu_domain::profile::repository::save_trainer_build_draft(&profiles, None, None, &intent_value).unwrap();
    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &intent_value);
    let request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: Some(draft_id.clone()),
        intent: intent_value,
        expected_base_revision: base_revision,
        manual_adjudications: vec![json!({"code": "prerequisite_not_met", "field": "acquisitions[7]"})],
        confirm: true,
        operation_id: op_id(),
    };
    let first = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    assert!(ptu_domain::profile::repository::load_trainer_build_draft(&profiles, &draft_id).unwrap().is_none(), "the draft must already be discarded after the first successful commit");

    let replay = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    assert_eq!(replay.trainer_id, first.trainer_id);
    let count: i64 = profiles.query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0)).unwrap();
    assert_eq!(count, 1);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn replaying_after_the_committed_target_was_deleted_rejects_committed_target_missing() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let intent = full_valid_intent();
    let intent_value = serde_json::to_value(&intent).unwrap();
    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &intent_value);
    let request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value,
        expected_base_revision: base_revision,
        manual_adjudications: vec![json!({"code": "prerequisite_not_met", "field": "acquisitions[7]"})],
        confirm: true,
        operation_id: op_id(),
    };
    let first = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();

    // Simulate the committed Trainer having been deleted by some other
    // means since the original commit (e.g. an explicit delete command).
    profiles.execute("DELETE FROM trainers WHERE id = ?1", [&first.trainer_id]).unwrap();

    let result = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request);
    assert!(matches!(result, Err(TrainerBuildError::CommittedTargetMissing { .. })), "{result:?}");
    // Never silently creates a "replacement" Trainer.
    let count: i64 = profiles.query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0)).unwrap();
    assert_eq!(count, 0);

    let _ = std::fs::remove_dir_all(&dir);
}

/// A genuinely NEW operation (fresh `operation_id`) against a Trainer
/// whose content/rules moved since an earlier successful commit must
/// still reject stale — R1A's replay mechanism only short-circuits the
/// staleness check for a REPLAY of the same operation, never for a new
/// one.
#[test]
fn a_new_operation_against_a_stale_revision_after_content_changed_still_rejects_stale() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let intent = full_valid_intent();
    let intent_value = serde_json::to_value(&intent).unwrap();
    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &intent_value);
    let request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value,
        expected_base_revision: base_revision,
        manual_adjudications: vec![json!({"code": "prerequisite_not_met", "field": "acquisitions[7]"})],
        confirm: true,
        operation_id: op_id(),
    };
    let first = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();

    // A genuinely new operation, targeting the now-existing Trainer, but
    // still carrying the ORIGINAL (now pre-commit, thus stale) revision.
    let new_operation = CommitTrainerBuildRequest { trainer_id: Some(first.trainer_id.clone()), operation_id: op_id(), ..request };
    let result = commit_build(&definitions, &mut profiles, &ruleset, &revision, &new_operation);
    assert!(matches!(result, Err(TrainerBuildError::StaleRevision { .. })), "{result:?}");

    let count: i64 = profiles.query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0)).unwrap();
    assert_eq!(count, 1, "the rejected new operation must not create a second Trainer");

    let _ = std::fs::remove_dir_all(&dir);
}

/// T13D3-R1A (P3): "no new build using disabled or unavailable rules
/// datasets" / "definition pins do not implicitly activate a whole
/// dataset pack" — `content_pack_id` must actually be an enabled pack in
/// the active ruleset for a NEW rule execution.
#[test]
fn preview_and_commit_reject_a_content_pack_id_not_active_in_the_ruleset() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let intent = full_valid_intent();
    let intent_value = serde_json::to_value(&intent).unwrap();

    let preview_request = PreviewTrainerBuildRequest { trainer_id: None, content_pack_id: "not-an-enabled-pack".to_string(), base_revision: None, intent: intent_value.clone(), manual_adjudications: vec![] };
    let preview_result = preview_build(&definitions, &profiles, &ruleset, &revision, &preview_request);
    assert!(matches!(preview_result, Err(TrainerBuildError::PackNotActive { .. })), "{preview_result:?}");

    let commit_request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "not-an-enabled-pack".to_string(),
        draft_id: None,
        intent: intent_value,
        expected_base_revision: "irrelevant-since-this-must-reject-before-any-staleness-check".to_string(),
        manual_adjudications: vec![],
        confirm: true,
        operation_id: op_id(),
    };
    let commit_result = commit_build(&definitions, &mut profiles, &ruleset, &revision, &commit_request);
    assert!(matches!(commit_result, Err(TrainerBuildError::PackNotActive { .. })), "{commit_result:?}");
    let count: i64 = profiles.query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0)).unwrap();
    assert_eq!(count, 0);

    let _ = std::fs::remove_dir_all(&dir);
}

// =======================================================================
// T13D3-R1B: automatic source-backed Feature stat tag modifiers (Core
// p58). `features:athlete@core` and `features:training-regime@core` both
// carry a real, shipped `["+HP"]` tag — the exact disposition-audited
// worked example (Core p14-16: 13 HP -> 15 HP -> 57 Max HP at L1).
// =======================================================================

/// Two REAL, pre-existing, disclosed seed data-quality issues (unrelated
/// to R1B, not silently patched by it) mean neither Athlete nor Training
/// Regime can auto-resolve as legally satisfied here, even though a
/// person reading Core would agree both are: (1) Athlete's own
/// `prerequisite_semantics.ast` mis-parses its raw text ("Novice
/// Athletics, One of Athletic Prowess, Mounted Prowess, Power Boost,
/// Stamina, or Swimmer" — clearly Athletics OR one of four alternatives)
/// as an `"all"` (AND) combinator instead of the intended `"any"` (OR),
/// so it demands Athletics AND three unrelated Edges nobody has; (2)
/// Training Regime's "Athlete" prerequisite leaf is mislabeled
/// `ambiguous_entity` instead of `has_feature`, so the generic evaluator
/// can't structurally confirm it even though Athlete IS acquired first
/// here. Every test below acquires Athlete after first raising Athletics
/// to Novice (satisfying the one real, intended condition) and then
/// explicitly adjudicates both resulting issues — exactly the documented,
/// approved use of `manual_adjudications` for a real but
/// evaluator-unsupported case, never silently assumed away.
fn intent_with_athlete_and_training_regime() -> TrainerBuildCreationIntent {
    TrainerBuildCreationIntent {
        name: "Ash".to_string(),
        background: valid_background(),
        acquisitions: vec![
            acq("edge", "edges:basic-skills@core", json!({"skill": "perception"})),
            acq("feature", "features:chronicler@core", Value::Null),
            acq("edge", "edges:basic-skills@core", json!({"skill": "athletics"})),
            acq("feature", "features:athlete@core", Value::Null),
            acq("edge", "edges:basic-skills@core", json!({"skill": "guile"})),
            acq("feature", "features:training-regime@core", Value::Null),
            acq("edge", "edges:acrobat@core", Value::Null),
            acq("feature", "features:let-me-help-you-with-that@core", Value::Null),
            free_training("features:brutal-training@core"),
        ],
        stat_desired_points: vec![StatAllocationDraftEntry { stat: TrainerCombatStat::Hp, points: 3 }],
        weight_lb: Some(150),
        elemental_connection_mode: None,
    }
}

const ATHLETE_ADJUDICATION_FIELD: &str = "acquisitions[3]";
const TRAINING_REGIME_ADJUDICATION_FIELD: &str = "acquisitions[5]";

fn athlete_and_training_regime_adjudications() -> Vec<Value> {
    vec![
        json!({"code": "prerequisite_not_met", "field": ATHLETE_ADJUDICATION_FIELD, "note": "GM confirmed: Athlete's own prerequisite AST is mis-parsed (all instead of any) in the seed; Novice Athletics alone is Core's real requirement and is satisfied here."}),
        json!({"code": "manual_review_required", "field": TRAINING_REGIME_ADJUDICATION_FIELD, "note": "GM confirmed Athlete was legally acquired first; the seed mislabels this leaf ambiguous_entity instead of has_feature."}),
    ]
}

#[test]
fn athlete_and_training_regime_give_exactly_plus_2_hp_and_57_max_hp_at_level_1() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let intent = intent_with_athlete_and_training_regime();
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();

    let resolution = resolve_creation(&definitions, &ruleset, &rules, &intent, &[]);
    let blocking: Vec<_> = resolution.issues.iter().filter(|i| i.issue.severity == ptu_domain::engine::validation::Severity::Error).collect();
    assert_eq!(blocking.len(), 2, "expected exactly Athlete's mis-parsed-AST prereq issue and Training Regime's mislabeled ambiguous_entity leaf: {:?}", blocking);
    assert!(blocking.iter().any(|i| i.issue.code == "prerequisite_not_met" && i.field.as_deref() == Some(ATHLETE_ADJUDICATION_FIELD)));
    assert!(blocking.iter().any(|i| i.issue.code == "manual_review_required" && i.field.as_deref() == Some(TRAINING_REGIME_ADJUDICATION_FIELD)));
    let hp_modifiers: Vec<_> = resolution.feature_tag_modifiers.iter().filter(|m| m.target == "trainer.stat.hp").collect();
    assert_eq!(hp_modifiers.len(), 2, "Athlete AND Training Regime each independently contribute their own +HP tag regardless of their (unrelated, adjudicated) prerequisite issues: {:?}", resolution.feature_tag_modifiers);
    assert!(hp_modifiers.iter().all(|m| m.value == 1.0 && m.source_label == "Feature Tag"));

    let intent_value = serde_json::to_value(&intent).unwrap();
    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &intent_value);
    let request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value,
        expected_base_revision: base_revision,
        manual_adjudications: athlete_and_training_regime_adjudications(),
        confirm: true,
        operation_id: op_id(),
    };
    let commit = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    // 10 (floor) + 3 (allocated) = 13, +2 from the two tags = 15.
    assert_eq!(commit.core_result.combat_stats.hp.final_value, 15.0, "{:#?}", commit.core_result.combat_stats.hp);
    // level*2 + HP*3 + 10 = 1*2 + 15*3 + 10 = 57 (the exact disposition-audited Core p16 worked example).
    assert_eq!(commit.core_result.max_hp.final_value, 57.0);
    // The normal 10-point creation pool itself is unchanged by tags: only 3 of it were spent on HP.
    assert_eq!(commit.core_result.allocation_summary.spent, 3);
    assert_eq!(commit.core_result.allocation_summary.granted, 10);

    let _ = std::fs::remove_dir_all(&dir);
}

/// "Reopen/portable reload/C1 edit preserve effect without duplication."
#[test]
fn the_hp_tag_effect_survives_reopen_and_a_later_c1_stat_edit_without_duplicating() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let intent = intent_with_athlete_and_training_regime();
    let intent_value = serde_json::to_value(&intent).unwrap();
    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &intent_value);
    let request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value,
        expected_base_revision: base_revision,
        manual_adjudications: athlete_and_training_regime_adjudications(),
        confirm: true,
        operation_id: op_id(),
    };
    let commit = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    assert_eq!(commit.core_result.combat_stats.hp.final_value, 15.0);

    // Reopen from a fresh connection (never persisted derived numbers —
    // proves it's re-derived fresh from the acquisitions every time, not
    // a stored value that could drift or duplicate).
    drop(profiles);
    let reopened = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
    let reloaded = load_trainer_profile(&reopened, &commit.trainer_id).unwrap().unwrap();
    let (feature_tag_modifiers, issues) = ptu_domain::engine::trainer_build::derive_feature_tag_modifiers(&definitions, &reloaded.features);
    assert!(issues.is_empty());
    let hp_modifiers: Vec<_> = feature_tag_modifiers.iter().filter(|m| m.target == "trainer.stat.hp").collect();
    assert_eq!(hp_modifiers.len(), 2, "reopen must not duplicate or lose either tag contribution");

    // A later C1 stat-allocation edit (e.g. moving points around) still
    // combines correctly with the SAME, unduplicated tag effect.
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();
    let progression = ptu_domain::engine::datasets::load_trainer_progression(&definitions, "ptu-core-1.05").unwrap();
    let _ = rules;
    let edited_points = vec![StatAllocationDraftEntry { stat: TrainerCombatStat::Hp, points: 5 }];
    let normal_entries = ptu_domain::engine::trainer_core::build_normal_allocation_entries(&edited_points, reloaded.level, &progression);
    let merged = ptu_domain::engine::trainer_core::merge_with_preserved_provenance(normal_entries, &reloaded.stat_allocation);
    let result = ptu_domain::engine::trainer_core::resolve_trainer_core(1, &merged, &reloaded.skills, reloaded.weight_lb, &reloaded.gm_grants, &progression, &feature_tag_modifiers);
    // 10 (floor) + 5 (newly allocated) = 15, +2 from tags = 17 — the tag
    // contribution is additive and independent of how many Creation
    // points are allocated, never duplicated by the edit.
    assert_eq!(result.combat_stats.hp.final_value, 17.0);

    let _ = std::fs::remove_dir_all(&dir);
}

/// "Removing one tagged acquisition removes only its +1 and leaves other
/// Feature/GM effects."
#[test]
fn removing_one_tagged_feature_removes_only_its_own_contribution() {
    let (dir, definitions, _profiles, ruleset) = setup();
    let mut intent = intent_with_athlete_and_training_regime();
    intent.acquisitions.retain(|a| a.definition_version_id != "features:training-regime@core");
    // Keep the budget legal: replace the dropped paid Feature slot with a
    // different real, prerequisite-satisfied Feature (Novice Command, via
    // this Background's own novice skill) that carries no stat tag at
    // all, so this test isolates "only Athlete's own +1 remains."
    intent.acquisitions.push(acq("feature", "features:ace-trainer@core", Value::Null));
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();

    let resolution = resolve_creation(&definitions, &ruleset, &rules, &intent, &[]);
    // Training Regime's own issue is gone now that it's removed; Athlete's
    // unrelated mis-parsed-AST prereq issue (see the fixture's own doc
    // comment) is the only one still expected here.
    let blocking: Vec<_> = resolution.issues.iter().filter(|i| i.issue.severity == ptu_domain::engine::validation::Severity::Error).collect();
    assert_eq!(blocking.len(), 1, "{:?}", blocking);
    assert_eq!(blocking[0].field.as_deref(), Some(ATHLETE_ADJUDICATION_FIELD));
    let hp_modifiers: Vec<_> = resolution.feature_tag_modifiers.iter().filter(|m| m.target == "trainer.stat.hp").collect();
    assert_eq!(hp_modifiers.len(), 1, "only Athlete's own +HP must remain once Training Regime is removed: {:?}", resolution.feature_tag_modifiers);

    let _ = std::fs::remove_dir_all(&dir);
}

/// A trusted, source-audited `+Attack or Special Attack` tag
/// (`features:aura-guardian@core`) requires an explicit `stat_choice`
/// among exactly its two candidates — missing or invalid choice blocks
/// publish (non-overridable); a legal choice resolves to exactly that
/// stat, never both.
#[test]
fn a_choice_tag_requires_a_valid_stat_choice_and_blocks_publish_without_one() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();

    let acquisitions_without_choice = vec![
        acq("edge", "edges:basic-skills@core", json!({"skill": "perception"})),
        acq("feature", "features:aura-guardian@core", Value::Null),
        acq("edge", "edges:basic-skills@core", json!({"skill": "guile"})),
        acq("feature", "features:ace-trainer@core", Value::Null),
        acq("edge", "edges:acrobat@core", Value::Null),
        acq("feature", "features:commander@core", Value::Null),
        acq("edge", "edges:categoric-inclination@core", json!({"category": "spirit"})),
        acq("feature", "features:let-me-help-you-with-that@core", Value::Null),
        free_training("features:brutal-training@core"),
    ];
    let missing_choice = TrainerBuildCreationIntent { acquisitions: acquisitions_without_choice.clone(), ..intent_with_athlete_and_training_regime() };
    let resolution = resolve_creation(&definitions, &ruleset, &rules, &missing_choice, &[]);
    assert!(resolution.issues.iter().any(|i| i.issue.code == "feature_tag_stat_choice_required" && !i.issue.override_allowed), "{:?}", resolution.issues);
    assert!(resolution.feature_tag_modifiers.is_empty(), "no modifier is invented without a valid choice");

    // Now commit must reject even with an adjudication attempt, since the
    // issue is explicitly non-overridable.
    let missing_choice_value = serde_json::to_value(&missing_choice).unwrap();
    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &missing_choice_value);
    let reject_request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: missing_choice_value,
        expected_base_revision: base_revision,
        manual_adjudications: vec![json!({"code": "feature_tag_stat_choice_required"})],
        confirm: true,
        operation_id: op_id(),
    };
    let result = commit_build(&definitions, &mut profiles, &ruleset, &revision, &reject_request);
    assert!(matches!(result, Err(TrainerBuildError::ValidationFailed { .. })), "{result:?}");

    // A legal choice (Special Attack) resolves to exactly that stat.
    let mut acquisitions_with_choice = acquisitions_without_choice;
    acquisitions_with_choice[1] = acq("feature", "features:aura-guardian@core", json!({"stat_choice": "special_attack"}));
    let with_choice = TrainerBuildCreationIntent { acquisitions: acquisitions_with_choice, ..intent_with_athlete_and_training_regime() };
    let resolution = resolve_creation(&definitions, &ruleset, &rules, &with_choice, &[]);
    assert!(!resolution.issues.iter().any(|i| i.issue.code == "feature_tag_stat_choice_required"));
    assert_eq!(resolution.feature_tag_modifiers.len(), 1);
    assert_eq!(resolution.feature_tag_modifiers[0].target, "trainer.stat.special_attack");
    assert!(!resolution.feature_tag_modifiers.iter().any(|m| m.target == "trainer.stat.attack"), "a chosen Special Attack must not ALSO apply to Attack");

    let _ = std::fs::remove_dir_all(&dir);
}

/// "Altered-source negative case cannot masquerade as reviewed Core
/// policy." A homebrew Feature carrying an IDENTICAL-looking `["+HP"]`
/// tag, under its own (non-`@core`, thus not in the trusted map)
/// `definition_version_id`, must resolve NO automatic modifier at all —
/// the trusted-fingerprint lookup is by exact `definition_version_id`,
/// never by tag content alone.
#[test]
fn a_homebrew_feature_with_a_matching_tag_never_gets_an_automatic_modifier() {
    let (dir, definitions, _profiles, _ruleset) = setup();
    let homebrew_feature = json!({
        "definition_version_id": "features:totally-not-athlete@homebrew",
        "acquisition_id": "acq-1",
        "source": "creation",
    });
    let (modifiers, issues) = ptu_domain::engine::trainer_build::derive_feature_tag_modifiers(&definitions, &[homebrew_feature]);
    assert!(modifiers.is_empty(), "an id absent from the trusted fingerprint map must never produce an automatic modifier");
    assert!(issues.is_empty(), "absence from the table is the normal case for the vast majority of Features, not an error");

    let _ = std::fs::remove_dir_all(&dir);
}

/// A record whose LIVE `data_json` no longer hashes to what the trusted
/// fingerprint table recorded (simulated tampering — content import's own
/// invariant should prevent this in practice, but this proves the
/// defense-in-depth check actually fires) must leave the tag unresolved
/// rather than silently trusting a possibly-altered payload.
#[test]
fn a_tampered_record_under_a_trusted_id_leaves_the_tag_unresolved_not_silently_trusted() {
    let (dir, definitions, _profiles, _ruleset) = setup();

    // Directly corrupt the stored data_json for a real trusted record —
    // simulating a hypothetical bypass of import's own content-immutability
    // invariant, to prove this is genuinely defense-in-depth and not
    // merely decorative.
    definitions.execute("UPDATE features SET data_json = '{\"tags\":[\"+HP\"],\"tampered\":true}' WHERE definition_version_id = 'features:athlete@core'", []).unwrap();

    let feature_acq = json!({"definition_version_id": "features:athlete@core", "acquisition_id": "acq-1", "source": "creation"});
    let (modifiers, issues) = ptu_domain::engine::trainer_build::derive_feature_tag_modifiers(&definitions, &[feature_acq]);
    assert!(modifiers.is_empty(), "a hash mismatch must never apply a possibly-fabricated bonus");
    assert!(issues.iter().any(|i| i.issue.code == "feature_tag_source_unverified"), "{issues:?}");

    let _ = std::fs::remove_dir_all(&dir);
}

/// T13D3 acceptance: "Legacy requires explicit reconciliation; unknown
/// fields/origins stay intact." A pre-D3 Trainer with a GM-fixed grant, an
/// opaque legacy edge, Pokémon, inventory, and rosters keeps every one of
/// those byte-for-byte through a creation commit that only touches
/// background/skills/creation-sourced edges+features/stat allocation/
/// weight/build_state.
#[test]
fn commit_reconciling_a_legacy_trainer_preserves_unrelated_state() {
    let (dir, definitions, mut profiles, ruleset) = setup();

    let legacy = ptu_domain::profile::model::TrainerProfile {
        id: "legacy-t1".to_string(),
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
        rosters: vec![ptu_domain::profile::model::RosterRecord { id: "r1".to_string(), name: "Team".to_string(), active: true, max_members: None, rules: Value::Null }],
        inventory: ptu_domain::profile::model::InventoryRecord { backpack: vec![ptu_domain::profile::model::ItemStack { item_id: "potion".to_string(), quantity: 2 }], storage: vec![], equipped: Default::default() },
        ..Default::default()
    };
    ptu_domain::profile::repository::save_trainer_profile(&mut profiles, &legacy).unwrap();

    let revision = e02_revision(&definitions, &ruleset);
    let rules_fp_ctx = get_content_context(&definitions, &ruleset, &rulesets_dir(), &content_packs_dir()).unwrap();
    let _ = rules_fp_ctx;

    let base_revision = {
        let profile = load_trainer_profile(&profiles, "legacy-t1").unwrap().unwrap();
        let rules = ptu_domain::engine::datasets::load_trainer_build_rules(&definitions, "ptu-core-1.05").unwrap();
        let fp = ptu_domain::engine::trainer_build::compute_rules_fingerprint("ptu-core-1.05", &rules, &revision);
        ptu_domain::engine::trainer_build::compute_base_revision(&profile, &fp)
    };

    let intent = TrainerBuildCreationIntent { name: "Old Save".to_string(), ..full_valid_intent() };
    let request = CommitTrainerBuildRequest {
        trainer_id: Some("legacy-t1".to_string()),
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: serde_json::to_value(&intent).unwrap(),
        expected_base_revision: base_revision,
        manual_adjudications: vec![json!({"code": "prerequisite_not_met", "field": "acquisitions[7]"})],
        confirm: true,
        operation_id: op_id(),
    };
    commit_build(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();

    let reloaded = load_trainer_profile(&profiles, "legacy-t1").unwrap().unwrap();
    assert_eq!(reloaded.money, 250, "unrelated fields must survive a build commit untouched");
    assert_eq!(reloaded.gm_grants.len(), 1, "GM grants must survive untouched");
    assert_eq!(reloaded.pokemon.len(), 1, "Pokémon must survive untouched");
    assert_eq!(reloaded.rosters.len(), 1, "rosters must survive untouched");
    assert_eq!(reloaded.inventory.backpack.len(), 1, "inventory must survive untouched");
    assert!(reloaded.edges.iter().any(|e| e["definition_version_id"] == "edges:acrobat@core" && e["source"] == "legacy"), "the pre-existing legacy edge must be preserved, not wiped by the new creation-sourced edges");
    assert_eq!(reloaded.edges.iter().filter(|e| e.get("source").and_then(Value::as_str) == Some("creation")).count(), 4, "the new creation-sourced edges must also be present");

    let _ = std::fs::remove_dir_all(&dir);
}

/// A legacy Trainer already past level 1 is explicitly out of this
/// creation flow's scope — rejected with a clear reason, never silently
/// mis-validated against level-1-only budget/Background rules.
#[test]
fn reconciling_a_higher_level_legacy_trainer_is_explicitly_rejected() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let legacy = ptu_domain::profile::model::TrainerProfile { id: "t5".to_string(), name: "Veteran".to_string(), level: 5, exp: 0, money: 0, ..Default::default() };
    ptu_domain::profile::repository::save_trainer_profile(&mut profiles, &legacy).unwrap();

    let revision = e02_revision(&definitions, &ruleset);
    let request = PreviewTrainerBuildRequest {
        trainer_id: Some("t5".to_string()),
        content_pack_id: "ptu-core-1.05".to_string(),
        base_revision: None,
        intent: serde_json::to_value(full_valid_intent()).unwrap(),
        manual_adjudications: vec![],
    };
    let result = preview_build(&definitions, &profiles, &ruleset, &revision, &request);
    assert!(matches!(result, Err(TrainerBuildError::Internal { .. })));

    let _ = std::fs::remove_dir_all(&dir);
}

/// T13D3 acceptance: "Relevant source change ... rejects stale." A real
/// E02 authoring disable of an acquired definition (the same mechanism
/// `content_context.rs`'s F4 test exercises) must move E02's content
/// revision and therefore invalidate a previously-computed base_revision.
#[test]
fn an_e02_content_change_invalidates_a_previously_computed_base_revision() {
    let (dir, definitions, profiles, ruleset) = setup();
    let revision_before = e02_revision(&definitions, &ruleset);
    let intent = full_valid_intent();
    let preview_request = PreviewTrainerBuildRequest { trainer_id: None, content_pack_id: "ptu-core-1.05".to_string(), base_revision: None, intent: serde_json::to_value(&intent).unwrap(), manual_adjudications: vec![] };
    let preview = preview_build(&definitions, &profiles, &ruleset, &revision_before, &preview_request).unwrap();

    soft_delete_definition(&definitions, ContentKind::Edge, "edges:acrobat@core").unwrap();
    let revision_after = e02_revision(&definitions, &ruleset);
    assert_ne!(revision_before, revision_after, "sanity: the E02 disable must actually move the content revision");

    let stale_retry = PreviewTrainerBuildRequest { base_revision: Some(preview.base_revision), ..preview_request };
    let result = preview_build(&definitions, &profiles, &ruleset, &revision_after, &stale_retry);
    assert!(matches!(result, Err(TrainerBuildError::StaleRevision { .. })));

    let _ = std::fs::remove_dir_all(&dir);
}

/// T13D3 acceptance: "unrelated inventory write survives" a build commit —
/// covered above inside the legacy-reconciliation test's own assertions
/// (backpack/rosters/Pokémon untouched); this test additionally proves the
/// REVERSE direction: an inventory write made AFTER a build commit is not
/// itself invalidated or reverted by anything the commit did.
#[test]
fn a_later_unrelated_inventory_write_is_unaffected_by_an_earlier_build_commit() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let intent = full_valid_intent();
    let intent_value = serde_json::to_value(&intent).unwrap();
    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &intent_value);
    let request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value,
        expected_base_revision: base_revision,
        manual_adjudications: vec![json!({"code": "prerequisite_not_met", "field": "acquisitions[7]"})],
        confirm: true,
        operation_id: op_id(),
    };
    let commit = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();

    let mut profile = load_trainer_profile(&profiles, &commit.trainer_id).unwrap().unwrap();
    profile.inventory.backpack.push(ptu_domain::profile::model::ItemStack { item_id: "great-ball".to_string(), quantity: 5 });
    ptu_domain::profile::repository::save_trainer_profile(&mut profiles, &profile).unwrap();

    let reloaded = load_trainer_profile(&profiles, &commit.trainer_id).unwrap().unwrap();
    assert_eq!(reloaded.inventory.backpack.len(), 1);
    assert_eq!(reloaded.skills["acrobatics"]["base_rank"], "adept", "the build's own effects must still be intact after an unrelated later write");

    let _ = std::fs::remove_dir_all(&dir);
}

// =======================================================================
// Drafts (already-real persistence from T13D1) + commit
// =======================================================================

#[test]
fn commit_from_a_saved_draft_discards_it_on_success() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let intent = full_valid_intent();
    let intent_value = serde_json::to_value(&intent).unwrap();

    let draft_id = ptu_domain::profile::repository::save_trainer_build_draft(&profiles, None, None, &intent_value).unwrap();
    assert!(ptu_domain::profile::repository::load_trainer_build_draft(&profiles, &draft_id).unwrap().is_some());
    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &intent_value);

    let request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: Some(draft_id.clone()),
        intent: intent_value,
        expected_base_revision: base_revision,
        manual_adjudications: vec![json!({"code": "prerequisite_not_met", "field": "acquisitions[7]"})],
        confirm: true,
        operation_id: op_id(),
    };
    commit_build(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();

    assert!(ptu_domain::profile::repository::load_trainer_build_draft(&profiles, &draft_id).unwrap().is_none(), "a successfully committed draft must be discarded");

    let _ = std::fs::remove_dir_all(&dir);
}

/// Cancel (never calling commit at all) must never publish anything —
/// proven by the mere existence of an untouched draft with no
/// corresponding Trainer.
#[test]
fn a_saved_draft_that_is_never_committed_never_creates_a_trainer() {
    let (dir, _definitions, profiles, _ruleset) = setup();
    let intent_value = serde_json::to_value(full_valid_intent()).unwrap();
    let draft_id = ptu_domain::profile::repository::save_trainer_build_draft(&profiles, None, None, &intent_value).unwrap();
    assert!(ptu_domain::profile::repository::load_trainer_build_draft(&profiles, &draft_id).unwrap().is_some());
    let count: i64 = profiles.query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0)).unwrap();
    assert_eq!(count, 0);
    let _ = std::fs::remove_dir_all(&dir);
}

// =======================================================================
// Invalid-request shape
// =======================================================================

#[test]
fn preview_rejects_an_intent_that_does_not_match_the_typed_shape() {
    let (dir, definitions, profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let request = PreviewTrainerBuildRequest { trainer_id: None, content_pack_id: "ptu-core-1.05".to_string(), base_revision: None, intent: json!({"not": "a valid creation intent"}), manual_adjudications: vec![] };
    let result = preview_build(&definitions, &profiles, &ruleset, &revision, &request);
    assert!(matches!(result, Err(TrainerBuildError::InvalidIntent { .. })));
    let _ = std::fs::remove_dir_all(&dir);
}

// =======================================================================
// T13D4-R1A — restore accepted D3 receipt replay compatibility
// (T13D4_BUILD_CONTRACT_REVIEW.md confirmed BLOCKER: `compute_operation_
// request_fingerprint` had a literal `"operation_kind"` field added to its
// hashed JSON, which would have changed the fingerprint of every receipt
// created before that change, breaking replay for pre-existing
// `trainer_build_operations` rows. Reverted to the exact pre-T13D4 field
// set. These tests prove that restoration independently — not by
// exercising today's code against itself, which would be tautological.
// =======================================================================

/// Independently reconstructs T13D3-R1A's ORIGINAL, already-FINAL-
/// ACCEPTED fingerprint algorithm BY HAND — the exact pre-T13D4 field set
/// (`trainer_id`/`content_pack_id`/`draft_id`/`intent`/
/// `expected_base_revision`/`manual_adjudications`), hashed with the same
/// SHA256-then-lowercase-hex scheme `to_hex` uses — built WITHOUT calling
/// `compute_operation_request_fingerprint` (a private, unexported
/// function) or ANY other production helper. This is the proof artifact:
/// if the corrected implementation's stored fingerprint doesn't exactly
/// equal this hand-built one, the restoration is not actually exact.
fn independently_reconstruct_pre_d4_build_fingerprint(trainer_id: Option<&str>, content_pack_id: &str, draft_id: Option<&str>, intent: &Value, expected_base_revision: &str, manual_adjudications: &Value) -> String {
    let relevant = json!({
        "trainer_id": trainer_id,
        "content_pack_id": content_pack_id,
        "draft_id": draft_id,
        "intent": intent,
        "expected_base_revision": expected_base_revision,
        "manual_adjudications": manual_adjudications,
    });
    let mut hasher = Sha256::new();
    hasher.update(serde_json::to_vec(&relevant).unwrap());
    hasher.finalize().iter().map(|b| format!("{b:02x}")).collect()
}

#[test]
fn r1a_the_restored_fingerprint_exactly_matches_an_independently_hand_built_pre_d4_algorithm() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let intent = full_valid_intent();
    let intent_value = serde_json::to_value(&intent).unwrap();
    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &intent_value);
    let operation_id = op_id();
    let manual_adjudications = json!([{"code": "prerequisite_not_met", "field": "acquisitions[7]"}]);
    let request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value.clone(),
        expected_base_revision: base_revision.clone(),
        manual_adjudications: manual_adjudications.as_array().unwrap().clone(),
        confirm: true,
        operation_id: operation_id.clone(),
    };
    let first = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();

    let independently_reconstructed = independently_reconstruct_pre_d4_build_fingerprint(None, "ptu-core-1.05", None, &intent_value, &base_revision, &manual_adjudications);
    let stored = ptu_domain::profile::repository::load_build_operation(&profiles, &operation_id).unwrap().unwrap();
    assert_eq!(
        stored.request_fingerprint, independently_reconstructed,
        "the restored compute_operation_request_fingerprint must produce EXACTLY the hand-reconstructed pre-D4 hash — any surviving extra field (like the D4-era operation_kind) would show up here as a mismatch"
    );

    // A receipt with that exact (now-proven) shape still replays: same
    // operation_id/payload returns the SAME Trainer, no duplicate write.
    let replay = commit_build(&definitions, &mut profiles, &ruleset, &revision, &request).unwrap();
    assert_eq!(replay.trainer_id, first.trainer_id);
    let count: i64 = profiles.query_row("SELECT COUNT(*) FROM trainers", [], |r| r.get(0)).unwrap();
    assert_eq!(count, 1, "a replay against the restored-algorithm receipt must never create a second Trainer");

    // Changed semantic payload (different intent), same operation_id,
    // still rejects OperationConflict — the restoration did not weaken
    // same-family conflict detection.
    let mut different_intent = intent.clone();
    different_intent.name = "A Different Name".to_string();
    let conflicting = CommitTrainerBuildRequest { intent: serde_json::to_value(&different_intent).unwrap(), ..request };
    let conflict_result = commit_build(&definitions, &mut profiles, &ruleset, &revision, &conflicting);
    assert!(matches!(conflict_result, Err(TrainerBuildError::OperationConflict { .. })));

    let _ = std::fs::remove_dir_all(&dir);
}

/// A build `operation_id` reused against `commit_trainer_advancement`
/// must reject `OperationConflict`, not replay a creation response as an
/// advancement response — proving cross-family protection survives the
/// R1A restoration even though `compute_operation_request_fingerprint`
/// (build) no longer shares any literal `operation_kind` marker with
/// `compute_operation_request_fingerprint_generic` (the three D4
/// families): the two functions simply hash materially different field
/// sets, so a cross-family fingerprint comparison mismatches on its own.
#[test]
fn r1a_a_build_operation_id_cannot_be_replayed_as_an_advancement_commit() {
    let (dir, definitions, mut profiles, ruleset) = setup();
    let revision = e02_revision(&definitions, &ruleset);
    let intent = full_valid_intent();
    let intent_value = serde_json::to_value(&intent).unwrap();
    let base_revision = fresh_base_revision(&definitions, &profiles, &ruleset, &revision, &intent_value);
    let shared_operation_id = op_id();
    let build_request = CommitTrainerBuildRequest {
        trainer_id: None,
        content_pack_id: "ptu-core-1.05".to_string(),
        draft_id: None,
        intent: intent_value,
        expected_base_revision: base_revision,
        manual_adjudications: vec![json!({"code": "prerequisite_not_met", "field": "acquisitions[7]"})],
        confirm: true,
        operation_id: shared_operation_id.clone(),
    };
    commit_build(&definitions, &mut profiles, &ruleset, &revision, &build_request).unwrap();

    // An unrelated, pre-existing Trainer for the advancement request to
    // target — `commit_trainer_advancement` checks the operation receipt
    // before resolving advancement content, so the fingerprint mismatch
    // must be what rejects this, not a missing/invalid Trainer.
    let advancement_target = TrainerProfile { id: new_id(), name: "Advancement Target".to_string(), level: 1, build_state: Some(json!({"status": "published"})), ..TrainerProfile::default() };
    save_trainer_profile(&mut profiles, &advancement_target).unwrap();

    let advancement_request = CommitTrainerAdvancementRequest {
        trainer_id: advancement_target.id.clone(),
        content_pack_id: "ptu-core-1.05".to_string(),
        expected_base_revision: "irrelevant-never-reached".to_string(),
        next_level: 2,
        milestone_option_id: None,
        acquired_choices: vec![],
        stat_stream_choice: None,
        manual_adjudications: vec![],
        confirm: true,
        operation_id: shared_operation_id,
    };
    let result = commit_trainer_advancement(&definitions, &mut profiles, &ruleset, &revision, &advancement_request);
    assert!(matches!(result, Err(TrainerBuildError::OperationConflict { .. })), "{result:?}");

    let _ = std::fs::remove_dir_all(&dir);
}
