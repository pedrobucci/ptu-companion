# PTU Companion Beta v2.1.0-beta.17

## Trainer Gear / Gear Store
- Added support for `campaign-homebrew-trainer-gear` equipment definitions.
- Added **Gear Store**, a catalog-backed shop parallel to Weapon Store.
- Added data-driven equipment configuration before equipping (Skill, Stat, Type, Biome, etc.).
- Added structured resolution for physical/special DR, Evasion, Accuracy, Save Checks, Effect Range, default Combat Stages, Skill/Stat bonuses, Capabilities and contextual equipment rules.
- Imported equipment continues to grant Moves/Abilities/Capabilities only while equipped.

## Item artwork
- Catalog items may use `icon_url`, embedded `icon_data_url`, or pack-local `icon_asset_path`.
- Backpack, Equipment, Add Game Item, shops and cart render the actual item art when available, with category fallback offline.
- `.ptucp` importer embeds local Item icon PNG/JPEG/WebP assets up to 5 MB, analogous to Species portraits.

## Trainer Combat
- Added a resolved **Struggle Attack** card to the Trainer Combat tab.
- Resolves base PTU AC/DB, Combat/alternate qualification, Weapon AC/DB/range/class, current staged Attack/Sp. Attack, static damage/accuracy modifiers and supported Struggle-altering Capabilities.
- Arcane Weapons use Special damage and Occult Education for bonus Struggle DB; normal melee respects supported Feature substitutions such as Apparition.

## Fixes
- Prevented structured imported equipment from receiving legacy Core fallback bonuses a second time.
- Prevented Living/weapon equipment Evasion and DR mechanics from being double-counted.

## Bundled defaults
- `PTU Weapons — Core, Arcane, Living & Alchemy v2.1.0` and `PTU Trainer Gear v1.0.0` are now bundled with the application and enabled by default in `All Supplied Material`.
- Existing persistent definition databases receive the bundled versions on startup without overwriting a user-imported copy or the user’s enabled/disabled choice.
