# PTU Combat Quick Curl + Defense Curl

This layer adds a source-explicit **Ability that overrides a Move action cost** while reusing the same per-Pokémon Combat action/frequency ledger.

## Source precedence and rules

PTU Core p.327 provides the base Quick Curl definition, but the later February 2016 Playtest Packet p.6 wins: `Scene – Free Action`; Connection – Defense Curl; use Defense Curl as a **Standard Action Interrupt** and gain **+10 Damage Reduction for one full round**. PTU Core p.394 still supplies Defense Curl's `At-Will`, AC None, Status, Self Move definition and Curled Up effect. Only the cost/effect specifically changed by Quick Curl is overridden.

## Shared resource behavior

The assisted path spends two source-keyed resources: `ability:combat-quick-curl` for Quick Curl's Scene/Free cost and `move:defense-curl-quick-curl` for the Standard Action Interrupt. The ordinary Defense Curl path is unchanged and keeps its normal Move cost. The +10 DR reminder is tracked for the current round.

The interrupt uses the same Standard token as all other actions and is blocked if that token is unavailable.

## Curled Up and correction

A successful activation uses the existing Defense Curl condition behavior: Curled Up, Critical immunity, DR 10, Slowed/Accuracy interactions, and Rollout/Ice Ball exceptions. The additional Quick Curl +10 DR is recorded separately. Resource transactions are linked by a composite identifier but remain independently correctable. Undo is resource-only and never clears an already-applied effect.

## Source signature guard

The resolver first selects the precedence winner, then checks its February 2016 signature. Defense Curl must remain At-Will/Self and match the audited Curled Up effect signature. No opponent state, random roll, or generic prose interpreter is introduced.
