let boundEntityBusy=false;
function trainerBoundEntities(){return trainer().details?.boundEntities||[];}
function boundEntityHasBinding(entity,id){return (trainer().details?.features||[]).some(f=>f.id===id&&f.bound&&(f.boundTargetIds||[]).includes(entity.id));}
function boundEntityUiSnapshot(){return JSON.stringify({trainer:{...trainer(),derived:undefined},inventory:state.inventory,pokemon:state.pokemon,day:state.ui.day,scene:state.ui.scene,round:state.ui.round,combat:state.ui.combat,ruleset:catalogState.status?.activeRulesetId});}
async function boundEntityPreview(action,fields={}){
  const response=await fetch('/api/trainer/bound-entity-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trainer:{...trainer(),derived:undefined},inventory:state.inventory,pokemon:state.pokemon,rulesetId:catalogState.status?.activeRulesetId,context:{day:state.ui.day||1,scene:state.ui.scene||1,round:state.ui.round||1,combat:{active:state.ui.combat?.active===true,participantIds:state.ui.combat?.participantIds||[]}},action,...fields})});
  const result=await response.json();if(!response.ok||!result.valid)throw new Error(result.error||'Entity action could not be resolved.');return result;
}
async function applyBoundEntityAction(action,fields={}){
  if(boundEntityBusy)return;boundEntityBusy=true;
  const owner=trainer(),snapshot=boundEntityUiSnapshot();
  try{
    const result=await boundEntityPreview(action,fields);
    const ok=await styledConfirm({title:'Review entity action',confirmLabel:'Apply',message:`<ul>${result.events.map(event=>`<li>${esc(event)}</li>`).join('')}</ul><p>Available AP: ${result.apBefore} → ${result.apAfter}</p>`});if(!ok)return;
    if(trainer()!==owner||snapshot!==boundEntityUiSnapshot())throw new Error('The Trainer, inventory or scene changed. Review the action again.');
    owner.details=result.updatedTrainer.details;state.inventory=result.updatedInventory;invalidateTrainerReference();await commit(result.events.join(' '));return result;
  }catch(error){toast(error.message,'error');}finally{boundEntityBusy=false;render();}
}
async function createTrainerBoundEntity(kind){
  try{
    const options=await boundEntityPreview('options'),labels={glyph:'Glyph',weapon:'Arcane Weapon',external_trainer:'External Trainer',pokemon_link:'Pokémon Channel Link'};
    const fields=kind==='pokemon_link'?[]:[{name:'name',label:'Name',value:''}];
    if(kind==='pokemon_link'){const choices=(state.pokemon||[]).filter(p=>!trainerBoundEntities().some(e=>e.kind==='pokemon_link'&&e.pokemonId===p.id));if(!choices.length)return toast('Add an unlinked Pokémon to the campaign first.','error');fields.push({name:'pokemonId',label:'Campaign Pokémon',type:'select',value:choices[0].id,options:choices.map(p=>({value:p.id,label:p.name||p.species}))},{name:'hostile',label:'Hostile?',type:'select',value:'no',options:[{value:'no',label:'No'},{value:'yes',label:'Yes · Intuition DC 15'}]},{name:'allied',label:'Allied with other Channeled Pokémon?',type:'select',value:'yes',options:[{value:'yes',label:'Yes'},{value:'no',label:'No'}]});}
    if(kind==='glyph')fields.push({name:'location',label:'Surface / location',value:''},{name:'swift',label:'Placement',type:'select',value:'no',options:[{value:'no',label:'Extended Action · one Cleanse Tag'},{value:'yes',label:'Swift Action · 1 AP + one Cleanse Tag'}]},{name:'visible',label:'Visible when placed?',type:'select',value:'no',options:[{value:'no',label:'Invisible'},{value:'yes',label:'Visible'}]});
    if(kind==='weapon'){
      if(!options.items.length)return toast('No Arcane Weapons are available in the active Ruleset.','error');
      fields.push({name:'equipmentSlot',label:'Linked equipped slot',type:'select',value:'',options:[{value:'',label:'Not equipped'},{value:'mainHand',label:'Main hand'},{value:'offHand',label:'Off hand'}]},{name:'itemId',label:'Existing Arcane Weapon',type:'select',value:options.items[0].id,options:options.items.map(i=>({value:i.id,label:i.name}))});
    }
    if(kind!=='glyph')fields.push({name:'distance',label:'Distance from Trainer (meters)',type:'number',min:0,value:0});
    if(kind==='weapon')fields.push({name:'heldByOther',label:'Held by someone unwilling to release it?',type:'select',value:'no',options:[{value:'no',label:'No'},{value:'yes',label:'Yes'}]});
    if(kind==='external_trainer')fields.push({name:'direction',label:'Direction / location',value:''},{name:'willing',label:'Consents to Mark of Vision?',type:'select',value:'yes',options:[{value:'yes',label:'Yes'},{value:'no',label:'No'}]});
    fields.push({name:'notes',label:'Notes',type:'textarea',rows:2,value:''});
    const value=await styledForm({title:`Register ${labels[kind]}`,subtitle:kind==='weapon'?'Link a weapon that exists in the campaign. This does not create an inventory item.':kind==='pokemon_link'?'Link a campaign Pokémon, then use Channel. Core 1.05 p.179.':kind==='glyph'?'Glyph HP equals Trainer Level; active Glyphs are limited by Occult Education Rank.':'Track consent, position and sensory access for this person.',fields,submitLabel:'Review entity'});if(!value)return;
    return applyBoundEntityAction('create',{data:{...value,kind,swift:value.swift==='yes',visible:value.visible==='yes',heldByOther:value.heldByOther==='yes',willing:value.willing==='yes',hostile:value.hostile==='yes',allied:value.allied==='yes'}});
  }catch(error){toast(error.message,'error');}
}
async function openTrainerEntityBinding(index,targetId=null,preferredId=null){
  const feature=trainer().details?.features?.[index];if(!feature)return;
  if(targetId!=null)return applyBoundEntityAction('unbind',{entityId:targetId,featureIndex:index});
  try{
    const options=await boundEntityPreview('options'),kind={'alarm-runes':'glyph','mark-of-vision':'external_trainer','soul-investment':'weapon','shared-senses':'pokemon_link'}[feature.id];
    const entities=trainerBoundEntities().filter(e=>e.kind===kind&&(kind!=='pokemon_link'||e.channeling)&&e.active!==false&&(kind!=='glyph'||e.hp>0)&&!(feature.boundTargetIds||[]).includes(e.id));
    if(!entities.length)return toast('Register an eligible entity in Bound Entities below.','error');
    const fields=[{name:'entityId',label:'Target entity',type:'select',value:entities.find(e=>e.id===preferredId)?.id||entities[0].id,options:entities.map(e=>({value:e.id,label:e.name}))}];
    if(feature.id==='alarm-runes')fields.push({name:'trigger',label:'Trigger',type:'textarea',rows:2,value:''},{name:'explosive',label:'Use Explosive Runes when triggered?',type:'select',value:'no',options:[{value:'no',label:'Alarm only'},{value:'yes',label:'Hidden Power · Free Action · 1 AP'}]});
    if(feature.id==='soul-investment'){
      const known=new Set((trainerResolved()?.moves||[]).map(m=>m.id));
      for(const tier of ['adept','master']){const choices=options.moves[tier].filter(m=>!known.has(m.id));if(!choices.length)return toast(`No unused ${tier} Arcane Weapon Moves are available.`,'error');fields.push({name:`${tier}MoveId`,label:`${tier==='adept'?'Adept':'Master'} Arcane Weapon Move`,type:'select',value:choices[0].id,options:choices.map(m=>({value:m.id,label:m.name}))});}
    }
    const value=await styledForm({title:`Bind ${feature.name||feature.id}`,subtitle:'The active rule checks target type, limits, choices and AP before applying.',fields,submitLabel:'Review binding'});if(!value)return;
    if(trainer().details.features[index]!==feature)throw new Error('The Feature changed while selecting the target.');
    return applyBoundEntityAction('bind',{entityId:value.entityId,featureIndex:index,data:{...value,explosive:value.explosive==='yes'}});
  }catch(error){toast(error.message,'error');}
}
async function trainerBoundEntityControl(id,action){
  const entity=trainerBoundEntities().find(e=>e.id===id);if(!entity)return;
  if(action==='view-pokemon')return selectPokemon(entity.pokemonId,true);
  let data={};
  if(action==='channel-pokemon'&&entity.hostile){const v=await styledForm({title:`Channel · ${entity.name}`,fields:[{name:'intuitionCheck',label:'Intuition Check total (DC 15)',type:'number',min:0,value:15}],submitLabel:'Review Channel'});if(!v)return;data=v;}
  else if(action==='damage'){
    const v=await styledForm({title:`Damage · ${entity.name}`,fields:[{name:'amount',label:'Damage',type:'number',min:1,value:1}],submitLabel:'Review damage'});if(!v)return;data=v;
  }else if(action==='trigger'){
    const v=await styledForm({title:`Trigger · ${entity.name}`,subtitle:entity.trigger,fields:[{name:'distance',label:'Trigger distance from Glyph (meters; maximum 30)',type:'number',min:0,max:30,value:0}],submitLabel:'Review trigger'});if(!v)return;data=v;
  }else if(action==='position'){
    const v=await styledForm({title:`Position · ${entity.name}`,fields:[{name:'distance',label:'Distance from Trainer (meters)',type:'number',min:0,value:entity.distance||0},{name:'direction',label:'Direction / location',value:entity.direction||''},...(entity.kind==='pokemon_link'?[{name:'hostile',label:'Hostile?',type:'select',value:entity.hostile?'yes':'no',options:[{value:'no',label:'No'},{value:'yes',label:'Yes'}]},{name:'allied',label:'Allied?',type:'select',value:entity.allied?'yes':'no',options:[{value:'yes',label:'Yes'},{value:'no',label:'No'}]}]:[]),...(entity.kind==='weapon'?[{name:'equipmentSlot',label:'Linked equipped slot',type:'select',value:entity.equipmentSlot||'',options:[{value:'',label:'Not equipped'},{value:'mainHand',label:'Main hand'},{value:'offHand',label:'Off hand'}]},{name:'heldByOther',label:'Held by an unwilling holder?',type:'select',value:entity.heldByOther?'yes':'no',options:[{value:'no',label:'No'},{value:'yes',label:'Yes'}]}]:[])],submitLabel:'Review position'});if(!v)return;data={...v,heldByOther:v.heldByOther==='yes',hostile:v.hostile==='yes',allied:v.allied==='yes'};
  }else if(action==='beckon'&&entity.heldByOther){
    const ok=await styledConfirm({title:'Opposed Check',confirmLabel:'Check succeeded',message:'<p>Did your Occult Education beat the unwilling holder’s Athletics Check?</p>'});if(!ok)return;data.opposedCheckSucceeded=true;
  }else if(action==='access')data.denied=!entity.accessDenied;
  else if(action==='consent')data.willing=!entity.willing;
  return applyBoundEntityAction(action,{entityId:id,data});
}
function clearBoundEntityFeatureLinks(feature){
  const td=trainer().details,ids=feature.boundTargetIds||[];
  for(const entity of td.boundEntities||[])if(ids.includes(entity.id)&&feature.id==='alarm-runes'){entity.alarming=false;entity.trigger='';entity.explosive=false;}
  if(feature.id==='mark-of-vision'&&ids.includes(td.boundEntityState?.markFocusId))td.boundEntityState.markFocusId=null;
}
function trainerBoundEntityPanel(){
  const td=trainer().details||{},focus=td.boundEntityState||{},features=td.features||[];
  const control=(entity,action,label)=>`<button class="btn btn-small btn-ghost" onclick="trainerBoundEntityControl('${esc(entity.id)}','${action}')">${label}</button>`;
  const bindButton=(entity,id,label)=>{const index=features.findIndex(f=>f.id===id);return index>=0?`<button class="btn btn-small btn-primary" onclick="openTrainerEntityBinding(${index},null,'${esc(entity.id)}')">${label}</button>`:'';};
  const rows=trainerBoundEntities().map(entity=>{
    const active=entity.active!==false,marked=boundEntityHasBinding(entity,'mark-of-vision'),alarmed=boundEntityHasBinding(entity,'alarm-runes'),invested=boundEntityHasBinding(entity,'soul-investment');
    let details='',buttons='';
    if(entity.kind==='glyph'){
      details=`HP ${entity.hp}/${entity.maxHp} · ${entity.visible?'Visible':'Invisible'} · ${entity.alarming?'ALARM SOUNDING':'Silent'}<br>${esc(entity.location||'Location not recorded')}${entity.trigger?`<p><strong>Trigger:</strong> ${esc(entity.trigger)}</p>`:''}${focus.glyphFocusId===entity.id?'<p><strong>Channeling:</strong> senses and voice relay active.</p>':''}${entity.lastAttack?`<p>Last attack: Hidden Power · ${esc(entity.lastAttack.round)} · Trainer stats: ${(Object.entries(entity.lastAttack.stats||{})).map(([key,value])=>`${esc(key)} ${esc(value)}`).join(' · ')}.</p>`:''}`;
      if(active&&entity.hp>0)buttons=control(entity,'damage','Damage')+control(entity,'channel','Channel · Standard')+(focus.glyphFocusId===entity.id?control(entity,'stop-focus','Stop channeling'):'')+(alarmed?control(entity,'trigger','Trigger alarm')+control(entity,'silence','Silence · Free'):bindButton(entity,'alarm-runes','Bind Alarm Runes'))+control(entity,'deactivate','Deactivate');
    }else if(entity.kind==='weapon'){
      details=`${esc(entity.itemId)} · ${esc(entity.equipmentSlot||'Not equipped')} · ${entity.distance} m · ${entity.soulBonded?'SOUL BONDED':'No Soul Bond'}${entity.heldByOther?' · unwilling holder':''}${invested?`<p>Invested Moves: ${(entity.investmentMoves||[]).map(esc).join(', ')}</p>`:''}`;
      if(active)buttons=control(entity,'position','Position')+(entity.soulBonded?control(entity,'beckon','Beckon · Shift')+(invested?'':bindButton(entity,'soul-investment','Bind Soul Investment')):control(entity,'soul-bond','Form Soul Bond · Extended'));
    }else if(entity.kind==='pokemon_link'){
      const imprinted=boundEntityHasBinding(entity,'shared-senses');
      details=`${entity.channeling?'CHANNELED':'Not Channeling'} · ${entity.distance} m · ${entity.hostile?'Hostile':'Not hostile'}${imprinted?' · IMPRINTED · distance exemption':''}${entity.allied?' · Allied':''}${focus.sensoryFocusId===entity.id?'<p><strong>In focus:</strong> receiving this Pokémon’s senses.</p>':''}`;
      if(entity.channeling)details+='<p>Honest emotional communication; Moves, Abilities and Capabilities known. Allied Channeled Pokémon can attempt Intercept for each other regardless of Loyalty.</p>';
      buttons=control(entity,'view-pokemon','Pokémon sheet')+control(entity,'position','Position')+(entity.channeling?control(entity,'stop-channel','Stop Channeling · Free')+(imprinted?control(entity,'focus-senses','Concentrate on senses')+(focus.sensoryFocusId===entity.id?control(entity,'stop-focus','Stop concentrating'):''):bindButton(entity,'shared-senses','Bind Shared Senses')):control(entity,'channel-pokemon','Channel · Swift'));
    }else{
      details=`${entity.willing?'Consenting':'Consent withdrawn'} · ${entity.accessDenied?'Sensory access denied':'Access permitted'} · ${entity.distance} m ${esc(entity.direction||'')}${marked?' · MARKED':''}${focus.markFocusId===entity.id?'<p><strong>In focus:</strong> perceiving this Trainer’s senses.</p>':''}`;
      if(active)buttons=control(entity,'position','Position')+control(entity,'consent',entity.willing?'End mark / withdraw consent':'Consent')+(marked?control(entity,'access',entity.accessDenied?'Restore access':'Deny access')+(!entity.accessDenied&&entity.willing?control(entity,'focus','Concentrate'):'')+(focus.markFocusId===entity.id?control(entity,'stop-focus','Stop concentrating'):''):bindButton(entity,'mark-of-vision','Bind Mark of Vision'));
    }
    return `<article class="trainer-option-card"><h3>${esc(entity.name)} ${chip(esc(entity.kind.replaceAll('_',' ')),active?'chip-blue':'chip-neutral')}</h3><p>${details}</p>${entity.notes?`<p>${esc(entity.notes)}</p>`:''}<div class="row-gap">${buttons}${control(entity,'delete','Delete')}</div></article>`;
  }).join('');
  const create=(kind,label)=>`<button class="btn btn-small btn-primary" onclick="createTrainerBoundEntity('${kind}')">＋ ${label}</button>`;
  const history=(td.boundEntityHistory||[]).slice(-5).reverse().map(e=>`<li>${esc(e.events.join(' '))} · AP ${e.apBefore} → ${e.apAfter}</li>`).join('');
  return section('BOUND ENTITIES',`<div class="row-gap">${create('glyph','Place Glyph')}${create('weapon','Link Arcane Weapon')}${create('external_trainer','External Trainer')}${create('pokemon_link','Pokémon Channel Link')}</div><div class="trainer-option-grid">${rows||'<p class="muted">No entities registered.</p>'}</div>${history?`<details><summary>Recent entity actions</summary><ul>${history}</ul></details>`:''}<p class="muted">Core p.179: Channeler / Shared Senses. Editation: Mark of Vision p.42; Glyph and Alarm Runes pp.47–48; Arcanist and Soul Investment pp.49–50. Bind controls use the active Ruleset.</p>`);
}

function reconcileTrainerChannelState(){
  const t=trainer(),sources=trainerResolved()?.sourceSummary||[],events=globalThis.reconcileTrainerChannels(t,state.pokemon||[],{
    maxAp:Number(t.derived?.maxAp||trainerMaxAp(t)),
    getBinding:f=>sources.find(s=>s.id===f.id)?.binding||null,
    getFeatureSource:f=>{if(f.definitionVersionId&&!String(f.definitionVersionId).endsWith('@core'))return null;const source=sources.find(s=>s.id===f.id);return source?source.sourceId:!trainerResolved()?'core':null;}
  });return events.length>0;
}

async function openTrainerSpiritBoostBinding(index,targetId=null,preferredPokemonId=null){
  if(targetId!=null)return applyBoundEntityAction('unbind-spirit-boost',{featureIndex:index,data:{targetPokemonId:targetId}});
  const feature=trainer().details.features[index];
  try{
    const options=await boundEntityPreview('spirit-options'),targets=options.targets.filter(p=>!(feature.boundTargetIds||[]).includes(p.pokemonId)),sources=options.sources.filter(p=>!p.error);
    if(!targets.length||!sources.length)return toast('Channel a Pokémon in the active combat and provide a reference with resolved Combat Stats.','error');
    const chosen=await styledForm({title:'Bind Spirit Boost',subtitle:'Choose the Channeled target and reference Pokémon. Each target reserves 2 AP.',fields:[{name:'targetPokemonId',label:'Target Pokémon',type:'select',value:preferredPokemonId||targets[0].pokemonId,options:targets.map(p=>({value:p.pokemonId,label:p.name}))},{name:'sourcePokemonId',label:'Reference Pokémon',type:'select',value:sources[0].pokemonId,options:sources.map(p=>({value:p.pokemonId,label:p.name}))}],submitLabel:'Choose highest Stat'});if(!chosen)return;
    const source=sources.find(p=>p.pokemonId===chosen.sourcePokemonId),labels={attack:'Attack · Physical Bonus Damage',defense:'Defense · Physical DR',special_attack:'Special Attack · Special Bonus Damage',special_defense:'Special Defense · Special DR',speed:'Speed · Initiative'};
    const selection=await styledForm({title:'Spirit Boost · Highest Combat Stat',subtitle:source.name+' · '+Object.entries(source.stats).map(([key,value])=>`${key}: ${value}`).join(' · '),fields:[{name:'stat',label:'Highest Stat (choose when tied)',type:'select',value:source.highestStats[0],options:source.highestStats.map(stat=>({value:stat,label:labels[stat]}))}],submitLabel:'Review Spirit Boost'});if(!selection)return;
    if(trainer().details.features[index]!==feature)throw new Error('The Feature changed while choosing Spirit Boost.');
    return applyBoundEntityAction('bind-spirit-boost',{featureIndex:index,data:{...chosen,...selection}});
  }catch(error){toast(error.message,'error');}
}
