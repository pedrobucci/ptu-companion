import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  evaluateFormRequirements,normalizeSpeciesForms,resolvePokemonForms
} from '../rules/pokemon-forms.mjs';

const repoRoot=new URL('../../',import.meta.url);
const windowsRuntime=new URL('../rules/pokemon-forms.mjs',import.meta.url);
const androidRuntime=new URL('../../PTU_Companion_Android_Tauri/www/rules/pokemon-forms.mjs',import.meta.url);
const windowsServer=new URL('../server.mjs',import.meta.url);
const androidApi=new URL('../../PTU_Companion_Android_Tauri/www/mobile-api.mjs',import.meta.url);
const catalogUrl=new URL('../../docs/data/PTU_FORMS_STAGE_B.json',import.meta.url);

assert.equal(await readFile(windowsRuntime,'utf8'),await readFile(androidRuntime,'utf8'),'Windows/Android Form runtimes must stay byte-identical');

assert.equal(evaluateFormRequirements({kind:'hp_fraction_lte',value:0.5},{currentHp:50,maxHp:100}).eligible,true);
assert.equal(evaluateFormRequirements({kind:'hp_fraction_lt',value:0.5},{currentHp:50,maxHp:100}).eligible,false);
assert.equal(evaluateFormRequirements({kind:'hp_fraction_gt',value:0.5},{currentHp:51,maxHp:100}).eligible,true);
assert.equal(evaluateFormRequirements({kind:'temp_hp_lte',value:0},{tempHp:0}).eligible,true);
assert.equal(evaluateFormRequirements({kind:'temp_hp_gt',value:0},{tempHp:1}).eligible,true);
assert.equal(evaluateFormRequirements({kind:'temp_hp_source_lte',value:{source:'ice-face',amount:0}},{tempHpBySource:{'ice-face':0}}).eligible,true);
assert.equal(evaluateFormRequirements({kind:'temp_hp_source_lte',value:{source:'ice-face',amount:0}},{tempHp:0}).eligible,false,'source-specific Temporary HP must not silently fall back to total Temporary HP');
assert.equal(evaluateFormRequirements({kind:'known_move',value:'Relic Song'},{knownMoves:[{move_id:'relic-song',name:'Relic Song'}]}).eligible,true);
assert.equal(evaluateFormRequirements({kind:'in_combat',value:true},{inCombat:true}).eligible,true);
assert.equal(evaluateFormRequirements({kind:'trigger_item',value:'Ancestral Sword'},{triggerItemName:'Ancestral Sword'}).eligible,true);

const forms=normalizeSpeciesForms([
  {id:'alpha',name:'Alpha Base',mode:'permanent',overrides:{types:{replace:['Normal']}}},
  {id:'beta',name:'Beta Base',mode:'permanent',overrides:{types:{replace:['Water']}}},
  {
    id:'core',name:'Core',mode:'transformation',compatible_base_forms:['alpha'],
    requirements:{all:[{kind:'ability',value:'Shields Down'}]},
    activation_requirements:{all:[{kind:'hp_fraction_lte',value:0.5}]},
    persistence_requirements:{any:[{kind:'in_combat',value:true},{kind:'hp_fraction_lte',value:0.5}]},
    overrides:{base_stats:{add:{speed:2}}}
  }
]);
const species={
  id:'requirement-v2-test',name:'Requirement V2 Test',types:['Rock'],
  baseStats:{hp:5,attack:5,defense:5,special_attack:5,special_defense:5,speed:5},
  abilities:[{name:'Shields Down',ability_id:'shields-down'}],forms,
  raw:{types:['Rock'],base_stats:{hp:5,attack:5,defense:5,special_attack:5,special_defense:5,speed:5},ability_slots:[{name:'Shields Down',ability_id:'shields-down'}],forms}
};

const enter=resolvePokemonForms({
  species,formState:{baseFormId:'alpha',activeFormId:'core'},
  context:{currentHp:50,maxHp:100,previousActiveFormId:null,inCombat:true}
});
assert.equal(enter.valid,true,enter.errors.join('; '));
assert.equal(enter.applied.at(-1)?.requirements?.phase,'activation');
assert.equal(enter.species.baseStats.speed,7);

const enterTooHealthy=resolvePokemonForms({
  species,formState:{baseFormId:'alpha',activeFormId:'core'},
  context:{currentHp:51,maxHp:100,previousActiveFormId:null,inCombat:true}
});
assert.equal(enterTooHealthy.valid,false);
assert.match(enterTooHealthy.errors.join(' '),/50%/);

const persistInCombat=resolvePokemonForms({
  species,formState:{baseFormId:'alpha',activeFormId:'core'},
  context:{currentHp:90,maxHp:100,previousActiveFormId:'core',inCombat:true}
});
assert.equal(persistInCombat.valid,true,persistInCombat.errors.join('; '));
assert.equal(persistInCombat.applied.at(-1)?.requirements?.phase,'persistence');

