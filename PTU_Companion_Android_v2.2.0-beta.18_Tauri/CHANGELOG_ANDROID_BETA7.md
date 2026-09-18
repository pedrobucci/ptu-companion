# PTU Companion Android v2.2.0-beta.7

## Content Pack Manager

This release adds lifecycle management for user-imported `.ptucp` content packs.

- **Enable / Disable:** imported packs can be disabled for the active Ruleset without deleting their archive or metadata.
- **Safe updates:** importing a newer version with the same `manifest.id` preserves the current enabled/disabled state.
- **Uninstall:** user-imported packs can be removed from the device and their definition overlay is recomputed immediately.
- **Dependency protection:** a pack cannot be enabled when a required dependency is disabled, and a pack required by another installed pack cannot be uninstalled.
- **Bundled content protection:** built-in Android definitions are not uninstallable through the Content Pack Manager.
- **UI:** Save Tools now lists imported packs with state and Enable/Disable/Uninstall actions.

The `.ptucp` format itself is unchanged. Existing packs remain compatible.
