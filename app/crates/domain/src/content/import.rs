//! `.ptucp` content pack importer (technical spec sections 22.1, 27, 35).
//!
//! One call to [`import_pack`] performs the whole transaction: zip-slip
//! check, manifest schema validation, hash verification of every declared
//! file *before* any payload is parsed, structural/schema validation of
//! every record, then a single SQLite transaction that stages every write
//! and only commits once everything above has succeeded. Any error at any
//! stage leaves `definitions.sqlite` exactly as it was before the call.

use std::collections::HashMap;
use std::io::{Cursor, Read};
use std::path::Path;

use chrono::Utc;
use rusqlite::{params, Connection};
use serde_json::Value;
use sha2::{Digest, Sha256};

use super::manifest::Manifest;
use super::schemas::{validate_manifest, validate_species};
use super::zip_safety::is_safe_entry_path;
use super::ContentKind;
use crate::error::ImportError;

#[derive(Debug, Clone)]
pub struct ImportOutcome {
    pub pack_id: String,
    pub definitions_imported: u64,
    pub datasets_imported: u64,
}

pub(crate) struct DefinitionFields {
    pub(crate) definition_version_id: String,
    pub(crate) logical_id: String,
    pub(crate) content_pack_id: String,
    pub(crate) source_id: Option<String>,
    pub(crate) source_kind: Option<String>,
    pub(crate) source_priority: Option<i64>,
    pub(crate) name: String,
    pub(crate) needs_review: bool,
    pub(crate) search_text: String,
    pub(crate) raw_json: String,
    pub(crate) national_dex_number: Option<i64>,
    pub(crate) mechanical_completeness: Option<String>,
    pub(crate) enabled_for_character_creation: Option<bool>,
}

