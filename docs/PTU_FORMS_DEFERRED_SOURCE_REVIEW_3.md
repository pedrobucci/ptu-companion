# PTU Forms — Deferred Source Review 3

This pass revisits the ten families still classified as `defer` using only the supplied PTU material. It records both positive form evidence and the runtime semantics that remain missing. No main-series switching rule, item, duration, or trigger is imported by assumption.

## Result

- Families reviewed: **10**
- Families reclassified in this pass: **0**
- Families still deferred: **10**

| Family | What the supplied PTU source establishes | Missing semantic that keeps it deferred |
|---|---|---|
| Deoxys | Normal, Attack, Defense and Speed Forme records; `Forme Change` + `Multiform`; distinct parameters. | No supplied action/requirement/duration for changing Forme. |
| Giratina | Altered and Origin records; `Forme Change` + `Origin Forme`; distinct parameters. | No supplied requirement/transition into or out of Origin Forme. |
| Hoopa | Confined and Unbound records; distinct Types/Stats/Abilities and linked Move replacements. | No supplied activation, release condition, or duration for Confined/Unbound switching. |
| Kyurem | Normal, Black Fusion and White Fusion records; `Dragon Fusion` + `Forme Change`; distinct mechanics. | No supplied `Dragon Fusion` definition or source-backed fusion transition/termination rule. |
| Landorus | Incarnate and Therian records with `Forme Change` / `Therian Forme`. | No supplied Incarnate/Therian switching rule. |
| Oricorio | Type is `Special / Flying (see Nectar Dancer)` and Capabilities include `Forme Change, Nectar Dancer`. | No supplied `Nectar Dancer` definition establishing style Types or switching semantics. |
| Rotom | Normal plus five Appliance Forms with explicit Type, Size, Capability, Skill and Move changes; `Poltergeist` maps each Form to an Ability and, at level 40+, a Move. | Effects are explicit, but no supplied appliance-change action/requirement/duration was found. |
| Shaymin | Land and Sky records with `Forme Change` / `Sky Forme`; distinct parameters. | No supplied requirement/action/duration for Sky Forme. |
| Thundurus | Incarnate and Therian records with `Forme Change` / `Therian Forme`. | No supplied Incarnate/Therian switching rule. |
| Tornadus | Incarnate and Therian records with `Forme Change` / `Therian Forme`. | No supplied Incarnate/Therian switching rule. |

## Important positive result: Rotom

The source audit now has enough PTU data to describe the **effects** of Rotom's five Appliance Forms without guessing: the Gen 8ish PokéDex explicitly lists the Type/Size/Capability/Skill/Move differences, and the February 2016 `Poltergeist` rule provides the form-specific Ability plus the level-40 Move mapping. Rotom nevertheless remains deferred because the PTU switching action/requirement itself is still absent from the supplied material reviewed here.

## Conversion consequence

All ten families remain excluded from automatic Stage B `forms[]` materialization. Their parameter blocks can stay inventoried for a later source resolution, but the generator must not fabricate held items, actions, durations, environmental requirements, or manual transitions merely to make them executable.
