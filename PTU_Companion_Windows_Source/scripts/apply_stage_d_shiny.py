from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FORM_PATHS = [
    ROOT / 'PTU_Companion_Windows_Source/rules/pokemon-forms.mjs',
    ROOT / 'PTU_Companion_Android_Tauri/www/rules/pokemon-forms.mjs',
]
APP_PATHS = [
    ROOT / 'PTU_Companion_Windows_Source/static-preview/app.js',
    ROOT / 'PTU_Companion_Android_Tauri/www/app.js',
]
API_PATHS = [
    ROOT / 'PTU_Companion_Windows_Source/server.mjs',
    ROOT / 'PTU_Companion_Android_Tauri/www/mobile-api.mjs',
]
WINDOWS_PACKAGE = ROOT / 'PTU_Companion_Windows_Source/package.json'
ANDROID_PACKAGE = ROOT / 'PTU_Companion_Android_Tauri/package.json'


def replace_once(text: str, old: str, new: str, path: Path) -> tuple[str, bool]:
    if new in text:
        return text, False
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'Expected one anchor in {path}, found {count}: {old[:180]!r}')
    return text.replace(old, new, 1), True


def patch_forms(path: Path) -> None:
    text = path.read_text(encoding='utf-8')
    if 'export function resolvePokemonPresentation' in text:
        print('Already patched', path.relative_to(ROOT))
        return

    helper = r'''
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
'''
    marker = 'export function resolvePokemonForms({species,formState={},context={},allowUnmet=false}={}){'
    if marker not in text:
        raise RuntimeError(f'Forms resolver marker missing in {path}')
    text = text.replace(marker, helper + '\n' + marker, 1)
    path.write_text(text, encoding='utf-8')
    print('Patched', path.relative_to(ROOT))


def patch_api(path: Path) -> None:
    text = path.read_text(encoding='utf-8')
    changed = False

    old = "import {normalizePokemonFormState,resolvePokemonForms} from './rules/pokemon-forms.mjs';"
    new = "import {normalizePokemonFormState,resolvePokemonForms,resolvePokemonPresentation} from './rules/pokemon-forms.mjs';"
    if old in text:
        text = text.replace(old, new, 1); changed = True
    elif new not in text:
        raise RuntimeError(f'Forms import anchor missing in {path}')

    old = "  return resolvePokemonForms({species,formState:state,context:pokemonFormContext({pokemon,payload}),allowUnmet:!!payload.gmOverride});"
    new = "  const isShiny=!!(payload.isShiny??details.isShiny??details.is_shiny??false);\n  return resolvePokemonPresentation({species,formState:state,context:pokemonFormContext({pokemon,payload}),allowUnmet:!!payload.gmOverride,isShiny});"
    if old in text:
        text = text.replace(old, new, 1); changed = True
    elif new not in text:
        raise RuntimeError(f'Form-state resolution anchor missing in {path}')

    if path.name == 'server.mjs':
        old = "    const packedPortrait=String(species.raw?.portrait_data_url||'');"
        if 'const requestedPresentation=resolvePokemonPresentation' not in text:
            if old not in text:
                raise RuntimeError('Desktop portrait route anchor missing')
            new = r'''    const requestedFormState={baseFormId:url.searchParams.get('base')||'base',activeFormId:url.searchParams.get('active')||null};
    const requestedShiny=url.searchParams.get('shiny')==='1';
    const requestedPresentation=resolvePokemonPresentation({species,formState:requestedFormState,context:{},allowUnmet:true,isShiny:requestedShiny}).presentation;
    const explicitArtwork=String(requestedPresentation?.artworkUrl||'').trim();
    const explicitPacked=explicitArtwork.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if(explicitPacked){
      const bytes=Buffer.from(explicitPacked[2],'base64');
      res.writeHead(200,{'Content-Type':explicitPacked[1],'Cache-Control':'public, max-age=2592000','Content-Length':bytes.length});
      return res.end(bytes);
    }
    if(/^https?:\/\//i.test(explicitArtwork)){
      try{
        const remote=await fetch(explicitArtwork,{headers:{'User-Agent':'PTU-Companion-Beta/2.1'},signal:AbortSignal.timeout(1800)});
        const type=remote.headers.get('content-type')||'';
        if(remote.ok&&type.startsWith('image/')){
          const bytes=Buffer.from(await remote.arrayBuffer());
          if(bytes.length>0&&bytes.length<2000000){res.writeHead(200,{'Content-Type':type.split(';')[0],'Cache-Control':'public, max-age=2592000','Content-Length':bytes.length});return res.end(bytes);}
        }
      }catch{}
    }else if(explicitArtwork&&!explicitArtwork.includes('..')&&!/^data:/i.test(explicitArtwork)){
      const localRel=explicitArtwork.replace(/^\.?\/+/, '');
      const localFile=join(staticRoot,localRel); const bytes=await readFile(localFile).catch(()=>null);
      if(bytes){const contentType=mime[extname(localFile).toLowerCase()]||'application/octet-stream';res.writeHead(200,{'Content-Type':contentType,'Cache-Control':'public, max-age=2592000','Content-Length':bytes.length});return res.end(bytes);}
    }
    const packedPortrait=String(species.raw?.portrait_data_url||'');'''
            text = text.replace(old, new, 1); changed = True
    else:
        marker = "window.__PTU_SPECIES_PORTRAIT__=(speciesId)=>{"
        if 'window.__PTU_RESOLVED_POKEMON_ARTWORK__' not in text:
            start = text.find(marker)
            if start < 0:
                raise RuntimeError('Android portrait bridge anchor missing')
            end = text.find('\n};', start)
            if end < 0:
                raise RuntimeError('Android portrait bridge end missing')
            end += 3
            addition = r'''
window.__PTU_RESOLVED_POKEMON_ARTWORK__=(speciesId,formState,isShiny=false,context={})=>{
  try{
    const species=definitions.getResolved({rulesetId:getActiveRuleset(),kind:'species',id:String(speciesId||'')});
    if(!species)return null;
    const resolved=resolvePokemonPresentation({species,formState:formState||{},context:context||{},allowUnmet:true,isShiny:!!isShiny});
    return resolved.presentation?.artworkUrl||species.raw?.portrait_data_url||null;
  }catch{return null;}
};'''
            text = text[:end] + addition + text[end:]; changed = True

    if changed:
        path.write_text(text, encoding='utf-8')
    print(('Patched' if changed else 'Already patched'), path.relative_to(ROOT))


