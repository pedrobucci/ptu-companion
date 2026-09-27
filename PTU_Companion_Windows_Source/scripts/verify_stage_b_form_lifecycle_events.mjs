import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {applyPokemonFormTransitionEvent,FORM_EVENT_SCHEMA_VERSION,FORM_LIFECYCLE_MODEL_VERSION} from '../rules/pokemon-form-events.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const repo=resolve(here,'../..');
const catalog=JSON.parse(await readFile(resolve(repo,'docs/data/PTU_FORMS_STAGE_B.json'),'utf8'));
const winEvents=await readFile(resolve(repo,'PTU_Companion_Windows_Source/rules/pokemon-form-events.mjs'),'utf8');
const androidEvents=await readFile(resolve(repo,'PTU_Companion_Android_Tauri/www/rules/pokemon-form-events.mjs'),'utf8');
assert.equal(winEvents,androidEvents,'Windows/Android lifecycle engines must remain byte-identical');
assert.equal(FORM_EVENT_SCHEMA_VERSION,1);
assert.equal(FORM_LIFECYCLE_MODEL_VERSION,1);
assert.equal(catalog.schema_version,7);
assert.equal(catalog.requirement_model_version,2);
assert.equal(catalog.lifecycle_model_version,1);
assert.equal(catalog.summary.lifecycle_automated_forms,8);
assert.equal(catalog.summary.lifecycle_event_rules,24);

const family=name=>{
  const entry=catalog.candidate_families.find(row=>row.family===name);
  assert.ok(entry,`missing family ${name}`);
  return entry;
};
const form=(entry,id)=>{
  const row=entry.forms.find(candidate=>candidate.id===id);
  assert.ok(row,`missing ${entry.family}:${id}`);
  return row;
};
const species=(name,base={})=>({id:name,name,forms:family(name).forms,...base});
const active=result=>result.formState.activeFormId;
const effect=(result,kind='grant_temp_hp')=>result.effects.find(row=>row.kind===kind);

// Aegislash: exact automatic Move triggers plus Full Action toggle.
const aeg=species('aegislash');
assert.equal(form(family('aegislash'),'sword-stance').requirements,undefined,'Aegislash event triggers replace the old manual gate');
let result=applyPokemonFormTransitionEvent({species:aeg,formState:{baseFormId:'base',activeFormId:null},event:{kind:'move-used',move:'Iron Head',damaging:true}});
assert.equal(result.valid,true); assert.equal(active(result),'sword-stance');
result=applyPokemonFormTransitionEvent({species:aeg,formState:result.formState,event:{kind:'move-used',move:"King's Shield",moveClass:'Status'}});
assert.equal(active(result),null);
result=applyPokemonFormTransitionEvent({species:aeg,formState:{baseFormId:'base',activeFormId:'sword-stance'},event:{kind:'move-used',move:'Defend Order',moveClass:'Status',raisesDefenseCombatStages:true}});
assert.equal(active(result),null);
result=applyPokemonFormTransitionEvent({species:aeg,formState:{baseFormId:'base',activeFormId:'sword-stance'},event:{kind:'move-used',move:'Example Blessing',tags:['Blessing']}});
assert.equal(active(result),null);
result=applyPokemonFormTransitionEvent({species:aeg,formState:{baseFormId:'base',activeFormId:null},event:{kind:'form-action',actionId:'stance-change-full-action'}});
assert.equal(active(result),'sword-stance');
result=applyPokemonFormTransitionEvent({species:aeg,formState:result.formState,event:{kind:'form-action',actionId:'stance-change-full-action'}});
assert.equal(active(result),null);

// Wishiwashi: Ability use activates and returns exact half-Max-HP directive; state events enforce exit.
const wish=species('wishiwashi');
result=applyPokemonFormTransitionEvent({
  species:wish,formState:{baseFormId:'base',activeFormId:null},
  context:{abilities:['Schooling'],currentHp:40,maxHp:100,tempHp:0},
  event:{kind:'ability-used',ability:'Schooling'}
});
assert.equal(result.valid,true); assert.equal(active(result),'schooling');
assert.equal(effect(result).amount,50); assert.equal(effect(result).source,'schooling'); assert.equal(effect(result).blocksOtherSources,true);
result=applyPokemonFormTransitionEvent({
  species:wish,formState:result.formState,
  context:{abilities:['Schooling'],currentHp:40,maxHp:100,tempHp:0},event:{kind:'temp-hp-changed'}
});
assert.equal(active(result),null,'Schooling must return Solo below half HP when THP is exhausted');

// Minior: Static synchronization respects the special outside-combat reversion.
const minior=species('minior');
result=applyPokemonFormTransitionEvent({
  species:minior,formState:{baseFormId:'base',activeFormId:null},
  context:{abilities:['Shields Down'],currentHp:50,maxHp:100,inCombat:true},event:{kind:'hp-changed'}
});
assert.equal(active(result),'core');
result=applyPokemonFormTransitionEvent({
  species:minior,formState:result.formState,
  context:{abilities:['Shields Down'],currentHp:60,maxHp:100,inCombat:true},event:{kind:'hp-changed'}
});
assert.equal(active(result),'core','Core remains while in combat after healing above half');
result=applyPokemonFormTransitionEvent({
  species:minior,formState:result.formState,
  context:{abilities:['Shields Down'],currentHp:60,maxHp:100,inCombat:false},event:{kind:'combat-state-changed'}
});
assert.equal(active(result),null,'outside combat above half returns Meteor');

