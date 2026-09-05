//! Tauri commands: thin translation between the UI and `ptu-domain`. No PTU
//! rule ever lives here — every command either reads state or calls exactly
//! one domain function and maps its `Result` to `Result<T, String>` (the
//! error's `Display` text) for IPC.

use ptu_domain::content::{self, repository::ContentPackRow, resolver::ResolvedDefinition, search::SearchHit, ContentKind};
use ptu_domain::engine::{
    self, combat_reset::OwnerKind, modifier::ResolvedValue, progression::PokemonLevelUpResult,
    progression::TrainerLevelUpResult, resolved_move::ResolvedDamage, roster::RosterError, shop::ShopPreset,
    storage::StorageTransferOutcome, type_effectiveness::TypeEffectivenessResult, validation::ValidationIssue,
};
use ptu_domain::portability::{backup, trainer_pack};
use ptu_domain::profile::model::{PokemonInstance, RosterRecord, TrainerProfile, TrainerSummary};
use ptu_domain::profile::repository as profile_repo;
use serde_json::Value;
use tauri::State;

use crate::state::AppState;

fn to_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

// ---------------------------------------------------------------------
// Content: search, packs, resolution
// ---------------------------------------------------------------------

#[tauri::command]
pub fn list_content_packs(state: State<AppState>) -> Result<Vec<ContentPackRow>, String> {
    let conn = state.definitions.lock().map_err(to_err)?;
    content::repository::list_packs(&conn).map_err(to_err)
}

#[tauri::command]
pub fn search_content(
    state: State<AppState>,
    query: String,
    kind: Option<String>,
    limit: i64,
    offset: i64,
) -> Result<Vec<SearchHit>, String> {
    let conn = state.definitions.lock().map_err(to_err)?;
    let kind = kind.and_then(|k| ContentKind::from_kind_slug(&k));
    content::search::search(&conn, &query, kind, limit, offset).map_err(to_err)
}

#[tauri::command]
pub fn resolve_definition(
    state: State<AppState>,
    kind: String,
    logical_id: String,
) -> Result<Option<ResolvedDefinition>, String> {
    let conn = state.definitions.lock().map_err(to_err)?;
    let kind = ContentKind::from_kind_slug(&kind).ok_or_else(|| format!("unknown content kind \"{kind}\""))?;
    content::resolver::resolve_definition(&conn, &state.ruleset, kind, &logical_id).map_err(to_err)
}

#[tauri::command]
pub fn active_ruleset_name(state: State<AppState>) -> String {
    state.ruleset.name.clone()
}

// ---------------------------------------------------------------------
// Trainer profile
// ---------------------------------------------------------------------

#[tauri::command]
pub fn list_trainers(state: State<AppState>) -> Result<Vec<TrainerSummary>, String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    profile_repo::list_trainer_summaries(&conn).map_err(to_err)
}

#[tauri::command]
pub fn load_trainer(state: State<AppState>, trainer_id: String) -> Result<Option<TrainerProfile>, String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    profile_repo::load_trainer_profile(&conn, &trainer_id).map_err(to_err)
}

#[tauri::command]
pub fn save_trainer(state: State<AppState>, profile: TrainerProfile) -> Result<(), String> {
    let mut conn = state.profiles.lock().map_err(to_err)?;
    profile_repo::save_trainer_profile(&mut conn, &profile).map_err(to_err)
}

#[tauri::command]
pub fn create_trainer(state: State<AppState>, name: String) -> Result<TrainerProfile, String> {
    let mut conn = state.profiles.lock().map_err(to_err)?;
    let profile = TrainerProfile {
        id: profile_repo::new_id(),
        name,
        level: 1,
        exp: 0,
        money: 0,
        ..TrainerProfile::default()
    };
    profile_repo::save_trainer_profile(&mut conn, &profile).map_err(to_err)?;
    Ok(profile)
}

