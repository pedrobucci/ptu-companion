use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};
use tauri::Manager;
use zip::ZipArchive;

const MAX_ARCHIVE_BYTES: usize = 128 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES: u64 = 256 * 1024 * 1024;
const MAX_ENTRIES: usize = 512;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstalledPack {
    manifest: Value,
    archive_sha256: String,
    archive_filename: String,
    counts: BTreeMap<String, usize>,
    definitions: BTreeMap<String, Vec<Value>>,
    evolution_edges: Vec<Value>,
    evolution_families: Vec<Value>,
    enabled_rulesets: Vec<String>,
    warnings: Vec<String>,
}

fn hex_sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn valid_id(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(first) = chars.next() else { return false; };
    if !first.is_ascii_alphanumeric() { return false; }
    chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | ':' | '-'))
}

fn safe_component(value: &str) -> String {
    value.chars().map(|c| if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') { c } else { '-' }).collect()
}

fn safe_zip_name(name: &str) -> bool {
    if name.is_empty() || name.starts_with('/') || name.starts_with('\\') { return false; }
    if name.len() >= 3 && name.as_bytes()[1] == b':' && (name.as_bytes()[2] == b'/' || name.as_bytes()[2] == b'\\') { return false; }
    !name.replace('\\', "/").split('/').any(|part| part == "..")
}

fn record_count(path: &str, bytes: &[u8]) -> Result<usize, String> {
    if path.ends_with(".ndjson") {
        let text = std::str::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8 in {path}: {e}"))?;
        let mut count = 0usize;
        for (i, line) in text.lines().enumerate() {
            if line.trim().is_empty() { continue; }
            serde_json::from_str::<Value>(line).map_err(|e| format!("Invalid NDJSON in {path} line {}: {e}", i + 1))?;
            count += 1;
        }
        Ok(count)
    } else {
        let parsed: Value = serde_json::from_slice(bytes).map_err(|e| format!("Invalid JSON in {path}: {e}"))?;
        Ok(parsed.as_array().map(|a| a.len()).unwrap_or(1))
    }
}

fn parse_ndjson(path: &str, bytes: &[u8]) -> Result<Vec<Value>, String> {
    let text = std::str::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8 in {path}: {e}"))?;
    let mut rows = Vec::new();
    for (i, line) in text.lines().enumerate() {
        if line.trim().is_empty() { continue; }
        let row = serde_json::from_str::<Value>(line).map_err(|e| format!("Invalid NDJSON in {path} line {}: {e}", i + 1))?;
        rows.push(row);
    }
    Ok(rows)
}

fn image_mime(path: &str) -> Option<&'static str> {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".png") { Some("image/png") }
    else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") { Some("image/jpeg") }
    else if lower.ends_with(".webp") { Some("image/webp") }
    else { None }
}

fn embed_species_portraits(rows: &mut [Value], entries: &BTreeMap<String, Vec<u8>>) -> Result<(), String> {
    for row in rows.iter_mut() {
        let mut asset_path = row.get("portrait_asset_path").and_then(Value::as_str).map(str::to_string);
        if asset_path.is_none() {
            asset_path = row.get("artwork_assets").and_then(Value::as_array).and_then(|assets| {
                assets.iter().find(|asset| asset.get("role").and_then(Value::as_str) == Some("portrait"))
                    .and_then(|asset| asset.get("path").and_then(Value::as_str)).map(str::to_string)
            });
        }
        let Some(asset_path) = asset_path else { continue; };
        if !safe_zip_name(&asset_path) { return Err(format!("Unsafe Species portrait asset path: {asset_path}")); }
        let Some(mime) = image_mime(&asset_path) else { return Err(format!("Unsupported Species portrait format: {asset_path}")); };
        let payload = entries.get(&asset_path).ok_or_else(|| format!("Species portrait asset is missing from archive: {asset_path}"))?;
        if payload.len() > 5 * 1024 * 1024 { return Err(format!("Species portrait asset exceeds 5 MB: {asset_path}")); }
        let object = row.as_object_mut().ok_or_else(|| "Species NDJSON row must be a JSON object.".to_string())?;
        object.insert("portrait_asset_path".into(), Value::String(asset_path));
        object.insert("portrait_data_url".into(), Value::String(format!("data:{mime};base64,{}", BASE64_STANDARD.encode(payload))));
    }
    Ok(())
}

