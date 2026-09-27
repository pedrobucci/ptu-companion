#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
TARGETS = [
    ROOT / 'static-preview' / 'app.js',
    REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'app.js',
]

SYNC_HELPER = """function syncPokemonTempHpPersistence(p){
  if(!p)return;p.details=p.details&&typeof p.details==='object'?p.details:{};p.tempHp=Math.max(0,Number(p.tempHp??p.details.tempHp??0));p.details.tempHp=p.tempHp;
  if(!p.details.formTempHpBySource||typeof p.details.formTempHpBySource!=='object'||Array.isArray(p.details.formTempHpBySource))p.details.formTempHpBySource={};
}"""

HARDENING_HELPERS = r"""
function clearPokemonFormTempHpTracking(p){
  if(!p)return;syncPokemonTempHpPersistence(p);p.tempHp=0;p.details.tempHp=0;p.details.formTempHpBySource={};delete p.details.formTempHpBlockOtherSources;
}
function pokemonFormStateSnapshot(p){
  const state=p?.details?.formState||{};return {baseFormId:formEventSlug(state.baseFormId||'base')||'base',activeFormId:state.activeFormId==null?null:(formEventSlug(state.activeFormId)||null)};
}
function pokemonFormStateLabel(formState={}){const base=formState.baseFormId||'base',active=formState.activeFormId||null;return active?`${base} + ${active}`:base;}
function pokemonFormAppliedRuleSummary(payload){
  const notes=[];for(const transition of (payload?.transitions||[]))for(const rule of (transition?.appliedRules||[])){const bits=[rule.frequency,rule.actionCost].filter(Boolean);if(bits.length)notes.push(bits.join(' · '));}
  return [...new Set(notes)].join('; ');
}
function recordPokemonFormLifecycleFeedback(p,beforeState,payload,event,{silent=false}={}){
  if(!p||!payload?.valid)return {formChanged:false,blockedTempHp:0};
  const afterState=pokemonFormStateSnapshot(p);const formChanged=beforeState.baseFormId!==afterState.baseFormId||beforeState.activeFormId!==afterState.activeFormId;
  const blockedTempHp=Math.max(0,Number(payload?.hpAdjustment?.blockedTempHp||0));const history=trainer()?.history;
  if(formChanged&&Array.isArray(history)){
    const ruleSummary=pokemonFormAppliedRuleSummary(payload);history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Pokémon Form changed',detail:`${p.name}: ${pokemonFormStateLabel(beforeState)} → ${pokemonFormStateLabel(afterState)}${ruleSummary?` · ${ruleSummary}`:''}`});
    if(!silent)toast(`${p.name}: Form ${pokemonFormStateLabel(beforeState)} → ${pokemonFormStateLabel(afterState)}.`);
  }
  if(blockedTempHp>0&&Array.isArray(history)){
    history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Temporary HP blocked',detail:`${p.name}: ${blockedTempHp} Temporary HP blocked by the active Form source rule.`});
    if(!silent)toast(`${p.name}: ${blockedTempHp} Temporary HP blocked by the active Form rule.`,'error');
  }
  return {formChanged,blockedTempHp};
}
async function revalidatePokemonFormAfterDirectHpMutation(id,{hpChanged=true,tempHpChanged=false,silent=true}={}){
  const p=pokemon(id);if(!p?.details?.speciesDefinitionId)return null;let payload=null;
  if(hpChanged)payload=await applyPokemonFormGameEventUi(id,{kind:'hp-changed'},{silent,commitAfter:false});
  if(tempHpChanged)payload=await applyPokemonFormGameEventUi(id,{kind:'temp-hp-changed'},{silent,commitAfter:false});
  return payload;
}
"""

