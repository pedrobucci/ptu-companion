#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
PACK_DIR = ROOT / 'seed' / 'content-packs'
OUT_JSON = REPO / 'docs' / 'data' / 'PTU_FORM_MECHANICS_AUDIT.json'
OUT_MD = REPO / 'docs' / 'PTU_FORM_MECHANICS_AUDIT.md'

TARGETS = {
    'stance-change','forecast','flower-gift','schooling','shields-down','hunger-switch','gulp-missile','disguise',
    'rks-system','multitype','zen-mode','zen-snowed','seasonal','fabulous-trim','quick-cloak','ice-face',
    'forme-change','multiform','origin-forme','sky-forme','therian-forme','dragon-fusion','viral-fusion',
    'zygarde-cells','weapon-bond','nectar-dancer','confined'
}


def norm(value: object) -> str:
    return re.sub(r'[^a-z0-9]+','-',str(value or '').lower()).strip('-')


def load_ndjson(z: zipfile.ZipFile, path: str) -> list[dict]:
    return [json.loads(line) for line in z.read(path).decode('utf-8').splitlines() if line.strip()]


def text_value(row: dict) -> str:
    for key in ('description','effect','rules_text','text','raw_text','summary'):
        value = row.get(key)
        if value:
            return re.sub(r'\s+',' ',str(value)).strip()
    return ''

hits = []
for pack in sorted(PACK_DIR.glob('*.ptucp')):
    with zipfile.ZipFile(pack) as z:
        for path in z.namelist():
            if not path.endswith(('.ndjson','.jsonl')):
                continue
            if not any(kind in path.lower() for kind in ('abilit','capabilit')):
                continue
            try:
                rows = load_ndjson(z,path)
            except Exception:
                continue
            for row in rows:
                ident = norm(row.get('logical_id') or row.get('id'))
                name = norm(row.get('display_name') or row.get('name'))
                if ident not in TARGETS and name not in TARGETS:
                    continue
                hits.append({
                    'target': ident if ident in TARGETS else name,
                    'pack': pack.name,
                    'path': path,
                    'id': row.get('logical_id') or row.get('id'),
                    'name': row.get('display_name') or row.get('name'),
                    'source_page': row.get('source_page'),
                    'frequency': row.get('frequency'),
                    'action': row.get('action') or row.get('action_type'),
                    'trigger': row.get('trigger'),
                    'effect': row.get('effect'),
                    'description': row.get('description'),
                    'rules_text': row.get('rules_text'),
                    'raw_text': row.get('raw_text'),
                    'keys': sorted(row.keys()),
                })

by_target = {target: [] for target in sorted(TARGETS)}
for hit in hits:
    by_target.setdefault(hit['target'],[]).append(hit)

payload = {
    'schema_version': 1,
    'targets': sorted(TARGETS),
    'found_targets': sorted(target for target, rows in by_target.items() if rows),
    'missing_targets': sorted(target for target, rows in by_target.items() if not rows),
    'definitions': by_target,
}
OUT_JSON.parent.mkdir(parents=True,exist_ok=True)
OUT_JSON.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

lines = [
    '# PTU Form-driving Mechanics Audit','',
    'This report searches the bundled PTU content packs for Ability/Capability definitions that explicitly drive alternate forms. Missing definitions are reported rather than inferred.','',
    f'- Targets audited: **{len(TARGETS)}**',
    f'- Targets found in bundled definitions: **{len(payload["found_targets"])}**',
    f'- Targets missing from bundled definitions: **{len(payload["missing_targets"])}**','',
    '## Definitions',''
]
for target in sorted(TARGETS):
    rows = by_target.get(target) or []
    lines.append(f'### `{target}`')
    if not rows:
        lines.append('- No bundled Ability/Capability definition found; do not invent an automatic requirement or trigger.')
        lines.append('')
        continue
    for row in rows:
        text = text_value(row)
        lines.append(f'- **{row.get("name") or row.get("id")}** — `{row["pack"]}:{row["path"]}`' + (f', source p. {row["source_page"]}' if row.get('source_page') else ''))
        if row.get('frequency'):
            lines.append(f'  - Frequency: {row["frequency"]}')
        if row.get('action'):
            lines.append(f'  - Action: {row["action"]}')
        if row.get('trigger'):
            lines.append(f'  - Trigger: {re.sub(r"\\s+"," ",str(row["trigger"])).strip()}')
        if text:
            lines.append(f'  - Rules: {text}')
    lines.append('')
lines += ['## Missing definitions','']
for target in payload['missing_targets']:
    lines.append(f'- `{target}`')
lines += ['', 'Missing here means the bundled definition packs do not expose a stable structured rule entry under that name. Conversion must use a manual/source-backed condition or await a better source; it must not guess from main-series game behavior.']
OUT_MD.write_text('\n'.join(lines)+'\n',encoding='utf-8')

print(json.dumps({'targets':len(TARGETS),'found':len(payload['found_targets']),'missing':payload['missing_targets']},ensure_ascii=False))