#[tauri::command]
pub fn add_pokemon(
    state: State<AppState>,
    trainer_id: String,
    species_definition_id: String,
    nickname: Option<String>,
    level: i64,
) -> Result<PokemonInstance, String> {
    let mut conn = state.profiles.lock().map_err(to_err)?;
    let pokemon = PokemonInstance {
        id: profile_repo::new_id(),
        species_definition_id,
        nickname,
        level,
        exp: None,
        capture_ball_item_id: None,
        injuries: 0,
        held_item_id: None,
        storage_state: ptu_domain::profile::model::StorageState::Carried,
        roster_memberships: vec![],
        battle_state: None,
        ..Default::default()
    };
    profile_repo::add_pokemon_to_trainer(&mut conn, &trainer_id, &pokemon).map_err(to_err)?;
    Ok(pokemon)
}

#[tauri::command]
pub fn add_roster(state: State<AppState>, trainer_id: String, name: String, max_members: Option<i64>) -> Result<RosterRecord, String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    let roster = RosterRecord {
        id: profile_repo::new_id(),
        name,
        active: true,
        max_members,
        rules: Value::Object(Default::default()),
    };
    profile_repo::add_roster(&conn, &trainer_id, &roster).map_err(to_err)?;
    Ok(roster)
}

// ---------------------------------------------------------------------
// Mechanical collections (T09a): minimal management commands. `collection`
// is validated against a fixed allowlist before it ever reaches SQL — see
// `profile_repo::{trainer,pokemon}_collection_table`.
// ---------------------------------------------------------------------

#[tauri::command]
pub fn add_trainer_collection_entry(state: State<AppState>, trainer_id: String, collection: String, entry: Value) -> Result<(), String> {
    let table = profile_repo::trainer_collection_table(&collection)
        .ok_or_else(|| format!("unknown trainer collection \"{collection}\""))?;
    let conn = state.profiles.lock().map_err(to_err)?;
    profile_repo::add_collection_entry(&conn, table, "trainer_id", &trainer_id, &entry).map_err(to_err)
}

#[tauri::command]
pub fn remove_trainer_collection_entry(state: State<AppState>, trainer_id: String, collection: String, definition_version_id: String) -> Result<(), String> {
    let table = profile_repo::trainer_collection_table(&collection)
        .ok_or_else(|| format!("unknown trainer collection \"{collection}\""))?;
    let conn = state.profiles.lock().map_err(to_err)?;
    profile_repo::remove_collection_entry(&conn, table, "trainer_id", &trainer_id, &definition_version_id).map_err(to_err)
}

#[tauri::command]
pub fn add_pokemon_collection_entry(state: State<AppState>, pokemon_id: String, collection: String, entry: Value) -> Result<(), String> {
    let table = profile_repo::pokemon_collection_table(&collection)
        .ok_or_else(|| format!("unknown pokemon collection \"{collection}\""))?;
    let conn = state.profiles.lock().map_err(to_err)?;
    profile_repo::add_collection_entry(&conn, table, "pokemon_id", &pokemon_id, &entry).map_err(to_err)
}

#[tauri::command]
pub fn remove_pokemon_collection_entry(state: State<AppState>, pokemon_id: String, collection: String, definition_version_id: String) -> Result<(), String> {
    let table = profile_repo::pokemon_collection_table(&collection)
        .ok_or_else(|| format!("unknown pokemon collection \"{collection}\""))?;
    let conn = state.profiles.lock().map_err(to_err)?;
    profile_repo::remove_collection_entry(&conn, table, "pokemon_id", &pokemon_id, &definition_version_id).map_err(to_err)
}

// ---------------------------------------------------------------------
// Rosters / storage
// ---------------------------------------------------------------------

#[tauri::command]
pub fn add_roster_membership(state: State<AppState>, roster_id: String, pokemon_id: String) -> Result<(), String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    engine::roster::add_membership(&conn, &roster_id, &pokemon_id).map_err(|e| match e {
        RosterError::AtCapacity { roster_id, max_members } => {
            format!("roster \"{roster_id}\" is at capacity ({max_members} members)")
        }
        other => other.to_string(),
    })
}

#[tauri::command]
pub fn remove_roster_membership(state: State<AppState>, roster_id: String, pokemon_id: String) -> Result<(), String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    engine::roster::remove_membership(&conn, &roster_id, &pokemon_id).map_err(to_err)
}

