# Trainer Linked Build & Weapons — v2.0

## Goal

Make Trainer choices behave like the Pokémon Resolved Creature model: Background, Edges, Features, GM Grants, Equipment, and current combat state feed one deterministic resolved sheet rather than being isolated notes.

## Background baseline

The saved Background now establishes the Trainer's base Skill ranks before Edges and other modifiers are layered on top:

- chosen Adept Skill → Rank 4;
- chosen Novice Skill → Rank 3;
- three chosen Pathetic Skills → Rank 1;
- every other Skill starts Untrained → Rank 2.

The Background editor immediately recalculates those base ranks. Existing saves receive a one-time migration for the five Background Skills.

## Repeatable records

Trainer Features/Edges are records, not unique-name booleans. Repeatable definitions can therefore exist several times with independent `selections` metadata. The card renders that metadata so a sheet can distinguish, for example:

- `Elemental Connection · Ghost`
- `Elemental Connection · Dark`
- `Basic Skills · Stealth`
- `Basic Skills · Combat`

Rules that require distinct targets reject duplicate target selections.

## Weapon data contract

Equipment may provide an embedded mechanical description:

```json
{
  "kind": "weapon",
  "quality": "Fine",
  "weaponClass": "large_melee",
  "hands": 2,
  "range": "Melee",
  "acModifier": 1,
  "dbModifier": 2,
  "weaponMoves": {
    "adept": "backswing",
    "master": "slice"
  }
}
```

This deliberately uses the same structured-effect direction planned for the Item Editor: the item definition describes what it changes, and the Trainer engine consumes that structure.

## Weapon qualification

Base qualification uses Combat. The resolver can contribute alternate qualification candidates from Features. In v2.0 the first adapters cover Apparition, Steelheart, Herald of Pride, and Cutthroat.

The resolved Move keeps qualification provenance, such as:

`Occult Education · Adept · Apparition`

This lets the UI explain why a Trainer can use a Move instead of merely enabling it silently.

## Two-Handed Sword

The Shop contains a campaign test weapon, not a claim that this exact named item appears in the Core example list. It is a Fine Large Melee sword built from the normal PTU weapon construction rules, with Backswing as its Adept Move and Slice as its Master Move.

Its purpose is to exercise the data model that future Item/Weapon editors will author.
