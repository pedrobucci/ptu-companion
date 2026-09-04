//! Integration tests for the `.ptucp` importer against the real handoff
//! packs, plus synthetic malicious/invalid packs, per technical spec
//! section 39 (final acceptance gates) and the T02 acceptance criteria:
//! all 18 packs import, invalid/malicious packs fail without partial
//! writes, reimport is idempotent, profiles are untouched, integrity_check
//! passes.

use std::io::{Cursor, Write};
use std::path::{Path, PathBuf};

use rusqlite::Connection;
use sha2::{Digest, Sha256};
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use ptu_domain::content::{
    import::{import_all_from_directory, import_pack},
    repository, ContentKind,
};
use ptu_domain::persistence::{
    definitions::open_and_migrate_definitions, profiles::open_and_migrate_profiles,
};

fn real_content_packs_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../content_packs")
}

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("ptu-domain-test-{name}-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hasher.finalize().iter().map(|b| format!("{b:02x}")).collect()
}

fn zip_of(entries: &[(&str, &[u8])]) -> Vec<u8> {
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default();
    for (name, bytes) in entries {
        writer.start_file(*name, options).unwrap();
        writer.write_all(bytes).unwrap();
    }
    writer.finish().unwrap().into_inner()
}

/// Builds a minimal, otherwise-valid single-move `.ptucp` pack so negative
/// tests can mutate exactly one thing at a time.
struct MinimalPack {
    manifest: serde_json::Value,
    moves_ndjson: Vec<u8>,
}

fn minimal_valid_pack() -> MinimalPack {
    let record = serde_json::json!({
        "id": "test-move",
        "name": "Test Move",
        "source_id": "test",
        "source_kind": "test_kind",
        "source_priority": 100,
        "raw_text": "Some raw text",
        "needs_review": false,
        "logical_id": "test-move",
        "definition_version_id": "moves:test-move@test",
        "content_pack_id": "test-pack"
    });
    let moves_ndjson = format!("{}\n", serde_json::to_string(&record).unwrap()).into_bytes();
    let hash = sha256_hex(&moves_ndjson);

    let manifest = serde_json::json!({
        "format": "ptu-content-pack",
        "format_version": 1,
        "id": "test-pack",
        "name": "Test Pack",
        "version": "1.0.0",
        "priority": 999,
        "dependencies": [],
        "content_counts": {"moves": 1},
        "files": {
            "content/moves.ndjson": {
                "sha256": hash,
                "bytes": moves_ndjson.len(),
                "records": 1,
                "media_type": "application/x-ndjson"
            }
        }
    });

    MinimalPack {
        manifest,
        moves_ndjson,
    }
}

fn pack_zip(pack: &MinimalPack) -> Vec<u8> {
    let manifest_bytes = serde_json::to_vec_pretty(&pack.manifest).unwrap();
    zip_of(&[
        ("manifest.json", manifest_bytes.as_slice()),
        ("content/moves.ndjson", pack.moves_ndjson.as_slice()),
    ])
}

fn assert_no_partial_rows(conn: &Connection) {
    assert_eq!(repository::count_packs(conn).unwrap(), 0);
    assert_eq!(repository::count_definitions(conn, ContentKind::Move).unwrap(), 0);
}

