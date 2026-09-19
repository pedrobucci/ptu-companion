# PTU Companion — Changelog v1.3

## Resolved Ability model

- Creature Abilities are now resolved from native Species slots, Level 20/40 progression choices, and granted Abilities.
- Mixed Power synthesizes Twisted Power during resolution even for older saves that have the Poké Edge but predate `grantedAbilities`.
- Ability cards show provenance: Starting Ability, Level 20/40 Choice, or granted source.
- The Abilities tab detects unlocked native slots with no recorded choice.

## Ability-slot correction

- Added **Edit Native Ability Slots** to the Abilities tab.
- The correction flow is validated against the current Species, level, and active Ruleset.
- GM Override may accept non-standard native choices.
- Corrections preserve granted Abilities and create an audit entry in `abilityCorrectionHistory`.

## Resolved Creature model / Modifier Engine v2

- `/api/pokemon/reference-data` now returns a `resolvedCreature` object.
- The resolved model centralizes native/granted Abilities, stored/effective Stats, Move Limit, modifier summary, Capabilities, Held Item, and Base Relations exemptions.
- Modifier summary now exposes active effects and Move Limit resolution alongside Twisted Power.

## Persistence provenance

- New Pokémon store structured `abilityRecords`.
- Progression stores `abilityRecords` and `abilitiesAfter` in progression history so future screens do not have to infer the source of a Level choice.
