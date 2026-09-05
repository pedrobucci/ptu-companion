import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Home from "../Home";
import { api, TrainerProfile } from "../../lib/api";
import { useAppStore } from "../../store/appStore";

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return {
    ...actual,
    api: { ...actual.api, loadTrainer: vi.fn(), activeRulesetName: vi.fn() },
  };
});

const profile: TrainerProfile = {
  id: "t1",
  name: "Ash",
  level: 5,
  exp: 120,
  money: 1000,
  background: null,
  skills: null,
  gm_grants: [],
  moves: [],
  edges: [],
  features: [],
  abilities: [],
  capabilities: [],
  rosters: [{ id: "r1", name: "Personal Team", active: true, max_members: 6, rules: {} }],
  pokemon: [
    {
      id: "pkm1",
      species_definition_id: "eevee",
      nickname: "Eve",
      level: 5,
      exp: null,
      capture_ball_item_id: null,
      injuries: 0,
      held_item_id: null,
      storage_state: "carried",
      roster_memberships: ["r1"],
      battle_state: null,
      moves: [],
      abilities: [],
      poke_edges: [],
      capabilities: [],
    },
  ],
  inventory: { backpack: [], storage: [], equipped: {} },
  npcs: [],
  progression: [],
  timeline: [],
  combat: null,
  stat_allocation: { entries: [] },
  weight_lb: null,
};

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Home dashboard", () => {
  it("prompts to open a Trainer when none is active — no fabricated dashboard", () => {
    useAppStore.setState({ activeTrainerId: null });
    renderHome();
    expect(screen.getByText(/no active trainer yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open or create a trainer/i })).toHaveAttribute("href", "/trainer");
  });

  it("shows the active Trainer's real name/level/EXP/money, roster, and recent creature — nothing fabricated", async () => {
    useAppStore.setState({ activeTrainerId: "t1" });
    vi.mocked(api.loadTrainer).mockResolvedValue(profile);
    vi.mocked(api.activeRulesetName).mockResolvedValue("Standard PTU v1.2");

    renderHome();

    await waitFor(() => expect(screen.getByText("Active Trainer")).toBeInTheDocument());
    const activeTrainerCard = screen.getByText("Active Trainer").closest(".card") as HTMLElement;
    expect(activeTrainerCard.textContent).toContain("Ash");
    expect(activeTrainerCard.textContent).toContain("Lv 5");
    expect(activeTrainerCard.textContent).toContain("120 EXP");
    expect(activeTrainerCard.textContent).toContain("₽1000");
    expect(screen.getByText("Personal Team", { exact: false })).toBeInTheDocument();
    // Eve legitimately appears twice — once in the active roster preview,
    // once in Recent Creatures — both must link to the owned sheet.
    for (const link of screen.getAllByRole("link", { name: /eve/i })) {
      expect(link).toHaveAttribute("href", "/trainer/t1/pokemon/pkm1");
    }
    await waitFor(() => expect(screen.getByText("Standard PTU v1.2")).toBeInTheDocument());
  });
});
