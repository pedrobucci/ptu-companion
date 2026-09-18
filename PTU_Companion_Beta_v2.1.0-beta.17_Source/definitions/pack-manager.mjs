import {DatabaseSync} from 'node:sqlite';
import {copyFile, mkdir, readdir, unlink} from 'node:fs/promises';
import {join} from 'node:path';

const safeJson=(value,fallback={})=>{try{return value==null?fallback:JSON.parse(value);}catch{return fallback;}};
const packArchivePrefix=id=>`${String(id||'').replace(/[^a-zA-Z0-9._-]+/g,'-')}__`;

function importerTableExists(db){
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='installed_pack_imports'").get();
}

export function getContentPackManagementInfo(dbPath){
  const db=new DatabaseSync(dbPath,{readOnly:true});
  try{
    const imported=new Set();
    if(importerTableExists(db)){
      for(const row of db.prepare('SELECT DISTINCT pack_id FROM installed_pack_imports').all()) imported.add(String(row.pack_id));
    }
    const rulesetsByPack=new Map();
    for(const row of db.prepare('SELECT ruleset_id,pack_id,enabled FROM campaign_ruleset_packs ORDER BY ruleset_id').all()){
      if(!rulesetsByPack.has(row.pack_id)) rulesetsByPack.set(row.pack_id,[]);
      rulesetsByPack.get(row.pack_id).push({rulesetId:row.ruleset_id,enabled:!!row.enabled});
    }
    const requiredBy=new Map();
    for(const row of db.prepare(`SELECT d.dependency_pack_id,d.pack_id,cp.name
      FROM content_pack_dependencies d JOIN content_packs cp ON cp.id=d.pack_id
      WHERE d.required=1 ORDER BY cp.name`).all()){
      if(!requiredBy.has(row.dependency_pack_id)) requiredBy.set(row.dependency_pack_id,[]);
      requiredBy.get(row.dependency_pack_id).push({id:row.pack_id,name:row.name});
    }
    const out={};
    for(const row of db.prepare('SELECT id,kind FROM content_packs').all()){
      const isImported=imported.has(String(row.id));
      out[row.id]={
        imported:isImported,
        removable:isImported,
        builtIn:!isImported,
        enabledRulesets:rulesetsByPack.get(row.id)||[],
        requiredBy:requiredBy.get(row.id)||[]
      };
    }
    return out;
  }finally{db.close();}
}

function requiredDependencyRows(db,packId){
  return db.prepare(`SELECT d.dependency_pack_id,cp.name
    FROM content_pack_dependencies d LEFT JOIN content_packs cp ON cp.id=d.dependency_pack_id
    WHERE d.pack_id=? AND d.required=1 ORDER BY d.dependency_pack_id`).all(packId);
}

export function setContentPackEnabled({dbPath,rulesetId,packId,enabled}={}){
  const db=new DatabaseSync(dbPath);
  try{
    const pack=db.prepare('SELECT id,name,priority FROM content_packs WHERE id=?').get(packId);
    if(!pack) throw new Error(`Unknown content pack: ${packId}`);
    if(!db.prepare('SELECT 1 FROM campaign_rulesets WHERE id=?').get(rulesetId)) throw new Error(`Unknown Ruleset: ${rulesetId}`);
    const want=!!enabled;
    db.exec('BEGIN IMMEDIATE');
    if(want){
      const missing=[];
      for(const dep of requiredDependencyRows(db,packId)){
        const state=db.prepare('SELECT enabled FROM campaign_ruleset_packs WHERE ruleset_id=? AND pack_id=?').get(rulesetId,dep.dependency_pack_id);
        if(!state?.enabled) missing.push(dep.name||dep.dependency_pack_id);
      }
      if(missing.length) throw new Error(`Cannot enable ${pack.name}: required pack(s) are disabled in this Ruleset: ${missing.join(', ')}`);
      const existing=db.prepare('SELECT priority,position FROM campaign_ruleset_packs WHERE ruleset_id=? AND pack_id=?').get(rulesetId,packId);
      if(existing){
        db.prepare('UPDATE campaign_ruleset_packs SET enabled=1 WHERE ruleset_id=? AND pack_id=?').run(rulesetId,packId);
      }else{
        const maxPos=Number(db.prepare('SELECT COALESCE(MAX(position),0) p FROM campaign_ruleset_packs WHERE ruleset_id=?').get(rulesetId)?.p||0);
        db.prepare('INSERT INTO campaign_ruleset_packs(ruleset_id,pack_id,enabled,priority,position) VALUES(?,?,?,?,?)')
          .run(rulesetId,packId,1,Number(pack.priority||100),maxPos+1);
      }
    }else{
      const dependents=db.prepare(`SELECT d.pack_id,cp.name
        FROM content_pack_dependencies d
        JOIN campaign_ruleset_packs rp ON rp.pack_id=d.pack_id AND rp.ruleset_id=? AND rp.enabled=1
        JOIN content_packs cp ON cp.id=d.pack_id
        WHERE d.dependency_pack_id=? AND d.required=1 ORDER BY cp.name`).all(rulesetId,packId);
      if(dependents.length) throw new Error(`Cannot disable ${pack.name}: required by active pack(s): ${dependents.map(x=>x.name||x.pack_id).join(', ')}`);
      db.prepare('UPDATE campaign_ruleset_packs SET enabled=0 WHERE ruleset_id=? AND pack_id=?').run(rulesetId,packId);
    }
    db.exec('COMMIT');
    return {packId,rulesetId,enabled:want};
  }catch(error){
    try{db.exec('ROLLBACK');}catch{}
    throw error;
  }finally{db.close();}
}

