import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, PokemonCollection, PokemonInstance, RosterRecord, TrainerProfile, ValidationIssue } from "../../lib/api";
import { ErrorState } from "../../components/StateViews";
import { CollectionManager } from "../../components/CollectionManager";
import { useAppStore } from "../../store/appStore";

/** Flows 3 (add Pokémon), 4 (overlapping active rosters), 5 (Storage +
 * injury invariant). */
export function PokemonTab({ profile, refetch }: { profile: TrainerProfile; refetch: () => void }) {
  const [species, setSpecies] = useState("");
  const [nickname, setNickname] = useState("");
  const [level, setLevel] = useState(5);
  const [newRosterName, setNewRosterName] = useState("");
  const [storageError, setStorageError] = useState<string | null>(null);

  const addPokemon = useMutation({
    mutationFn: () => api.addPokemon(profile.id, species.trim(), nickname.trim() || null, level),
    onSuccess: () => {
      setSpecies("");
      setNickname("");
      refetch();
    },
  });

  const addRoster = useMutation({
    mutationFn: () => api.addRoster(profile.id, newRosterName.trim(), null),
    onSuccess: () => {
      setNewRosterName("");
      refetch();
    },
  });

  const toggleMembership = useMutation({
    mutationFn: ({ rosterId, pokemonId, member }: { rosterId: string; pokemonId: string; member: boolean }) =>
      member ? api.removeRosterMembership(rosterId, pokemonId) : api.addRosterMembership(rosterId, pokemonId),
    onSuccess: () => refetch(),
  });

  const transferToStorage = useMutation({
    mutationFn: (pokemonId: string) => api.transferToStorage(pokemonId),
    onError: (e) => setStorageError(e instanceof Error ? e.message : String(e)),
    onSuccess: () => {
      setStorageError(null);
      refetch();
    },
  });

  const transferToCarried = useMutation({
    mutationFn: (pokemonId: string) => api.transferToCarried(pokemonId),
    onSuccess: () => refetch(),
  });

  return (
    <div className="sheet-grid">
      <section>
        <h2>Rosters ({profile.rosters.length})</h2>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (newRosterName.trim()) addRoster.mutate();
          }}
        >
          <label htmlFor="new-roster-name">New roster</label>
          <input id="new-roster-name" value={newRosterName} onChange={(e) => setNewRosterName(e.currentTarget.value)} />
          <button type="submit" disabled={addRoster.isPending}>
            Add Roster
          </button>
        </form>
      </section>

      <section>
        <h2>Add Pokémon</h2>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (species.trim()) addPokemon.mutate();
          }}
        >
          <label htmlFor="species">Species definition id</label>
          <input id="species" value={species} onChange={(e) => setSpecies(e.currentTarget.value)} placeholder="e.g. sableye" />
          <label htmlFor="nickname">Nickname</label>
          <input id="nickname" value={nickname} onChange={(e) => setNickname(e.currentTarget.value)} />
          <label htmlFor="level">Level</label>
          <input
            id="level"
            type="number"
            min={1}
            value={level}
            onChange={(e) => setLevel(Number(e.currentTarget.value))}
          />
          <button type="submit" disabled={addPokemon.isPending}>
            Add
          </button>
        </form>
        {addPokemon.isError && <ErrorState error={addPokemon.error} />}
      </section>

      <section>
        <h2>Pokémon ({profile.pokemon.length})</h2>
        {storageError && <ErrorState error={storageError} />}
        {profile.pokemon.length === 0 && <p>No Pokémon yet.</p>}
        <ul className="pokemon-list">
          {profile.pokemon.map((p) => (
            <PokemonCard
              key={p.id}
              pokemon={p}
              trainerId={profile.id}
              rosters={profile.rosters}
              onToggleMembership={(rosterId, member) => toggleMembership.mutate({ rosterId, pokemonId: p.id, member })}
              onTransferToStorage={() => transferToStorage.mutate(p.id)}
              onTransferToCarried={() => transferToCarried.mutate(p.id)}
              transferPending={transferToStorage.isPending || transferToCarried.isPending}
              refetch={refetch}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Flow 10 (guided level-up) + flow 2's GM Override (spec §16/25): if the
 * requested level fails validation but is override-allowed, this shows the
 * blocking issue and a GM Override control that both records provenance
 * (spec: "a successful override creates persistent provenance/history")
 * and applies the change — an override is never silent. */
function PokemonCard({
  pokemon,
  trainerId,
  rosters,
  onToggleMembership,
  onTransferToStorage,
  onTransferToCarried,
  transferPending,
  refetch,
}: {
  pokemon: PokemonInstance;
  trainerId: string;
  rosters: RosterRecord[];
  onToggleMembership: (rosterId: string, member: boolean) => void;
  onTransferToStorage: () => void;
  onTransferToCarried: () => void;
  transferPending: boolean;
  refetch: () => void;
}) {
  const contentPackId = useAppStore((s) => s.activeContentPackId);
  const [targetLevel, setTargetLevel] = useState(pokemon.level + 1);
  const [blockingIssues, setBlockingIssues] = useState<ValidationIssue[] | null>(null);

  const validateAndApply = useMutation({
    mutationFn: async () => {
      const issues = await api.validatePokemonLevel(contentPackId, targetLevel);
      const errors = issues.filter((i) => i.severity === "error");
      if (errors.length > 0) {
        setBlockingIssues(errors);
        return;
      }
      setBlockingIssues(null);
      await api.applyPokemonLevel(pokemon.id, targetLevel);
    },
    onSuccess: () => refetch(),
  });

  const override = useMutation({
    mutationFn: async (issue: ValidationIssue) => {
      const note = window.prompt("GM note for this override (optional):", "") ?? undefined;
      await api.recordGmOverride(trainerId, issue, note || null);
      await api.applyPokemonLevel(pokemon.id, targetLevel);
    },
    onSuccess: () => {
      setBlockingIssues(null);
      refetch();
    },
  });

  return (
    <li className="pokemon-card">
      <div>
        <strong>{pokemon.nickname || pokemon.species_definition_id}</strong> · Lv {pokemon.level} ·{" "}
        {pokemon.injuries > 0 ? <span className="callout-warning">{pokemon.injuries} injuries</span> : "healthy"} ·{" "}
        {pokemon.storage_state}
      </div>

      <div className="pokemon-roster-toggles">
        {rosters.map((r) => {
          const member = pokemon.roster_memberships.includes(r.id);
          return (
            <label key={r.id} className="checkbox-label">
              <input type="checkbox" checked={member} onChange={() => onToggleMembership(r.id, member)} />
              {r.name}
            </label>
          );
        })}
      </div>

      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          validateAndApply.mutate();
        }}
      >
        <label htmlFor={`level-${pokemon.id}`}>Level up to</label>
        <input
          id={`level-${pokemon.id}`}
          type="number"
          min={1}
          value={targetLevel}
          onChange={(e) => setTargetLevel(Number(e.currentTarget.value))}
        />
        <button type="submit" disabled={validateAndApply.isPending}>
          Apply
        </button>
      </form>
      {blockingIssues?.map((issue) => (
        <div key={issue.code} className="callout-warning">
          <p>{issue.message}</p>
          {issue.override_allowed ? (
            <button type="button" onClick={() => override.mutate(issue)} disabled={override.isPending}>
              GM Override &amp; Apply
            </button>
          ) : (
            <p>This cannot be overridden.</p>
          )}
        </div>
      ))}

      {(["moves", "abilities", "poke_edges", "capabilities"] as PokemonCollection[]).map((collection) => (
        <CollectionManager
          key={collection}
          label={collection}
          entries={pokemon[collection]}
          onAdd={async (id) => {
            await api.addPokemonCollectionEntry(pokemon.id, collection, { definition_version_id: id });
            refetch();
          }}
          onRemove={async (id) => {
            await api.removePokemonCollectionEntry(pokemon.id, collection, id);
            refetch();
          }}
        />
      ))}

      <div>
        {pokemon.storage_state === "carried" ? (
          <button type="button" onClick={onTransferToStorage} disabled={transferPending}>
            Move to Storage
          </button>
        ) : (
          <button type="button" onClick={onTransferToCarried} disabled={transferPending}>
            Return to Carried
          </button>
        )}
      </div>
    </li>
  );
}
