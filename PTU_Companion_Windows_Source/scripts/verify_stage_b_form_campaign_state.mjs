import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';
import {applyPokemonFormGameEvent,applyFormLifecycleEffectsToPokemon,FORM_CAMPAIGN_STATE_MODEL_VERSION} from '../rules/pokemon-form-campaign-state.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const repo=resolve(root,'..');
const stage=JSON.parse(await readFile(join(repo,'docs','data','PTU_FORMS_STAGE_B.json'),'utf8'));
const byFamily=new Map((stage.candidate_families||[]).map(entry=>[entry.family,entry]));
const family=name=>{const entry=byFamily.get(name);assert.ok(entry,`missing family ${name}`);return {id:name,name,types:[],forms:entry.forms,raw:{forms:entry.forms}};};
const formState=(baseFormId='base',activeFormId=null)=>({schemaVersion:1,baseFormId,activeFormId});
const pokemon=(overrides={})=>({
  id:'test',name:'Test',species:'Test',level:30,types:[],hp:60,maxHp:100,tempHp:0,injuries:0,combatStages:{},
  details:{formState:formState(),baseStats:{hp:5},natureAdjustedBaseStats:{hp:5},finalStats:{hp:15},abilities:[],capabilities:[],moves:[],...overrides.details},
  ...overrides,
});

assert.equal(FORM_CAMPAIGN_STATE_MODEL_VERSION,1);
assert.equal(stage.lifecycle_model_version,1);

// PTU Core Temporary HP: grants do not stack; only the higher current value applies.
let p=pokemon({tempHp:10,details:{tempHp:10,formTempHpBySource:{existing:10}}});
let applied=applyFormLifecycleEffectsToPokemon(p,[{kind:'grant_temp_hp',source:'lower',amount:8}],p.details.formState);
assert.equal(applied.pokemon.tempHp,10);
assert.deepEqual(applied.pokemon.details.formTempHpBySource,{existing:10});
applied=applyFormLifecycleEffectsToPokemon(applied.pokemon,[{kind:'grant_temp_hp',source:'higher',amount:15}],p.details.formState);
assert.equal(applied.pokemon.tempHp,15);
assert.deepEqual(applied.pokemon.details.formTempHpBySource,{higher:15});

// Aegislash move events now mutate campaign Form state, not just preview it.
p=pokemon();
let result=applyPokemonFormGameEvent({species:family('aegislash'),pokemon:p,event:{kind:'move-used',move:'Iron Head',damaging:true},context:{abilities:['Stance Change']}});
assert.equal(result.valid,true);assert.equal(result.pokemon.details.formState.activeFormId,'sword-stance');
result=applyPokemonFormGameEvent({species:family('aegislash'),pokemon:result.pokemon,event:{kind:'move-used',move:"King's Shield",moveClass:'Status',damaging:false},context:{abilities:['Stance Change']}});
assert.equal(result.pokemon.details.formState.activeFormId,null);

// Schooling persists its THP provenance and damage consumes that tracked source first.
p=pokemon({hp:40,maxHp:100,details:{formState:formState(),abilities:['Schooling'],baseStats:{hp:5},natureAdjustedBaseStats:{hp:5},finalStats:{hp:15}}});
result=applyPokemonFormGameEvent({species:family('wishiwashi'),pokemon:p,event:{kind:'ability-used',ability:'Schooling'},context:{abilities:['Schooling']}});
assert.equal(result.valid,true);assert.equal(result.pokemon.details.formState.activeFormId,'schooling');
assert.equal(result.pokemon.tempHp,50);assert.deepEqual(result.pokemon.details.formTempHpBySource,{schooling:50});
assert.equal(result.transitions[0].appliedRules[0].frequency,'Daily');assert.equal(result.transitions[0].appliedRules[0].actionCost,'Free Action');
result=applyPokemonFormGameEvent({species:family('wishiwashi'),pokemon:result.pokemon,event:{kind:'hp-adjust',delta:-20},context:{abilities:['Schooling']}});
assert.equal(result.pokemon.tempHp,30);assert.deepEqual(result.pokemon.details.formTempHpBySource,{schooling:30});assert.equal(result.pokemon.hp,40);
result=applyPokemonFormGameEvent({species:family('wishiwashi'),pokemon:result.pokemon,event:{kind:'hp-adjust',delta:-30},context:{abilities:['Schooling']}});
assert.equal(result.pokemon.tempHp,0);assert.equal(result.pokemon.details.formState.activeFormId,null);

// Eiscue battle start applies two exact source ticks and records Ice Face provenance.
p=pokemon({maxHp:55,hp:55,details:{formState:formState('base','noice-face'),abilities:['Ice Face'],baseStats:{hp:5},natureAdjustedBaseStats:{hp:5},finalStats:{hp:15}}});
result=applyPokemonFormGameEvent({species:family('eiscue'),pokemon:p,event:{kind:'battle-start'},context:{abilities:['Ice Face'],inCombat:true}});
assert.equal(result.valid,true);assert.equal(result.pokemon.details.formState.activeFormId,null);assert.equal(result.pokemon.tempHp,11);assert.deepEqual(result.pokemon.details.formTempHpBySource,{'ice-face':11});

