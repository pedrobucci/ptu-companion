//! Resolved Move damage/STAB resolution (technical spec sections 14, 36).
//!
//! Deterministic display resolution only: base DB → STAB → damage-chart
//! expression → add Attack/Special Attack. The app never rolls dice and
//! never subtracts target Defense here — this produces the attacker's
//! pre-roll expression, matching spec 36 exactly.

use serde::Serialize;

use super::datasets::DamageChartRow;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DamageClass {
    Physical,
    Special,
}

/// STAB is a flat +2 Damage Base when the move's type is one of the
/// actor's types (spec 36 fixture: DB4 -> STAB -> DB6).
const STAB_DB_BONUS: i64 = 2;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ResolvedDamage {
    pub stab_applies: bool,
    pub base_db: i64,
    pub final_db: i64,
    /// e.g. `"2d6+23"` — dice expression with Attack/Special Attack folded
    /// into the flat bonus. No dice are rolled by this function.
    pub damage_expression: String,
}

#[derive(Debug, Clone, thiserror::Error)]
pub enum DamageResolutionError {
    #[error("no damage chart entry for damage base {0}")]
    NoDamageChartEntry(i64),
    #[error("damage chart entry for DB {db} has an unparseable dice expression \"{expression}\"")]
    UnparseableDiceExpression { db: i64, expression: String },
}

/// Resolves STAB and the final damage expression for one Move against one
/// actor. `attack_stat` is the actor's Attack (Physical) or Special Attack
/// (Special) value — the caller picks which per `damage_class`.
pub fn resolve_damage(
    move_db: i64,
    move_type: &str,
    actor_types: &[String],
    attack_stat: i64,
    damage_chart: &[DamageChartRow],
) -> Result<ResolvedDamage, DamageResolutionError> {
    let stab_applies = actor_types.iter().any(|t| t.eq_ignore_ascii_case(move_type));
    let final_db = if stab_applies { move_db + STAB_DB_BONUS } else { move_db };

    let chart_entry = damage_chart
        .iter()
        .find(|row| row.damage_base == final_db)
        .ok_or(DamageResolutionError::NoDamageChartEntry(final_db))?;

    let (count, sides, flat_bonus) = parse_dice_expression(&chart_entry.rolled_damage).ok_or_else(|| {
        DamageResolutionError::UnparseableDiceExpression {
            db: final_db,
            expression: chart_entry.rolled_damage.clone(),
        }
    })?;

    let damage_expression = format!("{count}d{sides}+{}", flat_bonus + attack_stat);

    Ok(ResolvedDamage {
        stab_applies,
        base_db: move_db,
        final_db,
        damage_expression,
    })
}

/// Parses `"XdY+Z"` into `(X, Y, Z)`.
fn parse_dice_expression(expr: &str) -> Option<(i64, i64, i64)> {
    let (dice, flat) = expr.split_once('+')?;
    let (count, sides) = dice.split_once('d')?;
    Some((count.parse().ok()?, sides.parse().ok()?, flat.parse().ok()?))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn core_damage_chart() -> Vec<DamageChartRow> {
        vec![
            DamageChartRow { damage_base: 4, rolled_damage: "1d8+6".to_string() },
            DamageChartRow { damage_base: 6, rolled_damage: "2d6+8".to_string() },
        ]
    }

    /// `test_vectors/rules_engine.json` "stab-db4-dark-atk15".
    #[test]
    fn stab_db4_dark_atk15_matches_fixture() {
        let resolved = resolve_damage(4, "Dark", &["Dark".to_string()], 15, &core_damage_chart()).unwrap();
        assert!(resolved.stab_applies);
        assert_eq!(resolved.final_db, 6);
        assert_eq!(resolved.damage_expression, "2d6+23");
    }

    /// `test_vectors/rules_engine.json` "no-stab-db4-atk15".
    #[test]
    fn no_stab_db4_atk15_matches_fixture() {
        let resolved = resolve_damage(4, "Fire", &["Dark".to_string()], 15, &core_damage_chart()).unwrap();
        assert!(!resolved.stab_applies);
        assert_eq!(resolved.final_db, 4);
        assert_eq!(resolved.damage_expression, "1d8+21");
    }

    #[test]
    fn missing_damage_chart_entry_is_reported_not_guessed() {
        let result = resolve_damage(99, "Fire", &["Fire".to_string()], 10, &core_damage_chart());
        assert!(matches!(result, Err(DamageResolutionError::NoDamageChartEntry(101))));
    }

    #[test]
    fn stab_is_case_insensitive_on_type_name() {
        let resolved = resolve_damage(4, "dark", &["Dark".to_string()], 15, &core_damage_chart()).unwrap();
        assert!(resolved.stab_applies);
    }
}
