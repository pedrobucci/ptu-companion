import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appPath = process.argv[2] || 'www/app.js';
const source = readFileSync(appPath, 'utf8');
const screen = source.match(/function creatureScreen\(\)\{([\s\S]*?)\n\}/)?.[1];
assert.ok(screen, 'creatureScreen should exist');
assert.match(source, /function creatureSelectorCard\(p,selectedId\)/);
assert.match(source, /aria-pressed=\"\$\{selected\}\" onclick=\"selectPokemon\('/);
assert.match(screen, /const choices=state\.pokemon\|\|\[\]/, 'selector should include all current Trainer Pokémon, including Storage');
assert.match(screen, /choices\.map\(x=>creatureSelectorCard\(x,p\.id\)\)/, 'every Pokémon should be selectable and reflect the active selection');
assert.match(source, /function selectPokemon\(id,go=false\).*?persist\(\)/, 'selection should persist through the existing state handler');
assert.match(screen, /No Pokémon[\s\S]*?Create Pokémon/, 'empty state should retain a create action');
console.log(`Issue #22 creature selector verified for ${appPath}`);
