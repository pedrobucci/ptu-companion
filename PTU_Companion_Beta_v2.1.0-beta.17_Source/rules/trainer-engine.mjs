const TRAINER_SKILLS=[
  'Acrobatics','Athletics','Combat','Intimidate','Stealth','Survival',
  'General Education','Medicine Education','Occult Education','Pokémon Education','Technology Education','Guile','Perception',
  'Charm','Command','Focus','Intuition'
];

const SKILL_CATEGORIES={
  Body:['Acrobatics','Athletics','Combat','Intimidate','Stealth','Survival'],
  Mind:['General Education','Medicine Education','Occult Education','Pokémon Education','Technology Education','Guile','Perception'],
  Spirit:['Charm','Command','Focus','Intuition']
};

const STAT_KEYS=['hp','attack','defense','spAttack','spDefense','speed'];
const STAT_LABELS={hp:'HP',attack:'Attack',defense:'Defense',spAttack:'Special Attack',spDefense:'Special Defense',speed:'Speed'};
const TYPE_NAMES=['Bug','Dark','Dragon','Electric','Fairy','Fighting','Fire','Flying','Ghost','Grass','Ground','Ice','Normal','Poison','Psychic','Rock','Steel','Water'];

const slug=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const title=v=>String(v||'').replace(/(^|[\s_-])([a-z])/g,(_,a,b)=>`${a}${b.toUpperCase()}`);
const slimSource=s=>({kind:s?.kind||'rule',id:s?.id||null,name:s?.name||'Rule effect',sourceLabel:s?.sourceLabel||null});
const statKey=value=>{
  const x=slug(value);
  if(x==='hp') return 'hp';
  if(x==='attack'||x==='atk') return 'attack';
  if(x==='defense'||x==='def') return 'defense';
  if(['special-attack','sp-attack','spatk','spattack','specialattack'].includes(x)) return 'spAttack';
  if(['special-defense','sp-defense','spdef','spdefense','specialdefense'].includes(x)) return 'spDefense';
  if(x==='speed') return 'speed';
  return null;
};
const skillName=value=>TRAINER_SKILLS.find(s=>slug(s)===slug(value))||null;

function combatStageMultiplier(stage){
  const cs=clamp(Math.trunc(num(stage)),-6,6);
  return Number((cs>=0?1+(cs*.2):1+(cs*.1)).toFixed(1));
}
function applyCombatStage(value,stage){ return Math.floor(num(value)*combatStageMultiplier(stage)); }

function parseFlatFromRoll(roll=''){
  const m=String(roll||'').replace(/\s+/g,'').match(/^(.+?)([+-]\d+)?$/);
  return {dice:m?.[1]||String(roll||''),flat:Number(m?.[2]||0)};
}
function addFlatToRoll(roll,flat){
  if(!roll) return flat?String(flat):'';
  if(!flat) return roll;
  const p=parseFlatFromRoll(roll); const total=p.flat+flat;
  return `${p.dice}${total>0?`+${total}`:total<0?String(total):''}`;
}

function sourceRecord({kind,record,definition}){
  return {
    kind,
    id:record?.id||definition?.id||null,
    name:record?.name||definition?.name||record?.id||'Unknown source',
    sourceLabel:record?.sourceLabel||definition?.packName||definition?.sourceId||kind,
    effect:definition?.effect||record?.effect||'',
    tags:Array.isArray(definition?.raw?.tags)?definition.raw.tags:(Array.isArray(record?.tags)?record.tags:[]),
    selections:record?.selections||{},
    rank:num(record?.rank)||1,
    definition
  };
}

function rankedLimit(tags=[]){
  for(const t of tags){ const m=String(t).match(/^Ranked\s+(\d+)/i); if(m)return Number(m[1]); }
  return null;
}

function statTagInfo(tag){
  let text=String(tag||'').trim(); if(!text.startsWith('+'))return null; text=text.slice(1).trim();
  let value=1; const n=text.match(/^(\d+)\s+/); if(n){value=Number(n[1]);text=text.slice(n[0].length).trim();}
  if(/^(any|any stat)$/i.test(text))return {kind:'choice',value,options:[...STAT_KEYS]};
  if(/\s+or\s+/i.test(text)){
    const options=text.split(/\s+or\s+/i).map(statKey).filter(Boolean); if(options.length)return {kind:'choice',value,options};
  }
  const key=statKey(text); return key?{kind:'fixed',value,key}:null;
}

function pushModifier(model,{target,value,source,kind='add',note=null,contextual=false,afterCombatStages=false,cap=null}){
  source=slimSource(source); const entry={target,value:num(value),source,kind,note,contextual,afterCombatStages,cap};
  model.modifiers.push(entry);
  if(contextual) model.contextualEffects.push(entry);
  return entry;
}

function addSkillBonus(model,skill,value,source,{cap=null,contextual=false,note=null}={}){
  const name=skillName(skill); if(!name)return;
  const rec=model.skills[name]; rec.flatBonus+=num(value); rec.sources.push({source:slimSource(source),value:num(value),type:'check_bonus',contextual,note});
  if(cap!=null) rec.bonusCap=Math.min(rec.bonusCap??Infinity,num(cap));
  pushModifier(model,{target:`skill.${name}`,value,source,note,contextual,cap});
}
function addSkillRank(model,skill,value,source){
  const name=skillName(skill); if(!name)return;
  const rec=model.skills[name]; rec.rank=clamp(rec.rank+num(value),1,8); rec.sources.push({source:slimSource(source),value:num(value),type:'rank'});
  pushModifier(model,{target:`skill-rank.${name}`,value,source});
}
function addStat(model,key,value,source,{afterCombatStages=false,contextual=false,note=null}={}){
  if(!STAT_KEYS.includes(key))return;
  if(afterCombatStages){model.stats.afterCombatStage[key]=(model.stats.afterCombatStage[key]||0)+num(value);}
  else model.stats.bonus[key]=(model.stats.bonus[key]||0)+num(value);
  model.stats.sources[key].push({source:slimSource(source),value:num(value),afterCombatStages,contextual,note});
  pushModifier(model,{target:`stat.${key}`,value,source,afterCombatStages,contextual,note});
}
function addCapability(model,key,value,source,{contextual=false,note=null}={}){
  if(!(key in model.capabilities))model.capabilities[key]=0;
  model.capabilityBonuses[key]=(model.capabilityBonuses[key]||0)+num(value);
  model.capabilitySources[key]=model.capabilitySources[key]||[];
  model.capabilitySources[key].push({source:slimSource(source),value:num(value),contextual,note});
  pushModifier(model,{target:`capability.${key}`,value,source,contextual,note});
}

function resolveDefinition(getDefinition,rulesetId,kind,id){
  if(!id)return null;
  try{return getDefinition({rulesetId,kind,id:String(id)})||null;}catch{return null;}
}

