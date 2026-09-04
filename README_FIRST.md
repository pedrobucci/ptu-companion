# PTU Companion — Final Agent Handoff v1.0

**Data preparation: 7/7 stages complete.**

Start with:
1. `TECHNICAL_SPECIFICATION_v1.0.md`
2. `IMPLEMENTATION_PLAN.md`
3. `seed/DATA_FORMAT_v1.0.md`
4. `test_vectors/`
5. `DATA_QUALITY_REPORT_v1.0.md`

## What is already prepared
- versioned Moves, Abilities, Capabilities, Features, Edges, Poké Edges, Items and Species;
- 18 importable `.ptucp` content packs;
- four example Campaign Rulesets;
- PTU Damage Base/type/progression datasets;
- semantic prerequisite/effect structures where safely parsed;
- Species type-defense profiles and evolution graphs;
- final SQLite reference/search seed;
- fixtures and deterministic test vectors;
- source provenance, repair log, unresolved-reference queues and quarantine.

## What the coding agent should NOT spend time doing first
Do not retype the Core, invent missing rules, or flatten all content into one winner-only table. Implement the importer/resolver/domain services first. Targeted data gaps are already enumerated.

## Key final counts
- 754 canonical Moves / 774 source versions
- 477 canonical Abilities / 625 source versions
- 93 Capabilities
- 999 Feature records
- 351 Items
- 1101 Species/form/reference records (961 mechanically complete)
- 18 Content Packs
- SQLite integrity: ok

This package contains no Trainer save from a real player; fixtures are synthetic.
