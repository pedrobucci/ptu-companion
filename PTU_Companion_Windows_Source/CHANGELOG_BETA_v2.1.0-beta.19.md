# PTU Companion Beta v2.1.0-beta.19

## Fakemon 1 leva v2 bundled defaults

- Bundles `campaign-homebrew-fakemon-1-leva` v2.0.0 as part of the default Windows content set.
- Includes 13 campaign Species, 8 Moves, 3 Abilities and offline Species artwork from the approved Fakemon v2 update.
- Keeps Hisuian Zorua and Hisuian Zoroark as separate regional definitions instead of replacing their normal forms.
- Includes the campaign overlays for Greavard, Houndstone, Maschiff, Mabosstiff, Fidough and Dachsbun, plus the corrected Panzeus level-up entries.
- The application version advances from `2.1.0-beta.18` to `2.1.0-beta.19`, forcing the desktop launcher to extract a fresh runtime while preserving the persistent campaign data under `%LOCALAPPDATA%\PTU Companion Beta\data`.

Existing beta.18 saves remain in the persistent data directory. The updated executable/runtime is intended to expose the new bundled definitions without requiring a manual `.ptucp` import.
