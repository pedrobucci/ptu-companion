import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, ResolvedDamage, TrainerProfile, TypeEffectivenessResult } from "../../lib/api";
import { ErrorState } from "../../components/StateViews";
import { useAppStore } from "../../store/appStore";
import { MoveCategoryBadge, TypeBadge } from "../../components/TypeBadge";
import { StatBadge } from "../../components/StatBadge";
import { PokemonMoveResolver } from "../../components/PokemonMoveResolver";

/** Flows 6 (active combat sheet) and 7 (precomputed damage/STAB/type). No
 * dice are rolled anywhere in this file — only display resolution. */
export function CombatTab({ profile, refetch }: { profile: TrainerProfile; refetch: () => void }) {
  const contentPackId = useAppStore((s) => s.activeContentPackId);

  const nextRound = useMutation({ mutationFn: () => api.nextRound(profile.id), onSuccess: refetch });
  const endScene = useMutation({ mutationFn: () => api.endScene(profile.id), onSuccess: refetch });
  const newDay = useMutation({ mutationFn: () => api.newDay(profile.id), onSuccess: refetch });

  const [moveDb, setMoveDb] = useState(4);
  const [moveType, setMoveType] = useState("Dark");
  const [actorTypes, setActorTypes] = useState("Dark");
  const [attackStat, setAttackStat] = useState(15);
  // Display-only: resolve_damage already knows which stat to use (the
  // caller picks Attack vs. Special Attack via `attack_stat`); this just
  // drives the category badge shown alongside the result.
  const [damageClass, setDamageClass] = useState<"Physical" | "Special">("Physical");
  const [resolved, setResolved] = useState<ResolvedDamage | null>(null);

  const resolveDamage = useMutation({
    mutationFn: () =>
      api.resolveDamage(
        contentPackId,
        moveDb,
        moveType.trim(),
        actorTypes.split(",").map((t) => t.trim()).filter(Boolean),
        attackStat,
      ),
    onSuccess: setResolved,
  });

  const [attackType, setAttackType] = useState("Fire");
  const [defenderTypes, setDefenderTypes] = useState("Grass,Bug");
  const [typeResult, setTypeResult] = useState<TypeEffectivenessResult | null>(null);

  const resolveType = useMutation({
    mutationFn: () =>
      api.resolveTypeEffectiveness(
        contentPackId,
        attackType.trim(),
        defenderTypes.split(",").map((t) => t.trim()).filter(Boolean),
      ),
    onSuccess: setTypeResult,
  });

  const carried = profile.pokemon.filter((p) => p.storage_state === "carried");

  return (
    <div className="sheet-grid">
      <section>
        <h2>Combat Controls</h2>
        <div className="button-row">
          <button type="button" onClick={() => nextRound.mutate()} disabled={nextRound.isPending}>
            Next Round
          </button>
          <button type="button" onClick={() => endScene.mutate()} disabled={endScene.isPending}>
            End Scene
          </button>
          <button type="button" onClick={() => newDay.mutate()} disabled={newDay.isPending}>
            New Day
          </button>
        </div>
        {(nextRound.isSuccess || endScene.isSuccess || newDay.isSuccess) && (
          <p role="status" className="callout-info">
            Usage counters reset.
          </p>
        )}
      </section>

      <section>
        <h2>Trainer Combat State</h2>
        {profile.combat ? (
          <dl className="kv-list">
            <dt>HP</dt>
            <dd>{profile.combat.current_hp ?? "—"}</dd>
            <dt>AP</dt>
            <dd>
              {profile.combat.ap_current ?? "—"} (bound {profile.combat.ap_bound ?? 0}, drained{" "}
              {profile.combat.ap_drained ?? 0})
            </dd>
          </dl>
        ) : (
          <p>No combat state recorded yet.</p>
        )}
      </section>

      <section>
        <h2>Carried Pokémon</h2>
        {carried.length === 0 && <p>No Pokémon currently carried.</p>}
        <ul className="pokemon-list">
          {carried.map((p) => (
            <li key={p.id} className="pokemon-card">
              <strong>{p.nickname || p.species_definition_id}</strong>
              {p.battle_state ? (
                <>
                  <span>
                    {" "}
                    HP {p.battle_state.current_hp} (+{p.battle_state.temporary_hp} temp) · Statuses:{" "}
                    {p.battle_state.statuses.join(", ") || "none"}
                  </span>
                  <div className="button-row" style={{ marginTop: "0.3em" }}>
                    {(["attack", "defense", "special_attack", "special_defense", "speed"] as const)
                      .filter((stat) => p.battle_state!.combat_stages[stat] !== 0)
                      .map((stat) => (
                        <StatBadge key={stat} stat={stat} value={p.battle_state!.combat_stages[stat]} />
                      ))}
                  </div>
                </>
              ) : (
                <span> no battle state recorded</span>
              )}
              <PokemonMoveResolver pokemon={p} contentPackId={contentPackId} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Resolved Move (manual entry)</h2>
        <p className="section-subtitle">
          For a move that isn't on a carried Pokémon's move list yet, or to check a hypothetical combination.
        </p>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            resolveDamage.mutate();
          }}
        >
          <label htmlFor="move-db">Move DB</label>
          <input id="move-db" type="number" value={moveDb} onChange={(e) => setMoveDb(Number(e.currentTarget.value))} />
          <label htmlFor="move-type">Move type</label>
          <input id="move-type" value={moveType} onChange={(e) => setMoveType(e.currentTarget.value)} />
          <label htmlFor="actor-types">Actor types (comma-separated)</label>
          <input id="actor-types" value={actorTypes} onChange={(e) => setActorTypes(e.currentTarget.value)} />
          <label htmlFor="attack-stat">Attack stat</label>
          <input
            id="attack-stat"
            type="number"
            value={attackStat}
            onChange={(e) => setAttackStat(Number(e.currentTarget.value))}
          />
          <label htmlFor="damage-class">Class (display only)</label>
          <select id="damage-class" value={damageClass} onChange={(e) => setDamageClass(e.currentTarget.value as "Physical" | "Special")}>
            <option value="Physical">Physical</option>
            <option value="Special">Special</option>
          </select>
          <button type="submit" disabled={resolveDamage.isPending}>
            Resolve
          </button>
        </form>
        {resolveDamage.isError && <ErrorState error={resolveDamage.error} />}
        {resolved && (
          <div>
            <div className="button-row" style={{ marginBottom: "0.4em" }}>
              <TypeBadge type={moveType} />
              <MoveCategoryBadge category={damageClass} />
            </div>
            <p>
              STAB {resolved.stab_applies ? "applies" : "does not apply"} → DB {resolved.base_db} → {resolved.final_db} →{" "}
              <strong>{resolved.damage_expression}</strong> (display only, no dice rolled)
            </p>
          </div>
        )}
      </section>

      <section>
        <h2>Type Effectiveness</h2>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            resolveType.mutate();
          }}
        >
          <label htmlFor="attack-type">Attack type</label>
          <input id="attack-type" value={attackType} onChange={(e) => setAttackType(e.currentTarget.value)} />
          <label htmlFor="defender-types">Defender types (comma-separated)</label>
          <input id="defender-types" value={defenderTypes} onChange={(e) => setDefenderTypes(e.currentTarget.value)} />
          <button type="submit" disabled={resolveType.isPending}>
            Resolve
          </button>
        </form>
        {resolveType.isError && <ErrorState error={resolveType.error} />}
        {typeResult && (
          <div>
            <div className="button-row" style={{ marginBottom: "0.4em" }}>
              <TypeBadge type={attackType} />
              <span>attacking</span>
              {defenderTypes.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
            <p>
              {typeResult.weak_count} weak / {typeResult.resistant_count} resistant
              {typeResult.immune ? " / immune" : ""} → ×{typeResult.multiplier}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
