# PTU Companion Functional Prototype — v0.8

## Main goals

This release starts the persistent Pokémon progression workflow and fixes Ceruledge's typing in the prototype definition seed.

## Data correction

- Ceruledge now resolves as **Fire / Ghost**.
- The local seed's defensive typing profile was recomputed from the corrected dual typing.

## Pokémon progression

Rules-backed Pokémon can now open a dedicated **Progress Pokémon** workflow from their creature sheet.

The progression screen supports:

- adding EXP without manually calculating levels;
- reading the 1–100 PTU Pokémon EXP table from the definition SQLite database;
- resolving one or multiple gained levels from total EXP;
- awarding the correct number of new Stat Points;
- awarding Tutor Points at the appropriate milestone levels;
- detecting Ability unlocks at Levels 20 and 40;
- offering newly unlocked Level-Up Moves;
- preserving already-known Moves by default;
- allowing old Moves to be forgotten to make room for newly learned Moves;
- keeping the current resolved Move Limit rather than assuming six slots;
- listing valid outgoing evolutions from the resolved evolution graph;
- applying optional Evolution rather than forcing it;
- re-Statting an evolved Pokémon from the new form's Base Stats using Level + 10 total Stat Points;
- preserving the campaign rule that HP is exempt from Base Relations;
- mapping Ability slots to the corresponding slot on the evolved form;
- offering Evolution Moves and evolution catch-up Moves;
- preserving campaign state and progression history in SQLite.

## Evolution behavior

Evolution remains optional. Minimum Level requirements are enforced in the progression wizard unless GM Override is active.

If an evolution condition contains additional text beyond a simple minimum Level requirement, the user must explicitly confirm that the condition has been met. GM Override can bypass this confirmation.

When Evolution occurs, the prototype:

1. loads the evolved Species definition from the active Ruleset;
2. reapplies the Pokémon's Nature;
3. requires a full Level + 10 Stat reallocation;
4. validates Base Relations with the campaign-specific HP exemption;
5. remaps Ability slots to the corresponding slots in the new form;
6. preserves already-known Moves;
7. offers the new form's Evolution/catch-up Moves;
8. updates Species, Types, Stats, Max HP, Tutor Points, Abilities and Moves;
9. writes a progression event to the Pokémon and Trainer history.

Current HP is **not healed** by applying progression; it is only clamped downward if the new Max HP would be lower.

## Persistence

No new database table is required. New progression fields are stored in each Pokémon's existing `details_json` structure, including:

- `experience`
- `progressionHistory`
- updated Species definition IDs/version IDs
- updated stat allocations
- updated Ability list
- updated Move records
- updated Tutor Point totals

## New API

- `GET /api/pokemon/experience?level=N`
- `POST /api/pokemon/progression-preview`

## Verification

Run:

```text
VERIFY_V08.bat
```

The verification suite checks Ceruledge typing, EXP table coverage, Level 20 Ability unlocking, Level 25 Tutor Point gain, Charcadet → Ceruledge Evolution, Evolution re-Statting, Ability slot mapping, Evolution Moves and SQLite progression-history persistence.
