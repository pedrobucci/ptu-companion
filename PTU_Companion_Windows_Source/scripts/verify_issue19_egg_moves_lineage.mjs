import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const repo=dirname(root),port=42129,base=`http://127.0.0.1:${port}`;
const dataDir=await mkdtemp(join(tmpdir(),'ptu-issue19-'));
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_PORT:String(port),PTU_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
let stderr='';child.stderr.on('data',chunk=>stderr+=chunk.toString());
async function request(path,body){const response=await fetch(`${base}${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await response.json();assert(response.ok,`${path}: ${data.error||response.status}`);return data;}
try{
  let ready=false;for(let i=0;i<100&&!ready;i++){try{ready=(await fetch(`${base}/api/health`)).ok;}catch{}if(!ready)await delay(100);}assert(ready,`Windows API failed to start: ${stderr}`);
  const rulesetId='all-provided-material';
  const pokemon={id:'verify-issue19-zoroark',name:'Zoroark QA',species:'Zoroark',level:60,types:['dark'],hp:100,maxHp:100,injuries:0,ball:'Poké Ball',storage:false,loyalty:4,rosterIds:[],combatStages:{},details:{speciesDefinitionId:'zoroark',linkedRulesetId:rulesetId,abilities:[],pokeEdges:[],moves:[],moveLimitEffective:6,tutorPointsEarned:8,tutorPointsSpent:0,tutorPointsRemaining:8}};
  const options=await request('/api/pokemon/training-options',{pokemon,rulesetId});
  const eggMoves=options.moveTeaching.egg_tutor.map(move=>move.id);
  assert(eggMoves.includes('memento'),'Zoroark should inherit Zorua Egg Move Memento');
  assert.equal(new Set(eggMoves).size,eggMoves.length,'Egg Moves from the evolutionary line should be deduplicated');
  assert.equal(options.eggTutorUsed,false);
  const learned=await request('/api/pokemon/training-action-preview',{action:'learn_move',pokemon,method:'egg_tutor',moveId:'memento',rulesetId});
  assert.equal(learned.valid,true,learned.errors.join('; '));
  assert.equal(learned.resultRecord.source,'egg_tutor');
  const second=await request('/api/pokemon/training-action-preview',{action:'learn_move',pokemon:{...pokemon,details:learned.details},method:'egg_tutor',moveId:'counter',rulesetId});
  assert.equal(second.valid,false,'second Egg Tutor use must be rejected');
  assert(second.errors.some(error=>error.includes('only be targeted by Egg Tutor once')),'second-use rejection should explain the PTU limit');
  const windows=await readFile(join(root,'server.mjs'),'utf8'),android=await readFile(join(repo,'PTU_Companion_Android_Tauri','www','mobile-api.mjs'),'utf8');
  for(const [name,source] of [['Windows',windows],['Android',android]]){
    assert(source.includes('evolutionLineEggMoves'),'lineage move resolver missing from '+name);
    assert(source.includes('A Pokémon can only be targeted by Egg Tutor once.'),'one-time rule missing from '+name);
    assert(source.includes("method==='egg_tutor'?eggTutorMoves"),'Egg Tutor preview does not use inherited list in '+name);
  }
  console.log('Issue #19 verified: Zoroark inherits Memento, duplicate moves are removed, first Egg Tutor is accepted, second is blocked, and Windows/Android rule paths match.');
}finally{child.kill();await rm(dataDir,{recursive:true,force:true});}
