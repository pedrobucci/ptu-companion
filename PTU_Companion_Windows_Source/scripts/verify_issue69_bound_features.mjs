import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const skills={Acrobatics:2,Athletics:2,Combat:2,Intimidate:2,Stealth:2,Survival:2,'General Education':2,'Medicine Education':2,'Occult Education':2,'Pokémon Education':2,'Technology Education':2,Guile:2,Perception:2,Charm:2,Command:2,Focus:2,Intuition:2};
const definitions={
  'test-stratagem':{id:'test-stratagem',name:'Test Stratagem',effect:'While this Feature is Bound, grant +3 Evasion.',semanticAutomation:{level:'hybrid'},compiledEffects:[{kind:'modifier',source_field:'effect_text',source_text:'While this Feature is Bound, grant +3 Evasion.',target_path:'combat.evasion',value:3,target:'target'}],raw:{tags:['Orders','Stratagem'],activation_text:'Bind 2 AP - Standard Action',frequency:{raw:'Bind 2 AP - Standard Action',ap_cost:2,ap_mode:'bind',actions:['standard']},target_text:'Your Pokémon',effect_text:'While this Feature is Bound, grant +3 Evasion.'}},
  'test-rank-bind':{id:'test-rank-bind',name:'Test Rank Bind',effect:'While Bound, gain a deterministic effect.',semanticAutomation:{level:'hybrid'},compiledEffects:[],raw:{tags:['Ranked 3'],activation_text:'Static; Bind 1 AP per Rank',frequency:{raw:'Static; Bind 1 AP per Rank',ap_cost:1,ap_mode:'bind',actions:[]},target_text:null,effect_text:'While Bound, gain a deterministic effect.'}}
  ,'test-external-effect':{id:'test-external-effect',name:'Test External Effect',effect:'The target gains +2 Accuracy.',semanticAutomation:{level:'hybrid'},compiledEffects:[{kind:'modifier',source_field:'effect_text',source_text:'The target gains +2 Accuracy.',target_path:'combat.accuracy',value:2,target:'self'}],raw:{tags:[],activation_text:'Bind 1 AP - Standard Action',frequency:{raw:'Bind 1 AP - Standard Action',ap_cost:1,ap_mode:'bind',actions:['standard']},target_text:'Your Pokémon',effect_text:'The target gains +2 Accuracy.'}},
  'sneak-attack':{id:'sneak-attack',name:'Sneak Attack',effect:'While this Feature is bound, when attacking foes that are Fainted, Flanked, Flinched, Sleeping, Stuck, Tripped, unaware of your Pokémon\'s presence, or otherwise do not expect an attack, the target gains a +2 bonus to Accuracy Rolls and a bonus to Damage Rolls equal to your Type-Linked Skill Rank.',compiledEffects:[{kind:'modifier',source_text:'While this Feature is bound, when attacking foes that are Fainted, Flanked, Flinched, Sleeping, Stuck, Tripped, unaware of your Pokémon\'s presence, or otherwise do not expect an attack, the target gains a +2 bonus to Accuracy Rolls and a bonus to Damage Rolls equal to your Type-Linked Skill Rank.',target_path:'combat.accuracy',value:2,target:'self'}],raw:{activation_text:'Bind 2 AP - Standard Action',frequency:{raw:'Bind 2 AP - Standard Action',ap_cost:2,ap_mode:'bind',actions:['standard']},target_text:'Your Dark-Type Pokémon',effect_text:'While this Feature is bound, when attacking foes that are Fainted, Flanked, Flinched, Sleeping, Stuck, Tripped, unaware of your Pokémon\'s presence, or otherwise do not expect an attack, the target gains a +2 bonus to Accuracy Rolls and a bonus to Damage Rolls equal to your Type-Linked Skill Rank.'}},
  'capricious-whirl':{id:'capricious-whirl',name:'Capricious Whirl',effect:'While this Feature is Bound, the target has a +3 bonus to its Evasion but deals 5 less damage with all damaging attacks.',raw:{activation_text:'Bind 2 AP - Standard Action',frequency:{raw:'Bind 2 AP - Standard Action',ap_cost:2,ap_mode:'bind',actions:['standard']},target_text:'Your Pokémon',effect_text:'While this Feature is Bound, the target has a +3 bonus to its Evasion but deals 5 less damage with all damaging attacks.'}},
  'pinpoint-strike':{id:'pinpoint-strike',name:'Pinpoint Strike',effect:'Increase the Accuracy and Effect Range of the target’s damaging attacks by +2. These attacks deal 5 less damage.',raw:{activation_text:'Bind 2 AP - Standard Action',frequency:{raw:'Bind 2 AP - Standard Action',ap_cost:2,ap_mode:'bind',actions:['standard']},target_text:'Your Pokémon',effect_text:'Increase the Accuracy and Effect Range of the target’s damaging attacks by +2. These attacks deal 5 less damage.'}},
  'trick-shot':{id:'trick-shot',name:'Trick Shot',effect:'Decrease the Accuracy Roll of the target’s damaging ranged attacks by -2. The Critical Hit range of those attacks is increased by +3.',raw:{activation_text:'Bind 2 AP - Standard Action',frequency:{raw:'Bind 2 AP - Standard Action',ap_cost:2,ap_mode:'bind',actions:['standard']},target_text:'Your Pokémon',effect_text:'Decrease the Accuracy Roll of the target’s damaging ranged attacks by -2. The Critical Hit range of those attacks is increased by +3.'}},
  'reckless-advance':{id:'reckless-advance',name:'Reckless Advance',effect:'Increase the damage rolls of the target’s damaging melee attacks by +8, and these attacks Trip targets on Accuracy Rolls of 18+.',raw:{activation_text:'Bind 2 AP - Standard Action',frequency:{raw:'Bind 2 AP - Standard Action',ap_cost:2,ap_mode:'bind',actions:['standard']},target_text:'Your Pokémon',effect_text:'Increase the damage rolls of the target’s damaging melee attacks by +8, and these attacks Trip targets on Accuracy Rolls of 18+.'}}
};
const trainerFixture=features=>({id:'issue69',name:'Bind Test',level:5,stats:{hp:10,attack:10,defense:10,spAttack:10,spDefense:10,speed:10},equipment:{},gmGrants:[],details:{skillRanks:skills,features,edges:[],moves:[],injuries:0,combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}}});
const getDefinition=({kind,id})=>kind==='features'?definitions[id]||null:null;
const getDamageBase=()=>null;
const engines=[await import('../rules/trainer-engine.mjs'),await import('../../PTU_Companion_Android_Tauri/www/rules/trainer-engine.mjs')];
for(const engine of engines){
  let trainer=trainerFixture([{id:'test-stratagem',name:'Test Stratagem',bound:false}]);
  let model=engine.resolveTrainerModel({trainer,rulesetId:'test',getDefinition,getDamageBase});
  assert.equal(model.derived.boundAp,0);
  assert.equal(model.evasionBonus,0,'compiled Bound effect stays inactive while unbound');
  assert.equal(model.contextualEffects.some(x=>x.source?.id==='test-stratagem'),false,'unbound contextual text is not reported as active');
  trainer.details.features[0]={id:'test-stratagem',name:'Test Stratagem',bound:true,boundTargetIds:['p1','p2']};
  model=engine.resolveTrainerModel({trainer,rulesetId:'test',getDefinition,getDamageBase});
  assert.equal(model.derived.boundAp,4,'each Stratagem target reserves its own AP cost');
  assert.equal(model.evasionBonus,0,'a target Pokémon effect is not incorrectly applied to the Trainer');
  assert.equal(model.sourceSummary[0].binding.stratagem,true);
  assert.equal(model.sourceSummary[0].binding.targetKind,'pokemon');
  assert.deepEqual(model.sourceSummary[0].boundTargetIds,['p1','p2']);
  trainer=trainerFixture([{id:'test-rank-bind',name:'Test Rank Bind',rank:3,bound:true}]);
  model=engine.resolveTrainerModel({trainer,rulesetId:'test',getDefinition,getDamageBase});
  assert.equal(model.derived.boundAp,3,'Bind AP per Rank scales with recorded rank');
  assert.equal(model.sourceSummary[0].binding.targetKind,'self','a definition without a Target line affects its user');
  trainer=trainerFixture([{id:'test-external-effect',name:'Test External Effect',bound:true,boundTargetIds:['p1']}]);
  model=engine.resolveTrainerModel({trainer,rulesetId:'test',getDefinition,getDamageBase});
  assert.equal(model.accuracyBonus,0,'an effect for the bound Pokémon never modifies Trainer Accuracy');
  assert.equal(model.contextualEffects.some(x=>x.target==='bound_pokemon'&&x.note==='The target gains +2 Accuracy.'),true,'external compiled effects retain target context');
  const before=JSON.stringify(trainer);
  const targetEffects=engine.resolveBoundFeatureEffects({trainer,rulesetId:'test',targetId:'p1',getDefinition});
  assert.equal(targetEffects.length,1,'bound external effect is resolved for its selected Pokémon');
  assert.equal(targetEffects[0].id,'test-external-effect');
  assert.equal(targetEffects[0].binding.targetText,'Your Pokémon');
  assert.equal(targetEffects[0].compiledEffects[0].value,2);
  assert.equal(engine.resolveBoundFeatureEffects({trainer,rulesetId:'test',targetId:'p2',getDefinition}).length,0,'Bound Feature effect does not leak to a different Pokémon');
  assert.equal(JSON.stringify(trainer),before,'target effect resolution does not mutate saved Trainer data');
  trainer.details.features[0].bound=false;
  assert.equal(engine.resolveBoundFeatureEffects({trainer,rulesetId:'test',targetId:'p1',getDefinition}).length,0,'unbound Feature has no target combat effect');
  trainer=trainerFixture([{id:'type-ace',name:'Type Ace',selections:{type:'Dark',typeLinkedSkill:'Guile'}},{id:'sneak-attack',name:'Sneak Attack',bound:true,boundTargetIds:['dark-1']}]);
  const sneak=engine.resolveBoundFeatureEffects({trainer,rulesetId:'test',targetId:'dark-1',targetTypes:['Dark'],getDefinition})[0];
  assert.equal(sneak.targetEligible,true,'Dark target meets the active Feature target requirement');
  assert.equal(sneak.combatModifiers.find(x=>x.targetPath==='combat.accuracy')?.value,2);
  assert.equal(sneak.typeLinkedSkill,'Guile');
  assert.equal(sneak.combatModifiers.find(x=>x.targetPath==='combat.damage_bonus')?.value,2,'Sneak Attack adds the selected Type-Linked Skill Rank to Damage Rolls');
  assert.equal(sneak.combatModifiers.find(x=>x.targetPath==='combat.accuracy')?.conditional,true,'source condition is retained for per-attack confirmation');
  const wrongType=engine.resolveBoundFeatureEffects({trainer,rulesetId:'test',targetId:'dark-1',targetTypes:['Fire'],getDefinition})[0];
  assert.equal(wrongType.targetEligible,false,'target-restricted mechanics stay inactive for the wrong type');
  assert.equal(wrongType.combatModifiers.some(x=>x.active),false);
  trainer.details.features[0].selections={type:'Dark'};
  const legacySneak=engine.resolveBoundFeatureEffects({trainer,rulesetId:'test',targetId:'dark-1',targetTypes:['Dark'],getDefinition})[0];
  assert.equal(legacySneak.typeLinkedSkillMissing,true,'legacy Type Ace records without a linked skill remain visibly unresolved');
  assert.equal(legacySneak.combatModifiers.some(x=>x.targetPath==='combat.damage_bonus'),false,'missing skill choice never guesses a Sneak Attack damage bonus');
  trainer=trainerFixture([{id:'capricious-whirl',name:'Capricious Whirl',bound:true,boundTargetIds:['p1']}]);
  const capricious=engine.resolveBoundFeatureEffects({trainer,rulesetId:'test',targetId:'p1',getDefinition})[0];
  assert.equal(capricious.combatModifiers.find(x=>x.targetPath==='combat.evasion')?.value,3);
  assert.equal(capricious.combatModifiers.find(x=>x.targetPath==='combat.damage_bonus')?.value,-5);
  for(const [id,expected] of [
    ['pinpoint-strike',[['combat.accuracy',2],['combat.effect_range',2],['combat.damage_bonus',-5]]],
    ['trick-shot',[['combat.accuracy',-2],['combat.critical_range',3]]],
    ['reckless-advance',[['combat.damage_bonus',8],['combat.trip_on_accuracy',18]]]
  ]){
    trainer=trainerFixture([{id,name:id,bound:true,boundTargetIds:['p1']}]);
    const resolved=engine.resolveBoundFeatureEffects({trainer,rulesetId:'test',targetId:'p1',getDefinition})[0];
    for(const [path,value] of expected)assert.equal(resolved.combatModifiers.find(x=>x.targetPath===path)?.value,value,`${id} resolves ${path} from the active feature text`);
  }
}

