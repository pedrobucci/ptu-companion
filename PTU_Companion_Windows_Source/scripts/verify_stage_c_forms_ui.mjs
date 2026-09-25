import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../persistence/database.mjs';
import {CampaignRepository} from '../persistence/repository.mjs';
import {resolvePokemonForms} from '../rules/pokemon-forms.mjs';

const species={
  id:'form-ui-test',name:'Form UI Test',types:['Normal'],baseStats:{hp:5,attack:5,defense:5,special_attack:5,special_defense:5,speed:5},
  abilities:[{name:'Run Away',slot_category:'Basic'}],capabilities:[{name:'Overland',kind:'movement',value:5}],levelUpMoves:[{move:'Tackle',level:1}],
  forms:[
    {id:'night',name:'Night Form',mode:'permanent',requirements:{min_level:10},overrides:{types:{replace:['Dark']},baseStats:{replace:{hp:5,attack:8,defense:5,special_attack:4,special_defense:5,speed:8}},abilities:{add:[{name:'Frisk',slot_category:'Basic'}]} }},
    {id:'charged',name:'Charged Form',mode:'transformation',requirements:{all:[{held_item:'Form Stone'},{manual:{id:'charged-ready',label:'Charged state is active'}}]},overrides:{types:{replace:['Dark','Electric']},capabilities:{add:[{name:'Glow',kind:'boolean'}]},levelUpMoves:{add:[{move:'Thunder Shock',level:1}]}}}
  ]
};

let resolved=resolvePokemonForms({species,formState:{baseFormId:'night'},context:{level:12}});
assert.equal(resolved.valid,true,'Permanent Form should resolve when its Level requirement is met');
assert.deepEqual(resolved.species.types,['Dark'],'Permanent Form must replace resolved Types');
assert.equal(resolved.species.baseStats.attack,8,'Permanent Form must replace Base Stats');
assert.ok(resolved.species.abilities.some(a=>a.name==='Frisk'),'Permanent Form must affect the resolved Ability pool');

resolved=resolvePokemonForms({species,formState:{baseFormId:'night',activeFormId:'charged'},context:{level:12,heldItemName:'Form Stone',manualApprovals:['charged-ready']}});
assert.equal(resolved.valid,true,'Transformation should resolve with all requirements confirmed');
assert.deepEqual(resolved.species.types,['Dark','Electric'],'Transformation must layer on top of the permanent Form');
assert.ok(resolved.species.capabilities.some(c=>c.name==='Glow'),'Transformation must affect resolved Capabilities');
assert.ok(resolved.species.levelUpMoves.some(m=>m.move==='Thunder Shock'),'Transformation must affect natural Move data');

const blocked=resolvePokemonForms({species,formState:{baseFormId:'night',activeFormId:'charged'},context:{level:12}});
assert.equal(blocked.valid,false,'Transformation must be rejected when requirements are not met');
assert.ok(blocked.errors.some(e=>e.includes('held item')),'Missing Held Item requirement should be surfaced');
const overridden=resolvePokemonForms({species,formState:{baseFormId:'night',activeFormId:'charged'},context:{level:12},allowUnmet:true});
assert.equal(overridden.valid,true,'GM Override should allow an otherwise blocked Form');
assert.ok(overridden.warnings.some(w=>w.startsWith('GM Override:')),'GM Override must preserve explicit warnings');

const temp=await mkdtemp(join(tmpdir(),'ptu-stage-c-forms-ui-'));
const db=openDatabase(join(temp,'campaign.sqlite3'));
try{
  const repo=new CampaignRepository(db);
  const seed=JSON.parse(await readFile(new URL('../seed/default-state.json',import.meta.url),'utf8'));
  const state=structuredClone(seed); state.activeProfileId='forms-ui-test'; state.trainer.id='forms-ui-test';
  const p=state.pokemon[0]; p.details={...(p.details||{}),formState:{schemaVersion:1,baseFormId:'night',activeFormId:'charged'},manualFormApprovals:['charged-ready']};
  repo.saveState(state,{createRevision:true});
  const loaded=repo.loadState('forms-ui-test'); const loadedPokemon=loaded.pokemon.find(x=>x.id===p.id);
  assert.deepEqual(loadedPokemon.details.formState,p.details.formState,'Stage C Form selections must round-trip on the individual Pokémon');
  assert.deepEqual(loadedPokemon.details.manualFormApprovals,['charged-ready'],'Manual Form confirmations must round-trip with Pokémon details');
} finally { db.close(); await rm(temp,{recursive:true,force:true}); }

const app=await readFile(new URL('../static-preview/app.js',import.meta.url),'utf8');
const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
for(const token of [
  "formState:{baseFormId:f.baseFormId||'base',activeFormId:null}",
  "section('POKÉMON FORM'",
  'openPokemonFormsManager()',
  'setPokemonPermanentForm(formId)',
  'togglePokemonTransformation(formId)',
  "fetch('/api/pokemon/forms/resolve'",
  'p.details.formState={...payload.formState}',
  'p.types=payload.species.types.map',
  'resolvedTypes.map(typeBadge)',
  'pokemonFormRequirementText',
  'pokemonFormManualRequirements',
  'pokemonFormsUiCache',
  'You can use the choices below to recover to a valid Form state.',
  "if(pv.evolved){d.formState={schemaVersion:1,baseFormId:'base',activeFormId:null};d.manualFormApprovals=[];}"
]) assert.ok(app.includes(token),`Windows Stage C UI contract missing: ${token}`);

assert.match(server,/species:\{id:species\.id,name:species\.name,types:species\.types\|\|\[\],versionId:species\.versionId,contentPackId:species\.contentPackId,sourceId:species\.sourceId\},formResolution:buildFormResolution,experience:/,'Successful build preview must expose Form resolution metadata, not only validation failures');
assert.match(server,/rulesetId,species,formResolution:referenceFormResolution,moves,abilities/,'Successful Creature reference data must expose current Form resolution metadata');
for(const marker of ['progressionFormResolution','abilityFormResolution','restatFormResolution','trainingFormResolution','trainingActionFormResolution']){
  assert.ok(server.includes(`const ${marker}=resolveSpeciesFormState({species:baseSpecies,pokemon,payload,includeActive:false})`),`${marker} must resolve the permanent Form while ignoring temporary transformations`);
}
assert.ok(server.includes('formResolution:progressionFormResolution,evolutionCandidates'),'Progression preview must report the permanent Form resolution it used');
assert.ok(server.includes('speciesName:baseSpecies.name,sourceId:baseSpecies.sourceId'),'Evolution lineage must remain anchored to canonical Species identity');
assert.match(app,/setPokemonBuilderBaseForm,togglePokemonBuilderFormManualApproval/,'Builder Form handlers must be exposed to the Windows UI');
assert.match(app,/openPokemonFormsManager,setPokemonPermanentForm,togglePokemonTransformation/,'Creature Form handlers must be exposed to the Windows UI');

console.log('Stage C Windows Pokémon Forms UI regression OK');
