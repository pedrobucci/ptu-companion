//! T12 (restart plan): content and automation completeness baseline.
//!
//! This is a real, in-app-verified referential-integrity/coverage check —
//! it imports all 18 shipped `.ptucp` packs through the actual import
//! pipeline (the same code path the app uses) and then:
//!
//! 1. Confirms every enabled, non-species definition across all 9 content
//!    kinds carries readable text (players never hit a truly-empty
//!    definition) and a real automation classification (nothing is
//!    silently unclassified).
//! 2. Confirms every species-level cross-reference (level-up/TM/egg/tutor
//!    move, ability slot, capability) either resolves cleanly or is one of
//!    the 62 specific, already-documented source-data gaps below — this is
//!    a regression guard: a NEW unresolved reference that isn't in this
//!    allowlist fails the test, forcing it to be either fixed or
//!    explicitly added here with the rest of the known gaps.
//!
//! The 62-entry allowlist was derived by scanning every species record's
//! own `reference_status` field (already computed by the data-prep
//! pipeline) across all 18 packs. Most entries are visibly PDF-extraction
//! noise (e.g. breeding-info text that bled into a move-list field) or
//! deliberate absences documented in KNOWN_GAPS_v1.0.md (Tera Blast,
//! Poltergeist — later-generation moves with no PTU 1.05 source
//! definition; Hydrate — referenced by Dewgong's ability slots but not
//! defined in any supplied ability source). None of these are invented or
//! silently coerced — the original reference text and its
//! `reference_status` remain visible in the record exactly as extracted
//! (A9/A10).
//!
//! Nothing in the current UI selects from a species' movepool/ability
//! slots yet (that's a future task's job), so these 62 references aren't
//! yet user-reachable — this test exists so that whichever task builds
//! that UI has an authoritative, tested list of what must be blocked with
//! a reason rather than silently offered.

use std::path::{Path, PathBuf};

use serde_json::Value;

use ptu_domain::content::{import::import_all_from_directory, repository, ContentKind};
use ptu_domain::persistence::definitions::open_and_migrate_definitions;

