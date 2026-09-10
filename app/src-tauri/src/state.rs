//! App-wide state: one connection each to `definitions.sqlite` and
//! `profiles.sqlite` (spec 34: physically separate databases), plus the
//! active Campaign Ruleset. On every start, `definitions.sqlite` is
//! synced against the `.ptucp` packs shipped with the app (spec 33; T13E02
//! fix — previously this only ran once, when `count_packs == 0`, so an
//! existing installed database never received new/updated bundled packs).

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use ptu_domain::content::import::import_all_from_directory;
use ptu_domain::content::ruleset::{self, CampaignRuleset, DEFAULT_PRESET_ID};
use ptu_domain::persistence::definitions::open_and_migrate_definitions;
use ptu_domain::persistence::profiles::open_and_migrate_profiles;
use rusqlite::Connection;
use tauri::{AppHandle, Manager};

pub struct AppState {
    pub definitions: Mutex<Connection>,
    pub profiles: Mutex<Connection>,
    /// The active Campaign Ruleset (spec 6). T13E02: now mutable at
    /// runtime via `set_active_ruleset`, persisted to
    /// `active_ruleset.json` in `app_data_dir` — see `content::ruleset`.
    pub ruleset: Mutex<CampaignRuleset>,
    pub app_data_dir: PathBuf,
    pub rulesets_dir: PathBuf,
    pub content_packs_dir: PathBuf,
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

fn resolve_rulesets_dir(app: &AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled = resource_dir.join("rulesets");
        if bundled.is_dir() {
            return bundled;
        }
    }
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../rulesets")
}

