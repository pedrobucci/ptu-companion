#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
CLIENTS = [
    ROOT / 'static-preview' / 'app.js',
    REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'app.js',
]
DOC_JSON = REPO / 'docs' / 'data' / 'PTU_COMBAT_SESSION_LEDGER.json'
DOC_MD = REPO / 'docs' / 'PTU_COMBAT_SESSION_LEDGER.md'


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    if replacement in text:
        return text
    start_at = text.find(start)
    if start_at < 0:
        raise SystemExit(f'Manual-dice start anchor drifted: {label}')
    end_at = text.find(end, start_at)
    if end_at < 0:
        raise SystemExit(f'Manual-dice end anchor drifted: {label}')
    return text[:start_at] + replacement.rstrip() + '\n' + text[end_at:]


RANDOM_GUARD = r'''function pokemonCombatRandomInt(){throw new Error('Digital dice are disabled in Combat. Roll physical dice and enter the result.');}'''

DICE_HELPERS = r'''function pokemonCombatRollDiceExpression(){throw new Error('Digital damage rolling is disabled in Combat. Roll physical dice and enter the Damage Roll result.');}
function pokemonCombatDoubleDamageDiceExpression(expression){
  const raw=String(expression||'').replace(/\s+/g,'');if(!raw)return null;const m=raw.match(/^(\d+)d(\d+)([+-]\d+)?$/i);if(!m)return `${raw} twice`;
  const count=Number(m[1])*2,sides=Number(m[2]),flat=Number(m[3]||0)*2;return `${count}d${sides}${flat>0?`+${flat}`:flat<0?String(flat):''}`;
}'''

OPEN_MOVE = r'''async function pokemonCombatOpenMove(id,index){
  const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,row=(data?.moves||[])[Number(index)],p=pokemon(id);if(!row||!p)return toast('Move reference data is unavailable.','error');
  const available=pokemonCombatMoveAvailability(id,row);if(!available.valid)return toast(available.reason,'error');
  const def=row.definition||{},name=def.name||row.record?.name||'Move';if(pokemonCombatSlug(name)==='defense-curl'||(def.ac==null&&!row.resolvedDamage))return pokemonCombatUseNoRoll(id,index);
  const slug=pokemonCombatSlug(name),dynamic=slug==='rollout',rollState=pokemonCombatParticipant(id)?.moveState?.rollout||{nextDb:3};
  const damaging=!!row.resolvedDamage||['physical','special'].includes(String(def.category||def.class||'').toLowerCase());
  const baseDb=dynamic?Number(rollState.nextDb||3):Number(row.resolvedDamage?.baseDamageBase??def.damageBase??0),stab=Number(row.resolvedDamage?.stabDamageBaseBonus||0),finalDb=damaging?Math.max(1,Math.min(28,dynamic?baseDb+stab:Number(row.resolvedDamage?.finalDamageBase??baseDb+stab))):null;
  const chart=damaging?await pokemonCombatDamageChart(finalDb,row):null,diceExpr=chart?.rolled_damage||chart?.rolledDamage||row.resolvedDamage?.damageChart?.rolled_damage||row.resolvedDamage?.damageChart?.rolledDamage||null,critExpr=pokemonCombatDoubleDamageDiceExpression(diceExpr);
  const baseAc=def.ac==null?'None':String(row.effectiveAc??def.ac);
  const damageFields=damaging?`<label>Physical Damage Roll<input id="combat-manual-damage-roll" type="number" min="0" step="1" placeholder="required on a hit"></label><label>Damage actually taken by target<input id="combat-target-damage-dealt" type="number" min="0" step="1" placeholder="optional; use when the Move needs it"></label>`:'';
  const criticalField=damaging?`<label>Critical Hit?<select id="combat-critical-result"><option value="">Choose…</option><option value="no">No</option><option value="yes">Yes</option></select></label>`:'';
  modal(`<div class="flow-note"><strong>${esc(name)}</strong><small>${esc(available.frequency||'At-Will')} · ${esc(available.action)}${dynamic?` · current Rollout DB ${baseDb}`:''}${finalDb?` · final DB ${finalDb}`:''}</small></div><div class="form-grid"><label>Natural d20 · physical die<input id="combat-natural-roll" type="number" min="1" max="20" step="1" placeholder="${def.ac==null?'not required':'required'}"></label><label>Final attack result<select id="combat-hit-result"><option value="">Choose…</option><option value="hit">Hit</option><option value="miss">Miss</option></select></label>${criticalField}${damageFields}</div>${damaging&&diceExpr?`<div class="flow-note"><strong>Roll physical damage dice</strong><small>Normal: ${esc(diceExpr)}${critExpr?` · Critical: ${esc(critExpr)}`:''}. Enter the rolled Damage Base component only; the app adds this Pokémon's known attacking Stat and local bonuses afterward.</small></div>`:''}<div class="flow-note"><small>The Combat screen never generates attack or damage dice. Roll the natural d20 and all damage dice physically, then enter the results. The final Hit/Miss and Critical fields are authoritative because the opposing Pokémon/NPC remains abstract and may have effects this Companion does not know.</small></div><button class="btn btn-primary full" onclick="pokemonCombatResolveMove('${id}',${Number(index)})">Record ${esc(name)}</button>`,{title:`Combat · ${name}`,subtitle:'Physical dice only · record the outcome before spending action/frequency.'});
}'''

