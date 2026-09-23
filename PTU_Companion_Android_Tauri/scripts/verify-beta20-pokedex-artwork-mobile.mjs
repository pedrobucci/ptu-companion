import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const app=read('www/app.js'),css=read('www/styles.css');
const manifest=JSON.parse(read('www/pokemon-sprites/manifest.json'));
const data=JSON.parse(read('www/mobile-data.json'));
const context={window:null,location:{href:'https://app.local/index.html',protocol:'https:'},Response,URL,setTimeout,console,
  fetch(){throw Error('Network must not be used');},
  localStorage:{m:new Map(),getItem(k){return this.m.get(k)||null},setItem(k,v){this.m.set(k,String(v))}},
  document:{documentElement:{classList:{add(){}}},getElementById(){return {innerHTML:''}},createElement(tag){return {tag}},body:{appendChild(){}}},
  __TAURI__:{core:{invoke:async()=>[]}}};
context.window=context;vm.createContext(context);
for(const f of ['mobile-data.js','pokemon-sprites.js','mobile-runtime.js'])vm.runInContext(read('www/'+f),context);
await new Promise(r=>setTimeout(r,50));
assert(context.PTU_ANDROID_RUNTIME_READY,'Runtime must finish starting');
const extract=(from,to)=>app.slice(app.indexOf('function '+from),app.indexOf('function '+to));
vm.runInContext(extract('localSpeciesArtwork','itemDescription')+extract('definitionArtworkSrc','definitionModalBody'),context);
context.esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
for(const [id,file] of Object.entries({pikachu:'25.png',pichu:'172.png',raichu:'26.png','raichu-alola':'10100.png','nidoran-f':'29.png','nidoran-m':'32.png','mr-mime':'122.png','deoxys-attack-forme':'10001.png'})){
  const d=(await(await context.fetch('/api/definitions/species/'+id)).json()).definition;
  assert(d,`Missing definition: ${id}`);
  assert.equal(d.kind,'species',`Runtime kind missing: ${id}`);
  const src='pokemon-sprites/'+file;
  assert.equal(context.definitionArtworkSrc(d),src,id);
  assert.equal(context.pokemonPortraitUrl({details:{speciesDefinitionId:id}}),src);
  for(const detail of [false,true]){const html=context.definitionArtworkHtml(d,{detail});assert(html.includes(`src="${src}"`));assert(html.includes(detail?'definition-artwork-detail':'definition-artwork-thumb'));assert(!html.includes('hidden'));}
}
const rows=(await(await context.fetch('/api/definitions?kind=species&q=pikachu')).json()).rows;
assert(rows.length&&rows.every(d=>d.kind==='species'));
assert(rows.some(d=>context.definitionArtworkSrc(d)==='pokemon-sprites/25.png'));
const custom=(await(await context.fetch('/api/definitions/species/panthore')).json()).definition;
assert.match(context.definitionArtworkSrc(custom),/^data:image\//);
const override='data:image/png;base64,override';
assert.equal(context.definitionArtworkSrc({kind:'species',id:'pikachu',raw:{portrait_data_url:override}}),override);
assert.equal(context.definitionArtworkSrc({kind:'species',id:'new-custom-species'}),'creatures/default.svg');
assert.equal(context.localSpeciesArtwork('__proto__'),'');
assert(fs.existsSync(path.join(root,'www/creatures/default.svg')));
// Simulate failed pack, failed local PNG, then failed default: no hidden container or error loop.
const img={dataset:{localSrc:'pokemon-sprites/25.png'},src:'broken-pack',onerror(){},getAttribute(){return this.src}};
context.pokemonArtworkFallback(img);assert.equal(img.src,'pokemon-sprites/25.png');assert(img.onerror);
context.pokemonArtworkFallback(img);assert.equal(img.src,'creatures/default.svg');assert.equal(img.onerror,null);assert.equal(img.hidden,undefined);
const direct={dataset:{localSrc:'pokemon-sprites/25.png'},src:'pokemon-sprites/25.png',onerror(){},getAttribute(){return this.src}};
context.pokemonArtworkFallback(direct);assert.equal(direct.src,'creatures/default.svg');assert.equal(direct.onerror,null);
assert(!extract('definitionArtworkHtml','definitionModalBody').includes('hidden=true'));
assert(!extract('localSpeciesArtwork','itemDescription').includes('pokemonshowdown'));
const mobile=css.slice(css.lastIndexOf('@media(max-width:760px)'));
for(const rule of ['grid-template-areas:"art copy" "art source"','white-space:normal','overflow:visible','text-overflow:clip','overflow-wrap:anywhere'])assert(mobile.includes(rule),rule);
for(const area of ['art','copy','source'])assert(css.includes('grid-area:'+area));
const sprites=context.__PTU_LOCAL_SPECIES_SPRITES__;
for(const [key,d] of Object.entries(data.records).filter(([k])=>k.startsWith('species:')))assert(Object.hasOwn(sprites,d.id)||manifest.unavailable.includes(d.id),`Unaccounted species ${key}`);
for(const [id,entry] of Object.entries(manifest.species)){
  assert.equal(sprites[id],'pokemon-sprites/'+entry.file);
  const bytes=fs.readFileSync(path.join(root,'www/pokemon-sprites',entry.file));
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,id);
}
const html=read('www/index.html');assert(html.indexOf('pokemon-sprites.js')<html.indexOf('mobile-runtime.js'));
const pkg=JSON.parse(read('package.json')),tauri=JSON.parse(read('src-tauri/tauri.conf.json'));
assert.equal(pkg.version,'2.2.0-beta.22');assert.equal(tauri.version,pkg.version);assert.equal(tauri.bundle.android.versionCode,2002022);
assert.equal((await(await context.fetch('/api/health')).json()).version,'2.2.0-android-beta.22');
console.log(`PTU Android beta.21 artwork/mobile: OK (${Object.keys(sprites).length} mapped IDs, pack priority, regional forms, list/detail, bounded fallback, mobile CSS, version)`);
