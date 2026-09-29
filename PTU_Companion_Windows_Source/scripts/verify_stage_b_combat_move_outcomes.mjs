import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const repo=resolve(root,'..');
const appPaths=[join(root,'static-preview','app.js'),join(repo,'PTU_Companion_Android_Tauri','www','app.js')];
const docJson=join(repo,'docs','data','PTU_COMBAT_MOVE_OUTCOMES.json');
const docMd=join(repo,'docs','PTU_COMBAT_MOVE_OUTCOMES.md');

function extractFunction(src,name){
  const match=new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);if(!match)throw new Error(`Missing function ${name}`);
  const start=match.index,tail=src.slice(start+1),next=/\n(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/.exec(tail),end=next?start+1+next.index:src.length;return src.slice(start,end).trim();
}

const sources=[];
for(const path of appPaths){
  const src=await readFile(path,'utf8');sources.push(src);
  for(const needle of [
    "const POKEMON_COMBAT_DRAINING_MOVES=new Set(['absorb','drain-punch','draining-kiss','dream-eater','giga-drain','horn-leech','leech-life','mega-drain'])",
    'function pokemonCombatOutcomeSpec',
    'function pokemonCombatFuryCutterAfterResult',
    'async function pokemonCombatApplyMoveOutcome',
    'Damage actually taken by target',
    'Same target as current Fury Cutter chain?',
    'Did this Move knock out the target?',
    "Math.floor(Number(targetDamage)/2)",
    "pokemonCombatApplyAttackStages(id,2,'Fell Stinger')",
    "row.moveState.furyCutter={active:false,hits:0,nextDb:4",
  ])assert.ok(src.includes(needle),`${path} missing ${needle}`);
  const resolver=extractFunction(src,'pokemonCombatResolveMove');
  assert.ok(!resolver.includes('pokemonCombatRandomInt('),'Move outcome resolver must not generate a d20');
  assert.ok(!resolver.includes('pokemonCombatRollDiceExpression('),'Move outcome resolver must not generate damage dice');
  assert.match(resolver,/spec\.requiresTargetDamage/);
  assert.match(resolver,/spec\.requiresTargetFainted/);
  assert.match(resolver,/combat-same-target/);

  const ctx={};vm.createContext(ctx);vm.runInContext(extractFunction(src,'pokemonCombatFuryCutterAfterResult'),ctx);
  let fury={active:false,hits:0,nextDb:4};
  fury=ctx.pokemonCombatFuryCutterAfterResult(fury,{hit:true,targetDamage:5,sameTarget:true,usedDb:4});assert.equal(fury.active,true);assert.equal(fury.hits,1);assert.equal(fury.nextDb,8);
  fury=ctx.pokemonCombatFuryCutterAfterResult(fury,{hit:true,targetDamage:3,sameTarget:true,usedDb:8});assert.equal(fury.hits,2);assert.equal(fury.nextDb,12);
  fury=ctx.pokemonCombatFuryCutterAfterResult(fury,{hit:true,targetDamage:9,sameTarget:false,usedDb:4});assert.equal(fury.hits,1);assert.equal(fury.nextDb,8);assert.equal(fury.lastResult,'new-target-hit');
  fury=ctx.pokemonCombatFuryCutterAfterResult(fury,{hit:true,targetDamage:0,sameTarget:true,usedDb:8});assert.equal(fury.active,false);assert.equal(fury.nextDb,4);assert.equal(fury.lastResult,'no-damage');
  fury=ctx.pokemonCombatFuryCutterAfterResult({active:true,hits:2,nextDb:12},{hit:false,targetDamage:null,sameTarget:true,usedDb:12});assert.equal(fury.active,false);assert.equal(fury.nextDb,4);assert.equal(fury.lastResult,'miss');
}

for(const name of ['pokemonCombatOutcomeSpec','pokemonCombatFuryCutterState','pokemonCombatResetFuryCutter','pokemonCombatFuryCutterAfterResult','pokemonCombatOutcomeUiFields','pokemonCombatApplyHpGain','pokemonCombatApplyAttackStages','pokemonCombatApplyMoveOutcome','pokemonCombatUseNoRoll','pokemonCombatOpenMove','pokemonCombatResolveMove'])assert.equal(extractFunction(sources[0],name),extractFunction(sources[1],name),`${name} diverged between Windows and Android`);

const doc=JSON.parse(await readFile(docJson,'utf8'));assert.equal(doc.schema_version,2);assert.equal(doc.target_model,'abstract');assert.equal(doc.physical_dice_only,true);assert.deepEqual(doc.handlers.drain_half.moves,['Absorb','Drain Punch','Draining Kiss','Dream Eater','Giga Drain','Horn Leech','Leech Life','Mega Drain']);assert.deepEqual(doc.handlers.fury_cutter.base_db,[4,8,12,16]);assert.match(doc.handlers.fell_stinger.effect,/Attack by 2 Combat Stages/);
const md=await readFile(docMd,'utf8');assert.match(md,/physical dice/i);assert.match(md,/Fury Cutter/);assert.match(md,/Fell Stinger/);assert.match(md,/Damage actually taken by target/);

console.log(JSON.stringify({moveOutcomeModel:2,physicalDiceOnly:true,targetModel:'abstract',drainingMoves:8,furyCutter:true,fellStinger:true,enemyEntities:false},null,2));
