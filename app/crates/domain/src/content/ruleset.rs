//! Campaign Ruleset (technical spec section 6): selects, prioritizes, and
//! optionally pins content pack definitions. Purely a value loaded from
//! JSON for now — persisting GM-authored rulesets is a later task's
//! concern; the resolver only needs the shape, not where it came from.

use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::schemas::validate_ruleset;
use crate::error::RulesetError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RulesetPackRef {
    pub id: String,
    pub enabled: bool,
    pub priority: i64,
}

/// `version_pins` keys use the same `"<kind_slug>:<logical_id>"` form as
/// [`super::parse_definition_ref`] (e.g. `"ability:abominable"`), mapping to
/// the pinned `definition_version_id`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CampaignRuleset {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub description: Option<String>,
    pub packs: Vec<RulesetPackRef>,
    #[serde(default)]
    pub version_pins: HashMap<String, String>,
    #[serde(default)]
    pub gm_overrides_enabled: bool,
}

impl CampaignRuleset {
    pub fn from_json_str(text: &str) -> Result<Self, RulesetError> {
        let value: Value =
            serde_json::from_str(text).map_err(|e| RulesetError::NotJson(e.to_string()))?;
        validate_ruleset(&value).map_err(RulesetError::Schema)?;
        serde_json::from_value(value).map_err(|e| RulesetError::NotJson(e.to_string()))
    }

    pub fn from_file(path: &Path) -> Result<Self, RulesetError> {
        let text = std::fs::read_to_string(path)?;
        Self::from_json_str(&text)
    }
}

/// T13E02: the closed list of `rulesets/*.json` files this app offers as a
/// selectable preset (E01 §1: "E02 supplies an explicit persisted preset
/// ptu-core-with-pokedex... Preserve Core-only as a selectable preset").
/// `ptu-core-only` stays first/default — "Existing settings file absent
/// uses prior Core-only until explicit selection" (E01-C1 endpoint 2).
pub const PRESET_IDS: [&str; 5] = [
    "ptu-core-only",
    "ptu-core-with-pokedex",
    "ptu-official-supplements",
    "ptu-official-with-playtests",
    "all-provided-material",
];

pub const DEFAULT_PRESET_ID: &str = "ptu-core-only";

/// One entry of `get_content_context`'s `presets` field (E01-C1 endpoint 1).
#[derive(Debug, Clone, Serialize)]
pub struct PresetInfo {
    pub id: String,
    pub name: String,
    pub pack_ids: Vec<String>,
    pub description: Option<String>,
}

fn ruleset_file_path(rulesets_dir: &Path, preset_id: &str) -> std::path::PathBuf {
    rulesets_dir.join(format!("{preset_id}.json"))
}

/// Loads one preset by id, rejecting anything outside [`PRESET_IDS`] before
/// ever touching the filesystem — never lets a caller-supplied string
/// become an arbitrary file read.
pub fn load_preset(rulesets_dir: &Path, preset_id: &str) -> Result<Option<CampaignRuleset>, RulesetError> {
    if !PRESET_IDS.contains(&preset_id) {
        return Ok(None);
    }
    let path = ruleset_file_path(rulesets_dir, preset_id);
    if !path.is_file() {
        return Ok(None);
    }
    CampaignRuleset::from_file(&path).map(Some)
}

/// Lists every known preset's summary info, skipping (never erroring on) a
/// preset file that happens to be absent from this install — used by
/// `get_content_context`, which must never fail just because one bundled
/// ruleset file is missing.
pub fn list_presets(rulesets_dir: &Path) -> Vec<PresetInfo> {
    PRESET_IDS
        .iter()
        .filter_map(|id| load_preset(rulesets_dir, id).ok().flatten())
        .map(|rs| PresetInfo {
            id: rs.id.clone(),
            name: rs.name.clone(),
            pack_ids: rs.packs.iter().map(|p| p.id.clone()).collect(),
            description: rs.description.clone(),
        })
        .collect()
}

const ACTIVE_PRESET_SELECTION_FILE: &str = "active_ruleset.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ActivePresetSelection {
    preset_id: String,
}

/// Reads the persisted active-preset selection from `app_data_dir`, if any.
/// A missing file, unreadable file, or a `preset_id` outside [`PRESET_IDS`]
/// all return `None` (never an error) — the caller falls back to
/// [`DEFAULT_PRESET_ID`], matching "Existing settings file absent uses
/// prior Core-only until explicit selection."
pub fn load_active_preset_selection(app_data_dir: &Path) -> Option<String> {
    let path = app_data_dir.join(ACTIVE_PRESET_SELECTION_FILE);
    let text = std::fs::read_to_string(path).ok()?;
    let selection: ActivePresetSelection = serde_json::from_str(&text).ok()?;
    if PRESET_IDS.contains(&selection.preset_id.as_str()) {
        Some(selection.preset_id)
    } else {
        None
    }
}

/// Atomically persists the active-preset selection: write to a sibling
/// temp file, then rename over the real one. A crash mid-write leaves
/// either the old file or the new one intact, never a half-written file
/// that would silently fail to parse on next load (E01-C1: "Persist
/// atomically before swapping memory").
pub fn save_active_preset_selection(app_data_dir: &Path, preset_id: &str) -> std::io::Result<()> {
    let path = app_data_dir.join(ACTIVE_PRESET_SELECTION_FILE);
    let tmp_path = app_data_dir.join(format!("{ACTIVE_PRESET_SELECTION_FILE}.tmp-{}", uuid::Uuid::new_v4()));
    let body = serde_json::to_string(&ActivePresetSelection { preset_id: preset_id.to_string() })
        .unwrap_or_else(|_| "{}".to_string());
    std::fs::write(&tmp_path, body)?;
    std::fs::rename(&tmp_path, &path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_ruleset() {
        let ruleset = CampaignRuleset::from_json_str(
            r#"{
                "id": "x", "name": "X", "version": "1.0.0",
                "packs": [{"id": "core", "enabled": true, "priority": 100}],
                "version_pins": {"ability:foo": "abilities:foo@core"}
            }"#,
        )
        .unwrap();
        assert_eq!(ruleset.packs.len(), 1);
        assert_eq!(
            ruleset.version_pins.get("ability:foo").map(String::as_str),
            Some("abilities:foo@core")
        );
    }

    #[test]
    fn rejects_ruleset_missing_required_fields() {
        let result = CampaignRuleset::from_json_str(r#"{"id": "x"}"#);
        assert!(result.is_err());
    }
}
