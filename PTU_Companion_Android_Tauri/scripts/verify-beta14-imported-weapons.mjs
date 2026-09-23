import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {itemUsageMetadata} from '../www/rules/item-metadata.mjs';
import {resolveTrainerModel} from '../www/rules/trainer-engine.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const item={
  id:'fine-large-sword',name:'Fine Large Sword',packName:'Campaign Homebrew — Custom Weapons',sourceId:'campaign-homebrew-custom-weapons',effect:'Custom weapon',
  raw:{trainer_usable:true,equipment_slots:['mainHand'],mechanics:{kind:'weapon',quality:'Fine',weaponClass:'large_melee',hands:2,metal:true,range:'Melee',acModifier:1,dbModifier:2,weaponMoves:{adept:'wounding-strike',master:'slice'},tags:['Melee','Large Melee','Two-Handed','Sword']}},
  compiledEffects:[
    {kind:'grant_entity',entity_kind:'move',entity_id:'chip-away',entity_name:'Chip Away',confidence:'high'},
    {kind:'grant_entity',entity_kind:'ability',entity_id:'hustle',entity_name:'Hustle',confidence:'high'}
  ]
};
const defs={
  'items:fine-large-sword':item,
  'features:apparition':{id:'apparition',name:'Apparition',effect:'Melee weapon qualification substitution.',raw:{tags:['Class','Weapon']},compiledEffects:[]},
  'moves:wounding-strike':{id:'wounding-strike',name:'Wounding Strike',category:'Physical',damageBase:6,ac:2,range:'Melee, 1 Target',raw:{}},
  'moves:slice':{id:'slice',name:'Slice',category:'Physical',damageBase:8,ac:2,range:'Melee, 1 Target',raw:{}},
  'moves:chip-away':{id:'chip-away',name:'Chip Away',category:'Physical',damageBase:6,ac:2,range:'Melee, 1 Target',raw:{}},
  'abilities:hustle':{id:'hustle',name:'Hustle',effect:'Hustle',raw:{}}
};
const getDefinition=({kind,id})=>defs[`${kind}:${id}`]||null;
const getDamageBase=db=>({damage_base:db,rolled_damage:'2d6+8'});
const usage=itemUsageMetadata(item);
assert.equal(usage.mechanics.kind,'weapon');
assert.equal(usage.mechanics.hands,2);
assert.deepEqual(usage.equipmentSlots,['mainHand']);

const trainer={id:'william',name:'William',level:8,stats:{hp:17,attack:9,defense:5,spAttack:10,spDefense:10,speed:5},gmGrants:[],equipment:{head:null,body:null,mainHand:{id:'fine-large-sword',name:'Fine Large Sword',definitionId:'fine-large-sword',inventoryItemId:'fine-large-sword',mechanics:usage.mechanics,config:{}},offHand:{name:'Reserved · Fine Large Sword',reservedBy:'mainHand',inventoryItemId:'fine-large-sword'},feet:null,accessory:null},details:{background:{name:'Dark/Ghost Detective',adept:'Intimidate',novice:'Stealth',pathetic:['Pokémon Education','Technology Education','Medicine Education']},skillRanks:{'Acrobatics':2,'Athletics':2,'Combat':2,'Intimidate':4,'Stealth':3,'Survival':2,'General Education':2,'Medicine Education':1,'Occult Education':3,'Pokémon Education':1,'Technology Education':1,'Guile':2,'Perception':2,'Charm':2,'Command':2,'Focus':2,'Intuition':2},features:[{id:'apparition',name:'Apparition'}],edges:[],moves:[],combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0},injuries:0}};
let resolved=resolveTrainerModel({trainer,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert.equal(resolved.weapons[0]?.hands,2);
const wounding=resolved.moves.find(m=>m.id==='wounding-strike');
assert(wounding,'Adept Move missing');
assert.equal(wounding.resolvedDamage.weapon.qualification.skill,'Intimidate');
assert.equal(wounding.resolvedDamage.weapon.qualification.source,'Apparition');
assert(!resolved.moves.some(m=>m.id==='slice'),'Master Move should not be available at Adept qualification');
assert(resolved.moves.some(m=>m.id==='chip-away'),'Special equip-only Move missing');
assert(resolved.abilities.some(a=>a.id==='hustle'||a.name==='Hustle'),'Special equip-only Ability missing');
const unequipped=structuredClone(trainer);unequipped.equipment.mainHand=null;unequipped.equipment.offHand=null;
resolved=resolveTrainerModel({trainer:unequipped,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert(!resolved.moves.some(m=>['wounding-strike','slice','chip-away'].includes(m.id)));
assert(!resolved.abilities.some(a=>a.id==='hustle'||a.name==='Hustle'));

// The WebView uses the bundled monolithic copy, so assert the patch/version is present there too.
const runtime=fs.readFileSync(path.join(root,'www/mobile-runtime.js'),'utf8');
assert(runtime.includes("raw.mechanics&&typeof raw.mechanics==='object'"));
assert(runtime.includes("def?.raw?.mechanics&&typeof def.raw.mechanics==='object'"));
assert(runtime.includes('for(const effect of def?.compiledEffects||[]) applyCompiledEffect(model,effect,source,ctx);'));
assert(runtime.includes("version:'2.2.0-android-beta.22'"));
console.log('PTU Companion Android v2.2.0-beta.22 imported weapon mechanics verification: OK');
