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

MIXED_FAMILIES = {'darmanitan', 'necrozma', 'zacian', 'zamazenta', 'zygarde'}


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


def family_classification(classification: dict, family: str) -> dict:
    row = next((row for row in classification['families'] if row['family'] == family), None)
    if not row or row.get('classification') != 'mixed' or row.get('target_layer') != 'baseFormId+activeFormId':
        raise SystemExit(f'{family} must remain classified mixed -> baseFormId+activeFormId')
    return row


def full_source_overrides(row: dict, *, exclude: set[str] | None = None) -> dict:
    excluded = exclude or set()
    overrides = {}
    for raw_key, stage_key in STRUCTURED_FIELDS:
        if raw_key in excluded:
            continue
        value = row.get(raw_key)
        if value is not None:
            overrides[stage_key] = {'replace': copy.deepcopy(value)}
    if not overrides:
        raise SystemExit(f'No structured Form fields found for {row.get("logical_id") or row.get("id")}')
    return overrides


def source_form(rows: dict[str, dict], source_id: str, form_id: str, name: str, mode: str, order: int,
                *, manual_gate: str | None = None, compatible_base_forms: list[str] | None = None,
                exclude: set[str] | None = None) -> dict:
    source = rows.get(source_id)
    if not source:
        raise SystemExit(f'Missing mixed-family source record: {source_id}')
    form = {
        'id': form_id,
        'name': name,
        'mode': mode,
        'overrides': full_source_overrides(source, exclude=exclude),
        'sortOrder': order,
        'source_record': {'id': source_id, 'source_page': source.get('source_page')},
    }
    if manual_gate:
        form['requirements'] = {'all': [{'kind': 'manual', 'value': manual_gate}]}
    if compatible_base_forms:
        form['compatible_base_forms'] = list(compatible_base_forms)
    return form


def darmanitan_entry(classification: dict, rows: dict[str, dict]) -> dict:
    family = family_classification(classification, 'darmanitan')
    forms = [
        source_form(rows, 'darmanitan-standard-mode', 'standard-mode', 'Standard Mode', 'permanent', 10),
        source_form(rows, 'darmanitan-galar-standard-mode', 'galar-standard-mode', 'Galarian Standard Mode', 'permanent', 20),
        source_form(
            rows, 'darmanitan-zen-mode', 'zen-mode', 'Zen Mode', 'transformation', 110,
            manual_gate='darmanitan-zen-mode-source-rule-review', compatible_base_forms=['standard-mode'],
        ),
        source_form(
            rows, 'darmanitan-galar-zen-mode', 'galar-zen-mode', 'Galarian Zen Mode', 'transformation', 120,
            manual_gate='darmanitan-galar-zen-snowed', compatible_base_forms=['galar-standard-mode'],
        ),
    ]
    return {
        'family': 'darmanitan',
        'classification': family['classification'],
        'target_layer': family['target_layer'],
        'builder': 'mixed_darmanitan_standard_zen',
        'forms': forms,
        'source_mechanics': {
            'regular_zen_mode': {
                'activation_status': 'conflicting_supplied_activation_rules_preserved_for_review',
                'core_1_05': {
                    'source': 'Pokemon Tabletop United 1.05 Core p.336-337',
                    'enter': 'Free Action while below 50% full Hit Points.',
                    'exit': 'Free Action at 50% full Hit Points or higher.',
                    'frequency': 'May switch from one form to another once per Scene.',
                    'hp_invariant': 'Normal and Zen Base Stat sets use the same HP Stat.',
                },
                'feb_2016_playtest': {
                    'source': 'February 2016 Playtest Packet p.11-12',
                    'action': 'Scene - Swift Action.',
                    'duration': 'Zen Mode for the rest of the Scene.',
                    'move_access': ['Flamethrower', 'Psychic'],
                },
            },
            'galarian_zen_snowed': {
                'source': 'New Abilities and Moves',
                'action': 'Scene - Swift Action.',
                'duration': 'Zen Mode for the rest of the Scene.',
                'move_access': ['Ice Punch', 'Fire Punch'],
            },
        },
        'note': 'Standard/Galarian Standard are persistent base-layer choices; each Zen record is an active overlay compatible only with its matching base. The supplied regular Zen Mode sources disagree on activation semantics, so no automatic requirement is invented and the manual condition is only a review gate.',
    }