const persistOutsideCombat=resolvePokemonForms({
  species,formState:{baseFormId:'alpha',activeFormId:'core'},
  context:{currentHp:90,maxHp:100,previousActiveFormId:'core',inCombat:false}
});
assert.equal(persistOutsideCombat.valid,false);

const wrongBase=resolvePokemonForms({
  species,formState:{baseFormId:'beta',activeFormId:'core'},
  context:{currentHp:40,maxHp:100,previousActiveFormId:null,inCombat:true}
});
assert.equal(wrongBase.valid,false);
assert.match(wrongBase.errors.join(' '),/not compatible with base Form beta/i);

const gm=resolvePokemonForms({
  species,formState:{baseFormId:'beta',activeFormId:'core'},
  context:{currentHp:90,maxHp:100,previousActiveFormId:null,inCombat:true},allowUnmet:true
});
assert.equal(gm.valid,true);
assert.ok(gm.warnings.some(x=>/GM Override/.test(x)));

const serverSource=await readFile(windowsServer,'utf8');
const androidSource=await readFile(androidApi,'utf8');
for(const [label,source] of [['Windows',serverSource],['Android',androidSource]]){
  assert.match(source,/previousActiveFormId:previousFormState\.activeFormId/,`${label} Form context must expose previous active Form`);
  assert.match(source,/currentHp:payload\.currentHp\?\?pokemon\.hp/,`${label} Form context must expose current HP`);
  assert.match(source,/maxHp:payload\.maxHp\?\?pokemon\.maxHp/,`${label} Form context must expose maximum HP`);
  assert.match(source,/tempHpBySource/,`${label} Form context must expose Temporary HP provenance`);
  assert.match(source,/knownMoves/,`${label} Form context must expose known Moves`);
  assert.match(source,/formTriggerItem/,`${label} Form context must expose transformation trigger items`);
}

const catalog=JSON.parse(await readFile(catalogUrl,'utf8'));
assert.equal(catalog.schema_version,6);
assert.equal(catalog.requirement_model_version,2);
assert.equal(catalog.summary.structured_runtime_requirement_forms,8);
const families=new Map(catalog.candidate_families.map(entry=>[entry.family,entry]));
const getForm=(family,id)=>families.get(family)?.forms?.find(form=>form.id===id);
const assertNoManual=form=>assert.equal(JSON.stringify({requirements:form.requirements,activation:form.activation_requirements,persistence:form.persistence_requirements}).includes('"manual"'),false,`${form.id} must not retain a review-only manual gate`);

const schooling=getForm('wishiwashi','schooling'); assert.ok(schooling); assertNoManual(schooling);
assert.equal(schooling.requirements.all[0].kind,'ability');
assert.equal(schooling.persistence_requirements.not.all[0].kind,'hp_fraction_lt');

const core=getForm('minior','core'); assert.ok(core); assertNoManual(core);
assert.equal(core.activation_requirements.all[0].kind,'hp_fraction_lte');
assert.equal(core.persistence_requirements.any[0].kind,'in_combat');

const noice=getForm('eiscue','noice-face'); assert.ok(noice); assertNoManual(noice);
assert.equal(noice.requirements.all[1].kind,'temp_hp_source_lte');

const step=getForm('meloetta','step-forme'); assert.ok(step); assertNoManual(step);
assert.equal(step.requirements.all[0].kind,'known_move');

for(const id of ['complete-from-10-percent','complete-from-50-percent']){
  const complete=getForm('zygarde',id); assert.ok(complete); assertNoManual(complete);
  assert.equal(complete.activation_requirements.all[0].kind,'hp_fraction_lt');
  assert.deepEqual(complete.compatible_base_forms,[id.includes('10')?'10-percent':'50-percent']);
}

const zacian=getForm('zacian','crowned-sword'); assert.ok(zacian); assertNoManual(zacian);
assert.equal(zacian.activation_requirements.all[0].kind,'trigger_item');
assert.equal(zacian.activation_requirements.all[0].value,'Ancestral Sword');
const zamazenta=getForm('zamazenta','crowned-shield'); assert.ok(zamazenta); assertNoManual(zamazenta);
assert.equal(zamazenta.activation_requirements.all[0].value,'Ancestral Shield');

const deferred=new Set(['deoxys','giratina','hoopa','kyurem','landorus','oricorio','rotom','shaymin','thundurus','tornadus']);
for(const family of deferred){
  assert.equal(families.has(family),false,`${family} must remain excluded from Stage B Forms`);
  assert.ok(catalog.not_materialized.some(entry=>entry.family===family&&entry.classification==='defer'),`${family} must remain explicitly deferred`);
}

console.log('Stage B source-explicit Form requirement model v2 regression OK');
