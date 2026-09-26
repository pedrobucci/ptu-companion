# PTU Parametrized Pokémon Forms Inventory

Generated from the project’s supplied PTU data packs. This is an audit inventory, not yet the final pack conversion.

## Source anchors

- **PTU Core 1.05, p.206** defines Mega Evolution as a temporary physical transformation requiring a Pokémon-held species/form-specific Mega Stone and a Trainer-worn Mega Ring. It adds an Ability, may change Type, and changes Stats while preserving HP.
- **Gen 8ish PokéDex pack** contains 956 parsed Species records and exactly **48 Mega form blocks across 46 Species**, plus **2 Primal Reversion blocks**.
- Mega/Primal mechanics below are extracted from the parameterized Pokédex source blocks; no absent Stone IDs or artwork URLs are invented.

## Mega Forms

| Species | Form | Type | Added Ability | Stat changes | Source page |
|---|---|---|---|---|---:|
| Venusaur | Mega | Unchanged | Thick Fat | Atk +2, Def +4, Sp.Atk +2, Sp.Def +2 | 18 |
| Sceptile | Mega | Grass / Dragon | Lightning Rod | Atk +2, Def +1, Sp.Atk +4, Speed +3 | 24 |
| Charizard | Mega X | Fire / Dragon | Tough Claws | Atk +5, Def +3, Sp.Atk +2 | 42 |
| Charizard | Mega Y | Unchanged | Drought | Atk +2, Sp.Atk +5, Sp.Def +3 | 42 |
| Blaziken | Mega | Unchanged | Speed Boost | Atk +2, Def +1, Sp.Atk +2, Sp.Def +1, Speed +2 | 48 |
| Blastoise | Mega | Unchanged | Mega Launcher | Atk +2, Def +2, Sp.Atk +5, Sp.Def +1 | 66 |
| Swampert | Mega | Unchanged | — | — | 72 |
| Beedrill | Mega | Unchanged | — | — | 93 |
| Ampharos | Mega | Electric / Dragon | Mold Breaker | Atk +2, Def +2, Sp.Atk +5, Sp.Def +2, Speed -1 | 132 |
| Gengar | Mega | Unchanged | Shadow Tag | Def +2, Sp.Atk +4, Sp.Def +2, Speed +2 | 165 |
| Pidgeot | Mega | Unchanged | No Guard | Sp.Atk +7, Sp.Def +1, Speed +2 | 211 |
| Alakazam | Mega | Unchanged | Trace | Def +2, Sp.Atk +4, Sp.Def +1, Speed +3 | 250 |
| Gardevoir | Mega | Unchanged | Pixilate | Atk +2, Sp.Atk +4, Sp.Def +2, Speed +2 | 257 |
| Gallade | Mega | Unchanged | Inner Focus | Atk +4, Def +3, Speed +3 | 258 |
| Aggron | Mega | Steel | Filter Diet: Terravore Habitat: Cave, Mountain | Atk +3, Def +5, Sp.Def +2 | 279 |
| Scizor | Mega | Unchanged | Technician | Atk +2, Def +4, Sp.Atk +1, Sp.Def +2, Speed +1 | 307 |
| Houndoom | Mega | Unchanged | Solar Power | Def +4, Sp.Atk +3, Sp.Def +1, Speed +2 | 349 |
| Manectric | Mega | Unchanged | Intimidate | Def +2, Sp.Atk +3, Sp.Def +2, Speed +3 | 369 |
| Medicham | Mega | Unchanged | Pure Power Diet: Omnivore Habitat: Cave, Mountain | Atk +4, Def +1, Sp.Atk +2, Sp.Def +1, Speed +2 | 395 |
| Lucario | Mega | Unchanged | Adaptability | Atk +4, Def +2, Sp.Atk +2, Speed +2 | 397 |
| Camerupt | Mega | Unchanged | Sheer Force | Atk +2, Def +3, Sp.Atk +4, Sp.Def +3, Speed -2 | 415 |
| Banette | Mega | Unchanged | Prankster | Atk +5, Def +1, Sp.Atk +1, Sp.Def +2, Speed +1 | 430 |
| Abomasnow | Mega | Unchanged | Snow Warning | Atk +4, Def +3, Sp.Atk +4, Sp.Def +2, Speed -3 | 457 |
| Glalie | Mega | Unchanged | Refrigerate | Atk +4, Sp.Atk +4, Speed +2 | 505 |
| Altaria | Mega | Dragon / Fairy | Pixilate | Atk +4, Def +2, Sp.Atk +4 | 540 |
| Lopunny | Mega | Normal / Fighting | Scrappy | Atk +6, Def +1, Speed +3 | 544 |
| Steelix | Mega | Unchanged | Sand Force | Atk +4, Def +3, Sp.Def +3 | 608 |
| Slowbro | Mega | Unchanged | Shell Armor | Def +7, Sp.Atk +3 | 628 |
| Gyarados | Mega | Water / Dark | Mold Breaker | Atk +3, Def +3, Sp.Atk +1, Sp.Def +3 | 641 |
| Sharpedo | Mega | Unchanged | Strong Jaw | Atk +2, Def +3, Sp.Atk +1, Sp.Def +3, Speed +1 | 653 |
| Pinsir | Mega | Bug / Flying | Aerilate Gains Sky 6. | Atk +3, Def +2, Sp.Atk +1, Sp.Def +2, Speed +2 | 685 |
| Heracross | Mega | Unchanged | Skill Link Diet: Herbivore Habitat: Forest, Rainforest | Atk +6, Def +4, Sp.Def +1, Speed -1 | 687 |
| Sableye | Mega | Unchanged Diet: Terravore Habitat: Cave, Mountain | Magic Bounce | Atk +1, Def +5, Sp.Atk +2, Sp.Def +5, Speed -3 | 691 |
| Absol | Mega | Unchanged | Magic Bounce | Atk +2, Sp.Atk +4, Speed +4 | 692 |
| Kangaskhan | Mega | Unchanged | Parental Bond | Atk +3, Def +2, Sp.Atk +2, Sp.Def +2, Speed +1 | 726 |
| Audino | Mega | Normal / Fairy | Healer Diet: Herbivore Habitat: Forest, Grassland | Def +4, Sp.Atk +2, Sp.Def +4 | 738 |
| Mawile | Mega | Unchanged | Huge Power | Atk +2, Def +4, Sp.Def +4 | 756 |
| Aerodactyl | Mega | Unchanged | Tough Claws | Atk +3, Def +2, Sp.Atk +1, Sp.Def +2, Speed +2 | 833 |
| Tyranitar | Mega | Unchanged | Sand Stream | Atk +3, Def +4, Sp.Def +2, Speed +1 | 843 |
| Salamence | Mega | Unchanged | Aerilate | Atk +1, Def +5, Sp.Atk +1, Sp.Def +1, Speed +2 | 846 |
| Metagross | Mega | Unchanged | — | — | 849 |
| Garchomp | Mega | Unchanged | Sand Force | Atk +4, Def +2, Sp.Atk +4, Sp.Def +1, Speed -1 | 852 |
| Mewtwo | Mega X | Psychic / Fighting | Steadfast | Atk +8, Def +1, Sp.Def +1 | 869 |
| Mewtwo | Mega Y | Unchanged | Insomnia | Atk +4, Def -2, Sp.Atk +4, Sp.Def +3, Speed +1 | 869 |
| Latias | Mega | Unchanged | Levitate | Atk +2, Def +3, Sp.Atk +3, Sp.Def +2 | 881 |
| Latios | Mega | Unchanged | Levitate | Atk +4, Def +2, Sp.Atk +3, Sp.Def +1 | 882 |
| Rayquaza | Mega | Unchanged | Run Away Diet: Omnivore Habitat: Mountain | Atk +3, Def +1, Sp.Atk +3, Sp.Def +1, Speed +2 | 885 |
| Diancie | Mega | Unchanged | Magic Bounce | Atk +6, Def -4, Sp.Atk +6, Sp.Def -4, Speed +6 | 930 |

