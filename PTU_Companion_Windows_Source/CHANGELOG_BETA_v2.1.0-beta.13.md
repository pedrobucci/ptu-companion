# PTU Companion Beta v2.1.0-beta.13

## Imported custom weapons

- Content Pack Item `raw.mechanics` is now preserved when definitions become Backpack items.
- Imported weapons now use the same weapon resolver as the built-in Two-Handed Sword.
- `hands: 2` is therefore honored by the existing equip flow, reserving Off Hand.
- Weapon Adept/Master Moves use the existing Trainer weapon qualification resolver, including Feature/Class substitutions such as Apparition using Occult Education or Intimidate for melee weapons.
- Weapon definitions may also carry `compiled_effects`; equip-only Moves/Abilities are applied while equipped and disappear on unequip.
