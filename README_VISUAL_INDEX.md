# PTU Companion — Visual Design Pack Index

This package groups the current visual mockups for the **PTU Companion** project.
It is intended to help a planner or implementation agent (such as Codex) quickly understand
how the application is expected to look and how the main screens relate to the product design.

## Important note

These images are **visual concept mockups**, not final production screenshots.
They should be used as:

- UI and UX direction
- layout reference
- component inspiration
- color and style guidance
- scope reference for desktop and mobile screens

They should **not** be treated as pixel-perfect final requirements.

---

## Package structure

- `images/` → all mockup images
- `pokemon-ui-design-compliance.md` → supplemental visual/design compliance reference
- `README_VISUAL_INDEX.md` → this index

---

## Visual language summary

These mockups aim for the following overall style:

- **cartoon-like / Pokédex-inspired interface**
- **rounded borders and panels**
- **bold color coding**, especially for Pokémon types and categories
- **friendly icons**, colorful badges, and readable cards
- **desktop + Android dual-view thinking**
- **minimalist information grouping**, using tabs, chips, cards, and popups instead of long text walls

The visual goal is to feel like a **modern stylized Pokédex companion app**, not a realistic or plain enterprise application.

---

## Screen index

### 1. `images/ptu_companion_dashboard_showcase.png`
**Refers to:** Main overview / project showcase dashboard.

**Purpose:**
A high-level visual summary of the app’s design language and overall identity. Useful as a broad reference for the planner when defining the home screen and general style rules.

**Main ideas conveyed:**
- strong app branding
- card-based layout
- blue + red Pokédex-inspired palette
- coexistence of desktop and mobile experiences

---

### 2. `images/ptu_companion_trainer_dashboard.png`
**Refers to:** Trainer overview screen.

**Purpose:**
Shows how the main trainer sheet/dashboard may be organized, including character summary, key stats, resources, and quick navigation to the trainer’s main systems.

**Main ideas conveyed:**
- trainer summary at a glance
- prominent stats and status blocks
- quick access to related modules
- mobile and desktop coherence

---

### 3. `images/ptu_companion_roster_management_ui.png`
**Refers to:** Roster management interface.

**Purpose:**
Demonstrates how Pokémon rosters should look visually, including visible creature images, roster slots, multiple roster contexts, and easy navigation between teams.

**Main ideas conveyed:**
- roster as a visual grid/list of Pokémon
- photo/sprite-first presentation
- support for multiple active rosters
- fast selection and organization

---

### 4. `images/ptu_companion_creature_sheet_mockup.png`
**Refers to:** Individual Pokémon sheet / creature detail screen.

**Purpose:**
Shows how a Pokémon’s detailed sheet may be displayed, including stats, type badges, moves, abilities, and other relevant mechanical information.

**Main ideas conveyed:**
- a clean but rich Pokémon sheet
- tabs or grouped sections to reduce clutter
- visual emphasis on type, stats, and moves
- room for flavor information and supporting details

---

### 5. `images/ptu_companion_storage_management_ui.png`
**Refers to:** Pokémon storage management screen.

**Purpose:**
Illustrates how stored Pokémon might be shown separately from active rosters, supporting browsing, filtering, and transferring between storage and roster.

**Main ideas conveyed:**
- separation between active roster and storage
- easy movement between collections
- scalable visual browsing for many Pokémon

---

### 6. `images/ptu_companion_inventory_mockup.png`
**Refers to:** Trainer inventory / backpack / item storage screen.

**Purpose:**
Represents the item management area where the trainer handles consumables, equipment, and stored items.

**Main ideas conveyed:**
- category-based browsing
- icon-rich item representation
- distinction between backpack, equipped items, and storage
- fast navigation and usability on mobile and desktop

---

### 7. `images/ptu_companion_shop_checkout_concept.png`
**Refers to:** Shop and checkout interface.

**Purpose:**
Shows the expected purchase flow for items, including browsing the shop, adjusting prices, and confirming purchases that affect trainer money and inventory.

**Main ideas conveyed:**
- clean shop browsing
- visible pricing and totals
- purchase confirmation / checkout flow
- room for category filters and custom pricing behavior

---