## Primal Reversion

| Species | Type | Added Ability | Stat changes | Source page |
|---|---|---|---|---:|
| Groudon | Ground / Fire | Heat Mirage | Atk +3, Def +2, Sp.Atk +5 | 884 |
| Kyogre | Unchanged | Wash Away | Atk +5, Sp.Atk +3, Sp.Def +2 | 883 |

## Alternate-form candidate census

- Records with `variant_of`: **5**
- Candidate records identified from structured variant metadata, regional/form naming, or form-related capabilities: **81**
- `variant_kind` distribution: `{"form": 5}`

These candidates include regional forms, Forme/Mode pairs, Rotom appliances, fusion states, Crowned/Hero states, weather/battle modes, and other source-parametrized alternatives. They remain candidates until family-by-family classification decides whether each is a permanent/base Form or temporary transformation.

## Shiny/artwork audit

- Species rows with normal artwork metadata in this source pack: **0**
- Species rows with dedicated Shiny artwork metadata in this source pack: **0**
- Absence of dedicated Shiny artwork does not prevent a Pokémon from being Shiny; Stage D falls back to the best normal artwork.

## Mega item audit

- Core item records matching Mega-related text/name heuristics: **3**.
- Exact Mega Stone IDs are intentionally not fabricated. The conversion phase should bind a held-item requirement only where a supplied item definition supports a stable ID; otherwise it should use an explicit source-backed/manual requirement.

## Next conversion pass

1. Convert all 48 Mega blocks into `mode: transformation` Forms on their base Species, preserving X/Y separately.
2. Convert Kyogre/Groudon Primal Reversion into transformation Forms.
3. Classify every alternate-form candidate family as permanent/base Form vs transformation using its PTU source mechanics.
4. Reconcile regional forms already represented as separate Species records into the generic Form layer without breaking existing IDs/imports.
5. Add Shiny artwork metadata only where an actual supplied asset/URL exists; otherwise keep the Stage D fallback.
6. Generate deterministic `.ptucp` defaults for Windows and Android and add completeness regressions before changing the bundled packs.
