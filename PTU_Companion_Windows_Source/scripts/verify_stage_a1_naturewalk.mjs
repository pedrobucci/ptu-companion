import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeCapability, normalizeNaturewalkTerrains, formatCapabilityLabel} from '../rules/capability-normalization.mjs';
import {DefinitionRepository} from '../definitions/repository.mjs';

const legacy=normalizeCapability({name:'Naturewalk',kind:'special',capability_id:'naturewalk',terrain:'Forest'});
assert.deepEqual(legacy.terrain,['Forest']);
assert.deepEqual(legacy.terrains,['Forest']);
assert.equal(formatCapabilityLabel(legacy),'Naturewalk [Forest]');

const multi=normalizeCapability({name:'Naturewalk',kind:'special',capability_id:'naturewalk',terrain:['Forest','Urban']});
assert.deepEqual(normalizeNaturewalkTerrains(multi),['Forest','Urban']);
assert.equal(formatCapabilityLabel(multi),'Naturewalk [Forest, Urban]');

const plural=normalizeCapability({name:'Naturewalk',terrains:'Cave, Mountain'});
assert.deepEqual(plural.terrain,['Cave','Mountain']);
assert.equal(formatCapabilityLabel(plural),'Naturewalk [Cave, Mountain]');

const textLegacy=normalizeCapability('Naturewalk (Ocean, Urban)');
assert.deepEqual(textLegacy.terrain,['Ocean','Urban']);
assert.equal(formatCapabilityLabel(textLegacy),'Naturewalk [Ocean, Urban]');

const db=new DefinitionRepository(new URL('../seed/definitions/ptu_seed_v1.0.sqlite3',import.meta.url).pathname);
try {
  const species=db.getResolved({rulesetId:'all-provided-material',kind:'species',id:'clefable-k'});
  assert.ok(species,'Expected Clefable K. in the default all-provided-material ruleset');
  const naturewalk=(species.capabilities||[]).find(c=>String(c?.capability_id||'').toLowerCase()==='naturewalk');
  assert.ok(naturewalk,'Expected bundled species Naturewalk capability');
  assert.ok(Array.isArray(naturewalk.terrain),'Resolved Naturewalk terrain must be normalized to an array');
  assert.equal(formatCapabilityLabel(naturewalk),'Naturewalk [Cave]');
} finally { db.close(); }

const app=await readFile(new URL('../static-preview/app.js',import.meta.url),'utf8');
assert.match(app,/function normalizeNaturewalkTerrains\(/);
assert.match(app,/Naturewalk \[\$\{terrains\.join\(', '\)\}\]/);
console.log('Stage A.1 Windows Naturewalk regression OK');
