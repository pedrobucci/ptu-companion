import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BuildContext,
  BuildIssue,
  CommitTrainerBuildRequest,
  CoreRankRow,
  ElementalConnectionSection,
  PreviewTrainerBuildRequest,
  SkillEdgeCatalogEntry,
  TrainerBuildRules,
} from "../api";

// T13D1 acceptance: "Contract tests verify snake/camel serialization
// boundary and known rank conversion; Frontend can compile against real
// types and golden examples." This reads the SAME golden vector file
// `app/crates/domain/tests/trainer_build_vectors.rs` cross-checks against
// the real Rust dataset — one shared fixture, two languages, no duplicated
// (and possibly diverging) hand-copied numbers on either side.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");
const vectorsPath = resolve(repoRoot, "test_vectors/trainer_build/trainer_build_rules.json");
const vectors = JSON.parse(readFileSync(vectorsPath, "utf-8")) as Array<{ id: string; expected: Record<string, unknown> }>;

function find(id: string) {
  const found = vectors.find((v) => v.id === id);
  if (!found) throw new Error(`golden vector "${id}" not found`);
  return found.expected;
}

describe("trainer build contract: shared golden vectors", () => {
  it("skills catalog is exactly 17 across three snake_case groups", () => {
    const expected = find("skills-catalog-is-exactly-17-across-three-groups");
    expect(expected.count).toBe(17);
    expect(expected.body_count).toBe(6);
    expect(expected.mind_count).toBe(7);
    expect(expected.spirit_count).toBe(4);
    expect((expected.body_count as number) + (expected.mind_count as number) + (expected.spirit_count as number)).toBe(17);
  });

  it("known rank conversion: the canonical ordinal table, distinct from the seed's buggy rank_value", () => {
    const expected = find("core-rank-ordinal-table");
    const ranks = expected.ranks as CoreRankRow[];
    expect(ranks.map((r) => r.name)).toEqual(["pathetic", "untrained", "novice", "adept", "expert", "master"]);
    expect(ranks.map((r) => r.ordinal)).toEqual([1, 2, 3, 4, 5, 6]);
    // Dice count equals the ordinal itself (Core p33-34).
    for (const rank of ranks) {
      expect(rank.dice).toBe(rank.ordinal);
    }
    // The seed's OWN (incorrect) rank_value numbers must never be mistaken
    // for this canonical table.
    const buggySeedValues = expected.seed_rank_value_is_wrong_for as Record<string, number>;
    for (const [name, buggyValue] of Object.entries(buggySeedValues)) {
      const canonical = ranks.find((r) => r.name === name)!.ordinal;
      expect(buggyValue).not.toBe(canonical);
    }
  });

  it("exactly the eight Core p52 Skill Edges", () => {
    const expected = find("eight-skill-edges-exactly");
    const ids = expected.ids as string[];
    expect(ids).toHaveLength(8);
    expect(ids).toEqual(["basic-skills", "adept-skills", "expert-skills", "master-skills", "skill-enhancement", "categoric-inclination", "skill-stunt", "virtuoso"]);
    expect(expected.virtuoso_effective_rank_for_effects).toBe(8);
    expect(expected.virtuoso_grants_extra_dice).toBe(false);
  });

  it("Elemental Connection: Core rejects repeats, the campaign variant allows distinct types only", () => {
    const expected = find("elemental-connection-modes");
    expect(expected.core_mode_allow_repeat).toBe(false);
    expect(expected.campaign_variant_allow_repeat).toBe(true);
    expect(expected.campaign_variant_repeat_rule).toBe("distinct_type_only");
    expect(expected.definition_version_id).toBe("edges:elemental-connection@core");
    expect(expected.conflicts_with_definition_version_id).toBe("edges:mystic-senses@core");
  });

  it("offensive stat streams cover exactly L5/10/20/30/40", () => {
    const expected = find("offensive-stat-streams-l5-10-20-30-40");
    expect(expected.milestone_levels).toEqual([5, 10, 20, 30, 40]);
    const streams = expected.streams as Array<{ milestone_level: number }>;
    expect(streams.map((s) => s.milestone_level)).toEqual([5, 10, 20, 30, 40]);
  });
});

