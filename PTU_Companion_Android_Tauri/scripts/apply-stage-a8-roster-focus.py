from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "PTU_Companion_Android_Tauri/www/app.js"
PACKAGE = ROOT / "PTU_Companion_Android_Tauri/package.json"
VERIFIER = "node scripts/verify-stage-a8-roster-focus.mjs"


def replace_once(text: str, old: str, new: str, path: Path) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one anchor in {path}, found {count}: {old[:100]!r}")
    return text.replace(old, new, 1)


def patch_app() -> None:
    text = APP.read_text(encoding="utf-8")
    changed = False

    old_card = """function creatureCard(p,compact=false){
  return `<button class=\"creature-card ${compact?'compact':''} ${p.storage?'stored':''}\" onclick=\"selectPokemon('${p.id}')\">${pokemonPortraitTag(p)}<div class=\"creature-card-meta\"><strong>${esc(p.name)}</strong><span>Lv. ${p.level}</span>${compact?'':`<div class=\"type-row\">${p.types.map(typeBadge).join('')}</div>`}</div>${p.injuries>0?`<span class=\"injury-dot\" title=\"${p.injuries} injuries\">${p.injuries}</span>`:''}</button>`;
}
"""
    new_card = """function creatureCard(p,compact=false,focusRoster=false){
  const onSelect=focusRoster?`focusRosterPokemon('${p.id}')`:`selectPokemon('${p.id}')`;
  return `<button class=\"creature-card ${compact?'compact':''} ${p.storage?'stored':''}\" onclick=\"${onSelect}\">${pokemonPortraitTag(p)}<div class=\"creature-card-meta\"><strong>${esc(p.name)}</strong><span>Lv. ${p.level}</span>${compact?'':`<div class=\"type-row\">${p.types.map(typeBadge).join('')}</div>`}</div>${p.injuries>0?`<span class=\"injury-dot\" title=\"${p.injuries} injuries\">${p.injuries}</span>`:''}</button>`;
}
"""
    if "function creatureCard(p,compact=false,focusRoster=false)" not in text:
        text = replace_once(text, old_card, new_card, APP)
        changed = True

    focus_fn = """function focusRosterPokemon(id){
  const sourceScreen=state.ui.screen;
  selectPokemon(id,false);
  if(sourceScreen!=='rosters'||state.ui.screen!=='rosters')return;
  setTimeout(()=>{
    const target=document.querySelector('.roster-layout .selected-pokemon-actions')?.closest('.section-card')||document.querySelector('.roster-layout .detail-hero')?.closest('.section-card');
    if(!target)return;
    const reduceMotion=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
  },0);
}
"""
    if "function focusRosterPokemon(id)" not in text:
        anchor = "function selectRoster(id){ state.selectedRosterId=id; persist(); render(); }\n"
        text = replace_once(text, anchor, focus_fn + anchor, APP)
        changed = True

    old_members = "rosterMembers(r.id).map(p=>creatureCard(p)).join('')"
    new_members = "rosterMembers(r.id).map(p=>creatureCard(p,false,true)).join('')"
    if new_members not in text:
        text = replace_once(text, old_members, new_members, APP)
        changed = True

    if "route,selectPokemon,focusRosterPokemon,selectRoster" not in text:
        text = replace_once(text, "route,selectPokemon,selectRoster", "route,selectPokemon,focusRosterPokemon,selectRoster", APP)
        changed = True

    if changed:
        APP.write_text(text, encoding="utf-8")
        print(f"Patched {APP.relative_to(ROOT)}")
    else:
        print(f"Already patched {APP.relative_to(ROOT)}")


def patch_package() -> None:
    data = json.loads(PACKAGE.read_text(encoding="utf-8"))
    verify = data.get("scripts", {}).get("verify")
    if not verify:
        raise RuntimeError(f"Missing scripts.verify in {PACKAGE}")
    if VERIFIER not in verify:
        data["scripts"]["verify"] = verify + " && " + VERIFIER
        PACKAGE.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Updated {PACKAGE.relative_to(ROOT)}")
    else:
        print(f"Verifier already present in {PACKAGE.relative_to(ROOT)}")


patch_app()
patch_package()
