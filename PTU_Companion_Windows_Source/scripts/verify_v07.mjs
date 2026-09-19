import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { DefinitionRepository } from '../definitions/repository.mjs';
import { buildPokemonPreview, autoBalancedAllocations } from '../rules/pokemon-engine.mjs';

const definitions=new DefinitionRepository(new URL('../seed/definitions/ptu_seed_v1.0.sqlite3',import.meta.url).pathname);
try{
  const rs='all-provided-material';
  const ceruledge=definitions.getResolved({rulesetId:rs,kind:'species',id:'ceruledge'});
  assert.ok(ceruledge,'Ceruledge must resolve');
  const incoming=definitions.getIncomingEvolution({speciesName:ceruledge.name,sourceId:ceruledge.sourceId});
  const ancestry=definitions.getEvolutionAncestry({rulesetId:rs,speciesName:ceruledge.name,sourceId:ceruledge.sourceId});
  assert.ok(ancestry.some(a=>a.name==='Charcadet'));

  const l1Alloc=autoBalancedAllocations({baseStats:ceruledge.baseStats,nature:'Hardy',level:1});
  const l1=buildPokemonPreview({species:ceruledge,level:1,nature:'Hardy',allocations:l1Alloc,selectedAbilities:['Flash Fire'],incomingEvolution:incoming,preEvolutionSpecies:ancestry});
  assert.deepEqual(l1.defaultMoves,[],'Pre-evolution history must never be selected automatically');
  assert.ok(l1.eligibleMoves.some(m=>m.name==='Ember' && m.sources.some(s=>s.sourceKind==='pre_evolution')),'Pre-evolution Ember should remain an explicit choice');

  const level=28;
  const alloc=autoBalancedAllocations({baseStats:ceruledge.baseStats,nature:'Hardy',level});
  const base=buildPokemonPreview({species:ceruledge,level,nature:'Hardy',allocations:alloc,selectedAbilities:['Flash Fire','Weak Armor'],incomingEvolution:incoming,preEvolutionSpecies:ancestry});
  assert.equal(base.defaultMoves.length,6);
  assert.ok(base.defaultMoves.every(k=>!k.startsWith('pre:')&&!k.startsWith('gm:')),'Auto Moves must use canonical identities');
  const fireSpin=base.eligibleMoves.find(m=>m.key==='fire-spin');
  assert.ok(fireSpin,'Fire Spin canonical Move should exist');
  assert.ok(fireSpin.sources.some(s=>s.sourceKind==='current_species'));
  assert.ok(fireSpin.sources.some(s=>s.sourceKind==='pre_evolution'));

  const legacy=[
    'pre:charcadet:fire-spin:4','pre:charcadet:will-o-wisp:5','pre:charcadet:night-shade:6',
    'pre:charcadet:flame-charge:7','pre:charcadet:incinerate:8','pre:charcadet:lava-plume:9'
  ];
  const migrated=buildPokemonPreview({species:ceruledge,level,nature:'Hardy',allocations:alloc,selectedAbilities:['Flash Fire','Weak Armor'],selectedMoves:legacy,incomingEvolution:incoming,preEvolutionSpecies:ancestry});
  assert.deepEqual(migrated.selectedMoves,['fire-spin','will-o-wisp','night-shade','flame-charge','incinerate','lava-plume']);
  assert.ok(!migrated.errors.some(e=>e.startsWith('Move ')),`Unexpected Move errors: ${migrated.errors.join(' | ')}`);

  const app=readFileSync(new URL('../static-preview/app.js',import.meta.url),'utf8');
  const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
  assert.match(app,/FUNCTIONAL v0\.7/);
  assert.match(app,/f\.selectedMoves=\[\.\.\.\(preview\.selectedMoves\|\|\[\]\)\]/);
  assert.match(app,/Use recommended/);
  assert.match(server,/autoSelectMoves/);

  console.log('PTU Companion v0.7 verification: OK');
  console.log('  Ceruledge pre-evolution history: explicit, not auto-selected');
  console.log('  canonical Move identities: passed');
  console.log('  merged current/pre-evolution provenance: passed');
  console.log('  legacy pre:* key migration: passed');
  console.log('  UI counter/checkbox state synchronization: present');
  console.log('  server-authoritative recommended Auto Moves: present');
} finally {
  definitions.close();
}