OLD_APPLY = r"""async function applyPokemonFormGameEventUi(id,event,{silent=false,commitAfter=true,message=null}={}){
  const p=pokemon(id);if(!p)return null;syncPokemonTempHpPersistence(p);
  if(!p.details?.speciesDefinitionId)return null;
  try{
    const response=await fetch('/api/pokemon/forms/apply-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      pokemon:p,event,rulesetId:catalogState.status?.activeRulesetId||p.details.linkedRulesetId||null,gmOverride:!!state.ui.gmOverride,
      currentHp:p.hp,maxHp:p.maxHp,tempHp:p.tempHp,tempHpBySource:p.details.formTempHpBySource||{},inCombat:!!state.ui.inCombat,
      manualFormApprovals:p.details.manualFormApprovals||[]
    })});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.valid){
      if(!silent)toast((payload.errors||[payload.error||'Form event could not be applied.']).join(' '),'error');
      return payload;
    }
    if(payload.pokemon){Object.assign(p,payload.pokemon);syncPokemonTempHpPersistence(p);}
    if(payload.changed){invalidateCreatureReference();if(commitAfter)commit(message||`${p.name} Form state updated.`);}
    else if(!silent&&commitAfter)toast('No Pokémon Form lifecycle change was triggered.');
    return payload;
  }catch(error){if(!silent)toast(error.message,'error');return null;}
}"""

NEW_APPLY = r"""async function applyPokemonFormGameEventUi(id,event,{silent=false,commitAfter=true,message=null}={}){
  const p=pokemon(id);if(!p)return null;syncPokemonTempHpPersistence(p);
  if(!p.details?.speciesDefinitionId)return null;const beforeFormState=pokemonFormStateSnapshot(p);
  try{
    const response=await fetch('/api/pokemon/forms/apply-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      pokemon:p,event,rulesetId:catalogState.status?.activeRulesetId||p.details.linkedRulesetId||null,gmOverride:!!state.ui.gmOverride,
      currentHp:p.hp,maxHp:p.maxHp,tempHp:p.tempHp,tempHpBySource:p.details.formTempHpBySource||{},inCombat:!!state.ui.inCombat,
      manualFormApprovals:p.details.manualFormApprovals||[]
    })});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.valid){
      if(!silent)toast((payload.errors||[payload.error||'Form event could not be applied.']).join(' '),'error');
      return payload;
    }
    if(payload.pokemon){Object.assign(p,payload.pokemon);syncPokemonTempHpPersistence(p);}
    const feedback=recordPokemonFormLifecycleFeedback(p,beforeFormState,payload,event,{silent});
    if(payload.changed){invalidateCreatureReference();if(commitAfter)commit(message||`${p.name} state updated.${feedback.formChanged?' Form changed.':''}`);}
    else if(!silent&&commitAfter)toast('No Pokémon Form lifecycle change was triggered.');
    return {...payload,lifecycleFeedback:feedback};
  }catch(error){if(!silent)toast(error.message,'error');return null;}
}"""

OLD_STORAGE = """function storePokemon(id){
  const p=pokemon(id); if(p.injuries>0) return toast(`${p.name} cannot enter Storage with Injuries.`,'error');
  if(p.heldItem) returnHeldItemToBackpack(p);
  p.storage=true; p.hp=p.maxHp; p.tempHp=0; Object.keys(p.combatStages).forEach(k=>p.combatStages[k]=0); commit(`${p.name} moved to Storage.`);
}
function withdrawPokemon(id){ const p=pokemon(id); p.storage=false; p.hp=p.maxHp; p.tempHp=0; commit(`${p.name} withdrawn from Storage.`); }"""

NEW_STORAGE = """async function storePokemon(id){
  const p=pokemon(id); if(p.injuries>0) return toast(`${p.name} cannot enter Storage with Injuries.`,'error');
  if(p.heldItem) returnHeldItemToBackpack(p);
  p.storage=true;p.hp=p.maxHp;clearPokemonFormTempHpTracking(p);Object.keys(p.combatStages).forEach(k=>p.combatStages[k]=0);
  await revalidatePokemonFormAfterDirectHpMutation(id,{hpChanged:true,tempHpChanged:true,silent:true});commit(`${p.name} moved to Storage. Temporary HP and Form THP provenance cleared.`);
}
async function withdrawPokemon(id){
  const p=pokemon(id);if(!p)return;p.storage=false;p.hp=p.maxHp;clearPokemonFormTempHpTracking(p);
  await revalidatePokemonFormAfterDirectHpMutation(id,{hpChanged:true,tempHpChanged:true,silent:true});commit(`${p.name} withdrawn from Storage. Temporary HP and Form state revalidated.`);
}"""