// Minior state follows HP and explicit combat-state changes.
p=pokemon({hp:60,maxHp:100,details:{formState:formState(),abilities:['Shields Down'],baseStats:{hp:5},natureAdjustedBaseStats:{hp:5},finalStats:{hp:15}}});
result=applyPokemonFormGameEvent({species:family('minior'),pokemon:p,event:{kind:'hp-adjust',delta:-10},context:{abilities:['Shields Down'],inCombat:true}});
assert.equal(result.pokemon.details.formState.activeFormId,'core');
result.pokemon.hp=60;
result=applyPokemonFormGameEvent({species:family('minior'),pokemon:result.pokemon,event:{kind:'battle-end'},context:{abilities:['Shields Down'],inCombat:false}});
assert.equal(result.pokemon.details.formState.activeFormId,null);

// Power Construct resolves Complete's hypothetical Max HP from source Base HP 22 plus the saved build deltas.
p=pokemon({level:50,hp:40,maxHp:100,details:{formState:formState('10-percent',null),abilities:['Power Construct'],baseStats:{hp:5},natureAdjustedBaseStats:{hp:5},finalStats:{hp:15}}});
result=applyPokemonFormGameEvent({species:family('zygarde'),pokemon:p,event:{kind:'ability-used',ability:'Power Construct'},context:{abilities:['Power Construct'],inCombat:true}});
assert.equal(result.valid,true);assert.equal(result.pokemon.details.formState.activeFormId,'complete-from-10-percent');
assert.equal(result.pokemon.tempHp,78);assert.deepEqual(result.pokemon.details.formTempHpBySource,{'power-construct':78});
result=applyPokemonFormGameEvent({species:family('zygarde'),pokemon:result.pokemon,event:{kind:'scene-end'},context:{abilities:['Power Construct'],inCombat:true}});
assert.equal(result.pokemon.details.formState.activeFormId,null);assert.equal(result.pokemon.tempHp,78,'scene expiry changes Form but does not invent a THP removal rule');

// Weapon Bond enters with the source item and Faint clears Crowned through hp-adjust derived events.
p=pokemon({hp:20,maxHp:100,details:{formState:formState('hero-of-many-battles',null),capabilities:['Weapon Bond'],baseStats:{hp:5},natureAdjustedBaseStats:{hp:5},finalStats:{hp:15}}});
result=applyPokemonFormGameEvent({species:family('zacian'),pokemon:p,event:{kind:'capability-used',capability:'Weapon Bond',triggerItem:'Ancestral Sword'},context:{capabilities:['Weapon Bond'],triggerItemName:'Ancestral Sword'}});
assert.equal(result.valid,true);assert.equal(result.pokemon.details.formState.activeFormId,'crowned-sword');
result=applyPokemonFormGameEvent({species:family('zacian'),pokemon:result.pokemon,event:{kind:'hp-adjust',delta:-20},context:{capabilities:['Weapon Bond']}});
assert.equal(result.pokemon.hp,0);assert.equal(result.pokemon.details.formState.activeFormId,null);

// Runtime/client integration surfaces and persistence invariants.
const winCampaign=await readFile(join(root,'rules','pokemon-form-campaign-state.mjs'),'utf8');
const androidCampaign=await readFile(join(repo,'PTU_Companion_Android_Tauri','www','rules','pokemon-form-campaign-state.mjs'),'utf8');
assert.equal(winCampaign,androidCampaign,'campaign-state modules must stay byte-identical');
const winEvents=await readFile(join(root,'rules','pokemon-form-events.mjs'),'utf8');
const androidEvents=await readFile(join(repo,'PTU_Companion_Android_Tauri','www','rules','pokemon-form-events.mjs'),'utf8');
assert.equal(winEvents,androidEvents,'event modules must stay byte-identical');
for(const path of [join(root,'server.mjs'),join(repo,'PTU_Companion_Android_Tauri','www','mobile-api.mjs')]){
  const text=await readFile(path,'utf8');assert.match(text,/\/api\/pokemon\/forms\/apply-event/);assert.match(text,/applyPokemonFormGameEvent/);
}
for(const path of [join(root,'static-preview','app.js'),join(repo,'PTU_Companion_Android_Tauri','www','app.js')]){
  const text=await readFile(path,'utf8');assert.match(text,/applyPokemonFormGameEventUi/);assert.match(text,/usePokemonMoveForForms/);assert.match(text,/usePokemonAbilityForForms/);assert.match(text,/setPokemonBattleState/);assert.match(text,/formTempHpBySource/);
}
const repository=await readFile(join(root,'persistence','repository.mjs'),'utf8');
assert.match(repository,/tempHp:Number\(fromJson\(p\.details_json, \{\}\)\.tempHp\|\|0\)/);assert.match(repository,/tempHp:Number\(p\.tempHp\?\?p\.details\?\.tempHp\?\?0\)/);
const zygarde=byFamily.get('zygarde');
for(const id of ['complete-from-10-percent','complete-from-50-percent']){
  const form=zygarde.forms.find(row=>row.id===id);const rule=form.lifecycle.events.find(row=>String(row.id).startsWith('power-construct-')&&!String(row.id).includes('scene-end'));
  assert.equal(rule.effects[0].target_form_base_hp,22);
}

console.log(JSON.stringify({campaignStateModel:FORM_CAMPAIGN_STATE_MODEL_VERSION,formsTested:['aegislash','wishiwashi','eiscue','minior','zygarde','zacian'],sourceTrackedTempHp:true,windowsAndroidParity:true},null,2));
