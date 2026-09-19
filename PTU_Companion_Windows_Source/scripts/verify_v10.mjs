import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { DefinitionRepository } from '../definitions/repository.mjs';
import { parseTutorPointCost, evaluatePokeEdgePrerequisite, moveTrainingPoolUsage, tutorRestrictionForMove } from '../rules/pokemon-engine.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const definitions=new DefinitionRepository(join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'));
const ruleset='all-provided-material';

assert.equal(parseTutorPointCost('1 Tutor Point'),1);
assert.equal(parseTutorPointCost('3 Tutor Points'),3);
assert.equal(moveTrainingPoolUsage([{source:'tm'},{source:'tutor'},{source:'natural_tutor',countsAsNatural:true}]),2);
assert.equal(tutorRestrictionForMove({level:20,move:{frequency:'At-Will',damageBase:8},september2015Enabled:true}).valid,true);
assert.equal(tutorRestrictionForMove({level:20,move:{frequency:'Scene x2',damageBase:10},september2015Enabled:true}).valid,false);

const advanced=definitions.getResolved({rulesetId:ruleset,kind:'poke_edges',id:'advanced-mobility'});
assert(advanced);
const prereq=evaluatePokeEdgePrerequisite(advanced,{level:20,capabilities:[],abilities:[]});
assert.equal(prereq.valid,true);
assert.equal(parseTutorPointCost(advanced.raw?.cost_text||''),1);

const sableye=definitions.getResolved({rulesetId:ruleset,kind:'species',id:'sableye'});
assert(sableye);
assert(sableye.tmMoves.some(m=>m.move_id==='shadow-claw'));
assert(sableye.tutorMoves.some(m=>m.move_id==='fire-punch'));

definitions.close();

const port=4197;
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let stderr=''; child.stderr.on('data',d=>stderr+=d.toString());
try{
  let health=null;
  for(let i=0;i<30;i++){
    try{const r=await fetch(`http://127.0.0.1:${port}/api/health`); if(r.ok){health=await r.json();break;}}catch{}
    await sleep(100);
  }
  assert(health,`server failed to start: ${stderr}`);
  assert.equal(health.version,'1.0.0');
  const pokemon={id:'v10-sableye',name:'Tutor Test',species:'Sableye',level:20,types:['dark','ghost'],details:{speciesDefinitionId:'sableye',linkedRulesetId:ruleset,tutorPointsEarned:5,tutorPointsSpent:0,tutorPointsRemaining:5,moveLimitEffective:6,tutorMovePoolLimit:3,abilities:['Keen Eye','Frighten'],moves:[],pokeEdges:[]}};
  const optsRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/training-options`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon,rulesetId:ruleset})});
  const opts=await optsRes.json(); assert(optsRes.ok,JSON.stringify(opts));
  assert.equal(opts.tutorPoints.remaining,5);
  assert.equal(opts.tutorMovePool.limit,3);
  assert(opts.edges.some(e=>e.id==='advanced-mobility'&&e.prerequisite.valid===true));
  assert(opts.moveTeaching.tm_hm.some(m=>m.id==='shadow-claw'&&m.countsAsNatural===true));
  assert(opts.moveTeaching.tutor.some(m=>m.id==='fire-punch'));

  const edgeRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/training-action-preview`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'acquire_edge',pokemon,edgeId:'advanced-mobility',targetNote:'Overland',rulesetId:ruleset})});
  const edge=await edgeRes.json(); assert(edge.valid,JSON.stringify(edge));
  assert.equal(edge.tutorPoints.remaining,4);
  assert.equal(edge.resultRecord.id,'advanced-mobility');

  const moveRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/training-action-preview`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'learn_move',pokemon,method:'tm_hm',moveId:'shadow-claw',rulesetId:ruleset})});
  const move=await moveRes.json(); assert(move.valid,JSON.stringify(move));
  assert.equal(move.resultRecord.source,'tm');
  assert.equal(move.resultRecord.countsAsNatural,true);
  assert.equal(move.tutorPoints.remaining,4);

  const blockedTutorRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/training-action-preview`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'learn_move',pokemon,method:'tutor',moveId:'foul-play',rulesetId:ruleset})});
  const blockedTutor=await blockedTutorRes.json();
  assert.equal(blockedTutor.valid,false);
  assert(blockedTutor.errors.some(x=>x.includes('September 2015 tutoring')));

  const app=readFileSync(join(root,'static-preview','app.js'),'utf8');
  assert(app.includes('Advanced Training'));
  assert(app.includes('pokemonTrainingScreen'));
  assert(app.includes('/api/pokemon/training-action-preview'));
  console.log('PTU Companion v1.0 verification: OK');
  console.log(`Poké Edge catalog: ${opts.edges.length} resolved entries`);
  console.log(`Sableye TM/HM options: ${opts.moveTeaching.tm_hm.length}`);
  console.log(`Sableye Tutor options: ${opts.moveTeaching.tutor.length}`);
  console.log('Tutor Point spending + Move Pool validation: passed');
  console.log('Advanced Mobility purchase preview: passed');
  console.log('TM Shadow Claw natural-pool handling: passed');
  console.log('September 2015 tutor restrictions: passed');
} finally {
  child.kill('SIGTERM');
}
