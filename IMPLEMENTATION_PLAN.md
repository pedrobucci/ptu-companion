# PTU Companion — Agent Implementation Plan v1.0

## Read order
1. `README_FIRST.md`
2. `TECHNICAL_SPECIFICATION_v1.0.md`
3. `seed/DATA_FORMAT_v1.0.md`
4. `test_vectors/`
5. `fixtures/`
6. Implement, using `.ptucp` imports rather than hardcoding rule text.

## Milestones
1. Tauri 2 workspace + Windows/Android smoke builds.
2. Runtime SQLite migrations and staged `.ptucp` importer with hash/schema/path-traversal validation.
3. Ruleset/version resolver.
4. Trainer + Pokémon instance repositories and profile lazy-loading.
5. Modifier/explainability engine.
6. Progression/validation engine and creation/level-up wizards.
7. Resolved Move service (STAB/DB/damage expression/weapon variant; no dice rolling).
8. Active combat state + round/scene/day reset service.
9. Rosters/storage invariants.
10. Inventory/equipment/shop transactions.
11. GM grants/respec/history.
12. Search/Pokédex/rules UI.
13. Import/export trainer packs and embedded referenced homebrew.
14. Windows content editor.
15. Android performance pass and ARM64 release APK.

## Hard requirements
- No PTU rules in React components.
- No fixed six-Move array for Pokémon; limit is resolved by rules. Trainer Move list is unlimited.
- No destructive content overwrite.
- `Injuries > 0` blocks Pokémon Storage.
- A Pokémon may belong to multiple active Rosters.
- The app never rolls dice.
- Derived values expose provenance/explanation.
- All import mutation is staged/transactional.

## Definition quality behavior
`needs_review`, `mechanical_completeness`, `reference_status`, and semantic `automation_level` are runtime-visible quality signals. Do not treat missing/ambiguous fields as zero or false.