fn embed_item_icons(rows: &mut [Value], entries: &BTreeMap<String, Vec<u8>>) -> Result<(), String> {
    for row in rows.iter_mut() {
        let mut asset_path = row.get("icon_asset_path").and_then(Value::as_str).map(str::to_string);
        if asset_path.is_none() {
            asset_path = row.get("artwork_assets").and_then(Value::as_array).and_then(|assets| {
                assets.iter().find(|asset| asset.get("role").and_then(Value::as_str) == Some("icon"))
                    .and_then(|asset| asset.get("path")).and_then(Value::as_str).map(str::to_string)
            });
        }
        let Some(asset_path) = asset_path else { continue; };
        if !safe_zip_name(&asset_path) { return Err(format!("Unsafe Item icon asset path: {asset_path}")); }
        let Some(mime) = image_mime(&asset_path) else { return Err(format!("Unsupported Item icon format: {asset_path}")); };
        let payload = entries.get(&asset_path).ok_or_else(|| format!("Item icon asset is missing from archive: {asset_path}"))?;
        if payload.len() > 5 * 1024 * 1024 { return Err(format!("Item icon asset exceeds 5 MB: {asset_path}")); }
        let object = row.as_object_mut().ok_or_else(|| "Item definition row must be a JSON object".to_string())?;
        object.insert("icon_asset_path".into(), Value::String(asset_path));
        object.insert("icon_data_url".into(), Value::String(format!("data:{mime};base64,{}", BASE64_STANDARD.encode(payload))));
    }
    Ok(())
}

fn pack_store_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let root = app.path().app_data_dir().map_err(|e| format!("Could not resolve Android app data directory: {e}"))?;
    Ok(root.join("content-packs"))
}

