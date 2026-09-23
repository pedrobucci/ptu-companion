import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { inspectContentPack } from '../definitions/pack-importer.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const db=new DatabaseSync(join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'),{readOnly:true});
const packId='campaign-homebrew-fakemon-1-leva';
const fail=(m)=>{throw new Error(m)};
const rows=db.prepare('SELECT definition_kind,logical_id,raw_json FROM definition_versions WHERE content_pack_id=? ORDER BY definition_kind,logical_id').all(packId);
const counts=rows.reduce((o,r)=>(o[r.definition_kind]=(o[r.definition_kind]||0)+1,o),{});
if(counts.species!==13) fail(`Expected 13 species, got ${counts.species||0}`);
if(counts.moves!==8) fail(`Expected 8 moves, got ${counts.moves||0}`);
if(counts.abilities!==3) fail(`Expected 3 abilities, got ${counts.abilities||0}`);
const map=new Map(rows.map(r=>[`${r.definition_kind}:${r.logical_id}`,JSON.parse(r.raw_json)]));
const panzeus=map.get('species:panzeus');
if(!panzeus) fail('Panzeus missing');
const first=panzeus.level_up_moves.slice(0,2).map(x=>`${x.level}:${x.move}`).join('|');
if(first!=='4:Scratch|4:Growl') fail(`Panzeus opening moves incorrect: ${first}`);
for(const [id,name,dex] of [['greavard','Greavard',971],['houndstone','Houndstone',972],['maschiff','Maschiff',942],['mabosstiff','Mabosstiff',943],['fidough','Fidough',926],['dachsbun','Dachsbun',927]]){
  const s=map.get(`species:${id}`); if(!s) fail(`${name} missing`); if(s.dex_number!==dex) fail(`${name} dex mismatch`);
}
for(const [id,name,dex] of [['zorua-hisui','Hisuian Zorua',570],['zoroark-hisui','Hisuian Zoroark',571]]){
  const s=map.get(`species:${id}`); if(!s) fail(`${name} missing`); if(s.display_name!==name||s.regional_form!=='Hisui'||s.dex_number!==dex) fail(`${name} regional metadata mismatch`);
}
if(!map.get('abilities:guard-dog')||!map.get('abilities:well-baked-body')||!map.get('abilities:nectar-queen')) fail('New abilities missing');
for(const id of ['poltergeist','last-respects','comeuppance','alluring-voice','snowscape','burning-jealousy','skitter-smack','silk-trap']) if(!map.get(`moves:${id}`)) fail(`Move ${id} missing`);
if(map.get('species:maschiff').ability_slots.some(x=>x.name==='Stackout')) fail('Stackout typo was not normalized');
if(map.get('species:panthore').egg_moves.some(x=>x.move==='Eeire Impulse')) fail('Eerie Impulse typo was not normalized');
if(!rows.filter(r=>r.definition_kind==='species').every(r=>JSON.parse(r.raw_json).portrait_data_url?.startsWith('data:image/webp;base64,'))) fail('One or more species portraits are missing from default seed');
db.close();

const archive=readFileSync(join(root,'bundled-packs',`${packId}-2.0.1.ptucp`));
const inspected=inspectContentPack(archive);
if(inspected.manifest.id!==packId||inspected.manifest.version!=='2.0.1') fail('Pack manifest id/version mismatch');
if(inspected.counts.species!==13||inspected.counts.moves!==8||inspected.counts.abilities!==3) fail(`Pack definition counts mismatch: ${JSON.stringify(inspected.counts)}`);
const art=[...inspected.entries.keys()].filter(x=>x.startsWith('assets/species/')&&x.endsWith('.webp'));
if(art.length!==13) fail(`Expected 13 species artwork files, got ${art.length}`);
console.log('Fakemon 1 leva v2 verified:',counts,'artwork=',art.length,'archive=',inspected.archiveSha256);
