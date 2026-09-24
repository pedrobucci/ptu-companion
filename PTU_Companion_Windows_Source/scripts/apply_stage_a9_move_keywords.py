from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP_PATHS = [
    ROOT / "PTU_Companion_Windows_Source/static-preview/app.js",
    ROOT / "PTU_Companion_Android_Tauri/www/app.js",
]
PACKAGE_PATHS = [
    (ROOT / "PTU_Companion_Windows_Source/package.json", "node scripts/verify_stage_a9_move_keywords.mjs"),
    (ROOT / "PTU_Companion_Android_Tauri/package.json", "node scripts/verify-stage-a9-move-keywords.mjs"),
]

CATALOG_BLOCK = r'''/* STAGE_A9_MOVE_KEYWORD_CATALOG_START */
const MOVE_KEYWORD_CATALOG=Object.freeze([
  {id:'aura',name:'Aura',sourcePage:'339',effect:'Creates an area around the user, usually a Burst or Cone. The Aura remains until the user is Knocked Out or leaves the field, and may be interacted with outside its creator’s turn when the Move allows.'},
  {id:'berry',name:'Berry',sourcePage:'339',effect:'Used by Natural Gift. The equipped Berry determines Natural Gift’s Type and Damage Base according to the stored Digestion Buff.'},
  {id:'blessing',name:'Blessing',sourcePage:'339',effect:'Only one Blessing may affect a target or area at a time unless a Move says otherwise; a new Blessing replaces the old one. Blessings can be deliberately attacked and dispelled by sufficiently strong Ghost- or Fairy-type damage.'},
  {id:'coat',name:'Coat',sourcePage:'339',effect:'A Coat may cover a target or area; only one Coat may apply at a time. A new Coat replaces the old one, and area Coats can be targeted and dispelled like Blessings.'},
  {id:'dash',name:'Dash',sourcePage:'339',effect:'As a free action before or after the Move, the user may shift up to half its Movement Capability (minimum 1) without provoking free strikes. This cannot be used if the user already took a Shift Action that round.'},
  {id:'double-strike',name:'Double Strike',sourcePage:'339',effect:'The attack hits twice and may use one or two targets. Each hit uses a reduced Damage Base from the Double Strike table; if the attack is a Critical Hit, both hits are Critical Hits.',reference:'Damage Base mapping: 1→1, 2→1, 3→2, 4→2, 5→3, 6→3, 7→4, 8→4, 9→5, 10→5, 11→6, 12→6, 13→7, 14→7, 15→7, 16→8, 17→8, 18→8, 19→9, 20→9, 21→10, 22→10, 23→10, 24→11, 25→11, 26→11, 27→12, 28→12.'},
  {id:'environ',name:'Environ',sourcePage:'339–340',effect:'The Move can only be used in one of its listed environments. Natural Gift uses the current environment to determine its damage Type.',reference:'Natural Gift environment Types: Forest/Urban → Grass; Beach/Desert → Ground; Wetlands/Ocean → Water; Arctic → Ice; Mountain/Cave → Rock; Building → Normal; Aerial → Flying; Thunderstorm → Electric.'},
  {id:'execute',name:'Execute',sourcePage:'340',effect:'May be declared Priority (Advanced) when the target is at or below 20% of its maximum Hit Points.'},
  {id:'exhaust',name:'Exhaust',sourcePage:'340',effect:'May be used only once per Scene. Direct Frequency-refresh effects cannot restore it, though rest or specially stated effects may allow another use.'},
  {id:'fling',name:'Fling',sourcePage:'340',effect:'Uses the user’s Held Item to determine a secondary effect on the target. The user does not receive the item’s benefit; the item is only destroyed if its normal use would consume it.',reference:'PTU 1.05 assigns different Fling effects to Food/Berries, Potions, Status-healing items, Evolution Stones, Held Items, and objects by weight.'},
  {id:'friendly',name:'Friendly',sourcePage:'340',effect:'Does not make an Accuracy Check and cannot miss, though Critical Hits are still rolled. It ignores several usual attack-interaction effects such as Evasion changes, concealment, and Interception.'},
  {id:'five-strike',name:'Five Strike',sourcePage:'340',effect:'Roll 1d8+1 to determine from one to five hits; total Damage Base is multiplied by the number of hits.',reference:'1 hit ×1 DB; 2 hits ×2 DB; 3 hits ×3 DB; 4 hits ×4 DB; 5 hits ×5 DB.'},
  {id:'groundsource',name:'Groundsource',sourcePage:'340',effect:'The user must be touching firm ground. It cannot be used while airborne, floating, or over deep water.'},
  {id:'hazard',name:'Hazard',sourcePage:'340',effect:'Sets a trap on a target, area, or on the user as a carried trap. If the attack also deals damage, that damage applies only the first round the Hazard affects a target.'},
  {id:'illusion',name:'Illusion',sourcePage:'340',effect:'Falsifies one or more senses, normally specified by the Move. Mean Look, Sky Drop, and Role Play are exceptions even though they use the Illusion keyword.'},
  {id:'interrupt',name:'Interrupt',sourcePage:'340',effect:'May be declared during another combatant’s turn when its trigger is met. The user normally spends the required action type unless the Move or trigger explicitly says otherwise.'},
  {id:'pass',name:'Pass',sourcePage:'340',effect:'Before rolling, the user may forgo the Move. Its Frequency is not spent and the user keeps the Standard Action.'},
  {id:'pledge',name:'Pledge',sourcePage:'341',effect:'After using a Pledge Move, the user cannot use another Pledge Move for 4 rounds.'},
  {id:'powder',name:'Powder',sourcePage:'341',effect:'On a successful Move, its effect remains on the user until the beginning of the user’s next turn.'},
  {id:'priority',name:'Priority',sourcePage:'341',effect:'May be declared on the user’s turn to act next in Initiative. Priority (Advanced) may be declared whenever; Priority (Limited) functions likewise but is usable only once per Scene.'},
  {id:'push',name:'Push',sourcePage:'341',effect:'Moves the target the listed number of meters. Unless stated otherwise, the target is pushed away from the user.'},
  {id:'reaction',name:'Reaction',sourcePage:'341',effect:'Used in response to a stated event, even outside the user’s turn, without consuming an action resource. A given trigger may be reacted to only once.'},
  {id:'recoil',name:'Recoil',sourcePage:'341',effect:'After a successful attack, the user loses Hit Points equal to one-third of the damage dealt, adjusted by any listed modifier. Recoil ignores defenses, cannot cause Injuries, and cannot reduce the user below 1 Hit Point.'},
  {id:'set-up',name:'Set-Up',sourcePage:'341',effect:'Requires both a Standard Action and Shift Action remaining. The Shift Action prepares a stated trigger; when it occurs, the user spends the Standard Action to resolve the reaction.'},
  {id:'shield',name:'Shield',sourcePage:'341',effect:'Activated as an Interrupt against its stated trigger. It spends a Standard Action and also forfeits the user’s Standard Action on the next turn; two Shield Moves cannot be used consecutively.'},
  {id:'smite',name:'Smite',sourcePage:'341',effect:'Cannot miss, but still rolls to check for a natural 20 Critical Hit. The target must still be in range; damage can be resisted, and the Move cannot be Intercepted or trigger effects that require a miss.'},
  {id:'social',name:'Social',sourcePage:'341',effect:'Uses a Social Skill instead of an Accuracy Check; the target may oppose with an appropriate Skill instead of Evasion. Parentheses restrict which Social Skill may be used, and the target normally must be able to see and hear the user.'},
  {id:'sonic',name:'Sonic',sourcePage:'341',effect:'Targets that are Deafened are immune. Otherwise the Move cannot be dodged.'},
  {id:'spirit-surge',name:'Spirit Surge',sourcePage:'341',effect:'When its triggering condition occurs, activating the effect is optional.'},
  {id:'trigger',name:'Trigger',sourcePage:'341',effect:'May be used only when its stated triggering condition is met; otherwise it behaves like a normal Move.'},
  {id:'vortex',name:'Vortex',sourcePage:'341',effect:'Targets in the vortex are Slowed and Trapped and lose Tick Hit Points at the beginning and end of their turns. The vortex ends under the conditions stated by the Move or when its user leaves play.'},
  {id:'weather',name:'Weather',sourcePage:'341–342',effect:'Changes the current Weather, replacing any existing Weather. Weather normally persists continuously or while sustained, and Moves may gain additional effects from particular Weather.'},
  {id:'weight-class',name:'Weight Class',sourcePage:'342',effect:'Uses the target’s Weight Class to determine the Move’s effect. PTU defines six Weight Classes from 1–25 lb (WC 1) through over 440 lb (WC 6).',reference:'WC 1: 1–25 lb / 0–11 kg; WC 2: 25–55 lb / 11–25 kg; WC 3: 55–110 lb / 25–50 kg; WC 4: 110–220 lb / 50–100 kg; WC 5: 220–440 lb / 100–200 kg; WC 6: over 440 lb / over 200 kg.'}
].map(entry=>Object.freeze({...entry,kind:'move_keywords',category:'Move Keyword',packName:'PTU Core 1.05',raw:Object.freeze({description:entry.effect,reference:entry.reference||'',source:'PTU Core 1.05'})})));
function moveKeywordCatalogEntry(id){return MOVE_KEYWORD_CATALOG.find(entry=>entry.id===id)||null;}
function localMoveKeywordRows(query=''){
  const needle=String(query||'').trim().toLowerCase();
  if(!needle)return [...MOVE_KEYWORD_CATALOG];
  return MOVE_KEYWORD_CATALOG.filter(entry=>`${entry.name} ${entry.effect} ${entry.reference||''}`.toLowerCase().includes(needle));
}
function moveKeywordSourceText(move={}){
  const payload=definitionPayload(move);
  const values=[payload.keyword,payload.keywords,payload.tags,payload.range,payload.frequency,payload.effect,move.keyword,move.keywords,move.tags,move.range,move.frequency,move.effect];
  return values.flatMap(value=>Array.isArray(value)?value:[value]).filter(value=>value!=null).map(value=>typeof value==='object'?JSON.stringify(value):String(value)).join(' ');
}
function moveKeywordEntries(move={}){
  const text=moveKeywordSourceText(move);
  if(!text.trim())return [];
  return MOVE_KEYWORD_CATALOG.filter(entry=>{
    const escaped=entry.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\\-/g,'[- ]');
    return new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`,'i').test(text);
  });
}
function moveKeywordReferenceHtml(move={}){
  const entries=moveKeywordEntries(move); if(!entries.length)return '';
  return `<div class="definition-tags move-keyword-tags"><strong>Move Keywords</strong>${entries.map(entry=>`<button type="button" class="mini-action" onclick="event.stopPropagation();openMoveKeywordInfo('${entry.id}')">${esc(entry.name)}</button>`).join('')}</div>`;
}
function openMoveKeywordInfo(id){
  const entry=moveKeywordCatalogEntry(id); if(!entry)return;
  modal(`<div class="definition-card"><div class="definition-tags">${chip('MOVE KEYWORD','chip-blue')} ${chip(`PTU Core 1.05 · p. ${entry.sourcePage}`,'chip-neutral')}</div><p>${esc(entry.effect)}</p>${entry.reference?`<div class="flow-note"><strong>Reference:</strong> ${esc(entry.reference)}</div>`:''}</div>`,{title:`Move Keyword · ${entry.name}`,subtitle:'PTU Core 1.05 keyword reference'});
}
/* STAGE_A9_MOVE_KEYWORD_CATALOG_END */
'''


