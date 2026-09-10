# T13D4 — Serialized Examples (advancement / GM grant changes / respec)

Real, reproducible serialized output — not hand-invented JSON — from
`ptu_domain::engine::trainer_build::{preview_trainer_advancement,
commit_trainer_advancement, preview_trainer_gm_change,
commit_trainer_gm_change, preview_trainer_respec, commit_trainer_respec}`,
called directly against the actual shipped
`content_packs/ptu-core-1.05.ptucp` file and `rulesets/ptu-core-only.json`
this app ships. Captured 2026-09-09; **updated 2026-09-10 for the T13D4-R1
corrective round** (R1A: restored `compute_operation_request_fingerprint`
— the build-commit receipt hash — to its exact pre-T13D4, already-
FINAL-ACCEPTED algorithm, after `T13D4_BUILD_CONTRACT_REVIEW.md` confirmed
a literal `"operation_kind"` field had been added to it, which would have
broken replay for every receipt created before that change; R1B: GM
resource allocation now accepts a structured `{definition_version_id,
parameters}` form and passes REAL parameters to the eight Skill Edge
policies instead of a hardcoded `Value::Null` that made every parameterized
policy permanently reject — see new case 8 below) with new case 8 and this
note. See `T13D4_R1_WORKER_RESULT.md` for the full corrective-round
evidence, including the independently-hand-reconstructed fingerprint proof
and the R1Q pending-milestone-reconciliation diagnostic.

Reproduce with:
```
cd app
cargo run -p ptu-domain --example t13d4_capture_examples
```

The example source is `app/crates/domain/examples/t13d4_capture_examples.rs`.
All six Tauri commands (`app/src-tauri/src/commands.rs`) call exactly these
six domain functions and return their output unmodified — the JSON below is
the real wire shape modulo Tauri's own `request` argument wrapper. All six
reject with the SAME structured `TrainerBuildError` object D1/D3 already use
(`#[serde(tag = "kind")]`), never a plain string, never a second error
vocabulary — see cases 2, 3 (replay tail), and 7 below.

The seed Trainer (`seed_managed_trainer`) is a `published`-build-state
level-N Trainer with Novice Acrobatics + Novice Focus and a single
Creation-sourced 3-point HP allocation, saved directly via
`save_trainer_profile` — D4's own scope starts from an ALREADY-existing
Trainer (D3 creation is exercised separately in
`T13D3_SERIALIZED_EXAMPLES.md`).

## 1. `preview_trainer_advancement` — SUCCESS (L1→L2)

One ordinary Edge (Acrobat) plus the L2 restricted bonus Skill Edge slot
(Basic Skills → Guile), matching the real `trainer_progression` L2 row
(`edges_at_level: 2`, one ordinary + one restricted bonus bundled together).
Preview never persists — issues array is empty because the picks are
legal.

```json
{
  "base_revision": "e77b93bb32229a3163a883d0242492c6a463513c57a3d6ea78c27b5ca0f6831b",
  "resolution": {
    "from_level": 1,
    "to_level": 2,
    "ordinary_stat_points_granted": 1,
    "ordinary_edges_required": 1,
    "ordinary_features_required": 0,
    "restricted_bonus_edge_required": true,
    "milestone": {
      "level": 2,
      "name": "Adept Skills",
      "choice_options": [],
      "option_chosen": null,
      "pending": false
    },
    "skills": {
      "acrobatics": { "base_rank": "novice" },
      "focus": { "base_rank": "novice" },
      "guile": { "base_rank": "novice" }
    },
    "edges": [
      { "definition_version_id": "edges:acrobat@core", "level": 2, "parameters": null, "policy_kind": "edge", "sequence": 0, "source": "level_up" },
      { "definition_version_id": "edges:basic-skills@core", "level": 2, "parameters": { "skill": "guile" }, "policy_kind": "edge", "sequence": 1, "source": "bonus_skill_edge" }
    ],
    "features": [],
    "stat_allocation_milestone_entries": [],
    "issues": []
  },
  "core_result": { "...": "combat_stats/max_hp/etc. — see full run output" }
}
```

