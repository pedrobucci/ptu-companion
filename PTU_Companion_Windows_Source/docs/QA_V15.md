# QA — v1.5

Run:

```bat
VERIFY_V15.bat
```

Expected result:

```text
PTU Companion v1.5 verification: OK
Abilities without Held Item: Flash Fire + Defiant + Twisted Power
Advanced Mobility target list + Overland modifier: passed
Capability Training target list + High Jump modifier: passed
Accuracy Training valid Move list + AC modifier: passed
Poké Edge correction refund: passed
```

## Manual regression tests

1. Create/progress a Level 20+ Pokémon and choose a second native Ability.
2. Acquire Mixed Power.
3. Open `Abilities` without equipping/removing any Held Item.
4. Confirm Starting Ability + Level 20 Ability + Twisted Power are all visible.
5. Open Advanced Training and acquire Advanced Mobility. Confirm a dropdown of actual Movement Capabilities is shown.
6. Acquire Capability Training and confirm only Power/High Jump/Long Jump are offered.
7. Acquire Accuracy Training and confirm only known Moves with AC >= 3 appear.
8. Return to Species/Moves and verify the selected effects are resolved.
9. Refund each acquired Poké Edge and confirm Tutor Points and resolved values return to their previous state.
