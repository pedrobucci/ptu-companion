# PTU Companion — Changelog v1.2

## Fixed

- Fixed dual-type defensive profile resolution. The seed database stores resistance cells as `resistant`; the previous resolver only consumed `resist`, so valid resistances disappeared from the Creature **Type** tab.
- Fire/Ghost profiles now correctly resolve immunities, one-step resistances, double resistances, neutral interactions and weaknesses using PTU combat multipliers.

## Added — Mixed Power / first resolved modifier layer

- Added the September 2015 **Mixed Power** Poké Edge to Rulesets where the September 2015 Playtest Pack is enabled.
- Requirements are machine-validated: Level 10 and at least 5 Level-Up Stat Points invested in both Attack and Special Attack.
- Cost is 2 Tutor Points.
- Acquiring Mixed Power persistently grants the **Twisted Power** effect to that Pokémon.
- Added a small reusable Pokémon Modifier Engine. Twisted Power adds half Special Attack (round down) to Physical Move damage and half Attack (round down) to Special Move damage. It does not alter the stored Attack/Sp. Attack Stats or the Move's Damage Class.
- The **Moves** tab now displays resolved damage expressions and a breakdown including DB, STAB, the relevant attacking Stat, and Mixed Power when active.
- The **Abilities** tab shows Twisted Power when it is granted by Mixed Power.
- The **Species** tab exposes the active Mixed Power modifier without changing the permanent stat allocation.

## Ruleset behavior

- Core-only Rulesets keep the Core Mixed Sweeper material and do not synthesize Mixed Power.
- Rulesets with the September 2015 Playtest expose Mixed Power as a Poké Edge, preserving source and version provenance.

## QA

Run `VERIFY_V12.bat` to validate the Fire/Ghost defensive profile, Mixed Power Ruleset gating, prerequisites, Tutor Point cost, granted Twisted Power effect, and resolved Move damage.
