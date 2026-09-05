import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api, ContentKindSlug, ResolvedDefinition, RosterRecord, SearchHit } from "../lib/api";
import { Empty, ErrorState, Loading } from "../components/StateViews";
import { AdaptivePanel } from "../components/AdaptivePanel";
import { DefinitionDetail } from "../components/DefinitionDetail";
import { IconSearch, IconWarning } from "../components/icons";
import { useAppStore } from "../store/appStore";
import { PageHeader } from "../components/PageHeader";

const PAGE_SIZE = 40;

const KIND_OPTIONS: { value: ContentKindSlug | ""; label: string }[] = [
  { value: "", label: "All kinds" },
  { value: "move", label: "Moves" },
  { value: "ability", label: "Abilities" },
  { value: "capability", label: "Capabilities" },
  { value: "edge", label: "Edges" },
  { value: "poke_edge", label: "Poké Edges" },
  { value: "feature", label: "Features" },
  { value: "item", label: "Items" },
  { value: "species", label: "Species" },
];

interface AddFlowState {
  open: boolean;
  step: "target" | "confirm" | "success";
  speciesId: string;
  speciesName: string;
  trainerId: string;
  trainerName: string;
  rosterIds: string[];
  nickname: string;
  level: number;
  newPokemonId?: string;
}

const EMPTY_ADD_FLOW: AddFlowState = {
  open: false,
  step: "target",
  speciesId: "",
  speciesName: "",
  trainerId: "",
  trainerName: "",
  rosterIds: [],
  nickname: "",
  level: 5,
};

/** Flow 8 (search) + T13R3's catalog-to-action flow (plan Scope item 3):
 * `View details` (existing, read-only, unchanged) is now joined by an
 * explicit `Add to Trainer…` continuation, visible only for species
 * results, that requires a Trainer/roster confirmation step before any
 * mutation — never a silent one-click add (T13R1_DESIGN_CONTRACT.md §9). */
