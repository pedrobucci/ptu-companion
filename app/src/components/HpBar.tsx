/** HP bar with the traditional threshold behavior (canvas note
 * "pokemon-ui-design-compliance" §6): green above 50%, yellow 20-50%, red
 * below 20%, a distinct "fainted" look at 0. */
export function HpBar({ current, max }: { current: number; max: number }) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.max(0, Math.min(1, current / safeMax));
  const percent = Math.round(ratio * 100);

  let state: "ok" | "warning" | "danger" | "fainted" = "ok";
  if (current <= 0) state = "fainted";
  else if (ratio < 0.2) state = "danger";
  else if (ratio <= 0.5) state = "warning";

  return (
    <div className="hp-bar" role="meter" aria-valuenow={current} aria-valuemin={0} aria-valuemax={max} aria-label="HP">
      <div className="hp-bar-track">
        <div className="hp-bar-fill" data-state={state} style={{ width: `${percent}%` }} />
      </div>
      <span className="hp-bar-label">
        {current} / {max}
      </span>
    </div>
  );
}
