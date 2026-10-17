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
  const bonuses=details.caretaking?.rebalancing?.stats;
  if(!bonuses)return species;
  const original=species.caretakingOriginalBaseStats||species.baseStats||{};
  return {...species,caretakingOriginalBaseStats:{...original},caretakingBaseBonus:{...bonuses},baseStats:Object.fromEntries(caretakingStats.map(key=>[key,Number(original[key]||0)+Number(bonuses[key]||0)]))};
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
