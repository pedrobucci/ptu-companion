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
  /** T13D4-R2: a stable milestone-benefit identity (e.g.
   * `"reconcile:5:retroactive"`), present ONLY on entries a milestone
   * reconciliation created or adopted. Omitted (not `null`) on every
   * other entry — mandatory additive shape, see
   * `MilestoneReconciliationResolution`. */
  source_id?: string;
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
// T13D1/T13D3: Trainer Build contracts (Trainer Build + Visual Identity
// Corrective REPLAN). `getTrainerBuildContext`, the draft functions, and
// `previewTrainerBuild`/`commitTrainerBuild` (level-1 creation, T13D3) are
// real; advancement/GM-change/respec remain frozen-contract stubs that
// reject with a `NotYetImplemented`-shaped message until T13D4 implements
// the actual rule evaluation — never a fabricated success. Types here
// mirror `ptu_domain::engine::{datasets, trainer_build}` field-for-field.
//
// `previewTrainerBuild`/`commitTrainerBuild` reject with a structured
// `TrainerBuildError` object (like `ContentApiError` below, NOT a plain
// string) — catch with `invoke(...).catch((e: TrainerBuildError) => ...)`.
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

// -- T13D3: level-1 creation intent (Core pp12-18) -----------------------

/** One Background choice (Core p18 Step 2): 1 Adept + 1 distinct Novice +
 * exactly `background.pathetic_skill_count` distinct Pathetic skills;
 * every other Core skill defaults to Untrained. The three Pathetic skills
 * can never be raised again during this same creation. */
export interface BackgroundIntent {
  name: string;
  story?: string | null;
  adept_skill: string;
  novice_skill: string;
  pathetic_skills: string[];
}

/** One Edge or Feature choice, in the order the player made it — order
 * matters (a later pick can satisfy an earlier one's prerequisite).
 * `is_free_training_feature` marks the ONE free Training Feature slot
 * (Core p18 Step 4); at most one entry in the whole list may set it. */
export interface AcquisitionIntent {
  kind: "edge" | "feature";
  definition_version_id: string;
  parameters?: unknown;
  is_free_training_feature?: boolean;
}

/** `elemental_connection_mode` is required whenever `acquisitions`
 * includes an Elemental Connection pick (one of
 * `trainer_build_rules.elemental_connection.modes`'s keys — `"core"` or
 * `"campaign_variant_distinct_type"`), ignored otherwise. */
export interface TrainerBuildCreationIntent {
  name: string;
  background: BackgroundIntent;
  acquisitions?: AcquisitionIntent[];
  stat_desired_points?: StatAllocationDraftEntry[];
  weight_lb?: number | null;
  elemental_connection_mode?: string | null;
}

/** One explicit, GM-attributed sign-off pushing past one specific
 * overridable `BuildIssue`, matched by `code` (and `field` when the issue
 * has one) — never a blanket "ignore everything" flag. */
export interface ManualAdjudication {
  code: string;
  field?: string | null;
  note?: string | null;
}

/** What `profile.skills`/`.edges`/`.features`/stat allocation WOULD become
 * for a given creation intent, plus every issue found. Preview never
 * persists this; commit persists it only when no Error-severity issue
 * survives (after `manual_adjudications`). */
export interface CreationResolution {
  skills: unknown;
  check_bonuses: Record<string, number>;
  edges: unknown[];
  features: unknown[];
  stat_allocation_creation_entries: StatAllocationEntry[];
  elemental_connection_mode: string | null;
  paid_edges_used: number;
  paid_features_used: number;
  free_training_feature_used: boolean;
  issues: BuildIssue[];
}

export interface TrainerBuildPreviewResponse {
  base_revision: string;
  rules_fingerprint: string;
  resolution: CreationResolution;
  core_result: TrainerCoreResult;
}

export interface TrainerBuildCommitResponse {
  trainer_id: string;
  base_revision: string;
  resolution: CreationResolution;
  core_result: TrainerCoreResult;
}

