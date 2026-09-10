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

use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use super::datasets::{SkillEdgeCatalogEntry, TrainerBuildRules};
use super::modifier::{Modifier, Operation};
use super::trainer_core::SkillRank;
use super::validation::{Severity, ValidationIssue};
use crate::content::repository::get_definition_by_version_id;
use crate::content::ruleset::CampaignRuleset;
use crate::content::ContentKind;
use crate::engine::respec::reallocate_resource_grant;
use crate::error::BuildError;
use crate::profile::model::{StatAllocationEntry, StatAllocationSource, TrainerCombatStat, TrainerProfile};

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
/// T13D3: `e02_content_revision` is E02's own real, installed-content-
/// aware revision (`content::context::get_content_context(...).revision`)
/// — folding it in is what "Reuse E02 resolution and include its content
/// revision in preview validity" (T13D3 handoff) actually means: an
/// authoring edit, a pack refresh, or a definition disable/re-enable all
/// change E02's revision, and now therefore this fingerprint too, so a
/// stale `base_revision` comparison catches every one of those exactly
/// the same way it already catches a `trainer_build_rules` dataset change.
pub fn compute_rules_fingerprint(content_pack_id: &str, rules: &TrainerBuildRules, e02_content_revision: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content_pack_id.as_bytes());
    hasher.update(serde_json::to_vec(rules).unwrap_or_default());
    hasher.update(e02_content_revision.as_bytes());
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

/// T13D3 contract delta (disclosed in the Worker Result, per the handoff's
/// "any change to already frozen names/semantics requires explicit
/// contract delta and review"): D1 froze this shape without `trainer_id`
/// or `manual_adjudications` — completing the opaque intent surfaced that
/// commit genuinely needs both: `trainer_id` to distinguish "create a new
/// Trainer" from "reconcile/finish this existing one" (mirroring
/// `PreviewTrainerBuildRequest`'s own field, for consistency), and
/// `manual_adjudications` because an Error-severity `BuildIssue` with
/// `override_allowed: true` has to have SOME way to actually be overridden
/// at commit time — preview alone can never publish anything.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitTrainerBuildRequest {
    #[serde(default)]
    pub trainer_id: Option<String>,
    /// Also new in this delta, mirroring `PreviewTrainerBuildRequest`'s
    /// own field — needed to load the correct `trainer_build_rules`/
    /// `trainer_progression` datasets; guessing it from the active
    /// ruleset's highest-priority pack would silently break for any
    /// ruleset whose top pack isn't the one carrying those datasets.
    pub content_pack_id: String,
    /// Discarded (best-effort — a failure to discard never blocks a
    /// successful commit) after a successful commit. The request's own
    /// `intent` below is always authoritative; a draft's stored content is
    /// never silently substituted in.
    #[serde(default)]
    pub draft_id: Option<String>,
    pub intent: Value,
    pub expected_base_revision: String,
    #[serde(default)]
    pub manual_adjudications: Vec<Value>,
    pub confirm: bool,
    /// T13D3-R1A contract delta (disclosed): a client-generated, non-empty
    /// identity for THIS confirmed operation. Reused VERBATIM by the
    /// client on a retry of the exact same intended mutation (network
    /// retry, double-submit before a button disables); a genuinely NEW
    /// mutation must use a fresh id. This is what actually gives "one
    /// Trainer on retry" for a brand-new creation (`trainer_id: None`) —
    /// `expected_base_revision` alone cannot detect that case, since a
    /// fresh-creation candidate's base revision is a pure content/rules
    /// hash, identical across two back-to-back identical requests. See
    /// `commit_build`'s operation-replay branch.
    pub operation_id: String,
}

/// One entry of `manual_adjudications`: an explicit, GM-attributed sign-off
/// pushing past one specific overridable `BuildIssue`, matched by `code`
/// (and `field` when the issue has one) — never a blanket "ignore
/// everything" flag.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManualAdjudication {
    pub code: String,
    #[serde(default)]
    pub field: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
}

/// T13D3-R1C: an issue can be adjudicated away ONLY when it is itself
/// marked `override_allowed: true` — a supplied adjudication matching a
/// non-overridable issue's `code`/`field` (e.g. a disabled definition, a
/// missing required free Training Feature slot) must never bypass it.
/// Matching `code` (and `field`, when the issue has one) alone is
/// necessary but not sufficient; this was the confirmed disposition-gate
/// defect (§4b) — a supplied adjudication for a non-overridable Error
/// previously fell through the `commit_build` blocking filter regardless.
fn issue_is_adjudicated(issue: &BuildIssue, adjudications: &[Value]) -> bool {
    if !issue.issue.override_allowed {
        return false;
    }
    adjudications.iter().any(|raw| {
        let Ok(adj) = serde_json::from_value::<ManualAdjudication>(raw.clone()) else { return false };
        adj.code == issue.issue.code && (adj.field.is_none() || adj.field.as_deref() == issue.field.as_deref())
    })
}

#[derive(Debug, Clone, Serialize)]
pub struct TrainerBuildPreviewResponse {
    pub base_revision: String,
    pub rules_fingerprint: String,
    pub resolution: CreationResolution,
    pub core_result: super::trainer_core::TrainerCoreResult,
}

/// `Deserialize` is also needed here (unlike every other response type in
/// this module): T13D3-R1A's operation-replay branch stores this exact
/// shape as `response_json` and must read it back verbatim on a replayed
/// commit — see `record_build_operation_tx`/`load_build_operation`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainerBuildCommitResponse {
    pub trainer_id: String,
    pub base_revision: String,
    pub resolution: CreationResolution,
    pub core_result: super::trainer_core::TrainerCoreResult,
}

/// Dedicated error shape for `preview_trainer_build`/`commit_trainer_build`
/// — richer than the generic `BuildError::NotYetImplemented` every other
/// stub command still uses, since these two are no longer stubs and a
/// validation failure needs to carry the FULL issue list (matching what
/// preview's own successful response would show), not just one message.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind")]
pub enum TrainerBuildError {
    InvalidIntent { message: String },
    StaleRevision { message: String },
    ConfirmationRequired { message: String },
    ValidationFailed { issues: Vec<BuildIssue> },
    NotFound { message: String },
    Internal { message: String },
    /// T13D3-R1A: `operation_id` matches a stored receipt, but the
    /// canonical semantic request (target/content_pack_id/draft_id/
    /// intent/adjudications/expected revision) differs from what that
    /// receipt recorded — a genuinely different mutation reusing an
    /// `operation_id`, never silently replayed or re-applied.
    OperationConflict { message: String },
    /// T13D3-R1A: `operation_id` matches a stored receipt whose recorded
    /// `trainer_id` no longer resolves to an existing Trainer (deleted
    /// since the original commit) — replay never creates a "replacement"
    /// Trainer under the same operation identity.
    CommittedTargetMissing { message: String },
    /// T13D3-R1A (P3): `content_pack_id` names a dataset pack that is not
    /// an enabled pack in the active ruleset — a definition pin does not
    /// implicitly activate the whole pack's datasets.
    PackNotActive { message: String },
}

impl std::fmt::Display for TrainerBuildError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TrainerBuildError::InvalidIntent { message }
            | TrainerBuildError::StaleRevision { message }
            | TrainerBuildError::ConfirmationRequired { message }
            | TrainerBuildError::NotFound { message }
            | TrainerBuildError::OperationConflict { message }
            | TrainerBuildError::CommittedTargetMissing { message }
            | TrainerBuildError::PackNotActive { message }
            | TrainerBuildError::Internal { message } => write!(f, "{message}"),
            TrainerBuildError::ValidationFailed { issues } => write!(f, "{} validation issue(s)", issues.len()),
        }
    }
}
impl std::error::Error for TrainerBuildError {}

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
    /// T13D4 contract delta (disclosed): required only when `next_level`
    /// is 5 (the offensive-stat-stream's own first choice point) AND
    /// `milestone_option_id == Some("stat_stream")` — locks Attack or
    /// Special Attack for the WHOLE stream (L5/10/20/30/40 all reuse this
    /// same choice; Core p19 never lets it change mid-stream). Ignored at
    /// every other level/option.
    #[serde(default)]
    pub stat_stream_choice: Option<String>,
    /// T13D4 contract delta (disclosed): same mechanism/semantics as
    /// `CommitTrainerBuildRequest.manual_adjudications` — an advancement
    /// acquisition can hit the same `manual_review_required`/
    /// `prerequisite_not_met` overridable issues a creation acquisition
    /// can (both go through the identical prerequisite-AST evaluator);
    /// present here too so a re-preview after adjudication can show the
    /// issue actually cleared before commit.
    #[serde(default)]
    pub manual_adjudications: Vec<Value>,
}

/// T13D4 contract delta (disclosed): `content_pack_id` (to load the same
/// `trainer_progression`/`trainer_milestones`/`trainer_build_rules`
/// datasets `preview_trainer_advancement` already requires) and
/// `operation_id` (T13D3-R1A's own retry-safety mechanism, reused here —
/// "reuse accepted persistence/revision patterns, not a second receipt
/// framework") were both missing from D1's original frozen shape; neither
/// existed in a form that let `commit_trainer_advancement` actually load
/// content or be retry-safe.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitTrainerAdvancementRequest {
    pub trainer_id: String,
    pub content_pack_id: String,
    pub expected_base_revision: String,
    pub next_level: i64,
    #[serde(default)]
    pub milestone_option_id: Option<String>,
    #[serde(default)]
    pub acquired_choices: Vec<Value>,
    #[serde(default)]
    pub stat_stream_choice: Option<String>,
    #[serde(default)]
    pub manual_adjudications: Vec<Value>,
    pub confirm: bool,
    pub operation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewTrainerGmChangeRequest {
    pub trainer_id: String,
    /// T13D4 contract delta (disclosed): needed for the same
    /// `base_revision`/`rules_fingerprint` scheme every other Trainer
    /// command family already shares — a GM-change preview/commit must
    /// detect staleness against the exact same content/rules state a
    /// concurrent build/advancement/respec would.
    pub content_pack_id: String,
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
    pub content_pack_id: String,
    pub expected_base_revision: String,
    pub action: String,
    pub grant_kind: String,
    pub payload: Value,
    #[serde(default)]
    pub note: Option<String>,
    pub confirm: bool,
    pub operation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewTrainerRespecRequest {
    pub trainer_id: String,
    pub content_pack_id: String,
    pub expected_base_revision: String,
    pub proposed_normal_rebuild: Value,
    #[serde(default)]
    pub authorized_resource_reallocations: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitTrainerRespecRequest {
    pub trainer_id: String,
    pub content_pack_id: String,
    pub expected_base_revision: String,
    pub proposed_normal_rebuild: Value,
    #[serde(default)]
    pub authorized_resource_reallocations: Vec<Value>,
    pub confirm: bool,
    pub operation_id: String,
}

/// Every not-yet-implemented command family in this module returns exactly
/// this shape of error so a caller can rely on one uniform contract rather
/// than guessing per-command wording. T13D3: `preview_trainer_build`/
/// `commit_trainer_build` no longer use this — see below. Advancement/GM-
/// change/respec (D4) still do.
pub fn not_yet_implemented(capability: &str) -> BuildError {
    BuildError::NotYetImplemented { capability: capability.to_string(), scheduled_for: "T13D4".to_string() }
}

// =======================================================================
// T13D3: level-1 creation — typed intent, validation, resolution.
//
// Source: Core pp. 12-18 (Quick-Start Steps 1-7), p. 33-34 (Skills/ranks,
// already covered by `SkillRank`/`core_rank_ordinal`), p. 52 (the eight
// Skill Edges), p. 19/56 (Elemental Connection), p. 60 (Training
// Features) — every rule below is transcribed from a page read directly
// in this task, not carried over from memory. See this module's own
// tests for the exact page-cited assertions.
// =======================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BackgroundIntent {
    pub name: String,
    #[serde(default)]
    pub story: Option<String>,
    pub adept_skill: String,
    pub novice_skill: String,
    /// Exactly 3 distinct skill ids, per Core p18 Step 2.
    pub pathetic_skills: Vec<String>,
}

/// One Edge or Feature choice, in the order the player made it — order
/// matters: Core p18 explicitly allows alternating Edge/Feature picks,
/// and a later pick can satisfy an earlier one's prerequisite (e.g.
/// picking Elemental Connection before Basic Psionics later in the same
/// list). Validated by replaying this list in order, threading state
/// forward — never validated as an unordered set.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AcquisitionIntent {
    /// `"edge"` or `"feature"`.
    pub kind: String,
    pub definition_version_id: String,
    #[serde(default)]
    pub parameters: Value,
    /// Marks the ONE free Training Feature slot (Core p18 Step 4) — at
    /// most one entry in the whole list may set this. Prerequisites are
    /// waived only for this entry; it never counts against the 4-paid-
    /// Features budget.
    #[serde(default)]
    pub is_free_training_feature: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrainerBuildCreationIntent {
    pub name: String,
    pub background: BackgroundIntent,
    #[serde(default)]
    pub acquisitions: Vec<AcquisitionIntent>,
    #[serde(default)]
    pub stat_desired_points: Vec<super::trainer_core::StatAllocationDraftEntry>,
    #[serde(default)]
    pub weight_lb: Option<i64>,
    /// Required whenever `acquisitions` includes an Elemental Connection
    /// pick; ignored otherwise. One of
    /// `trainer_build_rules.json`'s `elemental_connection.modes` keys —
    /// `"core"` or `"campaign_variant_distinct_type"`.
    #[serde(default)]
    pub elemental_connection_mode: Option<String>,
}

/// The result of validating+resolving a creation intent: what `profile.skills`/
/// `.edges`/`.features`/stat allocation WOULD become, plus every issue
/// found. Shared by preview (never persists this) and commit (persists it
/// only when no Error-severity issue survives, exactly like C1's existing
/// `save_trainer_stat_allocation` gate).
/// `Deserialize` is needed alongside `Serialize` (T13D3-R1A): nested
/// inside `TrainerBuildCommitResponse`, which a stored operation receipt
/// round-trips through JSON on replay.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreationResolution {
    /// `{"<skill_id>": {"base_rank": "novice"}, ...}` — all 17 skills,
    /// the exact shape `trainer_core::skill_rank` already reads. A
    /// compatibility PROJECTION of resolved ranks, never a second
    /// independently-editable source (plan §3.2).
    pub skills: Value,
    pub check_bonuses: HashMap<String, i64>,
    pub edges: Vec<Value>,
    pub features: Vec<Value>,
    pub stat_allocation_creation_entries: Vec<StatAllocationEntry>,
    pub elemental_connection_mode: Option<String>,
    pub paid_edges_used: i64,
    pub paid_features_used: i64,
    pub free_training_feature_used: bool,
    /// T13D3-R1B: derived Combat Stat modifiers from this Trainer's
    /// acquired Features' Core p58 `[+Stat]`-family tags — computed once
    /// here (against the trusted, source-audited fingerprint map; see
    /// `derive_feature_tag_modifiers`) and reused by both preview's and
    /// commit's stat resolution, never a second independent computation.
    /// Never written into `profile.gm_grants` — these are re-derived
    /// fresh from `edges`/`features` every time, exactly like
    /// `stat_allocation_creation_entries`.
    pub feature_tag_modifiers: Vec<Modifier>,
    pub issues: Vec<BuildIssue>,
}

impl CreationResolution {
    pub fn has_blocking_issue(&self) -> bool {
        self.issues.iter().any(|i| i.issue.severity == Severity::Error)
    }
}

fn error_issue(code: &str, message: String, field: Option<String>, override_allowed: bool) -> BuildIssue {
    BuildIssue {
        issue: ValidationIssue { severity: Severity::Error, code: code.to_string(), message, override_allowed },
        field,
        step: None,
        acquisition_id: None,
        source: None,
    }
}

/// T13D3-R1C: a required manual prerequisite BLOCKS publish until an
/// explicit, attributed adjudication overrides it — `Severity::Error`, not
/// `Warning` (a Warning never blocks `commit_build`'s filter by design, so
/// a required unsupported prerequisite would otherwise publish with zero
/// adjudication, which is exactly the confirmed T13D3 disposition-gate
/// defect this corrects). `override_allowed: true` is what makes it
/// adjudicable at all — never a blanket, unconditional pass.
fn manual_review_issue(field: Option<String>, message: String) -> BuildIssue {
    BuildIssue {
        issue: ValidationIssue { severity: Severity::Error, code: "manual_review_required".to_string(), message, override_allowed: true },
        field,
        step: None,
        acquisition_id: None,
        source: None,
    }
}

/// The `<kind>:<logical_id>@<source>` convention every `definition_version_id`
/// in this codebase follows (see `content::import`) — extracts just the
/// logical id for matching against a prerequisite AST leaf's own `"id"`.
fn logical_id_of(definition_version_id: &str) -> &str {
    definition_version_id.split(':').nth(1).and_then(|rest| rest.split('@').next()).unwrap_or(definition_version_id)
}

// -----------------------------------------------------------------------
// Background (Core p13/18/33-34)
// -----------------------------------------------------------------------

fn validate_background(background: &BackgroundIntent, rules: &TrainerBuildRules) -> (Value, Vec<BuildIssue>) {
    let mut issues = Vec::new();
    let all_skill_ids: Vec<&str> = rules
        .skills
        .groups
        .body
        .iter()
        .chain(&rules.skills.groups.mind)
        .chain(&rules.skills.groups.spirit)
        .map(|s| s.id.as_str())
        .collect();

    fn check_id(issues: &mut Vec<BuildIssue>, all_skill_ids: &[&str], field: &str, id: &str) {
        if !all_skill_ids.contains(&id) {
            issues.push(error_issue("background_unknown_skill", format!("\"{id}\" is not one of the 17 Core skills."), Some(field.to_string()), false));
        }
    }
    check_id(&mut issues, &all_skill_ids, "background.adept_skill", &background.adept_skill);
    check_id(&mut issues, &all_skill_ids, "background.novice_skill", &background.novice_skill);
    if background.pathetic_skills.len() != rules.background.pathetic_skill_count as usize {
        issues.push(error_issue(
            "background_pathetic_count_invalid",
            format!("Background requires exactly {} distinct Pathetic skills (Core p18); got {}.", rules.background.pathetic_skill_count, background.pathetic_skills.len()),
            Some("background.pathetic_skills".to_string()),
            true,
        ));
    }
    for p in &background.pathetic_skills {
        check_id(&mut issues, &all_skill_ids, "background.pathetic_skills", p);
    }

    let mut named = vec![background.adept_skill.clone(), background.novice_skill.clone()];
    named.extend(background.pathetic_skills.iter().cloned());
    let distinct: HashSet<&String> = named.iter().collect();
    if distinct.len() != named.len() {
        issues.push(error_issue(
            "background_skills_not_distinct",
            "Adept, Novice, and every Pathetic skill must all be different skills (Core p18).".to_string(),
            Some("background".to_string()),
            true,
        ));
    }

    let mut skills = serde_json::Map::new();
    for id in &all_skill_ids {
        let rank = if *id == background.adept_skill {
            "adept"
        } else if *id == background.novice_skill {
            "novice"
        } else if background.pathetic_skills.iter().any(|p| p == id) {
            "pathetic"
        } else {
            "untrained"
        };
        skills.insert(id.to_string(), serde_json::json!({ "base_rank": rank }));
    }

    (Value::Object(skills), issues)
}

// -----------------------------------------------------------------------
// Prerequisite AST evaluation (seed `prerequisite_semantics.ast` shape;
// §3.1: "implement relevant leaves ... logical all/any; unknown leaves
// remain explicit").
// -----------------------------------------------------------------------

struct AcquiredState<'a> {
    /// Edge/Feature Values acquired so far in this creation pass, in
    /// order — each carries at least `definition_version_id`/`parameters`.
    acquired: &'a [Value],
    skills: &'a Value,
    /// Always 1 for creation (T13D3 scope); kept as a parameter rather
    /// than hardcoded so this evaluator is reusable by D4 advancement.
    level: i64,
}

enum PrereqEval {
    Met,
    NotMet(String),
    ManualReview(String),
}

fn has_acquisition(state: &AcquiredState, logical_id: &str) -> bool {
    state.acquired.iter().any(|a| a.get("definition_version_id").and_then(Value::as_str).map(logical_id_of) == Some(logical_id))
}

fn has_acquisition_with_parameter(state: &AcquiredState, logical_id: &str, parameter_key_guess: &str, parameter_value: &str) -> bool {
    state.acquired.iter().any(|a| {
        a.get("definition_version_id").and_then(Value::as_str).map(logical_id_of) == Some(logical_id)
            && a.get("parameters")
                .and_then(|p| p.get(parameter_key_guess).or_else(|| p.get("type")).or_else(|| p.get("value")))
                .and_then(Value::as_str)
                .map(|v| v.eq_ignore_ascii_case(parameter_value))
                .unwrap_or(false)
    })
}

fn evaluate_prerequisite_ast(ast: &Value, state: &AcquiredState) -> PrereqEval {
    let op = ast.get("op").and_then(Value::as_str).unwrap_or("");
    match op {
        "all" => {
            let children = ast.get("children").and_then(Value::as_array).cloned().unwrap_or_default();
            let mut manual: Option<String> = None;
            for child in &children {
                match evaluate_prerequisite_ast(child, state) {
                    PrereqEval::Met => {}
                    PrereqEval::NotMet(reason) => return PrereqEval::NotMet(reason),
                    PrereqEval::ManualReview(reason) => manual = Some(reason),
                }
            }
            manual.map(PrereqEval::ManualReview).unwrap_or(PrereqEval::Met)
        }
        "any" => {
            let children = ast.get("children").and_then(Value::as_array).cloned().unwrap_or_default();
            let mut manual: Option<String> = None;
            for child in &children {
                match evaluate_prerequisite_ast(child, state) {
                    PrereqEval::Met => return PrereqEval::Met,
                    PrereqEval::NotMet(_) => {}
                    PrereqEval::ManualReview(reason) => manual = Some(reason),
                }
            }
            manual.map(PrereqEval::ManualReview).unwrap_or_else(|| PrereqEval::NotMet(ast.get("raw").and_then(Value::as_str).unwrap_or("no alternative satisfied").to_string()))
        }
        "leaf" => evaluate_prerequisite_leaf(ast, state),
        _ => PrereqEval::ManualReview(format!("unrecognized prerequisite AST node (op={op:?})")),
    }
}

fn evaluate_prerequisite_leaf(leaf: &Value, state: &AcquiredState) -> PrereqEval {
    let kind = leaf.get("kind").and_then(Value::as_str).unwrap_or("");
    let raw = leaf.get("raw").and_then(Value::as_str).unwrap_or("").to_string();
    match kind {
        "none" => PrereqEval::Met,
        "level_min" => {
            let required = leaf.get("value").and_then(Value::as_i64).unwrap_or(i64::MAX);
            if state.level >= required {
                PrereqEval::Met
            } else {
                PrereqEval::NotMet(format!("requires level {required}, Trainer is level {}", state.level))
            }
        }
        "skill_rank_min" => {
            let Some(skill_id) = leaf.get("skill").and_then(Value::as_str) else {
                return PrereqEval::ManualReview(format!("skill_rank_min leaf missing a skill id ({raw})"));
            };
            let Some(rank_name) = leaf.get("rank").and_then(Value::as_str) else {
                return PrereqEval::ManualReview(format!("skill_rank_min leaf missing a rank ({raw})"));
            };
            let Some(required) = core_rank_ordinal(rank_name) else {
                return PrereqEval::ManualReview(format!("skill_rank_min leaf has an unrecognized rank {rank_name:?} ({raw})"));
            };
            let current = crate::engine::trainer_core::skill_rank(state.skills, skill_id);
            if current.ordinal() >= required {
                PrereqEval::Met
            } else {
                PrereqEval::NotMet(format!("requires {rank_name} {skill_id} or higher ({raw})"))
            }
        }
        "skill_group_rank_min" => {
            let group = leaf.get("skill_group").and_then(Value::as_str).unwrap_or("");
            let normalized = group.to_ascii_lowercase();
            if !matches!(normalized.as_str(), "body" | "mind" | "spirit") {
                return PrereqEval::ManualReview(format!("skill_group_rank_min with a non-category group {group:?} needs manual adjudication ({raw})"));
            }
            PrereqEval::ManualReview(format!("skill_group_rank_min ({raw}) is not yet auto-evaluated for category groups"))
        }
        "has_edge" | "has_feature" => {
            // Seed extraction sometimes mislabels edge/feature; both are
            // treated identically (checked by logical id against every
            // acquisition regardless of its own kind) rather than risk a
            // false rejection from a known data-quality quirk.
            let Some(id) = leaf.get("id").and_then(Value::as_str) else {
                return PrereqEval::ManualReview(format!("{kind} leaf missing an id ({raw})"));
            };
            if has_acquisition(state, id) {
                PrereqEval::Met
            } else {
                PrereqEval::NotMet(format!("requires {raw}"))
            }
        }
        "has_edge_or_feature_parameter" => {
            let (Some(id), Some(parameter)) = (leaf.get("name").and_then(Value::as_str).map(|n| n.to_ascii_lowercase().replace(' ', "-")), leaf.get("parameter").and_then(Value::as_str)) else {
                return PrereqEval::ManualReview(format!("has_edge_or_feature_parameter leaf missing name/parameter ({raw})"));
            };
            if has_acquisition_with_parameter(state, &id, "type", parameter) {
                PrereqEval::Met
            } else {
                PrereqEval::NotMet(format!("requires {raw}"))
            }
        }
        _ => PrereqEval::ManualReview(format!("prerequisite kind {kind:?} is not yet auto-evaluated ({raw})")),
    }
}

