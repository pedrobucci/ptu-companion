import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { DefinitionRepository } from '../definitions/repository.mjs';
import { resolveTrainerModel, trainerDefinitionRepeatability } from '../rules/trainer-engine.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const app=readFileSync(join(root,'static-preview','app.js'),'utf8');
const styles=readFileSync(join(root,'static-preview','styles.css'),'utf8');
const seed=JSON.parse(readFileSync(join(root,'seed','default-state.json'),'utf8'));
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const definitions=new DefinitionRepository(join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'));
const rulesetId='all-provided-material';
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const skills=['Acrobatics','Athletics','Combat','Intimidate','Stealth','Survival','General Education','Medicine Education','Occult Education','Pokémon Education','Technology Education','Guile','Perception','Charm','Command','Focus','Intuition'];
const emptyRanks=()=>Object.fromEntries(skills.map(k=>[k,2]));
const sword={id:'two-handed-sword',name:'Two-Handed Sword',inventoryItemId:'two-handed-sword',mechanics:{kind:'weapon',quality:'Fine',weaponClass:'large_melee',hands:2,metal:true,range:'Melee',acModifier:1,dbModifier:2,weaponMoves:{adept:'backswing',master:'slice'},tags:['Melee','Large Melee','Two-Handed','Sword']}};
function trainer(){return {id:'v20',name:'Verifier',level:5,stats:{hp:10,attack:10,defense:10,spAttack:10,spDefense:10,speed:10},gmGrants:[],history:[],equipment:{head:null,body:null,mainHand:null,offHand:null,feet:null,accessory:null},details:{background:{name:'Field Scholar',adept:'Athletics',novice:'Command',pathetic:['Guile','Intuition','Focus']},skillRanks:{},features:[],edges:[],moves:[],injuries:0,combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}}};}
const getDefinition=a=>definitions.getResolved(a);const getDamageBase=n=>definitions.getDamageBase(n);

// Background is a mechanical baseline, not display-only metadata.
let t=trainer();let resolved=resolveTrainerModel({trainer:t,rulesetId,getDefinition,getDamageBase});
assert(resolved.skills.Athletics.rank===4,'Background Adept Skill was not applied');
assert(resolved.skills.Command.rank===3,'Background Novice Skill was not applied');
assert(resolved.skills.Guile.rank===1&&resolved.skills.Intuition.rank===1&&resolved.skills.Focus.rank===1,'Background Pathetic Skills were not applied');

// Repeatability contracts.
const basic=getDefinition({rulesetId,kind:'edges',id:'basic-skills'});
const elemental=getDefinition({rulesetId,kind:'edges',id:'elemental-connection'});
assert(trainerDefinitionRepeatability(basic).repeatable,'Basic Skills is not repeatable');
assert(trainerDefinitionRepeatability(elemental).repeatable&&trainerDefinitionRepeatability(elemental).kind==='distinct_type','Elemental Connection distinct-Type repetition is not enabled');

// Repeated Basic Skills instances both affect the build.
t=trainer();t.details.skillRanks=emptyRanks();t.details.edges=[
  {id:'basic-skills',name:'Basic Skills',selections:{skill:'Stealth'}},
  {id:'basic-skills',name:'Basic Skills',selections:{skill:'Combat'}}
];
resolved=resolveTrainerModel({trainer:t,rulesetId,getDefinition,getDamageBase});
assert(resolved.skills.Stealth.rank===3&&resolved.skills.Combat.rank===3,'Repeated Basic Skills targets were not independently resolved');

// Fine Large Melee weapon: Adept Combat grants Adept Move, Master Combat grants both.
t=trainer();t.details.skillRanks={...emptyRanks(),Combat:4};t.equipment.mainHand=sword;
resolved=resolveTrainerModel({trainer:t,rulesetId,getDefinition,getDamageBase});
let backswing=resolved.moves.find(m=>m.id==='backswing');
assert(backswing,'Adept Combat did not unlock Backswing from the Fine sword');
assert(!resolved.moves.some(m=>m.id==='slice'),'Adept Combat incorrectly unlocked the Master Weapon Move');
assert(backswing.resolvedDamage.finalDb===9,'Large Melee +2 DB was not applied to Backswing');
assert(backswing.resolvedDamage.resolvedAc===3,'Large Melee +1 AC was not applied to Backswing');
assert(backswing.resolvedDamage.stab===false,'Weapon Move incorrectly received STAB');
assert(backswing.resolvedDamage.weapon?.qualification?.skill==='Combat','Base weapon qualification did not use Combat');

