import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  POKEMON_FORM_SCHEMA_VERSION,normalizeSpeciesForms,normalizePokemonFormState,resolvePokemonForms
} from '../www/rules/pokemon-forms.mjs';

assert.equal(POKEMON_FORM_SCHEMA_VERSION,1);
const rawForms=[
  {id:'regional',name:'Regional Form',mode:'permanent',overrides:{types:{replace:['Ghost','Normal']},base_stats:{add:{hp:1}},capabilities:{add:[{capability_id:'naturewalk',name:'Naturewalk',terrains:['Urban','Cave']}]}}},
  {id:'battle-shift',name:'Battle Shift',mode:'transformation',requirements:{all:[{kind:'min_level',value:20},{kind:'manual',value:'battle-shift'}]},overrides:{types:{add:['Dark']},baseStats:{add:{speed:2}}}}
];
const forms=normalizeSpeciesForms(rawForms);
assert.equal(forms.length,2);
assert.equal(forms[0].overrides.baseStats.add.hp,1);
const species={
  id:'android-form-test',name:'Android Form Test',types:['Normal'],baseStats:{hp:5,attack:5,defense:5,special_attack:5,special_defense:5,speed:5},
  capabilities:[],forms,
  raw:{types:['Normal'],base_stats:{hp:5,attack:5,defense:5,special_attack:5,special_defense:5,speed:5},capabilities:[],forms:rawForms}
};
const resolved=resolvePokemonForms({species,formState:{baseFormId:'regional',activeFormId:'battle-shift'},context:{level:25,manualApprovals:['battle-shift']}});
assert.equal(resolved.valid,true,resolved.errors.join('; '));
assert.deepEqual(resolved.species.types,['Ghost','Normal','Dark']);
assert.equal(resolved.species.baseStats.hp,6);
assert.equal(resolved.species.baseStats.speed,7);
assert.equal(resolved.species.capabilities[0].capability_id,'naturewalk');
assert.deepEqual(normalizePokemonFormState({base_form_id:'Regional',active_form_id:'Battle Shift'}),{schemaVersion:1,baseFormId:'regional',activeFormId:'battle-shift'});

const blocked=resolvePokemonForms({species,formState:{baseFormId:'regional',activeFormId:'battle-shift'},context:{level:10,manualApprovals:[]}});
assert.equal(blocked.valid,false);
assert.match(blocked.errors.join(' '),/Level 20/i);
const gm=resolvePokemonForms({species,formState:{baseFormId:'regional',activeFormId:'battle-shift'},context:{level:10},allowUnmet:true});
assert.equal(gm.valid,true);
assert.ok(gm.warnings.length>=1);

const apiSource=await readFile(new URL('../www/mobile-api.mjs',import.meta.url),'utf8');
const windowsModule=await readFile(new URL('../../PTU_Companion_Windows_Source/rules/pokemon-forms.mjs',import.meta.url),'utf8');
const androidModule=await readFile(new URL('../www/rules/pokemon-forms.mjs',import.meta.url),'utf8');
assert.equal(androidModule,windowsModule,'Windows and Android must share byte-identical Pokémon Form resolver semantics');
assert.match(apiSource,/forms:normalizeSpeciesForms\(raw\.forms\|\|raw\.form_definitions\|\|\[\]\)/,'Android imported .ptucp Species must normalize Forms');
assert.match(apiSource,/out\.forms=normalizeSpeciesForms/,'Android bundled/resolved Species must expose Forms');
assert.match(apiSource,/function resolveSpeciesFormState/,'Android runtime must use one central Species Form resolver adapter');
assert.match(apiSource,/\/api\/pokemon\/forms\/resolve/,'Android must expose the same Form resolution endpoint contract');
assert.match(apiSource,/const buildFormResolution=resolveSpeciesFormState/,'Android Pokémon creation preview must be Form-aware');
assert.match(apiSource,/const referenceFormResolution=resolveSpeciesFormState/,'Android Creature reference/combat data must use active Form state');
assert.match(apiSource,/localStorage\.setItem\(MOBILE_KEY,JSON\.stringify\(store\)\)/,'Android local persistence must retain nested Pokémon details/formState JSON');

console.log('Stage B Android Pokémon Forms foundation regression OK');
