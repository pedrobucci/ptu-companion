import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {resolveTrainerModel as resolveWindows} from '../rules/trainer-engine.mjs';
import {resolveTrainerModel as resolveAndroid} from '../../PTU_Companion_Android_Tauri/www/rules/trainer-engine.mjs';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';

const skillBonus={skillBonuses:[{skill:'Stealth',value:2}]};
const trainer={id:'issue28',name:'Issue 28',level:1,stats:{hp:5,attack:5,defense:5,spAttack:5,spDefense:5,speed:5},gmGrants:[],details:{background:{name:'Test'},skillRanks:{Stealth:3},features:[],edges:[],moves:[],injuries:0},equipment:{accessory:{id:'custom-item-1',inventoryItemId:'custom-item-1',name:'Tracker Lens',description:'Custom equipment',mechanics:skillBonus,config:{}}}};
for(const resolveTrainerModel of [resolveWindows,resolveAndroid]){
  const resolve=equipment=>resolveTrainerModel({trainer:{...structuredClone(trainer),equipment},rulesetId:'test',getDefinition:()=>null,getDamageBase:()=>null});
  const equipped=resolve(trainer.equipment);
  assert.equal(equipped.skills.Stealth.flatBonus,2,'custom equipped Trainer item adds its flat Skill bonus');
  assert.equal(equipped.skills.Stealth.expression,'3d6+2');
  assert.equal(equipped.equipment[0].definition.custom,true);
  assert.equal(resolve({accessory:null}).skills.Stealth.flatBonus,0,'bonus is removed when unequipped');
  const persisted=JSON.parse(JSON.stringify(trainer));
  assert.equal(resolve(persisted.equipment).skills.Stealth.flatBonus,2,'bonus survives save-shaped JSON round trip');
}
for(const file of ['../static-preview/app.js','../../PTU_Companion_Android_Tauri/www/app.js']){
  const app=readFileSync(new URL(file,import.meta.url),'utf8');
  assert.match(app,/pokemonHeldUsable:f\.pokemonHeldUsable==='yes'/,'custom Pokemon Held Item compatibility is saved');
  assert.match(app,/trainerUsable,pokemonHeldUsable:f\.pokemonHeldUsable==='yes',equipmentSlots:trainerUsable/,'custom Trainer equipment compatibility and slot are saved');
  assert.match(app,/skillBonuses:\[\{skill:String\(f\.skillBonusSkill\|\|TRAINER_SKILLS\[0\]\),value:Number\(f\.skillBonusValue\)\|\|0\}\]/,'custom structured Skill effect is persisted');
}
for(const file of ['../server.mjs','../../PTU_Companion_Android_Tauri/www/mobile-api.mjs']){
  const api=readFileSync(new URL(file,import.meta.url),'utf8');
  assert.match(api,/trainerUsable:item\.trainerUsable===true/,'custom Trainer eligibility survives API hydration');
  assert.match(api,/pokemonHeldUsable:item\.pokemonHeldUsable===true/,'custom Pokemon Held Item eligibility survives API hydration');
}
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const data=await mkdtemp(join(tmpdir(),'ptu-issue28-'));
const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_DATA_DIR:data,PTU_PORT:String(port)},stdio:'ignore'});
const base=`http://127.0.0.1:${port}`;
try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(`${base}/api/health`)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  assert(ready,'isolated Windows API did not start');
  const inventory=[{id:'custom-held',icon:'◆',name:'Campaign Charm',category:'Custom',price:0,description:'Narrative charm',custom:true,qty:1,consumable:false,equipSlot:null,pokemonHeldUsable:true,trainerUsable:false,equipmentSlots:[],mechanics:null}];
  const pokemon={heldItem:null,details:{}};
  const options=await fetch(`${base}/api/pokemon/held-item-options`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pokemon,inventory})}).then(r=>r.json());
  assert(options.items.some(item=>item.inventoryId==='custom-held'),'compatible Custom Item missing from Held Item options');
  const previewResponse=await fetch(`${base}/api/pokemon/held-item-preview`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pokemon,inventoryItem:inventory[0]})});
  assert.equal(previewResponse.status,200,'compatible Custom Item rejected by Held Item preview');
  const heldPreview=await previewResponse.json();assert.equal(heldPreview.definition.custom,true);
  const trainer={id:'api-test',name:'API test',level:1,stats:{},details:{skillRanks:{Stealth:3}},equipment:{accessory:{id:'custom-trainer',inventoryItemId:'custom-trainer',name:'Lens',mechanics:skillBonus,config:{}}}};
  const resolved=await fetch(`${base}/api/trainer/reference-data`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({trainer})}).then(r=>r.json());
  assert.equal(resolved.resolvedTrainer.skills.Stealth.expression,'3d6+2','Trainer API failed to apply the custom flat Skill bonus');
  const state=JSON.parse(await readFile(join(root,'seed','default-state.json'),'utf8'));
  const trainerItem={id:'custom-trainer',icon:'◆',name:'Tracker Lens',category:'Custom',price:0,description:'Trainer lens',custom:true,qty:0,consumable:false,equipSlot:null,trainerUsable:true,pokemonHeldUsable:false,equipmentSlots:['accessory'],mechanics:skillBonus,config:{}};
  state.inventory=[...inventory,trainerItem];state.trainer.equipment.accessory={id:trainerItem.id,name:trainerItem.name,icon:trainerItem.icon,definitionId:null,inventoryItemId:trainerItem.id,mechanics:trainerItem.mechanics,config:{}};
  await fetch(`${base}/api/state`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(state)}).then(async r=>assert.equal(r.status,200,await r.text()));
  const reloaded=await fetch(`${base}/api/state`).then(r=>r.json());assert.equal(reloaded.state.inventory[0].pokemonHeldUsable,true,'Custom item compatibility did not persist through SQLite');
  assert.equal(reloaded.state.trainer.equipment.accessory.mechanics.skillBonuses[0].value,2,'equipped Trainer item effect did not persist through SQLite');
  const afterReload=await fetch(`${base}/api/trainer/reference-data`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({trainer:reloaded.state.trainer})}).then(r=>r.json());
  const withoutItem=structuredClone(reloaded.state.trainer);withoutItem.equipment.accessory=null;
  const baseline=await fetch(`${base}/api/trainer/reference-data`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({trainer:withoutItem})}).then(r=>r.json());
  assert.equal(afterReload.resolvedTrainer.skills.Stealth.flatBonus-baseline.resolvedTrainer.skills.Stealth.flatBonus,2,'persisted equipped item effect did not resolve after reload');
}finally{server.kill();await new Promise(resolve=>setTimeout(resolve,300));await rm(data,{recursive:true,force:true});}
console.log('Issue #28: custom Held Item eligibility, Trainer equipment persistence, flat Skill bonus while equipped, unequip removal and Windows/Android parity passed.');
