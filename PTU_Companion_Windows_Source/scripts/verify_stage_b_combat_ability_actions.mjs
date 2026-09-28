import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const repo=resolve(root,'..');
const appPaths=[join(root,'static-preview','app.js'),join(repo,'PTU_Companion_Android_Tauri','www','app.js')];
const docJson=join(repo,'docs','data','PTU_COMBAT_ABILITY_ACTIONS.json');
const docMd=join(repo,'docs','PTU_COMBAT_ABILITY_ACTIONS.md');

function extractFunction(src,name){
  const match=new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);if(!match)throw new Error(`Missing function ${name}`);
  const start=match.index,tail=src.slice(start+1),next=/\n(?:(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(|const\s+POKEMON_COMBAT_[A-Z0-9_]+\s*=)/.exec(tail),end=next?start+1+next.index:src.length;return src.slice(start,end).trim();
}
function extractConstBlock(src,name,nextFunction){
  const start=src.indexOf(`const ${name}=`),end=src.indexOf(`function ${nextFunction}(`,start);if(start<0||end<0)throw new Error(`Missing const block ${name}`);return src.slice(start,end).trim();
}

const parityNames=['pokemonCombatAbilityActionSpec','pokemonCombatAbilityActionSourceMatches','pokemonCombatEffectSporeStatus','pokemonCombatAbilityActionAvailability','pokemonCombatAbilityActionCard','pokemonCombatAbilityActionPanel','pokemonCombatOpenAbilityAction','pokemonCombatResolveAbilityAction'];
const sources=[];
for(const path of appPaths){
  const src=await readFile(path,'utf8');sources.push(src);
  for(const needle of [
    'const POKEMON_COMBAT_ABILITY_ACTION_ALLOWLIST=',
    "'dodge':{label:'Dodge',actionCost:'Free Action',frequency:'Daily'",
    "'parry':{label:'Parry',actionCost:'Free Action',frequency:'Scene'",
    "'effect-spore':{label:'Effect Spore',actionCost:'Free Action',frequency:'Scene'",
    "'stalwart':{label:'Stalwart',actionCost:'Free Action',frequency:'Scene'",
    'Effect roll · physical d6',
    'Did the source trigger occur?',
    'No opponent state was persisted.',
    "section('AVAILABLE ABILITIES'",
    'pokemonCombatSpendNonMoveResource(id,spec.resource,{log:false})'
  ])assert.ok(src.includes(needle),`${path} missing ${needle}`);
  const open=extractFunction(src,'pokemonCombatOpenAbilityAction'),resolveAbility=extractFunction(src,'pokemonCombatResolveAbilityAction');
  for(const code of [open,resolveAbility]){
    assert.ok(!code.includes('Math.random('),`${path} Ability action must not use Math.random`);
    assert.ok(!code.includes('pokemonCombatRandomInt('),`${path} Ability action must not generate a d20/d6`);
    assert.ok(!code.includes('pokemonCombatRollDiceExpression('),`${path} Ability action must not generate damage/effect dice`);
  }
}
assert.equal(extractConstBlock(sources[0],'POKEMON_COMBAT_ABILITY_ACTION_ALLOWLIST','pokemonCombatAbilityActionSpec'),extractConstBlock(sources[1],'POKEMON_COMBAT_ABILITY_ACTION_ALLOWLIST','pokemonCombatAbilityActionSpec'),'Ability allowlist diverged between Windows and Android');
for(const name of parityNames)assert.equal(extractFunction(sources[0],name),extractFunction(sources[1],name),`${name} diverged between Windows and Android`);

const ctx={console};vm.createContext(ctx);
ctx.state={ui:{round:1,scene:1,day:1}};
ctx.row={pokemonId:'p',turn:{round:1,used:{standard:false,shift:false,swift:false},conversions:[]},frequency:{sceneNumber:1,dayNumber:1,scene:{},day:{},eot:{}},resourceTransactions:[],resourceSequence:0};
ctx.pokemonCombatParticipant=(id,{create=true}={})=>id==='p'?ctx.row:null;
ctx.pokemonCombatLog=()=>null;
ctx.pkm={id:'p',name:'Testmon',combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}};
ctx.pokemon=id=>id==='p'?ctx.pkm:null;
for(const name of ['pokemonCombatSlug','pokemonCombatParseFrequency','pokemonCombatSyncBoundaries','pokemonCombatTurn','pokemonCombatStandardRemaining','pokemonCombatSpendStandardToken','pokemonCombatCanSpendAction','pokemonCombatSpendAction','pokemonCombatFrequencyAvailability','pokemonCombatSpendFrequency'])vm.runInContext(extractFunction(sources[0],name),ctx);
vm.runInContext("const POKEMON_COMBAT_TRACKED_ACTION_COSTS=new Set(['Full Action','Standard Action','Shift Action','Swift Action','Free Action']);",ctx);
for(const name of ['pokemonCombatNonMoveSpec','pokemonCombatNonMoveResourceKey','pokemonCombatNonMoveAvailability','pokemonCombatActionDelta','pokemonCombatFrequencyValue','pokemonCombatRefundActionDelta','pokemonCombatSpendNonMoveResource','pokemonCombatRefundNonMoveResourceCore'])vm.runInContext(extractFunction(sources[0],name),ctx);
vm.runInContext(extractConstBlock(sources[0],'POKEMON_COMBAT_ABILITY_ACTION_ALLOWLIST','pokemonCombatAbilityActionSpec'),ctx);
for(const name of ['pokemonCombatAbilityActionSpec','pokemonCombatAbilityActionSourceMatches','pokemonCombatEffectSporeStatus','pokemonCombatAbilityActionAvailability','pokemonCombatApplyCombatStages'])vm.runInContext(extractFunction(sources[0],name),ctx);

