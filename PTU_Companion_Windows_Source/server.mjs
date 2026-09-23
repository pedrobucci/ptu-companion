import {createServer} from 'node:http';
import {readFile, stat, mkdir, writeFile, copyFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {extname, join, normalize, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openDatabase} from './persistence/database.mjs';
import {CampaignRepository} from './persistence/repository.mjs';
import {DefinitionRepository, ALLOWED_KINDS} from './definitions/repository.mjs';
import {importContentPack, listPackImportHistory} from './definitions/pack-importer.mjs';
import {getContentPackManagementInfo, setContentPackEnabled, uninstallContentPack} from './definitions/pack-manager.mjs';
import {syncBundledPackIfNewer} from './definitions/bundled-pack-upgrade.mjs';
import {buildPokemonPreview, buildPokemonProgressionPreview, buildPokemonRestatPreview, autoBalancedAllocations, NATURES, parseTutorPointCost, evaluatePokeEdgePrerequisite, moveTrainingPoolUsage, isNaturalTutorMove, tutorRestrictionForMove, relationExemptionsFromPokeEdges, isUnderdogPokemon, pokeEdgeRequiresUnderdog, levelAbilitySlots, eligibleAbilities, applyNature, normalizeBaseStats, normalizeAllocations, STAT_KEYS, validateBaseRelations} from './rules/pokemon-engine.mjs';
import {getPokemonModifierSummary, resolveMoveDamage} from './rules/modifier-engine.mjs';
import {resolveHeldItemEffect, applyHeldItemToTypeProfile, applyHeldItemToEffectiveStats} from './rules/held-item-engine.mjs';
import {resolveTrainerModel} from './rules/trainer-engine.mjs';
import {previewTrainerProgression,applyTrainerProgression,previewTrainerXpPurchase,applyTrainerXpPurchase} from './rules/trainer-progression-engine.mjs';
import {itemUsageMetadata} from './rules/item-metadata.mjs';

const projectRoot=fileURLToPath(new URL('.',import.meta.url));
const staticRoot=join(projectRoot,'static-preview');
const dataRoot=process.env.PTU_DATA_DIR?resolve(process.env.PTU_DATA_DIR):join(projectRoot,'data');
const dbPath=join(dataRoot,'ptu_companion.sqlite3');
const seedPath=join(projectRoot,'seed','default-state.json');
const bundledDefinitionsPath=join(projectRoot,'seed','definitions','ptu_seed_v1.0.sqlite3');
const persistentDefinitionsRoot=join(dataRoot,'definitions');
const definitionsPath=join(persistentDefinitionsRoot,'ptu_definitions.sqlite3');
const definitionBackupRoot=join(persistentDefinitionsRoot,'backups');
await mkdir(persistentDefinitionsRoot,{recursive:true});
if(!existsSync(definitionsPath)) await copyFile(bundledDefinitionsPath,definitionsPath);
await syncBundledPackIfNewer({persistentDbPath:definitionsPath,bundledDbPath:bundledDefinitionsPath,packId:'campaign-homebrew-fakemon-1-leva',backupDir:definitionBackupRoot});
await syncBundledPackIfNewer({persistentDbPath:definitionsPath,bundledDbPath:bundledDefinitionsPath,packId:'campaign-homebrew-custom-weapons',backupDir:definitionBackupRoot});
await syncBundledPackIfNewer({persistentDbPath:definitionsPath,bundledDbPath:bundledDefinitionsPath,packId:'campaign-homebrew-trainer-gear',backupDir:definitionBackupRoot});
const portraitCacheRoot=join(dataRoot,'portraits');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};

// Desktop launcher lifetime handshake. The Windows launcher intentionally detaches
// the local Node process because Chromium/Edge may hand the app window off to an
// existing browser process and return immediately. In desktop mode the UI sends a
// small heartbeat; if the window is gone the local server shuts itself down.
const desktopSession=process.env.PTU_DESKTOP_SESSION==='1';
const desktopIdleMs=Math.max(15000,Number(process.env.PTU_DESKTOP_IDLE_MS||60000));
let lastDesktopHeartbeat=Date.now();
let desktopHeartbeatSeen=false;

