import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, GmGrant, TrainerCollection, TrainerCoreResult, TrainerProfile } from "../../lib/api";
import { Empty, ErrorState, Loading } from "../../components/StateViews";
import { ProvenanceBadge } from "../../components/ProvenanceBadge";
import { CollectionManager } from "../../components/CollectionManager";
import { ResolvedStat } from "../../components/ResolvedStat";
import { STATS as STAT_COLORS } from "../../lib/pokemonPalette";
import { StatAllocationPanel } from "../../components/StatAllocationPanel";
import { Avatar } from "../../components/Avatar";
import { useAppStore } from "../../store/appStore";

/** Flows 10 (guided level-up) and 11 (GM grants survive respec).
 * `openAllocationOnMount` (T13C1): set by `TrainerSheet` right after a
 * fresh Trainer creation navigates here, so the guided Stat Point
 * allocation panel is reachable immediately — the T13 UX GATE's material
 * finding was that attributes could not be filled/distributed at all. */
export function OverviewTab({
  profile,
  refetch,
  openAllocationOnMount = false,
}: {
  profile: TrainerProfile;
  refetch: () => void;
  openAllocationOnMount?: boolean;
}) {
  const contentPackId = useAppStore((s) => s.activeContentPackId);
  const queryClient = useQueryClient();
  const [allocationOpen, setAllocationOpen] = useState(openAllocationOnMount);
  // T13C1 AC: "a legal allocation saves atomically and the Trainer sheet
  // immediately shows matching base/final/breakdown and Max HP results" —
  // `TrainerCoreStatsSection`'s resolved-stats query has its own cache key
  // that `refetch()` (the outer profile reload) never touches, so it must
  // be invalidated explicitly or it would keep showing pre-save values.
  const onAllocationSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["trainer-core-stats", profile.id, contentPackId] });
    refetch();
  };
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
      <section className="card">
        <div className="card-header">Trainer</div>
        <div className="identity-hero">
          <Avatar label={profile.name} />
          <div>
            <p className="identity-hero-name">{profile.name}</p>
            {profile.background && <p className="identity-hero-rank">{String(profile.background.name ?? "")}</p>}
          </div>
        </div>
        <dl className="kv-list">
          <dt>Level</dt>
          <dd>{profile.level}</dd>
          <dt>EXP</dt>
          <dd>{profile.exp}</dd>
          <dt>Money</dt>
          <dd>₽{profile.money}</dd>
        </dl>
      </section>

      <SkillsSection skills={profile.skills} />

      <TrainerCoreStatsSection profile={profile} onOpenAllocation={() => setAllocationOpen(true)} />

      <EquipmentBackpackSummary profile={profile} />

      <section className="card">
        <div className="card-header">Temporary Modifiers</div>
        <Empty>No temporary modifiers are tracked yet — duration-bearing modifiers are a later task.</Empty>
      </section>

      <section className="card">
        <div className="card-header">Level Up</div>
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

      <section className="card">
        <div className="card-header">GM Grants</div>
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

      <section className="card">
        <div className="card-header">Moves, Edges, Features, Abilities, Capabilities</div>
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

      <StatAllocationPanel
        open={allocationOpen}
        onClose={() => setAllocationOpen(false)}
        profile={profile}
        contentPackId={contentPackId}
        onSaved={onAllocationSaved}
      />
    </div>
  );
}

/** Flat skill-rank list — T13R1_DESIGN_CONTRACT.md §10.3: display
 * `profile.skills` as-is, never fabricate a Body/Mind/Spirit grouping the
 * domain doesn't model (T15B §3.4: the rules engine keeps skills fully
 * data-driven). An untouched Trainer's `skills` is empty/null — that's a
 * real, honest empty state, not a loading failure. */
