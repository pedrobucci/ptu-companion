import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
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

    for(const token of ['function trainerBoundAp','function toggleSilentAssassinBound','function toggleTrainerFeatureBinding','function trainerFeatureBindingControls'])assert.ok(app.includes(token),`${path} is missing ${token}`);
    const names=['pokemonCombatSlug','trainerFeatureBoundTargets','trainerFeatureBindingCost','trainerBoundAp','trainerFeatureBindingControls','toggleTrainerFeatureBinding','toggleSilentAssassinBound'];
    const code=names.map(name=>{const line=app.split(/\r?\n/).find(line=>line.startsWith(`function ${name}(`)||line.startsWith(`async function ${name}(`));assert(line,`${path}: ${name}`);return line;}).join('\n');
    const input={id:'silent-qa',details:{currentAp:5,features:[{id:'shade-caller'},{id:'Silent Assassin',name:'Silent Assassin',bound:false}]}};
    const snapshots=[],errors=[];
    const globals={input,snapshots,errors,assert,trainer:()=>input,trainerResolved:()=>null,ensureTrainerDetails:()=>input.details,trainerFeatureBinding:index=>index===1?{apCost:2,action:'Standard Action',unbindAction:'Free Action',targetText:null}:null,trainerDerived:()=>({maxAp:5,boundAp:input.details.features[1].bound?2:0}),trainerMaxAp:()=>5,trainerFeatureTargetLabel:()=> 'Trainer',chip:value=>String(value),esc:value=>String(value),toast:message=>errors.push(message),commit:()=>snapshots.push(JSON.parse(JSON.stringify(input)))};
    await runInNewContext(`(async()=>{${code};assert.equal(trainerBoundAp(input),0);assert.match(trainerFeatureBindingControls(input.details.features[1],1),/Bind · Standard Action · 2 AP/);await toggleSilentAssassinBound(1);assert.equal(input.details.currentAp,3);assert.equal(trainerBoundAp(input),2);assert.equal(snapshots[0].details.features[1].bound,true);assert.match(trainerFeatureBindingControls(input.details.features[1],1),/Unbind · Free Action/);await toggleSilentAssassinBound(1,'__self__');assert.equal(input.details.currentAp,5);assert.equal(trainerBoundAp(input),0);assert.equal(snapshots[1].details.features[1].bound,false);input.details.currentAp=1;await toggleSilentAssassinBound(1);assert.equal(input.details.currentAp,1);assert.equal(input.details.features[1].bound,false);assert.equal(snapshots.length,2);assert.match(errors.at(-1),/requires 2 available AP/);})()`,globals);

  }
  console.log('Issue #29: Silent Assassin Bonus, Bound-only effects, 2 committed AP, UI persistence hooks and Windows/Android parity passed.');
}finally{definitions.close();}
