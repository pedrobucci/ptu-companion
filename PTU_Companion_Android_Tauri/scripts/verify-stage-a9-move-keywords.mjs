import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const appSource=await readFile(new URL('../www/app.js',import.meta.url),'utf8');
const match=appSource.match(/\/\* STAGE_A9_MOVE_KEYWORD_CATALOG_START \*\/([\s\S]*?)\/\* STAGE_A9_MOVE_KEYWORD_CATALOG_END \*\//);
assert.ok(match,'Android must contain the built-in Move Keyword catalog');
const block=match[1];

const names=[...block.matchAll(/\{id:'[^']+',name:'([^']+)'/g)].map(item=>item[1]);
assert.equal(names.length,33,'Android must expose all 33 PTU Core 1.05 Move Keywords');
assert.deepEqual(names.slice(0,5),['Aura','Berry','Blessing','Coat','Dash']);
assert.deepEqual(names.slice(-5),['Spirit Surge','Trigger','Vortex','Weather','Weight Class']);
assert.match(block,/Friendly[^\n]+cannot miss/,'Friendly description must preserve the source no-miss behavior');
assert.match(block,/Priority \(Advanced\)/,'Priority must distinguish Advanced in its description');
assert.match(block,/Shield[^\n]+forfeits the user’s Standard Action on the next turn/,'Shield must expose its next-turn action cost');
assert.match(block,/Sonic[^\n]+Deafened/,'Sonic must expose Deafened immunity');

assert.match(appSource,/\['move_keywords','Move Keywords'\]/,'Android Pokédex & Rules must expose Move Keywords');
assert.match(appSource,/function localMoveKeywordRows\(query=''/,'Android must support local keyword search');
assert.match(appSource,/if\(catalogState\.kind==='move_keywords'\)/,'Android Library must special-case local keyword resolution');
assert.match(appSource,/function moveKeywordEntries\(move=\{\}\)/,'Android must detect keywords on Move definitions');
assert.match(appSource,/moveKeywordReferenceHtml\(def\|\|payload\|\|mv\)/,'Android Creature Move cards must show keyword references');
assert.match(appSource,/event\.stopPropagation\(\);openMoveKeywordInfo/,'Keyword buttons must not trigger parent card actions');
assert.match(appSource,/PTU Core 1\.05 keyword reference/,'Keyword modal must identify the source ruleset');
assert.doesNotMatch(block,/name:'Burst'/,'Range Keywords are outside Stage A.9 scope');

console.log('Stage A.9 Android Move Keyword regression OK');
