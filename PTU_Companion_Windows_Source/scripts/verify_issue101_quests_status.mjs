import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..'),repo=resolve(root,'..');
const paths=[join(root,'static-preview','app.js'),join(repo,'PTU_Companion_Android_Tauri','www','app.js')];
const apps=paths.map(path=>readFileSync(path,'utf8'));
function block(source,startMarker,endMarker){const start=source.indexOf(startMarker),end=source.indexOf(endMarker,start);assert.ok(start>=0&&end>start,`Missing block ${startMarker}`);return source.slice(start,end);}
function extract(source,name){const start=source.indexOf(`function ${name}(`);assert.ok(start>=0,`Missing ${name}`);const next=source.indexOf('\nfunction ',start+1);return source.slice(start,next<0?source.length:next).trim();}

for(const source of apps){
  assert.ok(/\['quests','☑','Quests'\]/.test(source),'Quests navigation entry missing');
  assert.ok(/quests:questsScreen/.test(source),'Quests screen is not routed');
  assert.ok(/format:'ptu-companion-quests',version:1/.test(source),'Quest-only JSON export missing');
  assert.ok(/Replace all quests/.test(source),'Quest replacement choice missing');
  assert.ok(/Quests to be removed:/.test(source),'Quest replacement preview must list existing quests');
  assert.ok(/moveQuestStep/.test(source),'Checklist step reordering controls missing');
  assert.ok(/destination Trainer/i.test(source),'Quest destination preview missing');
  assert.ok(/statusAfflictions/.test(source),'Persistent Pokémon Status Afflictions missing');
  assert.ok(/Advance this Pokémon’s turn/.test(source),'Individual combat turn control missing');
  assert.ok(/statusAfflictionHistory/.test(source),'Reversible status history missing');
  assert.ok(/pokemonStatusClearOnFaint/.test(source),'Fainting status cleanup missing');
}
for(const name of ['trainerStatusSubject','statusAfflictionSubject','trainerDerived','ensureTrainerDetails','changeTrainerHp','pokemonStatusRows','pokemonStatusSetRaw','pokemonStatusSnapshot','pokemonStatusHistory','pokemonStatusAfflictionToggle','pokemonStatusRevert','pokemonStatusImmune','pokemonStatusCombatStagePenalty','advancePokemonStatusTurn','trainerQuests','setQuestStatus','toggleQuestStep','moveQuestStep']){
  assert.equal(extract(apps[0],name),extract(apps[1],name),`${name} differs between Windows and Android`);
}

const legacyParticipant={conditions:{statusAfflictions:['Burned']}};
const catalogState={status:{ruleset:{packs:[]}}};
const state={trainer:{id:'william',name:'William',title:'Trainer',level:20,stats:{hp:12,defense:10,spDefense:10,speed:10},derived:{maxHp:89},details:{currentHp:86,tempHp:0,injuries:0,features:[],edges:[],moves:[],quests:[],skillRanks:{}}},pokemon:[],ui:{round:1,combat:{participants:{},participantIds:[]}}};
const quests=[];let formResult=null,confirmResult=true,downloaded=null,commitCount=0,toasts=[];
const context=vm.createContext({structuredClone, catalogState, state,trainer:()=>state.trainer,pokemon:id=>state.pokemon.find(p=>p.id===id),trainerResolved:()=>null,trainerMaxAp:()=>9,trainerBoundAp:()=>0,rankValue:()=>2,syncBackgroundSkillRanks(){},TRAINER_SKILLS:['Athletics'],injuryHealingHpLimit:(max,injuries)=>Math.floor(max*(10-injuries)/10),uid:(prefix='id')=>`${prefix}-${Math.random()}`,commit(){commitCount++;},persist(){},render(){},toast:(message)=>toasts.push(message),styledForm:async()=>formResult,styledConfirm:async()=>confirmResult,downloadJson:(data)=>{downloaded=data;},pokemonCombatParticipant:(id)=>id==='legacy'?legacyParticipant:null,pokemonCombatLog(){},pokemonStatusSyncCombat(){},pokemonCombatSlug:x=>String(x||'').toLowerCase(),pokemonStatusRulesSource:()=> 'ptu-core-1.05',pokemonCombatTurn(){},tempHpValue:p=>Number(p?.tempHp||0),esc:x=>String(x??''),QUEST_STATUSES:['Pending','In Progress','Completed']});
vm.runInContext(extract(apps[0],'trainerDerived'),context);
vm.runInContext(extract(apps[0],'ensureTrainerDetails'),context);
vm.runInContext(extract(apps[0],'changeTrainerHp'),context);
vm.runInContext(extract(apps[0],'trainerStatusSubject'),context);
vm.runInContext(extract(apps[0],'statusAfflictionSubject'),context);
vm.runInContext(block(apps[0],'const QUEST_STATUSES=','const STATUS_AFFLICTION_RULES='),context);
vm.runInContext(block(apps[0],'const STATUS_AFFLICTION_RULES=','function dashboard(){'),context);
vm.runInContext(extract(apps[0],'pokemonStatusCombatStagePenalty'),context);
vm.runInContext(extract(apps[0],'pokemonCombatStageValue'),context);
vm.runInContext(extract(apps[0],'pokemonCombatFrequencyAvailability'),context);

