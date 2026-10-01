import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DefinitionRepository} from '../definitions/repository.mjs';
import {resolveTrainerModel} from '../rules/trainer-engine.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const definitions=new DefinitionRepository(join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'));
const rulesetId='all-provided-material';
const getDefinition=args=>definitions.getResolved(args);
const getDamageBase=n=>definitions.getDamageBase(n);
const skills={Acrobatics:2,Athletics:2,Combat:4,Intimidate:6,Stealth:2,Survival:2,'General Education':2,'Medicine Education':2,'Occult Education':4,'Pokémon Education':2,'Technology Education':2,Guile:2,Perception:2,Charm:2,Command:2,Focus:2,Intuition:2};
const sword={id:'two-handed-sword',name:'Two-Handed Sword',inventoryItemId:'two-handed-sword',mechanics:{kind:'weapon',quality:'Fine',weaponClass:'large_melee',hands:2,metal:true,range:'Melee',acModifier:1,dbModifier:2,weaponMoves:{adept:'backswing',master:'slice'},tags:['Melee','Large Melee','Two-Handed','Sword']}};
const trainer={id:'issue29',level:5,stats:{hp:10,attack:10,defense:10,spAttack:10,spDefense:10,speed:10},gmGrants:[],equipment:{head:null,body:null,mainHand:sword,offHand:null,feet:null,accessory:null},details:{skillRanks:skills,features:[{id:'silent-assassin',name:'Silent Assassin'}],edges:[],moves:[],injuries:0,combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}}};
const resolve=engine=>engine.resolveTrainerModel({trainer,rulesetId,getDefinition,getDamageBase});
try{
  const engines=[
    await import('../rules/trainer-engine.mjs'),
    await import('../../PTU_Companion_Android_Tauri/www/rules/trainer-engine.mjs')
  ];
  for(const engine of engines){
    let model=resolve(engine);
    assert.equal(model.skills.Stealth.flatBonus,3,'unbound Feature gives half the higher Skill Rank, rounded down');
    assert.ok(model.grantedCapabilities.some(capability=>capability.name==='Dead Silent'),'Dead Silent remains granted while unbound');
    assert.equal(model.derived.boundAp,0);
    assert.equal(model.struggleAttack.featureEffects.length,0,'normal effects are not active while unbound');
    assert.ok(!model.struggleAttack.options.some(option=>option.type==='Ghost'),'Ghost Struggle option is unavailable while unbound');
    assert.ok(model.moves.find(move=>move.id==='backswing'),'test fixture includes a resolved Weapon Attack');

    trainer.details.features[0].bound=true;
    model=resolve(engine);
    assert.equal(model.skills.Stealth.flatBonus,3,'Bonus remains active while Bound');
    assert.ok(model.grantedCapabilities.some(capability=>capability.name==='Dead Silent'));
    assert.equal(model.derived.boundAp,2);
    assert.equal(model.derived.availableMaxAp,model.derived.maxAp-2);
    assert.ok(model.struggleAttack.options.some(option=>option.type==='Ghost'));
    assert.match(model.struggleAttack.featureEffects[0].text,/Flinch on Accuracy Roll 18\+/);
    assert.match(model.moves.find(move=>move.id==='backswing').resolvedDamage.featureEffects[0].text,/Ghost-Type Damage/);
    trainer.details.features[0].bound=false;
  }

  for(const path of ['static-preview/app.js','../PTU_Companion_Android_Tauri/www/app.js']){
    const app=readFileSync(join(root,path),'utf8');
    for(const token of ['function trainerBoundAp','function toggleSilentAssassinBound','Bind · Standard Action · 2 AP','Unbind · Free Action','td.currentAp-=2','td.currentAp+2','Silent Assassin (Bound)','Dead Silent and the Stealth bonus stay active while unbound'])assert.ok(app.includes(token),`${path} is missing ${token}`);
  }
  console.log('Issue #29: Silent Assassin Bonus, Bound-only effects, 2 committed AP, UI persistence hooks and Windows/Android parity passed.');
}finally{definitions.close();}
