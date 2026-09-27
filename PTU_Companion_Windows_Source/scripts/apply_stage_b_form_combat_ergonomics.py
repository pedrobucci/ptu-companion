#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
TARGETS = [
    ROOT / 'static-preview' / 'app.js',
    REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'app.js',
]
AUDIT_JSON = REPO / 'docs' / 'data' / 'PTU_FORMS_COMBAT_RESOURCE_AUDIT.json'
AUDIT_MD = REPO / 'docs' / 'PTU_FORMS_COMBAT_RESOURCE_AUDIT.md'

HELPER = r"""function pokemonFormCombatPresentation(p,data){
  if(!p?.details?.speciesDefinitionId)return null;
  const forms=Array.isArray(data?.species?.forms)?data.species.forms:[];const current=pokemonFormCurrentState(p);const label=pokemonFormStateLabel(current,forms);
  const recent=(trainer()?.history||[]).slice().reverse().find(entry=>entry?.title==='Pokémon Form changed'&&String(entry?.detail||'').startsWith(`${p.name}:`))||null;
  return {current,label,recent,forms};
}
function pokemonFormCombatIndicator(p,data){
  const model=pokemonFormCombatPresentation(p,data);if(!model)return '';
  const tone=model.current.activeFormId?'chip-purple':'chip-blue';const recent=model.recent?`<small>Latest transition: ${esc(model.recent.detail)}</small>`:'<small>No automatic Form transition recorded yet.</small>';
  return `<div class="flow-note form-combat-indicator"><div class="row-between"><strong>Current Form</strong>${chip(esc(model.label),tone)}</div>${recent}</div>`;
}
"""

CREATURE_ANCHOR = 'function creatureScreen(){'
SUMMARY_OLD = '  const formSummaryBlock=pokemonFormSummaryBlock(p,data);\n  const sheet=`<div class="creature-detail-grid">${section(\'ACTIVE STATE\',`<div class="battle-controls">'
SUMMARY_NEW = '  const formSummaryBlock=pokemonFormSummaryBlock(p,data);\n  const formCombatIndicator=pokemonFormCombatIndicator(p,data);\n  const sheet=`<div class="creature-detail-grid">${section(\'ACTIVE STATE\',`${formCombatIndicator}<div class="battle-controls">'

AUDIT = {
    'schema_version': 1,
    'scope': 'Existing Pokémon combat action/frequency state available to source-explicit Form lifecycle rules',
    'conclusion': 'informational_only',
    'automatic_spending_supported': False,
    'exact_auto_spend_subset': [],
    'observed_state': [
        {
            'resource': 'global_round_scene_day',
            'location': 'state.ui.round / state.ui.scene / state.ui.day',
            'supports': 'time boundaries only',
            'does_not_support': 'per-Pokémon action expenditure or per-source usage counts',
        },
        {
            'resource': 'trainer_action_points',
            'location': 'trainer.details.currentAp / trainerDerived().maxAp',
            'supports': 'Trainer AP only',
            'does_not_support': 'Pokémon Free/Swift/Standard/Full/Extended Action economy',
        },
        {
            'resource': 'pokemon_combat_state',
            'location': 'Pokémon hp/tempHp/injuries/combatStages/formState',
            'supports': 'HP, THP, injuries, Combat Stages and Form state',
            'does_not_support': 'action slots, turn expenditure, Daily/Scene usage ledger or Extended Action progress',
        },
        {
            'resource': 'definition_frequency_text',
            'location': 'Move/Ability/Form definition frequency fields',
            'supports': 'display/reference metadata',
            'does_not_support': 'authoritative remaining-use counters',
        },
        {
            'resource': 'form_lifecycle_applied_rules',
            'location': 'appliedRules.actionCost / appliedRules.frequency',
            'supports': 'exact source labels returned to the caller',
            'does_not_support': 'resource consumption without a ledger',
        },
    ],
    'boundaries': [
        {'event': 'nextRound', 'behavior': 'increments global round only'},
        {'event': 'endScene', 'behavior': 'increments scene, resets round and Combat Stages, dispatches scene-end Form events'},
        {'event': 'newDay', 'behavior': 'increments day and resets scene/round only'},
    ],
    'blocked_spending_cases': [
        {'cost': 'Free Action', 'reason': 'No per-Pokémon turn/action ledger exists.'},
        {'cost': 'Swift Action', 'reason': 'No per-Pokémon turn/action ledger exists.'},
        {'cost': 'Standard Action', 'reason': 'No per-Pokémon turn/action ledger exists.'},
        {'cost': 'Full Action', 'reason': 'No per-Pokémon turn/action ledger exists.'},
        {'cost': 'Extended Action', 'reason': 'No Extended Action progress/completion model exists.'},
        {'frequency': 'Daily', 'reason': 'No per-Pokémon/per-source Daily usage ledger exists.'},
        {'frequency': 'Scene', 'reason': 'No per-Pokémon/per-source Scene usage ledger exists.'},
    ],
    'policy': [
        'Do not infer Trainer Action Points as Pokémon action economy.',
        'Do not create usage counters implicitly inside the Form engine without a shared combat-resource model.',
        'Continue surfacing actionCost and frequency as source metadata/history.',
        'A future resource ledger must define reset boundaries and source identity before automatic spending is enabled.',
    ],
}


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'Anchor drifted: {label}')
    return text.replace(old, new, 1)


