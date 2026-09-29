#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
CLIENTS = [
    ROOT / 'static-preview' / 'app.js',
    REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'app.js',
]
REPOSITORY = ROOT / 'persistence' / 'repository.mjs'
DOC_JSON = REPO / 'docs' / 'data' / 'PTU_COMBAT_SESSION_LEDGER.json'
DOC_MD = REPO / 'docs' / 'PTU_COMBAT_SESSION_LEDGER.md'
OLD_AUDIT_JSON = REPO / 'docs' / 'data' / 'PTU_FORMS_COMBAT_RESOURCE_AUDIT.json'
OLD_AUDIT_MD = REPO / 'docs' / 'PTU_FORMS_COMBAT_RESOURCE_AUDIT.md'

HELPER = r'''let pokemonCombatReferenceState={pokemonId:null,loading:false,error:null,data:null};
function pokemonCombatDefaultUi(){return {version:1,active:false,rosterId:null,activePokemonId:null,participantIds:[],participants:{},log:[]};}
function normalizePokemonCombatUiState(value){
  const base=pokemonCombatDefaultUi(),src=value&&typeof value==='object'?value:{};const out={...base,...src};
  out.version=1;out.active=!!out.active;out.rosterId=out.rosterId||null;out.activePokemonId=out.activePokemonId||null;
  out.participantIds=Array.isArray(out.participantIds)?[...new Set(out.participantIds.map(String).filter(Boolean))]:[];
  out.participants=out.participants&&typeof out.participants==='object'?out.participants:{};out.log=Array.isArray(out.log)?out.log.slice(-120):[];
  return out;
}
function ensurePokemonCombatUi(){state.ui ||= {};state.ui.combat=normalizePokemonCombatUiState(state.ui.combat);const c=state.ui.combat;if(!c.rosterId)c.rosterId=state.selectedRosterId||state.rosters?.find(r=>r.active!==false)?.id||state.rosters?.[0]?.id||null;return c;}
function pokemonCombatParticipant(id,{create=true}={}){
  const c=ensurePokemonCombatUi(),key=String(id||'');if(!key)return null;let row=c.participants[key];
  if(!row&&create){row={pokemonId:key,joinedAt:new Date().toISOString(),turn:{round:0,used:{standard:false,shift:false,swift:false},conversions:[]},frequency:{sceneNumber:Number(state.ui.scene||1),dayNumber:Number(state.ui.day||1),scene:{},day:{},eot:{}},conditions:{curledUp:false},moveState:{rollout:{active:false,hits:0,nextDb:3,lastDb:null,lastResult:null}},extended:{},log:[]};c.participants[key]=row;}
  if(!row)return null;row.turn ||= {round:0,used:{standard:false,shift:false,swift:false},conversions:[]};row.turn.used ||= {standard:false,shift:false,swift:false};row.turn.conversions ||= [];
  row.frequency ||= {sceneNumber:Number(state.ui.scene||1),dayNumber:Number(state.ui.day||1),scene:{},day:{},eot:{}};row.frequency.scene ||= {};row.frequency.day ||= {};row.frequency.eot ||= {};
  row.conditions ||= {curledUp:false};row.moveState ||= {};row.moveState.rollout ||= {active:false,hits:0,nextDb:3,lastDb:null,lastResult:null};row.extended ||= {};row.log=Array.isArray(row.log)?row.log:[];return row;
}
function pokemonCombatSyncBoundaries(row){if(!row)return;const f=row.frequency||(row.frequency={});const scene=Number(state.ui.scene||1),day=Number(state.ui.day||1);if(Number(f.sceneNumber)!==scene){f.sceneNumber=scene;f.scene={};}if(Number(f.dayNumber)!==day){f.dayNumber=day;f.day={};f.sceneNumber=scene;f.scene={};}f.eot ||= {};}
function pokemonCombatTurn(id,{reset=false}={}){const row=pokemonCombatParticipant(id);if(!row)return null;const round=Number(state.ui.round||1);if(reset||Number(row.turn.round)!==round){row.turn={round,used:{standard:false,shift:false,swift:false},conversions:[]};}return row.turn;}
function pokemonCombatLog(id,title,detail,kind='event'){
  const c=ensurePokemonCombatUi(),entry={id:uid('combat'),at:new Date().toISOString(),round:Number(state.ui.round||1),scene:Number(state.ui.scene||1),day:Number(state.ui.day||1),pokemonId:id||null,title,detail,kind};c.log.push(entry);c.log=c.log.slice(-120);const row=id?pokemonCombatParticipant(id):null;if(row){row.log.push(entry);row.log=row.log.slice(-60);}return entry;
}
function pokemonCombatSlug(value){return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
function pokemonCombatParseFrequency(text){const raw=String(text||'At-Will').trim();if(!raw||/^at-will$/i.test(raw))return {kind:'at-will',limit:null,label:raw||'At-Will'};let m=raw.match(/\bScene(?:\s*x\s*(\d+))?/i);if(m)return {kind:'scene',limit:Number(m[1]||1),label:raw};m=raw.match(/\bDaily(?:\s*x\s*(\d+))?/i);if(m)return {kind:'daily',limit:Number(m[1]||1),label:raw};if(/\bEOT\b/i.test(raw))return {kind:'eot',limit:1,label:raw};return {kind:'informational',limit:null,label:raw};}
function pokemonCombatActionCostForMove(def={}){const text=`${def.range||''} ${def.effect||''}`;if(/\bFull Action\b/i.test(text))return 'Full Action';if(/\bSwift Action\b/i.test(text))return 'Swift Action';if(/\bShift Action\b/i.test(text))return 'Shift Action';if(/\bFree Action\b/i.test(text))return 'Free Action';return 'Standard Action';}
function pokemonCombatCanSpendAction(id,cost){const turn=pokemonCombatTurn(id);if(!turn)return {valid:false,reason:'No combat turn is available.'};const used=turn.used||{};if(cost==='Free Action')return {valid:true};if(cost==='Full Action')return !used.standard&&!used.shift?{valid:true}:{valid:false,reason:'Full Action needs both Standard and Shift Actions available.'};if(cost==='Standard Action')return !used.standard?{valid:true}:{valid:false,reason:'Standard Action already spent this turn.'};if(cost==='Swift Action')return !used.swift||!used.standard?{valid:true}:{valid:false,reason:'Swift Action already spent and Standard Action is unavailable for conversion.'};if(cost==='Shift Action')return !used.shift||!used.standard?{valid:true}:{valid:false,reason:'Shift Action already spent and Standard Action is unavailable for conversion.'};return {valid:true,informational:true};}
function pokemonCombatSpendAction(id,cost){const check=pokemonCombatCanSpendAction(id,cost);if(!check.valid)return check;const turn=pokemonCombatTurn(id),used=turn.used;if(cost==='Free Action')return {valid:true,spent:'Free Action'};if(cost==='Full Action'){used.standard=true;used.shift=true;return {valid:true,spent:'Full Action'};}if(cost==='Standard Action'){used.standard=true;return {valid:true,spent:'Standard Action'};}if(cost==='Swift Action'){if(!used.swift){used.swift=true;return {valid:true,spent:'Swift Action'};}used.standard=true;turn.conversions.push('Standard → Swift');return {valid:true,spent:'Standard Action → Swift Action'};}if(cost==='Shift Action'){if(!used.shift){used.shift=true;return {valid:true,spent:'Shift Action'};}used.standard=true;turn.conversions.push('Standard → Shift');return {valid:true,spent:'Standard Action → Shift Action'};}return {valid:true,spent:null,informational:true};}
function pokemonCombatFrequencyKey(row){return pokemonCombatSlug(row?.definition?.id||row?.record?.id||row?.definition?.name||row?.record?.name||'move');}
function pokemonCombatFrequencyAvailability(id,key,frequency){const row=pokemonCombatParticipant(id);if(!row)return {valid:false,reason:'Combatant is not in the session.'};pokemonCombatSyncBoundaries(row);const parsed=pokemonCombatParseFrequency(frequency);if(parsed.kind==='at-will'||parsed.kind==='informational')return {valid:true,parsed};if(parsed.kind==='scene'){const used=Number(row.frequency.scene[key]||0);return used<parsed.limit?{valid:true,parsed,used}:{valid:false,parsed,used,reason:`${parsed.label} exhausted for this Scene.`};}if(parsed.kind==='daily'){const used=Number(row.frequency.day[key]||0);return used<parsed.limit?{valid:true,parsed,used}:{valid:false,parsed,used,reason:`${parsed.label} exhausted for this Day.`};}if(parsed.kind==='eot'){const last=Number(row.frequency.eot[key]||0);const round=Number(state.ui.round||1);return !last||round-last>=2?{valid:true,parsed,last}:{valid:false,parsed,last,reason:'EOT Move is not available on the immediately following turn.'};}return {valid:true,parsed};}
function pokemonCombatSpendFrequency(id,key,frequency){const check=pokemonCombatFrequencyAvailability(id,key,frequency);if(!check.valid)return check;const row=pokemonCombatParticipant(id),parsed=check.parsed;if(parsed.kind==='scene')row.frequency.scene[key]=Number(row.frequency.scene[key]||0)+1;else if(parsed.kind==='daily')row.frequency.day[key]=Number(row.frequency.day[key]||0)+1;else if(parsed.kind==='eot')row.frequency.eot[key]=Number(state.ui.round||1);return {...check,spent:parsed.kind};}
function pokemonCombatRolloutAfterResult(current={},hit=false,usedDb=3){if(!hit)return {active:false,hits:0,nextDb:3,lastDb:Number(usedDb||3),lastResult:'miss'};const hits=Number(current.hits||0)+1;return {active:true,hits,nextDb:Math.min(15,Number(usedDb||3)+4),lastDb:Number(usedDb||3),lastResult:'hit'};}
function pokemonCombatDefenseCurlModifier({curledUp=false,moveName='',knowsRollMove=false}={}){const rolling=['rollout','ice-ball'].includes(pokemonCombatSlug(moveName));return {accuracyPenalty:curledUp&&!rolling?-4:0,damageBonus:curledUp&&rolling?10:0,slowed:!!curledUp&&!knowsRollMove,criticalImmune:!!curledUp};}
function pokemonCombatMoveAvailability(id,row){const ledger=pokemonCombatParticipant(id);if(!ledger)return {valid:false,reason:'Add the Pokémon to Combat first.'};const name=pokemonCombatSlug(row?.definition?.name||row?.record?.name);if(ledger.moveState.rollout?.active&&name!=='rollout')return {valid:false,reason:'Rollout is active; the user must continue Rollout until it misses or has no valid target.'};const action=pokemonCombatActionCostForMove(row?.definition||{}),actionCheck=pokemonCombatCanSpendAction(id,action);if(!actionCheck.valid)return {...actionCheck,action};const frequency=row?.definition?.frequency||row?.record?.frequency||'At-Will';const key=pokemonCombatFrequencyKey(row),freqCheck=pokemonCombatFrequencyAvailability(id,key,frequency);if(!freqCheck.valid)return {...freqCheck,action,key,frequency};return {valid:true,action,key,frequency,frequencyParsed:freqCheck.parsed};}
function pokemonCombatRandomInt(max){const limit=Math.max(1,Number(max)||1);if(globalThis.crypto?.getRandomValues){const box=new Uint32Array(1);globalThis.crypto.getRandomValues(box);return Number(box[0]%limit)+1;}return Math.floor(Math.random()*limit)+1;}
function pokemonCombatRollDiceExpression(expression,multiplier=1){const raw=String(expression||'').replace(/\s+/g,'');const m=raw.match(/^(\d+)d(\d+)([+-]\d+)?$/i);if(!m)return {valid:false,expression:raw,rolls:[],flat:0,total:0};const count=Number(m[1])*Math.max(1,Number(multiplier)||1),sides=Number(m[2]),flat=Number(m[3]||0)*Math.max(1,Number(multiplier)||1),rolls=Array.from({length:count},()=>pokemonCombatRandomInt(sides));return {valid:true,expression:raw,rolls,flat,total:rolls.reduce((a,b)=>a+b,0)+flat};}
function pokemonCombatKnowsRollMove(data){return (data?.moves||[]).some(row=>['rollout','ice-ball'].includes(pokemonCombatSlug(row?.definition?.name||row?.record?.name)));}
async function loadPokemonCombatReferenceData(id=ensurePokemonCombatUi().activePokemonId,force=false){const p=pokemon(id);if(!p?.details?.speciesDefinitionId){pokemonCombatReferenceState={pokemonId:id||null,loading:false,error:'This Pokémon is not linked to a PTU Species definition.',data:null};render();return;}if(!force&&pokemonCombatReferenceState.pokemonId===id&&pokemonCombatReferenceState.data)return;pokemonCombatReferenceState={pokemonId:id,loading:true,error:null,data:null};render();try{const response=await fetch('/api/pokemon/reference-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:p,rulesetId:catalogState.status?.activeRulesetId})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Unable to load combat reference data');pokemonCombatReferenceState={pokemonId:id,loading:false,error:null,data:payload};}catch(error){pokemonCombatReferenceState={pokemonId:id,loading:false,error:error.message,data:null};}render();}
function pokemonCombatSelectRoster(id){const c=ensurePokemonCombatUi();c.rosterId=id||null;state.selectedRosterId=id||state.selectedRosterId;persist();render();}
async function pokemonCombatAdd(id){const p=pokemon(id);if(!p||p.storage)return toast('Only a carried Pokémon can enter Combat.','error');const c=ensurePokemonCombatUi();const fresh=!c.participantIds.includes(p.id);if(fresh)c.participantIds.push(p.id);pokemonCombatParticipant(p.id);c.active=true;c.activePokemonId=p.id;state.ui.inCombat=true;if(fresh&&p.details?.speciesDefinitionId)await applyPokemonFormGameEventUi(p.id,{kind:'battle-start'},{silent:true,commitAfter:false});pokemonCombatTurn(p.id,{reset:true});pokemonCombatLog(p.id,'Entered Combat',`${p.name} joined the combat session.`,'session');await commit(`${p.name} entered Combat.`);await loadPokemonCombatReferenceData(p.id,true);}
async function pokemonCombatRemove(id){const p=pokemon(id),c=ensurePokemonCombatUi();if(!p)return;if(p.details?.speciesDefinitionId)await applyPokemonFormGameEventUi(p.id,{kind:'battle-end'},{silent:true,commitAfter:false});c.participantIds=c.participantIds.filter(x=>x!==p.id);delete c.participants[p.id];if(c.activePokemonId===p.id)c.activePokemonId=c.participantIds[0]||null;if(!c.participantIds.length){c.active=false;state.ui.inCombat=false;}pokemonCombatReferenceState={pokemonId:null,loading:false,error:null,data:null};pokemonCombatLog(p.id,'Left Combat',`${p.name} left the combat session.`,'session');commit(`${p.name} left Combat.`);if(c.activePokemonId)setTimeout(()=>loadPokemonCombatReferenceData(c.activePokemonId,true),0);}
async function pokemonCombatEndSession(){const c=ensurePokemonCombatUi();for(const id of [...c.participantIds]){const p=pokemon(id);if(p?.details?.speciesDefinitionId)await applyPokemonFormGameEventUi(id,{kind:'battle-end'},{silent:true,commitAfter:false});}pokemonCombatLog(null,'Combat ended',`Session ended in Round ${state.ui.round}.`,'session');c.active=false;c.activePokemonId=null;c.participantIds=[];c.participants={};state.ui.inCombat=false;pokemonCombatReferenceState={pokemonId:null,loading:false,error:null,data:null};commit('Combat session ended.');}
function pokemonCombatActivate(id){const c=ensurePokemonCombatUi();if(!c.participantIds.includes(id))return;c.activePokemonId=id;pokemonCombatTurn(id);persist();render();setTimeout(()=>loadPokemonCombatReferenceData(id,true),0);}
function pokemonCombatBeginTurn(id){const c=ensurePokemonCombatUi();if(!c.participantIds.includes(id))return;c.activePokemonId=id;const row=pokemonCombatParticipant(id),wasRound=Number(row.turn?.round||0);pokemonCombatTurn(id,{reset:wasRound!==Number(state.ui.round||1)});pokemonCombatLog(id,'Turn active',`${pokemon(id)?.name||id} is active in Round ${state.ui.round}.`,'turn');persist();render();}
function pokemonCombatOnRoundAdvance(){const c=state.ui?.combat;if(!c?.active)return;c.activePokemonId=null;pokemonCombatLog(null,'Round advanced',`Round ${state.ui.round} began.`,'boundary');}
function pokemonCombatOnSceneAdvance(){const c=state.ui?.combat;if(!c)return;for(const id of (c.participantIds||[])){const row=pokemonCombatParticipant(id);if(!row)continue;row.frequency.sceneNumber=Number(state.ui.scene||1);row.frequency.scene={};row.frequency.eot={};row.turn={round:0,used:{standard:false,shift:false,swift:false},conversions:[]};row.moveState.rollout={active:false,hits:0,nextDb:3,lastDb:null,lastResult:null};}if(c.active)pokemonCombatLog(null,'Scene advanced',`Scene ${state.ui.scene} began; Scene frequencies and Rollout chains reset.`,'boundary');}
function pokemonCombatOnDayAdvance(){const c=state.ui?.combat;if(!c)return;for(const id of (c.participantIds||[])){const row=pokemonCombatParticipant(id);if(!row)continue;row.frequency.dayNumber=Number(state.ui.day||1);row.frequency.day={};row.frequency.sceneNumber=Number(state.ui.scene||1);row.frequency.scene={};row.frequency.eot={};row.turn={round:0,used:{standard:false,shift:false,swift:false},conversions:[]};row.moveState.rollout={active:false,hits:0,nextDb:3,lastDb:null,lastResult:null};}if(c.active)pokemonCombatLog(null,'Day advanced',`Day ${state.ui.day} began; Daily and Scene frequencies reset.`,'boundary');}
async function pokemonCombatStopCurledUp(id){const row=pokemonCombatParticipant(id);if(!row?.conditions?.curledUp)return;const spent=pokemonCombatSpendAction(id,'Swift Action');if(!spent.valid)return toast(spent.reason,'error');row.conditions.curledUp=false;pokemonCombatLog(id,'Curled Up ended',`${pokemon(id)?.name||id} stopped being Curled Up · ${spent.spent}.`,'condition');commit(`${pokemon(id)?.name||'Pokémon'} stopped being Curled Up.`);render();}
function pokemonCombatEndRollout(id,reason='No valid target'){const row=pokemonCombatParticipant(id);if(!row)return;row.moveState.rollout={active:false,hits:0,nextDb:3,lastDb:row.moveState.rollout?.lastDb??null,lastResult:'no-target'};pokemonCombatLog(id,'Rollout chain ended',`${reason}; Rollout returns to DB 3 on the next use.`,'move-state');commit('Rollout chain ended.');render();}
async function pokemonCombatDispatchMoveFormEvent(id,row){const p=pokemon(id),def=row?.definition||{};if(!p)return;const tags=moveKeywordEntries(def||row?.record||{}).map(entry=>entry.name);const moveClass=def.category||def.class||null;const damaging=['physical','special'].includes(String(moveClass||'').toLowerCase())||!!row?.resolvedDamage;await applyPokemonFormGameEventUi(id,{kind:'move-used',move:def.name||row?.record?.name||row?.record?.id||'',moveClass,damaging,raisesDefenseCombatStages:pokemonMoveRaisesDefenseCombatStages(def),tags},{silent:true,commitAfter:false});}
async function pokemonCombatUseNoRoll(id,index){const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,row=(data?.moves||[])[Number(index)],p=pokemon(id);if(!row||!p)return toast('Move reference data is unavailable.','error');const available=pokemonCombatMoveAvailability(id,row);if(!available.valid)return toast(available.reason,'error');const action=pokemonCombatSpendAction(id,available.action);if(!action.valid)return toast(action.reason,'error');const freq=pokemonCombatSpendFrequency(id,available.key,available.frequency);if(!freq.valid)return toast(freq.reason,'error');const name=row.definition?.name||row.record?.name||'Move',ledger=pokemonCombatParticipant(id);if(pokemonCombatSlug(name)==='defense-curl'){ledger.conditions.curledUp=true;pokemonCombatLog(id,'Defense Curl',`${p.name} became Curled Up · immune to Critical Hits · DR 10${pokemonCombatKnowsRollMove(data)?' · Rollout/Ice Ball prevent Slowed while Curled Up':' · Slowed'} · ${action.spent}.`,'condition');}else pokemonCombatLog(id,'Move used',`${p.name} used ${name} · ${action.spent}${available.frequency?` · ${available.frequency}`:''}.`,'move');await pokemonCombatDispatchMoveFormEvent(id,row);await commit(`${p.name} used ${name}.`);render();}
function pokemonCombatOpenMove(id,index){const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,row=(data?.moves||[])[Number(index)],p=pokemon(id);if(!row||!p)return toast('Move reference data is unavailable.','error');const available=pokemonCombatMoveAvailability(id,row);if(!available.valid)return toast(available.reason,'error');const def=row.definition||{},name=def.name||row.record?.name||'Move';if(pokemonCombatSlug(name)==='defense-curl'||(def.ac==null&&!row.resolvedDamage))return pokemonCombatUseNoRoll(id,index);const baseAc=def.ac==null?'None':String(row.effectiveAc??def.ac);const dynamic=pokemonCombatSlug(name)==='rollout';const rollState=pokemonCombatParticipant(id)?.moveState?.rollout||{nextDb:3};const db=dynamic?Number(rollState.nextDb||3):Number(row.resolvedDamage?.baseDamageBase??def.damageBase??0);modal(`<div class="flow-note"><strong>${esc(name)}</strong><small>${esc(available.frequency||'At-Will')} · ${esc(available.action)}${dynamic?` · current Rollout DB ${db}`:''}</small></div><div class="form-grid"><label>Target Evasion<input id="combat-target-evasion" type="number" value="0" step="1"></label><label>Target Defense / Sp. Def. <input id="combat-target-defense" type="number" min="0" placeholder="optional"></label><label>Critical threshold<input id="combat-crit-threshold" type="number" min="2" max="20" value="20"></label><label>Natural d20<input id="combat-natural-roll" type="number" min="1" max="20" placeholder="blank = roll in app"></label><label class="check-line"><input id="combat-target-crit-immune" type="checkbox"> Target is immune to Critical Hits</label></div><div class="flow-note"><small>Accuracy Check: base AC ${esc(baseAc)} + target Evasion. A blank d20 uses an actual randomized d20; entering a value supports physical dice while preserving the natural result for Critical Hit / Effect Range rules.</small></div><button class="btn btn-primary full" onclick="pokemonCombatResolveMove('${id}',${Number(index)})">Resolve ${esc(name)}</button>`,{title:`Combat · ${name}`,subtitle:'Resolve the attack before spending its action/frequency.'});}
async function pokemonCombatDamageChart(db,row){const existing=row?.resolvedDamage?.damageChart;if(existing&&Number(row?.resolvedDamage?.finalDamageBase)===Number(db))return existing;try{const response=await fetch(`/api/damage-base/${encodeURIComponent(db)}`,{cache:'no-store'});if(response.ok)return await response.json();}catch{}return null;}
async function pokemonCombatResolveMove(id,index){const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,row=(data?.moves||[])[Number(index)],p=pokemon(id);if(!row||!p)return toast('Move reference data is unavailable.','error');const available=pokemonCombatMoveAvailability(id,row);if(!available.valid)return toast(available.reason,'error');const def=row.definition||{},name=def.name||row.record?.name||'Move',slug=pokemonCombatSlug(name),ledger=pokemonCombatParticipant(id);const targetEvasion=Number(document.getElementById('combat-target-evasion')?.value||0),targetDefenseRaw=document.getElementById('combat-target-defense')?.value,targetDefense=targetDefenseRaw===''||targetDefenseRaw==null?null:Math.max(0,Number(targetDefenseRaw)||0),critThreshold=Math.max(2,Math.min(20,Number(document.getElementById('combat-crit-threshold')?.value||20))),manualRaw=document.getElementById('combat-natural-roll')?.value,manual=manualRaw===''||manualRaw==null?null:Number(manualRaw),critImmune=!!document.getElementById('combat-target-crit-immune')?.checked;if(manual!=null&&(!Number.isInteger(manual)||manual<1||manual>20))return toast('Natural d20 must be from 1 to 20.','error');const natural=manual??pokemonCombatRandomInt(20),knowsRoll=pokemonCombatKnowsRollMove(data),curl=pokemonCombatDefenseCurlModifier({curledUp:!!ledger.conditions.curledUp,moveName:name,knowsRollMove:knowsRoll}),accuracyModifier=Number(p.combatStages?.accuracy||0)+Number(curl.accuracyPenalty||0),baseAc=def.ac==null?null:Number(row.effectiveAc??def.ac),required=baseAc==null?null:baseAc+targetEvasion;let hit=baseAc==null?true:(natural===1?false:natural===20?true:natural+accuracyModifier>=required);const damaging=!!row.resolvedDamage||['physical','special'].includes(String(def.category||def.class||'').toLowerCase());const critical=!!(damaging&&hit&&!critImmune&&natural>=critThreshold);const action=pokemonCombatSpendAction(id,available.action);if(!action.valid)return toast(action.reason,'error');const freq=pokemonCombatSpendFrequency(id,available.key,available.frequency);if(!freq.valid)return toast(freq.reason,'error');let damage=null;if(hit&&damaging){const baseDb=slug==='rollout'?Number(ledger.moveState.rollout?.nextDb||3):Number(row.resolvedDamage?.baseDamageBase??def.damageBase??0),stab=Number(row.resolvedDamage?.stabDamageBaseBonus||0),finalDb=Math.max(1,Math.min(28,slug==='rollout'?baseDb+stab:Number(row.resolvedDamage?.finalDamageBase??baseDb+stab))),chart=await pokemonCombatDamageChart(finalDb,row),diceExpr=chart?.rolled_damage||chart?.rolledDamage||null,dice=diceExpr?pokemonCombatRollDiceExpression(diceExpr,critical?2:1):null,stat=Number(row.resolvedDamage?.primaryStat?.value||0),mixed=Number(row.resolvedDamage?.mixedPowerBonus||0),bonus=Number(curl.damageBonus||0);const total=dice?.valid?dice.total+stat+mixed+bonus:null;damage={baseDb,finalDb,diceExpr,dice,stat,mixed,bonus,total,afterDefense:total==null||targetDefense==null?null:Math.max(0,total-targetDefense)};}
  if(slug==='rollout'){const usedDb=Number(damage?.baseDb??ledger.moveState.rollout?.nextDb??3);ledger.moveState.rollout=pokemonCombatRolloutAfterResult(ledger.moveState.rollout,hit,usedDb);}const accuracyText=required==null?`natural d20 ${natural} (no AC)`:`natural d20 ${natural}${accuracyModifier?` ${accuracyModifier>0?'+':''}${accuracyModifier} = ${natural+accuracyModifier}`:''} vs ${required}`;let detail=`${p.name} used ${name} · ${accuracyText} · ${hit?(critical?'CRITICAL HIT':'HIT'):'MISS'} · ${action.spent}`;if(damage?.total!=null){detail+=` · DB ${damage.finalDb} · ${damage.diceExpr}${critical?' ×2 dice':''} [${damage.dice.rolls.join(', ')}] + Stat ${damage.stat}${damage.mixed?` + Mixed ${damage.mixed}`:''}${damage.bonus?` + Defense Curl ${damage.bonus}`:''} = ${damage.total}`;if(damage.afterDefense!=null)detail+=` · after Defense ${targetDefense}: ${damage.afterDefense}`;}if(slug==='rollout')detail+=hit?` · next Rollout DB ${ledger.moveState.rollout.nextDb}`:' · Rollout chain reset to DB 3';pokemonCombatLog(id,critical?'Critical Hit':hit?'Move hit':'Move missed',detail,'move');await pokemonCombatDispatchMoveFormEvent(id,row);closeModal();await commit(detail);render();toast(hit?(critical?'CRITICAL HIT!':'Hit confirmed.'):'The Move missed.',critical?'success':hit?'success':'error');}
function pokemonCombatMoveCard(id,row,index,data){const def=row.definition||{},name=def.name||row.record?.name||row.record?.id||'Move',available=pokemonCombatMoveAvailability(id,row),action=available.action||pokemonCombatActionCostForMove(def),frequency=def.frequency||row.record?.frequency||'At-Will',ledger=pokemonCombatParticipant(id),rollout=pokemonCombatSlug(name)==='rollout'?ledger?.moveState?.rollout:null,dynamicDb=rollout?Number(rollout.nextDb||3):null;return `<article class="known-move-card"><div class="row-between"><div><h3>${esc(name)}</h3><div class="row-gap">${def.type?typeBadge(String(def.type).toLowerCase()):''}${chip(esc(frequency),available.valid?'chip-green':'chip-red')}${chip(esc(action),'chip-blue')}</div></div><div class="move-metrics">${row.effectiveAc!=null?`<span><small>AC</small><b>${esc(row.effectiveAc)}</b></span>`:''}${row.resolvedDamage?.finalDamageBase!=null?`<span><small>DB</small><b>${dynamicDb??row.resolvedDamage.finalDamageBase}</b></span>`:''}</div></div>${rollout?.active?`<div class="flow-note"><strong>Rollout chain</strong><small>${rollout.hits} successful hit${rollout.hits===1?'':'s'} · next base DB ${rollout.nextDb}</small></div>`:''}<p>${esc(def.effect||'No resolved effect text available.')}</p>${available.valid?'':`<div class="builder-validation bad">${esc(available.reason||'Unavailable')}</div>`}<button class="btn ${available.valid?'btn-primary':'btn-disabled'} full" ${available.valid?'':'disabled'} onclick="pokemonCombatOpenMove('${id}',${index})">Use ${esc(name)}</button></article>`;}
function pokemonCombatActionStrip(id){const turn=pokemonCombatTurn(id),used=turn?.used||{};const status=(label,isUsed)=>chip(`${label} ${isUsed?'USED':'READY'}`,isUsed?'chip-gray':'chip-green');return `<div class="row-gap">${status('STANDARD',used.standard)}${status('SHIFT',used.shift)}${status('SWIFT',used.swift)}${chip('FREE ∞','chip-blue')}</div>${turn?.conversions?.length?`<small>Conversions: ${esc(turn.conversions.join(', '))}</small>`:''}`;}
function pokemonCombatConditionPanel(id,data){const row=pokemonCombatParticipant(id),rollout=row?.moveState?.rollout||{},knowsRoll=pokemonCombatKnowsRollMove(data),curl=pokemonCombatDefenseCurlModifier({curledUp:!!row?.conditions?.curledUp,moveName:'',knowsRollMove:knowsRoll});const parts=[];if(row?.conditions?.curledUp)parts.push(`<div class="flow-note"><strong>Curled Up</strong><small>Critical immunity · DR 10${curl.slowed?' · Slowed':' · Rollout/Ice Ball known: not Slowed'} · Rollout/Ice Ball gain +10 Damage and ignore the Curled Up Accuracy penalty.</small><button class="btn btn-ghost btn-small" onclick="pokemonCombatStopCurledUp('${id}')">Stop Curled Up · Swift Action</button></div>`);if(rollout.active)parts.push(`<div class="flow-note"><strong>Rollout locked</strong><small>${rollout.hits} consecutive hit${rollout.hits===1?'':'s'} · next base DB ${rollout.nextDb}. Other Moves are disabled until Rollout misses or no target can be hit.</small><button class="btn btn-ghost btn-small" onclick="pokemonCombatEndRollout('${id}')">No valid target · end chain</button></div>`);return parts.join('')||'<p class="muted">No tracked combat condition or chained Move state.</p>';}
function pokemonCombatScreen(){const c=ensurePokemonCombatUi(),rosters=(state.rosters||[]).filter(r=>r.active!==false),selectedRoster=rosters.find(r=>r.id===c.rosterId)||rosters[0]||null;if(selectedRoster&&c.rosterId!==selectedRoster.id)c.rosterId=selectedRoster.id;const candidates=selectedRoster?rosterMembers(selectedRoster.id).filter(p=>!p.storage):[];const activeId=c.activePokemonId&&c.participantIds.includes(c.activePokemonId)?c.activePokemonId:c.participantIds[0]||null,active=activeId?pokemon(activeId):null;if(activeId&&c.activePokemonId!==activeId)c.activePokemonId=activeId;const rosterPicker=`<div class="form-grid"><label>Roster<select onchange="pokemonCombatSelectRoster(this.value)">${rosters.map(r=>`<option value="${esc(r.id)}" ${r.id===c.rosterId?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label><label>Pokémon<select id="combat-add-pokemon"><option value="">Choose a Pokémon…</option>${candidates.filter(p=>!c.participantIds.includes(p.id)).map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.species)} · Lv. ${p.level}</option>`).join('')}</select></label></div><button class="btn btn-primary" onclick="pokemonCombatAdd(document.getElementById('combat-add-pokemon').value)">＋ Put Pokémon in Combat</button>`;const participantBar=c.participantIds.length?`<div class="row-gap">${c.participantIds.map(id=>{const p=pokemon(id);return p?`<button class="btn ${id===activeId?'btn-gold':'btn-ghost'} btn-small" onclick="pokemonCombatActivate('${id}')">${esc(p.name)} · ${p.hp}/${p.maxHp}</button>`:''}).join('')}</div>`:'<p class="muted">No Pokémon in this combat session yet.</p>';let body=`${section('COMBAT ROSTER',`${rosterPicker}${participantBar}`)}`;if(active){const ref=pokemonCombatReferenceState.pokemonId===active.id?pokemonCombatReferenceState:null;if(!ref?.data&&!ref?.loading)setTimeout(()=>loadPokemonCombatReferenceData(active.id),0);const data=ref?.data;const temp=tempHpValue(active),formIndicator=data?pokemonFormCombatIndicator(active,data):'';const header=`<div class="creature-header">${pokemonPortraitTag(active)}<div><p class="eyebrow">ACTIVE COMBATANT</p><h1>${esc(active.name)}</h1><p>${esc(active.species)} · Lv. ${active.level}</p></div><div class="creature-vitals"><strong>HP ${active.hp}/${active.maxHp}${temp?` +${temp} TEMP`:''}</strong>${progress(active.hp,active.maxHp,hpTone(active))}</div></div>`;body+=section('ACTIVE COMBATANT',`${header}${formIndicator}<div class="battle-controls"><div class="hp-actions"><button onclick="changeHp('${active.id}',-5)">−5 HP</button><button onclick="changeHp('${active.id}',-1)">−1 HP</button><button onclick="changeHp('${active.id}',1)">+1 HP</button><button onclick="changeHp('${active.id}',5)">+5 HP</button></div></div>${pokemonCombatActionStrip(active.id)}<div class="row-gap"><button class="btn btn-primary" onclick="pokemonCombatBeginTurn('${active.id}')">Begin / Focus Turn</button><button class="btn btn-danger btn-small" onclick="pokemonCombatRemove('${active.id}')">Remove from Combat</button></div>`);body+=section('TRACKED COMBAT STATE',data?pokemonCombatConditionPanel(active.id,data):ref?.error?`<div class="builder-validation bad">${esc(ref.error)}</div>`:'<p class="muted">Loading PTU combat data…</p>');body+=section('AVAILABLE MOVES',data?`<div class="known-move-grid">${(data.moves||[]).map((row,index)=>pokemonCombatMoveCard(active.id,row,index,data)).join('')||'<p class="muted">No Moves recorded.</p>'}</div>`:'<p class="muted">Move definitions are loading from the active Ruleset.</p>');}
  const recent=(c.log||[]).slice().reverse().slice(0,20);body+=section('COMBAT LOG',recent.length?`<div class="timeline">${recent.map(entry=>`<div><b>R${entry.round}</b><strong>${esc(entry.title)}</strong><span>${esc(entry.detail)}</span></div>`).join('')}</div>`:'<p class="muted">Accuracy rolls, hit/miss/critical results, chained Move state and combat boundaries will appear here.</p>');const controls=`<div class="row-gap"><button class="btn btn-ghost" onclick="nextRound()">Next Round</button><button class="btn btn-ghost" onclick="endScene()">End Scene</button><button class="btn btn-ghost" onclick="newDay()">New Day</button>${c.active?`<button class="btn btn-danger" onclick="pokemonCombatEndSession()">End Combat</button>`:''}</div>`;return `<div class="page">${heading('COMBAT','Combat Session Ledger',`Round ${state.ui.round} · Scene ${state.ui.scene} · Day ${state.ui.day}. Shared Pokémon action/frequency ledger with real attack rolls.`,controls)}${body}</div>`;}
'''

