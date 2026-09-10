//! PTU 1.05 Core Trainer combat-stat / Step 6 derived-capability resolver
//! (T15A). Normative source: PTU 1.05 Core book pp. 17-20 (Character
//! Creation Step 6 / Character Advancement), p. 33 (skill-rank scale),
//! p. 219 (general round-down rule) — see the T15A task's Relevant
//! Components for the exact source links. Every formula below is
//! transcribed from that task text, never invented; where the source
//! describes a narrative/conditional rule rather than a closed formula
//! (a milestone's exact bonus-point stream), this module types and passes
//! through the choice/provenance instead of computing a number — see
//! [`StatAllocationSource::Milestone`] and [`resolve_advancement`].
//!
//! Nothing here recomputes in React: every public function is a pure,
//! independently unit-tested value or a resolver over already-loaded
//! datasets (`engine::datasets`) and the persisted
//! [`TrainerStatAllocation`]/[`TrainerProfile::progression`].

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::datasets::{TrainerMilestoneRow, TrainerProgressionRow};
use super::modifier::{resolve_value, Modifier, Operation, ResolvedValue};
use super::validation::{Severity, ValidationIssue};
use crate::profile::model::{StatAllocationEntry, StatAllocationSource, TrainerCombatStat, TrainerStatAllocation};

// =======================================================================
// Skill ranks (T15A: "Use the Core skill-rank ordinal mapping")
// =======================================================================

/// Core skill-rank ordinal scale (book p. 33). Threshold comparisons in
/// this module always use this ordinal — never a localized label or the
/// order ranks happen to appear in any UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SkillRank {
    Pathetic = 1,
    Untrained = 2,
    Novice = 3,
    Adept = 4,
    Expert = 5,
    Master = 6,
}

impl SkillRank {
    pub fn ordinal(self) -> i64 {
        self as i64
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "pathetic" => Some(Self::Pathetic),
            "untrained" => Some(Self::Untrained),
            "novice" => Some(Self::Novice),
            "adept" => Some(Self::Adept),
            "expert" => Some(Self::Expert),
            "master" => Some(Self::Master),
            _ => None,
        }
    }
}

/// Reads `skills.<skill_id>.base_rank` — the shape already established by
/// `fixtures/trainer_profile_full.json` (e.g. `"stealth": {"base_rank":
/// "novice"}`) — as an ordinal [`SkillRank`]. A skill absent from the map
/// defaults to `Untrained`: PTU's own baseline for a skill nobody has
/// trained, not an invented value. An unrecognized string also falls back
/// to `Untrained` rather than panicking on malformed/legacy data.
pub fn skill_rank(skills: &Value, skill_id: &str) -> SkillRank {
    skills
        .get(skill_id)
        .and_then(|s| s.get("base_rank"))
        .and_then(Value::as_str)
        .and_then(SkillRank::from_str)
        .unwrap_or(SkillRank::Untrained)
}

/// Core's general round-down rule (book p. 219): every division below,
/// including exact halves, rounds toward negative infinity. Every input
/// used here is non-negative, so this coincides with truncation, but
/// `div_euclid` (not `/`) is used throughout so the rule is applied
/// explicitly rather than relying on that coincidence.
fn round_down(numerator: i64, denominator: i64) -> i64 {
    numerator.div_euclid(denominator)
}

// =======================================================================
// Step 6 formulas
// =======================================================================

/// `(Trainer Level × 2) + (HP Stat × 3) + 10`.
pub fn max_hp(level: i64, hp_stat: i64) -> i64 {
    level * 2 + hp_stat * 3 + 10
}

pub const EVASION_CAP: i64 = 6;

/// `floor(stat / 5)`, capped at `+6`. Used for Physical (Defense), Special
/// (Special Defense), and Speed Evasion alike — same formula, different
/// input stat.
pub fn evasion(stat_value: i64) -> i64 {
    round_down(stat_value, 5).min(EVASION_CAP)
}

/// `5 + floor(Level / 5)`.
pub fn ap(level: i64) -> i64 {
    5 + round_down(level, 5)
}

/// Base 4, +1 if Athletics is at least Novice, +1 if Combat is at least
/// Adept.
pub fn power(athletics: SkillRank, combat: SkillRank) -> i64 {
    4 + i64::from(athletics >= SkillRank::Novice) + i64::from(combat >= SkillRank::Adept)
}

/// A running start's High Jump bonus (situational — see [`high_jump`]'s
/// doc comment). Never added into the persisted/base High Jump value.
pub const HIGH_JUMP_RUNNING_START_BONUS: i64 = 1;

/// Base 0, +1 at Acrobatics Adept, +1 additional (so +2 total) at
/// Acrobatics Master. The running-start bonus
/// ([`HIGH_JUMP_RUNNING_START_BONUS`]) is situational provenance, reported
/// separately by callers — this function never includes it, so the base
/// value it returns is stable regardless of in-fiction circumstance.
pub fn high_jump(acrobatics: SkillRank) -> i64 {
    i64::from(acrobatics >= SkillRank::Adept) + i64::from(acrobatics == SkillRank::Master)
}

/// `floor(Acrobatics Rank / 2)`.
pub fn long_jump(acrobatics: SkillRank) -> i64 {
    round_down(acrobatics.ordinal(), 2)
}

/// `3 + floor((Athletics Rank + Acrobatics Rank) / 2)`.
pub fn overland(athletics: SkillRank, acrobatics: SkillRank) -> i64 {
    3 + round_down(athletics.ordinal() + acrobatics.ordinal(), 2)
}

/// `floor(Overland / 2)`.
pub fn swim(overland_value: i64) -> i64 {
    round_down(overland_value, 2)
}

/// `4 + Athletics Rank`.
pub fn throwing_range(athletics: SkillRank) -> i64 {
    4 + athletics.ordinal()
}

// =======================================================================
// Size / Weight Class
// =======================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WeightClass {
    Wc3,
    Wc4,
    Wc5,
}

pub const TRAINER_SIZE: &str = "Medium";

/// T15A's Step 6 Trainer-specific weight bands: 55-110 lb = WC3, 111-220
/// lb = WC4, above 220 lb = WC5. This is the Trainer-specific rule, which
/// Core's specific-over-general principle makes controlling over the
/// general/Pokémon Weight Class chart's overlapping printed endpoints
/// (T15B owns reconciling that general chart). Below 55 lb has no
/// Trainer-specific band in the cited source — this returns `None` plus a
/// typed, non-overridable validation issue rather than extrapolating the
/// general chart downward.
pub fn weight_class(weight_lb: i64) -> (Option<WeightClass>, Option<ValidationIssue>) {
    if weight_lb < 55 {
        return (
            None,
            Some(ValidationIssue {
                severity: Severity::Error,
                code: "TRAINER_WEIGHT_BELOW_SUPPORTED_RANGE".to_string(),
                message: format!(
                    "{weight_lb} lb is below the Trainer Weight Class table's supported range (55 lb and up). T15B must resolve any lower-range/general-chart authority before this can be classified."
                ),
                override_allowed: false,
            }),
        );
    }
    let class = if weight_lb <= 110 {
        WeightClass::Wc3
    } else if weight_lb <= 220 {
        WeightClass::Wc4
    } else {
        WeightClass::Wc5
    };
    (Some(class), None)
}

// =======================================================================
// Stat allocation: base value + validation
// =======================================================================

const ALL_COMBAT_STATS: [TrainerCombatStat; 6] = [
    TrainerCombatStat::Hp,
    TrainerCombatStat::Attack,
    TrainerCombatStat::Defense,
    TrainerCombatStat::SpecialAttack,
    TrainerCombatStat::SpecialDefense,
    TrainerCombatStat::Speed,
];

