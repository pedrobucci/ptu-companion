# PTU Form Asset Audit

Deterministic audit of artwork available to the parametrized Forms catalog. It does not download artwork and does not invent remote URLs or filenames.

## Summary

- Scanned local roots: **1**
- Local image files: **9**
- Candidate normal matches: **0**
- Candidate form matches: **0**
- Candidate shiny matches: **0**
- Explicit inventory artwork/image references: **0**

## Local roots

- `PTU_Companion_Android_Tauri/www/creatures`

## Candidate asset matches

- No local image filename safely matches an audited PTU form/species token.

## Policy

- Normal, form-specific, and shiny artwork are separate audit states.
- Missing artwork remains unset so the Stage B resolver can use its existing fallback.
- No remote URL is synthesized from Species number, name, form name, or third-party conventions.
