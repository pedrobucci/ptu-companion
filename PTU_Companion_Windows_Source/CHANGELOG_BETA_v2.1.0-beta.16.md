# PTU Companion v2.1.0-beta.16

## Item catalog and Weapon Store

- Fixes stale `+ Add game item` results after importing a `.ptucp`; the item catalog is invalidated and reloaded after Content Pack changes.
- Catalog item DTOs now preserve Content Pack provenance plus `shop_categories` / `shop_visible` metadata.
- Adds the **Weapon Store** shop preset. It loads purchasable weapon definitions from enabled Content Packs instead of requiring them to already exist in the Backpack.
- Buying a catalog weapon creates the canonical Backpack item and keeps all imported weapon mechanics/provenance intact.
- Supports `campaign-homebrew-custom-weapons` v2.1.0, whose 47 weapons are tagged for the Weapon Store.