#[test]
fn imports_all_18_real_packs_and_passes_integrity_check() {
    let dir = temp_dir("real-packs");
    let db_path = dir.join("definitions.sqlite");
    let mut conn = open_and_migrate_definitions(&db_path).unwrap();

    let packs_dir = real_content_packs_dir();
    let pack_files: Vec<_> = std::fs::read_dir(&packs_dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("ptucp"))
        .collect();
    assert_eq!(pack_files.len(), 18, "expected 18 .ptucp packs in {packs_dir:?}");

    let results = import_all_from_directory(&mut conn, &packs_dir).unwrap();
    assert_eq!(results.len(), 18);
    for (file_name, result) in &results {
        assert!(result.is_ok(), "pack {file_name} failed to import: {:?}", result.as_ref().err());
    }

    assert_eq!(repository::count_packs(&conn).unwrap(), 18);
    assert_eq!(repository::integrity_check(&conn).unwrap(), "ok");

    // Spot-check a known record survived the round trip.
    let absorb = repository::get_definition_by_version_id(&conn, ContentKind::Move, "moves:absorb@core")
        .unwrap();
    assert!(absorb.is_some());

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn reimport_of_same_pack_is_idempotent() {
    let dir = temp_dir("reimport");
    let db_path = dir.join("definitions.sqlite");
    let mut conn = open_and_migrate_definitions(&db_path).unwrap();

    let core_pack_path = real_content_packs_dir().join("ptu-core-1.05.ptucp");
    let bytes = std::fs::read(&core_pack_path).unwrap();

    let first = import_pack(&mut conn, &bytes).unwrap();
    let moves_after_first = repository::count_definitions(&conn, ContentKind::Move).unwrap();
    let packs_after_first = repository::count_packs(&conn).unwrap();

    let second = import_pack(&mut conn, &bytes).unwrap();
    let moves_after_second = repository::count_definitions(&conn, ContentKind::Move).unwrap();
    let packs_after_second = repository::count_packs(&conn).unwrap();

    assert_eq!(first.definitions_imported, second.definitions_imported);
    assert_eq!(moves_after_first, moves_after_second);
    assert_eq!(packs_after_first, packs_after_second);
    assert_eq!(packs_after_first, 1);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn content_import_never_touches_profiles_database() {
    let dir = temp_dir("profile-isolation");
    let profiles_path = dir.join("profiles.sqlite");
    let definitions_path = dir.join("definitions.sqlite");

    let profiles_conn = open_and_migrate_profiles(&profiles_path).unwrap();
    drop(profiles_conn);
    let before = std::fs::read(&profiles_path).unwrap();

    let mut definitions_conn = open_and_migrate_definitions(&definitions_path).unwrap();
    let core_pack_path = real_content_packs_dir().join("ptu-core-1.05.ptucp");
    let bytes = std::fs::read(&core_pack_path).unwrap();
    import_pack(&mut definitions_conn, &bytes).unwrap();

    let after = std::fs::read(&profiles_path).unwrap();
    assert_eq!(before, after, "profiles.sqlite must be byte-for-byte unchanged by content import");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn rejects_zip_slip_entry_without_partial_writes() {
    let dir = temp_dir("zip-slip");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();

    let pack = minimal_valid_pack();
    let manifest_bytes = serde_json::to_vec_pretty(&pack.manifest).unwrap();
    let bytes = zip_of(&[
        ("manifest.json", manifest_bytes.as_slice()),
        ("content/moves.ndjson", pack.moves_ndjson.as_slice()),
        ("../../evil.txt", b"malicious"),
    ]);

    let result = import_pack(&mut conn, &bytes);
    assert!(result.is_err());
    assert!(matches!(
        result.unwrap_err(),
        ptu_domain::error::ImportError::UnsafeArchivePath(_)
    ));
    assert_no_partial_rows(&conn);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn rejects_hash_mismatch_without_partial_writes() {
    let dir = temp_dir("hash-mismatch");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();

    let mut pack = minimal_valid_pack();
    pack.manifest["files"]["content/moves.ndjson"]["sha256"] =
        serde_json::Value::String("0".repeat(64));
    let bytes = pack_zip(&pack);

    let result = import_pack(&mut conn, &bytes);
    assert!(matches!(
        result.unwrap_err(),
        ptu_domain::error::ImportError::HashMismatch { .. }
    ));
    assert_no_partial_rows(&conn);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn rejects_unsupported_format_version_without_partial_writes() {
    let dir = temp_dir("format-version");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();

    let mut pack = minimal_valid_pack();
    pack.manifest["format_version"] = serde_json::Value::from(2);
    let bytes = pack_zip(&pack);

    let result = import_pack(&mut conn, &bytes);
    assert!(result.is_err());
    assert_no_partial_rows(&conn);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn rejects_missing_required_dependency_without_partial_writes() {
    let dir = temp_dir("missing-dependency");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();

    let mut pack = minimal_valid_pack();
    pack.manifest["dependencies"] =
        serde_json::json!([{"id": "nonexistent-pack", "required": true}]);
    let bytes = pack_zip(&pack);

    let result = import_pack(&mut conn, &bytes);
    assert!(matches!(
        result.unwrap_err(),
        ptu_domain::error::ImportError::MissingDependency(id) if id == "nonexistent-pack"
    ));
    assert_no_partial_rows(&conn);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn rejects_malformed_json_line_without_partial_writes() {
    let dir = temp_dir("malformed-json");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();

    let moves_ndjson = b"{not valid json\n".to_vec();
    let hash = sha256_hex(&moves_ndjson);
    let manifest = serde_json::json!({
        "format": "ptu-content-pack",
        "format_version": 1,
        "id": "test-pack",
        "name": "Test Pack",
        "version": "1.0.0",
        "priority": 999,
        "dependencies": [],
        "content_counts": {"moves": 1},
        "files": {
            "content/moves.ndjson": {
                "sha256": hash,
                "bytes": moves_ndjson.len(),
                "records": 1,
                "media_type": "application/x-ndjson"
            }
        }
    });
    let manifest_bytes = serde_json::to_vec_pretty(&manifest).unwrap();
    let bytes = zip_of(&[
        ("manifest.json", manifest_bytes.as_slice()),
        ("content/moves.ndjson", moves_ndjson.as_slice()),
    ]);

    let result = import_pack(&mut conn, &bytes);
    assert!(matches!(
        result.unwrap_err(),
        ptu_domain::error::ImportError::RecordParse { .. }
    ));
    assert_no_partial_rows(&conn);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn rejects_record_count_mismatch_without_partial_writes() {
    let dir = temp_dir("count-mismatch");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();

    let mut pack = minimal_valid_pack();
    pack.manifest["files"]["content/moves.ndjson"]["records"] = serde_json::Value::from(2);
    // sha256 must still match the (unchanged) bytes for the count check to be reached.
    let bytes = pack_zip(&pack);

    let result = import_pack(&mut conn, &bytes);
    assert!(matches!(
        result.unwrap_err(),
        ptu_domain::error::ImportError::RecordCountMismatch { .. }
    ));
    assert_no_partial_rows(&conn);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn rejects_record_claiming_a_different_pack_id() {
    let dir = temp_dir("pack-id-mismatch");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();

    let record = serde_json::json!({
        "id": "test-move",
        "name": "Test Move",
        "needs_review": false,
        "logical_id": "test-move",
        "definition_version_id": "moves:test-move@test",
        "content_pack_id": "some-other-pack"
    });
    let moves_ndjson = format!("{}\n", serde_json::to_string(&record).unwrap()).into_bytes();
    let hash = sha256_hex(&moves_ndjson);
    let manifest = serde_json::json!({
        "format": "ptu-content-pack",
        "format_version": 1,
        "id": "test-pack",
        "name": "Test Pack",
        "version": "1.0.0",
        "priority": 999,
        "dependencies": [],
        "content_counts": {"moves": 1},
        "files": {
            "content/moves.ndjson": {
                "sha256": hash,
                "bytes": moves_ndjson.len(),
                "records": 1,
                "media_type": "application/x-ndjson"
            }
        }
    });
    let manifest_bytes = serde_json::to_vec_pretty(&manifest).unwrap();
    let bytes = zip_of(&[
        ("manifest.json", manifest_bytes.as_slice()),
        ("content/moves.ndjson", moves_ndjson.as_slice()),
    ]);

    let result = import_pack(&mut conn, &bytes);
    assert!(matches!(
        result.unwrap_err(),
        ptu_domain::error::ImportError::RecordPackMismatch { .. }
    ));
    assert_no_partial_rows(&conn);

    let _ = std::fs::remove_dir_all(&dir);
}
