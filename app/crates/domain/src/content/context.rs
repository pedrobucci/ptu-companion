//! T13E02: the five "content context" endpoints frozen in E01-C1
//! (`T13E01_EVIDENCE_AND_CONTRACTS.md` §5) — `get_content_context`,
//! `set_active_ruleset`, `browse_selectable_content`, `get_definition_version`,
//! `refresh_bundled_content`. Tauri commands (`app-src-tauri/src/commands.rs`)
//! stay thin wrappers around the functions here; all decision logic lives
//! in this crate so it is testable without a Tauri runtime.
//!
//! Raw authoring search (`content::search::search`) and version resolution
//! (`content::resolver::resolve_definition`) are REUSED, not replaced —
//! `browse_selectable_content` composes them rather than inventing a third
//! query path, per E01's explicit instruction not to alter raw search.

use std::collections::{BTreeSet, HashMap, HashSet};
use std::path::Path;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use super::import::hex_sha256;
use super::repository::{self, get_definition_by_version_id};
use super::resolver::{resolve_definition, ResolvedDefinition};
use super::ruleset::{self, CampaignRuleset, PresetInfo};
use super::search::search as raw_search;
use super::ContentKind;

/// New-boundary error shape frozen by E01-C1: "new boundary errors reject
/// with `{code,message,field,retryable}`... Existing errors elsewhere
/// remain unchanged." Every T13E02 command below returns this instead of
/// the crate's usual `Result<T, String>` — a deliberate, contract-mandated
/// departure documented in the Worker Result, not an accidental one.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ContentApiError {
    pub code: String,
    pub message: String,
    pub field: Option<String>,
    pub retryable: bool,
}

impl std::fmt::Display for ContentApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} ({}){}", self.message, self.code, self.field.as_deref().map(|f| format!(" field={f}")).unwrap_or_default())
    }
}
impl std::error::Error for ContentApiError {}

impl ContentApiError {
    pub fn invalid_input(field: &str, message: impl Into<String>) -> Self {
        ContentApiError { code: "invalid_input".to_string(), message: message.into(), field: Some(field.to_string()), retryable: false }
    }
    /// Message text matches E01-C1's own serialized example verbatim
    /// ("Content context changed") so a client can match on it exactly.
    pub fn stale_revision() -> Self {
        ContentApiError {
            code: "stale_revision".to_string(),
            message: "Content context changed".to_string(),
            field: Some("expected_revision".to_string()),
            retryable: true,
        }
    }
    pub fn unknown_preset(message: impl Into<String>) -> Self {
        ContentApiError { code: "unknown_preset".to_string(), message: message.into(), field: Some("preset_id".to_string()), retryable: false }
    }
    pub fn confirmation_required(message: impl Into<String>) -> Self {
        ContentApiError { code: "confirmation_required".to_string(), message: message.into(), field: Some("confirm".to_string()), retryable: true }
    }
    pub fn not_found(message: impl Into<String>) -> Self {
        ContentApiError { code: "not_found".to_string(), message: message.into(), field: None, retryable: false }
    }
    pub fn pack_conflict(message: impl Into<String>) -> Self {
        ContentApiError { code: "conflict".to_string(), message: message.into(), field: None, retryable: false }
    }
    pub fn pack_missing(message: impl Into<String>) -> Self {
        ContentApiError { code: "pack_missing".to_string(), message: message.into(), field: None, retryable: true }
    }
    pub fn internal(message: impl Into<String>) -> Self {
        ContentApiError { code: "internal_error".to_string(), message: message.into(), field: None, retryable: false }
    }
    pub fn sqlite_error(e: rusqlite::Error) -> Self {
        Self::internal(e.to_string())
    }
}

