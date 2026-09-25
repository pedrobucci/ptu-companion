import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolvePokemonForms} from '../www/rules/pokemon-forms.mjs';

const species={
  id:'form-ui-test',name:'Form UI Test',types:['Normal'],baseStats:{hp:5,attack:5,defense:5,special_attack:5,special_defense:5,speed:5},
  abilities:[{name:'Run Away',slot_category:'Basic'}],capabilities:[{name:'Overland',kind:'movement',value:5}],levelUpMoves:[{move:'Tackle',level:1}],
  forms:[
    {id:'night',name:'Night Form',mode:'permanent',requirements:{min_level:10},overrides:{types:{replace:['Dark']},baseStats:{replace:{hp:5,attack:8,defense:5,special_attack:4,special_defense:5,speed:8}},abilities:{add:[{name:'Frisk',slot_category:'Basic'}]}}},
    {id:'charged',name:'Charged Form',mode:'transformation',requirements:{all:[{held_item:'Form Stone'},{manual:{id:'charged-ready',label:'Charged state is active'}}]},overrides:{types:{replace:['Dark','Electric']},capabilities:{add:[{name:'Glow',kind:'boolean'}]},levelUpMoves:{add:[{move:'Thunder Shock',level:1}]}}}
  ]
};

let resolved=resolvePokemonForms({species,formState:{baseFormId:'night'},context:{level:12}});
assert.equal(resolved.valid,true,'Android permanent Form must resolve when eligible');
assert.deepEqual(resolved.species.types,['Dark']);
assert.ok(resolved.species.abilities.some(a=>a.name==='Frisk'));
resolved=resolvePokemonForms({species,formState:{baseFormId:'night',activeFormId:'charged'},context:{level:12,heldItemName:'Form Stone',manualApprovals:['charged-ready']}});
assert.equal(resolved.valid,true,'Android transformation must resolve after manual confirmation');
assert.deepEqual(resolved.species.types,['Dark','Electric']);
assert.ok(resolved.species.capabilities.some(c=>c.name==='Glow'));
assert.ok(resolved.species.levelUpMoves.some(m=>m.move==='Thunder Shock'));
const blocked=resolvePokemonForms({species,formState:{baseFormId:'night',activeFormId:'charged'},context:{level:12}});
assert.equal(blocked.valid,false,'Android Form resolver must keep unmet requirements blocking by default');
const overridden=resolvePokemonForms({species,formState:{baseFormId:'night',activeFormId:'charged'},context:{level:12},allowUnmet:true});
assert.equal(overridden.valid,true);
assert.ok(overridden.warnings.some(w=>w.startsWith('GM Override:')));

const app=await readFile(new URL('../www/app.js',import.meta.url),'utf8');
const api=await readFile(new URL('../www/mobile-api.mjs',import.meta.url),'utf8');
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
]) assert.ok(app.includes(token),`Android Stage C UI contract missing: ${token}`);

assert.match(api,/species:\{id:species\.id,name:species\.name,types:species\.types\|\|\[\],versionId:species\.versionId,contentPackId:species\.contentPackId,sourceId:species\.sourceId\},formResolution:buildFormResolution,experience:/,'Android successful build preview must expose Form resolution metadata');
assert.match(api,/rulesetId,species,formResolution:referenceFormResolution,moves,abilities/,'Android successful Creature reference data must expose current Form resolution metadata');
for(const marker of ['progressionFormResolution','abilityFormResolution','restatFormResolution','trainingFormResolution','trainingActionFormResolution']){
  assert.ok(api.includes(`const ${marker}=resolveSpeciesFormState({species:baseSpecies,pokemon,payload,includeActive:false})`),`Android ${marker} must resolve permanent Form mechanics while ignoring temporary transformations`);
}
assert.ok(api.includes('formResolution:progressionFormResolution,evolutionCandidates'),'Android progression preview must report the permanent Form resolution it used');
assert.ok(api.includes('speciesName:baseSpecies.name,sourceId:baseSpecies.sourceId'),'Android evolution lineage must remain anchored to canonical Species identity');
assert.match(app,/setPokemonBuilderBaseForm,togglePokemonBuilderFormManualApproval/,'Android builder Form handlers must be exposed');
assert.match(app,/openPokemonFormsManager,setPokemonPermanentForm,togglePokemonTransformation/,'Android Creature Form handlers must be exposed');
assert.ok(app.includes("activeFormId:null"),'Android UI must support explicitly deactivating a temporary transformation');

console.log('Stage C Android Pokémon Forms UI regression OK');
