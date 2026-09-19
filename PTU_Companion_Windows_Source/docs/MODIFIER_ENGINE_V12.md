# Pokémon Modifier Engine — v1.2

v1.2 introduces the first small executable modifier layer instead of attempting to automate every PTU effect at once.

## Design rule

Permanent build data remains authoritative and immutable unless the user explicitly changes the build. A modifier produces a **resolved value** used by the sheet, Move preview, validation, or combat-facing UI.

Example:

```text
Permanent Attack       20
Permanent Sp. Attack   11
Mixed Power             ✓

Physical Move damage bonus from Twisted Power = floor(11 / 2) = +5
Special Move damage bonus from Twisted Power  = floor(20 / 2) = +10
```

Attack remains 20 and Special Attack remains 11 in the stored build.

## Implemented modifier

### Mixed Power → Twisted Power

When the September 2015 Playtest is enabled, Mixed Power is available as a Poké Edge.

Requirements:

- Level 10
- at least 5 Level-Up Stat Points invested in Attack
- at least 5 Level-Up Stat Points invested in Special Attack
- 2 Tutor Points

The Poké Edge grants Twisted Power. The modifier resolver applies the Ability's damage rule:

- Physical damaging Move: add half Special Attack to the damage roll
- Special damaging Move: add half Attack to the damage roll
- round down
- Damage Class is not changed

The Move resolver applies modifiers in this order for the currently implemented subset:

```text
Move DB
+ STAB DB modifier
→ final DB
→ Damage Chart dice
+ Attack or Special Attack
+ resolved damage-roll modifiers (Mixed Power/Twisted Power)
→ displayed damage expression
```

## Type profile fix

Type defenses are not a modifier from Mixed Power, but v1.2 fixes the same resolved-view layer. Dual Types accumulate PTU matchup steps, then map the net step count to the PTU multiplier table. An immunity always resolves to ×0.

The UI uses the canonical relation names:

- `immune`
- `resistant`
- `neutral`
- `weak`

## Next modifier-engine targets

The architecture is prepared to add deterministic effects from Abilities, Poké Edges, equipment and GM modifiers without mutating permanent build data. Conditional/narrative effects remain text-first until the necessary combat context exists.