def necrozma_entry(classification: dict, rows: dict[str, dict]) -> dict:
    family = family_classification(classification, 'necrozma')
    dusk = source_form(rows, 'necrozma-dusk-mane', 'dusk-mane', 'Dusk Mane', 'permanent', 10)
    dawn = source_form(rows, 'necrozma-dawn-wings', 'dawn-wings', 'Dawn Wings', 'permanent', 20)
    ultra = {
        'id': 'ultra-burst',
        'name': 'Ultra Burst',
        'mode': 'transformation',
        'requirements': {'all': [{'kind': 'manual', 'value': 'necrozma-ultra-burst-source-requirement-review'}]},
        'compatible_base_forms': ['dusk-mane', 'dawn-wings'],
        'overrides': {
            'types': {'replace': ['Psychic', 'Dragon']},
            'baseStats': {'replace': {
                'hp': 10, 'attack': 17, 'defense': 10,
                'special_attack': 17, 'special_defense': 10, 'speed': 13,
            }},
        },
        'sortOrder': 110,
    }
    return {
        'family': 'necrozma',
        'classification': family['classification'],
        'target_layer': family['target_layer'],
        'builder': 'mixed_necrozma_fusion_ultra_burst',
        'forms': [dusk, dawn, ultra],
        'source_mechanics': {
            'viral_fusion': {
                'source': 'SuMo References p.1',
                'action': 'Extended Action to bond with a willing or helpless Pokemon; another Extended Action releases it.',
                'specific_bond_forms': {'Solgaleo': 'Dusk Mane', 'Lunala': 'Dawn Wings'},
                'signature_moves': {'Solgaleo': 'Sunsteel Strike', 'Lunala': 'Moongeist Beam'},
            },
            'ultra_burst': {
                'source': 'Gen 8ish PokeDex p.945-946',
                'activation_status': 'source_insufficient',
                'common_effects': {
                    'types': ['Psychic', 'Dragon'],
                    'ability': 'Neuroforce',
                    'advanced_ability_1_becomes': 'Illuminate',
                    'gains_capability': 'Glow',
                    'final_base_stats': {'hp': 10, 'attack': 17, 'defense': 10, 'special_attack': 17, 'special_defense': 10, 'speed': 13},
                },
                'source_deltas': {
                    'dusk-mane': {'attack': 1, 'defense': -3, 'special_attack': 6, 'special_defense': -1, 'speed': 5},
                    'dawn-wings': {'attack': 6, 'defense': -1, 'special_attack': 1, 'special_defense': -3, 'speed': 5},
                },
            },
        },
        'note': 'Dusk Mane and Dawn Wings are persistent Viral Fusion base-layer Forms. Ultra Burst is emitted once as the shared active layer because both supplied source blocks converge on the same final Type/Base Stats. Neuroforce, Illuminate and Glow stay explicit in source metadata rather than being guessed into unsupported Ability/Capability slot shapes. The previous synthetic Ultra Burst entries are removed to avoid duplicate semantics.',
    }


def weapon_bond_entry(classification: dict, rows: dict[str, dict], family_name: str) -> dict:
    family = family_classification(classification, family_name)
    if family_name == 'zacian':
        hero_id, crowned_id = 'zacian-hero-of-many-battles-forme', 'zacian-crowned-sword-forme'
        crowned_form_id, crowned_name = 'crowned-sword', 'Crowned Sword Forme'
        item, move = 'Ancestral Sword', 'Behemoth Blade'
    else:
        hero_id, crowned_id = 'zamazenta-hero-of-many-battles-forme', 'zamazenta-crowned-shield-forme'
        crowned_form_id, crowned_name = 'crowned-shield', 'Crowned Shield Forme'
        item, move = 'Ancestral Shield', 'Behemoth Bash'
    hero = source_form(rows, hero_id, 'hero-of-many-battles', 'Hero of Many Battles Forme', 'permanent', 10)
    crowned = source_form(
        rows, crowned_id, crowned_form_id, crowned_name, 'transformation', 110,
        manual_gate=f'{family_name}-weapon-bond-crowned-form', compatible_base_forms=['hero-of-many-battles'],
    )
    return {
        'family': family_name,
        'classification': family['classification'],
        'target_layer': family['target_layer'],
        'builder': 'mixed_weapon_bond',
        'forms': [hero, crowned],
        'source_mechanics': {
            'source': 'New Abilities and Moves — Weapon Bond',
            'enter': f'Extended Action using {item}.',
            'granted_move': move,
            'exit': 'Until Fainted or voluntarily relinquished as an Extended Action.',
        },
        'note': f'Hero of Many Battles is the base-layer state and {crowned_name} is the active Weapon Bond overlay. The named ancestral item, Extended Action and end conditions are preserved as source mechanics; the manual requirement is only a Stage B review gate.',
    }


