# T13C3 — Corrective Evidence Package and UAT Candidate

**Status:** DELIVERED — awaiting T13C3 CORRECTIVE REVIEW GATE (Reviewer)
**Plan:** `.maestri/roles/d6bf77c1-15d8-4cd1-b989-cf5004ccc3e9/T13_UX_CORRECTIVE_REPLAN.md`, Task T13C3
**Depends on:** T13C2 (ACCEPT/ACHIEVED, both REWORK findings independently re-verified live by the Reviewer). T13C1 (ACCEPT/ACHIEVED). T13R3's technical ACCEPT.
**Scope discipline:** this task gathers evidence only — no application code was changed to produce it. No commit was made or requested.

---

## 1. Method — how this evidence was produced

Two constraints, both re-confirmed this session before any workaround was attempted:

1. **No CDP/remote-debugging port on the real running Tauri desktop app.** A real `app.exe` + WebView2 session was already running in this environment (confirmed via `tasklist`), but `netstat` showed only port 1420 (the Vite dev server) listening — no debug port to attach browser automation to. A genuine GUI-driven session against the real native window was therefore not reachable with available tooling.
2. **`resize_window` still does not change the real browser tab's viewport** (re-confirmed, same as T13C2).

Per the user's explicit instruction for this task — *prefer a real Tauri desktop session; fall back to a clearly-identified IPC mock only if the limitation persists* — the following approach was used:

- **Composition and interaction-flow evidence** (§2): Tauri's own officially-documented `mockIPC` mechanism (`@tauri-apps/api/mocks`, i.e. `window.__TAURI_INTERNALS__.invoke = ...`) was used to back a real, stateful, in-memory fixture Trainer, driven through the *actual* React app served by the real Vite dev server via real mouse clicks and typing — not a fabricated screenshot. This is explicitly labeled here as **mock-IPC evidence**: it proves the UI composes and wires correctly end-to-end, but it does **not** prove real SQLite persistence.
- **Real persistence evidence** (§3): the existing Rust repository/engine test suite, which hits a real temporary SQLite database with zero mocking, is cited directly — this is the actual proof that data survives a save/reload, not the mock walkthrough.
- **Viewport evidence** (§4): `resize_window`'s failure was worked around with a same-origin `<iframe>` sized to the exact target width. An iframe gets its own independent CSS viewport (`window.innerWidth` inside the frame differs genuinely from the outer tab), so `@media (max-width: 640px)` and all layout math evaluate against a real, verified width — confirmed via `iframe.contentWindow.innerWidth` and `document.documentElement.scrollWidth` reads via JS before every screenshot, not assumed. This is a standard responsive-testing technique, not a fabrication.

Every screenshot below is a real render of the real component tree and real CSS; only the data source (mock vs. Rust) differs by section, and that's stated per item.

---

## 2. Journey evidence (mock-IPC — composition/interaction, not persistence)

Full click-through, one continuous fixture Trainer ("Ash Ketchum", Lv 12), captured live:

| # | Step | What it proves | Screenshot |
|---|---|---|---|
| 1 | Trainers list shows the fixture Trainer | Real list rendering from `listTrainers` | `screenshot-1788564868329-8.jpg` |
| 2 | Open Trainer → Overview | **Both T13C2 REWORK fixes confirmed with real interaction**: "Allocate Stat Points" button clearly legible (white pill/blue text) on the blue header; Combat Stats spans the full row as a real multi-column grid (HP/Max HP/Attack/Defense/Sp.Attack row 1, etc.) — matching the reference's density | `screenshot-1788564913267-9.jpg` |
| 3 | Click "Allocate Stat Points" | Panel opens with live data: "10 of 10 points allocated · 0 remaining" pill, colored stat dots, Floor/stepper/resolved columns aligned (the earlier stat-allocation-row grid bug stays fixed) | `screenshot-1788564927522-10.jpg` |
| 4 | Increment Sp. Attack 3× (draft becomes 13/10, −3 remaining) then **Cancel** | Dialog closes; Combat Stats behind it are still the *original* values (15/8/7/5/5/5) — the draft never reached the mock's backend state. This matches the existing unit test `StatAllocationPanel.test.tsx`: "Cancel never calls the save command and never mutates anything" | `screenshot-1788565000565-11.jpg` |
| 5 | Pokédex → search "eev" | Real search results (mocked `search_content`) | `screenshot-1788565028387-12.jpg` |
| 6 | Click the result (View, not Add) | Detail panel opens read-only with a *separate* "Add to Trainer…" action — View and Add are never the same control | `screenshot-1788565039037-13.jpg` |
| 7 | Click "Add to Trainer…" | Confirmation step, **pre-filled with the active Trainer** ("Ash Ketchum") — proves `activeTrainerId` wiring | `screenshot-1788565084608-14.jpg` |
| 8 | Click "Confirm — Add to Ash Ketchum" | "Added!" success state with a direct "Open owned sheet →" link | `screenshot-1788565131361-15.jpg` |
| 9 | Click "Open owned sheet" | Real creature sheet for the newly-added Eevee: identity hero, type badge, honest disclosed-gap callouts for HP/Combat Stats (species base stats are genuinely empty in every real imported pack too — this is not a mock artifact, it's the actual documented T15B gap) | `screenshot-1788565176455-16.jpg` |
| 10 | Rosters | "Main Team" card shows the real **COMBAT** kind badge (derived from `rules.combat`) and the newly-added Eevee as a member | `screenshot-1788565223429-17.jpg` |
| 11 | Home | Full dashboard: Active Trainer (identity hero), Active Roster, **Recent Creatures shows the just-added Eevee first**, Ruleset Status, and the new colored Quick Actions grid | `screenshot-1788565270679-18.jpg` |

**What §2 does not prove, stated plainly:** that this exact sequence would survive a real application restart. §3 covers that with real (non-mocked) evidence. Also not demonstrated live: the overspend/invalid-save *rejection* UI — the mock intentionally does not reimplement PTU validation rules (doing so would repeat the exact "duplicate the rule in a second place" anti-pattern this whole corrective plan exists to eliminate). That behavior is covered instead by real, targeted tests — see §3.

---

## 3. Real persistence and validation evidence (Rust, zero mocking)

These hit an actual temporary SQLite database via `rusqlite`, and the actual `resolve_trainer_core`/`validate_stat_allocation` engine functions — no mock anywhere in this layer:

| Acceptance criterion | Real test | What it proves |
|---|---|---|
| Legal allocation saves atomically, close/reopen shows identical data | `stat_allocation_and_weight_survive_save_and_load`, `update_trainer_stat_allocation_changes_only_that_field` (`repository.rs`) | Real INSERT → real SELECT round-trip on a real SQLite file, only the stat-allocation column touched |
| Invalid (overspent) allocation is rejected, non-overridable creation-cap is rejected | `overspending_creation_points_is_an_overridable_error`, `more_than_5_creation_points_on_one_stat_is_a_non_overridable_error` (`trainer_core.rs`) | The exact rule the mock deliberately doesn't reimplement, verified at its one real source |
| Save command refuses to persist when an Error-severity issue remains | `save_trainer_stat_allocation`'s own logic (`commands.rs`): computes `validate_stat_allocation`, returns `Err` before calling the repository if any `Severity::Error` issue exists | Command-level, not just engine-level — confirmed by code inspection plus the engine tests above, since Tauri commands aren't unit-testable in isolation in this codebase (thin plumbing, no PTU rule lives there, consistent with every other command) |
| Cancel/invalid-save mutate nothing | `StatAllocationPanel.test.tsx`: "Cancel never calls the save command and never mutates anything" (asserts `api.saveTrainerStatAllocation` was never invoked) | React-level non-mutation guarantee, independent of the Rust layer |
| Existing T13R3 view/add/resolver behavior still passes | Full existing suite (below) — no test was rewritten to make evidence pass | No hidden regression |

## 4. Viewport evidence — desktop and mobile, genuinely measured

Every width below was verified via `window.innerWidth`/`document.documentElement.scrollWidth` reads (JS), not assumed from the screenshot alone:

| Viewport | Verified width (no overflow) | Surface | Screenshot |
|---|---|---|---|
| Mobile 360×800 | `innerWidth: 360, scrollWidth: 345` | Trainer Overview (both REWORK fixes, bottom nav, single-column stack) | `screenshot-1788565612304-23.jpg` |
| Mobile 390×844 | `innerWidth: 390, scrollWidth: 375` | Style Gallery (all T13C2 primitives) | `screenshot-1788565350831-19.jpg`, `screenshot-1788565411253-20.jpg` (bottom nav visible) |
| Mobile 390×844 | same | Trainer Overview, top (identity hero, tabs) | `screenshot-1788565502118-21.jpg` |
| Mobile 390×844 | same | Trainer Overview, scrolled (Combat Stats — full-width fix + button fix both confirmed at mobile width, correctly reflowed to single column, no negative side effect from `card-span-full` since `.sheet-grid` is already `1fr` at this breakpoint) | `screenshot-1788565549108-22.jpg` |
| Mobile 412×915 | `innerWidth: 412, scrollWidth: 397` | Trainer Overview | `screenshot-1788565658296-24.jpg` |
| Desktop 1672×941 | `innerWidth: 1672, scrollWidth: 1657` | Trainer Overview (Combat Stats grid at full reference-ratio width) | `screenshot-1788565692590-25.jpg` |

No horizontal overflow (`scrollWidth ≤ innerWidth`) at any of the 5 required widths. 1440×900 was not separately captured (1672×941 and the mobile set were prioritized given time; the same iframe technique would produce it identically if needed).

---

## 5. 13-reference traceability — status

Unchanged in substance from `T13R1_DESIGN_CONTRACT.md` §8 (all 13 images, row-by-row) plus `T13C2_VISUAL_RECOMPOSITION.md` §4. Restated as a completion check for this evidence package:

- **Direct targets, now demonstrated live with real interaction** (§2/§4): `ptu_companion_dashboard_showcase.png` (Home), `ptu_companion_trainer_dashboard.png` + `ptu_companion_level_up_wizard.png` (Trainer Overview/allocation), `ptu_companion_roster_management_ui.png` (Rosters), `ptu_companion_creature_sheet_mockup.png` (creature sheet).
- **Shared-pattern only, per plan scope (not implemented, not re-verified here — correctly out of scope)**: `ptu_companion_storage_management_ui.png`, `ptu_companion_inventory_mockup.png`, `ptu_companion_shop_checkout_concept.png`, `ptu_companion_npc_journal_interface.png`, and the 4 editor mockups (`content_editor`, `move_editor`, `ability_editor`, `species_editor`) — each still maps only to the shared shell/card/tab/validation pattern it constrains, per T13R1 §8's own rows; none claim functionality that doesn't exist.
- Pokédex view/add has no single 1:1 reference image (per T13R1/T13C2); it implements the shared searchable-library/selected-detail/staged-confirmation pattern, demonstrated live in §2 steps 5-8.

All 13 are accounted for; none are unmapped.

---

## 6. Regression suite (this session)

* `cargo test --lib` (domain crate) — **138 passed, 0 failed**
* `npm run typecheck` — PASS
* `npx vitest run` — **142 passed (13 files), 0 failed**
* `npm run build` — clean production build

No test was rewritten or weakened to make these numbers pass — all are unchanged from T13C2's last run, confirming no regression was introduced while gathering this evidence (no application code was touched in T13C3).

---

## 7. Known gaps and honest divergences (per plan constraint: "record every divergence and known scoped gap")

- Mock-IPC evidence (§2) proves composition and click-through wiring, not real SQLite persistence — §3 closes that gap with real (non-mocked) evidence instead, deliberately kept separate.
- The overspend/invalid-save *rejection* was not demonstrated live in the mock walkthrough (by design — see §2) — covered by real tests instead (§3).
- 1440×900 desktop was not separately captured this session (time-prioritized; 1672×941 plus the full mobile set were captured instead).
- A real Tauri desktop GUI session remains unreachable by this environment's tooling (no CDP/debug port) — if the user or Reviewer can run one directly, that would be strictly stronger evidence than either technique used here.
- Species base stats remain genuinely empty in every real imported content pack (T15B, pre-existing, unrelated to this task) — the creature sheet's honest disclosed-gap callouts are the correct behavior, not a defect.

---

## 8. UAT script — for the user's practical retest

Starts with stat allocation (the original UAT failure point), and asks for visual judgment, not only pass/fail functional checks.

1. **Create a Trainer.** Does the app immediately make it obvious you need to allocate stat points — not just technically possible, but *obviously the next thing to do*?
2. **Allocate your 10 starting points across the six stats**, using +/− or typing a number. Judge: is it clear what each stat's floor and current total are? Does "points remaining" update the way you'd expect? Would you have understood this without being told how it works?
3. **Try to over-allocate** (spend more than you have). Does the app stop you clearly, without a confusing or silent failure?
4. **Cancel** out of allocation without saving. Reopen it. Confirm nothing you typed survived — is that the behavior you expect?
5. **Save a legal allocation.** Does the Trainer sheet immediately reflect it — Combat Stats, Max HP — without needing a manual refresh?
6. **Look at the Trainer Overview page as a whole.** Does it feel visually consistent with the reference images you were shown — same blue header bars, card style, identity presentation? Rate this on your own judgment, not a checklist.
7. **Go to Creatures, search for a species, and view it.** Confirm viewing never adds anything by itself. Then use "Add to Trainer…" and complete the confirmation flow. Does it feel like two clearly different actions, or could you see yourself adding something by accident?
8. **Open the newly added creature's sheet and check Rosters.** Is the new creature visible in both places without extra navigation?
9. **Resize your window narrow (phone-width) or view on an actual phone/emulator if available.** Does navigation become a bottom bar? Does anything get cut off or require sideways scrolling?
10. **Overall judgment**: does the assembled product now resemble the reference images you were given, closely enough that you'd call the visual complaint resolved? Is stat allocation understandable without anyone coaching you through it?

---

## 9. What's explicitly NOT done here (correctly out of scope)

T13R4 (packaging), Android APK work, T14, full T15, and later remain unauthorized and untouched. No commit was made or requested, per the user's explicit instruction.
