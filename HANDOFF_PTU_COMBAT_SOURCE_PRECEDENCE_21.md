# Handoff — PTU Combat source precedence 21

Branch: `content/ptu-parametrized-forms-catalog`; Draft PR #11 remains open and unmerged.

This pass adds `PTU_COMBAT_SOURCE_PRECEDENCE.json` and a deterministic resolver shared by the Windows static preview and Android runtime. The supplied source order is Core → 1.05 Editation → May 2015 Playtest → September 2015 Playtest → February 2016 Playtest. The winner is selected by rank, then later record order; source-signature guards run only after that selection.

Quick Curl now resolves to February 2016 rather than assuming Core before checking its guard: `Scene – Free Action`, Defense Curl as a Standard Action Interrupt, plus +10 Damage Reduction for one full round.

Electrodash resolves to February 2016: `Scene x2 – Swift Action` makes Sprint a Free Action through the shared ledger and records its no-opportunity Sprint state. The optional Stuck-clearing Shift remains manual because Stuck is not yet a modeled condition.

Vicious, Hone Claws, the shared ledger, physical dice, abstract targets, resource-only Undo, and Windows/Android parity are preserved. No generic prose parser, opponent state, `.ptucp` mutation, merge, or release was added.

Validation: dedicated source-precedence verifier passed; `git diff --check` is clean. The full Windows verify is currently blocked by the existing `verify_beta_v210.mjs` cleanup failing with Windows `EPERM` in its temporary directory.
