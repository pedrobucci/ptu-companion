#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
WINDOWS_FORMS = ROOT / 'rules' / 'pokemon-forms.mjs'
ANDROID_FORMS = REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'rules' / 'pokemon-forms.mjs'
WINDOWS_SERVER = ROOT / 'server.mjs'
ANDROID_API = REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'mobile-api.mjs'

REQUIREMENT_MAP_OLD = "  const map={min_level:'min_level',minLevel:'min_level',max_level:'max_level',maxLevel:'max_level',gender:'gender',held_item:'held_item',heldItem:'held_item',ability:'ability',capability:'capability',tag:'tag',flag:'flag',manual:'manual'};"
REQUIREMENT_MAP_NEW = """  const map={
    min_level:'min_level',minLevel:'min_level',max_level:'max_level',maxLevel:'max_level',gender:'gender',
    held_item:'held_item',heldItem:'held_item',ability:'ability',capability:'capability',tag:'tag',flag:'flag',
    hp_fraction_lte:'hp_fraction_lte',hpFractionLte:'hp_fraction_lte',hp_fraction_lt:'hp_fraction_lt',hpFractionLt:'hp_fraction_lt',
    hp_fraction_gte:'hp_fraction_gte',hpFractionGte:'hp_fraction_gte',hp_fraction_gt:'hp_fraction_gt',hpFractionGt:'hp_fraction_gt',
    temp_hp_lte:'temp_hp_lte',tempHpLte:'temp_hp_lte',temp_hp_gt:'temp_hp_gt',tempHpGt:'temp_hp_gt',
    temp_hp_source_lte:'temp_hp_source_lte',tempHpSourceLte:'temp_hp_source_lte',temp_hp_source_gt:'temp_hp_source_gt',tempHpSourceGt:'temp_hp_source_gt',
    known_move:'known_move',knownMove:'known_move',in_combat:'in_combat',inCombat:'in_combat',
    trigger_item:'trigger_item',triggerItem:'trigger_item',manual:'manual'
  };"""

FORM_NORMALIZATION_OLD = """    requirements:normalizeRequirementNode(raw.requirements||raw.requirement||null),
    overrides:normalizedOverrides,"""
FORM_NORMALIZATION_NEW = """    requirements:normalizeRequirementNode(raw.requirements||raw.requirement||null),
    activationRequirements:normalizeRequirementNode(raw.activationRequirements||raw.activation_requirements||null),
    persistenceRequirements:normalizeRequirementNode(raw.persistenceRequirements||raw.persistence_requirements||null),
    compatibleBaseForms:uniqueArray((raw.compatibleBaseForms||raw.compatible_base_forms||[]).map(slug).filter(Boolean)),
    overrides:normalizedOverrides,"""