fn parse_pack(bytes: &[u8], archive_filename: &str, available_pack_ids: &[String], enable_ruleset_id: &str) -> Result<InstalledPack, String> {
    if bytes.is_empty() { return Err("The selected .ptucp file is empty.".into()); }
    if bytes.len() > MAX_ARCHIVE_BYTES { return Err("Content pack exceeds the 128 MB Android import limit.".into()); }
    let cursor = Cursor::new(bytes);
    let mut zip = ZipArchive::new(cursor).map_err(|e| format!("Invalid .ptucp ZIP archive: {e}"))?;
    if zip.len() > MAX_ENTRIES { return Err(format!("Content pack has too many ZIP entries ({}).", zip.len())); }

    let mut entries: BTreeMap<String, Vec<u8>> = BTreeMap::new();
    let mut expanded = 0u64;
    for index in 0..zip.len() {
        let mut file = zip.by_index(index).map_err(|e| format!("Could not read ZIP entry {index}: {e}"))?;
        let name = file.name().replace('\\', "/");
        if !safe_zip_name(&name) { return Err(format!("Unsafe archive path: {name}")); }
        if file.is_dir() { continue; }
        expanded = expanded.saturating_add(file.size());
        if expanded > MAX_UNCOMPRESSED_BYTES { return Err("Content pack exceeds the 256 MB expanded limit.".into()); }
        let mut payload = Vec::with_capacity(file.size().min(8 * 1024 * 1024) as usize);
        file.read_to_end(&mut payload).map_err(|e| format!("Could not read {name}: {e}"))?;
        if entries.insert(name.clone(), payload).is_some() { return Err(format!("Duplicate ZIP entry: {name}")); }
    }

    let manifest_bytes = entries.get("manifest.json").ok_or_else(|| "Content pack does not contain manifest.json.".to_string())?;
    let manifest: Value = serde_json::from_slice(manifest_bytes).map_err(|e| format!("Invalid JSON in manifest.json: {e}"))?;
    if manifest.get("format").and_then(Value::as_str) != Some("ptu-content-pack") { return Err("manifest.json must declare format \"ptu-content-pack\".".into()); }
    if manifest.get("format_version").and_then(Value::as_i64) != Some(1) { return Err(format!("Unsupported content-pack format_version: {}", manifest.get("format_version").unwrap_or(&Value::Null))); }
    let pack_id = manifest.get("id").and_then(Value::as_str).unwrap_or("").trim();
    if !valid_id(pack_id) { return Err(format!("Invalid pack id: {pack_id}")); }
    let pack_name = manifest.get("name").and_then(Value::as_str).unwrap_or("").trim();
    let pack_version = manifest.get("version").and_then(Value::as_str).unwrap_or("").trim();
    if pack_name.is_empty() { return Err("Content pack name is required.".into()); }
    if pack_version.is_empty() { return Err("Content pack version is required.".into()); }

    if let Some(files) = manifest.get("files").and_then(Value::as_object) {
        for (path, meta) in files {
            if !safe_zip_name(path) { return Err(format!("Unsafe manifest path: {path}")); }
            let payload = entries.get(path).ok_or_else(|| format!("Manifest file is missing from archive: {path}"))?;
            if let Some(expected) = meta.get("bytes").and_then(Value::as_u64) {
                if expected != payload.len() as u64 { return Err(format!("Byte-size mismatch for {path}.")); }
            }
            if let Some(expected) = meta.get("sha256").and_then(Value::as_str) {
                if !expected.eq_ignore_ascii_case(&hex_sha256(payload)) { return Err(format!("SHA-256 mismatch for {path}.")); }
            }
            if let Some(expected) = meta.get("records").and_then(Value::as_u64) {
                let actual = record_count(path, payload)? as u64;
                if expected != actual { return Err(format!("Record-count mismatch for {path}: manifest={expected}, actual={actual}.")); }
            }
        }
    }

    let available: BTreeSet<&str> = available_pack_ids.iter().map(String::as_str).collect();
    if let Some(deps) = manifest.get("dependencies").and_then(Value::as_array) {
        let mut missing = Vec::new();
        for dep in deps {
            let required = dep.get("required").and_then(Value::as_bool).unwrap_or(true);
            let id = dep.get("id").and_then(Value::as_str).unwrap_or("");
            if required && !id.is_empty() && id != pack_id && !available.contains(id) { missing.push(id.to_string()); }
        }
        if !missing.is_empty() { return Err(format!("Missing required content pack dependencies: {}", missing.join(", "))); }
    }

    let known: [(&str, &str); 8] = [
        ("content/moves.ndjson", "moves"),
        ("content/abilities.ndjson", "abilities"),
        ("content/capabilities.ndjson", "capabilities"),
        ("content/features.ndjson", "features"),
        ("content/edges.ndjson", "edges"),
        ("content/poke_edges.ndjson", "poke_edges"),
        ("content/items.ndjson", "items"),
        ("content/species.ndjson", "species"),
    ];
    let known_paths: BTreeSet<&str> = known.iter().map(|(p, _)| *p).collect();
    let mut definitions = BTreeMap::new();
    let mut counts = BTreeMap::new();
    for (path, kind) in known {
        if let Some(payload) = entries.get(path) {
            let mut rows = parse_ndjson(path, payload)?;
            if kind == "species" { embed_species_portraits(&mut rows, &entries)?; }
            if kind == "items" { embed_item_icons(&mut rows, &entries)?; }
            for row in &rows {
                let logical = row.get("logical_id").or_else(|| row.get("id")).and_then(Value::as_str).unwrap_or("").trim();
                if logical.is_empty() { return Err(format!("{path} contains a record without logical_id/id.")); }
            }
            counts.insert(kind.to_string(), rows.len());
            definitions.insert(kind.to_string(), rows);
        }
    }

    let mut evolution_edges = Vec::new();
    let mut evolution_families = Vec::new();
    if let Some(payload) = entries.get("content/datasets/ptu_evolution_edges.json") {
        let value: Value = serde_json::from_slice(payload).map_err(|e| format!("Invalid JSON in content/datasets/ptu_evolution_edges.json: {e}"))?;
        evolution_edges = value.as_array().cloned().ok_or_else(|| "content/datasets/ptu_evolution_edges.json must contain a JSON array.".to_string())?;
        counts.insert("dataset:ptu_evolution_edges".into(), evolution_edges.len());
    }
    if let Some(payload) = entries.get("content/datasets/ptu_evolution_families.json") {
        let value: Value = serde_json::from_slice(payload).map_err(|e| format!("Invalid JSON in content/datasets/ptu_evolution_families.json: {e}"))?;
        evolution_families = value.as_array().cloned().ok_or_else(|| "content/datasets/ptu_evolution_families.json must contain a JSON array.".to_string())?;
        counts.insert("dataset:ptu_evolution_families".into(), evolution_families.len());
    }

    let mut warnings = Vec::new();
    for path in entries.keys() {
        if path.starts_with("content/") && !known_paths.contains(path.as_str()) && path != "content/datasets/ptu_evolution_edges.json" && path != "content/datasets/ptu_evolution_families.json" && !path.starts_with("content/datasets/") {
            warnings.push(format!("Unrecognized content file will be ignored: {path}"));
        }
    }

    Ok(InstalledPack {
        manifest,
        archive_sha256: hex_sha256(bytes),
        archive_filename: archive_filename.to_string(),
        counts,
        definitions,
        evolution_edges,
        evolution_families,
        enabled_rulesets: vec![enable_ruleset_id.to_string()],
        warnings,
    })
}

