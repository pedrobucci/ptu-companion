import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {setTimeout as delay} from 'node:timers/promises';
import {resolveMoveCapabilities} from '../rules/move-capabilities.mjs';
import {resolveTrainerModel} from '../rules/trainer-engine.mjs';
import {DefinitionRepository} from '../definitions/repository.mjs';
import {evaluatePokeEdgePrerequisite} from '../rules/pokemon-engine.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),repo=dirname(root),port=42106,base=`http://127.0.0.1:${port}`;
const dataDir=await mkdtemp(join(tmpdir(),'ptu-issues99-106-'));
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_PORT:String(port),PTU_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
let stderr='';child.stderr.on('data',b=>stderr+=b);
async function call(api,path,body){const response=await api(path,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await response.json();assert(response.ok,`${path}: ${data.error||response.status}`);return data;}
const definitions=new DefinitionRepository(join(root,'seed/definitions/ptu_seed_v1.0.sqlite3'));
try{
  let ready=false;for(let i=0;i<100&&!ready;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch{}if(!ready)await delay(100);}assert(ready,stderr);
  globalThis.window={fetch:globalThis.fetch};globalThis.location={href:'https://app.local/index.html'};
  globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  vm.runInThisContext(await readFile(join(repo,'PTU_Companion_Android_Tauri/www/mobile-data.js'),'utf8'));
  const {mobileFetch}=await import('../../PTU_Companion_Android_Tauri/www/mobile-api.mjs');
  const rulesetId='all-provided-material';
  const fly=definitions.getResolved({rulesetId,kind:'moves',id:'fly'});
  for(const baseSky of [0,5]){
    const caps=baseSky?[{name:'Sky',capability_id:'sky',kind:'movement',value:baseSky}]:[];
    const before=JSON.stringify(caps),result=resolveMoveCapabilities(caps,[fly,fly]);
    assert.equal(result.capabilities.find(c=>c.name==='Sky').value,baseSky+3);assert.equal(result.applied.length,1);assert.equal(JSON.stringify(caps),before);
    assert.equal(resolveMoveCapabilities(caps,[]).capabilities.some(c=>c.name==='Sky'),!!baseSky,'forgetting removes only the move contribution');
  }
  const teleport=definitions.getResolved({rulesetId,kind:'moves',id:'teleport'});
  assert.equal(resolveMoveCapabilities([{name:'Teleporter',value:8}],[teleport]).capabilities[0].value,8,'absolute grants never lower existing capability');
  const trainer={level:10,stats:{},details:{moves:[{id:'fly'},{id:'ember'}],features:[],edges:[],skillRanks:{}}};
  const model=resolveTrainerModel({trainer,rulesetId,getDefinition:q=>definitions.getResolved(q),getDamageBase:db=>definitions.getDamageBase(db)});
  assert.equal(model.capabilities.sky,3);assert(model.grantedCapabilities.some(c=>c.name==='Firestarter'));
  for(const [platform,api] of [['Windows',(path,init)=>fetch(base+path,init)],['Android',mobileFetch]]){
    const pokemon={id:'qa',name:'QA',species:'Pikachu',level:30,types:['electric'],hp:50,maxHp:50,details:{createdFromDefinition:true,speciesDefinitionId:'pikachu',linkedRulesetId:rulesetId,moves:[{id:'fly',name:'Fly'},{id:'ember',name:'Ember'}],abilities:[],pokeEdges:[],tutorPointsEarned:10,tutorPointsSpent:0,statAllocations:{}}};
    const opts=await call(api,'/api/pokemon/training-options',{pokemon,rulesetId,trainer});
    const ranged=opts.edges.find(e=>e.id==='basic-ranged-attacks');
    assert.equal(ranged.prerequisite.valid,true,platform+': any qualifying capability satisfies alternatives');
    assert(ranged.targetRequired);assert(ranged.targetOptions.some(o=>o.id==='firestarter'),'move-granted capability is available');
    assert(ranged.targetOptions.some(o=>o.id==='zapper'));assert(!ranged.targetOptions.some(o=>o.id==='fountain'));
    let result=await call(api,'/api/pokemon/training-action-preview',{action:'acquire_edge',pokemon,rulesetId,trainer,edgeId:'basic-ranged-attacks',targetId:'firestarter'});
    assert(result.valid,result.errors?.join(';'));assert.equal(result.resultRecord.targetId,'firestarter');
    pokemon.details=result.details;
    result=await call(api,'/api/pokemon/training-action-preview',{action:'acquire_edge',pokemon,rulesetId,trainer,edgeId:'basic-ranged-attacks',targetId:'firestarter'});
    assert.equal(result.valid,false,'same capability cannot be selected twice');
    result=await call(api,'/api/pokemon/training-action-preview',{action:'acquire_edge',pokemon,rulesetId,trainer,edgeId:'basic-ranged-attacks',targetId:'fountain'});
    assert.equal(result.valid,false,'unowned capability is not a valid target');
    const edge=await call(api,'/api/definitions/poke_edges/aura-pulse?ruleset='+rulesetId);
    assert.match(edge.definition.prerequisites,/Trainer with Aura Pulse/);
    for(const [ownerCaps,expected] of [[null,null],[[],false],[['Aura Pulse'],true]])assert.equal(evaluatePokeEdgePrerequisite(edge.definition,{level:30,capabilities:['Aura Reader'],trainerCapabilities:ownerCaps}).valid,expected,'Aura Reader is the Core p.303 capability; owning Trainer is checked separately');
    const lucario={...pokemon,species:'Lucario',details:{...pokemon.details,speciesDefinitionId:'lucario'}};
    const contextualOwner={...trainer,details:{...trainer.details,moves:[],features:[{id:'aura-reader'}],skillRanks:{Intuition:4}}};
    const auraOptions=await call(api,'/api/pokemon/training-options',{pokemon:lucario,rulesetId,trainer:contextualOwner});
    assert.equal(auraOptions.edges.find(row=>row.id==='aura-pulse').prerequisite.valid,null,'An unresolved scene Aura Pulse requires actual table confirmation');
    const detail=await call(api,'/api/pokemon/reference-data',{pokemon,rulesetId,trainer});
    assert(JSON.stringify(detail).includes('"sky"'),platform+': resolved reference includes the move capability');
  }
  for(const app of [join(root,'static-preview/app.js'),join(repo,'PTU_Companion_Android_Tauri/www/app.js')]){
    const source=await readFile(app,'utf8'),start=source.indexOf('const STATUS_AFFLICTION_RULES='),end=source.indexOf('function trainerStatusSubject(',start);
    const context=vm.createContext({catalogState:{statusCategory:'all'},pokemonStatusRulesSource:()=> 'ptu-core-1.05'});vm.runInContext(source.slice(start,end),context);
    assert.equal(context.statusAfflictionCatalog().length,14);assert.equal(context.localStatusAfflictionRows('persistent').length,5);
    context.catalogState.statusCategory='Volatile';assert.equal(context.localStatusAfflictionRows().length,9);
    context.pokemonStatusRulesSource=()=> 'ptu-february-2016-playtest';assert.match(context.statusAfflictionCatalog().find(d=>d.name==='Confused').effect,/1d2/);
    assert.equal(context.statusAfflictionCatalog().find(d=>d.name==='Confused').sourcePage,'2');
    assert.match(source,/Time available \(optional\).*type:'text'/);assert(!source.includes("label:'Deadline (optional)',type:'date'"));
    const builder={breeder:true,selected:{definition:{id:'pikachu',name:'Pikachu',types:['Electric']}},form:{level:1,nickname:'Hatchling',selectedMoves:[],selectedAbilities:[],location:'storage'},preview:{valid:true,finalStats:{hp:5,attack:5},maxHp:26,eligibleMoves:[],tutorPoints:{earned:1,remaining:1},moveLimit:{base:6,modifier:0,effective:6}}};
    const owner={details:{},history:[]},state={pokemon:[],ui:{}};let commits=0;
    const buildContext=vm.createContext({pokemonBuilderState:builder,state,catalogState:{status:{activeRulesetId:rulesetId}},trainer:()=>owner,uid:()=> 'hatched',normalizePokemonGender:value=>value||'None',toast(){},invalidateCreatureReference(){},commit(){commits++;},setTimeout(){},pokecenterThisOnesSpecial:async()=>null});
    const begin=source.indexOf('async function createPokemonFromBuilder(){');vm.runInContext(source.slice(begin,source.indexOf('\n}',begin)+2),buildContext);
    await buildContext.createPokemonFromBuilder();assert.equal(state.pokemon.length,0,'cancelling traits never registers a partial Pokémon');assert.equal(commits,0);
    buildContext.pokecenterThisOnesSpecial=async(_,args)=>({details:{...args.draftPokemon.details,breeding:{parents:[],gmAssisted:true}},types:['fire'],maxHp:30,finalStats:{hp:6,attack:7},trainerCaretaking:{thisOnesSpecialUsage:{uses:1}}});
    await buildContext.createPokemonFromBuilder();assert.equal(state.pokemon.length,1);assert.equal(state.pokemon[0].hp,30);assert.equal(state.pokemon[0].types[0],'fire');assert.equal(owner.details.caretaking.thisOnesSpecialUsage.uses,1);assert.equal(commits,1);
    assert.equal(JSON.parse(JSON.stringify(state)).pokemon[0].details.breeding.parents.length,0,'parents are optional and roundtrip with the individual Pokémon');
  }
  for(const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]){
    const png=await readFile(join(repo,`PTU_Companion_Android_Tauri/src-tauri/icons/android/mipmap-${density}/ic_launcher.png`));
    assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
  }
  const config=JSON.parse(await readFile(join(repo,'PTU_Companion_Android_Tauri/src-tauri/tauri.conf.json'),'utf8'));assert.equal(config.identifier,'com.ptu.companion');
  const buildScript=await readFile(join(repo,'PTU_Companion_Android_Tauri/docker/tauri-build.sh'),'utf8');assert(buildScript.includes('cp -R "$TAURI_DIR/icons/android/."'));
  console.log('Issues #13/#74/#99/#106/#107: API parity, capabilities, prerequisites, status reference, quest duration, atomic Breeder creation and launcher assets passed.');
}finally{definitions.close();child.kill();await delay(300);await rm(dataDir,{recursive:true,force:true});}
