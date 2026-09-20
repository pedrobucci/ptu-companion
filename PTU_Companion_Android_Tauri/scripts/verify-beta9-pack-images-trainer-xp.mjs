import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
globalThis.window=globalThis;globalThis.location={href:'https://app.local/index.html',protocol:'https:'};
globalThis.localStorage={m:new Map(),getItem(k){return this.m.get(k)||null},setItem(k,v){this.m.set(k,String(v))}};
globalThis.document={documentElement:{classList:{add(){}}},getElementById(){return {innerHTML:''}},createElement(tag){return {tag,src:'',onload:null,onerror:null}},body:{appendChild(n){if(n.tag==='script'&&n.onload)setTimeout(()=>n.onload(),0)}}};
globalThis.__TAURI__={core:{invoke:async cmd=>cmd==='load_content_packs'?[]:Promise.reject(new Error('unexpected invoke '+cmd))}};
vm.runInThisContext(fs.readFileSync(path.join(root,'www/mobile-data.js'),'utf8'));
vm.runInThisContext(fs.readFileSync(path.join(root,'www/mobile-runtime.js'),'utf8'));
await new Promise(r=>setTimeout(r,40));
const health=await (await fetch('/api/health')).json();if(health.version!=='2.2.0-android-beta.20')throw new Error('Wrong beta.9 health version');
const portrait=window.__PTU_SPECIES_PORTRAIT__('panthore');if(!String(portrait||'').startsWith('data:image/png;base64,'))throw new Error('Bundled Panthore portrait was not resolved');
for(const id of ['panthore','panzeus','clefable-w','clefable-k','greavard','houndstone','maschiff','mabosstiff']){
  const r=await fetch(`/api/definitions/species/${id}`);if(!r.ok)throw new Error(`Species ${id} missing`);const d=(await r.json()).definition;if(!String(d?.raw?.portrait_data_url||'').startsWith('data:image/'))throw new Error(`Portrait ${id} missing from mobile bundle`);
}
const state=(await (await fetch('/api/state')).json()).state;let trainer=structuredClone(state.trainer);trainer.exp=15;trainer.nextExp=10;
const draft={milestoneChoice:'',milestoneLevelUp:false,statAllocations:{hp:0,attack:0,defense:0,spAttack:0,spDefense:0,speed:0},offensiveStatAllocations:{attack:0,spAttack:0},features:[],edges:[],skillEdges:[]};
let r=await fetch('/api/trainer/progression-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trainer,draft,gmOverride:false,includeOptions:false})});let p=(await r.json()).preview;if(p.xpCost!==10||p.availableXp!==15)throw new Error('Normal level-up XP cost is not 10');
trainer.exp=5;r=await fetch('/api/trainer/progression-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trainer,draft,gmOverride:false,includeOptions:false})});p=(await r.json()).preview;if(!p.errors.some(x=>x.includes('requires 10 Trainer Experience')))throw new Error('Insufficient Trainer XP was not rejected');
trainer.exp=15;const milestoneDraft={...draft,milestoneLevelUp:true};r=await fetch('/api/trainer/progression-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trainer,draft:milestoneDraft,gmOverride:true,includeOptions:false})});p=(await r.json()).preview;if(p.xpCost!==0||!p.milestoneLevelUp)throw new Error('GM milestone should cost 0 XP');
const edgeRows=(await (await fetch('/api/definitions?kind=edges&limit=50')).json()).rows;const featureRows=(await (await fetch('/api/definitions?kind=features&limit=50')).json()).rows;if(!edgeRows.length||!featureRows.length)throw new Error('Ruleset definitions unavailable');
trainer.exp=10;
r=await fetch('/api/trainer/xp-purchase',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trainer,kind:'edges',id:edgeRows[0].id,selections:{},manualConfirm:true,gmOverride:true})});let buy=await r.json();if(!r.ok)throw new Error('Edge XP purchase failed: '+JSON.stringify(buy));if(buy.preview.cost!==1||buy.updatedTrainer.exp!==9)throw new Error('Edge XP purchase cost mismatch');
trainer=buy.updatedTrainer;
r=await fetch('/api/trainer/xp-purchase',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trainer,kind:'features',id:featureRows[0].id,selections:{},manualConfirm:true,gmOverride:true})});buy=await r.json();if(!r.ok)throw new Error('Feature XP purchase failed: '+JSON.stringify(buy));if(buy.preview.cost!==2||buy.updatedTrainer.exp!==7)throw new Error('Feature XP purchase cost mismatch');
console.log('PTU Companion Android v2.2.0-beta.20 pack images + Trainer XP verification: OK');
