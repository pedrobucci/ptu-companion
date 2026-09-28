import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const repo=resolve(root,'..');
const appPaths=[join(root,'static-preview','app.js'),join(repo,'PTU_Companion_Android_Tauri','www','app.js')];
const docJson=join(repo,'docs','data','PTU_COMBAT_VICIOUS.json');
const docMd=join(repo,'docs','PTU_COMBAT_VICIOUS.md');
const sessionJson=join(repo,'docs','data','PTU_COMBAT_SESSION_LEDGER.json');
const sessionMd=join(repo,'docs','PTU_COMBAT_SESSION_LEDGER.md');

function extractFunction(src,name){
  const match=new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);if(!match)throw new Error(`Missing function ${name}`);
  const start=match.index,tail=src.slice(start+1),next=/\n(?:(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(|const\s+POKEMON_COMBAT_[A-Z0-9_]+\s*=)/.exec(tail),end=next?start+1+next.index:src.length;return src.slice(start,end).trim();
}

const viciousFunctions=['pokemonCombatViciousAbilityResourceSpec','pokemonCombatViciousAbilityRow','pokemonCombatViciousHoneClawsRow','pokemonCombatViciousAbilitySourceMatches','pokemonCombatViciousHoneClawsSourceMatches','pokemonCombatViciousRecordMoveUse','pokemonCombatViciousAvailability','pokemonCombatUseVicious','pokemonCombatViciousPanel'];
const actionFunctions=['pokemonCombatTurn','pokemonCombatStandardRemaining','pokemonCombatSpendStandardToken','pokemonCombatCanSpendAction','pokemonCombatSpendAction','pokemonCombatActionDelta','pokemonCombatRefundActionDelta'];
const sources=[];
for(const path of appPaths){
  const src=await readFile(path,'utf8');sources.push(src);
  for(const needle of [
    'function pokemonCombatViciousAbilityResourceSpec',
    "pokemonCombatNonMoveSpec('ability','combat-vicious','Vicious',null,'Scene')",
    'Vicious + Hone Claws',
    "section('VICIOUS · HONE CLAWS'",
    'pokemonCombatViciousRecordMoveUse(id,row)',
    'viciousCriticalRangeBonus=2',
    'bonus:{standard:0}',
    'bonusUsed:{standard:0}',
    'Bonus Standard → Swift',
    'Bonus Standard → Shift',
  ])assert.ok(src.includes(needle),`${path} missing ${needle}`);
  for(const name of [...viciousFunctions,...actionFunctions]){
    const code=extractFunction(src,name);assert.ok(!code.includes('Math.random('),`${path} ${name} must not use Math.random`);assert.ok(!code.includes('pokemonCombatRandomInt('),`${path} ${name} must not generate dice`);assert.ok(!code.includes('pokemonCombatRollDiceExpression('),`${path} ${name} must not generate dice`);
  }
  const noRoll=extractFunction(src,'pokemonCombatUseNoRoll');assert.ok(noRoll.includes('pokemonCombatSpendAction(id,available.action)'),`${path} ordinary Hone Claws/Move action path changed`);assert.ok(noRoll.includes('pokemonCombatDispatchMoveFormEvent(id,row)'),`${path} no-roll Move path must dispatch the Vicious trigger recorder`);
  const full=extractFunction(src,'pokemonCombatCanSpendAction');assert.match(full,/Full Action needs the base Standard and Shift Actions available/i,`${path} bonus Standard must not silently satisfy Full Action`);
  assert.ok(src.includes('row.triggerWindows={};row.viciousActivation=null;'),`${path} Scene/Day boundaries must close Vicious trigger/activation markers`);
}
for(const name of [...viciousFunctions,...actionFunctions])assert.equal(extractFunction(sources[0],name),extractFunction(sources[1],name),`${name} diverged between Windows and Android`);

const ctx={console};vm.createContext(ctx);
ctx.state={ui:{round:1,scene:1,day:1}};
ctx.row={pokemonId:'p',turn:{round:1,used:{standard:false,shift:false,swift:false},conversions:[],bonus:{standard:0},bonusUsed:{standard:0}},frequency:{sceneNumber:1,dayNumber:1,scene:{},day:{},eot:{}},resourceTransactions:[],resourceSequence:0,moveState:{rollout:{active:false},furyCutter:{active:false}},conditions:{curledUp:false},triggerWindows:{},viciousActivation:null,log:[]};
ctx.pokemonCombatParticipant=(id,{create=true}={})=>id==='p'?ctx.row:null;
ctx.pokemonCombatLog=()=>null;
ctx.pokemon=(id)=>id==='p'?{id:'p',name:'Testmon'}:null;
ctx.commit=async()=>null;ctx.render=()=>null;ctx.toast=()=>null;ctx.applyPokemonFormGameEventUi=async()=>null;

for(const name of ['pokemonCombatSlug','pokemonCombatParseFrequency','pokemonCombatSyncBoundaries','pokemonCombatTurn','pokemonCombatStandardRemaining','pokemonCombatSpendStandardToken','pokemonCombatCanSpendAction','pokemonCombatSpendAction'])vm.runInContext(extractFunction(sources[0],name),ctx);
vm.runInContext("const POKEMON_COMBAT_TRACKED_ACTION_COSTS=new Set(['Full Action','Standard Action','Shift Action','Swift Action','Free Action']);",ctx);
for(const name of ['pokemonCombatNonMoveSpec','pokemonCombatNonMoveResourceKey','pokemonCombatNonMoveAvailability','pokemonCombatActionDelta','pokemonCombatFrequencyValue','pokemonCombatRefundActionDelta','pokemonCombatSpendFrequency','pokemonCombatFrequencyAvailability','pokemonCombatSpendNonMoveResource','pokemonCombatRefundNonMoveResourceCore']){
  if(!ctx[name])vm.runInContext(extractFunction(sources[0],name),ctx);
}
for(const name of viciousFunctions)vm.runInContext(extractFunction(sources[0],name),ctx);

const viciousRow={name:'Vicious',definition:{name:'Vicious',frequency:'Scene – Special',effect:'Connection – Hone Claws. When this Ability is activated, choose one effect; the user gains another Standard Action this round; or the user increase their Critical Hit Range on all attacks by +2 for the remainder of the encounter.'}};
const honeRow={definition:{id:'hone-claws',name:'Hone Claws',frequency:'At-Will',ac:null,class:'Status',range:'Self',effect:'The user’s Accuracy is raised by +1, and the user gains +1 Attack Combat Stage.'}};
const data={abilities:[viciousRow],moves:[honeRow]};ctx.pokemonCombatReferenceState={pokemonId:'p',data};
assert.equal(ctx.pokemonCombatViciousAbilitySourceMatches(viciousRow),true);
assert.equal(ctx.pokemonCombatViciousHoneClawsSourceMatches(honeRow),true);
assert.equal(ctx.pokemonCombatViciousAbilitySourceMatches({name:'Vicious',definition:{frequency:'Scene – Special',effect:'Changed pack text.'}}),false,'changed Vicious source must disable automation');
assert.equal(ctx.pokemonCombatViciousHoneClawsSourceMatches({definition:{name:'Hone Claws',frequency:'Scene',range:'Self',effect:honeRow.definition.effect}}),false,'changed Hone Claws frequency must disable automation');

function fresh({round=1,scene=1,day=1,standard=false,shift=false,swift=false,bonus=0,bonusUsed=0}={}){
  ctx.state.ui={round,scene,day};ctx.row.turn={round,used:{standard,shift,swift},conversions:[],bonus:{standard:bonus},bonusUsed:{standard:bonusUsed}};ctx.row.frequency={sceneNumber:scene,dayNumber:day,scene:{},day:{},eot:{}};ctx.row.resourceTransactions=[];ctx.row.resourceSequence=0;ctx.row.conditions={curledUp:false,viciousCriticalRangeBonus:0};ctx.row.triggerWindows={};ctx.row.viciousActivation=null;
}

fresh();assert.equal(ctx.pokemonCombatStandardRemaining(ctx.row.turn),1);assert.equal(ctx.pokemonCombatSpendAction('p','Standard Action').spent,'Standard Action');assert.equal(ctx.pokemonCombatStandardRemaining(ctx.row.turn),0);ctx.row.turn.bonus.standard=1;assert.equal(ctx.pokemonCombatStandardRemaining(ctx.row.turn),1);assert.equal(ctx.pokemonCombatSpendAction('p','Standard Action').spent,'Bonus Standard Action');assert.equal(ctx.row.turn.bonusUsed.standard,1);assert.equal(ctx.pokemonCombatStandardRemaining(ctx.row.turn),0);

fresh({round:2,scene:2,standard:true,swift:true,bonus:1});let converted=ctx.pokemonCombatSpendAction('p','Swift Action');assert.equal(converted.valid,true);assert.equal(converted.spent,'Bonus Standard Action → Swift Action');assert.equal(ctx.row.turn.bonusUsed.standard,1);assert.ok(ctx.row.turn.conversions.includes('Bonus Standard → Swift'));

fresh({round:3,scene:3,standard:true,shift:false,bonus:1});assert.equal(ctx.pokemonCombatCanSpendAction('p','Full Action').valid,false,'bonus Standard must not satisfy Full Action after base Standard is spent');

fresh({round:4,scene:4,standard:true,swift:true,bonus:1});const before={round:4,used:{...ctx.row.turn.used},conversions:[...ctx.row.turn.conversions],bonus:{...ctx.row.turn.bonus},bonusUsed:{...ctx.row.turn.bonusUsed}};converted=ctx.pokemonCombatSpendAction('p','Swift Action');const delta=ctx.pokemonCombatActionDelta(before,ctx.row.turn);assert.equal(delta.bonusStandardUsed,1);assert.ok(delta.conversions.includes('Bonus Standard → Swift'));assert.equal(ctx.pokemonCombatRefundActionDelta('p',delta),true);assert.equal(ctx.row.turn.bonusUsed.standard,0);assert.equal(ctx.row.turn.conversions.length,0);

fresh({round:5,scene:5,standard:true});ctx.pokemonCombatViciousRecordMoveUse('p',honeRow);assert.ok(ctx.row.triggerWindows.vicious,'Hone Claws must open Vicious trigger');let available=ctx.pokemonCombatViciousAvailability('p',data,'extra-standard');assert.equal(available.valid,true);let result=await ctx.pokemonCombatUseVicious('p','extra-standard');assert.equal(result.valid,true);assert.equal(ctx.row.turn.bonus.standard,1);assert.equal(ctx.row.frequency.scene['nonmove:ability:combat-vicious'],1);assert.equal(ctx.row.viciousActivation.choice,'extra-standard');assert.equal(ctx.pokemonCombatViciousAvailability('p',data,'extra-standard').valid,false,'Vicious must not double-activate in the same Scene');
const tx=result.spent.transaction;assert.ok(tx);const refunded=ctx.pokemonCombatRefundNonMoveResourceCore('p',tx.id,{log:false});assert.equal(refunded.valid,true);assert.equal(ctx.row.frequency.scene['nonmove:ability:combat-vicious'],0,'resource-only Undo restores Scene resource');assert.equal(ctx.row.turn.bonus.standard,1,'resource-only Undo must not rewind granted Standard Action');assert.equal(ctx.pokemonCombatViciousAvailability('p',data,'extra-standard').valid,false,'effect marker must prevent Undo from becoming a duplicate activation');

fresh({round:6,scene:6,standard:true,swift:true});ctx.pokemonCombatViciousRecordMoveUse('p',honeRow);result=await ctx.pokemonCombatUseVicious('p','extra-standard');assert.equal(result.valid,true);converted=ctx.pokemonCombatSpendAction('p','Swift Action');assert.equal(converted.spent,'Bonus Standard Action → Swift Action','Vicious extra Standard must reuse shared Standard→Swift conversion');

fresh({round:7,scene:7,standard:true});ctx.pokemonCombatViciousRecordMoveUse('p',honeRow);result=await ctx.pokemonCombatUseVicious('p','critical-range');assert.equal(result.valid,true);assert.equal(ctx.row.conditions.viciousCriticalRangeBonus,2);ctx.state.ui.round=8;ctx.pokemonCombatTurn('p');assert.equal(ctx.row.conditions.viciousCriticalRangeBonus,2,'critical-range choice must survive round boundary');ctx.row.viciousActivation=null;ctx.row.frequency.sceneNumber=8;ctx.row.frequency.scene={};ctx.state.ui.scene=8;ctx.pokemonCombatViciousRecordMoveUse('p',honeRow);available=ctx.pokemonCombatViciousAvailability('p',data,'critical-range');assert.equal(available.valid,false);assert.match(available.reason,/already active/i,'automation must not stack the +2 critical-range effect');

fresh({round:9,scene:9,standard:true});ctx.pokemonCombatViciousRecordMoveUse('p',honeRow);assert.ok(ctx.row.triggerWindows.vicious);ctx.pokemonCombatViciousRecordMoveUse('p',{definition:{name:'Tackle'}});assert.equal(ctx.row.triggerWindows.vicious,undefined,'another Move must close the trigger window');

const doc=JSON.parse(await readFile(docJson,'utf8'));assert.equal(doc.schema_version,1);assert.equal(doc.physical_dice_only,true);assert.equal(doc.ability.name,'Vicious');assert.equal(doc.ability.frequency,'Scene');assert.equal(doc.ability.action_cost,'Special');assert.equal(doc.move.name,'Hone Claws');assert.equal(doc.runtime_policy.bonus_standard_satisfies_full_action,undefined);assert.match(doc.runtime_policy.full_action,/does not satisfy Full Action/i);assert.match(doc.source_conflicts_observed_while_selecting_candidate.Electrodash,/conflict|Core:/i);
const md=await readFile(docMd,'utf8');assert.match(md,/Scene – Special/);assert.match(md,/another Standard Action this round/i);assert.match(md,/Critical Hit Range.*\+2/i);assert.match(md,/Electrodash was rejected/i);assert.match(md,/Quick Curl.*conflict/i);assert.match(md,/physical dice/i);
const session=JSON.parse(await readFile(sessionJson,'utf8'));assert.equal(session.triggered_connections.vicious_hone_claws.extra_standard_shared_action_api,true);assert.equal(session.triggered_connections.vicious_hone_claws.standard_to_swift_or_shift,true);assert.equal(session.triggered_connections.vicious_hone_claws.bonus_standard_satisfies_full_action,false);const sessionText=await readFile(sessionMd,'utf8');assert.match(sessionText,/Vicious \+ Hone Claws triggered connection/);assert.match(sessionText,/bonus Standard Action/i);

console.log(JSON.stringify({combatViciousModel:1,ability:'Vicious',triggerMove:'Hone Claws',frequency:'Scene – Special',extraStandard:true,standardToSwiftOrShift:true,bonusStandardFullAction:false,criticalRangeBonus:2,noDoubleSpend:true,resourceOnlyRefund:true,sourceSignatureGuard:true,physicalDiceOnly:true,abstractTarget:true,windowsAndroidParity:true},null,2));
