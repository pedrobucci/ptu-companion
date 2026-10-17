// Authoring command: seeds/snapshot only. The persistent campaign catalog upgrades through its existing backup mechanism.
import {DatabaseSync} from 'node:sqlite';
import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import {DefinitionRepository} from '../definitions/repository.mjs';
const root=new URL('../',import.meta.url);
const source=JSON.parse(await readFile(new URL('seed/content-packs/ptu-1.05-editation/caretaking-features.json',root),'utf8'));
for(const url of [new URL('seed/definitions/ptu_seed_v1.0.sqlite3',root),new URL('../seed/ptu_seed_v1.0.sqlite3',root)]){
  const db=new DatabaseSync(url);db.exec('BEGIN IMMEDIATE');
  try{
    for(const feature of source.features){
      const core=db.prepare('SELECT raw_json FROM definition_versions WHERE definition_kind=? AND logical_id=? AND content_pack_id=?').get('features',feature.id,'ptu-core-1.05');
      if(!core)throw new Error('Missing base definition '+feature.id);
      const raw={...JSON.parse(core.raw_json),...feature,effect_text:feature.effect_text+(feature.bonus_text?' Bonus: '+feature.bonus_text:''),compiled_effects:[],semantic_automation:{level:'manual_text',prerequisite_status:'full',effect_coverage:'manual',semantic_version:'0.4'},effect_semantics:{unstructured_text:feature.effect_text,coverage:'manual'},source_id:'edit',source_title:'PTU 1.05 Editation / Rebalance',source_kind:'homebrew_rebalance',source_priority:160,source_file:source.source_file,source_pdf_sha256:source.source_sha256,logical_id:feature.id,definition_version_id:`features:${feature.id}@edit`,content_pack_id:source.pack_id};
      db.prepare('INSERT OR REPLACE INTO definition_versions(version_id,definition_kind,logical_id,content_pack_id,source_id,priority,source_page,needs_review,raw_json) VALUES(?,?,?,?,?,?,?,?,?)').run(raw.definition_version_id,'features',raw.id,source.pack_id,'edit',160,raw.source_page,0,JSON.stringify(raw));
    }
    const pack=db.prepare('SELECT manifest_json FROM content_packs WHERE id=?').get(source.pack_id);
    const manifest={...JSON.parse(pack.manifest_json),version:source.version,seed_patch:{issue:89,source_file:source.source_file,source_sha256:source.source_sha256,pages:[13,14]}};
    manifest.content_counts.features=Number(db.prepare('SELECT COUNT(*) AS n FROM definition_versions WHERE content_pack_id=? AND definition_kind=?').get(source.pack_id,'features').n);
    db.prepare('UPDATE content_packs SET version=?,manifest_json=? WHERE id=?').run(source.version,JSON.stringify(manifest),source.pack_id);
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}finally{db.close();}
}
const snapshotUrl=new URL('../PTU_Companion_Android_Tauri/www/mobile-data.js',root),context={window:{}};
vm.runInNewContext(await readFile(snapshotUrl,'utf8'),context);
const data=context.window.__PTU_MOBILE_DATA__,definitions=new DefinitionRepository(new URL('seed/definitions/ptu_seed_v1.0.sqlite3',root));
try{
  for(const feature of source.features){
    const record=definitions.getResolved({rulesetId:'all-provided-material',kind:'features',id:feature.id,versionId:`features:${feature.id}@edit`});
    data.records[record.versionId]=record;
    data.versionGroups[`features:${feature.id}`]=[record.versionId,...(data.versionGroups[`features:${feature.id}`]||[]).filter(id=>id!==record.versionId)];
    for(const ruleset of definitions.getRulesets())data.resolved[ruleset.id].features[feature.id]=definitions.getResolved({rulesetId:ruleset.id,kind:'features',id:feature.id}).versionId;
  }
  for(const pack of data.packs||[])if(pack.id===source.pack_id){pack.version=source.version;if(pack.manifest)pack.manifest.version=source.version;}
  await writeFile(snapshotUrl,'/* Bundled PTU definitions; source precedence is preserved. */\nwindow.__PTU_MOBILE_DATA__ = '+JSON.stringify(data)+';\n');
}finally{definitions.close();}
console.log('Caretaking definitions installed in both seeds and the Android snapshot.');
