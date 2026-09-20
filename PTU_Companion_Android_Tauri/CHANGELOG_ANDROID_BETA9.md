# PTU Companion Android v2.2.0-beta.9

## `.ptucp` Species portraits

- Android native importer now reads `portrait_asset_path` / `artwork_assets` from Species definitions.
- PNG, JPEG and WebP portraits up to 5 MB are validated by the Rust/Tauri layer and stored with the imported definition as offline image data.
- Pack portraits are used before the Pokémon Showdown fallback.
- Embedded mobile Ruleset updated with `campaign-homebrew-fakemon-1-leva` v1.1.0: eight Species and eight portraits.

## Trainer Experience Bank

- Current Trainer XP is shown and editable on the Trainer Profile.
- Normal Level Up spends 10 XP and retains the remainder.
- GM Milestone Level Up costs 0 XP when explicitly selected with GM Override.
- Edge purchase: 1 Trainer XP.
- Feature purchase: 2 Trainer XP.
- Ruleset prerequisites, duplicate/rank limits, choices and class cap continue to be checked before the purchase.
- XP changes and purchases are persisted in Trainer history.
