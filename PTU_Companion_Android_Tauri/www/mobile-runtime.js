/* PTU Companion Android classic runtime bundle. Generated; no ES-module/file:// dependency. */
(function(){
'use strict';
const __ptu_pokemon_engine = (()=>{

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

const STAT_KEYS = ['hp','attack','defense','special_attack','special_defense','speed'];
const STAT_LABELS = {
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

const NATURES = NATURE_ROWS.map(([name,raise,lower],i)=>({value:i+1,name,raise,lower,neutral:raise===lower}));
const NATURE_BY_NAME = new Map(NATURES.map(n=>[n.name.toLowerCase(),n]));

const int = (v, fallback=0) => Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback;

function normalizeBaseStats(baseStats={}){
  return {
    hp:int(baseStats.hp), attack:int(baseStats.attack), defense:int(baseStats.defense),
    special_attack:int(baseStats.special_attack ?? baseStats.spAttack),
    special_defense:int(baseStats.special_defense ?? baseStats.spDefense), speed:int(baseStats.speed)
  };
}

function normalizeAllocations(allocations={}){
  return Object.fromEntries(STAT_KEYS.map(k=>[k,Math.max(0,int(allocations[k]))]));
}

function applyNature(baseStats, natureName){
  const base=normalizeBaseStats(baseStats);
  const nature=NATURE_BY_NAME.get(String(natureName||'').trim().toLowerCase()) || NATURE_BY_NAME.get('hardy');
  const out={...base};
  if(!nature.neutral){
    out[nature.raise]=Math.max(1,out[nature.raise]+(nature.raise==='hp'?1:2));
    out[nature.lower]=Math.max(1,out[nature.lower]-(nature.lower==='hp'?1:2));
  }
  return {nature,stats:out};
}

const HP_IGNORES_BASE_RELATIONS = true;

function normalizeRelationExemptStats(exemptStats=[]){
  const out=new Set(['hp']); // Campaign rule: HP is always exempt.
  for(const raw of (Array.isArray(exemptStats)?exemptStats:[])){
    const key=String(raw||'').trim().toLowerCase().replace(/\s+/g,'_');
    if(key==='sp_attack'||key==='sp.atk'||key==='spatk'||key==='specialattack') out.add('special_attack');
    else if(STAT_KEYS.includes(key)) out.add(key);
  }
  return [...out];
}

function relationExemptionsFromPokeEdges(pokeEdges=[]){
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

function getBaseRelationPairs(natureAdjustedBase,{exemptStats=[]}={}){
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

function validateBaseRelations(natureAdjustedBase, finalStats,{exemptStats=[]}={}){
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

function tutorPointsAtLevel(level){
  level=Math.max(1,Math.min(100,int(level,1)));
  return 1+Math.floor(level/5);
}

function levelAbilitySlots(level){
  level=Math.max(1,Math.min(100,int(level,1)));
  const slots=[{index:1,label:'Starting Ability',allowedCategories:['basic'],unlockLevel:1}];
  if(level>=20) slots.push({index:2,label:'Level 20 Ability',allowedCategories:['basic','advanced'],unlockLevel:20});
  if(level>=40) slots.push({index:3,label:'Level 40 Ability',allowedCategories:['basic','advanced','high'],unlockLevel:40});
  return slots;
}

function eligibleAbilities(abilitySlots=[]){
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

function eligibleNaturalMoves(levelUpMoves=[], level){
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

function preEvolutionNaturalMoves(preEvolutionSpecies=[]){
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

function defaultMoveSelection(eligibleMoves, moveLimit=6){
  // Automatic defaults intentionally use only current-species numeric Level-Up Moves.
  // Pre-evolution and GM sources are offered as explicit historical/override choices.
  const numeric=eligibleMoves.map(move=>{
      const current=(move.sources||[]).find(s=>s.sourceKind==='current_species' && !s.isEvolution && s.numericLevel!=null);
      return current?{move,current}:null;
    }).filter(Boolean)
    .sort((a,b)=>a.current.numericLevel-b.current.numericLevel);
  return numeric.slice(-Math.max(0,int(moveLimit,6))).map(({move})=>move.key);
}

function evolutionCreationNotice(speciesName, incomingEvolution){
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

function buildPokemonPreview({species,level=1,nature='Hardy',allocations={},selectedAbilities=[],selectedMoves=[],incomingEvolution=null,preEvolutionSpecies=[],gmMoves=[],moveLimitModifier=0,gmOverride=false,baseRelationExemptStats=[]}={}){
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

function autoBalancedAllocations({baseStats,nature='Hardy',level=1}={}){
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

function experienceLevelForTotal(experienceTable=[], totalExperience=0){
  totalExperience=Math.max(0,int(totalExperience,0));
  const rows=[...(Array.isArray(experienceTable)?experienceTable:[])].sort((a,b)=>Number(a.level)-Number(b.level));
  let winner=rows[0]||{level:1,cumulative_exp:0};
  for(const row of rows){ if(Number(row.cumulative_exp)<=totalExperience) winner=row; else break; }
  return winner;
}

function progressionRowsBetween(experienceTable=[], fromLevel=1, toLevel=1){
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

function buildPokemonProgressionPreview({
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

function parseTutorPointCost(costText=''){
  const match=String(costText||'').match(/(\d+)\s+Tutor\s+Point/i);
  return match?Math.max(0,int(match[1],0)):0;
}

function normalizedCapabilityNames(capabilities=[]){
  return new Set((Array.isArray(capabilities)?capabilities:[]).map(c=>String(c?.name||c?.capability_id||c||'').trim().toLowerCase()).filter(Boolean));
}

function normalizedAbilityNames(abilities=[]){
  return new Set((Array.isArray(abilities)?abilities:[]).map(a=>String(a?.name||a||'').trim().toLowerCase()).filter(Boolean));
}

function evaluatePrerequisiteAst(ast,{level=1,capabilities=[],abilities=[],abilityKeywordLookup=null}={}){
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

function isUnderdogPokemon(capabilities=[]){
  return normalizedCapabilityNames(capabilities).has('underdog');
}

function pokeEdgeRequiresUnderdog(edge={}){
  const id=String(edge?.id||'').toLowerCase();
  const text=`${edge?.name||''} ${edge?.prerequisites||edge?.prerequisites_text||edge?.raw?.prerequisites_text||''}`.toLowerCase();
  return id==='underdogs-strength' || id==='realized-potential' || id==='underdogs-lessons' || /underdog pok[eé]mon/.test(text) || /underdog'?s strength/.test(text);
}

function evaluatePokeEdgePrerequisite(edge,{level=1,capabilities=[],abilities=[],abilityKeywordLookup=null,rank=1,ownedPokeEdges=[],statAllocations={}}={}){
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

function moveTrainingPoolUsage(moves=[]){
  const specialSources=new Set(['tm','hm','tutor','egg_tutor','archive_tutor']);
  return (Array.isArray(moves)?moves:[]).filter(m=>specialSources.has(String(m?.source||'').toLowerCase()) && !m?.countsAsNatural).length;
}

function isNaturalTutorMove(species, moveName){
  const text=String(species?.raw?.tutor_moves_text||species?.tutorMovesText||species?.raw?.raw_text||'');
  const escaped=String(moveName||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return !!escaped && new RegExp(`(?:^|[,\\n]\\s*)${escaped}\\s*\\(N\\)`,`i`).test(text);
}

function tutorRestrictionForMove({level=1,move=null,september2015Enabled=false}={}){
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
function buildPokemonRestatPreview({pokemon,species,allocations={},gmOverride=false,baseRelationExemptStats=null}={}){
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

return {STAT_KEYS, STAT_LABELS, NATURES, NATURE_BY_NAME, normalizeBaseStats, normalizeAllocations, applyNature, HP_IGNORES_BASE_RELATIONS, normalizeRelationExemptStats, relationExemptionsFromPokeEdges, getBaseRelationPairs, validateBaseRelations, tutorPointsAtLevel, levelAbilitySlots, eligibleAbilities, eligibleNaturalMoves, preEvolutionNaturalMoves, defaultMoveSelection, evolutionCreationNotice, buildPokemonPreview, autoBalancedAllocations, experienceLevelForTotal, progressionRowsBetween, buildPokemonProgressionPreview, parseTutorPointCost, evaluatePrerequisiteAst, isUnderdogPokemon, pokeEdgeRequiresUnderdog, evaluatePokeEdgePrerequisite, moveTrainingPoolUsage, isNaturalTutorMove, tutorRestrictionForMove, buildPokemonRestatPreview};
})();

const __ptu_modifier_engine = (()=>{

/*
 * PTU Companion v1.3 — resolved creature / modifier layer v2 for Pokémon combat-facing values.
 *
 * Scope intentionally small and deterministic:
 * - Attack Conflict remains a Base Relations exemption handled by pokemon-engine.mjs.
 * - Mixed Power / Twisted Power modifies damaging Move rolls, not the stored Attack or Sp. Attack Stats.
 * - STAB modifies Damage Base before the Damage Chart lookup.
 *
 * The PTU Core's usual rounding rule is down, so half-stat bonuses use Math.floor.
 */

const slug=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

function hasTwistedPowerEffect(details={}){
  const edges=Array.isArray(details.pokeEdges)?details.pokeEdges:[];
  if(edges.some(e=>slug(e?.id||e?.name)==='mixed-power')) return true;
  const native=Array.isArray(details.abilities)?details.abilities:[];
  if(native.some(a=>slug(typeof a==='string'?a:a?.name)==='twisted-power')) return true;
  const granted=Array.isArray(details.grantedAbilities)?details.grantedAbilities:[];
  return granted.some(a=>slug(typeof a==='string'?a:a?.name)==='twisted-power');
}

function getPokemonModifierSummary(pokemon={}, context={}){
  const d=pokemon.details||{};
  const stats=d.finalStats||{};
  const twisted=hasTwistedPowerEffect(d);
  const attack=Math.max(0,Number(stats.attack)||0);
  const specialAttack=Math.max(0,Number(stats.special_attack??stats.spAttack)||0);
  const moveLimitBase=Math.max(0,Number(d.moveLimitBase??6)||0);
  const moveLimitModifier=Number(d.moveLimitModifier??0)||0;
  const moveLimitEffective=Math.max(0,Number(d.moveLimitEffective??(moveLimitBase+moveLimitModifier))||0);
  const held=context.heldItemEffect||null;
  const heldStatBonuses=held?.statBonuses||{};
  const effectiveStats={...stats};
  for(const [key,val] of Object.entries(heldStatBonuses)) effectiveStats[key]=(Number(effectiveStats[key])||0)+Number(val||0);
  if(held && Number(held.speedMultiplier||1)!==1 && effectiveStats.speed!=null) effectiveStats.speed=Math.floor((Number(effectiveStats.speed)||0)*Number(held.speedMultiplier||1));
  return {
    moveLimit:{base:moveLimitBase,modifier:moveLimitModifier,effective:moveLimitEffective},
    twistedPower: twisted ? {
      active:true,
      source:(d.pokeEdges||[]).some(e=>slug(e?.id||e?.name)==='mixed-power')?'Mixed Power':'Twisted Power',
      physicalDamageBonus:Math.floor(specialAttack/2),
      specialDamageBonus:Math.floor(attack/2),
      note:'Adds half Special Attack to Physical Move damage rolls and half Attack to Special Move damage rolls. It does not change the Move\'s Damage Class or the stored Stats.'
    } : {active:false,physicalDamageBonus:0,specialDamageBonus:0},
    effectiveStats,
    heldItem: held ? {id:held.id,name:held.name,automation:held.automation,effectText:held.effectText,statBonuses:held.statBonuses||{},speedMultiplier:held.speedMultiplier||1,speedEvasionBonus:held.speedEvasionBonus||0,conditionalDamageBonusSuperEffective:held.conditionalDamageBonusSuperEffective||0,preventsEvolution:!!held.preventsEvolution,removeGroundImmunity:!!held.removeGroundImmunity,hpStealRecoveryMultiplier:held.hpStealRecoveryMultiplier||1,defaultCombatStage:held.defaultCombatStage||null,warnings:held.warnings||[]} : null,
    activeEffects:[
      ...(twisted?[{kind:'damage_modifier',id:'twisted-power',source:(d.pokeEdges||[]).some(e=>slug(e?.id||e?.name)==='mixed-power')?'mixed-power':'twisted-power'}]:[]),
      ...(moveLimitModifier?[{kind:'move_limit_modifier',id:'move-limit',value:moveLimitModifier,source:'pokemon.details.moveLimitModifier'}]:[]),
      ...(held?[{kind:'held_item',id:held.id,source:'held-item',automation:held.automation}]:[])
    ]
  };
}

function mergeDiceExpression(rolledDamage, flatBonus){
  const text=String(rolledDamage||'').replace(/\s+/g,'');
  const m=text.match(/^(\d+d\d+)([+-]\d+)?$/i);
  if(!m) return flatBonus?`${rolledDamage||'Damage'} ${flatBonus>=0?'+':'-'} ${Math.abs(flatBonus)}`:String(rolledDamage||'');
  const base=Number(m[2]||0);
  const total=base+Number(flatBonus||0);
  return `${m[1]}${total>0?`+${total}`:total<0?total:''}`;
}

function resolveMoveDamage({pokemon={},moveDefinition=null,speciesTypes=[],getDamageBase=null,heldItemEffect=null}={}){
  const move=moveDefinition||{};
  const moveClass=String(move.class||move.damageClass||move.raw?.class||'').trim().toLowerCase();
  const damaging=moveClass==='physical'||moveClass==='special';
  const baseDb=Number(move.damageBase);
  if(!damaging || !Number.isFinite(baseDb) || typeof getDamageBase!=='function') return null;
  const moveType=String(move.type||'').trim().toLowerCase();
  const types=(Array.isArray(speciesTypes)?speciesTypes:[]).map(t=>String(t||'').trim().toLowerCase());
  const stab=moveType && types.includes(moveType) ? 2 : 0;
  const finalDb=Math.max(1,Math.min(28,baseDb+stab));
  const chart=getDamageBase(finalDb);
  if(!chart) return null;
  const d=pokemon.details||{};
  const stats=d.finalStats||{};
  const modifiers=getPokemonModifierSummary(pokemon,{heldItemEffect});
  const effective=modifiers.effectiveStats||stats;
  const attack=Math.max(0,Number(effective.attack)||0);
  const specialAttack=Math.max(0,Number(effective.special_attack??effective.spAttack)||0);
  const primary=moveClass==='physical'?attack:specialAttack;
  const mixedBonus=modifiers.twistedPower.active
    ? (moveClass==='physical'?modifiers.twistedPower.physicalDamageBonus:modifiers.twistedPower.specialDamageBonus)
    : 0;
  const flatBonus=primary+mixedBonus;
  return {
    moveClass,
    baseDamageBase:baseDb,
    stabDamageBaseBonus:stab,
    finalDamageBase:finalDb,
    damageChart:chart,
    primaryStat:{name:moveClass==='physical'?'Attack':'Special Attack',value:primary},
    mixedPowerBonus:mixedBonus,
    heldItemConditionalSuperEffectiveBonus:Number(heldItemEffect?.conditionalDamageBonusSuperEffective||0),
    finalRoll:mergeDiceExpression(chart.rolled_damage,flatBonus),
    breakdown:[
      {label:`DB ${baseDb}`,value:baseDb},
      ...(stab?[{label:'STAB',value:'+2 DB'}]:[]),
      {label:moveClass==='physical'?'Attack':'Special Attack',value:primary},
      ...(mixedBonus?[{label:'Mixed Power',value:mixedBonus}]:[]),
      ...(heldItemEffect?.statBonuses && Number(heldItemEffect.statBonuses[moveClass==='physical'?'attack':'special_attack']||0)?[{label:`${heldItemEffect.name} Stat Bonus`,value:Number(heldItemEffect.statBonuses[moveClass==='physical'?'attack':'special_attack'])}]:[])
    ]
  };
}

return {hasTwistedPowerEffect, getPokemonModifierSummary, resolveMoveDamage};
})();

const __ptu_held_item_engine = (()=>{

const slug=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const STAT_KEYS=['hp','attack','defense','special_attack','special_defense','speed'];
const statKey=v=>{const x=slug(v).replaceAll('-','_');return ({sp_attack:'special_attack',sp_atk:'special_attack',sp_defense:'special_defense',sp_def:'special_defense'})[x]||x;};

/**
 * Resolve the subset of PTU Held Item effects that can be represented deterministically
 * in the current prototype. Unsupported/conditional effects remain visible as manual text.
 */
function resolveHeldItemEffect({itemDefinition=null,config={},pokemon={},hasOutgoingEvolution=false}={}){
  if(!itemDefinition) return null;
  const raw=itemDefinition.raw||{};
  const id=slug(itemDefinition.id||raw.id||itemDefinition.name);
  const base={
    id,name:itemDefinition.name||raw.name||id,
    definitionId:itemDefinition.id||raw.id||id,
    versionId:itemDefinition.versionId||raw.definition_version_id||null,
    sourceId:itemDefinition.sourceId||raw.source_id||null,
    effectText:itemDefinition.effect||raw.effect_text||'',
    automation:'manual',valid:true,errors:[],warnings:[],requiresConfig:[],
    statBonuses:{},grantedAbilities:[],speedMultiplier:1,speedEvasionBonus:0,
    conditionalDamageBonusSuperEffective:0,preventsEvolution:false,removeGroundImmunity:false,
    hpStealRecoveryMultiplier:1,defaultCombatStage:null,statusOnEquip:null
  };
  switch(id){
    case 'bright-powder':
      base.automation='automatic'; base.speedEvasionBonus=2; break;
    case 'full-incense':
      base.automation='automatic'; base.grantedAbilities=['Stall']; break;
    case 'expert-belt':
      base.automation='conditional'; base.conditionalDamageBonusSuperEffective=5; break;
    case 'everstone':
      base.automation='automatic'; base.preventsEvolution=true; break;
    case 'big-root':
      base.automation='conditional'; base.hpStealRecoveryMultiplier=2; break;
    case 'iron-ball':
      base.automation='automatic'; base.speedMultiplier=0.5; base.removeGroundImmunity=true; break;
    case 'eviolite': {
      base.automation='automatic'; base.preventsEvolution=true; base.requiresConfig=['two_stats'];
      if(!hasOutgoingEvolution){base.valid=false;base.errors.push('Eviolite only affects a Pokémon that is not fully evolved in its family.');}
      const stats=Array.isArray(config.stats)?[...new Set(config.stats.map(statKey).filter(s=>STAT_KEYS.includes(s)))]:[];
      if(stats.length!==2){base.valid=false;base.errors.push('Choose exactly two different Stats for Eviolite.');}
      else for(const stat of stats) base.statBonuses[stat]=5;
      break;
    }
    case 'choice-item': {
      base.automation='partial'; base.requiresConfig=['stat'];
      const stat=statKey(config.stat||'');
      if(!STAT_KEYS.filter(s=>s!=='hp').includes(stat)){base.valid=false;base.errors.push('Choose Attack, Defense, Special Attack, Special Defense, or Speed for the Choice Item.');}
      else base.defaultCombatStage={stat,value:2};
      base.warnings.push('Suppressed status and its combat-duration persistence remain a manual combat-state check in v1.4.');
      break;
    }
    case 'flame-orb':
      base.automation='partial'; base.statusOnEquip='Burned'; base.warnings.push('Status-condition lifecycle is not fully automated yet.'); break;
    default:
      base.automation='manual'; break;
  }
  return base;
}

function applyHeldItemToTypeProfile(profile=[],effect=null){
  if(!effect?.removeGroundImmunity) return profile;
  return (profile||[]).map(row=>{
    const attack=String(row.attackType||row.attack_type||'').toLowerCase();
    if(attack!=='ground' || Number(row.multiplier)!==0) return row;
    // Iron Ball removes immunity to Ground; without a target-side component resolver here,
    // neutral is the safe resolved fallback. A future type component engine can preserve
    // a secondary resistance/weakness while removing only the immunity component.
    return {...row,relation:'neutral',multiplier:1,netSteps:0,heldItemOverride:'Iron Ball removes Ground immunity'};
  });
}

function applyHeldItemToEffectiveStats(stats={},effect=null){
  const out={...stats}; if(!effect) return out;
  for(const [key,val] of Object.entries(effect.statBonuses||{})) out[key]=(Number(out[key])||0)+Number(val||0);
  if(Number(effect.speedMultiplier)!==1 && out.speed!=null) out.speed=Math.floor((Number(out.speed)||0)*Number(effect.speedMultiplier||1));
  return out;
}

return {resolveHeldItemEffect, applyHeldItemToTypeProfile, applyHeldItemToEffectiveStats};
})();

const __ptu_trainer_engine = (()=>{

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


return {resolveTrainerModel, combatStageMultiplier, applyCombatStage, TRAINER_SKILLS, SKILL_CATEGORIES, STAT_KEYS, TYPE_NAMES, rankedLimit, trainerDefinitionRepeatability, evaluateTrainerPrerequisiteAst, evaluateTrainerDefinitionPrerequisite};
})();

const __ptu_trainer_progression_engine = (()=>{
const {resolveTrainerModel,evaluateTrainerDefinitionPrerequisite,trainerDefinitionRepeatability,STAT_KEYS} = __ptu_trainer_engine;

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

return {MILESTONE_OPTIONS,SKILL_EDGE_IDS,TRAINER_LEVEL_XP_COST,TRAINER_EDGE_XP_COST,TRAINER_FEATURE_XP_COST,trainerLevelRewards,previewTrainerProgression,applyTrainerProgression,previewTrainerXpPurchase,applyTrainerXpPurchase,isGeneralFeature,isSkillEdge,recordFromDefinition};
})();

const __ptu_item_metadata = (()=>{

const SLOT_ALIASES={
  head:'head',body:'body',main_hand:'mainHand',mainhand:'mainHand',mainHand:'mainHand',
  off_hand:'offHand',offhand:'offHand',offHand:'offHand',feet:'feet',foot:'feet',accessory:'accessory'
};

// PTU Core item extraction stores Trainer/Pokémon usability reliably, but several
// wearable/tool items do not explicitly carry their Equipment Slot in the parsed
// definition. These overrides fill only deterministic slot metadata; they do not
// invent automatic mechanical effects.
const TRAINER_EQUIPMENT_OVERRIDES={
  'dark-vision-goggles':{slots:['head']},
  'fancy-clothes':{slots:['body']},
  'flippers':{slots:['feet']},
  'gas-mask':{slots:['head']},
  'heavy-armor':{slots:['body']},
  'helmet':{slots:['head']},
  'jungle-boots':{slots:['feet']},
  'light-armor':{slots:['body']},
  'mega-ring':{slots:['accessory']},
  're-breather':{slots:['head']},
  'running-shoes':{slots:['feet']},
  'snow-boots':{slots:['feet']},
  'stealth-clothes':{slots:['body']},
  'sunglasses':{slots:['head']},

  // Focus is usually an Accessory, but Core explicitly allows it to be crafted
  // as Head, Hand, or Off-Hand equipment too.
  'focus':{slots:['accessory','head','mainHand','offHand']},

  // Core describes these as two-handed pieces of equipment.
  'fishing-rod':{slots:['mainHand'],hands:2},
  'old-rod':{slots:['mainHand'],hands:2},
  'good-rod':{slots:['mainHand'],hands:2},
  'super-rod':{slots:['mainHand'],hands:2},
  'glue-cannon':{slots:['mainHand'],hands:2},
  'hand-net':{slots:['mainHand'],hands:2},
  'hand-net-50-hp':{slots:['mainHand'],hands:2},
  'hand-net-100-hp':{slots:['mainHand'],hands:2},
  'hand-net-200-hp':{slots:['mainHand'],hands:2},
  'weighted-nets':{slots:['mainHand'],hands:2},
  'weighted-net-50-hp':{slots:['mainHand'],hands:2},
  'weighted-net-80-hp':{slots:['mainHand'],hands:2},
  'weighted-net-150-hp':{slots:['mainHand'],hands:2},

  // Trainer-compatible Held Items. Most are already tagged by the parser; these
  // explicit entries make the desktop catalog resilient to older/legacy saves.
  'expert-belt':{slots:['accessory']},
  'flame-orb':{slots:['offHand']},
  'focus-band':{slots:['accessory']},
  'focus-sash':{slots:['accessory']},
  'go-goggles':{slots:['head']},
  'iron-ball':{slots:['mainHand','offHand']},
  'kings-rock':{slots:['head']}
};

function normalizeEquipmentSlot(slot){
  if(slot==null)return null;
  const key=String(slot).trim();
  return SLOT_ALIASES[key]||SLOT_ALIASES[key.toLowerCase()]||null;
}

function itemUsageMetadata(definition){
  const raw=definition?.raw||{};
  const id=String(definition?.id||raw.id||'');
  const override=TRAINER_EQUIPMENT_OVERRIDES[id]||null;
  const parsedSlots=Array.isArray(raw.equipment_slots)?raw.equipment_slots.map(normalizeEquipmentSlot).filter(Boolean):[];
  const overrideSlots=(override?.slots||[]).map(normalizeEquipmentSlot).filter(Boolean);
  const slots=[...new Set(overrideSlots.length?overrideSlots:parsedSlots)];
  const trainerUsable=override?true:raw.trainer_usable===true;
  const pokemonHeldUsable=raw.pokemon_held_usable===true;
  const hands=Number(override?.hands||0)||null;
  // Content Packs may define full deterministic equipment/weapon mechanics.
  // Preserve this payload when turning a catalog Item into a Backpack item so
  // imported weapons follow exactly the same runtime path as built-in weapons.
  const rawMechanics=raw.mechanics&&typeof raw.mechanics==='object'?{...raw.mechanics}:null;
  if(rawMechanics && !rawMechanics.kind && rawMechanics.weaponClass) rawMechanics.kind='weapon';
  if(rawMechanics && !rawMechanics.hands && hands) rawMechanics.hands=hands;
  const mechanics=rawMechanics || (hands?{kind:'equipment',hands}:null);
  return {
    trainerUsable,
    pokemonHeldUsable,
    equipmentSlots:slots,
    equipSlot:slots[0]||null,
    mechanics
  };
}

function equipmentSlotLabel(slot){
  return ({head:'Head',body:'Body',mainHand:'Main Hand',offHand:'Off Hand',feet:'Feet',accessory:'Accessory'})[normalizeEquipmentSlot(slot)]||String(slot||'');
}



return {normalizeEquipmentSlot, itemUsageMetadata, equipmentSlotLabel, TRAINER_EQUIPMENT_OVERRIDES};
})();

const __ptu_mobile_api = (()=>{
const {buildPokemonPreview, buildPokemonProgressionPreview, buildPokemonRestatPreview, autoBalancedAllocations, NATURES, parseTutorPointCost, evaluatePokeEdgePrerequisite, moveTrainingPoolUsage, isNaturalTutorMove, tutorRestrictionForMove, relationExemptionsFromPokeEdges, isUnderdogPokemon, pokeEdgeRequiresUnderdog, levelAbilitySlots, eligibleAbilities, applyNature, normalizeBaseStats, normalizeAllocations, STAT_KEYS, validateBaseRelations} = __ptu_pokemon_engine;
const {getPokemonModifierSummary, resolveMoveDamage} = __ptu_modifier_engine;
const {resolveHeldItemEffect, applyHeldItemToTypeProfile, applyHeldItemToEffectiveStats} = __ptu_held_item_engine;
const {resolveTrainerModel} = __ptu_trainer_engine;
const {previewTrainerProgression,applyTrainerProgression,previewTrainerXpPurchase,applyTrainerXpPurchase} = __ptu_trainer_progression_engine;
const {itemUsageMetadata} = __ptu_item_metadata;


const MOBILE_KEY='ptu-companion-android-store-v1';
const data=window.__PTU_MOBILE_DATA__;
if(!data) throw new Error('PTU mobile data bundle is missing.');
const ALLOWED_KINDS=new Set(data.kinds||[]);
const deep=v=>JSON.parse(JSON.stringify(v));
const norm=v=>String(v||'').trim().toLowerCase();


const nativeInvoke=()=>window.__TAURI__?.core?.invoke||null;
const importedPackId=pack=>String(pack?.manifest?.id||'').trim();
const importedPackPriority=pack=>Number(pack?.manifest?.priority??100)||100;
const importedPackName=pack=>String(pack?.manifest?.name||importedPackId(pack)||'Imported Content Pack');
const importedPackKind=pack=>String(pack?.manifest?.kind||'custom');
const importedPackVersion=pack=>String(pack?.manifest?.version||'0.0.0');

function importedDefinitionRecord(kind,row,pack){
  const raw={...(row||{})};
  const logical=String(raw.logical_id||raw.id||'').trim();
  if(!logical) throw new Error(`Imported ${kind} record is missing logical_id/id.`);
  const packId=importedPackId(pack);
  const versionId=String(raw.definition_version_id||`${kind}:${logical}@${packId}`);
  raw.logical_id=logical; raw.definition_version_id=versionId; raw.content_pack_id=packId;
  const sourcePriority=Number(raw.source_priority??pack?.manifest?.priority??100)||100;
  const tags=Array.isArray(raw.tags)?raw.tags:[];
  return {
    kind,id:logical,name:raw.name||raw.display_name||logical,versionId,contentPackId:packId,
    packName:importedPackName(pack),packKind:importedPackKind(pack),sourceId:String(raw.source_id||pack?.manifest?.source_ids?.[0]||packId),
    sourcePage:raw.source_page==null?null:Number(raw.source_page),priority:sourcePriority,pinned:false,needsReview:!!raw.needs_review,
    type:raw.type||(Array.isArray(raw.types)?raw.types.join(' / '):null),category:raw.class||raw.category||raw.record_kind||raw.capability_kind||null,
    parentClass:raw.parent_class||null,tags,trainingFeature:raw.training_feature===true||tags.some(t=>String(t).toLowerCase()==='training'),profession:raw.profession||null,
    frequency:raw.frequency_text||raw.frequency_action_text||raw.frequency?.raw||null,effect:raw.effect_text||null,prerequisites:raw.prerequisites_text||null,
    price:raw.price??null,damageBase:raw.damage_base??null,ac:raw.ac??null,range:raw.range_text||null,contestType:raw.contest_type||null,contestEffect:raw.contest_effect||null,
    dexNumber:raw.dex_number??raw.national_dex_number??null,enabledForCreation:raw.enabled_for_character_creation??null,completeness:raw.mechanical_completeness||null,
    types:Array.isArray(raw.types)?raw.types:[],baseStats:raw.base_stats||null,abilities:raw.ability_slots||[],capabilities:raw.capabilities||[],levelUpMoves:raw.level_up_moves||[],
    raw,rawText:raw.raw_text||null,semanticAutomation:raw.semantic_automation||null,compiledEffects:raw.compiled_effects||[],prerequisiteSemantics:raw.prerequisite_semantics||null,
    defenseProfile:raw.type_defense_profile||null,evolution:raw.evolution||null,evolutionText:raw.evolution_text||null,skills:raw.skills||null,skillsText:raw.skills_text||null,
    capabilitiesText:raw.capabilities_text||null,tmMoves:raw.tm_moves||[],tutorMoves:raw.tutor_moves||[],eggMoves:raw.egg_moves||[],androidImported:true
  };
}

function enabledPackMeta(ruleset,packId){ return (ruleset?.packs||[]).find(p=>p.pack_id===packId&&p.enabled); }
function recomputeResolvedDefinition(rulesetId,kind,logicalId){
  const ruleset=(data.rulesets||[]).find(r=>r.id===rulesetId); if(!ruleset)return;
  data.resolved[rulesetId] ||= {}; data.resolved[rulesetId][kind] ||= {};
  const pins=new Map((ruleset.pins||[]).map(p=>[p.definition_key,p.version_id]));
  const candidates=(data.versionGroups?.[`${kind}:${logicalId}`]||[]).map(vid=>data.records?.[vid]).filter(Boolean).map(rec=>{
    const meta=enabledPackMeta(ruleset,rec.contentPackId); if(!meta)return null;
    return {rec,meta,pinned:pins.get(`${kind}:${logicalId}`)===rec.versionId?1:0,sourcePriority:Number(rec.raw?.source_priority??rec.priority??0)||0};
  }).filter(Boolean);
  candidates.sort((a,b)=>b.pinned-a.pinned || Number(b.meta.priority||0)-Number(a.meta.priority||0) || Number(b.meta.position||0)-Number(a.meta.position||0) || b.sourcePriority-a.sourcePriority || String(b.rec.versionId).localeCompare(String(a.rec.versionId)));
  if(candidates[0]) data.resolved[rulesetId][kind][logicalId]=candidates[0].rec.versionId;
  else delete data.resolved[rulesetId][kind][logicalId];
}

function removeImportedPackOverlay(packId){
  const affected=[];
  for(const [vid,rec] of Object.entries(data.records||{})) if(rec?.androidImported&&rec.contentPackId===packId){ affected.push([rec.kind,rec.id]); delete data.records[vid]; }
  for(const [key,vids] of Object.entries(data.versionGroups||{})){
    const next=vids.filter(vid=>data.records?.[vid]); if(next.length)data.versionGroups[key]=next; else delete data.versionGroups[key];
  }
  data.packs=(data.packs||[]).filter(p=>!(p.androidImported&&p.id===packId));
  for(const ruleset of (data.rulesets||[])) ruleset.packs=(ruleset.packs||[]).filter(p=>!(p.androidImported&&p.pack_id===packId));
  data.evolutionEdges=(data.evolutionEdges||[]).filter(e=>e?._androidImportedPackId!==packId);
  return affected;
}

function removeImportedPackAndRecompute(packId){
  const affected=removeImportedPackOverlay(packId);
  const uniqueAffected=[...new Map(affected.map(x=>[`${x[0]}:${x[1]}`,x])).values()];
  for(const ruleset of (data.rulesets||[])) for(const [kind,id] of uniqueAffected) recomputeResolvedDefinition(ruleset.id,kind,id);
  return uniqueAffected;
}

function requiredDependenciesForPack(pack){
  return (Array.isArray(pack?.manifest?.dependencies)?pack.manifest.dependencies:[]).filter(d=>d?.id&&d.required!==false).map(d=>String(d.id));
}
function packEnabledInRuleset(packId,rulesetId){
  return !!definitions.getRuleset(rulesetId)?.packs?.some(p=>p.pack_id===packId&&p.enabled);
}
function activeRequiredDependents(packId,rulesetId){
  return definitions.getPacks().filter(p=>p.id!==packId&&requiredDependenciesForPack(p).includes(packId)&&packEnabledInRuleset(p.id,rulesetId));
}
function installedRequiredDependents(packId){
  return definitions.getPacks().filter(p=>p.id!==packId&&requiredDependenciesForPack(p).includes(packId));
}

function applyImportedPack(pack){
  const packId=importedPackId(pack); if(!packId)return;
  const affected=removeImportedPackOverlay(packId);
  const packMeta={id:packId,name:importedPackName(pack),version:importedPackVersion(pack),priority:importedPackPriority(pack),kind:importedPackKind(pack),browse_only:!!pack?.manifest?.browse_only,
    archive_filename:pack.archiveFilename||null,archive_sha256:pack.archiveSha256||null,manifest:deep(pack.manifest||{}),enabledRulesets:Array.isArray(pack.enabledRulesets)?[...pack.enabledRulesets]:[],androidImported:true};
  data.packs ||= []; data.packs.push(packMeta);
  const enabledRulesets=Array.isArray(pack.enabledRulesets)?pack.enabledRulesets:[store?.activeRulesetId||'all-provided-material'];
  for(const ruleset of (data.rulesets||[])){
    if(!enabledRulesets.includes(ruleset.id))continue;
    ruleset.packs ||= [];
    const maxPos=Math.max(-1,...ruleset.packs.map(p=>Number(p.position??-1)));
    ruleset.packs.push({pack_id:packId,enabled:true,priority:importedPackPriority(pack),position:maxPos+1,name:packMeta.name,kind:packMeta.kind,browse_only:packMeta.browse_only,version:packMeta.version,androidImported:true});
  }
  for(const [kind,rows] of Object.entries(pack.definitions||{})){
    if(!ALLOWED_KINDS.has(kind))continue;
    for(const row of (Array.isArray(rows)?rows:[])){
      const rec=importedDefinitionRecord(kind,row,pack); data.records[rec.versionId]=rec;
      const key=`${kind}:${rec.id}`; data.versionGroups[key]=[...(data.versionGroups[key]||[]).filter(v=>v!==rec.versionId),rec.versionId]; affected.push([kind,rec.id]);
    }
  }
  const sourceIds=new Set((pack?.manifest?.source_ids||[]).map(String));
  for(const edge of (pack.evolutionEdges||[])) data.evolutionEdges.push({...deep(edge),raw:deep(edge.raw||edge),_androidImportedPackId:packId});
  const uniqueAffected=[...new Map(affected.map(x=>[`${x[0]}:${x[1]}`,x])).values()];
  for(const ruleset of (data.rulesets||[])) for(const [kind,id] of uniqueAffected) recomputeResolvedDefinition(ruleset.id,kind,id);
}

async function loadNativeContentPacks(){
  const invoke=nativeInvoke(); if(!invoke)return [];
  try{
    const packs=await invoke('load_content_packs');
    for(const pack of (packs||[])){
      const packId=importedPackId(pack);
      const bundled=(data.packs||[]).find(p=>String(p?.id||'')===packId&&!p?.androidImported);
      if(bundled){
        // Migration path: beta builds before these packs became bundled may already
        // have native imported copies in app-data. Keep the user's enabled/disabled
        // choice, but do not overlay a duplicate pack on top of the bundled copy.
        const enabledRulesets=new Set(Array.isArray(pack?.enabledRulesets)?pack.enabledRulesets.map(String):[]);
        for(const ruleset of (data.rulesets||[])){
          if(!(ruleset.packs||[]).some(p=>String(p?.pack_id||'')===packId))continue;
          setBundledPackEnabled(packId,ruleset.id,enabledRulesets.has(String(ruleset.id)),{remember:true});
        }
        continue;
      }
      applyImportedPack(pack);
    }
    return packs||[];
  }
  catch(error){console.warn('Could not load Android content packs',error);return [];}
}

class MobileDefinitions {
  getRulesets(){ return (data.rulesets||[]).map(r=>({id:r.id,name:r.name,version:r.version,description:r.description})); }
  getRuleset(id){ return deep((data.rulesets||[]).find(r=>r.id===id)||null); }
  getPacks(){ return deep(data.packs||[]); }
  _map(rs,kind){ return data.resolved?.[rs]?.[kind]||{}; }
  getResolved({rulesetId,kind,id}){ const vid=this._map(rulesetId,kind)[id],record=data.records?.[vid]; return record?{...deep(record),kind}:null; }
  listResolved({rulesetId,kind,q='',limit=60,offset=0}){
    const needle=norm(q); const ids=Object.keys(this._map(rulesetId,kind)); const rows=[];
    for(const id of ids){ const row=this.getResolved({rulesetId,kind,id}); if(!row)continue; if(needle && !norm(`${id} ${row.name||''} ${row.effect||''} ${JSON.stringify(row.raw||{})}`).includes(needle))continue; rows.push(row); }
    rows.sort((a,b)=>String(a.name||a.id).localeCompare(String(b.name||b.id))); return rows.slice(Number(offset)||0,(Number(offset)||0)+(Number(limit)||60));
  }
  countResolved({rulesetId,kind,q=''}){ return this.listResolved({rulesetId,kind,q,limit:100000,offset:0}).length; }
  getVersions({kind,id}){ const vids=data.versionGroups?.[`${kind}:${id}`]||[]; return vids.map(v=>data.records[v]?{...deep(data.records[v]),kind}:null).filter(Boolean); }
  getCounts(rulesetId){ const out={}; for(const k of ALLOWED_KINDS)out[k]=Object.keys(this._map(rulesetId,k)).length; return out; }
  getDamageBase(db){ return deep(data.damageBase?.[String(Number(db))]||null); }
  getTypeMatchups(){ return deep(data.typeMatchups||[]); }
  getTypeEffectivenessScale(){ return deep(data.typeEffectivenessScale||[]); }
  getDefensiveTypeProfile(types=[]){
    const defenseTypes=(types||[]).map(x=>String(x||'').trim()).filter(Boolean), matchups=this.getTypeMatchups();
    const attackTypes=[...new Set(matchups.map(r=>r.attack_type))], byKey=new Map(matchups.map(r=>[`${r.attack_type}::${r.defense_type}`,r]));
    const scale=new Map(this.getTypeEffectivenessScale().map(r=>[Number(r.net_steps),Number(r.combat_multiplier)]));
    return attackTypes.map(attackType=>{let immune=false,steps=0;const components=[];for(const defenseType of defenseTypes){const row=byKey.get(`${attackType}::${defenseType}`)||{relation:'neutral'};components.push({defenseType,relation:row.relation});if(row.relation==='immune')immune=true;else if(row.relation==='weak')steps++;else if(row.relation==='resist'||row.relation==='resistant')steps--;}const clamped=Math.max(-3,Math.min(3,steps));const multiplier=immune?0:(scale.get(clamped)??1);return {attackType,relation:immune?'immune':clamped>0?'weak':clamped<0?'resistant':'neutral',netSteps:immune?null:steps,multiplier,components};});
  }
  getPokemonExperience(level){ level=Math.max(1,Math.min(100,Number(level)||1)); return deep((data.experience||[]).find(r=>Number(r.level)===level)||null); }
  getPokemonExperienceTable(){ return deep(data.experience||[]); }
  getPokemonLevelForExperience(exp){ exp=Math.max(0,Number(exp)||0); return deep([...(data.experience||[])].reverse().find(r=>Number(r.cumulative_exp)<=exp)||this.getPokemonExperience(1)); }
  getEvolutionGuidance(){ return deep(data.evolutionGuidance||{}); }
  findResolvedSpeciesByName({rulesetId,name}={}){ const t=norm(name); return this.listResolved({rulesetId,kind:'species',q:name,limit:200}).find(r=>norm(r.name)===t)||null; }
  _edgesTo(name){ return (data.evolutionEdges||[]).filter(e=>norm(e.to_species_name)===norm(name)); }
  _edgesFrom(name){ return (data.evolutionEdges||[]).filter(e=>norm(e.from_species_name)===norm(name)); }
  getIncomingEvolution({speciesName,sourceId=null}={}){ const rows=this._edgesTo(speciesName).sort((a,b)=>(a.source_id===sourceId?-1:0)-(b.source_id===sourceId?-1:0)); const r=rows[0]; return r?{...deep(r),raw:deep(r.raw||{})}:null; }
  getEvolutionAncestry({rulesetId,speciesName,sourceId=null,maxDepth=8}={}){ const out=[],seen=new Set([norm(speciesName)]);let cur=speciesName,src=sourceId;for(let i=0;i<maxDepth;i++){const e=this.getIncomingEvolution({speciesName:cur,sourceId:src});if(!e)break;let a=e.raw?.from_ref_key?this.getResolved({rulesetId,kind:'species',id:String(e.raw.from_ref_key)}):null;if(!a)a=this.findResolvedSpeciesByName({rulesetId,name:e.from_species_name});if(!a||seen.has(norm(a.name||a.id)))break;seen.add(norm(a.name||a.id));out.push({id:a.id,name:a.name,sourceId:a.sourceId,contentPackId:a.contentPackId,levelUpMoves:a.levelUpMoves||[],evolutionEdge:{fromSpeciesName:e.from_species_name,toSpeciesName:e.to_species_name,toMinLevel:e.to_min_level??null,conditionText:e.condition_text||null,sourceId:e.source_id||null}});cur=a.name;src=a.sourceId||e.source_id||src;}return out; }
  getOutgoingEvolutions({rulesetId,speciesName,sourceId=null}={}){ const seen=new Set(),out=[];for(const row of this._edgesFrom(speciesName).sort((a,b)=>(a.source_id===sourceId?-1:0)-(b.source_id===sourceId?-1:0))){const raw=row.raw||{},key=norm(raw.to_ref_key||row.to_species_name);if(seen.has(key))continue;seen.add(key);let target=raw.to_ref_key?this.getResolved({rulesetId,kind:'species',id:String(raw.to_ref_key)}):null;if(!target)target=this.findResolvedSpeciesByName({rulesetId,name:row.to_species_name});if(!target)continue;out.push({fromSpeciesName:row.from_species_name,toSpeciesName:row.to_species_name,toMinLevel:row.to_min_level??null,conditionText:row.condition_text||null,mappingConfidence:row.mapping_confidence||null,sourceId:row.source_id||null,evolutionRulesSource:'ptu_material',sourceTitle:row.source_id||'PTU material',sourceKind:null,target:{id:target.id,name:target.name,versionId:target.versionId,contentPackId:target.contentPackId,sourceId:target.sourceId,types:target.types||[],baseStats:target.baseStats||null,abilities:target.abilities||[],levelUpMoves:target.levelUpMoves||[],capabilities:target.capabilities||[],skills:target.skills||null}});}return out; }
}
const definitions=new MobileDefinitions();
window.__PTU_SPECIES_PORTRAIT__=(speciesId)=>{try{return definitions.getResolved({rulesetId:getActiveRuleset(),kind:'species',id:String(speciesId||'')})?.raw?.portrait_data_url||null;}catch{return null;}};
function loadStore(){ try{return JSON.parse(localStorage.getItem(MOBILE_KEY)||'null');}catch{return null;} }
function initialStore(){ const states=deep(data.states||{}),profiles=deep(data.profiles||[]); return {activeProfileId:data.activeProfileId||profiles[0]?.id||Object.keys(states)[0]||'alex',profiles,states,revisions:{},activeRulesetId:'all-provided-material',packEnabledOverrides:{}}; }
let store=loadStore()||initialStore();
store.packEnabledOverrides ||= {};
function persist(){ localStorage.setItem(MOBILE_KEY,JSON.stringify(store)); }
function persistBundledPackEnabled(packId,rulesetId,enabled){ store.packEnabledOverrides[rulesetId] ||= {}; store.packEnabledOverrides[rulesetId][packId]=!!enabled; persist(); }
function setBundledPackEnabled(packId,rulesetId,enabled,{remember=true}={}){
  const ruleset=(data.rulesets||[]).find(r=>r.id===rulesetId); if(!ruleset)return false;
  const meta=(ruleset.packs||[]).find(p=>String(p.pack_id)===String(packId)); if(!meta)return false;
  meta.enabled=!!enabled; if(remember)persistBundledPackEnabled(packId,rulesetId,enabled);
  const affected=[]; for(const rec of Object.values(data.records||{}))if(String(rec?.contentPackId||'')===String(packId))affected.push([rec.kind,rec.id]);
  for(const [kind,id] of affected)recomputeResolvedDefinition(rulesetId,kind,id);
  return true;
}
function applyStoredPackOverrides(){ for(const [rulesetId,byPack] of Object.entries(store.packEnabledOverrides||{}))for(const [packId,enabled] of Object.entries(byPack||{}))setBundledPackEnabled(packId,rulesetId,!!enabled,{remember:false}); }
function isProtectedBuiltInPack(pack){ return !pack?.androidImported && (String(pack?.id||'')==='ptu-core-1.05' || String(pack?.kind||'')==='official_core'); }
const seed=deep(data.seed||Object.values(data.states||{})[0]||{});
const repo={
  hasProfiles:()=>Object.keys(store.states||{}).length>0,
  getActiveProfileId:()=>store.activeProfileId,
  setActiveProfileId:id=>{store.activeProfileId=id;persist();},
  listProfiles:()=>Object.values(store.states||{}).map(s=>({id:s.trainer?.id||s.activeProfileId,name:s.trainer?.name||'Trainer',title:s.trainer?.title||'Trainer',level:Number(s.trainer?.level||1),portraitDataUrl:s.trainer?.portraitDataUrl||null,active:(s.trainer?.id||s.activeProfileId)===store.activeProfileId})),
  loadState:(id=store.activeProfileId)=>deep(store.states?.[id]||null),
  saveState:(state,{createRevision=false}={})=>{const id=state?.trainer?.id||state?.activeProfileId||store.activeProfileId||'trainer';state.activeProfileId=id;store.states[id]=deep(state);store.activeProfileId=id;if(createRevision){store.revisions[id]||=[];store.revisions[id].unshift({id:Date.now(),created_at:new Date().toISOString(),state:deep(state)});store.revisions[id]=store.revisions[id].slice(0,30);}persist();return {profileId:id,revisionCreated:createRevision};},
  deleteProfile:id=>{delete store.states[id];delete store.revisions[id];const ids=Object.keys(store.states);if(!ids.length){const s=deep(seed);const nid=s.trainer?.id||'trainer';s.activeProfileId=nid;store.states[nid]=s;}if(store.activeProfileId===id)store.activeProfileId=Object.keys(store.states)[0];persist();return store.activeProfileId;},
  listRevisions:(id=store.activeProfileId,limit=10)=>(store.revisions?.[id]||[]).slice(0,limit).map(r=>({id:r.id,created_at:r.created_at})),
  restoreRevision:id=>{const arr=store.revisions?.[store.activeProfileId]||[];const r=arr.find(x=>Number(x.id)===Number(id));if(!r)throw Object.assign(new Error('Revision not found'),{status:404});store.states[store.activeProfileId]=deep(r.state);persist();return deep(r.state);}
};
const db={prepare(sql){return {get(){return {value:store.activeRulesetId||'all-provided-material'};},run(v){if(String(sql).includes('active_ruleset_id')){store.activeRulesetId=String(v);persist();}return {changes:1};}};}};
const getActiveRuleset=()=>store.activeRulesetId||'all-provided-material';
const defaultRuleset='all-provided-material';
function slugId(value){
  return String(value||'trainer').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'trainer';
}
function uniqueProfileId(name){
  const base=slugId(name);
  let id=base, n=2;
  const existing=new Set(repo.listProfiles().map(p=>p.id));
  while(existing.has(id)) id=`${base}-${n++}`;
  return id;
}
function blankTrainerState({name='New Trainer',title='Trainer'}={}){
  const id=uniqueProfileId(name);
  const clean=structuredClone(seed);
  clean.version=2; clean.activeProfileId=id;
  clean.trainer={
    ...clean.trainer,id,name,title,level:1,exp:0,nextExp:10,money:5000,ptuPoints:0,badges:0,portraitDataUrl:null,
    stats:{hp:10,attack:5,defense:5,spAttack:5,spDefense:5,speed:5},
    derived:{},skills:{},equipment:{head:null,body:null,mainHand:null,offHand:null,feet:null,accessory:null},modifiers:[],gmGrants:[],history:[],
    details:{background:{name:'New Background',adept:'Athletics',novice:'Command',pathetic:['Guile','Intuition','Focus']},skillRanks:Object.fromEntries(['Acrobatics','Athletics','Combat','Intimidate','Stealth','Survival','General Education','Medicine Education','Occult Education','Pokémon Education','Technology Education','Guile','Perception','Charm','Command','Focus','Intuition'].map(k=>[k,2])),features:[],edges:[],moves:[],trainingFeature:null,currentHp:null,injuries:0,currentAp:null,combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}}
  };
  clean.pokemon=[];
  clean.rosters=[{id:`${id}-personal`,name:'Personal Team',role:'COMBAT',maxMembers:6,active:true,color:'#0b7b4b'}];
  clean.inventory=(clean.inventory||[]).map(i=>({...i,qty:0}));
  clean.npcs=[]; clean.selectedPokemonId=null; clean.selectedRosterId=clean.rosters[0].id; clean.selectedNpcId=null;
  clean.shop={preset:'Poké Mart',discountPct:0,mode:'buy',cart:{}};
  clean.ui={screen:'trainer',creatureTab:'sheet',trainerTab:'profile',toast:null,round:1,scene:1,day:1,gmOverride:false};
  return clean;
}

const rulesetHasPack=(rulesetId,packId)=>!!definitions.getRuleset(rulesetId)?.packs?.some(p=>p.enabled&&p.pack_id===packId);
function getMixedPowerPokeEdge(rulesetId){
  if(!rulesetHasPack(rulesetId,'ptu-september-2015-playtest')) return null;
  const source=definitions.getVersions({kind:'features',id:'mixed-power'}).find(v=>v.contentPackId==='ptu-september-2015-playtest');
  return {
    ...(source||{}),kind:'poke_edges',id:'mixed-power',name:'Mixed Power',virtualPokeEdge:true,
    versionId:source?.versionId||'poke_edge:mixed-power@sep2015-adapter',contentPackId:'ptu-september-2015-playtest',
    sourceId:'sep2015',sourcePage:source?.sourcePage||9,packName:source?.packName||'September 2015 Playtest',
    prerequisites:'Level 10; at least 5 Level-Up Stat Points invested in both Attack and Special Attack',
    effect:'The user gains the Twisted Power Ability.',raw:{...(source?.raw||{}),cost_text:'Cost: 2 Tutor Points'}
  };
}


const itemSlug=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const itemIconForCategory=category=>({
  'berry':'🫐','poké ball':'🔴','medicine':'🧪','evolution item':'💎','held item':'🔷','travel gear':'🎒',
  'vitamin':'💊','herb':'🌿','combat item':'⚔️','crafting kit':'🧰','hm':'💿','tm':'💿','refreshment':'🥤',
  'food':'🍱','pokémon toolkit':'🧰','special pokémon item':'◆','repel':'🧴','equipment':'🛡️','weapon':'⚔️','arcane weapon':'🪄'
}[String(category||'').toLowerCase()]||'◆');
function pokemonSpriteCandidates(speciesId,speciesName=''){
  const direct=String(speciesId||'').trim().toLowerCase();
  const compact=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]+/g,'').replace(/^-|-$/g,'');
  const nameSlug=compact(String(speciesName||'').replace(/\s+/g,'-'));
  const candidates=[direct,nameSlug,direct.replace(/-/g,''),nameSlug.replace(/-/g,'')];
  return [...new Set(candidates.filter(Boolean))];
}
async function fetchPokemonPortrait(speciesId,speciesName){
  const candidates=pokemonSpriteCandidates(speciesId,speciesName);
  for(const slug of candidates.slice(0,2)){
    const remote=`https://play.pokemonshowdown.com/sprites/gen5/${encodeURIComponent(slug)}.png`;
    try{
      const response=await fetch(remote,{headers:{'User-Agent':'PTU-Companion-Beta/2.1'},signal:AbortSignal.timeout(1500)});
      const type=response.headers.get('content-type')||'';
      if(response.ok&&type.includes('image')){
        const bytes=Buffer.from(await response.arrayBuffer());
        if(bytes.length>0&&bytes.length<500000)return bytes;
      }
    }catch{}
  }
  // PokeAPI is a fallback only. Its front_default sprite is also intentionally small.
  for(const slug of candidates.slice(0,2)){
    try{
      const meta=await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(slug)}`,{headers:{'User-Agent':'PTU-Companion-Beta/2.1'},signal:AbortSignal.timeout(1500)});
      if(!meta.ok)continue;
      const data=await meta.json(); const sprite=data?.sprites?.front_default; if(!sprite)continue;
      const image=await fetch(sprite,{headers:{'User-Agent':'PTU-Companion-Beta/2.1'},signal:AbortSignal.timeout(1500)}); if(!image.ok)continue;
      const bytes=Buffer.from(await image.arrayBuffer()); if(bytes.length>0&&bytes.length<500000)return bytes;
    }catch{}
  }
  return null;
}

function inventoryItemFromDefinition(definition){
  const raw=definition?.raw||{};
  const usage=itemUsageMetadata(definition);
  return {
    id:definition.id,definitionId:definition.id,icon:raw.icon_data_url||raw.icon_url||raw.icon||itemIconForCategory(definition.category),name:definition.name,
    category:definition.category||'Item',price:Number(definition.price||0),priceText:raw.price_text||null,qty:0,
    consumable:!!raw.consumable,equipSlot:usage.equipSlot,description:definition.effect||raw.effect_text||'',custom:false,
    trainerUsable:usage.trainerUsable,pokemonHeldUsable:usage.pokemonHeldUsable,equipmentSlots:usage.equipmentSlots,
    sourceId:definition.sourceId||null,sourcePage:definition.sourcePage||null,contentPackId:definition.contentPackId||null,definitionVersionId:definition.versionId||null,
    shopCategories:Array.isArray(raw.shop_categories)?raw.shop_categories.map(String):[],shopVisible:raw.shop_visible!==false,mechanics:usage.mechanics,equipmentConfig:raw.equipment_config||null,config:{}
  };
}

function inventoryDefinitionForItem(item,rulesetId){
  if(!item||item.custom)return null;
  const candidates=[item.definitionId,item.id,itemSlug(item.name)].filter(Boolean);
  for(const candidate of candidates){
    const found=definitions.getResolved({rulesetId,kind:'items',id:String(candidate)});
    if(found)return found;
  }
  return null;
}
function hydrateInventoryItem(item,rulesetId){
  if(!item||typeof item!=='object')return item;
  if(item.custom)return {...item,equipmentSlots:Array.isArray(item.equipmentSlots)?item.equipmentSlots:[],equipSlot:null,trainerUsable:false,pokemonHeldUsable:false};
  const definition=inventoryDefinitionForItem(item,rulesetId);
  if(!definition)return item;
  const canonical=inventoryItemFromDefinition(definition);
  return {
    ...item,
    ...canonical,
    id:item.id||canonical.id,
    qty:Number(item.qty||0),
    mechanics:item.mechanics||canonical.mechanics||null,
    config:item.config||{},
    custom:false
  };
}
function hydrateStateForClient(state){
  if(!state)return state;
  const rulesetId=getActiveRuleset();
  state.inventory=Array.isArray(state.inventory)?state.inventory.map(item=>hydrateInventoryItem(item,rulesetId)):[];
  return state;
}
function resolveHeldItemDefinition({rulesetId,pokemon=null,inventoryItem=null}={}){
  const d=pokemon?.details||{};
  const candidates=[d.heldItemDefinitionId,inventoryItem?.definitionId,inventoryItem?.id,itemSlug(inventoryItem?.name),itemSlug(pokemon?.heldItem)].filter(Boolean);
  for(const id of candidates){
    const found=definitions.getResolved({rulesetId,kind:'items',id:String(id)});
    if(found) return found;
  }
  return null;
}
function resolvePokemonHeldItem({rulesetId,pokemon,species=null}={}){
  if(!pokemon?.heldItem) return {definition:null,effect:null};
  const definition=resolveHeldItemDefinition({rulesetId,pokemon});
  if(!definition) return {definition:null,effect:null};
  const outgoing=species?definitions.getOutgoingEvolutions({rulesetId,speciesName:species.name,sourceId:species.sourceId}):[];
  const effect=resolveHeldItemEffect({itemDefinition:definition,config:pokemon?.details?.heldItemConfig||{},pokemon,hasOutgoingEvolution:outgoing.length>0});
  return {definition,effect};
}

const abilitySlug=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function abilitySourceForIndex(index){
  if(index===0) return {kind:'species_starting',label:'Starting Ability',unlockLevel:1};
  if(index===1) return {kind:'level_choice',label:'Level 20 Ability',unlockLevel:20};
  if(index===2) return {kind:'level_choice',label:'Level 40 Ability',unlockLevel:40};
  return {kind:'native_extra',label:`Native Ability ${index+1}`,unlockLevel:null};
}

const capabilityKey=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function normalizeEdgeTarget(edge={}){
  return String(edge.targetId||edge.targetCapabilityId||edge.targetMoveId||edge.targetStat||edge.targetNote||'').trim();
}
function resolvePokemonCapabilities(species,details={}){
  const caps=structuredClone(Array.isArray(species?.capabilities)?species.capabilities:[]);
  const byId=new Map();
  for(const cap of caps){
    if(cap?.kind==='jump'){
      byId.set('high-jump',{kind:'jump_component',parent:cap,field:'high',name:'High Jump'});
      byId.set('long-jump',{kind:'jump_component',parent:cap,field:'long',name:'Long Jump'});
    }
    const id=capabilityKey(cap?.capability_id||cap?.name);
    if(id) byId.set(id,{kind:'capability',cap,name:cap?.name||id});
  }
  const applied=[];
  for(const edge of (Array.isArray(details.pokeEdges)?details.pokeEdges:[])){
    const edgeId=capabilityKey(edge?.id||edge?.name);
    const target=capabilityKey(normalizeEdgeTarget(edge));
    if(!target) continue;
    if(edgeId==='advanced-mobility'){
      const rec=byId.get(target);
      if(rec?.kind==='capability' && rec.cap?.kind==='movement'){
        rec.cap.value=(Number(rec.cap.value)||0)+2;
        applied.push({edgeId,targetId:target,targetName:rec.name,operation:'add',value:2});
      }
    } else if(edgeId==='capability-training'){
      const rec=byId.get(target);
      if(target==='power' && rec?.kind==='capability'){
        rec.cap.value=(Number(rec.cap.value)||0)+1;
        applied.push({edgeId,targetId:target,targetName:'Power',operation:'add',value:1});
      } else if((target==='high-jump'||target==='long-jump') && rec?.kind==='jump_component'){
        rec.parent[rec.field]=(Number(rec.parent[rec.field])||0)+1;
        applied.push({edgeId,targetId:target,targetName:rec.name,operation:'add',value:1});
      }
    }
  }
  return {capabilities:caps,applied};
}
function accuracyTrainingMap(details={}){
  const out=new Map();
  for(const edge of (Array.isArray(details.pokeEdges)?details.pokeEdges:[])){
    if(capabilityKey(edge?.id||edge?.name)!=='accuracy-training') continue;
    const target=capabilityKey(normalizeEdgeTarget(edge));
    if(!target) continue;
    out.set(target,(out.get(target)||0)+1);
  }
  return out;
}

function emptyStatMap(){ return Object.fromEntries(STAT_KEYS.map(k=>[k,0])); }
function addStatMaps(...maps){
  const out=emptyStatMap();
  for(const map of maps) for(const k of STAT_KEYS) out[k]+=Number(map?.[k]||0);
  return out;
}
function speciesBaseStatTotal(species){
  const base=normalizeBaseStats(species?.baseStats||species?.base_stats||{});
  return STAT_KEYS.reduce((sum,k)=>sum+Number(base[k]||0),0);
}
function edgeStatAllocation(edge){ return normalizeAllocations(edge?.statAllocation||edge?.statAllocations||{}); }
function resolvePokemonPokeEdgeStats({pokemon,species,detailsOverride=null,excludedEdgeInstances=[]}={}){
  const details=detailsOverride||pokemon?.details||{};
  const excluded=new Set((excludedEdgeInstances||[]).map(String));
  const edges=(Array.isArray(details.pokeEdges)?details.pokeEdges:[]).filter(e=>!excluded.has(String(e?.instanceId||'')));
  const base=normalizeBaseStats(species?.baseStats||species?.base_stats||details.baseStats||{});
  const baseBonus=emptyStatMap(); const bonusAllocation=emptyStatMap(); const applied=[]; const unresolved=[];
  const hasStrength=edges.some(e=>capabilityKey(e?.id||e?.name)==='underdogs-strength');
  if(hasStrength){
    for(const k of STAT_KEYS) baseBonus[k]+=1;
    applied.push({edgeId:'underdogs-strength',name:"Underdog's Strength",kind:'base_stat_bonus',stats:Object.fromEntries(STAT_KEYS.map(k=>[k,1]))});
  }
  for(const edge of edges){
    const id=capabilityKey(edge?.id||edge?.name);
    if(id!=='realized-potential' && id!=='mixed-sweeper') continue;
    const allocation=edgeStatAllocation(edge); const spent=STAT_KEYS.reduce((sum,k)=>sum+allocation[k],0);
    const storedExpected=edge?.statAllocationPoints==null?NaN:Number(edge.statAllocationPoints);
    // Realized Potential keys off the Species' canonical Base Stat Total.
    // Underdog's Strength modifies the Pokémon's Base Stats, but does not rewrite
    // the Species BST used to determine how many Realized Potential points are gained.
    const canonicalSpeciesBst=speciesBaseStatTotal(species);
    const expected=id==='realized-potential'?(Number.isFinite(storedExpected)&&storedExpected>=0?storedExpected:(spent>0?spent:Math.max(0,45-canonicalSpeciesBst))):3;
    if(spent!==expected){
      unresolved.push({instanceId:edge?.instanceId||null,edgeId:id,name:edge?.name||id,expected,spent});
      continue;
    }
    for(const k of STAT_KEYS) bonusAllocation[k]+=allocation[k];
    applied.push({edgeId:id,name:edge?.name||id,kind:'bonus_stat_allocation',stats:allocation,points:spent});
  }
  const modifiedBase=addStatMaps(base,baseBonus);
  const natureAdjusted=applyNature(modifiedBase,details.nature||'Hardy').stats;
  const levelAllocation=normalizeAllocations(details.statAllocations||{});
  const permanentFinal=addStatMaps(natureAdjusted,levelAllocation,bonusAllocation);
  const maxHp=Math.max(1,Number(pokemon?.level||1))+(Number(permanentFinal.hp||0)*3)+10;
  const exemptions=relationExemptionsFromPokeEdges(edges);
  const relationViolations=validateBaseRelations(natureAdjusted,permanentFinal,{exemptStats:exemptions});
  return {speciesBase:base,speciesBaseTotal:speciesBaseStatTotal(species),baseBonus,modifiedBase,natureAdjusted,levelAllocation,bonusAllocation,permanentFinal,maxHp,
    evolutionLocked:hasStrength,evolutionLockSource:hasStrength?"Underdog's Strength":null,applied,unresolved,baseRelations:{valid:relationViolations.length===0,violations:relationViolations,exemptStats:exemptions}};
}
function resolvePokemonSkills(species,details={}){
  const rawSkills=Array.isArray(species?.raw?.skills)?species.raw.skills:[];
  const skills=rawSkills.map(s=>({id:capabilityKey(s.skill),name:String(s.skill||''),dice:Number(s.dice||0),modifier:Number(s.modifier||0),defaultDice:Number(s.dice||0),defaultModifier:Number(s.modifier||0),pokeEdgeRanks:0})).filter(s=>s.id&&s.name);
  const byId=new Map(skills.map(s=>[s.id,s])); const applied=[];
  for(const edge of (Array.isArray(details.pokeEdges)?details.pokeEdges:[])){
    if(capabilityKey(edge?.id||edge?.name)!=='skill-improvement')continue;
    const target=capabilityKey(normalizeEdgeTarget(edge)); const rec=byId.get(target); if(!rec)continue;
    rec.dice+=1; rec.pokeEdgeRanks+=1; applied.push({edgeId:'skill-improvement',targetId:target,targetName:rec.name,value:1});
  }
  return {skills,applied};
}
function statAllocationTargetMeta(edge,species,details={}){
  const id=capabilityKey(edge?.id||edge?.name);
  if(id==='realized-potential'){
    const points=Math.max(0,45-speciesBaseStatTotal(species));
    return {allocationRequired:points>0,allocationPoints:points,allocationAllowedStats:[...STAT_KEYS],allocationLabel:'Bonus Stat Points'};
  }
  if(id==='mixed-sweeper') return {allocationRequired:true,allocationPoints:3,allocationAllowedStats:['hp','defense','special_defense','speed'],allocationLabel:'Mixed Sweeper Stat Points'};
  return {allocationRequired:false,allocationPoints:0,allocationAllowedStats:[],allocationLabel:null};
}

function applyPokeEdgeStatsToPreview({preview,pokemon,species,gmOverride=false,excludedEdgeInstances=[]}={}){
  if(!preview||!species)return preview;
  const originalDetails=pokemon?.details||{};
  const syntheticDetails={...JSON.parse(JSON.stringify(originalDetails)),nature:typeof preview.nature==='string'?preview.nature:(preview.nature?.name||originalDetails.nature||'Hardy'),statAllocations:{...(preview.statAllocations||originalDetails.statAllocations||{})},baseStats:{...(preview.baseStats||originalDetails.baseStats||{})},finalStats:{...(preview.finalStats||originalDetails.finalStats||{})}};
  const syntheticPokemon={...pokemon,level:Number(preview.targetLevel??preview.level??pokemon?.level??1),details:syntheticDetails};
  const edgeStats=resolvePokemonPokeEdgeStats({pokemon:syntheticPokemon,species,detailsOverride:syntheticDetails,excludedEdgeInstances});
  preview.resolvedStatEffects=edgeStats;
  preview.resolvedFinalStats={...edgeStats.permanentFinal};
  preview.resolvedMaxHp=edgeStats.maxHp;
  const edgeErrors=edgeStats.baseRelations.violations.map(v=>v.message);
  if(edgeErrors.length&&!gmOverride){
    preview.errors=[...new Set([...(preview.errors||[]),...edgeErrors])];
    preview.valid=false;
  }
  return preview;
}
function buildPokeEdgeTargetOptions({edge,pokemon,species,rulesetId}={}){
  const details=pokemon?.details||{};
  const edgeId=capabilityKey(edge?.id||edge?.name);
  const owned=(Array.isArray(details.pokeEdges)?details.pokeEdges:[]).filter(e=>capabilityKey(e?.id||e?.name)===edgeId);
  const used=new Set(owned.map(e=>capabilityKey(normalizeEdgeTarget(e))).filter(Boolean));
  if(edgeId==='advanced-mobility'){
    const resolved=resolvePokemonCapabilities(species,details).capabilities;
    return resolved.filter(c=>c?.kind==='movement').map(c=>({id:capabilityKey(c.capability_id||c.name),label:`${c.name} ${c.value??''}`.trim(),kind:'capability',currentValue:Number(c.value)||0})).filter(o=>!used.has(o.id));
  }
  if(edgeId==='capability-training'){
    const resolved=resolvePokemonCapabilities(species,details).capabilities;
    const options=[];
    const power=resolved.find(c=>capabilityKey(c.capability_id||c.name)==='power');
    if(power) options.push({id:'power',label:`Power ${power.value??0}`,kind:'capability',currentValue:Number(power.value)||0});
    const jump=resolved.find(c=>c?.kind==='jump'||capabilityKey(c?.name)==='jump');
    if(jump){
      options.push({id:'high-jump',label:`High Jump ${jump.high??0}`,kind:'capability',currentValue:Number(jump.high)||0});
      options.push({id:'long-jump',label:`Long Jump ${jump.long??0}`,kind:'capability',currentValue:Number(jump.long)||0});
    }
    return options.filter(o=>!used.has(o.id));
  }
  if(edgeId==='accuracy-training'){
    const moves=Array.isArray(details.moves)?details.moves:[];
    return moves.map(m=>{
      const id=capabilityKey(m.id||m.name); const def=id?definitions.getResolved({rulesetId,kind:'moves',id}):null;
      const ac=Number(def?.ac);
      return {id,label:`${m.name}${Number.isFinite(ac)?` · AC ${ac}`:''}`,kind:'move',moveName:m.name,baseAc:Number.isFinite(ac)?ac:null};
    }).filter(o=>o.id && o.baseAc!=null && o.baseAc>=3 && !used.has(o.id));
  }
  if(edgeId==='skill-improvement'){
    const resolved=resolvePokemonSkills(species,details);
    return resolved.skills.map(skill=>({
      id:skill.id,
      label:`${skill.name} · ${skill.dice}d6${skill.modifier>0?`+${skill.modifier}`:skill.modifier<0?skill.modifier:''} → ${skill.dice+1}d6${skill.modifier>0?`+${skill.modifier}`:skill.modifier<0?skill.modifier:''}`,
      kind:'skill',skillName:skill.name,currentDice:skill.dice,currentModifier:skill.modifier,defaultDice:skill.defaultDice,defaultModifier:skill.defaultModifier
    })).filter(o=>!used.has(o.id) && o.currentDice<=o.defaultDice);
  }
  return [];
}
function removeDerivedEffectsForRefund(details,removedEdge){
  const id=capabilityKey(removedEdge?.id||removedEdge?.name);
  if(id==='mixed-power'){
    const stillOwned=(details.pokeEdges||[]).some(e=>capabilityKey(e?.id||e?.name)==='mixed-power');
    if(!stillOwned){
      details.grantedAbilities=(details.grantedAbilities||[]).filter(a=>!(capabilityKey(typeof a==='string'?a:a?.name)==='twisted-power' && capabilityKey(a?.sourceId||'')==='mixed-power'));
    }
  }
  details.baseRelationExemptStats=relationExemptionsFromPokeEdges(details.pokeEdges||[]);
}
function nativeAbilitySlotsForSpecies(species,level){
  const native=eligibleAbilities(species?.abilities||species?.ability_slots||[]);
  return levelAbilitySlots(level).map((slot,index)=>({
    ...slot,index,
    options:native.filter(a=>slot.allowedCategories.includes(a.category)).map(a=>({name:a.name,category:a.category,slot:a.slot||null}))
  }));
}
function resolveCreatureAbilityRecords({pokemon,species,rulesetId,heldItemEffect=null}){
  const details=pokemon?.details||{};
  const records=[];
  const structured=Array.isArray(details.abilityRecords)?details.abilityRecords:[];
  const storedNames=Array.isArray(details.abilities)?details.abilities.filter(Boolean):[];
  const structuredNative=structured.filter(r=>['species_starting','level_choice','native_extra'].includes(String(r?.sourceKind||''))).map(r=>r?.name).filter(Boolean);
  const nativeNames=[...storedNames];
  for(const name of structuredNative) if(!nativeNames.some(x=>abilitySlug(x)===abilitySlug(name))) nativeNames.push(name);
  nativeNames.forEach((name,index)=>{
    const prior=structured.find(r=>abilitySlug(r?.name)===abilitySlug(name) && String(r?.sourceKind||'').startsWith('species')) || structured[index];
    const src=abilitySourceForIndex(index);
    records.push({
      name:String(name),sourceKind:prior?.sourceKind||src.kind,sourceLabel:prior?.sourceLabel||src.label,
      unlockLevel:prior?.unlockLevel??src.unlockLevel,selectedAtLevel:prior?.selectedAtLevel??src.unlockLevel,
      sourceId:prior?.sourceId||species?.id||null,sourceVersionId:prior?.sourceVersionId||species?.versionId||null,
      grantSource:null,index
    });
  });
  const granted=Array.isArray(details.grantedAbilities)?details.grantedAbilities:[];
  granted.forEach((entry,index)=>{
    const obj=typeof entry==='string'?{name:entry}:entry||{};
    if(!obj.name) return;
    records.push({name:String(obj.name),sourceKind:obj.source||'granted',sourceLabel:obj.sourceId==='mixed-power'?'Granted by Mixed Power':'Granted Ability',unlockLevel:null,selectedAtLevel:null,sourceId:obj.sourceId||null,sourceVersionId:obj.sourceVersionId||null,grantSource:obj,index:nativeNames.length+index});
  });
  const heldGranted=Array.isArray(heldItemEffect?.grantedAbilities)?heldItemEffect.grantedAbilities:[];
  heldGranted.forEach(name=>records.push({name:String(name),sourceKind:'held_item',sourceLabel:`Granted by ${heldItemEffect.name}`,unlockLevel:null,selectedAtLevel:null,sourceId:heldItemEffect.id,sourceVersionId:heldItemEffect.versionId||null,grantSource:{name:String(name),source:'held_item',sourceId:heldItemEffect.id}}));
  const hasMixed=(details.pokeEdges||[]).some(e=>abilitySlug(e?.id||e?.name)==='mixed-power');
  if(hasMixed && !records.some(r=>abilitySlug(r.name)==='twisted-power')){
    const edge=(details.pokeEdges||[]).find(e=>abilitySlug(e?.id||e?.name)==='mixed-power');
    const grant={name:'Twisted Power',source:'poke_edge',sourceId:'mixed-power',sourceVersionId:edge?.sourceVersionId||null,derived:true};
    records.push({name:'Twisted Power',sourceKind:'poke_edge',sourceLabel:'Granted by Mixed Power',unlockLevel:null,selectedAtLevel:null,sourceId:'mixed-power',sourceVersionId:edge?.sourceVersionId||null,grantSource:grant,index:records.length});
  }
  const merged=[]; const byId=new Map();
  for(const rec of records){
    const id=abilitySlug(rec.name); if(!id) continue;
    if(byId.has(id)){
      const existing=byId.get(id); existing.sources.push({...rec});
      if(rec.grantSource && !existing.grantSource) existing.grantSource=rec.grantSource;
      continue;
    }
    const definition=definitions.getResolved({rulesetId,kind:'abilities',id});
    const full={...rec,id,definition,sources:[{...rec}]}; byId.set(id,full); merged.push(full);
  }
  return merged;
}
function resolvedCreatureModel({pokemon,species,rulesetId,heldItemEffect=null,heldItemDefinition=null}){
  const details=pokemon?.details||{};
  const abilities=resolveCreatureAbilityRecords({pokemon,species,rulesetId,heldItemEffect});
  const edgeStats=resolvePokemonPokeEdgeStats({pokemon,species});
  const resolvedPokemon={...pokemon,details:{...details,finalStats:{...edgeStats.permanentFinal}}};
  const modifierSummary=getPokemonModifierSummary(resolvedPokemon,{heldItemEffect});
  const effectiveStats=applyHeldItemToEffectiveStats(edgeStats.permanentFinal,heldItemEffect);
  const capabilityResolution=resolvePokemonCapabilities(species,details);
  const skillResolution=resolvePokemonSkills(species,details);
  const accuracyTraining=Object.fromEntries(accuracyTrainingMap(details));
  return {
    pokemonId:pokemon?.id||null,speciesId:species?.id||null,level:Number(pokemon?.level||1),
    stats:{stored:{...(details.finalStats||{})},permanent:{...edgeStats.permanentFinal},effective:effectiveStats,breakdown:edgeStats},
    skills:skillResolution.skills,skillModifiers:skillResolution.applied,
    moveLimit:{base:Number(details.moveLimitBase??6),modifier:Number(details.moveLimitModifier??0),effective:Number(details.moveLimitEffective??6)},
    abilities,modifierSummary,
    capabilities:capabilityResolution.capabilities,capabilityModifiers:capabilityResolution.applied,accuracyTraining,
    heldItem:pokemon?.heldItem?{name:pokemon.heldItem,definition:heldItemDefinition,effect:heldItemEffect}:null,
    relationExemptions:edgeStats.baseRelations.exemptStats,
    evolutionLocked:edgeStats.evolutionLocked,evolutionLockSource:edgeStats.evolutionLockSource
  };
}

function json(res,status,data){res.status=status;res.data=data;return true;}
async function bodyJson(req){return req._body||{};}

async function handleApi(req,res,url){
  if((req.method==='POST' || req.method==='GET') && url.pathname==='/api/desktop/heartbeat'){
    lastDesktopHeartbeat=Date.now();
    desktopHeartbeatSeen=true;
    return json(res,200,{ok:true,desktopSession});
  }
  if(req.method==='GET' && url.pathname==='/api/health'){
    return json(res,200,{ok:true,version:'2.2.0-android-beta.22',persistence:'android-local',database:'app-data/content-packs + WebView local storage',schemaVersion:5,definitions:{database:'embedded mobile bundle + installed .ptucp overlays',activeRuleset:getActiveRuleset()}});
  }
  if(req.method==='GET' && url.pathname==='/api/rulesets'){
    const activeRulesetId=getActiveRuleset();
    return json(res,200,{activeRulesetId,rulesets:definitions.getRulesets().map(r=>({id:r.id,name:r.name,version:r.version,description:r.description}))});
  }
  if(req.method==='GET' && url.pathname==='/api/rulesets/active'){
    const id=getActiveRuleset();
    return json(res,200,{activeRulesetId:id,ruleset:definitions.getRuleset(id),counts:definitions.getCounts(id)});
  }
  if(req.method==='PUT' && url.pathname==='/api/rulesets/active'){
    const payload=await bodyJson(req);
    const id=String(payload.id||'');
    if(!definitions.getRuleset(id)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    db.prepare(`INSERT INTO app_meta(key,value) VALUES('active_ruleset_id',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(id);
    return json(res,200,{ok:true,activeRulesetId:id,ruleset:definitions.getRuleset(id),counts:definitions.getCounts(id)});
  }
  if(req.method==='GET' && url.pathname==='/api/content-packs'){
    const activeRulesetId=getActiveRuleset();
    const enabled=new Set((definitions.getRuleset(activeRulesetId)?.packs||[]).filter(p=>p.enabled).map(p=>String(p.pack_id)));
    return json(res,200,{activeRulesetId,packs:definitions.getPacks().map(p=>({...p,enabled:enabled.has(String(p.id)),imported:!!p.androidImported,removable:!!p.androidImported,builtIn:!p.androidImported,toggleable:!isProtectedBuiltInPack(p),locked:isProtectedBuiltInPack(p),requiredBy:installedRequiredDependents(p.id).map(x=>({id:x.id,name:x.name}))}))});
  }
  const packEnabledRoute=url.pathname.match(/^\/api\/content-packs\/([^/]+)\/enabled$/);
  if(req.method==='PUT' && packEnabledRoute){
    const payload=await bodyJson(req); const invoke=nativeInvoke();
    const packId=decodeURIComponent(packEnabledRoute[1]); const rulesetId=String(payload.rulesetId||getActiveRuleset()); const enabled=!!payload.enabled;
    const pack=definitions.getPacks().find(p=>String(p.id)===packId);
    if(!pack) throw Object.assign(new Error(`Content Pack is not installed: ${packId}`),{status:404});
    if(isProtectedBuiltInPack(pack)) throw Object.assign(new Error('The PTU Core pack is required by the application and cannot be disabled.'),{status:400});
    if(enabled){
      const missing=requiredDependenciesForPack(pack).filter(id=>!packEnabledInRuleset(id,rulesetId));
      if(missing.length) throw Object.assign(new Error(`Required pack(s) are disabled in this Ruleset: ${missing.join(', ')}`),{status:400});
    }else{
      const dependents=activeRequiredDependents(packId,rulesetId);
      if(dependents.length) throw Object.assign(new Error(`This pack is required by active pack(s): ${dependents.map(x=>x.name||x.id).join(', ')}`),{status:400});
    }
    if(pack.androidImported){
      if(!invoke) throw Object.assign(new Error('Native Android Content Pack management is unavailable in this runtime.'),{status:501});
      const updated=await invoke('set_content_pack_enabled',{packId,rulesetId,enabled});
      applyImportedPack(updated);
      return json(res,200,{ok:true,pack:{id:importedPackId(updated),name:importedPackName(updated),version:importedPackVersion(updated),enabled:packEnabledInRuleset(packId,rulesetId)},activeRulesetId:getActiveRuleset(),counts:definitions.getCounts(getActiveRuleset())});
    }
    if(!setBundledPackEnabled(packId,rulesetId,enabled)) throw Object.assign(new Error('This bundled pack is not part of the selected Ruleset.'),{status:400});
    return json(res,200,{ok:true,pack:{id:pack.id,name:pack.name,version:pack.version,enabled:packEnabledInRuleset(packId,rulesetId)},activeRulesetId:getActiveRuleset(),counts:definitions.getCounts(getActiveRuleset())});
  }
  const packDeleteRoute=url.pathname.match(/^\/api\/content-packs\/([^/]+)$/);
  if(req.method==='DELETE' && packDeleteRoute){
    const invoke=nativeInvoke(); if(!invoke) throw Object.assign(new Error('Native Android Content Pack management is unavailable in this runtime.'),{status:501});
    const packId=decodeURIComponent(packDeleteRoute[1]); const pack=definitions.getPacks().find(p=>String(p.id)===packId);
    if(!pack) throw Object.assign(new Error(`Content Pack is not installed: ${packId}`),{status:404});
    if(!pack.androidImported) throw Object.assign(new Error('Bundled Android Content Packs cannot be uninstalled.'),{status:400});
    const dependents=installedRequiredDependents(packId);
    if(dependents.length) throw Object.assign(new Error(`This pack is required by installed pack(s): ${dependents.map(x=>x.name||x.id).join(', ')}`),{status:400});
    const result=await invoke('uninstall_content_pack',{packId});
    removeImportedPackAndRecompute(packId);
    return json(res,200,{ok:true,result,activeRulesetId:getActiveRuleset(),counts:definitions.getCounts(getActiveRuleset())});
  }
  if(req.method==='POST' && url.pathname==='/api/content-packs/import'){
    const payload=await bodyJson(req); const invoke=nativeInvoke();
    if(!invoke) throw Object.assign(new Error('Native Android content-pack import is unavailable in this runtime.'),{status:501});
    const archiveB64=String(payload.archiveB64||''); const archiveFilename=String(payload.archiveFilename||'import.ptucp');
    if(!archiveB64) throw Object.assign(new Error('No .ptucp archive was received.'),{status:400});
    const enableRulesetId=String(payload.enableRulesetId||getActiveRuleset());
    const availablePackIds=definitions.getPacks().map(p=>String(p.id));
    const pack=await invoke('import_content_pack',{archiveB64,archiveFilename,enableRulesetId,availablePackIds});
    applyImportedPack(pack);
    return json(res,200,{ok:true,pack:{id:importedPackId(pack),name:importedPackName(pack),version:importedPackVersion(pack),counts:pack.counts||{},warnings:pack.warnings||[],archiveSha256:pack.archiveSha256||null,enabled:packEnabledInRuleset(importedPackId(pack),enableRulesetId)},activeRulesetId:getActiveRuleset(),counts:definitions.getCounts(getActiveRuleset())});
  }
  if(req.method==='GET' && url.pathname==='/api/definitions/status'){
    const id=getActiveRuleset();
    return json(res,200,{ok:true,activeRulesetId:id,ruleset:definitions.getRuleset(id),counts:definitions.getCounts(id),kinds:[...ALLOWED_KINDS]});
  }
  if(req.method==='GET' && url.pathname==='/api/definitions'){
    const kind=String(url.searchParams.get('kind')||'species');
    const rulesetId=String(url.searchParams.get('ruleset')||getActiveRuleset());
    const q=String(url.searchParams.get('q')||'');
    const limit=Number(url.searchParams.get('limit')||60);
    const offset=Number(url.searchParams.get('offset')||0);
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const rows=definitions.listResolved({rulesetId,kind,q,limit,offset});
    const total=definitions.countResolved({rulesetId,kind,q});
    return json(res,200,{rulesetId,kind,q,total,rows});
  }
  if(req.method==='GET' && url.pathname==='/api/items/catalog'){
    const rulesetId=String(url.searchParams.get('ruleset')||getActiveRuleset());
    const q=String(url.searchParams.get('q')||'').trim();
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const total=definitions.countResolved({rulesetId,kind:'items',q});
    const summaries=[];
    for(let offset=0; offset<total; offset+=200) summaries.push(...definitions.listResolved({rulesetId,kind:'items',q,limit:200,offset}));
    const items=summaries.map(summary=>inventoryItemFromDefinition(definitions.getResolved({rulesetId,kind:'items',id:summary.id})));
    return json(res,200,{rulesetId,total,items});
  }
  const defMatch=url.pathname.match(/^\/api\/definitions\/([a-z_]+)\/([^/]+)$/);
  if(req.method==='GET' && defMatch){
    const kind=decodeURIComponent(defMatch[1]);
    const id=decodeURIComponent(defMatch[2]);
    const rulesetId=String(url.searchParams.get('ruleset')||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const definition=definitions.getResolved({rulesetId,kind,id});
    if(!definition) return json(res,404,{error:'Definition not found in active ruleset'});
    return json(res,200,{rulesetId,definition,versions:definitions.getVersions({kind,id})});
  }
  const dbMatch=url.pathname.match(/^\/api\/damage-base\/(\d+)$/);
  if(req.method==='GET' && dbMatch){
    const row=definitions.getDamageBase(Number(dbMatch[1]));
    return row?json(res,200,row):json(res,404,{error:'Damage Base not found'});
  }
  const portraitMatch=url.pathname.match(/^\/api\/pokemon\/portrait\/([^/]+)$/);
  if(req.method==='GET' && portraitMatch) return json(res,200,{mobilePortrait:true});
  if(req.method==='GET' && url.pathname==='/api/pokemon/natures'){
    return json(res,200,{natures:NATURES});
  }
  if(req.method==='GET' && url.pathname==='/api/pokemon/evolution-guidance'){
    return json(res,200,definitions.getEvolutionGuidance());
  }
  if(req.method==='POST' && url.pathname==='/api/pokemon/build-preview'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const speciesId=String(payload.speciesId||'');
    const species=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!species) return json(res,404,{error:'Species definition not found in active ruleset'});
    const incomingEvolution=definitions.getIncomingEvolution({speciesName:species.name,sourceId:species.sourceId});
    const preEvolutionSpecies=definitions.getEvolutionAncestry({rulesetId,speciesName:species.name,sourceId:species.sourceId});
    const allocations=payload.autoAllocate
      ? autoBalancedAllocations({baseStats:species.baseStats,nature:payload.nature,level:payload.level})
      : payload.allocations;
    let preview=buildPokemonPreview({
      species,level:payload.level,nature:payload.nature,allocations,
      selectedAbilities:payload.selectedAbilities,selectedMoves:payload.autoSelectMoves?[]:payload.selectedMoves,
      incomingEvolution,preEvolutionSpecies,gmMoves:payload.gmMoves,
      moveLimitModifier:payload.moveLimitModifier,gmOverride:payload.gmOverride
    });
    if(payload.autoSelectMoves){
      preview=buildPokemonPreview({
        species,level:payload.level,nature:payload.nature,allocations,
        selectedAbilities:payload.selectedAbilities,selectedMoves:preview.defaultMoves,
        incomingEvolution,preEvolutionSpecies,gmMoves:payload.gmMoves,
        moveLimitModifier:payload.moveLimitModifier,gmOverride:payload.gmOverride
      });
    }
    return json(res,200,{rulesetId,species:{id:species.id,name:species.name,types:species.types||[],versionId:species.versionId,contentPackId:species.contentPackId,sourceId:species.sourceId},experience:definitions.getPokemonExperience(preview.level),preview});
  }
  if(req.method==='GET' && url.pathname==='/api/pokemon/experience'){
    const level=Math.max(1,Math.min(100,Number(url.searchParams.get('level')||1)));
    const row=definitions.getPokemonExperience(level);
    const next=level<100?definitions.getPokemonExperience(level+1):null;
    return json(res,200,{level,row,next});
  }
  if(req.method==='POST' && url.pathname==='/api/pokemon/progression-preview'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const pokemon=payload.pokemon||{}; const details=pokemon.details||{};
    const speciesId=String(details.speciesDefinitionId||payload.speciesId||'');
    const species=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!species) return json(res,404,{error:'Current Species definition not found in active ruleset'});
    const evolutions=definitions.getOutgoingEvolutions({rulesetId,speciesName:species.name,sourceId:species.sourceId});
    let selectedEvolution=null;
    if(payload.evolutionSpeciesId){
      selectedEvolution=evolutions.find(e=>e.target.id===String(payload.evolutionSpeciesId));
      if(!selectedEvolution) return json(res,400,{error:'Selected evolution is not an outgoing evolution from the current Species'});
    }
    const experienceTable=definitions.getPokemonExperienceTable();
    const preview=buildPokemonProgressionPreview({
      pokemon,species,experienceTable,expGain:payload.expGain,targetLevel:payload.targetLevel,newStatAllocations:payload.newStatAllocations,
      selectedAbilities:payload.selectedAbilities,selectedMoves:payload.selectedMoves,
      evolutionTarget:selectedEvolution?.target||null,evolutionEdge:selectedEvolution||null,evolutionAllocations:payload.evolutionAllocations,
      manualEvolutionCondition:!!payload.manualEvolutionCondition,gmOverride:!!payload.gmOverride,
      baseRelationExemptStats:relationExemptionsFromPokeEdges(details.pokeEdges||[])
    });
    const strengthOwned=(details.pokeEdges||[]).some(e=>capabilityKey(e?.id||e?.name)==='underdogs-strength');
    if(selectedEvolution&&strengthOwned&&!payload.gmOverride){
      preview.errors=[...new Set([...(preview.errors||[]),"Underdog's Strength prevents this Pokémon from evolving."])];
      preview.valid=false;
    }
    const removedForEvolution=[];
    if(selectedEvolution && speciesBaseStatTotal(selectedEvolution.target)>=45){
      for(const edge of (details.pokeEdges||[])) if(capabilityKey(edge?.id||edge?.name)==='realized-potential') removedForEvolution.push(edge);
    }
    const targetSpecies=selectedEvolution?.target||species;
    applyPokeEdgeStatsToPreview({preview,pokemon,species:targetSpecies,gmOverride:!!payload.gmOverride,excludedEdgeInstances:removedForEvolution.map(e=>e.instanceId).filter(Boolean)});
    preview.pokeEdgeChanges={
      remove:removedForEvolution.map(e=>({instanceId:e.instanceId||null,id:e.id,name:e.name,cost:Number(e.cost||0),reason:'Evolved to a Species with Base Stat Total 45 or higher.'})),
      tutorPointRefund:removedForEvolution.reduce((sum,e)=>sum+Number(e.cost||0),0)
    };
    const candidates=evolutions.map(e=>({
      ...e,levelEligible:e.toMinLevel==null||preview.targetLevel>=Number(e.toMinLevel),
      manualConditionRequired:!!(e.conditionText && !/^minimum\s+\d+$/i.test(String(e.conditionText).trim())),
      blockedByPokeEdge:strengthOwned?"Underdog's Strength":null
    }));
    return json(res,200,{rulesetId,currentSpecies:{id:species.id,name:species.name,types:species.types||[],versionId:species.versionId,contentPackId:species.contentPackId,sourceId:species.sourceId},evolutionCandidates:candidates,preview});
  }

  if(req.method==='POST' && url.pathname==='/api/trainer/reference-data'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const trainer=payload.trainer||{};
    const resolvedTrainer=resolveTrainerModel({
      trainer,rulesetId,
      getDefinition:args=>definitions.getResolved(args),
      getDamageBase:db=>definitions.getDamageBase(db)
    });
    return json(res,200,{rulesetId,resolvedTrainer});
  }

  if(req.method==='POST' && url.pathname==='/api/trainer/progression-preview'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const preview=previewTrainerProgression({
      trainer:payload.trainer||{},draft:payload.draft||{},rulesetId,gmOverride:!!payload.gmOverride,includeOptions:payload.includeOptions!==false,
      getDefinition:args=>definitions.getResolved(args),
      listDefinitions:args=>definitions.listResolved(args),
      getDamageBase:db=>definitions.getDamageBase(db)
    });
    return json(res,200,{rulesetId,preview});
  }

  if(req.method==='POST' && url.pathname==='/api/trainer/progression-apply'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const trainer=payload.trainer||{}, draft=payload.draft||{};
    const preview=previewTrainerProgression({
      trainer,draft,rulesetId,gmOverride:!!payload.gmOverride,includeOptions:false,
      getDefinition:args=>definitions.getResolved(args),
      listDefinitions:args=>definitions.listResolved(args),
      getDamageBase:db=>definitions.getDamageBase(db)
    });
    if(!preview.valid) return json(res,400,{error:'Trainer progression is not valid.',preview});
    const updatedTrainer=applyTrainerProgression({trainer,draft,preview,getDefinition:args=>definitions.getResolved(args),rulesetId});
    const resolvedTrainer=resolveTrainerModel({trainer:updatedTrainer,rulesetId,getDefinition:args=>definitions.getResolved(args),getDamageBase:db=>definitions.getDamageBase(db)});
    return json(res,200,{rulesetId,updatedTrainer,resolvedTrainer,preview:{...preview,projectedTrainer:undefined,resolvedTrainer:undefined,optionSets:undefined}});
  }

  if(req.method==='POST' && url.pathname==='/api/trainer/xp-purchase'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const trainer=payload.trainer||{};
    const kind=String(payload.kind||''); const id=String(payload.id||''); const selections=payload.selections||{};
    const preview=previewTrainerXpPurchase({
      trainer,kind,id,selections,manualConfirm:!!payload.manualConfirm,rulesetId,gmOverride:!!payload.gmOverride,
      getDefinition:args=>definitions.getResolved(args),
      getDamageBase:db=>definitions.getDamageBase(db)
    });
    if(!preview.valid) return json(res,400,{error:'Trainer XP purchase is not valid.',preview});
    const updatedTrainer=applyTrainerXpPurchase({trainer,kind,id,selections,preview,getDefinition:args=>definitions.getResolved(args),rulesetId});
    const resolvedTrainer=resolveTrainerModel({trainer:updatedTrainer,rulesetId,getDefinition:args=>definitions.getResolved(args),getDamageBase:db=>definitions.getDamageBase(db)});
    return json(res,200,{rulesetId,updatedTrainer,resolvedTrainer,preview});
  }

  if(req.method==='POST' && url.pathname==='/api/pokemon/reference-data'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const pokemon=payload.pokemon||{}; const details=pokemon.details||{};
    const speciesId=String(details.speciesDefinitionId||payload.speciesId||'');
    const species=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!species) return json(res,404,{error:'Current Species definition not found in active ruleset'});
    const slug=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const speciesTypes=species.types||pokemon.types||[];
    const held=resolvePokemonHeldItem({rulesetId,pokemon,species});
    const edgeStats=resolvePokemonPokeEdgeStats({pokemon,species});
    const resolvedPokemonForCombat={...pokemon,details:{...details,finalStats:{...edgeStats.permanentFinal}}};
    const accuracyMap=accuracyTrainingMap(details);
    const moves=(Array.isArray(details.moves)?details.moves:[]).map(m=>{
      const id=slug(m.id||m.name); const definition=id?definitions.getResolved({rulesetId,kind:'moves',id}):null;
      const resolvedDamage=definition?resolveMoveDamage({pokemon:resolvedPokemonForCombat,moveDefinition:definition,speciesTypes,getDamageBase:db=>definitions.getDamageBase(db),heldItemEffect:held.effect}):null;
      const accuracyTrainingRanks=accuracyMap.get(id)||0;
      const baseAc=definition?.ac==null?null:Number(definition.ac);
      const effectiveAc=baseAc==null||!Number.isFinite(baseAc)?baseAc:Math.max(0,baseAc-accuracyTrainingRanks);
      return {record:m,definition,resolvedDamage,accuracyTrainingRanks,effectiveAc};
    });
    const abilities=resolveCreatureAbilityRecords({pokemon,species,rulesetId,heldItemEffect:held.effect});
    const abilitySlots=nativeAbilitySlotsForSpecies(species,pokemon.level);
    const nativeSelected=[...(Array.isArray(details.abilities)?details.abilities.filter(Boolean):[])];
    for(const rec of (Array.isArray(details.abilityRecords)?details.abilityRecords:[])) if(['species_starting','level_choice','native_extra'].includes(String(rec?.sourceKind||'')) && rec?.name && !nativeSelected.some(x=>abilitySlug(x)===abilitySlug(rec.name))) nativeSelected.push(rec.name);
    const abilitySlotStatus={expected:abilitySlots.length,selected:nativeSelected.length,unresolved:abilitySlots.slice(nativeSelected.length).map(s=>({label:s.label,unlockLevel:s.unlockLevel}))};
    const outgoing=definitions.getOutgoingEvolutions({rulesetId,speciesName:species.name,sourceId:species.sourceId});
    const incoming=definitions.getIncomingEvolution({speciesName:species.name,sourceId:species.sourceId});
    const typeProfile=applyHeldItemToTypeProfile(definitions.getDefensiveTypeProfile(speciesTypes),held.effect);
    return json(res,200,{rulesetId,species,moves,abilities,abilitySlots,abilitySlotStatus,resolvedCreature:resolvedCreatureModel({pokemon,species,rulesetId,heldItemEffect:held.effect,heldItemDefinition:held.definition}),modifierSummary:getPokemonModifierSummary(resolvedPokemonForCombat,{heldItemEffect:held.effect}),heldItem:{definition:held.definition,effect:held.effect},typeProfile,incomingEvolution:incoming||null,outgoingEvolutions:outgoing});
  }

  if(req.method==='POST' && url.pathname==='/api/pokemon/ability-correction-preview'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const pokemon=payload.pokemon||{}; const details=structuredClone(pokemon.details||{});
    const speciesId=String(details.speciesDefinitionId||payload.speciesId||'');
    const species=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!species) return json(res,404,{error:'Current Species definition not found in active ruleset'});
    const slots=nativeAbilitySlotsForSpecies(species,pokemon.level);
    const selected=Array.isArray(payload.selectedAbilities)?payload.selectedAbilities.map(String):[];
    const errors=[];
    for(let i=0;i<slots.length;i++){
      const value=String(selected[i]||'').trim();
      if(!value){errors.push(`${slots[i].label} must be selected.`); continue;}
      const allowed=slots[i].options.some(o=>abilitySlug(o.name)===abilitySlug(value));
      if(!allowed && !payload.gmOverride) errors.push(`${value} is not valid for ${slots[i].label}.`);
    }
    if(selected.length>slots.length && !payload.gmOverride) errors.push(`Only ${slots.length} native Ability slot${slots.length===1?' is':'s are'} unlocked at Level ${pokemon.level}.`);
    if(errors.length) return json(res,200,{valid:false,errors,abilitySlots:slots});
    details.abilities=selected.slice(0,Math.max(slots.length,selected.length)).filter(Boolean);
    details.ability=details.abilities[0]||'';
    details.abilityRecords=details.abilities.map((name,index)=>{
      const src=abilitySourceForIndex(index);
      return {name,sourceKind:src.kind,sourceLabel:src.label,unlockLevel:src.unlockLevel,selectedAtLevel:Number(pokemon.level||1),sourceId:species.id,sourceVersionId:species.versionId};
    });
    details.abilityCorrectionHistory=Array.isArray(details.abilityCorrectionHistory)?details.abilityCorrectionHistory:[];
    details.abilityCorrectionHistory.push({date:new Date().toISOString(),level:Number(pokemon.level||1),abilities:[...details.abilities],gmOverride:!!payload.gmOverride});
    const correctedPokemon={...pokemon,details};
    return json(res,200,{valid:true,details,abilitySlots:slots,abilities:resolveCreatureAbilityRecords({pokemon:correctedPokemon,species,rulesetId})});
  }


  if(req.method==='POST' && url.pathname==='/api/pokemon/held-item-options'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    const pokemon=payload.pokemon||{}; const details=pokemon.details||{};
    const speciesId=String(details.speciesDefinitionId||payload.speciesId||'');
    const species=speciesId?definitions.getResolved({rulesetId,kind:'species',id:speciesId}):null;
    const outgoing=species?definitions.getOutgoingEvolutions({rulesetId,speciesName:species.name,sourceId:species.sourceId}):[];
    const inventory=Array.isArray(payload.inventory)?payload.inventory:[];
    const items=[];
    for(const inv of inventory){
      if(Number(inv.qty||0)<=0) continue;
      const definition=resolveHeldItemDefinition({rulesetId,inventoryItem:inv});
      if(!definition || !definition.raw?.pokemon_held_usable) continue;
      const effect=resolveHeldItemEffect({itemDefinition:definition,config:{},pokemon,hasOutgoingEvolution:outgoing.length>0});
      items.push({inventoryId:inv.id,name:inv.name,qty:Number(inv.qty||0),icon:inv.icon||'◆',definition,effect:{...effect,valid:effect.requiresConfig?.length?true:effect.valid,errors:effect.requiresConfig?.length?[]:effect.errors}});
    }
    const current=resolvePokemonHeldItem({rulesetId,pokemon,species});
    return json(res,200,{rulesetId,items,current:{name:pokemon.heldItem||null,definition:current.definition,effect:current.effect}});
  }
  if(req.method==='POST' && url.pathname==='/api/pokemon/held-item-preview'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    const pokemon=payload.pokemon||{}; const details=pokemon.details||{};
    const speciesId=String(details.speciesDefinitionId||payload.speciesId||'');
    const species=speciesId?definitions.getResolved({rulesetId,kind:'species',id:speciesId}):null;
    const inv=payload.inventoryItem||{};
    const definition=resolveHeldItemDefinition({rulesetId,inventoryItem:inv});
    if(!definition || !definition.raw?.pokemon_held_usable) return json(res,400,{valid:false,errors:['This backpack item is not resolved as a Pokémon Held Item in the active Ruleset.']});
    const outgoing=species?definitions.getOutgoingEvolutions({rulesetId,speciesName:species.name,sourceId:species.sourceId}):[];
    const effect=resolveHeldItemEffect({itemDefinition:definition,config:payload.config||{},pokemon,hasOutgoingEvolution:outgoing.length>0});
    return json(res,200,{valid:!!effect.valid,errors:effect.errors||[],warnings:effect.warnings||[],definition,effect});
  }

  if(req.method==='POST' && url.pathname==='/api/pokemon/restat-preview'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const pokemon=payload.pokemon||{}; const details=pokemon.details||{};
    const speciesId=String(details.speciesDefinitionId||payload.speciesId||'');
    const species=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!species) return json(res,404,{error:'Current Species definition not found in active ruleset'});
    const preview=buildPokemonRestatPreview({pokemon,species,allocations:payload.allocations,gmOverride:!!payload.gmOverride,baseRelationExemptStats:relationExemptionsFromPokeEdges(details.pokeEdges||[])});
    applyPokeEdgeStatsToPreview({preview,pokemon,species,gmOverride:!!payload.gmOverride});
    return json(res,200,{rulesetId,species:{id:species.id,name:species.name,types:species.types||[]},preview});
  }

  if(req.method==='POST' && url.pathname==='/api/pokemon/training-options'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const pokemon=payload.pokemon||{}; const details=pokemon.details||{};
    const speciesId=String(details.speciesDefinitionId||payload.speciesId||'');
    const species=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!species) return json(res,404,{error:'Current Species definition not found in active ruleset'});
    const ruleset=definitions.getRuleset(rulesetId);
    const september2015Enabled=!!ruleset?.packs?.some(p=>p.enabled && p.pack_id==='ptu-september-2015-playtest');
    const earned=Number(details.tutorPointsEarned??0); const spent=Number(details.tutorPointsSpent??0); const remaining=Math.max(0,earned-spent);
    const knownMoves=Array.isArray(details.moves)?details.moves:[];
    const poolLimit=Math.max(0,Number(details.tutorMovePoolLimit??3));
    const poolUsed=moveTrainingPoolUsage(knownMoves);
    const levelUpIds=new Set((species.levelUpMoves||[]).map(m=>String(m.move_id||m.move||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')));
    const resolveMove=(record,method)=>{
      const id=String(record.move_id||record.id||record.move||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      const def=id?definitions.getResolved({rulesetId,kind:'moves',id}):null;
      const natural=method==='tutor' && isNaturalTutorMove(species,record.move||def?.name||id);
      const countsAsNatural=natural || levelUpIds.has(id);
      const tutorRestriction=(method==='tutor'||method==='egg_tutor')?tutorRestrictionForMove({level:pokemon.level,move:def,september2015Enabled}):{applies:false,valid:true,message:null};
      const cost=method==='tm_hm'?1:(natural?1:2);
      return {id,name:record.move||def?.name||id,method,code:record.code||null,naturalTutor:natural,countsAsNatural,cost,
        countsAgainstTutorPool:!countsAsNatural,type:def?.type||null,frequency:def?.frequency||null,damageBase:def?.damageBase??null,
        tutorRestriction,alreadyKnown:knownMoves.some(m=>String(m.id||m.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')===id)};
    };
    const moveTeaching={
      tm_hm:(species.tmMoves||[]).map(m=>resolveMove(m,'tm_hm')),
      tutor:(species.tutorMoves||[]).map(m=>resolveMove(m,'tutor')),
      egg_tutor:(species.eggMoves||[]).map(m=>resolveMove(m,'egg_tutor'))
    };
    const edgeRows=definitions.listResolved({rulesetId,kind:'poke_edges',q:'',limit:200,offset:0});
    const owned=Array.isArray(details.pokeEdges)?details.pokeEdges:[];
    const abilityKeywordLookup=(abilityName,keyword)=>{
      const slug=String(abilityName||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      const ability=definitions.getResolved({rulesetId,kind:'abilities',id:slug});
      const text=`${ability?.effect||''} ${ability?.rawText||''}`.toLowerCase();
      return text.includes(String(keyword||'').toLowerCase());
    };
    const edges=edgeRows.map(summary=>{
      const edge=definitions.getResolved({rulesetId,kind:'poke_edges',id:summary.id});
      const previous=owned.filter(x=>x.id===edge.id); const nextRank=previous.length+1;
      const repeatable=/may be taken multiple times|may be taken up to|\[ranked/i.test(`${edge.effect||''} ${edge.rawText||''}`) || !!edge.prerequisiteSemantics?.rank_asts?.length;
      const maxRank=edge.prerequisiteSemantics?.rank_asts?.length||(/up to three times/i.test(edge.effect||'')?3:(repeatable?99:1));
      const prereq=evaluatePokeEdgePrerequisite(edge,{level:pokemon.level,capabilities:species.capabilities||[],abilities:details.abilities||[],abilityKeywordLookup,rank:nextRank,ownedPokeEdges:owned,statAllocations:details.statAllocations||{}});
      const cost=parseTutorPointCost(edge.raw?.cost_text||edge.raw?.cost||'') || parseTutorPointCost(edge.rawText||'') || 1;
      const exhausted=previous.length>=maxRank;
      const targetOptions=buildPokeEdgeTargetOptions({edge,pokemon,species,rulesetId});
      const edgeKey=capabilityKey(edge.id);
      const targetRequired=['advanced-mobility','capability-training','accuracy-training','skill-improvement'].includes(edgeKey);
      const targetKind=edgeKey==='accuracy-training'?'move':edgeKey==='skill-improvement'?'skill':targetRequired?'capability':null;
      const allocationMeta=statAllocationTargetMeta(edge,species,details);
      return {id:edge.id,name:edge.name,cost,prerequisites:edge.prerequisites||edge.raw?.prerequisites_text||null,effect:edge.effect||edge.raw?.effect_text||null,
        sourceId:edge.sourceId,sourcePage:edge.sourcePage,automationLevel:edge.semanticAutomation?.level||'manual_text',prerequisite:prereq,
        ownedCount:previous.length,nextRank,maxRank,repeatable,exhausted,affordable:remaining>=cost,requiresUnderdog:pokeEdgeRequiresUnderdog(edge),isUnderdog:isUnderdogPokemon(species.capabilities||[]),
        targetRequired,targetKind,targetOptions,...allocationMeta};
    });
    const mixedPower=getMixedPowerPokeEdge(rulesetId);
    if(mixedPower){
      const previous=owned.filter(x=>x.id==='mixed-power');
      const prereq=evaluatePokeEdgePrerequisite(mixedPower,{level:pokemon.level,capabilities:species.capabilities||[],abilities:details.abilities||[],ownedPokeEdges:owned,statAllocations:details.statAllocations||{}});
      edges.push({id:'mixed-power',name:'Mixed Power',cost:2,prerequisites:mixedPower.prerequisites,effect:mixedPower.effect,sourceId:'sep2015',sourcePage:mixedPower.sourcePage,automationLevel:'machine_ready',prerequisite:prereq,ownedCount:previous.length,nextRank:1,maxRank:1,repeatable:false,exhausted:previous.length>=1,affordable:remaining>=2,requiresUnderdog:false,isUnderdog:isUnderdogPokemon(species.capabilities||[]),grantsAbility:'Twisted Power',targetRequired:false,targetOptions:[]});
    }
    return json(res,200,{rulesetId,species:{id:species.id,name:species.name,types:species.types||[]},tutorPoints:{earned,spent,remaining},
      tutorMovePool:{used:poolUsed,limit:poolLimit,remaining:Math.max(0,poolLimit-poolUsed)},september2015TutorRestrictions:september2015Enabled,
      edges,moveTeaching});
  }
  if(req.method==='POST' && url.pathname==='/api/pokemon/training-action-preview'){
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    if(!definitions.getRuleset(rulesetId)) throw Object.assign(new Error('Unknown ruleset'),{status:400});
    const pokemon=payload.pokemon||{}; const details=JSON.parse(JSON.stringify(pokemon.details||{}));
    const speciesId=String(details.speciesDefinitionId||payload.speciesId||'');
    const species=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!species) return json(res,404,{error:'Current Species definition not found in active ruleset'});
    details.moves=Array.isArray(details.moves)?details.moves:[]; details.pokeEdges=Array.isArray(details.pokeEdges)?details.pokeEdges:[];
    details.grantedAbilities=Array.isArray(details.grantedAbilities)?details.grantedAbilities:[];
    details.trainingHistory=Array.isArray(details.trainingHistory)?details.trainingHistory:[];
    const owned=details.pokeEdges;
    const earned=Number(details.tutorPointsEarned??0); const spent=Number(details.tutorPointsSpent??0); let remaining=Math.max(0,earned-spent);
    const errors=[]; let cost=0; let resultRecord=null;
    if(payload.action==='acquire_edge'){
      const requestedEdgeId=String(payload.edgeId||'');
      const edge=requestedEdgeId==='mixed-power'?getMixedPowerPokeEdge(rulesetId):definitions.getResolved({rulesetId,kind:'poke_edges',id:requestedEdgeId});
      if(!edge) errors.push('Poké Edge is not available in the active Ruleset.');
      else{
        const previous=details.pokeEdges.filter(x=>x.id===edge.id); const nextRank=previous.length+1;
        const repeatable=/may be taken multiple times|may be taken up to|\[ranked/i.test(`${edge.effect||''} ${edge.rawText||''}`) || !!edge.prerequisiteSemantics?.rank_asts?.length;
        const maxRank=edge.prerequisiteSemantics?.rank_asts?.length||(/up to three times/i.test(edge.effect||'')?3:(repeatable?99:1));
        if(previous.length>=maxRank) errors.push(`${edge.name} cannot be taken another time.`);
        const abilityKeywordLookup=(abilityName,keyword)=>{ const slug=String(abilityName||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); const a=definitions.getResolved({rulesetId,kind:'abilities',id:slug}); return `${a?.effect||''} ${a?.rawText||''}`.toLowerCase().includes(String(keyword||'').toLowerCase()); };
        const prereq=evaluatePokeEdgePrerequisite(edge,{level:pokemon.level,capabilities:species.capabilities||[],abilities:details.abilities||[],abilityKeywordLookup,rank:nextRank,ownedPokeEdges:owned,statAllocations:details.statAllocations||{}});
        if(prereq.valid===false && !payload.gmOverride) errors.push(...prereq.reasons);
        if(prereq.valid==null && !payload.manualConfirm && !payload.gmOverride) errors.push('This Poké Edge has a prerequisite that requires manual confirmation.');
        cost=edge.id==='mixed-power'?2:(parseTutorPointCost(edge.raw?.cost_text||edge.rawText||'')||1);
        if(remaining<cost && !payload.freeGrant) errors.push(`Requires ${cost} Tutor Point${cost===1?'':'s'}; only ${remaining} remain.`);
        let targetStat=null; let targetId=''; let targetLabel=''; let targetKind=null; let statAllocation=null;
        const edgeKey=capabilityKey(edge.id);
        if(String(edge.id).toLowerCase()==='attack-conflict'){
          const raw=String(payload.targetStat||payload.targetNote||'').trim().toLowerCase();
          if(raw==='attack'||raw==='atk') targetStat='attack';
          else if(['special_attack','special attack','sp attack','sp. attack','spatk'].includes(raw)) targetStat='special_attack';
          else errors.push('Attack Conflict must be permanently linked to Attack or Special Attack.');
          if(details.pokeEdges.some(x=>x.id==='attack-conflict')) errors.push('Attack Conflict is already owned.');
          targetId=targetStat||''; targetLabel=targetStat?(targetStat==='attack'?'Attack':'Special Attack'):''; targetKind='stat';
        } else if(['advanced-mobility','capability-training','accuracy-training','skill-improvement'].includes(edgeKey)){
          const options=buildPokeEdgeTargetOptions({edge,pokemon:{...pokemon,details},species,rulesetId});
          targetId=capabilityKey(payload.targetId||payload.targetNote||'');
          const selected=options.find(o=>o.id===targetId);
          const targetName=edgeKey==='accuracy-training'?'Move':edgeKey==='skill-improvement'?'Skill':'Capability';
          if(!selected) errors.push(`${edge.name} requires a valid unused ${targetName} target.`);
          else { targetLabel=selected.label; targetKind=selected.kind; }
        } else {
          targetId=String(payload.targetId||'').trim(); targetLabel=String(payload.targetNote||targetId||'').trim(); targetKind=payload.targetKind||null;
        }
        const allocationMeta=statAllocationTargetMeta(edge,species,details);
        if(allocationMeta.allocationRequired){
          statAllocation=normalizeAllocations(payload.statAllocation||{});
          const spentAllocation=STAT_KEYS.reduce((sum,k)=>sum+Number(statAllocation[k]||0),0);
          if(spentAllocation!==allocationMeta.allocationPoints) errors.push(`${edge.name} requires exactly ${allocationMeta.allocationPoints} Stat Point${allocationMeta.allocationPoints===1?'':'s'} to be allocated (currently ${spentAllocation}).`);
          const allowed=new Set(allocationMeta.allocationAllowedStats||[]);
          for(const k of STAT_KEYS) if(Number(statAllocation[k]||0)>0 && !allowed.has(k)) errors.push(`${edge.name} cannot allocate points to ${k}.`);
        }
        if(!errors.length){
          const targetNote=targetLabel || (targetStat?(targetStat==='attack'?'Attack':'Special Attack'):String(payload.targetNote||''));
          resultRecord={instanceId:`edge-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,id:edge.id,name:edge.name,rank:nextRank,cost:payload.freeGrant?0:cost,targetNote,targetId,targetKind,targetStat,statAllocation,statAllocationPoints:allocationMeta.allocationRequired?allocationMeta.allocationPoints:null,sourceVersionId:edge.versionId,sourceId:edge.sourceId,
            prerequisites:edge.prerequisites||edge.raw?.prerequisites_text||null,effect:edge.effect||edge.raw?.effect_text||null,gmOverride:!!payload.gmOverride,manualConfirmed:!!payload.manualConfirm,acquiredAt:new Date().toISOString()};
          const projectedDetails=JSON.parse(JSON.stringify(details)); projectedDetails.pokeEdges.push(resultRecord);
          if(['realized-potential','mixed-sweeper','underdogs-strength'].includes(edgeKey)){
            const projected=resolvePokemonPokeEdgeStats({pokemon:{...pokemon,details:projectedDetails},species,detailsOverride:projectedDetails});
            if(projected.baseRelations.violations.length && !payload.gmOverride) errors.push(...projected.baseRelations.violations.map(v=>v.message));
          }
          if(errors.length) resultRecord=null;
          else details.pokeEdges.push(resultRecord);
          if(resultRecord && edge.id==='mixed-power' && !details.grantedAbilities.some(a=>String(typeof a==='string'?a:a?.name).toLowerCase()==='twisted power')){
            details.grantedAbilities.push({name:'Twisted Power',source:'poke_edge',sourceId:'mixed-power',sourceVersionId:edge.versionId,grantedAt:new Date().toISOString()});
          }
          details.baseRelationExemptStats=relationExemptionsFromPokeEdges(details.pokeEdges);
          if(resultRecord && !payload.freeGrant){details.tutorPointsSpent=spent+cost; remaining-=cost;}
        }
      }
    } else if(payload.action==='refund_edge'){
      const instanceId=String(payload.edgeInstanceId||'');
      let idx=instanceId?details.pokeEdges.findIndex(e=>String(e.instanceId||'')===instanceId):-1;
      if(idx<0 && Number.isInteger(payload.edgeIndex)) idx=Number(payload.edgeIndex);
      if(idx<0 || idx>=details.pokeEdges.length) errors.push('Poké Edge record was not found for refund.');
      else{
        const removed=details.pokeEdges[idx];
        const refund=Math.max(0,Number(removed.cost||0));
        details.pokeEdges.splice(idx,1);
        details.tutorPointsSpent=Math.max(0,spent-refund); remaining=Math.max(0,earned-details.tutorPointsSpent);
        removeDerivedEffectsForRefund(details,removed);
        resultRecord={...removed,refundedTutorPoints:refund,refundedAt:new Date().toISOString()};
      }
    } else if(payload.action==='learn_move'){
      const method=String(payload.method||'tm_hm'); const moveId=String(payload.moveId||'');
      const sourceList=method==='tutor'?(species.tutorMoves||[]):method==='egg_tutor'?(species.eggMoves||[]):(species.tmMoves||[]);
      const source=sourceList.find(m=>String(m.move_id||m.move||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')===moveId);
      if(!source && !payload.gmOverride) errors.push('Move is not compatible through the selected teaching method.');
      const move=definitions.getResolved({rulesetId,kind:'moves',id:moveId}); if(!move) errors.push('Move definition is unavailable in the active Ruleset.');
      const slug=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      if(details.moves.some(m=>slug(m.id||m.name)===moveId)) errors.push(`${move?.name||moveId} is already known.`);
      let replaceIndex=-1;
      if(payload.replaceMoveId) replaceIndex=details.moves.findIndex(m=>slug(m.id||m.name)===String(payload.replaceMoveId));
      const moveLimit=Math.max(0,Number(details.moveLimitEffective??6));
      if(details.moves.length>=moveLimit && replaceIndex<0) errors.push(`Current Move Limit is ${moveLimit}; choose a known Move to replace.`);
      const natural=method==='tutor' && isNaturalTutorMove(species,source?.move||move?.name||moveId);
      const levelUpIds=new Set((species.levelUpMoves||[]).map(m=>slug(m.move_id||m.move)));
      const countsAsNatural=natural||levelUpIds.has(moveId); const poolLimit=Math.max(0,Number(details.tutorMovePoolLimit??3));
      const before=details.moves.filter((_,i)=>i!==replaceIndex); const poolBefore=moveTrainingPoolUsage(before);
      const countsAgainstTutorPool=!countsAsNatural;
      if(countsAgainstTutorPool && poolBefore+1>poolLimit && !payload.gmOverride) errors.push(`TM/Tutor Move Pool limit is ${poolLimit}.`);
      const ruleset=definitions.getRuleset(rulesetId); const sept=!!ruleset?.packs?.some(p=>p.enabled&&p.pack_id==='ptu-september-2015-playtest');
      const restriction=(method==='tutor'||method==='egg_tutor')?tutorRestrictionForMove({level:pokemon.level,move,september2015Enabled:sept}):{valid:true};
      if(!restriction.valid && !payload.gmOverride) errors.push(restriction.message);
      cost=method==='tm_hm'?1:(natural?1:2);
      const replacingTm=replaceIndex>=0 && ['tm','hm','tm_hm'].includes(String(details.moves[replaceIndex]?.source||'').toLowerCase());
      if(method==='tm_hm' && replacingTm) cost=0;
      if(remaining<cost && !payload.freeGrant) errors.push(`Requires ${cost} Tutor Point${cost===1?'':'s'}; only ${remaining} remain.`);
      if(!errors.length){
        resultRecord={id:moveId,name:move?.name||source?.move||moveId,source:method==='tm_hm'?'tm':(method==='egg_tutor'?'egg_tutor':(natural?'natural_tutor':'tutor')),
          learnedAt:pokemon.level,countsAsNatural,cost:payload.freeGrant?0:cost,sourceSpeciesId:species.id,sourceSpeciesName:species.name,gmOverride:!!payload.gmOverride,learnedAtDate:new Date().toISOString()};
        if(replaceIndex>=0) details.moves.splice(replaceIndex,1,resultRecord); else details.moves.push(resultRecord);
        if(!payload.freeGrant){details.tutorPointsSpent=spent+cost; remaining-=cost;}
      }
    } else errors.push('Unsupported training action.');
    details.tutorPointsEarned=earned; details.tutorPointsRemaining=Math.max(0,earned-Number(details.tutorPointsSpent||spent));
    if(!errors.length) details.trainingHistory.push({date:new Date().toISOString(),action:payload.action,cost:payload.freeGrant?0:cost,record:resultRecord});
    const resolvedStatEffects=resolvePokemonPokeEdgeStats({pokemon:{...pokemon,details},species,detailsOverride:details});
    const resolvedSkills=resolvePokemonSkills(species,details);
    return json(res,200,{valid:errors.length===0,errors,cost,tutorPoints:{earned,spent:Number(details.tutorPointsSpent||spent),remaining:details.tutorPointsRemaining},details,resultRecord,resolvedStatEffects,resolvedSkills});
  }

  if(req.method==='GET' && url.pathname==='/api/profiles'){
    return json(res,200,{activeProfileId:repo.getActiveProfileId(),profiles:repo.listProfiles()});
  }
  if(req.method==='POST' && url.pathname==='/api/profiles'){
    const payload=await bodyJson(req);
    const name=String(payload.name||'').trim();
    if(!name) throw Object.assign(new Error('Trainer name is required'),{status:400});
    const state=blankTrainerState({name,title:String(payload.title||'Trainer').trim()||'Trainer'});
    repo.saveState(state,{createRevision:true});
    return json(res,201,{ok:true,state:hydrateStateForClient(repo.loadState(state.activeProfileId)),profiles:repo.listProfiles()});
  }
  if(req.method==='PUT' && url.pathname==='/api/profiles/active'){
    const payload=await bodyJson(req); const id=String(payload.id||'');
    const profile=repo.listProfiles().find(p=>p.id===id);
    if(!profile) throw Object.assign(new Error('Trainer profile not found'),{status:404});
    repo.setActiveProfileId(id);
    return json(res,200,{ok:true,state:hydrateStateForClient(repo.loadState(id)),profiles:repo.listProfiles()});
  }
  const profileDelete=url.pathname.match(/^\/api\/profiles\/([^/]+)$/);
  if(req.method==='DELETE' && profileDelete){
    const id=decodeURIComponent(profileDelete[1]); const activeProfileId=repo.deleteProfile(id);
    return json(res,200,{ok:true,activeProfileId,state:hydrateStateForClient(repo.loadState(activeProfileId)),profiles:repo.listProfiles()});
  }
  if(req.method==='GET' && url.pathname==='/api/state'){
    return json(res,200,{state:hydrateStateForClient(repo.loadState()),persistence:'sqlite'});
  }
  if(req.method==='PUT' && url.pathname==='/api/state'){
    const payload=await bodyJson(req);
    const state=payload.state ?? payload;
    const result=repo.saveState({...state,version:2});
    return json(res,200,{ok:true,...result});
  }
  if(req.method==='POST' && url.pathname==='/api/reset'){
    const clean=JSON.parse(JSON.stringify(seed)); clean.version=2;
    repo.saveState(clean,{createRevision:true});
    return json(res,200,{ok:true,state:hydrateStateForClient(repo.loadState(clean.activeProfileId))});
  }
  if(req.method==='GET' && url.pathname==='/api/revisions'){
    const limit=Math.max(1,Math.min(30,Number(url.searchParams.get('limit')||10)));
    return json(res,200,{revisions:repo.listRevisions(undefined,limit)});
  }
  const restore=url.pathname.match(/^\/api\/revisions\/(\d+)\/restore$/);
  if(req.method==='POST' && restore){
    return json(res,200,{ok:true,state:hydrateStateForClient(repo.restoreRevision(Number(restore[1])))});
  }
  if(req.method==='GET' && url.pathname==='/api/export'){
    return json(res,200,hydrateStateForClient(repo.loadState()));
  }
  return false;
}

async function mobileFetch(input,init={}){
  const raw=typeof input==='string'?input:(input?.url||'');
  let url; try{url=new URL(raw,location.href);}catch{return window.__PTU_NATIVE_FETCH__(input,init);}
  if(!url.pathname.startsWith('/api/')) return window.__PTU_NATIVE_FETCH__(input,init);
  const method=String(init.method||(typeof input!=='string'&&input?.method)||'GET').toUpperCase();
  let body={}; if(init.body){try{body=typeof init.body==='string'?JSON.parse(init.body):init.body;}catch{body={};}}
  const req={method,_body:body}; const res={status:200,data:null};
  try{const handled=await handleApi(req,res,url);if(!handled&&res.data==null)return new Response(JSON.stringify({error:'Mobile API route not found'}),{status:404,headers:{'Content-Type':'application/json'}});return new Response(JSON.stringify(res.data??{}),{status:res.status||200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}catch(e){return new Response(JSON.stringify({error:e?.message||String(e)}),{status:Number(e?.status)||500,headers:{'Content-Type':'application/json'}});}
}
async function installMobileApi(){ window.__PTU_NATIVE_FETCH__=window.fetch.bind(window);window.PTU_ANDROID_BUILD=true;await loadNativeContentPacks();applyStoredPackOverrides();window.fetch=mobileFetch; }
return {mobileFetch, installMobileApi};
})();

__ptu_mobile_api.installMobileApi().then(()=>{
  window.PTU_ANDROID_RUNTIME_READY=true;
  const script=document.createElement('script');
  script.src='app.js';
  script.onload=()=>document.documentElement.classList.add('ptu-android-ready');
  script.onerror=()=>{throw new Error('Unable to load Android player UI.');};
  document.body.appendChild(script);
}).catch(error=>{
  console.error('[PTU Android runtime]',error);
  const root=document.getElementById('app');
  if(root) root.innerHTML='<main style="min-height:100vh;padding:24px;background:#0a67b7;color:white;font-family:system-ui"><h2>PTU Companion could not start</h2><pre style="white-space:pre-wrap">'+String(error?.stack||error?.message||error).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))+'</pre></main>';
});
})();
