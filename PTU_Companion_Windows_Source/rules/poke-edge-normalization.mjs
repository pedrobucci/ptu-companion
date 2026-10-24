export const BASIC_RANGED_CAPABILITIES=['Firestarter','Fountain','Freezer','Guster','Materializer','Zapper'];
const leaf=(kind,name)=>({op:'leaf',kind,name});

// Repair the two Core p.205 multiline records at the shared read boundary so
// existing databases and imported backups receive the same corrected semantics.
export function normalizePokeEdgeDefinition(definition){
  const d=definition;
  if(d?.kind!=='poke_edges'||d.sourceId!=='core'||!['basic-ranged-attacks','aura-pulse'].includes(d.id))return d;
  const prerequisites=d.rawText?.match(/Prerequisites:\s*([\s\S]*?)\nCost:/)?.[1]?.replace(/\s+/g,' ').trim();
  if(!prerequisites)return d;
  let ast;
  if(d.id==='basic-ranged-attacks'&&BASIC_RANGED_CAPABILITIES.every(name=>prerequisites.includes(name))){
    ast={op:'all',children:[{op:'leaf',kind:'level_min',value:20},{op:'any',children:BASIC_RANGED_CAPABILITIES.map(name=>leaf('has_capability',name))}]};
  }else if(d.id==='aura-pulse'&&prerequisites.includes('Trainer with Aura Pulse')){
    ast={op:'all',children:[{op:'leaf',kind:'level_min',value:30},leaf('has_capability','Aura Reader'),leaf('trainer_capability','Aura Pulse')]};
  }else return d;
  const semantics={status:'compiled',ast,rank_asts:[],manual_leaf_count:0};
  const automation={...d.semanticAutomation,prerequisite_status:'compiled'};
  const compiledEffects=(d.compiledEffects||d.raw?.compiled_effects||[]).filter(effect=>!(d.id==='basic-ranged-attacks'&&effect.kind==='choose_and_grant_entity'&&effect.entity_kind==='move'));
  return {...d,prerequisites,frequency:null,prerequisiteSemantics:semantics,semanticAutomation:automation,compiledEffects,raw:{...d.raw,prerequisites_text:prerequisites,activation_text:null,frequency:null,prerequisite_semantics:semantics,semantic_automation:automation,compiled_effects:compiledEffects}};
}
