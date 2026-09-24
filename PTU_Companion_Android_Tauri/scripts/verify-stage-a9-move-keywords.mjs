import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const appSource=await readFile(new URL('../www/app.js',import.meta.url),'utf8');
const catalog=JSON.parse(await readFile(new URL('../../PTU_Companion_Windows_Source/rules/move-keywords-core-1.05.json',import.meta.url),'utf8'));
assert.equal(catalog.length,33,'Android must expose all 33 PTU Core 1.05 Move Keywords');
assert.deepEqual(catalog.slice(0,5).map(entry=>entry.name),['Aura','Berry','Blessing','Coat','Dash']);
assert.deepEqual(catalog.slice(-5).map(entry=>entry.name),['Spirit Surge','Trigger','Vortex','Weather','Weight Class']);
const byName=new Map(catalog.map(entry=>[entry.name,entry]));
assert.match(byName.get('Friendly').effect,/cannot miss/,'Friendly description must preserve the source no-miss behavior');
assert.match(byName.get('Priority').effect,/Priority \(Advanced\)/,'Priority must distinguish Advanced in its description');
assert.match(byName.get('Shield').effect,/forfeits the user’s Standard Action on the next turn/,'Shield must expose its next-turn action cost');
assert.match(byName.get('Sonic').effect,/Deafened/,'Sonic must expose Deafened immunity');
assert.ok(!byName.has('Burst'),'Range Keywords are outside Stage A.9 scope');

const match=appSource.match(/\/\* STAGE_A9_MOVE_KEYWORD_CATALOG_START \*\/([\s\S]*?)\/\* STAGE_A9_MOVE_KEYWORD_CATALOG_END \*\//);
assert.ok(match,'Android must contain the generated built-in Move Keyword catalog');
const block=match[1];
for(const name of ['Aura','Interrupt','Priority','Shield','Weight Class'])assert.match(block,new RegExp(`"name":"${name.replace(' ','\\s?')}"`),`Android runtime must embed ${name}`);

assert.match(appSource,/\['move_keywords','Move Keywords'\]/,'Android Pokédex & Rules must expose Move Keywords');
assert.match(appSource,/function localMoveKeywordRows\(query=''/,'Android must support local keyword search');
assert.match(appSource,/if\(catalogState\.kind==='move_keywords'\)/,'Android Library must special-case local keyword resolution');
assert.match(appSource,/function moveKeywordEntries\(move=\{\}\)/,'Android must detect keywords on Move definitions');
assert.match(appSource,/moveKeywordReferenceHtml\(def\|\|m\)/,'Android Creature Move cards must show keyword references');
assert.match(appSource,/event\.stopPropagation\(\);openMoveKeywordInfo/,'Keyword buttons must not trigger parent card actions');
assert.match(appSource,/PTU Core 1\.05 keyword reference/,'Keyword modal must identify the source ruleset');

console.log('Stage A.9 Android Move Keyword regression OK');
