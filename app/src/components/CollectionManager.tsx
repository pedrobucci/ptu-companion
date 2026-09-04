import { useMutation, useQuery } from "@tanstack/react-query";
import { api, CollectionEntry, ContentKindSlug, SearchHit } from "../lib/api";
import { ErrorState } from "./StateViews";
import { MoveCategoryBadge, TypeBadge } from "./TypeBadge";
import { DefinitionPicker } from "./DefinitionPicker";
import { IconClose } from "./icons";
import { logicalIdOf } from "../lib/definitionId";

/** Resolves one collection entry to its definition so the card shows a
 * real name plus type/category badges (canvas note
 * "pokemon-ui-design-compliance" §9: "moves mostram tipo+categoria")
 * instead of a bare id. Resolution is by kind+logical id (the resolver's
 * current winner), so display may differ from the exact pinned version in
 * an edge case with overlapping packs — the stored reference itself is
 * untouched either way. Tolerant of unresolved ids. */
function ResolvedEntryCard({
  entry,
  kind,
  onRemove,
  removePending,
}: {
  entry: CollectionEntry;
  kind: ContentKindSlug;
  onRemove: () => void;
  removePending: boolean;
}) {
  const logicalId = logicalIdOf(entry.definition_version_id);
  const resolved = useQuery({
    queryKey: ["collection-entry-definition", kind, logicalId],
    queryFn: () => api.resolveDefinition(kind, logicalId),
  });
  const data = resolved.data?.data_json ? (JSON.parse(resolved.data.data_json) as Record<string, unknown>) : null;
  const types: string[] = Array.isArray(data?.types)
    ? (data!.types as string[])
    : typeof data?.type === "string"
      ? [data!.type as string]
      : [];
  const moveClass = data && typeof data.class === "string" ? (data.class as string) : null;

  return (
    <li className="definition-card">
      <span className="definition-card-name">{resolved.data?.name ?? entry.definition_version_id}</span>
      <span className="button-row definition-card-badges">
        {types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
        {moveClass && <MoveCategoryBadge category={moveClass} />}
      </span>
      <button
        type="button"
        className="definition-card-remove"
        onClick={onRemove}
        disabled={removePending}
        aria-label={`Remove ${resolved.data?.name ?? "entry"}`}
      >
        <IconClose />
      </button>
    </li>
  );
}

const COLLECTION_KIND: Record<string, ContentKindSlug> = {
  moves: "move",
  edges: "edge",
  poke_edges: "poke_edge",
  features: "feature",
  abilities: "ability",
  capabilities: "capability",
};

/** List/add-by-search/remove for one mechanical collection (T09a data,
 * T13 search-picker pass): each card resolves and shows the real
 * definition (name, type, move category); adding is a name search, never
 * a raw definition id. */
export function CollectionManager({
  label,
  entries,
  onAdd,
  onRemove,
}: {
  label: string;
  entries: CollectionEntry[];
  onAdd: (definitionVersionId: string) => Promise<unknown>;
  onRemove: (definitionVersionId: string) => Promise<unknown>;
}) {
  const kind = COLLECTION_KIND[label];

  const add = useMutation({ mutationFn: (hit: SearchHit) => onAdd(hit.definition_version_id) });
  const remove = useMutation({ mutationFn: (id: string) => onRemove(id) });

  return (
    <div className="collection-manager">
      <h3>{label}</h3>
      {entries.length === 0 ? (
        <p>None yet.</p>
      ) : (
        <ul className="definition-card-list">
          {entries.map((e) =>
            kind ? (
              <ResolvedEntryCard
                key={e.definition_version_id}
                entry={e}
                kind={kind}
                onRemove={() => remove.mutate(e.definition_version_id)}
                removePending={remove.isPending}
              />
            ) : (
              <li className="definition-card" key={e.definition_version_id}>
                <span className="definition-card-name">{e.definition_version_id}</span>
                <button
                  type="button"
                  className="definition-card-remove"
                  onClick={() => remove.mutate(e.definition_version_id)}
                  disabled={remove.isPending}
                  aria-label="Remove entry"
                >
                  <IconClose />
                </button>
              </li>
            ),
          )}
        </ul>
      )}
      {kind && <DefinitionPicker kind={kind} label={`Add ${label}`} onSelect={(hit) => add.mutate(hit)} />}
      {add.isError && <ErrorState error={add.error} />}
      {remove.isError && <ErrorState error={remove.error} />}
    </div>
  );
}
