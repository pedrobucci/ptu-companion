import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {importContentPack,inspectContentPack} from '../definitions/pack-importer.mjs';
import {DefinitionRepository} from '../definitions/repository.mjs';
import {itemUsageMetadata} from '../rules/item-metadata.mjs';
import {resolveTrainerModel} from '../rules/trainer-engine.mjs';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const packPath=process.env.PTU_WEAPONS_PACK||path.join(root,'test-fixtures/content-packs/campaign-homebrew-custom-weapons-2.1.0.ptucp');
assert(fs.existsSync(packPath),`Missing weapons pack: ${packPath}`);
const inspected=inspectContentPack(fs.readFileSync(packPath));
assert.equal(inspected.manifest.version,'2.1.0');
assert.equal(inspected.counts.items,47,'Weapons pack must contain 47 items');
assert.equal(inspected.counts.moves,1,'Weapons pack must contain supporting Flametounge Move');
assert.deepEqual(inspected.warnings,[]);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ptu-weapons-v2-'));
const db=path.join(tmp,'defs.sqlite3');
fs.copyFileSync(path.join(root,'seed/definitions/ptu_seed_v1.0.sqlite3'),db);
await importContentPack({buffer:fs.readFileSync(packPath),dbPath:db,backupDir:path.join(tmp,'backups'),enableRulesetId:'all-provided-material',archiveFilename:path.basename(packPath)});
const repo=new DefinitionRepository(db);
const getDefinition=args=>repo.getResolved(args);
const getDamageBase=db=>repo.getDamageBase(db);
const item=id=>getDefinition({rulesetId:'all-provided-material',kind:'items',id});

for(const id of ['kitchen-knife','twin-needled-bow','fine-arcane-staff','fine-large-sword','doublade-living-weapon','aegislash-sword-shield','duelist-aegislash','staff-of-the-nine-flames','blood-scythe','badass-fire-sword-of-fairy-buttkicking','candy-hammer','kaladanda','excalibur','chaos-dunker']) assert(item(id),`Missing ${id}`);

const baseTrainer=(skills={})=>({
  id:'weapon-verifier',name:'Verifier',level:10,
  stats:{hp:10,attack:10,defense:10,spAttack:14,spDefense:10,speed:10},gmGrants:[],
  equipment:{head:null,body:null,mainHand:null,offHand:null,feet:null,accessory:null},
  details:{background:{name:'Verifier',adept:'Intimidate',novice:'Stealth',pathetic:['Guile','Focus','Intuition']},skillRanks:{
    Acrobatics:2,Athletics:2,Combat:2,Intimidate:4,Stealth:3,Survival:2,'General Education':2,'Medicine Education':2,'Occult Education':2,'Pokémon Education':2,'Technology Education':2,Guile:1,Perception:2,Charm:2,Command:2,Focus:1,Intuition:1,...skills
  },features:[],edges:[],moves:[],combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0},injuries:0}
});
const equip=(trainer,id)=>{
  const def=item(id);const usage=itemUsageMetadata(def);
  trainer.equipment.mainHand={id,name:def.name,definitionId:id,inventoryItemId:id,mechanics:usage.mechanics,config:{}};
  if(usage.mechanics?.hands===2)trainer.equipment.offHand={name:`Reserved · ${def.name}`,reservedBy:'mainHand',inventoryItemId:id};
  return trainer;
};

// Core Fine weapon: Combat qualification and two-hand metadata.
let t=equip(baseTrainer({Combat:6}),'twin-needled-bow');
assert.equal(t.equipment.mainHand.mechanics.hands,2);
let r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert(r.moves.some(m=>m.id==='double-swipe'),'Fine bow Adept Move missing');
assert(r.moves.some(m=>m.id==='triple-threat'),'Fine bow Master Move missing');
assert.equal(r.weapons[0].qualification.skill,'Combat');

// Arcane Editation path: Occult, Special, Adept/Master.
t=equip(baseTrainer({'Occult Education':4,Combat:2}),'fine-arcane-staff');
r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert.equal(r.weapons[0].arcane,true);
assert.equal(r.weapons[0].damageClass,'Special');
assert.equal(r.weapons[0].qualification.skill,'Occult Education');
assert.equal(r.weapons[0].qualification.source,'Arcane Weapon rules');
assert(r.moves.some(m=>m.id==='arcane-fury'),'Arcane Adept Move missing at Adept Occult');
assert(!r.moves.some(m=>m.id==='magic-burst'),'Arcane Master Move unlocked too early');
t.details.skillRanks['Occult Education']=6;
r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert(r.moves.some(m=>m.id==='magic-burst'),'Arcane Master Move missing at Master Occult');

