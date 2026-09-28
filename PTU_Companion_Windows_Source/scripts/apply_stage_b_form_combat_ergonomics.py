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

# Historical checkpoint retained for traceability. The shared Combat ledger now
# supersedes these pre-ledger conclusions; this script must therefore remain safe
# when run against either an old pre-ledger surface or the current ledger-enabled UI.
AUDIT = {
    'schema_version': 1,
    'scope': 'Historical Pokémon combat action/frequency state before the shared Combat ledger',
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
        {'cost': 'Free Action', 'reason': 'No per-Pokémon turn/action ledger existed at this checkpoint.'},
        {'cost': 'Swift Action', 'reason': 'No per-Pokémon turn/action ledger existed at this checkpoint.'},
        {'cost': 'Standard Action', 'reason': 'No per-Pokémon turn/action ledger existed at this checkpoint.'},
        {'cost': 'Full Action', 'reason': 'No per-Pokémon turn/action ledger existed at this checkpoint.'},
        {'cost': 'Extended Action', 'reason': 'No Extended Action progress/completion model existed at this checkpoint.'},
        {'frequency': 'Daily', 'reason': 'No per-Pokémon/per-source Daily usage ledger existed at this checkpoint.'},
        {'frequency': 'Scene', 'reason': 'No per-Pokémon/per-source Scene usage ledger existed at this checkpoint.'},
    ],
    'policy': [
        'Do not infer Trainer Action Points as Pokémon action economy.',
        'Do not create usage counters implicitly inside the Form engine without a shared combat-resource model.',
        'Continue surfacing actionCost and frequency as source metadata/history.',
        'A shared resource ledger must define reset boundaries and source identity before automatic spending is enabled.',
    ],
    'status': 'historical_pre_ledger_snapshot',
    'superseded_by': 'docs/PTU_COMBAT_SESSION_LEDGER.md',
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
    ]
    missing = [needle for needle in required if needle not in text]
    if missing:
        raise SystemExit(f'Combat-resource historical audit anchors missing in {path}: {missing}')
    lifecycle_notes = [
        'Action/frequency costs are shown by the source rules but are not silently consumed by the Form engine.',
        'Combat Actions and Scene/Daily uses share the Pokémon Combat ledger. Extended Actions remain source-labeled but are not converted into turn actions.',
    ]
    if not any(note in text for note in lifecycle_notes):
        raise SystemExit(f'Combat-resource lifecycle note drifted in {path}')


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
        '**Historical checkpoint:** this document records the application state before the shared Pokémon Combat ledger was introduced. Current behavior is documented in `docs/PTU_COMBAT_SESSION_LEDGER.md` and the non-Move resource model.',
        '',
        '- Historical conclusion: **informational only**',
        '- Automatic spending supported at this historical checkpoint: **No**',
        '- Exact automatic-spending subset: **0**',
        '',
        'At this checkpoint, the lifecycle engine could return exact source labels such as `Daily`, `Scene`, `Free Action`, `Swift Action`, `Standard Action`, `Full Action`, and `Extended Action`, but the application did not yet have a lossless Pokémon resource ledger in which those costs could be consumed.',
        '',
        '## Historical state',
        '',
        '| Resource | Existing support | Missing for automatic Form spending |',
        '| --- | --- | --- |',
    ]
    for row in AUDIT['observed_state']:
        lines.append(f"| `{row['resource']}` | {row['supports']} | {row['does_not_support']} |")
    lines += [
        '',
        '## Historical reset / time boundaries',
        '',
    ]
    for row in AUDIT['boundaries']:
        lines.append(f"- `{row['event']}`: {row['behavior']}.")
    lines += [
        '',
        '## Why no cost was auto-spent at this checkpoint',
        '',
    ]
    for row in AUDIT['blocked_spending_cases']:
        key = row.get('cost') or row.get('frequency')
        lines.append(f"- **{key}:** {row['reason']}")
    lines += [
        '',
        '## Historical policy',
        '',
    ]
    for item in AUDIT['policy']:
        lines.append(f'- {item}')
    lines += [
        '',
        'This historical audit does not change any PTU source mechanics, persisted Form IDs, deferred-family status, or default content packs.',
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
        'status': 'historical_pre_ledger_snapshot',
        'automatic_spending_supported_at_checkpoint': False,
        'exact_auto_spend_subset_at_checkpoint': 0,
        'compact_form_indicator': True,
    })


if __name__ == '__main__':
    main()
