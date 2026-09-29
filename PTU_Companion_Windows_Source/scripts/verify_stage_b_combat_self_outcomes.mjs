import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const repo=resolve(root,'..');
const appPaths=[join(root,'static-preview','app.js'),join(repo,'PTU_Companion_Android_Tauri','www','app.js')];
const docJson=join(repo,'docs','data','PTU_COMBAT_MOVE_OUTCOMES.json');
const docMd=join(repo,'docs','PTU_COMBAT_MOVE_OUTCOMES.md');

function extractFunction(src,name){
  const match=new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);if(!match)throw new Error(`Missing function ${name}`);
  const start=match.index,tail=src.slice(start+1),next=/\n(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/.exec(tail),end=next?start+1+next.index:src.length;return src.slice(start,end).trim();
}

const sources=[];
for(const path of appPaths){
  const src=await readFile(path,'utf8');sources.push(src);
  for(const needle of [
    "if(slug==='close-combat')return {kind:'close-combat'}",
    "if(slug==='leaf-storm')return {kind:'leaf-storm',requiresDamageDealt:true}",
    "if(slug==='petal-dance')return {kind:'petal-dance',requiresDamageDealt:true}",
    "if(slug==='charge-beam')return {kind:'charge-beam',requiresExtraD20:true}",
    'Did this Move deal damage?',
    'Effect roll · physical d20',
    "pokemonCombatApplyCombatStages(id,{defense:-1,spDefense:-1},'Close Combat')",
    "pokemonCombatApplyCombatStages(id,{spAttack:-2},'Leaf Storm')",
    "pokemonCombatApplySelfStatuses(id,['Enraged','Confused'],'Petal Dance')",
    "pokemonCombatChargeBeamRaisesSpAttack(extraD20)",
  ])assert.ok(src.includes(needle),`${path} missing ${needle}`);

  const resolver=extractFunction(src,'pokemonCombatResolveMove');
  assert.ok(!resolver.includes('pokemonCombatRandomInt('),'self-outcome resolver must not generate a d20');
  assert.ok(!resolver.includes('pokemonCombatRollDiceExpression('),'self-outcome resolver must not generate damage dice');
  assert.match(resolver,/combat-extra-d20/);
  assert.match(resolver,/spec\.requiresDamageDealt/);
  assert.match(resolver,/spec\.requiresExtraD20/);

  const pokemonState={combatStages:{attack:5,defense:0,spAttack:5,spDefense:0}};
  const stageCtx={pokemon:()=>pokemonState,pokemonCombatLog:()=>null};vm.createContext(stageCtx);vm.runInContext(extractFunction(src,'pokemonCombatApplyCombatStages'),stageCtx);
  let result=stageCtx.pokemonCombatApplyCombatStages('p',{defense:-1,spDefense:-1},'Close Combat');
  assert.equal(pokemonState.combatStages.defense,-1);assert.equal(pokemonState.combatStages.spDefense,-1);assert.equal(result.changes.defense.applied,-1);
  result=stageCtx.pokemonCombatApplyCombatStages('p',{spAttack:2},'Clamp test');assert.equal(pokemonState.combatStages.spAttack,6);assert.equal(result.changes.spAttack.applied,1);

  const ledger={conditions:{}};const statusCtx={pokemon:()=>({name:'Testmon'}),pokemonCombatParticipant:()=>ledger,pokemonCombatSlug:v=>String(v).toLowerCase().replace(/[^a-z0-9]+/g,'-'),pokemonCombatLog:()=>null};vm.createContext(statusCtx);vm.runInContext(extractFunction(src,'pokemonCombatApplySelfStatuses'),statusCtx);statusCtx.pokemonCombatApplySelfStatuses('p',['Enraged','Confused'],'Petal Dance');assert.equal(ledger.conditions.enraged,true);assert.equal(ledger.conditions.confused,true);

  const chargeCtx={};vm.createContext(chargeCtx);vm.runInContext(extractFunction(src,'pokemonCombatChargeBeamRaisesSpAttack'),chargeCtx);assert.equal(chargeCtx.pokemonCombatChargeBeamRaisesSpAttack(6),false);assert.equal(chargeCtx.pokemonCombatChargeBeamRaisesSpAttack(7),true);assert.equal(chargeCtx.pokemonCombatChargeBeamRaisesSpAttack(20),true);assert.equal(chargeCtx.pokemonCombatChargeBeamRaisesSpAttack(21),false);
}

for(const name of ['pokemonCombatOutcomeSpec','pokemonCombatOutcomeUiFields','pokemonCombatApplyCombatStages','pokemonCombatApplyAttackStages','pokemonCombatApplySelfStatuses','pokemonCombatChargeBeamRaisesSpAttack','pokemonCombatApplyMoveOutcome','pokemonCombatResolveMove'])assert.equal(extractFunction(sources[0],name),extractFunction(sources[1],name),`${name} diverged between Windows and Android`);

const doc=JSON.parse(await readFile(docJson,'utf8'));assert.equal(doc.schema_version,2);assert.equal(doc.physical_dice_only,true);assert.equal(doc.target_model,'abstract');assert.match(doc.handlers.close_combat.effect,/Defense -1 CS/);assert.match(doc.handlers.leaf_storm.effect,/Special Attack -2 CS/);assert.match(doc.handlers.petal_dance.effect,/Enraged and Confused/);assert.equal(doc.handlers.charge_beam.threshold,'7+');assert.equal(doc.handlers.charge_beam.digital_rng,false);
const md=await readFile(docMd,'utf8');for(const name of ['Close Combat','Leaf Storm','Petal Dance','Charge Beam'])assert.match(md,new RegExp(name));assert.match(md,/additional \*\*1d20 physically\*\*/i);

console.log(JSON.stringify({moveOutcomeModel:2,physicalDiceOnly:true,targetModel:'abstract',selfOutcomes:['Close Combat','Leaf Storm','Petal Dance','Charge Beam'],enemyEntities:false},null,2));
