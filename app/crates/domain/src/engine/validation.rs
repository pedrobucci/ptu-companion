//! Structured validation (technical spec section 25). Validation returns
//! issues rather than throwing for ordinary user mistakes; `override_allowed`
//! tells the UI whether a GM Override can push through anyway (spec 16/25).

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::datasets::PokemonProgressionRules;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ValidationIssue {
    pub severity: Severity,
    pub code: String,
    pub message: String,
    pub override_allowed: bool,
}

/// Level-bounds check against the active ruleset's `pokemon_progression_rules`.
pub fn validate_pokemon_level(level: i64, rules: &PokemonProgressionRules) -> Vec<ValidationIssue> {
    let mut issues = Vec::new();
    if level < 1 {
        issues.push(ValidationIssue {
            severity: Severity::Error,
            code: "POKEMON_LEVEL_BELOW_MINIMUM".to_string(),
            message: format!("Level {level} is below the minimum of 1."),
            override_allowed: false,
        });
    } else if level > rules.max_level {
        issues.push(ValidationIssue {
            severity: Severity::Error,
            code: "POKEMON_LEVEL_ABOVE_MAXIMUM".to_string(),
            message: format!("Level {level} exceeds the ruleset maximum of {}.", rules.max_level),
            override_allowed: true,
        });
    }
    issues
}

/// GM Override provenance (spec 16/25): "A successful override creates
/// persistent provenance/history." Builds a `timeline`-shaped event ready
/// to append to a `TrainerProfile` (or a Pokémon-scoped equivalent) so the
/// override is never silent. Only callable when `issue.override_allowed`.
pub fn build_override_history_event(issue: &ValidationIssue, gm_note: Option<&str>) -> Option<Value> {
    if !issue.override_allowed {
        return None;
    }
    Some(json!({
        "kind": "gm_override",
        "code": issue.code,
        "message": issue.message,
        "note": gm_note,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rules() -> PokemonProgressionRules {
        PokemonProgressionRules {
            max_level: 100,
            stat_points_per_level_up: 1,
            ability_unlock_levels: vec![],
            tutor_point_levels_rule: None,
            check_pokedex_for_moves_and_evolution_each_level_up: true,
        }
    }

    #[test]
    fn in_range_level_has_no_issues() {
        assert!(validate_pokemon_level(50, &rules()).is_empty());
    }

    #[test]
    fn zero_level_is_a_non_overridable_error() {
        let issues = validate_pokemon_level(0, &rules());
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].severity, Severity::Error);
        assert!(!issues[0].override_allowed);
    }

    #[test]
    fn above_maximum_is_an_overridable_error() {
        let issues = validate_pokemon_level(101, &rules());
        assert_eq!(issues.len(), 1);
        assert!(issues[0].override_allowed);
    }

    #[test]
    fn override_builds_a_history_event_only_when_allowed() {
        let issues = validate_pokemon_level(101, &rules());
        let event = build_override_history_event(&issues[0], Some("GM approved")).unwrap();
        assert_eq!(event["kind"], "gm_override");
        assert_eq!(event["code"], "POKEMON_LEVEL_ABOVE_MAXIMUM");

        let non_overridable = validate_pokemon_level(0, &rules());
        assert!(build_override_history_event(&non_overridable[0], None).is_none());
    }
}
