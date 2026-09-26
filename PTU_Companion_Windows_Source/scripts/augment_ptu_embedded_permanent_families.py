#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
PACK = ROOT / 'seed' / 'content-packs' / 'ptu-gen8ish-pokedex.ptucp'
DISCOVERY = REPO / 'docs' / 'data' / 'PTU_FORMS_DISCOVERY.json'
DISCOVERY_MD = REPO / 'docs' / 'PTU_FORMS_DISCOVERY.md'
CLASSIFICATION = REPO / 'docs' / 'data' / 'PTU_FORMS_CLASSIFICATION.json'
CLASSIFICATION_MD = REPO / 'docs' / 'PTU_FORMS_CLASSIFICATION.md'
TARGETS = {
    'pumpkaboo': 437,
    'gourgeist': 438,
}
SIZE_SIGNAL = 'embedded_size_forms:small,average,large,super'


def slug(value: object) -> str:
    return re.sub(r'[^a-z0-9]+', '-', str(value or '').casefold()).strip('-')


def row_id(row: dict) -> str:
    return str(row.get('logical_id') or row.get('id') or '')


def row_name(row: dict) -> str:
    return str(row.get('display_name') or row.get('name') or row_id(row))


def ability_names(row: dict) -> list[str]:
    result = []
    for ability in row.get('ability_slots') or row.get('abilities') or []:
        if isinstance(ability, dict):
            value = ability.get('name') or ability.get('ability_id')
        else:
            value = ability
        if value:
            result.append(slug(value))
    return sorted(set(result))


def capability_names(row: dict) -> list[str]:
    result = []
    for capability in row.get('capabilities') or []:
        if isinstance(capability, dict):
            value = capability.get('name') or capability.get('capability_id')
        else:
            value = capability
        if value:
            result.append(slug(value))
    return sorted(set(result))


def load_target_rows() -> dict[str, dict]:
    with zipfile.ZipFile(PACK) as archive:
        species_path = next(name for name in archive.namelist() if name.endswith('species.ndjson'))
        rows = [json.loads(line) for line in archive.read(species_path).decode('utf-8').splitlines() if line.strip()]
    by_id = {slug(row_id(row)): row for row in rows}
    output = {}
    for ident, source_page in TARGETS.items():
        row = by_id.get(ident)
        if not row:
            raise SystemExit(f'Missing source Species row: {ident}')
        actual_page = row.get('source_page')
        if actual_page is not None and int(actual_page) != source_page:
            raise SystemExit(f'Unexpected source page for {ident}: {actual_page} != {source_page}')
        output[ident] = row
    return output


def compact(row: dict) -> dict:
    return {
        'id': row_id(row),
        'name': row_name(row),
        'source_page': row.get('source_page'),
        'variant_of': row.get('variant_of'),
        'variant_kind': row.get('variant_kind'),
        'types': row.get('types'),
        'base_stats': row.get('base_stats'),
        'abilities': ability_names(row),
        'capabilities': capability_names(row),
        'signals': [SIZE_SIGNAL],
    }


