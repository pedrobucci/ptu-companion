import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {DefinitionRepository} from '../definitions/repository.mjs';
import * as windows from '../rules/pokemon-engine.mjs';
import * as android from '../../PTU_Companion_Android_Tauri/www/rules/pokemon-engine.mjs';

const repo=new DefinitionRepository(fileURLToPath(new URL('../seed/definitions/ptu_seed_v1.0.sqlite3',import.meta.url)));
try{
  const ability=repo.getResolved({rulesetId:'all-provided-material',kind:'abilities',id:'cluster-mind'});
  assert.match(ability.effect,/Move Pool limit is increased by \+2/i,'uses the bundled Core definition');
  const abilities=[ability,{...ability}];
  const species={id:'qa-species',name:'QA Species',baseStats:{hp:5,attack:5,defense:5,special_attack:5,special_defense:5,speed:5},abilities:[{name:'Cluster Mind',category:'Basic'}],levelUpMoves:Array.from({length:8},(_,i)=>({move_id:`move-${i+1}`,move:`Move ${i+1}`,level:1}))};
  const allocations={hp:2,attack:2,defense:2,special_attack:2,special_defense:2,speed:1};
  for(const engine of [windows,android]){
    assert.deepEqual(engine.resolvePokemonMoveLimit({abilities}),{base:6,modifier:0,abilityModifier:2,effective:8},'duplicate Ability definitions do not stack');
    assert.equal(engine.resolvePokemonMoveLimit({modifier:1,abilities:[ability]}).effective,9,'manual modifiers stack with the Ability');
    const build=engine.buildPokemonPreview({species,level:1,allocations,selectedAbilities:['Cluster Mind'],selectedMoves:Array.from({length:7},(_,i)=>`move-${i+1}`),moveLimitAbilities:[ability]});
    assert.equal(build.moveLimit.effective,8);
    assert.equal(build.valid,true,build.errors.join('; '));
    const blocked=engine.buildPokemonPreview({species,level:1,allocations,selectedAbilities:['Cluster Mind'],selectedMoves:Array.from({length:7},(_,i)=>`move-${i+1}`)});
    assert.equal(blocked.valid,false);
    assert.ok(blocked.errors.some(error=>error.includes('current Move Limit is 6')));
    const pokemon={level:1,details:{nature:'Hardy',statAllocations:allocations,abilities:['Cluster Mind'],moves:Array.from({length:7},(_,i)=>({id:`move-${i+1}`,name:`Move ${i+1}`}))}};
    const progression=engine.buildPokemonProgressionPreview({pokemon,species,experienceTable:[{level:1,cumulative_exp:0,stat_points_awarded:0}],moveLimitAbilities:[ability]});
    assert.equal(progression.moveLimit.effective,8);
    assert.equal(progression.valid,true,progression.errors.join('; '));
  }
  const runtime=readFileSync(new URL('../../PTU_Companion_Android_Tauri/www/mobile-runtime.js',import.meta.url),'utf8');
  assert.match(runtime,/moveSlots:\{used:knownMoves\.length,limit:resolvePokemonMoveLimit/,'Android native runtime reports resolved limit');
  assert.match(runtime,/details\.moveLimitEffective=resolvePokemonMoveLimit/,'Android native runtime persists the resolved limit');
  console.log('Issue #57: Core Cluster Mind +2, builder/progression enforcement, duplicate prevention, modifier stacking and Android runtime parity passed.');
}finally{repo.close();}
