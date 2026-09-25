import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const windowsSource=await readFile(new URL('../static-preview/app.js',import.meta.url),'utf8');
const androidSource=await readFile(new URL('../../PTU_Companion_Android_Tauri/www/app.js',import.meta.url),'utf8');
const catalog=JSON.parse(await readFile(new URL('../rules/move-keywords-core-1.05.json',import.meta.url),'utf8'));

const expected=[
  'Aura','Berry','Blessing','Coat','Dash','Double Strike','Environ','Execute','Exhaust','Fling','Friendly',
  'Five Strike','Groundsource','Hazard','Illusion','Interrupt','Pass','Pledge','Powder','Priority','Push',
  'Reaction','Recoil','Set-Up','Shield','Smite','Social','Sonic','Spirit Surge','Trigger','Vortex','Weather','Weight Class'
];
assert.equal(catalog.length,33,'PTU Core 1.05 must provide exactly 33 Move Keywords before Range Keywords');
assert.deepEqual(catalog.map(entry=>entry.name),expected,'Move Keyword source JSON must preserve PTU Core 1.05 book order');
const byName=new Map(catalog.map(entry=>[entry.name,entry]));
assert.match(byName.get('Execute').effect,/20%/,'Execute must expose its 20% HP threshold');
assert.match(byName.get('Exhaust').effect,/once per Scene/,'Exhaust must expose its Scene limit');
assert.match(byName.get('Five Strike').effect,/1d8\+1/,'Five Strike must expose its source roll');
assert.match(byName.get('Pledge').effect,/4 rounds/,'Pledge must expose its four-round lockout');
assert.match(byName.get('Recoil').effect,/one-third/,'Recoil must expose its one-third damage rule');
assert.match(byName.get('Weight Class').effect,/over 440 lb/,'Weight Class must include the upper WC 6 boundary');
assert.ok(!byName.has('Burst'),'Range Keywords must not be mixed into the Move Keyword catalog');

function catalogBlock(source){
  const match=source.match(/\/\* STAGE_A9_MOVE_KEYWORD_CATALOG_START \*\/([\s\S]*?)\/\* STAGE_A9_MOVE_KEYWORD_CATALOG_END \*\//);
  assert.ok(match,'Move Keyword catalog marker block must exist');
  return match[1];
}
const block=catalogBlock(windowsSource);
const androidBlock=catalogBlock(androidSource);
assert.equal(androidBlock,block,'Windows and Android must share the same generated Move Keyword reference');
for(const name of ['Aura','Interrupt','Priority','Shield','Weight Class'])assert.match(block,new RegExp(`"name":"${name.replace(' ','\\s?')}"`),`Runtime catalog must embed ${name}`);

assert.match(windowsSource,/\['move_keywords','Move Keywords'\]/,'Library must expose Move Keywords as a category');
assert.match(windowsSource,/catalogState\.kind==='move_keywords'/,'Library must resolve Move Keywords locally without a definition DB migration');
assert.match(windowsSource,/kind==='move_keywords'\?MOVE_KEYWORD_CATALOG\.length/,'Library count must report built-in keyword count');
assert.match(windowsSource,/moveKeywordReferenceHtml\(def\|\|m\)/,'Creature Move cards must expose detected keyword references');
assert.match(windowsSource,/function openMoveKeywordInfo\(id\)/,'Keyword descriptions must open in the standard modal flow');
assert.match(windowsSource,/Object\.assign\(window,\{[^}]*openMoveKeywordInfo[^}]*route/s,'Inline keyword buttons must keep an exposed handler when later stages add more handlers');

console.log('Stage A.9 Windows Move Keyword regression OK');
