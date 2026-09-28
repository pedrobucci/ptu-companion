#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
CLIENTS = [ROOT / 'static-preview' / 'app.js', REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'app.js']
DOC_JSON = REPO / 'docs' / 'data' / 'PTU_COMBAT_VICIOUS.json'
DOC_MD = REPO / 'docs' / 'PTU_COMBAT_VICIOUS.md'
SESSION_JSON = REPO / 'docs' / 'data' / 'PTU_COMBAT_SESSION_LEDGER.json'
SESSION_MD = REPO / 'docs' / 'PTU_COMBAT_SESSION_LEDGER.md'

VICIOUS_HELPERS = r'''function pokemonCombatViciousAbilityResourceSpec(){return pokemonCombatNonMoveSpec('ability','combat-vicious','Vicious',null,'Scene');}
function pokemonCombatViciousAbilityRow(data){return (data?.abilities||[]).find(row=>pokemonCombatSlug(row?.name||row?.definition?.name)==='vicious')||null;}
function pokemonCombatViciousHoneClawsRow(data){return (data?.moves||[]).find(row=>pokemonCombatSlug(row?.definition?.name||row?.record?.name)==='hone-claws')||null;}
function pokemonCombatViciousAbilitySourceMatches(row){
  if(!row||pokemonCombatSlug(row?.name||row?.definition?.name)!=='vicious')return false;const frequency=String(row.definition?.frequency||row.record?.frequency||row.frequency||'');if(frequency&&!/\bScene\b/i.test(frequency))return false;const effect=String(row.definition?.effect||'').toLowerCase().replace(/[^a-z0-9+]+/g,' ');return effect.includes('connection hone claws')&&effect.includes('another standard action this round')&&effect.includes('critical hit range')&&effect.includes('remainder of the encounter');
}
function pokemonCombatViciousHoneClawsSourceMatches(row){
  if(!row||pokemonCombatSlug(row?.definition?.name||row?.record?.name)!=='hone-claws')return false;const def=row.definition||row.record||{},frequency=String(def.frequency||'');if(frequency&&!/^at-will$/i.test(frequency.trim()))return false;const range=String(def.range||'');if(range&&!/\bself\b/i.test(range))return false;const effect=String(def.effect||'').toLowerCase().replace(/[^a-z0-9+]+/g,' ');return effect.includes('accuracy is raised by +1')&&effect.includes('attack combat stage');
}
function pokemonCombatViciousRecordMoveUse(id,moveRow){
  const ledger=pokemonCombatParticipant(id,{create:false});if(!ledger)return;ledger.triggerWindows ||= {};const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,abilityRow=pokemonCombatViciousAbilityRow(data),name=moveRow?.definition?.name||moveRow?.record?.name||'';
  if(pokemonCombatSlug(name)==='hone-claws'&&pokemonCombatViciousAbilitySourceMatches(abilityRow)&&pokemonCombatViciousHoneClawsSourceMatches(moveRow)){ledger.triggerWindows.vicious={round:Number(state.ui.round||1),scene:Number(state.ui.scene||1),day:Number(state.ui.day||1),move:'Hone Claws'};return ledger.triggerWindows.vicious;}
  delete ledger.triggerWindows.vicious;return null;
}
function pokemonCombatViciousAvailability(id,data,choice='extra-standard'){
  const abilityRow=pokemonCombatViciousAbilityRow(data),moveRow=pokemonCombatViciousHoneClawsRow(data);if(!abilityRow)return {valid:false,reason:'This Pokémon does not have Vicious.'};if(!moveRow)return {valid:false,abilityRow,reason:'Hone Claws is not available in this Pokémon Move list.'};if(!pokemonCombatViciousAbilitySourceMatches(abilityRow))return {valid:false,abilityRow,moveRow,reason:'The active Vicious definition differs from the audited PTU source.'};if(!pokemonCombatViciousHoneClawsSourceMatches(moveRow))return {valid:false,abilityRow,moveRow,reason:'The active Hone Claws definition differs from the audited PTU source.'};const ledger=pokemonCombatParticipant(id,{create:false});if(!ledger)return {valid:false,abilityRow,moveRow,reason:'Put this Pokémon in Combat first.'};const pending=ledger.triggerWindows?.vicious,round=Number(state.ui.round||1),scene=Number(state.ui.scene||1),day=Number(state.ui.day||1);if(!pending||Number(pending.round)!==round||Number(pending.scene)!==scene||Number(pending.day)!==day)return {valid:false,abilityRow,moveRow,reason:'Use Hone Claws this round to open the Vicious trigger.'};if(Number(ledger.viciousActivation?.scene||-1)===scene)return {valid:false,abilityRow,moveRow,reason:'Vicious has already been activated this Scene.'};if(choice==='critical-range'&&Number(ledger.conditions?.viciousCriticalRangeBonus||0)>0)return {valid:false,abilityRow,moveRow,reason:'Vicious Critical Hit Range +2 is already active for this combat encounter.'};if(!['extra-standard','critical-range'].includes(choice))return {valid:false,abilityRow,moveRow,reason:'Unknown Vicious choice.'};const resource=pokemonCombatViciousAbilityResourceSpec(),resourceCheck=pokemonCombatNonMoveAvailability(id,resource);if(!resourceCheck.valid)return {...resourceCheck,abilityRow,moveRow,resource,pending};return {valid:true,abilityRow,moveRow,resource,resourceCheck,pending,choice};
}
async function pokemonCombatUseVicious(id,choice){
  const p=pokemon(id),data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null;if(!p||!data)return toast('Vicious reference data is unavailable.','error');const check=pokemonCombatViciousAvailability(id,data,choice);if(!check.valid)return toast(check.reason||'Vicious is unavailable.','error');const spent=pokemonCombatSpendNonMoveResource(id,check.resource,{log:false});if(!spent.valid)return toast(spent.reason||'Vicious resource is unavailable.','error');const ledger=pokemonCombatParticipant(id,{create:false}),turn=pokemonCombatTurn(id);ledger.viciousActivation={scene:Number(state.ui.scene||1),round:Number(state.ui.round||1),choice,transactionId:spent.transaction?.id||null};delete ledger.triggerWindows.vicious;
  let effectLabel='';if(choice==='extra-standard'){turn.bonus ||= {standard:0};turn.bonusUsed ||= {standard:0};turn.bonus.standard=Number(turn.bonus.standard||0)+1;effectLabel='another Standard Action this round';}else{ledger.conditions ||= {};ledger.conditions.viciousCriticalRangeBonus=2;effectLabel='Critical Hit Range +2 for the remainder of this combat encounter';}
  if(spent.transaction){spent.transaction.effectChoice=choice;spent.transaction.effectApplied=true;spent.transaction.triggerMove='Hone Claws';}
  pokemonCombatLog(id,'Vicious',`${p.name} activated Vicious after Hone Claws · Scene · Special · ${effectLabel}.`,'ability');await applyPokemonFormGameEventUi(id,{kind:'ability-used',ability:'Vicious'},{silent:true,commitAfter:false});await commit(`${p.name} activated Vicious · ${effectLabel}.`);render();toast(`Vicious: ${effectLabel}.`,'success');return {valid:true,spent,choice};
}
function pokemonCombatViciousPanel(id,data){
  const abilityRow=pokemonCombatViciousAbilityRow(data),moveRow=pokemonCombatViciousHoneClawsRow(data);if(!abilityRow||!moveRow||!pokemonCombatViciousAbilitySourceMatches(abilityRow)||!pokemonCombatViciousHoneClawsSourceMatches(moveRow))return '';const extra=pokemonCombatViciousAvailability(id,data,'extra-standard'),critical=pokemonCombatViciousAvailability(id,data,'critical-range'),ledger=pokemonCombatParticipant(id,{create:false}),pending=ledger?.triggerWindows?.vicious,critActive=Number(ledger?.conditions?.viciousCriticalRangeBonus||0)>0;const button=(label,available,choice)=>`<button class="btn ${available.valid?'btn-gold':'btn-disabled'} full" ${available.valid?'':`disabled title="${esc(available.reason||'Unavailable')}"`} onclick="pokemonCombatUseVicious('${id}','${choice}')">${label}</button>`;return `<article class="ability-card"><div class="row-between"><div><h3>Vicious + Hone Claws</h3><div class="row-gap">${chip('Scene','chip-green')}${chip('Special','chip-blue')}${chip('Connection · Hone Claws','chip-purple')}</div></div>${chip('SOURCE-EXPLICIT','chip-purple')}</div><p>After this Pokémon uses Hone Claws, activate Vicious and choose one Core effect.</p><small>PTU Core p.335 · choose another Standard Action this round, or Critical Hit Range +2 for the remainder of the encounter. The trigger window closes after another Move or the round boundary.</small>${critActive?`<div class="flow-note"><strong>Vicious critical range active</strong><small>Critical Hit Range +2 remains recorded until this Pokémon leaves the current Combat session.</small></div>`:''}${pending?'':`<div class="flow-note"><small>Use Hone Claws to open the Vicious trigger.</small></div>`}${button('Vicious · another Standard Action this round',extra,'extra-standard')}${button('Vicious · Critical Hit Range +2',critical,'critical-range')}</article>`;
}'''