const rows={
  dodge:{name:'Dodge',definition:{effect:'The triggering Move instead misses. Defensive.'}},
  parry:{name:'Parry',definition:{effect:'The attack instead misses. Defensive.'}},
  spore:{name:'Effect Spore',definition:{effect:'Roll 1d6. On a result of 1 or 2, the attacker is Poisoned. On a result of 3 or 4, the attacker is Paralyzed. On a result of 5 or 6, the attacker falls Asleep.'}},
  stalwart:{name:'Stalwart',definition:{effect:"The user’s Attack, Special Attack, Defense, and Special Defense all increase by 1 CS."}},
};
const dodge=ctx.pokemonCombatAbilityActionSpec(rows.dodge),parry=ctx.pokemonCombatAbilityActionSpec(rows.parry),spore=ctx.pokemonCombatAbilityActionSpec(rows.spore),stalwart=ctx.pokemonCombatAbilityActionSpec(rows.stalwart);
assert.equal(dodge.actionCost,'Free Action');assert.equal(dodge.frequency,'Daily');
assert.equal(parry.frequency,'Scene');assert.equal(spore.requiresPhysicalD6,true);assert.deepEqual({...stalwart.stageChanges},{attack:1,spAttack:1,defense:1,spDefense:1});
for(const [key,row] of Object.entries(rows))assert.equal(ctx.pokemonCombatAbilityActionSourceMatches(row),true,`${key} source signature should match`);
assert.equal(ctx.pokemonCombatAbilityActionSourceMatches({name:'Dodge',definition:{effect:'Different content-pack effect.'}}),false,'changed active definition must disable automation');
assert.equal(ctx.pokemonCombatEffectSporeStatus(1),'Poisoned');assert.equal(ctx.pokemonCombatEffectSporeStatus(2),'Poisoned');assert.equal(ctx.pokemonCombatEffectSporeStatus(3),'Paralyzed');assert.equal(ctx.pokemonCombatEffectSporeStatus(4),'Paralyzed');assert.equal(ctx.pokemonCombatEffectSporeStatus(5),'Asleep');assert.equal(ctx.pokemonCombatEffectSporeStatus(6),'Asleep');assert.equal(ctx.pokemonCombatEffectSporeStatus(0),null);assert.equal(ctx.pokemonCombatEffectSporeStatus(7),null);

