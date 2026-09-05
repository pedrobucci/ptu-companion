# T13R1 — Reference-Derived Experience Contract

**Status:** DELIVERED — awaiting DESIGN-CONTRACT GATE (Reviewer + user)
**Plan:** `.maestri/roles/d6bf77c1-15d8-4cd1-b989-cf5004ccc3e9/t13-visual-reference-replan.md`, Task T13R1
**Scope:** Documentation/contract/evidence only. No production UI, model, or migration changes are made by this task.
**Inputs inspected:** all 13 PNGs in `images/`, `README_VISUAL_INDEX.md`, `pokemon-ui-design-compliance.md`, checkpoint `ac889ad`, current uncommitted diff (`App.tsx`, `App.css`, `icons.tsx`, `TrainerSheet.tsx`), `app/src/**`, `app/crates/domain/src/profile/model.rs`, `app/src/lib/api.ts`, `TECHNICAL_SPECIFICATION_v1.0.md`.

This document is the acceptance surface for the DESIGN-CONTRACT GATE. It does not implement anything; T13R2 (shell/primitives) and T13R3 (real-data slice) build against it.

---

## 1. What already exists (do not rebuild)

Confirmed by reading the current tree, not assumed:

| Capability | Where | Reuse in this contract |
|---|---|---|
| Search-by-name picker (never a raw id) | `DefinitionPicker.tsx` | Species/Edge/Feature search everywhere §9, §14 |
| Typed, readable definition detail + raw source text | `DefinitionDetail.tsx` | Species/move/ability detail panels |
| Resolved-without-re-entry move damage | `PokemonMoveResolver.tsx` | Creature sheet move detail |
| Owned-collection row (resolved name + badges + remove) | `CollectionManager.tsx` / `.definition-card` | Trainer/Pokémon Moves, Edges, Features, Abilities, Capabilities lists |
| Explainable modifier resolution (`base` → `final_value` + `BreakdownEntry[]`) | `resolveModifierValue` (api.ts / spec §15.1) | Derived-stat "why" tooltip (Trainer dashboard Sp.Atk 63 (Base 58) pattern) |
| HP threshold bar (green/yellow/red/fainted) | `HpBar.tsx` | Creature sheet, roster cards, storage cards |
| Type / move-category badges, full 18-type + item + stat token set | `TypeBadge.tsx`, `ItemCategoryBadge.tsx`, `StatBadge.tsx`, `pokemon-tokens.css` | All type/category-colored surfaces |
| Responsive shell: sidebar → fixed bottom bar at ≤640px | `App.tsx` `NAV_ITEMS`, `App.css` (uncommitted) | Base for §5/§6 below |
| Breadcrumb-back for list→detail screens | `.breadcrumb-back`, used in `TrainerSheet.tsx` | Creature sheet, Roster detail, NPC detail |
| Storage injury invariant (server-enforced) | `transfer_to_storage` command + `PokemonTab.tsx` error handling | Storage screen §8.5 |
| Multi-roster membership, roster `rules` flags (`combat`/`personal_use`/`trade`/`mount`) | `RosterRecord.rules` (spec §9) | Roster kind badges (COMBAT/COMPANY/MOUNT) §8.3 |
| Cart-shaped checkout (`CartLine[]`, atomic `checkout_buy`/`checkout_sell`) | api.ts | Shop cart §8.7 (T18) |
| `activeTrainerId` slot | `store/appStore.ts` | **Declared but never set or read anywhere** — see §10.1, this is a load-bearing gap |

**Gap classes used throughout the matrix below:**
- **NEW ROUTE** — no page exists today.
- **NEW FIELD** — spec-supported persisted field with no typed model today.
- **NEW COMMAND** — spec-supported mutation with no Tauri command today.
- **WIRING** — the data/command already exists; only UI composition is missing.
- **ENGINE** — depends on the T15 modifier/resolution engine, not yet built.
- **ILLUSTRATIVE** — mockup value with no PTU/spec support; excluded, see §11.

---

## 2. Visual token contract (extends `pokemon-tokens.css`)

`pokemon-tokens.css` already carries brand, all 18 types, 13 item categories, 6 stats, 3 move categories, HP states, a type scale, and a spacing scale (verified by reading the file). It does **not** yet carry a radius/elevation/surface scale — `App.css` currently hardcodes `border-radius: 6px/8px/999px` and one hand-written `box-shadow` at 18 separate call sites (verified by grep). T13R2 must add the following to the same file rather than starting a parallel theme:

```css
/* Surfaces (light default; dark handled the same way pokemon-tokens.css
   already handles brand — no separate dark file) */
--surface-canvas: #f0f0f0;      /* pk-white, page background */
--surface-card: #ffffff;
--surface-nav: #1c2b4a;         /* navy sidebar/app-bar, distinct from pk-blue accents */
--surface-nav-active: rgba(255,255,255,0.12);

/* Radius scale (replaces the 6px/8px/999px literals in App.css) */
--radius-sm: 6px;   /* inputs, chips */
--radius-md: 10px;  /* cards, panels — mockups use visibly rounder cards than
                        the current 8px; T13R2 raises the card radius here,
                        the deliberate divergence is recorded in §13 */
--radius-lg: 16px;  /* dashboard summary cards, wizards */
--radius-pill: 999px;

/* Elevation (mockups' flat-drop-shadow cards; no literal device bezel) */
--elevation-1: 0 1px 3px rgba(0,0,0,0.08);
--elevation-2: 0 6px 18px rgba(0,0,0,0.12); /* matches existing AdaptivePanel shadow */

/* Component-state tokens (semantic info is never color-only — pairs with
   an icon/text/aria change, never color alone) */
--state-focus-ring: 0 0 0 3px rgba(42,117,187,0.45); /* pk-blue */
--state-hover-tint: rgba(42,117,187,0.08);
--state-selected-border: var(--pk-blue);
--state-disabled-opacity: 0.5;
--state-skeleton-base: #e6e6e6;
--state-skeleton-shine: #f4f4f4;
```

