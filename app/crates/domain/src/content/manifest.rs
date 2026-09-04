use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dependency {
    pub id: String,
    pub required: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FileEntry {
    pub sha256: String,
    #[serde(default)]
    pub bytes: u64,
    pub records: u64,
    #[serde(default)]
    pub media_type: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Manifest {
    pub format: String,
    pub format_version: i64,
    pub id: String,
    pub name: String,
    pub version: String,
    pub priority: i64,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub dependencies: Vec<Dependency>,
    pub files: HashMap<String, FileEntry>,
}
