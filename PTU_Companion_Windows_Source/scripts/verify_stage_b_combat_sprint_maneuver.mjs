import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const repo=resolve(root,'..');
const appPaths=[join(root,'static-preview','app.js'),join(repo,'PTU_Companion_Android_Tauri','www','app.js')];
const sprintJson=join(repo,'docs','data','PTU_COMBAT_SPRINT_MANEUVER.json');
const sprintMd=join(repo,'docs','PTU_COMBAT_SPRINT_MANEUVER.md');
const abilityJson=join(repo,'docs','data','PTU_COMBAT_ABILITY_ACTIONS.json');
const sessionJson=join(repo,'docs','data','PTU_COMBAT_SESSION_LEDGER.json');
const sessionMd=join(repo,'docs','PTU_COMBAT_SESSION_LEDGER.md');

function extractFunction(src,name){
  const match=new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);if(!match)throw new Error(`Missing function ${name}`);
  const start=match.index,tail=src.slice(start+1),next=/\n(?:(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(|const\s+POKEMON_COMBAT_[A-Z0-9_]+\s*=)/.exec(tail),end=next?start+1+next.index:src.length;return src.slice(start,end).trim();
}

const sprintFunctions=['pokemonCombatSprintManeuverResourceSpec','pokemonCombatSprintAbilityResourceSpec','pokemonCombatSprintAbilityRow','pokemonCombatSprintAbilitySourceMatches','pokemonCombatSprintCompositeAvailability','pokemonCombatSprintSpendResources','pokemonCombatUseSprintManeuver','pokemonCombatSprintManeuverPanel'];
const sources=[];
for(const path of appPaths){
  const src=await readFile(path,'utf8');sources.push(src);
  for(const needle of [
    'function pokemonCombatSprintManeuverResourceSpec',
    "pokemonCombatNonMoveSpec('maneuver','sprint','Sprint Maneuver','Standard Action','At-Will')",
    "pokemonCombatNonMoveSpec('ability','combat-sprint','Sprint Ability','Swift Action','Scene')",
    'The Standard Action is reserved for the Sprint Maneuver and cannot also convert into this Swift Action.',
    'Sprint + Ability · Standard + Swift · Scene',
    "section('MANEUVERS'",
    "pokemonCombatApplyCombatStages(id,{speed:2},'Sprint Ability')",
    'Movement Speeds +50% for the rest of this turn.',
  ])assert.ok(src.includes(needle),`${path} missing ${needle}`);
  for(const name of sprintFunctions){const code=extractFunction(src,name);assert.ok(!code.includes('Math.random('),`${path} ${name} must not use Math.random`);assert.ok(!code.includes('pokemonCombatRandomInt('),`${path} ${name} must not generate dice`);assert.ok(!code.includes('pokemonCombatRollDiceExpression('),`${path} ${name} must not generate dice`);}
}
for(const name of sprintFunctions)assert.equal(extractFunction(sources[0],name),extractFunction(sources[1],name),`${name} diverged between Windows and Android`);

const ctx={console};vm.createContext(ctx);
ctx.state={ui:{round:1,scene:1,day:1}};
ctx.row={pokemonId:'p',turn:{round:1,used:{standard:false,shift:false,swift:false},conversions:[]},frequency:{sceneNumber:1,dayNumber:1,scene:{},day:{},eot:{}},resourceTransactions:[],resourceSequence:0};
ctx.pokemonCombatParticipant=(id,{create=true}={})=>id==='p'?ctx.row:null;
ctx.pokemonCombatLog=()=>null;
ctx.pkm={id:'p',name:'Testmon',combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}};
ctx.pokemon=id=>id==='p'?ctx.pkm:null;
for(const name of ['pokemonCombatSlug','pokemonCombatParseFrequency','pokemonCombatSyncBoundaries','pokemonCombatTurn','pokemonCombatCanSpendAction','pokemonCombatSpendAction','pokemonCombatFrequencyAvailability','pokemonCombatSpendFrequency'])vm.runInContext(extractFunction(sources[0],name),ctx);
vm.runInContext("const POKEMON_COMBAT_TRACKED_ACTION_COSTS=new Set(['Full Action','Standard Action','Shift Action','Swift Action','Free Action']);",ctx);
for(const name of ['pokemonCombatNonMoveSpec','pokemonCombatNonMoveResourceKey','pokemonCombatNonMoveAvailability','pokemonCombatActionDelta','pokemonCombatFrequencyValue','pokemonCombatRefundActionDelta','pokemonCombatSpendNonMoveResource','pokemonCombatRefundNonMoveResourceCore'])vm.runInContext(extractFunction(sources[0],name),ctx);
for(const name of ['pokemonCombatSprintManeuverResourceSpec','pokemonCombatSprintAbilityResourceSpec','pokemonCombatSprintAbilityRow','pokemonCombatSprintAbilitySourceMatches','pokemonCombatSprintCompositeAvailability','pokemonCombatSprintSpendResources','pokemonCombatApplyCombatStages'])vm.runInContext(extractFunction(sources[0],name),ctx);

