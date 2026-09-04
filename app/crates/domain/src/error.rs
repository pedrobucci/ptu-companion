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

    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
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
