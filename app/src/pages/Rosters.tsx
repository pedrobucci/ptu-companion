import { useState } from "react";
import { CreatureTile } from "../components/CreatureTile";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";
import { PageHeader } from "../components/PageHeader";
import { Empty, ErrorState, Loading } from "../components/StateViews";

/** Roster-kind pills (COMBAT/COMPANY/MOUNT), matching the roster reference's
 * colored tab badges — derived purely from the `RosterRecord.rules` flags
 * that already exist per spec §9 (T13R1_DESIGN_CONTRACT.md §8.3: "badge is
 * a derived label from existing rules flags — display-only gap"), never a
 * new persisted field. */
function rosterKindLabels(rules: Record<string, unknown>): string[] {
  const labels: string[] = [];
  if (rules.combat) labels.push("COMBAT");
  if (rules.personal_use) labels.push("COMPANY");
  if (rules.trade) labels.push("TRADE");
  if (rules.mount) labels.push("MOUNT");
  return labels;
}

/** T13R3's minimum Rosters entry point (plan Scope item 5: "Make the new
 * creature immediately visible on Home/Trainer roster summary and Rosters
 * entry point"). Deliberately minimal — roster CRUD/drag-drop/multi-select
 * stays on the existing "Pokémon & Rosters" Trainer-sheet tab (T17 owns the
 * full experience per T13R1_DESIGN_CONTRACT.md); this route's job is only
 * to prove a newly added creature is visible here, honestly. */
export default function Rosters() {
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
  const [selectedPokemonId, setSelectedPokemonId] = useState<string | null>(null);
  const activeTrainerId = useAppStore((s) => s.activeTrainerId);

  const trainerQuery = useQuery({
    queryKey: ["trainer", activeTrainerId],
    queryFn: () => api.loadTrainer(activeTrainerId!),
    enabled: !!activeTrainerId,
  });

  if (!activeTrainerId) {
    return (
      <section>
        <PageHeader title="Rosters" />
        <Empty>
          No active Trainer yet. <Link to="/trainer">Open a Trainer</Link> to see their rosters.
        </Empty>
      </section>
    );
  }

  if (trainerQuery.isLoading) return <Loading label="Loading rosters…" />;
  if (trainerQuery.isError) return <ErrorState error={trainerQuery.error} onRetry={() => trainerQuery.refetch()} />;
  if (!trainerQuery.data) return <Empty>Trainer not found.</Empty>;

  const profile = trainerQuery.data;
  const roster = profile.rosters.find(r => r.id === selectedRosterId) ?? profile.rosters[0];
  const members = roster ? profile.pokemon.filter(p => p.roster_memberships.includes(roster.id)) : [];
  const selected = members.find(p => p.id === selectedPokemonId) ?? members[0];

  return <section>
    <PageHeader title="Rosters" subtitle={`${profile.name}'s teams — select a roster, then a companion.`}
      actions={<Link className="text-action" to={`/trainer/${profile.id}`}>Open Trainer Sheet →</Link>} />
    {profile.rosters.length === 0 ? <Empty>No rosters yet — create one from this Trainer's "Pokémon &amp; Rosters" tab.</Empty> : <>
      <div className="roster-selector" aria-label="Choose a roster">
        {profile.rosters.map(r => <button key={r.id} className="roster-context" aria-pressed={roster?.id === r.id}
          onClick={() => { setSelectedRosterId(r.id); setSelectedPokemonId(null); }}>
          <strong>{r.name}</strong><span className="type-row">{rosterKindLabels(r.rules).map(kind => <span className="roster-kind-badge" data-kind={kind} key={kind}>{kind}</span>)}</span>
          <span>{r.active ? "Active" : "Inactive"}</span>
        </button>)}
      </div>
      <div className="roster-workspace">
        <section className="card"><div className="card-header"><span>{roster.name}</span><span>{members.length}{roster.max_members ? ` / ${roster.max_members}` : ""} members</span></div>
          {members.length === 0 ? <Empty>No creatures on this roster yet.</Empty> : <div className="creature-grid roster-creatures">
            {members.map(p => <button type="button" className="creature-choice" key={p.id} aria-pressed={selected?.id === p.id} onClick={() => setSelectedPokemonId(p.id)}><CreatureTile pokemon={p} /></button>)}
          </div>}
        </section>
        <aside className="card roster-detail" aria-label="Selected creature">
          <div className="card-header">Companion details</div>
          {selected ? <>
            <CreatureTile pokemon={selected} />
            <div className="resource-strip"><span>Location</span><strong>{selected.storage_state}</strong></div>
            <h3>Roster memberships</h3>
            <ul className="membership-list">{profile.rosters.filter(r => selected.roster_memberships.includes(r.id)).map(r => <li key={r.id}>{r.name}</li>)}</ul>
            <Link className="btn-primary" to={`/trainer/${profile.id}/pokemon/${selected.id}`}>Open owned sheet →</Link>
          </> : <Empty>Select a populated roster to view a companion.</Empty>}
        </aside>
      </div>
    </>}
    <p className="section-subtitle roster-scope">Use the Trainer's Pokémon &amp; Rosters tab to create rosters and manage membership.</p>
  </section>;
}
