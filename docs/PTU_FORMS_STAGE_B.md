# PTU Stage B Forms Catalog

Generated deterministically from the versioned PTU classification/inventory. This catalog is intentionally **not applied to the bundled/default packs** while source-insufficient families remain.

## Summary

- Candidate-family form entries: **48**
- Record-backed family entries: **32**
- Rule-defined family entries: **16**
- Candidate-record/derived Stage B forms emitted: **82**
- Record-backed forms: **37**
- Rule-defined forms: **45**
- Synthetic Stage B transforms emitted: **50**
- Mega transforms: **48**
- Primal transforms: **2**
- Synthetic Ultra Burst transforms: **0**
- Composed Necrozma Ultra Burst active overlays: **1** from **2** source blocks
- Families not directly materialized: **21**

## Safety gates

- Every emitted `forms[]` entry uses Stage B mode `permanent` or `transformation`.
- Event/action/HP conditions that Stage B cannot express exactly keep a `manual` review gate plus source mechanics; the manual gate is not the PTU rule itself.
- Mixed families explicitly compose persistent `baseFormId` choices with active `activeFormId` overlays.
- Necrozma Ultra Burst is emitted in the mixed family and removed from the synthetic list to prevent duplicate semantics.
- Zygarde Complete overlays preserve the prior 10%/50% HP Base Stat by applying only non-HP Base Stat deltas.
- No artwork URL is generated. Artwork remains governed by the separate asset audit and the existing Stage B fallback.
- No `.ptucp` file is written by this generator.

## Rule-defined builders

- `aegislash` / `rule_defined_stance_change` — Sword Stance
- `basculin` / `embedded_color_ability_variant` — Red, Blue
- `burmy` / `rule_defined_quick_cloak` — Plant Cloak, Sandy Cloak, Trash Cloak
- `darmanitan` / `mixed_darmanitan_standard_zen` — Standard Mode, Galarian Standard Mode, Zen Mode, Galarian Zen Mode
- `eiscue` / `rule_defined_ice_face` — Noice Face
- `furfrou` / `rule_defined_fabulous_trim` — Star Trim, Diamond Trim, Heart Trim, Pharaoh Trim, Kabuki Trim, La Reine Trim, Matron Trim, Dandy Trim, Debutante Trim
- `gourgeist` / `embedded_size_base_stats` — Small, Average, Large, Super
- `meloetta` / `rule_defined_relic_song` — Step Forme
- `minior` / `rule_defined_shields_down` — Core Forme
- `necrozma` / `mixed_necrozma_fusion_ultra_burst` — Dusk Mane, Dawn Wings, Ultra Burst
- `pumpkaboo` / `embedded_size_base_stats` — Small, Average, Large, Super
- `wishiwashi` / `rule_defined_schooling` — Schooling Forme
- `wormadam` / `source_record_cloak_forms` — Plant Cloak, Sandy Cloak, Trash Cloak
- `zacian` / `mixed_weapon_bond` — Hero of Many Battles Forme, Crowned Sword Forme
- `zamazenta` / `mixed_weapon_bond` — Hero of Many Battles Forme, Crowned Shield Forme
- `zygarde` / `mixed_zygarde_cells_power_construct` — 10% Forme, 50% Forme, Complete Forme, Complete Forme

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
- `deerling` (runtime_state) — Classification is not safe for direct forms[] materialization.
- `deoxys` (defer) — Classification is not safe for direct forms[] materialization.
- `giratina` (defer) — Classification is not safe for direct forms[] materialization.
- `hoopa` (defer) — Classification is not safe for direct forms[] materialization.
- `kyurem` (defer) — Classification is not safe for direct forms[] materialization.
- `landorus` (defer) — Classification is not safe for direct forms[] materialization.
- `mimikyu` (false_positive) — Classification is not safe for direct forms[] materialization.
- `morpeko` (runtime_state) — Classification is not safe for direct forms[] materialization.
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
