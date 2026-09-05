# T13C2 — Visual Recomposition Against the 13 References

**Status:** REWORKED — resubmitted to the T13C2 VISUAL REVIEW GATE (Reviewer) after a REWORK/HIGH verdict on the first submission
**Plan:** `.maestri/roles/d6bf77c1-15d8-4cd1-b989-cf5004ccc3e9/T13_UX_CORRECTIVE_REPLAN.md`, Task T13C2
**Preserves:** T13C1 (ACCEPT/ACHIEVED, no findings) and T13R3's technical ACCEPT — no data query, mutation, or resolver behavior changed by this task; only markup structure and CSS.

This is a Worker self-assessment, not a Reviewer approval. It answers "does the implementation appear to satisfy T13C2" — the Reviewer independently judges whether the objective was actually achieved.

---

## 0. REWORK — Reviewer findings and fixes

The Reviewer's independent verification (own browser walkthrough) returned **REWORK/HIGH** on the first submission, with two findings. Both are fixed below; no T13C1 logic, data, or mutation was touched.

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | BLOCKER | The literal "Allocate Stat Points" button — the direct fix for the original UAT complaint — was invisible: it's a plain `<button>` inside `.card-header`, which sets `color: #fff`; the button inherited that white text while the global `button` rule kept its `background: #fff` — white text on a white face. | Added an explicit `.card-header button` rule (`pokemon-tokens.css`) with its own `color: var(--ui-primary)`, hover/disabled states, and a white (not blue) `:focus-visible` outline so it isn't blue-on-blue either. Re-verified via a Style Gallery fixture button in the same DOM position (§2). |
| 2 | MAJOR | `TrainerCoreStatsSection`'s 16-tile Combat Stats grid is its own `.card-grid` nested inside a `.card` that itself only ever got one `.sheet-grid` auto-fit column (~18-24em) — nowhere near enough width for more than one column, so it rendered as a long single-column list with roughly half the screen empty, nothing like the reference's compact block. | Added a `.card-span-full { grid-column: 1 / -1; }` utility (`App.css`) and applied it to that one section only (`OverviewTab.tsx`) — every other `.sheet-grid` card keeps its normal auto-fit column. At the ≤640px breakpoint `.sheet-grid` is already a single column, so this is a no-op there — Android reflow is unaffected. |

Both regressions are now covered by tests (new, not present before this REWORK): `appCss.regressions.test.ts` asserts the CSS source contains the fixed rules (this project's established CSS-testing pattern — `vitest.config.ts` sets `css: false`, so no computed-style assertion is possible here, matching `pokemonTokens.test.ts`'s existing approach); `OverviewTab.test.tsx` adds a render-level assertion that the Combat Stats `<section>` actually carries `card-span-full` in the live component tree, not just that the CSS rule exists on disk.

---

## 1. What changed, per direct surface

The shared `.card`/`.card-header` primitive already existed (built in T13R2, per `T13R1_DESIGN_CONTRACT.md` §2) and already implemented the references' exact "bold blue header bar + white rounded card body" pattern — it just wasn't applied consistently, and the header text wasn't uppercase. This task's core move was closing that consistency gap plus adding the identity/accent primitives the references use everywhere:

- **`pokemon-tokens.css`**: `.card-header` now renders bold + uppercase + letter-spaced (one token-level change, so every existing `.card` usage picked it up automatically). Added `.avatar`/`.identity-hero` (circular initials avatar + name/rank stack — no portrait art ships, per the existing media-fallback policy, T13R1 §10.8) and a `.resolved-stat` accent border + dot.
- **Home** (`Home.tsx`): Active Trainer card now uses the identity-hero (avatar + name + level/EXP/money); added a "Quick Actions" card with 4 colored action buttons (Open Roster / Add Creature / View Items / Shop), reusing existing item-category color tokens rather than inventing new colors.
- **Trainer Overview/allocation** (`OverviewTab.tsx`, `StatAllocationPanel.tsx`): every section (Trainer/Skills/Combat Stats/Equipment/Temporary Modifiers/Level Up/GM Grants/Collections) converted from a plain `<section><h2>` to `.card`/`.card-header`. Trainer identity is now a hero row. The six Combat Stats now carry their real stat-color accent (border + dot) via a new optional `ResolvedStat` `accent` prop — never re-deriving the color from anything but the existing `--stat-*-base` tokens. `StatAllocationPanel` rows now show a colored stat dot per row and a pill-badge "N of M points allocated · R remaining" summary, matching the level-up-wizard reference's per-stat stepper layout.
- **Rosters** (`Rosters.tsx`): roster cards now show COMBAT/COMPANY/MOUNT/TRADE pill badges, derived purely from the existing `RosterRecord.rules` flags (T13R1 §8.3 — a display-only gap, not a new field).
- **Creature sheet** (`CreatureSheet.tsx`): identity moved into a hero row (avatar + name + type badges + level), and HP/Combat Stats/Identity/Moves sections converted to `.card`/`.card-header`.
- **Pokédex** (`Pokedex.tsx`): adopted the shared `PageHeader` primitive for title/subtitle consistency with every other screen. View vs. Add remain the pre-existing distinct controls (T13R3); not restructured, since there is no single 1:1 reference image for this screen — the plan's own scope for it is "apply the shared searchable-library/selected-detail/staged-confirmation patterns," which the screen already implements.
- **A real layout bug found and fixed during visual verification**: `.stat-allocation-row`'s CSS Grid used `auto` for the +/- stepper button columns with no `fr` track elsewhere, so the buttons stretched to absorb all leftover row width. Fixed to fixed-width columns; caught via the browser screenshot below, not by test coverage (no test asserts computed width).

