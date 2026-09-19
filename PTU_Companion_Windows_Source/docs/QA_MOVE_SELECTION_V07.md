# QA — Move Selection Synchronization v0.7

## Regression reproduced

An evolved Species could begin creation at a low Level with automatic selections represented by pre-evolution source keys. After changing Level, a duplicate Move could become available from the current Species and the visible row would use a different key. The internal selection and visual checkbox state then diverged.

## Required invariants

1. The visible checkbox state and `N / Move Limit selected` counter must derive from the same canonical `selectedMoves` array.
2. A Move identity may have multiple origins (`current_species`, `pre_evolution`, `gm_override`) without becoming multiple known Moves.
3. A change in the preferred visible origin must never invalidate an already selected Move solely because its source-specific key changed.
4. Recommended Auto Moves use only current-Species numeric Level-Up Moves. Pre-evolution history and GM Overrides require explicit selection.
5. Legacy keys from v0.6 are normalized before validation.

## Ceruledge regression case

At Level 28, `Fire Spin`, `Will-O-Wisp`, `Night Shade`, `Flame Charge`, `Incinerate`, and `Lava Plume` are available from Ceruledge itself and also occur in Charcadet history. The engine must expose one visible entry per Move with multiple source records, not invalidate old `pre:charcadet:*` selections.

Expected result: no `Move pre:charcadet:... is not available` validation errors.