/// The Step 6 creation floor: HP starts at 10, the other five stats start
/// at 5 (book p. 17-18).
pub fn creation_floor(stat: TrainerCombatStat) -> i64 {
    match stat {
        TrainerCombatStat::Hp => 10,
        _ => 5,
    }
}

/// Sums every point allocated to `stat`, across every source.
pub fn allocated_points(allocation: &TrainerStatAllocation, stat: TrainerCombatStat) -> i64 {
    allocation.entries.iter().filter(|e| e.stat == stat).map(|e| e.points).sum()
}

/// A stat's base value: the Step 6 floor plus every point actually
/// allocated to it. Real arithmetic over persisted data, never a guess —
/// see [`validate_stat_allocation`] for whether the allocation itself is
/// complete/legal.
pub fn stat_base(allocation: &TrainerStatAllocation, stat: TrainerCombatStat) -> i64 {
    creation_floor(stat) + allocated_points(allocation, stat)
}

/// Validates the recorded allocation against PTU 1.05 Core's creation +
/// per-level Stat Point budget. `progression` supplies both numbers this
/// task cites (`stat_points_at_level` is 10 at level 1, 1 for every level
/// after — already the source `resolve_trainer_level_up` reads).
///
/// Returns:
/// - `Severity::Error`, non-overridable, if any single stat's
///   `Creation`-source points exceed 5 (the Step 6 cap) — record the
///   excess as a `GmOverride` entry instead if intentional.
/// - `Severity::Error`, overridable, if total `Creation` + `LevelUp`
///   points spent exceed the total granted through `trainer_level`.
/// - `Severity::Info` if fewer points are spent than granted — the build
///   is incomplete, not invalid.
/// - No issues if spent exactly matches granted and no stat exceeds the
///   creation cap.
///
/// `Milestone`/`GmOverride` points are provenance-tracked but never
/// counted against this budget: T15A does not compute milestone bonus
/// amounts (see [`StatAllocationSource::Milestone`]), and a `GmOverride`
/// is by definition outside the normal budget.
/// The normal (Creation + LevelUp) budget granted through `trainer_level`
/// and how much of it is currently spent. Shared by [`validate_stat_allocation`]
/// (which only needs the pass/fail comparison) and [`resolve_trainer_core`]
/// (which surfaces the actual numbers as [`StatAllocationSummary`] so the
/// T13C1 allocation panel can show "N points remaining" without parsing a
/// validation message or re-deriving the rule in React).
pub fn granted_and_spent(allocation: &TrainerStatAllocation, trainer_level: i64, progression: &[TrainerProgressionRow]) -> (i64, i64) {
    let granted: i64 = progression.iter().filter(|r| r.level <= trainer_level).map(|r| r.stat_points_at_level).sum();
    let spent: i64 = allocation
        .entries
        .iter()
        .filter(|e| matches!(e.source, StatAllocationSource::Creation | StatAllocationSource::LevelUp))
        .map(|e| e.points)
        .sum();
    (granted, spent)
}

pub fn validate_stat_allocation(
    allocation: &TrainerStatAllocation,
    trainer_level: i64,
    progression: &[TrainerProgressionRow],
) -> Vec<ValidationIssue> {
    let mut issues = Vec::new();

    for stat in ALL_COMBAT_STATS {
        let creation_points: i64 = allocation
            .entries
            .iter()
            .filter(|e| e.stat == stat && e.source == StatAllocationSource::Creation)
            .map(|e| e.points)
            .sum();
        if creation_points > 5 {
            issues.push(ValidationIssue {
                severity: Severity::Error,
                code: "TRAINER_STAT_CREATION_CAP_EXCEEDED".to_string(),
                message: format!(
                    "{stat:?} received {creation_points} creation points, exceeding the Step 6 5-point cap; record the excess as a GmOverride entry if intentional."
                ),
                override_allowed: false,
            });
        }
    }

    let (granted, spent) = granted_and_spent(allocation, trainer_level, progression);

    if spent > granted {
        issues.push(ValidationIssue {
            severity: Severity::Error,
            code: "TRAINER_STAT_POINTS_OVERSPENT".to_string(),
            message: format!(
                "{spent} Stat Points allocated (Creation + level-up), but only {granted} have been granted through level {trainer_level}."
            ),
            override_allowed: true,
        });
    } else if spent < granted {
        issues.push(ValidationIssue {
            severity: Severity::Info,
            code: "TRAINER_STAT_ALLOCATION_INCOMPLETE".to_string(),
            message: format!("{spent} of {granted} granted Stat Points have been allocated; the build is not yet complete."),
            override_allowed: false,
        });
    }

    issues
}

// =======================================================================
// Modifier engine integration
// =======================================================================

/// T13D3-R1B: also used by `engine::trainer_build`'s Feature-tag modifier
/// derivation, to target the same `"trainer.stat.*"` keys a fixed GM Grant
/// already does.
pub fn stat_target_key(stat: TrainerCombatStat) -> &'static str {
    match stat {
        TrainerCombatStat::Hp => "trainer.stat.hp",
        TrainerCombatStat::Attack => "trainer.stat.attack",
        TrainerCombatStat::Defense => "trainer.stat.defense",
        TrainerCombatStat::SpecialAttack => "trainer.stat.special_attack",
        TrainerCombatStat::SpecialDefense => "trainer.stat.special_defense",
        TrainerCombatStat::Speed => "trainer.stat.speed",
    }
}

/// Converts `"fixed"`-kind GM grants (spec 16, already persisted on
/// `TrainerProfile.gm_grants`) targeting `stat_target` into [`Modifier`]s
/// for [`resolve_value`]. This is the only modifier *source* wired to
/// Trainer combat stats by T15A — full learned/equipped/temporary-effect
/// coverage is T15/T15B; this reuses the existing GM Grant mechanism
/// rather than inventing a new one. A grant that isn't a matching `fixed`
/// grant is silently skipped (other kinds/targets have their own
/// consumers elsewhere; this never errors on data meant for them).
pub fn stat_modifiers_from_gm_grants(gm_grants: &[Value], stat_target: &str) -> Vec<Modifier> {
    gm_grants
        .iter()
        .filter(|g| g.get("kind").and_then(Value::as_str) == Some("fixed"))
        .filter(|g| g.get("target").and_then(Value::as_str) == Some(stat_target))
        .filter_map(|g| {
            let id = g.get("id")?.as_str()?.to_string();
            let operation: Operation = serde_json::from_value(g.get("operation")?.clone()).ok()?;
            let value = g.get("value")?.as_f64()?;
            Some(Modifier {
                id,
                source_label: "GM Grant".to_string(),
                target: stat_target.to_string(),
                operation,
                value,
                priority: g.get("priority").and_then(Value::as_i64).unwrap_or(100),
            })
        })
        .collect()
}

// =======================================================================
// Aggregate resolver
// =======================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrainerCombatStatsResolved {
    pub hp: ResolvedValue,
    pub attack: ResolvedValue,
    pub defense: ResolvedValue,
    pub special_attack: ResolvedValue,
    pub special_defense: ResolvedValue,
    pub speed: ResolvedValue,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrainerWeightResult {
    pub weight_lb: Option<i64>,
    pub weight_class: Option<WeightClass>,
}

/// T13C1: the normal Stat Point budget in plain numbers, so the guided
/// allocation panel can show "N of M points allocated, R remaining"
/// directly — never by parsing `validation`'s prose message or
/// re-deriving the grant/spend arithmetic in React.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StatAllocationSummary {
    pub granted: i64,
    pub spent: i64,
    pub remaining: i64,
}

