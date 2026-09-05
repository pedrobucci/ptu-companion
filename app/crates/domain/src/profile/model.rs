//! Trainer profile value model (technical spec sections 7-13, 17-18; shape
//! verified against `fixtures/trainer_profile_full.json`).
//!
//! Fields nothing here queries relationally stay as raw `serde_json::Value`
//! (GM grants, NPC records, progression-ledger entries, timeline events) —
//! same rationale as `content::import`'s `data_json` columns: the engines
//! that actually interpret these (modifier/progression engine, T05+) don't
//! exist yet, so exploding them into typed fields now would be guessing at
//! their shape. Fields already known to need relational queries very soon
//! (Pokémon `injuries`/`storage_state` for T06's storage invariant, roster
//! membership for T06's multi-roster support) are typed.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct TrainerProfile {
    pub id: String,
    pub name: String,
    pub level: i64,
    pub exp: i64,
    pub money: i64,
    #[serde(default)]
    pub background: Option<Value>,
    /// Map of skill key -> `{base_rank, ...}`. Kept generic; the rules
    /// engine (T05) is what actually needs to interpret a skill rank.
    #[serde(default)]
    pub skills: Value,
    /// Each entry must carry an `"id"` (string) and `"kind"` (string) —
    /// enforced when saving, not by this type. See module docs.
    #[serde(default)]
    pub gm_grants: Vec<Value>,
    /// Unlimited Trainer Move list (spec §7, IMPLEMENTATION_PLAN.md's hard
    /// requirement — never a fixed-size array). Each entry must carry a
    /// `"definition_version_id"` (string) referencing a Move by exact
    /// version — the instance never copies or mutates the definition's
    /// text, only points at it (see [`crate::content::repository::get_definition_by_version_id`]).
    /// Anything else (how it was learned, GM notes) is free-form.
    #[serde(default)]
    pub moves: Vec<Value>,
    #[serde(default)]
    pub edges: Vec<Value>,
    #[serde(default)]
    pub features: Vec<Value>,
    #[serde(default)]
    pub abilities: Vec<Value>,
    #[serde(default)]
    pub capabilities: Vec<Value>,
    #[serde(default)]
    pub rosters: Vec<RosterRecord>,
    #[serde(default)]
    pub pokemon: Vec<PokemonInstance>,
    #[serde(default)]
    pub inventory: InventoryRecord,
    /// Each entry must carry an `"id"` (string). See module docs.
    #[serde(default)]
    pub npcs: Vec<Value>,
    /// Each entry must carry a `"level"` (integer). See module docs.
    #[serde(default)]
    pub progression: Vec<Value>,
    /// Each entry must carry a `"kind"` (string); order is preserved.
    #[serde(default)]
    pub timeline: Vec<Value>,
    /// Trainer's own dynamic combat state (HP/AP/combat stages). Not
    /// present in the reference fixture; `None` until the Trainer actually
    /// has any (spec 37: unknown stays nullable, never coerced to zero).
    #[serde(default)]
    pub combat: Option<CombatState>,
    /// PTU 1.05 Core Step 6 (T15A, book pp. 17-20): the six persisted
    /// Combat Stat allocations this Trainer has actually spent — never a
    /// computed number. Current HP stays in `combat` (dynamic state); Max
    /// HP is derived (`engine::trainer_core::max_hp`), never duplicated
    /// here. An empty `entries` list is "not yet allocated" (unknown), not
    /// "zero" — see `engine::trainer_core::validate_stat_allocation`.
    #[serde(default)]
    pub stat_allocation: TrainerStatAllocation,
    /// Authoritative entered weight in pounds, for Trainer Weight Class
    /// (T15A, Step 6). `None` is "not entered yet", distinct from any
    /// numeric value — spec 7 lists weight among the identity fields no
    /// prior task added.
    #[serde(default)]
    pub weight_lb: Option<i64>,
    /// T13D1 (§3.3): narrow, opaque published-build metadata/status and
    /// campaign-variant provenance (e.g. "Elemental Connection uses the
    /// distinct-Type campaign variant, not Core") — kept separate from
    /// `background`/mechanics so narrative identity fields never overload
    /// Background's rule meaning. `None` means legacy/unknown, never a
    /// reset — the same "NULL is not zero" precedent as `weight_lb`. Typed
    /// interpretation (`BuildStatus`, campaign-variant flags) belongs to
    /// `engine::trainer_build`, which is free to change its own shape
    /// without a persistence migration as long as this stays valid JSON.
    #[serde(default)]
    pub build_state: Option<Value>,
}

/// The six persisted Trainer Combat Stats (T15A, PTU 1.05 Core Step 6).
/// Current HP and Accuracy are deliberately absent: Current HP is dynamic
/// combat state (`CombatState::current_hp`); Accuracy has no persisted
/// base at all (T15A scope: "Accuracy is not one of the six persisted
/// Combat Stats") and is reported only from combat-stage/modifier state.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum TrainerCombatStat {
    Hp,
    Attack,
    Defense,
    SpecialAttack,
    SpecialDefense,
    Speed,
}

