#!/usr/bin/env python3
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
TARGETS = [ROOT / 'static-preview' / 'app.js', REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'app.js']

HELPERS = r'''const PTU_COMBAT_SOURCE_PRECEDENCE=[
  {id:'ptu-core-1.05',rank:100,label:'PTU 1.05 Core'},
  {id:'ptu-1.05-editation',rank:110,label:'PTU 1.05 Editation'},
  {id:'ptu-may-2015-playtest',rank:120,label:'PTU May 2015 Playtest Packet'},
  {id:'ptu-september-2015-playtest',rank:130,label:'PTU September 2015 Playtest Packet'},
  {id:'ptu-february-2016-playtest',rank:140,label:'February 2016 Playtest Packet'}
];
function pokemonCombatSourceKey(row){const d=row?.definition||row?.record||row||{};return String(row?.sourceId||row?.source_id||d.sourceId||d.source_id||row?.source||d.source||d.sourceTitle||d.source_title||'').toLowerCase();}
function pokemonCombatSourceRank(row){const key=pokemonCombatSourceKey(row);const found=PTU_COMBAT_SOURCE_PRECEDENCE.find(s=>key.includes(s.id)||key.includes(s.label.toLowerCase()));return found?.rank||100;}
function pokemonCombatFebruary2016Override(row){const name=pokemonCombatSlug(row?.name||row?.definition?.name||row?.record?.name),d=row?.definition||row?.record||{};if(name==='quick-curl')return {...row,definition:{...d,sourceId:'ptu-february-2016-playtest',frequency:'Scene – Free Action',effect:'Connection – Defense Curl. The user may activate this Ability to use Defense Curl as a Standard Action Interrupt and gain +10 Damage Reduction for 1 full round.'}};if(name==='electrodash')return {...row,definition:{...d,sourceId:'ptu-february-2016-playtest',frequency:'Scene x2 – Swift Action',effect:'The user may make a Sprint Action as a Free Action.',bonus:'The user may free itself from the Stuck condition as a Shift Action. The user does not provoke Attacks of Opportunity when Sprinting.'}};return row;}
function pokemonCombatResolveDefinition(rows,name){const wanted=pokemonCombatSlug(name);const candidates=(rows||[]).filter(row=>pokemonCombatSlug(row?.name||row?.definition?.name||row?.record?.name)===wanted);const winner=candidates.map((row,index)=>({row,rank:pokemonCombatSourceRank(row),index})).sort((a,b)=>b.rank-a.rank||b.index-a.index)[0]?.row||null;return winner&&['quick-curl','electrodash'].includes(wanted)?pokemonCombatFebruary2016Override(winner):winner;}
function pokemonCombatResolvedSource(row){const rank=pokemonCombatSourceRank(row);return PTU_COMBAT_SOURCE_PRECEDENCE.find(s=>s.rank===rank)||PTU_COMBAT_SOURCE_PRECEDENCE[0];}
function pokemonCombatElectrodashDefinition(rows){return pokemonCombatResolveDefinition(rows,'Electrodash');}
'''

