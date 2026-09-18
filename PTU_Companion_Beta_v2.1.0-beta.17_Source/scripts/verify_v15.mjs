import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

const port=4195;
const base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PTU_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let stderr=''; child.stderr.on('data',d=>stderr+=d);
async function wait(){for(let i=0;i<50;i++){try{const r=await fetch(`${base}/api/health`);if(r.ok)return;}catch{} await delay(100);}throw new Error(`server did not start: ${stderr}`)}
async function post(path,body){const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw new Error(`${path}: ${j.error||r.status}`);return j;}
const rulesetId='all-provided-material';
const pokemon={id:'verify-v15',name:'Ceruledge QA',species:'Ceruledge',level:30,types:['fire','ghost'],hp:100,maxHp:100,heldItem:null,details:{
  speciesDefinitionId:'ceruledge',linkedRulesetId:rulesetId,
  abilities:['Flash Fire','Defiant'],
  abilityRecords:[
    {name:'Flash Fire',sourceKind:'species_starting',sourceLabel:'Starting Ability',unlockLevel:1},
    {name:'Defiant',sourceKind:'level_choice',sourceLabel:'Level 20 Ability',unlockLevel:20}
  ],
  grantedAbilities:[],
  pokeEdges:[{id:'mixed-power',name:'Mixed Power',cost:2,sourceVersionId:'poke_edge:mixed-power@sep2015-adapter'}],
  tutorPointsEarned:12,tutorPointsSpent:2,tutorPointsRemaining:10,
  statAllocations:{hp:5,attack:10,defense:5,special_attack:10,special_defense:5,speed:5},
  finalStats:{hp:13,attack:20,defense:12,special_attack:15,special_defense:13,speed:14},
  moves:[
    {id:'will-o-wisp',name:'Will-O-Wisp',source:'level_up',countsAsNatural:true},
    {id:'shadow-claw',name:'Shadow Claw',source:'level_up',countsAsNatural:true}
  ],moveLimitBase:6,moveLimitModifier:0,moveLimitEffective:6,tutorMovePoolLimit:3
}};
try{
  await wait();
  const health=await (await fetch(`${base}/api/health`)).json(); assert.equal(health.version,'1.5.0');
  const ref=await post('/api/pokemon/reference-data',{pokemon,rulesetId});
  const abilityNames=ref.abilities.map(a=>a.name);
  assert(abilityNames.includes('Flash Fire')); assert(abilityNames.includes('Defiant')); assert(abilityNames.includes('Twisted Power'));
  assert(!pokemon.heldItem,'QA must not rely on held item refresh');

  const opts=await post('/api/pokemon/training-options',{pokemon,rulesetId});
  const adv=opts.edges.find(e=>e.id==='advanced-mobility');
  const cap=opts.edges.find(e=>e.id==='capability-training');
  const acc=opts.edges.find(e=>e.id==='accuracy-training');
  assert(adv?.targetOptions.some(o=>o.id==='overland'));
  assert(cap?.targetOptions.some(o=>o.id==='power') && cap?.targetOptions.some(o=>o.id==='high-jump') && cap?.targetOptions.some(o=>o.id==='long-jump'));
  assert(acc?.targetOptions.some(o=>o.id==='will-o-wisp'));
  assert(!acc?.targetOptions.some(o=>o.id==='shadow-claw'));

  const advBuy=await post('/api/pokemon/training-action-preview',{action:'acquire_edge',pokemon,edgeId:'advanced-mobility',targetId:'overland',rulesetId});
  assert.equal(advBuy.valid,true,advBuy.errors?.join('; '));
  assert.equal(advBuy.resultRecord.targetId,'overland');
  let p2={...pokemon,details:advBuy.details};
  const advRef=await post('/api/pokemon/reference-data',{pokemon:p2,rulesetId});
  const overland=advRef.resolvedCreature.capabilities.find(c=>c.capability_id==='overland'); assert.equal(overland.value,8);

  const capBuy=await post('/api/pokemon/training-action-preview',{action:'acquire_edge',pokemon:p2,edgeId:'capability-training',targetId:'high-jump',rulesetId});
  assert.equal(capBuy.valid,true,capBuy.errors?.join('; ')); p2={...p2,details:capBuy.details};
  const capRef=await post('/api/pokemon/reference-data',{pokemon:p2,rulesetId});
  const jump=capRef.resolvedCreature.capabilities.find(c=>c.kind==='jump'); assert.equal(jump.high,2);

  const accBuy=await post('/api/pokemon/training-action-preview',{action:'acquire_edge',pokemon:p2,edgeId:'accuracy-training',targetId:'will-o-wisp',rulesetId});
  assert.equal(accBuy.valid,true,accBuy.errors?.join('; ')); p2={...p2,details:accBuy.details};
  const accRef=await post('/api/pokemon/reference-data',{pokemon:p2,rulesetId});
  const wow=accRef.moves.find(m=>m.record.id==='will-o-wisp'); assert.equal(wow.definition.ac,5); assert.equal(wow.effectiveAc,4); assert.equal(wow.accuracyTrainingRanks,1);

  const edgeIndex=p2.details.pokeEdges.findIndex(e=>e.id==='accuracy-training');
  const spentBefore=p2.details.tutorPointsSpent;
  const refund=await post('/api/pokemon/training-action-preview',{action:'refund_edge',pokemon:p2,edgeIndex,rulesetId});
  assert.equal(refund.valid,true,refund.errors?.join('; '));
  assert.equal(refund.details.tutorPointsSpent,spentBefore-1);
  assert(!refund.details.pokeEdges.some(e=>e.id==='accuracy-training'));

  console.log('PTU Companion v1.5 verification: OK');
  console.log('Abilities without Held Item: Flash Fire + Defiant + Twisted Power');
  console.log('Advanced Mobility target list + Overland modifier: passed');
  console.log('Capability Training target list + High Jump modifier: passed');
  console.log('Accuracy Training valid Move list + AC modifier: passed');
  console.log('Poké Edge correction refund: passed');
} finally {
  child.kill('SIGTERM');
}
