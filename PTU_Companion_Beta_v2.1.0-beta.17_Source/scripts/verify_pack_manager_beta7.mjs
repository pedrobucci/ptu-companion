import assert from 'node:assert/strict';
import {mkdtemp, copyFile, mkdir, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {importContentPack} from '../definitions/pack-importer.mjs';
import {getContentPackManagementInfo,setContentPackEnabled,uninstallContentPack} from '../definitions/pack-manager.mjs';

const root=new URL('..',import.meta.url).pathname;
const work=await mkdtemp(join(tmpdir(),'ptu-pack-manager-beta7-'));
const dbPath=join(work,'definitions','ptu_definitions.sqlite3');
const backupDir=join(work,'definitions','backups');
await mkdir(join(work,'definitions'),{recursive:true});
await copyFile(join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'),dbPath);
const archivePath='/mnt/data/campaign-homebrew-training-professions-1.0.0.ptucp';
const buffer=await readFile(archivePath);
const packId='campaign-homebrew-training-professions';
const rulesetId='all-provided-material';
try{
  const imported=await importContentPack({buffer,dbPath,backupDir,enableRulesetId:rulesetId,archiveFilename:'training.ptucp'});
  assert.equal(imported.pack.id,packId);
  let info=getContentPackManagementInfo(dbPath);
  assert.equal(info[packId].imported,true);
  assert.equal(info[packId].removable,true);

  setContentPackEnabled({dbPath,rulesetId,packId,enabled:false});
  let db=new DatabaseSync(dbPath,{readOnly:true});
  assert.equal(Number(db.prepare('SELECT enabled FROM campaign_ruleset_packs WHERE ruleset_id=? AND pack_id=?').get(rulesetId,packId).enabled),0);
  db.close();

  await importContentPack({buffer,dbPath,backupDir,enableRulesetId:rulesetId,archiveFilename:'training-update.ptucp'});
  db=new DatabaseSync(dbPath,{readOnly:true});
  assert.equal(Number(db.prepare('SELECT enabled FROM campaign_ruleset_packs WHERE ruleset_id=? AND pack_id=?').get(rulesetId,packId).enabled),0,'reimport must preserve disabled state');
  db.close();

  setContentPackEnabled({dbPath,rulesetId,packId,enabled:true});
  db=new DatabaseSync(dbPath,{readOnly:true});
  assert.equal(Number(db.prepare('SELECT enabled FROM campaign_ruleset_packs WHERE ruleset_id=? AND pack_id=?').get(rulesetId,packId).enabled),1);
  db.close();

  const result=await uninstallContentPack({dbPath,backupDir,packId});
  assert.equal(result.pack.id,packId);
  assert.ok(result.backupFilename);
  db=new DatabaseSync(dbPath,{readOnly:true});
  assert.equal(db.prepare('SELECT 1 FROM content_packs WHERE id=?').get(packId),undefined);
  assert.equal(db.prepare('SELECT 1 FROM definition_versions WHERE content_pack_id=? LIMIT 1').get(packId),undefined);
  db.close();
  console.log('PTU Companion Beta v2.1.0-beta.11 Pack Manager verification: OK');
} finally {
  await rm(work,{recursive:true,force:true});
}
