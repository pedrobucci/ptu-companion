import { DatabaseSync } from 'node:sqlite';
import {normalizeCapabilities} from '../rules/capability-normalization.mjs';

const safeJson = (value, fallback={}) => {
  try { return value == null ? fallback : JSON.parse(value); }
  catch { return fallback; }
};

const ALLOWED_KINDS = new Set(['moves','abilities','capabilities','features','edges','poke_edges','items','species']);

export class DefinitionRepository {
  constructor(path) {
    this.path = path;
    this.db = new DatabaseSync(path, { readOnly: true });
    this.db.exec('PRAGMA query_only = ON;');
  }

  close(){ this.db.close(); }

  getRulesets(){
    return this.db.prepare(`SELECT id,name,version,description,raw_json FROM campaign_rulesets ORDER BY name`).all().map(r => ({
      id:r.id,name:r.name,version:r.version,description:r.description,...safeJson(r.raw_json,{})
    }));
  }

  getRuleset(id){
    const row=this.db.prepare('SELECT * FROM campaign_rulesets WHERE id=?').get(id);
    if(!row) return null;
    const packs=this.db.prepare(`SELECT rp.pack_id,rp.enabled,rp.priority,rp.position,cp.name,cp.kind,cp.browse_only,cp.version
      FROM campaign_ruleset_packs rp JOIN content_packs cp ON cp.id=rp.pack_id
      WHERE rp.ruleset_id=? ORDER BY rp.position`).all(id).map(r=>({...r,enabled:!!r.enabled,browse_only:!!r.browse_only}));
    const pins=this.db.prepare('SELECT definition_key,version_id FROM campaign_ruleset_version_pins WHERE ruleset_id=? ORDER BY definition_key').all(id);
    return {id:row.id,name:row.name,version:row.version,description:row.description,packs,pins};
  }

  getPacks(){
    return this.db.prepare(`SELECT id,name,version,priority,kind,browse_only,archive_filename,archive_sha256,manifest_json
      FROM content_packs ORDER BY priority,id`).all().map(r=>({
        id:r.id,name:r.name,version:r.version,priority:r.priority,kind:r.kind,browse_only:!!r.browse_only,
        archive_filename:r.archive_filename,archive_sha256:r.archive_sha256,manifest:safeJson(r.manifest_json,{})
      }));
  }

  _validateKind(kind){ if(!ALLOWED_KINDS.has(kind)) throw Object.assign(new Error(`Unsupported definition kind: ${kind}`),{status:400}); }

  _resolvedCte(){
    return `WITH candidates AS (
      SELECT dv.version_id,dv.definition_kind,dv.logical_id,dv.content_pack_id,dv.source_id,dv.priority AS source_priority,
             dv.source_page,dv.needs_review,dv.raw_json,rp.priority AS ruleset_priority,rp.position,
             CASE WHEN pin.version_id=dv.version_id THEN 1 ELSE 0 END AS is_pinned,
             cp.name AS pack_name, cp.kind AS pack_kind,
             ROW_NUMBER() OVER (
               PARTITION BY dv.logical_id
               ORDER BY CASE WHEN pin.version_id=dv.version_id THEN 1 ELSE 0 END DESC,
                        rp.priority DESC, rp.position DESC, dv.priority DESC, dv.version_id DESC
             ) AS rn
      FROM definition_versions dv
      JOIN campaign_ruleset_packs rp ON rp.pack_id=dv.content_pack_id AND rp.ruleset_id=? AND rp.enabled=1
      JOIN content_packs cp ON cp.id=dv.content_pack_id
      LEFT JOIN campaign_ruleset_version_pins pin ON pin.ruleset_id=rp.ruleset_id
        AND pin.definition_key=(dv.definition_kind || ':' || dv.logical_id)
      WHERE dv.definition_kind=?
    )`;
  }

