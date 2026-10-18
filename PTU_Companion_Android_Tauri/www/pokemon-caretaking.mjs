// Pokémon Caretaking, PTU 1.05 Editation pp. 13–14; campaign decisions in #89.
const skillKey=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function hasCaretakingFeature(trainer,id){
  return (trainer?.details?.features||[]).some(feature=>skillKey(feature.id||feature.name)===id);
}
export function pusherExperienceGain({trainer,pokemon,ownedPokemon=[],experience=0}={}){
  const base=Number(experience);
  if(!Number.isSafeInteger(base)||base<0)throw new Error('Experience must be a non-negative whole number.');
  const eligible=hasCaretakingFeature(trainer,'pusher')&&Number(pokemon?.level)<25&&ownedPokemon.some(p=>Number(p.level)>25);
  const bonus=eligible?Math.floor(base/4):0;
  if(!Number.isSafeInteger(base+bonus))throw new Error('Experience exceeds the supported range.');
  return {base,bonus,total:base+bonus,source:eligible?'Pusher':null};
}
export function resolvePushedSkills(skills,details={}){
  const pushed=details.caretaking?.pushedSkill;
  return skills.map(skill=>{
    const result={...skill};
    if(!pushed||skillKey(skill.id||skill.name)!==pushed.skillId)return result;
    result.pushedBaseDice=Number(skill.dice);result.pushedBaseModifier=Number(skill.modifier||0);
    if(result.pushedBaseDice<6)result.dice=result.pushedBaseDice+1;
    else result.modifier=result.pushedBaseModifier+3;
    result.pushed=true;return result;
  });
}
export function previewSkillTrainer({trainer,pokemon,skills=[],skillId,now=new Date().toISOString()}={}){
  if(!hasCaretakingFeature(trainer,'pusher')||!hasCaretakingFeature(trainer,'skill-trainer'))throw new Error('Pusher and Skill Trainer must be recorded on the Trainer.');
  const skill=skills.find(row=>skillKey(row.id||row.name)===skillKey(skillId));
  if(!skill||!Number.isInteger(Number(skill.dice))||Number(skill.dice)<1)throw new Error('Choose a resolved Skill for this Pokémon.');
  const details=JSON.parse(JSON.stringify(pokemon?.details||{}));
  details.caretaking ||= {};
  details.caretaking.pushedSkill={skillId:skillKey(skill.id||skill.name),skillName:skill.name,featureId:'skill-trainer',source:'PTU 1.05 Editation pp. 13–14',appliedAt:now,expires:'extended-rest'};
  // The resolver receives skills without the previous Pushed effect, so replacement never stacks.
  return {details,before:skill,after:resolvePushedSkills([skill],details)[0],record:details.caretaking.pushedSkill};
}
export function endCaretakingExtendedRest(pokemon){
  const details=JSON.parse(JSON.stringify(pokemon?.details||{}));
  const removed=details.caretaking?.pushedSkill||null;
  if(details.caretaking)delete details.caretaking.pushedSkill;
  return {details,removed};
}
const caretakingStats=['hp','attack','defense','special_attack','special_defense','speed'];
export function applyCaretakingSpecies(species,details={}){
  if(!species)return species;
  const original=species.caretakingOriginalBaseStats||species.baseStats||{};
  const originalTypes=species.caretakingOriginalTypes||species.types||[];
  const bonuses=Object.fromEntries(caretakingStats.map(key=>[key,Number(details.caretaking?.rebalancing?.stats?.[key]||0)]));
  const special=details.caretaking?.thisOnesSpecial;
  for(const trait of special?.traits||[])if(trait.id==='exceptionally_powerful')for(const key of trait.stats||[])if(caretakingStats.includes(key))bonuses[key]+=2;
  const types=[...originalTypes];
  for(const trait of special?.traits||[])if(trait.id==='altered_type'&&Number.isInteger(trait.typeIndex)&&types[trait.typeIndex])types[trait.typeIndex]=trait.replacementType;
  const hasStatChange=caretakingStats.some(key=>bonuses[key]);
  if(!hasStatChange&&!types.some((type,index)=>type!==originalTypes[index]))return species;
  return {...species,caretakingOriginalBaseStats:{...original},caretakingOriginalTypes:[...originalTypes],caretakingBaseBonus:bonuses,baseStats:hasStatChange?Object.fromEntries(caretakingStats.map(key=>[key,Number(original[key]||0)+bonuses[key]])):species.baseStats,types};
}

