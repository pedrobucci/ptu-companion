#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
CLIENTS = [ROOT / 'static-preview' / 'app.js', REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'app.js']
DOC_JSON = REPO / 'docs' / 'data' / 'PTU_COMBAT_NON_MOVE_RESOURCES.json'
DOC_MD = REPO / 'docs' / 'PTU_COMBAT_NON_MOVE_RESOURCES.md'


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    if replacement in text:
        return text
    start_at = text.find(start)
    if start_at < 0:
        raise SystemExit(f'Non-Move resource start anchor drifted: {label}')
    end_at = text.find(end, start_at)
    if end_at < 0:
        raise SystemExit(f'Non-Move resource end anchor drifted: {label}')
    return text[:start_at] + replacement.rstrip() + '\n' + text[end_at:]


RESOURCE_HELPERS = r'''const POKEMON_COMBAT_TRACKED_ACTION_COSTS=new Set(['Full Action','Standard Action','Shift Action','Swift Action','Free Action']);
function pokemonCombatNonMoveSpec(sourceKind,sourceKey,label,actionCost=null,frequency='At-Will'){
  return {sourceKind:String(sourceKind||'source'),sourceKey:String(sourceKey||label||'source'),label:String(label||sourceKey||sourceKind||'Source'),actionCost:actionCost?String(actionCost):null,frequency:String(frequency||'At-Will')};
}
function pokemonCombatAbilityResourceSpec(name){
  const slug=pokemonCombatSlug(name);
  if(slug==='schooling')return pokemonCombatNonMoveSpec('ability','schooling','Schooling','Free Action','Daily');
  if(slug==='power-construct')return pokemonCombatNonMoveSpec('ability','power-construct','Power Construct','Swift Action','Daily');
  return null;
}
function pokemonCombatFormActionResourceSpec(actionId){
  const slug=pokemonCombatSlug(actionId);
  if(slug==='stance-change-full-action')return pokemonCombatNonMoveSpec('form','stance-change-full-action','Stance Change','Full Action','At-Will');
  if(slug==='ice-face-hail-restore')return pokemonCombatNonMoveSpec('ability','ice-face-hail-restore','Ice Face · Hail restore','Standard Action','At-Will');
  if(slug==='weapon-bond-relinquish')return pokemonCombatNonMoveSpec('capability','weapon-bond-relinquish','Weapon Bond · relinquish','Extended Action','At-Will');
  return null;
}
function pokemonCombatCapabilityResourceSpec(capability,mode='activate'){
  if(pokemonCombatSlug(capability)==='weapon-bond')return pokemonCombatNonMoveSpec('capability',mode==='relinquish'?'weapon-bond-relinquish':'weapon-bond','Weapon Bond','Extended Action','At-Will');
  return null;
}
function pokemonCombatNonMoveResourceKey(spec={}){return `nonmove:${pokemonCombatSlug(spec.sourceKind||'source')}:${pokemonCombatSlug(spec.sourceKey||spec.label||'source')}`;}
function pokemonCombatNonMoveAvailability(id,spec={}){
  const normalized=pokemonCombatNonMoveSpec(spec.sourceKind,spec.sourceKey,spec.label,spec.actionCost,spec.frequency),parsed=pokemonCombatParseFrequency(normalized.frequency),trackedAction=POKEMON_COMBAT_TRACKED_ACTION_COSTS.has(normalized.actionCost),trackedFrequency=['scene','daily','eot'].includes(parsed.kind),needsLedger=trackedAction||trackedFrequency,row=pokemonCombatParticipant(id,{create:false});
  if(needsLedger&&!row)return {valid:false,spec:normalized,reason:'Put this Pokémon in Combat before spending its action or Scene/Daily resource.'};
  const action=trackedAction?pokemonCombatCanSpendAction(id,normalized.actionCost):{valid:true,informational:!!normalized.actionCost};if(!action.valid)return {...action,spec:normalized};
  const key=pokemonCombatNonMoveResourceKey(normalized),frequency=trackedFrequency?pokemonCombatFrequencyAvailability(id,key,normalized.frequency):{valid:true,parsed};if(!frequency.valid)return {...frequency,spec:normalized,key};
  return {valid:true,spec:normalized,key,parsed,trackedAction,trackedFrequency,needsLedger,action,frequency};
}
function pokemonCombatActionDelta(before={},after={}){
  const beforeUsed=before.used||{},afterUsed=after.used||{},tokens=['standard','shift','swift'].filter(key=>!beforeUsed[key]&&!!afterUsed[key]),beforeConversions=Array.isArray(before.conversions)?before.conversions:[],afterConversions=Array.isArray(after.conversions)?after.conversions:[];
  return {tokens,conversions:afterConversions.slice(beforeConversions.length)};
}
function pokemonCombatFrequencyValue(row,key,kind){if(kind==='scene')return Number(row?.frequency?.scene?.[key]||0);if(kind==='daily')return Number(row?.frequency?.day?.[key]||0);if(kind==='eot')return Number(row?.frequency?.eot?.[key]||0);return 0;}
function pokemonCombatRefundActionDelta(id,delta={}){
  const turn=pokemonCombatTurn(id);if(!turn)return false;let changed=false;for(const token of (delta.tokens||[])){if(turn.used?.[token]){turn.used[token]=false;changed=true;}}
  for(const conversion of (delta.conversions||[])){const index=turn.conversions?.lastIndexOf(conversion)??-1;if(index>=0){turn.conversions.splice(index,1);changed=true;}}return changed;
}
function pokemonCombatSpendNonMoveResource(id,spec={},options={}){
  const check=pokemonCombatNonMoveAvailability(id,spec);if(!check.valid)return check;if(!check.needsLedger)return {...check,tracked:false,transaction:null,spentLabel:check.spec.actionCost||check.spec.frequency||'Informational'};
  const row=pokemonCombatParticipant(id,{create:false});row.resourceTransactions=Array.isArray(row.resourceTransactions)?row.resourceTransactions:[];row.resourceSequence=Number(row.resourceSequence||0);const turn=pokemonCombatTurn(id),beforeTurn={round:turn.round,used:{...turn.used},conversions:[...(turn.conversions||[])]},frequencyBefore=pokemonCombatFrequencyValue(row,check.key,check.parsed.kind);
  const action=check.trackedAction?pokemonCombatSpendAction(id,check.spec.actionCost):{valid:true,spent:null};if(!action.valid)return action;const frequency=check.trackedFrequency?pokemonCombatSpendFrequency(id,check.key,check.spec.frequency):{valid:true,spent:null,parsed:check.parsed};if(!frequency.valid){pokemonCombatRefundActionDelta(id,pokemonCombatActionDelta(beforeTurn,pokemonCombatTurn(id)));return frequency;}
  const afterTurn=pokemonCombatTurn(id),actionDelta=pokemonCombatActionDelta(beforeTurn,afterTurn),frequencyAfter=pokemonCombatFrequencyValue(row,check.key,check.parsed.kind),transaction={id:`resource-${++row.resourceSequence}`,sourceKind:check.spec.sourceKind,sourceKey:check.spec.sourceKey,key:check.key,label:check.spec.label,actionCost:check.spec.actionCost,frequency:check.spec.frequency,frequencyKind:check.parsed.kind,actionSpent:action.spent||null,actionDelta,frequencyBefore,frequencyAfter,round:Number(state.ui.round||1),scene:Number(state.ui.scene||1),day:Number(state.ui.day||1),refunded:false};row.resourceTransactions.push(transaction);row.resourceTransactions=row.resourceTransactions.slice(-24);
  if(options.log!==false)pokemonCombatLog(id,'Resource spent',`${check.spec.label} · ${action.spent||check.spec.actionCost||'no turn action'}${check.trackedFrequency?` · ${check.spec.frequency}`:''}.`,'resource');return {...check,tracked:true,transaction,action,frequency,spentLabel:[action.spent,check.trackedFrequency?check.spec.frequency:null].filter(Boolean).join(' · ')};
}
function pokemonCombatRefundNonMoveResourceCore(id,transactionId,options={}){
  const row=pokemonCombatParticipant(id,{create:false});if(!row)return {valid:false,reason:'Combatant is not in the session.'};row.resourceTransactions=Array.isArray(row.resourceTransactions)?row.resourceTransactions:[];const tx=row.resourceTransactions.find(item=>item.id===transactionId);if(!tx)return {valid:false,reason:'Resource transaction was not found.'};if(tx.refunded)return {valid:false,reason:'This resource spend was already refunded.'};pokemonCombatSyncBoundaries(row);let changed=false;
  if(Number(tx.round)===Number(state.ui.round||1))changed=pokemonCombatRefundActionDelta(id,tx.actionDelta)||changed;
  if(tx.frequencyKind==='scene'&&Number(tx.scene)===Number(state.ui.scene||1)){const current=Number(row.frequency.scene[tx.key]||0);if(current>0){row.frequency.scene[tx.key]=Math.max(0,current-1);changed=true;}}
  if(tx.frequencyKind==='daily'&&Number(tx.day)===Number(state.ui.day||1)){const current=Number(row.frequency.day[tx.key]||0);if(current>0){row.frequency.day[tx.key]=Math.max(0,current-1);changed=true;}}
  if(tx.frequencyKind==='eot'&&Number(row.frequency.eot[tx.key]||0)===Number(tx.frequencyAfter||0)){if(Number(tx.frequencyBefore||0)>0)row.frequency.eot[tx.key]=Number(tx.frequencyBefore);else delete row.frequency.eot[tx.key];changed=true;}
  tx.refunded=true;tx.refundedRound=Number(state.ui.round||1);tx.refundedScene=Number(state.ui.scene||1);tx.refundedDay=Number(state.ui.day||1);if(options.log!==false)pokemonCombatLog(id,'Resource refunded',`${tx.label} action/frequency spend was corrected.${changed?'':' Its boundary had already reset.'}`,'resource');return {valid:true,changed,transaction:tx};
}
async function pokemonCombatRefundNonMoveResource(id,transactionId){const p=pokemon(id),result=pokemonCombatRefundNonMoveResourceCore(id,transactionId);if(!result.valid)return toast(result.reason,'error');await commit(`${p?.name||'Pokémon'} resource spend corrected.`);render();toast(result.changed?'Resource spend refunded.':'Resource spend was already reset by a combat boundary.');return result;}
function pokemonCombatNonMoveTransactionRefundable(tx={}){if(tx.refunded)return false;if((tx.actionDelta?.tokens||[]).length&&Number(tx.round)===Number(state.ui.round||1))return true;if(tx.frequencyKind==='scene'&&Number(tx.scene)===Number(state.ui.scene||1))return true;if(tx.frequencyKind==='daily'&&Number(tx.day)===Number(state.ui.day||1))return true;if(tx.frequencyKind==='eot'&&Number(tx.round)<=Number(state.ui.round||1))return true;return false;}
function pokemonCombatNonMoveResourcePanel(id){const row=pokemonCombatParticipant(id,{create:false}),items=(row?.resourceTransactions||[]).slice().reverse().filter(pokemonCombatNonMoveTransactionRefundable).slice(0,4);if(!items.length)return '';return `<div class="flow-note"><strong>Recent Ability/Form resource spends</strong><small>Use Undo only to correct a mistaken activation. Scene/Day boundaries still reset resources normally.</small><div class="row-gap">${items.map(tx=>`<button class="btn btn-ghost btn-small" onclick="pokemonCombatRefundNonMoveResource('${id}','${tx.id}')">Undo ${esc(tx.label)} · ${esc([tx.actionSpent,tx.frequencyKind==='scene'||tx.frequencyKind==='daily'?tx.frequency:null].filter(Boolean).join(' · ')||'resource')}</button>`).join('')}</div></div>`;}
async function pokemonCombatApplyNonMoveFormEvent(id,event,spec,{message=null}={}){
  const p=pokemon(id);if(!p)return null;let spend=null;if(spec){const availability=pokemonCombatNonMoveAvailability(id,spec);if(!availability.valid){toast(availability.reason,'error');return {valid:false,errors:[availability.reason]};}spend=pokemonCombatSpendNonMoveResource(id,spec,{log:false});if(!spend.valid){toast(spend.reason||'Resource could not be spent.','error');return {valid:false,errors:[spend.reason||'Resource could not be spent.']};}}
  const payload=await applyPokemonFormGameEventUi(id,event,{silent:false,commitAfter:false});const meaningful=!!payload?.valid&&(!!payload.changed||(payload.effects||[]).length>0||(payload.appliedRules||[]).length>0);if(!meaningful){if(spend?.transaction)pokemonCombatRefundNonMoveResourceCore(id,spend.transaction.id,{log:false});if(payload?.valid)toast('No source lifecycle change was triggered; action/frequency was not spent.');return payload;}
  if(spend?.transaction)pokemonCombatLog(id,'Resource spent',`${spend.spec.label} · ${spend.action?.spent||spend.spec.actionCost||'no turn action'}${spend.trackedFrequency?` · ${spend.spec.frequency}`:''}.`,'resource');await commit(message||`${p.name} source action applied.`);render();return payload;
}'''

