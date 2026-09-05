//! T13D1 (Trainer Build + Visual Identity Corrective REPLAN, task T13D1):
//! frozen wire/rule contracts for guided level-1 creation and advancement
//! (plan §3.4's command family table) and the small pieces of that contract
//! that are pure computation (rank normalization, the opaque revision
//! hash) and can therefore be real today. Authoritative build VALIDATION —
//! actually deciding whether a candidate build is legal — is T13D3/T13D4
//! scope; every command below that would need that logic returns
//! [`BuildError::NotYetImplemented`] rather than a fabricated success (plan
//! T13D1 scope: "Declare not-yet-implemented capabilities unavailable,
//! never return canned success").

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use super::datasets::TrainerBuildRules;
use super::validation::ValidationIssue;
use crate::error::BuildError;
use crate::profile::model::TrainerProfile;

// =======================================================================
// Rank normalization (Core p33-34; see `trainer_build_rules.json`'s
// `rank_table` for the source-cited canonical ordinal, and
// T13D_PLAN_REVIEW_APPROVE_v2.md for the seed-data bug this corrects).
// =======================================================================

/// The six Core ranks, in ascending canonical order (`ordinal` 1-6, dice
/// count == ordinal). Do NOT trust `seed/json/{edges,features}.json`'s own
/// `prerequisite_semantics.rank_value` integer — that field uses a
/// different, incorrect numbering (untrained=0, novice=2, adept=3,
/// expert=4, master=5; pathetic is never referenced there). Always
/// normalize through [`core_rank_ordinal`] by the rank's *name* instead.
pub const CORE_RANK_ORDER: [&str; 6] = ["pathetic", "untrained", "novice", "adept", "expert", "master"];

/// Returns the canonical 1-6 ordinal for a Core rank name (case-sensitive,
/// lowercase — matches `prerequisite_semantics.ast.rank`'s existing casing
/// convention), or `None` for an unrecognized name. Dice count for a check
/// at this rank equals the ordinal itself.
pub fn core_rank_ordinal(rank_name: &str) -> Option<i64> {
    CORE_RANK_ORDER.iter().position(|&r| r == rank_name).map(|i| i as i64 + 1)
}

// =======================================================================
// Acquisitions (§3.2): provenance for one Trainer Edge/Feature instance.
// =======================================================================

/// Where one Trainer Edge/Feature acquisition came from. Distinct from
/// [`crate::profile::model::StatAllocationSource`] — that one tags a Stat
/// Point; this tags an Edge/Feature instance.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AcquisitionSource {
    Creation,
    LevelUp,
    /// The restricted bonus Skill Edge granted at L2/6/12 (Core p19),
    /// distinct from an ordinary `LevelUp` Edge grant at the same level.
    BonusSkillEdge,
    Milestone,
    GmFixed,
    GmResource,
    /// A pre-T13D1 acquisition whose provenance was never recorded —
    /// never inferred after the fact (plan: "no retroactive inferred
    /// origin for existing opaque entries").
    Legacy,
}

// =======================================================================
// BuildIssue (§3.4): additive extension of the existing ValidationIssue
// shape, never a divergent parallel one.
// =======================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BuildIssue {
    #[serde(flatten)]
    pub issue: ValidationIssue,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub step: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub acquisition_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

// =======================================================================
// Build state (§3.3): published-build metadata, `TrainerProfile.build_state`'s
// typed interpretation. Missing (`None` on the profile) means legacy.
// =======================================================================

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BuildStatus {
    /// No `build_state` recorded — a pre-T13D1 Trainer. Never treated as
    /// "Core-complete" by construction (plan: "needs_reconciliation, not
    /// silently Core-complete").
    Legacy,
    Draft,
    Published,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BuildState {
    pub status: BuildStatus,
    /// `None` until Elemental Connection is actually taken; then one of
    /// `trainer_build_rules.json`'s `elemental_connection.modes` keys
    /// ("core" or "campaign_variant_distinct_type") — always shown
    /// attributed, never silently presented as Core when the variant is
    /// active (plan A25).
    #[serde(default)]
    pub elemental_connection_mode: Option<String>,
    /// True while Core steps 8-9 (starter/starting items, GM decisions
    /// per Core p17) remain deferred — never silently "ready".
    #[serde(default)]
    pub campaign_setup_pending: bool,
    #[serde(default)]
    pub narrative: Option<Value>,
}

impl Default for BuildState {
    fn default() -> Self {
        BuildState { status: BuildStatus::Legacy, elemental_connection_mode: None, campaign_setup_pending: false, narrative: None }
    }
}

/// Reads a Trainer's build status honestly: a `None`/unparsable
/// `build_state` is `Legacy`, never upgraded to `Draft`/`Published` by
/// inference.
pub fn resolve_build_state(build_state: &Option<Value>) -> BuildState {
    build_state
        .as_ref()
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default()
}

// =======================================================================
// Revision (§3.3): an opaque hash of exactly the fields a build commit is
// allowed to touch — Pokémon/inventory/rosters are deliberately excluded.
// =======================================================================

/// Hashes `content_pack_id` together with the actual `trainer_build_rules`
/// dataset content, so a change to either invalidates a `base_revision`
/// computed against the old one (plan: "Content fingerprint change
/// invalidates preview").
pub fn compute_rules_fingerprint(content_pack_id: &str, rules: &TrainerBuildRules) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content_pack_id.as_bytes());
    hasher.update(serde_json::to_vec(rules).unwrap_or_default());
    to_hex(&hasher.finalize())
}

