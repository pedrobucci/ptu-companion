from __future__ import annotations

import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
WINDOWS_REPO=ROOT/'PTU_Companion_Windows_Source/definitions/repository.mjs'
PACK_IMPORTER=ROOT/'PTU_Companion_Windows_Source/definitions/pack-importer.mjs'
WINDOWS_SERVER=ROOT/'PTU_Companion_Windows_Source/server.mjs'
ANDROID_API=ROOT/'PTU_Companion_Android_Tauri/www/mobile-api.mjs'
WINDOWS_PACKAGE=ROOT/'PTU_Companion_Windows_Source/package.json'
ANDROID_PACKAGE=ROOT/'PTU_Companion_Android_Tauri/package.json'


def replace_once(text:str,old:str,new:str,path:Path)->str:
    count=text.count(old)
    if count!=1:
        raise RuntimeError(f'Expected one anchor in {path}, found {count}: {old[:120]!r}')
    return text.replace(old,new,1)


def patch_windows_repository():
    path=WINDOWS_REPO
    text=path.read_text(encoding='utf-8')
    changed=False
    if "from '../rules/pokemon-forms.mjs'" not in text:
        text=replace_once(text,"import {normalizeCapabilities} from '../rules/capability-normalization.mjs';","import {normalizeCapabilities} from '../rules/capability-normalization.mjs';\nimport {normalizeSpeciesForms} from '../rules/pokemon-forms.mjs';",path); changed=True
    if "forms:normalizeSpeciesForms" not in text:
        text=replace_once(text,"      levelUpMoves:raw.level_up_moves || [],","      levelUpMoves:raw.level_up_moves || [],\n      forms:normalizeSpeciesForms(raw.forms || raw.form_definitions || []),",path); changed=True
    if changed:path.write_text(text,encoding='utf-8')
    print(('Patched' if changed else 'Already patched'),path.relative_to(ROOT))


def patch_pack_importer():
    path=PACK_IMPORTER
    text=path.read_text(encoding='utf-8')
    changed=False
    if "from '../rules/pokemon-forms.mjs'" not in text:
        text=replace_once(text,"import {inflateRawSync} from 'node:zlib';","import {inflateRawSync} from 'node:zlib';\nimport {normalizeSpeciesForms} from '../rules/pokemon-forms.mjs';",path); changed=True
    marker="if(kind==='species')normalizeSpeciesForms(raw.forms||raw.form_definitions||[]);"
    if marker not in text:
        old="      if(kind==='species')raw=embedSpeciesPortrait(raw,entries);"
        new="      if(kind==='species'){\n        raw=embedSpeciesPortrait(raw,entries);\n        // Stage B: .ptucp Species may carry Form definitions without a format-version bump.\n        // Normalize here to validate IDs/modes/override schema, but preserve the author-provided JSON as stored content.\n        normalizeSpeciesForms(raw.forms||raw.form_definitions||[]);\n      }"
        text=replace_once(text,old,new,path); changed=True
    if changed:path.write_text(text,encoding='utf-8')
    print(('Patched' if changed else 'Already patched'),path.relative_to(ROOT))


