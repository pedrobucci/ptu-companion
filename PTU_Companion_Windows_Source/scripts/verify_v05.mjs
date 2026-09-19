import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { openDatabase } from '../persistence/database.mjs';
import { CampaignRepository } from '../persistence/repository.mjs';
import { DefinitionRepository } from '../definitions/repository.mjs';
import { applyNature, autoBalancedAllocations, buildPokemonPreview, levelAbilitySlots, tutorPointsAtLevel } from '../rules/pokemon-engine.mjs';

const seed = JSON.parse(readFileSync(new URL('../seed/default-state.json', import.meta.url), 'utf8'));
seed.version = 2;
const dir = mkdtempSync(join(tmpdir(), 'ptu-v05-'));
const campaignDb = openDatabase(join(dir, 'campaign.sqlite3'));
const campaign = new CampaignRepository(campaignDb);
const definitionsPath = new URL('../seed/definitions/ptu_seed_v1.0.sqlite3', import.meta.url);
const definitions = new DefinitionRepository(definitionsPath.pathname);

try {
  campaign.saveState(seed);
  let loaded = campaign.loadState('alex');
  assert.equal(loaded.pokemon.length, 8);

  const charmander=definitions.getResolved({rulesetId:'all-provided-material',kind:'species',id:'charmander'});
  assert.ok(charmander?.baseStats);
  const adamant=applyNature(charmander.baseStats,'Adamant');
  assert.equal(adamant.stats.attack,7); // Base 5 + 2
  assert.equal(adamant.stats.special_attack,4); // Base 6 - 2
  assert.equal(adamant.stats.hp,4);

  const cuddly=applyNature(charmander.baseStats,'Cuddly');
  assert.equal(cuddly.stats.hp,5); // HP only +/-1
  assert.equal(cuddly.stats.attack,3);

  const allocations=autoBalancedAllocations({baseStats:charmander.baseStats,nature:'Hardy',level:5});
  assert.equal(Object.values(allocations).reduce((a,b)=>a+b,0),15); // Level + 10
  const preview=buildPokemonPreview({
    species:charmander,level:5,nature:'Hardy',allocations,
    selectedAbilities:['Blaze'],selectedMoves:[],incomingEvolution:null
  });
  assert.equal(preview.statBudget.total,15);
  assert.equal(preview.statBudget.remaining,0);
  assert.equal(preview.baseRelations.valid,true);
  assert.equal(preview.maxHp,5+(preview.finalStats.hp*3)+10);
  assert.equal(preview.tutorPoints.earned,2); // hatch + level 5
  assert.equal(preview.moveLimit.effective,6);
  assert.equal(preview.valid,true);

  assert.equal(tutorPointsAtLevel(1),1);
  assert.equal(tutorPointsAtLevel(5),2);
  assert.equal(tutorPointsAtLevel(20),5);
  assert.equal(levelAbilitySlots(1).length,1);
  assert.equal(levelAbilitySlots(20).length,2);
  assert.equal(levelAbilitySlots(40).length,3);

  // The UI/domain model must not hardcode an array of exactly six moves.
  const highAlloc=autoBalancedAllocations({baseStats:charmander.baseStats,nature:'Hardy',level:40});
  const highEligible=buildPokemonPreview({
    species:charmander,level:40,nature:'Hardy',allocations:highAlloc,
    selectedAbilities:['Blaze','Solar Power','Dodge'],selectedMoves:[],moveLimitModifier:2
  });
  const eightMoves=highEligible.eligibleMoves.slice(0,8).map(m=>m.key);
  const highPreview=buildPokemonPreview({
    species:charmander,level:40,nature:'Hardy',allocations:highAlloc,
    selectedAbilities:['Blaze','Solar Power','Dodge'],selectedMoves:eightMoves,moveLimitModifier:2
  });
  assert.equal(highPreview.moveLimit.effective,8);
  assert.equal(highPreview.selectedMoves.length,8);
  assert.equal(highPreview.valid,true);

  const ceruledge=definitions.getResolved({rulesetId:'all-provided-material',kind:'species',id:'ceruledge'});
  const incoming=definitions.getIncomingEvolution({speciesName:ceruledge.name,sourceId:ceruledge.sourceId});
  assert.equal(incoming.to_min_level,25);
  const ceruAlloc=autoBalancedAllocations({baseStats:ceruledge.baseStats,nature:'Hardy',level:1});
  const ceruPreview=buildPokemonPreview({species:ceruledge,level:1,nature:'Hardy',allocations:ceruAlloc,selectedAbilities:['Flash Fire'],incomingEvolution:incoming});
  assert.equal(ceruPreview.valid,true,'Evolution minimum must not block direct creation');
  assert.equal(ceruPreview.evolutionNotice.minimumLevel,25);
  assert.match(ceruPreview.evolutionNotice.message,/Direct creation below that Level is allowed/);
  assert.ok(ceruPreview.eligibleMoves.some(m=>m.isEvolution && m.name==='Shadow Claw'));
  assert.ok(!ceruPreview.defaultMoves.includes('shadow-claw'),'Evo move should not be auto-selected in direct creation');

  // Deliberately violate Base Relations: dump every point into Charmander Defense.
  const invalidAlloc={hp:0,attack:0,defense:15,special_attack:0,special_defense:0,speed:0};
  const invalid=buildPokemonPreview({species:charmander,level:5,nature:'Hardy',allocations:invalidAlloc,selectedAbilities:['Blaze']});
  assert.equal(invalid.baseRelations.valid,false);
  assert.equal(invalid.valid,false);
  const overridden=buildPokemonPreview({species:charmander,level:5,nature:'Hardy',allocations:invalidAlloc,selectedAbilities:['Blaze'],gmOverride:true});
  assert.equal(overridden.valid,true);
  assert.equal(overridden.baseRelations.overridden,true);

  // Persist a complete rules-backed Pokémon instance.
  loaded.pokemon.push({
    id:'verify-v05',name:'CoreBuild',species:charmander.name,level:5,types:['fire'],
    hp:preview.maxHp,maxHp:preview.maxHp,injuries:0,ball:'Poké Ball',heldItem:null,img:'creatures/default.svg',storage:false,loyalty:3,rosterIds:[],
    combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0},
    details:{speciesDefinitionId:charmander.id,speciesVersionId:charmander.versionId,speciesContentPackId:charmander.contentPackId,linkedRulesetId:'all-provided-material',nature:'Hardy',abilities:['Blaze'],baseStats:preview.baseStats,natureAdjustedBaseStats:preview.natureAdjustedBaseStats,statAllocations:preview.statAllocations,finalStats:preview.finalStats,tutorPointsEarned:preview.tutorPoints.earned,tutorPointsSpent:0,tutorPointsRemaining:preview.tutorPoints.remaining,moveLimitBase:6,moveLimitModifier:0,moveLimitEffective:6,moves:[],createdFromDefinition:true,buildEngineVersion:'0.5.0'}
  });
  campaign.saveState(loaded);
  loaded=campaign.loadState('alex');
  const linked=loaded.pokemon.find(p=>p.id==='verify-v05');
  assert.deepEqual(linked.details.finalStats,preview.finalStats);
  assert.equal(linked.maxHp,preview.maxHp);
  assert.equal(linked.details.tutorPointsEarned,2);

  const css=readFileSync(new URL('../static-preview/styles.css',import.meta.url),'utf8');
  const app=readFileSync(new URL('../static-preview/app.js',import.meta.url),'utf8');
  const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
  assert.match(app,/FUNCTIONAL v0\.5/);
  assert.match(app,/PTU STAT ALLOCATION/);
  assert.match(app,/Create Rules-Validated Pokémon/);
  assert.match(app,/direct creation/i);
  assert.match(css,/\.builder-stat-table/);
  assert.match(server,/\/api\/pokemon\/build-preview/);

  console.log('PTU Companion v0.5 verification: OK');
  console.log(`  campaign pokemon: ${loaded.pokemon.length}`);
  console.log(`  Charmander L5 stat budget: ${preview.statBudget.total}`);
  console.log(`  Charmander calculated Max HP: ${preview.maxHp}`);
  console.log(`  Tutor Points at L20: ${tutorPointsAtLevel(20)}`);
  console.log(`  Ability slots at L40: ${levelAbilitySlots(40).length}`);
  console.log(`  Ceruledge direct L1 creation: allowed (normal evolution minimum ${ceruPreview.evolutionNotice.minimumLevel})`);
  console.log('  Nature rules: passed');
  console.log('  Base Relations validation + GM override: passed');
  console.log('  SQLite v0.5 build metadata round-trip: passed');
} finally {
  definitions.close();
  campaignDb.close();
  rmSync(dir,{recursive:true,force:true});
}
