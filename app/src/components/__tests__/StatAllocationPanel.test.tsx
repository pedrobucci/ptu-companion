import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatAllocationPanel } from "../StatAllocationPanel";
import { api, StatAllocationEntry, TrainerCoreResult, TrainerProfile } from "../../lib/api";

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return {
    ...actual,
    api: { ...actual.api, previewTrainerStatAllocation: vi.fn(), saveTrainerStatAllocation: vi.fn() },
  };
});

function profileWith(entries: StatAllocationEntry[]): TrainerProfile {
  return {
    id: "t1",
    name: "Ash",
    level: 1,
    exp: 0,
    money: 0,
    background: null,
    skills: null,
    gm_grants: [],
    moves: [],
    edges: [],
    features: [],
    abilities: [],
    capabilities: [],
    rosters: [],
    pokemon: [],
    inventory: { backpack: [], storage: [], equipped: {} },
    npcs: [],
    progression: [],
    timeline: [],
    combat: null,
    stat_allocation: { entries },
    weight_lb: null,
  };
}

const resolved = { base: 10, final_value: 10, breakdown: [] };

function coreResult(overrides: Partial<TrainerCoreResult> = {}): TrainerCoreResult {
  return {
    combat_stats: {
      hp: { base: 10, final_value: 10, breakdown: [] },
      attack: { base: 5, final_value: 5, breakdown: [] },
      defense: { base: 5, final_value: 5, breakdown: [] },
      special_attack: { base: 5, final_value: 5, breakdown: [] },
      special_defense: { base: 5, final_value: 5, breakdown: [] },
      speed: { base: 5, final_value: 5, breakdown: [] },
    },
    max_hp: resolved,
    physical_evasion: resolved,
    special_evasion: resolved,
    speed_evasion: resolved,
    ap: resolved,
    power: resolved,
    high_jump: resolved,
    high_jump_running_start_bonus: 0,
    long_jump: resolved,
    overland: resolved,
    swim: resolved,
    throwing_range: resolved,
    size: "Medium",
    weight: { weight_lb: null, weight_class: null },
    validation: [],
    allocation_summary: { granted: 10, spent: 0, remaining: 10 },
    ...overrides,
  };
}

function renderPanel(profile: TrainerProfile, onSaved = vi.fn(), onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <StatAllocationPanel open profile={profile} contentPackId="ptu-core-1.05" onClose={onClose} onSaved={onSaved} />
    </QueryClientProvider>,
  );
  return { onSaved, onClose };
}

/** T13C1 AC: the panel is a live Rust-backed preview/save boundary — never
 * a place that recomputes PTU stat rules in React. These assertions check
 * it only ever displays what the (mocked) resolver returned, sends the
 * user's own draft back for preview/save, blocks Save on an Error-severity
 * issue, and leaves Cancel guaranteed non-mutating. */
describe("StatAllocationPanel — T13C1 guided allocation", () => {
  it("seeds the draft from the Trainer's real persisted Creation/LevelUp points and previews it", async () => {
    vi.mocked(api.previewTrainerStatAllocation).mockResolvedValue(coreResult({ allocation_summary: { granted: 10, spent: 4, remaining: 6 } }));
    const profile = profileWith([{ stat: "hp", source: "creation", level: 1, points: 4, note: null }]);

    renderPanel(profile);

    await waitFor(() =>
      expect(api.previewTrainerStatAllocation).toHaveBeenCalledWith("t1", "ptu-core-1.05", [
        { stat: "hp", points: 4 },
        { stat: "attack", points: 0 },
        { stat: "defense", points: 0 },
        { stat: "special_attack", points: 0 },
        { stat: "special_defense", points: 0 },
        { stat: "speed", points: 0 },
      ]),
    );
    expect(await screen.findByText(/4 of 10 points allocated/)).toBeInTheDocument();
    expect(screen.getByText(/6 remaining/)).toBeInTheDocument();
  });

  it("never counts Milestone or GM Override points into the editable draft", async () => {
    vi.mocked(api.previewTrainerStatAllocation).mockResolvedValue(coreResult());
    const profile = profileWith([
      { stat: "speed", source: "gm_override", level: 1, points: 3, note: null },
      { stat: "defense", source: "milestone", level: 5, points: 2, note: null },
    ]);

    renderPanel(profile);

    await waitFor(() =>
      expect(api.previewTrainerStatAllocation).toHaveBeenCalledWith(
        "t1",
        "ptu-core-1.05",
        expect.arrayContaining([
          { stat: "speed", points: 0 },
          { stat: "defense", points: 0 },
        ]),
      ),
    );
  });

  it("re-previews with the updated draft when the user increments a stat", async () => {
    vi.mocked(api.previewTrainerStatAllocation).mockResolvedValue(coreResult());
    const profile = profileWith([]);
    renderPanel(profile);

    const user = userEvent.setup();
    await screen.findByText(/0 of 10 points allocated/);
    await user.click(screen.getByRole("button", { name: "Increase HP" }));

    await waitFor(() =>
      expect(api.previewTrainerStatAllocation).toHaveBeenLastCalledWith(
        "t1",
        "ptu-core-1.05",
        expect.arrayContaining([{ stat: "hp", points: 1 }]),
      ),
    );
  });

  it("disables Save while an Error-severity validation issue is present, honestly surfacing the message", async () => {
    vi.mocked(api.previewTrainerStatAllocation).mockResolvedValue(
      coreResult({
        validation: [{ severity: "error", code: "TRAINER_STAT_POINTS_OVERSPENT", message: "You have overspent your Stat Points.", override_allowed: true }],
      }),
    );
    renderPanel(profileWith([]));

    expect(await screen.findByText("You have overspent your Stat Points.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Allocation" })).toBeDisabled();
  });

  it("Cancel never calls the save command and never mutates anything", async () => {
    vi.mocked(api.previewTrainerStatAllocation).mockResolvedValue(coreResult());
    const { onClose } = renderPanel(profileWith([]));
    const user = userEvent.setup();

    await screen.findByText(/0 of 10 points allocated/);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(api.saveTrainerStatAllocation).not.toHaveBeenCalled();
  });

  it("Save sends the current draft, then reports success and closes", async () => {
    vi.mocked(api.previewTrainerStatAllocation).mockResolvedValue(
      coreResult({ allocation_summary: { granted: 10, spent: 2, remaining: 8 } }),
    );
    vi.mocked(api.saveTrainerStatAllocation).mockResolvedValue(undefined);
    const { onSaved, onClose } = renderPanel(profileWith([{ stat: "attack", source: "creation", level: 1, points: 2, note: null }]));
    const user = userEvent.setup();

    await screen.findByText(/2 of 10 points allocated/);
    await user.click(screen.getByRole("button", { name: "Save Allocation" }));

    await waitFor(() =>
      expect(api.saveTrainerStatAllocation).toHaveBeenCalledWith(
        "t1",
        "ptu-core-1.05",
        expect.arrayContaining([{ stat: "attack", points: 2 }]),
      ),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });
});
