import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {setTimeout as delay} from 'node:timers/promises';
import {resolveTrainerModel as resolveTrainerWindows} from '../rules/trainer-engine.mjs';
import {resolveTrainerModel as resolveTrainerAndroid} from '../../PTU_Companion_Android_Tauri/www/rules/trainer-engine.mjs';
import {resolveHeldItemEffect as resolveHeldWindows} from '../rules/held-item-engine.mjs';
import {resolveHeldItemEffect as resolveHeldAndroid} from '../../PTU_Companion_Android_Tauri/www/rules/held-item-engine.mjs';
import {getPokemonModifierSummary as getPokemonWindows,resolveMoveDamage as resolveDamageWindows} from '../rules/modifier-engine.mjs';
import {getPokemonModifierSummary as getPokemonAndroid,resolveMoveDamage as resolveDamageAndroid} from '../../PTU_Companion_Android_Tauri/www/rules/modifier-engine.mjs';
const here=dirname(fileURLToPath(import.meta.url)),sourceRoot=dirname(here),repo=dirname(sourceRoot),port=42121,base=`http://127.0.0.1:${port}`;
const dataDir=await import('node:fs/promises').then(fs=>fs.mkdtemp(join(tmpdir(),'ptu-issue21-')));
const child=spawn(process.execPath,['server.mjs'],{cwd:sourceRoot,env:{...process.env,PTU_PORT:String(port),PTU_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',chunk=>stderr+=chunk.toString());
const storage={m:new Map(),getItem(k){return this.m.get(k)||null;},setItem(k,v){this.m.set(k,String(v));},removeItem(k){this.m.delete(k);}};
async function call(api,path,body,method=body?'POST':'GET'){const r=await api(path,{method,headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();assert(r.ok,`${path}: ${data.error||r.status}`);return data;}
const effects=[
 {type:'stat',stat:'attack',mode:'points',value:2},{type:'stat',stat:'hp',mode:'points',value:1},
 {type:'stat',stat:'attack',mode:'combat_stage',value:1},
 {type:'accuracy',mode:'points',value:1},{type:'accuracy',mode:'combat_stage',value:1},
 {type:'evasion',mode:'points',value:2},{type:'evasion',mode:'combat_stage',value:1},
 {type:'damage',mode:'points',value:3},{type:'damage_base',mode:'points',value:2}
];
const trainer={id:'issue21',name:'Issue 21 QA',level:1,stats:{hp:5,attack:10,defense:5,spAttack:5,spDefense:5,speed:5},gmGrants:[],details:{background:{name:'QA'},skillRanks:{Stealth:3},combatStages:{},features:[],edges:[],moves:[],injuries:0},equipment:{accessory:{id:'custom-effects',inventoryItemId:'custom-effects',name:'Test Charm',mechanics:{itemEffects:effects},config:{}}}};
const pokemon={id:'issue21-held',name:'Held Item QA',species:'Zoroark',level:60,types:['dark'],hp:100,maxHp:100,injuries:0,ball:'Poké Ball',loyalty:3,storage:false,rosterIds:[],combatStages:{},details:{speciesDefinitionId:'zoroark',linkedRulesetId:'all-provided-material',finalStats:{hp:10,attack:10,defense:10,special_attack:10,special_defense:10,speed:10},abilities:[],pokeEdges:[],moves:[{id:'scratch',name:'Scratch',source:'current_species',cost:0}]}};
const customDefinition={id:'custom-effects',name:'Test Charm',effect:'GM-defined test effect',custom:true,sourceId:'custom',raw:{id:'custom-effects',name:'Test Charm',source_id:'custom',effect_text:'GM-defined test effect',pokemon_held_usable:true,mechanics:{itemEffects:effects}}};
try{
 let ready=false;for(let i=0;i<100&&!ready;i++){try{ready=(await fetch(`${base}/api/health`)).ok;}catch{}if(!ready)await delay(100);}assert(ready,'Windows API failed to start: '+stderr);
 globalThis.window={fetch:globalThis.fetch};globalThis.localStorage=storage;globalThis.location={href:'https://app.local/index.html'};
 vm.runInThisContext(await readFile(join(repo,'PTU_Companion_Android_Tauri/www/mobile-data.js'),'utf8'));
 const {mobileFetch}=await import('../../PTU_Companion_Android_Tauri/www/mobile-api.mjs');
 const apis=[['Windows',(path,init)=>fetch(base+path,init)],['Android',mobileFetch]];
 const directTrainer=[];
 for(const [name,resolveTrainer] of [['Windows',resolveTrainerWindows],['Android',resolveTrainerAndroid]]){
  const model=resolveTrainer({trainer:structuredClone(trainer),rulesetId:'all-provided-material',getDefinition:()=>null,getDamageBase:db=>({rolled_damage:`1d6+${db}`})});
  assert.equal(model.stats.effective.attack,12,`${name}: point effect changes only resolved Attack`);assert.equal(model.stats.effective.hp,6,`${name}: HP point effect stays in the resolved layer`);assert.equal(model.derived.maxHp,30,`${name}: resolved HP points update derived maximum HP`);
  assert.equal(model.stats.combat.attack,14,`${name}: equipped Combat Stage stacks after points`);
  assert.equal(model.stats.base.attack,10,`${name}: saved base Attack remains unchanged`);
  assert.equal(model.derived.accuracyBonus,2,`${name}: flat and staged Accuracy sum`);
  assert.equal(model.derived.physicalEvasion,4,`${name}: flat and staged Evasion sum`);
  assert.equal(model.damageRollBonus,3);assert.equal(model.damageBaseBonus,2);assert.equal(model.struggleAttack.finalDb,6);
  const unequipped=resolveTrainer({trainer:{...structuredClone(trainer),equipment:{accessory:null}},rulesetId:'all-provided-material',getDefinition:()=>null,getDamageBase:db=>({rolled_damage:`1d6+${db}`})});
  assert.equal(unequipped.stats.effective.attack,10,`${name}: unequip removes point modifier`);assert.equal(unequipped.derived.accuracyBonus,0);assert.equal(unequipped.damageRollBonus,0);
  directTrainer.push(model);
 }
 assert.deepEqual(directTrainer[0],directTrainer[1],'Windows and Android Trainer engines should resolve equipment identically');
 const heldResolvers=[resolveHeldWindows,resolveHeldAndroid],summaries=[];
 for(let i=0;i<heldResolvers.length;i++){
  const effect=heldResolvers[i]({itemDefinition:customDefinition,pokemon,config:{}});assert(effect,`Held Item effect ${i}`);
  assert.equal(effect.statBonuses.attack,2);assert.equal(effect.combatStageBonuses.attack,1);assert.equal(effect.accuracyBonus,1);assert.equal(effect.combatStageBonuses.accuracy,1);
  const summary=(i?getPokemonAndroid:getPokemonWindows)(pokemon,{heldItemEffect:effect});
  assert.equal(summary.effectiveStats.attack,12);assert.equal(summary.effectiveStats.hp,11);assert.equal(summary.combatStats.attack,14);assert.equal(summary.accuracyRollBonus,2);assert.equal(summary.evasionBonus,3);assert.equal(summary.evasion.physical,5);assert.equal(summary.evasion.special,5);assert.equal(summary.evasion.speed,5);
  const damage=(i?resolveDamageAndroid:resolveDamageWindows)({pokemon,moveDefinition:{id:'strike',class:'Physical',damageBase:4,type:'dark'},speciesTypes:['dark'],getDamageBase:db=>({rolled_damage:`1d6+${db}`}),heldItemEffect:effect});
  assert.equal(damage.finalDamageBase,8,'base DB 4 + STAB 2 + item DB 2');assert.equal(damage.itemDamageBaseBonus,2);assert.equal(damage.itemDamageBonus,3);assert.equal(damage.primaryStat.value,14);
  assert.equal(damage.finalRoll,'1d6+25','chart roll + staged Stat + item damage modifier');summaries.push({effect,summary,damage});
 }
 assert.deepEqual(summaries[0],summaries[1],'Windows and Android Pokémon engines should resolve equipment identically');
 const apps=await Promise.all([readFile(join(sourceRoot,'static-preview/app.js'),'utf8'),readFile(join(repo,'PTU_Companion_Android_Tauri/www/app.js'),'utf8')]);
 const extract=s=>{const a=s.indexOf('async function createCustomItem(){'),b=s.indexOf('function isWeaponStoreItem(',a);return s.slice(a,b);};
 assert.equal(extract(apps[0]),extract(apps[1]),'Windows/Android Custom Item effect editors should match');assert.match(extract(apps[0]),/itemEffects\.push\(\{type/);assert.match(extract(apps[0]),/Combat Stages/);
 for(const [platform,api] of apis){
  const item={id:'custom-effects',name:'Test Charm',category:'Custom',price:0,description:'GM-defined test effect',custom:true,qty:1,consumable:false,pokemonHeldUsable:true,trainerUsable:true,equipmentSlots:['accessory'],mechanics:{itemEffects:effects}};
  const options=await call(api,'/api/pokemon/held-item-options',{pokemon:{heldItem:null,details:{}},inventory:[item]});assert(options.items.some(row=>row.inventoryId===item.id),`${platform}: custom Held Item option`);
  const preview=await call(api,'/api/pokemon/held-item-preview',{pokemon:{heldItem:null,details:{}},inventoryItem:item});assert.equal(preview.definition.raw.mechanics.itemEffects.length,effects.length,`${platform}: preview carries effects`);
  const baseline=await call(api,'/api/pokemon/reference-data',{pokemon,rulesetId:'all-provided-material'});
  const withHeld={...structuredClone(pokemon),heldItem:item.name,details:{...structuredClone(pokemon.details),heldItemDefinitionId:item.id,heldItemDefinitionSnapshot:preview.definition}};
  const ref=await call(api,'/api/pokemon/reference-data',{pokemon:withHeld,rulesetId:'all-provided-material'});
  assert.equal(ref.modifierSummary.effectiveStats.attack-baseline.modifierSummary.effectiveStats.attack,2,`${platform}: reference data resolves item Stat points`);assert.equal(ref.resolvedCreature.stats.breakdown.maxHp-baseline.resolvedCreature.stats.breakdown.maxHp,3,`${platform}: held HP points update derived Max HP`);assert(ref.modifierSummary.combatStats.attack>baseline.modifierSummary.combatStats.attack,`${platform}: reference data resolves item Combat Stages`);assert.equal(ref.modifierSummary.accuracyRollBonus,2,`${platform}: Accuracy bonuses resolve in reference data`);assert.equal(ref.moves[0]?.resolvedDamage?.itemDamageBaseBonus,2,`${platform}: custom Damage Base reaches move resolution`);assert.equal(ref.moves[0]?.resolvedDamage?.itemDamageBonus,3,`${platform}: custom damage bonus reaches move resolution`);
  const resolvedTrainer=await call(api,'/api/trainer/reference-data',{trainer,rulesetId:'all-provided-material'});
  assert.equal(resolvedTrainer.resolvedTrainer.stats.combat.attack,14,`${platform}: Trainer API resolves item effects`);assert.equal(resolvedTrainer.resolvedTrainer.damageBaseBonus,2);
  const state=(await call(api,'/api/state',undefined,'GET')).state;state.inventory=(state.inventory||[]).filter(row=>row.id!==item.id);state.inventory.push(item);state.trainer={...state.trainer,...structuredClone(trainer)};state.trainer.equipment=structuredClone(trainer.equipment);state.pokemon=(state.pokemon||[]).filter(row=>row.id!==withHeld.id);state.pokemon.push(withHeld);state.selectedPokemonId=withHeld.id;
  await call(api,'/api/state',{state},'PUT');const loaded=(await call(api,'/api/state',undefined,'GET')).state;const saved=loaded.pokemon.find(row=>row.id===withHeld.id);
  assert.equal(loaded.inventory.find(row=>row.id===item.id).mechanics.itemEffects.length,effects.length,`${platform}: item definition persists`);assert.equal(saved.details.heldItemDefinitionSnapshot.raw.mechanics.itemEffects.length,effects.length,`${platform}: held-item effect persists`);assert.equal(loaded.trainer.equipment.accessory.mechanics.itemEffects.length,effects.length,`${platform}: equipped Trainer effect persists`);
  const unequipped={...saved,heldItem:null,details:{...saved.details,heldItemDefinitionId:null,heldItemDefinitionSnapshot:null}};
  const result=await call(api,'/api/pokemon/reference-data',{pokemon:unequipped,rulesetId:'all-provided-material'});assert.equal(result.modifierSummary.effectiveStats.attack,baseline.modifierSummary.effectiveStats.attack,`${platform}: unequipping removes Pokémon effect`);
  const withoutTrainer={...loaded.trainer,equipment:{...loaded.trainer.equipment,accessory:null}};const base=await call(api,'/api/trainer/reference-data',{trainer:withoutTrainer,rulesetId:'all-provided-material'});assert.equal(base.resolvedTrainer.stats.combat.attack,10,`${platform}: unequipping removes Trainer effect`);
  console.log(`${platform}: effects, combat/stat resolution, persistence and unequip removal verified`);
 }
}finally{if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}await rm(dataDir,{recursive:true,force:true});}
console.log('Issue #21 structured equipped item effects verified across Windows and Android.');
