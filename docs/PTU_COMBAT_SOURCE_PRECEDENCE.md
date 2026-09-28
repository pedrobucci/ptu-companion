# PTU Combat source precedence

The Combat resolver uses the supplied PDFs only. The effective order is:

| Rank | Source | Role |
|---:|---|---|
| 100 | PTU 1.05 Core | baseline |
| 110 | PTU 1.05 Editation | later 1.05 correction |
| 120 | PTU May 2015 Playtest Packet | later playtest |
| 130 | PTU September 2015 Playtest Packet | later playtest |
| 140 | February 2016 Playtest Packet | latest supplied playtest |

For one Ability or Move, the resolver selects the highest-ranked supplied definition. Equal ranks use the later record deterministically. A source-signature guard is then applied to that winning definition; it never rejects a later definition merely because it differs from Core.

`docs/data/PTU_COMBAT_SOURCE_PRECEDENCE.json` is the canonical supplied-source catalog. The patcher serializes its ordered sources and the two audited February 2016 replacements into both Combat clients; it does not parse rules prose. This keeps the active definition and its guard together while preserving Windows/Android parity.

The current Combat consequences are:

- Quick Curl resolves to the February 2016 override: `Scene – Free Action`, then Defense Curl as a Standard Action Interrupt with +10 Damage Reduction for one full round. The ordinary Defense Curl condition remains shared; the temporary +10 DR is recorded for the current round.
- Electrodash resolves to February 2016: `Scene x2 – Swift Action` makes Sprint a Free Action. The shared ledger spends the Swift/Scene resource and records the no-opportunity Sprint state. A controlled Stuck marker can be removed with Electrodash as a Shift Action, without spending its Scene resource.
- Prime Fury resolves to February 2016: `Scene – Swift Action` marks the controlled Pokémon Enraged and grants +1 Attack and +1 Special Attack Combat Stage through the same shared ledger.
- Vicious and Hone Claws continue to use the same resolver and shared Combat ledger.

No parser, digital dice, opponent entity, `.ptucp` mutation, merge, or release is introduced by this layer.
