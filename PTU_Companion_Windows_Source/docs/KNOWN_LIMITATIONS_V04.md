# Known limitations — v0.4

- Species-linked Pokémon creation does not yet calculate final PTU stats from Nature, Level, Base Relations and allocated Stat Points.
- Maximum HP is intentionally entered manually during v0.4 creation instead of using a guessed formula.
- Nature is persisted but not mechanically applied yet.
- Ability choice is offered from parsed Species slots but level/legal-slot validation is not implemented yet.
- Level-Up Moves are previewed from the real Species definition but are not automatically learned or limited.
- Newly created Pokémon use a generic local placeholder image until species artwork/custom roster image support is connected.
- The Windows content editors remain mock editors; v0.4 reads Content Packs but does not write them.
- The static functional runtime is authoritative for this milestone; React scaffold parity is still incremental.