function SkillsSection({ skills }: { skills: Record<string, unknown> | null }) {
  const entries = skills ? Object.entries(skills) : [];
  return (
    <section className="card">
      <div className="card-header">Skills</div>
      {entries.length === 0 ? (
        <Empty>No skills recorded yet.</Empty>
      ) : (
        <ul className="definition-card-list" style={{ listStyle: "none", padding: 0 }}>
          {entries.map(([skillId, value]) => {
            const rank =
              value && typeof value === "object" && "base_rank" in (value as object)
                ? String((value as Record<string, unknown>).base_rank)
                : "—";
            return (
              <li key={skillId} className="definition-card">
                <span className="definition-card-name" style={{ textTransform: "capitalize" }}>
                  {skillId.replace(/-/g, " ")}
                </span>
                <span className="definition-card-badges">{rank}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** T15A's PTU 1.05 Core Step 6 combat stats + derived capabilities,
 * resolved entirely in Rust (plan constraint: "no rule computation in
 * React") — every value carries its own base/breakdown via `ResolvedStat`.
 * Validation issues (e.g. an incomplete allocation on a freshly created
 * Trainer) are surfaced honestly, never hidden behind a fabricated number
 * (plan AC: "a permanent unavailable callout, fabricated number, or
 * zero-default fails the task" — the Step 6 floor values are real Core
 * values, not zero-defaults, so they're shown even when incomplete). */
function TrainerCoreStatsSection({ profile, onOpenAllocation }: { profile: TrainerProfile; onOpenAllocation: () => void }) {
  const contentPackId = useAppStore((s) => s.activeContentPackId);
  const coreStats = useQuery<TrainerCoreResult>({
    queryKey: ["trainer-core-stats", profile.id, contentPackId],
    queryFn: () => api.resolveTrainerCoreStats(profile.id, contentPackId),
  });

  return (
    <section className="card card-span-full">
      <div className="card-header">
        Combat Stats &amp; Step 6 Capabilities
        <div className="card-header-actions">
          <button type="button" onClick={onOpenAllocation}>
            Allocate Stat Points
          </button>
        </div>
      </div>
      <p className="section-subtitle">PTU 1.05 Core Step 6, resolved in Rust — tap a value for its breakdown.</p>
      {coreStats.isLoading && <Loading label="Resolving Trainer attributes…" />}
      {coreStats.isError && <ErrorState error={coreStats.error} onRetry={() => coreStats.refetch()} />}
      {coreStats.data && (
        <>
          {coreStats.data.validation.map((issue, i) => (
            <p
              key={i}
              role={issue.severity === "error" ? "alert" : "status"}
              className={
                issue.severity === "error" ? "callout-danger" : issue.severity === "warning" ? "callout-warning" : "callout-info"
              }
            >
              {issue.message}
            </p>
          ))}
          <div className="card-grid">
            <ResolvedStat label="HP" value={coreStats.data.combat_stats.hp} accent={STAT_COLORS.hp.base} />
            <ResolvedStat label="Max HP" value={coreStats.data.max_hp} accent={STAT_COLORS.hp.base} />
            <ResolvedStat label="Attack" value={coreStats.data.combat_stats.attack} accent={STAT_COLORS.attack.base} />
            <ResolvedStat label="Defense" value={coreStats.data.combat_stats.defense} accent={STAT_COLORS.defense.base} />
            <ResolvedStat
              label="Sp. Attack"
              value={coreStats.data.combat_stats.special_attack}
              accent={STAT_COLORS.special_attack.base}
            />
            <ResolvedStat
              label="Sp. Defense"
              value={coreStats.data.combat_stats.special_defense}
              accent={STAT_COLORS.special_defense.base}
            />
            <ResolvedStat label="Speed" value={coreStats.data.combat_stats.speed} accent={STAT_COLORS.speed.base} />
            <ResolvedStat label="AP" value={coreStats.data.ap} />
            <ResolvedStat label="Power" value={coreStats.data.power} />
            <ResolvedStat label="Physical Evasion" value={coreStats.data.physical_evasion} />
            <ResolvedStat label="Special Evasion" value={coreStats.data.special_evasion} />
            <ResolvedStat label="Speed Evasion" value={coreStats.data.speed_evasion} />
            <ResolvedStat label="High Jump" value={coreStats.data.high_jump} />
            <ResolvedStat label="Long Jump" value={coreStats.data.long_jump} />
            <ResolvedStat label="Overland" value={coreStats.data.overland} />
            <ResolvedStat label="Swim" value={coreStats.data.swim} />
            <ResolvedStat label="Throwing Range" value={coreStats.data.throwing_range} />
          </div>
          <dl className="kv-list">
            <dt>Size</dt>
            <dd>{coreStats.data.size}</dd>
            <dt>Weight Class</dt>
            <dd>
              {coreStats.data.weight.weight_class
                ? coreStats.data.weight.weight_class.toUpperCase()
                : coreStats.data.weight.weight_lb == null
                  ? "Not entered"
                  : "Out of the supported range"}
            </dd>
          </dl>
        </>
      )}
    </section>
  );
}

/** Compact summary only — full inventory/equipment management stays on the
 * existing "Inventory & Shop" tab; this just makes the dashboard AC's
 * "equipment/backpack summaries" bullet real without duplicating that tab. */
function EquipmentBackpackSummary({ profile }: { profile: TrainerProfile }) {
  const equippedCount = Object.keys(profile.inventory.equipped).length;
  return (
    <section className="card">
      <div className="card-header">Equipment &amp; Backpack</div>
      <dl className="kv-list">
        <dt>Equipped</dt>
        <dd>{equippedCount === 0 ? "Nothing equipped" : `${equippedCount} slot(s) filled`}</dd>
        <dt>Backpack</dt>
        <dd>{profile.inventory.backpack.length === 0 ? "Empty" : `${profile.inventory.backpack.length} item stack(s)`}</dd>
      </dl>
      <p className="section-subtitle">Manage items and equipment from the "Inventory &amp; Shop" tab above.</p>
    </section>
  );
}
