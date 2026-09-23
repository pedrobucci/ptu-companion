import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const appSource=await readFile(new URL('../www/app.js',import.meta.url),'utf8');
assert.match(appSource,/async function deleteRoster\(id=state\.selectedRosterId\)/,'Android must expose Roster deletion');
assert.match(appSource,/Deleting a Roster does not delete any Pokémon/,'Android confirmation must explain non-destructive Pokémon behavior');
assert.match(appSource,/state\.rosters\.length<=1/,'Android must guard deletion of the final Roster');
assert.match(appSource,/state\.rosters=state\.rosters\.filter\(x=>x\.id!==r\.id\)/,'Android must remove only the selected Roster object');
assert.match(appSource,/p\.rosterIds=\(p\.rosterIds\|\|\[\]\)\.filter\(rid=>rid!==r\.id\)/,'Android must remove only membership in the deleted Roster');
assert.match(appSource,/state\.selectedRosterId=state\.rosters\[0\]\?\.id\|\|null/,'Android must select a surviving Roster after deletion');
assert.match(appSource,/🗑 Delete Roster/,'Android Roster screen must expose a Delete Roster action');
assert.match(appSource,/createRoster,editRoster,deleteRoster,storePokemon/,'Android Roster deletion must be exposed to inline UI actions');

console.log('Stage A.7 Android Roster deletion regression OK');
