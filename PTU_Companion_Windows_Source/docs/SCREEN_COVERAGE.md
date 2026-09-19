# Screen coverage and mocked behavior

| Screen | Visual coverage | Mocked interaction |
|---|---|---|
| Dashboard | Trainer, rosters, recent Pokémon, backpack, shop, ruleset | Quick navigation |
| Trainer | Profile, skills, stats, capabilities, trainer moves, equipment, modifiers | Tabs scaffold |
| Rosters | Multiple active rosters, membership, creature detail | Select creature / roster concept |
| Creature | HP, types, combat stats, moves, resolved damage, status | Move selection / tabs |
| Storage | Box view + carried Pokémon | Reject injured Pokémon from storage |
| Items | Backpack, categories, equipment slots | Equip item in React version |
| Shop | Presets, catalog, cart, discounts, checkout | Cart and checkout state |
| NPC Journal | NPC list, tags, details, notes | Select NPC in React version |
| Level Up | Wizard steps, stat allocation, unlock preview | Choose stat / advance step |
| Move Editor | Definition, flags, effect, validation, preview, versions | Editable form |
| Ability Editor | Triggers, semantic effects, dependencies, sandbox | Structured-rule mock |
| Species Editor | Form data, stats, abilities, evolution, learnset | Editable form concept |
| Content Library | Items/Edges/Features/etc. list, source/version metadata | Select definition |

## Deliberate limitations

- This prototype does not contain the production Rules Engine.
- It does not write SQLite data.
- It does not import `.ptucp` packages yet.
- Values such as damage formulas are intentionally mocked to demonstrate **where resolved values are rendered**.
- Creature illustrations are original placeholder SVGs rather than production Pokémon artwork.

The production agent should connect this UI to the domain contracts defined in the main PTU Companion handoff.
