import fs from 'node:fs';
import assert from 'node:assert/strict';
import {resolveTrainerModel} from '../rules/trainer-engine.mjs';

const app=fs.readFileSync(new URL('../static-preview/app.js',import.meta.url),'utf8');
assert(app.includes("trainerTabButton('abilities','Abilities')"),'Trainer Abilities tab button is missing');
assert(app.includes("tab==='abilities'"),'Trainer Abilities renderer is missing');
assert(app.includes("'edges','abilities','moves'"),'Trainer Abilities tab is not accepted by setTrainerTab');
assert(app.includes('RESOLVED TRAINER ABILITIES'),'Trainer Abilities section label is missing');

const defs={
  'features:test-ability-feature':{
    id:'test-ability-feature',name:'Test Ability Feature',effect:'You gain the Download Ability.',tags:[],compiledEffects:[{kind:'grant_entity',entity_kind:'ability',entity_id:'download',entity_name:'Download',confidence:'high'}],semanticAutomation:{level:'full'}
  },
  'abilities:download':{id:'download',name:'Download',effect:'Choose one of the target’s stats.',raw:{effect_text:'Choose one of the target’s stats.'}}
};
const getDefinition=({kind,id})=>defs[`${kind}:${id}`]||null;
const trainer={level:5,stats:{hp:10,attack:10,defense:10,spAttack:10,spDefense:10,speed:10},details:{features:[{id:'test-ability-feature',name:'Test Ability Feature'}],edges:[],skillRanks:{},combatStages:{}},gmGrants:[]};
const model=resolveTrainerModel({trainer,rulesetId:'test',getDefinition,getDamageBase:()=>null});
assert.equal(model.abilities.length,1,'Resolved Trainer should expose one granted Ability');
assert.equal(model.abilities[0].name,'Download','Granted Ability name mismatch');
assert.equal(model.abilities[0].source.name,'Test Ability Feature','Ability provenance should point to the granting Feature');
console.log('PTU Companion Beta v2.1.0-beta.16 Trainer Abilities verification: OK');
