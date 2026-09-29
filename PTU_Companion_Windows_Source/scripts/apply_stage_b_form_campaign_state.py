#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
WINDOWS_APP = ROOT / 'static-preview' / 'app.js'
ANDROID_APP = REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'app.js'
WINDOWS_API = ROOT / 'server.mjs'
ANDROID_API = REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'mobile-api.mjs'
REPOSITORY = ROOT / 'persistence' / 'repository.mjs'
EVENT_MODULES = [
    ROOT / 'rules' / 'pokemon-form-events.mjs',
    REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'rules' / 'pokemon-form-events.mjs',
]
LIFECYCLE_AUGMENTER = ROOT / 'scripts' / 'augment_ptu_form_lifecycle_events.py'

API_EVENT_IMPORT = "import {applyPokemonFormTransitionEvent} from './rules/pokemon-form-events.mjs';"
API_CAMPAIGN_IMPORT = "import {applyPokemonFormGameEvent} from './rules/pokemon-form-campaign-state.mjs';"
API_ROUTE_ANCHOR = "  if(req.method==='POST' && url.pathname==='/api/pokemon/forms/transition'){"
API_ROUTE = r"""  if(req.method==='POST' && url.pathname==='/api/pokemon/forms/apply-event'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const pokemon=payload.pokemon||{}; const details=pokemon.details||{};
    const speciesId=String(payload.speciesId||details.speciesDefinitionId||'');
    const baseSpecies=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!baseSpecies)return json(res,404,{error:'Species definition not found in active ruleset'});
    const result=applyPokemonFormGameEvent({
      species:baseSpecies,
      pokemon,
      event:payload.event||{},
      context:pokemonFormContext({pokemon,payload}),
      allowUnmet:!!payload.gmOverride
    });
    return json(res,result.valid?200:400,{rulesetId,baseSpecies:{id:baseSpecies.id,name:baseSpecies.name,forms:baseSpecies.forms||[]},...result});
  }
"""