  listResolved({rulesetId,kind,q='',limit=60,offset=0}){
    this._validateKind(kind);
    limit=Math.max(1,Math.min(200,Number(limit)||60)); offset=Math.max(0,Number(offset)||0);
    const needle=`%${String(q||'').trim().toLowerCase()}%`;
    const rows=this.db.prepare(`${this._resolvedCte()}
      SELECT * FROM candidates
      WHERE rn=1 AND (?='' OR lower(logical_id) LIKE ? OR lower(raw_json) LIKE ?)
      ORDER BY logical_id LIMIT ? OFFSET ?`).all(rulesetId,kind,String(q||'').trim(),needle,needle,limit,offset);
    return rows.map(r=>this._formatRow(r));
  }

  countResolved({rulesetId,kind,q=''}){
    this._validateKind(kind);
    const needle=`%${String(q||'').trim().toLowerCase()}%`;
    return Number(this.db.prepare(`${this._resolvedCte()}
      SELECT COUNT(*) AS c FROM candidates
      WHERE rn=1 AND (?='' OR lower(logical_id) LIKE ? OR lower(raw_json) LIKE ?)`)
      .get(rulesetId,kind,String(q||'').trim(),needle,needle)?.c||0);
  }

  getResolved({rulesetId,kind,id}){
    this._validateKind(kind);
    const row=this.db.prepare(`${this._resolvedCte()}
      SELECT * FROM candidates WHERE rn=1 AND logical_id=? LIMIT 1`).get(rulesetId,kind,id);
    return row?this._formatRow(row,true):null;
  }

  getVersions({kind,id}){
    this._validateKind(kind);
    return this.db.prepare(`SELECT dv.version_id,dv.logical_id,dv.content_pack_id,dv.source_id,dv.priority,dv.source_page,dv.needs_review,
      cp.name AS pack_name,cp.kind AS pack_kind,dv.raw_json
      FROM definition_versions dv JOIN content_packs cp ON cp.id=dv.content_pack_id
      WHERE dv.definition_kind=? AND dv.logical_id=? ORDER BY dv.priority DESC,dv.version_id`).all(kind,id).map(r=>this._formatRow({...r,source_priority:r.priority,ruleset_priority:r.priority,position:0,is_pinned:0},true));
  }

  getCounts(rulesetId){
    const out={};
    for(const kind of ALLOWED_KINDS) out[kind]=this.countResolved({rulesetId,kind});
    return out;
  }

  getDamageBase(db){
    return this.db.prepare('SELECT damage_base,rolled_damage,set_min,set_average,set_max FROM damage_chart WHERE damage_base=?').get(Number(db))||null;
  }

  getTypeMatchups(){
    return this.db.prepare('SELECT attack_type,defense_type,relation,source_chart_symbol FROM type_matchups ORDER BY attack_type,defense_type').all();
  }

  getTypeEffectivenessScale(){
    return this.db.prepare('SELECT net_steps,combat_multiplier,label FROM type_effectiveness_scale ORDER BY net_steps').all();
  }

  getDefensiveTypeProfile(types=[]){
    const defenseTypes=(Array.isArray(types)?types:[]).map(t=>String(t||'').trim()).filter(Boolean);
    const matchups=this.getTypeMatchups();
    const attackTypes=[...new Set(matchups.map(r=>r.attack_type))];
    const byKey=new Map(matchups.map(r=>[`${r.attack_type}::${r.defense_type}`,r]));
    const scale=new Map(this.getTypeEffectivenessScale().map(r=>[Number(r.net_steps),Number(r.combat_multiplier)]));
    return attackTypes.map(attackType=>{
      let immune=false,steps=0;
      const components=[];
      for(const defenseType of defenseTypes){
        const row=byKey.get(`${attackType}::${defenseType}`) || {relation:'neutral'};
        components.push({defenseType,relation:row.relation});
        if(row.relation==='immune') immune=true;
        else if(row.relation==='weak') steps+=1;
        else if(row.relation==='resist' || row.relation==='resistant') steps-=1;
      }
      const clamped=Math.max(-3,Math.min(3,steps));
      const multiplier=immune?0:(scale.get(clamped)??1);
      const relation=immune?'immune':clamped>0?'weak':clamped<0?'resistant':'neutral';
      return {attackType,relation,netSteps:immune?null:steps,multiplier,components};
    });
  }