Note the `"name": "Adept Skills"` milestone row at level 2 — this is the
rank-unlock row from `trainer_milestones`, entirely distinct from the
Trainer's own restricted-bonus Skill Edge pick; `option_chosen: null` here
is correct (this milestone has no `choice_options`/stream, so it never
requires one — see `MilestoneResolution.pending`).

## 2. `commit_trainer_advancement` — INVALID (milestone choice required)

L4→L5 with no `milestone_option_id`, even though an ordinary Feature was
supplied — the level-5 offensive-stat-stream milestone always requires an
explicit choice (`"stat_stream" | "edges" | "general_feature"`); a missing
choice is a non-overridable `Error` (`override_allowed: false` — no
`manual_adjudications` can bypass this, matching D3-R1C's own gate
philosophy: an unresolved milestone choice is not the same class of thing
as an adjudicatable prerequisite ambiguity).

```json
{
  "kind": "ValidationFailed",
  "issues": [
    {
      "severity": "error",
      "code": "milestone_choice_required",
      "message": "Level 5's milestone (\"Amateur Trainer\") requires a choice before advancement can be committed (Core p19-20).",
      "override_allowed": false,
      "field": "milestone_option_id"
    }
  ]
}
```

## 3. `commit_trainer_advancement` — SUCCESS, then REPLAY, then OPERATION_CONFLICT

Same L1→L2 intent as case 1, committed for real. `commit.trainer_id` /
`resolution.to_level`; the persisted `TrainerProfile` reloaded from SQLite
shows `level=2, edges=2` — the effect is REAL, not display-only (closing
the exact gap `resolve_advancement`/`AdvancementRecord.milestone_choice`
left as an opaque string with no applied effect before T13D4).

Replaying the identical `operation_id` + payload returns the same
`resolution.to_level` (`2`) without a second Trainer or a second level-up —
T13D3-R1A's own durable-operation-identity mechanism, reused verbatim via a
literal `"operation_kind": "trainer_advancement_commit"` folded into the
request fingerprint (never confusable with a `trainer_build_commit`
replay).

Reusing the SAME `operation_id` with a different `next_level` rejects
`OperationConflict`, never silently applies the new payload:

```json
{
  "kind": "OperationConflict",
  "message": "operation_id \"95896ff0-be43-4ecd-9f7d-bf56fd6dd4d0\" was already used for a different request; use a new operation_id for a new mutation."
}
```

## 4. `commit_trainer_gm_change` — add fixed NUMERIC grant

`target: "trainer.stat.hp"`, `operation: "add"`, `value: 3` — a real GM
boon, immediately visible in `core_result.combat_stats.hp` via the
pre-existing `stat_modifiers_from_gm_grants` mechanism (no new stat-effect
pathway invented):

```json
{
  "resolution": {
    "action": "add",
    "grant_kind": "fixed",
    "grant_id": "46f0e0b5-e55f-4e43-b4a7-e20b941b839d",
    "effective_grant": {
      "id": "46f0e0b5-e55f-4e43-b4a7-e20b941b839d",
      "kind": "fixed",
      "note": "GM boon for surviving the gauntlet.",
      "operation": "add",
      "priority": 100,
      "target": "trainer.stat.hp",
      "value": 3.0
    },
    "linked_acquisition": null,
    "linked_stat_entries": [],
    "dependent_invalidations": [],
    "issues": []
  },
  "core_result": {
    "combat_stats": {
      "hp": {
        "base": 13.0,
        "final_value": 16.0,
        "breakdown": [{ "label": "GM Grant", "operation": "add", "value": 3.0, "resulting_value": 16.0 }]
      }
    }
  }
}
```

## 5. `commit_trainer_gm_change` — add fixed DEFINITIONAL grant, then REMOVE it

Adding a fixed grant targeting `trainer.feature` with a
`definition_version_id` (not a numeric target) creates a REAL linked Feature
acquisition — `source: "gm_fixed"`, `source_id` traceable back to the grant
— populating the D1-reserved-but-never-used `source_id` acquisition field
for the first time:

```json
{
  "resolution": {
    "action": "add",
    "grant_kind": "fixed",
    "grant_id": "ff4fab3d-d41d-483d-bf56-960fd91ff4bd",
    "effective_grant": {
      "definition_version_id": "features:let-me-help-you-with-that@core",
      "id": "ff4fab3d-d41d-483d-bf56-960fd91ff4bd",
      "kind": "fixed",
      "target": "trainer.feature"
    },
    "linked_acquisition": {
      "definition_version_id": "features:let-me-help-you-with-that@core",
      "level": 1,
      "parameters": null,
      "policy_kind": "feature",
      "sequence": 0,
      "source": "gm_fixed",
      "source_id": "ff4fab3d-d41d-483d-bf56-960fd91ff4bd"
    },
    "linked_stat_entries": [],
    "dependent_invalidations": [],
    "issues": []
  }
}
```

Removing that same grant reports the REAL dependent acquisition it funded
— a caller can preview the dependency before confirming, never a silent
partial removal:

```json
{
  "resolution": {
    "action": "remove",
    "grant_kind": "fixed",
    "grant_id": "ff4fab3d-d41d-483d-bf56-960fd91ff4bd",
    "effective_grant": null,
    "linked_acquisition": null,
    "linked_stat_entries": [],
    "dependent_invalidations": [
      "Removing grant \"ff4fab3d-d41d-483d-bf56-960fd91ff4bd\" also removes the acquisition it funded: \"features:let-me-help-you-with-that@core\"."
    ],
    "issues": []
  }
}
```

After the remove commits, `core_result.combat_stats.hp.final_value` stays
`16.0` (the earlier numeric grant from case 4, on the SAME seed Trainer,
survives untouched) while the Feature acquisition is gone — confirming
"remove only what this grant funded, nothing else."

## 6. `commit_trainer_respec` — normal stat rebuild, then a resource-grant reallocation

First commit: `proposed_normal_rebuild: [{"stat": "hp", "points": 5}]`
against a Trainer whose `stat_allocation` already carries one
Creation-sourced HP entry (3 points) AND one Milestone-sourced Speed entry
(1 point, simulating a prior offensive-stream ongoing bonus). The rebuild
REPLACES the normal (Creation/LevelUp) entries with the new 5-point HP
entry; the Milestone entry survives byte-for-byte, never touched:

```json
{
  "resolution": {
    "stat_allocation_entries": [
      { "stat": "hp", "source": "creation", "level": 1, "points": 5, "note": null },
      { "stat": "speed", "source": "milestone", "level": 5, "points": 1, "note": "Offensive stream ongoing bonus." }
    ],
    "preserved_fixed_grant_count": 0,
    "preserved_resource_grant_count": 0,
    "reallocated_grant_ids": [],
    "issues": []
  },
  "core_result": { "combat_stats": { "hp": { "final_value": 15.0 }, "speed": { "final_value": 6.0 } }, "max_hp": { "final_value": 57.0 } }
}
```

Second commit (same Trainer, after a `resource` grant — 1 Edge slot
allocated to Acrobat — was added via `commit_trainer_gm_change`):
`authorized_resource_reallocations: [{"grant_id": ..., "new_allocation":
"edges:iron-mind@core"}]`, `proposed_normal_rebuild: []`. The grant's `id`/
`kind`/`resource`/`amount` are immutable (verified against the reloaded
profile — see `trainer_advancement.rs`'s
`respec_reallocates_a_resource_grant_preserving_its_origin_and_capacity`);
only `allocation` moves, via `respec::reallocate_resource_grant` (the
PRE-EXISTING legacy pure-transform helper, reused verbatim — never
duplicated):

```json
{
  "resolution": {
    "stat_allocation_entries": [
      { "stat": "speed", "source": "milestone", "level": 5, "points": 1, "note": "Offensive stream ongoing bonus." }
    ],
    "preserved_fixed_grant_count": 0,
    "preserved_resource_grant_count": 1,
    "reallocated_grant_ids": ["72f10bee-bda0-4347-9729-b7385b8db07e"],
    "issues": []
  }
}
```

(The empty `proposed_normal_rebuild: []` in this second commit is
deliberate — this scenario isolates the reallocation, so the normal HP
entry from the first commit is intentionally cleared; `stat_allocation_entries`
correctly shows only the preserved Milestone entry.)

## 7. `commit_trainer_advancement` — STALE

A relevant `stat_allocation` write lands on the Trainer between computing
`expected_base_revision` and committing — `base_revision` folds in
`stat_allocation` (same C1-established scheme every D3/D4 family shares),
so the commit correctly rejects rather than silently overwriting the
concurrent change:

```json
{
  "kind": "StaleRevision",
  "message": "Content context changed"
}
```

## 8. `commit_trainer_gm_change` — add a PARAMETERIZED resource Skill Edge grant (T13D4-R1B)

Before this corrective round, `resolve_resource_allocation` always passed
`Value::Null` as `apply_skill_edge`'s parameters — every one of the eight
Skill Edge policies (Basic/Adept/Expert/Master Skills, Skill Enhancement,
Categoric Inclination, Skill Stunt, Virtuoso) requires a real parameter, so
this path could never succeed. `allocation` now accepts the structured form
`{definition_version_id, parameters}` (the plain-string form is preserved
for parameterless allocations — see case in `T13D4_SERIALIZED_EXAMPLES.md`'s
earlier "add resource then allocate it to an edge" coverage, still passing
unmodified). Here, Basic Skills targeting Guile (Untrained) produces a REAL,
persisted rank change:

```json
{
  "resolution": {
    "action": "add",
    "grant_kind": "resource",
    "grant_id": "bbd3cf5d-2a5c-43d4-b8b9-d5863cb75106",
    "effective_grant": {
      "allocation": { "definition_version_id": "edges:basic-skills@core", "parameters": { "skill": "guile" } },
      "amount": 1,
      "id": "bbd3cf5d-2a5c-43d4-b8b9-d5863cb75106",
      "kind": "resource",
      "resource": "edge"
    },
    "linked_acquisition": {
      "definition_version_id": "edges:basic-skills@core",
      "granted_skill_rank_change": { "from_rank": "untrained", "skill_id": "guile", "to_rank": "novice" },
      "parameters": { "skill": "guile" },
      "policy_kind": "edge",
      "source": "gm_resource",
      "source_id": "bbd3cf5d-2a5c-43d4-b8b9-d5863cb75106"
    },
    "linked_stat_entries": [],
    "dependent_invalidations": [],
    "issues": []
  }
}
```

After this commits, `load_trainer_profile(...).skills["guile"].base_rank`
is `"novice"` — the effect is REAL and persisted, not merely validated and
discarded (the confirmed BLOCKER). `granted_skill_rank_change`/
`granted_check_bonus` are additive fields on the linked acquisition's own
JSON (never a schema migration), read by new `apply_granted_skill_rank_
change`/`revert_granted_skill_rank_change` helpers so editing this grant to
a different skill, or removing it outright, reverts the old rank change
(conservatively — only if nothing else has touched the skill since) before
applying any new one. See `trainer_advancement.rs`'s
`editing_a_resource_grant_to_a_different_skill_reverts_the_old_rank_and_
applies_the_new_one_exactly_once`, `removing_a_resource_grant_reverts_its_
rank_change_when_nothing_else_touched_the_skill_since`, and
`removing_a_resource_grant_does_not_clobber_a_skill_independently_raised_
again_since`.

## Cross-references

- Full 30-case automated test suite: `app/crates/domain/tests/trainer_advancement.rs`
  (ordinary+restricted advancement, restricted-bonus rank-ceiling rejection,
  milestone-required blocking, L5 stat-stream retroactive+ongoing bonuses,
  L5 general-feature alternative + non-general-feature rejection, the
  "cannot start the stream late" rule, GM add/edit/remove for all three
  grant flavors, disabled-definition rejection, respec normal rebuild +
  resource reallocation, replay/conflict for all three new families,
  interleaved-write survival, stale rejection, reopen-preserves-effects,
  parameterized resource Skill Edges — real rank change/check bonus,
  add/edit/remove revert semantics, malformed-parameter rejection — and
  the R1Q pending-milestone-reconciliation diagnostic).
- Independently-reconstructed pre-D4 fingerprint proof (R1A):
  `app/crates/domain/tests/trainer_build_creation.rs`'s
  `r1a_the_restored_fingerprint_exactly_matches_an_independently_hand_
  built_pre_d4_algorithm` and `r1a_a_build_operation_id_cannot_be_replayed_
  as_an_advancement_commit`.
- D3's own creation examples: `T13D3_SERIALIZED_EXAMPLES.md`.