/// Opaque canonical hash of exactly the persisted fields `commit_trainer_build`
/// (T13D3) is allowed to change: level/skills/background/Edge+Feature
/// acquisitions/grants/progression/stat allocation/build metadata. NEVER
/// Pokémon/inventory/rosters — editing those must not stale a build
/// preview, and a build commit must never touch them either.
pub fn compute_base_revision(profile: &TrainerProfile, rules_fingerprint: &str) -> String {
    let relevant = serde_json::json!({
        "level": profile.level,
        "skills": profile.skills,
        "background": profile.background,
        "edges": profile.edges,
        "features": profile.features,
        "gm_grants": profile.gm_grants,
        "progression": profile.progression,
        "stat_allocation": profile.stat_allocation,
        "build_state": profile.build_state,
        "rules_fingerprint": rules_fingerprint,
    });
    let mut hasher = Sha256::new();
    hasher.update(serde_json::to_vec(&relevant).unwrap_or_default());
    to_hex(&hasher.finalize())
}

/// Same manual hex-encoding pattern already used by
/// `content::import::hex_sha256` — no new dependency for this.
fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

// =======================================================================
// get_trainer_build_context (§3.4) — the one command family D1 actually
// implements, since it is pure data assembly (dataset + existing profile),
// not rule evaluation.
// =======================================================================

#[derive(Debug, Clone, Serialize)]
pub struct BuildContext {
    pub base_revision: String,
    pub rules_fingerprint: String,
    pub rules: TrainerBuildRules,
    pub build_status: BuildStatus,
    /// `None` for a brand-new (no `trainer_id` given) context — a fresh
    /// creation candidate, never a fabricated empty Trainer.
    pub existing_profile: Option<TrainerProfile>,
}

