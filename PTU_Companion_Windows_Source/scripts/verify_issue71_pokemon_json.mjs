import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../..');
for(const [platform,path] of [['Windows',resolve(root,'PTU_Companion_Windows_Source/static-preview/app.js')],['Android',resolve(root,'PTU_Companion_Android_Tauri/www/app.js')]]){
 const source=(await readFile(path,'utf8')).replace(/\r/g,'');
 const start=source.indexOf('async function exportPokemon(){'),end=source.indexOf('function exportSave(){',start);
 assert(start>=0&&end>start,`${platform}: Pokémon JSON functions exist`);
 let exported=null,confirm=true,formChoice={target:'copy'},commits=0,returns=0,sequence=0,persisted=null;
 const state={selectedPokemonId:'p1',pokemon:[{id:'p1',name:'Eevee',species:'Eevee',hp:10,rosterIds:['r1'],storage:false,heldItem:'Oran Berry',details:{abilities:['Run Away']}}],trainer:{history:[]}};
 const ctx={state,pokemon:()=>state.pokemon.find(p=>p.id===state.selectedPokemonId),trainer:()=>state.trainer,structuredClone,downloadJson:async(data)=>{exported=data;return true},toast(){},esc:v=>String(v??''),styledForm:async()=>formChoice,styledConfirm:async()=>confirm,uid:prefix=>`${prefix}-${++sequence}`,returnHeldItemToBackpack(){returns++},commit(){commits++;persisted=JSON.parse(JSON.stringify(state));},Date};
 vm.runInNewContext(source.slice(start,end).replace(/async $/, '')+'\nthis.exportPokemon=exportPokemon;this.importPokemonFile=importPokemonFile;',ctx);
 await ctx.exportPokemon();assert.equal(exported.format,'ptu-companion-pokemon');assert.equal(exported.version,1);assert.equal(exported.pokemon.id,undefined);assert.equal(exported.pokemon.rosterIds,undefined);assert.equal(exported.pokemon.details.abilities[0],'Run Away');
 const file=p=>({text:async()=>JSON.stringify({format:'ptu-companion-pokemon',version:1,pokemon:p})});
 await ctx.importPokemonFile(file({name:'Vaporeon',species:'Vaporeon',hp:20,rosterIds:['untrusted'],storage:false,details:{moves:['Surf']}}));
 const copy=ctx.state.pokemon[1];assert.equal(copy.name,'Vaporeon');assert.notEqual(copy.id,'p1');assert.equal(copy.storage,true);assert.deepEqual(Array.from(copy.rosterIds),[]);assert.equal(ctx.state.pokemon[0].name,'Eevee');assert.equal(persisted.pokemon[1].id,copy.id,'copy survives save serialization');assert.equal(commits,1);
 confirm=false;formChoice={target:'replace:0'};const before=JSON.stringify(ctx.state);await ctx.importPokemonFile(file({name:'Jolteon',species:'Jolteon',heldItem:'Magnet',rosterIds:[],details:{}}));assert.equal(JSON.stringify(ctx.state),before,'cancel does not mutate save');
 confirm=true;await ctx.importPokemonFile(file({name:'Jolteon',species:'Jolteon',heldItem:'Magnet',details:{moves:['Thunderbolt']}}));const replaced=ctx.state.pokemon[0];assert.equal(replaced.id,'p1');assert.deepEqual(Array.from(replaced.rosterIds),['r1']);assert.equal(replaced.storage,false);assert.equal(replaced.name,'Jolteon');assert.equal(persisted.pokemon[0].name,'Jolteon','replacement survives save serialization');assert.equal(returns,1);assert.equal(commits,2);
 const beforeInvalid=JSON.stringify(ctx.state);await ctx.importPokemonFile({text:async()=>'{bad'});assert.equal(JSON.stringify(ctx.state),beforeInvalid,'invalid JSON does not mutate save');
 console.log(`${platform}: versioned export, copy identity/storage/roster, replacement preservation, held item return, cancel and invalid-file safety OK`);
}