/// Where one allocated Stat Point came from (T15A, PTU 1.05 Core Step 6 /
/// Character Advancement, book pp. 17-20). Keeping this on every entry —
/// rather than a flat per-stat total — is what lets validation check "the
/// 10 creation points, capped at 5/stat" and "1 point per level after 1"
/// without reverse-engineering a total (T15A scope).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StatAllocationSource {
    /// Character creation's 10-point pool (book p. 17-18), always
    /// recorded at level 1.
    Creation,
    /// The +1 Stat Point every level after 1 grants automatically (book
    /// p. 20, `trainer_progression.json`'s `stat_points_at_level`).
    LevelUp,
    /// A milestone's optional bonus Stat Point stream (level 5/10/20/30/40
    /// choice) — present only once the player has actually chosen it.
    /// T15A does not compute these amounts (the milestone text describes a
    /// multi-level conditional stream, not a closed formula); it only
    /// types and passes through whatever a future T16 wizard records.
    Milestone,
    /// An explicit, provenance-recorded GM deviation from the normal
    /// allocation rules (e.g. exceeding the 5-per-stat creation cap).
    /// Never applied implicitly — only present when actually recorded.
    GmOverride,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StatAllocationEntry {
    pub stat: TrainerCombatStat,
    pub source: StatAllocationSource,
    /// The Trainer level this allocation was granted/spent at. Creation
    /// entries use level 1.
    pub level: i64,
    pub points: i64,
    /// Optional narrative context (recommended for `GmOverride`, since the
    /// entry's `source` alone is what makes an override "recorded" — this
    /// module does not require a non-empty note).
    #[serde(default)]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct TrainerStatAllocation {
    #[serde(default)]
    pub entries: Vec<StatAllocationEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RosterRecord {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub active: bool,
    #[serde(default)]
    pub max_members: Option<i64>,
    /// Purpose/affiliation/restriction flags (spec 9) — data-driven, kept generic.
    #[serde(default)]
    pub rules: Value,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum StorageState {
    #[default]
    Carried,
    Stored,
}

impl StorageState {
    pub fn as_str(self) -> &'static str {
        match self {
            StorageState::Carried => "carried",
            StorageState::Stored => "stored",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "carried" => Some(StorageState::Carried),
            "stored" => Some(StorageState::Stored),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct PokemonInstance {
    pub id: String,
    pub species_definition_id: String,
    #[serde(default)]
    pub nickname: Option<String>,
    pub level: i64,
    #[serde(default)]
    pub exp: Option<i64>,
    #[serde(default)]
    pub capture_ball_item_id: Option<String>,
    #[serde(default)]
    pub injuries: i64,
    #[serde(default)]
    pub held_item_id: Option<String>,
    pub storage_state: StorageState,
    /// Roster ids this Pokémon currently belongs to; a Pokémon may belong
    /// to more than one active roster at once (spec 9).
    #[serde(default)]
    pub roster_memberships: Vec<String>,
    /// Dynamic battle state, present only while carried/active (spec 8.2).
    #[serde(default)]
    pub battle_state: Option<BattleState>,
    /// Learned moves + move source (spec §8.2). No fixed-size limit here —
    /// a rules-driven cap (data-driven, not a hardcoded array) is a T09a
    /// validation concern, not a persistence-shape one; see the T09a
    /// Worker Result for what's built vs. deferred. Each entry must carry
    /// a `"definition_version_id"` (string).
    #[serde(default)]
    pub moves: Vec<Value>,
    #[serde(default)]
    pub abilities: Vec<Value>,
    #[serde(default)]
    pub poke_edges: Vec<Value>,
    /// Permanent Capabilities (spec §8.2) — distinct from the species'
    /// baseline capabilities text; these are ones this specific instance
    /// gained (Poké Edge, GM grant, etc.).
    #[serde(default)]
    pub capabilities: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct CombatStages {
    #[serde(default)]
    pub attack: i64,
    #[serde(default)]
    pub defense: i64,
    #[serde(default)]
    pub special_attack: i64,
    #[serde(default)]
    pub special_defense: i64,
    #[serde(default)]
    pub speed: i64,
    #[serde(default)]
    pub accuracy: i64,
    #[serde(default)]
    pub evasion: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct BattleState {
    #[serde(default)]
    pub current_hp: i64,
    #[serde(default)]
    pub temporary_hp: i64,
    #[serde(default)]
    pub combat_stages: CombatStages,
    #[serde(default)]
    pub statuses: Vec<String>,
}

/// Trainer-level dynamic combat state (spec 13): HP/temp HP/AP tracks. The
/// same shape backs `combat_states` rows for both owner kinds; Pokémon use
/// [`BattleState`] instead since Trainer AP tracking doesn't apply to them.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct CombatState {
    #[serde(default)]
    pub current_hp: Option<i64>,
    #[serde(default)]
    pub temp_hp: Option<i64>,
    #[serde(default)]
    pub combat_stages: CombatStages,
    #[serde(default)]
    pub statuses: Vec<String>,
    #[serde(default)]
    pub ap_current: Option<i64>,
    #[serde(default)]
    pub ap_bound: Option<i64>,
    #[serde(default)]
    pub ap_drained: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ItemStack {
    pub item_id: String,
    pub quantity: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct InventoryRecord {
    #[serde(default)]
    pub backpack: Vec<ItemStack>,
    #[serde(default)]
    pub storage: Vec<ItemStack>,
    /// slot_key -> item_id.
    #[serde(default)]
    pub equipped: HashMap<String, String>,
}

/// Lightweight listing row: everything needed to show a Trainer in a
/// picker/list without hydrating Pokémon, rosters, inventory, grants,
/// history, or NPCs (spec 26: "only the active Trainer plus compact
/// summaries of archived Trainers are loaded").
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrainerSummary {
    pub id: String,
    pub name: String,
    pub level: i64,
    pub money: i64,
}