EVALUATORS = r"""function listContextValues(value){
  const values=(Array.isArray(value)?value:[value]).flatMap(entry=>Array.isArray(entry)?entry:[entry]);
  return values.filter(v=>v!=null).map(v=>slug(typeof v==='object'?(v.id||v.logical_id||v.move_id||v.move||v.name||v.capability_id||v.ability):v)).filter(Boolean);
}
function finiteNumber(value){const number=Number(value);return Number.isFinite(number)?number:null;}
function hpFraction(context){
  const current=finiteNumber(context?.currentHp); const maximum=finiteNumber(context?.maxHp);
  if(current==null||maximum==null||maximum<=0)return null;
  return current/maximum;
}
function resolvedValues(context,key,rawKey){
  const direct=context?.[key]||[];
  const resolved=context?.resolvedSpecies?.[key]||context?.resolvedSpecies?.raw?.[rawKey]||[];
  return listContextValues([direct,resolved]);
}
function tempHpForSource(context,source){
  const bySource=context?.tempHpBySource;
  if(!bySource||typeof bySource!=='object'||Array.isArray(bySource))return null;
  const wanted=slug(source);
  for(const [key,value] of Object.entries(bySource)) if(slug(key)===wanted) return finiteNumber(value);
  return null;
}
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
  if(kind==='trigger_item'){
    const trigger=listContextValues([context?.triggerItemId,context?.triggerItemName,context?.triggerItem]);
    return {met:trigger.includes(slug(expected)),label:`Requires transformation trigger item ${typeof expected==='object'?(expected.name||expected.id):expected}.`};
  }
  if(kind==='ability')return {met:resolvedValues(context,'abilities','ability_slots').includes(slug(expected)),label:`Requires Ability ${expected}.`};
  if(kind==='capability')return {met:resolvedValues(context,'capabilities','capabilities').includes(slug(expected)),label:`Requires Capability ${expected}.`};
  if(kind==='known_move')return {met:listContextValues(context?.knownMoves).includes(slug(expected)),label:`Requires known Move ${expected}.`};
  if(kind==='tag')return {met:listContextValues(context?.tags).includes(slug(expected)),label:`Requires tag ${expected}.`};
  if(kind==='flag'){
    const flags=context?.flags&&typeof context.flags==='object'?context.flags:{};
    return {met:!!flags[String(expected)],label:`Requires state flag ${expected}.`};
  }
  if(kind==='in_combat'){
    const wanted=expected==null?true:!!expected;
    return {met:!!context?.inCombat===wanted,label:`Requires ${wanted?'combat':'out-of-combat'} state.`};
  }
  if(['hp_fraction_lte','hp_fraction_lt','hp_fraction_gte','hp_fraction_gt'].includes(kind)){
    const actual=hpFraction(context); const threshold=Number(expected);
    const valid=actual!=null&&Number.isFinite(threshold);
    let met=false;
    if(valid&&kind==='hp_fraction_lte')met=actual<=threshold;
    if(valid&&kind==='hp_fraction_lt')met=actual<threshold;
    if(valid&&kind==='hp_fraction_gte')met=actual>=threshold;
    if(valid&&kind==='hp_fraction_gt')met=actual>threshold;
    const op={hp_fraction_lte:'at most',hp_fraction_lt:'below',hp_fraction_gte:'at least',hp_fraction_gt:'above'}[kind];
    return {met,label:`Requires current HP to be ${op} ${Math.round(threshold*100)}% of maximum HP.`};
  }
  if(kind==='temp_hp_lte'||kind==='temp_hp_gt'){
    const actual=finiteNumber(context?.tempHp); const threshold=Number(expected);
    const met=actual!=null&&Number.isFinite(threshold)&&(kind==='temp_hp_lte'?actual<=threshold:actual>threshold);
    return {met,label:`Requires Temporary HP to be ${kind==='temp_hp_lte'?'at most':'above'} ${threshold}.`};
  }
  if(kind==='temp_hp_source_lte'||kind==='temp_hp_source_gt'){
    const source=typeof expected==='object'?(expected.source||expected.id||expected.name):expected;
    const threshold=Number(typeof expected==='object'?(expected.amount??expected.value??0):0);
    const actual=tempHpForSource(context,source);
    const met=actual!=null&&Number.isFinite(threshold)&&(kind==='temp_hp_source_lte'?actual<=threshold:actual>threshold);
    const qualifier=actual==null?'tracked ':'';
    return {met,label:`Requires ${qualifier}Temporary HP from ${source} to be ${kind==='temp_hp_source_lte'?'at most':'above'} ${threshold}.`};
  }
  if(kind==='manual'){
    const key=slug(typeof expected==='object'?(expected.id||expected.key||JSON.stringify(expected)):expected);
    return {met:listContextValues(context?.manualApprovals).includes(key),label:`Requires manual condition ${typeof expected==='object'?(expected.label||expected.id||expected.key||'confirmation'):expected}.`};
  }
  return {met:false,label:`Unsupported Form requirement: ${kind}.`};
}
"""

ACTIVE_BLOCK = r"""  if(state.activeFormId){
    const form=find(state.activeFormId);
    if(!form)errors.push(`Unknown active Form: ${state.activeFormId}.`);
    else if(form.mode!=='transformation')errors.push(`${form.name} is a permanent Form and cannot be used as the active transformation.`);
    else {
      const activeContext={...context,baseFormId:state.baseFormId,resolvedSpecies:resolved};
      const checks=[evaluateFormRequirements(form.requirements,activeContext)];
      if(form.compatibleBaseForms.length&&!form.compatibleBaseForms.includes(state.baseFormId)){
        checks.push({eligible:false,unmet:[`${form.name} is not compatible with base Form ${state.baseFormId}.`]});
      }
      const wasAlreadyActive=slug(context?.previousActiveFormId)===form.id;
      const phaseRequirements=wasAlreadyActive?form.persistenceRequirements:form.activationRequirements;
      if(phaseRequirements)checks.push(evaluateFormRequirements(phaseRequirements,activeContext));
      const check={
        eligible:checks.every(result=>result.eligible),
        unmet:checks.flatMap(result=>result.unmet),
        phase:wasAlreadyActive?'persistence':'activation'
      };
      if(!check.eligible&&!allowUnmet)errors.push(...check.unmet);
      else {
        if(!check.eligible)warnings.push(...check.unmet.map(message=>`GM Override: ${message}`));
        resolved=applySpeciesFormOverrides(resolved,form.overrides); applied.push({id:form.id,name:form.name,mode:form.mode,requirements:check});
      }
    }
  }
"""

