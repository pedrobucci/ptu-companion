const deepClone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const slug=value=>String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export const POKEMON_FORM_SCHEMA_VERSION=1;
export const BASE_FORM_ID='base';
export const FORM_MODES=Object.freeze(['permanent','transformation']);

const FIELD_ALIASES=Object.freeze({
  base_stats:'baseStats',ability_slots:'abilities',level_up_moves:'levelUpMoves',tm_moves:'tmMoves',tutor_moves:'tutorMoves',egg_moves:'eggMoves',
  portrait_data_url:'portraitDataUrl',artwork_url:'artwork',image_url:'image',type_defense_profile:'defenseProfile'
});
const RAW_FIELD_NAMES=Object.freeze({
  baseStats:'base_stats',abilities:'ability_slots',levelUpMoves:'level_up_moves',tmMoves:'tm_moves',tutorMoves:'tutor_moves',eggMoves:'egg_moves',
  portraitDataUrl:'portrait_data_url',artwork:'artwork_url',image:'image_url',defenseProfile:'type_defense_profile'
});

function canonicalField(key){return FIELD_ALIASES[key]||key;}
function stableKey(value){
  if(value==null)return 'null';
  if(typeof value!=='object')return slug(value)||String(value);
  return slug(value.id||value.logical_id||value.move_id||value.capability_id||value.name||value.move||value.skill||JSON.stringify(value));
}
function uniqueArray(values=[]){
  const out=[]; const seen=new Set();
  for(const value of values){const key=stableKey(value);if(seen.has(key))continue;seen.add(key);out.push(deepClone(value));}
  return out;
}
function removeFromArray(current,remove){
  const removeValues=Array.isArray(remove)?remove:[remove];
  const keys=new Set(removeValues.map(stableKey));
  return (Array.isArray(current)?current:[]).filter(value=>!keys.has(stableKey(value)));
}
function addToValue(current,add){
  if(Array.isArray(current)||Array.isArray(add))return uniqueArray([...(Array.isArray(current)?current:[]),...(Array.isArray(add)?add:[add])]);
  if(typeof current==='number'&&typeof add==='number')return current+add;
  if(current&&typeof current==='object'&&add&&typeof add==='object'){
    const out=deepClone(current);
    for(const [key,value] of Object.entries(add)){
      if(typeof out[key]==='number'&&typeof value==='number')out[key]+=value;
      else if(Array.isArray(out[key])||Array.isArray(value))out[key]=addToValue(out[key],value);
      else if(out[key]&&typeof out[key]==='object'&&value&&typeof value==='object')out[key]=addToValue(out[key],value);
      else out[key]=deepClone(value);
    }
    return out;
  }
  return deepClone(add);
}
function removeFromValue(current,remove){
  if(Array.isArray(current))return removeFromArray(current,remove);
  if(current&&typeof current==='object'){
    const out=deepClone(current); const keys=Array.isArray(remove)?remove:[remove];
    for(const key of keys)delete out[String(key)];
    return out;
  }
  return current;
}

export function applyFormOperation(current,spec){
  if(!spec||typeof spec!=='object'||Array.isArray(spec))return deepClone(spec);
  const isOperation=Object.prototype.hasOwnProperty.call(spec,'replace')||Object.prototype.hasOwnProperty.call(spec,'remove')||Object.prototype.hasOwnProperty.call(spec,'add');
  if(!isOperation)return deepClone(spec);
  let value=deepClone(current);
  if(Object.prototype.hasOwnProperty.call(spec,'replace'))value=deepClone(spec.replace);
  if(Object.prototype.hasOwnProperty.call(spec,'remove'))value=removeFromValue(value,spec.remove);
  if(Object.prototype.hasOwnProperty.call(spec,'add'))value=addToValue(value,spec.add);
  return value;
}

function normalizeRequirementNode(node){
  if(node==null||node===true)return null;
  if(node===false)return {kind:'never'};
  if(Array.isArray(node))return {all:node.map(normalizeRequirementNode).filter(Boolean)};
  if(typeof node!=='object')return {kind:'manual',value:String(node)};
  if(Array.isArray(node.all))return {all:node.all.map(normalizeRequirementNode).filter(Boolean)};
  if(Array.isArray(node.any))return {any:node.any.map(normalizeRequirementNode).filter(Boolean)};
  if(node.not!=null)return {not:normalizeRequirementNode(node.not)};
  if(node.kind)return {...deepClone(node),kind:String(node.kind).trim().toLowerCase()};
  const leaves=[];
  const map={min_level:'min_level',minLevel:'min_level',max_level:'max_level',maxLevel:'max_level',gender:'gender',held_item:'held_item',heldItem:'held_item',ability:'ability',capability:'capability',tag:'tag',flag:'flag',manual:'manual'};
  for(const [key,value] of Object.entries(node)) if(map[key]) leaves.push({kind:map[key],value:deepClone(value)});
  if(leaves.length===1)return leaves[0];
  if(leaves.length>1)return {all:leaves};
  return {kind:'manual',value:deepClone(node)};
}

