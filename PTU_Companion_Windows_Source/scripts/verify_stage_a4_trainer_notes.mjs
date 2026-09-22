import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../persistence/database.mjs';
import {CampaignRepository} from '../persistence/repository.mjs';

const temp=await mkdtemp(join(tmpdir(),'ptu-stage-a4-'));
const dbPath=join(temp,'campaign.sqlite3');
const db=openDatabase(dbPath);
try {
  const repo=new CampaignRepository(db);
  const seed=JSON.parse(await readFile(new URL('../seed/default-state.json',import.meta.url),'utf8'));
  const state=structuredClone(seed);
  state.activeProfileId='trainer-notes-test';
  state.trainer.id='trainer-notes-test';
  state.trainer.name='Trainer Notes Test';
  const firstNotes='Investigate the old radio tower.\nAsk Marlowe about the sealed Poké Ball.\nUnicode: ação, Pokémon, ★';
  state.trainer.details={...(state.trainer.details||{}),notes:firstNotes};

  repo.saveState(state,{createRevision:true});
  let loaded=repo.loadState('trainer-notes-test');
  assert.equal(loaded.trainer.details.notes,firstNotes,'Trainer Notes must round-trip through SQLite details_json without losing line breaks or Unicode');
  const stored=JSON.parse(db.prepare("SELECT details_json FROM trainers WHERE id='trainer-notes-test'").get().details_json);
  assert.equal(stored.notes,firstNotes,'Trainer Notes must be stored in the selected Trainer profile details');

  const editedNotes='Session 12\n- Follow the ghost trail\n- Buy two Potions';
  loaded.trainer.details.notes=editedNotes;
  repo.saveState(loaded,{createRevision:true});
  loaded=repo.loadState('trainer-notes-test');
  assert.equal(loaded.trainer.details.notes,editedNotes,'editing Trainer Notes must persist on later saves');

  loaded.trainer.details.notes='';
  repo.saveState(loaded,{createRevision:true});
  assert.equal(repo.loadState('trainer-notes-test').trainer.details.notes,'','clearing Trainer Notes must persist as an empty string');
} finally {
  db.close();
  await rm(temp,{recursive:true,force:true});
}

const appSource=await readFile(new URL('../static-preview/app.js',import.meta.url),'utf8');
assert.match(appSource,/const storedNotes=t\.details\.notes;/,'legacy/default Trainer states must normalize the Notes field');
assert.match(appSource,/Array\.isArray\(storedNotes\)/,'legacy array-shaped Notes must remain readable');
assert.match(appSource,/async function editTrainerNotes\(\)/,'Windows UI must expose a Trainer Notes editor');
assert.match(appSource,/type:'textarea',rows:10,value:td\.notes/,'Trainer Notes editor must provide a multiline textarea');
assert.match(appSource,/section\('TRAINER NOTES'/,'Trainer Notes must be visible on the Trainer Profile tab');
assert.match(appSource,/esc\(td\.notes\)\.replace\(\/\\n\/g,'<br>'\)/,'rendered Trainer Notes must be escaped and preserve line breaks');
assert.match(appSource,/persist\(\);\s*toast\('Trainer notes updated\.'\)/,'editing Notes must persist without invoking mechanical recalculation');
assert.match(appSource,/editTrainer,editTrainerNotes,editTrainerExperience/,'Trainer Notes editor must be exposed to inline UI actions');

console.log('Stage A.4 Windows Trainer Notes regression OK');
