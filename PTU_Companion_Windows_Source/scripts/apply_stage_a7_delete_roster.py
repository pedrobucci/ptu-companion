from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP_PATHS = [
    ROOT / "PTU_Companion_Windows_Source/static-preview/app.js",
    ROOT / "PTU_Companion_Android_Tauri/www/app.js",
]
PACKAGE_PATHS = [
    (ROOT / "PTU_Companion_Windows_Source/package.json", "node scripts/verify_stage_a7_delete_roster.mjs"),
    (ROOT / "PTU_Companion_Android_Tauri/package.json", "node scripts/verify-stage-a7-delete-roster.mjs"),
]

DELETE_FN = """async function deleteRoster(id=state.selectedRosterId){
  const r=roster(id); if(!r)return;
  if(state.rosters.length<=1)return toast('Create another Roster before deleting the final Roster.','error');
  const memberCount=rosterMembers(r.id).length;
  const ok=await styledConfirm({title:`Delete Roster · ${r.name}?`,message:`<p>Deleting a Roster does not delete any Pokémon. It only removes this Roster and its membership links.</p>${memberCount?`<div class=\"dialog-warning\">${memberCount} Pokémon ${memberCount===1?'is':'are'} currently assigned here. ${memberCount===1?'It':'They'} will remain in this Trainer profile and in any other Rosters.</div>`:'<div class=\"dialog-warning\">The Roster is empty; only the Roster itself will be removed.</div>'}`,confirmLabel:'Delete Roster',danger:true});
  if(!ok)return;
  state.rosters=state.rosters.filter(x=>x.id!==r.id);
  for(const p of state.pokemon)p.rosterIds=(p.rosterIds||[]).filter(rid=>rid!==r.id);
  if(state.selectedRosterId===r.id||!state.rosters.some(x=>x.id===state.selectedRosterId))state.selectedRosterId=state.rosters[0]?.id||null;
  commit(`Roster ${r.name} deleted. Pokémon were kept.`);
}
"""


def replace_once(text: str, old: str, new: str, path: Path) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one anchor in {path}, found {count}: {old[:90]!r}")
    return text.replace(old, new, 1)


def patch_app(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    changed = False

    if "async function deleteRoster(id=state.selectedRosterId)" not in text:
        anchor = "  commit(`Roster ${name} updated.`);\n}\nfunction storePokemon(id){"
        replacement = "  commit(`Roster ${name} updated.`);\n}\n" + DELETE_FN + "function storePokemon(id){"
        text = replace_once(text, anchor, replacement, path)
        changed = True

    if "🗑 Delete Roster" not in text:
        old = "<button class=\"btn btn-ghost\" onclick=\"editRoster('${r.id}')\">✎ Edit Roster</button><button class=\"btn btn-primary\" onclick=\"createRoster()\">＋ Create Roster</button>"
        new = "<button class=\"btn btn-ghost\" onclick=\"editRoster('${r.id}')\">✎ Edit Roster</button><button class=\"btn btn-danger\" onclick=\"deleteRoster('${r.id}')\">🗑 Delete Roster</button><button class=\"btn btn-primary\" onclick=\"createRoster()\">＋ Create Roster</button>"
        text = replace_once(text, old, new, path)
        changed = True

    if "createRoster,editRoster,deleteRoster,storePokemon" not in text:
        old = "createRoster,editRoster,storePokemon"
        new = "createRoster,editRoster,deleteRoster,storePokemon"
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
