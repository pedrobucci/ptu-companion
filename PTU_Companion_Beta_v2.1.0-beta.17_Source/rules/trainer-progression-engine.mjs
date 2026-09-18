import {resolveTrainerModel,evaluateTrainerDefinitionPrerequisite,trainerDefinitionRepeatability,STAT_KEYS} from './trainer-engine.mjs';

const MILESTONE_OPTIONS={
  5:[
    {id:'offense_stats',label:'Offensive Stat Track',description:'+2 retroactive Stat Points now; then +1 Attack/Sp. Attack Stat Point on Levels 6, 8, and 10.'},
    {id:'general_feature',label:'General Feature',description:'Gain one additional General Feature for which you qualify.'}
  ],
  10:[
    {id:'offense_stats',label:'Offensive Stat Track',description:'+1 Attack/Sp. Attack Stat Point on even Levels 12 through 20.'},
    {id:'two_edges',label:'Two Edges',description:'Gain two additional Edges for which you qualify.'}
  ],
  20:[
    {id:'offense_stats',label:'Offensive Stat Track',description:'+1 Attack/Sp. Attack Stat Point on even Levels 22 through 30.'},
    {id:'two_edges',label:'Two Edges',description:'Gain two additional Edges for which you qualify.'}
  ],
  30:[
    {id:'offense_stats',label:'Offensive Stat Track',description:'+1 Attack/Sp. Attack Stat Point on even Levels 32 through 40.'},
    {id:'two_edges',label:'Two Edges',description:'Gain two additional Edges for which you qualify.'},
    {id:'general_feature',label:'General Feature',description:'Gain one additional General Feature for which you qualify.'}
  ],
  40:[
    {id:'offense_stats',label:'Offensive Stat Track',description:'+1 Attack/Sp. Attack Stat Point on even Levels 42 through 50.'},
    {id:'two_edges',label:'Two Edges',description:'Gain two additional Edges for which you qualify.'},
    {id:'general_feature',label:'General Feature',description:'Gain one additional General Feature for which you qualify.'}
  ]
};
const SKILL_EDGE_IDS=new Set(['basic-skills','adept-skills','expert-skills','master-skills','skill-enhancement','skill-stunt','categoric-inclination','virtuoso']);
const TRAINER_LEVEL_XP_COST=10;
const TRAINER_EDGE_XP_COST=1;
const TRAINER_FEATURE_XP_COST=2;
const slug=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const clone=v=>JSON.parse(JSON.stringify(v));
const num=v=>Number.isFinite(Number(v))?Number(v):0;

