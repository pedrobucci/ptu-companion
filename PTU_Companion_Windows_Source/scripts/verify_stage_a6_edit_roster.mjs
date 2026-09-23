import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../persistence/database.mjs';
import {CampaignRepository} from '../persistence/repository.mjs';

const temp=await mkdtemp(join(tmpdir(),'ptu-stage-a6-'));
const dbPath=join(temp,'campaign.sqlite3');
const db=openDatabase(dbPath);
try {
  const repo=new CampaignRepository(db);
  const seed=JSON.parse(await readFile(new URL('../seed/default-state.json',import.meta.url),'utf8'));
  const state=structuredClone(seed);
  state.activeProfileId='roster-edit-test';
  state.trainer.id='roster-edit-test';
  state.trainer.name='Roster Edit Test';
  const target=state.rosters.find(r=>r.id==='personal');
  assert.ok(target,'default state must contain the Personal Team roster');
  const membersBefore=state.pokemon.filter(p=>(p.rosterIds||[]).includes(target.id)).map(p=>p.id).sort();
  assert.ok(membersBefore.length>0,'fixture must have roster members so membership preservation is meaningful');

  target.name='Investigation Team';
  target.role='INVESTIGATION';
  target.maxMembers=Math.max(8,membersBefore.length);
  target.active=false;
  target.color='#704170';
  repo.saveState(state,{createRevision:true});

  const loaded=repo.loadState('roster-edit-test');
  const saved=loaded.rosters.find(r=>r.id==='personal');
  assert.deepEqual(saved,{id:'personal',name:'Investigation Team',role:'INVESTIGATION',maxMembers:Math.max(8,membersBefore.length),active:false,color:'#704170'},'edited Roster fields must round-trip through SQLite');
  const membersAfter=loaded.pokemon.filter(p=>(p.rosterIds||[]).includes('personal')).map(p=>p.id).sort();
  assert.deepEqual(membersAfter,membersBefore,'editing Roster metadata must not remove or rewrite Pokémon memberships');
  const row=db.prepare("SELECT name,role,max_members,active,color FROM rosters WHERE id='personal' AND trainer_id='roster-edit-test'").get();
  assert.deepEqual({...row},{name:'Investigation Team',role:'INVESTIGATION',max_members:Math.max(8,membersBefore.length),active:0,color:'#704170'},'Roster edit values must be stored in normalized roster columns');
} finally {
  db.close();
  await rm(temp,{recursive:true,force:true});
}

const appSource=await readFile(new URL('../static-preview/app.js',import.meta.url),'utf8');
assert.match(appSource,/async function editRoster\(id=state\.selectedRosterId\)/,'Windows must expose an editor for the selected Roster');
assert.match(appSource,/Roster identity and capacity can change without removing Pokémon memberships\./,'Roster edit modal must state its non-destructive membership behavior');
assert.match(appSource,/min:Math\.max\(1,memberCount\)/,'maximum-members input must not encourage a limit below the current membership count');
assert.match(appSource,/if\(max<memberCount\)return toast/,'Roster edit must reject capacity below the current membership count');
assert.match(appSource,/name:'status'.*Active — show on dashboard.*Hidden — keep roster, hide from dashboard/s,'Roster active/hidden state must be editable');
assert.match(appSource,/name:'color',label:'Roster color',type:'color'/,'Roster color must be editable');
assert.match(appSource,/r\.name=name; r\.role=role; r\.maxMembers=max; r\.active=.*r\.color=color;/,'editing must update only Roster metadata in place');
assert.match(appSource,/✎ Edit Roster/,'Roster screen must expose an Edit Roster action');
assert.match(appSource,/chip\('HIDDEN','chip-neutral'\)/,'hidden Rosters must remain visible and identifiable in the Roster manager');
assert.match(appSource,/createRoster,editRoster[^}]*storePokemon/s,'Roster editor must remain exposed to inline UI actions even when later Roster handlers are added');

console.log('Stage A.6 Windows Roster edit regression OK');
