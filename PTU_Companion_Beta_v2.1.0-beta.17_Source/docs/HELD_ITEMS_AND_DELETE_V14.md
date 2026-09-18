# Held Items and Pokémon deletion — v1.4

## Held Items

The Creature Sheet now exposes **Equip Held Item** inside `Item & Storage`.

The list is built from the Trainer Backpack and filtered through the active Ruleset. Only definitions marked as usable as Pokémon Held Items are offered.

Equipping:

1. resolves the item definition from the active Ruleset;
2. validates any item-specific configuration;
3. removes one copy from the Backpack;
4. returns the previously held item to the Backpack when swapping;
5. stores the definition/configuration on the Pokémon instance;
6. recalculates the Resolved Creature Model.

The UI reminds the player that equipping a Held Item in PTU costs a Standard Action and causes the Pokémon to forfeit its next turn; the app does not automatically skip a physical-table turn.

### Automation status

Some items are fully deterministic and automated. Contextual items remain visible with their rule text and are marked manual/conditional rather than guessed.

## Pokémon deletion

`Delete Pokémon` appears in the Creature Sheet header.

Deletion:

- uses two confirmations;
- removes the Pokémon from all Rosters implicitly;
- removes it from Storage/Carried state;
- returns an equipped Held Item to the Backpack;
- records the deletion in Trainer history;
- is recoverable only by restoring a prior save revision/export.
