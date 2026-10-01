import {applyPokemonFormTransitionEvent,normalizePokemonFormEvent} from './pokemon-form-events.mjs';

const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const slug=value=>String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const finite=value=>{if(value==null||value==='')return null;const number=Number(value);return Number.isFinite(number)?number:null;};

export const FORM_CAMPAIGN_STATE_MODEL_VERSION=1;

function ensureDetails(pokemon){
  pokemon.details=pokemon.details&&typeof pokemon.details==='object'?pokemon.details:{};
  const current=finite(pokemon.tempHp??pokemon.details.tempHp)??0;
  pokemon.tempHp=Math.max(0,current);
  pokemon.details.tempHp=pokemon.tempHp;
  const raw=pokemon.details.formTempHpBySource;
  pokemon.details.formTempHpBySource=raw&&typeof raw==='object'&&!Array.isArray(raw)?{...raw}:{};
  return pokemon.details;
}

function sourceEntries(details){
  return Object.entries(details.formTempHpBySource||{}).map(([source,value])=>[slug(source),Math.max(0,finite(value)??0)]).filter(([,value])=>value>0);
}

function syncTrackedTempHpAfterLoss(pokemon,previousTempHp){
  const details=ensureDetails(pokemon);
  const current=Math.max(0,finite(pokemon.tempHp)??0);
  const entries=sourceEntries(details);
  if(current<=0){details.formTempHpBySource={};return;}
  if(entries.length!==1){details.formTempHpBySource={};return;}
  const [source,value]=entries[0];
  if(Math.abs(value-previousTempHp)>1e-9){details.formTempHpBySource={};return;}
  details.formTempHpBySource={[source]:current};
}

function activeTempHpBlock(details){
  const block=details.formTempHpBlockOtherSources;
  if(!block||typeof block!=='object')return null;
  const active=slug(details.formState?.activeFormId);
  if(!active||active!==slug(block.activeFormId)){delete details.formTempHpBlockOtherSources;return null;}
  return block;
}

export function applyPokemonHpDelta(pokemon,delta){
  const p=clone(pokemon||{});const details=ensureDetails(p);const amount=finite(delta)??0;
  p.hp=Math.max(0,Math.min(finite(p.maxHp)??0,finite(p.hp)??0));
  const beforeHp=p.hp,beforeTemp=p.tempHp;
  let blockedTempHp=0;
  if(amount>0){
    const injuries=Math.max(0,Math.min(10,Math.trunc(finite(p.injuries)??0)));
    const healingLimit=Math.floor((finite(p.maxHp)??0)*(10-injuries)/10);
    const missing=Math.max(0,healingLimit-p.hp);
    const restored=Math.min(amount,missing);p.hp+=restored;
    const overflow=Math.max(0,amount-restored);
    if(overflow>0){
      if(activeTempHpBlock(details))blockedTempHp=overflow;
      else{
        p.tempHp+=overflow;
        // Campaign rule: excess healing becomes Temporary HP. Because this can mix with
        // non-form THP, drop source provenance rather than falsely attributing it.
        details.formTempHpBySource={};
      }
    }
  }else if(amount<0){
    let damage=-amount;
    const absorbed=Math.min(p.tempHp,damage);
    p.tempHp-=absorbed;damage-=absorbed;
    if(absorbed>0)syncTrackedTempHpAfterLoss(p,beforeTemp);
    p.hp=Math.max(0,p.hp-damage);
  }
  details.tempHp=p.tempHp;
  return {
    pokemon:p,
    hpChanged:Math.abs(p.hp-beforeHp)>1e-9,
    tempHpChanged:Math.abs(p.tempHp-beforeTemp)>1e-9,
    fainted:beforeHp>0&&p.hp<=0,
    blockedTempHp,
    before:{hp:beforeHp,tempHp:beforeTemp},
    after:{hp:p.hp,tempHp:p.tempHp},
  };
}

function hypotheticalTargetFormMaxHp(effect,pokemon){
  const targetBaseHp=finite(effect?.target_form_base_hp??effect?.targetFormBaseHp);
  if(targetBaseHp==null)return null;
  const details=ensureDetails(pokemon);
  const baseHp=finite(details.baseStats?.hp);
  const natureHp=finite(details.natureAdjustedBaseStats?.hp);
  const finalHp=finite(details.finalStats?.hp);
  const level=finite(pokemon.level);
  if(baseHp==null||natureHp==null||finalHp==null||level==null)return null;
  const natureDelta=natureHp-baseHp;
  const permanentDelta=finalHp-natureHp;
  const targetHpStat=Math.max(1,targetBaseHp+natureDelta+permanentDelta);
  // This is the app's existing PTU Pokémon HP formula: Level + (HP Stat x 3) + 10.
  return level+(targetHpStat*3)+10;
}

function effectAmount(effect,pokemon){
  const direct=finite(effect?.amount);
  if(direct!=null)return direct;
  const formula=effect?.formula||{};
  if(formula.kind==='ticks_of_max_hp'){
    const maxHp=finite(pokemon.maxHp);const ticks=finite(formula.ticks);
    return maxHp==null||ticks==null?null:maxHp*ticks/10;
  }
  if(formula.kind==='fraction_of_max_hp'){
    const maxHp=finite(pokemon.maxHp);const fraction=finite(formula.fraction);
    return maxHp==null||fraction==null?null:maxHp*fraction;
  }
  if(formula.kind==='fraction_of_target_form_max_hp'){
    const target=finite(formula.targetFormMaxHp)??hypotheticalTargetFormMaxHp(effect,pokemon);
    const fraction=finite(formula.fraction);
    return target==null||fraction==null?null:target*fraction;
  }
  return null;
}

