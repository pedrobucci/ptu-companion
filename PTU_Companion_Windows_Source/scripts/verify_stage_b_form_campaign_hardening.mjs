import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const repo=resolve(root,'..');
const appPaths=[join(root,'static-preview','app.js'),join(repo,'PTU_Companion_Android_Tauri','www','app.js')];

function extractFunction(src,name){
  const match=new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);
  if(!match)throw new Error(`Missing function ${name}`);
  const start=match.index;const open=src.indexOf('{',start);if(open<0)throw new Error(`Missing body for ${name}`);
  let depth=0,quote=null,escape=false,templateDepth=0;
  for(let i=open;i<src.length;i++){
    const ch=src[i],next=src[i+1];
    if(quote){
      if(escape){escape=false;continue;}
      if(ch==='\\'){escape=true;continue;}
      if(quote==='`'&&ch==='$'&&next==='{'){templateDepth++;i++;continue;}
      if(quote==='`'&&templateDepth>0){if(ch==='{')templateDepth++;else if(ch==='}')templateDepth--;continue;}
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='/'&&next==='/'){const nl=src.indexOf('\n',i+2);i=nl<0?src.length:nl;continue;}
    if(ch==='/'&&next==='*'){const end=src.indexOf('*/',i+2);i=end<0?src.length:end+1;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return src.slice(start,i+1);
  }
  throw new Error(`Unclosed function ${name}`);
}

for(const path of appPaths){
  const src=await readFile(path,'utf8');
  for(const needle of [
    'function clearPokemonFormTempHpTracking',
    'function recordPokemonFormLifecycleFeedback',
    'async function revalidatePokemonFormAfterDirectHpMutation',
    'async function storePokemon',
    'async function withdrawPokemon',
    'async function useItem',
    "title:'Pokémon Form changed'",
    "title:'Temporary HP blocked'",
    'await revalidatePokemonFormAfterDirectHpMutation(p.id,{hpChanged:true,tempHpChanged:false,silent:true})',
  ])assert.ok(src.includes(needle),`${path} missing ${needle}`);
  assert.doesNotMatch(src,/(^|\n)function storePokemon\(id\)\{/m,`${path} retained synchronous storage path`);

  const p={id:'p1',name:'Testmon',species:'Testmon',hp:30,maxHp:40,tempHp:12,injuries:0,heldItem:null,storage:false,combatStages:{attack:2,defense:-1},details:{tempHp:12,formTempHpBySource:{schooling:12},formTempHpBlockOtherSources:{source:'schooling',activeFormId:'schooling'},formState:{schemaVersion:1,baseFormId:'base',activeFormId:'schooling'},speciesDefinitionId:'testmon'}};
  const trainerObj={history:[]};const commits=[];const toasts=[];const calls=[];
  const ctx={
    console,
    p,
    pokemon:id=>id==='p1'?p:null,
    trainer:()=>trainerObj,
    uid:()=>`h-${trainerObj.history.length+1}`,
    toast:(message,tone)=>toasts.push({message,tone}),
    returnHeldItemToBackpack:()=>{},
    revalidatePokemonFormAfterDirectHpMutation:async(id,options)=>{calls.push({kind:'revalidate',id,options});p.details.formState.activeFormId=null;return {valid:true};},
    commit:async message=>{commits.push(message);},
    inventoryItem:id=>ctx.item?.id===id?ctx.item:null,
    applyPokemonFormGameEventUi:async(id,event,options)=>{calls.push({kind:'apply',id,event,options});p.hp=Math.min(p.maxHp,p.hp+Number(event.delta||0));return {valid:true};},
    state:{ui:{gmOverride:false}},
  };
  vm.createContext(ctx);
  for(const name of ['formEventSlug','syncPokemonTempHpPersistence','clearPokemonFormTempHpTracking','pokemonFormStateSnapshot','pokemonFormStateLabel','pokemonFormAppliedRuleSummary','recordPokemonFormLifecycleFeedback'])vm.runInContext(extractFunction(src,name),ctx);

  ctx.clearPokemonFormTempHpTracking(p);
  assert.equal(p.tempHp,0);assert.equal(p.details.tempHp,0);assert.deepEqual({...p.details.formTempHpBySource},{});assert.equal('formTempHpBlockOtherSources' in p.details,false);

  const before={baseFormId:'base',activeFormId:'schooling'};p.details.formState={schemaVersion:1,baseFormId:'base',activeFormId:null};
  const feedback=ctx.recordPokemonFormLifecycleFeedback(p,before,{valid:true,hpAdjustment:{blockedTempHp:5},transitions:[{appliedRules:[{frequency:'Daily',actionCost:'Free Action'}]}]},{kind:'hp-changed'},{silent:true});
  assert.equal(feedback.formChanged,true);assert.equal(feedback.blockedTempHp,5);assert.equal(trainerObj.history.at(-2)?.title,'Pokémon Form changed');assert.match(trainerObj.history.at(-2)?.detail||'',/Daily · Free Action/);assert.equal(trainerObj.history.at(-1)?.title,'Temporary HP blocked');

  vm.runInContext(extractFunction(src,'storePokemon'),ctx);
  vm.runInContext(extractFunction(src,'withdrawPokemon'),ctx);
  p.details.formState={schemaVersion:1,baseFormId:'base',activeFormId:'schooling'};p.tempHp=8;p.details.tempHp=8;p.details.formTempHpBySource={schooling:8};p.details.formTempHpBlockOtherSources={source:'schooling',activeFormId:'schooling'};
  await ctx.storePokemon('p1');
  assert.equal(p.storage,true);assert.equal(p.hp,p.maxHp);assert.equal(p.tempHp,0);assert.deepEqual({...p.details.formTempHpBySource},{});assert.equal(p.combatStages.attack,0);assert.ok(calls.some(x=>x.kind==='revalidate'&&x.options.tempHpChanged===true));
  await ctx.withdrawPokemon('p1');assert.equal(p.storage,false);assert.equal(p.tempHp,0);

  vm.runInContext(extractFunction(src,'useItem'),ctx);
  ctx.item={id:'potion',name:'Potion',qty:2};p.hp=10;p.details.speciesDefinitionId='testmon';
  await ctx.useItem('potion','p1');
  const healCall=calls.findLast(x=>x.kind==='apply');assert.equal(healCall?.event.kind,'hp-adjust');assert.equal(healCall?.event.delta,20);assert.equal(ctx.item.qty,1);assert.equal(p.hp,30);
}

console.log(JSON.stringify({campaignHardeningModel:1,platforms:['windows','android'],storageTempHpCleanup:true,itemHealingLifecycle:true,formHistoryFeedback:true,directHpRevalidation:true},null,2));