context.ensureTrainerDetails(state.trainer);
assert.equal(state.trainer.details.currentHp,86,'HP import must retain current HP while loading the effective maximum');
assert.equal(state.trainer.derived.maxHp,89,'Persisted effective Max HP must survive the local fallback');
context.changeTrainerHp(5);
assert.equal(state.trainer.details.currentHp,89,'The +5 control restores the three missing real HP');
assert.equal(state.trainer.details.tempHp,2,'Only the overflow becomes Temporary HP');

const quest={id:'q1',title:'Find the Lab',description:'',status:'Pending',assignees:[],deadline:'',notes:'',steps:[]};state.trainer.details.quests.push(quest);
formResult={text:'Talk to the researcher',notes:'At the north gate'};await context.addQuestStep('q1');
assert.equal(quest.steps[0].text,'Talk to the researcher');
context.toggleQuestStep('q1',quest.steps[0].id,true);assert.equal(quest.steps[0].completed,true);quest.steps.push({id:'step-2',text:'Second',completed:false});context.moveQuestStep('q1','step-2',-1);assert.equal(quest.steps[0].id,'step-2','Quest checklist order can be changed and serialized');
context.setQuestStatus('q1','Completed');assert.equal(quest.status,'Completed');
context.exportQuests();assert.equal(downloaded.format,'ptu-companion-quests');assert.equal(downloaded.quests[0].steps.find(step=>step.notes)?.notes,'At the north gate');
const roundTrip=JSON.parse(JSON.stringify(state.trainer.details.quests));assert.equal(roundTrip[0].steps.some(step=>step.completed),true,'Quest checklist must survive state serialization');

const pokemon={id:'p1',name:'Testmon',species:'Testmon',types:['normal'],hp:50,maxHp:100,tempHp:0,details:{statusAfflictions:[],statusAfflictionHistory:[]}};state.pokemon.push(pokemon);
context.pokemonStatusAfflictionToggle('p1','Burned',true);assert.equal(pokemon.details.statusAfflictions[0].name,'Burned');const legacyPokemon={id:'legacy',name:'Legacy',types:['normal'],hp:40,maxHp:40,tempHp:0,details:{}};state.pokemon.push(legacyPokemon);context.pokemonStatusAfflictionToggle('legacy','Burned',false);assert.equal(legacyPokemon.details.statusAfflictions.length,0,'Clearing a migrated legacy status must not resurrect it');assert.equal(legacyParticipant.conditions.statusAfflictions.length,0,'Clear must synchronize the migrated combat ledger');
context.pokemonStatusRevert('p1');assert.equal(pokemon.details.statusAfflictions.length,0,'Status changes can be reversed outside combat');
context.pokemonStatusAfflictionToggle('p1','Burned',true);pokemon.hp=49;const beforeConflict=toasts.length;context.pokemonStatusRevert('p1');assert.equal(toasts.length,beforeConflict+1,'Later HP changes must block silent history overwrite');assert.equal(pokemon.hp,49);
pokemon.hp=20;context.pokemonStatusAfflictionToggle('p1','Poisoned',true);context.pokemonStatusAfflictionToggle('p1','Badly Poisoned',true);
formResult={standard:'yes',prevented:'no',attackDamage:'no'};const firstTurn=await context.advancePokemonStatusTurn('p1',false);assert.equal(firstTurn.damage,15,'Burn/Poison ticks and the first 5 HP Badly Poisoned loss stack');assert.equal(pokemon.hp,5);
formResult={standard:'yes',prevented:'no',attackDamage:'no'};const nextTurn=await context.advancePokemonStatusTurn('p1',false);assert.equal(nextTurn.damage,20,'Badly Poisoned damage doubles on the next consecutive round');assert.equal(pokemon.hp,0,'Damage applies to current HP');assert.equal(pokemon.details.statusAfflictions.length,0,'Fainting cures tracked afflictions');
assert.equal(context.pokemonStatusCombatStagePenalty({...pokemon,details:{statusAfflictions:[{name:'Paralyzed'}]}},'speed'),-4);