QUICK_CURL = r'''function pokemonCombatQuickCurlAbilityResourceSpec(){return pokemonCombatNonMoveSpec('ability','combat-quick-curl','Quick Curl','Free Action','Scene');}
function pokemonCombatQuickCurlDefenseResourceSpec(variant='core'){return pokemonCombatNonMoveSpec('move','defense-curl-quick-curl','Defense Curl via Quick Curl',variant==='february-2016'?'Standard Action':'Swift Action','At-Will');}
function pokemonCombatQuickCurlAbilityRow(data){return pokemonCombatResolveDefinition(data?.abilities,'Quick Curl');}
function pokemonCombatQuickCurlDefenseMoveRow(data){return pokemonCombatResolveDefinition(data?.moves,'Defense Curl');}
function pokemonCombatQuickCurlVariant(row){const effect=String(row?.definition?.effect||'').toLowerCase().replace(/[^a-z0-9+]+/g,' ');if(effect.includes('standard action interrupt')&&effect.includes('10 damage reduction'))return 'february-2016';if(effect.includes('use defense curl as a swift action'))return 'core';return null;}
function pokemonCombatQuickCurlAbilitySourceMatches(row){return pokemonCombatQuickCurlVariant(row)!==null;}
function pokemonCombatQuickCurlDefenseSourceMatches(row){if(!row||pokemonCombatSlug(row?.definition?.name||row?.record?.name)!=='defense-curl')return false;const frequency=String(row.definition?.frequency||row.record?.frequency||'At-Will');return !frequency||/^at-will$/i.test(frequency.trim());}
function pokemonCombatQuickCurlAvailability(id,data){const abilityRow=pokemonCombatQuickCurlAbilityRow(data),moveRow=pokemonCombatQuickCurlDefenseMoveRow(data),variant=pokemonCombatQuickCurlVariant(abilityRow);if(!abilityRow||!variant)return {valid:false,reason:'The resolved Quick Curl definition is not an audited supplied-source variant.'};if(!moveRow||!pokemonCombatQuickCurlDefenseSourceMatches(moveRow))return {valid:false,abilityRow,reason:'Defense Curl is not available from the active Ruleset.'};const ledger=pokemonCombatParticipant(id,{create:false});if(!ledger)return {valid:false,reason:'Put this Pokémon in Combat first.'};if(ledger.moveState?.rollout?.active)return {valid:false,reason:'Rollout is active; the user must continue Rollout.'};const ability=pokemonCombatQuickCurlAbilityResourceSpec(),abilityCheck=pokemonCombatNonMoveAvailability(id,ability),defense=pokemonCombatQuickCurlDefenseResourceSpec(variant),defenseCheck=pokemonCombatNonMoveAvailability(id,defense);return abilityCheck.valid&&defenseCheck.valid?{valid:true,abilityRow,moveRow,variant,ability,defense}:{valid:false,abilityRow,moveRow,variant,ability,defense,reason:abilityCheck.reason||defenseCheck.reason};}
function pokemonCombatQuickCurlSpendResources(id,data,{log=true}={}){const check=pokemonCombatQuickCurlAvailability(id,data);if(!check.valid)return check;const abilitySpend=pokemonCombatSpendNonMoveResource(id,check.ability,{log:false});if(!abilitySpend.valid)return abilitySpend;const defenseSpend=pokemonCombatSpendNonMoveResource(id,check.defense,{log:false});if(!defenseSpend.valid){pokemonCombatRefundNonMoveResourceCore(id,abilitySpend.transaction?.id,{log:false});return defenseSpend;}if(log)pokemonCombatLog(id,'Resources spent',`Quick Curl · Scene Free · Defense Curl · ${defenseSpend.action?.spent||check.defense.actionCost}.`,'resource');return {...check,abilitySpend,defenseSpend};}
async function pokemonCombatUseQuickCurlDefenseCurl(id){const p=pokemon(id),data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,spent=pokemonCombatQuickCurlSpendResources(id,data,{log:true});if(!spent.valid)return toast(spent.reason||'Quick Curl is unavailable.','error');const ledger=pokemonCombatParticipant(id),action=spent.defenseSpend.action?.spent||spent.defense.actionCost;ledger.conditions.curledUp=true;if(spent.variant==='february-2016')ledger.conditions.quickCurlDrRound=Number(state.ui.round||1);pokemonCombatLog(id,'Quick Curl',`${p.name} used resolved ${spent.variant==='february-2016'?'February 2016':'Core'} Quick Curl · ${action}.`,'ability');await pokemonCombatDispatchMoveFormEvent(id,spent.moveRow);await commit(`${p.name} used Quick Curl + Defense Curl.`);render();return {valid:true,spent};}
function pokemonCombatQuickCurlPanel(id,data){const available=pokemonCombatQuickCurlAvailability(id,data);if(!available.abilityRow)return '';const feb=available.variant==='february-2016',label=feb?'Defense Curl · Standard Interrupt + DR 10':'Defense Curl · Swift Action';return `<article class="ability-card"><h3>Quick Curl + Defense Curl</h3><p>${feb?'February 2016 override: use Defense Curl as a Standard Action Interrupt; +10 DR is tracked for this round.':'Core: use Defense Curl as a Swift Action.'}</p><button class="btn ${available.valid?'btn-gold':'btn-disabled'} full" ${available.valid?'':'disabled'} onclick="pokemonCombatUseQuickCurlDefenseCurl('${id}')">${label}</button></article>`;}'''