/// Checks a non-Skill-Edge acquisition's real seed `prerequisite_semantics`
/// (read straight from its `data_json`, never re-typed by hand) against
/// the Trainer's state so far. `waive` is true only for the one free
/// Training Feature slot (Core p18: "You do not need to meet prerequisites
/// for the Training Feature you chose").
fn check_definition_prerequisites(record_data_json: &str, state: &AcquiredState, waive: bool) -> Option<PrereqEval> {
    if waive {
        return None;
    }
    let record: Value = serde_json::from_str(record_data_json).ok()?;
    let ast = record.get("prerequisite_semantics")?.get("ast")?;
    Some(evaluate_prerequisite_ast(ast, state))
}

// -----------------------------------------------------------------------
// The eight Skill Edges (Core p52) — one dispatch per policy id from
// `trainer_build_rules.json`'s `skill_edges.entries`.
// -----------------------------------------------------------------------

struct SkillEdgeOutcome {
    /// New skill-map value after this pick (only rank-affecting policies
    /// change it); `None` means unchanged.
    new_skill_rank: Option<(String, &'static str)>,
    check_bonus: Vec<(String, i64)>,
    issues: Vec<BuildIssue>,
}

fn apply_skill_edge(
    policy: &SkillEdgeCatalogEntry,
    parameters: &Value,
    skills: &Value,
    level: i64,
    locked_skill_ids: &[String],
    field: &str,
    used_skill_enhancement: &HashSet<String>,
    used_skill_stunt: &HashSet<(String, String)>,
    used_virtuoso: &HashSet<String>,
    seen_categoric_inclination: bool,
) -> SkillEdgeOutcome {
    let mut issues = Vec::new();
    let target_skill = parameters.get("skill").and_then(Value::as_str).map(str::to_string);

    let current_rank_of = |skill_id: &str| crate::engine::trainer_core::skill_rank(skills, skill_id);

    match policy.id.as_str() {
        "basic-skills" => {
            let Some(skill_id) = target_skill else {
                return SkillEdgeOutcome { new_skill_rank: None, check_bonus: vec![], issues: vec![error_issue("basic_skills_missing_skill", "Basic Skills requires a target skill.".to_string(), Some(field.to_string()), false)] };
            };
            if locked_skill_ids.contains(&skill_id) {
                issues.push(error_issue("background_locked_skill", format!("\"{skill_id}\" was lowered to Pathetic by Background and cannot be Ranked Up during creation (Core p18)."), Some(field.to_string()), true));
            }
            let current = current_rank_of(&skill_id);
            // Core p52: "Rank Up a Skill from Pathetic to Untrained, or
            // Untrained to Novice" — those two transitions only.
            let target = match current {
                SkillRank::Pathetic => "untrained",
                SkillRank::Untrained => "novice",
                _ => {
                    issues.push(error_issue(
                        "basic_skills_illegal_step",
                        format!("Basic Skills can only Rank Up a skill from Pathetic to Untrained or Untrained to Novice; \"{skill_id}\" is already {current:?}."),
                        Some(field.to_string()),
                        true,
                    ));
                    return SkillEdgeOutcome { new_skill_rank: None, check_bonus: vec![], issues };
                }
            };
            SkillEdgeOutcome { new_skill_rank: Some((skill_id, target)), check_bonus: vec![], issues }
        }
        "adept-skills" | "expert-skills" | "master-skills" => {
            let Some(skill_id) = target_skill else {
                return SkillEdgeOutcome { new_skill_rank: None, check_bonus: vec![], issues: vec![error_issue("skill_edge_missing_skill", format!("{} requires a target skill.", policy.name), Some(field.to_string()), false)] };
            };
            let target_rank = policy.target_rank.as_deref().unwrap_or("");
            let target_ordinal = core_rank_ordinal(target_rank).unwrap_or(0);
            let requires_level = policy.requires_level.unwrap_or(0);
            if locked_skill_ids.contains(&skill_id) {
                issues.push(error_issue("background_locked_skill", format!("\"{skill_id}\" was lowered to Pathetic by Background and cannot be Ranked Up during creation (Core p18)."), Some(field.to_string()), true));
            }
            if level < requires_level {
                issues.push(error_issue(
                    "skill_edge_level_unmet",
                    format!("{} requires level {requires_level}; Trainer is level {level} (Core p18/34).", policy.name),
                    Some(field.to_string()),
                    true,
                ));
            }
            let current = current_rank_of(&skill_id);
            if current.ordinal() != target_ordinal - 1 {
                issues.push(error_issue(
                    "skill_edge_wrong_preceding_rank",
                    format!("{} Ranks Up a skill from {} to {target_rank}; \"{skill_id}\" is currently {current:?}.", policy.name, policy.requires_preceding_rank.as_deref().unwrap_or("the preceding rank")),
                    Some(field.to_string()),
                    true,
                ));
            }
            if !issues.is_empty() {
                return SkillEdgeOutcome { new_skill_rank: None, check_bonus: vec![], issues };
            }
            let target_static: &'static str = match target_rank {
                "adept" => "adept",
                "expert" => "expert",
                "master" => "master",
                _ => "untrained",
            };
            SkillEdgeOutcome { new_skill_rank: Some((skill_id, target_static)), check_bonus: vec![], issues }
        }
        "skill-enhancement" => {
            let skills_param: Vec<String> = parameters.get("skills").and_then(Value::as_array).map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect()).unwrap_or_default();
            if skills_param.len() != 2 || skills_param[0] == skills_param[1] {
                return SkillEdgeOutcome { new_skill_rank: None, check_bonus: vec![], issues: vec![error_issue("skill_enhancement_needs_two_distinct_skills", "Skill Enhancement requires two different skills (Core p52).".to_string(), Some(field.to_string()), false)] };
            }
            let mut bonus = Vec::new();
            for s in &skills_param {
                if used_skill_enhancement.contains(s) {
                    issues.push(error_issue("skill_enhancement_repeat", format!("\"{s}\" already received a Skill Enhancement bonus; the bonus may be applied only once per skill (Core p52)."), Some(field.to_string()), true));
                } else {
                    bonus.push((s.clone(), policy.check_bonus.unwrap_or(2)));
                }
            }
            SkillEdgeOutcome { new_skill_rank: None, check_bonus: bonus, issues }
        }
        "categoric-inclination" => {
            let category = parameters.get("category").and_then(Value::as_str).unwrap_or("");
            if !policy.categories.iter().any(|c| c == category) {
                return SkillEdgeOutcome { new_skill_rank: None, check_bonus: vec![], issues: vec![error_issue("categoric_inclination_unknown_category", format!("\"{category}\" is not Body, Mind, or Spirit."), Some(field.to_string()), false)] };
            }
            if seen_categoric_inclination {
                issues.push(error_issue("categoric_inclination_not_repeatable", "Categoric Inclination may not be taken more than once (Core p52).".to_string(), Some(field.to_string()), true));
            }
            SkillEdgeOutcome { new_skill_rank: None, check_bonus: vec![], issues }
        }
        "skill-stunt" => {
            let Some(skill_id) = target_skill else {
                return SkillEdgeOutcome { new_skill_rank: None, check_bonus: vec![], issues: vec![error_issue("skill_stunt_missing_skill", "Skill Stunt requires a target skill.".to_string(), Some(field.to_string()), false)] };
            };
            let circumstance = parameters.get("circumstance").and_then(Value::as_str).unwrap_or("").to_string();
            if circumstance.trim().is_empty() {
                issues.push(error_issue("skill_stunt_missing_circumstance", "Skill Stunt requires a specific circumstance (Core p52).".to_string(), Some(field.to_string()), false));
            }
            if current_rank_of(&skill_id).ordinal() < core_rank_ordinal("novice").unwrap() {
                issues.push(error_issue("skill_stunt_rank_unmet", format!("Skill Stunt requires \"{skill_id}\" at Novice Rank or higher (Core p52)."), Some(field.to_string()), true));
            }
            if used_skill_stunt.contains(&(skill_id.clone(), circumstance.clone())) {
                issues.push(error_issue("skill_stunt_repeat", "This exact skill/circumstance combination was already taken; choose a different circumstance each time (Core p52).".to_string(), Some(field.to_string()), true));
            }
            SkillEdgeOutcome { new_skill_rank: None, check_bonus: vec![], issues }
        }
        "virtuoso" => {
            let Some(skill_id) = target_skill else {
                return SkillEdgeOutcome { new_skill_rank: None, check_bonus: vec![], issues: vec![error_issue("virtuoso_missing_skill", "Virtuoso requires a target skill.".to_string(), Some(field.to_string()), false)] };
            };
            let requires_level = policy.requires_level.unwrap_or(20);
            if level < requires_level {
                issues.push(error_issue("virtuoso_level_unmet", format!("Virtuoso requires level {requires_level} (Core p52); Trainer is level {level}."), Some(field.to_string()), true));
            }
            if current_rank_of(&skill_id) != SkillRank::Master {
                issues.push(error_issue("virtuoso_rank_unmet", format!("Virtuoso requires \"{skill_id}\" at Master Rank (Core p52)."), Some(field.to_string()), true));
            }
            if used_virtuoso.contains(&skill_id) {
                issues.push(error_issue("virtuoso_repeat", "Virtuoso may be taken multiple times only on different skills (Core p52).".to_string(), Some(field.to_string()), true));
            }
            SkillEdgeOutcome { new_skill_rank: None, check_bonus: vec![], issues }
        }
        other => SkillEdgeOutcome { new_skill_rank: None, check_bonus: vec![], issues: vec![manual_review_issue(Some(field.to_string()), format!("unrecognized Skill Edge policy id {other:?}"))] },
    }
}

// -----------------------------------------------------------------------
// Main resolution: replays `intent.acquisitions` in order, threading
// skill/acquisition state forward, and validates Background/budgets/
// Elemental Connection alongside it.
// -----------------------------------------------------------------------

/// Validates and resolves a level-1 creation intent. Pure except for
/// `definitions_conn`, used only to confirm each acquisition's
/// `definition_version_id` actually exists and to read its
/// `prerequisite_semantics`/read its exact record — the SAME content E02
/// already imports/resolves, never a second copy of it. `progression` is
/// the real `trainer_progression` dataset (level 1's `stat_points_at_level`
/// is what actually caps the Creation stat pool — passing an empty slice
/// here would silently zero that pool and misclassify every desired point
/// as `LevelUp` instead of `Creation`).
#[allow(clippy::too_many_arguments)]
pub fn resolve_creation(
    definitions_conn: &Connection,
    _ruleset: &CampaignRuleset,
    rules: &TrainerBuildRules,
    intent: &TrainerBuildCreationIntent,
    progression: &[super::datasets::TrainerProgressionRow],
) -> CreationResolution {
    let (mut skills, mut issues) = validate_background(&intent.background, rules);
    let locked_skill_ids: Vec<String> = intent.background.pathetic_skills.clone();

    let skill_edge_by_dvi: HashMap<&str, &SkillEdgeCatalogEntry> = rules.skill_edges.entries.iter().map(|e| (e.definition_version_id.as_str(), e)).collect();
    let training_feature_dvis: HashSet<&str> = rules.training_features.options.iter().map(|o| o.definition_version_id.as_str()).collect();

    let mut edges: Vec<Value> = Vec::new();
    let mut features: Vec<Value> = Vec::new();
    let mut check_bonuses: HashMap<String, i64> = HashMap::new();
    let mut paid_edges_used = 0i64;
    let mut paid_features_used = 0i64;
    let mut free_training_feature_used = false;
    let mut used_skill_enhancement: HashSet<String> = HashSet::new();
    let mut used_skill_stunt: HashSet<(String, String)> = HashSet::new();
    let mut used_virtuoso: HashSet<String> = HashSet::new();
    let mut seen_categoric_inclination = false;
    let mut elemental_connection_count = 0i64;
    let mut elemental_connection_types: HashSet<String> = HashSet::new();
    let mut has_mystic_senses = false;
    let mut has_elemental_connection = false;

    for (index, acq) in intent.acquisitions.iter().enumerate() {
        let field = format!("acquisitions[{index}]");
        let kind = match acq.kind.as_str() {
            "edge" => ContentKind::Edge,
            "feature" => ContentKind::Feature,
            other => {
                issues.push(error_issue("acquisition_unknown_kind", format!("acquisitions[{index}].kind must be \"edge\" or \"feature\", got {other:?}."), Some(field.clone()), false));
                continue;
            }
        };
        let logical_id = logical_id_of(&acq.definition_version_id);

        if acq.is_free_training_feature {
            if free_training_feature_used {
                issues.push(error_issue("free_training_feature_repeat", "Only one free Training Feature slot is available (Core p18).".to_string(), Some(field.clone()), false));
                continue;
            }
            if kind != ContentKind::Feature || !training_feature_dvis.contains(acq.definition_version_id.as_str()) {
                issues.push(error_issue(
                    "free_training_feature_invalid_choice",
                    format!("\"{}\" is not one of the four Training Features (Agility/Brutal/Focused/Inspired Training, Core p60).", acq.definition_version_id),
                    Some(field.clone()),
                    false,
                ));
                continue;
            }
            free_training_feature_used = true;
        } else if kind == ContentKind::Edge {
            paid_edges_used += 1;
            if paid_edges_used > rules.creation_budget.paid_edges {
                issues.push(error_issue("edge_budget_exceeded", format!("Creation allows exactly {} paid Edges (Core p18); this is number {paid_edges_used}.", rules.creation_budget.paid_edges), Some(field.clone()), true));
            }
        } else {
            paid_features_used += 1;
            if paid_features_used > rules.creation_budget.paid_features {
                issues.push(error_issue("feature_budget_exceeded", format!("Creation allows exactly {} paid Features (Core p18); this is number {paid_features_used}.", rules.creation_budget.paid_features), Some(field.clone()), true));
            }
        }

        // Exact-version existence check — reuses E02's own storage, never
        // a second copy of content resolution.
        let Ok(Some(record)) = get_definition_by_version_id(definitions_conn, kind, &acq.definition_version_id) else {
            issues.push(error_issue("acquisition_definition_not_found", format!("\"{}\" does not exist in the active content.", acq.definition_version_id), Some(field.clone()), false));
            continue;
        };
        if !record.enabled {
            issues.push(error_issue("acquisition_definition_disabled", format!("\"{}\" is disabled and cannot be acquired.", acq.definition_version_id), Some(field.clone()), false));
        }

        let acquired_state = AcquiredState { acquired: if kind == ContentKind::Edge { &edges } else { &features }, skills: &skills, level: 1 };

        if logical_id == "elemental-connection" {
            has_elemental_connection = true;
            let elem_type = acq.parameters.get("type").and_then(Value::as_str).map(str::to_string);
            let Some(elem_type) = elem_type else {
                issues.push(error_issue("elemental_connection_missing_type", "Elemental Connection requires a chosen Type (Core p56).".to_string(), Some(field.clone()), false));
                continue;
            };
            match intent.elemental_connection_mode.as_deref() {
                Some("core") => {
                    elemental_connection_count += 1;
                    if elemental_connection_count > 1 {
                        issues.push(error_issue("elemental_connection_core_no_repeat", "Core rules do not permit taking Elemental Connection more than once (Core p56); use the explicit campaign variant to allow distinct Types.".to_string(), Some(field.clone()), true));
                    }
                }
                Some("campaign_variant_distinct_type") => {
                    if !elemental_connection_types.insert(elem_type.clone()) {
                        issues.push(error_issue("elemental_connection_variant_duplicate_type", format!("Elemental Connection ({elem_type}) was already taken; the campaign variant allows distinct Types only, never a duplicate."), Some(field.clone()), true));
                    }
                    elemental_connection_count += 1;
                }
                _ => issues.push(error_issue("elemental_connection_mode_required", "Taking Elemental Connection requires an explicit elemental_connection_mode (\"core\" or \"campaign_variant_distinct_type\").".to_string(), Some(field.clone()), false)),
            }
        } else if logical_id == "mystic-senses" {
            has_mystic_senses = true;
        }

        if !skill_edge_by_dvi.contains_key(acq.definition_version_id.as_str()) {
            match check_definition_prerequisites(&record.data_json, &acquired_state, acq.is_free_training_feature) {
                Some(PrereqEval::Met) | None => {}
                Some(PrereqEval::NotMet(reason)) => issues.push(error_issue("prerequisite_not_met", format!("\"{}\": {reason}", acq.definition_version_id), Some(field.clone()), true)),
                Some(PrereqEval::ManualReview(reason)) => issues.push(manual_review_issue(Some(field.clone()), format!("\"{}\": {reason}", acq.definition_version_id))),
            }
        }

        let mut entry = serde_json::json!({
            "definition_version_id": acq.definition_version_id,
            "parameters": acq.parameters,
            "source": if acq.is_free_training_feature { "creation" } else { "creation" },
            "level": 1,
            "sequence": index as i64,
        });

        if let Some(policy) = skill_edge_by_dvi.get(acq.definition_version_id.as_str()) {
            let outcome = apply_skill_edge(
                policy,
                &acq.parameters,
                &skills,
                1,
                &locked_skill_ids,
                &field,
                &used_skill_enhancement,
                &used_skill_stunt,
                &used_virtuoso,
                seen_categoric_inclination,
            );
            issues.extend(outcome.issues);
            if let Some((skill_id, new_rank)) = outcome.new_skill_rank {
                if let Some(obj) = skills.as_object_mut() {
                    obj.insert(skill_id, serde_json::json!({ "base_rank": new_rank }));
                }
            }
            for (skill_id, bonus) in outcome.check_bonus {
                *check_bonuses.entry(skill_id.clone()).or_insert(0) += bonus;
                used_skill_enhancement.insert(skill_id);
            }
            match policy.id.as_str() {
                "skill-stunt" => {
                    if let (Some(skill_id), Some(circumstance)) = (acq.parameters.get("skill").and_then(Value::as_str), acq.parameters.get("circumstance").and_then(Value::as_str)) {
                        used_skill_stunt.insert((skill_id.to_string(), circumstance.to_string()));
                    }
                }
                "virtuoso" => {
                    if let Some(skill_id) = acq.parameters.get("skill").and_then(Value::as_str) {
                        used_virtuoso.insert(skill_id.to_string());
                    }
                }
                "categoric-inclination" => seen_categoric_inclination = true,
                _ => {}
            }
        }

        if let Some(obj) = entry.as_object_mut() {
            obj.insert("policy_kind".to_string(), Value::String(kind.kind_slug().to_string()));
        }
        if kind == ContentKind::Edge {
            edges.push(entry);
        } else {
            features.push(entry);
        }
    }

    if has_elemental_connection && has_mystic_senses {
        issues.push(error_issue(
            "elemental_connection_mystic_senses_exclusive",
            "Elemental Connection and Mystic Senses are mutually exclusive in both orders (Core p19/56/2xx).".to_string(),
            Some("acquisitions".to_string()),
            true,
        ));
    }

    if !free_training_feature_used {
        issues.push(error_issue("free_training_feature_required", "The free Training Feature slot (Agility/Brutal/Focused/Inspired Training, Core p18/60) has not been chosen yet.".to_string(), Some("acquisitions".to_string()), false));
    }
    // T13D3-R1C: budget completeness is a required publish gate (Core p18
    // Steps 3-4: the FULL 4 paid Edges + 4 paid Features, not a partial
    // pick), so this is `Severity::Error`/non-overridable — the confirmed
    // disposition-gate defect (§4c) was that these stayed `Info`, so a
    // build with, say, only 2 of 4 paid Edges chosen (and no other
    // pending Error) would publish normally. Preview is unaffected:
    // `preview_build` never filters by severity, so an in-progress
    // (legitimately incomplete) draft still previews/saves normally —
    // only `commit_build`'s blocking filter treats this as fatal.
    if paid_edges_used < rules.creation_budget.paid_edges {
        issues.push(BuildIssue {
            issue: ValidationIssue { severity: Severity::Error, code: "edges_incomplete".to_string(), message: format!("{} of {} paid Edges chosen.", paid_edges_used, rules.creation_budget.paid_edges), override_allowed: false },
            field: Some("acquisitions".to_string()),
            step: Some("edges".to_string()),
            acquisition_id: None,
            source: None,
        });
    }
    if paid_features_used < rules.creation_budget.paid_features {
        issues.push(BuildIssue {
            issue: ValidationIssue { severity: Severity::Error, code: "features_incomplete".to_string(), message: format!("{} of {} paid Features chosen.", paid_features_used, rules.creation_budget.paid_features), override_allowed: false },
            field: Some("acquisitions".to_string()),
            step: Some("features".to_string()),
            acquisition_id: None,
            source: None,
        });
    }

    let stat_allocation_creation_entries = super::trainer_core::build_normal_allocation_entries(&intent.stat_desired_points, 1, progression);

    let (feature_tag_modifiers, feature_tag_issues) = derive_feature_tag_modifiers(definitions_conn, &features);
    issues.extend(feature_tag_issues);

    CreationResolution {
        skills,
        check_bonuses,
        edges,
        features,
        stat_allocation_creation_entries,
        elemental_connection_mode: if has_elemental_connection { intent.elemental_connection_mode.clone() } else { None },
        paid_edges_used,
        paid_features_used,
        free_training_feature_used,
        feature_tag_modifiers,
        issues,
    }
}

// =======================================================================
// T13D3-R1B: automatic source-backed Feature stat tag modifiers (Core
// p58 "Feature Tags"). The eight recognized `[+Stat]`-family tokens are
// decoded from a TRUSTED, build-time-embedded fingerprint map generated
// from the actual shipped `content_packs/ptu-core-1.05.ptucp` (audited
// 2026-09-09, T13D3-R1 disposition — Planner P2 confirmed independently
// by the Revisor against the real PDF and the real pack data: 134 Core
// Feature records with a `+Stat`-family tag; see
// `test_vectors/trainer_build/feature_stat_tags.json`'s own
// `source_citation`/`source_pack_file_sha256` fields). This is
// deliberately NOT "trust whatever `tags` says live in the DB" — a
// definition's LIVE `data_json` must hash-match the entry this table
// recorded for that exact `definition_version_id`, or no automatic
// effect is applied (an altered/homebrew/re-versioned record cannot
// masquerade as reviewed Core policy; see `derive_feature_tag_modifiers`).
// A definition simply absent from this table (the overwhelming majority
// of Features — only 134 of 435 Core Features carry a `+Stat` tag at
// all) contributes nothing, which is not an error.
// =======================================================================

#[derive(Debug, Clone, Deserialize)]
struct TrustedFeatureTagEntry {
    definition_version_id: String,
    data_json_sha256: String,
    tag_tokens: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct TrustedFeatureTagMap {
    entries: Vec<TrustedFeatureTagEntry>,
}

fn trusted_feature_tag_map() -> &'static HashMap<String, TrustedFeatureTagEntry> {
    static MAP: OnceLock<HashMap<String, TrustedFeatureTagEntry>> = OnceLock::new();
    MAP.get_or_init(|| {
        let raw = include_str!("../../../../../test_vectors/trainer_build/feature_stat_tags.json");
        let parsed: TrustedFeatureTagMap = serde_json::from_str(raw).expect("test_vectors/trainer_build/feature_stat_tags.json must be valid — checked-in build-time data");
        parsed.entries.into_iter().map(|e| (e.definition_version_id.clone(), e)).collect()
    })
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    to_hex(&hasher.finalize())
}

/// One `[+Stat]`-family Core p58 tag token, decoded into what it needs to
/// resolve: a token naming a single fixed stat needs no player choice; a
/// token offering a set of candidate stats needs an explicit
/// `parameters.stat_choice` on that specific acquisition.
enum DecodedTagToken {
    Fixed(TrainerCombatStat),
    ChoiceAmong(Vec<TrainerCombatStat>),
}

fn decode_tag_token(token: &str) -> Option<DecodedTagToken> {
    use TrainerCombatStat::*;
    match token {
        "+HP" => Some(DecodedTagToken::Fixed(Hp)),
        "+Attack" => Some(DecodedTagToken::Fixed(Attack)),
        "+Defense" => Some(DecodedTagToken::Fixed(Defense)),
        "+Special Attack" => Some(DecodedTagToken::Fixed(SpecialAttack)),
        "+Special Defense" => Some(DecodedTagToken::Fixed(SpecialDefense)),
        "+Speed" => Some(DecodedTagToken::Fixed(Speed)),
        "+Any Stat" => Some(DecodedTagToken::ChoiceAmong(vec![Hp, Attack, Defense, SpecialAttack, SpecialDefense, Speed])),
        "+Attack or Special Attack" => Some(DecodedTagToken::ChoiceAmong(vec![Attack, SpecialAttack])),
        _ => None,
    }
}