### 8. `images/ptu_companion_npc_journal_interface.png`
**Refers to:** NPC journal / encounter notes screen.

**Purpose:**
Demonstrates the interface for recording NPCs, including their names, descriptions, tags, and possibly images.

**Main ideas conveyed:**
- note-taking integrated into the app aesthetic
- searchable or categorized NPC entries
- lightweight campaign memory tool

---

### 9. `images/ptu_companion_level_up_wizard.png`
**Refers to:** Guided level-up wizard.

**Purpose:**
Shows the intended guided flow for trainer or Pokémon level progression, helping the user allocate newly unlocked features, edges, moves, and stat points.

**Main ideas conveyed:**
- step-by-step progression flow
- clear indication of newly unlocked choices
- reduced rule confusion through guided UI

---

## Editor-focused mockups

These images specifically describe how the **content editing tools** may work, especially on Windows.
They are particularly important for the implementation of the desktop editor suite.

### 10. `images/ptu_companion_content_editor_mockup.png`
**Refers to:** Unified content library/editor.

**Purpose:**
A broad editor view showing a searchable content library for items, edges, features, capabilities, and other content definitions.

**Main ideas conveyed:**
- unified content browser
- filtering by category and source pack
- detail pane for editing a selected entry
- content pack and ruleset awareness
- bulk actions and version comparison concepts

---

### 11. `images/ptu_companion_move_editor_showcase.png`
**Refers to:** Move editor.

**Purpose:**
Explains how a custom move may be created, previewed, validated, and versioned.

**Main ideas conveyed:**
- move metadata fields
- structured rule flags and keywords
- validation panel
- formula/damage preview
- version history
- reference search for species/classes using the move

---

### 12. `images/ptu_companion_ability_editor_mockup.png`
**Refers to:** Ability editor.

**Purpose:**
Shows how abilities, passive effects, and capability-like triggers can be described using structured conditions and semantic effects.

**Main ideas conveyed:**
- condition builder
- semantic effects builder
- compatibility/usage rules
- validation and dependency tracking
- trigger sandbox / simulation concept

---

### 13. `images/ptu_companion_species_editor_mockup.png`
**Refers to:** Pokémon species editor.

**Purpose:**
Describes how official, regional, and homebrew species/forms could be created or overridden, including stats, abilities, evolution lines, typing, and learnsets.

**Main ideas conveyed:**
- species/form identity fields
- stat editing
- ability and capability assignment
- evolution graph and habitat sections
- learnset builder
- dex entry and typing preview
- conflict warnings for overrides

---

## Suggested usage for Codex / planner

A planner or implementation agent can use these materials in the following order:

1. Start with `ptu_companion_dashboard_showcase.png` to understand the overall style.
2. Use `ptu_companion_trainer_dashboard.png`, `ptu_companion_roster_management_ui.png`, `ptu_companion_creature_sheet_mockup.png`, `ptu_companion_inventory_mockup.png`, and `ptu_companion_shop_checkout_concept.png` to plan the player-facing application.
3. Use `ptu_companion_storage_management_ui.png`, `ptu_companion_npc_journal_interface.png`, and `ptu_companion_level_up_wizard.png` to define supporting game-management flows.
4. Use `ptu_companion_content_editor_mockup.png`, `ptu_companion_move_editor_showcase.png`, `ptu_companion_ability_editor_mockup.png`, and `ptu_companion_species_editor_mockup.png` to define the Windows editor suite.
5. Use `pokemon-ui-design-compliance.md` as a supplemental rulebook for tokens, accessibility, component consistency, and visual compliance.

---

## Recommended implementation interpretation

The visual mockups suggest the following component families:

- **Type badges**
- **stat bars**
- **rounded cards/panels**
- **chip/tag systems**
- **tabbed detail panes**
- **side navigation for desktop**
- **bottom navigation for mobile**
- **modal / popup detail viewers**
- **preview + editor split layouts**
- **validation panels and warnings**

These patterns should be abstracted into reusable UI components rather than coded as isolated one-off screens.

---

## Final note

This pack is meant to reduce planning ambiguity.
If the implementation agent needs to prioritize scope, it should preserve the **overall visual language and information hierarchy** first, and only later pursue pixel-perfect fidelity.