**Not new tokens** — reused as-is: `--hp-green-base/--hp-warning/--hp-danger` for validation-panel severities (info=--ui-primary, warning=--hp-warning, danger=--hp-danger), matching the ability/move editor mockups' green/yellow/red validation rows.

---

## 3. Icon & media policy

Extends `T13_INTERACTION_PATTERNS.md` pattern 5 (hand-authored inline SVG, `stroke="currentColor"`, `em`-sized, `aria-hidden` by default). No icon library is introduced (Ponytail §5: existing tool is sufficient and already proven across 5 icons in the uncommitted diff).

New icons required by this contract (add to `icons.tsx`, same `Svg` wrapper):

| Icon | Used for |
|---|---|
| `IconCreatures` (paw/pokéball outline) | Creatures nav |
| `IconRoster` (grid/team) | Rosters nav |
| `IconBag` | Items nav |
| `IconStorage` (box) | Storage nav |
| `IconShop` (storefront) | Shop nav |
| `IconJournal` | NPC Journal nav |
| `IconSparkle` | Level-up wizard entry point |
| `IconMore` (kebab/grid) | Android "More" menu |

**Explicitly not added:** a notification-bell icon with a numeric badge. The mockups show a bell with "3" on every screen, but no notification model/command exists anywhere in the domain (confirmed by search). Per the plan's dead-destination rule this is treated the same as Battle Log/Quests (§6): omitted from the shell until a notification feature is separately planned and approved. The header's icon area in T13R2 carries only the account/avatar affordance and the search entry point (§9), not an unbacked bell.

