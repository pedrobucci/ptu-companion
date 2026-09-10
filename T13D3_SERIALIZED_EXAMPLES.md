# T13D3 — Serialized Examples (level-1 Trainer creation)

Real, reproducible serialized output — not hand-invented JSON — from
`ptu_domain::engine::trainer_build::{preview_build, commit_build}`, called
directly against the actual shipped `content_packs/ptu-core-1.05.ptucp` file
and `rulesets/ptu-core-only.json` this app ships. Originally captured
2026-09-09; **updated the same day for the T13D3-R1 corrective round**
(R1A durable operation identity + active-pack validation, R1B automatic
Feature stat tags, R1C publication-gate enforcement — see
`T13D3_R1_WORKER_RESULT.md`) with new cases 3b/3c/3d and 6 below.

Reproduce with:
```
cd app
cargo run -p ptu-domain --example t13d3_capture_examples
```

The example source is `app/crates/domain/examples/t13d3_capture_examples.rs`.
The `preview_trainer_build`/`commit_trainer_build` Tauri commands
(`app/src-tauri/src/commands.rs`) call exactly these two domain functions
and return their output unmodified — the JSON below is the real wire shape
modulo Tauri's own `request` argument wrapper. Both commands reject with a
structured `TrainerBuildError` object (`#[serde(tag = "kind")]`), never a
plain string — see cases 2, 3c, 3d, and 4 below.

The fixture (`full_valid_intent`) is a Background (Adept Acrobatics /
Novice Command / Pathetic Stealth+Intimidate+Survival) plus the full
4-paid-Edges + 4-paid-Features + 1-free-Training-Feature budget, ordered so
a later pick (`chronicler`, Novice Perception) is only satisfiable because
an earlier `basic-skills` pick raised Perception first — proving the
replay-in-order/threaded-state design actually works, not just accepts an
unordered set. One pick (`features:hex-maniac@core`, Novice Occult
Education) is deliberately left unmet, to exercise the overridable
`manual_adjudications` path realistically instead of only via a
handwritten edge case.

## 1. `preview_trainer_build` — SUCCESS

Never persists. Surfaces the one deliberately-unmet, overridable
`prerequisite_not_met` issue (`severity: "error"`, `override_allowed:
true`) alongside the full resolved skill map (17 skills, Background
applied), the 4 resolved Edges / 5 Features (4 paid + 1 free), the 10-point
Creation stat allocation (now correctly source-tagged `"creation"` — see
"Bug found and fixed" below), and the full derived `core_result` (Max HP
48, Combat Stats, jump/movement, Weight Class from `weight_lb: 150`,
`allocation_summary: {granted: 10, spent: 10, remaining: 0}`).

```json
{
  "base_revision": "23c17bcf1f9a6825fbadd2e4ecfd31cce171f1ca9b1ec4d2cdc98ad71e669e51",
  "rules_fingerprint": "23c17bcf1f9a6825fbadd2e4ecfd31cce171f1ca9b1ec4d2cdc98ad71e669e51",
  "resolution": {
    "skills": { "acrobatics": {"base_rank":"adept"}, "command": {"base_rank":"novice"}, "guile": {"base_rank":"novice"}, "perception": {"base_rank":"novice"}, "intimidate": {"base_rank":"pathetic"}, "stealth": {"base_rank":"pathetic"}, "survival": {"base_rank":"pathetic"}, "...": "(17 total; every other skill untrained)" },
    "check_bonuses": {},
    "edges": [
      {"definition_version_id":"edges:basic-skills@core","level":1,"parameters":{"skill":"perception"},"policy_kind":"edge","sequence":0,"source":"creation"},
      {"definition_version_id":"edges:basic-skills@core","level":1,"parameters":{"skill":"guile"},"policy_kind":"edge","sequence":2,"source":"creation"},
      {"definition_version_id":"edges:acrobat@core","level":1,"parameters":null,"policy_kind":"edge","sequence":4,"source":"creation"},
      {"definition_version_id":"edges:categoric-inclination@core","level":1,"parameters":{"category":"spirit"},"policy_kind":"edge","sequence":6,"source":"creation"}
    ],
    "features": [
      {"definition_version_id":"features:chronicler@core","sequence":1,"source":"creation"},
      {"definition_version_id":"features:ace-trainer@core","sequence":3,"source":"creation"},
      {"definition_version_id":"features:commander@core","sequence":5,"source":"creation"},
      {"definition_version_id":"features:hex-maniac@core","sequence":7,"source":"creation"},
      {"definition_version_id":"features:brutal-training@core","sequence":8,"source":"creation"}
    ],
    "stat_allocation_creation_entries": [
      {"stat":"hp","source":"creation","level":1,"points":2,"note":null},
      {"stat":"attack","source":"creation","level":1,"points":3,"note":null},
      {"stat":"speed","source":"creation","level":1,"points":5,"note":null}
    ],
    "elemental_connection_mode": null,
    "paid_edges_used": 4,
    "paid_features_used": 4,
    "free_training_feature_used": true,
    "issues": [
      {"severity":"error","code":"prerequisite_not_met","message":"\"features:hex-maniac@core\": requires novice occult-education or higher (Novice Occult Education)","override_allowed":true,"field":"acquisitions[7]"}
    ]
  },
  "core_result": {
    "combat_stats": {"hp":{"base":12.0,"final_value":12.0,"breakdown":[]},"attack":{"base":8.0,"final_value":8.0,"breakdown":[]},"speed":{"base":10.0,"final_value":10.0,"breakdown":[]}, "...": "(defense/special_attack/special_defense at their 5.0 unallocated base)"},
    "max_hp": {"base":48.0,"final_value":48.0,"breakdown":[]},
    "weight": {"weight_lb":150,"weight_class":"wc4"},
    "allocation_summary": {"granted":10,"spent":10,"remaining":0},
    "validation": []
  }
}
```
(Full, unabridged output — every one of the 17 skills, all Combat Stats,
jump/movement figures — is in the example's raw run output; trimmed here
for readability with `"...": "..."` markers, never altering any real
value.)

