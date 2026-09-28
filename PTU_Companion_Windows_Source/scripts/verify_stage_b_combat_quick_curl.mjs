import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const repo=resolve(root,'..');
const appPaths=[join(root,'static-preview','app.js'),join(repo,'PTU_Companion_Android_Tauri','www','app.js')];
const docJson=join(repo,'docs','data','PTU_COMBAT_QUICK_CURL.json');
const docMd=join(repo,'docs','PTU_COMBAT_QUICK_CURL.md');
const abilityJson=join(repo,'docs','data','PTU_COMBAT_ABILITY_ACTIONS.json');
const sessionJson=join(repo,'docs','data','PTU_COMBAT_SESSION_LEDGER.json');
const sessionMd=join(repo,'docs','PTU_COMBAT_SESSION_LEDGER.md');

function extractFunction(src,name){
  const match=new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);if(!match)throw new Error(`Missing function ${name}`);
  const start=match.index,tail=src.slice(start+1),next=/\n(?:(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(|const\s+POKEMON_COMBAT_[A-Z0-9_]+\s*=)/.exec(tail),end=next?start+1+next.index:src.length;return src.slice(start,end).trim();
}

const quickFunctions=['pokemonCombatQuickCurlAbilityResourceSpec','pokemonCombatQuickCurlDefenseResourceSpec','pokemonCombatQuickCurlAbilityRow','pokemonCombatQuickCurlDefenseMoveRow','pokemonCombatQuickCurlAbilitySourceMatches','pokemonCombatQuickCurlDefenseSourceMatches','pokemonCombatQuickCurlAvailability','pokemonCombatQuickCurlSpendResources','pokemonCombatUseQuickCurlDefenseCurl','pokemonCombatQuickCurlPanel'];
const sources=[];
for(const path of appPaths){
  const src=await readFile(path,'utf8');sources.push(src);
  for(const needle of [
    'function pokemonCombatQuickCurlAbilityResourceSpec',
    "pokemonCombatNonMoveSpec('ability','combat-quick-curl','Quick Curl','Free Action','Scene')",
    "pokemonCombatNonMoveSpec('move','defense-curl-quick-curl','Defense Curl via Quick Curl','Swift Action','At-Will')",
    'Quick Curl + Defense Curl · Scene Free + Swift',
    "section('QUICK CURL · DEFENSE CURL'",
    'ledger.conditions.curledUp=true',
    'pokemonCombatDispatchMoveFormEvent(id,spent.moveRow)',
    "if(pokemonCombatSlug(name)==='defense-curl')",
  ])assert.ok(src.includes(needle),`${path} missing ${needle}`);
  const normal=extractFunction(src,'pokemonCombatUseNoRoll');assert.ok(normal.includes("pokemonCombatSlug(name)==='defense-curl'"),`${path} ordinary Defense Curl path was not preserved`);assert.ok(normal.includes('pokemonCombatSpendAction(id,available.action)'),`${path} ordinary Defense Curl must keep normal Move action spending`);
  for(const name of quickFunctions){const code=extractFunction(src,name);assert.ok(!code.includes('Math.random('),`${path} ${name} must not use Math.random`);assert.ok(!code.includes('pokemonCombatRandomInt('),`${path} ${name} must not generate dice`);assert.ok(!code.includes('pokemonCombatRollDiceExpression('),`${path} ${name} must not generate dice`);}
}
for(const name of quickFunctions)assert.equal(extractFunction(sources[0],name),extractFunction(sources[1],name),`${name} diverged between Windows and Android`);

const ctx={console};vm.createContext(ctx);
ctx.state={ui:{round:1,scene:1,day:1}};
ctx.row={pokemonId:'p',turn:{round:1,used:{standard:false,shift:false,swift:false},conversions:[]},frequency:{sceneNumber:1,dayNumber:1,scene:{},day:{},eot:{}},resourceTransactions:[],resourceSequence:0,moveState:{rollout:{active:false}},conditions:{curledUp:false},log:[]};
ctx.pokemonCombatParticipant=(id,{create=true}={})=>id==='p'?ctx.row:null;
ctx.pokemonCombatLog=()=>null;
for(const name of ['pokemonCombatSlug','pokemonCombatParseFrequency','pokemonCombatSyncBoundaries','pokemonCombatTurn','pokemonCombatCanSpendAction','pokemonCombatSpendAction','pokemonCombatFrequencyKey','pokemonCombatFrequencyAvailability','pokemonCombatSpendFrequency','pokemonCombatActionCostForMove','pokemonCombatMoveAvailability'])vm.runInContext(extractFunction(sources[0],name),ctx);
vm.runInContext("const POKEMON_COMBAT_TRACKED_ACTION_COSTS=new Set(['Full Action','Standard Action','Shift Action','Swift Action','Free Action']);",ctx);
for(const name of ['pokemonCombatNonMoveSpec','pokemonCombatNonMoveResourceKey','pokemonCombatNonMoveAvailability','pokemonCombatActionDelta','pokemonCombatFrequencyValue','pokemonCombatRefundActionDelta','pokemonCombatSpendNonMoveResource','pokemonCombatRefundNonMoveResourceCore'])vm.runInContext(extractFunction(sources[0],name),ctx);
for(const name of ['pokemonCombatQuickCurlAbilityResourceSpec','pokemonCombatQuickCurlDefenseResourceSpec','pokemonCombatQuickCurlAbilityRow','pokemonCombatQuickCurlDefenseMoveRow','pokemonCombatQuickCurlAbilitySourceMatches','pokemonCombatQuickCurlDefenseSourceMatches','pokemonCombatQuickCurlAvailability','pokemonCombatQuickCurlSpendResources'])vm.runInContext(extractFunction(sources[0],name),ctx);

const quickRow={name:'Quick Curl',definition:{name:'Quick Curl',effect:'Connection - Defense Curl. The user may activate this Ability to use Defense Curl as a Swift Action.'}};
const defenseRow={definition:{id:'defense-curl',name:'Defense Curl',frequency:'At-Will',ac:null,class:'Status',range:'Self',effect:'The user becomes Curled Up. While Curled Up, the user becomes immune to Critical Hits and gains 10 Damage Reduction. However, while Curled Up, the user is Slowed and their Accuracy is lowered by -4. The user may stop being Curled Up as a Swift Action. If the user has Rollout or Ice Ball in their Move List, they do not become Slowed while Curled Up. Furthermore, when using the Moves Rollout or Ice Ball while Curled Up, the user gains a +10 bonus to the damage rolls of those Moves and does not suffer Accuracy Penalties from being Curled Up.'}};
const data={abilities:[quickRow],moves:[defenseRow]};
assert.equal(ctx.pokemonCombatQuickCurlAbilitySourceMatches(quickRow),true);
assert.equal(ctx.pokemonCombatQuickCurlDefenseSourceMatches(defenseRow),true);
assert.equal(ctx.pokemonCombatQuickCurlAbilitySourceMatches({name:'Quick Curl',definition:{effect:'Changed content-pack effect.'}}),false,'changed Quick Curl source must disable automation');
assert.equal(ctx.pokemonCombatQuickCurlDefenseSourceMatches({definition:{name:'Defense Curl',frequency:'Scene',range:'Self',effect:defenseRow.definition.effect}}),false,'changed Defense Curl frequency must disable automation');
assert.equal(ctx.pokemonCombatQuickCurlAbilityRow(data),quickRow);assert.equal(ctx.pokemonCombatQuickCurlDefenseMoveRow(data),defenseRow);
assert.notEqual(ctx.pokemonCombatNonMoveResourceKey(ctx.pokemonCombatQuickCurlAbilityResourceSpec()),ctx.pokemonCombatNonMoveResourceKey(ctx.pokemonCombatQuickCurlDefenseResourceSpec()),'Quick Curl Ability and overridden Move action need separate source keys');

function fresh({round=1,scene=1,day=1,standard=false,shift=false,swift=false}={}){ctx.state.ui={round,scene,day};ctx.row.turn={round,used:{standard,shift,swift},conversions:[]};ctx.row.frequency={sceneNumber:scene,dayNumber:day,scene:{},day:{},eot:{}};ctx.row.resourceTransactions=[];ctx.row.resourceSequence=0;ctx.row.moveState={rollout:{active:false}};ctx.row.conditions={curledUp:false};}

fresh();let spend=ctx.pokemonCombatQuickCurlSpendResources('p',data,{log:false});assert.equal(spend.valid,true);assert.equal(ctx.row.turn.used.swift,true);assert.equal(ctx.row.turn.used.standard,false,'Swift-available Quick Curl must not spend ordinary Defense Curl Standard Action');assert.equal(ctx.row.frequency.scene['nonmove:ability:combat-quick-curl'],1);assert.equal(spend.transactions.length,2);assert.equal(spend.transactions[0].compositeId,spend.transactions[1].compositeId);assert.equal(spend.transactions[0].compositeRole,'ability');assert.equal(spend.transactions[1].compositeRole,'move');assert.equal(ctx.pokemonCombatQuickCurlSpendResources('p',data,{log:false}).valid,false,'Quick Curl Scene resource must not double-spend');
let normal=ctx.pokemonCombatMoveAvailability('p',defenseRow);assert.equal(normal.valid,true,'ordinary Defense Curl must remain available when its Standard Action is still free');assert.equal(normal.action,'Standard Action');

fresh({round:2,scene:2,swift:true});spend=ctx.pokemonCombatQuickCurlSpendResources('p',data,{log:false});assert.equal(spend.valid,true,'Standard → Swift must remain available when Swift is spent and Standard is free');assert.equal(ctx.row.turn.used.swift,true);assert.equal(ctx.row.turn.used.standard,true);assert.ok(ctx.row.turn.conversions.includes('Standard → Swift'));assert.equal(spend.defenseSpend.action.spent,'Standard Action → Swift Action');

fresh({round:3,scene:3,standard:true,swift:true});let check=ctx.pokemonCombatQuickCurlAvailability('p',data);assert.equal(check.valid,false);assert.match(check.reason,/Swift Action already spent.*Standard Action is unavailable/i);spend=ctx.pokemonCombatQuickCurlSpendResources('p',data,{log:false});assert.equal(spend.valid,false);assert.equal(ctx.row.frequency.scene['nonmove:ability:combat-quick-curl'],undefined,'failed composite availability must not spend Quick Curl Scene use');

fresh({round:4,scene:4});spend=ctx.pokemonCombatQuickCurlSpendResources('p',data,{log:false});assert.equal(spend.valid,true);ctx.state.ui.round=5;ctx.row.turn={round:5,used:{standard:false,shift:false,swift:false},conversions:[]};check=ctx.pokemonCombatQuickCurlAvailability('p',data);assert.equal(check.valid,false);assert.match(check.reason,/exhausted for this Scene/i);ctx.state.ui.scene=5;assert.equal(ctx.pokemonCombatQuickCurlAvailability('p',data).valid,true,'Scene boundary must restore Quick Curl');

fresh({round:6,scene:6});spend=ctx.pokemonCombatQuickCurlSpendResources('p',data,{log:false});const abilityTx=spend.abilitySpend.transaction,moveTx=spend.defenseSpend.transaction;let refund=ctx.pokemonCombatRefundNonMoveResourceCore('p',abilityTx.id,{log:false});assert.equal(refund.valid,true);assert.equal(ctx.row.frequency.scene['nonmove:ability:combat-quick-curl'],0);assert.equal(ctx.row.turn.used.swift,true,'Ability refund must not refund the overridden Move Swift Action');refund=ctx.pokemonCombatRefundNonMoveResourceCore('p',moveTx.id,{log:false});assert.equal(refund.valid,true);assert.equal(ctx.row.turn.used.swift,false,'Move-action refund must restore only its Swift Action');

fresh({round:7,scene:7});ctx.row.moveState.rollout.active=true;check=ctx.pokemonCombatQuickCurlAvailability('p',data);assert.equal(check.valid,false);assert.match(check.reason,/Rollout is active/i,'Quick Curl must respect existing Rollout lock');

const doc=JSON.parse(await readFile(docJson,'utf8'));assert.equal(doc.schema_version,1);assert.equal(doc.shared_non_move_resource_ledger,true);assert.equal(doc.physical_dice_only,true);assert.equal(doc.ability.frequency,'Scene');assert.equal(doc.ability.action_cost,'Free Action');assert.equal(doc.move.frequency,'At-Will');assert.equal(doc.move.quick_curl_action_cost,'Swift Action');assert.match(doc.composite_policy.standard_to_swift,/allowed only/i);assert.match(doc.composite_policy.ordinary_defense_curl,/unchanged/i);assert.match(doc.composite_policy.refund,/never clears Curled Up/i);
const md=await readFile(docMd,'utf8');assert.match(md,/Scene – Free Action/);assert.match(md,/Defense Curl as a Swift Action/i);assert.match(md,/Standard → Swift/);assert.match(md,/ordinary Defense Curl.*unchanged/i);assert.match(md,/Undo.*never clears/i);
const ability=JSON.parse(await readFile(abilityJson,'utf8'));assert.equal(ability.composite_integrations.quick_curl_defense_curl.source_guard,true);
const session=JSON.parse(await readFile(sessionJson,'utf8'));assert.equal(session.composite_integrations.quick_curl_defense_curl.standard_to_swift_when_valid,true);assert.equal(session.composite_integrations.quick_curl_defense_curl.normal_move_path_preserved,true);assert.equal(session.composite_integrations.quick_curl_defense_curl.resource_only_refund,true);
const sessionText=await readFile(sessionMd,'utf8');assert.match(sessionText,/Quick Curl \+ Defense Curl composite/);assert.match(sessionText,/ordinary Defense Curl remains/i);

console.log(JSON.stringify({combatQuickCurlModel:1,ability:'Quick Curl',abilityCost:'Scene – Free Action',move:'Defense Curl',overrideAction:'Swift Action',standardToSwift:true,normalDefenseCurlPreserved:true,noDoubleSpend:true,sceneReset:true,independentRefund:true,rolloutLockPreserved:true,sourceSignatureGuard:true,physicalDiceOnly:true,abstractTarget:true,windowsAndroidParity:true},null,2));
