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
    create_old = """async function createRoster(){
  const values=await styledForm({title:'Create Roster',subtitle:'A Pokémon may belong to multiple Rosters at the same time.',fields:[{name:'name',label:'Roster name',value:''},{name:'role',label:'Role',type:'select',value:'OTHER',options:['COMBAT','COMPANY','MOUNT','INVESTIGATION','OTHER']},{name:'max',label:'Maximum members',type:'number',min:1,max:99,value:6}],submitLabel:'Create Roster'}); if(!values||!String(values.name||'').trim())return;
  const name=String(values.name).trim(),role=String(values.role||'OTHER').toUpperCase(),max=Math.max(1,Number(values.max)||6);
  const colors=['#0b7b4b','#2f6dda','#e99a19','#704170','#E62829'];
  const id=uid('roster'); state.rosters.push({id,name,role,maxMembers:max,active:true,color:colors[state.rosters.length%colors.length]}); state.selectedRosterId=id; commit(`Roster ${name} created.`);
}
"""
    create_new = """async function createRoster(){
  const values=await styledForm({title:'Create Roster',subtitle:'A Pokémon may belong to multiple Rosters at the same time.',fields:[{name:'name',label:'Roster name',value:''},{name:'role',label:'Role',type:'select',value:'OTHER',options:['COMBAT','COMPANY','MOUNT','INVESTIGATION','OTHER']},{name:'max',label:'Maximum members',type:'number',min:1,max:99,value:6}],submitLabel:'Create Roster'}); if(!values||!String(values.name||'').trim())return;
  const name=String(values.name).trim(),role=String(values.role||'OTHER').toUpperCase(),max=Math.max(1,Number(values.max)||6);
  const colors=['#0b7b4b','#2f6dda','#e99a19','#704170','#E62829'];
  const id=uid('roster'); state.rosters.push({id,name,role,maxMembers:max,active:true,color:colors[state.rosters.length%colors.length]}); state.selectedRosterId=id; commit(`Roster ${name} created.`);
}
async function editRoster(id=state.selectedRosterId){
  const r=roster(id); if(!r)return;
  const memberCount=rosterMembers(r.id).length;
  const values=await styledForm({title:`Edit Roster · ${r.name}`,subtitle:'Roster identity and capacity can change without removing Pokémon memberships.',fields:[{name:'name',label:'Roster name',value:r.name||''},{name:'role',label:'Role',type:'select',value:String(r.role||'OTHER').toUpperCase(),options:['COMBAT','COMPANY','MOUNT','INVESTIGATION','OTHER']},{name:'max',label:'Maximum members',type:'number',min:Math.max(1,memberCount),max:99,value:Math.max(memberCount,Number(r.maxMembers)||6),help:memberCount?`This roster currently has ${memberCount} member${memberCount===1?'':'s'}.`:''},{name:'status',label:'Dashboard status',type:'select',value:r.active===false?'hidden':'active',options:[{value:'active',label:'Active — show on dashboard'},{value:'hidden',label:'Hidden — keep roster, hide from dashboard'}]},{name:'color',label:'Roster color',type:'color',value:/^#[0-9a-f]{6}$/i.test(String(r.color||''))?r.color:'#2f6dda'}],submitLabel:'Save Roster'});
  if(!values)return;
  const name=String(values.name||'').trim(); if(!name)return toast('Roster name cannot be empty.','error');
  const allowedRoles=new Set(['COMBAT','COMPANY','MOUNT','INVESTIGATION','OTHER']); const role=String(values.role||'OTHER').toUpperCase(); if(!allowedRoles.has(role))return toast('Choose a valid Roster role.','error');
  const max=Math.max(1,Math.min(99,Math.trunc(Number(values.max)||0))); if(max<memberCount)return toast(`${r.name} currently has ${memberCount} member${memberCount===1?'':'s'}; remove members before lowering the limit below that count.`,'error');
  const color=/^#[0-9a-f]{6}$/i.test(String(values.color||''))?String(values.color):r.color;
  r.name=name; r.role=role; r.maxMembers=max; r.active=String(values.status||'active')!=='hidden'; r.color=color;
  commit(`Roster ${name} updated.`);
}
"""
    must_replace(path, create_old, create_new, marker='async function editRoster(id=state.selectedRosterId){')

    heading_old = """return `<div class=\"page\">${heading('ROSTERS','Team Organization','Multiple rosters can be active at once. A Pokémon may belong to several rosters.','<button class=\"btn btn-primary\" onclick=\"createRoster()\">＋ Create Roster</button>')}"""
    heading_new = """return `<div class=\"page\">${heading('ROSTERS','Team Organization','Multiple rosters can be active at once. A Pokémon may belong to several rosters.',`<div class=\"row-gap\"><button class=\"btn btn-ghost\" onclick=\"editRoster('${r.id}')\">✎ Edit Roster</button><button class=\"btn btn-primary\" onclick=\"createRoster()\">＋ Create Roster</button></div>`)}"""
    must_replace(path, heading_old, heading_new, marker='✎ Edit Roster')

    selector_old = """<div class=\"roster-selector\">${state.rosters.map(x=>`<button class=\"${x.id===r.id?'active':''}\" style=\"--accent:${x.color}\" onclick=\"selectRoster('${x.id}')\"><strong>${esc(x.name)}</strong>${chip(esc(x.role),x.role==='COMBAT'?'chip-green':x.role==='COMPANY'?'chip-blue':'chip-yellow')}<b>${rosterMembers(x.id).length}/${x.maxMembers}</b></button>`).join('')}</div>"""
    selector_new = """<div class=\"roster-selector\">${state.rosters.map(x=>`<button class=\"${x.id===r.id?'active':''}\" style=\"--accent:${x.color}\" onclick=\"selectRoster('${x.id}')\"><strong>${esc(x.name)}</strong>${chip(esc(x.role),x.role==='COMBAT'?'chip-green':x.role==='COMPANY'?'chip-blue':'chip-yellow')}${x.active===false?chip('HIDDEN','chip-neutral'):''}<b>${rosterMembers(x.id).length}/${x.maxMembers}</b></button>`).join('')}</div>"""
    must_replace(path, selector_old, selector_new, marker="chip('HIDDEN','chip-neutral')")

    expose_old = 'addPokemonToRoster,removePokemonFromRoster,createRoster,storePokemon'
    expose_new = 'addPokemonToRoster,removePokemonFromRoster,createRoster,editRoster,storePokemon'
    must_replace(path, expose_old, expose_new, marker='createRoster,editRoster,storePokemon')


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
        print(f'{package_path.relative_to(ROOT)}: Stage A.6 verifier already registered.')


def main() -> None:
    patch_app(WINDOWS / 'static-preview' / 'app.js')
    patch_app(ANDROID / 'www' / 'app.js')
    append_verify(WINDOWS / 'package.json', 'scripts/verify_stage_a6_edit_roster.mjs')
    append_verify(ANDROID / 'package.json', 'scripts/verify-stage-a6-edit-roster.mjs')


if __name__ == '__main__':
    main()
