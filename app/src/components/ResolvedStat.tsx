import { AdaptivePanel } from "./AdaptivePanel";
import { useState } from "react";
import type { ResolvedValue } from "../lib/api";

/** Renders one Rust-resolved value (base/final/breakdown) — the shared
 * "source explanation" pattern the T13R3 Trainer dashboard AC requires.
 * Never recomputes anything; only displays exactly what the resolver
 * returned (T15A's `resolve_trainer_core_stats`, etc.). The breakdown is
 * disclosed via a tap/click toggle rather than hover, so it behaves
 * identically on touch and desktop. */
export function ResolvedStat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: ResolvedValue;
  suffix?: string;
  /** T13C2: an optional stat-color token (e.g. `var(--stat-hp-base)`) for
   * the six Combat Stats, matching the references' colored per-stat icon —
   * omitted for every other derived value (AP, Power, Evasion, jumps...),
   * which don't have one of the compliance doc's 6 stat colors to borrow. */
  accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const hasBreakdown = value.breakdown.length > 0;

  return (
    <div className="resolved-stat" style={accent ? ({ "--resolved-stat-accent": accent } as React.CSSProperties) : undefined}>
      <button
        type="button"
        className="resolved-stat-trigger"
        onClick={() => hasBreakdown && setOpen((o) => !o)}
        aria-expanded={hasBreakdown ? open : undefined}
        disabled={!hasBreakdown}
      >
        <span className="resolved-stat-label">
          {accent && <span className="resolved-stat-dot" style={{ background: accent }} aria-hidden="true" />}
          {label}
        </span>
        <span className="resolved-stat-value">
          {value.final_value}
          {suffix}
        </span>
      </button>
      {hasBreakdown && (
        <AdaptivePanel open={open} onClose={() => setOpen(false)} title={`${label} — sources`}>
        <ul className="resolved-stat-breakdown">
          <li>Base {value.base}</li>
          {value.breakdown.map((entry, i) => (
            <li key={i}>
              {entry.label}: {entry.operation} {entry.value} → {entry.resulting_value}
            </li>
          ))}
        </ul>
        </AdaptivePanel>
      )}
    </div>
  );
}
