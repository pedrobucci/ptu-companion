# PTU Companion Android v2.2.0-beta.16

## Weapon Pack v2 / Arcane Weapons

- Imported weapon definitions now preserve and resolve the complete weapon mechanics used by the expanded `.ptucp` weapon pack.
- Arcane Weapons are resolved as Special weapons and qualify their Adept/Master Weapon Moves with Occult Education under the PTU 1.05 Editation rules.
- Arcane Small/Large Melee and Short/Long Range classes are all recognized.
- Two-handed imported weapons reserve the Off Hand through the existing equipment flow.
- Static weapon equipment modifiers such as Doublade/Aegislash Evasion are applied while equipped and removed on unequip.
- Conditional weapon rules that require a target, trigger, Scene counter, weakness, critical hit, or other combat event are surfaced as contextual rules rather than silently guessed.
- Imported item icons can now use their own `raw.icon` before category fallback icons.
- Existing normal-weapon qualification substitutions such as Apparition remain active for non-Arcane weapons.

Designed for `campaign-homebrew-custom-weapons` v2.0.0.

- The companion weapons pack now includes all eight weapon entries from the Game of Throhs example alchemy list, including the source-derived Flametounge for the Badass Fire Sword and The Candy Hammer.