/// Computes the derived Combat Stat modifiers for every acquired Feature
/// whose `definition_version_id` is present in the trusted, source-audited
/// fingerprint map AND whose LIVE `data_json` still hashes to exactly what
/// that table recorded — plus any `BuildIssue`s from a missing/invalid
/// required `stat_choice` (which blocks publish, non-overridable, per the
/// approved R1B scope: "Missing/invalid choice blocks publish"). Each
/// `features` entry is one Feature ACQUISITION (already carrying its own
/// `acquisition_id`) — a Ranked Feature legally acquired more than once
/// naturally contributes once per acquisition, with no special-casing
/// needed here.
pub fn derive_feature_tag_modifiers(definitions_conn: &Connection, features: &[Value]) -> (Vec<Modifier>, Vec<BuildIssue>) {
    let trusted = trusted_feature_tag_map();
    let mut modifiers = Vec::new();
    let mut issues = Vec::new();

    for (index, acq) in features.iter().enumerate() {
        let Some(dvi) = acq.get("definition_version_id").and_then(Value::as_str) else { continue };
        let Some(entry) = trusted.get(dvi) else { continue };
        let acquisition_id = acq.get("acquisition_id").and_then(Value::as_str).unwrap_or(dvi);
        let field = format!("features[{index}]");

        // Defense in depth: even though content import already rejects a
        // definition content change under an unchanged
        // `definition_version_id`, never blindly trust "whatever's in the
        // live DB right now" as its own anchor — re-verify against the
        // audited fingerprint before applying any effect.
        let Ok(Some(record)) = get_definition_by_version_id(definitions_conn, ContentKind::Feature, dvi) else {
            continue; // acquisition_definition_not_found is already reported elsewhere in resolve_creation
        };
        if sha256_hex(record.data_json.as_bytes()) != entry.data_json_sha256 {
            issues.push(BuildIssue {
                issue: ValidationIssue {
                    severity: Severity::Warning,
                    code: "feature_tag_source_unverified".to_string(),
                    message: format!("\"{dvi}\" no longer matches its audited Core content — its stat tag is left unresolved rather than assumed."),
                    override_allowed: true,
                },
                field: Some(field.clone()),
                step: Some("feature_tags".to_string()),
                acquisition_id: Some(acquisition_id.to_string()),
                source: None,
            });
            continue;
        }

        for token in &entry.tag_tokens {
            let Some(decoded) = decode_tag_token(token) else { continue };
            let stat = match decoded {
                DecodedTagToken::Fixed(stat) => stat,
                DecodedTagToken::ChoiceAmong(candidates) => {
                    let chosen = acq.get("parameters").and_then(|p| p.get("stat_choice")).and_then(Value::as_str).and_then(|s| serde_json::from_value::<TrainerCombatStat>(Value::String(s.to_string())).ok());
                    match chosen {
                        Some(stat) if candidates.contains(&stat) => stat,
                        _ => {
                            issues.push(error_issue(
                                "feature_tag_stat_choice_required",
                                format!("\"{dvi}\" requires parameters.stat_choice to be one of {candidates:?} for its {token} tag."),
                                Some(field.clone()),
                                false,
                            ));
                            continue;
                        }
                    }
                }
            };
            modifiers.push(Modifier {
                id: format!("feature-tag:{acquisition_id}:{token}"),
                source_label: "Feature Tag".to_string(),
                target: super::trainer_core::stat_target_key(stat).to_string(),
                operation: Operation::Add,
                value: 1.0,
                priority: 100,
            });
        }
    }

    (modifiers, issues)
}

/// T13D3 (plan §3.2): replaces only the `creation`-sourced entries of an
/// existing acquisition list with a fresh batch, preserving every entry
/// whose `source` is anything else (missing/`legacy`/`gm_fixed`/etc.) byte
/// for byte — "unknown fields/origins stay intact" for a reconciled
/// legacy Trainer, and no other source's acquisitions are ever silently
/// dropped by a creation commit.
pub fn merge_acquisitions_preserving_other_sources(new_creation_entries: Vec<Value>, previous: &[Value]) -> Vec<Value> {
    let mut merged: Vec<Value> = previous.iter().filter(|e| e.get("source").and_then(Value::as_str) != Some("creation")).cloned().collect();
    merged.extend(new_creation_entries);
    merged
}

// =======================================================================
// T13D3 command orchestration — `commands.rs` stays a thin wrapper
// (locks connections, then calls straight in here), matching every other
// command family in this crate. `preview_build`/`commit_build` are the
// real, no-longer-stub implementations of `preview_trainer_build`/
// `commit_trainer_build`.
// =======================================================================

/// T13D3-R1A (P3): `content_pack_id` must actually be an enabled pack in
/// the active ruleset — a definition PIN elsewhere does not implicitly
/// activate a whole dataset pack. Only checked for a NEW rule execution
/// (this is the choke point `preview_build`/`commit_build` both call
/// before loading `trainer_build_rules`/`trainer_progression`); a
/// replayed operation (§ `commit_build`'s replay branch) returns its
/// stored result without ever reaching this check, matching "returning a
/// previously committed operation result is not a new rule execution."
pub fn validate_content_pack_is_active(ruleset: &CampaignRuleset, content_pack_id: &str) -> Result<(), String> {
    if ruleset.packs.iter().any(|p| p.id == content_pack_id && p.enabled) {
        Ok(())
    } else {
        Err(format!("Content pack \"{content_pack_id}\" is not an enabled pack in the active ruleset \"{}\".", ruleset.id))
    }
}

fn load_rules_and_fingerprint(definitions_conn: &Connection, ruleset: &CampaignRuleset, content_pack_id: &str, e02_content_revision: &str) -> Result<(TrainerBuildRules, String), TrainerBuildError> {
    validate_content_pack_is_active(ruleset, content_pack_id).map_err(|message| TrainerBuildError::PackNotActive { message })?;
    let rules = super::datasets::load_trainer_build_rules(definitions_conn, content_pack_id).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    let fingerprint = compute_rules_fingerprint(content_pack_id, &rules, e02_content_revision);
    Ok((rules, fingerprint))
}

/// T13D3-R1A: canonical hash of exactly the fields that define "the same
/// intended mutation" for operation-replay purposes — target/content
/// pack/draft/intent/adjudications/expected revision. Deliberately
/// excludes `confirm` (irrelevant to result identity) and `operation_id`
/// itself (that's the lookup key, not part of what it identifies).
/// T13D3-R1A's ORIGINAL, already-FINAL-ACCEPTED algorithm — restored
/// EXACTLY to its pre-T13D4 field set after T13D4-R1's confirmed BLOCKER
/// (`T13D4_BUILD_CONTRACT_REVIEW.md`): T13D4 had added a literal
/// `"operation_kind"` field to this function's hashed JSON, which
/// retroactively changed the fingerprint of every receipt created before
/// that change — breaking replay for any pre-existing
/// `trainer_build_operations` row (the accepted "one Trainer/result for
/// the same original confirmed operation after retry/restart" guarantee).
/// This function must NEVER again change what it hashes for an existing
/// field set; a new field may only be added here if D3's own commit
/// contract itself grows that field. Cross-family protection (a build
/// `operation_id` reused against an advancement/GM-change/respec commit)
/// is achieved WITHOUT touching this function — see
/// `compute_operation_request_fingerprint_generic` below, whose hashed
/// shape differs from this one by construction (different field sets
/// entirely, plus an explicit `operation_kind`), so a cross-family reuse
/// fingerprint-mismatches and rejects `OperationConflict` on its own.
fn compute_operation_request_fingerprint(request: &CommitTrainerBuildRequest) -> String {
    let relevant = serde_json::json!({
        "trainer_id": request.trainer_id,
        "content_pack_id": request.content_pack_id,
        "draft_id": request.draft_id,
        "intent": request.intent,
        "expected_base_revision": request.expected_base_revision,
        "manual_adjudications": request.manual_adjudications,
    });
    let mut hasher = Sha256::new();
    hasher.update(serde_json::to_vec(&relevant).unwrap_or_default());
    to_hex(&hasher.finalize())
}

/// T13D4: used ONLY by the three new D4 families (advancement/GM-change/
/// respec) below — never by `compute_operation_request_fingerprint`
/// (build), which keeps its own separately-frozen algorithm (see its own
/// doc comment for why). These three families have no pre-D4 accepted
/// receipts to protect, so embedding a literal `operation_kind` in their
/// hashed JSON is safe here and is deliberate, explicit protection (not
/// merely incidental): "if receipts are shared across command families,
/// operation identity must distinguish semantic operation types and
/// cannot replay a creation response as an advancement response" — even
/// though each family (including build) already hashes a materially
/// different field set on its own (making an accidental cross-family hash
/// collision astronomically unlikely regardless), this makes the
/// guarantee intentional rather than a side effect of differing shapes.
fn compute_operation_request_fingerprint_generic(relevant: Value) -> String {
    let mut hasher = Sha256::new();
    hasher.update(serde_json::to_vec(&relevant).unwrap_or_default());
    to_hex(&hasher.finalize())
}

fn parse_intent(intent: &Value) -> Result<TrainerBuildCreationIntent, TrainerBuildError> {
    serde_json::from_value(intent.clone()).map_err(|e| TrainerBuildError::InvalidIntent { message: format!("intent does not match the expected creation shape: {e}") })
}

/// `existing_profile: None` and `trainer_id: None` together mean "brand
/// new creation candidate" — this D3 flow is level-1-creation ONLY (Core
/// pp12-18's nine Quick-Start Steps 1-7); reconciling a legacy Trainer
/// already past level 1 needs a different flow this task does not
/// implement (its Edge/Feature/Skill totals no longer match the fixed
/// level-1 budget this function enforces) — such a Trainer is rejected
/// explicitly rather than silently mis-validated against the wrong rules.
fn require_level_one_or_new(existing_profile: &Option<TrainerProfile>) -> Result<(), TrainerBuildError> {
    if let Some(p) = existing_profile {
        if p.level != 1 {
            return Err(TrainerBuildError::Internal {
                message: format!(
                    "Trainer \"{}\" is level {} — this build flow validates level-1 creation (Core pp12-18 Steps 1-7) only; reconciling a higher-level legacy Trainer is out of T13D3's scope.",
                    p.id, p.level
                ),
            });
        }
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn preview_build(
    definitions_conn: &Connection,
    profiles_conn: &Connection,
    ruleset: &CampaignRuleset,
    e02_content_revision: &str,
    request: &PreviewTrainerBuildRequest,
) -> Result<TrainerBuildPreviewResponse, TrainerBuildError> {
    let (rules, rules_fingerprint) = load_rules_and_fingerprint(definitions_conn, ruleset, &request.content_pack_id, e02_content_revision)?;

    let existing_profile = match &request.trainer_id {
        Some(id) => crate::profile::repository::load_trainer_profile(profiles_conn, id).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?,
        None => None,
    };
    require_level_one_or_new(&existing_profile)?;

    let current_base_revision = existing_profile.as_ref().map(|p| compute_base_revision(p, &rules_fingerprint)).unwrap_or_else(|| rules_fingerprint.clone());
    if let Some(expected) = &request.base_revision {
        if expected != &current_base_revision {
            return Err(TrainerBuildError::StaleRevision { message: "Content context changed".to_string() });
        }
    }

    let progression = super::datasets::load_trainer_progression(definitions_conn, &request.content_pack_id).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    let intent = parse_intent(&request.intent)?;
    let resolution = resolve_creation(definitions_conn, ruleset, &rules, &intent, &progression);
    let core_result = resolve_preview_core_stats(&progression, &existing_profile, &resolution, &intent)?;

    Ok(TrainerBuildPreviewResponse { base_revision: current_base_revision, rules_fingerprint, resolution, core_result })
}

fn resolve_preview_core_stats(
    progression: &[super::datasets::TrainerProgressionRow],
    existing_profile: &Option<TrainerProfile>,
    resolution: &CreationResolution,
    intent: &TrainerBuildCreationIntent,
) -> Result<super::trainer_core::TrainerCoreResult, TrainerBuildError> {
    let previous_allocation = existing_profile.as_ref().map(|p| p.stat_allocation.clone()).unwrap_or_default();
    let merged_allocation = super::trainer_core::merge_with_preserved_provenance(resolution.stat_allocation_creation_entries.clone(), &previous_allocation);
    let gm_grants: Vec<Value> = existing_profile.as_ref().map(|p| p.gm_grants.clone()).unwrap_or_default();
    let weight_lb = intent.weight_lb.or_else(|| existing_profile.as_ref().and_then(|p| p.weight_lb));
    Ok(super::trainer_core::resolve_trainer_core(1, &merged_allocation, &resolution.skills, weight_lb, &gm_grants, &progression, &resolution.feature_tag_modifiers))
}

/// Commit-time equivalent of [`preview_build`]: reloads the owner and
/// recomputes/rechecks the revision itself — never trusts a client-side
/// "it was valid a moment ago" — then writes ONLY the build-owned fields
/// (name/background/skills/creation-sourced edges+features/creation-
/// sourced stat allocation/weight/build_state) via the existing atomic
/// `save_trainer_profile`, leaving everything else (Pokémon/rosters/
/// inventory/media/GM grants/Milestone+GmOverride stat entries/non-
/// creation acquisitions) byte-for-byte untouched. This whole function
/// runs while `commands.rs` holds `AppState.profiles`'s Mutex, so the
/// read-then-write here is not racing any other command in this single-
/// process app.
#[allow(clippy::too_many_arguments)]
pub fn commit_build(
    definitions_conn: &Connection,
    profiles_conn: &mut Connection,
    ruleset: &CampaignRuleset,
    e02_content_revision: &str,
    request: &CommitTrainerBuildRequest,
) -> Result<TrainerBuildCommitResponse, TrainerBuildError> {
    if !request.confirm {
        return Err(TrainerBuildError::ConfirmationRequired { message: "confirm must be true to publish a Trainer build".to_string() });
    }
    if request.operation_id.trim().is_empty() {
        return Err(TrainerBuildError::InvalidIntent { message: "operation_id must not be empty".to_string() });
    }

    // ---- Structural/confirmation validation (T13D3-R1A: happens BEFORE
    // the operation-replay check below, per the approved disposition). ----
    let existing_profile = match &request.trainer_id {
        Some(id) => crate::profile::repository::load_trainer_profile(profiles_conn, id).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?,
        None => None,
    };
    if request.trainer_id.is_some() && existing_profile.is_none() {
        return Err(TrainerBuildError::NotFound { message: format!("Trainer \"{}\" not found", request.trainer_id.as_deref().unwrap_or_default()) });
    }
    require_level_one_or_new(&existing_profile)?;

    // ---- T13D3-R1A: operation replay check — before the current-content
    // staleness check, and before any new rule execution (so a replay
    // never re-validates `content_pack_id` against the active ruleset
    // either; "returning a previously committed operation result is not a
    // new rule execution"). ----
    let request_fingerprint = compute_operation_request_fingerprint(request);
    if let Some(receipt) = crate::profile::repository::load_build_operation(profiles_conn, &request.operation_id).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })? {
        if receipt.request_fingerprint != request_fingerprint {
            return Err(TrainerBuildError::OperationConflict {
                message: format!("operation_id \"{}\" was already used for a different request; use a new operation_id for a new mutation.", request.operation_id),
            });
        }
        if crate::profile::repository::load_trainer_profile(profiles_conn, &receipt.trainer_id).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?.is_none() {
            return Err(TrainerBuildError::CommittedTargetMissing {
                message: format!("operation_id \"{}\" previously committed Trainer \"{}\", which no longer exists.", request.operation_id, receipt.trainer_id),
            });
        }
        let response: TrainerBuildCommitResponse = serde_json::from_str(&receipt.response_json).map_err(|e| TrainerBuildError::Internal { message: format!("stored operation receipt is corrupt: {e}") })?;
        return Ok(response);
    }

    // ---- New operation: perform all current source/base/owner checks
    // exactly as before (this is the choke point that also validates
    // `content_pack_id` is an enabled pack — see `load_rules_and_fingerprint`). ----
    let (rules, rules_fingerprint) = load_rules_and_fingerprint(definitions_conn, ruleset, &request.content_pack_id, e02_content_revision)?;

    let current_base_revision = existing_profile.as_ref().map(|p| compute_base_revision(p, &rules_fingerprint)).unwrap_or_else(|| rules_fingerprint.clone());
    if request.expected_base_revision != current_base_revision {
        return Err(TrainerBuildError::StaleRevision { message: "Content context changed".to_string() });
    }

    let progression = super::datasets::load_trainer_progression(definitions_conn, &request.content_pack_id).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    let intent = parse_intent(&request.intent)?;
    let resolution = resolve_creation(definitions_conn, ruleset, &rules, &intent, &progression);
    let blocking: Vec<BuildIssue> = resolution
        .issues
        .iter()
        .filter(|i| i.issue.severity == Severity::Error && !issue_is_adjudicated(i, &request.manual_adjudications))
        .cloned()
        .collect();
    if !blocking.is_empty() {
        // No receipt is ever written on this path — an invalid publish
        // never consumes a successful operation identity (T13D3-R1C
        // acceptance criterion, verified together with R1A).
        return Err(TrainerBuildError::ValidationFailed { issues: blocking });
    }

    let mut profile = existing_profile.clone().unwrap_or_else(|| TrainerProfile {
        id: crate::profile::repository::new_id(),
        level: 1,
        exp: 0,
        money: 0,
        ..TrainerProfile::default()
    });
    profile.name = intent.name.clone();
    profile.skills = resolution.skills.clone();
    profile.edges = merge_acquisitions_preserving_other_sources(resolution.edges.clone(), &profile.edges);
    profile.features = merge_acquisitions_preserving_other_sources(resolution.features.clone(), &profile.features);
    profile.stat_allocation = super::trainer_core::merge_with_preserved_provenance(resolution.stat_allocation_creation_entries.clone(), &profile.stat_allocation);
    if let Some(w) = intent.weight_lb {
        profile.weight_lb = Some(w);
    }
    profile.build_state = Some(
        serde_json::to_value(BuildState {
            status: BuildStatus::Published,
            elemental_connection_mode: resolution.elemental_connection_mode.clone(),
            // Steps 8-9 (starter Pokémon, starting items — Core p17/18)
            // are GM decisions this task does not implement; never
            // silently marked ready.
            campaign_setup_pending: true,
            narrative: intent.background.story.clone().map(Value::String),
        })
        .unwrap_or(Value::Null),
    );

    let core_result = resolve_preview_core_stats(&progression, &Some(profile.clone()), &resolution, &intent)?;
    let new_base_revision = compute_base_revision(&profile, &rules_fingerprint);
    let response = TrainerBuildCommitResponse { trainer_id: profile.id.clone(), base_revision: new_base_revision, resolution, core_result };
    let response_json = serde_json::to_string(&response).map_err(|e| TrainerBuildError::Internal { message: format!("failed to serialize operation response: {e}") })?;

    // ---- T13D3-R1A: the Trainer write and its operation receipt commit
    // atomically — ONE transaction, both writes, one commit. On any error
    // from either, nothing is written (rollback on drop). The revision
    // check above and this write both run while `commands.rs` holds
    // `AppState.profiles`'s single Mutex for this whole command, so no
    // other command can interleave a write between the two in this
    // single-process app. ----
    let tx = profiles_conn.transaction().map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    crate::profile::repository::save_trainer_profile_tx(&tx, &profile).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    crate::profile::repository::record_build_operation_tx(&tx, &request.operation_id, &request_fingerprint, &profile.id, &response_json).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    tx.commit().map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;

    // Draft cleanup: best-effort, explicitly outside the atomic
    // transaction above — a failure to discard never reapplies anything
    // (the draft merely lingers, itself still safely discardable later),
    // so it does not need to participate in the same commit-or-rollback
    // boundary as the Trainer write + receipt.
    if let Some(draft_id) = &request.draft_id {
        let _ = crate::profile::repository::discard_trainer_build_draft(profiles_conn, draft_id);
    }

    Ok(response)
}

// =======================================================================
// T13D4 — advancement, GM grant changes, respec (Core pp17-20; plan
// §3.1-3.4, §7 T13D4). Reuses D3's prerequisite-AST evaluator
// (`evaluate_prerequisite_ast`/`check_definition_prerequisites`), Skill
// Edge policy dispatcher (`apply_skill_edge`), operation-receipt/replay
// mechanism (R1A) and publication-gate severity rules (R1C) — no second
// engine, no second receipt framework, no new migration (every new field
// below lives inside an already-JSON column: `trainer_progression.data_json`
// via `ProgressionLedgerEntry`'s new optional fields, or a fresh
// `AcquisitionSource`/`gm_grants` entry — both already-typed D1 concepts
// this task is the first to actually populate).
// =======================================================================

// -----------------------------------------------------------------------
// Shared helpers reused by all three D4 command families.
// -----------------------------------------------------------------------

/// T13D4: a Feature whose seed record has no `parent_class` is a Core
/// "General Feature" (verified directly against the shipped pack: exactly
/// 40 of 435 Core Features have `parent_class: null`, none tagged
/// `"Class"` — e.g. the four free Training Features, the Orders/Stratagem
/// command Features, `let-me-help-you-with-that`; every OTHER Feature's
/// `parent_class` names the specific Class it belongs to, e.g.
/// `"Ace Trainer"`). This is the qualification the L5/30/40 offensive
/// stream alternatives require ("one qualified General Feature").
fn is_general_feature(record_data_json: &str) -> bool {
    serde_json::from_str::<Value>(record_data_json).ok().map(|v| v.get("parent_class").map(Value::is_null).unwrap_or(true)).unwrap_or(false)
}

/// Reconstructs the three Skill-Edge repeat-tracking sets from a Trainer's
/// EXISTING edges (not just picks made in this session) — the same
/// bookkeeping `resolve_creation`'s own loop keeps for a fresh creation,
/// generalized here to work from already-persisted acquisitions so
/// `apply_skill_edge` behaves identically whether a Skill Edge was picked
/// at creation or at a later advancement.
fn scan_existing_skill_edge_usage(existing_edges: &[Value], skill_edge_by_dvi: &HashMap<&str, &SkillEdgeCatalogEntry>) -> (HashSet<String>, HashSet<(String, String)>, HashSet<String>, bool) {
    let mut used_skill_enhancement = HashSet::new();
    let mut used_skill_stunt = HashSet::new();
    let mut used_virtuoso = HashSet::new();
    let mut seen_categoric_inclination = false;
    for edge in existing_edges {
        let Some(dvi) = edge.get("definition_version_id").and_then(Value::as_str) else { continue };
        let Some(policy) = skill_edge_by_dvi.get(dvi) else { continue };
        let parameters = edge.get("parameters").cloned().unwrap_or(Value::Null);
        match policy.id.as_str() {
            "skill-enhancement" => {
                if let Some(skills) = parameters.get("skills").and_then(Value::as_array) {
                    for s in skills.iter().filter_map(Value::as_str) {
                        used_skill_enhancement.insert(s.to_string());
                    }
                }
            }
            "categoric-inclination" => seen_categoric_inclination = true,
            "skill-stunt" => {
                if let (Some(skill), Some(circumstance)) = (parameters.get("skill").and_then(Value::as_str), parameters.get("circumstance").and_then(Value::as_str)) {
                    used_skill_stunt.insert((skill.to_string(), circumstance.to_string()));
                }
            }
            "virtuoso" => {
                if let Some(skill) = parameters.get("skill").and_then(Value::as_str) {
                    used_virtuoso.insert(skill.to_string());
                }
            }
            _ => {}
        }
    }
    (used_skill_enhancement, used_skill_stunt, used_virtuoso, seen_categoric_inclination)
}

/// T13D4 (P3-equivalent for these three families): shared pack-active +
/// dataset load, mirroring `load_rules_and_fingerprint` exactly but also
/// returning `trainer_progression`/`trainer_milestones`, which every one
/// of the three new families needs alongside `trainer_build_rules`.
fn load_advancement_datasets(definitions_conn: &Connection, ruleset: &CampaignRuleset, content_pack_id: &str, e02_content_revision: &str) -> Result<(TrainerBuildRules, Vec<super::datasets::TrainerProgressionRow>, Vec<super::datasets::TrainerMilestoneRow>, String), TrainerBuildError> {
    let (rules, rules_fingerprint) = load_rules_and_fingerprint(definitions_conn, ruleset, content_pack_id, e02_content_revision)?;
    let progression = super::datasets::load_trainer_progression(definitions_conn, content_pack_id).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    let milestones = super::datasets::load_trainer_milestones(definitions_conn, content_pack_id).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    Ok((rules, progression, milestones, rules_fingerprint))
}

fn load_owned_profile(profiles_conn: &Connection, trainer_id: &str) -> Result<TrainerProfile, TrainerBuildError> {
    crate::profile::repository::load_trainer_profile(profiles_conn, trainer_id)
        .map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?
        .ok_or_else(|| TrainerBuildError::NotFound { message: format!("Trainer \"{trainer_id}\" not found") })
}

// -----------------------------------------------------------------------
// Advancement (Core pp19-20): ordinary Stat Point/Feature/Edge awards,
// the restricted L2/6/12 bonus Skill Edge, and the L5/10/20/30/40
// offensive-stat-stream milestones (with their Edge/General-Feature
// alternatives).
// -----------------------------------------------------------------------

