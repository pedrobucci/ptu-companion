#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
PACK = ROOT / 'seed' / 'content-packs' / 'ptu-gen8ish-pokedex.ptucp'
INVENTORY = REPO / 'docs' / 'data' / 'PTU_FORMS_INVENTORY.json'
OUT_JSON = REPO / 'docs' / 'data' / 'PTU_FORMS_DISCOVERY.json'
OUT_MD = REPO / 'docs' / 'PTU_FORMS_DISCOVERY.md'

REGIONS = {'alola', 'galar', 'hisui', 'paldea'}
FORM_WORDS = {
    'form', 'forme', 'forms', 'mode', 'style', 'cloak', 'pattern', 'trim', 'stripe', 'striped',
    'schooling', 'solo', 'meteor', 'core', 'confined', 'unbound', 'crowned', 'rider', 'appliance',
    'midday', 'midnight', 'dusk', 'amped', 'noice', 'spring', 'summer', 'autumn', 'winter',
    'male', 'female'
}
PHRASE_SIGNALS = (
    'hero of many battles', 'low key', 'single strike', 'rapid strike', 'east sea', 'west sea',
    'ice face', 'dawn wings', 'dusk mane', 'attack forme', 'defense forme', 'speed forme',
    'normal forme', 'origin forme', 'altered forme', 'sky forme', 'land forme', 'therian forme',
    'incarnate forme', 'fusion forme', 'zen mode', 'standard mode', 'plant cloak', 'sandy cloak',
    'trash cloak'
)
FORM_ABILITIES = {
    'stance-change', 'forecast', 'schooling', 'shields-down', 'hunger-switch', 'gulp-missile',
    'disguise', 'rks-system', 'multitype', 'zen-mode', 'fabulous-trim', 'quick-cloak', 'seasonal'
}
# Flower Gift is intentionally absent: the bundled PTU Core definition is a Sunny burst buff, not a Form rule.
FORM_CAPABILITIES = {
    'forme-change', 'multiform', 'origin-forme', 'sky-forme', 'therian-forme', 'dragon-fusion',
    'viral-fusion', 'zygarde-cells', 'weapon-bond', 'nectar-dancer'
}


def norm(value: object) -> str:
    return re.sub(r'[^a-z0-9]+', '-', str(value or '').lower()).strip('-')


def words(value: object) -> set[str]:
    return {w for w in norm(value).split('-') if w}


def row_id(row: dict) -> str:
    return str(row.get('logical_id') or row.get('id') or '')


def row_name(row: dict) -> str:
    return str(row.get('display_name') or row.get('name') or row_id(row))


def ability_names(row: dict) -> set[str]:
    out = set()
    for ability in row.get('ability_slots') or row.get('abilities') or []:
        if isinstance(ability, dict):
            out.add(norm(ability.get('name') or ability.get('ability_id')))
        else:
            out.add(norm(ability))
    return {x for x in out if x}


def capability_names(row: dict) -> set[str]:
    out = set()
    for capability in row.get('capabilities') or []:
        if isinstance(capability, dict):
            out.add(norm(capability.get('name') or capability.get('capability_id')))
        else:
            out.add(norm(capability))
    return {x for x in out if x}


def embedded_signals(row: dict) -> list[str]:
    raw = str(row.get('raw_text') or '')
    found = []
    if re.search(r'(?im)^\s*(?:Type Information|Appliance Forms|Forme? Change|\w+ Forms?)\s*$', raw):
        found.append('embedded_form_section')
    # Pumpkaboo/Gourgeist: four size-specific Base Stat columns are embedded in one Species entry.
    if re.search(r'(?is)Base Stats:\s*Small:\s*Average:.*?Large:\s*Super:', raw):
        found.append('embedded_size_forms:small,average,large,super')
    # Basculin: the supplied PTU entry explicitly parameterizes an Ability by Red/Blue coloration.
    if re.search(r'(?i)Reckless\s*\(Red\)\s*/\s*Rock Head\s*\(Blue\)', raw):
        found.append('embedded_color_forms:red,blue')
    # Explicit male/female records may use '(M)/(F)' rather than the full words in normalized names.
    name = row_name(row)
    if re.search(r'\(M\)\s*$', name, flags=re.I):
        found.append('gender_form:male')
    if re.search(r'\(F\)\s*$', name, flags=re.I):
        found.append('gender_form:female')
    return found


