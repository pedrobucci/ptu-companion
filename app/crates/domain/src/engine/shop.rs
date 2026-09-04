//! Shop Presets, price resolution, and atomic checkout (technical spec
//! section 11). Price precedence: **transaction-specific override** >
//! **item-specific shop override** > **base price × shop's global
//! buy/sell multiplier**. Checkout (buy or sell) mutates money and
//! inventory in one transaction — either both happen or neither does.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use thiserror::Error;

fn default_buy_multiplier() -> f64 {
    1.0
}
fn default_sell_multiplier() -> f64 {
    0.5
}
fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ShopItemEntry {
    pub item_id: String,
    #[serde(default = "default_true")]
    pub available: bool,
    #[serde(default)]
    pub buy_override: Option<f64>,
    #[serde(default)]
    pub sell_override: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ShopPreset {
    pub id: String,
    pub name: String,
    #[serde(default = "default_buy_multiplier")]
    pub buy_multiplier: f64,
    #[serde(default = "default_sell_multiplier")]
    pub sell_multiplier: f64,
    #[serde(default)]
    pub items: Vec<ShopItemEntry>,
}

pub fn resolve_buy_price(shop: &ShopPreset, item_id: &str, base_price: f64, transaction_override: Option<f64>) -> f64 {
    if let Some(price) = transaction_override {
        return price;
    }
    if let Some(entry) = shop.items.iter().find(|i| i.item_id == item_id) {
        if let Some(price) = entry.buy_override {
            return price;
        }
    }
    base_price * shop.buy_multiplier
}

pub fn resolve_sell_price(shop: &ShopPreset, item_id: &str, base_price: f64, transaction_override: Option<f64>) -> f64 {
    if let Some(price) = transaction_override {
        return price;
    }
    if let Some(entry) = shop.items.iter().find(|i| i.item_id == item_id) {
        if let Some(price) = entry.sell_override {
            return price;
        }
    }
    base_price * shop.sell_multiplier
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CartLine {
    pub item_id: String,
    pub quantity: i64,
    pub unit_price: f64,
}

#[derive(Debug, Error)]
pub enum ShopError {
    #[error("insufficient funds: have {have}, need {need}")]
    InsufficientFunds { have: i64, need: i64 },
    #[error("insufficient stock of \"{item_id}\": have {have}, need {need}")]
    InsufficientStock { item_id: String, have: i64, need: i64 },
    #[error("trainer \"{0}\" not found")]
    TrainerNotFound(String),
    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

fn cart_total(lines: &[CartLine]) -> i64 {
    lines.iter().map(|l| l.unit_price * l.quantity as f64).sum::<f64>().round() as i64
}

/// Buys `lines` for `trainer_id`. Atomic: money deduction and every
/// inventory stack increment happen in one transaction; insufficient funds
/// aborts before anything is written.
pub fn checkout_buy(
    conn: &mut Connection,
    trainer_id: &str,
    shop_id: Option<&str>,
    lines: &[CartLine],
) -> Result<i64, ShopError> {
    let total_amount = cart_total(lines);

    let money: i64 = conn
        .query_row("SELECT money FROM trainers WHERE id = ?1", params![trainer_id], |row| row.get(0))
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => ShopError::TrainerNotFound(trainer_id.to_string()),
            other => ShopError::Sqlite(other),
        })?;
    if money < total_amount {
        return Err(ShopError::InsufficientFunds { have: money, need: total_amount });
    }

    let now = chrono::Utc::now().to_rfc3339();
    let tx = conn.transaction()?;

    tx.execute(
        "UPDATE trainers SET money = money - ?2, updated_at = ?3 WHERE id = ?1",
        params![trainer_id, total_amount, now],
    )?;
    for line in lines {
        add_backpack_stock(&tx, trainer_id, &line.item_id, line.quantity, &now)?;
    }
    record_transaction(&tx, trainer_id, shop_id, "buy", total_amount, lines, &now)?;

    tx.commit()?;
    Ok(total_amount)
}

/// Sells `lines` from `trainer_id`'s backpack. Atomic: stock is checked and
/// decremented, money is credited, and either all of it happens or none of
/// it does — insufficient stock on any line rolls back the whole cart, not
/// just that line.
pub fn checkout_sell(
    conn: &mut Connection,
    trainer_id: &str,
    shop_id: Option<&str>,
    lines: &[CartLine],
) -> Result<i64, ShopError> {
    let total_amount = cart_total(lines);
    let now = chrono::Utc::now().to_rfc3339();
    let tx = conn.transaction()?;

    for line in lines {
        let existing: Option<(String, i64)> = tx
            .query_row(
                "SELECT id, quantity FROM inventory_stacks WHERE trainer_id = ?1 AND location = 'backpack' AND item_id = ?2",
                params![trainer_id, line.item_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map(Some)
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(None),
                other => Err(other),
            })?;

        let (stack_id, have) = existing.ok_or_else(|| ShopError::InsufficientStock {
            item_id: line.item_id.clone(),
            have: 0,
            need: line.quantity,
        })?;
        if have < line.quantity {
            return Err(ShopError::InsufficientStock { item_id: line.item_id.clone(), have, need: line.quantity });
        }
        if have == line.quantity {
            tx.execute("DELETE FROM inventory_stacks WHERE id = ?1", params![stack_id])?;
        } else {
            tx.execute(
                "UPDATE inventory_stacks SET quantity = ?2, updated_at = ?3 WHERE id = ?1",
                params![stack_id, have - line.quantity, now],
            )?;
        }
    }

    tx.execute(
        "UPDATE trainers SET money = money + ?2, updated_at = ?3 WHERE id = ?1",
        params![trainer_id, total_amount, now],
    )?;
    record_transaction(&tx, trainer_id, shop_id, "sell", total_amount, lines, &now)?;

    tx.commit()?;
    Ok(total_amount)
}

fn add_backpack_stock(
    tx: &rusqlite::Transaction,
    trainer_id: &str,
    item_id: &str,
    quantity: i64,
    now: &str,
) -> rusqlite::Result<()> {
    let existing: Option<(String, i64)> = tx
        .query_row(
            "SELECT id, quantity FROM inventory_stacks WHERE trainer_id = ?1 AND location = 'backpack' AND item_id = ?2",
            params![trainer_id, item_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map(Some)
        .or_else(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            other => Err(other),
        })?;

    match existing {
        Some((stack_id, have)) => {
            tx.execute(
                "UPDATE inventory_stacks SET quantity = ?2, updated_at = ?3 WHERE id = ?1",
                params![stack_id, have + quantity, now],
            )?;
        }
        None => {
            let next_sequence: i64 = tx.query_row(
                "SELECT COALESCE(MAX(sequence) + 1, 0) FROM inventory_stacks WHERE trainer_id = ?1 AND location = 'backpack'",
                params![trainer_id],
                |row| row.get(0),
            )?;
            tx.execute(
                "INSERT INTO inventory_stacks (id, trainer_id, location, item_id, quantity, sequence, updated_at)
                 VALUES (?1, ?2, 'backpack', ?3, ?4, ?5, ?6)",
                params![crate::profile::repository::new_id(), trainer_id, item_id, quantity, next_sequence, now],
            )?;
        }
    }
    Ok(())
}

fn record_transaction(
    tx: &rusqlite::Transaction,
    trainer_id: &str,
    shop_id: Option<&str>,
    kind: &str,
    total_amount: i64,
    lines: &[CartLine],
    now: &str,
) -> rusqlite::Result<()> {
    let lines_json = serde_json::to_string(
        &lines
            .iter()
            .map(|l| serde_json::json!({"item_id": l.item_id, "quantity": l.quantity, "unit_price": l.unit_price}))
            .collect::<Vec<_>>(),
    )
    .unwrap_or_default();
    tx.execute(
        "INSERT INTO transactions (id, trainer_id, shop_id, kind, total_amount, lines_json, occurred_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![crate::profile::repository::new_id(), trainer_id, shop_id, kind, total_amount, lines_json, now],
    )?;
    Ok(())
}

/// Saves a Shop Preset (whole-preset replace, mirroring T04's whole-profile
/// save — a preset is edited as a unit, not streamed line by line).
pub fn save_shop_preset(conn: &mut Connection, trainer_id: &str, preset: &ShopPreset) -> rusqlite::Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO shops (id, trainer_id, name, buy_multiplier, sell_multiplier, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
            trainer_id = excluded.trainer_id, name = excluded.name,
            buy_multiplier = excluded.buy_multiplier, sell_multiplier = excluded.sell_multiplier,
            updated_at = excluded.updated_at",
        params![preset.id, trainer_id, preset.name, preset.buy_multiplier, preset.sell_multiplier, now],
    )?;
    tx.execute("DELETE FROM shop_items WHERE shop_id = ?1", params![preset.id])?;
    for (index, item) in preset.items.iter().enumerate() {
        tx.execute(
            "INSERT INTO shop_items (shop_id, item_id, available, buy_override, sell_override, sequence, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![preset.id, item.item_id, item.available, item.buy_override, item.sell_override, index as i64, now],
        )?;
    }
    tx.commit()
}

pub fn load_shop_preset(conn: &Connection, shop_id: &str) -> rusqlite::Result<Option<ShopPreset>> {
    let core: Option<(String, String, f64, f64)> = conn
        .query_row(
            "SELECT id, name, buy_multiplier, sell_multiplier FROM shops WHERE id = ?1",
            params![shop_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map(Some)
        .or_else(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            other => Err(other),
        })?;
    let Some((id, name, buy_multiplier, sell_multiplier)) = core else {
        return Ok(None);
    };

    let mut stmt = conn.prepare(
        "SELECT item_id, available, buy_override, sell_override FROM shop_items WHERE shop_id = ?1 ORDER BY sequence",
    )?;
    let items = stmt
        .query_map(params![shop_id], |row| {
            Ok(ShopItemEntry {
                item_id: row.get(0)?,
                available: row.get::<_, i64>(1)? != 0,
                buy_override: row.get(2)?,
                sell_override: row.get(3)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(Some(ShopPreset { id, name, buy_multiplier, sell_multiplier, items }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::persistence::profiles::open_and_migrate_profiles;
    use crate::profile::model::TrainerProfile;
    use crate::profile::repository::{load_trainer_profile, save_trainer_profile};

    fn fixture_shop() -> ShopPreset {
        ShopPreset {
            id: "shop-fixture".to_string(),
            name: "Fixture Poké Mart".to_string(),
            buy_multiplier: 1.0,
            sell_multiplier: 0.5,
            items: vec![
                ShopItemEntry { item_id: "potion".to_string(), available: true, buy_override: None, sell_override: None },
                ShopItemEntry { item_id: "poke-ball".to_string(), available: true, buy_override: Some(250.0), sell_override: None },
            ],
        }
    }

    /// `test_vectors/inventory_shop.json` "default-sale-half".
    #[test]
    fn default_sale_half_matches_fixture() {
        let shop = fixture_shop();
        let price = resolve_sell_price(&shop, "potion", 200.0, None);
        assert_eq!(price * 3.0, 300.0);
    }

    /// `test_vectors/inventory_shop.json` "buy-override" (transaction price wins over catalog).
    #[test]
    fn transaction_override_wins_over_catalog_price() {
        let shop = fixture_shop();
        let price = resolve_buy_price(&shop, "potion", 200.0, Some(250.0));
        assert_eq!(price, 250.0);
    }

    #[test]
    fn item_specific_override_wins_over_global_multiplier() {
        let shop = fixture_shop();
        let price = resolve_buy_price(&shop, "poke-ball", 200.0, None);
        assert_eq!(price, 250.0, "poke-ball's buy_override must win over base_price*multiplier (200)");
    }

    fn seed_trainer(money: i64) -> (std::path::PathBuf, Connection) {
        let dir = std::env::temp_dir().join(format!("ptu-shop-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut conn = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
        let profile = TrainerProfile { id: "t1".to_string(), name: "Shop Test".to_string(), level: 1, exp: 0, money, ..TrainerProfile::default() };
        save_trainer_profile(&mut conn, &profile).unwrap();
        (dir, conn)
    }

    /// `test_vectors/inventory_shop.json` "buy-override".
    #[test]
    fn checkout_buy_matches_fixture_and_is_atomic() {
        let (dir, mut conn) = seed_trainer(1000);
        let lines = vec![CartLine { item_id: "potion".to_string(), quantity: 2, unit_price: 250.0 }];
        checkout_buy(&mut conn, "t1", Some("shop-fixture"), &lines).unwrap();

        let profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(profile.money, 500);
        assert_eq!(profile.inventory.backpack[0].quantity, 2);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn checkout_buy_fails_atomically_on_insufficient_funds() {
        let (dir, mut conn) = seed_trainer(100);
        let lines = vec![CartLine { item_id: "potion".to_string(), quantity: 2, unit_price: 250.0 }];
        let result = checkout_buy(&mut conn, "t1", None, &lines);
        assert!(matches!(result, Err(ShopError::InsufficientFunds { .. })));

        let profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(profile.money, 100, "money must be unchanged on a rejected checkout");
        assert!(profile.inventory.backpack.is_empty(), "no items must be added on a rejected checkout");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn checkout_sell_credits_money_and_removes_stock() {
        let (dir, mut conn) = seed_trainer(1000);
        checkout_buy(&mut conn, "t1", None, &[CartLine { item_id: "potion".to_string(), quantity: 3, unit_price: 100.0 }]).unwrap();

        checkout_sell(&mut conn, "t1", None, &[CartLine { item_id: "potion".to_string(), quantity: 3, unit_price: 50.0 }]).unwrap();

        let profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(profile.money, 850, "1000 - 300 spent buying + 150 credited selling all 3 back");
        assert!(profile.inventory.backpack.is_empty(), "selling the whole stack removes the row");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn checkout_sell_fails_atomically_when_a_later_line_lacks_stock() {
        let (dir, mut conn) = seed_trainer(1000);
        checkout_buy(&mut conn, "t1", None, &[CartLine { item_id: "potion".to_string(), quantity: 1, unit_price: 100.0 }]).unwrap();

        // Second line asks for an item never owned: the whole cart (including the valid first line) must roll back.
        let lines = vec![
            CartLine { item_id: "potion".to_string(), quantity: 1, unit_price: 50.0 },
            CartLine { item_id: "antidote".to_string(), quantity: 1, unit_price: 50.0 },
        ];
        let result = checkout_sell(&mut conn, "t1", None, &lines);
        assert!(matches!(result, Err(ShopError::InsufficientStock { .. })));

        let profile = load_trainer_profile(&conn, "t1").unwrap().unwrap();
        assert_eq!(profile.money, 900, "money must still reflect only the original buy, not a partial sell credit");
        assert_eq!(profile.inventory.backpack[0].quantity, 1, "the potion must not have been removed by the rolled-back sell");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn shop_preset_round_trips() {
        let (dir, mut conn) = seed_trainer(0);
        let preset = fixture_shop();
        save_shop_preset(&mut conn, "t1", &preset).unwrap();
        let loaded = load_shop_preset(&conn, "shop-fixture").unwrap().unwrap();
        assert_eq!(loaded, preset);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
