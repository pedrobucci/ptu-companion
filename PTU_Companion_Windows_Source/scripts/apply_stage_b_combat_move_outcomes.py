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
        raise SystemExit(f'Move-outcome start anchor drifted: {label}')
    end_at = text.find(end, start_at)
    if end_at < 0:
        raise SystemExit(f'Move-outcome end anchor drifted: {label}')
    return text[:start_at] + replacement.rstrip() + '\n' + text[end_at:]


OUTCOME_HELPERS = r'''const POKEMON_COMBAT_DRAINING_MOVES=new Set(['absorb','drain-punch','draining-kiss','dream-eater','giga-drain','horn-leech','leech-life','mega-drain']);
function pokemonCombatOutcomeSpec(name){
  const slug=pokemonCombatSlug(name);
  if(POKEMON_COMBAT_DRAINING_MOVES.has(slug))return {kind:'drain-half',requiresTargetDamage:true};
  if(slug==='fury-cutter')return {kind:'fury-cutter',requiresTargetDamage:true};
  if(slug==='fell-stinger')return {kind:'fell-stinger',requiresTargetFainted:true};
  return {kind:'none'};
}
function pokemonCombatFuryCutterState(ledger){
  if(!ledger)return {active:false,hits:0,nextDb:4,lastDb:null,lastResult:null};
  ledger.moveState ||= {};ledger.moveState.furyCutter ||= {active:false,hits:0,nextDb:4,lastDb:null,lastResult:null};return ledger.moveState.furyCutter;
}
function pokemonCombatResetFuryCutter(ledger,result='broken'){
  if(!ledger)return null;const current=pokemonCombatFuryCutterState(ledger);ledger.moveState.furyCutter={active:false,hits:0,nextDb:4,lastDb:current.lastDb??null,lastResult:result};return ledger.moveState.furyCutter;
}
function pokemonCombatFuryCutterAfterResult(current={},outcome={}){
  const usedDb=Math.max(4,Number(outcome.usedDb||4));const hit=!!outcome.hit,damaged=Number(outcome.targetDamage||0)>0,sameTarget=outcome.sameTarget!==false;
  if(!hit)return {active:false,hits:0,nextDb:4,lastDb:usedDb,lastResult:'miss'};
  if(!damaged)return {active:false,hits:0,nextDb:4,lastDb:usedDb,lastResult:'no-damage'};
  const continuing=!!current.active&&sameTarget,hits=continuing?Number(current.hits||0)+1:1;return {active:true,hits,nextDb:Math.min(16,usedDb+4),lastDb:usedDb,lastResult:continuing?'continued-hit':'new-target-hit'};
}
function pokemonCombatOutcomeUiFields(spec,ledger){
  if(spec.kind==='fury-cutter'){
    const fury=pokemonCombatFuryCutterState(ledger),same=fury.active?`<label>Same target as current Fury Cutter chain?<select id="combat-same-target"><option value="">Choose…</option><option value="yes">Yes</option><option value="no">No · new abstract target</option></select></label>`:'';
    return `${same}<label>Damage actually taken by target<input id="combat-target-damage-dealt" type="number" min="0" step="1" placeholder="required on a hit"></label>`;
  }
  if(spec.requiresTargetDamage)return `<label>Damage actually taken by target<input id="combat-target-damage-dealt" type="number" min="0" step="1" placeholder="required on a hit"></label>`;
  if(spec.requiresTargetFainted)return `<label>Did this Move knock out the target?<select id="combat-target-fainted"><option value="">Choose…</option><option value="no">No</option><option value="yes">Yes</option></select></label>`;
  return '';
}
async function pokemonCombatApplyHpGain(id,amount,source){
  const p=pokemon(id),requested=Math.max(0,Math.floor(Number(amount)||0));if(!p||requested<=0)return {requested,applied:0,before:Number(p?.hp||0),after:Number(p?.hp||0)};
  const before=Number(p.hp||0);await changeHp(id,requested);const after=Number(pokemon(id)?.hp||before),applied=Math.max(0,after-before);pokemonCombatLog(id,'HP gained',`${p.name} gained ${requested} HP from ${source}${applied!==requested?` · ${applied} restored to regular HP; remaining healing followed campaign HP/THP rules`:''}.`,'move-outcome');return {requested,applied,before,after};
}
function pokemonCombatApplyAttackStages(id,amount,source){
  const p=pokemon(id);if(!p)return {before:0,after:0,applied:0};p.combatStages ||= {};const before=Math.max(-6,Math.min(6,Number(p.combatStages.attack||0))),after=Math.max(-6,Math.min(6,before+Number(amount||0)));p.combatStages.attack=after;pokemonCombatLog(id,'Attack Combat Stage',`${p.name} Attack CS ${before>=0?'+':''}${before} → ${after>=0?'+':''}${after} from ${source}.`,'move-outcome');return {before,after,applied:after-before};
}
async function pokemonCombatApplyMoveOutcome(id,{name,hit,targetDamage=null,targetFainted=null,sameTarget=null,usedDb=null}={}){
  const p=pokemon(id),ledger=pokemonCombatParticipant(id),slug=pokemonCombatSlug(name),spec=pokemonCombatOutcomeSpec(name),effects=[];if(!p||!ledger)return {effects};
  if(slug!=='fury-cutter'&&pokemonCombatFuryCutterState(ledger).active){pokemonCombatResetFuryCutter(ledger,'different-move');effects.push({kind:'fury-cutter-reset',reason:'different-move'});}
  if(spec.kind==='fury-cutter'){const current={...pokemonCombatFuryCutterState(ledger)},next=pokemonCombatFuryCutterAfterResult(current,{hit,targetDamage,sameTarget,usedDb});ledger.moveState.furyCutter=next;effects.push({kind:'fury-cutter',before:current,after:{...next}});}
  if(spec.kind==='drain-half'&&hit&&Number(targetDamage||0)>0){const heal=Math.floor(Number(targetDamage)/2),result=await pokemonCombatApplyHpGain(id,heal,name);effects.push({kind:'heal',amount:heal,result});}
  if(spec.kind==='fell-stinger'&&hit&&targetFainted===true){const result=pokemonCombatApplyAttackStages(id,2,'Fell Stinger');effects.push({kind:'attack-cs',amount:2,result});}
  return {effects,spec};
}'''