fn resolve_active_ruleset(app: &AppHandle, app_data_dir: &Path, rulesets_dir: &Path) -> CampaignRuleset {
    let preset_id = ruleset::load_active_preset_selection(app_data_dir).unwrap_or_else(|| DEFAULT_PRESET_ID.to_string());
    if let Ok(Some(rs)) = ruleset::load_preset(rulesets_dir, &preset_id) {
        return rs;
    }
    // Fall back to the packaged Core-only file directly (covers a dev
    // environment where `rulesets_dir` doesn't resolve the way
    // `load_preset`'s fixed filename convention expects) before finally
    // giving up. Never panic app startup over a missing ruleset file.
    let candidates = [
        app.path().resource_dir().ok().map(|d| d.join("rulesets/ptu-core-only.json")),
        Some(Path::new(env!("CARGO_MANIFEST_DIR")).join("../../rulesets/ptu-core-only.json")),
    ];
    for candidate in candidates.into_iter().flatten() {
        if let Ok(ruleset) = CampaignRuleset::from_file(&candidate) {
            return ruleset;
        }
    }
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

/// T13E02 (E01 §1 "Native testing isolation decision"): a debug-build-only
/// override of the app data directory, for native test walkthroughs that
/// must never touch the real user's database. Requires an ABSOLUTE path
/// AND an explicit marker file inside it (`PTU_COMPANION_TEST_MARKER`);
/// invalid configuration is a hard startup error, never a silent fallback
/// to the real data dir.
///
/// The `#[cfg(not(debug_assertions))]` twin below returns `Ok(None)`
/// unconditionally WITHOUT reading the environment variable at all — the
/// variable name/marker filename literals and the `std::env::var` call are
/// therefore absent from a release binary's compiled code entirely (not
/// merely runtime-gated), which is what a release-binary string scan can
/// verify (see the T13E02 Worker Result's release-build proof).
#[cfg(debug_assertions)]
pub const TEST_DATA_DIR_ENV_VAR: &str = "PTU_COMPANION_TEST_DATA_DIR";
#[cfg(debug_assertions)]
pub const TEST_DATA_DIR_MARKER_FILE: &str = "PTU_COMPANION_TEST_MARKER";

#[cfg(debug_assertions)]
pub fn resolve_test_data_dir_override() -> Result<Option<PathBuf>, String> {
    let Ok(raw) = std::env::var(TEST_DATA_DIR_ENV_VAR) else {
        return Ok(None);
    };
    let path = PathBuf::from(&raw);
    if !path.is_absolute() {
        return Err(format!("{TEST_DATA_DIR_ENV_VAR} must be an absolute path, got \"{raw}\""));
    }
    let marker = path.join(TEST_DATA_DIR_MARKER_FILE);
    if !marker.is_file() {
        return Err(format!(
            "{TEST_DATA_DIR_ENV_VAR} \"{raw}\" is missing the required marker file \"{TEST_DATA_DIR_MARKER_FILE}\" — refusing to fall back to the real user data directory"
        ));
    }
    Ok(Some(path))
}

#[cfg(not(debug_assertions))]
pub fn resolve_test_data_dir_override() -> Result<Option<PathBuf>, String> {
    Ok(None)
}

#[cfg(all(test, debug_assertions))]
mod test_data_dir_override_tests {
    use super::*;

    // `std::env::set_var`/`remove_var` mutate whole-process state, so
    // every test in this module that touches `TEST_DATA_DIR_ENV_VAR` holds
    // this lock for its whole body — otherwise parallel test threads would
    // race each other's env var writes.
    static ENV_GUARD: Mutex<()> = Mutex::new(());

    fn unique_suffix() -> String {
        use std::sync::atomic::{AtomicU64, Ordering};
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        format!("{nanos}-{n}")
    }

    fn with_env_var<T>(value: Option<&str>, f: impl FnOnce() -> T) -> T {
        let _guard = ENV_GUARD.lock().unwrap_or_else(|e| e.into_inner());
        // Safety: serialized by ENV_GUARD above — no other thread reads or
        // writes TEST_DATA_DIR_ENV_VAR while this closure runs.
        unsafe {
            match value {
                Some(v) => std::env::set_var(TEST_DATA_DIR_ENV_VAR, v),
                None => std::env::remove_var(TEST_DATA_DIR_ENV_VAR),
            }
        }
        let result = f();
        unsafe {
            std::env::remove_var(TEST_DATA_DIR_ENV_VAR);
        }
        result
    }

    #[test]
    fn absent_env_var_is_none_not_an_error() {
        with_env_var(None, || {
            assert_eq!(resolve_test_data_dir_override().unwrap(), None);
        });
    }

    #[test]
    fn relative_path_is_rejected_not_silently_used() {
        with_env_var(Some("relative/path"), || {
            let result = resolve_test_data_dir_override();
            assert!(result.is_err(), "a relative path must be rejected, never silently accepted");
        });
    }

    #[test]
    fn absolute_path_without_marker_file_is_rejected() {
        let dir = std::env::temp_dir().join(format!("ptu-test-override-no-marker-{}", unique_suffix()));
        std::fs::create_dir_all(&dir).unwrap();
        with_env_var(Some(dir.to_str().unwrap()), || {
            let result = resolve_test_data_dir_override();
            assert!(result.is_err(), "an absolute path missing the marker file must be rejected, never fall back to the real user data dir");
        });
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn absolute_path_with_marker_file_is_accepted() {
        let dir = std::env::temp_dir().join(format!("ptu-test-override-with-marker-{}", unique_suffix()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join(TEST_DATA_DIR_MARKER_FILE), b"").unwrap();
        with_env_var(Some(dir.to_str().unwrap()), || {
            let result = resolve_test_data_dir_override().unwrap();
            assert_eq!(result, Some(dir.clone()));
        });
        let _ = std::fs::remove_dir_all(&dir);
    }
}

pub fn init(app: &AppHandle) -> AppState {
    let app_data_dir = match resolve_test_data_dir_override() {
        Ok(Some(dir)) => dir,
        Ok(None) => app.path().app_data_dir().expect("app data directory must be resolvable"),
        Err(msg) => panic!("{msg}"),
    };
    std::fs::create_dir_all(&app_data_dir).expect("failed to create app data directory");

    let mut definitions = open_and_migrate_definitions(&app_data_dir.join("definitions.sqlite"))
        .expect("failed to open definitions.sqlite");
    let profiles = open_and_migrate_profiles(&app_data_dir.join("profiles.sqlite"))
        .expect("failed to open profiles.sqlite");

    let content_packs_dir = resolve_content_packs_dir(app);
    if content_packs_dir.is_dir() {
        if let Ok(results) = import_all_from_directory(&mut definitions, &content_packs_dir) {
            for (file_name, result) in results {
                if let Err(e) = result {
                    // A conflicting/failed pack is not fatal to startup —
                    // `get_content_context`'s own read-time comparison
                    // independently re-derives and surfaces this same
                    // issue on every call, so it is never silently lost
                    // even though this log line is transient.
                    eprintln!("content sync: {file_name} failed: {e}");
                }
            }
        }
    }

    let rulesets_dir = resolve_rulesets_dir(app);
    let ruleset = resolve_active_ruleset(app, &app_data_dir, &rulesets_dir);

    AppState {
        definitions: Mutex::new(definitions),
        profiles: Mutex::new(profiles),
        ruleset: Mutex::new(ruleset),
        app_data_dir,
        rulesets_dir,
        content_packs_dir,
    }
}
