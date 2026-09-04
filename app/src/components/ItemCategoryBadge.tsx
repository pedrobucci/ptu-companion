import { ITEM_CATEGORIES, ITEM_CATEGORY_ALIASES, normalizeKey } from "../lib/pokemonPalette";
import { pickTextColor } from "../lib/color";

/** Item-category badge (canvas note "pokemon-ui-design-compliance" §3, 13
 * categories). Accepts either a canonical key ("pokeball") or a loose
 * label as it may appear in authored content ("Poké Balls") — see
 * ITEM_CATEGORY_ALIASES. Unrecognized categories fall back to "general"
 * rather than rendering unstyled. */
export function ItemCategoryBadge({ category }: { category: string }) {
  const key = normalizeKey(category);
  const canonical = ITEM_CATEGORY_ALIASES[key] ?? (key in ITEM_CATEGORIES ? key : "general");
  const triad = ITEM_CATEGORIES[canonical] ?? ITEM_CATEGORIES.general;
  return (
    <span
      className="semantic-badge"
      data-testid="item-category-badge"
      data-category={canonical}
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
