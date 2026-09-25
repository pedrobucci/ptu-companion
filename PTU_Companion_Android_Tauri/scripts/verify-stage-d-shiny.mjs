import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolvePokemonPresentation} from '../www/rules/pokemon-forms.mjs';

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
assert.equal(r.presentation.artworkUrl,'night-shiny.png');
r=resolvePokemonPresentation({species,formState:{baseFormId:'night',activeFormId:'charged'},isShiny:true});
assert.equal(r.presentation.artworkUrl,'charged-normal.png','Android active Form normal artwork must outrank lower-layer Shiny artwork');
assert.equal(r.presentation.isShiny,true);
assert.equal(r.presentation.artwork.hasDedicatedShinyArtwork,false);
r=resolvePokemonPresentation({species,formState:{baseFormId:'night',activeFormId:'radiant'},isShiny:true});
assert.equal(r.presentation.artworkUrl,'radiant-shiny.png');
r=resolvePokemonPresentation({species:{...species,artwork:{normal:'only-normal.png'},forms:[]},isShiny:true});
assert.equal(r.presentation.isShiny,true);
assert.equal(r.presentation.artworkUrl,'only-normal.png','Shiny Android Pokémon must retain Shiny state when only normal art exists');

const app=await readFile(new URL('../www/app.js',import.meta.url),'utf8');
const api=await readFile(new URL('../www/mobile-api.mjs',import.meta.url),'utf8');
for(const token of [
  'p.details.isShiny=!!(p.details.isShiny??p.details.is_shiny??p.isShiny??p.is_shiny??false)',
  "manualFormApprovals:[],isShiny:false",
  "isShiny:!!f.isShiny",
  "label:'Shiny'",
  "chip('★ SHINY','chip-gold')",
  '__PTU_RESOLVED_POKEMON_ARTWORK__',
  'Shiny state · normal artwork fallback',
  'Form mechanics and Shiny presentation are independent layers.'
]) assert.ok(app.includes(token),`Android Stage D UI contract missing: ${token}`);
assert.ok(api.includes('resolvePokemonPresentation'),'Android API must resolve Form + Shiny presentation');
assert.ok(api.includes('window.__PTU_RESOLVED_POKEMON_ARTWORK__'),'Android runtime must expose resolved Form/Shiny artwork');
assert.ok(api.includes('resolved.presentation?.artworkUrl'),'Android artwork bridge must prefer resolved presentation artwork');
const reset="if(pv.evolved){d.formState={schemaVersion:1,baseFormId:'base',activeFormId:null};d.manualFormApprovals=[];}";
assert.equal(app.split(reset).length-1,1,'Android evolution Form reset should exist exactly once');

console.log('Stage D Android Shiny presentation regression OK');