/// Imports a `.ptucp` archive already loaded into memory.
pub fn import_pack(conn: &mut Connection, archive_bytes: &[u8]) -> Result<ImportOutcome, ImportError> {
    let mut archive = zip::ZipArchive::new(Cursor::new(archive_bytes))
        .map_err(|e| ImportError::Archive(e.to_string()))?;

    // 1. Zip-slip / path traversal gate over every entry before reading anything.
    let entry_names: Vec<String> = archive.file_names().map(str::to_owned).collect();
    for name in &entry_names {
        if !is_safe_entry_path(name) {
            return Err(ImportError::UnsafeArchivePath(name.clone()));
        }
    }

    // 2. Manifest: parse, schema-validate, reject unsupported format/version.
    if !entry_names.iter().any(|n| n == "manifest.json") {
        return Err(ImportError::ManifestMissing);
    }
    let manifest_bytes = read_entry(&mut archive, "manifest.json")?;
    let manifest_value: Value = serde_json::from_slice(&manifest_bytes)
        .map_err(|e| ImportError::ManifestNotJson(e.to_string()))?;
    validate_manifest(&manifest_value).map_err(ImportError::ManifestSchema)?;
    let manifest: Manifest = serde_json::from_value(manifest_value.clone())
        .map_err(|e| ImportError::ManifestNotJson(e.to_string()))?;

    if manifest.format != "ptu-content-pack" {
        return Err(ImportError::UnsupportedFormat(manifest.format.clone()));
    }
    if manifest.format_version != 1 {
        return Err(ImportError::UnsupportedFormatVersion(manifest.format_version));
    }

    // 3. Verify every declared file's SHA-256 before parsing its payload.
    let mut verified_files: HashMap<String, Vec<u8>> = HashMap::new();
    for (path, entry) in &manifest.files {
        if !entry_names.iter().any(|n| n == path) {
            return Err(ImportError::ArchiveFileMissing { path: path.clone() });
        }
        let bytes = read_entry(&mut archive, path)?;
        let actual_hash = hex_sha256(&bytes);
        if !actual_hash.eq_ignore_ascii_case(&entry.sha256) {
            return Err(ImportError::HashMismatch {
                path: path.clone(),
                expected: entry.sha256.clone(),
                actual: actual_hash,
            });
        }
        verified_files.insert(path.clone(), bytes);
    }

    // 4. Required pack dependencies must already be imported.
    for dep in &manifest.dependencies {
        if dep.required {
            let exists: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM content_packs WHERE id = ?1)",
                params![dep.id],
                |row| row.get(0),
            )?;
            if !exists {
                return Err(ImportError::MissingDependency(dep.id.clone()));
            }
        }
    }

    // 5. Parse and validate every record before writing anything.
    let mut parsed_definitions: Vec<(ContentKind, DefinitionFields)> = Vec::new();
    let mut parsed_datasets: Vec<(String, Value, u64)> = Vec::new();

    for (path, entry) in &manifest.files {
        let bytes = &verified_files[path];

        if let Some(dataset_name) = dataset_name_for_path(path) {
            let value: Value = serde_json::from_slice(bytes).map_err(|e| ImportError::RecordParse {
                path: path.clone(),
                line: 0,
                message: e.to_string(),
            })?;
            let count = match &value {
                Value::Array(items) => items.len() as u64,
                _ => 1,
            };
            if count != entry.records {
                return Err(ImportError::RecordCountMismatch {
                    path: path.clone(),
                    expected: entry.records,
                    actual: count,
                });
            }
            parsed_datasets.push((dataset_name, value, count));
            continue;
        }

        let Some(kind) = content_kind_for_path(path) else {
            return Err(ImportError::UnexpectedFile { path: path.clone() });
        };

        let text = std::str::from_utf8(bytes).map_err(|e| ImportError::RecordParse {
            path: path.clone(),
            line: 0,
            message: e.to_string(),
        })?;

        let mut count: u64 = 0;
        for (line_no, raw_line) in text.lines().enumerate() {
            let line = raw_line.trim();
            if line.is_empty() {
                continue;
            }
            count += 1;

            let value: Value = serde_json::from_str(line).map_err(|e| ImportError::RecordParse {
                path: path.clone(),
                line: line_no + 1,
                message: e.to_string(),
            })?;

            if kind == ContentKind::Species {
                validate_species(&value).map_err(|msg| ImportError::RecordValidation {
                    path: path.clone(),
                    index: count as usize,
                    message: msg,
                })?;
            }

            let fields = extract_definition_fields(&value).map_err(|msg| ImportError::RecordValidation {
                path: path.clone(),
                index: count as usize,
                message: msg,
            })?;

            if fields.content_pack_id != manifest.id {
                return Err(ImportError::RecordPackMismatch {
                    path: path.clone(),
                    index: count as usize,
                    expected: manifest.id.clone(),
                    found: fields.content_pack_id,
                });
            }

            parsed_definitions.push((kind, fields));
        }

        if count != entry.records {
            return Err(ImportError::RecordCountMismatch {
                path: path.clone(),
                expected: entry.records,
                actual: count,
            });
        }
    }

    // 6. Stage every write in one transaction; commit only at the very end.
    let now = Utc::now().to_rfc3339();
    let tx = conn.transaction()?;

    let dependencies_json =
        serde_json::to_string(&manifest.dependencies).unwrap_or_else(|_| "[]".into());
    tx.execute(
        "INSERT INTO content_packs (id, name, version, priority, kind, format_version, dependencies_json, manifest_json, imported_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            version = excluded.version,
            priority = excluded.priority,
            kind = excluded.kind,
            format_version = excluded.format_version,
            dependencies_json = excluded.dependencies_json,
            manifest_json = excluded.manifest_json,
            updated_at = excluded.updated_at",
        params![
            manifest.id,
            manifest.name,
            manifest.version,
            manifest.priority,
            manifest.kind,
            manifest.format_version,
            dependencies_json,
            serde_json::to_string(&manifest_value).unwrap_or_default(),
            now,
        ],
    )?;

    let definitions_imported = parsed_definitions.len() as u64;
    for (kind, fields) in &parsed_definitions {
        upsert_definition(&tx, *kind, fields, &now)?;
    }

    let datasets_imported = parsed_datasets.len() as u64;
    for (dataset_name, value, count) in &parsed_datasets {
        tx.execute(
            "INSERT INTO content_datasets (content_pack_id, dataset_name, data_json, record_count, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(content_pack_id, dataset_name) DO UPDATE SET
                data_json = excluded.data_json,
                record_count = excluded.record_count,
                updated_at = excluded.updated_at",
            params![
                manifest.id,
                dataset_name,
                serde_json::to_string(value).unwrap_or_default(),
                *count as i64,
                now
            ],
        )?;
    }

    tx.commit()?;

    Ok(ImportOutcome {
        pack_id: manifest.id,
        definitions_imported,
        datasets_imported,
    })
}

