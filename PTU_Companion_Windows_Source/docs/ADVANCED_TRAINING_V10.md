# Advanced Pokémon Training — v1.0

## Purpose

v1.0 completes the first permanent-training loop for rules-backed Pokémon. The feature is accessed from the individual Creature Sheet through **Advanced Training**.

## Tutor Point ledger

The current Pokémon keeps these permanent values in `details_json`:

```json
{
  "tutorPointsEarned": 5,
  "tutorPointsSpent": 2,
  "tutorPointsRemaining": 3,
  "pokeEdges": [],
  "trainingHistory": []
}
```

Level progression continues to increase `tutorPointsEarned`; spending changes `tutorPointsSpent`. The balance is therefore stable across later level-ups.

## Poké Edges

The active Ruleset resolves the Poké Edge definition version. The local rules service evaluates only prerequisites it can support reliably, currently including:

- no prerequisite;
- minimum Level;
- Species Capability;
- some Ability-keyword checks.

Manual or narrative prerequisites are not guessed. They are surfaced as **MANUAL CHECK** and require explicit confirmation, or may be bypassed through GM Override.

Acquired Poké Edges store provenance and the user's required choice/target where relevant.

## TM/HM and Tutor Move Pool

The default pool limit is 3 Moves originating from TM/HM or Tutor sources. A compatible Move does not consume that pool when it is also present on the Species Level-Up Move List. Natural Tutor Moves marked `(N)` are treated as natural and do not use the pool.

The general active Move Limit remains independent. When the active list is full, teaching a Move requires replacing an existing Move.

## Teaching costs implemented

- TM/HM compatibility transaction: 1 Tutor Point.
- Move Tutor: 2 Tutor Points.
- Egg Tutor: 2 Tutor Points.
- Natural Tutor `(N)`: 1 Tutor Point.

A TM replacing another TM may avoid an additional Tutor Point when the total number of TM Moves does not increase.

## September 2015 Playtest

When `ptu-september-2015-playtest` is enabled in the active Ruleset, Move Tutor and Egg Tutor transactions apply its additional frequency/Damage Base teaching limits. Those restrictions are not applied to TM teaching.

## Boundary with future work

The transaction engine validates costs, pool limits, compatibility, simple prerequisites and provenance. The next Modifier Engine pass will make structured Poké Edge effects alter resolved Stats, Capabilities, Move limits and Base Relation behavior automatically.
