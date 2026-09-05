# T13 — Interaction Contracts (Reusable Patterns)

Restart plan T13 acceptance criterion: "The approved patterns are documented as
reusable interaction contracts, not merely screenshots." This document is that
record — each pattern below states the rule, why it exists, where it lives in
code, and where it is already used, so a future task (T16–T19) can apply the
same contract instead of re-deriving it or drifting from it.

## 1. Search-by-name picker (never a raw internal id)

**Contract:** any flow that adds a reference to a definition (a move, an edge,
an item, …) must let the user search by human name and pick a result. The
caller receives a typed `SearchHit` (`definition_version_id`, `name`,
`content_pack_id`, `kind`) — it never accepts, displays, or requires typing a
raw `definition_version_id` string.

**Component:** `app/src/components/DefinitionPicker.tsx` — ARIA combobox
(`role="combobox"`/`role="listbox"`, arrow-key navigation, Enter to select,
Escape to close), backed by the existing `api.searchContent` command. Props:
`kind: ContentKindSlug`, `label: string`, `onSelect: (hit: SearchHit) => void`.

**Used by:** `CollectionManager.tsx` (all 6 collection kinds — moves, edges,
poke_edges, features, abilities, capabilities — on both Trainer and Pokémon).

**Apply this pattern when:** any future screen (T16–T19) lets a user attach a
content-pack definition to something they own. Do not reintroduce a text
input for an id.

## 2. Rich, typed rule detail (never a raw JSON dump)

**Contract:** a resolved definition's detail view must render its known
fields as typed, labeled UI (type/category badges, key-facts table, effect
text as prose) — never `JSON.stringify(data, null, 2)` in a `<pre>`. The
original `raw_text` field is always shown too, in its own "Source text"
section, never hidden — restart plan A10 ("full rule text must be readable
inside the app") is satisfied by *keeping* raw text visible, not by removing
it once a structured view exists.

**Component:** `app/src/components/DefinitionDetail.tsx`. Shape-detection is
duck-typed from the record itself (`isMove`/`isSpecies`/`isItem`), not from a
`kind` parameter, because a resolved record's own JSON shape is the source of
truth. A generic `SECONDARY_TEXT_FIELDS` list renders any of nine optional
text fields (prerequisites/cost/trigger/target/bonus/special/condition/
limitation/extra) that are present on the record — fields absent on a given
kind simply don't render, so one component covers edges/features/items/
abilities/capabilities without a bespoke layout per kind.

**Used by:** `Pokedex.tsx` detail panel.

**Apply this pattern when:** any future screen needs to show a resolved
definition's full detail. Extend `SECONDARY_TEXT_FIELDS` or the `isX` checks
rather than building a parallel renderer.

## 3. "Resolved without re-entry"

**Contract:** when a deterministic result can be computed from data the user
already owns (a carried Pokémon's learned move, its species, its stats), the
UI must compute it from that real, owned data — not ask the user to re-type
values the app already has. A manual-entry fallback stays available and
clearly labeled, but it is not the default path when real data exists.

**Component:** `app/src/components/PokemonMoveResolver.tsx` — picks a move
from the Pokémon's actual `moves` collection, resolves the move's own
`damage_base`/`type`/`class` from its resolved definition, resolves the
actor's type from its resolved species definition, and calls the existing
`resolve_damage` command. If a needed value is genuinely absent from the
imported content (today: species `base_stats` is empty in every imported
pack), the fallback field is shown with a visible `callout-warning` — the gap
is disclosed, never silently invented.

**Used by:** `CombatTab.tsx`, alongside the pre-existing fully-manual
"Resolved Move (manual entry)" form (kept, relabeled, for moves not yet on a
move list or hypothetical combinations — a legitimate, distinct use case, not
a redundant duplicate).

**Apply this pattern when:** any future flow could compute a result from data
the user already entered elsewhere. Prefer this over a fresh manual-entry
form; keep manual entry only as an explicitly-labeled fallback/what-if path.

## 4. Definition card (owned-collection row)

**Contract:** a row representing one item in an owned collection (a learned
move, an equipped item, …) shows the resolved name + relevant badges (type,
move category) and a remove action — never a bare id in `<code>`.

**Class:** `.definition-card` / `.definition-card-list` (`App.css`). Built by
`ResolvedEntryCard` in `CollectionManager.tsx`; reuse the class names directly
if a future screen needs the same row shape outside `CollectionManager`.

## 5. Icon language

**Contract:** icons are small, original, hand-authored inline SVGs — never a
proprietary Pokémon glyph, never an icon-library dependency. Every icon uses
`stroke="currentColor"` and is sized in `em` so it inherits the surrounding
text color and scale automatically (theme-safe, no per-icon color code).
Icons are decorative by default (`aria-hidden`) since adjacent text always
carries the meaning; pass `title` only for a standalone icon-only control.

**Source:** `app/src/components/icons.tsx` — 13 icons as of this task
(search, plus, close, warning, info, chevron-right, target, chevron-left,
home, user, book, wrench, settings). Add new icons here, following the same
`Svg` wrapper, rather than starting a second icon file or pulling in a
library.

## 6. Typography and spacing scale

**Contract:** don't hand-write font sizes or margins/paddings in new
components — use the scale.

**Tokens:** `--text-{xs,sm,base,lg,xl,2xl}` = 0.75/0.875/1/1.125/1.5/2rem;
`--space-{1..6}` = 0.25/0.5/0.75/1/1.5/2rem (`pokemon-tokens.css`).

## 7. Responsive navigation shell

**Contract:** the app's primary navigation must let the user identify every
destination and the current one without horizontal scrolling or hidden
overflow, at both a desktop width and an Android-class (≤640px) width.

**Implementation:** `App.tsx`'s `NAV_ITEMS` array (icon + label per
destination) renders as a left sidebar at desktop widths and, at
`max-width: 640px`, as a `position: fixed` bottom tab bar (`App.css`,
`@media (max-width: 640px) .app-nav`) — icon-over-label, equal-width columns,
all destinations visible in one fixed strip with no scrolling. `.app-content`
carries bottom padding at that breakpoint so page content is never occluded
by the fixed bar.

**Apply this pattern when:** adding a new top-level destination — add one
entry to `NAV_ITEMS`; both layouts pick it up automatically. Do not add a
second, independent navigation surface.

## 8. Page hierarchy / recovery path (breadcrumb-back)

**Contract:** any screen reached only via a list→detail navigation (not a
top-level nav destination) shows an explicit way back — not just reliance on
the ambient sidebar/tab-bar's own highlighted state.

**Class:** `.breadcrumb-back` (`App.css`) — an icon (`IconChevronLeft`) +
label `Link`, placed above the page's `h1`.

**Used by:** `TrainerSheet.tsx` ("‹ All Trainers", linking to `/trainer`) —
today's only list→detail screen. Apply the same class/pattern to any future
screen with the same shape (e.g. a future roster→Pokémon drill-down).

## 9. Disclosed-gap callouts

**Contract:** when the app cannot supply a value (missing source data, an
unresolved reference, a needs-review flag), show a visible `callout-warning`
explaining exactly what's missing and why — never a silently wrong or
fabricated value, and never a plain dead end.

**Classes:** `.callout-info` / `.callout-warning` / `.callout-danger`
(`App.css`), paired with `IconWarning`/`IconInfo` for a scannable icon +
message. Used throughout: `DefinitionDetail`'s missing-species-fields and
needs-review notices, `PokemonMoveResolver`'s manual-stat and
type-unavailable notices, `Pokedex`'s inactive-ruleset-pack notice.
