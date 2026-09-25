# Handoff — Stage D · Pokémon Shiny

## Repository state

- Repository: `pedrobucci/ptu-companion`
- Branch: `feature/pokemon-shiny-d`
- Stacked on: `feature/pokemon-forms-ui-c`
- Historical Stage D start: `e6f08fdb9095d0d78af5884a250249a157ba2bd4`
- Validated Stage D runtime: `829b180` (`feat(stage-d): add Pokemon Shiny presentation [skip ci]`)
- No merge and no Release were performed.

## Scope completed

Stage D adds Shiny as persistent presentation state on each individual Pokémon, independently of permanent/base Forms and temporary transformations.

### Persistence and migration

- `pokemon.details.isShiny` is the canonical individual flag.
- Old/legacy `is_shiny` and top-level variants are normalized safely during state migration.
- Existing `pokemon.details_json` persistence is reused; there is no campaign SQLite schema migration, save schema bump, or `.ptucp` format bump.
- Pokémon Builder defaults to non-Shiny and can create a Shiny Pokémon explicitly.
- Edit Pokémon Identity can toggle the Shiny state later and records the change in Trainer history.

### Presentation resolution

The Forms resolver now also exposes a presentation layer. Artwork is resolved in this order:

1. active transformation Shiny artwork;
2. active transformation normal artwork;
3. permanent/base Form Shiny artwork;
4. permanent/base Form normal artwork;
5. Species Shiny artwork;
6. Species normal artwork;
7. the platform's existing/local sprite fallback.

A Pokémon remains Shiny even when no dedicated Shiny artwork exists. In that case, the best normal artwork is displayed as an explicit fallback; the app does not silently clear the Shiny state.

### Windows

- Desktop portrait endpoint accepts current permanent Form, active transformation, and `shiny=1` presentation state.
- Pack-provided data URLs, HTTP(S) image URLs, and safe relative artwork paths can be resolved before the existing bundled/default sprite fallback.
- Creature Sheet shows `★ SHINY` and the combined `POKÉMON FORM & APPEARANCE` summary.

### Android

- Mobile runtime exposes resolved Form/Shiny artwork through `__PTU_RESOLVED_POKEMON_ARTWORK__`.
- `pokemonPortraitUrl` uses the same Form/Shiny precedence as Windows, then falls back to the existing local Android artwork mapping.
- UI/persistence behavior mirrors Windows.

### Stage C compatibility

Stage D extends the Stage C Form summary title rather than replacing its mechanics. The Stage C source-contract regression was made forward-compatible with `POKÉMON FORM & APPEARANCE`; no Stage C gameplay behavior changed.

The duplicated evolution Form-reset line inherited from Stage C was normalized to one copy. Evolution still clears old-Species Form IDs/manual confirmations while preserving the independent Shiny flag.

## Validation

Final GitHub Actions validation:

- Run: `36188362170`
- Job: `108247203838`
- Result: **success**
- `git diff --check`: passed
- complete Windows regression suite: passed
- `Stage D Windows Shiny presentation regression OK`
- complete Android regression suite: passed
- `Stage D Android Shiny presentation regression OK`
- prior Stage A/B/C regressions: passed

Earlier Stage D attempts did not publish runtime changes. Run `36187237783` first exposed an Android inherited-source import shape difference and, after that was normalized, an old Stage C assertion that expected the exact previous section title. Both were test/patch-contract compatibility issues and were corrected before the successful final validation.

## Files of interest

- `PTU_Companion_Windows_Source/rules/pokemon-forms.mjs`
- `PTU_Companion_Android_Tauri/www/rules/pokemon-forms.mjs`
- `PTU_Companion_Windows_Source/static-preview/app.js`
- `PTU_Companion_Android_Tauri/www/app.js`
- `PTU_Companion_Windows_Source/server.mjs`
- `PTU_Companion_Android_Tauri/www/mobile-api.mjs`
- `PTU_Companion_Windows_Source/scripts/verify_stage_d_shiny.mjs`
- `PTU_Companion_Android_Tauri/scripts/verify-stage-d-shiny.mjs`
- `.github/workflows/stage-d-shiny.yml`

## Exact stop point

**Stage D — Shiny — is complete and validated.**

The follow-up requested by the owner — inventorying the supplied PTU knowledge sources and adding all source-parameterized Mega Evolutions, Shiny artwork metadata where actually available, and alternate Forms to bundled/default content — has **not** been mixed into this Stage D checkpoint. It should be implemented as a separate data/content layer stacked on this branch so runtime Shiny/Form behavior and source-derived catalog changes remain independently reviewable.
