# QA — PTU Companion v1.2

The v1.2 verifier covers the two reported defects and the first resolved modifier feature.

## Fire/Ghost defensive profile

Expected non-neutral profile for the current PTU type chart includes:

- Immunities: Normal, Fighting
- Weaknesses: Water, Ground, Rock, Ghost, Dark
- Resistances: Fire, Grass, Ice, Poison, Steel, Fairy
- Double resistance: Bug

Bug resolves to two resistance steps and therefore ×0.25 on the PTU scale.

## Mixed Power

The verifier checks:

- unavailable in Core-only
- available when September 2015 Playtest is enabled
- Level 10 prerequisite
- 5 Level-Up Stat Points invested into Attack
- 5 Level-Up Stat Points invested into Special Attack
- 2 Tutor Point cost
- acquisition grants Twisted Power
- stored Attack and Special Attack remain unchanged
- Physical damage gains half Special Attack, rounded down
- Special damage gains half Attack, rounded down
- resolved Move UI tokens are present
