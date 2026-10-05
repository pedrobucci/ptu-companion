# Issues #32 / #79 â€” captured PokÃ©mon progression reversal

Base: published Windows 2.1.0-beta.30 / Android 2.2.0-beta.36, commit `4f053af`.

Pedro approved blocking reversal when affected values changed after the event on 2026-10-05. Only newly captured level-ups/evolutions can be reversed, one event at a time, newest first. Legacy events are unavailable. This is a campaign correction tool; no PTU rule or source precedence was changed.

## Behavior

- Creature Sheet â†’ Revert latest progression shows a preview and Cancel/Confirm.
- Captures include previous/persisted resulting values for progression fields touched by the event (including values that stayed the same), plus other fields changed during revalidation, including species/form, stats, Moves/Abilities, EXP and Tutor Points. Unrelated data such as notes/name is preserved. HP, Moves and resources are guarded even if the event did not change their values, so later combat/training cannot be silently carried into the earlier build.
- Checks every affected field and the associated Trainer history entry before showing confirmation, then checks again after confirmation. Conflicts block the operation.
- Removes the reverted PokÃ©mon event and only its associated Trainer history entry. Repeated reversals restore earlier captured events; the old future timeline is removed.
- Invalid/missing captures cannot be applied. An unavailable training/form validation rolls back the attempted advancement; duplicate clicks cannot add the same event twice.
- #79: after connection/form revalidation replaces `details`, the event is written to the current instance rather than the discarded object.

## Reproduction and verification

#79 was reproduced by executing both clients' original `applyPokemonProgression` in Node VM with a valid JSON response returning copied `details`. The PokÃ©mon history was missing while the Trainer gained an entry. This is a reproduced execution path, not a visual reproduction on an installed device.

Run `node PTU_Companion_Windows_Source/scripts/verify_issue32_progression_reversal.mjs` from the repository root. It is also included in both `npm run verify` commands.

The regression executes the clients' actual apply/revert/persist functions and uses the Windows HTTP API with isolated temporary SQLite storage and the Android mobile API with isolated browser storage. It checks:

- Charcadet 24â†’25, then evolution to Ceruledge at 26 using real progression previews;
- persisted capture surviving `details` replacements from training and form API responses;
- Tutor Points earned and expired Advanced Connection refund, including restoration on reversal;
- two successive reversals after JSON/SQLite roundtrips, preserving notes, name and unrelated Trainer history;
- cancellation, mutation of each affected field, a conflict while the confirmation is open, edited Trainer history, malformed/legacy records, duplicate click and async failure rollback;
- identical reversal helper code on Windows/Android.

Both full verification suites passed on 2026-10-05. No new application version is delivered by this PR. Real Windows executable/Android WebView testing remains pending the integrated build and Pedro's explicit validation.

## Installed-app validation after build

1. Export the campaign, then use a test PokÃ©mon. Apply a new level-up and confirm its state after restarting the app.
2. Open Revert latest progression, review the preview, cancel, then reopen and confirm. Check level, EXP, stats, Moves/Abilities and Tutor Points after restart.
3. Apply two events including an evolution, then reverse each in order. Confirm species/form and that unrelated notes/name/history remain.
4. Edit an affected value after progression. Confirm that reversal is blocked and the edited data stays intact.
5. Confirm that a legacy event offers no reversal. Keep issues #32/#79 open until Pedro approves the results in the application.
