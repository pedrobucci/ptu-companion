import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CreatureSheet from "../CreatureSheet";
import { api, PokemonInstance, ResolvedDefinition, TrainerProfile } from "../../lib/api";

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return { ...actual, api: { ...actual.api, loadTrainer: vi.fn(), resolveDefinition: vi.fn() } };
});

const pokemon: PokemonInstance = {
  id: "pkm1",
  species_definition_id: "eevee",
  nickname: "Eve",
  level: 5,
  exp: null,
  capture_ball_item_id: "poke-ball",
  injuries: 0,
  held_item_id: null,
  storage_state: "carried",
  roster_memberships: [],
  battle_state: null,
  moves: [],
  abilities: [],
  poke_edges: [],
  capabilities: [],
};

const profile: TrainerProfile = {
  id: "t1",
  name: "Ash",
  level: 5,
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
  pokemon: [pokemon],
  inventory: { backpack: [], storage: [], equipped: {} },
  npcs: [],
  progression: [],
  timeline: [],
  combat: null,
  stat_allocation: { entries: [] },
  weight_lb: null,
};

const speciesResolved: ResolvedDefinition = {
  definition_version_id: "species:eevee@core",
  logical_id: "eevee",
  content_pack_id: "ptu-core-1.05",
  name: "Eevee",
  needs_review: false,
  data_json: JSON.stringify({ types: ["Normal"], base_stats: {} }),
  reason: "priority",
};

function renderSheet() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/trainer/t1/pokemon/pkm1"]}>
        <Routes>
          <Route path="/trainer/:trainerId/pokemon/:pokemonId" element={<CreatureSheet />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** T13R3 AC: the owned creature sheet must never fabricate Max HP or
 * Combat Stats — species `base_stats` is a T15B-disclosed gap (empty in
 * every imported pack), so both must render an honest disclosed-gap
 * callout, exactly like `PokemonMoveResolver`'s existing pattern, never a
 * guessed number. */
describe("CreatureSheet — honest disclosed gaps", () => {
  it("never shows a fabricated Max HP or Combat Stats when species base_stats is empty", async () => {
    vi.mocked(api.loadTrainer).mockResolvedValue(profile);
    vi.mocked(api.resolveDefinition).mockResolvedValue(speciesResolved);

    renderSheet();

    expect(await screen.findByRole("heading", { name: "Eve" })).toBeInTheDocument();
    expect(screen.getByText(/max hp isn't shown/i)).toBeInTheDocument();
    expect(screen.getByText(/combat stats can't be resolved automatically/i)).toBeInTheDocument();
    expect(screen.getByText(/not currently tracked/i)).toBeInTheDocument(); // battle_state is null
  });

  it("shows a real not-found state for a Pokémon id that isn't on this Trainer", async () => {
    vi.mocked(api.loadTrainer).mockResolvedValue(profile);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/trainer/t1/pokemon/does-not-exist"]}>
          <Routes>
            <Route path="/trainer/:trainerId/pokemon/:pokemonId" element={<CreatureSheet />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText(/was not found on ash's roster/i)).toBeInTheDocument());
  });
});
