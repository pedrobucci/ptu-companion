import assert from 'node:assert/strict';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DefinitionRepository } from '../definitions/repository.mjs';
import { buildPokemonPreview, buildPokemonProgressionPreview, autoBalancedAllocations } from '../rules/pokemon-engine.mjs';
import { openDatabase } from '../persistence/database.mjs';
import { CampaignRepository } from '../persistence/repository.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const definitions=new DefinitionRepository(join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'));
const ruleset='all-provided-material';

const ceruledge=definitions.getResolved({rulesetId:ruleset,kind:'species',id:'ceruledge'});
assert(ceruledge,'Ceruledge must resolve');
assert.deepEqual(ceruledge.types.map(x=>String(x).toLowerCase()),['fire','ghost']);

const charcadet=definitions.getResolved({rulesetId:ruleset,kind:'species',id:'charcadet'});
assert(charcadet,'Charcadet must resolve');
const table=definitions.getPokemonExperienceTable();
assert.equal(table.length,100);
const exp24=definitions.getPokemonExperience(24).cumulative_exp;
const exp25=definitions.getPokemonExperience(25).cumulative_exp;

const creation=buildPokemonPreview({
  species:charcadet,level:24,nature:'Hardy',
  allocations:autoBalancedAllocations({baseStats:charcadet.baseStats,nature:'Hardy',level:24}),
  selectedAbilities:['Flash Fire','Blaze'],selectedMoves:[],preEvolutionSpecies:[],moveLimitModifier:0,gmOverride:false
});
assert(creation.valid,creation.errors.join('; '));
const fake={
  id:'verify-charcadet',name:'Verify',species:'Charcadet',level:24,types:['fire'],hp:creation.maxHp,maxHp:creation.maxHp,injuries:0,
  ball:'Poké Ball',heldItem:null,img:'creatures/default.svg',storage:false,loyalty:3,rosterIds:[],combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0},
  details:{createdFromDefinition:true,speciesDefinitionId:'charcadet',speciesVersionId:charcadet.versionId,speciesContentPackId:charcadet.contentPackId,linkedRulesetId:ruleset,
    nature:'Hardy',abilities:['Flash Fire','Blaze'],statAllocations:creation.statAllocations,finalStats:creation.finalStats,experience:exp24,
    tutorPointsEarned:creation.tutorPoints.earned,tutorPointsSpent:0,tutorPointsRemaining:creation.tutorPoints.remaining,moveLimitEffective:6,moves:[]}
};

const progression=buildPokemonProgressionPreview({
  pokemon:fake,species:charcadet,experienceTable:table,expGain:exp25-exp24,
  newStatAllocations:{hp:0,attack:1,defense:0,special_attack:0,special_defense:0,speed:0}
});
assert.equal(progression.targetLevel,25);
assert.equal(progression.rewards.statPoints,1);
assert.equal(progression.rewards.tutorPoints,1);
assert(progression.valid,progression.errors.join('; '));

const evos=definitions.getOutgoingEvolutions({rulesetId:ruleset,speciesName:'Charcadet',sourceId:charcadet.sourceId});
const cerEvo=evos.find(e=>e.target.id==='ceruledge');
assert(cerEvo,'Charcadet -> Ceruledge evolution must resolve');
assert.deepEqual(cerEvo.target.types.map(x=>String(x).toLowerCase()),['fire','ghost']);

const evoPreview=buildPokemonProgressionPreview({
  pokemon:fake,species:charcadet,experienceTable:table,expGain:exp25-exp24,
  evolutionTarget:cerEvo.target,evolutionEdge:cerEvo,
  evolutionAllocations:autoBalancedAllocations({baseStats:cerEvo.target.baseStats,nature:'Hardy',level:25}),
  selectedMoves:[],manualEvolutionCondition:true
});
assert(evoPreview.valid,evoPreview.errors.join('; '));
assert.equal(evoPreview.targetSpecies.name,'Ceruledge');
assert.deepEqual(evoPreview.targetSpecies.types.map(x=>String(x).toLowerCase()),['fire','ghost']);
assert.equal(evoPreview.selectedAbilities[0],'Flash Fire');
assert.equal(evoPreview.selectedAbilities[1],'Weak Armor');
assert(evoPreview.newMoveKeys.includes('shadow-claw'),'Evolution Move Shadow Claw should be offered');