  getPokemonExperience(level){
    level=Math.max(1,Math.min(100,Number(level)||1));
    return this.db.prepare(`SELECT level,cumulative_exp,stat_points_awarded,tutor_point_awarded,ability_unlock,check_moves_and_evolution
      FROM pokemon_experience WHERE level=?`).get(level)||null;
  }

  getPokemonExperienceTable(){
    return this.db.prepare(`SELECT level,cumulative_exp,stat_points_awarded,tutor_point_awarded,ability_unlock,check_moves_and_evolution
      FROM pokemon_experience ORDER BY level`).all();
  }

  getPokemonLevelForExperience(experience){
    experience=Math.max(0,Number(experience)||0);
    return this.db.prepare(`SELECT level,cumulative_exp,stat_points_awarded,tutor_point_awarded,ability_unlock,check_moves_and_evolution
      FROM pokemon_experience WHERE cumulative_exp<=? ORDER BY level DESC LIMIT 1`).get(experience)||this.getPokemonExperience(1);
  }

  getOutgoingEvolutions({rulesetId,speciesName,sourceId=null}={}){
    if(!speciesName) return [];
    const rows=this.db.prepare(`SELECT e.from_species_name,e.to_species_name,e.to_min_level,e.condition_text,e.mapping_confidence,e.source_id,e.raw_json,
      s.title AS source_title,s.kind AS source_kind
      FROM ptu_evolution_edges e LEFT JOIN content_sources s ON s.id=e.source_id
      WHERE lower(e.from_species_name)=lower(?)
      ORDER BY CASE WHEN e.source_id=? THEN 0 ELSE 1 END, e.to_min_level, e.id`).all(speciesName,sourceId||'');
    const seen=new Set();
    const out=[];
    for(const row of rows){
      const raw=safeJson(row.raw_json,{});
      const key=String(raw.to_ref_key||row.to_species_name||'').toLowerCase();
      if(seen.has(key)) continue;
      seen.add(key);
      let target=null;
      if(raw.to_ref_key) target=this.getResolved({rulesetId,kind:'species',id:String(raw.to_ref_key)});
      if(!target) target=this.findResolvedSpeciesByName({rulesetId,name:row.to_species_name});
      if(!target) continue;
      out.push({
        fromSpeciesName:row.from_species_name,toSpeciesName:row.to_species_name,toMinLevel:row.to_min_level??null,
        conditionText:row.condition_text||null,mappingConfidence:row.mapping_confidence||null,sourceId:row.source_id||null,
        evolutionRulesSource:'ptu_material',sourceTitle:row.source_title||row.source_id||'PTU material',sourceKind:row.source_kind||null,
        target:{id:target.id,name:target.name,versionId:target.versionId,contentPackId:target.contentPackId,sourceId:target.sourceId,
          types:target.types||[],baseStats:target.baseStats||null,abilities:target.abilities||[],levelUpMoves:target.levelUpMoves||[],capabilities:target.capabilities||[],skills:target.skills||null}
      });
    }
    return out;
  }

