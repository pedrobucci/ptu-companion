# PTU Companion Android v2.2.0-beta.8

## Pokémon HP and identity

- Manual HP increases now fill normal HP first; overflow above Maximum HP becomes **Temporary HP**.
- Manual HP decreases consume Temporary HP before normal HP.
- Temporary HP is displayed on the Creature Sheet and recent-creature summary.
- Moving a Pokémon into/out of Storage clears Temporary HP as part of the existing full-recovery Storage flow.
- Added **Edit Name & Loyalty** in the Pokémon Active State card. Name/nickname and Loyalty (0–6) can be changed without altering Species.
- Trainer HP controls use the same Temporary HP overflow/absorption behavior.
- Existing local saves migrate safely because absent Temporary HP values default to 0.

## Content packs

- Retains all Android beta.7 Content Pack Manager behavior.
