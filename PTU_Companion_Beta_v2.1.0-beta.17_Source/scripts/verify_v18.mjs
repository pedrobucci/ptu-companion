import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DefinitionRepository } from '../definitions/repository.mjs';
import { resolveTrainerModel, applyCombatStage } from '../rules/trainer-engine.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const app=readFileSync(join(root,'static-preview','app.js'),'utf8');
const styles=readFileSync(join(root,'static-preview','styles.css'),'utf8');
const definitions=new DefinitionRepository(join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'));
const rulesetId='all-provided-material';
const skillNames=['Acrobatics','Athletics','Combat','Intimidate','Stealth','Survival','General Education','Medicine Education','Occult Education','Pokémon Education','Technology Education','Guile','Perception','Charm','Command','Focus','Intuition'];
const trainer={
  id:'verify-v18',level:10,
  stats:{hp:10,attack:12,defense:10,spAttack:8,spDefense:10,speed:10},
  equipment:{head:null,body:null,mainHand:null,offHand:null,feet:'Running Shoes',accessory:null},
  gmGrants:[{id:'gm-stealth',type:'fixed',target:'skill.Stealth',value:'+2',label:'+2 Stealth'}],
  details:{
    skillRanks:Object.fromEntries(skillNames.map(k=>[k,2])),injuries:1,
    combatStages:{attack:2,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0},
    features:[
      {id:'berserker',name:'Berserker',selections:{}},
      {id:'type-expertise',name:'Type Expertise',rank:1,selections:{type:'Normal',statTag:'attack'}}
    ],
    edges:[
      {id:'power-boost',name:'Power Boost'},
      {id:'scholar',name:'Scholar'},
      {id:'athletic-initiative',name:'Athletic Initiative'}
    ],moves:[]
  }
};
const resolve=t=>resolveTrainerModel({trainer:t,rulesetId,getDefinition:a=>definitions.getResolved(a),getDamageBase:n=>definitions.getDamageBase(n)});
const r=resolve(trainer);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};

assert(r.stats.effective.hp===11,'Berserker [+HP] Stat Tag did not apply');
assert(r.stats.effective.attack===13,'Type Expertise [+Any Stat] choice did not apply');
assert(r.stats.combat.attack===18,'Attack Combat Stage multiplier did not resolve after permanent modifiers');
assert(applyCombatStage(13,2)===18 && applyCombatStage(20,-6)===8,'PTU Combat Stage math failed');
assert(r.skills.Stealth.expression==='2d6+2','Structured GM Grant did not affect Stealth');
assert(r.skills['General Education'].expression==='2d6+1','Scholar did not affect Education Skills');
assert(r.skills.Athletics.expression==='2d6+2','Running Shoes did not affect Athletics checks');
assert(r.derived.power===6,'Power Boost did not affect Power Capability');
assert(r.derived.overland===6,'Running Shoes did not affect Overland');
const moveNames=r.moves.map(m=>m.name);
for(const move of ['Agility','Flail','Rage'])assert(moveNames.includes(move),`Automatic Trainer Move missing: ${move}`);
const flail=r.moves.find(m=>m.name==='Flail');
assert(flail.resolvedDamage.stab===true,'Type Expertise STAB not applied to Normal Move');
assert(flail.resolvedDamage.finalDb===10,'Flail should resolve DB 7 +1 Injury +2 STAB = DB 10');
assert(flail.resolvedDamage.expression==='3d8+28',`Unexpected Flail damage expression: ${flail.resolvedDamage.expression}`);
const withoutBerserker=structuredClone(trainer); withoutBerserker.details.features=withoutBerserker.details.features.filter(f=>f.id!=='berserker');
const r2=resolve(withoutBerserker);
assert(!r2.moves.some(m=>['Rage','Flail'].includes(m.name)),'Removing a Feature did not remove its automatic Moves');
for(const token of ["/api/trainer/reference-data","trainerMoveResolvedCard","loadTrainerReferenceData","configureTrainerDefinition","RESOLVED TRAINER MOVES","TRAINER MOVES · RESOLVED DAMAGE"])assert(app.includes(token),`Missing v1.8 UI token: ${token}`);
for(const token of ['.trainer-damage-box','.modifier-ledger','.choice-warning'])assert(styles.includes(token),`Missing v1.8 style: ${token}`);

console.log('PTU Companion v1.8 verification: OK');
console.log('Feature/Edge semantic effects: passed');
console.log('GM Grant + Equipment modifiers: passed');
console.log('automatic Trainer Moves + provenance: passed');
console.log(`Flail resolved damage: ${flail.resolvedDamage.expression} · DB ${flail.resolvedDamage.finalDb}`);
console.log('source removal recalculation: passed');
definitions.close();
