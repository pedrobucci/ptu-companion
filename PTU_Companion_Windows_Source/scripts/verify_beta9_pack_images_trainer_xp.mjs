import assert from 'node:assert/strict';
import {readFileSync,copyFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DefinitionRepository} from '../definitions/repository.mjs';
import {inspectContentPack,importContentPack} from '../definitions/pack-importer.mjs';
import {previewTrainerProgression,applyTrainerProgression,previewTrainerXpPurchase,applyTrainerXpPurchase} from '../rules/trainer-progression-engine.mjs';

const root=new URL('..',import.meta.url).pathname;
const seedDb=join(root,'seed','definitions','ptu_seed_v1.0.sqlite3');
const packPath=join(root,'bundled-packs','campaign-homebrew-fakemon-1-leva-2.0.0.ptucp');
const pack=inspectContentPack(readFileSync(packPath));
assert.equal(pack.manifest.version,'2.0.0');
assert.equal(pack.counts.species,13);
const fakemonSpecies=['panthore','panzeus','clefable-w','clefable-k','greavard','houndstone','maschiff','mabosstiff','fidough','dachsbun','zorua-hisui','zoroark-hisui','urania'];
for(const id of fakemonSpecies) assert(pack.entries.has(`assets/species/${id}.webp`),`missing portrait ${id}`);

const defs=new DefinitionRepository(seedDb);
for(const id of fakemonSpecies){
  const d=defs.getResolved({rulesetId:'all-provided-material',kind:'species',id});
  assert(d,`bundled species ${id} missing`);
  assert.match(String(d.raw?.portrait_data_url||''),/^data:image\/webp;base64,/,`bundled portrait ${id} missing`);
}

const temp=mkdtempSync(join(tmpdir(),'ptu-beta9-'));mkdirSync(join(temp,'backups'));
const db=join(temp,'defs.sqlite3');copyFileSync(seedDb,db);
const imported=await importContentPack({buffer:readFileSync(packPath),dbPath:db,backupDir:join(temp,'backups'),enableRulesetId:'all-provided-material',archiveFilename:'fakemon.ptucp'});
assert.equal(imported.definitionCounts.species,13);
const importedDefs=new DefinitionRepository(db);
assert.match(String(importedDefs.getResolved({rulesetId:'all-provided-material',kind:'species',id:'panthore'}).raw?.portrait_data_url||''),/^data:image\/webp;base64,/);

const getDefinition=args=>defs.getResolved(args);
const listDefinitions=({rulesetId,kind,q='',limit=200,offset=0})=>defs.listResolved({rulesetId,kind,q,limit,offset});
const getDamageBase=n=>defs.getDamageBase(n);
const baseTrainer={id:'xp-test',name:'XP Test',level:18,exp:5,nextExp:10,stats:{hp:20,attack:20,defense:20,spAttack:20,spDefense:20,speed:20},details:{features:[],edges:[],skillRanks:{},progression:{milestoneChoices:{},levelHistory:[]}},history:[],gmGrants:[]};
let preview=previewTrainerProgression({trainer:baseTrainer,draft:{milestoneChoice:'',milestoneLevelUp:false,statAllocations:{hp:0,attack:0,defense:0,spAttack:0,spDefense:0,speed:0},offensiveStatAllocations:{attack:0,spAttack:0},features:[],edges:[],skillEdges:[]},rulesetId:'all-provided-material',getDefinition,listDefinitions,getDamageBase,gmOverride:false,includeOptions:false});
assert.equal(preview.xpCost,10);assert(preview.errors.some(x=>x.includes('requires 10 Trainer Experience')));
preview=previewTrainerProgression({trainer:{...baseTrainer,exp:15},draft:{milestoneChoice:'',milestoneLevelUp:true,statAllocations:{hp:0,attack:0,defense:0,spAttack:0,spDefense:0,speed:0},offensiveStatAllocations:{attack:0,spAttack:0},features:[],edges:[],skillEdges:[]},rulesetId:'all-provided-material',getDefinition,listDefinitions,getDamageBase,gmOverride:true,includeOptions:false});
assert.equal(preview.xpCost,0);assert.equal(preview.milestoneLevelUp,true);
const levelled=applyTrainerProgression({trainer:{...baseTrainer,exp:17},draft:{milestoneChoice:'',statAllocations:{},offensiveStatAllocations:{},features:[],edges:[],skillEdges:[]},preview:{valid:true,nextLevel:19,xpCost:10,milestoneLevelUp:false},getDefinition,rulesetId:'all-provided-material'});
assert.equal(levelled.level,19);assert.equal(levelled.exp,7);assert.equal(levelled.nextExp,10);

function firstDefinition(kind){
  const row=defs.listResolved({rulesetId:'all-provided-material',kind,q:'',limit:50,offset:0})[0];
  if(!row)throw new Error(`No ${kind} definitions found`);
  return defs.getResolved({rulesetId:'all-provided-material',kind,id:row.id});
}
const edge=firstDefinition('edges'),feature=firstDefinition('features');
let xpTrainer={...baseTrainer,exp:10,details:{...baseTrainer.details,features:[],edges:[]}};
let buy=previewTrainerXpPurchase({trainer:xpTrainer,kind:'edges',id:edge.id,rulesetId:'all-provided-material',getDefinition,getDamageBase,gmOverride:true});
assert.equal(buy.cost,1);assert.equal(buy.valid,true,JSON.stringify(buy.errors));
xpTrainer=applyTrainerXpPurchase({trainer:xpTrainer,kind:'edges',id:edge.id,preview:buy,getDefinition,rulesetId:'all-provided-material'});assert.equal(xpTrainer.exp,9);assert(xpTrainer.details.edges.some(x=>x.id===edge.id&&x.purchasedWithXp));
buy=previewTrainerXpPurchase({trainer:xpTrainer,kind:'features',id:feature.id,rulesetId:'all-provided-material',getDefinition,getDamageBase,gmOverride:true});
assert.equal(buy.cost,2);assert.equal(buy.valid,true,JSON.stringify(buy.errors));
xpTrainer=applyTrainerXpPurchase({trainer:xpTrainer,kind:'features',id:feature.id,preview:buy,getDefinition,rulesetId:'all-provided-material'});assert.equal(xpTrainer.exp,7);assert(xpTrainer.details.features.some(x=>x.id===feature.id&&x.purchasedWithXp));

rmSync(temp,{recursive:true,force:true});
console.log('PTU Companion Beta v2.1.0-beta.11 pack images + Trainer XP verification: OK');
