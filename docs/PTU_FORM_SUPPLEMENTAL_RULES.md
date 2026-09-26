# PTU Form Supplemental Rules Audit

This audit records only Form mechanics explicitly supported by the supplied project sources. It is intended to complement the generated Species inventory before any bundled `.ptucp` conversion. Missing activation requirements remain `source_insufficient`; main-series game rules are not used to fill gaps.

| Family | Rule | Source | Classification | Source-backed activation/state |
|---|---|---|---|---|
| Silvally | RKS System | SuMo References p.4 | runtime state | Type follows the held Memory Disc. |
| Wishiwashi | Schooling | SuMo References p.4 | transformation | Schooling Forme is activated by the Ability, grants source-defined Temporary HP, and returns to Solo under the source HP condition. |
| Minior | Shields Down | SuMo References p.4 | transformation | Meteor changes to Core at half maximum HP or lower; outside combat it returns to Meteor when above half. |
| Zygarde | Power Construct | SuMo References p.3 | transformation | Below 50% HP, source-defined action enters Complete Forme for the Scene while retaining prior-form HP total/max. |
| Zygarde | Zygarde Cells | SuMo References p.1 | persistent form | Zygarde Cube builds/switches 10% and 50% states under the source cell rules. |
| Necrozma | Viral Fusion | SuMo References p.1 | persistent form | Source-defined bonding produces the Solgaleo/Lunala-specific bonded forms. |
| Zacian / Zamazenta | Weapon Bond | New Abilities and Moves | transformation | Extended Action with Ancestral Sword/Shield enters Crowned Forme; ends on fainting or voluntary Extended Action release. |
| Morpeko | Hunger Switch | New Abilities and Moves | runtime state | Each turn choose Full Belly or Hangry; only the source Accuracy/Damage bonuses are assumed. |
| Eiscue | Ice Face | New Abilities and Moves | transformation | Ice Face while the Ability's Temporary HP remains; otherwise Noice Face. |
| Galarian Darmanitan | Zen Snowed | New Abilities and Moves | transformation | Scene Swift Action enters Zen Mode for the rest of the Scene and makes Ice Punch/Fire Punch available. |
| Deerling / Sawsbuck | Seasonal | February 2016 Playtest Packet | persistent form | Source defines four seasonal states and an Extended Action change, plus environment-specific rules. |
| Meloetta | Relic Song | PTU Core 1.05 p.405 | transformation | While Meloetta knows Relic Song, it may switch between Aria Form and Step Form as a Swift Action when using Relic Song, or as a Standard Action otherwise. Both forms use the same HP Stat. |
| Necrozma | Ultra Burst | Gen 8ish PokéDex pp.945–946 | transformation | Transformation effects are explicit, but no activation requirement has yet been found in the supplied project sources. |

## Important modeling consequences

- Zygarde needs both a persistent/base Form layer for 10%/50% and an active transformation layer for Complete Forme.
- Necrozma's Dusk Mane/Dawn Wings bonded states are modeled as persistent/base Forms so Ultra Burst can sit on top as the active transformation without requiring two simultaneous `activeFormId` values.
- Meloetta's Aria/Step pair is now source-resolved as an active transformation controlled by Relic Song; the resolver must preserve the same HP Stat across both forms.
- Morpeko is a runtime state, not a mechanically distinct Species record in the supplied Pokédex; no unsupported Type or Move replacement is introduced.
- Cramorant's supplied `Gulp Missile` rule is an Ability reaction and does not define a PTU Form state, so it should not be promoted to a Form merely because the main-series games have visual states.
- Mega Evolution remains a generic transformation family driven by the Stage B Form resolver; no Mega-only hardcoded runtime path is required.

## Source gaps deliberately left open

The supplied material still does not establish activation/duration rules for every separate Form record (for example several Forme Change/Rotom/Therian/Giratina/Shaymin/Kyurem/Hoopa families). Those families remain deferred until the source supports their runtime semantics. Ultra Burst is likewise not assigned an item requirement from outside knowledge.
