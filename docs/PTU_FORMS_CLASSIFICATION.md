# PTU Forms Family Classification

This is the conversion gate between source discovery and default `.ptucp` mutation. Classification is conservative: a separately parameterized record proves that a variant exists, but runtime switching semantics are not invented.

## Summary

- Candidate records classified: **104**
- Candidate families classified: **67**
- Permanent/base families: **34**
- Persistent-form families: **4**
- Transformation families: **4**
- Runtime-state families: **4**
- Mixed base + transformation families: **5**
- Deferred/source-insufficient families: **12**
- False-positive families: **4**
- Synthetic transform inventory: **48 Mega + 2 Primal + 2 Ultra Burst source blocks**.

## Family decisions

| Family | Classification | Target | Evidence | Records | Decision |
|---|---|---|---|---:|---|
| aegislash | transformation | `activeFormId` | source_explicit | 1 | Stance Change defines Shield/Sword switching and stat swaps. |
| arceus | runtime_state | `runtime_resolver` | source_explicit | 1 | Multitype changes Elemental Type directly; no separate Species record is needed. |
| basculin | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Species entry embeds Red/Blue Ability variants. |
| burmy | persistent_form | `baseFormId` | source_explicit | 1 | Quick Cloak creates Plant/Sandy/Trash cloaks; the cloak Typing becomes permanent on evolution to Wormadam. |
| castform | runtime_state | `runtime_resolver` | source_explicit | 1 | Forecast changes Type according to current weather. |
| corsola | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| cramorant | false_positive | `none` | source_explicit_non_form | 1 | The supplied Gulp Missile rule is a reaction effect and does not define a PTU Form state. |
| darmanitan | mixed | `baseFormId+activeFormId` | source_explicit | 4 | Standard is the base state; Zen Mode is an active transformation. Galarian Zen Snowed uses its own source action/duration. |
| darumaka | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| deerling | persistent_form | `baseFormId` | source_explicit | 1 | Seasonal defines four source-backed seasonal states and a change action. |
| deoxys | defer | `none` | source_insufficient | 4 | Forme Change/Multiform records exist, but the switching rule/duration was not found. |
| diglett | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| dugtrio | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| eiscue | transformation | `activeFormId` | source_explicit | 2 | Ice Face/Noice Face is controlled by Temporary HP from Ice Face. |
| exeggutor | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| farfetchd | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| furfrou | persistent_form | `baseFormId` | source_explicit | 1 | Fabulous Trim defines persistent hairstyle states changed at a hair parlor. |
| geodude | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| giratina | defer | `none` | source_insufficient | 2 | Altered/Origin records exist, but the Origin switching requirement was not found. |
| golem | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| graveler | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| grimer | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| hoopa | defer | `none` | source_insufficient | 2 | Confined/Unbound records exist, but the switching requirement/duration was not found. |
| indeedee | permanent | `baseFormId` | source_explicit_variant | 2 | Male and Female are separately parameterized Species records in the supplied Pokédex. |
| kyurem | defer | `none` | source_insufficient | 3 | Normal/Black/White Fusion records exist, but Dragon Fusion rules were not found in the audited supplied sources. |
| landorus | defer | `none` | source_insufficient | 2 | Incarnate/Therian records exist, but Therian Forme switching rules were not found. |
| linoone | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| lycanroc | permanent | `baseFormId` | source_explicit_variant | 3 | Midday, Midnight, and Dusk are separately parameterized evolution forms. |
| marowak | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| meloetta | defer | `none` | source_insufficient | 2 | Aria/Step records exist, but the supplied audited sources did not establish the switching trigger/duration. |
| meowstic | permanent | `baseFormId` | source_explicit_variant | 2 | Male and Female are separately parameterized Species records in the supplied Pokédex. |
| meowth | permanent | `baseFormId` | source_explicit_variant | 2 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| mimikyu | defer | `none` | source_insufficient | 1 | The supplied Species has Disguise, but the audited project sources do not yet define a separate PTU Form mechanic. |
| minior | transformation | `activeFormId` | source_explicit | 2 | Shields Down defines Meteor/Core switching by HP state. |
| morpeko | runtime_state | `runtime_resolver` | source_explicit | 1 | Hunger Switch defines per-turn Full Belly/Hangry bonuses but no separate stat block. |
| mr-mime | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| muk | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| necrozma | mixed | `baseFormId+activeFormId` | source_explicit_effects | 3 | Base/Dusk Mane/Dawn Wings are persistent Viral Fusion states; Ultra Burst is a separate active transformation whose activation requirement is still source-insufficient. |
| nidoran-f | false_positive | `none` | distinct_species | 1 | Nidoran Female is already a distinct Species record, not a Form of Nidoran Male. |
| nidoran-m | false_positive | `none` | distinct_species | 1 | Nidoran Male is already a distinct Species record, not a Form of Nidoran Female. |
| ninetales | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| oricorio | defer | `none` | source_insufficient | 1 | The Species references Nectar Dancer/Forme Change, but the switching rule was not found in the audited supplied sources. |
| persian | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| ponyta | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| raichu | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| rapidash | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| raticate | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| rattata | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| rotom | defer | `none` | source_insufficient | 7 | Normal/appliance records exist and are mechanically distinct, but the Forme Change requirement was not found. |
| sandshrew | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| sandslash | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| sawsbuck | persistent_form | `baseFormId` | source_explicit | 1 | Seasonal defines four source-backed seasonal states and a change action. |
| shaymin | defer | `none` | source_insufficient | 2 | Land/Sky records exist, but the Sky Forme switching requirement/duration was not found. |
| silvally | runtime_state | `runtime_resolver` | source_explicit | 1 | RKS System changes Type to the held Memory Disc Type. |
| solosis | false_positive | `none` | no_independent_form_signal | 1 | The hardened audit found no independent Form signal beyond the first heuristic census. |
| stunfisk | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| thundurus | defer | `none` | source_insufficient | 2 | Incarnate/Therian records exist, but Therian Forme switching rules were not found. |
| tornadus | defer | `none` | source_insufficient | 2 | Incarnate/Therian records exist, but Therian Forme switching rules were not found. |
| vulpix | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| weezing | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| wishiwashi | transformation | `activeFormId` | source_explicit | 2 | Schooling defines Solo/Schooling states with HP/Temporary HP rules. |
| wormadam | permanent | `baseFormId` | source_explicit | 3 | Plant/Sandy/Trash cloak Typing is permanent after Burmy evolves into Wormadam. |
| yamask | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| zacian | mixed | `baseFormId+activeFormId` | source_explicit | 2 | Hero is the base state; Weapon Bond with Ancestral Sword enters Crowned Sword until its source-defined end condition. |
| zamazenta | mixed | `baseFormId+activeFormId` | source_explicit | 2 | Hero is the base state; Weapon Bond with Ancestral Shield enters Crowned Shield until its source-defined end condition. |
| zigzagoon | permanent | `baseFormId` | source_explicit_variant | 1 | The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer. |
| zygarde | mixed | `baseFormId+activeFormId` | source_explicit | 3 | Zygarde Cube manages persistent 10%/50% states; Power Construct creates Complete Forme as an active transformation. |

