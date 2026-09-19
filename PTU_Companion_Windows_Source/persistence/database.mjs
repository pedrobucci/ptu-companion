import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  migrate(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const row = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get();
  const current = Number(row?.version || 0);

  if (current < 1) {
    db.exec(`
      CREATE TABLE profiles (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE trainers (
        id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        level INTEGER NOT NULL,
        exp INTEGER NOT NULL,
        next_exp INTEGER NOT NULL,
        money INTEGER NOT NULL,
        ptu_points INTEGER NOT NULL,
        badges INTEGER NOT NULL,
        stats_json TEXT NOT NULL,
        derived_json TEXT NOT NULL,
        skills_json TEXT NOT NULL,
        equipment_json TEXT NOT NULL,
        modifiers_json TEXT NOT NULL
      );

      CREATE TABLE pokemon (
        id TEXT PRIMARY KEY,
        trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        species TEXT NOT NULL,
        level INTEGER NOT NULL,
        types_json TEXT NOT NULL,
        hp INTEGER NOT NULL,
        max_hp INTEGER NOT NULL,
        injuries INTEGER NOT NULL,
        ball TEXT NOT NULL,
        held_item TEXT,
        image_path TEXT,
        in_storage INTEGER NOT NULL DEFAULT 0,
        loyalty INTEGER NOT NULL DEFAULT 0,
        combat_stages_json TEXT NOT NULL
      );
      CREATE INDEX idx_pokemon_trainer ON pokemon(trainer_id);
      CREATE INDEX idx_pokemon_storage ON pokemon(trainer_id, in_storage);

      CREATE TABLE rosters (
        id TEXT PRIMARY KEY,
        trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        max_members INTEGER NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        color TEXT NOT NULL
      );
      CREATE INDEX idx_rosters_trainer ON rosters(trainer_id);

      CREATE TABLE roster_memberships (
        roster_id TEXT NOT NULL REFERENCES rosters(id) ON DELETE CASCADE,
        pokemon_id TEXT NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
        PRIMARY KEY (roster_id, pokemon_id)
      );

      CREATE TABLE inventory_items (
        id TEXT NOT NULL,
        trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
        icon TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price INTEGER NOT NULL,
        qty INTEGER NOT NULL,
        consumable INTEGER NOT NULL,
        equip_slot TEXT,
        PRIMARY KEY (trainer_id, id)
      );

      CREATE TABLE gm_grants (
        id TEXT PRIMARY KEY,
        trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        target TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE trainer_history (
        id TEXT PRIMARY KEY,
        trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
        event_date TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT NOT NULL
      );

      CREATE TABLE npcs (
        id TEXT PRIMARY KEY,
        trainer_id TEXT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
        initials TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        tag TEXT NOT NULL,
        affiliation TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        description TEXT NOT NULL
      );

      CREATE TABLE npc_notes (
        npc_id TEXT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        note TEXT NOT NULL,
        PRIMARY KEY (npc_id, position)
      );

      CREATE TABLE shop_state (
        trainer_id TEXT PRIMARY KEY REFERENCES trainers(id) ON DELETE CASCADE,
        preset TEXT NOT NULL,
        discount_pct INTEGER NOT NULL,
        mode TEXT NOT NULL,
        cart_json TEXT NOT NULL
      );

      CREATE TABLE ui_state (
        trainer_id TEXT PRIMARY KEY REFERENCES trainers(id) ON DELETE CASCADE,
        selected_pokemon_id TEXT,
        selected_roster_id TEXT,
        selected_npc_id TEXT,
        data_json TEXT NOT NULL
      );

      CREATE TABLE save_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        state_json TEXT NOT NULL
      );
      CREATE INDEX idx_revisions_profile ON save_revisions(profile_id, id DESC);
    `);
    db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(1, new Date().toISOString());
  }
  if (current < 2) {
    const columns = db.prepare('PRAGMA table_info(pokemon)').all().map(row => row.name);
    if (!columns.includes('details_json')) {
      db.exec("ALTER TABLE pokemon ADD COLUMN details_json TEXT NOT NULL DEFAULT '{}';");
    }
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(2, new Date().toISOString());
  }

  if (current < 3) {
    const trainerColumns = db.prepare('PRAGMA table_info(trainers)').all().map(row => row.name);
    if (!trainerColumns.includes('details_json')) {
      db.exec("ALTER TABLE trainers ADD COLUMN details_json TEXT NOT NULL DEFAULT '{}';");
    }
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(3, new Date().toISOString());
  }

  if (current < 4) {
    const itemColumns = db.prepare('PRAGMA table_info(inventory_items)').all().map(row => row.name);
    if (!itemColumns.includes('details_json')) {
      db.exec("ALTER TABLE inventory_items ADD COLUMN details_json TEXT NOT NULL DEFAULT '{}';");
    }
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(4, new Date().toISOString());
  }

  if (current < 5) {
    const trainerColumns = db.prepare('PRAGMA table_info(trainers)').all().map(row => row.name);
    if (!trainerColumns.includes('portrait_data_url')) {
      db.exec('ALTER TABLE trainers ADD COLUMN portrait_data_url TEXT;');
    }
    const npcColumns = db.prepare('PRAGMA table_info(npcs)').all().map(row => row.name);
    if (!npcColumns.includes('portrait_data_url')) {
      db.exec('ALTER TABLE npcs ADD COLUMN portrait_data_url TEXT;');
    }
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(5, new Date().toISOString());
  }

}