def render_discovery(payload: dict) -> str:
    families = {entry['family']: entry['records'] for entry in payload.get('families', [])}
    candidates = [row for records in families.values() for row in records]
    new_ids = payload.get('new_candidate_ids', [])
    legacy_only = payload.get('legacy_inventory_only_ids', [])
    lines = [
        '# PTU Forms Expanded Discovery Audit', '',
        'This is a discovery/audit artifact. It deliberately over-collects source-backed form signals before classification and does not modify bundled `.ptucp` packs.', '',
        f'- Parsed Species records: **{payload["species_count"]}**',
        f'- Previous inventory candidates: **{payload["previous_inventory_candidate_count"]}**',
        f'- Expanded source-signal candidates: **{payload["expanded_candidate_count"]}**',
        f'- Newly discovered candidate records: **{len(new_ids)}**',
        f'- Previous candidates not rediscovered by hardened signals: **{len(payload.get("previous_candidates_not_rediscovered", []))}**',
        f'- Legacy-only candidates with no independent hardened signal: **{len(legacy_only)}**', '',
        '## New candidates beyond the first inventory', ''
    ]
    by_id = {row['id']: row for row in candidates}
    for ident in new_ids:
        row = by_id[ident]
        lines.append(f'- `{ident}` — {row["name"]} (p. {row.get("source_page") or "—"}); signals: {", ".join(row.get("signals", []))}')
    if not new_ids:
        lines.append('- None.')
    lines += ['', '## Legacy-only review queue', '']
    for ident in legacy_only:
        lines.append(f'- `{ident}` — retained only because it appeared in the first census; classification must reject or independently source it.')
    if not legacy_only:
        lines.append('- None.')
    lines += ['', '## Candidate families', '']
    for family in sorted(families):
        lines.append(f'### {family}')
        for row in sorted(families[family], key=lambda value: (value.get('source_page') or 9999, value['id'])):
            lines.append(f'- `{row["id"]}` — {row["name"]} (p. {row.get("source_page") or "—"}); {"; ".join(row.get("signals", []))}')
        lines.append('')
    lines += ['## Discovery notes', '',
        '- `existing_inventory` means the record was already in the first census; by itself it is not evidence of a Form.',
        '- `form_capability` / `form_ability`, embedded parameter blocks, structured variant metadata, and explicit gender/regional records are stronger signals than broad name matching.',
        '- Flower Gift is not treated as a Form-driving Ability because the supplied PTU Core definition is a Sunny burst buff, not a Cherrim transformation rule.',
        '- Pumpkaboo and Gourgeist are explicitly retained as embedded size-form families because the supplied Gen 8ish PokéDex pages 437–438 contain Small/Average/Large/Super Base Stat matrices even when that table is not preserved verbatim in the pack row raw text.',
        '- Records discovered only by broad naming signals are not automatically Forms; classification must promote them with source evidence or reject them.',
    ]
    return '\n'.join(lines) + '\n'


def render_classification(payload: dict) -> str:
    families = payload.get('families', [])
    counts = payload['summary']['classification_counts']
    synthetic = payload.get('synthetic_transform_families', [])
    deferred = payload['summary']['deferred_families']
    false_positive = payload['summary']['false_positive_families']
    lines = [
        '# PTU Forms Family Classification', '',
        'This is the conversion gate between source discovery and default `.ptucp` mutation. Classification is conservative: a separately parameterized record proves that a variant exists, but runtime switching semantics are not invented.', '',
        '## Summary', '',
        f'- Candidate records classified: **{payload["summary"]["candidate_records"]}**',
        f'- Candidate families classified: **{payload["summary"]["candidate_families"]}**',
        f'- Permanent/base families: **{counts.get("permanent", 0)}**',
        f'- Persistent-form families: **{counts.get("persistent_form", 0)}**',
        f'- Transformation families: **{counts.get("transformation", 0)}**',
        f'- Runtime-state families: **{counts.get("runtime_state", 0)}**',
        f'- Mixed base + transformation families: **{counts.get("mixed", 0)}**',
        f'- Deferred/source-insufficient families: **{counts.get("defer", 0)}**',
        f'- False-positive families: **{counts.get("false_positive", 0)}**',
        f'- Synthetic transform inventory: **48 Mega + 2 Primal + 2 Ultra Burst source blocks**.', '',
        '## Family decisions', '',
        '| Family | Classification | Target | Evidence | Records | Decision |',
        '|---|---|---|---|---:|---|'
    ]
    for row in families:
        lines.append(f'| {row["family"]} | {row["classification"]} | `{row["target_layer"]}` | {row["evidence_status"]} | {len(row["records"])} | {row["reason"]} |')
    lines += ['', '## Synthetic transformation families', '']
    for row in synthetic:
        lines.append(f'- **{row["family"]}** — {row["classification"]} → `{row["target_layer"]}`; forms: {row.get("form_count", "—")}; requirement: `{row["requirement_status"]}`. {row["reason"]}')
    lines += ['', '## Deferred queue', '']
    lines.extend(f'- `{family}` — requires additional supplied-source evidence before automatic conversion/runtime switching.' for family in deferred)
    if not deferred:
        lines.append('- None.')
    lines += ['', '## False positives', '']
    lines.extend(f'- `{family}` — not promoted to the generic Forms layer by the current supplied-source evidence.' for family in false_positive)
    if not false_positive:
        lines.append('- None.')
    lines += ['', '## Conversion rule', '',
        'Default packs must only convert families whose target layer is established above. Deferred families may be inventoried/displayed, but automatic requirements, durations, item gates, stat swaps, or form transitions must not be fabricated. Legacy Species IDs should remain import aliases where a permanent/persistent family is consolidated into `baseFormId`.'
    ]
    return '\n'.join(lines) + '\n'


