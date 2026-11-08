import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext, runInThisContext} from 'node:vm';

const win=new URL('../',import.meta.url);
const android=new URL('../../PTU_Companion_Android_Tauri/www/',import.meta.url);
const rulesetId='all-provided-material';
const port=42112;
const tmp=await mkdtemp(join(tmpdir(),'ptu-issue112-'));
const server=spawn(process.execPath,['server.mjs'],{
  cwd:fileURLToPath(win),
  env:{...process.env,PTU_PORT:String(port),PTU_DATA_DIR:tmp},
  stdio:['ignore','pipe','pipe']
});

let serverErrors='';
server.stderr.on('data',chunk=>serverErrors+=chunk);

async function check(api,label){
  const mobile=label==='Android';
  const app=await readFile(new URL(mobile?'app.js':'static-preview/app.js',mobile?android:win),'utf8');
  const portraitUrl=runInNewContext(
    app.slice(app.indexOf('function pokemonPortraitUrl('),app.indexOf('function pokemonPortraitTag('))+'\npokemonPortraitUrl',
    {window:globalThis,URLSearchParams}
  );
  async function checkPortrait(pokemon,formId){
    const sprite=formId==='hoopa-unbound'?'pokemon-sprites/10086.png':'pokemon-sprites/720.png';
    const url=portraitUrl(pokemon);
    if(mobile){
      assert.equal(url,sprite);
    }else{
      assert.match(url,/[?&]art=2(?:&|$)/);
      const response=await api(url);
      assert.equal(response.headers.get('content-type'),'image/png');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()),await readFile(new URL(sprite,android)));
    }
  }
  async function checkCombatPower(row){
    let log='';
    const inputs={'combat-natural-roll':'10','combat-hit-result':'hit','combat-critical-result':'no','combat-manual-damage-roll':'20'};
    const start=app.indexOf('async function pokemonCombatResolveMove(');
    const resolve=runInNewContext(app.slice(start,app.indexOf('function pokemonCombatMoveCard(',start))+'\npokemonCombatResolveMove',{
      pokemonCombatReferenceState:{pokemonId:'hoopa',data:{moves:[row]}},
      pokemon:()=>({name:'Hoopa'}),document:{getElementById:id=>({value:inputs[id]})},
      pokemonCombatMoveAvailability:()=>({valid:true}),pokemonCombatSlug:()=>row.record.id,
      pokemonCombatParticipant:()=>({conditions:{}}),pokemonCombatOutcomeSpec:()=>({}),
      pokemonCombatBoundFeatureModifiers:()=>[],pokemonCombatSpendAction:()=>({valid:true}),pokemonCombatSpendFrequency:()=>({valid:true}),
      pokemonCombatDamageChart:()=>row.resolvedDamage.damageChart,
      pokemonCombatKnowsRollMove:()=>false,pokemonCombatDefenseCurlModifier:()=>({}),
      pokemonCombatApplyMoveOutcome:()=>{},pokemonCombatDispatchMoveFormEvent:()=>{},
      pokemonCombatLog:(_id,_title,detail)=>{log=detail;},closeModal:()=>{},commit:()=>{},render:()=>{},
      toast:(message,kind)=>{assert.notEqual(kind,'error',message);}
    });
    await resolve('hoopa',0);
    const {primaryStat,powerDamage}=row.resolvedDamage;
    assert(log.includes(`20 + Stat ${primaryStat.value} + ${powerDamage.source} ${powerDamage.value} = ${20+primaryStat.value+powerDamage.value}`),log);
  }
  async function request(path,body,method=body?'POST':'GET',status=200){
    const response=await api(path,{
      method,
      headers:{'content-type':'application/json'},
      body:body&&JSON.stringify({rulesetId,...body})
    });
    const data=await response.json();
    assert.equal(response.status,status,`${label} ${path} ${data.error||''}`);
    return data;
  }
  const species=async id=>(await request('/api/definitions/species/'+id)).definition;
  const examples=[
    ['hoopa-confined','hoopa-unbound',['Psychic','Dark'],['knock-off','dark-pulse','hyperspace-fury'],['Enduring Rage','Weird power']],
    ['hoopa-unbound','hoopa-confined',['Psychic','Ghost'],['phantom-force','shadow-ball','hyperspace-hole'],['Prankster','Handyman']]
  ];
  for(const [id,target,types,expected,expectedAbilities] of examples){
    const original=await species(id);
    const [,,,initial,initialAbilities]=examples.find(row=>row[0]===target);
    const build=await request('/api/pokemon/build-preview',{speciesId:id,formState:{baseFormId:target}});
    assert.equal(build.formResolution.presentation.artworkUrl,target==='hoopa-unbound'?'pokemon-sprites/10086.png':'pokemon-sprites/720.png');
    const pokemon={id:`saved-${id}`,name:'Ring Keeper',species:original.name,level:50,hp:71,maxHp:114,tempHp:0,injuries:0,ball:'Poké Ball',heldItem:null,img:'creatures/default.svg',storage:false,loyalty:4,rosterIds:[],combatStages:{},
      details:{speciesDefinitionId:id,speciesVersionId:`species:${id}@gen8`,
        nature:'Hardy',createdFromDefinition:true,experience:15000,tutorPointsEarned:11,tutorPointsSpent:1,
        tutorPointsRemaining:10,abilities:['Magician',...initialAbilities],
        abilityRecords:initialAbilities.map((name,i)=>({name,sourceKind:'level_choice',selectedAtLevel:20+20*i})),
        grantedAbilities:[{name:'Twisted Power',source:'poke_edge',sourceId:'mixed-power'}],
        moves:[...initial.map((id,i)=>({id,key:id,source:i===2?'tutor':'current_species',tutorCost:i===2?1:0})),{id:'trick',source:'current_species'}]}};
    await checkPortrait(pokemon,id);
    pokemon.details.formState={schemaVersion:1,baseFormId:'base',activeFormId:null};
    const switched=await request('/api/pokemon/forms/resolve',{pokemon,formState:{baseFormId:target}});
    assert.deepEqual(switched.species.types,types);
    assert.deepEqual(switched.species.levelUpMoves.filter(move=>expected.includes(move.move_id)).map(move=>[Number(move.level),move.move_id]),[[18,expected[0]],[28,expected[1]],[43,expected[2]]]);
    assert(switched.species.tutorMoves.some(move=>move.move_id===expected[2]&&move.note==='N'));
    assert(switched.species.tutorMoves.some(move=>move.move_id==='zen-headbutt'));
    assert(!switched.species.tutorMoves.some(move=>move.move_id===initial[2]));
    assert.deepEqual(switched.linkedMoves.map(move=>move.id),[...expected,'trick']);
    assert.equal(switched.linkedMoves[2].tutorCost,1);
    assert.deepEqual(switched.linkedAbilities?.abilities,['Magician',...expectedAbilities]);
    assert.deepEqual(switched.linkedAbilities.abilityRecords.map(record=>[record.name,record.selectedAtLevel]),
      [[expectedAbilities[0],20],[expectedAbilities[1],40]]);
    const [otherFrom,otherTo]=id==='hoopa-confined'?['Run Away','Cruelty']:['Cruelty','Run Away'];
    const other=await request('/api/pokemon/forms/resolve',{
      pokemon:{...pokemon,details:{...pokemon.details,abilities:['Magician',otherFrom],abilityRecords:[]}},
      formState:{baseFormId:target}
    });
    assert.deepEqual(other.linkedAbilities.abilities,['Magician',otherTo]);
    pokemon.species=switched.species.name;
    pokemon.types=types;
    pokemon.details.formState=switched.formState;
    pokemon.details.moves=switched.linkedMoves;
    await checkPortrait(pokemon,target);

    const ref=await request('/api/pokemon/reference-data',{pokemon});
    assert(ref.moves.every(move=>move.definition));
    assert.equal(ref.moves[2].linkedFormMoveKey,'hyperspace-hole');
    assert(ref.abilities.some(ability=>ability.id===(target==='hoopa-unbound'?'weird-power':'handyman')));
    const options=await request('/api/pokemon/training-options',{pokemon});
    assert(options.moveTeaching.tutor.some(move=>move.id===expected[2]&&move.naturalTutor));

    const {state}=await request('/api/state');
    state.pokemon=[pokemon];
    state.selectedPokemonId=pokemon.id;
    // Simulate a save made by the older build after switching forms.
    await request('/api/state',{state},'PUT');
    const restored=(await request('/api/state')).state.pokemon[0];
    assert.equal(restored.id,pokemon.id);
    assert.equal(restored.hp,pokemon.hp);
    assert.equal(restored.details.experience,15000);
    assert.deepEqual(restored.details.abilities,['Magician',...expectedAbilities]);
    assert.deepEqual(restored.details.grantedAbilities,pokemon.details.grantedAbilities);
    const current=await request('/api/pokemon/reference-data',{pokemon:restored});
    assert(current.abilities.some(ability=>ability.id===(target==='hoopa-unbound'?'weird-power':'handyman')));
    await checkPortrait(restored,target);
    const back=await request('/api/pokemon/forms/resolve',{pokemon:restored,formState:{baseFormId:'base'}});
    assert.deepEqual(back.linkedMoves.map(move=>move.id),[...initial,'trick']);
    assert.deepEqual(back.linkedAbilities?.abilities,['Magician',...initialAbilities]);
    restored.details.formState=back.formState;
    await checkPortrait(restored,id);
  }

  const powerProbe={level:50,details:{
    speciesDefinitionId:'hoopa-confined',formState:{baseFormId:'hoopa-unbound'},
    abilities:['Handyman'],pokeEdges:[{id:'mixed-power'}],
    moves:[{id:'knock-off'},{id:'hyperspace-fury'},{id:'dark-pulse'},{id:'trick'}]
  }};
  for(const [combatStages,statAllocations,physical,special] of [
    [{},{},{source:'Weird Power',value:17},{source:'Mixed Power',value:8}],
    [{attack:1},{},{source:'Mixed Power',value:8},{source:'Weird Power',value:19}],
    [{},{attack:1},{source:'Mixed Power',value:8},{source:'Mixed Power',value:8}]
  ]){
    const pokemon={...powerProbe,combatStages,details:{...powerProbe.details,statAllocations}};
    const ref=await request('/api/pokemon/reference-data',{pokemon});
    assert.deepEqual(ref.modifierSummary.powerDamage,{physical,special});
    assert.deepEqual(ref.resolvedCreature.modifierSummary.powerDamage,{physical,special});
    for(const [id,expected] of [['knock-off',physical],['dark-pulse',special]]){
      const {resolvedDamage}=ref.moves.find(row=>row.record.id===id);
      assert.deepEqual(resolvedDamage.powerDamage,expected);
      assert.equal(resolvedDamage.breakdown.filter(row=>['Weird Power','Mixed Power','Twisted Power'].includes(row.label)).length,1);
      const {rolled_damage}=resolvedDamage.damageChart;
      const [dice,flat='0']=rolled_damage.split('+');
      assert.equal(resolvedDamage.finalRoll,`${dice}+${Number(flat)+resolvedDamage.primaryStat.value+expected.value}`);
    }
    assert.equal(ref.moves.find(row=>row.record.id==='trick').resolvedDamage,null);
    if(physical.source==='Weird Power')await checkCombatPower(ref.moves.find(row=>row.record.id==='knock-off'));
  }
  const weirdOnly=await request('/api/pokemon/reference-data',{pokemon:{...powerProbe,details:{...powerProbe.details,pokeEdges:[]}}});
  assert.deepEqual(weirdOnly.modifierSummary.powerDamage,{physical:{source:'Weird Power',value:17},special:{source:null,value:0}});
  const bound=await request('/api/pokemon/reference-data',{pokemon:{
    ...powerProbe,details:{...powerProbe.details,formState:{baseFormId:'base'},abilities:['Weird Power']}
  }});
  assert.equal(bound.modifierSummary.powerDamage.physical.source,'Mixed Power');
  assert.equal(bound.modifierSummary.powerDamage.special.source,'Mixed Power');

  for(const [id,types] of [['skeledirge',['Fire','Ghost']],...['tinkatink','tinkatuff','tinkaton'].map(id=>[id,['Fairy','Steel']])]){
    const record=await species(id);
    assert(record.enabledForCreation);
    assert.deepEqual(record.types,types);
  }
  const tinkatink={level:15,details:{speciesDefinitionId:'tinkatink',nature:'Hardy'}};
  const tinkatinkRef=await request('/api/pokemon/reference-data',{pokemon:tinkatink});
  assert(tinkatinkRef.outgoingEvolutions.some(row=>row.target.id==='tinkatuff'&&row.toMinLevel===15));

  for(const [id,hp,moves,abilities] of [['quatrotem',170,8,5],['shadow-protocol',200,5,4],['dracopter',260,4,4],
    ...['electric','fire','grass','water'].map(element=>[`quatrotem-${element}-unit`,125,2,1])]){
    const d=await species(id);
    assert.deepEqual(d.types,['Robotic']);
    assert(d.raw.portrait_data_url.startsWith('data:image/webp;base64,'));
    const {preview}=await request('/api/pokemon/build-preview',{speciesId:id,level:1,nature:'Adamant',autoAllocate:true,autoSelectMoves:true});
    assert(preview.valid,preview.errors?.join(', '));
    assert.equal(preview.level,100);
    assert.equal(preview.nature.name,'Robotic');
    assert.equal(preview.maxHp,hp);
    assert.deepEqual(preview.finalStats,d.baseStats);
    assert.equal(preview.selectedMoves.length,moves);
    assert.equal(preview.selectedAbilities.length,abilities);
    const pokemon={level:100,details:{speciesDefinitionId:id}};
    await request('/api/pokemon/progression-preview',{pokemon,expGain:500,gmOverride:true},'POST',400);
    await request('/api/pokemon/restat-preview',{pokemon},'POST',400);
  }
  console.log(`${label}: Hoopa moves, abilities, portraits and persistence, Scarlet/Violet typing/evolution, fixed Pokébots OK`);
}

try{
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error(`Windows API did not start: ${serverErrors}`)),15000);
    server.stdout.on('data',line=>{
      if(String(line).includes(`127.0.0.1:${port}`)){clearTimeout(timer);resolve();}
    });
    server.once('error',error=>{clearTimeout(timer);reject(error);});
  });
  await check((path,init)=>fetch(`http://127.0.0.1:${port}${path}`,init),'Windows');
  globalThis.window=globalThis;
  globalThis.PTU_ANDROID_BUILD=true;
  globalThis.location={href:'https://app.local/index.html'};
  const local=new Map();
  globalThis.localStorage={getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value)};
  for(const file of ['mobile-data.js','fakemon-v2-data.js','books-species-data.js']){
    runInThisContext(await readFile(new URL(file,android),'utf8'),{filename:file});
  }
  const {mobileFetch}=await import(new URL('mobile-api.mjs',android));
  await check(mobileFetch,'Android');
}finally{
  if(server.exitCode==null){
    server.kill();
    await once(server,'exit');
  }
  await rm(tmp,{recursive:true,force:true});
}