#[tauri::command]
pub fn transfer_to_storage(state: State<AppState>, pokemon_id: String) -> Result<StorageTransferOutcome, String> {
    let mut conn = state.profiles.lock().map_err(to_err)?;
    engine::storage::transfer_to_storage(&mut conn, &pokemon_id).map_err(to_err)
}

#[tauri::command]
pub fn transfer_to_carried(state: State<AppState>, pokemon_id: String) -> Result<(), String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    engine::storage::transfer_to_carried(&conn, &pokemon_id).map_err(to_err)
}

// ---------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------

#[tauri::command]
pub fn resolve_damage(
    state: State<AppState>,
    content_pack_id: String,
    move_db: i64,
    move_type: String,
    actor_types: Vec<String>,
    attack_stat: i64,
) -> Result<ResolvedDamage, String> {
    let conn = state.definitions.lock().map_err(to_err)?;
    let damage_chart = engine::datasets::load_damage_chart(&conn, &content_pack_id).map_err(to_err)?;
    engine::resolved_move::resolve_damage(move_db, &move_type, &actor_types, attack_stat, &damage_chart).map_err(to_err)
}

#[tauri::command]
pub fn resolve_type_effectiveness(
    state: State<AppState>,
    content_pack_id: String,
    attack_type: String,
    defender_types: Vec<String>,
) -> Result<Option<TypeEffectivenessResult>, String> {
    let conn = state.definitions.lock().map_err(to_err)?;
    let matchups = engine::datasets::load_type_matchups(&conn, &content_pack_id).map_err(to_err)?;
    let scale = engine::datasets::load_type_effectiveness_scale(&conn, &content_pack_id).map_err(to_err)?;
    Ok(engine::type_effectiveness::resolve_type_effectiveness(&attack_type, &defender_types, &matchups, &scale))
}

#[tauri::command]
pub fn next_round(state: State<AppState>, trainer_id: String) -> Result<usize, String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    engine::combat_reset::next_round(&conn, &trainer_id).map_err(to_err)
}

#[tauri::command]
pub fn end_scene(state: State<AppState>, trainer_id: String) -> Result<usize, String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    engine::combat_reset::end_scene(&conn, &trainer_id).map_err(to_err)
}

#[tauri::command]
pub fn new_day(state: State<AppState>, trainer_id: String) -> Result<usize, String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    engine::combat_reset::new_day(&conn, &trainer_id).map_err(to_err)
}

#[tauri::command]
pub fn record_usage(
    state: State<AppState>,
    owner_is_pokemon: bool,
    owner_id: String,
    resource_key: String,
    scope: String,
    uses_remaining: Option<i64>,
) -> Result<(), String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    let owner = if owner_is_pokemon { OwnerKind::Pokemon } else { OwnerKind::Trainer };
    let scope = match scope.as_str() {
        "round" => engine::combat_reset::Scope::Round,
        "scene" => engine::combat_reset::Scope::Scene,
        "day" => engine::combat_reset::Scope::Day,
        other => return Err(format!("unknown scope \"{other}\"")),
    };
    engine::combat_reset::record_usage(&conn, owner, &owner_id, &resource_key, scope, uses_remaining).map_err(to_err)
}

// ---------------------------------------------------------------------
// Progression / respec
// ---------------------------------------------------------------------

#[tauri::command]
pub fn level_up_pokemon(state: State<AppState>, content_pack_id: String, level: i64) -> Result<PokemonLevelUpResult, String> {
    let conn = state.definitions.lock().map_err(to_err)?;
    let rules = engine::datasets::load_pokemon_progression_rules(&conn, &content_pack_id).map_err(to_err)?;
    Ok(engine::progression::resolve_pokemon_level_up(level, &rules))
}

/// Structured validation for a target Pokémon level (spec §25/§17.2's
/// bounds check — see T05 for why full Base Stat Relation isn't included).
/// The UI calls this before applying a level change; a non-empty result
/// with `override_allowed: true` is what offers a GM Override.
#[tauri::command]
pub fn validate_pokemon_level(state: State<AppState>, content_pack_id: String, level: i64) -> Result<Vec<ValidationIssue>, String> {
    let conn = state.definitions.lock().map_err(to_err)?;
    let rules = engine::datasets::load_pokemon_progression_rules(&conn, &content_pack_id).map_err(to_err)?;
    Ok(engine::validation::validate_pokemon_level(level, &rules))
}

