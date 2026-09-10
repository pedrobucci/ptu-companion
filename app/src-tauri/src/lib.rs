// PTU rules/domain logic must never live here; commands only translate
// between the UI and the `ptu-domain` crate (see workspace Cargo.toml).
mod commands;
mod state;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_state = state::init(app.handle());
            app.manage(app_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::domain_status,
            commands::list_content_packs,
            commands::search_content,
            commands::resolve_definition,
            commands::active_ruleset_name,
            commands::list_trainers,
            commands::load_trainer,
            commands::save_trainer,
            commands::create_trainer,
            commands::add_pokemon,
            commands::add_roster,
            commands::add_trainer_collection_entry,
            commands::remove_trainer_collection_entry,
            commands::add_pokemon_collection_entry,
            commands::remove_pokemon_collection_entry,
            commands::add_roster_membership,
            commands::remove_roster_membership,
            commands::transfer_to_storage,
            commands::transfer_to_carried,
            commands::resolve_damage,
            commands::resolve_type_effectiveness,
            commands::next_round,
            commands::end_scene,
            commands::new_day,
            commands::record_usage,
            commands::level_up_pokemon,
            commands::validate_pokemon_level,
            commands::apply_pokemon_level,
            commands::record_gm_override,
            commands::level_up_trainer,
            commands::resolve_trainer_core_stats,
            commands::resolve_trainer_advancement,
            commands::preview_trainer_stat_allocation,
            commands::save_trainer_stat_allocation,
            commands::respec_progression,
            commands::reallocate_resource_grant,
            commands::get_trainer_build_context,
            commands::save_trainer_build_draft,
            commands::load_trainer_build_draft,
            commands::discard_trainer_build_draft,
            commands::preview_trainer_build,
            commands::commit_trainer_build,
            commands::preview_trainer_advancement,
            commands::commit_trainer_advancement,
            commands::preview_trainer_gm_change,
            commands::commit_trainer_gm_change,
            commands::preview_trainer_respec,
            commands::commit_trainer_respec,
            commands::preview_trainer_milestone_reconciliation,
            commands::commit_trainer_milestone_reconciliation,
            commands::resolve_modifier_value,
            commands::get_shop,
            commands::save_shop,
            commands::checkout_buy,
            commands::checkout_sell,
            commands::equip_item,
            commands::unequip_slot,
            commands::export_trainer_pack,
            commands::import_trainer_pack,
            commands::export_backup,
            commands::import_backup,
            commands::get_content_context,
            commands::set_active_ruleset,
            commands::browse_selectable_content,
            commands::get_definition_version,
            commands::refresh_bundled_content,
            commands::save_authored_definition,
            commands::soft_delete_definition,
            commands::reactivate_definition,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
