#!/usr/bin/env python3
from pathlib import Path

from apply_stage_b_combat_manual_physical_dice import main as apply_manual_physical_dice
from apply_stage_b_combat_move_outcomes import main as apply_move_outcomes
from apply_stage_b_combat_self_outcomes import main as apply_self_outcomes
from apply_stage_b_combat_non_move_resources import main as apply_non_move_resources
from apply_stage_b_combat_non_move_session_docs import main as apply_non_move_session_docs

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
print({'targets':len(TARGETS),'fixups':len(REPLACEMENTS),'self_outcomes':True,'non_move_resources':True})
apply_manual_physical_dice()
apply_move_outcomes()
apply_self_outcomes()
apply_non_move_resources()
apply_non_move_session_docs()

# The legacy physical-dice patch historically anchors at the `function` token of
# pokemonCombatOpenMove. When the ledger source already declares it `async`, that
# can leave the original `async ` prefix in place. Normalize the generated surface
# after all deterministic layers so full rebuilds remain syntactically idempotent.
for path in TARGETS:
    text=path.read_text(encoding='utf-8')
    bad='async async function pokemonCombatOpenMove('
    if bad in text:
        text=text.replace(bad,'async function pokemonCombatOpenMove(',1)
        path.write_text(text,encoding='utf-8')
    if 'async async function ' in text:
        raise SystemExit(f'Duplicate async declaration remains after Combat fixups: {path}')
