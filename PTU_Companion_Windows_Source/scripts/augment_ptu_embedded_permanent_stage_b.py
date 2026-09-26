#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
PACK = ROOT / 'seed' / 'content-packs' / 'ptu-gen8ish-pokedex.ptucp'
CLASSIFICATION = REPO / 'docs' / 'data' / 'PTU_FORMS_CLASSIFICATION.json'
STAGE_B = REPO / 'docs' / 'data' / 'PTU_FORMS_STAGE_B.json'
STAGE_B_MD = REPO / 'docs' / 'PTU_FORMS_STAGE_B.md'

STRUCTURED_FIELDS = (
    ('types', 'types'),
    ('base_stats', 'baseStats'),
    ('ability_slots', 'abilities'),
    ('capabilities', 'capabilities'),
    ('skills', 'skills'),
    ('level_up_moves', 'levelUpMoves'),
    ('tm_moves', 'tmMoves'),
    ('tutor_moves', 'tutorMoves'),
    ('egg_moves', 'eggMoves'),
)

SIZE_STATS = {
    'pumpkaboo': {
        'source_page': 437,
        'forms': {
            'small': {'hp': 4, 'attack': 7, 'defense': 7, 'special_attack': 4, 'special_defense': 6, 'speed': 6},
            'average': {'hp': 5, 'attack': 7, 'defense': 7, 'special_attack': 4, 'special_defense': 6, 'speed': 5},
            'large': {'hp': 5, 'attack': 7, 'defense': 7, 'special_attack': 4, 'special_defense': 6, 'speed': 5},
            'super': {'hp': 6, 'attack': 7, 'defense': 7, 'special_attack': 4, 'special_defense': 6, 'speed': 4},
        },
        'source_size_range': {
            'height': "1' 0\" - 2' 7\" / 0.3m - 0.8m",
            'weight': '7.7 lbs - 33.1 lbs / 3.5kg - 15kg',
        },
    },
    'gourgeist': {
        'source_page': 438,
        'forms': {
            'small': {'hp': 6, 'attack': 9, 'defense': 12, 'special_attack': 6, 'special_defense': 8, 'speed': 10},
            'average': {'hp': 7, 'attack': 9, 'defense': 12, 'special_attack': 6, 'special_defense': 8, 'speed': 8},
            'large': {'hp': 8, 'attack': 10, 'defense': 12, 'special_attack': 6, 'special_defense': 8, 'speed': 7},
            'super': {'hp': 9, 'attack': 10, 'defense': 12, 'special_attack': 6, 'special_defense': 8, 'speed': 5},
        },
        'source_size_range': {
            'height': "2' 4\" - 5' 7\" / 0.7m - 1.7m",
            'weight': '20.9 lbs - 86 lbs / 9.5kg - 39kg',
        },
    },
}


def slug(value: object) -> str:
    return re.sub(r'[^a-z0-9]+', '-', str(value or '').casefold()).strip('-')


def load_species_rows() -> dict[str, dict]:
    with zipfile.ZipFile(PACK) as archive:
        species_path = next(name for name in archive.namelist() if name.endswith('species.ndjson'))
        rows = [json.loads(line) for line in archive.read(species_path).decode('utf-8').splitlines() if line.strip()]
    return {
        slug(row.get('logical_id') or row.get('id')): row
        for row in rows
        if row.get('logical_id') or row.get('id')
    }


def full_source_overrides(row: dict) -> dict:
    overrides = {}
    for raw_key, stage_key in STRUCTURED_FIELDS:
        value = row.get(raw_key)
        if value is not None:
            overrides[stage_key] = {'replace': copy.deepcopy(value)}
    if not overrides:
        raise SystemExit(f'No structured Form fields found for {row.get("logical_id") or row.get("id")}')
    return overrides


