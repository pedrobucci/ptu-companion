import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

for (const path of [
  '../rules/modifier-engine.mjs',
  '../../PTU_Companion_Android_Tauri/www/rules/modifier-engine.mjs'
]) {
  const {getPokemonModifierSummary,resolveMoveDamage}=await import(new URL(path,import.meta.url));
  const pokemon={details:{combatStages:{attack:2,defense:-6,spAttack:-2,spDefense:1,speed:3,accuracy:-1},finalStats:{attack:20,defense:10,special_attack:20,special_defense:10,speed:15}}};
  const summary=getPokemonModifierSummary(pokemon);
  assert.deepEqual([summary.combatStats.attack,summary.combatStats.defense,summary.combatStats.special_attack,summary.combatStats.special_defense,summary.combatStats.speed,summary.accuracyRollBonus],[28,4,16,12,24,-1]);
  const getDamageBase=()=>({rolled_damage:'1d6'});
  const physical=resolveMoveDamage({pokemon,moveDefinition:{class:'Physical',damageBase:4},getDamageBase});
  const special=resolveMoveDamage({pokemon,moveDefinition:{class:'Special',damageBase:4},getDamageBase});
  assert.deepEqual([physical.finalRoll,special.finalRoll],['1d6+28','1d6+16']);
}

const windowsApi=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
const androidApi=await readFile(new URL('../../PTU_Companion_Android_Tauri/www/mobile-api.mjs',import.meta.url),'utf8');
for (const api of [windowsApi,androidApi]) assert.match(api,/combatStages:pokemon\.combatStages\|\|\{\}/);
console.log('Issue #59 Combat Stage stats and Move damage resolve on Windows and Android.');
