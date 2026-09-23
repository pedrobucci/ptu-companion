import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const appSource=await readFile(new URL('../www/app.js',import.meta.url),'utf8');

assert.match(appSource,/async function editRoster\(id=state\.selectedRosterId\)/,'Android must expose an editor for the selected Roster');
assert.match(appSource,/Roster identity and capacity can change without removing Pokémon memberships\./,'Android Roster editor must state its non-destructive membership behavior');
assert.match(appSource,/min:Math\.max\(1,memberCount\)/,'Android maximum-members input must respect the current membership count');
assert.match(appSource,/if\(max<memberCount\)return toast/,'Android must reject a Roster limit below its current membership count');
assert.match(appSource,/name:'status'.*Active — show on dashboard.*Hidden — keep roster, hide from dashboard/s,'Android must edit Roster dashboard visibility');
assert.match(appSource,/name:'color',label:'Roster color',type:'color'/,'Android must edit Roster color');
assert.match(appSource,/r\.name=name; r\.role=role; r\.maxMembers=max; r\.active=.*r\.color=color;/,'Android must update Roster metadata in place without rebuilding memberships');
assert.match(appSource,/✎ Edit Roster/,'Android Roster screen must expose Edit Roster');
assert.match(appSource,/chip\('HIDDEN','chip-neutral'\)/,'Android must identify hidden Rosters while keeping them manageable');
assert.match(appSource,/createRoster,editRoster[^}]*storePokemon/s,'Android Roster editor must remain exposed to inline UI actions even when later Roster handlers are added');

console.log('Stage A.6 Android Roster edit regression OK');
