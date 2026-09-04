import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, CollectionEntry, ContentKindSlug } from "../lib/api";
import { ErrorState } from "./StateViews";
import { MoveCategoryBadge, TypeBadge } from "./TypeBadge";

/** "moves:crunch@core" -> "crunch". The collection's own logical id is
 * always the middle segment between the plural-kind prefix and the
 * "@pack" suffix (content/import.rs's definition_version_id shape). */
function logicalIdOf(definitionVersionId: string): string {
  const afterColon = definitionVersionId.includes(":")
    ? definitionVersionId.slice(definitionVersionId.indexOf(":") + 1)
    : definitionVersionId;
  const at = afterColon.indexOf("@");
  return at >= 0 ? afterColon.slice(0, at) : afterColon;
}

/** Resolves one collection entry to its definition so the row can show a
 * real name plus type/category badges (canvas note
 * "pokemon-ui-design-compliance" §9: "moves mostram tipo+categoria")
 * instead of a bare id. Resolution is by kind+logical id (the resolver's
 * current winner), so display may differ from the exact pinned version in
 * an edge case with overlapping packs — the stored reference itself is
 * untouched either way. Tolerant of unresolved ids. */
function ResolvedEntryLabel({ entry, kind }: { entry: CollectionEntry; kind: ContentKindSlug }) {
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

  if (!resolved.data) {
    return <code>{entry.definition_version_id}</code>;
  }
  return (
    <span className="button-row" style={{ display: "inline-flex" }}>
      <span>{resolved.data.name}</span>
      {types.map((t) => (
        <TypeBadge key={t} type={t} />
      ))}
      {moveClass && <MoveCategoryBadge category={moveClass} />}
    </span>
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

/** List/add-by-id/remove for one mechanical collection (T09a data,
 * T08a visual pass): each row resolves and shows the real definition
 * (name, type, move category) rather than a raw id. */
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
  const [newId, setNewId] = useState("");
  const kind = COLLECTION_KIND[label];

  const add = useMutation({
    mutationFn: (id: string) => onAdd(id),
    onSuccess: () => setNewId(""),
  });
  const remove = useMutation({ mutationFn: (id: string) => onRemove(id) });

  return (
    <div className="collection-manager">
      <h3>{label}</h3>
      {entries.length === 0 ? (
        <p>None yet.</p>
      ) : (
        <ul>
          {entries.map((e) => (
            <li key={e.definition_version_id}>
              {kind ? <ResolvedEntryLabel entry={e} kind={kind} /> : <code>{e.definition_version_id}</code>}
              <button type="button" onClick={() => remove.mutate(e.definition_version_id)} disabled={remove.isPending}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (newId.trim()) add.mutate(newId.trim());
        }}
      >
        <label htmlFor={`add-${label}`}>Add by definition id</label>
        <input
          id={`add-${label}`}
          value={newId}
          onChange={(e) => setNewId(e.currentTarget.value)}
          placeholder="e.g. moves:crunch@core"
        />
        <button type="submit" disabled={add.isPending}>
          Add
        </button>
      </form>
      {add.isError && <ErrorState error={add.error} />}
      {remove.isError && <ErrorState error={remove.error} />}
    </div>
  );
}
