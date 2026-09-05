//! Trainer profile persistence: whole-profile save/load plus a lightweight
//! summary listing that never hydrates Pokémon/rosters/inventory/grants/
//! history/NPCs for any Trainer other than the one actually being opened
//! (spec 26).
//!
//! `save_trainer_profile` clears and reinserts every child row for the
//! Trainer inside one transaction. This is the simplest correct way to
//! guarantee the whole graph stays consistent for T04's scope (create/
//! close/reopen without loss); tasks that mutate one narrow slice at a
//! time under load (combat rounds, inventory transactions, roster edits)
//! should add their own targeted repository functions against this same
//! schema rather than round-tripping the whole profile per action.

use rusqlite::{params, Connection};
use serde_json::Value;

use super::model::{
    BattleState, CombatState, InventoryRecord, ItemStack, PokemonInstance, RosterRecord,
    StorageState, TrainerProfile, TrainerStatAllocation, TrainerSummary,
};
use crate::error::ProfileError;

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// Adds one Pokémon to an existing Trainer without touching anything else
/// (T06/T07's targeted-mutation pattern, not a whole-profile resave). Fails
/// if `trainer_id` doesn't exist (foreign key) or `pokemon.id` is already
/// used.
pub fn add_pokemon_to_trainer(conn: &mut Connection, trainer_id: &str, pokemon: &PokemonInstance) -> Result<(), ProfileError> {
    let now = now();
    let tx = conn.transaction()?;

    let next_sequence: i64 = tx.query_row(
        "SELECT COALESCE(MAX(sequence) + 1, 0) FROM pokemon_instances WHERE trainer_id = ?1",
        params![trainer_id],
        |row| row.get(0),
    )?;
    tx.execute(
        "INSERT INTO pokemon_instances (id, trainer_id, species_definition_id, nickname, level, exp, capture_ball_item_id, injuries, held_item_id, storage_state, sequence, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)",
        params![
            pokemon.id,
            trainer_id,
            pokemon.species_definition_id,
            pokemon.nickname,
            pokemon.level,
            pokemon.exp,
            pokemon.capture_ball_item_id,
            pokemon.injuries,
            pokemon.held_item_id,
            pokemon.storage_state.as_str(),
            next_sequence,
            now,
        ],
    )?;
    for (index, roster_id) in pokemon.roster_memberships.iter().enumerate() {
        tx.execute(
            "INSERT INTO roster_memberships (roster_id, pokemon_id, sequence) VALUES (?1, ?2, ?3)",
            params![roster_id, pokemon.id, index as i64],
        )?;
    }
    for (field, table) in POKEMON_COLLECTION_TABLES {
        let entries: &[Value] = match field {
            "moves" => &pokemon.moves,
            "abilities" => &pokemon.abilities,
            "poke_edges" => &pokemon.poke_edges,
            "capabilities" => &pokemon.capabilities,
            _ => unreachable!(),
        };
        insert_definition_ref_collection(&tx, table, "pokemon_id", &pokemon.id, entries, &now)?;
    }

    tx.commit()?;
    Ok(())
}

/// Creates one new Roster for a Trainer without touching anything else.
pub fn add_roster(conn: &Connection, trainer_id: &str, roster: &RosterRecord) -> rusqlite::Result<()> {
    let next_sequence: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sequence) + 1, 0) FROM rosters WHERE trainer_id = ?1",
        params![trainer_id],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT INTO rosters (id, trainer_id, name, active, max_members, sequence, rules_json, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![roster.id, trainer_id, roster.name, roster.active, roster.max_members, next_sequence, to_json(&roster.rules), now()],
    )?;
    Ok(())
}

/// Sets one Pokémon's level without touching anything else.
pub fn update_pokemon_level(conn: &Connection, pokemon_id: &str, new_level: i64) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE pokemon_instances SET level = ?2, updated_at = ?3 WHERE id = ?1",
        params![pokemon_id, new_level, now()],
    )?;
    Ok(())
}

/// Sets a Trainer's Stat Point allocation without touching anything else
/// (T13C1) — the same narrow-mutation pattern as [`update_pokemon_level`],
/// used by the guided allocation panel's save action instead of
/// round-tripping the whole profile.
pub fn update_trainer_stat_allocation(conn: &Connection, trainer_id: &str, allocation: &TrainerStatAllocation) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE trainers SET stat_allocation_json = ?2, updated_at = ?3 WHERE id = ?1",
        params![trainer_id, to_json_typed(allocation), now()],
    )?;
    Ok(())
}

