import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const repo=dirname(root);
const port=42126;
const base=`http://127.0.0.1:${port}`;
const dataDir=await mkdtemp(join(tmpdir(),'ptu-issue26-'));
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_PORT:String(port),PTU_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
let stderr=''; child.stderr.on('data',chunk=>stderr+=chunk.toString());
async function waitForServer(){
  for(let i=0;i<80;i++){
    try{const response=await fetch(`${base}/api/health`);if(response.ok)return;}
    catch{}
    await delay(100);
  }
  throw new Error(`Windows API failed to start: ${stderr}`);
}
async function request(path,body,method='POST'){
  const response=await fetch(`${base}${path}`,{method,headers:{'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();
  assert(response.ok,`${path}: ${data.error||response.status}`);
  return data;
}

try{
  await waitForServer();
  const rulesetId='all-provided-material';
  const pokemon={id:'verify-issue26',name:'Absol QA',species:'Absol',level:60,types:['dark'],hp:100,maxHp:100,injuries:0,ball:'Poké Ball',heldItem:'Absolite',storage:false,loyalty:4,rosterIds:[],combatStages:{},details:{
    speciesDefinitionId:'absol',linkedRulesetId:rulesetId,heldItemDefinitionId:'mega-stone-absol',
    formState:{baseFormId:'base',activeFormId:'mega'},manualFormApprovals:['mega-evolution-absol-mega'],
    abilities:['Pressure','Justified','Omen'],
    abilityRecords:[
      {name:'Pressure',sourceKind:'species_starting'},
      {name:'Justified',sourceKind:'level_choice'},
      {name:'Omen',sourceKind:'level_choice'}
    ],
    grantedAbilities:[],pokeEdges:[],moves:[],
    tutorPointsEarned:10,tutorPointsSpent:0,tutorPointsRemaining:10
  }};

  const options=await request('/api/pokemon/training-options',{pokemon,rulesetId});
  const edge=options.edges.find(candidate=>candidate.id==='ability-mastery');
  assert(edge,'Ability Mastery should be listed from the active Ruleset');
  assert.equal(edge.targetRequired,true);
  assert.equal(edge.targetKind,'ability');
  assert(edge.targetOptions.some(option=>option.id==='super-luck'));
  assert(edge.targetOptions.some(option=>option.id==='forewarn'));
  assert(!edge.targetOptions.some(option=>option.id==='pressure'));
  assert(!edge.targetOptions.some(option=>option.id==='magic-bounce'),'Mega-only Abilities must not be selectable');

  const invalid=await request('/api/pokemon/training-action-preview',{action:'acquire_edge',pokemon,edgeId:'ability-mastery',targetId:'magic-bounce',rulesetId});
  assert.equal(invalid.valid,false,'the API must reject a target that is not in the base species Ability pool');
  assert.equal(invalid.details.tutorPointsSpent,0,'rejected choices must not spend Tutor Points');

  const acquired=await request('/api/pokemon/training-action-preview',{action:'acquire_edge',pokemon,edgeId:'ability-mastery',targetId:'super-luck',rulesetId});
  assert.equal(acquired.valid,true,acquired.errors?.join('; '));
  assert.equal(acquired.details.tutorPointsSpent,3);
  assert(acquired.details.grantedAbilities.some(ability=>ability.name==='Super Luck'&&ability.sourceId==='ability-mastery'));
  const trained={...pokemon,details:acquired.details};

  const saved=await request('/api/state',undefined,'GET');
  saved.state.pokemon=[trained];
  saved.state.selectedPokemonId=trained.id;
  await request('/api/state',{state:saved.state},'PUT');
  const loaded=await request('/api/state',undefined,'GET');
  const persisted=loaded.state.pokemon.find(candidate=>candidate.id===trained.id);
  assert(persisted?.details.grantedAbilities.some(ability=>ability.name==='Super Luck'&&ability.sourceId==='ability-mastery'),'the granted Ability must survive SQLite persistence');

  const reference=await request('/api/pokemon/reference-data',{pokemon:persisted,rulesetId});
  assert(reference.abilities.some(ability=>ability.name==='Super Luck'&&ability.grantSource?.sourceId==='ability-mastery'));
  assert(reference.abilities.some(ability=>ability.name==='Magic Bounce'&&ability.grantSource?.sourceId==='form:absol:mega'),'the active Mega Form should still resolve its own Ability');

  const refund=await request('/api/pokemon/training-action-preview',{action:'refund_edge',pokemon:persisted,edgeInstanceId:persisted.details.pokeEdges[0].instanceId,rulesetId});
  assert.equal(refund.valid,true,refund.errors?.join('; '));
  assert.equal(refund.details.tutorPointsSpent,0);
  assert(!refund.details.grantedAbilities.some(ability=>ability.sourceId==='ability-mastery'));
  const refunded={...persisted,details:refund.details};
  const afterRefund=await request('/api/pokemon/reference-data',{pokemon:refunded,rulesetId});
  assert(!afterRefund.abilities.some(ability=>ability.name==='Super Luck'));

  for(const path of [
    join(root,'static-preview','app.js'),
    join(repo,'PTU_Companion_Android_Tauri','www','app.js')
  ]){
    const source=await readFile(path,'utf8');
    assert.match(source,/e\.targetKind==='ability'\?'Ability'/,`${path} should label the selector as an Ability`);
    assert.match(source,/edge\.targetRequired[\s\S]*?edge-target-\$\{edge\.id\}/,`${path} should submit the selected target through the existing form`);
  }
  const androidApi=await readFile(join(repo,'PTU_Companion_Android_Tauri','www','mobile-api.mjs'),'utf8');
  assert.match(androidApi,/edgeId==='ability-mastery'[\s\S]*?nativeAbilitySlotsForSpecies\(species,pokemon\?\.level\)/,'Android should use the base species Ability pool');
  assert.match(androidApi,/sourceId==='ability-mastery'[\s\S]*?Granted by Ability Mastery/,'Android should preserve Ability Mastery grant provenance');

  console.log('Issue #26 verified: base species choice, API validation, SQLite persistence, active Mega resolution, refund and Windows/Android UI/API parity.');
}finally{
  child.kill('SIGTERM');
  if(child.exitCode===null) await new Promise(resolve=>child.once('exit',resolve));
  await rm(dataDir,{recursive:true,force:true});
}
