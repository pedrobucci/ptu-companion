#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
CLASSIFICATION = REPO / 'docs' / 'data' / 'PTU_FORMS_CLASSIFICATION.json'
INVENTORY = REPO / 'docs' / 'data' / 'PTU_FORMS_INVENTORY.json'
ASSET_AUDIT = REPO / 'docs' / 'data' / 'PTU_FORM_ASSET_AUDIT.json'
OUT_JSON = REPO / 'docs' / 'data' / 'PTU_FORMS_STAGE_B.json'
OUT_MD = REPO / 'docs' / 'PTU_FORMS_STAGE_B.md'
DIRECT_CLASSIFICATIONS = {'permanent', 'persistent_form', 'transformation'}


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
        # Stage B's manual requirement is used deliberately when the PTU source proves
        # the transformation but cannot be represented by a stable generic trigger yet.
        form['requirements'] = manual_requirement(f'{family["family"]}:{form["id"]}')
    return form


def candidate_catalog(classification: dict) -> tuple[list[dict], list[dict]]:
    emitted: list[dict] = []
    omitted: list[dict] = []
    for family in classification.get('families', []):
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
            'note': 'forms[] contains only Stage B-compatible type/base-stat overrides. Ability/capability snapshots remain versioned beside it until a lossless definition-layer mapping is available.'
        })
    return emitted, omitted


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
    for (species_id, family), rows in sorted(by_species.items()):
        output.append({
            'species_id': species_id,
            'source_family': family,
            'forms': [row['form'] for row in rows],
            'source_effects': [row['source_effects'] for row in rows],
            'note': 'Added Ability/extra effects are preserved as source effects but are not guessed into ability-slot structures. The generated forms[] stays valid for Stage B while the mapping remains explicit and reviewable.'
        })
    return output


def main() -> None:
    classification = json.loads(CLASSIFICATION.read_text(encoding='utf-8'))
    inventory = json.loads(INVENTORY.read_text(encoding='utf-8'))
    assets = json.loads(ASSET_AUDIT.read_text(encoding='utf-8'))
    candidate_entries, omitted = candidate_catalog(classification)
    synthetic_entries = synthetic_catalog(inventory)

    candidate_forms = sum(len(row['forms']) for row in candidate_entries)
    synthetic_forms = sum(len(row['forms']) for row in synthetic_entries)
    payload = {
        'schema_version': 1,
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
            'candidate_forms': candidate_forms,
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
        f'- Candidate-record Stage B forms emitted: **{candidate_forms}**',
        f'- Synthetic Stage B transforms emitted: **{synthetic_forms}**',
        f'- Mega transforms: **{len(inventory.get("mega_forms", []))}**',
        f'- Primal transforms: **{len(inventory.get("primal_forms", []))}**',
        f'- Ultra Burst transforms: **{len(inventory.get("ultra_burst_forms", []))}**',
        f'- Families not directly materialized: **{len(omitted)}**', '',
        '## Safety gates', '',
        '- Every emitted `forms[]` entry uses Stage B mode `permanent` or `transformation`.',
        '- Source-insufficient requirements use Stage B `manual` review gates instead of guessed items/conditions.',
        '- No artwork URL is generated. Artwork remains governed by the separate asset audit and the existing Stage B fallback.',
        '- Ability/capability source snapshots and synthetic added-Ability effects remain explicit metadata until they can be mapped losslessly to definition-layer objects.',
        '- No `.ptucp` file is written by this generator.', '',
        '## Synthetic transformations', ''
    ]
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
