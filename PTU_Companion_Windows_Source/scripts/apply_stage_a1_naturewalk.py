#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
ANDROID = REPO / 'PTU_Companion_Android_Tauri'


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding='utf-8')
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one match in {path}: found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'Patched {path.relative_to(REPO)}')


def append_verify(path: Path, command: str) -> None:
    data = json.loads(path.read_text(encoding='utf-8'))
    verify = data.setdefault('scripts', {}).get('verify', '')
    if command not in verify:
        data['scripts']['verify'] = f'{verify} && {command}' if verify else command
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f'Updated {path.relative_to(REPO)}')


ui_old = "function formatCapability(c){if(!c)return '—'; if(typeof c==='string')return c; if(c.kind==='jump')return `${c.name||'Jump'} ${c.high??'?'}/${c.long??'?'}`; return `${c.name||c.capability_id||'Capability'}${c.value!=null?` ${c.value}`:''}`;}"
ui_new = """function normalizeNaturewalkTerrains(c){
  if(!c)return []; const source=typeof c==='string'?c:(c.terrains??c.terrain??'');
  const fromName=typeof c==='string'?c:String(c.name||''); const nameMatch=fromName.match(/^naturewalk\\s*(?:\\[([^\\]]+)\\]|\\(([^)]+)\\))$/i);
  const raw=(source===''&&nameMatch)?(nameMatch[1]||nameMatch[2]):source; const values=(Array.isArray(raw)?raw:[raw]).flatMap(v=>String(v??'').split(/[,;|/]/)).map(v=>v.trim()).filter(Boolean);
  const seen=new Set(); return values.filter(v=>{const k=v.toLocaleLowerCase();if(seen.has(k))return false;seen.add(k);return true;});
}
function formatCapability(c){if(!c)return '—'; if(typeof c==='string'&&!/^naturewalk(?:\\s|\\[|\\(|$)/i.test(c.trim()))return c; if(c?.kind==='jump')return `${c.name||'Jump'} ${c.high??'?'}/${c.long??'?'}`; const id=String(c?.capability_id||c?.id||c?.name||c||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); if(id==='naturewalk'||/^naturewalk(?:\\s|\\[|\\(|$)/i.test(String(c?.name||c||'').trim())){const terrains=normalizeNaturewalkTerrains(c);return terrains.length?`Naturewalk [${terrains.join(', ')}]`:'Naturewalk';} return `${c.name||c.capability_id||'Capability'}${c.value!=null?` ${c.value}`:''}`;}"""

for app in (ROOT / 'static-preview' / 'app.js', ANDROID / 'www' / 'app.js'):
    replace_once(app, ui_old, ui_new)

repo = ROOT / 'definitions' / 'repository.mjs'
replace_once(repo,
    "import { DatabaseSync } from 'node:sqlite';\n",
    "import { DatabaseSync } from 'node:sqlite';\nimport {normalizeCapabilities} from '../rules/capability-normalization.mjs';\n")
replace_once(repo,
    "      capabilities:raw.capabilities || [],\n",
    "      capabilities:normalizeCapabilities(raw.capabilities),\n")

mobile = ANDROID / 'www' / 'mobile-api.mjs'
replace_once(mobile,
    "import {itemUsageMetadata} from './rules/item-metadata.mjs';\n",
    "import {itemUsageMetadata} from './rules/item-metadata.mjs';\nimport {normalizeCapabilities} from './rules/capability-normalization.mjs';\n")
replace_once(mobile,
    "    types:Array.isArray(raw.types)?raw.types:[],baseStats:raw.base_stats||null,abilities:raw.ability_slots||[],capabilities:raw.capabilities||[],levelUpMoves:raw.level_up_moves||[],\n",
    "    types:Array.isArray(raw.types)?raw.types:[],baseStats:raw.base_stats||null,abilities:raw.ability_slots||[],capabilities:normalizeCapabilities(raw.capabilities),levelUpMoves:raw.level_up_moves||[],\n")
replace_once(mobile,
    "  getResolved({rulesetId,kind,id}){ const vid=this._map(rulesetId,kind)[id],record=data.records?.[vid]; return record?{...deep(record),kind}:null; }\n",
    "  getResolved({rulesetId,kind,id}){ const vid=this._map(rulesetId,kind)[id],record=data.records?.[vid]; if(!record)return null; const out={...deep(record),kind}; if(kind==='species')out.capabilities=normalizeCapabilities(out.capabilities||out.raw?.capabilities); return out; }\n")
replace_once(mobile,
    "  getVersions({kind,id}){ const vids=data.versionGroups?.[`${kind}:${id}`]||[]; return vids.map(v=>data.records[v]?{...deep(data.records[v]),kind}:null).filter(Boolean); }\n",
    "  getVersions({kind,id}){ const vids=data.versionGroups?.[`${kind}:${id}`]||[]; return vids.map(v=>{const record=data.records[v];if(!record)return null;const out={...deep(record),kind};if(kind==='species')out.capabilities=normalizeCapabilities(out.capabilities||out.raw?.capabilities);return out;}).filter(Boolean); }\n")

# Keep the Windows verifier portable on Windows and Linux runners.
win_test = ROOT / 'scripts' / 'verify_stage_a1_naturewalk.mjs'
replace_once(win_test,
    "import {readFile} from 'node:fs/promises';\n",
    "import {readFile} from 'node:fs/promises';\nimport {fileURLToPath} from 'node:url';\n")
replace_once(win_test,
    "const db=new DefinitionRepository(new URL('../seed/definitions/ptu_seed_v1.0.sqlite3',import.meta.url).pathname);\n",
    "const db=new DefinitionRepository(fileURLToPath(new URL('../seed/definitions/ptu_seed_v1.0.sqlite3',import.meta.url)));\n")

append_verify(ROOT / 'package.json', 'node scripts/verify_stage_a1_naturewalk.mjs')
append_verify(ANDROID / 'package.json', 'node scripts/verify-stage-a1-naturewalk.mjs')
