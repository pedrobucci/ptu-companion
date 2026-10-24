import '../static-preview/channel-links.js';
import {resolveTrainerModel,featureBindingInfo,equipmentDefinitionId} from './trainer-engine.mjs';

// Audited against Core p.179 and Editation pp.42,47–50,54–55. Different active
// versions must be mapped explicitly rather than inheriting these restrictions.
import {ENTITY_MOVE_TIERS} from './item-metadata.mjs';
export {ENTITY_MOVE_TIERS};
const managed=new Set(['alarm-runes','mark-of-vision','soul-investment','shared-senses']);
const sourceFor=id=>['channeler','shared-senses','spirit-boost'].includes(id)?'core':'edit';
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
const text=(value,max=2000)=>String(value??'').trim().slice(0,max);
function integer(value,label,min=0){const number=Number(value);if(!Number.isSafeInteger(number)||number<min)fail(`${label} must be a whole number of at least ${min}.`);return number;}
const isActive=entity=>entity.active!==false&&(entity.kind!=='glyph'||entity.hp>0);
function featureDefinition(trainer,id,getDefinition,rulesetId){
  const record=(trainer.details?.features||[]).find(row=>row.id===id);
  const definition=record&&getDefinition({rulesetId,kind:'features',id,versionId:record.definitionVersionId||null});
  return definition?.sourceId===sourceFor(id)?definition:null;
}
function requireFeature(trainer,id,getDefinition,rulesetId){const definition=featureDefinition(trainer,id,getDefinition,rulesetId);if(!definition)fail(`${id} must be recorded and its audited ${sourceFor(id)==='core'?'Core':'Editation'} version enabled in this Ruleset.`);return definition;}
export function boundEntityOptions({trainer,rulesetId,getDefinition,listDefinitions}){
  const moves=Object.fromEntries(Object.entries(ENTITY_MOVE_TIERS).map(([tier,ids])=>[tier,ids.map(id=>getDefinition({rulesetId,kind:'moves',id})).filter(Boolean).map(d=>({id:d.id,name:d.name,limitation:d.raw?.limitation_text||null}))]));
  const items=listDefinitions({rulesetId,kind:'items',q:'arcane',limit:200}).map(row=>getDefinition({rulesetId,kind:'items',id:row.id})).filter(d=>d?.raw?.mechanics?.arcane===true).map(d=>({id:d.id,name:d.name}));
  return {moves,items,features:Object.fromEntries(['glyph','arcanist','channeler',...managed].map(id=>[id,!!featureDefinition(trainer,id,getDefinition,rulesetId)]))};
}

