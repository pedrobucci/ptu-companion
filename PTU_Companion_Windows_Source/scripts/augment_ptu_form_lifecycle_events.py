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


def clear_manual_gate(form: dict) -> None:
    req = form.get('requirements')
    if req is None:
        return
    leaves = req.get('all') if isinstance(req, dict) else None
    if not isinstance(leaves, list) or not leaves or any(not isinstance(row, dict) or row.get('kind') != 'manual' for row in leaves):
        raise SystemExit(f'Expected only a manual review gate on {form.get("id")}, got {req}')
    form.pop('requirements', None)


def manual_leaf_count(value: object) -> int:
    if isinstance(value, list):
        return sum(manual_leaf_count(row) for row in value)
    if not isinstance(value, dict):
        return 0
    count = 1 if value.get('kind') == 'manual' else 0
    return count + sum(manual_leaf_count(row) for row in value.values())


def lifecycle(events: list[dict], source: str, note: str) -> dict:
    return {'model_version': 1, 'source': source, 'note': note, 'events': events}


def main() -> None:
    payload = json.loads(STAGE_B.read_text(encoding='utf-8'))
    if int(payload.get('schema_version', 0)) < 6 or int(payload.get('requirement_model_version', 0)) != 2:
        raise SystemExit('Lifecycle pass expects Stage B schema >=6 with requirement model v2')

    # Aegislash — source-defined automatic move triggers plus explicit Full Action toggle.
    aegislash = form_entry(family_entry(payload, 'aegislash'), 'sword-stance')
    clear_manual_gate(aegislash)
    aegislash['lifecycle'] = lifecycle([
        {
            'id': 'stance-change-damaging-attack', 'event': 'move-used', 'priority': 10,
            'when': {'damaging': True}, 'action': {'type': 'activate'},
            'source_action': 'Automatic when Aegislash uses a damaging attack.'
        },
        {
            'id': 'stance-change-defensive-move', 'event': 'move-used', 'priority': 20,
            'when': {'any': [
                {'move': ["King's Shield", 'Protect']},
                {'all': [{'move_class': 'Status'}, {'raises_defense_combat_stages': True}]},
                {'tag': 'Blessing'},
            ]},
            'action': {'type': 'deactivate', 'form_id': 'sword-stance'},
            'source_action': 'Automatic return to Shield Stance.'
        },
        {
            'id': 'stance-change-full-action', 'event': 'form-action', 'priority': 30,
            'when': {'action_id': 'stance-change-full-action'},
            'action': {'type': 'toggle'}, 'action_cost': 'Full Action'
        },
    ], 'Pokemon Tabletop United 1.05 Core p.331',
       'Shield is implicit base. Damaging attacks enter Sword; King’s Shield, Protect, qualifying Defense-raising Status Moves and Blessings return Shield; Full Action may toggle either way.')

    # Wishiwashi — activation grants source-defined THP; HP/THP events revalidate the source exit condition.
    schooling = form_entry(family_entry(payload, 'wishiwashi'), 'schooling')
    schooling['lifecycle'] = lifecycle([
        {
            'id': 'schooling-ability-use', 'event': 'ability-used', 'priority': 10,
            'when': {'ability': 'Schooling'}, 'action': {'type': 'activate'},
            'frequency': 'Daily', 'action_cost': 'Free Action',
            'effects': [{'kind': 'grant-temp-hp', 'source': 'schooling', 'fraction_of_max_hp': 0.5, 'blocks_other_sources': True}],
        },
        {'id': 'schooling-hp-check', 'event': 'hp-changed', 'action': {'type': 'validate-persistence'}},
        {'id': 'schooling-temp-hp-check', 'event': 'temp-hp-changed', 'action': {'type': 'validate-persistence'}},
        {'id': 'schooling-state-check', 'event': 'form-state-check', 'action': {'type': 'validate-persistence'}},
    ], 'SuMo References p.4',
       'Schooling activates by its Daily Free Action and returns to Solo only when below half Maximum HP with no Temporary HP remaining.')

    # Minior — Static state synchronization.
    core = form_entry(family_entry(payload, 'minior'), 'core')
    core['lifecycle'] = lifecycle([
        {'id': 'shields-down-hp-sync', 'event': 'hp-changed', 'action': {'type': 'sync'}},
        {'id': 'shields-down-combat-sync', 'event': 'combat-state-changed', 'action': {'type': 'sync'}},
        {'id': 'shields-down-state-sync', 'event': 'form-state-check', 'action': {'type': 'sync'}},
    ], 'SuMo References p.4',
       'Meteor automatically becomes Core at half Maximum HP or lower; outside combat, Core returns to Meteor above half Maximum HP.')

    # Eiscue — battle start and Hail restoration grant two Ice Face ticks; THP provenance determines visible Form.
    noice = form_entry(family_entry(payload, 'eiscue'), 'noice-face')
    noice['lifecycle'] = lifecycle([
        {
            'id': 'ice-face-battle-start', 'event': 'battle-start', 'priority': 10,
            'action': {'type': 'deactivate', 'form_id': 'noice-face'},
            'effects': [{'kind': 'grant-temp-hp', 'source': 'ice-face', 'ticks': 2}],
        },
        {
            'id': 'ice-face-hail-restore', 'event': 'form-action', 'priority': 20,
            'when': {'all': [{'action_id': 'ice-face-hail-restore'}, {'weather': 'Hail'}]},
            'action': {'type': 'deactivate', 'form_id': 'noice-face'}, 'action_cost': 'Standard Action',
            'effects': [{'kind': 'grant-temp-hp', 'source': 'ice-face', 'ticks': 2}],
        },
        {'id': 'ice-face-temp-hp-sync', 'event': 'temp-hp-changed', 'action': {'type': 'sync'}},
        {'id': 'ice-face-state-sync', 'event': 'form-state-check', 'action': {'type': 'sync'}},
    ], 'New Abilities and Moves p.1',
       'Ice Face exists while Ice Face-specific Temporary HP remains; battle start and the source-defined Standard Action in Hail grant two ticks.')

    # Zygarde — explicit Power Construct use plus end-of-Scene expiry.
    zygarde = family_entry(payload, 'zygarde')
    for base_id, form_id in (('10-percent', 'complete-from-10-percent'), ('50-percent', 'complete-from-50-percent')):
        form = form_entry(zygarde, form_id)
        form['lifecycle'] = lifecycle([
            {
                'id': f'power-construct-{base_id}', 'event': 'ability-used', 'priority': 10,
                'when': {'all': [{'ability': 'Power Construct'}, {'base_form_id': base_id}]},
                'action': {'type': 'activate'}, 'frequency': 'Daily', 'action_cost': 'Swift Action',
                'effects': [{'kind': 'grant-temp-hp', 'source': 'power-construct', 'fraction_of_target_form_max_hp': 0.5, 'blocks_other_sources': True}],
            },
            {
                'id': f'power-construct-scene-end-{base_id}', 'event': 'scene-end', 'priority': 10,
                'when': {'active_form_id': form_id},
                'action': {'type': 'deactivate', 'form_id': form_id},
            },
        ], 'SuMo References p.3',
           'Power Construct may activate only below 50% HP, lasts until end of Scene, preserves prior Form HP total/maximum, and grants half of Complete Forme maximum HP as Temporary HP.')

    # Weapon Bond — explicit capability use, Faint expiry, and voluntary Extended Action relinquish.
    for family, form_id, item in (
        ('zacian', 'crowned-sword', 'Ancestral Sword'),
        ('zamazenta', 'crowned-shield', 'Ancestral Shield'),
    ):
        form = form_entry(family_entry(payload, family), form_id)
        form['lifecycle'] = lifecycle([
            {
                'id': f'{family}-weapon-bond-enter', 'event': 'capability-used', 'priority': 10,
                'when': {'all': [{'capability': 'Weapon Bond'}, {'trigger_item': item}]},
                'action': {'type': 'activate'}, 'action_cost': 'Extended Action',
            },
            {
                'id': f'{family}-weapon-bond-faint', 'event': 'faint', 'priority': 10,
                'when': {'active_form_id': form_id}, 'action': {'type': 'deactivate', 'form_id': form_id},
            },
            {
                'id': f'{family}-weapon-bond-relinquish', 'event': 'form-action', 'priority': 10,
                'when': {'all': [{'action_id': 'weapon-bond-relinquish'}, {'active_form_id': form_id}]},
                'action': {'type': 'deactivate', 'form_id': form_id}, 'action_cost': 'Extended Action',
            },
        ], 'New Abilities and Moves p.1',
           f'Weapon Bond uses {item} as an Extended Action to enter Crowned Forme, which lasts until Fainted or voluntarily relinquished as an Extended Action.')

    payload['schema_version'] = 7
    payload['lifecycle_model_version'] = 1
    policy = payload.setdefault('policy', {})
    policy['source_event_lifecycle_automation'] = True
    policy['lifecycle_model_version'] = 1
    policy['lifecycle_note'] = (
        'Lifecycle events automate only source-explicit state changes. Event callers remain responsible for action economy/frequency accounting and for applying returned effect directives to campaign state.'
    )

    all_forms = [form for entry in payload.get('candidate_families', []) for form in entry.get('forms', [])]
    all_forms += [form for entry in payload.get('synthetic_transform_species', []) for form in entry.get('forms', [])]
    automated = [form for form in all_forms if isinstance(form.get('lifecycle'), dict)]
    payload.setdefault('summary', {})['lifecycle_automated_forms'] = len(automated)
    payload['summary']['lifecycle_event_rules'] = sum(len(form['lifecycle'].get('events', [])) for form in automated)
    payload['summary']['manual_requirement_leaves_remaining'] = sum(
        manual_leaf_count(form.get('requirements'))
        + manual_leaf_count(form.get('activation_requirements'))
        + manual_leaf_count(form.get('persistence_requirements'))
        for form in all_forms
    )

    STAGE_B.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    md = STAGE_B_MD.read_text(encoding='utf-8')
    if '- Form lifecycle model: **1**' not in md:
        anchor = '- Forms upgraded from review-only manual gates to structured source requirements: **8**'
        if anchor not in md:
            raise SystemExit('Stage B Markdown runtime summary anchor drifted')
        md = md.replace(anchor, anchor + f'\n- Form lifecycle model: **1**\n- Forms with source-explicit lifecycle automation: **{len(automated)}**\n- Source-explicit lifecycle event rules: **{payload["summary"]["lifecycle_event_rules"]}**', 1)

    section = """## Source-explicit lifecycle automation

- `aegislash:sword-stance` — damaging Move use enters Sword; King’s Shield, Protect, qualifying Defense-raising Status Moves or Blessings return Shield; an explicit Full Action event toggles Stance.
- `wishiwashi:schooling` — Schooling Ability use enters Schooling and returns a half-Max-HP Temporary HP grant directive; HP/Temporary-HP events revalidate the exact Solo reversion condition.
- `minior:core` — HP and combat-state events synchronize Meteor/Core using Shields Down.
- `eiscue:noice-face` — battle start and the Hail restoration action return two Ice Face tick directives; Ice Face-specific Temporary HP events synchronize Ice/Noice state.
- `zygarde:complete-from-*` — Power Construct Ability use activates the base-compatible Complete overlay and returns the source Temporary-HP formula; `scene-end` clears Complete.
- `zacian:crowned-sword` / `zamazenta:crowned-shield` — Weapon Bond capability use with the matching ancestral weapon activates Crowned; `faint` or explicit Extended Action relinquish clears it.
- The event engine returns state/effect directives; it does not silently spend actions, consume Daily/Scene frequency, or round HP fractions beyond the supplied source rule.

"""
    if '## Source-explicit lifecycle automation' not in md:
        anchor = '## Rule-defined builders\n'
        if anchor not in md:
            raise SystemExit('Stage B Markdown rule-builder anchor drifted')
        md = md.replace(anchor, section + anchor, 1)
    STAGE_B_MD.write_text(md, encoding='utf-8')

    print(json.dumps({
        'schema_version': payload['schema_version'],
        'lifecycle_model_version': payload['lifecycle_model_version'],
        'lifecycle_automated_forms': payload['summary']['lifecycle_automated_forms'],
        'lifecycle_event_rules': payload['summary']['lifecycle_event_rules'],
        'manual_requirement_leaves_remaining': payload['summary']['manual_requirement_leaves_remaining'],
    }, sort_keys=True))


if __name__ == '__main__':
    main()
