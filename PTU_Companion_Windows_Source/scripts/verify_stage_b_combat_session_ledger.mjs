import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const repo=resolve(root,'..');
const appPaths=[join(root,'static-preview','app.js'),join(repo,'PTU_Companion_Android_Tauri','www','app.js')];
const repositoryPath=join(root,'persistence','repository.mjs');
const docJson=join(repo,'docs','data','PTU_COMBAT_SESSION_LEDGER.json');
const docMd=join(repo,'docs','PTU_COMBAT_SESSION_LEDGER.md');
const oldAudit=join(repo,'docs','data','PTU_FORMS_COMBAT_RESOURCE_AUDIT.json');

function extractFunction(src,name){
  const match=new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);
  if(!match)throw new Error(`Missing function ${name}`);
  const start=match.index;const tail=src.slice(start+1);const next=/\n(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/.exec(tail);const end=next?start+1+next.index:src.length;
  return src.slice(start,end).trim();
}

const sources=[];
for(const path of appPaths){
  const src=await readFile(path,'utf8');sources.push(src);
  for(const needle of [
    "['combat','⚔','Combat']",
    'combat:pokemonCombatScreen',
    'function pokemonCombatDefaultUi',
    'function pokemonCombatParseFrequency',
    'function pokemonCombatActionCostForMove',
    'function pokemonCombatRolloutAfterResult',
    'function pokemonCombatDefenseCurlModifier',
    'function pokemonCombatDoubleDamageDiceExpression',
    'function pokemonCombatResolveMove',
    'function pokemonCombatScreen',
    'data.ui.combat=normalizePokemonCombatUiState(data.ui.combat);',
    'pokemonCombatOnRoundAdvance();',
    'pokemonCombatOnSceneAdvance();',
    'pokemonCombatOnDayAdvance();',
    "kind:'battle-start'",
    "kind:'battle-end'",
    "kind:'move-used'",
    'No valid target · end chain',
    'Natural d20 · physical die',
    'Final attack result',
    'Physical Damage Roll',
    'Damage actually taken by target',
    'Combat screen never generates attack or damage dice',
    'Digital dice are disabled in Combat',
  ])assert.ok(src.includes(needle),`${path} missing ${needle}`);
  assert.ok(!src.includes('blank = roll in app'),`${path} still offers digital d20 rolling`);

  const resolveMove=extractFunction(src,'pokemonCombatResolveMove');
  assert.ok(!resolveMove.includes('pokemonCombatRandomInt('),`${path} resolve Move still generates a random d20`);
  assert.ok(!resolveMove.includes('pokemonCombatRollDiceExpression('),`${path} resolve Move still generates random damage dice`);
  assert.ok(resolveMove.includes("hitRaw==='hit'"),`${path} does not treat reported Hit/Miss as authoritative`);
  assert.ok(resolveMove.includes("criticalRaw==='yes'"),`${path} does not treat reported Critical as authoritative`);
  assert.ok(resolveMove.includes('manualDamage'),`${path} does not consume a manually entered physical Damage Roll`);

  const ctx={};vm.createContext(ctx);
  for(const name of ['pokemonCombatDefaultUi','normalizePokemonCombatUiState','pokemonCombatSlug','pokemonCombatParseFrequency','pokemonCombatActionCostForMove','pokemonCombatRolloutAfterResult','pokemonCombatDefenseCurlModifier','pokemonCombatDoubleDamageDiceExpression'])vm.runInContext(extractFunction(src,name),ctx);
  const blank=ctx.pokemonCombatDefaultUi();assert.equal(blank.version,1);assert.deepEqual(Array.from(blank.participantIds),[]);
  const migrated=ctx.normalizePokemonCombatUiState({active:true,participantIds:['a','a','b'],log:Array.from({length:150},(_,i)=>i)});assert.equal(migrated.active,true);assert.deepEqual(Array.from(migrated.participantIds),['a','b']);assert.equal(migrated.log.length,120);
  assert.deepEqual({...ctx.pokemonCombatParseFrequency('Scene x2')},{kind:'scene',limit:2,label:'Scene x2'});
  assert.deepEqual({...ctx.pokemonCombatParseFrequency('Daily')},{kind:'daily',limit:1,label:'Daily'});
  assert.equal(ctx.pokemonCombatParseFrequency('At-Will').kind,'at-will');assert.equal(ctx.pokemonCombatParseFrequency('EOT').kind,'eot');
  assert.equal(ctx.pokemonCombatActionCostForMove({range:'Self',effect:'The user may stop as a Swift Action.'}),'Standard Action','Defense Curl use must stay a Standard Action');
  assert.equal(ctx.pokemonCombatActionCostForMove({range:'Melee, Dash, Full Action'}),'Full Action');
  let rollout={active:false,hits:0,nextDb:3};rollout=ctx.pokemonCombatRolloutAfterResult(rollout,true,3);assert.equal(rollout.nextDb,7);rollout=ctx.pokemonCombatRolloutAfterResult(rollout,true,7);assert.equal(rollout.nextDb,11);rollout=ctx.pokemonCombatRolloutAfterResult(rollout,true,11);assert.equal(rollout.nextDb,15);rollout=ctx.pokemonCombatRolloutAfterResult(rollout,true,15);assert.equal(rollout.nextDb,15);rollout=ctx.pokemonCombatRolloutAfterResult(rollout,false,15);assert.equal(rollout.active,false);assert.equal(rollout.nextDb,3);
  const curlRollout=ctx.pokemonCombatDefenseCurlModifier({curledUp:true,moveName:'Rollout',knowsRollMove:true});assert.equal(curlRollout.damageBonus,10);assert.equal(curlRollout.accuracyPenalty,0);assert.equal(curlRollout.slowed,false);assert.equal(curlRollout.criticalImmune,true);
  const curlOther=ctx.pokemonCombatDefenseCurlModifier({curledUp:true,moveName:'Tackle',knowsRollMove:false});assert.equal(curlOther.damageBonus,0);assert.equal(curlOther.accuracyPenalty,-4);assert.equal(curlOther.slowed,true);
  assert.equal(ctx.pokemonCombatDoubleDamageDiceExpression('2d6+8'),'4d6+16');
  assert.equal(ctx.pokemonCombatDoubleDamageDiceExpression('1d8+6'),'2d8+12');
}

