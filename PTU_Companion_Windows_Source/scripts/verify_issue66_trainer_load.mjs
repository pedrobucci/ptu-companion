import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const clients=[
  ['Windows','../static-preview/app.js'],
  ['Android','../../PTU_Companion_Android_Tauri/www/app.js']
];
let sharedSlug;
for(const [platform,path] of clients){
  const source=await readFile(new URL(path,import.meta.url),'utf8');
  const helper=source.match(/function pokemonCombatSlug\(value\)\{[^\n]+/);
  assert.ok(helper,`${platform}: shared slug helper is defined in the frontend scope`);
  const helperSource=helper[0].trim();
  if(sharedSlug)assert.equal(helperSource,sharedSlug,'Windows and Android use the same helper');
  sharedSlug=helperSource;
  const context={};vm.runInNewContext(`${helperSource};this.slug=pokemonCombatSlug;`,context);
  assert.equal(context.slug('Silent Assassin'),'silent-assassin');
  assert.equal(context.slug('silent_assassin'),'silent-assassin');
  assert.ok(source.includes("function trainerBoundAp(t=trainer()){return (t?.details?.features||[]).some(f=>pokemonCombatSlug(f.id||f.name)==='silent-assassin'"),`${platform}: bound AP calculation uses the in-scope helper`);
  assert.ok(source.includes("isFeatures&&pokemonCombatSlug(f.id||f.name)==='silent-assassin'"),`${platform}: Features tab resolves Silent Assassin without an undefined identifier`);
  assert.ok(source.includes("kind==='features'&&pokemonCombatSlug(item.id||item.name)==='silent-assassin'"),`${platform}: removing a bound feature uses the in-scope helper`);
  assert.ok(source.includes("!feature||pokemonCombatSlug(feature.id||feature.name)!=='silent-assassin'"),`${platform}: Bind/Unbind uses the in-scope helper`);
  assert.doesNotMatch(source,/(^|[^\w$.])slug\s*\(/m,`${platform}: no unqualified slug() calls remain in app.js`);
}
console.log('Issue #66 Trainer loading and Features/Edges slug regression: Windows + Android OK');
