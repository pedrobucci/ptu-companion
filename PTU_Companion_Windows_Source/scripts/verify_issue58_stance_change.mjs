import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const clients=[
  '../static-preview/app.js',
  '../../PTU_Companion_Android_Tauri/www/app.js'
];
let expected;
for(const path of clients){
  const source=await readFile(new URL(path,import.meta.url),'utf8');
  const match=source.match(/function pokemonMoveIsDamaging\(row\)[^\n]+/);
  assert.ok(match,`${path}: shared damaging-Move classifier is present`);
  if(expected)assert.equal(match[0],expected,'Windows and Android use the same Move classifier');
  expected=match[0];
  const context={};vm.runInNewContext(`${match[0]};this.classify=pokemonMoveIsDamaging;`,context);
  assert.equal(context.classify({definition:{category:'Physical'}}),true);
  assert.equal(context.classify({definition:{category:'special'}}),true);
  assert.equal(context.classify({definition:{category:'Status'}}),false);
  assert.equal(context.classify({resolvedDamage:{finalRoll:'2d6+5'}}),true);
  assert.ok(source.includes('pokemonFormLifecycleControls(data.species?.forms||[],pokemonFormCurrentState(p),p)'),`${path}: Creature Sheet exposes Form lifecycle actions`);
  assert.ok(source.includes("payload?.changed&&state.selectedPokemonId===id&&state.ui.screen==='creature')await loadCreatureReferenceData(true)"),`${path}: Creature Sheet refreshes resolved stats after a Form transition`);
  assert.ok(source.includes('payload?.changed&&pokemonCombatReferenceState.pokemonId===id)await loadPokemonCombatReferenceData(id,true)'),`${path}: Combat refreshes resolved stats after a Form transition`);
}
console.log(JSON.stringify({issue:58,moveKinds:['Physical','Special','Status'],clients:['Windows','Android'],formActionsOnCreatureSheet:true,referenceRefresh:true},null,2));