## 2. `commit_trainer_build` — INVALID (blocking issue not adjudicated)

Same intent, `confirm: true`, but `manual_adjudications: []` — the one
Error-severity issue survives, so nothing is persisted:

```json
{
  "kind": "ValidationFailed",
  "issues": [
    {"severity":"error","code":"prerequisite_not_met","message":"\"features:hex-maniac@core\": requires novice occult-education or higher (Novice Occult Education)","override_allowed":true,"field":"acquisitions[7]"}
  ]
}
```

## 3. `commit_trainer_build` — SUCCESS (adjudicated)

Same request, now with `manual_adjudications: [{"code":
"prerequisite_not_met", "field": "acquisitions[7]", "note": "GM approved:
campaign lets Occult apprentices learn Hex Maniac early."}]`. Publishes a
brand-new Trainer (`trainer_id` server-generated) and reloads it from a
fresh SQLite read to prove real persistence, not an in-memory echo:

```json
{
  "trainer_id": "71d7c263-6d7c-4090-be20-a8a6f4c95bc9",
  "base_revision": "79c38d4ca12d47a7356f3015be59760504a8554bae63a2cab0b407807f6265f3",
  "resolution": { "...": "identical to case 1's resolution (the issue is still reported — adjudication overrides it from blocking commit, it does not erase it from the record)" },
  "core_result": { "...": "identical to case 1's core_result" }
}
```

Reloaded `TrainerProfile` (fresh `load_trainer_profile` call, new
connection-independent read): `name: "Ash"`, all 17 skills present with the
Background applied, 4 `edges` + 5 `features` each carrying a real
server-generated `acquisition_id` (UUID, distinct per entry — repeat Basic
Skills picks are NOT collapsed), `stat_allocation.entries` all
`source:"creation"` summing to the full 10-point pool, `weight_lb: 150`,
and:
```json
"build_state": {
  "campaign_setup_pending": true,
  "elemental_connection_mode": null,
  "narrative": "Grew up chasing Pokémon in the hills.",
  "status": "published"
}
```
`campaign_setup_pending: true` always — Steps 8-9 (starter Pokémon,
starting items, Core p17/18) are GM decisions this task never marks ready.

## 3b. `commit_trainer_build` — REPLAY (T13D3-R1A)

The confirmed BLOCKER from the independent review: a `trainer_id: None`
creation retried with the SAME `operation_id` and payload (the client
never learned the server-generated Trainer id from case 3 — network
retry, double-submit) must return the SAME Trainer, never a second one.
Case 3's own `commit_request` resent verbatim:

```
replayed trainer_id == first trainer_id: true
trainers table row count after replay: 1
```

No receipt is written a second time either (`trainer_build_operations`
stays at exactly 1 row for this `operation_id` — see
`trainer_build_creation.rs::a_repeated_commit_of_a_brand_new_creation_with_the_same_operation_id_returns_the_same_trainer`).

## 3c. `commit_trainer_build` — OPERATION_CONFLICT