ABILITY_USE = r'''async function usePokemonNamedAbilityForForms(id,ability){const p=pokemon(id);if(!p)return;const spec=pokemonCombatAbilityResourceSpec(ability);await pokemonCombatApplyNonMoveFormEvent(id,{kind:'ability-used',ability},spec,{message:`${p.name} used ${ability}.`});}
async function usePokemonAbilityForForms(id,index){
  const p=pokemon(id);const data=creatureReferenceState.pokemonId===id?creatureReferenceState.data:null;const row=(data?.abilities||[])[Number(index)];if(!p||!row)return toast('Ability reference data is unavailable.','error');
  await usePokemonNamedAbilityForForms(id,row.name);
}'''

CAPABILITY_USE = r'''async function usePokemonCapabilityForForms(id,capability,triggerItem){
  const p=pokemon(id);if(!p)return;
  const hasItem=!triggerItem||formEventSlug(p.heldItem)===formEventSlug(triggerItem)||(state.inventory||[]).some(item=>Number(item.qty||0)>0&&formEventSlug(item.name)===formEventSlug(triggerItem));
  if(!hasItem&&!state.ui.gmOverride)return toast(`${triggerItem} is required for ${capability}.`,'error');
  const spec=pokemonCombatCapabilityResourceSpec(capability,'activate');await pokemonCombatApplyNonMoveFormEvent(id,{kind:'capability-used',capability,triggerItem},spec,{message:`${p.name} used ${capability}.`});
}'''

