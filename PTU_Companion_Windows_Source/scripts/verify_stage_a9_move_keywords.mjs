import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const windowsSource=await readFile(new URL('../static-preview/app.js',import.meta.url),'utf8');
const androidSource=await readFile(new URL('../../PTU_Companion_Android_Tauri/www/app.js',import.meta.url),'utf8');

function catalogBlock(source){
  const match=source.match(/\/\* STAGE_A9_MOVE_KEYWORD_CATALOG_START \*\/([\s\S]*?)\/\* STAGE_A9_MOVE_KEYWORD_CATALOG_END \*\//);
  assert.ok(match,'Move Keyword catalog marker block must exist');
  return match[1];
}

const block=catalogBlock(windowsSource);
const androidBlock=catalogBlock(androidSource);
assert.equal(androidBlock,block,'Windows and Android must share the same built-in Move Keyword reference');

const names=[...block.matchAll(/\{id:'[^']+',name:'([^']+)'/g)].map(match=>match[1]);
const expected=[
  'Aura','Berry','Blessing','Coat','Dash','Double Strike','Environ','Execute','Exhaust','Fling','Friendly',
  'Five Strike','Groundsource','Hazard','Illusion','Interrupt','Pass','Pledge','Powder','Priority','Push',
  'Reaction','Recoil','Set-Up','Shield','Smite','Social','Sonic','Spirit Surge','Trigger','Vortex','Weather','Weight Class'
];
assert.deepEqual(names,expected,'PTU Core 1.05 Move Keyword catalog must contain exactly the 33 source keywords in book order');

assert.match(block,/Execute[^\n]+20%/,'Execute must expose its 20% HP threshold');
assert.match(block,/Exhaust[^\n]+once per Scene/,'Exhaust must expose its Scene limit');
assert.match(block,/Five Strike[^\n]+1d8\+1/,'Five Strike must expose its source roll');
assert.match(block,/Pledge[^\n]+4 rounds/,'Pledge must expose its four-round lockout');
assert.match(block,/Recoil[^\n]+one-third/,'Recoil must expose its one-third damage rule');
assert.match(block,/Weight Class[^\n]+over 440 lb/,'Weight Class must include the upper WC 6 boundary');
assert.doesNotMatch(block,/name:'Burst'/,'Range Keywords must not be mixed into the Move Keyword catalog');

assert.match(windowsSource,/\['move_keywords','Move Keywords'\]/,'Library must expose Move Keywords as a category');
assert.match(windowsSource,/catalogState\.kind==='move_keywords'/,'Library must resolve Move Keywords locally without a definition DB migration');
assert.match(windowsSource,/kind==='move_keywords'\?MOVE_KEYWORD_CATALOG\.length/,'Library count must report built-in keyword count');
assert.match(windowsSource,/moveKeywordReferenceHtml\(def\|\|payload\|\|mv\)/,'Creature Move cards must expose detected keyword references');
assert.match(windowsSource,/function openMoveKeywordInfo\(id\)/,'Keyword descriptions must open in the standard modal flow');
assert.match(windowsSource,/Object\.assign\(window,\{openMoveKeywordInfo,route/,'Inline keyword buttons must have an exposed handler');

console.log('Stage A.9 Windows Move Keyword regression OK');
