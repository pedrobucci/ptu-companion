import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";
import { Empty, ErrorState, Loading } from "../components/StateViews";
import { IconChevronLeft, IconWarning } from "../components/icons";
import { TypeBadge } from "../components/TypeBadge";
import { PokemonMoveResolver } from "../components/PokemonMoveResolver";
import { DefinitionDetail } from "../components/DefinitionDetail";
import { AdaptivePanel } from "../components/AdaptivePanel";
import { Avatar } from "../components/Avatar";

/** T13R3's "representative owned creature sheet" (plan Scope item 4):
 * identity/type/level/HP/stats, move list, readable move detail, and
 * resolution from owned data — reusing `PokemonMoveResolver` verbatim
 * (T15B §4.6: "the flagship 'resolved without re-entry' pattern, already
 * working"). Combat Stats/Max HP are a T15B-disclosed gap (species
 * `base_stats` is empty in every imported pack, and no Base Stat Relation
 * formula exists in any supplied source — G-BSR) — shown as an honest
 * `callout-warning`, never a fabricated number, matching the exact
 * disclosed-gap pattern `PokemonMoveResolver` already established. */
export default function CreatureSheet() {
  const { trainerId, pokemonId } = useParams<{ trainerId: string; pokemonId: string }>();
  const contentPackId = useAppStore((s) => s.activeContentPackId);
  const [speciesPanelOpen, setSpeciesPanelOpen] = useState(false);

  const trainerQuery = useQuery({
    queryKey: ["trainer", trainerId],
    queryFn: () => api.loadTrainer(trainerId!),
    enabled: !!trainerId,
  });

  const pokemon = trainerQuery.data?.pokemon.find((p) => p.id === pokemonId) ?? null;

  const speciesQuery = useQuery({
    queryKey: ["species-for-creature-sheet", pokemon?.species_definition_id],
    queryFn: () => api.resolveDefinition("species", pokemon!.species_definition_id),
    enabled: !!pokemon,
  });

  if (!trainerId || !pokemonId) return <ErrorState error="No trainer/Pokémon id in URL." />;
  if (trainerQuery.isLoading) return <Loading label="Loading…" />;
  if (trainerQuery.isError) return <ErrorState error={trainerQuery.error} onRetry={() => trainerQuery.refetch()} />;
  if (!trainerQuery.data) return <Empty>Trainer not found.</Empty>;
  if (!pokemon) return <Empty>This Pokémon was not found on {trainerQuery.data.name}'s roster.</Empty>;

  const speciesData = speciesQuery.data?.data_json
    ? (JSON.parse(speciesQuery.data.data_json) as Record<string, unknown>)
    : null;
  const types = Array.isArray(speciesData?.types) ? (speciesData!.types as string[]) : [];
  const baseStats = speciesData?.base_stats as Record<string, unknown> | undefined;
  const hasBaseStats = !!baseStats && Object.keys(baseStats).length > 0;

  return (
    <section>
      <Link to={`/trainer/${trainerId}`} className="breadcrumb-back">
        <IconChevronLeft /> {trainerQuery.data.name}
      </Link>
      <div className="identity-hero">
        <Avatar label={pokemon.nickname || pokemon.species_definition_id} />
        <div>
          <h1 style={{ margin: 0 }}>{pokemon.nickname || pokemon.species_definition_id}</h1>
          <div className="button-row" style={{ marginTop: "0.35em" }}>
            {types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
            <span>Lv {pokemon.level}</span>
            {pokemon.injuries > 0 && <span className="callout-warning">{pokemon.injuries} injuries</span>}
          </div>
        </div>
      </div>

      <div className="sheet-grid">
        <section className="card">
          <div className="card-header">HP</div>
          {pokemon.battle_state ? (
            <p>
              Current HP: <strong>{pokemon.battle_state.current_hp}</strong>
              {pokemon.battle_state.temporary_hp > 0 && ` (+${pokemon.battle_state.temporary_hp} temp)`}
            </p>
          ) : (
            <Empty>Not currently tracked — this Pokémon has no active battle state yet.</Empty>
          )}
          <p className="callout-warning" role="status">
            <IconWarning /> Max HP isn't shown — it depends on this species' base stats and a Base Stat Relation
            formula, neither of which is available yet (see Combat Stats below).
          </p>
        </section>

        <section className="card">
          <div className="card-header">Combat Stats</div>
          {hasBaseStats ? (
            <p>{Object.entries(baseStats!).map(([stat, value]) => `${stat}: ${value}`).join(" · ")}</p>
          ) : (
            <p className="callout-warning" role="status">
              <IconWarning /> This species' base stats aren't in the imported catalog yet, so Combat Stats can't be
              resolved automatically. Nothing is guessed here.
            </p>
          )}
        </section>

        <section className="card">
          <div className="card-header">Identity</div>
          <dl className="kv-list">
            <dt>Species</dt>
            <dd>{speciesQuery.data?.name ?? pokemon.species_definition_id}</dd>
            <dt>OT</dt>
            <dd>{trainerQuery.data.name}</dd>
            <dt>Storage</dt>
            <dd>{pokemon.storage_state}</dd>
            <dt>Held Item</dt>
            <dd>{pokemon.held_item_id ?? "None"}</dd>
          </dl>
          {speciesQuery.data && (
            <button type="button" onClick={() => setSpeciesPanelOpen(true)}>
              View species entry →
            </button>
          )}
        </section>

        <section className="card">
          <div className="card-header">Moves</div>
          <PokemonMoveResolver pokemon={pokemon} contentPackId={contentPackId} />
        </section>
      </div>

      <AdaptivePanel open={speciesPanelOpen} onClose={() => setSpeciesPanelOpen(false)} title={speciesQuery.data?.name ?? ""}>
        {speciesQuery.data && <DefinitionDetail resolved={speciesQuery.data} />}
      </AdaptivePanel>
    </section>
  );
}
