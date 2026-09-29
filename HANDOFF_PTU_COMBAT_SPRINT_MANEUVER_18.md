# Handoff — PTU Combat Sprint Maneuver + Ability 18

This handoff supersedes `HANDOFF_PTU_COMBAT_ABILITY_ACTIONS_17.md` for continuation.

Repository: `pedrobucci/ptu-companion`; branch `content/ptu-parametrized-forms-catalog`; Draft PR #11; base `feature/pokemon-shiny-d`. Keep the PR **Draft/Open**. Do not merge or publish a Release without explicit owner approval. Do not mutate bundled/default `.ptucp` while the ten source-insufficient Form families remain deferred.

Generated runtime/docs checkpoint: `d8016ef5f6ff32eb1308f54e564229d7da514176`.

## Sprint composite model v1

Sprint is the first source-explicit **Combat Maneuver + Ability** integration using the existing shared per-Pokémon action/frequency ledger.

New deterministic patch: `PTU_Companion_Windows_Source/scripts/apply_stage_b_combat_sprint_maneuver.py`.
New verifier: `PTU_Companion_Windows_Source/scripts/verify_stage_b_combat_sprint_maneuver.mjs`.
New docs: `docs/PTU_COMBAT_SPRINT_MANEUVER.md` and `docs/data/PTU_COMBAT_SPRINT_MANEUVER.json` (schema 1).
Dedicated workflow: `.github/workflows/stage-b-combat-sprint-maneuver.yml`.

The deterministic Combat rebuild (`apply_stage_b_combat_session_fixups.py`) now runs the Sprint layer after the general Ability/non-Move/session-doc layers.

## Source rules

### Sprint Maneuver — PTU Core p.242

- Action: **Standard**
- Class: Status
- Range: Self
- Effect: increase Movement Speeds by 50% for the rest of the turn.

Runtime spends the Pokémon's Standard Action and logs the +50% Movement effect for the current turn. It does not invent a persistent Movement Capability mutation.

### Sprint Ability — PTU Core p.331

- **Scene – Swift Action**
- Trigger: user uses the Sprint Action during Combat
- Triggered effect: **+2 Speed Combat Stages**
- Passive source text: Overland Speed always +2.

If the active Pokémon has the audited Sprint Ability, the Combat Maneuver panel exposes an explicit `Sprint + Ability` option. It spends the Maneuver's Standard Action plus the Ability's independent Scene use and Swift Action, then applies +2 Speed CS with normal [-6,+6] bounds. Passive Overland +2 remains source information in this layer.

## Composite action economy

The normal ledger may convert a Standard Action into Swift when Swift is already spent. That conversion is **not allowed** for the Sprint composite, because Sprint Maneuver itself already uses the Standard Action. Combined activation therefore requires an available Standard Action, an independently available Swift Action, and an unused Sprint Ability Scene frequency.

Plain Sprint remains available when Standard is free even if Sprint Ability is exhausted, Swift is spent, or the Ruleset Sprint signature differs from the audited source.

## Resource transactions / Undo

Composite activation creates separate namespaced transactions: `maneuver:sprint` for Standard Action and `ability:combat-sprint` for Swift + Scene. They share a `compositeId` and have distinct `compositeRole` values. Resource Undo corrects each transaction independently and remains resource-only; it does not rewind +2 Speed CS.

## UI

Combat now has a **MANEUVERS** section before AVAILABLE ABILITIES. `Use Sprint · Standard Action` is enabled when Standard is available. A source-matching Sprint Ability adds `Sprint + Ability · Standard + Swift · Scene`.

## Validation

Dedicated Sprint workflow: run `36455658955`, job `109041223490`, **success**.

Validated: deterministic Combat rebuild; shared ledger/non-Move/Ability layers; source signature guard; Standard-only Sprint; combined Standard + independent Swift + Scene; blocked Standard→Swift double-use; Maneuver-only after Ability exhaustion; Scene reset; separate composite transactions; independent refund; +2 Speed CS cap; Windows/Android parity; full Windows/Android `npm run verify`; no generated dice; no `.ptucp` mutation; `git diff --check`.

## Conservative boundaries retained

No opponent entity, no generated dice, no generic prose interpreter, no new passive Overland persistence, and no effect rewind on resource Undo. Prime Fury, Hydration, Ice Body and Regal Challenge remain manual because supplied versions conflict. The ten deferred Form families remain blocked: Deoxys, Giratina, Hoopa, Kyurem, Landorus, Oricorio, Rotom, Shaymin, Thundurus, Tornadus. No merge or Release.

## Recommended next pass

Use **Quick Curl + Defense Curl** as the next source-explicit composite Ability/Move integration. PTU Core gives Quick Curl `Scene – Free Action` and allows Defense Curl to be used as a Swift Action. Defense Curl is already modeled, making this a good test of overriding a Move's action cost without double-spending its normal Standard Action.

Verify the source signature; expose the assisted path only to Pokémon with Quick Curl; spend Quick Curl Scene/Free plus Defense Curl as Swift; keep ordinary Defense Curl unchanged; test Swift/Standard→Swift rules, no double-spend, Scene reset, independent correction, and Windows/Android parity; preserve physical/manual dice and abstract opponents.