TURN_OLD = "function pokemonCombatTurn(id,{reset=false}={}){const row=pokemonCombatParticipant(id);if(!row)return null;const round=Number(state.ui.round||1);if(reset||Number(row.turn.round)!==round){row.turn={round,used:{standard:false,shift:false,swift:false},conversions:[]};}return row.turn;}"
TURN_NEW = "function pokemonCombatTurn(id,{reset=false}={}){const row=pokemonCombatParticipant(id);if(!row)return null;const round=Number(state.ui.round||1);if(reset||Number(row.turn.round)!==round){row.turn={round,used:{standard:false,shift:false,swift:false},conversions:[],bonus:{standard:0},bonusUsed:{standard:0}};}row.turn.used ||= {standard:false,shift:false,swift:false};row.turn.conversions ||= [];row.turn.bonus ||= {standard:0};row.turn.bonusUsed ||= {standard:0};return row.turn;}"

ACTION_OLD = "function pokemonCombatCanSpendAction(id,cost){const turn=pokemonCombatTurn(id);if(!turn)return {valid:false,reason:'No combat turn is available.'};const used=turn.used||{};if(cost==='Free Action')return {valid:true};if(cost==='Full Action')return !used.standard&&!used.shift?{valid:true}:{valid:false,reason:'Full Action needs both Standard and Shift Actions available.'};if(cost==='Standard Action')return !used.standard?{valid:true}:{valid:false,reason:'Standard Action already spent this turn.'};if(cost==='Swift Action')return !used.swift||!used.standard?{valid:true}:{valid:false,reason:'Swift Action already spent and Standard Action is unavailable for conversion.'};if(cost==='Shift Action')return !used.shift||!used.standard?{valid:true}:{valid:false,reason:'Shift Action already spent and Standard Action is unavailable for conversion.'};return {valid:true,informational:true};}\nfunction pokemonCombatSpendAction(id,cost){const check=pokemonCombatCanSpendAction(id,cost);if(!check.valid)return check;const turn=pokemonCombatTurn(id),used=turn.used;if(cost==='Free Action')return {valid:true,spent:'Free Action'};if(cost==='Full Action'){used.standard=true;used.shift=true;return {valid:true,spent:'Full Action'};}if(cost==='Standard Action'){used.standard=true;return {valid:true,spent:'Standard Action'};}if(cost==='Swift Action'){if(!used.swift){used.swift=true;return {valid:true,spent:'Swift Action'};}used.standard=true;turn.conversions.push('Standard → Swift');return {valid:true,spent:'Standard Action → Swift Action'};}if(cost==='Shift Action'){if(!used.shift){used.shift=true;return {valid:true,spent:'Shift Action'};}used.standard=true;turn.conversions.push('Standard → Shift');return {valid:true,spent:'Standard Action → Shift Action'};}return {valid:true,spent:null,informational:true};}"
ACTION_NEW = "function pokemonCombatStandardRemaining(turn){if(!turn)return 0;const base=turn.used?.standard?0:1,bonus=Math.max(0,Number(turn.bonus?.standard||0)),bonusUsed=Math.max(0,Number(turn.bonusUsed?.standard||0));return Math.max(0,base+bonus-bonusUsed);}\nfunction pokemonCombatSpendStandardToken(turn){if(!turn)return {valid:false,reason:'No combat turn is available.'};turn.used ||= {standard:false,shift:false,swift:false};turn.bonus ||= {standard:0};turn.bonusUsed ||= {standard:0};if(!turn.used.standard){turn.used.standard=true;return {valid:true,spent:'Standard Action',token:'base-standard'};}if(Number(turn.bonusUsed.standard||0)<Number(turn.bonus.standard||0)){turn.bonusUsed.standard=Number(turn.bonusUsed.standard||0)+1;return {valid:true,spent:'Bonus Standard Action',token:'bonus-standard'};}return {valid:false,reason:'Standard Action already spent this turn.'};}\nfunction pokemonCombatCanSpendAction(id,cost){const turn=pokemonCombatTurn(id);if(!turn)return {valid:false,reason:'No combat turn is available.'};const used=turn.used||{},standardRemaining=pokemonCombatStandardRemaining(turn);if(cost==='Free Action')return {valid:true};if(cost==='Full Action')return !used.standard&&!used.shift?{valid:true}:{valid:false,reason:'Full Action needs the base Standard and Shift Actions available.'};if(cost==='Standard Action')return standardRemaining>0?{valid:true}:{valid:false,reason:'Standard Action already spent this turn.'};if(cost==='Swift Action')return !used.swift||standardRemaining>0?{valid:true}:{valid:false,reason:'Swift Action already spent and no Standard Action is available for conversion.'};if(cost==='Shift Action')return !used.shift||standardRemaining>0?{valid:true}:{valid:false,reason:'Shift Action already spent and no Standard Action is available for conversion.'};return {valid:true,informational:true};}\nfunction pokemonCombatSpendAction(id,cost){const check=pokemonCombatCanSpendAction(id,cost);if(!check.valid)return check;const turn=pokemonCombatTurn(id),used=turn.used;if(cost==='Free Action')return {valid:true,spent:'Free Action'};if(cost==='Full Action'){used.standard=true;used.shift=true;return {valid:true,spent:'Full Action'};}if(cost==='Standard Action')return pokemonCombatSpendStandardToken(turn);if(cost==='Swift Action'){if(!used.swift){used.swift=true;return {valid:true,spent:'Swift Action'};}const standard=pokemonCombatSpendStandardToken(turn);if(!standard.valid)return standard;const conversion=standard.token==='bonus-standard'?'Bonus Standard → Swift':'Standard → Swift';turn.conversions.push(conversion);return {valid:true,spent:standard.token==='bonus-standard'?'Bonus Standard Action → Swift Action':'Standard Action → Swift Action'};}if(cost==='Shift Action'){if(!used.shift){used.shift=true;return {valid:true,spent:'Shift Action'};}const standard=pokemonCombatSpendStandardToken(turn);if(!standard.valid)return standard;const conversion=standard.token==='bonus-standard'?'Bonus Standard → Shift':'Standard → Shift';turn.conversions.push(conversion);return {valid:true,spent:standard.token==='bonus-standard'?'Bonus Standard Action → Shift Action':'Standard Action → Shift Action'};}return {valid:true,spent:null,informational:true};}"

