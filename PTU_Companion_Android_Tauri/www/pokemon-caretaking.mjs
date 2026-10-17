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
