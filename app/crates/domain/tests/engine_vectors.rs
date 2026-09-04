//! Verifies the engine directly against the real handoff test vector files
//! (not hand-copied values), per spec 33: "The final bundle contains
//! deterministic test vectors. Those vectors are acceptance contracts for
//! the rules layer."

use std::path::{Path, PathBuf};

use serde_json::Value;

use ptu_domain::engine::datasets::{DamageChartRow, TypeEffectivenessScaleRow};
use ptu_domain::engine::progression::{resolve_pokemon_level_up, resolve_trainer_level_up};
use ptu_domain::engine::resolved_move::resolve_damage;
use ptu_domain::engine::respec::reallocate_resource_grant;
use ptu_domain::engine::type_effectiveness::multiplier_for_steps;

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..")
}

fn load_vectors(name: &str) -> Vec<Value> {
    let path = repo_root().join("test_vectors").join(name);
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("reading {path:?}: {e}"));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("parsing {path:?}: {e}"))
}

fn core_damage_chart() -> Vec<DamageChartRow> {
    // Only the rows the rules_engine.json vectors actually need.
    vec![
        DamageChartRow { damage_base: 4, rolled_damage: "1d8+6".to_string() },
        DamageChartRow { damage_base: 6, rolled_damage: "2d6+8".to_string() },
    ]
}

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

#[test]
fn rules_engine_vectors_pass() {
    let vectors = load_vectors("rules_engine.json");
    assert!(!vectors.is_empty());

    for v in &vectors {
        let id = v["id"].as_str().unwrap();
        let input = &v["input"];
        let expected = &v["expected"];

        if input.get("move_db").is_some() {
            let move_db = input["move_db"].as_i64().unwrap();
            let move_type = input["move_type"].as_str().unwrap();
            let actor_types: Vec<String> = input["actor_types"]
                .as_array()
                .unwrap()
                .iter()
                .map(|t| t.as_str().unwrap().to_string())
                .collect();
            let attack_stat = input["attack_stat"].as_i64().unwrap();

            let resolved = resolve_damage(move_db, move_type, &actor_types, attack_stat, &core_damage_chart())
                .unwrap_or_else(|e| panic!("vector {id}: {e}"));

            assert_eq!(resolved.stab_applies, expected["stab_applies"].as_bool().unwrap(), "vector {id}");
            assert_eq!(resolved.final_db, expected["final_db"].as_i64().unwrap(), "vector {id}");
            assert_eq!(resolved.damage_expression, expected["damage_expression"].as_str().unwrap(), "vector {id}");
        } else if input.get("weak_count").is_some() {
            let weak_count = input["weak_count"].as_i64().unwrap() as i32;
            let resistant_count = input["resistant_count"].as_i64().unwrap() as i32;
            let immune = input["immune"].as_bool().unwrap();

            let multiplier = multiplier_for_steps(weak_count, resistant_count, immune, &scale())
                .unwrap_or_else(|| panic!("vector {id}: no multiplier for given steps"));

            assert_eq!(multiplier, expected["multiplier"].as_f64().unwrap(), "vector {id}");
        } else {
            panic!("vector {id}: unrecognized rules_engine.json vector shape");
        }
    }
}

