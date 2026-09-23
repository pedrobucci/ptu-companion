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


def patch_repository() -> None:
    path = WINDOWS / 'persistence' / 'repository.mjs'
    old = """  deleteProfile(profileId) {
    const profiles=this.listProfiles();
    if(profiles.length<=1) throw new Error('At least one Trainer profile must remain');
    const exists=profiles.some(p=>p.id===profileId);
    if(!exists) throw new Error('Trainer profile not found');
    this.db.prepare('DELETE FROM profiles WHERE id=?').run(profileId);
    const active=this.getActiveProfileId();
    if(active===profileId || !this.db.prepare('SELECT id FROM profiles WHERE id=?').get(active)){
      const next=this.db.prepare('SELECT id FROM profiles ORDER BY updated_at DESC LIMIT 1').get()?.id;
      if(next) this.setActiveProfileId(next);
    }
    return this.getActiveProfileId();
  }
"""
    new = """  deleteProfile(profileId) {
    const profiles=this.listProfiles();
    const exists=profiles.some(p=>p.id===profileId);
    if(!exists) throw new Error('Trainer profile not found');
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      this.db.prepare('DELETE FROM profiles WHERE id=?').run(profileId);
      const configured=this.db.prepare(\"SELECT value FROM app_meta WHERE key='active_profile_id'\").get()?.value || null;
      const configuredExists=configured && this.db.prepare('SELECT id FROM profiles WHERE id=?').get(configured);
      if(!configuredExists){
        const next=this.db.prepare('SELECT id FROM profiles ORDER BY updated_at DESC, display_name LIMIT 1').get()?.id || null;
        if(next) this.setActiveProfileId(next);
        else this.db.prepare(\"DELETE FROM app_meta WHERE key='active_profile_id'\").run();
      }
      this.db.exec('COMMIT;');
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
    return this.getActiveProfileId();
  }
"""
    must_replace(path, old, new, marker="DELETE FROM app_meta WHERE key='active_profile_id'")


def patch_server() -> None:
    path = WINDOWS / 'server.mjs'
    old = """  if(req.method==='PUT' && url.pathname==='/api/profiles/active'){
    const payload=await bodyJson(req); const id=String(payload.id||'');
    const profile=repo.listProfiles().find(p=>p.id===id);
    if(!profile) throw Object.assign(new Error('Trainer profile not found'),{status:404});
    repo.setActiveProfileId(id);
    return json(res,200,{ok:true,state:hydrateStateForClient(repo.loadState(id)),profiles:repo.listProfiles()});
  }
"""
    new = old + """  if(req.method==='DELETE' && url.pathname.startsWith('/api/profiles/')){
    const id=decodeURIComponent(url.pathname.slice('/api/profiles/'.length));
    if(!id || id==='active') throw Object.assign(new Error('Trainer profile id is required'),{status:400});
    const profile=repo.listProfiles().find(p=>p.id===id);
    if(!profile) throw Object.assign(new Error('Trainer profile not found'),{status:404});
    let activeProfileId=repo.deleteProfile(id);
    let replacementCreated=false;
    if(!activeProfileId){
      const replacement=blankTrainerState({name:'New Trainer',title:'Trainer'});
      repo.saveState(replacement,{createRevision:true});
      activeProfileId=replacement.activeProfileId;
      replacementCreated=true;
    }
    return json(res,200,{
      ok:true,
      deletedProfileId:id,
      replacementCreated,
      state:hydrateStateForClient(repo.loadState(activeProfileId)),
      profiles:repo.listProfiles()
    });
  }
"""
    must_replace(path, old, new, marker="deletedProfileId:id")