/// `Deserialize` is needed alongside `Serialize` here (T13D3-R1A): a
/// stored `commit_trainer_build` operation receipt round-trips this exact
/// shape through JSON so a replayed commit can return it verbatim — see
/// `engine::trainer_build::TrainerBuildCommitResponse`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrainerCoreResult {
    pub combat_stats: TrainerCombatStatsResolved,
    /// Derived from the *resolved* HP stat (base + any GM-grant modifier
    /// targeting it) — a permanent HP-Stat-boosting grant is intended to
    /// cascade into Max HP, matching how Core describes the HP Stat
    /// feeding this formula. Documented here since the task text doesn't
    /// spell out base-vs-resolved explicitly; flagged for Reviewer
    /// confirmation in the Worker Result.
    pub max_hp: ResolvedValue,
    pub physical_evasion: ResolvedValue,
    pub special_evasion: ResolvedValue,
    pub speed_evasion: ResolvedValue,
    pub ap: ResolvedValue,
    pub power: ResolvedValue,
    pub high_jump: ResolvedValue,
    pub high_jump_running_start_bonus: i64,
    pub long_jump: ResolvedValue,
    pub overland: ResolvedValue,
    pub swim: ResolvedValue,
    pub throwing_range: ResolvedValue,
    pub size: String,
    pub weight: TrainerWeightResult,
    pub allocation_summary: StatAllocationSummary,
    pub validation: Vec<ValidationIssue>,
}

/// The single entry point T13R3 (once approved) will call through the
/// Tauri command boundary. Pure — takes already-loaded profile fields and
/// datasets, returns everything the approved dashboard contract's Step 6
/// panel needs in one shot, each value carrying its own base/resolved/
/// breakdown per [`ResolvedValue`].
///
/// `feature_tag_modifiers` (T13D3-R1B): already-derived, already-verified
/// Combat Stat modifiers from a Trainer's acquired Features' Core p58
/// `[+Stat]`-family tags — see `engine::trainer_build::derive_feature_tag_modifiers`,
/// the only producer of this list; this function stays pure/DB-free and
/// simply feeds them into the same modifier pipeline `gm_grants` already
/// uses, so both sources appear together in one `ResolvedValue.breakdown`.
#[allow(clippy::too_many_arguments)]
pub fn resolve_trainer_core(
    level: i64,
    allocation: &TrainerStatAllocation,
    skills: &Value,
    weight_lb: Option<i64>,
    gm_grants: &[Value],
    progression: &[TrainerProgressionRow],
    feature_tag_modifiers: &[super::modifier::Modifier],
) -> TrainerCoreResult {
    let resolve_stat = |stat: TrainerCombatStat| -> ResolvedValue {
        let base = stat_base(allocation, stat) as f64;
        let target = stat_target_key(stat);
        let mut modifiers = stat_modifiers_from_gm_grants(gm_grants, target);
        modifiers.extend(feature_tag_modifiers.iter().filter(|m| m.target == target).cloned());
        resolve_value(base, &modifiers)
    };

    let hp = resolve_stat(TrainerCombatStat::Hp);
    let attack = resolve_stat(TrainerCombatStat::Attack);
    let defense = resolve_stat(TrainerCombatStat::Defense);
    let special_attack = resolve_stat(TrainerCombatStat::SpecialAttack);
    let special_defense = resolve_stat(TrainerCombatStat::SpecialDefense);
    let speed = resolve_stat(TrainerCombatStat::Speed);

    let max_hp_base = max_hp(level, hp.final_value.round() as i64) as f64;
    let max_hp_modifiers = stat_modifiers_from_gm_grants(gm_grants, "trainer.stat.max_hp");
    let max_hp_result = resolve_value(max_hp_base, &max_hp_modifiers);

    let physical_evasion = resolve_value(evasion(defense.final_value.round() as i64) as f64, &[]);
    let special_evasion = resolve_value(evasion(special_defense.final_value.round() as i64) as f64, &[]);
    let speed_evasion = resolve_value(evasion(speed.final_value.round() as i64) as f64, &[]);

    let athletics = skill_rank(skills, "athletics");
    let acrobatics = skill_rank(skills, "acrobatics");
    let combat = skill_rank(skills, "combat");

    let overland_value = overland(athletics, acrobatics);

    let (weight_class_value, weight_issue) = match weight_lb {
        Some(w) => weight_class(w),
        None => (None, None),
    };

    let mut validation = validate_stat_allocation(allocation, level, progression);
    validation.extend(weight_issue);

    let (granted, spent) = granted_and_spent(allocation, level, progression);

    TrainerCoreResult {
        combat_stats: TrainerCombatStatsResolved { hp, attack, defense, special_attack, special_defense, speed },
        max_hp: max_hp_result,
        physical_evasion,
        special_evasion,
        speed_evasion,
        ap: resolve_value(ap(level) as f64, &[]),
        power: resolve_value(power(athletics, combat) as f64, &[]),
        high_jump: resolve_value(high_jump(acrobatics) as f64, &[]),
        high_jump_running_start_bonus: HIGH_JUMP_RUNNING_START_BONUS,
        long_jump: resolve_value(long_jump(acrobatics) as f64, &[]),
        overland: resolve_value(overland_value as f64, &[]),
        swim: resolve_value(swim(overland_value) as f64, &[]),
        throwing_range: resolve_value(throwing_range(athletics) as f64, &[]),
        size: TRAINER_SIZE.to_string(),
        weight: TrainerWeightResult { weight_lb, weight_class: weight_class_value },
        allocation_summary: StatAllocationSummary { granted, spent, remaining: granted - spent },
        validation,
    }
}

// =======================================================================
// T13C1: guided allocation draft → provenance-correct entries
// =======================================================================

/// One stat's proposed *combined* Creation+LevelUp total, as the guided
/// allocation panel edits it. The panel never asks a player to bookkeep
/// which of their points came from character creation versus a specific
/// level-up — see [`build_normal_allocation_entries`] for why that's a
/// safe simplification, not rule-invention.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StatAllocationDraftEntry {
    pub stat: TrainerCombatStat,
    pub points: i64,
}

/// Deterministically splits a player's one-number-per-stat draft into
/// provenance-correct `Creation`/`LevelUp` [`StatAllocationEntry`]s.
///
/// Only the *source* (Creation vs LevelUp) and the *point counts* are
/// load-bearing for [`validate_stat_allocation`]/[`granted_and_spent`] —
/// neither reads a `LevelUp` entry's `level` field for anything (it's
/// provenance metadata, per [`StatAllocationEntry`]'s own doc comment).
/// So this fills the 10-point creation pool first (never more than 5 on
/// one stat, matching Step 6's cap exactly), tags creation-sourced points
/// with `level: 1`, and tags every remaining point `LevelUp` at the
/// Trainer's current level — an honest "recorded as of this level" tag,
/// not a claim about exactly which historical level-up produced it.
/// Negative input points clamp to 0 (never a negative allocation).
pub fn build_normal_allocation_entries(
    desired: &[StatAllocationDraftEntry],
    trainer_level: i64,
    progression: &[TrainerProgressionRow],
) -> Vec<StatAllocationEntry> {
    let creation_pool: i64 = progression.iter().find(|r| r.level == 1).map(|r| r.stat_points_at_level).unwrap_or(0);
    let mut creation_used = 0i64;
    let mut entries = Vec::new();

    for draft in desired {
        let desired_points = draft.points.max(0);
        let creation_here = desired_points.min(5).min((creation_pool - creation_used).max(0));
        if creation_here > 0 {
            entries.push(StatAllocationEntry {
                stat: draft.stat,
                source: StatAllocationSource::Creation,
                level: 1,
                points: creation_here,
                note: None,
                source_id: None,
            });
            creation_used += creation_here;
        }
        let levelup_here = desired_points - creation_here;
        if levelup_here > 0 {
            entries.push(StatAllocationEntry {
                stat: draft.stat,
                source: StatAllocationSource::LevelUp,
                level: trainer_level,
                points: levelup_here,
                note: None,
                source_id: None,
            });
        }
    }

    entries
}

