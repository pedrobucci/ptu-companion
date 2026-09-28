import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const repo=resolve(root,'..');
const appPaths=[join(root,'static-preview','app.js'),join(repo,'PTU_Companion_Android_Tauri','www','app.js')];
const docJson=join(repo,'docs','data','PTU_COMBAT_NON_MOVE_RESOURCES.json');
const docMd=join(repo,'docs','PTU_COMBAT_NON_MOVE_RESOURCES.md');
const sessionJson=join(repo,'docs','data','PTU_COMBAT_SESSION_LEDGER.json');
const sessionMd=join(repo,'docs','PTU_COMBAT_SESSION_LEDGER.md');

function extractFunction(src,name){
  const match=new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);if(!match)throw new Error(`Missing function ${name}`);
  const start=match.index,tail=src.slice(start+1),next=/\n(?:(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(|const\s+POKEMON_COMBAT_TRACKED_ACTION_COSTS\s*=)/.exec(tail),end=next?start+1+next.index:src.length;return src.slice(start,end).trim();
}

const parityNames=[
  'pokemonCombatNonMoveSpec','pokemonCombatAbilityResourceSpec','pokemonCombatFormActionResourceSpec','pokemonCombatCapabilityResourceSpec','pokemonCombatNonMoveResourceKey','pokemonCombatNonMoveAvailability','pokemonCombatActionDelta','pokemonCombatFrequencyValue','pokemonCombatRefundActionDelta','pokemonCombatSpendNonMoveResource','pokemonCombatRefundNonMoveResourceCore','pokemonCombatRefundNonMoveResource','pokemonCombatNonMoveTransactionRefundable','pokemonCombatNonMoveResourcePanel','pokemonCombatApplyNonMoveFormEvent','usePokemonNamedAbilityForForms','usePokemonAbilityForForms','usePokemonCapabilityForForms','usePokemonFormActionForForms','pokemonFormLifecycleControls'
];
const sources=[];
for(const path of appPaths){
  const src=await readFile(path,'utf8');sources.push(src);
  for(const needle of [
    "const POKEMON_COMBAT_TRACKED_ACTION_COSTS=new Set(['Full Action','Standard Action','Shift Action','Swift Action','Free Action'])",
    "pokemonCombatNonMoveSpec('ability','schooling','Schooling','Free Action','Daily')",
    "pokemonCombatNonMoveSpec('ability','power-construct','Power Construct','Swift Action','Daily')",
    "pokemonCombatNonMoveSpec('form','stance-change-full-action','Stance Change','Full Action','At-Will')",
    "pokemonCombatNonMoveSpec('ability','ice-face-hail-restore','Ice Face · Hail restore','Standard Action','At-Will')",
    "pokemonCombatNonMoveSpec('capability',mode==='relinquish'?'weapon-bond-relinquish':'weapon-bond','Weapon Bond','Extended Action','At-Will')",
    'function pokemonCombatSpendNonMoveResource',
    'function pokemonCombatRefundNonMoveResourceCore',
    'Recent Ability/Form resource spends',
    'Schooling · Daily Free Action',
    'Power Construct · Daily Swift Action',
    'Restore Ice Face · Standard Action · Hail',
    'Extended Actions remain source-labeled but are not converted into turn actions.',
    'pokemonCombatNonMoveResourcePanel(active.id)',
  ])assert.ok(src.includes(needle),`${path} missing ${needle}`);
  const apply=extractFunction(src,'pokemonCombatApplyNonMoveFormEvent');assert.ok(!apply.includes('Math.random('),`${path} non-Move source event must not use RNG`);
}
for(const name of parityNames)assert.equal(extractFunction(sources[0],name),extractFunction(sources[1],name),`${name} diverged between Windows and Android`);

const ctx={console};vm.createContext(ctx);
ctx.state={ui:{round:1,scene:1,day:1}};
ctx.row={pokemonId:'p',turn:{round:1,used:{standard:false,shift:false,swift:false},conversions:[]},frequency:{sceneNumber:1,dayNumber:1,scene:{},day:{},eot:{}},resourceTransactions:[],resourceSequence:0};
ctx.pokemonCombatParticipant=(id,{create=true}={})=>id==='p'?ctx.row:null;
ctx.pokemonCombatLog=()=>null;
for(const name of ['pokemonCombatSlug','pokemonCombatParseFrequency','pokemonCombatSyncBoundaries','pokemonCombatTurn','pokemonCombatCanSpendAction','pokemonCombatSpendAction','pokemonCombatFrequencyAvailability','pokemonCombatSpendFrequency'])vm.runInContext(extractFunction(sources[0],name),ctx);
vm.runInContext("const POKEMON_COMBAT_TRACKED_ACTION_COSTS=new Set(['Full Action','Standard Action','Shift Action','Swift Action','Free Action']);",ctx);
for(const name of ['pokemonCombatNonMoveSpec','pokemonCombatAbilityResourceSpec','pokemonCombatFormActionResourceSpec','pokemonCombatCapabilityResourceSpec','pokemonCombatNonMoveResourceKey','pokemonCombatNonMoveAvailability','pokemonCombatActionDelta','pokemonCombatFrequencyValue','pokemonCombatRefundActionDelta','pokemonCombatSpendNonMoveResource','pokemonCombatRefundNonMoveResourceCore','pokemonCombatNonMoveTransactionRefundable'])vm.runInContext(extractFunction(sources[0],name),ctx);

const schooling=ctx.pokemonCombatAbilityResourceSpec('Schooling');assert.equal(schooling.actionCost,'Free Action');assert.equal(schooling.frequency,'Daily');
const construct=ctx.pokemonCombatAbilityResourceSpec('Power Construct');assert.equal(construct.actionCost,'Swift Action');assert.equal(construct.frequency,'Daily');
const stance=ctx.pokemonCombatFormActionResourceSpec('stance-change-full-action');assert.equal(stance.actionCost,'Full Action');
const ice=ctx.pokemonCombatFormActionResourceSpec('ice-face-hail-restore');assert.equal(ice.actionCost,'Standard Action');
const bond=ctx.pokemonCombatCapabilityResourceSpec('Weapon Bond');assert.equal(bond.actionCost,'Extended Action');

let spent=ctx.pokemonCombatSpendNonMoveResource('p',schooling,{log:false});assert.equal(spent.valid,true);assert.equal(ctx.row.frequency.day['nonmove:ability:schooling'],1);assert.equal(ctx.pokemonCombatSpendNonMoveResource('p',schooling,{log:false}).valid,false,'Daily Ability must not double-spend');
const fakeSameName=ctx.pokemonCombatNonMoveSpec('form','schooling','Schooling Form test','Free Action','Daily');assert.notEqual(ctx.pokemonCombatNonMoveResourceKey(schooling),ctx.pokemonCombatNonMoveResourceKey(fakeSameName));assert.equal(ctx.pokemonCombatSpendNonMoveResource('p',fakeSameName,{log:false}).valid,true,'source-kind namespace must separate counters');

spent=ctx.pokemonCombatSpendNonMoveResource('p',construct,{log:false});assert.equal(spent.valid,true);assert.equal(ctx.row.turn.used.swift,true);assert.equal(ctx.row.frequency.day['nonmove:ability:power-construct'],1);let refund=ctx.pokemonCombatRefundNonMoveResourceCore('p',spent.transaction.id,{log:false});assert.equal(refund.valid,true);assert.equal(ctx.row.turn.used.swift,false);assert.equal(ctx.row.frequency.day['nonmove:ability:power-construct'],0);

ctx.state.ui.round=2;ctx.row.turn={round:2,used:{standard:false,shift:false,swift:false},conversions:[]};spent=ctx.pokemonCombatSpendNonMoveResource('p',stance,{log:false});assert.equal(spent.valid,true);assert.equal(ctx.row.turn.used.standard,true);assert.equal(ctx.row.turn.used.shift,true);refund=ctx.pokemonCombatRefundNonMoveResourceCore('p',spent.transaction.id,{log:false});assert.equal(ctx.row.turn.used.standard,false);assert.equal(ctx.row.turn.used.shift,false);

ctx.state.ui.day=2;ctx.row.frequency.dayNumber=2;ctx.row.frequency.day={};ctx.state.ui.round=3;ctx.row.turn={round:3,used:{standard:false,shift:false,swift:true},conversions:[]};spent=ctx.pokemonCombatSpendNonMoveResource('p',construct,{log:false});assert.equal(spent.valid,true);assert.equal(ctx.row.turn.used.swift,true);assert.equal(ctx.row.turn.used.standard,true,'second Swift cost must use Standard→Swift conversion');assert.ok(ctx.row.turn.conversions.includes('Standard → Swift'));refund=ctx.pokemonCombatRefundNonMoveResourceCore('p',spent.transaction.id,{log:false});assert.equal(ctx.row.turn.used.swift,true,'refund must not erase previously-used Swift token');assert.equal(ctx.row.turn.used.standard,false);assert.equal(ctx.row.turn.conversions.includes('Standard → Swift'),false);

const sceneSpec=ctx.pokemonCombatNonMoveSpec('ability','scene-test','Scene test','Free Action','Scene');assert.equal(ctx.pokemonCombatSpendNonMoveResource('p',sceneSpec,{log:false}).valid,true);assert.equal(ctx.pokemonCombatSpendNonMoveResource('p',sceneSpec,{log:false}).valid,false);ctx.state.ui.scene=2;assert.equal(ctx.pokemonCombatNonMoveAvailability('p',sceneSpec).valid,true,'Scene boundary must reset namespaced Scene use');
const dailySpec=ctx.pokemonCombatNonMoveSpec('ability','daily-test','Daily test','Free Action','Daily');assert.equal(ctx.pokemonCombatSpendNonMoveResource('p',dailySpec,{log:false}).valid,true);assert.equal(ctx.pokemonCombatSpendNonMoveResource('p',dailySpec,{log:false}).valid,false);ctx.state.ui.day=3;assert.equal(ctx.pokemonCombatNonMoveAvailability('p',dailySpec).valid,true,'Day boundary must reset namespaced Daily use');
const bondSpend=ctx.pokemonCombatSpendNonMoveResource('p',bond,{log:false});assert.equal(bondSpend.valid,true);assert.equal(bondSpend.tracked,false);assert.equal(bondSpend.transaction,null,'Extended Action must remain informational, not become a turn action');

const doc=JSON.parse(await readFile(docJson,'utf8'));assert.equal(doc.schema_version,1);assert.equal(doc.shared_with_moves,true);assert.equal(doc.physical_dice_only,true);assert.equal(doc.sources.schooling.action_cost,'Free Action');assert.equal(doc.sources.schooling.frequency,'Daily');assert.equal(doc.sources.power_construct.action_cost,'Swift Action');assert.equal(doc.sources.stance_change_manual.action_cost,'Full Action');assert.equal(doc.sources.ice_face_hail_restore.action_cost,'Standard Action');assert.equal(doc.sources.weapon_bond.tracked_as_turn_action,false);assert.equal(doc.refund.supported,true);
const md=await readFile(docMd,'utf8');assert.match(md,/same Pokémon Combat action\/frequency ledger/i);assert.match(md,/Schooling/);assert.match(md,/Power Construct/);assert.match(md,/Stance Change/);assert.match(md,/Ice Face/);assert.match(md,/Weapon Bond/);assert.match(md,/Undo/);
const session=JSON.parse(await readFile(sessionJson,'utf8'));assert.equal(session.shared_resources.non_move_sources.enabled,true);assert.equal(session.shared_resources.non_move_sources.source_keyed,true);assert.equal(session.shared_resources.non_move_sources.shares_move_action_frequency_ledger,true);assert.equal(session.shared_resources.non_move_sources.refund_supported,true);assert.ok(session.form_resource_spending.enabled_subset.includes('Schooling'));assert.ok(session.form_resource_spending.enabled_subset.includes('Power Construct'));
const sessionText=await readFile(sessionMd,'utf8');assert.match(sessionText,/Form \/ Ability resource integration/);assert.match(sessionText,/same per-Pokémon action\/frequency ledger/i);assert.match(sessionText,/resource-only correction\/refund/i);assert.match(sessionText,/Extended Action.*not converted/i);

console.log(JSON.stringify({nonMoveResourceModel:1,sharedLedger:true,schooling:true,powerConstruct:true,stanceChange:true,iceFace:true,weaponBondInformational:true,refund:true,sourceKeySeparation:true,sceneDailyReset:true,physicalDiceOnly:true,sessionDocsCurrent:true,windowsAndroidParity:true},null,2));
