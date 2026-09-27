# Handoff — PTU Forms persistence / readable feedback 10

## Branch / PR

- Repository: `pedrobucci/ptu-companion`
- Working branch: `content/ptu-parametrized-forms-catalog`
- Draft PR: `#11` (`docs: audit PTU Mega, Primal and alternate Forms`)
- Base: `feature/pokemon-shiny-d`
- Previous handoff: `HANDOFF_PTU_FORMS_CAMPAIGN_HARDENING_9.md`
- Source checkpoint before generated runtime: `da8dadae496df1207fd403c67625a7374362699e`
- Generated runtime checkpoint: `ced9dc56cb01da6ea796ed4a9d46c69dc7854893`
- Do not merge or release without explicit owner approval.

## Purpose of this pass

This pass closes the remaining campaign HP/max-HP lifecycle audit, improves automatic Form feedback without changing persisted IDs, and adds regression coverage for save/export/import persistence of active Form state and Form-origin Temporary HP provenance.

The source/content policy is unchanged:

- no default `.ptucp` mutation;
- no unlocking of deferred/source-insufficient families;
- no invented Form mechanics;
- no automatic action/frequency spending without a lossless Pokémon combat ledger.

## Deterministic persistence / feedback patch

Added:

`PTU_Companion_Windows_Source/scripts/apply_stage_b_form_persistence_feedback.py`

It patches both campaign clients deterministically:

- `PTU_Companion_Windows_Source/static-preview/app.js`
- `PTU_Companion_Android_Tauri/www/app.js`

It also regenerates the versioned HP mutation audit:

- `docs/PTU_FORMS_HP_MUTATION_AUDIT.md`
- `docs/data/PTU_FORMS_HP_MUTATION_AUDIT.json`

## HP / Max HP mutation audit

The audit classifies **14** campaign-client initialization/mutation surfaces:

- **7** lifecycle-sensitive/event surfaces;
- **2** construction-only surfaces;
- **1** intentional Form reset;
- **2** existing application reset paths;
- **2** unlinked/demo fallbacks;
- **0 uncovered linked surfaces**.

The key remaining gap was the normal Pokémon progression path.

### Normal level progression

`applyPokemonProgression()` is now async. When progression changes Max HP without evolving the Pokémon, the final resolved build is written first and then the individual Form state is revalidated through the existing HP-sensitive lifecycle path.

This matters for Forms whose validity depends on the current-HP / maximum-HP relationship.

### Evolution

Evolution remains deliberately different:

- the Species changes;
- the existing app already resets `formState` to `{baseFormId:'base', activeFormId:null}`;
- manual Form approvals are reset;
- the old Species' Form is not carried across evolution.

This is classified as an intentional Form reset rather than a missing lifecycle transition.

## Readable automatic Form feedback

Persisted Form IDs remain unchanged.

`pokemonFormStateLabel()` now accepts the Form definitions already returned by the lifecycle API and resolves known IDs to their catalog display names.

Automatic history/toast feedback therefore uses readable names when `payload.baseSpecies.forms` is available, while falling back to the raw ID for an unresolved/custom Form rather than inventing a name.

Examples of the display policy:

- `base` -> `Canonical Base`;
- a known `baseFormId` -> its catalog `name`;
- a known `activeFormId` -> its catalog `name`;
- unknown/custom ID -> the persisted ID unchanged.

No save migration or ID rewrite was introduced.

## Save / export / import regression coverage

Added:

`PTU_Companion_Windows_Source/scripts/verify_stage_b_form_persistence_feedback.mjs`

The verifier covers both Windows and Android save paths.

A round-trip fixture contains:

- active `details.formState` with both `baseFormId` and `activeFormId`;
- top-level `tempHp` plus mirrored `details.tempHp`;
- `details.formTempHpBySource`;
- `details.formTempHpBlockOtherSources`;
- combat-state UI data.

The fixture is JSON serialized/deserialized and passed through each client's `migrateState()`. The verifier confirms all Form state and provenance survives unchanged.

It also guards the SQLite repository behavior:

- load restores top-level Temporary HP from `details_json`;
- save writes the complete Pokémon `details` object and mirrors the current Temporary HP;
- revision snapshots continue cloning the full campaign state.

Android's richer export path (which adds Content Pack dependencies) and the desktop JSON export path are both accepted; neither is forced into the other's implementation shape.

## Windows / Android parity

The verifier compares the relevant shared client functions between Windows and Android:

- `pokemonFormStateLabel`;
- `applyPokemonProgression`;
- `migrateState`.

These Form-sensitive behaviors remain byte-identical even though Android keeps its platform-specific save/export wrapper.

## Workflow

Updated:

`.github/workflows/stage-b-form-campaign-state.yml`

The workflow now:

1. reapplies campaign-state integration;
2. reapplies the storage/healing hardening pass;
3. applies the persistence/readable-feedback pass and regenerates the HP audit;
4. refreshes lifecycle metadata;
5. runs campaign-state tests;
6. runs campaign-hardening tests;
7. runs persistence/readable-feedback tests;
8. runs complete Windows regressions;
9. runs complete Android regressions;
10. validates audit/integration invariants, no `.ptucp` mutation and `git diff --check`;
11. commits deterministic generated runtime/audit files when needed.

Final clean validation:

- workflow: `Stage B Form Campaign State`
- run: `36339779431`
- job: `108677463179`
- conclusion: **success**

The successful workflow generated:

`ced9dc56cb01da6ea796ed4a9d46c69dc7854893` — `feat(forms): close persistence and HP mutation audit [skip ci]`.

## Deferred/source gates unchanged

The exact ten deferred families remain blocked:

- Deoxys
- Giratina
- Hoopa
- Kyurem
- Landorus
- Oricorio
- Rotom
- Shaymin
- Thundurus
- Tornadus

Also unchanged:

- Darmanitan regular Zen remains manual because supplied activation rules conflict;
- Necrozma Ultra Burst remains manual because activation is source-insufficient;
- Mega/Primal review gates remain conservative where activation/action/equipment semantics are not represented losslessly;
- no default pack conversion while deferred families remain;
- no remote artwork URL is invented.

## Useful next pass

The Form campaign state is now covered across the known linked HP/max-HP mutation surfaces and save round-trips. The next pass should remain separate from source classification and focus on combat/resource ergonomics:

1. audit the existing Pokémon combat/action/frequency state to determine whether Free/Swift/Standard/Full/Extended Actions and Daily/Scene uses can be represented losslessly;
2. implement automatic spending only for the subset that the existing combat model can represent exactly; otherwise keep the lifecycle metadata informational;
3. expose a compact current-Form indicator/history in combat surfaces so automatic transitions are visible without opening the Forms manager;
4. preserve the readable-name fallback policy without changing persisted Form IDs;
5. keep all deferred families and unresolved manual gates closed.
