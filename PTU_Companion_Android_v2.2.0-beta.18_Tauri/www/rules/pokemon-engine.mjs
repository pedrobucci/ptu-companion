/*
 * PTU Companion v1.1 — Pokémon build/progression rules with campaign-specific HP relation handling.
 *
 * Grounded in Pokémon Tabletop United 1.05 Core, Chapter 5:
 * - Nature modifies Base Stats before Level-Up Stat Points.
 * - HP Nature adjustment is +/-1; all other adjusted Stats are +/-2, minimum 1.
 * - A Pokémon receives Level + 10 Stat Points at its current Level.
 * - Campaign rule: HP is exempt from Base Relations validation; the other five Stats remain constrained.
 *   (This intentionally differs from the PTU Core default and is documented as a campaign/app rule.)
 * - Pokémon HP = Level + (HP Stat x 3) + 10.
 * - Ability unlocks: 1 Basic initially; second at Level 20 (Basic/Advanced);
 *   third at Level 40 (any native Ability).
 * - Base Move limit is 6, but external Features/Abilities may change it.
 * - Pokémon begin with 1 Tutor Point; +1 at Level 5 and every multiple of 5.
 *
 * This module deliberately does not execute Features/Abilities that alter these rules yet.
 */

export const STAT_KEYS = ['hp','attack','defense','special_attack','special_defense','speed'];
export const STAT_LABELS = {
  hp:'HP', attack:'Attack', defense:'Defense', special_attack:'Special Attack',
  special_defense:'Special Defense', speed:'Speed'
};

const NATURE_ROWS = [
  ['Cuddly','hp','attack'],['Distracted','hp','defense'],['Proud','hp','special_attack'],['Decisive','hp','special_defense'],['Patient','hp','speed'],
  ['Desperate','attack','hp'],['Lonely','attack','defense'],['Adamant','attack','special_attack'],['Naughty','attack','special_defense'],['Brave','attack','speed'],
  ['Stark','defense','hp'],['Bold','defense','attack'],['Impish','defense','special_attack'],['Lax','defense','special_defense'],['Relaxed','defense','speed'],
  ['Curious','special_attack','hp'],['Modest','special_attack','attack'],['Mild','special_attack','defense'],['Rash','special_attack','special_defense'],['Quiet','special_attack','speed'],
  ['Dreamy','special_defense','hp'],['Calm','special_defense','attack'],['Gentle','special_defense','defense'],['Careful','special_defense','special_attack'],['Sassy','special_defense','speed'],
  ['Skittish','speed','hp'],['Timid','speed','attack'],['Hasty','speed','defense'],['Jolly','speed','special_attack'],['Naive','speed','special_defense'],
  ['Composed','hp','hp'],['Hardy','attack','attack'],['Docile','defense','defense'],['Bashful','special_attack','special_attack'],['Quirky','special_defense','special_defense'],['Serious','speed','speed']
];

export const NATURES = NATURE_ROWS.map(([name,raise,lower],i)=>({value:i+1,name,raise,lower,neutral:raise===lower}));
export const NATURE_BY_NAME = new Map(NATURES.map(n=>[n.name.toLowerCase(),n]));

const int = (v, fallback=0) => Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback;

export function normalizeBaseStats(baseStats={}){
  return {
    hp:int(baseStats.hp), attack:int(baseStats.attack), defense:int(baseStats.defense),
    special_attack:int(baseStats.special_attack ?? baseStats.spAttack),
    special_defense:int(baseStats.special_defense ?? baseStats.spDefense), speed:int(baseStats.speed)
  };
}

export function normalizeAllocations(allocations={}){
  return Object.fromEntries(STAT_KEYS.map(k=>[k,Math.max(0,int(allocations[k]))]));
}

export function applyNature(baseStats, natureName){
  const base=normalizeBaseStats(baseStats);
  const nature=NATURE_BY_NAME.get(String(natureName||'').trim().toLowerCase()) || NATURE_BY_NAME.get('hardy');
  const out={...base};
  if(!nature.neutral){
    out[nature.raise]=Math.max(1,out[nature.raise]+(nature.raise==='hp'?1:2));
    out[nature.lower]=Math.max(1,out[nature.lower]-(nature.lower==='hp'?1:2));
  }
  return {nature,stats:out};
}

export const HP_IGNORES_BASE_RELATIONS = true;

export function normalizeRelationExemptStats(exemptStats=[]){
  const out=new Set(['hp']); // Campaign rule: HP is always exempt.
  for(const raw of (Array.isArray(exemptStats)?exemptStats:[])){
    const key=String(raw||'').trim().toLowerCase().replace(/\s+/g,'_');
    if(key==='sp_attack'||key==='sp.atk'||key==='spatk'||key==='specialattack') out.add('special_attack');
    else if(STAT_KEYS.includes(key)) out.add(key);
  }
  return [...out];
}

export function relationExemptionsFromPokeEdges(pokeEdges=[]){
  const out=['hp'];
  for(const edge of (Array.isArray(pokeEdges)?pokeEdges:[])){
    const id=String(edge?.id||'').toLowerCase();
    if(id!=='attack-conflict') continue;
    const target=String(edge?.targetStat||edge?.targetNote||'').trim().toLowerCase();
    if(/special|sp\.?\s*attack|spatk/.test(target)) out.push('special_attack');
    else if(/attack|atk/.test(target)) out.push('attack');
  }
  return normalizeRelationExemptStats(out);
}

export function getBaseRelationPairs(natureAdjustedBase,{exemptStats=[]}={}){
  const b=normalizeBaseStats(natureAdjustedBase);
  const exempt=new Set(normalizeRelationExemptStats(exemptStats));
  const pairs=[];
  for(const high of STAT_KEYS){
    for(const low of STAT_KEYS){
      if(exempt.has(high) || exempt.has(low)) continue;
      if(b[high]>b[low]) pairs.push({higher:high,lower:low,baseHigher:b[high],baseLower:b[low]});
    }
  }
  return pairs;
}