/// Combines a proposed normal-budget allocation with whatever
/// `Milestone`/`GmOverride` entries the Trainer already has —
/// T13C1's guided panel never edits those (plan constraint: "preserve
/// non-user-editable provenance entries"), so they're always carried
/// forward verbatim from `previous`, never reconstructed or guessed.
pub fn merge_with_preserved_provenance(normal_entries: Vec<StatAllocationEntry>, previous: &TrainerStatAllocation) -> TrainerStatAllocation {
    let mut entries = normal_entries;
    entries.extend(
        previous
            .entries
            .iter()
            .filter(|e| matches!(e.source, StatAllocationSource::Milestone | StatAllocationSource::GmOverride))
            .cloned(),
    );
    TrainerStatAllocation { entries }
}

// =======================================================================
// Advancement / milestone provenance
// =======================================================================

/// Why this level's ledger entry exists. Defaults to `Xp` (ordinary play)
/// when a ledger entry is absent or doesn't say otherwise — the standard
/// case, not a fabricated one.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LevelSource {
    Xp,
    Milestone,
    GmAction,
}

fn default_level_source() -> LevelSource {
    LevelSource::Xp
}

/// One `TrainerProfile.progression` entry, typed. Backward-compatible with
/// the shape the pre-T15A `OverviewTab` UI already writes
/// (`{level, stat_points, features, edges, milestone_choice_required}`,
/// see `T13_INTERACTION_PATTERNS.md`) — every T15A-added field is
/// `#[serde(default)]` so an old entry still parses.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProgressionLedgerEntry {
    pub level: i64,
    #[serde(default = "default_level_source")]
    pub level_source: LevelSource,
    #[serde(default)]
    pub stat_points: i64,
    #[serde(default)]
    pub features: i64,
    #[serde(default)]
    pub edges: i64,
    #[serde(default)]
    pub milestone_choice_required: bool,
    /// Which of a milestone's `choice_options` the player actually chose,
    /// once resolved. `None` means unresolved — never auto-selected.
    #[serde(default)]
    pub milestone_choice: Option<String>,
    /// T13D4: for the offensive-stat-stream milestones only (Core p19-20,
    /// levels 5/10/20/30/40) — `"stat_stream"` when this level's milestone
    /// chose the stat stream (vs. an alternative Edge/Feature pick).
    /// `Some(true)` at level 5 additionally records that the L5 choice was
    /// specifically the stream (not the level-5 alternative), which is
    /// what every later stream level's automatic ongoing bonus and
    /// `stat_stream_choice` continuation validity are keyed on.
    #[serde(default)]
    pub milestone_option_kind: Option<String>,
    /// The stat (`"attack"` or `"special_attack"`) locked in at level 5's
    /// stream choice — recorded ONLY on the level-5 ledger entry, then
    /// read back by every later stream level (5/10/20/30/40 all reuse
    /// this one choice; Core never lets it change mid-stream) and by the
    /// automatic ongoing-bonus application at every ordinary level in
    /// between. `None` when level 5 didn't choose the stream at all.
    #[serde(default)]
    pub stat_stream_choice: Option<String>,
    /// T13D4-R2: present only when THIS level's milestone was resolved by
    /// `commit_trainer_milestone_reconciliation` rather than ordinary
    /// advancement — narrow additive provenance for the reconciliation
    /// itself (P4: "no SQLite migration proposed... a new optional object
    /// inside the target progression JSON"). `skip_serializing_if` keeps a
    /// reconciliation-untouched entry's JSON exactly as it already was.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reconciliation: Option<MilestoneReconciliationMetadata>,
}

/// T13D4-R2 (P4): one reconciliation's own record of what it decided —
/// the selected option, the GM's explicit legacy disposition/attribution,
/// and the identity/status of every benefit this milestone tier owed.
/// Reused as-is on replay (never recomputed from a later, possibly
/// different, ruleset state).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MilestoneReconciliationMetadata {
    /// Schema version for this metadata shape — `1` today, so a future
    /// change can distinguish old records without guessing.
    pub version: i64,
    /// `"stat_stream" | "edges" | "general_feature"`.
    pub option: String,
    /// `"not_received" | "map_existing"` — the GM's explicit declaration
    /// of whether this Trainer already held any of this tier's benefits
    /// before reconciliation (P2: never inferred from an empty ledger).
    pub prior_benefits_disposition: String,
    pub attribution_note: String,
    pub benefits: Vec<ReconciledBenefitRecord>,
}

/// One source-defined benefit this milestone tier owed (a retroactive
/// stream bonus, one ongoing-level stream bonus, or one alternative
/// Edge/General-Feature slot) and how it was resolved this reconciliation.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReconciledBenefitRecord {
    /// Stable identity (e.g. `"reconcile:5:retroactive"`,
    /// `"reconcile:5:ongoing:6"`, `"reconcile:10:alternative:0"`) — see
    /// `StatAllocationEntry.source_id`/an acquisition's `source_id`, which
    /// carry this SAME string when the benefit maps to a stat entry or an
    /// Edge/Feature acquisition respectively.
    pub benefit_id: String,
    /// `"stat_stream_retroactive" | "stat_stream_ongoing" | "alternative_edge" | "alternative_general_feature"`.
    pub kind: String,
    /// `"new" | "adopted"` — freshly granted vs. mapped onto an existing
    /// acquisition/stat entry the GM declared already covers it.
    pub status: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct AdvancementRecord {
    pub level: i64,
    pub level_source: LevelSource,
    pub universal_stat_point_grant: i64,
    pub feature_grant: i64,
    pub edge_grant: i64,
    pub milestone_name: Option<String>,
    pub milestone_choice_options: Vec<String>,
    pub milestone_choice: Option<String>,
    /// True only when this level's milestone offers a choice and none has
    /// been recorded yet. Never auto-resolved.
    pub milestone_pending: bool,
}

