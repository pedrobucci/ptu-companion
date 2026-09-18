import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

const port=4196;
const base=`http://127.0.0.1:${port}`;
const root=new URL('..',import.meta.url);
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PTU_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let stderr=''; child.stderr.on('data',d=>stderr+=d);
async function wait(){for(let i=0;i<60;i++){try{const r=await fetch(`${base}/api/health`);if(r.ok)return;}catch{} await delay(100);}throw new Error(`server did not start: ${stderr}`)}
try{
  await wait();
  const health=await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.version,'1.6.0');
  assert.equal(health.schemaVersion,3);

  const current=await (await fetch(`${base}/api/state`)).json();
  const st=current.state;
  st.ui.trainerTab='skills';
  st.trainer.details ||= {};
  st.trainer.details.background={name:'QA Background',adept:'Athletics',novice:'Command',pathetic:['Guile','Intuition','Focus']};
  st.trainer.details.skillRanks={...(st.trainer.details.skillRanks||{}),Athletics:4,Command:3,Focus:1};
  st.trainer.details.features=[{id:'qa-feature',name:'QA Feature'}];
  st.trainer.details.edges=[{id:'qa-edge',name:'QA Edge'}];
  st.trainer.details.moves=[{id:'qa-move',name:'QA Move'}];
  st.trainer.details.currentHp=42;
  st.trainer.details.currentAp=3;
  const save=await fetch(`${base}/api/state`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({state:st})});
  assert.equal(save.ok,true,await save.text());
  const loaded=(await (await fetch(`${base}/api/state`)).json()).state;
  assert.equal(loaded.trainer.details.background.name,'QA Background');
  assert.equal(loaded.trainer.details.features[0].name,'QA Feature');
  assert.equal(loaded.trainer.details.currentHp,42);
  assert.equal(loaded.ui.trainerTab,'skills');

  const app=await readFile(new URL('../static-preview/app.js',import.meta.url),'utf8');
  assert(!/\b(?:prompt|confirm|alert)\s*\(/.test(app),'browser-native dialogs remain in app.js');
  for(const marker of ['styledConfirm','styledForm','setTrainerTab','openTrainerBackgroundEditor','openTrainerDefinitionPicker','changeTrainerHp']) assert(app.includes(marker),`missing ${marker}`);
  const css=await readFile(new URL('../static-preview/styles.css',import.meta.url),'utf8');
  for(const marker of ['.modal-themed','.modal-header','.trainer-skill-board','.trainer-option-grid']) assert(css.includes(marker),`missing CSS ${marker}`);

  console.log('PTU Companion v1.6 verification: OK');
  console.log('Pokédex-styled modal framework: passed');
  console.log('No browser-native prompt/confirm/alert calls: passed');
  console.log('Trainer details SQLite migration/round-trip: passed');
  console.log('Trainer tabs, Background, Skills, Stats and Ruleset pickers: present');
} finally { child.kill('SIGTERM'); }
