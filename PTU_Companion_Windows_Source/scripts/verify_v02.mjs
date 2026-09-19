import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { openDatabase } from '../persistence/database.mjs';
import { CampaignRepository } from '../persistence/repository.mjs';

const root = new URL('..', import.meta.url);
const seed = JSON.parse(readFileSync(new URL('../seed/default-state.json', import.meta.url), 'utf8'));
seed.version = 2;
const dir = mkdtempSync(join(tmpdir(), 'ptu-v02-'));
const db = openDatabase(join(dir, 'verify.sqlite3'));
const repo = new CampaignRepository(db);

try {
  assert.equal(repo.hasProfiles(), false);
  repo.saveState(seed);
  assert.equal(repo.hasProfiles(), true);
  let loaded = repo.loadState('alex');
  assert.equal(loaded.trainer.name, 'Alex Rowan');
  assert.equal(loaded.pokemon.length, 8);
  assert.equal(loaded.rosters.length, 3);
  assert.deepEqual(loaded.pokemon.find(p=>p.id==='rocky').rosterIds.sort(), ['company','mounts','personal']);

  const gempy = loaded.pokemon.find(p=>p.id==='gempy');
  gempy.hp = 21;
  gempy.combatStages.attack = 3;
  loaded.trainer.money -= 300;
  loaded.inventory.find(i=>i.id==='potion').qty += 1;
  repo.saveState(loaded);

  loaded = repo.loadState('alex');
  assert.equal(loaded.pokemon.find(p=>p.id==='gempy').hp, 21);
  assert.equal(loaded.pokemon.find(p=>p.id==='gempy').combatStages.attack, 3);
  assert.equal(loaded.trainer.money, 12200);
  assert.equal(loaded.inventory.find(i=>i.id==='potion').qty, 25);
  assert.ok(repo.listRevisions('alex', 10).length >= 2);

  const css = readFileSync(new URL('../static-preview/styles.css', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../static-preview/app.js', import.meta.url), 'utf8');
  assert.match(css, /\.hp-actions\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(app, /class="hp-control"/);
  assert.match(app, /SQLite autosave/);

  console.log('PTU Companion v0.2 verification: OK');
  console.log(`  profiles: 1`);
  console.log(`  pokemon: ${loaded.pokemon.length}`);
  console.log(`  rosters: ${loaded.rosters.length}`);
  console.log(`  revisions: ${repo.listRevisions('alex', 30).length}`);
  console.log('  HP control: responsive layout present');
  console.log('  SQLite round-trip: passed');
} finally {
  db.close();
  rmSync(dir, {recursive:true, force:true});
}
