//! Modifier engine + explainability (technical spec section 15).
//!
//! A resolved value is never the sole persisted truth (spec 15: "Persist
//! inputs/modifiers and compute the resolved value"). This module only
//! *computes* — from a base value plus a list of applicable modifiers — it
//! never writes anything. Callers (progression, resolved-move, GM grants)
//! own persisting the modifiers themselves; this always recomputes from
//! them, and every result carries a breakdown so the "why" is visible
//! (spec 15.1), not just the final number.

use serde::{Deserialize, Serialize};

/// Numeric operations a [`Modifier`] can apply. `TypeResistanceStep` and the
/// grant/remove kinds are recognized (so a stored modifier round-trips
/// faithfully) but have no generic numeric interpretation here — a
/// resistance-step adjustment feeds the type-effectiveness engine
/// ([`super::type_effectiveness`]) directly, and grant/remove act on
/// entities/capabilities/moves rather than a number, which belongs to
/// whatever engine owns that target (progression, inventory, ...).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Operation {
    Add,
    Multiply,
    Set,
    Min,
    Max,
    TypeResistanceStep,
    GrantEntity,
    RemoveEntity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Modifier {
    pub id: String,
    /// Human-readable provenance label, e.g. `"GM Permanent Grant"`,
    /// `"Skill Edge"`, `"Equipment"` (spec 15.1's breakdown examples).
    pub source_label: String,
    pub target: String,
    pub operation: Operation,
    pub value: f64,
    pub priority: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BreakdownEntry {
    pub label: String,
    pub operation: String,
    pub value: f64,
    pub resulting_value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ResolvedValue {
    pub base: f64,
    pub final_value: f64,
    pub breakdown: Vec<BreakdownEntry>,
}

/// Applies `modifiers` (already filtered to whatever's applicable — active
/// duration, satisfied condition, matching target) to `base`, in ascending
/// priority order, returning the final value and a full breakdown.
pub fn resolve_value(base: f64, modifiers: &[Modifier]) -> ResolvedValue {
    let mut ordered: Vec<&Modifier> = modifiers.iter().collect();
    ordered.sort_by_key(|m| m.priority);

    let mut running = base;
    let mut breakdown = Vec::with_capacity(ordered.len());

    for modifier in ordered {
        let next = match modifier.operation {
            Operation::Add => running + modifier.value,
            Operation::Multiply => running * modifier.value,
            Operation::Set => modifier.value,
            Operation::Min => running.min(modifier.value),
            Operation::Max => running.max(modifier.value),
            // Not a numeric adjustment to this value; leave it unchanged
            // here and let the owning engine interpret it separately.
            Operation::TypeResistanceStep | Operation::GrantEntity | Operation::RemoveEntity => running,
        };
        breakdown.push(BreakdownEntry {
            label: modifier.source_label.clone(),
            operation: operation_label(modifier.operation),
            value: modifier.value,
            resulting_value: next,
        });
        running = next;
    }

    ResolvedValue {
        base,
        final_value: running,
        breakdown,
    }
}

fn operation_label(op: Operation) -> String {
    match op {
        Operation::Add => "add".to_string(),
        Operation::Multiply => "multiply".to_string(),
        Operation::Set => "set".to_string(),
        Operation::Min => "min".to_string(),
        Operation::Max => "max".to_string(),
        Operation::TypeResistanceStep => "type_resistance_step".to_string(),
        Operation::GrantEntity => "grant_entity".to_string(),
        Operation::RemoveEntity => "remove_entity".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn modifier(source_label: &str, op: Operation, value: f64, priority: i64) -> Modifier {
        Modifier {
            id: source_label.to_string(),
            source_label: source_label.to_string(),
            target: "trainer.skill.stealth.check_bonus".to_string(),
            operation: op,
            value,
            priority,
        }
    }

    /// Matches `test_vectors/modifier_engine.json`'s "fixed-gm-stealth" vector.
    #[test]
    fn fixed_gm_grant_resolves_to_expected_value_with_breakdown() {
        let modifiers = vec![modifier("GM Permanent Grant", Operation::Add, 2.0, 500)];
        let resolved = resolve_value(0.0, &modifiers);
        assert_eq!(resolved.final_value, 2.0);
        assert_eq!(resolved.breakdown.len(), 1);
        assert_eq!(resolved.breakdown[0].label, "GM Permanent Grant");
        assert_eq!(resolved.breakdown[0].resulting_value, 2.0);
    }

    #[test]
    fn no_modifiers_returns_base_with_empty_breakdown() {
        let resolved = resolve_value(5.0, &[]);
        assert_eq!(resolved.final_value, 5.0);
        assert!(resolved.breakdown.is_empty());
    }

    #[test]
    fn modifiers_apply_in_ascending_priority_order() {
        let modifiers = vec![
            modifier("Set to 10", Operation::Set, 10.0, 100),
            modifier("Add 5", Operation::Add, 5.0, 200),
        ];
        // If Set ran after Add it would discard the +5; ascending priority
        // means Set (100) applies first, then Add (200) on top of it.
        let resolved = resolve_value(0.0, &modifiers);
        assert_eq!(resolved.final_value, 15.0);
    }
}
