import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {DefinitionRepository} from '../definitions/repository.mjs';
import {resolveTrainerModel as windows} from '../rules/trainer-engine.mjs';
import {resolveTrainerModel as android} from '../../PTU_Companion_Android_Tauri/www/rules/trainer-engine.mjs';

const repo=new DefinitionRepository(fileURLToPath(new URL('../seed/definitions/ptu_seed_v1.0.sqlite3',import.meta.url)));
try{
  for(const resolve of [windows,android]){
    const trainer={level:10,stats:{attack:10},details:{features:[{id:'shadow-arms'},{id:'phantom-menace'}],skillRanks:{Combat:4}},equipment:{mainHand:{id:'qa-weapon',name:'QA Weapon',mechanics:{kind:'weapon',weaponClass:'large_melee',quality:'Fine',dbModifier:2,acModifier:1}}}};
    const build=()=>resolve({trainer,rulesetId:'all-provided-material',getDefinition:a=>repo.getResolved(a),getDamageBase:n=>repo.getDamageBase(n)});
    for(const id of ['shadow-punch','shadow-sneak','shadow-claw','phantom-force']){
      const move=build().moves.find(x=>x.id===id);assert(move,id);
      assert.equal(move.resolvedDamage.finalDb,move.definition.damageBase+2,id);
      assert.equal(move.resolvedDamage.resolvedAc,move.definition.ac==null?null:move.definition.ac+1,id);
      assert.equal(move.resolvedDamage.weapon.id,'qa-weapon');assert.equal(move.resolvedDamage.stab,false);
    }
    trainer.equipment.mainHand.mechanics.acModifier=-1;
    const improved=build().moves.find(x=>x.id==='shadow-sneak');assert.equal(improved.resolvedDamage.resolvedAc,improved.definition.ac-1);
    trainer.equipment.offHand=trainer.equipment.mainHand;delete trainer.equipment.mainHand;
    assert.equal(build().moves.find(x=>x.id==='shadow-sneak').resolvedDamage.weapon.slot,'offHand');
    trainer.equipment.mainHand=trainer.equipment.offHand;delete trainer.equipment.offHand;
    trainer.equipment.mainHand.mechanics.weaponClass='long_range';
    assert.equal(build().moves.find(x=>x.id==='shadow-sneak').resolvedDamage.weapon,null,'ranged weapons do not qualify');
    trainer.equipment={};
    const normal=build().moves.find(x=>x.id==='shadow-sneak');assert.equal(normal.resolvedDamage.finalDb,normal.definition.damageBase);
    trainer.details.features=[];assert.equal(build().moves.length,0,'feature grants disappear with the source');
  }
  for(const path of ['../static-preview/app.js','../../PTU_Companion_Android_Tauri/www/app.js']){
    const source=readFileSync(new URL(path,import.meta.url),'utf8');
    assert.match(source,/<details class="section-card creature-selector-accordion"><summary/,'accordion is closed by default');
    assert.match(source,/selectPokemon\('\$\{p.id\}'\);focusCreaturePortrait\(\)/,'selection routes through persistent handler');
    const fn=source.match(/function focusCreaturePortrait\(\)\{[^\n]+/)[0];
    const calls=[];
    vm.runInNewContext(fn+';focusCreaturePortrait();',{requestAnimationFrame:f=>f(),window:{matchMedia:()=>({matches:true})},document:{getElementById:id=>{assert.equal(id,'creature-portrait');return {focus:o=>calls.push(['focus',o.preventScroll]),scrollIntoView:o=>calls.push(['scroll',o.block,o.behavior])};}}});
    assert.deepEqual(calls,[['focus',true],['scroll','start','auto']]);
  }
  console.log('Issues #53/#54: melee Weapon Attack modifiers, source removal, platform parity, accordion and portrait navigation passed.');
}finally{repo.close();}
