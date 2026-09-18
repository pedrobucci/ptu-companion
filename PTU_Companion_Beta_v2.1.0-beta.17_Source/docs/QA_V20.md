# QA v2.0

Run `VERIFY_V20.bat` on Windows or `node scripts/verify_v20.mjs` directly.

The automated verification covers:

- Background → Skill rank resolution;
- repeatability metadata for Basic Skills and typed Elemental Connection instances;
- independent application of multiple Basic Skills records;
- Combat-tab legacy/no-equipment regression shape;
- Two-Handed Sword presence and price in the seeded Shop;
- Fine Weapon tier unlocks at Adept/Master qualifying rank;
- Large Melee +1 AC / +2 DB on Weapon Moves;
- no STAB on Weapon Moves;
- Apparition qualifying Backswing through Adept Occult Education when Combat is only Untrained;
- live `/api/trainer/reference-data` server smoke tests.

Recommended manual regression:

1. Edit Background and confirm the five affected Skills update.
2. Add Basic Skills twice with different targets and confirm both cards show the target.
3. Add Elemental Connection twice with different Types and confirm both cards identify their Type; confirm a duplicate Type is rejected.
4. Open Combat before equipping anything.
5. Buy the Two-Handed Sword for ₽6000, equip it from Items, and confirm Off-Hand is reserved.
6. At Adept Combat, confirm Backswing appears; at Master Combat, confirm Slice also appears.
7. With low Combat but Apparition + Adept Occult Education or Intimidate, confirm Backswing still appears and the Combat card identifies the alternate qualification Skill.
