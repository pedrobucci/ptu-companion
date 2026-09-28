# PTU Combat Quick Curl + Defense Curl

This layer adds the first source-explicit **Ability that overrides a Move action cost** while reusing the same per-Pokémon Combat action/frequency ledger.

## Source rules

PTU Core p.327 defines **Quick Curl** as `Scene – Free Action`: Connection – Defense Curl; activating it lets the user use Defense Curl as a **Swift Action**. PTU Core p.394 defines **Defense Curl** as `At-Will`, AC None, Status, Self, creating the persistent **Curled Up** state already modeled by the Combat ledger.

## Composite resource behavior

The assisted path spends two source-keyed resources: `ability:combat-quick-curl` for the Ability's Scene/Free cost and `move:defense-curl-quick-curl` for Defense Curl's overridden Swift Action. The ordinary Defense Curl path is unchanged and still uses the normal Move action cost.

If Swift is already spent but Standard is still available, the existing shared ledger may perform `Standard → Swift`. If both Swift and Standard are unavailable, Quick Curl + Defense Curl is blocked before the Scene use is spent.

## Curled Up and correction

A successful composite activation uses the existing Defense Curl condition behavior: Curled Up, Critical immunity, DR 10, Slowed/Accuracy interactions, and the existing Rollout/Ice Ball exceptions. Resource transactions are linked by a composite identifier but remain independently correctable. Undo is deliberately resource-only and never clears an already-applied Curled Up state.

## Conservative gates

Automation appears only when both active Ruleset definitions match conservative audited source signatures. No opponent state or random roll is introduced, and no generic prose interpreter is used.
