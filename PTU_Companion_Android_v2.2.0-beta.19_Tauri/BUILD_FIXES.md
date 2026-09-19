# Android UI fixes — v2.2.0-beta.6

This revision is the first real-device mobile layout pass after the Tauri/Gradle APK was confirmed installable on a Samsung Galaxy S25.

## Root cause of the distorted phone layout

The desktop stylesheet still declared `body { min-width: 1180px; }`. The Android rules restyled the inner application shell but did not override the root document width, so Android WebView rendered a desktop-width document inside a narrow viewport. This caused horizontal cropping, oversized cards, clipped Trainer tabs/actions, and only part of multi-column content being visible.

The S25 also runs the WebView edge-to-edge, so the application header and bottom navigation could overlap the Android status/navigation bars when `env(safe-area-inset-*)` resolves to zero.

## beta.4 changes

- Android body/root explicitly uses `min-width: 0`, `max-width: 100vw`, and hides document-level horizontal overflow.
- Adds Android safe-area fallbacks for Samsung status and three-button navigation bars.
- Reworks header dimensions and uses the app icon instead of the placeholder circle.
- Bottom navigation reserves space for the system navigation area.
- Home dashboard is compact and card-first, following the supplied mobile mockups.
- Trainer tabs and Creature tabs are horizontal touch scrollers rather than desktop-width strips.
- Trainer Profile actions use a two-column touch grid and no longer overflow off-screen.
- Rosters, creature strips, inventory, equipment, item actions and Move cards receive phone-specific density/layout rules.
- Range and Contest information on Pokémon Moves remains enabled in the Android build.
- `More` is visually active when the user is on a secondary screen.
- Android `versionCode` is explicitly advanced to `2002006`, so beta.5 can replace the installed beta.4 without losing the campaign save.

## Build

```powershell
docker compose run --rm doctor
docker compose run --rm android-arm64-release-apk
```

Expected output:

```text
dist\android\PTU-Companion-v2.2.0-beta.6-arm64-release.apk
```


## beta.5 — Creature/Roster mobile layout

- Creature Sheet is now strictly one-column below the tab bar on phones.
- Creature hero becomes a 2-column portrait/identity card with HP and loyalty on a full-width second row.
- Progress/Training/Create/Delete actions use a 2x2 touch grid instead of overflowing horizontally.
- Active State, PTU Combat Stats, Combat Stages, Moves, Abilities, Item/Storage and Battle Cycle can no longer inherit the desktop three-column grid.
- Roster selector is a wrapping two-column grid so every roster remains visible without hidden horizontal scrolling.
- Dashboard Active Rosters uses the same all-visible wrapping behavior.

## v2.2.0-beta.6 — Android Content Packs + Samsung keyboard fix

- Android player edition can now install `.ptucp` files from **More → Save / Import / Export → Content Packs**.
- Import uses the same `ptu-content-pack` format as Desktop beta.6.
- The native Tauri/Rust layer validates ZIP paths, manifest format/version, declared byte sizes, SHA-256 hashes, record counts, required pack dependencies, archive limits, NDJSON/JSON syntax, and supported definition kinds before persisting the pack.
- Imported packs are stored in the Android app-data directory under `content-packs/`, so APK updates using the same application id do not remove them.
- A pack is enabled in the Ruleset that was active at import time. Re-importing the same pack id updates it rather than duplicating it.
- Imported Species, Moves, Abilities, Capabilities, Features, Edges, Poké Edges, Items and PTU evolution datasets are overlaid on the embedded mobile definition bundle using Ruleset priority resolution.
- Exported JSON saves now include `contentDependencies` inferred from definitions used by the campaign. JSON import also infers pack ids already embedded in older saves, and blocks the import when required packs are missing.
- `Add Game Item` no longer rebuilds the entire modal on every keystroke. Only the results/count nodes are updated, keeping the same focused input and preventing Samsung Keyboard from closing/reopening for each typed character.
- Android versionCode: `2002006`.


## v2.2.0-beta.7 — Content Pack Manager

- Imported `.ptucp` packs can be enabled or disabled without deleting them.
- A disabled pack remains disabled when a newer archive with the same `manifest.id` is imported.
- Imported packs can be uninstalled from Save Tools; the runtime recomputes the active definition overlay immediately.
- Required dependency checks prevent enabling a pack without its requirements or removing a pack still required by another installed pack.
- Bundled Android content remains protected from uninstall through this manager.
