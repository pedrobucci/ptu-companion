import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { DefinitionRepository } from '../definitions/repository.mjs';
import { evaluatePokeEdgePrerequisite } from '../rules/pokemon-engine.mjs';
import { getPokemonModifierSummary } from '../rules/modifier-engine.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const ruleset='all-provided-material';
const coreRuleset='ptu-core-only';
const definitions=new DefinitionRepository(join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'));

// Dual-type defensive profile regression: v1.1 ignored the database's `resistant` relation name.
const fireGhost=definitions.getDefensiveTypeProfile(['Fire','Ghost']);
const byType=Object.fromEntries(fireGhost.map(x=>[x.attackType,x]));
for(const type of ['Normal','Fighting']) assert.equal(byType[type]?.relation,'immune',`${type} should be immune`);
for(const type of ['Water','Ground','Rock','Ghost','Dark']) assert.equal(byType[type]?.relation,'weak',`${type} should be weak`);
for(const type of ['Fire','Grass','Ice','Poison','Steel','Fairy']) assert.equal(byType[type]?.relation,'resistant',`${type} should be resistant`);
assert.equal(byType.Bug?.relation,'resistant');
assert.equal(byType.Bug?.netSteps,-2);
assert.equal(byType.Bug?.multiplier,0.25);

const septEnabled=definitions.getRuleset(ruleset)?.packs?.some(p=>p.enabled&&p.pack_id==='ptu-september-2015-playtest');
const septInCore=definitions.getRuleset(coreRuleset)?.packs?.some(p=>p.enabled&&p.pack_id==='ptu-september-2015-playtest');
assert.equal(!!septEnabled,true);
assert.equal(!!septInCore,false);
definitions.close();

// Mixed Power's machine prerequisite uses allocated Level-Up Stat Points, not final Stats.
const syntheticMixed={id:'mixed-power'};
assert.equal(evaluatePokeEdgePrerequisite(syntheticMixed,{level:10,statAllocations:{attack:5,special_attack:5}}).valid,true);
assert.equal(evaluatePokeEdgePrerequisite(syntheticMixed,{level:9,statAllocations:{attack:5,special_attack:5}}).valid,false);
assert.equal(evaluatePokeEdgePrerequisite(syntheticMixed,{level:10,statAllocations:{attack:4,special_attack:5}}).valid,false);

const before={details:{finalStats:{attack:20,special_attack:11},pokeEdges:[{id:'mixed-power',name:'Mixed Power'}]}};
const summary=getPokemonModifierSummary(before);
assert.equal(summary.twistedPower.physicalDamageBonus,5);
assert.equal(summary.twistedPower.specialDamageBonus,10);

const port=4199;
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let stderr=''; child.stderr.on('data',d=>stderr+=d.toString());
try{
  let health=null;
  for(let i=0;i<50;i++){
    try{const r=await fetch(`http://127.0.0.1:${port}/api/health`); if(r.ok){health=await r.json();break;}}catch{}
    await sleep(100);
  }
  assert(health,`server failed to start: ${stderr}`);
  assert.equal(health.version,'1.2.0');

  const pokemon={id:'v12-ceruledge',name:'Modifier Test',species:'Ceruledge',level:30,types:['fire','ghost'],hp:60,maxHp:100,details:{
    speciesDefinitionId:'ceruledge',linkedRulesetId:ruleset,nature:'Hardy',
    tutorPointsEarned:10,tutorPointsSpent:0,tutorPointsRemaining:10,
    moveLimitEffective:6,tutorMovePoolLimit:3,
    abilities:['Flash Fire'],grantedAbilities:[],
    moves:[
      {id:'shadow-claw',name:'Shadow Claw',source:'current_species',learnedAt:30,countsAsNatural:true},
      {id:'flamethrower',name:'Flamethrower',source:'gm_override',learnedAt:30,countsAsNatural:false}
    ],
    pokeEdges:[],statAllocations:{hp:5,attack:5,defense:5,special_attack:5,special_defense:5,speed:15},
    finalStats:{hp:13,attack:20,defense:12,special_attack:11,special_defense:13,speed:24}
  }};

  const refBeforeRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/reference-data`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon,rulesetId:ruleset})});
  const refBefore=await refBeforeRes.json(); assert(refBeforeRes.ok,JSON.stringify(refBefore));
  const refByType=Object.fromEntries(refBefore.typeProfile.map(x=>[x.attackType,x]));
  assert.equal(refByType.Bug.multiplier,0.25);
  assert.equal(refByType.Fire.multiplier,0.5);
  assert.equal(refByType.Normal.multiplier,0);
  assert.equal(refBefore.modifierSummary.twistedPower.active,false);

  const optsRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/training-options`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon,rulesetId:ruleset})});
  const opts=await optsRes.json(); assert(optsRes.ok,JSON.stringify(opts));
  const mixed=opts.edges.find(e=>e.id==='mixed-power');
  assert(mixed,'Mixed Power should be exposed when September 2015 is enabled');
  assert.equal(mixed.cost,2);
  assert.equal(mixed.prerequisite.valid,true);
  assert.equal(mixed.grantsAbility,'Twisted Power');

  // Core-only has no Species pack in this seed, so Ruleset gating is asserted above from the pack manifest.


  const acquireRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/training-action-preview`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'acquire_edge',pokemon,edgeId:'mixed-power',rulesetId:ruleset})});
  const acquired=await acquireRes.json(); assert(acquireRes.ok,JSON.stringify(acquired));
  assert.equal(acquired.valid,true,JSON.stringify(acquired.errors));
  assert.equal(acquired.cost,2);
  assert.equal(acquired.tutorPoints.spent,2);
  assert(acquired.details.pokeEdges.some(e=>e.id==='mixed-power'));
  assert(acquired.details.grantedAbilities.some(a=>a.name==='Twisted Power'&&a.sourceId==='mixed-power'));
  assert.equal(acquired.details.finalStats.attack,20);
  assert.equal(acquired.details.finalStats.special_attack,11);

  const powered={...pokemon,details:acquired.details};
  const refAfterRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/reference-data`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:powered,rulesetId:ruleset})});
  const refAfter=await refAfterRes.json(); assert(refAfterRes.ok,JSON.stringify(refAfter));
  assert.equal(refAfter.modifierSummary.twistedPower.active,true);
  assert.equal(refAfter.modifierSummary.twistedPower.physicalDamageBonus,5);
  assert.equal(refAfter.modifierSummary.twistedPower.specialDamageBonus,10);
  assert(refAfter.abilities.some(a=>a.name==='Twisted Power'&&a.grantSource?.sourceId==='mixed-power'));

  const shadow=refAfter.moves.find(x=>x.record.id==='shadow-claw');
  const flame=refAfter.moves.find(x=>x.record.id==='flamethrower');
  assert(shadow?.resolvedDamage,'Shadow Claw should have resolved damage');
  assert(flame?.resolvedDamage,'Flamethrower should have resolved damage');
  assert.equal(shadow.resolvedDamage.mixedPowerBonus,5);
  assert.equal(shadow.resolvedDamage.finalRoll,'2d10+35');
  assert.equal(flame.resolvedDamage.mixedPowerBonus,10);
  assert.equal(flame.resolvedDamage.primaryStat.name,'Special Attack');

  const app=readFileSync(join(root,'static-preview','app.js'),'utf8');
  const css=readFileSync(join(root,'static-preview','styles.css'),'utf8');
  for(const token of ['Mixed Power / Twisted Power active','MIXED POWER +','Dual-type resistance steps','GRANTED BY MIXED POWER']) assert(app.includes(token),`missing UI token: ${token}`);
  for(const token of ['resolved-damage-box','modifier-callout']) assert(css.includes(token),`missing CSS token: ${token}`);

  console.log('PTU Companion v1.2 verification: OK');
  console.log('Fire/Ghost dual-type resistances: passed (Bug x0.25 double resistance)');
  console.log('Mixed Power Ruleset gating + prerequisites + 2 TP cost: passed');
  console.log('Mixed Power -> Twisted Power persistent grant: passed');
  console.log('Resolved Physical/Special damage bonuses: passed');
  console.log('Creature Type/Moves/Abilities/Species modifier UI: present');
} finally { child.kill('SIGTERM'); }
