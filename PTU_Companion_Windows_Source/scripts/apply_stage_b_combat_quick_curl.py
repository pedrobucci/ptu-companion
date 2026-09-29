#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
CLIENTS = [ROOT / 'static-preview' / 'app.js', REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'app.js']
DOC_JSON = REPO / 'docs' / 'data' / 'PTU_COMBAT_QUICK_CURL.json'
DOC_MD = REPO / 'docs' / 'PTU_COMBAT_QUICK_CURL.md'
ABILITY_JSON = REPO / 'docs' / 'data' / 'PTU_COMBAT_ABILITY_ACTIONS.json'
ABILITY_MD = REPO / 'docs' / 'PTU_COMBAT_ABILITY_ACTIONS.md'
SESSION_JSON = REPO / 'docs' / 'data' / 'PTU_COMBAT_SESSION_LEDGER.json'
SESSION_MD = REPO / 'docs' / 'PTU_COMBAT_SESSION_LEDGER.md'


QUICK_CURL_HELPERS = r'''function pokemonCombatQuickCurlAbilityResourceSpec(){return pokemonCombatNonMoveSpec('ability','combat-quick-curl','Quick Curl','Free Action','Scene');}
function pokemonCombatQuickCurlDefenseResourceSpec(){return pokemonCombatNonMoveSpec('move','defense-curl-quick-curl','Defense Curl via Quick Curl','Swift Action','At-Will');}
function pokemonCombatQuickCurlAbilityRow(data){return (data?.abilities||[]).find(row=>pokemonCombatSlug(row?.name||row?.definition?.name)==='quick-curl')||null;}
function pokemonCombatQuickCurlDefenseMoveRow(data){return (data?.moves||[]).find(row=>pokemonCombatSlug(row?.definition?.name||row?.record?.name)==='defense-curl')||null;}
function pokemonCombatQuickCurlAbilitySourceMatches(row){
  if(!row||pokemonCombatSlug(row?.name||row?.definition?.name)!=='quick-curl')return false;const effect=String(row.definition?.effect||'').toLowerCase().replace(/[^a-z0-9+]+/g,' ');return effect.includes('connection defense curl')&&effect.includes('use defense curl as a swift action');
}
function pokemonCombatQuickCurlDefenseSourceMatches(row){
  if(!row||pokemonCombatSlug(row?.definition?.name||row?.record?.name)!=='defense-curl')return false;const frequency=String(row.definition?.frequency||row.record?.frequency||'At-Will');if(frequency&&!/^at-will$/i.test(frequency.trim()))return false;const range=String(row.definition?.range||row.record?.range||'');if(range&&!/\bself\b/i.test(range))return false;const effect=String(row.definition?.effect||'').toLowerCase().replace(/[^a-z0-9+]+/g,' ');return effect.includes('becomes curled up')&&effect.includes('immune to critical hits')&&effect.includes('10 damage reduction')&&effect.includes('accuracy is lowered by 4')&&effect.includes('stop being curled up as a swift action');
}
function pokemonCombatQuickCurlAvailability(id,data){
  const abilityRow=pokemonCombatQuickCurlAbilityRow(data),moveRow=pokemonCombatQuickCurlDefenseMoveRow(data);if(!abilityRow)return {valid:false,reason:'This Pokémon does not have Quick Curl.'};if(!moveRow)return {valid:false,abilityRow,reason:'Defense Curl is not available in this Pokémon Move list.'};if(!pokemonCombatQuickCurlAbilitySourceMatches(abilityRow))return {valid:false,abilityRow,moveRow,reason:'The active Quick Curl definition differs from the audited PTU source.'};if(!pokemonCombatQuickCurlDefenseSourceMatches(moveRow))return {valid:false,abilityRow,moveRow,reason:'The active Defense Curl definition differs from the audited PTU source.'};const ledger=pokemonCombatParticipant(id,{create:false});if(!ledger)return {valid:false,abilityRow,moveRow,reason:'Put this Pokémon in Combat first.'};if(ledger.moveState?.rollout?.active)return {valid:false,abilityRow,moveRow,reason:'Rollout is active; the user must continue Rollout until it misses or has no valid target.'};
  const ability=pokemonCombatQuickCurlAbilityResourceSpec(),abilityCheck=pokemonCombatNonMoveAvailability(id,ability);if(!abilityCheck.valid)return {...abilityCheck,abilityRow,moveRow,ability};const defense=pokemonCombatQuickCurlDefenseResourceSpec(),defenseCheck=pokemonCombatNonMoveAvailability(id,defense);if(!defenseCheck.valid)return {...defenseCheck,abilityRow,moveRow,ability,defense,abilityCheck};return {valid:true,abilityRow,moveRow,ability,defense,abilityCheck,defenseCheck};
}
function pokemonCombatQuickCurlSpendResources(id,data,{log=true}={}){
  const check=pokemonCombatQuickCurlAvailability(id,data);if(!check.valid)return check;const abilitySpend=pokemonCombatSpendNonMoveResource(id,check.ability,{log:false});if(!abilitySpend.valid)return abilitySpend;const defenseSpend=pokemonCombatSpendNonMoveResource(id,check.defense,{log:false});if(!defenseSpend.valid){if(abilitySpend.transaction)pokemonCombatRefundNonMoveResourceCore(id,abilitySpend.transaction.id,{log:false});return defenseSpend;}const participant=pokemonCombatParticipant(id,{create:false}),compositeId=`quick-curl-composite-${Number(participant?.resourceSequence||0)}`;if(abilitySpend.transaction){abilitySpend.transaction.compositeId=compositeId;abilitySpend.transaction.compositeRole='ability';}if(defenseSpend.transaction){defenseSpend.transaction.compositeId=compositeId;defenseSpend.transaction.compositeRole='move';}
  if(log)pokemonCombatLog(id,'Resources spent',`Quick Curl · Scene · Free Action · Defense Curl · ${defenseSpend.action?.spent||'Swift Action'}.`,'resource');return {...check,abilitySpend,defenseSpend,compositeId,transactions:[abilitySpend.transaction,defenseSpend.transaction].filter(Boolean)};
}
async function pokemonCombatUseQuickCurlDefenseCurl(id){
  const p=pokemon(id),data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null;if(!p||!data)return toast('Quick Curl reference data is unavailable.','error');const spent=pokemonCombatQuickCurlSpendResources(id,data,{log:true});if(!spent.valid)return toast(spent.reason||'Quick Curl resources are unavailable.','error');const ledger=pokemonCombatParticipant(id,{create:false});if(pokemonCombatFuryCutterState(ledger).active)pokemonCombatResetFuryCutter(ledger,'different-move');ledger.conditions.curledUp=true;const actionLabel=spent.defenseSpend?.action?.spent||'Swift Action';pokemonCombatLog(id,'Quick Curl',`${p.name} activated Quick Curl · Scene · Free Action; Defense Curl used as ${actionLabel}.`,'ability');pokemonCombatLog(id,'Defense Curl',`${p.name} became Curled Up · immune to Critical Hits · DR 10${pokemonCombatKnowsRollMove(data)?' · Rollout/Ice Ball prevent Slowed while Curled Up':' · Slowed'} · ${actionLabel}.`,'condition');await pokemonCombatDispatchMoveFormEvent(id,spent.moveRow);const detail=`${p.name} used Quick Curl + Defense Curl · Scene Free Action · ${actionLabel}`;await commit(detail);render();toast('Quick Curl + Defense Curl recorded.','success');return {valid:true,spent};
}
function pokemonCombatQuickCurlPanel(id,data){
  const abilityRow=pokemonCombatQuickCurlAbilityRow(data),moveRow=pokemonCombatQuickCurlDefenseMoveRow(data);if(!abilityRow||!moveRow||!pokemonCombatQuickCurlAbilitySourceMatches(abilityRow)||!pokemonCombatQuickCurlDefenseSourceMatches(moveRow))return '';const available=pokemonCombatQuickCurlAvailability(id,data);return `<article class="ability-card"><div class="row-between"><div><h3>Quick Curl + Defense Curl</h3><div class="row-gap">${chip('Scene','chip-green')}${chip('Free Action','chip-blue')}${chip('Defense Curl as Swift','chip-purple')}</div></div>${chip('SOURCE-EXPLICIT','chip-purple')}</div><p>Activate Quick Curl to use Defense Curl as a Swift Action. The ordinary Defense Curl Move remains available at its normal action cost.</p><small>PTU Core p.327 + p.394 · Curled Up uses the existing Combat condition model. If Swift is already spent, the shared ledger may use Standard → Swift only when that Standard Action is still available.</small>${available.valid?'':`<div class="builder-validation bad">${esc(available.reason||'Unavailable')}</div>`}<button class="btn ${available.valid?'btn-gold':'btn-disabled'} full" ${available.valid?'':'disabled'} onclick="pokemonCombatUseQuickCurlDefenseCurl('${id}')">Use Quick Curl + Defense Curl · Scene Free + Swift</button></article>`;
}'''