NAV_OLD = """const nav=[\n ['dashboard','⌂','Home'],['trainer','🪪','Trainer'],['rosters','◉','Rosters'],['creature','🐾','Creatures'],\n ['storage','▣','Storage'],['inventory','🎒','Items'],['shop','🛒','Shop'],['library','📚','Pokédex & Rules'],['npcs','📓','NPCs'],['levelup','✦','Level Up'],['editor','✎','Editors']\n];"""
NAV_NEW = """const nav=[\n ['dashboard','⌂','Home'],['trainer','🪪','Trainer'],['rosters','◉','Rosters'],['combat','⚔','Combat'],['creature','🐾','Creatures'],\n ['storage','▣','Storage'],['inventory','🎒','Items'],['shop','🛒','Shop'],['library','📚','Pokédex & Rules'],['npcs','📓','NPCs'],['levelup','✦','Level Up'],['editor','✎','Editors']\n];"""
ROUTE_OLD = "function route(screen){ if(screen==='pokemonbuilder'){ beginPokemonBuilder(); return; } if(screen==='levelup'){ beginTrainerProgression(); return; } state.ui.screen=screen; persist(); render(); if(screen==='creature') setTimeout(()=>loadCreatureReferenceData(true),0); if(screen==='trainer') setTimeout(()=>loadTrainerReferenceData(true),0); if(screen==='shop'&&['Weapon Store','Gear Store'].includes(state.shop?.preset))setTimeout(()=>loadItemCatalog().then(render),0); }"
ROUTE_NEW = "function route(screen){ if(screen==='pokemonbuilder'){ beginPokemonBuilder(); return; } if(screen==='levelup'){ beginTrainerProgression(); return; } state.ui.screen=screen; persist(); render(); if(screen==='creature') setTimeout(()=>loadCreatureReferenceData(true),0); if(screen==='combat'&&ensurePokemonCombatUi().activePokemonId) setTimeout(()=>loadPokemonCombatReferenceData(ensurePokemonCombatUi().activePokemonId,true),0); if(screen==='trainer') setTimeout(()=>loadTrainerReferenceData(true),0); if(screen==='shop'&&['Weapon Store','Gear Store'].includes(state.shop?.preset))setTimeout(()=>loadItemCatalog().then(render),0); }"
RENDER_OLD = "const screens={dashboard,trainer:trainerScreen,rosters:rostersScreen,creature:creatureScreen,pokemonbuilder:pokemonBuilderScreen,pokemonprogress:pokemonProgressionScreen,pokemontraining:pokemonTrainingScreen,pokemonrestat:pokemonRestatScreen,storage:storageScreen,inventory:inventoryScreen,shop:shopScreen,library:libraryScreen,npcs:npcsScreen,levelup:levelupScreen,editor:editorScreen};"
RENDER_NEW = "const screens={dashboard,trainer:trainerScreen,rosters:rostersScreen,combat:pokemonCombatScreen,creature:creatureScreen,pokemonbuilder:pokemonBuilderScreen,pokemonprogress:pokemonProgressionScreen,pokemontraining:pokemonTrainingScreen,pokemonrestat:pokemonRestatScreen,storage:storageScreen,inventory:inventoryScreen,shop:shopScreen,library:libraryScreen,npcs:npcsScreen,levelup:levelupScreen,editor:editorScreen};"
MIGRATE_OLD = "  data.ui.inCombat=!!data.ui.inCombat;\n  data.ui.toast = null;"
MIGRATE_NEW = "  data.ui.inCombat=!!data.ui.inCombat;\n  data.ui.combat=normalizePokemonCombatUiState(data.ui.combat);\n  data.ui.toast = null;"
ROUND_OLD = "function nextRound(){ state.ui.round+=1; commit(`Round ${state.ui.round}`); }"
ROUND_NEW = "function nextRound(){ state.ui.round+=1; pokemonCombatOnRoundAdvance(); commit(`Round ${state.ui.round}`); }"
SCENE_OLD = "async function endScene(){ state.ui.scene+=1; state.ui.round=1; for(const p of state.pokemon){Object.keys(p.combatStages).forEach(k=>p.combatStages[k]=0);if(p?.details?.speciesDefinitionId)await applyPokemonFormGameEventUi(p.id,{kind:'scene-end'},{silent:true,commitAfter:false});} commit(`Scene ${state.ui.scene}. Combat stages reset; Form scene-end hooks applied.`); }"
SCENE_NEW = "async function endScene(){ state.ui.scene+=1; state.ui.round=1; for(const p of state.pokemon){Object.keys(p.combatStages).forEach(k=>p.combatStages[k]=0);if(p?.details?.speciesDefinitionId)await applyPokemonFormGameEventUi(p.id,{kind:'scene-end'},{silent:true,commitAfter:false});} pokemonCombatOnSceneAdvance(); commit(`Scene ${state.ui.scene}. Combat stages reset; Form scene-end hooks applied.`); }"
DAY_OLD = "function newDay(){ state.ui.day+=1; state.ui.scene=1; state.ui.round=1; commit(`Day ${state.ui.day}`); }"
DAY_NEW = "function newDay(){ state.ui.day+=1; state.ui.scene=1; state.ui.round=1; pokemonCombatOnDayAdvance(); commit(`Day ${state.ui.day}`); }"