// =======================================================================
// preview/commit_trainer_build, *_advancement, *_gm_change, *_respec
// (§3.4): request shapes are frozen now (Frontend can compile against
// them); every body returns NotYetImplemented until T13D3/T13D4 implement
// the actual rule evaluation these need. See this module's doc comment.
// =======================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewTrainerBuildRequest {
    pub trainer_id: Option<String>,
    pub content_pack_id: String,
    /// Must match a freshly computed `base_revision`/`rules_fingerprint`
    /// or the (future) implementation rejects as stale — never silently
    /// re-based.
    pub base_revision: Option<String>,
    /// Typed draft intent (identity, Background, ordered
    /// acquisitions/parameters/source pools, normal stat desired points).
    /// Kept as opaque `Value` in D1: the intent schema is authored by
    /// T13D3, which owns the actual fields a preview reads.
    pub intent: Value,
    #[serde(default)]
    pub manual_adjudications: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitTrainerBuildRequest {
    pub draft_id: Option<String>,
    pub intent: Value,
    pub expected_base_revision: String,
    pub confirm: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewTrainerAdvancementRequest {
    pub trainer_id: String,
    pub content_pack_id: String,
    pub expected_base_revision: String,
    pub next_level: i64,
    #[serde(default)]
    pub milestone_option_id: Option<String>,
    #[serde(default)]
    pub acquired_choices: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitTrainerAdvancementRequest {
    pub trainer_id: String,
    pub expected_base_revision: String,
    pub next_level: i64,
    #[serde(default)]
    pub milestone_option_id: Option<String>,
    #[serde(default)]
    pub acquired_choices: Vec<Value>,
    pub confirm: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewTrainerGmChangeRequest {
    pub trainer_id: String,
    pub expected_base_revision: String,
    /// `"add" | "edit" | "remove"`.
    pub action: String,
    /// `"fixed" | "resource"`.
    pub grant_kind: String,
    pub payload: Value,
    #[serde(default)]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitTrainerGmChangeRequest {
    pub trainer_id: String,
    pub expected_base_revision: String,
    pub action: String,
    pub grant_kind: String,
    pub payload: Value,
    #[serde(default)]
    pub note: Option<String>,
    pub confirm: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewTrainerRespecRequest {
    pub trainer_id: String,
    pub expected_base_revision: String,
    pub proposed_normal_rebuild: Value,
    #[serde(default)]
    pub authorized_resource_reallocations: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitTrainerRespecRequest {
    pub trainer_id: String,
    pub expected_base_revision: String,
    pub proposed_normal_rebuild: Value,
    #[serde(default)]
    pub authorized_resource_reallocations: Vec<Value>,
    pub confirm: bool,
}

/// Every not-yet-implemented command family in this module returns exactly
/// this shape of error so a caller can rely on one uniform contract rather
/// than guessing per-command wording.
pub fn not_yet_implemented(capability: &str) -> BuildError {
    BuildError::NotYetImplemented { capability: capability.to_string(), scheduled_for: "T13D3/T13D4".to_string() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn core_rank_ordinal_matches_the_source_cited_table_not_the_buggy_seed_values() {
        assert_eq!(core_rank_ordinal("pathetic"), Some(1));
        assert_eq!(core_rank_ordinal("untrained"), Some(2));
        assert_eq!(core_rank_ordinal("novice"), Some(3));
        assert_eq!(core_rank_ordinal("adept"), Some(4));
        assert_eq!(core_rank_ordinal("expert"), Some(5));
        assert_eq!(core_rank_ordinal("master"), Some(6));
        assert_eq!(core_rank_ordinal("nonsense"), None);
    }

    #[test]
    fn seed_rank_value_bug_is_reproducible_and_distinct_from_the_canonical_table() {
        // seed/json/edges.json and features.json's OWN (incorrect)
        // rank_value integers, documented here so a future change to the
        // seed data is a deliberate, reviewed decision, not silent drift.
        let seed_rank_value = [("untrained", 0), ("novice", 2), ("adept", 3), ("expert", 4), ("master", 5)];
        for (name, buggy_value) in seed_rank_value {
            let correct = core_rank_ordinal(name).unwrap();
            assert_ne!(i64::from(buggy_value), correct, "{name}: seed's raw rank_value must never be trusted directly");
        }
    }

    #[test]
    fn missing_build_state_resolves_to_legacy_never_an_inferred_status() {
        let resolved = resolve_build_state(&None);
        assert_eq!(resolved.status, BuildStatus::Legacy);
        assert_eq!(resolved.elemental_connection_mode, None);
        assert!(!resolved.campaign_setup_pending);
    }

    #[test]
    fn unparsable_build_state_also_resolves_to_legacy_not_an_error() {
        let resolved = resolve_build_state(&Some(serde_json::json!("not an object")));
        assert_eq!(resolved.status, BuildStatus::Legacy);
    }

    #[test]
    fn base_revision_changes_when_a_relevant_field_changes() {
        let mut profile = TrainerProfile { id: "t1".into(), name: "X".into(), level: 1, exp: 0, money: 0, ..TrainerProfile::default() };
        let fingerprint = "fp1";
        let before = compute_base_revision(&profile, fingerprint);
        profile.level = 2;
        let after = compute_base_revision(&profile, fingerprint);
        assert_ne!(before, after, "level is a relevant field per §3.3");
    }

    #[test]
    fn base_revision_is_stable_across_irrelevant_pokemon_inventory_and_roster_changes() {
        use crate::profile::model::{ItemStack, PokemonInstance, RosterRecord, StorageState};

        let profile = TrainerProfile { id: "t1".into(), name: "X".into(), level: 1, exp: 0, money: 0, ..TrainerProfile::default() };
        let fingerprint = "fp1";
        let before = compute_base_revision(&profile, fingerprint);

        let mut with_pokemon = profile.clone();
        with_pokemon.pokemon.push(PokemonInstance {
            id: "p1".into(),
            species_definition_id: "eevee".into(),
            storage_state: StorageState::Carried,
            ..Default::default()
        });
        with_pokemon.rosters.push(RosterRecord { id: "r1".into(), name: "Team".into(), active: true, max_members: None, rules: Value::Null });
        with_pokemon.inventory.backpack.push(ItemStack { item_id: "potion".into(), quantity: 3 });

        let after = compute_base_revision(&with_pokemon, fingerprint);
        assert_eq!(before, after, "Pokémon/inventory/rosters are explicitly excluded from base_revision per §3.3");
    }

    #[test]
    fn base_revision_changes_when_the_rules_fingerprint_changes() {
        let profile = TrainerProfile { id: "t1".into(), name: "X".into(), level: 1, exp: 0, money: 0, ..TrainerProfile::default() };
        let a = compute_base_revision(&profile, "fp1");
        let b = compute_base_revision(&profile, "fp2");
        assert_ne!(a, b, "a content-fingerprint change must invalidate a previously computed revision");
    }

    #[test]
    fn build_issue_serializes_validation_issue_fields_at_the_top_level() {
        let issue = BuildIssue {
            issue: ValidationIssue { severity: super::super::validation::Severity::Error, code: "X".into(), message: "m".into(), override_allowed: false },
            field: Some("background.pathetic_skills".into()),
            step: Some("background".into()),
            acquisition_id: None,
            source: None,
        };
        let value = serde_json::to_value(&issue).unwrap();
        assert_eq!(value["severity"], "error", "flatten must put ValidationIssue's fields at the top level, additively");
        assert_eq!(value["code"], "X");
        assert_eq!(value["field"], "background.pathetic_skills");
        assert!(value.get("acquisition_id").is_none(), "absent optional fields must not serialize as null noise");
    }
}
