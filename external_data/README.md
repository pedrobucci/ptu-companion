# External factual/display data not bundled

The supplied PTU PDFs do not contain a complete National Dex mapping for every older species and do not contain the console-game Pokédex flavor-text corpus. The final handoff therefore does **not** fabricate these fields.

The runtime/model already supports them. During development, a maintainer may import a factual National Dex CSV from a permissively usable source (for example PokeAPI's `pokemon_species.csv`) using `scripts/import_national_dex_csv.py`. This is a build-time enrichment step only; the released app remains offline.

Pokédex flavor entries use the schema in `schemas/pokedex-flavor-entry-v1.schema.json`. Only text the project is entitled to redistribute should be packaged.
