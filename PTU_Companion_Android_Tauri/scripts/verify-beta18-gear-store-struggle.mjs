import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {resolveTrainerModel} from '../www/rules/trainer-engine.mjs';
import {itemUsageMetadata} from '../www/rules/item-metadata.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=fs.readFileSync(path.join(root,'www/app.js'),'utf8');
const runtime=fs.readFileSync(path.join(root,'www/mobile-runtime.js'),'utf8');
const mobile=JSON.parse(fs.readFileSync(path.join(root,'www/mobile-data.json'),'utf8'));
assert(mobile.packs.some(p=>p.id==='campaign-homebrew-trainer-gear'&&p.version==='1.0.0'&&!p.androidImported));
assert(mobile.rulesets.find(r=>r.id==='all-provided-material')?.packs.some(p=>p.pack_id==='campaign-homebrew-trainer-gear'&&p.enabled));
for(const token of ["setShopPreset('Gear Store',0)",'function isGearStoreItem','equipmentConfigForItem','itemIconHtml','STRUGGLE ATTACK','resolved?.struggleAttack']) assert(app.includes(token),`Android UI missing ${token}`);
for(const token of ['function applyGenericEquipmentMechanics','function resolveStruggleAttack','equipmentConfig:raw.equipment_config||null','raw.icon_data_url||raw.icon_url||raw.icon']) assert(runtime.includes(token),`Android runtime missing ${token}`);
assert(fs.existsSync(path.join(root,'Content Packs/campaign-homebrew-trainer-gear-1.0.0.ptucp')));
const defs={
  'items:physical-armor':{id:'physical-armor',name:'Physical Armor',effect:'',raw:{mechanics:{kind:'equipment',damageReductionByClass:{physical:5}}},compiledEffects:[]},
  'items:academic-uniform':{id:'academic-uniform',name:'Academic Uniform',effect:'',raw:{mechanics:{kind:'equipment',skillBonuses:[{skill:'$config.skill',value:4}]}},compiledEffects:[]}
};
const getDefinition=({kind,id})=>defs[`${kind}:${id}`]||null;
const getDamageBase=db=>({rolled_damage:{4:'1d8+6',5:'1d8+8'}[db]||'1d8+6'});
const t={id:'a',name:'A',level:5,stats:{hp:10,attack:10,defense:10,spAttack:10,spDefense:10,speed:10},gmGrants:[],equipment:{head:null,body:{id:'physical-armor',name:'Physical Armor',definitionId:'physical-armor',mechanics:{kind:'equipment',damageReductionByClass:{physical:5}},config:{}},mainHand:null,offHand:null,feet:null,accessory:{id:'academic-uniform',name:'Academic Uniform',definitionId:'academic-uniform',mechanics:{kind:'equipment',skillBonuses:[{skill:'$config.skill',value:4}]},config:{skill:'Occult Education'}}},details:{background:{name:'A'},skillRanks:{Combat:2,'Occult Education':3},features:[],edges:[],moves:[],combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0},injuries:0}};
const r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert.equal(r.derived.damageReductionPhysical,5);assert.equal(r.skills['Occult Education'].flatBonus,4);assert(r.struggleAttack);
console.log('PTU Companion Android v2.2.0-beta.22 Gear Store + gear mechanics + Struggle Attack verification: OK');
