# PTU Companion v0.9 — Evolution source policy + target-Level progression

## Added

- Pokémon progression can now be driven either by **EXP to add** or by a **Target Level**.
- Target-Level mode resolves the exact cumulative EXP threshold from the PTU experience table; it never invents an EXP curve.
- Evolution candidates now expose the PTU material that supplied their minimum Level and condition.
- New `/api/pokemon/evolution-guidance` endpoint documents the evolution source policy and provides custom-Species authoring suggestions derived from the supplied PTU data.
- Windows Content Editor mock now shows evolution templates with observed-family counts.

## Evolution source policy

Progression and evolution minimum Levels use `ptu_evolution_edges` only. That table is built from the enabled PTU materials and homebrew PTU conversions in the project. The separate canonical/current Pokémon evolution relationship catalog may help browsing and data linkage, but **must never provide the Level requirement used by the PTU progression engine**.

Examples from the supplied material include:

- Pichu → Pikachu at minimum Level 10, then Pikachu → Raichu at minimum Level 25 in the supplied PTU Pokédex.
- Caterpie → Metapod at minimum Level 5, then Butterfree at minimum Level 10.
- Charcadet → Armarouge/Ceruledge at minimum Level 25 in the Knight conversion.

## Custom Species suggestions

These are suggestions, not rules. The editor remains free to override them and attach non-Level conditions.

- Two-stage early: 20
- Two-stage standard: 25
- Two-stage late: 30
- Three-stage very early: 5 → 10
- Three-stage standard: 15 → 30
- Three-stage moderate: 20 → 30
- Three-stage late: 20 → 40

The local API also reports how many supplied PTU evolution families match each template, so the editor can present data-backed guidance rather than a hidden hardcode.