USE_NO_ROLL = r'''async function pokemonCombatUseNoRoll(id,index){
  const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,row=(data?.moves||[])[Number(index)],p=pokemon(id);if(!row||!p)return toast('Move reference data is unavailable.','error');const available=pokemonCombatMoveAvailability(id,row);if(!available.valid)return toast(available.reason,'error');const action=pokemonCombatSpendAction(id,available.action);if(!action.valid)return toast(action.reason,'error');const freq=pokemonCombatSpendFrequency(id,available.key,available.frequency);if(!freq.valid)return toast(freq.reason,'error');const name=row.definition?.name||row.record?.name||'Move',ledger=pokemonCombatParticipant(id);
  if(pokemonCombatSlug(name)!=='fury-cutter'&&pokemonCombatFuryCutterState(ledger).active)pokemonCombatResetFuryCutter(ledger,'different-move');
  if(pokemonCombatSlug(name)==='defense-curl'){ledger.conditions.curledUp=true;pokemonCombatLog(id,'Defense Curl',`${p.name} became Curled Up · immune to Critical Hits · DR 10${pokemonCombatKnowsRollMove(data)?' · Rollout/Ice Ball prevent Slowed while Curled Up':' · Slowed'} · ${action.spent}.`,'condition');}else pokemonCombatLog(id,'Move used',`${p.name} used ${name} · ${action.spent}${available.frequency?` · ${available.frequency}`:''}.`,'move');await pokemonCombatDispatchMoveFormEvent(id,row);await commit(`${p.name} used ${name}.`);render();
}'''

