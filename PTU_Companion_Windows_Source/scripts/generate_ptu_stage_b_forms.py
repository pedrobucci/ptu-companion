#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
import re
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
CLASSIFICATION = REPO / 'docs' / 'data' / 'PTU_FORMS_CLASSIFICATION.json'
INVENTORY = REPO / 'docs' / 'data' / 'PTU_FORMS_INVENTORY.json'
ASSET_AUDIT = REPO / 'docs' / 'data' / 'PTU_FORM_ASSET_AUDIT.json'
POKEDEX_PACK = ROOT / 'seed' / 'content-packs' / 'ptu-gen8ish-pokedex.ptucp'
OUT_JSON = REPO / 'docs' / 'data' / 'PTU_FORMS_STAGE_B.json'
OUT_MD = REPO / 'docs' / 'PTU_FORMS_STAGE_B.md'
DIRECT_CLASSIFICATIONS = {'permanent', 'persistent_form', 'transformation'}
RULE_DEFINED_BUILDERS = {'aegislash', 'basculin', 'burmy', 'furfrou'}


def slug(value: str) -> str:
    value = str(value or '').casefold().replace('♀', '-f').replace('♂', '-m')
    return re.sub(r'[^a-z0-9]+', '-', value).strip('-')


def clean_types(value: str | None) -> list[str] | None:
    if not value:
        return None
    text = str(value).strip()
    if not text or text.casefold() in {'unchanged', 'none', 'n/a'}:
        return None
    parts = [part.strip() for part in re.split(r'\s*/\s*|\s*,\s*', text) if part.strip()]
    return parts or None


def manual_requirement(key: str) -> dict:
    return {'all': [{'kind': 'manual', 'value': slug(key)}]}


def load_species_rows() -> dict[str, dict]:
    with zipfile.ZipFile(POKEDEX_PACK) as archive:
        species_path = next(name for name in archive.namelist() if name.endswith('species.ndjson'))
        rows = [json.loads(line) for line in archive.read(species_path).decode('utf-8').splitlines() if line.strip()]
    return {
        slug(row.get('logical_id') or row.get('id')): row
        for row in rows
        if row.get('logical_id') or row.get('id')
    }


def source_row(rows: dict[str, dict], ident: str) -> dict:
    row = rows.get(slug(ident))
    if not row:
        raise SystemExit(f'Source Species row missing for rule-defined builder: {ident}')
    return row


def ability_label(slot: object) -> str:
    if isinstance(slot, dict):
        return str(slot.get('name') or slot.get('ability_id') or '')
    return str(slot or '')


def replace_ability_slot(slots: list, predicate, new_name: str) -> list:
    output = copy.deepcopy(slots)
    matches = []
    for index, slot in enumerate(output):
        label = slug(ability_label(slot))
        if predicate(label):
            matches.append(index)
    if len(matches) != 1:
        raise SystemExit(f'Expected one dynamic Ability slot for {new_name}, found {len(matches)} in {[ability_label(x) for x in slots]}')
    index = matches[0]
    slot = output[index]
    if isinstance(slot, dict):
        slot['name'] = new_name
        slot['ability_id'] = slug(new_name)
    else:
        output[index] = {'name': new_name, 'ability_id': slug(new_name)}
    return output


def record_form(family: dict, record: dict, sort_order: int) -> dict:
    classification = family['classification']
    mode = 'transformation' if classification == 'transformation' else 'permanent'
    overrides: dict = {}
    if record.get('types'):
        overrides['types'] = {'replace': record['types']}
    if record.get('base_stats'):
        overrides['baseStats'] = {'replace': record['base_stats']}
    form = {
        'id': slug(record.get('id') or record.get('name')),
        'name': record.get('name') or record.get('id'),
        'mode': mode,
        'overrides': overrides,
        'sortOrder': sort_order,
    }
    if mode == 'transformation':
        # Stage B's generic requirement tree cannot encode event-driven PTU triggers yet.
        # A manual condition is therefore a review gate, never a fabricated rule.
        form['requirements'] = manual_requirement(f'{family["family"]}:{form["id"]}')
    return form


