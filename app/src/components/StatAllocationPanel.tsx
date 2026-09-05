import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, StatAllocationDraftEntry, TrainerCombatStat, TrainerProfile } from "../lib/api";
import { AdaptivePanel } from "./AdaptivePanel";
import { ErrorState, Loading } from "./StateViews";
import { STATS as STAT_COLORS } from "../lib/pokemonPalette";

const STATS: { key: TrainerCombatStat; label: string }[] = [
  { key: "hp", label: "HP" },
  { key: "attack", label: "Attack" },
  { key: "defense", label: "Defense" },
  { key: "special_attack", label: "Sp. Attack" },
  { key: "special_defense", label: "Sp. Defense" },
  { key: "speed", label: "Speed" },
];

type Draft = Record<TrainerCombatStat, number>;

/** Seeds the editable draft from the Trainer's actually-persisted normal
 * (Creation + LevelUp) points per stat — never a fabricated/zero starting
 * point, and never touching Milestone/GM Override provenance, which this
 * panel never edits (T13C1: save always carries those forward untouched
 * via `merge_with_preserved_provenance` on the Rust side). */
function draftFromProfile(profile: TrainerProfile): Draft {
  const draft: Draft = { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 };
  for (const entry of profile.stat_allocation.entries) {
    if (entry.source === "creation" || entry.source === "level_up") draft[entry.stat] += entry.points;
  }
  return draft;
}

function toDesired(draft: Draft): StatAllocationDraftEntry[] {
  return STATS.map(({ key }) => ({ stat: key, points: draft[key] }));
}

/** T13C1: the guided Stat Point allocation panel — the corrective response
 * to the T13 UX GATE failure "Trainer attributes cannot be filled or
 * distributed". The user only ever adjusts one combined points-per-stat
 * number; Rust alone (`preview_trainer_stat_allocation` /
 * `save_trainer_stat_allocation`) decides how that splits into
 * provenance-correct Creation/LevelUp entries, validates it, and reports
 * the real floor/points/remaining numbers — nothing here recomputes a PTU
 * rule. Preview never persists; Cancel is guaranteed non-mutating because
 * it never calls the save command at all. */
export function StatAllocationPanel({
  open,
  onClose,
  profile,
  contentPackId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  profile: TrainerProfile;
  contentPackId: string;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFromProfile(profile));

  // Re-seed from the real persisted allocation every time the panel opens,
  // so Cancel is trivially non-mutating (nothing to roll back — the next
  // open just reads persisted state again) and re-opening after a Save
  // resumes from what was actually saved.
  useEffect(() => {
    if (open) setDraft(draftFromProfile(profile));
  }, [open, profile]);

  const desired = toDesired(draft);
  const preview = useQuery({
    queryKey: ["trainer-stat-allocation-preview", profile.id, contentPackId, JSON.stringify(desired)],
    queryFn: () => api.previewTrainerStatAllocation(profile.id, contentPackId, desired),
    enabled: open,
  });

  const save = useMutation({
    mutationFn: () => api.saveTrainerStatAllocation(profile.id, contentPackId, desired),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  const blockingIssue = preview.data?.validation.find((i) => i.severity === "error");

  return (
    <AdaptivePanel open={open} onClose={onClose} title="Allocate Stat Points">
      {preview.isLoading && <Loading label="Resolving allocation…" />}
      {preview.isError && <ErrorState error={preview.error} onRetry={() => preview.refetch()} />}

      {preview.data && (
        <>
          <p className="allocation-summary-badge">
            {preview.data.allocation_summary.spent} of {preview.data.allocation_summary.granted} points allocated ·{" "}
            {preview.data.allocation_summary.remaining} remaining
          </p>

          {preview.data.validation.map((issue, i) => (
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

          <div className="stat-allocation-rows">
            {STATS.map(({ key, label }) => {
              const resolved = preview.data!.combat_stats[key];
              const floor = resolved.base - draft[key];
              const dotColor = STAT_COLORS[key]?.base ?? "var(--ui-primary)";
              return (
                <div className="stat-allocation-row" key={key}>
                  <span className="stat-allocation-dot" style={{ background: dotColor }} aria-hidden="true" />
                  <span className="stat-allocation-label">{label}</span>
                  <span className="stat-allocation-floor">Floor {floor}</span>
                  <button
                    type="button"
                    aria-label={`Decrease ${label}`}
                    disabled={draft[key] <= 0}
                    onClick={() => setDraft((d) => ({ ...d, [key]: Math.max(0, d[key] - 1) }))}
                  >
                    −
                  </button>
                  <input
                    aria-label={`${label} points`}
                    type="number"
                    min={0}
                    value={draft[key]}
                    onChange={(e) => {
                      const points = Math.max(0, Number(e.currentTarget.value) || 0);
                      setDraft((d) => ({ ...d, [key]: points }));
                    }}
                  />
                  <button type="button" aria-label={`Increase ${label}`} onClick={() => setDraft((d) => ({ ...d, [key]: d[key] + 1 }))}>
                    +
                  </button>
                  <span className="stat-allocation-resolved">= {resolved.base}</span>
                </div>
              );
            })}
          </div>

          {save.isError && <ErrorState error={save.error} />}

          <div className="button-row">
            <button type="button" onClick={onClose} disabled={save.isPending}>
              Cancel
            </button>
            <button type="button" onClick={() => save.mutate()} disabled={save.isPending || !!blockingIssue}>
              {save.isPending ? "Saving…" : "Save Allocation"}
            </button>
          </div>
        </>
      )}
    </AdaptivePanel>
  );
}