/// Appends one event to a Trainer's timeline (spec 18) without touching
/// anything else — used for GM Override provenance (spec 16/25: "a
/// successful override creates persistent provenance/history").
pub fn append_history_event(conn: &Connection, trainer_id: &str, event: &Value) -> rusqlite::Result<()> {
    let next_sequence: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sequence) + 1, 0) FROM history_events WHERE trainer_id = ?1",
        params![trainer_id],
        |row| row.get(0),
    )?;
    let kind = event.get("kind").and_then(Value::as_str).unwrap_or("event");
    conn.execute(
        "INSERT INTO history_events (id, trainer_id, kind, sequence, data_json, occurred_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![new_id(), trainer_id, kind, next_sequence, to_json(event), now()],
    )?;
    Ok(())
}

fn to_json(value: &Value) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "null".to_string())
}

fn to_json_typed<T: serde::Serialize>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "null".to_string())
}

fn parse_json(text: &str) -> Value {
    serde_json::from_str(text).unwrap_or(Value::Null)
}

/// The 5 Trainer-owned and 4 Pokémon-owned mechanical-collection tables
/// (spec §23, added in T09a): each row references a definition by
/// `definition_version_id` only — see `persistence::profiles`'s migration
/// doc comment for why (never copy/mutate the definition itself).
const TRAINER_COLLECTION_TABLES: [(&str, &str); 5] = [
    ("moves", "trainer_moves"),
    ("edges", "trainer_edges"),
    ("features", "trainer_features"),
    ("abilities", "trainer_abilities"),
    ("capabilities", "trainer_capabilities"),
];
const POKEMON_COLLECTION_TABLES: [(&str, &str); 4] = [
    ("moves", "pokemon_moves"),
    ("abilities", "pokemon_abilities"),
    ("poke_edges", "pokemon_poke_edges"),
    ("capabilities", "pokemon_capabilities"),
];

/// Validates `collection` against the known Trainer-owned tables and
/// returns its table name — the only place a caller-supplied string is
/// allowed to influence a SQL table name, so this must reject anything not
/// in the fixed list rather than pass an arbitrary string through.
pub fn trainer_collection_table(collection: &str) -> Option<&'static str> {
    TRAINER_COLLECTION_TABLES.iter().find(|(field, _)| *field == collection).map(|(_, table)| *table)
}

/// Same validation for the Pokémon-owned tables.
pub fn pokemon_collection_table(collection: &str) -> Option<&'static str> {
    POKEMON_COLLECTION_TABLES.iter().find(|(field, _)| *field == collection).map(|(_, table)| *table)
}

/// Adds (or updates, if the same definition is added again) one entry to a
/// mechanical collection without touching the rest of the Trainer/Pokémon
/// graph — the targeted-mutation pattern (T06/T07) for "minimal management"
/// UI actions like "learn this Move", as opposed to `save_trainer_profile`'s
/// whole-graph replace.
pub fn add_collection_entry(conn: &Connection, table: &'static str, owner_column: &str, owner_id: &str, entry: &Value) -> Result<(), ProfileError> {
    let definition_version_id = entry
        .get("definition_version_id")
        .and_then(Value::as_str)
        .ok_or_else(|| ProfileError::CollectionEntryMissingDefinitionVersionId { table: table.to_string(), index: 0 })?;
    let next_sequence: i64 = conn.query_row(
        &format!("SELECT COALESCE(MAX(sequence) + 1, 0) FROM {table} WHERE {owner_column} = ?1"),
        params![owner_id],
        |row| row.get(0),
    )?;
    conn.execute(
        &format!(
            "INSERT INTO {table} ({owner_column}, definition_version_id, sequence, data_json, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT({owner_column}, definition_version_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at"
        ),
        params![owner_id, definition_version_id, next_sequence, to_json(entry), now()],
    )?;
    Ok(())
}

/// Removes one entry from a mechanical collection by its definition id.
pub fn remove_collection_entry(conn: &Connection, table: &'static str, owner_column: &str, owner_id: &str, definition_version_id: &str) -> rusqlite::Result<()> {
    conn.execute(
        &format!("DELETE FROM {table} WHERE {owner_column} = ?1 AND definition_version_id = ?2"),
        params![owner_id, definition_version_id],
    )?;
    Ok(())
}

