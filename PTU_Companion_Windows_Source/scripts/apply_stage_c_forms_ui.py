from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
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


def replace_once(text: str, old: str, new: str, path: Path) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'Expected one anchor in {path}, found {count}: {old[:140]!r}')
    return text.replace(old, new, 1)


def patch_app(path: Path) -> None:
    text = path.read_text(encoding='utf-8')
    changed = False

    if "baseFormId:'base',manualFormApprovals:[]" not in text:
        count = text.count("gmMoves:[],moveLimitModifier:0")
        if count < 3:
            raise RuntimeError(f'Expected at least three Pokémon builder form anchors in {path}, found {count}')
        text = text.replace(
            "gmMoves:[],moveLimitModifier:0",
            "gmMoves:[],moveLimitModifier:0,baseFormId:'base',manualFormApprovals:[]",
        )
        changed = True

    if "formResolution:null,resolvedSpecies:null" not in text:
        count = text.count("preview:null,previewLoading:false,gmMoveQuery:")
        if count < 2:
            raise RuntimeError(f'Expected Pokémon builder state anchors in {path}, found {count}')
        text = text.replace(
            "preview:null,previewLoading:false,gmMoveQuery:",
            "preview:null,previewLoading:false,formResolution:null,resolvedSpecies:null,gmMoveQuery:",
        )
        changed = True

    if "pokemonBuilderState.formResolution=null;" not in text:
        text = replace_once(
            text,
            "  pokemonBuilderState.preview=null;\n  pokemonBuilderState.form={",
            "  pokemonBuilderState.preview=null; pokemonBuilderState.formResolution=null; pokemonBuilderState.resolvedSpecies=null;\n  pokemonBuilderState.form={",
            path,
        )
        changed = True

    if "formState:{baseFormId:f.baseFormId||'base',activeFormId:null}" not in text:
        text = replace_once(
            text,
            "      speciesId:d.id,rulesetId:catalogState.status?.activeRulesetId||null,level:Number(f.level)||1,nature:f.nature,\n      allocations:f.allocations,selectedAbilities:f.selectedAbilities,selectedMoves:f.selectedMoves,gmMoves:f.gmMoves||[],",
            "      speciesId:d.id,rulesetId:catalogState.status?.activeRulesetId||null,level:Number(f.level)||1,nature:f.nature,gender:f.gender,\n      formState:{baseFormId:f.baseFormId||'base',activeFormId:null},manualFormApprovals:f.manualFormApprovals||[],\n      allocations:f.allocations,selectedAbilities:f.selectedAbilities,selectedMoves:f.selectedMoves,gmMoves:f.gmMoves||[],",
            path,
        )
        changed = True

    if "pokemonBuilderState.formResolution=payload.formResolution||null" not in text:
        text = replace_once(
            text,
            "    if(!response.ok) throw new Error(payload.error||'Could not resolve Pokémon build');\n    if(seq!==pokemonBuildPreviewSeq) return;\n    const preview=payload.preview;",
            "    if(!response.ok){ pokemonBuilderState.formResolution=payload.formResolution||null; pokemonBuilderState.resolvedSpecies=payload.formResolution?.species||null; throw new Error((payload.formResolution?.errors||[]).join(' ')||payload.error||'Could not resolve Pokémon build'); }\n    if(seq!==pokemonBuildPreviewSeq) return;\n    const preview=payload.preview; pokemonBuilderState.formResolution=payload.formResolution||null; pokemonBuilderState.resolvedSpecies=payload.formResolution?.species||payload.species||null;",
            path,
        )
        changed = True

    if "'baseFormId','gender'" not in text:
        text = replace_once(
            text,
            "  else if(['nature','moveLimitModifier'].includes(field)) schedulePokemonBuildPreview();",
            "  else if(['nature','moveLimitModifier','baseFormId','gender'].includes(field)) schedulePokemonBuildPreview();",
            path,
        )
        changed = True

    helper_marker = "function pokemonFormRequirementText(node)"
    if helper_marker not in text:
        helper = r'''
function pokemonFormRequirementText(node){
  if(!node)return 'No additional requirements.';
  if(Array.isArray(node.all))return node.all.map(pokemonFormRequirementText).filter(Boolean).join(' AND ');
  if(Array.isArray(node.any))return `One of: ${node.any.map(pokemonFormRequirementText).filter(Boolean).join(' OR ')}`;
  if(node.not)return `Not: ${pokemonFormRequirementText(node.not)}`;
  const value=node.value;
  const label=typeof value==='object'?(value?.label||value?.name||value?.id||value?.key||JSON.stringify(value)):value;
  return ({
    min_level:`Level ${Number(value)}+`,max_level:`Level ${Number(value)} or lower`,gender:`Gender: ${label}`,
    held_item:`Held Item: ${label}`,ability:`Ability: ${label}`,capability:`Capability: ${label}`,
    tag:`Tag: ${label}`,flag:`State flag: ${label}`,manual:`Manual confirmation: ${label}`,never:'Unavailable'
  })[String(node.kind||'').toLowerCase()]||`Requirement: ${label??node.kind??'custom condition'}`;
}
function pokemonFormApprovalKey(value){
  const raw=typeof value==='object'?(value?.id||value?.key||JSON.stringify(value)):value;
  return String(raw||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
function pokemonFormManualRequirements(node,out=[]){
  if(!node)return out;
  if(Array.isArray(node.all))node.all.forEach(child=>pokemonFormManualRequirements(child,out));
  else if(Array.isArray(node.any))node.any.forEach(child=>pokemonFormManualRequirements(child,out));
  else if(node.not)pokemonFormManualRequirements(node.not,out);
  else if(String(node.kind||'').toLowerCase()==='manual'){
    const value=node.value; const key=pokemonFormApprovalKey(value);
    if(key&&!out.some(x=>x.key===key))out.push({key,label:typeof value==='object'?(value?.label||value?.id||value?.key||'Manual condition'):String(value||'Manual condition')});
  }
  return out;
}
function setPokemonBuilderBaseForm(formId){
  pokemonBuilderState.form.baseFormId=formId||'base';
  pokemonBuilderState.form.manualFormApprovals=[];
  pokemonBuilderState.formResolution=null; pokemonBuilderState.resolvedSpecies=null;
  render(); refreshPokemonBuildPreview({autoMoves:!pokemonBuilderState.movesTouched});
}
function togglePokemonBuilderFormManualApproval(key,checked){
  const approvals=new Set(pokemonBuilderState.form.manualFormApprovals||[]);
  if(checked)approvals.add(String(key));else approvals.delete(String(key));
  pokemonBuilderState.form.manualFormApprovals=[...approvals];
  refreshPokemonBuildPreview({autoMoves:!pokemonBuilderState.movesTouched});
}
'''
        text = replace_once(text, "function pokemonBuilderScreen(){", helper + "\nfunction pokemonBuilderScreen(){", path)
        changed = True

    if "const formBuilderBlock=" not in text:
        insert = r'''  const formDefs=Array.isArray(selected?.forms)?selected.forms:[];
  const permanentForms=formDefs.filter(form=>form.mode==='permanent');
  const selectedPermanent=permanentForms.find(form=>form.id===(f.baseFormId||'base'))||null;
  const formRequirements=selectedPermanent?pokemonFormRequirementText(selectedPermanent.requirements):'Canonical Species form; no additional requirements.';
  const manualRequirements=selectedPermanent?pokemonFormManualRequirements(selectedPermanent.requirements,[]):[];
  const approvals=new Set(f.manualFormApprovals||[]);
  const formResolution=pokemonBuilderState.formResolution;
  const formMessages=[...(formResolution?.errors||[]),...(formResolution?.warnings||[])];
  const formBuilderBlock=permanentForms.length?`<div class="builder-rule-note"><div class="row-between"><div><strong>Pokémon Form</strong><small>Choose the permanent/base Form used by the rules preview and saved creature.</small></div>${f.baseFormId&&f.baseFormId!=='base'?chip('PERMANENT FORM','chip-purple'):chip('CANONICAL BASE','chip-blue')}</div><label>Permanent / Base Form<select onchange="setPokemonBuilderBaseForm(this.value)"><option value="base" ${(f.baseFormId||'base')==='base'?'selected':''}>Canonical Base</option>${permanentForms.map(form=>`<option value="${esc(form.id)}" ${f.baseFormId===form.id?'selected':''}>${esc(form.name)}</option>`).join('')}</select></label><p class="muted"><strong>Requirements:</strong> ${esc(formRequirements)}</p>${selectedPermanent?.notes?`<p class="muted">${esc(selectedPermanent.notes)}</p>`:''}${manualRequirements.length?`<div class="form-grid">${manualRequirements.map(req=>`<label><input type="checkbox" ${approvals.has(req.key)?'checked':''} onchange="togglePokemonBuilderFormManualApproval('${esc(req.key)}',this.checked)"/> Confirm: ${esc(req.label)}</label>`).join('')}</div>`:''}${formMessages.length?`<div class="builder-validation ${formResolution?.valid?'ok':'bad'}"><ul>${formMessages.map(message=>`<li>${esc(message)}</li>`).join('')}</ul></div>`:''}</div>`:'';
'''
        text = replace_once(text, "  const statRows=pv?", insert + "  const statRows=pv?", path)
        changed = True

    if "${formBuilderBlock}${evolutionWarning}" not in text:
        old = "</select></label></div>${evolutionWarning}`:'<div class=\"definition-detail-empty\""
        new = "</select></label></div>${formBuilderBlock}${evolutionWarning}`:'<div class=\"definition-detail-empty\""
        text = replace_once(text, old, new, path)
        changed = True

    if "const resolvedDefinition=pokemonBuilderState.resolvedSpecies||d" not in text:
        text = replace_once(
            text,
            "  const id=uid('pokemon'); const name=(String(f.nickname||'').trim()||d.name); const types=(d.types||[]).map(t=>String(t).toLowerCase());",
            "  const id=uid('pokemon'); const resolvedDefinition=pokemonBuilderState.resolvedSpecies||d; const name=(String(f.nickname||'').trim()||resolvedDefinition.name||d.name); const types=(resolvedDefinition.types||d.types||[]).map(t=>String(t).toLowerCase());",
            path,
        )
        text = replace_once(text, "  const p={id,name,species:d.name,level,types,", "  const p={id,name,species:resolvedDefinition.name||d.name,level,types,", path)
        text = replace_once(
            text,
            "    speciesDefinitionId:d.id,speciesVersionId:d.versionId,speciesContentPackId:d.contentPackId,linkedRulesetId,",
            "    speciesDefinitionId:d.id,speciesVersionId:d.versionId,speciesContentPackId:d.contentPackId,linkedRulesetId,\n    formState:{schemaVersion:1,baseFormId:f.baseFormId||'base',activeFormId:null},manualFormApprovals:[...(f.manualFormApprovals||[])],",
            path,
        )
        changed = True

    forms_ui_marker = "async function openPokemonFormsManager()"
    if forms_ui_marker not in text:
        forms_ui = r'''
function pokemonFormCurrentState(p){
  const raw=p?.details?.formState||{};
  return {baseFormId:raw.baseFormId||'base',activeFormId:raw.activeFormId||null};
}
function pokemonFormOptionCard(form,{current=false,action='',actionLabel='Apply',tone='btn-primary'}={}){
  const requirements=pokemonFormRequirementText(form?.requirements);
  return `<article class="ability-card"><div class="row-between"><div><h3>${esc(form?.name||'Canonical Base')}</h3>${form?.mode?chip(form.mode==='permanent'?'PERMANENT':'TRANSFORMATION',form.mode==='permanent'?'chip-purple':'chip-gold'):chip('CANONICAL BASE','chip-blue')}${current?chip('CURRENT','chip-green'):''}</div></div><p><strong>Requirements:</strong> ${esc(requirements)}</p>${form?.notes?`<p class="muted">${esc(form.notes)}</p>`:''}${action?`<button class="btn ${tone} btn-small" onclick="${action}">${esc(actionLabel)}</button>`:''}</article>`;
}
async function openPokemonFormsManager(){
  const p=pokemon(); if(!p?.details?.speciesDefinitionId)return toast('This Pokémon is not linked to a Species definition.','error');
  if(creatureReferenceState.pokemonId!==p.id||!creatureReferenceState.data)await loadCreatureReferenceData(true);
  const data=creatureReferenceState.pokemonId===p.id?creatureReferenceState.data:null;
  if(!data)return toast(creatureReferenceState.error||'Could not resolve Pokémon Forms.','error');
  const forms=Array.isArray(data.species?.forms)?data.species.forms:[];
  if(!forms.length)return toast('This Species has no alternate Forms in the active Ruleset.','error');
  const stateForm=pokemonFormCurrentState(p); const permanent=forms.filter(form=>form.mode==='permanent'); const transformations=forms.filter(form=>form.mode==='transformation');
  const permanentCards=[pokemonFormOptionCard(null,{current:stateForm.baseFormId==='base',action:stateForm.baseFormId==='base'?'':"setPokemonPermanentForm('base')",actionLabel:'Use Canonical Base'})].concat(permanent.map(form=>pokemonFormOptionCard(form,{current:stateForm.baseFormId===form.id,action:stateForm.baseFormId===form.id?'':`setPokemonPermanentForm('${esc(form.id)}')`,actionLabel:'Use as Permanent Form'}))).join('');
  const transformationCards=transformations.map(form=>pokemonFormOptionCard(form,{current:stateForm.activeFormId===form.id,action:`togglePokemonTransformation('${esc(form.id)}')`,actionLabel:stateForm.activeFormId===form.id?'Deactivate Transformation':'Activate Transformation',tone:stateForm.activeFormId===form.id?'btn-ghost':'btn-gold'})).join('')||'<p class="muted">No temporary transformation Forms are defined.</p>';
  const applied=data.formResolution?.applied||[]; const warnings=data.formResolution?.warnings||[];
  modal(`<div class="flow-note"><strong>Current resolution:</strong> ${applied.length?applied.map(form=>esc(form.name)).join(' → '):'Canonical Base'}.</div>${warnings.length?`<div class="builder-validation bad"><strong>Form warnings</strong><ul>${warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:''}<h3>Permanent / Base Form</h3><div class="ability-card-grid">${permanentCards}</div><h3>Temporary Transformation</h3><div class="ability-card-grid">${transformationCards}</div><div class="flow-note"><strong>Persistence:</strong> the permanent Form and active transformation are stored on this individual Pokémon. Transformation state can be cleared without changing the permanent Form.</div>`,{title:`Pokémon Forms · ${p.name}`,subtitle:'Resolved from the active Campaign Ruleset'});
}
async function applyPokemonFormState(nextState,form=null){
  const p=pokemon(); if(!p)return;
  const approvals=new Set(p.details?.manualFormApprovals||[]); const manual=pokemonFormManualRequirements(form?.requirements,[]); const missing=manual.filter(req=>!approvals.has(req.key));
  if(missing.length){
    const ok=await styledConfirm({title:'Confirm Form Requirement',message:`<p>This Form has manual condition${missing.length===1?'':'s'}:</p><ul>${missing.map(req=>`<li>${esc(req.label)}</li>`).join('')}</ul><p>Confirm that the condition is currently satisfied.</p>`,confirmLabel:'Confirm & Apply',tone:'gold'});
    if(!ok){openPokemonFormsManager();return;}
    missing.forEach(req=>approvals.add(req.key));
  }
  try{
    const response=await fetch('/api/pokemon/forms/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:p,formState:nextState,manualFormApprovals:[...approvals],gmOverride:!!state.ui.gmOverride,rulesetId:catalogState.status?.activeRulesetId})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.valid){
      const errors=payload.errors||payload.formResolution?.errors||[payload.error||'This Form cannot be applied.'];
      modal(`<div class="builder-validation bad"><strong>Form requirements are not satisfied.</strong><ul>${errors.map(error=>`<li>${esc(error)}</li>`).join('')}</ul></div><div class="flow-note"><strong>GM Override:</strong> ${state.ui.gmOverride?'enabled — unmet requirements may be accepted with an explicit warning.':'disabled — enable it only if the GM intends to bypass the requirement.'}</div>`,{title:'Pokémon Form not applied',tone:'red'}); return;
    }
    p.details ||= {}; p.details.formState={...payload.formState}; p.details.manualFormApprovals=[...approvals];
    if(Array.isArray(payload.species?.types))p.types=payload.species.types.map(type=>String(type).toLowerCase());
    if(payload.species?.name)p.species=payload.species.name;
    closeModal(); invalidateCreatureReference(); await commit(`${p.name} Form updated.`); await loadCreatureReferenceData(true);
  }catch(error){toast(error.message,'error');}
}
async function setPokemonPermanentForm(formId){
  const p=pokemon(); if(!p)return; const data=creatureReferenceState.pokemonId===p.id?creatureReferenceState.data:null;
  const form=formId==='base'?null:(data?.species?.forms||[]).find(x=>x.id===formId&&x.mode==='permanent');
  if(formId!=='base'&&!form)return toast('Permanent Form is not available in the active Ruleset.','error');
  const current=pokemonFormCurrentState(p); await applyPokemonFormState({baseFormId:formId||'base',activeFormId:current.activeFormId},form);
}
async function togglePokemonTransformation(formId){
  const p=pokemon(); if(!p)return; const data=creatureReferenceState.pokemonId===p.id?creatureReferenceState.data:null; const current=pokemonFormCurrentState(p);
  if(current.activeFormId===formId)return applyPokemonFormState({baseFormId:current.baseFormId,activeFormId:null},null);
  const form=(data?.species?.forms||[]).find(x=>x.id===formId&&x.mode==='transformation');
  if(!form)return toast('Transformation Form is not available in the active Ruleset.','error');
  await applyPokemonFormState({baseFormId:current.baseFormId,activeFormId:formId},form);
}
function pokemonFormSummaryBlock(p,data){
  const forms=Array.isArray(data?.species?.forms)?data.species.forms:[]; if(!forms.length)return '';
  const current=pokemonFormCurrentState(p); const base=forms.find(form=>form.id===current.baseFormId); const active=forms.find(form=>form.id===current.activeFormId); const warnings=data?.formResolution?.warnings||[];
  const resolvedTypes=(data?.species?.types||p.types||[]).map(type=>typeBadge(String(type).toLowerCase())).join(' ');
  return section('POKÉMON FORM',`<dl class="detail-dl"><div><dt>Permanent Form</dt><dd>${esc(base?.name||'Canonical Base')}</dd></div><div><dt>Active Transformation</dt><dd>${esc(active?.name||'None')}</dd></div><div><dt>Resolved Types</dt><dd>${resolvedTypes||'—'}</dd></div></dl>${warnings.length?`<div class="builder-validation bad"><ul>${warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:'<p class="muted">Types, Base Stats, Ability pool, Capabilities and natural Move data are resolved from this Form state.</p>'}`,`<button class="btn btn-gold btn-small" onclick="openPokemonFormsManager()">Manage Forms</button>`);
}
'''
        text = replace_once(text, "function creatureScreen(){", forms_ui + "\nfunction creatureScreen(){", path)
        changed = True

    if "const resolvedSpecies=data?.species||null" not in text:
        marker = "const effectiveFs=data?.resolvedCreature?.stats?.effective||fs;"
        text = replace_once(
            text,
            marker,
            marker + " const resolvedSpecies=data?.species||null; const resolvedTypes=(resolvedSpecies?.types||p.types||[]).map(type=>String(type).toLowerCase()); const resolvedSpeciesName=resolvedSpecies?.name||p.species;",
            path,
        )
        changed = True

    if "const abilities=(data?.abilities?.map(a=>a.name)" not in text:
        text = replace_once(
            text,
            "  const abilities=(d.abilities||[]).filter(Boolean);",
            "  const abilities=(data?.abilities?.map(a=>a.name)||(d.abilities||[])).filter(Boolean);",
            path,
        )
        changed = True

    if "const formSummaryBlock=pokemonFormSummaryBlock" not in text:
        text = replace_once(
            text,
            "  const sheet=`<div class=\"creature-detail-grid\">",
            "  const formSummaryBlock=pokemonFormSummaryBlock(p,data);\n  const sheet=`<div class=\"creature-detail-grid\">",
            path,
        )
        text = replace_once(
            text,
            "${section('PTU COMBAT STATS',statBlock)}",
            "${formSummaryBlock}${section('PTU COMBAT STATS',statBlock)}",
            path,
        )
        changed = True

    if "${esc(resolvedSpeciesName)} · Lv. ${p.level}" not in text:
        pos = text.index("function creatureScreen(){")
        before, after = text[:pos], text[pos:]
        old = "<p>${esc(p.species)} · Lv. ${p.level}</p><div>${p.types.map(typeBadge).join(' ')}</div>"
        new = "<p>${esc(resolvedSpeciesName)} · Lv. ${p.level}</p><div>${resolvedTypes.map(typeBadge).join(' ')}</div>"
        after = replace_once(after, old, new, path)
        text = before + after
        changed = True

    if "setPokemonBuilderBaseForm,togglePokemonBuilderFormManualApproval" not in text:
        text = replace_once(
            text,
            "beginPokemonBuilder,setPokemonBuilderQuery,refreshPokemonBuilderSpecies,selectPokemonBuilderSpecies,setPokemonBuilderField,",
            "beginPokemonBuilder,setPokemonBuilderQuery,refreshPokemonBuilderSpecies,selectPokemonBuilderSpecies,setPokemonBuilderField,setPokemonBuilderBaseForm,togglePokemonBuilderFormManualApproval,",
            path,
        )
        changed = True

    if "openPokemonFormsManager,setPokemonPermanentForm,togglePokemonTransformation" not in text:
        text = replace_once(
            text,
            "Object.assign(window,{openMoveKeywordInfo,route,",
            "Object.assign(window,{openMoveKeywordInfo,openPokemonFormsManager,setPokemonPermanentForm,togglePokemonTransformation,route,",
            path,
        )
        changed = True

    if changed:
        path.write_text(text, encoding='utf-8')
    print(('Patched' if changed else 'Already patched'), path.relative_to(ROOT))