/// One Edge/Feature acquisition chosen as part of an advancement commit,
/// role-tagged so the resolver validates/budgets it against the right
/// pool. Parsed out of the frozen `acquired_choices: Vec<Value>` field —
/// no wire-shape delta, just the documented convention this task defines
/// for what those opaque Values contain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdvancementAcquisitionIntent {
    /// `"ordinary_edge"` | `"ordinary_feature"` | `"restricted_bonus_edge"` | `"milestone_alternative"`.
    pub role: String,
    /// `"edge"` | `"feature"`.
    pub kind: String,
    pub definition_version_id: String,
    #[serde(default)]
    pub parameters: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MilestoneResolution {
    pub level: i64,
    pub name: String,
    pub choice_options: Vec<String>,
    /// `"stat_stream"` | `"edges"` | `"general_feature"`, once resolved.
    pub option_chosen: Option<String>,
    /// True only while this level's milestone requires a choice and none
    /// has been supplied yet — never auto-resolved.
    pub pending: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainerAdvancementResolution {
    pub from_level: i64,
    pub to_level: i64,
    pub ordinary_stat_points_granted: i64,
    pub ordinary_edges_required: i64,
    pub ordinary_features_required: i64,
    pub restricted_bonus_edge_required: bool,
    pub milestone: Option<MilestoneResolution>,
    /// The full resolved skill map AFTER applying any Skill Edge picked
    /// this advancement (e.g. Adept Skills at level 2) — same
    /// compatibility-projection convention `CreationResolution.skills`
    /// already uses, never a second independently-editable source.
    pub skills: Value,
    /// Newly-granted Edges this advancement adds (ordinary + restricted
    /// bonus + milestone-alternative), each carrying its own `source`.
    pub edges: Vec<Value>,
    pub features: Vec<Value>,
    /// The offensive-stat-stream's retroactive/ongoing points, sourced
    /// `Milestone` — reuses the exact same `StatAllocationSource`/
    /// `merge_with_preserved_provenance` mechanism C1/D3 already use.
    pub stat_allocation_milestone_entries: Vec<StatAllocationEntry>,
    pub issues: Vec<BuildIssue>,
}
impl TrainerAdvancementResolution {
    pub fn has_blocking_issue(&self) -> bool {
        self.issues.iter().any(|i| i.issue.severity == Severity::Error)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainerAdvancementPreviewResponse {
    pub base_revision: String,
    pub resolution: TrainerAdvancementResolution,
    pub core_result: super::trainer_core::TrainerCoreResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainerAdvancementCommitResponse {
    pub trainer_id: String,
    pub base_revision: String,
    pub resolution: TrainerAdvancementResolution,
    pub core_result: super::trainer_core::TrainerCoreResult,
}

/// Looks up the offensive-stat-stream family (if any) whose
/// `milestone_level` == `level`, from the source-cited
/// `trainer_build_rules.offensive_stat_streams` dataset.
fn stream_at_level(rules: &TrainerBuildRules, level: i64) -> Option<&super::datasets::OffensiveStatStream> {
    rules.offensive_stat_streams.streams.iter().find(|s| s.milestone_level == level)
}

/// Reads back the stat locked in at level 5 (if the stream was chosen
/// there), by scanning the Trainer's own progression ledger — never
/// re-asked at later stream levels (Core p19: "same stat for the whole
/// stream").
fn locked_offensive_stat(ledger: &[Value]) -> Option<TrainerCombatStat> {
    ledger.iter().find_map(|entry| {
        let parsed: super::trainer_core::ProgressionLedgerEntry = serde_json::from_value(entry.clone()).ok()?;
        if parsed.level == 5 && parsed.milestone_option_kind.as_deref() == Some("stat_stream") {
            parsed.stat_stream_choice.as_deref().and_then(|s| serde_json::from_value(Value::String(s.to_string())).ok())
        } else {
            None
        }
    })
}

#[allow(clippy::too_many_arguments)]
fn resolve_advancement_intent(
    definitions_conn: &Connection,
    rules: &TrainerBuildRules,
    progression: &[super::datasets::TrainerProgressionRow],
    milestones: &[super::datasets::TrainerMilestoneRow],
    existing_profile: &TrainerProfile,
    next_level: i64,
    milestone_option_id: &Option<String>,
    acquired_choices: &[Value],
    stat_stream_choice: &Option<String>,
) -> TrainerAdvancementResolution {
    let mut issues = Vec::new();
    let from_level = existing_profile.level;

    if next_level != from_level + 1 {
        issues.push(error_issue(
            "advancement_level_mismatch",
            format!("next_level must be exactly one more than the Trainer's current level ({from_level} -> {next_level} requested)."),
            Some("next_level".to_string()),
            false,
        ));
        return TrainerAdvancementResolution {
            from_level,
            to_level: next_level,
            ordinary_stat_points_granted: 0,
            ordinary_edges_required: 0,
            ordinary_features_required: 0,
            restricted_bonus_edge_required: false,
            milestone: None,
            skills: existing_profile.skills.clone(),
            edges: vec![],
            features: vec![],
            stat_allocation_milestone_entries: vec![],
            issues,
        };
    }

    let Some(progression_row) = progression.iter().find(|r| r.level == next_level) else {
        issues.push(error_issue("advancement_level_unsupported", format!("No trainer_progression row exists for level {next_level}."), Some("next_level".to_string()), false));
        return TrainerAdvancementResolution {
            from_level,
            to_level: next_level,
            ordinary_stat_points_granted: 0,
            ordinary_edges_required: 0,
            ordinary_features_required: 0,
            restricted_bonus_edge_required: false,
            milestone: None,
            skills: existing_profile.skills.clone(),
            edges: vec![],
            features: vec![],
            stat_allocation_milestone_entries: vec![],
            issues,
        };
    };

    // Core p19: at 2/6/12, `edges_at_level` already counts the ordinary
    // Edge AND the restricted bonus Skill Edge together — split, never
    // add the bonus a second time.
    let restricted_level = matches!(next_level, 2 | 6 | 12);
    let ordinary_edges_required = (progression_row.edges_at_level - if restricted_level { 1 } else { 0 }).max(0);
    let ordinary_features_required = progression_row.features_at_level;

    let skill_edge_by_dvi: HashMap<&str, &SkillEdgeCatalogEntry> = rules.skill_edges.entries.iter().map(|e| (e.definition_version_id.as_str(), e)).collect();
    let mut existing_acquired: Vec<Value> = existing_profile.edges.iter().chain(existing_profile.features.iter()).cloned().collect();
    let (mut used_skill_enhancement, mut used_skill_stunt, mut used_virtuoso, mut seen_categoric_inclination) = scan_existing_skill_edge_usage(&existing_profile.edges, &skill_edge_by_dvi);

    let parsed_choices: Vec<AdvancementAcquisitionIntent> = acquired_choices
        .iter()
        .filter_map(|v| match serde_json::from_value::<AdvancementAcquisitionIntent>(v.clone()) {
            Ok(c) => Some(c),
            Err(_) => {
                issues.push(error_issue("advancement_choice_invalid_shape", format!("acquired_choices entry does not match the expected shape: {v}"), Some("acquired_choices".to_string()), false));
                None
            }
        })
        .collect();

    let ordinary_edge_choices: Vec<&AdvancementAcquisitionIntent> = parsed_choices.iter().filter(|c| c.role == "ordinary_edge").collect();
    let ordinary_feature_choices: Vec<&AdvancementAcquisitionIntent> = parsed_choices.iter().filter(|c| c.role == "ordinary_feature").collect();
    let restricted_choices: Vec<&AdvancementAcquisitionIntent> = parsed_choices.iter().filter(|c| c.role == "restricted_bonus_edge").collect();
    let milestone_alt_choices: Vec<&AdvancementAcquisitionIntent> = parsed_choices.iter().filter(|c| c.role == "milestone_alternative").collect();

    if ordinary_edge_choices.len() as i64 != ordinary_edges_required {
        issues.push(error_issue("advancement_ordinary_edges_incomplete", format!("Level {next_level} grants exactly {ordinary_edges_required} ordinary Edge(s); {} chosen.", ordinary_edge_choices.len()), Some("acquired_choices".to_string()), false));
    }
    if ordinary_feature_choices.len() as i64 != ordinary_features_required {
        issues.push(error_issue("advancement_ordinary_features_incomplete", format!("Level {next_level} grants exactly {ordinary_features_required} ordinary Feature(s); {} chosen.", ordinary_feature_choices.len()), Some("acquired_choices".to_string()), false));
    }
    if restricted_level && restricted_choices.len() != 1 {
        issues.push(error_issue("advancement_restricted_bonus_edge_incomplete", format!("Level {next_level} grants exactly one restricted bonus Skill Edge; {} chosen.", restricted_choices.len()), Some("acquired_choices".to_string()), false));
    }
    if !restricted_level && !restricted_choices.is_empty() {
        issues.push(error_issue("advancement_restricted_bonus_edge_not_available", format!("Level {next_level} does not grant a restricted bonus Skill Edge (only 2/6/12 do)."), Some("acquired_choices".to_string()), false));
    }

    // The rank that newly unlocks at a restricted level (Core p19-20/34) —
    // the restricted bonus Skill Edge specifically cannot be used to
    // reach THIS rank at THIS level.
    let newly_unlocked_rank: Option<&str> = if next_level == rules.rank_table.ordinary_rank_caps_by_level.adept_available_at_level {
        Some("adept")
    } else if next_level == rules.rank_table.ordinary_rank_caps_by_level.expert_available_at_level {
        Some("expert")
    } else if next_level == rules.rank_table.ordinary_rank_caps_by_level.master_available_at_level {
        Some("master")
    } else {
        None
    };

    let mut edges: Vec<Value> = Vec::new();
    let mut features: Vec<Value> = Vec::new();
    let mut sequence = 0i64;
    // Threaded forward across every acquisition this advancement resolves
    // — a Skill Edge picked as an ordinary/restricted/milestone-alternative
    // Edge at THIS level must actually change the skill map (e.g. picking
    // Adept Skills at level 2), not just validate against the pre-advancement
    // snapshot, exactly like `resolve_creation`'s own `skills` threading.
    let mut skills = existing_profile.skills.clone();

    let mut resolve_one = |choice: &AdvancementAcquisitionIntent, source: &'static str, issues: &mut Vec<BuildIssue>, edges: &mut Vec<Value>, features: &mut Vec<Value>, existing_acquired: &mut Vec<Value>, skills: &mut Value, forbid_rank: Option<&str>| {
        let field = format!("acquired_choices[{}:{}]", choice.role, sequence);
        let kind = if choice.kind == "edge" { ContentKind::Edge } else { ContentKind::Feature };
        let Ok(Some(record)) = get_definition_by_version_id(definitions_conn, kind, &choice.definition_version_id) else {
            issues.push(error_issue("acquisition_definition_not_found", format!("\"{}\" does not exist in the active content.", choice.definition_version_id), Some(field.clone()), false));
            sequence += 1;
            return;
        };
        if !record.enabled {
            issues.push(error_issue("acquisition_definition_disabled", format!("\"{}\" is disabled and cannot be acquired.", choice.definition_version_id), Some(field.clone()), false));
        }

        let acquired_state = AcquiredState { acquired: existing_acquired, skills, level: next_level };
        if let Some(policy) = skill_edge_by_dvi.get(choice.definition_version_id.as_str()) {
            if let Some(forbidden) = forbid_rank {
                if policy.target_rank.as_deref() == Some(forbidden) {
                    issues.push(error_issue(
                        "advancement_restricted_bonus_cannot_attain_newly_unlocked_rank",
                        format!("The restricted bonus Skill Edge at level {next_level} cannot be used to attain the newly unlocked {forbidden} rank (Core p19-20); choose a different Skill Edge."),
                        Some(field.clone()),
                        false,
                    ));
                    sequence += 1;
                    return;
                }
            }
            let outcome = apply_skill_edge(policy, &choice.parameters, skills, next_level, &[], &field, &used_skill_enhancement, &used_skill_stunt, &used_virtuoso, seen_categoric_inclination);
            issues.extend(outcome.issues);
            if let Some((skill_id, target_rank)) = &outcome.new_skill_rank {
                if let Some(obj) = skills.as_object_mut() {
                    obj.entry(skill_id.clone()).or_insert_with(|| serde_json::json!({})).as_object_mut().map(|s| s.insert("base_rank".to_string(), Value::String(target_rank.to_string())));
                }
            }
            match policy.id.as_str() {
                "skill-enhancement" => {
                    if let Some(skills) = choice.parameters.get("skills").and_then(Value::as_array) {
                        for s in skills.iter().filter_map(Value::as_str) {
                            used_skill_enhancement.insert(s.to_string());
                        }
                    }
                }
                "categoric-inclination" => seen_categoric_inclination = true,
                "skill-stunt" => {
                    if let (Some(skill), Some(circumstance)) = (choice.parameters.get("skill").and_then(Value::as_str), choice.parameters.get("circumstance").and_then(Value::as_str)) {
                        used_skill_stunt.insert((skill.to_string(), circumstance.to_string()));
                    }
                }
                "virtuoso" => {
                    if let Some(skill) = choice.parameters.get("skill").and_then(Value::as_str) {
                        used_virtuoso.insert(skill.to_string());
                    }
                }
                _ => {}
            }
        } else {
            match check_definition_prerequisites(&record.data_json, &acquired_state, false) {
                Some(PrereqEval::Met) | None => {}
                Some(PrereqEval::NotMet(reason)) => issues.push(error_issue("prerequisite_not_met", format!("\"{}\": {reason}", choice.definition_version_id), Some(field.clone()), true)),
                Some(PrereqEval::ManualReview(reason)) => issues.push(manual_review_issue(Some(field.clone()), format!("\"{}\": {reason}", choice.definition_version_id))),
            }
        }

        let entry = serde_json::json!({
            "definition_version_id": choice.definition_version_id,
            "parameters": choice.parameters,
            "policy_kind": kind.kind_slug(),
            "source": source,
            "level": next_level,
            "sequence": sequence,
        });
        existing_acquired.push(entry.clone());
        if kind == ContentKind::Edge {
            edges.push(entry);
        } else {
            features.push(entry);
        }
        sequence += 1;
    };

    for choice in &ordinary_edge_choices {
        resolve_one(choice, "level_up", &mut issues, &mut edges, &mut features, &mut existing_acquired, &mut skills, None);
    }
    for choice in &ordinary_feature_choices {
        resolve_one(choice, "level_up", &mut issues, &mut edges, &mut features, &mut existing_acquired, &mut skills, None);
    }
    for choice in &restricted_choices {
        if choice.kind != "edge" || !skill_edge_by_dvi.contains_key(choice.definition_version_id.as_str()) {
            issues.push(error_issue("advancement_restricted_bonus_must_be_skill_edge", format!("\"{}\" is not one of the eight Core p52 Skill Edges; the restricted bonus slot at level {next_level} requires one.", choice.definition_version_id), Some("acquired_choices".to_string()), false));
            continue;
        }
        resolve_one(choice, "bonus_skill_edge", &mut issues, &mut edges, &mut features, &mut existing_acquired, &mut skills, newly_unlocked_rank);
    }

    // ---- Milestone (Core p19-20: offensive stat stream, or a generic
    // named milestone with no structured stream data — the latter is
    // reported as pending/manual, never a silent no-op). ----
    let milestone_row = milestones.iter().find(|m| m.level == next_level);
    let stream = stream_at_level(rules, next_level);
    let mut milestone_resolution: Option<MilestoneResolution> = None;
    let mut stat_allocation_milestone_entries: Vec<StatAllocationEntry> = Vec::new();

    // Automatic ongoing offensive-stat-stream bonuses (Core p19-20): the
    // stream's own milestone level (5/10/20/30/40) requires an explicit
    // choice, but the ongoing bonus levels WITHIN a tier (e.g. 6/8/10
    // after choosing the stream at 5) are never themselves milestone
    // rows — they apply automatically, with no new choice, for every
    // tier the Trainer already committed to via stat_stream at that
    // tier's own milestone level. Scanned against ALL streams (not just
    // `stream_at_level(rules, next_level)`, which only matches a
    // stream's OWN milestone level and would never see these).
    for candidate_stream in &rules.offensive_stat_streams.streams {
        if candidate_stream.ongoing_bonus_levels.contains(&next_level) {
            let tier_entered = existing_profile.progression.iter().any(|entry| {
                serde_json::from_value::<super::trainer_core::ProgressionLedgerEntry>(entry.clone())
                    .ok()
                    .is_some_and(|parsed| parsed.level == candidate_stream.milestone_level && parsed.milestone_option_kind.as_deref() == Some("stat_stream"))
            });
            if tier_entered {
                if let Some(stat) = locked_offensive_stat(&existing_profile.progression) {
                    stat_allocation_milestone_entries.push(StatAllocationEntry { stat, source: StatAllocationSource::Milestone, level: next_level, points: candidate_stream.ongoing_bonus_points_each, note: Some("Offensive-stat-stream ongoing bonus (Core p19-20).".to_string()), source_id: None });
                }
            }
        }
    }

    if let Some(m) = milestone_row {
        let requires_choice = !m.choice_options.is_empty() || stream.is_some();
        if !requires_choice {
            milestone_resolution = Some(MilestoneResolution { level: next_level, name: m.name.clone(), choice_options: m.choice_options.clone(), option_chosen: None, pending: false });
        } else {
            match milestone_option_id.as_deref() {
                None => {
                    issues.push(error_issue("milestone_choice_required", format!("Level {next_level}'s milestone (\"{}\") requires a choice before advancement can be committed (Core p19-20).", m.name), Some("milestone_option_id".to_string()), false));
                    milestone_resolution = Some(MilestoneResolution { level: next_level, name: m.name.clone(), choice_options: m.choice_options.clone(), option_chosen: None, pending: true });
                }
                Some("stat_stream") => {
                    let Some(stream) = stream else {
                        issues.push(error_issue("milestone_option_unsupported", format!("Level {next_level} has no offensive-stat-stream option."), Some("milestone_option_id".to_string()), false));
                        milestone_resolution = Some(MilestoneResolution { level: next_level, name: m.name.clone(), choice_options: m.choice_options.clone(), option_chosen: None, pending: true });
                        return TrainerAdvancementResolution {
                            from_level,
                            to_level: next_level,
                            ordinary_stat_points_granted: progression_row.stat_points_at_level,
                            ordinary_edges_required,
                            ordinary_features_required,
                            restricted_bonus_edge_required: restricted_level,
                            milestone: milestone_resolution,
                            skills,
                            edges,
                            features,
                            stat_allocation_milestone_entries,
                            issues,
                        };
                    };
                    let stat: Option<TrainerCombatStat> = if next_level == 5 {
                        match stat_stream_choice.as_deref() {
                            Some("attack") => Some(TrainerCombatStat::Attack),
                            Some("special_attack") => Some(TrainerCombatStat::SpecialAttack),
                            _ => {
                                issues.push(error_issue("advancement_stat_stream_choice_required", "Level 5's offensive stat stream requires stat_stream_choice to be \"attack\" or \"special_attack\" (Core p19).".to_string(), Some("stat_stream_choice".to_string()), false));
                                None
                            }
                        }
                    } else {
                        match locked_offensive_stat(&existing_profile.progression) {
                            Some(s) => Some(s),
                            None => {
                                issues.push(error_issue("advancement_stat_stream_not_started", format!("Level {next_level}'s stream option reuses level 5's stat choice, but this Trainer never entered the stream at level 5 (Core p19: the stream cannot be started later)."), Some("milestone_option_id".to_string()), false));
                                None
                            }
                        }
                    };
                    if let Some(stat) = stat {
                        if next_level == 5 {
                            if let (Some(levels), Some(points)) = (Some(&stream.retroactive_bonus_levels), stream.retroactive_bonus_points_each) {
                                if !levels.is_empty() {
                                    stat_allocation_milestone_entries.push(StatAllocationEntry { stat, source: StatAllocationSource::Milestone, level: next_level, points, note: Some(format!("Retroactive offensive-stat-stream bonus (Core p19), covering levels {levels:?}, applied once at level 5.")), source_id: None });
                                }
                            }
                        }
                        // Ongoing bonuses for THIS tier at later levels
                        // (6/8/10/...) are handled generically above,
                        // scanning all streams — a stream's own
                        // milestone_level is never itself one of its
                        // ongoing_bonus_levels, so nothing to do here.
                    }
                    milestone_resolution = Some(MilestoneResolution { level: next_level, name: m.name.clone(), choice_options: m.choice_options.clone(), option_chosen: Some("stat_stream".to_string()), pending: false });
                }
                Some(other @ ("edges" | "general_feature")) => {
                    let alt = stream.and_then(|s| s.alternative_options.iter().find(|o| o.get("kind").and_then(Value::as_str) == Some(if other == "edges" { "edges" } else { "general_feature" })));
                    let Some(alt) = alt else {
                        issues.push(error_issue("milestone_option_unsupported", format!("Level {next_level} does not offer the \"{other}\" alternative."), Some("milestone_option_id".to_string()), false));
                        milestone_resolution = Some(MilestoneResolution { level: next_level, name: m.name.clone(), choice_options: m.choice_options.clone(), option_chosen: None, pending: true });
                        return TrainerAdvancementResolution {
                            from_level,
                            to_level: next_level,
                            ordinary_stat_points_granted: progression_row.stat_points_at_level,
                            ordinary_edges_required,
                            ordinary_features_required,
                            restricted_bonus_edge_required: restricted_level,
                            milestone: milestone_resolution,
                            skills,
                            edges,
                            features,
                            stat_allocation_milestone_entries,
                            issues,
                        };
                    };
                    let required_count = alt.get("count").and_then(Value::as_i64).unwrap_or(1);
                    if milestone_alt_choices.len() as i64 != required_count {
                        issues.push(error_issue("milestone_alternative_incomplete", format!("Level {next_level}'s \"{other}\" alternative requires exactly {required_count} choice(s); {} supplied.", milestone_alt_choices.len()), Some("acquired_choices".to_string()), false));
                    }
                    for choice in &milestone_alt_choices {
                        if other == "general_feature" {
                            if choice.kind != "feature" {
                                issues.push(error_issue("milestone_alternative_wrong_kind", "The General Feature alternative requires a Feature choice.".to_string(), Some("acquired_choices".to_string()), false));
                                continue;
                            }
                            if let Ok(Some(record)) = get_definition_by_version_id(definitions_conn, ContentKind::Feature, &choice.definition_version_id) {
                                if !is_general_feature(&record.data_json) {
                                    issues.push(error_issue("milestone_alternative_not_general_feature", format!("\"{}\" belongs to a specific Class and does not qualify as a General Feature (Core p19-20).", choice.definition_version_id), Some("acquired_choices".to_string()), false));
                                    continue;
                                }
                            }
                        } else if choice.kind != "edge" {
                            issues.push(error_issue("milestone_alternative_wrong_kind", "The Edges alternative requires Edge choices.".to_string(), Some("acquired_choices".to_string()), false));
                            continue;
                        }
                        resolve_one(choice, "milestone", &mut issues, &mut edges, &mut features, &mut existing_acquired, &mut skills, None);
                    }
                    milestone_resolution = Some(MilestoneResolution { level: next_level, name: m.name.clone(), choice_options: m.choice_options.clone(), option_chosen: Some(other.to_string()), pending: false });
                }
                Some(other) => {
                    issues.push(error_issue("milestone_option_unknown", format!("Unknown milestone_option_id {other:?}."), Some("milestone_option_id".to_string()), false));
                    milestone_resolution = Some(MilestoneResolution { level: next_level, name: m.name.clone(), choice_options: m.choice_options.clone(), option_chosen: None, pending: true });
                }
            }
        }
    }

    TrainerAdvancementResolution {
        from_level,
        to_level: next_level,
        ordinary_stat_points_granted: progression_row.stat_points_at_level,
        ordinary_edges_required,
        ordinary_features_required,
        restricted_bonus_edge_required: restricted_level,
        milestone: milestone_resolution,
        skills,
        edges,
        features,
        stat_allocation_milestone_entries,
        issues,
    }
}

fn resolve_advancement_core_stats(definitions_conn: &Connection, progression: &[super::datasets::TrainerProgressionRow], profile: &TrainerProfile, resolution: &TrainerAdvancementResolution) -> super::trainer_core::TrainerCoreResult {
    let mut allocation = profile.stat_allocation.clone();
    allocation.entries.extend(resolution.stat_allocation_milestone_entries.clone());
    let mut all_features = profile.features.clone();
    all_features.extend(resolution.features.clone());
    let (feature_tag_modifiers, _issues) = derive_feature_tag_modifiers(definitions_conn, &all_features);
    super::trainer_core::resolve_trainer_core(resolution.to_level, &allocation, &resolution.skills, profile.weight_lb, &profile.gm_grants, progression, &feature_tag_modifiers)
}

#[allow(clippy::too_many_arguments)]
pub fn preview_trainer_advancement(definitions_conn: &Connection, profiles_conn: &Connection, ruleset: &CampaignRuleset, e02_content_revision: &str, request: &PreviewTrainerAdvancementRequest) -> Result<TrainerAdvancementPreviewResponse, TrainerBuildError> {
    let profile = load_owned_profile(profiles_conn, &request.trainer_id)?;
    let (rules, progression, milestones, rules_fingerprint) = load_advancement_datasets(definitions_conn, ruleset, &request.content_pack_id, e02_content_revision)?;
    let current_base_revision = compute_base_revision(&profile, &rules_fingerprint);
    if request.expected_base_revision != current_base_revision {
        return Err(TrainerBuildError::StaleRevision { message: "Content context changed".to_string() });
    }
    let resolution = resolve_advancement_intent(definitions_conn, &rules, &progression, &milestones, &profile, request.next_level, &request.milestone_option_id, &request.acquired_choices, &request.stat_stream_choice);
    let core_result = resolve_advancement_core_stats(definitions_conn, &progression, &profile, &resolution);
    Ok(TrainerAdvancementPreviewResponse { base_revision: current_base_revision, resolution, core_result })
}

/// Commit-time equivalent of [`preview_trainer_advancement`] — same
/// structural-validation-then-operation-replay-then-new-operation
/// ordering T13D3-R1A established, reusing the SAME
/// `trainer_build_operations` receipt table (never a second receipt
/// framework) with a request fingerprint hashed over materially
/// different fields than a `commit_trainer_build` request, so a stored
/// build receipt can never fingerprint-match (and thus never replay as)
/// an advancement result, or vice versa — see
/// `compute_operation_request_fingerprint_generic`'s own doc comment.
#[allow(clippy::too_many_arguments)]
pub fn commit_trainer_advancement(definitions_conn: &Connection, profiles_conn: &mut Connection, ruleset: &CampaignRuleset, e02_content_revision: &str, request: &CommitTrainerAdvancementRequest) -> Result<TrainerAdvancementCommitResponse, TrainerBuildError> {
    if !request.confirm {
        return Err(TrainerBuildError::ConfirmationRequired { message: "confirm must be true to publish an advancement".to_string() });
    }
    if request.operation_id.trim().is_empty() {
        return Err(TrainerBuildError::InvalidIntent { message: "operation_id must not be empty".to_string() });
    }

    // Structural/confirmation validation before the operation-replay check.
    let profile = load_owned_profile(profiles_conn, &request.trainer_id)?;

    let request_fingerprint = compute_operation_request_fingerprint_generic(serde_json::json!({
        "operation_kind": "trainer_advancement_commit",
        "trainer_id": request.trainer_id,
        "content_pack_id": request.content_pack_id,
        "next_level": request.next_level,
        "milestone_option_id": request.milestone_option_id,
        "acquired_choices": request.acquired_choices,
        "stat_stream_choice": request.stat_stream_choice,
        "manual_adjudications": request.manual_adjudications,
        "expected_base_revision": request.expected_base_revision,
    }));
    if let Some(receipt) = crate::profile::repository::load_build_operation(profiles_conn, &request.operation_id).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })? {
        if receipt.request_fingerprint != request_fingerprint {
            return Err(TrainerBuildError::OperationConflict { message: format!("operation_id \"{}\" was already used for a different request; use a new operation_id for a new mutation.", request.operation_id) });
        }
        if crate::profile::repository::load_trainer_profile(profiles_conn, &receipt.trainer_id).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?.is_none() {
            return Err(TrainerBuildError::CommittedTargetMissing { message: format!("operation_id \"{}\" previously committed Trainer \"{}\", which no longer exists.", request.operation_id, receipt.trainer_id) });
        }
        let response: TrainerAdvancementCommitResponse = serde_json::from_str(&receipt.response_json).map_err(|e| TrainerBuildError::Internal { message: format!("stored operation receipt is corrupt: {e}") })?;
        return Ok(response);
    }

    let (rules, progression, milestones, rules_fingerprint) = load_advancement_datasets(definitions_conn, ruleset, &request.content_pack_id, e02_content_revision)?;
    let current_base_revision = compute_base_revision(&profile, &rules_fingerprint);
    if request.expected_base_revision != current_base_revision {
        return Err(TrainerBuildError::StaleRevision { message: "Content context changed".to_string() });
    }

    let resolution = resolve_advancement_intent(definitions_conn, &rules, &progression, &milestones, &profile, request.next_level, &request.milestone_option_id, &request.acquired_choices, &request.stat_stream_choice);
    let blocking: Vec<BuildIssue> = resolution.issues.iter().filter(|i| i.issue.severity == Severity::Error && !issue_is_adjudicated(i, &request.manual_adjudications)).cloned().collect();
    if !blocking.is_empty() {
        // No receipt written — an invalid publish never consumes a
        // successful operation identity (same T13D3-R1C guarantee).
        return Err(TrainerBuildError::ValidationFailed { issues: blocking });
    }

    let mut updated_profile = profile.clone();
    updated_profile.level = resolution.to_level;
    updated_profile.skills = resolution.skills.clone();
    updated_profile.edges.extend(resolution.edges.clone());
    updated_profile.features.extend(resolution.features.clone());
    updated_profile.stat_allocation.entries.extend(resolution.stat_allocation_milestone_entries.clone());

    let mut ledger: Vec<Value> = updated_profile.progression.clone();
    let ledger_entry = super::trainer_core::ProgressionLedgerEntry {
        level: resolution.to_level,
        level_source: super::trainer_core::LevelSource::Xp,
        stat_points: resolution.ordinary_stat_points_granted,
        features: resolution.ordinary_features_required,
        edges: resolution.ordinary_edges_required + if resolution.restricted_bonus_edge_required { 1 } else { 0 },
        milestone_choice_required: false,
        milestone_choice: resolution.milestone.as_ref().and_then(|m| m.option_chosen.clone()),
        milestone_option_kind: resolution.milestone.as_ref().and_then(|m| m.option_chosen.clone()),
        stat_stream_choice: if resolution.to_level == 5 { request.stat_stream_choice.clone() } else { None },
        reconciliation: None,
    };
    ledger.push(serde_json::to_value(&ledger_entry).unwrap_or(Value::Null));
    updated_profile.progression = ledger;

    // `updated_profile` already has `resolution`'s features/stat entries
    // merged in above — resolve directly from its own final state, never
    // overlay `resolution` a second time (that would double-count).
    let core_result = resolve_core_stats_for_profile(definitions_conn, &progression, &updated_profile);
    let new_base_revision = compute_base_revision(&updated_profile, &rules_fingerprint);
    let response = TrainerAdvancementCommitResponse { trainer_id: updated_profile.id.clone(), base_revision: new_base_revision, resolution, core_result };
    let response_json = serde_json::to_string(&response).map_err(|e| TrainerBuildError::Internal { message: format!("failed to serialize operation response: {e}") })?;

    let tx = profiles_conn.transaction().map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    crate::profile::repository::save_trainer_profile_tx(&tx, &updated_profile).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    crate::profile::repository::record_build_operation_tx(&tx, &request.operation_id, &request_fingerprint, &updated_profile.id, &response_json).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    tx.commit().map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;

    Ok(response)
}

// -----------------------------------------------------------------------
// GM grant changes (plan §3.4: "skill CHECK bonus, stat modifier,
// specific Edge/Feature/Move/Capability... Resource choices: Edge slot,
// Feature slot, stat points, positive integer amount and bounded
// allocations"). Two distinct grant shapes share `profile.gm_grants`:
// - "fixed" + a NUMERIC target (`trainer.stat.*`/`trainer.skill.*.check_bonus`)
//   is a plain modifier `stat_modifiers_from_gm_grants` already resolves.
// - "fixed" + a DEFINITIONAL target (`trainer.edge`/`trainer.feature`/
//   `trainer.move`/`trainer.capability`) additionally creates a real
//   acquisition (source `gm_fixed`, linked back via `source_id` — the
//   exact D1-planned but D3-unneeded acquisition field this task is the
//   first to actually populate) so its effect is real, not a label.
// - "resource" grants a capacity (Edge slot/Feature slot/stat points);
//   once `allocation` targets something specific, the SAME linkage
//   applies with source `gm_resource`.
// -----------------------------------------------------------------------

const SUPPORTED_FIXED_STAT_TARGETS: [&str; 7] = ["trainer.stat.hp", "trainer.stat.attack", "trainer.stat.defense", "trainer.stat.special_attack", "trainer.stat.special_defense", "trainer.stat.speed", "trainer.stat.max_hp"];

fn valid_numeric_operation(op: &str) -> bool {
    matches!(op, "add" | "multiply" | "set" | "min" | "max")
}

fn all_core_skill_ids(rules: &TrainerBuildRules) -> HashSet<String> {
    rules.skills.groups.body.iter().chain(&rules.skills.groups.mind).chain(&rules.skills.groups.spirit).map(|s| s.id.clone()).collect()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainerGmChangeResolution {
    pub action: String,
    pub grant_kind: String,
    pub grant_id: Option<String>,
    /// The resulting grant shape for `add`/`edit` (`None` for `remove`).
    pub effective_grant: Option<Value>,
    /// A real Edge/Feature acquisition this grant directly creates
    /// (definitional fixed grants, or a resource grant whose allocation
    /// targets a specific definition) — `source: "gm_fixed"|"gm_resource"`,
    /// `source_id` linking back to `grant_id`.
    pub linked_acquisition: Option<Value>,
    /// Stat allocation entries this grant directly creates (a
    /// `stat_points` resource grant's allocation) — `source: GmOverride`,
    /// `note` linking back to `grant_id`.
    pub linked_stat_entries: Vec<StatAllocationEntry>,
    /// Human-readable notes on what else this action affects — e.g.
    /// removing a resource grant that funded an acquisition names that
    /// acquisition, so a caller can preview the real dependency before
    /// confirming.
    pub dependent_invalidations: Vec<String>,
    pub issues: Vec<BuildIssue>,
}
impl TrainerGmChangeResolution {
    pub fn has_blocking_issue(&self) -> bool {
        self.issues.iter().any(|i| i.issue.severity == Severity::Error)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainerGmChangePreviewResponse {
    pub base_revision: String,
    pub resolution: TrainerGmChangeResolution,
    pub core_result: super::trainer_core::TrainerCoreResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainerGmChangeCommitResponse {
    pub trainer_id: String,
    pub base_revision: String,
    pub resolution: TrainerGmChangeResolution,
    pub core_result: super::trainer_core::TrainerCoreResult,
}

fn find_grant<'a>(grants: &'a [Value], grant_id: &str) -> Option<&'a Value> {
    grants.iter().find(|g| g.get("id").and_then(Value::as_str) == Some(grant_id))
}

#[allow(clippy::too_many_arguments)]
fn resolve_gm_change_intent(definitions_conn: &Connection, rules: &TrainerBuildRules, existing_profile: &TrainerProfile, action: &str, grant_kind: &str, payload: &Value, note: &Option<String>) -> TrainerGmChangeResolution {
    let mut issues = Vec::new();
    let valid_skill_ids = all_core_skill_ids(rules);
    let now = chrono::Utc::now().to_rfc3339();

    let empty = |action: &str, grant_kind: &str, issues: Vec<BuildIssue>| TrainerGmChangeResolution { action: action.to_string(), grant_kind: grant_kind.to_string(), grant_id: None, effective_grant: None, linked_acquisition: None, linked_stat_entries: vec![], dependent_invalidations: vec![], issues };

    match action {
        "add" => {
            let grant_id = crate::profile::repository::new_id();
            match grant_kind {
                "fixed" => {
                    if let Some(dvi) = payload.get("definition_version_id").and_then(Value::as_str) {
                        let target = payload.get("target").and_then(Value::as_str).unwrap_or("");
                        let expected_kind = match target {
                            "trainer.edge" => Some(ContentKind::Edge),
                            "trainer.feature" => Some(ContentKind::Feature),
                            "trainer.move" => Some(ContentKind::Move),
                            "trainer.capability" => Some(ContentKind::Capability),
                            _ => None,
                        };
                        let Some(kind) = expected_kind else {
                            issues.push(error_issue("gm_change_unsupported_target", format!("\"{target}\" is not a supported definitional fixed-grant target (trainer.edge/feature/move/capability)."), Some("payload.target".to_string()), false));
                            return empty(action, grant_kind, issues);
                        };
                        let Ok(Some(record)) = get_definition_by_version_id(definitions_conn, kind, dvi) else {
                            issues.push(error_issue("acquisition_definition_not_found", format!("\"{dvi}\" does not exist in the active content."), Some("payload.definition_version_id".to_string()), false));
                            return empty(action, grant_kind, issues);
                        };
                        if !record.enabled {
                            issues.push(error_issue("acquisition_definition_disabled", format!("\"{dvi}\" is disabled and cannot be granted."), Some("payload.definition_version_id".to_string()), false));
                        }
                        // T13D4-R4 (D2, approved collision policy): Move/
                        // Capability rows are a per-owner definition-
                        // version-unique SET at the storage layer
                        // (`PRIMARY KEY (trainer_id, definition_version_id)`
                        // on `trainer_moves`/`trainer_capabilities`) —
                        // unlike Edges/Features, which support independent
                        // repeats. If this Trainer already independently
                        // has this exact Move/Capability (any source), a
                        // second grant of the SAME definition cannot be
                        // represented as a second, separately-removable
                        // row with current storage — reject BEFORE any
                        // write with a precise, non-overridable issue,
                        // never silently overwrite/delete/adopt the
                        // existing one.
                        if matches!(kind, ContentKind::Move | ContentKind::Capability) {
                            let existing_collection = if kind == ContentKind::Move { &existing_profile.moves } else { &existing_profile.capabilities };
                            if existing_collection.iter().any(|e| e.get("definition_version_id").and_then(Value::as_str) == Some(dvi)) {
                                issues.push(error_issue(
                                    "gm_change_move_capability_already_owned",
                                    format!("\"{dvi}\" is already present on this Trainer — {} cannot hold two independent entries for the same definition; remove the existing one first if this grant should replace it.", if kind == ContentKind::Move { "Moves" } else { "Capabilities" }),
                                    Some("payload.definition_version_id".to_string()),
                                    false,
                                ));
                                return empty(action, grant_kind, issues);
                            }
                        }
                        let parameters = payload.get("parameters").cloned().unwrap_or(Value::Null);
                        if matches!(kind, ContentKind::Edge | ContentKind::Feature) {
                            let combined: Vec<Value> = existing_profile.edges.iter().chain(existing_profile.features.iter()).cloned().collect();
                            let acquired_state = AcquiredState { acquired: &combined, skills: &existing_profile.skills, level: existing_profile.level };
                            let skill_edge_by_dvi: HashMap<&str, &SkillEdgeCatalogEntry> = rules.skill_edges.entries.iter().map(|e| (e.definition_version_id.as_str(), e)).collect();
                            if let Some(policy) = skill_edge_by_dvi.get(dvi.to_string().as_str()) {
                                let (used_e, used_s, used_v, seen_c) = scan_existing_skill_edge_usage(&existing_profile.edges, &skill_edge_by_dvi);
                                let outcome = apply_skill_edge(policy, &parameters, &existing_profile.skills, existing_profile.level, &[], "payload", &used_e, &used_s, &used_v, seen_c);
                                issues.extend(outcome.issues);
                            } else {
                                match check_definition_prerequisites(&record.data_json, &acquired_state, false) {
                                    Some(PrereqEval::Met) | None => {}
                                    Some(PrereqEval::NotMet(reason)) => issues.push(error_issue("prerequisite_not_met", format!("\"{dvi}\": {reason}"), Some("payload.definition_version_id".to_string()), true)),
                                    Some(PrereqEval::ManualReview(reason)) => issues.push(manual_review_issue(Some("payload.definition_version_id".to_string()), format!("\"{dvi}\": {reason}"))),
                                }
                            }
                        }
                        let grant = serde_json::json!({"id": grant_id, "kind": "fixed", "target": target, "definition_version_id": dvi, "parameters": parameters, "note": note, "created_at": now});
                        let acquisition = serde_json::json!({"definition_version_id": dvi, "parameters": parameters, "policy_kind": kind.kind_slug(), "source": "gm_fixed", "source_id": grant_id, "level": existing_profile.level, "sequence": 0});
                        TrainerGmChangeResolution { action: action.to_string(), grant_kind: grant_kind.to_string(), grant_id: Some(grant_id), effective_grant: Some(grant), linked_acquisition: Some(acquisition), linked_stat_entries: vec![], dependent_invalidations: vec![], issues }
                    } else {
                        let target = payload.get("target").and_then(Value::as_str).unwrap_or("");
                        let operation = payload.get("operation").and_then(Value::as_str).unwrap_or("");
                        let value = payload.get("value").and_then(Value::as_f64);
                        let target_valid = SUPPORTED_FIXED_STAT_TARGETS.contains(&target) || (target.starts_with("trainer.skill.") && target.ends_with(".check_bonus") && valid_skill_ids.contains(target.trim_start_matches("trainer.skill.").trim_end_matches(".check_bonus")));
                        if !target_valid {
                            issues.push(error_issue("gm_change_unsupported_target", format!("\"{target}\" is not a supported fixed-grant target."), Some("payload.target".to_string()), false));
                        }
                        if !valid_numeric_operation(operation) {
                            issues.push(error_issue("gm_change_invalid_operation", format!("\"{operation}\" is not a supported numeric operation (add/multiply/set/min/max)."), Some("payload.operation".to_string()), false));
                        }
                        let Some(value) = value.filter(|v| v.is_finite()) else {
                            issues.push(error_issue("gm_change_invalid_value", "payload.value must be a finite number.".to_string(), Some("payload.value".to_string()), false));
                            return empty(action, grant_kind, issues);
                        };
                        if !issues.is_empty() {
                            return empty(action, grant_kind, issues);
                        }
                        let grant = serde_json::json!({"id": grant_id, "kind": "fixed", "target": target, "operation": operation, "value": value, "priority": 100, "note": note, "created_at": now});
                        TrainerGmChangeResolution { action: action.to_string(), grant_kind: grant_kind.to_string(), grant_id: Some(grant_id), effective_grant: Some(grant), linked_acquisition: None, linked_stat_entries: vec![], dependent_invalidations: vec![], issues }
                    }
                }
                "resource" => {
                    let resource = payload.get("resource").and_then(Value::as_str).unwrap_or("");
                    let amount = payload.get("amount").and_then(Value::as_i64);
                    if !matches!(resource, "edge" | "feature" | "stat_points") {
                        issues.push(error_issue("gm_change_unsupported_resource", format!("\"{resource}\" is not a supported resource kind (edge/feature/stat_points)."), Some("payload.resource".to_string()), false));
                    }
                    let Some(amount) = amount.filter(|a| *a > 0) else {
                        issues.push(error_issue("gm_change_invalid_amount", "payload.amount must be a positive integer.".to_string(), Some("payload.amount".to_string()), false));
                        return empty(action, grant_kind, issues);
                    };
                    if !issues.is_empty() {
                        return empty(action, grant_kind, issues);
                    }
                    let allocation = payload.get("allocation").cloned().unwrap_or(Value::Null);
                    let (linked_acquisition, linked_stat_entries) = resolve_resource_allocation(definitions_conn, rules, existing_profile, resource, &grant_id, &allocation, &mut issues);
                    let grant = serde_json::json!({"id": grant_id, "kind": "resource", "resource": resource, "amount": amount, "allocation": allocation, "note": note, "created_at": now});
                    TrainerGmChangeResolution { action: action.to_string(), grant_kind: grant_kind.to_string(), grant_id: Some(grant_id), effective_grant: Some(grant), linked_acquisition, linked_stat_entries, dependent_invalidations: vec![], issues }
                }
                other => {
                    issues.push(error_issue("gm_change_unknown_grant_kind", format!("\"{other}\" is not \"fixed\" or \"resource\"."), Some("grant_kind".to_string()), false));
                    empty(action, grant_kind, issues)
                }
            }
        }
        "edit" => {
            let Some(grant_id) = payload.get("grant_id").and_then(Value::as_str) else {
                issues.push(error_issue("gm_change_missing_grant_id", "payload.grant_id is required to edit a grant.".to_string(), Some("payload.grant_id".to_string()), false));
                return empty(action, grant_kind, issues);
            };
            let Some(existing_grant) = find_grant(&existing_profile.gm_grants, grant_id) else {
                issues.push(error_issue("gm_change_grant_not_found", format!("Grant \"{grant_id}\" was not found on this Trainer."), Some("payload.grant_id".to_string()), false));
                return empty(action, grant_kind, issues);
            };
            let existing_kind = existing_grant.get("kind").and_then(Value::as_str).unwrap_or("");
            if existing_kind != grant_kind {
                issues.push(error_issue("gm_change_kind_immutable", format!("Grant \"{grant_id}\" is kind \"{existing_kind}\"; a grant's kind cannot change on edit."), Some("grant_kind".to_string()), false));
                return empty(action, grant_kind, issues);
            }
            let mut updated = existing_grant.as_object().cloned().unwrap_or_default();
            let mut dependent_invalidations = Vec::new();
            let mut linked_acquisition = None;
            let mut linked_stat_entries = Vec::new();
            match grant_kind {
                "fixed" => {
                    if updated.contains_key("definition_version_id") {
                        issues.push(error_issue("gm_change_definitional_grant_immutable", "A definitional fixed grant's definition cannot be edited; remove and add a new one instead.".to_string(), Some("payload".to_string()), false));
                    } else {
                        if let Some(op) = payload.get("operation").and_then(Value::as_str) {
                            if !valid_numeric_operation(op) {
                                issues.push(error_issue("gm_change_invalid_operation", format!("\"{op}\" is not a supported numeric operation."), Some("payload.operation".to_string()), false));
                            } else {
                                updated.insert("operation".to_string(), Value::String(op.to_string()));
                            }
                        }
                        if let Some(value) = payload.get("value").and_then(Value::as_f64) {
                            if !value.is_finite() {
                                issues.push(error_issue("gm_change_invalid_value", "payload.value must be a finite number.".to_string(), Some("payload.value".to_string()), false));
                            } else {
                                updated.insert("value".to_string(), serde_json::json!(value));
                            }
                        }
                    }
                }
                "resource" => {
                    if let Some(new_allocation) = payload.get("allocation") {
                        let resource = updated.get("resource").and_then(Value::as_str).unwrap_or("").to_string();
                        let (new_link, new_stat_entries) = resolve_resource_allocation(definitions_conn, rules, existing_profile, &resource, grant_id, new_allocation, &mut issues);
                        if existing_grant.get("allocation").map(|a| a != new_allocation).unwrap_or(true) {
                            dependent_invalidations.push(format!("Grant \"{grant_id}\"'s prior allocation is replaced by this edit; any acquisition/stat points it funded are superseded."));
                        }
                        updated.insert("allocation".to_string(), new_allocation.clone());
                        linked_acquisition = new_link;
                        linked_stat_entries = new_stat_entries;
                    }
                    if let Some(amount) = payload.get("amount").and_then(Value::as_i64) {
                        if amount <= 0 {
                            issues.push(error_issue("gm_change_invalid_amount", "payload.amount must be a positive integer.".to_string(), Some("payload.amount".to_string()), false));
                        } else {
                            updated.insert("amount".to_string(), serde_json::json!(amount));
                        }
                    }
                }
                _ => {}
            }
            if let Some(n) = note {
                updated.insert("note".to_string(), Value::String(n.clone()));
            }
            updated.insert("updated_at".to_string(), Value::String(now));
            TrainerGmChangeResolution { action: action.to_string(), grant_kind: grant_kind.to_string(), grant_id: Some(grant_id.to_string()), effective_grant: Some(Value::Object(updated)), linked_acquisition, linked_stat_entries, dependent_invalidations, issues }
        }
        "remove" => {
            let Some(grant_id) = payload.get("grant_id").and_then(Value::as_str) else {
                issues.push(error_issue("gm_change_missing_grant_id", "payload.grant_id is required to remove a grant.".to_string(), Some("payload.grant_id".to_string()), false));
                return empty(action, grant_kind, issues);
            };
            let Some(existing_grant) = find_grant(&existing_profile.gm_grants, grant_id) else {
                issues.push(error_issue("gm_change_grant_not_found", format!("Grant \"{grant_id}\" was not found on this Trainer."), Some("payload.grant_id".to_string()), false));
                return empty(action, grant_kind, issues);
            };
            let mut dependent_invalidations = Vec::new();
            let linked: Vec<&Value> = existing_profile
                .edges
                .iter()
                .chain(existing_profile.features.iter())
                .chain(existing_profile.moves.iter())
                .chain(existing_profile.capabilities.iter())
                .filter(|a| a.get("source_id").and_then(Value::as_str) == Some(grant_id))
                .collect();
            for l in &linked {
                dependent_invalidations.push(format!("Removing grant \"{grant_id}\" also removes the acquisition it funded: \"{}\".", l.get("definition_version_id").and_then(Value::as_str).unwrap_or("?")));
            }
            TrainerGmChangeResolution { action: action.to_string(), grant_kind: existing_grant.get("kind").and_then(Value::as_str).unwrap_or(grant_kind).to_string(), grant_id: Some(grant_id.to_string()), effective_grant: None, linked_acquisition: None, linked_stat_entries: vec![], dependent_invalidations, issues }
        }
        other => {
            issues.push(error_issue("gm_change_unknown_action", format!("\"{other}\" is not \"add\", \"edit\", or \"remove\"."), Some("action".to_string()), false));
            empty(action, grant_kind, issues)
        }
    }
}

/// T13D4-R1B: parses a resource grant's `edge`/`feature` allocation,
/// which may be EITHER the original parameterless form (a plain
/// `definition_version_id` string — preserved for backward compatibility
/// with allocations that never needed a parameter) OR the structured form
/// `{definition_version_id, parameters}` (same shape D3's own
/// `AcquisitionIntent.parameters` already uses), needed so parameterized
/// Skill Edges (Basic Skills' target skill, Categoric Inclination's
/// category, etc.) can be legally resource-allocated at all.
fn parse_resource_allocation_target(allocation: &Value, resource: &str, issues: &mut Vec<BuildIssue>) -> Option<(String, Value)> {
    if let Some(dvi) = allocation.as_str() {
        return Some((dvi.to_string(), Value::Null));
    }
    if let Some(obj) = allocation.as_object() {
        if let Some(dvi) = obj.get("definition_version_id").and_then(Value::as_str) {
            return Some((dvi.to_string(), obj.get("parameters").cloned().unwrap_or(Value::Null)));
        }
    }
    issues.push(error_issue("gm_change_invalid_allocation", format!("A \"{resource}\" resource's allocation must be a definition_version_id string or a {{definition_version_id, parameters}} object."), Some("payload.allocation".to_string()), false));
    None
}

/// Resolves a resource grant's `allocation` (if provided) into a real
/// linked acquisition (`edge`/`feature` resource) or Stat Allocation
/// entries (`stat_points` resource) — `None`/empty when `allocation` is
/// `Value::Null` (an unallocated capacity grant, entirely legal on its
/// own: "GM Resource choices: ... bounded allocations", not a
/// requirement that every resource be spent immediately).
///
/// T13D4-R1B: an `edge`/`feature` allocation that resolves to one of the
/// eight accepted Skill Edge policies is now given its REAL parameters
/// (was hardcoded `Value::Null`, which made every parameterized policy —
/// Basic/Adept/Expert/Master Skills, Skill Enhancement, Categoric
/// Inclination, Skill Stunt, Virtuoso — permanently reject with a missing-
/// parameter issue; confirmed BLOCKER, `T13D4_BUILD_CONTRACT_REVIEW.md`).
/// The resulting acquisition JSON additively carries
/// `granted_skill_rank_change`/`granted_check_bonus` — informational AND
/// the durable record `apply_granted_skill_rank_change`/
/// `revert_granted_skill_rank_change` (below) act on when this
/// acquisition is added/removed, so the effect is real and reversible,
/// never just a validated-then-discarded parameter.
fn resolve_resource_allocation(definitions_conn: &Connection, rules: &TrainerBuildRules, existing_profile: &TrainerProfile, resource: &str, grant_id: &str, allocation: &Value, issues: &mut Vec<BuildIssue>) -> (Option<Value>, Vec<StatAllocationEntry>) {
    if allocation.is_null() {
        return (None, vec![]);
    }
    match resource {
        "edge" | "feature" => {
            let Some((dvi, parameters)) = parse_resource_allocation_target(allocation, resource, issues) else {
                return (None, vec![]);
            };
            let kind = if resource == "edge" { ContentKind::Edge } else { ContentKind::Feature };
            let Ok(Some(record)) = get_definition_by_version_id(definitions_conn, kind, &dvi) else {
                issues.push(error_issue("acquisition_definition_not_found", format!("\"{dvi}\" does not exist in the active content."), Some("payload.allocation".to_string()), false));
                return (None, vec![]);
            };
            if !record.enabled {
                issues.push(error_issue("acquisition_definition_disabled", format!("\"{dvi}\" is disabled and cannot be allocated."), Some("payload.allocation".to_string()), false));
            }
            let combined: Vec<Value> = existing_profile.edges.iter().chain(existing_profile.features.iter()).cloned().collect();
            let acquired_state = AcquiredState { acquired: &combined, skills: &existing_profile.skills, level: existing_profile.level };
            let skill_edge_by_dvi: HashMap<&str, &SkillEdgeCatalogEntry> = rules.skill_edges.entries.iter().map(|e| (e.definition_version_id.as_str(), e)).collect();
            let mut granted_skill_rank_change: Option<Value> = None;
            let mut granted_check_bonus: HashMap<String, i64> = HashMap::new();
            if let Some(policy) = skill_edge_by_dvi.get(dvi.as_str()) {
                let (used_e, used_s, used_v, seen_c) = scan_existing_skill_edge_usage(&existing_profile.edges, &skill_edge_by_dvi);
                let outcome = apply_skill_edge(policy, &parameters, &existing_profile.skills, existing_profile.level, &[], "payload.allocation", &used_e, &used_s, &used_v, seen_c);
                issues.extend(outcome.issues);
                if let Some((skill_id, to_rank)) = &outcome.new_skill_rank {
                    let from_rank = crate::engine::trainer_core::skill_rank(&existing_profile.skills, skill_id);
                    granted_skill_rank_change = Some(serde_json::json!({"skill_id": skill_id, "from_rank": serde_json::to_value(from_rank).unwrap_or(Value::Null), "to_rank": to_rank}));
                }
                for (skill_id, bonus) in outcome.check_bonus {
                    *granted_check_bonus.entry(skill_id).or_insert(0) += bonus;
                }
            } else {
                match check_definition_prerequisites(&record.data_json, &acquired_state, false) {
                    Some(PrereqEval::Met) | None => {}
                    Some(PrereqEval::NotMet(reason)) => issues.push(error_issue("prerequisite_not_met", format!("\"{dvi}\": {reason}"), Some("payload.allocation".to_string()), true)),
                    Some(PrereqEval::ManualReview(reason)) => issues.push(manual_review_issue(Some("payload.allocation".to_string()), format!("\"{dvi}\": {reason}"))),
                }
            }
            let acquisition = serde_json::json!({
                "definition_version_id": dvi,
                "parameters": parameters,
                "policy_kind": kind.kind_slug(),
                "source": "gm_resource",
                "source_id": grant_id,
                "level": existing_profile.level,
                "sequence": 0,
                "granted_skill_rank_change": granted_skill_rank_change,
                "granted_check_bonus": granted_check_bonus,
            });
            (Some(acquisition), vec![])
        }
        "stat_points" => {
            let Some(alloc_obj) = allocation.as_object() else {
                issues.push(error_issue("gm_change_invalid_allocation", "A \"stat_points\" resource's allocation must be an object of {stat: points}.".to_string(), Some("payload.allocation".to_string()), false));
                return (None, vec![]);
            };
            let mut entries = Vec::new();
            for (stat_name, points) in alloc_obj {
                let Some(stat) = serde_json::from_value::<TrainerCombatStat>(Value::String(stat_name.clone())).ok() else {
                    issues.push(error_issue("gm_change_invalid_allocation", format!("\"{stat_name}\" is not a recognized Combat Stat."), Some("payload.allocation".to_string()), false));
                    continue;
                };
                let Some(points) = points.as_i64().filter(|p| *p > 0) else {
                    issues.push(error_issue("gm_change_invalid_allocation", format!("Allocation for \"{stat_name}\" must be a positive integer."), Some("payload.allocation".to_string()), false));
                    continue;
                };
                entries.push(StatAllocationEntry { stat, source: StatAllocationSource::GmOverride, level: existing_profile.level, points, note: Some(format!("GM resource grant \"{grant_id}\".")), source_id: None });
            }
            (None, entries)
        }
        _ => (None, vec![]),
    }
}

/// T13D4-R1B: applies a resource-allocated acquisition's real
/// `granted_skill_rank_change` (set by `resolve_resource_allocation` when
/// the allocation resolved to a rank-changing Skill Edge policy) to the
/// Trainer's own skill map — the exact same mutation
/// `resolve_advancement_intent`'s `resolve_one` closure already applies
/// for advancement-acquired Skill Edges, reused verbatim in shape. A
/// no-op when the acquisition carries no such change (every other
/// resource/fixed acquisition kind).
fn apply_granted_skill_rank_change(skills: &mut Value, acquisition: &Value) {
    let Some(change) = acquisition.get("granted_skill_rank_change").filter(|v| !v.is_null()) else { return };
    let (Some(skill_id), Some(to_rank)) = (change.get("skill_id").and_then(Value::as_str), change.get("to_rank").and_then(Value::as_str)) else { return };
    if let Some(obj) = skills.as_object_mut() {
        obj.entry(skill_id.to_string()).or_insert_with(|| serde_json::json!({})).as_object_mut().map(|s| s.insert("base_rank".to_string(), Value::String(to_rank.to_string())));
    }
}

/// T13D4-R1B: the inverse of `apply_granted_skill_rank_change` — used
/// when a resource-allocated acquisition carrying a
/// `granted_skill_rank_change` is removed (GM-change `remove`, or an
/// `edit`/respec reallocation superseding it), so "removing/replacing a
/// resource acquisition must not leave its prior effect behind"
/// (T13D4-R1B's own constraint) holds for rank changes too. Conservative
/// by construction: reverts to `from_rank` ONLY if the skill's CURRENT
/// rank still equals exactly what this acquisition set it to — if
/// anything else (a later advancement pick, another grant) changed the
/// skill again since, that independent state is never clobbered.
fn revert_granted_skill_rank_change(skills: &mut Value, acquisition: &Value) {
    let Some(change) = acquisition.get("granted_skill_rank_change").filter(|v| !v.is_null()) else { return };
    let (Some(skill_id), Some(from_rank), Some(to_rank)) = (change.get("skill_id").and_then(Value::as_str), change.get("from_rank").and_then(Value::as_str), change.get("to_rank").and_then(Value::as_str)) else { return };
    let Some(to_rank_enum) = crate::engine::trainer_core::SkillRank::from_str(to_rank) else { return };
    if crate::engine::trainer_core::skill_rank(skills, skill_id) != to_rank_enum {
        return;
    }
    if let Some(obj) = skills.as_object_mut() {
        obj.entry(skill_id.to_string()).or_insert_with(|| serde_json::json!({})).as_object_mut().map(|s| s.insert("base_rank".to_string(), Value::String(from_rank.to_string())));
    }
}

#[allow(clippy::too_many_arguments)]
pub fn preview_trainer_gm_change(definitions_conn: &Connection, profiles_conn: &Connection, ruleset: &CampaignRuleset, e02_content_revision: &str, request: &PreviewTrainerGmChangeRequest) -> Result<TrainerGmChangePreviewResponse, TrainerBuildError> {
    let profile = load_owned_profile(profiles_conn, &request.trainer_id)?;
    let (rules, progression, _milestones, rules_fingerprint) = load_advancement_datasets(definitions_conn, ruleset, &request.content_pack_id, e02_content_revision)?;
    let current_base_revision = compute_base_revision(&profile, &rules_fingerprint);
    if request.expected_base_revision != current_base_revision {
        return Err(TrainerBuildError::StaleRevision { message: "Content context changed".to_string() });
    }
    let resolution = resolve_gm_change_intent(definitions_conn, &rules, &profile, &request.action, &request.grant_kind, &request.payload, &request.note);
    let core_result = resolve_gm_change_core_stats(definitions_conn, &progression, &profile, &resolution);
    Ok(TrainerGmChangePreviewResponse { base_revision: current_base_revision, resolution, core_result })
}

/// PREVIEW-only: `profile` is still the unmutated, currently-persisted
/// Trainer, so this overlays `resolution`'s not-yet-applied grant/
/// acquisition/stat changes on top before resolving stats.
fn resolve_gm_change_core_stats(definitions_conn: &Connection, progression: &[super::datasets::TrainerProgressionRow], profile: &TrainerProfile, resolution: &TrainerGmChangeResolution) -> super::trainer_core::TrainerCoreResult {
    let mut gm_grants = profile.gm_grants.clone();
    apply_gm_change_to_grants(&mut gm_grants, resolution);
    let mut features = profile.features.clone();
    if let Some(link) = &resolution.linked_acquisition {
        if link.get("policy_kind").and_then(Value::as_str) == Some("feature") {
            features.push(link.clone());
        }
    }
    let mut allocation = profile.stat_allocation.clone();
    allocation.entries.extend(resolution.linked_stat_entries.clone());
    let (feature_tag_modifiers, _issues) = derive_feature_tag_modifiers(definitions_conn, &features);
    super::trainer_core::resolve_trainer_core(profile.level, &allocation, &profile.skills, profile.weight_lb, &gm_grants, progression, &feature_tag_modifiers)
}

/// COMMIT-only: `profile` already has every change from a resolution
/// merged in (grants/acquisitions/stat entries) — resolves stats
/// directly from its own final state, with no separate overlay step.
fn resolve_core_stats_for_profile(definitions_conn: &Connection, progression: &[super::datasets::TrainerProgressionRow], profile: &TrainerProfile) -> super::trainer_core::TrainerCoreResult {
    let (feature_tag_modifiers, _issues) = derive_feature_tag_modifiers(definitions_conn, &profile.features);
    super::trainer_core::resolve_trainer_core(profile.level, &profile.stat_allocation, &profile.skills, profile.weight_lb, &profile.gm_grants, progression, &feature_tag_modifiers)
}

fn apply_gm_change_to_grants(grants: &mut Vec<Value>, resolution: &TrainerGmChangeResolution) {
    match resolution.action.as_str() {
        "add" => {
            if let Some(g) = &resolution.effective_grant {
                grants.push(g.clone());
            }
        }
        "edit" => {
            if let (Some(id), Some(g)) = (&resolution.grant_id, &resolution.effective_grant) {
                if let Some(existing) = grants.iter_mut().find(|g| g.get("id").and_then(Value::as_str) == Some(id.as_str())) {
                    *existing = g.clone();
                }
            }
        }
        "remove" => {
            if let Some(id) = &resolution.grant_id {
                grants.retain(|g| g.get("id").and_then(Value::as_str) != Some(id.as_str()));
            }
        }
        _ => {}
    }
}

#[allow(clippy::too_many_arguments)]
pub fn commit_trainer_gm_change(definitions_conn: &Connection, profiles_conn: &mut Connection, ruleset: &CampaignRuleset, e02_content_revision: &str, request: &CommitTrainerGmChangeRequest) -> Result<TrainerGmChangeCommitResponse, TrainerBuildError> {
    if !request.confirm {
        return Err(TrainerBuildError::ConfirmationRequired { message: "confirm must be true to publish a GM grant change".to_string() });
    }
    if request.operation_id.trim().is_empty() {
        return Err(TrainerBuildError::InvalidIntent { message: "operation_id must not be empty".to_string() });
    }

    let profile = load_owned_profile(profiles_conn, &request.trainer_id)?;

    let request_fingerprint = compute_operation_request_fingerprint_generic(serde_json::json!({
        "operation_kind": "trainer_gm_change_commit",
        "trainer_id": request.trainer_id,
        "content_pack_id": request.content_pack_id,
        "action": request.action,
        "grant_kind": request.grant_kind,
        "payload": request.payload,
        "note": request.note,
        "expected_base_revision": request.expected_base_revision,
    }));
    if let Some(receipt) = crate::profile::repository::load_build_operation(profiles_conn, &request.operation_id).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })? {
        if receipt.request_fingerprint != request_fingerprint {
            return Err(TrainerBuildError::OperationConflict { message: format!("operation_id \"{}\" was already used for a different request; use a new operation_id for a new mutation.", request.operation_id) });
        }
        if crate::profile::repository::load_trainer_profile(profiles_conn, &receipt.trainer_id).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?.is_none() {
            return Err(TrainerBuildError::CommittedTargetMissing { message: format!("operation_id \"{}\" previously committed Trainer \"{}\", which no longer exists.", request.operation_id, receipt.trainer_id) });
        }
        let response: TrainerGmChangeCommitResponse = serde_json::from_str(&receipt.response_json).map_err(|e| TrainerBuildError::Internal { message: format!("stored operation receipt is corrupt: {e}") })?;
        return Ok(response);
    }

    let (rules, progression, _milestones, rules_fingerprint) = load_advancement_datasets(definitions_conn, ruleset, &request.content_pack_id, e02_content_revision)?;
    let current_base_revision = compute_base_revision(&profile, &rules_fingerprint);
    if request.expected_base_revision != current_base_revision {
        return Err(TrainerBuildError::StaleRevision { message: "Content context changed".to_string() });
    }

    let resolution = resolve_gm_change_intent(definitions_conn, &rules, &profile, &request.action, &request.grant_kind, &request.payload, &request.note);
    if resolution.has_blocking_issue() {
        return Err(TrainerBuildError::ValidationFailed { issues: resolution.issues.clone() });
    }

    let mut updated_profile = profile.clone();
    apply_gm_change_to_grants(&mut updated_profile.gm_grants, &resolution);
    // T13D4-R1B: for BOTH `remove` and an `edit` that reallocates a
    // resource grant, first strip any PRIOR linked acquisition this same
    // grant funded and revert any real skill-rank effect it carried —
    // "removing/replacing a resource acquisition must not leave its
    // prior effect behind." A no-op for `add` (a fresh grant_id never
    // matches an existing acquisition) and for a `fixed` grant edit
    // (which never has a linked acquisition to begin with, since editing
    // a definitional fixed grant's definition is already rejected
    // upstream by `gm_change_definitional_grant_immutable`).
    if let Some(id) = &resolution.grant_id {
        let mut removed = Vec::new();
        // T13D4-R4 (D1): all FOUR definitional-fixed-grant collections —
        // never just edges/features — must be scanned so a Move/
        // Capability grant's linked acquisition is actually found and
        // removed here too (the confirmed defect: previously these two
        // collections were never checked, so removing/reallocating a
        // move/capability grant left its stale linked row behind
        // wherever it had been misfiled).
        for collection in [&mut updated_profile.edges, &mut updated_profile.features, &mut updated_profile.moves, &mut updated_profile.capabilities] {
            collection.retain(|a| {
                if a.get("source_id").and_then(Value::as_str) == Some(id.as_str()) {
                    removed.push(a.clone());
                    false
                } else {
                    true
                }
            });
        }
        for r in &removed {
            revert_granted_skill_rank_change(&mut updated_profile.skills, r);
        }
    }
    if resolution.action != "remove" {
        if let Some(link) = &resolution.linked_acquisition {
            apply_granted_skill_rank_change(&mut updated_profile.skills, link);
            // T13D4-R4 (D1): route by the acquisition's OWN policy_kind
            // to its OWN collection — the confirmed defect was this
            // falling through to `.features` for anything but "edge".
            match link.get("policy_kind").and_then(Value::as_str) {
                Some("edge") => updated_profile.edges.push(link.clone()),
                Some("move") => updated_profile.moves.push(link.clone()),
                Some("capability") => updated_profile.capabilities.push(link.clone()),
                _ => updated_profile.features.push(link.clone()),
            }
        }
    }
    updated_profile.stat_allocation.entries.extend(resolution.linked_stat_entries.clone());

    let core_result = resolve_core_stats_for_profile(definitions_conn, &progression, &updated_profile);
    let new_base_revision = compute_base_revision(&updated_profile, &rules_fingerprint);
    let response = TrainerGmChangeCommitResponse { trainer_id: updated_profile.id.clone(), base_revision: new_base_revision, resolution, core_result };
    let response_json = serde_json::to_string(&response).map_err(|e| TrainerBuildError::Internal { message: format!("failed to serialize operation response: {e}") })?;

    let tx = profiles_conn.transaction().map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    crate::profile::repository::save_trainer_profile_tx(&tx, &updated_profile).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    crate::profile::repository::record_build_operation_tx(&tx, &request.operation_id, &request_fingerprint, &updated_profile.id, &response_json).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    tx.commit().map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;

    Ok(response)
}

// -----------------------------------------------------------------------
// Respec (plan §3.4: "Trainer ID/revision + proposed normal rebuild and
// authorized resource reallocations... fixed grants unchanged, resource
// grant identity/kind/amount/origin unchanged; transactional replacement
// of allocations only"). Scoped to exactly the two things the source text
// describes as reallocatable: (1) the NORMAL (Creation+LevelUp-sourced)
// stat point distribution — reusing `build_normal_allocation_entries` +
// `merge_with_preserved_provenance` verbatim, the SAME mechanism C1's own
// `save_trainer_stat_allocation` already uses and this task does not
// duplicate; (2) an EXISTING resource grant's `allocation` (never its
// `id`/`kind`/`resource`/`amount` — those are origin/capacity, immutable
// here). Edge/Feature CHOICES themselves (Creation/LevelUp-sourced) are
// not described anywhere in the source table as respec-rebuildable —
// only the stat pool and resource allocations are; this is a disclosed
// scope reading, not a silent narrowing.
// -----------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RespecResourceReallocationIntent {
    pub grant_id: String,
    pub new_allocation: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainerRespecResolution {
    /// The FULL resulting stat allocation — normal entries rebuilt from
    /// `proposed_normal_rebuild`, Milestone/GmOverride entries preserved
    /// verbatim (`merge_with_preserved_provenance`'s own guarantee).
    pub stat_allocation_entries: Vec<StatAllocationEntry>,
    pub preserved_fixed_grant_count: i64,
    pub preserved_resource_grant_count: i64,
    /// Each successfully-resolved reallocation's grant id and its new
    /// linked acquisition/stat entries, if any.
    pub reallocated_grant_ids: Vec<String>,
    pub issues: Vec<BuildIssue>,
}
impl TrainerRespecResolution {
    pub fn has_blocking_issue(&self) -> bool {
        self.issues.iter().any(|i| i.issue.severity == Severity::Error)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainerRespecPreviewResponse {
    pub base_revision: String,
    pub resolution: TrainerRespecResolution,
    pub core_result: super::trainer_core::TrainerCoreResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainerRespecCommitResponse {
    pub trainer_id: String,
    pub base_revision: String,
    pub resolution: TrainerRespecResolution,
    pub core_result: super::trainer_core::TrainerCoreResult,
}

/// Returns: the fully-resolved `TrainerStatAllocation`, the updated
/// `gm_grants` list (reallocated grants replaced in place), the updated
/// `edges`/`features` lists (old resource-linked acquisitions removed,
/// new ones added), and the resolution summary/issues.
#[allow(clippy::too_many_arguments)]
fn resolve_respec_intent(
    definitions_conn: &Connection,
    rules: &TrainerBuildRules,
    progression: &[super::datasets::TrainerProgressionRow],
    existing_profile: &TrainerProfile,
    proposed_normal_rebuild: &Value,
    authorized_resource_reallocations: &[Value],
) -> (TrainerRespecResolution, Vec<Value>, Vec<Value>, Vec<Value>, Value) {
    let mut issues = Vec::new();
    let mut skills = existing_profile.skills.clone();

    let desired: Vec<super::trainer_core::StatAllocationDraftEntry> = match serde_json::from_value(proposed_normal_rebuild.clone()) {
        Ok(d) => d,
        Err(e) => {
            issues.push(error_issue("respec_invalid_normal_rebuild", format!("proposed_normal_rebuild does not match the expected shape: {e}"), Some("proposed_normal_rebuild".to_string()), false));
            vec![]
        }
    };
    let normal_entries = super::trainer_core::build_normal_allocation_entries(&desired, existing_profile.level, progression);
    let merged_allocation = super::trainer_core::merge_with_preserved_provenance(normal_entries, &existing_profile.stat_allocation);

    let mut gm_grants = existing_profile.gm_grants.clone();
    let mut edges = existing_profile.edges.clone();
    let mut features = existing_profile.features.clone();
    let mut reallocated_grant_ids = Vec::new();

    let preserved_fixed_grant_count = gm_grants.iter().filter(|g| g.get("kind").and_then(Value::as_str) == Some("fixed")).count() as i64;
    let preserved_resource_grant_count = gm_grants.iter().filter(|g| g.get("kind").and_then(Value::as_str) == Some("resource")).count() as i64;

    for raw in authorized_resource_reallocations {
        let intent: RespecResourceReallocationIntent = match serde_json::from_value(raw.clone()) {
            Ok(i) => i,
            Err(e) => {
                issues.push(error_issue("respec_invalid_reallocation_shape", format!("authorized_resource_reallocations entry does not match the expected shape: {e}"), Some("authorized_resource_reallocations".to_string()), false));
                continue;
            }
        };
        let field = format!("authorized_resource_reallocations[{}]", intent.grant_id);
        let Some(existing_grant) = find_grant(&gm_grants, &intent.grant_id) else {
            issues.push(error_issue("gm_change_grant_not_found", format!("Grant \"{}\" was not found on this Trainer.", intent.grant_id), Some(field.clone()), false));
            continue;
        };
        if existing_grant.get("kind").and_then(Value::as_str) != Some("resource") {
            issues.push(error_issue("respec_not_a_resource_grant", format!("Grant \"{}\" is not a resource grant and cannot be reallocated by respec.", intent.grant_id), Some(field.clone()), false));
            continue;
        }
        let resource = existing_grant.get("resource").and_then(Value::as_str).unwrap_or("").to_string();
        let mut reallocation_issues = Vec::new();
        let (new_link, new_stat_entries) = resolve_resource_allocation(definitions_conn, rules, existing_profile, &resource, &intent.grant_id, &intent.new_allocation, &mut reallocation_issues);
        if !reallocation_issues.is_empty() {
            issues.extend(reallocation_issues);
            continue;
        }
        // Origin/capacity (`id`/`kind`/`resource`/`amount`) unchanged —
        // `reallocate_resource_grant` is the exact existing pure
        // transform that guarantees this (reused, not duplicated).
        match reallocate_resource_grant(existing_grant, intent.new_allocation.clone()) {
            Ok(updated_grant) => {
                if let Some(g) = gm_grants.iter_mut().find(|g| g.get("id").and_then(Value::as_str) == Some(intent.grant_id.as_str())) {
                    *g = updated_grant;
                }
            }
            Err(e) => {
                issues.push(error_issue("respec_reallocation_failed", e.to_string(), Some(field.clone()), false));
                continue;
            }
        }
        // Drop this grant's OLD linked acquisition (if any) — reverting
        // any real skill-rank effect it carried (T13D4-R1B: "removing/
        // replacing a resource acquisition must not leave its prior
        // effect behind") — before the new one (if the new allocation
        // targets an Edge/Feature) is applied below.
        let mut old_links = Vec::new();
        edges.retain(|a| {
            if a.get("source_id").and_then(Value::as_str) == Some(intent.grant_id.as_str()) {
                old_links.push(a.clone());
                false
            } else {
                true
            }
        });
        features.retain(|a| {
            if a.get("source_id").and_then(Value::as_str) == Some(intent.grant_id.as_str()) {
                old_links.push(a.clone());
                false
            } else {
                true
            }
        });
        for old in &old_links {
            revert_granted_skill_rank_change(&mut skills, old);
        }
        if let Some(link) = new_link {
            apply_granted_skill_rank_change(&mut skills, &link);
            if link.get("policy_kind").and_then(Value::as_str) == Some("edge") {
                edges.push(link);
            } else {
                features.push(link);
            }
        }
        let _ = new_stat_entries; // stat_points reallocation is folded into merged_allocation's own Milestone/GmOverride-preserved entries below.
        reallocated_grant_ids.push(intent.grant_id.clone());
    }

    let resolution = TrainerRespecResolution { stat_allocation_entries: merged_allocation.entries.clone(), preserved_fixed_grant_count, preserved_resource_grant_count, reallocated_grant_ids, issues };
    (resolution, gm_grants, edges, features, skills)
}

#[allow(clippy::too_many_arguments)]
pub fn preview_trainer_respec(definitions_conn: &Connection, profiles_conn: &Connection, ruleset: &CampaignRuleset, e02_content_revision: &str, request: &PreviewTrainerRespecRequest) -> Result<TrainerRespecPreviewResponse, TrainerBuildError> {
    let profile = load_owned_profile(profiles_conn, &request.trainer_id)?;
    let (rules, progression, _milestones, rules_fingerprint) = load_advancement_datasets(definitions_conn, ruleset, &request.content_pack_id, e02_content_revision)?;
    let current_base_revision = compute_base_revision(&profile, &rules_fingerprint);
    if request.expected_base_revision != current_base_revision {
        return Err(TrainerBuildError::StaleRevision { message: "Content context changed".to_string() });
    }
    let (resolution, gm_grants, edges, features, skills) = resolve_respec_intent(definitions_conn, &rules, &progression, &profile, &request.proposed_normal_rebuild, &request.authorized_resource_reallocations);
    let mut preview_profile = profile.clone();
    preview_profile.stat_allocation = crate::profile::model::TrainerStatAllocation { entries: resolution.stat_allocation_entries.clone() };
    preview_profile.gm_grants = gm_grants;
    preview_profile.edges = edges;
    preview_profile.features = features;
    preview_profile.skills = skills;
    let core_result = resolve_core_stats_for_profile(definitions_conn, &progression, &preview_profile);
    Ok(TrainerRespecPreviewResponse { base_revision: current_base_revision, resolution, core_result })
}

#[allow(clippy::too_many_arguments)]
pub fn commit_trainer_respec(definitions_conn: &Connection, profiles_conn: &mut Connection, ruleset: &CampaignRuleset, e02_content_revision: &str, request: &CommitTrainerRespecRequest) -> Result<TrainerRespecCommitResponse, TrainerBuildError> {
    if !request.confirm {
        return Err(TrainerBuildError::ConfirmationRequired { message: "confirm must be true to publish a respec".to_string() });
    }
    if request.operation_id.trim().is_empty() {
        return Err(TrainerBuildError::InvalidIntent { message: "operation_id must not be empty".to_string() });
    }

    let profile = load_owned_profile(profiles_conn, &request.trainer_id)?;

    let request_fingerprint = compute_operation_request_fingerprint_generic(serde_json::json!({
        "operation_kind": "trainer_respec_commit",
        "trainer_id": request.trainer_id,
        "content_pack_id": request.content_pack_id,
        "proposed_normal_rebuild": request.proposed_normal_rebuild,
        "authorized_resource_reallocations": request.authorized_resource_reallocations,
        "expected_base_revision": request.expected_base_revision,
    }));
    if let Some(receipt) = crate::profile::repository::load_build_operation(profiles_conn, &request.operation_id).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })? {
        if receipt.request_fingerprint != request_fingerprint {
            return Err(TrainerBuildError::OperationConflict { message: format!("operation_id \"{}\" was already used for a different request; use a new operation_id for a new mutation.", request.operation_id) });
        }
        if crate::profile::repository::load_trainer_profile(profiles_conn, &receipt.trainer_id).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?.is_none() {
            return Err(TrainerBuildError::CommittedTargetMissing { message: format!("operation_id \"{}\" previously committed Trainer \"{}\", which no longer exists.", request.operation_id, receipt.trainer_id) });
        }
        let response: TrainerRespecCommitResponse = serde_json::from_str(&receipt.response_json).map_err(|e| TrainerBuildError::Internal { message: format!("stored operation receipt is corrupt: {e}") })?;
        return Ok(response);
    }

    let (rules, progression, _milestones, rules_fingerprint) = load_advancement_datasets(definitions_conn, ruleset, &request.content_pack_id, e02_content_revision)?;
    let current_base_revision = compute_base_revision(&profile, &rules_fingerprint);
    if request.expected_base_revision != current_base_revision {
        return Err(TrainerBuildError::StaleRevision { message: "Content context changed".to_string() });
    }

    let (resolution, gm_grants, edges, features, skills) = resolve_respec_intent(definitions_conn, &rules, &progression, &profile, &request.proposed_normal_rebuild, &request.authorized_resource_reallocations);
    if resolution.has_blocking_issue() {
        return Err(TrainerBuildError::ValidationFailed { issues: resolution.issues.clone() });
    }

    let mut updated_profile = profile.clone();
    updated_profile.stat_allocation = crate::profile::model::TrainerStatAllocation { entries: resolution.stat_allocation_entries.clone() };
    updated_profile.gm_grants = gm_grants;
    updated_profile.edges = edges;
    updated_profile.features = features;
    updated_profile.skills = skills;

    let core_result = resolve_core_stats_for_profile(definitions_conn, &progression, &updated_profile);
    let new_base_revision = compute_base_revision(&updated_profile, &rules_fingerprint);
    let response = TrainerRespecCommitResponse { trainer_id: updated_profile.id.clone(), base_revision: new_base_revision, resolution, core_result };
    let response_json = serde_json::to_string(&response).map_err(|e| TrainerBuildError::Internal { message: format!("failed to serialize operation response: {e}") })?;

    let tx = profiles_conn.transaction().map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    crate::profile::repository::save_trainer_profile_tx(&tx, &updated_profile).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    crate::profile::repository::record_build_operation_tx(&tx, &request.operation_id, &request_fingerprint, &updated_profile.id, &response_json).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    tx.commit().map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;

    Ok(response)
}

// =======================================================================
// T13D4-R2 — dedicated pending-milestone reconciliation (Core pp19-20;
// `T13D4_R1Q_PLANNER_DISPOSITION.md` P1-P5, approved with the mandatory
// P4 condition in `T13D4_R1_RECHECK_AND_R1Q_GATE.md` Decision B). A
// SEPARATE command pair — deliberately NOT an overload of `next_level` on
// the existing advancement gate, which correctly rejects anything but
// `current_level + 1` (R1Q proved no other path exists, and the gate
// re-review confirmed removing that guard would risk duplicate awards).
// Reconciles ONE already-reached, still-unresolved milestone choice —
// NEVER changes level/EXP/ordinary budgets/ordinary acquisitions/normal
// stat entries, NEVER re-grants a benefit already resolved or already
// explicitly mapped onto existing legacy state (P2: "never guess that an
// empty ledger means no past benefit" — `prior_benefits` is REQUIRED and
// explicit on every request, preview included).
// =======================================================================

/// P2's explicit legacy disposition: `not_received` (no prior benefit —
/// every due benefit is freshly granted) or `map_existing` (some/all due
/// benefits are already represented by existing state, identified by
/// `mappings`). Never inferred from an empty progression ledger.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewTrainerMilestoneReconciliationRequest {
    pub trainer_id: String,
    pub content_pack_id: String,
    pub expected_base_revision: String,
    /// The specific milestone tier being reconciled (5/10/20/30/40) —
    /// NEVER a `next_level`; this Trainer's `level` never changes.
    pub milestone_level: i64,
    #[serde(default)]
    pub milestone_option_id: Option<String>,
    /// One `AdvancementAcquisitionIntent`-shaped entry per UNMAPPED
    /// alternative-Edge/General-Feature benefit due, in benefit order.
    #[serde(default)]
    pub acquired_choices: Vec<Value>,
    #[serde(default)]
    pub stat_stream_choice: Option<String>,
    #[serde(default)]
    pub manual_adjudications: Vec<Value>,
    /// `{"disposition": "not_received" | "map_existing", "note": "<GM-
    /// attributed text>", "mappings": [{"benefit_id", "kind": "edge" |
    /// "feature" | "stat_entry", "index", "expected_value"}, ...]}` —
    /// REQUIRED on every request, preview included.
    pub prior_benefits: Value,
}

/// T13D4-R2 contract delta (disclosed) on top of the frozen preview
/// shape: `confirm`/`operation_id`, same convention every other D4 family
/// already uses.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitTrainerMilestoneReconciliationRequest {
    pub trainer_id: String,
    pub content_pack_id: String,
    pub expected_base_revision: String,
    pub milestone_level: i64,
    #[serde(default)]
    pub milestone_option_id: Option<String>,
    #[serde(default)]
    pub acquired_choices: Vec<Value>,
    #[serde(default)]
    pub stat_stream_choice: Option<String>,
    #[serde(default)]
    pub manual_adjudications: Vec<Value>,
    pub prior_benefits: Value,
    pub confirm: bool,
    pub operation_id: String,
}

