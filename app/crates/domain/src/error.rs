use thiserror::Error;

/// Errors raised while importing a `.ptucp` content pack.
///
/// Any of these aborts the whole pack import; the caller's SQLite
/// transaction is rolled back on drop, so no partial rows are ever
/// committed for a rejected pack.
#[derive(Debug, Error)]
pub enum ImportError {
    #[error("archive could not be opened: {0}")]
    Archive(String),

    #[error("unsafe archive entry path (zip-slip/path traversal): {0}")]
    UnsafeArchivePath(String),

    #[error("manifest.json is missing from the archive")]
    ManifestMissing,

    #[error("manifest.json is not valid JSON: {0}")]
    ManifestNotJson(String),

    #[error("manifest.json failed schema validation: {0}")]
    ManifestSchema(String),

    #[error("manifest declares unsupported format \"{0}\" (expected \"ptu-content-pack\")")]
    UnsupportedFormat(String),

    #[error("manifest declares unsupported format_version {0} (expected 1)")]
    UnsupportedFormatVersion(i64),

    #[error("file \"{path}\" listed in manifest is missing from the archive")]
    ArchiveFileMissing { path: String },

    #[error("file \"{path}\" hash mismatch: manifest declares {expected}, archive contains {actual}")]
    HashMismatch {
        path: String,
        expected: String,
        actual: String,
    },

    #[error("file \"{path}\" record count mismatch: manifest declares {expected}, parsed {actual}")]
    RecordCountMismatch {
        path: String,
        expected: u64,
        actual: u64,
    },

    #[error("file \"{path}\" is not a recognized content or dataset file")]
    UnexpectedFile { path: String },

    #[error("file \"{path}\" line {line}: {message}")]
    RecordParse {
        path: String,
        line: usize,
        message: String,
    },

    #[error("file \"{path}\" record {index}: {message}")]
    RecordValidation {
        path: String,
        index: usize,
        message: String,
    },

    #[error("file \"{path}\" record {index}: content_pack_id \"{found}\" does not match manifest id \"{expected}\"")]
    RecordPackMismatch {
        path: String,
        index: usize,
        expected: String,
        found: String,
    },

    #[error("required dependency \"{0}\" is not imported")]
    MissingDependency(String),

    /// T13E02: a record in this pack declares a `definition_version_id`
    /// that is already installed with GENUINELY DIFFERENT content (a
    /// byte-for-byte different `data_json`/`search_text`). Previously this
    /// silently overwrote the installed row (`ON CONFLICT ... DO UPDATE`
    /// unconditionally) — E01's decision requires this to surface as a
    /// conflict instead: "if a shipped definition changes under an
    /// existing ID, create a new version identity and retain the old
    /// record." An identical re-import (same content) is NOT a conflict —
    /// see `content::import::content_matches_existing`.
    #[error("definition \"{definition_version_id}\" in table \"{table}\" already exists with different content under the same version id; a content change requires a new definition_version_id upstream")]
    DefinitionVersionConflict { table: String, definition_version_id: String },

    /// Same protection for `content_datasets` rows (spec: "dataset updates
    /// must likewise version their source identity/fingerprint").
    #[error("dataset \"{dataset_name}\" for pack \"{content_pack_id}\" already exists with different content under the same pack id")]
    DatasetConflict { content_pack_id: String, dataset_name: String },

    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

/// Errors raised while loading a Campaign Ruleset (technical spec section 6).
#[derive(Debug, Error)]
pub enum RulesetError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("ruleset is not valid JSON: {0}")]
    NotJson(String),

    #[error("ruleset failed schema validation: {0}")]
    Schema(String),
}

/// Errors raised while saving a Trainer profile (technical spec sections 7-13, 17-18).
#[derive(Debug, Error)]
pub enum ProfileError {
    #[error("gm_grants[{index}] is missing required string field \"id\"")]
    GmGrantMissingId { index: usize },

    #[error("gm_grants[{index}] is missing required string field \"kind\"")]
    GmGrantMissingKind { index: usize },

    #[error("npcs[{index}] is missing required string field \"id\"")]
    NpcMissingId { index: usize },

    #[error("progression[{index}] is missing required integer field \"level\"")]
    ProgressionMissingLevel { index: usize },

    #[error("timeline[{index}] is missing required string field \"kind\"")]
    TimelineMissingKind { index: usize },

    #[error("{table}[{index}] is missing required string field \"definition_version_id\"")]
    CollectionEntryMissingDefinitionVersionId { table: String, index: usize },

