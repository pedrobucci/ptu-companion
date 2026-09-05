//! Thin loaders that turn a `content_datasets` row (raw JSON persisted by
//! T02's importer, keyed by `(content_pack_id, dataset_name)`) into the
//! typed shape an engine function needs. The engine functions themselves
//! stay pure and take these typed values directly, so they're unit-testable
//! without a database at all — these loaders are the only part of this
//! module that touches SQL.

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::error::EngineError;

fn load_dataset(conn: &Connection, content_pack_id: &str, dataset_name: &str) -> Result<String, EngineError> {
    conn.query_row(
        "SELECT data_json FROM content_datasets WHERE content_pack_id = ?1 AND dataset_name = ?2",
        rusqlite::params![content_pack_id, dataset_name],
        |row| row.get(0),
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => EngineError::DatasetNotFound {
            content_pack_id: content_pack_id.to_string(),
            dataset_name: dataset_name.to_string(),
        },
        other => EngineError::Sqlite(other),
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct DamageChartRow {
    pub damage_base: i64,
    pub rolled_damage: String,
}

pub fn load_damage_chart(conn: &Connection, content_pack_id: &str) -> Result<Vec<DamageChartRow>, EngineError> {
    let text = load_dataset(conn, content_pack_id, "damage_chart")?;
    serde_json::from_str(&text).map_err(EngineError::from)
}

#[derive(Debug, Clone, Deserialize)]
pub struct TypeMatchupRow {
    pub attack_type: String,
    pub defense_type: String,
    pub relation: String,
}

pub fn load_type_matchups(conn: &Connection, content_pack_id: &str) -> Result<Vec<TypeMatchupRow>, EngineError> {
    let text = load_dataset(conn, content_pack_id, "type_matchups")?;
    serde_json::from_str(&text).map_err(EngineError::from)
}

#[derive(Debug, Clone, Deserialize)]
pub struct TypeEffectivenessScaleRow {
    pub net_steps: i64,
    pub combat_multiplier: f64,
}

pub fn load_type_effectiveness_scale(
    conn: &Connection,
    content_pack_id: &str,
) -> Result<Vec<TypeEffectivenessScaleRow>, EngineError> {
    let text = load_dataset(conn, content_pack_id, "type_effectiveness_scale")?;
    serde_json::from_str(&text).map_err(EngineError::from)
}

#[derive(Debug, Clone, Deserialize)]
pub struct PokemonProgressionRules {
    pub max_level: i64,
    pub stat_points_per_level_up: i64,
    #[serde(default)]
    pub ability_unlock_levels: Vec<i64>,
    #[serde(default)]
    pub tutor_point_levels_rule: Option<String>,
    #[serde(default)]
    pub check_pokedex_for_moves_and_evolution_each_level_up: bool,
}

pub fn load_pokemon_progression_rules(
    conn: &Connection,
    content_pack_id: &str,
) -> Result<PokemonProgressionRules, EngineError> {
    let text = load_dataset(conn, content_pack_id, "pokemon_progression_rules")?;
    serde_json::from_str(&text).map_err(EngineError::from)
}

#[derive(Debug, Clone, Deserialize)]
pub struct TrainerProgressionRow {
    pub level: i64,
    pub stat_points_at_level: i64,
    pub features_at_level: i64,
    #[serde(default)]
    pub edges_at_level: i64,
}

pub fn load_trainer_progression(
    conn: &Connection,
    content_pack_id: &str,
) -> Result<Vec<TrainerProgressionRow>, EngineError> {
    let text = load_dataset(conn, content_pack_id, "trainer_progression")?;
    serde_json::from_str(&text).map_err(EngineError::from)
}

#[derive(Debug, Clone, Deserialize)]
pub struct TrainerMilestoneRow {
    pub level: i64,
    pub name: String,
    #[serde(default)]
    pub choice_options: Vec<String>,
}

pub fn load_trainer_milestones(
    conn: &Connection,
    content_pack_id: &str,
) -> Result<Vec<TrainerMilestoneRow>, EngineError> {
    let text = load_dataset(conn, content_pack_id, "trainer_milestones")?;
    serde_json::from_str(&text).map_err(EngineError::from)
}

// =======================================================================
// T13D1: `trainer_build_rules` dataset — source-backed facts for guided
// level-1 creation/advancement (Core p13-20, 33-34, 52, 56, 60), packaged
// narrowly into `content_packs/ptu-core-1.05.ptucp` by
// `scripts/pack_trainer_build_rules.py`. This module only loads/types the
// data; rule evaluation is T13D3/T13D4 (see `engine::trainer_build`).
// =======================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillCatalogEntry {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillGroups {
    pub body: Vec<SkillCatalogEntry>,
    pub mind: Vec<SkillCatalogEntry>,
    pub spirit: Vec<SkillCatalogEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillsSection {
    pub source_page: i64,
    pub count: i64,
    pub groups: SkillGroups,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoreRankRow {
    pub name: String,
    pub ordinal: i64,
    pub dice: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrdinaryRankCapsByLevel {
    pub novice_available_at_level: i64,
    pub adept_available_at_level: i64,
    pub expert_available_at_level: i64,
    pub master_available_at_level: i64,
    pub background_adept_is_level_1_exception: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RankTableSection {
    pub ranks: Vec<CoreRankRow>,
    pub ordinary_rank_caps_by_level: OrdinaryRankCapsByLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundRuleSection {
    pub adept_skill_count: i64,
    pub novice_skill_count: i64,
    pub pathetic_skill_count: i64,
    pub remaining_skills_rank: String,
    pub distinct_skills_required: bool,
    pub pathetic_skills_locked_during_creation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillEdgeCatalogEntry {
    pub id: String,
    pub name: String,
    pub definition_version_id: String,
    pub policy: String,
    #[serde(default)]
    pub repeatable: bool,
    #[serde(default)]
    pub repeat_rule: Option<String>,
    #[serde(default)]
    pub requires_level: Option<i64>,
    #[serde(default)]
    pub requires_preceding_rank: Option<String>,
    #[serde(default)]
    pub requires_rank: Option<String>,
    #[serde(default)]
    pub target_rank: Option<String>,
    #[serde(default)]
    pub check_bonus: Option<i64>,
    #[serde(default)]
    pub categories: Vec<String>,
    #[serde(default)]
    pub minimum_rank: Option<String>,
    #[serde(default)]
    pub conditional_bonus: Option<String>,
    #[serde(default)]
    pub effective_rank_for_effects: Option<i64>,
    #[serde(default)]
    pub grants_extra_dice: Option<bool>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillEdgesSection {
    pub source_page: i64,
    pub entries: Vec<SkillEdgeCatalogEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementalConnectionMode {
    pub label: String,
    pub allow_repeat: bool,
    #[serde(default)]
    pub repeat_rule: Option<String>,
    #[serde(default)]
    pub requires_explicit_opt_in: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementalConnectionModes {
    pub core: ElementalConnectionMode,
    pub campaign_variant_distinct_type: ElementalConnectionMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementalConnectionSection {
    pub definition_version_id: String,
    pub conflicts_with_definition_version_id: String,
    pub check_bonus: i64,
    pub checks: Vec<String>,
    pub modes: ElementalConnectionModes,
    pub mutual_exclusion_applies_in_all_modes: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingFeatureOption {
    pub id: String,
    pub name: String,
    pub definition_version_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingFeaturesSection {
    pub options: Vec<TrainingFeatureOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreationBudgetSection {
    pub steps: Vec<String>,
    pub paid_edges: i64,
    pub paid_features: i64,
    pub free_training_features: i64,
    pub free_training_feature_skips_prerequisites: bool,
    pub normal_selections_check_prerequisites: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OffensiveStatStream {
    pub milestone_level: i64,
    pub milestone_name: String,
    #[serde(default)]
    pub stat_choice: serde_json::Value,
    #[serde(default)]
    pub retroactive_bonus_levels: Vec<i64>,
    #[serde(default)]
    pub retroactive_bonus_points_each: Option<i64>,
    pub ongoing_bonus_levels: Vec<i64>,
    pub ongoing_bonus_points_each: i64,
    #[serde(default)]
    pub alternative_options: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OffensiveStatStreamsSection {
    pub milestone_levels: Vec<i64>,
    pub streams: Vec<OffensiveStatStream>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainerBuildRules {
    pub skills: SkillsSection,
    pub rank_table: RankTableSection,
    pub background: BackgroundRuleSection,
    pub skill_edges: SkillEdgesSection,
    pub elemental_connection: ElementalConnectionSection,
    pub training_features: TrainingFeaturesSection,
    pub creation_budget: CreationBudgetSection,
    pub offensive_stat_streams: OffensiveStatStreamsSection,
}

pub fn load_trainer_build_rules(conn: &Connection, content_pack_id: &str) -> Result<TrainerBuildRules, EngineError> {
    let text = load_dataset(conn, content_pack_id, "trainer_build_rules")?;
    serde_json::from_str(&text).map_err(EngineError::from)
}
