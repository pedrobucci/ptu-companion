# PTU Companion v1.0 — Advanced Pokémon Training

## Added

- Advanced Training flow from the individual Pokémon sheet.
- Tutor Point wallet showing earned, spent and remaining points.
- Ruleset-resolved Poké Edge catalog.
- Level and Capability prerequisites evaluated automatically where the semantic data is reliable.
- Narrative/ambiguous Poké Edge prerequisites require explicit table confirmation rather than being guessed.
- Poké Edge purchase ledger with rank, cost, source, selected target/note, GM Override state and timestamp.
- TM/HM Move teaching from the current Species compatibility list.
- Move Tutor teaching from the current Species Tutor List.
- Egg Tutor teaching from the current Species Egg Move List.
- TM/Tutor Move Pool tracking (default 3).
- Natural Tutor Move handling when the source list marks the Move with `(N)`.
- Moves that also appear on the Species Level-Up list do not consume the TM/Tutor Move Pool.
- Normal TM teaching costs 1 Tutor Point.
- Replacing one TM-learned Move with another TM Move can preserve Tutor Point expenditure when the TM count does not increase.
- Standard Move Tutor / Egg Tutor transaction cost is represented as 2 Tutor Points; Natural Tutor transactions use 1 Tutor Point.
- September 2015 Playtest tutoring restrictions are applied only when that Content Pack is active in the Ruleset.
- Move Limit replacement flow when the Pokémon already knows its maximum number of Moves.
- Permanent training history persisted in `details_json`.

## Intentional limitations

- The prototype records that the table confirmed possession/use of a TM/HM or access to the required Trainer tutoring Feature; the real Trainer Feature/inventory dependency is not yet automatically enforced.
- Most Poké Edge effects are stored as permanent rule records but are not yet executed by the Modifier Engine. This avoids silently inventing semantics for text-heavy effects.
- Losing prerequisites does not yet automatically refund a Poké Edge; that becomes part of the permanent Modifier/Validation Engine pass.