/** Structured rejection shape for `previewTrainerBuild`/`commitTrainerBuild`
 * — a discriminated union on `kind`, matching Rust's `#[serde(tag = "kind")]`.
 * T13D3-R1A added `OperationConflict`/`CommittedTargetMissing`/`PackNotActive`
 * (disclosed contract delta — see `CommitTrainerBuildRequest.operation_id`). */
export type TrainerBuildError =
  | { kind: "InvalidIntent"; message: string }
  | { kind: "StaleRevision"; message: string }
  | { kind: "ConfirmationRequired"; message: string }
  | { kind: "ValidationFailed"; issues: BuildIssue[] }
  | { kind: "NotFound"; message: string }
  | { kind: "Internal"; message: string }
  | { kind: "OperationConflict"; message: string }
  | { kind: "CommittedTargetMissing"; message: string }
  | { kind: "PackNotActive"; message: string };

export interface PreviewTrainerBuildRequest {
  trainer_id: string | null;
  content_pack_id: string;
  base_revision: string | null;
  /** A `TrainerBuildCreationIntent` — kept as `unknown` at the call
   * boundary since `invoke` doesn't validate shape client-side, but every
   * field the backend reads is typed above. */
  intent: unknown;
  manual_adjudications?: unknown[];
}

/** T13D3 contract delta on top of D1's frozen shape: `trainer_id` (create
 * vs. reconcile an existing Trainer) and `manual_adjudications` (the only
 * way to push a commit past an overridable Error-severity `BuildIssue`)
 * were both added — `draft_id`'s stored content is never silently
 * substituted in; this request's own `intent` is always authoritative and
 * the draft (if any) is discarded only after a successful commit.
 *
 * T13D3-R1A contract delta (disclosed): `operation_id` is REQUIRED —
 * a client-generated, non-empty identity for this confirmed operation.
 * Generate a fresh id (e.g. `crypto.randomUUID()`) per NEW intended
 * mutation and resend the SAME id verbatim on a retry of that exact
 * mutation (network retry, double-submit before disabling a button) —
 * never reuse an id across two different intents/targets, and never mint
 * a new one just to retry the same commit. A retry with the same id
 * returns the original result without creating a second Trainer; the
 * same id with a different payload rejects `OperationConflict`. */
export interface CommitTrainerBuildRequest {
  trainer_id?: string | null;
  content_pack_id: string;
  draft_id: string | null;
  intent: unknown;
  expected_base_revision: string;
  manual_adjudications?: unknown[];
  confirm: boolean;
  operation_id: string;
}

// -- T13D4: advancement / GM grant changes / respec (Core pp17-20) -------
// Reuses D3's `BuildIssue`/`StatAllocationEntry`/`TrainerCoreResult`/
// `TrainerBuildError` shapes verbatim — no second contract vocabulary.

/** One choice made during an advancement commit, in the order supplied.
 * `role` is `"ordinary_edge" | "ordinary_feature" | "restricted_bonus_edge"
 * | "milestone_alternative"` — parsed out of the same frozen opaque
 * `acquired_choices` shape, never a separate wire field per role. */
export interface AdvancementAcquisitionIntent {
  role: "ordinary_edge" | "ordinary_feature" | "restricted_bonus_edge" | "milestone_alternative";
  kind: "edge" | "feature";
  definition_version_id: string;
  parameters?: unknown;
}

export interface PreviewTrainerAdvancementRequest {
  trainer_id: string;
  content_pack_id: string;
  expected_base_revision: string;
  next_level: number;
  milestone_option_id?: string | null;
  acquired_choices?: AdvancementAcquisitionIntent[];
  /** Required only at `next_level === 5` with `milestone_option_id ===
   * "stat_stream"` — locks Attack or Special Attack for the whole stream
   * (Core p19: never re-asked at 10/20/30/40). Ignored otherwise. */
  stat_stream_choice?: "attack" | "special_attack" | null;
  /** Same mechanism as `CommitTrainerBuildRequest.manual_adjudications` —
   * present in preview too so a re-preview after adjudication can show
   * the issue actually cleared before commit. */
  manual_adjudications?: unknown[];
}

