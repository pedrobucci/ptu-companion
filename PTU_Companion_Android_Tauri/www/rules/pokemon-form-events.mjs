import {normalizeSpeciesForms,normalizePokemonFormState,resolvePokemonForms,evaluateFormRequirements} from './pokemon-forms.mjs';

const deepClone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const slug=value=>String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const finite=value=>{if(value==null||value==='')return null;const number=Number(value);return Number.isFinite(number)?number:null;};

export const FORM_EVENT_SCHEMA_VERSION=1;
export const FORM_LIFECYCLE_MODEL_VERSION=1;

export function normalizePokemonFormEvent(input={}){
  const raw=input&&typeof input==='object'?deepClone(input):{};
  const kind=slug(raw.kind||raw.type||raw.event||raw.name||'form-state-check');
  const tags=[...(Array.isArray(raw.tags)?raw.tags:[]),...(Array.isArray(raw.rangeTags)?raw.rangeTags:[]),...(Array.isArray(raw.keywords)?raw.keywords:[])].map(slug).filter(Boolean);
  return {
    ...raw,
    kind,
    move:raw.move??raw.moveName??raw.move_name??null,
    ability:raw.ability??raw.abilityName??raw.ability_name??null,
    capability:raw.capability??raw.capabilityName??raw.capability_name??null,
    actionId:raw.actionId??raw.action_id??null,
    weather:raw.weather??null,
    triggerItemId:raw.triggerItemId??raw.trigger_item_id??null,
    triggerItemName:raw.triggerItemName??raw.trigger_item_name??null,
    triggerItem:raw.triggerItem??raw.trigger_item??null,
    targetFormMaxHp:raw.targetFormMaxHp??raw.target_form_max_hp??null,
    moveClass:raw.moveClass??raw.move_class??raw.class??null,
    damaging:raw.damaging==null?null:!!raw.damaging,
    raisesDefenseCombatStages:raw.raisesDefenseCombatStages==null?(raw.raises_defense_combat_stages==null?null:!!raw.raises_defense_combat_stages):!!raw.raisesDefenseCombatStages,
    tags,
  };
}

function scalarMatch(actual,expected){
  if(Array.isArray(expected))return expected.some(value=>scalarMatch(actual,value));
  if(typeof expected==='boolean')return !!actual===expected;
  if(expected==null)return actual==null;
  return slug(actual)===slug(expected);
}
function eventTags(event){return new Set((event.tags||[]).map(slug));}
function matchWhen(when,event,state){
  if(!when)return true;
  if(Array.isArray(when))return when.every(node=>matchWhen(node,event,state));
  if(typeof when!=='object')return false;
  if(Array.isArray(when.all)&&!when.all.every(node=>matchWhen(node,event,state)))return false;
  if(Array.isArray(when.any)&&!when.any.some(node=>matchWhen(node,event,state)))return false;
  if(when.not&&matchWhen(when.not,event,state))return false;
  const tags=eventTags(event);
  for(const [key,expected] of Object.entries(when)){
    if(['all','any','not'].includes(key))continue;
    if(key==='move'&&!scalarMatch(event.move,expected))return false;
    if(key==='ability'&&!scalarMatch(event.ability,expected))return false;
    if(key==='capability'&&!scalarMatch(event.capability,expected))return false;
    if((key==='action_id'||key==='actionId')&&!scalarMatch(event.actionId,expected))return false;
    if(key==='weather'&&!scalarMatch(event.weather,expected))return false;
    if((key==='trigger_item'||key==='triggerItem')&&!scalarMatch(event.triggerItemName??event.triggerItemId??event.triggerItem,expected))return false;
    if((key==='move_class'||key==='moveClass')&&!scalarMatch(event.moveClass,expected))return false;
    if(key==='damaging'&&event.damaging!==!!expected)return false;
    if((key==='raises_defense_combat_stages'||key==='raisesDefenseCombatStages')&&event.raisesDefenseCombatStages!==!!expected)return false;
    if((key==='base_form_id'||key==='baseFormId')&&!scalarMatch(state.baseFormId,expected))return false;
    if((key==='active_form_id'||key==='activeFormId')&&!scalarMatch(state.activeFormId,expected))return false;
    if((key==='tag'||key==='has_tag')&&!tags.has(slug(expected)))return false;
    if((key==='tags_any'||key==='tagsAny')){
      const wanted=(Array.isArray(expected)?expected:[expected]).map(slug);
      if(!wanted.some(value=>tags.has(value)))return false;
    }
  }
  return true;
}

