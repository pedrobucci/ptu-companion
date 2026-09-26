# Handoff — PTU Forms embedded/permanent builders 3

## Branch / PR

- Repository: `pedrobucci/ptu-companion`
- Working branch: `content/ptu-parametrized-forms-catalog`
- Draft PR: `#11` (`docs: audit PTU Mega, Primal and alternate Forms`)
- Base: `feature/pokemon-shiny-d`
- Validated generated-artifact checkpoint: `fe9c7ccc5f58e920486c162c34ca7c1b107232a7`
- Validation workflow: GitHub Actions run `36277594814`, job `108503220714` — **success**
- Do not merge or release without explicit owner approval.

## What this pass added

This pass closed the source-resolved permanent/embedded Form gap for Wormadam, Pumpkaboo and Gourgeist while keeping the ten ambiguous switching families deferred and leaving default `.ptucp` packs untouched.

### Discovery/classification augmentation

The supplied Gen 8ish PokéDex explicitly contains four Base Stat columns for Pumpkaboo (p.437) and Gourgeist (p.438): Small, Average, Large and Super. Those rows were not being preserved as candidates because the imported pack `raw_text` does not reliably retain the table marker used by the original heuristic.

`augment_ptu_embedded_permanent_families.py` now deterministically upserts those two source-explicit families after the generic classifier. It only selects the exact bundled Species IDs and source pages; it does not broaden the heuristic or infer other families.

Final audited classification is now:

- **106 candidate records**
- **69 candidate families**
- **36 permanent/base**
- 2 persistent-form
- 5 transformation
- 6 runtime-state
- 5 mixed base+transformation
- 10 deferred/source-insufficient
- 5 false positives

The deferred set remains exactly: `deoxys`, `giratina`, `hoopa`, `kyurem`, `landorus`, `oricorio`, `rotom`, `shaymin`, `thundurus`, `tornadus`.

### Wormadam — full source-record cloak Forms

Wormadam was previously emitted by the generic record builder with only Type/Base Stats. That was mechanically incomplete because the supplied Plant/Sandy/Trash Species rows also differ in Ability slots, Capabilities, Skills and Move lists.

`augment_ptu_embedded_permanent_stage_b.py` now replaces the generic Wormadam output with three `mode: permanent` Forms built from the complete supported structured fields of each source record:

- Plant Cloak — Bug/Grass; High Ability `Grass Pelt`
- Sandy Cloak — Bug/Ground; High Ability `Sand Veil`
- Trash Cloak — Bug/Steel; High Ability `Clear Body`

The builder copies Type, Base Stats, Ability slots, Capabilities, Skills, level-up Moves, TM Moves, Tutor Moves and Egg Moves whenever those structured fields exist in the source row. Quick Cloak in PTU Core remains the source for the rule that Burmy's cloak Typing becomes permanent when it evolves into Wormadam.

### Pumpkaboo / Gourgeist — size Forms

Both families now have four permanent Stage B Forms:

- Small
- Average
- Large
- Super

Only the explicit source Base Stat matrices are emitted as overrides. The source pages provide aggregate height/weight ranges, not exact measurements for each of the four labels. Therefore the generator explicitly records `size_measurement_status: aggregate_range_only` and does **not** fabricate per-size height, weight, Weight Class or size-category values.

Pumpkaboo p.437 Base Stats:

- Small: HP 4 / Atk 7 / Def 7 / SpA 4 / SpD 6 / Spe 6
- Average: 5 / 7 / 7 / 4 / 6 / 5
- Large: 5 / 7 / 7 / 4 / 6 / 5
- Super: 6 / 7 / 7 / 4 / 6 / 4

Gourgeist p.438 Base Stats:

- Small: HP 6 / Atk 9 / Def 12 / SpA 6 / SpD 8 / Spe 10
- Average: 7 / 9 / 12 / 6 / 8 / 8
- Large: 8 / 10 / 12 / 6 / 8 / 7
- Super: 9 / 10 / 12 / 6 / 8 / 5

## Current Stage B generated catalog

The final generated catalog is schema version `4` and contains:

- **43** candidate-family entries
- **32** generic record-backed family entries
- **11** rule-defined/source-specific family entries
- **67** candidate/derived Stage B Forms
- **37** generic record-backed Forms
- **30** rule-defined/source-specific Forms
- **26** families intentionally not directly materialized
- **52** synthetic transformations: 48 Mega + 2 Primal + 2 Ultra Burst

The 11 source-specific builders are now:

1. Aegislash — Stance Change
2. Basculin — Red/Blue embedded Ability variant
3. Burmy — Quick Cloak
4. Eiscue — Ice Face
5. Furfrou — Fabulous Trim
6. Gourgeist — embedded size Base Stats
7. Meloetta — Relic Song
8. Minior — Shields Down
9. Pumpkaboo — embedded size Base Stats
10. Wishiwashi — Schooling
11. Wormadam — full source-record cloak Forms

Mega Evolution, Primal Reversion and Ultra Burst remain `mode: transformation`; Charizard X/Y and Mewtwo X/Y remain separate and regression-locked.

## CI / safety

GitHub Actions run `36277594814` passed all steps, including:

- 106 records / 69 families / 36 permanent families;
- exact deferred and false-positive sets;
- Pumpkaboo/Gourgeist source-signal classification;
- exact four-size Base Stat matrices;
- explicit assertion that size Forms contain no invented per-size measurement overrides;
- Wormadam Type/Base Stats/High Ability and full structured mechanic coverage;
- previous Aegislash/Burmy/Furfrou/Basculin/Wishiwashi/Minior/Eiscue/Meloetta regressions;
- 48 Mega Forms / 46 Species with separate Charizard X/Y and Mewtwo X/Y;
- 2 Primals + 2 Ultra Burst source transforms;
- no invented artwork URLs;
- no `.ptucp` working-tree mutation;
- `git diff --check`.

The Action generated and committed final docs/JSON at `fe9c7ccc5f58e920486c162c34ca7c1b107232a7` (`docs(content): refresh PTU forms catalog [skip ci]`).

## Pipeline note

The generic discovery/classification scripts intentionally stay broad/conservative. Pumpkaboo and Gourgeist are added by a narrow deterministic source-explicit augmentation step because their embedded size matrices are present in the supplied PokéDex pages but are not reliably represented in the imported pack row's generic discovery signals. This keeps the exceptional evidence visible and prevents broad heuristic matching from creating new false positives.

## Next pass

Keep the ambiguity/default-pack gate closed. The next implementation step is the five `mixed` families that require deliberate `baseFormId + activeFormId` composition:

- Darmanitan
- Necrozma
- Zacian
- Zamazenta
- Zygarde

Treat them individually. Do not bulk-convert them merely because source records exist. Preserve source event/action requirements in metadata where Stage B cannot encode them exactly, and avoid duplicating Ultra Burst semantics when moving Necrozma into a composed base+active representation.
