# PTU Companion — Final Data QA Report v1.0

## Status
Stage **7/7 complete**. This handoff is an implementation seed, not a claim that every narrative/conditional PTU rule is machine-executable. Source text and provenance remain authoritative for manual/hybrid rules.

## Final counts

| Dataset | Count |
|---|---:|
| Moves (canonical winners) | 754 |
| Move source versions | 774 |
| Abilities (canonical winners) | 477 |
| Ability source versions | 625 |
| Capabilities | 93 |
| Capability source versions | 93 |
| Features records | 999 |
| Edges | 61 |
| Poké Edges | 20 |
| Items | 351 |
| Species/form/reference records | 1101 |
| Mechanically complete species records | 961 |
| Enabled for character creation | 961 |
| PTU evolution edges | 493 |
| Content packs | 18 |
| Definition versions | 4024 |
| Logical definitions with >1 version | 310 |
| Final targeted/data repairs logged | 88 |
| Final layout records quarantined | 14 |
| Remaining unresolved move refs | 56 |
| Remaining unresolved ability refs | 2 |
| Remaining unresolved capability refs | 89 |

SQLite `PRAGMA integrity_check`: **ok**.

## High-value final corrections
- Restored Charcadet/Armarouge/Ceruledge/Kingambit Ability slots directly from `Knight.pdf`.
- Added source-defined Knight Moves: Expanding Force, Armor Cannon, Bitter Blade, Kowtow Cleave, Lash Out.
- Added source-defined Knight Abilities: White Knight, Death Knight, Supreme Overlord.
- Ensured Pack Lord is transported as a versioned Capability in the Knight content pack.
- Added Needlene's source-defined Overlocker Ability and restored its Ability slots.
- Corrected obvious Needlene move-name typos while retaining repair provenance.
- Restored complete Ability slots for the supplied Paldean Pidgey line and normalized Thunder Wave/Electro Ball spelling/layout.
- Resolved the Wurmple split evolution graph as four explicit source-supported edges.
- Applied conservative page-layout cleanup only when the remaining prefix/segments exactly resolve to known supplied definitions; discarded-looking text is quarantined, not destroyed.

## Intentional gaps
- National Dex numbers for many pre-891 PTU-source records remain nullable because the supplied Gen8ish PDF is not ordered by National Dex. A build-time CSV importer is supplied instead of guessing.
- Console-game Pokédex flavor text is not present in the supplied PDFs and is not redistributed. The schema/import path is ready.
- References to later moves such as Tera Blast/Poltergeist remain unresolved where no mechanical definition exists in the supplied rules material.
- Some species Capabilities are referenced by name but have no definition in the supplied sources; those remain review items.
- Conditional/narrative rules remain `manual_text` or `hybrid`; this is deliberate.

See `KNOWN_GAPS_v1.0.md` and `seed/json/species_reference_gaps.json` for the machine-readable queue.