OPEN_MOVE = r'''async function pokemonCombatOpenMove(id,index){
  const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,row=(data?.moves||[])[Number(index)],p=pokemon(id);if(!row||!p)return toast('Move reference data is unavailable.','error');const available=pokemonCombatMoveAvailability(id,row);if(!available.valid)return toast(available.reason,'error');
  const def=row.definition||{},name=def.name||row.record?.name||'Move';if(pokemonCombatSlug(name)==='defense-curl'||(def.ac==null&&!row.resolvedDamage))return pokemonCombatUseNoRoll(id,index);
  const slug=pokemonCombatSlug(name),ledger=pokemonCombatParticipant(id),spec=pokemonCombatOutcomeSpec(name),dynamic=slug==='rollout'||slug==='fury-cutter',rollState=ledger?.moveState?.rollout||{nextDb:3},fury=pokemonCombatFuryCutterState(ledger),damaging=!!row.resolvedDamage||['physical','special'].includes(String(def.category||def.class||'').toLowerCase());
  const baseDb=slug==='rollout'?Number(rollState.nextDb||3):slug==='fury-cutter'?Number(fury.active?fury.nextDb:4):Number(row.resolvedDamage?.baseDamageBase??def.damageBase??0),stab=Number(row.resolvedDamage?.stabDamageBaseBonus||0),finalDb=damaging?Math.max(1,Math.min(28,dynamic?baseDb+stab:Number(row.resolvedDamage?.finalDamageBase??baseDb+stab))):null;
  const chart=damaging?await pokemonCombatDamageChart(finalDb,row):null,diceExpr=chart?.rolled_damage||chart?.rolledDamage||row.resolvedDamage?.damageChart?.rolled_damage||row.resolvedDamage?.damageChart?.rolledDamage||null,critExpr=pokemonCombatDoubleDamageDiceExpression(diceExpr);
  let furyAlternate='';if(slug==='fury-cutter'&&fury.active){const altDb=4,altFinal=Math.max(1,Math.min(28,altDb+stab)),altChart=await pokemonCombatDamageChart(altFinal,row),altExpr=altChart?.rolled_damage||altChart?.rolledDamage||null;furyAlternate=`<div class="flow-note"><strong>Fury Cutter target continuity</strong><small>Same abstract target: base DB ${baseDb} → final DB ${finalDb}${diceExpr?` (${esc(diceExpr)})`:''}. New abstract target: base DB 4 → final DB ${altFinal}${altExpr?` (${esc(altExpr)})`:''}. Choose the correct target continuity before rolling the physical damage dice.</small></div>`;}
  const outcomeFields=pokemonCombatOutcomeUiFields(spec,ledger),damageFields=damaging?`<label>Physical Damage Roll<input id="combat-manual-damage-roll" type="number" min="0" step="1" placeholder="required on a hit"></label>`:'',criticalField=damaging?`<label>Critical Hit?<select id="combat-critical-result"><option value="">Choose…</option><option value="no">No</option><option value="yes">Yes</option></select></label>`:'';
  modal(`<div class="flow-note"><strong>${esc(name)}</strong><small>${esc(available.frequency||'At-Will')} · ${esc(available.action)}${slug==='rollout'?` · current Rollout DB ${baseDb}`:slug==='fury-cutter'?` · current Fury Cutter base DB ${baseDb}`:''}${finalDb?` · final DB ${finalDb}`:''}</small></div>${furyAlternate}<div class="form-grid"><label>Natural d20 · physical die<input id="combat-natural-roll" type="number" min="1" max="20" step="1" placeholder="${def.ac==null?'not required':'required'}"></label><label>Final attack result<select id="combat-hit-result"><option value="">Choose…</option><option value="hit">Hit</option><option value="miss">Miss</option></select></label>${criticalField}${damageFields}${outcomeFields}</div>${damaging&&diceExpr?`<div class="flow-note"><strong>Roll physical damage dice</strong><small>Normal: ${esc(diceExpr)}${critExpr?` · Critical: ${esc(critExpr)}`:''}. Enter the rolled Damage Base component only; the app adds this Pokémon's known attacking Stat and local bonuses afterward.</small></div>`:''}<div class="flow-note"><small>The Combat screen never generates attack or damage dice. The opposing Pokémon/NPC remains abstract. Outcome fields appear only when this Move's source-explicit effect needs information from that abstract target.</small></div><button class="btn btn-primary full" onclick="pokemonCombatResolveMove('${id}',${Number(index)})">Record ${esc(name)}</button>`,{title:`Combat · ${name}`,subtitle:'Physical dice only · record the outcome before spending action/frequency.'});
}'''