## 2. Screenshot evidence

`npm run dev`'s existing Vite server (already running at `localhost:1420` before this session) was driven via Chrome automation. Two hard constraints limited what evidence could be captured — both discovered and verified this session, not assumed:

1. **No live-data screenshots are possible.** `app/src/lib/api.ts` calls `@tauri-apps/api/core`'s `invoke`, which requires the Tauri IPC bridge (`window.__TAURI_INTERNALS__`). That bridge does not exist in a plain Chrome tab hitting the Vite dev server directly — confirmed by clicking "Create Trainer" and observing the real error `Cannot read properties of undefined (reading 'invoke')` (screenshot below). This means every screen that needs `api.*` data (Trainer Overview with a real Trainer, the allocation panel, a real roster, a real creature) can only be screenshotted in its honest empty/error state from this environment, not with real persisted content.
2. **`resize_window` did not change the actual viewport this session.** It reported success for every requested size (390×844, 800×600, 1672×941, on two different tabs), but `window.innerWidth`/`innerHeight` read via JS stayed fixed regardless. Filed as a product bug. Practical effect: I could not produce genuine 360×800/390×844/412×915 (mobile) or exact 1672×941/1440×900 (desktop) pixel evidence this session — every screenshot below was captured at whatever the tab's real (undetermined, environment-controlled) window size was.

What I *could* verify honestly, and did:

| Surface / state | What it shows | Screenshot |
|---|---|---|
| Home, no active Trainer (real, honest empty state) | Navy sidebar, header, `.card`/`.card-header` shell composition | `screenshot-1788562424430-0.jpg` |
| Trainers list + real Tauri-IPC-unavailable error | Proves constraint #1 above; also shows `ErrorState`'s real styling | (captured inline, not saved) |
| Pokédex, no query yet | `PageHeader` adoption, shared shell | `screenshot-1788562566718-2.jpg` |
| **Style Gallery** (`/dev/style-gallery`, T13R2's fixture-data-only verification route — no `api.*` call, so it renders fully) — extended this task with Identity hero, Roster kind badges, Quick actions, and a static Stat allocation row sample | Direct visual proof that every new T13C2 primitive renders with the correct references-matched styling (uppercase blue card headers, colored stat dots, colored roster/quick-action pills, HP-bar states) | `screenshot-1788562827555-5.jpg`, `screenshot-1788562971906-6.jpg` (after the grid-stretch fix) |
| **Style Gallery, REWORK fix #1** — the "Card with header" fixture now includes a `.card-header-actions` button in the exact DOM position the real "Allocate Stat Points" button occupies | Shows the white pill / blue text button clearly readable on the blue header bar, confirming the BLOCKER fix | `screenshot-1788564144436-7.jpg` |

No horizontal overflow was observed at the environment's real window width (`document.documentElement.scrollWidth` ≤ `window.innerWidth`, checked via JS).

**What this evidence does not prove**, stated plainly rather than implied: genuine 360/390/412px mobile rendering, and genuine live-data rendering of Home/Trainer-allocation/Pokédex-add/creature-sheet/Rosters with a real Trainer. The mobile bottom-bar/stacked-grid behavior is implemented via the pre-existing `@media (max-width: 640px)` rule (T13R2, previously verified) plus one narrow addition this task (the stat-allocation-row wrap, §1) — code-reviewed, not pixel-verified this session. **The REWORK's MAJOR fix (`.card-span-full` on the 16-tile Combat Stats block) is likewise not screenshot-verified with live data** for the same reason — it's covered instead by a render-level test asserting the class reaches the real DOM (§0), plus the CSS mechanics themselves (`grid-column: 1 / -1` inside a CSS Grid parent) are standard, well-understood behavior, not a novel or fragile technique. A Tauri desktop smoke session (already scoped as its own T13C3 verification step) is the correct place to close all of these gaps with genuine live-data, correct-viewport evidence.

## 3. Compliance audit — `pokemon-ui-design-compliance.md` §11 scoring

Worker self-audit against the doc's own weighted rubric. Reviewer should independently re-score.

| Category | Weight | Score | Why |
|---|---:|---:|---|
| 18 types | 25 | 24 | `TypeBadge` covers all 18 (+ Stellar) tokens, applied consistently wherever species/move type is shown (creature sheet header, `DefinitionDetail`, Pokédex detail) |
| Branding global | 10 | 9 | Navy sidebar, blue/red brand mark, primary-blue actions consistent app-wide; notification bell deliberately omitted (no backing feature, documented divergence — not a defect) |
| Stats | 10 | 9 | `StatBadge` (pre-existing) + new colored dot per row in the allocation panel + new colored accent border on the 6 Combat Stats in `ResolvedStat` — all via `--stat-*-base` tokens, never a new color |
| Moves | 10 | 8 | `MoveCategoryBadge`/`TypeBadge` already applied to move rows (`PokemonMoveResolver`, `DefinitionDetail`) — not freshly re-verified this session (not in T13C2's direct-surface list) |
| Items | 10 | 8 | `ItemCategoryBadge` (pre-existing, 13 categories) + item-category tokens now also drive Home's Quick Actions and Roster-kind badges |
| HP and states | 10 | 10 | `HpBar` green/yellow/red/fainted re-verified via screenshot this session at the exact documented thresholds |
| UI components | 15 | 13 | Card/header/nav/button/form/feedback states extended consistently across all 5 T13C2 direct surfaces; other tabs (Pokémon/Combat/Inventory/Editor) intentionally out of this task's scope and still plain |
| Consistency & tokens | 5 | 5 | Every new color is an existing CSS custom property (`--stat-*`, `--item-*`, `--pk-*`, `--ui-*`) — zero new arbitrary hex values |
| Accessibility | 5 | 4 | Focus-visible/aria-label/color-never-alone patterns preserved and extended (new `aria-hidden` decorative dots/avatar, `aria-label`s on steppers); contrast was not independently re-measured with an automated tool this session |
| **Total** | **100** | **90** | Meets the AC's "at least 90/100" floor |

**FAIL check** (doc §15's explicit FAIL list): none apply — types/moves/items/HP all remain visually distinguishable via tokens, no component uses a single flat color for a differentiated category, and no arbitrary/incompatible color was introduced anywhere in this diff.

## 4. Reference traceability

`T13R1_DESIGN_CONTRACT.md` §8's per-reference matrix (all 13 images) remains the structural source of truth and is unchanged by this task — T13C2 did not alter which route/data model owns which reference region, only how the already-mapped regions are *rendered*. The 5 direct-target references (dashboard, trainer dashboard, roster management, creature sheet, level-up wizard) are the ones whose implemented screens changed this task, per §1 above; the remaining 8 (storage/inventory/shop/npc-journal/4 editors) continue to contribute only their shared shell/card/tab/validation pattern, as already documented — unchanged, since T13C2 explicitly does not implement their functionality.

## 5. Divergence log addendum (extends `T13R1_DESIGN_CONTRACT.md` §13)

| Divergence | Rationale |
|---|---|
| Stat-allocation rows use a colored dot + numeric stepper, not the wizard's mini progress-bar-per-stat | A progress bar needs a maximum to size against; no real per-stat maximum exists in the domain (only a shared points *budget*, already shown as the summary pill) — inventing one would be a fabricated rule, which T13C1/T13C2 both explicitly forbid |
| Trainer identity card shows no XP progress bar (only a plain EXP number) | The mockups' XP bar implies a known next-level threshold; `TrainerProfile` doesn't expose one to the frontend — showing a bar against an invented denominator would misrepresent real progress |
| Avatar is always initials-on-gradient, never a portrait | No portrait art ships with the app (pre-existing media policy, T13R1 §10.8) |

## 6. Verification

* `npm run typecheck` — PASS
* `npx vitest run` — 142 passed (13 files), 0 regressions (138 before the REWORK's 4 new regression tests: 3 in `appCss.regressions.test.ts`, 1 in `OverviewTab.test.tsx`)
* `npm run build` — clean production build
* Manual browser walkthrough (Style Gallery + Home + Trainers + Pokédex) — see §2; found and fixed one real CSS grid bug (`.stat-allocation-row` stepper-button stretch) during the initial pass, and re-verified the REWORK's BLOCKER fix (header-action button contrast) via an extended Style Gallery fixture — see §0/§2

## 7. What's explicitly NOT done here (correctly out of scope)

T13C3 (evidence package: real Tauri-backed journeys, genuine desktop+360/390/412 screenshots, full 13-reference matrix refresh), T13R4, T14, full T15, and later remain unauthorized and untouched, per the plan's sequential gating and the user's explicit instruction.