def candidate_catalog(classification: dict) -> tuple[list[dict], list[dict]]:
    emitted: list[dict] = []
    omitted: list[dict] = []
    for family in classification.get('families', []):
        if family['family'] in RULE_DEFINED_BUILDERS:
            continue
        kind = family.get('classification')
        if kind not in DIRECT_CLASSIFICATIONS:
            omitted.append({
                'family': family['family'],
                'classification': kind,
                'reason': 'Classification is not safe for direct forms[] materialization.'
            })
            continue
        records = family.get('records', [])
        alternate_records = [
            row for row in records
            if slug(row.get('id')) != slug(family['family']) or row.get('variant_of') or row.get('variant_kind')
        ]
        if not alternate_records:
            omitted.append({
                'family': family['family'],
                'classification': kind,
                'reason': 'The family is source-classified, but its alternate state is rule-defined rather than represented by a separate candidate Species row; no mechanical override is guessed.'
            })
            continue
        forms = [record_form(family, row, index * 10) for index, row in enumerate(alternate_records, start=1)]
        emitted.append({
            'family': family['family'],
            'classification': kind,
            'target_layer': family['target_layer'],
            'builder': 'parameterized_species_record',
            'forms': forms,
            'source_snapshots': [
                {
                    'id': row.get('id'),
                    'abilities': row.get('abilities', []),
                    'capabilities': row.get('capabilities', []),
                    'source_page': row.get('source_page'),
                }
                for row in alternate_records
            ],
            'note': 'forms[] contains Stage B-compatible type/base-stat overrides from separately parameterized Species rows. Ability/capability snapshots remain versioned beside it until a lossless definition-layer mapping is available.'
        })
    return emitted, omitted


def aegislash_builder(family: dict, rows: dict[str, dict]) -> dict:
    row = source_row(rows, 'aegislash')
    stats = copy.deepcopy(row.get('base_stats') or {})
    required = {'hp', 'attack', 'defense', 'special_attack', 'special_defense', 'speed'}
    if not required <= set(stats):
        raise SystemExit(f'Aegislash source stats incomplete: {stats}')
    sword = copy.deepcopy(stats)
    sword['attack'], sword['defense'] = stats['defense'], stats['attack']
    sword['special_attack'], sword['special_defense'] = stats['special_defense'], stats['special_attack']
    return {
        'family': 'aegislash',
        'classification': family['classification'],
        'target_layer': family['target_layer'],
        'builder': 'rule_defined_stance_change',
        'forms': [{
            'id': 'sword-stance',
            'name': 'Sword Stance',
            'mode': 'transformation',
            'requirements': manual_requirement('aegislash:sword-stance'),
            'overrides': {'baseStats': {'replace': sword}},
            'sortOrder': 10,
        }],
        'source_mechanics': {
            'source': 'Pokemon Tabletop United 1.05 Core p.331',
            'base_state': 'Shield Stance',
            'enter': 'Damaging attack, or voluntary Full Action stance change.',
            'exit': "King's Shield, Protect, a Status Move that raises Defense Combat Stages, a Blessing, or voluntary Full Action stance change.",
            'effect': 'Swap Attack with Defense and Special Attack with Special Defense without changing Combat Stages.'
        },
        'note': 'Shield Stance remains the implicit base state. The manual requirement is only a Stage B review gate because the current generic requirement tree does not encode move-event transitions.'
    }


def burmy_builder(family: dict, rows: dict[str, dict]) -> dict:
    row = source_row(rows, 'burmy')
    base_types = list(row.get('types') or [])
    if not base_types:
        raise SystemExit('Burmy source Type is missing')
    forms = []
    for order, (ident, name, secondary, material) in enumerate((
        ('plant-cloak', 'Plant Cloak', 'Grass', 'leaves and twigs'),
        ('sandy-cloak', 'Sandy Cloak', 'Ground', 'sand and rocks'),
        ('trash-cloak', 'Trash Cloak', 'Steel', 'trash or scrap'),
    ), start=1):
        forms.append({
            'id': ident,
            'name': name,
            'mode': 'permanent',
            'overrides': {'types': {'replace': [*base_types, secondary]}},
            'sortOrder': order * 10,
        })
    return {
        'family': 'burmy',
        'classification': family['classification'],
        'target_layer': family['target_layer'],
        'builder': 'rule_defined_quick_cloak',
        'forms': forms,
        'source_mechanics': {
            'source': 'Pokemon Tabletop United 1.05 Core p.327',
            'action': 'At-Will Standard Action',
            'materials': {
                'plant-cloak': 'leaves and twigs',
                'sandy-cloak': 'sand and rocks',
                'trash-cloak': 'trash or scrap'
            },
            'removal': 'Cloak is destroyed by Super-Effective damage or replaced when Burmy makes a new Cloak.',
            'evolution': 'The cloak secondary Type becomes permanent upon evolution into Wormadam.'
        },
        'note': 'The three secondary Types are copied directly from Quick Cloak. No trigger, duration, or additional stat effect is inferred.'
    }