RESOLVE_MOVE = r'''async function pokemonCombatResolveMove(id,index){
  const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,row=(data?.moves||[])[Number(index)],p=pokemon(id);if(!row||!p)return toast('Move reference data is unavailable.','error');const available=pokemonCombatMoveAvailability(id,row);if(!available.valid)return toast(available.reason,'error');
  const def=row.definition||{},name=def.name||row.record?.name||'Move',slug=pokemonCombatSlug(name),ledger=pokemonCombatParticipant(id),spec=pokemonCombatOutcomeSpec(name),damaging=!!row.resolvedDamage||['physical','special'].includes(String(def.category||def.class||'').toLowerCase());
  const naturalRaw=document.getElementById('combat-natural-roll')?.value,natural=naturalRaw===''||naturalRaw==null?null:Number(naturalRaw);if(natural!=null&&(!Number.isInteger(natural)||natural<1||natural>20))return toast('Natural d20 must be a physical die result from 1 to 20.','error');if(def.ac!=null&&natural==null)return toast('Enter the natural d20 result from the physical Accuracy die.','error');
  const hitRaw=String(document.getElementById('combat-hit-result')?.value||'');if(!['hit','miss'].includes(hitRaw))return toast('Confirm whether the Move hit or missed.','error');const hit=hitRaw==='hit',criticalRaw=damaging?String(document.getElementById('combat-critical-result')?.value||''):'';if(damaging&&hit&&!['yes','no'].includes(criticalRaw))return toast('Confirm whether the hit was Critical.','error');const critical=!!(damaging&&hit&&criticalRaw==='yes');
  const manualDamageRaw=damaging?document.getElementById('combat-manual-damage-roll')?.value:null,manualDamage=manualDamageRaw===''||manualDamageRaw==null?null:Number(manualDamageRaw);if(damaging&&hit&&(manualDamage==null||!Number.isInteger(manualDamage)||manualDamage<0))return toast('Enter the physical Damage Roll result for this hit.','error');
  const dealtRaw=document.getElementById('combat-target-damage-dealt')?.value,targetDamage=dealtRaw===''||dealtRaw==null?null:Number(dealtRaw);if(targetDamage!=null&&(!Number.isInteger(targetDamage)||targetDamage<0))return toast('Damage actually taken by the target must be a non-negative whole number.','error');if(hit&&spec.requiresTargetDamage&&targetDamage==null)return toast('Enter the damage actually taken by the abstract target for this Move effect.','error');
  const sameTargetRaw=String(document.getElementById('combat-same-target')?.value||''),furyBefore=slug==='fury-cutter'?{...pokemonCombatFuryCutterState(ledger)}:null;if(slug==='fury-cutter'&&hit&&furyBefore.active&&!['yes','no'].includes(sameTargetRaw))return toast('Confirm whether Fury Cutter is continuing against the same abstract target.','error');const sameTarget=slug==='fury-cutter'?(furyBefore.active&&hit?sameTargetRaw==='yes':true):null;
  const faintedRaw=String(document.getElementById('combat-target-fainted')?.value||'');if(hit&&spec.requiresTargetFainted&&!['yes','no'].includes(faintedRaw))return toast('Confirm whether this Move knocked out the abstract target.','error');const targetFainted=spec.requiresTargetFainted?faintedRaw==='yes':null;
  const action=pokemonCombatSpendAction(id,available.action);if(!action.valid)return toast(action.reason,'error');const freq=pokemonCombatSpendFrequency(id,available.key,available.frequency);if(!freq.valid)return toast(freq.reason,'error');
  let damage=null;if(hit&&damaging){const baseDb=slug==='rollout'?Number(ledger.moveState.rollout?.nextDb||3):slug==='fury-cutter'?Number(furyBefore.active&&sameTarget?furyBefore.nextDb:4):Number(row.resolvedDamage?.baseDamageBase??def.damageBase??0),stab=Number(row.resolvedDamage?.stabDamageBaseBonus||0),finalDb=Math.max(1,Math.min(28,(slug==='rollout'||slug==='fury-cutter')?baseDb+stab:Number(row.resolvedDamage?.finalDamageBase??baseDb+stab))),chart=await pokemonCombatDamageChart(finalDb,row),diceExpr=chart?.rolled_damage||chart?.rolledDamage||row.resolvedDamage?.damageChart?.rolled_damage||row.resolvedDamage?.damageChart?.rolledDamage||null,rolledExpression=critical?pokemonCombatDoubleDamageDiceExpression(diceExpr):diceExpr,stat=Number(row.resolvedDamage?.primaryStat?.value||0),mixed=Number(row.resolvedDamage?.mixedPowerBonus||0),knowsRoll=pokemonCombatKnowsRollMove(data),curl=pokemonCombatDefenseCurlModifier({curledUp:!!ledger.conditions.curledUp,moveName:name,knowsRollMove:knowsRoll}),bonus=Number(curl.damageBonus||0),total=Number(manualDamage||0)+stat+mixed+bonus;damage={baseDb,finalDb,diceExpr,rolledExpression,manualRoll:Number(manualDamage||0),stat,mixed,bonus,total,targetDamage};}
  if(slug==='rollout'){const usedDb=Number(damage?.baseDb??ledger.moveState.rollout?.nextDb??3);ledger.moveState.rollout=pokemonCombatRolloutAfterResult(ledger.moveState.rollout,hit,usedDb);}await pokemonCombatApplyMoveOutcome(id,{name,hit,targetDamage,targetFainted,sameTarget,usedDb:damage?.baseDb??null});
  const accuracyText=natural==null?'no Accuracy Roll':`physical d20 ${natural}${def.ac!=null?` · Move AC ${row.effectiveAc??def.ac}`:''}`;let detail=`${p.name} used ${name} · ${accuracyText} · reported ${hit?(critical?'CRITICAL HIT':'HIT'):'MISS'} · ${action.spent}`;
  if(damage){detail+=` · DB ${damage.finalDb}${damage.rolledExpression?` · physical ${damage.rolledExpression}`:''} = ${damage.manualRoll} + Stat ${damage.stat}${damage.mixed?` + Mixed ${damage.mixed}`:''}${damage.bonus?` + Defense Curl ${damage.bonus}`:''} = ${damage.total} before unknown target defenses/effectiveness`;if(damage.targetDamage!=null)detail+=` · target actually took ${damage.targetDamage}`;}
  if(slug==='rollout')detail+=hit?` · next Rollout DB ${ledger.moveState.rollout.nextDb}`:' · Rollout chain reset to DB 3';if(slug==='fury-cutter'){const fury=ledger.moveState.furyCutter;detail+=fury.active?` · Fury Cutter chain ${fury.hits} hit${fury.hits===1?'':'s'} · next base DB ${fury.nextDb}`:` · Fury Cutter reset to DB 4 (${fury.lastResult})`;}
  if(spec.kind==='drain-half'&&hit)detail+=` · drain healing ${Math.floor(Number(targetDamage||0)/2)} HP`;if(spec.kind==='fell-stinger'&&hit)detail+=targetFainted?' · Fell Stinger KO confirmed · Attack +2 CS':' · Fell Stinger KO not confirmed';pokemonCombatLog(id,critical?'Critical Hit':hit?'Move hit':'Move missed',detail,'move');await pokemonCombatDispatchMoveFormEvent(id,row);closeModal();await commit(detail);render();toast(hit?(critical?'Critical Hit recorded.':'Hit recorded.'):'Miss recorded.',hit?'success':'error');
}'''

