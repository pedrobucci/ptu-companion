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
  const names=['trainerFeatureBoundTargets','trainerFeatureBindingCost','trainerBoundAp'];
  const helpers=names.map(name=>{const line=source.split(/\r?\n/).find(line=>line.startsWith(`function ${name}(`));assert(line,`${platform}: ${name} exists`);return line;}).join('\n');
  const fixture={id:'legacy-load-qa',details:{features:[{id:'Silent Assassin',bound:false}]}};
  const globals={fixture,trainer:()=>fixture,trainerResolved:()=>null,trainerFeatureBinding:()=>null};
  const ap=()=>vm.runInNewContext(`${helperSource};${helpers};trainerBoundAp(fixture)`,globals);
  assert.equal(ap(),0,`${platform}: legacy Feature sheet loads unbound without a global slug`);
  fixture.details.features[0].bound=true;
  assert.equal(ap(),2,`${platform}: legacy Silent Assassin reserves two AP`);
  fixture.details.features[0].id='silent_assassin';
  assert.equal(ap(),2,`${platform}: persisted alternate ID resolves through the shared slug helper`);
  fixture.details.features.push({id:'other-bound-feature',bound:true,boundApCostEach:1,boundTargetIds:['p1','p2']});
  assert.equal(ap(),4,`${platform}: generic saved binding costs coexist with legacy Silent Assassin`);
  assert.doesNotMatch(source,/(^|[^\w$.])slug\s*\(/m,`${platform}: no unqualified slug() calls remain in app.js`);
}
console.log('Issue #66 Trainer loading and Features/Edges slug regression: Windows + Android OK');
