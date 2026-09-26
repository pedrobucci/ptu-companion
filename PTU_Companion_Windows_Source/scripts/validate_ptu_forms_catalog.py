#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
DATA = REPO / 'docs' / 'data'
CLASSIFICATION = DATA / 'PTU_FORMS_CLASSIFICATION.json'
INVENTORY = DATA / 'PTU_FORMS_INVENTORY.json'
ASSETS = DATA / 'PTU_FORM_ASSET_AUDIT.json'
STAGE_B = DATA / 'PTU_FORMS_STAGE_B.json'
EXPECTED_DEFERRED = {'deoxys', 'giratina', 'hoopa', 'kyurem', 'landorus', 'oricorio', 'rotom', 'shaymin', 'thundurus', 'tornadus'}
EXPECTED_FALSE_POSITIVES = {'cramorant', 'mimikyu', 'nidoran-f', 'nidoran-m', 'solosis'}


def slug(value: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', str(value or '').casefold()).strip('-')


def all_forms(stage_b: dict):
    for entry in stage_b.get('candidate_families', []):
        for form in entry.get('forms', []):
            yield ('candidate', entry.get('family'), form)
    for entry in stage_b.get('synthetic_transform_species', []):
        for form in entry.get('forms', []):
            yield (entry.get('source_family'), entry.get('species_id'), form)


def main() -> None:
    classification = json.loads(CLASSIFICATION.read_text(encoding='utf-8'))
    inventory = json.loads(INVENTORY.read_text(encoding='utf-8'))
    assets = json.loads(ASSETS.read_text(encoding='utf-8'))
    stage_b = json.loads(STAGE_B.read_text(encoding='utf-8'))

    summary = classification['summary']
    assert summary['candidate_records'] == 104, summary
    assert summary['candidate_families'] == 67, summary
    assert summary['classification_counts']['defer'] == 10, summary
    assert summary['classification_counts']['false_positive'] == 5, summary
    assert set(summary['deferred_families']) == EXPECTED_DEFERRED, summary['deferred_families']
    assert set(summary['false_positive_families']) == EXPECTED_FALSE_POSITIVES, summary['false_positive_families']

    families = {row['family']: row for row in classification['families']}
    assert families['mimikyu']['classification'] == 'false_positive'
    assert families['mimikyu']['evidence_status'] == 'source_explicit_non_form'

    mega = inventory.get('mega_forms', [])
    primal = inventory.get('primal_forms', [])
    ultra = inventory.get('ultra_burst_forms', [])
    assert len(mega) == 48
    assert len({slug(row['species']['name']) for row in mega}) == 46
    assert len(primal) == 2
    assert {slug(row['species']['name']) for row in primal} == {'groudon', 'kyogre'}
    assert len(ultra) == 2

    assert stage_b['applied_to_default_packs'] is False
    assert stage_b['stage_b_form_schema_version'] == 1
    assert stage_b['summary']['mega_forms'] == 48
    assert stage_b['summary']['primal_forms'] == 2
    assert stage_b['summary']['ultra_burst_forms'] == 2
    assert stage_b['summary']['synthetic_forms'] == 52

    emitted_candidates = {row['family'] for row in stage_b.get('candidate_families', [])}
    unsafe = {
        row['family'] for row in classification['families']
        if row['classification'] in {'defer', 'false_positive', 'runtime_state', 'mixed'}
    }
    assert not (emitted_candidates & unsafe), sorted(emitted_candidates & unsafe)

    for source, owner, form in all_forms(stage_b):
        assert form['mode'] in {'permanent', 'transformation'}, (source, owner, form)
        assert form['id'] and form['id'] != 'base', (source, owner, form)
        assert isinstance(form.get('overrides'), dict), (source, owner, form)
        if source in {'mega-evolution', 'primal-reversion', 'ultra-burst'}:
            assert form['mode'] == 'transformation'
            reqs = form.get('requirements', {}).get('all', [])
            assert any(req.get('kind') == 'manual' for req in reqs), (source, owner, form)

    synthetic = stage_b.get('synthetic_transform_species', [])
    mega_entries = {row['species_id']: row for row in synthetic if row['source_family'] == 'mega-evolution'}
    assert {'charizard', 'mewtwo'} <= set(mega_entries)
    assert {form['id'] for form in mega_entries['charizard']['forms']} == {'mega-x', 'mega-y'}
    assert {form['id'] for form in mega_entries['mewtwo']['forms']} == {'mega-x', 'mega-y'}
    assert sum(len(row['forms']) for row in mega_entries.values()) == 48

    primal_entries = {row['species_id']: row for row in synthetic if row['source_family'] == 'primal-reversion'}
    assert set(primal_entries) == {'groudon', 'kyogre'}
    assert all({form['id'] for form in row['forms']} == {'primal'} for row in primal_entries.values())

    stage_b_text = STAGE_B.read_text(encoding='utf-8')
    assert 'http://' not in stage_b_text and 'https://' not in stage_b_text, 'Stage B catalog must not invent or embed remote artwork URLs'
    assert assets['policy']['invent_urls'] is False
    for row in assets.get('candidate_asset_matches', []):
        assert not re.match(r'^https?://', row['path'], re.I), row

    print(json.dumps({
        'candidate_records': summary['candidate_records'],
        'candidate_families': summary['candidate_families'],
        'deferred': len(EXPECTED_DEFERRED),
        'false_positive': len(EXPECTED_FALSE_POSITIVES),
        'mega_forms': len(mega),
        'mega_species': len(mega_entries),
        'primal_forms': len(primal),
        'ultra_burst_forms': len(ultra),
        'stage_b_synthetic_forms': stage_b['summary']['synthetic_forms'],
    }, sort_keys=True))


if __name__ == '__main__':
    main()
