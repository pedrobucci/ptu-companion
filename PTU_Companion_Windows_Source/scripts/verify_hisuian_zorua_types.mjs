import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectContentPack } from '../definitions/pack-importer.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = resolve(root, '..');
const packId = 'campaign-homebrew-fakemon-1-leva';
const regionalIds = ['zorua-hisui', 'zoroark-hisui'];
const expectedTypes = ['Normal', 'Ghost'];

const dbPaths = [
  join(root, 'seed', 'definitions', 'ptu_seed_v1.0.sqlite3'),
  join(root, 'data', 'definitions', 'ptu_definitions.sqlite3'),
  join(repoRoot, 'seed', 'ptu_seed_v1.0.sqlite3'),
];

let packVersion = null;
for (const dbPath of dbPaths) {
  assert.ok(existsSync(dbPath), `Definition database missing: ${dbPath}`);
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const versionRow = db.prepare('SELECT version FROM content_packs WHERE id=?').get(packId);
  assert.ok(versionRow?.version, `Fakemon pack metadata missing in ${dbPath}`);
  packVersion ??= String(versionRow.version);
  assert.equal(String(versionRow.version), packVersion, `Fakemon pack version drift in ${dbPath}`);

  for (const id of regionalIds) {
    const row = db.prepare("SELECT raw_json FROM definition_versions WHERE definition_kind='species' AND logical_id=? AND content_pack_id=?").get(id, packId);
    assert.ok(row, `${id} missing from Fakemon pack in ${dbPath}`);
    const raw = JSON.parse(row.raw_json);
    assert.deepEqual(raw.types, expectedTypes, `${id} must resolve exactly as Normal/Ghost in ${dbPath}`);
    assert.ok(!raw.types.includes('Fairy'), `${id} regressed to Fairy in ${dbPath}`);
    assert.equal(raw.regional_form, 'Hisui', `${id} lost its Hisui regional identity in ${dbPath}`);
  }

  for (const id of ['zorua', 'zoroark']) {
    const accidentalOverlay = db.prepare("SELECT COUNT(*) AS n FROM definition_versions WHERE definition_kind='species' AND logical_id=? AND content_pack_id=?").get(id, packId);
    assert.equal(Number(accidentalOverlay.n), 0, `Fakemon pack must not overwrite canonical ${id} in ${dbPath}`);
    const canonical = db.prepare("SELECT raw_json FROM definition_versions WHERE definition_kind='species' AND logical_id=? ORDER BY priority DESC").all(id).map(row => JSON.parse(row.raw_json));
    assert.ok(canonical.some(raw => Array.isArray(raw.types) && raw.types.length === 1 && raw.types[0] === 'Dark'), `Canonical ${id} Dark typing missing in ${dbPath}`);
  }
  db.close();
}

assert.ok(packVersion, 'Unable to determine corrected Fakemon pack version');
const packPaths = [
  join(root, 'bundled-packs', `${packId}-${packVersion}.ptucp`),
  join(repoRoot, 'PTU_Companion_Android_Tauri', 'bundled-packs', `${packId}-${packVersion}.ptucp`),
];
let firstArchiveSha = null;
for (const packPath of packPaths) {
  assert.ok(existsSync(packPath), `Corrected bundled pack missing: ${packPath}`);
  const inspected = inspectContentPack(readFileSync(packPath));
  assert.equal(inspected.manifest.id, packId, `Unexpected pack id in ${packPath}`);
  assert.equal(inspected.manifest.version, packVersion, `Pack version mismatch in ${packPath}`);
  firstArchiveSha ??= inspected.archiveSha256;
  assert.equal(inspected.archiveSha256, firstArchiveSha, 'Windows and Android bundled Fakemon archives must be byte-identical');
  const speciesPayload = inspected.entries.get('content/species.ndjson');
  assert.ok(speciesPayload, `species.ndjson missing from ${packPath}`);
  const species = Buffer.from(speciesPayload).toString('utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
  for (const id of regionalIds) {
    const row = species.find(item => item.logical_id === id || item.id === id);
    assert.ok(row, `${id} missing from ${packPath}`);
    assert.deepEqual(row.types, expectedTypes, `${id} must be Normal/Ghost in ${packPath}`);
    assert.ok(!row.types.includes('Fairy'), `${id} regressed to Fairy in ${packPath}`);
  }
  assert.ok(!species.some(row => ['zorua', 'zoroark'].includes(row.logical_id || row.id)), `Regional pack must not contain canonical Zorua/Zoroark in ${packPath}`);
}

console.log(`Hisuian Zorua/Zoroark typing regression: OK (pack ${packVersion}, sha256 ${firstArchiveSha})`);
