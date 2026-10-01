import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openDatabase } from '../persistence/database.mjs';
import { CampaignRepository } from '../persistence/repository.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const windowsPath=join(root,'rules','pokemon-form-campaign-state.mjs');
const androidPath=join(root,'../PTU_Companion_Android_Tauri/www/rules/pokemon-form-campaign-state.mjs');
const windows=await import(pathToFileURL(windowsPath));
const android=await import(pathToFileURL(androidPath));
const cases=[
  {pokemon:{hp:0,maxHp:50,injuries:3},delta:50,hp:35,tempHp:15},
  {pokemon:{hp:45,maxHp:50,injuries:3},delta:5,hp:45,tempHp:5},
  {pokemon:{hp:40,maxHp:50,injuries:0},delta:20,hp:50,tempHp:10},
  {pokemon:{hp:35,maxHp:50,injuries:3},delta:-20,hp:15,tempHp:0}
];
for(const [label,engine] of [['Windows',windows],['Android',android]]){
  for(const test of cases){
    const result=engine.applyPokemonHpDelta(test.pokemon,test.delta);
    assert.equal(result.pokemon.hp,test.hp,`${label}: HP delta ${test.delta} with ${test.pokemon.injuries} Injuries`);
    assert.equal(result.pokemon.tempHp||0,test.tempHp,`${label}: Temporary HP overflow`);
    assert.equal(result.pokemon.maxHp,test.pokemon.maxHp,`${label}: real Max HP stays unchanged`);
  }
}

for(const path of [join(root,'static-preview','app.js'),join(root,'../PTU_Companion_Android_Tauri/www/app.js')]){
  const source=readFileSync(path,'utf8');
  assert.match(source,/function injuryHealingHpLimit\(maxHp,injuries\)/,`${path}: healing cap helper missing`);
  assert.match(source,/injuryHealingHpLimit\(p\.maxHp,p\.injuries\)-p\.hp/,`${path}: manual Pokémon healing bypasses Injury cap`);
  assert.match(source,/injuryHealingHpLimit\(p\.maxHp,p\.injuries\),p\.hp\+healing/,`${path}: healing items bypass Injury cap`);
  assert.match(source,/Math\.max\(Number\(p\.hp\|\|0\),injuryHealingHpLimit\(p\.maxHp,p\.injuries\)\)/,`${path}: withdrawal healing bypasses Injury cap`);
  assert.match(source,/injuryHealingHpLimit\(resolved\.derived\.maxHp,t\.details\?\.injuries\)/,`${path}: Trainer cap is not recalculated from persisted Injuries`);
  assert.match(source,/Injuries limit healing to \$\{injuryHealingHpLimit\(p\.maxHp,p\.injuries\)\} HP/,`${path}: Pokémon healing limit is not visible`);
  assert.match(source,/Injuries limit healing to \$\{der\.healingHpLimit\} HP/,`${path}: Trainer healing limit is not visible`);
}

const db=openDatabase(':memory:');
try{
  const repo=new CampaignRepository(db);
  const state={
    activeProfileId:'injury-persistence',
    trainer:{id:'injury-persistence',name:'Injury QA',title:'Trainer',level:10,exp:0,nextExp:10,money:0,ptuPoints:0,badges:0,stats:{hp:10},derived:{},skills:{},equipment:{},modifiers:[],gmGrants:[],history:[],details:{currentHp:80,injuries:3}},
    pokemon:[{id:'injury-pokemon',name:'Testmon',species:'Testmon',level:10,types:['Normal'],hp:27,maxHp:50,injuries:3,ball:'Poké Ball',heldItem:null,storage:false,loyalty:3,rosterIds:[],combatStages:{},details:{}}],
    rosters:[],inventory:[],npcs:[],shop:{preset:'Poké Mart',discountPct:0,mode:'buy',cart:{}},ui:{round:1,scene:1,day:1}
  };
  repo.saveState(state,{createRevision:false});
  const loaded=repo.loadState('injury-persistence');
  assert.equal(loaded.pokemon[0].hp,27,'current HP should persist without automatic reduction');
  assert.equal(loaded.pokemon[0].maxHp,50,'real Max HP should persist');
  assert.equal(loaded.pokemon[0].injuries,3,'Injuries should persist');
  assert.equal(Math.floor(loaded.pokemon[0].maxHp*(10-loaded.pokemon[0].injuries)/10),35,'healing limit should recompute after reload');
  assert.equal(loaded.trainer.details.currentHp,80,'Trainer current HP should persist unchanged');
  assert.equal(loaded.trainer.details.injuries,3,'Trainer Injuries should persist');
}finally{db.close();}

console.log('Issue #39 PTU Injury healing limit verified in Windows and Android; real Max HP and damage remain unchanged.');