def patch_app(path: Path) -> None:
    profile_old = '<button class="btn btn-danger" onclick="resetTrainerSheet()">Reset Sheet</button></div>'
    profile_new = '<button class="btn btn-danger" onclick="resetTrainerSheet()">Reset Sheet</button><button class="btn btn-danger" onclick="deleteTrainerProfile()">Delete Trainer</button></div>'
    must_replace(path, profile_old, profile_new, marker='onclick="deleteTrainerProfile()">Delete Trainer</button>')

    switch_old = '<button class="btn btn-ghost" onclick="closeModal();resetTrainerSheet()">Reset Active Sheet</button></div><p class="muted">Each Trainer profile has its own Pokémon, Rosters, Backpack, NPC notes and campaign state. Only one profile is loaded at a time.</p>'
    switch_new = '<button class="btn btn-ghost" onclick="closeModal();resetTrainerSheet()">Reset Active Sheet</button><button class="btn btn-danger" onclick="closeModal();deleteTrainerProfile()">Delete Active Trainer</button></div><p class="muted">Each Trainer profile has its own Pokémon, Rosters, Backpack, NPC notes and campaign state. Only one profile is loaded at a time.</p>'
    must_replace(path, switch_old, switch_new, marker='Delete Active Trainer</button>')

    function_anchor = 'async function resetTrainerSheet(){'
    delete_function = """async function deleteTrainerProfile(){
  const targetId=String(state.activeProfileId||trainer()?.id||'');
  if(!targetId)return toast('No active Trainer to delete.','error');
  const targetName=trainer()?.name||'this Trainer';
  let profileCount=1;
  try{const profileData=await fetchProfiles();profileCount=Math.max(1,Number(profileData?.profiles?.length||1));}catch{}
  const lastProfile=profileCount<=1;
  const message=lastProfile
    ? `<p>Delete <strong>${esc(targetName)}</strong> and all campaign data owned by this Trainer?</p><div class=\"dialog-warning\">This is the last Trainer. Pokémon, Rosters, Storage, Backpack, NPCs and revisions owned by it will be removed. A new blank Trainer will be created so the app remains usable. Content Packs and global settings are preserved.</div>`
    : `<p>Delete <strong>${esc(targetName)}</strong> and all campaign data owned by this Trainer?</p><div class=\"dialog-warning\">Pokémon, Rosters, Storage, Backpack, NPCs and revisions owned by it will be removed. Other Trainers, Content Packs and global settings are preserved. Another Trainer will become active automatically.</div>`;
  if(!(await styledConfirm({title:'Delete Trainer',message,confirmLabel:'Delete Trainer',danger:true})))return;
  if(persistenceMode==='sqlite'){
    try{
      await saveQueue;
      const response=await fetch(`/api/profiles/${encodeURIComponent(targetId)}`,{method:'DELETE'});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||'Unable to delete Trainer');
      state=migrateState(payload.state);
      invalidateTrainerReference();
      localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
      closeModal();
      render();
      toast(payload.replacementCreated?'Trainer deleted. A new blank Trainer was created.':`Trainer deleted. Active Trainer: ${trainer().name}`);
      setTimeout(()=>loadTrainerReferenceData(true),0);
      return;
    }catch(error){return toast(error.message,'error');}
  }
  state=migrateState(blankTrainerStateClient('New Trainer','Trainer'));
  invalidateTrainerReference();
  persist();
  closeModal();
  render();
  toast('Trainer deleted. A new blank Trainer was created.');
  setTimeout(()=>loadTrainerReferenceData(true),0);
}
"""
    must_replace(path, function_anchor, delete_function + function_anchor, marker='async function deleteTrainerProfile(){')

    expose_old = 'openTrainerSwitcher,switchTrainerProfile,createTrainerProfile,resetTrainerSheet,'
    expose_new = 'openTrainerSwitcher,switchTrainerProfile,createTrainerProfile,deleteTrainerProfile,resetTrainerSheet,'
    must_replace(path, expose_old, expose_new, marker='createTrainerProfile,deleteTrainerProfile,resetTrainerSheet')


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
        print(f'{package_path.relative_to(ROOT)}: Stage A.3 verifier already registered.')


def main() -> None:
    patch_repository()
    patch_server()
    patch_app(WINDOWS / 'static-preview' / 'app.js')
    patch_app(ANDROID / 'www' / 'app.js')
    append_verify(WINDOWS / 'package.json', 'scripts/verify_stage_a3_delete_trainer.mjs')
    append_verify(ANDROID / 'package.json', 'scripts/verify-stage-a3-delete-trainer.mjs')


if __name__ == '__main__':
    main()
