#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
STAGE_B = REPO / 'docs' / 'data' / 'PTU_FORMS_STAGE_B.json'
STAGE_B_MD = REPO / 'docs' / 'PTU_FORMS_STAGE_B.md'


def family_entry(payload: dict, family: str) -> dict:
    entry = next((row for row in payload.get('candidate_families', []) if row.get('family') == family), None)
    if not entry:
        raise SystemExit(f'Missing Stage B family: {family}')
    return entry


def form_entry(entry: dict, form_id: str) -> dict:
    form = next((row for row in entry.get('forms', []) if row.get('id') == form_id), None)
    if not form:
        raise SystemExit(f'Missing Stage B form {entry.get("family")}:{form_id}')
    return form


def clear_review_gate(form: dict) -> None:
    requirement = form.get('requirements')
    if requirement is None:
        return
    leaves = requirement.get('all') if isinstance(requirement, dict) else None
    if isinstance(leaves, list) and leaves and all(isinstance(row, dict) and row.get('kind') == 'manual' for row in leaves):
        form.pop('requirements', None)
        return
    # Idempotent reruns may already contain the structured requirement produced by this overlay.
    # The deterministic assignments below will rewrite those fields to the canonical values.
    if manual_leaf_count(requirement) == 0:
        return
    raise SystemExit(f'Unexpected mixed manual/structured requirement before upgrade: {form.get("id")} -> {requirement}')


def manual_leaf_count(value: object) -> int:
    if isinstance(value, list):
        return sum(manual_leaf_count(row) for row in value)
    if not isinstance(value, dict):
        return 0
    count = 1 if value.get('kind') == 'manual' else 0
    return count + sum(manual_leaf_count(row) for row in value.values())