/// Builds one provenance-bearing record per level from 1 through
/// `trainer_level`, combining the dataset-driven baseline grants
/// (`trainer_progression`/`trainer_milestones` — the same datasets
/// `resolve_trainer_level_up` already reads) with whatever the Trainer's
/// own progression ledger has actually recorded for that level.
///
/// Takes `trainer_level` directly (the Trainer's persisted `level` field)
/// — never a Trainer XP value or curve — so advancement is never inferred
/// from XP (T15A scope).
pub fn resolve_advancement(
    trainer_level: i64,
    ledger: &[Value],
    progression: &[TrainerProgressionRow],
    milestones: &[TrainerMilestoneRow],
) -> Vec<AdvancementRecord> {
    let ledger_by_level: HashMap<i64, ProgressionLedgerEntry> = ledger
        .iter()
        .filter_map(|v| serde_json::from_value::<ProgressionLedgerEntry>(v.clone()).ok().map(|e| (e.level, e)))
        .collect();

    let mut records: Vec<AdvancementRecord> = progression
        .iter()
        .filter(|row| row.level <= trainer_level)
        .map(|row| {
            let recorded = ledger_by_level.get(&row.level);
            let milestone = milestones.iter().find(|m| m.level == row.level);
            let milestone_choice = recorded.and_then(|r| r.milestone_choice.clone());
            let milestone_pending =
                milestone.is_some_and(|m| !m.choice_options.is_empty()) && milestone_choice.is_none();

            AdvancementRecord {
                level: row.level,
                level_source: recorded.map(|r| r.level_source).unwrap_or(LevelSource::Xp),
                universal_stat_point_grant: row.stat_points_at_level,
                feature_grant: row.features_at_level,
                edge_grant: row.edges_at_level,
                milestone_name: milestone.map(|m| m.name.clone()),
                milestone_choice_options: milestone.map(|m| m.choice_options.clone()).unwrap_or_default(),
                milestone_choice,
                milestone_pending,
            }
        })
        .collect();

    records.sort_by_key(|r| r.level);
    records
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // -------------------------------------------------------------
    // Skill rank
    // -------------------------------------------------------------

    #[test]
    fn skill_rank_ordinals_match_the_cited_mapping() {
        assert_eq!(SkillRank::Pathetic.ordinal(), 1);
        assert_eq!(SkillRank::Untrained.ordinal(), 2);
        assert_eq!(SkillRank::Novice.ordinal(), 3);
        assert_eq!(SkillRank::Adept.ordinal(), 4);
        assert_eq!(SkillRank::Expert.ordinal(), 5);
        assert_eq!(SkillRank::Master.ordinal(), 6);
    }

    #[test]
    fn skill_rank_parses_all_six_labels_case_insensitively() {
        assert_eq!(SkillRank::from_str("Pathetic"), Some(SkillRank::Pathetic));
        assert_eq!(SkillRank::from_str("untrained"), Some(SkillRank::Untrained));
        assert_eq!(SkillRank::from_str("NOVICE"), Some(SkillRank::Novice));
        assert_eq!(SkillRank::from_str("Adept"), Some(SkillRank::Adept));
        assert_eq!(SkillRank::from_str("expert"), Some(SkillRank::Expert));
        assert_eq!(SkillRank::from_str("master"), Some(SkillRank::Master));
        assert_eq!(SkillRank::from_str("not-a-rank"), None);
    }

    #[test]
    fn skill_rank_defaults_to_untrained_when_skill_is_absent() {
        assert_eq!(skill_rank(&json!({}), "athletics"), SkillRank::Untrained);
    }

    #[test]
    fn skill_rank_reads_the_fixture_shape() {
        let skills = json!({"stealth": {"base_rank": "novice"}, "perception": {"base_rank": "adept"}});
        assert_eq!(skill_rank(&skills, "stealth"), SkillRank::Novice);
        assert_eq!(skill_rank(&skills, "perception"), SkillRank::Adept);
    }

    // -------------------------------------------------------------
    // Step 6 formulas
    // -------------------------------------------------------------

    #[test]
    fn max_hp_matches_formula_at_representative_and_boundary_levels() {
        assert_eq!(max_hp(1, 10), 42); // level 1 floor: 2 + 30 + 10
        assert_eq!(max_hp(20, 25), 40 + 75 + 10);
        assert_eq!(max_hp(50, 40), 100 + 120 + 10);
    }

    #[test]
    fn evasion_boundaries_at_4_and_5() {
        assert_eq!(evasion(4), 0);
        assert_eq!(evasion(5), 1);
    }

    #[test]
    fn evasion_boundaries_at_29_30_35_cap_at_6() {
        assert_eq!(evasion(29), 5);
        assert_eq!(evasion(30), 6);
        assert_eq!(evasion(35), 6, "uncapped would be 7, must cap at +6");
    }

    #[test]
    fn ap_formula_at_thresholds() {
        assert_eq!(ap(1), 5);
        assert_eq!(ap(4), 5);
        assert_eq!(ap(5), 6);
        assert_eq!(ap(24), 9);
        assert_eq!(ap(25), 10);
    }

    #[test]
    fn power_formula_thresholds() {
        assert_eq!(power(SkillRank::Untrained, SkillRank::Novice), 4);
        assert_eq!(power(SkillRank::Novice, SkillRank::Novice), 5, "athletics at Novice adds +1");
        assert_eq!(power(SkillRank::Untrained, SkillRank::Adept), 5, "combat at Adept adds +1");
        assert_eq!(power(SkillRank::Expert, SkillRank::Master), 6);
    }

    #[test]
    fn high_jump_thresholds_and_running_start_never_mutates_base() {
        assert_eq!(high_jump(SkillRank::Novice), 0);
        assert_eq!(high_jump(SkillRank::Adept), 1);
        assert_eq!(high_jump(SkillRank::Expert), 1);
        assert_eq!(high_jump(SkillRank::Master), 2, "Adept's +1 plus Master's additional +1");
        assert_eq!(HIGH_JUMP_RUNNING_START_BONUS, 1);
        // The running-start bonus is a separate constant, never folded in:
        assert_eq!(high_jump(SkillRank::Master) + HIGH_JUMP_RUNNING_START_BONUS, 3);
        assert_eq!(high_jump(SkillRank::Master), 2, "base itself must be unaffected by the running-start constant existing");
    }

    #[test]
    fn long_jump_floor_division_by_2() {
        assert_eq!(long_jump(SkillRank::Pathetic), 0);
        assert_eq!(long_jump(SkillRank::Untrained), 1);
        assert_eq!(long_jump(SkillRank::Novice), 1);
        assert_eq!(long_jump(SkillRank::Adept), 2);
        assert_eq!(long_jump(SkillRank::Master), 3);
    }

    #[test]
    fn overland_sums_ranks_before_floor_division() {
        assert_eq!(overland(SkillRank::Untrained, SkillRank::Untrained), 5); // 3 + floor(4/2)
        assert_eq!(overland(SkillRank::Novice, SkillRank::Untrained), 5, "odd sum 5 floors down: 3 + floor(5/2)=3+2");
        assert_eq!(overland(SkillRank::Master, SkillRank::Master), 9); // 3 + floor(12/2)
    }

    #[test]
    fn swim_is_floor_of_overland_over_2() {
        assert_eq!(swim(5), 2);
        assert_eq!(swim(9), 4);
    }

    #[test]
    fn throwing_range_adds_athletics_rank() {
        assert_eq!(throwing_range(SkillRank::Untrained), 6);
        assert_eq!(throwing_range(SkillRank::Master), 10);
    }

    // -------------------------------------------------------------
    // Weight Class
    // -------------------------------------------------------------

    #[test]
    fn weight_class_boundaries_55_110_111_220_221() {
        assert_eq!(weight_class(55).0, Some(WeightClass::Wc3));
        assert_eq!(weight_class(110).0, Some(WeightClass::Wc3));
        assert_eq!(weight_class(111).0, Some(WeightClass::Wc4));
        assert_eq!(weight_class(220).0, Some(WeightClass::Wc4));
        assert_eq!(weight_class(221).0, Some(WeightClass::Wc5));
    }

    #[test]
    fn weight_below_55_is_a_typed_validation_issue_not_extrapolated() {
        let (class, issue) = weight_class(54);
        assert_eq!(class, None);
        let issue = issue.expect("must produce a validation issue, not a silent guess");
        assert_eq!(issue.code, "TRAINER_WEIGHT_BELOW_SUPPORTED_RANGE");
        assert_eq!(issue.severity, Severity::Error);
        assert!(!issue.override_allowed);
    }

    // -------------------------------------------------------------
    // Stat allocation base + validation
    // -------------------------------------------------------------

    fn entry(stat: TrainerCombatStat, source: StatAllocationSource, level: i64, points: i64) -> StatAllocationEntry {
        StatAllocationEntry { stat, source, level, points, note: None, source_id: None }
    }

    #[test]
    fn stat_base_is_floor_plus_allocated_points() {
        let allocation = TrainerStatAllocation {
            entries: vec![entry(TrainerCombatStat::Hp, StatAllocationSource::Creation, 1, 3)],
        };
        assert_eq!(stat_base(&allocation, TrainerCombatStat::Hp), 13); // 10 floor + 3
        assert_eq!(stat_base(&allocation, TrainerCombatStat::Attack), 5, "untouched stat stays at its floor");
    }

    fn level1_progression() -> Vec<TrainerProgressionRow> {
        vec![TrainerProgressionRow { level: 1, stat_points_at_level: 10, features_at_level: 5, edges_at_level: 4 }]
    }

    fn levels_1_to_5_progression() -> Vec<TrainerProgressionRow> {
        vec![
            TrainerProgressionRow { level: 1, stat_points_at_level: 10, features_at_level: 5, edges_at_level: 4 },
            TrainerProgressionRow { level: 2, stat_points_at_level: 1, features_at_level: 0, edges_at_level: 2 },
            TrainerProgressionRow { level: 3, stat_points_at_level: 1, features_at_level: 1, edges_at_level: 0 },
            TrainerProgressionRow { level: 4, stat_points_at_level: 1, features_at_level: 0, edges_at_level: 1 },
            TrainerProgressionRow { level: 5, stat_points_at_level: 1, features_at_level: 1, edges_at_level: 0 },
        ]
    }

    #[test]
    fn empty_allocation_at_level_1_is_incomplete_not_an_error() {
        let allocation = TrainerStatAllocation::default();
        let issues = validate_stat_allocation(&allocation, 1, &level1_progression());
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].code, "TRAINER_STAT_ALLOCATION_INCOMPLETE");
        assert_eq!(issues[0].severity, Severity::Info);
    }

    #[test]
    fn exactly_10_creation_points_spread_within_cap_is_valid() {
        let allocation = TrainerStatAllocation {
            entries: vec![
                entry(TrainerCombatStat::Hp, StatAllocationSource::Creation, 1, 4),
                entry(TrainerCombatStat::Attack, StatAllocationSource::Creation, 1, 2),
                entry(TrainerCombatStat::Defense, StatAllocationSource::Creation, 1, 2),
                entry(TrainerCombatStat::Speed, StatAllocationSource::Creation, 1, 2),
            ],
        };
        let issues = validate_stat_allocation(&allocation, 1, &level1_progression());
        assert!(issues.is_empty(), "10 points spent, none over the 5-cap: no issues, got {issues:?}");
    }

    #[test]
    fn more_than_5_creation_points_on_one_stat_is_a_non_overridable_error() {
        let allocation = TrainerStatAllocation {
            entries: vec![
                entry(TrainerCombatStat::Attack, StatAllocationSource::Creation, 1, 6),
                entry(TrainerCombatStat::Defense, StatAllocationSource::Creation, 1, 4),
            ],
        };
        let issues = validate_stat_allocation(&allocation, 1, &level1_progression());
        let cap_issue = issues.iter().find(|i| i.code == "TRAINER_STAT_CREATION_CAP_EXCEEDED").unwrap();
        assert_eq!(cap_issue.severity, Severity::Error);
        assert!(!cap_issue.override_allowed);
    }

    #[test]
    fn a_gm_override_entry_bypasses_the_creation_cap_without_tripping_it() {
        let allocation = TrainerStatAllocation {
            entries: vec![
                entry(TrainerCombatStat::Attack, StatAllocationSource::Creation, 1, 5),
                entry(TrainerCombatStat::Attack, StatAllocationSource::GmOverride, 1, 3),
                entry(TrainerCombatStat::Defense, StatAllocationSource::Creation, 1, 5),
            ],
        };
        let issues = validate_stat_allocation(&allocation, 1, &level1_progression());
        assert!(
            issues.iter().all(|i| i.code != "TRAINER_STAT_CREATION_CAP_EXCEEDED"),
            "GmOverride points are outside the creation-cap check entirely: {issues:?}"
        );
        assert!(
            issues.iter().all(|i| i.code != "TRAINER_STAT_POINTS_OVERSPENT"),
            "GmOverride points are outside the granted/spent budget entirely: {issues:?}"
        );
    }

    #[test]
    fn overspending_creation_points_is_an_overridable_error() {
        let allocation = TrainerStatAllocation {
            entries: vec![entry(TrainerCombatStat::Attack, StatAllocationSource::Creation, 1, 5), entry(TrainerCombatStat::Defense, StatAllocationSource::Creation, 1, 5), entry(TrainerCombatStat::Speed, StatAllocationSource::Creation, 1, 1)],
        };
        let issues = validate_stat_allocation(&allocation, 1, &level1_progression());
        let overspend = issues.iter().find(|i| i.code == "TRAINER_STAT_POINTS_OVERSPENT").unwrap();
        assert_eq!(overspend.severity, Severity::Error);
        assert!(overspend.override_allowed);
    }

    #[test]
    fn level_5_budget_accumulates_creation_plus_four_level_up_points() {
        // 10 (level 1) + 1*4 (levels 2-5) = 14.
        let full_allocation = TrainerStatAllocation {
            entries: vec![
                entry(TrainerCombatStat::Hp, StatAllocationSource::Creation, 1, 5),
                entry(TrainerCombatStat::Defense, StatAllocationSource::Creation, 1, 5),
                entry(TrainerCombatStat::Attack, StatAllocationSource::LevelUp, 2, 1),
                entry(TrainerCombatStat::Attack, StatAllocationSource::LevelUp, 3, 1),
                entry(TrainerCombatStat::Attack, StatAllocationSource::LevelUp, 4, 1),
                entry(TrainerCombatStat::Attack, StatAllocationSource::LevelUp, 5, 1),
            ],
        };
        let issues = validate_stat_allocation(&full_allocation, 5, &levels_1_to_5_progression());
        assert!(issues.is_empty(), "expected no issues, got {issues:?}");

        let partial_allocation = TrainerStatAllocation {
            entries: vec![
                entry(TrainerCombatStat::Hp, StatAllocationSource::Creation, 1, 5),
                entry(TrainerCombatStat::Defense, StatAllocationSource::Creation, 1, 5),
            ],
        };
        let issues = validate_stat_allocation(&partial_allocation, 5, &levels_1_to_5_progression());
        assert_eq!(issues[0].code, "TRAINER_STAT_ALLOCATION_INCOMPLETE");
        assert_eq!(issues[0].severity, Severity::Info);

        let overspent_allocation = TrainerStatAllocation {
            entries: vec![
                entry(TrainerCombatStat::Hp, StatAllocationSource::Creation, 1, 5),
                entry(TrainerCombatStat::Defense, StatAllocationSource::Creation, 1, 5),
                entry(TrainerCombatStat::Attack, StatAllocationSource::LevelUp, 2, 5),
            ],
        };
        let issues = validate_stat_allocation(&overspent_allocation, 5, &levels_1_to_5_progression());
        assert!(
            issues.iter().any(|i| i.code == "TRAINER_STAT_POINTS_OVERSPENT"),
            "expected an overspend issue, got {issues:?}"
        );
        assert!(
            issues.iter().all(|i| i.code != "TRAINER_STAT_CREATION_CAP_EXCEEDED"),
            "this case should isolate the overspend condition, got {issues:?}"
        );
    }

    // -------------------------------------------------------------
    // T13C1: allocation_summary + guided-draft → provenance-correct entries
    // -------------------------------------------------------------

    #[test]
    fn allocation_summary_reports_granted_spent_and_remaining_at_level_1() {
        let allocation = TrainerStatAllocation {
            entries: vec![entry(TrainerCombatStat::Hp, StatAllocationSource::Creation, 1, 4)],
        };
        let result = resolve_trainer_core(1, &allocation, &json!({}), None, &[], &level1_progression(), &[]);
        assert_eq!(result.allocation_summary, StatAllocationSummary { granted: 10, spent: 4, remaining: 6 });
    }

    #[test]
    fn allocation_summary_ignores_milestone_and_gm_override_points() {
        let allocation = TrainerStatAllocation {
            entries: vec![
                entry(TrainerCombatStat::Hp, StatAllocationSource::Creation, 1, 4),
                entry(TrainerCombatStat::Attack, StatAllocationSource::GmOverride, 1, 3),
                entry(TrainerCombatStat::Defense, StatAllocationSource::Milestone, 2, 2),
            ],
        };
        let result = resolve_trainer_core(1, &allocation, &json!({}), None, &[], &level1_progression(), &[]);
        assert_eq!(result.allocation_summary, StatAllocationSummary { granted: 10, spent: 4, remaining: 6 }, "GmOverride/Milestone points never count against the normal budget");
    }

    #[test]
    fn build_normal_allocation_entries_fills_creation_pool_before_overflowing_to_level_up() {
        let desired = vec![
            StatAllocationDraftEntry { stat: TrainerCombatStat::Hp, points: 5 },
            StatAllocationDraftEntry { stat: TrainerCombatStat::Attack, points: 7 },
        ];
        let entries = build_normal_allocation_entries(&desired, 3, &levels_1_to_5_progression());

        let hp_creation = entries.iter().find(|e| e.stat == TrainerCombatStat::Hp && e.source == StatAllocationSource::Creation).unwrap();
        assert_eq!(hp_creation.points, 5);

        let attack_creation = entries.iter().find(|e| e.stat == TrainerCombatStat::Attack && e.source == StatAllocationSource::Creation).unwrap();
        assert_eq!(attack_creation.points, 5, "only 5 of the 10-point creation pool remained after HP took 5");

        let attack_levelup = entries.iter().find(|e| e.stat == TrainerCombatStat::Attack && e.source == StatAllocationSource::LevelUp).unwrap();
        assert_eq!(attack_levelup.points, 2, "the remaining 2 of the desired 7 overflow to LevelUp");
        assert_eq!(attack_levelup.level, 3, "LevelUp entries are tagged with the Trainer's current level as provenance metadata only");
    }

    #[test]
    fn build_normal_allocation_entries_caps_a_single_stats_creation_share_at_5() {
        let desired = vec![StatAllocationDraftEntry { stat: TrainerCombatStat::Hp, points: 8 }];
        let entries = build_normal_allocation_entries(&desired, 1, &level1_progression());

        let creation = entries.iter().find(|e| e.source == StatAllocationSource::Creation).unwrap();
        assert_eq!(creation.points, 5, "a single stat can never draw more than the 5-point per-stat creation cap");

        let levelup = entries.iter().find(|e| e.source == StatAllocationSource::LevelUp).unwrap();
        assert_eq!(levelup.points, 3, "the remaining 3 desired points overflow to LevelUp even though the creation pool itself isn't exhausted");
    }

    #[test]
    fn build_normal_allocation_entries_clamps_negative_desired_points_to_zero() {
        let desired = vec![StatAllocationDraftEntry { stat: TrainerCombatStat::Hp, points: -4 }];
        let entries = build_normal_allocation_entries(&desired, 1, &level1_progression());
        assert!(entries.is_empty(), "negative desired points never produce a persisted entry");
    }

    #[test]
    fn build_normal_allocation_entries_omits_a_zero_points_stat_entirely() {
        let desired = vec![StatAllocationDraftEntry { stat: TrainerCombatStat::Hp, points: 0 }];
        let entries = build_normal_allocation_entries(&desired, 1, &level1_progression());
        assert!(entries.is_empty());
    }

    #[test]
    fn merge_with_preserved_provenance_carries_milestone_and_gm_override_forward_untouched() {
        let previous = TrainerStatAllocation {
            entries: vec![
                entry(TrainerCombatStat::Attack, StatAllocationSource::Creation, 1, 5),
                entry(TrainerCombatStat::Defense, StatAllocationSource::LevelUp, 2, 1),
                entry(TrainerCombatStat::SpecialAttack, StatAllocationSource::Milestone, 5, 2),
                entry(TrainerCombatStat::Speed, StatAllocationSource::GmOverride, 1, 3),
            ],
        };
        let normal_entries = vec![entry(TrainerCombatStat::Hp, StatAllocationSource::Creation, 1, 4)];

        let merged = merge_with_preserved_provenance(normal_entries, &previous);

        assert!(merged.entries.iter().any(|e| e.stat == TrainerCombatStat::Hp && e.source == StatAllocationSource::Creation && e.points == 4));
        assert!(
            merged.entries.iter().any(|e| e.stat == TrainerCombatStat::SpecialAttack && e.source == StatAllocationSource::Milestone && e.points == 2),
            "Milestone provenance must be preserved verbatim"
        );
        assert!(
            merged.entries.iter().any(|e| e.stat == TrainerCombatStat::Speed && e.source == StatAllocationSource::GmOverride && e.points == 3),
            "GmOverride provenance must be preserved verbatim"
        );
        assert!(
            !merged.entries.iter().any(|e| e.source == StatAllocationSource::Creation && e.stat == TrainerCombatStat::Attack),
            "the previous Creation/LevelUp entries are replaced, not accumulated"
        );
        assert!(!merged.entries.iter().any(|e| e.source == StatAllocationSource::LevelUp && e.stat == TrainerCombatStat::Defense));
        assert_eq!(merged.entries.len(), 3, "1 new normal entry + 2 preserved provenance entries");
    }

    // -------------------------------------------------------------
    // Modifier integration
    // -------------------------------------------------------------

    #[test]
    fn gm_grant_modifiers_are_parsed_only_for_matching_fixed_target() {
        let grants = vec![
            json!({"id": "g1", "kind": "fixed", "target": "trainer.stat.attack", "operation": "add", "value": 3}),
            json!({"id": "g2", "kind": "fixed", "target": "trainer.stat.defense", "operation": "add", "value": 3}),
            json!({"id": "g3", "kind": "resource", "resource": "edge", "amount": 1}),
        ];
        let modifiers = stat_modifiers_from_gm_grants(&grants, "trainer.stat.attack");
        assert_eq!(modifiers.len(), 1);
        assert_eq!(modifiers[0].id, "g1");
        assert_eq!(modifiers[0].value, 3.0);
    }

    #[test]
    fn resolve_trainer_core_feeds_gm_grants_through_the_modifier_engine_with_breakdown() {
        let allocation = TrainerStatAllocation {
            entries: vec![entry(TrainerCombatStat::Attack, StatAllocationSource::Creation, 1, 2)],
        };
        let gm_grants = vec![json!({"id": "training-focus", "kind": "fixed", "target": "trainer.stat.attack", "operation": "add", "value": 5.0})];
        let result = resolve_trainer_core(1, &allocation, &json!({}), None, &gm_grants, &level1_progression(), &[]);

        assert_eq!(result.combat_stats.attack.base, 7.0); // 5 floor + 2 allocated
        assert_eq!(result.combat_stats.attack.final_value, 12.0); // + the GM grant
        assert_eq!(result.combat_stats.attack.breakdown.len(), 1);
        assert_eq!(result.combat_stats.attack.breakdown[0].label, "GM Grant");
    }

    #[test]
    fn missing_allocation_resolves_real_floor_values_not_zero_while_flagging_incomplete() {
        let result = resolve_trainer_core(1, &TrainerStatAllocation::default(), &json!({}), None, &[], &level1_progression(), &[]);
        assert_eq!(result.combat_stats.hp.final_value, 10.0, "the real Step 6 floor, never zero");
        assert_eq!(result.combat_stats.attack.final_value, 5.0);
        assert!(result.validation.iter().any(|i| i.code == "TRAINER_STAT_ALLOCATION_INCOMPLETE"));
    }

    #[test]
    fn max_hp_uses_the_resolved_hp_stat_so_a_hp_grant_cascades() {
        let allocation = TrainerStatAllocation {
            entries: vec![entry(TrainerCombatStat::Hp, StatAllocationSource::Creation, 1, 0)],
        };
        let gm_grants = vec![json!({"id": "tough", "kind": "fixed", "target": "trainer.stat.hp", "operation": "add", "value": 2.0})];
        let result = resolve_trainer_core(1, &allocation, &json!({}), None, &gm_grants, &level1_progression(), &[]);
        assert_eq!(result.combat_stats.hp.final_value, 12.0); // 10 floor + 2 grant
        assert_eq!(result.max_hp.base, (1 * 2 + 12 * 3 + 10) as f64);
    }

    #[test]
    fn weight_class_is_none_and_issue_free_when_weight_is_simply_not_entered_yet() {
        let result = resolve_trainer_core(1, &TrainerStatAllocation::default(), &json!({}), None, &[], &level1_progression(), &[]);
        assert_eq!(result.weight.weight_class, None);
        assert!(result.validation.iter().all(|i| i.code != "TRAINER_WEIGHT_BELOW_SUPPORTED_RANGE"));
    }

    #[test]
    fn weight_below_range_surfaces_as_a_validation_issue_on_the_aggregate_result() {
        let result = resolve_trainer_core(1, &TrainerStatAllocation::default(), &json!({}), Some(40), &[], &level1_progression(), &[]);
        assert!(result.validation.iter().any(|i| i.code == "TRAINER_WEIGHT_BELOW_SUPPORTED_RANGE"));
    }

    // -------------------------------------------------------------
    // Advancement / milestone provenance
    // -------------------------------------------------------------

    fn milestones() -> Vec<TrainerMilestoneRow> {
        vec![
            TrainerMilestoneRow { level: 2, name: "Adept Skills".to_string(), choice_options: vec![] },
            TrainerMilestoneRow {
                level: 5,
                name: "Amateur Trainer".to_string(),
                choice_options: vec!["Attack/SpAtk stream".to_string(), "Gain one General Feature".to_string()],
            },
        ]
    }

    #[test]
    fn advancement_records_cover_every_level_up_to_current_with_baseline_grants() {
        let records = resolve_advancement(2, &[], &levels_1_to_5_progression(), &milestones());
        assert_eq!(records.len(), 2);
        assert_eq!(records[0].level, 1);
        assert_eq!(records[0].universal_stat_point_grant, 10);
        assert_eq!(records[0].feature_grant, 5);
        assert_eq!(records[0].edge_grant, 4);
        assert_eq!(records[0].milestone_name, None);
        assert_eq!(records[1].level, 2);
        assert_eq!(records[1].milestone_name, Some("Adept Skills".to_string()));
    }

    #[test]
    fn milestone_without_choice_options_is_never_pending() {
        let records = resolve_advancement(2, &[], &levels_1_to_5_progression(), &milestones());
        assert!(!records[1].milestone_pending, "Adept Skills has no choice_options, so it can't be pending");
    }

    #[test]
    fn milestone_with_choice_options_and_no_recorded_choice_is_pending_never_auto_bonused() {
        let records = resolve_advancement(5, &[], &levels_1_to_5_progression(), &milestones());
        let level5 = records.iter().find(|r| r.level == 5).unwrap();
        assert!(level5.milestone_pending);
        assert_eq!(level5.milestone_choice, None);
    }

    #[test]
    fn a_recorded_milestone_choice_resolves_pending_to_false() {
        let ledger = vec![json!({"level": 5, "milestone_choice": "Gain one General Feature"})];
        let records = resolve_advancement(5, &ledger, &levels_1_to_5_progression(), &milestones());
        let level5 = records.iter().find(|r| r.level == 5).unwrap();
        assert!(!level5.milestone_pending);
        assert_eq!(level5.milestone_choice, Some("Gain one General Feature".to_string()));
    }

    #[test]
    fn level_source_defaults_to_xp_and_honors_an_explicit_gm_action() {
        let ledger = vec![json!({"level": 3, "level_source": "gm_action"})];
        let records = resolve_advancement(3, &ledger, &levels_1_to_5_progression(), &milestones());
        assert_eq!(records[0].level_source, LevelSource::Xp, "level 1 has no ledger entry: defaults to Xp");
        let level3 = records.iter().find(|r| r.level == 3).unwrap();
        assert_eq!(level3.level_source, LevelSource::GmAction);
    }

    #[test]
    fn a_pre_t15a_ledger_entry_shape_still_parses() {
        // Exactly what OverviewTab.tsx already writes today, with no
        // T15A-added fields at all.
        let ledger = vec![json!({"level": 2, "stat_points": 1, "features": 0, "edges": 2, "milestone_choice_required": false})];
        let records = resolve_advancement(2, &ledger, &levels_1_to_5_progression(), &milestones());
        assert_eq!(records.len(), 2);
    }

    // -------------------------------------------------------------
    // Command/API serialization shape (T15A Worker Verification): the
    // exact JSON keys/casing `app/src/lib/api.ts`'s `TrainerCoreResult`/
    // `AdvancementRecord` TypeScript interfaces expect, so drift between
    // the Rust and TS shapes fails a named test instead of shipping silently.
    // -------------------------------------------------------------

    #[test]
    fn trainer_core_result_serializes_with_the_exact_keys_api_ts_expects() {
        let result = resolve_trainer_core(1, &TrainerStatAllocation::default(), &json!({}), Some(150), &[], &level1_progression(), &[]);
        let value = serde_json::to_value(&result).unwrap();

        for key in [
            "combat_stats",
            "max_hp",
            "physical_evasion",
            "special_evasion",
            "speed_evasion",
            "ap",
            "power",
            "high_jump",
            "high_jump_running_start_bonus",
            "long_jump",
            "overland",
            "swim",
            "throwing_range",
            "size",
            "weight",
            "validation",
            "allocation_summary",
        ] {
            assert!(value.get(key).is_some(), "missing top-level key \"{key}\" in {value}");
        }

        for stat_key in ["hp", "attack", "defense", "special_attack", "special_defense", "speed"] {
            let stat = &value["combat_stats"][stat_key];
            assert!(stat.get("base").is_some() && stat.get("final_value").is_some() && stat.get("breakdown").is_some(), "combat_stats.{stat_key} missing base/final_value/breakdown");
        }

        assert_eq!(value["weight"]["weight_lb"], 150);
        assert_eq!(value["weight"]["weight_class"], "wc4", "WeightClass must serialize snake_case-lowercase, matching api.ts's WeightClass union");
    }

    #[test]
    fn advancement_record_serializes_with_the_exact_keys_api_ts_expects() {
        let records = resolve_advancement(1, &[], &level1_progression(), &milestones());
        let value = serde_json::to_value(&records[0]).unwrap();
        for key in [
            "level",
            "level_source",
            "universal_stat_point_grant",
            "feature_grant",
            "edge_grant",
            "milestone_name",
            "milestone_choice_options",
            "milestone_choice",
            "milestone_pending",
        ] {
            assert!(value.get(key).is_some(), "missing key \"{key}\" in {value}");
        }
        assert_eq!(value["level_source"], "xp");
    }
}
