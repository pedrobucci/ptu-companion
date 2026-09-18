# Pokémon Build Rules Engine — v0.5

## Purpose

The v0.5 rules engine moves Pokémon creation out of UI-specific JavaScript and into a reusable domain module:

`rules/pokemon-engine.mjs`

The frontend asks the local server for a build preview. The server resolves the current Species definition from the active Ruleset and passes that definition to the rules engine.

## Implemented PTU 1.05 rules

### Nature

A Pokémon Nature modifies Species Base Stats before Level-Up Stat Points are allocated.

- HP is raised/lowered by 1.
- Attack, Defense, Special Attack, Special Defense, and Speed are raised/lowered by 2.
- Neutral Natures leave Base Stats unchanged.
- A Base Stat may not be reduced below 1.

The engine contains all 36 Nature names from the PTU Nature Chart.

### Level-Up Stat Point budget

A newly built Pokémon receives a total allocation budget equal to:

`Pokémon Level + 10`

The wizard requires the entire budget to be allocated before normal creation succeeds.

### Base Relations

Base Relations are calculated from the Nature-adjusted Species Base Stats.

If adjusted Base Stat A is strictly greater than adjusted Base Stat B, the final value of A must remain strictly greater than B after Level-Up Stat Points are allocated.

Equal adjusted Base Stats do not create an ordering requirement.

The validation result is explicit and includes individual violations. GM Override may intentionally accept a Base Relations violation; the resulting instance records that the override occurred.

### Maximum HP

Maximum HP is calculated as:

`Pokémon Level + (final HP Stat × 3) + 10`

Current HP begins at calculated Maximum HP when the Pokémon is created.

### Tutor Points

v0.5 records earned Tutor Points as:

- 1 initial Tutor Point;
- +1 at Level 5;
- +1 again at every subsequent multiple of 5.

Tutor Point spending itself is deferred to a later version.

### Ability progression

Normal level-based Ability slots are represented as:

- starting slot: one Basic Ability;
- Level 20: second Ability, Basic or Advanced;
- Level 40: third Ability, any native Ability tier.

The model is a list of unlocked slots rather than a fixed maximum Ability array, because PTU effects may grant additional Abilities outside level progression.

### Natural Moves and Move Limit

The engine exposes Level-Up Moves whose numeric level is at or below the Pokémon's current level.

Evolution (`Evo`) Moves are exposed as eligible optional entries when the selected Species has them, but are not automatically selected merely because a user directly creates an evolved Species.

The normal Move Limit begins at 6, but the data model stores:

- base limit;
- modifier;
- effective limit.

This prevents a six-slot UI/backend hardcode and leaves room for Features/Abilities that modify the limit.

## Evolution requirement behavior

The engine asks the definition repository for the incoming PTU evolution relation, when one exists.

If a Species normally evolves at a minimum level higher than the Pokémon being created, the engine returns an informational warning such as:

> Normally evolves from Charcadet at Level 25. Direct creation below that Level is allowed.

This warning never blocks direct creation.

The future evolution wizard will use the same relation as an eligibility rule when evolving an existing Pokémon.

## HTTP boundary

`POST /api/pokemon/build-preview`

Input includes:

- ruleset id (optional; active Ruleset is default);
- Species definition id;
- level;
- Nature;
- Stat allocations;
- selected Abilities;
- selected Moves;
- Move Limit modifier;
- GM Override state;
- optional auto-allocation request.

The response includes normalized build state, validation results, final Stats, Maximum HP, Tutor Points, Ability slots, eligible Moves, Move Limit, and evolution notice.

## Persistence

Created Pokémon save the resolved build data in `pokemon.details_json`, including exact Species definition/version/content pack/Ruleset linkage. This is intentional: future Ruleset changes must not make it impossible to explain how an existing Pokémon was originally built.

## Deferred rules

The following are not silently approximated in v0.5:

- Vitamins;
- Features, Abilities, or Poké Edges that modify Base Relations or Stats;
- automatic Tutor Point spending;
- TM/HM/Tutor acquisition restrictions;
- Egg/Inheritance Move acquisition;
- re-learning/retraining;
- evolution restatting;
- full Move resolver/damage calculations.

Those require the modifier/progression engines planned for later versions.