export function previewBoundEntityAction({trainer,inventory=[],pokemon=null,rulesetId,action,entityId,featureIndex,data={},context={},getDefinition,getDamageBase,listDefinitions,getPokemonCombatStats}){
  if(!data||typeof data!=='object'||Array.isArray(data)||!context||typeof context!=='object'||Array.isArray(context))fail('Invalid action fields.');
  if(!Array.isArray(inventory))fail('Invalid Backpack.');
  if(pokemon==null){if(Array.isArray(trainer?.details?.boundEntities)&&trainer.details.boundEntities.some(e=>e.kind==='pokemon_link'))fail('The complete campaign Pokémon list is required for Channel links.');pokemon=[];}
  if(!Array.isArray(pokemon)||pokemon.some(p=>!p?.id)||new Set(pokemon.map(p=>p.id)).size!==pokemon.length)fail('Invalid Pokémon list.');
  if(!trainer||!trainer.id||!Array.isArray(trainer.details?.features))fail('A valid Trainer is required.');
  const updatedTrainer=structuredClone(trainer),updatedInventory=structuredClone(inventory),td=updatedTrainer.details;
  if(td.boundEntities!=null&&!Array.isArray(td.boundEntities))fail('Invalid saved entity list.');
  const entities=td.boundEntities||=[],state=td.boundEntityState||={};
  if(!state||typeof state!=='object'||Array.isArray(state))fail('Invalid saved entity state.');
  if(entities.some(e=>!/^bound-entity-[\w-]+$/.test(e?.id||'')||!['glyph','weapon','external_trainer','pokemon_link'].includes(e.kind))||new Set(entities.map(e=>e.id)).size!==entities.length)fail('Saved entities contain invalid or duplicate identities.');
  for(const entity of entities){if(entity.kind==='glyph'){integer(entity.hp,'Saved Glyph HP');integer(entity.maxHp,'Saved Glyph maximum HP',1);if(entity.hp>entity.maxHp)fail('Saved Glyph HP exceeds its maximum.');}else integer(entity.distance??0,'Saved distance');}
  if(td.features.some(f=>!f||f.boundTargetIds!=null&&!Array.isArray(f.boundTargetIds)))fail('Invalid saved Feature bindings.');
  const model=resolveTrainerModel({trainer:updatedTrainer,rulesetId,getDefinition,getDamageBase});
  const rank=name=>Number(model.skills[name]?.rank||2);
  const beforeAp=integer(td.currentAp??model.derived.availableMaxAp,'Current AP');if(beforeAp>model.derived.availableMaxAp)fail('Current AP exceeds the unbound maximum.');td.currentAp=beforeAp;
  const scene=`${integer(context.day??1,'Day',1)}:${integer(context.scene??1,'Scene',1)}`,round=`${scene}:${integer(context.round??1,'Round',1)}`;
  const entity=entities.find(e=>e.id===entityId),events=[];
  const equipmentSlot=(value,itemId,exceptId)=>{
    const slot=text(value,40);if(!slot)return null;
    if(!['mainHand','offHand'].includes(slot))fail('Choose a hand equipment slot.');
    const equipped=updatedTrainer.equipment?.[slot],id=equipmentDefinitionId(typeof equipped==='object'?(equipped?.definitionId||equipped?.id||equipped?.name):equipped);
    if(id!==itemId)fail('Equip this Arcane Weapon in the chosen slot first.');
    if(entities.some(e=>e.id!==exceptId&&e.kind==='weapon'&&e.active!==false&&e.equipmentSlot===slot&&e.itemId===itemId))fail('This equipment slot already has a linked entity.');
    return slot;
  };
  const spend=amount=>{if(td.currentAp<amount)fail(`Requires ${amount} available AP.`);td.currentAp-=amount;};
  const definitionFor=record=>getDefinition({rulesetId,kind:'features',id:record.id,versionId:record.definitionVersionId||null});
  const release=(record,target)=>{
    const targets=record.boundTargetIds||[];if(!record.bound||!targets.includes(target))return;
    const binding=featureBindingInfo(definitionFor(record),record);if(!binding)fail('Cannot safely release AP without the active binding definition.');
    record.boundTargetIds=targets.filter(id=>id!==target);record.bound=record.boundTargetIds.length>0;
    const cost=integer(record.boundApCostEach??binding.apCost*(binding.perRank?Math.max(1,Number(record.rank||1)):1),'Stored binding cost',1);
    td.currentAp=Math.min(model.derived.maxAp,td.currentAp+cost);events.push(`${record.name||record.id}: ${cost} AP returned.`);
    if(record.boundChoices)delete record.boundChoices[target];
    if(state.markFocusId===target)state.markFocusId=null;
    if(record.id==='shared-senses'&&state.sensoryFocusId===target)state.sensoryFocusId=null;
    if(record.id==='alarm-runes'){const glyph=entities.find(e=>e.id===target);if(glyph){glyph.alarming=false;glyph.trigger='';glyph.explosive=false;}}
  };
  const releaseEntity=id=>{for(const record of td.features)release(record,id);if(state.glyphFocusId===id)state.glyphFocusId=null;};
  const boundTo=(id,target)=>td.features.some(f=>f.id===id&&f.bound&&(f.boundTargetIds||[]).includes(target)&&featureDefinition(updatedTrainer,id,getDefinition,rulesetId));
  const reconcile=()=>events.push(...globalThis.reconcileTrainerChannels(updatedTrainer,pokemon,{getBinding:f=>featureBindingInfo(definitionFor(f),f),getFeatureSource:f=>definitionFor(f)?.sourceId,maxAp:model.derived.maxAp,history:false}));
  reconcile();
  if(action==='options')return {valid:true,...boundEntityOptions({trainer:updatedTrainer,rulesetId,getDefinition,listDefinitions})};
  const channeled=()=>entities.filter(e=>e.kind==='pokemon_link'&&e.active!==false&&e.channeling&&pokemon.some(p=>p.id===e.pokemonId));
  const spiritSource=id=>{
    const link=channeled().find(e=>e.pokemonId===id);if(!link)fail('Choose a Channeled reference Pokémon.');
    if(typeof getPokemonCombatStats!=='function')fail('Resolved Pokémon stats are required.');
    const stats=getPokemonCombatStats(pokemon.find(p=>p.id===id)),keys=['attack','defense','special_attack','special_defense','speed'];
    if(keys.some(k=>!Number.isSafeInteger(stats?.[k])||stats[k]<0))fail('The reference Pokémon has incomplete Combat Stats.');
    const highest=Math.max(...keys.map(k=>stats[k]));return {pokemonId:id,name:link.name,stats:Object.fromEntries(keys.map(k=>[k,stats[k]])),highestStats:keys.filter(k=>stats[k]===highest)};
  };
  if(action==='spirit-options'){
    requireFeature(updatedTrainer,'channeler',getDefinition,rulesetId);requireFeature(updatedTrainer,'spirit-boost',getDefinition,rulesetId);
    const sources=channeled().map(link=>{try{return spiritSource(link.pokemonId);}catch(error){return {pokemonId:link.pokemonId,name:link.name,error:error.message};}});
    return {valid:true,sources,targets:channeled().filter(e=>context.combat?.active===true&&context.combat.participantIds?.includes(e.pokemonId)).map(e=>({pokemonId:e.pokemonId,name:e.name}))};
  }
  if(action==='bind-spirit-boost'||action==='unbind-spirit-boost'){
    const record=td.features[integer(featureIndex,'Feature index')];if(record?.id!=='spirit-boost')fail('Choose Spirit Boost.');
    const definition=requireFeature(updatedTrainer,'spirit-boost',getDefinition,rulesetId),binding=featureBindingInfo(definition,record),targetId=text(data.targetPokemonId,150);
    if(!binding?.stratagem||binding.apCost!==2)fail('Unsupported Spirit Boost binding definition.');
    if(action==='unbind-spirit-boost'){if(!(record.boundTargetIds||[]).includes(targetId))fail('Target has no Spirit Boost binding.');release(record,targetId);events.push('Spirit Boost released · Free Action.');}
    else{
      requireFeature(updatedTrainer,'channeler',getDefinition,rulesetId);
      if(context.combat?.active!==true||!Array.isArray(context.combat.participantIds)||!context.combat.participantIds.includes(targetId))fail('Spirit Boost requires a target in the active combat.');
      if(!channeled().some(e=>e.pokemonId===targetId))fail('Spirit Boost requires a Channeled target Pokémon.');
      if(td.features.some(f=>f.bound&&(f.boundTargetIds||[]).includes(targetId)&&(featureBindingInfo(definitionFor(f),f)?.stratagem||f.boundStratagem)))fail('This Pokémon already has a Bound Stratagem.');
      const chosen=spiritSource(text(data.sourcePokemonId,150)),stat=text(data.stat,30);if(!chosen.highestStats.includes(stat))fail('Choose one of the reference Pokémon’s highest Combat Stats.');
      if(record.boundChoices!=null&&(typeof record.boundChoices!=='object'||Array.isArray(record.boundChoices)))fail('Invalid saved Spirit Boost choices.');
      spend(2);record.bound=true;record.boundTargetIds=[...(record.boundTargetIds||[]),targetId];record.boundApCostEach=2;record.boundStratagem=true;record.boundChoices||={};record.boundChoices={...record.boundChoices,[targetId]:{sourcePokemonId:chosen.pokemonId,sourceName:chosen.name,stat,statsAtBinding:chosen.stats,sourceId:definition.sourceId,sourcePage:definition.sourcePage}};
      events.push(`Spirit Boost · Standard Action · 2 AP Bound · ${chosen.name}: ${stat} · Intuition Rank ${rank('Intuition')}.`);
    }
  }else if(action==='sync'){events.push('Channel links reconciled.');}
  else if(action==='create'){
    if(entities.length>=1000)fail('The entity list has reached its supported limit.');
    const name=text(data.kind==='pokemon_link'?pokemon.find(p=>p.id===data.pokemonId)?.name||data.name:data.name,120);if(!name)fail('An entity name is required.');
    const created={id:`bound-entity-${crypto.randomUUID()}`,kind:data.kind,name,notes:text(data.notes),active:true,createdAt:new Date().toISOString()};
    if(data.kind==='glyph'){
      const source=requireFeature(updatedTrainer,'glyph',getDefinition,rulesetId);Object.assign(created,{sourceId:source.sourceId,sourcePage:source.sourcePage,featureId:'glyph'});
      if(entities.filter(e=>e.kind==='glyph'&&isActive(e)).length>=rank('Occult Education'))fail('Active Glyphs cannot exceed Occult Education Rank.');
      const tag=updatedInventory.find(item=>(item.id==='cleanse-tag'||item.definitionId==='cleanse-tag')&&Number.isInteger(Number(item.qty))&&Number(item.qty)>=1);
      if(!tag)fail('Placing a Glyph requires one Cleanse Tag in the Backpack.');
      if(data.swift===true)spend(1);tag.qty-=1;
      Object.assign(created,{location:text(data.location,500),hp:integer(updatedTrainer.level,'Trainer level',1),maxHp:Number(updatedTrainer.level),visible:data.visible===true,alarming:false,trigger:'',explosive:false,lastTriggeredScene:null});
      events.push(`Glyph placed · ${data.swift?'Swift Action · 1 AP':'Extended Action'} · one Cleanse Tag consumed.`);
    }else if(data.kind==='weapon'){
      const source=requireFeature(updatedTrainer,'arcanist',getDefinition,rulesetId);Object.assign(created,{sourceId:source.sourceId,sourcePage:source.sourcePage,featureId:'arcanist'});
      const item=getDefinition({rulesetId,kind:'items',id:text(data.itemId,150)});
      if(item?.raw?.mechanics?.arcane!==true)fail('Choose an Arcane Weapon from the active Ruleset.');
      Object.assign(created,{itemId:item.id,equipmentSlot:equipmentSlot(data.equipmentSlot,item.id),soulBonded:false,distance:integer(data.distance??0,'Distance'),heldByOther:data.heldByOther===true});
      events.push('Existing Arcane Weapon registered; no item was created or equipped.');
    }else if(data.kind==='external_trainer'){
      Object.assign(created,{willing:data.willing===true,accessDenied:false,distance:integer(data.distance??0,'Distance'),direction:text(data.direction,120)});
      events.push('External Trainer registered.');
    }else if(data.kind==='pokemon_link'){
      const source=requireFeature(updatedTrainer,'channeler',getDefinition,rulesetId),target=pokemon.find(p=>p.id===data.pokemonId);
      if(!target)fail('Choose a Pokémon present in the campaign.');
      if(entities.some(e=>e.kind==='pokemon_link'&&e.pokemonId===target.id))fail('This Pokémon already has a Channel link.');
      Object.assign(created,{name:target.name||target.species||name,pokemonId:target.id,channeling:false,distance:integer(data.distance??0,'Distance'),hostile:data.hostile===true,allied:data.allied===true,sourceId:source.sourceId,sourcePage:source.sourcePage,featureId:'channeler'});
      events.push('Pokémon linked; use Channel to establish the connection.');
    }else fail('Unsupported entity kind.');
    entities.push(created);entityId=created.id;
  }else{
    if(!entity)fail('Entity not found.');
    if(action==='bind'||action==='unbind'){
      const record=td.features[integer(featureIndex,'Feature index')];if(!record||!managed.has(record.id))fail('Choose a supported entity binding.');
      const definition=requireFeature(updatedTrainer,record.id,getDefinition,rulesetId),binding=featureBindingInfo(definition,record);
      if(!binding)fail('The active definition has no Bind cost.');
      if(action==='unbind'){release(record,entity.id);events.push('Binding released.');}
      else{
        if(!isActive(entity))fail('The target entity is inactive.');
        const targets=record.bound?record.boundTargetIds||[]:[];if(targets.includes(entity.id))fail('This target is already Bound.');
        if(td.features.some(f=>f!==record&&f.id===record.id&&f.bound&&(f.boundTargetIds||[]).includes(entity.id)))fail('This entity already has this binding.');
        const cost=binding.apCost*(binding.perRank?Math.max(1,Number(record.rank||1)):1);
        if(record.id==='alarm-runes'){
          if(entity.kind!=='glyph')fail('Alarm Runes requires a Glyph.');
          const trigger=text(data.trigger);if(!trigger)fail('Describe the Alarm Rune trigger.');
          if(data.explosive===true)requireFeature(updatedTrainer,'explosive-runes',getDefinition,rulesetId);
          Object.assign(entity,{trigger,explosive:data.explosive===true});
        }else if(record.id==='mark-of-vision'){
          if(entity.kind!=='external_trainer'||!entity.willing)fail('Mark of Vision requires a willing Trainer.');
          const count=td.features.filter(f=>f.id===record.id&&f.bound).reduce((n,f)=>n+(f.boundTargetIds||[]).length,0);
          if(count>=Math.floor(rank('Perception')/2))fail('Marks cannot exceed half Perception Rank.');
        }else if(record.id==='shared-senses'){
          requireFeature(updatedTrainer,'channeler',getDefinition,rulesetId);
          if(entity.kind!=='pokemon_link'||!entity.channeling||!pokemon.some(p=>p.id===entity.pokemonId))fail('Shared Senses requires a Channeled Pokémon.');
        }else if(record.id==='soul-investment'){
          if(entity.kind!=='weapon'||!entity.soulBonded)fail('Soul Investment requires your Soul Bonded Weapon.');
          if(td.features.some(f=>f.id===record.id&&f.bound))fail('Only one Soul Investment may be Bound.');
          const ids=[text(data.adeptMoveId,100),text(data.masterMoveId,100)];
          if(!ENTITY_MOVE_TIERS.adept.includes(ids[0])||!ENTITY_MOVE_TIERS.master.includes(ids[1]))fail('Choose one Adept and one Master Arcane Weapon Move.');
          for(const id of ids){const move=getDefinition({rulesetId,kind:'moves',id});if(!move)fail('The chosen Move is unavailable.');if(model.moves.some(m=>m.id===id))fail('The chosen Move is already on the Move List.');const limitation=String(move.raw?.limitation_text||'');const item=getDefinition({rulesetId,kind:'items',id:entity.itemId});const melee=String(item?.raw?.mechanics?.range||'').toLowerCase().includes('melee');if(/melee weapons only/i.test(limitation)&&!melee||/ranged weapons only/i.test(limitation)&&melee)fail('The chosen Move does not match this Weapon.');}
          entity.investmentMoves=ids;
        }
        spend(cost);record.bound=true;record.boundTargetIds=[...targets,entity.id];record.boundApCostEach=cost;record.boundStratagem=false;
        events.push(`${definition.name} · ${binding.action} · ${cost} AP Bound.`);
      }
    }else if(action==='damage'){
      if(entity.kind!=='glyph')fail('Only Glyphs have tracked HP.');entity.hp=Math.max(0,entity.hp-integer(data.amount,'Damage',1));
      if(!entity.hp){entity.active=false;releaseEntity(entity.id);}events.push(`Glyph HP ${entity.hp}/${entity.maxHp}.`);
    }else if(action==='deactivate'||action==='delete'){
      releaseEntity(entity.id);entity.active=false;if(entity.kind==='pokemon_link')entity.channeling=false;events.push(action==='delete'?'Entity deleted; its bindings were released.':'Entity deactivated; its bindings were released.');
      if(action==='delete'){if(entity.kind==='pokemon_link')reconcile();entities.splice(entities.indexOf(entity),1);}
    }else if(action==='trigger'){
      if(entity.kind!=='glyph'||!isActive(entity)||!boundTo('alarm-runes',entity.id))fail('An active Bound Alarm Rune is required.');
      if(integer(data.distance,'Trigger distance')>30)fail('The trigger must occur within 30 meters of the Rune.');
      if(entity.lastTriggeredScene===scene)fail('This Rune has already triggered this Scene.');
      if(entity.explosive){
        const reason=!featureDefinition(updatedTrainer,'explosive-runes',getDefinition,rulesetId)?'Explosive Runes unavailable':state.lastExplosionRound===round?'one Glyph already exploded this round':!model.moves.some(m=>m.id==='hidden-power')?'Hidden Power unavailable':td.currentAp<1?'no available AP':null;
        if(reason)events.push(`Alarm only; explosion skipped: ${reason}.`);
        else{spend(1);state.lastExplosionRound=round;entity.lastAttack={moveId:'hidden-power',origin:entity.id,action:'Free Action',round,stats:structuredClone(model.stats.combat),source:'Editation p.48'};events.push('Hidden Power used from the Glyph · Free Action · 1 AP. Resolve the attack using the recorded Trainer stats.');}
      }
      entity.lastTriggeredScene=scene;entity.visible=true;entity.alarming=true;events.push('Alarm triggered; Glyph visible and screeching.');
    }else if(action==='silence'){
      if(entity.kind!=='glyph')fail('Choose a Glyph.');entity.alarming=false;events.push('Alarm silenced · Free Action.');
    }else if(action==='channel'){
      requireFeature(updatedTrainer,'glyph',getDefinition,rulesetId);if(entity.kind!=='glyph'||!isActive(entity))fail('Choose an active Glyph.');state.glyphFocusId=entity.id;entity.visible=true;events.push('Glyph channeled · Standard Action; senses and voice relay active.');
    }else if(action==='channel-pokemon'){
      requireFeature(updatedTrainer,'channeler',getDefinition,rulesetId);
      if(td.currentHp!=null&&Number(td.currentHp)<=0)fail('A Fainted Trainer cannot Channel.');
      if(entity.kind!=='pokemon_link'||!pokemon.some(p=>p.id===entity.pokemonId))fail('Choose a campaign Pokémon link.');
      if(entity.channeling)fail('This Pokémon is already Channeled.');
      if(entity.distance>20)fail('Channeling requires the Pokémon within 20 meters.');
      if(entities.filter(e=>e.kind==='pokemon_link'&&e.channeling&&e.active!==false).length>=rank('Intuition'))fail('Channeled Pokémon cannot exceed Intuition Rank.');
      if(entity.hostile&&integer(data.intuitionCheck??0,'Intuition Check')<15)fail('A Hostile Pokémon requires an Intuition Check of at least 15.');
      entity.active=true;entity.channeling=true;events.push('Pokémon Channeled · Swift Action. Communication and the past-hour memory impression are available.');
    }else if(action==='stop-channel'){
      if(entity.kind!=='pokemon_link')fail('Choose a Pokémon link.');entity.channeling=false;releaseEntity(entity.id);events.push('Channeling ended · Free Action; Imprint ended as well.');
    }else if(action==='focus-senses'){
      if(entity.kind!=='pokemon_link'||!entity.channeling||!boundTo('shared-senses',entity.id))fail('Choose a Channeled, Imprinted Pokémon.');
      if(state.sensoryChoiceRound===round&&state.sensoryChoiceId!==entity.id)fail('Shared Senses may choose only one Pokémon per round.');
      state.sensoryFocusId=entity.id;state.sensoryChoiceRound=round;state.sensoryChoiceId=entity.id;events.push('Concentrating on this Imprinted Pokémon; one choice per round.');
    }else if(action==='focus'){
      if(entity.kind!=='external_trainer'||!boundTo('mark-of-vision',entity.id)||!entity.willing||entity.accessDenied)fail('This Mark does not currently allow sensory access.');state.markFocusId=entity.id;events.push('Concentrating on this Mark of Vision; the previous Mark is no longer in focus.');
    }else if(action==='access'){
      if(entity.kind!=='external_trainer')fail('Choose an external Trainer.');if(typeof data.denied!=='boolean')fail('Access denied must be true or false.');entity.accessDenied=data.denied;if(data.denied&&state.markFocusId===entity.id)state.markFocusId=null;events.push(data.denied?'Target temporarily denied sensory access; AP remains Bound.':'Target restored sensory access.');
    }else if(action==='consent'){
      if(entity.kind!=='external_trainer'||typeof data.willing!=='boolean')fail('Choose a Trainer and consent state.');entity.willing=data.willing;if(!data.willing)releaseEntity(entity.id);events.push(data.willing?'Target consents to a new Mark.':'Target ended the Mark; AP returned.');
    }else if(action==='position'){
      if(!['weapon','external_trainer','pokemon_link'].includes(entity.kind))fail('This entity has no tracked distance.');entity.distance=integer(data.distance,'Distance');entity.direction=text(data.direction,120);entity.heldByOther=data.heldByOther===true;if(entity.kind==='pokemon_link'){entity.hostile=data.hostile===true;entity.allied=data.allied===true;}if(entity.kind==='weapon')entity.equipmentSlot=equipmentSlot(data.equipmentSlot??entity.equipmentSlot,entity.itemId,entity.id);events.push('Position updated.');
    }else if(action==='soul-bond'){
      requireFeature(updatedTrainer,'arcanist',getDefinition,rulesetId);if(entity.kind!=='weapon'||!isActive(entity))fail('Choose an active Arcane Weapon.');
      for(const other of entities.filter(e=>e.kind==='weapon'&&e.id!==entity.id&&e.soulBonded)){other.soulBonded=false;releaseEntity(other.id);}entity.soulBonded=true;events.push('Soul Bond formed · Extended Action; previous Weapon bonds ended.');
    }else if(action==='beckon'){
      requireFeature(updatedTrainer,'arcanist',getDefinition,rulesetId);if(entity.kind!=='weapon'||!entity.soulBonded||!isActive(entity))fail('Choose your Soul Bonded Weapon.');if(entity.distance>10)fail('Beckoning requires the Weapon within 10 meters.');if(entity.heldByOther&&data.opposedCheckSucceeded!==true)fail('An unwilling holder requires a successful Occult vs Athletics Opposed Check.');entity.distance=0;entity.heldByOther=false;events.push('Weapon beckoned to your hands · Shift Action.');
    }else if(action==='stop-focus'){
      if(state.sensoryFocusId===entity.id)state.sensoryFocusId=null;if(state.markFocusId===entity.id)state.markFocusId=null;if(state.glyphFocusId===entity.id)state.glyphFocusId=null;events.push('Concentration ended; bindings remain.');
    }else fail('Unsupported entity action.');
  }
  reconcile();
  const after=resolveTrainerModel({trainer:updatedTrainer,rulesetId,getDefinition,getDamageBase});
  td.currentAp=Math.max(0,Math.min(td.currentAp,after.derived.availableMaxAp));
  td.boundEntityHistory=Array.isArray(td.boundEntityHistory)?td.boundEntityHistory:[];
  td.boundEntityHistory.push({at:new Date().toISOString(),action,entityId,scene,round,apBefore:beforeAp,apAfter:td.currentAp,events});td.boundEntityHistory=td.boundEntityHistory.slice(-100);
  return {valid:true,updatedTrainer,updatedInventory,entityId,events,apBefore:beforeAp,apAfter:td.currentAp};
}
