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

  return (
    <section>
      <PageHeader title="Rosters" subtitle={`${profile.name}'s teams`} />
      {profile.rosters.length === 0 ? (
        <Empty>No rosters yet — create one from this Trainer's "Pokémon &amp; Rosters" tab.</Empty>
      ) : (
        <div className="card-grid">
          {profile.rosters.map((r) => {
            const members = profile.pokemon.filter((p) => p.roster_memberships.includes(r.id));
            const kinds = rosterKindLabels(r.rules);
            return (
              <div key={r.id} className="card">
                <div className="card-header">
                  <span>
                    {r.name}
                    {!r.active && " (inactive)"}
                  </span>
                  {kinds.length > 0 && (
                    <div className="card-header-actions">
                      {kinds.map((kind) => (
                        <span key={kind} className="roster-kind-badge" data-kind={kind}>
                          {kind}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <p>
                  {members.length}
                  {r.max_members ? ` / ${r.max_members}` : ""} member(s)
                </p>
                {members.length === 0 ? (
                  <Empty>No creatures on this roster yet.</Empty>
                ) : (
                  <ul className="pokemon-list">
                    {members.map((p) => (
                      <li key={p.id}>
                        <Link to={`/trainer/${profile.id}/pokemon/${p.id}`}>{p.nickname || p.species_definition_id}</Link>{" "}
                        · Lv {p.level}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="section-subtitle" style={{ marginTop: "var(--space-4)" }}>
        Full roster creation and management (drag-and-drop, multi-select) is coming in a later task — use this
        Trainer's "Pokémon &amp; Rosters" tab to create rosters and add members today.
      </p>
    </section>
  );
}