The same `operation_id` reused with a genuinely different intent (`name:
"Misty"` instead of `"Ash"`) — a client bug or id collision, never a
legitimate retry:

```json
{
  "kind": "OperationConflict",
  "message": "operation_id \"401f1734-f08d-4ee4-9c27-218e8deaf33a\" was already used for a different request; use a new operation_id for a new mutation."
}
```

## 3d. `commit_trainer_build` — PACK_NOT_ACTIVE (T13D3-R1A, P3)

`content_pack_id` naming a pack that is not an enabled pack in the active
ruleset — a definition pin elsewhere never implicitly activates a whole
pack's datasets:

```json
{
  "kind": "PackNotActive",
  "message": "Content pack \"not-a-real-or-enabled-pack\" is not an enabled pack in the active ruleset \"ptu-core-only\"."
}
```

## 4. `preview_trainer_build` — STALE

The held `base_revision` from case 1 is presented again, but after a real
E02 authoring action (`content::authoring::soft_delete_definition` on
`edges:acrobat@core`, the same mechanism T13E02-R2's own F4 fix covers)
changed the installed-content revision underneath it:

```json
{
  "kind": "StaleRevision",
  "message": "Content context changed"
}
```

A genuinely NEW operation (fresh `operation_id`) against a Trainer whose
content/rules moved since an earlier successful commit is rejected the
identical way — R1A's replay short-circuit (case 3b) applies ONLY to a
true replay of the same `operation_id`, never to a new one (see
`trainer_build_creation.rs::a_new_operation_against_a_stale_revision_after_content_changed_still_rejects_stale`).

## 5. `commit_trainer_build` — LEGACY reconciliation

A pre-existing, pre-D3 Trainer (`money: 250`, one GM-fixed grant, one
opaque `"source":"legacy"` Edge, one carried Pokémon, one roster, one
inventory item, `stat_allocation.entries: []`, `build_state: null`) is
reconciled with the same creation intent, `trainer_id:
Some("legacy-example-1")`.

Before (abridged):
```json
{
  "money": 250,
  "gm_grants": [{"id":"grant-1","kind":"fixed","target":"trainer.stat.hp","operation":"add","value":2}],
  "edges": [{"definition_version_id":"edges:acrobat@core","source":"legacy"}],
  "pokemon": [{"id":"pkm-1","species_definition_id":"sableye","level":5,"storage_state":"carried", "...": "..."}],
  "rosters": [{"id":"r1","name":"Team","active":true}],
  "inventory": {"backpack":[{"item_id":"potion","quantity":2}]},
  "stat_allocation": {"entries": []},
  "build_state": null
}
```

After — every one of those fields is byte-for-byte unchanged; only
`name`/`skills`/`stat_allocation`/`weight_lb`/`build_state` and the
`edges`/`features` list (which now carries the legacy entry PLUS the fresh
creation-sourced ones, never replacing it) changed:
```json
{
  "money": 250,
  "gm_grants": [{"id":"grant-1","kind":"fixed","operation":"add","target":"trainer.stat.hp","value":2}],
  "edges": [
    {"acquisition_id":"dbcfea4e-a5c6-4f3f-8c0a-0662c9cdf4de","definition_version_id":"edges:acrobat@core","source":"legacy"},
    {"definition_version_id":"edges:basic-skills@core","parameters":{"skill":"perception"},"source":"creation"},
    {"definition_version_id":"edges:basic-skills@core","parameters":{"skill":"guile"},"source":"creation"},
    {"definition_version_id":"edges:acrobat@core","source":"creation"},
    {"definition_version_id":"edges:categoric-inclination@core","parameters":{"category":"spirit"},"source":"creation"}
  ],
  "pokemon": [{"id":"pkm-1","species_definition_id":"sableye","level":5,"storage_state":"carried", "...": "..."}],
  "rosters": [{"id":"r1","name":"Team","active":true}],
  "inventory": {"backpack":[{"item_id":"potion","quantity":2}]},
  "stat_allocation": {"entries": [{"stat":"hp","source":"creation","points":2}, {"stat":"attack","source":"creation","points":3}, {"stat":"speed","source":"creation","points":5}]},
  "build_state": {"status":"published","campaign_setup_pending":true, "...": "..."}
}
```
Note the legacy `edges:acrobat@core` (source `"legacy"`) and the freshly
re-acquired `edges:acrobat@core` (source `"creation"`) coexist as two
distinct entries — `merge_acquisitions_preserving_other_sources` only ever
replaces entries whose `"source"` is literally `"creation"`, never
deduplicating across provenance.

## 6. `commit_trainer_build` — SUCCESS with T13D3-R1B automatic Feature stat tags

The exact disposition-audited Core p14-16 worked example: Lisa acquires
`features:athlete@core` and `features:training-regime@core`, both
carrying a real, shipped `["+HP"]` tag (Core p58 "Feature Tags" — verified
directly against the shipped pack, SHA256
`0f9c7c497a27b80a17caaa0a702bdd1b63b052b331b0f417ab33976dea9f8629`, and
against the PDF by both the Planner and, independently, the Revisor). 3
Creation points allocated to HP (10 floor + 3 = 13), then +1 from EACH of
the two tags = 15, cascading into Max HP = `level*2 + HP*3 + 10` = `1*2 +
15*3 + 10` = 57 — matching Core's own numbers exactly.

```json
"resolution.feature_tag_modifiers": [
  {"id":"feature-tag:features:athlete@core:+HP","source_label":"Feature Tag","target":"trainer.stat.hp","operation":"add","value":1.0,"priority":100},
  {"id":"feature-tag:features:training-regime@core:+HP","source_label":"Feature Tag","target":"trainer.stat.hp","operation":"add","value":1.0,"priority":100}
]
```
```
HP: 15 (expected 15.0 = 10 floor + 3 allocated + 2 tags)
Max HP: 57 (expected 57.0 = level*2 + HP*3 + 10 = 1*2 + 15*3 + 10)
```
```json
"core_result.combat_stats.hp": {
  "base": 13.0,
  "final_value": 15.0,
  "breakdown": [
    {"label":"Feature Tag","operation":"add","value":1.0,"resulting_value":14.0},
    {"label":"Feature Tag","operation":"add","value":1.0,"resulting_value":15.0}
  ]
}
```

`id` before commit falls back to the definition_version_id (no
`acquisition_id` exists yet at preview time); after commit and reload it
becomes the real server-generated per-acquisition UUID — see
`derive_feature_tag_modifiers`'s own doc comment. The commit here also
carries two adjudications for two REAL, pre-existing seed data-quality
issues unrelated to R1B itself (disclosed, not silently patched):
Athlete's own `prerequisite_semantics.ast` mis-parses its raw text as an
`"all"` (AND) combinator instead of the intended `"any"` (OR), and
Training Regime's "Athlete" prerequisite leaf is mislabeled
`ambiguous_entity` instead of `has_feature` — both exercised and
adjudicated exactly like the accepted `hex-maniac` case in case 3 above.

Trust boundary: this is decoded from a build-time-embedded, source-audited
fingerprint map (`test_vectors/trainer_build/feature_stat_tags.json`, 134
Core Feature records with a `+Stat`-family tag, generated from and
verified against the real shipped pack), not "whatever `tags` says live
in the DB" — a homebrew Feature carrying an identical-looking tag under
its own `definition_version_id` gets no automatic effect at all (absence
from the table is the normal case, not an error), and a live record whose
`data_json` no longer hash-matches its table entry (simulated tampering)
leaves the tag explicitly unresolved (`feature_tag_source_unverified`,
Warning) rather than silently trusting a possibly-altered payload — see
`trainer_build_creation.rs`'s `a_homebrew_feature_with_a_matching_tag_never_gets_an_automatic_modifier`
and `a_tampered_record_under_a_trusted_id_leaves_the_tag_unresolved_not_silently_trusted`.

## Bug found and fixed while writing this evidence

Writing `trainer_build_creation.rs`'s full round-trip test (assert
`stat_allocation` sums to the full 10-point Creation pool) caught that
`resolve_creation` was calling
`trainer_core::build_normal_allocation_entries(&intent.stat_desired_points,
1, &[])` — an **empty** progression slice, always. Since that function's
`creation_pool` is `progression.iter().find(|r| r.level ==
1).map(...).unwrap_or(0)`, every desired stat point was silently
reclassified `source: "level_up"` instead of `"creation"`, at Trainer level
1, with zero actually landing in the Creation pool.

Fixed by adding a `progression: &[TrainerProgressionRow]` parameter to
`resolve_creation`, loading the real `trainer_progression` dataset once in
`preview_build`/`commit_build` (reusing the same load for
`resolve_preview_core_stats`, which already needed it — no duplicate
dataset read introduced), and passing it through. This was the original
D3 round's own fix; see `T13D3_R1_WORKER_RESULT.md` for the R1A/R1B/R1C
corrective round's own full verification log (`trainer_build_creation.rs`
now has 44 tests; `cargo test --workspace` 255 passed, 0 failed;
`npm run typecheck`/`npx vitest run`/`npm run build` all clean).
