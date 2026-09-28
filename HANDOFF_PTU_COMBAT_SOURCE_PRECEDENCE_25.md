# PTU Combat source precedence — handoff 25

Prime Fury now resolves from the February 2016 Playtest Packet (p.8), not its Core definition. It is an explicit `Scene – Swift Action`: the controlled Pokémon becomes Enraged and gains +1 Attack and +1 Special Attack Combat Stage. It spends and refunds only its shared-ledger resource; Undo never removes its already-applied status or stages.

The source catalog remains the only canonical input for audited replacements. It now includes Quick Curl, Electrodash, and Prime Fury. Windows and Android are regenerated from the same patcher and covered by the source-precedence verifier/workflow.

Hydration and Ice Body are resolved to February 2016 but require explicit weather/healing session semantics. Regal Challenge retains the Core definition because no later supplied PDF redefines it; it remains gated on physical AC4 attack handling against an abstract target.

Keep: physical dice only, abstract targets, shared ledger, resource-only Undo, Windows/Android parity, no generic prose parser, no `.ptucp`, and no merge. The existing beta.19 Android directory comes from the history of this branch but is untracked in the current checkout; do not stage it implicitly.
