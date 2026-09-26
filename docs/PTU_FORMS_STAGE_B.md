# PTU Stage B Forms Catalog

Generated deterministically from the versioned PTU classification/inventory. This catalog is intentionally **not applied to the bundled/default packs** while source-insufficient families remain.

## Summary

- Candidate-family form entries: **43**
- Record-backed family entries: **32**
- Rule-defined family entries: **11**
- Candidate-record/derived Stage B forms emitted: **67**
- Record-backed forms: **37**
- Rule-defined forms: **30**
- Synthetic Stage B transforms emitted: **52**
- Mega transforms: **48**
- Primal transforms: **2**
- Ultra Burst transforms: **2**
- Families not directly materialized: **26**

## Safety gates

- Every emitted `forms[]` entry uses Stage B mode `permanent` or `transformation`.
- Source-insufficient/event-driven requirements use Stage B `manual` review gates instead of guessed items/conditions.
- No artwork URL is generated. Artwork remains governed by the separate asset audit and the existing Stage B fallback.
- Rule-defined Ability builders clone source Ability-slot arrays rather than inventing slot placement.
- Wormadam cloak Forms copy complete supported structured mechanics from their supplied Species records.
- Pumpkaboo/Gourgeist size Forms copy only their explicit Base Stat matrices; exact per-size measurements are not fabricated from source ranges.
- No `.ptucp` file is written by this generator.

## Rule-defined builders

- `aegislash` / `rule_defined_stance_change` — Sword Stance
- `basculin` / `embedded_color_ability_variant` — Red, Blue
- `burmy` / `rule_defined_quick_cloak` — Plant Cloak, Sandy Cloak, Trash Cloak
- `eiscue` / `rule_defined_ice_face` — Noice Face
- `furfrou` / `rule_defined_fabulous_trim` — Star Trim, Diamond Trim, Heart Trim, Pharaoh Trim, Kabuki Trim, La Reine Trim, Matron Trim, Dandy Trim, Debutante Trim
- `gourgeist` / `embedded_size_base_stats` — Small, Average, Large, Super
- `meloetta` / `rule_defined_relic_song` — Step Forme
- `minior` / `rule_defined_shields_down` — Core Forme
- `pumpkaboo` / `embedded_size_base_stats` — Small, Average, Large, Super
- `wishiwashi` / `rule_defined_schooling` — Schooling Forme
- `wormadam` / `source_record_cloak_forms` — Plant Cloak, Sandy Cloak, Trash Cloak

## Synthetic transformations