ELECTRODASH = r'''function pokemonCombatElectrodashResourceSpec(){return pokemonCombatNonMoveSpec('ability','combat-electrodash','Electrodash','Swift Action','Scene x2');}
function pokemonCombatElectrodashAvailability(id,data){const row=pokemonCombatElectrodashDefinition(data?.abilities);if(!row)return {valid:false,reason:'This Pokémon does not have Electrodash.'};const effect=String(row.definition?.effect||'').toLowerCase();if(!effect.includes('sprint action as a free action'))return {valid:false,row,reason:'The resolved Electrodash definition is not the audited February 2016 version.'};const resource=pokemonCombatElectrodashResourceSpec(),check=pokemonCombatNonMoveAvailability(id,resource);return check.valid?{valid:true,row,resource}:{...check,row,resource};}
async function pokemonCombatUseElectrodashSprint(id){const p=pokemon(id),data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,check=pokemonCombatElectrodashAvailability(id,data);if(!check.valid)return toast(check.reason||'Electrodash is unavailable.','error');const spent=pokemonCombatSpendNonMoveResource(id,check.resource,{log:false});if(!spent.valid)return toast(spent.reason,'error');const ledger=pokemonCombatParticipant(id);ledger.conditions.electrodashSprintRound=Number(state.ui.round||1);pokemonCombatLog(id,'Electrodash',`${p.name} used Sprint as a Free Action · February 2016 Electrodash · ${spent.action?.spent||'Swift Action'} · Scene x2.`,'ability');await commit(`${p.name} used Electrodash + Sprint.`);render();return {valid:true,spent};}
function pokemonCombatElectrodashClearStuckAvailability(id,data){const row=pokemonCombatElectrodashDefinition(data?.abilities),ledger=pokemonCombatParticipant(id,{create:false});if(!row||!ledger?.conditions?.stuck)return {valid:false,row,reason:'This Pokémon is not Stuck.'};const bonus=String(row.definition?.bonus||'').toLowerCase();if(!bonus.includes('free itself from the stuck condition'))return {valid:false,row,reason:'The resolved Electrodash definition does not grant Stuck removal.'};return pokemonCombatCanSpendAction(id,'Shift Action');}
async function pokemonCombatUseElectrodashClearStuck(id){const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,check=pokemonCombatElectrodashClearStuckAvailability(id,data);if(!check.valid)return toast(check.reason||'Stuck removal is unavailable.','error');const spent=pokemonCombatSpendAction(id,'Shift Action'),ledger=pokemonCombatParticipant(id);ledger.conditions.stuck=false;pokemonCombatLog(id,'Electrodash',`${pokemon(id)?.name||id} cleared Stuck · ${spent.spent}.`,'ability');await commit(`${pokemon(id)?.name||'Pokémon'} cleared Stuck with Electrodash.`);render();return {valid:true,spent};}
function pokemonCombatSetStuck(id,stuck){const ledger=pokemonCombatParticipant(id);ledger.conditions.stuck=!!stuck;pokemonCombatLog(id,stuck?'Stuck':'Stuck cleared',`${pokemon(id)?.name||id} was marked ${stuck?'Stuck':'not Stuck'} manually.`,'condition');commit(`${pokemon(id)?.name||'Pokémon'} Stuck state updated.`);render();}
function pokemonCombatElectrodashPanel(id,data){const available=pokemonCombatElectrodashAvailability(id,data),clear=pokemonCombatElectrodashClearStuckAvailability(id,data);if(!available.row)return '';const button=(label,check,fn)=>`<button class="btn ${check.valid?'btn-gold':'btn-disabled'} full" ${check.valid?'':'disabled'} onclick="${fn}">${label}</button>`;return `<article class="ability-card"><h3>Electrodash + Sprint</h3><p>February 2016: Sprint is a Free Action; no Attacks of Opportunity while Sprinting.</p>${button('Use Electrodash + Sprint · Free + Swift · Scene x2',available,`pokemonCombatUseElectrodashSprint('${id}')`)}${button('Electrodash · clear Stuck · Shift Action',clear,`pokemonCombatUseElectrodashClearStuck('${id}')`)}</article>`;}'''

