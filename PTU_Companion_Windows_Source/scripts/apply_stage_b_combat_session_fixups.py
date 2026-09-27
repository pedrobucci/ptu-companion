#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parent
TARGETS=[ROOT/'static-preview'/'app.js',REPO/'PTU_Companion_Android_Tauri'/'www'/'app.js']

REPLACEMENTS=[
    (
        "function pokemonCombatActionCostForMove(def={}){const text=`${def.range||''} ${def.effect||''}`;if(/\\bFull Action\\b/i.test(text))return 'Full Action';if(/\\bSwift Action\\b/i.test(text))return 'Swift Action';if(/\\bShift Action\\b/i.test(text))return 'Shift Action';if(/\\bFree Action\\b/i.test(text))return 'Free Action';return 'Standard Action';}",
        "function pokemonCombatActionCostForMove(def={}){const text=String(def.range||'');if(/\\bFull Action\\b/i.test(text))return 'Full Action';if(/\\bSwift Action\\b/i.test(text))return 'Swift Action';if(/\\bShift Action\\b/i.test(text))return 'Shift Action';if(/\\bFree Action\\b/i.test(text))return 'Free Action';return 'Standard Action';}",
        'Move action cost must come from the Move action/range declaration, not incidental effect text.'
    ),
    (
        "const row=id?pokemonCombatParticipant(id):null;if(row){row.log.push(entry);row.log=row.log.slice(-60);}",
        "const row=id?pokemonCombatParticipant(id,{create:false}):null;if(row){row.log.push(entry);row.log=row.log.slice(-60);}",
        'Combat logging must not recreate a participant that was just removed.'
    ),
]

for path in TARGETS:
    text=path.read_text(encoding='utf-8');original=text
    for old,new,label in REPLACEMENTS:
        if new in text:continue
        if old not in text:raise SystemExit(f'Fixup anchor drifted in {path}: {label}')
        text=text.replace(old,new,1)
    if text!=original:path.write_text(text,encoding='utf-8')
print({'targets':len(TARGETS),'fixups':len(REPLACEMENTS)})