FORM_ACTION_USE = r'''async function usePokemonFormActionForForms(id,actionId,extra={}){const p=pokemon(id);if(!p)return;const spec=pokemonCombatFormActionResourceSpec(actionId);await pokemonCombatApplyNonMoveFormEvent(id,{kind:'form-action',actionId,...extra},spec,{message:`${p.name} Form action applied.`});}'''

LIFECYCLE_CONTROLS = r'''function pokemonFormLifecycleControls(forms,stateForm,p){
  const ids=new Set((forms||[]).map(form=>formEventSlug(form.id))),buttons=[];const button=(label,onclick,spec,tone='btn-ghost')=>{const available=spec?pokemonCombatNonMoveAvailability(p.id,spec):{valid:true};return `<button class="btn ${available.valid?tone:'btn-disabled'} btn-small" ${available.valid?'':`disabled title="${esc(available.reason||'Unavailable')}"`} onclick="${onclick}">${label}</button>`;};
  if(ids.has('sword-stance'))buttons.push(button('Stance Change · Full Action',`usePokemonFormActionForForms('${p.id}','stance-change-full-action')`,pokemonCombatFormActionResourceSpec('stance-change-full-action')));
  if(ids.has('schooling')&&stateForm.activeFormId!=='schooling')buttons.push(button('Schooling · Daily Free Action',`usePokemonNamedAbilityForForms('${p.id}','Schooling')`,pokemonCombatAbilityResourceSpec('Schooling'),'btn-gold'));
  if((ids.has('complete-from-10-percent')||ids.has('complete-from-50-percent'))&&!String(stateForm.activeFormId||'').startsWith('complete-from-'))buttons.push(button('Power Construct · Daily Swift Action',`usePokemonNamedAbilityForForms('${p.id}','Power Construct')`,pokemonCombatAbilityResourceSpec('Power Construct'),'btn-gold'));
  if(ids.has('noice-face'))buttons.push(button('Restore Ice Face · Standard Action · Hail',`usePokemonFormActionForForms('${p.id}','ice-face-hail-restore',{weather:'Hail'})`,pokemonCombatFormActionResourceSpec('ice-face-hail-restore')));
  if(ids.has('crowned-sword'))buttons.push(stateForm.activeFormId==='crowned-sword'?button('Relinquish Crowned Sword · Extended Action',`usePokemonFormActionForForms('${p.id}','weapon-bond-relinquish')`,pokemonCombatFormActionResourceSpec('weapon-bond-relinquish')):button('Weapon Bond · Ancestral Sword · Extended Action',`usePokemonCapabilityForForms('${p.id}','Weapon Bond','Ancestral Sword')`,pokemonCombatCapabilityResourceSpec('Weapon Bond'),'btn-gold'));
  if(ids.has('crowned-shield'))buttons.push(stateForm.activeFormId==='crowned-shield'?button('Relinquish Crowned Shield · Extended Action',`usePokemonFormActionForForms('${p.id}','weapon-bond-relinquish')`,pokemonCombatFormActionResourceSpec('weapon-bond-relinquish')):button('Weapon Bond · Ancestral Shield · Extended Action',`usePokemonCapabilityForForms('${p.id}','Weapon Bond','Ancestral Shield')`,pokemonCombatCapabilityResourceSpec('Weapon Bond'),'btn-gold'));
  return buttons.length?`<div class="flow-note"><strong>Source lifecycle actions</strong><div class="row-gap">${buttons.join('')}</div><small>Combat Actions and Scene/Daily uses share the Pokémon Combat ledger. Extended Actions remain source-labeled but are not converted into turn actions.</small></div>`:'';
}'''