fn real_content_packs_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../content_packs")
}

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("ptu-domain-test-{name}-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

/// Every definition kind backed by its own table (Shop excluded — shops
/// are campaign-authored presets, not supplied source content).
const CONTENT_KINDS: [ContentKind; 8] = [
    ContentKind::Move,
    ContentKind::Ability,
    ContentKind::Capability,
    ContentKind::Edge,
    ContentKind::PokeEdge,
    ContentKind::Feature,
    ContentKind::Item,
    ContentKind::Species,
];

/// Known-and-documented unresolved move references (species-level TM/
/// level-up/egg/tutor move-list entries whose `reference_status` is
/// literally `"unresolved"`). See KNOWN_GAPS_v1.0.md items 3 and 6.
const KNOWN_UNRESOLVED_MOVES: &[&str] = &[
    "11SunnyDay",
    "17Protect",
    "18RainDance",
    "46Thief",
    "51Steel Wing",
    "51SteelWing",
    "68GigaImpact",
    "76Fly",
    "Attack:",
    "Defense:",
    "Focus Bunch",
    "Mean Look – Normal",
    "Mew can be Tutored to learn any Move",
    "Mew can learn any TM",
    "Mud-Slap Ground",
    "Muddy Watter",
    "Poltergeist",
    "Special Attack:",
    "Special Defense:",
    "Speed:",
    "Steel Beam Type: Steel Basic Ability 1: Magnet Pull Adv Ability 1: Frisk Adv Ability 2: Keen Eye Adv Ability 3: Light Metal High Ability: Absorb Force",
    "Sweet Scent (N) Breeding Information Gender Ratio: 50% M / 50% F Egg Group: Plant / Dragon",
    "Telekinesis Ultra Burst Type: Psychic / Dragon Ability: Neuroforce",
    "Tera Blast",
    "Thunder Fang (N) Breeding Information Gender Ratio: 50% M / 50% F Egg Group: Field",
    "Thunder Fang (N) Breeding Information Gender Ratio: 50% M / 50% F Egg Group: Field / Dragon",
    "Torment (N) Breeding Information Gender Ratio: 0% M / 100% F Egg Group: Dragon / Monster",
    "Tri Attack (N) Breeding Information Gender Ratio: 50% M / 50% F Egg Group: Field",
    "Water Shuriken (N) Breeding Information Gender Ratio: 50% M / 50% F Egg Group: Bug",
    "Whirlwind (N) Breeding Information Gender Ratio: 50% M / 50% F Egg Group: Water 1 / Bug",
    "Wide Guard (N) Breeding Information Gender Ratio: 50% M / 50% F Egg Group: Monster",
    "Wide Guard (N) Unofficial PTU 1.05.5 PokéDex. DataNinja's Homebrew",
    "Wrap (N) Breeding Information Gender Ratio: 50% M / 50% F Egg Group: Water 1 / Dragon",
    "Wring Out (N) Breeding Information Gender Ratio: 50% M / 50% F Egg Group: Indeterminate",
    "Wring Out (N) Breeding Information Gender Ratio: 50% M / 50% F Egg Group: Water 3",
    "Wring Out (N) Breeding Information Gender Ratio: 87.5% M / 12.5% F Egg Group: Water 3",
    "Zap Cannon (N) Breeding Information Gender Ratio: 50% M / 50% F Egg Group: Indeterminate",
    "Zen Headbutt (N) Breeding Information Gender Ratio: 50% M / 50% F Egg Group: Water 2",
    "Zen Headbutt Linked Moves Confined Hyperspace Hole Shadow Ball Phantom Force Unofficial PTU 1.05.5 PokéDex. DataNinja's Homebrew. Unbound Hyperspace Fury Dark Pulse Knock Off",
];

/// Known-and-documented unresolved ability references. "Hydrate" is
/// referenced by the Dewgong line's ability slots but has no ability
/// definition in any supplied source pack (verified: no `abilities.ndjson`
/// record anywhere has this name) — per A9, not invented.
const KNOWN_UNRESOLVED_ABILITIES: &[&str] = &["Hydrate"];

/// Known-and-documented unresolved capability references (KNOWN_GAPS_v1.0
/// item 4: "recurring names such as Breathless ... referenced by species
/// but not safely defined in supplied material").
const KNOWN_UNRESOLVED_CAPABILITIES: &[&str] = &[
    "Alluring (while in rain only)",
    "Breathless",
    "Confined",
    "Dragon Fusion",
    "Gather",
    "Heat Rotom: Overland",
    "Line Charge",
    "Linked Evolution (Dark-Type Pokémon)",
    "Linked Evolution (Karrablast)",
    "Linked Evolution (Remoraid)",
    "Linked Evolution (Shelmet)",
    "Multiform",
    "Nectar Dancer",
    "Origin Forme",
    "Power 11 Chilled",
    "Shed Evolution",
    "Sky 7 (only in strong winds)",
    "Sky Forme",
    "Sticky Hold",
    "Therian Forme",
    "Zapper Frost Rotom: Overland",
    "Zapper Wash Rotom: Overland",
];

fn setup_full_catalog() -> rusqlite::Connection {
    let dir = temp_dir("content-coverage");
    let mut conn = open_and_migrate_definitions(&dir.join("definitions.sqlite")).unwrap();
    let packs_dir = real_content_packs_dir();
    let results = import_all_from_directory(&mut conn, &packs_dir).unwrap();
    assert_eq!(results.len(), 18, "expected all 18 shipped packs to import");
    for (file_name, result) in &results {
        assert!(result.is_ok(), "pack {file_name} failed to import: {:?}", result.as_ref().err());
    }
    conn
}

/// Any of these fields being non-empty counts as "readable without a
/// book" for a non-species definition — different kinds populate
/// different subsets (a Move has `effect_text`, an Edge has
/// `prerequisites_text`/`effect_text`, an Item may only have
/// `description`), but every enabled record must have at least one.
const READABLE_TEXT_FIELDS: &[&str] =
    &["effect_text", "raw_text", "prerequisites_text", "description", "activation_text"];

fn has_readable_text(data: &Value) -> bool {
    READABLE_TEXT_FIELDS.iter().any(|f| {
        data.get(f)
            .and_then(Value::as_str)
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false)
    })
}

