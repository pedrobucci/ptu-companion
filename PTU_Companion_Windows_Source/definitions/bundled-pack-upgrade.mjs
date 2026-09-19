import {DatabaseSync} from 'node:sqlite';
import {copyFile, mkdir} from 'node:fs/promises';
import {join} from 'node:path';

const safeJson=(v,f={})=>{try{return v?JSON.parse(v):f;}catch{return f;}};
const versionParts=v=>String(v||'0').split(/[^0-9]+/).filter(Boolean).map(Number);
function compareVersion(a,b){const aa=versionParts(a),bb=versionParts(b),n=Math.max(aa.length,bb.length);for(let i=0;i<n;i++){const d=(aa[i]||0)-(bb[i]||0);if(d)return d;}return 0;}
function tableExists(db,name){return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);}
function insertRow(db,table,row,{exclude=[]}={}){const keys=Object.keys(row).filter(k=>!exclude.includes(k));const q=keys.map(()=>'?').join(',');db.prepare(`INSERT OR REPLACE INTO ${table}(${keys.join(',')}) VALUES(${q})`).run(...keys.map(k=>row[k]));}

/**
 * Upgrade one bundled content pack in an existing persistent definitions DB.
 * User-imported copies are never overwritten. Ruleset enabled/disabled state is preserved.
 */
export async function syncBundledPackIfNewer({persistentDbPath,bundledDbPath,packId,backupDir}={}){
  const live=new DatabaseSync(persistentDbPath); const seed=new DatabaseSync(bundledDbPath,{readOnly:true});
  try{
    const incoming=seed.prepare('SELECT * FROM content_packs WHERE id=?').get(packId); if(!incoming)return {updated:false,reason:'not-bundled'};
    const current=live.prepare('SELECT * FROM content_packs WHERE id=?').get(packId);
    if(current && compareVersion(incoming.version,current.version)<=0)return {updated:false,reason:'current'};
    if(current && tableExists(live,'installed_pack_imports') && live.prepare('SELECT 1 FROM installed_pack_imports WHERE pack_id=? LIMIT 1').get(packId))return {updated:false,reason:'user-imported'};

    await mkdir(backupDir,{recursive:true});
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const backupFilename=`${stamp}__before-bundled-upgrade__${packId}.sqlite3`;
    live.close(); seed.close();
    await copyFile(persistentDbPath,join(backupDir,backupFilename));

    const db=new DatabaseSync(persistentDbPath); const src=new DatabaseSync(bundledDbPath,{readOnly:true});
    try{
      const pack=src.prepare('SELECT * FROM content_packs WHERE id=?').get(packId);
      const manifest=safeJson(pack.manifest_json,{});
      const sourceIds=new Set((manifest.source_ids||[]).map(String));
      for(const row of src.prepare('SELECT source_id FROM definition_versions WHERE content_pack_id=?').all(packId)) if(row.source_id)sourceIds.add(String(row.source_id));
      db.exec('BEGIN IMMEDIATE');
      // Keep campaign_ruleset_packs untouched so the user's enable/disable choices survive.
      db.prepare('DELETE FROM content_pack_dependencies WHERE pack_id=?').run(packId);
      db.prepare('DELETE FROM definition_versions WHERE content_pack_id=?').run(packId);
      insertRow(db,'content_packs',pack);
      for(const row of src.prepare('SELECT * FROM content_pack_dependencies WHERE pack_id=?').all(packId))insertRow(db,'content_pack_dependencies',row);
      for(const sid of sourceIds){
        const source=src.prepare('SELECT * FROM content_sources WHERE id=?').get(sid);if(source)insertRow(db,'content_sources',source);
        db.prepare('DELETE FROM ptu_evolution_edges WHERE source_id=?').run(sid);
        db.prepare('DELETE FROM ptu_evolution_families WHERE source_id=?').run(sid);
        for(const row of src.prepare('SELECT * FROM ptu_evolution_edges WHERE source_id=?').all(sid))insertRow(db,'ptu_evolution_edges',row,{exclude:['id']});
        for(const row of src.prepare('SELECT * FROM ptu_evolution_families WHERE source_id=?').all(sid))insertRow(db,'ptu_evolution_families',row);
      }
      for(const row of src.prepare('SELECT * FROM definition_versions WHERE content_pack_id=?').all(packId))insertRow(db,'definition_versions',row);
      // If this is a very old DB without the pack in a ruleset, inherit only missing memberships from the seed.
      for(const row of src.prepare('SELECT * FROM campaign_ruleset_packs WHERE pack_id=?').all(packId)){
        const exists=db.prepare('SELECT 1 FROM campaign_ruleset_packs WHERE ruleset_id=? AND pack_id=?').get(row.ruleset_id,packId);
        if(!exists)insertRow(db,'campaign_ruleset_packs',row);
      }
      db.exec('COMMIT');
      return {updated:true,fromVersion:current?.version||null,toVersion:pack.version,backupFilename};
    }catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}finally{db.close();src.close();}
  }finally{
    try{live.close();}catch{} try{seed.close();}catch{}
  }
}
