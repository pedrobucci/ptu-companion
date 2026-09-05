import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";
import { PageHeader } from "../components/PageHeader";
import { Empty, ErrorState, Loading } from "../components/StateViews";
import { Avatar } from "../components/Avatar";
import { IconBag, IconCreatures, IconRoster, IconShop } from "../components/icons";

/** T13R3 Home dashboard: active Trainer + roster summary, per plan Scope
 * item 1 ("Home dashboard with an active Trainer and roster summary").
 * Every figure here is read directly from the persisted profile or the
 * active ruleset — nothing is computed/guessed in React (plan constraint:
 * "No fake dashboard figures and no rule computation in React"). */
export default function Home() {
  const activeTrainerId = useAppStore((s) => s.activeTrainerId);
  const setActiveTrainerId = useAppStore((s) => s.setActiveTrainerId);

  const trainerQuery = useQuery({
    queryKey: ["trainer", activeTrainerId],
    queryFn: () => api.loadTrainer(activeTrainerId!),
    enabled: !!activeTrainerId,
  });

  const rulesetQuery = useQuery({ queryKey: ["ruleset-name"], queryFn: api.activeRulesetName });

  // A previously active Trainer that no longer exists (e.g. deleted
  // elsewhere) must not wedge Home in a permanent "not found" state.
  useEffect(() => {
    if (activeTrainerId && trainerQuery.isSuccess && trainerQuery.data === null) {
      setActiveTrainerId(null);
    }
  }, [activeTrainerId, trainerQuery.isSuccess, trainerQuery.data, setActiveTrainerId]);

  if (!activeTrainerId) {
    return (
      <section>
        <PageHeader
          title="PTU Companion"
          subtitle="Offline-first Trainer/Pokémon companion for Pokémon Tabletop United."
        />
        <Empty>
          No active Trainer yet. <Link to="/trainer">Open or create a Trainer</Link> to get started.
        </Empty>
      </section>
    );
  }

  if (trainerQuery.isLoading) return <Loading label="Loading your Trainer…" />;
  if (trainerQuery.isError) return <ErrorState error={trainerQuery.error} onRetry={() => trainerQuery.refetch()} />;
  if (!trainerQuery.data) return <Empty>Trainer not found.</Empty>;

  const profile = trainerQuery.data;
  const activeRosters = profile.rosters.filter((r) => r.active);
  const recentCreatures = profile.pokemon.slice(-5).reverse();

  return (
    <section>
      <PageHeader title="Home" actions={<Link to={`/trainer/${profile.id}`}>Open Trainer Sheet →</Link>} />

      <div className="card-grid">
        <div className="card">
          <div className="card-header">Active Trainer</div>
          <div className="identity-hero">
            <Avatar label={profile.name} />
            <div>
              <p className="identity-hero-name">{profile.name}</p>
              <p className="identity-hero-rank">
                Lv {profile.level} · {profile.exp} EXP · ₽{profile.money}
              </p>
            </div>
          </div>
          <p>
            <Link to={`/trainer/${profile.id}`}>Open Trainer Sheet →</Link>
          </p>
        </div>

        <div className="card">
          <div className="card-header">Active Roster{activeRosters.length === 1 ? "" : "s"}</div>
          {activeRosters.length === 0 ? (
            <Empty>No active roster yet.</Empty>
          ) : (
            activeRosters.map((r) => {
              const members = profile.pokemon.filter((p) => p.roster_memberships.includes(r.id));
              return (
                <div key={r.id}>
                  <p>
                    <strong>{r.name}</strong> ({members.length}
                    {r.max_members ? `/${r.max_members}` : ""})
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
            })
          )}
          <p>
            <Link to="/rosters">View Rosters →</Link>
          </p>
        </div>

        <div className="card">
          <div className="card-header">Recent Creatures</div>
          {recentCreatures.length === 0 ? (
            <Empty>No Pokémon yet — add one from Creatures.</Empty>
          ) : (
            <ul className="pokemon-list">
              {recentCreatures.map((p) => (
                <li key={p.id}>
                  <Link to={`/trainer/${profile.id}/pokemon/${p.id}`}>{p.nickname || p.species_definition_id}</Link> · Lv{" "}
                  {p.level}
                </li>
              ))}
            </ul>
          )}
          <p>
            <Link to="/pokedex">Add a creature →</Link>
          </p>
        </div>

        <div className="card">
          <div className="card-header">Ruleset Status</div>
          {rulesetQuery.isLoading && <Loading label="Loading…" />}
          {rulesetQuery.isError && <ErrorState error={rulesetQuery.error} onRetry={() => rulesetQuery.refetch()} />}
          {rulesetQuery.data && <p>{rulesetQuery.data}</p>}
        </div>

        <div className="card">
          <div className="card-header">Quick Actions</div>
          <div className="quick-actions-grid">
            <Link to="/rosters" className="quick-action quick-action-roster">
              <IconRoster /> Open Roster
            </Link>
            <Link to="/pokedex" className="quick-action quick-action-add">
              <IconCreatures /> Add Creature
            </Link>
            <Link to="/items" className="quick-action quick-action-items">
              <IconBag /> View Items
            </Link>
            <Link to="/shop" className="quick-action quick-action-shop">
              <IconShop /> Shop
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
