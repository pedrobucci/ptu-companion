import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { DefinitionRepository } from '../definitions/repository.mjs';
import { resolveTrainerModel } from '../rules/trainer-engine.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const app=readFileSync(join(root,'static-preview','app.js'),'utf8');
const styles=readFileSync(join(root,'static-preview','styles.css'),'utf8');
const serverSource=readFileSync(join(root,'server.mjs'),'utf8');
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const definitions=new DefinitionRepository(join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'));
const rulesetId='all-provided-material';
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};

assert(pkg.version==='2.1.0-beta.17','package.json version mismatch');
assert(app.includes('BETA v2.1.0'),'Beta label missing from UI');
assert(app.includes('function ownedInventory()')&&app.includes('Number(i.qty||0)>0'),'Backpack does not filter zero-quantity items');
for(const token of ['openBackpackItemPicker','addCatalogItemToBackpack','createCustomItem','Custom Item','pokemonPortraitUrl','/api/pokemon/portrait/'])assert(app.includes(token),`Missing beta UI token: ${token}`);
assert(styles.includes('.catalog-add-list')&&styles.includes('.owned-item-actions')&&styles.includes('.item-primary-action'),'Beta inventory action styling missing');
assert(app.includes('pokemon-progress-stat-row')&&app.includes('pokemon-progress-stepper')&&app.includes("const label=statDisplayName(k)"),'Pokémon progression Stat allocator markup/labels missing');
assert(styles.includes('.pokemon-progress-stat-head,.pokemon-progress-stat-row')&&styles.includes('.pokemon-progress-stepper'),'Pokémon progression Stat allocator styling missing');
assert(styles.includes('.trainer-progress-layout .progress-stat-row')&&!styles.includes('.progress-stat-list{display:grid;gap:6px}.progress-stat-row{'),'Trainer progression CSS still leaks into Pokémon progression Stat rows');
assert(app.includes('uploadTrainerPortrait')&&app.includes('uploadNpcPortrait')&&app.includes('portraitDataUrlFromFile'),'Trainer/NPC portrait upload UI missing');
assert(styles.includes('local Trainer/NPC portraits')&&styles.includes('.has-portrait img'),'Trainer/NPC portrait styling missing');
assert(serverSource.includes("url.pathname==='/api/items/catalog'")&&serverSource.includes('portraitMatch'),'Catalog or portrait API missing');
assert(serverSource.includes('PTU_DATA_DIR'),'Desktop persistent data override missing');
assert(existsSync(join(root,'PTU Companion Beta.exe')),'Windows beta executable missing');

const itemCount=definitions.countResolved({rulesetId,kind:'items',q:''});
assert(itemCount===508,`Expected 508 default item definitions with bundled Weapon + Gear packs, found ${itemCount}`);
const potion=definitions.getResolved({rulesetId,kind:'items',id:'potion'});
assert(potion?.name==='Potion','Representative item definition missing');

// Existing resolved Trainer mechanics still work after beta changes.
const trainer={id:'beta-test',name:'Verifier',level:5,stats:{hp:10,attack:10,defense:10,spAttack:10,spDefense:10,speed:10},gmGrants:[],equipment:{head:null,body:null,mainHand:null,offHand:null,feet:null,accessory:null},details:{background:{name:'Field Scholar',adept:'Athletics',novice:'Command',pathetic:['Guile','Intuition','Focus']},skillRanks:{},features:[],edges:[],moves:[],injuries:0,combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}}};
const resolved=resolveTrainerModel({trainer,rulesetId,getDefinition:a=>definitions.getResolved(a),getDamageBase:n=>definitions.getDamageBase(n)});
assert(resolved.skills.Athletics.rank===4&&resolved.skills.Command.rank===3,'Trainer resolved-model regression');

// Beta.4 campaign-homebrew definitions from the supplied PDFs.
const campaignDefinitions=[
  ['features','hacker','Hacker','Hacker'],
  ['features','police-officer','Police Officer','Police Officer'],
  ['features','conjurer','Conjurer','Conjurer'],
  ['features','enhancer','Enhancer','Enhancer'],
  ['features','writer','Writer','Writer'],
  ['features','ronin','Ronin','Ronin'],
  ['features','without-evolution-ace','Without Evolution Ace','Without Evolution Ace'],
  ['features','species-highbrow','Species Highbrow',null],
  ['edges','pokemon-understanding','Pokemon Understanding',null],
  ['poke_edges','human-form','Human Form',null],
  ['poke_edges','human-speech','Human Speech',null]
];
for(const [kind,id,name,parentClass] of campaignDefinitions){
  const def=definitions.getResolved({rulesetId,kind,id});
  assert(def?.name===name,`Missing campaign definition ${kind}:${id}`);
  if(parentClass)assert(def.parentClass===parentClass,`${name} class relationship missing`);
}
const professionIds=['investigator','bounty-hunter','pedreiro','handyman-housewife','dirty-jobber','promotor','defensor','juiz','plutocrat-wealth','plutocrat-influence','princess','smith'];
for(const id of professionIds){
  const def=definitions.getResolved({rulesetId,kind:'features',id});
  assert(def?.trainingFeature===true,`${id} is not classified as a Training Feature`);
  assert(def?.tags?.includes('Profession')&&def?.tags?.includes('Training'),`${id} profession tags missing`);
}
const trainingList=definitions.listResolved({rulesetId,kind:'features',q:'Training',limit:200}).filter(x=>x.trainingFeature);
for(const id of professionIds)assert(trainingList.some(x=>x.id===id),`${id} is missing from Training Feature picker search results`);