SCENE_OLD = "row.moveState.rollout={active:false,hits:0,nextDb:3,lastDb:null,lastResult:null};}if(c.active)pokemonCombatLog(null,'Scene advanced',`Scene ${state.ui.scene} began; Scene frequencies and Rollout chains reset.`,'boundary');}"
SCENE_NEW = "row.moveState.rollout={active:false,hits:0,nextDb:3,lastDb:null,lastResult:null};row.moveState.furyCutter={active:false,hits:0,nextDb:4,lastDb:null,lastResult:null};}if(c.active)pokemonCombatLog(null,'Scene advanced',`Scene ${state.ui.scene} began; Scene frequencies, Rollout and Fury Cutter chains reset.`,'boundary');}"
DAY_OLD = "row.moveState.rollout={active:false,hits:0,nextDb:3,lastDb:null,lastResult:null};}if(c.active)pokemonCombatLog(null,'Day advanced',`Day ${state.ui.day} began; Daily and Scene frequencies reset.`,'boundary');}"
DAY_NEW = "row.moveState.rollout={active:false,hits:0,nextDb:3,lastDb:null,lastResult:null};row.moveState.furyCutter={active:false,hits:0,nextDb:4,lastDb:null,lastResult:null};}if(c.active)pokemonCombatLog(null,'Day advanced',`Day ${state.ui.day} began; Daily/Scene frequencies and chained Move state reset.`,'boundary');}"


def patch_client(path: Path) -> bool:
    text = path.read_text(encoding='utf-8');original = text
    if 'const POKEMON_COMBAT_DRAINING_MOVES=' not in text:
        anchor = 'function pokemonCombatKnowsRollMove(';at = text.find(anchor)
        if at < 0: raise SystemExit(f'Move-outcome helper anchor drifted: {path}')
        text = text[:at] + OUTCOME_HELPERS.rstrip() + '\n' + text[at:]
    text = replace_between(text,'async function pokemonCombatUseNoRoll(','async function pokemonCombatOpenMove(',USE_NO_ROLL,f'{path}: no-roll Move')
    text = replace_between(text,'async function pokemonCombatOpenMove(','async function pokemonCombatDamageChart(',OPEN_MOVE,f'{path}: open Move')
    text = replace_between(text,'async function pokemonCombatResolveMove(','function pokemonCombatMoveCard(',RESOLVE_MOVE,f'{path}: resolve Move')
    if SCENE_NEW not in text:
        if SCENE_OLD not in text: raise SystemExit(f'Move-outcome Scene reset anchor drifted: {path}')
        text = text.replace(SCENE_OLD,SCENE_NEW,1)
    if DAY_NEW not in text:
        if DAY_OLD not in text: raise SystemExit(f'Move-outcome Day reset anchor drifted: {path}')
        text = text.replace(DAY_OLD,DAY_NEW,1)
    if text != original: path.write_text(text,encoding='utf-8');return True
    return False