// Trainer status changes use currentHp and the effective Max HP without touching Pokémon.
const trainerId='trainer:william',trainerDetails=state.trainer.details;
trainerDetails.currentHp=50;trainerDetails.tempHp=2;
context.pokemonStatusAfflictionToggle(trainerId,'Burned',true);
assert.equal(trainerDetails.statusAfflictions[0].name,'Burned');
formResult={standard:'yes',prevented:'no',attackDamage:'no'};
const trainerTurn=await context.advancePokemonStatusTurn(trainerId,false);
assert.equal(trainerTurn.damage,8,'Trainer tick uses the effective maximum of 89');
assert.equal(trainerDetails.currentHp,44);assert.equal(trainerDetails.tempHp,0);
assert.ok(trainerDetails.statusAfflictionHistory.at(-1).notes.length);
context.pokemonStatusRevert(trainerId);assert.equal(trainerDetails.currentHp,50);assert.equal(trainerDetails.tempHp,2);
const trainerSave=JSON.parse(JSON.stringify(state.trainer));
assert.equal(trainerSave.details.statusAfflictions[0].name,'Burned','Trainer statuses survive campaign serialization');
trainerDetails.currentHp=49;const conflictToasts=toasts.length;context.pokemonStatusRevert(trainerId);
assert.equal(toasts.length,conflictToasts+1);assert.equal(trainerDetails.currentHp,49);
context.pokemonStatusAfflictionToggle(trainerId,'Burned',false);assert.equal(trainerDetails.statusAfflictions.length,0);
context.pokemonStatusAfflictionToggle('trainer:another','Poisoned',true);
assert.equal(trainerDetails.statusAfflictions.length,0,'An inactive Trainer ID cannot change the current Trainer or Pokémon');
context.pokemonStatusAfflictionToggle(trainerId,'Poisoned',true);context.changeTrainerHp(-100);
assert.equal(trainerDetails.currentHp,0);assert.equal(trainerDetails.statusAfflictions.length,0,'Normal Trainer damage clears afflictions on faint');
// Shared engine effects preserve base/manual stages and honor the active supplement.
for(const relative of ['../rules/trainer-engine.mjs','../../PTU_Companion_Android_Tauri/www/rules/trainer-engine.mjs']){
  const {resolveTrainerModel}=await import(relative);
  const t={id:'status-test',name:'Trainer',level:20,stats:{hp:12,attack:10,defense:10,spAttack:10,spDefense:10,speed:10},details:{features:[],edges:[],moves:[],combatStages:{defense:1},statusAfflictions:[{name:'Burned'},{name:'Poisoned'},{name:'Paralyzed'}]}};
  const args={trainer:t,rulesetId:'test',getDefinition:()=>null,getDamageBase:()=>null};
  const core=resolveTrainerModel(args);
  assert.equal(core.stats.stages.defense,-1);assert.equal(core.stats.stages.spDefense,-2);assert.equal(core.stats.stages.speed,-4);
  assert.equal(t.details.combatStages.defense,1,'Affliction penalties must not change manual stages');assert.equal(t.stats.defense,10);
  const february=resolveTrainerModel({...args,statusRulesSource:'ptu-february-2016-playtest'});
  assert.equal(february.stats.stages.speed,0,'February paralysis does not reduce Speed CS');
  t.details.statusAfflictions=[{name:'Frozen'}];const frozen=resolveTrainerModel(args);
  assert.equal(frozen.derived.physicalEvasion,0);assert.equal(frozen.derived.specialEvasion,0);assert.equal(frozen.derived.speedEvasion,0);
  t.details.statusAfflictions=[];assert.equal(resolveTrainerModel(args).stats.stages.defense,1,'Clearing status restores original resolved stages');
}
trainerDetails.currentHp=50;context.pokemonStatusAfflictionToggle(trainerId,'Burned',true);
context.styledForm=async()=>{trainerDetails.currentHp=49;return {standard:'yes'};};
const changedTurn=await context.advancePokemonStatusTurn(trainerId,false);
assert.equal(changedTurn?.damage,undefined);assert.equal(trainerDetails.currentHp,49,'An open turn dialog cannot apply stale effects after HP changes');
context.pokemonStatusAfflictionToggle(trainerId,'Sleep',true);
context.pokemonStatusClearVolatile(context.trainerStatusSubject());
assert.equal(trainerDetails.statusAfflictions.length,1,'Leaving battle clears volatile Sleep and preserves persistent Burn');

console.log('Issue #101 HP healing, #24 Trainer quests/checklists/JSON and #98 Status Afflictions verified in both frontends.');