export async function uninstallContentPack({dbPath,backupDir,packId}={}){
  await mkdir(backupDir,{recursive:true});
  const db=new DatabaseSync(dbPath);
  let archivePrefix=packArchivePrefix(packId);
  let result;
  try{
    if(!importerTableExists(db) || !db.prepare('SELECT 1 FROM installed_pack_imports WHERE pack_id=? LIMIT 1').get(packId)){
      throw new Error('Bundled Content Packs cannot be uninstalled. Disable them in the current Ruleset instead.');
    }
    const pack=db.prepare('SELECT id,name,version,manifest_json FROM content_packs WHERE id=?').get(packId);
    if(!pack) throw new Error(`Content pack is not installed: ${packId}`);
    const dependents=db.prepare(`SELECT d.pack_id,cp.name FROM content_pack_dependencies d
      JOIN content_packs cp ON cp.id=d.pack_id WHERE d.dependency_pack_id=? AND d.required=1 AND d.pack_id<>? ORDER BY cp.name`).all(packId,packId);
    if(dependents.length) throw new Error(`Cannot uninstall ${pack.name}: required by installed pack(s): ${dependents.map(x=>x.name||x.pack_id).join(', ')}`);

    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const backupFilename=`${stamp}__before-uninstall__${packId}.sqlite3`;
    await copyFile(dbPath,join(backupDir,backupFilename));
    const manifest=safeJson(pack.manifest_json,{});
    const sourceIds=new Set((Array.isArray(manifest.source_ids)?manifest.source_ids:[]).map(String).filter(Boolean));

    db.exec('BEGIN IMMEDIATE');
    const versionRows=db.prepare('SELECT version_id,source_id FROM definition_versions WHERE content_pack_id=?').all(packId);
    for(const row of versionRows) if(row.source_id) sourceIds.add(String(row.source_id));
    const versionIds=versionRows.map(r=>String(r.version_id));
    if(versionIds.length){
      const delPin=db.prepare('DELETE FROM campaign_ruleset_version_pins WHERE version_id=?');
      for(const versionId of versionIds) delPin.run(versionId);
    }
    db.prepare('DELETE FROM campaign_ruleset_packs WHERE pack_id=?').run(packId);
    db.prepare('DELETE FROM content_pack_dependencies WHERE pack_id=? OR dependency_pack_id=?').run(packId,packId);
    db.prepare('DELETE FROM definition_versions WHERE content_pack_id=?').run(packId);
    db.prepare('DELETE FROM content_packs WHERE id=?').run(packId);

    // Remove pack-owned dataset/source rows only when no remaining pack declares the same source id.
    const remainingSourceIds=new Set();
    for(const row of db.prepare('SELECT id,manifest_json FROM content_packs').all()){
      remainingSourceIds.add(String(row.id));
      const m=safeJson(row.manifest_json,{});
      for(const id of (Array.isArray(m.source_ids)?m.source_ids:[])) remainingSourceIds.add(String(id));
    }
    for(const sourceId of sourceIds){
      if(remainingSourceIds.has(sourceId)) continue;
      db.prepare('DELETE FROM ptu_evolution_edges WHERE source_id=?').run(sourceId);
      db.prepare('DELETE FROM ptu_evolution_families WHERE source_id=?').run(sourceId);
      const stillUsed=db.prepare('SELECT 1 FROM definition_versions WHERE source_id=? LIMIT 1').get(sourceId);
      if(!stillUsed) db.prepare('DELETE FROM content_sources WHERE id=?').run(sourceId);
    }
    db.exec('COMMIT');
    result={pack:{id:pack.id,name:pack.name,version:pack.version},backupFilename,removedArchives:[]};
  }catch(error){
    try{db.exec('ROLLBACK');}catch{}
    throw error;
  }finally{db.close();}

  const archiveDir=join(backupDir,'..','installed-packs');
  try{
    for(const name of await readdir(archiveDir)){
      if(!name.startsWith(archivePrefix) || !name.toLowerCase().endsWith('.ptucp')) continue;
      try{await unlink(join(archiveDir,name));result.removedArchives.push(name);}catch{}
    }
  }catch{}
  return result;
}