def furfrou_builder(family: dict, rows: dict[str, dict]) -> dict:
    row = source_row(rows, 'furfrou')
    slots = row.get('ability_slots') or row.get('abilities') or []
    if not slots:
        raise SystemExit('Furfrou source Ability slots are missing')
    mapping = (
        ('star-trim', 'Star Trim', 'Celebrate'),
        ('diamond-trim', 'Diamond Trim', 'Defiant'),
        ('heart-trim', 'Heart Trim', 'Cute Tears'),
        ('pharaoh-trim', 'Pharaoh Trim', 'Sand Veil'),
        ('kabuki-trim', 'Kabuki Trim', 'Inner Focus'),
        ('la-reine-trim', 'La Reine Trim', 'Intimidate'),
        ('matron-trim', 'Matron Trim', 'Friend Guard'),
        ('dandy-trim', 'Dandy Trim', 'Moxie'),
        ('debutante-trim', 'Debutante Trim', 'Confidence'),
    )
    forms = []
    for order, (ident, name, ability_name) in enumerate(mapping, start=1):
        abilities = replace_ability_slot(slots, lambda label: label == 'fabulous-trim', ability_name)
        forms.append({
            'id': ident,
            'name': name,
            'mode': 'permanent',
            'overrides': {'abilities': {'replace': abilities}},
            'sortOrder': order * 10,
        })
    return {
        'family': 'furfrou',
        'classification': family['classification'],
        'target_layer': family['target_layer'],
        'builder': 'rule_defined_fabulous_trim',
        'forms': forms,
        'source_mechanics': {
            'source': 'Pokemon Tabletop United 1.05 Core p.317',
            'action': 'Extended Action at an appropriate hair parlor',
            'dynamic_slot': 'Fabulous Trim',
            'ability_mapping': {name: ability for _, name, ability in mapping}
        },
        'note': 'The builder copies the entire source Ability-slot array and replaces only the Fabulous Trim slot, preserving its slot/category metadata and every unaffected Ability.'
    }


def basculin_builder(family: dict, rows: dict[str, dict]) -> dict:
    row = source_row(rows, 'basculin')
    slots = row.get('ability_slots') or row.get('abilities') or []
    if not slots:
        raise SystemExit('Basculin source Ability slots are missing')
    predicate = lambda label: 'reckless' in label and 'rock-head' in label
    forms = []
    for order, (ident, name, ability_name) in enumerate((
        ('red', 'Red', 'Reckless'),
        ('blue', 'Blue', 'Rock Head'),
    ), start=1):
        abilities = replace_ability_slot(slots, predicate, ability_name)
        forms.append({
            'id': ident,
            'name': name,
            'mode': 'permanent',
            'overrides': {'abilities': {'replace': abilities}},
            'sortOrder': order * 10,
        })
    return {
        'family': 'basculin',
        'classification': family['classification'],
        'target_layer': family['target_layer'],
        'builder': 'embedded_color_ability_variant',
        'forms': forms,
        'source_mechanics': {
            'source': 'Gen 8ish PokeDex p.764',
            'dynamic_slot': 'Advanced Ability 2',
            'ability_mapping': {'Red': 'Reckless', 'Blue': 'Rock Head'},
            'switching_rule': None,
        },
        'note': 'The builder copies the source Ability-slot array and resolves only the explicitly parameterized Red/Blue Advanced Ability 2. No runtime switching rule is added.'
    }