def patch_mobile_api():
    path=ANDROID_API
    text=path.read_text(encoding='utf-8')
    changed=False
    if "from './rules/pokemon-forms.mjs'" not in text:
        text=replace_once(text,"import {normalizeCapabilities} from './rules/capability-normalization.mjs';","import {normalizeCapabilities} from './rules/capability-normalization.mjs';\nimport {normalizeSpeciesForms,normalizePokemonFormState,resolvePokemonForms} from './rules/pokemon-forms.mjs';",path); changed=True
    if "forms:normalizeSpeciesForms(raw.forms||raw.form_definitions||[])" not in text:
        text=replace_once(text,"    types:Array.isArray(raw.types)?raw.types:[],baseStats:raw.base_stats||null,abilities:raw.ability_slots||[],capabilities:normalizeCapabilities(raw.capabilities),levelUpMoves:raw.level_up_moves||[],","    types:Array.isArray(raw.types)?raw.types:[],baseStats:raw.base_stats||null,abilities:raw.ability_slots||[],capabilities:normalizeCapabilities(raw.capabilities),levelUpMoves:raw.level_up_moves||[],forms:normalizeSpeciesForms(raw.forms||raw.form_definitions||[]),",path); changed=True
    old="  getResolved({rulesetId,kind,id}){ const vid=this._map(rulesetId,kind)[id],record=data.records?.[vid]; if(!record)return null; const out={...deep(record),kind}; if(kind==='species')out.capabilities=normalizeCapabilities(out.capabilities||out.raw?.capabilities); return out; }"
    new="  getResolved({rulesetId,kind,id}){ const vid=this._map(rulesetId,kind)[id],record=data.records?.[vid]; if(!record)return null; const out={...deep(record),kind}; if(kind==='species'){out.capabilities=normalizeCapabilities(out.capabilities||out.raw?.capabilities);out.forms=normalizeSpeciesForms(out.forms||out.raw?.forms||out.raw?.form_definitions||[]);} return out; }"
    if old in text:
        text=text.replace(old,new,1); changed=True
    old="  getVersions({kind,id}){ const vids=data.versionGroups?.[`${kind}:${id}`]||[]; return vids.map(v=>{const record=data.records[v];if(!record)return null;const out={...deep(record),kind};if(kind==='species')out.capabilities=normalizeCapabilities(out.capabilities||out.raw?.capabilities);return out;}).filter(Boolean); }"
    new="  getVersions({kind,id}){ const vids=data.versionGroups?.[`${kind}:${id}`]||[]; return vids.map(v=>{const record=data.records[v];if(!record)return null;const out={...deep(record),kind};if(kind==='species'){out.capabilities=normalizeCapabilities(out.capabilities||out.raw?.capabilities);out.forms=normalizeSpeciesForms(out.forms||out.raw?.forms||out.raw?.form_definitions||[]);}return out;}).filter(Boolean); }"
    if old in text:
        text=text.replace(old,new,1); changed=True
    helper="""
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
  return resolvePokemonForms({species,formState:state,context:pokemonFormContext({pokemon,payload}),allowUnmet:!!payload.gmOverride});
}
"""
    if "function resolveSpeciesFormState" not in text:
        text=replace_once(text,"const defaultRuleset='all-provided-material';","const defaultRuleset='all-provided-material';\n"+helper,path); changed=True
    api_block="""  if(req.method==='POST' && url.pathname==='/api/pokemon/forms/resolve'){
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
"""
    if "/api/pokemon/forms/resolve" not in text:
        anchor="  if(req.method==='POST' && url.pathname==='/api/pokemon/build-preview'){"
        text=replace_once(text,anchor,api_block+anchor,path); changed=True
    # Build preview becomes Form-aware.
    marker="const buildFormResolution=resolveSpeciesFormState"
    if marker not in text:
        old="    const species=definitions.getResolved({rulesetId,kind:'species',id:speciesId});\n    if(!species) return json(res,404,{error:'Species definition not found in active ruleset'});"
        new="    const baseSpecies=definitions.getResolved({rulesetId,kind:'species',id:speciesId});\n    if(!baseSpecies) return json(res,404,{error:'Species definition not found in active ruleset'});\n    const buildFormResolution=resolveSpeciesFormState({species:baseSpecies,pokemon:{level:payload.level,details:{}},payload});\n    if(!buildFormResolution.valid)return json(res,400,{error:'Selected Pokémon Form is not valid.',formResolution:buildFormResolution});\n    const species=buildFormResolution.species;"
        pos=text.index("if(req.method==='POST' && url.pathname==='/api/pokemon/build-preview')")
        before=text[:pos]; after=text[pos:]
        if old not in after:
            raise RuntimeError(f'Could not find endpoint-local species anchor in {path}: {old[:120]!r}')
        after=after.replace(old,new,1)
        text=before+after; changed=True
    marker="const referenceFormResolution=resolveSpeciesFormState"
    if marker not in text:
        pos=text.index("if(req.method==='POST' && url.pathname==='/api/pokemon/reference-data')")
        before=text[:pos]; after=text[pos:]
        old="    const species=definitions.getResolved({rulesetId,kind:'species',id:speciesId});\n    if(!species) return json(res,404,{error:'Current Species definition not found in active ruleset'});"
        new="    const baseSpecies=definitions.getResolved({rulesetId,kind:'species',id:speciesId});\n    if(!baseSpecies) return json(res,404,{error:'Current Species definition not found in active ruleset'});\n    const referenceFormResolution=resolveSpeciesFormState({species:baseSpecies,pokemon,payload});\n    if(!referenceFormResolution.valid)return json(res,400,{error:'Stored Pokémon Form state is not valid.',formResolution:referenceFormResolution});\n    const species=referenceFormResolution.species;"
        if old not in after:
            raise RuntimeError(f'Could not find endpoint-local species anchor in {path}: {old[:120]!r}')
        after=after.replace(old,new,1)
        text=before+after; changed=True
    if changed:path.write_text(text,encoding='utf-8')
    print(('Patched' if changed else 'Already patched'),path.relative_to(ROOT))


