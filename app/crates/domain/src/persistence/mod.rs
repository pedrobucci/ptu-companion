//! SQLite persistence: two physically separate stores (see technical spec
//! section 34). `definitions` holds imported content and is read-mostly.
//! `profiles` holds Trainer/Pokémon/NPC/history state and is never touched
//! by content import. Migrations for `profiles`' actual character-state
//! schema are introduced by the task that owns that model; this module only
//! establishes the shared migration mechanism and physical separation.

pub mod definitions;
pub mod profiles;

use rusqlite::Connection;
use std::path::Path;

/// Applies un-applied `migrations` to `conn`, tracked via `PRAGMA user_version`.
/// Each migration runs in its own transaction; a failure rolls back only that
/// migration and stops (whatever version was reached previously remains applied).
pub(crate) fn apply_migrations(conn: &Connection, migrations: &[&str]) -> rusqlite::Result<()> {
    let current_version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    let current_version = current_version.max(0) as usize;

    for (index, sql) in migrations.iter().enumerate().skip(current_version) {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(sql)?;
        let next_version = (index + 1) as i64;
        tx.pragma_update(None, "user_version", next_version)?;
        tx.commit()?;
    }
    Ok(())
}

/// Opens (creating if absent) a SQLite database at `path` with the app's
/// standard pragmas, then applies `migrations`.
pub(crate) fn open_and_migrate(path: &Path, migrations: &[&str]) -> rusqlite::Result<Connection> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            let _ = std::fs::create_dir_all(parent);
        }
    }
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "foreign_keys", true)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    apply_migrations(&conn, migrations)?;
    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_idempotent_and_ordered() {
        let conn = Connection::open_in_memory().unwrap();
        let migrations: &[&str] = &[
            "CREATE TABLE a (id INTEGER PRIMARY KEY);",
            "CREATE TABLE b (id INTEGER PRIMARY KEY);",
        ];
        apply_migrations(&conn, migrations).unwrap();
        apply_migrations(&conn, migrations).unwrap(); // re-applying must be a no-op

        let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(version, 2);

        conn.execute("INSERT INTO a (id) VALUES (1)", []).unwrap();
        conn.execute("INSERT INTO b (id) VALUES (1)", []).unwrap();
    }
}
