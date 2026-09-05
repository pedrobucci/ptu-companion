# T15B — Trainer/Pokémon Sheet Rule Traceability Matrix

**Status:** DELIVERED — audit/contract only, awaiting the second SHEET-CONTRACT GATE sub-vote (T15A already ACCEPT/ACHIEVED)
**Plan:** `.maestri/roles/d6bf77c1-15d8-4cd1-b989-cf5004ccc3e9/t13-visual-reference-replan.md`, Task T15B
**Scope:** Documentation/audit only. **Zero production files were read for the purpose of changing them and zero were changed** — verified by `git status` before and after (see §7).
**Method:** Every row below is sourced from one of: `content_pack_registry.json` (stable pack identifiers/hashes/record counts), `seed/json/source_registry.json` (source edition/kind/priority), `TECHNICAL_SPECIFICATION_v1.0.md` §2.1/§7-§18, `T12_CONTENT_COVERAGE_REPORT.md`, `DATA_QUALITY_REPORT_v1.0.md`, `KNOWN_GAPS_v1.0.md`, the actual current Rust models/commands (`app/crates/domain/src/profile/model.rs`, `engine/trainer_core.rs`, `app/src-tauri/src/commands.rs`), the actual current React sheet surfaces (`OverviewTab.tsx`, `PokemonTab.tsx`, `CombatTab.tsx`, `InventoryTab.tsx`, `TrainerSheet.tsx`), and `T13R1_DESIGN_CONTRACT.md`'s screen matrix (what the visual contract promises). No field's formula, cost, or default was inferred from a mockup, a field label, or a current implementation detail — where no cited rule source exists, the row says so explicitly and names a follow-up task instead.

---

## 1. Source & Pack Registry

### 1.1 Primary sources (PTU rulebooks/supplements), from `seed/json/source_registry.json`

| id | Title | Kind | Priority | Status |
|---|---|---:|---:|---|
| `core` | Pokémon Tabletop United 1.05 Core | official_core | 100 | available |
| `blessed` | Blessed and the Damned | official_supplement | 110 | available |
| `porygon` | Do Porygon Dream of Mareep? | official_supplement | 110 | available |
| `got` | Game of Throhs | official_supplement | 110 | available |
| `may2015` | PTU May 2015 Playtest Packet | official_playtest | 120 | available |
| `sep2015` | PTU September 2015 Playtest Packet | official_playtest | 125 | available |
| `feb2016` | February 2016 Playtest Packet | official_playtest | 130 | available |
| `gen8` | Gen 8ish PokeDex | unofficial_pokedex | 140 | available |
| `sumo` | SuMo References | supplement_reference | 145 | available |
| `new` | New Abilities and Moves | homebrew_or_later_supplement | 150 | available |
| `edit` | PTU 1.05 Editation | homebrew_rebalance | 160 | available |
| `chickute`/`classes_extra`/`especial`/`needlene`/`pidgey` | Campaign homebrew (species + class supplements) | homebrew / homebrew_species | 180 | available |

### 1.2 External factual registries (never a rules source — types/dex-numbers/announced-species facts only, per each entry's own `usage` field)

| id | Title | Kind | Accessed | Usage |
|---|---|---|---|---|
| `pokeapi_pokemon_types_csv` | PokeAPI `pokemon_types.csv` | external_factual_registry | 2026-09-03 | Type metadata for current official species stubs only |
| `pokeapi_species_csv` | PokeAPI `pokemon_species.csv` | external_factual_registry | 2026-09-03 | Species identifiers/National Dex metadata only; no flavor text |
| `pokemon_winds_waves` | Pokémon Winds and Waves official site | official_external_factual_registry | 2026-09-03 | Announced Gen X starter names/types/height/weight/category/Ability |
| `bulbapedia_natdex_2026` | Bulbapedia National Dex list | external_factual_registry | 2026-09-03 | Cross-check of current species count only |

**Licensing/use constraint — unresolved column, flagged as a gap (not fabricated):** no `LICENSE` file or explicit redistribution-rights statement exists anywhere in this repository for the 11 PTU PDF sources or the fan community that produced them. `TECHNICAL_SPECIFICATION_v1.0.md` §2.2 and `pokemon-ui-design-compliance.md` §17 both state the underlying franchise/system content belongs to its respective rights holders and is used for internal/reference purposes, but neither is a redistribution license. **Gap G-LIC** (see §6): before any public/commercial release, ownership must confirm the actual usage terms under which these 11 PDFs and the external factual registries may be embedded in a shipped SQLite dataset. T15B does not invent a license; it records that none is present.

### 1.3 Content packs (stable identifiers, from `content_pack_registry.json`, cross-checked live against the shipped `.ptucp` archives — see §7)

| Pack id | Kind | Priority | Source(s) | Raw record counts (this pack only) |
|---|---|---:|---|---|
| `pokemon-current-catalog-2026-09` | external_factual_catalog (**browse_only**) | 50 | `pokeapi_species_csv`, `pokemon_winds_waves` | species 134, `canonical_evolution_edges_current` 55 |
| `ptu-core-1.05` | official_core | 100 | `core` | moves 632, abilities 366, capabilities 78, features 435, edges 61, poke_edges 20, items 351, + 8 datasets (`damage_chart` 28, `type_matchups` 324, `type_effectiveness_scale` 7, `type_traits` 7, `trainer_progression` 50, `trainer_milestones` 8, `pokemon_experience` 100, `pokemon_progression_rules` 1) |
| `ptu-blessed-and-damned` | official_supplement | 110 | `blessed` | features 174 |
| `ptu-do-porygon-dream-of-mareep` | official_supplement | 110 | `porygon` | capabilities 8, features 43 |
| `ptu-game-of-throhs` | official_supplement | 110 | `got` | moves 14, abilities 1, features 85 |
| `ptu-may-2015-playtest` | official_playtest | 120 | `may2015` | features 16 |
| `ptu-september-2015-playtest` | official_playtest | 125 | `sep2015` | moves 3, abilities 3, features 19 |
| `ptu-february-2016-playtest` | official_playtest | 130 | `feb2016` | abilities 164, capabilities 3 |
| `ptu-gen8ish-pokedex` | unofficial_pokedex | 140 | `gen8` | species 956, `ptu_evolution_edges` 486, `ptu_evolution_families` 547 |
| `ptu-sumo-references` | supplement_reference | 145 | `sumo` | moves 70, abilities 53, capabilities 2 |
| `ptu-new-abilities-and-moves` | later_rules_reference | 150 | `new` | moves 41, abilities 29, capabilities 1 |
| `ptu-1.05-editation` | homebrew_rebalance | 160 | `edit` | moves 9, abilities 5, features 200 |
| `campaign-homebrew-classes-extra` | homebrew | 180 | `classes_extra` | features 13 |
| `campaign-homebrew-especial-classes` | homebrew | 180 | `especial` | features 14 |
| `campaign-homebrew-chickute` | homebrew_species | 180 | `chickute` | species 3, evolution edges 2/families 1 |
| `campaign-homebrew-needlene` | homebrew_species | 180 | `needlene` | abilities 1, species 1, evolution families 1 |
| `campaign-homebrew-paldean-pidgey` | homebrew_species | 180 | `pidgey` | species 3, evolution edges 1/families 1 |
| `campaign-homebrew-knight` | homebrew_species_or_later_conversion | 180 | `knight`* | moves 5, abilities 3, capabilities 1, species 4, evolution edges 4/families 2 |

\* `knight` does not appear in `source_registry.json`'s primary list (§1.1) — it is referenced only via `content_pack_registry.json`'s `source_ids`. **Gap G-KNIGHT** (§6): this pack's own governing source document is not inventoried in the primary source registry; its `kind` (`homebrew_species_or_later_conversion`) already signals it may embed later-generation mechanics (confirmed independently by `T12_CONTENT_COVERAGE_REPORT.md` §4's Tera Blast/Poltergeist blockers, both referenced by this pack's species). Treat as homebrew-precedence (180) until resolved.