// =======================================================================
// get_content_context
// =======================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PackStatus {
    /// Installed and matches the bundled copy's content exactly (or no
    /// bundled copy ships for it, e.g. a homebrew pack embedded via
    /// `.ptutrainer` import — still fully usable).
    Ready,
    /// A bundled copy exists but nothing with this id is installed yet.
    Missing,
    /// Installed and bundled differ, under DIFFERENT version strings — a
    /// normal, safe upgrade candidate `refresh_bundled_content` can apply.
    UpdateAvailable,
    /// Installed and bundled differ in CONTENT under the SAME version
    /// string — content drifted without a version bump. Never silently
    /// applied; requires a new version identity upstream (E01 §1).
    Conflict,
    /// Reserved for a `refresh_bundled_content` attempt that itself failed
    /// for this pack (e.g. unreadable file, hash mismatch in the bundled
    /// archive). `get_content_context` alone (a pure read) never assigns
    /// this — see this module's doc comment on scoping.
    Failed,
}

#[derive(Debug, Clone, Serialize)]
pub struct PackStatusEntry {
    pub id: String,
    pub version: String,
    pub status: PackStatus,
}

#[derive(Debug, Clone, Serialize)]
pub struct ContentContext {
    pub revision: String,
    pub ruleset_id: String,
    pub ruleset_name: String,
    pub presets: Vec<PresetInfo>,
    pub packs: Vec<PackStatusEntry>,
    pub issues: Vec<ContentApiError>,
}

fn installed_manifest_json(conn: &Connection, pack_id: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row("SELECT manifest_json FROM content_packs WHERE id = ?1", [pack_id], |row| row.get::<_, String>(0))
        .map(Some)
        .or_else(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            other => Err(other),
        })
}

struct BundledPackInfo {
    version: String,
    manifest_hash: String,
}

/// Reads one bundled `.ptucp`'s manifest and hashes it with the SAME
/// canonicalization `content_packs.manifest_json` was stored with
/// (`serde_json::to_string` re-serializes via `Value`'s `BTreeMap`, so key
/// order never causes a false content difference) — comparing the two
/// hashes is comparing like with like, not raw-file-bytes against
/// re-serialized-bytes.
fn read_bundled_pack_info(path: &Path) -> Option<(String, BundledPackInfo)> {
    let bytes = std::fs::read(path).ok()?;
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(bytes)).ok()?;
    let mut file = archive.by_name("manifest.json").ok()?;
    let mut buf = Vec::new();
    std::io::Read::read_to_end(&mut file, &mut buf).ok()?;
    let value: serde_json::Value = serde_json::from_slice(&buf).ok()?;
    let id = value.get("id")?.as_str()?.to_string();
    let version = value.get("version")?.as_str()?.to_string();
    let canonical = serde_json::to_string(&value).ok()?;
    let manifest_hash = hex_sha256(canonical.as_bytes());
    Some((id, BundledPackInfo { version, manifest_hash }))
}

fn scan_bundled_packs(bundled_dir: &Path) -> HashMap<String, BundledPackInfo> {
    let mut result = HashMap::new();
    let Ok(entries) = std::fs::read_dir(bundled_dir) else { return result };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("ptucp") {
            continue;
        }
        if let Some((id, info)) = read_bundled_pack_info(&path) {
            result.insert(id, info);
        }
    }
    result
}

fn decide_pack_status(installed: Option<(&str, &str)>, bundled: Option<(&str, &str)>) -> PackStatus {
    match (installed, bundled) {
        (Some((_, ih)), Some((_, bh))) if ih == bh => PackStatus::Ready,
        // Same manifest hash implies same version (version is itself part
        // of the hashed manifest), so any hash mismatch below is a real
        // content difference; whether it's a safe upgrade or a same-
        // version conflict depends only on whether the version moved.
        (Some((iv, _)), Some((bv, _))) if iv == bv => PackStatus::Conflict,
        (Some(_), Some(_)) => PackStatus::UpdateAvailable,
        (Some(_), None) => PackStatus::Ready,
        (None, Some(_)) => PackStatus::Missing,
        (None, None) => PackStatus::Missing,
    }
}