for(const name of ['pokemonCombatDefaultUi','normalizePokemonCombatUiState','pokemonCombatParseFrequency','pokemonCombatActionCostForMove','pokemonCombatRolloutAfterResult','pokemonCombatDefenseCurlModifier','pokemonCombatDoubleDamageDiceExpression','pokemonCombatMoveAvailability','pokemonCombatOpenMove','pokemonCombatResolveMove','pokemonCombatScreen'])assert.equal(extractFunction(sources[0],name),extractFunction(sources[1],name),`${name} diverged between Windows and Android`);

const repository=await readFile(repositoryPath,'utf8');assert.match(repository,/combat:\s*semanticState\.ui\?\.combat \?\? null/);assert.match(repository,/inCombat:\s*!!semanticState\.ui\?\.inCombat/);
const doc=JSON.parse(await readFile(docJson,'utf8'));assert.equal(doc.schema_version,2);assert.equal(doc.menu,'Combat');assert.deepEqual(doc.platforms,['windows','android']);assert.equal(doc.roll_resolution.physical_dice_only,true);assert.equal(doc.roll_resolution.digital_rng,false);assert.equal(doc.roll_resolution.automatic_hit_miss,false);assert.match(doc.roll_resolution.final_hit_miss,/user-confirmed/i);assert.match(doc.target_model,/abstract/i);assert.equal(doc.persistence.revision_hash_includes_combat,true);assert.deepEqual(doc.first_complex_interaction.moves,['Defense Curl','Rollout']);
const md=await readFile(docMd,'utf8');assert.match(md,/Combat Session Ledger/);assert.match(md,/Rollout starts at DB 3/);assert.match(md,/Full Actions consume both Standard and Shift Actions/);assert.match(md,/physical dice only|never generates attack or damage dice/i);assert.match(md,/Damage actually taken by target/);
const previous=JSON.parse(await readFile(oldAudit,'utf8'));assert.equal(previous.status,'historical_pre_ledger_snapshot');assert.equal(previous.superseded_by,'docs/PTU_COMBAT_SESSION_LEDGER.md');

console.log(JSON.stringify({combatLedger:1,platforms:['windows','android'],menu:'Combat',physicalDiceOnly:true,digitalRng:false,abstractTarget:true,manualHitMiss:true,manualDamageRoll:true,actionLedger:true,frequencyLedger:true,rolloutDefenseCurl:true,formSpending:false,eotExtraTurnSafe:false},null,2));
