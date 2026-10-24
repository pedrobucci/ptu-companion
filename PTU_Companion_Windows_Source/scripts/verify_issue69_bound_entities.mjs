import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import vm from 'node:vm';
import {DefinitionRepository} from '../definitions/repository.mjs';
import {previewBoundEntityAction} from '../rules/bound-entities.mjs';
import {resolveTrainerModel} from '../rules/trainer-engine.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),repo=dirname(root),port=42169,base=`http://127.0.0.1:${port}`;
const definitions=new DefinitionRepository(join(root,'seed/definitions/ptu_seed_v1.0.sqlite3'));
const rulesetId='all-provided-material',deps={rulesetId,getDefinition:q=>definitions.getResolved(q),getDamageBase:db=>definitions.getDamageBase(db),listDefinitions:q=>definitions.listResolved(q)};
const featureIds=['glyph','alarm-runes','explosive-runes','arcanist','soul-investment','mark-of-vision','rune-master'];
const fixture=()=>({id:'entity-trainer',name:'Entity QA',level:30,stats:{hp:10,attack:10,defense:10,spAttack:15,spDefense:10,speed:10},equipment:{},details:{features:featureIds.map(id=>({id})),edges:[],moves:[{id:'hidden-power'}],skillRanks:{'Occult Education':6,Perception:6},currentAp:11}});
const dataDir=await mkdtemp(join(tmpdir(),'ptu-bound-entities-'));
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_PORT:String(port),PTU_DATA_DIR:dataDir},stdio:['ignore','ignore','pipe']});
let stderr='';child.stderr.on('data',b=>stderr+=b);
try{
 let ready=false;for(let i=0;i<100&&!ready;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch{}if(!ready)await delay(100);}assert(ready,stderr);
 globalThis.window={fetch:globalThis.fetch};globalThis.location={href:'https://app.local/index.html'};
 globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
 vm.runInThisContext(await readFile(join(repo,'PTU_Companion_Android_Tauri/www/mobile-data.js'),'utf8'));
 const {mobileFetch}=await import('../../PTU_Companion_Android_Tauri/www/mobile-api.mjs');
 for(const [platform,api] of [['Windows',(path,init)=>fetch(base+path,init)],['Android',mobileFetch]]){
  let trainer=fixture(),inventory=[{id:'cleanse-tag',qty:20}],context={day:1,scene:1,round:1};
  const action=async(action,fields={},error)=>{
   const before=JSON.stringify({trainer,inventory});
   const payload={trainer,inventory,context,rulesetId,action,...fields};
   const response=await api('/api/trainer/bound-entity-preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),result=await response.json();
   assert.equal(JSON.stringify({trainer,inventory}),before,'preview must not mutate saved inputs');
   if(error){assert.equal(response.status,400,JSON.stringify(result));assert.match(result.error,error);return;}
   assert(response.ok,platform+': '+result.error);assert(result.valid);if(result.updatedTrainer){trainer=result.updatedTrainer;inventory=result.updatedInventory;}return result;
  };
  const options=await action('options');assert.equal(options.moves.adept.length,10);assert.equal(options.moves.master.length,9);assert(options.items.length>0);
  const glyphs=[];
  for(let i=0;i<2;i++){
   const r=await action('create',{data:{kind:'glyph',name:'Glyph '+i,swift:i===0}});glyphs.push(r.entityId);
   assert.equal(trainer.details.boundEntities.at(-1).hp,30);assert.equal(trainer.details.currentAp,10-i);
   await action('bind',{entityId:r.entityId,featureIndex:1,data:{trigger:'Enemy enters',explosive:true}});
  }
  assert.equal(inventory[0].qty,18);assert.equal(trainer.details.currentAp,8);
  await action('trigger',{entityId:glyphs[0],data:{distance:31}},/30 meters/);
  await action('trigger',{entityId:glyphs[0],data:{distance:30}});assert.equal(trainer.details.currentAp,7);
  const second=await action('trigger',{entityId:glyphs[1],data:{distance:0}});assert(second.events.some(e=>e.includes('one Glyph already exploded')));assert.equal(trainer.details.currentAp,7);assert(trainer.details.boundEntities[1].alarming);
  await action('trigger',{entityId:glyphs[0],data:{distance:0}},/already triggered/);
  await action('channel',{entityId:glyphs[0]});assert.equal(trainer.details.boundEntityState.glyphFocusId,glyphs[0]);
  await action('damage',{entityId:glyphs[0],data:{amount:30}});assert.equal(trainer.details.currentAp,8);assert.equal(trainer.details.boundEntityState.glyphFocusId,null);assert.deepEqual(trainer.details.features[1].boundTargetIds,[glyphs[1]]);
  context.scene=2;trainer.details.currentAp=0;
  const noAp=await action('trigger',{entityId:glyphs[1],data:{distance:0}});assert(noAp.events.some(e=>e.includes('no available AP')));assert.equal(trainer.details.currentAp,0);
  await action('delete',{entityId:glyphs[1]});assert.equal(trainer.details.currentAp,1);trainer.details.currentAp=11;
  const people=[];
  for(let i=0;i<4;i++)people.push((await action('create',{data:{kind:'external_trainer',name:'Person '+i,willing:i!==3}})).entityId);
  await action('bind',{entityId:people[3],featureIndex:5},/willing Trainer/);
  for(const id of people.slice(0,3))await action('bind',{entityId:id,featureIndex:5});
  await action('consent',{entityId:people[3],data:{willing:true}});
  await action('bind',{entityId:people[3],featureIndex:5},/half Perception/);
  await action('focus',{entityId:people[0]});await action('focus',{entityId:people[1]});assert.equal(trainer.details.boundEntityState.markFocusId,people[1]);
  await action('access',{entityId:people[1],data:{denied:true}});assert.equal(trainer.details.currentAp,8);assert.equal(trainer.details.boundEntityState.markFocusId,null);
  await action('focus',{entityId:people[1]},/sensory access/);
  await action('consent',{entityId:people[1],data:{willing:false}});assert.equal(trainer.details.currentAp,9);
  for(const id of people)await action('delete',{entityId:id});assert.equal(trainer.details.currentAp,11);
  const item=options.items.find(i=>i.id.includes('crude'))||options.items[0];trainer.equipment.mainHand={definitionId:item.id};
  const w=(await action('create',{data:{kind:'weapon',name:'Soul Staff',itemId:item.id,equipmentSlot:'mainHand'}})).entityId;
  await action('create',{data:{kind:'weapon',name:'Duplicate slot',itemId:item.id,equipmentSlot:'mainHand'}},/already has a linked/);
  await action('bind',{entityId:w,featureIndex:4,data:{adeptMoveId:'energy-blast',masterMoveId:'magic-missile'}},/Soul Bonded/);
  await action('soul-bond',{entityId:w});
  await action('bind',{entityId:w,featureIndex:4,data:{adeptMoveId:'tackle',masterMoveId:'magic-missile'}},/one Adept/);
  await action('bind',{entityId:w,featureIndex:4,data:{adeptMoveId:'energy-blast',masterMoveId:'magic-missile'}});assert.equal(trainer.details.currentAp,9);
  let model=resolveTrainerModel({trainer,...deps}),move=model.moves.find(m=>m.id==='energy-blast');assert(move);assert(!move.unavailableReason);assert(move.resolvedDamage.weapon);assert(!move.resolvedDamage.resolvedRange.includes('WR'));
  await action('position',{entityId:w,data:{distance:11,heldByOther:true}});
  model=resolveTrainerModel({trainer,...deps});assert.equal(model.weapons.length,0);assert(model.moves.find(m=>m.id==='energy-blast').unavailableReason);
  const identicalOther=structuredClone(trainer);identicalOther.equipment.offHand={definitionId:item.id};assert.equal(resolveTrainerModel({trainer:identicalOther,...deps}).weapons.length,1,'a distant main-hand entity cannot suppress an identical off-hand weapon');
  await action('beckon',{entityId:w},/10 meters/);
  await action('position',{entityId:w,data:{distance:5,heldByOther:true}});
  await action('beckon',{entityId:w},/Opposed Check/);
  await action('beckon',{entityId:w,data:{opposedCheckSucceeded:true}});assert(resolveTrainerModel({trainer,...deps}).moves.find(m=>m.id==='energy-blast').resolvedDamage.weapon);
  const next=(await action('create',{data:{kind:'weapon',name:'Second Staff',itemId:item.id}})).entityId;
  await action('soul-bond',{entityId:next});assert.equal(trainer.details.currentAp,11);assert(!resolveTrainerModel({trainer,...deps}).moves.some(m=>m.id==='energy-blast'));
  const stateResponse=await api('/api/state'),saved=await stateResponse.json();saved.state.trainer.details=trainer.details;saved.state.trainer.equipment=trainer.equipment;
  const stored=await api('/api/state',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({state:saved.state})});assert(stored.ok,await stored.text());
  const loaded=await (await api('/api/state')).json();assert.deepEqual(loaded.state.trainer.details.boundEntities,trainer.details.boundEntities,platform+': persisted entity state');assert.deepEqual(loaded.state.trainer.details.boundEntityHistory,trainer.details.boundEntityHistory);
  trainer=fixture();inventory=[{id:'cleanse-tag',qty:10}];
  for(let i=0;i<6;i++)await action('create',{data:{kind:'glyph',name:'Limit '+i}});
  await action('create',{data:{kind:'glyph',name:'Over limit'}},/Occult Education Rank/);
  trainer=fixture();inventory=[];await action('create',{data:{kind:'glyph',name:'No tag'}},/Cleanse Tag/);
  inventory=[{id:'cleanse-tag',qty:1}];trainer.details.currentAp=0;await action('create',{data:{kind:'glyph',name:'No AP',swift:true}},/available AP/);
 }
 const invalid=fixture();invalid.details.currentAp='bad';assert.throws(()=>previewBoundEntityAction({trainer:invalid,...deps,action:'create',data:{kind:'external_trainer',name:'Bad'}}),/Current AP/);
 const disabled={...deps,getDefinition:q=>q.kind==='features'?null:deps.getDefinition(q)};assert.throws(()=>previewBoundEntityAction({trainer:fixture(),...disabled,action:'create',inventory:[{id:'cleanse-tag',qty:1}],data:{kind:'glyph',name:'Disabled'}}),/Editation version enabled/);
 for(const path of ['static-preview/bound-entities-ui.js','../PTU_Companion_Android_Tauri/www/bound-entities-ui.js']){
  const trainer=fixture(),state={inventory:[],ui:{day:1,scene:1,round:1}},result={valid:true,updatedTrainer:{...trainer,details:{...trainer.details,boundEntities:[{id:'new'}]}},updatedInventory:[],events:['Created'],apBefore:11,apAfter:11};let committed=0;
  const sandbox=vm.createContext({trainer:()=>trainer,state,catalogState:{status:{activeRulesetId:rulesetId}},fetch:async()=>({ok:true,json:async()=>result}),styledConfirm:async()=>false,esc:s=>s,toast(){},render(){},invalidateTrainerReference(){},commit:async()=>committed++});
  vm.runInContext(await readFile(join(root,path),'utf8'),sandbox);await sandbox.applyBoundEntityAction('create');assert(!trainer.details.boundEntities);assert.equal(committed,0,'cancel leaves state untouched');
  sandbox.styledConfirm=async()=>true;await sandbox.applyBoundEntityAction('create');assert.equal(committed,1);assert.equal(trainer.details.boundEntities[0].id,'new');
  sandbox.styledConfirm=async()=>{state.ui.scene++;return true;};await sandbox.applyBoundEntityAction('create');assert.equal(committed,1,'stale previews cannot overwrite newer state');
 }
 console.log('Issue #69 entities: Windows/Android API parity, Glyph HP/alarms/AP/limits, Marks/consent/focus, Soul Weapon choices/equipment/beckoning, persistence and atomic UI passed.');
}finally{definitions.close();child.kill();await delay(300);await rm(dataDir,{recursive:true,force:true});}
