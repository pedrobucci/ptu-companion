#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PACK=ROOT/'seed'/'content-packs'/'ptu-gen8ish-pokedex.ptucp'

TOKENS=('mega','alola','galar','hisu','form','forme','mode','rotom','deoxys','giratina','shaymin','tornadus','thundurus','landorus','kyurem','zygarde','hoopa','zacian','zamazenta','necrozma','meloetta','keldeo','wishiwashi','minior','aegislash','darmanitan','eiscue','oricorio','castform','cherrim','arceus','silvally','morpeko','cramorant','mimikyu')

def norm(v):
    return re.sub(r'[^a-z0-9]+','-',str(v or '').lower()).strip('-')

with zipfile.ZipFile(PACK) as z:
    names=z.namelist()
    species_path=next((n for n in names if n.endswith('species.ndjson')),None)
    if not species_path:
        raise SystemExit(f'No species.ndjson in {PACK}; entries={names[:20]}')
    rows=[json.loads(line) for line in z.read(species_path).decode('utf-8').splitlines() if line.strip()]

print(f'PACK={PACK.name} species={len(rows)} path={species_path}')
print('KEYS=',sorted({k for row in rows for k in row.keys()}))

# Source records whose id/name/raw metadata explicitly suggests alternate presentation/form state.
for row in rows:
    ident=norm(row.get('logical_id') or row.get('id'))
    name=str(row.get('name') or row.get('display_name') or '')
    hay=norm(f'{ident} {name} {row.get("form","")} {row.get("forme","")} {row.get("variant","")}')
    if any(tok in hay for tok in TOKENS):
        print('CANDIDATE',json.dumps({
            'id':row.get('logical_id') or row.get('id'),
            'name':name,
            'number':row.get('number') or row.get('dex_number') or row.get('pokedex_number'),
            'types':row.get('types') or row.get('type'),
            'base_stats':row.get('base_stats'),
            'abilities':row.get('ability_slots') or row.get('abilities'),
            'capabilities':row.get('capabilities'),
            'source_page':row.get('source_page')
        },ensure_ascii=False,separators=(',',':')))

# Duplicate Pokédex numbers are another strong signal for separately parameterized regional/forms records.
by_num=defaultdict(list)
for row in rows:
    num=row.get('number') or row.get('dex_number') or row.get('pokedex_number')
    if num is not None:
        by_num[str(num)].append(row)
for num,group in sorted(by_num.items(),key=lambda kv:(int(kv[0]) if kv[0].isdigit() else 99999,kv[0])):
    if len(group)>1:
        print('DUPDEX',num,json.dumps([{'id':r.get('logical_id') or r.get('id'),'name':r.get('name') or r.get('display_name')} for r in group],ensure_ascii=False,separators=(',',':')))
