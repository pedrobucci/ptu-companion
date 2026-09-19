# PTU Companion Android 2.2.0-beta.20

- Restore species artwork in Pokédex lists, resolved details and creature portraits offline. Normalize `kind` when reading bundled definitions: most built-in records did not include it, so the UI skipped species artwork and detail rendering.
- Bundle 1,090 compact PokeAPI PNGs covering 1,093 exact species IDs, with explicit regional/form aliases, pinned source revisions and SHA-256 manifest. Keep pack portraits first. Unknown/unavailable images use the local default.svg; no species image requires a remote request.
- Keep artwork containers on image failure. A broken pack image tries the mapped local sprite, then a bounded default fallback; no recursive error loop.
- Assign artwork, copy and source to explicit Grid areas. Allow mobile names to wrap instead of aggressive ellipsis. The same fallback handles list and detail images.
- Add `verify-beta20-pokedex-artwork-mobile.mjs` to `npm run verify`: actual runtime/API kind, standard and regional species, custom portrait priority, file integrity, missing/broken images, list/detail HTML, CSS and version checks.
- Update Android package, Rust/Tauri version, versionCode (2002020), runtime, build filenames and current documentation. Preserve the canonical directory name and historical changelogs. Fix filesystem URL handling in three verification scripts on Windows; enforce LF for Docker shell scripts.
- Windows source, content catalogs and credentials remain unchanged. Generated APKs and local signing keys are excluded from Git.

Validation: full verification suite and beta.20 test; offline Chromium layout checks at 320, 360, 412 and 760 CSS pixels, including actual image failures, pack portraits and long names. APK build result is recorded in the pull request. Physical Galaxy S25 testing remains a device-side check.
