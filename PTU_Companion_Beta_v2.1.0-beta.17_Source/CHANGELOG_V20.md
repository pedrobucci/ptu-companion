# Changelog v2.0 — Trainer Linked Build + Weapons

This release closes the main Trainer-sheet regressions found after v1.9 and extends the Resolved Trainer model into equipment/weapon qualification.

## Fixed

- Background rank choices now mechanically seed Trainer Skills: 1 Adept, 1 Novice, and 3 Pathetic Skills.
- Existing saves are migrated once so previously display-only Background choices are reflected in Skill ranks.
- Combat tab tolerates missing/legacy equipment objects and no longer fails while rendering an incomplete Trainer.
- Trainer Feature/Edge cards show their stored choices (Type, Skill, Stat, Ability, selected Moves, etc.).

## Repeatable Trainer choices

- Basic/Adept/Expert/Master Skills can be recorded multiple times.
- Skill Stunt, Skill Enhancement, Virtuoso, Type Ace, and other definitions explicitly marked repeatable are no longer incorrectly blocked by the UI.
- Elemental Connection is treated as a campaign repeatable typed Edge, with duplicate selections of the same Type blocked.
- Type Ace is repeatable only with a different Type.
- Skill Enhancement prevents reusing a Skill that already received that Edge's bonus.

## Equipment and Weapon Moves

A campaign test item was added to the Shop:

- **Two-Handed Sword** — Fine Large Melee Weapon, ₽6000.
- Adept Weapon Move: **Backswing**.
- Master Weapon Move: **Slice**.
- Two-handed equipment reserves both Main Hand and Off-Hand.
- Equipping/unequipping moves the physical item between Backpack and Trainer equipment.

The Resolved Trainer model now understands embedded weapon mechanics:

- Fine weapons expose their Adept Move at Adept qualifying rank and their Master Move at Master qualifying rank.
- Large Melee modifiers are applied to granted Weapon Moves (+1 AC, +2 DB).
- Weapon Moves never receive STAB.
- Combat cards show the equipped Weapon and which Skill/rule qualified the Move.

## Alternate Weapon qualification

The first alternate qualification adapters are now active:

- Apparition: Melee Weapons may qualify through the best of Combat, Occult Education, or Intimidate.
- Steelheart: metal Melee Weapons may also qualify through Athletics or Focus.
- Herald of Pride: Melee Weapons may also qualify through Command or Intimidate.
- Cutthroat: Small Melee/Short Range Weapons may qualify through Rogue Skills.

These are resolved as provenance-aware alternatives; the highest legal qualifying Skill is used for eligibility while the source is displayed on the Move.
