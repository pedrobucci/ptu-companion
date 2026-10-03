# Issue #72 — Pokémon Level Up alignment

Base: release Windows beta.30 / Android beta.36 (4f053af).

## Reproduction

In the Android runtime at 390×844, create a level 1 Abra using its default
legal allocation, then open Progress Pokémon → Go to Level (target 2).
Scroll the stats horizontally and inspect the five labels and their values.
Before this change, Android's four-column override places Final on a second
line; the separate header does not follow the rows' horizontal scroll.

## Repeatable acceptance check

1. In a disposable profile, create Abra at level 1; open Progress Pokémon.
2. Choose Go to Level 2 and scroll until the Speed +/− controls are visible.
3. Verify five columns; each label matches its field, including Final.
4. Tap Speed +, −, + without moving the table. Expect 1, 0, 1 point;
   the final Speed must be 12, 11, 12 and the horizontal position must stay.
5. Scroll to the right edge. Header and rows must move together; Final must
   remain on the same row as its stat's controls.
6. Apply the valid allocation and reload. Expect Abra level 2, 10 EXP,
   Speed 12, Max HP 27, with other stats unchanged.
7. Repeat on Windows at 1440×900; expect five aligned columns without overflow.

## Evidence from this change

- Android runtime in Chromium, 390×844: five computed grid tracks; header/row
  x positions differ at most 1 px (border). Speed −/+ retained horizontal
  scroll 193→193 px and document scroll 1002→1002 px after preview refresh.
- Right edge: scrollLeft 280 px; header and rows stayed aligned.
- Android progression applied and level 2 / 10 EXP retained after reload.
- Windows runtime with isolated SQLite, 1440×900: five aligned tracks,
  header/row difference at most 1 px, no horizontal overflow.
- Both full npm run verify suites passed. Actual Android WebView acceptance
  awaits a build and Pedro's validation. No version published by this PR.
