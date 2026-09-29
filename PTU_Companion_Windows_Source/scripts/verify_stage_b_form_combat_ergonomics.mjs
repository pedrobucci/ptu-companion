import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const repo=resolve(root,'..');
const appPaths=[join(root,'static-preview','app.js'),join(repo,'PTU_Companion_Android_Tauri','www','app.js')];
const auditJson=join(repo,'docs','data','PTU_FORMS_COMBAT_RESOURCE_AUDIT.json');
const auditMd=join(repo,'docs','PTU_FORMS_COMBAT_RESOURCE_AUDIT.md');

function extractFunction(src,name){
  const match=new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);
  if(!match)throw new Error(`Missing function ${name}`);
  const start=match.index;const tail=src.slice(start+1);const next=/\n(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/.exec(tail);const end=next?start+1+next.index:src.length;
  return src.slice(start,end).trim();
}

const sources=[];
for(const path of appPaths){
  const src=await readFile(path,'utf8');sources.push(src);
  for(const needle of [
    'function pokemonFormCombatPresentation',
    'function pokemonFormCombatIndicator',
    'const formCombatIndicator=pokemonFormCombatIndicator(p,data);',
    "section('ACTIVE STATE',`${formCombatIndicator}<div class=\"battle-controls\">",
    'function nextRound(){ state.ui.round+=1;',
    'async function endScene(){ state.ui.scene+=1; state.ui.round=1;',
    'function newDay(){ state.ui.day+=1; state.ui.scene=1; state.ui.round=1;',
  ])assert.ok(src.includes(needle),`${path} missing ${needle}`);
  assert.ok(
    src.includes('Action/frequency costs are shown by the source rules but are not silently consumed by the Form engine.') ||
    src.includes('Combat Actions and Scene/Daily uses share the Pokémon Combat ledger. Extended Actions remain source-labeled but are not converted into turn actions.'),
    `${path} missing recognized Form resource lifecycle note`,
  );

  const history=[{title:'Pokémon Form changed',detail:'Zed: 10% Forme → 10% Forme + Complete Forme · Daily · Swift Action'}];
  const ctx={
    trainer:()=>({history}),
    pokemonFormCurrentState:()=>({schemaVersion:1,baseFormId:'ten-percent-forme',activeFormId:'complete-from-10'}),
    pokemonFormStateLabel:(state,forms)=>{const find=id=>forms.find(form=>form.id===id)?.name||id;if(state.baseFormId==='base')return state.activeFormId?`Canonical Base + ${find(state.activeFormId)}`:'Canonical Base';return state.activeFormId?`${find(state.baseFormId)} + ${find(state.activeFormId)}`:find(state.baseFormId);},
    esc:value=>String(value),
    chip:(value,tone)=>`[${tone}:${value}]`,
  };
  vm.createContext(ctx);
  vm.runInContext(extractFunction(src,'pokemonFormCombatPresentation'),ctx);
  vm.runInContext(extractFunction(src,'pokemonFormCombatIndicator'),ctx);
  const p={name:'Zed',details:{speciesDefinitionId:'zygarde'}};
  const data={species:{forms:[{id:'ten-percent-forme',name:'10% Forme'},{id:'complete-from-10',name:'Complete Forme'}]}};
  const model=ctx.pokemonFormCombatPresentation(p,data);
  assert.equal(model.label,'10% Forme + Complete Forme');assert.equal(model.recent.detail,history[0].detail);
  const html=ctx.pokemonFormCombatIndicator(p,data);assert.match(html,/Current Form/);assert.match(html,/10% Forme \+ Complete Forme/);assert.match(html,/Latest transition/);assert.match(html,/Daily · Swift Action/);
}

for(const name of ['pokemonFormCombatPresentation','pokemonFormCombatIndicator'])assert.equal(extractFunction(sources[0],name),extractFunction(sources[1],name),`${name} diverged between Windows and Android`);

const audit=JSON.parse(await readFile(auditJson,'utf8'));
assert.equal(audit.schema_version,1);assert.equal(audit.status,'historical_pre_ledger_snapshot');assert.equal(audit.superseded_by,'docs/PTU_COMBAT_SESSION_LEDGER.md');assert.equal(audit.conclusion,'informational_only');assert.equal(audit.automatic_spending_supported,false);assert.deepEqual(audit.exact_auto_spend_subset,[]);
assert.ok(audit.observed_state.some(row=>row.resource==='trainer_action_points'&&/Trainer AP only/.test(row.supports)));
assert.ok(audit.observed_state.some(row=>row.resource==='pokemon_combat_state'&&/action slots/.test(row.does_not_support)));
assert.ok(audit.blocked_spending_cases.some(row=>row.cost==='Extended Action'));
assert.ok(audit.blocked_spending_cases.some(row=>row.frequency==='Daily'));
assert.ok(audit.blocked_spending_cases.some(row=>row.frequency==='Scene'));
const md=await readFile(auditMd,'utf8');assert.match(md,/Historical checkpoint:/);assert.match(md,/Exact automatic-spending subset: \*\*0\*\*/);assert.match(md,/informational only/i);assert.match(md,/supersed|Current behavior/i);

console.log(JSON.stringify({combatResourceAudit:1,status:'historical_pre_ledger_snapshot',platforms:['windows','android'],automaticSpendingAtCheckpoint:false,exactAutoSpendSubsetAtCheckpoint:0,compactFormIndicator:true,latestTransitionVisible:true},null,2));
