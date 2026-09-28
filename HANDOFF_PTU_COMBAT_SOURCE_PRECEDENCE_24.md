# PTU Combat source precedence — handoff 24

The deterministic Combat source order is now data-driven from `docs/data/PTU_COMBAT_SOURCE_PRECEDENCE.json`. The patcher serializes that catalog into the Windows static preview and Android web client.

The only audited replacements are explicitly listed: February 2016 Quick Curl and Electrodash. There is no generic prose parser. Overrides are applied before source ranking, so the resulting February 2016 definition is the winning definition and the existing signature checks inspect that winner.

Electrodash also supports its February 2016 Stuck-removal bonus through the shared action ledger. It is intentionally distinct from the Scene x2 Swift action which enables free Sprint.

Keep these invariants: physical dice only, abstract targets, shared ledger, resource-only undo, Windows/Android parity, no `.ptucp`, no merge/release. Do not stage the unrelated `PTU_Companion_Android_v2.2.0-beta.19_Tauri/` directory.
