#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
CLIENTS = [ROOT / 'static-preview' / 'app.js', REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'app.js']
DOC_JSON = REPO / 'docs' / 'data' / 'PTU_COMBAT_ABILITY_ACTIONS.json'
DOC_MD = REPO / 'docs' / 'PTU_COMBAT_ABILITY_ACTIONS.md'


ABILITY_HELPERS = r'''const POKEMON_COMBAT_ABILITY_ACTION_ALLOWLIST=Object.freeze({
  'dodge':{label:'Dodge',actionCost:'Free Action',frequency:'Daily',trigger:'The user is hit by a Damaging Move',effectKind:'abstract-miss',source:'Pokemon Tabletop United 1.05 Core p.316'},
  'parry':{label:'Parry',actionCost:'Free Action',frequency:'Scene',trigger:'The user is hit by a Melee Attack',effectKind:'abstract-miss',source:'Pokemon Tabletop United 1.05 Core p.325'},
  'effect-spore':{label:'Effect Spore',actionCost:'Free Action',frequency:'Scene',trigger:'The user is hit by a Melee Attack',effectKind:'abstract-status-roll',requiresPhysicalD6:true,source:'Pokemon Tabletop United 1.05 Core p.316'},
  'stalwart':{label:'Stalwart',actionCost:'Free Action',frequency:'Scene',trigger:'The user receives Massive Damage',effectKind:'self-stages',stageChanges:{attack:1,spAttack:1,defense:1,spDefense:1},source:'New Abilities and Moves p.3'},
});
function pokemonCombatAbilityActionSpec(rowOrName){
  const name=typeof rowOrName==='string'?rowOrName:rowOrName?.name||rowOrName?.definition?.name||'';const slug=pokemonCombatSlug(name),base=POKEMON_COMBAT_ABILITY_ACTION_ALLOWLIST[slug];if(!base)return null;
  return {...base,slug,resource:pokemonCombatNonMoveSpec('ability',`combat-${slug}`,base.label,base.actionCost,base.frequency)};
}
function pokemonCombatAbilityActionSourceMatches(row,spec=pokemonCombatAbilityActionSpec(row)){
  if(!row||!spec)return false;const effect=String(row.definition?.effect||'').toLowerCase().replace(/[^a-z0-9+]+/g,' ');
  if(spec.slug==='dodge')return effect.includes('triggering move instead misses');
  if(spec.slug==='parry')return effect.includes('attack instead misses');
  if(spec.slug==='effect-spore')return effect.includes('roll 1d6')&&effect.includes('poison')&&effect.includes('paraly')&&effect.includes('sleep');
  if(spec.slug==='stalwart')return effect.includes('attack')&&effect.includes('special attack')&&effect.includes('defense')&&effect.includes('special defense')&&(effect.includes('increase by 1 cs')||effect.includes('increase by 1 combat stage'));
  return false;
}
function pokemonCombatEffectSporeStatus(physicalD6){const roll=Number(physicalD6);if(!Number.isInteger(roll)||roll<1||roll>6)return null;if(roll<=2)return 'Poisoned';if(roll<=4)return 'Paralyzed';return 'Asleep';}
function pokemonCombatAbilityActionAvailability(id,row){
  const spec=pokemonCombatAbilityActionSpec(row);if(!spec)return {valid:false,reason:'This Ability has no source-explicit Combat automation.',spec:null};if(!pokemonCombatAbilityActionSourceMatches(row,spec))return {valid:false,reason:'The active Ruleset definition differs from the audited source signature; use it manually.',spec};
  const resource=pokemonCombatNonMoveAvailability(id,spec.resource);return {...resource,spec};
}
function pokemonCombatAbilityActionCard(id,row,index){
  const spec=pokemonCombatAbilityActionSpec(row);if(!spec)return '';const available=pokemonCombatAbilityActionAvailability(id,row),def=row.definition||{},roll=spec.requiresPhysicalD6?chip('physical d6','chip-gold'):'';
  return `<article class="ability-card"><div class="row-between"><div><h3>${esc(spec.label)}</h3><div class="row-gap">${chip(esc(spec.frequency),available.valid?'chip-green':'chip-red')}${chip(esc(spec.actionCost),'chip-blue')}${roll}</div></div>${chip('SOURCE-EXPLICIT','chip-purple')}</div><p>${esc(def.effect||'No resolved effect text available.')}</p><small>Trigger: ${esc(spec.trigger)} · ${esc(spec.source)}</small>${available.valid?'':`<div class="builder-validation bad">${esc(available.reason||'Unavailable')}</div>`}<button class="btn ${available.valid?'btn-primary':'btn-disabled'} full" ${available.valid?'':'disabled'} onclick="pokemonCombatOpenAbilityAction('${id}',${Number(index)})">Use ${esc(spec.label)}</button></article>`;
}
function pokemonCombatAbilityActionPanel(id,data){
  const cards=(data?.abilities||[]).map((row,index)=>pokemonCombatAbilityActionCard(id,row,index)).filter(Boolean);return cards.length?`<div class="ability-card-grid">${cards.join('')}</div><div class="flow-note"><small>Only audited source-explicit Abilities appear here. Triggers are confirmed manually; opponent state remains abstract and all random rolls remain physical.</small></div>`:'<p class="muted">No audited source-explicit Combat Ability actions are available for this Pokémon.</p>';
}
async function pokemonCombatOpenAbilityAction(id,index){
  const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,row=(data?.abilities||[])[Number(index)],p=pokemon(id);if(!row||!p)return toast('Ability reference data is unavailable.','error');const available=pokemonCombatAbilityActionAvailability(id,row);if(!available.valid)return toast(available.reason,'error');const spec=available.spec;
  const rollField=spec.requiresPhysicalD6?`<label>Effect roll · physical d6<input id="combat-ability-physical-d6" type="number" min="1" max="6" step="1" placeholder="required"></label>`:'';
  modal(`<div class="flow-note"><strong>${esc(spec.label)}</strong><small>${esc(spec.frequency)} · ${esc(spec.actionCost)} · ${esc(spec.trigger)}</small></div><div class="form-grid"><label>Did the source trigger occur?<select id="combat-ability-trigger-confirm"><option value="">Choose…</option><option value="yes">Yes</option><option value="no">No</option></select></label>${rollField}</div><div class="flow-note"><small>${spec.effectKind==='abstract-miss'?'The triggering attack will be recorded as missing; no opponent entity is created.':spec.effectKind==='abstract-status-roll'?'Roll the d6 physically. The resulting status is logged against the abstract attacker only.':'Only the controlled Pokémon state is changed.'}</small></div><button class="btn btn-primary full" onclick="pokemonCombatResolveAbilityAction('${id}',${Number(index)})">Apply ${esc(spec.label)}</button>`,{title:`Combat Ability · ${spec.label}`,subtitle:'Source-explicit Ability action · physical dice only.'});
}
async function pokemonCombatResolveAbilityAction(id,index){
  const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,row=(data?.abilities||[])[Number(index)],p=pokemon(id);if(!row||!p)return toast('Ability reference data is unavailable.','error');const available=pokemonCombatAbilityActionAvailability(id,row);if(!available.valid)return toast(available.reason,'error');const spec=available.spec,trigger=String(document.getElementById('combat-ability-trigger-confirm')?.value||'');if(trigger!=='yes')return toast('Confirm that the Ability trigger occurred before spending its resource.','error');
  const rawD6=document.getElementById('combat-ability-physical-d6')?.value,physicalD6=rawD6===''||rawD6==null?null:Number(rawD6);if(spec.requiresPhysicalD6&&pokemonCombatEffectSporeStatus(physicalD6)==null)return toast('Enter the physical d6 result from 1 to 6.','error');
  const spend=pokemonCombatSpendNonMoveResource(id,spec.resource,{log:false});if(!spend.valid)return toast(spend.reason||'Ability resource could not be spent.','error');let outcome='';
  if(spec.effectKind==='self-stages'){pokemonCombatApplyCombatStages(id,spec.stageChanges,spec.label);outcome='Attack, Special Attack, Defense and Special Defense +1 CS';}
  else if(spec.effectKind==='abstract-miss'){outcome='triggering attack treated as a miss';pokemonCombatLog(id,'Defensive Ability',`${p.name} used ${spec.label}; ${outcome}.`,'ability');}
  else if(spec.effectKind==='abstract-status-roll'){const status=pokemonCombatEffectSporeStatus(physicalD6);outcome=`physical d6 ${physicalD6} · abstract attacker ${status}`;pokemonCombatLog(id,'Ability effect roll',`${p.name} used Effect Spore · ${outcome}. No opponent state was persisted.`,'ability');}
  if(spend.transaction)pokemonCombatLog(id,'Resource spent',`${spec.label} · ${spend.action?.spent||spec.actionCost}${spend.trackedFrequency?` · ${spec.frequency}`:''}.`,'resource');const detail=`${p.name} used ${spec.label} · ${outcome} · ${spend.spentLabel||spec.actionCost}`;closeModal();await commit(detail);render();toast(`${spec.label} recorded.`,'success');return {valid:true,spec,outcome,physicalD6,transaction:spend.transaction||null};
}'''