def zygarde_entry(classification: dict, rows: dict[str, dict]) -> dict:
    family = family_classification(classification, 'zygarde')
    ten_row = rows.get('zygarde-10-forme')
    fifty_row = rows.get('zygarde-50-forme')
    complete_row = rows.get('zygarde-complete-forme')
    if not ten_row or not fifty_row or not complete_row:
        raise SystemExit('Missing one or more Zygarde source records')
    ten = source_form(rows, 'zygarde-10-forme', '10-percent', '10% Forme', 'permanent', 10)
    fifty = source_form(rows, 'zygarde-50-forme', '50-percent', '50% Forme', 'permanent', 20)
    complete_common = full_source_overrides(complete_row, exclude={'base_stats'})
    complete_10 = {
        'id': 'complete-from-10-percent',
        'name': 'Complete Forme',
        'mode': 'transformation',
        'requirements': {'all': [{'kind': 'manual', 'value': 'zygarde-power-construct-from-10-percent'}]},
        'compatible_base_forms': ['10-percent'],
        'overrides': copy.deepcopy(complete_common),
        'sortOrder': 110,
    }
    complete_10['overrides']['baseStats'] = {'add': {
        'defense': 5, 'special_attack': 3, 'special_defense': 1, 'speed': -3,
    }}
    complete_50 = {
        'id': 'complete-from-50-percent',
        'name': 'Complete Forme',
        'mode': 'transformation',
        'requirements': {'all': [{'kind': 'manual', 'value': 'zygarde-power-construct-from-50-percent'}]},
        'compatible_base_forms': ['50-percent'],
        'overrides': copy.deepcopy(complete_common),
        'sortOrder': 120,
    }
    complete_50['overrides']['baseStats'] = {'add': {'special_attack': 1, 'speed': -1}}
    return {
        'family': 'zygarde',
        'classification': family['classification'],
        'target_layer': family['target_layer'],
        'builder': 'mixed_zygarde_cells_power_construct',
        'forms': [ten, fifty, complete_10, complete_50],
        'source_mechanics': {
            'zygarde_cells': {
                'source': 'SuMo References p.1',
                'action': 'Extended Action with a Zygarde Cube.',
                'cell_forms': {'10-percent': 10, '50-percent': 50},
                'hundred_cell_rule': '100 Cells may form 10% or 50% Zygarde with Power Construct instead of Aura Break; it cannot be disassembled and may change between 10% and 50% as an Extended Action using the Cube.',
            },
            'power_construct': {
                'source': 'SuMo References p.3',
                'action': 'Daily - Swift Action while below 50% HP.',
                'duration': 'Complete Forme until the end of the Scene.',
                'temporary_hp': 'Gains Temporary Hit Points equal to half the maximum Hit Points Complete Forme would have; cannot gain Temporary HP from other sources while Complete.',
                'hp_invariant': 'The user keeps the HP total and HP Maximum of the prior 10% or 50% Forme.',
            },
        },
        'note': '10% and 50% are persistent base-layer Forms. Complete is represented by two context-specific active overlays because Stage B cannot express a dynamic "preserve prior HP maximum" operation. Their non-HP Complete mechanics are identical; each Base Stats delta intentionally omits HP so the prior Forme HP remains unchanged.',
    }


