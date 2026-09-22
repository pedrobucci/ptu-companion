import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const appSource=await readFile(new URL('../www/app.js',import.meta.url),'utf8');

assert.match(appSource,/const storedNotes=t\.details\.notes;/,'Android must normalize the Trainer Notes field on older/default saves');
assert.match(appSource,/Array\.isArray\(storedNotes\)/,'Android must remain compatible with legacy array-shaped Trainer Notes');
assert.match(appSource,/async function editTrainerNotes\(\)/,'Android UI must expose a Trainer Notes editor');
assert.match(appSource,/type:'textarea',rows:10,value:td\.notes/,'Android Trainer Notes editor must be multiline');
assert.match(appSource,/section\('TRAINER NOTES'/,'Trainer Notes must appear on the Android Trainer Profile tab');
assert.match(appSource,/esc\(td\.notes\)\.replace\(\/\\n\/g,'<br>'\)/,'Android must escape Trainer Notes while preserving line breaks');
assert.match(appSource,/persist\(\);\s*toast\('Trainer notes updated\.'\)/,'Android Notes edits must use normal profile persistence without mechanical recalculation');
assert.match(appSource,/editTrainer,editTrainerNotes,editTrainerExperience/,'Android Trainer Notes editor must be exposed to inline UI actions');

console.log('Stage A.4 Android Trainer Notes regression OK');