const sprintRow={name:'Sprint',definition:{trigger:'The user uses the Sprint Action during Combat',effect:"The user gains +2 Speed Combat Stages. Additionally, the user’s Overland Speed is always increased by +2."}};
const data={abilities:[sprintRow]};
assert.equal(ctx.pokemonCombatSprintAbilitySourceMatches(sprintRow),true);
assert.equal(ctx.pokemonCombatSprintAbilitySourceMatches({name:'Sprint',definition:{effect:'Changed content-pack effect.'}}),false);
assert.equal(ctx.pokemonCombatSprintAbilityRow(data),sprintRow);
assert.notEqual(ctx.pokemonCombatNonMoveResourceKey(ctx.pokemonCombatSprintManeuverResourceSpec()),ctx.pokemonCombatNonMoveResourceKey(ctx.pokemonCombatSprintAbilityResourceSpec()),'Maneuver and Ability must have separate namespaced keys');

function fresh({round=1,scene=1,day=1,standard=false,shift=false,swift=false}={}){ctx.state.ui={round,scene,day};ctx.row.turn={round,used:{standard,shift,swift},conversions:[]};ctx.row.frequency={sceneNumber:scene,dayNumber:day,scene:{},day:{},eot:{}};ctx.row.resourceTransactions=[];ctx.row.resourceSequence=0;ctx.pkm.combatStages={attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0};}

fresh();let spend=ctx.pokemonCombatSprintSpendResources('p',data,{withAbility:false,log:false});assert.equal(spend.valid,true);assert.equal(ctx.row.turn.used.standard,true);assert.equal(ctx.row.turn.used.swift,false);assert.equal(spend.transactions.length,1);assert.equal(spend.transactions[0].sourceKind,'maneuver');

fresh();spend=ctx.pokemonCombatSprintSpendResources('p',data,{withAbility:true,log:false});assert.equal(spend.valid,true);assert.equal(ctx.row.turn.used.standard,true);assert.equal(ctx.row.turn.used.swift,true);assert.equal(ctx.row.frequency.scene['nonmove:ability:combat-sprint'],1);assert.equal(spend.transactions.length,2);assert.equal(spend.transactions[0].compositeId,spend.transactions[1].compositeId);assert.equal(spend.transactions[0].compositeRole,'maneuver');assert.equal(spend.transactions[1].compositeRole,'ability');assert.notEqual(spend.transactions[0].key,spend.transactions[1].key);

fresh({swift:true});let check=ctx.pokemonCombatSprintCompositeAvailability('p',data,{withAbility:true});assert.equal(check.valid,false);assert.match(check.reason,/Standard Action is reserved/i);assert.equal(ctx.pokemonCombatSprintCompositeAvailability('p',data,{withAbility:false}).valid,true,'plain Sprint must remain usable when only Swift is spent');
fresh({standard:true});assert.equal(ctx.pokemonCombatSprintCompositeAvailability('p',data,{withAbility:false}).valid,false,'Sprint Maneuver needs Standard Action');assert.equal(ctx.pokemonCombatSprintCompositeAvailability('p',data,{withAbility:true}).valid,false,'composite Sprint also needs Standard Action');

