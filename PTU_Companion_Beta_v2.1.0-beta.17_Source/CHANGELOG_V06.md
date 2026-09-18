# PTU Companion Functional Prototype — v0.6

## UX continuity

- Re-renders on the same screen now preserve `.screen-content` scroll position.
- Input focus is restored when the active control has a stable DOM id.
- Navigating to a different screen still intentionally starts at the top.
- This prevents stat allocation, HP changes, move selection, and other mutations from repeatedly jumping the user back to the beginning of a long form.

## Campaign rule: HP and Base Relations

The application now treats **HP as exempt from Base Relations validation**. HP can receive any portion of the available Stat Point budget without forcing another stat to remain above or below it.

The other five Combat Stats continue to obey Base Relations.

This is an explicit PTU Companion campaign/application rule requested for this project; it is not presented as the unmodified PTU Core default.

## Pre-evolution Move history

When creating an evolved Pokémon, the server resolves its PTU evolution ancestry and exposes Level-Up/Evolution Moves from prior stages as selectable natural-history Moves.

Examples:

- Ceruledge can select Moves from Charcadet.
- A multi-stage evolution can expose Moves from more than one prior stage when the evolution graph resolves safely.

Pre-evolution Moves are never automatically selected. The user decides whether the individual Pokémon retained them.

## GM Move Override

When GM Override is enabled, the Pokémon creation screen gains a Move search against the active Ruleset. Any resolved Move may be explicitly added to the Pokémon, regardless of normal Species compatibility.

The resulting Move records preserve provenance:

- current species;
- pre-evolution species;
- GM override.

## Validation

`VERIFY_V06.bat` checks:

- scroll-preservation implementation is present;
- HP does not participate in Base Relations;
- non-HP Base Relations still validate;
- Ceruledge resolves Charcadet as a pre-evolution;
- a Charcadet Move is selectable by Ceruledge;
- arbitrary GM Move injection requires GM Override;
- move source metadata survives SQLite persistence.
