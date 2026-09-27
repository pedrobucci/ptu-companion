import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const repo=resolve(root,'..');
const appPaths=[join(root,'static-preview','app.js'),join(repo,'PTU_Companion_Android_Tauri','www','app.js')];
const repositoryPath=join(root,'persistence','repository.mjs');
const auditJsonPath=join(repo,'docs','data','PTU_FORMS_HP_MUTATION_AUDIT.json');
const auditMdPath=join(repo,'docs','PTU_FORMS_HP_MUTATION_AUDIT.md');

function extractFunction(src,name){
  const match=new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);
  if(!match)throw new Error(`Missing function ${name}`);
  const start=match.index;
  const tail=src.slice(start+1);
  const next=/\n(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/.exec(tail);
  const end=next?start+1+next.index:src.length;
  return src.slice(start,end).trim();
}

const appSources=[];
for(const path of appPaths){
  const src=await readFile(path,'utf8');appSources.push(src);
  for(const needle of [
    'async function applyPokemonProgression()',
    "if(!pv.evolved)await revalidatePokemonFormAfterDirectHpMutation(p.id,{hpChanged:true,tempHpChanged:false,silent:true});",
    "if(pv.evolved){d.formState={schemaVersion:1,baseFormId:'base',activeFormId:null};d.manualFormApprovals=[];}",
    'function pokemonFormStateLabel(formState={},forms=[])',
    'const formDefinitions=Array.isArray(payload?.baseSpecies?.forms)?payload.baseSpecies.forms:[];',
    'pokemonFormStateLabel(beforeState,formDefinitions)',
    'pokemonFormStateLabel(afterState,formDefinitions)',
    'state=migrateState(data);',
  ])assert.ok(src.includes(needle),`${path} missing ${needle}`);
  assert.match(src,/(?:async\s+)?function exportSave\(\)/,`${path} missing save export function`);

  const labelCtx={};vm.createContext(labelCtx);
  vm.runInContext(extractFunction(src,'formEventSlug'),labelCtx);
  vm.runInContext(extractFunction(src,'pokemonFormStateLabel'),labelCtx);
  const forms=[{id:'ten-percent-forme',name:'10% Forme'},{id:'complete-from-10',name:'Complete Forme'},{id:'schooling',name:'School Form'}];
  assert.equal(labelCtx.pokemonFormStateLabel({baseFormId:'ten-percent-forme',activeFormId:'complete-from-10'},forms),'10% Forme + Complete Forme');
  assert.equal(labelCtx.pokemonFormStateLabel({baseFormId:'base',activeFormId:'schooling'},forms),'Canonical Base + School Form');
  assert.equal(labelCtx.pokemonFormStateLabel({baseFormId:'unknown-form',activeFormId:null},forms),'unknown-form');

  const migrateCtx={
    state:null,
    ensureTrainerDetails:()=>{},
    normalizePokemonGender:value=>String(value||'None'),
    defaultState:()=>({version:2,trainer:{details:{}},pokemon:[],inventory:[],ui:{}}),
  };
  vm.createContext(migrateCtx);
  vm.runInContext(extractFunction(src,'pokemonCombatDefaultUi'),migrateCtx);
  vm.runInContext(extractFunction(src,'normalizePokemonCombatUiState'),migrateCtx);
  vm.runInContext(extractFunction(src,'migrateState'),migrateCtx);
  const original={
    version:2,
    trainer:{id:'t1',name:'Trainer',nextExp:10,details:{}},
    pokemon:[{
      id:'zygarde-1',name:'Zed',species:'Zygarde',level:50,hp:41,maxHp:82,tempHp:33,gender:'None',
      details:{
        tempHp:33,
        speciesDefinitionId:'zygarde',
        formState:{schemaVersion:1,baseFormId:'ten-percent-forme',activeFormId:'complete-from-10'},
        formTempHpBySource:{power_construct:33},
        formTempHpBlockOtherSources:{source:'power_construct',activeFormId:'complete-from-10'},
        notes:'active Form save',
      }
    }],
    inventory:[{id:'two-handed-sword'}],
    ui:{screen:'creature',inCombat:true,combat:{version:1,active:true,rosterId:'r1',activePokemonId:'zygarde-1',participantIds:['zygarde-1'],participants:{'zygarde-1':{pokemonId:'zygarde-1'}},log:[]}},
  };
  const imported=JSON.parse(JSON.stringify(original));
  const migrated=migrateCtx.migrateState(imported);const p=migrated.pokemon[0];
  assert.deepEqual({...p.details.formState},{schemaVersion:1,baseFormId:'ten-percent-forme',activeFormId:'complete-from-10'});
  assert.deepEqual({...p.details.formTempHpBySource},{power_construct:33});
  assert.deepEqual({...p.details.formTempHpBlockOtherSources},{source:'power_construct',activeFormId:'complete-from-10'});
  assert.equal(p.tempHp,33);assert.equal(p.details.tempHp,33);assert.equal(migrated.ui.inCombat,true);
  assert.equal(migrated.ui.combat.active,true);assert.deepEqual(Array.from(migrated.ui.combat.participantIds),['zygarde-1']);
}

for(const functionName of ['pokemonFormStateLabel','pokemonCombatDefaultUi','normalizePokemonCombatUiState','applyPokemonProgression','migrateState']){
  assert.equal(extractFunction(appSources[0],functionName),extractFunction(appSources[1],functionName),`${functionName} diverged between Windows and Android`);
}

const repository=await readFile(repositoryPath,'utf8');
assert.ok(repository.includes('tempHp:Number(fromJson(p.details_json, {}).tempHp||0)'), 'SQLite load no longer restores Temporary HP from details_json');
assert.ok(repository.includes("toJson({...p.details,tempHp:Number(p.tempHp??p.details?.tempHp??0)})"), 'SQLite save no longer preserves the complete Pokémon details object with mirrored Temporary HP');
assert.ok(repository.includes('const canonicalState = structuredClone({...state, version:2, activeProfileId:profileId});'), 'Revision snapshots no longer clone the complete campaign state');

const audit=JSON.parse(await readFile(auditJsonPath,'utf8'));
assert.equal(audit.schema_version,1);assert.equal(audit.summary.surfaces,14);assert.equal(audit.summary.uncovered_linked_surfaces,0);
assert.ok(audit.surfaces.some(row=>row.surface==='applyPokemonProgression — no evolution'&&row.lifecycle==='covered_in_this_pass'));
assert.ok(audit.surfaces.some(row=>row.surface==='applyPokemonProgression — evolution'&&row.classification==='intentional_form_reset'));
assert.ok((await readFile(auditMdPath,'utf8')).includes('Uncovered linked surfaces: **0**'));

console.log(JSON.stringify({
  persistenceFeedbackModel:1,
  platforms:['windows','android'],
  readableFormNames:true,
  activeFormJsonRoundTrip:true,
  combatSessionJsonRoundTrip:true,
  sqliteDetailsRoundTripGuard:true,
  hpMutationAuditSurfaces:audit.summary.surfaces,
  uncoveredLinkedHpMutationSurfaces:audit.summary.uncovered_linked_surfaces,
  progressionLifecycleRevalidation:true,
},null,2));
