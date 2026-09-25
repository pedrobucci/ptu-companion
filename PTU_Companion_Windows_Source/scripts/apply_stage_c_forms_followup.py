from __future__ import annotations

from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
APP_PATHS=[ROOT/'PTU_Companion_Windows_Source/static-preview/app.js',ROOT/'PTU_Companion_Android_Tauri/www/app.js']
API_PATHS=[ROOT/'PTU_Companion_Windows_Source/server.mjs',ROOT/'PTU_Companion_Android_Tauri/www/mobile-api.mjs']


def replace_once(text:str,old:str,new:str,path:Path)->str:
    count=text.count(old)
    if count!=1: raise RuntimeError(f'Expected one anchor in {path}, found {count}: {old[:140]!r}')
    return text.replace(old,new,1)


def replace_in_route(text:str,route:str,old:str,new:str,path:Path)->tuple[str,bool]:
    route_anchor=f"if(req.method==='POST' && url.pathname==='{route}')"
    start=text.find(route_anchor)
    if start<0: raise RuntimeError(f'Missing route {route} in {path}')
    end=text.find("\n  if(req.method===",start+len(route_anchor))
    if end<0: end=len(text)
    section=text[start:end]
    if new in section: return text,False
    count=section.count(old)
    if count!=1: raise RuntimeError(f'Expected one route-local anchor in {path} {route}, found {count}: {old[:140]!r}')
    section=section.replace(old,new,1)
    return text[:start]+section+text[end:],True


def make_permanent_form_aware(text:str,path:Path,route:str,var_name:str,missing_message:str)->tuple[str,bool]:
    old=f"    const species=definitions.getResolved({{rulesetId,kind:'species',id:speciesId}});\n    if(!species) return json(res,404,{{error:'{missing_message}'}});"
    new=f"    const baseSpecies=definitions.getResolved({{rulesetId,kind:'species',id:speciesId}});\n    if(!baseSpecies) return json(res,404,{{error:'{missing_message}'}});\n    const {var_name}=resolveSpeciesFormState({{species:baseSpecies,pokemon,payload,includeActive:false}});\n    if(!{var_name}.valid)return json(res,400,{{error:'Stored permanent Pokémon Form state is not valid.',formResolution:{var_name}}});\n    const species={var_name}.species;"
    return replace_in_route(text,route,old,new,path)


