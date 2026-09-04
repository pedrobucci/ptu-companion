# PTU Companion Seed/Data Format v1.0

- Runtime canonical persistence: SQLite.
- Content authoring/interchange: JSON/NDJSON.
- Human review convenience: CSV.
- Content pack extension: `.ptucp` = ZIP container with `manifest.json` + `content/*.ndjson` + optional `content/datasets/*.json`.
- Trainer export extension planned by Technical Specification: `.ptutrainer`.
- Full backup extension: `.ptubackup`.

## Content resolution
1. Explicit version pin, if valid.
2. Enabled packs only.
3. Highest effective pack priority.
4. Ruleset order tie-break.
5. GM override applies to resolved character/campaign state without mutating source version.

## Rule quality
- `machine_ready`: structured effect/prerequisite can be applied automatically.
- `hybrid`: apply only compiled clauses and display/require the remaining textual adjudication.
- `manual_text`: display source rule; never infer behavior at runtime.

## Species quality
- `complete` + enabled: legal for creation under pack/ruleset validation.
- `partial|incomplete`: browse/edit only by default.
- unresolved references remain explicit and searchable.

## Images
User images are external files referenced by UUID/path; import should downscale and convert to WebP. Do not store normal images as SQLite BLOBs.