function lifecycleFor(form){
  const raw=form?.raw||{};
  const value=raw.lifecycle||raw.form_lifecycle||raw.transition_lifecycle||null;
  return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
}
function lifecycleRules(form){
  const lifecycle=lifecycleFor(form);
  return Array.isArray(lifecycle?.events)?lifecycle.events:[];
}
function formContext(context,state,resolvedSpecies=null){
  return {
    ...(context||{}),
    baseFormId:state.baseFormId,
    previousBaseFormId:context?.previousBaseFormId!==undefined?context.previousBaseFormId:state.baseFormId,
    previousActiveFormId:context&&Object.prototype.hasOwnProperty.call(context,'previousActiveFormId')?context.previousActiveFormId:state.activeFormId,
    resolvedSpecies:resolvedSpecies||context?.resolvedSpecies||null,
  };
}
function candidateResolution({species,state,context,allowUnmet}){
  return resolvePokemonForms({species,formState:state,context:formContext(context,state),allowUnmet});
}
function canActivate({species,state,form,context,allowUnmet}){
  const next={...state,activeFormId:form.id};
  const result=resolvePokemonForms({
    species,
    formState:next,
    context:{...formContext(context,state),previousBaseFormId:state.baseFormId,previousActiveFormId:state.activeFormId},
    allowUnmet,
  });
  return {next,result};
}
function validatePersistence({species,state,form,context,allowUnmet}){
  if(state.activeFormId!==form.id)return {state,changed:false,valid:true,errors:[],warnings:[]};
  const result=resolvePokemonForms({
    species,
    formState:state,
    context:{...formContext(context,state),previousBaseFormId:state.baseFormId,previousActiveFormId:state.activeFormId},
    allowUnmet,
  });
  if(result.valid)return {state,changed:false,valid:true,errors:[],warnings:result.warnings||[]};
  return {state:{...state,activeFormId:null},changed:true,valid:true,errors:[],warnings:[...(result.errors||[]).map(message=>`Lifecycle cleared ${form.name}: ${message}`)]};
}

function resolveEffect(spec,{context,event,form}){
  const effect=deepClone(spec||{});
  const kind=slug(effect.kind||effect.type);
  if(kind!=='grant-temp-hp')return {...effect,kind:kind||effect.kind||effect.type||'effect'};
  const source=slug(effect.source||form?.id||'form')||'form';
  let amount=null; let unroundedAmount=null; let formula=null;
  if(effect.amount!=null){amount=finite(effect.amount);formula={kind:'fixed',amount};}
  else if(effect.fraction_of_max_hp!=null||effect.fractionOfMaxHp!=null){
    const fraction=Number(effect.fraction_of_max_hp??effect.fractionOfMaxHp); const maxHp=finite(context?.maxHp);
    unroundedAmount=maxHp==null?null:maxHp*fraction; amount=unroundedAmount;
    formula={kind:'fraction_of_max_hp',fraction,maxHp};
  }else if(effect.ticks!=null){
    const ticks=Number(effect.ticks); const maxHp=finite(context?.maxHp);
    unroundedAmount=maxHp==null?null:maxHp*ticks/10; amount=unroundedAmount;
    formula={kind:'ticks_of_max_hp',ticks,maxHp,tickDefinition:'1/10 maximum Hit Points'};
  }else if(effect.fraction_of_target_form_max_hp!=null||effect.fractionOfTargetFormMaxHp!=null){
    const fraction=Number(effect.fraction_of_target_form_max_hp??effect.fractionOfTargetFormMaxHp);
    const targetMaxHp=finite(event?.targetFormMaxHp??event?.target_form_max_hp??context?.targetFormMaxHp);
    unroundedAmount=targetMaxHp==null?null:targetMaxHp*fraction; amount=unroundedAmount;
    formula={kind:'fraction_of_target_form_max_hp',fraction,targetFormMaxHp:targetMaxHp,requiresTargetFormMaxHp:targetMaxHp==null};
  }
  return {
    ...effect,
    kind:'grant_temp_hp',
    source,
    amount,
    unroundedAmount,
    formula,
    blocksOtherSources:!!(effect.blocks_other_sources??effect.blocksOtherSources),
  };
}
function resolvedEffects(rule,args){
  const specs=Array.isArray(rule?.effects)?rule.effects:[];
  return specs.map(spec=>resolveEffect(spec,args));
}

