# Trainer Sheet Foundation — v1.6

v1.6 begins the functional Trainer domain after the Pokémon workflow reached a stable vertical slice.

## Persisted Trainer detail model

```text
Trainer
├── Profile
├── Background
├── Skill Ranks
├── Basic Stats
├── Features
├── Edges
├── Trainer Moves
├── Current HP / Injuries
├── AP
├── Combat Stages
├── GM Grants
└── History
```

The additional data is stored in `trainers.details_json` so the normalized Trainer row does not need a database migration for every future Trainer mechanic.

## Background

The application stores a custom Background as:

- name;
- one Adept Skill;
- one Novice Skill;
- three Pathetic Skills.

It does not require a named preset.

## Skills

All PTU Trainer Skills are represented with rank values 1–6:

- Pathetic
- Untrained
- Novice
- Adept
- Expert
- Master

The current tab is a correction/editor surface. Starting-character constraints and Edge-driven rank changes will be enforced by the upcoming Trainer Validation Engine.

## Derived values implemented

- Trainer Max HP = Level × 2 + HP × 3 + 10
- Physical/Special/Speed Evasion = floor(related Stat / 5), maximum +6 from Stats
- AP = 5 + 1 per 5 Trainer Levels
- Power from Athletics/Combat rank thresholds
- Overland from Athletics + Acrobatics rank
- Swim, High Jump and Long Jump from the PTU creation formulas

## Features / Edges / Moves

v1.6 can select real active-Ruleset definitions and persist references to them.

This phase deliberately does not yet claim automatic prerequisite evaluation or starting-budget enforcement for Trainer Features/Edges. Those belong to the next Trainer Rules Engine layer.

Trainer Moves are stored as an unbounded collection; there is no six-Move array in the Trainer model.
