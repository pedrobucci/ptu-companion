//! `.ptutrainer` export/import (technical spec §22.2). Structurally this
//! implementation departs from the spec's suggested file split
//! (`trainer.json`/`pokemon.ndjson`/`rosters.json`/`inventory.json`/
//! `npcs.json`/`history.ndjson`) — since T04's `TrainerProfile` already
//! unifies all of that into one serializable value, splitting it back into
//! five files would add ceremony without benefit. One `trainer.json`
//! carries everything; see the T09 Worker Result for this call.
//!
//! Embedded homebrew packs go through the exact same [`content::import::import_pack`]
//! used for standalone `.ptucp` imports, so zip-slip/hash/schema/transaction
//! protections apply identically to embedded content — no protection is
//! reimplemented or weakened for the embedded case.
//!
//! T13D1 (§3.3): a single `.ptutrainer` export intentionally excludes this
//! Trainer's build drafts (`trainer_build_drafts` rows) — only the
//! committed `TrainerProfile` graph round-trips here. A full `.ptubackup`
//! (`portability::backup`) is the only export that also retains drafts.

use std::collections::BTreeSet;
use std::io::{Cursor, Read, Write};

use rusqlite::Connection;
use serde_json::Value;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::content::export::export_pack;
use crate::content::import::import_pack;
use crate::content::repository::{get_definition_by_version_id, get_pack};
use crate::content::zip_safety::is_safe_entry_path;
use crate::content::ContentKind;
use crate::error::TrainerPackError;
use crate::profile::model::TrainerProfile;
use crate::profile::repository::{load_trainer_profile, save_trainer_profile};

const REFERENCE_KINDS: [ContentKind; 8] = [
    ContentKind::Species,
    ContentKind::Item,
    ContentKind::Move,
    ContentKind::Ability,
    ContentKind::Capability,
    ContentKind::Edge,
    ContentKind::PokeEdge,
    ContentKind::Feature,
];

/// Finds every content pack the Trainer references that isn't official
/// content (assumed already present wherever the pack is imported) — these
/// are what get embedded. A candidate string that isn't a known
/// `definition_version_id` is simply skipped (not an error): most of
/// T04's reference fields aren't guaranteed to be in that exact form (see
/// the T09 Worker Result's disclosed model gap), so this is best-effort,
/// not a completeness guarantee.
fn referenced_homebrew_pack_ids(definitions_conn: &Connection, profile: &TrainerProfile) -> Vec<String> {
    let mut candidates: Vec<String> = Vec::new();
    for p in &profile.pokemon {
        candidates.push(p.species_definition_id.clone());
        if let Some(item) = &p.held_item_id {
            candidates.push(item.clone());
        }
        if let Some(ball) = &p.capture_ball_item_id {
            candidates.push(ball.clone());
        }
        for entry in p.moves.iter().chain(&p.abilities).chain(&p.poke_edges).chain(&p.capabilities) {
            push_definition_ref(&mut candidates, entry);
        }
    }
    for stack in profile.inventory.backpack.iter().chain(&profile.inventory.storage) {
        candidates.push(stack.item_id.clone());
    }
    for item_id in profile.inventory.equipped.values() {
        candidates.push(item_id.clone());
    }
    for entry in profile
        .moves
        .iter()
        .chain(&profile.edges)
        .chain(&profile.features)
        .chain(&profile.abilities)
        .chain(&profile.capabilities)
    {
        push_definition_ref(&mut candidates, entry);
    }

    let mut pack_ids: BTreeSet<String> = BTreeSet::new();
    for candidate in candidates {
        for kind in REFERENCE_KINDS {
            if let Ok(Some(row)) = get_definition_by_version_id(definitions_conn, kind, &candidate) {
                let is_official = get_pack(definitions_conn, &row.content_pack_id)
                    .ok()
                    .flatten()
                    .and_then(|p| p.kind)
                    .map(|k| k.starts_with("official_"))
                    .unwrap_or(false);
                if !is_official {
                    pack_ids.insert(row.content_pack_id);
                }
                break;
            }
        }
    }
    pack_ids.into_iter().collect()
}

/// Pulls `"definition_version_id"` out of one mechanical-collection entry
/// (spec §23's `trainer_moves`/`pokemon_moves`/etc. shape) and adds it as a
/// homebrew-embedding candidate, if present.
fn push_definition_ref(candidates: &mut Vec<String>, entry: &Value) {
    if let Some(id) = entry.get("definition_version_id").and_then(Value::as_str) {
        candidates.push(id.to_string());
    }
}