def patch_client(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    original = text
    if 'function pokemonCombatQuickCurlAbilityResourceSpec(' not in text:
        anchor = 'function pokemonCombatRolloutAfterResult('
        at = text.find(anchor)
        if at < 0:
            raise SystemExit(f'Quick Curl helper anchor drifted: {path}')
        text = text[:at] + QUICK_CURL_HELPERS.rstrip() + '\n' + text[at:]
    section = "const quickCurl=data?pokemonCombatQuickCurlPanel(active.id,data):'';if(quickCurl)body+=section('QUICK CURL · DEFENSE CURL',quickCurl);"
    if section not in text:
        anchor = "body+=section('AVAILABLE MOVES'"
        at = text.find(anchor)
        if at < 0:
            raise SystemExit(f'Quick Curl Combat section anchor drifted: {path}')
        text = text[:at] + section + text[at:]
    if text != original:
        path.write_text(text, encoding='utf-8')
        return True
    return False


def write_docs() -> list[str]:
    payload = {
        'schema_version': 1,
        'name': 'PTU Combat Quick Curl + Defense Curl',
        'shared_non_move_resource_ledger': True,
        'physical_dice_only': True,
        'target_model': 'self; no opponent entity',
        'ability': {
            'name': 'Quick Curl', 'source': 'February 2016 Playtest Packet p.6 (overrides PTU Core p.327)',
            'frequency': 'Scene', 'action_cost': 'Free Action',
            'effect': 'Connection - Defense Curl; use Defense Curl as a Standard Action Interrupt and gain +10 Damage Reduction for one full round',
        },
        'move': {
            'name': 'Defense Curl', 'source': 'PTU Core p.394 Move text; Quick Curl cost overridden by February 2016 Playtest Packet p.6',
            'frequency': 'At-Will', 'normal_action_cost': 'Standard Action', 'quick_curl_action_cost': 'Standard Action Interrupt',
            'effect_state': 'Curled Up',
            'existing_runtime': 'critical immunity, DR 10, Slowed/Accuracy interactions, Rollout/Ice Ball exceptions remain owned by the existing Combat condition model',
        },
        'composite_policy': {
            'quick_curl_resource': 'ability:combat-quick-curl · Scene · Free Action',
            'defense_curl_override_resource': 'move:defense-curl-quick-curl · Standard Action Interrupt · At-Will',
            'interrupt_cost': 'spends the shared Standard Action token',
            'ordinary_defense_curl': 'unchanged and still uses its normal Move path/action cost',
            'transactions': 'Ability and overridden Move action create separate namespaced transactions linked by compositeId',
            'refund': 'resource-only Undo may correct either spend independently and never clears Curled Up',
        },
        'source_guards': ['Resolve Quick Curl by the documented source precedence, then guard the February 2016 winning definition.', 'Defense Curl must remain At-Will/Self and match the audited Curled Up effect signature.'],
        'non_goals': ['No opponent entity.', 'No generated dice.', 'No generic Ability/Move prose parser.', 'No default .ptucp mutation.'],
    }
    rendered = json.dumps(payload, indent=2, ensure_ascii=False) + '\n'
    md = '''# PTU Combat Quick Curl + Defense Curl\n\nThis layer adds a source-explicit **Ability that overrides a Move action cost** while reusing the same per-Pokémon Combat action/frequency ledger.\n\n## Source precedence and rules\n\nPTU Core p.327 provides the base Quick Curl definition, but the later February 2016 Playtest Packet p.6 wins: `Scene – Free Action`; Connection – Defense Curl; use Defense Curl as a **Standard Action Interrupt** and gain **+10 Damage Reduction for one full round**. PTU Core p.394 still supplies Defense Curl's `At-Will`, AC None, Status, Self Move definition and Curled Up effect. Only the cost/effect specifically changed by Quick Curl is overridden.\n\n## Shared resource behavior\n\nThe assisted path spends two source-keyed resources: `ability:combat-quick-curl` for Quick Curl's Scene/Free cost and `move:defense-curl-quick-curl` for the Standard Action Interrupt. The ordinary Defense Curl path is unchanged and keeps its normal Move cost. The +10 DR reminder is tracked for the current round.\n\nThe interrupt uses the same Standard token as all other actions and is blocked if that token is unavailable.\n\n## Curled Up and correction\n\nA successful activation uses the existing Defense Curl condition behavior: Curled Up, Critical immunity, DR 10, Slowed/Accuracy interactions, and Rollout/Ice Ball exceptions. The additional Quick Curl +10 DR is recorded separately. Resource transactions are linked by a composite identifier but remain independently correctable. Undo is resource-only and never clears an already-applied effect.\n\n## Source signature guard\n\nThe resolver first selects the precedence winner, then checks its February 2016 signature. Defense Curl must remain At-Will/Self and match the audited Curled Up effect signature. No opponent state, random roll, or generic prose interpreter is introduced.\n'''
    changed = []
    if not DOC_JSON.exists() or DOC_JSON.read_text(encoding='utf-8') != rendered:
        DOC_JSON.write_text(rendered, encoding='utf-8'); changed.append(str(DOC_JSON.relative_to(REPO)))
    if not DOC_MD.exists() or DOC_MD.read_text(encoding='utf-8') != md:
        DOC_MD.write_text(md, encoding='utf-8'); changed.append(str(DOC_MD.relative_to(REPO)))
    return changed


def patch_shared_docs() -> list[str]:
    changed = []
    ability = json.loads(ABILITY_JSON.read_text(encoding='utf-8'))
    composites = ability.setdefault('composite_integrations', {})
    composites['quick_curl_defense_curl'] = {
        'ability': 'Quick Curl · Scene – Free Action',
        'move_override': 'Defense Curl as Standard Action Interrupt',
        'resource_ledger': 'shared non-Move action/frequency API',
        'source_guard': True,
    }
    rendered = json.dumps(ability, indent=2, ensure_ascii=False) + '\n'
    if ABILITY_JSON.read_text(encoding='utf-8') != rendered:
        ABILITY_JSON.write_text(rendered, encoding='utf-8'); changed.append(str(ABILITY_JSON.relative_to(REPO)))

    amd = ABILITY_MD.read_text(encoding='utf-8')
    old_appendix = '''\n## Composite Quick Curl + Defense Curl\n\nQuick Curl is integrated through a dedicated composite layer rather than the standalone Ability allowlist. Its `Scene – Free Action` resource and Defense Curl's overridden Swift Action are spent through the same shared ledger. The normal Defense Curl Move remains unchanged. See `PTU_COMBAT_QUICK_CURL.md`.\n'''
    appendix = '''\n## Composite Quick Curl + Defense Curl\n\nQuick Curl is integrated through a dedicated composite layer rather than the standalone Ability allowlist. Its February 2016 precedence winner spends `Scene – Free Action` and Defense Curl's `Standard Action Interrupt` through the shared ledger. The normal Defense Curl Move remains unchanged. See `PTU_COMBAT_QUICK_CURL.md`.\n'''
    updated = amd.replace(old_appendix, appendix) if old_appendix in amd else amd if '## Composite Quick Curl + Defense Curl' in amd else amd.rstrip() + '\n' + appendix
    if updated != amd:
        ABILITY_MD.write_text(updated, encoding='utf-8'); changed.append(str(ABILITY_MD.relative_to(REPO)))

    session = json.loads(SESSION_JSON.read_text(encoding='utf-8'))
    composites = session.setdefault('composite_integrations', {})
    composites['quick_curl_defense_curl'] = {
        'ability': 'Quick Curl', 'move': 'Defense Curl',
        'ability_cost': 'Scene – Free Action', 'overridden_move_cost': 'Standard Action Interrupt',
        'standard_to_swift_when_valid': False, 'normal_move_path_preserved': True,
        'source_signature_guard': True, 'resource_only_refund': True,
    }
    srendered = json.dumps(session, indent=2, ensure_ascii=False) + '\n'
    if SESSION_JSON.read_text(encoding='utf-8') != srendered:
        SESSION_JSON.write_text(srendered, encoding='utf-8'); changed.append(str(SESSION_JSON.relative_to(REPO)))

    smd = SESSION_MD.read_text(encoding='utf-8')
    sappendix = '''\n## Quick Curl + Defense Curl composite\n\nQuick Curl is the first source-explicit Ability/Move cost override in the Combat ledger. The assisted path spends Quick Curl (`Scene – Free Action`) and Defense Curl as a Swift Action, while ordinary Defense Curl remains on its existing normal Move path. Standard → Swift conversion is allowed only when the shared ledger says the Standard Action is still available. Both resource transactions are independently correctable; correction never rewinds Curled Up.\n'''
    if '## Quick Curl + Defense Curl composite' not in smd:
        SESSION_MD.write_text(smd.rstrip() + '\n' + sappendix, encoding='utf-8'); changed.append(str(SESSION_MD.relative_to(REPO)))
    return changed


def main() -> None:
    clients = [str(path.relative_to(REPO)) for path in CLIENTS if patch_client(path)]
    docs = write_docs()
    shared = patch_shared_docs()
    print({'combat_quick_curl_model': 1, 'clients_changed': clients, 'docs_changed': docs, 'shared_docs_changed': shared, 'physical_dice_only': True, 'target_model': 'self'})


if __name__ == '__main__':
    main()