**Raw-count vs. canonical-count reconciliation:** the table above is per-pack raw record counts (may include cross-pack duplicate logical ids at different priorities — that is the resolver's job to collapse, not a data error). The canonical, resolution-collapsed totals are `T12_CONTENT_COVERAGE_REPORT.md`'s: Edge 61, Feature 999, Item 351, Poké Edge 20, Ability 625 (versions)/477 (canonical winners), Capability 93, Move 774 (versions)/754 (canonical winners), Species 1101 (961 mechanically complete). Re-verified live against the actually-shipped packs in this session (§7) — unchanged from the report.

---

## 2. Precedence Model

`TECHNICAL_SPECIFICATION_v1.0.md` §2.1 states the six-tier default precedence (a Campaign Ruleset may reconfigure it; the numbers above are "a suggested starting point," not hardcoded):

1. PTU 1.05 Core (`ptu-core-1.05`, priority 100)
2. Official supplements (`blessed`/`porygon`/`got`, 110)
3. Official playtest packets, GM-selected (`may2015`/`sep2015`/`feb2016`, 120-130)
4. Unofficial Pokédex/update packs, GM-selected (`gen8`, 140; `sumo`/`new`/`edit` sit adjacent at 145-160 as later-rules/rebalance references, same tier intent)
5. Campaign/homebrew content packs (`chickute`/`classes_extra`/`especial`/`needlene`/`pidgey`/`knight`, 180)
6. GM overrides (runtime, via `GmGrant`/`record_gm_override` — always wins regardless of pack priority, by construction: it mutates the Trainer's own persisted state, not a resolved definition)

This is not a documentation claim only — it is the resolver's actual, tested behavior: `content::resolver::tests::higher_priority_pack_wins`, `disabled_pack_is_excluded_even_if_highest_priority`, `valid_pin_wins_over_higher_priority_pack`, `tie_break_uses_later_ruleset_declaration_order` (all passing, §7). The `pokemon-current-catalog-2026-09` pack sits *below* Core (priority 50, `browse_only: true`) specifically so it can never silently outrank a mechanically-real Core/supplement species — it exists only so a not-yet-mechanically-defined current-gen species is browsable, never selectable as a real character-creation option (`enabled_for_character_creation` gates that, per the species schema, §1.3 above).

---

## 3. Trainer Sheet Matrix

Legend: **Src** = authoritative source (id from §1.1/§1.3, or "n/a — no rule needed" for pure identity/free-text fields, or "**GAP**" with a footnote). **Persist.** = Rust owner + SQL column/table + null semantics. **Cmd/VM** = Tauri command + `api.ts` type. Gaps are footnoted `[Gn]`, resolved in §6 with an owning follow-up task.

### 3.1 Identity

| Field | Src | Creation/entry rule | Derivation & rounding | Persist. | Cmd/VM | UI surface | Validation | Test vectors |
|---|---|---|---|---|---|---|---|---|
| Name | n/a — free text | Player-entered at creation | none | `TrainerProfile.name: String` (`trainers.name`, not null) | `create_trainer`/`save_trainer`; `TrainerProfile.name` | `TrainerList`/`TrainerSheet` header, editable | non-empty required by `create_trainer`'s caller (`TrainerList.tsx` disables submit on empty) | none dedicated — covered incidentally by every profile round-trip test |
| Gender | spec §7 identity list | Player-entered | none | **[G1]** not modeled | — | mockup shows a gender icon next to name (`trainer_dashboard.png`) | — | — |
| Age/Height | spec §7 identity list | Player-entered | none | **[G1]** not modeled | — | not shown in any of the 13 references for the Trainer (only Pokémon height/weight appear on species editor mockups) | — | — |
| Weight (lb) | T15A | Player-entered | none (raw input) | `TrainerProfile.weight_lb: Option<i64>` (`trainers.weight_lb`, nullable — `None` = not entered, never 0) | `resolve_trainer_core_stats` reads it; **no dedicated setter command yet — [G2]**, `save_trainer` (whole-profile) is the only current write path | not built (T13R3+) | T15A: <55 lb → typed `ValidationIssue` `TRAINER_WEIGHT_BELOW_SUPPORTED_RANGE`, non-overridable | `trainer_core::tests::weight_class_boundaries_55_110_111_220_221`, `weight_below_55_is_a_typed_validation_issue_not_extrapolated` |
| Portrait/avatar image | spec §20 (media service) | Player-uploaded | Import pipeline: decode → max-dimension enforce → WebP derivative → UUID reference | `media_assets` table (generic owner_type/owner_id/kind/file_path) — table exists, **no Trainer-portrait-specific wiring confirmed — [G3]** | none dedicated | mockups show a circular avatar everywhere | none built | none |
| Tamer Rank / Region / ID No. / Guild / Join Date | **ILLUSTRATIVE — excluded** | — | — | — | — | — | — | — |
| Class label ("Rookie Tamer") | `trainer_features` collection (resolves to a Feature definition's name) | Implicit — whichever Feature the player has that represents their Class | none — direct display of a resolved Feature name | `TrainerProfile.features: Vec<Value>` (`trainer_features` table) — **existing, reusable as-is** | `add_trainer_collection_entry`/`remove_trainer_collection_entry`("features"); `resolveDefinition("feature", ...)` | `OverviewTab.tsx`'s "CLASS SUMMARY" section (already renders `profile.background`, not yet the resolved Class feature specifically) | none | none dedicated |
| Background (name + raised/lowered skills) | spec §7.1 — "free-form and rule-validated, not a mandatory list" | Player-entered name + skill deltas | Rules engine (not yet built) decides legality per active ruleset | `TrainerProfile.background: Option<Value>` (`trainers.background_json`) — **existing, typed shape per `fixtures/trainer_profile_full.json`** | `save_trainer`/`load_trainer` (whole-profile) | `OverviewTab.tsx` renders `background.name` only today | none built | none |

### 3.2 Level, Progression, Advancement (T15A — reference, not re-derived here)

| Field | Src | Creation/entry rule | Derivation & rounding | Persist. | Cmd/VM | UI surface | Validation | Test vectors |
|---|---|---|---|---|---|---|---|---|
| Level | `core` p. 20 | Starts 1; raised via XP/milestone/GM action | n/a (direct value) | `TrainerProfile.level: i64` (`trainers.level`, not null) | `save_trainer`; read by every T15A resolver call | Home/`OverviewTab.tsx` header | none dedicated beyond general profile save | round-trip tests only |
| EXP | spec §7 | Player/GM tracked | No Trainer XP-to-level curve is present in any supplied dataset (`pokemon_experience.json` is Pokémon-only) — **[G4]** level is never inferred from EXP anywhere in the engine, by design (T15A: "Do not infer advancement solely from Trainer XP") | `TrainerProfile.exp: i64` (`trainers.exp`, not null) | `save_trainer` | `OverviewTab.tsx` | none | none |
| Universal Stat Point grant per level | `core` p. 20, `trainer_progression.json` (dataset id `dataset:trainer_progression`, 50 records, shipped in `ptu-core-1.05`) | Automatic on level-up | Level 1 = 10 pts; every level after = +1 pt (`stat_points_at_level`) | Dataset-driven, no Trainer-owned column (read at resolve time) | `resolve_trainer_advancement`, `level_up_trainer`; `AdvancementRecord.universal_stat_point_grant` | not built (T13R3+) | `engine::trainer_core::validate_stat_allocation` (overspend/incomplete) | `trainer_core::tests::level_5_budget_accumulates_creation_plus_four_level_up_points` + 4 more |
| Feature/Edge grants per level | `core` p. 20, same dataset | Automatic | Direct dataset lookup (`features_at_level`/`edges_at_level`) — odd/even alternation is baked into the shipped data, not computed | Dataset-driven | `resolve_trainer_advancement`; `AdvancementRecord.feature_grant`/`edge_grant` | not built | none beyond dataset presence | `trainer_core::tests::advancement_records_cover_every_level_up_to_current_with_baseline_grants` |
| Milestones (levels 2/5/6/10/12/20/30/40) | `core` p. 19, `trainer_milestones.json` (8 records) | Player chooses at the milestone level, when `choice_options` is non-empty | **No formula for the exact bonus amount of a milestone's alternate stat-point stream is present in any supplied dataset** (the milestone text is narrative, e.g. "Attack/Special Attack bonus Stat Point stream on even levels 6-10 plus +2 retroactive points for levels 2 and 4") — **[G5]**, deliberately not computed by T15A per its own scope | Recorded as a `ProgressionLedgerEntry.milestone_choice: Option<String>` inside `TrainerProfile.progression: Vec<Value>` (`trainer_progression` SQL table, one row per level) — backward-compatible with the pre-T15A shape `OverviewTab.tsx` already writes | `resolve_trainer_advancement`; `AdvancementRecord.milestone_name`/`milestone_choice_options`/`milestone_choice`/`milestone_pending` | `OverviewTab.tsx` shows only `milestone_choice_required: boolean` today, no choice picker | Unresolved choice → `milestone_pending: true`, never auto-selected | `trainer_core::tests::milestone_with_choice_options_and_no_recorded_choice_is_pending_never_auto_bonused`, `a_recorded_milestone_choice_resolves_pending_to_false` |
| Level source (XP/Milestone/GmAction) | T15A (typed provenance, not a rule per se) | Recorded alongside a progression-ledger entry | Defaults to `Xp` when absent | `ProgressionLedgerEntry.level_source: LevelSource` inside `progression: Vec<Value>` | `resolve_trainer_advancement`; `AdvancementRecord.level_source` | not built | none beyond type | `trainer_core::tests::level_source_defaults_to_xp_and_honors_an_explicit_gm_action` |
| Respec | `core` §17.3 (spec, not page-cited) | GM/player-initiated | "Rebuilds normal progression allocations while preserving external grants unless the grant itself is explicitly removed" — already implemented | n/a (operation, not a field) | `respec_progression`, `reallocate_resource_grant` | `OverviewTab.tsx` "Respec" button — **existing, functional** | none typed beyond existing | `engine::respec::tests::*` (3 passing) |
| Money | spec §7 | Player-tracked, shop transactions mutate it | none | `TrainerProfile.money: i64` (`trainers.money`, not null) | `save_trainer`, `checkout_buy`/`checkout_sell` (atomic) | `OverviewTab.tsx`, `InventoryTab.tsx` | shop checkout validates sufficient funds | `engine::shop::tests::checkout_buy_fails_atomically_on_insufficient_funds` |
| "PTU Points" | **ILLUSTRATIVE — excluded** (T13R1 §11: no spec/domain definition found, distinct from `money`) | — | — | — | — | — | — | — |
| Wins / Rating / Badges | **ILLUSTRATIVE — excluded** (plan §11, user decision) | — | — | — | — | — | — | — |

### 3.3 Combat Stats & Step 6 Derived Capabilities (T15A — reference, not re-derived here)

| Field | Src | Creation rule | Derivation & rounding | Persist. | Cmd/VM | UI surface | Validation | Test vectors |
|---|---|---|---|---|---|---|---|---|
| HP / Attack / Defense / Sp.Atk / Sp.Def / Speed (base allocation) | `core` pp. 17-18 | HP floor 10, others floor 5; +10 creation points, ≤5/stat unless `GmOverride` | Base = floor + Σ allocated points | `TrainerProfile.stat_allocation: TrainerStatAllocation` (`trainers.stat_allocation_json`, empty entries = unallocated, never fabricated) | `resolve_trainer_core_stats`; `TrainerCoreResult.combat_stats.*` | not built | `validate_stat_allocation` — cap/overspend/incomplete | `trainer_core::tests::*` (12 dedicated) |
| Resolved value + breakdown (all 6) | `core` (formula) + GM Grant modifiers (existing mechanism) | n/a | `resolve_value(base, modifiers)` — existing generic engine, GM `fixed` grants targeting `trainer.stat.<x>` are the only wired source | Computed, not persisted (correct — spec 15: persist inputs, recompute the resolved value) | same command; `ResolvedValue{base,final_value,breakdown}` | not built | n/a | `resolve_trainer_core_feeds_gm_grants_through_the_modifier_engine_with_breakdown` |
| Max HP | `core` (formula: `level×2 + HP×3 + 10`) | n/a — derived | Uses the **resolved** HP stat (documented interpretive choice — flagged for Reviewer in the T15A Worker Result) | Computed | same command; `TrainerCoreResult.max_hp` | not built | n/a | `max_hp_matches_formula_at_representative_and_boundary_levels`, `max_hp_uses_the_resolved_hp_stat_so_a_hp_grant_cascades` |
| Physical/Special/Speed Evasion | `core` (formula: `floor(stat/5)`, cap +6) | n/a | Round-down per `core` p. 219 | Computed | same command | not built | n/a | boundary tests at 4/5, 29/30/35 |
| AP | `core` (formula: `5 + floor(level/5)`) | n/a | round-down | Computed | same command; `TrainerCoreResult.ap` | not built (dynamic AP tracking already exists separately — see §3.5) | n/a | `ap_formula_at_thresholds` |
| Power | `core` (formula: base 4 + Athletics≥Novice + Combat≥Adept) | n/a | Skill-rank ordinal comparison, `core` p. 33 scale | Computed | same command | not built | n/a | `power_formula_thresholds` |
| High Jump / Long Jump / Overland / Swim / Throwing Range | `core` (formulas, T15A scope text) | n/a | All round-down; High Jump running-start is a situational +1, never folded into base | Computed | same command | not built | n/a | 6 dedicated tests |
| Trainer Size | `core` (Medium, constant) | n/a | n/a | `TRAINER_SIZE` constant, not a field | same command; `TrainerCoreResult.size` | not built | n/a | implicit in serialization test |
| Trainer Weight Class | `core` Step 6 (55-110=WC3, 111-220=WC4, 221+=WC5) | n/a | Below 55 lb has no Trainer-specific band in the cited source — **[G6]** T15B does not extrapolate the general/Pokémon chart downward; typed validation issue instead | Computed from `weight_lb` | same command; `TrainerCoreResult.weight` | not built | `TRAINER_WEIGHT_BELOW_SUPPORTED_RANGE` | boundary tests §3.1 above |
| Carry Capacity | mockup shows "38 / 60" (`trainer_dashboard.png`) | — | **[G7]** No formula for Carry Capacity is present in any supplied dataset. It is plausibly Strength/Power-derived in real PTU, but T15A's own scope explicitly lists Power's formula without mentioning Carry Capacity, and no other source ties the two — not invented here | not modeled | — | shown in mockup only | — | — |
| Accuracy | T15A scope: "not one of the six persisted Combat Stats… reported only from combat-stage/modifier state" | n/a | n/a — no base formula exists or is claimed | `CombatState.combat_stages.accuracy: i64` (already exists, generic combat-stage delta, not a Step-6 base) | `resolve_modifier_value` (generic) | `CombatTab.tsx` shows Pokémon combat stages including accuracy today; Trainer-side not built | n/a | none dedicated |

### 3.4 Skills

| Field | Src | Creation rule | Derivation & rounding | Persist. | Cmd/VM | UI surface | Validation | Test vectors |
|---|---|---|---|---|---|---|---|---|
| Skill ranks (17 skills: Acrobatics, Athletics, Combat, Intimidate, Stealth, Survival, General/Medicine/Occult/Pokémon/Technology Education, Guile, Perception, Charm, Command, Focus, Intuition) | `core` p. 33 (rank scale, ordinal `Pathetic=1…Master=6`, authoritative — implemented in `trainer_core::SkillRank`); skill list (names only) from `seed/json/rule_vocabulary.json` | Player-entered per skill, background raises/lowers named skills | A skill absent from the map defaults to `Untrained` (PTU's own baseline, not fabricated) | `TrainerProfile.skills: Value` (`trainers.skills_json`) — generic map, shape `{"<skill_id>": {"base_rank": "<rank>"}}` per `fixtures/trainer_profile_full.json`, **already the format T15A's `skill_rank()` reads** | `resolve_trainer_core_stats` reads it for Power/Jump/Overland/Swim/Throwing Range; no dedicated skill-editing command yet — **[G8]** only whole-profile `save_trainer` can change it today | not built | none | `trainer_core::tests::skill_rank_*` (4 tests) |
| — *dataset consistency note* | `seed/json/rule_vocabulary.json`'s own `skill_ranks` enum (`untrained:0 … master:5`) does **not** match the `core` p. 33 ordinal above (`Pathetic=1 … Master=6`) — different value scale *and* different lowest-rank ordering (that file omits `Pathetic` and puts `Untrained` at 0). **[G-SKILLRANK]** — see §6 for impact/owning task. T15A's cited ordinal remains authoritative and unchanged; nothing here alters `trainer_core::SkillRank` or any dataset. | n/a | n/a | n/a — the inconsistency is between two *source* artifacts, not a persisted field | n/a | n/a | n/a | n/a |
| Skill check bonus (dice/rank display) | `core` (per-skill dice-by-rank table) | n/a | **[G9]** No dice-by-rank table (e.g. "Novice = 3d6") is present in any supplied dataset — only the ordinal ranking (§3.4 above) is sourced | n/a | n/a | mockup doesn't show raw dice, only rank labels + numeric total (`trainer_dashboard.png`'s Skills panel shows values like "42", "48" — unclear if that's a rank-derived roll total or something else; **not reproducible from any cited source, flag before implementing** | — | — |

### 3.5 Health, Injuries, Status (dynamic combat state — already modeled, existing)

| Field | Src | Persist. | Cmd/VM | UI surface | Notes |
|---|---|---|---|---|---|
| Current HP / Temp HP | spec §13 | `CombatState.current_hp/temp_hp: Option<i64>` (`combat_states` table, owner_type='trainer') | `save_trainer`/`load_trainer`; no dedicated HP-adjust command — **[G10]**, whole-profile save only | `CombatTab.tsx` shows the value, no editor | Nullable = "no combat state recorded yet," matches spec 37 |
| AP current/bound/drained | spec §13 | `CombatState.ap_current/ap_bound/ap_drained: Option<i64>` (same table) | same | `CombatTab.tsx` | Distinct from T15A's derived AP *ceiling* (§3.3) — this is the dynamic *current* track |
| Combat Stages (atk/def/spatk/spdef/spd/acc/eva deltas) | spec §13 | `CombatState.combat_stages: CombatStages` (JSON column) | `resolve_modifier_value` (generic) | `CombatTab.tsx` via `StatBadge` | Existing, functional |
| Statuses | spec §13 | `CombatState.statuses: Vec<String>` | same | `CombatTab.tsx` | Free-text list, no duration/structure — same shape gap as Pokémon (§4.6) |
| Injuries (Trainer-level) | spec §7 lists "HP/temp HP/injuries/combat state" for Trainer | **[G11]** `CombatState` has no `injuries` field (Pokémon's `PokemonInstance.injuries: i64` exists; Trainer's does not) | — | — | — |

### 3.6 Moves, Abilities, Edges, Features, Capabilities (Trainer-owned collections — existing, reusable)

| Field | Src | Persist. | Cmd/VM | UI surface | Test vectors |
|---|---|---|---|---|---|
| Trainer Moves (unlimited list, spec §7) | `core` | `TrainerProfile.moves: Vec<Value>` (`trainer_moves` table, `definition_version_id` ref only, no size cap) | `add_trainer_collection_entry`/`remove_trainer_collection_entry`("moves") | `OverviewTab.tsx` via `CollectionManager` | `profile::repository::tests::add_collection_entry_*` |
| Trainer Edges | `core` | `TrainerProfile.edges: Vec<Value>` (`trainer_edges`) | same, collection="edges" | same | same pattern |
| Trainer Features | `core` | `TrainerProfile.features: Vec<Value>` (`trainer_features`) | same, collection="features" | same | same pattern |
| Trainer Abilities | `core` | `TrainerProfile.abilities: Vec<Value>` (`trainer_abilities`) | same, collection="abilities" | same | same pattern |
| Trainer Capabilities | `core` | `TrainerProfile.capabilities: Vec<Value>` (`trainer_capabilities`) | same, collection="capabilities" | same | same pattern |
| Weapon Move PP tracking | mockup shows "Strike 25/25" | **[G12]** `usage_counters` table exists generically (owner/resource_key/scope/uses_remaining) but no Trainer-move-PP-specific wiring confirmed in current UI | — | `OverviewTab.tsx`'s "WEAPON MOVES" mockup region is unimplemented | — |

### 3.7 Equipment & Inventory (existing, reusable)

| Field | Src | Creation rule | Persist. | Cmd/VM | UI surface | Validation | Test vectors |
|---|---|---|---|---|---|---|---|
| Equipment slots | `core` §10 — "data-driven but seed with PTU slots such as Head, Body, Main Hand, Off-Hand, Feet, Accessory" | Player equips an item | `InventoryRecord.equipped: HashMap<String,String>` (`equipment_slots` table, slot_key free-text today — **[G13]** the canonical 6-slot set is spec-named but not enforced as a closed enum) | `equip_item`/`unequip_slot` | `InventoryTab.tsx` — free-text slot key input today, not the 6 fixed slots the mockup shows | none | `engine::equipment::tests::*` (2 passing) |
| Backpack | `core` §10 | Purchases/grants add stacks | `InventoryRecord.backpack: Vec<ItemStack>` (`inventory_stacks`, location='backpack') | `checkout_buy`/`checkout_sell` | `InventoryTab.tsx` | atomic checkout | `engine::shop::tests::*` (7 passing) |
| Item Storage | `core` §10 | — | `InventoryRecord.storage: Vec<ItemStack>` (location='storage') | none dedicated yet — **[G14]** no move-item-to-storage command exists (Pokémon storage transfer exists; item storage transfer does not) | not built | — | — |
| Held-item-return-on-storage invariant | `core` §10 — "If a Pokémon enters Storage, its Held Item returns to the Trainer backpack" | Automatic | n/a (behavior) | `transfer_to_storage` → `StorageTransferOutcome.held_item_returned` | `PokemonTab.tsx` | atomic, tested | `engine::storage::tests::healthy_pokemon_transfer_returns_item_and_clears_battle_state` |

### 3.8 Rosters (existing, reusable)

| Field | Src | Persist. | Cmd/VM | UI surface | Test vectors |
|---|---|---|---|---|---|
| Roster (name/active/max_members/rules) | `core` §9 | `RosterRecord` (`rosters` table) | `add_roster`, `add_roster_membership`/`remove_roster_membership` | `PokemonTab.tsx` (nested); no top-level `/rosters` route yet (T13R2 shipped an honest `ComingSoon` placeholder there) | `engine::roster::tests::*` (4 passing) |
| Roster "kind" badge (COMBAT/COMPANY/MOUNT) | derived from `rules: {combat, personal_use, trade, mount}` — already a real field, spec §9's own example | Computed from `rules`, not a new field | same | display-logic gap only, not a data gap | none | — |

### 3.9 GM Grants, Progression Ledger, Timeline, NPCs (existing, reusable)

| Field | Src | Persist. | Cmd/VM | UI surface | Test vectors |
|---|---|---|---|---|---|
| GM Grants (fixed/resource) | spec §16 | `TrainerProfile.gm_grants: Vec<Value>` (`trainer_gm_grants`) | `record_gm_override`, `reallocate_resource_grant`; now also the modifier source for T15A stat resolution (§3.3) | `OverviewTab.tsx` | `engine::respec::tests::*`, `trainer_core::tests::gm_grant_modifiers_are_parsed_only_for_matching_fixed_target` |
| Progression ledger | spec §17.1/§18 | `TrainerProfile.progression: Vec<Value>` (`trainer_progression`) | see §3.2 | `OverviewTab.tsx` (partial) | — |
| Timeline/History | spec §18 | `TrainerProfile.timeline: Vec<Value>` (`history_events`) | `append_history_event` (via `record_gm_override`) | not surfaced in UI yet | `profile::repository::tests::append_history_event_*` |
| NPCs | spec §12 | `TrainerProfile.npcs: Vec<Value>` (`npcs` table) | none dedicated yet — **[G15]**, only whole-profile save | not built (T18 territory, `T13R1_DESIGN_CONTRACT.md` §7 already assigns NPC Journal to T18) | — |

### 3.10 Temporary Modifiers (mockup: "Well Rested +5% XP 29m", "Training Focus +5% Acc 14m", "Minor Injury -5% SpA 14m")

| Field | Src | Gap |
|---|---|---|
| Duration-bearing temporary modifier | none of `GmGrant`, `Modifier`, or any dataset carries an expiry/duration field | **[G16]** — T15A's own doc comment already disclosed this: *"a duration-bearing modifier is not the same shape as a `GmGrant`... this is T15/engine scope."* Confirmed still true; no schema change made in T15B (audit only). |

---

## 4. Pokémon (owned-instance) Sheet Matrix

### 4.1 Identity

| Field | Src | Creation rule | Persist. | Cmd/VM | UI surface | Gap |
|---|---|---|---|---|---|---|
| Species/Form | spec §8.1 | Selected at add-time | `PokemonInstance.species_definition_id: String` (not null) | `add_pokemon`; resolved via `resolve_definition("species", ...)` | `PokemonTab.tsx` | none |
| Nickname | spec §8.2 | Optional at add-time | `PokemonInstance.nickname: Option<String>` | `add_pokemon` | `PokemonTab.tsx` | none |
| Type(s) | species definition (`types: string[]`, ≤2) | n/a — resolved, not entered | Not duplicated on the instance (correct — always resolve from species) | `resolve_definition` | `PokemonTab.tsx`, `TypeBadge` | none |
| Gender | spec §8.2 lists it as persisted | Player-entered at add-time (or determined by species `gender_ratio`) | **[G17]** not modeled on `PokemonInstance` at all | — | mockup shows a gender icon (`creature_sheet_mockup.png`) | — |
| Nature | spec §8.2 lists it as persisted | Player/GM-selected | **[G18]** not modeled; also no Nature-name-to-stat-modifier table found in any supplied dataset | — | mockup shows "Timid (+Spe, -Atk)" | — |
| OT (Owner Trainer) | implicit via `trainer_id` FK on `pokemon_instances` | n/a | Already correct — a Pokémon's owner is the row's `trainer_id`, no separate field needed | `load_trainer`/`add_pokemon` | mockup shows "OT: Alex Rowan" | not a gap — already modeled correctly, just not surfaced by name in current UI |
| ID No. / Dex No. | species' `national_dex_number: Option<i64>` (nullable per §1.3's schema — populated only where the source PDF's page order supports it, per `KNOWN_GAPS_v1.0.md` item 2) | n/a | Species-side, resolved | `resolve_definition` | not built | Known, already-disclosed gap (National Dex numbering), not new |
| Custom image/portrait | spec §20 | Player-uploaded | `pokemon_instances.portrait_media_id: TEXT` column **already exists in the migration** (verified in `persistence/profiles.rs`) — **[G19]** column exists but no read/write path wired in `model.rs`/`repository.rs`/commands yet | — | mockups show sprite art everywhere | Schema is ready; wiring is the gap |

### 4.2 Level, EXP, Progression

Columns: Field | Source | Creation/entry rule | Derivation & rounding | Progression trigger/choice | Modifiers & stacking/provenance | Persistence (owner/type/null/default) | Command/View-model | UI surface & editable state | Validation/error behavior | Test vectors | Gap/owner.

| Field | Source | Creation/entry rule | Derivation & rounding | Progression trigger/choice | Modifiers & provenance | Persistence | Cmd/VM | UI surface & editable state | Validation | Test vectors | Gap/owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Level | `pokemon_progression_rules.json` (`ptu-core-1.05`, 1 record) | Set at `add_pokemon` time (player-chosen starting level) | n/a — direct value | XP threshold or GM-applied change (no auto-trigger wired — see EXP row) | n/a — level itself is never modifier-adjusted | `PokemonInstance.level: i64` (`pokemon_instances.level`, not null) | `apply_pokemon_level`, `validate_pokemon_level`, `level_up_pokemon` | `PokemonTab.tsx`'s per-Pokémon "Level up to" form — **editable, existing** | `validate_pokemon_level` → typed `ValidationIssue` (below-min non-overridable; above-ruleset-max overridable) | `engine::progression::tests::pokemon_level_*`, `engine::validation::tests::*` | none |
| EXP | `pokemon_experience.json` (100 records, level↔cumulative-EXP curve — the Pokémon-side curve T15A's Trainer-side scope has no equivalent for) | Set at `add_pokemon` time or GM-tracked | Table lookup, not a formula | Crossing a cumulative-EXP threshold is what the dataset defines as a level trigger | n/a | `PokemonInstance.exp: Option<i64>` (`pokemon_instances.exp`, nullable — `None` ≠ 0) | none — no command reads this dataset today | not built | none built | none | **[G20]** unused by any command; T14/T16 |
| Stat Points awarded per level | `pokemon_progression_rules.json` | n/a — computed per level-up event, not entered | `stat_points_per_level_up` — flat, dataset-driven, no rounding involved | Fires on every level-up (not level-varying, unlike the Trainer dataset) | n/a | Computed, not persisted (an award count, not a running total — see allocation gap in §4.3) | `resolve_pokemon_level_up` → `PokemonLevelUpResult.stat_points_awarded` | not built — nothing consumes the awarded count yet | none | `pokemon_level_5_matches_fixture`, `pokemon_level_20_matches_fixture` | awarded but has nowhere to be spent — see §4.3 **[G23]** |
| Tutor Points | spec §8.2 (persisted) + `pokemon_progression_rules.json.tutor_point_levels_rule` (trigger text, sourced) | n/a | Trigger text parsed (existing `tutor_point_awarded_at` divisible-by-N parse in `progression.rs`) | Fires at the levels the rule text names | n/a | **[G21]** no `PokemonInstance` field accumulates a running balance — award is computed per event, never summed/stored | `resolve_pokemon_level_up` → `PokemonLevelUpResult.tutor_point_awarded: bool` (per-event only) | not built | none | `pokemon_level_5_matches_fixture` (trigger only, not balance) | **[G21]** never accumulated/persisted; T14 |
| Ability unlock | `pokemon_progression_rules.json.ability_unlock_levels` | n/a | Direct membership check against the level list | Fires at the listed levels | n/a | Computed, not persisted (a per-event flag) | `resolve_pokemon_level_up` → `PokemonLevelUpResult.ability_unlock: bool` | not built — no ability-slot-unlock picker exists | none | `pokemon_level_20_matches_fixture` | unlock signal exists; picker UI is T17 (species ability-slot selection, per `T12_CONTENT_COVERAGE_REPORT.md`'s note that no UI selects from a species' ability slots yet) |
| Evolution eligibility | `ptu_evolution_edges.json`/`ptu_evolution_families.json` (species-side, 486+547 records in `ptu-gen8ish-pokedex` alone) | n/a | n/a — graph lookup, not arithmetic | `check_moves_and_evolution: bool` flag fires per level-up (dataset-driven); graph traversal itself is not wired to it | n/a | Species-side graph data; no Pokémon-instance "pending evolution" field | `resolve_pokemon_level_up` → flag only; no evolution-check command | not built | none | none dedicated to the graph-traversal check | **[G22]** eligibility check not wired to the graph datasets; T17 |
| **Base Stat Relation (BSR)** — Pokémon stat-point-to-value conversion | `core` §17.2: "must validate Base Stat Relation according to active ruleset" | n/a | **No formula exists** — re-confirmed live in T15B; every "BSR" mention in the actual shipped data is narrative prose inside an Ability/Poké-Edge `raw_text`/`effect_text` field, never a structured table (matches `engine::progression.rs`'s own pre-existing disclosed-gap doc comment) | Would gate Stat Point spending validity at every level-up per spec — currently unenforced | n/a | n/a — nothing to persist without a formula | none | not built | **none — this is exactly the missing validation the spec requires and no source supplies** | none (cannot be tested without a formula) | **[G-BSR]** blocks all of §4.3's Combat Stats; flag to Planner |

### 4.3 Combat Stats & Max HP

| Field | Src | Gap |
|---|---|---|
| Base Stats (species) | `pokemon-species-v0.5.schema.json` declares `base_stats: object` | **Already disclosed, re-confirmed live**: `app/src/components/PokemonMoveResolver.tsx`'s own comment states *"today's imported catalog packs carry empty `base_stats` for every species (a real content gap, not a bug here)"*; `DefinitionDetail.tsx`/its test reference a `missing_mechanical_fields` self-declaration array (e.g. `["base_stats", "ability_slots"]`) that species records already carry precisely so the UI can disclose this per-species. **No T15B action needed — already correctly disclosed** in shipped code with a visible `callout-warning` fallback. |
| Stat Point allocation (instance) | spec §8.2: "stats and stat-point allocation" persisted per Pokémon | **[G23]** `PokemonInstance` has **no** allocation field at all — not even the T15A-style ledger shape exists for Pokémon. Building it requires (a) the BSR formula (**[G-BSR]**, above) and (b) real species `base_stats` (blocked, above) — both prerequisites are missing, so this cannot be a T15-scope slice the way T15A was for Trainers until at least one is resolved. |
| Resolved Attack/Defense/Sp.Atk/Sp.Def/Speed/HP | `core` (Pokémon stat formula, BSR-dependent) | Same **[G-BSR]**/**[G23]** blockers — no resolver can be written until an authoritative formula or a Planner-approved alternative (mirroring T15A's own "player-entered base" resolution path, offered as an option in the T15A Worker Result and not yet decided) exists. |
| Max HP | `core` (Pokémon formula, distinct from the Trainer formula T15A implemented) | **[G24]** — not the same formula as Trainer Max HP; no Pokémon-specific Max HP formula found in any supplied dataset either. |
| Combat Stats display in mockup (`creature_sheet_mockup.png`: HP 48, Atk 24, Def 22, SpAtk 41, SpDef 27, Spe 44) | mockup only | Illustrative fictional values per A15 — **not a source**, cannot be used to reverse-engineer a formula (explicitly forbidden by T15B's own Implementation Constraint: "never infer a formula from a mockup"). |

### 4.4 Temporary Stages, Status, Health (dynamic — existing, reusable)

Columns: Field | Source | Creation/entry rule | Derivation & rounding | Progression trigger/choice | Modifiers & stacking/provenance | Persistence (owner/type/null/default) | Command/View-model | UI surface & editable state | Validation/error behavior | Test vectors | Gap/owner.

| Field | Source | Creation/entry rule | Derivation & rounding | Progression trigger/choice | Modifiers & provenance | Persistence | Cmd/VM | UI surface & editable state | Validation | Test vectors | Gap/owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Current HP / Temp HP | spec §8.2 | No command currently creates a fresh `BattleState` for a newly added Pokémon — it stays `None` until something writes one (only whole-profile `save_trainer` can) | n/a — direct tracked values | n/a | Combat Stages (below) apply as deltas during combat; no direct modifier chain confirmed for HP itself | `BattleState.current_hp/temporary_hp: i64` inside `PokemonInstance.battle_state: Option<BattleState>` (`combat_states` table, owner_type='pokemon') — the row is optional, not the fields once it exists | `save_trainer`/`load_trainer` (whole-profile) only | `CombatTab.tsx` displays `p.battle_state.current_hp` when present — **read-only display, no editor** | none built | round-trip tests only | **[G25]** no per-Pokémon HP-adjust command; T15/T17 |
| Combat Stages | spec §8.2/§13 | Defaults to all-zero within a `BattleState` (`CombatStages` derives `Default`) | n/a | n/a | Adjusted via the generic modifier engine (`resolve_modifier_value`) — existing, functional, generic across any numeric target | `BattleState.combat_stages: CombatStages` (JSON column inside `combat_states`) | `resolve_modifier_value` (generic, not Pokémon-stage-specific) | `CombatTab.tsx` renders active (non-zero) stages via `StatBadge` — **display-only, no stage-adjustment control** | none | `engine::modifier::tests::*` (generic engine coverage; no Pokémon-stage-specific vector) | display exists; a stage-adjustment control is T15/T17 (same class as G25, not separately numbered) |
| Status Conditions | spec §8.2/§13 | Defaults to an empty list | n/a | n/a | Free-text strings only — no structured source/duration provenance | `BattleState.statuses: Vec<String>` — no duration/structure | none dedicated | `CombatTab.tsx` displays the joined string list — **read-only, no add/remove/duration control** | none | none dedicated | **[G26]** unstructured (shared with Trainer statuses, §3.5); T15 |
| Injuries | spec §8.3 (storage invariant) | Defaults to 0 at `add_pokemon` | n/a — direct counter | n/a | n/a | `PokemonInstance.injuries: i64` (`pokemon_instances.injuries`, `NOT NULL DEFAULT 0`) — **already typed, already enforced** | No direct injury-adjust command found; enforced as a *precondition* by `transfer_to_storage` | `PokemonTab.tsx` displays `injuries > 0` as a warning callout — **read-only display; no increment/decrement control** | `transfer_to_storage` refuses an injured Pokémon (existing, tested) | `engine::storage::tests::injured_pokemon_is_rejected_with_no_override_path` | invariant fully modeled; a direct injury-editing control is T15/T17 (not separately numbered) |

### 4.5 Held Item, Loyalty, Capabilities, Skills

Columns: Field | Source | Creation/entry rule | Derivation & rounding | Progression trigger/choice | Modifiers & stacking/provenance | Persistence (owner/type/null/default) | Command/View-model | UI surface & editable state | Validation/error behavior | Test vectors | Gap/owner.

| Field | Source | Creation/entry rule | Derivation & rounding | Progression trigger/choice | Modifiers & provenance | Persistence | Cmd/VM | UI surface & editable state | Validation | Test vectors | Gap/owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Held Item | spec §8.2/§10 | `None` at `add_pokemon`; auto-cleared to backpack on storage transfer (existing invariant) | n/a | n/a | Held items can carry structured item-level modifiers (per an Item definition's own effect fields, spec §10) — not yet wired into any Pokémon-stat resolver | `PokemonInstance.held_item_id: Option<String>` — field exists, nullable | **[G27]** no `set_held_item`/`assign_held_item` command exists anywhere (confirmed by repo-wide search; same finding already recorded in `T13R1_DESIGN_CONTRACT.md` §8.6) | not built — the mockup's "Assign Held Item" wizard has no backing command to call | none built (would need e.g. "item must be `usable_by: Pokemon`" per spec §10) | none | **[G27]**; T17 |
| Loyalty | spec §8.2 (persisted permanent state) | n/a — not modeled | n/a | n/a | n/a | **[G28]** not modeled on `PokemonInstance` at all | none | not built | none | none | **[G28]**; T14 |
| Permanent Capabilities (instance-level, distinct from species baseline) | spec §8.2 | Added via collection-entry commands, referencing a Capability definition by id | n/a — direct reference, resolved for display | Typically granted by a Poké Edge or GM grant, not level-triggered by default | Reference-only; no stacking concern (present or not) | `PokemonInstance.capabilities: Vec<Value>` (`pokemon_capabilities` table) — **existing, reusable, no size cap** | `add_pokemon_collection_entry`/`remove_pokemon_collection_entry`("capabilities") | `PokemonTab.tsx` via `CollectionManager` — **existing, functional, add/remove** | implicit "must resolve to a real definition" check only | `profile::repository::tests::add_collection_entry_*` (generic collection coverage) | none |
| Species baseline Capabilities | species definition's own `capabilities` field (schema-permitted; population depends on the species record, same class as `ability_slots`) | n/a — inherited from species, not entered per instance | n/a — resolved display | n/a | n/a | species-side (content database, not the Trainer profile) | `resolve_definition("species", ...)` | Read-only display wherever species detail is shown (`DefinitionDetail.tsx`) | none | none new | none new — inherits whatever completeness the species record itself carries (per `mechanical_completeness`/`missing_mechanical_fields`) |
| Skills (instance) | spec §8.2: "skills and permanent skill adjustments" | n/a — not modeled | n/a | n/a | n/a | **[G29]** not modeled on `PokemonInstance` at all — Trainer skills exist (§3.4), Pokémon-instance skills do not | none | not built | none | none | **[G29]**; T14 |

### 4.6 Moves, Abilities, Poké Edges (existing, reusable)

| Field | Src | Persist. | Cmd/VM | UI surface | Test vectors |
|---|---|---|---|---|---|
| Learned Moves + move source | spec §8.2 | `PokemonInstance.moves: Vec<Value>` (`pokemon_moves`, `definition_version_id` ref) | `add_pokemon_collection_entry`/`remove_pokemon_collection_entry`("moves") | `PokemonTab.tsx`, resolved via `PokemonMoveResolver.tsx` — **the flagship "resolved without re-entry" pattern, already working** | `content::authoring`/collection tests |
| Move PP / frequency-use counters | spec §13 | `usage_counters` table exists generically (owner/resource_key/scope) | `record_usage`, `next_round`/`end_scene`/`new_day` (reset scopes) — **existing, functional, generic** | `CombatTab.tsx` combat controls | `engine::combat_reset::tests::*` (3 passing) |
| Abilities | spec §8.2 | `PokemonInstance.abilities: Vec<Value>` (`pokemon_abilities`) | same collection pattern | `PokemonTab.tsx` | same pattern |
| Poké Edges | spec §8.2 | `PokemonInstance.poke_edges: Vec<Value>` (`pokemon_poke_edges`) | same collection pattern, collection="poke_edges" | `PokemonTab.tsx` | same pattern; note this collection is **Pokémon-only** — `trainer_collection_table("poke_edges")` returns `None` by design, verified by `repository::tests::collection_table_lookups_reject_unknown_names` |

### 4.7 Storage, Roster Relation (existing, reusable)

Columns: Field | Source | Creation/entry rule | Derivation & rounding | Progression trigger/choice | Modifiers & stacking/provenance | Persistence (owner/type/null/default) | Command/View-model | UI surface & editable state | Validation/error behavior | Test vectors | Gap/owner.

| Field | Source | Creation/entry rule | Derivation & rounding | Progression trigger/choice | Modifiers & provenance | Persistence | Cmd/VM | UI surface & editable state | Validation | Test vectors | Gap/owner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Storage state (carried/stored) | spec §8.3 | Defaults to `carried` at `add_pokemon` | n/a | n/a | n/a | `PokemonInstance.storage_state: StorageState` (SQL `CHECK IN ('carried','stored')`, not null) | `transfer_to_storage`/`transfer_to_carried` | `PokemonTab.tsx` — **existing, functional toggle button** | `transfer_to_storage` refuses when `injuries > 0` (existing invariant, §4.4) | `engine::storage::tests::*` (3 passing) | none |
| Roster memberships | spec §9 — "may belong to multiple rosters" | Empty at `add_pokemon` unless specified | n/a | n/a | n/a | `PokemonInstance.roster_memberships: Vec<String>` (`roster_memberships` join table) | `add_roster_membership`/`remove_roster_membership` | `PokemonTab.tsx` — **existing, functional checkbox-per-roster** | `max_members` capacity enforced (existing) | `engine::roster::tests::*` (4 passing) | none |
| Capture Ball | spec §8.2 | Set at `add_pokemon` time (or `None`) | n/a | n/a | n/a | `PokemonInstance.capture_ball_item_id: Option<String>` | `add_pokemon`; no dedicated setter to change it after creation | not displayed/edited in current UI beyond the initial add form | none | round-trip only | not separately numbered — post-creation ball change is a minor omission folded into T14's general "complete Pokémon instance field" scope |

### 4.8 Explicitly out of scope for the Pokémon sheet (per plan text, not gaps to close)

| Field | Reason |
|---|---|
| Terrain & Weather (shown on `creature_sheet_mockup.png`) | Scene-level state, not Pokémon-owned — `T13R1_DESIGN_CONTRACT.md` §8.4 already classified this as "out of current spec scope; flag to Planner if pursued, do not invent." Confirmed still correct; no Trainer/Pokémon/scene model change proposed here. |
| Last Battle summary | Projection over `TrainerProfile.timeline` (spec §18's generic history) — **[G30]** no typed "battle summary" view exists; same class of gap as §3.9's Timeline row. |

---

## 5. Illustrative-Only / Excluded Fields (both sheets)

Per plan §11 and `T13R1_DESIGN_CONTRACT.md` §11, re-confirmed here with no additions or removals: **Wins, Rating, Badges (achievement count), PTU Points, Tamer Rank (numeric)/Region/ID No./Guild/Join Date, Carry Capacity (§3.3 — reclassified in this audit as an unsourced-formula gap rather than purely illustrative, since it's plausibly real but unsourced, not fictional-flavor), NPC relation-hearts/Last-Seen-location/Partner-reference, Terrain & Weather, storage "Box" as a persisted unit.** None of these were promoted into a schema requirement by this audit.

---

## 6. Follow-Up Task Derivation

| Gap | Summary | Blocks | Owning task |
|---|---|---|---|
| G-LIC | No redistribution-license text for the 11 PTU PDFs / external registries | Public/commercial release only — not offline dev use | Flag to Planner/ownership; not a coding task |
| G-KNIGHT | `campaign-homebrew-knight` pack's source not in the primary registry | Nothing blocking today (already lowest/homebrew precedence) | T15B follow-up note only |
| G-SKILLRANK | `seed/json/rule_vocabulary.json`'s `skill_ranks` enum (`untrained:0…master:5`) disagrees with the `core` p. 33 / T15A-authoritative ordinal (`Pathetic=1…Master=6`) — different scale and different lowest-rank ordering | **Impact:** none today — `trainer_core::SkillRank` (T15A, tested) never reads this file; the only current consumer of `rule_vocabulary.json`'s `skill_ranks` field is documentation/reference. Risk is *future*: a later task building a Skills UI, a homebrew skill-rank dataset, or any rank comparison outside `trainer_core` could read the stale/inconsistent file instead of the authoritative enum and silently produce wrong Power/Jump/Overland/Swim/Throwing Range results or mis-ordered rank comparisons. **T15A's `Pathetic=1…Master=6` stays authoritative; not changed here.** | Flag to Planner as a content/data-quality correction (annotate or correct `rule_vocabulary.json`, or add a comment pointing to `trainer_core::SkillRank` as the single source of truth) — smallest fit is whichever task next builds a Skills-rank-consuming surface outside T15A, i.e. **T14** (owns the Skills panel per G8/G29 routing above); it should correct/deprecate the file's `skill_ranks` field rather than consume it as-is. Not a code change in this correction. |
| G1 | Trainer Gender/Age/Height not modeled | T14 dashboard completeness | T14 |
| G2 | No `weight_lb` setter command | T13R3 can't let a player enter weight | T13R3 (minimal) or T14 (full) |
| G3 | `media_assets` exists but no Trainer-portrait wiring | Portrait upload UI | T14 |
| G4 | No Trainer XP→level curve dataset | Confirms T15A's "never infer from XP" design is correct, not a defect | none — working as intended |
| G5 | Milestone bonus-stream amounts not formulaic | Full milestone auto-apply | T16 (guided level-up wizard) |
| G6 | Trainer Weight Class general-chart lower bound | Rare out-of-range Trainer builds only | T16/T14 if it ever occurs in practice |
| G7 | Carry Capacity formula unsourced | Backpack weight-limit UI | Flag to Planner — needs a cited source before any task claims it |
| G8 | No skill-editing command | Skill allocation UI | T14/T16 |
| G9 | No skill-rank dice/roll table sourced | Any UI showing a roll formula for skills | Flag to Planner |
| G10 | No Trainer HP-adjust command | Combat HP tracking UI | T15 (full combat mechanics) or T17 |
| G11 | No Trainer `injuries` field | Trainer injury tracking parity with Pokémon | T14 |
| G12 | No Trainer-move PP wiring (generic `usage_counters` exists) | Weapon Move PP display | T14/T15 |
| G13 | Equipment slot key is free text, not the canonical 6-slot enum | Equipment grid UI matching the mockup exactly | T14 |
| G14 | No item-storage transfer command | Storage screen's Item Storage tab | T17 |
| G15 | No dedicated NPC CRUD commands | NPC Journal | T18 (already assigned in `T13R1_DESIGN_CONTRACT.md`) |
| G16 | No duration-bearing modifier shape | Temporary Modifiers panel | T15 (already self-disclosed by T15A) |
| G17 | Pokémon Gender not modeled | Creature sheet identity | T14 |
| G18 | Pokémon Nature not modeled, no Nature-effect table sourced | Creature sheet identity + any Nature-driven stat modifier | T14 (field) + flag to Planner (formula) |
| G19 | `portrait_media_id` column exists, unwired | Creature portrait | T14 |
| G20 | Pokémon EXP curve dataset unused by any command | XP-driven leveling UI | T14/T16 |
| G21 | Tutor Points never accumulated/persisted | Tutor Point spending UI (e.g. Poké Edges) | T14 |
| G22 | Evolution eligibility check not wired to the evolution graph datasets | Evolution UI | T17 |
| G-BSR | Base Stat Relation formula absent from all supplied sources (pre-existing, re-confirmed) | **All** Pokémon Combat Stat resolution | Flag to Planner — same class of decision T15A's Worker Result already raised for Trainers (cite a real source, or approve a player-entered-base model) |
| G23 | No Pokémon stat-point allocation field at all | Pokémon Combat Stats | Blocked on G-BSR; Planner decision needed before scoping |
| G24 | Pokémon Max HP formula unsourced | Pokémon HP display | Blocked on G-BSR |
| G25 | No per-Pokémon HP-adjust command | Combat HP tracking | T15/T17 |
| G26 | Status conditions are unstructured strings (both Trainer and Pokémon) | Duration-aware status display | T15 |
| G27 | No held-item-assignment command | Assign Held Item wizard | T17 (already flagged in `T13R1_DESIGN_CONTRACT.md` §8.6) |
| G28 | Pokémon Loyalty not modeled | Creature sheet | T14 |
| G29 | Pokémon instance Skills not modeled | Creature sheet skills panel | T14 |
| G30 | No typed "Last Battle" projection over timeline | Creature sheet "Last Battle" panel | T14/T15 |

**No gap in this list was closed by fabricating a formula, default, or field.** Every row above either cites its source or explicitly says none was found.

---

## 7. Validator Evidence (run fresh in this session, before and after writing this document — no production file changed)

* `git status` before and after this task: **identical** — only `T15B_SHEET_CONTRACT_MATRIX.md` was added; every T15A/T13R2/checkpoint file is untouched.
* `cargo test -p ptu-domain --test content_coverage_baseline -- --nocapture` — **3/3 pass**, live against the actual 18 shipped `.ptucp` packs (not the superseded `seed/json/` snapshots): 39 unresolved move refs / 1 unresolved ability ref / 22 unresolved capability refs, matching `T12_CONTENT_COVERAGE_REPORT.md` exactly — confirms that report is still current.
* `cargo test` (full domain crate, unit + integration) — **all pass** (130 lib unit tests including every T15A test, +8 integration tests across 4 files), confirming T15A's contract is intact and this audit changed nothing.
* Schema validation tests (`content::schemas::tests::*`) — passing, part of the full-suite run above.
* Pack-resolution precedence tests (`content::resolver::tests::*`, 6 tests) — passing, cited directly in §2 as the actual enforced-precedence evidence.
* Species reference-integrity test (`every_species_reference_is_resolved_or_a_documented_gap`) — passing, re-confirms the 39/1/22 unresolved-reference allowlist from §1.3/T12 is current.

---

## 8. Acceptance Criteria Self-Check

| T15B acceptance criterion | Status |
|---|---|
| Every visible/editable field maps to all required matrix columns or is explicitly excluded with reason/source/owning task; zero decorative/uncontracted fields | ✅ §3-§5 — every field from `T13R1_DESIGN_CONTRACT.md`'s screen matrix appears exactly once, with a source citation, a persistence/command mapping, or an explicit `[Gn]` gap + owning task in §6 |
| Core/Pokédex/supplement/errata/playtest/catalog/campaign-homebrew provenance distinguishable with documented precedence | ✅ §1-§2, backed by both the source registry data and the actual passing resolver-precedence tests |
| Creation, level-up/evolution, derived values, modifier application, persistence, UI ownership traceable end-to-end from citation to test vector | ✅ for every row with a real source (T15A rows cite the exact test names); explicitly **not** claimed for gap rows — they say so |
| Content-pack coverage/gaps evidenced by stable identifiers/counts, not filenames | ✅ §1.3 uses `content_pack_registry.json`'s ids/hashes/record counts, cross-verified live in §7 |
| Every conflict/gap blocks only its dependent field/flow and names the smallest follow-up task; nothing invented to complete the matrix | ✅ §6 — 30 numbered gaps + G-LIC/G-KNIGHT/G-BSR, each with a scoped owner; **G-BSR is the one gap with the widest blast radius** (blocks the entire Pokémon Combat Stats section) and is flagged as a Planner decision, not silently worked around |
| Reviewer approves at the SHEET-CONTRACT GATE | Pending this report |

---

## Worker Verification

Method per §0: every source claim traces to a file cited inline. Validators re-run live in this session (§7), not assumed from prior reports. No mockup value, field label, or current-implementation detail was used as a rule source anywhere in §3-§4 — every derivation cell either cites a page/dataset or says "unsourced." Zero production files (models, migrations, resolvers, commands, UI) were modified — confirmed by `git status` diff being empty except this one new file.