t.details.skillRanks.Combat=6;
resolved=resolveTrainerModel({trainer:t,rulesetId,getDefinition,getDamageBase});
assert(resolved.moves.some(m=>m.id==='backswing')&&resolved.moves.some(m=>m.id==='slice'),'Master Combat did not unlock both Fine Weapon Moves');

// Apparition qualifies melee weapon Moves via Occult Education or Intimidate.
t=trainer();t.details.skillRanks={...emptyRanks(),Combat:2,'Occult Education':4,Intimidate:3};t.details.features=[{id:'apparition',name:'Apparition'}];t.equipment.mainHand=sword;
resolved=resolveTrainerModel({trainer:t,rulesetId,getDefinition,getDamageBase});
backswing=resolved.moves.find(m=>m.id==='backswing');
assert(backswing,'Apparition + Adept Occult did not qualify for the Adept Weapon Move');
assert(backswing.resolvedDamage.weapon?.qualification?.skill==='Occult Education','Apparition qualification did not select Occult Education');
assert(backswing.resolvedDamage.weapon?.qualification?.source==='Apparition','Weapon qualification provenance does not show Apparition');

// UI / migration contract for all user-reported regressions.
for(const token of ['backgroundSkillRankMap','syncBackgroundSkillRanks','trainerDefinitionRepeatabilityUi','trainerSelectionSummary','trainerSelectionConflict',"Object.entries(t.equipment||{})",'equipTrainerItem','unequipTrainerItem','two-handed-sword','Reserved · ${item.name}','Qualified by'])assert(app.includes(token),`Missing v2.0 UI/migration token: ${token}`);
assert(app.includes("id==='elemental-connection'")&&app.includes("id==='type-ace'"),'Repeatable typed choices are missing from Trainer selection UI');
assert(styles.includes('.trainer-choice-summary'),'Selected-choice card styling is missing');
assert(seed.inventory.some(i=>i.id==='two-handed-sword'&&i.price===6000&&i.mechanics?.hands===2),'Two-Handed Sword is missing from the seed shop catalog');
assert(pkg.version==='2.0.0','package.json version is not 2.0.0');

// Real server endpoint smoke test, including a Trainer with no equipment property (Combat-tab regression shape).
const port=4600+Math.floor(Math.random()*200);
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let stderr='';child.stderr.on('data',d=>stderr+=d);
async function waitServer(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok)return r.json();}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error(`Server did not start: ${stderr}`)}
try{
  const health=await waitServer();assert(health.version==='2.0.0','Server health version is not 2.0.0');
  const noEquipment=trainer();delete noEquipment.equipment;
  const r=await fetch(`http://127.0.0.1:${port}/api/trainer/reference-data`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trainer:noEquipment})});
  const body=await r.json();assert(r.ok&&body.resolvedTrainer?.skills?.Athletics?.rank===4,'Real Trainer reference endpoint failed Background/no-equipment regression case');
  const armed=trainer();armed.details.skillRanks={...emptyRanks(),Combat:4};armed.equipment.mainHand=sword;
  const wr=await fetch(`http://127.0.0.1:${port}/api/trainer/reference-data`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trainer:armed})});
  const wb=await wr.json();assert(wr.ok&&wb.resolvedTrainer?.moves?.some(m=>m.id==='backswing'),'Real Trainer reference endpoint did not resolve Weapon Move');
} finally {child.kill('SIGTERM');}

definitions.close();
console.log('PTU Companion v2.0 verification: OK');
console.log('Background Skill ranks -> resolved Trainer Skills: passed');
console.log('Repeatable / targeted Trainer Edges and Features: passed');
console.log('Combat-tab no-equipment regression shape: passed');
console.log('Fine Two-Handed Sword + Weapon Move tiers: passed');
console.log('Apparition alternate Weapon Move qualification: passed');
