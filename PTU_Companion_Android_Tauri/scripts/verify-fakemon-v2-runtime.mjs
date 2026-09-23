import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const www=join(root,'www');
const index=readFileSync(join(www,'index.html'),'utf8');
const dataPos=index.indexOf('mobile-data.js');
const overlayPos=index.indexOf('fakemon-v2-data.js');
const runtimePos=index.indexOf('mobile-runtime.js');
assert.ok(dataPos>=0,'mobile-data.js is not loaded by Android index.html');
assert.ok(overlayPos>dataPos,'Fakemon v2 overlay must load after mobile-data.js');
assert.ok(runtimePos>overlayPos,'Fakemon v2 overlay must load before mobile-runtime.js');

const context={window:{},console};
vm.createContext(context);
vm.runInContext(readFileSync(join(www,'mobile-data.js'),'utf8'),context,{filename:'mobile-data.js',timeout:30000});
vm.runInContext(readFileSync(join(www,'fakemon-v2-data.js'),'utf8'),context,{filename:'fakemon-v2-data.js',timeout:30000});

const data=context.window.__PTU_MOBILE_DATA__;
assert.ok(data,'Android mobile data bundle did not initialize');
const packId='campaign-homebrew-fakemon-1-leva';
const pack=(data.packs||[]).find(p=>String(p?.id||'')===packId);
assert.ok(pack,'Fakemon v2 bundled pack metadata missing from Android runtime');
assert.equal(pack.version,'2.0.1');
assert.equal(pack.bundledRuntimeOverlay,true);

const records=Object.values(data.records||{}).filter(r=>String(r?.contentPackId||'')===packId);
const counts=records.reduce((out,row)=>{out[row.kind]=(out[row.kind]||0)+1;return out;},{});
assert.deepEqual(counts,{species:13,moves:8,abilities:3});
assert.ok(records.every(r=>r.bundledRuntimeOverlay===true),'A stale Fakemon record survived the Android overlay');

const species=records.filter(r=>r.kind==='species');
assert.ok(species.every(r=>String(r.raw?.portrait_data_url||'').startsWith('data:image/')),'Every Fakemon v2 species must carry an offline portrait in Android');
const byKey=new Map(records.map(r=>[`${r.kind}:${r.id}`,r]));

const panzeus=byKey.get('species:panzeus');
assert.ok(panzeus,'Panzeus missing from Android runtime');
assert.equal(panzeus.raw.level_up_moves.slice(0,2).map(x=>`${x.level}:${x.move}`).join('|'),'4:Scratch|4:Growl');

for(const [id,dex] of [['greavard',971],['houndstone',972],['maschiff',942],['mabosstiff',943],['fidough',926],['dachsbun',927]]){
  const row=byKey.get(`species:${id}`);
  assert.ok(row,`${id} missing from Android runtime`);
  assert.equal(row.dexNumber,dex,`${id} dex mismatch in Android runtime`);
}
for(const [id,name,dex] of [['zorua-hisui','Hisuian Zorua',570],['zoroark-hisui','Hisuian Zoroark',571]]){
  const row=byKey.get(`species:${id}`);
  assert.ok(row,`${id} missing from Android runtime`);
  assert.equal(row.name,name);
  assert.equal(row.dexNumber,dex);
  assert.equal(row.raw.regional_form,'Hisui');
}
for(const id of ['guard-dog','well-baked-body','nectar-queen']) assert.ok(byKey.get(`abilities:${id}`),`Ability ${id} missing from Android runtime`);
for(const id of ['poltergeist','last-respects','comeuppance','alluring-voice','snowscape','burning-jealousy','skitter-smack','silk-trap']) assert.ok(byKey.get(`moves:${id}`),`Move ${id} missing from Android runtime`);

const ruleset=(data.rulesets||[]).find(r=>r.id==='all-provided-material');
assert.ok(ruleset,'all-provided-material ruleset missing');
const membership=(ruleset.packs||[]).find(p=>String(p?.pack_id||'')===packId);
assert.ok(membership?.enabled,'Fakemon v2 pack must be enabled in all-provided-material');
for(const row of records){
  assert.equal(data.resolved?.['all-provided-material']?.[row.kind]?.[row.id],row.versionId,`Resolved Android definition is stale for ${row.kind}:${row.id}`);
}

assert.equal(context.window.__PTU_FAKEMON_V2_BUNDLED_PACK__?.manifest?.version,'2.0.1');
console.log('PTU Companion Android Fakemon v2 runtime overlay verification: OK',counts);