CLIENT_HELPERS = r"""
function formEventSlug(value){return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
function syncPokemonTempHpPersistence(p){
  if(!p)return;p.details=p.details&&typeof p.details==='object'?p.details:{};p.tempHp=Math.max(0,Number(p.tempHp??p.details.tempHp??0));p.details.tempHp=p.tempHp;
  if(!p.details.formTempHpBySource||typeof p.details.formTempHpBySource!=='object'||Array.isArray(p.details.formTempHpBySource))p.details.formTempHpBySource={};
}
async function applyPokemonFormGameEventUi(id,event,{silent=false,commitAfter=true,message=null}={}){
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
}
function pokemonMoveRaisesDefenseCombatStages(def={}){
  const category=String(def?.category||def?.class||def?.raw?.category||'').toLowerCase();if(category!=='status')return false;
  const effect=String(def?.effect||def?.raw?.effect||'');
  return /(?:raise|raises|raised|increase|increases|increased|gain|gains)\b[^.\n]{0,90}\bDefense\b[^.\n]{0,40}\bCombat Stage/i.test(effect)
    || /\bDefense\b[^.\n]{0,40}\bCombat Stage[^.\n]{0,90}(?:raise|increase|gain)/i.test(effect);
}
async function usePokemonMoveForForms(id,index){
  const p=pokemon(id);const data=creatureReferenceState.pokemonId===id?creatureReferenceState.data:null;const row=(data?.moves||[])[Number(index)];if(!p||!row)return toast('Move reference data is unavailable.','error');
  const def=row.definition||{};const tags=moveKeywordEntries(def||row.record||{}).map(entry=>entry.name);
  await applyPokemonFormGameEventUi(id,{kind:'move-used',move:def.name||row.record?.name||row.record?.id||'',moveClass:def.category||def.class||null,damaging:!!row.resolvedDamage?.damaging,raisesDefenseCombatStages:pokemonMoveRaisesDefenseCombatStages(def),tags},{message:`${p.name} used ${def.name||row.record?.name||'a Move'}.`});
}
async function usePokemonAbilityForForms(id,index){
  const p=pokemon(id);const data=creatureReferenceState.pokemonId===id?creatureReferenceState.data:null;const row=(data?.abilities||[])[Number(index)];if(!p||!row)return toast('Ability reference data is unavailable.','error');
  await applyPokemonFormGameEventUi(id,{kind:'ability-used',ability:row.name},{message:`${p.name} used ${row.name}.`});
}
async function usePokemonCapabilityForForms(id,capability,triggerItem){
  const p=pokemon(id);if(!p)return;
  const hasItem=!triggerItem||formEventSlug(p.heldItem)===formEventSlug(triggerItem)||(state.inventory||[]).some(item=>Number(item.qty||0)>0&&formEventSlug(item.name)===formEventSlug(triggerItem));
  if(!hasItem&&!state.ui.gmOverride)return toast(`${triggerItem} is required for ${capability}.`,'error');
  await applyPokemonFormGameEventUi(id,{kind:'capability-used',capability,triggerItem},{message:`${p.name} used ${capability}.`});
}
async function usePokemonFormActionForForms(id,actionId,extra={}){const p=pokemon(id);if(!p)return;await applyPokemonFormGameEventUi(id,{kind:'form-action',actionId,...extra},{message:`${p.name} Form action applied.`});}
function pokemonFormLifecycleControls(forms,stateForm,p){
  const ids=new Set((forms||[]).map(form=>formEventSlug(form.id)));const buttons=[];
  if(ids.has('sword-stance'))buttons.push(`<button class="btn btn-ghost btn-small" onclick="usePokemonFormActionForForms('${p.id}','stance-change-full-action')">Stance Change · Full Action</button>`);
  if(ids.has('noice-face'))buttons.push(`<button class="btn btn-ghost btn-small" onclick="usePokemonFormActionForForms('${p.id}','ice-face-hail-restore',{weather:'Hail'})">Restore Ice Face · Hail</button>`);
  if(ids.has('crowned-sword'))buttons.push(stateForm.activeFormId==='crowned-sword'?`<button class="btn btn-ghost btn-small" onclick="usePokemonFormActionForForms('${p.id}','weapon-bond-relinquish')">Relinquish Crowned Sword</button>`:`<button class="btn btn-gold btn-small" onclick="usePokemonCapabilityForForms('${p.id}','Weapon Bond','Ancestral Sword')">Weapon Bond · Ancestral Sword</button>`);
  if(ids.has('crowned-shield'))buttons.push(stateForm.activeFormId==='crowned-shield'?`<button class="btn btn-ghost btn-small" onclick="usePokemonFormActionForForms('${p.id}','weapon-bond-relinquish')">Relinquish Crowned Shield</button>`:`<button class="btn btn-gold btn-small" onclick="usePokemonCapabilityForForms('${p.id}','Weapon Bond','Ancestral Shield')">Weapon Bond · Ancestral Shield</button>`);
  return buttons.length?`<div class="flow-note"><strong>Source lifecycle actions</strong><div class="row-gap">${buttons.join('')}</div><small>Action/frequency costs are shown by the source rules but are not silently consumed by the Form engine.</small></div>`:'';
}
async function setPokemonBattleState(active){
  state.ui.inCombat=!!active;const event={kind:active?'battle-start':'battle-end'};
  for(const p of activePokemon())if(p?.details?.speciesDefinitionId)await applyPokemonFormGameEventUi(p.id,event,{silent:true,commitAfter:false});
  commit(active?'Battle started. Form battle-start hooks applied.':'Battle ended. Out-of-combat Form state revalidated.');
}
"""


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'Anchor drifted: {label}')
    return text.replace(old, new, 1)


def patch_api(path: Path) -> bool:
    text = path.read_text(encoding='utf-8'); original = text
    if API_CAMPAIGN_IMPORT not in text:
        if API_EVENT_IMPORT not in text:
            raise SystemExit(f'Form event import anchor missing: {path}')
        text = text.replace(API_EVENT_IMPORT, API_EVENT_IMPORT + '\n' + API_CAMPAIGN_IMPORT, 1)
    if "/api/pokemon/forms/apply-event" not in text:
        if API_ROUTE_ANCHOR not in text:
            raise SystemExit(f'Form transition route anchor missing: {path}')
        text = text.replace(API_ROUTE_ANCHOR, API_ROUTE + '\n' + API_ROUTE_ANCHOR, 1)
    if text != original:
        path.write_text(text, encoding='utf-8'); return True
    return False