const db=openDatabase(dbPath);
const repo=new CampaignRepository(db);
const definitions=new DefinitionRepository(definitionsPath);
const rulesets=definitions.getRulesets();
const configuredRuleset=db.prepare("SELECT value FROM app_meta WHERE key='active_ruleset_id'").get()?.value;
const defaultRuleset=rulesets.some(r=>r.id===configuredRuleset)?configuredRuleset:(rulesets.some(r=>r.id==='all-provided-material')?'all-provided-material':rulesets[0]?.id);
if(defaultRuleset) db.prepare(`INSERT INTO app_meta(key,value) VALUES('active_ruleset_id',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(defaultRuleset);
const getActiveRuleset=()=>db.prepare("SELECT value FROM app_meta WHERE key='active_ruleset_id'").get()?.value || defaultRuleset;
const seed=JSON.parse(await readFile(seedPath,'utf8'));
if(!repo.hasProfiles()) repo.saveState({...seed,version:2},{createRevision:true});

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
    details:{background:{name:'New Background',adept:'Athletics',novice:'Command',pathetic:['Guile','Intuition','Focus']},skillRanks:Object.fromEntries(['Acrobatics','Athletics','Combat','Intimidate','Stealth','Survival','General Education','Medicine Education','Occult Education','Pokémon Education','Technology Education','Guile','Perception','Charm','Command','Focus','Intuition'].map(k=>[k,2])),features:[],edges:[],moves:[],trainingFeature:null,currentHp:null,tempHp:0,injuries:0,currentAp:null,combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}}
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

function json(res,status,data){
  const body=JSON.stringify(data,null,2);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(body)});
  res.end(body);
}
async function bodyJson(req,maxBytes=5_000_000){
  const chunks=[]; let size=0;
  for await(const chunk of req){ size+=chunk.length; if(size>maxBytes) throw Object.assign(new Error('Request body too large'),{status:413}); chunks.push(chunk); }
  if(!chunks.length) return {};
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch{throw Object.assign(new Error('Invalid JSON body'),{status:400});}
}
async function bodyBuffer(req,maxBytes=128*1024*1024){
  const chunks=[]; let size=0;
  for await(const chunk of req){ size+=chunk.length; if(size>maxBytes) throw Object.assign(new Error('Request body too large'),{status:413}); chunks.push(chunk); }
  return Buffer.concat(chunks);
}

async function handleApi(req,res,url){
  if((req.method==='POST' || req.method==='GET') && url.pathname==='/api/desktop/heartbeat'){
    lastDesktopHeartbeat=Date.now();
    desktopHeartbeatSeen=true;
    return json(res,200,{ok:true,desktopSession});
  }
  if(req.method==='GET' && url.pathname==='/api/health'){
    return json(res,200,{ok:true,version:'2.1.0-beta.20',persistence:'sqlite',database:dbPath,schemaVersion:5,definitions:{database:definitionsPath,persistent:true,activeRuleset:getActiveRuleset()}});
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
    const enabledById=new Map((definitions.getRuleset(activeRulesetId)?.packs||[]).map(p=>[p.pack_id,{enabled:!!p.enabled,priority:Number(p.priority||0),position:Number(p.position||0)}]));
    const management=getContentPackManagementInfo(definitionsPath);
    return json(res,200,{activeRulesetId,packs:definitions.getPacks().map(p=>({...p,...(enabledById.get(p.id)||{enabled:false}),...(management[p.id]||{})})),imports:listPackImportHistory(definitionsPath,30)});
  }
  const packEnabledRoute=url.pathname.match(/^\/api\/content-packs\/([^/]+)\/enabled$/);
  if(req.method==='PUT' && packEnabledRoute){
    const packId=decodeURIComponent(packEnabledRoute[1]);
    const payload=await bodyJson(req);
    const rulesetId=String(payload.rulesetId||getActiveRuleset());
    const enabled=!!payload.enabled;
    try{
      const result=setContentPackEnabled({dbPath:definitionsPath,rulesetId,packId,enabled});
      return json(res,200,{ok:true,result,activeRulesetId:getActiveRuleset(),ruleset:definitions.getRuleset(rulesetId),counts:definitions.getCounts(rulesetId)});
    }catch(error){throw Object.assign(new Error(error?.message||'Could not update Content Pack state.'),{status:400});}
  }
  const packDeleteRoute=url.pathname.match(/^\/api\/content-packs\/([^/]+)$/);
  if(req.method==='DELETE' && packDeleteRoute){
    const packId=decodeURIComponent(packDeleteRoute[1]);
    try{
      const result=await uninstallContentPack({dbPath:definitionsPath,backupDir:definitionBackupRoot,packId});
      return json(res,200,{ok:true,result,activeRulesetId:getActiveRuleset(),counts:definitions.getCounts(getActiveRuleset())});
    }catch(error){throw Object.assign(new Error(error?.message||'Could not uninstall Content Pack.'),{status:400});}
  }
  if(req.method==='POST' && url.pathname==='/api/content-packs/import'){
    const archive=await bodyBuffer(req);
    if(!archive.length) throw Object.assign(new Error('No .ptucp archive was received.'),{status:400});
    const archiveFilename=decodeURIComponent(String(req.headers['x-ptu-filename']||'import.ptucp'));
    if(!archiveFilename.toLowerCase().endsWith('.ptucp')) throw Object.assign(new Error('Content packs must use the .ptucp extension.'),{status:400});
    try{
      const result=await importContentPack({buffer:archive,dbPath:definitionsPath,backupDir:definitionBackupRoot,enableRulesetId:getActiveRuleset(),archiveFilename});
      return json(res,200,{ok:true,result,activeRulesetId:getActiveRuleset(),counts:definitions.getCounts(getActiveRuleset())});
    }catch(error){
      throw Object.assign(new Error(error?.message||'Content pack import failed.'),{status:400});
    }
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
  if(req.method==='GET' && portraitMatch){
    const speciesId=decodeURIComponent(portraitMatch[1]);
    const rulesetId=String(url.searchParams.get('ruleset')||getActiveRuleset());
    const species=definitions.getResolved({rulesetId,kind:'species',id:speciesId});
    if(!species)return json(res,404,{error:'Species not found'});
    const packedPortrait=String(species.raw?.portrait_data_url||'');
    const packedMatch=packedPortrait.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if(packedMatch){
      const bytes=Buffer.from(packedMatch[2],'base64');
      res.writeHead(200,{'Content-Type':packedMatch[1],'Cache-Control':'public, max-age=2592000','Content-Length':bytes.length});
      return res.end(bytes);
    }
    await mkdir(portraitCacheRoot,{recursive:true});
    const cacheId=String(species.id||speciesId).replace(/[^a-zA-Z0-9._-]+/g,'-');
    const cacheFile=join(portraitCacheRoot,`${cacheId}.png`);
    let bytes=null;
    if(existsSync(cacheFile))bytes=await readFile(cacheFile).catch(()=>null);
    if(!bytes){ bytes=await fetchPokemonPortrait(species.id,species.name); if(bytes)await writeFile(cacheFile,bytes).catch(()=>{}); }
    if(!bytes){
      const fallback=await readFile(join(staticRoot,'creatures','default.svg'));
      res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'public, max-age=3600'}); return res.end(fallback);
    }
    res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=2592000','Content-Length':bytes.length});
    return res.end(bytes);
  }
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
  if(req.method==='DELETE' && url.pathname.startsWith('/api/profiles/')){
    const id=decodeURIComponent(url.pathname.slice('/api/profiles/'.length));
    if(!id || id==='active') throw Object.assign(new Error('Trainer profile id is required'),{status:400});
    const profile=repo.listProfiles().find(p=>p.id===id);
    if(!profile) throw Object.assign(new Error('Trainer profile not found'),{status:404});
    let activeProfileId=repo.deleteProfile(id);
    let replacementCreated=false;
    if(!activeProfileId){
      const replacement=blankTrainerState({name:'New Trainer',title:'Trainer'});
      repo.saveState(replacement,{createRevision:true});
      activeProfileId=replacement.activeProfileId;
      replacementCreated=true;
    }
    return json(res,200,{
      ok:true,
      deletedProfileId:id,
      replacementCreated,
      state:hydrateStateForClient(repo.loadState(activeProfileId)),
      profiles:repo.listProfiles()
    });
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

async function serveStatic(req,res,url){
  let pathname=decodeURIComponent(url.pathname);
  if(pathname==='/') pathname='/index.html';
  const relative=normalize(pathname).replace(/^([/\\])+/, '').replace(/^([.][.][/\\])+/, '');
  let file=resolve(staticRoot,relative);
  if(!file.startsWith(resolve(staticRoot))) { res.writeHead(403); return res.end('Forbidden'); }
  let s=await stat(file).catch(()=>null);
  if(s?.isDirectory()){ file=join(file,'index.html'); s=await stat(file).catch(()=>null); }
  if(!s){ res.writeHead(404); return res.end('Not found'); }
  const data=await readFile(file);
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
  res.end(data);
}

const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  try{
    if(url.pathname.startsWith('/api/')){
      const handled=await handleApi(req,res,url);
      if(handled===false) json(res,404,{error:'API endpoint not found'});
      return;
    }
    await serveStatic(req,res,url);
  }catch(error){
    console.error(error);
    json(res,error.status||500,{error:error.message||'Internal server error'});
  }
});

const port=Number(process.env.PTU_PORT||4173);
server.listen(port,'127.0.0.1',()=>{
  console.log(`PTU Companion Beta v2.1.0-beta.20: http://127.0.0.1:${port}`);
  console.log(`Campaign SQLite: ${dbPath}`);
  console.log(`Persistent Definition SQLite: ${definitionsPath}`);
  console.log(`Active ruleset: ${getActiveRuleset()}`);
});

if(desktopSession){
  const desktopLifetimeTimer=setInterval(()=>{
    const idleFor=Date.now()-lastDesktopHeartbeat;
    if(idleFor<desktopIdleMs) return;
    console.log(`Desktop heartbeat idle for ${idleFor} ms; shutting down local server.`);
    clearInterval(desktopLifetimeTimer);
    server.close(()=>process.exit(0));
    setTimeout(()=>process.exit(0),3000).unref();
  },5000);
  desktopLifetimeTimer.unref();
  console.log(`Desktop lifetime mode enabled (idle timeout ${desktopIdleMs} ms).`);
}
