# PTU Forms — Pokémon HP / Max HP Mutation Audit

Deterministic audit of campaign-client Pokémon HP and Max HP initialization/mutation surfaces relevant to the Stage B Form lifecycle.

- Surfaces classified: **14**
- Lifecycle-sensitive/event surfaces: **7**
- Construction-only: **2**
- Intentional Form reset: **1**
- Existing application reset paths: **2**
- Unlinked/demo fallbacks: **2**
- Uncovered linked surfaces: **0**

| Surface | Assignment | Classification | Lifecycle | Reason |
| --- | --- | --- | --- | --- |
| defaultState sample Pokémon | object literals with hp/maxHp | `construction_only` | `not_applicable` | Initial sample objects are created before any individual Form lifecycle state exists. |
| rules-backed Pokémon creation builder | new Pokémon object hp/maxHp | `construction_only` | `not_applicable` | A new individual is constructed from resolved PTU stats before it enters campaign state. |
| loadCreatureReferenceData | resolved maxHp reconciliation + hp clamp | `lifecycle_sensitive` | `covered` | A resolved Max HP change can alter HP-ratio Form conditions; linked Pokémon are revalidated. |
| applyPokemonProgression — no evolution | level-up maxHp update + hp clamp | `lifecycle_sensitive` | `covered_in_this_pass` | Normal level progression can change Max HP without changing Species, so HP-ratio Forms must be revalidated after progression details are updated. |
| applyPokemonProgression — evolution | new Species maxHp + hp clamp | `intentional_form_reset` | `covered_by_reset` | Evolution changes Species and intentionally resets formState to canonical base instead of carrying an old Species Form across evolution. |
| applyPokemonRestat | redistributed maxHp + hp clamp | `lifecycle_sensitive` | `covered` | Stat redistribution can change Max HP and therefore HP-ratio Form conditions. |
| acquirePokeEdge | resolved maxHp from edge effects + hp clamp | `lifecycle_sensitive` | `covered` | A Poké Edge can alter resolved Max HP; linked Form state is revalidated when it does. |
| refundPokeEdge | resolved maxHp after edge refund + hp clamp | `lifecycle_sensitive` | `covered` | Removing a Poké Edge can alter resolved Max HP; linked Form state is revalidated when it does. |
| changeHp — linked Species | HP/THP adjustment | `lifecycle_event` | `covered` | The normal HP control dispatches hp-adjust through the campaign Form event endpoint. |
| changeHp — unlinked/demo fallback | direct HP/THP adjustment | `unlinked_fallback` | `not_applicable` | Demo/unlinked Pokémon have no Species Form catalog to revalidate. |
| storePokemon | restore hp to maxHp and clear THP | `application_reset` | `covered` | Existing Storage semantics already reset HP/THP; Form THP provenance is cleared and Form state is revalidated. |
| withdrawPokemon | restore hp to maxHp and clear THP | `application_reset` | `covered` | Existing withdrawal semantics reset HP/THP; linked Form state is revalidated after cleanup. |
| useItem — linked Species | Potion/Super Potion/Oran Berry healing | `lifecycle_event` | `covered` | Automated healing dispatches hp-adjust so HP-sensitive Forms re-evaluate. |
| useItem — unlinked/demo fallback | direct healing clamp | `unlinked_fallback` | `not_applicable` | Demo/unlinked Pokémon have no Species Form catalog to revalidate. |

## Guardrails

- The normal no-evolution level-up path is now explicitly lifecycle-revalidated after its resolved build fields are updated.
- Evolution remains an intentional Species boundary and resets the individual Form state to canonical base.
- Construction-only and unlinked/demo paths do not claim Form lifecycle semantics.
- Persisted Form IDs are not renamed or migrated; display names are resolved from catalog Forms only when available.
- The ten deferred/source-insufficient families remain blocked.
