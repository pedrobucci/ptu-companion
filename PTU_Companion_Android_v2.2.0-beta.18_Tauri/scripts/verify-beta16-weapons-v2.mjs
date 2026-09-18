import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveTrainerModel} from '../www/rules/trainer-engine.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const defs={
  'items:fine-arcane-staff':{id:'fine-arcane-staff',name:'Fine Arcane Staff',raw:{mechanics:{kind:'weapon',quality:'Fine',weaponClass:'arcane_large_melee',arcane:true,hands:2,range:'Melee',acModifier:1,dbModifier:2,damageClass:'Special',qualification:{baseSkill:'Occult Education',allowFeatureSubstitutions:false},weaponMoveRanks:{adept:4,master:6},weaponMoves:{adept:'arcane-fury',master:'magic-burst'}}},compiledEffects:[]},
  'items:doublade-living-weapon':{id:'doublade-living-weapon',name:'Doublade — Living Weapon',raw:{mechanics:{kind:'weapon',quality:'Simple',weaponClass:'small_melee',hands:2,range:'Melee',dbModifier:1,evasionBonus:2,weaponMoves:{adept:'double-swipe'}}},compiledEffects:[]},
  'moves:arcane-fury':{id:'arcane-fury',name:'Arcane Fury',category:'Special',damageBase:6,ac:2,range:'Cone 2',raw:{}},
  'moves:magic-burst':{id:'magic-burst',name:'Magic Burst',category:'Special',damageBase:9,ac:2,range:'Burst 1, Friendly',raw:{}},
  'moves:double-swipe':{id:'double-swipe',name:'Double Swipe',category:'Physical',damageBase:4,ac:2,range:'WR, 2 Targets',raw:{}}
};
const getDefinition=({kind,id})=>defs[`${kind}:${id}`]||null;
const getDamageBase=db=>({damage_base:db,rolled_damage:`DB${db}`});
const trainer=(skills={})=>({id:'v',name:'Verifier',level:10,stats:{hp:10,attack:10,defense:10,spAttack:14,spDefense:10,speed:10},gmGrants:[],equipment:{head:null,body:null,mainHand:null,offHand:null,feet:null,accessory:null},details:{background:{name:'Verifier'},skillRanks:{Acrobatics:2,Athletics:2,Combat:2,Intimidate:2,Stealth:2,Survival:2,'General Education':2,'Medicine Education':2,'Occult Education':2,'Pokémon Education':2,'Technology Education':2,Guile:2,Perception:2,Charm:2,Command:2,Focus:2,Intuition:2,...skills},features:[],edges:[],moves:[],combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0},injuries:0}});
const equip=(t,id)=>{const d=defs[`items:${id}`];t.equipment.mainHand={id,definitionId:id,name:d.name,mechanics:d.raw.mechanics};if(d.raw.mechanics.hands===2)t.equipment.offHand={name:`Reserved · ${d.name}`,reservedBy:'mainHand'};return t;};

let t=equip(trainer({'Occult Education':4,Combat:6}),'fine-arcane-staff');
let r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert.equal(r.weapons[0].arcane,true);
assert.equal(r.weapons[0].damageClass,'Special');
assert.equal(r.weapons[0].hands,2);
assert.equal(r.weapons[0].qualification.skill,'Occult Education');
assert.equal(r.weapons[0].qualification.source,'Arcane Weapon rules');
assert(r.moves.some(x=>x.id==='arcane-fury'));
assert(!r.moves.some(x=>x.id==='magic-burst'));
t.details.skillRanks['Occult Education']=6;
r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert(r.moves.some(x=>x.id==='magic-burst'));

t=equip(trainer({Combat:4}),'doublade-living-weapon');
r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert.equal(r.weapons[0].hands,2);
assert.equal(r.derived.physicalEvasion,4);
assert(r.moves.some(x=>x.id==='double-swipe'));

const runtime=fs.readFileSync(path.join(root,'www/mobile-runtime.js'),'utf8');
assert(runtime.includes("arcane_short_range:'Arcane Short Range'"));
assert(runtime.includes("source:'Arcane Weapon rules'"));
assert(runtime.includes("damageClass:mechanics.damageClass||(arcane?'Special':'Physical')"));
assert(runtime.includes("version:'2.2.0-android-beta.18'"));
console.log('PTU Companion Android v2.2.0-beta.18 weapons v2 verification: OK');
