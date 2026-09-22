import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const appSource=await readFile(new URL('../www/app.js',import.meta.url),'utf8');

assert.match(appSource,/async function deleteTrainerProfile\(\)/,'Android UI must expose Trainer deletion');
assert.match(appSource,/styledConfirm\(\{title:'Delete Trainer'/,'Android Trainer deletion must use the standard app modal');
assert.match(appSource,/Delete Trainer<\/button>/,'Trainer sheet must expose Delete Trainer');
assert.match(appSource,/Delete Active Trainer/,'Trainer switcher must expose deletion');
assert.match(appSource,/blankTrainerStateClient\('New Trainer','Trainer'\)/,'Android/browser fallback must create a fresh blank Trainer after deleting the current Trainer');
assert.match(appSource,/Content Packs and global settings are preserved/,'confirmation must explain that shared/global data is preserved');
assert.match(appSource,/createTrainerProfile,deleteTrainerProfile,resetTrainerSheet/,'delete handler must be exposed to inline UI actions');
assert.doesNotMatch(appSource,/window\.confirm\s*\(/,'native browser confirm must not be used');

console.log('Stage A.3 Android Trainer deletion regression OK');