/// Applies a validated (or GM-overridden) level change to one Pokémon.
#[tauri::command]
pub fn apply_pokemon_level(state: State<AppState>, pokemon_id: String, new_level: i64) -> Result<(), String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    profile_repo::update_pokemon_level(&conn, &pokemon_id, new_level).map_err(to_err)
}

/// Records a GM Override's provenance in the Trainer's timeline (spec §16:
/// "a successful override creates persistent provenance/history"). Only
/// meaningful for an issue the UI got from `validate_pokemon_level` with
/// `override_allowed: true` — `build_override_history_event` itself refuses
/// to build an event otherwise.
#[tauri::command]
pub fn record_gm_override(state: State<AppState>, trainer_id: String, issue: ValidationIssue, note: Option<String>) -> Result<(), String> {
    let event = engine::validation::build_override_history_event(&issue, note.as_deref())
        .ok_or_else(|| "this validation issue does not allow a GM override".to_string())?;
    let conn = state.profiles.lock().map_err(to_err)?;
    profile_repo::append_history_event(&conn, &trainer_id, &event).map_err(to_err)
}

#[tauri::command]
pub fn level_up_trainer(
    state: State<AppState>,
    content_pack_id: String,
    level: i64,
) -> Result<Option<TrainerLevelUpResult>, String> {
    let conn = state.definitions.lock().map_err(to_err)?;
    let progression = engine::datasets::load_trainer_progression(&conn, &content_pack_id).map_err(to_err)?;
    let milestones = engine::datasets::load_trainer_milestones(&conn, &content_pack_id).map_err(to_err)?;
    Ok(engine::progression::resolve_trainer_level_up(level, &progression, &milestones))
}

/// T15A: PTU 1.05 Core Step 6 combat stats/derived capabilities, resolved
/// with base/final/breakdown per value. Never computed in the UI — see
/// `ptu_domain::engine::trainer_core`.
#[tauri::command]
pub fn resolve_trainer_core_stats(
    state: State<AppState>,
    trainer_id: String,
    content_pack_id: String,
) -> Result<engine::trainer_core::TrainerCoreResult, String> {
    let definitions = state.definitions.lock().map_err(to_err)?;
    let progression = engine::datasets::load_trainer_progression(&definitions, &content_pack_id).map_err(to_err)?;
    drop(definitions);

    let profiles = state.profiles.lock().map_err(to_err)?;
    let profile = profile_repo::load_trainer_profile(&profiles, &trainer_id)
        .map_err(to_err)?
        .ok_or_else(|| format!("trainer \"{trainer_id}\" not found"))?;

    Ok(engine::trainer_core::resolve_trainer_core(
        profile.level,
        &profile.stat_allocation,
        &profile.skills,
        profile.weight_lb,
        &profile.gm_grants,
        &progression,
    ))
}

/// T15A: per-level advancement/milestone provenance (universal Stat Point
/// grant, ordinary Feature/Edge grants, milestone choice/pending state) up
/// through the Trainer's current level. Full advancement UX (making a
/// milestone choice) is T16; this only resolves what's already recorded.
#[tauri::command]
pub fn resolve_trainer_advancement(
    state: State<AppState>,
    trainer_id: String,
    content_pack_id: String,
) -> Result<Vec<engine::trainer_core::AdvancementRecord>, String> {
    let definitions = state.definitions.lock().map_err(to_err)?;
    let progression = engine::datasets::load_trainer_progression(&definitions, &content_pack_id).map_err(to_err)?;
    let milestones = engine::datasets::load_trainer_milestones(&definitions, &content_pack_id).map_err(to_err)?;
    drop(definitions);

    let profiles = state.profiles.lock().map_err(to_err)?;
    let profile = profile_repo::load_trainer_profile(&profiles, &trainer_id)
        .map_err(to_err)?
        .ok_or_else(|| format!("trainer \"{trainer_id}\" not found"))?;

    Ok(engine::trainer_core::resolve_advancement(profile.level, &profile.progression, &progression, &milestones))
}

