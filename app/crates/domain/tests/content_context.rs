//! T13E02 integration tests for the five `content::context` endpoints
//! against the real shipped `.ptucp` packs and `rulesets/*.json` files —
//! the same artifacts the running app actually ships, not hand-built
//! fixtures, per the plan's "Use real shipped packs + isolated SQLite."
//!
//! T13E02-R1: extended with regression coverage for the four mandatory
//! findings — F1 (browse honors `expected_revision`), F2 (nonempty-query
//! pagination has no silent-truncation ceiling), F3 (unknown-preset backup
//! restore warns explicitly — see `commands.rs`/no domain test needed
//! here, covered by `evaluate_restored_ruleset`'s own unit tests in
//! `context.rs`), F4 (`compute_revision` reflects real installed/authored
//! content, not just the import-time pack manifest).

use std::path::{Path, PathBuf};

use ptu_domain::content::context::{
    browse_selectable_content, compute_pack_statuses, compute_revision, get_content_context, get_definition_version, refresh_bundled_content,
    validate_refresh_request, validate_set_active_ruleset, BrowseResult, ContentApiError, PackStatus,
};
use ptu_domain::content::import::import_pack_file;
use ptu_domain::content::ruleset::{load_active_preset_selection, load_preset, save_active_preset_selection, CampaignRuleset, DEFAULT_PRESET_ID, PRESET_IDS};
use ptu_domain::content::ContentKind;
use ptu_domain::persistence::definitions::open_and_migrate_definitions;
use rusqlite::Connection;

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..")
}
fn rulesets_dir() -> PathBuf {
    repo_root().join("rulesets")
}
fn content_packs_dir() -> PathBuf {
    repo_root().join("content_packs")
}

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("ptu-content-context-{name}-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn core_only_ruleset() -> CampaignRuleset {
    load_preset(&rulesets_dir(), "ptu-core-only").unwrap().unwrap()
}
fn core_with_pokedex_ruleset() -> CampaignRuleset {
    load_preset(&rulesets_dir(), "ptu-core-with-pokedex").unwrap().unwrap()
}

/// Current revision, computed fresh — the same value `browse_selectable_content`
/// itself now checks `expected_revision` against (F1).
fn current_revision(conn: &Connection, ruleset: &CampaignRuleset) -> String {
    get_content_context(conn, ruleset, &rulesets_dir(), &content_packs_dir()).unwrap().revision
}

/// Test helper: browses with a freshly-computed correct `expected_revision`
/// (the "happy path" every existing F1-aware test wants) so call sites
/// below don't all have to repeat the two-step context-then-browse dance.
fn browse(conn: &Connection, ruleset: &CampaignRuleset, kind: &str, query: &str, limit: i64, offset: i64) -> Result<BrowseResult, ContentApiError> {
    let revision = current_revision(conn, ruleset);
    browse_selectable_content(conn, ruleset, &content_packs_dir(), &revision, kind, query, limit, offset)
}

