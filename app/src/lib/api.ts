// Typed wrappers around Tauri commands (src-tauri/src/commands.rs). No PTU
// rule lives here or anywhere else in the UI — every function below is a
// direct call into the Rust domain layer; this file only adds TypeScript
// types for what crosses the IPC boundary.

import { invoke } from "@tauri-apps/api/core";

// ---------------------------------------------------------------------
// Shared types (mirrors ptu-domain's serde-serialized shapes)
// ---------------------------------------------------------------------

export type ContentKindSlug =
  | "move"
  | "ability"
  | "capability"
  | "edge"
  | "poke_edge"
  | "feature"
  | "item"
  | "species"
  | "shop";

export interface ContentPackRow {
  id: string;
  name: string;
  version: string;
  priority: number;
  kind: string | null;
  enabled: boolean;
}

export interface SearchHit {
  kind: string;
  definition_version_id: string;
  logical_id: string;
  content_pack_id: string;
  name: string;
}

export interface ResolvedDefinition {
  definition_version_id: string;
  logical_id: string;
  content_pack_id: string;
  name: string;
  needs_review: boolean;
  data_json: string;
  reason: "pinned" | "priority";
}

export interface CombatStages {
  attack: number;
  defense: number;
  special_attack: number;
  special_defense: number;
  speed: number;
  accuracy: number;
  evasion: number;
}

export interface BattleState {
  current_hp: number;
  temporary_hp: number;
  combat_stages: CombatStages;
  statuses: string[];
}

export interface CombatState {
  current_hp: number | null;
  temp_hp: number | null;
  combat_stages: CombatStages;
  statuses: string[];
  ap_current: number | null;
  ap_bound: number | null;
  ap_drained: number | null;
}

export type StorageState = "carried" | "stored";

/** Mechanical-collection entry (spec §23 trainer_moves/pokemon_moves/etc.,
 * T09a): a reference to a definition, not a copy of it. */
export interface CollectionEntry {
  definition_version_id: string;
  [key: string]: unknown;
}

export type PokemonCollection = "moves" | "abilities" | "poke_edges" | "capabilities";
export type TrainerCollection = "moves" | "edges" | "features" | "abilities" | "capabilities";

export interface PokemonInstance {
  id: string;
  species_definition_id: string;
  nickname: string | null;
  level: number;
  exp: number | null;
  capture_ball_item_id: string | null;
  injuries: number;
  held_item_id: string | null;
  storage_state: StorageState;
  roster_memberships: string[];
  battle_state: BattleState | null;
  moves: CollectionEntry[];
  abilities: CollectionEntry[];
  poke_edges: CollectionEntry[];
  capabilities: CollectionEntry[];
}

export interface RosterRecord {
  id: string;
  name: string;
  active: boolean;
  max_members: number | null;
  rules: Record<string, unknown>;
}

export interface ItemStack {
  item_id: string;
  quantity: number;
}

export interface InventoryRecord {
  backpack: ItemStack[];
  storage: ItemStack[];
  equipped: Record<string, string>;
}

/** The six persisted Trainer Combat Stats (T15A, PTU 1.05 Core Step 6).
 * Current HP is dynamic combat state (`CombatState.current_hp`); Accuracy
 * has no persisted base at all. */
export type TrainerCombatStat = "hp" | "attack" | "defense" | "special_attack" | "special_defense" | "speed";

/** Where one allocated Stat Point came from (T15A). */
export type StatAllocationSource = "creation" | "level_up" | "milestone" | "gm_override";

export interface StatAllocationEntry {
  stat: TrainerCombatStat;
  source: StatAllocationSource;
  level: number;
  points: number;
  note: string | null;
}

export interface TrainerStatAllocation {
  entries: StatAllocationEntry[];
}

export interface TrainerProfile {
  id: string;
  name: string;
  level: number;
  exp: number;
  money: number;
  background: Record<string, unknown> | null;
  skills: Record<string, unknown> | null;
  gm_grants: GmGrant[];
  moves: CollectionEntry[];
  edges: CollectionEntry[];
  features: CollectionEntry[];
  abilities: CollectionEntry[];
  capabilities: CollectionEntry[];
  rosters: RosterRecord[];
  pokemon: PokemonInstance[];
  inventory: InventoryRecord;
  npcs: unknown[];
  progression: unknown[];
  timeline: TimelineEvent[];
  combat: CombatState | null;
  /** T15A: never a computed number — the points the player actually
   * spent. An empty `entries` array means "not yet allocated" (unknown),
   * never "zero". */
  stat_allocation: TrainerStatAllocation;
  /** T15A: authoritative entered weight in pounds, for Trainer Weight
   * Class. `null` is "not entered yet". */
  weight_lb: number | null;
}

