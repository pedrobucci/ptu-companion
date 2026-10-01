import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DefinitionRepository } from '../definitions/repository.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const definitions=new DefinitionRepository(join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'));
const rulesetId='all-provided-material';
const ronin=definitions.getVersions({kind:'features',id:'shadow-form'}).find(row=>row.parentClass==='Ronin');
const apparition=definitions.getVersions({kind:'features',id:'shadow-form'}).find(row=>row.contentPackId==='ptu-1.05-editation');
assert.ok(ronin&&apparition,'both Shadow Form definitions should be present');
assert.deepEqual(ronin.tags,['+Speed']);
assert.deepEqual(apparition.tags,['+Attack']);
assert.equal(definitions.getResolved({rulesetId,kind:'features',id:'shadow-form'}).versionId,ronin.versionId,'new selections should retain active Ruleset precedence');
assert.equal(definitions.getResolved({rulesetId,kind:'features',id:'shadow-form',versionId:apparition.versionId}).versionId,apparition.versionId,'stored source version should be resolvable directly');

const trainer={level:10,stats:{hp:10,attack:10,defense:10,spAttack:10,spDefense:10,speed:10},details:{features:[{id:'shadow-form',name:'Shadow Form',definitionVersionId:apparition.versionId,contentPackId:apparition.contentPackId,sourceLabel:'PTU 1.05 Editation'}],edges:[],moves:[]}};
const getDefinition=args=>definitions.getResolved(args);
for(const path of [
  '../rules/trainer-engine.mjs',
  '../../PTU_Companion_Android_Tauri/www/rules/trainer-engine.mjs'
]){
  const {resolveTrainerModel}=await import(path);
  const resolved=resolveTrainerModel({trainer,rulesetId,getDefinition,getDamageBase:n=>definitions.getDamageBase(n)});
  assert.equal(resolved.stats.bonus.attack,1,`${path} should apply Apparition's +Attack`);
  assert.equal(resolved.stats.bonus.speed,0,`${path} should not apply Ronin's +Speed`);
  assert.equal(resolved.stats.sources.attack[0].source.sourceLabel,'PTU 1.05 Editation');
}

const androidApi=readFileSync(join(root,'../PTU_Companion_Android_Tauri/www/mobile-api.mjs'),'utf8');
assert.match(androidApi,/getResolved\(\{rulesetId,kind,id,versionId=null\}\)[\s\S]*?const vid=versionId\|\|this\._map/,'Android definition lookup should honor stored version ids');
assert.match(androidApi,/if\(!record\|\|record\.id!==id\|\|\(versionId&&!\(data\.versionGroups\?\.\[/,'Android should not silently substitute another source when a stored version is missing');
definitions.close();
console.log('Issue #30 Shadow Form provenance verified for Windows and Android trainer engines.');