  getEvolutionGuidance(){
    const rows=this.db.prepare(`SELECT source_id,raw_json FROM ptu_evolution_families WHERE edges_status='safe'`).all();
    const twoStage=new Map(); const threeStage=new Map();
    const bump=(m,k)=>m.set(k,(m.get(k)||0)+1);
    for(const row of rows){
      const raw=safeJson(row.raw_json,{}); const stages=Array.isArray(raw.stages)?raw.stages:[];
      const normalized=stages.map(s=>({stage:Number(s.stage)||0,min:s.min_level==null?null:Number(s.min_level)})).filter(s=>s.stage>0);
      const maxStage=Math.max(0,...normalized.map(s=>s.stage));
      if(maxStage===2){ const s2=normalized.find(s=>s.stage===2&&Number.isFinite(s.min)); if(s2) bump(twoStage,String(s2.min)); }
      if(maxStage>=3){ const s2=normalized.find(s=>s.stage===2&&Number.isFinite(s.min)); const s3=normalized.find(s=>s.stage===3&&Number.isFinite(s.min)); if(s2&&s3) bump(threeStage,`${s2.min}->${s3.min}`); }
    }
    const count=(m,k)=>m.get(k)||0;
    return {
      sourcePolicy:{progressionTable:'ptu_evolution_edges',canonicalCatalogUsedForLevels:false,description:'Evolution minimum Levels are resolved only from PTU material enabled by the active Ruleset. Canonical/current Pokédex relationships may be used for browsing, but never supply progression Levels.'},
      customSuggestions:[
        {id:'two-stage-early',label:'Two-stage · early',stages:[1,2],minimumLevels:[null,20],observedFamilies:count(twoStage,'20')},
        {id:'two-stage-standard',label:'Two-stage · standard',stages:[1,2],minimumLevels:[null,25],observedFamilies:count(twoStage,'25')},
        {id:'two-stage-late',label:'Two-stage · late',stages:[1,2],minimumLevels:[null,30],observedFamilies:count(twoStage,'30')},
        {id:'three-stage-very-early',label:'Three-stage · very early',stages:[1,2,3],minimumLevels:[null,5,10],observedFamilies:count(threeStage,'5->10')},
        {id:'three-stage-standard',label:'Three-stage · standard',stages:[1,2,3],minimumLevels:[null,15,30],observedFamilies:count(threeStage,'15->30')},
        {id:'three-stage-moderate',label:'Three-stage · moderate',stages:[1,2,3],minimumLevels:[null,20,30],observedFamilies:count(threeStage,'20->30')},
        {id:'three-stage-late',label:'Three-stage · late',stages:[1,2,3],minimumLevels:[null,20,40],observedFamilies:count(threeStage,'20->40')}
      ],
      note:'These are authoring suggestions derived from evolution patterns in the supplied PTU material, not universal PTU rules. A custom Species editor should always allow manual override and additional conditions.'
    };
  }


  findResolvedSpeciesByName({rulesetId,name}={}){
    if(!rulesetId || !name) return null;
    const rows=this.listResolved({rulesetId,kind:'species',q:String(name),limit:80,offset:0});
    const target=String(name).trim().toLowerCase();
    const exact=rows.find(r=>String(r.name||'').trim().toLowerCase()===target);
    if(exact) return this.getResolved({rulesetId,kind:'species',id:exact.id});
    return null;
  }

  getEvolutionAncestry({rulesetId,speciesName,sourceId=null,maxDepth=8}={}){
    const ancestors=[];
    const seen=new Set([String(speciesName||'').toLowerCase()]);
    let currentName=speciesName;
    let currentSource=sourceId;
    for(let depth=0; depth<maxDepth; depth++){
      const edge=this.getIncomingEvolution({speciesName:currentName,sourceId:currentSource});
      if(!edge) break;
      const raw=edge.raw||{};
      let ancestor=null;
      if(raw.from_ref_key){
        ancestor=this.getResolved({rulesetId,kind:'species',id:String(raw.from_ref_key)});
      }
      if(!ancestor) ancestor=this.findResolvedSpeciesByName({rulesetId,name:edge.from_species_name});
      if(!ancestor) break;
      const key=String(ancestor.name||ancestor.id||'').toLowerCase();
      if(seen.has(key)) break;
      seen.add(key);
      ancestors.push({
        id:ancestor.id,name:ancestor.name,sourceId:ancestor.sourceId,contentPackId:ancestor.contentPackId,
        levelUpMoves:ancestor.levelUpMoves||[],
        evolutionEdge:{
          fromSpeciesName:edge.from_species_name,toSpeciesName:edge.to_species_name,
          toMinLevel:edge.to_min_level??null,conditionText:edge.condition_text||null,sourceId:edge.source_id||null
        }
      });
      currentName=ancestor.name;
      currentSource=ancestor.sourceId||edge.source_id||currentSource;
    }
    return ancestors;
  }
  getIncomingEvolution({speciesName,sourceId=null}={}){
    if(!speciesName) return null;
    const rows=this.db.prepare(`SELECT from_species_name,to_species_name,to_min_level,condition_text,mapping_confidence,source_id,raw_json
      FROM ptu_evolution_edges WHERE lower(to_species_name)=lower(?)
      ORDER BY CASE WHEN source_id=? THEN 0 ELSE 1 END, id`).all(speciesName,sourceId||'');
    if(!rows.length) return null;
    const row=rows[0];
    return {...row,raw:safeJson(row.raw_json,{})};
  }

