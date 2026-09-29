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
EXPECTED_CLASS_COUNTS = {
    'permanent': 36,
    'persistent_form': 2,
    'transformation': 5,
    'runtime_state': 6,
    'mixed': 5,
    'defer': 10,
    'false_positive': 5,
}
SIZE_SIGNAL = 'embedded_size_forms:small,average,large,super'


def slug(value: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', str(value or '').casefold()).strip('-')


def all_forms(stage_b: dict):
    for entry in stage_b.get('candidate_families', []):
        for form in entry.get('forms', []):
            yield ('candidate', entry.get('family'), form)
    for entry in stage_b.get('synthetic_transform_species', []):
        for form in entry.get('forms', []):
            yield (entry.get('source_family'), entry.get('species_id'), form)


def form_ability_ids(form: dict) -> set[str]:
    slots = form.get('overrides', {}).get('abilities', {}).get('replace', [])
    result = set()
    for slot in slots:
        if isinstance(slot, dict):
            result.add(slug(slot.get('ability_id') or slot.get('name')))
        else:
            result.add(slug(slot))
    return {value for value in result if value}


def has_manual_gate(form: dict) -> bool:
    reqs = form.get('requirements', {}).get('all', [])
    return any(req.get('kind') == 'manual' for req in reqs)


def assert_stats(form: dict, expected: dict) -> None:
    assert form['overrides']['baseStats']['replace'] == expected, form


def main() -> None:
    classification = json.loads(CLASSIFICATION.read_text(encoding='utf-8'))
    inventory = json.loads(INVENTORY.read_text(encoding='utf-8'))
    assets = json.loads(ASSETS.read_text(encoding='utf-8'))
    stage_b = json.loads(STAGE_B.read_text(encoding='utf-8'))

    summary = classification['summary']
    assert summary['candidate_records'] == 106, summary
    assert summary['candidate_families'] == 69, summary
    assert summary['classification_counts'] == EXPECTED_CLASS_COUNTS, summary['classification_counts']
    assert set(summary['deferred_families']) == EXPECTED_DEFERRED, summary['deferred_families']
    assert set(summary['false_positive_families']) == EXPECTED_FALSE_POSITIVES, summary['false_positive_families']
    assert summary['supplemental_rules'] == 17, summary['supplemental_rules']

    families = {row['family']: row for row in classification['families']}
    assert families['mimikyu']['classification'] == 'false_positive'
    assert families['mimikyu']['evidence_status'] == 'source_explicit_non_form'
    for family in ('deerling', 'sawsbuck'):
        assert families[family]['classification'] == 'runtime_state', families[family]
        assert families[family]['target_layer'] == 'runtime_resolver', families[family]
    for family in ('pumpkaboo', 'gourgeist'):
        assert families[family]['classification'] == 'permanent', families[family]
        assert families[family]['target_layer'] == 'baseFormId', families[family]
        assert SIZE_SIGNAL in families[family]['signals'], families[family]
        assert families[family]['evidence_status'] == 'source_explicit_variant', families[family]

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
    assert stage_b['schema_version'] == 4
    stage_summary = stage_b['summary']
    assert stage_summary['candidate_family_entries'] == 43, stage_summary
    assert stage_summary['record_backed_family_entries'] == 32, stage_summary
    assert stage_summary['rule_defined_family_entries'] == 11, stage_summary
    assert stage_summary['candidate_forms'] == 67, stage_summary
    assert stage_summary['record_backed_forms'] == 37, stage_summary
    assert stage_summary['rule_defined_forms'] == 30, stage_summary
    assert stage_summary['omitted_or_deferred_family_entries'] == 26, stage_summary
    assert stage_summary['mega_forms'] == 48
    assert stage_summary['primal_forms'] == 2
    assert stage_summary['ultra_burst_forms'] == 2
    assert stage_summary['synthetic_forms'] == 52

    candidate_entries = {row['family']: row for row in stage_b.get('candidate_families', [])}
    emitted_candidates = set(candidate_entries)
    unsafe = {
        row['family'] for row in classification['families']
        if row['classification'] in {'defer', 'false_positive', 'runtime_state', 'mixed'}
    }
    assert not (emitted_candidates & unsafe), sorted(emitted_candidates & unsafe)
    assert not ({'deerling', 'sawsbuck'} & emitted_candidates)

    for source, owner, form in all_forms(stage_b):
        assert form['mode'] in {'permanent', 'transformation'}, (source, owner, form)
        assert form['id'] and form['id'] != 'base', (source, owner, form)
        assert isinstance(form.get('overrides'), dict), (source, owner, form)
        if source in {'mega-evolution', 'primal-reversion', 'ultra-burst'}:
            assert form['mode'] == 'transformation'
            assert has_manual_gate(form), (source, owner, form)

    # First source-defined builder pass.
    aegislash = candidate_entries['aegislash']
    assert aegislash['builder'] == 'rule_defined_stance_change'
    assert len(aegislash['forms']) == 1
    sword = aegislash['forms'][0]
    assert sword['id'] == 'sword-stance' and sword['mode'] == 'transformation'
    assert_stats(sword, {
        'hp': 6, 'attack': 15, 'defense': 5,
        'special_attack': 15, 'special_defense': 5, 'speed': 6,
    })
    assert has_manual_gate(sword)

    burmy = candidate_entries['burmy']
    assert burmy['builder'] == 'rule_defined_quick_cloak'
    burmy_forms = {form['id']: form for form in burmy['forms']}
    assert set(burmy_forms) == {'plant-cloak', 'sandy-cloak', 'trash-cloak'}
    assert burmy_forms['plant-cloak']['overrides']['types']['replace'] == ['Bug', 'Grass']
    assert burmy_forms['sandy-cloak']['overrides']['types']['replace'] == ['Bug', 'Ground']
    assert burmy_forms['trash-cloak']['overrides']['types']['replace'] == ['Bug', 'Steel']
    assert all(form['mode'] == 'permanent' for form in burmy_forms.values())

    furfrou = candidate_entries['furfrou']
    assert furfrou['builder'] == 'rule_defined_fabulous_trim'
    furfrou_expected = {
        'star-trim': 'celebrate',
        'diamond-trim': 'defiant',
        'heart-trim': 'cute-tears',
        'pharaoh-trim': 'sand-veil',
        'kabuki-trim': 'inner-focus',
        'la-reine-trim': 'intimidate',
        'matron-trim': 'friend-guard',
        'dandy-trim': 'moxie',
        'debutante-trim': 'confidence',
    }
    furfrou_forms = {form['id']: form for form in furfrou['forms']}
    assert set(furfrou_forms) == set(furfrou_expected)
    for ident, ability_id in furfrou_expected.items():
        abilities = form_ability_ids(furfrou_forms[ident])
        assert ability_id in abilities, (ident, abilities)
        assert 'fabulous-trim' not in abilities, (ident, abilities)

    basculin = candidate_entries['basculin']
    assert basculin['builder'] == 'embedded_color_ability_variant'
    basculin_forms = {form['id']: form for form in basculin['forms']}
    assert set(basculin_forms) == {'red', 'blue'}
    assert 'reckless' in form_ability_ids(basculin_forms['red'])
    assert 'rock-head' in form_ability_ids(basculin_forms['blue'])

    # Second source-defined transformation pass.
    wishiwashi = candidate_entries['wishiwashi']
    assert wishiwashi['builder'] == 'rule_defined_schooling'
    schooling = wishiwashi['forms'][0]
    assert schooling['id'] == 'schooling' and schooling['mode'] == 'transformation'
    assert_stats(schooling, {
        'hp': 5, 'attack': 14, 'defense': 13,
        'special_attack': 14, 'special_defense': 14, 'speed': 3,
    })
    assert {'baseStats', 'capabilities', 'skills'} <= set(schooling['overrides'])
    assert has_manual_gate(schooling)

    minior = candidate_entries['minior']
    assert minior['builder'] == 'rule_defined_shields_down'
    core = minior['forms'][0]
    assert core['id'] == 'core' and core['mode'] == 'transformation'
    assert_stats(core, {
        'hp': 6, 'attack': 10, 'defense': 6,
        'special_attack': 10, 'special_defense': 6, 'speed': 12,
    })
    assert {'baseStats', 'capabilities', 'skills'} <= set(core['overrides'])
    assert has_manual_gate(core)

    eiscue = candidate_entries['eiscue']
    assert eiscue['builder'] == 'rule_defined_ice_face'
    noice = eiscue['forms'][0]
    assert noice['id'] == 'noice-face' and noice['mode'] == 'transformation'
    assert_stats(noice, {
        'hp': 8, 'attack': 8, 'defense': 7,
        'special_attack': 7, 'special_defense': 5, 'speed': 13,
    })
    assert 'capabilities' in noice['overrides']
    assert has_manual_gate(noice)

    meloetta = candidate_entries['meloetta']
    assert meloetta['builder'] == 'rule_defined_relic_song'
    step = meloetta['forms'][0]
    assert step['id'] == 'step-forme' and step['mode'] == 'transformation'
    assert step['overrides']['types']['replace'] == ['Normal', 'Fighting']
    assert_stats(step, {
        'hp': 10, 'attack': 13, 'defense': 9,
        'special_attack': 8, 'special_defense': 8, 'speed': 13,
    })
    step_abilities = form_ability_ids(step)
    assert 'spinning-dance' in step_abilities and 'drown-out' not in step_abilities, step_abilities
    assert 'skills' in step['overrides']
    assert has_manual_gate(step)

    # Permanent embedded/source-record pass.
    wormadam = candidate_entries['wormadam']
    assert wormadam['builder'] == 'source_record_cloak_forms'
    wormadam_forms = {form['id']: form for form in wormadam['forms']}
    assert set(wormadam_forms) == {'plant-cloak', 'sandy-cloak', 'trash-cloak'}
    wormadam_expected = {
        'plant-cloak': (['Bug', 'Grass'], {'hp': 6, 'attack': 6, 'defense': 9, 'special_attack': 8, 'special_defense': 11, 'speed': 4}, 'grass-pelt'),
        'sandy-cloak': (['Bug', 'Ground'], {'hp': 6, 'attack': 8, 'defense': 11, 'special_attack': 6, 'special_defense': 9, 'speed': 4}, 'sand-veil'),
        'trash-cloak': (['Bug', 'Steel'], {'hp': 6, 'attack': 7, 'defense': 10, 'special_attack': 7, 'special_defense': 10, 'speed': 4}, 'clear-body'),
    }
    for ident, (types, stats, high_ability) in wormadam_expected.items():
        form = wormadam_forms[ident]
        assert form['mode'] == 'permanent'
        assert form['overrides']['types']['replace'] == types
        assert_stats(form, stats)
        assert high_ability in form_ability_ids(form), (ident, form_ability_ids(form))
        assert {'capabilities', 'skills', 'levelUpMoves', 'tmMoves', 'tutorMoves'} <= set(form['overrides']), (ident, form['overrides'].keys())

    pumpkaboo = candidate_entries['pumpkaboo']
    gourgeist = candidate_entries['gourgeist']
    assert pumpkaboo['builder'] == 'embedded_size_base_stats'
    assert gourgeist['builder'] == 'embedded_size_base_stats'
    pump_forms = {form['id']: form for form in pumpkaboo['forms']}
    gour_forms = {form['id']: form for form in gourgeist['forms']}
    assert set(pump_forms) == {'small', 'average', 'large', 'super'}
    assert set(gour_forms) == {'small', 'average', 'large', 'super'}
    pump_expected = {
        'small': {'hp': 4, 'attack': 7, 'defense': 7, 'special_attack': 4, 'special_defense': 6, 'speed': 6},
        'average': {'hp': 5, 'attack': 7, 'defense': 7, 'special_attack': 4, 'special_defense': 6, 'speed': 5},
        'large': {'hp': 5, 'attack': 7, 'defense': 7, 'special_attack': 4, 'special_defense': 6, 'speed': 5},
        'super': {'hp': 6, 'attack': 7, 'defense': 7, 'special_attack': 4, 'special_defense': 6, 'speed': 4},
    }
    gour_expected = {
        'small': {'hp': 6, 'attack': 9, 'defense': 12, 'special_attack': 6, 'special_defense': 8, 'speed': 10},
        'average': {'hp': 7, 'attack': 9, 'defense': 12, 'special_attack': 6, 'special_defense': 8, 'speed': 8},
        'large': {'hp': 8, 'attack': 10, 'defense': 12, 'special_attack': 6, 'special_defense': 8, 'speed': 7},
        'super': {'hp': 9, 'attack': 10, 'defense': 12, 'special_attack': 6, 'special_defense': 8, 'speed': 5},
    }
    for ident, stats in pump_expected.items():
        assert_stats(pump_forms[ident], stats)
        assert set(pump_forms[ident]['overrides']) == {'baseStats'}, pump_forms[ident]
    for ident, stats in gour_expected.items():
        assert_stats(gour_forms[ident], stats)
        assert set(gour_forms[ident]['overrides']) == {'baseStats'}, gour_forms[ident]
    assert pumpkaboo['source_mechanics']['size_measurement_status'] == 'aggregate_range_only'
    assert gourgeist['source_mechanics']['size_measurement_status'] == 'aggregate_range_only'

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
        'permanent': EXPECTED_CLASS_COUNTS['permanent'],
        'runtime_states': EXPECTED_CLASS_COUNTS['runtime_state'],
        'rule_defined_forms': stage_summary['rule_defined_forms'],
        'candidate_forms': stage_summary['candidate_forms'],
        'mega_forms': len(mega),
        'mega_species': len(mega_entries),
        'primal_forms': len(primal),
        'ultra_burst_forms': len(ultra),
        'stage_b_synthetic_forms': stage_summary['synthetic_forms'],
    }, sort_keys=True))


if __name__ == '__main__':
    main()