fn load_pack_file(path: &Path) -> Result<InstalledPack, String> {
    let bytes = fs::read(path).map_err(|e| format!("Could not read installed pack metadata {}: {e}", path.display()))?;
    serde_json::from_slice(&bytes).map_err(|e| format!("Invalid installed pack metadata {}: {e}", path.display()))
}

#[tauri::command]
fn load_content_packs(app: tauri::AppHandle) -> Result<Vec<InstalledPack>, String> {
    let dir = pack_store_dir(&app)?;
    if !dir.exists() { return Ok(Vec::new()); }
    let mut packs = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| format!("Could not list installed content packs: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|x| x.to_str()) != Some("json") { continue; }
        match load_pack_file(&path) {
            Ok(pack) => packs.push(pack),
            Err(error) => eprintln!("PTU Companion ignored invalid installed pack metadata: {error}"),
        }
    }
    packs.sort_by(|a, b| {
        let an = a.manifest.get("name").and_then(Value::as_str).unwrap_or("");
        let bn = b.manifest.get("name").and_then(Value::as_str).unwrap_or("");
        an.cmp(bn)
    });
    Ok(packs)
}

#[tauri::command]
fn import_content_pack(
    app: tauri::AppHandle,
    archive_b64: String,
    archive_filename: String,
    enable_ruleset_id: String,
    available_pack_ids: Vec<String>,
) -> Result<InstalledPack, String> {
    if !archive_filename.to_lowercase().ends_with(".ptucp") { return Err("Content packs must use the .ptucp extension.".into()); }
    let bytes = BASE64_STANDARD.decode(archive_b64.as_bytes()).map_err(|e| format!("Could not decode selected .ptucp file: {e}"))?;
    let mut pack = parse_pack(&bytes, &archive_filename, &available_pack_ids, &enable_ruleset_id)?;
    let pack_id = pack.manifest.get("id").and_then(Value::as_str).ok_or_else(|| "Pack manifest id is missing.".to_string())?.to_string();
    let dir = pack_store_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create Android content-pack directory: {e}"))?;
    let metadata_path = dir.join(format!("{pack_id}.json"));
    if metadata_path.exists() {
        if let Ok(previous) = load_pack_file(&metadata_path) {
            // Updating a pack must preserve the user's enabled/disabled Ruleset choices.
            pack.enabled_rulesets = previous.enabled_rulesets;
        }
    }
    let metadata = serde_json::to_vec_pretty(&pack).map_err(|e| format!("Could not serialize installed content pack: {e}"))?;
    let tmp = dir.join(format!("{pack_id}.json.tmp"));
    fs::write(&tmp, metadata).map_err(|e| format!("Could not persist content pack metadata: {e}"))?;
    fs::rename(&tmp, &metadata_path).map_err(|e| format!("Could not activate content pack metadata: {e}"))?;
    let version = pack.manifest.get("version").and_then(Value::as_str).unwrap_or("unknown");
    let archive_path = dir.join(format!("{pack_id}__{}.ptucp", safe_component(version)));
    fs::write(archive_path, &bytes).map_err(|e| format!("Could not retain imported .ptucp archive: {e}"))?;
    Ok(pack)
}


