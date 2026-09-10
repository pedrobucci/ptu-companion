# T13E02 — Serialized Examples (E01-C1's five endpoints)

Real, reproducible serialized output — not hand-invented JSON — from
`ptu_domain::content::context`'s functions, called directly against the
actual shipped `content_packs/*.ptucp` files and `rulesets/*.json` files
this app ships. Originally captured 2026-09-09; updated for T13E02-R1
(F1-F4 first-round corrections) and **again for T13E02-R2** (F4 residual:
the content fingerprint now also hashes the `enabled`/`needs_review`
columns, which authoring can flip independently of `data_json`).

Reproduce with:
```
cd app
cargo run -p ptu-domain --example t13e02_capture_examples
```

The example source is `app/crates/domain/examples/t13e02_capture_examples.rs`.
Every Tauri command wrapping these functions (`get_content_context`,
`set_active_ruleset`, `browse_selectable_content`, `get_definition_version`,
`refresh_bundled_content`) returns exactly the same struct, serialized the
same way by `serde` — the example calls the domain functions the commands
call, one layer below the Tauri IPC boundary, so the JSON shape below is
the real wire shape modulo Tauri's own `request` argument wrapper.

## T13E02-R1 sections (F1-F4 first round)

- **3d** — F1: `browse_selectable_content` rejects a stale `expected_revision`
  (`stale_revision`, the exact message E01-C1 already froze).
- F2 is proven by a dedicated 2500-row volume test, not a capture line.
- **F3a/F3b** — `evaluate_restored_ruleset`: a known preset is applied; an
  unknown-but-schema-valid one returns an explicit `ruleset_not_applied`
  warning (never a silent `Ok(())`), naming both the unapplied ruleset and
  the ruleset that remains active.
- **F4** — an authoring edit to an already-installed definition changes
  `compute_revision`'s output, even though it never bumps the owning pack's
  `content_packs.manifest_json`/`version`.

## T13E02-R2 section (F4 residual)

The Revisor's independent recheck found F4's first-round fix hashed only
`data_json`, missing the separately-stored `enabled`/`needs_review` columns
that `content::authoring::soft_delete_definition`/`reactivate_definition`
mutate WITHOUT touching `data_json`, and that `resolver::resolve_definition`
uses as a hard eligibility filter. **F4-R2** below is real: Core's Crunch move
is disabled via the actual `soft_delete_definition` function (not a raw SQL
UPDATE), the revision changes; re-enabling via `reactivate_definition` changes
it again, landing back on the EXACT original hash (returning to an identical
installed state legitimately reproduces its earlier fingerprint — proven, not
just asserted). A companion regression test
(`content_context.rs::compute_revision_and_browse_reflect_a_real_enable_disable_toggle`)
additionally proves browse itself: the pre-disable revision is rejected as stale
after the toggle, and Crunch actually stops/resumes resolving alongside the
revision changes — not just a string moving with no real effect.

## Captured output