// Level 20 Ability unlock should require the new slot.
const creation19=buildPokemonPreview({
  species:charcadet,level:19,nature:'Hardy',allocations:autoBalancedAllocations({baseStats:charcadet.baseStats,nature:'Hardy',level:19}),
  selectedAbilities:['Flash Fire'],selectedMoves:[],preEvolutionSpecies:[],moveLimitModifier:0,gmOverride:false
});
const fake19={...fake,level:19,details:{...fake.details,experience:definitions.getPokemonExperience(19).cumulative_exp,abilities:['Flash Fire'],statAllocations:creation19.statAllocations,tutorPointsEarned:creation19.tutorPoints.earned}};
const gain20=definitions.getPokemonExperience(20).cumulative_exp-definitions.getPokemonExperience(19).cumulative_exp;
let p20=buildPokemonProgressionPreview({pokemon:fake19,species:charcadet,experienceTable:table,expGain:gain20,newStatAllocations:{hp:0,attack:1,defense:0,special_attack:0,special_defense:0,speed:0}});
assert.equal(p20.targetLevel,20);
assert.deepEqual(p20.rewards.abilityUnlockLevels,[20]);
assert(!p20.valid && p20.errors.some(x=>x.includes('Level 20 Ability')));
p20=buildPokemonProgressionPreview({pokemon:fake19,species:charcadet,experienceTable:table,expGain:gain20,newStatAllocations:{hp:0,attack:1,defense:0,special_attack:0,special_defense:0,speed:0},selectedAbilities:['Flash Fire','Blaze']});
assert(p20.valid,p20.errors.join('; '));

// UI wiring checks.
const app=readFileSync(join(root,'static-preview','app.js'),'utf8');
assert(app.includes('function pokemonProgressionScreen()'));
assert(app.includes('beginPokemonProgression'));
assert(app.includes("pokemonprogress:pokemonProgressionScreen"));
assert(app.includes("buildEngineVersion='0.8.0'") || app.includes("buildEngineVersion:'0.8.0'"));
assert(app.includes('scrollTop=scroll.top'));

// SQLite details_json round trip with progression metadata.
const temp=join(root,'data','verify_v08.sqlite3');
for(const suffix of ['', '-wal','-shm']) if(existsSync(temp+suffix)) rmSync(temp+suffix,{force:true});
const db=openDatabase(temp); const repo=new CampaignRepository(db);
const seed=JSON.parse(readFileSync(join(root,'seed','default-state.json'),'utf8'));
seed.pokemon.push({...fake,details:{...fake.details,progressionHistory:[{fromLevel:24,toLevel:25,expGain:exp25-exp24}]}});
repo.saveState(seed,{createRevision:true});
const loaded=repo.loadState(seed.activeProfileId); const persisted=loaded.pokemon.find(x=>x.id===fake.id);
assert.equal(persisted.details.progressionHistory[0].toLevel,25);
db.close();
for(const suffix of ['', '-wal','-shm']) if(existsSync(temp+suffix)) rmSync(temp+suffix,{force:true});

definitions.close();
console.log('PTU Companion v0.8 verification: OK');
console.log('Ceruledge typing: Fire / Ghost');
console.log('Pokémon EXP table: 100 levels');
console.log('Lv 24 -> 25: +1 Stat Point, +1 Tutor Point');
console.log('Lv 20 Ability unlock: validated');
console.log('Charcadet -> Ceruledge evolution: validated');
console.log('Evolution re-Stat + Move/Ability mapping: passed');
console.log('SQLite progression history round-trip: passed');
