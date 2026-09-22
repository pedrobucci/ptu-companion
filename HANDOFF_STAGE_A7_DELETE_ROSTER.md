# Handoff — Stage A.7 Delete Roster Without Deleting Pokémon

## Checkpoint

- Repository: `pedrobucci/ptu-companion`
- Branch: `feature/pokemon-forms-roster-qol`
- Draft PR: `#6`
- Stage start: `02308aeb6b9b8e26c54364e69793141d4474b73b`
- Validated runtime commit: `0a5ac3c3042e06c77f44334216d694119d1f69a2`
- Scope completed: **Stage A.7 — delete Roster without deleting Pokémon**
- Next stage not started: **Stage A.8 — Android Roster Pokémon tap → select + scroll to actions/details without navigating to Creatures**

## Implemented behavior

Windows/Desktop and Android/Tauri now expose a destructive `🗑 Delete Roster` action for the currently selected Roster.

Deletion is intentionally limited to Roster organization data:

- the selected Roster object is removed;
- that Roster ID is removed from every Pokémon `rosterIds` list;
- Pokémon themselves are not deleted;
- memberships in all other Rosters are preserved;
- if the deleted Roster was selected, selection moves to a surviving Roster;
- the user receives an explicit styled confirmation explaining that Pokémon will be kept;
- when the Roster has members, the confirmation reports how many Pokémon will merely be detached from it.

The final remaining Roster cannot be deleted. The user must create another Roster first. This preserves the existing invariant that the Rosters screen always has a valid Roster to select/render and avoids introducing an empty-Roster-state redesign during this narrowly scoped stage.

## Persistence and compatibility

No save-version bump and no SQLite schema migration were required.

Windows persistence already stores the relevant data in normalized tables:

- `rosters` — Roster metadata;
- `roster_memberships` — Roster/Pokémon membership links;
- `pokemon` — Pokémon records owned by the Trainer.

The Stage A.7 regression verifies that after deletion the target `rosters` row and its `roster_memberships` rows are gone while all Trainer Pokémon rows remain. It also verifies that memberships in other Rosters survive the round-trip.

Android continues to persist the same state shape, with deletion updating only `state.rosters`, Pokémon `rosterIds`, and `selectedRosterId`.

Content Packs, Rulesets, Pokémon definitions, Trainer rules and `.ptucp` formats are unchanged.

## Main files changed

- `.github/workflows/stage-a7-delete-roster.yml`
- `PTU_Companion_Windows_Source/scripts/apply_stage_a7_delete_roster.py`
- `PTU_Companion_Windows_Source/scripts/verify_stage_a7_delete_roster.mjs`
- `PTU_Companion_Android_Tauri/scripts/verify-stage-a7-delete-roster.mjs`
- `PTU_Companion_Windows_Source/static-preview/app.js`
- `PTU_Companion_Android_Tauri/www/app.js`
- `PTU_Companion_Windows_Source/package.json`
- `PTU_Companion_Android_Tauri/package.json`

Two existing Stage A.6 regression files were also loosened so their handler-exposure assertion remains valid when later Roster handlers are added:

- `PTU_Companion_Windows_Source/scripts/verify_stage_a6_edit_roster.mjs`
- `PTU_Companion_Android_Tauri/scripts/verify-stage-a6-edit-roster.mjs`

This was a test-contract compatibility adjustment only; it did not change Stage A.6 runtime behavior.

## Validation

Final validation: GitHub Actions run `35789394463` — **success**.

The complete Windows and Android `npm run verify` suites passed, including:

- `Stage A.6 Windows Roster edit regression OK`
- `Stage A.7 Windows Roster deletion regression OK`
- `Stage A.6 Android Roster edit regression OK`
- `Stage A.7 Android Roster deletion regression OK`
- all earlier Priority 0 / Stage A regressions.

The workflow produced runtime commit:

`0a5ac3c3042e06c77f44334216d694119d1f69a2` — `feat(stage-a7): delete Rosters without deleting Pokémon [skip ci]`

### Earlier validation attempts

- Run `35789179057` failed because the older Stage A.6 regression required the exact adjacent handler string `createRoster,editRoster,storePokemon`. Adding `deleteRoster` between those handlers correctly changed the runtime but made that overly strict test stale. The assertion was updated to permit later Roster handlers.
- Run `35789307184` failed because the new Stage A.7 regression initially referred to a nonexistent `pokemon_rosters` table. Repository schema inspection confirmed the real table is `roster_memberships`; the test was corrected.

Both failures were test-harness assumptions rather than application runtime defects.

## Release status

No GitHub Release was created for Stage A.7. This is an incremental QoL checkpoint rather than an owner-approved executable milestone.

No merge was performed. PR #6 must remain draft/open until explicit owner approval.

## Exact stop point

**Stage A.7 is complete and validated. Stage A.8 has not started.**

The next implementation stage is Android-specific Roster interaction: tapping a Pokémon in a Roster should select it and scroll the current Roster screen to its actions/details, without routing to the Creatures screen.
