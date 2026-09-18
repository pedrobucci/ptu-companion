# PTU Companion Beta v2.1.0-beta.8

## Pokémon HP and identity

- Manual HP increases now fill normal HP first; any overflow above Maximum HP becomes **Temporary HP**.
- Manual HP decreases consume Temporary HP before reducing normal HP.
- Temporary HP is shown in the Pokémon header, Active State card and recent-creature summary.
- Storage/full Storage recovery clears Temporary HP.
- Added **Edit Name & Loyalty** to the Pokémon Active State card. The editor changes only the instance nickname/name and Loyalty (0–6); Species identity is preserved.
- Trainer manual HP controls now use the same Temporary HP overflow/absorption behavior for consistency.
- Existing saves remain compatible: missing Temporary HP values migrate as 0.

## Content packs

- Retains all beta.7 Pack Manager behavior (enable/disable/uninstall and update-state preservation).
