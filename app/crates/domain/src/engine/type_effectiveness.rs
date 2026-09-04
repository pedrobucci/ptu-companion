//! Type effectiveness (technical spec section 24): derived from the
//! versioned type chart datasets, never baked into UI code. A defending
//! Pokémon's 1-2 types each contribute a relation (weak/resistant/neutral/
//! immune) against the attacking type; the net step count (weak count minus
//! resistant count) maps to a combat multiplier via the effectiveness
//! scale. Any immunity makes the attack a flat 0, regardless of steps.

use serde::Serialize;

use super::datasets::{TypeEffectivenessScaleRow, TypeMatchupRow};

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct TypeEffectivenessResult {
    pub weak_count: i32,
    pub resistant_count: i32,
    pub immune: bool,
    pub net_steps: i32,
    pub multiplier: f64,
}

/// Looks up `multiplier` for an already-known `(weak_count, resistant_count,
/// immune)` triple — the direct shape `test_vectors/rules_engine.json`'s
/// type-effectiveness vectors exercise.
pub fn multiplier_for_steps(
    weak_count: i32,
    resistant_count: i32,
    immune: bool,
    scale: &[TypeEffectivenessScaleRow],
) -> Option<f64> {
    if immune {
        return Some(0.0);
    }
    let net_steps = (weak_count - resistant_count) as i64;
    scale
        .iter()
        .find(|row| row.net_steps == net_steps)
        .map(|row| row.combat_multiplier)
}

/// Full resolution from an attacking type against a defender's types (1 or
/// 2), using the raw `type_matchups` relation table.
pub fn resolve_type_effectiveness(
    attack_type: &str,
    defender_types: &[String],
    matchups: &[TypeMatchupRow],
    scale: &[TypeEffectivenessScaleRow],
) -> Option<TypeEffectivenessResult> {
    let mut weak_count = 0;
    let mut resistant_count = 0;
    let mut immune = false;

    for defense_type in defender_types {
        let relation = matchups
            .iter()
            .find(|m| m.attack_type.eq_ignore_ascii_case(attack_type) && m.defense_type.eq_ignore_ascii_case(defense_type))
            .map(|m| m.relation.as_str())?;
        match relation {
            "weak" => weak_count += 1,
            "resistant" => resistant_count += 1,
            "immune" => immune = true,
            _ => {}
        }
    }

    let multiplier = multiplier_for_steps(weak_count, resistant_count, immune, scale)?;
    let net_steps = weak_count - resistant_count;

    Some(TypeEffectivenessResult {
        weak_count,
        resistant_count,
        immune,
        net_steps,
        multiplier,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scale() -> Vec<TypeEffectivenessScaleRow> {
        vec![
            TypeEffectivenessScaleRow { net_steps: 3, combat_multiplier: 3.0 },
            TypeEffectivenessScaleRow { net_steps: 2, combat_multiplier: 2.0 },
            TypeEffectivenessScaleRow { net_steps: 1, combat_multiplier: 1.5 },
            TypeEffectivenessScaleRow { net_steps: 0, combat_multiplier: 1.0 },
            TypeEffectivenessScaleRow { net_steps: -1, combat_multiplier: 0.5 },
            TypeEffectivenessScaleRow { net_steps: -2, combat_multiplier: 0.25 },
            TypeEffectivenessScaleRow { net_steps: -3, combat_multiplier: 0.125 },
        ]
    }

    /// `test_vectors/rules_engine.json` "single-weakness-step".
    #[test]
    fn single_weakness_step_matches_fixture() {
        let multiplier = multiplier_for_steps(1, 0, false, &scale()).unwrap();
        assert_eq!(multiplier, 1.5);
    }

    /// `test_vectors/rules_engine.json` "double-resistance-step".
    #[test]
    fn double_resistance_step_matches_fixture() {
        let multiplier = multiplier_for_steps(0, 2, false, &scale()).unwrap();
        assert_eq!(multiplier, 0.25);
    }

    #[test]
    fn immunity_overrides_steps() {
        let multiplier = multiplier_for_steps(3, 0, true, &scale()).unwrap();
        assert_eq!(multiplier, 0.0);
    }

    #[test]
    fn full_resolution_against_two_defender_types() {
        let matchups = vec![
            TypeMatchupRow { attack_type: "Fire".into(), defense_type: "Grass".into(), relation: "weak".into() },
            TypeMatchupRow { attack_type: "Fire".into(), defense_type: "Bug".into(), relation: "weak".into() },
        ];
        let result = resolve_type_effectiveness("Fire", &["Grass".into(), "Bug".into()], &matchups, &scale()).unwrap();
        assert_eq!(result.weak_count, 2);
        assert_eq!(result.net_steps, 2);
        assert_eq!(result.multiplier, 2.0);
    }

    #[test]
    fn unknown_type_pair_returns_none_instead_of_guessing() {
        let result = resolve_type_effectiveness("Fire", &["Mystery".into()], &[], &scale());
        assert!(result.is_none());
    }
}