- `abomasnow` / `mega-evolution` — Mega Abomasnow
- `absol` / `mega-evolution` — Mega Absol
- `aerodactyl` / `mega-evolution` — Mega Aerodactyl
- `aggron` / `mega-evolution` — Mega Aggron
- `alakazam` / `mega-evolution` — Mega Alakazam
- `altaria` / `mega-evolution` — Mega Altaria
- `ampharos` / `mega-evolution` — Mega Ampharos
- `audino` / `mega-evolution` — Mega Audino
- `banette` / `mega-evolution` — Mega Banette
- `beedrill` / `mega-evolution` — Mega Beedrill
- `blastoise` / `mega-evolution` — Mega Blastoise
- `blaziken` / `mega-evolution` — Mega Blaziken
- `camerupt` / `mega-evolution` — Mega Camerupt
- `charizard` / `mega-evolution` — Mega Charizard X, Mega Charizard Y
- `diancie` / `mega-evolution` — Mega Diancie
- `gallade` / `mega-evolution` — Mega Gallade
- `garchomp` / `mega-evolution` — Mega Garchomp
- `gardevoir` / `mega-evolution` — Mega Gardevoir
- `gengar` / `mega-evolution` — Mega Gengar
- `glalie` / `mega-evolution` — Mega Glalie
- `groudon` / `primal-reversion` — Primal Groudon
- `gyarados` / `mega-evolution` — Mega Gyarados
- `heracross` / `mega-evolution` — Mega Heracross
- `houndoom` / `mega-evolution` — Mega Houndoom
- `kangaskhan` / `mega-evolution` — Mega Kangaskhan
- `kyogre` / `primal-reversion` — Primal Kyogre
- `latias` / `mega-evolution` — Mega Latias
- `latios` / `mega-evolution` — Mega Latios
- `lopunny` / `mega-evolution` — Mega Lopunny
- `lucario` / `mega-evolution` — Mega Lucario
- `manectric` / `mega-evolution` — Mega Manectric
- `mawile` / `mega-evolution` — Mega Mawile
- `medicham` / `mega-evolution` — Mega Medicham
- `metagross` / `mega-evolution` — Mega Metagross
- `mewtwo` / `mega-evolution` — Mega Mewtwo X, Mega Mewtwo Y
- `necrozma-dawn-wings` / `ultra-burst` — Ultra NECROZMA Dawn Wings
- `necrozma-dusk-mane` / `ultra-burst` — Ultra NECROZMA Dusk Mane
- `pidgeot` / `mega-evolution` — Mega Pidgeot
- `pinsir` / `mega-evolution` — Mega Pinsir
- `rayquaza` / `mega-evolution` — Mega Rayquaza
- `sableye` / `mega-evolution` — Mega Sableye
- `salamence` / `mega-evolution` — Mega Salamence
- `sceptile` / `mega-evolution` — Mega Sceptile
- `scizor` / `mega-evolution` — Mega Scizor
- `sharpedo` / `mega-evolution` — Mega Sharpedo
- `slowbro` / `mega-evolution` — Mega Slowbro
- `steelix` / `mega-evolution` — Mega Steelix
- `swampert` / `mega-evolution` — Mega Swampert
- `tyranitar` / `mega-evolution` — Mega Tyranitar
- `venusaur` / `mega-evolution` — Mega Venusaur

## Not directly materialized

- `arceus` (runtime_state) — Classification is not safe for direct forms[] materialization.
- `castform` (runtime_state) — Classification is not safe for direct forms[] materialization.
- `cramorant` (false_positive) — Classification is not safe for direct forms[] materialization.
- `darmanitan` (mixed) — Classification is not safe for direct forms[] materialization.
- `deerling` (runtime_state) — Classification is not safe for direct forms[] materialization.
- `deoxys` (defer) — Classification is not safe for direct forms[] materialization.
- `giratina` (defer) — Classification is not safe for direct forms[] materialization.
- `hoopa` (defer) — Classification is not safe for direct forms[] materialization.
- `kyurem` (defer) — Classification is not safe for direct forms[] materialization.
- `landorus` (defer) — Classification is not safe for direct forms[] materialization.
- `mimikyu` (false_positive) — Classification is not safe for direct forms[] materialization.
- `morpeko` (runtime_state) — Classification is not safe for direct forms[] materialization.
- `necrozma` (mixed) — Classification is not safe for direct forms[] materialization.
- `nidoran-f` (false_positive) — Classification is not safe for direct forms[] materialization.
- `nidoran-m` (false_positive) — Classification is not safe for direct forms[] materialization.
- `oricorio` (defer) — Classification is not safe for direct forms[] materialization.
- `rotom` (defer) — Classification is not safe for direct forms[] materialization.
- `sawsbuck` (runtime_state) — Classification is not safe for direct forms[] materialization.
- `shaymin` (defer) — Classification is not safe for direct forms[] materialization.
- `silvally` (runtime_state) — Classification is not safe for direct forms[] materialization.
- `solosis` (false_positive) — Classification is not safe for direct forms[] materialization.
- `thundurus` (defer) — Classification is not safe for direct forms[] materialization.
- `tornadus` (defer) — Classification is not safe for direct forms[] materialization.
- `zacian` (mixed) — Classification is not safe for direct forms[] materialization.
- `zamazenta` (mixed) — Classification is not safe for direct forms[] materialization.
- `zygarde` (mixed) — Classification is not safe for direct forms[] materialization.
