//! App-wide state: one connection each to `definitions.sqlite` and
//! `profiles.sqlite` (spec 34: physically separate databases), plus the
//! active Campaign Ruleset. On first run, `definitions.sqlite` is
//! bootstrapped from the `.ptucp` packs shipped with the app (spec 33).

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use ptu_domain::content::import::import_all_from_directory;
use ptu_domain::content::repository::count_packs;
use ptu_domain::content::ruleset::CampaignRuleset;
use ptu_domain::persistence::definitions::open_and_migrate_definitions;
use ptu_domain::persistence::profiles::open_and_migrate_profiles;
use rusqlite::Connection;
use tauri::{AppHandle, Manager};

pub struct AppState {
    pub definitions: Mutex<Connection>,
    pub profiles: Mutex<Connection>,
    /// The active Campaign Ruleset (spec 6). No ruleset-management UI yet
    /// (deferred — see Worker Result), so this is fixed for v1 rather than
    /// left unset: Core-only, the safest default.
    pub ruleset: CampaignRuleset,
}

/// Locates the bundled `content_packs/` directory: the packaged app's
/// resource dir first, falling back to the repo-relative dev path so
/// `cargo tauri dev` works without a release bundle.
fn resolve_content_packs_dir(app: &AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled = resource_dir.join("content_packs");
        if bundled.is_dir() {
            return bundled;
        }
    }
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../content_packs")
}

fn resolve_default_ruleset(app: &AppHandle) -> CampaignRuleset {
    let candidates = [
        app.path().resource_dir().ok().map(|d| d.join("rulesets/ptu-core-only.json")),
        Some(Path::new(env!("CARGO_MANIFEST_DIR")).join("../../rulesets/ptu-core-only.json")),
    ];
    for candidate in candidates.into_iter().flatten() {
        if let Ok(ruleset) = CampaignRuleset::from_file(&candidate) {
            return ruleset;
        }
    }
    // Should be unreachable in dev/packaged builds (the file is bundled),
    // but never panic app startup over a missing ruleset file — fall back
    // to an empty ruleset (nothing resolves) rather than crashing.
    CampaignRuleset {
        id: "empty".to_string(),
        name: "Empty".to_string(),
        version: "0".to_string(),
        description: None,
        packs: vec![],
        version_pins: Default::default(),
        gm_overrides_enabled: true,
    }
}

pub fn init(app: &AppHandle) -> AppState {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("app data directory must be resolvable");
    std::fs::create_dir_all(&app_data_dir).expect("failed to create app data directory");

    let mut definitions = open_and_migrate_definitions(&app_data_dir.join("definitions.sqlite"))
        .expect("failed to open definitions.sqlite");
    let profiles = open_and_migrate_profiles(&app_data_dir.join("profiles.sqlite"))
        .expect("failed to open profiles.sqlite");

    if count_packs(&definitions).unwrap_or(0) == 0 {
        let packs_dir = resolve_content_packs_dir(app);
        if packs_dir.is_dir() {
            if let Ok(results) = import_all_from_directory(&mut definitions, &packs_dir) {
                for (file_name, result) in results {
                    if let Err(e) = result {
                        eprintln!("bootstrap import: {file_name} failed: {e}");
                    }
                }
            }
        }
    }

    let ruleset = resolve_default_ruleset(app);

    AppState {
        definitions: Mutex::new(definitions),
        profiles: Mutex::new(profiles),
        ruleset,
    }
}