```json-ish
     Running `target\debug\examples\t13e02_capture_examples.exe`
=== 1. get_content_context — success (Core-only, real install) ===
{
  "revision": "cd3a053ecd65982268424e6e2b8041bb2e564d507fdd922aeb0dc9fb3419e639",
  "ruleset_id": "ptu-core-only",
  "ruleset_name": "PTU 1.05 Core Only",
  "presets": [
    {
      "id": "ptu-core-only",
      "name": "PTU 1.05 Core Only",
      "pack_ids": [
        "ptu-core-1.05"
      ],
      "description": "Only the PTU 1.05 Core rules/data available in the supplied source set."
    },
    {
      "id": "ptu-core-with-pokedex",
      "name": "PTU Core + Supplied Pokédex",
      "pack_ids": [
        "ptu-core-1.05",
        "ptu-gen8ish-pokedex"
      ],
      "description": "Core plus the supplied Gen8ish Pokédex pack (ptu-gen8ish-pokedex), a non-official fan-compiled species source used only to fill in Pokémon base stats missing from Core itself. Recommended default for onboarding; Core-only remains selectable."
    },
    {
      "id": "ptu-official-supplements",
      "name": "PTU Core + Official Supplements",
      "pack_ids": [
        "ptu-core-1.05",
        "ptu-blessed-and-damned",
        "ptu-do-porygon-dream-of-mareep",
        "ptu-game-of-throhs"
      ],
      "description": "Core plus Blessed and the Damned, Do Porygon Dream of Mareep?, and Game of Throhs; playtests disabled."
    },
    {
      "id": "ptu-official-with-playtests",
      "name": "PTU Official Materials + Selected Playtests",
      "pack_ids": [
        "ptu-core-1.05",
        "ptu-blessed-and-damned",
        "ptu-do-porygon-dream-of-mareep",
        "ptu-game-of-throhs",
        "ptu-may-2015-playtest",
        "ptu-september-2015-playtest",
        "ptu-february-2016-playtest"
      ],
      "description": "Core, official supplements, and all three supplied official playtest packets."
    },
    {
      "id": "all-provided-material",
      "name": "All Supplied Material (Review Profile)",
      "pack_ids": [
        "pokemon-current-catalog-2026-09",
        "ptu-core-1.05",
        "ptu-blessed-and-damned",
        "ptu-do-porygon-dream-of-mareep",
        "ptu-game-of-throhs",
        "ptu-may-2015-playtest",
        "ptu-september-2015-playtest",
        "ptu-february-2016-playtest",
        "ptu-gen8ish-pokedex",
        "ptu-sumo-references",
        "ptu-new-abilities-and-moves",
        "ptu-1.05-editation",
        "campaign-homebrew-chickute",
        "campaign-homebrew-classes-extra",
        "campaign-homebrew-especial-classes",
        "campaign-homebrew-knight",
        "campaign-homebrew-needlene",
        "campaign-homebrew-paldean-pidgey"
      ],
      "description": "Enables all supplied PTU, update, rebalance, and campaign homebrew packs plus browse-only current-species stubs. Intended as a review/sandbox profile, not an assertion that every source should be active in a campaign."
    }
  ],
  "packs": [
    {
      "id": "campaign-homebrew-chickute",
      "version": "1.0.0",
      "status": "missing"
    },
    {
      "id": "campaign-homebrew-classes-extra",
      "version": "1.0.0",
      "status": "missing"
    },
    {
      "id": "campaign-homebrew-especial-classes",
      "version": "1.0.0",
      "status": "missing"
    },
    {
      "id": "campaign-homebrew-knight",
      "version": "1.0.0",
      "status": "missing"
    },
    {
      "id": "campaign-homebrew-needlene",
      "version": "1.0.0",
      "status": "missing"
    },
    {
      "id": "campaign-homebrew-paldean-pidgey",
      "version": "1.0.0",
      "status": "missing"
    },
    {
      "id": "pokemon-current-catalog-2026-09",
      "version": "1.0.0",
      "status": "missing"
    },
    {
      "id": "ptu-1.05-editation",
      "version": "1.0.0",
      "status": "missing"
    },
    {
      "id": "ptu-blessed-and-damned",
      "version": "1.0.0",
      "status": "missing"
    },
    {
      "id": "ptu-core-1.05",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "ptu-do-porygon-dream-of-mareep",
      "version": "1.0.0",
      "status": "missing"
    },
    {
      "id": "ptu-february-2016-playtest",
      "version": "1.0.0",
      "status": "missing"
    },
    {
      "id": "ptu-game-of-throhs",
      "version": "1.0.0",
      "status": "missing"
    },
    {
      "id": "ptu-gen8ish-pokedex",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "ptu-may-2015-playtest",
      "version": "1.0.0",
      "status": "missing"
    },
    {
      "id": "ptu-new-abilities-and-moves",
      "version": "1.0.0",
      "status": "missing"
    },
    {
      "id": "ptu-september-2015-playtest",
      "version": "1.0.0",
      "status": "missing"
    },
    {
      "id": "ptu-sumo-references",
      "version": "1.0.0",
      "status": "missing"
    }
  ],
  "issues": []
}

=== 2a. set_active_ruleset — success ===
ok -> loads ruleset id=ptu-core-with-pokedex, packs=["ptu-core-1.05", "ptu-gen8ish-pokedex"]

=== 2b. set_active_ruleset — stale ===
{
  "code": "stale_revision",
  "message": "Content context changed",
  "field": "expected_revision",
  "retryable": true
}

=== 2c. set_active_ruleset — invalid (unknown preset) ===
{
  "code": "unknown_preset",
  "message": "unknown preset \"not-a-real-preset\"",
  "field": "preset_id",
  "retryable": false
}

=== 3a. browse_selectable_content — success (species "sab", Core+Gen8ish) ===
{
  "revision": "2bec5933e5b09c5ed3f529678d1b1869f594b4683c88a847e5f806a6b4c41b16",
  "items": [
    {
      "kind": "species",
      "logical_id": "sableye",
      "definition_version_id": "species:sableye@gen8",
      "content_pack_id": "ptu-gen8ish-pokedex",
      "name": "Sableye",
      "selectable": true,
      "unavailable_reason": null
    }
  ],
  "has_more": false
}

=== 3b. browse_selectable_content — success, empty result (species "sab", Core-only) ===
{
  "revision": "cd3a053ecd65982268424e6e2b8041bb2e564d507fdd922aeb0dc9fb3419e639",
  "items": [],
  "has_more": false
}

=== 3c. browse_selectable_content — invalid (limit=0) ===
{
  "code": "invalid_input",
  "message": "limit must be 1..100",
  "field": "limit",
  "retryable": false
}

=== 3d. browse_selectable_content — F1 stale (wrong expected_revision) ===
{
  "code": "stale_revision",
  "message": "Content context changed",
  "field": "expected_revision",
  "retryable": true
}

=== 4a. get_definition_version — success/"legacy" exact read ===
{
  "kind": "move",
  "definition_version_id": "moves:crunch@core",
  "logical_id": "crunch",
  "content_pack_id": "ptu-core-1.05",
  "name": "Crunch",
  "needs_review": false,
  "data_json": "{\"ac\":2,\"ac_text\":\"2\",\"bonus_text\":null,\"class\":\"Physical\",\"condition_text\":null,\"content_pack_id\":\"ptu-core-1.05\",\"contest_effect\":\"Exhausting Act\",\"contest_type\":\"Tough\",\"damage_base\":8,\"damage_dice\":\"2d8+10\",\"damage_set\":\"19\",\"definition_version_id\":\"moves:crunch@core\",\"effect_parts\":[{\"kind\":\"effect\",\"text\":\"Crunch lowers the target's Defense 1 Combat Stage on 17+\"}],\"effect_text\":\"Crunch lowers the target's Defense 1 Combat Stage on 17+\",\"frequency\":{\"actions\":[],\"ap_cost\":null,\"ap_mode\":null,\"interrupt\":false,\"priority\":null,\"raw\":\"EOT\",\"reaction\":false,\"scope\":\"eot\",\"uses\":null},\"frequency_text\":\"EOT\",\"id\":\"crunch\",\"limitation_text\":null,\"logical_id\":\"crunch\",\"name\":\"Crunch\",\"needs_review\":false,\"range_text\":\"Melee, 1 Target\",\"raw_text\":\"Move: Crunch\\nType: Dark\\nFrequency: EOT\\nAC: 2\\nDamage Base 8: 2d8+10 / 19\\nClass: Physical\\nRange: Melee, 1 Target\\nEffect: Crunch lowers the target's Defense 1 Combat\\nStage on 17+\\nContest Type: Tough\\nContest Effect: Exhausting Act\",\"source_id\":\"core\",\"source_kind\":\"official_core\",\"source_page\":350,\"source_priority\":100,\"source_title\":\"Pokémon Tabletop United 1.05 Core\",\"special_text\":null,\"target_text\":null,\"trigger_text\":null,\"type\":\"Dark\",\"weapon_suggestions_text\":null}",
  "reason": "pinned"
}

=== 4b. get_definition_version — not_found ===
{
  "code": "not_found",
  "message": "definition \"moves:does-not-exist@nowhere\" not found",
  "field": null,
  "retryable": false
}

=== 5a. refresh_bundled_content — stale (validation) ===
{
  "code": "stale_revision",
  "message": "Content context changed",
  "field": "expected_revision",
  "retryable": true
}

=== 5b. refresh_bundled_content — success (real directory, idempotent) ===
packs=18, issues=0
{
  "revision": "2fee8ef5f0b68010f24e64bbd992ba7e2f3fb4136823c949a88c53bb518a016f",
  "ruleset_id": "ptu-core-only",
  "ruleset_name": "PTU 1.05 Core Only",
  "presets": [
    {
      "id": "ptu-core-only",
      "name": "PTU 1.05 Core Only",
      "pack_ids": [
        "ptu-core-1.05"
      ],
      "description": "Only the PTU 1.05 Core rules/data available in the supplied source set."
    },
    {
      "id": "ptu-core-with-pokedex",
      "name": "PTU Core + Supplied Pokédex",
      "pack_ids": [
        "ptu-core-1.05",
        "ptu-gen8ish-pokedex"
      ],
      "description": "Core plus the supplied Gen8ish Pokédex pack (ptu-gen8ish-pokedex), a non-official fan-compiled species source used only to fill in Pokémon base stats missing from Core itself. Recommended default for onboarding; Core-only remains selectable."
    },
    {
      "id": "ptu-official-supplements",
      "name": "PTU Core + Official Supplements",
      "pack_ids": [
        "ptu-core-1.05",
        "ptu-blessed-and-damned",
        "ptu-do-porygon-dream-of-mareep",
        "ptu-game-of-throhs"
      ],
      "description": "Core plus Blessed and the Damned, Do Porygon Dream of Mareep?, and Game of Throhs; playtests disabled."
    },
    {
      "id": "ptu-official-with-playtests",
      "name": "PTU Official Materials + Selected Playtests",
      "pack_ids": [
        "ptu-core-1.05",
        "ptu-blessed-and-damned",
        "ptu-do-porygon-dream-of-mareep",
        "ptu-game-of-throhs",
        "ptu-may-2015-playtest",
        "ptu-september-2015-playtest",
        "ptu-february-2016-playtest"
      ],
      "description": "Core, official supplements, and all three supplied official playtest packets."
    },
    {
      "id": "all-provided-material",
      "name": "All Supplied Material (Review Profile)",
      "pack_ids": [
        "pokemon-current-catalog-2026-09",
        "ptu-core-1.05",
        "ptu-blessed-and-damned",
        "ptu-do-porygon-dream-of-mareep",
        "ptu-game-of-throhs",
        "ptu-may-2015-playtest",
        "ptu-september-2015-playtest",
        "ptu-february-2016-playtest",
        "ptu-gen8ish-pokedex",
        "ptu-sumo-references",
        "ptu-new-abilities-and-moves",
        "ptu-1.05-editation",
        "campaign-homebrew-chickute",
        "campaign-homebrew-classes-extra",
        "campaign-homebrew-especial-classes",
        "campaign-homebrew-knight",
        "campaign-homebrew-needlene",
        "campaign-homebrew-paldean-pidgey"
      ],
      "description": "Enables all supplied PTU, update, rebalance, and campaign homebrew packs plus browse-only current-species stubs. Intended as a review/sandbox profile, not an assertion that every source should be active in a campaign."
    }
  ],
  "packs": [
    {
      "id": "campaign-homebrew-chickute",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "campaign-homebrew-classes-extra",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "campaign-homebrew-especial-classes",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "campaign-homebrew-knight",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "campaign-homebrew-needlene",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "campaign-homebrew-paldean-pidgey",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "pokemon-current-catalog-2026-09",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "ptu-1.05-editation",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "ptu-blessed-and-damned",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "ptu-core-1.05",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "ptu-do-porygon-dream-of-mareep",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "ptu-february-2016-playtest",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "ptu-game-of-throhs",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "ptu-gen8ish-pokedex",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "ptu-may-2015-playtest",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "ptu-new-abilities-and-moves",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "ptu-september-2015-playtest",
      "version": "1.0.0",
      "status": "ready"
    },
    {
      "id": "ptu-sumo-references",
      "version": "1.0.0",
      "status": "ready"
    }
  ],
  "issues": []
}

=== F3a. evaluate_restored_ruleset — known preset (applied) ===
Ok("ptu-core-with-pokedex")

=== F3b. evaluate_restored_ruleset — unknown preset (explicit warning, not silent) ===
{
  "code": "ruleset_not_applied",
  "message": "The backup's embedded ruleset \"some-custom-campaign-ruleset\" is not one of this app's known presets and was not applied; the previously active ruleset (\"PTU 1.05 Core Only\") remains active.",
  "field": "ruleset",
  "retryable": false
}

=== F4. compute_revision reflects an authoring edit (no pack version bump) ===
before revision: 2fee8ef5f0b68010f24e64bbd992ba7e2f3fb4136823c949a88c53bb518a016f
after  revision: 5915314003659c3eb8a14eb30c8c197fcd1fdde807c9ec75c5e9f2f8741f490f
changed: true

=== F4-R2. compute_revision reflects a real enable/disable toggle (enabled column, not data_json) ===
before disable: 5915314003659c3eb8a14eb30c8c197fcd1fdde807c9ec75c5e9f2f8741f490f
after  disable: fd7c2b84dda2e78ff2cbd570546f7195657742c0219b39e2867929e32c4caadf (changed: true)
after  re-enable: 5915314003659c3eb8a14eb30c8c197fcd1fdde807c9ec75c5e9f2f8741f490f (changed vs disabled: true, matches original: true)
```