def replace_once(text: str, old: str, new: str, path: Path) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one anchor in {path}, found {count}: {old[:100]!r}")
    return text.replace(old, new, 1)


def patch_app(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    changed = False

    if "['move_keywords','Move Keywords']" not in text:
        old = "  ['edges','Edges'],['poke_edges','Poké Edges'],['capabilities','Capabilities'],['items','Items']\n];"
        new = "  ['edges','Edges'],['poke_edges','Poké Edges'],['capabilities','Capabilities'],['items','Items'],\n  ['move_keywords','Move Keywords']\n];"
        text = replace_once(text, old, new, path)
        changed = True

    if "STAGE_A9_MOVE_KEYWORD_CATALOG_START" not in text:
        anchor = "];\nlet catalogState={available:false,loading:false,error:null,status:null,rulesets:[],kind:'species',query:'',rows:[],total:0,selected:null};"
        text = replace_once(text, anchor, "];\n" + CATALOG_BLOCK + "let catalogState={available:false,loading:false,error:null,status:null,rulesets:[],kind:'species',query:'',rows:[],total:0,selected:null};", path)
        changed = True

    if "catalogState.kind==='move_keywords'" not in text.split("async function refreshDefinitionRows(){", 1)[1].split("function scheduleDefinitionSearch", 1)[0]:
        old = "async function refreshDefinitionRows(){\n  if(!catalogState.available) return;"
        new = "async function refreshDefinitionRows(){\n  if(catalogState.kind==='move_keywords'){\n    const rows=localMoveKeywordRows(catalogState.query); catalogState.loading=false; catalogState.error=null; catalogState.rows=rows; catalogState.total=rows.length;\n    if(catalogState.selected){const current=moveKeywordCatalogEntry(catalogState.selected.definition?.id); catalogState.selected=current?{definition:current,versions:[]}:null;}\n    render(); return;\n  }\n  if(!catalogState.available) return;"
        text = replace_once(text, old, new, path)
        changed = True

    load_segment = text.split("async function loadDefinitionDetail(id){", 1)[1].split("async function setActiveRuleset", 1)[0]
    if "move_keywords" not in load_segment:
        old = "async function loadDefinitionDetail(id){\n  if(!catalogState.available) return;"
        new = "async function loadDefinitionDetail(id){\n  if(catalogState.kind==='move_keywords'){const entry=moveKeywordCatalogEntry(id); catalogState.selected=entry?{definition:entry,versions:[]}:null; render(); return;}\n  if(!catalogState.available) return;"
        text = replace_once(text, old, new, path)
        changed = True

    modal_segment = text.split("async function openRuleDefinitionModal", 1)[1].split("function closeModal", 1)[0]
    if "openMoveKeywordInfo" not in modal_segment:
        old = "async function openRuleDefinitionModal(kind,id,{title=null,subtitle=null}={}){\n  if(!kind||!id)return;"
        new = "async function openRuleDefinitionModal(kind,id,{title=null,subtitle=null}={}){\n  if(!kind||!id)return;\n  if(kind==='move_keywords'){openMoveKeywordInfo(id);return;}"
        text = replace_once(text, old, new, path)
        changed = True

    detail_segment = text.split("function definitionDetail(def){", 1)[1].split("function libraryScreen(){", 1)[0]
    if "d.kind==='move_keywords'" not in detail_segment:
        old = "  if(d.kind==='species'){"
        new = "  if(d.kind==='move_keywords'){\n    return `<div class=\"definition-detail\"><div class=\"definition-tags\">${chip('MOVE KEYWORD','chip-blue')} ${chip(`PTU Core 1.05 · p. ${d.sourcePage}`,'chip-neutral')}</div><h2>${esc(d.name)}</h2><p>${esc(d.effect||'')}</p>${d.reference?`<div class=\"flow-note\"><strong>Reference:</strong> ${esc(d.reference)}</div>`:''}</div>`;\n  }\n  if(d.kind==='species'){"
        text = replace_once(text, old, new, path)
        changed = True

    if "kind==='move_keywords'?MOVE_KEYWORD_CATALOG.length" not in text:
        old = "${esc(label)} <span>${counts[kind]||0}</span>"
        new = "${esc(label)} <span>${kind==='move_keywords'?MOVE_KEYWORD_CATALOG.length:(counts[kind]||0)}</span>"
        text = replace_once(text, old, new, path)
        changed = True

    creature_segment = text.split("function creatureMovesTab(p){", 1)[1].split("function creatureProgressionTab", 1)[0]
    if "moveKeywordReferenceHtml(def||payload||mv)" not in creature_segment:
        old = "const range=moveRangeText(payload)||mv.range||'—'; const effect=def?.effect||payload.effect||mv.effect||''; const src=moveSourceInfo(mv);"
        new = old + " const keywordHtml=moveKeywordReferenceHtml(def||payload||mv);"
        text = replace_once(text, old, new, path)
        old2 = "</dl>\n        <div class=\"move-reference-actions\">"
        new2 = "</dl>${keywordHtml}\n        <div class=\"move-reference-actions\">"
        text = replace_once(text, old2, new2, path)
        changed = True

    if "openMoveKeywordInfo,route" not in text:
        old = "Object.assign(window,{route,selectPokemon"
        new = "Object.assign(window,{openMoveKeywordInfo,route,selectPokemon"
        text = replace_once(text, old, new, path)
        changed = True

    if changed:
        path.write_text(text, encoding="utf-8")
        print(f"Patched {path.relative_to(ROOT)}")
    else:
        print(f"Already patched {path.relative_to(ROOT)}")


def patch_package(path: Path, verifier: str) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    verify = data.get("scripts", {}).get("verify")
    if not verify:
        raise RuntimeError(f"Missing scripts.verify in {path}")
    if verifier not in verify:
        data["scripts"]["verify"] = verify + " && " + verifier
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Updated {path.relative_to(ROOT)}")
    else:
        print(f"Verifier already present in {path.relative_to(ROOT)}")


for app in APP_PATHS:
    patch_app(app)
for package, verifier in PACKAGE_PATHS:
    patch_package(package, verifier)
