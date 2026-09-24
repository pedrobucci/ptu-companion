import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../persistence/database.mjs';
import {CampaignRepository} from '../persistence/repository.mjs';
import {
  POKEMON_FORM_SCHEMA_VERSION,BASE_FORM_ID,normalizeSpeciesForms,normalizePokemonFormState,
  applyFormOperation,evaluateFormRequirements,resolvePokemonForms
} from '../rules/pokemon-forms.mjs';

assert.equal(POKEMON_FORM_SCHEMA_VERSION,1);
assert.equal(BASE_FORM_ID,'base');
assert.deepEqual(applyFormOperation(['Overland','Power'],{remove:['Overland'],add:['Naturewalk']}),['Power','Naturewalk']);
assert.deepEqual(applyFormOperation({hp:5,speed:7},{add:{hp:2,speed:1}}),{hp:7,speed:8});
assert.deepEqual(applyFormOperation(['A','B'],{replace:['C'],add:['D']}),['C','D']);

const rawForms=[
  {
    id:'alpine-form',name:'Alpine Form',mode:'permanent',requirements:{min_level:10},
    overrides:{
      types:{replace:['Ice','Normal']},
      base_stats:{add:{hp:1,defense:2}},
      capabilities:{remove:['overland'],add:[{capability_id:'naturewalk',name:'Naturewalk',kind:'naturewalk',terrains:['Mountain','Arctic']}]},
      ability_slots:{replace:[{slot:1,name:'Snow Cloak',category:'Basic'}]}
    }
  },
  {
    id:'spectral-shift',name:'Spectral Shift',mode:'transformation',
    requirements:{all:[{kind:'held_item',value:'form-stone'},{kind:'flag',value:'charged'}]},
    overrides:{types:{add:['Ghost']},baseStats:{add:{speed:3}},level_up_moves:{add:[{level:20,move:'Shadow Sneak',move_id:'shadow-sneak'}]}}
  }
];
const forms=normalizeSpeciesForms(rawForms);
assert.equal(forms.length,2);
assert.equal(forms[0].mode,'permanent');
assert.equal(forms[1].mode,'transformation');
assert.equal(forms[0].overrides.baseStats.add.defense,2,'snake_case species fields must normalize to runtime field names');

const species={
  id:'form-test',name:'Form Test',types:['Normal'],baseStats:{hp:5,attack:6,defense:5,special_attack:4,special_defense:5,speed:7},
  abilities:[{slot:1,name:'Run Away',category:'Basic'}],capabilities:[{capability_id:'overland',name:'Overland',kind:'movement',value:6}],
  levelUpMoves:[{level:1,move:'Tackle',move_id:'tackle'}],forms,
  raw:{types:['Normal'],base_stats:{hp:5,attack:6,defense:5,special_attack:4,special_defense:5,speed:7},ability_slots:[{slot:1,name:'Run Away',category:'Basic'}],capabilities:[{capability_id:'overland',name:'Overland',kind:'movement',value:6}],level_up_moves:[{level:1,move:'Tackle',move_id:'tackle'}],forms:rawForms}
};

const eligible=evaluateFormRequirements({all:[{kind:'min_level',value:10},{kind:'held_item',value:'form-stone'}]},{level:20,heldItemId:'form-stone'});
assert.equal(eligible.eligible,true);
assert.equal(evaluateFormRequirements({min_level:30},{level:20}).eligible,false);

const resolution=resolvePokemonForms({
  species,
  formState:{baseFormId:'alpine-form',activeFormId:'spectral-shift'},
  context:{level:20,heldItemId:'form-stone',flags:{charged:true}}
});
assert.equal(resolution.valid,true,resolution.errors.join('; '));
assert.deepEqual(resolution.applied.map(x=>x.id),['alpine-form','spectral-shift']);
assert.deepEqual(resolution.species.types,['Ice','Normal','Ghost']);
assert.equal(resolution.species.baseStats.hp,6);
assert.equal(resolution.species.baseStats.defense,7);
assert.equal(resolution.species.baseStats.speed,10);
assert.equal(resolution.species.capabilities.some(c=>c.capability_id==='overland'),false);
assert.equal(resolution.species.capabilities.some(c=>c.capability_id==='naturewalk'),true);
assert.deepEqual(resolution.species.abilities.map(a=>a.name),['Snow Cloak']);
assert.equal(resolution.species.levelUpMoves.some(m=>m.move_id==='shadow-sneak'),true);
assert.deepEqual(resolution.species.raw.types,['Ice','Normal','Ghost'],'resolved raw species data must track runtime overrides');

