#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
CLIENTS = [ROOT / 'static-preview' / 'app.js', REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'app.js']
DOC_JSON = REPO / 'docs' / 'data' / 'PTU_COMBAT_MOVE_OUTCOMES.json'
DOC_MD = REPO / 'docs' / 'PTU_COMBAT_MOVE_OUTCOMES.md'


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    if replacement in text:
        return text
    start_at = text.find(start)
    if start_at < 0:
        raise SystemExit(f'Self-outcome start anchor drifted: {label}')
    end_at = text.find(end, start_at)
    if end_at < 0:
        raise SystemExit(f'Self-outcome end anchor drifted: {label}')
    return text[:start_at] + replacement.rstrip() + '\n' + text[end_at:]


OUTCOME_SPEC = r'''function pokemonCombatOutcomeSpec(name){
  const slug=pokemonCombatSlug(name);
  if(POKEMON_COMBAT_DRAINING_MOVES.has(slug))return {kind:'drain-half',requiresTargetDamage:true};
  if(slug==='fury-cutter')return {kind:'fury-cutter',requiresTargetDamage:true};
  if(slug==='fell-stinger')return {kind:'fell-stinger',requiresTargetFainted:true};
  if(slug==='close-combat')return {kind:'close-combat'};
  if(slug==='leaf-storm')return {kind:'leaf-storm',requiresDamageDealt:true};
  if(slug==='petal-dance')return {kind:'petal-dance',requiresDamageDealt:true};
  if(slug==='charge-beam')return {kind:'charge-beam',requiresExtraD20:true};
  return {kind:'none'};
}'''

OUTCOME_UI = r'''function pokemonCombatOutcomeUiFields(spec,ledger){
  if(spec.kind==='fury-cutter'){
    const fury=pokemonCombatFuryCutterState(ledger),same=fury.active?`<label>Same target as current Fury Cutter chain?<select id="combat-same-target"><option value="">Choose…</option><option value="yes">Yes</option><option value="no">No · new abstract target</option></select></label>`:'';
    return `${same}<label>Damage actually taken by target<input id="combat-target-damage-dealt" type="number" min="0" step="1" placeholder="required on a hit"></label>`;
  }
  if(spec.requiresTargetDamage)return `<label>Damage actually taken by target<input id="combat-target-damage-dealt" type="number" min="0" step="1" placeholder="required on a hit"></label>`;
  if(spec.requiresTargetFainted)return `<label>Did this Move knock out the target?<select id="combat-target-fainted"><option value="">Choose…</option><option value="no">No</option><option value="yes">Yes</option></select></label>`;
  if(spec.requiresDamageDealt)return `<label>Did this Move deal damage?<select id="combat-damage-dealt"><option value="">Choose…</option><option value="yes">Yes</option><option value="no">No</option></select></label>`;
  if(spec.requiresExtraD20)return `<label>Effect roll · physical d20<input id="combat-extra-d20" type="number" min="1" max="20" step="1" placeholder="required on a hit"></label>`;
  return '';
}'''

STAGE_HELPERS = r'''function pokemonCombatApplyCombatStages(id,changes={},source='Move effect'){
  const p=pokemon(id);if(!p)return {changes:{}};p.combatStages ||= {};const labels={attack:'Attack',defense:'Defense',spAttack:'Special Attack',spDefense:'Special Defense',speed:'Speed',accuracy:'Accuracy',evasion:'Evasion'},applied={};
  for(const [key,deltaRaw] of Object.entries(changes||{})){const delta=Number(deltaRaw||0);if(!delta)continue;const before=Math.max(-6,Math.min(6,Number(p.combatStages[key]||0))),after=Math.max(-6,Math.min(6,before+delta));p.combatStages[key]=after;applied[key]={before,after,applied:after-before,label:labels[key]||key};}
  const parts=Object.values(applied).map(row=>`${row.label} ${row.before>=0?'+':''}${row.before} → ${row.after>=0?'+':''}${row.after}`);if(parts.length)pokemonCombatLog(id,'Combat Stages',`${p.name} · ${parts.join(' · ')} from ${source}.`,'move-outcome');return {changes:applied};
}
function pokemonCombatApplyAttackStages(id,amount,source){
  const result=pokemonCombatApplyCombatStages(id,{attack:Number(amount||0)},source),row=result.changes.attack||{before:0,after:0,applied:0};return {before:row.before,after:row.after,applied:row.applied};
}
function pokemonCombatApplySelfStatuses(id,statuses=[],source='Move effect'){
  const p=pokemon(id),ledger=pokemonCombatParticipant(id);if(!p||!ledger)return {statuses:[]};ledger.conditions ||= {};const applied=[];for(const raw of statuses){const key=pokemonCombatSlug(raw).replace(/-/g,'');if(!key)continue;ledger.conditions[key]=true;applied.push(String(raw));}if(applied.length)pokemonCombatLog(id,'Status applied',`${p.name} became ${applied.join(' and ')} from ${source}.`,'move-outcome');return {statuses:applied};
}
function pokemonCombatChargeBeamRaisesSpAttack(extraD20){const roll=Number(extraD20);return Number.isInteger(roll)&&roll>=7&&roll<=20;}'''

