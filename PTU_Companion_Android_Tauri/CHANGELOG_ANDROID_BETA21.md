# PTU Companion Android 2.2.0-beta.21

- Bundles `campaign-homebrew-fakemon-1-leva` v2.0.0 into the default Android runtime.
- Includes 13 campaign Species, 8 Moves, 3 Abilities and offline Species artwork from the approved Fakemon v2 update.
- Loads the generated `fakemon-v2-data.js` overlay with the built-in mobile data, so the new definitions are available without manually importing the `.ptucp` pack.
- Keeps Hisuian Zorua and Hisuian Zoroark as separate regional definitions and includes the approved campaign overlays for Greavard, Houndstone, Maschiff, Mabosstiff, Fidough and Dachsbun.
- Advances the Android app version from `2.2.0-beta.20` to `2.2.0-beta.21` and increments `versionCode` from `2002020` to `2002021`, allowing the new APK to be recognized as an update when it is signed with the same certificate as the installed beta.20.
- Updates Docker build artifact names to beta.21.

Existing application data is preserved by an in-place update. As with previous sideload betas, updating over an installed APK requires the same signing identity; otherwise Android requires uninstalling the previous installation first.