def recalculate_summary(payload: dict) -> None:
    candidate_entries = payload.get('candidate_families', [])
    record_entries = [entry for entry in candidate_entries if entry.get('builder') == 'parameterized_species_record']
    rule_entries = [entry for entry in candidate_entries if entry.get('builder') != 'parameterized_species_record']
    synthetic_entries = payload.get('synthetic_transform_species', [])
    payload['summary']['candidate_family_entries'] = len(candidate_entries)
    payload['summary']['record_backed_family_entries'] = len(record_entries)
    payload['summary']['rule_defined_family_entries'] = len(rule_entries)
    payload['summary']['candidate_forms'] = sum(len(entry.get('forms', [])) for entry in candidate_entries)
    payload['summary']['record_backed_forms'] = sum(len(entry.get('forms', [])) for entry in record_entries)
    payload['summary']['rule_defined_forms'] = sum(len(entry.get('forms', [])) for entry in rule_entries)
    payload['summary']['omitted_or_deferred_family_entries'] = len(payload.get('not_materialized', []))
    payload['summary']['synthetic_species_entries'] = len(synthetic_entries)
    payload['summary']['synthetic_forms'] = sum(len(entry.get('forms', [])) for entry in synthetic_entries)
    payload['summary']['ultra_burst_forms'] = sum(
        len(entry.get('forms', [])) for entry in synthetic_entries if entry.get('source_family') == 'ultra-burst'
    )
    payload['summary']['ultra_burst_source_blocks'] = 2
    payload['summary']['composed_ultra_burst_forms'] = 1


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
        f'- Synthetic Ultra Burst transforms: **{summary["ultra_burst_forms"]}**',
        f'- Composed Necrozma Ultra Burst active overlays: **{summary["composed_ultra_burst_forms"]}** from **{summary["ultra_burst_source_blocks"]}** source blocks',
        f'- Families not directly materialized: **{summary["omitted_or_deferred_family_entries"]}**', '',
        '## Safety gates', '',
        '- Every emitted `forms[]` entry uses Stage B mode `permanent` or `transformation`.',
        '- Event/action/HP conditions that Stage B cannot express exactly keep a `manual` review gate plus source mechanics; the manual gate is not the PTU rule itself.',
        '- Mixed families explicitly compose persistent `baseFormId` choices with active `activeFormId` overlays.',
        '- Necrozma Ultra Burst is emitted in the mixed family and removed from the synthetic list to prevent duplicate semantics.',
        '- Zygarde Complete overlays preserve the prior 10%/50% HP Base Stat by applying only non-HP Base Stat deltas.',
        '- No artwork URL is generated. Artwork remains governed by the separate asset audit and the existing Stage B fallback.',
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

    mixed = {
        'darmanitan': darmanitan_entry(classification, rows),
        'necrozma': necrozma_entry(classification, rows),
        'zacian': weapon_bond_entry(classification, rows, 'zacian'),
        'zamazenta': weapon_bond_entry(classification, rows, 'zamazenta'),
        'zygarde': zygarde_entry(classification, rows),
    }
    entries = [entry for entry in payload.get('candidate_families', []) if entry.get('family') not in MIXED_FAMILIES]
    entries.extend(mixed.values())
    payload['candidate_families'] = sorted(entries, key=lambda entry: entry['family'])
    payload['not_materialized'] = [entry for entry in payload.get('not_materialized', []) if entry.get('family') not in MIXED_FAMILIES]

    synthetic = payload.get('synthetic_transform_species', [])
    removed_ultra = [entry for entry in synthetic if entry.get('source_family') == 'ultra-burst']
    if len(removed_ultra) != 2 or sum(len(entry.get('forms', [])) for entry in removed_ultra) != 2:
        raise SystemExit('Expected exactly two pre-existing synthetic Ultra Burst entries before mixed composition')
    payload['synthetic_transform_species'] = [entry for entry in synthetic if entry.get('source_family') != 'ultra-burst']

    payload['schema_version'] = 5
    recalculate_summary(payload)
    expected = {
        'candidate_family_entries': 48,
        'record_backed_family_entries': 32,
        'rule_defined_family_entries': 16,
        'candidate_forms': 82,
        'record_backed_forms': 37,
        'rule_defined_forms': 45,
        'omitted_or_deferred_family_entries': 21,
        'synthetic_species_entries': 48,
        'synthetic_forms': 50,
        'ultra_burst_forms': 0,
        'composed_ultra_burst_forms': 1,
    }
    for key, value in expected.items():
        if payload['summary'].get(key) != value:
            raise SystemExit(f'Unexpected Stage B summary after mixed augmentation: {key}={payload["summary"].get(key)} expected {value}')

    STAGE_B.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    STAGE_B_MD.write_text(render_markdown(payload), encoding='utf-8')
    print(json.dumps({**expected, 'schema_version': payload['schema_version']}, sort_keys=True))


if __name__ == '__main__':
    main()
