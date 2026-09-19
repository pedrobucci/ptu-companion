import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdir, copyFile, writeFile} from 'node:fs/promises';
import {basename, join} from 'node:path';
import {inflateRawSync} from 'node:zlib';

const DEF_FILES={
  'content/moves.ndjson':'moves',
  'content/abilities.ndjson':'abilities',
  'content/capabilities.ndjson':'capabilities',
  'content/features.ndjson':'features',
  'content/edges.ndjson':'edges',
  'content/poke_edges.ndjson':'poke_edges',
  'content/items.ndjson':'items',
  'content/species.ndjson':'species'
};
const ALLOWED_KINDS=new Set(Object.values(DEF_FILES));
const MAX_ARCHIVE_BYTES=128*1024*1024;
const MAX_UNCOMPRESSED_BYTES=256*1024*1024;
const MAX_ENTRIES=512;

function sha256(buf){return createHash('sha256').update(buf).digest('hex');}
function safeName(name){
  const n=String(name||'').replace(/\\/g,'/');
  if(!n || n.startsWith('/') || /^[A-Za-z]:\//.test(n) || n.split('/').some(p=>p==='..')) throw new Error(`Unsafe archive path: ${name}`);
  return n;
}
function findEocd(buf){
  const sig=0x06054b50;
  const min=Math.max(0,buf.length-0xffff-22);
  for(let i=buf.length-22;i>=min;i--) if(buf.readUInt32LE(i)===sig) return i;
  throw new Error('Invalid ZIP: end-of-central-directory not found.');
}
export function readZipEntries(buffer){
  const buf=Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer);
  if(buf.length>MAX_ARCHIVE_BYTES) throw new Error('Content pack exceeds 128 MB archive limit.');
  const eocd=findEocd(buf);
  const entriesCount=buf.readUInt16LE(eocd+10);
  const cdSize=buf.readUInt32LE(eocd+12);
  const cdOffset=buf.readUInt32LE(eocd+16);
  if(entriesCount>MAX_ENTRIES) throw new Error(`Content pack has too many ZIP entries (${entriesCount}).`);
  if(cdOffset+cdSize>buf.length) throw new Error('Invalid ZIP central directory bounds.');
  const out=new Map(); let pos=cdOffset,total=0;
  for(let index=0;index<entriesCount;index++){
    if(buf.readUInt32LE(pos)!==0x02014b50) throw new Error('Invalid ZIP central directory entry.');
    const flags=buf.readUInt16LE(pos+8), method=buf.readUInt16LE(pos+10);
    const compSize=buf.readUInt32LE(pos+20), uncompSize=buf.readUInt32LE(pos+24);
    const nameLen=buf.readUInt16LE(pos+28), extraLen=buf.readUInt16LE(pos+30), commentLen=buf.readUInt16LE(pos+32);
    const localOffset=buf.readUInt32LE(pos+42);
    if(compSize===0xffffffff||uncompSize===0xffffffff||localOffset===0xffffffff) throw new Error('ZIP64 content packs are not supported.');
    if(flags&1) throw new Error('Encrypted ZIP entries are not supported.');
    const name=safeName(buf.subarray(pos+46,pos+46+nameLen).toString('utf8'));
    pos+=46+nameLen+extraLen+commentLen;
    if(name.endsWith('/')) continue;
    if(buf.readUInt32LE(localOffset)!==0x04034b50) throw new Error(`Invalid local ZIP header for ${name}.`);
    const ln=buf.readUInt16LE(localOffset+26), le=buf.readUInt16LE(localOffset+28);
    const dataStart=localOffset+30+ln+le, dataEnd=dataStart+compSize;
    if(dataEnd>buf.length) throw new Error(`ZIP entry exceeds archive bounds: ${name}`);
    const compressed=buf.subarray(dataStart,dataEnd);
    let payload;
    if(method===0) payload=Buffer.from(compressed);
    else if(method===8) payload=inflateRawSync(compressed);
    else throw new Error(`Unsupported ZIP compression method ${method} for ${name}.`);
    if(payload.length!==uncompSize) throw new Error(`ZIP size mismatch for ${name}.`);
    total+=payload.length; if(total>MAX_UNCOMPRESSED_BYTES) throw new Error('Content pack exceeds 256 MB expanded limit.');
    if(out.has(name)) throw new Error(`Duplicate ZIP entry: ${name}`);
    out.set(name,payload);
  }
  return out;
}
function parseJson(buf,label){try{return JSON.parse(buf.toString('utf8'));}catch(e){throw new Error(`Invalid JSON in ${label}: ${e.message}`);}}
function parseNdjson(buf,label){
  const text=buf.toString('utf8'); const rows=[];
  for(const [i,line] of text.split(/\r?\n/).entries()){
    if(!line.trim())continue;
    try{rows.push(JSON.parse(line));}catch(e){throw new Error(`Invalid NDJSON in ${label} line ${i+1}: ${e.message}`);}
  }
  return rows;
}
function cleanId(v,label){
  const s=String(v||'').trim();
  if(!s||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(s)) throw new Error(`Invalid ${label}: ${v}`);
  return s;
}
function validateManifest(manifest,entries){
  if(!manifest||manifest.format!=='ptu-content-pack') throw new Error('manifest.json must declare format "ptu-content-pack".');
  if(Number(manifest.format_version)!==1) throw new Error(`Unsupported content-pack format_version: ${manifest.format_version}`);
  cleanId(manifest.id,'pack id');
  if(!String(manifest.name||'').trim()) throw new Error('Content pack name is required.');
  if(!String(manifest.version||'').trim()) throw new Error('Content pack version is required.');
  const files=manifest.files||{};
  for(const [path,meta] of Object.entries(files)){
    const p=safeName(path); const payload=entries.get(p);
    if(!payload) throw new Error(`Manifest file is missing from archive: ${p}`);
    if(meta?.bytes!=null && Number(meta.bytes)!==payload.length) throw new Error(`Byte-size mismatch for ${p}.`);
    if(meta?.sha256 && String(meta.sha256).toLowerCase()!==sha256(payload)) throw new Error(`SHA-256 mismatch for ${p}.`);
    if(meta?.records!=null){
      let count;
      if(p.endsWith('.ndjson')) count=parseNdjson(payload,p).length;
      else {const parsed=parseJson(payload,p); count=Array.isArray(parsed)?parsed.length:1;}
      if(Number(meta.records)!==count) throw new Error(`Record-count mismatch for ${p}: manifest=${meta.records}, actual=${count}.`);
    }
  }
  return manifest;
}
export function inspectContentPack(buffer){
  const entries=readZipEntries(buffer);
  const manifestBuf=entries.get('manifest.json'); if(!manifestBuf) throw new Error('Content pack does not contain manifest.json.');
  const manifest=validateManifest(parseJson(manifestBuf,'manifest.json'),entries);
  const counts={}; const warnings=[];
  for(const [file,kind] of Object.entries(DEF_FILES)) if(entries.has(file)) counts[kind]=parseNdjson(entries.get(file),file).length;
  for(const file of entries.keys()) if(file.startsWith('content/') && file!=='manifest.json' && !DEF_FILES[file] && !file.startsWith('content/datasets/')) warnings.push(`Unrecognized content file will be ignored: ${file}`);
  return {manifest,counts,warnings,archiveSha256:sha256(Buffer.from(buffer)),entries};
}
function ensureImporterTables(db){
  db.exec(`CREATE TABLE IF NOT EXISTS installed_pack_imports(
    import_id INTEGER PRIMARY KEY AUTOINCREMENT,
    pack_id TEXT NOT NULL, pack_version TEXT NOT NULL, imported_at TEXT NOT NULL,
    archive_sha256 TEXT NOT NULL, archive_filename TEXT, backup_filename TEXT,
    result_json TEXT NOT NULL
  );`);
}
function imageMime(path){
  const ext=String(path||'').toLowerCase().split('.').pop();
  return ext==='png'?'image/png':ext==='jpg'||ext==='jpeg'?'image/jpeg':ext==='webp'?'image/webp':null;
}
function embedSpeciesPortrait(raw,entries){
  const assetPath=String(raw?.portrait_asset_path||raw?.artwork_assets?.find?.(x=>x?.role==='portrait')?.path||'').replace(/\\/g,'/');
  if(!assetPath)return raw;
  const mime=imageMime(assetPath); if(!mime)throw new Error(`Unsupported Species portrait format: ${assetPath}`);
  const payload=entries.get(assetPath); if(!payload)throw new Error(`Species portrait asset is missing from archive: ${assetPath}`);
  if(payload.length>5*1024*1024)throw new Error(`Species portrait asset exceeds 5 MB: ${assetPath}`);
  return {...raw,portrait_asset_path:assetPath,portrait_data_url:`data:${mime};base64,${payload.toString('base64')}`};
}
function embedItemIcon(raw,entries){
  const assetPath=String(raw?.icon_asset_path||raw?.artwork_assets?.find?.(x=>x?.role==='icon')?.path||'').replace(/\\/g,'/');
  if(!assetPath)return raw;
  const mime=imageMime(assetPath); if(!mime)throw new Error(`Unsupported Item icon format: ${assetPath}`);
  const payload=entries.get(assetPath); if(!payload)throw new Error(`Item icon asset is missing from archive: ${assetPath}`);
  if(payload.length>5*1024*1024)throw new Error(`Item icon asset exceeds 5 MB: ${assetPath}`);
  return {...raw,icon_asset_path:assetPath,icon_data_url:`data:${mime};base64,${payload.toString('base64')}`};
}
function insertDefinitions(db,entries,manifest){
  const insert=db.prepare(`INSERT INTO definition_versions(version_id,definition_kind,logical_id,content_pack_id,source_id,priority,source_page,needs_review,raw_json)
    VALUES(?,?,?,?,?,?,?,?,?)`);
  const totals={};
  for(const [file,kind] of Object.entries(DEF_FILES)){
    if(!entries.has(file)) continue;
    if(!ALLOWED_KINDS.has(kind)) continue;
    const rows=parseNdjson(entries.get(file),file); totals[kind]=rows.length;
    for(const row of rows){
      const logical=String(row.logical_id||row.id||'').trim(); if(!logical) throw new Error(`${file} contains a record without logical_id/id.`);
      const versionId=String(row.definition_version_id||`${kind}:${logical}@${manifest.id}`).trim();
      const sourceId=String(row.source_id||manifest.source_ids?.[0]||manifest.id);
      let raw={...row,logical_id:logical,definition_version_id:versionId,content_pack_id:manifest.id};
      if(kind==='species')raw=embedSpeciesPortrait(raw,entries);
      if(kind==='items')raw=embedItemIcon(raw,entries);
      insert.run(versionId,kind,logical,manifest.id,sourceId,Number(row.source_priority??manifest.priority??100),row.source_page==null?null:Number(row.source_page),row.needs_review?1:0,JSON.stringify(raw));
    }
  }
  return totals;
}
function importEvolutionDatasets(db,entries,manifest){
  const sourceIds=(Array.isArray(manifest.source_ids)?manifest.source_ids:[]).map(String).filter(Boolean);
  const stats={};
  const edgePath='content/datasets/ptu_evolution_edges.json';
  if(entries.has(edgePath)){
    const rows=parseJson(entries.get(edgePath),edgePath); if(!Array.isArray(rows)) throw new Error(`${edgePath} must contain a JSON array.`);
    if(sourceIds.length){const marks=sourceIds.map(()=>'?').join(','); db.prepare(`DELETE FROM ptu_evolution_edges WHERE source_id IN (${marks})`).run(...sourceIds);}
    const st=db.prepare(`INSERT INTO ptu_evolution_edges(family_id,from_species_name,to_species_name,to_min_level,condition_text,mapping_confidence,source_id,raw_json) VALUES(?,?,?,?,?,?,?,?)`);
    for(const r of rows) st.run(r.family_id||null,r.from_species_name||null,r.to_species_name||null,r.to_min_level==null?null:Number(r.to_min_level),r.condition_text||null,r.mapping_confidence||null,r.source_id||sourceIds[0]||manifest.id,JSON.stringify(r));
    stats.ptu_evolution_edges=rows.length;
  }
  const famPath='content/datasets/ptu_evolution_families.json';
  if(entries.has(famPath)){
    const rows=parseJson(entries.get(famPath),famPath); if(!Array.isArray(rows)) throw new Error(`${famPath} must contain a JSON array.`);
    if(sourceIds.length){const marks=sourceIds.map(()=>'?').join(','); db.prepare(`DELETE FROM ptu_evolution_families WHERE source_id IN (${marks})`).run(...sourceIds);}
    const st=db.prepare(`INSERT OR REPLACE INTO ptu_evolution_families(id,source_id,edges_status,raw_json) VALUES(?,?,?,?)`);
    for(const r of rows) st.run(String(r.id),r.source_id||sourceIds[0]||manifest.id,r.edges_status||'manual',JSON.stringify(r));
    stats.ptu_evolution_families=rows.length;
  }
  return stats;
}
export async function importContentPack({buffer,dbPath,backupDir,enableRulesetId=null,archiveFilename='import.ptucp'}={}){
  const inspected=inspectContentPack(buffer); const {manifest,entries,archiveSha256,warnings}=inspected;
  await mkdir(backupDir,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const backupFilename=`${stamp}__before__${manifest.id}.sqlite3`;
  const backupPath=join(backupDir,backupFilename);
  await copyFile(dbPath,backupPath);
  const archiveStoreDir=join(backupDir,'..','installed-packs'); await mkdir(archiveStoreDir,{recursive:true});
  const storedArchive=`${manifest.id}__${String(manifest.version).replace(/[^a-zA-Z0-9._-]+/g,'-')}.ptucp`;
  await writeFile(join(archiveStoreDir,storedArchive),Buffer.from(buffer));
  const db=new DatabaseSync(dbPath); ensureImporterTables(db);
  try{
    db.exec('BEGIN IMMEDIATE');
    const missing=[];
    for(const dep of (Array.isArray(manifest.dependencies)?manifest.dependencies:[])) if(dep?.required && !db.prepare('SELECT 1 FROM content_packs WHERE id=?').get(String(dep.id))) missing.push(String(dep.id));
    if(missing.length) throw new Error(`Missing required content pack dependencies: ${missing.join(', ')}`);
    db.prepare('DELETE FROM content_pack_dependencies WHERE pack_id=?').run(manifest.id);
    db.prepare('DELETE FROM definition_versions WHERE content_pack_id=?').run(manifest.id);
    db.prepare(`INSERT INTO content_packs(id,name,version,priority,kind,browse_only,archive_filename,archive_sha256,manifest_json)
      VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,version=excluded.version,priority=excluded.priority,kind=excluded.kind,browse_only=excluded.browse_only,archive_filename=excluded.archive_filename,archive_sha256=excluded.archive_sha256,manifest_json=excluded.manifest_json`)
      .run(manifest.id,manifest.name,manifest.version,Number(manifest.priority??100),manifest.kind||'custom',manifest.browse_only?1:0,storedArchive,archiveSha256,JSON.stringify(manifest));
    const depInsert=db.prepare('INSERT OR REPLACE INTO content_pack_dependencies(pack_id,dependency_pack_id,required) VALUES(?,?,?)');
    for(const dep of (Array.isArray(manifest.dependencies)?manifest.dependencies:[])) if(dep?.id) depInsert.run(manifest.id,String(dep.id),dep.required===false?0:1);
    const sourceInsert=db.prepare(`INSERT OR IGNORE INTO content_sources(id,title,kind,priority,raw_json) VALUES(?,?,?,?,?)`);
    const sourceIds=(Array.isArray(manifest.source_ids)&&manifest.source_ids.length?manifest.source_ids:[manifest.id]);
    for(const id of sourceIds) sourceInsert.run(String(id),manifest.name,manifest.kind||'custom',Number(manifest.priority??100),JSON.stringify({id:String(id),title:manifest.name,kind:manifest.kind||'custom',pack_id:manifest.id}));
    const definitionCounts=insertDefinitions(db,entries,manifest);
    const datasetCounts=importEvolutionDatasets(db,entries,manifest);
    if(enableRulesetId){
      const ruleset=db.prepare('SELECT 1 FROM campaign_rulesets WHERE id=?').get(enableRulesetId);
      if(!ruleset) throw new Error(`Unknown target ruleset: ${enableRulesetId}`);
      const existingState=db.prepare('SELECT enabled,position FROM campaign_ruleset_packs WHERE ruleset_id=? AND pack_id=?').get(enableRulesetId,manifest.id);
      const maxPos=Number(db.prepare('SELECT COALESCE(MAX(position),0) p FROM campaign_ruleset_packs WHERE ruleset_id=?').get(enableRulesetId)?.p||0);
      if(existingState){
        // Updating an installed pack must preserve the user's enabled/disabled choice.
        db.prepare('UPDATE campaign_ruleset_packs SET priority=? WHERE ruleset_id=? AND pack_id=?')
          .run(Number(manifest.priority??100),enableRulesetId,manifest.id);
      }else{
        db.prepare('INSERT INTO campaign_ruleset_packs(ruleset_id,pack_id,enabled,priority,position) VALUES(?,?,?,?,?)')
          .run(enableRulesetId,manifest.id,1,Number(manifest.priority??100),maxPos+1);
      }
    }
    const result={pack:{id:manifest.id,name:manifest.name,version:manifest.version,priority:Number(manifest.priority??100),kind:manifest.kind||'custom'},definitionCounts,datasetCounts,warnings,archiveSha256,backupFilename,enabledRulesetId:enableRulesetId||null};
    db.prepare(`INSERT INTO installed_pack_imports(pack_id,pack_version,imported_at,archive_sha256,archive_filename,backup_filename,result_json) VALUES(?,?,?,?,?,?,?)`)
      .run(manifest.id,manifest.version,new Date().toISOString(),archiveSha256,archiveFilename,backupFilename,JSON.stringify(result));
    db.exec('COMMIT');
    return result;
  }catch(e){
    try{db.exec('ROLLBACK');}catch{}
    throw e;
  }finally{db.close();}
}

export function listPackImportHistory(dbPath,limit=50){
  const db=new DatabaseSync(dbPath,{readOnly:true});
  try{
    const table=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='installed_pack_imports'").get();
    if(!table)return [];
    return db.prepare(`SELECT import_id,pack_id,pack_version,imported_at,archive_sha256,archive_filename,backup_filename,result_json FROM installed_pack_imports ORDER BY import_id DESC LIMIT ?`).all(Math.max(1,Math.min(200,Number(limit)||50))).map(r=>({...r,result:JSON.parse(r.result_json||'{}')}));
  }finally{db.close();}
}