def patch_client(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    original = text
    marker = 'const POKEMON_COMBAT_ABILITY_ACTION_ALLOWLIST='
    if marker not in text:
        anchor = 'function pokemonCombatRolloutAfterResult('
        at = text.find(anchor)
        if at < 0:
            raise SystemExit(f'Ability Action helper anchor drifted: {path}')
        text = text[:at] + ABILITY_HELPERS.rstrip() + '\n' + text[at:]
    ability_section = "body+=section('AVAILABLE ABILITIES',data?pokemonCombatAbilityActionPanel(active.id,data):'<p class=\"muted\">Ability definitions are loading from the active Ruleset.</p>');"
    if ability_section not in text:
        anchor = "body+=section('AVAILABLE MOVES',data?`<div class=\"known-move-grid\">"
        at = text.find(anchor)
        if at < 0:
            raise SystemExit(f'Ability Action Combat section anchor drifted: {path}')
        text = text[:at] + ability_section + text[at:]
    if text != original:
        path.write_text(text, encoding='utf-8')
        return True
    return False


def write_docs() -> list[str]:
    payload = {
        'schema_version': 1,
        'name': 'PTU Combat Ability Actions',
        'shared_non_move_resource_ledger': True,
        'target_model': 'abstract',
        'physical_dice_only': True,
        'source_guard': 'active Ability effect text must match the audited conservative signature before automation is exposed',
        'allowlist': {
            'dodge': {'action_cost': 'Free Action', 'frequency': 'Daily', 'trigger': 'user is hit by a Damaging Move', 'effect': 'triggering Move instead misses', 'source': 'Pokemon Tabletop United 1.05 Core p.316'},
            'parry': {'action_cost': 'Free Action', 'frequency': 'Scene', 'trigger': 'user is hit by a Melee Attack', 'effect': 'attack instead misses', 'source': 'Pokemon Tabletop United 1.05 Core p.325'},
            'effect_spore': {'action_cost': 'Free Action', 'frequency': 'Scene', 'trigger': 'user is hit by a Melee Attack', 'physical_roll': '1d6', 'effect': {'1-2': 'abstract attacker Poisoned', '3-4': 'abstract attacker Paralyzed', '5-6': 'abstract attacker Asleep'}, 'persist_target_state': False, 'source': 'Pokemon Tabletop United 1.05 Core p.316'},
            'stalwart': {'action_cost': 'Free Action', 'frequency': 'Scene', 'trigger': 'user receives Massive Damage', 'effect': 'controlled user Attack, Special Attack, Defense and Special Defense +1 CS', 'source': 'New Abilities and Moves p.3'},
        },
        'resolved_source_actions': {
            'prime_fury': {'action_cost': 'Swift Action', 'frequency': 'Scene', 'effect': 'controlled user becomes Enraged; Attack and Special Attack +1 CS', 'source': 'February 2016 Playtest Packet p.8'},
            'hydration': {'action_cost': 'Swift Action', 'frequency': 'Scene (ignored during Rainy Weather)', 'effect': 'cure one manually tracked Status Affliction', 'weather': 'Rainy Weather ignores frequency but not Swift Action', 'source': 'February 2016 Playtest Packet p.6'},
            'ice_body': {'action_cost': 'Swift Action', 'frequency': 'Daily x5', 'effect': 'heal one Tick (1/10 max HP); usable below 50% HP or in Hailing Weather; immune to HP loss from Hail', 'source': 'February 2016 Playtest Packet p.6; PTU Core p.237 (Tick)'},
        },
        'deferred_conflicting_or_composite': {
            'regal_challenge': 'Core definition is active but requires a physical AC4 attack against an abstract target',
            'sprint': 'Ability trigger is use of the Sprint Maneuver; the Sprint Maneuver itself costs a Standard Action and is not yet modeled in the Ability action surface',
        },
        'non_goals': ['No generic Ability prose interpreter.', 'No enemy/NPC entity or persistent target status.', 'No generated dice.', 'Resource Undo does not rewind Ability effects.', 'No default .ptucp mutation.'],
    }
    rendered = json.dumps(payload, indent=2, ensure_ascii=False) + '\n'
    md = '''# PTU Combat Ability Actions\n\nThis layer exposes an explicit allowlist of **source-backed Pokémon Abilities** in the Combat screen. It reuses the same per-Pokémon action/frequency ledger already used by Moves and Form actions. It does not parse arbitrary Ability prose.\n\n## Audited allowlist\n\n- **Dodge** — `Daily – Free Action`; when the user is hit by a Damaging Move, the triggering Move instead misses. The trigger is confirmed manually and no attacker entity is created. Source: PTU Core p.316.\n- **Parry** — `Scene – Free Action`; when the user is hit by a Melee Attack, the attack instead misses. The trigger is confirmed manually and no attacker entity is created. Source: PTU Core p.325.\n- **Effect Spore** — `Scene – Free Action`; when the user is hit by a Melee Attack, roll **1d6**. The roll is always physical/manual: 1–2 Poisoned, 3–4 Paralyzed, 5–6 Asleep. The result is logged for the abstract attacker only; no opponent status record is persisted. Source: PTU Core p.316.\n- **Stalwart** — `Scene – Free Action, Reaction`; when the user receives Massive Damage, its Attack, Special Attack, Defense and Special Defense each rise by +1 Combat Stage. Source: New Abilities and Moves p.3.\n\n## Source signature guard\n\nAutomation is enabled only when the active Ruleset Ability effect still matches the conservative signature audited above. A content pack that replaces one of these Ability definitions with materially different text leaves the Ability manual instead of silently applying the wrong mechanics.\n\n## Physical-dice and abstract-target invariants\n\nEffect Spore never rolls digitally. The player rolls the d6 physically and enters the result. Dodge and Parry record only that the triggering attack is treated as a miss. Effect Spore records only the resulting status label against an abstract attacker. No enemy HP, defenses, conditions, action ledger or entity is created.\n\n## Shared resource / Undo behavior\n\nAbility frequency and action costs use `pokemonCombatSpendNonMoveResource`, including source-keyed Scene/Daily counters and the existing correction/refund UI. `Undo` corrects only the action/frequency spend; it deliberately does not rewind Stalwart Combat Stages or an already-recorded abstract outcome.\n\n## Conservative exclusions\n\nPrime Fury, Hydration, Ice Body and Regal Challenge are not automated here because the supplied Core/playtest definitions conflict. Sprint is also deferred even though its Ability text agrees across supplied sources: its trigger is the separate Sprint Maneuver, which costs a Standard Action in PTU Core, and that Maneuver is not yet modeled in this Ability action surface.\n'''
    md = md.replace(
        '## Conservative exclusions\n\nPrime Fury, Hydration, Ice Body and Regal Challenge are not automated here because the supplied Core/playtest definitions conflict. Sprint is also deferred even though its Ability text agrees across supplied sources: its trigger is the separate Sprint Maneuver, which costs a Standard Action in PTU Core, and that Maneuver is not yet modeled in this Ability action surface.',
        '## Source-precedence integration\n\n**Prime Fury** resolves to the February 2016 definition: `Scene – Swift Action`, becoming Enraged and gaining +1 Attack and +1 Special Attack Combat Stage. It is an explicit controlled-Pokémon action using the same ledger; Undo remains resource-only.\n\n## Resolved February 2016 actions\n\n- **Hydration** — `Scene – Swift Action`; cures one Status Affliction. During Rainy Weather its frequency is ignored, but the Swift Action remains. Weather and the supported Status Afflictions are tracked explicitly; no prose parser or inferred condition detection is used.\n- **Ice Body** — `Daily x5 – Swift Action`; heals one Tick (1/10 maximum HP, rounded down to whole HP with a minimum of 1). Usable only below 50% HP or during Hail. Its Hail HP-loss immunity is displayed as a rules reminder; damage resolution remains manual. Source: February 2016 Playtest Packet p.6; Tick value from PTU Core p.237.\n\nThese later definitions supersede the earlier Core definitions under the documented source order. Both use the shared ledger; resource Undo does not rewind cured afflictions or HP.\n\n## Conservative exclusions\n\nRegal Challenge retains its Core definition but remains gated pending a physical AC4 attack against an abstract target. Sprint is deferred: its trigger is the Sprint Maneuver, which costs a Standard Action in PTU Core, and that Maneuver is not yet modeled in this Ability action surface.'
    )
    changed: list[str] = []
    if not DOC_JSON.exists() or DOC_JSON.read_text(encoding='utf-8') != rendered:
        DOC_JSON.write_text(rendered, encoding='utf-8'); changed.append(str(DOC_JSON.relative_to(REPO)))
    if not DOC_MD.exists() or DOC_MD.read_text(encoding='utf-8') != md:
        DOC_MD.write_text(md, encoding='utf-8'); changed.append(str(DOC_MD.relative_to(REPO)))
    return changed


def main() -> None:
    clients = [str(path.relative_to(REPO)) for path in CLIENTS if patch_client(path)]
    docs = write_docs()
    print({'combat_ability_action_model': 1, 'allowlist': ['Dodge', 'Parry', 'Effect Spore', 'Stalwart', 'Hydration', 'Ice Body'], 'clients_changed': clients, 'docs_changed': docs, 'physical_dice_only': True, 'target_model': 'abstract'})


if __name__ == '__main__':
    main()