def patch_event_module(path: Path) -> bool:
    text = path.read_text(encoding='utf-8'); original = text
    old = "        action:deepClone(entry.rule?.action||null),\n"
    new = "        action:deepClone(entry.rule?.action||null),\n        actionCost:entry.rule?.action_cost||entry.rule?.actionCost||null,\n        frequency:entry.rule?.frequency||null,\n"
    if 'actionCost:entry.rule?.action_cost' not in text:
        if old not in text: raise SystemExit(f'Applied-rule anchor missing: {path}')
        text = text.replace(old, new, 1)
    if text != original:
        path.write_text(text, encoding='utf-8'); return True
    return False


def patch_repository() -> bool:
    text = REPOSITORY.read_text(encoding='utf-8'); original = text
    load_old = "      types:fromJson(p.types_json, []), hp:p.hp, maxHp:p.max_hp, injuries:p.injuries,\n"
    load_new = "      types:fromJson(p.types_json, []), hp:p.hp, maxHp:p.max_hp, tempHp:Number(fromJson(p.details_json, {}).tempHp||0), injuries:p.injuries,\n"
    if 'tempHp:Number(fromJson(p.details_json, {}).tempHp||0)' not in text:
        if load_old not in text: raise SystemExit('Repository loadState Pokémon anchor drifted')
        text = text.replace(load_old, load_new, 1)
    save_old = "p.loyalty,toJson(p.combatStages),toJson(p.details||{}));"
    save_new = "p.loyalty,toJson(p.combatStages),toJson({...p.details,tempHp:Number(p.tempHp??p.details?.tempHp??0)}));"
    if save_new not in text:
        if save_old not in text: raise SystemExit('Repository saveState Pokémon details anchor drifted')
        text = text.replace(save_old, save_new, 1)
    if text != original:
        REPOSITORY.write_text(text, encoding='utf-8'); return True
    return False


def patch_lifecycle_augmenter() -> bool:
    text = LIFECYCLE_AUGMENTER.read_text(encoding='utf-8'); original = text
    old = "'fraction_of_target_form_max_hp': 0.5, 'blocks_other_sources': True"
    new = "'fraction_of_target_form_max_hp': 0.5, 'target_form_base_hp': 22, 'blocks_other_sources': True"
    if new not in text:
        if old not in text: raise SystemExit('Power Construct lifecycle effect anchor drifted')
        text = text.replace(old, new)
    if text != original:
        LIFECYCLE_AUGMENTER.write_text(text, encoding='utf-8'); return True
    return False