describe("trainer build contract: TypeScript types accept the real shapes", () => {
  it("SkillEdgeCatalogEntry accepts a real entry shape (snake_case fields)", () => {
    const entry: SkillEdgeCatalogEntry = {
      id: "virtuoso",
      name: "Virtuoso",
      definition_version_id: "edges:virtuoso@core",
      policy: "select_master_skill_effective_rank_for_effects",
      repeatable: true,
      repeat_rule: "distinct_skill_only",
      requires_level: 20,
      requires_preceding_rank: null,
      requires_rank: "master",
      target_rank: null,
      check_bonus: null,
      categories: [],
      minimum_rank: null,
      conditional_bonus: null,
      effective_rank_for_effects: 8,
      grants_extra_dice: false,
      notes: null,
    };
    expect(entry.effective_rank_for_effects).toBe(8);
  });

  it("ElementalConnectionSection accepts both modes", () => {
    const section: ElementalConnectionSection = {
      definition_version_id: "edges:elemental-connection@core",
      conflicts_with_definition_version_id: "edges:mystic-senses@core",
      check_bonus: 2,
      checks: ["charm", "command", "guile", "intimidate", "intuition"],
      modes: {
        core: { label: "Core (official)", allow_repeat: false, repeat_rule: null, requires_explicit_opt_in: false },
        campaign_variant_distinct_type: {
          label: "Campaign variant",
          allow_repeat: true,
          repeat_rule: "distinct_type_only",
          requires_explicit_opt_in: true,
        },
      },
      mutual_exclusion_applies_in_all_modes: true,
    };
    expect(section.modes.core.allow_repeat).toBe(false);
    expect(section.modes.campaign_variant_distinct_type.allow_repeat).toBe(true);
  });

  it("BuildIssue additively extends ValidationIssue — a plain ValidationIssue-shaped object is still assignable", () => {
    const issue: BuildIssue = {
      severity: "error",
      code: "BACKGROUND_PATHETIC_COUNT_INVALID",
      message: "Exactly 3 distinct Pathetic skills are required.",
      override_allowed: false,
      field: "background.pathetic_skills",
      step: "background",
    };
    expect(issue.severity).toBe("error");
    expect(issue.field).toBe("background.pathetic_skills");
    expect(issue.acquisition_id).toBeUndefined();
  });

  it("PreviewTrainerBuildRequest and CommitTrainerBuildRequest compile against the frozen §3.4 command contract", () => {
    const preview: PreviewTrainerBuildRequest = {
      trainer_id: null,
      content_pack_id: "ptu-core-1.05",
      base_revision: null,
      intent: { background: { adept: "combat" } },
    };
    const commit: CommitTrainerBuildRequest = {
      draft_id: "draft-1",
      intent: preview.intent,
      expected_base_revision: "deadbeef",
      confirm: true,
    };
    expect(commit.confirm).toBe(true);
  });

  it("BuildContext shape matches get_trainer_build_context's real output (spot-check, not the full nested payload)", () => {
    // Not a live invoke() call (no Tauri runtime in vitest) — this only
    // proves the TS type accepts a shape a real Rust serde_json::to_value
    // of BuildContext would actually produce, using values pinned by the
    // shared golden vectors above rather than invented ones.
    const rankOrdinals = (find("core-rank-ordinal-table").ranks as CoreRankRow[]).map((r) => r.ordinal);
    const context: Pick<BuildContext, "base_revision" | "rules_fingerprint" | "build_status" | "existing_profile"> & {
      rules: Pick<TrainerBuildRules, "rank_table">;
    } = {
      base_revision: "abc123",
      rules_fingerprint: "def456",
      build_status: "legacy",
      existing_profile: null,
      rules: { rank_table: { ranks: (find("core-rank-ordinal-table").ranks as CoreRankRow[]), ordinary_rank_caps_by_level: find("ordinary-rank-caps-by-level") as never } },
    };
    expect(context.build_status).toBe("legacy");
    expect(context.rules.rank_table.ranks.map((r) => r.ordinal)).toEqual(rankOrdinals);
  });
});
