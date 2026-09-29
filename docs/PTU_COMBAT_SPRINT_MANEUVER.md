# PTU Combat Sprint Maneuver + Ability

This layer models Sprint as the first **composite Combat Maneuver + Ability** while reusing the shared per-Pokémon action/frequency ledger.

## Sprint Maneuver

PTU Core p.242 defines Sprint as a **Standard Action**, Status, Self Maneuver. It increases the user's Movement Speeds by 50% for the rest of the turn. The Companion spends the Standard Action and logs this transient effect; it does not invent a persistent Movement Capability mutation.

## Sprint Ability

PTU Core p.331 defines Sprint as **Scene – Swift Action**, triggered when the user uses the Sprint Action during Combat. Activating it gives the controlled Pokémon **+2 Speed Combat Stages**. The source also says Overland Speed is always increased by +2; that passive is retained as source information here rather than introducing a new capability mutation in the Combat layer.

## Composite action economy

Activating Sprint Ability together with the Sprint Maneuver requires **both** resources: the Maneuver's Standard Action and an independently available Swift Action, plus the Ability's Scene use. The existing Standard → Swift conversion is intentionally unavailable for this composite activation because that same Standard Action is already required by the Sprint Maneuver. This prevents undercounting the action economy.

The plain Sprint Maneuver remains usable when its Standard Action is available even if the Sprint Ability has already been used this Scene or the Swift Action is unavailable. Scene reset restores the Ability frequency normally.

## Resource transactions / correction

The Maneuver and Ability use separate namespaced resource transactions (`maneuver:sprint` versus `ability:combat-sprint`) and are linked by a composite identifier when activated together. Existing resource Undo can correct either spend independently. As with the other non-Move correction controls, Undo restores resources only; it does not rewind the already-applied +2 Speed Combat Stages.

## Conservative boundary

No target entity is needed, no random roll is generated, and no generic Ability-effect parser is introduced. Automation is enabled only when the active Sprint Ability matches the audited source signature.
