# Agent Handoff — How to use this frontend prototype

## Purpose

The local implementation agents were having difficulty translating the static visual concept into a coherent desktop interface. This project removes that ambiguity by providing a running UI prototype with reusable components and mocked interactions.

## Recommended workflow

1. Run the prototype and inspect every sidebar screen.
2. Compare each screen against the corresponding image in `docs/reference/`.
3. Preserve the component hierarchy and overall density.
4. Replace mock objects from `src/mockData.ts` with application services/repositories.
5. Move all rule calculations into the domain/rules layer.
6. Connect the frontend to Tauri commands after the desktop experience is visually stable.

## Screen mapping

| Prototype screen | Reference image |
|---|---|
| Dashboard | `ptu_companion_dashboard_showcase.png` |
| Trainer | `ptu_companion_trainer_dashboard.png` |
| Rosters | `ptu_companion_roster_management_ui.png` |
| Creature | `ptu_companion_creature_sheet_mockup.png` |
| Storage | `ptu_companion_storage_management_ui.png` |
| Items | `ptu_companion_inventory_mockup.png` |
| Shop | `ptu_companion_shop_checkout_concept.png` |
| NPCs | `ptu_companion_npc_journal_interface.png` |
| Level Up | `ptu_companion_level_up_wizard.png` |
| Content Editor | `ptu_companion_content_editor_mockup.png` |
| Move Editor | `ptu_companion_move_editor_showcase.png` |
| Ability Editor | `ptu_companion_ability_editor_mockup.png` |
| Species Editor | `ptu_companion_species_editor_mockup.png` |

## Architecture boundaries

The frontend should ultimately talk to abstractions such as:

```ts
interface RulesService {
  resolveMove(instanceId: string): Promise<ResolvedMove>
  validateChoice(context: ChoiceContext): Promise<ValidationResult>
}

interface ProfileRepository {
  getActiveTrainer(): Promise<TrainerProfile>
  saveProfile(profile: TrainerProfile): Promise<void>
}

interface ContentRepository {
  searchDefinitions(query: SearchQuery): Promise<DefinitionSummary[]>
  getDefinitionVersion(id: string): Promise<DefinitionVersion>
}
```

The visual components should never be responsible for interpreting English rule text.

## Production transition

The most direct production path is:

- keep React + TypeScript + Vite;
- wrap it in Tauri 2;
- implement persistence in Rust/SQLite;
- expose commands/services to the React layer;
- retain the reusable CSS tokens and component patterns from this prototype;
- gradually replace mocked screens with bound domain state.

---

## Functional v0.2 update

The functional prototype now has a server-backed SQLite repository. Treat the following files as the persistence reference for the next implementation steps:

- `server.mjs`
- `persistence/database.mjs`
- `persistence/repository.mjs`
- `seed/default-state.json`
- `docs/DATA_PERSISTENCE_V02.md`

When the app is started with `RUN_FUNCTIONAL_PREVIEW.bat`, UI actions are autosaved to SQLite. Do not regress the implementation to browser-only persistence.

The user also reported an Active State / Current HP overflow in v0.1. The accepted fix is documented in `docs/QA_CURRENT_HP_FIX.md` and the original reproduction screenshot is under `docs/qa/current-hp-overflow-v01.png`.
