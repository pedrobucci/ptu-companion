# PTU Companion Beta v2.1.0-beta.9

## Content Pack artwork

- `.ptucp` Species may now reference `portrait_asset_path` / `artwork_assets` inside the same archive.
- PNG, JPEG and WebP portraits up to 5 MB are validated and embedded into the installed Species definition for offline use.
- Pack portraits take precedence over Pokémon Showdown / PokéAPI fallbacks.
- Bundled `campaign-homebrew-fakemon-1-leva` updated to v1.1.0 with Panthore, Panzeus, Clefable W., Clefable K., Greavard, Houndstone, Maschiff and Mabosstiff plus eight portraits.
- Existing persistent definition databases receive the newer bundled Fakemon pack automatically unless the same pack was explicitly user-imported; Ruleset enable/disable state is preserved and a definitions backup is created first.

## Trainer Experience Bank

- Trainer Profile now exposes the current Trainer XP Bank with ±1, ±5 and exact-value controls.
- Normal Trainer Level Up costs 10 XP and preserves any remainder instead of clearing the bank.
- GM Milestone Level Up is available through GM Override and costs 0 XP.
- Trainer Edges can be bought from the active Ruleset for 1 XP.
- Trainer Features can be bought from the active Ruleset for 2 XP.
- XP purchases still validate prerequisites, repeatability, class cap and configuration choices; GM Override can explicitly bypass those checks.
- XP adjustments, Level Up spending and XP purchases are recorded in Trainer history.
