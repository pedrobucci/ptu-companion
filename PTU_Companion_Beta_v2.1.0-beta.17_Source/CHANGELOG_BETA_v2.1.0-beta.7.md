# PTU Companion Beta v2.1.0-beta.7

## Content Pack Manager

- Added Enable/Disable controls for Content Packs in the active Ruleset.
- Disabling is non-destructive: definitions stay installed and can be re-enabled later.
- Added Uninstall for user-imported `.ptucp` packs. Bundled packs are protected.
- Uninstall creates a definitions SQLite backup before changing the database.
- Required dependency checks block unsafe disable/uninstall operations.
- Re-importing/updating a pack with the same `manifest.id` preserves its enabled/disabled state.
- The UI warns when the active Trainer save currently references the pack being disabled or removed.

No Content Pack format change is required.
