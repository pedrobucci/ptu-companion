# QA Checklist — v0.5 Pokémon Build Engine

## Automated checks

Run:

`VERIFY_V05.bat`

The verification checks:

- campaign SQLite round-trip;
- Nature effects on HP and non-HP Base Stats;
- Level + 10 Stat Point budget;
- Base Relations validation;
- GM Override of Base Relations;
- Maximum HP formula;
- Tutor Point progression;
- Ability slot progression at Levels 1, 20, and 40;
- effective Move Limit representation;
- Ceruledge direct creation at Level 1 despite its normal incoming evolution minimum;
- Evolution Move availability without automatic selection;
- persistence of complete rules-backed Pokémon build metadata;
- presence of the v0.5 UI and API integration.

## Manual checks

Recommended manual scenarios:

1. Create a neutral-Nature Level 1 Species and confirm 11 Stat Points must be allocated.
2. Change Nature and confirm the Base Stats displayed in the Nature column update.
3. Deliberately violate Base Relations and confirm creation is blocked.
4. Enable GM Override and confirm the same allocation can be intentionally accepted.
5. Create a Level 20 Pokémon and confirm a second level-based Ability slot is shown.
6. Create a Level 40 Pokémon and confirm a third level-based Ability slot is shown.
7. Create Ceruledge below Level 25 and confirm only an informational evolution warning appears.
8. Increase the Move Limit modifier and confirm more than six selected Moves are permitted by the UI model when enough eligible Moves exist.
9. Save/restart and confirm final Stats, Nature, Abilities, Moves, Tutor Points, and definition linkage remain attached to the Pokémon.
10. Open the Creature Sheet and confirm rules-backed final Stats and build metadata are shown.