DELTA_OLD = "function pokemonCombatActionDelta(before={},after={}){\n  const beforeUsed=before.used||{},afterUsed=after.used||{},tokens=['standard','shift','swift'].filter(key=>!beforeUsed[key]&&!!afterUsed[key]),beforeConversions=Array.isArray(before.conversions)?before.conversions:[],afterConversions=Array.isArray(after.conversions)?after.conversions:[];\n  return {tokens,conversions:afterConversions.slice(beforeConversions.length)};\n}"
DELTA_NEW = "function pokemonCombatActionDelta(before={},after={}){\n  const beforeUsed=before.used||{},afterUsed=after.used||{},tokens=['standard','shift','swift'].filter(key=>!beforeUsed[key]&&!!afterUsed[key]),beforeConversions=Array.isArray(before.conversions)?before.conversions:[],afterConversions=Array.isArray(after.conversions)?after.conversions:[],beforeBonusUsed=Number(before.bonusUsed?.standard||0),afterBonusUsed=Number(after.bonusUsed?.standard||0);\n  return {tokens,conversions:afterConversions.slice(beforeConversions.length),bonusStandardUsed:Math.max(0,afterBonusUsed-beforeBonusUsed)};\n}"

REFUND_OLD = "function pokemonCombatRefundActionDelta(id,delta={}){\n  const turn=pokemonCombatTurn(id);if(!turn)return false;let changed=false;for(const token of (delta.tokens||[])){if(turn.used?.[token]){turn.used[token]=false;changed=true;}}\n  for(const conversion of (delta.conversions||[])){const index=turn.conversions?.lastIndexOf(conversion)??-1;if(index>=0){turn.conversions.splice(index,1);changed=true;}}return changed;\n}"
REFUND_NEW = "function pokemonCombatRefundActionDelta(id,delta={}){\n  const turn=pokemonCombatTurn(id);if(!turn)return false;let changed=false;for(const token of (delta.tokens||[])){if(turn.used?.[token]){turn.used[token]=false;changed=true;}}const bonusUsed=Math.max(0,Number(delta.bonusStandardUsed||0));if(bonusUsed){turn.bonusUsed ||= {standard:0};turn.bonusUsed.standard=Math.max(0,Number(turn.bonusUsed.standard||0)-bonusUsed);changed=true;}\n  for(const conversion of (delta.conversions||[])){const index=turn.conversions?.lastIndexOf(conversion)??-1;if(index>=0){turn.conversions.splice(index,1);changed=true;}}return changed;\n}"

