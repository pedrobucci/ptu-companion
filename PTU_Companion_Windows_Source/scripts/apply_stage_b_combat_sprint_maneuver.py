#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
CLIENTS = [ROOT / 'static-preview' / 'app.js', REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'app.js']
DOC_JSON = REPO / 'docs' / 'data' / 'PTU_COMBAT_SPRINT_MANEUVER.json'
DOC_MD = REPO / 'docs' / 'PTU_COMBAT_SPRINT_MANEUVER.md'
ABILITY_JSON = REPO / 'docs' / 'data' / 'PTU_COMBAT_ABILITY_ACTIONS.json'
ABILITY_MD = REPO / 'docs' / 'PTU_COMBAT_ABILITY_ACTIONS.md'
SESSION_JSON = REPO / 'docs' / 'data' / 'PTU_COMBAT_SESSION_LEDGER.json'
SESSION_MD = REPO / 'docs' / 'PTU_COMBAT_SESSION_LEDGER.md'


SPRINT_HELPERS = r'''function pokemonCombatSprintManeuverResourceSpec(){return pokemonCombatNonMoveSpec('maneuver','sprint','Sprint Maneuver','Standard Action','At-Will');}
function pokemonCombatSprintAbilityResourceSpec(){return pokemonCombatNonMoveSpec('ability','combat-sprint','Sprint Ability','Swift Action','Scene');}
function pokemonCombatSprintAbilityRow(data){return (data?.abilities||[]).find(row=>pokemonCombatSlug(row?.name||row?.definition?.name)==='sprint')||null;}
function pokemonCombatSprintAbilitySourceMatches(row){
  if(!row||pokemonCombatSlug(row?.name||row?.definition?.name)!=='sprint')return false;const effect=String(row.definition?.effect||'').toLowerCase().replace(/[^a-z0-9+]+/g,' ');return effect.includes('2 speed combat stages')&&effect.includes('overland speed')&&effect.includes('increased by +2');
}
function pokemonCombatSprintCompositeAvailability(id,data,{withAbility=false}={}){
  const maneuver=pokemonCombatSprintManeuverResourceSpec(),maneuverCheck=pokemonCombatNonMoveAvailability(id,maneuver);if(!maneuverCheck.valid)return {...maneuverCheck,maneuver,withAbility};if(!withAbility)return {valid:true,maneuver,maneuverCheck,withAbility:false};
  const abilityRow=pokemonCombatSprintAbilityRow(data);if(!abilityRow)return {valid:false,maneuver,withAbility:true,reason:'This Pokémon does not have the Sprint Ability.'};if(!pokemonCombatSprintAbilitySourceMatches(abilityRow))return {valid:false,maneuver,withAbility:true,abilityRow,reason:'The active Sprint Ability definition differs from the audited PTU source; use the Maneuver without automated Ability spending.'};
  const turn=pokemonCombatTurn(id);if(!turn)return {valid:false,maneuver,withAbility:true,abilityRow,reason:'No combat turn is available.'};if(turn.used?.swift)return {valid:false,maneuver,withAbility:true,abilityRow,reason:'Swift Action already spent. The Standard Action is reserved for the Sprint Maneuver and cannot also convert into this Swift Action.'};
  const ability=pokemonCombatSprintAbilityResourceSpec(),key=pokemonCombatNonMoveResourceKey(ability),frequency=pokemonCombatFrequencyAvailability(id,key,ability.frequency);if(!frequency.valid)return {...frequency,maneuver,ability,abilityRow,key,withAbility:true};return {valid:true,maneuver,ability,abilityRow,key,frequency,maneuverCheck,withAbility:true};
}
function pokemonCombatSprintSpendResources(id,data,{withAbility=false,log=true}={}){
  const check=pokemonCombatSprintCompositeAvailability(id,data,{withAbility});if(!check.valid)return check;const maneuverSpend=pokemonCombatSpendNonMoveResource(id,check.maneuver,{log:false});if(!maneuverSpend.valid)return maneuverSpend;if(!withAbility){if(log)pokemonCombatLog(id,'Resource spent','Sprint Maneuver · Standard Action.','resource');return {...check,maneuverSpend,transactions:[maneuverSpend.transaction].filter(Boolean)};}
  const abilitySpend=pokemonCombatSpendNonMoveResource(id,check.ability,{log:false});if(!abilitySpend.valid){if(maneuverSpend.transaction)pokemonCombatRefundNonMoveResourceCore(id,maneuverSpend.transaction.id,{log:false});return abilitySpend;}const participant=pokemonCombatParticipant(id,{create:false}),compositeId=`sprint-composite-${Number(participant?.resourceSequence||0)}`;if(maneuverSpend.transaction){maneuverSpend.transaction.compositeId=compositeId;maneuverSpend.transaction.compositeRole='maneuver';}if(abilitySpend.transaction){abilitySpend.transaction.compositeId=compositeId;abilitySpend.transaction.compositeRole='ability';}
  if(log)pokemonCombatLog(id,'Resources spent','Sprint Maneuver · Standard Action · Sprint Ability · Swift Action · Scene.','resource');return {...check,maneuverSpend,abilitySpend,compositeId,transactions:[maneuverSpend.transaction,abilitySpend.transaction].filter(Boolean)};
}
async function pokemonCombatUseSprintManeuver(id,useAbility=false){
  const p=pokemon(id),data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null;if(!p||!data)return toast('Sprint reference data is unavailable.','error');const spent=pokemonCombatSprintSpendResources(id,data,{withAbility:!!useAbility,log:true});if(!spent.valid)return toast(spent.reason||'Sprint resources are unavailable.','error');pokemonCombatLog(id,'Sprint Maneuver',`${p.name} used Sprint · Movement Speeds +50% for the rest of this turn.${useAbility?' Sprint Ability activated.':''}`,'maneuver');if(useAbility)pokemonCombatApplyCombatStages(id,{speed:2},'Sprint Ability');const detail=`${p.name} used Sprint Maneuver · Standard Action${useAbility?' · Sprint Ability · Scene · Swift Action · Speed +2 CS':''}`;await commit(detail);render();toast(useAbility?'Sprint Maneuver + Ability recorded.':'Sprint Maneuver recorded.','success');return {valid:true,withAbility:!!useAbility,spent};
}
function pokemonCombatSprintManeuverPanel(id,data){
  const abilityRow=pokemonCombatSprintAbilityRow(data),maneuver=pokemonCombatSprintCompositeAvailability(id,data,{withAbility:false}),combined=abilityRow?pokemonCombatSprintCompositeAvailability(id,data,{withAbility:true}):null;const button=(label,available,onclick,tone='btn-primary')=>`<button class="btn ${available.valid?tone:'btn-disabled'} full" ${available.valid?'':`disabled title="${esc(available.reason||'Unavailable')}"`} onclick="${onclick}">${label}</button>`;let ability='';
  if(abilityRow){const sourceOk=pokemonCombatSprintAbilitySourceMatches(abilityRow);ability=`<div class="flow-note"><strong>Sprint Ability</strong><small>${sourceOk?'Scene · Swift Action · when this Pokémon uses Sprint. Activate together to gain +2 Speed Combat Stages.':'The active Ruleset Sprint definition differs from the audited source; automated Ability activation is disabled.'}</small>${button('Sprint + Ability · Standard + Swift · Scene',combined||{valid:false,reason:'Unavailable'},`pokemonCombatUseSprintManeuver('${id}',true)`,'btn-gold')}</div>`;}
  return `<div class="ability-card-grid"><article class="ability-card"><div class="row-between"><div><h3>Sprint Maneuver</h3><div class="row-gap">${chip('Standard Action',maneuver.valid?'chip-blue':'chip-red')}${chip('Self','chip-green')}</div></div>${chip('CORE MANEUVER','chip-purple')}</div><p>Increase Movement Speeds by 50% for the rest of this turn.</p><small>PTU Core p.242 · transient movement effect is logged, not invented as a persistent capability mutation.</small>${button('Use Sprint · Standard Action',maneuver,`pokemonCombatUseSprintManeuver('${id}',false)`)}</article></div>${ability}<div class="flow-note"><small>The Sprint Ability passive +2 Overland Speed remains source information; this Combat layer automates only the triggered +2 Speed Combat Stages.</small></div>`;
}'''