function ensureProgression(details={}){
  details.progression ||= {};
  details.progression.milestoneChoices ||= {};
  details.progression.levelHistory ||= [];
  return details.progression;
}
function milestoneChoice(details,level){return ensureProgression(details).milestoneChoices?.[String(level)]||null;}
function offensiveTrackApplies(details,level){
  if(level%2!==0)return false;
  const ranges=[[5,6,10],[10,12,20],[20,22,30],[30,32,40],[40,42,50]];
  return ranges.some(([milestone,start,end])=>level>=start&&level<=end&&milestoneChoice(details,milestone)==='offense_stats');
}
function trainerLevelRewards(trainer,nextLevel,selectedMilestoneChoice=null){
  const level=Math.max(2,Math.min(50,Number(nextLevel)||Number(trainer?.level||1)+1));
  const details=trainer?.details||{};
  const milestoneOptions=MILESTONE_OPTIONS[level]||[];
  const chosen=selectedMilestoneChoice||milestoneChoice(details,level)||null;
  let featureCount=level%2===1?1:0;
  let edgeCount=level%2===0?1:0;
  const skillEdgeCount=[2,6,12].includes(level)?1:0;
  let offensiveStatPoints=offensiveTrackApplies(details,level)?1:0;
  let generalFeatureCount=0;
  let milestoneEdgeCount=0;
  if(level===5 && chosen==='offense_stats')offensiveStatPoints+=2;
  if(level===5 && chosen==='general_feature')generalFeatureCount+=1;
  if([10,20,30,40].includes(level) && chosen==='two_edges')milestoneEdgeCount+=2;
  if([30,40].includes(level) && chosen==='general_feature')generalFeatureCount+=1;
  return {
    level,baseStatPoints:1,offensiveStatPoints,
    featureCount,edgeCount,skillEdgeCount,generalFeatureCount,milestoneEdgeCount,
    totalFeatures:featureCount+generalFeatureCount,totalEdges:edgeCount+milestoneEdgeCount,totalSkillEdges:skillEdgeCount,
    skillRankUnlock:level===2?'Adept':level===6?'Expert':level===12?'Master':null,
    milestone:{required:milestoneOptions.length>0,level,options:milestoneOptions,choice:chosen}
  };
}
function recordFromDefinition(def,{rank=1,selections={},addedAtLevel=null,progressionSource='level_up'}={}){
  return {id:def.id,name:def.name,definitionVersionId:def.versionId||def.definitionVersionId||null,contentPackId:def.contentPackId||null,sourceLabel:def.packName||def.sourceId||'Active Ruleset',prerequisites:def.prerequisites||'',effect:def.effect||'',tags:def.raw?.tags||[],compiledEffects:def.compiledEffects||[],semanticAutomation:def.semanticAutomation||null,selections,rank,addedAt:new Date().toISOString(),addedAtLevel,progressionSource};
}
function isGeneralFeature(def){return !def?.parentClass && !String(def?.raw?.tags||[]).toLowerCase().includes('class');}
function isSkillEdge(def){return SKILL_EDGE_IDS.has(def?.id)||Number(def?.sourcePage)===52||/skill edge/i.test(String(def?.raw?.section||''));}
function isClassFeatureDefinition(def){return !!def && ((def.raw?.tags||[]).some(t=>String(t).toLowerCase()==='class') || (!!def.parentClass && slug(def.parentClass)===slug(def.name)));}
function countClassFeatures(records,getDefinition,rulesetId){
  let count=0;
  for(const r of records||[]){const d=getDefinition({rulesetId,kind:'features',id:r.id}); if(isClassFeatureDefinition(d))count++;}
  return count;
}
function duplicateStatus(def,records=[]){
  const repeat=trainerDefinitionRepeatability(def); const existing=records.filter(r=>slug(r.id||r.name)===slug(def.id||def.name));
  const ranks=existing.reduce((s,r)=>s+Math.max(1,Number(r.rank||1)),0);
  const exhausted=!repeat.repeatable?ranks>=1:(repeat.maxRanks!=null?ranks>=repeat.maxRanks:false);
  return {repeatability:repeat,existingRanks:ranks,nextRank:ranks+1,exhausted};
}
function applyDraftToTrainer(trainer,draft,getDefinition,rulesetId){
  const projected=clone(trainer); projected.level=Math.min(50,Number(trainer.level||1)+1); projected.details ||= {}; projected.details.features ||= []; projected.details.edges ||= [];
  projected.stats ||= {};
  for(const k of STAT_KEYS)projected.stats[k]=num(projected.stats[k])+num(draft?.statAllocations?.[k]);
  projected.stats.attack=num(projected.stats.attack)+num(draft?.offensiveStatAllocations?.attack);
  projected.stats.spAttack=num(projected.stats.spAttack)+num(draft?.offensiveStatAllocations?.spAttack);
  for(const sel of draft?.features||[]){const def=getDefinition({rulesetId,kind:'features',id:sel.id}); if(def)projected.details.features.push(recordFromDefinition(def,{rank:sel.rank||1,selections:sel.selections||{},addedAtLevel:projected.level}));}
  for(const sel of [...(draft?.edges||[]),...(draft?.skillEdges||[])]){const def=getDefinition({rulesetId,kind:'edges',id:sel.id}); if(def)projected.details.edges.push(recordFromDefinition(def,{rank:sel.rank||1,selections:sel.selections||{},addedAtLevel:projected.level}));}
  const prog=ensureProgression(projected.details); if(draft?.milestoneChoice)prog.milestoneChoices[String(projected.level)]=draft.milestoneChoice;
  return projected;
}
function collectDefinitionRows(listDefinitions,{rulesetId,kind}){
  const rows=[]; const pageSize=200;
  for(let offset=0; offset<5000; offset+=pageSize){const chunk=listDefinitions({rulesetId,kind,q:'',limit:pageSize,offset})||[]; rows.push(...chunk); if(chunk.length<pageSize)break;}
  return rows;
}
function candidateRows({kind,trainer,draft,rulesetId,getDefinition,listDefinitions,getDamageBase,filter='normal',gmOverride=false,definitionRows=null,definitionMap=null}){
  const projected=applyDraftToTrainer(trainer,draft,getDefinition,rulesetId);
  const resolved=resolveTrainerModel({trainer:projected,rulesetId,getDefinition,getDamageBase});
  const records=kind==='features'?projected.details.features:projected.details.edges;
  const rows=definitionRows||collectDefinitionRows(listDefinitions,{rulesetId,kind});
  const classCount=kind==='features'?countClassFeatures(projected.details.features,getDefinition,rulesetId):0;
  return rows.map(row=>{
    const def=definitionMap?.get(row.id)||getDefinition({rulesetId,kind,id:row.id}); if(!def)return null;
    if(filter==='general_feature'&&!isGeneralFeature(def))return null;
    if(filter==='skill_edge'&&!isSkillEdge(def))return null;
    const prereq=evaluateTrainerDefinitionPrerequisite(def,{trainer:projected,resolvedTrainer:resolved,rulesetId,getDefinition,gmOverride});
    const duplicate=duplicateStatus(def,records);
    let classBlocked=false;
    if(kind==='features'&&isClassFeatureDefinition(def)&&classCount>=4&&!records.some(r=>slug(r.id)===slug(def.id))) classBlocked=true;
    const valid=gmOverride?true:(!duplicate.exhausted&&!classBlocked&&prereq.valid!==false);
    return {id:def.id,name:def.name,parentClass:def.parentClass||null,tags:def.raw?.tags||[],prerequisites:def.prerequisites||'',effect:def.effect||'',packName:def.packName||def.sourceId,sourcePage:def.sourcePage,semanticAutomation:def.semanticAutomation||null,prerequisite:prereq,duplicate,classBlocked,valid,manual:prereq.valid==null};
  }).filter(Boolean).sort((a,b)=>Number(b.valid)-Number(a.valid)||a.name.localeCompare(b.name));
}
function previewTrainerProgression({trainer,draft={},rulesetId,getDefinition,listDefinitions,getDamageBase,gmOverride=false,includeOptions=true}={}){
  const nextLevel=Number(trainer?.level||1)+1;
  if(nextLevel>50)return {valid:false,errors:['Trainer is already at the maximum Level of 50.'],nextLevel,rewards:null};
  const rewards=trainerLevelRewards(trainer,nextLevel,draft.milestoneChoice||null);
  const errors=[];
  const milestoneLevelUp=!!draft.milestoneLevelUp;
  const xpCost=milestoneLevelUp?0:TRAINER_LEVEL_XP_COST;
  const availableXp=Math.max(0,num(trainer?.exp));
  if(milestoneLevelUp&&!gmOverride)errors.push('Milestone Level Up requires GM Override confirmation.');
  if(!milestoneLevelUp&&availableXp<xpCost)errors.push(`Level Up requires ${xpCost} Trainer Experience; only ${availableXp} XP remain in the Experience Bank.`);
  if(rewards.milestone.required&&!draft.milestoneChoice)errors.push(`Level ${nextLevel} requires a milestone bonus choice.`);
  const statAlloc=draft.statAllocations||{}; const baseSpent=STAT_KEYS.reduce((s,k)=>s+num(statAlloc[k]),0);
  if(baseSpent!==rewards.baseStatPoints)errors.push(`Spend exactly ${rewards.baseStatPoints} normal Stat Point.`);
  if(STAT_KEYS.some(k=>num(statAlloc[k])<0))errors.push('Stat allocations cannot be negative.');
  const offense=draft.offensiveStatAllocations||{}; const offenseSpent=num(offense.attack)+num(offense.spAttack);
  if(offenseSpent!==rewards.offensiveStatPoints)errors.push(`Spend exactly ${rewards.offensiveStatPoints} milestone Stat Point${rewards.offensiveStatPoints===1?'':'s'} on Attack and/or Special Attack.`);
  if(num(offense.attack)<0||num(offense.spAttack)<0)errors.push('Offensive milestone Stat allocations cannot be negative.');
  if((draft.features||[]).length!==rewards.totalFeatures)errors.push(`Choose exactly ${rewards.totalFeatures} Feature${rewards.totalFeatures===1?'':'s'} for this level.`);
  if((draft.edges||[]).length!==rewards.totalEdges)errors.push(`Choose exactly ${rewards.totalEdges} regular Edge${rewards.totalEdges===1?'':'s'} for this level.`);
  if((draft.skillEdges||[]).length!==rewards.totalSkillEdges)errors.push(`Choose exactly ${rewards.totalSkillEdges} bonus Skill Edge${rewards.totalSkillEdges===1?'':'s'} for this level.`);
  if(rewards.generalFeatureCount && (draft.features||[]).length){
    const generalCount=(draft.features||[]).filter(x=>{const d=getDefinition({rulesetId,kind:'features',id:x.id});return isGeneralFeature(d)}).length;
    if(generalCount<rewards.generalFeatureCount)errors.push(`At least ${rewards.generalFeatureCount} selected Feature must be a General Feature from the milestone bonus.`);
  }
  const projected=applyDraftToTrainer(trainer,draft,getDefinition,rulesetId);
  const resolvedTrainer=resolveTrainerModel({trainer:projected,rulesetId,getDefinition,getDamageBase});
  const checkSelections=(kind,list,filter='normal')=>{
    const records=kind==='features'?projected.details.features:projected.details.edges;
    for(const choice of list||[]){
      const def=getDefinition({rulesetId,kind,id:choice.id}); if(!def){errors.push(`Selected ${kind==='features'?'Feature':'Edge'} ${choice.id} is not in the active Ruleset.`);continue;}
      const prereq=evaluateTrainerDefinitionPrerequisite(def,{trainer:projected,resolvedTrainer,rulesetId,getDefinition,gmOverride});
      if(prereq.valid===false&&!gmOverride)errors.push(`${def.name}: ${prereq.reasons.join(' ')}`);
      if(prereq.valid==null&&!choice.manualConfirm&&!gmOverride)errors.push(`${def.name}: prerequisite requires manual confirmation.`);
      const dup=duplicateStatus(def,records.filter(r=>!(r.addedAtLevel===nextLevel&&slug(r.id)===slug(def.id))));
      const selectedCount=[...(draft.features||[]),...(draft.edges||[]),...(draft.skillEdges||[])].filter(x=>slug(x.id)===slug(def.id)).length;
      const rep=trainerDefinitionRepeatability(def);
      if(!rep.repeatable && selectedCount>1&&!gmOverride)errors.push(`${def.name} cannot be taken multiple times.`);
      if(rep.maxRanks!=null && dup.existingRanks+selectedCount>rep.maxRanks&&!gmOverride)errors.push(`${def.name} cannot exceed Rank ${rep.maxRanks}.`);
      if(filter==='skill_edge'&&!isSkillEdge(def))errors.push(`${def.name} is not a Skill Edge.`);
    }
  };
  checkSelections('features',draft.features||[]);
  checkSelections('edges',draft.edges||[]);
  checkSelections('edges',draft.skillEdges||[],'skill_edge');
  if(!gmOverride){
    for(const [kind,records] of [['features',projected.details.features||[]],['edges',projected.details.edges||[]]]){
      const byId=new Map();for(const record of records){const key=slug(record.id||record.name);if(!byId.has(key))byId.set(key,[]);byId.get(key).push(record);}
      for(const [id,group] of byId){const def=getDefinition({rulesetId,kind,id});if(!def)continue;const rep=trainerDefinitionRepeatability(def);
        if(rep.kind==='distinct_type'){const types=group.map(x=>slug(x.selections?.type)).filter(Boolean);if(new Set(types).size!==types.length)errors.push(`${def.name} must choose a different Type for each instance.`);}
        if(id==='skill-enhancement'){const used=[];for(const rec of group)used.push(...(rec.selections?.skills||[]));if(new Set(used).size!==used.length)errors.push(`${def.name} cannot apply its bonus to the same Skill more than once.`);}
      }
    }
  }
  // The bonus Skill Edge gained at Levels 2/6/12 cannot be used to purchase the
  // newly unlocked Skill Rank on that same milestone. This is distinct from any
  // regular Edge the Trainer may also receive that level.
  const prohibitedBonusSkillEdge={2:'adept-skills',6:'expert-skills',12:'master-skills'}[nextLevel]||null;
  if(prohibitedBonusSkillEdge && (draft.skillEdges||[]).some(x=>slug(x.id)===prohibitedBonusSkillEdge) && !gmOverride){
    errors.push(`The Level ${nextLevel} bonus Skill Edge cannot be used to Rank Up a Skill to ${rewards.skillRankUnlock} Rank.`);
  }
  let optionSets;
  if(includeOptions){
    const featureRows=collectDefinitionRows(listDefinitions,{rulesetId,kind:'features'});
    const edgeRows=collectDefinitionRows(listDefinitions,{rulesetId,kind:'edges'});
    const featureMap=new Map(featureRows.map(row=>[row.id,getDefinition({rulesetId,kind:'features',id:row.id})]).filter(([,d])=>d));
    const edgeMap=new Map(edgeRows.map(row=>[row.id,getDefinition({rulesetId,kind:'edges',id:row.id})]).filter(([,d])=>d));
    const rawSkillEdges=candidateRows({kind:'edges',trainer,draft,rulesetId,getDefinition,listDefinitions,getDamageBase,filter:'skill_edge',gmOverride,definitionRows:edgeRows,definitionMap:edgeMap});
    const skillEdges=rawSkillEdges.map(row=>{
      if(!prohibitedBonusSkillEdge || slug(row.id)!==prohibitedBonusSkillEdge || gmOverride)return row;
      return {...row,valid:false,manual:false,milestoneBlocked:true,prerequisite:{...(row.prerequisite||{}),valid:false,reasons:[...((row.prerequisite?.reasons)||[]),`Level ${nextLevel} bonus Skill Edge cannot Rank a Skill to ${rewards.skillRankUnlock}.`]}};
    });
    optionSets={
      features:candidateRows({kind:'features',trainer,draft,rulesetId,getDefinition,listDefinitions,getDamageBase,filter:'normal',gmOverride,definitionRows:featureRows,definitionMap:featureMap}),
      generalFeatures:candidateRows({kind:'features',trainer,draft,rulesetId,getDefinition,listDefinitions,getDamageBase,filter:'general_feature',gmOverride,definitionRows:featureRows,definitionMap:featureMap}),
      edges:candidateRows({kind:'edges',trainer,draft,rulesetId,getDefinition,listDefinitions,getDamageBase,filter:'normal',gmOverride,definitionRows:edgeRows,definitionMap:edgeMap}),
      skillEdges
    };
  }
  return {valid:errors.length===0,errors,nextLevel,rewards,xpCost,availableXp,milestoneLevelUp,projectedTrainer:projected,resolvedTrainer,optionSets};
}
function applyTrainerProgression({trainer,draft,preview,getDefinition,rulesetId}={}){
  if(!preview?.valid)throw new Error('Trainer progression preview is not valid.');
  const t=clone(trainer); const level=preview.nextLevel; t.level=level; t.details ||= {}; t.details.features ||= []; t.details.edges ||= []; t.stats ||= {};
  for(const k of STAT_KEYS)t.stats[k]=num(t.stats[k])+num(draft?.statAllocations?.[k]);
  t.stats.attack=num(t.stats.attack)+num(draft?.offensiveStatAllocations?.attack);
  t.stats.spAttack=num(t.stats.spAttack)+num(draft?.offensiveStatAllocations?.spAttack);
  const add=(kind,choices)=>{for(const choice of choices||[]){const def=getDefinition({rulesetId,kind,id:choice.id}); if(!def)continue; const target=kind==='features'?t.details.features:t.details.edges; target.push(recordFromDefinition(def,{rank:choice.rank||1,selections:choice.selections||{},addedAtLevel:level}));}};
  add('features',draft.features); add('edges',draft.edges); add('edges',draft.skillEdges);
  const progression=ensureProgression(t.details); if(draft.milestoneChoice)progression.milestoneChoices[String(level)]=draft.milestoneChoice;
  const xpCost=Math.max(0,Number(preview.xpCost||0));
  t.exp=Math.max(0,num(t.exp)-xpCost); t.nextExp=TRAINER_LEVEL_XP_COST;
  const entry={level,at:new Date().toISOString(),statAllocations:clone(draft.statAllocations||{}),offensiveStatAllocations:clone(draft.offensiveStatAllocations||{}),features:(draft.features||[]).map(x=>x.id),edges:(draft.edges||[]).map(x=>x.id),skillEdges:(draft.skillEdges||[]).map(x=>x.id),milestoneChoice:draft.milestoneChoice||null,milestoneLevelUp:!!preview.milestoneLevelUp,xpCost,xpRemaining:t.exp};
  progression.levelHistory.push(entry);
  t.history ||= []; t.history.push({id:`h-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,date:new Date().toISOString().slice(0,10),title:`Reached Level ${level}`,detail:[xpCost?`Trainer XP -${xpCost} (${t.exp} remaining)`:'Milestone Level Up · 0 XP',...Object.entries(draft.statAllocations||{}).filter(([,v])=>num(v)>0).map(([k,v])=>`${k} +${v}`),...(draft.features||[]).map(x=>`Feature: ${x.name||x.id}`),...(draft.edges||[]).map(x=>`Edge: ${x.name||x.id}`),...(draft.skillEdges||[]).map(x=>`Skill Edge: ${x.name||x.id}`)].join(' · ')||'Trainer progression'});
  return t;
}

function previewTrainerXpPurchase({trainer,kind,id,selections={},manualConfirm=false,rulesetId,getDefinition,getDamageBase,gmOverride=false}={}){
  const normalizedKind=kind==='features'?'features':kind==='edges'?'edges':null;
  const cost=normalizedKind==='features'?TRAINER_FEATURE_XP_COST:TRAINER_EDGE_XP_COST;
  const availableXp=Math.max(0,num(trainer?.exp)); const errors=[];
  if(!normalizedKind)errors.push('XP purchases support only Trainer Features and Edges.');
  if(availableXp<cost)errors.push(`Requires ${cost} Trainer Experience; only ${availableXp} XP remain in the Experience Bank.`);
  const def=normalizedKind?getDefinition({rulesetId,kind:normalizedKind,id}):null;
  if(!def)errors.push('The selected Trainer definition is not available in the active Ruleset.');
  let prereq={valid:false,reasons:[]},duplicate={nextRank:1,existingRanks:0,exhausted:false,repeatability:{repeatable:false,maxRanks:1}},classBlocked=false;
  if(def){
    const projected=clone(trainer); projected.details ||= {}; projected.details.features ||= []; projected.details.edges ||= [];
    const records=normalizedKind==='features'?projected.details.features:projected.details.edges;
    duplicate=duplicateStatus(def,records);
    if(duplicate.exhausted&&!gmOverride)errors.push(`${def.name} cannot be taken another time.`);
    if(normalizedKind==='features'&&isClassFeatureDefinition(def)){
      const classCount=countClassFeatures(projected.details.features,getDefinition,rulesetId);
      classBlocked=classCount>=4&&!records.some(r=>slug(r.id)===slug(def.id));
      if(classBlocked&&!gmOverride)errors.push('Trainer already has the maximum of four Classes.');
    }
    const resolvedTrainer=resolveTrainerModel({trainer:projected,rulesetId,getDefinition,getDamageBase});
    prereq=evaluateTrainerDefinitionPrerequisite(def,{trainer:projected,resolvedTrainer,rulesetId,getDefinition,gmOverride});
    if(prereq.valid===false&&!gmOverride)errors.push(`${def.name}: ${(prereq.reasons||[]).join(' ')||'Prerequisites are not satisfied.'}`);
    if(prereq.valid==null&&!manualConfirm&&!gmOverride)errors.push(`${def.name}: prerequisite requires manual confirmation.`);
    const same=records.filter(r=>slug(r.id||r.name)===slug(def.id||def.name));
    const rep=trainerDefinitionRepeatability(def);
    if(rep.kind==='distinct_type'&&selections?.type&&same.some(r=>slug(r.selections?.type)===slug(selections.type))&&!gmOverride)errors.push(`${def.name} must choose a different Type for each instance.`);
    if(slug(def.id)==='skill-enhancement'&&Array.isArray(selections?.skills)){
      const used=new Set(same.flatMap(r=>r.selections?.skills||[])); const repeated=selections.skills.find(x=>used.has(x));
      if(repeated&&!gmOverride)errors.push(`${def.name} cannot apply its bonus to ${repeated} more than once.`);
    }
  }
  return {valid:errors.length===0,errors,kind:normalizedKind,id:def?.id||id,name:def?.name||id,cost,availableXp,xpRemaining:Math.max(0,availableXp-cost),rank:duplicate.nextRank||1,manualRequired:prereq.valid==null,prerequisite:prereq,duplicate,classBlocked};
}
function applyTrainerXpPurchase({trainer,kind,id,selections={},preview,getDefinition,rulesetId}={}){
  if(!preview?.valid)throw new Error('Trainer XP purchase preview is not valid.');
  const def=getDefinition({rulesetId,kind,id}); if(!def)throw new Error('Trainer definition is unavailable.');
  const t=clone(trainer); t.details ||= {}; t.details.features ||= []; t.details.edges ||= [];
  const target=kind==='features'?t.details.features:t.details.edges;
  const record=recordFromDefinition(def,{rank:preview.rank||1,selections,addedAtLevel:Number(t.level||1),progressionSource:'xp_purchase'});
  record.xpCost=Number(preview.cost||0); record.purchasedWithXp=true; target.push(record);
  t.exp=Math.max(0,num(t.exp)-Number(preview.cost||0)); t.nextExp=TRAINER_LEVEL_XP_COST;
  const progression=ensureProgression(t.details); progression.xpPurchases ||= []; progression.xpPurchases.push({at:new Date().toISOString(),kind,id:def.id,name:def.name,cost:Number(preview.cost||0),level:Number(t.level||1),rank:Number(preview.rank||1)});
  t.history ||= []; t.history.push({id:`h-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,date:new Date().toISOString().slice(0,10),title:`${kind==='features'?'Feature':'Edge'} purchased with Trainer XP`,detail:`${def.name} · -${preview.cost} XP · ${t.exp} XP remaining`});
  return t;
}

export {MILESTONE_OPTIONS,SKILL_EDGE_IDS,TRAINER_LEVEL_XP_COST,TRAINER_EDGE_XP_COST,TRAINER_FEATURE_XP_COST,trainerLevelRewards,previewTrainerProgression,applyTrainerProgression,previewTrainerXpPurchase,applyTrainerXpPurchase,isGeneralFeature,isSkillEdge,recordFromDefinition};
