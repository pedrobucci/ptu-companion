# T13D4-R2 — Serialized Examples (dedicated milestone reconciliation)

Real, reproducible serialized output — not hand-invented JSON — from
`ptu_domain::engine::trainer_build::{preview_trainer_milestone_reconciliation,
commit_trainer_milestone_reconciliation}`, called directly against the
actual shipped `content_packs/ptu-core-1.05.ptucp` file and
`rulesets/ptu-core-only.json` this app ships. Captured 2026-09-10.

Reproduce with:
```
cd app
cargo run -p ptu-domain --example t13d4_r2_capture_examples
```

The example source is `app/crates/domain/examples/t13d4_r2_capture_examples.rs`.
Both new Tauri commands (`app/src-tauri/src/commands.rs`) call exactly
these two domain functions and return their output unmodified. Both
reject with the SAME structured `TrainerBuildError` object D1/D3/D4
already use — see cases 3 and 5.

The seed Trainer (`seed_legacy_level_10_trainer`) is a `published`-build-
state level-10 Trainer with an EMPTY `progression` ledger — it never made
its level-5 or level-10 milestone choices through this engine. This is
the exact scenario R1Q proved has no other resolution path
(`advancement_level_mismatch` on both `next_level: 5` and `next_level: 10`
against `commit_trainer_advancement`).

## 1-2. `preview_trainer_milestone_reconciliation` / `commit` — SUCCESS