pub struct TrainerPackExportOutcome {
    pub bytes: Vec<u8>,
    pub embedded_pack_ids: Vec<String>,
}

pub fn export_trainer_pack(
    definitions_conn: &Connection,
    profiles_conn: &Connection,
    trainer_id: &str,
) -> Result<TrainerPackExportOutcome, TrainerPackError> {
    let profile = load_trainer_profile(profiles_conn, trainer_id)
        .map_err(TrainerPackError::from)?
        .ok_or_else(|| TrainerPackError::TrainerNotFound(trainer_id.to_string()))?;

    let embedded_pack_ids = referenced_homebrew_pack_ids(definitions_conn, &profile);
    let trainer_json = serde_json::to_vec_pretty(&profile)?;

    let mut files: Vec<(String, Vec<u8>)> = vec![("trainer.json".to_string(), trainer_json)];
    for pack_id in &embedded_pack_ids {
        let pack_bytes = export_pack(definitions_conn, pack_id).map_err(TrainerPackError::Export)?;
        files.push((format!("embedded_content/{pack_id}.ptucp"), pack_bytes));
    }

    let mut manifest_files = serde_json::Map::new();
    for (path, bytes) in &files {
        manifest_files.insert(
            path.clone(),
            serde_json::json!({"sha256": crate::content::import::hex_sha256(bytes), "bytes": bytes.len()}),
        );
    }
    let manifest = serde_json::json!({
        "format": "ptu-trainer-pack",
        "format_version": 1,
        "trainer_id": profile.id,
        "trainer_name": profile.name,
        "embedded_content": embedded_pack_ids,
        "files": manifest_files,
    });

    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default();
    writer.start_file("manifest.json", options).map_err(|e| TrainerPackError::Zip(e.to_string()))?;
    writer.write_all(&serde_json::to_vec_pretty(&manifest)?)?;
    for (path, bytes) in &files {
        writer.start_file(path, options).map_err(|e| TrainerPackError::Zip(e.to_string()))?;
        writer.write_all(bytes)?;
    }
    let cursor = writer.finish().map_err(|e| TrainerPackError::Zip(e.to_string()))?;

    Ok(TrainerPackExportOutcome { bytes: cursor.into_inner(), embedded_pack_ids })
}

pub struct TrainerPackImportOutcome {
    pub trainer_id: String,
    pub embedded_packs_imported: Vec<String>,
}

/// Imports a `.ptutrainer` archive: zip-slip check, per-file hash
/// verification, then each embedded pack goes through the full
/// `.ptucp` importer (same protections as a standalone import), and
/// finally the Trainer profile itself is saved. Embedded packs are
/// imported (and, on any failure, rolled back by `import_pack`'s own
/// transaction) before the Trainer profile is saved, so a Trainer is
/// never saved referencing content that failed to import.
pub fn import_trainer_pack(
    definitions_conn: &mut Connection,
    profiles_conn: &mut Connection,
    archive_bytes: &[u8],
) -> Result<TrainerPackImportOutcome, TrainerPackError> {
    let mut archive = zip::ZipArchive::new(Cursor::new(archive_bytes)).map_err(|e| TrainerPackError::Archive(e.to_string()))?;

    let entry_names: Vec<String> = archive.file_names().map(str::to_owned).collect();
    for name in &entry_names {
        if !is_safe_entry_path(name) {
            return Err(TrainerPackError::UnsafeArchivePath(name.clone()));
        }
    }
    if !entry_names.iter().any(|n| n == "manifest.json") {
        return Err(TrainerPackError::ManifestMissing);
    }

    let manifest_bytes = read_entry(&mut archive, "manifest.json")?;
    let manifest: Value = serde_json::from_slice(&manifest_bytes)?;
    if manifest["format"].as_str() != Some("ptu-trainer-pack") {
        return Err(TrainerPackError::UnsupportedFormat(manifest["format"].to_string()));
    }
    if manifest["format_version"].as_i64() != Some(1) {
        return Err(TrainerPackError::UnsupportedFormatVersion(manifest["format_version"].as_i64().unwrap_or(-1)));
    }

    let files_obj = manifest["files"].as_object().ok_or_else(|| TrainerPackError::ManifestMissing)?;
    let mut verified: std::collections::HashMap<String, Vec<u8>> = std::collections::HashMap::new();
    for (path, entry) in files_obj {
        if !entry_names.iter().any(|n| n == path) {
            return Err(TrainerPackError::ArchiveFileMissing(path.clone()));
        }
        let bytes = read_entry(&mut archive, path)?;
        let expected = entry["sha256"].as_str().unwrap_or_default();
        let actual = crate::content::import::hex_sha256(&bytes);
        if !actual.eq_ignore_ascii_case(expected) {
            return Err(TrainerPackError::HashMismatch { path: path.clone(), expected: expected.to_string(), actual });
        }
        verified.insert(path.clone(), bytes);
    }

    let trainer_bytes = verified.get("trainer.json").ok_or(TrainerPackError::ManifestMissing)?;
    let profile: TrainerProfile = serde_json::from_slice(trainer_bytes)?;

    let embedded_pack_ids: Vec<String> = manifest["embedded_content"]
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
        .unwrap_or_default();

    let mut imported_packs = Vec::new();
    for pack_id in &embedded_pack_ids {
        let path = format!("embedded_content/{pack_id}.ptucp");
        let Some(bytes) = verified.get(&path) else {
            return Err(TrainerPackError::ArchiveFileMissing(path));
        };
        import_pack(definitions_conn, bytes).map_err(TrainerPackError::Import)?;
        imported_packs.push(pack_id.clone());
    }

    save_trainer_profile(profiles_conn, &profile)?;

    Ok(TrainerPackImportOutcome { trainer_id: profile.id, embedded_packs_imported: imported_packs })
}