def patch_client(path: Path) -> bool:
    text = path.read_text(encoding='utf-8'); original = text
    if 'const POKEMON_COMBAT_TRACKED_ACTION_COSTS=' not in text:
        anchor = 'function pokemonCombatRolloutAfterResult('
        at = text.find(anchor)
        if at < 0:
            raise SystemExit(f'Non-Move resource helper anchor drifted: {path}')
        text = text[:at] + RESOURCE_HELPERS.rstrip() + '\n' + text[at:]
    text = replace_between(text, 'async function usePokemonAbilityForForms(', 'async function usePokemonCapabilityForForms(', ABILITY_USE, f'{path}: ability form action')
    text = replace_between(text, 'async function usePokemonCapabilityForForms(', 'async function usePokemonFormActionForForms(', CAPABILITY_USE, f'{path}: capability form action')
    text = replace_between(text, 'async function usePokemonFormActionForForms(', 'function pokemonFormLifecycleControls(', FORM_ACTION_USE, f'{path}: form action')
    text = replace_between(text, 'function pokemonFormLifecycleControls(', 'async function setPokemonBattleState(', LIFECYCLE_CONTROLS, f'{path}: lifecycle controls')
    old = "const data=ref?.data;const temp=tempHpValue(active),formIndicator=data?pokemonFormCombatIndicator(active,data):'';const header="
    new = "const data=ref?.data;const temp=tempHpValue(active),formIndicator=data?pokemonFormCombatIndicator(active,data):'',formActions=data?pokemonFormLifecycleControls(data.species?.forms||[],pokemonFormCurrentState(active),active):'';const header="
    if new not in text:
        if old not in text:
            raise SystemExit(f'Combat Form controls anchor drifted: {path}')
        text = text.replace(old, new, 1)
    old2 = "${header}${formIndicator}<div class=\"battle-controls\""
    new2 = "${header}${formIndicator}${formActions}<div class=\"battle-controls\""
    if new2 not in text:
        if old2 not in text:
            raise SystemExit(f'Combat Form actions render anchor drifted: {path}')
        text = text.replace(old2, new2, 1)
    old3 = "${pokemonCombatActionStrip(active.id)}<div class=\"row-gap\">"
    new3 = "${pokemonCombatActionStrip(active.id)}${pokemonCombatNonMoveResourcePanel(active.id)}<div class=\"row-gap\">"
    if new3 not in text:
        if old3 not in text:
            raise SystemExit(f'Combat resource refund panel anchor drifted: {path}')
        text = text.replace(old3, new3, 1)
    if text != original:
        path.write_text(text, encoding='utf-8')
        return True
    return False


