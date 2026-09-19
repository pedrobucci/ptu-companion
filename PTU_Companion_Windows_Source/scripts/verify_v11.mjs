import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { DefinitionRepository } from '../definitions/repository.mjs';
import { validateBaseRelations, evaluatePokeEdgePrerequisite } from '../rules/pokemon-engine.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const ruleset='all-provided-material';

// Attack Conflict must remove its hard-bound offensive Stat from Base Relations.
const base={hp:5,attack:8,defense:6,special_attack:4,special_defense:4,speed:4};
const finalStats={hp:5,attack:8,defense:10,special_attack:4,special_defense:4,speed:4};
assert(validateBaseRelations(base,finalStats,{exemptStats:['hp']}).some(v=>v.higher==='attack'&&v.lower==='defense'));
assert.equal(validateBaseRelations(base,finalStats,{exemptStats:['hp','attack']}).length,0);

const definitions=new DefinitionRepository(join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'));
const underdogEdge=definitions.getResolved({rulesetId:ruleset,kind:'poke_edges',id:'underdogs-strength'});
const starly=definitions.getResolved({rulesetId:ruleset,kind:'species',id:'starly'});
const ceruledge=definitions.getResolved({rulesetId:ruleset,kind:'species',id:'ceruledge'});
assert(underdogEdge&&starly&&ceruledge);
assert.equal(evaluatePokeEdgePrerequisite(underdogEdge,{level:30,capabilities:ceruledge.capabilities}).valid,false);
assert.equal(evaluatePokeEdgePrerequisite(underdogEdge,{level:30,capabilities:starly.capabilities}).valid,true);
definitions.close();

const port=4198;
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let stderr=''; child.stderr.on('data',d=>stderr+=d.toString());
try{
  let health=null;
  for(let i=0;i<40;i++){
    try{const r=await fetch(`http://127.0.0.1:${port}/api/health`); if(r.ok){health=await r.json();break;}}catch{}
    await sleep(100);
  }
  assert(health,`server failed to start: ${stderr}`);
  assert.equal(health.version,'1.1.0');
  const pokemon={id:'v11-ceruledge',name:'Conflict Test',species:'Ceruledge',level:30,types:['fire','ghost'],hp:100,maxHp:100,details:{speciesDefinitionId:'ceruledge',linkedRulesetId:ruleset,nature:'Hardy',tutorPointsEarned:7,tutorPointsSpent:0,tutorPointsRemaining:7,moveLimitEffective:6,tutorMovePoolLimit:3,abilities:['Flash Fire'],moves:[{id:'shadow-claw',name:'Shadow Claw',source:'tutor',learnedAt:30,countsAsNatural:false}],pokeEdges:[],statAllocations:{hp:5,attack:10,defense:5,special_attack:5,special_defense:5,speed:10}}};

  const optsRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/training-options`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon,rulesetId:ruleset})});
  const opts=await optsRes.json(); assert(optsRes.ok,JSON.stringify(opts));
  const blockedUnderdog=opts.edges.find(e=>e.id==='underdogs-strength');
  assert.equal(blockedUnderdog.prerequisite.valid,false);
  assert.equal(blockedUnderdog.isUnderdog,false);

  const attackConflictRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/training-action-preview`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'acquire_edge',pokemon,edgeId:'attack-conflict',targetStat:'attack',rulesetId:ruleset})});
  const attackConflict=await attackConflictRes.json(); assert(attackConflict.valid,JSON.stringify(attackConflict));
  assert.equal(attackConflict.resultRecord.targetStat,'attack');
  assert.deepEqual(attackConflict.details.baseRelationExemptStats.sort(),['attack','hp']);

  const noTargetRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/training-action-preview`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'acquire_edge',pokemon,edgeId:'attack-conflict',rulesetId:ruleset})});
  const noTarget=await noTargetRes.json(); assert.equal(noTarget.valid,false);
  assert(noTarget.errors.some(e=>e.includes('Attack Conflict must be permanently linked')));

  const withConflict={...pokemon,details:attackConflict.details};
  const restatRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/restat-preview`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:withConflict,allocations:withConflict.details.statAllocations,rulesetId:ruleset})});
  const restat=await restatRes.json(); assert(restatRes.ok,JSON.stringify(restat));
  assert(restat.preview.baseRelations.exemptStats.includes('attack'));
  assert(restat.preview.baseRelations.exemptStats.includes('hp'));

  const refRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/reference-data`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:withConflict,rulesetId:ruleset})});
  const ref=await refRes.json(); assert(refRes.ok,JSON.stringify(ref));
  assert.equal(ref.typeProfile.length,18);
  assert(ref.moves.some(x=>x.record.source==='tutor'));

  const starlyPokemon={...pokemon,id:'v11-starly',species:'Starly',level:30,types:['normal','flying'],details:{...pokemon.details,speciesDefinitionId:'starly',pokeEdges:[]}};
  const stOptsRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/training-options`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:starlyPokemon,rulesetId:ruleset})});
  const stOpts=await stOptsRes.json(); const stStrength=stOpts.edges.find(e=>e.id==='underdogs-strength');
  assert.equal(stStrength.isUnderdog,true); assert.equal(stStrength.prerequisite.valid,true);

  const app=readFileSync(join(root,'static-preview','app.js'),'utf8');
  for(const token of ['setCreatureTab','Redistribute Stats','Non-natural TM/Tutor pool','Bind to Attack','Bind to Sp. Attack','Learned through ${esc(src.longLabel)}']) assert(app.includes(token),`missing UI token: ${token}`);
  console.log('PTU Companion v1.1 verification: OK');
  console.log('Attack Conflict hard binding + Base Relations exemption: passed');
  console.log('Underdog Capability gating: passed');
  console.log('Tutor provenance + 3-slot non-natural pool UI: present');
  console.log('Creature tabs + Type profile endpoint: passed');
  console.log('Permanent Stat redistribution preview: passed');
} finally { child.kill('SIGTERM'); }
