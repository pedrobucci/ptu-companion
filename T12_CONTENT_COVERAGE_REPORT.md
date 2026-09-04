# T12 — Content and Automation Completeness Baseline

Restart plan task T12. Extends `DATA_QUALITY_REPORT_v1.0.md` and `KNOWN_GAPS_v1.0.md` with a
fresh, automated, in-app-verified baseline against the actually-shipped `content_packs/*.ptucp`
files (not the pre-final-normalization `seed/json/` snapshots those two reports were written
against). The check that produced these numbers is
`app/crates/domain/tests/content_coverage_baseline.rs` — run it with:

```
cargo test -p ptu-domain --test content_coverage_baseline -- --nocapture
```

It imports all 18 packs through the real import pipeline (the same code the app runs) and fails
the build if a new, undocumented content gap appears — this report is not just a one-time
snapshot, it is enforced going forward.

## 1. Automation-level coverage, by kind (enabled definitions only)

| Kind | machine_ready | hybrid | manual_text | metadata_only | no automation metadata in source | total |
|---|---:|---:|---:|---:|---:|---:|
| Edge | 12 | 5 | 44 | 0 | 0 | 61 |
| Feature | 84 | 381 | 507 | 27 | 0 | 999 |
| Item | 2 | 2 | 347 | 0 | 0 | 351 |
| Poké Edge | 1 | 5 | 14 | 0 | 0 | 20 |
| Ability | — | — | — | — | 625 | 625 |
| Capability | — | — | — | — | 93 | 93 |
| Move | — | — | — | — | 774 | 774 |

Edge/Feature/Item/Poké Edge totals match `DATA_QUALITY_REPORT_v1.0.md`'s canonical counts exactly
(61/999/351/20), confirming this fresh scan and the original handoff numbers agree for these
kinds.

Every one of these 2,923 enabled definitions has a non-empty readable text field (`effect_text`,
`raw_text`, `prerequisites_text`, or equivalent) — proven by the test, not asserted. No enabled
definition in any kind is a silent empty record.

## 2. Finding: Ability and Capability carry no automation-tier metadata at all

Edge, Feature, Item, and Poké Edge each went through a semantic-compilation pass that produced a
`semantic_automation` block (`level`: machine_ready/hybrid/manual_text/metadata_only) plus, where
applicable, `compiled_effects`. **Ability and Capability records never went through that pass** —
verified by inspecting real records from `content_packs/ptu-core-1.05.ptucp`: no
`semantic_automation` key, no `compiled_effects` key, on any Ability or Capability record in any
pack. Move records are inherently structured differently (typed `ac`/`damage_base`/`damage_dice`/
`class` fields carry the mechanical core directly; only the secondary `effect_text` is free text)
and were never expected to carry this same block.

