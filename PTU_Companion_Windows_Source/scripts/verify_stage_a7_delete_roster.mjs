import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../persistence/database.mjs';
import {CampaignRepository} from '../persistence/repository.mjs';

const temp=await mkdtemp(join(tmpdir(),'ptu-stage-a7-'));
const dbPath=join(temp,'campaign.sqlite3');
const db=openDatabase(dbPath);
try {
  const repo=new CampaignRepository(db);
  const seed=JSON.parse(await readFile(new URL('../seed/default-state.json',import.meta.url),'utf8'));
  const state=structuredClone(seed);
  state.activeProfileId='roster-delete-test';
  state.trainer.id='roster-delete-test';
  state.trainer.name='Roster Delete Test';

  const targetId='personal';
  const pokemonIdsBefore=state.pokemon.map(p=>p.id).sort();
  const targetMembers=state.pokemon.filter(p=>(p.rosterIds||[]).includes(targetId)).map(p=>p.id).sort();
  assert.ok(targetMembers.length>0,'fixture must have Pokémon in the deleted Roster');
  const preservedMemberships=new Map(state.pokemon.map(p=>[p.id,(p.rosterIds||[]).filter(id=>id!==targetId).sort()]));

  state.rosters=state.rosters.filter(r=>r.id!==targetId);
  for(const p of state.pokemon)p.rosterIds=(p.rosterIds||[]).filter(id=>id!==targetId);
  state.selectedRosterId=state.rosters[0]?.id||null;
  repo.saveState(state,{createRevision:true});

  const loaded=repo.loadState('roster-delete-test');
  assert.equal(loaded.rosters.some(r=>r.id===targetId),false,'deleted Roster must not round-trip through SQLite');
  assert.deepEqual(loaded.pokemon.map(p=>p.id).sort(),pokemonIdsBefore,'deleting a Roster must not delete Pokémon');
  for(const p of loaded.pokemon){
    assert.equal((p.rosterIds||[]).includes(targetId),false,`Pokémon ${p.id} must no longer reference the deleted Roster`);
    assert.deepEqual([...(p.rosterIds||[])].sort(),preservedMemberships.get(p.id),`Pokémon ${p.id} must preserve memberships in other Rosters`);
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM rosters WHERE id=? AND trainer_id=?").get(targetId,'roster-delete-test').n,0,'deleted Roster row must be removed');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM pokemon_rosters WHERE roster_id=?").get(targetId).n,0,'deleted Roster membership rows must be removed');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM pokemon WHERE trainer_id=?").get('roster-delete-test').n,pokemonIdsBefore.length,'Pokémon rows must remain after Roster deletion');
} finally {
  db.close();
  await rm(temp,{recursive:true,force:true});
}

const appSource=await readFile(new URL('../static-preview/app.js',import.meta.url),'utf8');
assert.match(appSource,/async function deleteRoster\(id=state\.selectedRosterId\)/,'Windows must expose Roster deletion');
assert.match(appSource,/Deleting a Roster does not delete any Pokémon/,'confirmation must explain non-destructive Pokémon behavior');
assert.match(appSource,/state\.rosters\.length<=1/,'deleting the final Roster must be guarded to keep the Roster screen valid');
assert.match(appSource,/state\.rosters=state\.rosters\.filter\(x=>x\.id!==r\.id\)/,'Roster deletion must remove only the selected Roster object');
assert.match(appSource,/p\.rosterIds=\(p\.rosterIds\|\|\[\]\)\.filter\(rid=>rid!==r\.id\)/,'Roster deletion must detach membership without deleting Pokémon');
assert.match(appSource,/state\.selectedRosterId=state\.rosters\[0\]\?\.id\|\|null/,'deleting the selected Roster must move selection to a surviving Roster');
assert.match(appSource,/🗑 Delete Roster/,'Roster screen must expose a Delete Roster action');
assert.match(appSource,/createRoster,editRoster,deleteRoster,storePokemon/,'Roster deletion must be exposed to inline UI actions');

console.log('Stage A.7 Windows Roster deletion regression OK');
