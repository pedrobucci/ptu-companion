import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {setTimeout as delay} from 'node:timers/promises';
import {DefinitionRepository} from '../definitions/repository.mjs';
import {buildPokemonPreview,autoBalancedAllocations} from '../rules/pokemon-engine.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url))),repo=dirname(root);
const dataDir=await mkdtemp(join(tmpdir(),'ptu-issue32-')),port=42132;
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_PORT:String(port),PTU_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
let serverErrors='';server.stderr.on('data',b=>serverErrors+=b);
const definitions=new DefinitionRepository(join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'));
const copy=v=>JSON.parse(JSON.stringify(v)),same=(a,b)=>assert.deepEqual(copy(a),copy(b));
const storage={m:new Map(),getItem(k){return this.m.get(k)||null;},setItem(k,v){this.m.set(k,String(v));}};
const rulesetId='all-provided-material',species=definitions.getResolved({rulesetId,kind:'species',id:'charcadet'});
const creation=buildPokemonPreview({species,level:24,nature:'Hardy',allocations:autoBalancedAllocations({baseStats:species.baseStats,nature:'Hardy',level:24}),selectedAbilities:['Flash Fire','Blaze'],selectedMoves:[],preEvolutionSpecies:[],moveLimitModifier:0,gmOverride:false});
assert(creation.valid,creation.errors.join('; '));
const fixture={id:'qa-reversal',name:'QA Charcadet',species:'Charcadet',level:24,types:['fire'],hp:creation.maxHp,maxHp:creation.maxHp,tempHp:0,injuries:0,storage:false,rosterIds:[],combatStages:{},details:{createdFromDefinition:true,speciesDefinitionId:'charcadet',speciesVersionId:species.versionId,speciesContentPackId:species.contentPackId,linkedRulesetId:rulesetId,nature:'Hardy',abilities:['Flash Fire','Blaze'],moves:[],pokeEdges:[],statAllocations:creation.statAllocations,finalStats:creation.finalStats,experience:definitions.getPokemonExperience(24).cumulative_exp,tutorPointsEarned:creation.tutorPoints.earned,tutorPointsSpent:0,tutorPointsRemaining:creation.tutorPoints.remaining,moveLimitEffective:6,formState:{schemaVersion:1,baseFormId:'base',activeFormId:null},notes:'Keep notes',progressionHistory:[]}};
let helpers;
try{
  let ready=false;for(let i=0;i<100&&!ready;i++){try{ready=(await fetch(`http://127.0.0.1:${port}/api/health`)).ok;}catch{}if(!ready)await delay(100);}assert(ready,serverErrors);
  globalThis.window={fetch:globalThis.fetch};globalThis.localStorage=storage;globalThis.location={href:'https://app.local/index.html'};
  vm.runInThisContext(await readFile(join(repo,'PTU_Companion_Android_Tauri/www/mobile-data.js'),'utf8'));
  const {mobileFetch}=await import('../../PTU_Companion_Android_Tauri/www/mobile-api.mjs');
  for(const [platform,path,api] of [
    ['Windows',join(root,'static-preview/app.js'),(url,init)=>fetch(`http://127.0.0.1:${port}${url}`,init)],
    ['Android',join(repo,'PTU_Companion_Android_Tauri/www/app.js'),mobileFetch]
  ]){
    const source=(await readFile(path,'utf8')).replace(/\r/g,'');
    const start=source.indexOf('/* --- Revert captured Pokémon progressions;'),end=source.indexOf('function pokemonRestatScreen',start);
    const functions=source.slice(start,end),shared=functions.slice(0,functions.indexOf('async function applyPokemonProgression'));
    if(helpers)assert.equal(shared,helpers,'Reversal behavior is identical across platforms');helpers=shared;
    const initial=(await (await api('/api/state')).json()).state;
    fixture.ball='Poké Ball';fixture.heldItem=null;fixture.img='creatures/default.svg';fixture.loyalty=4;fixture.details.tempHp=0;
    fixture.details.pokeEdges=[{id:'advanced-connection',instanceId:'qa-connection',name:'Advanced Connection',cost:2,connectionAbilityId:'static'}];
    fixture.details.tutorPointsSpent=2;fixture.details.tutorPointsRemaining=fixture.details.tutorPointsEarned-2;
    initial.pokemon=[copy(fixture)];initial.selectedPokemonId=fixture.id;initial.ui={screen:'creature'};initial.trainer.history=[{id:'unrelated',date:'2026-10-05',title:'Keep Trainer history',detail:'Independent entry'}];
    let n=0,confirm=async()=>true,lastModal=null,lastToast=null;
    const ctx={state:initial,pokemonProgressState:{},catalogState:{status:{activeRulesetId:rulesetId}},localStorage:storage,STORAGE_KEY:`qa-${platform}`,persistenceMode:'sqlite',saveQueue:Promise.resolve(),location:{protocol:'http:'},console,
      pokemon(id){return ctx.state.pokemon.find(p=>p.id===(id||ctx.state.selectedPokemonId));},trainer(){return ctx.state.trainer;},fetch:api,uid:prefix=>`${prefix}-qa-${++n}`,
      setTimeout(){},invalidateCreatureReference(){},resetPokemonProgressState(){ctx.pokemonProgressState={};},esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),toast(message){lastToast=message;},modal(html){lastModal=html;},styledConfirm:spec=>confirm(spec),
      async revalidatePokemonFormAfterDirectHpMutation(){
        const p=ctx.pokemon(),response=await api('/api/pokemon/forms/apply-event',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pokemon:p,event:{kind:'hp-changed'},rulesetId,currentHp:p.hp,maxHp:p.maxHp,tempHp:p.tempHp,inCombat:false})});
        const payload=await response.json();assert(response.ok&&payload.valid,JSON.stringify(payload));if(payload.pokemon)Object.assign(p,payload.pokemon);return payload;
      },commit(){ctx.persist();}};
    const persistStart=source.indexOf('function persist(){'),persistEnd=source.indexOf('function commit(',persistStart);
    vm.runInNewContext(source.slice(persistStart,persistEnd)+functions+'\nthis.apply=applyPokemonProgression;this.revert=revertPokemonProgression;this.status=pokemonProgressionReversalStatus;',ctx);
    const reload=async()=>{await ctx.saveQueue;const saved=(await (await api('/api/state')).json()).state;ctx.state=copy(saved);return ctx.pokemon();};
    const advance=async(targetLevel,evolutionSpeciesId=null)=>{
      const p=ctx.pokemon(),form={pokemon:copy(p),rulesetId,targetLevel,newStatAllocations:{hp:targetLevel-p.level},selectedMoves:[],selectedAbilities:p.details.abilities,manualEvolutionCondition:true};
      if(evolutionSpeciesId){const target=definitions.getResolved({rulesetId,kind:'species',id:evolutionSpeciesId});form.evolutionSpeciesId=evolutionSpeciesId;form.evolutionAllocations=autoBalancedAllocations({baseStats:target.baseStats,nature:p.details.nature,level:targetLevel});}
      const request=async()=>{const r=await api('/api/pokemon/progression-preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(form)});const result=await r.json();assert(r.ok,JSON.stringify(result));return result.preview;};
      let pv=await request();if(evolutionSpeciesId){form.selectedAbilities=pv.abilitySlots.map(s=>s.options[0].name);pv=await request();}
      const optionalMove=pv.movePool.find(m=>!m.existing)||pv.movePool[0];assert(optionalMove,'fixture offers a progression Move');
      form.selectedMoves=[optionalMove.key];pv=await request();
      assert(pv.valid,`${platform}: ${pv.errors.join('; ')}`);
      ctx.pokemonProgressState={pokemonId:p.id,preview:pv,form:{selectedMoves:form.selectedMoves,selectedAbilities:form.selectedAbilities}};
      await Promise.all([ctx.apply(),ctx.apply()]);assert.equal(p.details.progressionHistory.length,targetLevel-24,'double click creates one event');
      assert.equal(ctx.status(p).reason,null,`${platform}: new capture can be reversed`);await reload();
    };
    await advance(25);const afterFirst=copy(ctx.pokemon());
    assert.equal(afterFirst.details.progressionHistory.length,1,'#79: history is written to the current details after API/form replacement');
    assert.equal(afterFirst.details.tutorPointsEarned,fixture.details.tutorPointsEarned+1);
    assert.equal(afterFirst.details.pokeEdges.length,0,'expired connection removed');
    assert.equal(afterFirst.details.tutorPointsSpent,0,'expired connection cost refunded');
    await advance(26,'ceruledge');let p=ctx.pokemon();assert.equal(p.species,'Ceruledge');
    const evolved=copy(p);
    confirm=async(spec)=>{assert(spec.message.includes('Ceruledge'));assert(!spec.message.includes('speciesVersionId'),'preview contains campaign values rather than storage metadata');return false;};await ctx.revert(p.id);same(p,evolved);confirm=async()=>true;
    for(const change of p.details.progressionHistory[1].reversal.changes){
      const parent=change.path.length===2?p.details:p,key=change.path.at(-1),old=copy({exists:Object.hasOwn(parent,key),value:parent[key]??null});
      parent[key]='changed after progression';assert(ctx.status(p).reason,'later change blocks reversal');
      const beforeBlocked=copy(p);await ctx.revert(p.id);same(p,beforeBlocked);assert(lastModal.includes('blocked'));
      if(old.exists)parent[key]=old.value;else delete parent[key];
    }
    // A change during confirmation must also block, without overwriting it.
    confirm=async()=>{p.level=99;return true;};await ctx.revert(p.id);assert.equal(p.level,99);assert(lastToast.includes('changed'));p.level=evolved.level;confirm=async()=>true;
    const history=p.details.progressionHistory[1];const row=ctx.trainer().history.find(h=>h.id===history.trainerHistoryId);row.title='Manual edit';assert(ctx.status(p).reason);row.title=history.trainerHistoryEntry.title;
    p.name='Renamed after evolution';p.details.notes='Notes edited after evolution';
    await ctx.revert(p.id);p=await reload();const expectedFirst=copy(afterFirst);expectedFirst.name=p.name;expectedFirst.details.notes=p.details.notes;same(p,expectedFirst);
    await ctx.revert(p.id);p=await reload();const expectedStart=copy(fixture);expectedStart.name=p.name;expectedStart.details.notes=p.details.notes;same(p,expectedStart);
    assert.equal(ctx.trainer().history.length,1,'only the corresponding Trainer records are removed');
    assert.equal(ctx.trainer().history[0].id,'unrelated');
    assert(ctx.status(p).reason,'no legacy inference');
    // Missing/unsafe imported records cannot write to arbitrary paths.
    const legacy={fromLevel:1,toLevel:2};p.details.progressionHistory.push(legacy);const legacyBefore=copy(p);await ctx.revert(p.id);same(p,legacyBefore);
    legacy.reversal={schemaVersion:1,pokemonId:p.id,changes:[{path:['__proto__'],before:{exists:true,value:{}},after:{exists:true,value:{}}}]};await ctx.revert(p.id);assert(ctx.status(p).reason);p.details.progressionHistory=[];
    // Failed async validation restores the pre-application values.
    const beforeFailure=copy(p);ctx.pokemonProgressState={pokemonId:p.id,preview:{valid:true,targetLevel:27,targetSpecies:{id:'charcadet',name:'Charcadet',types:['fire']},maxHp:100,totalExperience:1000,moveLimit:{effective:6},tutorPoints:{earned:6,spent:0,remaining:6},rewards:{statPoints:3,tutorPoints:1,abilityUnlockLevels:[]}},form:{selectedMoves:[],selectedAbilities:['Flash Fire','Blaze']}};
    ctx.fetch=async()=>{throw new Error('simulated unavailable API');};await ctx.apply();same(p,beforeFailure);assert.equal(ctx.pokemonProgressState.applying,false);
    console.log(`${platform}: level + evolution, serial reversal, confirmation/cancel, all affected-field conflicts, dialog race, legacy/malformed captures, rollback, Trainer history and persisted JSON roundtrip OK`);
  }
}finally{
  definitions.close?.();
  if(server.exitCode===null){server.kill();await new Promise(resolve=>server.once('exit',resolve));}
  await rm(dataDir,{recursive:true,force:true});
}
