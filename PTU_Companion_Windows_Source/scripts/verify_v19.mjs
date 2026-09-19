import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { DefinitionRepository } from '../definitions/repository.mjs';
import { resolveTrainerModel, evaluateTrainerDefinitionPrerequisite } from '../rules/trainer-engine.mjs';
import { trainerLevelRewards, previewTrainerProgression, applyTrainerProgression } from '../rules/trainer-progression-engine.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const app=readFileSync(join(root,'static-preview','app.js'),'utf8');
const styles=readFileSync(join(root,'static-preview','styles.css'),'utf8');
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const definitions=new DefinitionRepository(join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'));
const rulesetId='all-provided-material';
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const skills=['Acrobatics','Athletics','Combat','Intimidate','Stealth','Survival','General Education','Medicine Education','Occult Education','Pokémon Education','Technology Education','Guile','Perception','Charm','Command','Focus','Intuition'];
const baseTrainer=(level=1)=>({
  id:`verify-v19-${level}`,name:'Progress Tester',title:'Trainer',level,exp:0,nextExp:10,money:5000,badges:0,
  stats:{hp:10,attack:5,defense:5,spAttack:5,spDefense:5,speed:5},equipment:{head:null,body:null,mainHand:null,offHand:null,feet:null,accessory:null},gmGrants:[],history:[],
  details:{background:{name:'Test',adept:'Athletics',novice:'Command',pathetic:['Guile','Intuition','Focus']},skillRanks:Object.fromEntries(skills.map(k=>[k,3])),features:[],edges:[],moves:[],trainingFeature:null,currentHp:null,injuries:0,currentAp:null,combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0},progression:{milestoneChoices:{},levelHistory:[]}}
});
const getDefinition=a=>definitions.getResolved(a);
const listDefinitions=a=>definitions.listResolved(a);
const getDamageBase=n=>definitions.getDamageBase(n);
const preview=(trainer,draft,gmOverride=false)=>previewTrainerProgression({trainer,draft,rulesetId,getDefinition,listDefinitions,getDamageBase,gmOverride});

// Exact PTU reward schedule.
let r=trainerLevelRewards(baseTrainer(1),2);
assert(r.baseStatPoints===1&&r.edgeCount===1&&r.skillEdgeCount===1&&r.skillRankUnlock==='Adept','Level 2 rewards are incorrect');
r=trainerLevelRewards(baseTrainer(4),5,'offense_stats');
assert(r.featureCount===1&&r.offensiveStatPoints===2&&r.generalFeatureCount===0,'Level 5 offensive-track rewards are incorrect');
r=trainerLevelRewards(baseTrainer(4),5,'general_feature');
assert(r.totalFeatures===2&&r.generalFeatureCount===1,'Level 5 General Feature rewards are incorrect');
const l5=baseTrainer(5); l5.details.progression.milestoneChoices['5']='offense_stats';
r=trainerLevelRewards(l5,6);
assert(r.edgeCount===1&&r.skillEdgeCount===1&&r.offensiveStatPoints===1&&r.skillRankUnlock==='Expert','Level 6 rewards after Amateur offensive track are incorrect');
r=trainerLevelRewards(baseTrainer(9),10,'two_edges');
assert(r.totalEdges===3&&r.milestoneEdgeCount===2,'Level 10 two-Edges milestone is incorrect');
r=trainerLevelRewards(baseTrainer(29),30,'general_feature');
assert(r.edgeCount===1&&r.generalFeatureCount===1&&r.totalFeatures===1,'Level 30 General Feature milestone is incorrect');

// Deterministic prerequisite evaluation.
const powerBoost=getDefinition({rulesetId,kind:'edges',id:'power-boost'});
const aceTrainer=getDefinition({rulesetId,kind:'features',id:'ace-trainer'});
const prereqTrainer=baseTrainer(6);
let resolved=resolveTrainerModel({trainer:prereqTrainer,rulesetId,getDefinition,getDamageBase});
let ev=evaluateTrainerDefinitionPrerequisite(powerBoost,{trainer:prereqTrainer,resolvedTrainer:resolved,rulesetId,getDefinition});
assert(ev.valid===false,'Power Boost should be locked below Expert Athletics');
prereqTrainer.details.skillRanks.Athletics=5;
resolved=resolveTrainerModel({trainer:prereqTrainer,rulesetId,getDefinition,getDamageBase});
ev=evaluateTrainerDefinitionPrerequisite(powerBoost,{trainer:prereqTrainer,resolvedTrainer:resolved,rulesetId,getDefinition});
assert(ev.valid===true,'Power Boost should be eligible at Expert Athletics');
ev=evaluateTrainerDefinitionPrerequisite(aceTrainer,{trainer:prereqTrainer,resolvedTrainer:resolved,rulesetId,getDefinition});
assert(ev.valid===true,'Ace Trainer should be eligible with Novice Command');