/// T13C1: resolves what the Trainer's stats would become if `desired` were
/// saved, without persisting anything — the guided allocation panel's live
/// preview. `desired` is one combined points-per-stat number; Rust alone
/// decides how it splits into provenance-correct Creation/LevelUp entries
/// (`engine::trainer_core::build_normal_allocation_entries`) and always
/// carries the Trainer's existing Milestone/GM Override entries forward
/// untouched (`merge_with_preserved_provenance`).
#[tauri::command]
pub fn preview_trainer_stat_allocation(
    state: State<AppState>,
    trainer_id: String,
    content_pack_id: String,
    desired: Vec<engine::trainer_core::StatAllocationDraftEntry>,
) -> Result<engine::trainer_core::TrainerCoreResult, String> {
    let definitions = state.definitions.lock().map_err(to_err)?;
    let progression = engine::datasets::load_trainer_progression(&definitions, &content_pack_id).map_err(to_err)?;
    drop(definitions);

    let profiles = state.profiles.lock().map_err(to_err)?;
    let profile = profile_repo::load_trainer_profile(&profiles, &trainer_id)
        .map_err(to_err)?
        .ok_or_else(|| format!("trainer \"{trainer_id}\" not found"))?;

    let normal_entries = engine::trainer_core::build_normal_allocation_entries(&desired, profile.level, &progression);
    let allocation = engine::trainer_core::merge_with_preserved_provenance(normal_entries, &profile.stat_allocation);

    Ok(engine::trainer_core::resolve_trainer_core(
        profile.level,
        &allocation,
        &profile.skills,
        profile.weight_lb,
        &profile.gm_grants,
        &progression,
    ))
}

/// T13C1: persists `desired` the same way `preview_trainer_stat_allocation`
/// resolves it, but only if the merged allocation carries no Error-severity
/// `ValidationIssue` — an overridable error (e.g. overspending) still blocks
/// this path, matching the plan's "Save is blocked while Error-severity
/// validation issues remain" constraint. Uses the narrow single-column
/// `update_trainer_stat_allocation` mutation rather than the whole-profile
/// save, so no other field on the Trainer is touched.
#[tauri::command]
pub fn save_trainer_stat_allocation(
    state: State<AppState>,
    trainer_id: String,
    content_pack_id: String,
    desired: Vec<engine::trainer_core::StatAllocationDraftEntry>,
) -> Result<(), String> {
    let definitions = state.definitions.lock().map_err(to_err)?;
    let progression = engine::datasets::load_trainer_progression(&definitions, &content_pack_id).map_err(to_err)?;
    drop(definitions);

    let profiles = state.profiles.lock().map_err(to_err)?;
    let profile = profile_repo::load_trainer_profile(&profiles, &trainer_id)
        .map_err(to_err)?
        .ok_or_else(|| format!("trainer \"{trainer_id}\" not found"))?;

    let normal_entries = engine::trainer_core::build_normal_allocation_entries(&desired, profile.level, &progression);
    let allocation = engine::trainer_core::merge_with_preserved_provenance(normal_entries, &profile.stat_allocation);

    let issues = engine::trainer_core::validate_stat_allocation(&allocation, profile.level, &progression);
    if let Some(blocking) = issues.iter().find(|i| i.severity == engine::validation::Severity::Error) {
        return Err(blocking.message.clone());
    }

    profile_repo::update_trainer_stat_allocation(&profiles, &trainer_id, &allocation).map_err(to_err)
}

// ---------------------------------------------------------------------
// T13D1: Trainer build context/drafts (Trainer Build + Visual Identity
// Corrective REPLAN). `get_trainer_build_context` and the draft CRUD
// commands are real — pure data assembly / opaque persistence, no rule
// evaluation. Every preview/commit command below them is a frozen-contract
// stub: it returns `BuildError::NotYetImplemented` rather than a fabricated
// success, since actual build/advancement/GM/respec rule evaluation is
// T13D3/T13D4 scope. See `ptu_domain::engine::trainer_build`'s module doc.
// ---------------------------------------------------------------------

