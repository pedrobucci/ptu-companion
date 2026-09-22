import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../persistence/database.mjs';
import {CampaignRepository} from '../persistence/repository.mjs';

const temp=await mkdtemp(join(tmpdir(),'ptu-stage-a5-'));
const dbPath=join(temp,'campaign.sqlite3');
const db=openDatabase(dbPath);
try {
  const repo=new CampaignRepository(db);
  const seed=JSON.parse(await readFile(new URL('../seed/default-state.json',import.meta.url),'utf8'));
  const state=structuredClone(seed);
  state.activeProfileId='pokemon-notes-test';
  state.trainer.id='pokemon-notes-test';
  state.trainer.name='Pokémon Notes Test';
  const target=state.pokemon[0];
  target.details={...(target.details||{}),notes:'Likes thunderstorms.\nTraining goal: improve Focus.\nUnicode: ação, Pokémon, ★'};

  repo.saveState(state,{createRevision:true});
  let loaded=repo.loadState('pokemon-notes-test');
  let loadedPokemon=loaded.pokemon.find(p=>p.id===target.id);
  assert.equal(loadedPokemon.details.notes,target.details.notes,'Pokémon Notes must round-trip through SQLite details_json without losing line breaks or Unicode');
  const stored=JSON.parse(db.prepare('SELECT details_json FROM pokemon WHERE id=?').get(target.id).details_json);
  assert.equal(stored.notes,target.details.notes,'Pokémon Notes must be stored with the individual Pokémon, not at Trainer level');

  loadedPokemon.details.notes='Session 12\n- practiced stealth\n- distrusts elevators';
  repo.saveState(loaded,{createRevision:true});
  loaded=repo.loadState('pokemon-notes-test');
  loadedPokemon=loaded.pokemon.find(p=>p.id===target.id);
  assert.equal(loadedPokemon.details.notes,'Session 12\n- practiced stealth\n- distrusts elevators','editing Pokémon Notes must persist on later saves');

  loadedPokemon.details.notes='';
  repo.saveState(loaded,{createRevision:true});
  loaded=repo.loadState('pokemon-notes-test');
  assert.equal(loaded.pokemon.find(p=>p.id===target.id).details.notes,'','clearing Pokémon Notes must persist as an empty string');
} finally {
  db.close();
  await rm(temp,{recursive:true,force:true});
}

const appSource=await readFile(new URL('../static-preview/app.js',import.meta.url),'utf8');
assert.match(appSource,/const storedPokemonNotes=p\.details\.notes;/,'older/default Pokémon saves must normalize the Notes field');
assert.match(appSource,/Array\.isArray\(storedPokemonNotes\)/,'legacy array-shaped Pokémon Notes must remain readable');
assert.match(appSource,/async function editPokemonNotes\(id=state\.selectedPokemonId\)/,'Windows UI must expose an individual Pokémon Notes editor');
assert.match(appSource,/title:`Pokémon Notes · \$\{p\.name\}`/,'Pokémon Notes editor must identify the selected Pokémon');
assert.match(appSource,/type:'textarea',rows:10,value:current/,'Pokémon Notes editor must provide a multiline textarea');
assert.match(appSource,/section\('POKÉMON NOTES'/,'Pokémon Notes must be visible on the Creature Sheet');
assert.match(appSource,/esc\(pokemonNotes\)\.replace\(\/\\n\/g,'<br>'\)/,'rendered Pokémon Notes must be escaped and preserve line breaks');
assert.match(appSource,/p\.details\.notes=next;\s*persist\(\);\s*toast\(`\$\{p\.name\} notes updated\.`\);/,'editing Pokémon Notes must persist without triggering mechanical recalculation');
assert.match(appSource,/editPokemonIdentity,editPokemonNotes,changeHp/,'Pokémon Notes editor must be exposed to inline UI actions');

console.log('Stage A.5 Windows Pokémon Notes regression OK');
