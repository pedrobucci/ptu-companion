import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {DefinitionRepository} from '../definitions/repository.mjs';
import {applyPokemonFormStatSwaps,resolvePokemonForms} from '../rules/pokemon-forms.mjs';
import {mergeBuiltInSpeciesForms as mergeAndroidForms} from '../../PTU_Companion_Android_Tauri/www/rules/pokemon-form-builtins.mjs';
import {applyPokemonFormStatSwaps as applyAndroidStatSwaps,resolvePokemonForms as resolveAndroidForms} from '../../PTU_Companion_Android_Tauri/www/rules/pokemon-forms.mjs';

const definitions=new DefinitionRepository(fileURLToPath(new URL('../seed/definitions/ptu_seed_v1.0.sqlite3',import.meta.url)));
try{
  const aegislash=definitions.getResolved({rulesetId:'all-provided-material',kind:'species',id:'aegislash'});
  assert.ok(aegislash,'bundled Aegislash definition exists');
  const windowsStance=aegislash.forms.find(form=>form.id==='sword-stance');
  assert.ok(windowsStance,'Windows bundled Aegislash form is available');
  const androidForms=mergeAndroidForms('aegislash',[]);
  const androidStance=androidForms.find(form=>form.id==='sword-stance');
  assert.ok(androidStance,'Android bundled Aegislash form is available');
  const input={formState:{baseFormId:'base',activeFormId:'sword-stance'},context:{manualApprovals:['aegislash-sword-stance']}};
  const resolved=resolvePokemonForms({...input,species:aegislash}),resolvedAndroid=resolveAndroidForms({...input,species:{...aegislash,forms:androidForms}});
  assert.equal(resolved.valid,true,'manual Sword Stance resolves from the bundled species definition');
  const shield=aegislash.baseStats,sword=resolved.species.baseStats;
  assert.equal(sword.attack,shield.defense,'Sword Attack uses Shield Defense');
  assert.equal(sword.defense,shield.attack,'Sword Defense uses Shield Attack');
  assert.equal(sword.special_attack,shield.special_defense,'Sword Sp. Attack uses Shield Sp. Defense');
  assert.equal(sword.special_defense,shield.special_attack,'Sword Sp. Defense uses Shield Sp. Attack');
  assert.deepEqual(windowsStance.overrides.baseStats.swap,[['attack','defense'],['special_attack','special_defense']]);
  assert.deepEqual(androidStance.overrides.baseStats.swap,[['attack','defense'],['special_attack','special_defense']]);
  assert.deepEqual(windowsStance.statSwaps,[['attack','defense'],['special_attack','special_defense']]);
  assert.deepEqual(androidStance.statSwaps,windowsStance.statSwaps,'Windows and Android declare identical complete-stat swaps');
  assert.deepEqual(resolved.species.baseStats,sword);
  assert.deepEqual(resolvedAndroid.species.baseStats,sword,'Windows and Android resolve the same stance stats');
  const breakdown=Object.fromEntries(['speciesBase','baseBonus','modifiedBase','natureAdjusted','levelAllocation','bonusAllocation','permanentFinal'].map((key,index)=>[key,{hp:1+index,attack:10+index,defense:20+index,special_attack:30+index,special_defense:40+index,speed:50+index}]));
  const swapped=applyPokemonFormStatSwaps(breakdown,windowsStance.statSwaps);
  const swappedAndroid=applyAndroidStatSwaps(breakdown,androidStance.statSwaps);
  for(const key of Object.keys(breakdown)){
    assert.equal(swapped[key].attack,breakdown[key].defense,`${key}: Attack receives the complete Defense value`);
    assert.equal(swapped[key].defense,breakdown[key].attack,`${key}: Defense receives the complete Attack value`);
    assert.equal(swapped[key].special_attack,breakdown[key].special_defense,`${key}: Sp. Attack receives the complete Sp. Defense value`);
    assert.equal(swapped[key].special_defense,breakdown[key].special_attack,`${key}: Sp. Defense receives the complete Sp. Attack value`);
    assert.equal(swapped[key].hp,breakdown[key].hp);assert.equal(swapped[key].speed,breakdown[key].speed);
  }
  assert.deepEqual(swappedAndroid,swapped,'Windows and Android transpose the complete stat breakdown identically');
}finally{definitions.close();}

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
  assert.ok(source.includes('const isAegislash=formEventSlug(p?.species).includes(\'aegislash\')'),`${path}: manual control is rendered even if form reference data is unavailable`);
  assert.ok(source.includes('onclick=\"toggleAegislashStanceManually()\"'),`${path}: direct manual stance toggle is on the sheet`);
  assert.ok(source.includes('togglePokemonTransformation,toggleAegislashStanceManually,'),`${path}: button handler is exported`);
  assert.ok(source.includes('form,{manualOverride:true}'),`${path}: manual override bypasses combat/action/condition prerequisites`);
  assert.ok(!source.includes("button('Stance Change · Full Action'"),`${path}: no combat Full Action button remains as a manual prerequisite`);
  assert.ok(source.includes("payload?.changed&&state.selectedPokemonId===id&&state.ui.screen==='creature')await loadCreatureReferenceData(true)"),`${path}: Creature Sheet refreshes resolved stats after a Form transition`);
  assert.ok(source.includes('payload?.changed&&pokemonCombatReferenceState.pokemonId===id)await loadPokemonCombatReferenceData(id,true)'),`${path}: Combat refreshes resolved stats after a Form transition`);
}
for(const [path,source] of [['Windows','../server.mjs'],['Android','../../PTU_Companion_Android_Tauri/www/mobile-api.mjs']]){
  const api=await readFile(new URL(source,import.meta.url),'utf8');
  assert.match(api,/applyPokemonFormStatSwaps\(calculatedStats,formStatSwaps\)/,`${path}: complete stat breakdown is transposed in reference/combat data`);
  assert.match(api,/edgeStatsOverride:edgeStats/,`${path}: resolved Creature sheet uses the transposed breakdown`);
}
console.log(JSON.stringify({issue:58,moveKinds:['Physical','Special','Status'],clients:['Windows','Android'],formActionsOnCreatureSheet:true,referenceRefresh:true,bundledAegislashCompleteStatSwap:true},null,2));
