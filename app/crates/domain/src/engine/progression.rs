//! Trainer/Pokémon progression resolution (technical spec section 17).
//! Reads only from the imported `pokemon_progression_rules`/
//! `trainer_progression`/`trainer_milestones` datasets — nothing here is a
//! hardcoded PTU number, so a different ruleset's packs drive different
//! results without a code change.
//!
//! Base Stat Relation (spec 17.2) validation is intentionally **not**
//! implemented here: no supplied dataset in this handoff encodes the BSR
//! formula/thresholds (checked against `seed/json/*`, `KNOWN_GAPS_v1.0.md`),
//! and inventing one would mean guessing at un-sourced rules text, which
//! the project's own data-quality policy (spec 28, `README_FIRST.md`)
//! explicitly rules out. This is a disclosed gap, not a silent omission —
//! see the T05 Worker Result.

use serde::Serialize;

use super::datasets::{PokemonProgressionRules, TrainerMilestoneRow, TrainerProgressionRow};

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PokemonLevelUpResult {
    pub stat_points_awarded: i64,
    pub tutor_point_awarded: bool,
    pub ability_unlock: bool,
    pub check_moves_and_evolution: bool,
}

/// `rule_text` is `pokemon_progression_rules.tutor_point_levels_rule`, e.g.
/// `"Level 5 and every level evenly divisible by 5 thereafter"`.
///
/// ponytail: parses the common "divisible by N" phrasing rather than a
/// structured frequency field, since that's the only form present in the
/// supplied data; upgrade to a structured field if a future ruleset's rule
/// text doesn't match this pattern (this returns `None`, not a guess, when
/// it doesn't).
fn tutor_point_awarded_at(level: i64, rule_text: Option<&str>) -> Option<bool> {
    let text = rule_text?;
    let idx = text.to_ascii_lowercase().find("divisible by ")?;
    let after = &text[idx + "divisible by ".len()..];
    let digits: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
    let divisor: i64 = digits.parse().ok()?;
    if divisor == 0 {
        return None;
    }
    Some(level % divisor == 0)
}

pub fn resolve_pokemon_level_up(level: i64, rules: &PokemonProgressionRules) -> PokemonLevelUpResult {
    PokemonLevelUpResult {
        stat_points_awarded: rules.stat_points_per_level_up,
        tutor_point_awarded: tutor_point_awarded_at(level, rules.tutor_point_levels_rule.as_deref())
            .unwrap_or(false),
        ability_unlock: rules.ability_unlock_levels.contains(&level),
        check_moves_and_evolution: rules.check_pokedex_for_moves_and_evolution_each_level_up,
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct TrainerLevelUpResult {
    pub baseline_stat_point: i64,
    pub baseline_feature: i64,
    pub baseline_edge: i64,
    pub milestone_choice_required: bool,
}

pub fn resolve_trainer_level_up(
    level: i64,
    progression: &[TrainerProgressionRow],
    milestones: &[TrainerMilestoneRow],
) -> Option<TrainerLevelUpResult> {
    let row = progression.iter().find(|r| r.level == level)?;
    let milestone_choice_required = milestones
        .iter()
        .any(|m| m.level == level && !m.choice_options.is_empty());

    Some(TrainerLevelUpResult {
        baseline_stat_point: row.stat_points_at_level,
        baseline_feature: row.features_at_level,
        baseline_edge: row.edges_at_level,
        milestone_choice_required,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pokemon_rules() -> PokemonProgressionRules {
        PokemonProgressionRules {
            max_level: 100,
            stat_points_per_level_up: 1,
            ability_unlock_levels: vec![20, 40],
            tutor_point_levels_rule: Some("Level 5 and every level evenly divisible by 5 thereafter".to_string()),
            check_pokedex_for_moves_and_evolution_each_level_up: true,
        }
    }

    /// `test_vectors/progression_engine.json` "pokemon-level-5".
    #[test]
    fn pokemon_level_5_matches_fixture() {
        let result = resolve_pokemon_level_up(5, &pokemon_rules());
        assert_eq!(
            result,
            PokemonLevelUpResult {
                stat_points_awarded: 1,
                tutor_point_awarded: true,
                ability_unlock: false,
                check_moves_and_evolution: true,
            }
        );
    }

    /// `test_vectors/progression_engine.json` "pokemon-level-20".
    #[test]
    fn pokemon_level_20_matches_fixture() {
        let result = resolve_pokemon_level_up(20, &pokemon_rules());
        assert_eq!(
            result,
            PokemonLevelUpResult {
                stat_points_awarded: 1,
                tutor_point_awarded: true,
                ability_unlock: true,
                check_moves_and_evolution: true,
            }
        );
    }

    #[test]
    fn pokemon_level_not_divisible_by_5_gets_no_tutor_point() {
        let result = resolve_pokemon_level_up(7, &pokemon_rules());
        assert!(!result.tutor_point_awarded);
    }

    /// `test_vectors/progression_engine.json` "trainer-level-5-milestone".
    #[test]
    fn trainer_level_5_matches_fixture() {
        let progression = vec![TrainerProgressionRow {
            level: 5,
            stat_points_at_level: 1,
            features_at_level: 1,
            edges_at_level: 0,
        }];
        let milestones = vec![TrainerMilestoneRow {
            level: 5,
            name: "Amateur Trainer".to_string(),
            choice_options: vec!["opt a".to_string(), "opt b".to_string()],
        }];
        let result = resolve_trainer_level_up(5, &progression, &milestones).unwrap();
        assert_eq!(result.baseline_stat_point, 1);
        assert_eq!(result.baseline_feature, 1);
        assert!(result.milestone_choice_required);
    }

    #[test]
    fn milestone_without_choice_options_does_not_require_a_choice() {
        let progression = vec![TrainerProgressionRow {
            level: 2,
            stat_points_at_level: 0,
            features_at_level: 0,
            edges_at_level: 0,
        }];
        let milestones = vec![TrainerMilestoneRow {
            level: 2,
            name: "Adept Skills".to_string(),
            choice_options: vec![],
        }];
        let result = resolve_trainer_level_up(2, &progression, &milestones).unwrap();
        assert!(!result.milestone_choice_required);
    }

    #[test]
    fn unknown_level_returns_none_instead_of_guessing() {
        assert!(resolve_trainer_level_up(9999, &[], &[]).is_none());
    }
}
