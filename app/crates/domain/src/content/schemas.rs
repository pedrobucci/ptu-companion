//! JSON Schema validation for the record shapes the final data handoff
//! actually ships formal schemas for (content pack manifest, species). The
//! other content kinds (moves/abilities/capabilities/edges/poke_edges/
//! features/items) have no formal schema in the handoff — they are
//! semi-structured source-derived records; those are checked structurally
//! in `import.rs` against the definition contract the spec requires
//! (logical_id/definition_version_id/content_pack_id/name/needs_review).

use jsonschema::Validator;
use serde_json::Value;
use std::sync::OnceLock;

const MANIFEST_SCHEMA_STR: &str = include_str!("../../schemas/content-pack-v1.schema.json");
const SPECIES_SCHEMA_STR: &str = include_str!("../../schemas/pokemon-species-v0.5.schema.json");
const RULESET_SCHEMA_STR: &str = include_str!("../../schemas/campaign-ruleset-v1.schema.json");

fn compile(schema_str: &str) -> Validator {
    let schema: Value =
        serde_json::from_str(schema_str).expect("embedded schema is valid JSON");
    jsonschema::validator_for(&schema).expect("embedded schema compiles")
}

fn manifest_validator() -> &'static Validator {
    static V: OnceLock<Validator> = OnceLock::new();
    V.get_or_init(|| compile(MANIFEST_SCHEMA_STR))
}

fn species_validator() -> &'static Validator {
    static V: OnceLock<Validator> = OnceLock::new();
    V.get_or_init(|| compile(SPECIES_SCHEMA_STR))
}

fn ruleset_validator() -> &'static Validator {
    static V: OnceLock<Validator> = OnceLock::new();
    V.get_or_init(|| compile(RULESET_SCHEMA_STR))
}

fn describe_errors(validator: &Validator, instance: &Value) -> String {
    validator
        .iter_errors(instance)
        .map(|e| format!("{} (at {})", e, e.instance_path()))
        .collect::<Vec<_>>()
        .join("; ")
}

pub fn validate_manifest(instance: &Value) -> Result<(), String> {
    let v = manifest_validator();
    if v.is_valid(instance) {
        Ok(())
    } else {
        Err(describe_errors(v, instance))
    }
}

pub fn validate_species(instance: &Value) -> Result<(), String> {
    let v = species_validator();
    if v.is_valid(instance) {
        Ok(())
    } else {
        Err(describe_errors(v, instance))
    }
}

pub fn validate_ruleset(instance: &Value) -> Result<(), String> {
    let v = ruleset_validator();
    if v.is_valid(instance) {
        Ok(())
    } else {
        Err(describe_errors(v, instance))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn rejects_manifest_with_wrong_format_version() {
        let bad = json!({
            "format": "ptu-content-pack",
            "format_version": 2,
            "id": "x",
            "name": "X",
            "version": "1.0.0",
            "priority": 100,
            "dependencies": [],
            "content_counts": {},
            "files": {}
        });
        assert!(validate_manifest(&bad).is_err());
    }

    #[test]
    fn accepts_minimal_valid_manifest() {
        let good = json!({
            "format": "ptu-content-pack",
            "format_version": 1,
            "id": "x",
            "name": "X",
            "version": "1.0.0",
            "priority": 100,
            "dependencies": [],
            "content_counts": {},
            "files": {}
        });
        assert!(validate_manifest(&good).is_ok());
    }

    #[test]
    fn species_requires_enabled_for_character_creation() {
        let bad = json!({
            "id": "bulbasaur",
            "display_name": "Bulbasaur",
            "types": ["Grass", "Poison"],
            "mechanical_completeness": "complete"
        });
        assert!(validate_species(&bad).is_err());
    }
}
