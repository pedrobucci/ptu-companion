//! `.ptubackup` full backup export/import (technical spec §22.3): every
//! Trainer, every imported content pack, and (if supplied) the active
//! Campaign Ruleset. Rulesets aren't database-backed yet (a gap already
//! disclosed since T03), so ruleset inclusion is best-effort — the caller
//! passes whichever ruleset value it currently has in memory, if any.
//!
//! Every embedded content pack goes through the full `.ptucp` importer
//! ([`crate::content::import::import_pack`]) on restore, so the same
//! protections apply here as anywhere else content is imported.

use std::io::{Cursor, Read, Write};

use rusqlite::Connection;
use serde_json::Value;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::content::export::export_pack;
use crate::content::import::{hex_sha256, import_pack};
use crate::content::repository::list_packs;
use crate::content::zip_safety::is_safe_entry_path;
use crate::error::TrainerPackError;
use crate::profile::model::TrainerProfile;
use crate::profile::repository::{
    list_trainer_build_drafts, list_trainer_summaries, load_trainer_profile, restore_trainer_build_draft, save_trainer_profile,
};

pub struct BackupExportOutcome {
    pub bytes: Vec<u8>,
    pub trainer_ids: Vec<String>,
    pub content_pack_ids: Vec<String>,
}

pub fn export_backup(
    definitions_conn: &Connection,
    profiles_conn: &Connection,
    active_ruleset: Option<&Value>,
) -> Result<BackupExportOutcome, TrainerPackError> {
    let mut files: Vec<(String, Vec<u8>)> = Vec::new();

    let trainer_summaries = list_trainer_summaries(profiles_conn)?;
    let mut trainer_ids = Vec::with_capacity(trainer_summaries.len());
    for summary in &trainer_summaries {
        let profile: TrainerProfile = load_trainer_profile(profiles_conn, &summary.id)?
            .ok_or_else(|| TrainerPackError::TrainerNotFound(summary.id.clone()))?;
        files.push((format!("trainers/{}.json", summary.id), serde_json::to_vec_pretty(&profile)?));
        trainer_ids.push(summary.id.clone());
    }

    let packs = list_packs(definitions_conn)?;
    let mut content_pack_ids = Vec::with_capacity(packs.len());
    for pack in &packs {
        let bytes = export_pack(definitions_conn, &pack.id).map_err(TrainerPackError::Export)?;
        files.push((format!("content/{}.ptucp", pack.id), bytes));
        content_pack_ids.push(pack.id.clone());
    }

    // T13D1 (§3.3): "full backup also retains drafts" — unlike a single
    // `.ptutrainer` export, which intentionally excludes drafts entirely
    // (see `portability::trainer_pack`'s module doc: it only ever
    // serializes `TrainerProfile` itself, which has no draft field).
    let mut draft_ids: Vec<String> = Vec::new();
    for trainer_id in &trainer_ids {
        for (draft_id, intent) in list_trainer_build_drafts(profiles_conn, Some(trainer_id))? {
            files.push((
                format!("drafts/{draft_id}.json"),
                serde_json::to_vec_pretty(&serde_json::json!({"id": draft_id, "trainer_id": trainer_id, "intent": intent}))?,
            ));
            draft_ids.push(draft_id);
        }
    }
    for (draft_id, intent) in list_trainer_build_drafts(profiles_conn, None)? {
        files.push((
            format!("drafts/{draft_id}.json"),
            serde_json::to_vec_pretty(&serde_json::json!({"id": draft_id, "trainer_id": Value::Null, "intent": intent}))?,
        ));
        draft_ids.push(draft_id);
    }

    if let Some(ruleset) = active_ruleset {
        files.push(("ruleset.json".to_string(), serde_json::to_vec_pretty(ruleset)?));
    }

    let mut manifest_files = serde_json::Map::new();
    for (path, bytes) in &files {
        manifest_files.insert(path.clone(), serde_json::json!({"sha256": hex_sha256(bytes), "bytes": bytes.len()}));
    }
    let manifest = serde_json::json!({
        "format": "ptu-backup",
        "format_version": 1,
        "trainer_ids": trainer_ids,
        "content_pack_ids": content_pack_ids,
        "draft_ids": draft_ids,
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

    Ok(BackupExportOutcome { bytes: cursor.into_inner(), trainer_ids, content_pack_ids })
}

pub struct BackupImportOutcome {
    pub trainers_imported: Vec<String>,
    pub content_packs_imported: Vec<String>,
}

pub fn import_backup(
    definitions_conn: &mut Connection,
    profiles_conn: &mut Connection,
    archive_bytes: &[u8],
) -> Result<BackupImportOutcome, TrainerPackError> {
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
    if manifest["format"].as_str() != Some("ptu-backup") {
        return Err(TrainerPackError::UnsupportedFormat(manifest["format"].to_string()));
    }
    if manifest["format_version"].as_i64() != Some(1) {
        return Err(TrainerPackError::UnsupportedFormatVersion(manifest["format_version"].as_i64().unwrap_or(-1)));
    }

    let files_obj = manifest["files"].as_object().ok_or(TrainerPackError::ManifestMissing)?;
    let mut verified: std::collections::HashMap<String, Vec<u8>> = std::collections::HashMap::new();
    for (path, entry) in files_obj {
        if !entry_names.iter().any(|n| n == path) {
            return Err(TrainerPackError::ArchiveFileMissing(path.clone()));
        }
        let bytes = read_entry(&mut archive, path)?;
        let expected = entry["sha256"].as_str().unwrap_or_default();
        let actual = hex_sha256(&bytes);
        if !actual.eq_ignore_ascii_case(expected) {
            return Err(TrainerPackError::HashMismatch { path: path.clone(), expected: expected.to_string(), actual });
        }
        verified.insert(path.clone(), bytes);
    }

    let content_pack_ids: Vec<String> = manifest["content_pack_ids"]
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
        .unwrap_or_default();
    let mut content_packs_imported = Vec::new();
    for pack_id in &content_pack_ids {
        let path = format!("content/{pack_id}.ptucp");
        let bytes = verified.get(&path).ok_or_else(|| TrainerPackError::ArchiveFileMissing(path.clone()))?;
        import_pack(definitions_conn, bytes).map_err(TrainerPackError::Import)?;
        content_packs_imported.push(pack_id.clone());
    }

    let trainer_ids: Vec<String> = manifest["trainer_ids"]
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
        .unwrap_or_default();
    let mut trainers_imported = Vec::new();
    for trainer_id in &trainer_ids {
        let path = format!("trainers/{trainer_id}.json");
        let bytes = verified.get(&path).ok_or_else(|| TrainerPackError::ArchiveFileMissing(path.clone()))?;
        let profile: TrainerProfile = serde_json::from_slice(bytes)?;
        save_trainer_profile(profiles_conn, &profile)?;
        trainers_imported.push(trainer_id.clone());
    }

    let draft_ids: Vec<String> = manifest["draft_ids"]
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
        .unwrap_or_default();
    for draft_id in &draft_ids {
        let path = format!("drafts/{draft_id}.json");
        let bytes = verified.get(&path).ok_or_else(|| TrainerPackError::ArchiveFileMissing(path.clone()))?;
        let record: Value = serde_json::from_slice(bytes)?;
        let trainer_id = record["trainer_id"].as_str();
        restore_trainer_build_draft(profiles_conn, draft_id, trainer_id, &record["intent"])?;
    }

    Ok(BackupImportOutcome { trainers_imported, content_packs_imported })
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
    use crate::persistence::definitions::open_and_migrate_definitions;
    use crate::persistence::profiles::open_and_migrate_profiles;
    use crate::profile::model::TrainerProfile;
    use std::path::Path;

    fn repo_root() -> std::path::PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..")
    }

    #[test]
    fn full_backup_round_trips_trainers_and_packs() {
        let dir = std::env::temp_dir().join(format!("ptu-backup-src-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut definitions = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
        let mut profiles = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();

        // Keep this test fast: import just one real pack rather than all 18.
        let core_pack = repo_root().join("content_packs/ptu-core-1.05.ptucp");
        crate::content::import::import_pack_file(&mut definitions, &core_pack).unwrap();

        let trainer = TrainerProfile { id: "t1".to_string(), name: "Backup Test".to_string(), level: 3, exp: 0, money: 500, ..TrainerProfile::default() };
        save_trainer_profile(&mut profiles, &trainer).unwrap();

        let outcome = export_backup(&definitions, &profiles, None).unwrap();
        assert_eq!(outcome.trainer_ids, vec!["t1".to_string()]);
        assert_eq!(outcome.content_pack_ids, vec!["ptu-core-1.05".to_string()]);

        // Restore into fresh, empty databases.
        let restore_dir = std::env::temp_dir().join(format!("ptu-backup-restore-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&restore_dir).unwrap();
        let mut fresh_definitions = open_and_migrate_definitions(&restore_dir.join("definitions.sqlite")).unwrap();
        let mut fresh_profiles = open_and_migrate_profiles(&restore_dir.join("profiles.sqlite")).unwrap();

        let restored = import_backup(&mut fresh_definitions, &mut fresh_profiles, &outcome.bytes).unwrap();
        assert_eq!(restored.trainers_imported, vec!["t1".to_string()]);
        assert_eq!(restored.content_packs_imported, vec!["ptu-core-1.05".to_string()]);

        let reloaded_trainer = load_trainer_profile(&fresh_profiles, "t1").unwrap().unwrap();
        assert_eq!(reloaded_trainer.name, "Backup Test");
        assert_eq!(reloaded_trainer.money, 500);

        let move_count: i64 = fresh_definitions.query_row("SELECT COUNT(*) FROM moves", [], |r| r.get(0)).unwrap();
        assert!(move_count > 0);

        let _ = std::fs::remove_dir_all(&dir);
        let _ = std::fs::remove_dir_all(&restore_dir);
    }
}
