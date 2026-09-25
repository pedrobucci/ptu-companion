import {buildPokemonPreview, buildPokemonProgressionPreview, buildPokemonRestatPreview, autoBalancedAllocations, NATURES, parseTutorPointCost, evaluatePokeEdgePrerequisite, moveTrainingPoolUsage, isNaturalTutorMove, tutorRestrictionForMove, relationExemptionsFromPokeEdges, isUnderdogPokemon, pokeEdgeRequiresUnderdog, levelAbilitySlots, eligibleAbilities, applyNature, normalizeBaseStats, normalizeAllocations, STAT_KEYS, validateBaseRelations} from './rules/pokemon-engine.mjs';
import {getPokemonModifierSummary, resolveMoveDamage} from './rules/modifier-engine.mjs';
import {resolveHeldItemEffect, applyHeldItemToTypeProfile, applyHeldItemToEffectiveStats} from './rules/held-item-engine.mjs';
import {resolveTrainerModel} from './rules/trainer-engine.mjs';
import {previewTrainerProgression,applyTrainerProgression,previewTrainerXpPurchase,applyTrainerXpPurchase} from './rules/trainer-progression-engine.mjs';
import {itemUsageMetadata} from './rules/item-metadata.mjs';
import {normalizeCapabilities} from './rules/capability-normalization.mjs';
import {normalizePokemonFormState,resolvePokemonForms,resolvePokemonPresentation} from './rules/pokemon-forms.mjs';
import {normalizeSpeciesForms} from './rules/pokemon-forms.mjs';

const MOBILE_KEY='ptu-companion-android-store-v1';
const data=window.__PTU_MOBILE_DATA__;
if(!data) throw new Error('PTU mobile data bundle is missing.');
const ALLOWED_KINDS=new Set(data.kinds||[]);
const deep=v=>JSON.parse(JSON.stringify(v));
const norm=v=>String(v||'').trim().toLowerCase();


const nativeInvoke=()=>window.__TAURI__?.core?.invoke||null;
const importedPackId=pack=>String(pack?.manifest?.id||'').trim();
const importedPackPriority=pack=>Number(pack?.manifest?.priority??100)||100;
const importedPackName=pack=>String(pack?.manifest?.name||importedPackId(pack)||'Imported Content Pack');
const importedPackKind=pack=>String(pack?.manifest?.kind||'custom');
const importedPackVersion=pack=>String(pack?.manifest?.version||'0.0.0');

function importedDefinitionRecord(kind,row,pack){
  const raw={...(row||{})};
  const logical=String(raw.logical_id||raw.id||'').trim();
  if(!logical) throw new Error(`Imported ${kind} record is missing logical_id/id.`);
  const packId=importedPackId(pack);
  const versionId=String(raw.definition_version_id||`${kind}:${logical}@${packId}`);
  raw.logical_id=logical; raw.definition_version_id=versionId; raw.content_pack_id=packId;
  const sourcePriority=Number(raw.source_priority??pack?.manifest?.priority??100)||100;
  const tags=Array.isArray(raw.tags)?raw.tags:[];
  return {
    kind,id:logical,name:raw.name||raw.display_name||logical,versionId,contentPackId:packId,
    packName:importedPackName(pack),packKind:importedPackKind(pack),sourceId:String(raw.source_id||pack?.manifest?.source_ids?.[0]||packId),
    sourcePage:raw.source_page==null?null:Number(raw.source_page),priority:sourcePriority,pinned:false,needsReview:!!raw.needs_review,
    type:raw.type||(Array.isArray(raw.types)?raw.types.join(' / '):null),category:raw.class||raw.category||raw.record_kind||raw.capability_kind||null,
    parentClass:raw.parent_class||null,tags,trainingFeature:raw.training_feature===true||tags.some(t=>String(t).toLowerCase()==='training'),profession:raw.profession||null,
    frequency:raw.frequency_text||raw.frequency_action_text||raw.frequency?.raw||null,effect:raw.effect_text||null,prerequisites:raw.prerequisites_text||null,
    price:raw.price??null,damageBase:raw.damage_base??null,ac:raw.ac??null,range:raw.range_text||null,contestType:raw.contest_type||null,contestEffect:raw.contest_effect||null,
    dexNumber:raw.dex_number??raw.national_dex_number??null,enabledForCreation:raw.enabled_for_character_creation??null,completeness:raw.mechanical_completeness||null,
    types:Array.isArray(raw.types)?raw.types:[],baseStats:raw.base_stats||null,abilities:raw.ability_slots||[],capabilities:normalizeCapabilities(raw.capabilities),levelUpMoves:raw.level_up_moves||[],forms:normalizeSpeciesForms(raw.forms||raw.form_definitions||[]),
    raw,rawText:raw.raw_text||null,semanticAutomation:raw.semantic_automation||null,compiledEffects:raw.compiled_effects||[],prerequisiteSemantics:raw.prerequisite_semantics||null,
    defenseProfile:raw.type_defense_profile||null,evolution:raw.evolution||null,evolutionText:raw.evolution_text||null,skills:raw.skills||null,skillsText:raw.skills_text||null,
    capabilitiesText:raw.capabilities_text||null,tmMoves:raw.tm_moves||[],tutorMoves:raw.tutor_moves||[],eggMoves:raw.egg_moves||[],androidImported:true
  };
}

function enabledPackMeta(ruleset,packId){ return (ruleset?.packs||[]).find(p=>p.pack_id===packId&&p.enabled); }
function recomputeResolvedDefinition(rulesetId,kind,logicalId){
  const ruleset=(data.rulesets||[]).find(r=>r.id===rulesetId); if(!ruleset)return;
  data.resolved[rulesetId] ||= {}; data.resolved[rulesetId][kind] ||= {};
  const pins=new Map((ruleset.pins||[]).map(p=>[p.definition_key,p.version_id]));
  const candidates=(data.versionGroups?.[`${kind}:${logicalId}`]||[]).map(vid=>data.records?.[vid]).filter(Boolean).map(rec=>{
    const meta=enabledPackMeta(ruleset,rec.contentPackId); if(!meta)return null;
    return {rec,meta,pinned:pins.get(`${kind}:${logicalId}`)===rec.versionId?1:0,sourcePriority:Number(rec.raw?.source_priority??rec.priority??0)||0};
  }).filter(Boolean);
  candidates.sort((a,b)=>b.pinned-a.pinned || Number(b.meta.priority||0)-Number(a.meta.priority||0) || Number(b.meta.position||0)-Number(a.meta.position||0) || b.sourcePriority-a.sourcePriority || String(b.rec.versionId).localeCompare(String(a.rec.versionId)));
  if(candidates[0]) data.resolved[rulesetId][kind][logicalId]=candidates[0].rec.versionId;
  else delete data.resolved[rulesetId][kind][logicalId];
}

function removeImportedPackOverlay(packId){
  const affected=[];
  for(const [vid,rec] of Object.entries(data.records||{})) if(rec?.androidImported&&rec.contentPackId===packId){ affected.push([rec.kind,rec.id]); delete data.records[vid]; }
  for(const [key,vids] of Object.entries(data.versionGroups||{})){
    const next=vids.filter(vid=>data.records?.[vid]); if(next.length)data.versionGroups[key]=next; else delete data.versionGroups[key];
  }
  data.packs=(data.packs||[]).filter(p=>!(p.androidImported&&p.id===packId));
  for(const ruleset of (data.rulesets||[])) ruleset.packs=(ruleset.packs||[]).filter(p=>!(p.androidImported&&p.pack_id===packId));
  data.evolutionEdges=(data.evolutionEdges||[]).filter(e=>e?._androidImportedPackId!==packId);
  return affected;
}

function removeImportedPackAndRecompute(packId){
  const affected=removeImportedPackOverlay(packId);
  const uniqueAffected=[...new Map(affected.map(x=>[`${x[0]}:${x[1]}`,x])).values()];
  for(const ruleset of (data.rulesets||[])) for(const [kind,id] of uniqueAffected) recomputeResolvedDefinition(ruleset.id,kind,id);
  return uniqueAffected;
}

function requiredDependenciesForPack(pack){
  return (Array.isArray(pack?.manifest?.dependencies)?pack.manifest.dependencies:[]).filter(d=>d?.id&&d.required!==false).map(d=>String(d.id));
}
function packEnabledInRuleset(packId,rulesetId){
  return !!definitions.getRuleset(rulesetId)?.packs?.some(p=>p.pack_id===packId&&p.enabled);
}
function activeRequiredDependents(packId,rulesetId){
  return definitions.getPacks().filter(p=>p.id!==packId&&requiredDependenciesForPack(p).includes(packId)&&packEnabledInRuleset(p.id,rulesetId));
}
function installedRequiredDependents(packId){
  return definitions.getPacks().filter(p=>p.id!==packId&&requiredDependenciesForPack(p).includes(packId));
}

function applyImportedPack(pack){
  const packId=importedPackId(pack); if(!packId)return;
  const affected=removeImportedPackOverlay(packId);
  const packMeta={id:packId,name:importedPackName(pack),version:importedPackVersion(pack),priority:importedPackPriority(pack),kind:importedPackKind(pack),browse_only:!!pack?.manifest?.browse_only,
    archive_filename:pack.archiveFilename||null,archive_sha256:pack.archiveSha256||null,manifest:deep(pack.manifest||{}),enabledRulesets:Array.isArray(pack.enabledRulesets)?[...pack.enabledRulesets]:[],androidImported:true};
  data.packs ||= []; data.packs.push(packMeta);
  const enabledRulesets=Array.isArray(pack.enabledRulesets)?pack.enabledRulesets:[store?.activeRulesetId||'all-provided-material'];
  for(const ruleset of (data.rulesets||[])){
    if(!enabledRulesets.includes(ruleset.id))continue;
    ruleset.packs ||= [];
    const maxPos=Math.max(-1,...ruleset.packs.map(p=>Number(p.position??-1)));
    ruleset.packs.push({pack_id:packId,enabled:true,priority:importedPackPriority(pack),position:maxPos+1,name:packMeta.name,kind:packMeta.kind,browse_only:packMeta.browse_only,version:packMeta.version,androidImported:true});
  }
  for(const [kind,rows] of Object.entries(pack.definitions||{})){
    if(!ALLOWED_KINDS.has(kind))continue;
    for(const row of (Array.isArray(rows)?rows:[])){
      const rec=importedDefinitionRecord(kind,row,pack); data.records[rec.versionId]=rec;
      const key=`${kind}:${rec.id}`; data.versionGroups[key]=[...(data.versionGroups[key]||[]).filter(v=>v!==rec.versionId),rec.versionId]; affected.push([kind,rec.id]);
    }
  }
  const sourceIds=new Set((pack?.manifest?.source_ids||[]).map(String));
  for(const edge of (pack.evolutionEdges||[])) data.evolutionEdges.push({...deep(edge),raw:deep(edge.raw||edge),_androidImportedPackId:packId});
  const uniqueAffected=[...new Map(affected.map(x=>[`${x[0]}:${x[1]}`,x])).values()];
  for(const ruleset of (data.rulesets||[])) for(const [kind,id] of uniqueAffected) recomputeResolvedDefinition(ruleset.id,kind,id);
}

async function loadNativeContentPacks(){
  const invoke=nativeInvoke(); if(!invoke)return [];
  try{
    const packs=await invoke('load_content_packs');
    for(const pack of (packs||[])){
      const packId=importedPackId(pack);
      const bundled=(data.packs||[]).find(p=>String(p?.id||'')===packId&&!p?.androidImported);
      if(bundled){
        // Migration path: beta builds before these packs became bundled may already
        // have native imported copies in app-data. Keep the user's enabled/disabled
        // choice, but do not overlay a duplicate pack on top of the bundled copy.
        const enabledRulesets=new Set(Array.isArray(pack?.enabledRulesets)?pack.enabledRulesets.map(String):[]);
        for(const ruleset of (data.rulesets||[])){
          if(!(ruleset.packs||[]).some(p=>String(p?.pack_id||'')===packId))continue;
          setBundledPackEnabled(packId,ruleset.id,enabledRulesets.has(String(ruleset.id)),{remember:true});
        }
        continue;
      }
      applyImportedPack(pack);
    }
    return packs||[];
  }
  catch(error){console.warn('Could not load Android content packs',error);return [];}
}