REPO_OLD = """    semanticState.ui = {\n      round: semanticState.ui?.round ?? 1,\n      scene: semanticState.ui?.scene ?? 1,\n      day: semanticState.ui?.day ?? 1,\n      gmOverride: !!semanticState.ui?.gmOverride\n    };"""
REPO_NEW = """    semanticState.ui = {\n      round: semanticState.ui?.round ?? 1,\n      scene: semanticState.ui?.scene ?? 1,\n      day: semanticState.ui?.day ?? 1,\n      gmOverride: !!semanticState.ui?.gmOverride,\n      inCombat: !!semanticState.ui?.inCombat,\n      combat: semanticState.ui?.combat ?? null\n    };"""

LEDGER_DOC = {
    'schema_version': 1,
    'name': 'PTU Pokémon Combat Session Ledger',
    'storage': 'state.ui.combat',
    'platforms': ['windows', 'android'],
    'menu': 'Combat',
    'shared_resources': {
        'turn_actions': ['Standard Action', 'Shift Action', 'Swift Action', 'Free Action', 'Full Action'],
        'frequencies': ['At-Will', 'EOT', 'Scene', 'Scene xN', 'Daily', 'Daily xN'],
        'future': ['source-keyed Abilities', 'Form lifecycle spending', 'Extended Action progress'],
    },
    'combat_state': ['live Pokémon HP/THP', 'Form state through existing lifecycle engine', 'Combat Stages', 'Curled Up', 'Rollout chain'],
    'roll_resolution': {
        'accuracy_die': '1d20 actual random or manually entered natural d20',
        'automatic_hit_miss': True,
        'automatic_critical_default': 'natural 20, editable threshold for known modifiers',
        'target_inputs': ['Evasion', 'Defense or Special Defense', 'critical immunity'],
        'damage': 'actual Damage Base dice; critical repeats Damage Dice only; Stat and flat bonuses are added once',
    },
    'first_complex_interaction': {
        'moves': ['Defense Curl', 'Rollout'],
        'defense_curl': 'Curled Up; Critical immunity; DR 10; -4 Accuracy and Slowed except Rollout/Ice Ball exception; Rollout/Ice Ball +10 damage while Curled Up.',
        'rollout': 'DB 3; +4 DB after each successful use to max DB 15; continues on later turns until miss or no target.',
    },
    'persistence': {
        'local_and_export': True,
        'sqlite_ui_state': True,
        'revision_hash_includes_combat': True,
    },
    'source_policy': 'Only source-explicit PTU mechanics are automated. Unknown frequency/action semantics remain informational rather than guessed.',
}


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'Anchor drifted: {label}')
    return text.replace(old, new, 1)


