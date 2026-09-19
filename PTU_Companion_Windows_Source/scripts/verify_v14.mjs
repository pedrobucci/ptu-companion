import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DefinitionRepository } from '../definitions/repository.mjs';
import { resolveHeldItemEffect, applyHeldItemToEffectiveStats } from '../rules/held-item-engine.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const defs=new DefinitionRepository(join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'));
const ruleset='all-provided-material';
const fail=m=>{throw new Error(m)};
for(const [id,type] of [['panthore',['Electric','Dark']],['panzeus',['Electric','Dark']],['clefable-w',['Ghost','Normal']],['clefable-k',['Electric','Fighting']]]){
  const sp=defs.getResolved({rulesetId:ruleset,kind:'species',id}); if(!sp)fail(`Missing ${id}`);
  if(JSON.stringify(sp.types)!==JSON.stringify(type))fail(`Wrong types for ${id}: ${sp.types}`);
}
const ev=defs.getOutgoingEvolutions({rulesetId:ruleset,speciesName:'Panthore',sourceId:'fakemon-1-leva'});
if(!ev.some(e=>e.target.id==='panzeus'&&Number(e.toMinLevel)===20))fail('Panthore -> Panzeus Lv20 missing');
const full=defs.getResolved({rulesetId:ruleset,kind:'items',id:'full-incense'});
const fullEffect=resolveHeldItemEffect({itemDefinition:full,config:{},hasOutgoingEvolution:false});
if(!fullEffect.grantedAbilities.includes('Stall'))fail('Full Incense does not grant Stall');
const bright=defs.getResolved({rulesetId:ruleset,kind:'items',id:'bright-powder'});
if(resolveHeldItemEffect({itemDefinition:bright}).speedEvasionBonus!==2)fail('Bright Powder speed evasion');
const eviolite=defs.getResolved({rulesetId:ruleset,kind:'items',id:'eviolite'});
const evio=resolveHeldItemEffect({itemDefinition:eviolite,config:{stats:['defense','special_defense']},hasOutgoingEvolution:true});
if(!evio.valid||evio.statBonuses.defense!==5||evio.statBonuses.special_defense!==5)fail('Eviolite config/effect');
const eff=applyHeldItemToEffectiveStats({defense:8,special_defense:9,speed:10},evio);
if(eff.defense!==13||eff.special_defense!==14)fail('Eviolite effective stats');
const app=readFileSync(join(root,'static-preview','app.js'),'utf8');
for(const token of ['openHeldItemPicker','equipHeldItem','unequipHeldItem','deletePokemon','Delete Pokémon']) if(!app.includes(token))fail(`UI token missing ${token}`);
const seed=JSON.parse(readFileSync(join(root,'seed','default-state.json'),'utf8'));
for(const id of ['bright-powder','full-incense','expert-belt','eviolite','iron-ball']) if(!seed.inventory.some(i=>i.id===id&&i.qty>0))fail(`Seed Held Item missing ${id}`);
console.log('PTU Companion v1.4 verification: OK');
console.log('Fakemon pack Species: Panthore, Panzeus, Clefable W., Clefable K.');
console.log('Panthore -> Panzeus: Lv.20');
console.log('Held Item resolver: Bright Powder, Full Incense, Eviolite passed');
console.log('Held Item Backpack UI + Pokémon deletion UI: present');
defs.close();
