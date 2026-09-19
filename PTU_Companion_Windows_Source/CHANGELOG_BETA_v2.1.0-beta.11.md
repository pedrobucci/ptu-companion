# PTU Companion Beta v2.1.0-beta.11

## Pokémon sex hotfix

- Restores the Pokémon **Sex** field throughout the functional application.
- Pokémon creation now offers **None / Male / Female** under Species & Identity.
- **Creature Sheet → Edit Identity** can change Name, Loyalty, and Sex after creation.
- Sex is visible on the Creature Sheet and Roster details.
- Existing saves are migrated without schema changes. Legacy `gender`/`sex` values are preserved when present; Pokémon with no saved value default to `None`.
- Sex is stored inside the Pokémon `details` payload, so SQLite saves and JSON export/import preserve it on both Desktop and Android.
