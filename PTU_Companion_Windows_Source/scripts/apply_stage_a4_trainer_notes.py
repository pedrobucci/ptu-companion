#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WINDOWS = ROOT / 'PTU_Companion_Windows_Source'
ANDROID = ROOT / 'PTU_Companion_Android_Tauri'


def must_replace(path: Path, old: str, new: str, *, marker: str | None = None) -> None:
    text = path.read_text(encoding='utf-8')
    if marker and marker in text:
        print(f'{path.relative_to(ROOT)}: patch already applied ({marker}).')
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one patch anchor, found {count}.')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'Patched {path.relative_to(ROOT)}')


def patch_app(path: Path) -> None:
    details_old = """  t.details=t.details||{};
  t.details.background=t.details.background||{name:'Custom Background',adept:'Athletics',novice:'Command',pathetic:['Guile','Intuition','Focus']};
"""
    details_new = r"""  t.details=t.details||{};
  const storedNotes=t.details.notes;
  t.details.notes=Array.isArray(storedNotes)?storedNotes.map(value=>String(value??'')).join('\n'):typeof storedNotes==='string'?storedNotes.replace(/\r\n?/g,'\n'):'';
  t.details.background=t.details.background||{name:'Custom Background',adept:'Athletics',novice:'Command',pathetic:['Guile','Intuition','Focus']};
"""
    must_replace(path, details_old, details_new, marker='const storedNotes=t.details.notes;')

    editor_old = """}
const GM_RESOURCE_TARGETS=[
"""
    editor_new = r"""}
async function editTrainerNotes(){
  const td=ensureTrainerDetails();
  const values=await styledForm({title:'Trainer Notes',subtitle:'Freeform campaign notes stored only with this Trainer profile.',fields:[{name:'notes',label:'Notes',type:'textarea',rows:10,value:td.notes,placeholder:'Contacts, goals, clues, reminders…'}],submitLabel:'Save Notes'});
  if(!values)return;
  const next=String(values.notes??'').replace(/\r\n?/g,'\n');
  if(next===td.notes)return;
  td.notes=next;
  persist();
  toast('Trainer notes updated.');
}
const GM_RESOURCE_TARGETS=[
"""
    must_replace(path, editor_old, editor_new, marker='async function editTrainerNotes(){')

    profile_old = """<button class=\"btn btn-ghost full\" onclick=\"openTrainerBackgroundEditor()\">Edit Background</button>`)}`)}
      ${section('GM GRANTS'"""
    profile_new = r"""<button class=\"btn btn-ghost full\" onclick=\"openTrainerBackgroundEditor()\">Edit Background</button>`)}`)}
      ${section('TRAINER NOTES',td.notes.trim()?`<div class=\"flow-note trainer-notes-block\">${esc(td.notes).replace(/\n/g,'<br>')}</div>`:'<p class=\"muted\">No Trainer notes yet.</p>',`<button class=\"btn btn-ghost btn-small\" onclick=\"editTrainerNotes()\">${td.notes.trim()?'Edit Notes':'Add Notes'}</button>`)}
      ${section('GM GRANTS'"""
    must_replace(path, profile_old, profile_new, marker="section('TRAINER NOTES'")

    expose_old = 'toggleGmOverride,editTrainer,editTrainerExperience,'
    expose_new = 'toggleGmOverride,editTrainer,editTrainerNotes,editTrainerExperience,'
    must_replace(path, expose_old, expose_new, marker='editTrainer,editTrainerNotes,editTrainerExperience')


def append_verify(package_path: Path, verifier: str) -> None:
    package = json.loads(package_path.read_text(encoding='utf-8'))
    scripts = package.setdefault('scripts', {})
    verify = str(scripts.get('verify', '')).strip()
    command = f'node {verifier}'
    if command not in verify:
        scripts['verify'] = f'{verify} && {command}' if verify else command
        package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'Updated {package_path.relative_to(ROOT)}')
    else:
        print(f'{package_path.relative_to(ROOT)}: Stage A.4 verifier already registered.')


def main() -> None:
    patch_app(WINDOWS / 'static-preview' / 'app.js')
    patch_app(ANDROID / 'www' / 'app.js')
    append_verify(WINDOWS / 'package.json', 'scripts/verify_stage_a4_trainer_notes.mjs')
    append_verify(ANDROID / 'package.json', 'scripts/verify-stage-a4-trainer-notes.mjs')


if __name__ == '__main__':
    main()