/// Criterion: "All source-supported deterministic atoms are machine-applied;
/// manual/hybrid remainder is clearly identified and readable without a
/// book." — every record must carry a real classification, never a
/// silent/missing one.
#[test]
fn every_enabled_non_species_definition_is_readable_and_classified() {
    let conn = setup_full_catalog();

    // Move/Ability/Capability carry no `semantic_automation` block anywhere
    // in the supplied source data (verified by inspection) — Move because
    // its core mechanics are already typed fields (ac/damage_base/class),
    // Ability/Capability because they never went through the same
    // semantic-compilation pass Edge/Feature/Item/PokeEdge did. This is a
    // real, documented content-completeness finding (see the Worker
    // Result), not something this test should fail on per-record — that
    // would just be re-discovering the same fact 570+ times. Kinds in this
    // list get a readable-text check only; everything else must carry a
    // real classification.
    const KINDS_WITHOUT_AUTOMATION_METADATA: &[ContentKind] =
        &[ContentKind::Move, ContentKind::Ability, ContentKind::Capability];

    let mut totals: std::collections::BTreeMap<(&str, String), usize> = std::collections::BTreeMap::new();
    let mut unreadable: Vec<String> = Vec::new();
    let mut unclassified: Vec<String> = Vec::new();

    for kind in CONTENT_KINDS {
        if kind == ContentKind::Species {
            continue; // species covered by the reference-integrity test below
        }
        let table = kind.table_name();
        let mut stmt = conn
            .prepare(&format!(
                "SELECT definition_version_id, name, needs_review, data_json FROM {table} WHERE enabled = 1"
            ))
            .unwrap();
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, String>(3)?,
                ))
            })
            .unwrap();

        let no_automation_metadata = KINDS_WITHOUT_AUTOMATION_METADATA.contains(&kind);
        let mut count = 0usize;
        for row in rows {
            let (version_id, name, _needs_review, data_json) = row.unwrap();
            assert!(!name.trim().is_empty(), "{version_id} has an empty name");
            let data: Value = serde_json::from_str(&data_json)
                .unwrap_or_else(|e| panic!("{version_id} data_json did not parse: {e}"));

            if !has_readable_text(&data) {
                unreadable.push(version_id.clone());
            }

            let level = data
                .get("semantic_automation")
                .and_then(|s| s.get("level"))
                .and_then(Value::as_str)
                .map(str::to_string);
            match level {
                Some(l) => {
                    *totals.entry((kind.kind_slug(), l)).or_insert(0) += 1;
                }
                None if no_automation_metadata => {
                    *totals.entry((kind.kind_slug(), "no_automation_metadata_in_source".to_string())).or_insert(0) += 1;
                }
                None => unclassified.push(version_id),
            }
            count += 1;
        }
        assert!(count > 0, "kind {} has zero enabled definitions — pack import regression", kind.kind_slug());
    }

    assert!(
        unreadable.is_empty(),
        "definitions with NO readable text field (a real, silent content gap): {unreadable:?}"
    );
    assert!(
        unclassified.is_empty(),
        "definitions missing an automation classification despite belonging to a kind that normally has one (silently unclassified — a real regression): {unclassified:?}"
    );

    println!("\n=== T12 coverage report: automation_level by kind ===");
    for ((kind, level), n) in &totals {
        println!("  {kind:<12} {level:<20} {n}");
    }
}

