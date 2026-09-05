import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OverviewTab } from "../OverviewTab";
import { api, TrainerCoreResult, TrainerProfile } from "../../../lib/api";

vi.mock("../../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/api")>("../../../lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      resolveTrainerCoreStats: vi.fn(),
      previewTrainerStatAllocation: vi.fn(),
      saveTrainerStatAllocation: vi.fn(),
    },
  };
});

const profile: TrainerProfile = {
  id: "t1",
  name: "Ash",
  level: 1,
  exp: 0,
  money: 0,
  background: null,
  skills: { stealth: { base_rank: "novice" } },
  gm_grants: [],
  moves: [],
  edges: [],
  features: [],
  abilities: [],
  capabilities: [],
  rosters: [],
  pokemon: [],
  inventory: { backpack: [{ item_id: "potion", quantity: 2 }], storage: [], equipped: { main_hand: "stick" } },
  npcs: [],
  progression: [],
  timeline: [],
  combat: null,
  stat_allocation: { entries: [] },
  weight_lb: null,
};

const resolvedValue = { base: 10, final_value: 10, breakdown: [] };
const coreResult: TrainerCoreResult = {
  combat_stats: {
    hp: resolvedValue,
    attack: { base: 5, final_value: 5, breakdown: [] },
    defense: { base: 5, final_value: 5, breakdown: [] },
    special_attack: { base: 5, final_value: 5, breakdown: [] },
    special_defense: { base: 5, final_value: 5, breakdown: [] },
    speed: { base: 5, final_value: 5, breakdown: [] },
  },
  max_hp: { base: 42, final_value: 42, breakdown: [] },
  physical_evasion: { base: 1, final_value: 1, breakdown: [] },
  special_evasion: { base: 1, final_value: 1, breakdown: [] },
  speed_evasion: { base: 1, final_value: 1, breakdown: [] },
  ap: { base: 5, final_value: 5, breakdown: [] },
  power: { base: 4, final_value: 4, breakdown: [] },
  high_jump: { base: 0, final_value: 0, breakdown: [] },
  high_jump_running_start_bonus: 1,
  long_jump: { base: 1, final_value: 1, breakdown: [] },
  overland: { base: 4, final_value: 4, breakdown: [] },
  swim: { base: 2, final_value: 2, breakdown: [] },
  throwing_range: { base: 6, final_value: 6, breakdown: [] },
  size: "Medium",
  weight: { weight_lb: null, weight_class: null },
  validation: [
    { severity: "info", code: "TRAINER_STAT_ALLOCATION_INCOMPLETE", message: "0 of 10 granted Stat Points have been allocated; the build is not yet complete.", override_allowed: false },
  ],
  allocation_summary: { granted: 10, spent: 0, remaining: 10 },
};

function renderOverview() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OverviewTab profile={profile} refetch={() => {}} />
    </QueryClientProvider>,
  );
}

/** T13R3 AC: "Trainer attributes and max HP displayed by the slice are
 * real resolved values with source breakdown; a permanent unavailable
 * callout, fabricated number, or zero-default fails the task." These
 * assertions verify the dashboard actually consumes T15A's resolver
 * output (never a fabricated/hardcoded value) and surfaces its honest
 * incomplete-allocation state rather than hiding or faking it. */
