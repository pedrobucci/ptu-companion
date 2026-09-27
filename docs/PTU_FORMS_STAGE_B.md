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
- Runtime requirement model: **2**
- Forms upgraded from review-only manual gates to structured source requirements: **8**
- Form lifecycle model: **1**
- Forms with source-explicit lifecycle automation: **8**
- Source-explicit lifecycle event rules: **24**

## Safety gates

- Every emitted `forms[]` entry uses Stage B mode `permanent` or `transformation`.
- Source-explicit eligibility/state uses structured runtime requirements for HP ratios, Temporary HP provenance, known Moves, combat state, trigger items, Abilities, Capabilities, and compatible base Forms.
- Remaining unsupported event/frequency/scene-lifecycle semantics keep `manual` review gates only where the PTU rule still cannot be represented losslessly.
- Mixed families explicitly compose persistent `baseFormId` choices with active `activeFormId` overlays.
- Necrozma Ultra Burst is emitted in the mixed family and removed from the synthetic list to prevent duplicate semantics.
- Zygarde Complete overlays preserve the prior 10%/50% HP Base Stat by applying only non-HP Base Stat deltas.
- No artwork URL is generated. Artwork remains governed by the separate asset audit and the existing Stage B fallback.
- No `.ptucp` file is written by this generator.

## Structured runtime requirements

- `wishiwashi:schooling` — requires Schooling; persists until both below half maximum HP and out of Temporary HP.
- `minior:core` — enters at half maximum HP or lower; once active it may persist above half HP while in combat, but not outside combat.
- `eiscue:noice-face` — requires Ice Face and tracked Ice Face Temporary HP to be exhausted.
- `meloetta:step-forme` — requires Relic Song to be known.
- `zygarde:complete-from-*` — requires Power Construct and activation below 50% HP; end-of-Scene lifecycle remains source metadata.
- `zacian:crowned-sword` / `zamazenta:crowned-shield` — require Weapon Bond and the corresponding ancestral weapon as the transformation trigger item; once active they persist until the source-defined relinquish/Faint condition.
- `compatible_base_forms` is enforced by the shared Windows/Android resolver for active transformations.

## Source-explicit lifecycle automation

- `aegislash:sword-stance` — damaging Move use enters Sword; King’s Shield, Protect, qualifying Defense-raising Status Moves or Blessings return Shield; an explicit Full Action event toggles Stance.
- `wishiwashi:schooling` — Schooling Ability use enters Schooling and returns a half-Max-HP Temporary HP grant directive; HP/Temporary-HP events revalidate the exact Solo reversion condition.
- `minior:core` — HP and combat-state events synchronize Meteor/Core using Shields Down.
- `eiscue:noice-face` — battle start and the Hail restoration action return two Ice Face tick directives; Ice Face-specific Temporary HP events synchronize Ice/Noice state.
- `zygarde:complete-from-*` — Power Construct Ability use activates the base-compatible Complete overlay and returns the source Temporary-HP formula; `scene-end` clears Complete.
- `zacian:crowned-sword` / `zamazenta:crowned-shield` — Weapon Bond capability use with the matching ancestral weapon activates Crowned; `faint` or explicit Extended Action relinquish clears it.
- The event engine returns state/effect directives; it does not silently spend actions, consume Daily/Scene frequency, or round HP fractions beyond the supplied source rule.

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
