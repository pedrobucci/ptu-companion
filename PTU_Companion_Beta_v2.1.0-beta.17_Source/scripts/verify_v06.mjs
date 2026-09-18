import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { openDatabase } from '../persistence/database.mjs';
import { CampaignRepository } from '../persistence/repository.mjs';
import { DefinitionRepository } from '../definitions/repository.mjs';
import { applyNature, autoBalancedAllocations, buildPokemonPreview, HP_IGNORES_BASE_RELATIONS } from '../rules/pokemon-engine.mjs';

const seed=JSON.parse(readFileSync(new URL('../seed/default-state.json',import.meta.url),'utf8')); seed.version=2;
const dir=mkdtempSync(join(tmpdir(),'ptu-v06-'));
const campaignDb=openDatabase(join(dir,'campaign.sqlite3'));
const campaign=new CampaignRepository(campaignDb);
const definitions=new DefinitionRepository(new URL('../seed/definitions/ptu_seed_v1.0.sqlite3',import.meta.url).pathname);

try{
  campaign.saveState(seed);
  const rs='all-provided-material';
  const charmander=definitions.getResolved({rulesetId:rs,kind:'species',id:'charmander'});
  assert.ok(charmander?.baseStats);

  // Campaign rule requested for the app: HP is not constrained by Base Relations.
  assert.equal(HP_IGNORES_BASE_RELATIONS,true);
  const hpHeavy={hp:15,attack:0,defense:0,special_attack:0,special_defense:0,speed:0};
  const hpPreview=buildPokemonPreview({species:charmander,level:5,nature:'Hardy',allocations:hpHeavy,selectedAbilities:['Blaze']});
  assert.equal(hpPreview.baseRelations.valid,true,'HP-only relation changes must not invalidate the build');
  assert.equal(hpPreview.baseRelations.hpExempt,true);

  // Non-HP Base Relations remain enforced.
  const illegalNonHp={hp:0,attack:0,defense:15,special_attack:0,special_defense:0,speed:0};
  const illegal=buildPokemonPreview({species:charmander,level:5,nature:'Hardy',allocations:illegalNonHp,selectedAbilities:['Blaze']});
  assert.equal(illegal.baseRelations.valid,false);
  assert.equal(illegal.valid,false);

  // Pre-evolution history is resolved for evolved forms.
  const ceruledge=definitions.getResolved({rulesetId:rs,kind:'species',id:'ceruledge'});
  const incoming=definitions.getIncomingEvolution({speciesName:ceruledge.name,sourceId:ceruledge.sourceId});
  const ancestry=definitions.getEvolutionAncestry({rulesetId:rs,speciesName:ceruledge.name,sourceId:ceruledge.sourceId});
  assert.ok(ancestry.some(a=>a.name==='Charcadet'));
  const ceruAlloc=autoBalancedAllocations({baseStats:ceruledge.baseStats,nature:'Hardy',level:1});
  const ceru=buildPokemonPreview({species:ceruledge,level:1,nature:'Hardy',allocations:ceruAlloc,selectedAbilities:['Flash Fire'],incomingEvolution:incoming,preEvolutionSpecies:ancestry});
  const ember=ceru.eligibleMoves.find(m=>m.name==='Ember' && m.sourceKind==='pre_evolution');
  assert.ok(ember,'Ceruledge must be able to select a Charcadet natural Move during creation');
  assert.equal(ember.sourceSpeciesName,'Charcadet');

  // GM Override can inject any Move resolved from the active ruleset.
  const shadowBall=definitions.getResolved({rulesetId:rs,kind:'moves',id:'shadow-ball'});
  assert.ok(shadowBall);
  const normalAlloc=autoBalancedAllocations({baseStats:charmander.baseStats,nature:'Hardy',level:5});
  const gmMove={key:'gm:shadow-ball',id:'shadow-ball',name:shadowBall.name,type:shadowBall.type};
  const gmPreview=buildPokemonPreview({species:charmander,level:5,nature:'Hardy',allocations:normalAlloc,selectedAbilities:['Blaze'],selectedMoves:['gm:shadow-ball'],gmMoves:[gmMove],gmOverride:true});
  assert.equal(gmPreview.valid,true);
  assert.ok(gmPreview.eligibleMoves.some(m=>m.key==='gm:shadow-ball' && m.sourceKind==='gm_override'));

  // Persist source metadata for a pre-evolution Move.
  let loaded=campaign.loadState('alex');
  loaded.pokemon.push({id:'verify-v06',name:'HistoryCeruledge',species:'Ceruledge',level:1,types:['fire'],hp:20,maxHp:20,injuries:0,ball:'Poké Ball',heldItem:null,img:'creatures/default.svg',storage:false,loyalty:3,rosterIds:[],combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0},details:{speciesDefinitionId:'ceruledge',moves:[{key:ember.key,id:ember.id,name:ember.name,source:'pre_evolution',sourceSpeciesName:'Charcadet'}],hpBaseRelationsExempt:true,buildEngineVersion:'0.6.0'}});
  campaign.saveState(loaded); loaded=campaign.loadState('alex');
  assert.equal(loaded.pokemon.find(p=>p.id==='verify-v06').details.moves[0].sourceSpeciesName,'Charcadet');

  // UI source checks for non-jumping rerenders and new move controls.
  const app=readFileSync(new URL('../static-preview/app.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../static-preview/styles.css',import.meta.url),'utf8');
  const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
  assert.match(app,/FUNCTIONAL v0\.6/);
  assert.match(app,/lastRenderedScreen/);
  assert.match(app,/scrollTop=scroll\.top/);
  assert.match(app,/BASE RELATIONS · HP EXEMPT/);
  assert.match(app,/GM Move Override/);
  assert.match(app,/PRE-EVO/);
  assert.match(css,/\.gm-move-builder/);
  assert.match(server,/getEvolutionAncestry/);

  console.log('PTU Companion v0.6 verification: OK');
  console.log('  scroll-preserving rerender: present');
  console.log('  HP Base Relations exemption: passed');
  console.log(`  Ceruledge ancestry: ${ancestry.map(a=>a.name).join(' <- ')}`);
  console.log('  pre-evolution Move selection: passed');
  console.log('  arbitrary GM Move override: passed');
  console.log('  SQLite move-source metadata round-trip: passed');
} finally {
  definitions.close(); campaignDb.close(); rmSync(dir,{recursive:true,force:true});
}