def signals(row: dict, existing_ids: set[str]) -> list[str]:
    ident = row_id(row)
    name = row_name(row)
    token_set = words(f'{ident} {name}')
    phrase_hay = re.sub(r'[^a-z0-9]+', ' ', f'{ident} {name}'.lower())
    ability_set = ability_names(row)
    capability_set = capability_names(row)
    found = []
    if ident in existing_ids:
        found.append('existing_inventory')
    if row.get('variant_of') or row.get('variant_kind'):
        found.append('structured_variant_metadata')
    region_hits = sorted(REGIONS & token_set)
    if region_hits:
        found.append('regional_name:' + ','.join(region_hits))
    descriptor_hits = sorted(FORM_WORDS & token_set)
    if descriptor_hits:
        found.append('name_descriptor:' + ','.join(descriptor_hits))
    phrase_hits = [phrase for phrase in PHRASE_SIGNALS if phrase in phrase_hay]
    if phrase_hits:
        found.append('name_phrase:' + ','.join(phrase_hits))
    ability_hits = sorted(FORM_ABILITIES & ability_set)
    if ability_hits:
        found.append('form_ability:' + ','.join(ability_hits))
    capability_hits = sorted(FORM_CAPABILITIES & capability_set)
    if capability_hits:
        found.append('form_capability:' + ','.join(capability_hits))
    found.extend(embedded_signals(row))
    return found


def compact(row: dict, found: list[str]) -> dict:
    return {
        'id': row_id(row),
        'name': row_name(row),
        'source_page': row.get('source_page'),
        'variant_of': row.get('variant_of'),
        'variant_kind': row.get('variant_kind'),
        'types': row.get('types'),
        'base_stats': row.get('base_stats'),
        'abilities': sorted(ability_names(row)),
        'capabilities': sorted(capability_names(row)),
        'signals': found,
    }


def likely_family_key(row: dict) -> str:
    ident = norm(row_id(row))
    prefixes = (
        'darmanitan-', 'deoxys-', 'giratina-', 'shaymin-', 'tornadus-', 'thundurus-', 'landorus-',
        'kyurem-', 'zygarde-', 'hoopa-', 'zacian-', 'zamazenta-', 'necrozma-', 'meloetta-',
        'wishiwashi-', 'minior-', 'eiscue-', 'rotom-', 'lycanroc-', 'toxtricity-', 'urshifu-',
        'calyrex-', 'wormadam-', 'burmy-', 'shellos-', 'gastrodon-', 'basculin-', 'deerling-',
        'sawsbuck-', 'pumpkaboo-', 'gourgeist-', 'meowstic-', 'indeedee-', 'furfrou-', 'vivillon-'
    )
    for prefix in prefixes:
        if ident.startswith(prefix):
            return prefix[:-1]
    for region in REGIONS:
        suffix = '-' + region
        if ident.endswith(suffix):
            return ident[:-len(suffix)]
    return ident


with zipfile.ZipFile(PACK) as z:
    species_path = next(n for n in z.namelist() if n.endswith('species.ndjson'))
    rows = [json.loads(line) for line in z.read(species_path).decode('utf-8').splitlines() if line.strip()]

inventory = json.loads(INVENTORY.read_text(encoding='utf-8'))
existing_ids = {str(row.get('id') or '') for row in inventory.get('alternate_form_candidates', [])}

candidates = []
for row in rows:
    found = signals(row, existing_ids)
    if found:
        candidates.append(compact(row, found))