**Media policy** (spec §20, already normative, restated as contract): default imagery is lightweight/offline; custom Pokémon and NPC images go through the existing image service (decode → enforce max dimensions → WebP derivative → UUID reference in SQLite), never eagerly loaded in list views. Where no image exists, every card/sheet must remain legible from text + type/category badges alone (mockups' portrait art is illustrative, not a hard requirement — A16, A19). No Pokémon sprite, logo, or character artwork from `images/` is shipped as a product asset.

---

## 4. Component state contract

Every shared primitive from T13R2 (§7 of the plan's task list) must implement, and this contract defines, these states — satisfying the "cover... validation, focus, disabled, hover, selected, loading, empty, and error states" acceptance criterion:

| State | Rule |
|---|---|
| Hover | `--state-hover-tint` background shift; no color-only affordance on non-interactive rows |
| Focus | visible `--state-focus-ring` on every interactive element, including custom rows (`.pokemon-card`, `.trainer-list-item`) — never suppressed |
| Disabled | `--state-disabled-opacity` + `cursor: not-allowed`; disabled buttons never silently no-op (existing `isPending` disable pattern in every Tab file is correct and continues) |
| Selected | `--state-selected-border` left/ring, plus `aria-selected`/`aria-current` — matches the existing `nav-link-active` and virtual-row `aria-selected` pattern |
| Loading | skeleton blocks using `--state-skeleton-base/-shine`, or the existing `Loading` component for query-level waits — never a blank screen |
| Empty | existing `Empty` component/`.state-empty` class, reused verbatim | 
| Error | existing `ErrorState` component/`.state-error` class with retry, reused verbatim |
| Validation | `.callout-info/-warning/-danger` (existing, per `T13_INTERACTION_PATTERNS.md` #9) drive the move/ability/species editor validation panels (§8.10-§8.12) — no new severity system |

---

## 5. Desktop shell contract

- Persistent left sidebar (`--surface-nav`), icon + label per destination (§6), active item gets `--surface-nav-active` + left accent bar (extends the existing `nav-link-active` pattern, not a rebuild).
- Header/context bar: app mark + name, a search affordance that focuses/opens `/pokedex`'s existing search (WIRING, not a new command), account/avatar menu. No notification bell (§3).
- Content canvas: `--surface-canvas` background, cards on `--surface-card` with `--radius-md`/`--elevation-1`, dense multi-column grids where the mockups show them (dashboard 3-column summary row, Trainer sheet 4-column derived-stat grid).
- Side detail panes / popovers use the existing `AdaptivePanel` (already renders centered on wide viewports, bottom sheet on narrow — one implementation, not two, per its own doc comment).

## 6. Android shell contract

- Bottom tab bar, exactly 5 destinations + `More`: **Home, Creatures, Rosters, Items, More** (plan text, §7 scope). This is a narrowing of the desktop's fuller sidebar, not a second independent nav surface — same `NAV_ITEMS`-style data-driven list feeding a mobile-specific render, consistent with `T13_INTERACTION_PATTERNS.md` pattern 7.
- `More` opens a sheet/drawer exposing: Storage, Shop, NPC Journal, Rulesets, Settings, and (Windows-only banner, disabled) Editor — satisfying A19 ("Android must preserve readable/view-only... journeys but need not expose advanced structural editors").
- Safe-area padding, `env(safe-area-inset-bottom)` (already present in the uncommitted `App.css` diff — kept).
- Detail/checkout surfaces become bottom sheets (`AdaptivePanel`'s existing narrow-viewport behavior) — matches the shop mockup's explicit "Android Bottom Sheet Checkout" caption.

---

## 7. Navigation destination table

| Label | Icon | Route | Owning task | Existing today? | Notes |
|---|---|---|---|---|---|
| Home | `IconHome` | `/` | T13R3 (redesign) | Yes, bare (`Home.tsx` is 3 lines of status text) | |
| Creatures | `IconBook` (existing) | `/pokedex` | T13R3 (add-flow), T14/T15 (full sheet) | Yes, read-only search+detail | Route path kept for minimal diff; nav label changes to "Creatures" |
| Rosters | `IconRoster` | `/rosters` | T13R3 (minimal), T17 (full) | No — roster CRUD is nested inside `PokemonTab` | NEW ROUTE |
| Items | `IconBag` | `/items` | T13R3 (wires active-Trainer context), T18 (full) | No top-level route; `InventoryTab` nested | NEW ROUTE, WIRING on `activeTrainerId` (§10.1) |
| Storage | `IconStorage` | `/storage` | T17 | Commands exist (`transfer_to_storage/carried`); no dedicated screen | NEW ROUTE |
| Shop | `IconShop` | `/shop` | T18 | `getShop`/`checkoutBuy`/`checkoutSell` exist; only a single-fixture inline list in `InventoryTab` | NEW ROUTE |
| NPC Journal | `IconJournal` | `/npc-journal` | T18 | `profile.npcs: Value[]` untyped, no UI | NEW ROUTE + NEW FIELDs (spec §12 baseline) |
| Rulesets | (existing settings icon) | `/settings` (existing "Active Ruleset" + pack table section) | T18 for switching/impact preview | Yes, read-only | No new route for T13R2; promote to a distinct sidebar entry only if T18 adds switching UI worth a dedicated screen |
| Editor | `IconWrench` (existing) | `/editor` | T19 | Yes, Move-only flat form | Windows-only; Android shows disabled banner per A19 |
| Settings | `IconSettings` (existing) | `/settings` | existing | Yes | |

**Deliberately omitted — no dead destination:**

| Reference item | Why omitted | Path to inclusion |
|---|---|---|
| Battle Log | No model, command, or spec section defines it anywhere in the repo (confirmed by search of `app/` and the technical spec). The generic `profile.timeline: Value[]` is an internal history ledger, not a designed "Battle Log" feature/screen. | Requires a separately planned and approved task before it can appear in any nav. |
| Quests | Same — zero domain support. | Same. |
| Notification bell + count | No notification model/command exists. | Same. |

This satisfies the plan's acceptance criterion directly: every reference nav item either has an owning task/route above, or is listed here with the reason it's absent.

---

## 8. Screen-by-screen reference matrix

Desktop region/action → route/view model/existing capability/gap/task/responsive transformation, for all 13 references.

### 8.1 `ptu_companion_dashboard_showcase.png` — Home

| Region | Action | Route/view model | Existing capability | Gap | Task | Mobile transform |
|---|---|---|---|---|---|---|
| Header (logo, search, avatar) | search opens Creatures search; avatar opens account/trainer-switch | `/`, focuses `/pokedex` | `searchContent` command | none (WIRING) | T13R3 | Header collapses to icon row |
| Active Trainer card | click → open Trainer sheet | `TrainerSummary` + `activeTrainerId` | `listTrainers`/`loadTrainer` | `activeTrainerId` never set (§10.1) | T13R3 | Full-width stacked card |
| Active Roster preview (6/6 grid) | click creature → creature sheet; "View Roster" → `/rosters` | `RosterRecord` + carried `PokemonInstance[]` | roster membership exists | no "active roster" selection concept (which roster is "the" active one — `RosterRecord.active: bool` exists but unused in UI) | T13R3 (wire `active` flag), T17 (full) | Horizontal scroll strip |
| Recent Creatures ("View All") | click → creature sheet | subset of `profile.pokemon` | pokemon list exists | no "recently added" ordering (no `created_at`/timeline hook on Pokémon add) | T13R3 (sort by array-append order as an honest proxy, disclosed) | Stacked list |
| Inventory preview | "View All" → `/items` | `InventoryRecord.backpack` | exists | top-N preview composition only | T13R3 | Collapsed to 2-3 rows |
| Shop preview card | "View Shop" → `/shop` | `ShopPreset` | exists (fixture-scoped) | real catalog is T18 | T13R3 links to existing fixture shop; T18 full | Card becomes single CTA |
| Ruleset Status card | "View Rules" → `/settings` | `activeRulesetName`/`listContentPacks` | exists, read-only | none | T13R3 | Compact 3-stat row (existing pattern in mockup's mobile crop) |
| Quick Actions grid | Open Roster / Add Creature / View Items / Shop | nav shortcuts | — | "Add Creature" needs the selection contract, §9 | T13R3 | 2-column grid |
| Badges / Wins / Rating | — | — | — | **Wins/Rating are ILLUSTRATIVE, excluded (§11).** Badges (achievement count) has no spec/domain support either — also excluded pending a future confirmed requirement. | — | — |
| Notification bell (3) | — | — | — | no notification system | omitted, §3/§7 | — |

### 8.2 `ptu_companion_trainer_dashboard.png` — Trainer sheet ("Sheet" tab)

| Region | Action | Route/view model | Existing capability | Gap | Task | Mobile transform |
|---|---|---|---|---|---|---|
| Identity card (name, gender, rank badge, level/XP) | — | `TrainerProfile.name/level/exp` | exists | Gender not typed (spec §7 identity includes it); "rank badge" ("Rookie Tamer") maps to the Trainer's **Class feature**, resolvable today via `profile.features` + `DefinitionDetail` — a display gap, not a schema gap | T14 (gender field), T13R3 (render resolved class label from existing `features` collection) | Full-width card |
| Money / PTU Points | — | `profile.money` | exists | "PTU Points" has no spec/domain definition found — flag as **ILLUSTRATIVE unless T15 defines a points economy**; do not add a field for it now | T15 (if confirmed) | inline row |
| Class Summary (Tamer Rank/Region/ID/Guild/Join Date) | — | — | — | **ILLUSTRATIVE (§11)** — none of these five fields exist in spec §7; only the Class-feature-derived label above is legitimate | — | — |
| Active roster preview | click → `/rosters` | same as §8.1 | — | — | T13R3 | horizontal strip |
| Temporary Modifiers panel (Well Rested +5% XP 29m, Minor Injury -5% SpA 14m, ...) | — | none typed today | `GmGrant` exists but has no expiry/duration | **NEW FIELD**: a duration-bearing modifier is not the same shape as a `GmGrant` (spec §15 Modifier Engine has `duration` semantics for moves but Trainer-level timed buffs aren't in §7's persisted-groups list as durable state — this is T15/engine scope) | T15 (ENGINE) | same, stacked |
| Skills (Body/Mind/Spirit groups, named skills + values) | click skill → breakdown tooltip | `profile.skills: Value` (generic map by design — model.rs: "the rules engine... needs to interpret a skill rank") | generic skills map exists | Body/Mind/Spirit as **fixed categories is not spec-defined** (spec keeps skills fully data-driven); T14 must render whatever grouping the active content pack's skill definitions declare, or fall back to a flat list — never a hardcoded 3-category enum | T14, T15 (breakdown values via `resolveModifierValue`, already the correct shape) | Tabs instead of 3 columns |
| Derived Stats (HP/STA/ATK/DEF/SpA/SpD/ACC/EVA + tooltip breakdown) | click stat → breakdown popover | none typed on `TrainerProfile` today | `resolveModifierValue` → `ResolvedValue{base, final_value, breakdown}` is the **exact correct shape** already, just not yet fed real Trainer base values | ENGINE: Trainer base-stat derivation (from stat-point allocation, spec §17.1) doesn't exist yet | T15 (ENGINE), T13R3 consumes the existing `ResolvedValue` shape once fed | 2-column grid |
| Capabilities (Carry Capacity, Tamer Rank, Creature Synergy) | — | — | — | Carry Capacity is plausibly derivable from Strength/Str stat (needs confirmation against source PTU rules before modeling — flag, don't invent); "Tamer Rank"/"Creature Synergy" as capability labels are **ILLUSTRATIVE**, no spec support found | flag to Planner if pursued | — |
| Weapon Moves (PP tracking) | — | `profile.moves` (unlimited list per spec §7) | exists, no PP field | move PP/frequency tracking is spec §13 ("move/feature/ability usage counters") — not yet on `TrainerCollection` entries | T14 | list |
| Equipment (6 visual slots) | — | `InventoryRecord.equipped: Record<slot,item>` | exists, generic map | spec §10 already names the canonical slot set (Head, Body, Main Hand, Off-Hand, Feet, Accessory) — no schema change needed, just a fixed-slot UI instead of the current free-text slot input in `InventoryTab` | T14 | 2×3 grid → stacked |
| Backpack preview | "View All Items" → `/items` | `InventoryRecord.backpack` | exists | preview composition | T13R3 | 4-item row |
| GM Override toggle | — | per-action override exists (`recordGmOverride`, used today only for Pokémon level-up validation) | partial | a persistent header-level "GM Override" mode toggle (vs. today's per-action prompt) is a UX change, not a data gap | T14 | hidden behind a menu |

### 8.3 `ptu_companion_roster_management_ui.png` — Rosters (`/rosters`, NEW ROUTE)

| Region | Action | Route/view model | Existing capability | Gap | Task | Mobile transform |
|---|---|---|---|---|---|---|
| Roster tabs w/ kind badge (COMBAT/COMPANY/MOUNT) | switch roster | `RosterRecord[]` | `rules: {combat, personal_use, trade, mount}` already models this per spec §9 example | badge is a **derived label from existing `rules` flags** — display-only gap | T13R3 (minimal: list + membership), T17 (drag/drop, filters, sort) | horizontal scroll chips |
| Creature grid + "drag to add" | drag or (keyboard/button equivalent, required — plan constraint) | `addRosterMembership`/`removeRosterMembership` | exist | UI only; drag/drop must ship with an explicit-button equivalent per plan constraint | T17 | 2-col grid, press-and-hold or explicit "Add to roster" button replaces drag |
| Selected creature side panel (Poké Ball type, memberships, stats preview) | — | `PokemonInstance.capture_ball_item_id`, `roster_memberships` | exist | "stats preview" needs the same ENGINE gap as §8.2 | T13R3 (identity/type/level only), T15 (stats) | becomes a bottom sheet |
| "Create Roster" | opens form | `addRoster` | exists | none | T13R3 | modal → full-screen sheet |

### 8.4 `ptu_companion_creature_sheet_mockup.png` — Individual creature sheet (`/pokemon/:id`, NEW ROUTE)

| Region | Action | Route/view model | Existing capability | Gap | Task | Mobile transform |
|---|---|---|---|---|---|---|
| Header (species, type, OT, ID, level) | "Back to Roster" breadcrumb | `PokemonInstance` + resolved species `DefinitionDetail` | species resolution via `resolveDefinition("species", ...)` exists | no dedicated page composing these — today only inline in `PokemonTab`'s card | T13R3 (minimal slice route) | `.breadcrumb-back` pattern (existing) |
| HP bar + Injured badge | — | `battle_state.current_hp`/`injuries` | `HpBar` component exists | Injured badge is `injuries > 0`, already computed in `PokemonTab` inline — needs porting, not building | T13R3 | same |
| Loyalty hearts | — | none typed | spec §8.2 lists "loyalty" as persisted permanent state | **NEW FIELD** | T14 | same |
| Held Item / Nature | — | `held_item_id` exists; Nature does not | spec §8.2 lists Nature as persisted | **NEW FIELD** (Nature); held item display is WIRING | T14 | same |
| Capabilities / Skills chips (Levitate, Prankster, Stealth +3...) | — | `pokemon.capabilities` (refs) exist; per-instance skills do not | spec §8.2 lists "skills and permanent skill adjustments" for Pokémon | **NEW FIELD** (Pokémon skills) | T14 | wraps to 2 rows |
| Combat Stats block (HP/Atk/Def/SpA/SpD/Speed) | — | none — species `base_stats` is empty in every imported pack today (disclosed gap, `T13_INTERACTION_PATTERNS.md` #3) | `PokemonMoveResolver` already discloses this exact gap with a `callout-warning` | ENGINE + DATA: base stats absent from imported content | T13R3 shows the disclosed-gap callout (reuse pattern 9) where data is missing, real values where present | same |
| Temporary Stages | — | `battle_state.combat_stages` | exists, `StatBadge` renders it (used in `CombatTab` today) | only present while carried — correct per spec | WIRING | same |
| Move List + move detail popup | click move → detail (power/acc/PP/effect/target/priority) | `pokemon.moves` + `resolveDefinition("move", ...)` | `DefinitionDetail`/`PokemonMoveResolver` cover this almost verbatim | porting into a dedicated tab, not new logic | T13R3 | `AdaptivePanel` → bottom sheet (existing) |
| Status Conditions (e.g. "Curse Mark, 2 turns") | — | `battle_state.statuses: string[]` (free text, no duration) | partial | duration-bearing status entries are spec §13 ("status conditions" + "frequency-use counters") — need structured shape, not just strings | T15 (ENGINE) | same |
| Terrain & Weather | — | none | not in spec's Pokémon-instance or Trainer sections; this is scene/encounter state | **out of current spec scope** — flag to Planner if pursued, do not invent | flag | same |
| Last Battle summary | — | none, `profile.timeline` is generic | spec §18 History model exists generically | needs a typed "battle summary" projection over timeline events | T14/T15 | same |

### 8.5 `ptu_companion_storage_management_ui.png` — Storage (`/storage`, NEW ROUTE, T17)

| Region | Action | Route/view model | Existing capability | Gap | Task | Mobile transform |
|---|---|---|---|---|---|---|
| Box tabs (Box 1, 1/20) | switch box | none | `storage_state: carried\|stored` exists; no per-box index | **NEW FIELD**: a `box` index/label is not in spec §8.2/§8.3 — spec's storage invariant (§8.3) doesn't require box partitioning; treat "boxes" as a client-side pagination convenience over the stored set unless PTU rules require true separate boxes (flag before modeling as a persisted field) | T17, flag | Box switch becomes `‹ Box 1 ›` stepper (already shown in mobile crop) |
| Pokémon Storage / Item Storage tabs | switch | `storage_state`; `InventoryRecord.storage` | both exist | Item Storage has zero UI today | T17 | tab bar |
| Store/Withdraw buttons | move between backpack (carried) and storage | `transfer_to_storage`/`transfer_to_carried` | exist, injury-invariant already enforced server-side | UI composition only | T17 | same buttons, full-width |
| "Cannot Store Pokémon" (injured) dialog | — | `transferToStorage` already rejects with an error today (`PokemonTab` shows it via `ErrorState`) | exists | needs the mockup's explicit modal framing instead of an inline `ErrorState` paragraph | T17 | native `<dialog>`/`AdaptivePanel` |
| "Held item returns to Backpack" flow hint | — | `StorageTransferOutcome.held_item_returned` | **already returned by the existing command** | display only | T17 | callout banner |

### 8.6 `ptu_companion_inventory_mockup.png` — Items (`/items`, NEW ROUTE)

| Region | Action | Route/view model | Existing capability | Gap | Task | Mobile transform |
|---|---|---|---|---|---|---|
| Backpack category tabs | filter | `InventoryRecord.backpack` + `ItemCategoryBadge`'s existing category taxonomy | data + badge component exist | filtering UI doesn't exist (today's `InventoryTab` is an unfiltered flat list) | T13R3 (basic list, reuse `ItemLabel`/`ItemCategoryBadge`), T18 (filter/tabs) | tab strip → horizontal scroll (mockup mobile crop confirms) |
| Equipment 6-slot grid | tap slot → assign | `equipped: Record<slot,item>` | generic map exists, spec names the canonical 6 slots (§10) | fixed-slot UI is new; slot semantics already spec-supported | T14 | 2×3 → stacked |
| "Assign Held Item" wizard (select Pokémon → select item → confirm) | multi-step | — | `held_item_id` field exists on `PokemonInstance` | **NEW COMMAND** — no `set_held_item`/`assign_held_item` Tauri command exists anywhere (confirmed by search); only set to `None` at creation | T14/T17 | 3-step becomes a single bottom-sheet flow (mockup's Android tab layout) |

### 8.7 `ptu_companion_shop_checkout_concept.png` — Shop (`/shop`, NEW ROUTE, T18)

| Region | Action | Route/view model | Existing capability | Gap | Task | Mobile transform |
|---|---|---|---|---|---|---|
| Shop kind tabs (Poké Mart/Black Market/Battle Supplies/Special Deals) | switch catalog/multiplier | `ShopPreset{buy_multiplier, sell_multiplier}` | one fixture shop exists (`InventoryTab`'s `FIXTURE_SHOP_ID`) | multiple named presets with distinct multipliers is a real-catalog concern | T18 | tabs → dropdown |
| Category filter chips | filter | `ItemCategoryBadge` taxonomy | exists | filter wiring | T18 | horizontal scroll |
| Cart with qty steppers, discount field, live totals | add/remove/checkout | `checkoutBuy`/`checkoutSell` already accept `CartLine[]` with quantity | **backend already cart-shaped** | only a multi-line cart UI is missing — today's `InventoryTab` buys one unit at a time inline | T18 | cart → bottom sheet (mockup explicitly captions this) |
| Checkout confirm | atomic money+inventory mutation | `checkout_buy`/`checkout_sell` (spec §11: "one database transaction") | exists | none | T18 | full-width CTA |

### 8.8 `ptu_companion_npc_journal_interface.png` — NPC Journal (`/npc-journal`, NEW ROUTE, T18)

| Region | Action | Route/view model | Existing capability | Gap | Task | Mobile transform |
|---|---|---|---|---|---|---|
| NPC list + filter chips (Ally/Rival/Merchant/...) | select | `profile.npcs: Value[]` | generic array exists | fully untyped; spec §12 defines: UUID, name, tags, description, notes, affiliation, favorite, optional image, first-seen | **NEW FIELDs** matching spec §12 exactly | T18 |
| Detail (About/Notes dated cards/Add/Edit/Remove) | CRUD | none | — | `add_npc`/`update_npc`/`remove_npc`-style commands don't exist | **NEW COMMAND** set | T18 |
| Relation hearts / Last Seen location / Partner reference | — | — | — | **not in spec §12** — illustrative extensions beyond the baseline NPC fields; flag to Planner before modeling, don't invent silently | flag | — |

### 8.9 `ptu_companion_level_up_wizard.png` — Guided level-up (contextual modal/route, NEW, T16)

| Region | Action | Route/view model | Existing capability | Gap | Task | Mobile transform |
|---|---|---|---|---|---|---|
| Step rail (Summary/Stat/Edge/Feature/Validation/Finish) | navigate steps | none | today's `OverviewTab` "Preview Level Up" is a single flat button+apply, no staged flow | staged wizard state machine is new UI, but each step's data operation already exists (`levelUpTrainer` preview, `saveTrainer` apply, `DefinitionPicker` for Edge/Feature search) | T16 | step rail → dot indicator (mockup's mobile crop shows exactly this) |
| Stat point allocator | +/- per stat | none typed (Trainer stat points aren't modeled — spec §17.1 covers Trainer progression baseline stat/feature/edge counts, not a spendable-stat-point ledger) | `TrainerLevelUpResult.baseline_stat_point` exists (a count), spending it against named stats does not | **ENGINE** | T16 (UI) + T15 (spend logic) | same |
| Edge/Feature choice search | search + select | `DefinitionPicker` (kind="edge"/"feature") | **directly reusable, verbatim** | none | T16 | same |
| Validation panel ("must spend stat point") | blocks Next | `.callout-warning` | exists | wizard-level required-choice tracking is new state, not new components | T16 | same |
| GM Override note | — | `recordGmOverride` exists (Pokémon-level today) | needs generalizing to Trainer level-up | small extension | T16 | same |

### 8.10 `ptu_companion_content_editor_mockup.png` — Unified content library (`/editor`, T19)

| Region | Action | Route/view model | Existing capability | Gap | Task | Mobile transform |
|---|---|---|---|---|---|---|
| Left sidebar (Dashboard/Moves/Abilities/Features/Edges/Poké Edges/Capabilities/Items/Species/Rulesets/Content Packs/Import-Export) | switch content kind | `ContentKindSlug` already enumerates all these kinds | type-level support exists | today's `Editor.tsx` hardcodes Move-only; the backend `save_authored_definition` is already kind-agnostic (its own doc comment says so) | T19 | Android: read-only viewer per spec §21, no structural editor |
| Search/filter/sort content list | — | `searchContent` | exists, generic across kinds | UI composition per-kind | T19 | — |
| Detail pane (fields/effects/shop settings/source info) | edit | `saveAuthoredDefinition`/`softDeleteDefinition`/`reactivateDefinition` | exist, generic | per-kind field layout | T19 | Android: `DefinitionDetail` read-only (existing component, already generic per-kind) |
| Bulk actions (Duplicate/Archive/Export/Compare Versions) | — | soft-delete/reactivate exist; duplicate/compare do not | partial | **NEW COMMAND**(s): duplicate, version compare | T19 | — |

### 8.11 `ptu_companion_move_editor_showcase.png` — Move editor (`/editor`, T19)

| Region | Action | Existing capability | Gap | Task |
|---|---|---|---|---|
| Structured fields (range/contest/class/keywords/tags) | — | `Editor.tsx` today only has type/class/effect text (no range, keywords, tags, frequency, AC) | **NEW FIELDs** on the authoring form only (the definition JSON shape is already flexible/schema-validated per spec §21) | T19 |
| Validation panel (missing fields/warnings/passed checks) | — | none | new UI + validation rules | T19 |
| Damage Preview | — | `resolve_damage` command already computes exactly this | WIRING | T19 |
| Version History / "Find References" (learnset/usage) | — | none; `searchContent` could back a "used by" reverse lookup | reverse-reference query is **NEW COMMAND**; version history needs append-only version rows | T19 |

### 8.12 `ptu_companion_ability_editor_mockup.png` — Ability editor (`/editor`, T19, depends on T15)

| Region | Action | Existing capability | Gap | Task |
|---|---|---|---|---|
| Condition/semantic-effect builder | — | none — this is the authoring surface for the T15 modifier/effect engine | **ENGINE-dependent** — cannot be meaningfully built before T15 defines the effect vocabulary it authors into | T19 after T15 |
| Trigger sandbox / simulation | — | none | same | T19 after T15 |
| Compatibility/dependency rules | — | none | same | T19 |

### 8.13 `ptu_companion_species_editor_mockup.png` — Species editor (`/editor`, T19)

| Region | Action | Existing capability | Gap | Task |
|---|---|---|---|---|
| Base stats / typing / abilities / capabilities editors | — | species schema already covers all of this per spec §8.1 (verified: `pokemon-species-v0.5.schema.json` exists) | authoring UI only, schema already supports it | T19 |
| Regional Forms / Evolution graph | — | spec §8.1 lists "form/mega/special-form data" and "evolution data" | UI only | T19 |
| Learnset Builder (level-up/TM/egg/tutor) | — | spec §8.1 lists all four learnset kinds | UI only | T19 |
| Conflict Warnings (override vs base species) | — | provenance/priority resolution already exists (`ResolvedDefinition.reason: "pinned"\|"priority"`) | surfacing conflicts in an authoring UI is new | T19 |
| Dex Preview / Preview in Roster / Preview — Creature Sheet | — | depends on §8.4's creature sheet existing first | sequencing note, not a new gap | T19 after T13R3/T14 |

---

## 9. Selection & navigation contract — Pokédex → Add creature

This is the exact flow the previous T13 UAT failed on (A17). Contract, precisely:

1. **Browse** (`/pokedex`, existing): search by name/kind (existing `searchContent`), results list (existing virtualized list).
2. **View species** (existing): click a result → `resolveDefinition("species", id)` → `DefinitionDetail` in `AdaptivePanel`. This is read-only and mutates nothing — already true today, must remain true.
3. **Add creature** (NEW, T13R3): a distinct, clearly-labeled action inside the same detail panel — not a second click target easily confused with "View". Button label: **"Add to Trainer…"**.
4. **Trainer/roster context step** (NEW, T13R3): if `activeTrainerId` is set (§10.1), pre-fill it and show the Trainer's name; otherwise require picking a Trainer first (reuse `TrainerList`'s existing list, not a new picker). Optionally select one or more of that Trainer's rosters to also join (existing `RosterRecord[]`), defaulting to none selected (roster membership stays opt-in, matching spec §9 "a Pokémon may belong to multiple rosters" — never auto-joined).
5. **Confirm** (NEW, T13R3): a single explicit confirmation step showing species name, target Trainer, and any selected rosters before the mutation fires — no silent one-click add.
6. **Commit**: calls the existing `addPokemon(trainerId, speciesId, nickname, level)`, then existing `addRosterMembership` per selected roster.
7. **Success feedback + post-add destination** (NEW, T13R3): a toast/callout confirms creation, with a direct link to the new creature's sheet (`/pokemon/:id`, §8.4) — the plan's required "opens its owned sheet" step.
8. **Cancel**: available at every step (2-6), returns to the species detail with zero mutation — consistent with the existing `AdaptivePanel` close-without-side-effect pattern.

**View vs. Add is never the same control.** Step 2 and step 3 are visually and semantically distinct actions in the same panel, addressing the UAT finding "Pokémon cannot be selected in the Pokédex" directly.

---

## 10. Minimum typed data contract for the T13R3 vertical slice

Per plan scope item 1-5 and A18 ("placeholder stats would repeat the failed T13 assumption"). This section lists only what the slice's five demonstrated flows require — not full T14 lifecycle coverage.

### 10.1 Active Trainer wiring (blocking, do first)

`appStore.activeTrainerId` exists but is dead code today (defined, never called). T13R3 must:
- call `setActiveTrainerId(profile.id)` when `TrainerSheet` loads a Trainer,
- have `Home` read it and, if set, load+render that Trainer's summary (§8.1) instead of the current bare status page,
- have the new `/items` and `/rosters` routes read it to scope their data without re-navigating through `/trainer`.

This is not a new persisted field — it's wiring an existing ephemeral store correctly. Flagged first because every other slice requirement depends on it.

### 10.2 Trainer summary (Home + Trainer dashboard header)

All fields below already exist on `TrainerProfile`: `name`, `level`, `exp`, `money`. No new field required for the slice's minimum bar. Gender/rank/region/etc. from §8.2 are **not** required for the slice (T14).

### 10.3 Skills (Trainer dashboard)

Render `profile.skills` (existing generic map) as a flat labeled list for the slice — do not fabricate Body/Mind/Spirit grouping (§8.2 rationale). If the active content pack's skill definitions carry a group hint, group by that; otherwise flat, disclosed as such.

### 10.4 Base/derived stats with provenance

Slice requirement: **whatever real value can be resolved must be shown with its source; whatever cannot must be a disclosed callout, never a fabricated number** (A18, reusing pattern 9). Concretely:
- If T15 lands a Trainer stat-derivation function before T13R3 starts, wire `resolveModifierValue` output (`ResolvedValue`) into the stat grid with breakdown tooltips.
- If it has not landed, the slice ships the stat grid with an explicit `callout-warning`: "Derived stats require the resolution engine (T15) — not yet available," exactly mirroring `PokemonMoveResolver`'s existing disclosed-gap pattern. **The slice must not print zeros or invented numbers.**

### 10.5 HP / max HP

Trainer: `profile.combat.current_hp` already exists (nullable, spec-correct — "unknown stays nullable, never coerced to zero," model.rs). Pokémon: `battle_state.current_hp`/`HpBar` already exists. Max HP for either requires the same ENGINE dependency as §10.4 — same disclosed-gap rule applies if unavailable.

### 10.6 Roster summaries

`RosterRecord[]` + membership (existing) is sufficient for the slice's "newly added creature visible in... Rosters entry point" requirement. No new field.

### 10.7 Creature identity/type/level/HP/stats/moves/abilities

- Identity/level: `PokemonInstance` (existing).
- Type: resolved species `DefinitionDetail` (existing).
- HP: `battle_state`/`HpBar` (existing) — only while carried; a stored creature shows its last-known battle_state or an explicit "not currently tracked" state, never a fabricated full bar.
- Stats: same ENGINE/disclosed-gap rule as §10.4.
- Moves: `pokemon.moves` + `PokemonMoveResolver` (existing, verbatim reuse).
- Abilities: `pokemon.abilities` + `DefinitionDetail` (existing).

### 10.8 Media fallback

Per spec §20 (§3 above): no image → render species/Trainer initials or a neutral silhouette + type/category badges; never a broken-image icon, never a proprietary sprite substitute.

---

## 11. Illustrative-only values — explicitly excluded

Per plan Implementation Constraints and AC ("Reviewer confirms Wins/Rating and other unsupported showcase values were not silently promoted into domain requirements"):

| Value | Where seen | Why excluded |
|---|---|---|
| **Wins** | Dashboard, Trainer dashboard | Plan §11 Out-of-Scope: explicitly excluded by user decision |
| **Rating** | Dashboard, Trainer dashboard | Same |
| Badges (achievement count) | Dashboard, Trainer dashboard | No spec/domain support found |
| PTU Points | Trainer dashboard | No spec/domain definition found; distinct from the real `money` field |
| Tamer Rank (numeric/rank chip beyond the Class-feature label), Region, ID No., Guild, Join Date | Trainer dashboard "Class Summary" | Not in spec §7's identity or background field list |
| Carry Capacity, Creature Synergy (as named capabilities) | Trainer dashboard | No PTU rule source confirmed in-repo; flag to Planner rather than invent |
| NPC Relation hearts, Last Seen location, Partner reference | NPC Journal | Beyond spec §12's NPC field baseline |
| Terrain & Weather (on the creature sheet) | Creature sheet | Scene-level state not covered by spec §8.2/§13's Pokémon-instance or Trainer combat-sheet fields |
| Storage "Box" as a persisted structural unit | Storage management | Spec §8.3's storage invariant doesn't require box partitioning; treat as client pagination unless confirmed otherwise |

None of these become schema, commands, or UI requirements in T13R2/T13R3. Any of them may be revisited only via an amended, approved plan task (matching the plan's own language for Battle Log/Quests).

---

## 12. Comparison baselines

- **Desktop:** reference ratio 1672×941 (source mockup canvas), evaluated as a ratio/breakpoint target, not literal pixels (A15).
- **Android widths:** 360px, 390px, 412px (covers Android's most common device-independent-pixel widths; the existing `@media (max-width: 640px)` breakpoint in `App.css` already targets this class).
- **Zoom:** 200% desktop zoom must reflow without horizontal scroll (plan constraint, T13R2 AC).
- **Contrast:** WCAG 2.2 AA, evaluated per the existing `pickTextColor` utility's stated purpose (already used by `TypeBadge`/`ItemCategoryBadge` to choose readable text over arbitrary type-color backgrounds) plus the new radius/elevation surfaces in §2.

---

## 13. Divergence log

| Divergence from reference | Rationale |
|---|---|
| Red hardware device bezel/frame, footer showcase captions, Pokémon character/sprite artwork | Presentation-only chrome around the mockup image itself, not application UI (A16, plan §11 Out-of-Scope) |
| Card radius raised from existing 8px to 10-16px scale (§2) | Matches the mockups' visibly rounder cards; a token-scale change, not a one-off override |
| Notification bell omitted | No backing feature exists (§3, §7) — same dead-destination rule as Battle Log/Quests |
| "Class Summary" 5-field block reduced to a single resolved Class-feature label | Only field with confirmed spec/data support (§8.2) |
| Skill grouping (Body/Mind/Spirit) not hardcoded | Spec keeps skills fully data-driven (model.rs rationale); a fixed 3-category enum would be inventing schema the spec deliberately avoided |
| Drag-and-drop roster assignment ships with a mandatory explicit-button equivalent | Plan implementation constraint (T17) — accessibility, not optional |
| Storage "boxes" treated as pagination, not a persisted field, pending confirmation | Spec §8.3 doesn't require box partitioning; avoids inventing schema (Ponytail §1) |

---

## 14. Acceptance criteria self-check

| T13R1 acceptance criterion | Status |
|---|---|
| Every PNG has a row-by-row screen contract (hierarchy/actions/responsive/data source/task) | ✅ §8, all 13 images |
| Navigation exposes all referenced destinations without horizontal scroll/mystery actions | ✅ §5-§7 |
| Battle Log/Quests/every nav item mapped to an approved task or omitted | ✅ §7 (omission table with rationale) |
| Pokédex selection/addition and Trainer/creature sheet data contracts unambiguous, real persisted data | ✅ §9, §10 |
| Visual tokens cover brand, surfaces, typography, spacing, radii, elevation, types, moves, stats, items, HP, validation, focus, disabled, hover, selected, loading, empty, error | ✅ §2, §4 (existing tokens verified + new tokens specified) |
| Reviewer confirms contract faithful to all 13 references | pending gate |
| Reviewer confirms Wins/Rating and other unsupported values not silently promoted | ✅ §11 (Wins/Rating plus 7 additional illustrative values proactively identified) |

---

## Worker Verification

Traceability matrix review (§8, all 13 references, row-by-row) plus static evidence: every "existing capability" cited above was confirmed by reading the actual current file (not assumed from the plan), including a targeted repo-wide search confirming zero Battle Log/Quest/notification/held-item-assignment backing code exists. No fixture data or UI was built for this task — it is a contract document only, per the plan's Implementation Constraints ("does not implement production screens").