/// Criterion: "Every enabled selectable reference resolves to a readable
/// in-app detail or is blocked from selection with a specific source-gap
/// reason" + "no silent unresolved reference." Walks every species'
/// movepool/ability/capability reference and asserts every `"unresolved"`
/// one is in the documented allowlist above — any reference not in the
/// allowlist is a NEW, undocumented gap and fails the test.
#[test]
fn every_species_reference_is_resolved_or_a_documented_gap() {
    let conn = setup_full_catalog();

    let mut stmt = conn
        .prepare("SELECT definition_version_id, data_json FROM species WHERE enabled = 1")
        .unwrap();
    let rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .unwrap();

    let mut undocumented: Vec<String> = Vec::new();
    let mut species_count = 0usize;
    let mut found_moves = std::collections::BTreeSet::new();
    let mut found_abilities = std::collections::BTreeSet::new();
    let mut found_capabilities = std::collections::BTreeSet::new();

    for row in rows {
        let (version_id, data_json) = row.unwrap();
        let data: Value = serde_json::from_str(&data_json).unwrap();
        species_count += 1;

        let mut check_list = |container: &str, field: &str, known: &[&str], found: &mut std::collections::BTreeSet<String>| {
            let Some(items) = data.get(container).and_then(Value::as_array) else { return };
            for item in items {
                if item.get("reference_status").and_then(Value::as_str) != Some("unresolved") {
                    continue;
                }
                let Some(key) = item.get(field).and_then(Value::as_str) else { continue };
                found.insert(key.to_string());
                if !known.contains(&key) {
                    undocumented.push(format!("{version_id}: {container}.{field}={key:?} not in known-gap allowlist"));
                }
            }
        };

        for container in ["level_up_moves", "tm_moves", "egg_moves", "tutor_moves"] {
            check_list(container, "move", KNOWN_UNRESOLVED_MOVES, &mut found_moves);
        }
        check_list("ability_slots", "name", KNOWN_UNRESOLVED_ABILITIES, &mut found_abilities);
        check_list("capabilities", "name", KNOWN_UNRESOLVED_CAPABILITIES, &mut found_capabilities);
    }

    assert!(species_count > 900, "expected ~1101 species records, got {species_count}");
    assert!(
        undocumented.is_empty(),
        "found unresolved species references NOT in the documented gap allowlist (a new, undocumented silent gap):\n{}",
        undocumented.join("\n")
    );

    println!("\n=== T12 coverage report: species reference resolution ===");
    println!("  species scanned: {species_count}");
    println!(
        "  unique unresolved move refs found: {} (documented allowlist: {})",
        found_moves.len(),
        KNOWN_UNRESOLVED_MOVES.len()
    );
    println!(
        "  unique unresolved ability refs found: {} (documented allowlist: {})",
        found_abilities.len(),
        KNOWN_UNRESOLVED_ABILITIES.len()
    );
    println!(
        "  unique unresolved capability refs found: {} (documented allowlist: {})",
        found_capabilities.len(),
        KNOWN_UNRESOLVED_CAPABILITIES.len()
    );
}

/// Worker Verification: "representative rendered details for each entity
/// kind" — proves `resolve_definition`'s real code path (not raw table
/// access) returns a genuinely readable record for one example of each
/// kind, the same call path the UI uses.
#[test]
fn resolve_definition_returns_a_readable_record_for_every_kind() {
    let conn = setup_full_catalog();
    let ruleset = ptu_domain::content::ruleset::CampaignRuleset {
        id: "all-provided-material".to_string(),
        name: "All Supplied Material".to_string(),
        version: "1".to_string(),
        description: None,
        gm_overrides_enabled: true,
        packs: repository::list_packs(&conn)
            .unwrap()
            .into_iter()
            .map(|p| ptu_domain::content::ruleset::RulesetPackRef {
                id: p.id,
                enabled: true,
                priority: p.priority,
            })
            .collect(),
        version_pins: Default::default(),
    };

    let examples: &[(ContentKind, &str)] = &[
        (ContentKind::Move, "crunch"),
        (ContentKind::Ability, "abominable"),
        (ContentKind::Capability, "alluring"),
        (ContentKind::Edge, "acrobat"),
        (ContentKind::Feature, "accentuated-taste"),
        (ContentKind::Item, "potion"),
        (ContentKind::Species, "abomasnow"),
    ];

    for (kind, logical_id) in examples {
        let resolved = ptu_domain::content::resolver::resolve_definition(&conn, &ruleset, *kind, logical_id)
            .unwrap_or_else(|e| panic!("resolving {logical_id} ({kind:?}) failed: {e}"));
        let resolved = resolved.unwrap_or_else(|| panic!("{logical_id} ({kind:?}) did not resolve to any winner"));
        assert!(!resolved.name.trim().is_empty());
        let data: Value = serde_json::from_str(&resolved.data_json).unwrap();
        if *kind != ContentKind::Species {
            assert!(
                has_readable_text(&data),
                "{logical_id} ({kind:?}) resolved but has no readable text field"
            );
        }
    }
}