    /// T13D1: `trainer_edges`/`trainer_features` key on `acquisition_id`
    /// (a server-generated per-instance id, not the definition), so PTU's
    /// legally repeatable Edges (e.g. Elemental Connection taken once per
    /// Type) can coexist. This only fires for a caller-supplied value that
    /// isn't a string when the field IS present; a genuinely missing field
    /// is never an error here — the repository assigns a fresh id instead
    /// (see `profile::repository::insert_trainer_acquisition_collection`).
    #[error("{table}[{index}] field \"acquisition_id\" is present but is not a string")]
    AcquisitionIdNotAString { table: String, index: usize },

    /// The legacy single-value `remove_collection_entry(..., definition_version_id)`
    /// path is ambiguous once more than one acquisition shares that
    /// `definition_version_id` (e.g. two Elemental Connection instances) —
    /// it must reject rather than guess which instance to delete or delete
    /// every repeated instance by definition.
    #[error("{table}: {count} acquisitions share definition_version_id \"{definition_version_id}\" for this owner; remove by acquisition_id instead")]
    AmbiguousLegacyRemoval { table: String, definition_version_id: String, count: i64 },

    /// T13D1: a `trainer_build_drafts` row referenced by id does not exist
    /// (already discarded, or never created).
    #[error("build draft \"{0}\" not found")]
    BuildDraftNotFound(String),

    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

/// T13D1: capabilities the frozen `trainer_build` API contract declares but
/// whose rule evaluation is explicitly out of this task's scope (T13D3
/// authoritative build validation, T13D4 milestone/GM/respec effects). Every
/// command returning this is declared unavailable, never a fake success —
/// see `T13D_TRAINER_BUILD_REPLAN.md` task T13D1's scope note.
#[derive(Debug, Error, Clone, PartialEq)]
pub enum BuildError {
    #[error("{capability} is not yet implemented (scheduled for {scheduled_for}); T13D1 only freezes its wire contract")]
    NotYetImplemented { capability: String, scheduled_for: String },
}

/// Errors raised while re-exporting an already-imported content pack
/// (technical spec sections 21/22.2/22.3).
#[derive(Debug, Error)]
pub enum ExportError {
    #[error("content pack \"{0}\" not found")]
    PackNotFound(String),

    #[error("content pack \"{0}\" has no rows to export")]
    EmptyPack(String),

    #[error("zip error: {0}")]
    Zip(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

/// Errors raised while exporting/importing a `.ptutrainer` archive
/// (technical spec §22.2). Mirrors [`ImportError`]'s shape for the outer
/// archive; embedded content packs go through [`ImportError`] itself via
/// [`crate::content::import::import_pack`].
#[derive(Debug, Error)]
pub enum TrainerPackError {
    #[error("archive could not be opened: {0}")]
    Archive(String),

    #[error("unsafe archive entry path (zip-slip/path traversal): {0}")]
    UnsafeArchivePath(String),

    #[error("manifest.json is missing or malformed")]
    ManifestMissing,

    #[error("manifest declares unsupported format {0} (expected \"ptu-trainer-pack\")")]
    UnsupportedFormat(String),

    #[error("manifest declares unsupported format_version {0} (expected 1)")]
    UnsupportedFormatVersion(i64),

    #[error("file \"{0}\" listed in manifest is missing from the archive")]
    ArchiveFileMissing(String),

    #[error("file \"{path}\" hash mismatch: manifest declares {expected}, archive contains {actual}")]
    HashMismatch { path: String, expected: String, actual: String },

    #[error("trainer \"{0}\" not found")]
    TrainerNotFound(String),

    #[error("zip error: {0}")]
    Zip(String),

    #[error(transparent)]
    Export(#[from] ExportError),

    #[error("embedded content pack failed to import: {0}")]
    Import(#[from] ImportError),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    #[error(transparent)]
    Profile(#[from] ProfileError),

    /// T13E02: a `.ptubackup`'s embedded `ruleset.json` failed to parse or
    /// schema-validate — the whole backup import rejects rather than
    /// silently keeping the live app on its previous ruleset while every
    /// other part of the backup restores (E01-C1: "Backup restores
    /// selection only after ruleset validation; both memory and
    /// persistent selection update or the operation rejects").
    #[error(transparent)]
    Ruleset(#[from] RulesetError),

    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

/// Errors raised by the rules/modifier/progression engines (technical spec
/// section 15/17) when loading their input datasets.
#[derive(Debug, Error)]
pub enum EngineError {
    #[error("dataset \"{dataset_name}\" not found for content pack \"{content_pack_id}\"")]
    DatasetNotFound {
        content_pack_id: String,
        dataset_name: String,
    },

    #[error("dataset is not valid JSON: {0}")]
    NotJson(#[from] serde_json::Error),

    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}