Reconciling the level-5 offensive-stat-stream at level 10, `not_received`
disposition (the GM explicitly declares this Trainer never got any of
this tier's benefits before). Core p19's own worked example, now via
reconciliation: retroactive +2, plus +1 each at levels 6/8/10 — 4 separate
benefits, 5 total points, all real, all persisted:

```json
{
  "base_revision": "3c6ee59fe9b3fd00bb8ba3fa961c7eacf62c287e4f6be33e00cb258e42f216b8",
  "resolution": {
    "from_level": 10,
    "to_level": 10,
    "milestone_level": 5,
    "option": "stat_stream",
    "benefits": [
      { "benefit_id": "reconcile:5:retroactive", "kind": "stat_stream_retroactive", "status": "new", "description": "Retroactive offensive-stat-stream bonus (Core p19), covering levels [2, 4]." },
      { "benefit_id": "reconcile:5:ongoing:6", "kind": "stat_stream_ongoing", "status": "new", "description": "Offensive-stat-stream ongoing bonus at level 6 (Core p19-20)." },
      { "benefit_id": "reconcile:5:ongoing:8", "kind": "stat_stream_ongoing", "status": "new", "description": "Offensive-stat-stream ongoing bonus at level 8 (Core p19-20)." },
      { "benefit_id": "reconcile:5:ongoing:10", "kind": "stat_stream_ongoing", "status": "new", "description": "Offensive-stat-stream ongoing bonus at level 10 (Core p19-20)." }
    ],
    "stat_allocation_entries": [
      { "stat": "attack", "source": "milestone", "level": 5, "points": 2, "note": "Retroactive offensive-stat-stream bonus (Core p19), covering levels [2, 4].", "source_id": "reconcile:5:retroactive" },
      { "stat": "attack", "source": "milestone", "level": 5, "points": 1, "note": "Offensive-stat-stream ongoing bonus at level 6 (Core p19-20).", "source_id": "reconcile:5:ongoing:6" },
      { "stat": "attack", "source": "milestone", "level": 5, "points": 1, "note": "Offensive-stat-stream ongoing bonus at level 8 (Core p19-20).", "source_id": "reconcile:5:ongoing:8" },
      { "stat": "attack", "source": "milestone", "level": 5, "points": 1, "note": "Offensive-stat-stream ongoing bonus at level 10 (Core p19-20).", "source_id": "reconcile:5:ongoing:10" }
    ],
    "edges": [],
    "features": [],
    "remaining_pending_milestone_levels": [10],
    "issues": []
  }
}
```

`from_level == to_level == 10` (unchanged — reconciliation never
advances) and `remaining_pending_milestone_levels: [10]` (level 10's own
choice is still pending, a SEPARATE future operation). After commit, the
persisted `TrainerProfile.level` stays `10`; the `progression` ledger
gains ONE new entry at `level: 5` carrying `milestone_option_kind:
"stat_stream"`, `stat_stream_choice: "attack"`, `stat_points: 0` /
`edges: 0` / `features: 0` (zero ordinary awards — the mandatory
"never re-grant ordinary budgets" guarantee), and the new
`reconciliation` object recording the option/disposition/attribution/
benefit identities.

## 3. `commit_trainer_milestone_reconciliation` — INVALID (already resolved)

Reconciling level 5 a second time, after case 2 already resolved it:

```json
{
  "kind": "ValidationFailed",
  "issues": [
    {
      "severity": "error",
      "code": "reconciliation_target_already_resolved",
      "message": "Level 5's milestone is already resolved and cannot be reconciled again.",
      "override_allowed": false,
      "field": "milestone_level"
    }
  ]
}
```

## 4. `commit_trainer_milestone_reconciliation` — `map_existing` disposition adopts an existing stat entry

A different Trainer already carries a legacy `GmOverride`-sourced +2
Special Attack entry at index 1 (from level 3) that the GM now declares
IS the level-5 retroactive bonus, granted early by mistake. Mapping it
(`{"benefit_id": "reconcile:5:retroactive", "kind": "stat_entry", "index":
1, "expected_value": <the exact entry JSON>}`) adopts it — status
`"adopted"`, no new stat entry for that benefit — while the 3 unmapped
ongoing benefits are still freshly granted:

```json
{
  "from_level": 10,
  "to_level": 10,
  "milestone_level": 5,
  "option": "stat_stream",
  "benefits": [
    { "benefit_id": "reconcile:5:retroactive", "kind": "stat_stream_retroactive", "status": "adopted", "description": "Retroactive offensive-stat-stream bonus (Core p19), covering levels [2, 4]." },
    { "benefit_id": "reconcile:5:ongoing:6", "kind": "stat_stream_ongoing", "status": "new", "description": "Offensive-stat-stream ongoing bonus at level 6 (Core p19-20)." },
    { "benefit_id": "reconcile:5:ongoing:8", "kind": "stat_stream_ongoing", "status": "new", "description": "..." },
    { "benefit_id": "reconcile:5:ongoing:10", "kind": "stat_stream_ongoing", "status": "new", "description": "..." }
  ]
}
```

The adopted entry, reloaded from SQLite, keeps its original `source:
"gm_override"`, `level: 3`, `points: 2`, `note` — ONLY gains `source_id:
"reconcile:5:retroactive"`. Adopting never rewrites quantity/rank/stat
(P2's own constraint).

## 5. `commit_trainer_milestone_reconciliation` — STALE

A relevant `stat_allocation` write lands between computing
`expected_base_revision` and committing — rejects rather than silently
overwriting the concurrent change, same scheme every D3/D4 family shares:

```json
{
  "kind": "StaleRevision",
  "message": "Content context changed"
}
```

## Cross-references

- Full 15-case automated test suite:
  `app/crates/domain/tests/trainer_milestone_reconciliation.rs` — level-5
  retroactive+ongoing catch-up; level-10's own separate reconciliation
  (edges alternative, 2 real picks); future-level/non-milestone/already-
  resolved rejections; "stream cannot be started late" reused for
  reconciliation; `map_existing` adoption (stat entry); stale-mapped-value
  rejection; `prior_benefits` disposition/note required; non-general-
  Feature rejection; a parameterized Skill Edge as an alternative choice
  applying its real rank change; replay/conflict; stale `base_revision`;
  preview-never-persists + reopen-preserves-commit; interleaved-write
  survival.
- The mandatory P4 hash-stability proof (a prerequisite for this whole
  round, done BEFORE any reconciliation code was written):
  `trainer_advancement.rs`'s
  `pre_r2_stat_allocation_serialization_and_base_revision_are_byte_identical_to_the_frozen_pre_r2_oracle`
  and `a_present_source_id_changes_serialization_and_base_revision_and_survives_full_backup`.
- R1Q's own gap diagnostic (the scenario this whole task closes):
  `trainer_advancement.rs`'s
  `r1q_diagnostic_no_existing_path_reconciles_a_pending_milestone_at_or_below_current_level`.
- D4's own prior examples: `T13D4_SERIALIZED_EXAMPLES.md`.
