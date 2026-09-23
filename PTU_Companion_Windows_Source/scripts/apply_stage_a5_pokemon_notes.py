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
    migrate_old = """  for(const p of data.pokemon){ p.details=p.details&&typeof p.details==='object'?p.details:{}; p.details.gender=normalizePokemonGender(p.details.gender??p.gender??p.sex??'None'); }
"""
    migrate_new = r"""  for(const p of data.pokemon){
    p.details=p.details&&typeof p.details==='object'?p.details:{};
    p.details.gender=normalizePokemonGender(p.details.gender??p.gender??p.sex??'None');
    const storedPokemonNotes=p.details.notes;
    p.details.notes=Array.isArray(storedPokemonNotes)?storedPokemonNotes.map(value=>String(value??'')).join('\n'):typeof storedPokemonNotes==='string'?storedPokemonNotes.replace(/\r\n?/g,'\n'):'';
  }
"""
    must_replace(path, migrate_old, migrate_new, marker='const storedPokemonNotes=p.details.notes;')

    editor_anchor = """
/* --- Battle state --- */
"""
    editor_new = r"""
async function editPokemonNotes(id=state.selectedPokemonId){
  const p=pokemon(id); if(!p)return;
  p.details=p.details&&typeof p.details==='object'?p.details:{};
  const stored=p.details.notes;
  const current=Array.isArray(stored)?stored.map(value=>String(value??'')).join('\n'):typeof stored==='string'?stored.replace(/\r\n?/g,'\n'):'';
  const values=await styledForm({title:`Pokémon Notes · ${p.name}`,subtitle:'Freeform notes stored only with this individual Pokémon.',fields:[{name:'notes',label:'Notes',type:'textarea',rows:10,value:current,placeholder:'Habits, injuries, clues, training reminders…'}],submitLabel:'Save Notes'});
  if(!values)return;
  const next=String(values.notes??'').replace(/\r\n?/g,'\n');
  if(next===current)return;
  p.details.notes=next;
  persist();
  toast(`${p.name} notes updated.`);
}

/* --- Battle state --- */
"""
    must_replace(path, editor_anchor, editor_new, marker='async function editPokemonNotes(')

    screen_old = "const p=pokemon(); if(!p)return `<div class=\"page\">${heading('POKÉMON','No Pokémon','Create a Pokémon to begin.','<button class=\"btn btn-primary\" onclick=\"route(\\'pokemonbuilder\\')\">＋ Create Pokémon</button>')}</div>`; const stages=p.combatStages; const d=p.details||{}; const fs=d.finalStats||null; const rulesBuilt=!!d.createdFromDefinition; const activeTab=state.ui.creatureTab||'sheet'; const data=creatureReferenceState.pokemonId===p.id?creatureReferenceState.data:null; const effectiveFs=data?.resolvedCreature?.stats?.effective||fs; const tempHp=tempHpValue(p);"
    screen_new = screen_old + " const rawPokemonNotes=d.notes; const pokemonNotes=Array.isArray(rawPokemonNotes)?rawPokemonNotes.map(value=>String(value??'')).join('\\n'):typeof rawPokemonNotes==='string'?rawPokemonNotes.replace(/\\r\\n?/g,'\\n'):'';"
    must_replace(path, screen_old, screen_new, marker='const rawPokemonNotes=d.notes;')

    notes_old = "${section('ABILITIES & PROGRESSION',progressionBlock)}${section('ITEM & STORAGE',"
    notes_new = r"""${section('ABILITIES & PROGRESSION',progressionBlock)}${section('POKÉMON NOTES',pokemonNotes.trim()?`<div class="flow-note pokemon-notes-block">${esc(pokemonNotes).replace(/\n/g,'<br>')}</div>`:'<p class="muted">No Pokémon notes yet.</p>',`<button class="btn btn-ghost btn-small" onclick="editPokemonNotes('${p.id}')">${pokemonNotes.trim()?'Edit Notes':'Add Notes'}</button>`)}${section('ITEM & STORAGE',"""
    must_replace(path, notes_old, notes_new, marker="section('POKÉMON NOTES'")

    expose_old = 'selectPokemon,selectRoster,selectNpc,editPokemonIdentity,changeHp,'
    expose_new = 'selectPokemon,selectRoster,selectNpc,editPokemonIdentity,editPokemonNotes,changeHp,'
    must_replace(path, expose_old, expose_new, marker='editPokemonIdentity,editPokemonNotes,changeHp')


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
        print(f'{package_path.relative_to(ROOT)}: Stage A.5 verifier already registered.')


def main() -> None:
    patch_app(WINDOWS / 'static-preview' / 'app.js')
    patch_app(ANDROID / 'www' / 'app.js')
    append_verify(WINDOWS / 'package.json', 'scripts/verify_stage_a5_pokemon_notes.mjs')
    append_verify(ANDROID / 'package.json', 'scripts/verify-stage-a5-pokemon-notes.mjs')


if __name__ == '__main__':
    main()
