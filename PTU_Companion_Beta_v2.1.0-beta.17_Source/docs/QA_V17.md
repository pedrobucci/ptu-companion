# QA — v1.7

Verified with `VERIFY_V17.bat` / `scripts/verify_v17.mjs`.

## Automated checks

- modal backdrop does not contain an outside-click close handler;
- structured GM Grant resource list exists;
- second Trainer can be persisted in SQLite;
- active Trainer can be switched and reloaded;
- dedicated Trainer Moves tab exists;
- Trainer Move source picker exists;
- Trainer sheet reset workflow exists;
- profile switcher styling exists.

Expected output:

```text
PTU Companion v1.7 verification: OK
modal backdrop dismissal: disabled
structured GM Grant targets: present
multi-Trainer profiles + switching: passed
Trainer Moves tab + provenance picker: present
Trainer sheet reset workflow: present
```

## Manual regression checklist

1. Open Trainer > Profile > Edit Profile.
2. Click into a text field, drag-select text outside the input/modal bounds, and release.
3. Confirm the modal remains open.
4. Add a Resource GM Grant and confirm `Resource` is selected from a fixed list rather than free text.
5. Click the Trainer badge in the upper-right corner.
6. Create a second Trainer and switch between both profiles.
7. Confirm each Trainer retains separate campaign state.
8. Use `Reset Sheet` and confirm Pokémon/Backpack/GM Grants remain while Trainer build data resets.
9. Open Trainer > Moves, add Moves with Feature/Edge/Weapon/GM sources, and confirm provenance labels remain visible.
