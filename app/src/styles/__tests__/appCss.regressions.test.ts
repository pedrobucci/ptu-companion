import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(resolve(here, "../pokemon-tokens.css"), "utf-8");
const appCss = readFileSync(resolve(here, "../../App.css"), "utf-8");

/** T13C2 REWORK regressions (Reviewer BLOCKER + MAJOR on the T13C2 VISUAL
 * REVIEW GATE). `vitest.config.ts` sets `css: false` — real stylesheets
 * are never applied in jsdom here, so a computed-style assertion can't
 * exist; these check the fix at the CSS source level instead, matching
 * `pokemonTokens.test.ts`'s existing established pattern for this
 * project. Component-level coverage that the fixed classes actually reach
 * the DOM lives in `OverviewTab.test.tsx`. */
describe("T13C2 REWORK — card-header button contrast (BLOCKER)", () => {
  it("gives every button inside .card-header its own explicit, non-white color instead of inheriting the header's white text over the button's white face", () => {
    const rule = tokensCss.match(/\.card-header button\s*\{([^}]*)\}/);
    expect(rule, ".card-header button rule must exist").not.toBeNull();
    const body = rule![1];
    expect(body).toMatch(/color:\s*[^;]+;/);
    expect(body).not.toMatch(/color:\s*#fff\b/i);
    expect(body).not.toMatch(/color:\s*white\b/i);
  });

  it("gives .card-header buttons a visible (non-blue-on-blue) focus outline", () => {
    const rule = tokensCss.match(/\.card-header button:focus-visible\s*\{([^}]*)\}/);
    expect(rule, ".card-header button:focus-visible rule must exist").not.toBeNull();
    expect(rule![1]).not.toMatch(/outline:\s*2px solid var\(--ui-primary\)/);
  });
});

describe("T13C2 REWORK — card-span-full utility (MAJOR)", () => {
  it("spans the full .sheet-grid row via grid-column, so a nested multi-tile grid isn't squeezed into one auto-fit column", () => {
    const rule = appCss.match(/\.card-span-full\s*\{([^}]*)\}/);
    expect(rule, ".card-span-full rule must exist").not.toBeNull();
    expect(rule![1]).toMatch(/grid-column:\s*1\s*\/\s*-1/);
  });
});
