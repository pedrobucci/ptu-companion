#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parent
DOC_JSON=REPO/'docs'/'data'/'PTU_COMBAT_SESSION_LEDGER.json'
DOC_MD=REPO/'docs'/'PTU_COMBAT_SESSION_LEDGER.md'


def patch_json() -> bool:
    data=json.loads(DOC_JSON.read_text(encoding='utf-8'))
    before=json.dumps(data,sort_keys=True,ensure_ascii=False)
    shared=data.setdefault('shared_resources',{})
    shared['non_move_sources']={
        'enabled':True,
        'kinds':['Ability','Form action','Capability'],
        'source_keyed':True,
        'shares_move_action_frequency_ledger':True,
        'refund_supported':True,
        'extended_action':'source-labeled/informational; not converted into Standard/Shift/Swift actions',
    }
    future=[item for item in shared.get('future',[]) if item not in ['source-keyed Abilities','Form lifecycle spending']]
    if 'Extended Action progress' not in future:future.append('Extended Action progress')
    shared['future']=future
    data['form_resource_spending']={
        'enabled_subset':['Schooling','Power Construct','Aegislash manual Stance Change','Ice Face Hail restoration','Weapon Bond entry/relinquish'],
        'policy':'only source-explicit action/frequency metadata is consumed; failed/no-op lifecycle events refund reserved resources',
    }
    rendered=json.dumps(data,indent=2,ensure_ascii=False)+'\n'
    changed=before!=json.dumps(data,sort_keys=True,ensure_ascii=False) or DOC_JSON.read_text(encoding='utf-8')!=rendered
    if changed:DOC_JSON.write_text(rendered,encoding='utf-8')
    return changed


def patch_md() -> bool:
    md=DOC_MD.read_text(encoding='utf-8');original=md
    start=md.find('## Form / Ability resource integration')
    if start<0:start=md.find('## Form integration')
    end=md.find('## PTU source anchors',start)
    if start<0 or end<0:raise SystemExit('Combat ledger Form integration documentation anchors drifted')
    section='''## Form / Ability resource integration\n\n- Entering/leaving the Combat session dispatches the existing Form `battle-start` / `battle-end` events.\n- Resolved Move use dispatches the existing `move-used` Form event.\n- HP controls continue to use the existing HP/Form lifecycle path.\n- Source-explicit non-Move actions now consume the **same per-Pokémon action/frequency ledger** used by Moves; there is no second resource system.\n- Enabled exact subset: Schooling (`Daily – Free Action`), Power Construct (`Daily – Swift Action`), Aegislash manual Stance Change (`Full Action`), Ice Face Hail restoration (`Standard Action`), and Weapon Bond entry/relinquish (`Extended Action`).\n- Ability/Form/Capability frequency keys are namespaced by source kind and source key, preventing collisions with Moves or similarly named sources.\n- Resource spending is atomic around lifecycle events: an invalid or no-op event refunds the reserved action/frequency.\n- Recent non-Move resource transactions expose a resource-only correction/refund control. It restores only tokens/counters spent by that transaction and does not rewind HP, Form state, Move outcomes, or later game state.\n- Weapon Bond's Extended Action remains faithfully labeled but is not converted into Standard/Shift/Swift turn economy; Extended Action progress is still not modeled.\n\n'''
    md=md[:start]+section+md[end:]
    md=md.replace('- Extended Action progress is reserved for a later shared-ledger layer.','- Extended Actions remain source-labeled/informational; multi-step Extended Action progress is not modeled as turn actions.')
    if md!=original:DOC_MD.write_text(md,encoding='utf-8');return True
    return False


def main() -> None:
    print({'combat_session_non_move_docs':1,'json_changed':patch_json(),'md_changed':patch_md()})


if __name__=='__main__':main()
