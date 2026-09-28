# Handoff — PTU Combat Sprint Maneuver + Ability 18

This handoff supersedes `HANDOFF_PTU_COMBAT_ABILITY_ACTIONS_17.md` for continuation.

Repository: `pedrobucci/ptu-companion`; branch `content/ptu-parametrized-forms-catalog`; Draft PR #11; base `feature/pokemon-shiny-d`. Keep the PR **Draft/Open**. Do not merge or publish a Release without explicit owner approval. Do not mutate bundled/default `.ptucp` while the ten source-insufficient Form families remain deferred.

Generated runtime/docs checkpoint: `d8016ef5f6ff32eb1308f54e564229d7da514176`.

## Sprint composite model v1

Sprint is the first source-explicit **Combat Maneuver + Ability** integration using the existing shared per-Pokémon action/frequency ledger.

New deterministic patch:

- `PTU_Companion_Windows_Source/scripts/apply_stage_b_combat_sprint_maneuver.py`

New verifier:

- `PTU_Companion_Windows_Source/scripts/verify_stage_b_combat_sprint_maneuver.mjs`

New docs:

- `docs/PTU_COMBAT_SPRINT_MANEUVER.md`
- `docs/data/PTU_COMBAT_SPRINT_MANEUVER.json` — schema 1

Dedicated workflow:

- `.github/workflows/stage-b-combat-sprint-maneuver.yml`

The deterministic Combat rebuild (`apply_stage_b_combat_session_fixups.py`) now runs the Sprint layer after the general Ability/non-Move/session-doc layers.

## Source rules

### Sprint Maneuver — PTU Core p.242

- Action: **Standard**
- Class: Status
- Range: Self
- Effect: increase Movement Speeds by 50% for the rest of the turn.

Runtime behavior:

- spends the Pokémon's Standard Action from the shared Combat ledger;
- logs the +50% Movement effect for the current turn;
- does **not** invent a persistent Movement Capability mutation because this Combat layer does not yet own a lossless movement-state model.

### Sprint Ability — PTU Core p.331

- Frequency/action: **Scene – Swift Action**
- Trigger: user uses the Sprint Action during Combat
- Triggered effect: user gains **+2 Speed Combat Stages**
- Passive source text: Overland Speed is always increased by +2.

Runtime behavior:

- if the active Pokémon has the audited Sprint Ability, the Combat Maneuver panel exposes an explicit `Sprint + Ability` option;
- activating it spends the Maneuver's Standard Action plus the Ability's independent Scene use and Swift Action;
- applies +2 Speed CS with normal [-6,+6] Combat Stage bounds;
- the passive +2 Overland Speed remains documented source information in this layer rather than creating a new capability mutation.

## Composite action-economy rule

The existing general ledger allows a spent Swift Action to be replaced by `Standard → Swift` when a Standard Action is free. That conversion is **not allowed for Sprint + Sprint Ability**, because Sprint Maneuver itself already requires the Standard Action.

Therefore the combined activation requires:

1. an available Standard Action for the Sprint Maneuver;
2. an independently available Swift Action;
3. an unused Sprint Ability Scene frequency.

This avoids counting one Standard Action twice.

Plain Sprint Maneuver remains available when Standard is free even if:

- Sprint Ability was already used this Scene;
- Swift Action is already spent;
- the active Ruleset Sprint Ability does not match the audited source signature.

## Resource transactions / Undo

Composite activation creates two separate namespaced resource transactions:

- `maneuver:sprint` — Standard Action;
- `ability:combat-sprint` — Swift Action + Scene frequency.

The pair receives a shared `compositeId` and distinct `compositeRole` values (`maneuver` / `ability`). Existing resource Undo can correct either transaction independently.

Resource Undo remains intentionally resource-only: refunding Sprint Ability restores its Swift/Scene spend, but does not rewind the already-applied +2 Speed CS. Refunding the Maneuver restores its Standard Action without altering the Ability transaction.

## UI

The Combat screen now has a **MANEUVERS** section before AVAILABLE ABILITIES.

- `Use Sprint · Standard Action` is always available when the Pokémon has a Standard Action.
- If the Pokémon knows a source-matching Sprint Ability, a second `Sprint + Ability · Standard + Swift · Scene` control is shown.
- If the Ability's active Ruleset text no longer matches the audited source signature, only the plain Maneuver remains automated.

Opponents remain abstract; Sprint needs no target or random roll.

## Shared documentation updates

`PTU_COMBAT_SESSION_LEDGER` now includes `Maneuver` as a shared non-Move source kind and records Sprint as the first composite integration.

`PTU_COMBAT_ABILITY_ACTIONS` keeps Sprint outside the standalone Ability-action allowlist but now points to the composite Sprint Maneuver layer instead of describing it as not-yet-modeled.

## Validation

Dedicated Sprint workflow:

- run: `36455658955`
- job: `109041223490`
- result: **success**

The workflow validated:

- complete deterministic Combat rebuild;
- existing shared Combat ledger;
- existing non-Move resource ledger;
- existing source-explicit Ability actions;
- Sprint source-signature guard;
- Sprint Maneuver Standard Action spending;
- combined Standard + independently available Swift + Scene spending;
- prevention of Standard → Swift reuse during the composite activation;
- Maneuver-only availability after Ability exhaustion;
- Scene reset;
- separate Maneuver/Ability transaction keys and composite linkage;
- independent resource refunds;
- +2 Speed CS and normal +6 cap;
- Windows/Android parity;
- full Windows `npm run verify`;
- full Android `npm run verify`;
- no generated dice;
- no `.ptucp` mutation;
- `git diff --check`.

## Conservative boundaries retained

- No opponent entity or target HP/status ledger.
- No generated attack, damage, or Ability-effect dice.
- No generic Move/Ability prose interpreter.
- Sprint passive Overland +2 is not newly persisted by this Combat layer.
- Resource Undo does not rewind already-applied game effects.
- Prime Fury, Hydration, Ice Body and Regal Challenge remain manual because supplied versions conflict.
- The ten deferred Form families remain blocked: Deoxys, Giratina, Hoopa, Kyurem, Landorus, Oricorio, Rotom, Shaymin, Thundurus, Tornadus.
- No default `.ptucp` mutation.
- No merge or Release.

## Recommended next pass

Use **Quick Curl + Defense Curl** as the next source-explicit composite Ability/Move integration. PTU Core gives Quick Curl `Scene – Free Action` and allows Defense Curl to be used as a Swift Action. Defense Curl is already modeled in the Combat ledger, making this a good test of safely overriding a Move's action cost without double-spending its normal Standard Action.

Recommended checks:

1. verify the active Quick Curl source signature;
2. expose a Quick Curl-assisted Defense Curl path only for Pokémon that know the Ability;
3. spend Quick Curl's Scene/Free resource and Defense Curl as Swift, not as its ordinary Standard Action;
4. keep the existing ordinary Defense Curl path unchanged;
5. test normal Swift use and Standard → Swift conversion where valid, no double-spend, Scene reset, independent resource correction, and Windows/Android parity;
6. continue preserving physical/manual dice and abstract opponents.
