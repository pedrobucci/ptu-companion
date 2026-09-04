//! Content pack export — the reverse of [`super::import`]: serializes an
//! already-imported pack's rows back into a valid `.ptucp` archive that
//! `import_pack` can re-import (schema-valid manifest, correct hashes,
//! correct per-file record counts). Used to embed referenced homebrew in a
//! `.ptutrainer`/`.ptubackup` export (spec 22.2/22.3) and by the content
//! editor to publish a newly authored pack (spec 21).
//!
//! Exports **every** row for the pack regardless of its `enabled` flag —
//! soft-deleted definitions (spec 23) are still real content that should
//! survive a re-export; only the resolver (T03) treats them as invisible.

use std::io::{Cursor, Write};

use rusqlite::{params, Connection};
use serde_json::Value;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use super::import::hex_sha256;
use super::ContentKind;
use crate::error::ExportError;

const DEFINITION_KINDS: [ContentKind; 9] = [
    ContentKind::Move,
    ContentKind::Ability,
    ContentKind::Capability,
    ContentKind::Edge,
    ContentKind::PokeEdge,
    ContentKind::Feature,
    ContentKind::Item,
    ContentKind::Species,
    ContentKind::Shop,
];

/// Re-serializes `pack_id` into `.ptucp` archive bytes.
pub fn export_pack(conn: &Connection, pack_id: &str) -> Result<Vec<u8>, ExportError> {
    let (name, version, priority, kind, dependencies_json): (String, String, i64, Option<String>, String) = conn
        .query_row(
            "SELECT name, version, priority, kind, dependencies_json FROM content_packs WHERE id = ?1",
            params![pack_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => ExportError::PackNotFound(pack_id.to_string()),
            other => ExportError::Sqlite(other),
        })?;
    let dependencies: Value = serde_json::from_str(&dependencies_json).unwrap_or(Value::Array(vec![]));

    // (archive path, bytes, record count)
    let mut files: Vec<(String, Vec<u8>, u64)> = Vec::new();

    for definition_kind in DEFINITION_KINDS {
        let table = definition_kind.table_name();
        let mut stmt = conn.prepare(&format!(
            "SELECT data_json FROM {table} WHERE content_pack_id = ?1 ORDER BY definition_version_id"
        ))?;
        let rows: Vec<String> = stmt.query_map(params![pack_id], |row| row.get(0))?.collect::<rusqlite::Result<_>>()?;
        if rows.is_empty() {
            continue;
        }
        let count = rows.len() as u64;
        let ndjson = rows.join("\n") + "\n";
        files.push((format!("content/{table}.ndjson"), ndjson.into_bytes(), count));
    }

    let mut dataset_stmt =
        conn.prepare("SELECT dataset_name, data_json, record_count FROM content_datasets WHERE content_pack_id = ?1")?;
    let datasets: Vec<(String, String, i64)> = dataset_stmt
        .query_map(params![pack_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?
        .collect::<rusqlite::Result<_>>()?;
    for (dataset_name, data_json, record_count) in datasets {
        files.push((format!("content/datasets/{dataset_name}.json"), data_json.into_bytes(), record_count as u64));
    }

    if files.is_empty() {
        return Err(ExportError::EmptyPack(pack_id.to_string()));
    }

    let mut manifest_files = serde_json::Map::new();
    for (path, bytes, record_count) in &files {
        manifest_files.insert(
            path.clone(),
            serde_json::json!({
                "sha256": hex_sha256(bytes),
                "bytes": bytes.len(),
                "records": record_count,
                "media_type": if path.ends_with(".ndjson") { "application/x-ndjson" } else { "application/json" },
            }),
        );
    }

    let manifest = serde_json::json!({
        "format": "ptu-content-pack",
        "format_version": 1,
        "id": pack_id,
        "name": name,
        "version": version,
        "priority": priority,
        "kind": kind,
        "dependencies": dependencies,
        "content_counts": {},
        "files": manifest_files,
    });

    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default();
    writer
        .start_file("manifest.json", options)
        .map_err(|e| ExportError::Zip(e.to_string()))?;
    writer
        .write_all(&serde_json::to_vec_pretty(&manifest).map_err(ExportError::from)?)
        .map_err(ExportError::Io)?;
    for (path, bytes, _) in &files {
        writer.start_file(path, options).map_err(|e| ExportError::Zip(e.to_string()))?;
        writer.write_all(bytes).map_err(ExportError::Io)?;
    }
    let cursor = writer.finish().map_err(|e| ExportError::Zip(e.to_string()))?;
    Ok(cursor.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::import::{import_pack, import_pack_file};
    use crate::persistence::definitions::open_and_migrate_definitions;
    use std::path::Path;

    fn repo_root() -> std::path::PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..")
    }

    #[test]
    fn exported_pack_reimports_identically() {
        let dir = std::env::temp_dir().join(format!("ptu-export-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();

        let core_pack = repo_root().join("content_packs/ptu-core-1.05.ptucp");
        import_pack_file(&mut conn, &core_pack).unwrap();

        let exported_bytes = export_pack(&conn, "ptu-core-1.05").unwrap();

        // Reimporting the export into a fresh database must succeed and
        // produce the same row counts as the original import.
        let fresh_dir = std::env::temp_dir().join(format!("ptu-export-reimport-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&fresh_dir).unwrap();
        let mut fresh_conn = open_and_migrate_definitions(&fresh_dir.join("definitions.sqlite")).unwrap();
        let outcome = import_pack(&mut fresh_conn, &exported_bytes).unwrap();
        assert_eq!(outcome.pack_id, "ptu-core-1.05");

        let original_moves: i64 = conn.query_row("SELECT COUNT(*) FROM moves", [], |r| r.get(0)).unwrap();
        let reimported_moves: i64 = fresh_conn.query_row("SELECT COUNT(*) FROM moves", [], |r| r.get(0)).unwrap();
        assert_eq!(original_moves, reimported_moves);
        assert!(original_moves > 0);

        let _ = std::fs::remove_dir_all(&dir);
        let _ = std::fs::remove_dir_all(&fresh_dir);
    }

    #[test]
    fn exporting_unknown_pack_fails_cleanly() {
        let conn = Connection::open_in_memory().unwrap();
        let migrations = crate::persistence::definitions::migrations();
        let refs: Vec<&str> = migrations.iter().map(String::as_str).collect();
        crate::persistence::apply_migrations(&conn, &refs).unwrap();

        let result = export_pack(&conn, "does-not-exist");
        assert!(matches!(result, Err(ExportError::PackNotFound(_))));
    }
}
