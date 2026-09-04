import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ErrorState } from "../components/StateViews";
import { TypeBadge } from "../components/TypeBadge";

const PTU_TYPES = [
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground",
  "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
];

/** Windows content editor (spec §21): scoped to Moves for v1 (see the T09
 * Worker Result for why the other 7 content kinds aren't built out here
 * too — the backend (`content::authoring::save_definition`) is kind-agnostic
 * and ready for it). Saving always writes into a GM-named pack, never the
 * original — see the "never overwrites" note in the domain module. */
export default function Editor() {
  const [packId, setPackId] = useState("my-homebrew-moves");
  const [packName, setPackName] = useState("My Homebrew Moves");
  const [priority, setPriority] = useState(500);

  const [logicalId, setLogicalId] = useState("");
  const [name, setName] = useState("");
  const [moveType, setMoveType] = useState("Normal");
  const [damageClass, setDamageClass] = useState<"Physical" | "Special" | "Status">("Physical");
  const [effectText, setEffectText] = useState("");

  const definitionVersionId = logicalId ? `move:${logicalId}@${packId}` : "";

  const save = useMutation({
    mutationFn: () =>
      api.saveAuthoredDefinition(packId, packName, priority, "move", {
        id: logicalId,
        logical_id: logicalId,
        definition_version_id: definitionVersionId,
        content_pack_id: packId,
        name,
        type: moveType,
        class: damageClass,
        effect_text: effectText,
        needs_review: false,
      }),
  });

  const [softDeleteTarget, setSoftDeleteTarget] = useState("");
  const softDelete = useMutation({ mutationFn: () => api.softDeleteDefinition("move", softDeleteTarget.trim()) });
  const reactivate = useMutation({ mutationFn: () => api.reactivateDefinition("move", softDeleteTarget.trim()) });

  return (
    <section>
      <h1>Content Editor (Windows)</h1>
      <p>
        Authoring a Move here always creates a <strong>new</strong> definition version inside the pack you name below —
        it never modifies the original definition it might be based on.
      </p>

      <div className="sheet-grid">
        <section>
          <h2>Target pack</h2>
          <div className="inline-form">
            <label htmlFor="pack-id">Pack id</label>
            <input id="pack-id" value={packId} onChange={(e) => setPackId(e.currentTarget.value)} />
            <label htmlFor="pack-name">Pack name</label>
            <input id="pack-name" value={packName} onChange={(e) => setPackName(e.currentTarget.value)} />
            <label htmlFor="pack-priority">Priority</label>
            <input
              id="pack-priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.currentTarget.value))}
            />
          </div>
        </section>

        <section>
          <h2>Move</h2>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (logicalId.trim() && name.trim()) save.mutate();
            }}
          >
            <label htmlFor="logical-id">Logical id</label>
            <input id="logical-id" value={logicalId} onChange={(e) => setLogicalId(e.currentTarget.value)} placeholder="e.g. crunch" />
            <label htmlFor="move-name">Name</label>
            <input id="move-name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
            <label htmlFor="move-type-select">Type</label>
            <select id="move-type-select" value={moveType} onChange={(e) => setMoveType(e.currentTarget.value)}>
              {PTU_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label htmlFor="move-class">Class</label>
            <select id="move-class" value={damageClass} onChange={(e) => setDamageClass(e.currentTarget.value as typeof damageClass)}>
              <option value="Physical">Physical</option>
              <option value="Special">Special</option>
              <option value="Status">Status</option>
            </select>
            <label htmlFor="effect-text">Effect text</label>
            <input id="effect-text" value={effectText} onChange={(e) => setEffectText(e.currentTarget.value)} />
            <button type="submit" disabled={save.isPending}>
              Save New Version
            </button>
          </form>
          {logicalId && (
            <p>
              <TypeBadge type={moveType} /> will save as <code>{definitionVersionId}</code>
            </p>
          )}
          {save.isError && <ErrorState error={save.error} />}
          {save.isSuccess && (
            <p role="status" className="callout-info">
              Saved <code>{definitionVersionId}</code> into pack "{packId}". The original definition (if any) with this
              same logical id in another pack is untouched — both coexist until the active ruleset resolves a winner.
            </p>
          )}
        </section>

        <section>
          <h2>Soft delete / reactivate</h2>
          <p>Marks a definition inactive (never a winner in resolution) without deleting it — historical references still resolve by exact id.</p>
          <div className="inline-form">
            <label htmlFor="soft-delete-target">Move definition_version_id</label>
            <input
              id="soft-delete-target"
              value={softDeleteTarget}
              onChange={(e) => setSoftDeleteTarget(e.currentTarget.value)}
              placeholder="e.g. moves:crunch@core"
            />
            <button type="button" onClick={() => softDelete.mutate()} disabled={softDelete.isPending || !softDeleteTarget.trim()}>
              Soft Delete
            </button>
            <button type="button" onClick={() => reactivate.mutate()} disabled={reactivate.isPending || !softDeleteTarget.trim()}>
              Reactivate
            </button>
          </div>
          {softDelete.isError && <ErrorState error={softDelete.error} />}
          {softDelete.isSuccess && <p role="status" className="callout-info">Marked inactive.</p>}
          {reactivate.isError && <ErrorState error={reactivate.error} />}
          {reactivate.isSuccess && <p role="status" className="callout-info">Reactivated.</p>}
        </section>
      </div>
    </section>
  );
}
