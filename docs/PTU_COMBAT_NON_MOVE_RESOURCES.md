# PTU Combat Non-Move Resource Ledger

Abilities, Form actions and source-explicit Capabilities now use the same Pokémon Combat action/frequency ledger as Moves when the supplied PTU rule gives an unambiguous cost. No second action economy is introduced.

## Source-explicit integrations

- **Schooling** — `Daily – Free Action` (SuMo References p.4). A successful activation consumes that Pokémon's Daily Schooling use in the Combat ledger.
- **Power Construct** — `Daily – Swift Action` (SuMo References p.3). It consumes the Swift Action (or the existing Standard→Swift conversion when needed) plus its own namespaced Daily use.
- **Aegislash Stance Change manual toggle** — `Full Action` (PTU Core p.331). Automatic Move-driven stance changes remain automatic and consume no additional resource.
- **Ice Face Hail restoration** — `Standard Action in Hail` (New Abilities and Moves p.1). The action is consumed only when the source lifecycle event is actually applied.
- **Weapon Bond** entry/relinquish — `Extended Action` (New Abilities and Moves p.1). Extended Actions are shown faithfully but are not converted into Combat turn actions.

## Atomic source-event spending

The UI first checks availability, reserves the exact action/frequency tokens, applies the Form lifecycle event, and automatically refunds the reservation if the event is invalid or produces no source lifecycle change. This prevents a failed activation from consuming Daily/Scene resources.

Frequency keys are namespaced by source kind plus source key, so an Ability and a Move with the same visible name cannot consume each other's counters.

## Correction / refund

Recent Ability/Form resource transactions are shown on the active Combatant. `Undo` reverses only the action flags and frequency counter created by that transaction. It never rewinds HP, Form state, Move outcomes, or other later game state. If a Round/Scene/Day boundary has already reset a resource, Undo does not resurrect the old boundary.

## Conservative boundary

Only the source-explicit rules above are wired. Ambiguous activation semantics, conflicting source rules, manual/GM gates and Extended Action timing remain explicit rather than inferred. Combat still generates no dice.