export function normalizeSpeciesForm(input,index=0){
  const raw=input&&typeof input==='object'?deepClone(input):{};
  const id=slug(raw.id||raw.form_id||raw.name||`form-${index+1}`);
  if(!id||id===BASE_FORM_ID)throw new Error(`Invalid Pokémon Form id: ${raw.id||raw.form_id||raw.name||''}`);
  const mode=String(raw.mode||raw.kind||raw.form_mode||'permanent').trim().toLowerCase();
  if(!FORM_MODES.includes(mode))throw new Error(`Unsupported Pokémon Form mode: ${mode}`);
  const overrides=raw.overrides&&typeof raw.overrides==='object'?raw.overrides:(raw.changes&&typeof raw.changes==='object'?raw.changes:{});
  const normalizedOverrides={};
  for(const [key,value] of Object.entries(overrides))normalizedOverrides[canonicalField(key)]=deepClone(value);
  return {
    id,
    name:String(raw.name||raw.display_name||id).trim()||id,
    mode,
    requirements:normalizeRequirementNode(raw.requirements||raw.requirement||null),
    overrides:normalizedOverrides,
    source:raw.source||null,
    notes:raw.notes||null,
    raw
  };
}

export function normalizeSpeciesForms(input){
  const forms=Array.isArray(input)?input:[]; const out=[]; const seen=new Set();
  forms.forEach((form,index)=>{
    const normalized=normalizeSpeciesForm(form,index);
    if(seen.has(normalized.id))throw new Error(`Duplicate Pokémon Form id: ${normalized.id}`);
    seen.add(normalized.id); out.push(normalized);
  });
  return out;
}

function listContextValues(value){return (Array.isArray(value)?value:[value]).filter(v=>v!=null).map(v=>slug(typeof v==='object'?(v.id||v.name||v.capability_id||v.ability):v)).filter(Boolean);}
function evaluateLeaf(requirement,context){
  const kind=String(requirement?.kind||'manual').toLowerCase(); const expected=requirement?.value;
  const level=Number(context?.level||0);
  if(kind==='never')return {met:false,label:'Form is disabled by its requirement.'};
  if(kind==='min_level')return {met:level>=Number(expected),label:`Requires Level ${Number(expected)}+.`};
  if(kind==='max_level')return {met:level<=Number(expected),label:`Requires Level ${Number(expected)} or lower.`};
  if(kind==='gender')return {met:slug(context?.gender)===slug(expected),label:`Requires gender ${expected}.`};
  if(kind==='held_item'){
    const held=listContextValues([context?.heldItemId,context?.heldItemName,context?.heldItem]);
    return {met:held.includes(slug(expected)),label:`Requires held item ${typeof expected==='object'?(expected.name||expected.id):expected}.`};
  }
  if(kind==='ability')return {met:listContextValues(context?.abilities).includes(slug(expected)),label:`Requires Ability ${expected}.`};
  if(kind==='capability')return {met:listContextValues(context?.capabilities).includes(slug(expected)),label:`Requires Capability ${expected}.`};
  if(kind==='tag')return {met:listContextValues(context?.tags).includes(slug(expected)),label:`Requires tag ${expected}.`};
  if(kind==='flag'){
    const flags=context?.flags&&typeof context.flags==='object'?context.flags:{};
    return {met:!!flags[String(expected)],label:`Requires state flag ${expected}.`};
  }
  if(kind==='manual'){
    const key=slug(typeof expected==='object'?(expected.id||expected.key||JSON.stringify(expected)):expected);
    return {met:listContextValues(context?.manualApprovals).includes(key),label:`Requires manual condition ${typeof expected==='object'?(expected.label||expected.id||expected.key||'confirmation'):expected}.`};
  }
  return {met:false,label:`Unsupported Form requirement: ${kind}.`};
}

