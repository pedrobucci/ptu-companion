import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const repo=dirname(root);
const port=42125, base=`http://127.0.0.1:${port}`;
const dataDir=await mkdtemp(join(tmpdir(),'ptu-issue25-'));
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_PORT:String(port),PTU_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
let stderr=''; child.stderr.on('data',chunk=>stderr+=chunk.toString());
async function request(path,body,method='POST'){
  const response=await fetch(`${base}${path}`,{method,headers:{'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json(); assert(response.ok,`${path}: ${data.error||response.status}`); return data;
}
try{
  let ready=false;
  for(let i=0;i<80&&!ready;i++){try{ready=(await fetch(`${base}/api/health`)).ok;}catch{} if(!ready)await delay(100);}
  assert(ready,`Windows API failed to start: ${stderr}`);
  const rulesetId='all-provided-material';
  const known={id:'verify-issue25-known',name:'Fletchling QA',species:'Fletchling',level:60,types:['normal','flying'],hp:100,maxHp:100,injuries:0,ball:'Poké Ball',storage:false,loyalty:4,rosterIds:[],combatStages:{},details:{speciesDefinitionId:'fletchling',linkedRulesetId:rulesetId,abilities:['Gale Wings'],abilityRecords:[{name:'Gale Wings',sourceKind:'species_starting'}],pokeEdges:[],moves:[{id:'quick-attack',name:'Quick Attack',source:'natural',learnedAt:1},{id:'tackle',name:'Tackle',source:'natural',learnedAt:1},{id:'growl',name:'Growl',source:'natural',learnedAt:1},{id:'peck',name:'Peck',source:'natural',learnedAt:1},{id:'flame-charge',name:'Flame Charge',source:'tm',learnedAt:40},{id:'roost',name:'Roost',source:'tm',learnedAt:40}],moveLimitEffective:6,tutorPointsEarned:5,tutorPointsSpent:0,tutorPointsRemaining:5}};
  const options=await request('/api/pokemon/training-options',{pokemon:known,rulesetId});
  const edge=options.edges.find(item=>item.id==='advanced-connection');
  assert(edge,'Advanced Connection should be available');
  assert.equal(edge.targetRequired,true); assert.equal(edge.targetKind,'ability');
  assert(edge.targetOptions.some(option=>option.id==='gale-wings'&&option.connectionMoveId==='quick-attack'),'Gale Wings should target Quick Attack');
  assert.equal(options.moveSlots.used,6);
  const invalid=await request('/api/pokemon/training-action-preview',{action:'acquire_edge',pokemon:known,edgeId:'advanced-connection',targetId:'not-connected',rulesetId});
  assert.equal(invalid.valid,false,'the API must reject an Ability without a Connection target');
  const acquired=await request('/api/pokemon/training-action-preview',{action:'acquire_edge',pokemon:known,edgeId:'advanced-connection',targetId:'gale-wings',rulesetId});
  assert.equal(acquired.valid,true,acquired.errors?.join('; '));
  const quickAttack=acquired.details.moves.find(move=>move.id==='quick-attack');
  assert.equal(quickAttack.source,'natural'); assert(quickAttack.connectionGrant?.moveSlotExempt);
  assert.equal(acquired.details.moves.length,6,'the original Move record is preserved');
  assert.equal(acquired.details.moves.filter(move=>!move.connectionGrant?.moveSlotExempt).length,5);
  const persistedPokemon={...known,details:acquired.details};
  const saved=await request('/api/state',undefined,'GET'); saved.state.pokemon=[persistedPokemon]; saved.state.selectedPokemonId=known.id;
  await request('/api/state',{state:saved.state},'PUT');
  const loaded=await request('/api/state',undefined,'GET');
  const persisted=loaded.state.pokemon.find(candidate=>candidate.id===known.id);
  assert(persisted.details.moves.find(move=>move.id==='quick-attack')?.connectionGrant?.moveSlotExempt,'connection and exempt slot must survive SQLite persistence');
  const refunded=await request('/api/pokemon/training-action-preview',{action:'refund_edge',pokemon:persisted,edgeInstanceId:persisted.details.pokeEdges[0].instanceId,rulesetId});
  assert.equal(refunded.valid,true,refunded.errors?.join('; '));
  assert.equal(refunded.details.moves.length,6); assert.equal(refunded.details.moves.find(move=>move.id==='quick-attack')?.source,'natural');
  assert(!refunded.details.moves.find(move=>move.id==='quick-attack')?.connectionGrant);
  assert.equal(refunded.details.tutorPointsSpent,0);

  const granted={...known,id:'verify-issue25-granted',details:{...known.details,moves:known.details.moves.filter(move=>move.id!=='quick-attack')}};
  const grantedResult=await request('/api/pokemon/training-action-preview',{action:'acquire_edge',pokemon:granted,edgeId:'advanced-connection',targetId:'gale-wings',rulesetId});
  assert.equal(grantedResult.valid,true,grantedResult.errors?.join('; '));
  assert(grantedResult.details.moves.some(move=>move.id==='quick-attack'&&move.source==='advanced_connection'));
  assert.equal(grantedResult.details.moves.filter(move=>!move.connectionGrant?.moveSlotExempt).length,5);
  const lostAbility=await request('/api/pokemon/training-action-preview',{action:'revalidate_connections',pokemon:{...granted,details:{...grantedResult.details,abilities:[],abilityRecords:[]}},rulesetId});
  assert.equal(lostAbility.valid,true); assert.equal(lostAbility.resultRecord.refundedTutorPoints,1);
  assert(!lostAbility.details.pokeEdges.some(item=>item.id==='advanced-connection'));
  assert(!lostAbility.details.moves.some(move=>move.id==='quick-attack'));
  assert.equal(lostAbility.details.tutorPointsSpent,0);
  const androidApi=await readFile(join(repo,'PTU_Companion_Android_Tauri','www','mobile-api.mjs'),'utf8');
  const windowsUi=await readFile(join(root,'static-preview','app.js'),'utf8');
  const androidUi=await readFile(join(repo,'PTU_Companion_Android_Tauri','www','app.js'),'utf8');
  assert.match(androidApi,/edgeId==='advanced-connection'[\s\S]*?Connection\\s\*\[\-–—:\]/,'Android API should resolve an Ability declared Connection');
  for(const [label,source] of [['Windows',windowsUi],['Android',androidUi]]){
    assert.match(source,/moveSlotExempt/ ,`${label} UI should display and respect free connection slots`);
    assert.match(source,/revalidate_connections/ ,`${label} UI should revalidate Connections after form changes`);
  }
  console.log('Issue #25 verified: structured Ability choice, Move slot exemption, existing Move preservation, new Move grant, SQLite persistence, refund and Ability-loss cleanup with Windows/Android parity.');
}finally{
  child.kill('SIGTERM'); if(child.exitCode===null)await new Promise(resolve=>child.once('exit',resolve));
  await rm(dataDir,{recursive:true,force:true});
}