export interface TrainerSummary {
  id: string;
  name: string;
  level: number;
  money: number;
}

export interface GmGrantFixed {
  id: string;
  kind: "fixed";
  target: string;
  operation: string;
  value: unknown;
  permanent?: boolean;
}
export interface GmGrantResource {
  id: string;
  kind: "resource";
  resource: string;
  amount: unknown;
  allocation: unknown;
}
export type GmGrant = GmGrantFixed | GmGrantResource;

export interface TimelineEvent {
  kind: string;
  [key: string]: unknown;
}

export interface ResolvedDamage {
  stab_applies: boolean;
  base_db: number;
  final_db: number;
  damage_expression: string;
}

export interface TypeEffectivenessResult {
  weak_count: number;
  resistant_count: number;
  immune: boolean;
  net_steps: number;
  multiplier: number;
}

export interface ValidationIssue {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  override_allowed: boolean;
}

export interface PokemonLevelUpResult {
  stat_points_awarded: number;
  tutor_point_awarded: boolean;
  ability_unlock: boolean;
  check_moves_and_evolution: boolean;
}

export interface TrainerLevelUpResult {
  baseline_stat_point: number;
  baseline_feature: number;
  baseline_edge: number;
  milestone_choice_required: boolean;
}

export interface BreakdownEntry {
  label: string;
  operation: string;
  value: number;
  resulting_value: number;
}

export interface ResolvedValue {
  base: number;
  final_value: number;
  breakdown: BreakdownEntry[];
}

export interface Modifier {
  id: string;
  source_label: string;
  target: string;
  operation: "add" | "multiply" | "set" | "min" | "max" | "type_resistance_step" | "grant_entity" | "remove_entity";
  value: number;
  priority: number;
}

// ---------------------------------------------------------------------
// T15A: PTU 1.05 Core Trainer combat stats / Step 6 derived capabilities.
// Every value is a ResolvedValue (base/final/breakdown) — never a plain
// number the UI could mistake for something it's allowed to recompute.
// ---------------------------------------------------------------------

export interface TrainerCombatStatsResolved {
  hp: ResolvedValue;
  attack: ResolvedValue;
  defense: ResolvedValue;
  special_attack: ResolvedValue;
  special_defense: ResolvedValue;
  speed: ResolvedValue;
}

export type WeightClass = "wc3" | "wc4" | "wc5";

export interface TrainerWeightResult {
  weight_lb: number | null;
  weight_class: WeightClass | null;
}

export interface TrainerCoreResult {
  combat_stats: TrainerCombatStatsResolved;
  max_hp: ResolvedValue;
  physical_evasion: ResolvedValue;
  special_evasion: ResolvedValue;
  speed_evasion: ResolvedValue;
  ap: ResolvedValue;
  power: ResolvedValue;
  high_jump: ResolvedValue;
  /** Situational — a running start's High Jump bonus. Never folded into
   * `high_jump` itself. */
  high_jump_running_start_bonus: number;
  long_jump: ResolvedValue;
  overland: ResolvedValue;
  swim: ResolvedValue;
  throwing_range: ResolvedValue;
  size: string;
  weight: TrainerWeightResult;
  validation: ValidationIssue[];
  /** T13C1: the normal (Creation + LevelUp) Stat Point budget in plain
   * numbers — "N of M points allocated, R remaining" without parsing
   * `validation` or re-deriving the grant/spend arithmetic in React. */
  allocation_summary: StatAllocationSummary;
}

export interface StatAllocationSummary {
  granted: number;
  spent: number;
  remaining: number;
}

/** T13C1: one stat's combined desired point total, as the guided
 * allocation panel sends it — Rust alone decides how this splits into
 * provenance-correct Creation/LevelUp entries. */
export interface StatAllocationDraftEntry {
  stat: TrainerCombatStat;
  points: number;
}

/** Why one progression-ledger level entry exists. */
export type LevelSource = "xp" | "milestone" | "gm_action";