  _formatRow(row,full=false){
    const raw=safeJson(row.raw_json,{});
    const name=raw.name || raw.display_name || row.logical_id;
    const summary={
      kind:row.definition_kind,
      id:row.logical_id,
      name,
      versionId:row.version_id,
      contentPackId:row.content_pack_id,
      packName:row.pack_name,
      packKind:row.pack_kind,
      sourceId:row.source_id,
      sourcePage:row.source_page,
      priority:row.ruleset_priority ?? row.source_priority,
      pinned:!!row.is_pinned,
      needsReview:!!row.needs_review,
      type:raw.type || (Array.isArray(raw.types)?raw.types.join(' / '):null),
      category:raw.class || raw.category || raw.record_kind || raw.capability_kind || null,
      parentClass:raw.parent_class || null,
      tags:Array.isArray(raw.tags)?raw.tags:[],
      trainingFeature:raw.training_feature===true || (Array.isArray(raw.tags)&&raw.tags.some(t=>String(t).toLowerCase()==='training')),
      profession:raw.profession || null,
      frequency:raw.frequency_text || raw.frequency_action_text || raw.frequency?.raw || null,
      effect:raw.effect_text || null,
      prerequisites:raw.prerequisites_text || null,
      price:raw.price ?? null,
      damageBase:raw.damage_base ?? null,
      ac:raw.ac ?? null,
      range:raw.range_text || null,
      contestType:raw.contest_type || null,
      contestEffect:raw.contest_effect || null,
      dexNumber:raw.dex_number ?? raw.national_dex_number ?? null,
      enabledForCreation:raw.enabled_for_character_creation ?? null,
      completeness:raw.mechanical_completeness || null,
      types:Array.isArray(raw.types)?raw.types:[],
      baseStats:raw.base_stats || null,
      abilities:raw.ability_slots || [],
      capabilities:normalizeCapabilities(raw.capabilities),
      levelUpMoves:raw.level_up_moves || [],
      icon:raw.icon_data_url || raw.icon_url || raw.icon || null,
      image:raw.image_data_url || raw.image_url || raw.artwork_url || null,
      portraitDataUrl:raw.portrait_data_url || null,
      artwork:raw.icon_data_url || raw.icon_url || raw.image_data_url || raw.image_url || raw.artwork_url || raw.portrait_data_url || null
    };
    if(full){
      summary.raw=raw;
      summary.rawText=raw.raw_text || null;
      summary.semanticAutomation=raw.semantic_automation || null;
      summary.compiledEffects=raw.compiled_effects || [];
      summary.prerequisiteSemantics=raw.prerequisite_semantics || null;
      summary.defenseProfile=raw.type_defense_profile || null;
      summary.evolution=raw.evolution || null;
      summary.evolutionText=raw.evolution_text || null;
      summary.skills=raw.skills || null;
      summary.skillsText=raw.skills_text || null;
      summary.capabilitiesText=raw.capabilities_text || null;
      summary.tmMoves=raw.tm_moves || [];
      summary.tutorMoves=raw.tutor_moves || [];
      summary.eggMoves=raw.egg_moves || [];
    }
    return summary;
  }
}

export { ALLOWED_KINDS };
