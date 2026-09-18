# PTU Companion Beta v2.1.0-beta.14

## Hustle equipment mechanics

- Added deterministic Trainer support for the **Hustle** Ability from the February 2016 Playtest Packet.
- While Hustle is active, the resolved Trainer receives **-2 to all Accuracy Rolls** and **+10 to all Damage Rolls**.
- The Accuracy penalty is preserved as an Accuracy Roll modifier; Move AC itself is not rewritten.
- Damage cards now include the +10 static damage bonus in their resolved damage expression and breakdown.
- Trainer Stats and Combat views expose the current Accuracy Roll modifier and Damage Roll bonus.
- Because equipment-granted Abilities are recalculated from the currently equipped items, removing the Fine Large Sword removes Hustle and both modifiers automatically.

## Regression coverage

The new verification covers the imported Fine Large Sword, Apparition weapon qualification, Hustle application to Wounding Strike and Chip Away, and removal of the modifiers after unequipping.