/** T13D4 contract delta (disclosed) on top of the frozen preview shape:
 * `operation_id` is REQUIRED, same retry-safety convention as
 * `CommitTrainerBuildRequest.operation_id` — generate a fresh id per NEW
 * intended advancement and resend the SAME id verbatim on a retry. */
export interface CommitTrainerAdvancementRequest extends PreviewTrainerAdvancementRequest {
  confirm: boolean;
  operation_id: string;
}

export interface MilestoneResolution {
  level: number;
  name: string;
  choice_options: string[];
  option_chosen: "stat_stream" | "edges" | "general_feature" | null;
  /** True only while this level's milestone requires a choice and none
   * has been supplied yet — never auto-resolved. */
  pending: boolean;
}

export interface TrainerAdvancementResolution {
  from_level: number;
  to_level: number;
  ordinary_stat_points_granted: number;
  ordinary_edges_required: number;
  ordinary_features_required: number;
  restricted_bonus_edge_required: boolean;
  milestone: MilestoneResolution | null;
  /** The full resolved skill map after applying any Skill Edge picked
   * this advancement — same compatibility-projection convention
   * `CreationResolution.skills` already uses. */
  skills: unknown;
  edges: unknown[];
  features: unknown[];
  stat_allocation_milestone_entries: StatAllocationEntry[];
  issues: BuildIssue[];
}

export interface TrainerAdvancementPreviewResponse {
  base_revision: string;
  resolution: TrainerAdvancementResolution;
  core_result: TrainerCoreResult;
}

export interface TrainerAdvancementCommitResponse {
  trainer_id: string;
  base_revision: string;
  resolution: TrainerAdvancementResolution;
  core_result: TrainerCoreResult;
}

export interface PreviewTrainerGmChangeRequest {
  trainer_id: string;
  /** Same `base_revision`/`rules_fingerprint` staleness scheme every
   * other Trainer command family shares. */
  content_pack_id: string;
  expected_base_revision: string;
  action: "add" | "edit" | "remove";
  grant_kind: "fixed" | "resource";
  payload: unknown;
  note?: string | null;
}

export interface CommitTrainerGmChangeRequest extends PreviewTrainerGmChangeRequest {
  confirm: boolean;
  operation_id: string;
}

export interface TrainerGmChangeResolution {
  action: string;
  grant_kind: string;
  grant_id: string | null;
  /** The resulting grant shape for `add`/`edit` (`null` for `remove`). */
  effective_grant: unknown;
  /** A real Edge/Feature acquisition this grant directly creates —
   * `source: "gm_fixed" | "gm_resource"`, `source_id` linking back to
   * `grant_id`. */
  linked_acquisition: unknown;
  /** Stat allocation entries this grant directly creates (a
   * `stat_points` resource grant's allocation) — `source: "gm_override"`. */
  linked_stat_entries: StatAllocationEntry[];
  /** Human-readable notes on what else this action affects — e.g.
   * removing a resource grant that funded an acquisition names that
   * acquisition, so a caller can preview the real dependency before
   * confirming. */
  dependent_invalidations: string[];
  issues: BuildIssue[];
}

export interface TrainerGmChangePreviewResponse {
  base_revision: string;
  resolution: TrainerGmChangeResolution;
  core_result: TrainerCoreResult;
}

export interface TrainerGmChangeCommitResponse {
  trainer_id: string;
  base_revision: string;
  resolution: TrainerGmChangeResolution;
  core_result: TrainerCoreResult;
}

/** One resource grant's allocation being replaced by respec. */
export interface RespecResourceReallocationIntent {
  grant_id: string;
  new_allocation: unknown;
}

export interface PreviewTrainerRespecRequest {
  trainer_id: string;
  content_pack_id: string;
  expected_base_revision: string;
  proposed_normal_rebuild: unknown;
  authorized_resource_reallocations?: RespecResourceReallocationIntent[];
}