def rule_defined_catalog(classification: dict, rows: dict[str, dict]) -> list[dict]:
    families = {entry['family']: entry for entry in classification.get('families', [])}
    expected = {
        'aegislash': 'transformation',
        'basculin': 'permanent',
        'burmy': 'persistent_form',
        'furfrou': 'persistent_form',
    }
    for family, kind in expected.items():
        actual = families.get(family, {}).get('classification')
        if actual != kind:
            raise SystemExit(f'Rule-defined builder classification drift for {family}: {actual} != {kind}')
    return [
        aegislash_builder(families['aegislash'], rows),
        basculin_builder(families['basculin'], rows),
        burmy_builder(families['burmy'], rows),
        furfrou_builder(families['furfrou'], rows),
    ]


def synthetic_form(row: dict, family: str, form_id: str, form_name: str, sort_order: int) -> dict:
    overrides: dict = {'baseStats': {'add': row.get('stat_changes', {})}}
    types = clean_types(row.get('type_change'))
    if types:
        overrides['types'] = {'replace': types}
    return {
        'id': slug(form_id),
        'name': form_name,
        'mode': 'transformation',
        'requirements': manual_requirement(f'{family}:{row.get("species", {}).get("id") or row.get("species", {}).get("name")}:{form_id}'),
        'overrides': overrides,
        'sortOrder': sort_order,
    }


def synthetic_catalog(inventory: dict) -> list[dict]:
    by_species: dict[tuple[str, str], list[dict]] = defaultdict(list)

    for row in inventory.get('mega_forms', []):
        species = row.get('species', {})
        species_id = slug(species.get('id') or species.get('name'))
        suffix = slug(row.get('form_suffix'))
        form_id = 'mega' + (f'-{suffix}' if suffix else '')
        name = f'Mega {species.get("name")}' + (f' {str(row.get("form_suffix")).upper()}' if suffix else '')
        by_species[(species_id, 'mega-evolution')].append({
            'form': synthetic_form(row, 'mega-evolution', form_id, name, 100),
            'source_effects': {
                'ability_added': row.get('ability_added'),
                'extra_effects': row.get('extra_effects', []),
                'source_page': species.get('source_page'),
            }
        })

    for row in inventory.get('primal_forms', []):
        species = row.get('species', {})
        species_id = slug(species.get('id') or species.get('name'))
        by_species[(species_id, 'primal-reversion')].append({
            'form': synthetic_form(row, 'primal-reversion', 'primal', f'Primal {species.get("name")}', 110),
            'source_effects': {
                'ability_added': row.get('ability_added'),
                'extra_effects': row.get('extra_effects', []),
                'source_page': species.get('source_page'),
            }
        })

    for row in inventory.get('ultra_burst_forms', []):
        species = row.get('species', {})
        species_id = slug(species.get('id') or row.get('source_form_id') or species.get('name'))
        by_species[(species_id, 'ultra-burst')].append({
            'form': synthetic_form(row, 'ultra-burst', 'ultra-burst', f'Ultra {species.get("name")}', 120),
            'source_effects': {
                'ability_added': row.get('ability_added'),
                'extra_effects': row.get('extra_effects', []),
                'source_page': species.get('source_page'),
            }
        })

    output: list[dict] = []
    for (species_id, family), entries in sorted(by_species.items()):
        output.append({
            'species_id': species_id,
            'source_family': family,
            'forms': [entry['form'] for entry in entries],
            'source_effects': [entry['source_effects'] for entry in entries],
            'note': 'Added Ability/extra effects are preserved as source effects but are not guessed into ability-slot structures. The generated forms[] stays valid for Stage B while the mapping remains explicit and reviewable.'
        })
    return output


