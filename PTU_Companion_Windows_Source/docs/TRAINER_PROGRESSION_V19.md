# Trainer Progression Engine — v1.9

## Purpose

The previous level-up screen only added one Stat Point and did not represent PTU Trainer advancement. v1.9 makes progression a transaction validated by the Rules Engine before it is committed to the Trainer sheet.

## Workflow

1. Resolve the rewards for `current level + 1`.
2. Select a milestone bonus when the new Level is 5, 10, 20, 30 or 40.
3. Allocate the normal Stat Point.
4. Allocate any restricted Attack / Special Attack milestone Stat Points.
5. Select required Features, Edges and bonus Skill Edges from the active Ruleset.
6. Configure definition-specific choices such as `[+Any]`, Type Expertise or Skill Enhancement.
7. Validate prerequisites, repeatability and class limits against the projected new sheet.
8. Commit the complete transaction and add a Level History record.

## Prerequisite policy

Machine-readable prerequisite AST nodes are evaluated automatically. Examples include minimum Level, minimum Skill Rank, required Edge/Feature, feature counts and several parameterized prerequisites. Conditions not safely understood by the current semantic layer are marked **MANUAL CHECK** and need explicit confirmation.

This is intentional: source text remains authoritative and the application does not silently invent legality.

## Skill milestone restriction

The additional Skill Edge at Level 2 cannot be used to rank a Skill to Adept; Level 6's cannot rank to Expert; Level 12's cannot rank to Master. A normal Edge received on that Level remains a separate resource.

## Performance

Normal preview requests do not serialize the complete Feature/Edge catalog. Eligible picker options are loaded only when a picker is opened, keeping Stat/milestone interactions responsive while still checking the entire active Ruleset.
