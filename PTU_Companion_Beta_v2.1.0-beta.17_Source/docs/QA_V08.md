# QA — PTU Companion v0.8

## Automated verification

Run `VERIFY_V08.bat`.

Expected summary:

```text
PTU Companion v0.8 verification: OK
Ceruledge typing: Fire / Ghost
Pokémon EXP table: 100 levels
Lv 24 -> 25: +1 Stat Point, +1 Tutor Point
Lv 20 Ability unlock: validated
Charcadet -> Ceruledge evolution: validated
Evolution re-Stat + Move/Ability mapping: passed
SQLite progression history round-trip: passed
```

## Recommended manual test

1. Start the app with `RUN_FUNCTIONAL_PREVIEW.bat`.
2. Create a Charcadet around Level 19–24 using the rules-backed Pokémon creator.
3. Open its Creature Sheet and click **Progress Pokémon**.
4. Add enough EXP to cross at least one Level.
5. Confirm the wizard reports the correct number of Stat Points and Tutor Points.
6. At Level 20, confirm the new Ability slot must be chosen.
7. Progress a Level 24 Charcadet to Level 25.
8. Confirm Armarouge and Ceruledge appear as optional evolutions.
9. Select Ceruledge and confirm its type badges are **Fire / Ghost**.
10. Use the suggested Evolution re-Stat, then alter it manually if desired.
11. Confirm Shadow Claw appears as an Evolution Move option.
12. Apply progression and reload the page.
13. Confirm Level, Species, Fire/Ghost typing, Stats, Moves, Ability list, Tutor Points and progression history persist.

## Regression checks

Also confirm:

- the Creature page does not jump to the top while changing values inside the same screen;
- Storage still uses the corrected two-pane responsive layout;
- Pokédex & Rules search retains input focus;
- v0.7 Move checkboxes remain synchronized with the canonical selected Move list.
