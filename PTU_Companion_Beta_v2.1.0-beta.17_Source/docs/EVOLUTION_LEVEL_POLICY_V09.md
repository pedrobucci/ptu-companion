# Evolution Level Policy — v0.9

## Rule of authority

For gameplay progression, the application resolves evolution minimum Levels from the PTU material currently represented in `ptu_evolution_edges`.

The table `canonical_evolution_edges_current` is not a gameplay-Level source. It may be used to understand that an evolution relationship exists for modern Pokémon, but it does not define when that evolution occurs in PTU.

This separation matters because PTU conversions intentionally use their own evolution thresholds. The supplied Gen 8ish PTU Pokédex explicitly notes that evolution methods/levels were altered to make more Pokémon usable earlier in campaigns.

## Runtime behavior

`DefinitionRepository.getOutgoingEvolutions()`:

1. queries `ptu_evolution_edges`;
2. prefers an edge from the current Species source when possible;
3. resolves the destination Species through the active Ruleset;
4. returns `toMinLevel`, `conditionText`, source id/title/kind;
5. marks the source as `evolutionRulesSource = "ptu_material"`.

The progression engine does not query the canonical current-evolution table.

## Custom Species authoring

The editor exposes patterns observed in supplied PTU families as suggestions. They are not universal rules and are never applied silently.

A future production Species Editor should present:

- suggested profile;
- editable minimum Level per transition;
- optional item/TM/gender/friendship/narrative condition;
- source/content-pack provenance;
- explicit GM/custom override.