#[tauri::command]
fn set_content_pack_enabled(
    app: tauri::AppHandle,
    pack_id: String,
    ruleset_id: String,
    enabled: bool,
) -> Result<InstalledPack, String> {
    if !valid_id(&pack_id) { return Err(format!("Invalid pack id: {pack_id}")); }
    let dir = pack_store_dir(&app)?;
    let metadata_path = dir.join(format!("{pack_id}.json"));
    if !metadata_path.exists() { return Err(format!("Imported Content Pack is not installed: {pack_id}")); }
    let mut pack = load_pack_file(&metadata_path)?;
    let mut enabled_rulesets: BTreeSet<String> = pack.enabled_rulesets.into_iter().collect();
    if enabled { enabled_rulesets.insert(ruleset_id); } else { enabled_rulesets.remove(&ruleset_id); }
    pack.enabled_rulesets = enabled_rulesets.into_iter().collect();
    let metadata = serde_json::to_vec_pretty(&pack).map_err(|e| format!("Could not serialize Content Pack state: {e}"))?;
    let tmp = dir.join(format!("{pack_id}.json.tmp"));
    fs::write(&tmp, metadata).map_err(|e| format!("Could not persist Content Pack state: {e}"))?;
    fs::rename(&tmp, &metadata_path).map_err(|e| format!("Could not activate Content Pack state: {e}"))?;
    Ok(pack)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UninstallResult {
    pack_id: String,
    removed_archives: Vec<String>,
}

#[tauri::command]
fn uninstall_content_pack(app: tauri::AppHandle, pack_id: String) -> Result<UninstallResult, String> {
    if !valid_id(&pack_id) { return Err(format!("Invalid pack id: {pack_id}")); }
    let dir = pack_store_dir(&app)?;
    let metadata_path = dir.join(format!("{pack_id}.json"));
    if !metadata_path.exists() { return Err(format!("Imported Content Pack is not installed: {pack_id}")); }
    // Validate metadata before deleting it so a corrupt/incomplete id cannot erase arbitrary files.
    let _ = load_pack_file(&metadata_path)?;
    fs::remove_file(&metadata_path).map_err(|e| format!("Could not remove Content Pack metadata: {e}"))?;
    let prefix = format!("{}__", safe_component(&pack_id));
    let mut removed_archives = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(name) = path.file_name().and_then(|x| x.to_str()) else { continue; };
            if name.starts_with(&prefix) && name.to_lowercase().ends_with(".ptucp") {
                if fs::remove_file(&path).is_ok() { removed_archives.push(name.to_string()); }
            }
        }
    }
    Ok(UninstallResult { pack_id, removed_archives })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![load_content_packs, import_content_pack, set_content_pack_enabled, uninstall_content_pack])
        .run(tauri::generate_context!())
        .expect("error while running PTU Companion");
}