// Eiscue: battle start/Hail restoration grant two source ticks and THP provenance synchronizes state.
const eiscue=species('eiscue');
result=applyPokemonFormTransitionEvent({
  species:eiscue,formState:{baseFormId:'base',activeFormId:null},context:{abilities:['Ice Face'],maxHp:95,tempHpBySource:{}},event:{kind:'battle-start'}
});
assert.equal(active(result),null); assert.equal(effect(result).formula.kind,'ticks_of_max_hp'); assert.equal(effect(result).formula.ticks,2); assert.equal(effect(result).unroundedAmount,19);
result=applyPokemonFormTransitionEvent({
  species:eiscue,formState:{baseFormId:'base',activeFormId:null},context:{abilities:['Ice Face'],maxHp:95,tempHpBySource:{'ice-face':0}},event:{kind:'temp-hp-changed'}
});
assert.equal(active(result),'noice-face');
result=applyPokemonFormTransitionEvent({
  species:eiscue,formState:result.formState,context:{abilities:['Ice Face'],maxHp:95,tempHpBySource:{'ice-face':0}},event:{kind:'form-action',actionId:'ice-face-hail-restore',weather:'Hail'}
});
assert.equal(active(result),null); assert.equal(effect(result).source,'ice-face'); assert.equal(effect(result).formula.ticks,2);

// Zygarde: base-compatible Power Construct activation, source THP formula, scene expiry.
const zygarde=species('zygarde');
result=applyPokemonFormTransitionEvent({
  species:zygarde,formState:{baseFormId:'10-percent',activeFormId:null},
  context:{abilities:['Power Construct'],currentHp:40,maxHp:100},
  event:{kind:'ability-used',ability:'Power Construct',targetFormMaxHp:220}
});
assert.equal(result.valid,true); assert.equal(active(result),'complete-from-10-percent');
assert.equal(effect(result).amount,110); assert.equal(effect(result).formula.kind,'fraction_of_target_form_max_hp'); assert.equal(effect(result).blocksOtherSources,true);
result=applyPokemonFormTransitionEvent({species:zygarde,formState:result.formState,context:{abilities:['Power Construct'],currentHp:40,maxHp:100},event:{kind:'scene-end'}});
assert.equal(active(result),null);
const wrongBase=applyPokemonFormTransitionEvent({
  species:zygarde,formState:{baseFormId:'50-percent',activeFormId:null},context:{abilities:['Power Construct'],currentHp:40,maxHp:100},event:{kind:'ability-used',ability:'Power Construct',targetFormMaxHp:220}
});
assert.equal(active(wrongBase),'complete-from-50-percent','50% base must select its own HP-preserving Complete overlay');

// Weapon Bond: matching item entry, Faint expiry, and voluntary relinquish.
for(const [name,crowned,item] of [['zacian','crowned-sword','Ancestral Sword'],['zamazenta','crowned-shield','Ancestral Shield']]){
  const mon=species(name);
  result=applyPokemonFormTransitionEvent({
    species:mon,formState:{baseFormId:'hero-of-many-battles',activeFormId:null},
    context:{capabilities:['Weapon Bond']},event:{kind:'capability-used',capability:'Weapon Bond',triggerItem:item}
  });
  assert.equal(result.valid,true); assert.equal(active(result),crowned);
  const fainted=applyPokemonFormTransitionEvent({species:mon,formState:result.formState,context:{capabilities:['Weapon Bond']},event:{kind:'faint'}});
  assert.equal(active(fainted),null);
  const reenter=applyPokemonFormTransitionEvent({
    species:mon,formState:{baseFormId:'hero-of-many-battles',activeFormId:null},context:{capabilities:['Weapon Bond']},event:{kind:'capability-used',capability:'Weapon Bond',triggerItem:item}
  });
  const relinquished=applyPokemonFormTransitionEvent({species:mon,formState:reenter.formState,context:{capabilities:['Weapon Bond']},event:{kind:'form-action',actionId:'weapon-bond-relinquish'}});
  assert.equal(active(relinquished),null);
  const wrongItem=applyPokemonFormTransitionEvent({
    species:mon,formState:{baseFormId:'hero-of-many-battles',activeFormId:null},context:{capabilities:['Weapon Bond']},event:{kind:'capability-used',capability:'Weapon Bond',triggerItem:'Wrong Item'}
  });
  assert.equal(active(wrongItem),null); assert.equal(wrongItem.changed,false);
}

// Deferred families stay completely outside lifecycle materialization.
const deferred=new Set(['deoxys','giratina','hoopa','kyurem','landorus','oricorio','rotom','shaymin','thundurus','tornadus']);
for(const name of deferred){
  const entry=catalog.not_materialized.find(row=>row.family===name);
  assert.ok(entry,`deferred family missing from gate: ${name}`);
  assert.equal(catalog.candidate_families.some(row=>row.family===name),false,`deferred family materialized unexpectedly: ${name}`);
}

console.log(JSON.stringify({
  schema_version:catalog.schema_version,
  lifecycle_model_version:catalog.lifecycle_model_version,
  lifecycle_automated_forms:catalog.summary.lifecycle_automated_forms,
  lifecycle_event_rules:catalog.summary.lifecycle_event_rules,
  deferred_families:deferred.size,
},null,2));
