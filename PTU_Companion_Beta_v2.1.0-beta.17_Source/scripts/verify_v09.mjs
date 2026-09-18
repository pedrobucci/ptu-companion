import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DefinitionRepository } from '../definitions/repository.mjs';
import { buildPokemonPreview, buildPokemonProgressionPreview, autoBalancedAllocations } from '../rules/pokemon-engine.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const definitions=new DefinitionRepository(join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'));
const ruleset='all-provided-material';
const table=definitions.getPokemonExperienceTable();
assert.equal(table.length,100);

const charcadet=definitions.getResolved({rulesetId:ruleset,kind:'species',id:'charcadet'});
assert(charcadet);
const creation=buildPokemonPreview({
  species:charcadet,level:24,nature:'Hardy',
  allocations:autoBalancedAllocations({baseStats:charcadet.baseStats,nature:'Hardy',level:24}),
  selectedAbilities:['Flash Fire','Blaze'],selectedMoves:[],preEvolutionSpecies:[],moveLimitModifier:0,gmOverride:false
});
assert(creation.valid,creation.errors.join('; '));
const exp24=definitions.getPokemonExperience(24).cumulative_exp;
const fake={
  id:'v09-charcadet',name:'Target Test',species:'Charcadet',level:24,types:['fire'],hp:creation.maxHp,maxHp:creation.maxHp,injuries:0,
  details:{createdFromDefinition:true,speciesDefinitionId:'charcadet',speciesVersionId:charcadet.versionId,speciesContentPackId:charcadet.contentPackId,linkedRulesetId:ruleset,
    nature:'Hardy',abilities:['Flash Fire','Blaze'],statAllocations:creation.statAllocations,finalStats:creation.finalStats,experience:exp24,
    tutorPointsEarned:creation.tutorPoints.earned,tutorPointsSpent:0,tutorPointsRemaining:creation.tutorPoints.remaining,moveLimitEffective:6,moves:[]}
};

const to30=buildPokemonProgressionPreview({
  pokemon:fake,species:charcadet,experienceTable:table,targetLevel:30,
  newStatAllocations:{hp:0,attack:6,defense:0,special_attack:0,special_defense:0,speed:0}
});
assert.equal(to30.progressionMode,'target_level');
assert.equal(to30.targetLevel,30);
assert.equal(to30.totalExperience,definitions.getPokemonExperience(30).cumulative_exp);
assert.equal(to30.experienceGain,to30.totalExperience-exp24);
assert.equal(to30.rewards.statPoints,6);
assert(to30.valid,to30.errors.join('; '));

const backwards=buildPokemonProgressionPreview({pokemon:fake,species:charcadet,experienceTable:table,targetLevel:20,newStatAllocations:{}});
assert(!backwards.valid);
assert(backwards.errors.some(x=>x.includes('cannot be lower')));

const evos=definitions.getOutgoingEvolutions({rulesetId:ruleset,speciesName:'Charcadet',sourceId:charcadet.sourceId});
const cer=evos.find(e=>e.target.id==='ceruledge');
assert(cer);
assert.equal(cer.toMinLevel,25);
assert.equal(cer.evolutionRulesSource,'ptu_material');
assert.equal(cer.sourceId,'knight');
assert.equal(cer.sourceTitle,'Knight');

const guidance=definitions.getEvolutionGuidance();
assert.equal(guidance.sourcePolicy.progressionTable,'ptu_evolution_edges');
assert.equal(guidance.sourcePolicy.canonicalCatalogUsedForLevels,false);
assert(guidance.customSuggestions.some(x=>x.id==='three-stage-standard' && x.minimumLevels[1]===15 && x.minimumLevels[2]===30));
assert(guidance.customSuggestions.some(x=>x.id==='two-stage-standard' && x.minimumLevels[1]===25));

const repoSource=readFileSync(join(root,'definitions','repository.mjs'),'utf8');
const outgoingBlock=repoSource.slice(repoSource.indexOf('getOutgoingEvolutions'),repoSource.indexOf('getEvolutionGuidance'));
assert(outgoingBlock.includes('FROM ptu_evolution_edges'));
assert(!outgoingBlock.includes('canonical_evolution_edges_current'));

const app=readFileSync(join(root,'static-preview','app.js'),'utf8');
assert(app.includes("setPokemonProgressMode('level')"));
assert(app.includes('Target Level'));
assert(app.includes('PTU EVOLUTION AUTHORING GUIDE'));
assert(app.includes('PTU source:'));

const server=readFileSync(join(root,'server.mjs'),'utf8');
assert(server.includes("version:'0.9.0'"));
assert(server.includes('/api/pokemon/evolution-guidance'));
assert(server.includes('targetLevel:payload.targetLevel'));

definitions.close();
console.log('PTU Companion v0.9 verification: OK');
console.log(`Target Level 24 -> 30: +${to30.experienceGain} EXP, ${to30.rewards.statPoints} Stat Points`);
console.log('Evolution Levels: PTU material source policy passed');
console.log(`Charcadet -> Ceruledge: Lv. ${cer.toMinLevel} from ${cer.sourceTitle}`);
console.log('Custom evolution authoring guidance: passed');