const helper=/function trainerFeatureBoundTargets\(feature\)\{[^\r\n]+\}|function trainerFeatureBindingCost\(binding,feature\)\{[^\r\n]+\}|function trainerFeatureTargetOptions\(binding,feature\)\{[^\r\n]+\}|function trainerFeatureTargetLabel\(id\)\{[^\r\n]+\}|async function toggleTrainerFeatureBinding\(index,targetId=null\)\{[^\r\n]+\}|function releaseTrainerStratagems\(\)\{[^\r\n]+\}/g;
for(const path of ['static-preview/app.js','../PTU_Companion_Android_Tauri/www/app.js']){
  const app=readFileSync(join(root,path),'utf8');
  const typeSkillMap=app.match(/const TYPE_LINKED_SKILLS=\{[^\r\n]+\};/);
  assert.ok(typeSkillMap,`${path} exposes the Type-Linked Skill choices`);
  const linkedSkills=runInNewContext(`(()=>{${typeSkillMap[0]}; return TYPE_LINKED_SKILLS})()`);
  assert.equal(JSON.stringify(linkedSkills.dark),JSON.stringify(['Guile','Stealth']),`${path} offers the Core Dark Type skill choices`);
  assert.ok(app.includes('values.typeLinkedSkill=linked.typeLinkedSkill'),`${path} persists the selected Type-Linked Skill`);
  assert.ok(app.includes('trainerDefinitionSelections(kind,def,rankNumber,item.selections||{})'),`${path} preserves Type Ace selection while editing`);
  assert.ok(app.includes('pokemonCombatBoundFeatureRollFields(data,row)'),`${path} asks for conditions before applying contextual modifiers`);
  assert.ok(app.includes('Bound Accuracy ${boundAccuracyBonus>0?\'+\':\'\'}${boundAccuracyBonus}'),`${path} records applied Accuracy modifiers`);
  assert.ok(app.includes('Bound Features ${damage.boundBonus>0?\'+\':\'\'}${damage.boundBonus}'),`${path} includes Bound damage modifiers in the combat log`);
  const combatModifierMatch=app.match(/function pokemonCombatBoundFeatureModifiers\(data,row,conditionChoices=\{\}\)\{[\s\S]*?(?=\nasync function pokemonCombatOpenMove)/);
  assert.ok(combatModifierMatch,`${path} exposes the combat modifier resolver`);
  const combatModifiers=runInNewContext(`(()=>{${combatModifierMatch[0]}; return pokemonCombatBoundFeatureModifiers})()`);
  const boundData={boundFeatureEffects:[{id:'sneak-attack',name:'Sneak Attack',recordIndex:0,targetEligible:true,combatModifiers:[{targetPath:'combat.accuracy',value:2,conditional:true,moveFilter:'any',active:true}]},{id:'capricious-whirl',name:'Capricious Whirl',recordIndex:1,targetEligible:true,combatModifiers:[{targetPath:'combat.evasion',value:3,conditional:false,moveFilter:'any',active:true},{targetPath:'combat.damage_bonus',value:-5,conditional:false,moveFilter:'damaging',active:true}]}]};
  assert.equal(combatModifiers(boundData,{definition:{category:'physical',range:'Melee'},resolvedDamage:{}},{0:false}).some(x=>x.targetPath==='combat.accuracy'),false,`${path} skips an unconfirmed conditional effect`);
  const applied=combatModifiers(boundData,{definition:{category:'physical',range:'Melee'},resolvedDamage:{}},{0:true});
  assert.equal(applied.find(x=>x.targetPath==='combat.accuracy')?.value,2,`${path} applies confirmed accuracy bonuses`);
  assert.equal(applied.find(x=>x.targetPath==='combat.damage_bonus')?.value,-5,`${path} applies unconditional damage modifiers`);
  const statusMove=combatModifiers(boundData,{definition:{category:'status',range:'Ranged'},resolvedDamage:null},{0:false});
  assert.equal(statusMove.some(x=>x.targetPath==='combat.damage_bonus'),false,`${path} filters damage-only modifiers from status Moves`);
  const trickData={boundFeatureEffects:[{id:'trick-shot',name:'Trick Shot',recordIndex:2,targetEligible:true,combatModifiers:[{targetPath:'combat.accuracy',value:-2,conditional:false,moveFilter:'damaging-ranged-ac',active:true},{targetPath:'combat.critical_range',value:3,conditional:false,moveFilter:'damaging-ranged-ac',active:true}]},{id:'reckless-advance',name:'Reckless Advance',recordIndex:3,targetEligible:true,combatModifiers:[{targetPath:'combat.trip_on_accuracy',value:18,conditional:false,moveFilter:'damaging-melee',active:true}]}]};
  assert.equal(combatModifiers(trickData,{definition:{category:'physical',range:'Ranged',ac:null},resolvedDamage:{}},{}).length,0,`${path} honors Trick Shot's no-AC exclusion`);
  const trickApplied=combatModifiers(trickData,{definition:{category:'physical',range:'Ranged',ac:4},resolvedDamage:{}},{});
  assert.equal(trickApplied.length,2,`${path} applies accuracy and critical range to an AC ranged attack`);
  assert.equal(trickApplied.find(effect=>effect.targetPath==='combat.critical_range')?.value,3,`${path} carries Trick Shot critical range to the attack`);
  const melee=combatModifiers(trickData,{definition:{category:'physical',range:'Melee',ac:4},resolvedDamage:{}},{});
  assert.equal(melee.find(effect=>effect.targetPath==='combat.trip_on_accuracy')?.value,18,`${path} carries Reckless Advance trip threshold to melee`);
  assert.equal(combatModifiers(trickData,{definition:{category:'physical',range:'Ranged',ac:4},resolvedDamage:{}},{}).some(effect=>effect.targetPath==='combat.trip_on_accuracy'),false,`${path} excludes Trip from ranged attacks`);
  assert.ok(app.includes('Bound Critical Hit Range +${criticalBonus}'),`${path} surfaces the effective critical-range bonus before the roll`);
  assert.ok(app.includes('natural>=effect.threshold'),`${path} checks Reckless Advance against the physical natural d20`);
  assert.ok(app.includes('Bound Trip ${tripResults.length?'),`${path} records the Trip outcome without mutating an abstract target`);
  for(const token of ['function trainerFeatureBinding(index)','function trainerFeatureBindingControls','Bind another target','Stratagem Features can only be Bound during combat.','A Stratagem target must be in the active combat.','releaseTrainerStratagems();','boundApCostEach=cost'])assert.ok(app.includes(token),`${path} is missing ${token}`);
  const functions=[...app.matchAll(helper)].map(x=>x[0]);
  assert.equal(functions.length,6,`${path} exposes the shared bind/AP helpers`);
  const code=functions.join('\n');
  const picked=[];const toasts=[];const snapshots=[];
  const trainer=trainerFixture([{id:'test-stratagem',name:'Test Stratagem'},{id:'test-stratagem-2',name:'Second Stratagem'}]);trainer.details.currentAp=5;
  const state={ui:{combat:{active:true,participantIds:['p1','p2']}}};
  const derive=()=>{const boundAp=trainer.details.features.reduce((n,f)=>n+(f.bound?(Array.isArray(f.boundTargetIds)?f.boundTargetIds.length:1)*2:0),0);return {maxAp:6,boundAp,availableMaxAp:Math.max(0,6-boundAp)};};
  const globals={trainer:()=>trainer,trainerData:trainer,state,ensureTrainerDetails:()=>trainer.details,trainerResolved:()=>({derived:derive(),sourceSummary:trainer.details.features.map((f,recordIndex)=>({kind:'feature',recordIndex,id:f.id||'test-stratagem',bound:!!f.bound,binding:{apCost:2,perRank:false,action:'Standard Action',unbindAction:'Free Action',targetText:'Your Pokémon',stratagem:true}}))}),trainerFeatureBinding:null,trainerDerived:derive,trainerMaxAp:()=>6,trainerBoundAp:()=>derive().boundAp,pokemon:id=>({id,name:`Pokémon ${id}`}),ensurePokemonCombatUi:()=>state.ui.combat,styledForm:async()=>({targetId:picked.shift()}),toast:message=>{toasts.push(message);return false;},commit:message=>{snapshots.push(JSON.parse(JSON.stringify(trainer)));return message;},esc:value=>String(value),chip:value=>String(value),picked,toasts,snapshots};
  globals.trainerFeatureBinding=index=>globals.trainerResolved().sourceSummary.find(x=>x.recordIndex===index)?.binding||null;
  const context=runInNewContext(`(async()=>{${code};picked.push('p1');await toggleTrainerFeatureBinding(0);assert.equal(trainerData.details.currentAp,3);assert.equal(JSON.stringify(trainerData.details.features[0].boundTargetIds),'["p1"]');assert.equal(JSON.stringify(snapshots.at(-1).details.features[0].boundTargetIds),'["p1"]');picked.push('p2');await toggleTrainerFeatureBinding(0);assert.equal(trainerData.details.currentAp,1);assert.equal(JSON.stringify(trainerData.details.features[0].boundTargetIds),'["p1","p2"]');picked.push('p1');await toggleTrainerFeatureBinding(1);assert.match(toasts.at(-1),/already has a Bound Stratagem/);assert.equal(trainerData.details.currentAp,1);releaseTrainerStratagems();assert.equal(trainerData.details.currentAp,5);assert.equal(trainerData.details.features[0].bound,false);state.ui.combat.active=false;picked.push('p1');await toggleTrainerFeatureBinding(0);assert.match(toasts.at(-1),/only be Bound during combat/);assert.equal(trainerData.details.currentAp,5);})()`,{...globals,assert});
  await context;
}
let incomingResolver=null;
for(const path of ['static-preview/app.js','../PTU_Companion_Android_Tauri/www/app.js']){
  const app=readFileSync(join(root,path),'utf8');
  const match=app.match(/function pokemonCombatIncomingAttackResolution\([\s\S]*?\n(?=async function pokemonCombatRecordIncomingAttack)/);
  assert.ok(match,`${path} exposes incoming attack resolution`);
  const code=match[0].trim();
  if(incomingResolver!==null)assert.equal(code,incomingResolver,'Windows and Android incoming attack calculations match');
  incomingResolver=code;
  const resolve=runInNewContext(`(()=>{${code};return pokemonCombatIncomingAttackResolution})()`);
  assert.deepEqual({...resolve({accuracyRoll:11,baseAc:6,evasion:5,rawDamage:20,defense:7,damageReduction:5,multiplier:1.5})},{hit:true,accuracyCheck:11,afterDefense:8,damage:12},`${path} applies Evasion, Defense, DR, then type effectiveness`);
  assert.equal(resolve({accuracyRoll:10,baseAc:6,evasion:5,rawDamage:20,defense:7,damageReduction:5,multiplier:1.5}).hit,false,`${path} rejects a roll below the Evasion-adjusted AC`);
  assert.equal(resolve({baseAc:null,evasion:0,rawDamage:20,defense:7,damageReduction:5,multiplier:0,hasAccuracyCheck:false}).damage,0,`${path} applies immunity after defense`);
  assert.ok(app.includes('function pokemonCombatIncomingClassChanged()'),`${path} selects the matching Evasion and Defense`);
  assert.ok(app.includes('pokemonCombatLog(id,resolved.hit?'),`${path} records incoming attack results`);
  assert.ok(app.includes('applyPokemonFormGameEventUi(id,{kind:\'hp-adjust\',delta:-resolved.damage}'),`${path} persists HP damage through form-aware history`);
}
console.log('Issue #69: Bind/AP, incoming Evasion/Defense/DR/effectiveness, persistence hook, and Windows/Android parity verified.');