fn insert_definition_ref_collection(
    tx: &rusqlite::Transaction,
    table: &str,
    owner_column: &str,
    owner_id: &str,
    entries: &[Value],
    now: &str,
) -> Result<(), ProfileError> {
    for (index, entry) in entries.iter().enumerate() {
        let definition_version_id = entry
            .get("definition_version_id")
            .and_then(Value::as_str)
            .ok_or_else(|| ProfileError::CollectionEntryMissingDefinitionVersionId { table: table.to_string(), index })?;
        tx.execute(
            &format!(
                "INSERT INTO {table} ({owner_column}, definition_version_id, sequence, data_json, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)"
            ),
            params![owner_id, definition_version_id, index as i64, to_json(entry), now],
        )?;
    }
    Ok(())
}

fn query_definition_ref_collection(conn: &Connection, table: &str, owner_column: &str, owner_id: &str) -> rusqlite::Result<Vec<Value>> {
    let sql = format!("SELECT data_json FROM {table} WHERE {owner_column} = ?1 ORDER BY sequence");
    query_json_list(conn, &sql, owner_id)
}

/// Saves the whole Trainer graph, replacing any prior state for this
/// Trainer id. Atomic: on any error nothing is written.
pub fn save_trainer_profile(conn: &mut Connection, profile: &TrainerProfile) -> Result<(), ProfileError> {
    let tx = conn.transaction()?;
    let now = now();

    tx.execute(
        "INSERT INTO trainers (id, name, level, exp, money, background_json, skills_json, stat_allocation_json, weight_lb, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            level = excluded.level,
            exp = excluded.exp,
            money = excluded.money,
            background_json = excluded.background_json,
            skills_json = excluded.skills_json,
            stat_allocation_json = excluded.stat_allocation_json,
            weight_lb = excluded.weight_lb,
            updated_at = excluded.updated_at",
        params![
            profile.id,
            profile.name,
            profile.level,
            profile.exp,
            profile.money,
            profile.background.as_ref().map(to_json),
            to_json(&profile.skills),
            to_json_typed(&profile.stat_allocation),
            profile.weight_lb,
            now,
        ],
    )?;

    // Clear prior children. combat_states has no FK (its owner is
    // polymorphic: trainer or pokemon) so it must be cleared explicitly,
    // and before pokemon_instances is cleared (the pokemon-owned subquery
    // needs those rows to still exist).
    tx.execute(
        "DELETE FROM combat_states WHERE (owner_type = 'trainer' AND owner_id = ?1)
            OR (owner_type = 'pokemon' AND owner_id IN (SELECT id FROM pokemon_instances WHERE trainer_id = ?1))",
        params![profile.id],
    )?;
    for table in [
        "npcs",
        "trainer_progression",
        "history_events",
        "trainer_gm_grants",
        "inventory_stacks",
        "equipment_slots",
        "trainer_moves",
        "trainer_edges",
        "trainer_features",
        "trainer_abilities",
        "trainer_capabilities",
        "rosters",
        "pokemon_instances", // cascades pokemon_moves/abilities/poke_edges/capabilities via FK
    ] {
        tx.execute(&format!("DELETE FROM {table} WHERE trainer_id = ?1"), params![profile.id])?;
    }

    for (index, grant) in profile.gm_grants.iter().enumerate() {
        let id = grant
            .get("id")
            .and_then(Value::as_str)
            .ok_or(ProfileError::GmGrantMissingId { index })?;
        let kind = grant
            .get("kind")
            .and_then(Value::as_str)
            .ok_or(ProfileError::GmGrantMissingKind { index })?;
        tx.execute(
            "INSERT INTO trainer_gm_grants (id, trainer_id, kind, sequence, data_json, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, profile.id, kind, index as i64, to_json(grant), now],
        )?;
    }

    for (field, table) in TRAINER_COLLECTION_TABLES {
        let entries: &[Value] = match field {
            "moves" => &profile.moves,
            "edges" => &profile.edges,
            "features" => &profile.features,
            "abilities" => &profile.abilities,
            "capabilities" => &profile.capabilities,
            _ => unreachable!(),
        };
        insert_definition_ref_collection(&tx, table, "trainer_id", &profile.id, entries, &now)?;
    }

    for (index, roster) in profile.rosters.iter().enumerate() {
        tx.execute(
            "INSERT INTO rosters (id, trainer_id, name, active, max_members, sequence, rules_json, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                roster.id,
                profile.id,
                roster.name,
                roster.active,
                roster.max_members,
                index as i64,
                to_json(&roster.rules),
                now,
            ],
        )?;
    }

    for (index, pkm) in profile.pokemon.iter().enumerate() {
        tx.execute(
            "INSERT INTO pokemon_instances (id, trainer_id, species_definition_id, nickname, level, exp, capture_ball_item_id, injuries, held_item_id, storage_state, sequence, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)",
            params![
                pkm.id,
                profile.id,
                pkm.species_definition_id,
                pkm.nickname,
                pkm.level,
                pkm.exp,
                pkm.capture_ball_item_id,
                pkm.injuries,
                pkm.held_item_id,
                pkm.storage_state.as_str(),
                index as i64,
                now,
            ],
        )?;

        for (roster_index, roster_id) in pkm.roster_memberships.iter().enumerate() {
            tx.execute(
                "INSERT INTO roster_memberships (roster_id, pokemon_id, sequence) VALUES (?1, ?2, ?3)",
                params![roster_id, pkm.id, roster_index as i64],
            )?;
        }

        if let Some(battle_state) = &pkm.battle_state {
            tx.execute(
                "INSERT INTO combat_states (owner_type, owner_id, current_hp, temp_hp, combat_stages_json, statuses_json, ap_current, ap_bound, ap_drained, updated_at)
                 VALUES ('pokemon', ?1, ?2, ?3, ?4, ?5, NULL, NULL, NULL, ?6)",
                params![
                    pkm.id,
                    battle_state.current_hp,
                    battle_state.temporary_hp,
                    serde_json::to_string(&battle_state.combat_stages).unwrap_or_default(),
                    serde_json::to_string(&battle_state.statuses).unwrap_or_default(),
                    now,
                ],
            )?;
        }

        for (field, table) in POKEMON_COLLECTION_TABLES {
            let entries: &[Value] = match field {
                "moves" => &pkm.moves,
                "abilities" => &pkm.abilities,
                "poke_edges" => &pkm.poke_edges,
                "capabilities" => &pkm.capabilities,
                _ => unreachable!(),
            };
            insert_definition_ref_collection(&tx, table, "pokemon_id", &pkm.id, entries, &now)?;
        }
    }

    for (index, stack) in profile.inventory.backpack.iter().enumerate() {
        tx.execute(
            "INSERT INTO inventory_stacks (id, trainer_id, location, item_id, quantity, sequence, updated_at)
             VALUES (?1, ?2, 'backpack', ?3, ?4, ?5, ?6)",
            params![new_id(), profile.id, stack.item_id, stack.quantity, index as i64, now],
        )?;
    }
    for (index, stack) in profile.inventory.storage.iter().enumerate() {
        tx.execute(
            "INSERT INTO inventory_stacks (id, trainer_id, location, item_id, quantity, sequence, updated_at)
             VALUES (?1, ?2, 'storage', ?3, ?4, ?5, ?6)",
            params![new_id(), profile.id, stack.item_id, stack.quantity, index as i64, now],
        )?;
    }
    for (slot_key, item_id) in &profile.inventory.equipped {
        tx.execute(
            "INSERT INTO equipment_slots (trainer_id, slot_key, item_id, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![profile.id, slot_key, item_id, now],
        )?;
    }

    for (index, npc) in profile.npcs.iter().enumerate() {
        let id = npc
            .get("id")
            .and_then(Value::as_str)
            .ok_or(ProfileError::NpcMissingId { index })?;
        tx.execute(
            "INSERT INTO npcs (id, trainer_id, sequence, data_json, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, profile.id, index as i64, to_json(npc), now],
        )?;
    }

    for (index, entry) in profile.progression.iter().enumerate() {
        let level = entry
            .get("level")
            .and_then(Value::as_i64)
            .ok_or(ProfileError::ProgressionMissingLevel { index })?;
        tx.execute(
            "INSERT INTO trainer_progression (trainer_id, level, data_json, updated_at) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(trainer_id, level) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at",
            params![profile.id, level, to_json(entry), now],
        )?;
    }

    for (index, event) in profile.timeline.iter().enumerate() {
        let kind = event
            .get("kind")
            .and_then(Value::as_str)
            .ok_or(ProfileError::TimelineMissingKind { index })?;
        tx.execute(
            "INSERT INTO history_events (id, trainer_id, kind, sequence, data_json, occurred_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![new_id(), profile.id, kind, index as i64, to_json(event), now],
        )?;
    }

    if let Some(combat) = &profile.combat {
        tx.execute(
            "INSERT INTO combat_states (owner_type, owner_id, current_hp, temp_hp, combat_stages_json, statuses_json, ap_current, ap_bound, ap_drained, updated_at)
             VALUES ('trainer', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                profile.id,
                combat.current_hp,
                combat.temp_hp,
                serde_json::to_string(&combat.combat_stages).unwrap_or_default(),
                serde_json::to_string(&combat.statuses).unwrap_or_default(),
                combat.ap_current,
                combat.ap_bound,
                combat.ap_drained,
                now,
            ],
        )?;
    }

    tx.commit()?;
    Ok(())
}