/// Convenience wrapper for importing a `.ptucp` file from disk.
pub fn import_pack_file(conn: &mut Connection, path: &Path) -> Result<ImportOutcome, ImportError> {
    let bytes = std::fs::read(path)?;
    import_pack(conn, &bytes)
}

/// Imports every `*.ptucp` file in `dir`, ordered by ascending manifest
/// priority so that lower-priority (e.g. core) packs commit before packs
/// that declare them as a required dependency. Each pack is its own
/// transaction: one pack failing does not affect packs already committed.
pub fn import_all_from_directory(
    conn: &mut Connection,
    dir: &Path,
) -> std::io::Result<Vec<(String, Result<ImportOutcome, ImportError>)>> {
    let mut packs: Vec<(String, Vec<u8>, i64)> = Vec::new();
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("ptucp") {
            continue;
        }
        let bytes = std::fs::read(&path)?;
        let priority = peek_priority(&bytes).unwrap_or(i64::MAX);
        let file_name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        packs.push((file_name, bytes, priority));
    }
    packs.sort_by_key(|(_, _, priority)| *priority);

    let mut results = Vec::with_capacity(packs.len());
    for (file_name, bytes, _priority) in packs {
        let outcome = import_pack(conn, &bytes);
        results.push((file_name, outcome));
    }
    Ok(results)
}

fn peek_priority(bytes: &[u8]) -> Option<i64> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).ok()?;
    let mut file = archive.by_name("manifest.json").ok()?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf).ok()?;
    let value: Value = serde_json::from_slice(&buf).ok()?;
    value.get("priority").and_then(Value::as_i64)
}

fn read_entry(
    archive: &mut zip::ZipArchive<Cursor<&[u8]>>,
    name: &str,
) -> Result<Vec<u8>, ImportError> {
    let mut file = archive
        .by_name(name)
        .map_err(|e| ImportError::Archive(e.to_string()))?;
    let mut buf = Vec::with_capacity(file.size() as usize);
    file.read_to_end(&mut buf)?;
    Ok(buf)
}

pub(crate) fn hex_sha256(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hasher
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

fn dataset_name_for_path(path: &str) -> Option<String> {
    let stripped = path.strip_prefix("content/datasets/")?;
    let stem = stripped.strip_suffix(".json")?;
    Some(stem.to_string())
}

fn content_kind_for_path(path: &str) -> Option<ContentKind> {
    let stripped = path.strip_prefix("content/")?;
    let stem = stripped.strip_suffix(".ndjson")?;
    ContentKind::from_file_stem(stem)
}

/// Pulls the shared definition contract (spec section 33: logical id,
/// definition version id, content pack id, source provenance, quality
/// flags) out of a record. Missing/wrong-typed required fields fail the
/// whole record rather than being coerced to a default — an absent
/// `needs_review` is not silently treated as "reviewed".
pub(crate) fn extract_definition_fields(value: &Value) -> Result<DefinitionFields, String> {
    let obj = value.as_object().ok_or("record is not a JSON object")?;

    let get_str = |key: &str| -> Option<String> {
        obj.get(key).and_then(Value::as_str).map(str::to_owned)
    };
    let require_str = |key: &str| -> Result<String, String> {
        get_str(key)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| format!("missing or empty required field \"{key}\""))
    };

    let definition_version_id = require_str("definition_version_id")?;
    let logical_id = require_str("logical_id")?;
    let content_pack_id = require_str("content_pack_id")?;
    let name = get_str("name")
        .or_else(|| get_str("display_name"))
        .filter(|s| !s.is_empty())
        .ok_or("missing name/display_name field")?;
    let needs_review = obj
        .get("needs_review")
        .and_then(Value::as_bool)
        .ok_or("missing needs_review field")?;

    let source_id = get_str("source_id");
    let source_kind = get_str("source_kind");
    let source_priority = obj.get("source_priority").and_then(Value::as_i64);

    let search_text = build_search_text(&name, obj);

    let national_dex_number = obj.get("national_dex_number").and_then(Value::as_i64);
    let mechanical_completeness = get_str("mechanical_completeness");
    let enabled_for_character_creation =
        obj.get("enabled_for_character_creation").and_then(Value::as_bool);

    Ok(DefinitionFields {
        definition_version_id,
        logical_id,
        content_pack_id,
        source_id,
        source_kind,
        source_priority,
        name,
        needs_review,
        search_text,
        raw_json: serde_json::to_string(value).map_err(|e| e.to_string())?,
        national_dex_number,
        mechanical_completeness,
        enabled_for_character_creation,
    })
}