OLD_ITEM = """function useItem(itemId,pid){
  const i=inventoryItem(itemId), p=pokemon(pid); if(!i||i.qty<=0) return toast('No item available.','error');
  if(i.id==='potion') p.hp=Math.min(p.maxHp,p.hp+20);
  else if(i.id==='super-potion') p.hp=Math.min(p.maxHp,p.hp+50);
  else if(i.id==='oran-berry') p.hp=Math.min(p.maxHp,p.hp+10);
  else return toast(`${i.name} use is not automated in this prototype.`,'error');
  i.qty-=1; commit(`${i.name} used on ${p.name}.`);
}"""

NEW_ITEM = """async function useItem(itemId,pid){
  const i=inventoryItem(itemId),p=pokemon(pid);if(!i||i.qty<=0)return toast('No item available.','error');
  const healing=i.id==='potion'?20:i.id==='super-potion'?50:i.id==='oran-berry'?10:null;
  if(healing==null)return toast(`${i.name} use is not automated in this prototype.`,'error');
  if(p.details?.speciesDefinitionId){
    const payload=await applyPokemonFormGameEventUi(pid,{kind:'hp-adjust',delta:healing},{silent:false,commitAfter:false});if(!payload?.valid)return;
  }else p.hp=Math.min(p.maxHp,p.hp+healing);
  i.qty-=1;commit(`${i.name} used on ${p.name}.`);
}"""


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'Anchor drifted: {label}')
    return text.replace(old, new, 1)


def patch_client(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    original = text

    if 'function clearPokemonFormTempHpTracking' not in text:
        if SYNC_HELPER not in text:
            raise SystemExit(f'Temporary HP helper anchor drifted: {path}')
        text = text.replace(SYNC_HELPER, SYNC_HELPER + '\n' + HARDENING_HELPERS, 1)

    text = replace_once(text, OLD_APPLY, NEW_APPLY, f'apply-event UI wrapper in {path}')
    text = replace_once(text, OLD_STORAGE, NEW_STORAGE, f'storage lifecycle in {path}')
    text = replace_once(text, OLD_ITEM, NEW_ITEM, f'healing item lifecycle in {path}')

    load_old = "if(Number.isFinite(resolvedMax)&&resolvedMax>0&&Number(p.maxHp)!==resolvedMax){ p.maxHp=resolvedMax; p.hp=Math.min(Number(p.hp||0),resolvedMax); persist(); }"
    load_new = "if(Number.isFinite(resolvedMax)&&resolvedMax>0&&Number(p.maxHp)!==resolvedMax){ p.maxHp=resolvedMax;p.hp=Math.min(Number(p.hp||0),resolvedMax);await revalidatePokemonFormAfterDirectHpMutation(p.id,{hpChanged:true,tempHpChanged:false,silent:true});persist(); }"
    text = replace_once(text, load_old, load_new, f'reference-data HP refresh in {path}')

    restat_old = "p.maxHp=Number(pv.resolvedMaxHp??pv.maxHp); p.hp=Math.min(p.hp,p.maxHp);"
    restat_new = "p.maxHp=Number(pv.resolvedMaxHp??pv.maxHp);p.hp=Math.min(p.hp,p.maxHp);await revalidatePokemonFormAfterDirectHpMutation(p.id,{hpChanged:true,tempHpChanged:false,silent:true});"
    text = replace_once(text, restat_old, restat_new, f'restat HP revalidation in {path}')

    training_old = "if(Number(payload?.resolvedStatEffects?.maxHp)>0){p.maxHp=Number(payload.resolvedStatEffects.maxHp);p.hp=Math.min(p.hp,p.maxHp);}"
    training_new = "if(Number(payload?.resolvedStatEffects?.maxHp)>0){p.maxHp=Number(payload.resolvedStatEffects.maxHp);p.hp=Math.min(p.hp,p.maxHp);await revalidatePokemonFormAfterDirectHpMutation(p.id,{hpChanged:true,tempHpChanged:false,silent:true});}"
    if training_new not in text:
        count = text.count(training_old)
        if count != 2:
            raise SystemExit(f'Expected two training HP anchors in {path}, found {count}')
        text = text.replace(training_old, training_new)

    if text != original:
        path.write_text(text, encoding='utf-8')
        return True
    return False


def main() -> None:
    changed = [str(path.relative_to(REPO)) for path in TARGETS if patch_client(path)]
    print({'changed': changed, 'targets': len(TARGETS), 'campaign_hardening_model_version': 1})


if __name__ == '__main__':
    main()
