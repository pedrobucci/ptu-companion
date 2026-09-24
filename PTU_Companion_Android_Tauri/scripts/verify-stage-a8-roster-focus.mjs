import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const appSource=await readFile(new URL('../www/app.js',import.meta.url),'utf8');

assert.match(appSource,/function creatureCard\(p,compact=false,focusRoster=false\)/,'Android creature cards must support Roster-focused selection');
assert.match(appSource,/focusRoster\?`focusRosterPokemon\('\$\{p\.id\}'\)`:`selectPokemon\('\$\{p\.id\}'\)`/,'Roster-focused cards must use focusRosterPokemon while normal cards retain selectPokemon');
assert.match(appSource,/rosterMembers\(r\.id\)\.map\(p=>creatureCard\(p,false,true\)\)/,'Roster member cards must opt into focused selection');
assert.match(appSource,/function focusRosterPokemon\(id\)/,'Android must expose a dedicated Roster Pokémon focus handler');
assert.match(appSource,/route,selectPokemon,focusRosterPokemon,selectRoster/,'Roster focus handler must be exposed for inline UI actions');

const focusMatch=appSource.match(/function focusRosterPokemon\(id\)\{[\s\S]*?\n\}/);
assert.ok(focusMatch,'Could not isolate focusRosterPokemon implementation');
const focusSource=focusMatch[0];
assert.match(focusSource,/selectPokemon\(id,false\)/,'Roster focus must select without navigating to Creatures');
assert.doesNotMatch(focusSource,/selectPokemon\(id,true\)|route\(['"]creature['"]\)|state\.ui\.screen\s*=\s*['"]creature['"]/,'Roster focus must never route to Creatures');
assert.match(focusSource,/\.roster-layout \.selected-pokemon-actions/,'Roster focus must target the selected Pokémon actions/details section');
assert.match(focusSource,/scrollIntoView\(\{behavior:reduceMotion\?'auto':'smooth',block:'start'\}\)/,'Roster focus must scroll the selected section into view and respect reduced motion');

let selectedArgs=null;
let scrollOptions=null;
const target={scrollIntoView(options){scrollOptions=options;}};
const actionNode={closest(selector){assert.equal(selector,'.section-card');return target;}};
const context={
  state:{ui:{screen:'rosters'}},
  selectPokemon(id,go){selectedArgs=[id,go];},
  document:{querySelector(selector){return selector==='.roster-layout .selected-pokemon-actions'?actionNode:null;}},
  window:{matchMedia(){return {matches:false};}},
  setTimeout(fn){fn();},
};
vm.createContext(context);
vm.runInContext(`${focusSource}; focusRosterPokemon('gempy');`,context);
assert.deepEqual(selectedArgs,['gempy',false],'Roster tap must select the Pokémon without navigation');
assert.equal(scrollOptions?.behavior,'smooth','Normal motion should use smooth scrolling');
assert.equal(scrollOptions?.block,'start','Selected Pokémon section should align from its start');

scrollOptions=null;
context.window.matchMedia=()=>({matches:true});
vm.runInContext(`focusRosterPokemon('sparkit');`,context);
assert.equal(scrollOptions?.behavior,'auto','Reduced-motion preference must disable smooth scrolling');

console.log('Stage A.8 Android Roster focus regression OK');