function grantEntity(model,{entityKind,entityId,entityName,source,automatic=true,getDefinition,rulesetId,metadata={}}){
  const ek=String(entityKind||'').toLowerCase();
  if(ek==='move'){
    let id=entityId||slug(entityName); const moveAliases={'faint-attack':'feint-attack'}; id=moveAliases[id]||id; const def=resolveDefinition(getDefinition,rulesetId,'moves',id);
    if(!def){ model.unresolvedChoices.push({source:slimSource(source),type:'missing_move_definition',message:`Move ${entityName||id} could not be resolved.`}); return; }
    const key=def.id||slug(def.name); let move=model._moveMap.get(key);
    const sourceEntry={kind:source.kind,id:source.id,name:source.name,label:source.sourceLabel||source.name,automatic,metadata};
    if(!move){move={id:key,name:def.name,definition:def,sources:[],automatic:true};model._moveMap.set(key,move);} 
    if(!move.sources.some(s=>s.kind===sourceEntry.kind&&s.id===sourceEntry.id&&s.name===sourceEntry.name))move.sources.push(sourceEntry);
    move.automatic=move.automatic&&automatic;
  }else if(ek==='ability'){
    const id=entityId||slug(entityName); const def=resolveDefinition(getDefinition,rulesetId,'abilities',id);
    const name=def?.name||entityName||id;
    if(!model.abilities.some(a=>slug(a.name)===slug(name)))model.abilities.push({id:def?.id||id,name,definition:def,source:{kind:source.kind,id:source.id,name:source.name},automatic});
  }else if(ek==='capability'){
    const name=entityName||entityId; if(name&&!model.grantedCapabilities.some(c=>slug(c.name)===slug(name)))model.grantedCapabilities.push({name,source:{kind:source.kind,id:source.id,name:source.name},automatic});
  }
}

function applyCompiledEffect(model,effect,source,ctx){
  if(!effect||String(effect.confidence||'high')==='low')return;
  const kind=effect.kind;
  if(kind==='modifier'){
    const path=String(effect.target_path||''); const value=num(effect.value); const contextual=/contextual/.test(String(effect.duration||''))||/contextual/.test(String(effect.mode||''));
    let m;
    if((m=path.match(/^capabilities\.([a-zA-Z_]+)$/))){addCapability(model,m[1],value,source,{contextual,note:effect.source_text});return;}
    if((m=path.match(/^skills\.([^.]+)\.check_bonus$/))){addSkillBonus(model,m[1],value,source,{cap:effect.stacking_cap?.value??null,contextual,note:effect.source_text});return;}
    if((m=path.match(/^stats\.([^.]+)$/))){const k=statKey(m[1]);if(k)addStat(model,k,value,source,{contextual,note:effect.source_text});return;}
    if(path==='combat.accuracy'){
      if(contextual) model.contextualEffects.push({source:slimSource(source),target:path,value,note:effect.source_text||'Context-dependent Accuracy modifier',contextual:true});
      else {model.accuracyBonus+=value;pushModifier(model,{target:path,value,source,note:effect.source_text});}
      return;
    }
    if(path==='combat.damage_bonus'){
      if(contextual) model.contextualEffects.push({source:slimSource(source),target:path,value,note:effect.source_text||'Context-dependent damage modifier',contextual:true});
      else {model.damageRollBonus+=value;pushModifier(model,{target:path,value,source,note:effect.source_text});}
      return;
    }
    if(path==='combat.damage_reduction'){
      if(contextual) model.contextualEffects.push({source:slimSource(source),target:path,value,note:effect.source_text||'Context-dependent Damage Reduction modifier',contextual:true});
      else {model.damageReduction+=value;pushModifier(model,{target:path,value,source,note:effect.source_text});}
      return;
    }
    if(path==='combat.evasion'){
      if(contextual) model.contextualEffects.push({source:slimSource(source),target:path,value,note:effect.source_text||'Context-dependent Evasion modifier',contextual:true});
      else {model.evasionBonus+=value;pushModifier(model,{target:path,value,source,note:effect.source_text});}
      return;
    }
    model.contextualEffects.push({source:slimSource(source),target:path||'unknown',value,note:effect.source_text||'Compiled modifier',contextual:true});
  }else if(kind==='grant_entity'){
    grantEntity(model,{entityKind:effect.entity_kind,entityId:effect.entity_id,entityName:effect.entity_name,source,automatic:true,...ctx,metadata:{compiled:true}});
  }else if(kind==='choose_and_grant_entity'){
    const selected=source.selections?.entities||source.selections?.moves||source.selections?.abilities||[]; const list=Array.isArray(selected)?selected:[selected].filter(Boolean);
    if(list.length){for(const choice of list)grantEntity(model,{entityKind:effect.entity_kind,entityId:choice?.id||choice,entityName:choice?.name||choice,source,automatic:true,...ctx,metadata:{selected:true}});}
    else model.unresolvedChoices.push({source:slimSource(source),type:'entity_choice',count:num(effect.count)||1,entityKind:effect.entity_kind,options:effect.options||[],message:`${source.name} requires a choice before its granted ${effect.entity_kind||'entity'} can be applied.`});
  }else if(kind==='grant_build_resource'){
    model.resources.push({source:slimSource(source),resource:effect.resource||effect.resource_kind||effect.target||'build_resource',amount:num(effect.amount??effect.value??1),effect});
  }else if(kind==='apply_status'||kind==='type_defense_rule'){
    model.contextualEffects.push({source:slimSource(source),target:kind,note:effect.source_text||source.effect||source.name,contextual:true,effect});
  }
}

