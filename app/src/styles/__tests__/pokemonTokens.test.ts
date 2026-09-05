import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ITEM_CATEGORIES, MOVE_CATEGORIES, STATS, TYPES } from "../../lib/pokemonPalette";
import { contrastRatio, pickTextColor } from "../../lib/color";

const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), "../pokemon-tokens.css");
const css = readFileSync(cssPath, "utf-8");

function cssVarValue(name: string): string | null {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  return match ? match[1].toLowerCase() : null;
}

/** Guards against the JS palette (used for text-color decisions) and the
 * CSS custom properties (used for painting) drifting apart — both must
 * describe the exact same 18-type / 13-item / 6-stat / 3-move-category
 * light/base/dark catalog from the design-compliance note. */
describe("pokemon-tokens.css matches src/lib/pokemonPalette.ts", () => {
  const cssPrefixByGroup: Record<string, (key: string) => string> = {
    type: (k) => `type-${k}`,
    item: (k) =>
      ({
        general: "item-general",
        medicine: "item-medicine",
        pokeball: "item-pokeball",
        tm: "item-tm",
        berry: "item-berry",
        battle: "item-battle",
        key: "item-key",
        mail: "item-mail",
        treasure: "item-treasure",
        ingredient: "item-ingredient",
        zcrystal: "item-zcrystal",
        apricorn: "item-apricorn",
        cologne: "item-cologne",
      })[k]!,
    stat: (k) =>
      ({
        hp: "stat-hp",
        attack: "stat-atk",
        defense: "stat-def",
        special_attack: "stat-spatk",
        special_defense: "stat-spdef",
        speed: "stat-speed",
      })[k]!,
    move: (k) => `move-${k}`,
  };

  it.each(Object.entries(TYPES))("type %s", (key, triad) => {
    for (const variant of ["light", "base", "dark"] as const) {
      expect(cssVarValue(`type-${key}-${variant}`)).toBe(triad[variant]);
    }
  });

  it.each(Object.entries(ITEM_CATEGORIES))("item category %s", (key, triad) => {
    const prefix = cssPrefixByGroup.item(key);
    for (const variant of ["light", "base", "dark"] as const) {
      expect(cssVarValue(`${prefix}-${variant}`)).toBe(triad[variant]);
    }
  });

  it.each(Object.entries(STATS))("stat %s", (key, triad) => {
    const prefix = cssPrefixByGroup.stat(key);
    for (const variant of ["light", "base", "dark"] as const) {
      expect(cssVarValue(`${prefix}-${variant}`)).toBe(triad[variant]);
    }
  });

  it.each(Object.entries(MOVE_CATEGORIES))("move category %s", (key, triad) => {
    for (const variant of ["light", "base", "dark"] as const) {
      expect(cssVarValue(`move-${key}-${variant}`)).toBe(triad[variant]);
    }
  });

  it("HP green triad matches the HP stat triad and warning/danger are present", () => {
    expect(cssVarValue("hp-green-light")).toBe(STATS.hp.light);
    expect(cssVarValue("hp-green-base")).toBe(STATS.hp.base);
    expect(cssVarValue("hp-green-dark")).toBe(STATS.hp.dark);
    expect(cssVarValue("hp-warning")).toBe("#fac000");
    expect(cssVarValue("hp-danger")).toBe("#ee1515");
  });
});

/** §9/§11/§15: every badge background must clear a real contrast minimum
 * against whichever text color pickTextColor() selects — not just "look
 * ok". 3:1 is the WCAG minimum for large/UI-component text/graphics; all
 * 40 base tokens (18 types + 13 items + 6 stats + 3 move categories) are
 * checked here, one assertion per token, so a future palette change that
 * breaks contrast fails a named test instead of silently shipping. */
describe("badge background/text contrast (WCAG UI-component minimum 3:1)", () => {
  const allBaseTokens: [string, string][] = [
    ...Object.entries(TYPES).map(([k, t]) => [`type:${k}`, t.base] as [string, string]),
    ...Object.entries(ITEM_CATEGORIES).map(([k, t]) => [`item:${k}`, t.base] as [string, string]),
    ...Object.entries(STATS).map(([k, t]) => [`stat:${k}`, t.base] as [string, string]),
    ...Object.entries(MOVE_CATEGORIES).map(([k, t]) => [`move:${k}`, t.base] as [string, string]),
  ];

  it.each(allBaseTokens)("%s base color has a legible text color", (_name, hex) => {
    const text = pickTextColor(hex);
    expect(contrastRatio(hex, text)).toBeGreaterThanOrEqual(3);
  });
});

/** T13R2 shell tokens (T13R1_DESIGN_CONTRACT.md §2/§12): the desktop
 * sidebar's navy background and the primary/active accent must clear the
 * WCAG AA minimum for real body text (4.5:1), not just the looser 3:1
 * UI-component minimum used for badges above — sidebar labels are read as
 * text, not glanced at as a color chip. */
describe("T13R2 shell surface contrast (WCAG AA text minimum 4.5:1)", () => {
  const pairs: [string, string, string][] = [
    ["surface-nav-vs-white-label", cssVarValue("surface-nav") ?? "", "#ffffff"],
    ["pk-blue-vs-white (nav-link-active / primary buttons)", cssVarValue("pk-blue") ?? "", "#ffffff"],
    ["surface-card-vs-body-text", cssVarValue("surface-card") ?? "", "#0f0f0f"],
  ];

  it.each(pairs)("%s clears 4.5:1", (_name, bg, fg) => {
    expect(bg).not.toBe("");
    expect(contrastRatio(bg, fg)).toBeGreaterThanOrEqual(4.5);
  });
});