/// The exact probe E01/the Reviewer already reproduced independently:
/// Core-only cannot resolve Sableye (no species.ndjson in that pack at
/// all); Core+Gen8ish can. `browse_selectable_content` must show the same
/// story through the new endpoint, not just the raw resolver.
#[test]
fn browse_selectable_content_reflects_the_e01_root_cause_and_its_fix() {
    let dir = temp_dir("root-cause");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    import_pack_file(&mut conn, &content_packs_dir().join("ptu-core-1.05.ptucp")).unwrap();
    import_pack_file(&mut conn, &content_packs_dir().join("ptu-gen8ish-pokedex.ptucp")).unwrap();

    let core_only = core_only_ruleset();
    let core_result = browse(&conn, &core_only, "species", "sableye", 10, 0).unwrap();
    assert!(core_result.items.is_empty(), "Core-only has no species.ndjson at all — Sableye must not resolve under it");

    let with_dex = core_with_pokedex_ruleset();
    let dex_result = browse(&conn, &with_dex, "species", "sableye", 10, 0).unwrap();
    assert_eq!(dex_result.items.len(), 1);
    assert_eq!(dex_result.items[0].logical_id, "sableye");
    assert_eq!(dex_result.items[0].content_pack_id, "ptu-gen8ish-pokedex");
    assert!(dex_result.items[0].selectable, "Sableye is a complete, creation-eligible Gen8ish record");
    assert!(dex_result.items[0].unavailable_reason.is_none());

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn browse_empty_query_lists_species_in_stable_paginated_order() {
    let dir = temp_dir("empty-query");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    import_pack_file(&mut conn, &content_packs_dir().join("ptu-core-1.05.ptucp")).unwrap();
    import_pack_file(&mut conn, &content_packs_dir().join("ptu-gen8ish-pokedex.ptucp")).unwrap();
    let ruleset = core_with_pokedex_ruleset();

    let revision = current_revision(&conn, &ruleset);
    let page1 = browse_selectable_content(&conn, &ruleset, &content_packs_dir(), &revision, "species", "", 10, 0).unwrap();
    let page2 = browse_selectable_content(&conn, &ruleset, &content_packs_dir(), &revision, "species", "", 10, 10).unwrap();
    assert_eq!(page1.items.len(), 10);
    assert_eq!(page2.items.len(), 10);
    assert!(page1.has_more);
    let page1_ids: std::collections::HashSet<_> = page1.items.iter().map(|i| i.logical_id.clone()).collect();
    for item in &page2.items {
        assert!(!page1_ids.contains(&item.logical_id), "pages must not repeat rows");
    }
    // Same call twice must be byte-identical (stable order), not
    // incidentally re-shuffled by SQLite.
    let page1_again = browse_selectable_content(&conn, &ruleset, &content_packs_dir(), &revision, "species", "", 10, 0).unwrap();
    let ids1: Vec<_> = page1.items.iter().map(|i| i.logical_id.clone()).collect();
    let ids1_again: Vec<_> = page1_again.items.iter().map(|i| i.logical_id.clone()).collect();
    assert_eq!(ids1, ids1_again);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn browse_rejects_invalid_limit_and_offset_and_unknown_kind() {
    let dir = temp_dir("invalid-browse");
    let conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    let ruleset = core_only_ruleset();

    let bad_limit = browse(&conn, &ruleset, "species", "", 0, 0);
    assert!(matches!(bad_limit, Err(ContentApiError { ref code, .. }) if code == "invalid_input"));

    let bad_limit_high = browse(&conn, &ruleset, "species", "", 101, 0);
    assert!(matches!(bad_limit_high, Err(ContentApiError { ref code, .. }) if code == "invalid_input"));

    let bad_offset = browse(&conn, &ruleset, "species", "", 10, -1);
    assert!(matches!(bad_offset, Err(ContentApiError { ref code, .. }) if code == "invalid_input"));

    let bad_kind = browse(&conn, &ruleset, "not-a-real-kind", "", 10, 0);
    assert!(matches!(bad_kind, Err(ContentApiError { ref code, ref field, .. }) if code == "invalid_input" && field.as_deref() == Some("kind")));

    let _ = std::fs::remove_dir_all(&dir);
}

/// T13E02-R1 F1: a stale `expected_revision` must reject, not silently
/// serve a possibly-inconsistent page — including the exact scenario the
/// Reviewer named: page 1 computed, content mutates (a real
/// `refresh_bundled_content`), page 2 requested with the now-stale
/// revision from page 1.
#[test]
fn browse_rejects_a_stale_expected_revision_including_mid_navigation() {
    let dir = temp_dir("browse-stale");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    import_pack_file(&mut conn, &content_packs_dir().join("ptu-core-1.05.ptucp")).unwrap();
    let ruleset = core_only_ruleset();

    let revision = current_revision(&conn, &ruleset);
    let stale = browse_selectable_content(&conn, &ruleset, &content_packs_dir(), "not-the-real-revision", "move", "", 10, 0);
    assert!(matches!(stale, Err(ContentApiError { ref code, .. }) if code == "stale_revision"));

    // Page 1 succeeds with the correct revision...
    let page1 = browse_selectable_content(&conn, &ruleset, &content_packs_dir(), &revision, "move", "", 10, 0).unwrap();
    assert_eq!(page1.revision, revision);

    // ...content changes (a real refresh importing the Gen8ish pack, which
    // changes `packs`/thus the revision)...
    refresh_bundled_content(&mut conn, &content_packs_dir(), &rulesets_dir(), &ruleset).unwrap();

    // ...and page 2, requested with page 1's now-stale revision, must
    // reject rather than silently mix two different catalog states.
    let page2_with_stale_revision = browse_selectable_content(&conn, &ruleset, &content_packs_dir(), &revision, "move", "", 10, 10);
    assert!(matches!(page2_with_stale_revision, Err(ContentApiError { ref code, .. }) if code == "stale_revision"));

    let _ = std::fs::remove_dir_all(&dir);
}

/// T13E02-R1 F2: a nonempty query matching well over 2000 raw rows must
/// still return every eligible logical id, reachable, with no duplicates,
/// stable ordering, and `has_more` correct all the way to the last page —
/// not the old fixed 2000-row probe ceiling's `has_more:false` false
/// negative. Synthesizes 2500 real, independently-resolvable definitions
/// directly (bypassing the importer, which would take much longer for a
/// volume test like this) sharing one search term.
#[test]
fn browse_nonempty_query_has_no_silent_truncation_ceiling_above_2000_hits() {
    let dir = temp_dir("volume");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();

    const TOTAL: usize = 2500;
    let now = "2026-01-01T00:00:00Z";
    conn.execute(
        "INSERT INTO content_packs (id, name, version, priority, kind, format_version, dependencies_json, manifest_json, imported_at, updated_at)
         VALUES ('volume-pack','Volume Test Pack','1.0.0',999,NULL,1,'[]','{}',?1,?1)",
        [now],
    )
    .unwrap();
    {
        let tx = conn.transaction().unwrap();
        for i in 0..TOTAL {
            let definition_version_id = format!("moves:widget-{i:04}@volume-pack");
            let logical_id = format!("widget-{i:04}");
            let name = format!("Widget Move {i:04}");
            let data_json = serde_json::json!({"definition_version_id": definition_version_id, "logical_id": logical_id, "name": name}).to_string();
            tx.execute(
                "INSERT INTO moves (definition_version_id, logical_id, content_pack_id, source_id, source_kind, source_priority, name, needs_review, enabled, data_json, search_text, updated_at)
                 VALUES (?1, ?2, 'volume-pack', NULL, NULL, NULL, ?3, 0, 1, ?4, ?3, ?5)",
                rusqlite::params![definition_version_id, logical_id, name, data_json, now],
            )
            .unwrap();
            tx.execute(
                "INSERT INTO content_search_index (kind, definition_version_id, logical_id, content_pack_id, name, search_text)
                 VALUES ('move', ?1, ?2, 'volume-pack', ?3, ?3)",
                rusqlite::params![definition_version_id, logical_id, name],
            )
            .unwrap();
        }
        tx.commit().unwrap();
    }

    let ruleset = CampaignRuleset {
        id: "volume-test-ruleset".into(),
        name: "Volume Test Ruleset".into(),
        version: "1.0.0".into(),
        description: None,
        packs: vec![ptu_domain::content::ruleset::RulesetPackRef { id: "volume-pack".into(), enabled: true, priority: 999 }],
        version_pins: Default::default(),
        gm_overrides_enabled: true,
    };

    // Walk every page with a small page size, collecting every id reached.
    let mut seen: Vec<String> = Vec::new();
    let mut offset = 0i64;
    let page_size = 100i64;
    loop {
        let page = browse(&conn, &ruleset, "move", "widget", page_size, offset).unwrap();
        for item in &page.items {
            seen.push(item.logical_id.clone());
        }
        if !page.has_more {
            assert!(page.items.len() <= page_size as usize);
            break;
        }
        assert_eq!(page.items.len(), page_size as usize, "a page reporting has_more=true must be full");
        offset += page_size;
        assert!(offset <= TOTAL as i64 + page_size, "pagination did not terminate — has_more likely stuck true");
    }

    assert_eq!(seen.len(), TOTAL, "every one of the {TOTAL} eligible logical ids must be reachable across pages, not silently capped at the old 2000-row probe");
    let unique: std::collections::HashSet<&String> = seen.iter().collect();
    assert_eq!(unique.len(), TOTAL, "no duplicates across pages");

    // Stable ordering: walking again from scratch must reach the exact
    // same sequence.
    let replay = browse(&conn, &ruleset, "move", "widget", page_size, 0).unwrap();
    let first_page_again: Vec<&str> = replay.items.iter().map(|i| i.logical_id.as_str()).collect();
    assert_eq!(&seen[..page_size as usize], first_page_again.as_slice());

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn incomplete_stub_species_are_browsable_but_not_selectable() {
    let dir = temp_dir("incomplete-stub");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    import_pack_file(&mut conn, &content_packs_dir().join("ptu-core-1.05.ptucp")).unwrap();
    import_pack_file(&mut conn, &content_packs_dir().join("pokemon-current-catalog-2026-09.ptucp")).unwrap();

    // The 2026-09 catalog is a display-stub pack (E01: "zero enabled for
    // creation, zero with six base stats"); build a ruleset that enables
    // it so its stubs are reachable at all under resolution.
    let ruleset = ptu_domain::content::ruleset::CampaignRuleset {
        id: "test-stub-ruleset".into(),
        name: "Test Stub Ruleset".into(),
        version: "1.0.0".into(),
        description: None,
        packs: vec![
            ptu_domain::content::ruleset::RulesetPackRef { id: "ptu-core-1.05".into(), enabled: true, priority: 100 },
            ptu_domain::content::ruleset::RulesetPackRef { id: "pokemon-current-catalog-2026-09".into(), enabled: true, priority: 150 },
        ],
        version_pins: Default::default(),
        gm_overrides_enabled: true,
    };

    let result = browse(&conn, &ruleset, "species", "", 5, 0).unwrap();
    assert!(!result.items.is_empty(), "stub species must still be browsable");
    for item in &result.items {
        assert!(!item.selectable, "a display stub with no complete PTU definition must never be selectable");
        assert!(item.unavailable_reason.is_some());
        assert_eq!(item.unavailable_reason.as_ref().unwrap().code, "species_incomplete");
    }

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn get_definition_version_reads_exact_pinned_version_not_the_active_winner() {
    let dir = temp_dir("exact-detail");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    import_pack_file(&mut conn, &content_packs_dir().join("ptu-core-1.05.ptucp")).unwrap();

    let exact = get_definition_version(&conn, ContentKind::Move, "moves:crunch@core").unwrap();
    assert_eq!(exact.reason, "pinned");
    assert_eq!(exact.definition_version_id, "moves:crunch@core");
    assert_eq!(exact.kind, "move");

    let missing = get_definition_version(&conn, ContentKind::Move, "moves:does-not-exist@nowhere");
    assert!(matches!(missing, Err(ContentApiError { ref code, .. }) if code == "not_found"));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn get_content_context_lists_real_presets_and_ready_packs() {
    let dir = temp_dir("context");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    import_pack_file(&mut conn, &content_packs_dir().join("ptu-core-1.05.ptucp")).unwrap();

    let ruleset = core_only_ruleset();
    let context = get_content_context(&conn, &ruleset, &rulesets_dir(), &content_packs_dir()).unwrap();

    assert_eq!(context.presets.len(), PRESET_IDS.len(), "every bundled preset file must be listed");
    assert!(context.presets.iter().any(|p| p.id == "ptu-core-with-pokedex"));

    let core_pack = context.packs.iter().find(|p| p.id == "ptu-core-1.05").unwrap();
    assert_eq!(core_pack.status, PackStatus::Ready, "just-imported pack must match its own bundled copy exactly");
    assert!(context.issues.iter().all(|i| i.code != "conflict"), "no conflicts on a fresh, real install");

    // Determinism: computing the context twice without any change yields
    // the identical revision.
    let context2 = get_content_context(&conn, &ruleset, &rulesets_dir(), &content_packs_dir()).unwrap();
    assert_eq!(context.revision, context2.revision);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn revision_changes_when_ruleset_selection_changes() {
    let dir = temp_dir("revision-changes");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    import_pack_file(&mut conn, &content_packs_dir().join("ptu-core-1.05.ptucp")).unwrap();
    import_pack_file(&mut conn, &content_packs_dir().join("ptu-gen8ish-pokedex.ptucp")).unwrap();

    let packs = compute_pack_statuses(&conn, &content_packs_dir()).unwrap();
    let core_only_rev = compute_revision(&conn, &core_only_ruleset(), &packs).unwrap();
    let with_dex_rev = compute_revision(&conn, &core_with_pokedex_ruleset(), &packs).unwrap();
    assert_ne!(core_only_rev, with_dex_rev, "switching the active ruleset must change the revision");

    let _ = std::fs::remove_dir_all(&dir);
}

/// T13E02-R1 F4: an in-place authoring edit to an ALREADY-installed
/// definition must move the revision, even though it never bumps the
/// owning pack's `content_packs.manifest_json`/`version` — the exact gap
/// the Reviewer demonstrated by reading `authoring::save_definition`
/// (writes straight into the definition table, untouched by
/// `compute_pack_statuses`'s manifest-hash comparison).
#[test]
fn compute_revision_changes_on_an_authoring_edit_without_a_pack_version_bump() {
    let dir = temp_dir("authoring-revision");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    import_pack_file(&mut conn, &content_packs_dir().join("ptu-core-1.05.ptucp")).unwrap();

    ptu_domain::content::authoring::save_definition(
        &mut conn,
        "my-homebrew",
        "My Homebrew",
        200,
        ContentKind::Ability,
        &serde_json::json!({
            "id": "custom-ability", "name": "Custom Ability", "needs_review": false,
            "logical_id": "custom-ability", "definition_version_id": "abilities:custom-ability@my-homebrew",
            "content_pack_id": "my-homebrew"
        }),
    )
    .unwrap();

    let ruleset = CampaignRuleset {
        id: "authoring-test-ruleset".into(),
        name: "Authoring Test Ruleset".into(),
        version: "1.0.0".into(),
        description: None,
        packs: vec![
            ptu_domain::content::ruleset::RulesetPackRef { id: "ptu-core-1.05".into(), enabled: true, priority: 100 },
            ptu_domain::content::ruleset::RulesetPackRef { id: "my-homebrew".into(), enabled: true, priority: 200 },
        ],
        version_pins: Default::default(),
        gm_overrides_enabled: true,
    };

    let packs = compute_pack_statuses(&conn, &content_packs_dir()).unwrap();
    let before_pack_version = packs.iter().find(|p| p.id == "my-homebrew").map(|p| p.version.clone());
    let before_revision = compute_revision(&conn, &ruleset, &packs).unwrap();

    // Edit the SAME definition in place — this is the exact operation
    // `content::authoring` exists for, and it deliberately never touches
    // `content_packs.manifest_json`/`version`.
    ptu_domain::content::authoring::save_definition(
        &mut conn,
        "my-homebrew",
        "My Homebrew",
        200,
        ContentKind::Ability,
        &serde_json::json!({
            "id": "custom-ability", "name": "Custom Ability (edited)", "needs_review": false,
            "logical_id": "custom-ability", "definition_version_id": "abilities:custom-ability@my-homebrew",
            "content_pack_id": "my-homebrew"
        }),
    )
    .unwrap();

    let packs_after = compute_pack_statuses(&conn, &content_packs_dir()).unwrap();
    let after_pack_version = packs_after.iter().find(|p| p.id == "my-homebrew").map(|p| p.version.clone());
    assert_eq!(before_pack_version, after_pack_version, "authoring must not bump the pack's own version field (confirms the gap being fixed is real)");

    let after_revision = compute_revision(&conn, &ruleset, &packs_after).unwrap();
    assert_ne!(before_revision, after_revision, "an authoring edit to installed content must change the revision even without a pack version bump");

    // An unrelated read (no further edit) is stable.
    let packs_again = compute_pack_statuses(&conn, &content_packs_dir()).unwrap();
    let stable_revision = compute_revision(&conn, &ruleset, &packs_again).unwrap();
    assert_eq!(after_revision, stable_revision, "revision must not drift on a read with no intervening write");

    let _ = std::fs::remove_dir_all(&dir);
}

/// T13E02-R2 (F4 residual): the Reviewer's own demonstrated gap —
/// `content::authoring::soft_delete_definition`/`reactivate_definition`
/// mutate ONLY the `enabled` column (never `data_json`), and
/// `resolver::resolve_definition` filters on `enabled = 1` as a hard
/// eligibility gate. Before this fix, toggling `enabled` left
/// `compute_revision` completely unchanged even though what
/// `browse_selectable_content`/`resolve_definition` actually return
/// changes. This exercises the REAL authoring functions (not a raw SQL
/// UPDATE) end to end: disable -> revision moves + browse of the old
/// revision is stale + the definition stops resolving; re-enable ->
/// revision moves AGAIN (relative to the disabled state) + resolution is
/// restored; returning to the exact original state reproduces the exact
/// original revision (no ordering/timestamp-based drift).
#[test]
fn compute_revision_and_browse_reflect_a_real_enable_disable_toggle() {
    let dir = temp_dir("enable-disable-revision");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    import_pack_file(&mut conn, &content_packs_dir().join("ptu-core-1.05.ptucp")).unwrap();
    let ruleset = core_only_ruleset();

    let original_revision = current_revision(&conn, &ruleset);

    // A stale-revision browse must reject BEFORE the toggle (sanity: F1
    // still enforced) and the target must resolve/be selectable now.
    let before_result = browse(&conn, &ruleset, "move", "crunch", 10, 0).unwrap();
    assert!(before_result.items.iter().any(|i| i.definition_version_id == "moves:crunch@core"));

    ptu_domain::content::authoring::soft_delete_definition(&conn, ContentKind::Move, "moves:crunch@core").unwrap();
    let disabled_revision = current_revision(&conn, &ruleset);
    assert_ne!(original_revision, disabled_revision, "disabling a real definition via authoring must change the revision (the R2 residual gap)");

    // F1 tie-in: browsing with the now-stale (pre-disable) revision must
    // reject, not silently return a page computed against old eligibility.
    let stale_after_disable = browse_selectable_content(&conn, &ruleset, &content_packs_dir(), &original_revision, "move", "crunch", 10, 0);
    assert!(matches!(stale_after_disable, Err(ContentApiError { ref code, .. }) if code == "stale_revision"));

    // With the CURRENT (post-disable) revision, Crunch must actually be
    // gone from resolution — not merely a revision-string change with no
    // real effect.
    let after_disable_result = browse(&conn, &ruleset, "move", "crunch", 10, 0).unwrap();
    assert!(
        !after_disable_result.items.iter().any(|i| i.definition_version_id == "moves:crunch@core"),
        "a disabled definition must stop resolving, matching resolver::resolve_definition's own enabled=1 filter"
    );

    // A read with no further write is stable at the disabled revision.
    let disabled_revision_again = current_revision(&conn, &ruleset);
    assert_eq!(disabled_revision, disabled_revision_again, "revision must not drift on a read with no intervening write");

    ptu_domain::content::authoring::reactivate_definition(&conn, ContentKind::Move, "moves:crunch@core").unwrap();
    let reenabled_revision = current_revision(&conn, &ruleset);
    assert_ne!(disabled_revision, reenabled_revision, "re-enabling must change the revision relative to the disabled state");
    assert_eq!(reenabled_revision, original_revision, "returning to an identical installed state legitimately reproduces its earlier fingerprint");

    let restored_result = browse(&conn, &ruleset, "move", "crunch", 10, 0).unwrap();
    assert!(restored_result.items.iter().any(|i| i.definition_version_id == "moves:crunch@core"), "resolution must be restored after re-enabling");

    let _ = std::fs::remove_dir_all(&dir);
}

/// T13E02-R2: `needs_review` participates in the same fingerprint for the
/// same reason `enabled` does — this module's own `compute_selectability`
/// gates `selectable` on it. No authoring function currently flips it
/// independently of `data_json` (see the doc comment on
/// `pack_content_fingerprint`), so this proves the NARROWER claim that's
/// actually true today: a definition whose `needs_review` differs is
/// hashed differently, using a direct low-level column write (the only
/// way to produce that state without changing data_json, since no
/// authoring function does) — confirming the column is genuinely part of
/// the hash, not silently dropped.
#[test]
fn needs_review_participates_in_the_content_fingerprint() {
    let dir = temp_dir("needs-review-fingerprint");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    import_pack_file(&mut conn, &content_packs_dir().join("ptu-core-1.05.ptucp")).unwrap();
    let ruleset = core_only_ruleset();

    let before = current_revision(&conn, &ruleset);
    conn.execute("UPDATE moves SET needs_review = 1 WHERE definition_version_id = 'moves:crunch@core'", []).unwrap();
    let after = current_revision(&conn, &ruleset);
    assert_ne!(before, after, "a needs_review change must move the revision even though data_json/enabled are unchanged");

    conn.execute("UPDATE moves SET needs_review = 0 WHERE definition_version_id = 'moves:crunch@core'", []).unwrap();
    let restored = current_revision(&conn, &ruleset);
    assert_eq!(before, restored, "reverting needs_review reproduces the original fingerprint");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn set_active_ruleset_validation_rejects_stale_unconfirmed_and_unknown_preset() {
    let dir = temp_dir("set-ruleset");
    let conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    let ruleset = core_only_ruleset();
    let context = get_content_context(&conn, &ruleset, &rulesets_dir(), &content_packs_dir()).unwrap();

    let stale = validate_set_active_ruleset(&rulesets_dir(), &context.revision, "not-the-real-revision", "ptu-core-with-pokedex", true);
    assert!(matches!(stale, Err(ContentApiError { ref code, .. }) if code == "stale_revision"));

    let unconfirmed = validate_set_active_ruleset(&rulesets_dir(), &context.revision, &context.revision, "ptu-core-with-pokedex", false);
    assert!(matches!(unconfirmed, Err(ContentApiError { ref code, .. }) if code == "confirmation_required"));

    let unknown = validate_set_active_ruleset(&rulesets_dir(), &context.revision, &context.revision, "not-a-real-preset", true);
    assert!(matches!(unknown, Err(ContentApiError { ref code, .. }) if code == "unknown_preset"));

    let valid = validate_set_active_ruleset(&rulesets_dir(), &context.revision, &context.revision, "ptu-core-with-pokedex", true).unwrap();
    assert_eq!(valid.id, "ptu-core-with-pokedex");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn active_preset_selection_persists_atomically_and_survives_reopen() {
    let dir = temp_dir("preset-persistence");

    assert_eq!(load_active_preset_selection(&dir), None, "absent settings file falls back to default, not an error");

    save_active_preset_selection(&dir, "ptu-core-with-pokedex").unwrap();
    assert_eq!(load_active_preset_selection(&dir).as_deref(), Some("ptu-core-with-pokedex"));

    // "Reopen": nothing but the file on disk persists across calls, so
    // just reading again from the same directory IS the reopen proof.
    save_active_preset_selection(&dir, "ptu-official-supplements").unwrap();
    assert_eq!(load_active_preset_selection(&dir).as_deref(), Some("ptu-official-supplements"));

    // Tampering with the file to name an unknown preset must fall back to
    // the caller's default, never crash or silently trust an invalid id.
    std::fs::write(dir.join("active_ruleset.json"), r#"{"preset_id":"totally-unknown"}"#).unwrap();
    assert_eq!(load_active_preset_selection(&dir), None);

    assert_eq!(DEFAULT_PRESET_ID, "ptu-core-only");

    let _ = std::fs::remove_dir_all(&dir);
}

/// T13E02 acceptance: "Atualizar conteúdo não muda Trainer/inventário nem
/// substitui versão diferente sob referência antiga." Refresh against the
/// real bundled directory (identical content) must be a safe no-op; the
/// two conflict/upgrade paths are separately covered by
/// `ptucp_import.rs`'s dedicated tests.
#[test]
fn refresh_bundled_content_against_the_real_directory_is_idempotent() {
    let dir = temp_dir("refresh");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    import_pack_file(&mut conn, &content_packs_dir().join("ptu-core-1.05.ptucp")).unwrap();
    let ruleset = core_only_ruleset();

    let before = get_content_context(&conn, &ruleset, &rulesets_dir(), &content_packs_dir()).unwrap();
    validate_refresh_request(&before.revision, &before.revision, true).unwrap();

    let after = refresh_bundled_content(&mut conn, &content_packs_dir(), &rulesets_dir(), &ruleset).unwrap();
    assert_eq!(after.packs.len(), before.packs.len().max(18), "refreshing must pick up every bundled pack, not only the one already installed");
    assert!(after.issues.iter().all(|i| i.code != "conflict" && i.code != "refresh_failed"), "the real bundled directory must refresh cleanly: {:?}", after.issues);

    // A second refresh changes nothing further.
    let after2 = refresh_bundled_content(&mut conn, &content_packs_dir(), &rulesets_dir(), &ruleset).unwrap();
    assert_eq!(after.revision, after2.revision);

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn refresh_bundled_content_rejects_stale_and_unconfirmed_requests() {
    let stale = validate_refresh_request("r1", "r2", true);
    assert!(matches!(stale, Err(ContentApiError { ref code, .. }) if code == "stale_revision"));
    let unconfirmed = validate_refresh_request("r1", "r1", false);
    assert!(matches!(unconfirmed, Err(ContentApiError { ref code, .. }) if code == "confirmation_required"));
    validate_refresh_request("r1", "r1", true).unwrap();
}
