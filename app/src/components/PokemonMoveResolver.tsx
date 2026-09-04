import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, PokemonInstance, ResolvedDamage } from "../lib/api";
import { logicalIdOf } from "../lib/definitionId";
import { MoveCategoryBadge, TypeBadge } from "./TypeBadge";
import { ErrorState } from "./StateViews";
import { IconWarning } from "./icons";

/** Resolves a chosen learned move's damage expression from the Pokémon's
 * actual state — no re-typing DB/type/attack stat (restart plan T13 slice
 * item 5). Move DB/type/class come from the move's own resolved
 * definition; the actor's type(s) come from its resolved species
 * definition when available. The attack stat is read from the species'
 * `base_stats` when present; today's imported catalog packs carry empty
 * `base_stats` for every species (a real content gap, not a bug here —
 * see T13's Worker Result), so a manual fallback stays visible and
 * clearly labeled rather than a value being invented. */
export function PokemonMoveResolver({ pokemon, contentPackId }: { pokemon: PokemonInstance; contentPackId: string }) {
  const [selectedId, setSelectedId] = useState("");
  const [manualAttackStat, setManualAttackStat] = useState(15);
  const [resolved, setResolved] = useState<ResolvedDamage | null>(null);
  const [resolvedMeta, setResolvedMeta] = useState<{
    type: string;
    moveClass: string;
    usedManualStat: boolean;
    actorTypesAvailable: boolean;
  } | null>(null);

  const moveOptions = useQuery({
    queryKey: ["pokemon-move-options", pokemon.id, pokemon.moves.map((m) => m.definition_version_id).join(",")],
    queryFn: async () =>
      Promise.all(
        pokemon.moves.map(async (entry) => ({
          entry,
          def: await api.resolveDefinition("move", logicalIdOf(entry.definition_version_id)),
        })),
      ),
    enabled: pokemon.moves.length > 0,
  });

  const speciesQuery = useQuery({
    queryKey: ["pokemon-species-for-resolve", pokemon.species_definition_id],
    queryFn: () => api.resolveDefinition("species", pokemon.species_definition_id),
  });

  const resolveMove = useMutation({
    mutationFn: async () => {
      const chosen = moveOptions.data?.find((r) => r.entry.definition_version_id === selectedId);
      if (!chosen?.def) throw new Error("Pick a learned move first.");
      const moveData = JSON.parse(chosen.def.data_json) as Record<string, unknown>;
      const moveDb = typeof moveData.damage_base === "number" ? moveData.damage_base : 0;
      const moveType = typeof moveData.type === "string" ? moveData.type : "Normal";
      const moveClass = typeof moveData.class === "string" ? moveData.class : "Physical";

      const speciesData = speciesQuery.data?.data_json
        ? (JSON.parse(speciesQuery.data.data_json) as Record<string, unknown>)
        : null;
      const actorTypes = Array.isArray(speciesData?.types) ? (speciesData!.types as string[]) : [];

      const baseStats = speciesData?.base_stats as Record<string, unknown> | undefined;
      const statKey = moveClass === "Special" ? "special_attack" : "attack";
      const autoStat = baseStats && typeof baseStats[statKey] === "number" ? (baseStats[statKey] as number) : null;
      const attackStat = autoStat ?? manualAttackStat;

      const result = await api.resolveDamage(contentPackId, moveDb, moveType, actorTypes, attackStat);
      return { result, moveType, moveClass, usedManualStat: autoStat === null, actorTypesAvailable: actorTypes.length > 0 };
    },
    onSuccess: ({ result, moveType, moveClass, usedManualStat, actorTypesAvailable }) => {
      setResolved(result);
      setResolvedMeta({ type: moveType, moveClass, usedManualStat, actorTypesAvailable });
    },
  });

  if (pokemon.moves.length === 0) {
    return <p className="pokemon-move-resolver-empty">No learned moves yet — add one above to resolve its damage.</p>;
  }

  return (
    <div className="pokemon-move-resolver">
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (selectedId) resolveMove.mutate();
        }}
      >
        <label htmlFor={`resolve-move-${pokemon.id}`}>Resolve a learned move</label>
        <select id={`resolve-move-${pokemon.id}`} value={selectedId} onChange={(e) => setSelectedId(e.currentTarget.value)}>
          <option value="">Choose a move…</option>
          {moveOptions.data?.map(({ entry, def }) => (
            <option key={entry.definition_version_id} value={entry.definition_version_id} disabled={!def}>
              {def?.name ?? entry.definition_version_id}
            </option>
          ))}
        </select>
        {resolvedMeta?.usedManualStat && (
          <>
            <label htmlFor={`resolve-move-stat-${pokemon.id}`}>Attack stat (not in species data — enter manually)</label>
            <input
              id={`resolve-move-stat-${pokemon.id}`}
              type="number"
              value={manualAttackStat}
              onChange={(e) => setManualAttackStat(Number(e.currentTarget.value))}
            />
          </>
        )}
        <button type="submit" disabled={!selectedId || resolveMove.isPending}>
          Resolve
        </button>
      </form>
      {resolveMove.isError && <ErrorState error={resolveMove.error} />}
      {resolved && resolvedMeta && (
        <div>
          <div className="button-row" style={{ marginBottom: "var(--space-2)" }}>
            <TypeBadge type={resolvedMeta.type} />
            <MoveCategoryBadge category={resolvedMeta.moveClass} />
          </div>
          <p>
            STAB {resolved.stab_applies ? "applies" : "does not apply"} → DB {resolved.base_db} → {resolved.final_db} →{" "}
            <strong>{resolved.damage_expression}</strong> (display only, no dice rolled)
          </p>
          {!resolvedMeta.actorTypesAvailable && (
            <p className="callout-warning" role="status">
              <IconWarning /> "{pokemon.species_definition_id}"'s type isn't available from the imported species data,
              so STAB could not be auto-detected for this result.
            </p>
          )}
          {resolvedMeta.usedManualStat && (
            <p className="callout-warning" role="status">
              <IconWarning /> This species' base stats aren't in the imported catalog yet, so the attack stat above
              was entered manually rather than read from the Pokémon automatically.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