fn read_entry(archive: &mut zip::ZipArchive<Cursor<&[u8]>>, name: &str) -> Result<Vec<u8>, TrainerPackError> {
    let mut file = archive.by_name(name).map_err(|e| TrainerPackError::Archive(e.to_string()))?;
    let mut buf = Vec::with_capacity(file.size() as usize);
    file.read_to_end(&mut buf)?;
    Ok(buf)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::authoring::save_definition;
    use crate::content::import::import_pack_file;
    use crate::persistence::definitions::open_and_migrate_definitions;
    use crate::persistence::profiles::open_and_migrate_profiles;
    use crate::profile::model::{PokemonInstance, StorageState, TrainerProfile};
    use serde_json::json;
    use std::path::Path;

    fn repo_root() -> std::path::PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..")
    }

    fn seed_source() -> (std::path::PathBuf, Connection, Connection) {
        let dir = std::env::temp_dir().join(format!("ptu-trainerpack-src-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut definitions = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
        let profiles = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
        let core_pack = repo_root().join("content_packs/ptu-core-1.05.ptucp");
        import_pack_file(&mut definitions, &core_pack).unwrap();
        (dir, definitions, profiles)
    }

    /// T09 acceptance: `.ptutrainer` round-trip with referenced homebrew embedded.
    #[test]
    fn export_import_round_trip_embeds_and_restores_referenced_homebrew() {
        let (dir, mut definitions, mut profiles) = seed_source();

        // A homebrew item this Trainer holds — not present on a fresh install.
        save_definition(
            &mut definitions,
            "my-homebrew-items",
            "My Homebrew Items",
            200,
            ContentKind::Item,
            &json!({
                "id": "lucky-charm", "name": "Lucky Charm", "needs_review": false,
                "logical_id": "lucky-charm", "definition_version_id": "items:lucky-charm@my-homebrew-items",
                "content_pack_id": "my-homebrew-items"
            }),
        )
        .unwrap();

        let profile = TrainerProfile {
            id: "t1".to_string(),
            name: "Portability Test".to_string(),
            level: 10,
            exp: 0,
            money: 100,
            pokemon: vec![PokemonInstance {
                id: "pkm-1".to_string(),
                species_definition_id: "sableye".to_string(),
                nickname: None,
                level: 10,
                exp: None,
                capture_ball_item_id: None,
                injuries: 0,
                held_item_id: Some("items:lucky-charm@my-homebrew-items".to_string()),
                storage_state: StorageState::Carried,
                roster_memberships: vec![],
                battle_state: None,
                ..Default::default()
            }],
            ..TrainerProfile::default()
        };
        save_trainer_profile(&mut profiles, &profile).unwrap();

        let export = export_trainer_pack(&definitions, &profiles, "t1").unwrap();
        assert_eq!(export.embedded_pack_ids, vec!["my-homebrew-items".to_string()], "homebrew must be embedded; official core must not be");

        // Import into completely fresh databases that have never seen this homebrew pack.
        let fresh_dir = std::env::temp_dir().join(format!("ptu-trainerpack-dst-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&fresh_dir).unwrap();
        let mut fresh_definitions = open_and_migrate_definitions(&fresh_dir.join("definitions.sqlite")).unwrap();
        let mut fresh_profiles = open_and_migrate_profiles(&fresh_dir.join("profiles.sqlite")).unwrap();

        let outcome = import_trainer_pack(&mut fresh_definitions, &mut fresh_profiles, &export.bytes).unwrap();
        assert_eq!(outcome.trainer_id, "t1");
        assert_eq!(outcome.embedded_packs_imported, vec!["my-homebrew-items".to_string()]);

        let reloaded = load_trainer_profile(&fresh_profiles, "t1").unwrap().unwrap();
        assert_eq!(reloaded, profile, "trainer data must round-trip exactly");

        let homebrew_item = get_definition_by_version_id(&fresh_definitions, ContentKind::Item, "items:lucky-charm@my-homebrew-items")
            .unwrap()
            .unwrap();
        assert_eq!(homebrew_item.name, "Lucky Charm");

        let _ = std::fs::remove_dir_all(&dir);
        let _ = std::fs::remove_dir_all(&fresh_dir);
    }

    /// T09a acceptance: every mechanical collection (Trainer:
    /// moves/edges/features/abilities/capabilities; Pokémon:
    /// moves/abilities/poke_edges/capabilities) round-trips through
    /// save/close/reopen exactly, with a mix of shipped and homebrew
    /// entries, and homebrew references get embedded on `.ptutrainer` export.
    #[test]
    fn all_mechanical_collections_round_trip_with_shipped_and_homebrew_entries() {
        let (dir, mut definitions, mut profiles) = seed_source();

        save_definition(
            &mut definitions,
            "t09a-homebrew",
            "T09a Homebrew",
            300,
            ContentKind::Ability,
            &json!({
                "id": "custom-ability", "name": "Custom Ability", "needs_review": false,
                "logical_id": "custom-ability", "definition_version_id": "abilities:custom-ability@t09a-homebrew",
                "content_pack_id": "t09a-homebrew"
            }),
        )
        .unwrap();

        let profile = TrainerProfile {
            id: "t1".to_string(),
            name: "Collections Test".to_string(),
            level: 5,
            exp: 0,
            money: 0,
            moves: vec![json!({"definition_version_id": "moves:crunch@core", "source": "level_up"})],
            edges: vec![json!({"definition_version_id": "edges:acrobat@core"})],
            features: vec![json!({"definition_version_id": "features:accentuated-taste@core"})],
            abilities: vec![json!({"definition_version_id": "abilities:abominable@core"})],
            capabilities: vec![json!({"definition_version_id": "capabilities:alluring@core"})],
            pokemon: vec![PokemonInstance {
                id: "pkm-1".to_string(),
                species_definition_id: "sableye".to_string(),
                level: 20,
                storage_state: StorageState::Carried,
                moves: vec![json!({"definition_version_id": "moves:crunch@core"})],
                abilities: vec![json!({"definition_version_id": "abilities:custom-ability@t09a-homebrew"})],
                poke_edges: vec![json!({"definition_version_id": "poke_edges:ability-mastery@core"})],
                capabilities: vec![json!({"definition_version_id": "capabilities:alluring@core"})],
                ..Default::default()
            }],
            ..TrainerProfile::default()
        };
        save_trainer_profile(&mut profiles, &profile).unwrap();

        // "close" and "reopen".
        drop(profiles);
        let reopened_profiles = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
        let reloaded = load_trainer_profile(&reopened_profiles, "t1").unwrap().unwrap();

        // T13D1: `trainer_edges`/`trainer_features` now carry a server-
        // assigned `acquisition_id` (persistence::profiles migration 6) — a
        // value saved without one gets a fresh, stable id on its first read
        // back. Every other field, and every other collection, is
        // untouched — asserted below by diffing against `profile` with
        // only `edges`/`features` swapped for the now-tagged versions.
        let edge_acquisition_id = reloaded.edges[0]["acquisition_id"].as_str().unwrap().to_string();
        assert!(!edge_acquisition_id.is_empty());
        let feature_acquisition_id = reloaded.features[0]["acquisition_id"].as_str().unwrap().to_string();
        assert!(!feature_acquisition_id.is_empty());
        assert_eq!(reloaded.edges[0]["definition_version_id"], "edges:acrobat@core");
        assert_eq!(reloaded.features[0]["definition_version_id"], "features:accentuated-taste@core");

        let mut expected = profile.clone();
        expected.edges = reloaded.edges.clone();
        expected.features = reloaded.features.clone();
        assert_eq!(reloaded, expected, "every collection must round-trip exactly through close/reopen, aside from edges/features gaining a stable acquisition_id");

        // Export embeds the homebrew ability's pack, not core.
        let export = export_trainer_pack(&definitions, &reopened_profiles, "t1").unwrap();
        assert_eq!(export.embedded_pack_ids, vec!["t09a-homebrew".to_string()]);

        // Import into completely fresh databases.
        let fresh_dir = std::env::temp_dir().join(format!("ptu-trainerpack-collections-dst-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&fresh_dir).unwrap();
        let mut fresh_definitions = open_and_migrate_definitions(&fresh_dir.join("definitions.sqlite")).unwrap();
        let mut fresh_profiles = open_and_migrate_profiles(&fresh_dir.join("profiles.sqlite")).unwrap();
        let outcome = import_trainer_pack(&mut fresh_definitions, &mut fresh_profiles, &export.bytes).unwrap();
        assert_eq!(outcome.embedded_packs_imported, vec!["t09a-homebrew".to_string()]);

        let restored = load_trainer_profile(&fresh_profiles, "t1").unwrap().unwrap();
        assert_eq!(restored, expected, "collections must round-trip through a full .ptutrainer export/import too, with the same acquisition_id preserved (not reassigned)");

        let restored_ability = get_definition_by_version_id(&fresh_definitions, ContentKind::Ability, "abilities:custom-ability@t09a-homebrew")
            .unwrap()
            .unwrap();
        assert_eq!(restored_ability.name, "Custom Ability");

        let _ = std::fs::remove_dir_all(&dir);
        let _ = std::fs::remove_dir_all(&fresh_dir);
    }

    #[test]
    fn rejects_zip_slip_entry_in_trainer_pack() {
        let (dir, mut definitions, mut profiles) = seed_source();
        let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
        let options = SimpleFileOptions::default();
        writer.start_file("manifest.json", options).unwrap();
        writer.write_all(br#"{"format":"ptu-trainer-pack","format_version":1,"files":{}}"#).unwrap();
        writer.start_file("../../evil.txt", options).unwrap();
        writer.write_all(b"malicious").unwrap();
        let bytes = writer.finish().unwrap().into_inner();

        let result = import_trainer_pack(&mut definitions, &mut profiles, &bytes);
        assert!(matches!(result, Err(TrainerPackError::UnsafeArchivePath(_))));

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_hash_mismatch_without_saving_the_trainer() {
        let (dir, mut definitions, mut profiles) = seed_source();
        let trainer_json = serde_json::to_vec(&TrainerProfile {
            id: "should-not-be-saved".to_string(),
            name: "X".to_string(),
            level: 1,
            exp: 0,
            money: 0,
            ..TrainerProfile::default()
        })
        .unwrap();

        let manifest = json!({
            "format": "ptu-trainer-pack", "format_version": 1,
            "trainer_id": "should-not-be-saved", "trainer_name": "X", "embedded_content": [],
            "files": {"trainer.json": {"sha256": "0".repeat(64), "bytes": trainer_json.len()}}
        });

        let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
        let options = SimpleFileOptions::default();
        writer.start_file("manifest.json", options).unwrap();
        writer.write_all(&serde_json::to_vec(&manifest).unwrap()).unwrap();
        writer.start_file("trainer.json", options).unwrap();
        writer.write_all(&trainer_json).unwrap();
        let bytes = writer.finish().unwrap().into_inner();

        let result = import_trainer_pack(&mut definitions, &mut profiles, &bytes);
        assert!(matches!(result, Err(TrainerPackError::HashMismatch { .. })));

        let not_saved = load_trainer_profile(&profiles, "should-not-be-saved").unwrap();
        assert!(not_saved.is_none(), "a hash-mismatched pack must never reach save_trainer_profile");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