RESOLVE_MOVE = r'''async function pokemonCombatResolveMove(id,index){
  const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,row=(data?.moves||[])[Number(index)],p=pokemon(id);if(!row||!p)return toast('Move reference data is unavailable.','error');
  const available=pokemonCombatMoveAvailability(id,row);if(!available.valid)return toast(available.reason,'error');
  const def=row.definition||{},name=def.name||row.record?.name||'Move',slug=pokemonCombatSlug(name),ledger=pokemonCombatParticipant(id),damaging=!!row.resolvedDamage||['physical','special'].includes(String(def.category||def.class||'').toLowerCase());
  const naturalRaw=document.getElementById('combat-natural-roll')?.value,natural=naturalRaw===''||naturalRaw==null?null:Number(naturalRaw);if(natural!=null&&(!Number.isInteger(natural)||natural<1||natural>20))return toast('Natural d20 must be a physical die result from 1 to 20.','error');if(def.ac!=null&&natural==null)return toast('Enter the natural d20 result from the physical Accuracy die.','error');
  const hitRaw=String(document.getElementById('combat-hit-result')?.value||'');if(!['hit','miss'].includes(hitRaw))return toast('Confirm whether the Move hit or missed.','error');const hit=hitRaw==='hit';
  const criticalRaw=damaging?String(document.getElementById('combat-critical-result')?.value||''):'';if(damaging&&hit&&!['yes','no'].includes(criticalRaw))return toast('Confirm whether the hit was Critical.','error');const critical=!!(damaging&&hit&&criticalRaw==='yes');
  const manualDamageRaw=damaging?document.getElementById('combat-manual-damage-roll')?.value:null,manualDamage=manualDamageRaw===''||manualDamageRaw==null?null:Number(manualDamageRaw);if(damaging&&hit&&(manualDamage==null||!Number.isInteger(manualDamage)||manualDamage<0))return toast('Enter the physical Damage Roll result for this hit.','error');
  const dealtRaw=damaging?document.getElementById('combat-target-damage-dealt')?.value:null,targetDamage=dealtRaw===''||dealtRaw==null?null:Number(dealtRaw);if(targetDamage!=null&&(!Number.isInteger(targetDamage)||targetDamage<0))return toast('Damage actually taken by the target must be a non-negative whole number.','error');
  const action=pokemonCombatSpendAction(id,available.action);if(!action.valid)return toast(action.reason,'error');const freq=pokemonCombatSpendFrequency(id,available.key,available.frequency);if(!freq.valid)return toast(freq.reason,'error');
  let damage=null;if(hit&&damaging){const baseDb=slug==='rollout'?Number(ledger.moveState.rollout?.nextDb||3):Number(row.resolvedDamage?.baseDamageBase??def.damageBase??0),stab=Number(row.resolvedDamage?.stabDamageBaseBonus||0),finalDb=Math.max(1,Math.min(28,slug==='rollout'?baseDb+stab:Number(row.resolvedDamage?.finalDamageBase??baseDb+stab))),chart=await pokemonCombatDamageChart(finalDb,row),diceExpr=chart?.rolled_damage||chart?.rolledDamage||row.resolvedDamage?.damageChart?.rolled_damage||row.resolvedDamage?.damageChart?.rolledDamage||null,rolledExpression=critical?pokemonCombatDoubleDamageDiceExpression(diceExpr):diceExpr,stat=Number(row.resolvedDamage?.primaryStat?.value||0),mixed=Number(row.resolvedDamage?.mixedPowerBonus||0),knowsRoll=pokemonCombatKnowsRollMove(data),curl=pokemonCombatDefenseCurlModifier({curledUp:!!ledger.conditions.curledUp,moveName:name,knowsRollMove:knowsRoll}),bonus=Number(curl.damageBonus||0),total=Number(manualDamage||0)+stat+mixed+bonus;damage={baseDb,finalDb,diceExpr,rolledExpression,manualRoll:Number(manualDamage||0),stat,mixed,bonus,total,targetDamage};}
  if(slug==='rollout'){const usedDb=Number(damage?.baseDb??ledger.moveState.rollout?.nextDb??3);ledger.moveState.rollout=pokemonCombatRolloutAfterResult(ledger.moveState.rollout,hit,usedDb);}
  const accuracyText=natural==null?'no Accuracy Roll':`physical d20 ${natural}${def.ac!=null?` · Move AC ${row.effectiveAc??def.ac}`:''}`;let detail=`${p.name} used ${name} · ${accuracyText} · reported ${hit?(critical?'CRITICAL HIT':'HIT'):'MISS'} · ${action.spent}`;
  if(damage){detail+=` · DB ${damage.finalDb}${damage.rolledExpression?` · physical ${damage.rolledExpression}`:''} = ${damage.manualRoll} + Stat ${damage.stat}${damage.mixed?` + Mixed ${damage.mixed}`:''}${damage.bonus?` + Defense Curl ${damage.bonus}`:''} = ${damage.total} before unknown target defenses/effectiveness`;if(damage.targetDamage!=null)detail+=` · target actually took ${damage.targetDamage}`;}
  if(slug==='rollout')detail+=hit?` · next Rollout DB ${ledger.moveState.rollout.nextDb}`:' · Rollout chain reset to DB 3';pokemonCombatLog(id,critical?'Critical Hit':hit?'Move hit':'Move missed',detail,'move');await pokemonCombatDispatchMoveFormEvent(id,row);closeModal();await commit(detail);render();toast(hit?(critical?'Critical Hit recorded.':'Hit recorded.'):'Miss recorded.',hit?'success':'error');
}'''


