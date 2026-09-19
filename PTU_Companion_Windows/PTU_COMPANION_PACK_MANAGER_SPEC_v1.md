# PTU Companion — Pack Manager Update Specification

**Proposed targets:**
- Windows: `v2.1.0-beta.7`
- Android: `v2.2.0-android-beta.7`

## Goal

Add safe management of installed `.ptucp` Content Packs on both Windows and Android without changing the pack format. The feature must distinguish between **disabling** a pack in a Ruleset and **uninstalling** a pack from the device.

## Required behavior

### 1. Installed Pack Manager

Expose a Content Packs screen showing, at minimum:

- pack name;
- `manifest.id`;
- version;
- priority;
- kind/source;
- content counts;
- whether it is built-in or imported;
- status in the currently active Ruleset;
- dependency status.

Windows location: existing `Pokédex & Rules > Desktop Content Packs` area.

Android location: `More > Pokédex & Rules > Content Packs` (or the equivalent existing Rules screen). This is management of imported content, not content authoring; Editors remain hidden on Android.

### 2. Disable / Enable

Add an **Enabled in this Ruleset** toggle.

Disabling must be non-destructive:

- do not delete definitions;
- do not delete the installed `.ptucp` archive/cache;
- remove the pack only from resolution for the active Ruleset;
- immediately recalculate effective definitions;
- allow lower-priority definitions from other enabled packs/Core to become effective again;
- persist the disabled state after app restart;
- permit later re-enable without re-importing.

If the current campaign directly references definitions that would become unresolved, show a warning with the number/type of affected references before disabling. Overrides that safely fall back to another definition with the same `logical_id` should not be treated as unresolved.

### 3. Uninstall / Remove from device

Add **Uninstall pack** as a destructive action with confirmation.

Before uninstalling:

1. create a definitions backup/snapshot;
2. check required dependencies from other installed/enabled packs;
3. check current campaign/save references to definitions owned by the target pack;
4. block by default when a required dependent pack exists;
5. warn when campaign references would become unresolved and recommend Disable instead.

Uninstall must remove only data belonging to the target `content_pack_id` and its stored imported archive/metadata. It must never delete Trainer, Pokémon, inventory, NPC, roster, or other campaign records as a cascade side effect.

Built-in/Core packs should be marked non-removable. If the active Ruleset requires a built-in pack, its toggle must be locked or dependency-protected.

### 4. Import/update interaction

When importing a `.ptucp` whose `manifest.id` is already installed:

- treat it as an update of the same pack;
- preserve its existing enabled/disabled state in each Ruleset;
- replace only records belonging to the same pack according to the existing import transaction behavior;
- do not silently re-enable a pack that the user previously disabled;
- recalculate resolution after a successful update.

For a first-time install, enabling in the current Ruleset may remain the default.

### 5. Resolver contract

Pack resolution must continue to use the current strategy:

`highest_enabled_priority_then_ruleset_order`

Disabling therefore changes only whether the pack participates in resolution. It does not destroy lower-priority versions from Core or other packs.

### 6. Android

Use the same `.ptucp` format as Desktop. The Tauri/Rust native layer should expose pack-management commands equivalent to:

- list installed packs;
- set pack enabled/disabled for a Ruleset;
- inspect dependencies/usage;
- uninstall imported pack;
- recalculate active definition overlay.

Do not add authoring/editors to Android.

### 7. Windows

Extend the existing Desktop Content Packs area with the same management semantics. The persistent definitions directory remains outside the versioned executable install, so app upgrades must not clear installed packs.

Do not implement removal by only deleting files under `installed-packs`: definitions are also imported into the definitions database and must be changed transactionally.

## Recommended UI states

Each pack card/row should expose:

- `Enabled` / `Disabled` status;
- toggle for the active Ruleset;
- `Update` state when importing the same ID with a newer version;
- `Uninstall` action for imported packs;
- `Built-in` badge for non-removable packs;
- dependency/reference warning icon when applicable.

## Safety requirements

- All enable/disable/uninstall operations are transactional.
- Recalculate resolver only after successful commit.
- Restore prior state on failure.
- Never cascade-delete campaign entities.
- Keep provenance fields intact.
- Create a backup before uninstall and before destructive pack replacement.
- Do not allow dependency breakage silently.

## Acceptance tests

1. Import a high-priority override pack; verify its definition wins.
2. Disable it; verify the lower-priority/Core definition becomes effective without deleting either version.
3. Re-enable it; verify the override becomes effective again.
4. Restart the app; verify enabled state persists.
5. Update the disabled pack with the same `manifest.id`; verify it remains disabled.
6. Uninstall the pack; verify its definitions disappear and Core/other-pack definitions remain.
7. Verify uninstall does not alter campaign save records.
8. Verify a required dependency cannot be removed while a dependent enabled pack requires it.
9. Verify warning for campaign references that would become unresolved.
10. Repeat the same scenarios on Android with the same `.ptucp` file.

## Build commands used by the existing project pipeline

Android:

```powershell
docker compose run --rm doctor
docker compose run --rm android-arm64-release-apk
```

Windows:

```powershell
docker compose run --rm doctor
docker compose run --rm windows-exe
```

## Important temporary warning

Until this feature is implemented, do **not** uninstall a Content Pack by manually deleting only its file/folder from the persistent definitions directory. The imported records also live in the definitions database, so file deletion alone can leave the database and pack registry inconsistent.
