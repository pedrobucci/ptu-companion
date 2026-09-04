import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, GmGrant, TrainerCollection, TrainerProfile } from "../../lib/api";
import { ErrorState } from "../../components/StateViews";
import { ProvenanceBadge } from "../../components/ProvenanceBadge";
import { CollectionManager } from "../../components/CollectionManager";
import { useAppStore } from "../../store/appStore";

/** Flows 10 (guided level-up) and 11 (GM grants survive respec). */
export function OverviewTab({ profile, refetch }: { profile: TrainerProfile; refetch: () => void }) {
  const contentPackId = useAppStore((s) => s.activeContentPackId);
  const [levelUpPreview, setLevelUpPreview] = useState<null | {
    baseline_stat_point: number;
    baseline_feature: number;
    baseline_edge: number;
    milestone_choice_required: boolean;
  }>(null);

  const previewLevelUp = useMutation({
    mutationFn: () => api.levelUpTrainer(contentPackId, profile.level + 1),
    onSuccess: (result) => setLevelUpPreview(result),
  });

  const applyLevelUp = useMutation({
    mutationFn: async () => {
      if (!levelUpPreview) return;
      const nextLevel = profile.level + 1;
      const progressionEntry = {
        level: nextLevel,
        stat_points: levelUpPreview.baseline_stat_point,
        features: levelUpPreview.baseline_feature,
        edges: levelUpPreview.baseline_edge,
        milestone_choice_required: levelUpPreview.milestone_choice_required,
      };
      await api.saveTrainer({
        ...profile,
        level: nextLevel,
        progression: [...profile.progression, progressionEntry],
      });
    },
    onSuccess: () => {
      setLevelUpPreview(null);
      refetch();
    },
  });

  const respec = useMutation({
    mutationFn: () => api.respecProgression(profile.id, []),
    onSuccess: () => refetch(),
  });

  const reallocate = useMutation({
    mutationFn: (grant: GmGrant & { kind: "resource" }) => {
      const newAllocation = window.prompt("New allocation for this resource grant:", String(grant.allocation ?? ""));
      if (newAllocation === null) return Promise.resolve(null);
      return api.reallocateResourceGrant(profile.id, grant.id, newAllocation);
    },
    onSuccess: () => refetch(),
  });

  return (
    <div className="sheet-grid">
      <section>
        <h2>Identity</h2>
        <dl className="kv-list">
          <dt>Level</dt>
          <dd>{profile.level}</dd>
          <dt>EXP</dt>
          <dd>{profile.exp}</dd>
          <dt>Money</dt>
          <dd>₽{profile.money}</dd>
        </dl>

        {profile.background && (
          <>
            <h3>Background</h3>
            <p>{String(profile.background.name ?? "")}</p>
          </>
        )}
      </section>

      <section>
        <h2>Level Up</h2>
        <button type="button" onClick={() => previewLevelUp.mutate()} disabled={previewLevelUp.isPending}>
          Preview Level {profile.level + 1}
        </button>
        {previewLevelUp.isError && <ErrorState error={previewLevelUp.error} />}
        {levelUpPreview && (
          <div className="level-up-preview">
            <p>
              +{levelUpPreview.baseline_stat_point} Stat Point, +{levelUpPreview.baseline_feature} Feature, +
              {levelUpPreview.baseline_edge} Edge
            </p>
            {levelUpPreview.milestone_choice_required && (
              <p className="callout-warning" role="status">
                A milestone choice is required at this level — resolve it before applying.
              </p>
            )}
            <button type="button" onClick={() => applyLevelUp.mutate()} disabled={applyLevelUp.isPending}>
              Apply Level Up
            </button>
          </div>
        )}
      </section>

      <section>
        <h2>GM Grants</h2>
        <button type="button" onClick={() => respec.mutate()} disabled={respec.isPending}>
          Respec (rebuild progression ledger)
        </button>
        {respec.isSuccess && (
          <p role="status" className="callout-info">
            Progression ledger reset. GM Grants below are untouched by a respec.
          </p>
        )}
        {profile.gm_grants.length === 0 ? (
          <p>No GM grants.</p>
        ) : (
          <ul className="gm-grant-list">
            {profile.gm_grants.map((grant) => (
              <li key={grant.id}>
                <ProvenanceBadge
                  variant="gm"
                  label={grant.kind === "fixed" ? `GM Fixed: ${grant.target}` : `GM Resource: ${grant.resource}`}
                  detail={<pre>{JSON.stringify(grant, null, 2)}</pre>}
                />
                {grant.kind === "resource" && (
                  <button type="button" onClick={() => reallocate.mutate(grant)} disabled={reallocate.isPending}>
                    Reallocate
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Moves, Edges, Features, Abilities, Capabilities</h2>
        <p>Unlimited Trainer Move list (spec §7) — no fixed-size cap here.</p>
        {(["moves", "edges", "features", "abilities", "capabilities"] as TrainerCollection[]).map((collection) => (
          <CollectionManager
            key={collection}
            label={collection}
            entries={profile[collection]}
            onAdd={async (id) => {
              await api.addTrainerCollectionEntry(profile.id, collection, { definition_version_id: id });
              refetch();
            }}
            onRemove={async (id) => {
              await api.removeTrainerCollectionEntry(profile.id, collection, id);
              refetch();
            }}
          />
        ))}
      </section>
    </div>
  );
}