by_family: dict[str, list[dict]] = defaultdict(list)
row_lookup = {row_id(row): row for row in rows}
for candidate in candidates:
    by_family[likely_family_key(row_lookup[candidate['id']])].append(candidate)

new_ids = sorted({row['id'] for row in candidates} - existing_ids)
missing_ids = sorted(existing_ids - {row['id'] for row in candidates})
signal_counts = Counter(sig.split(':', 1)[0] for row in candidates for sig in row['signals'])
legacy_only = sorted(row['id'] for row in candidates if row['signals'] == ['existing_inventory'])

payload = {
    'schema_version': 2,
    'source': str(PACK.relative_to(REPO)),
    'species_count': len(rows),
    'previous_inventory_candidate_count': len(existing_ids),
    'expanded_candidate_count': len(candidates),
    'new_candidate_ids': new_ids,
    'previous_candidates_not_rediscovered': missing_ids,
    'legacy_inventory_only_ids': legacy_only,
    'signal_counts': dict(sorted(signal_counts.items())),
    'families': [
        {'family': family, 'records': sorted(records, key=lambda x: (x.get('source_page') or 9999, x['id']))}
        for family, records in sorted(by_family.items())
    ],
}
OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

lines = [
    '# PTU Forms Expanded Discovery Audit', '',
    'This is a discovery/audit artifact. It deliberately over-collects source-backed form signals before classification and does not modify bundled `.ptucp` packs.', '',
    f'- Parsed Species records: **{len(rows)}**',
    f'- Previous inventory candidates: **{len(existing_ids)}**',
    f'- Expanded source-signal candidates: **{len(candidates)}**',
    f'- Newly discovered candidate records: **{len(new_ids)}**',
    f'- Previous candidates not rediscovered by hardened signals: **{len(missing_ids)}**',
    f'- Legacy-only candidates with no independent hardened signal: **{len(legacy_only)}**', '',
    '## New candidates beyond the first inventory', ''
]
for ident in new_ids:
    row = next(x for x in candidates if x['id'] == ident)
    lines.append(f'- `{ident}` — {row["name"]} (p. {row.get("source_page") or "—"}); signals: {", ".join(row["signals"])}')
if not new_ids:
    lines.append('- None.')
lines += ['', '## Legacy-only review queue', '']
for ident in legacy_only:
    lines.append(f'- `{ident}` — retained only because it appeared in the first census; classification must reject or independently source it.')
if not legacy_only:
    lines.append('- None.')
lines += ['', '## Candidate families', '']
for family, records in sorted(by_family.items()):
    lines.append(f'### {family}')
    for row in sorted(records, key=lambda x: (x.get('source_page') or 9999, x['id'])):
        lines.append(f'- `{row["id"]}` — {row["name"]} (p. {row.get("source_page") or "—"}); {"; ".join(row["signals"])}')
    lines.append('')
lines += ['## Discovery notes', '',
    '- `existing_inventory` means the record was already in the first census; by itself it is not evidence of a Form.',
    '- `form_capability` / `form_ability`, embedded parameter blocks, structured variant metadata, and explicit gender/regional records are stronger signals than broad name matching.',
    '- Flower Gift is not treated as a Form-driving Ability because the supplied PTU Core definition is a Sunny burst buff, not a Cherrim transformation rule.',
    '- Embedded size and color parameter blocks are inventoried even when the source stores them inside a single Species record.',
    '- Records discovered only by broad naming signals are not automatically Forms; classification must promote them with source evidence or reject them.',
]
OUT_MD.write_text('\n'.join(lines) + '\n', encoding='utf-8')

print(json.dumps({
    'species': len(rows),
    'previous': len(existing_ids),
    'expanded': len(candidates),
    'new': len(new_ids),
    'missing': len(missing_ids),
    'legacy_only': legacy_only,
    'new_ids': new_ids,
}, ensure_ascii=False))
