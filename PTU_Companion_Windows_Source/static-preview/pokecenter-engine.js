/* Pokecenter Recovery transaction shared by the desktop and Android UIs. */
globalThis.previewPokecenterRecovery=function(state,{pokemonIds=[],serviceCost=0,perPokemon=false,rosterId=state?.selectedRosterId}={}){
  const cost=Number(serviceCost),selected=[...new Set((pokemonIds||[]).map(String))];
  if(!Number.isSafeInteger(cost)||cost<0)return {valid:false,errors:['Service cost must be a non-negative whole number.']};
  const roster=state?.rosters?.find(row=>row.id===rosterId);
  if(!roster||roster.active===false)return {valid:false,errors:['Select an active roster before using the Pokecenter.']};
  const eligible=(state.pokemon||[]).filter(p=>(p.rosterIds||[]).includes(rosterId));
  const pokemon=eligible.filter(p=>selected.includes(String(p.id)));
  if(selected.length!==pokemon.length)return {valid:false,errors:['Selected Pokémon must belong to the active roster.']};
  if(!pokemon.length)return {valid:false,errors:['Select at least one Pokémon from the active roster.']};
  if(pokemon.some(p=>!Number.isFinite(Number(p.maxHp||p.maxHP||p.max_hp))||Number(p.maxHp||p.maxHP||p.max_hp)<=0))return {valid:false,errors:['Every selected Pokémon must have a valid maximum HP.']};
  const total=cost*(perPokemon?pokemon.length:1),money=Number(state.trainer?.money);
  if(!Number.isSafeInteger(money)||money<0)return {valid:false,errors:['Trainer money is invalid; no recovery was applied.']};
  if(money<total)return {valid:false,errors:[`The Trainer has ₽${money.toLocaleString()} but recovery costs ₽${total.toLocaleString()}.`],pokemon,total};
  return {valid:true,pokemon,total,rosterId,perPokemon,serviceCost:cost,effects:pokemon.map(p=>({id:p.id,name:p.name,hpBefore:Number(p.hp||0),maxHp:Number(p.maxHp||p.maxHP||p.max_hp||0),injuriesBefore:Number(p.injuries||0),statusAfflictionsBefore:[...(state.ui?.combat?.participants?.[p.id]?.conditions?.statusAfflictions||[])]}))};
};
globalThis.applyPokecenterRecovery=function(state,options={}){
  const preview=previewPokecenterRecovery(state,options);
  if(!preview.valid)throw new Error(preview.errors.join(' '));
  const next=JSON.parse(JSON.stringify(state));
  next.trainer.money=Number(next.trainer.money||0)-preview.total;
  for(const row of preview.pokemon){
    const p=next.pokemon.find(item=>String(item.id)===String(row.id));
    p.hp=Number(p.maxHp||p.maxHP||p.max_hp||0);p.injuries=0;
    const participant=next.ui?.combat?.participants?.[p.id];
    if(participant?.conditions)participant.conditions.statusAfflictions=[];
  }
  return {state:next,preview};
};