def patch_api(path:Path)->None:
    text=path.read_text(encoding='utf-8'); changed=False

    route='/api/pokemon/build-preview'
    old="    return json(res,200,{rulesetId,species:{id:species.id,name:species.name,types:species.types||[],versionId:species.versionId,contentPackId:species.contentPackId,sourceId:species.sourceId},experience:definitions.getPokemonExperience(preview.level),preview});"
    new="    return json(res,200,{rulesetId,species:{id:species.id,name:species.name,types:species.types||[],versionId:species.versionId,contentPackId:species.contentPackId,sourceId:species.sourceId},formResolution:buildFormResolution,experience:definitions.getPokemonExperience(preview.level),preview});"
    text,did=replace_in_route(text,route,old,new,path); changed|=did

    route='/api/pokemon/reference-data'
    old="    return json(res,200,{rulesetId,species,moves,abilities,abilitySlots,abilitySlotStatus,resolvedCreature:resolvedCreatureModel({pokemon,species,rulesetId,heldItemEffect:held.effect,heldItemDefinition:held.definition}),modifierSummary:getPokemonModifierSummary(resolvedPokemonForCombat,{heldItemEffect:held.effect}),heldItem:{definition:held.definition,effect:held.effect},typeProfile,incomingEvolution:incoming||null,outgoingEvolutions:outgoing});"
    new="    return json(res,200,{rulesetId,species,formResolution:referenceFormResolution,moves,abilities,abilitySlots,abilitySlotStatus,resolvedCreature:resolvedCreatureModel({pokemon,species,rulesetId,heldItemEffect:held.effect,heldItemDefinition:held.definition}),modifierSummary:getPokemonModifierSummary(resolvedPokemonForCombat,{heldItemEffect:held.effect}),heldItem:{definition:held.definition,effect:held.effect},typeProfile,incomingEvolution:incoming||null,outgoingEvolutions:outgoing});"
    text,did=replace_in_route(text,route,old,new,path); changed|=did

    for route,var_name in [
        ('/api/pokemon/progression-preview','progressionFormResolution'),
        ('/api/pokemon/ability-correction-preview','abilityFormResolution'),
        ('/api/pokemon/restat-preview','restatFormResolution'),
        ('/api/pokemon/training-options','trainingFormResolution'),
        ('/api/pokemon/training-action-preview','trainingActionFormResolution'),
    ]:
        text,did=make_permanent_form_aware(text,path,route,var_name,'Current Species definition not found in active ruleset'); changed|=did

    route='/api/pokemon/progression-preview'
    old="    const evolutions=definitions.getOutgoingEvolutions({rulesetId,speciesName:species.name,sourceId:species.sourceId});"
    new="    const evolutions=definitions.getOutgoingEvolutions({rulesetId,speciesName:baseSpecies.name,sourceId:baseSpecies.sourceId});"
    text,did=replace_in_route(text,route,old,new,path); changed|=did
    old="    return json(res,200,{rulesetId,currentSpecies:{id:species.id,name:species.name,types:species.types||[],versionId:species.versionId,contentPackId:species.contentPackId,sourceId:species.sourceId},evolutionCandidates:candidates,preview});"
    new="    return json(res,200,{rulesetId,currentSpecies:{id:species.id,name:species.name,types:species.types||[],versionId:species.versionId,contentPackId:species.contentPackId,sourceId:species.sourceId},formResolution:progressionFormResolution,evolutionCandidates:candidates,preview});"
    text,did=replace_in_route(text,route,old,new,path); changed|=did

    route='/api/pokemon/reference-data'
    for old,new in [
        ("    const held=resolvePokemonHeldItem({rulesetId,pokemon,species});","    const held=resolvePokemonHeldItem({rulesetId,pokemon,species:baseSpecies});"),
        ("    const outgoing=definitions.getOutgoingEvolutions({rulesetId,speciesName:species.name,sourceId:species.sourceId});","    const outgoing=definitions.getOutgoingEvolutions({rulesetId,speciesName:baseSpecies.name,sourceId:baseSpecies.sourceId});"),
        ("    const incoming=definitions.getIncomingEvolution({speciesName:species.name,sourceId:species.sourceId});","    const incoming=definitions.getIncomingEvolution({speciesName:baseSpecies.name,sourceId:baseSpecies.sourceId});"),
    ]:
        text,did=replace_in_route(text,route,old,new,path); changed|=did

    if changed:path.write_text(text,encoding='utf-8')
    print(('Patched' if changed else 'Already patched'),path.relative_to(ROOT))