export function validateBaseRelations(natureAdjustedBase, finalStats,{exemptStats=[]}={}){
  const violations=[];
  for(const pair of getBaseRelationPairs(natureAdjustedBase,{exemptStats})){
    if(int(finalStats[pair.higher])<=int(finalStats[pair.lower])){
      violations.push({
        higher:pair.higher, lower:pair.lower,
        message:`${STAT_LABELS[pair.higher]} must remain higher than ${STAT_LABELS[pair.lower]} (Base Relations).`
      });
    }
  }
  // De-duplicate transitive/repeated messages deterministically.
  return [...new Map(violations.map(v=>[`${v.higher}>${v.lower}`,v])).values()];
}

export function tutorPointsAtLevel(level){
  level=Math.max(1,Math.min(100,int(level,1)));
  return 1+Math.floor(level/5);
}

export function levelAbilitySlots(level){
  level=Math.max(1,Math.min(100,int(level,1)));
  const slots=[{index:1,label:'Starting Ability',allowedCategories:['basic'],unlockLevel:1}];
  if(level>=20) slots.push({index:2,label:'Level 20 Ability',allowedCategories:['basic','advanced'],unlockLevel:20});
  if(level>=40) slots.push({index:3,label:'Level 40 Ability',allowedCategories:['basic','advanced','high'],unlockLevel:40});
  return slots;
}

