# PTU Companion — Changelog v1.5

## Fixes

- Creature reference tabs now force a fresh resolved-creature fetch when opened, preventing stale Ability/Modifier data after progression, Poké Edge changes, and other permanent edits.
- The resolved Ability model now also recovers native Ability choices from `abilityRecords` when older saves have an incomplete `details.abilities` array.
- `Defiant` (Level 20 choice) and `Twisted Power` (granted by Mixed Power) resolve without requiring a Held Item change to refresh the sheet.

## Poké Edge target selection

Three Core Poké Edges now expose rules-valid structured target lists instead of free-text prompts:

- **Advanced Mobility** — select one currently available Movement Capability; the same Movement Capability cannot be selected twice.
- **Capability Training** — select `Power`, `High Jump`, or `Long Jump`; each may only be selected once for this Poké Edge.
- **Accuracy Training** — select one currently known Move with base AC 3 or higher; each Move can only be selected once.

The selected target is stored as `targetId`, `targetKind`, and `targetNote` in the permanent Poké Edge record.

## Applied effects

- Advanced Mobility now adds +2 to the selected resolved Movement Capability.
- Capability Training now adds +1 to the selected Power / High Jump / Long Jump value.
- Accuracy Training now reduces the selected Move's displayed/effective AC by 1 while preserving the source Move definition.
- The Species tab shows capability modifiers applied by Poké Edges.
- The Moves tab labels Accuracy Training and shows base/effective AC.

## Correction refund

Owned Poké Edges now have a **Refund** action for sheet-correction mistakes.

Refunding:

- removes the selected Poké Edge instance;
- returns the Tutor Points recorded as spent on that instance;
- removes its resolved effects;
- recalculates Base Relation exemptions;
- removes Twisted Power when refunding Mixed Power, if Mixed Power is no longer owned;
- records the correction in Trainer history.

This UI refund is intentionally a correction/respec convenience. In PTU rules, **Corrective Learning** is the explicit Mentor feature that can remove an effect gained from a Poké Edge/Feature and refund the Tutor Points spent on it.