export interface AdvancementRecord {
  level: number;
  level_source: LevelSource;
  universal_stat_point_grant: number;
  feature_grant: number;
  edge_grant: number;
  milestone_name: string | null;
  milestone_choice_options: string[];
  milestone_choice: string | null;
  /** True only when this level's milestone offers a choice and none has
   * been recorded yet — never auto-resolved. */
  milestone_pending: boolean;
}

export interface ShopItemEntry {
  item_id: string;
  available: boolean;
  buy_override: number | null;
  sell_override: number | null;
}

export interface ShopPreset {
  id: string;
  name: string;
  buy_multiplier: number;
  sell_multiplier: number;
  items: ShopItemEntry[];
}

export interface CartLine {
  item_id: string;
  quantity: number;
  unit_price: number;
}

export interface StorageTransferOutcome {
  held_item_returned: string | null;
  battle_state_cleared: boolean;
}

// ---------------------------------------------------------------------
// T13D1: Trainer Build contracts (Trainer Build + Visual Identity
// Corrective REPLAN). `getTrainerBuildContext`/the draft functions below
// are real; every preview/commit function is a frozen-contract stub that
// rejects with a `NotYetImplemented`-shaped message until T13D3/T13D4
// implement the actual rule evaluation — never a fabricated success. Types
// here mirror `ptu_domain::engine::{datasets, trainer_build}` field-for-field.
// ---------------------------------------------------------------------

export type AcquisitionSource = "creation" | "level_up" | "bonus_skill_edge" | "milestone" | "gm_fixed" | "gm_resource" | "legacy";

/** Additive extension of ValidationIssue (T13D1 §3.4) — every ValidationIssue
 * field is present at the top level (Rust serializes it via `#[serde(flatten)]`),
 * plus these optional address fields. */
export interface BuildIssue extends ValidationIssue {
  field?: string;
  step?: string;
  acquisition_id?: string;
  source?: string;
}

export type BuildStatus = "legacy" | "draft" | "published";

export interface BuildState {
  status: BuildStatus;
  elemental_connection_mode: string | null;
  campaign_setup_pending: boolean;
  narrative: unknown | null;
}

export interface SkillCatalogEntry {
  id: string;
  name: string;
}

export interface SkillGroups {
  body: SkillCatalogEntry[];
  mind: SkillCatalogEntry[];
  spirit: SkillCatalogEntry[];
}

export interface SkillsSection {
  source_page: number;
  count: number;
  groups: SkillGroups;
}

export interface CoreRankRow {
  name: string;
  ordinal: number;
  dice: number;
}

export interface OrdinaryRankCapsByLevel {
  novice_available_at_level: number;
  adept_available_at_level: number;
  expert_available_at_level: number;
  master_available_at_level: number;
  background_adept_is_level_1_exception: boolean;
}

export interface RankTableSection {
  ranks: CoreRankRow[];
  ordinary_rank_caps_by_level: OrdinaryRankCapsByLevel;
}

export interface BackgroundRuleSection {
  adept_skill_count: number;
  novice_skill_count: number;
  pathetic_skill_count: number;
  remaining_skills_rank: string;
  distinct_skills_required: boolean;
  pathetic_skills_locked_during_creation: boolean;
}

/** One of the eight Core p52 Skill Edges — a closed, exhaustive list; an
 * Edge that merely has a skill-rank prerequisite is not a Skill Edge by
 * that fact alone (T13D_PLAN_REVIEW_APPROVE_v2.md). */
export interface SkillEdgeCatalogEntry {
  id: string;
  name: string;
  definition_version_id: string;
  policy: string;
  repeatable: boolean;
  repeat_rule: string | null;
  requires_level: number | null;
  requires_preceding_rank: string | null;
  requires_rank: string | null;
  target_rank: string | null;
  check_bonus: number | null;
  categories: string[];
  minimum_rank: string | null;
  conditional_bonus: string | null;
  effective_rank_for_effects: number | null;
  grants_extra_dice: boolean | null;
  notes: string | null;
}

export interface SkillEdgesSection {
  source_page: number;
  entries: SkillEdgeCatalogEntry[];
}

export interface ElementalConnectionMode {
  label: string;
  allow_repeat: boolean;
  repeat_rule: string | null;
  requires_explicit_opt_in: boolean;
}

export interface ElementalConnectionModes {
  core: ElementalConnectionMode;
  campaign_variant_distinct_type: ElementalConnectionMode;
}

