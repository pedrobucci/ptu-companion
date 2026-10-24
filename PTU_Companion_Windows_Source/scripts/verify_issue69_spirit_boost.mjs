import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import vm from 'node:vm';
const root=dirname(dirname(fileURLToPath(import.meta.url))),repo=dirname(root),port=42170,base=`http://127.0.0.1:${port}`;
const dataDir=await mkdtemp(join(tmpdir(),'ptu-spirit-boost-'));
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_PORT:String(port),PTU_DATA_DIR:dataDir},stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.on('data',b=>stderr+=b);
const rulesetId='all-provided-material',statKeys=['attack','defense','special_attack','special_defense','speed'];
const creature=(id,stat='speed')=>({id,name:id,species:'Pikachu',level:100,hp:100,maxHp:100,types:['electric'],storage:false,combatStages:{},details:{speciesDefinitionId:'pikachu',nature:'Hardy',statAllocations:{hp:60,[stat]:50},moves:[{id:'tackle'},{id:'ember'}],pokeEdges:[],abilities:[]}});
const trainerFixture=()=>({id:'spirit',name:'Spirit QA',level:30,stats:{},details:{currentHp:20,currentAp:11,features:[{id:'channeler'},{id:'spirit-boost'}],edges:[],moves:[],skillRanks:{Intuition:5},boundEntities:['target','source','other'].map(id=>({id:'bound-entity-'+id,name:id,pokemonId:id,kind:'pokemon_link',active:true,channeling:true,distance:0,sourceId:'core'}))}});
const apps=await Promise.all(['static-preview/app.js','../PTU_Companion_Android_Tauri/www/app.js'].map(p=>readFile(join(root,p),'utf8')));
function functionSource(app,name){const start=app.indexOf('function '+name+'('),end=app.indexOf('\nfunction ',start+1),asyncEnd=app.indexOf('\nasync function ',start+1);assert(start>=0,name);return app.slice(start,Math.min(...[end,asyncEnd].filter(n=>n>=0))).trim();}
try{
 let ready=false;for(let i=0;i<100&&!ready;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch{}if(!ready)await delay(100);}assert(ready,stderr);
 globalThis.window={fetch:globalThis.fetch};globalThis.location={href:'https://app.local/index.html'};globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
 vm.runInThisContext(await readFile(join(repo,'PTU_Companion_Android_Tauri/www/mobile-data.js'),'utf8'));
 const {mobileFetch}=await import('../../PTU_Companion_Android_Tauri/www/mobile-api.mjs');
 for(const [platform,api] of [['Windows',(path,init)=>fetch(base+path,init)],['Android',mobileFetch]]){
  let trainer=trainerFixture(),pokemon=[creature('target'),creature('source'),creature('other')],context={day:1,scene:1,round:1,combat:{active:true,participantIds:['target','other']}};
  async function call(path,body,method='POST',error){const response=await api(path,{method,headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined}),result=await response.json();if(error){assert.equal(response.status,400,JSON.stringify(result));assert.match(result.error,error);return;}assert(response.ok,platform+': '+JSON.stringify(result));return result;}
  async function action(action,data={},error){const before=JSON.stringify({trainer,pokemon});const result=await call('/api/trainer/bound-entity-preview',{trainer,pokemon,inventory:[],rulesetId,context,action,featureIndex:1,data},'POST',error);assert.equal(JSON.stringify({trainer,pokemon}),before,'preview preserves inputs');if(result?.updatedTrainer)trainer=result.updatedTrainer;return result;}
  const bind=(stat,error)=>action('bind-spirit-boost',{targetPokemonId:'target',sourcePokemonId:'source',stat},error),unbind=()=>action('unbind-spirit-boost',{targetPokemonId:'target'});
  const ref=()=>call('/api/pokemon/reference-data',{pokemon:pokemon[0],trainer,rulesetId});
  context.combat.active=false;await bind('speed',/active combat/);context.combat.active=true;
  trainer.details.boundEntities[0].channeling=false;await bind('speed',/Channeled target/);trainer.details.boundEntities[0].channeling=true;
  for(const stat of statKeys){
   pokemon[1]=creature('source',stat);const options=await action('spirit-options');assert.deepEqual(options.sources.find(p=>p.pokemonId==='source').highestStats,[stat]);
   await bind(stat);assert.equal(trainer.details.currentAp,9);assert.equal(trainer.details.features[1].boundChoices.target.stat,stat);
   await bind(stat,/already has a Bound Stratagem/);
   const data=await ref(),feature=data.boundFeatureEffects.find(f=>f.id==='spirit-boost');assert(feature.spiritBoost.valid);const effect=feature.combatModifiers[0];assert.equal(effect.value,5);
   for(const app of apps){
    const sandbox=vm.createContext({});vm.runInContext(functionSource(app,'pokemonCombatBoundFeatureModifiers'),sandbox);
    const bonus=category=>sandbox.pokemonCombatBoundFeatureModifiers(data,{definition:{category,range:'Melee',ac:2},resolvedDamage:category==='status'?null:{}}).filter(e=>e.targetPath==='combat.damage_bonus').reduce((n,e)=>n+e.value,0);
    assert.equal(bonus('physical'),stat==='attack'?5:0);assert.equal(bonus('special'),stat==='special_attack'?5:0);assert.equal(bonus('status'),0);
    const unit=creature('unit'),fields={'combat-incoming-class':{value:'physical'},'combat-incoming-type':{value:'normal'},'combat-incoming-ac':{value:''},'combat-incoming-accuracy':{value:''},'combat-incoming-evasion':{value:'0'},'combat-incoming-damage':{value:'50'},'combat-incoming-defense':{value:'10'},'combat-incoming-dr':{value:'0'}};delete unit.details.speciesDefinitionId;
    const incoming=vm.createContext({document:{getElementById:id=>fields[id]},pokemon:()=>unit,pokemonCombatReferenceState:{pokemonId:'unit',data},pokemonCombatSlug:s=>String(s).toLowerCase(),tempHpValue:()=>0,syncPokemonTempHpPersistence(){},pokemonStatusRows:()=>[],pokemonStatusClearOnFaint(){},pokemonStatusSyncCombat(){},pokemonCombatLog(){},commit(){},closeModal(){},render(){},toast:(message,type)=>{if(type==='error')throw new Error(message);}});
    vm.runInContext(functionSource(app,'pokemonCombatIncomingAttackResolution')+'\nasync '+functionSource(app,'pokemonCombatRecordIncomingAttack'),incoming);
    await incoming.pokemonCombatRecordIncomingAttack('unit');assert.equal(unit.hp,100-(stat==='defense'?35:40));unit.hp=100;fields['combat-incoming-class'].value='special';await incoming.pokemonCombatRecordIncomingAttack('unit');assert.equal(unit.hp,100-(stat==='special_defense'?35:40));
    const initiative=vm.createContext({pokemonStatusCombatStagePenalty:()=>0,pokemonCombatStageValue:(n,s)=>Math.floor(n*(s>=0?1+s*.2:1+s*.1)),pokemonStatusRulesSource:()=> 'ptu-core-1.05',pokemonStatusRows:()=>[]});vm.runInContext(functionSource(app,'pokemonCombatInitiativePanel'),initiative);
    const expected=data.modifierSummary.effectiveStats.speed+(stat==='speed'?5:0);assert(initiative.pokemonCombatInitiativePanel(pokemon[0],data).includes('Initiative '+expected));
   }
   await unbind();assert.equal(trainer.details.currentAp,11);assert(!trainer.details.features[1].boundChoices.target);assert(!(await ref()).boundFeatureEffects.some(f=>f.id==='spirit-boost'));
  }
  pokemon[1]=creature('source','attack');pokemon[1].details.statAllocations={hp:8,attack:50,defense:52};
  const tied=await action('spirit-options');assert.deepEqual(tied.sources.find(p=>p.pokemonId==='source').highestStats,['attack','defense']);await bind('speed',/highest Combat Stats/);await bind('defense');
  pokemon[1].combatStages={attack:6};assert.equal((await ref()).boundFeatureEffects.find(f=>f.id==='spirit-boost').spiritBoost.stat,'defense','selection is preserved from activation');
  trainer.details.skillRanks.Intuition=6;assert.equal((await ref()).boundFeatureEffects[0].combatModifiers[0].value,6,'bonus follows current effective Intuition Rank');
  await action('bind-spirit-boost',{targetPokemonId:'other',sourcePokemonId:'source',stat:'attack'});assert.equal(trainer.details.currentAp,7);assert.equal(Object.keys(trainer.details.features[1].boundChoices).length,2);
  const saved=await call('/api/state',null,'GET');saved.state.trainer.details=trainer.details;saved.state.pokemon=pokemon.map(p=>({...saved.state.pokemon[0],...p}));await call('/api/state',{state:saved.state},'PUT');const loaded=await call('/api/state',null,'GET');assert.deepEqual(loaded.state.trainer.details.features[1].boundChoices,trainer.details.features[1].boundChoices);
  const stop=await call('/api/trainer/bound-entity-preview',{trainer,pokemon,rulesetId,context,inventory:[],action:'stop-channel',entityId:'bound-entity-target'});trainer=stop.updatedTrainer;assert.equal(trainer.details.currentAp,9);assert(!trainer.details.features[1].boundChoices.target);assert(trainer.details.features[1].boundChoices.other);
  // A bound Stratagem of any source prevents Spirit Boost on the same target.
  trainer=trainerFixture();trainer.details.features.push({id:'capricious-whirl',bound:true,boundTargetIds:['target'],boundApCostEach:2,boundStratagem:true});trainer.details.currentAp=9;await bind('attack',/already has a Bound Stratagem/);
  trainer=trainerFixture();pokemon[1].combatStages={defense:6};const staged=await action('spirit-options');assert.deepEqual(staged.sources.find(p=>p.pokemonId==='source').highestStats,['defense']);
  await action('bind-spirit-boost',{targetPokemonId:'target',sourcePokemonId:'source',stat:'speed',stats:{speed:999}},/highest Combat Stats/);
  trainer.details.currentAp=1;await bind('defense',/available AP/);
  trainer=trainerFixture();trainer.details.features[1]={id:'spirit-boost',bound:true,boundTargetIds:['target'],boundApCostEach:2,boundStratagem:true};trainer.details.currentAp=9;assert.equal((await ref()).boundFeatureEffects[0].spiritBoost.valid,false,'legacy missing choice never fabricates a bonus');
  trainer=trainerFixture();pokemon[1]=creature('source','defense');pokemon[1].combatStages={defense:6};pokemon[1].details.statusAfflictions=[{name:'Burned'}];const burned=await action('spirit-options');assert.equal(burned.sources.find(p=>p.pokemonId==='source').stats.defense,97,'highest-stat comparison uses resolved Combat Stages including Burn');
  await action('bind-spirit-boost',{targetPokemonId:'target',sourcePokemonId:'target',stat:'speed'});assert.equal(trainer.details.features[1].boundChoices.target.sourcePokemonId,'target','the target may be its own reference');await unbind();
 }
 for(const [index,app] of apps.entries()){
  const pending=[],pokemon=creature('target'),trainer=trainerFixture(),ctx=vm.createContext({pokemon:()=>pokemon,trainer:()=>trainer,catalogState:{status:{activeRulesetId:rulesetId}},render(){},fetch:()=>new Promise(resolve=>pending.push(resolve))});
  vm.runInContext(app.slice(app.indexOf('let pokemonCombatReferenceSequence='),app.indexOf('let pokemonCombatReferenceSequence=')+app.slice(app.indexOf('let pokemonCombatReferenceSequence=')).indexOf('\nfunction ensurePokemonCombatUi')),ctx);
  vm.runInContext('async '+functionSource(app,'loadPokemonCombatReferenceData'),ctx);
  const first=ctx.loadPokemonCombatReferenceData('target',true);ctx.invalidatePokemonCombatReferenceData();trainer.details.currentAp=9;const second=ctx.loadPokemonCombatReferenceData('target',true);
  pending[1]({ok:true,json:async()=>({fresh:true})});await second;pending[0]({ok:true,json:async()=>({fresh:false})});await first;assert.equal(vm.runInContext('pokemonCombatReferenceState.data.fresh',ctx),true,'stale combat response cannot restore released modifiers');
  const ui=await readFile(join(root,index?'../PTU_Companion_Android_Tauri/www/bound-entities-ui.js':'static-preview/bound-entities-ui.js'),'utf8');let called=0,forms=0;
  const cancel=vm.createContext({trainer:()=>trainer,boundEntityPreview:async()=>({targets:[{pokemonId:'target',name:'Target'}],sources:[{pokemonId:'source',name:'Source',stats:{speed:10},highestStats:['speed']}]}),styledForm:async()=>++forms===1?{targetPokemonId:'target',sourcePokemonId:'source'}:null,applyBoundEntityAction:()=>called++,toast(){}});vm.runInContext(ui.slice(ui.indexOf('async function openTrainerSpiritBoostBinding(')),cancel);await cancel.openTrainerSpiritBoostBinding(1);assert.equal(called,0,'cancelling stat choice leaves AP unchanged');
  const feature=trainer.details.features[1];Object.assign(feature,{bound:true,boundTargetIds:['target','other'],boundApCostEach:2,boundStratagem:true,boundChoices:{target:{stat:'speed'},other:{stat:'defense'}}});trainer.details.currentAp=7;
  const release=vm.createContext({ensureTrainerDetails:()=>trainer.details,trainerDerived:()=>({maxAp:11,boundAp:4}),trainerBoundAp:()=>4,trainerMaxAp:()=>11,trainerFeatureBinding:()=>({apCost:2,stratagem:true}),trainerFeatureBoundTargets:f=>f.boundTargetIds||[],trainerFeatureBindingCost:()=>2});vm.runInContext(functionSource(app,'releaseTrainerStratagems'),release);assert.equal(release.releaseTrainerStratagems(),4);assert.equal(trainer.details.currentAp,11);assert.equal(Object.keys(feature.boundChoices).length,0);
 }
 console.log('Spirit Boost: Windows/Android API, five class-filtered effects, stats/ties, Stratagem conflicts, AP, persistence, cleanup, cancelled choices and stale combat responses passed.');
}finally{child.kill();await delay(300);await rm(dataDir,{recursive:true,force:true});}
