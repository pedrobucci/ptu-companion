from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = ROOT / "PTU_Companion_Windows_Source/rules/move-keywords-core-1.05.json"
APP_PATHS = [
    ROOT / "PTU_Companion_Windows_Source/static-preview/app.js",
    ROOT / "PTU_Companion_Android_Tauri/www/app.js",
]
PACKAGE_PATHS = [
    (ROOT / "PTU_Companion_Windows_Source/package.json", "node scripts/verify_stage_a9_move_keywords.mjs"),
    (ROOT / "PTU_Companion_Android_Tauri/package.json", "node scripts/verify-stage-a9-move-keywords.mjs"),
]


def replace_once(text: str, old: str, new: str, path: Path) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one anchor in {path}, found {count}: {old[:100]!r}")
    return text.replace(old, new, 1)


def sub_once(text: str, pattern: str, replacement: str, path: Path) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE)
    if count != 1:
        raise RuntimeError(f"Expected one regex anchor in {path}, found {count}: {pattern!r}")
    return updated


def build_catalog_block() -> str:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    if len(catalog) != 33:
        raise RuntimeError(f"Expected 33 PTU Core Move Keywords, found {len(catalog)}")
    payload = json.dumps(catalog, ensure_ascii=False, separators=(",", ":"))
    return f'''/* STAGE_A9_MOVE_KEYWORD_CATALOG_START */
const MOVE_KEYWORD_CATALOG=Object.freeze({payload}.map(entry=>Object.freeze({{...entry,kind:'move_keywords',category:'Move Keyword',packName:'PTU Core 1.05',raw:Object.freeze({{description:entry.effect,reference:entry.reference||'',source:'PTU Core 1.05'}})}})));
function moveKeywordCatalogEntry(id){{return MOVE_KEYWORD_CATALOG.find(entry=>entry.id===id)||null;}}
function localMoveKeywordRows(query=''){{
  const needle=String(query||'').trim().toLowerCase();
  if(!needle)return [...MOVE_KEYWORD_CATALOG];
  return MOVE_KEYWORD_CATALOG.filter(entry=>`${{entry.name}} ${{entry.effect}} ${{entry.reference||''}}`.toLowerCase().includes(needle));
}}
function moveKeywordSourceText(move={{}}){{
  const payload=definitionPayload(move);
  const values=[payload.keyword,payload.keywords,payload.tags,payload.range,payload.frequency,payload.effect,move.keyword,move.keywords,move.tags,move.range,move.frequency,move.effect];
  return values.flatMap(value=>Array.isArray(value)?value:[value]).filter(value=>value!=null).map(value=>typeof value==='object'?JSON.stringify(value):String(value)).join(' ');
}}
function moveKeywordEntries(move={{}}){{
  const text=moveKeywordSourceText(move); if(!text.trim())return [];
  return MOVE_KEYWORD_CATALOG.filter(entry=>{{
    const escaped=entry.name.replace(/[.*+?^${{}}()|[\\]\\\\]/g,'\\\\$&').replace(/\\\\-/g,'[- ]');
    return new RegExp(`(^|[^A-Za-z])${{escaped}}([^A-Za-z]|$)`,'i').test(text);
  }});
}}
function moveKeywordReferenceHtml(move={{}}){{
  const entries=moveKeywordEntries(move); if(!entries.length)return '';
  return `<div class="definition-tags move-keyword-tags"><strong>Move Keywords</strong>${{entries.map(entry=>`<button type="button" class="mini-action" onclick="event.stopPropagation();openMoveKeywordInfo('${{entry.id}}')">${{esc(entry.name)}}</button>`).join('')}}</div>`;
}}
function openMoveKeywordInfo(id){{
  const entry=moveKeywordCatalogEntry(id); if(!entry)return;
  modal(`<div class="definition-card"><div class="definition-tags">${{chip('MOVE KEYWORD','chip-blue')}} ${{chip(`PTU Core 1.05 · p. ${{entry.sourcePage}}`,'chip-neutral')}}</div><p>${{esc(entry.effect)}}</p>${{entry.reference?`<div class="flow-note"><strong>Reference:</strong> ${{esc(entry.reference)}}</div>`:''}}</div>`,{{title:`Move Keyword · ${{entry.name}}`,subtitle:'PTU Core 1.05 keyword reference'}});
}}
/* STAGE_A9_MOVE_KEYWORD_CATALOG_END */
'''


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
        text = replace_once(text, anchor, "];\n" + build_catalog_block() + "let catalogState={available:false,loading:false,error:null,status:null,rulesets:[],kind:'species',query:'',rows:[],total:0,selected:null};", path)
        changed = True

    refresh_start = text.index("async function refreshDefinitionRows(")
    refresh_end = text.index("\nasync function loadDefinitionDetail", refresh_start)
    refresh_segment = text[refresh_start:refresh_end]
    if "catalogState.kind==='move_keywords'" not in refresh_segment:
        pattern = r"async function refreshDefinitionRows\(([^\n]*)\)\{\n"
        addition = (
            "async function refreshDefinitionRows(\\1){\n"
            "  if(catalogState.kind==='move_keywords'){\n"
            "    const rows=localMoveKeywordRows(catalogState.query); catalogState.loading=false; catalogState.error=null; catalogState.rows=rows; catalogState.total=rows.length;\n"
            "    if(!catalogState.selected && rows.length)catalogState.selected={definition:rows[0],versions:[]};\n"
            "    else if(catalogState.selected){const current=moveKeywordCatalogEntry(catalogState.selected.definition?.id); catalogState.selected=current?{definition:current,versions:[]}:null;}\n"
            "    render(); return;\n"
            "  }\n"
        )
        text = sub_once(text, pattern, addition, path)
        changed = True

    load_start = text.index("async function loadDefinitionDetail(")
    load_end = text.index("\nfunction setDefinitionKind", load_start)
    load_segment = text[load_start:load_end]
    if "move_keywords" not in load_segment:
        pattern = r"async function loadDefinitionDetail\(([^\n]*)\)\{\n"
        addition = (
            "async function loadDefinitionDetail(\\1){\n"
            "  if(catalogState.kind==='move_keywords'){const entry=moveKeywordCatalogEntry(id); catalogState.selected=entry?{definition:entry,versions:[]}:null; if(rerender!==false)render(); return;}\n"
        )
        text = sub_once(text, pattern, addition, path)
        changed = True

    modal_start = text.find("async function openRuleDefinitionModal(")
    if modal_start >= 0:
        modal_end = text.find("\n}", modal_start) + 2
        modal_segment = text[modal_start:modal_end]
        if "kind==='move_keywords'" not in modal_segment:
            pattern = r"async function openRuleDefinitionModal\(([^\n]*)\)\{\n"
            addition = "async function openRuleDefinitionModal(\\1){\n  if(kind==='move_keywords'){openMoveKeywordInfo(id);return;}\n"
            text = sub_once(text, pattern, addition, path)
            changed = True

    detail_start = text.index("function definitionDetail()")
    detail_end = text.index("\nfunction libraryScreen()", detail_start)
    detail_segment = text[detail_start:detail_end]
    if "d.kind==='move_keywords'" not in detail_segment:
        old = "  let body='';\n  if(d.kind==='species'){"
        new = "  let body='';\n  if(d.kind==='move_keywords'){\n    body+=`<div class=\"definition-tags\">${chip('MOVE KEYWORD','chip-blue')} ${chip(`PTU Core 1.05 · p. ${d.sourcePage}`,'chip-neutral')}</div>`;\n    body+=`<div class=\"definition-section-label\">DESCRIPTION</div><div class=\"definition-text\">${esc(d.effect||'')}</div>`;\n    if(d.reference)body+=`<div class=\"definition-section-label\">REFERENCE</div><div class=\"definition-text\">${esc(d.reference)}</div>`;\n  } else if(d.kind==='species'){"
        text = replace_once(text, old, new, path)
        changed = True

    if "kind==='move_keywords'?MOVE_KEYWORD_CATALOG.length" not in text:
        text, count = re.subn(
            r"\$\{counts\[kind\]\|\|0\}",
            "${kind==='move_keywords'?MOVE_KEYWORD_CATALOG.length:(counts[kind]||0)}",
            text,
            count=1,
        )
        if count != 1:
            raise RuntimeError(f"Could not patch Library count in {path}")
        changed = True

    creature_start = text.index("function creatureMovesTab(p){")
    creature_end = text.index("\nfunction creatureProgressionTab", creature_start)
    creature_segment = text[creature_start:creature_end]
    if "moveKeywordReferenceHtml(def||payload||mv)" not in creature_segment:
        old = "const range=moveRangeText(payload)||mv.range||'—'; const effect=def?.effect||payload.effect||mv.effect||''; const src=moveSourceInfo(mv);"
        text = replace_once(text, old, old + " const keywordHtml=moveKeywordReferenceHtml(def||payload||mv);", path)
        old2 = "</dl>\n        <div class=\"move-reference-actions\">"
        text = replace_once(text, old2, "</dl>${keywordHtml}\n        <div class=\"move-reference-actions\">", path)
        changed = True

    if "openMoveKeywordInfo,route" not in text:
        text = replace_once(text, "Object.assign(window,{route,selectPokemon", "Object.assign(window,{openMoveKeywordInfo,route,selectPokemon", path)
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
