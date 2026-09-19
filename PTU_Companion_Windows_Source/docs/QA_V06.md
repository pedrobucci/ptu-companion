# QA Checklist — v0.6

## Scroll / form continuity

- Change a stat near the bottom of Create Pokémon.
- Confirm the view remains at approximately the same vertical position.
- Select/deselect a Move and confirm the page does not jump to the top.
- Change HP or Injuries on a long Creature screen and confirm the same behavior.
- Navigate to a different sidebar screen and confirm the new screen starts at the top.

## HP Base Relations rule

- Create a Pokémon and allocate a disproportionate amount of points into HP.
- Confirm HP alone does not generate Base Relations errors.
- Create a non-HP ordering violation and confirm validation still catches it.

## Pre-evolution Moves

Suggested test:

1. Create Ceruledge.
2. Confirm the Move section announces Charcadet as pre-evolution history.
3. Confirm Moves such as Ember/Leer/Astonish appear with `PRE-EVO` provenance.
4. Select one and create the Pokémon.
5. Re-open the Creature Sheet and confirm the Move remains persisted with its source metadata.

## GM Move Override

1. Enable GM Override.
2. In Create Pokémon, use `GM Move Override` search.
3. Search for a Move that is not normally on the selected Species' lists.
4. Add it.
5. Confirm the Move is selectable and marked `GM`.
6. Create the Pokémon and confirm persistence.

## Automated verification

Run:

`VERIFY_V06.bat`

Expected result begins with:

`PTU Companion v0.6 verification: OK`
