# Changelog — PTU Companion Functional Prototype v1.1

## Pokémon sheet tabs are functional

The Creature Sheet tabs are no longer decorative. Rules-backed Pokémon can now open:

- **Sheet** — active HP, injuries, Combat Stages, permanent stats, known Moves and battle-cycle controls.
- **Moves** — resolved known Move definitions plus explicit acquisition provenance and the non-natural TM/Tutor pool counter.
- **Abilities** — current Ability slots with Ruleset-resolved effect text.
- **Species** — permanent stat build, Capabilities, Species Skills and owned Poké Edges.
- **Type** — PTU defensive Type profile (weaknesses, resistances and immunities).
- **Pokédex** — mechanical species metadata and PTU source information. Game flavor-text entries remain intentionally unbundled until a separate data pack is supplied.

## Attack Conflict is now executable

`Attack Conflict` requires an explicit permanent binding to **Attack** or **Special Attack**. The generic free-text choice has been removed for this Edge.

After acquisition the selected Stat is included in the Pokémon's Base Relations exemption set together with the app/campaign HP exemption. This affects:

- future level-up validation;
- evolution re-stat validation;
- manual permanent Stat redistribution.

The binding is persisted on the Poké Edge record as `targetStat`.

## Underdog Poké Edge gating

The Underdog-specific Poké Edges now hard-check the Species Capability list:

- `Underdog's Strength` — requires the **Underdog** Capability and Level 15;
- `Realized Potential` — requires the **Underdog** Capability and Level 30;
- `Underdog's Lessons` — requires the **Underdog** Capability and an owned `Underdog's Strength` Edge.

Pokémon without the Capability see these Edges locked rather than as a manual prerequisite.

## Tutor provenance and pool visibility

Known Moves learned through training now display their provenance in the Creature Sheet and Moves tab, including:

- TM / HM;
- Move Tutor;
- Natural Tutor;
- Egg Tutor;
- pre-evolution;
- evolution;
- GM Override;
- ordinary Species/Level-Up acquisition.

The Moves tab also displays the current **non-natural TM/Tutor pool usage / 3** separately from the normal Move Limit.

## Permanent Stat redistribution

Rules-backed Pokémon now expose **Redistribute Stats** from the Species tab. This is intended as an app correction/respec convenience for filling mistakes and campaign-approved rebuilding, not as a claim that PTU grants free Pokémon retraining.

The tool:

- preserves Level, Nature, Species, Moves, Abilities, Poké Edges and history;
- preserves the existing permanent Stat Point budget;
- applies HP + Attack Conflict relation exemptions;
- validates the remaining Base Relations;
- recalculates Max HP;
- never heals current HP when Max HP rises;
- clamps current HP only if the new Max HP is lower;
- records the correction in Pokémon and Trainer history.

## API additions

- `POST /api/pokemon/reference-data`
- `POST /api/pokemon/restat-preview`

## QA

Run `VERIFY_V11.bat`.