APPLY_OUTCOME = r'''async function pokemonCombatApplyMoveOutcome(id,{name,hit,targetDamage=null,targetFainted=null,sameTarget=null,usedDb=null,damageDealt=null,extraD20=null}={}){
  const p=pokemon(id),ledger=pokemonCombatParticipant(id),slug=pokemonCombatSlug(name),spec=pokemonCombatOutcomeSpec(name),effects=[];if(!p||!ledger)return {effects};
  if(slug!=='fury-cutter'&&pokemonCombatFuryCutterState(ledger).active){pokemonCombatResetFuryCutter(ledger,'different-move');effects.push({kind:'fury-cutter-reset',reason:'different-move'});}
  if(spec.kind==='fury-cutter'){const current={...pokemonCombatFuryCutterState(ledger)},next=pokemonCombatFuryCutterAfterResult(current,{hit,targetDamage,sameTarget,usedDb});ledger.moveState.furyCutter=next;effects.push({kind:'fury-cutter',before:current,after:{...next}});}
  if(spec.kind==='drain-half'&&hit&&Number(targetDamage||0)>0){const heal=Math.floor(Number(targetDamage)/2),result=await pokemonCombatApplyHpGain(id,heal,name);effects.push({kind:'heal',amount:heal,result});}
  if(spec.kind==='fell-stinger'&&hit&&targetFainted===true){const result=pokemonCombatApplyAttackStages(id,2,'Fell Stinger');effects.push({kind:'attack-cs',amount:2,result});}
  if(spec.kind==='close-combat'&&hit){const result=pokemonCombatApplyCombatStages(id,{defense:-1,spDefense:-1},'Close Combat');effects.push({kind:'combat-stages',changes:{defense:-1,spDefense:-1},result});}
  if(spec.kind==='leaf-storm'&&hit&&damageDealt===true){const result=pokemonCombatApplyCombatStages(id,{spAttack:-2},'Leaf Storm');effects.push({kind:'combat-stages',changes:{spAttack:-2},result});}
  if(spec.kind==='petal-dance'&&hit&&damageDealt===true){const result=pokemonCombatApplySelfStatuses(id,['Enraged','Confused'],'Petal Dance');effects.push({kind:'self-status',statuses:['Enraged','Confused'],result});}
  if(spec.kind==='charge-beam'&&hit&&pokemonCombatChargeBeamRaisesSpAttack(extraD20)){const result=pokemonCombatApplyCombatStages(id,{spAttack:1},'Charge Beam');effects.push({kind:'combat-stages',changes:{spAttack:1},result,physicalEffectRoll:Number(extraD20)});}
  return {effects,spec};
}'''