function applyAction({species,state,form,rule,context,event,allowUnmet}){
  const action=rule?.action&&typeof rule.action==='object'?rule.action:{type:rule?.action};
  const type=slug(action?.type||action?.kind||action?.action);
  if(type==='deactivate'||type==='clear-active'){
    const effectList=resolvedEffects(rule,{context,event,form});
    if(!state.activeFormId)return {state,changed:false,valid:true,errors:[],warnings:[],effects:effectList};
    if(action.form_id||action.formId){const wanted=slug(action.form_id??action.formId);if(state.activeFormId!==wanted)return {state,changed:false,valid:true,errors:[],warnings:[],effects:effectList};}
    return {state:{...state,activeFormId:null},changed:true,valid:true,errors:[],warnings:[],effects:effectList};
  }
  if(type==='validate-persistence'){
    const result=validatePersistence({species,state,form,context,allowUnmet});
    return {...result,effects:[]};
  }
  if(type==='sync'){
    if(state.activeFormId===form.id){
      const persisted=validatePersistence({species,state,form,context,allowUnmet});
      if(persisted.changed||persisted.valid)return {...persisted,effects:[]};
    }
    const activation=canActivate({species,state,form,context,allowUnmet});
    if(!activation.result.valid)return {state,changed:false,valid:true,errors:[],warnings:[],effects:[]};
    return {state:activation.next,changed:state.activeFormId!==form.id,valid:true,errors:[],warnings:activation.result.warnings||[],effects:resolvedEffects(rule,{context,event,form})};
  }
  if(type==='toggle'){
    if(state.activeFormId===form.id)return {state:{...state,activeFormId:null},changed:true,valid:true,errors:[],warnings:[],effects:resolvedEffects(rule,{context,event,form})};
  }
  if(type==='activate'||type==='set-active'||type==='toggle'){
    const targetId=slug(action.form_id??action.formId??form.id);
    const target=normalizeSpeciesForms(species?.forms||species?.raw?.forms||species?.raw?.form_definitions||[]).find(candidate=>candidate.id===targetId)||form;
    const activation=canActivate({species,state,form:target,context,allowUnmet});
    if(!activation.result.valid)return {state,changed:false,valid:false,errors:activation.result.errors||[],warnings:activation.result.warnings||[],effects:[]};
    return {state:activation.next,changed:state.activeFormId!==targetId,valid:true,errors:[],warnings:activation.result.warnings||[],effects:resolvedEffects(rule,{context,event,form:target})};
  }
  return {state,changed:false,valid:false,errors:[`Unsupported Form lifecycle action: ${type||'unknown'}.`],warnings:[],effects:[]};
}

export function applyPokemonFormTransitionEvent({species,formState={},context={},event={},allowUnmet=false}={}){
  const original=species||{};
  const forms=normalizeSpeciesForms(original.forms||original.raw?.forms||original.raw?.form_definitions||[]);
  const initialState=normalizePokemonFormState(formState);
  let state={...initialState};
  const normalizedEvent=normalizePokemonFormEvent(event);
  const eventContext={
    ...(context||{}),
    triggerItemId:normalizedEvent.triggerItemId??context?.triggerItemId??null,
    triggerItemName:normalizedEvent.triggerItemName??context?.triggerItemName??null,
    triggerItem:normalizedEvent.triggerItem??context?.triggerItem??null,
    targetFormMaxHp:normalizedEvent.targetFormMaxHp??context?.targetFormMaxHp??null,
  };
  const errors=[]; const warnings=[]; const effects=[]; const appliedRules=[];

  const rules=[];
  for(const form of forms){
    lifecycleRules(form).forEach((rule,index)=>rules.push({form,rule,index,priority:Number(rule?.priority??100)}));
  }
  rules.sort((a,b)=>a.priority-b.priority||a.form.id.localeCompare(b.form.id)||a.index-b.index);

  for(const entry of rules){
    const expectedKind=slug(entry.rule?.event||entry.rule?.event_kind||entry.rule?.kind);
    if(expectedKind&&expectedKind!==normalizedEvent.kind)continue;
    if(!matchWhen(entry.rule?.when,normalizedEvent,state))continue;
    const before={...state};
    const outcome=applyAction({species:original,state,form:entry.form,rule:entry.rule,context:eventContext,event:normalizedEvent,allowUnmet});
    warnings.push(...(outcome.warnings||[]));
    if(!outcome.valid){errors.push(...(outcome.errors||[]));continue;}
    state=outcome.state;
    if(outcome.changed||outcome.effects?.length){
      effects.push(...(outcome.effects||[]));
      appliedRules.push({
        id:entry.rule?.id||`${entry.form.id}:${entry.index+1}`,
        formId:entry.form.id,
        event:normalizedEvent.kind,
        before,
        after:{...state},
        action:deepClone(entry.rule?.action||null),
        actionCost:entry.rule?.action_cost||entry.rule?.actionCost||null,
        frequency:entry.rule?.frequency||null,
      });
    }
  }

  const resolution=candidateResolution({species:original,state,context:{...eventContext,previousBaseFormId:initialState.baseFormId,previousActiveFormId:initialState.activeFormId},allowUnmet});
  if(!resolution.valid&&!allowUnmet)errors.push(...resolution.errors);
  else warnings.push(...(resolution.warnings||[]));

  return {
    valid:errors.length===0,
    changed:state.baseFormId!==initialState.baseFormId||state.activeFormId!==initialState.activeFormId,
    errors:[...new Set(errors)],
    warnings:[...new Set(warnings)],
    event:normalizedEvent,
    formState:state,
    effects,
    appliedRules,
    resolution,
  };
}

export function previewFormLifecycleRequirement(requirements,context={}){
  return evaluateFormRequirements(requirements,context);
}