SNAPSHOT_OLD = "beforeTurn={round:turn.round,used:{...turn.used},conversions:[...(turn.conversions||[])]}"
SNAPSHOT_NEW = "beforeTurn={round:turn.round,used:{...turn.used},conversions:[...(turn.conversions||[])],bonus:{...(turn.bonus||{})},bonusUsed:{...(turn.bonusUsed||{})}}"

STRIP_OLD = "function pokemonCombatActionStrip(id){const turn=pokemonCombatTurn(id),used=turn?.used||{};const status=(label,isUsed)=>chip(`${label} ${isUsed?'USED':'READY'}`,isUsed?'chip-gray':'chip-green');return `<div class=\"row-gap\">${status('STANDARD',used.standard)}${status('SHIFT',used.shift)}${status('SWIFT',used.swift)}${chip('FREE ∞','chip-blue')}</div>${turn?.conversions?.length?`<small>Conversions: ${esc(turn.conversions.join(', '))}</small>`:''}`;}"
STRIP_NEW = "function pokemonCombatActionStrip(id){const turn=pokemonCombatTurn(id),used=turn?.used||{},standardRemaining=pokemonCombatStandardRemaining(turn),standardTotal=1+Math.max(0,Number(turn?.bonus?.standard||0)),standardSpent=Math.max(0,standardTotal-standardRemaining);const status=(label,isUsed)=>chip(`${label} ${isUsed?'USED':'READY'}`,isUsed?'chip-gray':'chip-green'),standard=chip(`STANDARD ${standardRemaining>0?`${standardRemaining} READY`:'USED'}${standardTotal>1?` · ${standardSpent}/${standardTotal} spent`:''}`,standardRemaining>0?'chip-green':'chip-gray');return `<div class=\"row-gap\">${standard}${status('SHIFT',used.shift)}${status('SWIFT',used.swift)}${chip('FREE ∞','chip-blue')}</div>${turn?.conversions?.length?`<small>Conversions: ${esc(turn.conversions.join(', '))}</small>`:''}`;}"