def validate_resource_anchors(path: Path, text: str) -> None:
    required = [
        "ui:{screen:'dashboard',creatureTab:'sheet',trainerTab:'profile',toast:null,round:1,scene:1,day:1,gmOverride:false}",
        'currentAp:null',
        'function nextRound(){ state.ui.round+=1;',
        'async function endScene(){ state.ui.scene+=1; state.ui.round=1;',
        'function newDay(){ state.ui.day+=1; state.ui.scene=1; state.ui.round=1;',
        'const bits=[rule.frequency,rule.actionCost].filter(Boolean)',
        'Action/frequency costs are shown by the source rules but are not silently consumed by the Form engine.',
    ]
    missing = [needle for needle in required if needle not in text]
    if missing:
        raise SystemExit(f'Combat-resource audit anchors missing in {path}: {missing}')
    prohibited = ['pokemonActionLedger', 'pokemonFrequencyLedger', 'formActionUsageLedger']
    present = [needle for needle in prohibited if needle in text]
    if present:
        raise SystemExit(f'Combat-resource audit must be revisited because a resource ledger now exists in {path}: {present}')


def patch_client(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    original = text
    validate_resource_anchors(path, text)
    if 'function pokemonFormCombatPresentation' not in text:
        if CREATURE_ANCHOR not in text:
            raise SystemExit(f'Creature screen anchor drifted: {path}')
        text = text.replace(CREATURE_ANCHOR, HELPER + '\n' + CREATURE_ANCHOR, 1)
    text = replace_once(text, SUMMARY_OLD, SUMMARY_NEW, f'compact Form indicator in {path}')
    if text != original:
        path.write_text(text, encoding='utf-8')
        return True
    return False


def write_audit() -> None:
    AUDIT_JSON.parent.mkdir(parents=True, exist_ok=True)
    AUDIT_JSON.write_text(json.dumps(AUDIT, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    lines = [
        '# PTU Forms — Combat Resource Audit',
        '',
        'Audit of the **existing** campaign combat state before any automatic spending of Form action/frequency costs.',
        '',
        '- Conclusion: **informational only**',
        '- Automatic spending supported by the current combat model: **No**',
        '- Exact automatic-spending subset: **0**',
        '',
        'The lifecycle engine may continue to return exact source labels such as `Daily`, `Scene`, `Free Action`, `Swift Action`, `Standard Action`, `Full Action`, and `Extended Action`, but the current application does not have a lossless Pokémon resource ledger in which those costs can be consumed.',
        '',
        '## Existing state',
        '',
        '| Resource | Existing support | Missing for automatic Form spending |',
        '| --- | --- | --- |',
    ]
    for row in AUDIT['observed_state']:
        lines.append(f"| `{row['resource']}` | {row['supports']} | {row['does_not_support']} |")
    lines += [
        '',
        '## Reset / time boundaries',
        '',
    ]
    for row in AUDIT['boundaries']:
        lines.append(f"- `{row['event']}`: {row['behavior']}.")
    lines += [
        '',
        '## Why no cost is auto-spent yet',
        '',
    ]
    for row in AUDIT['blocked_spending_cases']:
        key = row.get('cost') or row.get('frequency')
        lines.append(f"- **{key}:** {row['reason']}")
    lines += [
        '',
        '## Policy',
        '',
    ]
    for item in AUDIT['policy']:
        lines.append(f'- {item}')
    lines += [
        '',
        'This audit does not change any PTU source mechanics, persisted Form IDs, deferred-family status, or default content packs.',
        ''
    ]
    AUDIT_MD.write_text('\n'.join(lines), encoding='utf-8')


def main() -> None:
    changed = [str(path.relative_to(REPO)) for path in TARGETS if patch_client(path)]
    write_audit()
    print({
        'changed': changed,
        'targets': len(TARGETS),
        'combat_resource_audit_version': 1,
        'automatic_spending_supported': False,
        'exact_auto_spend_subset': 0,
        'compact_form_indicator': True,
    })


if __name__ == '__main__':
    main()