def patch_client(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    original = text
    text = replace_between(text, 'function pokemonCombatRandomInt(', 'function pokemonCombatRollDiceExpression(', RANDOM_GUARD, f'{path}: random guard')
    text = replace_between(text, 'function pokemonCombatRollDiceExpression(', 'function pokemonCombatKnowsRollMove(', DICE_HELPERS, f'{path}: dice helpers')
    text = replace_between(text, 'function pokemonCombatOpenMove(', 'async function pokemonCombatDamageChart(', OPEN_MOVE, f'{path}: open Move')
    text = replace_between(text, 'async function pokemonCombatResolveMove(', 'function pokemonCombatMoveCard(', RESOLVE_MOVE, f'{path}: resolve Move')
    if text != original:
        path.write_text(text, encoding='utf-8')
        return True
    return False


def patch_docs() -> list[str]:
    changed: list[str] = []
    data = json.loads(DOC_JSON.read_text(encoding='utf-8'))
    data['schema_version'] = 2
    data['target_model'] = 'abstract; opposing creatures are not persisted or resolved as campaign entities'
    data['roll_resolution'] = {
        'physical_dice_only': True,
        'digital_rng': False,
        'accuracy_die': 'manual natural d20 result from a physical die when an Accuracy Roll exists',
        'automatic_hit_miss': False,
        'final_hit_miss': 'user-confirmed authoritative outcome',
        'critical_hit': 'user-confirmed authoritative outcome; natural d20 remains recorded for effect/critical-range rules',
        'damage_roll': 'manual physical Damage Base roll; the Companion adds only known local attacking Stat and local bonuses',
        'target_damage': 'optional user-entered actual damage taken by the abstract target for Move effects that depend on damage actually dealt',
    }
    rendered = json.dumps(data, indent=2, ensure_ascii=False) + '\n'
    if DOC_JSON.read_text(encoding='utf-8') != rendered:
        DOC_JSON.write_text(rendered, encoding='utf-8')
        changed.append(str(DOC_JSON.relative_to(REPO)))

    md = DOC_MD.read_text(encoding='utf-8')
    start = md.find('## Attack roll resolver')
    end = md.find('## First complex Move interaction:', start)
    if start < 0 or end < 0:
        raise SystemExit('Combat ledger documentation attack-resolver section drifted')
    replacement = '''## Physical-dice combat outcome resolver\n\n- **Combat never generates attack or damage dice.** Accuracy and Damage Rolls are always made with physical dice and entered manually.\n- When a Move has an Accuracy Roll, the natural d20 result is entered so Accuracy-triggered effects and Critical ranges can still be evaluated/audited.\n- Hit/Miss is confirmed by the player as the authoritative result because the target is intentionally abstract and may have Evasion, defensive Features, Shields, immunities, or GM-side effects unknown to this Companion.\n- Critical Hit is likewise confirmed explicitly; the natural d20 is retained in the log rather than replaced by a calculated total.\n- For damaging hits, the UI shows the PTU Damage Base dice expression and, when relevant, the doubled Critical expression. The player rolls those dice physically and enters the resulting Damage Roll.\n- The Companion may add only values it actually owns for the active Pokémon, such as its attacking Stat, Mixed Power bonus, or Defense Curl bonus. It does not invent target Defense, DR, type effectiveness, HP, or other opponent state.\n- `Damage actually taken by target` is an optional outcome value. Move-specific handlers can require it when the user's own Pokémon needs that external result, such as draining Moves that heal from damage actually dealt.\n- The opposing Pokémon/NPC is never persisted as a combat entity.\n\n'''
    md2 = md[:start] + replacement + md[end:]
    if md2 != md:
        DOC_MD.write_text(md2, encoding='utf-8')
        changed.append(str(DOC_MD.relative_to(REPO)))
    return changed


def main() -> None:
    clients = [str(path.relative_to(REPO)) for path in CLIENTS if patch_client(path)]
    docs = patch_docs()
    print({'manual_physical_dice_model': 1, 'clients_changed': clients, 'docs_changed': docs, 'digital_rng': False})


if __name__ == '__main__':
    main()