def patch_client(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    original = text
    if 'function pokemonCombatDefaultUi' not in text:
        anchor = 'function creatureScreen(){'
        if anchor not in text:
            raise SystemExit(f'Creature screen anchor drifted: {path}')
        text = text.replace(anchor, HELPER + '\n' + anchor, 1)
    text = replace_once(text, NAV_OLD, NAV_NEW, f'Combat nav in {path}')
    text = replace_once(text, ROUTE_OLD, ROUTE_NEW, f'Combat route in {path}')
    text = replace_once(text, RENDER_OLD, RENDER_NEW, f'Combat screen renderer in {path}')
    text = replace_once(text, MIGRATE_OLD, MIGRATE_NEW, f'Combat migration in {path}')
    text = replace_once(text, ROUND_OLD, ROUND_NEW, f'Round boundary in {path}')
    text = replace_once(text, SCENE_OLD, SCENE_NEW, f'Scene boundary in {path}')
    text = replace_once(text, DAY_OLD, DAY_NEW, f'Day boundary in {path}')
    if text != original:
        path.write_text(text, encoding='utf-8')
        return True
    return False


def patch_repository() -> bool:
    text = REPOSITORY.read_text(encoding='utf-8')
    original = text
    text = replace_once(text, REPO_OLD, REPO_NEW, 'semantic combat revision state')
    if text != original:
        REPOSITORY.write_text(text, encoding='utf-8')
        return True
    return False


def write_docs() -> None:
    DOC_JSON.parent.mkdir(parents=True, exist_ok=True)
    DOC_JSON.write_text(json.dumps(LEDGER_DOC, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    lines = [
        '# PTU Pokémon Combat Session Ledger', '',
        'Shared combat-state foundation for Windows and Android. This replaces a Form-only resource approximation with one ledger intended to be shared by ordinary Moves, Abilities and Form lifecycle rules.', '',
        '## Menu and session model', '',
        '- New navigation menu: **Combat**.',
        '- A Trainer selects a Roster, places one or more carried Pokémon into the combat session, and chooses the active combatant.',
        '- HP/THP remain the Pokémon sheet values; the Combat menu does not create parallel HP.',
        '- Session state is stored under `state.ui.combat`, persisted by browser/Tauri save/export/import and SQLite `ui_state.data_json`.',
        '- SQLite revision hashing now treats combat state as semantic campaign state while still ignoring pure screen navigation.', '',
        '## Turn ledger', '',
        '- Each participant tracks Standard, Shift and Swift Action expenditure for the current round.',
        '- Free Actions remain unlimited in the ledger.',
        '- Full Actions consume both Standard and Shift Actions.',
        '- When the normal Swift or Shift Action is already spent, the ledger may consume the still-unused Standard Action as the PTU conversion allowed by the Core.',
        '- The ledger is per Pokémon and round; it is not Trainer AP.', '',
        '## Frequency ledger', '',
        '- `At-Will`: unrestricted.',
        '- `EOT`: blocked on the immediately following turn after use.',
        '- `Scene` / `Scene xN`: source-keyed counts reset at Scene change.',
        '- `Daily` / `Daily xN`: source-keyed counts reset at Day change.',
        '- Unknown frequency text remains informational instead of being guessed.', '',
        '## Attack roll resolver', '',
        '- Uses an actual randomized natural d20 by default.',
        '- A player may enter the natural d20 from a physical die instead.',
        '- Target Evasion is added to the Move AC.',
        '- Natural 1 always misses and natural 20 always hits.',
        '- Critical Hit uses the natural d20, not the modified total; default threshold is 20 and the resolver lets the user enter an already-known modified threshold.',
        '- Target critical immunity can be declared explicitly.',
        '- Damaging Moves roll the actual Damage Base dice from the active Ruleset. On a Critical Hit the Damage Dice are rolled a second time, while the attacking Stat and other flat bonuses are not duplicated.',
        '- Optional target Defense/Sp. Defense produces post-defense damage; otherwise the result remains pre-defense.', '',
        '## First complex Move interaction: Defense Curl + Rollout', '',
        '- Defense Curl sets the combat condition `Curled Up`.',
        '- Curled Up displays Critical Hit immunity and DR 10.',
        '- Curled Up normally applies -4 Accuracy and Slowed. If Rollout or Ice Ball is known, the Slowed part is suppressed; those Moves also ignore the Curled Up Accuracy penalty and gain +10 to their Damage Roll.',
        '- The user may stop being Curled Up by spending a Swift Action.',
        '- Rollout starts at DB 3. Each successful use raises the next Rollout base DB by +4 to a maximum of DB 15.',
        '- A successful Rollout locks the Pokémon to Rollout on later turns. Missing resets the chain; the UI also exposes **No valid target · end chain** for the source-defined no-target exit.', '',
        '## Form integration', '',
        '- Entering/leaving the Combat session dispatches the existing Form `battle-start` / `battle-end` events.',
        '- Resolved Move use dispatches the existing `move-used` Form event.',
        '- HP controls continue to use the existing HP/Form lifecycle path.',
        '- This pass does not yet auto-spend Form lifecycle `actionCost` / `frequency`; the new shared ledger is now the correct target for that next integration.', '',
        '## PTU source anchors', '',
        '- Core p.227: one Standard, one Shift and one Swift Action per participant per round; any number of Free Actions; Standard may be given up for another Swift or Shift under the stated restrictions.',
        '- Core p.227–228: Full Action consumes Standard + Shift.',
        '- Core p.236: Accuracy is 1d20 against AC + Evasion; natural 1 always misses, natural 20 always hits; natural roll drives Critical/Effect ranges.',
        '- Core p.236: damaging Critical Hits add the Damage Dice Roll a second time, not the attacking Stat.',
        '- Core p.394: Defense Curl / Curled Up interactions and Rollout/Ice Ball exception.',
        '- Core p.427: Rollout starts DB 3, increases +4 DB per successive use to DB 15, and continues until miss/no valid target.', '',
        '## Conservative boundaries', '',
        '- No enemy/NPC automation is invented; external target Evasion/Defense may be entered by the user.',
        '- Type effectiveness and arbitrary textual Move effects are not guessed by this first pass.',
        '- Extended Action progress is reserved for a later shared-ledger layer.',
        '- Deferred/source-insufficient Pokémon Form families remain unchanged.',
        '- No bundled/default `.ptucp` is modified.', ''
    ]
    DOC_MD.write_text('\n'.join(lines), encoding='utf-8')

    # Keep the former audit as an explicit historical pre-ledger checkpoint instead of a stale claim about current state.
    if OLD_AUDIT_JSON.exists():
        old = json.loads(OLD_AUDIT_JSON.read_text(encoding='utf-8'))
        old['status'] = 'historical_pre_ledger_snapshot'
        old['superseded_by'] = 'docs/PTU_COMBAT_SESSION_LEDGER.md'
        OLD_AUDIT_JSON.write_text(json.dumps(old, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    if OLD_AUDIT_MD.exists():
        md = OLD_AUDIT_MD.read_text(encoding='utf-8')
        note = '> Historical checkpoint: this audit describes the application **before** the shared Combat Session Ledger was introduced. Current behavior is documented in `PTU_COMBAT_SESSION_LEDGER.md`.\n\n'
        if 'Historical checkpoint:' not in md:
            md = md.replace('# PTU Forms — Combat Resource Audit\n\n', '# PTU Forms — Combat Resource Audit\n\n' + note, 1)
        OLD_AUDIT_MD.write_text(md, encoding='utf-8')


def main() -> None:
    changed = [str(path.relative_to(REPO)) for path in CLIENTS if patch_client(path)]
    if patch_repository():
        changed.append(str(REPOSITORY.relative_to(REPO)))
    write_docs()
    print(json.dumps({
        'changed': changed,
        'platforms': 2,
        'combat_ledger_schema': 1,
        'menu': 'Combat',
        'real_dice': True,
        'rollout_defense_curl': True,
        'form_spending_wired': False,
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
