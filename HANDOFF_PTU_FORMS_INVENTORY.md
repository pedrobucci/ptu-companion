# Handoff — PTU Parametrized Forms Inventory

## Repository state

- Repository: `pedrobucci/ptu-companion`
- Branch: `content/ptu-parametrized-forms-catalog`
- Stacked base: `feature/pokemon-shiny-d` (Stage D checkpoint)
- Scope: inventory/audit only. Default/bundled `.ptucp` packs are **not changed yet**.
- Do not merge or publish a Release without owner approval.

## Purpose

Inventory every source-parametrized Pokémon variant that can be migrated to the generic Stage B/C Forms model, explicitly including Mega Evolutions, Primal Reversion, regional forms, alternate Forme/Mode records, fusions, Crowned/Hero states, weather/battle modes, and Shiny artwork metadata where it actually exists.

## Source anchors

The inventory uses the supplied project sources rather than canonical-game assumptions:

- `Pokemon Tabletop United 1.05 Core.pdf`, Mega Evolution rules/list on p.206;
- `Gen 8ish PokeDex.pdf` / bundled `ptu-gen8ish-pokedex.ptucp`;
- bundled `ptu-core-1.05.ptucp` for item-definition audit.

PTU Core models Mega Evolution as a temporary transformation. The Pokémon holds its species/form-specific Mega Stone and the Trainer wears a Mega Ring. The transformation can change Type, adds an Ability, changes Stats, preserves HP, and lasts for the Scene.

## Audited counts

The current generated inventory establishes:

- 956 parsed Species records in the Gen8ish source pack;
- **48 Mega Forms across 46 Species**;
- Charizard X/Y and Mewtwo X/Y are distinct Mega Forms;
- **2 Primal Reversions**: Kyogre and Groudon;
- **81 alternate-form candidates** identified by structured variant metadata, regional/form naming, or form-related Capabilities;
- 5 records currently expose structured `variant_of` / `variant_kind=form`; most legacy alternate forms therefore still require family-level classification;
- 0 Species rows in this particular Gen8ish NDJSON carry normal artwork metadata;
- 0 Species rows in this particular Gen8ish NDJSON carry dedicated Shiny artwork metadata.

Shiny remains valid as an individual state through Stage D even when no dedicated Shiny artwork exists; the presentation resolver falls back to normal artwork.

## Mega audit

Every Mega block found in the Gen8ish source is represented in `docs/PTU_FORMS_INVENTORY.md` with:

- base Species;
- Mega / Mega X / Mega Y identity;
- Type replacement when present;
- added Ability;
- PTU Base Stat changes;
- source page.

Three packed `raw_text` records lose their Stats line at a page boundary: Swampert, Beedrill, and Metagross. `repair_ptu_forms_inventory.py` restores only these exact records from the supplied PDF pages and validates their species/Ability data. No generic or canonical-game values are guessed.

The generated inventory also prevents adjacent Diet/Habitat/page-header text from being mistaken for Mega Ability data.

## Files

- `PTU_Companion_Windows_Source/scripts/inspect_ptu_form_candidates.py`
- `PTU_Companion_Windows_Source/scripts/build_ptu_forms_inventory.py`
- `PTU_Companion_Windows_Source/scripts/repair_ptu_forms_inventory.py`
- `.github/workflows/inspect-ptu-form-candidates.yml`
- `docs/PTU_FORMS_INVENTORY.md`
- `docs/data/PTU_FORMS_INVENTORY.json`

`build_ptu_forms_inventory_v2.py` is a stricter diagnostic extractor created while hardening page-boundary behavior; the production inventory workflow deliberately uses the source-backed build + repair path above because the packed raw text genuinely omits three page-boundary Stats blocks.

## Validation

GitHub Actions run `36205958332` completed successfully.

The workflow verifies:

- 48 Mega Forms / 46 Mega-capable Species;
- Kyogre and Groudon Primal Reversion;
- complete Ability and Stat data for every Mega/Primal record after source-backed repair;
- explicit Swampert, Beedrill, and Metagross page-boundary values;
- no adjacent source-section leakage;
- generated Markdown and JSON inventories are non-empty and deterministic enough to be regenerated from the source packs.

A previous hardening run, `36205867397`, failed intentionally when the stricter extractor exposed the three page-boundary omissions. That finding led to the explicit PDF-backed repair instead of silently accepting incomplete data.

## Classification still required before pack mutation

The 81 alternate candidates must now be grouped and classified family by family. Regional forms should preserve compatibility with their current Species IDs/imports while becoming available through the generic Form layer. Dynamic pairs/families such as Deoxys, Giratina, Rotom, Therian/Incarnate, Kyurem fusions, Meloetta, Hoopa, Darmanitan modes, Eiscue, Minior, Wishiwashi, Necrozma, Zacian/Zamazenta, Zygarde, and similar records must be classified from their PTU mechanics rather than from naming alone.

Mega and Primal entries are already classified as temporary transformations by their PTU rules, but their exact requirements will bind only to stable source-backed item/state identifiers. Missing Mega Stone IDs must not be invented.

## Exact stop point

The source inventory, including all 48 Mega Forms and 2 Primals, is audited and validated. **Default pack conversion has not started yet.**

Next work: classify all 81 alternate candidates, audit local/app artwork mappings for normal/Form/Shiny assets, generate deterministic `forms[]` overlays, then update Windows and Android default packs with completeness/regression checks before any merge or Release.