export interface ElementalConnectionSection {
  definition_version_id: string;
  conflicts_with_definition_version_id: string;
  check_bonus: number;
  checks: string[];
  modes: ElementalConnectionModes;
  mutual_exclusion_applies_in_all_modes: boolean;
}

export interface TrainingFeatureOption {
  id: string;
  name: string;
  definition_version_id: string;
}

export interface TrainingFeaturesSection {
  options: TrainingFeatureOption[];
}

export interface CreationBudgetSection {
  steps: string[];
  paid_edges: number;
  paid_features: number;
  free_training_features: number;
  free_training_feature_skips_prerequisites: boolean;
  normal_selections_check_prerequisites: boolean;
}

export interface OffensiveStatStream {
  milestone_level: number;
  milestone_name: string;
  stat_choice: unknown;
  retroactive_bonus_levels: number[];
  retroactive_bonus_points_each: number | null;
  ongoing_bonus_levels: number[];
  ongoing_bonus_points_each: number;
  alternative_options: unknown[];
}

export interface OffensiveStatStreamsSection {
  milestone_levels: number[];
  streams: OffensiveStatStream[];
}

export interface TrainerBuildRules {
  skills: SkillsSection;
  rank_table: RankTableSection;
  background: BackgroundRuleSection;
  skill_edges: SkillEdgesSection;
  elemental_connection: ElementalConnectionSection;
  training_features: TrainingFeaturesSection;
  creation_budget: CreationBudgetSection;
  offensive_stat_streams: OffensiveStatStreamsSection;
}

export interface BuildContext {
  base_revision: string;
  rules_fingerprint: string;
  rules: TrainerBuildRules;
  build_status: BuildStatus;
  existing_profile: TrainerProfile | null;
}

export interface PreviewTrainerBuildRequest {
  trainer_id: string | null;
  content_pack_id: string;
  base_revision: string | null;
  intent: unknown;
  manual_adjudications?: unknown[];
}

export interface CommitTrainerBuildRequest {
  draft_id: string | null;
  intent: unknown;
  expected_base_revision: string;
  confirm: boolean;
}

export interface PreviewTrainerAdvancementRequest {
  trainer_id: string;
  content_pack_id: string;
  expected_base_revision: string;
  next_level: number;
  milestone_option_id?: string | null;
  acquired_choices?: unknown[];
}

export interface CommitTrainerAdvancementRequest extends PreviewTrainerAdvancementRequest {
  confirm: boolean;
}

export interface PreviewTrainerGmChangeRequest {
  trainer_id: string;
  expected_base_revision: string;
  action: "add" | "edit" | "remove";
  grant_kind: "fixed" | "resource";
  payload: unknown;
  note?: string | null;
}

export interface CommitTrainerGmChangeRequest extends PreviewTrainerGmChangeRequest {
  confirm: boolean;
}

export interface PreviewTrainerRespecRequest {
  trainer_id: string;
  expected_base_revision: string;
  proposed_normal_rebuild: unknown;
  authorized_resource_reallocations?: unknown[];
}

export interface CommitTrainerRespecRequest extends PreviewTrainerRespecRequest {
  confirm: boolean;
}

// ---------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------

