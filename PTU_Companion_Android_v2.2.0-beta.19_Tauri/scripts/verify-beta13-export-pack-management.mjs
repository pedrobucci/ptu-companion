import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

globalThis.window=globalThis;
globalThis.location={href:'https://app.local/index.html',protocol:'https:'};
const mem=new Map();
globalThis.localStorage={getItem(k){return mem.get(k)||null},setItem(k,v){mem.set(k,String(v))}};
globalThis.document={documentElement:{classList:{add(){}}},getElementById(){return {innerHTML:''}},createElement(tag){return {tag,src:'',onload:null,onerror:null}},body:{appendChild(n){if(n.tag==='script'&&n.onload)setTimeout(()=>n.onload(),0)}}};
globalThis.__TAURI__={core:{invoke:async cmd=>cmd==='load_content_packs'?[]:Promise.reject(new Error('unexpected invoke '+cmd))}};
vm.runInThisContext(fs.readFileSync(path.join(root,'www/mobile-data.js'),'utf8'));
vm.runInThisContext(fs.readFileSync(path.join(root,'www/mobile-runtime.js'),'utf8'));
await new Promise(r=>setTimeout(r,30));

let response=await fetch('/api/content-packs');
let payload=await response.json();
const core=payload.packs.find(p=>p.id==='ptu-core-1.05');
if(!core?.locked || core?.toggleable!==false) throw new Error('Core pack should be locked in Android pack manager.');
const optional=payload.packs.find(p=>p.id==='campaign-homebrew-fakemon-1-leva') || payload.packs.find(p=>p.builtIn && !p.locked);
if(!optional) throw new Error('No optional bundled pack available for toggle test.');
response=await fetch(`/api/content-packs/${encodeURIComponent(optional.id)}/enabled`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:false,rulesetId:payload.activeRulesetId})});
if(!response.ok) throw new Error('Could not disable bundled pack: '+await response.text());
payload=await (await fetch('/api/content-packs')).json();
if(payload.packs.find(p=>p.id===optional.id)?.enabled!==false) throw new Error('Bundled pack did not remain disabled.');
const persisted=JSON.parse(mem.get('ptu-companion-android-store-v1')||'{}');
if(persisted.packEnabledOverrides?.[payload.activeRulesetId]?.[optional.id]!==false) throw new Error('Bundled pack toggle was not persisted.');
response=await fetch('/api/content-packs/ptu-core-1.05/enabled',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:false,rulesetId:payload.activeRulesetId})});
if(response.ok) throw new Error('Core pack unexpectedly allowed disable.');

const app=fs.readFileSync(path.join(root,'www/app.js'),'utf8');
for(const token of ['window.__TAURI__?.dialog','window.__TAURI__?.fs','dialog.save','fs.writeTextFile','async function openContentPackManager()','📦 Content Packs','📦 Manage Packs']){
  if(!app.includes(token)) throw new Error('Missing beta.13 app token: '+token);
}
// Execute the Android branch of downloadJson with mocked native plugins.
let chosenPath=null, writtenPath=null, writtenText=null;
globalThis.window.PTU_ANDROID_BUILD=true;
globalThis.window.__TAURI__.dialog={save:async opts=>{if(opts?.filters?.[0]?.extensions?.[0]!=='json')throw new Error('JSON filter missing');chosenPath='content://downloads/test-save.json';return chosenPath;}};
globalThis.window.__TAURI__.fs={writeTextFile:async (path,text)=>{writtenPath=path;writtenText=text;}};
const da=app.indexOf('async function downloadJson('), db=app.indexOf('function semanticVersionParts',da);
if(da<0||db<0)throw new Error('Could not extract downloadJson');
vm.runInThisContext(app.slice(da,db));
const didSave=await globalThis.downloadJson({ok:true},'test-save.json');
if(!didSave||writtenPath!==chosenPath||JSON.parse(writtenText||'{}').ok!==true)throw new Error('Native Android JSON export flow failed.');
const cargo=fs.readFileSync(path.join(root,'src-tauri/Cargo.toml'),'utf8');
if(!cargo.includes('tauri-plugin-dialog')||!cargo.includes('tauri-plugin-fs'))throw new Error('Native dialog/fs plugins missing.');
const cap=fs.readFileSync(path.join(root,'src-tauri/capabilities/default.json'),'utf8');
if(!cap.includes('dialog:default')||!cap.includes('fs:allow-write-text-file'))throw new Error('Native dialog/fs permissions missing.');
console.log('PTU Companion Android beta.13 JSON export + Pack Manager verification: OK');