## Synthetic transformation families

- **mega-evolution** — transformation → `activeFormId`; forms: 48; requirement: `generic_rule_explicit_specific_item_ids_incomplete`. PTU Core defines Mega Evolution as a temporary transformation. Generic Form requirements should represent Mega Ring + species/form-specific Mega Stone without hardcoding Mega logic; missing stable item IDs are not fabricated.
- **primal-reversion** — transformation → `activeFormId`; forms: 2; requirement: `source_insufficient`. Kyogre and Groudon have explicit Primal Reversion transformation blocks, but this audit does not invent an activation requirement not present in the supplied structured sources.
- **ultra-burst** — transformation → `activeFormId`; forms: 2; requirement: `source_insufficient`. Dusk Mane and Dawn Wings both have explicit Ultra Burst effects; no activation requirement was found in the supplied project sources, so none is inferred.

## Deferred queue

- `deoxys` — requires additional supplied-source evidence before automatic conversion/runtime switching.
- `giratina` — requires additional supplied-source evidence before automatic conversion/runtime switching.
- `hoopa` — requires additional supplied-source evidence before automatic conversion/runtime switching.
- `kyurem` — requires additional supplied-source evidence before automatic conversion/runtime switching.
- `landorus` — requires additional supplied-source evidence before automatic conversion/runtime switching.
- `meloetta` — requires additional supplied-source evidence before automatic conversion/runtime switching.
- `mimikyu` — requires additional supplied-source evidence before automatic conversion/runtime switching.
- `oricorio` — requires additional supplied-source evidence before automatic conversion/runtime switching.
- `rotom` — requires additional supplied-source evidence before automatic conversion/runtime switching.
- `shaymin` — requires additional supplied-source evidence before automatic conversion/runtime switching.
- `thundurus` — requires additional supplied-source evidence before automatic conversion/runtime switching.
- `tornadus` — requires additional supplied-source evidence before automatic conversion/runtime switching.

## False positives

- `cramorant` — not promoted to the generic Forms layer by the current supplied-source evidence.
- `nidoran-f` — not promoted to the generic Forms layer by the current supplied-source evidence.
- `nidoran-m` — not promoted to the generic Forms layer by the current supplied-source evidence.
- `solosis` — not promoted to the generic Forms layer by the current supplied-source evidence.

## Conversion rule

Default packs must only convert families whose target layer is established above. Deferred families may be inventoried/displayed, but automatic requirements, durations, item gates, stat swaps, or form transitions must not be fabricated. Legacy Species IDs should remain import aliases where a permanent/persistent family is consolidated into `baseFormId`.
