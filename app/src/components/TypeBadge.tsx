import { MOVE_CATEGORIES, TYPES, normalizeKey } from "../lib/pokemonPalette";
import { pickTextColor } from "../lib/color";

/** Type badge per the Pokémon UI design reference (canvas note
 * "pokemon-ui-design-compliance" §2): semantic base color per game type,
 * with text color chosen for contrast rather than fixed white — several
 * types (Electric, Ice, Fairy…) are too light for white text to clear a
 * real contrast minimum. Unknown types (homebrew, typos) fall back to the
 * Normal-type token rather than rendering unstyled. */
export function TypeBadge({ type }: { type: string }) {
  const key = normalizeKey(type);
  const resolvedKey = key in TYPES ? key : "normal";
  const triad = TYPES[resolvedKey];
  return (
    <span
      className="semantic-badge"
      data-testid="type-badge"
      data-type={resolvedKey}
      style={
        {
          "--badge-bg": triad.base,
          "--badge-fg": pickTextColor(triad.base),
        } as React.CSSProperties
      }
    >
      {type}
    </span>
  );
}

/** Physical/Special/Status damage-class badge, same reference (§5). */
export function MoveCategoryBadge({ category }: { category: string }) {
  const key = normalizeKey(category);
  const resolvedKey = key in MOVE_CATEGORIES ? key : "status";
  const triad = MOVE_CATEGORIES[resolvedKey];
  return (
    <span
      className="move-category-badge"
      data-testid="move-category-badge"
      data-category={resolvedKey}
      style={
        {
          "--badge-bg": triad.base,
          "--badge-fg": pickTextColor(triad.base),
        } as React.CSSProperties
      }
    >
      {category}
    </span>
  );
}