def wormadam_entry(classification: dict, rows: dict[str, dict]) -> dict:
    family = next(row for row in classification['families'] if row['family'] == 'wormadam')
    forms = []
    source_rows = (
        ('wormadam-plant-cloak', 'plant-cloak', 'Plant Cloak', 10),
        ('wormadam-sandy-cloak', 'sandy-cloak', 'Sandy Cloak', 20),
        ('wormadam-trash-cloak', 'trash-cloak', 'Trash Cloak', 30),
    )
    snapshots = []
    for source_id, form_id, name, order in source_rows:
        source = rows.get(source_id)
        if not source:
            raise SystemExit(f'Missing Wormadam source record: {source_id}')
        overrides = full_source_overrides(source)
        forms.append({
            'id': form_id,
            'name': name,
            'mode': 'permanent',
            'overrides': overrides,
            'sortOrder': order,
        })
        snapshots.append({
            'source_id': source_id,
            'source_page': source.get('source_page'),
            'override_fields': sorted(overrides),
        })
    return {
        'family': 'wormadam',
        'classification': family['classification'],
        'target_layer': family['target_layer'],
        'builder': 'source_record_cloak_forms',
        'forms': forms,
        'source_mechanics': {
            'rule_source': 'Pokemon Tabletop United 1.05 Core p.327',
            'record_sources': snapshots,
            'persistence': 'Quick Cloak states that Burmy cloak Typing becomes permanent upon evolution into Wormadam.',
        },
        'note': 'Each Wormadam cloak copies the complete supported structured mechanics from its supplied Gen 8ish Species record, including Type, Base Stats, Ability slots, Capabilities, Skills and Move lists. No cross-cloak mechanics are inferred.',
    }


def size_entry(family_name: str, classification: dict) -> dict:
    family = next(row for row in classification['families'] if row['family'] == family_name)
    source = SIZE_STATS[family_name]
    forms = []
    for order, ident in enumerate(('small', 'average', 'large', 'super'), start=1):
        forms.append({
            'id': ident,
            'name': ident.title(),
            'mode': 'permanent',
            'overrides': {'baseStats': {'replace': copy.deepcopy(source['forms'][ident])}},
            'sortOrder': order * 10,
        })
    return {
        'family': family_name,
        'classification': family['classification'],
        'target_layer': family['target_layer'],
        'builder': 'embedded_size_base_stats',
        'forms': forms,
        'source_mechanics': {
            'source': f'Gen 8ish PokeDex p.{source["source_page"]}',
            'size_labels': ['Small', 'Average', 'Large', 'Super'],
            'source_size_range': source['source_size_range'],
            'size_measurement_status': 'aggregate_range_only',
        },
        'note': 'The supplied PTU page explicitly provides four Base Stat columns. It only provides aggregate height/weight ranges, so no exact per-size height, weight, Weight Class, or size-category override is fabricated.',
    }


def recalculate_summary(payload: dict) -> None:
    candidate_entries = payload.get('candidate_families', [])
    record_entries = [entry for entry in candidate_entries if entry.get('builder') == 'parameterized_species_record']
    rule_entries = [entry for entry in candidate_entries if entry.get('builder') != 'parameterized_species_record']
    payload['summary']['candidate_family_entries'] = len(candidate_entries)
    payload['summary']['record_backed_family_entries'] = len(record_entries)
    payload['summary']['rule_defined_family_entries'] = len(rule_entries)
    payload['summary']['candidate_forms'] = sum(len(entry.get('forms', [])) for entry in candidate_entries)
    payload['summary']['record_backed_forms'] = sum(len(entry.get('forms', [])) for entry in record_entries)
    payload['summary']['rule_defined_forms'] = sum(len(entry.get('forms', [])) for entry in rule_entries)
    payload['summary']['omitted_or_deferred_family_entries'] = len(payload.get('not_materialized', []))


