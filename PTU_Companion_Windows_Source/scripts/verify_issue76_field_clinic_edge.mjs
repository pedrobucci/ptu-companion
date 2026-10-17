import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DefinitionRepository} from '../definitions/repository.mjs';

const windowsRoot=fileURLToPath(new URL('..',import.meta.url));
const repoRoot=join(windowsRoot,'..');
const windows=new DefinitionRepository(join(windowsRoot,'seed','definitions','ptu_seed_v1.0.sqlite3'));
const mobileData=JSON.parse(await readFile(join(repoRoot,'PTU_Companion_Android_Tauri','www','mobile-data.json'),'utf8'));
globalThis.window={__PTU_MOBILE_DATA__:mobileData};
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
const {definitions:android}=await import(pathToFileURL(join(repoRoot,'PTU_Companion_Android_Tauri','www','mobile-api.mjs')));

for(const [platform,definitions] of [['Windows',windows],['Android',android]]){
  for(const rulesetId of ['all-provided-material','ptu-official-with-playtests']){
    const edges=definitions.listResolved({rulesetId,kind:'edges',q:'Field Clinic',limit:100});
    assert.equal(edges.filter(row=>row.id==='field-clinic').length,1,`${platform}/${rulesetId}: Field Clinic is listed once as an Edge`);
    const edge=definitions.getResolved({rulesetId,kind:'edges',id:'field-clinic'});
    assert.equal(edge.kind,'edges',`${platform}/${rulesetId}: resolved kind is Edge`);
    assert.equal(edge.sourceId,'sep2015');
    assert.equal(edge.sourcePage,7);
    assert.match(edge.prerequisites,/Adept Medicine Education/);
    assert.equal(edge.raw.record_kind,'edge');
    assert.equal(definitions.listResolved({rulesetId,kind:'features',q:'Field Clinic',limit:100}).some(row=>row.id==='field-clinic'),false,`${platform}/${rulesetId}: misclassified source record is hidden from Feature choices`);
    assert.equal(definitions.getResolved({rulesetId,kind:'edges',id:'field-clinic',versionId:'edges:field-clinic@sep2015'}).kind,'edges');
  }
  for(const rulesetId of ['ptu-core-only','ptu-official-supplements']){
    assert.equal(definitions.listResolved({rulesetId,kind:'edges',q:'Field Clinic',limit:100}).some(row=>row.id==='field-clinic'),false,`${platform}/${rulesetId}: playtest Edge stays unavailable when its pack is disabled`);
    assert.equal(definitions.getResolved({rulesetId,kind:'edges',id:'field-clinic'}),null,`${platform}/${rulesetId}: no cross-Ruleset fallback`);
  }
  assert.equal(definitions.countResolved({rulesetId:'all-provided-material',kind:'edges',q:'Field Clinic'}),1,`${platform}: Edge search count matches result`);
  const featureSearch=definitions.listResolved({rulesetId:'all-provided-material',kind:'features',q:'Field Clinic',limit:100});
  assert.equal(featureSearch.some(row=>row.id==='field-clinic'),false,`${platform}: Feature search omits the misclassified source record`);
  assert.equal(definitions.countResolved({rulesetId:'all-provided-material',kind:'features',q:'Field Clinic'}),featureSearch.length,`${platform}: Feature search count matches visible results`);
}

windows.close();
console.log('Issue #76 Field Clinic Edge classification and playtest Ruleset gating: Windows + Android passed.');