// Sunglasses must affect the resolved Trainer, not only equipment metadata.
const sunglassesTrainer=structuredClone(trainer);
sunglassesTrainer.equipment.head={id:'sunglasses',definitionId:'sunglasses',name:'Sunglasses'};
const sunglassResolved=resolveTrainerModel({trainer:sunglassesTrainer,rulesetId,getDefinition:a=>definitions.getResolved(a),getDamageBase:n=>definitions.getDamageBase(n)});
for(const skill of ['Charm','Guile','Intimidate'])assert(sunglassResolved.skills[skill].flatBonus===1&&/\+1$/.test(sunglassResolved.skills[skill].expression),`Sunglasses did not add +1 to ${skill}`);

// Real server: isolated data dir, full item catalog and persistence of Custom Item metadata.
const testData=mkdtempSync(join(tmpdir(),'ptu-beta-v210-'));
const port=4900+Math.floor(Math.random()*300);
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_PORT:String(port),PTU_DATA_DIR:testData},stdio:['ignore','pipe','pipe']});
let stderr=''; child.stderr.on('data',d=>stderr+=d);
async function waitServer(){for(let i=0;i<80;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok)return r.json();}catch{} await new Promise(r=>setTimeout(r,100));}throw new Error(`Server did not start: ${stderr}`)}
try{
  const health=await waitServer();
  assert(health.version==='2.1.0-beta.17','Server health version mismatch');
  assert(health.schemaVersion===5,'Trainer/NPC portrait migration is not schema v5');
  const catalogRes=await fetch(`http://127.0.0.1:${port}/api/items/catalog`);
  const catalog=await catalogRes.json();
  assert(catalogRes.ok&&catalog.total===508&&catalog.items.length===508,'Full default item catalog endpoint failed');
  assert(catalog.items.every(i=>i.definitionId&&typeof i.description==='string'),'Catalog item metadata is incomplete');
  const sunglasses=catalog.items.find(i=>i.id==='sunglasses');
  const focusSash=catalog.items.find(i=>i.id==='focus-sash');
  assert(sunglasses?.trainerUsable===true&&sunglasses.equipmentSlots?.includes('head'),'Sunglasses must be Trainer-usable Head equipment');
  assert(focusSash?.trainerUsable===true&&focusSash?.pokemonHeldUsable===false&&focusSash.equipmentSlots?.includes('accessory'),'Bundled Trainer Gear Focus Sash usability/Accessory metadata is incorrect');

  // Pokémon Poké Edge resolution: Underdog stat modifiers, Realized Potential allocation,
  // and Skill Improvement target options must be driven by the real Species definition.
  const basePokemon={id:'poke-edge-verifier',name:'Verifier Starly',species:'Starly',level:30,types:['normal','flying'],hp:20,maxHp:20,injuries:0,ball:'Basic Ball',heldItem:null,loyalty:3,combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0},details:{speciesDefinitionId:'starly',nature:'Hardy',statAllocations:{hp:0,attack:0,defense:0,special_attack:0,special_defense:0,speed:0},finalStats:{},moves:[],abilities:[],pokeEdges:[{instanceId:'edge-strength-test',id:'underdogs-strength',name:"Underdog's Strength",cost:1}],tutorPointsEarned:20,tutorPointsSpent:1}};
  const refRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/reference-data`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:basePokemon})});
  const ref=await refRes.json();
  assert(refRes.ok,'Pokémon reference-data endpoint failed for Poké Edge verification');
  for(const key of ['hp','attack','defense','special_attack','special_defense','speed']) assert(ref.resolvedCreature?.stats?.breakdown?.baseBonus?.[key]===1,`Underdog's Strength did not add +1 ${key} Base Stat`);
  assert(ref.resolvedCreature?.evolutionLocked===true&&ref.resolvedCreature?.evolutionLockSource==="Underdog's Strength",`Underdog's Strength evolution lock missing`);
  const trainingRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/training-options`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:basePokemon})});
  const training=await trainingRes.json();
  assert(trainingRes.ok,'Pokémon training-options endpoint failed');
  const realized=training.edges.find(e=>e.id==='realized-potential');
  const skillImprovement=training.edges.find(e=>e.id==='skill-improvement');
  const starly=definitions.getResolved({rulesetId,kind:'species',id:'starly'});
  const starlyBst=Object.values(starly.baseStats).reduce((a,b)=>a+Number(b||0),0);
  assert(realized?.allocationPoints===Math.max(0,45-starlyBst),'Realized Potential must use canonical Species BST even with Underdog Strength');
  assert(skillImprovement?.targetRequired===true&&skillImprovement?.targetKind==='skill','Skill Improvement must require a Skill target');
  const expectedSkills=(starly.raw?.skills||[]).map(x=>String(x.skill).toLowerCase()).sort();
  const optionSkills=(skillImprovement?.targetOptions||[]).map(x=>String(x.skillName).toLowerCase()).sort();
  assert(JSON.stringify(optionSkills)===JSON.stringify(expectedSkills),'Skill Improvement does not list the Species Skill set');
  const skillPokemon=structuredClone(basePokemon); skillPokemon.details.pokeEdges=[{instanceId:'edge-skill-test',id:'skill-improvement',name:'Skill Improvement',targetId:'stealth',targetNote:'Stealth',targetKind:'skill',cost:1}];
  const skillRefRes=await fetch(`http://127.0.0.1:${port}/api/pokemon/reference-data`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:skillPokemon})});
  const skillRef=await skillRefRes.json();
  const baseStealth=starly.raw.skills.find(x=>String(x.skill).toLowerCase()==='stealth');
  const resolvedStealth=skillRef.resolvedCreature?.skills?.find(x=>x.id==='stealth');
  assert(skillRefRes.ok&&resolvedStealth?.dice===Number(baseStealth.dice)+1&&resolvedStealth?.modifier===Number(baseStealth.modifier),'Skill Improvement did not rank up selected Species Skill');

  const stateRes=await fetch(`http://127.0.0.1:${port}/api/state`); const initial=(await stateRes.json()).state;
  initial.trainer.portraitDataUrl='data:image/webp;base64,VFJBSU5FUg==';
  if(!initial.npcs.length) initial.npcs.push({id:'portrait-npc',initials:'PN',name:'Portrait NPC',role:'Contact',tag:'Ally',affiliation:'',lastSeen:'',description:'Portrait persistence verifier',portraitDataUrl:'data:image/webp;base64,TlBD',notes:[]});
  else initial.npcs[0].portraitDataUrl='data:image/webp;base64,TlBD';
  initial.inventory.push({id:'custom-item-verifier',definitionId:null,icon:'◆',name:'Ancient Campaign Key',category:'Custom',price:0,qty:2,consumable:false,equipSlot:null,description:'A campaign-only key with no automatic mechanics.',custom:true,mechanics:null,config:{}});
  const save=await fetch(`http://127.0.0.1:${port}/api/state`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:initial})});
  assert(save.ok,'Saving Custom Item failed');
  const reload=(await (await fetch(`http://127.0.0.1:${port}/api/state`)).json()).state;
  const custom=reload.inventory.find(i=>i.id==='custom-item-verifier');
  assert(custom?.custom===true&&custom.description.includes('no automatic mechanics')&&custom.qty===2,'Custom Item metadata did not survive SQLite round-trip');
  assert(reload.trainer.portraitDataUrl==='data:image/webp;base64,VFJBSU5FUg==','Trainer portrait did not survive SQLite round-trip');
  assert(reload.npcs.some(n=>n.portraitDataUrl==='data:image/webp;base64,TlBD'),'NPC portrait did not survive SQLite round-trip');
  const profiles=(await (await fetch(`http://127.0.0.1:${port}/api/profiles`)).json()).profiles;
  assert(profiles.some(p=>p.id===reload.activeProfileId&&p.portraitDataUrl==='data:image/webp;base64,VFJBSU5FUg=='),'Trainer switcher profile does not expose portrait');
} finally {
  child.kill('SIGTERM');
  rmSync(testData,{recursive:true,force:true});
}

definitions.close();
console.log('PTU Companion Beta v2.1.0-beta.17 verification: OK');
console.log('Campaign classes/features/edges + profession Training Features: passed');
console.log('Sunglasses resolved Trainer skill bonuses: passed');
console.log('508 default item definitions (base + bundled Weapon/Gear packs) -> catalog API: passed');
console.log('Owned-only Backpack + Custom Item UI contract: passed');
console.log('Item usability + equipment slot metadata: passed');
console.log('Underdog / Realized Potential / Skill Improvement mechanics: passed');
console.log('Custom Item metadata -> SQLite round-trip: passed');
console.log('Trainer/NPC portrait upload persistence contract: passed');
console.log('Automatic Pokémon portrait endpoint contract: passed');
console.log('Windows x64 GUI executable artifact: present');