export function applyFormLifecycleEffectsToPokemon(pokemon,effects=[],formState=null){
  const p=clone(pokemon||{});const details=ensureDetails(p);const applications=[];
  if(formState)details.formState=clone(formState);
  for(const raw of (Array.isArray(effects)?effects:[])){
    const effect=raw&&typeof raw==='object'?raw:{};
    if(slug(effect.kind)!=='grant-temp-hp'){applications.push({kind:effect.kind||'effect',applied:false,reason:'unsupported-effect-directive'});continue;}
    const amount=effectAmount(effect,p);const source=slug(effect.source||'form')||'form';const before=p.tempHp;
    if(amount==null){applications.push({kind:'grant_temp_hp',source,applied:false,reason:'unresolved-amount',formula:clone(effect.formula||null)});continue;}
    // Core 1.05 Temporary HP do not stack: only the highest current value applies.
    if(amount>p.tempHp){
      p.tempHp=amount;details.tempHp=amount;details.formTempHpBySource={[source]:amount};
    }
    if(effect.blocksOtherSources){
      details.formTempHpBlockOtherSources={source,activeFormId:details.formState?.activeFormId||null};
    }
    applications.push({kind:'grant_temp_hp',source,applied:amount>before,amount,before,after:p.tempHp,blocksOtherSources:!!effect.blocksOtherSources});
  }
  activeTempHpBlock(details);
  details.tempHp=p.tempHp;
  return {pokemon:p,applications};
}

function contextFor(pokemon,baseContext,event){
  const details=ensureDetails(pokemon);
  return {
    ...(baseContext||{}),
    currentHp:pokemon.hp,
    maxHp:pokemon.maxHp,
    tempHp:pokemon.tempHp,
    tempHpBySource:details.formTempHpBySource||{},
    previousBaseFormId:details.formState?.baseFormId||'base',
    previousActiveFormId:details.formState?.activeFormId??null,
    triggerItemId:event?.triggerItemId??event?.trigger_item_id??baseContext?.triggerItemId??null,
    triggerItemName:event?.triggerItem??event?.trigger_item??baseContext?.triggerItemName??null,
    triggerItem:event?.triggerItem??event?.trigger_item??baseContext?.triggerItem??null,
  };
}

function applyResolvedPresentation(pokemon,transition){
  const species=transition?.resolution?.species;
  if(Array.isArray(species?.types))pokemon.types=species.types.map(type=>String(type).toLowerCase());
  if(species?.name)pokemon.species=species.name;
}

function applyOneTransition({species,pokemon,event,context,allowUnmet}){
  const details=ensureDetails(pokemon);
  const transition=applyPokemonFormTransitionEvent({
    species,
    formState:details.formState||{baseFormId:'base',activeFormId:null},
    context:contextFor(pokemon,context,event),
    event,
    allowUnmet,
  });
  if(!transition.valid&&!allowUnmet)return {pokemon,transition,effectApplications:[]};
  details.formState=clone(transition.formState);
  let applied=applyFormLifecycleEffectsToPokemon(pokemon,transition.effects,transition.formState);
  pokemon=applied.pokemon;
  applyResolvedPresentation(pokemon,transition);
  const afterDetails=ensureDetails(pokemon);activeTempHpBlock(afterDetails);
  return {pokemon,transition,effectApplications:applied.applications};
}

export function applyPokemonFormGameEvent({species,pokemon,event={},context={},allowUnmet=false}={}){
  const original=clone(pokemon||{});let current=clone(pokemon||{});ensureDetails(current);
  const normalized=normalizePokemonFormEvent(event);
  const queue=[];let hpAdjustment=null;
  if(normalized.kind==='hp-adjust'){
    hpAdjustment=applyPokemonHpDelta(current,normalized.delta??normalized.amount??0);current=hpAdjustment.pokemon;
    if(hpAdjustment.hpChanged)queue.push({kind:'hp-changed'});
    if(hpAdjustment.tempHpChanged)queue.push({kind:'temp-hp-changed'});
    if(hpAdjustment.fainted)queue.push({kind:'faint'});
  }else if(normalized.kind==='battle-start'){
    queue.push(normalized,{kind:'combat-state-changed'});
  }else if(normalized.kind==='battle-end'){
    queue.push({kind:'combat-state-changed'});
  }else queue.push(normalized);

  const transitions=[];const effects=[];const effectApplications=[];const errors=[];const warnings=[];
  for(const nextEvent of queue){
    const applied=applyOneTransition({species,pokemon:current,event:nextEvent,context,allowUnmet});
    current=applied.pokemon;transitions.push(applied.transition);
    effects.push(...(applied.transition.effects||[]));effectApplications.push(...applied.effectApplications);
    errors.push(...(applied.transition.errors||[]));warnings.push(...(applied.transition.warnings||[]));
    if(!applied.transition.valid&&!allowUnmet){
      return {valid:false,changed:false,pokemon:original,formState:ensureDetails(original).formState||{baseFormId:'base',activeFormId:null},event:normalized,hpAdjustment,transitions,effects,effectApplications,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
    }
  }
  const details=ensureDetails(current);
  const changed=JSON.stringify(original)!==JSON.stringify(current);
  return {valid:true,changed,pokemon:current,formState:clone(details.formState||{baseFormId:'base',activeFormId:null}),event:normalized,hpAdjustment,transitions,effects,effectApplications,errors:[],warnings:[...new Set(warnings)]};
}