RESOLVE_MOVE = r'''async function pokemonCombatResolveMove(id,index){
  const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,row=(data?.moves||[])[Number(index)],p=pokemon(id);if(!row||!p)return toast('Move reference data is unavailable.','error');const available=pokemonCombatMoveAvailability(id,row);if(!available.valid)return toast(available.reason,'error');
  const def=row.definition||{},name=def.name||row.record?.name||'Move',slug=pokemonCombatSlug(name),ledger=pokemonCombatParticipant(id),spec=pokemonCombatOutcomeSpec(name),damaging=!!row.resolvedDamage||['physical','special'].includes(String(def.category||def.class||'').toLowerCase());
  const naturalRaw=document.getElementById('combat-natural-roll')?.value,natural=naturalRaw===''||naturalRaw==null?null:Number(naturalRaw);if(natural!=null&&(!Number.isInteger(natural)||natural<1||natural>20))return toast('Natural d20 must be a physical die result from 1 to 20.','error');if(def.ac!=null&&natural==null)return toast('Enter the natural d20 result from the physical Accuracy die.','error');
  const hitRaw=String(document.getElementById('combat-hit-result')?.value||'');if(!['hit','miss'].includes(hitRaw))return toast('Confirm whether the Move hit or missed.','error');const hit=hitRaw==='hit',criticalRaw=damaging?String(document.getElementById('combat-critical-result')?.value||''):'';if(damaging&&hit&&!['yes','no'].includes(criticalRaw))return toast('Confirm whether the hit was Critical.','error');const critical=!!(damaging&&hit&&criticalRaw==='yes');
  const manualDamageRaw=damaging?document.getElementById('combat-manual-damage-roll')?.value:null,manualDamage=manualDamageRaw===''||manualDamageRaw==null?null:Number(manualDamageRaw);if(damaging&&hit&&(manualDamage==null||!Number.isInteger(manualDamage)||manualDamage<0))return toast('Enter the physical Damage Roll result for this hit.','error');
  const dealtRaw=document.getElementById('combat-target-damage-dealt')?.value,targetDamage=dealtRaw===''||dealtRaw==null?null:Number(dealtRaw);if(targetDamage!=null&&(!Number.isInteger(targetDamage)||targetDamage<0))return toast('Damage actually taken by the target must be a non-negative whole number.','error');if(hit&&spec.requiresTargetDamage&&targetDamage==null)return toast('Enter the damage actually taken by the abstract target for this Move effect.','error');
  const damageDealtRaw=String(document.getElementById('combat-damage-dealt')?.value||'');if(hit&&spec.requiresDamageDealt&&!['yes','no'].includes(damageDealtRaw))return toast('Confirm whether this Move actually dealt damage.','error');const damageDealt=spec.requiresDamageDealt?(hit&&damageDealtRaw==='yes'):null;
  const extraD20Raw=document.getElementById('combat-extra-d20')?.value,extraD20=extraD20Raw===''||extraD20Raw==null?null:Number(extraD20Raw);if(extraD20!=null&&(!Number.isInteger(extraD20)||extraD20<1||extraD20>20))return toast('The extra effect d20 must be a physical die result from 1 to 20.','error');if(hit&&spec.requiresExtraD20&&extraD20==null)return toast('Roll the Move effect d20 physically and enter the natural result.','error');
  const sameTargetRaw=String(document.getElementById('combat-same-target')?.value||''),furyBefore=slug==='fury-cutter'?{...pokemonCombatFuryCutterState(ledger)}:null;if(slug==='fury-cutter'&&hit&&furyBefore.active&&!['yes','no'].includes(sameTargetRaw))return toast('Confirm whether Fury Cutter is continuing against the same abstract target.','error');const sameTarget=slug==='fury-cutter'?(furyBefore.active&&hit?sameTargetRaw==='yes':true):null;
  const faintedRaw=String(document.getElementById('combat-target-fainted')?.value||'');if(hit&&spec.requiresTargetFainted&&!['yes','no'].includes(faintedRaw))return toast('Confirm whether this Move knocked out the abstract target.','error');const targetFainted=spec.requiresTargetFainted?faintedRaw==='yes':null;
  const action=pokemonCombatSpendAction(id,available.action);if(!action.valid)return toast(action.reason,'error');const freq=pokemonCombatSpendFrequency(id,available.key,available.frequency);if(!freq.valid)return toast(freq.reason,'error');
  let damage=null;if(hit&&damaging){const baseDb=slug==='rollout'?Number(ledger.moveState.rollout?.nextDb||3):slug==='fury-cutter'?Number(furyBefore.active&&sameTarget?furyBefore.nextDb:4):Number(row.resolvedDamage?.baseDamageBase??def.damageBase??0),stab=Number(row.resolvedDamage?.stabDamageBaseBonus||0),finalDb=Math.max(1,Math.min(28,(slug==='rollout'||slug==='fury-cutter')?baseDb+stab:Number(row.resolvedDamage?.finalDamageBase??baseDb+stab))),chart=await pokemonCombatDamageChart(finalDb,row),diceExpr=chart?.rolled_damage||chart?.rolledDamage||row.resolvedDamage?.damageChart?.rolled_damage||row.resolvedDamage?.damageChart?.rolledDamage||null,rolledExpression=critical?pokemonCombatDoubleDamageDiceExpression(diceExpr):diceExpr,stat=Number(row.resolvedDamage?.primaryStat?.value||0),mixed=Number(row.resolvedDamage?.mixedPowerBonus||0),knowsRoll=pokemonCombatKnowsRollMove(data),curl=pokemonCombatDefenseCurlModifier({curledUp:!!ledger.conditions.curledUp,moveName:name,knowsRollMove:knowsRoll}),bonus=Number(curl.damageBonus||0),total=Number(manualDamage||0)+stat+mixed+bonus;damage={baseDb,finalDb,diceExpr,rolledExpression,manualRoll:Number(manualDamage||0),stat,mixed,bonus,total,targetDamage};}
  if(slug==='rollout'){const usedDb=Number(damage?.baseDb??ledger.moveState.rollout?.nextDb??3);ledger.moveState.rollout=pokemonCombatRolloutAfterResult(ledger.moveState.rollout,hit,usedDb);}await pokemonCombatApplyMoveOutcome(id,{name,hit,targetDamage,targetFainted,sameTarget,usedDb:damage?.baseDb??null,damageDealt,extraD20});
  const accuracyText=natural==null?'no Accuracy Roll':`physical d20 ${natural}${def.ac!=null?` · Move AC ${row.effectiveAc??def.ac}`:''}`;let detail=`${p.name} used ${name} · ${accuracyText} · reported ${hit?(critical?'CRITICAL HIT':'HIT'):'MISS'} · ${action.spent}`;
  if(damage){detail+=` · DB ${damage.finalDb}${damage.rolledExpression?` · physical ${damage.rolledExpression}`:''} = ${damage.manualRoll} + Stat ${damage.stat}${damage.mixed?` + Mixed ${damage.mixed}`:''}${damage.bonus?` + Defense Curl ${damage.bonus}`:''} = ${damage.total} before unknown target defenses/effectiveness`;if(damage.targetDamage!=null)detail+=` · target actually took ${damage.targetDamage}`;}
  if(slug==='rollout')detail+=hit?` · next Rollout DB ${ledger.moveState.rollout.nextDb}`:' · Rollout chain reset to DB 3';if(slug==='fury-cutter'){const fury=ledger.moveState.furyCutter;detail+=fury.active?` · Fury Cutter chain ${fury.hits} hit${fury.hits===1?'':'s'} · next base DB ${fury.nextDb}`:` · Fury Cutter reset to DB 4 (${fury.lastResult})`;}
  if(spec.kind==='drain-half'&&hit)detail+=` · drain healing ${Math.floor(Number(targetDamage||0)/2)} HP`;if(spec.kind==='fell-stinger'&&hit)detail+=targetFainted?' · Fell Stinger KO confirmed · Attack +2 CS':' · Fell Stinger KO not confirmed';if(spec.requiresDamageDealt&&hit)detail+=damageDealt?' · damage dealt confirmed':' · no damage dealt';if(spec.kind==='charge-beam'&&hit)detail+=` · Charge Beam effect physical d20 ${extraD20}${pokemonCombatChargeBeamRaisesSpAttack(extraD20)?' · Special Attack +1 CS':' · no Special Attack increase'}`;pokemonCombatLog(id,critical?'Critical Hit':hit?'Move hit':'Move missed',detail,'move');await pokemonCombatDispatchMoveFormEvent(id,row);closeModal();await commit(detail);render();toast(hit?(critical?'Critical Hit recorded.':'Hit recorded.'):'Miss recorded.',hit?'success':'error');
}'''