export interface CommitTrainerRespecRequest extends PreviewTrainerRespecRequest {
  confirm: boolean;
  operation_id: string;
}

export interface TrainerRespecResolution {
  /** The FULL resulting stat allocation — normal entries rebuilt from
   * `proposed_normal_rebuild`, Milestone/GmOverride entries preserved
   * verbatim. */
  stat_allocation_entries: StatAllocationEntry[];
  preserved_fixed_grant_count: number;
  preserved_resource_grant_count: number;
  reallocated_grant_ids: string[];
  issues: BuildIssue[];
}

export interface TrainerRespecPreviewResponse {
  base_revision: string;
  resolution: TrainerRespecResolution;
  core_result: TrainerCoreResult;
}

export interface TrainerRespecCommitResponse {
  trainer_id: string;
  base_revision: string;
  resolution: TrainerRespecResolution;
  core_result: TrainerCoreResult;
}

// -- T13D4-R2: dedicated pending-milestone reconciliation (Core pp19-20) -
// A SEPARATE command pair from advancement — never a `next_level`, never
// a second level-up. Reconciles ONE already-reached, still-unresolved
// milestone choice.

/** One `prior_benefits.mappings` entry (P2): identifies an EXISTING
 * acquisition/stat entry the GM declares already covers a specific due
 * benefit. `index` is a checked request selector (validated server-side
 * against `expected_value`), never a permanent identity. */
export interface PriorBenefitMapping {
  benefit_id: string;
  kind: "edge" | "feature" | "stat_entry";
  index: number;
  /** The caller's expectation of what currently sits at `index` — the
   * server rejects if this doesn't match exactly (stale/foreign
   * protection), never silently proceeds. */
  expected_value: unknown;
}

/** Explicit legacy disposition (P2) — REQUIRED on every request, preview
 * included. Never inferred from an empty progression ledger. */
export interface PriorBenefitsDisposition {
  disposition: "not_received" | "map_existing";
  /** GM-attributed, non-empty. */
  note: string;
  /** Only used when `disposition === "map_existing"`; must be empty
   * otherwise. */
  mappings?: PriorBenefitMapping[];
}

export interface PreviewTrainerMilestoneReconciliationRequest {
  trainer_id: string;
  content_pack_id: string;
  expected_base_revision: string;
  /** The specific milestone tier being reconciled (5/10/20/30/40) — NEVER
   * a `next_level`; this Trainer's `level` never changes. */
  milestone_level: number;
  milestone_option_id?: "stat_stream" | "edges" | "general_feature" | null;
  /** One `AdvancementAcquisitionIntent`-shaped entry per UNMAPPED
   * alternative-Edge/General-Feature benefit due, in benefit order. */
  acquired_choices?: AdvancementAcquisitionIntent[];
  stat_stream_choice?: "attack" | "special_attack" | null;
  manual_adjudications?: unknown[];
  prior_benefits: PriorBenefitsDisposition;
}

export interface CommitTrainerMilestoneReconciliationRequest extends PreviewTrainerMilestoneReconciliationRequest {
  confirm: boolean;
  operation_id: string;
}

/** `status: "new" | "adopted"` — matches the persisted
 * `ReconciledBenefitRecord` verbatim (same identities, never renamed
 * between preview and the stored metadata). */
export interface ReconciledBenefitOutcome {
  benefit_id: string;
  kind: "stat_stream_retroactive" | "stat_stream_ongoing" | "alternative_edge" | "alternative_general_feature";
  status: "new" | "adopted";
  description: string;
}

export interface MilestoneReconciliationResolution {
  /** Always equal — reconciliation never advances level. */
  from_level: number;
  to_level: number;
  milestone_level: number;
  option: "stat_stream" | "edges" | "general_feature" | null;
  benefits: ReconciledBenefitOutcome[];
  /** NEW stat-stream benefit entries this commit would add (empty for
   * adopted-only benefits). */
  stat_allocation_entries: StatAllocationEntry[];
  /** NEW alternative Edge acquisitions this commit would add. */
  edges: unknown[];
  /** NEW alternative Feature acquisitions this commit would add. */
  features: unknown[];
  /** Every other milestone level (at or below the Trainer's current
   * level) that still has no resolved choice, AFTER this one resolves. */
  remaining_pending_milestone_levels: number[];
  issues: BuildIssue[];
}

