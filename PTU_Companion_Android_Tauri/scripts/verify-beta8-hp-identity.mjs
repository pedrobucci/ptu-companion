import fs from 'node:fs';
import vm from 'node:vm';

const appPath=process.argv[2];
if(!appPath) throw new Error('app path required');
const src=fs.readFileSync(appPath,'utf8');

function extract(name, asyncFn=false){
  const marker=`${asyncFn?'async ':''}function ${name}(`;
  const start=src.indexOf(marker);
  if(start<0) throw new Error(`Missing ${name}`);
  const end=src.indexOf('\n}',start);
  if(end<0) throw new Error(`Cannot extract ${name}`);
  return src.slice(start,end+2);
}

const p={id:'p1',name:'Gempy',species:'Sableye',hp:48,maxHp:50,tempHp:0,loyalty:4,details:{}};
const trainerObj={history:[],details:{currentHp:49,tempHp:0}};
let commits=[];
let nextForm={name:'Nyx',loyalty:6,gender:'Female'};
const ctx={
  state:{selectedPokemonId:'p1'},
  pokemon:()=>p,
  trainer:()=>trainerObj,
  commit:async message=>{commits.push(message);},
  toast:(message)=>{throw new Error(`Unexpected toast: ${message}`);},
  styledForm:async()=>nextForm,
  uid:()=> 'history-test',
  tempHpValue:holder=>Math.max(0,Number(holder?.tempHp||0)),
  normalizePokemonGender:value=>{const raw=String(value??'').trim().toLowerCase();if(['male','m','masculino','♂'].includes(raw))return 'Male';if(['female','f','feminino','♀'].includes(raw))return 'Female';return 'None';},
  ensureTrainerDetails:()=>trainerObj.details,
  trainerDerived:()=>({maxHp:50}),
  console,
};
vm.createContext(ctx);
vm.runInContext(extract('changeHp'),ctx);
vm.runInContext(extract('changeTrainerHp'),ctx);
vm.runInContext(extract('editPokemonIdentity',true),ctx);

ctx.changeHp('p1',5);
if(p.hp!==50||p.tempHp!==3) throw new Error(`Overflow failed: ${p.hp}/${p.maxHp} temp=${p.tempHp}`);
ctx.changeHp('p1',-2);
if(p.hp!==50||p.tempHp!==1) throw new Error(`Temporary HP absorption failed: hp=${p.hp} temp=${p.tempHp}`);
ctx.changeHp('p1',-5);
if(p.hp!==46||p.tempHp!==0) throw new Error(`Normal damage after temp failed: hp=${p.hp} temp=${p.tempHp}`);
p.hp=50; p.tempHp=4; ctx.changeHp('p1',2);
if(p.hp!==50||p.tempHp!==6) throw new Error(`Temp accumulation failed: hp=${p.hp} temp=${p.tempHp}`);

ctx.changeTrainerHp(5);
if(trainerObj.details.currentHp!==50||trainerObj.details.tempHp!==4) throw new Error('Trainer overflow failed');
ctx.changeTrainerHp(-3);
if(trainerObj.details.currentHp!==50||trainerObj.details.tempHp!==1) throw new Error('Trainer temp absorption failed');

await ctx.editPokemonIdentity('p1');
if(p.name!=='Nyx') throw new Error('Pokémon rename failed');
if(p.loyalty!==6) throw new Error('Pokémon Loyalty edit failed');
if(p.species!=='Sableye') throw new Error('Species changed during identity edit');
if(p.details.nickname!=='Nyx') throw new Error('Nickname snapshot not updated');
if(p.details.gender!=='Female') throw new Error('Pokémon Sex edit failed');
if(trainerObj.history.at(-1)?.title!=='Pokémon identity updated') throw new Error('Identity history not recorded');

for(const needle of ['Edit Identity','Temporary HP','TEMP HP']){
  if(!src.includes(needle)) throw new Error(`UI missing ${needle}`);
}
console.log(`HP overflow + Temporary HP + Pokémon identity verification: OK (${appPath})`);
