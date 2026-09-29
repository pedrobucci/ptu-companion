# Handoff — PTU Combat source precedence + Hydration/Ice Body 21

Repository: `pedrobucci/ptu-companion`; branch `content/ptu-parametrized-forms-catalog`; Draft PR #11. Keep the PR Draft/Open; do not merge. The owner has now explicitly authorized a beta pre-release after verification. Do not mutate bundled/default `.ptucp` files.

## Source order and active definitions

The deterministic precedence catalog in `docs/data/PTU_COMBAT_SOURCE_PRECEDENCE.json` is the sole ordering input, derived from the supplied PDFs: Core 100 → 1.05 Editation 110 → May 2015 120 → September 2015 130 → February 2016 140. Resolve the highest-ranked row (later record breaks ties), then check the winner's audited source signature. Core-vs-later differences are overrides, not blockers.

Quick Curl, Electrodash, Prime Fury, Hydration and Ice Body resolve to February 2016. Hydration is `Scene – Swift Action`, cures one explicitly tracked Status Affliction, and ignores its frequency in Rainy Weather while retaining the Swift cost. Ice Body is `Daily x5 – Swift Action`, restores one Tick (one tenth max HP, represented as whole HP), and is usable below 50% HP or during Hail. Hail immunity is shown as a reminder because incoming damage remains manual. Source resolution is identical in Windows and Android clients.

## Invariants

- Physical dice only; targets remain abstract; no generic prose parser.
- Hydration/Ice Body use the existing shared action/frequency and HP paths. Undo refunds resources only; it does not revert healed HP or a cured affliction.
- The tracked session weather and afflictions are explicit player-entered facts.
- No `.ptucp` updates, PR merge, or stable release.

## Rebuild and verification

The deterministic entry point is `python PTU_Companion_Windows_Source/scripts/apply_stage_b_combat_session_fixups.py`. Source-precedence, Hydration/Ice Body behavior, shared ledger, Quick Curl, Electrodash, Prime Fury, Vicious, Sprint, and Move outcome verifiers are maintained in the Windows scripts and run in both platform workflows. Full Windows and Android `npm run verify` suites must pass before creating the beta artifacts.

The coordinated next versions are Windows `2.1.0-beta.21` and Android `2.2.0-beta.23` (`versionCode` 2002023). Compare the built APK signing certificate with the prior beta before claiming install-over continuity. Attach Windows and Android artifacts with build-info and SHA-256 checksums to the GitHub pre-release; leave PR #11 open and Draft.