def patch_app(path: Path) -> None:
    text = path.read_text(encoding='utf-8')
    changed = False
    is_android = 'Android_Tauri' in str(path)

    # Safe migration for old saves and legacy snake_case/top-level variants.
    old = "    p.details.gender=normalizePokemonGender(p.details.gender??p.gender??p.sex??'None');"
    new = "    p.details.gender=normalizePokemonGender(p.details.gender??p.gender??p.sex??'None');\n    p.details.isShiny=!!(p.details.isShiny??p.details.is_shiny??p.isShiny??p.is_shiny??false);"
    if old in text:
        text = text.replace(old, new, 1); changed = True
    elif new not in text:
        raise RuntimeError(f'Shiny migration anchor missing in {path}')

    # Builder defaults: shiny is presentation state and defaults off.
    if "manualFormApprovals:[],isShiny:false" not in text:
        count = text.count("baseFormId:'base',manualFormApprovals:[]")
        if count < 3:
            raise RuntimeError(f'Expected builder defaults in {path}, found {count}')
        text = text.replace("baseFormId:'base',manualFormApprovals:[]", "baseFormId:'base',manualFormApprovals:[],isShiny:false")
        changed = True

    old = "      formState:{baseFormId:f.baseFormId||'base',activeFormId:null},manualFormApprovals:f.manualFormApprovals||[],"
    new = "      formState:{baseFormId:f.baseFormId||'base',activeFormId:null},manualFormApprovals:f.manualFormApprovals||[],isShiny:!!f.isShiny,"
    if old in text:
        text = text.replace(old, new, 1); changed = True
    elif new not in text:
        raise RuntimeError(f'Builder preview Shiny anchor missing in {path}')

    old = "    formState:{schemaVersion:1,baseFormId:f.baseFormId||'base',activeFormId:null},manualFormApprovals:[...(f.manualFormApprovals||[])],"
    new = "    formState:{schemaVersion:1,baseFormId:f.baseFormId||'base',activeFormId:null},manualFormApprovals:[...(f.manualFormApprovals||[])],isShiny:!!f.isShiny,"
    if old in text:
        text = text.replace(old, new, 1); changed = True
    elif new not in text:
        raise RuntimeError(f'Created Pokémon Shiny anchor missing in {path}')

    # Builder UI and review.
    old = "<label>Initial Location<select onchange=\"setPokemonBuilderField('location',this.value)\"><option value=\"carried\" ${f.location==='carried'?'selected':''}>Carried / Available</option><option value=\"storage\" ${f.location==='storage'?'selected':''}>Storage</option></select></label></div>${formBuilderBlock}"
    new = "<label>Shiny<select onchange=\"setPokemonBuilderField('isShiny',this.value==='yes')\"><option value=\"no\" ${!f.isShiny?'selected':''}>No</option><option value=\"yes\" ${f.isShiny?'selected':''}>Yes — Shiny appearance</option></select></label><label>Initial Location<select onchange=\"setPokemonBuilderField('location',this.value)\"><option value=\"carried\" ${f.location==='carried'?'selected':''}>Carried / Available</option><option value=\"storage\" ${f.location==='storage'?'selected':''}>Storage</option></select></label></div>${formBuilderBlock}"
    if old in text:
        text = text.replace(old, new, 1); changed = True
    elif new not in text:
        raise RuntimeError(f'Builder Shiny field anchor missing in {path}')

    old = "<div><dt>Sex</dt><dd>${esc(pokemonGenderLabel(f.gender))}</dd></div><div><dt>Location</dt>"
    new = "<div><dt>Sex</dt><dd>${esc(pokemonGenderLabel(f.gender))}</dd></div><div><dt>Shiny</dt><dd>${f.isShiny?'Yes':'No'}</dd></div><div><dt>Location</dt>"
    if old in text:
        text = text.replace(old, new, 1); changed = True
    elif new not in text:
        raise RuntimeError(f'Builder Shiny review anchor missing in {path}')

    # Portrait resolution uses Form + Shiny presentation, with normal/local fallback.
    if is_android:
        old = """function pokemonPortraitUrl(p){\n  const speciesId=String(p?.details?.speciesDefinitionId||'').trim();\n  if(window.PTU_ANDROID_BUILD&&speciesId)return androidSpeciesArtwork(speciesId);\n  return speciesId?`/api/pokemon/portrait/${encodeURIComponent(speciesId)}`:(p?.img||'creatures/default.svg');\n}"""
        new = """function pokemonPortraitUrl(p){\n  const speciesId=String(p?.details?.speciesDefinitionId||'').trim();\n  const formState=p?.details?.formState||{baseFormId:'base',activeFormId:null}; const isShiny=!!p?.details?.isShiny;\n  if(window.PTU_ANDROID_BUILD&&speciesId){\n    const resolved=window.__PTU_RESOLVED_POKEMON_ARTWORK__?.(speciesId,formState,isShiny,{level:p?.level,gender:p?.details?.gender,heldItemName:p?.heldItem,manualApprovals:p?.details?.manualFormApprovals||[]});\n    return resolved||androidSpeciesArtwork(speciesId);\n  }\n  if(speciesId){const params=new URLSearchParams();if(formState.baseFormId&&formState.baseFormId!=='base')params.set('base',formState.baseFormId);if(formState.activeFormId)params.set('active',formState.activeFormId);if(isShiny)params.set('shiny','1');const qs=params.toString();return `/api/pokemon/portrait/${encodeURIComponent(speciesId)}${qs?'?'+qs:''}`;}\n  return p?.img||'creatures/default.svg';\n}"""
    else:
        old = """function pokemonPortraitUrl(p){\n  const speciesId=String(p?.details?.speciesDefinitionId||'').trim();\n  return speciesId?`/api/pokemon/portrait/${encodeURIComponent(speciesId)}`:(p?.img||'creatures/default.svg');\n}"""
        new = """function pokemonPortraitUrl(p){\n  const speciesId=String(p?.details?.speciesDefinitionId||'').trim();\n  if(speciesId){const formState=p?.details?.formState||{baseFormId:'base',activeFormId:null};const params=new URLSearchParams();if(formState.baseFormId&&formState.baseFormId!=='base')params.set('base',formState.baseFormId);if(formState.activeFormId)params.set('active',formState.activeFormId);if(p?.details?.isShiny)params.set('shiny','1');const qs=params.toString();return `/api/pokemon/portrait/${encodeURIComponent(speciesId)}${qs?'?'+qs:''}`;}\n  return p?.img||'creatures/default.svg';\n}"""
    if old in text:
        text = text.replace(old, new, 1); changed = True
    elif new not in text:
        raise RuntimeError(f'Portrait Shiny/Form anchor missing in {path}')

    # Form summary doubles as presentation summary; Shiny exists even on Species without Forms.
    old = """function pokemonFormSummaryBlock(p,data){\n  const forms=Array.isArray(data?.species?.forms)?data.species.forms:[]; if(!forms.length)return '';\n  const current=pokemonFormCurrentState(p); const base=forms.find(form=>form.id===current.baseFormId); const active=forms.find(form=>form.id===current.activeFormId); const warnings=data?.formResolution?.warnings||[];\n  const resolvedTypes=(data?.species?.types||p.types||[]).map(type=>typeBadge(String(type).toLowerCase())).join(' ');\n  return section('POKÉMON FORM',`<dl class=\"detail-dl\"><div><dt>Permanent Form</dt><dd>${esc(base?.name||'Canonical Base')}</dd></div><div><dt>Active Transformation</dt><dd>${esc(active?.name||'None')}</dd></div><div><dt>Resolved Types</dt><dd>${resolvedTypes||'—'}</dd></div></dl>${warnings.length?`<div class=\"builder-validation bad\"><ul>${warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:'<p class=\"muted\">Types, Base Stats, Ability pool, Capabilities and natural Move data are resolved from this Form state.</p>'}`,`<button class=\"btn btn-gold btn-small\" onclick=\"openPokemonFormsManager()\">Manage Forms</button>`);\n}"""
    new = """function pokemonFormSummaryBlock(p,data){\n  const forms=Array.isArray(data?.species?.forms)?data.species.forms:[]; const isShiny=!!p?.details?.isShiny; if(!forms.length&&!isShiny)return '';\n  const current=pokemonFormCurrentState(p); const base=forms.find(form=>form.id===current.baseFormId); const active=forms.find(form=>form.id===current.activeFormId); const warnings=data?.formResolution?.warnings||[]; const presentation=data?.formResolution?.presentation||data?.presentation||null;\n  const resolvedTypes=(data?.species?.types||p.types||[]).map(type=>typeBadge(String(type).toLowerCase())).join(' ');\n  const appearance=isShiny?(presentation?.artwork?.hasDedicatedShinyArtwork?'Shiny artwork':'Shiny state · normal artwork fallback'):'Normal';\n  return section('POKÉMON FORM & APPEARANCE',`<dl class=\"detail-dl\"><div><dt>Permanent Form</dt><dd>${esc(base?.name||'Canonical Base')}</dd></div><div><dt>Active Transformation</dt><dd>${esc(active?.name||'None')}</dd></div><div><dt>Shiny</dt><dd>${isShiny?'Yes':'No'}${isShiny?' '+chip('★ SHINY','chip-gold'):''}</dd></div><div><dt>Artwork</dt><dd>${esc(appearance)}</dd></div><div><dt>Resolved Types</dt><dd>${resolvedTypes||'—'}</dd></div></dl>${warnings.length?`<div class=\"builder-validation bad\"><ul>${warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:'<p class=\"muted\">Form mechanics and Shiny presentation are independent layers. Missing dedicated Shiny artwork falls back to the best normal artwork without clearing Shiny state.</p>'}`,forms.length?`<button class=\"btn btn-gold btn-small\" onclick=\"openPokemonFormsManager()\">Manage Forms</button>`:'');\n}"""
    if old in text:
        text = text.replace(old, new, 1); changed = True
    elif new not in text:
        raise RuntimeError(f'Form/Shiny summary anchor missing in {path}')

    # Header chip.
    old = "${tempHp?chip(`TEMP HP +${tempHp}`,'chip-blue'):''}${p.injuries>=5?"
    new = "${tempHp?chip(`TEMP HP +${tempHp}`,'chip-blue'):''}${d.isShiny?chip('★ SHINY','chip-gold'):''}${p.injuries>=5?"
    if old in text:
        text = text.replace(old, new, 1); changed = True
    elif new not in text:
        raise RuntimeError(f'Creature header Shiny chip anchor missing in {path}')

    # Identity editor owns persistent Shiny identity.
    old = "  const currentGender=normalizePokemonGender(p.details.gender??p.gender??p.sex??'None');\n  const values=await styledForm({title:'Edit Pokémon Identity',subtitle:`Species remains ${p.species}. Change the Pokémon's displayed name, Loyalty, and Sex.`,fields:[{name:'name',label:'Name / Nickname',value:p.name||p.species||''},{name:'loyalty',label:'Loyalty',type:'number',min:0,max:6,value:Math.max(0,Math.min(6,Number(p.loyalty)||0))},{name:'gender',label:'Sex',type:'select',value:currentGender,options:[{value:'None',label:'None'},{value:'Male',label:'Male'},{value:'Female',label:'Female'}]}],submitLabel:'Save Changes'});"
    new = "  const currentGender=normalizePokemonGender(p.details.gender??p.gender??p.sex??'None'); const currentShiny=!!p.details.isShiny;\n  const values=await styledForm({title:'Edit Pokémon Identity',subtitle:`Species remains ${p.species}. Change the Pokémon's displayed name, Loyalty, Sex, and Shiny appearance state.`,fields:[{name:'name',label:'Name / Nickname',value:p.name||p.species||''},{name:'loyalty',label:'Loyalty',type:'number',min:0,max:6,value:Math.max(0,Math.min(6,Number(p.loyalty)||0))},{name:'gender',label:'Sex',type:'select',value:currentGender,options:[{value:'None',label:'None'},{value:'Male',label:'Male'},{value:'Female',label:'Female'}]},{name:'shiny',label:'Shiny',type:'select',value:currentShiny?'yes':'no',options:[{value:'no',label:'No'},{value:'yes',label:'Yes — Shiny appearance'}]}],submitLabel:'Save Changes'});"
    if old in text:
        text = text.replace(old, new, 1); changed = True
    elif new not in text:
        raise RuntimeError(f'Identity Shiny field anchor missing in {path}')

    old = "  const loyalty=Math.max(0,Math.min(6,Math.trunc(Number(values.loyalty)||0))); const gender=normalizePokemonGender(values.gender); const oldName=p.name; const oldLoyalty=Number(p.loyalty||0); const oldGender=currentGender;\n  p.name=name; p.loyalty=loyalty; p.details.nickname=name; p.details.gender=gender;\n  trainer().history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Pokémon identity updated',detail:`${oldName} → ${name}; Loyalty ${oldLoyalty} → ${loyalty}; Sex ${oldGender} → ${gender}`});\n  await commit(`${name} updated · Loyalty ${loyalty} · Sex ${gender}.`);"
    new = "  const loyalty=Math.max(0,Math.min(6,Math.trunc(Number(values.loyalty)||0))); const gender=normalizePokemonGender(values.gender); const shiny=String(values.shiny)==='yes'; const oldName=p.name; const oldLoyalty=Number(p.loyalty||0); const oldGender=currentGender; const oldShiny=currentShiny;\n  p.name=name; p.loyalty=loyalty; p.details.nickname=name; p.details.gender=gender; p.details.isShiny=shiny;\n  trainer().history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Pokémon identity updated',detail:`${oldName} → ${name}; Loyalty ${oldLoyalty} → ${loyalty}; Sex ${oldGender} → ${gender}; Shiny ${oldShiny?'Yes':'No'} → ${shiny?'Yes':'No'}`});\n  if(oldShiny!==shiny)invalidateCreatureReference(); await commit(`${name} updated · Loyalty ${loyalty} · Sex ${gender}${shiny?' · Shiny':''}.`); if(oldShiny!==shiny)setTimeout(()=>loadCreatureReferenceData(true),0);"
    if old in text:
        text = text.replace(old, new, 1); changed = True
    elif new not in text:
        raise RuntimeError(f'Identity Shiny persistence anchor missing in {path}')

    # Stage C generated this identical reset more than once in some runtimes; collapse it now.
    reset_line = "  if(pv.evolved){d.formState={schemaVersion:1,baseFormId:'base',activeFormId:null};d.manualFormApprovals=[];}"
    repeated = re.compile(rf'(?:{re.escape(reset_line)}\n){{2,}}')
    normalized, n = repeated.subn(reset_line + '\n', text)
    if n:
        text = normalized; changed = True

    if changed:
        path.write_text(text, encoding='utf-8')
    print(('Patched' if changed else 'Already patched'), path.relative_to(ROOT))


def patch_package(path: Path, script_name: str) -> None:
    data = json.loads(path.read_text(encoding='utf-8'))
    verify = data['scripts']['verify']
    command = f'node scripts/{script_name}'
    if command not in verify:
        data['scripts']['verify'] = verify + ' && ' + command
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        print('Patched', path.relative_to(ROOT))
    else:
        print('Already patched', path.relative_to(ROOT))


for target in FORM_PATHS:
    patch_forms(target)
for target in API_PATHS:
    patch_api(target)
for target in APP_PATHS:
    patch_app(target)
patch_package(WINDOWS_PACKAGE, 'verify_stage_d_shiny.mjs')
patch_package(ANDROID_PACKAGE, 'verify-stage-d-shiny.mjs')
