import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { DefinitionRepository } from '../definitions/repository.mjs';
import { getPokemonModifierSummary } from '../rules/modifier-engine.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const ruleset='all-provided-material';
const defs=new DefinitionRepository(join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'));
const ceruledge=defs.getResolved({rulesetId:ruleset,kind:'species',id:'ceruledge'});
assert(ceruledge,'Ceruledge definition should resolve');
assert(ceruledge.abilities.some(a=>a.name==='Defiant'),'Ceruledge should offer Defiant');
assert(defs.getResolved({rulesetId:ruleset,kind:'abilities',id:'twisted-power'}),'Twisted Power should resolve');
defs.close();

const modifierProbe={details:{finalStats:{attack:20,special_attack:11},moveLimitBase:6,moveLimitModifier:2,moveLimitEffective:8,pokeEdges:[{id:'mixed-power'}]}};
const summary=getPokemonModifierSummary(modifierProbe);
assert.equal(summary.twistedPower.active,true);
assert.equal(summary.twistedPower.physicalDamageBonus,5);
assert.equal(summary.moveLimit.effective,8);
assert(summary.activeEffects.some(x=>x.id==='twisted-power'));

const port=4200;
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let stderr=''; child.stderr.on('data',d=>stderr+=d.toString());
try{
  let health=null;
  for(let i=0;i<50;i++){
    try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok){health=await r.json();break;}}catch{}
    await sleep(100);
  }
  assert(health,`server failed to start: ${stderr}`);
  assert.equal(health.version,'1.3.0');

  // Regression for the user's exact case: starting Ability + Level 20 choice + Mixed Power grant.
  const pokemon={id:'ability-regression',name:'Charcadet',species:'Ceruledge',level:30,types:['fire','ghost'],hp:41,maxHp:100,details:{
    speciesDefinitionId:'ceruledge',linkedRulesetId:ruleset,nature:'Hardy',
    abilities:['Flash Fire','Defiant'],ability:'Flash Fire',grantedAbilities:[],
    pokeEdges:[{id:'mixed-power',name:'Mixed Power',cost:2,sourceVersionId:'poke_edge:mixed-power@sep2015-adapter'}],
    finalStats:{hp:20,attack:20,defense:15,special_attack:11,special_defense:16,speed:18},
    moveLimitBase:6,moveLimitModifier:0,moveLimitEffective:6,moves:[]
  }};
  const refRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/reference-data`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon,rulesetId:ruleset})});
  const ref=await refRes.json(); assert(refRes.ok,JSON.stringify(ref));
  const names=ref.abilities.map(a=>a.name);
  assert(names.includes('Flash Fire'),JSON.stringify(names));
  assert(names.includes('Defiant'),JSON.stringify(names));
  assert(names.includes('Twisted Power'),JSON.stringify(names));
  assert.equal(ref.abilities.find(a=>a.name==='Flash Fire').sourceKind,'species_starting');
  assert.equal(ref.abilities.find(a=>a.name==='Defiant').sourceKind,'level_choice');
  assert.equal(ref.abilities.find(a=>a.name==='Defiant').unlockLevel,20);
  assert.equal(ref.abilities.find(a=>a.name==='Twisted Power').sourceId,'mixed-power');
  assert.equal(ref.resolvedCreature.abilities.length,3);
  assert.equal(ref.resolvedCreature.modifierSummary.twistedPower.active,true);
  assert.equal(ref.abilitySlots.length,2,'Level 30 should have starting + Level 20 native slots');
  assert(ref.abilitySlots[1].options.some(a=>a.name==='Defiant'),'Defiant should be offered in the Level 20 slot');

  // Ability correction repairs older saves that lost their Level 20 selection.
  const missing={...pokemon,details:{...pokemon.details,abilities:['Flash Fire'],pokeEdges:pokemon.details.pokeEdges}};
  const missingRefRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/reference-data`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:missing,rulesetId:ruleset})});
  const missingRef=await missingRefRes.json(); assert(missingRefRes.ok,JSON.stringify(missingRef));
  assert.equal(missingRef.abilitySlotStatus.unresolved.length,1);
  assert.equal(missingRef.abilitySlotStatus.unresolved[0].unlockLevel,20);
  const fixRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/ability-correction-preview`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:missing,selectedAbilities:['Flash Fire','Defiant'],rulesetId:ruleset})});
  const fixed=await fixRes.json(); assert(fixRes.ok,JSON.stringify(fixed));
  assert.equal(fixed.valid,true,JSON.stringify(fixed.errors));
  assert.deepEqual(fixed.details.abilities,['Flash Fire','Defiant']);
  assert.equal(fixed.details.abilityRecords[1].sourceLabel,'Level 20 Ability');
  assert.equal(fixed.details.abilityRecords[1].unlockLevel,20);

  const corrected={...missing,details:fixed.details};
  const ref2Res=await fetch(`http://127.0.0.1:${port}/api/pokemon/reference-data`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:corrected,rulesetId:ruleset})});
  const ref2=await ref2Res.json(); assert(ref2Res.ok,JSON.stringify(ref2));
  for(const expected of ['Flash Fire','Defiant','Twisted Power']) assert(ref2.abilities.some(a=>a.name===expected),`${expected} missing after correction`);

  const app=readFileSync(join(root,'static-preview','app.js'),'utf8');
  const css=readFileSync(join(root,'static-preview','styles.css'),'utf8');
  for(const token of ['LEVEL 20 CHOICE','GRANTED BY MIXED POWER','Edit Native Ability Slots','ability-correction-preview']) assert(app.includes(token),`missing UI token: ${token}`);
  for(const token of ['ability-correction-list','ability-source-legend']) assert(css.includes(token),`missing CSS token: ${token}`);

  console.log('PTU Companion v1.3 verification: OK');
  console.log('Resolved Ability model: Starting + Level choice + granted Ability passed');
  console.log('Mixed Power fallback grant -> Twisted Power passed');
  console.log('Ability-slot correction for older/incomplete saves passed');
  console.log('Resolved Creature model + Modifier Engine v2 summary passed');
} finally { child.kill('SIGTERM'); }