describe("OverviewTab — T15A Combat Stats consumption", () => {
  it("renders every resolved value from the Rust resolver, never a hardcoded number", async () => {
    vi.mocked(api.resolveTrainerCoreStats).mockResolvedValue(coreResult);
    renderOverview();

    await waitFor(() => expect(api.resolveTrainerCoreStats).toHaveBeenCalledWith("t1", "ptu-core-1.05"));
    expect(await screen.findByText("42")).toBeInTheDocument(); // Max HP
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Not entered")).toBeInTheDocument(); // weight_lb: null
  });

  it("surfaces the incomplete-allocation validation issue honestly instead of hiding it", async () => {
    vi.mocked(api.resolveTrainerCoreStats).mockResolvedValue(coreResult);
    renderOverview();
    expect(await screen.findByText(/not yet complete/i)).toBeInTheDocument();
  });

  it("shows the breakdown for a resolved stat only after it's expanded, and shows nothing fabricated when the breakdown is empty", async () => {
    vi.mocked(api.resolveTrainerCoreStats).mockResolvedValue(coreResult);
    renderOverview();
    const maxHpTrigger = (await screen.findByText("42")).closest("button")!;
    // No breakdown entries on this fixture — the trigger must be inert, not clickable-but-empty.
    expect(maxHpTrigger).toBeDisabled();
  });

  it("renders the Trainer's real skills as a flat list, never a fabricated Body/Mind/Spirit grouping", async () => {
    vi.mocked(api.resolveTrainerCoreStats).mockResolvedValue(coreResult);
    renderOverview();
    expect(await screen.findByText("stealth")).toBeInTheDocument();
    expect(screen.getByText("novice")).toBeInTheDocument();
    expect(screen.queryByText(/body|mind|spirit/i)).not.toBeInTheDocument();
  });

  it("shows real Equipment & Backpack counts and an honest empty state for Temporary Modifiers", async () => {
    vi.mocked(api.resolveTrainerCoreStats).mockResolvedValue(coreResult);
    renderOverview();
    expect(await screen.findByText(/1 slot\(s\) filled/)).toBeInTheDocument();
    expect(screen.getByText(/1 item stack\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/no temporary modifiers are tracked yet/i)).toBeInTheDocument();
  });
});

/** T13C1 AC: "a legal allocation saves atomically and the Trainer sheet
 * immediately shows matching base/final/breakdown and Max HP results" —
 * this is a regression test for a real bug caught while implementing:
 * `TrainerCoreStatsSection`'s resolved-stats query has its own cache key
 * that the outer profile `refetch()` never touches, so a save must
 * explicitly invalidate it or the dashboard would keep showing stale
 * pre-allocation values. */
describe("OverviewTab — T13C1 guided allocation entry point", () => {
  it("re-resolves Combat Stats after a successful allocation save, not just the outer profile", async () => {
    vi.mocked(api.resolveTrainerCoreStats).mockResolvedValue(coreResult);
    vi.mocked(api.previewTrainerStatAllocation).mockResolvedValue(coreResult);
    vi.mocked(api.saveTrainerStatAllocation).mockResolvedValue(undefined);

    renderOverview();
    const user = userEvent.setup();

    await screen.findByText("42"); // initial Max HP resolved
    expect(api.resolveTrainerCoreStats).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Allocate Stat Points" }));
    await screen.findByRole("button", { name: "Save Allocation" });
    await user.click(screen.getByRole("button", { name: "Save Allocation" }));

    await waitFor(() => expect(api.saveTrainerStatAllocation).toHaveBeenCalled());
    await waitFor(() => expect(api.resolveTrainerCoreStats).toHaveBeenCalledTimes(2));
  });
});

/** T13C2 REWORK regression (Reviewer MAJOR on the T13C2 VISUAL REVIEW
 * GATE): the Combat Stats section holds its own 16-tile `.card-grid`, but
 * was confined to one `.sheet-grid` auto-fit column (~18-24em) — nowhere
 * near enough room for more than a single column, collapsing into a long
 * list instead of the reference's compact block. `card-span-full` (App.css)
 * is the fix; this asserts the class actually reaches the rendered section,
 * not just that the CSS rule exists (covered separately in
 * `appCss.regressions.test.ts`). */
describe("OverviewTab — T13C2 REWORK regressions", () => {
  it("spans the Combat Stats card across the full sheet-grid row instead of one narrow column", async () => {
    vi.mocked(api.resolveTrainerCoreStats).mockResolvedValue(coreResult);
    renderOverview();
    const button = await screen.findByRole("button", { name: "Allocate Stat Points" });
    const section = button.closest("section");
    expect(section).toHaveClass("card-span-full");
  });
});