def main() -> None:
    rows = load_target_rows()
    discovery = json.loads(DISCOVERY.read_text(encoding='utf-8'))
    classification = json.loads(CLASSIFICATION.read_text(encoding='utf-8'))

    discovery_families = {entry['family']: entry for entry in discovery.get('families', [])}
    for ident in TARGETS:
        discovery_families[ident] = {'family': ident, 'records': [compact(rows[ident])]}
    discovery['families'] = [discovery_families[key] for key in sorted(discovery_families)]
    all_records = [record for entry in discovery['families'] for record in entry['records']]
    discovery['expanded_candidate_count'] = len({record['id'] for record in all_records})
    existing = set(discovery.get('new_candidate_ids', []))
    existing.update(TARGETS)
    discovery['new_candidate_ids'] = sorted(existing)
    signal_counts = Counter(signal.split(':', 1)[0] for record in all_records for signal in record.get('signals', []))
    discovery['signal_counts'] = dict(sorted(signal_counts.items()))

    class_families = {entry['family']: entry for entry in classification.get('families', [])}
    for ident in TARGETS:
        class_families[ident] = {
            'family': ident,
            'classification': 'permanent',
            'target_layer': 'baseFormId',
            'evidence_status': 'source_explicit_variant',
            'records': [compact(rows[ident])],
            'signals': [SIZE_SIGNAL],
            'reason': 'The supplied Gen 8ish PokéDex entry embeds four explicit Small/Average/Large/Super Base Stat sets. Exact per-size height/weight values are not inferred from the aggregate source range.',
            'preserve_legacy_ids': True,
        }
    classification['families'] = [class_families[key] for key in sorted(class_families)]
    counts = Counter(entry['classification'] for entry in classification['families'])
    classification['summary']['candidate_records'] = len({record['id'] for entry in classification['families'] for record in entry['records']})
    classification['summary']['candidate_families'] = len(classification['families'])
    classification['summary']['classification_counts'] = dict(sorted(counts.items()))
    classification['summary']['deferred_families'] = [entry['family'] for entry in classification['families'] if entry['classification'] == 'defer']
    classification['summary']['false_positive_families'] = [entry['family'] for entry in classification['families'] if entry['classification'] == 'false_positive']

    if discovery['expanded_candidate_count'] != 106 or len(discovery['families']) != 69:
        raise SystemExit(f'Embedded-size discovery scope mismatch: {discovery["expanded_candidate_count"]} / {len(discovery["families"])}')
    if classification['summary']['candidate_records'] != 106 or classification['summary']['candidate_families'] != 69:
        raise SystemExit(f'Embedded-size classification scope mismatch: {classification["summary"]}')
    if counts.get('permanent') != 36:
        raise SystemExit(f'Expected 36 permanent families after Pumpkaboo/Gourgeist augmentation, got {counts.get("permanent")}')

    DISCOVERY.write_text(json.dumps(discovery, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    DISCOVERY_MD.write_text(render_discovery(discovery), encoding='utf-8')
    CLASSIFICATION.write_text(json.dumps(classification, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    CLASSIFICATION_MD.write_text(render_classification(classification), encoding='utf-8')
    print(json.dumps({
        'candidate_records': classification['summary']['candidate_records'],
        'candidate_families': classification['summary']['candidate_families'],
        'permanent': counts.get('permanent'),
        'embedded_size_families': sorted(TARGETS),
    }, sort_keys=True))


if __name__ == '__main__':
    main()