// Normal melee still honors Apparition substitution.
t=equip(baseTrainer({Combat:2,Intimidate:4,'Occult Education':3}),'survival-knife');
t.details.features=[{id:'apparition',name:'Apparition'}];
r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert(r.moves.some(m=>m.id==='cheap-shot'),'Apparition did not qualify normal melee Adept Move');
assert.equal(r.weapons[0].qualification.skill,'Intimidate');
assert.equal(r.weapons[0].qualification.source,'Apparition');

// Living Weapon static equipment mechanics.
t=equip(baseTrainer({Combat:4}),'doublade-living-weapon');
r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert.equal(r.weapons[0].hands,2);
assert.equal(r.derived.physicalEvasion,4,'Doublade +2 Evasion did not apply'); // base Defense 10 -> 2, plus 2
assert(r.moves.some(m=>m.id==='double-swipe'),'Doublade Adept Move missing');

t=equip(baseTrainer({Combat:6}),'aegislash-sword-shield');
r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert.equal(r.derived.physicalEvasion,4,'Aegislash shield passive +2 Evasion missing');
assert(r.moves.some(m=>m.id==='wounding-strike')&&r.moves.some(m=>m.id==='bleed'),'Aegislash weapon moves missing');
assert(r.contextualEffects.some(x=>String(x.note).includes('ready the shield')),'Aegislash ready-shield rule not surfaced');

// Alchemy grants are equipment-scoped.
t=equip(baseTrainer({'Occult Education':4}),'staff-of-the-nine-flames');
r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert(r.moves.some(m=>m.id==='flame-burst'),'Staff of Nine Flames did not grant Flame Burst');
assert(r.abilities.some(a=>a.id==='fox-fire'||a.name==='Fox Fire'),'Staff of Nine Flames did not grant Fox Fire');
const noStaff=structuredClone(t);noStaff.equipment.mainHand=null;noStaff.equipment.offHand=null;
r=resolveTrainerModel({trainer:noStaff,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert(!r.moves.some(m=>m.id==='flame-burst'),'Alchemy Move survived unequip');
assert(!r.abilities.some(a=>a.id==='fox-fire'||a.name==='Fox Fire'),'Alchemy Ability survived unequip');

t=equip(baseTrainer({Combat:4}),'blood-scythe');
r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert(r.moves.some(m=>m.id==='slash'),'Blood Scythe Slash missing');
assert(r.contextualEffects.some(x=>String(x.note).includes('+5 damage')),'Blood Scythe conditional damage rule not surfaced');

// Remaining GoT example weapons: source-derived Flametounge + Candy Hammer contextual typing.
t=equip(baseTrainer({Combat:4}),'badass-fire-sword-of-fairy-buttkicking');
r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
const flame=r.moves.find(m=>m.id==='flametounge');
assert(flame,'Badass Fire Sword did not grant Flametounge');
assert.equal(flame.definition?.type,'Fire');
assert(r.contextualEffects.some(x=>String(x.note).includes('Super Effective damage to Fairy')));
t=equip(baseTrainer({Combat:4}),'candy-hammer');
r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert(r.contextualEffects.some(x=>String(x.note).includes('Candy Type Damage')));
assert(r.contextualEffects.some(x=>String(x.note).includes('restore 2 Ticks')));

// Existing homebrew weapon + Hustle remains compatible.
t=equip(baseTrainer({Combat:4}),'fine-large-sword');
r=resolveTrainerModel({trainer:t,rulesetId:'all-provided-material',getDefinition,getDamageBase});
assert(r.moves.some(m=>m.id==='wounding-strike')&&r.moves.some(m=>m.id==='chip-away'));
assert(r.abilities.some(a=>a.id==='hustle'||a.name==='Hustle'));
assert.equal(r.accuracyBonus,-2);assert.equal(r.damageRollBonus,10);

repo.close();
console.log('PTU Companion Beta v2.1.0-beta.16 weapons v2 verification: OK');
