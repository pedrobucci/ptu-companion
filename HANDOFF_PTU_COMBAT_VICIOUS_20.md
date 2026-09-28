# Handoff — PTU Combat Vicious + Hone Claws 20

This handoff supersedes `HANDOFF_PTU_COMBAT_QUICK_CURL_19.md` for continuation.

Repository: `pedrobucci/ptu-companion`; branch `content/ptu-parametrized-forms-catalog`; Draft PR #11; base `feature/pokemon-shiny-d`. Keep the PR **Draft/Open**. Do not merge or publish a Release without explicit owner approval. Do not mutate bundled/default `.ptucp` while the ten source-insufficient Form families remain deferred.

Validated full-campaign implementation checkpoint: `d6e4abf6ee3d65e7107ac374f7392f1d8b06b374`.

Generated Vicious runtime/docs checkpoint: `9e191888ba59b7445409d4f45d032667980f65bb`.

This handoff file is committed after runtime validation and does not alter runtime behavior.

## Vicious triggered connection model v1

This pass adds the first source-explicit **Move-triggered Ability that grants an extra Standard Action** while continuing to use the same per-Pokémon Combat ledger.

New deterministic patch:

- `PTU_Companion_Windows_Source/scripts/apply_stage_b_combat_vicious.py`

New verifier:

- `PTU_Companion_Windows_Source/scripts/verify_stage_b_combat_vicious.mjs`

New docs:

- `docs/PTU_COMBAT_VICIOUS.md`
- `docs/data/PTU_COMBAT_VICIOUS.json` — schema 1

Dedicated workflow:

- `.github/workflows/stage-b-combat-vicious.yml`

The master deterministic Combat rebuild (`apply_stage_b_combat_session_fixups.py`) now applies Vicious after Quick Curl, so later full Combat/campaign rebuilds retain the integration.

## Supplied-source rules

### Vicious — PTU Core p.335

- Frequency/action: **Scene – Special**.
- Trigger: the user uses **Hone Claws**.
- On activation, choose one:
  1. gain **another Standard Action this round**; or
  2. increase **Critical Hit Range on all attacks by +2** for the remainder of the encounter.

### Hone Claws — PTU Core p.351

- Frequency: **At-Will**.
- AC: None.
- Class: Status.
- Range: Self.
- User gains +1 Accuracy and +1 Attack Combat Stage.

The ordinary Hone Claws Move path remains unchanged.

## Trigger window

A source-matched Hone Claws use records a Vicious trigger for the current Pokémon, round, Scene and Day. The trigger is cleared when:

- another Move is used;
- the round changes;
- the Scene changes; or
- the Day changes.

The Vicious UI is exposed only when both the active Vicious definition and Hone Claws definition match conservative audited source signatures.

## Extra Standard Action model

The shared turn ledger now represents bonus Standard Actions explicitly:

- `turn.bonus.standard`
- `turn.bonusUsed.standard`

The common action API gained:

- `pokemonCombatStandardRemaining()`
- `pokemonCombatSpendStandardToken()`

Therefore the Vicious-granted Standard Action can be spent by the same systems that spend normal Combat actions. It may be used directly as a Standard Action or converted under the normal PTU conversion rule into an additional Swift or Shift Action.

The UI action strip now displays the remaining Standard Action count rather than assuming a single boolean Standard resource.

### Full Action conservative gate

In v1, a Vicious bonus Standard Action does **not** satisfy the Standard component of a Full Action. Full Action still requires the base Standard + Shift pair.

This is intentional: the supplied source explicitly grants another Standard Action, but the current app does not yet have enough generic Full Action decomposition semantics to safely infer every interaction with extra Standard tokens.

## Critical Hit Range choice

Choosing the second Vicious effect records:

- `conditions.viciousCriticalRangeBonus = 2`

The marker remains until that Pokémon leaves the current Combat session. The application does not generate attack dice or decide that an attack was a Critical Hit; the existing physical/manual roll and user-confirmed outcome model remains authoritative.

The automated path will not stack the Vicious +2 effect repeatedly.

## Frequency / double-spend policy

Vicious spends its own source-keyed `Scene` resource through the shared non-Move resource ledger. `Special` is preserved as source metadata and is not silently converted into Standard/Swift/Shift spending.

The implementation separately records `viciousActivation` for the Scene so a resource-only correction cannot be abused as a second Vicious activation after the selected effect has already been applied.

## Resource correction / Undo

Resource Undo remains deliberately **resource-only**:

