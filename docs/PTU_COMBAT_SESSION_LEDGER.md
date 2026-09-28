# PTU Pokémon Combat Session Ledger

Shared combat-state foundation for Windows and Android. This replaces a Form-only resource approximation with one ledger intended to be shared by ordinary Moves, Abilities and Form lifecycle rules.

## Menu and session model

- New navigation menu: **Combat**.
- A Trainer selects a Roster, places one or more carried Pokémon into the combat session, and chooses the active combatant.
- HP/THP remain the Pokémon sheet values; the Combat menu does not create parallel HP.
- Session state is stored under `state.ui.combat`, persisted by browser/Tauri save/export/import and SQLite `ui_state.data_json`.
- SQLite revision hashing now treats combat state as semantic campaign state while still ignoring pure screen navigation.

## Turn ledger

- Each participant tracks Standard, Shift and Swift Action expenditure for the current round.
- Free Actions remain unlimited in the ledger.
- Full Actions consume both Standard and Shift Actions.
- When the normal Swift or Shift Action is already spent, the ledger may consume the still-unused Standard Action as the PTU conversion allowed by the Core.
- The ledger is per Pokémon and round; it is not Trainer AP.

## Frequency ledger

- `At-Will`: unrestricted.
- `EOT`: blocked on the immediately following turn after use.
- `Scene` / `Scene xN`: source-keyed counts reset at Scene change.
- `Daily` / `Daily xN`: source-keyed counts reset at Day change.
- Unknown frequency text remains informational instead of being guessed.

## Physical-dice combat outcome resolver

- **Combat never generates attack or damage dice.** Accuracy and Damage Rolls are always made with physical dice and entered manually.
- When a Move has an Accuracy Roll, the natural d20 result is entered so Accuracy-triggered effects and Critical ranges can still be evaluated/audited.
- Hit/Miss is confirmed by the player as the authoritative result because the target is intentionally abstract and may have Evasion, defensive Features, Shields, immunities, or GM-side effects unknown to this Companion.
- Critical Hit is likewise confirmed explicitly; the natural d20 is retained in the log rather than replaced by a calculated total.
- For damaging hits, the UI shows the PTU Damage Base dice expression and, when relevant, the doubled Critical expression. The player rolls those dice physically and enters the resulting Damage Roll.
- The Companion may add only values it actually owns for the active Pokémon, such as its attacking Stat, Mixed Power bonus, or Defense Curl bonus. It does not invent target Defense, DR, type effectiveness, HP, or other opponent state.
- `Damage actually taken by target` is an optional outcome value. Move-specific handlers can require it when the user's own Pokémon needs that external result, such as draining Moves that heal from damage actually dealt.
- The opposing Pokémon/NPC is never persisted as a combat entity.

## First complex Move interaction: Defense Curl + Rollout

- Defense Curl sets the combat condition `Curled Up`.
- Curled Up displays Critical Hit immunity and DR 10.
- Curled Up normally applies -4 Accuracy and Slowed. If Rollout or Ice Ball is known, the Slowed part is suppressed; those Moves also ignore the Curled Up Accuracy penalty and gain +10 to their Damage Roll.
- The user may stop being Curled Up by spending a Swift Action.
- Rollout starts at DB 3. Each successful use raises the next Rollout base DB by +4 to a maximum of DB 15.
- A successful Rollout locks the Pokémon to Rollout on later turns. Missing resets the chain; the UI also exposes **No valid target · end chain** for the source-defined no-target exit.

## Form integration

- Entering/leaving the Combat session dispatches the existing Form `battle-start` / `battle-end` events.
- Resolved Move use dispatches the existing `move-used` Form event.
- HP controls continue to use the existing HP/Form lifecycle path.
- This pass does not yet auto-spend Form lifecycle `actionCost` / `frequency`; the new shared ledger is now the correct target for that next integration.

## PTU source anchors

- Core p.227: one Standard, one Shift and one Swift Action per participant per round; any number of Free Actions; Standard may be given up for another Swift or Shift under the stated restrictions.
- Core p.227–228: Full Action consumes Standard + Shift.
- Core p.236: Accuracy is 1d20 against AC + Evasion; natural 1 always misses, natural 20 always hits; natural roll drives Critical/Effect ranges.
- Core p.236: damaging Critical Hits add the Damage Dice Roll a second time, not the attacking Stat.
- Core p.394: Defense Curl / Curled Up interactions and Rollout/Ice Ball exception.
- Core p.427: Rollout starts DB 3, increases +4 DB per successive use to DB 15, and continues until miss/no valid target.

## Conservative boundaries

- No enemy/NPC automation is invented; external target Evasion/Defense may be entered by the user.
- Type effectiveness and arbitrary textual Move effects are not guessed by this first pass.
- Extended Action progress is reserved for a later shared-ledger layer.
- Deferred/source-insufficient Pokémon Form families remain unchanged.
- No bundled/default `.ptucp` is modified.
