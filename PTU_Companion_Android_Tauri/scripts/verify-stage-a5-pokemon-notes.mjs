import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const appSource=await readFile(new URL('../www/app.js',import.meta.url),'utf8');

assert.match(appSource,/const storedPokemonNotes=p\.details\.notes;/,'Android must normalize the Pokémon Notes field on older/default saves');
assert.match(appSource,/Array\.isArray\(storedPokemonNotes\)/,'Android must remain compatible with legacy array-shaped Pokémon Notes');
assert.match(appSource,/async function editPokemonNotes\(id=state\.selectedPokemonId\)/,'Android UI must expose an individual Pokémon Notes editor');
assert.match(appSource,/title:`Pokémon Notes · \$\{p\.name\}`/,'Android Pokémon Notes editor must identify the selected Pokémon');
assert.match(appSource,/type:'textarea',rows:10,value:current/,'Android Pokémon Notes editor must be multiline');
assert.match(appSource,/section\('POKÉMON NOTES'/,'Pokémon Notes must appear on the Android Creature Sheet');
assert.match(appSource,/esc\(pokemonNotes\)\.replace\(\/\\n\/g,'<br>'\)/,'Android must escape Pokémon Notes while preserving line breaks');
assert.match(appSource,/p\.details\.notes=next;\s*persist\(\);\s*toast\(`\$\{p\.name\} notes updated\.`\);/,'Android Notes edits must use ordinary save persistence without mechanical recalculation');
assert.match(appSource,/editPokemonIdentity,editPokemonNotes,changeHp/,'Android Pokémon Notes editor must be exposed to inline UI actions');

console.log('Stage A.5 Android Pokémon Notes regression OK');
