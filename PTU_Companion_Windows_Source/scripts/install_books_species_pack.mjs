// Authoring command: update only the versioned seeds, never the campaign/save DB.
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {importContentPack} from '../definitions/pack-importer.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const packId='campaign-books-species';
const archiveFilename=`${packId}-1.0.0.ptucp`;
const buffer=await readFile(join(root,'bundled-packs',archiveFilename));
const sourceRoot=join(root,'seed','content-packs',packId);
const inventory=JSON.parse(await readFile(join(sourceRoot,'source-inventory.json'),'utf8'));
const backupDir=await mkdtemp(join(tmpdir(),'ptu-books-seed-backup-'));
for(const dbPath of [join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'),join(root,'..','seed','ptu_seed_v1.0.sqlite3')]){
  console.log(await importContentPack({buffer,dbPath,backupDir,archiveFilename,enableRulesetId:'all-provided-material'}));
  const db=new DatabaseSync(dbPath);
  try{
    // A bundled seed install is not a user import. Keep runtime upgrades eligible.
    db.prepare('DELETE FROM installed_pack_imports WHERE pack_id=?').run(packId);
    for(const row of db.prepare('SELECT DISTINCT source_id,raw_json FROM definition_versions WHERE content_pack_id=?').all(packId)){
      const raw=JSON.parse(row.raw_json);
      const source=inventory.find(s=>s.filename===raw.source_file);
      const metadata={id:row.source_id,title:raw.source_title,kind:'homebrew_species',priority:180,filename:raw.source_file,sha256:source?.sha256,available:true};
      db.prepare('UPDATE content_sources SET title=?,raw_json=? WHERE id=?').run(raw.source_title,JSON.stringify(metadata),row.source_id);
    }
  }finally{db.close();}
}
console.log(`Seed backups retained at ${backupDir}`);
