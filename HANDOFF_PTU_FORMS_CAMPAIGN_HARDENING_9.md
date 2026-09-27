# Handoff — PTU Forms campaign hardening 9

## Branch / PR

- Repository: `pedrobucci/ptu-companion`
- Working branch: `content/ptu-parametrized-forms-catalog`
- Draft PR: `#11` (`docs: audit PTU Mega, Primal and alternate Forms`)
- Base: `feature/pokemon-shiny-d`
- Previous handoff: `HANDOFF_PTU_FORMS_CAMPAIGN_STATE_8.md`
- Campaign-hardening source checkpoint: `8ba221fffe3d10da4dad8804f89b3e89d1ae9394`
- Generated runtime checkpoint: `193c83dfeadd7997b49e0dd9e5f74aa7ebfdf3d9`
- Do not merge or release without explicit owner approval.

## Purpose of this pass

The campaign-state lifecycle path was already connected to HP controls, Moves, Abilities, explicit Form actions, battle state, scene end and persistence. This pass closes the surrounding state-consistency gaps without broadening the supplied-source scope.

The implementation remains conservative:

- no default `.ptucp` mutation;
- no unlocking of deferred/source-insufficient families;
- no invented Form transition semantics;
- no silent action/frequency spending where the app has no lossless Pokémon action ledger.

## Deterministic hardening patch

Added:

`PTU_Companion_Windows_Source/scripts/apply_stage_b_form_campaign_hardening.py`

The patch is applied to both:

- `PTU_Companion_Windows_Source/static-preview/app.js`
- `PTU_Companion_Android_Tauri/www/app.js`

It is deterministic and part of the Stage B campaign-state workflow.

## Storage / withdrawal Temporary HP cleanup

The old storage paths reset top-level `tempHp` but could leave Form-specific provenance and block metadata behind.

`storePokemon()` and `withdrawPokemon()` are now async lifecycle-aware operations. When these existing paths clear Temporary HP they also:

- set `pokemon.tempHp = 0`;
- set `pokemon.details.tempHp = 0`;
- clear `details.formTempHpBySource`;
- remove `details.formTempHpBlockOtherSources`;
- revalidate the linked Pokémon's Form state after the HP/THP reset.

Storage still preserves its prior behavior of restoring real HP and resetting combat stages. No new storage rule was invented; this pass only keeps Form-derived state consistent with the state that the existing application already clears.

## Healing items now enter the lifecycle path

The existing automated Potion, Super Potion and Oran Berry use paths previously changed HP directly and therefore bypassed HP-sensitive Forms.

For linked Species, those item actions now dispatch the same `hp-adjust` campaign event used by the normal HP controls. This means healing can correctly trigger or revalidate source-backed HP-dependent Form behavior.

The item quantity is decremented only after a valid lifecycle application. Unlinked/demo Pokémon keep the previous direct-healing fallback.

No additional items or healing values were introduced in this pass.

## Other direct HP / max-HP mutations

Form state is also revalidated after direct HP/max-HP reconciliation in existing async paths where the application can do so safely:

- Species/reference-data max-HP reconciliation;
- Pokémon Stat redistribution;
- Poké Edge acquire/refund when the resolved effect changes max HP.

The normal progression/evolution path remains synchronous at its existing boundary; the hardening patch deliberately does not inject an `await` there. Evolution already resets `formState` to base when the Species changes, so no unsupported lifecycle transition is invented.

## Visible Form lifecycle feedback

`applyPokemonFormGameEventUi()` now snapshots the Form state before applying an event and records source-driven changes in Trainer History.

New history entries:

- `Pokémon Form changed` — records Pokémon name, previous Form state, resulting Form state and, when supplied by the lifecycle rule, its frequency/action-cost labels;
- `Temporary HP blocked` — records an overflow/THP amount rejected by a source-defined active Form restriction.

Non-silent UI calls also show immediate toast feedback for these cases.

The action/frequency strings are informational. They are not automatically spent.

## Action / frequency accounting remains conservative

The current application has Trainer AP and several progression/resource counters, but no single lossless Pokémon action/frequency ledger that can represent every Form lifecycle cost (Free/Swift/Standard/Full/Extended Actions plus Daily/Scene usage) without approximation.

Therefore this pass intentionally keeps lifecycle metadata such as:

- Schooling — Daily / Free Action;
- Power Construct — Daily / Swift Action;
- Eiscue Hail restoration — Standard Action;
- Aegislash voluntary Stance Change — Full Action;
- Weapon Bond enter/relinquish — Extended Action;

visible to the caller/history while leaving actual resource spending to the existing table/combat workflow.

## Focused verifier

Added:

`PTU_Companion_Windows_Source/scripts/verify_stage_b_form_campaign_hardening.mjs`

It validates both Windows and Android surfaces and behavior for:

- Form Temporary-HP provenance/block cleanup;
- Storage/withdrawal revalidation;
- healing-item `hp-adjust` lifecycle dispatch;
- automatic Form-change history;
- blocked Temporary-HP history;
- direct HP/max-HP revalidation hooks.

## Workflow

Updated:

`.github/workflows/stage-b-form-campaign-state.yml`

The workflow now runs the hardening patch and verifier before the full regression suites and checks hardening invariants in both clients.

Final validation:

- workflow: `Stage B Form Campaign State`
- run: `36334153579`
- job: `108661667721`
- conclusion: **success**

Passed:

- existing campaign-state integration patch;
- campaign hardening patch;
- lifecycle metadata refresh;
- focused campaign-state lifecycle tests;
- focused campaign-hardening tests;
- full Windows `npm run verify`;
- full Android `npm run verify`;
- campaign/event engine parity checks;
- API/UI/persistence/hardening invariants;
- no `.ptucp` diff;
- `git diff --check`.

The successful workflow generated runtime commit:

`193c83dfeadd7997b49e0dd9e5f74aa7ebfdf3d9` — `feat(forms): harden campaign lifecycle state [skip ci]`.

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

The campaign lifecycle is now consistent across the major existing HP/THP mutation paths. A useful next pass is to audit the remaining UI/domain mutation surfaces rather than broaden source mechanics:

1. inspect every remaining Pokémon HP/max-HP assignment and classify whether it needs lifecycle revalidation, is construction-only, or is an intentional Form reset;
2. make Form-change feedback more readable by resolving IDs to display names when the catalog data is already available, without changing persisted IDs;
3. add regression coverage for save/export/import round-trips containing active Form state plus Form THP provenance;
4. separately design an action/frequency ledger only if it can represent the source costs exactly; do not couple it to this PR prematurely;
5. keep the ten deferred families and unresolved manual gates closed.
