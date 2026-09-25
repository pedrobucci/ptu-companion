import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../persistence/database.mjs';
import {CampaignRepository} from '../persistence/repository.mjs';
import {resolvePokemonPresentation} from '../rules/pokemon-forms.mjs';

const species={
  id:'stage-d-art',name:'Stage D Art',types:['Normal'],
  artwork:{normal:'species-normal.png',shiny:'species-shiny.png'},
  forms:[
    {id:'night',name:'Night Form',mode:'permanent',artwork:{normal:'night-normal.png',shiny:'night-shiny.png'},overrides:{types:{replace:['Dark']}}},
    {id:'charged',name:'Charged Form',mode:'transformation',artwork:{normal:'charged-normal.png'},overrides:{types:{replace:['Dark','Electric']}}},
    {id:'radiant',name:'Radiant Form',mode:'transformation',artwork:{normal:'radiant-normal.png',shiny:'radiant-shiny.png'},overrides:{types:{replace:['Fairy']}}}
  ]
};

let r=resolvePokemonPresentation({species,formState:{baseFormId:'night'},isShiny:true});
assert.equal(r.valid,true);
assert.equal(r.presentation.artworkUrl,'night-shiny.png','Permanent Form Shiny artwork should beat Species artwork');
assert.equal(r.presentation.artwork.sourceLayer,'base_form');
assert.equal(r.presentation.artwork.variant,'shiny');

r=resolvePokemonPresentation({species,formState:{baseFormId:'night',activeFormId:'charged'},isShiny:true});
assert.equal(r.presentation.artworkUrl,'charged-normal.png','Active Form normal artwork must beat lower-layer Shiny artwork');
assert.equal(r.presentation.artwork.sourceLayer,'active_form');
assert.equal(r.presentation.artwork.hasDedicatedShinyArtwork,false,'Shiny state must survive a normal-art fallback');

r=resolvePokemonPresentation({species,formState:{baseFormId:'night',activeFormId:'radiant'},isShiny:true});
assert.equal(r.presentation.artworkUrl,'radiant-shiny.png','Active Form Shiny artwork must have top priority');
assert.equal(r.presentation.artwork.hasDedicatedShinyArtwork,true);

r=resolvePokemonPresentation({species:{...species,artwork:{normal:'only-normal.png'},forms:[]},isShiny:true});
assert.equal(r.presentation.isShiny,true,'Shiny identity must not depend on dedicated artwork');
assert.equal(r.presentation.artworkUrl,'only-normal.png','Shiny without dedicated artwork must use the best normal artwork');
assert.equal(r.presentation.artwork.variant,'normal');

const temp=await mkdtemp(join(tmpdir(),'ptu-stage-d-shiny-'));
const db=openDatabase(join(temp,'campaign.sqlite3'));
try{
  const repo=new CampaignRepository(db);
  const seed=JSON.parse(await readFile(new URL('../seed/default-state.json',import.meta.url),'utf8'));
  const state=structuredClone(seed); state.activeProfileId='stage-d-shiny'; state.trainer.id='stage-d-shiny';
  const p=state.pokemon[0]; p.details={...(p.details||{}),isShiny:true,formState:{schemaVersion:1,baseFormId:'base',activeFormId:null}};
  repo.saveState(state,{createRevision:true});
  const loaded=repo.loadState('stage-d-shiny'); const saved=loaded.pokemon.find(x=>x.id===p.id);
  assert.equal(saved.details.isShiny,true,'Shiny identity must round-trip through SQLite details_json');
} finally { db.close(); await rm(temp,{recursive:true,force:true}); }

const app=await readFile(new URL('../static-preview/app.js',import.meta.url),'utf8');
const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
for(const token of [
  'p.details.isShiny=!!(p.details.isShiny??p.details.is_shiny??p.isShiny??p.is_shiny??false)',
  "manualFormApprovals:[],isShiny:false",
  "isShiny:!!f.isShiny",
  "label:'Shiny'",
  "chip('★ SHINY','chip-gold')",
  "params.set('shiny','1')",
  'Shiny state · normal artwork fallback',
  'Form mechanics and Shiny presentation are independent layers.'
]) assert.ok(app.includes(token),`Windows Stage D UI contract missing: ${token}`);
assert.ok(server.includes('resolvePokemonPresentation'),'Desktop API must resolve Form + Shiny presentation');
assert.ok(server.includes("const requestedShiny=url.searchParams.get('shiny')==='1'"),'Desktop portrait endpoint must accept Shiny presentation state');
assert.ok(server.includes('requestedPresentation?.artworkUrl'),'Desktop portrait endpoint must prefer resolved Form/Shiny artwork');
const reset="if(pv.evolved){d.formState={schemaVersion:1,baseFormId:'base',activeFormId:null};d.manualFormApprovals=[];}";
assert.equal(app.split(reset).length-1,1,'Evolution Form reset should exist exactly once after Stage C cleanup');

console.log('Stage D Windows Shiny presentation regression OK');
