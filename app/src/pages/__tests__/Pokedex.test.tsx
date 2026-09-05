import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Pokedex from "../Pokedex";
import { api, PokemonInstance, ResolvedDefinition, SearchHit, TrainerProfile, TrainerSummary } from "../../lib/api";

// @tanstack/react-virtual depends on ResizeObserver to measure its scroll
// container, which jsdom doesn't implement — every virtualized row would
// otherwise report zero visible items regardless of layout polyfills.
// Bypassing the real virtualizer with a deterministic "every row is
// visible" stub is the standard testing pattern for this library; the
// virtualization itself is Pokedex's pre-existing infrastructure, not
// T13R3 behavior under test here.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 44,
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, start: index * 44, size: 44, key: index })),
  }),
}));

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      searchContent: vi.fn(),
      resolveDefinition: vi.fn(),
      listTrainers: vi.fn(),
      loadTrainer: vi.fn(),
      addPokemon: vi.fn(),
      addRosterMembership: vi.fn(),
    },
  };
});

const speciesHit: SearchHit = {
  kind: "species",
  definition_version_id: "species:eevee@core",
  logical_id: "eevee",
  content_pack_id: "ptu-core-1.05",
  name: "Eevee",
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

const trainers: TrainerSummary[] = [{ id: "t1", name: "Ash", level: 5, money: 1000 }];

const trainerProfile: TrainerProfile = {
  id: "t1",
  name: "Ash",
  level: 5,
  exp: 0,
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
  pokemon: [],
  inventory: { backpack: [], storage: [], equipped: {} },
  npcs: [],
  progression: [],
  timeline: [],
  combat: null,
  stat_allocation: { entries: [] },
  weight_lb: null,
};

const createdPokemon: PokemonInstance = {
  id: "pkm-new",
  species_definition_id: "eevee",
  nickname: null,
  level: 5,
  exp: null,
  capture_ball_item_id: null,
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

function renderPokedex() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Pokedex />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openSpeciesDetail(user: ReturnType<typeof userEvent.setup>) {
  vi.mocked(api.searchContent).mockResolvedValue([speciesHit]);
  vi.mocked(api.resolveDefinition).mockResolvedValue(speciesResolved);
  await user.type(screen.getByRole("textbox", { name: /search/i }), "eevee");
  await waitFor(() => expect(screen.getByText("Eevee")).toBeInTheDocument());
  await user.click(screen.getByText("Eevee"));
  await waitFor(() => expect(screen.getByRole("button", { name: /add to trainer/i })).toBeInTheDocument());
}

/** T13R3: the Pokédex catalog-to-action flow (plan Scope item 3). Every
 * assertion here traces directly to an AC bullet: view-vs-add
 * distinguishability, explicit Trainer/roster confirmation before any
 * mutation, and navigation to the owned sheet afterward. */
describe("Pokedex — view vs. add", () => {
  it("View details never calls a mutating command — only resolveDefinition", async () => {
    const user = userEvent.setup();
    renderPokedex();
    await openSpeciesDetail(user);

    expect(api.addPokemon).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Eevee" })).toBeInTheDocument();
  });

  it("Add to Trainer… is only offered for species results, never for a non-species kind", async () => {
    const moveHit: SearchHit = { ...speciesHit, kind: "move", logical_id: "tackle", name: "Tackle" };
    const moveResolved: ResolvedDefinition = { ...speciesResolved, logical_id: "tackle", name: "Tackle", data_json: JSON.stringify({ class: "Physical", damage_base: 4 }) };
    vi.mocked(api.searchContent).mockResolvedValue([moveHit]);
    vi.mocked(api.resolveDefinition).mockResolvedValue(moveResolved);

    const user = userEvent.setup();
    renderPokedex();
    await user.type(screen.getByRole("textbox", { name: /search/i }), "tackle");
    await waitFor(() => expect(screen.getByText("Tackle")).toBeInTheDocument());
    await user.click(screen.getByText("Tackle"));

    await waitFor(() => expect(screen.getByRole("dialog", { name: "Tackle" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /add to trainer/i })).not.toBeInTheDocument();
  });

  it("requires an explicit Trainer/roster confirmation before addPokemon is ever called", async () => {
    vi.mocked(api.listTrainers).mockResolvedValue(trainers);
    vi.mocked(api.loadTrainer).mockResolvedValue(trainerProfile);
    vi.mocked(api.addPokemon).mockResolvedValue(createdPokemon);
    vi.mocked(api.addRosterMembership).mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderPokedex();
    await openSpeciesDetail(user);

    await user.click(screen.getByRole("button", { name: /add to trainer/i }));
    // Target step: no active Trainer in the store, so the Trainer picker shows.
    await waitFor(() => expect(screen.getByText("Ash")).toBeInTheDocument());
    expect(api.addPokemon).not.toHaveBeenCalled();

    await user.click(screen.getByText("Ash"));
    // Confirm step: explicit species + Trainer name, roster checkbox, real Confirm button.
    await waitFor(() => expect(screen.getByText(/Personal Team/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /confirm — add to ash/i })).toBeInTheDocument();
    expect(api.addPokemon).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByLabelText("Personal Team"));
    await user.click(screen.getByRole("button", { name: /confirm — add to ash/i }));

    await waitFor(() => expect(api.addPokemon).toHaveBeenCalledWith("t1", "eevee", null, 5));
    expect(api.addRosterMembership).toHaveBeenCalledWith("r1", "pkm-new");

    // Success step links to the new owned sheet, never a dead end.
    const link = await screen.findByRole("link", { name: /open owned sheet/i });
    expect(link).toHaveAttribute("href", "/trainer/t1/pokemon/pkm-new");
  });

  it("Cancel at the target step mutates nothing and closes the panel", async () => {
    vi.mocked(api.listTrainers).mockResolvedValue(trainers);
    const user = userEvent.setup();
    renderPokedex();
    await openSpeciesDetail(user);

    await user.click(screen.getByRole("button", { name: /add to trainer/i }));
    await waitFor(() => expect(screen.getByText("Ash")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.addPokemon).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