const pokemonTypes=['bug','dark','dragon','electric','fairy','fighting','fire','flying','ghost','grass','ground','ice','normal','poison','psychic','rock','steel','water'];
export function previewThisOnesSpecial({trainer,pokemon,traits,feature,now=new Date().toISOString()}={}){
  const featureId='this-ones-special-i-know-it';
  if(!feature||!hasCaretakingFeature(trainer,'pusher')||!hasCaretakingFeature(trainer,featureId))throw new Error('Pusher and This One’s Special, I Know It must be recorded on the Trainer and available in the active Ruleset.');
  const education=Object.entries(trainer.details?.skillRanks||{}).find(([name])=>skillKey(name)==='pokemon-education');
  const rank=Number(education?.[1]||2),maximum=Math.max(0,rank-2);
  if(maximum<1)throw new Error('This One’s Special requires Novice Pokémon Education.');
  const caretaking=trainer.details?.caretaking||{},used=Number(caretaking.thisOnesSpecialUsage?.uses||0);
  if(!Number.isInteger(used)||used<0||used>=maximum)throw new Error('No This One’s Special uses remain at the current Pokémon Education rank.');
  if(pokemon?.details?.caretaking?.thisOnesSpecial)throw new Error('This Pokémon already has a This One’s Special modification.');
  const types=Array.isArray(pokemon?.types)?pokemon.types.map(type=>String(type).toLowerCase()):[];
  if(!Array.isArray(traits)||traits.length!==2||new Set(traits.map(trait=>trait?.id)).size!==2)throw new Error('Choose two different This One’s Special traits.');
  const chosen=JSON.parse(JSON.stringify(traits));
  for(const trait of chosen){
    if(trait.id==='altered_type'){
      if(!Number.isInteger(trait.typeIndex)||!types[trait.typeIndex]||!pokemonTypes.includes(trait.replacementType)||types[trait.typeIndex]===trait.replacementType||!String(trait.gmNote||'').trim())throw new Error('Altered Type needs one replaced Type, a different replacement Type, and GM notes confirming a parent has that Type.');
    }else if(trait.id==='altered_ability'){
      if(!String(trait.name||'').trim()||!String(trait.gmNote||'').trim())throw new Error('Altered Ability needs a non-native Ability name and GM notes.');
    }else if(trait.id==='unique_move'){
      const finalTypes=[...types];const typeTrait=chosen.find(item=>item.id==='altered_type');if(typeTrait)finalTypes[typeTrait.typeIndex]=typeTrait.replacementType;
      if(!String(trait.name||'').trim()||!finalTypes.includes(String(trait.type||'').toLowerCase())||!String(trait.gmNote||'').trim())throw new Error('Unique Move needs a GM-approved Move whose Type matches the modified Pokémon.');
    }else if(trait.id==='exceptionally_powerful'){
      if(!Array.isArray(trait.stats)||trait.stats.length!==2||new Set(trait.stats).size!==2||trait.stats.some(key=>!caretakingStats.includes(key)))throw new Error('Exceptionally Powerful needs two different Base Stats.');
    }else if(trait.id==='savant'){
      if(!String(trait.template||'').trim()||!String(trait.gmNote||'').trim())throw new Error('Savant needs a Skill Template and GM notes for its manual Skill configuration.');
    }else throw new Error('Choose two supported This One’s Special traits.');
    trait.source='PTU 1.05 Editation, Pokémon Caretaking';
  }
  const details=JSON.parse(JSON.stringify(pokemon.details||{}));details.caretaking ||= {};
  const record={featureId,sourceId:feature.sourceId||null,sourceVersionId:feature.versionId||null,sourcePage:feature.sourcePage||null,appliedAt:now,appliedAtLevel:Number(pokemon.level||1),traits:chosen};
  details.caretaking.thisOnesSpecial=record;
  if(chosen.some(trait=>trait.id==='altered_ability')){
    const ability=chosen.find(trait=>trait.id==='altered_ability');details.abilities=[...(details.abilities||[])];details.abilities[0]=String(ability.name).trim();details.ability=details.abilities[0];details.abilityRecords=[...(details.abilityRecords||[])];details.abilityRecords[0]={name:details.abilities[0],sourceKind:'caretaking_altered',sourceLabel:'This One’s Special · Altered Ability',selectedAtLevel:Number(pokemon.level||1),gmNote:ability.gmNote};
  }
  if(chosen.some(trait=>trait.id==='unique_move')){
    const move=chosen.find(trait=>trait.id==='unique_move');details.moves=[...(details.moves||[])];
    if(details.moves.some(row=>skillKey(row.id||row.name)===skillKey(move.name)))throw new Error('This Pokémon already knows that Move.');
    details.moves.push({id:skillKey(move.name),name:String(move.name).trim(),type:String(move.type).toLowerCase(),source:'caretaking_unique_move',sourceLabel:'This One’s Special · Unique Move',countsAsNatural:true,cost:0,gmNote:move.gmNote,learnedAtLevel:Number(pokemon.level||1)});
  }
  const trainerCaretaking={...JSON.parse(JSON.stringify(caretaking)),thisOnesSpecialUsage:{uses:used+1,maximum,educationRank:rank}};
  return {details,trainerCaretaking,record,types:applyCaretakingSpecies({types,baseStats:{}},details).types||types};
}
export function previewRebalancing({trainer,pokemon,stats,day=1,now=new Date().toISOString()}={}){
  if(!hasCaretakingFeature(trainer,'pusher')||!hasCaretakingFeature(trainer,'re-balancing'))throw new Error('Pusher and Re-Balancing must be recorded on the Trainer.');
  const education=Object.entries(trainer.details?.skillRanks||{}).find(([name])=>skillKey(name)==='pokemon-education');
  if(Number(education?.[1]||0)<6)throw new Error('Re-Balancing requires Master Pokemon Education.');
  if(pokemon?.details?.caretaking?.rebalancing)throw new Error('This Pokemon has already received Re-Balancing.');
  if(!Number.isSafeInteger(day)||day<1)throw new Error('Choose a valid campaign day.');
  const usage=trainer.details?.caretaking?.rebalancingUsage;
  const used=usage?.day===day?Number(usage.uses):0;
  if(!Number.isInteger(used)||used<0||used>=2)throw new Error('Re-Balancing has no uses remaining for this campaign day.');
  if(!stats||Object.keys(stats).some(key=>!caretakingStats.includes(key)))throw new Error('Choose valid Base Stats.');
  const values=caretakingStats.map(key=>Number(stats[key]||0));
  if(!values.every(Number.isInteger)||!((values.every(v=>v===1))||(values.filter(v=>v===2).length===2&&values.every(v=>v===0||v===2))||(values.filter(v=>v===3).length===1&&values.every(v=>v===0||v===3))))throw new Error('Choose +1 to all Base Stats, +2 to two different Base Stats, or +3 to one Base Stat.');
  const details=JSON.parse(JSON.stringify(pokemon.details||{}));details.caretaking ||= {};
  details.caretaking.rebalancing={featureId:'re-balancing',stats:Object.fromEntries(caretakingStats.map((key,i)=>[key,values[i]])),appliedAt:now,day};
  const trainerCaretaking={...JSON.parse(JSON.stringify(trainer.details?.caretaking||{})),rebalancingUsage:{day,uses:used+1}};
  return {details,trainerCaretaking,record:details.caretaking.rebalancing};
}