def main() -> None:
    payload = json.loads(STAGE_B.read_text(encoding='utf-8'))
    if int(payload.get('schema_version', 0)) < 5:
        raise SystemExit('Runtime requirements pass expects the schema-v5 mixed catalog or newer')

    wishiwashi = form_entry(family_entry(payload, 'wishiwashi'), 'schooling')
    clear_review_gate(wishiwashi)
    wishiwashi['requirements'] = {'all': [{'kind': 'ability', 'value': 'Schooling'}]}
    wishiwashi['persistence_requirements'] = {
        'not': {'all': [
            {'kind': 'hp_fraction_lt', 'value': 0.5},
            {'kind': 'temp_hp_lte', 'value': 0},
        ]}
    }

    minior = form_entry(family_entry(payload, 'minior'), 'core')
    clear_review_gate(minior)
    minior['requirements'] = {'all': [{'kind': 'ability', 'value': 'Shields Down'}]}
    minior['activation_requirements'] = {'all': [{'kind': 'hp_fraction_lte', 'value': 0.5}]}
    minior['persistence_requirements'] = {
        'any': [
            {'kind': 'in_combat', 'value': True},
            {'kind': 'hp_fraction_lte', 'value': 0.5},
        ]
    }

    eiscue = form_entry(family_entry(payload, 'eiscue'), 'noice-face')
    clear_review_gate(eiscue)
    eiscue['requirements'] = {'all': [
        {'kind': 'ability', 'value': 'Ice Face'},
        {'kind': 'temp_hp_source_lte', 'value': {'source': 'ice-face', 'amount': 0}},
    ]}

    meloetta = form_entry(family_entry(payload, 'meloetta'), 'step-forme')
    clear_review_gate(meloetta)
    meloetta['requirements'] = {'all': [{'kind': 'known_move', 'value': 'Relic Song'}]}

    zygarde = family_entry(payload, 'zygarde')
    for form_id in ('complete-from-10-percent', 'complete-from-50-percent'):
        form = form_entry(zygarde, form_id)
        clear_review_gate(form)
        form['requirements'] = {'all': [{'kind': 'ability', 'value': 'Power Construct'}]}
        form['activation_requirements'] = {'all': [{'kind': 'hp_fraction_lt', 'value': 0.5}]}

    weapon_bonds = (
        ('zacian', 'crowned-sword', 'Ancestral Sword'),
        ('zamazenta', 'crowned-shield', 'Ancestral Shield'),
    )
    for family, form_id, item in weapon_bonds:
        form = form_entry(family_entry(payload, family), form_id)
        clear_review_gate(form)
        form['requirements'] = {'all': [{'kind': 'capability', 'value': 'Weapon Bond'}]}
        form['activation_requirements'] = {'all': [{'kind': 'trigger_item', 'value': item}]}

    payload['schema_version'] = 6
    payload['requirement_model_version'] = 2
    policy = payload.setdefault('policy', {})
    policy['structured_source_requirements'] = True
    policy['runtime_requirement_model_version'] = 2
    policy['manual_requirement_is_a_review_gate'] = True
    policy['requirement_note'] = (
        'Structured requirements validate only source-explicit eligibility/state. Action frequency and automatic scene lifecycle remain source metadata '
        'unless the runtime has an exact state primitive; activeFormId selection still represents the deliberate transformation action.'
    )

    all_forms = [form for entry in payload.get('candidate_families', []) for form in entry.get('forms', [])]
    all_forms += [form for entry in payload.get('synthetic_transform_species', []) for form in entry.get('forms', [])]
    payload.setdefault('summary', {})['structured_runtime_requirement_forms'] = 8
    payload['summary']['manual_requirement_leaves_remaining'] = sum(
        manual_leaf_count(form.get('requirements'))
        + manual_leaf_count(form.get('activation_requirements'))
        + manual_leaf_count(form.get('persistence_requirements'))
        for form in all_forms
    )

    STAGE_B.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    md = STAGE_B_MD.read_text(encoding='utf-8')
    summary_anchor = '- Families not directly materialized: **21**'
    runtime_summary = '- Runtime requirement model: **2**\n- Forms upgraded from review-only manual gates to structured source requirements: **8**'
    if runtime_summary not in md:
        if summary_anchor not in md:
            raise SystemExit('Stage B Markdown summary anchor drifted')
        md = md.replace(summary_anchor, summary_anchor + '\n' + runtime_summary, 1)

    old_gate = '- Event/action/HP conditions that Stage B cannot express exactly keep a `manual` review gate plus source mechanics; the manual gate is not the PTU rule itself.'
    new_gate = (
        '- Source-explicit eligibility/state uses structured runtime requirements for HP ratios, Temporary HP provenance, known Moves, combat state, trigger items, Abilities, Capabilities, and compatible base Forms.\n'
        '- Remaining unsupported event/frequency/scene-lifecycle semantics keep `manual` review gates only where the PTU rule still cannot be represented losslessly.'
    )
    if old_gate in md:
        md = md.replace(old_gate, new_gate, 1)
    elif new_gate not in md:
        raise SystemExit('Stage B Markdown safety-gate anchor drifted')

    section = """## Structured runtime requirements

- `wishiwashi:schooling` — requires Schooling; persists until both below half maximum HP and out of Temporary HP.
- `minior:core` — enters at half maximum HP or lower; once active it may persist above half HP while in combat, but not outside combat.
- `eiscue:noice-face` — requires Ice Face and tracked Ice Face Temporary HP to be exhausted.
- `meloetta:step-forme` — requires Relic Song to be known.
- `zygarde:complete-from-*` — requires Power Construct and activation below 50% HP; end-of-Scene lifecycle remains source metadata.
- `zacian:crowned-sword` / `zamazenta:crowned-shield` — require Weapon Bond and the corresponding ancestral weapon as the transformation trigger item; once active they persist until the source-defined relinquish/Faint condition.
- `compatible_base_forms` is enforced by the shared Windows/Android resolver for active transformations.

"""
    if '## Structured runtime requirements' not in md:
        anchor = '## Rule-defined builders\n'
        if anchor not in md:
            raise SystemExit('Stage B Markdown rule-builder anchor drifted')
        md = md.replace(anchor, section + anchor, 1)
    STAGE_B_MD.write_text(md, encoding='utf-8')

    print(json.dumps({
        'schema_version': payload['schema_version'],
        'requirement_model_version': payload['requirement_model_version'],
        'structured_runtime_requirement_forms': payload['summary']['structured_runtime_requirement_forms'],
        'manual_requirement_leaves_remaining': payload['summary']['manual_requirement_leaves_remaining'],
    }, sort_keys=True))


if __name__ == '__main__':
    main()