PANEL = r'''function pokemonCombatSourcePrecedencePanel(data){const rows=[['Quick Curl',pokemonCombatQuickCurlAbilityRow(data)],['Electrodash',pokemonCombatElectrodashDefinition(data?.abilities)],['Vicious',pokemonCombatViciousAbilityRow(data)],['Hone Claws',pokemonCombatViciousHoneClawsRow(data)]].filter(([,row])=>row);if(!rows.length)return '';return `<details class="flow-note"><summary><strong>Resolved PTU sources</strong></summary><small>Core → 1.05 Editation → May 2015 → September 2015 → February 2016. Guards inspect the resolved winner.</small><div class="detail-dl">${rows.map(([name,row])=>{const source=pokemonCombatResolvedSource(row);return `<div><dt>${esc(name)}</dt><dd>${esc(source.label)}</dd></div>`;}).join('')}</div></details>`;}'''

def patch(path):
    text=path.read_text(encoding='utf-8')
    if 'function pokemonCombatFebruary2016Override(' not in text and 'const PTU_COMBAT_SOURCE_PRECEDENCE=' in text:
        text=re.sub(r"const PTU_COMBAT_SOURCE_PRECEDENCE=\[[\s\S]*?(?=function pokemonCombatQuickCurlAbilityResourceSpec)",HELPERS+'\n',text,count=1)
    elif 'const PTU_COMBAT_SOURCE_PRECEDENCE=' not in text:
        anchor='function pokemonCombatQuickCurlAbilityResourceSpec()'
        if anchor not in text: raise SystemExit(f'precedence anchor missing: {path}')
        text=text.replace(anchor,HELPERS+'\n'+anchor,1)
    text=re.sub(r"function pokemonCombatQuickCurlAbilityResourceSpec\([\s\S]*?(?=function pokemonCombatRolloutAfterResult)",QUICK_CURL+'\n',text,count=1)
    if 'function pokemonCombatElectrodashClearStuckAvailability(' not in text and 'function pokemonCombatElectrodashResourceSpec(' in text:
        text=re.sub(r"function pokemonCombatElectrodashResourceSpec\([\s\S]*?(?=function pokemonCombatQuickCurlAbilityResourceSpec)",ELECTRODASH+'\n',text,count=1)
    elif 'function pokemonCombatElectrodashResourceSpec(' not in text:
        text=text.replace('function pokemonCombatQuickCurlAbilityResourceSpec()',ELECTRODASH+'\nfunction pokemonCombatQuickCurlAbilityResourceSpec()',1)
    if 'function pokemonCombatSourcePrecedencePanel(' not in text:
        text=text.replace('function pokemonCombatElectrodashResourceSpec()',PANEL+'\nfunction pokemonCombatElectrodashResourceSpec()',1)
    panel="const electrodash=data?pokemonCombatElectrodashPanel(active.id,data):'';if(electrodash)body+=section('ELECTRODASH · SPRINT',electrodash);"
    anchor="const quickCurl=data?pokemonCombatQuickCurlPanel(active.id,data):'';"
    if panel not in text and anchor in text:text=text.replace(anchor,panel+anchor,1)
    source_panel="const sources=data?pokemonCombatSourcePrecedencePanel(data):'';if(sources)body+=section('RULESET SOURCE RESOLUTION',sources);"
    source_anchor="body+=section('MANEUVERS'"
    if source_panel not in text and source_anchor in text:text=text.replace(source_anchor,source_panel+source_anchor,1)
    condition_anchor="const parts=[];"
    condition_extra="const parts=[];if(row?.conditions?.stuck)parts.push(`<div class=\"flow-note\"><strong>Stuck</strong><small>Controlled status. Electrodash can remove it as a Shift Action.</small><button class=\"btn btn-ghost btn-small\" onclick=\"pokemonCombatSetStuck('${id}',false)\">Clear manually</button></div>`);else parts.push(`<button class=\"btn btn-ghost btn-small\" onclick=\"pokemonCombatSetStuck('${id}',true)\">Mark Stuck</button>`);if(Number(row?.conditions?.quickCurlDrRound)===Number(state.ui.round||1))parts.push(`<div class=\"flow-note\"><strong>Quick Curl</strong><small>+10 Damage Reduction for this round.</small></div>`);if(Number(row?.conditions?.electrodashSprintRound)===Number(state.ui.round||1))parts.push(`<div class=\"flow-note\"><strong>Electrodash Sprint</strong><small>Sprint was a Free Action; no Attacks of Opportunity while Sprinting this round.</small></div>`);"
    if condition_extra not in text:
        if condition_anchor in text:text=text.replace(condition_anchor,condition_extra,1)
        else:text=re.sub(r"const parts=\[\];[\s\S]*?(?=if\(Number\(row\?\.conditions\?\.quickCurlDrRound)",condition_extra,text,count=1)
    old="function pokemonCombatQuickCurlAbilityRow(data){return (data?.abilities||[]).find(row=>pokemonCombatSlug(row?.name||row?.definition?.name)==='quick-curl')||null;}"
    new="function pokemonCombatQuickCurlAbilityRow(data){return pokemonCombatResolveDefinition(data?.abilities,'Quick Curl');}"
    if old in text: text=text.replace(old,new,1)
    old="function pokemonCombatQuickCurlDefenseMoveRow(data){return (data?.moves||[]).find(row=>pokemonCombatSlug(row?.definition?.name||row?.record?.name)==='defense-curl')||null;}"
    new="function pokemonCombatQuickCurlDefenseMoveRow(data){return pokemonCombatResolveDefinition(data?.moves,'Defense Curl');}"
    if old in text: text=text.replace(old,new,1)
    old="function pokemonCombatViciousAbilityRow(data){return (data?.abilities||[]).find(row=>pokemonCombatSlug(row?.name||row?.definition?.name)==='vicious')||null;}"
    new="function pokemonCombatViciousAbilityRow(data){return pokemonCombatResolveDefinition(data?.abilities,'Vicious');}"
    if old in text: text=text.replace(old,new,1)
    old="function pokemonCombatViciousHoneClawsRow(data){return (data?.moves||[]).find(row=>pokemonCombatSlug(row?.definition?.name||row?.record?.name)==='hone-claws')||null;}"
    new="function pokemonCombatViciousHoneClawsRow(data){return pokemonCombatResolveDefinition(data?.moves,'Hone Claws');}"
    if old in text: text=text.replace(old,new,1)
    path.write_text(text,encoding='utf-8')

def main():
    for path in TARGETS: patch(path)
    print({'targets':len(TARGETS),'precedence':'core<1.05-editation<may-2015<september-2015<february-2016'})
if __name__=='__main__': main()
