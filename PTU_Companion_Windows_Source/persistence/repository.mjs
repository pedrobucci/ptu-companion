import { createHash } from 'node:crypto';

const toJson = value => JSON.stringify(value ?? null);
const fromJson = (value, fallback) => {
  try { return value == null ? fallback : JSON.parse(value); }
  catch { return fallback; }
};
const bool = value => value ? 1 : 0;
const now = () => new Date().toISOString();

export class CampaignRepository {
  constructor(db) { this.db = db; }

  hasProfiles() {
    return Number(this.db.prepare('SELECT COUNT(*) AS c FROM profiles').get()?.c || 0) > 0;
  }

  getActiveProfileId() {
    return this.db.prepare("SELECT value FROM app_meta WHERE key='active_profile_id'").get()?.value
      || this.db.prepare('SELECT id FROM profiles ORDER BY updated_at DESC LIMIT 1').get()?.id
      || null;
  }

  setActiveProfileId(profileId) {
    this.db.prepare(`INSERT INTO app_meta(key,value) VALUES('active_profile_id',?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(profileId);
  }

  listProfiles() {
    return this.db.prepare(`SELECT p.id,p.display_name,p.created_at,p.updated_at,t.title,t.level,t.portrait_data_url
      FROM profiles p JOIN trainers t ON t.id=p.id ORDER BY p.updated_at DESC, p.display_name`).all().map(r=>({
        id:r.id,name:r.display_name,title:r.title,level:r.level,portraitDataUrl:r.portrait_data_url||null,createdAt:r.created_at,updatedAt:r.updated_at,active:r.id===this.getActiveProfileId()
      }));
  }

  deleteProfile(profileId) {
    const profiles=this.listProfiles();
    const exists=profiles.some(p=>p.id===profileId);
    if(!exists) throw new Error('Trainer profile not found');
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      this.db.prepare('DELETE FROM profiles WHERE id=?').run(profileId);
      const configured=this.db.prepare("SELECT value FROM app_meta WHERE key='active_profile_id'").get()?.value || null;
      const configuredExists=configured && this.db.prepare('SELECT id FROM profiles WHERE id=?').get(configured);
      if(!configuredExists){
        const next=this.db.prepare('SELECT id FROM profiles ORDER BY updated_at DESC, display_name LIMIT 1').get()?.id || null;
        if(next) this.setActiveProfileId(next);
        else this.db.prepare("DELETE FROM app_meta WHERE key='active_profile_id'").run();
      }
      this.db.exec('COMMIT;');
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
    return this.getActiveProfileId();
  }

  loadState(profileId = this.getActiveProfileId()) {
    if (!profileId) return null;
    const t = this.db.prepare('SELECT * FROM trainers WHERE id=?').get(profileId);
    if (!t) return null;

    const rosters = this.db.prepare('SELECT * FROM rosters WHERE trainer_id=? ORDER BY rowid').all(profileId).map(r => ({
      id:r.id, name:r.name, role:r.role, maxMembers:r.max_members, active:!!r.active, color:r.color
    }));
    const membershipRows = this.db.prepare(`SELECT rm.pokemon_id, rm.roster_id
      FROM roster_memberships rm JOIN rosters r ON r.id=rm.roster_id WHERE r.trainer_id=?`).all(profileId);
    const memberships = new Map();
    for (const row of membershipRows) {
      if (!memberships.has(row.pokemon_id)) memberships.set(row.pokemon_id, []);
      memberships.get(row.pokemon_id).push(row.roster_id);
    }

    const pokemon = this.db.prepare('SELECT * FROM pokemon WHERE trainer_id=? ORDER BY rowid').all(profileId).map(p => ({
      id:p.id, name:p.name, species:p.species, level:p.level,
      types:fromJson(p.types_json, []), hp:p.hp, maxHp:p.max_hp, injuries:p.injuries,
      ball:p.ball, heldItem:p.held_item, img:p.image_path, storage:!!p.in_storage,
      loyalty:p.loyalty, rosterIds:memberships.get(p.id) || [],
      combatStages:fromJson(p.combat_stages_json, {}), details:fromJson(p.details_json, {})
    }));

    const inventory = this.db.prepare('SELECT * FROM inventory_items WHERE trainer_id=? ORDER BY rowid').all(profileId).map(i => ({
      ...fromJson(i.details_json, {}),
      id:i.id, icon:i.icon, name:i.name, category:i.category, price:i.price, qty:i.qty,
      consumable:!!i.consumable, equipSlot:i.equip_slot
    }));

    const gmGrants = this.db.prepare('SELECT * FROM gm_grants WHERE trainer_id=? ORDER BY rowid').all(profileId).map(g => ({
      id:g.id, type:g.type, label:g.label, target:g.target, value:g.value, createdAt:g.created_at
    }));
    const history = this.db.prepare('SELECT * FROM trainer_history WHERE trainer_id=? ORDER BY rowid').all(profileId).map(h => ({
      id:h.id, date:h.event_date, title:h.title, detail:h.detail
    }));

    const npcRows = this.db.prepare('SELECT * FROM npcs WHERE trainer_id=? ORDER BY rowid').all(profileId);
    const noteStmt = this.db.prepare('SELECT note FROM npc_notes WHERE npc_id=? ORDER BY position');
    const npcs = npcRows.map(n => ({
      id:n.id, initials:n.initials, name:n.name, role:n.role, tag:n.tag,
      affiliation:n.affiliation, lastSeen:n.last_seen, description:n.description, portraitDataUrl:n.portrait_data_url||null,
      notes:noteStmt.all(n.id).map(x => x.note)
    }));

    const shopRow = this.db.prepare('SELECT * FROM shop_state WHERE trainer_id=?').get(profileId);
    const uiRow = this.db.prepare('SELECT * FROM ui_state WHERE trainer_id=?').get(profileId);

    return {
      version: 2,
      activeProfileId: profileId,
      trainer: {
        id:t.id, name:t.name, title:t.title, level:t.level, exp:t.exp, nextExp:t.next_exp, portraitDataUrl:t.portrait_data_url||null,
        money:t.money, ptuPoints:t.ptu_points, badges:t.badges,
        stats:fromJson(t.stats_json, {}), derived:fromJson(t.derived_json, {}),
        skills:fromJson(t.skills_json, {}), equipment:fromJson(t.equipment_json, {}),
        modifiers:fromJson(t.modifiers_json, []), details:fromJson(t.details_json, {}), gmGrants, history
      },
      pokemon, rosters, inventory,
      shop: shopRow ? {preset:shopRow.preset, discountPct:shopRow.discount_pct, mode:shopRow.mode, cart:fromJson(shopRow.cart_json,{})} : {preset:'Poké Mart',discountPct:0,mode:'buy',cart:{}},
      npcs,
      selectedPokemonId:uiRow?.selected_pokemon_id || pokemon[0]?.id || null,
      selectedRosterId:uiRow?.selected_roster_id || rosters[0]?.id || null,
      selectedNpcId:uiRow?.selected_npc_id || npcs[0]?.id || null,
      ui:fromJson(uiRow?.data_json, {screen:'dashboard',toast:null,round:1,scene:1,day:1,gmOverride:false})
    };
  }

  saveState(state, {createRevision=true} = {}) {
    this.validateState(state);
    const profileId = state.activeProfileId || state.trainer.id;
    const db = this.db;
    const stamp = now();
    const canonicalState = structuredClone({...state, version:2, activeProfileId:profileId});
    // Portraits are persisted in dedicated columns rather than duplicated into every
    // revision snapshot. This keeps a portrait-heavy campaign database compact.
    // Restoring an old revision preserves the portraits that are currently assigned.
    delete canonicalState.trainer?.portraitDataUrl;
    for(const npc of (canonicalState.npcs||[])) delete npc.portraitDataUrl;
    const canonical = JSON.stringify(canonicalState);
    // Revision hashes intentionally ignore pure navigation/transient UI so opening a screen
    // does not create a fake campaign revision. Combat cycle and GM Override remain semantic.
    const semanticState = JSON.parse(canonical);
    semanticState.ui = {
      round: semanticState.ui?.round ?? 1,
      scene: semanticState.ui?.scene ?? 1,
      day: semanticState.ui?.day ?? 1,
      gmOverride: !!semanticState.ui?.gmOverride
    };
    semanticState.selectedPokemonId = null;
    semanticState.selectedRosterId = null;
    semanticState.selectedNpcId = null;
    if(semanticState.shop) semanticState.shop.cart = {};
    const hash = createHash('sha256').update(JSON.stringify(semanticState)).digest('hex');

    db.exec('BEGIN IMMEDIATE;');
    try {
      db.prepare(`INSERT INTO profiles(id,display_name,created_at,updated_at) VALUES(?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name, updated_at=excluded.updated_at`)
        .run(profileId, state.trainer.name, stamp, stamp);
      db.prepare(`INSERT INTO trainers(id,name,title,level,exp,next_exp,money,ptu_points,badges,stats_json,derived_json,skills_json,equipment_json,modifiers_json,details_json,portrait_data_url)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,title=excluded.title,level=excluded.level,exp=excluded.exp,next_exp=excluded.next_exp,money=excluded.money,ptu_points=excluded.ptu_points,badges=excluded.badges,stats_json=excluded.stats_json,derived_json=excluded.derived_json,skills_json=excluded.skills_json,equipment_json=excluded.equipment_json,modifiers_json=excluded.modifiers_json,details_json=excluded.details_json,portrait_data_url=excluded.portrait_data_url`)
        .run(profileId,state.trainer.name,state.trainer.title,state.trainer.level,state.trainer.exp,state.trainer.nextExp,state.trainer.money,state.trainer.ptuPoints,state.trainer.badges,toJson(state.trainer.stats),toJson(state.trainer.derived),toJson(state.trainer.skills),toJson(state.trainer.equipment),toJson(state.trainer.modifiers),toJson(state.trainer.details||{}),state.trainer.portraitDataUrl||null);

      // Child collections are transactionally replaced. This is deliberately simple for v0.2,
      // while preserving normalized tables for the future command/repository layer.
      for (const table of ['roster_memberships','npc_notes']) {
        if (table==='roster_memberships') db.prepare(`DELETE FROM roster_memberships WHERE roster_id IN (SELECT id FROM rosters WHERE trainer_id=?)`).run(profileId);
        else db.prepare(`DELETE FROM npc_notes WHERE npc_id IN (SELECT id FROM npcs WHERE trainer_id=?)`).run(profileId);
      }
      for (const table of ['gm_grants','trainer_history','inventory_items','npcs','rosters','pokemon']) {
        db.prepare(`DELETE FROM ${table} WHERE trainer_id=?`).run(profileId);
      }

      const pokemonStmt=db.prepare(`INSERT INTO pokemon(id,trainer_id,name,species,level,types_json,hp,max_hp,injuries,ball,held_item,image_path,in_storage,loyalty,combat_stages_json,details_json)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for(const p of state.pokemon) pokemonStmt.run(p.id,profileId,p.name,p.species,p.level,toJson(p.types),p.hp,p.maxHp,p.injuries,p.ball,p.heldItem??null,p.img??null,bool(p.storage),p.loyalty,toJson(p.combatStages),toJson(p.details||{}));

      const rosterStmt=db.prepare('INSERT INTO rosters(id,trainer_id,name,role,max_members,active,color) VALUES(?,?,?,?,?,?,?)');
      for(const r of state.rosters) rosterStmt.run(r.id,profileId,r.name,r.role,r.maxMembers,bool(r.active),r.color);
      const memberStmt=db.prepare('INSERT INTO roster_memberships(roster_id,pokemon_id) VALUES(?,?)');
      for(const p of state.pokemon) for(const rid of (p.rosterIds||[])) if(state.rosters.some(r=>r.id===rid)) memberStmt.run(rid,p.id);

      const itemStmt=db.prepare('INSERT INTO inventory_items(id,trainer_id,icon,name,category,price,qty,consumable,equip_slot,details_json) VALUES(?,?,?,?,?,?,?,?,?,?)');
      for(const i of state.inventory){
        const {id,icon,name,category,price,qty,consumable,equipSlot,...details}=i;
        itemStmt.run(id,profileId,icon||'',name,category,Number(price||0),Number(qty||0),bool(consumable),equipSlot??null,toJson(details));
      }

      const grantStmt=db.prepare('INSERT INTO gm_grants(id,trainer_id,type,label,target,value,created_at) VALUES(?,?,?,?,?,?,?)');
      for(const g of (state.trainer.gmGrants||[])) grantStmt.run(g.id,profileId,g.type,g.label,g.target||'',g.value||'',g.createdAt||stamp.slice(0,10));
      const historyStmt=db.prepare('INSERT INTO trainer_history(id,trainer_id,event_date,title,detail) VALUES(?,?,?,?,?)');
      for(const h of (state.trainer.history||[])) historyStmt.run(h.id,profileId,h.date||stamp.slice(0,10),h.title,h.detail||'');

      const npcStmt=db.prepare('INSERT INTO npcs(id,trainer_id,initials,name,role,tag,affiliation,last_seen,description,portrait_data_url) VALUES(?,?,?,?,?,?,?,?,?,?)');
      const noteStmt=db.prepare('INSERT INTO npc_notes(npc_id,position,note) VALUES(?,?,?)');
      for(const n of state.npcs){ npcStmt.run(n.id,profileId,n.initials||'',n.name,n.role||'',n.tag||'',n.affiliation||'',n.lastSeen||'',n.description||'',n.portraitDataUrl||null); (n.notes||[]).forEach((note,pos)=>noteStmt.run(n.id,pos,note)); }

      db.prepare(`INSERT INTO shop_state(trainer_id,preset,discount_pct,mode,cart_json) VALUES(?,?,?,?,?)
        ON CONFLICT(trainer_id) DO UPDATE SET preset=excluded.preset,discount_pct=excluded.discount_pct,mode=excluded.mode,cart_json=excluded.cart_json`)
        .run(profileId,state.shop.preset,state.shop.discountPct,state.shop.mode,toJson(state.shop.cart));
      db.prepare(`INSERT INTO ui_state(trainer_id,selected_pokemon_id,selected_roster_id,selected_npc_id,data_json) VALUES(?,?,?,?,?)
        ON CONFLICT(trainer_id) DO UPDATE SET selected_pokemon_id=excluded.selected_pokemon_id,selected_roster_id=excluded.selected_roster_id,selected_npc_id=excluded.selected_npc_id,data_json=excluded.data_json`)
        .run(profileId,state.selectedPokemonId??null,state.selectedRosterId??null,state.selectedNpcId??null,toJson(state.ui));

      this.setActiveProfileId(profileId);
      if(createRevision){
        const last=db.prepare('SELECT content_hash FROM save_revisions WHERE profile_id=? ORDER BY id DESC LIMIT 1').get(profileId);
        if(last?.content_hash!==hash){
          db.prepare('INSERT INTO save_revisions(profile_id,created_at,content_hash,state_json) VALUES(?,?,?,?)').run(profileId,stamp,hash,canonical);
          db.prepare(`DELETE FROM save_revisions WHERE profile_id=? AND id NOT IN (
            SELECT id FROM save_revisions WHERE profile_id=? ORDER BY id DESC LIMIT 30
          )`).run(profileId,profileId);
        }
      }
      db.exec('COMMIT;');
      return {profileId, hash, savedAt:stamp};
    } catch (error) {
      db.exec('ROLLBACK;');
      throw error;
    }
  }

  listRevisions(profileId=this.getActiveProfileId(), limit=10){
    if(!profileId) return [];
    return this.db.prepare('SELECT id,created_at,content_hash FROM save_revisions WHERE profile_id=? ORDER BY id DESC LIMIT ?').all(profileId,limit);
  }

  restoreRevision(id){
    const row=this.db.prepare('SELECT state_json FROM save_revisions WHERE id=?').get(id);
    if(!row) throw new Error('Revision not found');
    const state=JSON.parse(row.state_json);
    // Portraits are intentionally outside revision snapshots. Preserve the current
    // images while restoring the mechanical/campaign state of the selected revision.
    const current=this.loadState(state.activeProfileId);
    if(current?.trainer) state.trainer.portraitDataUrl=current.trainer?.portraitDataUrl||null;
    const portraitByNpc=new Map((current?.npcs||[]).map(n=>[n.id,n.portraitDataUrl||null]));
    for(const npc of (state.npcs||[])) npc.portraitDataUrl=portraitByNpc.get(npc.id)||null;
    this.saveState(state,{createRevision:true});
    return this.loadState(state.activeProfileId);
  }

  validateState(state){
    if(!state || typeof state!=='object') throw new Error('State must be an object');
    if(!state.trainer?.id || !state.trainer?.name) throw new Error('Trainer is required');
    for(const field of ['pokemon','rosters','inventory','npcs']) if(!Array.isArray(state[field])) throw new Error(`${field} must be an array`);
    const pids=new Set(); for(const p of state.pokemon){ if(!p.id || pids.has(p.id)) throw new Error('Duplicate or missing Pokémon id'); pids.add(p.id); if(p.hp<0 || p.maxHp<1 || p.hp>p.maxHp) throw new Error(`Invalid HP for ${p.name}`); if(p.injuries<0) throw new Error(`Invalid Injuries for ${p.name}`); }
    const rids=new Set(state.rosters.map(r=>r.id));
    for(const p of state.pokemon) for(const rid of (p.rosterIds||[])) if(!rids.has(rid)) throw new Error(`Unknown roster membership ${rid}`);
  }
}