export function eligibleAbilities(abilitySlots=[]){
  return (Array.isArray(abilitySlots)?abilitySlots:[]).map(a=>({
    id:a.ability_id || String(a.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
    name:a.name || a.ability_id || 'Unknown Ability',
    category:String(a.slot_category||'').toLowerCase() || (/high/i.test(a.slot||'')?'high':/adv/i.test(a.slot||'')?'advanced':'basic'),
    sourceSlot:a.slot || null,
    sourceIndex:a.slot_index ?? null
  })).filter(a=>a.name);
}

function numericMoveLevel(value){
  const n=Number(String(value??'').trim());
  return Number.isFinite(n)?Math.trunc(n):null;
}

export function eligibleNaturalMoves(levelUpMoves=[], level){
  level=Math.max(1,Math.min(100,int(level,1)));
  return (Array.isArray(levelUpMoves)?levelUpMoves:[]).map((m,index)=>{
    const numeric=numericMoveLevel(m.level);
    const isEvolution=/^evo/i.test(String(m.level||''));
    return {
      key:m.move_id || `${String(m.move||'move').toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${index}`,
      id:m.move_id || null,
      name:m.move || m.move_id || 'Unknown Move',
      level:m.level,
      numericLevel:numeric,
      typeHint:m.type_hint || null,
      isEvolution,
      eligible:isEvolution || (numeric!=null && numeric<=level),
      eligibilityReason:isEvolution?'Evolution Move':(numeric!=null?`Level ${numeric}`:'Manual/Unparsed')
    };
  }).filter(m=>m.eligible);
}

export function preEvolutionNaturalMoves(preEvolutionSpecies=[]){
  const out=[];
  for(const ancestor of (Array.isArray(preEvolutionSpecies)?preEvolutionSpecies:[])){
    const sourceName=ancestor?.name || ancestor?.id || 'Pre-Evolution';
    const moves=Array.isArray(ancestor?.levelUpMoves)?ancestor.levelUpMoves:[];
    moves.forEach((m,index)=>{
      const numeric=numericMoveLevel(m.level);
      const isEvolution=/^evo/i.test(String(m.level||''));
      const id=m.move_id || null;
      const slug=id || String(m.move||'move').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      out.push({
        key:`pre:${ancestor.id||sourceName}:${slug}:${index}`,
        id,
        name:m.move || m.move_id || 'Unknown Move',
        level:m.level,
        numericLevel:numeric,
        typeHint:m.type_hint || null,
        isEvolution,
        eligible:true,
        eligibilityReason:`Pre-Evolution · ${sourceName}${m.level!=null?` · ${isEvolution?'Evo':`Lv ${m.level}`}`:''}`,
        sourceKind:'pre_evolution',
        sourceSpeciesId:ancestor.id||null,
        sourceSpeciesName:sourceName
      });
    });
  }
  return out;
}

function normalizeGmMoves(gmMoves=[]){
  return (Array.isArray(gmMoves)?gmMoves:[]).map((m,index)=>({
    key:m.key || `gm:${m.id||index}`,
    id:m.id || null,
    name:m.name || m.id || 'GM Move',
    level:null,
    numericLevel:null,
    typeHint:m.type || m.typeHint || null,
    isEvolution:false,
    eligible:true,
    eligibilityReason:'GM Override',
    sourceKind:'gm_override',
    sourceSpeciesId:null,
    sourceSpeciesName:null
  }));
}

function moveIdentity(move={}){
  const raw=String(move.id||move.name||move.key||'move').trim().toLowerCase();
  return raw.replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'move';
}

function sourcePriority(kind){
  return kind==='current_species'?30:kind==='pre_evolution'?20:kind==='gm_override'?10:0;
}

function mergeMovePool(moves=[]){
  const byIdentity=new Map();
  for(const move of moves){
    const identity=moveIdentity(move);
    const source={
      sourceKind:move.sourceKind||'current_species',
      sourceSpeciesId:move.sourceSpeciesId||null,
      sourceSpeciesName:move.sourceSpeciesName||null,
      originalKey:move.key,
      level:move.level??null,
      numericLevel:move.numericLevel??null,
      isEvolution:!!move.isEvolution,
      eligibilityReason:move.eligibilityReason||null
    };
    const existing=byIdentity.get(identity);
    if(!existing){
      byIdentity.set(identity,{...move,key:identity,sources:[source]});
      continue;
    }
    if(!existing.sources.some(s=>s.originalKey===source.originalKey)) existing.sources.push(source);
    if(sourcePriority(source.sourceKind)>sourcePriority(existing.sourceKind)){
      const sources=existing.sources;
      byIdentity.set(identity,{...move,key:identity,sources});
    }
  }
  return [...byIdentity.values()].map(move=>{
    const sources=[...(move.sources||[])].sort((a,b)=>sourcePriority(b.sourceKind)-sourcePriority(a.sourceKind));
    const primary=sources[0]||{};
    return {
      ...move,
      key:moveIdentity(move),
      sources,
      sourceKind:primary.sourceKind||move.sourceKind||'current_species',
      sourceSpeciesId:primary.sourceSpeciesId??move.sourceSpeciesId??null,
      sourceSpeciesName:primary.sourceSpeciesName??move.sourceSpeciesName??null,
      eligibilityReason:primary.eligibilityReason||move.eligibilityReason||null,
      level:primary.level??move.level??null,
      numericLevel:primary.numericLevel??move.numericLevel??null,
      isEvolution:primary.isEvolution??move.isEvolution??false
    };
  });
}

function canonicalizeSelectedMoveKey(key, rawMoves=[], mergedMoves=[]){
  const text=String(key||'').trim();
  if(!text) return null;
  if(mergedMoves.some(m=>m.key===text)) return text;
  const exactRaw=rawMoves.find(m=>m.key===text);
  if(exactRaw) return moveIdentity(exactRaw);
  const pre=text.match(/^pre:[^:]+:([^:]+):\d+$/);
  if(pre && mergedMoves.some(m=>m.key===pre[1])) return pre[1];
  const gm=text.match(/^gm:(.+)$/);
  if(gm){
    const candidate=gm[1].replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();
    if(mergedMoves.some(m=>m.key===candidate)) return candidate;
  }
  const normalized=text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if(mergedMoves.some(m=>m.key===normalized)) return normalized;
  return text;
}

export function defaultMoveSelection(eligibleMoves, moveLimit=6){
  // Automatic defaults intentionally use only current-species numeric Level-Up Moves.
  // Pre-evolution and GM sources are offered as explicit historical/override choices.
  const numeric=eligibleMoves.map(move=>{
      const current=(move.sources||[]).find(s=>s.sourceKind==='current_species' && !s.isEvolution && s.numericLevel!=null);
      return current?{move,current}:null;
    }).filter(Boolean)
    .sort((a,b)=>a.current.numericLevel-b.current.numericLevel);
  return numeric.slice(-Math.max(0,int(moveLimit,6))).map(({move})=>move.key);
}

export function evolutionCreationNotice(speciesName, incomingEvolution){
  if(!incomingEvolution) return null;
  return {
    from:incomingEvolution.from_species_name,
    minimumLevel:incomingEvolution.to_min_level ?? null,
    conditionText:incomingEvolution.condition_text || null,
    message:incomingEvolution.to_min_level!=null
      ? `${speciesName} normally evolves from ${incomingEvolution.from_species_name} at minimum Level ${incomingEvolution.to_min_level}. Direct creation below that Level is allowed.`
      : `${speciesName} is an evolved form of ${incomingEvolution.from_species_name}. Direct creation is allowed.`
  };
}

export function buildPokemonPreview({species,level=1,nature='Hardy',allocations={},selectedAbilities=[],selectedMoves=[],incomingEvolution=null,preEvolutionSpecies=[],gmMoves=[],moveLimitModifier=0,gmOverride=false,baseRelationExemptStats=[]}={}){
  if(!species) throw Object.assign(new Error('Species definition is required'),{status:400});
  level=Math.max(1,Math.min(100,int(level,1)));
  const base=normalizeBaseStats(species.baseStats||species.base_stats||{});
  if(STAT_KEYS.some(k=>!Number.isFinite(base[k]))) throw Object.assign(new Error('Species Base Stats are incomplete'),{status:400});
  const natureResult=applyNature(base,nature);
  const alloc=normalizeAllocations(allocations);
  const budget=level+10;
  const spent=STAT_KEYS.reduce((sum,k)=>sum+alloc[k],0);
  const finalStats=Object.fromEntries(STAT_KEYS.map(k=>[k,natureResult.stats[k]+alloc[k]]));
  const relationExemptStats=normalizeRelationExemptStats(baseRelationExemptStats);
  const relationViolations=validateBaseRelations(natureResult.stats,finalStats,{exemptStats:relationExemptStats});
  const maxHp=level+(finalStats.hp*3)+10;

  const nativeAbilities=eligibleAbilities(species.abilities||species.ability_slots||[]);
  const abilitySlots=levelAbilitySlots(level).map(slot=>({
    ...slot,
    options:nativeAbilities.filter(a=>slot.allowedCategories.includes(a.category))
  }));
  const selectedAbilityNames=(Array.isArray(selectedAbilities)?selectedAbilities:[]).map(String).filter(Boolean);
  const abilityErrors=[];
  if(selectedAbilityNames.length>abilitySlots.length) abilityErrors.push(`Level ${level} grants ${abilitySlots.length} Ability slot${abilitySlots.length===1?'':'s'} through normal progression.`);
  for(let i=0;i<abilitySlots.length;i++){
    const selection=selectedAbilityNames[i];
    if(!selection){ abilityErrors.push(`Choose ${abilitySlots[i].label}.`); continue; }
    if(!abilitySlots[i].options.some(a=>a.name===selection)) abilityErrors.push(`${selection} is not valid for ${abilitySlots[i].label}.`);
  }

  const moveLimit={base:6,modifier:int(moveLimitModifier),effective:Math.max(0,6+int(moveLimitModifier)),note:'Base PTU limit is 6; Features and Abilities may modify this value.'};
  const currentMoves=eligibleNaturalMoves(species.levelUpMoves||species.level_up_moves||[],level).map(m=>({...m,sourceKind:'current_species',sourceSpeciesId:species.id||null,sourceSpeciesName:species.name||species.display_name||null}));
  const ancestryMoves=preEvolutionNaturalMoves(preEvolutionSpecies);
  const overrideMoves=gmOverride?normalizeGmMoves(gmMoves):[];
  const rawMovePool=[...currentMoves,...ancestryMoves,...overrideMoves];
  const eligibleMoves=mergeMovePool(rawMovePool);
  const eligibleMoveKeys=new Set(eligibleMoves.map(m=>m.key));
  const selectedMoveKeys=[...new Set((Array.isArray(selectedMoves)?selectedMoves:[]).map(k=>canonicalizeSelectedMoveKey(k,rawMovePool,eligibleMoves)).filter(Boolean))];
  const moveErrors=[];
  if(selectedMoveKeys.length>moveLimit.effective) moveErrors.push(`Selected ${selectedMoveKeys.length} Moves; current Move Limit is ${moveLimit.effective}.`);
  for(const key of selectedMoveKeys){ if(!eligibleMoveKeys.has(key)) moveErrors.push(`Move ${key} is not available from the current Species, a pre-evolution, or an active GM Override.`); }
  if((gmMoves||[]).length && !gmOverride) moveErrors.push('GM-added Moves require GM Override to remain enabled.');

  const errors=[];
  if(spent!==budget) errors.push(`Allocate exactly ${budget} Stat Points (currently ${spent}; ${budget-spent} remaining).`);
  if(relationViolations.length && !gmOverride) errors.push(...relationViolations.map(v=>v.message));
  errors.push(...abilityErrors,...moveErrors);

  return {
    level,
    nature:natureResult.nature,
    baseStats:base,
    natureAdjustedBaseStats:natureResult.stats,
    statAllocations:alloc,
    statBudget:{total:budget,spent,remaining:budget-spent},
    finalStats,
    maxHp,
    baseRelations:{valid:relationViolations.length===0,violations:relationViolations,overridden:!!(gmOverride&&relationViolations.length),hpExempt:true,exemptStats:relationExemptStats},
    tutorPoints:{earned:tutorPointsAtLevel(level),spent:0,remaining:tutorPointsAtLevel(level)},
    abilitySlots,
    selectedAbilities:selectedAbilityNames,
    moveLimit,
    eligibleMoves,
    preEvolutionSpecies:(preEvolutionSpecies||[]).map(a=>({id:a.id,name:a.name,evolutionEdge:a.evolutionEdge||null})),
    gmMoves:overrideMoves,
    defaultMoves:defaultMoveSelection(eligibleMoves,moveLimit.effective),
    selectedMoves:selectedMoveKeys,
    evolutionNotice:evolutionCreationNotice(species.name||species.display_name||'Pokémon',incomingEvolution),
    valid:errors.length===0 || (!!gmOverride && errors.every(e=>relationViolations.some(v=>v.message===e))),
    errors
  };
}

export function autoBalancedAllocations({baseStats,nature='Hardy',level=1}={}){
  level=Math.max(1,Math.min(100,int(level,1)));
  const adjusted=applyNature(baseStats,nature).stats;
  const budget=level+10;
  const alloc=Object.fromEntries(STAT_KEYS.map(k=>[k,Math.floor(budget/STAT_KEYS.length)]));
  let remainder=budget-STAT_KEYS.reduce((s,k)=>s+alloc[k],0);
  const order=[...STAT_KEYS].sort((a,b)=>adjusted[b]-adjusted[a] || STAT_KEYS.indexOf(a)-STAT_KEYS.indexOf(b));
  let idx=0;
  while(remainder>0){ alloc[order[idx%order.length]]++; remainder--; idx++; }
  // Equal distribution plus bonuses to the highest adjusted bases preserves all strict base relations.
  return alloc;
}

/* --------------------------------------------------------------------------
 * v0.8 — Persistent Pokémon progression / evolution preview helpers
 * -------------------------------------------------------------------------- */

export function experienceLevelForTotal(experienceTable=[], totalExperience=0){
  totalExperience=Math.max(0,int(totalExperience,0));
  const rows=[...(Array.isArray(experienceTable)?experienceTable:[])].sort((a,b)=>Number(a.level)-Number(b.level));
  let winner=rows[0]||{level:1,cumulative_exp:0};
  for(const row of rows){ if(Number(row.cumulative_exp)<=totalExperience) winner=row; else break; }
  return winner;
}

export function progressionRowsBetween(experienceTable=[], fromLevel=1, toLevel=1){
  fromLevel=Math.max(1,int(fromLevel,1)); toLevel=Math.max(fromLevel,int(toLevel,fromLevel));
  return (Array.isArray(experienceTable)?experienceTable:[]).filter(r=>Number(r.level)>fromLevel && Number(r.level)<=toLevel).sort((a,b)=>Number(a.level)-Number(b.level));
}

function slugMove(value){ return String(value||'move').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'move'; }

function normalizeExistingMoveRecord(move,index=0){
  const key=slugMove(move?.id||move?.name||move?.key||`move-${index}`);
  return {
    key,id:move?.id||null,name:move?.name||move?.id||key,level:move?.learnedAt??move?.level??null,
    numericLevel:numericMoveLevel(move?.learnedAt??move?.level),isEvolution:!!move?.isEvolution,typeHint:move?.typeHint||null,
    eligible:true,eligibilityReason:'Already known',sourceKind:move?.source||'existing',sourceSpeciesId:move?.sourceSpeciesId||null,
    sourceSpeciesName:move?.sourceSpeciesName||null,sources:Array.isArray(move?.availableSources)?move.availableSources:[],existing:true
  };
}

function newlyUnlockedMoves(species, fromLevel, toLevel){
  return (Array.isArray(species?.levelUpMoves)?species.levelUpMoves:[]).map((m,index)=>{
    const numeric=numericMoveLevel(m.level); const isEvolution=/^evo/i.test(String(m.level||''));
    return {key:slugMove(m.move_id||m.move),id:m.move_id||null,name:m.move||m.move_id||'Unknown Move',level:m.level,numericLevel:numeric,
      isEvolution,typeHint:m.type_hint||null,eligible:!isEvolution&&numeric!=null&&numeric>fromLevel&&numeric<=toLevel,
      eligibilityReason:numeric!=null?`Unlocked at Level ${numeric}`:'',sourceKind:'level_up',sourceSpeciesId:species?.id||null,sourceSpeciesName:species?.name||null};
  }).filter(m=>m.eligible);
}

function evolutionMoveOptions({fromSpecies,toSpecies,targetLevel,evolutionMinLevel}){
  const previousNames=new Set((Array.isArray(fromSpecies?.levelUpMoves)?fromSpecies.levelUpMoves:[]).map(m=>slugMove(m.move_id||m.move)));
  const threshold=evolutionMinLevel==null?targetLevel:Number(evolutionMinLevel);
  const out=[];
  for(const m of (Array.isArray(toSpecies?.levelUpMoves)?toSpecies.levelUpMoves:[])){
    const numeric=numericMoveLevel(m.level); const isEvolution=/^evo/i.test(String(m.level||'')); const key=slugMove(m.move_id||m.move);
    const belowMinimum=numeric!=null && numeric<threshold && !previousNames.has(key);
    const atLevel=numeric!=null && numeric===targetLevel;
    if(!(isEvolution||belowMinimum||atLevel)) continue;
    out.push({key,id:m.move_id||null,name:m.move||m.move_id||'Unknown Move',level:m.level,numericLevel:numeric,isEvolution,typeHint:m.type_hint||null,eligible:true,
      eligibilityReason:isEvolution?'Evolution Move':belowMinimum?`Evolution catch-up · below Lv ${threshold}`:`Level ${numeric}`,
      sourceKind:'evolution',sourceSpeciesId:toSpecies?.id||null,sourceSpeciesName:toSpecies?.name||null,evolution:true});
  }
  return out;
}

function mergeProgressionMovePool(existing=[], additions=[]){
  const map=new Map();
  for(const m of [...existing,...additions]){
    const key=slugMove(m.id||m.name||m.key); const old=map.get(key);
    if(!old) map.set(key,{...m,key,availableSources:[...(m.availableSources||m.sources||[])]});
    else {
      const sources=[...(old.availableSources||[]),...(m.availableSources||m.sources||[]),{sourceKind:m.sourceKind,sourceSpeciesId:m.sourceSpeciesId||null,sourceSpeciesName:m.sourceSpeciesName||null,level:m.level??null}];
      map.set(key,{...old,availableSources:sources,existing:old.existing||m.existing});
    }
  }
  return [...map.values()];
}

function chooseMappedEvolutionAbilities(fromSpecies,toSpecies,currentSelected=[],targetLevel=1){
  const fromNative=eligibleAbilities(fromSpecies?.abilities||[]); const toNative=eligibleAbilities(toSpecies?.abilities||[]);
  const slots=levelAbilitySlots(targetLevel); const selected=[];
  for(let i=0;i<slots.length;i++){
    const currentName=currentSelected[i];
    const current=fromNative.find(a=>a.name===currentName);
    let mapped=current?.sourceSlot?toNative.find(a=>a.sourceSlot===current.sourceSlot):null;
    if(!mapped && current?.sourceIndex!=null) mapped=toNative.find(a=>a.sourceIndex===current.sourceIndex && a.category===current.category);
    if(!mapped) mapped=toNative.find(a=>slots[i].allowedCategories.includes(a.category) && !selected.includes(a.name));
    selected.push(mapped?.name||'');
  }
  return selected;
}

export function buildPokemonProgressionPreview({
  pokemon,species,experienceTable=[],expGain=0,targetLevel=null,newStatAllocations={},selectedAbilities=null,selectedMoves=null,
  evolutionTarget=null,evolutionEdge=null,evolutionAllocations={},manualEvolutionCondition=false,gmOverride=false,baseRelationExemptStats=null
}={}){
  if(!pokemon||!species) throw Object.assign(new Error('Pokémon and current Species are required'),{status:400});
  const details=pokemon.details||{};
  const currentLevel=Math.max(1,Math.min(100,int(pokemon.level,1)));
  const currentLevelRow=(Array.isArray(experienceTable)?experienceTable:[]).find(r=>Number(r.level)===currentLevel);
  const currentExp=Math.max(0,int(details.experience,currentLevelRow?.cumulative_exp||0));
  const requestedTargetLevel=targetLevel==null || targetLevel==='' ? null : Math.max(1,Math.min(100,int(targetLevel,currentLevel)));
  let safeGain=Math.max(0,int(expGain,0));
  let totalExp=currentExp+safeGain;
  let progressionInputError=null;
  if(requestedTargetLevel!=null){
    if(requestedTargetLevel<currentLevel){
      progressionInputError=`Target Level cannot be lower than the current Level ${currentLevel}.`;
      safeGain=0; totalExp=currentExp;
    }else{
      const requestedRow=(Array.isArray(experienceTable)?experienceTable:[]).find(r=>Number(r.level)===requestedTargetLevel);
      if(!requestedRow){
        progressionInputError=`Target Level ${requestedTargetLevel} is not present in the PTU Experience table.`;
        safeGain=0; totalExp=currentExp;
      }else{
        totalExp=Math.max(currentExp,Number(requestedRow.cumulative_exp)||0);
        safeGain=Math.max(0,totalExp-currentExp);
      }
    }
  }
  const levelRow=experienceLevelForTotal(experienceTable,totalExp); const resolvedTargetLevel=Math.max(currentLevel,Math.min(100,int(levelRow.level,currentLevel)));
  const levelsGained=resolvedTargetLevel-currentLevel; const crossed=progressionRowsBetween(experienceTable,currentLevel,resolvedTargetLevel);
  const statPointsGained=crossed.reduce((sum,r)=>sum+int(r.stat_points_awarded,1),0);
  const tutorPointsGained=crossed.filter(r=>!!r.tutor_point_awarded).length;
  const abilityUnlockLevels=crossed.filter(r=>!!r.ability_unlock).map(r=>Number(r.level));

  const nature=details.nature||'Hardy';
  const targetSpecies=evolutionTarget||species;
  const evolved=!!evolutionTarget && String(evolutionTarget.id)!==String(species.id);
  const base=normalizeBaseStats(targetSpecies.baseStats||{}); const natureAdjusted=applyNature(base,nature).stats;
  const oldAlloc=normalizeAllocations(details.statAllocations||{}); const delta=normalizeAllocations(newStatAllocations||{});
  const evoAlloc=normalizeAllocations(evolutionAllocations||{});
  const allocation=evolved?evoAlloc:Object.fromEntries(STAT_KEYS.map(k=>[k,oldAlloc[k]+delta[k]]));
  const requiredAllocation=evolved?resolvedTargetLevel+10:(STAT_KEYS.reduce((s,k)=>s+oldAlloc[k],0)+statPointsGained);
  const spentAllocation=STAT_KEYS.reduce((s,k)=>s+allocation[k],0);
  const deltaSpent=STAT_KEYS.reduce((s,k)=>s+delta[k],0);
  const finalStats=Object.fromEntries(STAT_KEYS.map(k=>[k,natureAdjusted[k]+allocation[k]]));
  const relationExemptStats=normalizeRelationExemptStats(baseRelationExemptStats??relationExemptionsFromPokeEdges(details.pokeEdges||[]));
  const relationViolations=validateBaseRelations(natureAdjusted,finalStats,{exemptStats:relationExemptStats});
  const maxHp=resolvedTargetLevel+(finalStats.hp*3)+10;

  const nativeAbilities=eligibleAbilities(targetSpecies.abilities||[]); const abilitySlots=levelAbilitySlots(resolvedTargetLevel).map(slot=>({...slot,options:nativeAbilities.filter(a=>slot.allowedCategories.includes(a.category))}));
  let chosenAbilities=Array.isArray(selectedAbilities)?selectedAbilities.filter(Boolean):null;
  if(!chosenAbilities) chosenAbilities=evolved?chooseMappedEvolutionAbilities(species,targetSpecies,details.abilities||[],resolvedTargetLevel):[...(details.abilities||[])];
  while(chosenAbilities.length<abilitySlots.length) chosenAbilities.push('');
  chosenAbilities=chosenAbilities.slice(0,abilitySlots.length);
  const abilityErrors=[];
  for(let i=0;i<abilitySlots.length;i++){
    const name=chosenAbilities[i]; if(!name){ abilityErrors.push(`Choose ${abilitySlots[i].label}.`); continue; }
    if(!abilitySlots[i].options.some(a=>a.name===name)) abilityErrors.push(`${name} is not valid for ${abilitySlots[i].label} on ${targetSpecies.name}.`);
  }

  const existingMoves=(details.moves||[]).map(normalizeExistingMoveRecord);
  const unlocked=newlyUnlockedMoves(species,currentLevel,resolvedTargetLevel);
  const evoMoves=evolved?evolutionMoveOptions({fromSpecies:species,toSpecies:targetSpecies,targetLevel:resolvedTargetLevel,evolutionMinLevel:evolutionEdge?.toMinLevel??null}):[];
  const movePool=mergeProgressionMovePool(existingMoves,[...unlocked,...evoMoves]);
  const moveLimit=Math.max(0,int(details.moveLimitEffective,6));
  const chosenMoveKeys=Array.isArray(selectedMoves)?[...new Set(selectedMoves.map(slugMove))]:existingMoves.map(m=>m.key);
  const moveKeys=new Set(movePool.map(m=>m.key)); const moveErrors=[];
  if(chosenMoveKeys.length>moveLimit) moveErrors.push(`Selected ${chosenMoveKeys.length} Moves; current Move Limit is ${moveLimit}.`);
  for(const key of chosenMoveKeys) if(!moveKeys.has(key)) moveErrors.push(`Move ${key} is not available in the progression Move pool.`);

  const errors=[];
  if(progressionInputError) errors.push(progressionInputError);
  if(evolved && evolutionEdge?.toMinLevel!=null && resolvedTargetLevel<Number(evolutionEdge.toMinLevel) && !gmOverride) errors.push(`${targetSpecies.name} normally requires minimum Level ${evolutionEdge.toMinLevel} to evolve.`);
  const evoCondition=String(evolutionEdge?.conditionText||'').trim();
  const hasExtraEvolutionCondition=evolved && !!evoCondition && !/^minimum\s+\d+$/i.test(evoCondition);
  if(hasExtraEvolutionCondition && !manualEvolutionCondition && !gmOverride) errors.push(`Confirm the evolution condition is met: ${evoCondition}.`);
  if(!evolved && deltaSpent!==statPointsGained) errors.push(`Allocate exactly ${statPointsGained} new Stat Point${statPointsGained===1?'':'s'} (currently ${deltaSpent}).`);
  if(evolved && spentAllocation!==requiredAllocation) errors.push(`Evolution requires a full re-Stat using exactly ${requiredAllocation} Stat Points (currently ${spentAllocation}).`);
  if(relationViolations.length&&!gmOverride) errors.push(...relationViolations.map(v=>v.message));
  errors.push(...abilityErrors,...moveErrors);

  const previousTutorEarned=int(details.tutorPointsEarned,tutorPointsAtLevel(currentLevel)); const previousTutorSpent=int(details.tutorPointsSpent,0);
  const tutorEarned=Math.max(previousTutorEarned,tutorPointsAtLevel(resolvedTargetLevel)); const tutorRemaining=Math.max(0,tutorEarned-previousTutorSpent);

  const nextRow=resolvedTargetLevel<100?((experienceTable||[]).find(r=>Number(r.level)===resolvedTargetLevel+1)||null):null;
  return {
    currentLevel,targetLevel:resolvedTargetLevel,requestedTargetLevel,progressionMode:requestedTargetLevel!=null?'target_level':'experience',levelsGained,currentExperience:currentExp,experienceGain:safeGain,totalExperience:totalExp,
    currentLevelFloor:(experienceTable||[]).find(r=>Number(r.level)===currentLevel)?.cumulative_exp??null,
    targetLevelFloor:levelRow?.cumulative_exp??null,nextLevelExperience:nextRow?.cumulative_exp??null,
    crossedLevels:crossed.map(r=>({level:Number(r.level),statPoint:!!r.stat_points_awarded,tutorPoint:!!r.tutor_point_awarded,abilityUnlock:!!r.ability_unlock,checkMovesAndEvolution:!!r.check_moves_and_evolution})),
    rewards:{statPoints:statPointsGained,tutorPoints:tutorPointsGained,abilityUnlockLevels},
    evolved,evolutionEdge:evolutionEdge||null,manualEvolutionCondition:!!manualEvolutionCondition,targetSpecies:{id:targetSpecies.id,name:targetSpecies.name,types:targetSpecies.types||[],versionId:targetSpecies.versionId||null,contentPackId:targetSpecies.contentPackId||null,sourceId:targetSpecies.sourceId||null},
    nature,baseStats:base,natureAdjustedBaseStats:natureAdjusted,previousStatAllocations:oldAlloc,newStatAllocations:delta,statAllocations:allocation,
    statBudget:{required:requiredAllocation,spent:spentAllocation,newPointsRequired:statPointsGained,newPointsSpent:deltaSpent},finalStats,maxHp,
    baseRelations:{valid:relationViolations.length===0,violations:relationViolations,overridden:!!(gmOverride&&relationViolations.length),hpExempt:true,exemptStats:relationExemptStats},
    abilitySlots,selectedAbilities:chosenAbilities,
    moveLimit:{effective:moveLimit},movePool,existingMoveKeys:existingMoves.map(m=>m.key),newMoveKeys:[...unlocked,...evoMoves].map(m=>slugMove(m.id||m.name||m.key)),selectedMoves:chosenMoveKeys,
    tutorPoints:{earned:tutorEarned,spent:previousTutorSpent,remaining:tutorRemaining,gained:tutorPointsGained},
    suggestedEvolutionAllocations:evolved?autoBalancedAllocations({baseStats:targetSpecies.baseStats,nature,level:resolvedTargetLevel}):null,
    valid:errors.length===0 || (!!gmOverride && errors.every(e=>relationViolations.some(v=>v.message===e) || /minimum Level|Confirm the evolution condition/.test(e))),errors
  };
}

/* --------------------------------------------------------------------------
 * v1.0 — Advanced permanent training: Tutor Points, Poké Edges and Move teaching
 * -------------------------------------------------------------------------- */

export function parseTutorPointCost(costText=''){
  const match=String(costText||'').match(/(\d+)\s+Tutor\s+Point/i);
  return match?Math.max(0,int(match[1],0)):0;
}

function normalizedCapabilityNames(capabilities=[]){
  return new Set((Array.isArray(capabilities)?capabilities:[]).map(c=>String(c?.name||c?.capability_id||c||'').trim().toLowerCase()).filter(Boolean));
}

function normalizedAbilityNames(abilities=[]){
  return new Set((Array.isArray(abilities)?abilities:[]).map(a=>String(a?.name||a||'').trim().toLowerCase()).filter(Boolean));
}

export function evaluatePrerequisiteAst(ast,{level=1,capabilities=[],abilities=[],abilityKeywordLookup=null}={}){
  if(!ast) return {status:'manual',valid:null,reasons:['Prerequisite could not be compiled.']};
  if(ast.op==='all'){
    const children=(ast.children||[]).map(c=>evaluatePrerequisiteAst(c,{level,capabilities,abilities,abilityKeywordLookup}));
    if(children.some(c=>c.valid===false)) return {status:'blocked',valid:false,reasons:children.flatMap(c=>c.reasons||[])};
    if(children.some(c=>c.valid==null)) return {status:'manual',valid:null,reasons:children.flatMap(c=>c.reasons||[])};
    return {status:'eligible',valid:true,reasons:children.flatMap(c=>c.reasons||[])};
  }
  if(ast.op==='any'){
    const children=(ast.children||[]).map(c=>evaluatePrerequisiteAst(c,{level,capabilities,abilities,abilityKeywordLookup}));
    if(children.some(c=>c.valid===true)) return {status:'eligible',valid:true,reasons:children.flatMap(c=>c.reasons||[])};
    if(children.some(c=>c.valid==null)) return {status:'manual',valid:null,reasons:children.flatMap(c=>c.reasons||[])};
    return {status:'blocked',valid:false,reasons:children.flatMap(c=>c.reasons||[])};
  }
  if(ast.op!=='leaf') return {status:'manual',valid:null,reasons:[ast.raw||'Unknown prerequisite.']};
  const kind=ast.kind;
  if(kind==='none') return {status:'eligible',valid:true,reasons:[]};
  if(kind==='level_min'){
    const needed=int(ast.value,0); const ok=int(level,1)>=needed;
    return {status:ok?'eligible':'blocked',valid:ok,reasons:ok?[]:[`Requires Level ${needed}.`]};
  }
  if(kind==='has_capability'){
    const names=normalizedCapabilityNames(capabilities); const wanted=String(ast.name||ast.value||ast.capability||ast.raw||'').replace(/\s+Capability$/i,'').trim().toLowerCase();
    const ok=[...names].some(n=>n===wanted || n.includes(wanted) || wanted.includes(n));
    return {status:ok?'eligible':'blocked',valid:ok,reasons:ok?[]:[`Requires ${ast.name||ast.value||wanted} Capability.`]};
  }
  if(kind==='has_ability_keyword'){
    const keyword=String(ast.keyword||ast.value||'Connection').toLowerCase();
    if(typeof abilityKeywordLookup==='function'){
      const matching=[...normalizedAbilityNames(abilities)].some(name=>abilityKeywordLookup(name,keyword));
      return {status:matching?'eligible':'blocked',valid:matching,reasons:matching?[]:[`Requires an Ability with the ${keyword} keyword.`]};
    }
    return {status:'manual',valid:null,reasons:[`Confirm an Ability with the ${keyword} keyword.`]};
  }
  return {status:'manual',valid:null,reasons:[ast.raw||'Manual prerequisite confirmation required.']};
}

export function isUnderdogPokemon(capabilities=[]){
  return normalizedCapabilityNames(capabilities).has('underdog');
}

export function pokeEdgeRequiresUnderdog(edge={}){
  const id=String(edge?.id||'').toLowerCase();
  const text=`${edge?.name||''} ${edge?.prerequisites||edge?.prerequisites_text||edge?.raw?.prerequisites_text||''}`.toLowerCase();
  return id==='underdogs-strength' || id==='realized-potential' || id==='underdogs-lessons' || /underdog pok[eé]mon/.test(text) || /underdog'?s strength/.test(text);
}

export function evaluatePokeEdgePrerequisite(edge,{level=1,capabilities=[],abilities=[],abilityKeywordLookup=null,rank=1,ownedPokeEdges=[],statAllocations={}}={}){
  const edgeId=String(edge?.id||'').toLowerCase();
  if(edgeId==='mixed-power'){
    const atk=Math.max(0,int(statAllocations?.attack));
    const spa=Math.max(0,int(statAllocations?.special_attack ?? statAllocations?.spAttack));
    const reasons=[];
    if(int(level,1)<10) reasons.push('Requires Level 10.');
    if(atk<5) reasons.push('Requires at least 5 Level-Up Stat Points invested in Attack.');
    if(spa<5) reasons.push('Requires at least 5 Level-Up Stat Points invested in Special Attack.');
    return {status:reasons.length?'blocked':'eligible',valid:reasons.length===0,reasons,details:{attackInvested:atk,specialAttackInvested:spa}};
  }
  if(pokeEdgeRequiresUnderdog(edge) && !isUnderdogPokemon(capabilities)){
    return {status:'blocked',valid:false,reasons:['Requires the Underdog Capability.']};
  }
  // The Core's three Underdog-specific Poké Edges have machine-clear prerequisites.
  // Resolve them explicitly instead of leaving the phrase "User is an Underdog Pokémon" as a manual check.
  if(edgeId==='underdogs-strength'){
    const ok=int(level,1)>=15; return {status:ok?'eligible':'blocked',valid:ok,reasons:ok?[]:['Requires Level 15.']};
  }
  if(edgeId==='realized-potential'){
    const ok=int(level,1)>=30; return {status:ok?'eligible':'blocked',valid:ok,reasons:ok?[]:['Requires Level 30.']};
  }
  if(edgeId==='underdogs-lessons'){
    const hasStrength=(Array.isArray(ownedPokeEdges)?ownedPokeEdges:[]).some(e=>String(e?.id||'').toLowerCase()==='underdogs-strength');
    if(!hasStrength) return {status:'blocked',valid:false,reasons:["Requires Underdog's Strength."]};
    return {status:'eligible',valid:true,reasons:[]};
  }
  const sem=edge?.prerequisiteSemantics||edge?.raw?.prerequisite_semantics||null;
  if(!sem) return {status:'manual',valid:null,reasons:[edge?.prerequisites||edge?.prerequisites_text||'Manual prerequisite confirmation required.']};
  if(Array.isArray(sem.rank_asts)&&sem.rank_asts.length){
    const ranked=sem.rank_asts.find(r=>Number(r.rank)===Number(rank))||sem.rank_asts[Math.max(0,Math.min(sem.rank_asts.length-1,Number(rank)-1))];
    return evaluatePrerequisiteAst(ranked?.ast,{level,capabilities,abilities,abilityKeywordLookup});
  }
  return evaluatePrerequisiteAst(sem.ast,{level,capabilities,abilities,abilityKeywordLookup});
}

export function moveTrainingPoolUsage(moves=[]){
  const specialSources=new Set(['tm','hm','tutor','egg_tutor','archive_tutor']);
  return (Array.isArray(moves)?moves:[]).filter(m=>specialSources.has(String(m?.source||'').toLowerCase()) && !m?.countsAsNatural).length;
}

export function isNaturalTutorMove(species, moveName){
  const text=String(species?.raw?.tutor_moves_text||species?.tutorMovesText||species?.raw?.raw_text||'');
  const escaped=String(moveName||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return !!escaped && new RegExp(`(?:^|[,\\n]\\s*)${escaped}\\s*\\(N\\)`,`i`).test(text);
}

export function tutorRestrictionForMove({level=1,move=null,september2015Enabled=false}={}){
  if(!september2015Enabled) return {applies:false,valid:true,message:null};
  level=Math.max(1,int(level,1));
  const frequency=String(move?.frequency||move?.frequency_text||'').toLowerCase();
  const damageBase=move?.damageBase==null?null:Number(move.damageBase);
  if(level<20){
    const freqOk=/at[- ]?will|eot|every other turn/.test(frequency);
    const dbOk=damageBase==null || damageBase<=7;
    return {applies:true,valid:freqOk&&dbOk,message:'September 2015 tutoring: under Level 20, only At-Will/EOT Moves with maximum DB 7 may be taught.'};
  }
  if(level<30){
    const freqOk=!/daily/.test(frequency);
    const dbOk=damageBase==null || damageBase<=9;
    return {applies:true,valid:freqOk&&dbOk,message:'September 2015 tutoring: Levels 20–29 may learn up to Scene-frequency Moves with maximum DB 9.'};
  }
  return {applies:true,valid:true,message:'September 2015 tutoring: Level 30+ has no additional tutor restriction.'};
}


/* --------------------------------------------------------------------------
 * v1.1 — full Stat redistribution / correction helper
 * -------------------------------------------------------------------------- */
export function buildPokemonRestatPreview({pokemon,species,allocations={},gmOverride=false,baseRelationExemptStats=null}={}){
  if(!pokemon||!species) throw Object.assign(new Error('Pokémon and Species are required'),{status:400});
  const details=pokemon.details||{};
  const level=Math.max(1,Math.min(100,int(pokemon.level,1)));
  const nature=details.nature||'Hardy';
  const base=normalizeBaseStats(species.baseStats||species.base_stats||details.baseStats||{});
  const adjusted=applyNature(base,nature).stats;
  const alloc=normalizeAllocations(allocations);
  const currentAllocation=normalizeAllocations(details.statAllocations||{});
  const recordedBudget=STAT_KEYS.reduce((s,k)=>s+currentAllocation[k],0);
  const budget=recordedBudget>0?recordedBudget:(level+10);
  const spent=STAT_KEYS.reduce((s,k)=>s+alloc[k],0);
  const finalStats=Object.fromEntries(STAT_KEYS.map(k=>[k,adjusted[k]+alloc[k]]));
  const relationExemptStats=normalizeRelationExemptStats(baseRelationExemptStats??relationExemptionsFromPokeEdges(details.pokeEdges||[]));
  const violations=validateBaseRelations(adjusted,finalStats,{exemptStats:relationExemptStats});
  const maxHp=level+(finalStats.hp*3)+10;
  const errors=[];
  if(spent!==budget) errors.push(`Allocate exactly ${budget} Stat Points (currently ${spent}; ${budget-spent} remaining).`);
  if(violations.length&&!gmOverride) errors.push(...violations.map(v=>v.message));
  return {level,nature,baseStats:base,natureAdjustedBaseStats:adjusted,statAllocations:alloc,statBudget:{total:budget,spent,remaining:budget-spent},finalStats,maxHp,
    baseRelations:{valid:violations.length===0,violations,overridden:!!(gmOverride&&violations.length),hpExempt:true,exemptStats:relationExemptStats},
    valid:errors.length===0 || (!!gmOverride && errors.every(e=>violations.some(v=>v.message===e))),errors};
}
