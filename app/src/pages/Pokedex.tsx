import { useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api, ContentKindSlug, ResolvedDefinition, SearchHit } from "../lib/api";
import { Empty, ErrorState, Loading } from "../components/StateViews";
import { AdaptivePanel } from "../components/AdaptivePanel";
import { DefinitionDetail } from "../components/DefinitionDetail";
import { IconSearch, IconWarning } from "../components/icons";

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

/** Flow 8: search Moves/Abilities/Edges/Capabilities/Pokédex quickly
 * offline. Results are fetched page-by-page (never the whole catalog) and
 * the rendered list is windowed with react-virtual, so neither the network
 * (n/a — this is all local) nor the DOM ever holds more than what's
 * visible plus a small overscan. */
export default function Pokedex() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ContentKindSlug | "">("");
  const [detail, setDetail] = useState<ResolvedDefinition | null>(null);
  const [unavailableHit, setUnavailableHit] = useState<SearchHit | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

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
      setUnavailableHit(null);
    } else {
      setDetail(null);
      setUnavailableHit(hit);
    }
  };

  return (
    <section>
      <h1>Pokédex &amp; Rules Search</h1>
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

      <AdaptivePanel
        open={!!detail || !!unavailableHit}
        onClose={() => {
          setDetail(null);
          setUnavailableHit(null);
        }}
        title={detail?.name ?? unavailableHit?.name ?? ""}
      >
        {detail && <DefinitionDetail resolved={detail} />}
        {unavailableHit && (
          <p className="callout-warning" role="status">
            <IconWarning /> "{unavailableHit.name}" is in pack "{unavailableHit.content_pack_id}", which isn't part of
            the active Campaign Ruleset — its full detail isn't available until that pack is enabled. Check Settings
            to switch or add rulesets.
          </p>
        )}
      </AdaptivePanel>
    </section>
  );
}
