//! Thin loaders that turn a `content_datasets` row (raw JSON persisted by
//! T02's importer, keyed by `(content_pack_id, dataset_name)`) into the
//! typed shape an engine function needs. The engine functions themselves
//! stay pure and take these typed values directly, so they're unit-testable
//! without a database at all — these loaders are the only part of this
//! module that touches SQL.

use rusqlite::Connection;
use serde::Deserialize;

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