export default function Pokedex() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ContentKindSlug | "">("");
  const [detail, setDetail] = useState<ResolvedDefinition | null>(null);
  const [detailKind, setDetailKind] = useState<ContentKindSlug | null>(null);
  const [unavailableHit, setUnavailableHit] = useState<SearchHit | null>(null);
  const [addFlow, setAddFlow] = useState<AddFlowState>(EMPTY_ADD_FLOW);
  const parentRef = useRef<HTMLDivElement>(null);
  const activeTrainerId = useAppStore((s) => s.activeTrainerId);

  const searchQuery = useInfiniteQuery({
    queryKey: ["search", query, kind],
    queryFn: ({ pageParam }) => api.searchContent(query, kind || null, PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => (lastPage.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined),
    enabled: query.trim().length > 0,
  });

  const hits: SearchHit[] = useMemo(() => searchQuery.data?.pages.flat() ?? [], [searchQuery.data]);

  const virtualizer = useVirtualizer({
    count: hits.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

  const openDetail = async (hit: SearchHit) => {
    // A search hit can exist (search covers every imported pack) but still
    // fail to resolve if its pack isn't part of the active Campaign
    // Ruleset (content/resolver.rs scopes resolution to the active
    // ruleset's packs by design) — never a silent dead click, explain why.
    const resolved = await api.resolveDefinition(hit.kind as ContentKindSlug, hit.logical_id);
    if (resolved) {
      setDetail(resolved);
      setDetailKind(hit.kind as ContentKindSlug);
      setUnavailableHit(null);
    } else {
      setDetail(null);
      setDetailKind(null);
      setUnavailableHit(hit);
    }
  };

  const openAddFlow = (resolved: ResolvedDefinition) => {
    setAddFlow(
      activeTrainerId
        ? { ...EMPTY_ADD_FLOW, open: true, step: "confirm", speciesId: resolved.logical_id, speciesName: resolved.name, trainerId: activeTrainerId }
        : { ...EMPTY_ADD_FLOW, open: true, step: "target", speciesId: resolved.logical_id, speciesName: resolved.name },
    );
  };

  const closePanel = () => {
    setDetail(null);
    setDetailKind(null);
    setUnavailableHit(null);
    setAddFlow(EMPTY_ADD_FLOW);
  };

  const panelTitle = addFlow.open
    ? addFlow.step === "success"
      ? "Added!"
      : "Add to Trainer"
    : (detail?.name ?? unavailableHit?.name ?? "");

  return (
    <section>
      <PageHeader title="Pokédex & Rules Search" subtitle="Search by name — view any entry, add species to a Trainer." />
      <form className="inline-form" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="search-query">Search</label>
        <span className="input-with-icon">
          <IconSearch className="input-icon" />
          <input
            id="search-query"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="e.g. fire, crunch, stealth"
          />
        </span>
        <label htmlFor="search-kind">Kind</label>
        <select id="search-kind" value={kind} onChange={(e) => setKind(e.currentTarget.value as ContentKindSlug | "")}>
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </form>

      {query.trim().length === 0 && <Empty>Type a search term to look up Moves, Abilities, Species, and more.</Empty>}
      {searchQuery.isLoading && <Loading label="Searching…" />}
      {searchQuery.isError && <ErrorState error={searchQuery.error} onRetry={() => searchQuery.refetch()} />}
      {searchQuery.isSuccess && hits.length === 0 && <Empty>No results for "{query}".</Empty>}

      {hits.length > 0 && (
        <div ref={parentRef} className="virtual-list" role="listbox" aria-label="Search results">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((row) => {
              const hit = hits[row.index];
              return (
                <button
                  type="button"
                  key={hit.definition_version_id}
                  role="option"
                  aria-selected={false}
                  className="virtual-row"
                  style={{ transform: `translateY(${row.start}px)`, height: row.size }}
                  onClick={() => openDetail(hit)}
                >
                  <span className="search-hit-kind">{hit.kind}</span>
                  <span className="search-hit-name">{hit.name}</span>
                  <span className="search-hit-pack">{hit.content_pack_id}</span>
                </button>
              );
            })}
          </div>
          {searchQuery.hasNextPage && (
            <button
              type="button"
              className="load-more"
              onClick={() => searchQuery.fetchNextPage()}
              disabled={searchQuery.isFetchingNextPage}
            >
              {searchQuery.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}

      <AdaptivePanel open={!!detail || !!unavailableHit || addFlow.open} onClose={closePanel} title={panelTitle}>
        {!addFlow.open && detail && (
          <>
            <DefinitionDetail resolved={detail} />
            {detailKind === "species" && (
              <button type="button" className="btn-primary" style={{ marginTop: "var(--space-3)" }} onClick={() => openAddFlow(detail)}>
                Add to Trainer…
              </button>
            )}
          </>
        )}
        {!addFlow.open && unavailableHit && (
          <p className="callout-warning" role="status">
            <IconWarning /> "{unavailableHit.name}" is in pack "{unavailableHit.content_pack_id}", which isn't part of
            the active Campaign Ruleset — its full detail isn't available until that pack is enabled. Check Settings
            to switch or add rulesets.
          </p>
        )}
        {addFlow.open && <AddCreatureFlow state={addFlow} setState={setAddFlow} onCancel={closePanel} />}
      </AdaptivePanel>
    </section>
  );
}

/** The Trainer/roster confirmation step contract (T13R1_DESIGN_CONTRACT.md
 * §9): target step (pick a Trainer, defaulting to the active one) → confirm
 * step (optional nickname/level/roster, explicit "Confirm — Add to X"
 * button) → success (link to the owned sheet). Cancel is available at
 * every step and mutates nothing until Confirm is pressed. */
function AddCreatureFlow({
  state,
  setState,
  onCancel,
}: {
  state: AddFlowState;
  setState: (s: AddFlowState) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();

  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: api.listTrainers,
    enabled: state.step === "target",
  });

  const chosenTrainerQuery = useQuery({
    queryKey: ["trainer", state.trainerId],
    queryFn: () => api.loadTrainer(state.trainerId),
    enabled: !!state.trainerId && state.step !== "target",
  });

  const addPokemon = useMutation({
    mutationFn: async () => {
      const created = await api.addPokemon(state.trainerId, state.speciesId, state.nickname.trim() || null, state.level);
      for (const rosterId of state.rosterIds) {
        await api.addRosterMembership(rosterId, created.id);
      }
      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["trainer", state.trainerId] });
      setState({ ...state, step: "success", newPokemonId: created.id });
    },
  });

  const trainerDisplayName = chosenTrainerQuery.data?.name ?? state.trainerName;

  if (state.step === "success") {
    return (
      <div>
        <p role="status" className="callout-info">
          Added {state.speciesName} to {trainerDisplayName || "the selected Trainer"}.
        </p>
        <div className="button-row">
          <Link to={`/trainer/${state.trainerId}/pokemon/${state.newPokemonId}`} className="btn-primary">
            Open owned sheet →
          </Link>
          <button type="button" onClick={onCancel}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (state.step === "target") {
    return (
      <div>
        <p>Choose which Trainer receives {state.speciesName}.</p>
        {trainersQuery.isLoading && <Loading label="Loading Trainers…" />}
        {trainersQuery.isError && <ErrorState error={trainersQuery.error} onRetry={() => trainersQuery.refetch()} />}
        {trainersQuery.data && trainersQuery.data.length === 0 && (
          <Empty>No Trainers yet — create one first from Trainers.</Empty>
        )}
        {trainersQuery.data && trainersQuery.data.length > 0 && (
          <ul className="trainer-list">
            {trainersQuery.data.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="trainer-list-item"
                  onClick={() => setState({ ...state, step: "confirm", trainerId: t.id, trainerName: t.name })}
                >
                  <span className="trainer-list-name">{t.name}</span>
                  <span className="trainer-list-meta">Lv {t.level}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }

  // step === "confirm"
  const rosters: RosterRecord[] = chosenTrainerQuery.data?.rosters ?? [];
  return (
    <div>
      <p>
        Add <strong>{state.speciesName}</strong> to <strong>{trainerDisplayName || "…"}</strong>.{" "}
        <button type="button" onClick={() => setState({ ...state, step: "target" })} style={{ padding: 0, border: "none", background: "none", textDecoration: "underline", cursor: "pointer" }}>
          Not the right Trainer?
        </button>
      </p>
      <div className="inline-form">
        <label htmlFor="add-creature-nickname">Nickname (optional)</label>
        <input
          id="add-creature-nickname"
          value={state.nickname}
          onChange={(e) => setState({ ...state, nickname: e.currentTarget.value })}
        />
        <label htmlFor="add-creature-level">Level</label>
        <input
          id="add-creature-level"
          type="number"
          min={1}
          value={state.level}
          onChange={(e) => setState({ ...state, level: Number(e.currentTarget.value) })}
        />
      </div>
      {chosenTrainerQuery.isLoading && <Loading label="Loading rosters…" />}
      {rosters.length > 0 && (
        <fieldset>
          <legend>Also add to roster (optional)</legend>
          {rosters.map((r) => (
            <label key={r.id} className="checkbox-label">
              <input
                type="checkbox"
                checked={state.rosterIds.includes(r.id)}
                onChange={() =>
                  setState({
                    ...state,
                    rosterIds: state.rosterIds.includes(r.id)
                      ? state.rosterIds.filter((id) => id !== r.id)
                      : [...state.rosterIds, r.id],
                  })
                }
              />
              {r.name}
            </label>
          ))}
        </fieldset>
      )}
      {addPokemon.isError && <ErrorState error={addPokemon.error} />}
      <div className="button-row">
        <button type="button" className="btn-primary" onClick={() => addPokemon.mutate()} disabled={addPokemon.isPending}>
          Confirm — Add to {trainerDisplayName || "this Trainer"}
        </button>
        <button type="button" onClick={() => setState({ ...state, step: "target" })}>
          Back
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
