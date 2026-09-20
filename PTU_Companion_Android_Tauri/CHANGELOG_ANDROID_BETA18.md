# PTU Companion Android v2.2.0-beta.18

Android counterpart to Windows beta.17:

- Gear Store backed by active Content Pack item definitions.
- Trainer Gear structured equipment mechanics and per-copy equipment configuration.
- Actual item artwork in Backpack/Equipment/catalog/shops when available.
- Imported `.ptucp` Item icon assets can be embedded as `icon_data_url`.
- Trainer Combat now displays the fully resolved current Struggle Attack.
- Struggle resolution includes weapon modifiers, normal/Arcane qualification, current stats, Accuracy/Damage bonuses and supported Struggle capabilities.
- Fixed duplicate DR/Evasion application for structured imported gear and weapon hybrids.

Native APK still needs to be compiled with the Android/Tauri toolchain (or the provided Docker workflow).

## Bundled defaults
- Weapons v2.1.0 and Trainer Gear v1.0.0 are embedded in the Android definition bundle and enabled by default.
- Older native imports of the same pack IDs are migrated to the bundled copy while preserving their enabled/disabled state, preventing duplicate Content Pack entries.
