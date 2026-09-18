import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { openDatabase } from '../persistence/database.mjs';
import { CampaignRepository } from '../persistence/repository.mjs';
import { DefinitionRepository } from '../definitions/repository.mjs';

const seed = JSON.parse(readFileSync(new URL('../seed/default-state.json', import.meta.url), 'utf8'));
seed.version = 2;
const dir = mkdtempSync(join(tmpdir(), 'ptu-v03-'));
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

  const gempy = loaded.pokemon.find(p=>p.id==='gempy');
  gempy.hp = 21;
  gempy.combatStages.attack = 3;
  campaign.saveState(loaded);
  loaded = campaign.loadState('alex');
  assert.equal(loaded.pokemon.find(p=>p.id==='gempy').hp, 21);
  assert.equal(loaded.pokemon.find(p=>p.id==='gempy').combatStages.attack, 3);

  const rulesets=definitions.getRulesets();
  assert.ok(rulesets.length >= 4);
  assert.ok(rulesets.some(r=>r.id==='all-provided-material'));
  assert.ok(rulesets.some(r=>r.id==='ptu-core-only'));
  const allCounts=definitions.getCounts('all-provided-material');
  assert.ok(allCounts.species >= 1000);
  assert.ok(allCounts.moves >= 700);
  assert.ok(allCounts.abilities >= 450);
  const coreCounts=definitions.getCounts('ptu-core-only');
  assert.ok(coreCounts.moves >= 600);
  assert.ok(coreCounts.abilities >= 300);

  const shadowClaw=definitions.getResolved({rulesetId:'all-provided-material',kind:'moves',id:'shadow-claw'});
  assert.equal(shadowClaw.name,'Shadow Claw');
  assert.equal(shadowClaw.damageBase,7);
  assert.equal(shadowClaw.ac,2);
  assert.equal(shadowClaw.contentPackId,'ptu-core-1.05');

  const abomasnow=definitions.listResolved({rulesetId:'all-provided-material',kind:'species',q:'Abomasnow',limit:10});
  assert.ok(abomasnow.some(x=>x.id==='abomasnow'));
  assert.ok(abomasnow.find(x=>x.id==='abomasnow').types.includes('Grass'));

  const css = readFileSync(new URL('../static-preview/styles.css', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../static-preview/app.js', import.meta.url), 'utf8');
  assert.match(css, /\.storage-layout\{grid-template-columns:minmax\(0,1fr\) 104px minmax\(0,1fr\)!important\}/);
  assert.match(css, /\.storage-grid\{grid-template-columns:repeat\(auto-fill,minmax\(112px,1fr\)\)!important/);
  assert.match(app, /Pokédex & Rules Library/);
  assert.match(app, /\/api\/definitions/);
  assert.match(app, /FUNCTIONAL v0\.3/);

  console.log('PTU Companion v0.3 verification: OK');
  console.log(`  campaign pokemon: ${loaded.pokemon.length}`);
  console.log(`  campaign rosters: ${loaded.rosters.length}`);
  console.log(`  definition rulesets: ${rulesets.length}`);
  console.log(`  all-material species: ${allCounts.species}`);
  console.log(`  all-material moves: ${allCounts.moves}`);
  console.log(`  all-material abilities: ${allCounts.abilities}`);
  console.log('  ruleset resolver: passed');
  console.log('  real definition query: passed');
  console.log('  storage responsive grid: present');
} finally {
  definitions.close();
  campaignDb.close();
  rmSync(dir, {recursive:true, force:true});
}