/// Real: assembles the source-backed skills/rank/Skill-Edge/Elemental-
/// Connection/milestone-stream catalog (from the `trainer_build_rules`
/// dataset) plus, when `trainer_id` is given, the existing Trainer's
/// current build status and read model. `base_revision`/`rules_fingerprint`
/// are real opaque hashes a future `commit_trainer_build` can compare
/// against — never a placeholder string.
#[tauri::command]
pub fn get_trainer_build_context(
    state: State<AppState>,
    trainer_id: Option<String>,
    content_pack_id: String,
) -> Result<engine::trainer_build::BuildContext, String> {
    let definitions = state.definitions.lock().map_err(to_err)?;
    let rules = engine::datasets::load_trainer_build_rules(&definitions, &content_pack_id).map_err(to_err)?;
    drop(definitions);

    let existing_profile = match &trainer_id {
        Some(id) => {
            let profiles = state.profiles.lock().map_err(to_err)?;
            profile_repo::load_trainer_profile(&profiles, id).map_err(to_err)?
        }
        None => None,
    };

    let rules_fingerprint = engine::trainer_build::compute_rules_fingerprint(&content_pack_id, &rules);
    let build_status = existing_profile
        .as_ref()
        .map(|p| engine::trainer_build::resolve_build_state(&p.build_state).status)
        .unwrap_or(engine::trainer_build::BuildStatus::Legacy);
    let base_revision = existing_profile
        .as_ref()
        .map(|p| engine::trainer_build::compute_base_revision(p, &rules_fingerprint))
        .unwrap_or_else(|| rules_fingerprint.clone());

    Ok(engine::trainer_build::BuildContext {
        base_revision,
        rules_fingerprint,
        rules,
        build_status,
        existing_profile,
    })
}

/// Real: opaque draft persistence only — see `profile_repo::save_trainer_build_draft`.
#[tauri::command]
pub fn save_trainer_build_draft(
    state: State<AppState>,
    draft_id: Option<String>,
    trainer_id: Option<String>,
    intent: Value,
) -> Result<String, String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    profile_repo::save_trainer_build_draft(&conn, draft_id.as_deref(), trainer_id.as_deref(), &intent).map_err(to_err)
}

#[tauri::command]
pub fn load_trainer_build_draft(state: State<AppState>, draft_id: String) -> Result<Option<Value>, String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    profile_repo::load_trainer_build_draft(&conn, &draft_id).map_err(to_err)
}

#[tauri::command]
pub fn discard_trainer_build_draft(state: State<AppState>, draft_id: String) -> Result<(), String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    profile_repo::discard_trainer_build_draft(&conn, &draft_id).map_err(to_err)
}

#[tauri::command]
pub fn preview_trainer_build(
    state: State<AppState>,
    request: engine::trainer_build::PreviewTrainerBuildRequest,
) -> Result<Value, String> {
    let _ = (&state, &request);
    Err(engine::trainer_build::not_yet_implemented("preview_trainer_build").to_string())
}

#[tauri::command]
pub fn commit_trainer_build(
    state: State<AppState>,
    request: engine::trainer_build::CommitTrainerBuildRequest,
) -> Result<Value, String> {
    let _ = (&state, &request);
    Err(engine::trainer_build::not_yet_implemented("commit_trainer_build").to_string())
}

#[tauri::command]
pub fn preview_trainer_advancement(
    state: State<AppState>,
    request: engine::trainer_build::PreviewTrainerAdvancementRequest,
) -> Result<Value, String> {
    let _ = (&state, &request);
    Err(engine::trainer_build::not_yet_implemented("preview_trainer_advancement").to_string())
}

#[tauri::command]
pub fn commit_trainer_advancement(
    state: State<AppState>,
    request: engine::trainer_build::CommitTrainerAdvancementRequest,
) -> Result<Value, String> {
    let _ = (&state, &request);
    Err(engine::trainer_build::not_yet_implemented("commit_trainer_advancement").to_string())
}

#[tauri::command]
pub fn preview_trainer_gm_change(
    state: State<AppState>,
    request: engine::trainer_build::PreviewTrainerGmChangeRequest,
) -> Result<Value, String> {
    let _ = (&state, &request);
    Err(engine::trainer_build::not_yet_implemented("preview_trainer_gm_change").to_string())
}

