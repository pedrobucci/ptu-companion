# PTU Companion Functional Prototype — v0.7

## Move-selection synchronization fix

This release fixes the creation bug reported with evolved Pokémon such as Ceruledge.

### Root cause

The v0.6 Move pool used source-specific keys (for example `pre:charcadet:fire-spin:4`) while de-duplicating the visible list by Move identity. When the same Move later became available from the current Species, the visible row changed to `fire-spin`, but the selected state could still contain the old pre-evolution key. This caused three symptoms:

- the counter could say `6 / 6 selected` while no visible checkbox was checked;
- pre-evolution Auto Moves could consume the Move Limit invisibly;
- validation could report selected pre-evolution keys as unavailable.

### v0.7 behavior

- selected Moves now use a stable canonical Move identity;
- all available origins are merged into `sources[]`;
- current-Species and pre-evolution availability may coexist on the same visible Move row;
- legacy v0.6 `pre:*` and `gm:*` keys are normalized automatically;
- recommended Auto Moves only use normal numeric Level-Up Moves from the current Species;
- pre-evolution and GM Move choices remain explicit;
- Auto Move selection is now server-authoritative and returned already validated;
- the UI copies `preview.selectedMoves` from the Rules Engine, so the counter and checkboxes use the same state;
- changing Level keeps recommended Auto Moves updated until the user manually edits the Move selection;
- `Use recommended` resets the Move selection to the Rules Engine recommendation.

## Compatibility

Existing campaign saves remain compatible. The Pokémon builder is transient UI state, and legacy Move keys submitted to the Rules Engine are migrated to canonical identities whenever possible.
