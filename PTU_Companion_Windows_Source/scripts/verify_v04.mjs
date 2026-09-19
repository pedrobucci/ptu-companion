import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { openDatabase } from '../persistence/database.mjs';
import { CampaignRepository } from '../persistence/repository.mjs';
import { DefinitionRepository } from '../definitions/repository.mjs';

const seed = JSON.parse(readFileSync(new URL('../seed/default-state.json', import.meta.url), 'utf8'));
seed.version = 2;
const dir = mkdtempSync(join(tmpdir(), 'ptu-v04-'));
const campaignDb = openDatabase(join(dir, 'campaign.sqlite3'));
const campaign = new CampaignRepository(campaignDb);
const definitionsPath = new URL('../seed/definitions/ptu_seed_v1.0.sqlite3', import.meta.url);
const definitions = new DefinitionRepository(definitionsPath.pathname);

try {
  campaign.saveState(seed);
  let loaded = campaign.loadState('alex');
  assert.equal(loaded.pokemon.length, 8);
  assert.equal(loaded.rosters.length, 3);
  assert.deepEqual(loaded.pokemon.find(p=>p.id==='rocky').rosterIds.sort(), ['company','mounts','personal']);

  const rulesets=definitions.getRulesets();
  assert.ok(rulesets.length >= 4);
  const allCounts=definitions.getCounts('all-provided-material');
  assert.ok(allCounts.species >= 1000);
  assert.ok(allCounts.moves >= 700);
  assert.ok(allCounts.abilities >= 450);

  const sableyeRows=definitions.listResolved({rulesetId:'all-provided-material',kind:'species',q:'Sableye',limit:10});
  assert.ok(sableyeRows.length > 0, 'Expected Sableye in real Species catalog');
  const sableye=definitions.getResolved({rulesetId:'all-provided-material',kind:'species',id:sableyeRows[0].id});
  assert.ok(sableye?.name, 'Expected resolved Species detail');

  // v0.4 persistence must preserve definition linkage and individual creation metadata.
  loaded.pokemon.push({
    id:'verify-linked', name:'Verifier', species:sableye.name, level:12,
    types:(sableye.types||[]).map(x=>String(x).toLowerCase()), hp:40, maxHp:40,
    injuries:0, ball:'Poké Ball', heldItem:null, img:'creatures/default.svg', storage:false,
    loyalty:3, rosterIds:[], combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0},
    details:{speciesDefinitionId:sableye.id,speciesVersionId:sableye.versionId,speciesContentPackId:sableye.contentPackId,linkedRulesetId:'all-provided-material',nature:'Careful',ability:'',baseStats:sableye.baseStats||null,createdFromDefinition:true}
  });
  campaign.saveState(loaded);
  loaded=campaign.loadState('alex');
  const linked=loaded.pokemon.find(p=>p.id==='verify-linked');
  assert.equal(linked.details.speciesDefinitionId,sableye.id);
  assert.equal(linked.details.nature,'Careful');

  const cols=campaignDb.prepare('PRAGMA table_info(pokemon)').all().map(x=>x.name);
  assert.ok(cols.includes('details_json'), 'pokemon.details_json migration is required');

  const css = readFileSync(new URL('../static-preview/styles.css', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../static-preview/app.js', import.meta.url), 'utf8');
  assert.match(css, /\.storage-layout\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.doesNotMatch(css, /104px minmax\(0,1fr\)/);
  assert.match(app, /id="definition-search-input"/);
  assert.match(app, /preserveSearchFocus:true/);
  assert.match(app, /querySnapshot!==catalogState\.query/);
  assert.match(app, /function pokemonBuilderScreen\(\)/);
  assert.match(app, /function createPokemonFromBuilder\(\)/);
  assert.match(app, /details:\{speciesDefinitionId:/);
  assert.match(app, /FUNCTIONAL v0\.4/);

  console.log('PTU Companion v0.4 verification: OK');
  console.log(`  campaign pokemon: ${loaded.pokemon.length}`);
  console.log(`  definition rulesets: ${rulesets.length}`);
  console.log(`  all-material species: ${allCounts.species}`);
  console.log('  storage two-pane grid: passed');
  console.log('  definition search focus/debounce guard: passed');
  console.log('  Species-linked Pokémon creation metadata: passed');
  console.log('  SQLite details_json migration/round-trip: passed');
} finally {
  definitions.close();
  campaignDb.close();
  rmSync(dir, {recursive:true, force:true});
}