/// Hydrates the full Trainer graph. Returns `Ok(None)` if no Trainer with
/// this id exists.
pub fn load_trainer_profile(conn: &Connection, trainer_id: &str) -> Result<Option<TrainerProfile>, ProfileError> {
    let core = conn
        .query_row(
            "SELECT id, name, level, exp, money, background_json, skills_json, stat_allocation_json, weight_lb FROM trainers WHERE id = ?1",
            params![trainer_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, Option<String>>(6)?,
                    row.get::<_, Option<String>>(7)?,
                    row.get::<_, Option<i64>>(8)?,
                ))
            },
        )
        .map(Some)
        .or_else(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            other => Err(other),
        })?;

    let Some((id, name, level, exp, money, background_json, skills_json, stat_allocation_json, weight_lb)) = core else {
        return Ok(None);
    };

    let background = background_json.as_deref().map(parse_json);
    let skills = skills_json.as_deref().map(parse_json).unwrap_or(Value::Null);
    // A legacy (pre-T15A) row has NULL here — "not yet allocated", the same
    // meaning as the in-memory `TrainerStatAllocation::default()` (empty
    // entries), never a fabricated value.
    let stat_allocation: TrainerStatAllocation = stat_allocation_json
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    let gm_grants = query_json_list(
        conn,
        "SELECT data_json FROM trainer_gm_grants WHERE trainer_id = ?1 ORDER BY sequence",
        trainer_id,
    )?;

    let moves = query_definition_ref_collection(conn, "trainer_moves", "trainer_id", trainer_id)?;
    let edges = query_definition_ref_collection(conn, "trainer_edges", "trainer_id", trainer_id)?;
    let features = query_definition_ref_collection(conn, "trainer_features", "trainer_id", trainer_id)?;
    let abilities = query_definition_ref_collection(conn, "trainer_abilities", "trainer_id", trainer_id)?;
    let capabilities = query_definition_ref_collection(conn, "trainer_capabilities", "trainer_id", trainer_id)?;

    let mut rosters_stmt = conn.prepare(
        "SELECT id, name, active, max_members, rules_json FROM rosters WHERE trainer_id = ?1 ORDER BY sequence",
    )?;
    let rosters: Vec<RosterRecord> = rosters_stmt
        .query_map(params![trainer_id], |row| {
            Ok(RosterRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                active: row.get::<_, i64>(2)? != 0,
                max_members: row.get(3)?,
                rules: row
                    .get::<_, Option<String>>(4)?
                    .as_deref()
                    .map(parse_json)
                    .unwrap_or(Value::Null),
            })
        })?
        .collect::<rusqlite::Result<_>>()?;

    let mut pkm_stmt = conn.prepare(
        "SELECT id, species_definition_id, nickname, level, exp, capture_ball_item_id, injuries, held_item_id, storage_state
         FROM pokemon_instances WHERE trainer_id = ?1 ORDER BY sequence",
    )?;
    let pokemon_rows: Vec<(String, String, Option<String>, i64, Option<i64>, Option<String>, i64, Option<String>, String)> =
        pkm_stmt
            .query_map(params![trainer_id], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                    row.get(7)?,
                    row.get(8)?,
                ))
            })?
            .collect::<rusqlite::Result<_>>()?;

    let mut pokemon = Vec::with_capacity(pokemon_rows.len());
    for (id, species_definition_id, nickname, level, exp, capture_ball_item_id, injuries, held_item_id, storage_state) in
        pokemon_rows
    {
        let mut memberships_stmt = conn.prepare(
            "SELECT roster_id FROM roster_memberships WHERE pokemon_id = ?1 ORDER BY sequence",
        )?;
        let roster_memberships: Vec<String> = memberships_stmt
            .query_map(params![id], |row| row.get(0))?
            .collect::<rusqlite::Result<_>>()?;

        let battle_state = conn
            .query_row(
                "SELECT current_hp, temp_hp, combat_stages_json, statuses_json FROM combat_states WHERE owner_type = 'pokemon' AND owner_id = ?1",
                params![id],
                |row| {
                    Ok(BattleState {
                        current_hp: row.get::<_, Option<i64>>(0)?.unwrap_or_default(),
                        temporary_hp: row.get::<_, Option<i64>>(1)?.unwrap_or_default(),
                        combat_stages: row
                            .get::<_, Option<String>>(2)?
                            .and_then(|s| serde_json::from_str(&s).ok())
                            .unwrap_or_default(),
                        statuses: row
                            .get::<_, Option<String>>(3)?
                            .and_then(|s| serde_json::from_str(&s).ok())
                            .unwrap_or_default(),
                    })
                },
            )
            .map(Some)
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(None),
                other => Err(other),
            })?;

        let pkm_moves = query_definition_ref_collection(conn, "pokemon_moves", "pokemon_id", &id)?;
        let pkm_abilities = query_definition_ref_collection(conn, "pokemon_abilities", "pokemon_id", &id)?;
        let pkm_poke_edges = query_definition_ref_collection(conn, "pokemon_poke_edges", "pokemon_id", &id)?;
        let pkm_capabilities = query_definition_ref_collection(conn, "pokemon_capabilities", "pokemon_id", &id)?;

        pokemon.push(PokemonInstance {
            id,
            species_definition_id,
            nickname,
            level,
            exp,
            capture_ball_item_id,
            injuries,
            held_item_id,
            storage_state: StorageState::from_str(&storage_state).unwrap_or(StorageState::Carried),
            roster_memberships,
            battle_state,
            moves: pkm_moves,
            abilities: pkm_abilities,
            poke_edges: pkm_poke_edges,
            capabilities: pkm_capabilities,
        });
    }

    let backpack = query_item_stacks(conn, trainer_id, "backpack")?;
    let storage = query_item_stacks(conn, trainer_id, "storage")?;
    let mut equipped_stmt = conn.prepare(
        "SELECT slot_key, item_id FROM equipment_slots WHERE trainer_id = ?1 AND item_id IS NOT NULL",
    )?;
    let equipped = equipped_stmt
        .query_map(params![trainer_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?
        .collect::<rusqlite::Result<std::collections::HashMap<_, _>>>()?;

    let npcs = query_json_list(
        conn,
        "SELECT data_json FROM npcs WHERE trainer_id = ?1 ORDER BY sequence",
        trainer_id,
    )?;
    let progression = query_json_list(
        conn,
        "SELECT data_json FROM trainer_progression WHERE trainer_id = ?1 ORDER BY level ASC",
        trainer_id,
    )?;
    let timeline = query_json_list(
        conn,
        "SELECT data_json FROM history_events WHERE trainer_id = ?1 ORDER BY sequence",
        trainer_id,
    )?;

    let combat = conn
        .query_row(
            "SELECT current_hp, temp_hp, combat_stages_json, statuses_json, ap_current, ap_bound, ap_drained
             FROM combat_states WHERE owner_type = 'trainer' AND owner_id = ?1",
            params![trainer_id],
            |row| {
                Ok(CombatState {
                    current_hp: row.get(0)?,
                    temp_hp: row.get(1)?,
                    combat_stages: row
                        .get::<_, Option<String>>(2)?
                        .and_then(|s| serde_json::from_str(&s).ok())
                        .unwrap_or_default(),
                    statuses: row
                        .get::<_, Option<String>>(3)?
                        .and_then(|s| serde_json::from_str(&s).ok())
                        .unwrap_or_default(),
                    ap_current: row.get(4)?,
                    ap_bound: row.get(5)?,
                    ap_drained: row.get(6)?,
                })
            },
        )
        .map(Some)
        .or_else(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            other => Err(other),
        })?;

    Ok(Some(TrainerProfile {
        id,
        name,
        level,
        exp,
        money,
        background,
        skills,
        gm_grants,
        moves,
        edges,
        features,
        abilities,
        capabilities,
        rosters,
        pokemon,
        inventory: InventoryRecord {
            backpack,
            storage,
            equipped,
        },
        npcs,
        progression,
        timeline,
        combat,
        stat_allocation,
        weight_lb,
    }))
}

