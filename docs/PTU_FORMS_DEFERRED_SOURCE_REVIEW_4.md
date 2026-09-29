# PTU Forms Deferred Source Review — Pass 4

This pass re-audits the ten families still blocked by the source-confidence gate. It uses only the supplied PTU material and intentionally does **not** import main-series switching rules to complete missing mechanics.

## Result

- Families reviewed: **10**
- Families reclassified in this pass: **0**
- Families still deferred: **10**
- Default `.ptucp` gate: **closed**

The deferred set remains exactly:

`deoxys`, `giratina`, `hoopa`, `kyurem`, `landorus`, `oricorio`, `rotom`, `shaymin`, `thundurus`, `tornadus`.

## Important cross-family finding: `Forme Change` is not a trigger

The February 2016 Playtest Packet explicitly defines the generic `Forme Change` capability. It says the user can change formes **through a Move, Ability, or other effect**, and then defines how multiple Base Stat sets behave. In particular, the Formes must preserve the same total HP Stat value and changes such as Nature/Vitamins affect all Formes consistently.

This is useful schema evidence, but it does **not** define a universal action for changing Formes. A Species entry containing `Forme Change` therefore proves that the Pokemon supports multiple source-defined stat sets; it does not tell us which Move, Ability, item, action, or other effect performs that particular Species' transition.

That distinction is now an explicit audit invariant and prevents us from treating `Forme Change` itself as an At-Will/manual switch.

## Special capability-label audit

The supplied Gen 8ish PokéDex was reviewed for the family-specific capability names that previously looked as though they might hide the missing transition rule.

- `Multiform` occurs on the four Deoxys parameter records, but no separate supplied definition was found.
- `Dragon Fusion` occurs on the Kyurem normal/White/Black records, but no separate supplied definition was found.
- `Sky Forme` occurs only on the Shaymin Land/Sky records.
- `Therian Forme` occurs on the Tornadus/Thundurus/Landorus Incarnate/Therian records.
- `Nectar Dancer` occurs only in Oricorio's entry, where the Type is written as `Special / Flying (see Nectar Dancer)`.

These are therefore retained as positive evidence that a Form family exists, but **not** treated as implicit switch actions.

The source pass also checked common trigger-name hypotheses rather than silently assuming them from general Pokemon knowledge. No supplied PTU switching rule was established for Prison Bottle, Reveal Glass, Gracidea, DNA Splicers, or a Deoxys Meteorite interaction. `Game of Throhs` does contain a `Griseous Orb`, but the occurrence found is a reagent for the Kaladanda legendary-alchemy weapon; it does not define Giratina's Altered/Origin transition.

## Family decisions

| Family | Positive source evidence | Missing semantics after pass 4 | Decision |
|---|---|---|---|
| Deoxys | Normal/Attack/Defense/Speed records; `Forme Change`; `Multiform`; Blessed and the Damned says Deoxys can adapt many forms | No supplied Move/Ability/item/effect defines how or when the four Forms are selected | `defer` |
| Giratina | Altered/Origin records; `Forme Change`; `Origin Forme` | No supplied requirement/action/duration/reversal. Griseous Orb occurrence reviewed is unrelated crafting data | `defer` |
| Hoopa | Confined/Unbound records plus source-linked Move substitutions | No supplied activation/release/duration/reversal for Confined/Unbound | `defer` |
| Kyurem | Normal/White Fusion/Black Fusion records; `Dragon Fusion`; `Forme Change` | No supplied fusion action, target/counterpart requirement, or termination rule | `defer` |
| Landorus | Incarnate/Therian records; `Therian Forme` | No supplied switching action/requirement/duration | `defer` |
| Oricorio | `Special/Flying (see Nectar Dancer)` and `Nectar Dancer` capability | No supplied style/Type mapping or change action/requirement | `defer` |
| Rotom | Normal plus five appliance parameter sets; complete Type/capability/skill/Move changes; February 2016 `Poltergeist` maps Form to Ability/Move | No supplied enter/leave-appliance action, appliance requirement, or frequency | `defer` |
| Shaymin | Land/Sky records; `Sky Forme`; `Forme Change` | No supplied trigger/action/requirement/duration/reversion | `defer` |
| Thundurus | Incarnate/Therian records; `Therian Forme` | No supplied switching action/requirement/duration | `defer` |
| Tornadus | Incarnate/Therian records; `Therian Forme` | No supplied switching action/requirement/duration | `defer` |

## Strongest unresolved case: Rotom

Rotom remains deliberately deferred even though its resulting Form data are unusually complete. The supplied Gen 8ish entry explicitly says Appliance Forms change Type, size, capabilities, skills, and Move list and gives the five standard appliance parameter sets. The supplied February 2016 `Poltergeist` rule additionally maps each Form to a source-defined Ability and Move.

What is still absent is the operation that changes Normal Rotom into an appliance Form or back out of it. The generic `Forme Change` capability confirms that **some Move, Ability, or other effect** is required; it does not supply that effect. Stage B therefore still must not invent a generic appliance-selection action.

## Gate

No family in this pass gains enough source evidence to leave `defer`. The classification counts and Stage B materialization counts remain unchanged. In particular:

- none of these ten families is added to `forms[]`;
- no hypothetical held item or key item is generated;
- no duration or transition frequency is guessed;
- no artwork URL is synthesized;
- bundled/default `.ptucp` files remain untouched.

The next implementation track should therefore focus on **runtime primitives for already source-explicit families** or wait for an additional PTU source that actually defines one of these missing transition effects.