export const api = {
  domainStatus: () => invoke<string>("domain_status"),
  activeRulesetName: () => invoke<string>("active_ruleset_name"),

  listContentPacks: () => invoke<ContentPackRow[]>("list_content_packs"),
  searchContent: (query: string, kind: ContentKindSlug | null, limit: number, offset: number) =>
    invoke<SearchHit[]>("search_content", { query, kind, limit, offset }),
  resolveDefinition: (kind: ContentKindSlug, logicalId: string) =>
    invoke<ResolvedDefinition | null>("resolve_definition", { kind, logicalId }),

  // Trainer profile
  listTrainers: () => invoke<TrainerSummary[]>("list_trainers"),
  loadTrainer: (trainerId: string) => invoke<TrainerProfile | null>("load_trainer", { trainerId }),
  saveTrainer: (profile: TrainerProfile) => invoke<void>("save_trainer", { profile }),
  createTrainer: (name: string) => invoke<TrainerProfile>("create_trainer", { name }),
  addPokemon: (trainerId: string, speciesDefinitionId: string, nickname: string | null, level: number) =>
    invoke<PokemonInstance>("add_pokemon", { trainerId, speciesDefinitionId, nickname, level }),
  addRoster: (trainerId: string, name: string, maxMembers: number | null) =>
    invoke<RosterRecord>("add_roster", { trainerId, name, maxMembers }),

  // Mechanical collections (T09a)
  addTrainerCollectionEntry: (trainerId: string, collection: TrainerCollection, entry: CollectionEntry) =>
    invoke<void>("add_trainer_collection_entry", { trainerId, collection, entry }),
  removeTrainerCollectionEntry: (trainerId: string, collection: TrainerCollection, definitionVersionId: string) =>
    invoke<void>("remove_trainer_collection_entry", { trainerId, collection, definitionVersionId }),
  addPokemonCollectionEntry: (pokemonId: string, collection: PokemonCollection, entry: CollectionEntry) =>
    invoke<void>("add_pokemon_collection_entry", { pokemonId, collection, entry }),
  removePokemonCollectionEntry: (pokemonId: string, collection: PokemonCollection, definitionVersionId: string) =>
    invoke<void>("remove_pokemon_collection_entry", { pokemonId, collection, definitionVersionId }),

  // Rosters / storage
  addRosterMembership: (rosterId: string, pokemonId: string) =>
    invoke<void>("add_roster_membership", { rosterId, pokemonId }),
  removeRosterMembership: (rosterId: string, pokemonId: string) =>
    invoke<void>("remove_roster_membership", { rosterId, pokemonId }),
  transferToStorage: (pokemonId: string) => invoke<StorageTransferOutcome>("transfer_to_storage", { pokemonId }),
  transferToCarried: (pokemonId: string) => invoke<void>("transfer_to_carried", { pokemonId }),

  // Combat
  resolveDamage: (
    contentPackId: string,
    moveDb: number,
    moveType: string,
    actorTypes: string[],
    attackStat: number,
  ) => invoke<ResolvedDamage>("resolve_damage", { contentPackId, moveDb, moveType, actorTypes, attackStat }),
  resolveTypeEffectiveness: (contentPackId: string, attackType: string, defenderTypes: string[]) =>
    invoke<TypeEffectivenessResult | null>("resolve_type_effectiveness", { contentPackId, attackType, defenderTypes }),
  nextRound: (trainerId: string) => invoke<number>("next_round", { trainerId }),
  endScene: (trainerId: string) => invoke<number>("end_scene", { trainerId }),
  newDay: (trainerId: string) => invoke<number>("new_day", { trainerId }),

  // Progression / respec
  levelUpPokemon: (contentPackId: string, level: number) =>
    invoke<PokemonLevelUpResult>("level_up_pokemon", { contentPackId, level }),
  validatePokemonLevel: (contentPackId: string, level: number) =>
    invoke<ValidationIssue[]>("validate_pokemon_level", { contentPackId, level }),
  applyPokemonLevel: (pokemonId: string, newLevel: number) =>
    invoke<void>("apply_pokemon_level", { pokemonId, newLevel }),
  recordGmOverride: (trainerId: string, issue: ValidationIssue, note: string | null) =>
    invoke<void>("record_gm_override", { trainerId, issue, note }),
  levelUpTrainer: (contentPackId: string, level: number) =>
    invoke<TrainerLevelUpResult | null>("level_up_trainer", { contentPackId, level }),
  // T15A: PTU 1.05 Core Trainer combat stats / Step 6 derived capabilities
  // and advancement/milestone provenance — resolved in Rust, never in React.
  resolveTrainerCoreStats: (trainerId: string, contentPackId: string) =>
    invoke<TrainerCoreResult>("resolve_trainer_core_stats", { trainerId, contentPackId }),
  resolveTrainerAdvancement: (trainerId: string, contentPackId: string) =>
    invoke<AdvancementRecord[]>("resolve_trainer_advancement", { trainerId, contentPackId }),
  // T13C1: guided Stat Point allocation — preview never persists, save is
  // rejected by Rust when an Error-severity validation issue remains.
  previewTrainerStatAllocation: (trainerId: string, contentPackId: string, desired: StatAllocationDraftEntry[]) =>
    invoke<TrainerCoreResult>("preview_trainer_stat_allocation", { trainerId, contentPackId, desired }),
  saveTrainerStatAllocation: (trainerId: string, contentPackId: string, desired: StatAllocationDraftEntry[]) =>
    invoke<void>("save_trainer_stat_allocation", { trainerId, contentPackId, desired }),
  respecProgression: (trainerId: string, newProgression: unknown[]) =>
    invoke<void>("respec_progression", { trainerId, newProgression }),
  reallocateResourceGrant: (trainerId: string, grantId: string, newAllocation: unknown) =>
    invoke<GmGrant>("reallocate_resource_grant", { trainerId, grantId, newAllocation }),
  resolveModifierValue: (base: number, modifiers: Modifier[]) =>
    invoke<ResolvedValue>("resolve_modifier_value", { base, modifiers }),

  // T13D1: Trainer Build context/drafts. getTrainerBuildContext and the
  // draft functions are real; every preview*/commit* function below them
  // rejects with a NotYetImplemented-shaped error until T13D3/T13D4 land —
  // see this section's header comment above the types.
  getTrainerBuildContext: (trainerId: string | null, contentPackId: string) =>
    invoke<BuildContext>("get_trainer_build_context", { trainerId, contentPackId }),
  saveTrainerBuildDraft: (draftId: string | null, trainerId: string | null, intent: unknown) =>
    invoke<string>("save_trainer_build_draft", { draftId, trainerId, intent }),
  loadTrainerBuildDraft: (draftId: string) => invoke<unknown | null>("load_trainer_build_draft", { draftId }),
  discardTrainerBuildDraft: (draftId: string) => invoke<void>("discard_trainer_build_draft", { draftId }),
  previewTrainerBuild: (request: PreviewTrainerBuildRequest) => invoke<unknown>("preview_trainer_build", { request }),
  commitTrainerBuild: (request: CommitTrainerBuildRequest) => invoke<unknown>("commit_trainer_build", { request }),
  previewTrainerBuildAdvancement: (request: PreviewTrainerAdvancementRequest) =>
    invoke<unknown>("preview_trainer_advancement", { request }),
  commitTrainerBuildAdvancement: (request: CommitTrainerAdvancementRequest) =>
    invoke<unknown>("commit_trainer_advancement", { request }),
  previewTrainerGmChange: (request: PreviewTrainerGmChangeRequest) => invoke<unknown>("preview_trainer_gm_change", { request }),
  commitTrainerGmChange: (request: CommitTrainerGmChangeRequest) => invoke<unknown>("commit_trainer_gm_change", { request }),
  previewTrainerBuildRespec: (request: PreviewTrainerRespecRequest) => invoke<unknown>("preview_trainer_respec", { request }),
  commitTrainerBuildRespec: (request: CommitTrainerRespecRequest) => invoke<unknown>("commit_trainer_respec", { request }),

  // Inventory / equipment / shop
  getShop: (shopId: string) => invoke<ShopPreset | null>("get_shop", { shopId }),
  saveShop: (trainerId: string, preset: ShopPreset) => invoke<void>("save_shop", { trainerId, preset }),
  checkoutBuy: (trainerId: string, shopId: string | null, lines: CartLine[]) =>
    invoke<number>("checkout_buy", { trainerId, shopId, lines }),
  checkoutSell: (trainerId: string, shopId: string | null, lines: CartLine[]) =>
    invoke<number>("checkout_sell", { trainerId, shopId, lines }),
  equipItem: (trainerId: string, slotKey: string, itemId: string) =>
    invoke<void>("equip_item", { trainerId, slotKey, itemId }),
  unequipSlot: (trainerId: string, slotKey: string) => invoke<void>("unequip_slot", { trainerId, slotKey }),

  // Portability (.ptutrainer / .ptubackup)
  exportTrainerPack: (trainerId: string, destPath: string) =>
    invoke<string[]>("export_trainer_pack", { trainerId, destPath }),
  importTrainerPack: (srcPath: string) => invoke<string>("import_trainer_pack", { srcPath }),
  exportBackup: (destPath: string) => invoke<void>("export_backup", { destPath }),
  importBackup: (srcPath: string) => invoke<void>("import_backup", { srcPath }),

  // Content editor
  saveAuthoredDefinition: (
    packId: string,
    packName: string,
    priority: number,
    kind: ContentKindSlug,
    record: Record<string, unknown>,
  ) => invoke<void>("save_authored_definition", { packId, packName, priority, kind, record }),
  softDeleteDefinition: (kind: ContentKindSlug, definitionVersionId: string) =>
    invoke<void>("soft_delete_definition", { kind, definitionVersionId }),
  reactivateDefinition: (kind: ContentKindSlug, definitionVersionId: string) =>
    invoke<void>("reactivate_definition", { kind, definitionVersionId }),
};