def patch_client(path: Path) -> bool:
    text = path.read_text(encoding='utf-8'); original = text
    migrate_anchor = "  data.ui.trainerTab ||= 'profile';"
    if "data.ui.inCombat=!!data.ui.inCombat;" not in text:
        if migrate_anchor not in text: raise SystemExit(f'UI migration anchor drifted: {path}')
        text = text.replace(migrate_anchor, migrate_anchor + "\n  data.ui.inCombat=!!data.ui.inCombat;", 1)
    shiny_anchor = "    p.details.isShiny=!!(p.details.isShiny??p.details.is_shiny??p.isShiny??p.is_shiny??false);"
    temp_patch = shiny_anchor + "\n    p.tempHp=Math.max(0,Number(p.tempHp??p.details.tempHp??0));p.details.tempHp=p.tempHp;\n    p.details.formTempHpBySource=p.details.formTempHpBySource&&typeof p.details.formTempHpBySource==='object'&&!Array.isArray(p.details.formTempHpBySource)?p.details.formTempHpBySource:{};"
    if "p.details.formTempHpBySource=p.details.formTempHpBySource" not in text:
        if shiny_anchor not in text: raise SystemExit(f'Pokémon migration anchor drifted: {path}')
        text = text.replace(shiny_anchor, temp_patch, 1)
    battle_anchor = "/* --- Battle state --- */"
    if 'async function applyPokemonFormGameEventUi' not in text:
        if battle_anchor not in text: raise SystemExit(f'Battle-state anchor drifted: {path}')
        text = text.replace(battle_anchor, CLIENT_HELPERS + "\n\n" + battle_anchor, 1)

    old_hp = """function changeHp(id,delta){
  const p=pokemon(id); if(!p)return; const amount=Number(delta)||0; p.tempHp=tempHpValue(p); p.hp=Math.max(0,Math.min(Number(p.maxHp||0),Number(p.hp||0)));
  if(amount>0){ const missing=Math.max(0,p.maxHp-p.hp); const restored=Math.min(amount,missing); p.hp+=restored; p.tempHp+=Math.max(0,amount-restored); }
  else if(amount<0){ let damage=-amount; const absorbed=Math.min(p.tempHp,damage); p.tempHp-=absorbed; damage-=absorbed; p.hp=Math.max(0,p.hp-damage); }
  commit(p.tempHp?`${p.name} HP: ${p.hp}/${p.maxHp} +${p.tempHp} Temporary HP`:`${p.name} HP: ${p.hp}/${p.maxHp}`);
}"""
    new_hp = """async function changeHp(id,delta){
  const p=pokemon(id);if(!p)return;
  if(p.details?.speciesDefinitionId){
    const payload=await applyPokemonFormGameEventUi(id,{kind:'hp-adjust',delta:Number(delta)||0},{silent:true,commitAfter:false});
    if(payload?.valid){const updated=pokemon(id);commit(updated.tempHp?`${updated.name} HP: ${updated.hp}/${updated.maxHp} +${updated.tempHp} Temporary HP`:`${updated.name} HP: ${updated.hp}/${updated.maxHp}`);return;}
  }
  const amount=Number(delta)||0;p.tempHp=tempHpValue(p);p.hp=Math.max(0,Math.min(Number(p.maxHp||0),Number(p.hp||0)));
  if(amount>0){const missing=Math.max(0,p.maxHp-p.hp);const restored=Math.min(amount,missing);p.hp+=restored;p.tempHp+=Math.max(0,amount-restored);}
  else if(amount<0){let damage=-amount;const absorbed=Math.min(p.tempHp,damage);p.tempHp-=absorbed;damage-=absorbed;p.hp=Math.max(0,p.hp-damage);}
  syncPokemonTempHpPersistence(p);commit(p.tempHp?`${p.name} HP: ${p.hp}/${p.maxHp} +${p.tempHp} Temporary HP`:`${p.name} HP: ${p.hp}/${p.maxHp}`);
}"""
    if new_hp not in text:
        if old_hp not in text: raise SystemExit(f'changeHp anchor drifted: {path}')
        text = text.replace(old_hp, new_hp, 1)

    old_scene = "function endScene(){ state.ui.scene+=1; state.ui.round=1; state.pokemon.forEach(p=>Object.keys(p.combatStages).forEach(k=>p.combatStages[k]=0)); commit(`Scene ${state.ui.scene}. Combat stages reset.`); }"
    new_scene = "async function endScene(){ state.ui.scene+=1; state.ui.round=1; for(const p of state.pokemon){Object.keys(p.combatStages).forEach(k=>p.combatStages[k]=0);if(p?.details?.speciesDefinitionId)await applyPokemonFormGameEventUi(p.id,{kind:'scene-end'},{silent:true,commitAfter:false});} commit(`Scene ${state.ui.scene}. Combat stages reset; Form scene-end hooks applied.`); }"
    combat_scene = "async function endScene(){ state.ui.scene+=1; state.ui.round=1; for(const p of state.pokemon){Object.keys(p.combatStages).forEach(k=>p.combatStages[k]=0);if(p?.details?.speciesDefinitionId)await applyPokemonFormGameEventUi(p.id,{kind:'scene-end'},{silent:true,commitAfter:false});} pokemonCombatOnSceneAdvance(); commit(`Scene ${state.ui.scene}. Combat stages reset; Form scene-end hooks applied.`); }"
    if new_scene not in text and combat_scene not in text:
        if old_scene not in text: raise SystemExit(f'endScene anchor drifted: {path}')
        text = text.replace(old_scene, new_scene, 1)

    battle_buttons = "<button class=\"btn ${state.ui.inCombat?'btn-danger':'btn-success'}\" onclick=\"setPokemonBattleState(${state.ui.inCombat?'false':'true'})\">${state.ui.inCombat?'End Battle':'Start Battle'}</button>"
    sequence = "<button class=\"btn btn-ghost\" onclick=\"nextRound()\">Next Round</button><button class=\"btn btn-ghost\" onclick=\"endScene()\">End Scene</button><button class=\"btn btn-ghost\" onclick=\"newDay()\">New Day</button>"
    if battle_buttons not in text:
        if sequence not in text: raise SystemExit(f'Battle-cycle buttons anchor drifted: {path}')
        text = text.replace(sequence, battle_buttons + sequence)

    forms_old = "${transformationCards}</div><div class=\"flow-note\"><strong>Persistence:</strong>"
    forms_new = "${transformationCards}</div>${pokemonFormLifecycleControls(forms,stateForm,p)}<div class=\"flow-note\"><strong>Persistence:</strong>"
    if forms_new not in text:
        if forms_old not in text: raise SystemExit(f'Forms manager lifecycle controls anchor drifted: {path}')
        text = text.replace(forms_old, forms_new, 1)

    move_start = text.index('function creatureMovesTab(p,data){')
    move_end = text.index('function abilitySourcePresentation(a){', move_start)
    move_region = text[move_start:move_end]
    if 'usePokemonMoveForForms' not in move_region:
        move_region_new = move_region.replace("const cards=(data.moves||[]).map(({record:m,definition:def,resolvedDamage:rd,effectiveAc,accuracyTrainingRanks=0})=>{", "const cards=(data.moves||[]).map(({record:m,definition:def,resolvedDamage:rd,effectiveAc,accuracyTrainingRanks=0},moveIndex)=>{", 1)
        marker = "${accuracyTrainingRanks?` · Accuracy Training applied`:''}</small></article>`;"
        replacement = "${accuracyTrainingRanks?` · Accuracy Training applied`:''}</small><button class=\"btn btn-ghost btn-small\" onclick=\"usePokemonMoveForForms('${p.id}',${moveIndex})\">Use Move</button></article>`;"
        if marker not in move_region_new: raise SystemExit(f'Move card action anchor drifted: {path}')
        move_region_new = move_region_new.replace(marker, replacement, 1)
        text = text[:move_start] + move_region_new + text[move_end:]

    ability_start = text.index('function creatureAbilitiesTab(p,data){')
    ability_end = text.index('function creatureSpeciesTab(', ability_start)
    ability_region = text[ability_start:ability_end]
    if 'usePokemonAbilityForForms' not in ability_region:
        ability_region_new = ability_region.replace("const cards=(data.abilities||[]).map(a=>{", "const cards=(data.abilities||[]).map((a,abilityIndex)=>{", 1)
        marker = "Definition not resolved in active Ruleset.'}</small></article>`"
        replacement = "Definition not resolved in active Ruleset.'}</small>${['schooling','power-construct'].includes(formEventSlug(a.name))?`<button class=\"btn btn-gold btn-small\" onclick=\"usePokemonAbilityForForms('${p.id}',${abilityIndex})\">Use Ability</button>`:''}</article>`"
        if marker not in ability_region_new: raise SystemExit(f'Ability card action anchor drifted: {path}')
        ability_region_new = ability_region_new.replace(marker, replacement, 1)
        text = text[:ability_start] + ability_region_new + text[ability_end:]

    if text != original:
        path.write_text(text, encoding='utf-8'); return True
    return False


def main() -> None:
    changed=[]
    for path in [WINDOWS_API,ANDROID_API]:
        if patch_api(path): changed.append(str(path.relative_to(REPO)))
    for path in EVENT_MODULES:
        if patch_event_module(path): changed.append(str(path.relative_to(REPO)))
    if patch_repository(): changed.append(str(REPOSITORY.relative_to(REPO)))
    if patch_lifecycle_augmenter(): changed.append(str(LIFECYCLE_AUGMENTER.relative_to(REPO)))
    for path in [WINDOWS_APP,ANDROID_APP]:
        if patch_client(path): changed.append(str(path.relative_to(REPO)))
    print({'changed':changed,'targets':8})


if __name__=='__main__':
    main()
