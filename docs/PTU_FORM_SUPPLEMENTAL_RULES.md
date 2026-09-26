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
| Aegislash | Stance Change | PTU Core 1.05 p.331 | transformation | Shield is the default stance. Damaging attacks switch to Sword and swap Attack↔Defense and Sp. Atk↔Sp. Def; defensive source triggers return to Shield. A Full Action may also change stance. |
| Burmy | Quick Cloak | PTU Core 1.05 p.327 | persistent form | At-Will Standard Action creates Plant/Grass, Sandy/Ground, or Trash/Steel secondary Typing from nearby material. Super-Effective damage destroys the cloak; creating a new cloak replaces it. |
| Furfrou | Fabulous Trim | PTU Core 1.05 p.317 | persistent form | Extended Action at an appropriate hair parlor changes hairstyle. Star/Celebrate, Diamond/Defiant, Heart/Cute Tears, Pharaoh/Sand Veil, Kabuki/Inner Focus, La Reine/Intimidate, Matron/Friend Guard, Dandy/Moxie, Debutante/Confidence. |
| Basculin | Red / Blue Ability variant | Gen 8ish PokéDex p.764 | permanent | Advanced Ability 2 is Reckless for Red and Rock Head for Blue. The source does not define a runtime switch. |
| Deerling / Sawsbuck | Seasonal | February 2016 Playtest Packet p.13 | runtime state | Static rule keyed to the current season: Spring/Run Away, Summer/Grass Pelt, Autumn/Rivalry, Winter/Thick Fat. No Extended Action or persistent manual season-selection rule is present in the supplied text. |
| Meloetta | Relic Song | PTU Core 1.05 p.405 | transformation | While Meloetta knows Relic Song, it may switch between Aria Form and Step Form as a Swift Action when using Relic Song, or as a Standard Action otherwise. Both forms use the same HP Stat. |
| Necrozma | Ultra Burst | Gen 8ish PokéDex pp.945–946 | transformation | Transformation effects are explicit, but no activation requirement has yet been found in the supplied project sources. |

## Important modeling consequences

- Aegislash can be materialized losslessly as an active `sword-stance` transformation over an implicit Shield/base state; the source-backed stat swap is deterministic.
- Burmy can use persistent/base Form selections for Plant, Sandy, and Trash Cloaks because Quick Cloak explicitly defines the three secondary Types and their creation/removal semantics.
- Furfrou can use persistent/base hairstyle Forms when the generated builder replaces only the `Fabulous Trim` Ability slot with the source-listed granted Ability.
- Basculin can use permanent Red/Blue Forms when the generated builder replaces only the source's color-parameterized Advanced Ability 2 slot.
- `Seasonal` is a runtime state, not a persistent selectable Form: the supplied playtest rule grants an Ability from the current season and does not define a form-changing action.
- Zygarde needs both a persistent/base Form layer for 10%/50% and an active transformation layer for Complete Forme.
- Necrozma's Dusk Mane/Dawn Wings bonded states are modeled as persistent/base Forms so Ultra Burst can sit on top as the active transformation without requiring two simultaneous `activeFormId` values.
- Meloetta's Aria/Step pair is source-resolved as an active transformation controlled by Relic Song; the resolver must preserve the same HP Stat across both forms.
- Morpeko is a runtime state, not a mechanically distinct Species record in the supplied Pokédex; no unsupported Type or Move replacement is introduced.
- Cramorant's supplied `Gulp Missile` rule is an Ability reaction and does not define a PTU Form state, so it should not be promoted to a Form merely because the main-series games have visual states.
- Mega Evolution remains a generic transformation family driven by the Stage B Form resolver; no Mega-only hardcoded runtime path is required.

## Source gaps deliberately left open

The targeted supplied-source pass still does not establish activation/duration rules for Deoxys, Giratina, Hoopa, Kyurem, Landorus, Oricorio, Rotom, Shaymin, Thundurus, or Tornadus. Their alternate records/effects remain auditable, but they stay deferred until a supplied PTU source defines the missing runtime semantics. Ultra Burst is likewise not assigned an item requirement from outside knowledge.