fn build_search_text(name: &str, obj: &serde_json::Map<String, Value>) -> String {
    let mut parts = vec![name.to_string()];
    for key in [
        "raw_text",
        "effect_text",
        "special_text",
        "description",
        "activation_text",
        "prerequisites_text",
    ] {
        if let Some(text) = obj.get(key).and_then(Value::as_str) {
            if !text.is_empty() {
                parts.push(text.to_string());
            }
        }
    }
    parts.join("\n")
}

pub(crate) fn upsert_definition(
    tx: &rusqlite::Transaction,
    kind: ContentKind,
    fields: &DefinitionFields,
    now: &str,
) -> Result<(), ImportError> {
    let table = kind.table_name();

    if kind == ContentKind::Species {
        tx.execute(
            &format!(
                "INSERT INTO {table} (definition_version_id, logical_id, content_pack_id, source_id, source_kind, source_priority, name, needs_review, enabled, data_json, search_text, updated_at, national_dex_number, mechanical_completeness, enabled_for_character_creation)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?10, ?11, ?12, ?13, ?14)
                 ON CONFLICT(definition_version_id) DO UPDATE SET
                    logical_id = excluded.logical_id,
                    content_pack_id = excluded.content_pack_id,
                    source_id = excluded.source_id,
                    source_kind = excluded.source_kind,
                    source_priority = excluded.source_priority,
                    name = excluded.name,
                    needs_review = excluded.needs_review,
                    data_json = excluded.data_json,
                    search_text = excluded.search_text,
                    updated_at = excluded.updated_at,
                    national_dex_number = excluded.national_dex_number,
                    mechanical_completeness = excluded.mechanical_completeness,
                    enabled_for_character_creation = excluded.enabled_for_character_creation"
            ),
            params![
                fields.definition_version_id,
                fields.logical_id,
                fields.content_pack_id,
                fields.source_id,
                fields.source_kind,
                fields.source_priority,
                fields.name,
                fields.needs_review,
                fields.raw_json,
                fields.search_text,
                now,
                fields.national_dex_number,
                fields.mechanical_completeness,
                fields.enabled_for_character_creation,
            ],
        )?;
    } else {
        tx.execute(
            &format!(
                "INSERT INTO {table} (definition_version_id, logical_id, content_pack_id, source_id, source_kind, source_priority, name, needs_review, enabled, data_json, search_text, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?10, ?11)
                 ON CONFLICT(definition_version_id) DO UPDATE SET
                    logical_id = excluded.logical_id,
                    content_pack_id = excluded.content_pack_id,
                    source_id = excluded.source_id,
                    source_kind = excluded.source_kind,
                    source_priority = excluded.source_priority,
                    name = excluded.name,
                    needs_review = excluded.needs_review,
                    data_json = excluded.data_json,
                    search_text = excluded.search_text,
                    updated_at = excluded.updated_at"
            ),
            params![
                fields.definition_version_id,
                fields.logical_id,
                fields.content_pack_id,
                fields.source_id,
                fields.source_kind,
                fields.source_priority,
                fields.name,
                fields.needs_review,
                fields.raw_json,
                fields.search_text,
                now,
            ],
        )?;
    }

    // Rebuild this row's FTS entry (delete+insert keeps a plain FTS5 table
    // consistent without needing external-content triggers).
    tx.execute(
        "DELETE FROM content_search_index WHERE definition_version_id = ?1",
        params![fields.definition_version_id],
    )?;
    tx.execute(
        "INSERT INTO content_search_index (kind, definition_version_id, logical_id, content_pack_id, name, search_text)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            kind.kind_slug(),
            fields.definition_version_id,
            fields.logical_id,
            fields.content_pack_id,
            fields.name,
            fields.search_text,
        ],
    )?;

    Ok(())
}