class MobileDefinitions {
  getRulesets(){ return (data.rulesets||[]).map(r=>({id:r.id,name:r.name,version:r.version,description:r.description})); }
  getRuleset(id){ return deep((data.rulesets||[]).find(r=>r.id===id)||null); }
  getPacks(){ return deep(data.packs||[]); }
  _map(rs,kind){ return data.resolved?.[rs]?.[kind]||{}; }
  getResolved({rulesetId,kind,id}){ const vid=this._map(rulesetId,kind)[id],record=data.records?.[vid]; if(!record)return null; const out={...deep(record),kind}; if(kind==='species'){out.capabilities=normalizeCapabilities(out.capabilities||out.raw?.capabilities);out.forms=normalizeSpeciesForms(out.forms||out.raw?.forms||out.raw?.form_definitions||[]);} return out; }
  listResolved({rulesetId,kind,q='',limit=60,offset=0}){
    const needle=norm(q); const ids=Object.keys(this._map(rulesetId,kind)); const rows=[];
    for(const id of ids){ const row=this.getResolved({rulesetId,kind,id}); if(!row)continue; if(needle && !norm(`${id} ${row.name||''} ${row.effect||''} ${JSON.stringify(row.raw||{})}`).includes(needle))continue; rows.push(row); }
    rows.sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id))); return rows.slice(Number(offset)||0,(Number(offset)||0)+(Number(limit)||60));
  }
  countResolved({rulesetId,kind,q=''}){ return this.listResolved({rulesetId,kind,q,limit:100000,offset:0}).length; }
  getVersions({kind,id}){ const vids=data.versionGroups?.[`${kind}:${id}`]||[]; return vids.map(v=>{const record=data.records[v];if(!record)return null;const out={...deep(record),kind};if(kind==='species'){out.capabilities=normalizeCapabilities(out.capabilities||out.raw?.capabilities);out.forms=normalizeSpeciesForms(out.forms||out.raw?.forms||out.raw?.form_definitions||[]);}return out;}).filter(Boolean); }
  getCounts(rulesetId){ const out={}; for(const k of ALLOWED_KINDS)out[k]=Object.keys(this._map(rulesetId,k)).length; return out; }
  getDamageBase(db){ return deep(data.damageBase?.[String(Number(db))]||null); }
  getTypeMatchups(){ return deep(data.typeMatchups||[]); }
  getTypeEffectivenessScale(){ return deep(data.typeEffectivenessScale||[]); }
  getDefensiveTypeProfile(types=[]){
    const defenseTypes=(types||[]).map(x=>String(x||'').trim()).filter(Boolean), matchups=this.getTypeMatchups();
    const attackTypes=[...new Set(matchups.map(r=>r.attack_type))], byKey=new Map(matchups.map(r=>[`${r.attack_type}::${r.defense_type}`,r]));
    const scale=new Map(this.getTypeEffectivenessScale().map(r=>[Number(r.net_steps),Number(r.combat_multiplier)]));
    return attackTypes.map(attackType=>{let immune=false,steps=0;const components=[];for(const defenseType of defenseTypes){const row=byKey.get(`${attackType}::${defenseType}`)||{relation:'neutral'};components.push({defenseType,relation:row.relation});if(row.relation==='immune')immune=true;else if(row.relation==='weak')steps++;else if(row.relation==='resist'||row.relation==='resistant')steps--;}const clamped=Math.max(-3,Math.min(3,steps));const multiplier=immune?0:(scale.get(clamped)??1);return {attackType,relation:immune?'immune':clamped>0?'weak':clamped<0?'resistant':'neutral',netSteps:immune?null:steps,multiplier,components};});
  }
  getPokemonExperience(level){ level=Math.max(1,Math.min(100,Number(level)||1)); return deep((data.experience||[]).find(r=>Number(r.level)===level)||null); }
  getPokemonExperienceTable(){ return deep(data.experience||[]); }
  getPokemonLevelForExperience(exp){ exp=Math.max(0,Number(exp)||0); return deep([...(data.experience||[])].reverse().find(r=>Number(r.cumulative_exp)<=exp)||this.getPokemonExperience(1)); }
  getEvolutionGuidance(){ return deep(data.evolutionGuidance||{}); }
  findResolvedSpeciesByName({rulesetId,name}={}){ const t=norm(name); return this.listResolved({rulesetId,kind:'species',q:name,limit:200}).find(r=>norm(r.name)===t)||null; }
  _edgesTo(name){ return (data.evolutionEdges||[]).filter(e=>norm(e.to_species_name)===norm(name)); }
  _edgesFrom(name){ return (data.evolutionEdges||[]).filter(e=>norm(e.from_species_name)===norm(name)); }
  getIncomingEvolution({speciesName,sourceId=null}={}){ const rows=this._edgesTo(speciesName).sort((a,b)=>(a.source_id===sourceId?-1:0)-(b.source_id===sourceId?-1:0)); const r=rows[0]; return r?{...deep(r),raw:deep(r.raw||{})}:null; }
  getEvolutionAncestry({rulesetId,speciesName,sourceId=null,maxDepth=8}={}){ const out=[],seen=new Set([norm(speciesName)]);let cur=speciesName,src=sourceId;for(let i=0;i<maxDepth;i++){const e=this.getIncomingEvolution({speciesName:cur,sourceId:src});if(!e)break;let a=e.raw?.from_ref_key?this.getResolved({rulesetId,kind:'species',id:String(e.raw.from_ref_key)}):null;if(!a)a=this.findResolvedSpeciesByName({rulesetId,name:e.from_species_name});if(!a||seen.has(norm(a.name||a.id)))break;seen.add(norm(a.name||a.id));out.push({id:a.id,name:a.name,sourceId:a.sourceId,contentPackId:a.contentPackId,levelUpMoves:a.levelUpMoves||[],evolutionEdge:{fromSpeciesName:e.from_species_name,toSpeciesName:e.to_species_name,toMinLevel:e.to_min_level??null,conditionText:e.condition_text||null,sourceId:e.source_id||null}});cur=a.name;src=a.sourceId||e.source_id||src;}return out; }
  getOutgoingEvolutions({rulesetId,speciesName,sourceId=null}={}){ const seen=new Set(),out=[];for(const row of this._edgesFrom(speciesName).sort((a,b)=>(a.source_id===sourceId?-1:0)-(b.source_id===sourceId?-1:0))){const raw=row.raw||{},key=norm(raw.to_ref_key||row.to_species_name);if(seen.has(key))continue;seen.add(key);let target=raw.to_ref_key?this.getResolved({rulesetId,kind:'species',id:String(raw.to_ref_key)}):null;if(!target)target=this.findResolvedSpeciesByName({rulesetId,name:row.to_species_name});if(!target)continue;out.push({fromSpeciesName:row.from_species_name,toSpeciesName:row.to_species_name,toMinLevel:row.to_min_level??null,conditionText:row.condition_text||null,mappingConfidence:row.mapping_confidence||null,sourceId:row.source_id||null,evolutionRulesSource:'ptu_material',sourceTitle:row.source_id||'PTU material',sourceKind:null,target:{id:target.id,name:target.name,versionId:target.versionId,contentPackId:target.contentPackId,sourceId:target.sourceId,types:target.types||[],baseStats:target.baseStats||null,abilities:target.abilities||[],levelUpMoves:target.levelUpMoves||[],capabilities:target.capabilities||[],skills:target.skills||null}});}return out; }
}
const definitions=new MobileDefinitions();
window.__PTU_SPECIES_PORTRAIT__=(speciesId)=>{try{return definitions.getResolved({rulesetId:getActiveRuleset(),kind:'species',id:String(speciesId||'')})?.raw?.portrait_data_url||null;}catch{return null;}};
function loadStore(){ try{return JSON.parse(localStorage.getItem(MOBILE_KEY)||'null');}catch{return null;} }
function initialStore(){ const states=deep(data.states||{}),profiles=deep(data.profiles||[]); return {activeProfileId:data.activeProfileId||profiles[0]?.id||Object.keys(states)[0]||'alex',profiles,states,revisions:{},activeRulesetId:'all-provided-material',packEnabledOverrides:{}}; }
let store=loadStore()||initialStore();
store.packEnabledOverrides ||= {};
function persist(){ localStorage.setItem(MOBILE_KEY,JSON.stringify(store)); }
function persistBundledPackEnabled(packId,rulesetId,enabled){ store.packEnabledOverrides[rulesetId] ||= {}; store.packEnabledOverrides[rulesetId][packId]=!!enabled; persist(); }
function setBundledPackEnabled(packId,rulesetId,enabled,{remember=true}={}){
  const ruleset=(data.rulesets||[]).find(r=>r.id===rulesetId); if(!ruleset)return false;
  const meta=(ruleset.packs||[]).find(p=>String(p.pack_id)===String(packId)); if(!meta)return false;
  meta.enabled=!!enabled; if(remember)persistBundledPackEnabled(packId,rulesetId,enabled);
  const affected=[]; for(const rec of Object.values(data.records||{}))if(String(rec?.contentPackId||'')===String(packId))affected.push([rec.kind,rec.id]);
  for(const [kind,id] of affected)recomputeResolvedDefinition(rulesetId,kind,id);
  return true;
}
function applyStoredPackOverrides(){ for(const [rulesetId,byPack] of Object.entries(store.packEnabledOverrides||{}))for(const [packId,enabled] of Object.entries(byPack||{}))setBundledPackEnabled(packId,rulesetId,!!enabled,{remember:false}); }
function isProtectedBuiltInPack(pack){ return !pack?.androidImported && (String(pack?.id||'')==='ptu-core-1.05' || String(pack?.kind||'')==='official_core'); }
const seed=deep(data.seed||Object.values(data.states||{})[0]||{});
const repo={
  hasProfiles:()=>Object.keys(store.states||{}).length>0,
  getActiveProfileId:()=>store.activeProfileId,
  setActiveProfileId:id=>{store.activeProfileId=id;persist();},
  listProfiles:()=>Object.values(store.states||{}).map(s=>({id:s.trainer?.id||s.activeProfileId,name:s.trainer?.name||'Trainer',title:s.trainer?.title||'Trainer',level:Number(s.trainer?.level||1),portraitDataUrl:s.trainer?.portraitDataUrl||null,active:(s.trainer?.id||s.activeProfileId)===store.activeProfileId})),
  loadState:(id=store.activeProfileId)=>deep(store.states?.[id]||null),
  saveState:(state,{createRevision=false}={})=>{const id=state?.trainer?.id||state?.activeProfileId||store.activeProfileId||'trainer';state.activeProfileId=id;store.states[id]=deep(state);store.activeProfileId=id;if(createRevision){store.revisions[id]||=[];store.revisions[id].unshift({id:Date.now(),created_at:new Date().toISOString(),state:deep(state)});store.revisions[id]=store.revisions[id].slice(0,30);}persist();return {profileId:id,revisionCreated:createRevision};},
  deleteProfile:id=>{delete store.states[id];delete store.revisions[id];const ids=Object.keys(store.states);if(!ids.length){const s=deep(seed);const nid=s.trainer?.id||'trainer';s.activeProfileId=nid;store.states[nid]=s;}if(store.activeProfileId===id)store.activeProfileId=Object.keys(store.states)[0];persist();return store.activeProfileId;},
  listRevisions:(id=store.activeProfileId,limit=10)=>(store.revisions?.[id]||[]).slice(0,limit).map(r=>({id:r.id,created_at:r.created_at})),
  restoreRevision:id=>{const arr=store.revisions?.[store.activeProfileId]||[];const r=arr.find(x=>Number(x.id)===Number(id));if(!r)throw Object.assign(new Error('Revision not found'),{status:404});store.states[store.activeProfileId]=deep(r.state);persist();return deep(r.state);}
};
window.__PTU_RESOLVED_POKEMON_ARTWORK__=(speciesId,formState,isShiny=false,context={})=>{
  try{
    const species=definitions.getResolved({rulesetId:getActiveRuleset(),kind:'species',id:String(speciesId||'')});
    if(!species)return null;
    const resolved=resolvePokemonPresentation({species,formState:formState||{},context:context||{},allowUnmet:true,isShiny:!!isShiny});
    return resolved.presentation?.artworkUrl||species.raw?.portrait_data_url||null;
  }catch{return null;}
};
const db={prepare(sql){return {get(){return {value:store.activeRulesetId||'all-provided-material'};},run(v){if(String(sql).includes('active_ruleset_id')){store.activeRulesetId=String(v);persist();}return {changes:1};}};}};
const getActiveRuleset=()=>store.activeRulesetId||'all-provided-material';
const defaultRuleset='all-provided-material';

function pokemonFormContext({pokemon={},payload={}}={}){
  const details=pokemon?.details||{};
  return {
    level:Number(payload.level??pokemon.level??1),gender:payload.gender??details.gender??pokemon.gender??null,
    heldItemId:details.heldItemDefinitionId||null,heldItemName:pokemon.heldItem||null,heldItem:pokemon.heldItem||null,
    abilities:details.abilities||[],capabilities:details.capabilities||[],tags:details.formTags||[],flags:details.formFlags||{},
    manualApprovals:payload.manualFormApprovals||details.manualFormApprovals||[]
  };
}
function resolveSpeciesFormState({species,pokemon={},payload={},includeActive=true}={}){
  const details=pokemon?.details||{};
  const requested=payload.formState||details.formState||{baseFormId:payload.baseFormId,activeFormId:payload.activeFormId};
  const state=normalizePokemonFormState(requested);
  if(!includeActive)state.activeFormId=null;
  const isShiny=!!(payload.isShiny??details.isShiny??details.is_shiny??false);
  return resolvePokemonPresentation({species,formState:state,context:pokemonFormContext({pokemon,payload}),allowUnmet:!!payload.gmOverride,isShiny});
}

function slugId(value){
  return String(value||'trainer').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'trainer';
}
function uniqueProfileId(name){
  const base=slugId(name);
  let id=base, n=2;
  const existing=new Set(repo.listProfiles().map(p=>p.id));
  while(existing.has(id)) id=`${base}-${n++}`;
  return id;
}
function blankTrainerState({name='New Trainer',title='Trainer'}={}){
  const id=uniqueProfileId(name);
  const clean=structuredClone(seed);
  clean.version=2; clean.activeProfileId=id;
  clean.trainer={
    ...clean.trainer,id,name,title,level:1,exp:0,nextExp:10,money:5000,ptuPoints:0,badges:0,portraitDataUrl:null,
    stats:{hp:10,attack:5,defense:5,spAttack:5,spDefense:5,speed:5},
    derived:{},skills:{},equipment:{head:null,body:null,mainHand:null,offHand:null,feet:null,accessory:null},modifiers:[],gmGrants:[],history:[],
    details:{background:{name:'New Background',adept:'Athletics',novice:'Command',pathetic:['Guile','Intuition','Focus']},skillRanks:Object.fromEntries(['Acrobatics','Athletics','Combat','Intimidate','Stealth','Survival','General Education','Medicine Education','Occult Education','Pokémon Education','Technology Education','Guile','Perception','Charm','Command','Focus','Intuition'].map(k=>[k,2])),features:[],edges:[],moves:[],trainingFeature:null,currentHp:null,injuries:0,currentAp:null,combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}}
  };
  clean.pokemon=[];
  clean.rosters=[{id:`${id}-personal`,name:'Personal Team',role:'COMBAT',maxMembers:6,active:true,color:'#0b7b4b'}];
  clean.inventory=(clean.inventory||[]).map(i=>({...i,qty:0}));
  clean.npcs=[]; clean.selectedPokemonId=null; clean.selectedRosterId=clean.rosters[0].id; clean.selectedNpcId=null;
  clean.shop={preset:'Poké Mart',discountPct:0,mode:'buy',cart:{}};
  clean.ui={screen:'trainer',creatureTab:'sheet',trainerTab:'profile',toast:null,round:1,scene:1,day:1,gmOverride:false};
  return clean;
}

