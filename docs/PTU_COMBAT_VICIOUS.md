# PTU Combat Vicious + Hone Claws

This layer adds a source-explicit **triggered Ability + Move connection** while extending the shared Pokémon Combat action ledger to represent a real extra Standard Action.

## Source rules

PTU Core p.335 defines **Vicious** as `Scene – Special`, triggered when the user uses **Hone Claws**. On activation, choose one effect: gain another Standard Action this round, or increase Critical Hit Range on all attacks by +2 for the remainder of the encounter.

PTU Core p.351 defines **Hone Claws** as `At-Will`, AC None, Status, Self; it raises Accuracy by +1 and Attack by +1 Combat Stage. The ordinary Hone Claws Move path is unchanged.

## Shared action ledger

The extra-Standard choice adds one Standard Action token to the current turn. The same action API used by Moves, Maneuvers, Abilities and Forms consumes that token. Under the normal PTU action-conversion rule it may be exchanged for another Swift or Shift Action. The conservative v1 model does **not** let a bonus Standard satisfy a Full Action; Full Actions continue to require the base Standard + Shift pair.

## Trigger and frequency

The Vicious panel is exposed only when both Vicious and Hone Claws match audited source signatures. Using Hone Claws opens the trigger for the current round. Another Move or a round/Scene/Day boundary closes it. Vicious spends its own Scene resource through the shared non-Move ledger.

Resource-only Undo restores only ledger spending. It does not remove a granted extra Standard Action or an already-applied critical-range effect. To prevent correction from becoming a duplicate activation, the applied Vicious effect is separately marked as used for that Scene.

## Critical-range choice

The +2 Critical Hit Range is recorded on the controlled Pokémon until it leaves the current Combat session. Combat still uses physical dice and user-confirmed Hit/Miss/Critical outcomes; this layer does not generate dice or infer a Critical result. The +2 choice is not stacked repeatedly by automation.

## Source audit note

**Electrodash was rejected for this pass** because the supplied Core and February 2016 playtest definitions conflict: the Core version is `Scene – Free Action` and makes Sprint a Swift Action, while the playtest changes both frequency/action and makes Sprint a Free Action with additional bonuses.

The same audit also surfaced a February 2016 Quick Curl variant that conflicts with the Core Quick Curl used by the existing integration. That integration is already active-Ruleset source-signature-gated, so the automated Core path is disabled whenever the active Quick Curl definition differs.

## Conservative gates

No opponent state, generated dice, generic prose parser, automatic Critical determination, or default `.ptucp` mutation is introduced.