def patch_client(path: Path) -> bool:
    text = path.read_text(encoding='utf-8');original = text
    text = replace_between(text,'function pokemonCombatOutcomeSpec(','function pokemonCombatFuryCutterState(',OUTCOME_SPEC,f'{path}: outcome spec')
    text = replace_between(text,'function pokemonCombatOutcomeUiFields(','async function pokemonCombatApplyHpGain(',OUTCOME_UI,f'{path}: outcome UI')
    text = replace_between(text,'function pokemonCombatApplyAttackStages(','async function pokemonCombatApplyMoveOutcome(',STAGE_HELPERS,f'{path}: self helpers')
    text = replace_between(text,'async function pokemonCombatApplyMoveOutcome(','async function pokemonCombatUseNoRoll(',APPLY_OUTCOME,f'{path}: apply self outcome')
    text = replace_between(text,'async function pokemonCombatResolveMove(','function pokemonCombatMoveCard(',RESOLVE_MOVE,f'{path}: resolve self outcome')
    if text != original:
        path.write_text(text,encoding='utf-8');return True
    return False


def write_docs() -> list[str]:
    data=json.loads(DOC_JSON.read_text(encoding='utf-8'))
    data['schema_version']=2
    handlers=data.setdefault('handlers',{})
    handlers['close_combat']={'input':'reported successful hit','effect':'controlled user Defense -1 CS and Special Defense -1 CS','source_semantics':'self stage change from the supplied Move effect'}
    handlers['leaf_storm']={'input':'did the Move actually deal damage?','effect':'on confirmed damage, controlled user Special Attack -2 CS'}
    handlers['petal_dance']={'input':'did the Move actually deal damage?','effect':'on confirmed damage, controlled user becomes Enraged and Confused','tracking':'combat-session condition flags; no enemy state'}
    handlers['charge_beam']={'inputs':['reported successful hit','extra physical d20 effect roll'],'threshold':'7+','effect':'controlled user Special Attack +1 CS on 7+','digital_rng':False}
    rendered=json.dumps(data,indent=2,ensure_ascii=False)+'\n'
    changed=[]
    if DOC_JSON.read_text(encoding='utf-8') != rendered:
        DOC_JSON.write_text(rendered,encoding='utf-8');changed.append(str(DOC_JSON.relative_to(REPO)))
    md=DOC_MD.read_text(encoding='utf-8')
    if '## v2 controlled-Pokémon outcomes' not in md:
        md += '''\n## v2 controlled-Pokémon outcomes\n\nThis pass adds explicit handlers for effects that change only the controlled Pokémon. No opposing entity is created.\n\n### Close Combat\n\nOn a reported successful hit, the controlled user lowers Defense and Special Defense by 1 Combat Stage each. The normal [-6,+6] Combat Stage bounds remain enforced.\n\n### Leaf Storm\n\nBecause the supplied Move says the Special Attack reduction occurs **after damage**, the UI asks only whether the Move actually dealt damage. On confirmation, the controlled user lowers Special Attack by 2 Combat Stages. No target HP or defenses are stored.\n\n### Petal Dance\n\nBecause the supplied Move says the statuses occur **after damage is dealt**, the UI asks only whether damage was actually dealt. On confirmation, the combat ledger marks the controlled user Enraged and Confused. These are session condition flags; detailed cure/save automation is intentionally outside this pass.\n\n### Charge Beam\n\nAfter a reported successful hit, the user rolls the additional **1d20 physically** and enters the natural result. On 7+, the controlled user's Special Attack rises by 1 Combat Stage. The Companion never generates this roll.\n\nAll four handlers remain explicit by Move name and supplied PTU wording; there is still no generic prose interpreter.\n'''
        DOC_MD.write_text(md,encoding='utf-8');changed.append(str(DOC_MD.relative_to(REPO)))
    return changed


def main() -> None:
    clients=[str(path.relative_to(REPO)) for path in CLIENTS if patch_client(path)];docs=write_docs();print({'move_outcome_model':2,'self_outcomes':['Close Combat','Leaf Storm','Petal Dance','Charge Beam'],'clients_changed':clients,'docs_changed':docs,'digital_rng':False})


if __name__ == '__main__':
    main()
