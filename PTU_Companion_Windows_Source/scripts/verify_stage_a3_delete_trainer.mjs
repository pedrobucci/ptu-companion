import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../persistence/database.mjs';
import {CampaignRepository} from '../persistence/repository.mjs';

function trainerState(id, suffix) {
  const rosterId=`roster-${suffix}`;
  const pokemonId=`pokemon-${suffix}`;
  const npcId=`npc-${suffix}`;
  return {
    version:2,
    activeProfileId:id,
    trainer:{
      id,name:`Trainer ${suffix}`,title:`Title ${suffix}`,level:5,exp:2,nextExp:10,money:1000,ptuPoints:0,badges:0,portraitDataUrl:null,
      stats:{hp:10,attack:5,defense:5,spAttack:5,spDefense:5,speed:5},derived:{},skills:{},
      equipment:{head:null,body:null,mainHand:null,offHand:null,feet:null,accessory:null},modifiers:[],
      details:{},gmGrants:[{id:`grant-${suffix}`,type:'fixed',label:'Test Grant',target:'Focus',value:'+1',createdAt:'2026-09-22'}],
      history:[{id:`history-${suffix}`,date:'2026-09-22',title:'Test event',detail:suffix}]
    },
    pokemon:[{
      id:pokemonId,name:`Pokemon ${suffix}`,species:'Pidgey',level:5,types:['Normal','Flying'],hp:20,maxHp:20,injuries:0,
      ball:'Poké Ball',heldItem:null,img:null,storage:true,loyalty:3,rosterIds:[rosterId],combatStages:{},details:{}
    }],
    rosters:[{id:rosterId,name:`Roster ${suffix}`,role:'COMBAT',maxMembers:6,active:true,color:'#0b7b4b'}],
    inventory:[{id:`item-${suffix}`,icon:'◆',name:`Item ${suffix}`,category:'general',price:10,qty:1,consumable:false,equipSlot:null}],
    shop:{preset:'Poké Mart',discountPct:0,mode:'buy',cart:{}},
    npcs:[{id:npcId,initials:'NP',name:`NPC ${suffix}`,role:'Contact',tag:'Ally',affiliation:'Test',lastSeen:'Test',description:'Test',portraitDataUrl:null,notes:[`Note ${suffix}`]}],
    selectedPokemonId:pokemonId,selectedRosterId:rosterId,selectedNpcId:npcId,
    ui:{screen:'trainer',creatureTab:'sheet',trainerTab:'profile',toast:null,round:1,scene:1,day:1,gmOverride:false}
  };
}

const temp=await mkdtemp(join(tmpdir(),'ptu-stage-a3-'));
const dbPath=join(temp,'campaign.sqlite3');
const db=openDatabase(dbPath);
try {
  const repo=new CampaignRepository(db);
  const alpha=trainerState('trainer-alpha','alpha');
  const beta=trainerState('trainer-beta','beta');
  repo.saveState(alpha,{createRevision:true});
  repo.saveState(beta,{createRevision:true});
  repo.setActiveProfileId(alpha.activeProfileId);
  db.prepare(`INSERT INTO app_meta(key,value) VALUES('active_ruleset_id',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run('all-provided-material');

  assert.equal(repo.listProfiles().length,2,'fixture should create two Trainer profiles');
  assert.equal(repo.getActiveProfileId(),'trainer-alpha');

  const next=repo.deleteProfile('trainer-alpha');
  assert.equal(next,'trainer-beta','deleting the active Trainer should automatically select the remaining Trainer');
  assert.deepEqual(repo.listProfiles().map(p=>p.id),['trainer-beta'],'only the selected profile should be removed');

  const betaAfter=repo.loadState('trainer-beta');
  assert.equal(betaAfter.trainer.name,'Trainer beta','another Trainer must remain untouched');
  assert.equal(betaAfter.pokemon[0].id,'pokemon-beta','another Trainer Pokémon must remain untouched');
  assert.equal(betaAfter.rosters[0].id,'roster-beta','another Trainer roster must remain untouched');
  assert.equal(betaAfter.inventory[0].id,'item-beta','another Trainer inventory must remain untouched');
  assert.equal(betaAfter.npcs[0].id,'npc-beta','another Trainer NPCs must remain untouched');

  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM trainers WHERE id='trainer-alpha'").get().c,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM pokemon WHERE trainer_id='trainer-alpha'").get().c,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM rosters WHERE trainer_id='trainer-alpha'").get().c,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM inventory_items WHERE trainer_id='trainer-alpha'").get().c,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM npcs WHERE trainer_id='trainer-alpha'").get().c,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM gm_grants WHERE trainer_id='trainer-alpha'").get().c,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM trainer_history WHERE trainer_id='trainer-alpha'").get().c,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM save_revisions WHERE profile_id='trainer-alpha'").get().c,0);
  assert.equal(db.prepare("SELECT value FROM app_meta WHERE key='active_ruleset_id'").get().value,'all-provided-material','global settings must survive Trainer deletion');

  const none=repo.deleteProfile('trainer-beta');
  assert.equal(none,null,'repository must support removal of the final Trainer so the server can enter its replacement flow');
  assert.equal(repo.listProfiles().length,0);
  assert.equal(repo.getActiveProfileId(),null);
  assert.equal(db.prepare("SELECT value FROM app_meta WHERE key='active_profile_id'").get(),undefined,'stale active profile id must be cleared');
  assert.equal(db.prepare("SELECT value FROM app_meta WHERE key='active_ruleset_id'").get().value,'all-provided-material','global settings must survive final Trainer deletion');
} finally {
  db.close();
  await rm(temp,{recursive:true,force:true});
}

const [appSource,serverSource,repoSource]=await Promise.all([
  readFile(new URL('../static-preview/app.js',import.meta.url),'utf8'),
  readFile(new URL('../server.mjs',import.meta.url),'utf8'),
  readFile(new URL('../persistence/repository.mjs',import.meta.url),'utf8')
]);
assert.match(appSource,/async function deleteTrainerProfile\(\)/,'Windows UI must expose Trainer deletion');
assert.match(appSource,/styledConfirm\(\{title:'Delete Trainer'/,'Trainer deletion must use the standard styled modal');
assert.match(appSource,/method:'DELETE'/,'Windows UI must call the Trainer deletion API');
assert.match(appSource,/blankTrainerStateClient\('New Trainer','Trainer'\)/,'browser fallback must leave a usable blank Trainer after deleting the final profile');
assert.match(appSource,/Delete Active Trainer/,'Trainer switcher must expose deletion');
assert.match(appSource,/createTrainerProfile,deleteTrainerProfile,resetTrainerSheet/,'delete handler must be exposed to inline UI actions');
assert.doesNotMatch(appSource,/window\.confirm\s*\(/,'native browser confirm must not be used');
assert.match(serverSource,/req\.method==='DELETE'.*url\.pathname\.startsWith\('\/api\/profiles\/'\)/s,'server must implement DELETE /api/profiles/:id');
assert.match(serverSource,/replacementCreated/,'server must report the final-Trainer replacement flow');
assert.match(serverSource,/blankTrainerState\(\{name:'New Trainer',title:'Trainer'\}\)/,'server must create a blank replacement after deleting the final Trainer');
assert.doesNotMatch(repoSource,/At least one Trainer profile must remain/,'repository must not block deletion of the final Trainer');
assert.match(repoSource,/DELETE FROM app_meta WHERE key='active_profile_id'/,'repository must clear a stale active profile when none remain');

console.log('Stage A.3 Windows Trainer deletion regression OK');
