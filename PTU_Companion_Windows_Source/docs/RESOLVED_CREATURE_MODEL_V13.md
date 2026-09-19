# Resolved Creature Model — v1.3

The creature sheet no longer treats `details.abilities` as the complete public view of a Pokémon. The server now resolves a creature from multiple permanent sources.

## Ability sources

1. Species starting Ability.
2. Native progression choices, currently the Level 20 and Level 40 slots.
3. Granted Abilities from Poké Edges or other effects.

The resolver deduplicates by canonical Ability identity while preserving source metadata. A Pokémon that has `Flash Fire`, selected `Defiant` at Level 20, and owns `Mixed Power` resolves to:

- Flash Fire — Starting Ability
- Defiant — Level 20 Choice
- Twisted Power — Granted by Mixed Power

For backward compatibility, owning Mixed Power is sufficient for the resolver to synthesize the Twisted Power grant if an older save lacks an explicit `grantedAbilities` entry.

## Native Ability correction

The Abilities tab exposes **Edit Native Ability Slots**. It is intended for:

- old saves missing a Level 20/40 selection;
- correcting a filling mistake;
- campaign-approved changes with GM Override.

Granted Abilities are not edited by this tool.

## Resolved creature payload

`POST /api/pokemon/reference-data` now includes `resolvedCreature`, with:

- stored/effective Stats;
- resolved Move Limit;
- resolved Abilities and provenance;
- modifier summary;
- Species Capabilities;
- Held Item;
- Base Relations exemptions.

This object is the direction for future Sheet, Moves, Abilities, Species and Type tabs. UI components should consume resolved values rather than independently reimplementing rules.
