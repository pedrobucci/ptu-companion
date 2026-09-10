//! T13E02 (+ T13E02-R1 F1-F4 corrections): prints REAL serialized examples
//! for all five E01-C1 endpoints, plus the four R1 fixes, against the
//! actual shipped `.ptucp` packs and `rulesets/*.json` files — the
//! evidence behind `T13E02_SERIALIZED_EXAMPLES.md`. Run with:
//! `cargo run -p ptu-domain --example t13e02_capture_examples`.
//! Not part of the test suite; a one-off evidence-capture tool, kept in
//! the repo so the examples are reproducible rather than hand-typed.

use ptu_domain::content::context::{
    browse_selectable_content, evaluate_restored_ruleset, get_content_context, get_definition_version, refresh_bundled_content,
    validate_refresh_request, validate_set_active_ruleset,
};
use ptu_domain::content::import::import_pack_file;
use ptu_domain::content::ruleset::{load_preset, CampaignRuleset};
use ptu_domain::content::ContentKind;
use ptu_domain::persistence::definitions::open_and_migrate_definitions;
use std::path::Path;

fn main() {
    let repo_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let dir = std::env::temp_dir().join(format!("ptu-capture-examples-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    let packs_dir = repo_root.join("content_packs");
    let rulesets_dir = repo_root.join("rulesets");

    import_pack_file(&mut conn, &packs_dir.join("ptu-core-1.05.ptucp")).unwrap();
    import_pack_file(&mut conn, &packs_dir.join("ptu-gen8ish-pokedex.ptucp")).unwrap();

    let core_only = load_preset(&rulesets_dir, "ptu-core-only").unwrap().unwrap();
    let with_dex = load_preset(&rulesets_dir, "ptu-core-with-pokedex").unwrap().unwrap();

    println!("=== 1. get_content_context — success (Core-only, real install) ===");
    let ctx = get_content_context(&conn, &core_only, &rulesets_dir, &packs_dir).unwrap();
    println!("{}", serde_json::to_string_pretty(&ctx).unwrap());

    println!("\n=== 2a. set_active_ruleset — success ===");
    let valid = validate_set_active_ruleset(&rulesets_dir, &ctx.revision, &ctx.revision, "ptu-core-with-pokedex", true).unwrap();
    println!("ok -> loads ruleset id={}, packs={:?}", valid.id, valid.packs.iter().map(|p| &p.id).collect::<Vec<_>>());
    println!("\n=== 2b. set_active_ruleset — stale ===");
    let stale = validate_set_active_ruleset(&rulesets_dir, &ctx.revision, "not-the-real-revision", "ptu-core-with-pokedex", true);
    println!("{}", serde_json::to_string_pretty(&stale.unwrap_err()).unwrap());
    println!("\n=== 2c. set_active_ruleset — invalid (unknown preset) ===");
    let unknown = validate_set_active_ruleset(&rulesets_dir, &ctx.revision, &ctx.revision, "not-a-real-preset", true);
    println!("{}", serde_json::to_string_pretty(&unknown.unwrap_err()).unwrap());

    // T13E02-R1 F1: browse now checks expected_revision per the RULESET
    // actually being browsed under — each ruleset has its own current
    // revision, so each is computed freshly right before its own browse.
    let with_dex_ctx = get_content_context(&conn, &with_dex, &rulesets_dir, &packs_dir).unwrap();
    println!("\n=== 3a. browse_selectable_content — success (species \"sab\", Core+Gen8ish) ===");
    let browse_ok = browse_selectable_content(&conn, &with_dex, &packs_dir, &with_dex_ctx.revision, "species", "sab", 8, 0).unwrap();
    println!("{}", serde_json::to_string_pretty(&browse_ok).unwrap());
    println!("\n=== 3b. browse_selectable_content — success, empty result (species \"sab\", Core-only) ===");
    let browse_empty = browse_selectable_content(&conn, &core_only, &packs_dir, &ctx.revision, "species", "sab", 8, 0).unwrap();
    println!("{}", serde_json::to_string_pretty(&browse_empty).unwrap());
    println!("\n=== 3c. browse_selectable_content — invalid (limit=0) ===");
    let browse_invalid = browse_selectable_content(&conn, &core_only, &packs_dir, &ctx.revision, "species", "", 0, 0);
    println!("{}", serde_json::to_string_pretty(&browse_invalid.unwrap_err()).unwrap());
    println!("\n=== 3d. browse_selectable_content — F1 stale (wrong expected_revision) ===");
    let browse_stale = browse_selectable_content(&conn, &core_only, &packs_dir, "not-the-real-revision", "species", "", 8, 0);
    println!("{}", serde_json::to_string_pretty(&browse_stale.unwrap_err()).unwrap());

    println!("\n=== 4a. get_definition_version — success/\"legacy\" exact read ===");
    let exact = get_definition_version(&conn, ContentKind::Move, "moves:crunch@core").unwrap();
    println!("{}", serde_json::to_string_pretty(&exact).unwrap());
    println!("\n=== 4b. get_definition_version — not_found ===");
    let missing = get_definition_version(&conn, ContentKind::Move, "moves:does-not-exist@nowhere");
    println!("{}", serde_json::to_string_pretty(&missing.unwrap_err()).unwrap());

    println!("\n=== 5a. refresh_bundled_content — stale (validation) ===");
    let refresh_stale = validate_refresh_request(&ctx.revision, "wrong", true);
    println!("{}", serde_json::to_string_pretty(&refresh_stale.unwrap_err()).unwrap());
    println!("\n=== 5b. refresh_bundled_content — success (real directory, idempotent) ===");
    let refreshed = refresh_bundled_content(&mut conn, &packs_dir, &rulesets_dir, &core_only).unwrap();
    println!("packs={}, issues={}", refreshed.packs.len(), refreshed.issues.len());
    println!("{}", serde_json::to_string_pretty(&refreshed).unwrap());

    // T13E02-R1 F3: evaluate_restored_ruleset's known/unknown outcomes.
    println!("\n=== F3a. evaluate_restored_ruleset — known preset (applied) ===");
    let known = CampaignRuleset { id: "ptu-core-with-pokedex".to_string(), ..with_dex.clone() };
    println!("{:?}", evaluate_restored_ruleset(&known, "PTU 1.05 Core Only"));
    println!("\n=== F3b. evaluate_restored_ruleset — unknown preset (explicit warning, not silent) ===");
    let unknown_restored = CampaignRuleset { id: "some-custom-campaign-ruleset".to_string(), ..with_dex.clone() };
    let warning = evaluate_restored_ruleset(&unknown_restored, "PTU 1.05 Core Only");
    println!("{}", serde_json::to_string_pretty(&warning.unwrap_err()).unwrap());

    // T13E02-R1 F4: an authoring edit to installed content moves the
    // revision even though it never bumps the pack's manifest/version.
    println!("\n=== F4. compute_revision reflects an authoring edit (no pack version bump) ===");
    let before_ctx = get_content_context(&conn, &core_only, &rulesets_dir, &packs_dir).unwrap();
    ptu_domain::content::authoring::save_definition(
        &mut conn,
        "capture-example-homebrew",
        "Capture Example Homebrew",
        777,
        ContentKind::Ability,
        &serde_json::json!({
            "id": "example-ability", "name": "Example Ability", "needs_review": false,
            "logical_id": "example-ability", "definition_version_id": "abilities:example-ability@capture-example-homebrew",
            "content_pack_id": "capture-example-homebrew"
        }),
    )
    .unwrap();
    let after_ctx = get_content_context(&conn, &core_only, &rulesets_dir, &packs_dir).unwrap();
    println!("before revision: {}", before_ctx.revision);
    println!("after  revision: {}", after_ctx.revision);
    println!("changed: {}", before_ctx.revision != after_ctx.revision);

    // T13E02-R2 (F4 residual): a REAL authoring enable/disable toggle
    // (never touches data_json) must also move the revision.
    println!("\n=== F4-R2. compute_revision reflects a real enable/disable toggle (enabled column, not data_json) ===");
    let toggle_before = get_content_context(&conn, &core_only, &rulesets_dir, &packs_dir).unwrap();
    println!("before disable: {}", toggle_before.revision);
    ptu_domain::content::authoring::soft_delete_definition(&conn, ContentKind::Move, "moves:crunch@core").unwrap();
    let toggle_disabled = get_content_context(&conn, &core_only, &rulesets_dir, &packs_dir).unwrap();
    println!("after  disable: {} (changed: {})", toggle_disabled.revision, toggle_disabled.revision != toggle_before.revision);
    ptu_domain::content::authoring::reactivate_definition(&conn, ContentKind::Move, "moves:crunch@core").unwrap();
    let toggle_reenabled = get_content_context(&conn, &core_only, &rulesets_dir, &packs_dir).unwrap();
    println!(
        "after  re-enable: {} (changed vs disabled: {}, matches original: {})",
        toggle_reenabled.revision,
        toggle_reenabled.revision != toggle_disabled.revision,
        toggle_reenabled.revision == toggle_before.revision
    );

    let _ = std::fs::remove_dir_all(&dir);
}
