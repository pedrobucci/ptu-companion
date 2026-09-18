# Target-Level Progression — v0.9

The Pokémon progression screen supports two equivalent entry modes:

## Add EXP

The existing behavior. The user enters an EXP amount, and the engine determines the resulting Level from the PTU Experience table.

## Go to Level

The user selects a target Level from the current Level through 100. The rules engine looks up that Level's cumulative EXP threshold and calculates the minimum additional EXP required to reach it.

The resulting progression still goes through the exact same downstream rules:

- crossed Levels;
- Stat Points;
- Tutor Points;
- Ability milestones;
- new Moves;
- evolution eligibility;
- evolution re-Stat;
- validation.

The UI therefore does not bypass EXP; it simply computes the required EXP from the authoritative PTU Experience table.

Target Level cannot be used to de-level a Pokémon.