export function evaluateFormRequirements(requirements,context={}){
  const node=normalizeRequirementNode(requirements);
  if(!node)return {eligible:true,unmet:[]};
  if(Array.isArray(node.all)){
    const results=node.all.map(child=>evaluateFormRequirements(child,context));
    return {eligible:results.every(r=>r.eligible),unmet:results.flatMap(r=>r.unmet)};
  }
  if(Array.isArray(node.any)){
    const results=node.any.map(child=>evaluateFormRequirements(child,context));
    if(results.some(r=>r.eligible))return {eligible:true,unmet:[]};
    return {eligible:false,unmet:[`Requires one of: ${results.flatMap(r=>r.unmet).join(' / ')}`]};
  }
  if(node.not){
    const result=evaluateFormRequirements(node.not,context);
    return result.eligible?{eligible:false,unmet:['A prohibited Form condition is currently met.']}:{eligible:true,unmet:[]};
  }
  const leaf=evaluateLeaf(node,context);
  return {eligible:leaf.met,unmet:leaf.met?[]:[leaf.label]};
}

export function applySpeciesFormOverrides(species,overrides={}){
  const resolved=deepClone(species||{}); resolved.raw=deepClone(resolved.raw||{});
  for(const [inputKey,spec] of Object.entries(overrides||{})){
    const key=canonicalField(inputKey);
    const current=resolved[key]!==undefined?resolved[key]:resolved.raw[RAW_FIELD_NAMES[key]||inputKey];
    const value=applyFormOperation(current,spec);
    resolved[key]=deepClone(value);
    const rawKey=RAW_FIELD_NAMES[key]||inputKey;
    resolved.raw[rawKey]=deepClone(value);
  }
  return resolved;
}

export function normalizePokemonFormState(value={}){
  const source=value&&typeof value==='object'?(value.formState&&typeof value.formState==='object'?value.formState:value):{};
  const baseRaw=source.baseFormId??source.permanentFormId??source.base_form_id??BASE_FORM_ID;
  const activeRaw=source.activeFormId??source.transformationFormId??source.active_form_id??null;
  const baseFormId=slug(baseRaw)||BASE_FORM_ID;
  const activeFormId=activeRaw==null||String(activeRaw).trim()===''?null:(slug(activeRaw)||null);
  return {schemaVersion:POKEMON_FORM_SCHEMA_VERSION,baseFormId,activeFormId};
}


export function normalizePokemonArtwork(value){
  if(value==null)return {normal:null,shiny:null};
  if(typeof value==='string')return {normal:value.trim()||null,shiny:null};
  if(typeof value!=='object'||Array.isArray(value))return {normal:null,shiny:null};
  const unwrap=input=>{
    if(input&&typeof input==='object'&&!Array.isArray(input)&&(Object.prototype.hasOwnProperty.call(input,'replace')||Object.prototype.hasOwnProperty.call(input,'remove')||Object.prototype.hasOwnProperty.call(input,'add')))return applyFormOperation(null,input);
    return input;
  };
  const source=unwrap(value);
  if(typeof source==='string')return {normal:source.trim()||null,shiny:null};
  if(!source||typeof source!=='object'||Array.isArray(source))return {normal:null,shiny:null};
  const clean=v=>typeof v==='string'&&v.trim()?v.trim():null;
  return {
    normal:clean(source.normal??source.default??source.url??source.normal_url??source.artwork_url??source.portrait_data_url??source.image_url),
    shiny:clean(source.shiny??source.shiny_url??source.artwork_shiny_url??source.shiny_artwork_url??source.shinyArtwork)
  };
}
function mergeArtworkCandidates(...candidates){
  const out={normal:null,shiny:null};
  for(const candidate of candidates){
    const art=normalizePokemonArtwork(candidate);
    if(!out.normal&&art.normal)out.normal=art.normal;
    if(!out.shiny&&art.shiny)out.shiny=art.shiny;
  }
  return out;
}
function speciesArtwork(species){
  const raw=species?.raw||{};
  return mergeArtworkCandidates(
    species?.artwork,
    raw.artwork,
    {normal:species?.portraitDataUrl||species?.image||raw.artwork_url||raw.portrait_data_url||raw.image_url||null,
      shiny:species?.shinyArtwork||raw.artwork_shiny_url||raw.shiny_artwork_url||raw.shiny_portrait_data_url||raw.shiny_image_url||null}
  );
}
function formArtwork(form){
  const raw=form?.raw||{}; const overrides=form?.overrides||{};
  return mergeArtworkCandidates(
    overrides.artwork,
    {normal:overrides.portraitDataUrl||overrides.image||null,shiny:overrides.shinyArtwork||null},
    raw.artwork,
    {normal:raw.artwork_url||raw.portrait_data_url||raw.image_url||null,
      shiny:raw.artwork_shiny_url||raw.shiny_artwork_url||raw.shiny_portrait_data_url||raw.shiny_image_url||null}
  );
}
export function resolvePokemonArtwork({species,formResolution,isShiny=false}={}){
  const original=species||{};
  const forms=formResolution?.forms||normalizeSpeciesForms(original.forms||original.raw?.forms||original.raw?.form_definitions||[]);
  const state=formResolution?.formState||normalizePokemonFormState({});
  const appliedIds=new Set((formResolution?.applied||[]).map(form=>form.id));
  const active=state.activeFormId&&appliedIds.has(state.activeFormId)?forms.find(form=>form.id===state.activeFormId)||null:null;
  const permanent=state.baseFormId!==BASE_FORM_ID&&appliedIds.has(state.baseFormId)?forms.find(form=>form.id===state.baseFormId)||null:null;
  const layers=[
    active?{kind:'active_form',id:active.id,name:active.name,artwork:formArtwork(active)}:null,
    permanent?{kind:'base_form',id:permanent.id,name:permanent.name,artwork:formArtwork(permanent)}:null,
    {kind:'species',id:original.id||null,name:original.name||null,artwork:speciesArtwork(original)}
  ].filter(Boolean);
  for(const layer of layers){
    if(isShiny&&layer.artwork.shiny)return {url:layer.artwork.shiny,variant:'shiny',sourceLayer:layer.kind,sourceId:layer.id,sourceName:layer.name,isShiny:true,hasDedicatedShinyArtwork:true};
    if(layer.artwork.normal)return {url:layer.artwork.normal,variant:'normal',sourceLayer:layer.kind,sourceId:layer.id,sourceName:layer.name,isShiny:!!isShiny,hasDedicatedShinyArtwork:false};
  }
  return {url:null,variant:'fallback',sourceLayer:null,sourceId:null,sourceName:null,isShiny:!!isShiny,hasDedicatedShinyArtwork:false};
}
export function resolvePokemonPresentation({species,formState={},context={},allowUnmet=false,isShiny=false}={}){
  const formResolution=resolvePokemonForms({species,formState,context,allowUnmet});
  const artwork=resolvePokemonArtwork({species,formResolution,isShiny:!!isShiny});
  return {...formResolution,presentation:{isShiny:!!isShiny,artworkUrl:artwork.url,artwork}};
}