def write_docs() -> list[str]:
    payload={'schema_version':1,'name':'PTU Combat Move Outcome Handlers','target_model':'abstract','physical_dice_only':True,'handlers':{
        'drain_half':{'moves':['Absorb','Drain Punch','Draining Kiss','Dream Eater','Giga Drain','Horn Leech','Leech Life','Mega Drain'],'input':'damage actually taken by target','effect':'controlled user gains floor(target damage / 2) HP','rounding':'PTU Core general decimal rule: round down'},
        'fury_cutter':{'inputs':['reported hit/miss','damage actually taken by target','same abstract target when a chain exists'],'base_db':[4,8,12,16],'reset':['miss','failed to damage','different Move','Scene/Day boundary'],'target_identity':'not persisted; same-target continuity is user-confirmed'},
        'fell_stinger':{'input':'did this Move knock out the target?','effect':'on confirmed successful knockout, raise controlled user Attack by 2 Combat Stages, capped by normal CS bounds'}},
        'non_goals':['No enemy/NPC entity or HP ledger.','No generated d20 or damage dice.','No generic prose interpreter for Move effects.']}
    rendered=json.dumps(payload,indent=2,ensure_ascii=False)+'\n'
    md='''# PTU Combat Move Outcome Handlers\n\nThis layer consumes **player-reported outcomes from physical dice and an abstract opposing target**. It never creates an enemy/NPC entity and never generates dice.\n\n## v1 handlers\n\n### Draining Moves\n\nSource-explicit half-damage draining is enabled for Absorb, Drain Punch, Draining Kiss, Dream Eater, Giga Drain, Horn Leech, Leech Life, and Mega Drain. On a reported hit, `Damage actually taken by target` is required. The controlled Pokémon gains half of that value in HP. PTU Core's general decimal rule rounds down, so odd damage uses `floor(damage / 2)`. Healing is routed through the campaign HP/Form path rather than bypassing it.\n\n### Fury Cutter\n\nThe handler tracks only the controlled Pokémon's chain state: DB 4 → 8 → 12 → 16 on successful consecutive damaging uses against the same abstract target. A miss, a hit that deals 0 actual damage, a different Move, or a Scene/Day boundary resets the chain to DB 4. When a chain exists, the user confirms only whether the current Fury Cutter is against the same abstract target; no target entity or identifier is persisted.\n\n### Fell Stinger\n\nAfter a reported hit, the user confirms whether Fell Stinger knocked out the target. A confirmed knockout raises the controlled Pokémon's Attack by 2 Combat Stages, respecting normal Combat Stage bounds.\n\n## Physical-dice invariant\n\nAttack and damage dice are always rolled physically. The Companion records the natural d20, player-confirmed Hit/Miss and Critical result, manual Damage Roll, and only those external outcome values required by a source-explicit handler.\n\n## Conservative boundary\n\nHandlers are explicit by Move name and supplied PTU rule. This pass does not parse arbitrary effect prose and does not infer opponent Defense, Evasion, HP, typing, Features, Abilities, DR, conditions, or type effectiveness.\n'''
    changed=[]
    if not DOC_JSON.exists() or DOC_JSON.read_text(encoding='utf-8') != rendered: DOC_JSON.write_text(rendered,encoding='utf-8');changed.append(str(DOC_JSON.relative_to(REPO)))
    if not DOC_MD.exists() or DOC_MD.read_text(encoding='utf-8') != md: DOC_MD.write_text(md,encoding='utf-8');changed.append(str(DOC_MD.relative_to(REPO)))
    return changed


def main() -> None:
    clients=[str(path.relative_to(REPO)) for path in CLIENTS if patch_client(path)];docs=write_docs();print({'move_outcome_model':1,'clients_changed':clients,'docs_changed':docs})


if __name__ == '__main__':
    main()
