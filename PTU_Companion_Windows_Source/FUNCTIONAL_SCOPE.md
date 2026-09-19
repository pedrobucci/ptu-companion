# Functional Scope — PTU Companion v2.0

v2.0 keeps the complete Pokémon vertical slice and the Trainer progression/rules work from v1.9, then deepens the mechanical links among Trainer sheet components.

## Resolved Trainer inputs

- Background
- Skills
- Stats and Combat Stages
- Features
- Edges
- GM Grants
- equipped items/weapons
- automatically or manually granted Moves

## Background

Custom Background selections now seed the actual Skill ranks used by prerequisites and the resolved sheet.

## Repeatable Features/Edges

Records may have independent selections. Supported repeatability includes ranked definitions, definitions whose text says they may be taken multiple times, common repeatable Skill Edges, typed Elemental Connection instances for this campaign, and Type Ace branches.

## Equipment / Weapons

The Backpack can equip Trainer gear. The new Two-Handed Sword is a structured test item for the upcoming item/editor layer. The rules engine resolves Weapon Move tiers, weapon modifiers, two-hand occupancy, and alternate qualification Features such as Apparition.

## Combat

Trainer Moves continue to display calculated damage. Weapon Moves additionally display effective AC, range, Weapon source, and the Skill/Feature used to qualify for the Move.

## Still intentionally contextual

Triggered, Bound, Scene/Daily, target-dependent, terrain-dependent, and other conditional effects remain contextual unless the engine has a deterministic active-state input for them. This avoids treating conditional PTU bonuses as permanent sheet modifiers.