#[tauri::command]
pub fn commit_trainer_gm_change(
    state: State<AppState>,
    request: engine::trainer_build::CommitTrainerGmChangeRequest,
) -> Result<Value, String> {
    let _ = (&state, &request);
    Err(engine::trainer_build::not_yet_implemented("commit_trainer_gm_change").to_string())
}

#[tauri::command]
pub fn preview_trainer_respec(
    state: State<AppState>,
    request: engine::trainer_build::PreviewTrainerRespecRequest,
) -> Result<Value, String> {
    let _ = (&state, &request);
    Err(engine::trainer_build::not_yet_implemented("preview_trainer_respec").to_string())
}

#[tauri::command]
pub fn commit_trainer_respec(
    state: State<AppState>,
    request: engine::trainer_build::CommitTrainerRespecRequest,
) -> Result<Value, String> {
    let _ = (&state, &request);
    Err(engine::trainer_build::not_yet_implemented("commit_trainer_respec").to_string())
}

#[tauri::command]
pub fn respec_progression(state: State<AppState>, trainer_id: String, new_progression: Vec<Value>) -> Result<(), String> {
    let mut conn = state.profiles.lock().map_err(to_err)?;
    engine::respec::respec_trainer_progression(&mut conn, &trainer_id, &new_progression).map_err(to_err)
}

#[tauri::command]
pub fn reallocate_resource_grant(
    state: State<AppState>,
    trainer_id: String,
    grant_id: String,
    new_allocation: Value,
) -> Result<Value, String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    engine::respec::apply_resource_reallocation(&conn, &trainer_id, &grant_id, new_allocation).map_err(to_err)
}

#[tauri::command]
pub fn resolve_modifier_value(state: State<AppState>, base: f64, modifiers: Vec<engine::modifier::Modifier>) -> ResolvedValue {
    let _ = &state; // pure computation; state unused but kept for a consistent command signature
    engine::modifier::resolve_value(base, &modifiers)
}

// ---------------------------------------------------------------------
// Inventory / equipment / shop
// ---------------------------------------------------------------------

#[tauri::command]
pub fn get_shop(state: State<AppState>, shop_id: String) -> Result<Option<ShopPreset>, String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    engine::shop::load_shop_preset(&conn, &shop_id).map_err(to_err)
}

#[tauri::command]
pub fn save_shop(state: State<AppState>, trainer_id: String, preset: ShopPreset) -> Result<(), String> {
    let mut conn = state.profiles.lock().map_err(to_err)?;
    engine::shop::save_shop_preset(&mut conn, &trainer_id, &preset).map_err(to_err)
}

#[tauri::command]
pub fn checkout_buy(
    state: State<AppState>,
    trainer_id: String,
    shop_id: Option<String>,
    lines: Vec<engine::shop::CartLine>,
) -> Result<i64, String> {
    let mut conn = state.profiles.lock().map_err(to_err)?;
    engine::shop::checkout_buy(&mut conn, &trainer_id, shop_id.as_deref(), &lines).map_err(to_err)
}

#[tauri::command]
pub fn checkout_sell(
    state: State<AppState>,
    trainer_id: String,
    shop_id: Option<String>,
    lines: Vec<engine::shop::CartLine>,
) -> Result<i64, String> {
    let mut conn = state.profiles.lock().map_err(to_err)?;
    engine::shop::checkout_sell(&mut conn, &trainer_id, shop_id.as_deref(), &lines).map_err(to_err)
}

#[tauri::command]
pub fn equip_item(state: State<AppState>, trainer_id: String, slot_key: String, item_id: String) -> Result<(), String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    engine::equipment::equip_item(&conn, &trainer_id, &slot_key, &item_id).map_err(to_err)
}

#[tauri::command]
pub fn unequip_slot(state: State<AppState>, trainer_id: String, slot_key: String) -> Result<(), String> {
    let conn = state.profiles.lock().map_err(to_err)?;
    engine::equipment::unequip_slot(&conn, &trainer_id, &slot_key).map_err(to_err)
}

// ---------------------------------------------------------------------
// Portability: .ptutrainer / .ptubackup (spec §22.2/22.3)
// ---------------------------------------------------------------------

