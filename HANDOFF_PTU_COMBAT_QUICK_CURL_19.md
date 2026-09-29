# Handoff — PTU Combat Quick Curl + Defense Curl 19

This handoff supersedes `HANDOFF_PTU_COMBAT_SPRINT_MANEUVER_18.md` for continuation.

Repository: `pedrobucci/ptu-companion`; branch `content/ptu-parametrized-forms-catalog`; Draft PR #11; base `feature/pokemon-shiny-d`. Keep the PR **Draft/Open**. Do not merge or publish a Release without explicit owner approval. Do not mutate bundled/default `.ptucp` while the ten source-insufficient Form families remain deferred.

Validated implementation checkpoint before this handoff: `f81e042aa051fb2c725f5bf36137778c973990c6`.

Generated Quick Curl runtime/docs checkpoint: `957726d08e72a6cba1548c755a867838e5097a87`.

## Quick Curl composite model v1

Quick Curl is the first source-explicit **Ability that overrides a Move's normal action cost** while keeping the ordinary Move path intact and reusing the same per-Pokémon Combat ledger.

New deterministic patch:

- `PTU_Companion_Windows_Source/scripts/apply_stage_b_combat_quick_curl.py`

New verifier:

- `PTU_Companion_Windows_Source/scripts/verify_stage_b_combat_quick_curl.mjs`

New docs:

- `docs/PTU_COMBAT_QUICK_CURL.md`
- `docs/data/PTU_COMBAT_QUICK_CURL.json` — schema 1

Dedicated workflow:

- `.github/workflows/stage-b-combat-quick-curl.yml`

The master deterministic Combat rebuild (`apply_stage_b_combat_session_fixups.py`) now applies Quick Curl after Sprint, so all later full Combat/campaign rebuilds retain the integration.

## Supplied-source rules

### Quick Curl — PTU Core p.327

- Frequency/action: **Scene – Free Action**
- Connection: Defense Curl
- Effect: activating Quick Curl allows the user to use **Defense Curl as a Swift Action**.

### Defense Curl — PTU Core p.394

- Frequency: **At-Will**
- AC: None
- Class: Status
- Range: Self
- User becomes **Curled Up**.
- Curled Up grants Critical Hit immunity and 10 Damage Reduction.
- Curled Up normally Slows the user and lowers Accuracy by 4.
- The user may stop being Curled Up as a Swift Action.
- Rollout/Ice Ball retain their already-modeled Curled Up exceptions.

## Runtime behavior

The Combat screen exposes a separate **QUICK CURL · DEFENSE CURL** section only when:

1. the active Pokémon actually knows Quick Curl;
2. Defense Curl is present in its active Move list;
3. the active Ruleset Quick Curl definition matches the audited source signature;
4. the active Defense Curl definition remains compatible with the audited source signature.

The assisted path spends:

- `ability:combat-quick-curl` — `Scene – Free Action`;
- `move:defense-curl-quick-curl` — Defense Curl as `Swift Action` / `At-Will`.

These are separate namespaced resource transactions linked by a shared `compositeId` with roles `ability` and `move`.

## Action economy

Unlike Sprint + Sprint Ability, this composite may legitimately use the existing **Standard → Swift** conversion because Defense Curl is being changed to a Swift Action and no other part of the Quick Curl composite consumes the Standard Action.

Therefore:

- if Swift is free, the assisted Defense Curl spends Swift only;
- if Swift is already spent but Standard is free, the shared ledger may spend `Standard → Swift`;
- if both Swift and Standard are unavailable, the composite is blocked before Quick Curl's Scene frequency is consumed.

The ordinary Defense Curl Move remains unchanged and still uses its normal Move action path/cost. Quick Curl never replaces or hides that path.

## Curled Up / Move interactions

Successful Quick Curl + Defense Curl reuses the existing Curled Up state rather than creating a second condition implementation.

It also preserves existing chained-Move safeguards:

- active Rollout locks out Quick Curl + Defense Curl until Rollout misses or has no valid target;
- using the composite resets an active Fury Cutter chain as a different Move;
- the existing Defense Curl → Rollout/Ice Ball Curled Up modifiers remain unchanged.

The composite dispatches the same Defense Curl Move/Form lifecycle event used by the normal Move path.

## Resource correction / Undo

The Ability and overridden Move-action transactions may be corrected independently with the existing resource-only Undo model.

- Undo Quick Curl restores only its Scene/Free resource transaction.
- Undo the overridden Move action restores only its Swift or Standard→Swift spend.
- **Undo never clears the already-applied Curled Up state.**

This is deliberate: resource correction does not rewind downstream game effects.

## Physical dice / target model

Quick Curl and Defense Curl need no random roll. This integration introduces no digital RNG. The project-wide physical/manual-dice invariant remains intact, and no opponent entity/state is introduced.

## Validation

Dedicated Quick Curl validation after the verifier correction:

- run `36463792114`, job `109068658921` — **success**.

Deterministic-rebuild regression runs after adding Quick Curl to the master Combat fixup all passed:

- Quick Curl: run `36463932263`, job `109069115395` — **success**;
- Sprint: run `36463932352`, job `109069114201` — **success**;
- controlled-Pokémon Move outcomes: run `36463932317`, job `109069114145` — **success**;
- non-Move resources: run `36463932320`, job `109069113971` — **success**;
- Ability actions: run `36463932300`, job `109069113853` — **success**;
- Form campaign state: run `36463932187`, job `109069113380` — **success**.

The full campaign workflow was then explicitly taught to run the Quick Curl verifier and include its docs/invariants:

- run `36464340379`, job `109070544386` — **success**.

That final full rebuild covered the complete Form/campaign stack, shared Combat ledger, Move outcomes, Quick Curl composite verifier, full Windows `npm run verify`, full Android `npm run verify`, invariant checks, no `.ptucp` mutation, and `git diff --check`.

## Conservative boundaries retained

- No opponent entity or persistent enemy state.
- No generated attack, damage, Ability, or Move-effect dice.
- No generic Move/Ability prose interpreter.
- Ordinary Defense Curl remains available through its normal Move path.
- Resource Undo does not rewind Curled Up or later game effects.
- Prime Fury, Hydration, Ice Body, and Regal Challenge remain manual because supplied source versions conflict.
- The ten deferred Form families remain blocked: Deoxys, Giratina, Hoopa, Kyurem, Landorus, Oricorio, Rotom, Shaymin, Thundurus, Tornadus.
- No default `.ptucp` mutation.
- No merge or Release.

## Recommended next pass

Now that the shared ledger has validated both a **Maneuver + Ability** composite (Sprint) and an **Ability + Move cost override** composite (Quick Curl), the next useful step is to extend the Combat surface with another explicit connection only after checking its exact supplied-source mechanics. Prefer a rule that reuses controlled-Pokémon state and the existing ledger without requiring persistent opponent entities or battlefield geometry. Keep the same policy: explicit allowlist/source signature, physical dice only, atomic resource spending, ordinary Move path preserved, and deterministic Windows/Android parity.
