# Trainer Profiles, GM Grants, Modals, and Moves — v1.7

## Modal behavior

Application modals are intentionally non-dismissible from the backdrop. This prevents text selection, pointer drags, or accidental outside clicks from destroying an unfinished form. Explicit `×`, `Cancel`, and action buttons remain the only close paths.

## Structured GM Grants

A GM Grant now stores a canonical `target` rather than relying on a description string.

Examples:

```text
resource.edge
resource.feature
resource.stat_point
resource.skill_edge
resource.training_feature
resource.trainer_move

stat.attack
stat.spAttack
skill.Stealth
capability.overland
derived.maxHp
evasion.physical
```

This is a persistence contract for the later Trainer Modifier / Respec Engine.

## Multiple Trainer profiles

The SQLite database already used `profiles` as the owner of the normalized Trainer campaign state. v1.7 exposes that model to the UI.

The top-right Trainer badge opens the profile switcher. Only one Trainer is loaded as `activeProfileId` at a time, while inactive profiles remain persisted in SQLite.

A new Trainer starts with a clean Level 1 sheet, an empty Personal Team, no Pokémon/NPC records, and its own Backpack quantities.

## Reset Trainer Sheet

Reset is intentionally narrower than deleting a profile. It resets the mechanical Trainer build (level/build stats/background/skills/features/edges/moves/combat state) while preserving:

- Trainer identity;
- money and badges;
- GM Grants;
- Pokémon and Rosters;
- Backpack;
- NPCs and campaign notes.

## Trainer Moves

Trainer Moves are a dedicated sheet collection with no six-Move hard limit.

Each Move record stores provenance, e.g.:

```json
{
  "id": "shadow-punch",
  "name": "Shadow Punch",
  "sourceKind": "feature",
  "sourceLabel": "Feature · Active Ruleset"
}
```

Supported provenance choices in v1.7:

- Feature
- Edge
- Weapon
- GM Grant
- Other / Manual

Automatic semantic materialization from Feature/Edge definitions will belong to the formal Trainer Rules Engine; v1.7 establishes the correct data model and UI surface first.
