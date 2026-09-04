//! Verifies T07 directly against the real `test_vectors/inventory_shop.json`
//! and `fixtures/shop_preset.json`.

use std::path::{Path, PathBuf};

use serde_json::Value;

use ptu_domain::engine::shop::{resolve_buy_price, resolve_sell_price, ShopPreset};
use ptu_domain::persistence::profiles::open_and_migrate_profiles;
use ptu_domain::profile::model::TrainerProfile;
use ptu_domain::profile::repository::save_trainer_profile;

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..")
}

fn load_fixture_shop() -> ShopPreset {
    let path = repo_root().join("fixtures/shop_preset.json");
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("reading {path:?}: {e}"));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("parsing {path:?}: {e}"))
}

fn load_vectors() -> Vec<Value> {
    let path = repo_root().join("test_vectors/inventory_shop.json");
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("reading {path:?}: {e}"));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("parsing {path:?}: {e}"))
}

#[test]
fn shop_fixture_loads_with_the_documented_shape() {
    let shop = load_fixture_shop();
    assert_eq!(shop.id, "shop-fixture");
    assert_eq!(shop.buy_multiplier, 1.0);
    assert_eq!(shop.sell_multiplier, 0.5);
    assert_eq!(shop.items.len(), 2);

    // poke-ball has a buy_override (250); potion does not.
    let poke_ball_price = resolve_buy_price(&shop, "poke-ball", 200.0, None);
    assert_eq!(poke_ball_price, 250.0);
    let potion_price = resolve_buy_price(&shop, "potion", 200.0, None);
    assert_eq!(potion_price, 200.0);
}

#[test]
fn inventory_shop_vectors_pass() {
    let vectors = load_vectors();
    assert_eq!(vectors.len(), 2);

    for v in &vectors {
        let id = v["id"].as_str().unwrap();
        let input = &v["input"];
        let expected = &v["expected"];

        if input.get("base_price").is_some() {
            // "default-sale-half"
            let shop = ShopPreset {
                id: "vector-shop".to_string(),
                name: "Vector Shop".to_string(),
                buy_multiplier: 1.0,
                sell_multiplier: input["sell_multiplier"].as_f64().unwrap(),
                items: vec![],
            };
            let base_price = input["base_price"].as_f64().unwrap();
            let quantity = input["quantity"].as_i64().unwrap();
            let unit_price = resolve_sell_price(&shop, "some-item", base_price, None);
            let money_added = (unit_price * quantity as f64).round() as i64;
            assert_eq!(money_added, expected["money_added"].as_i64().unwrap(), "vector {id}");
        } else if input.get("catalog_price").is_some() {
            // "buy-override": full checkout round trip.
            let dir = std::env::temp_dir().join(format!("ptu-inventory-shop-vector-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir_all(&dir).unwrap();
            let mut conn = open_and_migrate_profiles(&dir.join("profiles.sqlite")).unwrap();
            let money_before = input["money_before"].as_i64().unwrap();
            let profile = TrainerProfile {
                id: "t1".to_string(),
                name: "Vector Trainer".to_string(),
                level: 1,
                exp: 0,
                money: money_before,
                ..TrainerProfile::default()
            };
            save_trainer_profile(&mut conn, &profile).unwrap();

            let quantity = input["quantity"].as_i64().unwrap();
            let transaction_price = input["transaction_price"].as_f64().unwrap();
            let lines = vec![ptu_domain::engine::shop::CartLine {
                item_id: "vector-item".to_string(),
                quantity,
                unit_price: transaction_price,
            }];
            ptu_domain::engine::shop::checkout_buy(&mut conn, "t1", None, &lines)
                .unwrap_or_else(|e| panic!("vector {id}: {e}"));

            let reloaded = ptu_domain::profile::repository::load_trainer_profile(&conn, "t1").unwrap().unwrap();
            assert_eq!(reloaded.money, expected["money_after"].as_i64().unwrap(), "vector {id}");
            assert_eq!(
                reloaded.inventory.backpack[0].quantity,
                expected["inventory_delta"].as_i64().unwrap(),
                "vector {id}"
            );

            let _ = std::fs::remove_dir_all(&dir);
        } else {
            panic!("vector {id}: unrecognized inventory_shop.json vector shape");
        }
    }
}