const rulesetHasPack=(rulesetId,packId)=>!!definitions.getRuleset(rulesetId)?.packs?.some(p=>p.enabled&&p.pack_id===packId);
function getMixedPowerPokeEdge(rulesetId){
  if(!rulesetHasPack(rulesetId,'ptu-september-2015-playtest')) return null;
  const source=definitions.getVersions({kind:'features',id:'mixed-power'}).find(v=>v.contentPackId==='ptu-september-2015-playtest');
  return {
    ...(source||{}),kind:'poke_edges',id:'mixed-power',name:'Mixed Power',virtualPokeEdge:true,
    versionId:source?.versionId||'poke_edge:mixed-power@sep2015-adapter',contentPackId:'ptu-september-2015-playtest',
    sourceId:'sep2015',sourcePage:source?.sourcePage||9,packName:source?.packName||'September 2015 Playtest',
    prerequisites:'Level 10; at least 5 Level-Up Stat Points invested in both Attack and Special Attack',
    effect:'The user gains the Twisted Power Ability.',raw:{...(source?.raw||{}),cost_text:'Cost: 2 Tutor Points'}
  };
}


const itemSlug=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const itemIconForCategory=category=>({
  'berry':'🫐','poké ball':'🔴','medicine':'🧪','evolution item':'💎','held item':'🔷','travel gear':'🎒',
  'vitamin':'💊','herb':'🌿','combat item':'⚔️','crafting kit':'🧰','hm':'💿','tm':'💿','refreshment':'🥤',
  'food':'🍱','pokémon toolkit':'🧰','special pokémon item':'◆','repel':'🧴','equipment':'🛡️','weapon':'⚔️','arcane weapon':'🪄'
}[String(category||'').toLowerCase()]||'◆');
function pokemonSpriteCandidates(speciesId,speciesName=''){
  const direct=String(speciesId||'').trim().toLowerCase();
  const compact=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]+/g,'').replace(/^-|-$/g,'');
  const nameSlug=compact(String(speciesName||'').replace(/\s+/g,'-'));
  const candidates=[direct,nameSlug,direct.replace(/-/g,''),nameSlug.replace(/-/g,'')];
  return [...new Set(candidates.filter(Boolean))];
}
async function fetchPokemonPortrait(speciesId,speciesName){
  const candidates=pokemonSpriteCandidates(speciesId,speciesName);
  for(const slug of candidates.slice(0,2)){
    const remote=`https://play.pokemonshowdown.com/sprites/gen5/${encodeURIComponent(slug)}.png`;
    try{
      const response=await fetch(remote,{headers:{'User-Agent':'PTU-Companion-Beta/2.1'},signal:AbortSignal.timeout(1500)});
      const type=response.headers.get('content-type')||'';
      if(response.ok&&type.includes('image')){
        const bytes=Buffer.from(await response.arrayBuffer());
        if(bytes.length>0&&bytes.length<500000)return bytes;
      }
    }catch{}
  }
  // PokeAPI is a fallback only. Its front_default sprite is also intentionally small.
  for(const slug of candidates.slice(0,2)){
    try{
      const meta=await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(slug)}`,{headers:{'User-Agent':'PTU-Companion-Beta/2.1'},signal:AbortSignal.timeout(1500)});
      if(!meta.ok)continue;
      const data=await meta.json(); const sprite=data?.sprites?.front_default; if(!sprite)continue;
      const image=await fetch(sprite,{headers:{'User-Agent':'PTU-Companion-Beta/2.1'},signal:AbortSignal.timeout(1500)}); if(!image.ok)continue;
      const bytes=Buffer.from(await image.arrayBuffer()); if(bytes.length>0&&bytes.length<500000)return bytes;
    }catch{}
  }
  return null;
}

function inventoryItemFromDefinition(definition){
  const raw=definition?.raw||{};
  const usage=itemUsageMetadata(definition);
  return {
    id:definition.id,definitionId:definition.id,icon:raw.icon_data_url||raw.icon_url||raw.icon||itemIconForCategory(definition.category),name:definition.name,
    category:definition.category||'Item',price:Number(definition.price||0),priceText:raw.price_text||null,qty:0,
    consumable:!!raw.consumable,equipSlot:usage.equipSlot,description:definition.effect||raw.effect_text||'',custom:false,
    trainerUsable:usage.trainerUsable,pokemonHeldUsable:usage.pokemonHeldUsable,equipmentSlots:usage.equipmentSlots,
    sourceId:definition.sourceId||null,sourcePage:definition.sourcePage||null,contentPackId:definition.contentPackId||null,definitionVersionId:definition.versionId||null,
    shopCategories:Array.isArray(raw.shop_categories)?raw.shop_categories.map(String):[],shopVisible:raw.shop_visible!==false,mechanics:usage.mechanics,equipmentConfig:raw.equipment_config||null,config:{}
  };
}

function inventoryDefinitionForItem(item,rulesetId){
  if(!item||item.custom)return null;
  const candidates=[item.definitionId,item.id,itemSlug(item.name)].filter(Boolean);
  for(const candidate of candidates){
    const found=definitions.getResolved({rulesetId,kind:'items',id:String(candidate)});
    if(found)return found;
  }
  return null;
}
function hydrateInventoryItem(item,rulesetId){
  if(!item||typeof item!=='object')return item;
  if(item.custom)return {...item,equipmentSlots:Array.isArray(item.equipmentSlots)?item.equipmentSlots:[],equipSlot:null,trainerUsable:false,pokemonHeldUsable:false};
  const definition=inventoryDefinitionForItem(item,rulesetId);
  if(!definition)return item;
  const canonical=inventoryItemFromDefinition(definition);
  return {
    ...item,
    ...canonical,
    id:item.id||canonical.id,
    qty:Number(item.qty||0),
    mechanics:item.mechanics||canonical.mechanics||null,
    config:item.config||{},
    custom:false
  };
}
function hydrateStateForClient(state){
  if(!state)return state;
  const rulesetId=getActiveRuleset();
  state.inventory=Array.isArray(state.inventory)?state.inventory.map(item=>hydrateInventoryItem(item,rulesetId)):[];
  return state;
}
function resolveHeldItemDefinition({rulesetId,pokemon=null,inventoryItem=null}={}){
  const d=pokemon?.details||{};
  const candidates=[d.heldItemDefinitionId,inventoryItem?.definitionId,inventoryItem?.id,itemSlug(inventoryItem?.name),itemSlug(pokemon?.heldItem)].filter(Boolean);
  for(const id of candidates){
    const found=definitions.getResolved({rulesetId,kind:'items',id:String(id)});
    if(found) return found;
  }
  return null;
}
function resolvePokemonHeldItem({rulesetId,pokemon,species=null}={}){
  if(!pokemon?.heldItem) return {definition:null,effect:null};
  const definition=resolveHeldItemDefinition({rulesetId,pokemon});
  if(!definition) return {definition:null,effect:null};
  const outgoing=species?definitions.getOutgoingEvolutions({rulesetId,speciesName:species.name,sourceId:species.sourceId}):[];
  const effect=resolveHeldItemEffect({itemDefinition:definition,config:pokemon?.details?.heldItemConfig||{},pokemon,hasOutgoingEvolution:outgoing.length>0});
  return {definition,effect};
}

const abilitySlug=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function abilitySourceForIndex(index){
  if(index===0) return {kind:'species_starting',label:'Starting Ability',unlockLevel:1};
  if(index===1) return {kind:'level_choice',label:'Level 20 Ability',unlockLevel:20};
  if(index===2) return {kind:'level_choice',label:'Level 40 Ability',unlockLevel:40};
  return {kind:'native_extra',label:`Native Ability ${index+1}`,unlockLevel:null};
}

const capabilityKey=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function normalizeEdgeTarget(edge={}){
  return String(edge.targetId||edge.targetCapabilityId||edge.targetMoveId||edge.targetStat||edge.targetNote||'').trim();
}
function resolvePokemonCapabilities(species,details={}){
  const caps=structuredClone(Array.isArray(species?.capabilities)?species.capabilities:[]);
  const byId=new Map();
  for(const cap of caps){
    if(cap?.kind==='jump'){
      byId.set('high-jump',{kind:'jump_component',parent:cap,field:'high',name:'High Jump'});
      byId.set('long-jump',{kind:'jump_component',parent:cap,field:'long',name:'Long Jump'});
    }
    const id=capabilityKey(cap?.capability_id||cap?.name);
    if(id) byId.set(id,{kind:'capability',cap,name:cap?.name||id});
  }
  const applied=[];
  for(const edge of (Array.isArray(details.pokeEdges)?details.pokeEdges:[])){
    const edgeId=capabilityKey(edge?.id||edge?.name);
    const target=capabilityKey(normalizeEdgeTarget(edge));
    if(!target) continue;
    if(edgeId==='advanced-mobility'){
      const rec=byId.get(target);
      if(rec?.kind==='capability' && rec.cap?.kind==='movement'){
        rec.cap.value=(Number(rec.cap.value)||0)+2;
        applied.push({edgeId,targetId:target,targetName:rec.name,operation:'add',value:2});
      }
    } else if(edgeId==='capability-training'){
      const rec=byId.get(target);
      if(target==='power' && rec?.kind==='capability'){
        rec.cap.value=(Number(rec.cap.value)||0)+1;
        applied.push({edgeId,targetId:target,targetName:'Power',operation:'add',value:1});
      } else if((target==='high-jump'||target==='long-jump') && rec?.kind==='jump_component'){
        rec.parent[rec.field]=(Number(rec.parent[rec.field])||0)+1;
        applied.push({edgeId,targetId:target,targetName:rec.name,operation:'add',value:1});
      }
    }
  }
  return {capabilities:caps,applied};
}
function accuracyTrainingMap(details={}){
  const out=new Map();
  for(const edge of (Array.isArray(details.pokeEdges)?details.pokeEdges:[])){
    if(capabilityKey(edge?.id||edge?.name)!=='accuracy-training') continue;
    const target=capabilityKey(normalizeEdgeTarget(edge));
    if(!target) continue;
    out.set(target,(out.get(target)||0)+1);
  }
  return out;
}

function emptyStatMap(){ return Object.fromEntries(STAT_KEYS.map(k=>[k,0])); }
function addStatMaps(...maps){
  const out=emptyStatMap();
  for(const map of maps) for(const k of STAT_KEYS) out[k]+=Number(map?.[k]||0);
  return out;
}
function speciesBaseStatTotal(species){
  const base=normalizeBaseStats(species?.baseStats||species?.base_stats||{});
  return STAT_KEYS.reduce((sum,k)=>sum+Number(base[k]||0),0);
}
function edgeStatAllocation(edge){ return normalizeAllocations(edge?.statAllocation||edge?.statAllocations||{}); }
function resolvePokemonPokeEdgeStats({pokemon,species,detailsOverride=null,excludedEdgeInstances=[]}={}){
  const details=detailsOverride||pokemon?.details||{};
  const excluded=new Set((excludedEdgeInstances||[]).map(String));
  const edges=(Array.isArray(details.pokeEdges)?details.pokeEdges:[]).filter(e=>!excluded.has(String(e?.instanceId||'')));
  const base=normalizeBaseStats(species?.baseStats||species?.base_stats||details.baseStats||{});
  const baseBonus=emptyStatMap(); const bonusAllocation=emptyStatMap(); const applied=[]; const unresolved=[];
  const hasStrength=edges.some(e=>capabilityKey(e?.id||e?.name)==='underdogs-strength');
  if(hasStrength){
    for(const k of STAT_KEYS) baseBonus[k]+=1;
    applied.push({edgeId:'underdogs-strength',name:"Underdog's Strength",kind:'base_stat_bonus',stats:Object.fromEntries(STAT_KEYS.map(k=>[k,1]))});
  }
  for(const edge of edges){
    const id=capabilityKey(edge?.id||edge?.name);
    if(id!=='realized-potential' && id!=='mixed-sweeper') continue;
    const allocation=edgeStatAllocation(edge); const spent=STAT_KEYS.reduce((sum,k)=>sum+allocation[k],0);
    const storedExpected=edge?.statAllocationPoints==null?NaN:Number(edge.statAllocationPoints);
    // Realized Potential keys off the Species' canonical Base Stat Total.
    // Underdog's Strength modifies the Pokémon's Base Stats, but does not rewrite
    // the Species BST used to determine how many Realized Potential points are gained.
    const canonicalSpeciesBst=speciesBaseStatTotal(species);
    const expected=id==='realized-potential'?(Number.isFinite(storedExpected)&&storedExpected>=0?storedExpected:(spent>0?spent:Math.max(0,45-canonicalSpeciesBst))):3;
    if(spent!==expected){
      unresolved.push({instanceId:edge?.instanceId||null,edgeId:id,name:edge?.name||id,expected,spent});
      continue;
    }
    for(const k of STAT_KEYS) bonusAllocation[k]+=allocation[k];
    applied.push({edgeId:id,name:edge?.name||id,kind:'bonus_stat_allocation',stats:allocation,points:spent});
  }
  const modifiedBase=addStatMaps(base,baseBonus);
  const natureAdjusted=applyNature(modifiedBase,details.nature||'Hardy').stats;
  const levelAllocation=normalizeAllocations(details.statAllocations||{});
  const permanentFinal=addStatMaps(natureAdjusted,levelAllocation,bonusAllocation);
  const maxHp=Math.max(1,Number(pokemon?.level||1))+(Number(permanentFinal.hp||0)*3)+10;
  const exemptions=relationExemptionsFromPokeEdges(edges);
  const relationViolations=validateBaseRelations(natureAdjusted,permanentFinal,{exemptStats:exemptions});
  return {speciesBase:base,speciesBaseTotal:speciesBaseStatTotal(species),baseBonus,modifiedBase,natureAdjusted,levelAllocation,bonusAllocation,permanentFinal,maxHp,
    evolutionLocked:hasStrength,evolutionLockSource:hasStrength?"Underdog's Strength":null,applied,unresolved,baseRelations:{valid:relationViolations.length===0,violations:relationViolations,exemptStats:exemptions}};
}
function resolvePokemonSkills(species,details={}){
  const rawSkills=Array.isArray(species?.raw?.skills)?species.raw.skills:[];
  const skills=rawSkills.map(s=>({id:capabilityKey(s.skill),name:String(s.skill||''),dice:Number(s.dice||0),modifier:Number(s.modifier||0),defaultDice:Number(s.dice||0),defaultModifier:Number(s.modifier||0),pokeEdgeRanks:0})).filter(s=>s.id&&s.name);
  const byId=new Map(skills.map(s=>[s.id,s])); const applied=[];
  for(const edge of (Array.isArray(details.pokeEdges)?details.pokeEdges:[])){
    if(capabilityKey(edge?.id||edge?.name)!=='skill-improvement')continue;
    const target=capabilityKey(normalizeEdgeTarget(edge)); const rec=byId.get(target); if(!rec)continue;
    rec.dice+=1; rec.pokeEdgeRanks+=1; applied.push({edgeId:'skill-improvement',targetId:target,targetName:rec.name,value:1});
  }
  return {skills,applied};
}
function statAllocationTargetMeta(edge,species,details={}){
  const id=capabilityKey(edge?.id||edge?.name);
  if(id==='realized-potential'){
    const points=Math.max(0,45-speciesBaseStatTotal(species));
    return {allocationRequired:points>0,allocationPoints:points,allocationAllowedStats:[...STAT_KEYS],allocationLabel:'Bonus Stat Points'};
  }
  if(id==='mixed-sweeper') return {allocationRequired:true,allocationPoints:3,allocationAllowedStats:['hp','defense','special_defense','speed'],allocationLabel:'Mixed Sweeper Stat Points'};
  return {allocationRequired:false,allocationPoints:0,allocationAllowedStats:[],allocationLabel:null};
}

function applyPokeEdgeStatsToPreview({preview,pokemon,species,gmOverride=false,excludedEdgeInstances=[]}={}){
  if(!preview||!species)return preview;
  const originalDetails=pokemon?.details||{};
  const syntheticDetails={...JSON.parse(JSON.stringify(originalDetails)),nature:typeof preview.nature==='string'?preview.nature:(preview.nature?.name||originalDetails.nature||'Hardy'),statAllocations:{...(preview.statAllocations||originalDetails.statAllocations||{})},baseStats:{...(preview.baseStats||originalDetails.baseStats||{})},finalStats:{...(preview.finalStats||originalDetails.finalStats||{})}};
  const syntheticPokemon={...pokemon,level:Number(preview.targetLevel??preview.level??pokemon?.level??1),details:syntheticDetails};
  const edgeStats=resolvePokemonPokeEdgeStats({pokemon:syntheticPokemon,species,detailsOverride:syntheticDetails,excludedEdgeInstances});
  preview.resolvedStatEffects=edgeStats;
  preview.resolvedFinalStats={...edgeStats.permanentFinal};
  preview.resolvedMaxHp=edgeStats.maxHp;
  const edgeErrors=edgeStats.baseRelations.violations.map(v=>v.message);
  if(edgeErrors.length&&!gmOverride){
    preview.errors=[...new Set([...(preview.errors||[]),...edgeErrors])];
    preview.valid=false;
  }
  return preview;
}
function buildPokeEdgeTargetOptions({edge,pokemon,species,rulesetId}={}){
  const details=pokemon?.details||{};
  const edgeId=capabilityKey(edge?.id||edge?.name);
  const owned=(Array.isArray(details.pokeEdges)?details.pokeEdges:[]).filter(e=>capabilityKey(e?.id||e?.name)===edgeId);
  const used=new Set(owned.map(e=>capabilityKey(normalizeEdgeTarget(e))).filter(Boolean));
  if(edgeId==='advanced-mobility'){
    const resolved=resolvePokemonCapabilities(species,details).capabilities;
    return resolved.filter(c=>c?.kind==='movement').map(c=>({id:capabilityKey(c.capability_id||c.name),label:`${c.name} ${c.value??''}`.trim(),kind:'capability',currentValue:Number(c.value)||0})).filter(o=>!used.has(o.id));
  }
  if(edgeId==='capability-training'){
    const resolved=resolvePokemonCapabilities(species,details).capabilities;
    const options=[];
    const power=resolved.find(c=>capabilityKey(c.capability_id||c.name)==='power');
    if(power) options.push({id:'power',label:`Power ${power.value??0}`,kind:'capability',currentValue:Number(power.value)||0});
    const jump=resolved.find(c=>c?.kind==='jump'||capabilityKey(c?.name)==='jump');
    if(jump){
      options.push({id:'high-jump',label:`High Jump ${jump.high??0}`,kind:'capability',currentValue:Number(jump.high)||0});
      options.push({id:'long-jump',label:`Long Jump ${jump.long??0}`,kind:'capability',currentValue:Number(jump.long)||0});
    }
    return options.filter(o=>!used.has(o.id));
  }
  if(edgeId==='accuracy-training'){
    const moves=Array.isArray(details.moves)?details.moves:[];
    return moves.map(m=>{
      const id=capabilityKey(m.id||m.name); const def=id?definitions.getResolved({rulesetId,kind:'moves',id}):null;
      const ac=Number(def?.ac);
      return {id,label:`${m.name}${Number.isFinite(ac)?` · AC ${ac}`:''}`,kind:'move',moveName:m.name,baseAc:Number.isFinite(ac)?ac:null};
    }).filter(o=>o.id && o.baseAc!=null && o.baseAc>=3 && !used.has(o.id));
  }
  if(edgeId==='skill-improvement'){
    const resolved=resolvePokemonSkills(species,details);
    return resolved.skills.map(skill=>({
      id:skill.id,
      label:`${skill.name} · ${skill.dice}d6${skill.modifier>0?`+${skill.modifier}`:skill.modifier<0?skill.modifier:''} → ${skill.dice+1}d6${skill.modifier>0?`+${skill.modifier}`:skill.modifier<0?skill.modifier:''}`,
      kind:'skill',skillName:skill.name,currentDice:skill.dice,currentModifier:skill.modifier,defaultDice:skill.defaultDice,defaultModifier:skill.defaultModifier
    })).filter(o=>!used.has(o.id) && o.currentDice<=o.defaultDice);
  }
  return [];
}
function removeDerivedEffectsForRefund(details,removedEdge){
  const id=capabilityKey(removedEdge?.id||removedEdge?.name);
  if(id==='mixed-power'){
    const stillOwned=(details.pokeEdges||[]).some(e=>capabilityKey(e?.id||e?.name)==='mixed-power');
    if(!stillOwned){
      details.grantedAbilities=(details.grantedAbilities||[]).filter(a=>!(capabilityKey(typeof a==='string'?a:a?.name)==='twisted-power' && capabilityKey(a?.sourceId||'')==='mixed-power'));
    }
  }
  details.baseRelationExemptStats=relationExemptionsFromPokeEdges(details.pokeEdges||[]);
}
function nativeAbilitySlotsForSpecies(species,level){
  const native=eligibleAbilities(species?.abilities||species?.ability_slots||[]);
  return levelAbilitySlots(level).map((slot,index)=>({
    ...slot,index,
    options:native.filter(a=>slot.allowedCategories.includes(a.category)).map(a=>({name:a.name,category:a.category,slot:a.slot||null}))
  }));
}
function resolveCreatureAbilityRecords({pokemon,species,rulesetId,heldItemEffect=null}){
  const details=pokemon?.details||{};
  const records=[];
  const structured=Array.isArray(details.abilityRecords)?details.abilityRecords:[];
  const storedNames=Array.isArray(details.abilities)?details.abilities.filter(Boolean):[];
  const structuredNative=structured.filter(r=>['species_starting','level_choice','native_extra'].includes(String(r?.sourceKind||''))).map(r=>r?.name).filter(Boolean);
  const nativeNames=[...storedNames];
  for(const name of structuredNative) if(!nativeNames.some(x=>abilitySlug(x)===abilitySlug(name))) nativeNames.push(name);
  nativeNames.forEach((name,index)=>{
    const prior=structured.find(r=>abilitySlug(r?.name)===abilitySlug(name) && String(r?.sourceKind||'').startsWith('species')) || structured[index];
    const src=abilitySourceForIndex(index);
    records.push({
      name:String(name),sourceKind:prior?.sourceKind||src.kind,sourceLabel:prior?.sourceLabel||src.label,
      unlockLevel:prior?.unlockLevel??src.unlockLevel,selectedAtLevel:prior?.selectedAtLevel??src.unlockLevel,
      sourceId:prior?.sourceId||species?.id||null,sourceVersionId:prior?.sourceVersionId||species?.versionId||null,
      grantSource:null,index
    });
  });
  const granted=Array.isArray(details.grantedAbilities)?details.grantedAbilities:[];
  granted.forEach((entry,index)=>{
    const obj=typeof entry==='string'?{name:entry}:entry||{};
    if(!obj.name) return;
    records.push({name:String(obj.name),sourceKind:obj.source||'granted',sourceLabel:obj.sourceId==='mixed-power'?'Granted by Mixed Power':'Granted Ability',unlockLevel:null,selectedAtLevel:null,sourceId:obj.sourceId||null,sourceVersionId:obj.sourceVersionId||null,grantSource:obj,index:nativeNames.length+index});
  });
  const heldGranted=Array.isArray(heldItemEffect?.grantedAbilities)?heldItemEffect.grantedAbilities:[];
  heldGranted.forEach(name=>records.push({name:String(name),sourceKind:'held_item',sourceLabel:`Granted by ${heldItemEffect.name}`,unlockLevel:null,selectedAtLevel:null,sourceId:heldItemEffect.id,sourceVersionId:heldItemEffect.versionId||null,grantSource:{name:String(name),source:'held_item',sourceId:heldItemEffect.id}}));
  const hasMixed=(details.pokeEdges||[]).some(e=>abilitySlug(e?.id||e?.name)==='mixed-power');
  if(hasMixed && !records.some(r=>abilitySlug(r.name)==='twisted-power')){
    const edge=(details.pokeEdges||[]).find(e=>abilitySlug(e?.id||e?.name)==='mixed-power');
    const grant={name:'Twisted Power',source:'poke_edge',sourceId:'mixed-power',sourceVersionId:edge?.sourceVersionId||null,derived:true};
    records.push({name:'Twisted Power',sourceKind:'poke_edge',sourceLabel:'Granted by Mixed Power',unlockLevel:null,selectedAtLevel:null,sourceId:'mixed-power',sourceVersionId:edge?.sourceVersionId||null,grantSource:grant,index:records.length});
  }
  const merged=[]; const byId=new Map();
  for(const rec of records){
    const id=abilitySlug(rec.name); if(!id) continue;
    if(byId.has(id)){
      const existing=byId.get(id); existing.sources.push({...rec});
      if(rec.grantSource && !existing.grantSource) existing.grantSource=rec.grantSource;
      continue;
    }
    const definition=definitions.getResolved({rulesetId,kind:'abilities',id});
    const full={...rec,id,definition,sources:[{...rec}]}; byId.set(id,full); merged.push(full);
  }
  return merged;
}
function resolvedCreatureModel({pokemon,species,rulesetId,heldItemEffect=null,heldItemDefinition=null}){
  const details=pokemon?.details||{};
  const abilities=resolveCreatureAbilityRecords({pokemon,species,rulesetId,heldItemEffect});
  const edgeStats=resolvePokemonPokeEdgeStats({pokemon,species});
  const resolvedPokemon={...pokemon,details:{...details,finalStats:{...edgeStats.permanentFinal}}};
  const modifierSummary=getPokemonModifierSummary(resolvedPokemon,{heldItemEffect});
  const effectiveStats=applyHeldItemToEffectiveStats(edgeStats.permanentFinal,heldItemEffect);
  const capabilityResolution=resolvePokemonCapabilities(species,details);
  const skillResolution=resolvePokemonSkills(species,details);
  const accuracyTraining=Object.fromEntries(accuracyTrainingMap(details));
  return {
    pokemonId:pokemon?.id||null,speciesId:species?.id||null,level:Number(pokemon?.level||1),
    stats:{stored:{...(details.finalStats||{})},permanent:{...edgeStats.permanentFinal},effective:effectiveStats,breakdown:edgeStats},
    skills:skillResolution.skills,skillModifiers:skillResolution.applied,
    moveLimit:{base:Number(details.moveLimitBase??6),modifier:Number(details.moveLimitModifier??0),effective:Number(details.moveLimitEffective??6)},
    abilities,modifierSummary,
    capabilities:capabilityResolution.capabilities,capabilityModifiers:capabilityResolution.applied,accuracyTraining,
    heldItem:pokemon?.heldItem?{name:pokemon.heldItem,definition:heldItemDefinition,effect:heldItemEffect}:null,
    relationExemptions:edgeStats.baseRelations.exemptStats,
    evolutionLocked:edgeStats.evolutionLocked,evolutionLockSource:edgeStats.evolutionLockSource
  };
}

function json(res,status,data){res.status=status;res.data=data;return true;}
async function bodyJson(req){return req._body||{};}

async function handleApi(req,res,url){
  if((req.method==='POST' || req.method==='GET') && url.pathname==='/api/desktop/heartbeat'){
    lastDesktopHeartbeat=Date.now();
    desktopHeartbeatSeen=true;
    return json(res,200,{ok:true,desktopSession});
  }
  if(req.method==='GET' && url.pathname==='/api/health'){
    return json(res,200,{ok:true,version:'2.2.0-android-beta.22',persistence:'android-local',database:'app-data/content-packs + WebView local storage',schemaVersion:5,definitions:{database:'embedded mobile bundle + installed .ptucp overlays',activeRuleset:getActiveRuleset()}});
  }
  if(req.method==='GET' && url.pathname==='/api/rulesets'){
    const activeRulesetId=getActiveRuleset();
    return json(res,200,{activeRulesetId,rulesets:definitions.getRulesets().map(r=>({id:r.id,name:r.name,version:r.version,description:r.description}))});
  }
  if(req.method==='GET' && url.pathname==='/api/rulesets/active'){
    const id=getActiveRuleset();
    return json(res,200,{activeRulesetId:id,ruleset:definitions.getRuleset(id),counts:definitions.getCounts(id)});
  }
  if(req.method==='PUT' && url.pathname==='/api/rulesets/active'){
    const payload=await bodyJson(req);
    const id=String(payload.id||'');
    if(!definitions.getRuleset(id)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    db.prepare(`INSERT INTO app_meta(key,value) VALUES('active_ruleset_id',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(id);
    return json(res,200,{ok:true,activeRulesetId:id,ruleset:definitions.getRuleset(id),counts:definitions.getCounts(id)});
  }
  if(req.method==='GET' && url.pathname==='/api/content-packs'){
    const activeRulesetId=getActiveRuleset();
    const enabled=new Set((definitions.getRuleset(activeRulesetId)?.packs||[]).filter(p=>p.enabled).map(p=>String(p.pack_id)));
    return json(res,200,{activeRulesetId,packs:definitions.getPacks().map(p=>({...p,enabled:enabled.has(String(p.id)),imported:!!p.androidImported,removable:!!p.androidImported,builtIn:!p.androidImported,toggleable:!isProtectedBuiltInPack(p),locked:isProtectedBuiltInPack(p),requiredBy:installedRequiredDependents(p.id).map(x=>({id:x.id,name:x.name}))}))});
  }
  const packEnabledRoute=url.pathname.match(/^\/api\/content-packs\/([^/]+)\/enabled$/);
  if(req.method==='PUT' && packEnabledRoute){
    const payload=await bodyJson(req); const invoke=nativeInvoke();
    const packId=decodeURIComponent(packEnabledRoute[1]); const rulesetId=String(payload.rulesetId||getActiveRuleset()); const enabled=!!payload.enabled;
    const pack=definitions.getPacks().find(p=>String(p.id)===packId);
    if(!pack) throw Object.assign(new Error(`Content Pack is not installed: ${packId}`),{status:404});
    if(isProtectedBuiltInPack(pack)) throw Object.assign(new Error('The PTU Core pack is required by the application and cannot be disabled.'),{status:400});
    if(enabled){
      const missing=requiredDependenciesForPack(pack).filter(id=>!packEnabledInRuleset(id,rulesetId));
      if(missing.length) throw Object.assign(new Error(`Required pack(s) are disabled in this Ruleset: ${missing.join(', ')}`),{status:400});
    }else{
      const dependents=activeRequiredDependents(packId,rulesetId);
      if(dependents.length) throw Object.assign(new Error(`This pack is required by active pack(s): ${dependents.map(x=>x.name||x.id).join(', ')}`),{status:400});
    }
    if(pack.androidImported){
      if(!invoke) throw Object.assign(new Error('Native Android Content Pack management is unavailable in this runtime.'),{status:501});
      const updated=await invoke('set_content_pack_enabled',{packId,rulesetId,enabled});
      applyImportedPack(updated);
      return json(res,200,{ok:true,pack:{id:importedPackId(updated),name:importedPackName(updated),version:importedPackVersion(updated),enabled:packEnabledInRuleset(packId,rulesetId)},activeRulesetId:getActiveRuleset(),counts:definitions.getCounts(getActiveRuleset())});
    }
    if(!setBundledPackEnabled(packId,rulesetId,enabled)) throw Object.assign(new Error('This bundled pack is not part of the selected Ruleset.'),{status:400});
    return json(res,200,{ok:true,pack:{id:pack.id,name:pack.name,version:pack.version,enabled:packEnabledInRuleset(packId,rulesetId)},activeRulesetId:getActiveRuleset(),counts:definitions.getCounts(getActiveRuleset())});
  }
  const packDeleteRoute=url.pathname.match(/^\/api\/content-packs\/([^/]+)$/);
  if(req.method==='DELETE' && packDeleteRoute){
    const invoke=nativeInvoke(); if(!invoke) throw Object.assign(new Error('Native Android Content Pack management is unavailable in this runtime.'),{status:501});
    const packId=decodeURIComponent(packDeleteRoute[1]); const pack=definitions.getPacks().find(p=>String(p.id)===packId);
    if(!pack) throw Object.assign(new Error(`Content Pack is not installed: ${packId}`),{status:404});
    if(!pack.androidImported) throw Object.assign(new Error('Bundled Android Content Packs cannot be uninstalled.'),{status:400});
    const dependents=installedRequiredDependents(packId);
    if(dependents.length) throw Object.assign(new Error(`This pack is required by installed pack(s): ${dependents.map(x=>x.name||x.id).join(', ')}`),{status:400});
    const result=await invoke('uninstall_content_pack',{packId});
    removeImportedPackAndRecompute(packId);
    return json(res,200,{ok:true,result,activeRulesetId:getActiveRuleset(),counts:definitions.getCounts(getActiveRuleset())});
  }
  if(req.method==='POST' && url.pathname==='/api/content-packs/import'){
    const payload=await bodyJson(req); const invoke=nativeInvoke();
    if(!invoke) throw Object.assign(new Error('Native Android content-pack import is unavailable in this runtime.'),{status:501});
    const archiveB64=String(payload.archiveB64||''); const archiveFilename=String(payload.archiveFilename||'import.ptucp');
    if(!archiveB64) throw Object.assign(new Error('No .ptucp archive was received.'),{status:400});
    const enableRulesetId=String(payload.enableRulesetId||getActiveRuleset());
    const availablePackIds=definitions.getPacks().map(p=>String(p.id));
    const pack=await invoke('import_content_pack',{archiveB64,archiveFilename,enableRulesetId,availablePackIds});
    applyImportedPack(pack);
    return json(res,200,{ok:true,pack:{id:importedPackId(pack),name:importedPackName(pack),version:importedPackVersion(pack),counts:pack.counts||{},warnings:pack.warnings||[],archiveSha256:pack.archiveSha256||null,enabled:packEnabledInRuleset(importedPackId(pack),enableRulesetId)},activeRulesetId:getActiveRuleset(),counts:definitions.getCounts(getActiveRuleset())});
  }
  if(req.method==='GET' && url.pathname==='/api/definitions/status'){
    const id=getActiveRuleset();
    return json(res,200,{ok:true,activeRulesetId:id,ruleset:definitions.getRuleset(id),counts:definitions.getCounts(id),kinds:[...ALLOWED_KINDS]});
  }
  if(req.method==='GET' && url.pathname==='/api/definitions'){
    const kind=String(url.searchParams.get('kind')||'species');
    const rulesetId=String(url.searchParams.get('ruleset')||getActiveRuleset());
    const q=String(url.searchParams.get('q')||'');
    const limit=Number(url.searchParams.get('limit')||60);
    const offset=Number(url.searchParams.get('offset')||0);
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const rows=definitions.listResolved({rulesetId,kind,q,limit,offset});
    const total=definitions.countResolved({rulesetId,kind,q});
    return json(res,200,{rulesetId,kind,q,total,rows});
  }
  if(req.method==='GET' && url.pathname==='/api/items/catalog'){
    const rulesetId=String(url.searchParams.get('ruleset')||getActiveRuleset());
    const q=String(url.searchParams.get('q')||'').trim();
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const total=definitions.countResolved({rulesetId,kind:'items',q});
    const summaries=[];
    for(let offset=0; offset<total; offset+=200) summaries.push(...definitions.listResolved({rulesetId,kind:'items',q,limit:200,offset}));
    const items=summaries.map(summary=>inventoryItemFromDefinition(definitions.getResolved({rulesetId,kind:'items',id:summary.id})));
    return json(res,200,{rulesetId,total,items});
  }
  const defMatch=url.pathname.match(/^\/api\/definitions\/([a-z_]+)\/([^/]+)$/);
  if(req.method==='GET' && defMatch){
    const kind=decodeURIComponent(defMatch[1]);
    const id=decodeURIComponent(defMatch[2]);
    const rulesetId=String(url.searchParams.get('ruleset')||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const definition=definitions.getResolved({rulesetId,kind,id});
    if(!definition) return json(res,404,{error:'Definition not found in active ruleset'});
    return json(res,200,{rulesetId,definition,versions:definitions.getVersions({kind,id})});
  }
  const dbMatch=url.pathname.match(/^\/api\/damage-base\/(\d+)$/);
  if(req.method==='GET' && dbMatch){
    const row=definitions.getDamageBase(Number(dbMatch[1]));
    return row?json(res,200,row):json(res,404,{error:'Damage Base not found'});
  }
  const portraitMatch=url.pathname.match(/^\/api\/pokemon\/portrait\/([^/]+)$/);
  if(req.method==='GET' && portraitMatch) return json(res,200,{mobilePortrait:true});
  if(req.method==='GET' && url.pathname==='/api/pokemon/natures'){
    return json(res,200,{natures:NATURES});
  }
  if(req.method==='GET' && url.pathname==='/api/pokemon/evolution-guidance'){
    return json(res,200,definitions.getEvolutionGuidance());
  }
  if(req.method==='POST' && url.pathname==='/api/pokemon/forms/resolve'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const pokemon=payload.pokemon||{}; const details=pokemon.details||{};
    const speciesId=String(payload.speciesId||details.speciesDefinitionId||'');
    const baseSpecies=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!baseSpecies)return json(res,404,{error:'Species definition not found in active ruleset'});
    const resolution=resolveSpeciesFormState({species:baseSpecies,pokemon,payload,includeActive:payload.includeActive!==false});
    return json(res,resolution.valid?200:400,{rulesetId,baseSpecies:{id:baseSpecies.id,name:baseSpecies.name,forms:baseSpecies.forms||[]},...resolution});
  }
  if(req.method==='POST' && url.pathname==='/api/pokemon/build-preview'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const speciesId=String(payload.speciesId||'');
    const baseSpecies=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!baseSpecies) return json(res,404,{error:'Species definition not found in active ruleset'});
    const buildFormResolution=resolveSpeciesFormState({species:baseSpecies,pokemon:{level:payload.level,details:{}},payload});
    if(!buildFormResolution.valid)return json(res,400,{error:'Selected Pokémon Form is not valid.',formResolution:buildFormResolution});
    const species=buildFormResolution.species;
    const incomingEvolution=definitions.getIncomingEvolution({speciesName:species.name,sourceId:species.sourceId});
    const preEvolutionSpecies=definitions.getEvolutionAncestry({rulesetId,speciesName:species.name,sourceId:species.sourceId});
    const allocations=payload.autoAllocate
      ? autoBalancedAllocations({baseStats:species.baseStats,nature:payload.nature,level:payload.level})
      : payload.allocations;
    let preview=buildPokemonPreview({
      species,level:payload.level,nature:payload.nature,allocations,
      selectedAbilities:payload.selectedAbilities,selectedMoves:payload.autoSelectMoves?[]:payload.selectedMoves,
      incomingEvolution,preEvolutionSpecies,gmMoves:payload.gmMoves,
      moveLimitModifier:payload.moveLimitModifier,gmOverride:payload.gmOverride
    });
    if(payload.autoSelectMoves){
      preview=buildPokemonPreview({
        species,level:payload.level,nature:payload.nature,allocations,
        selectedAbilities:payload.selectedAbilities,selectedMoves:preview.defaultMoves,
        incomingEvolution,preEvolutionSpecies,gmMoves:payload.gmMoves,
        moveLimitModifier:payload.moveLimitModifier,gmOverride:payload.gmOverride
      });
    }
    return json(res,200,{rulesetId,species:{id:species.id,name:species.name,types:species.types||[],versionId:species.versionId,contentPackId:species.contentPackId,sourceId:species.sourceId},formResolution:buildFormResolution,experience:definitions.getPokemonExperience(preview.level),preview});
  }
  if(req.method==='GET' && url.pathname==='/api/pokemon/experience'){
    const level=Math.max(1,Math.min(100,Number(url.searchParams.get('level')||1)));
    const row=definitions.getPokemonExperience(level);
    const next=level<100?definitions.getPokemonExperience(level+1):null;
    return json(res,200,{level,row,next});
  }
  if(req.method==='POST' && url.pathname==='/api/pokemon/progression-preview'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const pokemon=payload.pokemon||{}; const details=pokemon.details||{};
    const speciesId=String(details.speciesDefinitionId||payload.speciesId||'');
    const baseSpecies=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!baseSpecies) return json(res,404,{error:'Current Species definition not found in active ruleset'});
    const progressionFormResolution=resolveSpeciesFormState({species:baseSpecies,pokemon,payload,includeActive:false});
    if(!progressionFormResolution.valid)return json(res,400,{error:'Stored permanent Pokémon Form state is not valid.',formResolution:progressionFormResolution});
    const species=progressionFormResolution.species;
    const evolutions=definitions.getOutgoingEvolutions({rulesetId,speciesName:baseSpecies.name,sourceId:baseSpecies.sourceId});
    let selectedEvolution=null;
    if(payload.evolutionSpeciesId){
      selectedEvolution=evolutions.find(e=>e.target.id===String(payload.evolutionSpeciesId));
      if(!selectedEvolution) return json(res,400,{error:'Selected evolution is not an outgoing evolution from the current Species'});
    }
    const experienceTable=definitions.getPokemonExperienceTable();
    const preview=buildPokemonProgressionPreview({
      pokemon,species,experienceTable,expGain:payload.expGain,targetLevel:payload.targetLevel,newStatAllocations:payload.newStatAllocations,
      selectedAbilities:payload.selectedAbilities,selectedMoves:payload.selectedMoves,
      evolutionTarget:selectedEvolution?.target||null,evolutionEdge:selectedEvolution||null,evolutionAllocations:payload.evolutionAllocations,
      manualEvolutionCondition:!!payload.manualEvolutionCondition,gmOverride:!!payload.gmOverride,
      baseRelationExemptStats:relationExemptionsFromPokeEdges(details.pokeEdges||[])
    });
    const strengthOwned=(details.pokeEdges||[]).some(e=>capabilityKey(e?.id||e?.name)==='underdogs-strength');
    if(selectedEvolution&&strengthOwned&&!payload.gmOverride){
      preview.errors=[...new Set([...(preview.errors||[]),"Underdog's Strength prevents this Pokémon from evolving."])];
      preview.valid=false;
    }
    const removedForEvolution=[];
    if(selectedEvolution && speciesBaseStatTotal(selectedEvolution.target)>=45){
      for(const edge of (details.pokeEdges||[])) if(capabilityKey(edge?.id||edge?.name)==='realized-potential') removedForEvolution.push(edge);
    }
    const targetSpecies=selectedEvolution?.target||species;
    applyPokeEdgeStatsToPreview({preview,pokemon,species:targetSpecies,gmOverride:!!payload.gmOverride,excludedEdgeInstances:removedForEvolution.map(e=>e.instanceId).filter(Boolean)});
    preview.pokeEdgeChanges={
      remove:removedForEvolution.map(e=>({instanceId:e.instanceId||null,id:e.id,name:e.name,cost:Number(e.cost||0),reason:'Evolved to a Species with Base Stat Total 45 or higher.'})),
      tutorPointRefund:removedForEvolution.reduce((sum,e)=>sum+Number(e.cost||0),0)
    };
    const candidates=evolutions.map(e=>({
      ...e,levelEligible:e.toMinLevel==null||preview.targetLevel>=Number(e.toMinLevel),
      manualConditionRequired:!!(e.conditionText && !/^minimum\s+\d+$/i.test(String(e.conditionText).trim())),
      blockedByPokeEdge:strengthOwned?"Underdog's Strength":null
    }));
    return json(res,200,{rulesetId,currentSpecies:{id:species.id,name:species.name,types:species.types||[],versionId:species.versionId,contentPackId:species.contentPackId,sourceId:species.sourceId},formResolution:progressionFormResolution,evolutionCandidates:candidates,preview});
  }

  if(req.method==='POST' && url.pathname==='/api/trainer/reference-data'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const trainer=payload.trainer||{};
    const resolvedTrainer=resolveTrainerModel({
      trainer,rulesetId,
      getDefinition:args=>definitions.getResolved(args),
      getDamageBase:db=>definitions.getDamageBase(db)
    });
    return json(res,200,{rulesetId,resolvedTrainer});
  }

  if(req.method==='POST' && url.pathname==='/api/trainer/progression-preview'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const preview=previewTrainerProgression({
      trainer:payload.trainer||{},draft:payload.draft||{},rulesetId,gmOverride:!!payload.gmOverride,includeOptions:payload.includeOptions!==false,
      getDefinition:args=>definitions.getResolved(args),
      listDefinitions:args=>definitions.listResolved(args),
      getDamageBase:db=>definitions.getDamageBase(db)
    });
    return json(res,200,{rulesetId,preview});
  }

  if(req.method==='POST' && url.pathname==='/api/trainer/progression-apply'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const trainer=payload.trainer||{}, draft=payload.draft||{};
    const preview=previewTrainerProgression({
      trainer,draft,rulesetId,gmOverride:!!payload.gmOverride,includeOptions:false,
      getDefinition:args=>definitions.getResolved(args),
      listDefinitions:args=>definitions.listResolved(args),
      getDamageBase:db=>definitions.getDamageBase(db)
    });
    if(!preview.valid) return json(res,400,{error:'Trainer progression is not valid.',preview});
    const updatedTrainer=applyTrainerProgression({trainer,draft,preview,getDefinition:args=>definitions.getResolved(args),rulesetId});
    const resolvedTrainer=resolveTrainerModel({trainer:updatedTrainer,rulesetId,getDefinition:args=>definitions.getResolved(args),getDamageBase:db=>definitions.getDamageBase(db)});
    return json(res,200,{rulesetId,updatedTrainer,resolvedTrainer,preview:{...preview,projectedTrainer:undefined,resolvedTrainer:undefined,optionSets:undefined}});
  }

  if(req.method==='POST' && url.pathname==='/api/trainer/xp-purchase'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const trainer=payload.trainer||{};
    const kind=String(payload.kind||''); const id=String(payload.id||''); const selections=payload.selections||{};
    const preview=previewTrainerXpPurchase({
      trainer,kind,id,selections,manualConfirm:!!payload.manualConfirm,rulesetId,gmOverride:!!payload.gmOverride,
      getDefinition:args=>definitions.getResolved(args),
      getDamageBase:db=>definitions.getDamageBase(db)
    });
    if(!preview.valid) return json(res,400,{error:'Trainer XP purchase is not valid.',preview});
    const updatedTrainer=applyTrainerXpPurchase({trainer,kind,id,selections,preview,getDefinition:args=>definitions.getResolved(args),rulesetId});
    const resolvedTrainer=resolveTrainerModel({trainer:updatedTrainer,rulesetId,getDefinition:args=>definitions.getResolved(args),getDamageBase:db=>definitions.getDamageBase(db)});
    return json(res,200,{rulesetId,updatedTrainer,resolvedTrainer,preview});
  }

  if(req.method==='POST' && url.pathname==='/api/pokemon/reference-data'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const pokemon=payload.pokemon||{}; const details=pokemon.details||{};
    const speciesId=String(details.speciesDefinitionId||payload.speciesId||'');
    const baseSpecies=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!baseSpecies) return json(res,404,{error:'Current Species definition not found in active ruleset'});
    const referenceFormResolution=resolveSpeciesFormState({species:baseSpecies,pokemon,payload});
    if(!referenceFormResolution.valid)return json(res,400,{error:'Stored Pokémon Form state is not valid.',formResolution:referenceFormResolution});
    const species=referenceFormResolution.species;
    const slug=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const speciesTypes=species.types||pokemon.types||[];
    const held=resolvePokemonHeldItem({rulesetId,pokemon,species:baseSpecies});
    const edgeStats=resolvePokemonPokeEdgeStats({pokemon,species});
    const resolvedPokemonForCombat={...pokemon,details:{...details,finalStats:{...edgeStats.permanentFinal}}};
    const accuracyMap=accuracyTrainingMap(details);
    const moves=(Array.isArray(details.moves)?details.moves:[]).map(m=>{
      const id=slug(m.id||m.name); const definition=id?definitions.getResolved({rulesetId,kind:'moves',id}):null;
      const resolvedDamage=definition?resolveMoveDamage({pokemon:resolvedPokemonForCombat,moveDefinition:definition,speciesTypes,getDamageBase:db=>definitions.getDamageBase(db),heldItemEffect:held.effect}):null;
      const accuracyTrainingRanks=accuracyMap.get(id)||0;
      const baseAc=definition?.ac==null?null:Number(definition.ac);
      const effectiveAc=baseAc==null||!Number.isFinite(baseAc)?baseAc:Math.max(0,baseAc-accuracyTrainingRanks);
      return {record:m,definition,resolvedDamage,accuracyTrainingRanks,effectiveAc};
    });
    const abilities=resolveCreatureAbilityRecords({pokemon,species,rulesetId,heldItemEffect:held.effect});
    const abilitySlots=nativeAbilitySlotsForSpecies(species,pokemon.level);
    const nativeSelected=[...(Array.isArray(details.abilities)?details.abilities.filter(Boolean):[])];
    for(const rec of (Array.isArray(details.abilityRecords)?details.abilityRecords:[])) if(['species_starting','level_choice','native_extra'].includes(String(rec?.sourceKind||'')) && rec?.name && !nativeSelected.some(x=>abilitySlug(x)===abilitySlug(rec.name))) nativeSelected.push(rec.name);
    const abilitySlotStatus={expected:abilitySlots.length,selected:nativeSelected.length,unresolved:abilitySlots.slice(nativeSelected.length).map(s=>({label:s.label,unlockLevel:s.unlockLevel}))};
    const outgoing=definitions.getOutgoingEvolutions({rulesetId,speciesName:baseSpecies.name,sourceId:baseSpecies.sourceId});
    const incoming=definitions.getIncomingEvolution({speciesName:baseSpecies.name,sourceId:baseSpecies.sourceId});
    const typeProfile=applyHeldItemToTypeProfile(definitions.getDefensiveTypeProfile(speciesTypes),held.effect);
    return json(res,200,{rulesetId,species,formResolution:referenceFormResolution,moves,abilities,abilitySlots,abilitySlotStatus,resolvedCreature:resolvedCreatureModel({pokemon,species,rulesetId,heldItemEffect:held.effect,heldItemDefinition:held.definition}),modifierSummary:getPokemonModifierSummary(resolvedPokemonForCombat,{heldItemEffect:held.effect}),heldItem:{definition:held.definition,effect:held.effect},typeProfile,incomingEvolution:incoming||null,outgoingEvolutions:outgoing});
  }

  if(req.method==='POST' && url.pathname==='/api/pokemon/ability-correction-preview'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const pokemon=payload.pokemon||{}; const details=structuredClone(pokemon.details||{});
    const speciesId=String(details.speciesDefinitionId||payload.speciesId||'');
    const baseSpecies=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!baseSpecies) return json(res,404,{error:'Current Species definition not found in active ruleset'});
    const abilityFormResolution=resolveSpeciesFormState({species:baseSpecies,pokemon,payload,includeActive:false});
    if(!abilityFormResolution.valid)return json(res,400,{error:'Stored permanent Pokémon Form state is not valid.',formResolution:abilityFormResolution});
    const species=abilityFormResolution.species;
    const slots=nativeAbilitySlotsForSpecies(species,pokemon.level);
    const selected=Array.isArray(payload.selectedAbilities)?payload.selectedAbilities.map(String):[];
    const errors=[];
    for(let i=0;i<slots.length;i++){
      const value=String(selected[i]||'').trim();
      if(!value){errors.push(`${slots[i].label} must be selected.`); continue;}
      const allowed=slots[i].options.some(o=>abilitySlug(o.name)===abilitySlug(value));
      if(!allowed && !payload.gmOverride) errors.push(`${value} is not valid for ${slots[i].label}.`);
    }
    if(selected.length>slots.length && !payload.gmOverride) errors.push(`Only ${slots.length} native Ability slot${slots.length===1?' is':'s are'} unlocked at Level ${pokemon.level}.`);
    if(errors.length) return json(res,200,{valid:false,errors,abilitySlots:slots});
    details.abilities=selected.slice(0,Math.max(slots.length,selected.length)).filter(Boolean);
    details.ability=details.abilities[0]||'';
    details.abilityRecords=details.abilities.map((name,index)=>{
      const src=abilitySourceForIndex(index);
      return {name,sourceKind:src.kind,sourceLabel:src.label,unlockLevel:src.unlockLevel,selectedAtLevel:Number(pokemon.level||1),sourceId:species.id,sourceVersionId:species.versionId};
    });
    details.abilityCorrectionHistory=Array.isArray(details.abilityCorrectionHistory)?details.abilityCorrectionHistory:[];
    details.abilityCorrectionHistory.push({date:new Date().toISOString(),level:Number(pokemon.level||1),abilities:[...details.abilities],gmOverride:!!payload.gmOverride});
    const correctedPokemon={...pokemon,details};
    return json(res,200,{valid:true,details,abilitySlots:slots,abilities:resolveCreatureAbilityRecords({pokemon:correctedPokemon,species,rulesetId})});
  }


  if(req.method==='POST' && url.pathname==='/api/pokemon/held-item-options'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    const pokemon=payload.pokemon||{}; const details=pokemon.details||{};
    const speciesId=String(details.speciesDefinitionId||payload.speciesId||'');
    const species=speciesId?definitions.getResolved({rulesetId,kind:'species',id:speciesId}):null;
    const outgoing=species?definitions.getOutgoingEvolutions({rulesetId,speciesName:species.name,sourceId:species.sourceId}):[];
    const inventory=Array.isArray(payload.inventory)?payload.inventory:[];
    const items=[];
    for(const inv of inventory){
      if(Number(inv.qty||0)<=0) continue;
      const definition=resolveHeldItemDefinition({rulesetId,inventoryItem:inv});
      if(!definition || !definition.raw?.pokemon_held_usable) continue;
      const effect=resolveHeldItemEffect({itemDefinition:definition,config:{},pokemon,hasOutgoingEvolution:outgoing.length>0});
      items.push({inventoryId:inv.id,name:inv.name,qty:Number(inv.qty||0),icon:inv.icon||'◆',definition,effect:{...effect,valid:effect.requiresConfig?.length?true:effect.valid,errors:effect.requiresConfig?.length?[]:effect.errors}});
    }
    const current=resolvePokemonHeldItem({rulesetId,pokemon,species});
    return json(res,200,{rulesetId,items,current:{name:pokemon.heldItem||null,definition:current.definition,effect:current.effect}});
  }
  if(req.method==='POST' && url.pathname==='/api/pokemon/held-item-preview'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    const pokemon=payload.pokemon||{}; const details=pokemon.details||{};
    const speciesId=String(details.speciesDefinitionId||payload.speciesId||'');
    const species=speciesId?definitions.getResolved({rulesetId,kind:'species',id:speciesId}):null;
    const inv=payload.inventoryItem||{};
    const definition=resolveHeldItemDefinition({rulesetId,inventoryItem:inv});
    if(!definition || !definition.raw?.pokemon_held_usable) return json(res,400,{valid:false,errors:['This backpack item is not resolved as a Pokémon Held Item in the active Ruleset.']});
    const outgoing=species?definitions.getOutgoingEvolutions({rulesetId,speciesName:species.name,sourceId:species.sourceId}):[];
    const effect=resolveHeldItemEffect({itemDefinition:definition,config:payload.config||{},pokemon,hasOutgoingEvolution:outgoing.length>0});
    return json(res,200,{valid:!!effect.valid,errors:effect.errors||[],warnings:effect.warnings||[],definition,effect});
  }

  if(req.method==='POST' && url.pathname==='/api/pokemon/restat-preview'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const pokemon=payload.pokemon||{}; const details=pokemon.details||{};
    const speciesId=String(details.speciesDefinitionId||payload.speciesId||'');
    const baseSpecies=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!baseSpecies) return json(res,404,{error:'Current Species definition not found in active ruleset'});
    const restatFormResolution=resolveSpeciesFormState({species:baseSpecies,pokemon,payload,includeActive:false});
    if(!restatFormResolution.valid)return json(res,400,{error:'Stored permanent Pokémon Form state is not valid.',formResolution:restatFormResolution});
    const species=restatFormResolution.species;
    const preview=buildPokemonRestatPreview({pokemon,species,allocations:payload.allocations,gmOverride:!!payload.gmOverride,baseRelationExemptStats:relationExemptionsFromPokeEdges(details.pokeEdges||[])});
    applyPokeEdgeStatsToPreview({preview,pokemon,species,gmOverride:!!payload.gmOverride});
    return json(res,200,{rulesetId,species:{id:species.id,name:species.name,types:species.types||[]},preview});
  }

  if(req.method==='POST' && url.pathname==='/api/pokemon/training-options'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const pokemon=payload.pokemon||{}; const details=pokemon.details||{};
    const speciesId=String(details.speciesDefinitionId||payload.speciesId||'');
    const baseSpecies=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!baseSpecies) return json(res,404,{error:'Current Species definition not found in active ruleset'});
    const trainingFormResolution=resolveSpeciesFormState({species:baseSpecies,pokemon,payload,includeActive:false});
    if(!trainingFormResolution.valid)return json(res,400,{error:'Stored permanent Pokémon Form state is not valid.',formResolution:trainingFormResolution});
    const species=trainingFormResolution.species;
    const ruleset=definitions.getRuleset(rulesetId);
    const september2015Enabled=!!ruleset?.packs?.some(p=>p.enabled && p.pack_id==='ptu-september-2015-playtest');
    const earned=Number(details.tutorPointsEarned??0); const spent=Number(details.tutorPointsSpent??0); const remaining=Math.max(0,earned-spent);
    const knownMoves=Array.isArray(details.moves)?details.moves:[];
    const poolLimit=Math.max(0,Number(details.tutorMovePoolLimit??3));
    const poolUsed=moveTrainingPoolUsage(knownMoves);
    const levelUpIds=new Set((species.levelUpMoves||[]).map(m=>String(m.move_id||m.move||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')));
    const resolveMove=(record,method)=>{
      const id=String(record.move_id||record.id||record.move||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      const def=id?definitions.getResolved({rulesetId,kind:'moves',id}):null;
      const natural=method==='tutor' && isNaturalTutorMove(species,record.move||def?.name||id);
      const countsAsNatural=natural || levelUpIds.has(id);
      const tutorRestriction=(method==='tutor'||method==='egg_tutor')?tutorRestrictionForMove({level:pokemon.level,move:def,september2015Enabled}):{applies:false,valid:true,message:null};
      const cost=method==='tm_hm'?1:(natural?1:2);
      return {id,name:record.move||def?.name||id,method,code:record.code||null,naturalTutor:natural,countsAsNatural,cost,
        countsAgainstTutorPool:!countsAsNatural,type:def?.type||null,frequency:def?.frequency||null,damageBase:def?.damageBase??null,
        tutorRestriction,alreadyKnown:knownMoves.some(m=>String(m.id||m.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')===id)};
    };
    const moveTeaching={
      tm_hm:(species.tmMoves||[]).map(m=>resolveMove(m,'tm_hm')),
      tutor:(species.tutorMoves||[]).map(m=>resolveMove(m,'tutor')),
      egg_tutor:(species.eggMoves||[]).map(m=>resolveMove(m,'egg_tutor'))
    };
    const edgeRows=definitions.listResolved({rulesetId,kind:'poke_edges',q:'',limit:200,offset:0});
    const owned=Array.isArray(details.pokeEdges)?details.pokeEdges:[];
    const abilityKeywordLookup=(abilityName,keyword)=>{
      const slug=String(abilityName||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      const ability=definitions.getResolved({rulesetId,kind:'abilities',id:slug});
      const text=`${ability?.effect||''} ${ability?.rawText||''}`.toLowerCase();
      return text.includes(String(keyword||'').toLowerCase());
    };
    const edges=edgeRows.map(summary=>{
      const edge=definitions.getResolved({rulesetId,kind:'poke_edges',id:summary.id});
      const previous=owned.filter(x=>x.id===edge.id); const nextRank=previous.length+1;
      const repeatable=/may be taken multiple times|may be taken up to|\[ranked/i.test(`${edge.effect||''} ${edge.rawText||''}`) || !!edge.prerequisiteSemantics?.rank_asts?.length;
      const maxRank=edge.prerequisiteSemantics?.rank_asts?.length||(/up to three times/i.test(edge.effect||'')?3:(repeatable?99:1));
      const prereq=evaluatePokeEdgePrerequisite(edge,{level:pokemon.level,capabilities:species.capabilities||[],abilities:details.abilities||[],abilityKeywordLookup,rank:nextRank,ownedPokeEdges:owned,statAllocations:details.statAllocations||{}});
      const cost=parseTutorPointCost(edge.raw?.cost_text||edge.raw?.cost||'') || parseTutorPointCost(edge.rawText||'') || 1;
      const exhausted=previous.length>=maxRank;
      const targetOptions=buildPokeEdgeTargetOptions({edge,pokemon,species,rulesetId});
      const edgeKey=capabilityKey(edge.id);
      const targetRequired=['advanced-mobility','capability-training','accuracy-training','skill-improvement'].includes(edgeKey);
      const targetKind=edgeKey==='accuracy-training'?'move':edgeKey==='skill-improvement'?'skill':targetRequired?'capability':null;
      const allocationMeta=statAllocationTargetMeta(edge,species,details);
      return {id:edge.id,name:edge.name,cost,prerequisites:edge.prerequisites||edge.raw?.prerequisites_text||null,effect:edge.effect||edge.raw?.effect_text||null,
        sourceId:edge.sourceId,sourcePage:edge.sourcePage,automationLevel:edge.semanticAutomation?.level||'manual_text',prerequisite:prereq,
        ownedCount:previous.length,nextRank,maxRank,repeatable,exhausted,affordable:remaining>=cost,requiresUnderdog:pokeEdgeRequiresUnderdog(edge),isUnderdog:isUnderdogPokemon(species.capabilities||[]),
        targetRequired,targetKind,targetOptions,...allocationMeta};
    });
    const mixedPower=getMixedPowerPokeEdge(rulesetId);
    if(mixedPower){
      const previous=owned.filter(x=>x.id==='mixed-power');
      const prereq=evaluatePokeEdgePrerequisite(mixedPower,{level:pokemon.level,capabilities:species.capabilities||[],abilities:details.abilities||[],ownedPokeEdges:owned,statAllocations:details.statAllocations||{}});
      edges.push({id:'mixed-power',name:'Mixed Power',cost:2,prerequisites:mixedPower.prerequisites,effect:mixedPower.effect,sourceId:'sep2015',sourcePage:mixedPower.sourcePage,automationLevel:'machine_ready',prerequisite:prereq,ownedCount:previous.length,nextRank:1,maxRank:1,repeatable:false,exhausted:previous.length>=1,affordable:remaining>=2,requiresUnderdog:false,isUnderdog:isUnderdogPokemon(species.capabilities||[]),grantsAbility:'Twisted Power',targetRequired:false,targetOptions:[]});
    }
    return json(res,200,{rulesetId,species:{id:species.id,name:species.name,types:species.types||[]},tutorPoints:{earned,spent,remaining},
      tutorMovePool:{used:poolUsed,limit:poolLimit,remaining:Math.max(0,poolLimit-poolUsed)},september2015TutorRestrictions:september2015Enabled,
      edges,moveTeaching});
  }
  if(req.method==='POST' && url.pathname==='/api/pokemon/training-action-preview'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const pokemon=payload.pokemon||{}; const details=JSON.parse(JSON.stringify(pokemon.details||{}));
    const speciesId=String(details.speciesDefinitionId||payload.speciesId||'');
    const baseSpecies=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!baseSpecies) return json(res,404,{error:'Current Species definition not found in active ruleset'});
    const trainingActionFormResolution=resolveSpeciesFormState({species:baseSpecies,pokemon,payload,includeActive:false});
    if(!trainingActionFormResolution.valid)return json(res,400,{error:'Stored permanent Pokémon Form state is not valid.',formResolution:trainingActionFormResolution});
    const species=trainingActionFormResolution.species;
    details.moves=Array.isArray(details.moves)?details.moves:[]; details.pokeEdges=Array.isArray(details.pokeEdges)?details.pokeEdges:[];
    details.grantedAbilities=Array.isArray(details.grantedAbilities)?details.grantedAbilities:[];
    details.trainingHistory=Array.isArray(details.trainingHistory)?details.trainingHistory:[];
    const owned=details.pokeEdges;
    const earned=Number(details.tutorPointsEarned??0); const spent=Number(details.tutorPointsSpent??0); let remaining=Math.max(0,earned-spent);
    const errors=[]; let cost=0; let resultRecord=null;
    if(payload.action==='acquire_edge'){
      const requestedEdgeId=String(payload.edgeId||'');
      const edge=requestedEdgeId==='mixed-power'?getMixedPowerPokeEdge(rulesetId):definitions.getResolved({rulesetId,kind:'poke_edges',id:requestedEdgeId});
      if(!edge) errors.push('Poké Edge is not available in the active Ruleset.');
      else{
        const previous=details.pokeEdges.filter(x=>x.id===edge.id); const nextRank=previous.length+1;
        const repeatable=/may be taken multiple times|may be taken up to|\[ranked/i.test(`${edge.effect||''} ${edge.rawText||''}`) || !!edge.prerequisiteSemantics?.rank_asts?.length;
        const maxRank=edge.prerequisiteSemantics?.rank_asts?.length||(/up to three times/i.test(edge.effect||'')?3:(repeatable?99:1));
        if(previous.length>=maxRank) errors.push(`${edge.name} cannot be taken another time.`);
        const abilityKeywordLookup=(abilityName,keyword)=>{ const slug=String(abilityName||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); const a=definitions.getResolved({rulesetId,kind:'abilities',id:slug}); return `${a?.effect||''} ${a?.rawText||''}`.toLowerCase().includes(String(keyword||'').toLowerCase()); };
        const prereq=evaluatePokeEdgePrerequisite(edge,{level:pokemon.level,capabilities:species.capabilities||[],abilities:details.abilities||[],abilityKeywordLookup,rank:nextRank,ownedPokeEdges:owned,statAllocations:details.statAllocations||{}});
        if(prereq.valid===false && !payload.gmOverride) errors.push(...prereq.reasons);
        if(prereq.valid==null && !payload.manualConfirm && !payload.gmOverride) errors.push('This Poké Edge has a prerequisite that requires manual confirmation.');
        cost=edge.id==='mixed-power'?2:(parseTutorPointCost(edge.raw?.cost_text||edge.rawText||'')||1);
        if(remaining<cost && !payload.freeGrant) errors.push(`Requires ${cost} Tutor Point${cost===1?'':'s'}; only ${remaining} remain.`);
        let targetStat=null; let targetId=''; let targetLabel=''; let targetKind=null; let statAllocation=null;
        const edgeKey=capabilityKey(edge.id);
        if(String(edge.id).toLowerCase()==='attack-conflict'){
          const raw=String(payload.targetStat||payload.targetNote||'').trim().toLowerCase();
          if(raw==='attack'||raw==='atk') targetStat='attack';
          else if(['special_attack','special attack','sp attack','sp. attack','spatk'].includes(raw)) targetStat='special_attack';
          else errors.push('Attack Conflict must be permanently linked to Attack or Special Attack.');
          if(details.pokeEdges.some(x=>x.id==='attack-conflict')) errors.push('Attack Conflict is already owned.');
          targetId=targetStat||''; targetLabel=targetStat?(targetStat==='attack'?'Attack':'Special Attack'):''; targetKind='stat';
        } else if(['advanced-mobility','capability-training','accuracy-training','skill-improvement'].includes(edgeKey)){
          const options=buildPokeEdgeTargetOptions({edge,pokemon:{...pokemon,details},species,rulesetId});
          targetId=capabilityKey(payload.targetId||payload.targetNote||'');
          const selected=options.find(o=>o.id===targetId);
          const targetName=edgeKey==='accuracy-training'?'Move':edgeKey==='skill-improvement'?'Skill':'Capability';
          if(!selected) errors.push(`${edge.name} requires a valid unused ${targetName} target.`);
          else { targetLabel=selected.label; targetKind=selected.kind; }
        } else {
          targetId=String(payload.targetId||'').trim(); targetLabel=String(payload.targetNote||targetId||'').trim(); targetKind=payload.targetKind||null;
        }
        const allocationMeta=statAllocationTargetMeta(edge,species,details);
        if(allocationMeta.allocationRequired){
          statAllocation=normalizeAllocations(payload.statAllocation||{});
          const spentAllocation=STAT_KEYS.reduce((sum,k)=>sum+Number(statAllocation[k]||0),0);
          if(spentAllocation!==allocationMeta.allocationPoints) errors.push(`${edge.name} requires exactly ${allocationMeta.allocationPoints} Stat Point${allocationMeta.allocationPoints===1?'':'s'} to be allocated (currently ${spentAllocation}).`);
          const allowed=new Set(allocationMeta.allocationAllowedStats||[]);
          for(const k of STAT_KEYS) if(Number(statAllocation[k]||0)>0 && !allowed.has(k)) errors.push(`${edge.name} cannot allocate points to ${k}.`);
        }
        if(!errors.length){
          const targetNote=targetLabel || (targetStat?(targetStat==='attack'?'Attack':'Special Attack'):String(payload.targetNote||''));
          resultRecord={instanceId:`edge-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,id:edge.id,name:edge.name,rank:nextRank,cost:payload.freeGrant?0:cost,targetNote,targetId,targetKind,targetStat,statAllocation,statAllocationPoints:allocationMeta.allocationRequired?allocationMeta.allocationPoints:null,sourceVersionId:edge.versionId,sourceId:edge.sourceId,
            prerequisites:edge.prerequisites||edge.raw?.prerequisites_text||null,effect:edge.effect||edge.raw?.effect_text||null,gmOverride:!!payload.gmOverride,manualConfirmed:!!payload.manualConfirm,acquiredAt:new Date().toISOString()};
          const projectedDetails=JSON.parse(JSON.stringify(details)); projectedDetails.pokeEdges.push(resultRecord);
          if(['realized-potential','mixed-sweeper','underdogs-strength'].includes(edgeKey)){
            const projected=resolvePokemonPokeEdgeStats({pokemon:{...pokemon,details:projectedDetails},species,detailsOverride:projectedDetails});
            if(projected.baseRelations.violations.length && !payload.gmOverride) errors.push(...projected.baseRelations.violations.map(v=>v.message));
          }
          if(errors.length) resultRecord=null;
          else details.pokeEdges.push(resultRecord);
          if(resultRecord && edge.id==='mixed-power' && !details.grantedAbilities.some(a=>String(typeof a==='string'?a:a?.name).toLowerCase()==='twisted power')){
            details.grantedAbilities.push({name:'Twisted Power',source:'poke_edge',sourceId:'mixed-power',sourceVersionId:edge.versionId,grantedAt:new Date().toISOString()});
          }
          details.baseRelationExemptStats=relationExemptionsFromPokeEdges(details.pokeEdges);
          if(resultRecord && !payload.freeGrant){details.tutorPointsSpent=spent+cost; remaining-=cost;}
        }
      }
    } else if(payload.action==='refund_edge'){
      const instanceId=String(payload.edgeInstanceId||'');
      let idx=instanceId?details.pokeEdges.findIndex(e=>String(e.instanceId||'')===instanceId):-1;
      if(idx<0 && Number.isInteger(payload.edgeIndex)) idx=Number(payload.edgeIndex);
      if(idx<0 || idx>=details.pokeEdges.length) errors.push('Poké Edge record was not found for refund.');
      else{
        const removed=details.pokeEdges[idx];
        const refund=Math.max(0,Number(removed.cost||0));
        details.pokeEdges.splice(idx,1);
        details.tutorPointsSpent=Math.max(0,spent-refund); remaining=Math.max(0,earned-details.tutorPointsSpent);
        removeDerivedEffectsForRefund(details,removed);
        resultRecord={...removed,refundedTutorPoints:refund,refundedAt:new Date().toISOString()};
      }
    } else if(payload.action==='learn_move'){
      const method=String(payload.method||'tm_hm'); const moveId=String(payload.moveId||'');
      const sourceList=method==='tutor'?(species.tutorMoves||[]):method==='egg_tutor'?(species.eggMoves||[]):(species.tmMoves||[]);
      const source=sourceList.find(m=>String(m.move_id||m.move||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')===moveId);
      if(!source && !payload.gmOverride) errors.push('Move is not compatible through the selected teaching method.');
      const move=definitions.getResolved({rulesetId,kind:'moves',id:moveId}); if(!move) errors.push('Move definition is unavailable in the active Ruleset.');
      const slug=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      if(details.moves.some(m=>slug(m.id||m.name)===moveId)) errors.push(`${move?.name||moveId} is already known.`);
      let replaceIndex=-1;
      if(payload.replaceMoveId) replaceIndex=details.moves.findIndex(m=>slug(m.id||m.name)===String(payload.replaceMoveId));
      const moveLimit=Math.max(0,Number(details.moveLimitEffective??6));
      if(details.moves.length>=moveLimit && replaceIndex<0) errors.push(`Current Move Limit is ${moveLimit}; choose a known Move to replace.`);
      const natural=method==='tutor' && isNaturalTutorMove(species,source?.move||move?.name||moveId);
      const levelUpIds=new Set((species.levelUpMoves||[]).map(m=>slug(m.move_id||m.move)));
      const countsAsNatural=natural||levelUpIds.has(moveId); const poolLimit=Math.max(0,Number(details.tutorMovePoolLimit??3));
      const before=details.moves.filter((_,i)=>i!==replaceIndex); const poolBefore=moveTrainingPoolUsage(before);
      const countsAgainstTutorPool=!countsAsNatural;
      if(countsAgainstTutorPool && poolBefore+1>poolLimit && !payload.gmOverride) errors.push(`TM/Tutor Move Pool limit is ${poolLimit}.`);
      const ruleset=definitions.getRuleset(rulesetId); const sept=!!ruleset?.packs?.some(p=>p.enabled&&p.pack_id==='ptu-september-2015-playtest');
      const restriction=(method==='tutor'||method==='egg_tutor')?tutorRestrictionForMove({level:pokemon.level,move,september2015Enabled:sept}):{valid:true};
      if(!restriction.valid && !payload.gmOverride) errors.push(restriction.message);
      cost=method==='tm_hm'?1:(natural?1:2);
      const replacingTm=replaceIndex>=0 && ['tm','hm','tm_hm'].includes(String(details.moves[replaceIndex]?.source||'').toLowerCase());
      if(method==='tm_hm' && replacingTm) cost=0;
      if(remaining<cost && !payload.freeGrant) errors.push(`Requires ${cost} Tutor Point${cost===1?'':'s'}; only ${remaining} remain.`);
      if(!errors.length){
        resultRecord={id:moveId,name:move?.name||source?.move||moveId,source:method==='tm_hm'?'tm':(method==='egg_tutor'?'egg_tutor':(natural?'natural_tutor':'tutor')),
          learnedAt:pokemon.level,countsAsNatural,cost:payload.freeGrant?0:cost,sourceSpeciesId:species.id,sourceSpeciesName:species.name,gmOverride:!!payload.gmOverride,learnedAtDate:new Date().toISOString()};
        if(replaceIndex>=0) details.moves.splice(replaceIndex,1,resultRecord); else details.moves.push(resultRecord);
        if(!payload.freeGrant){details.tutorPointsSpent=spent+cost; remaining-=cost;}
      }
    } else errors.push('Unsupported training action.');
    details.tutorPointsEarned=earned; details.tutorPointsRemaining=Math.max(0,earned-Number(details.tutorPointsSpent||spent));
    if(!errors.length) details.trainingHistory.push({date:new Date().toISOString(),action:payload.action,cost:payload.freeGrant?0:cost,record:resultRecord});
    const resolvedStatEffects=resolvePokemonPokeEdgeStats({pokemon:{...pokemon,details},species,detailsOverride:details});
    const resolvedSkills=resolvePokemonSkills(species,details);
    return json(res,200,{valid:errors.length===0,errors,cost,tutorPoints:{earned,spent:Number(details.tutorPointsSpent||spent),remaining:details.tutorPointsRemaining},details,resultRecord,resolvedStatEffects,resolvedSkills});
  }

  if(req.method==='GET' && url.pathname==='/api/profiles'){
    return json(res,200,{activeProfileId:repo.getActiveProfileId(),profiles:repo.listProfiles()});
  }
  if(req.method==='POST' && url.pathname==='/api/profiles'){
    const payload=await bodyJson(req);
    const name=String(payload.name||'').trim();
    if(!name) throw Object.assign(new Error('Trainer name is required'),{status:400});
    const state=blankTrainerState({name,title:String(payload.title||'Trainer').trim()||'Trainer'});
    repo.saveState(state,{createRevision:true});
    return json(res,201,{ok:true,state:hydrateStateForClient(repo.loadState(state.activeProfileId)),profiles:repo.listProfiles()});
  }
  if(req.method==='PUT' && url.pathname==='/api/profiles/active'){
    const payload=await bodyJson(req); const id=String(payload.id||'');
    const profile=repo.listProfiles().find(p=>p.id===id);
    if(!profile) throw Object.assign(new Error('Trainer profile not found'),{status:404});
    repo.setActiveProfileId(id);
    return json(res,200,{ok:true,state:hydrateStateForClient(repo.loadState(id)),profiles:repo.listProfiles()});
  }
  const profileDelete=url.pathname.match(/^\/api\/profiles\/([^/]+)$/);
  if(req.method==='DELETE' && profileDelete){
    const id=decodeURIComponent(profileDelete[1]); const activeProfileId=repo.deleteProfile(id);
    return json(res,200,{ok:true,activeProfileId,state:hydrateStateForClient(repo.loadState(activeProfileId)),profiles:repo.listProfiles()});
  }
  if(req.method==='GET' && url.pathname==='/api/state'){
    return json(res,200,{state:hydrateStateForClient(repo.loadState()),persistence:'sqlite'});
  }
  if(req.method==='PUT' && url.pathname==='/api/state'){
    const payload=await bodyJson(req);
    const state=payload.state ?? payload;
    const result=repo.saveState({...state,version:2});
    return json(res,200,{ok:true,...result});
  }
  if(req.method==='POST' && url.pathname==='/api/reset'){
    const clean=JSON.parse(JSON.stringify(seed)); clean.version=2;
    repo.saveState(clean,{createRevision:true});
    return json(res,200,{ok:true,state:hydrateStateForClient(repo.loadState(clean.activeProfileId))});
  }
  if(req.method==='GET' && url.pathname==='/api/revisions'){
    const limit=Math.max(1,Math.min(30,Number(url.searchParams.get('limit')||10)));
    return json(res,200,{revisions:repo.listRevisions(undefined,limit)});
  }
  const restore=url.pathname.match(/^\/api\/revisions\/(\d+)\/restore$/);
  if(req.method==='POST' && restore){
    return json(res,200,{ok:true,state:hydrateStateForClient(repo.restoreRevision(Number(restore[1])))});
  }
  if(req.method==='GET' && url.pathname==='/api/export'){
    return json(res,200,hydrateStateForClient(repo.loadState()));
  }
  return false;
}

export async function mobileFetch(input,init={}){
  const raw=typeof input==='string'?input:(input?.url||'');
  let url; try{url=new URL(raw,location.href);}catch{return window.__PTU_NATIVE_FETCH__(input,init);}
  if(!url.pathname.startsWith('/api/')) return window.__PTU_NATIVE_FETCH__(input,init);
  const method=String(init.method||(typeof input!=='string'&&input?.method)||'GET').toUpperCase();
  let body={}; if(init.body){try{body=typeof init.body==='string'?JSON.parse(init.body):init.body;}catch{body={};}}
  const req={method,_body:body}; const res={status:200,data:null};
  try{const handled=await handleApi(req,res,url);if(!handled&&res.data==null)return new Response(JSON.stringify({error:'Mobile API route not found'}),{status:404,headers:{'Content-Type':'application/json'}});return new Response(JSON.stringify(res.data??{}),{status:res.status||200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}catch(e){return new Response(JSON.stringify({error:e?.message||String(e)}),{status:Number(e?.status)||500,headers:{'Content-Type':'application/json'}});}
}
export async function installMobileApi(){ window.__PTU_NATIVE_FETCH__=window.fetch.bind(window);window.PTU_ANDROID_BUILD=true;await loadNativeContentPacks();applyStoredPackOverrides();window.fetch=mobileFetch; }