/// Exports one Trainer (with referenced homebrew embedded) directly to
/// `dest_path`, chosen by the UI via the dialog plugin's save picker.
#[tauri::command]
pub fn export_trainer_pack(state: State<AppState>, trainer_id: String, dest_path: String) -> Result<Vec<String>, String> {
    let definitions = state.definitions.lock().map_err(to_err)?;
    let profiles = state.profiles.lock().map_err(to_err)?;
    let outcome = trainer_pack::export_trainer_pack(&definitions, &profiles, &trainer_id).map_err(to_err)?;
    std::fs::write(&dest_path, &outcome.bytes).map_err(to_err)?;
    Ok(outcome.embedded_pack_ids)
}

/// Imports a `.ptutrainer` file chosen by the UI via the dialog plugin's
/// open picker.
#[tauri::command]
pub fn import_trainer_pack(state: State<AppState>, src_path: String) -> Result<String, String> {
    let bytes = std::fs::read(&src_path).map_err(to_err)?;
    let mut definitions = state.definitions.lock().map_err(to_err)?;
    let mut profiles = state.profiles.lock().map_err(to_err)?;
    let outcome = trainer_pack::import_trainer_pack(&mut definitions, &mut profiles, &bytes).map_err(to_err)?;
    Ok(outcome.trainer_id)
}

/// Exports every Trainer + every imported content pack + the active
/// ruleset to `dest_path`.
#[tauri::command]
pub fn export_backup(state: State<AppState>, dest_path: String) -> Result<(), String> {
    let definitions = state.definitions.lock().map_err(to_err)?;
    let profiles = state.profiles.lock().map_err(to_err)?;
    let ruleset_value = serde_json::to_value(&state.ruleset).ok();
    let outcome = backup::export_backup(&definitions, &profiles, ruleset_value.as_ref()).map_err(to_err)?;
    std::fs::write(&dest_path, &outcome.bytes).map_err(to_err)?;
    Ok(())
}

#[tauri::command]
pub fn import_backup(state: State<AppState>, src_path: String) -> Result<(), String> {
    let bytes = std::fs::read(&src_path).map_err(to_err)?;
    let mut definitions = state.definitions.lock().map_err(to_err)?;
    let mut profiles = state.profiles.lock().map_err(to_err)?;
    backup::import_backup(&mut definitions, &mut profiles, &bytes).map_err(to_err)?;
    Ok(())
}

// ---------------------------------------------------------------------
// Content editor (spec §21)
// ---------------------------------------------------------------------

/// Saves an authored/edited definition into a GM-owned homebrew pack —
/// never mutates the pack it might be based on (spec §21/§39).
#[tauri::command]
pub fn save_authored_definition(
    state: State<AppState>,
    pack_id: String,
    pack_name: String,
    priority: i64,
    kind: String,
    record: Value,
) -> Result<(), String> {
    let kind = ContentKind::from_kind_slug(&kind).ok_or_else(|| format!("unknown content kind \"{kind}\""))?;
    let mut conn = state.definitions.lock().map_err(to_err)?;
    content::authoring::save_definition(&mut conn, &pack_id, &pack_name, priority, kind, &record).map_err(to_err)
}

#[tauri::command]
pub fn soft_delete_definition(state: State<AppState>, kind: String, definition_version_id: String) -> Result<(), String> {
    let kind = ContentKind::from_kind_slug(&kind).ok_or_else(|| format!("unknown content kind \"{kind}\""))?;
    let conn = state.definitions.lock().map_err(to_err)?;
    content::authoring::soft_delete_definition(&conn, kind, &definition_version_id).map_err(to_err)
}

#[tauri::command]
pub fn reactivate_definition(state: State<AppState>, kind: String, definition_version_id: String) -> Result<(), String> {
    let kind = ContentKind::from_kind_slug(&kind).ok_or_else(|| format!("unknown content kind \"{kind}\""))?;
    let conn = state.definitions.lock().map_err(to_err)?;
    content::authoring::reactivate_definition(&conn, kind, &definition_version_id).map_err(to_err)
}

// ---------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------

#[tauri::command]
pub fn domain_status() -> String {
    format!("ptu-domain {}", ptu_domain::version())
}
