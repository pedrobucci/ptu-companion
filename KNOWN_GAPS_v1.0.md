# PTU Companion — Known Gaps v1.0

These are **explicitly preserved gaps**, not silent assumptions.

1. **Pokédex flavor entries** — schema supported; corpus not bundled because it is absent from supplied PDFs.
2. **National Dex mapping for older source records** — many are null; run the included build-time importer against a factual species CSV rather than deriving numbers from PDF page order.
3. **Later Move references without supplied PTU definitions** — e.g. Tera Blast and some later-generation moves may appear on homebrew species and remain disabled/unresolved until authored in the Windows editor or an additional content pack.
4. **Capability definition gaps** — recurring names such as Breathless and certain forme/fusion capabilities are referenced by species but not safely defined in supplied material.
5. **Semantic automation** — narrative/context-dependent rules remain manual/hybrid. The UI must always display original Effect text.
6. **Source-specific oddities are preserved** — e.g. `Knight.pdf` mechanically lists Ceruledge and Kingambit as Fire Type; the app must not silently replace campaign-source mechanics with videogame canon.

Remaining reference counts at handoff: moves 56, abilities 2, capabilities 89.