def render_markdown(payload: dict) -> str:
    summary = payload['summary']
    builder_entries = [entry for entry in payload.get('candidate_families', []) if entry.get('builder') != 'parameterized_species_record']
    lines = [
        '# PTU Stage B Forms Catalog', '',
        'Generated deterministically from the versioned PTU classification/inventory. This catalog is intentionally **not applied to the bundled/default packs** while source-insufficient families remain.', '',
        '## Summary', '',
        f'- Candidate-family form entries: **{summary["candidate_family_entries"]}**',
        f'- Record-backed family entries: **{summary["record_backed_family_entries"]}**',
        f'- Rule-defined family entries: **{summary["rule_defined_family_entries"]}**',
        f'- Candidate-record/derived Stage B forms emitted: **{summary["candidate_forms"]}**',
        f'- Record-backed forms: **{summary["record_backed_forms"]}**',
        f'- Rule-defined forms: **{summary["rule_defined_forms"]}**',
        f'- Synthetic Stage B transforms emitted: **{summary["synthetic_forms"]}**',
        f'- Mega transforms: **{summary["mega_forms"]}**',
        f'- Primal transforms: **{summary["primal_forms"]}**',
        f'- Ultra Burst transforms: **{summary["ultra_burst_forms"]}**',
        f'- Families not directly materialized: **{summary["omitted_or_deferred_family_entries"]}**', '',
        '## Safety gates', '',
        '- Every emitted `forms[]` entry uses Stage B mode `permanent` or `transformation`.',
        '- Source-insufficient/event-driven requirements use Stage B `manual` review gates instead of guessed items/conditions.',
        '- No artwork URL is generated. Artwork remains governed by the separate asset audit and the existing Stage B fallback.',
        '- Rule-defined Ability builders clone source Ability-slot arrays rather than inventing slot placement.',
        '- Wormadam cloak Forms copy complete supported structured mechanics from their supplied Species records.',
        '- Pumpkaboo/Gourgeist size Forms copy only their explicit Base Stat matrices; exact per-size measurements are not fabricated from source ranges.',
        '- No `.ptucp` file is written by this generator.', '',
        '## Rule-defined builders', ''
    ]
    for entry in sorted(builder_entries, key=lambda row: row['family']):
        labels = ', '.join(form['name'] for form in entry['forms'])
        lines.append(f'- `{entry["family"]}` / `{entry["builder"]}` — {labels}')
    lines += ['', '## Synthetic transformations', '']
    for entry in payload.get('synthetic_transform_species', []):
        labels = ', '.join(form['name'] for form in entry['forms'])
        lines.append(f'- `{entry["species_id"]}` / `{entry["source_family"]}` — {labels}')
    lines += ['', '## Not directly materialized', '']
    for entry in payload.get('not_materialized', []):
        lines.append(f'- `{entry["family"]}` ({entry["classification"]}) — {entry["reason"]}')
    return '\n'.join(lines) + '\n'


def main() -> None:
    classification = json.loads(CLASSIFICATION.read_text(encoding='utf-8'))
    payload = json.loads(STAGE_B.read_text(encoding='utf-8'))
    rows = load_species_rows()

    replacements = {
        'wormadam': wormadam_entry(classification, rows),
        'pumpkaboo': size_entry('pumpkaboo', classification),
        'gourgeist': size_entry('gourgeist', classification),
    }
    replaced = [entry for entry in payload.get('candidate_families', []) if entry.get('family') not in replacements]
    replaced.extend(replacements.values())
    payload['candidate_families'] = sorted(replaced, key=lambda entry: entry['family'])
    payload['not_materialized'] = [entry for entry in payload.get('not_materialized', []) if entry.get('family') not in replacements]
    payload['schema_version'] = 4
    recalculate_summary(payload)

    summary = payload['summary']
    expected = {
        'candidate_family_entries': 43,
        'record_backed_family_entries': 32,
        'rule_defined_family_entries': 11,
        'candidate_forms': 67,
        'record_backed_forms': 37,
        'rule_defined_forms': 30,
        'omitted_or_deferred_family_entries': 26,
    }
    for key, value in expected.items():
        if summary.get(key) != value:
            raise SystemExit(f'Unexpected Stage B summary after embedded permanent augmentation: {key}={summary.get(key)} expected {value}')

    STAGE_B.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    STAGE_B_MD.write_text(render_markdown(payload), encoding='utf-8')
    print(json.dumps({**expected, 'schema_version': payload['schema_version']}, sort_keys=True))


if __name__ == '__main__':
    main()