export function resolvePokemonForms({species,formState={},context={},allowUnmet=false}={}){
  const original=deepClone(species||{});
  const forms=normalizeSpeciesForms(original.forms||original.raw?.forms||original.raw?.form_definitions||[]);
  const state=normalizePokemonFormState(formState);
  const errors=[]; const warnings=[]; const applied=[];
  let resolved={...original,forms};
  const find=id=>forms.find(form=>form.id===id)||null;

  if(state.baseFormId!==BASE_FORM_ID){
    const form=find(state.baseFormId);
    if(!form)errors.push(`Unknown permanent Form: ${state.baseFormId}.`);
    else if(form.mode!=='permanent')errors.push(`${form.name} is a transformation Form and cannot be stored as the permanent/base Form.`);
    else {
      const check=evaluateFormRequirements(form.requirements,context);
      if(!check.eligible&&!allowUnmet)errors.push(...check.unmet);
      else {
        if(!check.eligible)warnings.push(...check.unmet.map(message=>`GM Override: ${message}`));
        resolved=applySpeciesFormOverrides(resolved,form.overrides); applied.push({id:form.id,name:form.name,mode:form.mode,requirements:check});
      }
    }
  }

  if(state.activeFormId){
    const form=find(state.activeFormId);
    if(!form)errors.push(`Unknown active Form: ${state.activeFormId}.`);
    else if(form.mode!=='transformation')errors.push(`${form.name} is a permanent Form and cannot be used as the active transformation.`);
    else {
      const check=evaluateFormRequirements(form.requirements,{...context,baseFormId:state.baseFormId,resolvedSpecies:resolved});
      if(!check.eligible&&!allowUnmet)errors.push(...check.unmet);
      else {
        if(!check.eligible)warnings.push(...check.unmet.map(message=>`GM Override: ${message}`));
        resolved=applySpeciesFormOverrides(resolved,form.overrides); applied.push({id:form.id,name:form.name,mode:form.mode,requirements:check});
      }
    }
  }

  resolved.forms=forms;
  resolved.formState={...state,applied:applied.map(form=>({id:form.id,name:form.name,mode:form.mode}))};
  return {valid:errors.length===0,errors,warnings,species:resolved,formState:state,forms,applied};
}
