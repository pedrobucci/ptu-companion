import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const www = join(root, 'www');
const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(readFileSync(join(www, 'mobile-data.js'), 'utf8'), context, { filename: 'mobile-data.js', timeout: 30000 });
vm.runInContext(readFileSync(join(www, 'fakemon-v2-data.js'), 'utf8'), context, { filename: 'fakemon-v2-data.js', timeout: 30000 });

const data = context.window.__PTU_MOBILE_DATA__;
assert.ok(data, 'Android mobile data bundle did not initialize');
const rulesetId = 'all-provided-material';
const packId = 'campaign-homebrew-fakemon-1-leva';
const expected = ['Normal', 'Ghost'];

const resolvedSpecies = id => {
  const versionId = data.resolved?.[rulesetId]?.species?.[id];
  assert.ok(versionId, `No resolved Android species version for ${id}`);
  const row = data.records?.[versionId];
  assert.ok(row, `Resolved Android record ${versionId} missing for ${id}`);
  return row;
};

for (const id of ['zorua-hisui', 'zoroark-hisui']) {
  const row = resolvedSpecies(id);
  assert.equal(row.contentPackId, packId, `${id} must resolve from the corrected Fakemon pack`);
  assert.deepEqual(Array.from(row.types || []), expected, `${id} top-level Android types must be Normal/Ghost`);
  assert.deepEqual(Array.from(row.raw?.types || []), expected, `${id} raw Android types must be Normal/Ghost`);
  assert.ok(!(row.raw?.types || []).includes('Fairy'), `${id} regressed to Fairy in Android runtime`);
  assert.equal(row.raw?.regional_form, 'Hisui', `${id} lost its Hisui regional identity`);
}

for (const id of ['zorua', 'zoroark']) {
  const row = resolvedSpecies(id);
  assert.notEqual(row.contentPackId, packId, `Regional Fakemon pack must not overwrite canonical ${id}`);
  assert.deepEqual(Array.from(row.types || row.raw?.types || []), ['Dark'], `Canonical ${id} typing must remain Dark`);
}

console.log('Android Hisuian Zorua/Zoroark typing regression: OK');
