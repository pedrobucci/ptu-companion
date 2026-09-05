import { useQuery } from "@tanstack/react-query";
import { api, type PokemonInstance } from "../lib/api";
import { Avatar } from "./Avatar";
import { TypeBadge } from "./TypeBadge";

/** Shared read-only identity for owned creatures; links/buttons belong to the caller. */
export function CreatureTile({ pokemon, compact = false }: { pokemon: PokemonInstance; compact?: boolean }) {
  const species = useQuery({
    queryKey: ["species-for-creature-sheet", pokemon.species_definition_id],
    queryFn: () => api.resolveDefinition("species", pokemon.species_definition_id),
  });
  const data = species.data?.data_json ? JSON.parse(species.data.data_json) : null;
  const types: string[] = Array.isArray(data?.types) ? data.types : [];
  const name = pokemon.nickname || species.data?.name || pokemon.species_definition_id;
  return <span className={`creature-tile ${compact ? "creature-tile-compact" : ""}`}>
    <Avatar label={name} kind="creature" />
    <span className="creature-tile-copy">
      <strong>{name}</strong><span className="creature-tile-level">Lv {pokemon.level}</span>
      <span className="type-row">{types.map(type => <TypeBadge key={type} type={type} />)}</span>
      {pokemon.injuries > 0 && <span className="injury-label">{pokemon.injuries} injuries</span>}
    </span>
  </span>;
}
