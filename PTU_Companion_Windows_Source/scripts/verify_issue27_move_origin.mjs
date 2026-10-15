import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {setTimeout as delay} from 'node:timers/promises';
const root=dirname(dirname(fileURLToPath(import.meta.url))),repo=dirname(root),port=42127,base='http://127.0.0.1:'+port;
const dataDir=await mkdtemp(join(tmpdir(),'ptu-issue27-'));
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_PORT:String(port),PTU_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
let stderr='';child.stderr.on('data',chunk=>stderr+=chunk.toString());
const storage={m:new Map(),getItem(k){return this.m.get(k)||null;},setItem(k,v){this.m.set(k,String(v));},removeItem(k){this.m.delete(k);}};
async function call(api,path,body,method=body?'POST':'GET'){
 const response=await api(path,{method,headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
 const data=await response.json();assert(response.ok,path+': '+(data.error||response.status));return data;
}
try{
 let ready=false;for(let i=0;i<100&&!ready;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch{}if(!ready)await delay(100);}assert(ready,'Windows API failed to start: '+stderr);
 globalThis.window={fetch:globalThis.fetch};globalThis.localStorage=storage;globalThis.location={href:'https://app.local/index.html'};
 vm.runInThisContext(await readFile(join(repo,'PTU_Companion_Android_Tauri/www/mobile-data.js'),'utf8'));
 const {mobileFetch}=await import('../../PTU_Companion_Android_Tauri/www/mobile-api.mjs');
 const apis=[['Windows',(path,init)=>fetch(base+path,init)],['Android',mobileFetch]];
 for(const [platform,api] of apis){
  const rulesetId='all-provided-material';
  const pokemon={id:'issue27-'+platform,name:'Move QA',species:'Zoroark',level:60,types:['dark'],hp:100,maxHp:100,injuries:0,ball:'Poké Ball',loyalty:3,storage:false,rosterIds:[],combatStages:{},details:{speciesDefinitionId:'zoroark',linkedRulesetId:rulesetId,abilities:[],pokeEdges:[],moves:[],moveLimitEffective:6,tutorPointsEarned:8,tutorPointsSpent:1,tutorPointsRemaining:7,trainingHistory:[]}};
  const options=await call(api,'/api/pokemon/training-options',{pokemon,rulesetId});
  assert(options.naturalMoves&&options.naturalMoves.length,platform+': natural Level-Up origins');
  const natural=options.naturalMoves[0];
  async function edit(p,fields){return call(api,'/api/pokemon/training-action-preview',{action:'edit_move',pokemon:p,moveIndex:0,moveId:natural.id,rulesetId,...fields});}
  let current=structuredClone(pokemon);current.details.moves=[{id:natural.id,name:natural.name,source:'tm',cost:1,countsAsNatural:false,learnedAt:60}];
  let result=await edit(current,{newSource:'current_species',previousSource:'tm',previousCost:1});
  assert(result.valid,result.errors.join('; '));assert.equal(result.cost,-1);assert.equal(result.details.moves[0].source,'current_species');assert.equal(result.details.tutorPointsSpent,0);assert.equal(result.details.tutorPointsRemaining,8);assert.equal(result.details.trainingHistory.filter(x=>x.action==='edit_move').length,1);
  current.details=result.details;const reloaded=JSON.parse(JSON.stringify(current));assert.equal(reloaded.details.moves[0].source,'current_species',platform+': origin survives JSON serialization');assert.equal(reloaded.details.tutorPointsSpent,0,platform+': refund survives JSON serialization');assert.equal(reloaded.level,60);
  const save=await call(api,'/api/state',undefined,'GET');
  save.state.pokemon=(save.state.pokemon||[]).filter(entry=>entry.id!==current.id);save.state.pokemon.push(reloaded);save.state.selectedPokemonId=current.id;
  await call(api,'/api/state',{state:save.state},'PUT');
  const loaded=await call(api,'/api/state',undefined,'GET'),persisted=loaded.state.pokemon.find(entry=>entry.id===current.id);
  assert.equal(persisted?.details.moves[0].source,'current_species',platform+': move origin survives application persistence');assert.equal(persisted?.details.tutorPointsSpent,0,platform+': refund survives application persistence');assert.equal(persisted?.level,60,platform+': level remains unchanged');assert.equal(persisted?.loyalty,3,platform+': unrelated Pokémon data remains unchanged');
  const preEvolution=options.naturalMoves.find(move=>move.source==='pre_evolution');
  assert(preEvolution,platform+': pre-evolution natural Level-Up origin available');
  current=structuredClone(pokemon);current.details.moves=[{id:preEvolution.id,name:preEvolution.name,source:'tm',cost:1,countsAsNatural:false}];
  result=await call(api,'/api/pokemon/training-action-preview',{action:'edit_move',pokemon:current,moveIndex:0,moveId:preEvolution.id,newSource:'pre_evolution',newSourceSpeciesId:preEvolution.sourceSpeciesId,rulesetId});
  assert(result.valid,result.errors.join('; '));assert.equal(result.details.moves[0].source,'pre_evolution');assert.equal(result.details.moves[0].sourceSpeciesId,preEvolution.sourceSpeciesId);assert.equal(result.details.tutorPointsSpent,0,platform+': pre-evolution natural source refunds TM cost');
  const tm=options.moveTeaching.tm_hm[0];assert(tm,platform+': valid TM source');
  current=structuredClone(pokemon);current.details.tutorPointsEarned=1;current.details.tutorPointsSpent=1;current.details.moves=[{id:tm.id,name:tm.name,source:'current_species',cost:0,countsAsNatural:true}];
  result=await call(api,'/api/pokemon/training-action-preview',{action:'edit_move',pokemon:current,moveIndex:0,moveId:tm.id,newSource:'tm',previousSource:'current_species',previousCost:0,shortfallMethod:'gm_grant',gmOverride:true,rulesetId});
  assert(result.valid,result.errors.join('; '));assert.equal(result.details.tutorPointsEarned,1+tm.cost);assert.equal(result.details.tutorPointsSpent,1+tm.cost);assert.equal(result.details.tutorPointsRemaining,0);assert.equal(result.details.tutorPointGrants.at(-1).amount,tm.cost);
  current=structuredClone(pokemon);current.details.tutorPointsEarned=1;current.details.tutorPointsSpent=1;current.details.moves=[{id:tm.id,name:tm.name,source:'current_species',cost:0,countsAsNatural:true}];
  result=await call(api,'/api/pokemon/training-action-preview',{action:'edit_move',pokemon:current,moveIndex:0,moveId:tm.id,newSource:'tm',previousSource:'current_species',previousCost:0,shortfallMethod:'negative',rulesetId});
  assert(result.valid,result.errors.join('; '));assert.equal(result.details.tutorPointsRemaining,-tm.cost);assert.equal(result.details.tutorPointGrants,undefined);
  current=structuredClone(pokemon);current.details.tutorPointsSpent=1;current.details.moves=[{id:natural.id,name:natural.name,cost:0,learnedAt:60}];
  result=await edit(current,{newSource:'current_species',previousSource:'tm',previousCost:1,gmOverride:true});
  assert(result.valid,result.errors.join('; '));assert.equal(result.resultRecord.legacyCorrection,true);assert.equal(result.details.trainingHistory.at(-1).record.previousSource,'tm');assert.equal(result.details.trainingHistory.at(-1).record.previousCost,1);
  current=structuredClone(pokemon);current.details.moves=[{id:natural.id,name:natural.name,cost:0,learnedAt:60}];
  result=await edit(current,{newSource:'current_species',previousSource:'tm',previousCost:1,gmOverride:false});
  assert.equal(result.valid,false);assert.equal(current.details.moves[0].source,undefined,'failed correction leaves input unchanged');
  const noTm=options.naturalMoves.find(move=>!options.moveTeaching.tm_hm.some(row=>row.id===move.id));
  if(noTm){current=structuredClone(pokemon);current.details.moves=[{id:noTm.id,name:noTm.name,source:'current_species',cost:0}];result=await call(api,'/api/pokemon/training-action-preview',{action:'edit_move',pokemon:current,moveIndex:0,moveId:noTm.id,newSource:'tm',previousSource:'current_species',previousCost:0,rulesetId});assert.equal(result.valid,false);assert(result.errors.some(error=>error.includes('not compatible')));}
  console.log(platform+': Ruleset validation, current/pre-evolution sources, refund, GM Grant, negative balance, legacy correction and persisted save verified');
 }
 const serverSource=await readFile(join(root,'server.mjs'),'utf8'),mobileApi=await readFile(join(repo,'PTU_Companion_Android_Tauri/www/mobile-api.mjs'),'utf8'),runtime=await readFile(join(repo,'PTU_Companion_Android_Tauri/www/mobile-runtime.js'),'utf8');
 for(const [name,source] of [['Windows',serverSource],['Android API',mobileApi],['Android runtime',runtime]]){assert(source.includes("payload.action==='edit_move'"),name+': edit action missing');assert(source.includes("shortfallMethod==='gm_grant'"),name+': GM grant ledger missing');}
 const UIs=await Promise.all(['static-preview/app.js','../PTU_Companion_Android_Tauri/www/app.js'].map(path=>readFile(join(root,path),'utf8')));
 const extract=s=>{const start=s.indexOf('async function editPokemonMoveOrigin(');return s.slice(start,s.indexOf('async function learnPokemonTrainingMove(',start));};
 assert.equal(extract(UIs[0]),extract(UIs[1]),'Windows/Android edit UI must match');
}finally{if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}await rm(dataDir,{recursive:true,force:true});}
console.log('Issue #27 Move-origin editing verified for Windows and Android.');