def patch_client(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    original = text
    if 'function pokemonCombatSprintManeuverResourceSpec(' not in text:
        anchor = 'function pokemonCombatRolloutAfterResult('
        at = text.find(anchor)
        if at < 0:
            raise SystemExit(f'Sprint helper anchor drifted: {path}')
        text = text[:at] + SPRINT_HELPERS.rstrip() + '\n' + text[at:]
    section = "body+=section('MANEUVERS',data?pokemonCombatSprintManeuverPanel(active.id,data):'<p class=\"muted\">Maneuver data is loading from the active Ruleset.</p>');"
    if section not in text:
        anchor = "body+=section('AVAILABLE ABILITIES'"
        at = text.find(anchor)
        if at < 0:
            raise SystemExit(f'Sprint Combat section anchor drifted: {path}')
        text = text[:at] + section + text[at:]
    if text != original:
        path.write_text(text, encoding='utf-8')
        return True
    return False


def write_sprint_docs() -> list[str]:
    payload = {
        'schema_version': 1,
        'name': 'PTU Combat Sprint Maneuver + Ability',
        'shared_non_move_resource_ledger': True,
        'physical_dice_only': True,
        'target_model': 'self; no opponent entity',
        'maneuver': {
            'name': 'Sprint', 'source': 'Pokemon Tabletop United 1.05 Core p.242',
            'action_cost': 'Standard Action', 'class': 'Status', 'range': 'Self',
            'effect': 'Increase Movement Speeds by 50% for the rest of the turn',
            'runtime_tracking': 'transient effect is logged; no persistent Movement Capability mutation is invented',
        },
        'ability': {
            'name': 'Sprint', 'source': 'Pokemon Tabletop United 1.05 Core p.331',
            'frequency': 'Scene', 'action_cost': 'Swift Action',
            'trigger': 'user uses the Sprint Action during Combat',
            'triggered_effect': 'controlled user gains +2 Speed Combat Stages',
            'passive_effect': 'Overland Speed is always increased by +2',
            'passive_runtime': 'source information only in this layer; no new capability mutation is invented',
        },
        'composite_policy': {
            'activate_ability_with_maneuver': 'requires Standard Action for Sprint plus an independently available Swift Action and the Sprint Ability Scene use',
            'standard_to_swift_conversion': 'not allowed for the composite activation because the Standard Action is already reserved/spent by the Sprint Maneuver',
            'maneuver_only': 'remains available whenever Standard Action is available, including after Sprint Ability is exhausted',
            'transactions': 'Maneuver and Ability use distinct namespaced resource transactions linked by a compositeId',
            'refund': 'resource-only Undo may correct each transaction independently; it does not rewind the +2 Speed CS effect',
        },
        'non_goals': ['No opponent entity.', 'No generated dice.', 'No generic Ability prose parser.', 'No default .ptucp mutation.'],
    }
    rendered = json.dumps(payload, indent=2, ensure_ascii=False) + '\n'
    md = '''# PTU Combat Sprint Maneuver + Ability\n\nThis layer models Sprint as the first **composite Combat Maneuver + Ability** while reusing the shared per-Pokémon action/frequency ledger.\n\n## Sprint Maneuver\n\nPTU Core p.242 defines Sprint as a **Standard Action**, Status, Self Maneuver. It increases the user's Movement Speeds by 50% for the rest of the turn. The Companion spends the Standard Action and logs this transient effect; it does not invent a persistent Movement Capability mutation.\n\n## Sprint Ability\n\nPTU Core p.331 defines Sprint as **Scene – Swift Action**, triggered when the user uses the Sprint Action during Combat. Activating it gives the controlled Pokémon **+2 Speed Combat Stages**. The source also says Overland Speed is always increased by +2; that passive is retained as source information here rather than introducing a new capability mutation in the Combat layer.\n\n## Composite action economy\n\nActivating Sprint Ability together with the Sprint Maneuver requires **both** resources: the Maneuver's Standard Action and an independently available Swift Action, plus the Ability's Scene use. The existing Standard → Swift conversion is intentionally unavailable for this composite activation because that same Standard Action is already required by the Sprint Maneuver. This prevents undercounting the action economy.\n\nThe plain Sprint Maneuver remains usable when its Standard Action is available even if the Sprint Ability has already been used this Scene or the Swift Action is unavailable. Scene reset restores the Ability frequency normally.\n\n## Resource transactions / correction\n\nThe Maneuver and Ability use separate namespaced resource transactions (`maneuver:sprint` versus `ability:combat-sprint`) and are linked by a composite identifier when activated together. Existing resource Undo can correct either spend independently. As with the other non-Move correction controls, Undo restores resources only; it does not rewind the already-applied +2 Speed Combat Stages.\n\n## Conservative boundary\n\nNo target entity is needed, no random roll is generated, and no generic Ability-effect parser is introduced. Automation is enabled only when the active Sprint Ability matches the audited source signature.\n'''
    changed = []
    if not DOC_JSON.exists() or DOC_JSON.read_text(encoding='utf-8') != rendered:
        DOC_JSON.write_text(rendered, encoding='utf-8'); changed.append(str(DOC_JSON.relative_to(REPO)))
    if not DOC_MD.exists() or DOC_MD.read_text(encoding='utf-8') != md:
        DOC_MD.write_text(md, encoding='utf-8'); changed.append(str(DOC_MD.relative_to(REPO)))
    return changed


def patch_existing_docs() -> list[str]:
    changed = []
    ability = json.loads(ABILITY_JSON.read_text(encoding='utf-8'))
    deferred = ability.setdefault('deferred_conflicting_or_composite', {})
    deferred['sprint'] = 'integrated by the composite Sprint Maneuver layer: Standard Action Maneuver + Scene – Swift Action Ability; it is not exposed as a standalone Ability action'
    rendered = json.dumps(ability, indent=2, ensure_ascii=False) + '\n'
    if ABILITY_JSON.read_text(encoding='utf-8') != rendered:
        ABILITY_JSON.write_text(rendered, encoding='utf-8'); changed.append(str(ABILITY_JSON.relative_to(REPO)))

    md = ABILITY_MD.read_text(encoding='utf-8')
    old = 'Sprint is also deferred even though its Ability text agrees across supplied sources: its trigger is the separate Sprint Maneuver, which costs a Standard Action in PTU Core, and that Maneuver is not yet modeled in this Ability action surface.'
    new = 'Sprint is handled by the separate composite Sprint Maneuver layer: the Core Maneuver spends its Standard Action and the optional Sprint Ability spends its own Scene – Swift Action without undercounting either resource. See `PTU_COMBAT_SPRINT_MANEUVER.md`.'
    md2 = md.replace(old, new)
    if md2 != md:
        ABILITY_MD.write_text(md2, encoding='utf-8'); changed.append(str(ABILITY_MD.relative_to(REPO)))

    session = json.loads(SESSION_JSON.read_text(encoding='utf-8'))
    kinds = session.setdefault('shared_resources', {}).setdefault('non_move_sources', {}).setdefault('kinds', [])
    if 'Maneuver' not in kinds: kinds.append('Maneuver')
    automation = session.setdefault('ability_action_automation', {})
    automation['deferred_composite'] = [x for x in automation.get('deferred_composite', []) if x != 'Sprint']
    automation['composite_integrations'] = sorted(set(automation.get('composite_integrations', []) + ['Sprint']))
    session['maneuver_automation'] = {
        'model_version': 1,
        'enabled_subset': ['Sprint'],
        'source': 'Pokemon Tabletop United 1.05 Core p.242 / Sprint Ability p.331',
        'shared_resource_ledger': True,
        'composite_ability': 'Sprint',
        'plain_maneuver_action': 'Standard Action',
        'ability_cost': 'Scene – Swift Action',
        'standard_to_swift_during_composite': False,
    }
    srendered = json.dumps(session, indent=2, ensure_ascii=False) + '\n'
    if SESSION_JSON.read_text(encoding='utf-8') != srendered:
        SESSION_JSON.write_text(srendered, encoding='utf-8'); changed.append(str(SESSION_JSON.relative_to(REPO)))

    smd = SESSION_MD.read_text(encoding='utf-8')
    old_line = '- Prime Fury, Hydration, Ice Body, and Regal Challenge remain manual because supplied definitions conflict. Sprint remains deferred until its triggering Standard Action Sprint Maneuver can be represented without undercounting action economy.'
    new_line = '- Prime Fury, Hydration, Ice Body, and Regal Challenge remain manual because supplied definitions conflict. **Sprint is now the first composite Maneuver + Ability integration**: Sprint spends a Standard Action, while optional Sprint Ability activation separately spends `Scene – Swift Action`; the Standard Action cannot be reused as the Swift conversion in that composite activation.'
    smd2 = smd.replace(old_line, new_line)
    if smd2 != smd:
        SESSION_MD.write_text(smd2, encoding='utf-8'); changed.append(str(SESSION_MD.relative_to(REPO)))
    return changed


def main() -> None:
    clients = [str(path.relative_to(REPO)) for path in CLIENTS if patch_client(path)]
    docs = write_sprint_docs() + patch_existing_docs()
    print({'combat_sprint_model': 1, 'clients_changed': clients, 'docs_changed': docs, 'maneuver_action': 'Standard Action', 'ability_cost': 'Scene – Swift Action', 'speed_cs': 2, 'digital_rng': False})


if __name__ == '__main__':
    main()