fresh({round:4,scene:3,day:1});spend=ctx.pokemonCombatSprintSpendResources('p',data,{withAbility:true,log:false});assert.equal(spend.valid,true);ctx.state.ui.round=5;ctx.row.turn={round:5,used:{standard:false,shift:false,swift:false},conversions:[]};check=ctx.pokemonCombatSprintCompositeAvailability('p',data,{withAbility:true});assert.equal(check.valid,false);assert.match(check.reason,/exhausted for this Scene/i);assert.equal(ctx.pokemonCombatSprintCompositeAvailability('p',data,{withAbility:false}).valid,true,'plain Maneuver must remain available after Ability Scene use');ctx.state.ui.scene=4;assert.equal(ctx.pokemonCombatSprintCompositeAvailability('p',data,{withAbility:true}).valid,true,'Scene boundary must restore Sprint Ability');

fresh();spend=ctx.pokemonCombatSprintSpendResources('p',data,{withAbility:true,log:false});const maneuverTx=spend.maneuverSpend.transaction,abilityTx=spend.abilitySpend.transaction;let refund=ctx.pokemonCombatRefundNonMoveResourceCore('p',abilityTx.id,{log:false});assert.equal(refund.valid,true);assert.equal(ctx.row.turn.used.swift,false);assert.equal(ctx.row.turn.used.standard,true,'Ability refund must not refund Maneuver Standard Action');assert.equal(ctx.row.frequency.scene['nonmove:ability:combat-sprint'],0);refund=ctx.pokemonCombatRefundNonMoveResourceCore('p',maneuverTx.id,{log:false});assert.equal(refund.valid,true);assert.equal(ctx.row.turn.used.standard,false,'Maneuver refund restores only its Standard Action');

ctx.pkm.combatStages.speed=5;const stages=ctx.pokemonCombatApplyCombatStages('p',{speed:2},'Sprint Ability');assert.equal(ctx.pkm.combatStages.speed,6);assert.equal(stages.changes.speed.applied,1,'Sprint Ability must respect +6 Combat Stage cap');

const doc=JSON.parse(await readFile(sprintJson,'utf8'));assert.equal(doc.schema_version,1);assert.equal(doc.shared_non_move_resource_ledger,true);assert.equal(doc.physical_dice_only,true);assert.equal(doc.maneuver.action_cost,'Standard Action');assert.equal(doc.ability.frequency,'Scene');assert.equal(doc.ability.action_cost,'Swift Action');assert.match(doc.ability.triggered_effect,/\+2 Speed Combat Stages/);assert.match(doc.composite_policy.standard_to_swift_conversion,/not allowed/i);
const md=await readFile(sprintMd,'utf8');assert.match(md,/Standard Action/);assert.match(md,/Scene – Swift Action/);assert.match(md,/\+2 Speed Combat Stages/);assert.match(md,/Standard → Swift conversion.*unavailable/i);assert.match(md,/resource-only|resources only|restores resources only/i);
const ability=JSON.parse(await readFile(abilityJson,'utf8'));assert.match(ability.deferred_conflicting_or_composite.sprint,/integrated.*Standard Action.*Swift Action/i);
const session=JSON.parse(await readFile(sessionJson,'utf8'));assert.ok(session.shared_resources.non_move_sources.kinds.includes('Maneuver'));assert.ok(session.ability_action_automation.composite_integrations.includes('Sprint'));assert.ok(!session.ability_action_automation.deferred_composite.includes('Sprint'));assert.ok(session.maneuver_automation.enabled_subset.includes('Sprint'));assert.equal(session.maneuver_automation.standard_to_swift_during_composite,false);
const sessionText=await readFile(sessionMd,'utf8');assert.match(sessionText,/first composite Maneuver \+ Ability integration/i);assert.match(sessionText,/Standard Action.*Scene – Swift Action/i);

console.log(JSON.stringify({combatSprintModel:1,maneuver:'Sprint',maneuverAction:'Standard Action',abilityFrequency:'Scene',abilityAction:'Swift Action',speedCombatStages:2,standardToSwiftComposite:false,resourceTransactionsSeparated:true,resourceRefund:true,sceneReset:true,physicalDiceOnly:true,abstractTarget:true,windowsAndroidParity:true},null,2));