#[test]
fn progression_engine_vectors_pass() {
    let vectors = load_vectors("progression_engine.json");
    assert!(!vectors.is_empty());

    let pokemon_rules = ptu_domain::engine::datasets::PokemonProgressionRules {
        max_level: 100,
        stat_points_per_level_up: 1,
        ability_unlock_levels: vec![20, 40],
        tutor_point_levels_rule: Some("Level 5 and every level evenly divisible by 5 thereafter".to_string()),
        check_pokedex_for_moves_and_evolution_each_level_up: true,
    };
    let trainer_progression = vec![ptu_domain::engine::datasets::TrainerProgressionRow {
        level: 5,
        stat_points_at_level: 1,
        features_at_level: 1,
        edges_at_level: 0,
    }];
    let trainer_milestones = vec![ptu_domain::engine::datasets::TrainerMilestoneRow {
        level: 5,
        name: "Amateur Trainer".to_string(),
        choice_options: vec!["a".to_string(), "b".to_string()],
    }];

    for v in &vectors {
        let id = v["id"].as_str().unwrap();
        let level = v["input"]["level"].as_i64().unwrap();
        let expected = &v["expected"];

        if expected.get("stat_points_awarded").is_some() {
            let result = resolve_pokemon_level_up(level, &pokemon_rules);
            assert_eq!(result.stat_points_awarded, expected["stat_points_awarded"].as_i64().unwrap(), "vector {id}");
            assert_eq!(result.tutor_point_awarded, expected["tutor_point_awarded"].as_bool().unwrap(), "vector {id}");
            assert_eq!(result.ability_unlock, expected["ability_unlock"].as_bool().unwrap(), "vector {id}");
            assert_eq!(result.check_moves_and_evolution, expected["check_moves_and_evolution"].as_bool().unwrap(), "vector {id}");
        } else if expected.get("baseline_stat_point").is_some() {
            let result = resolve_trainer_level_up(level, &trainer_progression, &trainer_milestones)
                .unwrap_or_else(|| panic!("vector {id}: no trainer progression row for level {level}"));
            assert_eq!(result.baseline_stat_point, expected["baseline_stat_point"].as_i64().unwrap(), "vector {id}");
            assert_eq!(result.baseline_feature, expected["baseline_feature"].as_i64().unwrap(), "vector {id}");
            assert_eq!(result.milestone_choice_required, expected["milestone_choice_required"].as_bool().unwrap(), "vector {id}");
        } else {
            panic!("vector {id}: unrecognized progression_engine.json vector shape");
        }
    }
}

#[test]
fn modifier_engine_vectors_pass() {
    let vectors = load_vectors("modifier_engine.json");
    assert!(!vectors.is_empty());

    for v in &vectors {
        let id = v["id"].as_str().unwrap();

        if let Some(modifiers) = v.get("modifiers").and_then(Value::as_array) {
            let base = v["base"].as_object().unwrap().values().next().unwrap().as_f64().unwrap();
            let target = v["base"].as_object().unwrap().keys().next().unwrap().clone();

            let mods: Vec<ptu_domain::engine::modifier::Modifier> = modifiers
                .iter()
                .map(|m| ptu_domain::engine::modifier::Modifier {
                    id: id.to_string(),
                    source_label: m["source"].as_str().unwrap().to_string(),
                    target: m["target"].as_str().unwrap().to_string(),
                    operation: match m["operation"].as_str().unwrap() {
                        "add" => ptu_domain::engine::modifier::Operation::Add,
                        other => panic!("vector {id}: unhandled operation {other}"),
                    },
                    value: m["value"].as_f64().unwrap(),
                    priority: 0,
                })
                .collect();

            let resolved = ptu_domain::engine::modifier::resolve_value(base, &mods);
            let expected_value = v["expected"][&target].as_f64().unwrap();
            assert_eq!(resolved.final_value, expected_value, "vector {id}");
            assert!(!resolved.breakdown.is_empty(), "vector {id}: expected a non-empty breakdown");
        } else if let Some(grant) = v.get("grant") {
            let respec = &v["respec"];
            let expected = &v["expected"];

            let full_grant = serde_json::json!({
                "id": "grant-edge",
                "kind": "resource",
                "resource": grant["resource"],
                "amount": grant["amount"],
                "allocation": grant["allocation"],
            });
            let new_allocation = respec["new_allocation"].clone();
            let updated = reallocate_resource_grant(&full_grant, new_allocation).unwrap_or_else(|e| panic!("vector {id}: {e}"));

            assert_eq!(updated["amount"], expected["resource_amount"].clone(), "vector {id}");
            assert_eq!(updated["allocation"], expected["allocation"].clone(), "vector {id}");
            assert!(expected["grant_preserved"].as_bool().unwrap());
        } else {
            panic!("vector {id}: unrecognized modifier_engine.json vector shape");
        }
    }
}