/// One source-defined benefit's outcome this reconciliation reports back
/// — `status: "new" | "adopted"`, matching `ReconciledBenefitRecord`'s
/// own persisted record verbatim (same identities, never renamed between
/// preview and the stored metadata).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReconciledBenefitOutcome {
    pub benefit_id: String,
    pub kind: String,
    pub status: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MilestoneReconciliationResolution {
    /// Always equal — reconciliation never advances level (P1/P3).
    pub from_level: i64,
    pub to_level: i64,
    pub milestone_level: i64,
    pub option: Option<String>,
    pub benefits: Vec<ReconciledBenefitOutcome>,
    /// NEW stat-stream benefit entries this commit would add (empty for
    /// adopted-only benefits) — each carries `source_id` = its
    /// `benefit_id` (T13D4-R2's own use of the P4-approved field).
    pub stat_allocation_entries: Vec<StatAllocationEntry>,
    /// NEW alternative Edge acquisitions this commit would add.
    pub edges: Vec<Value>,
    /// NEW alternative Feature acquisitions this commit would add.
    pub features: Vec<Value>,
    /// Every other milestone level (5/10/20/30/40, at or below the
    /// Trainer's current level) that still has no resolved choice, AFTER
    /// this one is resolved.
    pub remaining_pending_milestone_levels: Vec<i64>,
    pub issues: Vec<BuildIssue>,
}
impl MilestoneReconciliationResolution {
    pub fn has_blocking_issue(&self) -> bool {
        self.issues.iter().any(|i| i.issue.severity == Severity::Error)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainerMilestoneReconciliationPreviewResponse {
    pub base_revision: String,
    pub resolution: MilestoneReconciliationResolution,
    pub core_result: super::trainer_core::TrainerCoreResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainerMilestoneReconciliationCommitResponse {
    pub trainer_id: String,
    pub base_revision: String,
    pub resolution: MilestoneReconciliationResolution,
    pub core_result: super::trainer_core::TrainerCoreResult,
}

/// One source-defined benefit a milestone tier owes, computed fresh from
/// `rules.offensive_stat_streams` each resolution — never hardcoded to a
/// specific level, so whatever real tiers the shipped data defines (today
/// only level 5 has a retroactive component; 10/20/30/40 do not) are
/// handled generically.
struct DueBenefit {
    benefit_id: String,
    kind: &'static str,
    /// The EXACT points a `stat_entry` mapping must carry to genuinely
    /// satisfy this benefit — `None` for alternative Edge/Feature
    /// benefits. T13D4-R3A: `adopt_mapping` checks this, not just
    /// freshness/ownership (a fresh-but-wrong-quantity entry must never
    /// silently settle a benefit it doesn't actually represent).
    points: Option<i64>,
    /// The locked offensive stat (Attack/Special Attack) a `stat_entry`
    /// mapping must carry — `None` for alternative benefits. Source
    /// rules remain authoritative here: only Attack/Special Attack are
    /// ever populated (Core p19's own two stream stats), never any other
    /// stat.
    stat: Option<TrainerCombatStat>,
    description: String,
}

fn compute_due_benefits(stream: &super::datasets::OffensiveStatStream, milestone_level: i64, current_level: i64, option: &str, stat: Option<TrainerCombatStat>) -> Result<Vec<DueBenefit>, BuildIssue> {
    match option {
        "stat_stream" => {
            let mut due = Vec::new();
            if !stream.retroactive_bonus_levels.is_empty() {
                if let Some(points) = stream.retroactive_bonus_points_each {
                    due.push(DueBenefit {
                        benefit_id: format!("reconcile:{milestone_level}:retroactive"),
                        kind: "stat_stream_retroactive",
                        points: Some(points),
                        stat,
                        description: format!("Retroactive offensive-stat-stream bonus (Core p19), covering levels {:?}.", stream.retroactive_bonus_levels),
                    });
                }
            }
            for &ongoing_level in stream.ongoing_bonus_levels.iter().filter(|&&l| l <= current_level) {
                due.push(DueBenefit {
                    benefit_id: format!("reconcile:{milestone_level}:ongoing:{ongoing_level}"),
                    kind: "stat_stream_ongoing",
                    points: Some(stream.ongoing_bonus_points_each),
                    stat,
                    description: format!("Offensive-stat-stream ongoing bonus at level {ongoing_level} (Core p19-20)."),
                });
            }
            Ok(due)
        }
        "edges" | "general_feature" => {
            let Some(alt) = stream.alternative_options.iter().find(|o| o.get("kind").and_then(Value::as_str) == Some(if option == "edges" { "edges" } else { "general_feature" })) else {
                return Err(error_issue("milestone_option_unsupported", format!("Level {milestone_level} does not offer the \"{option}\" alternative."), Some("milestone_option_id".to_string()), false));
            };
            let count = alt.get("count").and_then(Value::as_i64).unwrap_or(1).max(0);
            let kind_str = if option == "edges" { "alternative_edge" } else { "alternative_general_feature" };
            Ok((0..count)
                .map(|i| DueBenefit { benefit_id: format!("reconcile:{milestone_level}:alternative:{i}"), kind: kind_str, points: None, stat: None, description: format!("Milestone alternative benefit #{i} ({option}).") })
                .collect())
        }
        other => Err(error_issue("milestone_option_unknown", format!("Unknown milestone_option_id {other:?}."), Some("milestone_option_id".to_string()), false)),
    }
}

/// Every milestone level (5/10/20/30/40, at or below `profile.level`)
/// that still has no resolved choice — read from the SAME two ledger
/// fields (`milestone_option_kind`/`milestone_choice`) both ordinary
/// advancement and reconciliation write, so a level resolved either way
/// is equally "no longer pending."
fn compute_remaining_pending_milestone_levels(milestones: &[super::datasets::TrainerMilestoneRow], rules: &TrainerBuildRules, profile: &TrainerProfile) -> Vec<i64> {
    let resolved: HashSet<i64> = profile
        .progression
        .iter()
        .filter_map(|v| {
            let parsed: super::trainer_core::ProgressionLedgerEntry = serde_json::from_value(v.clone()).ok()?;
            if parsed.milestone_option_kind.is_some() || parsed.milestone_choice.is_some() {
                Some(parsed.level)
            } else {
                None
            }
        })
        .collect();
    let mut levels: Vec<i64> = milestones
        .iter()
        .filter(|m| m.level <= profile.level)
        .filter(|m| !m.choice_options.is_empty() || stream_at_level(rules, m.level).is_some())
        .filter(|m| !resolved.contains(&m.level))
        .map(|m| m.level)
        .collect();
    levels.sort_unstable();
    levels
}

/// Validates one `prior_benefits.mappings` entry against a specific due
/// benefit and, on success, returns which existing list/index to mark
/// adopted. Rejects: wrong kind for this benefit category, out-of-bounds
/// index, a stale/foreign `expected_value` mismatch, an entry already
/// owned by another source, double-mapping the same index twice in one
/// request, AND — T13D4-R3A (confirmed BLOCKER,
/// `T13D4_R2_IMPLEMENTATION_REVIEW.md`: "expected_value matching proves
/// the selected entry is current, NOT that it satisfies the source-
/// defined benefit") — a freshness/ownership match that is semantically
/// WRONG for the benefit it claims: a `stat_entry` mapping must carry the
/// benefit's own locked stat and exact due points (never rewritten into
/// the desired value — rejected instead), and an `edge`/`feature`
/// mapping must resolve to an existing, enabled definition satisfying
/// the SAME eligibility a brand-new choice for that benefit would need
/// (general-Feature-ness for a `general_feature` benefit; the
/// definition's own textual prerequisites, evaluated against the
/// Trainer's acquired state with this ONE acquisition excluded so it can
/// neither self-satisfy its own prerequisite nor be treated as a second,
/// duplicate acquisition of itself) — reusing `check_definition_prerequisites`
/// only, deliberately NEVER `apply_skill_edge`, so adoption can never
/// re-award a rank/check-bonus effect a second time.
#[allow(clippy::too_many_arguments)]
fn adopt_mapping(definitions_conn: &Connection, existing_profile: &TrainerProfile, benefit: &DueBenefit, mapping: &Value, used_edge_indices: &mut HashSet<usize>, used_feature_indices: &mut HashSet<usize>, used_stat_indices: &mut HashSet<usize>, issues: &mut Vec<BuildIssue>) -> Option<(&'static str, usize)> {
    let field = format!("prior_benefits.mappings[{}]", benefit.benefit_id);
    let Some(kind) = mapping.get("kind").and_then(Value::as_str) else {
        issues.push(error_issue("reconciliation_mapping_invalid", "mapping.kind is required (\"edge\" | \"feature\" | \"stat_entry\").".to_string(), Some(field.clone()), false));
        return None;
    };
    let Some(index) = mapping.get("index").and_then(Value::as_u64).map(|i| i as usize) else {
        issues.push(error_issue("reconciliation_mapping_invalid", "mapping.index is required.".to_string(), Some(field.clone()), false));
        return None;
    };
    let Some(expected_value) = mapping.get("expected_value") else {
        issues.push(error_issue("reconciliation_mapping_invalid", "mapping.expected_value is required.".to_string(), Some(field.clone()), false));
        return None;
    };
    let expected_kind_category = match benefit.kind {
        "stat_stream_retroactive" | "stat_stream_ongoing" => "stat_entry",
        "alternative_edge" => "edge",
        "alternative_general_feature" => "feature",
        _ => "",
    };
    if kind != expected_kind_category {
        issues.push(error_issue("reconciliation_mapping_wrong_kind", format!("Benefit \"{}\" requires a \"{expected_kind_category}\" mapping, got \"{kind}\".", benefit.benefit_id), Some(field.clone()), false));
        return None;
    }
    match kind {
        "stat_entry" => {
            let Some(entry) = existing_profile.stat_allocation.entries.get(index) else {
                issues.push(error_issue("reconciliation_mapping_index_out_of_bounds", format!("stat_allocation.entries[{index}] does not exist."), Some(field.clone()), false));
                return None;
            };
            if entry.source_id.is_some() {
                issues.push(error_issue("reconciliation_mapping_already_owned", format!("stat_allocation.entries[{index}] is already attributed to another benefit."), Some(field.clone()), false));
                return None;
            }
            let actual_value = serde_json::to_value(entry).unwrap_or(Value::Null);
            if &actual_value != expected_value {
                issues.push(error_issue("reconciliation_mapping_value_mismatch", format!("stat_allocation.entries[{index}] no longer matches the expected value supplied — it may be stale or foreign."), Some(field.clone()), false));
                return None;
            }
            if Some(entry.stat) != benefit.stat {
                issues.push(error_issue(
                    "reconciliation_mapping_wrong_stat",
                    format!("stat_allocation.entries[{index}] is \"{:?}\", but benefit \"{}\" requires the stream's own locked stat (\"{:?}\"); a current entry is not automatically the right one.", entry.stat, benefit.benefit_id, benefit.stat),
                    Some(field.clone()),
                    false,
                ));
                return None;
            }
            if Some(entry.points) != benefit.points {
                issues.push(error_issue(
                    "reconciliation_mapping_wrong_points",
                    format!("stat_allocation.entries[{index}] carries {} point(s), but benefit \"{}\" requires exactly {:?}; adoption never rewrites the quantity, so an entry with the wrong amount cannot settle it.", entry.points, benefit.benefit_id, benefit.points),
                    Some(field.clone()),
                    false,
                ));
                return None;
            }
            if used_stat_indices.contains(&index) {
                issues.push(error_issue("reconciliation_mapping_double_owned", format!("stat_allocation.entries[{index}] is already mapped to another benefit in this same request."), Some(field.clone()), false));
                return None;
            }
            used_stat_indices.insert(index);
            Some(("stat_entry", index))
        }
        "edge" | "feature" => {
            let list = if kind == "edge" { &existing_profile.edges } else { &existing_profile.features };
            let Some(acquisition) = list.get(index) else {
                issues.push(error_issue("reconciliation_mapping_index_out_of_bounds", format!("{kind}s[{index}] does not exist."), Some(field.clone()), false));
                return None;
            };
            if acquisition.get("source_id").and_then(Value::as_str).is_some() {
                issues.push(error_issue("reconciliation_mapping_already_owned", format!("{kind}s[{index}] is already attributed to another source."), Some(field.clone()), false));
                return None;
            }
            if acquisition != expected_value {
                issues.push(error_issue("reconciliation_mapping_value_mismatch", format!("{kind}s[{index}] no longer matches the expected value supplied — it may be stale or foreign."), Some(field.clone()), false));
                return None;
            }
            let content_kind = if kind == "edge" { ContentKind::Edge } else { ContentKind::Feature };
            if acquisition.get("policy_kind").and_then(Value::as_str) != Some(content_kind.kind_slug()) {
                issues.push(error_issue("reconciliation_mapping_wrong_kind", format!("{kind}s[{index}]'s own policy_kind does not match \"{kind}\"."), Some(field.clone()), false));
                return None;
            }
            let Some(dvi) = acquisition.get("definition_version_id").and_then(Value::as_str) else {
                issues.push(error_issue("reconciliation_mapping_invalid", format!("{kind}s[{index}] has no definition_version_id."), Some(field.clone()), false));
                return None;
            };
            let Ok(Some(record)) = get_definition_by_version_id(definitions_conn, content_kind, dvi) else {
                issues.push(error_issue("acquisition_definition_not_found", format!("\"{dvi}\" does not exist in the active content."), Some(field.clone()), false));
                return None;
            };
            if !record.enabled {
                issues.push(error_issue("acquisition_definition_disabled", format!("\"{dvi}\" is disabled and cannot settle a milestone benefit."), Some(field.clone()), false));
                return None;
            }
            if benefit.kind == "alternative_general_feature" && !is_general_feature(&record.data_json) {
                issues.push(error_issue("milestone_alternative_not_general_feature", format!("\"{dvi}\" belongs to a specific Class and does not qualify as a General Feature (Core p19-20)."), Some(field.clone()), false));
                return None;
            }
            // Reuse the SAME eligibility check a brand-new choice for
            // this benefit undergoes — the definition's own textual
            // prerequisites — with this ONE acquisition excluded from
            // the acquired-state comparison so it neither self-satisfies
            // its own prerequisite nor counts as a duplicate of itself;
            // every OTHER acquisition still participates normally.
            // Deliberately NEVER `apply_skill_edge` here: that call
            // carries the STATEFUL rank/check-bonus effect, which
            // adoption must never re-award.
            let combined: Vec<Value> = existing_profile
                .edges
                .iter()
                .enumerate()
                .filter(|(i, _)| !(kind == "edge" && *i == index))
                .map(|(_, v)| v.clone())
                .chain(existing_profile.features.iter().enumerate().filter(|(i, _)| !(kind == "feature" && *i == index)).map(|(_, v)| v.clone()))
                .collect();
            let acquired_state = AcquiredState { acquired: &combined, skills: &existing_profile.skills, level: existing_profile.level };
            match check_definition_prerequisites(&record.data_json, &acquired_state, false) {
                Some(PrereqEval::Met) | None => {}
                Some(PrereqEval::NotMet(reason)) => {
                    issues.push(error_issue("reconciliation_mapping_ineligible", format!("\"{dvi}\" does not currently qualify for benefit \"{}\": {reason}", benefit.benefit_id), Some(field.clone()), true));
                    return None;
                }
                Some(PrereqEval::ManualReview(reason)) => {
                    issues.push(manual_review_issue(Some(field.clone()), format!("\"{dvi}\": {reason}")));
                    return None;
                }
            }
            let used_set = if kind == "edge" { &mut *used_edge_indices } else { &mut *used_feature_indices };
            if used_set.contains(&index) {
                issues.push(error_issue("reconciliation_mapping_double_owned", format!("{kind}s[{index}] is already mapped to another benefit in this same request."), Some(field.clone()), false));
                return None;
            }
            used_set.insert(index);
            Some((if kind == "edge" { "edge" } else { "feature" }, index))
        }
        other => {
            issues.push(error_issue("reconciliation_mapping_invalid", format!("\"{other}\" is not \"edge\", \"feature\", or \"stat_entry\"."), Some(field.clone()), false));
            None
        }
    }
}

/// Returns the fully-resolved reconciliation outcome PLUS the complete
/// (already-merged: existing + adopted-mutated + new-appended) edges/
/// features/stat-allocation-entries lists a caller (preview or commit)
/// can drop straight onto a profile clone — same "return the merged
/// state, not just a delta" convention `resolve_respec_intent`/
/// `resolve_gm_change_intent` already use.
#[allow(clippy::too_many_arguments)]
fn resolve_milestone_reconciliation_intent(
    definitions_conn: &Connection,
    rules: &TrainerBuildRules,
    milestones: &[super::datasets::TrainerMilestoneRow],
    existing_profile: &TrainerProfile,
    milestone_level: i64,
    milestone_option_id: &Option<String>,
    acquired_choices: &[Value],
    stat_stream_choice: &Option<String>,
    prior_benefits: &Value,
) -> (MilestoneReconciliationResolution, Vec<Value>, Vec<Value>, Vec<StatAllocationEntry>, Option<super::trainer_core::MilestoneReconciliationMetadata>) {
    let mut issues = Vec::new();
    let current_level = existing_profile.level;

    let empty = |issues: Vec<BuildIssue>, existing_profile: &TrainerProfile| {
        (
            MilestoneReconciliationResolution {
                from_level: current_level,
                to_level: current_level,
                milestone_level,
                option: None,
                benefits: vec![],
                stat_allocation_entries: vec![],
                edges: vec![],
                features: vec![],
                remaining_pending_milestone_levels: compute_remaining_pending_milestone_levels(milestones, rules, existing_profile),
                issues,
            },
            existing_profile.edges.clone(),
            existing_profile.features.clone(),
            existing_profile.stat_allocation.entries.clone(),
            None,
        )
    };

    if milestone_level > current_level {
        issues.push(error_issue("reconciliation_target_future_level", format!("Level {milestone_level} has not been reached yet (Trainer is level {current_level})."), Some("milestone_level".to_string()), false));
        return empty(issues, existing_profile);
    }
    let Some(m) = milestones.iter().find(|m| m.level == milestone_level) else {
        issues.push(error_issue("reconciliation_target_not_a_milestone", format!("Level {milestone_level} has no milestone."), Some("milestone_level".to_string()), false));
        return empty(issues, existing_profile);
    };
    let stream = stream_at_level(rules, milestone_level);
    let requires_choice = !m.choice_options.is_empty() || stream.is_some();
    if !requires_choice {
        issues.push(error_issue("reconciliation_target_not_a_choice_milestone", format!("Level {milestone_level}'s milestone (\"{}\") has no choice to reconcile.", m.name), Some("milestone_level".to_string()), false));
        return empty(issues, existing_profile);
    }
    let Some(stream) = stream else {
        issues.push(error_issue("reconciliation_target_unsupported_milestone_shape", format!("Level {milestone_level}'s milestone (\"{}\") has no structured offensive-stat-stream data to reconcile.", m.name), Some("milestone_level".to_string()), false));
        return empty(issues, existing_profile);
    };

    let already_resolved = existing_profile.progression.iter().any(|v| {
        serde_json::from_value::<super::trainer_core::ProgressionLedgerEntry>(v.clone())
            .ok()
            .is_some_and(|parsed| parsed.level == milestone_level && (parsed.milestone_option_kind.is_some() || parsed.milestone_choice.is_some()))
    });
    if already_resolved {
        issues.push(error_issue("reconciliation_target_already_resolved", format!("Level {milestone_level}'s milestone is already resolved and cannot be reconciled again."), Some("milestone_level".to_string()), false));
        return empty(issues, existing_profile);
    }

    let Some(option) = milestone_option_id.as_deref() else {
        issues.push(error_issue("milestone_choice_required", format!("Level {milestone_level}'s milestone (\"{}\") requires a choice before it can be reconciled.", m.name), Some("milestone_option_id".to_string()), false));
        return empty(issues, existing_profile);
    };

    let stat: Option<TrainerCombatStat> = if option == "stat_stream" {
        if milestone_level == 5 {
            match stat_stream_choice.as_deref() {
                Some("attack") => Some(TrainerCombatStat::Attack),
                Some("special_attack") => Some(TrainerCombatStat::SpecialAttack),
                _ => {
                    issues.push(error_issue("advancement_stat_stream_choice_required", "Level 5's offensive stat stream requires stat_stream_choice to be \"attack\" or \"special_attack\" (Core p19).".to_string(), Some("stat_stream_choice".to_string()), false));
                    None
                }
            }
        } else {
            match locked_offensive_stat(&existing_profile.progression) {
                Some(s) => Some(s),
                None => {
                    issues.push(error_issue(
                        "advancement_stat_stream_not_started",
                        format!("Level {milestone_level}'s stream option reuses level 5's stat choice, but this Trainer never entered the stream at level 5 (Core p19: the stream cannot be started later)."),
                        Some("milestone_option_id".to_string()),
                        false,
                    ));
                    None
                }
            }
        }
    } else {
        None
    };

    let due = match compute_due_benefits(stream, milestone_level, current_level, option, stat) {
        Ok(due) => due,
        Err(issue) => {
            issues.push(issue);
            return empty(issues, existing_profile);
        }
    };
    if option == "stat_stream" && stat.is_none() {
        return empty(issues, existing_profile);
    }

    let Some(disposition) = prior_benefits.get("disposition").and_then(Value::as_str).filter(|d| matches!(*d, "not_received" | "map_existing")) else {
        issues.push(error_issue("reconciliation_prior_benefits_disposition_required", "prior_benefits.disposition must be \"not_received\" or \"map_existing\".".to_string(), Some("prior_benefits.disposition".to_string()), false));
        return empty(issues, existing_profile);
    };
    let Some(_note) = prior_benefits.get("note").and_then(Value::as_str).filter(|n| !n.trim().is_empty()) else {
        issues.push(error_issue("reconciliation_prior_benefits_note_required", "prior_benefits.note must be a non-empty, GM-attributed note.".to_string(), Some("prior_benefits.note".to_string()), false));
        return empty(issues, existing_profile);
    };
    let mappings: Vec<Value> = prior_benefits.get("mappings").and_then(Value::as_array).cloned().unwrap_or_default();
    if disposition == "not_received" && !mappings.is_empty() {
        issues.push(error_issue("reconciliation_mappings_not_allowed", "prior_benefits.mappings must be empty when disposition is \"not_received\".".to_string(), Some("prior_benefits.mappings".to_string()), false));
        return empty(issues, existing_profile);
    }

    let skill_edge_by_dvi: HashMap<&str, &SkillEdgeCatalogEntry> = rules.skill_edges.entries.iter().map(|e| (e.definition_version_id.as_str(), e)).collect();
    let (mut used_skill_enhancement, mut used_skill_stunt, mut used_virtuoso, mut seen_categoric_inclination) = scan_existing_skill_edge_usage(&existing_profile.edges, &skill_edge_by_dvi);

    let mut updated_edges = existing_profile.edges.clone();
    let mut updated_features = existing_profile.features.clone();
    let mut updated_stat_entries = existing_profile.stat_allocation.entries.clone();
    let mut new_stat_entries = Vec::new();
    let mut new_edges = Vec::new();
    let mut new_features = Vec::new();
    let mut benefit_records: Vec<super::trainer_core::ReconciledBenefitRecord> = Vec::new();
    let mut benefit_outcomes: Vec<ReconciledBenefitOutcome> = Vec::new();
    let mut used_edge_indices = HashSet::new();
    let mut used_feature_indices = HashSet::new();
    let mut used_stat_indices = HashSet::new();
    let mut alternative_choice_cursor = 0usize;

    for benefit in &due {
        let mapping = mappings.iter().find(|mp| mp.get("benefit_id").and_then(Value::as_str) == Some(benefit.benefit_id.as_str()));
        if disposition == "map_existing" {
            if let Some(mapping_value) = mapping {
                if let Some((kind, index)) = adopt_mapping(definitions_conn, existing_profile, benefit, mapping_value, &mut used_edge_indices, &mut used_feature_indices, &mut used_stat_indices, &mut issues) {
                    match kind {
                        "stat_entry" => updated_stat_entries[index].source_id = Some(benefit.benefit_id.clone()),
                        "edge" => {
                            if let Some(obj) = updated_edges[index].as_object_mut() {
                                obj.insert("source_id".to_string(), Value::String(benefit.benefit_id.clone()));
                            }
                        }
                        "feature" => {
                            if let Some(obj) = updated_features[index].as_object_mut() {
                                obj.insert("source_id".to_string(), Value::String(benefit.benefit_id.clone()));
                            }
                        }
                        _ => {}
                    }
                    benefit_records.push(super::trainer_core::ReconciledBenefitRecord { benefit_id: benefit.benefit_id.clone(), kind: benefit.kind.to_string(), status: "adopted".to_string() });
                    benefit_outcomes.push(ReconciledBenefitOutcome { benefit_id: benefit.benefit_id.clone(), kind: benefit.kind.to_string(), status: "adopted".to_string(), description: benefit.description.clone() });
                }
                continue;
            }
        }

        match benefit.kind {
            "stat_stream_retroactive" | "stat_stream_ongoing" => {
                if let (Some(stat), Some(points)) = (stat, benefit.points) {
                    new_stat_entries.push(StatAllocationEntry { stat, source: StatAllocationSource::Milestone, level: milestone_level, points, note: Some(benefit.description.clone()), source_id: Some(benefit.benefit_id.clone()) });
                    benefit_records.push(super::trainer_core::ReconciledBenefitRecord { benefit_id: benefit.benefit_id.clone(), kind: benefit.kind.to_string(), status: "new".to_string() });
                    benefit_outcomes.push(ReconciledBenefitOutcome { benefit_id: benefit.benefit_id.clone(), kind: benefit.kind.to_string(), status: "new".to_string(), description: benefit.description.clone() });
                }
            }
            "alternative_edge" | "alternative_general_feature" => {
                let Some(choice_value) = acquired_choices.get(alternative_choice_cursor).cloned() else {
                    issues.push(error_issue("reconciliation_alternative_choice_missing", format!("Benefit \"{}\" requires one more acquired_choices entry.", benefit.benefit_id), Some("acquired_choices".to_string()), false));
                    continue;
                };
                alternative_choice_cursor += 1;
                let Ok(intent) = serde_json::from_value::<AdvancementAcquisitionIntent>(choice_value) else {
                    issues.push(error_issue("invalid_acquisition_shape", "acquired_choices entry does not match the expected acquisition shape.".to_string(), Some("acquired_choices".to_string()), false));
                    continue;
                };
                let field = format!("acquired_choices[{}]", benefit.benefit_id);
                let expected_kind = if benefit.kind == "alternative_edge" { "edge" } else { "feature" };
                if intent.kind != expected_kind {
                    issues.push(error_issue("milestone_alternative_wrong_kind", format!("Benefit \"{}\" requires a {expected_kind} choice.", benefit.benefit_id), Some(field.clone()), false));
                    continue;
                }
                let kind = if expected_kind == "edge" { ContentKind::Edge } else { ContentKind::Feature };
                let Ok(Some(record)) = get_definition_by_version_id(definitions_conn, kind, &intent.definition_version_id) else {
                    issues.push(error_issue("acquisition_definition_not_found", format!("\"{}\" does not exist in the active content.", intent.definition_version_id), Some(field.clone()), false));
                    continue;
                };
                if !record.enabled {
                    issues.push(error_issue("acquisition_definition_disabled", format!("\"{}\" is disabled and cannot be acquired.", intent.definition_version_id), Some(field.clone()), false));
                }
                if expected_kind == "feature" && !is_general_feature(&record.data_json) {
                    issues.push(error_issue("milestone_alternative_not_general_feature", format!("\"{}\" belongs to a specific Class and does not qualify as a General Feature (Core p19-20).", intent.definition_version_id), Some(field.clone()), false));
                    continue;
                }
                let mut granted_skill_rank_change: Option<Value> = None;
                if let Some(policy) = skill_edge_by_dvi.get(intent.definition_version_id.as_str()) {
                    let outcome = apply_skill_edge(policy, &intent.parameters, &existing_profile.skills, existing_profile.level, &[], &field, &used_skill_enhancement, &used_skill_stunt, &used_virtuoso, seen_categoric_inclination);
                    issues.extend(outcome.issues);
                    if let Some((skill_id, to_rank)) = &outcome.new_skill_rank {
                        let from_rank = crate::engine::trainer_core::skill_rank(&existing_profile.skills, skill_id);
                        granted_skill_rank_change = Some(serde_json::json!({"skill_id": skill_id, "from_rank": serde_json::to_value(from_rank).unwrap_or(Value::Null), "to_rank": to_rank}));
                    }
                    match policy.id.as_str() {
                        "skill-enhancement" => {
                            if let Some(skills) = intent.parameters.get("skills").and_then(Value::as_array) {
                                for s in skills.iter().filter_map(Value::as_str) {
                                    used_skill_enhancement.insert(s.to_string());
                                }
                            }
                        }
                        "categoric-inclination" => seen_categoric_inclination = true,
                        "skill-stunt" => {
                            if let (Some(skill), Some(circumstance)) = (intent.parameters.get("skill").and_then(Value::as_str), intent.parameters.get("circumstance").and_then(Value::as_str)) {
                                used_skill_stunt.insert((skill.to_string(), circumstance.to_string()));
                            }
                        }
                        "virtuoso" => {
                            if let Some(skill) = intent.parameters.get("skill").and_then(Value::as_str) {
                                used_virtuoso.insert(skill.to_string());
                            }
                        }
                        _ => {}
                    }
                } else {
                    let combined: Vec<Value> = existing_profile.edges.iter().chain(existing_profile.features.iter()).cloned().collect();
                    let acquired_state = AcquiredState { acquired: &combined, skills: &existing_profile.skills, level: existing_profile.level };
                    match check_definition_prerequisites(&record.data_json, &acquired_state, false) {
                        Some(PrereqEval::Met) | None => {}
                        Some(PrereqEval::NotMet(reason)) => issues.push(error_issue("prerequisite_not_met", format!("\"{}\": {reason}", intent.definition_version_id), Some(field.clone()), true)),
                        Some(PrereqEval::ManualReview(reason)) => issues.push(manual_review_issue(Some(field.clone()), format!("\"{}\": {reason}", intent.definition_version_id))),
                    }
                }
                let acquisition = serde_json::json!({
                    "definition_version_id": intent.definition_version_id,
                    "parameters": intent.parameters,
                    "policy_kind": kind.kind_slug(),
                    "source": "milestone",
                    "source_id": benefit.benefit_id,
                    "level": milestone_level,
                    "sequence": 0,
                    "granted_skill_rank_change": granted_skill_rank_change,
                });
                if kind == ContentKind::Edge {
                    new_edges.push(acquisition);
                } else {
                    new_features.push(acquisition);
                }
                benefit_records.push(super::trainer_core::ReconciledBenefitRecord { benefit_id: benefit.benefit_id.clone(), kind: benefit.kind.to_string(), status: "new".to_string() });
                benefit_outcomes.push(ReconciledBenefitOutcome { benefit_id: benefit.benefit_id.clone(), kind: benefit.kind.to_string(), status: "new".to_string(), description: benefit.description.clone() });
            }
            _ => {}
        }
    }

    updated_stat_entries.extend(new_stat_entries.clone());
    updated_edges.extend(new_edges.clone());
    updated_features.extend(new_features.clone());

    let mut remaining = compute_remaining_pending_milestone_levels(milestones, rules, existing_profile);
    remaining.retain(|&l| l != milestone_level);

    let metadata = if issues.iter().any(|i| i.issue.severity == Severity::Error) {
        None
    } else {
        Some(super::trainer_core::MilestoneReconciliationMetadata { version: 1, option: option.to_string(), prior_benefits_disposition: disposition.to_string(), attribution_note: _note.to_string(), benefits: benefit_records })
    };

    (
        MilestoneReconciliationResolution {
            from_level: current_level,
            to_level: current_level,
            milestone_level,
            option: Some(option.to_string()),
            benefits: benefit_outcomes,
            stat_allocation_entries: new_stat_entries,
            edges: new_edges,
            features: new_features,
            remaining_pending_milestone_levels: remaining,
            issues,
        },
        updated_edges,
        updated_features,
        updated_stat_entries,
        metadata,
    )
}

#[allow(clippy::too_many_arguments)]
pub fn preview_trainer_milestone_reconciliation(definitions_conn: &Connection, profiles_conn: &Connection, ruleset: &CampaignRuleset, e02_content_revision: &str, request: &PreviewTrainerMilestoneReconciliationRequest) -> Result<TrainerMilestoneReconciliationPreviewResponse, TrainerBuildError> {
    let profile = load_owned_profile(profiles_conn, &request.trainer_id)?;
    let (rules, progression, milestones, rules_fingerprint) = load_advancement_datasets(definitions_conn, ruleset, &request.content_pack_id, e02_content_revision)?;
    let current_base_revision = compute_base_revision(&profile, &rules_fingerprint);
    if request.expected_base_revision != current_base_revision {
        return Err(TrainerBuildError::StaleRevision { message: "Content context changed".to_string() });
    }
    let (resolution, edges, features, stat_entries, _metadata) = resolve_milestone_reconciliation_intent(definitions_conn, &rules, &milestones, &profile, request.milestone_level, &request.milestone_option_id, &request.acquired_choices, &request.stat_stream_choice, &request.prior_benefits);
    let mut preview_profile = profile.clone();
    preview_profile.edges = edges;
    preview_profile.features = features;
    preview_profile.stat_allocation.entries = stat_entries;
    for link in resolution.edges.iter().chain(resolution.features.iter()) {
        apply_granted_skill_rank_change(&mut preview_profile.skills, link);
    }
    let core_result = resolve_core_stats_for_profile(definitions_conn, &progression, &preview_profile);
    Ok(TrainerMilestoneReconciliationPreviewResponse { base_revision: current_base_revision, resolution, core_result })
}

/// Commit-time equivalent of [`preview_trainer_milestone_reconciliation`]
/// — same structural-validation-then-operation-replay-then-new-operation
/// ordering every D4 family uses, reusing the SAME `trainer_build_operations`
/// receipt table with its OWN literal `operation_kind` (P5) — never
/// touching `compute_operation_request_fingerprint` (build) or any other
/// family's fingerprint shape.
#[allow(clippy::too_many_arguments)]
pub fn commit_trainer_milestone_reconciliation(definitions_conn: &Connection, profiles_conn: &mut Connection, ruleset: &CampaignRuleset, e02_content_revision: &str, request: &CommitTrainerMilestoneReconciliationRequest) -> Result<TrainerMilestoneReconciliationCommitResponse, TrainerBuildError> {
    if !request.confirm {
        return Err(TrainerBuildError::ConfirmationRequired { message: "confirm must be true to publish a milestone reconciliation".to_string() });
    }
    if request.operation_id.trim().is_empty() {
        return Err(TrainerBuildError::InvalidIntent { message: "operation_id must not be empty".to_string() });
    }

    let profile = load_owned_profile(profiles_conn, &request.trainer_id)?;

    let request_fingerprint = compute_operation_request_fingerprint_generic(serde_json::json!({
        "operation_kind": "trainer_milestone_reconciliation_commit",
        "trainer_id": request.trainer_id,
        "content_pack_id": request.content_pack_id,
        "milestone_level": request.milestone_level,
        "milestone_option_id": request.milestone_option_id,
        "acquired_choices": request.acquired_choices,
        "stat_stream_choice": request.stat_stream_choice,
        "manual_adjudications": request.manual_adjudications,
        "prior_benefits": request.prior_benefits,
        "expected_base_revision": request.expected_base_revision,
    }));
    if let Some(receipt) = crate::profile::repository::load_build_operation(profiles_conn, &request.operation_id).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })? {
        if receipt.request_fingerprint != request_fingerprint {
            return Err(TrainerBuildError::OperationConflict { message: format!("operation_id \"{}\" was already used for a different request; use a new operation_id for a new mutation.", request.operation_id) });
        }
        if crate::profile::repository::load_trainer_profile(profiles_conn, &receipt.trainer_id).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?.is_none() {
            return Err(TrainerBuildError::CommittedTargetMissing { message: format!("operation_id \"{}\" previously committed Trainer \"{}\", which no longer exists.", request.operation_id, receipt.trainer_id) });
        }
        let response: TrainerMilestoneReconciliationCommitResponse = serde_json::from_str(&receipt.response_json).map_err(|e| TrainerBuildError::Internal { message: format!("stored operation receipt is corrupt: {e}") })?;
        return Ok(response);
    }

    let (rules, progression, milestones, rules_fingerprint) = load_advancement_datasets(definitions_conn, ruleset, &request.content_pack_id, e02_content_revision)?;
    let current_base_revision = compute_base_revision(&profile, &rules_fingerprint);
    if request.expected_base_revision != current_base_revision {
        return Err(TrainerBuildError::StaleRevision { message: "Content context changed".to_string() });
    }

    let (resolution, edges, features, stat_entries, metadata) = resolve_milestone_reconciliation_intent(definitions_conn, &rules, &milestones, &profile, request.milestone_level, &request.milestone_option_id, &request.acquired_choices, &request.stat_stream_choice, &request.prior_benefits);
    let blocking: Vec<BuildIssue> = resolution.issues.iter().filter(|i| i.issue.severity == Severity::Error && !issue_is_adjudicated(i, &request.manual_adjudications)).cloned().collect();
    if !blocking.is_empty() {
        return Err(TrainerBuildError::ValidationFailed { issues: blocking });
    }
    let Some(metadata) = metadata else {
        return Err(TrainerBuildError::Internal { message: "resolution reported no blocking issue but produced no reconciliation metadata".to_string() });
    };

    let mut updated_profile = profile.clone();
    updated_profile.edges = edges;
    updated_profile.features = features;
    updated_profile.stat_allocation.entries = stat_entries;
    for link in resolution.edges.iter().chain(resolution.features.iter()) {
        apply_granted_skill_rank_change(&mut updated_profile.skills, link);
    }

    let mut ledger: Vec<Value> = updated_profile.progression.clone();
    let target_index = ledger.iter().position(|v| v.get("level").and_then(Value::as_i64) == Some(request.milestone_level));
    let mut target_entry = target_index
        .and_then(|i| serde_json::from_value::<super::trainer_core::ProgressionLedgerEntry>(ledger[i].clone()).ok())
        .unwrap_or(super::trainer_core::ProgressionLedgerEntry {
            level: request.milestone_level,
            level_source: super::trainer_core::LevelSource::Milestone,
            stat_points: 0,
            features: 0,
            edges: 0,
            milestone_choice_required: false,
            milestone_choice: None,
            milestone_option_kind: None,
            stat_stream_choice: None,
            reconciliation: None,
        });
    target_entry.milestone_choice = resolution.option.clone();
    target_entry.milestone_option_kind = resolution.option.clone();
    if request.milestone_level == 5 && resolution.option.as_deref() == Some("stat_stream") {
        target_entry.stat_stream_choice = request.stat_stream_choice.clone();
    }
    target_entry.reconciliation = Some(metadata);
    let target_value = serde_json::to_value(&target_entry).unwrap_or(Value::Null);
    match target_index {
        Some(i) => ledger[i] = target_value,
        None => ledger.push(target_value),
    }
    updated_profile.progression = ledger;

    let core_result = resolve_core_stats_for_profile(definitions_conn, &progression, &updated_profile);
    let new_base_revision = compute_base_revision(&updated_profile, &rules_fingerprint);
    let response = TrainerMilestoneReconciliationCommitResponse { trainer_id: updated_profile.id.clone(), base_revision: new_base_revision, resolution, core_result };
    let response_json = serde_json::to_string(&response).map_err(|e| TrainerBuildError::Internal { message: format!("failed to serialize operation response: {e}") })?;

    let tx = profiles_conn.transaction().map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    crate::profile::repository::save_trainer_profile_tx(&tx, &updated_profile).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    crate::profile::repository::record_build_operation_tx(&tx, &request.operation_id, &request_fingerprint, &updated_profile.id, &response_json).map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;
    tx.commit().map_err(|e| TrainerBuildError::Internal { message: e.to_string() })?;

    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ruleset_with_packs(packs: Vec<(&str, bool)>) -> CampaignRuleset {
        CampaignRuleset {
            id: "test-ruleset".to_string(),
            name: "Test".to_string(),
            version: "1".to_string(),
            description: None,
            packs: packs.into_iter().enumerate().map(|(i, (id, enabled))| crate::content::ruleset::RulesetPackRef { id: id.to_string(), enabled, priority: i as i64 }).collect(),
            version_pins: Default::default(),
            gm_overrides_enabled: false,
        }
    }

    #[test]
    fn validate_content_pack_is_active_accepts_only_an_enabled_pack_in_the_ruleset() {
        let ruleset = ruleset_with_packs(vec![("ptu-core-1.05", true), ("ptu-gen8ish-pokedex", false)]);
        assert!(validate_content_pack_is_active(&ruleset, "ptu-core-1.05").is_ok());
        assert!(validate_content_pack_is_active(&ruleset, "ptu-gen8ish-pokedex").is_err(), "present but disabled must still reject");
        assert!(validate_content_pack_is_active(&ruleset, "not-in-ruleset-at-all").is_err());
    }

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