def patch_windows_server():
    path=WINDOWS_SERVER
    text=path.read_text(encoding='utf-8')
    changed=False
    if "from './rules/pokemon-forms.mjs'" not in text:
        text=replace_once(text,"import {itemUsageMetadata} from './rules/item-metadata.mjs';","import {itemUsageMetadata} from './rules/item-metadata.mjs';\nimport {normalizePokemonFormState,resolvePokemonForms} from './rules/pokemon-forms.mjs';",path); changed=True
    helper="""
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
  return resolvePokemonForms({species,formState:state,context:pokemonFormContext({pokemon,payload}),allowUnmet:!!payload.gmOverride});
}
"""
    if "function resolveSpeciesFormState" not in text:
        anchor="const getActiveRuleset=()=>db.prepare(\"SELECT value FROM app_meta WHERE key='active_ruleset_id'\").get()?.value || defaultRuleset;"
        text=replace_once(text,anchor,anchor+"\n"+helper,path); changed=True
    api_block="""  if(req.method==='POST' && url.pathname==='/api/pokemon/forms/resolve'){
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
"""
    if "/api/pokemon/forms/resolve" not in text:
        anchor="  if(req.method==='POST' && url.pathname==='/api/pokemon/build-preview'){"
        text=replace_once(text,anchor,api_block+anchor,path); changed=True
    if "const buildFormResolution=resolveSpeciesFormState" not in text:
        pos=text.index("if(req.method==='POST' && url.pathname==='/api/pokemon/build-preview')")
        before=text[:pos]; after=text[pos:]
        old="    const species=definitions.getResolved({rulesetId,kind:'species',id:speciesId});\n    if(!species) return json(res,404,{error:'Species definition not found in active ruleset'});"
        new="    const baseSpecies=definitions.getResolved({rulesetId,kind:'species',id:speciesId});\n    if(!baseSpecies) return json(res,404,{error:'Species definition not found in active ruleset'});\n    const buildFormResolution=resolveSpeciesFormState({species:baseSpecies,pokemon:{level:payload.level,details:{}},payload});\n    if(!buildFormResolution.valid)return json(res,400,{error:'Selected Pokémon Form is not valid.',formResolution:buildFormResolution});\n    const species=buildFormResolution.species;"
        if old not in after:
            raise RuntimeError(f'Could not find endpoint-local species anchor in {path}: {old[:120]!r}')
        after=after.replace(old,new,1); text=before+after; changed=True
    if "const referenceFormResolution=resolveSpeciesFormState" not in text:
        pos=text.index("if(req.method==='POST' && url.pathname==='/api/pokemon/reference-data')")
        before=text[:pos]; after=text[pos:]
        old="    const species=definitions.getResolved({rulesetId,kind:'species',id:speciesId});\n    if(!species) return json(res,404,{error:'Current Species definition not found in active ruleset'});"
        new="    const baseSpecies=definitions.getResolved({rulesetId,kind:'species',id:speciesId});\n    if(!baseSpecies) return json(res,404,{error:'Current Species definition not found in active ruleset'});\n    const referenceFormResolution=resolveSpeciesFormState({species:baseSpecies,pokemon,payload});\n    if(!referenceFormResolution.valid)return json(res,400,{error:'Stored Pokémon Form state is not valid.',formResolution:referenceFormResolution});\n    const species=referenceFormResolution.species;"
        if old not in after:
            raise RuntimeError(f'Could not find endpoint-local species anchor in {path}: {old[:120]!r}')
        after=after.replace(old,new,1); text=before+after; changed=True
    if changed:path.write_text(text,encoding='utf-8')
    print(('Patched' if changed else 'Already patched'),path.relative_to(ROOT))


def patch_package(path:Path,command:str):
    data=json.loads(path.read_text(encoding='utf-8'))
    verify=data.get('scripts',{}).get('verify')
    if not verify:raise RuntimeError(f'Missing scripts.verify in {path}')
    if command not in verify:
        data['scripts']['verify']=verify+' && '+command
        path.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        print('Updated',path.relative_to(ROOT))
    else:print('Verifier already present in',path.relative_to(ROOT))

patch_windows_repository()
patch_pack_importer()
patch_windows_server()
patch_mobile_api()
patch_package(WINDOWS_PACKAGE,'node scripts/verify_stage_b_forms_foundation.mjs')
patch_package(ANDROID_PACKAGE,'node scripts/verify-stage-b-forms-foundation.mjs')
