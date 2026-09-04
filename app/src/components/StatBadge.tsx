import { STATS, normalizeKey } from "../lib/pokemonPalette";
import { pickTextColor } from "../lib/color";

const STAT_LABELS: Record<string, string> = {
  hp: "HP",
  attack: "Atk",
  defense: "Def",
  special_attack: "SpAtk",
  special_defense: "SpDef",
  speed: "Speed",
};

/** Stat badge (canvas note "pokemon-ui-design-compliance" §4, 6 stats).
 * `stat` is the canonical key (hp/attack/defense/special_attack/
 * special_defense/speed); `value` is shown alongside so a viewer never
 * has to infer the number from color alone. */
export function StatBadge({ stat, value }: { stat: string; value: number | string }) {
  const key = normalizeKey(stat).replace(/\s+/g, "_");
  const resolvedKey = key in STATS ? key : "hp";
  const triad = STATS[resolvedKey];
  return (
    <span
      className="semantic-badge"
      data-testid="stat-badge"
      data-stat={resolvedKey}
      style={
        {
          "--badge-bg": triad.base,
          "--badge-fg": pickTextColor(triad.base),
        } as React.CSSProperties
      }
    >
      {STAT_LABELS[resolvedKey] ?? stat} {value}
    </span>
  );
}
