// Core 1.05 p.179. Shared by the browser and the preview API, like the
// Pokecenter transaction helpers. Mutates only the supplied Trainer.
globalThis.reconcileTrainerChannels=function(trainer,pokemon,{getBinding=()=>null,getFeatureSource=()=> 'core',maxAp=Infinity,history=true}={}){
  const td=trainer?.details,links=(Array.isArray(td?.boundEntities)?td.boundEntities:[]).filter(e=>e.kind==='pokemon_link');if(!links.length)return [];
  const apBefore=td.currentAp,events=[],features=td.features||[],state=td.boundEntityState||={};
  const has=id=>features.some(f=>f.id===id&&getFeatureSource(f)==='core');
  const release=(f,id)=>{
    const targets=Array.isArray(f.boundTargetIds)?f.boundTargetIds:[];if(!f.bound||!targets.includes(id))return;
    const binding=getBinding(f),cost=Number(f.boundApCostEach??(binding?binding.apCost*(binding.perRank?Math.max(1,Number(f.rank||1)):1):f.id==='shared-senses'?1:NaN));
    if(!Number.isSafeInteger(cost)||cost<1)return;
    f.boundTargetIds=targets.filter(target=>target!==id);f.bound=f.boundTargetIds.length>0;if(!f.bound)f.boundStratagem=false;td.currentAp=Math.min(maxAp,Number(td.currentAp||0)+cost);
    events.push(`${f.name||f.id}: ${cost} AP returned.`);
  };
  for(const link of links){
    const target=pokemon.find(p=>p.id===link.pokemonId),imprinted=has('shared-senses')&&features.some(f=>f.id==='shared-senses'&&f.bound&&(f.boundTargetIds||[]).includes(link.id));
    if(target)link.name=target.name||target.species||link.name;
    const reason=td.currentHp!=null&&Number(td.currentHp)<=0?'Trainer Fainted':!has('channeler')?'Channeler unavailable':!target?'Pokémon removed':link.active===false?'link inactive':link.distance>20&&!imprinted?'outside 20 meters':null;
    if(link.channeling&&reason){link.channeling=false;events.push(`${link.name}: Channeling ended (${reason}).`);}
    if(!link.channeling||!imprinted){
      for(const f of features)if(f.id==='shared-senses')release(f,link.id);
      if(state.sensoryFocusId===link.id)state.sensoryFocusId=null;
    }
    if(!link.channeling)for(const f of features)if(/Channeled Pok[eé]mon/i.test(getBinding(f)?.targetText||''))release(f,link.pokemonId);
  }
  if(events.length&&history){td.boundEntityHistory=Array.isArray(td.boundEntityHistory)?td.boundEntityHistory:[];td.boundEntityHistory.push({at:new Date().toISOString(),action:'channel-reconcile',events,apBefore,apAfter:td.currentAp});td.boundEntityHistory=td.boundEntityHistory.slice(-100);}
  return events;
};