/// Lightweight listing for every Trainer: id/name/level/money only. Never
/// touches Pokémon/rosters/inventory/grants/history/NPCs for any Trainer,
/// so listing archived Trainers never hydrates their full state.
pub fn list_trainer_summaries(conn: &Connection) -> rusqlite::Result<Vec<TrainerSummary>> {
    let mut stmt = conn.prepare("SELECT id, name, level, money FROM trainers ORDER BY name ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok(TrainerSummary {
            id: row.get(0)?,
            name: row.get(1)?,
            level: row.get(2)?,
            money: row.get(3)?,
        })
    })?;
    rows.collect()
}

fn query_json_list(conn: &Connection, sql: &str, trainer_id: &str) -> rusqlite::Result<Vec<Value>> {
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map(params![trainer_id], |row| row.get::<_, String>(0))?;
    rows.map(|r| r.map(|text| parse_json(&text))).collect()
}

fn query_item_stacks(conn: &Connection, trainer_id: &str, location: &str) -> rusqlite::Result<Vec<ItemStack>> {
    let mut stmt = conn.prepare(
        "SELECT item_id, quantity FROM inventory_stacks WHERE trainer_id = ?1 AND location = ?2 ORDER BY sequence",
    )?;
    let rows = stmt.query_map(params![trainer_id, location], |row| {
        Ok(ItemStack {
            item_id: row.get(0)?,
            quantity: row.get(1)?,
        })
    })?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::persistence::profiles::open_and_migrate_profiles;
    use crate::profile::model::{StatAllocationEntry, StatAllocationSource, TrainerCombatStat};
    use serde_json::json;

    /// T15A: `stat_allocation` and `weight_lb` round-trip through
    /// save/load exactly, including an explicit `GmOverride` entry's note.
    #[test]
    fn stat_allocation_and_weight_survive_save_and_load() {
        let (dir, mut conn) = seed();
        let mut profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        profile.weight_lb = Some(150);
        profile.stat_allocation = TrainerStatAllocation {
            entries: vec![
                StatAllocationEntry {
                    stat: TrainerCombatStat::Hp,
                    source: StatAllocationSource::Creation,
                    level: 1,
                    points: 2,
                    note: None,
                },
                StatAllocationEntry {
                    stat: TrainerCombatStat::Attack,
                    source: StatAllocationSource::GmOverride,
                    level: 1,
                    points: 6,
                    note: Some("GM approved a bonus creation point".to_string()),
                },
            ],
        };
        save_trainer_profile(&mut conn, &profile).unwrap();

        let reloaded = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(reloaded.weight_lb, Some(150));
        assert_eq!(reloaded.stat_allocation, profile.stat_allocation);

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// T15A: a Trainer saved before this migration existed (no stat
    /// allocation ever written) must load with an empty allocation and
    /// `weight_lb: None` — unknown, never a fabricated zero.
    #[test]
    fn missing_stat_allocation_loads_as_empty_not_zero() {
        let (dir, conn) = seed();
        let profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(profile.stat_allocation, TrainerStatAllocation::default());
        assert_eq!(profile.stat_allocation.entries.len(), 0);
        assert_eq!(profile.weight_lb, None);

        let _ = std::fs::remove_dir_all(&dir);
    }

    fn seed() -> (std::path::PathBuf, Connection) {
        let dir = std::env::temp_dir().join(format!("ptu-repo-narrow-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut conn = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
        save_trainer_profile(
            &mut conn,
            &TrainerProfile { id: "t1".to_string(), name: "Narrow Test".to_string(), level: 1, exp: 0, money: 0, ..TrainerProfile::default() },
        )
        .unwrap();
        (dir, conn)
    }

    #[test]
    fn add_pokemon_to_trainer_does_not_disturb_existing_state() {
        let (dir, mut conn) = seed();
        add_roster(&conn, "t1", &RosterRecord { id: "r1".to_string(), name: "Team".to_string(), active: true, max_members: None, rules: json!({}) }).unwrap();

        add_pokemon_to_trainer(
            &mut conn,
            "t1",
            &PokemonInstance {
                id: "pkm-1".to_string(),
                species_definition_id: "sableye".to_string(),
                nickname: None,
                level: 5,
                exp: None,
                capture_ball_item_id: None,
                injuries: 0,
                held_item_id: None,
                storage_state: StorageState::Carried,
                roster_memberships: vec!["r1".to_string()],
                battle_state: None,
                ..Default::default()
            },
        )
        .unwrap();

        let profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(profile.pokemon.len(), 1);
        assert_eq!(profile.pokemon[0].id, "pkm-1");
        assert_eq!(profile.pokemon[0].roster_memberships, vec!["r1".to_string()]);
        assert_eq!(profile.rosters.len(), 1, "the roster added earlier must be untouched");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn add_roster_appends_without_touching_existing_rosters() {
        let (dir, conn) = seed();
        add_roster(&conn, "t1", &RosterRecord { id: "r1".to_string(), name: "First".to_string(), active: true, max_members: None, rules: json!({}) }).unwrap();
        add_roster(&conn, "t1", &RosterRecord { id: "r2".to_string(), name: "Second".to_string(), active: true, max_members: Some(6), rules: json!({}) }).unwrap();

        let profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(profile.rosters.len(), 2);
        assert_eq!(profile.rosters[0].id, "r1");
        assert_eq!(profile.rosters[1].id, "r2");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn update_pokemon_level_changes_only_that_field() {
        let (dir, mut conn) = seed();
        add_pokemon_to_trainer(
            &mut conn,
            "t1",
            &PokemonInstance {
                id: "pkm-1".to_string(),
                species_definition_id: "sableye".to_string(),
                nickname: None,
                level: 5,
                exp: None,
                capture_ball_item_id: None,
                injuries: 0,
                held_item_id: None,
                storage_state: StorageState::Carried,
                roster_memberships: vec![],
                battle_state: None,
                ..Default::default()
            },
        )
        .unwrap();

        update_pokemon_level(&conn, "pkm-1", 101).unwrap();

        let profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(profile.pokemon[0].level, 101);
        assert_eq!(profile.pokemon[0].species_definition_id, "sableye", "other fields untouched");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn update_trainer_stat_allocation_changes_only_that_field() {
        let (dir, conn) = seed();

        update_trainer_stat_allocation(
            &conn,
            "t1",
            &TrainerStatAllocation {
                entries: vec![StatAllocationEntry {
                    stat: TrainerCombatStat::Hp,
                    source: StatAllocationSource::Creation,
                    level: 1,
                    points: 4,
                    note: None,
                }],
            },
        )
        .unwrap();

        let profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(profile.stat_allocation.entries.len(), 1);
        assert_eq!(profile.stat_allocation.entries[0].points, 4);
        assert_eq!(profile.name, "Narrow Test", "other fields untouched");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn append_history_event_preserves_order_and_requires_no_prior_timeline() {
        let (dir, conn) = seed();
        append_history_event(&conn, "t1", &json!({"kind": "gm_override", "code": "POKEMON_LEVEL_ABOVE_MAXIMUM"})).unwrap();
        append_history_event(&conn, "t1", &json!({"kind": "level_up", "level": 2})).unwrap();

        let profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(profile.timeline.len(), 2);
        assert_eq!(profile.timeline[0]["kind"], "gm_override");
        assert_eq!(profile.timeline[1]["kind"], "level_up");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn add_collection_entry_appends_without_touching_the_rest_of_the_profile() {
        let (dir, conn) = seed();
        add_collection_entry(&conn, "trainer_moves", "trainer_id", "t1", &json!({"definition_version_id": "moves:crunch@core"})).unwrap();
        add_collection_entry(&conn, "trainer_moves", "trainer_id", "t1", &json!({"definition_version_id": "moves:tackle@core"})).unwrap();

        let profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(profile.moves.len(), 2);
        assert_eq!(profile.moves[0]["definition_version_id"], "moves:crunch@core");
        assert_eq!(profile.moves[1]["definition_version_id"], "moves:tackle@core");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn add_collection_entry_updates_in_place_for_the_same_definition() {
        let (dir, conn) = seed();
        add_collection_entry(&conn, "trainer_moves", "trainer_id", "t1", &json!({"definition_version_id": "moves:crunch@core", "note": "v1"})).unwrap();
        add_collection_entry(&conn, "trainer_moves", "trainer_id", "t1", &json!({"definition_version_id": "moves:crunch@core", "note": "v2"})).unwrap();

        let profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(profile.moves.len(), 1, "same definition_version_id must update in place, not duplicate");
        assert_eq!(profile.moves[0]["note"], "v2");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn remove_collection_entry_removes_only_that_entry() {
        let (dir, conn) = seed();
        add_collection_entry(&conn, "trainer_moves", "trainer_id", "t1", &json!({"definition_version_id": "moves:crunch@core"})).unwrap();
        add_collection_entry(&conn, "trainer_moves", "trainer_id", "t1", &json!({"definition_version_id": "moves:tackle@core"})).unwrap();

        remove_collection_entry(&conn, "trainer_moves", "trainer_id", "t1", "moves:crunch@core").unwrap();

        let profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(profile.moves.len(), 1);
        assert_eq!(profile.moves[0]["definition_version_id"], "moves:tackle@core");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn collection_table_lookups_reject_unknown_names() {
        assert_eq!(trainer_collection_table("moves"), Some("trainer_moves"));
        assert_eq!(trainer_collection_table("not_a_real_collection; DROP TABLE trainers;--"), None);
        assert_eq!(pokemon_collection_table("poke_edges"), Some("pokemon_poke_edges"));
        assert_eq!(pokemon_collection_table("edges"), None, "edges is Trainer-only, not a Pokémon collection");
    }
}