export interface TrainerMilestoneReconciliationPreviewResponse {
  base_revision: string;
  resolution: MilestoneReconciliationResolution;
  core_result: TrainerCoreResult;
}

export interface TrainerMilestoneReconciliationCommitResponse {
  trainer_id: string;
  base_revision: string;
  resolution: MilestoneReconciliationResolution;
  core_result: TrainerCoreResult;
}

// ---------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// T13E02: content context / ruleset selection / catalog browse (E01-C1).
// New boundary errors from these five commands reject with a structured
// `ContentApiError` object (NOT a plain string, unlike every other command
// in this file) — a deliberate, E01-C1-mandated departure. Catch these
// with `invoke(...).catch((e: ContentApiError) => ...)`.
// ---------------------------------------------------------------------

export interface ContentApiError {
  code: string;
  message: string;
  field: string | null;
  retryable: boolean;
}

export type PackStatus = "ready" | "missing" | "update_available" | "conflict" | "failed";

export interface PackStatusEntry {
  id: string;
  version: string;
  status: PackStatus;
}

export interface PresetInfo {
  id: string;
  name: string;
  pack_ids: string[];
  description: string | null;
}

export interface ContentContext {
  revision: string;
  ruleset_id: string;
  ruleset_name: string;
  presets: PresetInfo[];
  packs: PackStatusEntry[];
  issues: ContentApiError[];
}

export interface SetActiveRulesetRequest {
  preset_id: string;
  expected_revision: string;
  confirm: boolean;
}

export interface UnavailableReason {
  code: string;
  message: string;
}

export interface BrowseItem {
  kind: string;
  logical_id: string;
  definition_version_id: string;
  content_pack_id: string;
  name: string;
  /** Content/quality suitability only — never Trainer prerequisite or
   * resource eligibility. */
  selectable: boolean;
  unavailable_reason: UnavailableReason | null;
}

export interface BrowseResult {
  revision: string;
  items: BrowseItem[];
  has_more: boolean;
}

export interface BrowseSelectableContentRequest {
  kind: ContentKindSlug;
  query: string;
  limit: number;
  offset: number;
  expected_revision: string;
}

export interface ExactDefinitionVersion {
  kind: string;
  definition_version_id: string;
  logical_id: string;
  content_pack_id: string;
  name: string;
  needs_review: boolean;
  data_json: string;
  /** Always `"pinned"` — an explicit exact-version read, never the active
   * campaign's priority-resolved winner. */
  reason: "pinned";
}

export interface GetDefinitionVersionRequest {
  kind: ContentKindSlug;
  definition_version_id: string;
}

export interface RefreshBundledContentRequest {
  expected_revision: string;
  confirm: boolean;
}

/** T13E02-R1 F3: `import_backup`'s additive success shape. `ruleset_applied`
 * is the preset id actually made active, or `null` when the backup carried
 * no ruleset at all OR carried one that couldn't be applied — check
 * `warnings` (code `"ruleset_not_applied"`) to tell those two apart. */
export interface ImportBackupOutcome {
  trainers_imported: string[];
  content_packs_imported: string[];
  ruleset_applied: string | null;
  warnings: ContentApiError[];
}