- it can restore the Vicious Scene expenditure;
- it can correct action/frequency transaction bookkeeping;
- it does not remove an already granted bonus Standard Action;
- it does not remove an already-applied Critical Hit Range +2 effect.

The applied-effect marker remains after resource correction to prevent duplicate activation in the same Scene.

## Existing transaction system extension

Because bonus Standard Actions participate in shared spending, action transaction snapshots/deltas now include bonus Standard usage. A transaction that spends a Vicious bonus Standard through Standard→Swift or Standard→Shift can refund that specific resource use without incorrectly resetting an unrelated base action.

Existing non-Move, Ability, Sprint and Quick Curl verifiers were updated to load the new shared Standard helpers. No parallel Vicious-only action economy was introduced.

## Supplied-source conflicts discovered during candidate selection

### Electrodash — not automated

Electrodash was investigated first and deliberately rejected because the supplied sources conflict:

- PTU Core: `Scene – Free Action`; Sprint may be used as a Swift Action.
- February 2016 playtest: `Scene x2 – Swift Action`; Sprint becomes a Free Action and the Ability gains additional behavior.

No version was silently selected.

### Quick Curl — source conflict now documented

The February 2016 playtest also contains a Quick Curl variant that differs materially from the Core version used by the existing Quick Curl integration. The existing implementation remains safe because it requires the active Ruleset Quick Curl and Defense Curl definitions to pass the Core-oriented source-signature guards before exposing automation. If the active definition differs, the assisted path disables itself rather than applying the wrong rule.

## Physical dice / opponent model

This pass introduces no digital RNG and no persistent opponent entity. Vicious and Hone Claws operate only on the controlled Pokémon and the shared Combat resource/state ledger.

Critical results remain manually confirmed. No arbitrary Move/Ability prose interpreter was introduced.

## Validation

Dedicated Vicious workflow after compatibility corrections:

- run `36469591882`, job `109088191214` — **success**.

This covered:

- shared Combat ledger;
- shared non-Move resources;
- Quick Curl regression;
- Vicious source guards;
- bonus Standard spend;
- bonus Standard → Swift;
- action delta/refund support;
- trigger expiry;
- no double activation;
- Critical Hit Range +2 persistence/no stacking;
- Windows/Android parity;
- full Windows `npm run verify`;
- full Android `npm run verify`;
- no `.ptucp` mutation;
- `git diff --check`.

The earlier Sprint regression run `36469978364` failed only because it executed a pre-fix Ability verifier that did not load the new shared Standard helpers. On the corrected verifier checkpoint, the dedicated workflows passed:

- Sprint: run `36470046651` — **success**;
- Ability Actions: run `36470046675` — **success**;
- Non-Move Resources: run `36470046635` — **success**.

Final full campaign rebuild with the Vicious verifier explicitly included:

- run `36470208358`, job `109090263137` — **success**.

That full rebuild passed the complete Form/campaign stack, shared Combat ledger, source-explicit Move outcomes, Quick Curl, Vicious, Windows and Android regression suites, invariant checks, no `.ptucp` mutation, and `git diff --check`.

## Conservative boundaries retained

- No opponent entity or persistent enemy state.
- No generated attack, damage, Ability, or Move-effect dice.
- No generic Move/Ability prose interpreter.
- No automatic Critical result determination.
- Bonus Standard does not satisfy Full Action in v1.
- Resource Undo does not rewind already-applied Vicious effects.
- Electrodash remains unautomated because supplied definitions conflict.
- The existing Quick Curl path stays source-signature-gated because a conflicting playtest definition exists.
- Prime Fury, Hydration, Ice Body, and Regal Challenge remain manual where supplied source versions conflict.
- The ten deferred Form families remain blocked: Deoxys, Giratina, Hoopa, Kyurem, Landorus, Oricorio, Rotom, Shaymin, Thundurus, Tornadus.
- No default `.ptucp` mutation.
- No merge or Release.

## Recommended next pass

The Combat ledger now supports normal Standard/Shift/Swift resources, action-cost overrides, composite Maneuver/Ability spending, and a real extra Standard Action granted by a triggered Ability. The next useful pass should remain source-explicit and controlled-Pokémon-only. Prefer either:

1. another trigger that consumes or grants an already-modeled controlled-Pokémon resource/state; or
2. a small **Combat session ergonomics pass** that exposes these established action/frequency/condition resources more clearly in the UI before adding further mechanics.

Continue to reject any connection whose supplied sources conflict or whose exact effect would require persistent opponent state, battlefield geometry, or inferred prose semantics.