function fresh({round=1,scene=1,day=1}={}){ctx.state.ui={round,scene,day};ctx.row.turn={round,used:{standard:false,shift:false,swift:false},conversions:[]};ctx.row.frequency={sceneNumber:scene,dayNumber:day,scene:{},day:{},eot:{}};ctx.row.resourceTransactions=[];ctx.row.resourceSequence=0;}
for(const [label,spec] of [['Dodge',dodge],['Parry',parry],['Effect Spore',spore],['Stalwart',stalwart]]){
  fresh();const first=ctx.pokemonCombatSpendNonMoveResource('p',spec.resource,{log:false});assert.equal(first.valid,true,`${label} first spend should succeed`);assert.equal(ctx.pokemonCombatSpendNonMoveResource('p',spec.resource,{log:false}).valid,false,`${label} must not double-spend`);const refund=ctx.pokemonCombatRefundNonMoveResourceCore('p',first.transaction.id,{log:false});assert.equal(refund.valid,true,`${label} refund should be accepted`);assert.equal(ctx.pokemonCombatSpendNonMoveResource('p',spec.resource,{log:false}).valid,true,`${label} should be available after resource refund`);
}
fresh({scene:4,day:2});let spend=ctx.pokemonCombatSpendNonMoveResource('p',parry.resource,{log:false});assert.equal(spend.valid,true);assert.equal(ctx.pokemonCombatSpendNonMoveResource('p',parry.resource,{log:false}).valid,false);ctx.state.ui.scene=5;assert.equal(ctx.pokemonCombatNonMoveAvailability('p',parry.resource).valid,true,'Scene boundary must reset Parry');
fresh({scene:5,day:2});spend=ctx.pokemonCombatSpendNonMoveResource('p',dodge.resource,{log:false});assert.equal(spend.valid,true);assert.equal(ctx.pokemonCombatSpendNonMoveResource('p',dodge.resource,{log:false}).valid,false);ctx.state.ui.day=3;assert.equal(ctx.pokemonCombatNonMoveAvailability('p',dodge.resource).valid,true,'Day boundary must reset Dodge');
assert.equal(new Set([dodge,parry,spore,stalwart].map(spec=>ctx.pokemonCombatNonMoveResourceKey(spec.resource))).size,4,'Ability resources must use separate source keys');

ctx.pkm.combatStages={attack:6,defense:-6,spAttack:0,spDefense:5,speed:0,accuracy:0,evasion:0};const stageResult=ctx.pokemonCombatApplyCombatStages('p',stalwart.stageChanges,'Stalwart');assert.equal(ctx.pkm.combatStages.attack,6);assert.equal(ctx.pkm.combatStages.defense,-5);assert.equal(ctx.pkm.combatStages.spAttack,1);assert.equal(ctx.pkm.combatStages.spDefense,6);assert.equal(stageResult.changes.attack.applied,0,'Stalwart must respect normal +6 CS cap');

const doc=JSON.parse(await readFile(docJson,'utf8'));assert.equal(doc.schema_version,1);assert.equal(doc.shared_non_move_resource_ledger,true);assert.equal(doc.physical_dice_only,true);assert.equal(doc.target_model,'abstract');assert.equal(doc.allowlist.dodge.frequency,'Daily');assert.equal(doc.allowlist.parry.frequency,'Scene');assert.equal(doc.allowlist.effect_spore.physical_roll,'1d6');assert.equal(doc.allowlist.effect_spore.persist_target_state,false);assert.match(doc.allowlist.stalwart.effect,/Special Defense.*\+1 CS/i);assert.ok(doc.deferred_conflicting_or_composite.sprint.includes('Standard Action'));
const md=await readFile(docMd,'utf8');assert.match(md,/Dodge/);assert.match(md,/Parry/);assert.match(md,/Effect Spore/);assert.match(md,/Stalwart/);assert.match(md,/physical\/manual/i);assert.match(md,/Prime Fury/);assert.match(md,/Sprint Maneuver/);

console.log(JSON.stringify({combatAbilityActionModel:1,allowlist:['Dodge','Parry','Effect Spore','Stalwart'],sharedLedger:true,physicalDiceOnly:true,abstractTarget:true,noDoubleSpend:true,resourceRefund:true,sceneDailyReset:true,sourceSignatureGuard:true,windowsAndroidParity:true},null,2));
