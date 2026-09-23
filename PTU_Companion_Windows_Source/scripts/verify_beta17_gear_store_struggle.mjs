import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {importContentPack,inspectContentPack} from '../definitions/pack-importer.mjs';
import {DefinitionRepository} from '../definitions/repository.mjs';
import {itemUsageMetadata} from '../rules/item-metadata.mjs';
import {resolveTrainerModel} from '../rules/trainer-engine.mjs';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const gearPath=path.join(root,'test-fixtures/content-packs/campaign-homebrew-trainer-gear-1.0.0.ptucp');
const weaponsPath=path.join(root,'test-fixtures/content-packs/campaign-homebrew-custom-weapons-2.1.0.ptucp');
const bundledRepo=new DefinitionRepository(path.join(root,'seed/definitions/ptu_seed_v1.0.sqlite3'));
assert.equal(bundledRepo.countResolved({rulesetId:'all-provided-material',kind:'items'}),508,'bundled Weapon + Gear packs must resolve in the default catalog');
assert.equal(bundledRepo.getPacks().find(p=>p.id==='campaign-homebrew-custom-weapons')?.version,'2.1.0');
assert.equal(bundledRepo.getPacks().find(p=>p.id==='campaign-homebrew-trainer-gear')?.version,'1.0.0');
bundledRepo.close();
const inspected=inspectContentPack(fs.readFileSync(gearPath));
assert.equal(inspected.manifest.id,'campaign-homebrew-trainer-gear');
assert.equal(inspected.counts.items,137);
assert.deepEqual(inspected.warnings,[]);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ptu-gear-'));
const db=path.join(tmp,'defs.sqlite3');
fs.copyFileSync(path.join(root,'seed/definitions/ptu_seed_v1.0.sqlite3'),db);
for(const pack of [gearPath,weaponsPath]) await importContentPack({buffer:fs.readFileSync(pack),dbPath:db,backupDir:path.join(tmp,'backups'),enableRulesetId:'all-provided-material',archiveFilename:path.basename(pack)});
const repo=new DefinitionRepository(db);
const getDefinition=args=>repo.getResolved(args);
const getDamageBase=n=>repo.getDamageBase(n);
const item=id=>getDefinition({rulesetId:'all-provided-material',kind:'items',id});
for(const id of ['academic-uniform','physical-armor','ninja-tabi','wide-lens','choice-band','shell-bell','robes-of-the-songbird','hand-cannon']) assert(item(id),`missing ${id}`);
assert(item('physical-armor').raw.shop_categories.includes('Gear Store'));
assert(/^https:\/\//.test(item('physical-armor').raw.icon_url));
assert(item('academic-uniform').raw.equipment_config?.fields?.length);

const skills={Acrobatics:2,Athletics:2,Combat:2,Intimidate:4,Stealth:3,Survival:2,'General Education':2,'Medicine Education':2,'Occult Education':3,'Pokémon Education':2,'Technology Education':2,Guile:2,Perception:2,Charm:2,Command:2,Focus:2,Intuition:2};
const t={id:'gear-test',name:'Gear Test',level:8,stats:{hp:12,attack:9,defense:10,spAttack:11,spDefense:10,speed:8},gmGrants:[],equipment:{head:null,body:null,mainHand:null,offHand:null,feet:null,accessory:null},details:{background:{name:'Test'},skillRanks:skills,features:[{id:'apparition',name:'Apparition'}],edges:[],moves:[],combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0},injuries:0}};
function equip(slot,id,config={}){const def=item(id),usage=itemUsageMetadata(def);t.equipment[slot]={id,name:def.name,definitionId:id,inventoryItemId:id,mechanics:usage.mechanics,config};return def;}

equip('body','physical-armor');
equip('head','choice-band');
equip('feet','ninja-tabi');
equip('accessory','academic-uniform',{skill:'Occult Education'});
let r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert.equal(r.derived.damageReductionPhysical,5);
assert.equal(r.derived.damageReductionSpecial,0);
assert.equal(r.defaultCombatStages.attack,2);
assert.equal(r.skills['Occult Education'].flatBonus,4);
assert.equal(r.skills.Stealth.flatBonus,2);
assert(r.grantedCapabilities.some(c=>c.name==='Dead Silent'));
// Structured Core override must not receive the old hardcoded Light Armor bonus twice.
const light=item('light-armor'),lightUsage=itemUsageMetadata(light);t.equipment.body={id:'light-armor',name:light.name,definitionId:light.id,inventoryItemId:light.id,mechanics:lightUsage.mechanics,config:{}};
r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert.equal(r.derived.damageReduction,5,'Light Armor structured DR was double-counted');

// Use the imported custom sword to verify the Combat tab's resolved Struggle Attack model.
const sword=item('fine-large-sword'); const swordUsage=itemUsageMetadata(sword);
t.equipment.mainHand={id:'fine-large-sword',name:sword.name,definitionId:sword.id,inventoryItemId:sword.id,mechanics:swordUsage.mechanics,config:{}};
t.equipment.offHand={name:`Reserved · ${sword.name}`,reservedBy:'mainHand',inventoryItemId:sword.id};
r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert.equal(r.struggleAttack.weapon.name,'Fine Large Sword');
assert.equal(r.struggleAttack.qualification.skill,'Intimidate');
assert.equal(r.struggleAttack.qualification.source,'Apparition');
assert.equal(r.struggleAttack.finalDb,6); // base DB4 (Adept, not Expert) + Large Melee +2
assert.equal(r.struggleAttack.category,'Physical');
assert.equal(r.struggleAttack.ac,5); // base AC4 + Large Melee +1
assert.equal(r.struggleAttack.accuracyModifier,-2); // Hustle
assert(r.struggleAttack.expression); // damage expression resolved

repo.close();
const app=fs.readFileSync(path.join(root,'static-preview/app.js'),'utf8');
for(const token of ["setShopPreset('Gear Store',0)",'function isGearStoreItem','equipmentConfigForItem','itemIconHtml','STRUGGLE ATTACK','resolved?.struggleAttack']) assert(app.includes(token),`UI missing ${token}`);
const server=fs.readFileSync(path.join(root,'server.mjs'),'utf8');
assert(server.includes('raw.icon_data_url||raw.icon_url||raw.icon'));
assert(server.includes('equipmentConfig:raw.equipment_config||null'));
console.log('PTU Companion Beta v2.1.0-beta.20 gear + Gear Store + Struggle Attack verification: OK');