def patch_app(path:Path)->None:
    text=path.read_text(encoding='utf-8'); changed=False

    old="""async function openPokemonFormsManager(){
  const p=pokemon(); if(!p?.details?.speciesDefinitionId)return toast('This Pokémon is not linked to a Species definition.','error');
  if(creatureReferenceState.pokemonId!==p.id||!creatureReferenceState.data)await loadCreatureReferenceData(true);
  const data=creatureReferenceState.pokemonId===p.id?creatureReferenceState.data:null;
  if(!data)return toast(creatureReferenceState.error||'Could not resolve Pokémon Forms.','error');
  const forms=Array.isArray(data.species?.forms)?data.species.forms:[];
"""
    new="""let pokemonFormsUiCache={pokemonId:null,forms:[]};
async function openPokemonFormsManager(){
  const p=pokemon(); if(!p?.details?.speciesDefinitionId)return toast('This Pokémon is not linked to a Species definition.','error');
  if(creatureReferenceState.pokemonId!==p.id||!creatureReferenceState.data)await loadCreatureReferenceData(true);
  const data=creatureReferenceState.pokemonId===p.id?creatureReferenceState.data:null;
  let formPayload=null;
  try{
    const response=await fetch('/api/pokemon/forms/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:p,gmOverride:!!state.ui.gmOverride,rulesetId:catalogState.status?.activeRulesetId})});
    formPayload=await response.json().catch(()=>null);
  }catch{}
  const forms=Array.isArray(formPayload?.baseSpecies?.forms)?formPayload.baseSpecies.forms:(Array.isArray(data?.species?.forms)?data.species.forms:[]);
  if(!forms.length)return toast(creatureReferenceState.error||formPayload?.error||'This Species has no alternate Forms in the active Ruleset.','error');
  pokemonFormsUiCache={pokemonId:p.id,forms};
"""
    if old in text:
        text=text.replace(old,new,1); changed=True
    elif 'let pokemonFormsUiCache=' not in text:
        raise RuntimeError(f'Forms manager recovery anchor missing in {path}')

    old="  if(!forms.length)return toast('This Species has no alternate Forms in the active Ruleset.','error');\n"
    if old in text:
        text=text.replace(old,'',1); changed=True

    old="  const applied=data.formResolution?.applied||[]; const warnings=data.formResolution?.warnings||[];"
    new="  const resolution=formPayload?.formState?formPayload:data?.formResolution; const applied=resolution?.applied||[]; const warnings=resolution?.warnings||[]; const errors=resolution?.errors||[];"
    if old in text:
        text=text.replace(old,new,1); changed=True
    elif new not in text: raise RuntimeError(f'Forms manager resolution anchor missing in {path}')

    error_block="${errors.length?`<div class=\"builder-validation bad\"><strong>Current Form needs attention</strong><ul>${errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul><small>You can use the choices below to recover to a valid Form state.</small></div>`:''}"
    while error_block+error_block in text:
        text=text.replace(error_block+error_block,error_block,1); changed=True
    warnings_anchor="${warnings.length?`<div class=\"builder-validation bad\"><strong>Form warnings</strong><ul>${warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:''}<h3>Permanent / Base Form</h3>"
    if error_block not in text:
        text=replace_once(text,warnings_anchor,error_block+warnings_anchor,path); changed=True

    old="  const form=formId==='base'?null:(data?.species?.forms||[]).find(x=>x.id===formId&&x.mode==='permanent');"
    new="  const forms=pokemonFormsUiCache.pokemonId===p.id?pokemonFormsUiCache.forms:(data?.species?.forms||[]); const form=formId==='base'?null:forms.find(x=>x.id===formId&&x.mode==='permanent');"
    if old in text:
        text=text.replace(old,new,1); changed=True
    elif new not in text: raise RuntimeError(f'Permanent Form cache anchor missing in {path}')

    old="  const form=(data?.species?.forms||[]).find(x=>x.id===formId&&x.mode==='transformation');"
    new="  const forms=pokemonFormsUiCache.pokemonId===p.id?pokemonFormsUiCache.forms:(data?.species?.forms||[]); const form=forms.find(x=>x.id===formId&&x.mode==='transformation');"
    if old in text:
        text=text.replace(old,new,1); changed=True
    elif new not in text: raise RuntimeError(f'Transformation Form cache anchor missing in {path}')

    old="  d.experience=pv.totalExperience; d.speciesDefinitionId=pv.targetSpecies.id; d.speciesVersionId=pv.targetSpecies.versionId; d.speciesContentPackId=pv.targetSpecies.contentPackId;"
    new="  d.experience=pv.totalExperience; d.speciesDefinitionId=pv.targetSpecies.id; d.speciesVersionId=pv.targetSpecies.versionId; d.speciesContentPackId=pv.targetSpecies.contentPackId;\n  if(pv.evolved){d.formState={schemaVersion:1,baseFormId:'base',activeFormId:null};d.manualFormApprovals=[];}"
    if old in text:
        text=text.replace(old,new,1); changed=True
    elif "if(pv.evolved){d.formState={schemaVersion:1,baseFormId:'base',activeFormId:null};d.manualFormApprovals=[];}" not in text:
        raise RuntimeError(f'Evolution Form reset anchor missing in {path}')

    if changed:path.write_text(text,encoding='utf-8')
    print(('Patched' if changed else 'Already patched'),path.relative_to(ROOT))


for api in API_PATHS: patch_api(api)
for app in APP_PATHS: patch_app(app)
