#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
DATA = REPO / 'docs' / 'data'
CLASSIFICATION = DATA / 'PTU_FORMS_CLASSIFICATION.json'
STAGE_B = DATA / 'PTU_FORMS_STAGE_B.json'
ASSETS = DATA / 'PTU_FORM_ASSET_AUDIT.json'
EXPECTED_MIXED = {'darmanitan', 'necrozma', 'zacian', 'zamazenta', 'zygarde'}
EXPECTED_DEFERRED = {'deoxys', 'giratina', 'hoopa', 'kyurem', 'landorus', 'oricorio', 'rotom', 'shaymin', 'thundurus', 'tornadus'}


def slug(value: object) -> str:
    return re.sub(r'[^a-z0-9]+', '-', str(value or '').casefold()).strip('-')


def has_manual_gate(form: dict) -> bool:
    reqs = form.get('requirements', {}).get('all', [])
    return any(req.get('kind') == 'manual' for req in reqs)


def assert_full_source_form(form: dict) -> None:
    fields = set(form.get('overrides', {}))
    assert {'types', 'baseStats', 'abilities', 'capabilities', 'skills', 'levelUpMoves', 'tmMoves', 'tutorMoves'} <= fields, (form['id'], fields)


def main() -> None:
    classification = json.loads(CLASSIFICATION.read_text(encoding='utf-8'))
    stage_b = json.loads(STAGE_B.read_text(encoding='utf-8'))
    assets = json.loads(ASSETS.read_text(encoding='utf-8'))

    families = {row['family']: row for row in classification['families']}
    assert {name for name, row in families.items() if row['classification'] == 'mixed'} == EXPECTED_MIXED
    assert set(classification['summary']['deferred_families']) == EXPECTED_DEFERRED
    for family in EXPECTED_MIXED:
        assert families[family]['target_layer'] == 'baseFormId+activeFormId', families[family]

    assert stage_b['schema_version'] in {5, 6}
    requirement_v2 = stage_b['schema_version'] >= 6
    if requirement_v2:
        assert stage_b.get('requirement_model_version') == 2
    assert stage_b['stage_b_form_schema_version'] == 1
    assert stage_b['applied_to_default_packs'] is False
    summary = stage_b['summary']
    expected_summary = {
        'candidate_family_entries': 48,
        'record_backed_family_entries': 32,
        'rule_defined_family_entries': 16,
        'candidate_forms': 82,
        'record_backed_forms': 37,
        'rule_defined_forms': 45,
        'omitted_or_deferred_family_entries': 21,
        'synthetic_species_entries': 48,
        'synthetic_forms': 50,
        'mega_forms': 48,
        'primal_forms': 2,
        'ultra_burst_forms': 0,
        'ultra_burst_source_blocks': 2,
        'composed_ultra_burst_forms': 1,
    }
    for key, value in expected_summary.items():
        assert summary.get(key) == value, (key, summary.get(key), value)
    if requirement_v2:
        assert summary.get('structured_runtime_requirement_forms') == 8

    entries = {row['family']: row for row in stage_b['candidate_families']}
    assert EXPECTED_MIXED <= set(entries)
    assert not (EXPECTED_MIXED & {row['family'] for row in stage_b.get('not_materialized', [])})
    assert EXPECTED_DEFERRED <= {row['family'] for row in stage_b.get('not_materialized', [])}

    # Darmanitan: two persistent bases + matching active Zen overlays.
    darmanitan = entries['darmanitan']
    assert darmanitan['builder'] == 'mixed_darmanitan_standard_zen'
    dforms = {form['id']: form for form in darmanitan['forms']}
    assert set(dforms) == {'standard-mode', 'galar-standard-mode', 'zen-mode', 'galar-zen-mode'}
    assert dforms['standard-mode']['mode'] == 'permanent'
    assert dforms['galar-standard-mode']['mode'] == 'permanent'
    assert dforms['zen-mode']['mode'] == 'transformation'
    assert dforms['galar-zen-mode']['mode'] == 'transformation'
    assert dforms['zen-mode']['compatible_base_forms'] == ['standard-mode']
    assert dforms['galar-zen-mode']['compatible_base_forms'] == ['galar-standard-mode']
    assert has_manual_gate(dforms['zen-mode']) and has_manual_gate(dforms['galar-zen-mode'])
    assert dforms['zen-mode']['overrides']['types']['replace'] == ['Fire', 'Psychic']
    assert dforms['galar-zen-mode']['overrides']['types']['replace'] == ['Ice', 'Fire']
    assert darmanitan['source_mechanics']['regular_zen_mode']['activation_status'] == 'conflicting_supplied_activation_rules_preserved_for_review'
    for form in dforms.values():
        assert_full_source_form(form)

    # Necrozma: two persistent fusion bases + one shared Ultra active overlay.
    necrozma = entries['necrozma']
    assert necrozma['builder'] == 'mixed_necrozma_fusion_ultra_burst'
    nforms = {form['id']: form for form in necrozma['forms']}
    assert set(nforms) == {'dusk-mane', 'dawn-wings', 'ultra-burst'}
    assert nforms['dusk-mane']['mode'] == 'permanent'
    assert nforms['dawn-wings']['mode'] == 'permanent'
    ultra = nforms['ultra-burst']
    assert ultra['mode'] == 'transformation'
    assert ultra['compatible_base_forms'] == ['dusk-mane', 'dawn-wings']
    assert has_manual_gate(ultra)
    assert ultra['overrides']['types']['replace'] == ['Psychic', 'Dragon']
    assert ultra['overrides']['baseStats']['replace'] == {
        'hp': 10, 'attack': 17, 'defense': 10,
        'special_attack': 17, 'special_defense': 10, 'speed': 13,
    }
    mechanics = necrozma['source_mechanics']['ultra_burst']
    assert mechanics['activation_status'] == 'source_insufficient'
    assert mechanics['common_effects']['ability'] == 'Neuroforce'
    assert mechanics['common_effects']['advanced_ability_1_becomes'] == 'Illuminate'
    assert mechanics['common_effects']['gains_capability'] == 'Glow'
    assert mechanics['source_deltas']['dusk-mane'] == {'attack': 1, 'defense': -3, 'special_attack': 6, 'special_defense': -1, 'speed': 5}
    assert mechanics['source_deltas']['dawn-wings'] == {'attack': 6, 'defense': -1, 'special_attack': 1, 'special_defense': -3, 'speed': 5}
    assert_full_source_form(nforms['dusk-mane'])
    assert_full_source_form(nforms['dawn-wings'])

    # Weapon Bond: Hero base + Crowned active, with exact source move/end metadata.
    for family, form_id, types, move, item in (
        ('zacian', 'crowned-sword', ['Fairy', 'Steel'], 'Behemoth Blade', 'Ancestral Sword'),
        ('zamazenta', 'crowned-shield', ['Fighting', 'Steel'], 'Behemoth Bash', 'Ancestral Shield'),
    ):
        entry = entries[family]
        assert entry['builder'] == 'mixed_weapon_bond'
        forms = {form['id']: form for form in entry['forms']}
        assert set(forms) == {'hero-of-many-battles', form_id}
        assert forms['hero-of-many-battles']['mode'] == 'permanent'
        assert forms[form_id]['mode'] == 'transformation'
        assert forms[form_id]['compatible_base_forms'] == ['hero-of-many-battles']
        assert forms[form_id]['overrides']['types']['replace'] == types
        if requirement_v2:
            assert not has_manual_gate(forms[form_id])
            assert forms[form_id]['requirements']['all'] == [{'kind': 'capability', 'value': 'Weapon Bond'}]
            assert forms[form_id]['activation_requirements']['all'] == [{'kind': 'trigger_item', 'value': item}]
        else:
            assert has_manual_gate(forms[form_id])
        assert entry['source_mechanics']['granted_move'] == move
        assert 'Fainted' in entry['source_mechanics']['exit']
        assert 'Extended Action' in entry['source_mechanics']['enter']
        assert_full_source_form(forms['hero-of-many-battles'])
        assert_full_source_form(forms[form_id])

    # Zygarde: persistent 10/50 bases + contextual Complete overlays that do not replace HP.
    zygarde = entries['zygarde']
    assert zygarde['builder'] == 'mixed_zygarde_cells_power_construct'
    zforms = {form['id']: form for form in zygarde['forms']}
    assert set(zforms) == {'10-percent', '50-percent', 'complete-from-10-percent', 'complete-from-50-percent'}
    assert zforms['10-percent']['mode'] == 'permanent'
    assert zforms['50-percent']['mode'] == 'permanent'
    assert_full_source_form(zforms['10-percent'])
    assert_full_source_form(zforms['50-percent'])
    ten_complete = zforms['complete-from-10-percent']
    fifty_complete = zforms['complete-from-50-percent']
    assert ten_complete['compatible_base_forms'] == ['10-percent']
    assert fifty_complete['compatible_base_forms'] == ['50-percent']
    if requirement_v2:
        for form in (ten_complete, fifty_complete):
            assert not has_manual_gate(form)
            assert form['requirements']['all'] == [{'kind': 'ability', 'value': 'Power Construct'}]
            assert form['activation_requirements']['all'] == [{'kind': 'hp_fraction_lt', 'value': 0.5}]
    else:
        assert has_manual_gate(ten_complete) and has_manual_gate(fifty_complete)
    assert ten_complete['overrides']['baseStats']['add'] == {'defense': 5, 'special_attack': 3, 'special_defense': 1, 'speed': -3}
    assert fifty_complete['overrides']['baseStats']['add'] == {'special_attack': 1, 'speed': -1}
    assert 'hp' not in ten_complete['overrides']['baseStats']['add']
    assert 'hp' not in fifty_complete['overrides']['baseStats']['add']
    assert zygarde['source_mechanics']['power_construct']['action'] == 'Daily - Swift Action while below 50% HP.'
    assert 'HP total and HP Maximum' in zygarde['source_mechanics']['power_construct']['hp_invariant']

    # Ultra Burst must no longer exist in the synthetic section.
    synthetic = stage_b.get('synthetic_transform_species', [])
    assert not [entry for entry in synthetic if entry.get('source_family') == 'ultra-burst']
    mega_entries = [entry for entry in synthetic if entry.get('source_family') == 'mega-evolution']
    primal_entries = [entry for entry in synthetic if entry.get('source_family') == 'primal-reversion']
    assert sum(len(entry.get('forms', [])) for entry in mega_entries) == 48
    assert sum(len(entry.get('forms', [])) for entry in primal_entries) == 2
    mega_by_species = {entry['species_id']: entry for entry in mega_entries}
    assert {form['id'] for form in mega_by_species['charizard']['forms']} == {'mega-x', 'mega-y'}
    assert {form['id'] for form in mega_by_species['mewtwo']['forms']} == {'mega-x', 'mega-y'}

    text = STAGE_B.read_text(encoding='utf-8')
    assert 'http://' not in text and 'https://' not in text
    assert assets['policy']['invent_urls'] is False

    print(json.dumps({
        'mixed_families': len(EXPECTED_MIXED),
        'catalog_schema_version': stage_b['schema_version'],
        'requirement_model_version': stage_b.get('requirement_model_version'),
        'candidate_family_entries': summary['candidate_family_entries'],
        'candidate_forms': summary['candidate_forms'],
        'rule_defined_forms': summary['rule_defined_forms'],
        'synthetic_forms': summary['synthetic_forms'],
        'synthetic_ultra_burst_forms': summary['ultra_burst_forms'],
        'composed_ultra_burst_forms': summary['composed_ultra_burst_forms'],
        'deferred_families': len(EXPECTED_DEFERRED),
    }, sort_keys=True))


if __name__ == '__main__':
    main()
