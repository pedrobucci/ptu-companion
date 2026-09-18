# PTU Companion Functional Prototype v1.4

## Added

- Imported the four Species/Form definitions from the user-supplied `Fakemon 1 leva.pdf` into a new campaign Content Pack:
  - Panthore
  - Panzeus
  - Clefable W.
  - Clefable K.
- Added PTU evolution relationships for Panthore → Panzeus and app-normalized Clefable W./K. branches.
- Added Pokémon Held Item selection directly from the Trainer Backpack.
- Added Held Item return/swap behavior with inventory quantity tracking.
- Added first rules-backed Held Item effects:
  - Bright Powder: +2 Speed Evasion
  - Full Incense: grants Stall while held
  - Expert Belt: records +5 conditional Super Effective damage
  - Everstone: prevents evolution
  - Big Root: doubles HP-steal recovery
  - Iron Ball: halves Speed and removes Ground immunity
  - Eviolite: configurable +5 to two Stats and prevents evolution
  - Choice Item: configurable default +2 CS target; Suppressed lifecycle remains partially manual
- Held Item effects now feed the Resolved Creature Model and the Move damage preview where applicable.
- Added permanent Pokémon deletion with double confirmation.
- Deleting or storing a Pokémon safely returns its Held Item to the Backpack.

## Data handling notes

The imported Fakemon source is preserved as campaign material. Source spellings and layout ambiguities are not silently rewritten. Records that contain unresolved source references remain marked for review.