export const api = {
  domainStatus: () => invoke<string>("domain_status"),
  activeRulesetName: () => invoke<string>("active_ruleset_name"),

  listContentPacks: () => invoke<ContentPackRow[]>("list_content_packs"),
  searchContent: (query: string, kind: ContentKindSlug | null, limit: number, offset: number) =>
    invoke<SearchHit[]>("search_content", { query, kind, limit, offset }),
  resolveDefinition: (kind: ContentKindSlug, logicalId: string) =>
    invoke<ResolvedDefinition | null>("resolve_definition", { kind, logicalId }),

  // T13E02: content context / ruleset selection / catalog browse. Errors
  // from these five reject with ContentApiError, not a plain string.
  getContentContext: () => invoke<ContentContext>("get_content_context"),
  setActiveRuleset: (request: SetActiveRulesetRequest) => invoke<ContentContext>("set_active_ruleset", { request }),
  browseSelectableContent: (request: BrowseSelectableContentRequest) => invoke<BrowseResult>("browse_selectable_content", { request }),
  getDefinitionVersion: (request: GetDefinitionVersionRequest) => invoke<ExactDefinitionVersion>("get_definition_version", { request }),
  refreshBundledContent: (request: RefreshBundledContentRequest) => invoke<ContentContext>("refresh_bundled_content", { request }),

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

  // T13D1/T13D3/T13D4: Trainer Build context/drafts/level-1 creation, plus
  // real advancement/GM-grant-change/respec (all six commands reject with
  // the shared `TrainerBuildError` union on failure).
  getTrainerBuildContext: (trainerId: string | null, contentPackId: string) =>
    invoke<BuildContext>("get_trainer_build_context", { trainerId, contentPackId }),
  saveTrainerBuildDraft: (draftId: string | null, trainerId: string | null, intent: unknown) =>
    invoke<string>("save_trainer_build_draft", { draftId, trainerId, intent }),
  loadTrainerBuildDraft: (draftId: string) => invoke<unknown | null>("load_trainer_build_draft", { draftId }),
  discardTrainerBuildDraft: (draftId: string) => invoke<void>("discard_trainer_build_draft", { draftId }),
  previewTrainerBuild: (request: PreviewTrainerBuildRequest) =>
    invoke<TrainerBuildPreviewResponse>("preview_trainer_build", { request }),
  commitTrainerBuild: (request: CommitTrainerBuildRequest) =>
    invoke<TrainerBuildCommitResponse>("commit_trainer_build", { request }),
  previewTrainerBuildAdvancement: (request: PreviewTrainerAdvancementRequest) =>
    invoke<TrainerAdvancementPreviewResponse>("preview_trainer_advancement", { request }),
  commitTrainerBuildAdvancement: (request: CommitTrainerAdvancementRequest) =>
    invoke<TrainerAdvancementCommitResponse>("commit_trainer_advancement", { request }),
  previewTrainerGmChange: (request: PreviewTrainerGmChangeRequest) =>
    invoke<TrainerGmChangePreviewResponse>("preview_trainer_gm_change", { request }),
  commitTrainerGmChange: (request: CommitTrainerGmChangeRequest) =>
    invoke<TrainerGmChangeCommitResponse>("commit_trainer_gm_change", { request }),
  previewTrainerBuildRespec: (request: PreviewTrainerRespecRequest) =>
    invoke<TrainerRespecPreviewResponse>("preview_trainer_respec", { request }),
  commitTrainerBuildRespec: (request: CommitTrainerRespecRequest) =>
    invoke<TrainerRespecCommitResponse>("commit_trainer_respec", { request }),
  previewTrainerMilestoneReconciliation: (request: PreviewTrainerMilestoneReconciliationRequest) =>
    invoke<TrainerMilestoneReconciliationPreviewResponse>("preview_trainer_milestone_reconciliation", { request }),
  commitTrainerMilestoneReconciliation: (request: CommitTrainerMilestoneReconciliationRequest) =>
    invoke<TrainerMilestoneReconciliationCommitResponse>("commit_trainer_milestone_reconciliation", { request }),

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
  // T13E02-R1 F3: import_backup's success payload is additive — the two
  // original fields plus ruleset_applied/warnings, so an unapplied backup
  // ruleset selection (e.g. an unknown preset id) is never a silent
  // success. warnings uses the same ContentApiError shape as the T13E02
  // endpoints above, even though this command's own failure path (file
  // read/hash/schema errors) still rejects with a plain string.
  importBackup: (srcPath: string) => invoke<ImportBackupOutcome>("import_backup", { srcPath }),

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