def patch_api(path: Path) -> None:
    text = path.read_text(encoding='utf-8')
    changed = False
    if "formResolution:buildFormResolution" not in text:
        old = "return json(res,200,{rulesetId,species:{id:species.id,name:species.name,types:species.types||[],versionId:species.versionId,contentPackId:species.contentPackId,sourceId:species.sourceId},experience:definitions.getPokemonExperience(preview.level),preview});"
        new = "return json(res,200,{rulesetId,species:{id:species.id,name:species.name,types:species.types||[],versionId:species.versionId,contentPackId:species.contentPackId,sourceId:species.sourceId},formResolution:buildFormResolution,experience:definitions.getPokemonExperience(preview.level),preview});"
        text = replace_once(text, old, new, path)
        changed = True
    if "formResolution:referenceFormResolution" not in text:
        old = "return json(res,200,{rulesetId,species,moves,abilities,abilitySlots,abilitySlotStatus,resolvedCreature:resolvedCreatureModel({pokemon,species,rulesetId,heldItemEffect:held.effect,heldItemDefinition:held.definition}),modifierSummary:getPokemonModifierSummary(resolvedPokemonForCombat,{heldItemEffect:held.effect}),heldItem:{definition:held.definition,effect:held.effect},typeProfile,incomingEvolution:incoming||null,outgoingEvolutions:outgoing});"
        new = "return json(res,200,{rulesetId,species,formResolution:referenceFormResolution,moves,abilities,abilitySlots,abilitySlotStatus,resolvedCreature:resolvedCreatureModel({pokemon,species,rulesetId,heldItemEffect:held.effect,heldItemDefinition:held.definition}),modifierSummary:getPokemonModifierSummary(resolvedPokemonForCombat,{heldItemEffect:held.effect}),heldItem:{definition:held.definition,effect:held.effect},typeProfile,incomingEvolution:incoming||null,outgoingEvolutions:outgoing});"
        text = replace_once(text, old, new, path)
        changed = True
    if changed:
        path.write_text(text, encoding='utf-8')
    print(('Patched' if changed else 'Already patched'), path.relative_to(ROOT))


def patch_package(path: Path, command: str) -> None:
    data = json.loads(path.read_text(encoding='utf-8'))
    verify = data.get('scripts', {}).get('verify')
    if not verify:
        raise RuntimeError(f'Missing scripts.verify in {path}')
    if command not in verify:
        data['scripts']['verify'] = verify + ' && ' + command
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        print('Updated', path.relative_to(ROOT))
    else:
        print('Already patched', path.relative_to(ROOT))


for app in APP_PATHS:
    patch_app(app)
for api in API_PATHS:
    patch_api(api)
patch_package(WINDOWS_PACKAGE, 'node scripts/verify_stage_c_forms_ui.mjs')
patch_package(ANDROID_PACKAGE, 'node scripts/verify-stage-c-forms-ui.mjs')
