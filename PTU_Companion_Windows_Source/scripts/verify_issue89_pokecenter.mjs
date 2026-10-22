import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const engine=readFileSync(path.join(root,'PTU_Companion_Windows_Source/static-preview/pokecenter-engine.js'),'utf8');
const context=vm.createContext({});vm.runInContext(engine,context);
const state={trainer:{money:50},selectedRosterId:'active',rosters:[{id:'active',active:true},{id:'inactive',active:false}],pokemon:[
  {id:'hurt',name:'Hurt',hp:3,maxHp:20,injuries:4,tempHp:2,storage:false,rosterIds:['active']},
  {id:'second',name:'Second',hp:1,maxHp:12,injuries:1,storage:false,rosterIds:['active']},
  {id:'other',name:'Other',hp:1,maxHp:12,injuries:1,storage:false,rosterIds:['inactive']},
  {id:'stored',name:'Stored',hp:0,maxHp:10,injuries:2,storage:true,rosterIds:[]}
],ui:{combat:{participants:{hurt:{conditions:{statusAfflictions:['Burned','Poisoned'],stuck:true}}}},pokecenter:{pokemonIds:['hurt'],serviceCost:40,perPokemon:false}}};
const pristine=JSON.stringify(state);
const preview=context.previewPokecenterRecovery(state,{pokemonIds:['hurt'],serviceCost:40,perPokemon:false,rosterId:'active'});
assert.equal(preview.valid,true);assert.equal(preview.total,40);assert.equal(preview.effects[0].hpBefore,3);
const applied=context.applyPokecenterRecovery(state,{pokemonIds:['hurt'],serviceCost:40,rosterId:'active'});
assert.equal(applied.state.trainer.money,10);assert.equal(applied.state.pokemon[0].hp,20);assert.equal(applied.state.pokemon[0].injuries,0);assert.equal(applied.state.pokemon[0].tempHp,2,'recovery preserves positive Temporary HP');
assert.equal(JSON.stringify(applied.state.ui.combat.participants.hurt.conditions.statusAfflictions),'[]');assert.equal(applied.state.ui.combat.participants.hurt.conditions.stuck,true);
assert.equal(JSON.stringify(state),pristine,'preview/apply must not mutate their input');
assert.equal(context.previewPokecenterRecovery(state,{pokemonIds:['hurt','hurt'],serviceCost:40,perPokemon:true,rosterId:'active'}).total,40,'duplicate IDs charge only once');
assert.equal(context.previewPokecenterRecovery(state,{pokemonIds:['hurt','second'],serviceCost:40,perPokemon:true,rosterId:'active'}).total,80,'per-Pokémon option multiplies by selected count');
assert.equal(context.previewPokecenterRecovery(state,{pokemonIds:['hurt','second'],serviceCost:40,perPokemon:true,rosterId:'active'}).valid,false,'multiplied charge is rejected if unaffordable');
assert.equal(context.previewPokecenterRecovery(state,{pokemonIds:['hurt','second'],serviceCost:40,perPokemon:false,rosterId:'active'}).total,40,'service fee is charged once for a group');
assert.throws(()=>context.applyPokecenterRecovery(state,{pokemonIds:['hurt','second'],serviceCost:40,perPokemon:true,rosterId:'active'}),/costs/,'unaffordable recovery fails as one transaction');
assert.equal(context.previewPokecenterRecovery(state,{pokemonIds:['hurt'],serviceCost:51,perPokemon:true,rosterId:'active'}).valid,false,'insufficient balance blocks the whole operation');
assert.equal(context.previewPokecenterRecovery(state,{pokemonIds:['other'],serviceCost:0,rosterId:'active'}).valid,false,'other rosters cannot be charged');
assert.equal(context.previewPokecenterRecovery(state,{pokemonIds:['stored'],serviceCost:0,rosterId:'active'}).valid,false,'Pokémon outside the selected roster are excluded');
assert.equal(context.previewPokecenterRecovery(state,{pokemonIds:['hurt'],serviceCost:-1,rosterId:'active'}).valid,false,'negative costs are rejected');
const restored=JSON.parse(JSON.stringify(applied.state));assert.equal(restored.trainer.money,10);assert.equal(restored.pokemon[0].injuries,0);assert.deepEqual(restored.ui.combat.participants.hurt.conditions.statusAfflictions,[]);
for(const app of ['PTU_Companion_Windows_Source/static-preview/app.js','PTU_Companion_Android_Tauri/www/app.js']){
  const source=readFileSync(path.join(root,app),'utf8');
  assert.match(source,/pokecenterApplyRecovery/);assert.match(source,/pokecenterSelectRoster/);assert.match(source,/previewPokecenterRecovery/);assert.match(source,/Confirm and recover/);assert.match(source,/Pokecenter/);
}
const android=readFileSync(path.join(root,'PTU_Companion_Android_Tauri/www/app.js'),'utf8');assert.match(android,/route\('pokecenter'\)/);
assert.equal(readFileSync(path.join(root,'PTU_Companion_Windows_Source/static-preview/pokecenter-engine.js'),'utf8'),readFileSync(path.join(root,'PTU_Companion_Android_Tauri/www/pokecenter-engine.js'),'utf8'));
console.log('Issue #89 Pokecenter recovery checks passed (charges, active roster, all-at-once recovery, Afflictions, persistence and UI parity).');