function fallbackDirectGrants(model,source,ctx){
  const text=String(source.effect||'').replace(/\s+/g,' ').trim();
  if(!text)return;
  if(source.selections?.ability) grantEntity(model,{entityKind:'ability',entityName:source.selections.ability,source,automatic:true,...ctx,metadata:{selected:true}});
  // Only automate explicit, unconditional grants. Choice text stays unresolved.
  if(!/\bchoose\b/i.test(text)){
    const moveMatch=text.match(/\b(?:learn|gain) the Moves? ([^.]+)\./i);
    if(moveMatch){
      const names=moveMatch[1].split(/\s*,\s*|\s+and\s+/i).map(x=>x.trim()).filter(Boolean);
      for(const name of names)grantEntity(model,{entityKind:'move',entityName:name,source,automatic:true,...ctx,metadata:{fallback:true}});
    }
    const abilityMatch=text.match(/\bgain(?:s)? the ([A-Z][A-Za-z0-9 '\-]+) Ability\b/);
    if(abilityMatch)grantEntity(model,{entityKind:'ability',entityName:abilityMatch[1].trim(),source,automatic:true,...ctx,metadata:{fallback:true}});
    const capMatch=text.match(/\bgain(?:s)? the ([A-Z][A-Za-z0-9 '\-]+) Capabilit(?:y|ies)\b/);
    if(capMatch)grantEntity(model,{entityKind:'capability',entityName:capMatch[1].trim(),source,automatic:true,...ctx,metadata:{fallback:true}});
  }
}

function applyKnownSemantics(model,source,ctx){
  const id=slug(source.id||source.name); const sel=source.selections||{};
  if(id==='scholar'){
    for(const s of ['General Education','Medicine Education','Occult Education','Pokémon Education','Technology Education','Survival'])addSkillBonus(model,s,1,source);
  }else if(id==='swimmer') addCapability(model,'swim',2,source);
  else if(id==='acrobat'){addCapability(model,'highJump',1,source);addCapability(model,'longJump',1,source);}
  else if(id==='throwing-masteries') addCapability(model,'throwingRange',2,source);
  else if(id==='skill-enhancement'){
    const skills=Array.isArray(sel.skills)?sel.skills:[];
    if(skills.length>=2)for(const s of skills.slice(0,2))addSkillBonus(model,s,2,source);
    else model.unresolvedChoices.push({source:slimSource(source),type:'skills',count:2,message:'Skill Enhancement requires two selected Skills.'});
  }else if(id==='categoric-inclination'){
    const category=title(sel.category||''); const list=SKILL_CATEGORIES[category];
    if(list)for(const s of list)addSkillBonus(model,s,1,source);
    else model.unresolvedChoices.push({source:slimSource(source),type:'category',message:'Categoric Inclination requires Body, Mind, or Spirit.'});
  }else if(['basic-skills','adept-skills','expert-skills','master-skills'].includes(id)){
    const s=sel.skill;
    if(s)addSkillRank(model,s,1,source); else model.unresolvedChoices.push({source:slimSource(source),type:'skill_rank',message:`${source.name} requires a selected Skill.`});
  }else if(id==='athletic-moves'){
    const moves=Array.isArray(sel.moves)?sel.moves:[];
    if(moves.length>=2)for(const move of moves.slice(0,2))grantEntity(model,{entityKind:'move',entityId:move?.id||move,entityName:move?.name||move,source,automatic:true,...ctx,metadata:{selected:true}});
    else model.unresolvedChoices.push({source:slimSource(source),type:'moves',count:2,message:`${source.name} requires two selected Athlete Moves for this rank.`});
  }else if(id==='energetic'){
    if(source.rank>=1){
      for(const move of [['eerie-impulse','Eerie Impulse'],['lock-on','Lock-On']])grantEntity(model,{entityKind:'move',entityId:move[0],entityName:move[1],source,automatic:true,...ctx,metadata:{campaignHomebrew:true,rank:1}});
    }
    if(source.rank>=2){
      for(const move of [['techno-blast','Techno Blast'],['flash-cannon','Flash Cannon']])grantEntity(model,{entityKind:'move',entityId:move[0],entityName:move[1],source,automatic:true,...ctx,metadata:{campaignHomebrew:true,rank:2}});
    }
  }else if(id==='capitan'){
    const rank=model.skills['Intuition']?.rank||0;
    if(rank>=4)grantEntity(model,{entityKind:'move',entityId:'take-aim',entityName:'Take Aim',source,automatic:true,...ctx,metadata:{campaignHomebrew:true,qualification:'Adept Intuition'}});
    if(rank>=6)grantEntity(model,{entityKind:'move',entityId:'mat-block',entityName:'Mat Block',source,automatic:true,...ctx,metadata:{campaignHomebrew:true,qualification:'Master Intuition'}});
  }else if(id==='traveler') model.flags.traveler=true;
  else if(id==='dynamism') model.flags.initiativeSkill='Guile';
  else if(id==='type-expertise'){
    const type=TYPE_NAMES.find(t=>slug(t)===slug(sel.type));
    if(type){model.stabTypes.add(type.toLowerCase());}
    else model.unresolvedChoices.push({source:slimSource(source),type:'type',message:'Type Expertise requires a selected Type.'});
  }
}

function applyFeatureTags(model,source){
  for(const tag of source.tags||[]){
    const info=statTagInfo(tag); if(!info)continue;
    if(info.kind==='fixed')addStat(model,info.key,info.value,source);
    else{
      const k=statKey(source.selections?.statTag||source.selections?.stat);
      if(k && info.options.includes(k))addStat(model,k,info.value,source);
      else model.unresolvedChoices.push({source:slimSource(source),type:'stat_tag',options:info.options,message:`${source.name} has [${tag}] and needs a Stat choice.`});
    }
  }
}

function equipmentDefinitionId(name){
  const s=slug(name);
  const aliases={
    'focus-charm':'focus','guard-shield':'light-shield','shield':'light-shield',
    'trainer-cap':'','windbreaker':''
  };
  return aliases[s]??s;
}

function configValue(source,value){
  if(typeof value!=='string'||!value.startsWith('$config.'))return value;
  const key=value.slice('$config.'.length);return source?.selections?.[key];
}
function applyGenericEquipmentMechanics(model,mechanics={},source,ctx){
  if(!mechanics||typeof mechanics!=='object')return;
  const dr=num(mechanics.damageReduction);if(dr){model.damageReduction+=dr;pushModifier(model,{target:'combat.damage_reduction',value:dr,source,note:`${source.name}: ${dr>0?'+':''}${dr} Damage Reduction.`});}
  const drClass=mechanics.damageReductionByClass||{};
  for(const cls of ['physical','special']){const value=num(drClass[cls]);if(value){model.damageReductionByClass[cls]+=value;pushModifier(model,{target:`combat.damage_reduction.${cls}`,value,source,note:`${source.name}: ${value>0?'+':''}${value} ${title(cls)} Damage Reduction.`});}}
  const evasion=num(mechanics.evasionBonus);if(evasion){model.evasionBonus+=evasion;pushModifier(model,{target:'combat.evasion',value:evasion,source});}
  const accuracy=num(mechanics.accuracyBonus);if(accuracy){model.accuracyBonus+=accuracy;pushModifier(model,{target:'combat.accuracy',value:accuracy,source});}
  const saves=num(mechanics.saveCheckBonus);if(saves){model.saveCheckBonus+=saves;pushModifier(model,{target:'combat.save_checks',value:saves,source});}
  const volatileSaves=num(mechanics.saveCheckBonusVolatile);if(volatileSaves){model.saveCheckBonusVolatile+=volatileSaves;pushModifier(model,{target:'combat.save_checks.volatile',value:volatileSaves,source});}
  const effectRange=num(mechanics.effectRangeBonus);if(effectRange){model.effectRangeBonus+=effectRange;pushModifier(model,{target:'combat.effect_range',value:effectRange,source});}
  for(const [key,value] of Object.entries(mechanics.defaultCombatStages||{})){const stat=statKey(key);if(stat)model.defaultCombatStages[stat]=num(value);}
  const dynamic=mechanics.defaultCombatStageFromConfig;if(dynamic?.field){const stat=statKey(source?.selections?.[dynamic.field]);if(stat)model.defaultCombatStages[stat]=num(dynamic.value);else model.unresolvedChoices.push({source:slimSource(source),type:'equipment_config',message:`${source.name} requires a selected Stat.`});}
  for(const entry of mechanics.skillBonuses||[]){const skill=configValue(source,entry.skill);if(skill)addSkillBonus(model,skill,num(entry.value),source,{cap:entry.cap??null,note:entry.note||`${source.name} equipment bonus.`});else model.unresolvedChoices.push({source:slimSource(source),type:'equipment_config',message:`${source.name} requires a Skill selection.`});}
  for(const entry of mechanics.statBonuses||[]){const stat=statKey(configValue(source,entry.stat));if(stat)addStat(model,stat,num(entry.value),source,{afterCombatStages:!!entry.afterCombatStages,note:entry.note||`${source.name} equipment bonus.`});else model.unresolvedChoices.push({source:slimSource(source),type:'equipment_config',message:`${source.name} requires a Stat selection.`});}
  for(const [key,value] of Object.entries(mechanics.capabilityBonuses||{}))addCapability(model,key,num(value),source,{note:`${source.name} equipment capability bonus.`});
  for(const cap of mechanics.capabilityGrants||[])grantEntity(model,{entityKind:'capability',entityName:configValue(source,cap),source,automatic:true,...ctx,metadata:{equipment:true}});
  if(mechanics.dynamicCapability){const name=String(mechanics.dynamicCapability).replace(/\$config\.([A-Za-z0-9_]+)/g,(_,k)=>source?.selections?.[k]||'?');if(!name.includes('?'))grantEntity(model,{entityKind:'capability',entityName:name,source,automatic:true,...ctx,metadata:{equipment:true}});else model.unresolvedChoices.push({source:slimSource(source),type:'equipment_config',message:`${source.name} requires equipment configuration.`});}
  for(const skill of mechanics.skillAdvantages||[])model.skillAdvantages.push({skill:configValue(source,skill),source:slimSource(source)});
  if(mechanics.initiativeBonus){model.initiativeBonus+=num(mechanics.initiativeBonus);pushModifier(model,{target:'combat.initiative',value:num(mechanics.initiativeBonus),source});}
  if(mechanics.initiativeDiceBonus)model.contextualEffects.push({source:slimSource(source),target:'combat.initiative',note:`Initiative bonus: ${mechanics.initiativeDiceBonus}.`,contextual:true});
  for(const entry of mechanics.conditionalDamageBonuses||[])model.contextualEffects.push({source:slimSource(source),target:'combat.damage_bonus',value:num(entry.value),note:`${entry.value>0?'+':''}${entry.value} Damage when ${entry.condition||'the listed condition applies'}.`,contextual:true});
  for(const note of mechanics.contextualEffects||[])if(String(note||'').trim())model.contextualEffects.push({source:slimSource(source),target:'equipment_rule',note:String(note),contextual:true});
}

function applyWeaponEquipment(model,{slot,value,mechanics,source,ctx}){
  const qualification=weaponQualification(model,mechanics);
  const arcane=mechanics.arcane===true||String(mechanics.weaponClass||'').startsWith('arcane_');
  const weapon={
    slot,id:value?.id||slug(source.name),name:source.name,quality:mechanics.quality||'Crude',
    weaponClass:mechanics.weaponClass||'large_melee',weaponClassLabel:weaponClassLabel(mechanics.weaponClass||'large_melee'),
    hands:num(mechanics.hands)||1,range:mechanics.range||'Melee',minimumRange:mechanics.minimumRange==null?null:num(mechanics.minimumRange),
    acModifier:num(mechanics.acModifier),dbModifier:num(mechanics.dbModifier),qualification,tags:mechanics.tags||[],metal:!!mechanics.metal,
    arcane,damageClass:mechanics.damageClass||(arcane?'Special':'Physical'),reachForWeaponAttacks:mechanics.reachForWeaponAttacks??null,
    shield:mechanics.shield||null
  };
  model.weapons.push(weapon);
  const effectParts=[`${weapon.quality} ${weapon.weaponClassLabel} weapon`,`${weapon.damageClass} Weapon Attacks`,weapon.hands===2?'Two-Handed':null].filter(Boolean);
  model.equipment.push({slot,definition:{id:weapon.id,name:weapon.name,effect:effectParts.join(' · ')},source,weapon});

  // Static equipment-side modifiers live on the mechanics payload. Run the
  // generic resolver exactly once so hybrid/Living Weapons do not double-count
  // Evasion or Damage Reduction.
  applyGenericEquipmentMechanics(model,mechanics,source,ctx);
  const contextual=[...(Array.isArray(mechanics.specialRules)?mechanics.specialRules:[])];
  for(const note of contextual) if(String(note||'').trim()) model.contextualEffects.push({source:slimSource(source),target:'weapon_rule',note:String(note),contextual:true});

  const rank=qualification.rank;const quality=String(weapon.quality).toLowerCase();
  const adeptRank=Math.max(1,num(mechanics.weaponMoveRanks?.adept)||4);
  const masterRank=Math.max(1,num(mechanics.weaponMoveRanks?.master)||6);
  const grants=[];
  if((quality==='simple'||quality==='fine')&&rank>=adeptRank&&mechanics.weaponMoves?.adept)grants.push({tier:'Adept',id:mechanics.weaponMoves.adept});
  if(quality==='fine'&&rank>=masterRank&&mechanics.weaponMoves?.master)grants.push({tier:'Master',id:mechanics.weaponMoves.master});
  for(const grant of grants)grantEntity(model,{entityKind:'move',entityId:grant.id,source,automatic:true,...ctx,metadata:{weapon:true,weapon:{...weapon},tier:grant.tier}});
}
function applyEquipment(model,trainer,ctx){
  for(const [slot,value] of Object.entries(trainer.equipment||{})){
    if(!value||value?.reservedBy)continue;

    // Resolve the catalog definition first when available. Imported .ptucp
    // weapons keep their mechanics in raw.mechanics, while built-in/save-era
    // weapons may already carry the same payload directly on the equipped item.
    const id=equipmentDefinitionId(typeof value==='object'?(value.definitionId||value.id||value.name):value);
    const def=id?resolveDefinition(ctx.getDefinition,ctx.rulesetId,'items',id):null;
    const definitionMechanics=def?.raw?.mechanics&&typeof def.raw.mechanics==='object'?def.raw.mechanics:null;
    const embedded=typeof value==='object'?(value.mechanics||value.weapon||definitionMechanics):definitionMechanics;

    if(embedded?.kind==='weapon'||embedded?.weaponClass){
      const source={
        kind:'weapon',
        id:def?.id||value?.id||value?.inventoryItemId||slug(value?.name),
        name:def?.name||value?.name||'Weapon',
        sourceLabel:def?.packName||def?.sourceId||'Equipped Weapon',
        effect:def?.effect||'',
        tags:Array.isArray(def?.raw?.tags)?def.raw.tags:(embedded.tags||[]),
        selections:typeof value==='object'?(value.config||value.selections||{}):{},
        definition:def||null
      };
      applyWeaponEquipment(model,{slot,value,mechanics:embedded,source,ctx});
      // A weapon can also carry deterministic equip-only effects. This is what
      // lets a custom weapon grant a special Move/Ability in addition to its
      // normal Adept/Master Weapon Moves. Because equipment is recomputed from
      // scratch, these grants disappear automatically when the item is unequipped.
      for(const effect of def?.compiledEffects||[]) applyCompiledEffect(model,effect,source,ctx);
      continue;
    }

    if(!def)continue;
    const source={kind:'equipment',id:def.id,name:def.name,sourceLabel:def.packName||def.sourceId||'Equipment',effect:def.effect||'',tags:[],selections:typeof value==='object'?(value.config||value.selections||{}):{}};
    model.equipment.push({slot,definition:def,source});
    if(definitionMechanics) applyGenericEquipmentMechanics(model,definitionMechanics,source,ctx);
    for(const effect of def.compiledEffects||[]) applyCompiledEffect(model,effect,source,ctx);
    // Legacy Core definitions predate the structured mechanics payload. Keep
    // their compatibility fallbacks only when the active resolved definition
    // does not already describe its mechanics, otherwise imported packs would
    // apply the same bonus twice.
    if(!definitionMechanics){
      if(def.id==='light-armor')model.damageReduction+=5;
      if(def.id==='heavy-armor'){model.damageReduction+=10; model.defaultCombatStages.speed=Math.min(model.defaultCombatStages.speed,-1);}
      if(def.id==='light-shield'||def.id==='heavy-shield'){
        model.evasionBonus+=2;
        model.contextualEffects.push({source:slimSource(source),target:'shield_ready',note:'Readying the Shield can replace its passive +2 Evasion with the larger temporary benefit described by the item.',contextual:true});
      }
      if(def.id==='sunglasses'){
        for(const skill of ['Charm','Guile','Intimidate']) addSkillBonus(model,skill,1,source,{note:'Sunglasses: +1 to Charm, Guile, and Intimidate Checks.'});
      }
      if(def.id==='focus'){
        const k=statKey(source.selections?.stat||source.selections?.statTag);
        if(k)addStat(model,k,5,source,{afterCombatStages:true,note:'Focus bonus is applied after Combat Stages.'});
        else model.unresolvedChoices.push({source:slimSource(source),type:'equipment_stat',message:'Focus requires the crafted Stat to be selected before its +5 bonus can be resolved.'});
      }
    }
  }
}

function applyGmGrants(model,trainer){
  for(const grant of trainer.gmGrants||[]){
    const value=num(String(grant.value??grant.amount??0).replace(/[^0-9+\-.]/g,'')); const source={kind:'gm_grant',id:grant.id,name:grant.label||'GM Grant',sourceLabel:'GM Grant',effect:grant.label||'',tags:[],selections:{}};
    if(grant.type==='resource'){
      model.resources.push({source:slimSource(source),resource:String(grant.target||'resource.unknown'),amount:value||1}); continue;
    }
    const target=String(grant.target||''); let m;
    if((m=target.match(/^stat\.(.+)$/))){const k=statKey(m[1]);if(k)addStat(model,k,value,source);continue;}
    if((m=target.match(/^skill\.(.+)$/))){addSkillBonus(model,m[1],value,source);continue;}
    if((m=target.match(/^capability\.(.+)$/))){addCapability(model,m[1],value,source);continue;}
    if(target==='derived.maxHp'){model.derivedBonuses.maxHp+=value;continue;}
    if(target==='derived.maxAp'){model.derivedBonuses.maxAp+=value;continue;}
    if(target==='evasion.physical'){model.evasionFixed.physical+=value;continue;}
    if(target==='evasion.special'){model.evasionFixed.special+=value;continue;}
    if(target==='evasion.speed'){model.evasionFixed.speed+=value;continue;}
    // v1.7 legacy saves used raw labels such as "Stealth".
    const legacySkill=skillName(target); if(legacySkill){addSkillBonus(model,legacySkill,value,source);continue;}
    const legacyStat=statKey(target); if(legacyStat){addStat(model,legacyStat,value,source);continue;}
    model.contextualEffects.push({source:slimSource(source),target,note:`Unlinked legacy GM Grant: ${grant.label||target}`,contextual:true});
  }
}

function applyAbilityMechanics(model){
  for(const ability of model.abilities){
    const id=slug(ability.id||ability.name); const source={kind:'ability',id:ability.id||id,name:ability.name,sourceLabel:ability.definition?.packName||'Granted Ability'};
    if(id==='twisted-power')model.flags.twistedPower=true;
    else if(id==='instinct')model.evasionBonus+=2;
    else if(id==='hustle'){
      // February 2016 Playtest: -2 to all Accuracy Rolls, +10 to all Damage Rolls.
      // Keep the Accuracy penalty as an Accuracy Roll modifier rather than rewriting Move AC.
      model.accuracyBonus-=2;
      model.damageRollBonus+=10;
      pushModifier(model,{target:'combat.accuracy',value:-2,source,note:'Hustle: -2 to all Accuracy Rolls.'});
      pushModifier(model,{target:'combat.damage_bonus',value:10,source,note:'Hustle: +10 to all Damage Rolls.'});
    }
    else if(id==='perception'){
      const text=String(ability.definition?.effect||'');
      if(/gain(?:s)? \+1 Evasion/i.test(text))model.evasionBonus+=1;
      else model.contextualEffects.push({source:slimSource(source),target:'ability',note:text||'Perception ability',contextual:true});
    }else if(id==='kampfgeist')model.stabTypes.add('fighting');
    else if(id==='adaptability')model.flags.adaptability=true;
    else model.contextualEffects.push({source:slimSource(source),target:'ability',note:ability.definition?.effect||`${ability.name} is available on the Trainer.`,contextual:true});
  }
}

function deriveCapabilities(model){
  const rank=s=>model.skills[s]?.rank||2;
  let ath=rank('Athletics'),acro=rank('Acrobatics'),combat=rank('Combat'),survival=rank('Survival');
  if(model.flags.traveler){
    const lower=Math.min(ath,acro); const substitute=Math.max(lower,survival);
    if(ath<=acro)ath=substitute; else acro=substitute;
  }
  const base={
    power:4+(ath>=3?1:0)+(combat>=4?1:0),
    overland:3+Math.floor((ath+acro)/2),
    swim:0,
    highJump:(acro>=4?1:0)+(acro>=6?1:0),
    longJump:Math.floor(acro/2),
    throwingRange:4+ath
  };
  base.swim=Math.floor(base.overland/2);
  for(const k of Object.keys(base)) model.capabilities[k]=Math.max(0,num(base[k])+num(model.capabilityBonuses[k]));
}

function finalizeSkills(model){
  for(const rec of Object.values(model.skills)){
    if(rec.bonusCap!=null&&Number.isFinite(rec.bonusCap))rec.flatBonus=Math.min(rec.flatBonus,rec.bonusCap);
    rec.rank=clamp(Math.trunc(rec.rank),1,8); rec.dice=`${rec.rank}d6`; rec.expression=addFlatToRoll(rec.dice,rec.flatBonus);
  }
}

function resolveMoveDamageForTrainer(model,move,trainer,getDamageBase){
  const def=move.definition; const category=String(def?.category||def?.raw?.class||'').toLowerCase();
  if(!def||category==='status'||def.damageBase==null)return {damaging:false,category:def?.category||null,expression:null,breakdown:[],baseDb:def?.damageBase??null,finalDb:def?.damageBase??null,stab:false,accuracyModifier:num(model.accuracyBonus)};
  let db=num(def.damageBase); const breakdown=[{label:'Move Damage Base',value:`DB ${db}`}];
  const weaponSource=(move.sources||[]).find(s=>s.metadata?.weapon);const weapon=weaponSource?.metadata?.weapon||null;
  let resolvedAc=def.ac??null,resolvedRange=def.range||null;
  if(weapon){db+=num(weapon.dbModifier);if(resolvedAc!=null)resolvedAc=num(resolvedAc)+num(weapon.acModifier);if(/\bWR\b/i.test(String(resolvedRange||'')))resolvedRange=String(resolvedRange).replace(/\bWR\b/gi,weapon.range||'Melee');breakdown.push({label:`${weapon.name} · ${weapon.weaponClassLabel}`,value:`${weapon.dbModifier>=0?'+':''}${weapon.dbModifier} DB${weapon.acModifier?`, ${weapon.acModifier>0?'+':''}${weapon.acModifier} AC`:''}`});}
  if(def.id==='flail'){const injuries=Math.max(0,num(trainer.details?.injuries));if(injuries){db+=injuries;breakdown.push({label:'Flail · Injuries',value:`+${injuries} DB`});}}
  const type=String(def.type||'').toLowerCase(); const stab=!weapon&&model.stabTypes.has(type); if(stab){db+=2;breakdown.push({label:`STAB · ${def.type}`,value:'+2 DB'}); if(model.flags.adaptability){db+=1;breakdown.push({label:'Adaptability',value:'+1 DB'});}}
  db=clamp(Math.trunc(db),1,28);
  const chart=getDamageBase(db); const damageDice=chart?.rolled_damage||def.raw?.damage_dice||null;
  const statKeyUsed=category==='special'?'spAttack':'attack'; const attackValue=num(model.stats.combat[statKeyUsed]);
  let flatBonus=0;
  breakdown.push({label:STAT_LABELS[statKeyUsed],value:`+${attackValue}${model.stats.stages[statKeyUsed]?` (CS ${model.stats.stages[statKeyUsed]>0?'+':''}${model.stats.stages[statKeyUsed]})`:''}`});
  if(model.flags.twistedPower){const opposite=category==='special'?'attack':'spAttack';const twisted=Math.floor(num(model.stats.combat[opposite])/2);flatBonus+=twisted;breakdown.push({label:'Twisted Power',value:`+${twisted} (½ ${STAT_LABELS[opposite]})`});}
  if(model.damageRollBonus){flatBonus+=model.damageRollBonus;breakdown.push({label:'Static damage bonuses',value:`+${model.damageRollBonus}`});}
  const expression=damageDice?addFlatToRoll(damageDice,attackValue+flatBonus):null;
  return {damaging:true,category:def.category,baseDb:num(def.damageBase),finalDb:db,stab,chart,expression,attackStat:statKeyUsed,attackValue,breakdown,resolvedAc,resolvedRange,weapon,accuracyModifier:num(model.accuracyBonus)};
}


function resolveStruggleAttack(model,trainer,getDamageBase){
  const combatRank=model.skills['Combat']?.rank||2;
  const primary=model.weapons.find(w=>w.slot==='mainHand')||model.weapons.find(w=>w.slot==='offHand')||null;
  let db=combatRank>=5?5:4;
  let ac=combatRank>=5?3:4;
  let category='Physical',statKeyUsed='attack',range='Melee',type='Normal';
  const breakdown=[{label:'Base Struggle',value:`${combatRank>=5?'Expert Combat · ':''}DB ${db}, AC ${ac}`}];
  let qualificationSkill='Combat',qualificationRank=combatRank,qualificationSource='Base Struggle rules';
  if(primary){
    const melee=String(primary.weaponClass||'').includes('melee');
    if(primary.arcane){qualificationSkill='Occult Education';qualificationRank=model.skills['Occult Education']?.rank||2;qualificationSource='Arcane Weapon rules';category='Special';statKeyUsed='spAttack';}
    else if(melee&&primary.qualification?.source==='Apparition'){qualificationSkill=primary.qualification.skill;qualificationRank=primary.qualification.rank;qualificationSource='Apparition';}
    if(qualificationRank>=5 && db<5){db=5;breakdown.push({label:`${qualificationSource} · ${qualificationSkill}`,value:'+1 base DB (Expert+)'});}
    db+=num(primary.dbModifier);ac+=num(primary.acModifier);range=primary.range||range;category=primary.damageClass||category;statKeyUsed=String(category).toLowerCase()==='special'?'spAttack':'attack';
    if(primary.minimumRange!=null)range=`${range} (minimum ${primary.minimumRange}m)`;
    if(melee&&primary.qualification?.source==='Apparition'&&String(range).toLowerCase().startsWith('melee'))range='Melee (Reach)';
    breakdown.push({label:`${primary.name} · ${primary.weaponClassLabel}`,value:`${primary.dbModifier>=0?'+':''}${primary.dbModifier} DB${primary.acModifier?`, ${primary.acModifier>0?'+':''}${primary.acModifier} AC`:''}`});
  }
  db=clamp(Math.trunc(db),1,28);const chart=getDamageBase(db);const damageDice=chart?.rolled_damage||null;const attackValue=num(model.stats.combat[statKeyUsed]);let flat=num(model.damageRollBonus);
  breakdown.push({label:STAT_LABELS[statKeyUsed],value:`+${attackValue}`});if(flat)breakdown.push({label:'Static damage bonuses',value:`+${flat}`});
  const options=[];const caps=(model.grantedCapabilities||[]).map(c=>slug(c.name));const typed={firestarter:'Fire',fountain:'Water',freezer:'Ice',guster:'Flying',materializer:'Rock',zapper:'Electric'};
  for(const [cap,t] of Object.entries(typed))if(caps.includes(cap))options.push({type:t,category:'Special',stat:'spAttack',source:title(cap)});
  if(caps.includes('telekinetic'))options.push({type:'Normal',category:'Special',stat:'spAttack',range:`${model.skills['Focus']?.rank||2}m`,source:'Telekinetic'});
  if(primary&&String(primary.weaponClass||'').includes('melee')&&trainerHasSource(model,'silent-assassin'))options.push({type:'Ghost',category:primary.damageClass||'Physical',stat:statKeyUsed,range,source:'Silent Assassin · while Bound'});
  return {name:'Struggle Attack',type,category,stat:statKeyUsed,ac,baseDb:combatRank>=5?5:4,finalDb:db,range,expression:damageDice?addFlatToRoll(damageDice,attackValue+flat):null,attackValue,accuracyModifier:num(model.accuracyBonus),weapon:primary,qualification:{skill:qualificationSkill,rank:qualificationRank,source:qualificationSource},breakdown,options};
}

function backgroundBaseline(details={}){
  const ranks=Object.fromEntries(TRAINER_SKILLS.map(s=>[s,2]));const bg=details.background||{};
  if(skillName(bg.adept))ranks[skillName(bg.adept)]=4;
  if(skillName(bg.novice))ranks[skillName(bg.novice)]=3;
  for(const s of bg.pathetic||[]){const name=skillName(s);if(name)ranks[name]=1;}
  return ranks;
}
function weaponClassLabel(value){return ({large_melee:'Large Melee',small_melee:'Small Melee',short_range:'Short Range',long_range:'Long Range',arcane_large_melee:'Arcane Large Melee',arcane_small_melee:'Arcane Small Melee',arcane_short_range:'Arcane Short Range',arcane_long_range:'Arcane Long Range'})[value]||title(value);}
function trainerHasSource(model,id){const s=slug(id);return (model.sourceSummaryRaw||[]).some(x=>slug(x.id||x.name)===s);}
function weaponQualification(model,mechanics={}){
  const cls=String(mechanics.weaponClass||'');const arcane=mechanics.arcane===true||cls.startsWith('arcane_');const melee=cls.includes('melee');const metal=!!mechanics.metal;
  // PTU 1.05 Editation: Arcane Weapon Moves use Occult Education and the
  // revised tiers are Adept/Master. They do not need Arcane Training merely
  // to qualify for the Moves. Normal weapons continue to use Combat unless a
  // class/Feature explicitly supplies an alternate qualifying Skill.
  if(arcane){
    const rank=model.skills['Occult Education']?.rank||2;
    return {skill:'Occult Education',rank,source:'Arcane Weapon rules',rankName:['','Pathetic','Untrained','Novice','Adept','Expert','Master'][rank]||`Rank ${rank}`,arcane:true};
  }
  const configured=skillName(mechanics.qualification?.baseSkill);
  const baseSkill=configured||'Combat';
  const candidates=[{skill:baseSkill,rank:model.skills[baseSkill]?.rank||2,source:baseSkill==='Combat'?'Base weapon rules':'Weapon definition'}];
  if(mechanics.qualification?.allowFeatureSubstitutions!==false){
    if(melee&&trainerHasSource(model,'apparition'))for(const skill of ['Occult Education','Intimidate'])candidates.push({skill,rank:model.skills[skill]?.rank||2,source:'Apparition'});
    if(melee&&metal&&trainerHasSource(model,'steelheart'))for(const skill of ['Athletics','Focus'])candidates.push({skill,rank:model.skills[skill]?.rank||2,source:'Steelheart'});
    if(melee&&trainerHasSource(model,'herald-of-pride'))for(const skill of ['Command','Intimidate'])candidates.push({skill,rank:model.skills[skill]?.rank||2,source:'Herald of Pride'});
    if((cls==='small_melee'||cls==='short_range')&&trainerHasSource(model,'cutthroat'))for(const skill of ['Acrobatics','Athletics','Stealth'])candidates.push({skill,rank:model.skills[skill]?.rank||2,source:'Cutthroat'});
  }
  candidates.sort((a,b)=>b.rank-a.rank);const best=candidates[0];return {...best,rankName:['','Pathetic','Untrained','Novice','Adept','Expert','Master'][best.rank]||`Rank ${best.rank}`};
}
function resolveTrainerModel({trainer,rulesetId,getDefinition,getDamageBase}){
  const t=trainer||{}; const details=t.details||{}; const baseStats={}; for(const k of STAT_KEYS)baseStats[k]=num(t.stats?.[k]);
  const model={
    rulesetId,
    stats:{base:baseStats,bonus:Object.fromEntries(STAT_KEYS.map(k=>[k,0])),afterCombatStage:Object.fromEntries(STAT_KEYS.map(k=>[k,0])),effective:{},combat:{},stages:{},sources:Object.fromEntries(STAT_KEYS.map(k=>[k,[]]))},
    skills:Object.fromEntries(TRAINER_SKILLS.map(s=>{const bg=backgroundBaseline(details);const stored=details.skillRanks?.[s];const rank=stored==null?bg[s]:num(stored);return [s,{name:s,rank:clamp(Math.trunc(rank),1,8),dice:'',flatBonus:0,expression:'',sources:[{source:{kind:'background',id:'background',name:details.background?.name||'Background'},value:bg[s],type:'baseline'}],bonusCap:null}]})),
    capabilities:{power:0,overland:0,swim:0,highJump:0,longJump:0,throwingRange:0},capabilityBonuses:{},capabilitySources:{},
    modifiers:[],contextualEffects:[],unresolvedChoices:[],resources:[],abilities:[],grantedCapabilities:[],equipment:[],weapons:[],sourceSummaryRaw:[],
    defaultCombatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0},evasionBonus:0,evasionFixed:{physical:0,special:0,speed:0},derivedBonuses:{maxHp:0,maxAp:0},damageReduction:0,damageReductionByClass:{physical:0,special:0},damageRollBonus:0,accuracyBonus:0,saveCheckBonus:0,saveCheckBonusVolatile:0,effectRangeBonus:0,initiativeBonus:0,skillAdvantages:[],
    stabTypes:new Set(),flags:{traveler:false,initiativeSkill:null,twistedPower:false,adaptability:false},_moveMap:new Map()
  };
  const ctx={rulesetId,getDefinition,getDamageBase};

  const sources=[];
  for(const [kind,records] of [['feature',details.features||[]],['edge',details.edges||[]]]){
    const defKind=kind==='feature'?'features':'edges';
    for(const record of records){
      const definition=resolveDefinition(getDefinition,rulesetId,defKind,record.id)||null;
      const source=sourceRecord({kind,record,definition}); sources.push(source);
      if(kind==='feature')applyFeatureTags(model,source);
      for(const effect of definition?.compiledEffects||record.compiledEffects||[])applyCompiledEffect(model,effect,source,ctx);
      applyKnownSemantics(model,source,ctx);
      fallbackDirectGrants(model,source,ctx);
      if(definition?.semanticAutomation?.level==='manual_text' || definition?.semanticAutomation?.level==='hybrid'){
        const unstructured=String(definition?.raw?.effect_semantics?.unstructured_text||'').trim();
        const structured=(definition?.compiledEffects||[]).length>0;
        if(unstructured) model.contextualEffects.push({source:slimSource(source),target:'feature_effect',note:unstructured,contextual:true});
        else if(!structured && !/^You (?:learn|gain) the Moves?/i.test(String(source.effect||''))) model.contextualEffects.push({source:slimSource(source),target:'feature_effect',note:source.effect||'Effect requires table context.',contextual:true});
      }
    }
  }

  model.sourceSummaryRaw=sources;
  applyGmGrants(model,t);
  applyEquipment(model,t,ctx);
  applyAbilityMechanics(model);

  // Manual/provenance-recorded Trainer Moves remain valid alongside automatic grants.
  for(const record of details.moves||[]){
    const def=resolveDefinition(getDefinition,rulesetId,'moves',record.id||slug(record.name));
    if(!def)continue;
    const key=def.id||slug(def.name); let move=model._moveMap.get(key);
    const source={kind:record.sourceKind||'manual',id:record.id||key,name:record.sourceLabel||'Manual',sourceLabel:record.sourceLabel||'Manual'};
    if(!move){move={id:key,name:def.name,definition:def,sources:[],automatic:false};model._moveMap.set(key,move);}
    move.sources.push({kind:source.kind,id:source.id,name:source.name,label:source.sourceLabel,automatic:false}); move.automatic=false;
  }

  finalizeSkills(model);
  deriveCapabilities(model);

  for(const k of STAT_KEYS){
    model.stats.effective[k]=Math.max(0,baseStats[k]+model.stats.bonus[k]);
    if(k==='hp'){model.stats.combat[k]=model.stats.effective[k];model.stats.stages[k]=0;continue;}
    let stage=num(details.combatStages?.[k]); if(stage===0&&num(model.defaultCombatStages[k])!==0)stage=model.defaultCombatStages[k];
    stage=clamp(Math.trunc(stage),-6,6); model.stats.stages[k]=stage;
    model.stats.combat[k]=Math.max(0,applyCombatStage(model.stats.effective[k],stage)+model.stats.afterCombatStage[k]);
  }

  const level=Math.max(1,num(t.level)||1);
  const maxHp=level*2+model.stats.effective.hp*3+10+model.derivedBonuses.maxHp;
  const maxAp=5+Math.floor(level/5)+model.derivedBonuses.maxAp;
  const physicalEvasion=Math.min(6,Math.floor(model.stats.combat.defense/5))+model.evasionBonus+model.evasionFixed.physical+num(details.combatStages?.evasion);
  const specialEvasion=Math.min(6,Math.floor(model.stats.combat.spDefense/5))+model.evasionBonus+model.evasionFixed.special+num(details.combatStages?.evasion);
  const speedEvasion=Math.min(6,Math.floor(model.stats.combat.speed/5))+model.evasionBonus+model.evasionFixed.speed+num(details.combatStages?.evasion);
  let initiative=model.stats.combat.speed+model.initiativeBonus;
  if(model.flags.initiativeSkill)initiative+=model.skills[model.flags.initiativeSkill]?.rank||0;
  model.derived={maxHp,maxAp,physicalEvasion,specialEvasion,speedEvasion,initiative,accuracyBonus:model.accuracyBonus,effectRangeBonus:model.effectRangeBonus,saveCheckBonus:model.saveCheckBonus,saveCheckBonusVolatile:model.saveCheckBonusVolatile,damageReduction:model.damageReduction,damageReductionPhysical:model.damageReduction+model.damageReductionByClass.physical,damageReductionSpecial:model.damageReduction+model.damageReductionByClass.special,...model.capabilities};

  model.struggleAttack=resolveStruggleAttack(model,t,getDamageBase);
  model.moves=[...model._moveMap.values()].map(move=>({...move,resolvedDamage:resolveMoveDamageForTrainer(model,move,t,getDamageBase)})).sort((a,b)=>a.name.localeCompare(b.name));
  model.stabTypes=[...model.stabTypes];
  model.sourceSummary=sources.map(s=>({kind:s.kind,id:s.id,name:s.name,tags:s.tags,selections:s.selections,automation:s.definition?.semanticAutomation||null,rankedLimit:rankedLimit(s.tags)}));
  delete model.sourceSummaryRaw;
  delete model._moveMap;
  return model;
}


function trainerRecordMatches(record, id, name){
  return (id && slug(record?.id)===slug(id)) || (name && slug(record?.name)===slug(name));
}

function trainerDefinitionRepeatability(definition={}){
  const tags=Array.isArray(definition?.raw?.tags)?definition.raw.tags:[];
  const ranked=rankedLimit(tags);if(ranked)return {repeatable:true,maxRanks:ranked,kind:'ranked'};
  const id=slug(definition?.id||definition?.name);
  if(['elemental-connection','type-ace'].includes(id))return {repeatable:true,maxRanks:null,kind:'distinct_type'};
  if(['basic-skills','adept-skills','expert-skills','master-skills','skill-stunt','skill-enhancement','virtuoso'].includes(id))return {repeatable:true,maxRanks:null,kind:'multiple'};
  const effect=String(definition?.effect||definition?.raw?.effect_text||'');
  if(/may be taken multiple times/i.test(effect))return {repeatable:true,maxRanks:null,kind:'multiple'};
  return {repeatable:false,maxRanks:1,kind:'single'};
}

function evaluateTrainerPrerequisiteAst(ast,{trainer={},resolvedTrainer=null,rulesetId=null,getDefinition=null,gmOverride=false}={}){
  const details=trainer.details||{};
  const features=Array.isArray(details.features)?details.features:[];
  const edges=Array.isArray(details.edges)?details.edges:[];
  const result=(valid,reasons=[],manual=false)=>({valid:gmOverride?true:valid,reasons,manual:gmOverride?false:manual});
  const merge=(op,children)=>{
    const vals=children.map(c=>evalNode(c));
    if(op==='all'){
      if(vals.some(v=>v.valid===false)) return result(false,vals.flatMap(v=>v.reasons));
      if(vals.some(v=>v.valid==null)) return result(null,vals.flatMap(v=>v.reasons),true);
      return result(true,vals.flatMap(v=>v.reasons));
    }
    if(op==='any'){
      if(vals.some(v=>v.valid===true)) return result(true,vals.flatMap(v=>v.valid===true?v.reasons:[]));
      if(vals.some(v=>v.valid==null)) return result(null,vals.flatMap(v=>v.reasons),true);
      return result(false,vals.flatMap(v=>v.reasons));
    }
    return result(null,['Unsupported prerequisite group.'],true);
  };
  const resolvedSkillRank=skill=>{
    const name=skillName(skill)||skillName(String(skill||'').replace(/[-_]/g,' '));
    return name ? Number(resolvedTrainer?.skills?.[name]?.rank ?? details.skillRanks?.[name] ?? 2) : 0;
  };
  const resolveRecordDef=(kind,record)=>{
    if(typeof getDefinition!=='function'||!rulesetId)return null;
    return resolveDefinition(getDefinition,rulesetId,kind,record?.id||slug(record?.name));
  };
  const selectedTypes=()=>[...features,...edges].flatMap(r=>{
    const sel=r?.selections||{}; return [sel.type,sel.chosenType,sel.parameter, ...(Array.isArray(sel.types)?sel.types:[])].filter(Boolean).map(String);
  });
  const evalLeaf=n=>{
    const raw=n?.raw||'Prerequisite';
    switch(n?.kind){
      case 'none': return result(true,[]);
      case 'level_min': {
        const ok=Number(trainer.level||1)>=Number(n.value||0); return result(ok,ok?[]:[`Requires Level ${n.value}.`]);
      }
      case 'skill_rank_min': {
        const have=resolvedSkillRank(n.skill_name||n.skill); const need=Number(n.rank_value||0); const ok=have>=need;
        return result(ok,ok?[]:[`Requires ${n.rank||`Rank ${need}`} ${n.skill_name||n.skill}.`]);
      }
      case 'has_feature': {
        const ok=features.some(r=>trainerRecordMatches(r,n.id,n.name)); return result(ok,ok?[]:[`Requires Feature ${n.name||n.id}.`]);
      }
      case 'has_edge': {
        const ok=edges.some(r=>trainerRecordMatches(r,n.id,n.name)); return result(ok,ok?[]:[`Requires Edge ${n.name||n.id}.`]);
      }
      case 'ambiguous_entity': {
        const candidates=Array.isArray(n.candidates)?n.candidates:[];
        for(const [kind,ids] of candidates){
          const records=String(kind).startsWith('feature')?features:String(kind).startsWith('edge')?edges:[];
          if(records.some(r=>(ids||[]).some(id=>trainerRecordMatches(r,id,id)))) return result(true,[]);
        }
        return result(false,[`Requires ${raw}.`]);
      }
      case 'feature_count_min': {
        const group=slug(n.group); let count=0;
        for(const rec of features){const def=resolveRecordDef('features',rec); if(slug(def?.parentClass)===group||slug(def?.raw?.parent_class)===group)count++;}
        const ok=count>=Number(n.count||0); return result(ok,ok?[]:[`Requires ${n.count} ${n.group} Features (${count} found).`]);
      }
      case 'tagged_feature_count_min': {
        const wanted=slug(n.tag); let count=0;
        for(const rec of features){const def=resolveRecordDef('features',rec); if((def?.raw?.tags||[]).some(t=>slug(t)===wanted))count++;}
        const ok=count>=Number(n.count||0); return result(ok,ok?[]:[`Requires ${n.count} Feature(s) with [${n.tag}] (${count} found).`]);
      }
      case 'has_edge_or_feature_parameter': {
        const records=[...features,...edges].filter(r=>trainerRecordMatches(r,null,n.name));
        const target=slug(n.parameter); const ok=records.some(r=>Object.values(r.selections||{}).flatMap(v=>Array.isArray(v)?v:[v]).some(v=>slug(v?.name||v)===target));
        return result(ok,ok?[]:[`Requires ${n.name} (${n.parameter}).`]);
      }
      case 'has_ability': {
        const ok=(resolvedTrainer?.abilities||[]).some(a=>slug(a.id||a.name)===slug(n.id||n.name)); return result(ok,ok?[]:[`Requires Ability ${n.name||n.id}.`]);
      }
      case 'has_capability': {
        const name=n.name||n.id; const ok=(resolvedTrainer?.grantedCapabilities||[]).some(c=>slug(c.name)===slug(name));
        return ok?result(true,[]):result(null,[`Capability prerequisite needs confirmation: ${name}.`],true);
      }
      case 'chosen_type_equals': {
        const ok=selectedTypes().some(t=>slug(t)===slug(n.type)); return result(ok,ok?[]:[`Requires ${n.type} as a chosen Type.`]);
      }
      case 'gm_permission': return result(null,['Requires GM Permission.'],true);
      case 'manual':
      case 'skill_count_at_rank':
      case 'skill_group_rank_min':
      case 'legendary_gift_requirement':
      case 'campaign_or_bundle_requirement':
        return result(null,[raw],true);
      default: return result(null,[raw||`Unsupported prerequisite: ${n?.kind||'unknown'}`],true);
    }
  };
  const evalNode=n=>{
    if(!n)return result(true,[]);
    if(n.op==='all'||n.op==='any') return merge(n.op,n.children||[]);
    if(n.op==='leaf'||n.kind) return evalLeaf(n);
    return result(null,[n.raw||'Prerequisite requires manual review.'],true);
  };
  return evalNode(ast);
}

function evaluateTrainerDefinitionPrerequisite(definition,context={}){
  const semantics=definition?.prerequisiteSemantics||definition?.raw?.prerequisite_semantics||null;
  if(!semantics?.ast)return {valid:null,reasons:[definition?.prerequisites||'Prerequisite semantics unavailable.'],manual:true};
  const evaluated=evaluateTrainerPrerequisiteAst(semantics.ast,context);
  return {...evaluated,status:semantics.status||null,raw:definition?.prerequisites||definition?.raw?.prerequisites_text||''};
}

export {resolveTrainerModel, combatStageMultiplier, applyCombatStage, TRAINER_SKILLS, SKILL_CATEGORIES, STAT_KEYS, TYPE_NAMES, rankedLimit, trainerDefinitionRepeatability, evaluateTrainerPrerequisiteAst, evaluateTrainerDefinitionPrerequisite};
