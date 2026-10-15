import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const sources={
  windows:{engine:path.join(root,'PTU_Companion_Windows_Source/rules/trainer-engine.mjs'),progression:path.join(root,'PTU_Companion_Windows_Source/rules/trainer-progression-engine.mjs'),app:path.join(root,'PTU_Companion_Windows_Source/static-preview/app.js')},
  android:{engine:path.join(root,'PTU_Companion_Android_Tauri/www/rules/trainer-engine.mjs'),progression:path.join(root,'PTU_Companion_Android_Tauri/www/rules/trainer-progression-engine.mjs'),app:path.join(root,'PTU_Companion_Android_Tauri/www/app.js')}
};
const elemental={id:'elemental-connection',name:'Elemental Connection',prerequisites:'None',effect:'Choose an Elemental Type. You gain a +2 bonus to relevant Checks targeting Pokémon of that Type. You may not take Elemental Connection if you have the Mystic Senses Edge, and you may not take Mystic Senses if you have Elemental Connection.',raw:{}};
const mystic={id:'mystic-senses',name:'Mystic Senses',prerequisites:'Novice Intuition',effect:'You may use Intuition instead of Charm to improve the disposition of Wild Pokémon. You may not take Mystic Senses if you have the Elemental Connection Edge, and you may not take Elemental Connection if you have Mystic Senses.',raw:{}};
for(const [platform,files] of Object.entries(sources)){
  const engine=await import(pathToFileURL(files.engine));
  const progression=await import(pathToFileURL(files.progression));
  assert.equal(engine.trainerDefinitionSelectionConflict(elemental,[mystic]).blocked,true,`${platform}: Mystic Senses blocks Elemental Connection`);
  assert.equal(engine.trainerDefinitionSelectionConflict(mystic,[elemental]).blocked,true,`${platform}: Elemental Connection blocks Mystic Senses`);
  assert.equal(engine.trainerDefinitionSelectionConflict(elemental,[]).blocked,false,`${platform}: no false positive without an excluded Edge`);
  const trainer={level:1,exp:10,details:{features:[],edges:[mystic],skillRanks:{}}};
  const getDefinition=({id})=>({[elemental.id]:elemental,[mystic.id]:mystic}[id]||null);
  const purchase=progression.previewTrainerXpPurchase({trainer,kind:'edges',id:elemental.id,manualConfirm:true,rulesetId:'verify',getDefinition,getDamageBase:()=>null});
  assert.equal(purchase.valid,false,`${platform}: XP purchase rejects the exclusive Edge`);
  assert.match(purchase.errors.join(' '),/Cannot take Elemental Connection while you have Mystic Senses/);
  const gmPurchase=progression.previewTrainerXpPurchase({trainer,kind:'edges',id:elemental.id,manualConfirm:true,rulesetId:'verify',getDefinition,getDamageBase:()=>null,gmOverride:true});
  assert.equal(gmPurchase.valid,true,`${platform}: explicit GM Override can bypass the exclusion`);
  const preview=progression.previewTrainerProgression({trainer,draft:{},rulesetId:'verify',getDefinition,listDefinitions:({kind})=>kind==='edges'?[{id:elemental.id}]:[],getDamageBase:()=>null,includeOptions:true});
  const candidate=preview.optionSets.edges.find(row=>row.id===elemental.id);
  assert.equal(candidate.valid,false,`${platform}: Level Up excludes the incompatible Edge`);
  assert.equal(candidate.selectionConflict.blocked,true);
  const app=fs.readFileSync(files.app,'utf8');
  assert.match(app,/available=available\.filter\(r=>!trainerDefinitionSelectionConflictUi\(r,trainer\(\)\.details\?\.edges\|\|\[\]\)\.blocked\)/,`${platform}: manual Edge picker filters incompatible choices`);
  assert.match(app,/trainerDefinitionSelectionConflictUi\(def,td\.edges\|\|\[\]\)/,`${platform}: manual add rechecks the incompatibility`);
  const helperStart=app.indexOf('function trainerDefinitionSelectionConflictUi(');
  const helperEnd=app.indexOf('\nasync function openTrainerDefinitionPicker',helperStart);
  assert(helperStart>=0&&helperEnd>helperStart,`${platform}: UI conflict helper exists`);
  const helper=app.slice(helperStart,helperEnd);
  const slug=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const helperFn=new Function('pokemonCombatSlug',`${helper}; return trainerDefinitionSelectionConflictUi;`)(slug);
  assert.equal(helperFn(elemental,[mystic]).blocked,true,`${platform}: picker predicate hides Elemental Connection`);
}
const runtime=fs.readFileSync(path.join(root,'PTU_Companion_Android_Tauri/www/mobile-runtime.js'),'utf8');
assert.match(runtime,/function trainerDefinitionSelectionConflict\(/,'Android classic runtime includes the same rule check');
assert.match(runtime,/!selectionConflict\.blocked/,'Android classic runtime applies the check to progression');
function pathToFileURL(value){return new URL(`file:///${value.replaceAll('\\','/')}`);}
console.log('Issue #78 Elemental Connection / Mystic Senses exclusion: Windows + Android checks passed.');