pub fn compute_pack_statuses(conn: &Connection, bundled_dir: &Path) -> rusqlite::Result<Vec<PackStatusEntry>> {
    let installed_rows = repository::list_packs(conn)?;
    let mut installed: HashMap<String, (String, String)> = HashMap::new();
    for row in &installed_rows {
        if let Some(manifest_json) = installed_manifest_json(conn, &row.id)? {
            installed.insert(row.id.clone(), (row.version.clone(), hex_sha256(manifest_json.as_bytes())));
        }
    }
    let bundled = scan_bundled_packs(bundled_dir);

    let ids: BTreeSet<String> = installed.keys().chain(bundled.keys()).cloned().collect();
    let mut entries = Vec::with_capacity(ids.len());
    for id in ids {
        let inst = installed.get(&id).map(|(v, h)| (v.as_str(), h.as_str()));
        let bund = bundled.get(&id).map(|info| (info.version.as_str(), info.manifest_hash.as_str()));
        let status = decide_pack_status(inst, bund);
        let version = inst.map(|(v, _)| v.to_string()).or_else(|| bund.map(|(v, _)| v.to_string())).unwrap_or_default();
        entries.push(PackStatusEntry { id, version, status });
    }
    Ok(entries)
}

/// T13E02-R1 F4: every definition-kind table, in a fixed order, so a
/// pack's content fingerprint is fully deterministic. Mirrors
/// `ContentKind`'s 9 variants (`persistence::definitions`'s migration
/// list) — kept as a local const rather than adding a public `ContentKind`
/// method nothing else needs yet.
const ALL_DEFINITION_KINDS: [ContentKind; 9] = [
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

/// T13E02-R1/R2 F4: a hash over the ACTUAL installed content that belongs
/// to one pack — every definition row (all 9 kind tables) and every
/// `content_datasets` row whose `content_pack_id` is this pack, keyed by
/// `(table, definition_version_id)` / `dataset_name` in a fixed sort order.
/// This changes for ANY row insert/update/delete under this pack id,
/// including an in-place `content::authoring::save_definition` edit —
/// which never touches `content_packs.manifest_json`/`version` at all, so
/// the pack-status hash `compute_pack_statuses` already computes cannot
/// see it. Not a timestamp proxy: the actual bytes are hashed, so a write
/// that happens to share a timestamp with a prior one still changes the
/// fingerprint.
///
/// R2 residual fix: per row, `enabled` and `needs_review` are hashed
/// ALONGSIDE `data_json`, not `data_json` alone. Bounded inspection of
/// `content::authoring`/`content::resolver` (the only two modules that
/// mutate or read these columns) found:
/// - `enabled` — `authoring::soft_delete_definition`/`reactivate_definition`
///   update ONLY `enabled` (+ `updated_at`) via `UPDATE {table} SET enabled = 0/1 ...`,
///   never touching `data_json`; `resolver::resolve_definition` filters on
///   it as a hard `WHERE enabled = 1` — it directly controls resolution
///   eligibility, independently of content. MUST be hashed.
/// - `needs_review` — this module's own `compute_selectability` gates
///   `selectable` on it (`browse_selectable_content`'s response). No
///   function currently updates it independently of `data_json` (every
///   write goes through `upsert_definition`'s combined write), but it is
///   a genuinely separate stored column and a real selection consumer, so
///   it is included for the same reason `enabled` is, not because a
///   distinct mutation path exists today.
/// - `source_priority` — checked and RULED OUT: `resolver::resolve_definition`'s
///   own `CANDIDATE_COLUMNS` never selects it, and ranking uses only the
///   ACTIVE RULESET's own `RulesetPackRef.priority` (a completely
///   different value, not this per-row column) — it does not affect
///   resolution or selectability, so hashing it would add cost with no
///   detection benefit.
/// - Species-only `mechanical_completeness`/`enabled_for_character_creation`/
///   `national_dex_number` — checked and found to have NO independent
///   update path either (same as `needs_review`, always rewritten
///   together with `data_json` by `upsert_definition`); already covered
///   transitively by hashing `data_json` under every real write path in
///   this codebase, so adding them separately would not change what this
///   fingerprint can detect. Not included, to keep the change scoped to
///   the demonstrated gap rather than speculatively duplicating coverage.
fn pack_content_fingerprint(conn: &Connection, pack_id: &str) -> rusqlite::Result<String> {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    for kind in ALL_DEFINITION_KINDS {
        let table = kind.table_name();
        let mut stmt = conn.prepare(&format!(
            "SELECT definition_version_id, enabled, needs_review, data_json FROM {table} WHERE content_pack_id = ?1 ORDER BY definition_version_id ASC"
        ))?;
        let rows: Vec<(String, bool, bool, String)> = stmt
            .query_map(rusqlite::params![pack_id], |row| Ok((row.get(0)?, row.get::<_, i64>(1)? != 0, row.get::<_, i64>(2)? != 0, row.get(3)?)))?
            .collect::<rusqlite::Result<_>>()?;
        for (definition_version_id, enabled, needs_review, data_json) in rows {
            hasher.update(table.as_bytes());
            hasher.update(b"\0");
            hasher.update(definition_version_id.as_bytes());
            hasher.update(b"\0");
            hasher.update([enabled as u8]);
            hasher.update([needs_review as u8]);
            hasher.update(b"\0");
            hasher.update(data_json.as_bytes());
            hasher.update(b"\n");
        }
    }
    let mut dataset_stmt = conn.prepare("SELECT dataset_name, data_json FROM content_datasets WHERE content_pack_id = ?1 ORDER BY dataset_name ASC")?;
    let datasets: Vec<(String, String)> = dataset_stmt.query_map(rusqlite::params![pack_id], |row| Ok((row.get(0)?, row.get(1)?)))?.collect::<rusqlite::Result<_>>()?;
    for (dataset_name, data_json) in datasets {
        hasher.update(b"dataset\0");
        hasher.update(dataset_name.as_bytes());
        hasher.update(b"\0");
        hasher.update(data_json.as_bytes());
        hasher.update(b"\n");
    }
    Ok(hex_sha256(&hasher.finalize()))
}

/// Opaque hash of everything a client needs to know changed: the active
/// ruleset's identity/packs/pins, every known pack's id/version/status,
/// AND (T13E02-R1 F4) each installed pack's actual content fingerprint —
/// so an in-place authoring edit changes the revision even though it never
/// touches `content_packs.manifest_json`/`version`. Changes whenever the
/// ruleset selection changes, any pack's installed/bundled comparison
/// changes, or any installed definition/dataset row is added, edited, or
/// removed — never a client-trusted timestamp.
pub fn compute_revision(conn: &Connection, ruleset: &CampaignRuleset, packs: &[PackStatusEntry]) -> rusqlite::Result<String> {
    let mut sorted_packs: Vec<&PackStatusEntry> = packs.iter().collect();
    sorted_packs.sort_by(|a, b| a.id.cmp(&b.id));
    let mut ruleset_packs: Vec<(String, bool, i64)> = ruleset.packs.iter().map(|p| (p.id.clone(), p.enabled, p.priority)).collect();
    ruleset_packs.sort();

    // Every pack this app currently knows about (installed or bundled) is
    // fingerprinted, not just the ones the active ruleset happens to
    // enable right now — a disabled pack's content can become active on
    // the next ruleset switch, and that switch alone (a `ruleset_packs`
    // change) must not be the only thing that can move the revision for
    // it; its own content identity has to be part of the hash too.
    let mut content_fingerprints: Vec<(String, String)> = Vec::with_capacity(sorted_packs.len());
    for pack in &sorted_packs {
        content_fingerprints.push((pack.id.clone(), pack_content_fingerprint(conn, &pack.id)?));
    }

    let payload = serde_json::json!({
        "ruleset_id": ruleset.id,
        "ruleset_packs": ruleset_packs,
        "ruleset_pins": ruleset.version_pins,
        "packs": sorted_packs.iter().map(|p| (p.id.clone(), p.version.clone(), p.status)).collect::<Vec<_>>(),
        "content_fingerprints": content_fingerprints,
    });
    Ok(hex_sha256(&serde_json::to_vec(&payload).unwrap_or_default()))
}

fn pack_issues(ruleset: &CampaignRuleset, packs: &[PackStatusEntry]) -> Vec<ContentApiError> {
    let mut issues = Vec::new();
    for pack in packs {
        match pack.status {
            PackStatus::Conflict => issues.push(ContentApiError::pack_conflict(format!(
                "pack \"{}\" has installed content that differs from the bundled copy under the same version \"{}\"; it will not be refreshed automatically",
                pack.id, pack.version
            ))),
            PackStatus::Missing if ruleset.packs.iter().any(|p| p.id == pack.id && p.enabled) => {
                issues.push(ContentApiError::pack_missing(format!("pack \"{}\" is required by the active ruleset but is not installed", pack.id)));
            }
            PackStatus::Failed => issues.push(ContentApiError { code: "refresh_failed".to_string(), message: format!("pack \"{}\" failed to refresh", pack.id), field: None, retryable: true }),
            _ => {}
        }
    }
    issues
}

/// Never mutates: reading the context must not change which content is
/// active. Never fails just because one bundled ruleset/pack file happens
/// to be missing from disk (`list_presets`/`scan_bundled_packs` both
/// degrade gracefully).
pub fn get_content_context(conn: &Connection, ruleset: &CampaignRuleset, rulesets_dir: &Path, bundled_packs_dir: &Path) -> rusqlite::Result<ContentContext> {
    let packs = compute_pack_statuses(conn, bundled_packs_dir)?;
    let revision = compute_revision(conn, ruleset, &packs)?;
    let presets = ruleset::list_presets(rulesets_dir);
    let issues = pack_issues(ruleset, &packs);
    Ok(ContentContext { revision, ruleset_id: ruleset.id.clone(), ruleset_name: ruleset.name.clone(), presets, packs, issues })
}

// =======================================================================
// set_active_ruleset
// =======================================================================

/// Validates a `set_active_ruleset` request against the CURRENT context and
/// returns the ruleset to switch to. Persisting the selection and swapping
/// the live `AppState` are the caller's job (they need Tauri's app handle /
/// mutex, which this crate has no business knowing about) — this function
/// only decides whether the request is legal.
pub fn validate_set_active_ruleset(
    rulesets_dir: &Path,
    current_revision: &str,
    expected_revision: &str,
    preset_id: &str,
    confirm: bool,
) -> Result<CampaignRuleset, ContentApiError> {
    if expected_revision != current_revision {
        return Err(ContentApiError::stale_revision());
    }
    if !confirm {
        return Err(ContentApiError::confirmation_required("confirm must be true to change the active ruleset"));
    }
    match ruleset::load_preset(rulesets_dir, preset_id) {
        Ok(Some(rs)) => Ok(rs),
        Ok(None) => Err(ContentApiError::unknown_preset(format!("unknown preset \"{preset_id}\""))),
        Err(e) => Err(ContentApiError::unknown_preset(format!("preset \"{preset_id}\" failed to load: {e}"))),
    }
}

// =======================================================================
// browse_selectable_content
// =======================================================================

#[derive(Debug, Clone, Serialize)]
pub struct UnavailableReason {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrowseItem {
    pub kind: String,
    pub logical_id: String,
    pub definition_version_id: String,
    pub content_pack_id: String,
    pub name: String,
    /// Content/quality suitability only — NEVER Trainer prerequisite or
    /// resource eligibility (E01-C1 endpoint 3).
    pub selectable: bool,
    pub unavailable_reason: Option<UnavailableReason>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrowseResult {
    pub revision: String,
    pub items: Vec<BrowseItem>,
    pub has_more: bool,
}

fn compute_selectability(kind: ContentKind, def: &ResolvedDefinition) -> (bool, Option<UnavailableReason>) {
    if def.needs_review {
        return (
            false,
            Some(UnavailableReason { code: "needs_review".to_string(), message: format!("\"{}\" is flagged for review and is not selectable yet.", def.name) }),
        );
    }
    if kind == ContentKind::Species {
        let raw: serde_json::Value = serde_json::from_str(&def.data_json).unwrap_or(serde_json::Value::Null);
        let enabled_for_creation = raw.get("enabled_for_character_creation").and_then(serde_json::Value::as_bool).unwrap_or(false);
        let completeness = raw.get("mechanical_completeness").and_then(serde_json::Value::as_str).unwrap_or("");
        if !enabled_for_creation || completeness != "complete" {
            return (
                false,
                Some(UnavailableReason {
                    code: "species_incomplete".to_string(),
                    message: format!(
                        "\"{}\" is not a complete, creation-eligible species definition (mechanical_completeness={completeness:?}, enabled_for_character_creation={enabled_for_creation}).",
                        def.name
                    ),
                }),
            );
        }
    }
    (true, None)
}

fn build_browse_item(kind: ContentKind, def: ResolvedDefinition) -> BrowseItem {
    let (selectable, unavailable_reason) = compute_selectability(kind, &def);
    BrowseItem {
        kind: kind.kind_slug().to_string(),
        logical_id: def.logical_id,
        definition_version_id: def.definition_version_id,
        content_pack_id: def.content_pack_id,
        name: def.name,
        selectable,
        unavailable_reason,
    }
}

/// T13E02-R1 F1: `expected_revision` IS compared against the actual
/// current revision and rejected as `stale_revision` on mismatch, exactly
/// like `set_active_ruleset`/`refresh_bundled_content` — reversing the
/// prior "non-mutating reads are exempt" reading, which the Reviewer
/// confirmed was an unauthorized extension of the narrower exemption
/// E01-C1 grants only to `get_definition_version` (whose own signature has
/// no `expected_revision` field at all, unlike this endpoint's). Two pages
/// of the same browse computed against different content states (e.g. a
/// `refresh_bundled_content` landing between page 1 and page 2) must now
/// surface as an explicit, retryable error instead of silently mixing
/// results from two different catalog states.
pub fn browse_selectable_content(
    conn: &Connection,
    ruleset: &CampaignRuleset,
    bundled_packs_dir: &Path,
    expected_revision: &str,
    kind_slug: &str,
    query: &str,
    limit: i64,
    offset: i64,
) -> Result<BrowseResult, ContentApiError> {
    if !(1..=100).contains(&limit) {
        return Err(ContentApiError::invalid_input("limit", "limit must be 1..100"));
    }
    if offset < 0 {
        return Err(ContentApiError::invalid_input("offset", "offset must be >= 0"));
    }
    let kind = ContentKind::from_kind_slug(kind_slug).ok_or_else(|| ContentApiError::invalid_input("kind", format!("unknown content kind \"{kind_slug}\"")))?;

    let packs = compute_pack_statuses(conn, bundled_packs_dir).map_err(ContentApiError::sqlite_error)?;
    let current_revision = compute_revision(conn, ruleset, &packs).map_err(ContentApiError::sqlite_error)?;
    if expected_revision != current_revision {
        return Err(ContentApiError::stale_revision());
    }

    // T13E02-R1 F2: no fixed probe ceiling — `count_matches` gets the
    // EXACT total the FTS index would return with no LIMIT, and that
    // exact count becomes the LIMIT passed to `search`, so every matching
    // row is retrieved regardless of how many there are (a query matching
    // most of the largest kind, e.g. under `all-provided-material`'s
    // deliberately overlapping packs, no longer risks silent truncation).
    let candidate_logical_ids: Vec<String> = if query.trim().is_empty() {
        repository::list_distinct_logical_ids(conn, kind).map_err(ContentApiError::sqlite_error)?
    } else {
        let total_matches = super::search::count_matches(conn, query, Some(kind)).map_err(ContentApiError::sqlite_error)?;
        let hits = raw_search(conn, query, Some(kind), total_matches, 0).map_err(ContentApiError::sqlite_error)?;
        let mut seen = HashSet::new();
        hits.into_iter().filter(|h| seen.insert(h.logical_id.clone())).map(|h| h.logical_id).collect()
    };

    let mut resolved: Vec<BrowseItem> = Vec::new();
    for logical_id in &candidate_logical_ids {
        if let Some(def) = resolve_definition(conn, ruleset, kind, logical_id).map_err(ContentApiError::sqlite_error)? {
            resolved.push(build_browse_item(kind, def));
        }
    }

    let total = resolved.len();
    let start = (offset as usize).min(total);
    let end = (start + limit as usize).min(total);
    let has_more = end < total;
    Ok(BrowseResult { revision: current_revision, items: resolved[start..end].to_vec(), has_more })
}

// =======================================================================
// get_definition_version
// =======================================================================

#[derive(Debug, Clone, Serialize)]
pub struct ExactDefinitionVersion {
    pub kind: String,
    pub definition_version_id: String,
    pub logical_id: String,
    pub content_pack_id: String,
    pub name: String,
    pub needs_review: bool,
    pub data_json: String,
    /// Always `"pinned"` — this is an explicit exact-version read, never
    /// implying the current campaign's priority-resolved winner (E01-C1
    /// endpoint 4).
    pub reason: String,
}

/// Read-only: retained/disabled rows ARE readable here for historical
/// detail (E01 §1) — never filters on `enabled`.
pub fn get_definition_version(conn: &Connection, kind: ContentKind, definition_version_id: &str) -> Result<ExactDefinitionVersion, ContentApiError> {
    match get_definition_by_version_id(conn, kind, definition_version_id) {
        Ok(Some(row)) => Ok(ExactDefinitionVersion {
            kind: kind.kind_slug().to_string(),
            definition_version_id: row.definition_version_id,
            logical_id: row.logical_id,
            content_pack_id: row.content_pack_id,
            name: row.name,
            needs_review: row.needs_review,
            data_json: row.data_json,
            reason: "pinned".to_string(),
        }),
        Ok(None) => Err(ContentApiError::not_found(format!("definition \"{definition_version_id}\" not found"))),
        Err(e) => Err(ContentApiError::sqlite_error(e)),
    }
}

// =======================================================================
// refresh_bundled_content
// =======================================================================

/// Validates `expected_revision`/`confirm` the same way every other
/// mutation does — this IS a mutation (it may write new definitions), so
/// staleness is enforced here, unlike the two read-only endpoints above.
pub fn validate_refresh_request(current_revision: &str, expected_revision: &str, confirm: bool) -> Result<(), ContentApiError> {
    if expected_revision != current_revision {
        return Err(ContentApiError::stale_revision());
    }
    if !confirm {
        return Err(ContentApiError::confirmation_required("confirm must be true to refresh bundled content"));
    }
    Ok(())
}

/// Imports every `.ptucp` in `bundled_dir` through the normal transactional
/// importer (each pack is its own transaction — see
/// `content::import::import_all_from_directory`'s doc comment). A
/// conflicting or unreadable pack is reported as an issue and does not
/// abort the others ("Source conflicts do not silently become successful
/// refreshes", and "one pack failing does not affect packs already
/// committed"). Never touches `profiles.sqlite`; never force-replaces
/// anything already correctly installed.
pub fn refresh_bundled_content(conn: &mut Connection, bundled_dir: &Path, rulesets_dir: &Path, ruleset: &CampaignRuleset) -> Result<ContentContext, ContentApiError> {
    let mut refresh_issues = Vec::new();
    if bundled_dir.is_dir() {
        let entries = std::fs::read_dir(bundled_dir).map_err(|e| ContentApiError::internal(e.to_string()))?;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("ptucp") {
                continue;
            }
            let file_name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            match std::fs::read(&path) {
                Ok(bytes) => {
                    if let Err(e) = super::import::import_pack(conn, &bytes) {
                        let (code, retryable) = match &e {
                            crate::error::ImportError::DefinitionVersionConflict { .. } | crate::error::ImportError::DatasetConflict { .. } => ("conflict", false),
                            _ => ("refresh_failed", true),
                        };
                        refresh_issues.push(ContentApiError { code: code.to_string(), message: format!("{file_name}: {e}"), field: None, retryable });
                    }
                }
                Err(e) => refresh_issues.push(ContentApiError::internal(format!("{file_name}: {e}"))),
            }
        }
    }
    let mut context = get_content_context(conn, ruleset, rulesets_dir, bundled_dir).map_err(ContentApiError::sqlite_error)?;
    context.issues.extend(refresh_issues);
    Ok(context)
}

// =======================================================================
// T13E02-R1 F3: backup restore's ruleset-selection outcome. A backup's
// embedded ruleset already passed SCHEMA validation in
// `portability::backup::import_backup` (an invalid one rejects the whole
// backup atomically, unchanged by this fix). This function decides the
// separate, narrower question of whether that already-valid ruleset's
// `id` is one this app can actually SELECT (one of the fixed presets) —
// and, critically, never lets that answer be a silent `Ok(())`.
// =======================================================================

/// `Ok(preset_id)` when the restored ruleset is one of this app's known
/// presets and should become the active selection; `Err(ContentApiError)`
/// — an explicit, machine-readable warning, never a silent no-op — when
/// it isn't, naming the previously-active ruleset that remains in effect.
pub fn evaluate_restored_ruleset(restored: &CampaignRuleset, previously_active_name: &str) -> Result<String, ContentApiError> {
    if ruleset::PRESET_IDS.contains(&restored.id.as_str()) {
        Ok(restored.id.clone())
    } else {
        Err(ContentApiError {
            code: "ruleset_not_applied".to_string(),
            message: format!(
                "The backup's embedded ruleset \"{}\" is not one of this app's known presets and was not applied; the previously active ruleset (\"{previously_active_name}\") remains active.",
                restored.id
            ),
            field: Some("ruleset".to_string()),
            retryable: false,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ruleset_with_id(id: &str) -> CampaignRuleset {
        CampaignRuleset {
            id: id.to_string(),
            name: format!("{id} name"),
            version: "1.0.0".to_string(),
            description: None,
            packs: vec![],
            version_pins: Default::default(),
            gm_overrides_enabled: true,
        }
    }

    /// T13E02-R1 F3: a known preset id is applied — no warning.
    #[test]
    fn evaluate_restored_ruleset_applies_a_known_preset() {
        let restored = ruleset_with_id("ptu-core-with-pokedex");
        let outcome = evaluate_restored_ruleset(&restored, "PTU 1.05 Core Only");
        assert_eq!(outcome, Ok("ptu-core-with-pokedex".to_string()));
    }

    /// T13E02-R1 F3: an unknown preset id NEVER silently succeeds — this
    /// is the exact bug the Reviewer found (`Ok(())` regardless).
    #[test]
    fn evaluate_restored_ruleset_warns_explicitly_on_an_unknown_preset() {
        let restored = ruleset_with_id("some-custom-campaign-ruleset");
        let outcome = evaluate_restored_ruleset(&restored, "PTU 1.05 Core Only");
        let err = outcome.expect_err("an unknown preset id must never be silently applied");
        assert_eq!(err.code, "ruleset_not_applied");
        assert!(err.message.contains("some-custom-campaign-ruleset"), "warning must name the unapplied ruleset: {}", err.message);
        assert!(err.message.contains("PTU 1.05 Core Only"), "warning must name which ruleset remains active: {}", err.message);
        assert!(!err.retryable, "re-submitting the same backup would produce the identical warning again");
    }

    #[test]
    fn every_known_preset_id_is_accepted_by_evaluate_restored_ruleset() {
        for id in ruleset::PRESET_IDS {
            let restored = ruleset_with_id(id);
            assert_eq!(evaluate_restored_ruleset(&restored, "irrelevant"), Ok(id.to_string()));
        }
    }
}
