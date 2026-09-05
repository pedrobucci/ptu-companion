import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Rosters from "../Rosters";
import { api, TrainerProfile } from "../../lib/api";
import { useAppStore } from "../../store/appStore";
vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return {...actual, api:{...actual.api,loadTrainer:vi.fn(),resolveDefinition:vi.fn(),saveTrainer:vi.fn()}};
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


function show(data: TrainerProfile) {
  useAppStore.setState({activeTrainerId:data.id});
  vi.mocked(api.loadTrainer).mockResolvedValue(data);
  vi.mocked(api.resolveDefinition).mockResolvedValue(null);
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><Rosters /></MemoryRouter></QueryClientProvider>);
}
describe("minimal roster workspace", () => {
  it("changes roster and selected companion without writing a Trainer", async () => {
    const user = userEvent.setup();
    show({...profile,rosters:[...profile.rosters,{id:"r2",name:"Reserve",active:false,max_members:null,rules:{}}],pokemon:[...profile.pokemon,{...profile.pokemon[0],id:"p2",nickname:"Second",roster_memberships:["r2"]}]});
    expect(await screen.findByRole("link",{name:/Open owned sheet/})).toHaveAttribute("href","/trainer/t1/pokemon/pkm1");
    await user.click(screen.getByRole("button",{name:/Reserve/}));
    expect(screen.getByRole("button",{name:/Reserve/})).toHaveAttribute("aria-pressed","true");
    expect(screen.getByRole("link",{name:/Open owned sheet/})).toHaveAttribute("href","/trainer/t1/pokemon/p2");
    expect(api.saveTrainer).not.toHaveBeenCalled();
  });
  it("gives an actionable empty-roster state without inventing members", async () => {
    show({...profile,pokemon:[]});
    expect(await screen.findByText("No creatures on this roster yet.")).toBeVisible();
    expect(screen.queryByRole("link",{name:/Open owned sheet/})).not.toBeInTheDocument();
  });
});
