# PTU Companion v1.9 — Trainer Progression Engine

v1.9 replaces the old prototype Trainer level-up placeholder with a rules-aware PTU advancement workflow.

## Progression schedule

- every new Trainer Level grants one Stat Point;
- odd Levels grant a Feature;
- even Levels grant an Edge;
- Levels 2, 6 and 12 unlock Adept, Expert and Master Skills and grant the corresponding bonus Skill Edge;
- Levels 5, 10, 20, 30 and 40 expose their PTU milestone choice;
- offensive milestone tracks produce restricted Attack / Special Attack Stat Points at their later even Levels;
- Trainer level is capped at 50;
- Trainer Experience is represented as `/10`, while GM Milestones remain a valid narrative leveling source.

## Rules-aware selection

- Feature and Edge options are resolved from the active Ruleset;
- deterministic prerequisites are evaluated against the projected post-level-up Trainer;
- complex/manual prerequisites require explicit player confirmation rather than being guessed;
- Ranked/single-purchase limits are checked;
- the four-Class cap is enforced, including base-class records whose source metadata identifies the class even when the literal `[Class]` tag is missing;
- the special bonus Skill Edges at Levels 2/6/12 cannot purchase the newly unlocked rank on that same milestone;
- GM Override can deliberately bypass legality checks.

## Persistence

Applying a level stores:

- Stat allocations;
- milestone choice;
- selected Features and Edges with their configuration/provenance;
- a semantic Level History entry;
- the new Trainer Level and `0 / 10` Trainer EXP state.