def main() -> None:
    classification = json.loads(CLASSIFICATION.read_text(encoding='utf-8'))
    inventory = json.loads(INVENTORY.read_text(encoding='utf-8'))
    assets = json.loads(ASSET_AUDIT.read_text(encoding='utf-8'))
    species_rows = load_species_rows()
    record_entries, omitted = candidate_catalog(classification)
    builder_entries = rule_defined_catalog(classification, species_rows)
    candidate_entries = sorted([*record_entries, *builder_entries], key=lambda row: row['family'])
    synthetic_entries = synthetic_catalog(inventory)

    record_forms = sum(len(row['forms']) for row in record_entries)
    builder_forms = sum(len(row['forms']) for row in builder_entries)
    candidate_forms = record_forms + builder_forms
    synthetic_forms = sum(len(row['forms']) for row in synthetic_entries)
    payload = {
        'schema_version': 2,
        'stage_b_form_schema_version': 1,
        'applied_to_default_packs': False,
        'policy': {
            'deterministic': True,
            'no_default_pack_mutation': True,
            'no_invented_requirements': True,
            'no_invented_artwork_urls': True,
            'manual_requirement_is_a_review_gate': True,
            'note': 'This is a generated conversion catalog. It intentionally does not mutate bundled .ptucp files while deferred families remain.'
        },
        'summary': {
            'candidate_family_entries': len(candidate_entries),
            'record_backed_family_entries': len(record_entries),
            'rule_defined_family_entries': len(builder_entries),
            'candidate_forms': candidate_forms,
            'record_backed_forms': record_forms,
            'rule_defined_forms': builder_forms,
            'omitted_or_deferred_family_entries': len(omitted),
            'synthetic_species_entries': len(synthetic_entries),
            'synthetic_forms': synthetic_forms,
            'mega_forms': len(inventory.get('mega_forms', [])),
            'primal_forms': len(inventory.get('primal_forms', [])),
            'ultra_burst_forms': len(inventory.get('ultra_burst_forms', [])),
            'local_artwork_matches_available_for_review': assets.get('summary', {}).get('candidate_asset_matches', 0),
        },
        'candidate_families': candidate_entries,
        'synthetic_transform_species': synthetic_entries,
        'not_materialized': omitted,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    lines = [
        '# PTU Stage B Forms Catalog', '',
        'Generated deterministically from the versioned PTU classification/inventory. This catalog is intentionally **not applied to the bundled/default packs** while source-insufficient families remain.', '',
        '## Summary', '',
        f'- Candidate-family form entries: **{len(candidate_entries)}**',
        f'- Record-backed family entries: **{len(record_entries)}**',
        f'- Rule-defined family entries: **{len(builder_entries)}**',
        f'- Candidate-record/derived Stage B forms emitted: **{candidate_forms}**',
        f'- Record-backed forms: **{record_forms}**',
        f'- Rule-defined forms: **{builder_forms}**',
        f'- Synthetic Stage B transforms emitted: **{synthetic_forms}**',
        f'- Mega transforms: **{len(inventory.get("mega_forms", []))}**',
        f'- Primal transforms: **{len(inventory.get("primal_forms", []))}**',
        f'- Ultra Burst transforms: **{len(inventory.get("ultra_burst_forms", []))}**',
        f'- Families not directly materialized: **{len(omitted)}**', '',
        '## Safety gates', '',
        '- Every emitted `forms[]` entry uses Stage B mode `permanent` or `transformation`.',
        '- Source-insufficient/event-driven requirements use Stage B `manual` review gates instead of guessed items/conditions.',
        '- No artwork URL is generated. Artwork remains governed by the separate asset audit and the existing Stage B fallback.',
        '- Rule-defined Ability builders clone the source Species Ability-slot array and replace only the explicitly dynamic slot.',
        '- No `.ptucp` file is written by this generator.', '',
        '## Rule-defined builders', ''
    ]
    for entry in sorted(builder_entries, key=lambda row: row['family']):
        labels = ', '.join(form['name'] for form in entry['forms'])
        lines.append(f'- `{entry["family"]}` / `{entry["builder"]}` — {labels}')
    lines += ['', '## Synthetic transformations', '']
    for entry in synthetic_entries:
        labels = ', '.join(form['name'] for form in entry['forms'])
        lines.append(f'- `{entry["species_id"]}` / `{entry["source_family"]}` — {labels}')
    lines += ['', '## Not directly materialized', '']
    for entry in omitted:
        lines.append(f'- `{entry["family"]}` ({entry["classification"]}) — {entry["reason"]}')
    OUT_MD.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(json.dumps(payload['summary'], sort_keys=True))


if __name__ == '__main__':
    main()
