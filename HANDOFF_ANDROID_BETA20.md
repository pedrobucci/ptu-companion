# Handoff — PTU Companion Android beta.20

## Context

- Repository: https://github.com/pedrobucci/ptu-companion
- Android application: `PTU_Companion_Android_v2.2.0-beta.19_Tauri`
- Working branch: `fix/android-pokedex-artwork-beta20`
- Base: `main`; current commit before this handoff: `c526511`
- Pull Request: https://github.com/pedrobucci/ptu-companion/pull/1
- Merge status: open, not merged; do not merge without owner approval.

## What was fixed

The Android Pokédex no longer depends on remote sprites for normal species. The runtime now normalizes `kind` on bundled definitions, preserving species artwork and detail rendering.

Artwork resolution order:

1. `portrait_data_url` from an installed or bundled content pack;
2. exact local sprite from `www/pokemon-sprites/`;
3. `www/creatures/default.svg`.

The list thumbnail, resolved detail view, and Pokémon creature portrait use the same bounded fallback. An image error never hides the artwork container or destroys the Grid layout.

Mobile result rows use explicit Grid areas (`art`, `copy`, `source`). Names wrap on small screens instead of being aggressively ellipsized.

## Offline sprite bundle

- 1,090 compact PNG files cover 1,093 exact PTU species IDs.
- Mapping: `www/pokemon-sprites.js`.
- Integrity and source metadata: `www/pokemon-sprites/manifest.json`.
- Coverage and attribution: `www/pokemon-sprites/README.md`.
- Regenerator: `scripts/prepare-pokemon-sprites.mjs`.
- Source revisions are pinned in the generator and manifest.
- Twelve IDs intentionally have no direct upstream mapping; pack portraits or `default.svg` cover them.

Do not add a remote image fallback back to the Android path without updating the offline requirement and tests.

## Version and build

- App version: `2.2.0-beta.20`.
- Android version code: `2002020`.
- APK output: `dist/android/PTU-Companion-v2.2.0-beta.20-arm64-release.apk`.
- Build target: ARM64 (`arm64-v8a`), suitable for Galaxy S25.
- APK SHA-256: `7cbd244b94a8a14807d2c1b1ca1148df8fcb842810a671c2808592d314ccd14d`.
- APKs, generated Tauri output, and signing keys are ignored and must not be committed.

The validated checkout generated a local beta signing key. Updating an existing installation requires the same signing key used by that installation.

## Validation already completed

- `npm run verify` passed, including `scripts/verify-beta20-pokedex-artwork-mobile.mjs`.
- The beta.20 test covers normal species, Pikachu/Pichu/Raichu, regional forms, pack portrait priority, list/detail fallback, local file integrity, CSS layout, and version identifiers.
- Offline Chromium/Edge checks passed at 320, 360, 412, and 760 CSS pixels with external requests blocked.
- `docker compose config --quiet` and `docker compose run --rm doctor` passed.
- ARM64 release APK compiled; `apksigner verify` and `zipalign -P 16` passed.
- No Windows source files were changed.

## Suggested next steps

1. Review PR #1 and its 1,119 changed files, mostly the committed sprite bundle.
2. Install the APK on a Galaxy S25 using the matching beta signing key.
3. Verify Pokédex entries for Pikachu, Pichu, Raichu, a regional form, a pack species, and a missing-art fallback.
4. Merge only after owner approval.

## Important files

- `PTU_Companion_Android_v2.2.0-beta.19_Tauri/www/app.js`
- `PTU_Companion_Android_v2.2.0-beta.19_Tauri/www/mobile-runtime.js`
- `PTU_Companion_Android_v2.2.0-beta.19_Tauri/www/mobile-api.mjs`
- `PTU_Companion_Android_v2.2.0-beta.19_Tauri/www/styles.css`
- `PTU_Companion_Android_v2.2.0-beta.19_Tauri/scripts/verify-beta20-pokedex-artwork-mobile.mjs`
- `PTU_Companion_Android_v2.2.0-beta.19_Tauri/CHANGELOG_ANDROID_BETA20.md`