const unmet=resolvePokemonForms({species,formState:{baseFormId:'alpine-form',activeFormId:'spectral-shift'},context:{level:20,heldItemId:'form-stone',flags:{charged:false}}});
assert.equal(unmet.valid,false);
assert.match(unmet.errors.join(' '),/state flag charged/i);
const gm=resolvePokemonForms({species,formState:{baseFormId:'alpine-form',activeFormId:'spectral-shift'},context:{level:20},allowUnmet:true});
assert.equal(gm.valid,true);
assert.ok(gm.warnings.length>=1,'GM Override must retain warnings for unmet requirements');
const wrongMode=resolvePokemonForms({species,formState:{baseFormId:'spectral-shift'}});
assert.equal(wrongMode.valid,false);
assert.match(wrongMode.errors.join(' '),/transformation Form/i);
assert.deepEqual(normalizePokemonFormState({permanentFormId:'Alpine Form',transformationFormId:'Spectral Shift'}),{schemaVersion:1,baseFormId:'alpine-form',activeFormId:'spectral-shift'});
assert.deepEqual(normalizePokemonFormState({}),{schemaVersion:1,baseFormId:'base',activeFormId:null});

// Campaign persistence deliberately reuses pokemon.details_json: no save-schema migration is required.
const temp=await mkdtemp(join(tmpdir(),'ptu-stage-b-forms-'));
const db=openDatabase(join(temp,'campaign.sqlite3'));
try{
  const repo=new CampaignRepository(db);
  const seed=JSON.parse(await readFile(new URL('../seed/default-state.json',import.meta.url),'utf8'));
  const state=structuredClone(seed);
  state.activeProfileId='forms-foundation-test';
  state.trainer.id='forms-foundation-test';
  const target=state.pokemon[0];
  target.details={...(target.details||{}),formState:{schemaVersion:1,baseFormId:'alpine-form',activeFormId:'spectral-shift'},formFlags:{charged:true},manualFormApprovals:['moon-ritual']};
  repo.saveState(state,{createRevision:true});
  const loaded=repo.loadState('forms-foundation-test');
  const loadedPokemon=loaded.pokemon.find(p=>p.id===target.id);
  assert.deepEqual(loadedPokemon.details.formState,target.details.formState,'Pokémon Form state must round-trip through details_json');
  assert.deepEqual(loadedPokemon.details.formFlags,{charged:true});
  const stored=JSON.parse(db.prepare('SELECT details_json FROM pokemon WHERE id=?').get(target.id).details_json);
  assert.deepEqual(stored.formState,target.details.formState,'Form state must be stored on the individual Pokémon');
} finally {db.close();await rm(temp,{recursive:true,force:true});}

const repositorySource=await readFile(new URL('../definitions/repository.mjs',import.meta.url),'utf8');
const importerSource=await readFile(new URL('../definitions/pack-importer.mjs',import.meta.url),'utf8');
const serverSource=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
assert.match(repositorySource,/forms:normalizeSpeciesForms\(raw\.forms \|\| raw\.form_definitions \|\| \[\]\)/,'DefinitionRepository must expose normalized Forms on Species');
assert.match(importerSource,/normalizeSpeciesForms\(raw\.forms\|\|raw\.form_definitions\|\|\[\]\)/,'.ptucp Species import must validate Form definitions');
assert.match(importerSource,/format_version\)!==1/,'Stage B must remain compatible with .ptucp format_version 1');
assert.match(serverSource,/function resolveSpeciesFormState/,'Windows server must have one central Species Form resolver adapter');
assert.match(serverSource,/\/api\/pokemon\/forms\/resolve/,'Windows server must expose a Form resolution endpoint for Stage C UI');
assert.match(serverSource,/const buildFormResolution=resolveSpeciesFormState/,'Pokémon creation preview must use the central Form resolver');
assert.match(serverSource,/const referenceFormResolution=resolveSpeciesFormState/,'current Creature reference/combat data must use active Form state');

console.log('Stage B Windows Pokémon Forms foundation regression OK');
