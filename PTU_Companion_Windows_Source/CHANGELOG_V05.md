# PTU Companion Functional Prototype — v0.5

## Main change

v0.5 introduces the first source-grounded **Pokémon Build Rules Engine**. The Species-linked creation wizard from v0.4 now computes and validates the most important PTU 1.05 creation values instead of asking the user to enter a final HP value manually.

## Added

- all 36 PTU Natures;
- Nature adjustments to Base Stats;
- `Level + 10` Pokémon Stat Point budget;
- Base Relations validation;
- optional GM Override for Base Relations violations;
- calculated final Combat Stats;
- calculated Maximum HP;
- Tutor Points earned by level;
- level-based Ability slot availability;
- natural Level-Up Move eligibility;
- Evolution Moves exposed as optional choices without forcing them on direct creation;
- resolved Move Limit model with a separate modifier instead of a fixed six-slot UI;
- informational evolution-minimum warning which never blocks direct creation;
- persistence of complete build metadata in the campaign SQLite database;
- richer Creature Sheet for rules-backed Pokémon;
- `/api/pokemon/natures` and `/api/pokemon/build-preview` endpoints;
- `rules/pokemon-engine.mjs` as the first reusable domain rules module;
- `VERIFY_V05.bat` and automated v0.5 rule tests.

## Important design decision

Evolution requirements are used by future progression/evolution flows, not as a restriction on creating an individual Pokémon directly. A Level 1 Ceruledge is therefore allowed and receives a warning that its normal source evolution has a higher minimum level.

## Still intentionally deferred

- complete Pokémon level-up wizard;
- evolution transition/restat workflow;
- Vitamins;
- Poké Edges and Tutor Point spending;
- TM/HM/Tutor move acquisition and the non-natural three-move limit;
- automatic Move Limit modifiers from Features/Abilities;
- Feature/Ability modifiers to Base Stats or final Stats;
- Inheritance/Egg Move acquisition workflow;
- resolved Move damage calculations from the created Pokémon's final stats.