def write_docs() -> list[str]:
    payload = {
        'schema_version': 1,
        'name': 'PTU Combat Non-Move Resource Ledger',
        'shared_with_moves': True,
        'physical_dice_only': True,
        'sources': {
            'schooling': {'kind': 'ability', 'action_cost': 'Free Action', 'frequency': 'Daily', 'source': 'SuMo References p.4'},
            'power_construct': {'kind': 'ability', 'action_cost': 'Swift Action', 'frequency': 'Daily', 'source': 'SuMo References p.3'},
            'stance_change_manual': {'kind': 'form action', 'action_cost': 'Full Action', 'frequency': 'At-Will', 'source': 'Pokemon Tabletop United 1.05 Core p.331'},
            'ice_face_hail_restore': {'kind': 'ability effect', 'action_cost': 'Standard Action', 'frequency': 'At-Will', 'condition': 'Hail', 'source': 'New Abilities and Moves p.1'},
            'weapon_bond': {'kind': 'capability', 'action_cost': 'Extended Action', 'frequency': 'At-Will', 'tracked_as_turn_action': False, 'source': 'New Abilities and Moves p.1'},
        },
        'resource_keys': 'namespaced by source kind and source key so Move, Ability, Form and Capability uses do not collide',
        'refund': {'supported': True, 'scope': 'only the action/frequency tokens created by that transaction', 'boundary_behavior': 'already-reset round/scene/day resources are not resurrected'},
        'non_goals': ['No generic Ability prose interpreter.', 'No conversion of Extended Actions into Standard/Shift/Swift actions.', 'No generated dice.', 'No default .ptucp mutation.'],
    }
    rendered = json.dumps(payload, indent=2, ensure_ascii=False) + '\n'
    md = '''# PTU Combat Non-Move Resource Ledger\n\nAbilities, Form actions and source-explicit Capabilities now use the same Pokémon Combat action/frequency ledger as Moves when the supplied PTU rule gives an unambiguous cost. No second action economy is introduced.\n\n## Source-explicit integrations\n\n- **Schooling** — `Daily – Free Action` (SuMo References p.4). A successful activation consumes that Pokémon's Daily Schooling use in the Combat ledger.\n- **Power Construct** — `Daily – Swift Action` (SuMo References p.3). It consumes the Swift Action (or the existing Standard→Swift conversion when needed) plus its own namespaced Daily use.\n- **Aegislash Stance Change manual toggle** — `Full Action` (PTU Core p.331). Automatic Move-driven stance changes remain automatic and consume no additional resource.\n- **Ice Face Hail restoration** — `Standard Action in Hail` (New Abilities and Moves p.1). The action is consumed only when the source lifecycle event is actually applied.\n- **Weapon Bond** entry/relinquish — `Extended Action` (New Abilities and Moves p.1). Extended Actions are shown faithfully but are not converted into Combat turn actions.\n\n## Atomic source-event spending\n\nThe UI first checks availability, reserves the exact action/frequency tokens, applies the Form lifecycle event, and automatically refunds the reservation if the event is invalid or produces no source lifecycle change. This prevents a failed activation from consuming Daily/Scene resources.\n\nFrequency keys are namespaced by source kind plus source key, so an Ability and a Move with the same visible name cannot consume each other's counters.\n\n## Correction / refund\n\nRecent Ability/Form resource transactions are shown on the active Combatant. `Undo` reverses only the action flags and frequency counter created by that transaction. It never rewinds HP, Form state, Move outcomes, or other later game state. If a Round/Scene/Day boundary has already reset a resource, Undo does not resurrect the old boundary.\n\n## Conservative boundary\n\nOnly the source-explicit rules above are wired. Ambiguous activation semantics, conflicting source rules, manual/GM gates and Extended Action timing remain explicit rather than inferred. Combat still generates no dice.\n'''
    changed = []
    if not DOC_JSON.exists() or DOC_JSON.read_text(encoding='utf-8') != rendered:
        DOC_JSON.write_text(rendered, encoding='utf-8'); changed.append(str(DOC_JSON.relative_to(REPO)))
    if not DOC_MD.exists() or DOC_MD.read_text(encoding='utf-8') != md:
        DOC_MD.write_text(md, encoding='utf-8'); changed.append(str(DOC_MD.relative_to(REPO)))
    return changed


def main() -> None:
    clients = [str(path.relative_to(REPO)) for path in CLIENTS if patch_client(path)]
    docs = write_docs()
    print({'non_move_resource_model': 1, 'clients_changed': clients, 'docs_changed': docs, 'shared_with_moves': True, 'refund': True, 'digital_rng': False})


if __name__ == '__main__':
    main()
