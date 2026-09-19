# Pokémon Progression Engine — v0.8

## Purpose

The v0.8 progression layer separates **creation-time rules** from **post-creation progression**.

A Pokémon created through the rules-backed builder keeps its permanent build metadata in `details_json`. The progression engine uses that data plus the active Ruleset and the shared definition database to calculate the next valid state.

## Experience

The progression engine reads the canonical PTU experience table stored in `pokemon_experience` rather than embedding thresholds in the UI.

A progression request supplies `expGain`. The engine computes:

- current total EXP;
- new total EXP;
- resulting Level;
- every level crossed;
- Stat Points awarded;
- Tutor Point milestones;
- Ability milestones;
- Move/evolution checks.

EXP may be applied even when it is insufficient for a new Level.

## Normal level-up Stat allocation

Normal progression does not reallocate old Stat Points.

If three Levels are gained, three new Stat Points must be allocated while the previous allocation remains untouched.

The final Stats are validated against the Nature-adjusted Base Stats. The project-specific rule remains in force: **HP does not participate in Base Relations validation**.

## Ability progression

The normal number of Ability slots is derived from Level:

- starting Basic Ability;
- additional Basic/Advanced Ability at Level 20;
- additional Basic/Advanced/High Ability at Level 40.

The UI requires any newly unlocked slot to be resolved before progression can be applied.

## Move progression

The Move pool contains:

- currently-known Moves, selected by default;
- Level-Up Moves newly reached during the gained Levels;
- Evolution Moves/catch-up Moves when an Evolution is selected.

The user may uncheck a known Move to make room for a new Move. The final selection must fit the Pokémon's current resolved Move Limit.

## Evolution

The definition repository exposes outgoing evolution edges from the selected Species.

When an Evolution is selected:

- the evolved form's Species definition becomes the target definition;
- Nature is reapplied to the new Base Stats;
- the Pokémon must fully redistribute `Level + 10` Stat Points;
- Ability selections are mapped by corresponding Ability-list slot where possible;
- existing Moves remain available;
- the evolved form's Evolution Moves are offered;
- Moves below the minimum Evolution Level which the previous form could not learn are offered as evolution catch-up choices;
- Types, Species identifiers, Stats and Max HP are updated when progression is applied.

A suggested legal re-Stat can be generated to help testing, but the user can redistribute the points manually.

## GM Override

GM Override may allow an evolution below its normal minimum Level or bypass an unresolved/manual evolution condition. The resulting Pokémon remains a persistent campaign state rather than a temporary validation bypass.

## State application

Applying progression updates the Pokémon atomically through the existing campaign save path. A progression event is appended to `details.progressionHistory`, and the Trainer campaign history receives a high-level event.

Current HP is not restored by Level-Up or Evolution in this prototype.
