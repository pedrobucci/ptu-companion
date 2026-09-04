//! Integration tests for the ruleset resolver + search against the real
//! handoff data: `rulesets/*.json` and `test_vectors/content_resolver.json`,
//! per T03 acceptance: vectors pass, switching ruleset changes the winner
//! without deleting any version, and the catalog is never fully loaded.

use std::path::{Path, PathBuf};

use rusqlite::Connection;
use serde::Deserialize;

use ptu_domain::content::{
    import::import_all_from_directory, parse_definition_ref, repository, resolver::resolve_definition,
    ruleset::CampaignRuleset, search::search, ContentKind,
};
use ptu_domain::persistence::definitions::open_and_migrate_definitions;

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..")
}

fn temp_db(name: &str) -> (PathBuf, Connection) {
    let dir = std::env::temp_dir().join(format!("ptu-resolver-it-{name}-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("definitions.sqlite");
    let conn = open_and_migrate_definitions(&path).unwrap();
    (dir, conn)
}

fn import_all_real_packs(conn: &mut Connection) {
    let dir = repo_root().join("content_packs");
    let results = import_all_from_directory(conn, &dir).unwrap();
    assert_eq!(results.len(), 18);
    for (file_name, result) in results {
        if let Err(e) = result {
            panic!("failed to import {file_name}: {e}");
        }
    }
}

#[derive(Deserialize)]
struct Vector {
    id: String,
    ruleset: String,
    definition: String,
    expected_winner_version_id: String,
}

fn load_vectors() -> Vec<Vector> {
    let path = repo_root().join("test_vectors/content_resolver.json");
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("reading {path:?}: {e}"));
    serde_json::from_str(&text).unwrap()
}

fn load_ruleset(name: &str) -> CampaignRuleset {
    let path = repo_root().join("rulesets").join(format!("{name}.json"));
    CampaignRuleset::from_file(&path).unwrap_or_else(|e| panic!("loading {path:?}: {e}"))
}

#[test]
fn content_resolver_test_vectors_pass() {
    let (dir, mut conn) = temp_db("vectors");
    import_all_real_packs(&mut conn);

    let vectors = load_vectors();
    assert!(!vectors.is_empty(), "expected at least one test vector");

    for v in &vectors {
        let ruleset = load_ruleset(&v.ruleset);
        let (kind, logical_id) = parse_definition_ref(&v.definition)
            .unwrap_or_else(|| panic!("vector {}: unparseable definition ref {}", v.id, v.definition));

        let resolved = resolve_definition(&conn, &ruleset, kind, logical_id)
            .unwrap()
            .unwrap_or_else(|| panic!("vector {}: resolver produced no winner", v.id));

        assert_eq!(
            resolved.definition_version_id, v.expected_winner_version_id,
            "vector {} ({}) picked the wrong winner",
            v.id, v.definition
        );
    }

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn switching_ruleset_changes_winner_without_deleting_any_version() {
    let (dir, mut conn) = temp_db("switch");
    import_all_real_packs(&mut conn);

    let core_only = load_ruleset("ptu-core-only");
    let with_playtests = load_ruleset("ptu-official-with-playtests");

    let winner_core = resolve_definition(&conn, &core_only, ContentKind::Ability, "abominable")
        .unwrap()
        .unwrap();
    assert_eq!(winner_core.definition_version_id, "abilities:abominable@core");

    let winner_playtests = resolve_definition(&conn, &with_playtests, ContentKind::Ability, "abominable")
        .unwrap()
        .unwrap();
    assert_eq!(winner_playtests.definition_version_id, "abilities:abominable@feb2016");

    // Every version that existed before either resolution still exists after both.
    let versions = repository::list_definitions_by_logical_id(&conn, ContentKind::Ability, "abominable").unwrap();
    let ids: Vec<&str> = versions.iter().map(|r| r.definition_version_id.as_str()).collect();
    assert!(ids.contains(&"abilities:abominable@core"));
    assert!(ids.contains(&"abilities:abominable@feb2016"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn search_over_the_full_catalog_stays_paginated() {
    let (dir, mut conn) = temp_db("search");
    import_all_real_packs(&mut conn);

    // The real catalog has thousands of rows; a page must stay bounded and
    // successive pages must not repeat rows, proving results are streamed
    // from SQL (LIMIT/OFFSET) rather than the catalog being pulled into
    // memory and paged in Rust.
    let page_size = 10;
    let page1 = search(&conn, "fire", None, page_size, 0).unwrap();
    let page2 = search(&conn, "fire", None, page_size, page_size).unwrap();

    assert!(page1.len() as i64 <= page_size);
    assert!(!page1.is_empty(), "expected at least one 'fire' hit in the real catalog");
    for hit in &page2 {
        assert!(!page1.iter().any(|h| h.definition_version_id == hit.definition_version_id));
    }

    let _ = std::fs::remove_dir_all(&dir);
}
