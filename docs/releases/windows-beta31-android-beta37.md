# Test release — Windows beta.31 / Android beta.37

Prepared from reviewed integration commit `052acbec87f08330b09cb34a47c0b7ae1441bd88`, descendant of the latest published beta.30/beta.36 release. The version metadata PR must be reviewed and merged before tagging and publishing the exact merged commit.

## Included changes

- #23 / PR #70: optional species names on roster cards, with persisted preference; disabled by default.
- #72 / PR #73: five aligned columns and shared header/row scrolling in Pokémon Level Up.
- #32 / PR #80: preview and confirmation for reverting newly captured level-ups/evolutions, one event at a time. Changes to affected values block reversal; legacy events remain unavailable.
- #79 / PR #80: progression history survives replacement of Pokémon details during revalidation.

All four issues remain open for Pedro's explicit validation in the installed applications. Merged PRs do not establish application validation.

## Release checks

- Keep Windows runtime/server/launcher/UI at `2.1.0-beta.31`.
- Keep Android package/Tauri/Rust/runtime/UI at `2.2.0-beta.37`; expect `versionCode 2002037`, package `com.ptu.companion`, ARM64 only.
- Verify both full suites, then the packaged EXE/APK, hashes, APK alignment and signature continuity against beta.36.
- Use the persistent existing Android signing identity. Do not distribute a differently signed update as an in-place upgrade.
- After merge approval, tag the exact reviewed merge, regenerate artifacts from that commit and record source SHA/checksums/certificate metadata with the GitHub Release.

## App validation

Export a campaign before testing. On both platforms, toggle the roster species preference and check it after restart; level up a test Pokémon and check aligned controls/scrolling; apply a new level-up/evolution, review and cancel a reversal, then confirm and check persistence after restart. Confirm that later HP/Move/resource edits block reversal without overwriting those edits.