This means: **625 Ability versions and 93 Capability records have no automation classification
whatsoever** — not "classified as manual", genuinely absent data. Their `effect_text` is fully
readable (players are never blocked from seeing what an Ability/Capability does), but nothing in
the supplied source data distinguishes which of those 625+93 effects are simple, deterministic,
machine-appliable atoms (e.g. Acrobat's edge-equivalent "+1 to two named Capabilities") from ones
that genuinely require GM narrative adjudication.

**This is not something I closed in T12.** Retroactively classifying 718 records requires either
the original semantic-compilation tooling (not present in this repository) or a new, purpose-built
classifier — that is a data-pipeline-scale task, not a "close the gap while auditing" task. I am
reporting it as a quantified, planning-relevant finding for whichever task (T15 per the restart
plan's own dependency graph) implements "apply learned mechanics automatically": T15's Ability/
Capability coverage will need to either (a) build this classification pass first, or (b) treat all
Abilities/Capabilities as `manual_text`-equivalent (safe default — text is always shown, nothing is
silently applied) until a classifier exists. Recommending (b) as the safe interim default.

## 3. Species cross-reference integrity

1,101 species records scanned (961 mechanically complete / enabled for character creation, 140
incomplete). Every species' level-up/TM/egg/tutor move list, ability slots, and capability list
carries a `reference_status` field computed by the data-prep pipeline. Walking every one of these
references:

- **39 unique unresolved move references** (was 56 in `DATA_QUALITY_REPORT_v1.0.md`'s
  pre-final-normalization count — 17 more got resolved between that snapshot and the shipped
  packs).
- **1 unique unresolved ability reference** ("Hydrate" — was reported as 2; one of the original
  two has since resolved).
- **22 unique unresolved capability references** (was 89 — 67 more got resolved by final
  normalization; `KNOWN_GAPS_v1.0.md` names this category as ongoing, e.g. "Breathless").

The full current list (superseding the `reference_unresolved.json`/`semantic_unresolved_references
_final.json` stage snapshots for what's actually in the shipped packs) is embedded as the
`KNOWN_UNRESOLVED_*` allowlists in `content_coverage_baseline.rs`, with the originating species and
pack recorded for each. Nothing in the current UI selects from a species' movepool/ability slots
yet, so none of these 62 references are user-reachable today — the allowlist and the regression
test exist so that whichever task (T17 per the restart plan) builds that selection UI has an
authoritative, enforced list of exactly what must be blocked with a reason, rather than discovering
these piecemeal or silently offering a broken reference.

Inspecting the 62, they fall into three categories:

- **PDF-extraction noise** (the large majority — e.g. `"Wring Out (N) Breeding Information Gender
  Ratio: 87.5% M / 12.5% F Egg Group: Water 3"` as a "move name"): a table-layout artifact where
  breeding-info text bled into a move-list cell during PDF extraction. Preserved verbatim per A10
  (original text stays visible) rather than guessed at.
- **Likely-repairable TM-number-prefix concatenation** (7 entries: `11SunnyDay`, `17Protect`,
  `18RainDance`, `46Thief`, `51Steel Wing`/`51SteelWing`, `68GigaImpact`, `76Fly`): the TM number
  and move name were extracted without a separating space. The named moves (Sunny Day, Protect,
  Rain Dance, Thief, Steel Wing, Giga Impact, Fly) all exist as real, resolvable move definitions
  elsewhere in the core pack — this looks mechanically closeable with a text-normalization repair,
  but doing so means re-running the seed-data extraction/normalization pipeline (not present in
  this repository) or hand-editing the shipped `.ptucp` byte content, which I did not do
  unilaterally. **Flagging as the single most promising, concrete lead for closing part of this
  gap in a future content-repair pass**, rather than silently attempting it against the "final
  handoff data contract" packs myself.
- **Genuine A9 blockers** — see §4.

## 4. Explicit blocker records (content that cannot be completed lawfully under A9)

Per A9 ("missing copyrighted/source mechanics must not be invented"), the following cannot be
closed by this or any future task without new, lawfully-sourced material:

| Reference | Referenced by | Reason | Status |
|---|---|---|---|
| Move: **Tera Blast** | `ceruledge` (campaign-homebrew-knight) and 2 others | Later-generation move mechanic; no PTU 1.05-era source material defines it. Documented in `KNOWN_GAPS_v1.0.md` item 3. | BLOCKED — do not invent |
| Move: **Poltergeist** | `ceruledge` (campaign-homebrew-knight) | Same as above — later-generation move, no supplied source definition. | BLOCKED — do not invent |
| Ability: **Hydrate** | `dewgong` line (ptu-gen8ish-pokedex) | No Ability definition exists in any of the 18 supplied packs under this name; confirmed absent by direct search, not a matching bug. Would need to be authored from an actual PTU-source Ability writeup, which isn't present in this handoff. | BLOCKED — do not invent |
| Capability category: **Rotom/forme/fusion capabilities** (`Origin Forme`, `Sky Forme`, `Therian Forme`, `Dragon Fusion`, `Heat/Zapper Rotom: Overland`, `Multiform`, `Confined`) | 15 species (Giratina, Landorus, Kyurem, Rotom formes, Deoxys, Hoopa) | `KNOWN_GAPS_v1.0.md` item 4: forme/fusion capabilities are referenced by species but not safely defined in supplied material — the mechanical rules for these forme-change capabilities are not present in the PTU 1.05 core/supplement sources included in this handoff. | BLOCKED — do not invent |
| Capability: **Breathless**, **Sticky Hold**, and 6 other recurring capability names | 58 species total | `KNOWN_GAPS_v1.0.md` item 4, same class of gap — named but undefined in supplied source. | BLOCKED — do not invent |

None of these are escalated as invalidating A9 itself (A9 already anticipates exactly this class of
gap — "Missing copyrighted/source mechanics must not be invented" — and defines the correct
response as leaving them nullable/blocked, which is what the shipped data already does via
`reference_status: "unresolved"`). They are recorded here as the formal, quantified blocker list
T12's acceptance criteria calls for, superseding the informal prose in `KNOWN_GAPS_v1.0.md` with
exact counts and exact affected species.

## 5. What this does NOT cover (explicitly out of T12's scope)

- Actually wiring learned Moves/Edges/Features/Abilities/Capabilities into resolved combat/check
  values — that is T15 ("apply learned mechanics automatically"), which depends on this baseline.
- Building the UI that lets a player select from a species' movepool/ability slots (and therefore
  surface the 62-reference blocker list to a real user) — that is T17.
- Retroactively classifying the 718 Ability/Capability records (§2) — flagged for T15's planning,
  not attempted here.
