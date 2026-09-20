import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataRevision='5c776e225f2150862e021062d7f304c8958368cc';
const spriteRevision='6e3e7c43e86db0e1b2277795cfee41b11e8df2a4';
const dataBase=`https://raw.githubusercontent.com/PokeAPI/pokeapi/${dataRevision}/data/v2/csv/`;
const spriteBase=`https://raw.githubusercontent.com/PokeAPI/sprites/${spriteRevision}/sprites/pokemon/`;
async function download(url){const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`${r.status}: ${url}`);return Buffer.from(await r.arrayBuffer());}
async function csv(name){const lines=(await download(dataBase+name+'.csv')).toString().trim().split(/\r?\n/);const keys=lines.shift().split(',');return lines.map(l=>Object.fromEntries(l.split(',').map((v,i)=>[keys[i],v])));}
const pokemon=await csv('pokemon'), species=await csv('pokemon_species');
const byName=new Map(pokemon.map(p=>[p.identifier,p]));
const defaults=new Map(pokemon.filter(p=>p.is_default==='1').map(p=>[p.species_id,p]));
const speciesIds=new Map(species.map(p=>[p.identifier,p.id]));
// PTU form names differ from PokeAPI. Never strip regional/form suffixes heuristically.
const aliases={
  'darmanitan-galar-standard-mode':'darmanitan-galar-standard','darmanitan-galar-zen-mode':'darmanitan-galar-zen',
  'darmanitan-standard-mode':'darmanitan-standard','darmanitan-zen-mode':'darmanitan-zen',
  'deoxys-attack-forme':'deoxys-attack','deoxys-defense-forme':'deoxys-defense','deoxys-normal-forme':'deoxys-normal','deoxys-speed-forme':'deoxys-speed',
  'eiscue-ice-face':'eiscue-ice','eiscue-noice-face':'eiscue-noice',
  'giratina-altered-forme':'giratina-altered','giratina-origin-forme':'giratina-origin','hoopa-confined':'hoopa',
  'kyurem-black-fusion-forme':'kyurem-black','kyurem-normal-forme':'kyurem','kyurem-white-fusion-forme':'kyurem-white',
  'landorus-incarnate-forme':'landorus-incarnate','landorus-therian-forme':'landorus-therian',
  'meloetta-aria-forme':'meloetta-aria','meloetta-step-forme':'meloetta-pirouette',
  'meowstic-f':'meowstic-female','meowstic-m':'meowstic-male',
  'minior-core':'minior-red','minior-meteor':'minior-red-meteor',
  'necrozma-dawn-wings':'necrozma-dawn','necrozma-dusk-mane':'necrozma-dusk',
  'pidgeot--pidgey':'pidgeot','pidgeotto--pidgey':'pidgeotto','pidgey--pidgey':'pidgey',
  'rotom-normal-form':'rotom','shaymin-land-forme':'shaymin-land','shaymin-sky-forme':'shaymin-sky',
  'thundurus-incarnate-forme':'thundurus-incarnate','thundurus-therian-forme':'thundurus-therian',
  'tornadus-incarnate-forme':'tornadus-incarnate','tornadus-therian-forme':'tornadus-therian',
  'wishiwashi-schooling':'wishiwashi-school','wormadam-plant-cloak':'wormadam-plant','wormadam-sandy-cloak':'wormadam-sandy','wormadam-trash-cloak':'wormadam-trash',
  'zacian-crowned-sword-forme':'zacian-crowned','zacian-hero-of-many-battles-forme':'zacian',
  'zamazenta-crowned-shield-forme':'zamazenta-crowned','zamazenta-hero-of-many-battles-forme':'zamazenta',
  'zygarde-10-forme':'zygarde-10','zygarde-50-forme':'zygarde-50','zygarde-complete-forme':'zygarde-complete'
};
// Aggregate entry has no single correct appliance image; other entries lack upstream sprites.
const unavailable=new Set(['rotom-appliance-forms','browt','chickute','gecqua','heafinha','needlene','pombon','terroster','panthore','panzeus','clefable-w','clefable-k']);
const bundle=JSON.parse(fs.readFileSync(path.join(root,'www/mobile-data.json'),'utf8'));
const ids=[...new Set(Object.entries(bundle.records).filter(([k])=>k.startsWith('species:')).map(([,d])=>d.id))].sort();
const manifest={dataRevision,spriteRevision,species:{},unavailable:[...unavailable].sort()};
for(const id of ids){
  if(unavailable.has(id))continue;
  const name=aliases[id]||id;
  const p=byName.get(name)||defaults.get(speciesIds.get(name));
  if(!p)throw new Error(`Unmapped species: ${id}`);
  manifest.species[id]={file:`${p.id}.png`,identifier:p.identifier};
}
const dir=path.join(root,'www/pokemon-sprites');fs.mkdirSync(dir,{recursive:true});
const files=[...new Set(Object.values(manifest.species).map(p=>p.file))];
let next=0;
await Promise.all(Array.from({length:8},async()=>{while(next<files.length){const file=files[next++],dest=path.join(dir,file);const bytes=fs.existsSync(dest)?fs.readFileSync(dest):await download(spriteBase+file);if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error(`Not PNG: ${file}`);fs.writeFileSync(dest,bytes);}}));
for(const entry of Object.values(manifest.species))entry.sha256=createHash('sha256').update(fs.readFileSync(path.join(dir,entry.file))).digest('hex');
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const map=Object.fromEntries(Object.entries(manifest.species).map(([id,e])=>[id,'pokemon-sprites/'+e.file]));
fs.writeFileSync(path.join(root,'www/pokemon-sprites.js'),'// Generated by scripts/prepare-pokemon-sprites.mjs; exact PTU IDs only.\nwindow.__PTU_LOCAL_SPECIES_SPRITES__ = '+JSON.stringify(map,null,2)+';\n');
console.log(`${ids.length} species: ${Object.keys(map).length} mapped to ${files.length} offline PNGs; ${unavailable.size} explicit fallback entries.`);