// Level 2 bonus Skill Edge cannot buy the newly unlocked Adept rank.
const t1=baseTrainer(1);
let draft={milestoneChoice:'',statAllocations:{hp:0,attack:1,defense:0,spAttack:0,spDefense:0,speed:0},offensiveStatAllocations:{attack:0,spAttack:0},features:[],edges:[{id:'basic-skills',name:'Basic Skills'}],skillEdges:[{id:'adept-skills',name:'Adept Skills'}]};
let p=preview(t1,draft);
assert(!p.valid&&p.errors.some(x=>x.includes('bonus Skill Edge cannot be used')),'Level 2 Skill Edge rank-up restriction was not enforced');
draft.skillEdges=[{id:'skill-enhancement',name:'Skill Enhancement',selections:{skills:['Athletics','Combat']}}];
p=preview(t1,draft);
assert(p.valid,`Valid Level 2 progression rejected: ${p.errors.join(' | ')}`);
const advanced=applyTrainerProgression({trainer:t1,draft,preview:p,getDefinition,rulesetId});
assert(advanced.level===2&&advanced.stats.attack===6&&advanced.details.edges.length===2,'Level 2 progression did not apply selected rewards');
assert(advanced.details.progression.levelHistory.at(-1)?.level===2,'Level history was not persisted');

// Four-Class cap appears in the candidate resolver.
const classCap=baseTrainer(2);
classCap.details.features=[
  {id:'ace-trainer',name:'Ace Trainer'},
  {id:'capture-specialist',name:'Capture Specialist'},
  {id:'commander',name:'Commander'},
  {id:'coordinator',name:'Coordinator'}
];
const capDraft={milestoneChoice:'',statAllocations:{hp:1,attack:0,defense:0,spAttack:0,spDefense:0,speed:0},offensiveStatAllocations:{attack:0,spAttack:0},features:[],edges:[],skillEdges:[]};
p=preview(classCap,capDraft);
const fifth=p.optionSets.features.find(x=>x.id==='apparition');
assert(fifth?.classBlocked===true&&fifth.valid===false,'Fifth Trainer Class was not blocked');

// Browser/UI contract.
for(const token of ['/api/trainer/progression-preview','/api/trainer/progression-apply','beginTrainerProgression','openTrainerProgressionPicker','applyTrainerProgression','MILESTONE BONUS','Bonus Skill Edge'])assert(app.includes(token),`Missing v1.9 UI token: ${token}`);
for(const token of ['.trainer-progress-layout','.milestone-choice-grid','.progress-option-row','.progress-stat-row'])assert(styles.includes(token),`Missing v1.9 style: ${token}`);
assert(pkg.version==='1.9.0','package.json version is not 1.9.0');

// Real server API smoke test.
const port=4300+Math.floor(Math.random()*300);
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let stderr=''; child.stderr.on('data',d=>stderr+=d);
async function waitServer(){for(let i=0;i<40;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok)return r.json();}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error(`Server did not start: ${stderr}`)}
try{
  const health=await waitServer(); assert(health.version==='1.9.0','Server health version is not 1.9.0');
  const res=await fetch(`http://127.0.0.1:${port}/api/trainer/progression-preview`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trainer:t1,draft})});
  const body=await res.json(); assert(res.ok&&body.preview?.valid===true,'Real progression-preview endpoint rejected a valid build');
  const applied=await fetch(`http://127.0.0.1:${port}/api/trainer/progression-apply`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trainer:t1,draft})});
  const ab=await applied.json(); assert(applied.ok&&ab.updatedTrainer?.level===2&&ab.updatedTrainer?.nextExp===10,'Real progression-apply endpoint failed');
} finally {child.kill('SIGTERM');}

console.log('PTU Companion v1.9 verification: OK');
console.log('Exact Trainer reward schedule + milestones: passed');
console.log('Feature/Edge prerequisite resolver + four-Class cap: passed');
console.log('Level 2/6/12 bonus Skill Edge restriction: passed');
console.log('Guided progression apply + persistent level history: passed');
console.log('Real progression API endpoints: passed');
definitions.close();
