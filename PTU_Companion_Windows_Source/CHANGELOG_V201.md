# Changelog v2.0.1 — Combat Screen Startup Hotfix

## Fixed

- Fixed a startup/render crash when a persisted Trainer had no equipment saved yet and the last open Trainer tab was **Combat**.
- Empty equipment slots are now rendered safely as `Empty` instead of attempting to read `.name` from `null`.
- This specifically fixes the symptom where `RUN_FUNCTIONAL_PREVIEW.bat` opened a page showing only the blue application background with no UI elements.

## Regression coverage

- Added a browser-render smoke test using the same persisted-state shape that caused the failure:
  - `ui.screen = trainer`
  - `ui.trainerTab = combat`
  - `trainer.equipment = null`
- The verifier requires the application shell and Combat tab to render successfully from that state.
