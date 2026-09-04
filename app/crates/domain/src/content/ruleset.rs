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