FORM_CONTEXT = r"""function pokemonFormContext({pokemon={},payload={}}={}){
  const details=pokemon?.details||{};
  const previousFormState=normalizePokemonFormState(details.formState||{});
  const knownMoves=payload.knownMoves??payload.selectedMoves??details.moves??pokemon.moves??[];
  const tempHpBySource=payload.tempHpBySource??details.formTempHpBySource??details.tempHpBySource??{};
  return {
    level:Number(payload.level??pokemon.level??1),gender:payload.gender??details.gender??pokemon.gender??null,
    heldItemId:details.heldItemDefinitionId||null,heldItemName:pokemon.heldItem||null,heldItem:pokemon.heldItem||null,
    triggerItemId:payload.formTriggerItemId??payload.triggerItemId??null,
    triggerItemName:payload.formTriggerItemName??payload.triggerItemName??null,
    triggerItem:payload.formTriggerItem??payload.triggerItem??null,
    currentHp:payload.currentHp??pokemon.hp??details.currentHp??null,
    maxHp:payload.maxHp??pokemon.maxHp??details.maxHp??null,
    tempHp:payload.tempHp??pokemon.tempHp??details.tempHp??0,
    tempHpBySource,
    inCombat:!!(payload.inCombat??details.inCombat??pokemon.inCombat??false),
    knownMoves,
    abilities:payload.selectedAbilities??details.abilities??[],capabilities:details.capabilities||[],tags:details.formTags||[],flags:details.formFlags||{},
    previousBaseFormId:previousFormState.baseFormId,previousActiveFormId:previousFormState.activeFormId,
    manualApprovals:payload.manualFormApprovals||details.manualFormApprovals||[]
  };
}
"""


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one replacement target, found {count}')
    return text.replace(old, new, 1)


def patch_forms(path: Path) -> None:
    text = path.read_text(encoding='utf-8')
    if 'hp_fraction_lte' in text and 'activationRequirements:' in text and 'compatibleBaseForms:' in text:
        return
    text = replace_once(text, REQUIREMENT_MAP_OLD, REQUIREMENT_MAP_NEW, f'{path}: requirement map')
    text = replace_once(text, FORM_NORMALIZATION_OLD, FORM_NORMALIZATION_NEW, f'{path}: form normalization')
    start = text.index('function listContextValues')
    end = text.index('\n\nexport function evaluateFormRequirements', start)
    text = text[:start] + EVALUATORS.rstrip() + text[end:]
    start = text.index('  if(state.activeFormId){')
    end = text.index('\n\n  resolved.forms=forms;', start)
    text = text[:start] + ACTIVE_BLOCK.rstrip() + text[end:]
    path.write_text(text, encoding='utf-8')


def patch_context(path: Path) -> None:
    text = path.read_text(encoding='utf-8')
    if 'previousActiveFormId:previousFormState.activeFormId' in text:
        return
    start = text.index('function pokemonFormContext')
    end = text.index('function resolveSpeciesFormState', start)
    text = text[:start] + FORM_CONTEXT + text[end:]
    path.write_text(text, encoding='utf-8')


def main() -> None:
    if WINDOWS_FORMS.read_bytes() != ANDROID_FORMS.read_bytes():
        raise SystemExit('Windows and Android pokemon-forms.mjs must be byte-identical before requirement-v2 patching')
    for path in (WINDOWS_FORMS, ANDROID_FORMS):
        patch_forms(path)
    if WINDOWS_FORMS.read_bytes() != ANDROID_FORMS.read_bytes():
        raise SystemExit('Windows and Android pokemon-forms.mjs drifted after requirement-v2 patching')
    for path in (WINDOWS_SERVER, ANDROID_API):
        patch_context(path)
    for path in (WINDOWS_FORMS, ANDROID_FORMS):
        text = path.read_text(encoding='utf-8')
        for marker in ('hp_fraction_lte', 'temp_hp_source_lte', 'known_move', 'trigger_item', 'activationRequirements', 'persistenceRequirements', 'compatibleBaseForms'):
            if marker not in text:
                raise SystemExit(f'{path}: missing requirement-v2 marker {marker}')
    print('Stage B Form requirement model v2 patch applied.')


if __name__ == '__main__':
    main()