def replace_once(text: str, old: str, new: str, label: str, path: Path) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'Vicious patch anchor drifted in {path}: {label}')
    return text.replace(old, new, 1)


def patch_client(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    original = text
    text = replace_once(text, TURN_OLD, TURN_NEW, 'turn ledger extension', path)
    text = replace_once(text, ACTION_OLD, ACTION_NEW, 'bonus Standard action economy', path)
    text = replace_once(text, DELTA_OLD, DELTA_NEW, 'action transaction delta', path)
    text = replace_once(text, REFUND_OLD, REFUND_NEW, 'action transaction refund', path)
    text = replace_once(text, SNAPSHOT_OLD, SNAPSHOT_NEW, 'resource transaction snapshot', path)
    text = replace_once(text, STRIP_OLD, STRIP_NEW, 'combat action strip', path)

    reset_old = "row.turn={round:0,used:{standard:false,shift:false,swift:false},conversions:[]};row.moveState.rollout="
    reset_new = "row.turn={round:0,used:{standard:false,shift:false,swift:false},conversions:[],bonus:{standard:0},bonusUsed:{standard:0}};row.triggerWindows={};row.viciousActivation=null;row.moveState.rollout="
    if reset_new not in text:
        count = text.count(reset_old)
        if count < 2:
            raise SystemExit(f'Vicious boundary reset anchors drifted in {path}: found {count}')
        text = text.replace(reset_old, reset_new)

    if 'function pokemonCombatViciousAbilityResourceSpec(' not in text:
        anchor = 'function pokemonCombatQuickCurlAbilityResourceSpec('
        at = text.find(anchor)
        if at < 0:
            anchor = 'function pokemonCombatRolloutAfterResult('
            at = text.find(anchor)
        if at < 0:
            raise SystemExit(f'Vicious helper anchor drifted: {path}')
        text = text[:at] + VICIOUS_HELPERS.rstrip() + '\n' + text[at:]

    dispatch_old = "async function pokemonCombatDispatchMoveFormEvent(id,row){const p=pokemon(id),def=row?.definition||{};if(!p)return;"
    dispatch_new = "async function pokemonCombatDispatchMoveFormEvent(id,row){const p=pokemon(id),def=row?.definition||{};if(!p)return;pokemonCombatViciousRecordMoveUse(id,row);"
    text = replace_once(text, dispatch_old, dispatch_new, 'Move trigger recorder', path)

    condition_old = "const parts=[];if(row?.conditions?.curledUp)"
    condition_new = "const parts=[];if(Number(row?.conditions?.viciousCriticalRangeBonus||0)>0)parts.push(`<div class=\"flow-note\"><strong>Vicious</strong><small>Critical Hit Range +${Number(row.conditions.viciousCriticalRangeBonus)} for all attacks · remains until this Pokémon leaves the current Combat session.</small></div>`);if(row?.conditions?.curledUp)"
    text = replace_once(text, condition_old, condition_new, 'Vicious condition feedback', path)

    vicious_section = "const vicious=data?pokemonCombatViciousPanel(active.id,data):'';if(vicious)body+=section('VICIOUS · HONE CLAWS',vicious);"
    if vicious_section not in text:
        anchor = "const quickCurl=data?pokemonCombatQuickCurlPanel(active.id,data):'';if(quickCurl)body+=section('QUICK CURL · DEFENSE CURL',quickCurl);"
        at = text.find(anchor)
        if at < 0:
            raise SystemExit(f'Vicious Combat section anchor drifted: {path}')
        insert_at = at + len(anchor)
        text = text[:insert_at] + vicious_section + text[insert_at:]

    if text != original:
        path.write_text(text, encoding='utf-8')
        return True
    return False


def write_docs() -> list[str]:
    payload = {
        'schema_version': 1,
        'name': 'PTU Combat Vicious + Hone Claws',
        'shared_combat_ledger': True,
        'physical_dice_only': True,
        'target_model': 'self; no opponent entity',
        'ability': {
            'name': 'Vicious',
            'source': 'Pokemon Tabletop United 1.05 Core p.335',
            'frequency': 'Scene',
            'action_cost': 'Special',
            'trigger': 'The user uses Hone Claws',
            'choices': [
                'Gain another Standard Action this round.',
                'Increase Critical Hit Range on all attacks by +2 for the remainder of the encounter.',
            ],
        },
        'move': {
            'name': 'Hone Claws',
            'source': 'Pokemon Tabletop United 1.05 Core p.351',
            'frequency': 'At-Will',
            'range': 'Self',
            'effect': 'Accuracy +1 and Attack +1 Combat Stage.',
            'normal_move_path': 'preserved',
        },
        'runtime_policy': {
            'trigger_window': 'opens only after a source-matched Hone Claws use; expires after another Move or the round/Scene/Day boundary',
            'extra_standard': 'adds one Standard Action token to the current turn; the shared action API may spend it as Standard or convert it to Swift/Shift under the normal PTU conversion rule',
            'full_action': 'bonus Standard does not satisfy Full Action in v1; Full Action still requires the base Standard + Shift pair',
            'critical_range': 'records +2 as controlled-Pokemon combat state until the Pokémon leaves the current Combat session; hit/critical outcome remains manually confirmed',
            'frequency': 'one Vicious activation per Scene; resource-only Undo does not rewind the selected effect and an applied-effect marker prevents double activation in that Scene',
        },
        'source_conflicts_observed_while_selecting_candidate': {
            'Electrodash': 'Core: Scene – Free Action, Sprint as Swift; Feb 2016 playtest: Scene x2 – Swift Action, Sprint as Free plus additional bonuses. Rejected for this pass.',
            'Quick Curl': 'Core and Feb 2016 playtest contain conflicting definitions. Existing Quick Curl automation remains Core-signature-gated and therefore disables itself when the active Ruleset definition differs.',
        },
        'non_goals': [
            'No opponent entity.',
            'No digital RNG.',
            'No generic Ability/Move prose parser.',
            'No automatic determination of Critical Hits.',
            'No bundled/default .ptucp mutation.',
        ],
    }
    rendered = json.dumps(payload, indent=2, ensure_ascii=False) + '\n'
    md = '''# PTU Combat Vicious + Hone Claws\n\nThis layer adds a source-explicit **triggered Ability + Move connection** while extending the shared Pokémon Combat action ledger to represent a real extra Standard Action.\n\n## Source rules\n\nPTU Core p.335 defines **Vicious** as `Scene – Special`, triggered when the user uses **Hone Claws**. On activation, choose one effect: gain another Standard Action this round, or increase Critical Hit Range on all attacks by +2 for the remainder of the encounter.\n\nPTU Core p.351 defines **Hone Claws** as `At-Will`, AC None, Status, Self; it raises Accuracy by +1 and Attack by +1 Combat Stage. The ordinary Hone Claws Move path is unchanged.\n\n## Shared action ledger\n\nThe extra-Standard choice adds one Standard Action token to the current turn. The same action API used by Moves, Maneuvers, Abilities and Forms consumes that token. Under the normal PTU action-conversion rule it may be exchanged for another Swift or Shift Action. The conservative v1 model does **not** let a bonus Standard satisfy a Full Action; Full Actions continue to require the base Standard + Shift pair.\n\n## Trigger and frequency\n\nThe Vicious panel is exposed only when both Vicious and Hone Claws match audited source signatures. Using Hone Claws opens the trigger for the current round. Another Move or a round/Scene/Day boundary closes it. Vicious spends its own Scene resource through the shared non-Move ledger.\n\nResource-only Undo restores only ledger spending. It does not remove a granted extra Standard Action or an already-applied critical-range effect. To prevent correction from becoming a duplicate activation, the applied Vicious effect is separately marked as used for that Scene.\n\n## Critical-range choice\n\nThe +2 Critical Hit Range is recorded on the controlled Pokémon until it leaves the current Combat session. Combat still uses physical dice and user-confirmed Hit/Miss/Critical outcomes; this layer does not generate dice or infer a Critical result. The +2 choice is not stacked repeatedly by automation.\n\n## Source audit note\n\n**Electrodash was rejected for this pass** because the supplied Core and February 2016 playtest definitions conflict: the Core version is `Scene – Free Action` and makes Sprint a Swift Action, while the playtest changes both frequency/action and makes Sprint a Free Action with additional bonuses.\n\nThe same audit also surfaced a February 2016 Quick Curl variant that conflicts with the Core Quick Curl used by the existing integration. That integration is already active-Ruleset source-signature-gated, so the automated Core path is disabled whenever the active Quick Curl definition differs.\n\n## Conservative gates\n\nNo opponent state, generated dice, generic prose parser, automatic Critical determination, or default `.ptucp` mutation is introduced.\n'''
    changed = []
    if not DOC_JSON.exists() or DOC_JSON.read_text(encoding='utf-8') != rendered:
        DOC_JSON.write_text(rendered, encoding='utf-8'); changed.append(str(DOC_JSON.relative_to(REPO)))
    if not DOC_MD.exists() or DOC_MD.read_text(encoding='utf-8') != md:
        DOC_MD.write_text(md, encoding='utf-8'); changed.append(str(DOC_MD.relative_to(REPO)))
    return changed


def patch_shared_docs() -> list[str]:
    changed = []
    session = json.loads(SESSION_JSON.read_text(encoding='utf-8'))
    connections = session.setdefault('triggered_connections', {})
    connections['vicious_hone_claws'] = {
        'ability': 'Vicious · Scene – Special',
        'trigger_move': 'Hone Claws · At-Will · Self',
        'choices': ['another Standard Action this round', 'Critical Hit Range +2 for the remainder of the encounter'],
        'extra_standard_shared_action_api': True,
        'standard_to_swift_or_shift': True,
        'bonus_standard_satisfies_full_action': False,
        'source_signature_guard': True,
        'physical_dice_only': True,
        'resource_only_refund': True,
    }
    rendered = json.dumps(session, indent=2, ensure_ascii=False) + '\n'
    if SESSION_JSON.read_text(encoding='utf-8') != rendered:
        SESSION_JSON.write_text(rendered, encoding='utf-8'); changed.append(str(SESSION_JSON.relative_to(REPO)))

    smd = SESSION_MD.read_text(encoding='utf-8')
    appendix = '''\n## Vicious + Hone Claws triggered connection\n\nThe controlled-Pokémon ledger now supports a real bonus Standard Action through the source-explicit Vicious trigger. After a source-matched Hone Claws use, Vicious (`Scene – Special`) may grant another Standard Action for that round or record Critical Hit Range +2 for the remainder of the current Combat encounter. Bonus Standard Actions share the same Standard/Swift/Shift conversion API but are conservatively not used to satisfy Full Actions. See `PTU_COMBAT_VICIOUS.md`.\n'''
    if '## Vicious + Hone Claws triggered connection' not in smd:
        SESSION_MD.write_text(smd.rstrip() + '\n' + appendix, encoding='utf-8'); changed.append(str(SESSION_MD.relative_to(REPO)))
    return changed


def main() -> None:
    clients_changed = [str(path.relative_to(REPO)) for path in CLIENTS if patch_client(path)]
    docs_changed = write_docs() + patch_shared_docs()
    print({
        'combat_vicious_model': 1,
        'clients_changed': clients_changed,
        'docs_changed': docs_changed,
        'ability': 'Vicious',
        'trigger_move': 'Hone Claws',
        'extra_standard': True,
        'critical_range_bonus': 2,
        'physical_dice_only': True,
        'target_model': 'self',
    })


if __name__ == '__main__':
    main()
