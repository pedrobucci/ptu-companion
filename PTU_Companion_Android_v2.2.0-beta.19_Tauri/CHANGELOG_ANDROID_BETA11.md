# PTU Companion Android v2.2.0-beta.11

## Pokémon sex hotfix

- Restores Pokémon **Sex** in creation with **None / Male / Female**.
- **Creature Sheet → Edit Identity** edits Name, Loyalty, and Sex.
- Sex appears on the Creature Sheet and Roster details.
- Existing Android saves preserve legacy `gender`/`sex` values when available and otherwise default to `None`.
- The value remains inside the Pokémon details object so Android save/export/import continues to preserve it without a database migration.
- Android `versionCode` is now `2002011`.
