/*
 * PTU Companion — Beta v2.1.0-beta.30
 * No dependencies, no build step, runs offline in a browser.
 *
 * This is deliberately a UI/domain reference implementation. The final Tauri app
 * should move persistence and PTU rules into Rust/SQLite services, while preserving
 * these workflows and visual language.
 */

const STORAGE_KEY = 'ptu-companion-functional-v14';
const V07_STORAGE_KEY = 'ptu-companion-functional-v05';
const PREVIOUS_STORAGE_KEY = 'ptu-companion-functional-v04';
const LEGACY_STORAGE_KEY = 'ptu-companion-functional-v02';
const TYPE_COLORS = {
  bug:'#91A119', dark:'#624D4E', dragon:'#5060E1', electric:'#FAC000', fairy:'#EF70EF',
  fighting:'#FF8000', fire:'#E62829', flying:'#81B9EF', ghost:'#704170', grass:'#3FA129',
  ground:'#915121', ice:'#3DCEF3', normal:'#9FA19F', poison:'#9141CB', psychic:'#EF4179',
  rock:'#AFA981', steel:'#60A1B8', water:'#2980EF'
};

const defaultState = () => ({
  version: 2,
  activeProfileId: 'alex',
  trainer: {
    id:'alex', name:'Alex Rowan', title:'Rookie Tamer', level:18, exp:0, nextExp:10, portraitDataUrl:null,
    money:12500, ptuPoints:240, badges:4,
    stats:{hp:20, attack:22, defense:18, spAttack:18, spDefense:18, speed:18},
    derived:{maxHp:56, attack:42, defense:38, spAttack:51, spDefense:46, speed:58},
    skills:{Athletics:'4d6', Acrobatics:'3d6', Combat:'4d6', Intimidate:'3d6', Education:'3d6', Medicine:'2d6', Technology:'4d6', Perception:'3d6', Charm:'2d6', Command:'4d6', Focus:'4d6', Stealth:'5d6+2'},
    equipment:{head:'Trainer Cap', body:'Windbreaker', mainHand:'Power Glove', offHand:'Guard Shield', feet:'Running Shoes', accessory:'Focus Charm'},
    modifiers:[
      {id:'mod-rest',label:'Well Rested',target:'XP',value:'+5%',kind:'temporary'},
      {id:'mod-food',label:'Nutritious Meal',target:'HP',value:'+10',kind:'temporary'},
      {id:'mod-focus',label:'Training Focus',target:'Accuracy',value:'+1',kind:'temporary'},
    ],
    gmGrants:[{id:'gm-1',type:'fixed',label:'+2 Stealth',target:'Stealth',value:'+2',createdAt:'2026-09-01'}],
    history:[
      {id:'h1',date:'2026-08-20',title:'Reached Level 18',detail:'Trainer progression'},
      {id:'h2',date:'2026-09-01',title:'GM Grant',detail:'+2 Stealth (permanent)'},
    ],
    details:{
      background:{name:'Custom Background',adept:'Athletics',novice:'Command',pathetic:['Guile','Intuition','Focus']},
      skillRanks:{'Acrobatics':3,'Athletics':4,'Combat':4,'Intimidate':3,'Stealth':5,'Survival':2,'General Education':3,'Medicine Education':2,'Occult Education':2,'Pokémon Education':3,'Technology Education':4,'Guile':2,'Perception':3,'Charm':2,'Command':4,'Focus':4,'Intuition':2},
      features:[],edges:[],moves:[],trainingFeature:null,currentHp:null,tempHp:0,injuries:0,currentAp:null,combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}
    }
  },
  pokemon:[
    {id:'sparkit',name:'Sparkit',species:'Voltkit',level:18,types:['electric'],hp:56,maxHp:56,tempHp:0,injuries:0,ball:'Ultra Ball',heldItem:null,img:'creatures/sparkit.svg',storage:false,loyalty:4,rosterIds:['personal','company'],combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}},
    {id:'drakion',name:'Drakion',species:'Ember Drake',level:18,types:['dragon','fire'],hp:72,maxHp:72,tempHp:0,injuries:0,ball:'Great Ball',heldItem:'Oran Berry',img:'creatures/drakion.svg',storage:false,loyalty:4,rosterIds:['personal','company'],combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}},
    {id:'gempy',name:'Gempy',species:'Impurro',level:17,types:['dark','ghost'],hp:28,maxHp:48,tempHp:0,injuries:2,ball:'Dusk Ball',heldItem:'Focus Charm',img:'creatures/gempy.svg',storage:false,loyalty:4,rosterIds:['personal'],combatStages:{attack:-1,defense:0,spAttack:2,spDefense:0,speed:1,accuracy:0,evasion:0}},
    {id:'voltix',name:'Voltix',species:'Aquavolt',level:17,types:['water'],hp:64,maxHp:64,tempHp:0,injuries:0,ball:'Poké Ball',heldItem:null,img:'creatures/voltix.svg',storage:false,loyalty:3,rosterIds:['personal','mounts'],combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}},
    {id:'rocky',name:'Rocky',species:'Terranox',level:16,types:['ground'],hp:78,maxHp:78,tempHp:0,injuries:0,ball:'Heavy Ball',heldItem:null,img:'creatures/rocky.svg',storage:false,loyalty:3,rosterIds:['personal','company','mounts'],combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}},
    {id:'florin',name:'Florin',species:'Leafin',level:16,types:['grass'],hp:54,maxHp:54,tempHp:0,injuries:0,ball:'Friend Ball',heldItem:null,img:'creatures/florin.svg',storage:false,loyalty:5,rosterIds:['personal'],combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}},
    {id:'snowbell',name:'Snowbell',species:'Frostling',level:15,types:['ice'],hp:44,maxHp:44,tempHp:0,injuries:0,ball:'Premier Ball',heldItem:null,img:'creatures/snowbell.svg',storage:true,loyalty:3,rosterIds:[],combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}},
    {id:'emberpup',name:'Emberpup',species:'Cinder Pup',level:14,types:['fire'],hp:42,maxHp:42,tempHp:0,injuries:0,ball:'Poké Ball',heldItem:null,img:'creatures/emberpup.svg',storage:true,loyalty:3,rosterIds:[],combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}},
  ],
  rosters:[
    {id:'personal',name:'Personal Team',role:'COMBAT',maxMembers:6,active:true,color:'#0b7b4b'},
    {id:'company',name:'Company Team',role:'COMPANY',maxMembers:6,active:true,color:'#2f6dda'},
    {id:'mounts',name:'Mounts',role:'MOUNT',maxMembers:6,active:true,color:'#e99a19'}
  ],
  inventory:[
    {id:'potion',icon:'🧪',name:'Potion',category:'medicine',price:300,qty:24,consumable:true,equipSlot:null},
    {id:'super-potion',icon:'🧴',name:'Super Potion',category:'medicine',price:700,qty:12,consumable:true,equipSlot:null},
    {id:'poke-ball',icon:'🔴',name:'Poké Ball',category:'pokeball',price:200,qty:36,consumable:true,equipSlot:null},
    {id:'great-ball',icon:'🔵',name:'Great Ball',category:'pokeball',price:600,qty:18,consumable:true,equipSlot:null},
    {id:'oran-berry',icon:'🫐',name:'Oran Berry',category:'berry',price:100,qty:15,consumable:true,equipSlot:null},
    {id:'escape-rope',icon:'🪢',name:'Escape Rope',category:'general',price:550,qty:7,consumable:true,equipSlot:null},
    {id:'running-shoes',icon:'👟',name:'Running Shoes',category:'general',price:1200,qty:1,consumable:false,equipSlot:'feet'},
    {id:'focus-charm',icon:'🔷',name:'Focus Charm',category:'battle',price:1250,qty:1,consumable:false,equipSlot:'accessory'},
    {id:'two-handed-sword',icon:'⚔️',name:'Two-Handed Sword',category:'weapon',price:6000,qty:0,consumable:false,equipSlot:'mainHand',mechanics:{kind:'weapon',quality:'Fine',weaponClass:'large_melee',hands:2,metal:true,range:'Melee',acModifier:1,dbModifier:2,weaponMoves:{adept:'backswing',master:'slice'},tags:['Melee','Large Melee','Two-Handed','Sword']}},
  ],
  shop:{preset:'Poké Mart',discountPct:0,mode:'buy',cart:{}},
  npcs:[
    {id:'npc-marlowe',initials:'DM',name:'Dr. Marlowe',role:'Researcher',tag:'Merchant',affiliation:'Independent',lastSeen:'Seaport Town — East Dock',description:'A researcher interested in unusual Poké Ball technology.',notes:['Knows the ruins near Route 12.','Interested in ancient Poké Balls.']},
    {id:'npc-vega',initials:'CV',name:'Captain Vega',role:'Company Supervisor',tag:'Organization',affiliation:'Company',lastSeen:'HQ',description:'Supervisor responsible for company Pokémon authorization.',notes:['Can approve special-use Pokémon.']},
    {id:'npc-lira',initials:'LI',name:'Lira',role:'Ranger',tag:'Ally',affiliation:'Rangers',lastSeen:'North Trail',description:'Reliable field contact.',notes:['Helped the group during the storm.']}
  ],
  selectedPokemonId:'gempy', selectedRosterId:'personal', selectedNpcId:'npc-marlowe',
  ui:{screen:'dashboard',creatureTab:'sheet',trainerTab:'profile',toast:null,round:1,scene:1,day:1,gmOverride:false}
});

let state = defaultState();
let persistenceMode = 'starting';
let lastSavedAt = null;
let saveQueue = Promise.resolve();

const DEFINITION_KINDS = [
  ['species','Pokédex'],['moves','Moves'],['abilities','Abilities'],['features','Features'],
  ['edges','Edges'],['poke_edges','Poké Edges'],['capabilities','Capabilities'],['items','Items'],
  ['move_keywords','Move Keywords']
];
/* STAGE_A9_MOVE_KEYWORD_CATALOG_START */
const MOVE_KEYWORD_CATALOG=Object.freeze([{"id":"aura","name":"Aura","sourcePage":"339","effect":"Creates an area around the user, usually a Burst or Cone. The Aura remains until the user is Knocked Out or leaves the field, and may be interacted with outside its creator’s turn when the Move allows."},{"id":"berry","name":"Berry","sourcePage":"339","effect":"Used by Natural Gift. The equipped Berry determines Natural Gift’s Type and Damage Base according to the stored Digestion Buff."},{"id":"blessing","name":"Blessing","sourcePage":"339","effect":"Only one Blessing may affect a target or area at a time unless a Move says otherwise; a new Blessing replaces the old one. Blessings can be deliberately attacked and dispelled by sufficiently strong Ghost- or Fairy-type damage."},{"id":"coat","name":"Coat","sourcePage":"339","effect":"A Coat may cover a target or area; only one Coat may apply at a time. A new Coat replaces the old one, and area Coats can be targeted and dispelled like Blessings."},{"id":"dash","name":"Dash","sourcePage":"339","effect":"As a free action before or after the Move, the user may shift up to half its Movement Capability (minimum 1) without provoking free strikes. This cannot be used if the user already took a Shift Action that round."},{"id":"double-strike","name":"Double Strike","sourcePage":"339","effect":"The attack hits twice and may use one or two targets. Each hit uses a reduced Damage Base from the Double Strike table; if the attack is a Critical Hit, both hits are Critical Hits.","reference":"Damage Base mapping: 1→1, 2→1, 3→2, 4→2, 5→3, 6→3, 7→4, 8→4, 9→5, 10→5, 11→6, 12→6, 13→7, 14→7, 15→7, 16→8, 17→8, 18→8, 19→9, 20→9, 21→10, 22→10, 23→10, 24→11, 25→11, 26→11, 27→12, 28→12."},{"id":"environ","name":"Environ","sourcePage":"339–340","effect":"The Move can only be used in one of its listed environments. Natural Gift uses the current environment to determine its damage Type.","reference":"Natural Gift environment Types: Forest/Urban → Grass; Beach/Desert → Ground; Wetlands/Ocean → Water; Arctic → Ice; Mountain/Cave → Rock; Building → Normal; Aerial → Flying; Thunderstorm → Electric."},{"id":"execute","name":"Execute","sourcePage":"340","effect":"May be declared Priority (Advanced) when the target is at or below 20% of its maximum Hit Points."},{"id":"exhaust","name":"Exhaust","sourcePage":"340","effect":"May be used only once per Scene. Direct Frequency-refresh effects cannot restore it, though rest or specially stated effects may allow another use."},{"id":"fling","name":"Fling","sourcePage":"340","effect":"Uses the user’s Held Item to determine a secondary effect on the target. The user does not receive the item’s benefit; the item is only destroyed if its normal use would consume it.","reference":"PTU 1.05 assigns different Fling effects to Food/Berries, Potions, Status-healing items, Evolution Stones, Held Items, and objects by weight."},{"id":"friendly","name":"Friendly","sourcePage":"340","effect":"Does not make an Accuracy Check and cannot miss, though Critical Hits are still rolled. It ignores several usual attack-interaction effects such as Evasion changes, concealment, and Interception."},{"id":"five-strike","name":"Five Strike","sourcePage":"340","effect":"Roll 1d8+1 to determine from one to five hits; total Damage Base is multiplied by the number of hits.","reference":"1 hit ×1 DB; 2 hits ×2 DB; 3 hits ×3 DB; 4 hits ×4 DB; 5 hits ×5 DB."},{"id":"groundsource","name":"Groundsource","sourcePage":"340","effect":"The user must be touching firm ground. It cannot be used while airborne, floating, or over deep water."},{"id":"hazard","name":"Hazard","sourcePage":"340","effect":"Sets a trap on a target, area, or on the user as a carried trap. If the attack also deals damage, that damage applies only the first round the Hazard affects a target."},{"id":"illusion","name":"Illusion","sourcePage":"340","effect":"Falsifies one or more senses, normally specified by the Move. Mean Look, Sky Drop, and Role Play are exceptions even though they use the Illusion keyword."},{"id":"interrupt","name":"Interrupt","sourcePage":"340","effect":"May be declared during another combatant’s turn when its trigger is met. The user normally spends the required action type unless the Move or trigger explicitly says otherwise."},{"id":"pass","name":"Pass","sourcePage":"340","effect":"Before rolling, the user may forgo the Move. Its Frequency is not spent and the user keeps the Standard Action."},{"id":"pledge","name":"Pledge","sourcePage":"341","effect":"After using a Pledge Move, the user cannot use another Pledge Move for 4 rounds."},{"id":"powder","name":"Powder","sourcePage":"341","effect":"On a successful Move, its effect remains on the user until the beginning of the user’s next turn."},{"id":"priority","name":"Priority","sourcePage":"341","effect":"May be declared on the user’s turn to act next in Initiative. Priority (Advanced) may be declared whenever; Priority (Limited) functions likewise but is usable only once per Scene."},{"id":"push","name":"Push","sourcePage":"341","effect":"Moves the target the listed number of meters. Unless stated otherwise, the target is pushed away from the user."},{"id":"reaction","name":"Reaction","sourcePage":"341","effect":"Used in response to a stated event, even outside the user’s turn, without consuming an action resource. A given trigger may be reacted to only once."},{"id":"recoil","name":"Recoil","sourcePage":"341","effect":"After a successful attack, the user loses Hit Points equal to one-third of the damage dealt, adjusted by any listed modifier. Recoil ignores defenses, cannot cause Injuries, and cannot reduce the user below 1 Hit Point."},{"id":"set-up","name":"Set-Up","sourcePage":"341","effect":"Requires both a Standard Action and Shift Action remaining. The Shift Action prepares a stated trigger; when it occurs, the user spends the Standard Action to resolve the reaction."},{"id":"shield","name":"Shield","sourcePage":"341","effect":"Activated as an Interrupt against its stated trigger. It spends a Standard Action and also forfeits the user’s Standard Action on the next turn; two Shield Moves cannot be used consecutively."},{"id":"smite","name":"Smite","sourcePage":"341","effect":"Cannot miss, but still rolls to check for a natural 20 Critical Hit. The target must still be in range; damage can be resisted, and the Move cannot be Intercepted or trigger effects that require a miss."},{"id":"social","name":"Social","sourcePage":"341","effect":"Uses a Social Skill instead of an Accuracy Check; the target may oppose with an appropriate Skill instead of Evasion. Parentheses restrict which Social Skill may be used, and the target normally must be able to see and hear the user."},{"id":"sonic","name":"Sonic","sourcePage":"341","effect":"Targets that are Deafened are immune. Otherwise the Move cannot be dodged."},{"id":"spirit-surge","name":"Spirit Surge","sourcePage":"341","effect":"When its triggering condition occurs, activating the effect is optional."},{"id":"trigger","name":"Trigger","sourcePage":"341","effect":"May be used only when its stated triggering condition is met; otherwise it behaves like a normal Move."},{"id":"vortex","name":"Vortex","sourcePage":"341","effect":"Targets in the vortex are Slowed and Trapped and lose Tick Hit Points at the beginning and end of their turns. The vortex ends under the conditions stated by the Move or when its user leaves play."},{"id":"weather","name":"Weather","sourcePage":"341–342","effect":"Changes the current Weather, replacing any existing Weather. Weather normally persists continuously or while sustained, and Moves may gain additional effects from particular Weather."},{"id":"weight-class","name":"Weight Class","sourcePage":"342","effect":"Uses the target’s Weight Class to determine the Move’s effect. PTU defines six Weight Classes from 1–25 lb (WC 1) through over 440 lb (WC 6).","reference":"WC 1: 1–25 lb / 0–11 kg; WC 2: 25–55 lb / 11–25 kg; WC 3: 55–110 lb / 25–50 kg; WC 4: 110–220 lb / 50–100 kg; WC 5: 220–440 lb / 100–200 kg; WC 6: over 440 lb / over 200 kg."}].map(entry=>Object.freeze({...entry,kind:'move_keywords',category:'Move Keyword',packName:'PTU Core 1.05',raw:Object.freeze({description:entry.effect,reference:entry.reference||'',source:'PTU Core 1.05'})})));
function moveKeywordCatalogEntry(id){return MOVE_KEYWORD_CATALOG.find(entry=>entry.id===id)||null;}
function localMoveKeywordRows(query=''){
  const needle=String(query||'').trim().toLowerCase();
  if(!needle)return [...MOVE_KEYWORD_CATALOG];
  return MOVE_KEYWORD_CATALOG.filter(entry=>`${entry.name} ${entry.effect} ${entry.reference||''}`.toLowerCase().includes(needle));
}
function moveKeywordSourceText(move={}){
  const source=move&&typeof move==='object'?move:{};
  const payload=source.payload&&typeof source.payload==='object'?source.payload:source.raw&&typeof source.raw==='object'?source.raw:source;
  const values=[payload.keyword,payload.keywords,payload.tags,payload.range,payload.frequency,payload.effect,source.keyword,source.keywords,source.tags,source.range,source.frequency,source.effect];
  return values.flatMap(value=>Array.isArray(value)?value:[value]).filter(value=>value!=null).map(value=>typeof value==='object'?JSON.stringify(value):String(value)).join(' ');
}
function moveKeywordEntries(move={}){
  const text=moveKeywordSourceText(move); if(!text.trim())return [];
  return MOVE_KEYWORD_CATALOG.filter(entry=>{
    const escaped=entry.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\\-/g,'[- ]');
    return new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`,'i').test(text);
  });
}
function moveKeywordReferenceHtml(move={}){
  const entries=moveKeywordEntries(move); if(!entries.length)return '';
  return `<div class="definition-tags move-keyword-tags"><strong>Move Keywords</strong>${entries.map(entry=>`<button type="button" class="mini-action" onclick="event.stopPropagation();openMoveKeywordInfo('${entry.id}')">${esc(entry.name)}</button>`).join('')}</div>`;
}
function openMoveKeywordInfo(id){
  const entry=moveKeywordCatalogEntry(id); if(!entry)return;
  modal(`<div class="definition-card"><div class="definition-tags">${chip('MOVE KEYWORD','chip-blue')} ${chip(`PTU Core 1.05 · p. ${entry.sourcePage}`,'chip-neutral')}</div><p>${esc(entry.effect)}</p>${entry.reference?`<div class="flow-note"><strong>Reference:</strong> ${esc(entry.reference)}</div>`:''}</div>`,{title:`Move Keyword · ${entry.name}`,subtitle:'PTU Core 1.05 keyword reference'});
}
/* STAGE_A9_MOVE_KEYWORD_CATALOG_END */
let catalogState={available:false,loading:false,error:null,status:null,rulesets:[],kind:'species',query:'',rows:[],total:0,selected:null};
let contentPackState={loading:false,error:null,packs:[],imports:[]};
let itemCatalogState={loading:false,error:null,query:'',items:[]};
function invalidateItemCatalog(){ itemCatalogState={loading:false,error:null,query:'',items:[]}; }
let evolutionGuidanceState=null;
let catalogQueryTimer=null;
let catalogRequestSeq=0;
let pokemonBuilderState={query:'',rows:[],total:0,selected:null,loading:false,error:null,preview:null,previewLoading:false,formResolution:null,resolvedSpecies:null,gmMoveQuery:'',gmMoveRows:[],gmMoveLoading:false,movesTouched:false,form:{nickname:'',level:1,ball:'Poké Ball',loyalty:3,gender:'None',nature:'Hardy',location:'carried',allocations:{hp:0,attack:0,defense:0,special_attack:0,special_defense:0,speed:0},selectedAbilities:[],selectedMoves:[],gmMoves:[],moveLimitModifier:0,baseFormId:'base',manualFormApprovals:[],isShiny:false}};
let pokemonProgressState={pokemonId:null,loading:false,error:null,preview:null,evolutionCandidates:[],form:{progressMode:'xp',expGain:0,targetLevel:null,newStatAllocations:{hp:0,attack:0,defense:0,special_attack:0,special_defense:0,speed:0},evolutionSpeciesId:'',evolutionAllocations:{hp:0,attack:0,defense:0,special_attack:0,special_defense:0,speed:0},selectedAbilities:null,selectedMoves:null,manualEvolutionCondition:false}};
let pokemonTrainingState={pokemonId:null,loading:false,error:null,options:null,moveMethod:'tm_hm',query:''};
let creatureReferenceState={pokemonId:null,loading:false,error:null,data:null};
function invalidateCreatureReference(){ creatureReferenceState={pokemonId:null,loading:false,error:null,data:null}; }
let trainerReferenceState={trainerId:null,loading:false,error:null,data:null};
function invalidateTrainerReference(){ trainerReferenceState={trainerId:null,loading:false,error:null,data:null}; }
function blankTrainerProgressDraft(){return {milestoneChoice:'',milestoneLevelUp:false,statAllocations:{hp:0,attack:0,defense:0,spAttack:0,spDefense:0,speed:0},offensiveStatAllocations:{attack:0,spAttack:0},features:[],edges:[],skillEdges:[]};}
let trainerProgressState={trainerId:null,loading:false,error:null,preview:null,draft:blankTrainerProgressDraft(),pickerKind:null,pickerQuery:''};
function invalidateTrainerProgression(){trainerProgressState={trainerId:null,loading:false,error:null,preview:null,draft:blankTrainerProgressDraft(),pickerKind:null,pickerQuery:''};}
function trainerResolved(){ return trainerReferenceState.trainerId===trainer()?.id ? trainerReferenceState.data?.resolvedTrainer||null : null; }
async function loadTrainerReferenceData(force=false){
  const t=trainer(); if(!t?.id || !(location.protocol==='http:'||location.protocol==='https:')) return;
  if(!force && trainerReferenceState.trainerId===t.id && (trainerReferenceState.data||trainerReferenceState.loading)) return;
  trainerReferenceState={trainerId:t.id,loading:true,error:null,data:force?null:trainerReferenceState.data};
  try{
    const response=await fetch('/api/trainer/reference-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trainer:t})});
    const payload=await response.json(); if(!response.ok)throw new Error(payload.error||'Trainer Rules Engine unavailable');
    if(trainer()?.id!==t.id)return; trainerReferenceState={trainerId:t.id,loading:false,error:null,data:payload};
  }catch(error){ if(trainer()?.id!==t.id)return; trainerReferenceState={trainerId:t.id,loading:false,error:error.message,data:null}; }
  if(state.ui.screen==='trainer')render();
}
let pokemonRestatState={pokemonId:null,loading:false,error:null,preview:null,allocations:null};
let pokemonProgressTimer=null;
let pokemonProgressSeq=0;
let pokemonBuilderTimer=null;
let pokemonBuilderRequestSeq=0;
let pokemonBuildPreviewTimer=null;
let pokemonBuildPreviewSeq=0;
let lastRenderedScreen=null;

async function loadCatalogStatus(){
  if(!(location.protocol==='http:'||location.protocol==='https:')) return;
  try{
    const [statusRes,rulesetsRes,guidanceRes,packsRes]=await Promise.all([fetch('/api/definitions/status',{cache:'no-store'}),fetch('/api/rulesets',{cache:'no-store'}),fetch('/api/pokemon/evolution-guidance',{cache:'no-store'}),fetch('/api/content-packs',{cache:'no-store'})]);
    if(!statusRes.ok) throw new Error('Definition database unavailable');
    catalogState.status=await statusRes.json();
    catalogState.rulesets=rulesetsRes.ok?(await rulesetsRes.json()).rulesets:[];
    evolutionGuidanceState=guidanceRes.ok?await guidanceRes.json():null;
    if(packsRes.ok){const payload=await packsRes.json();contentPackState.packs=payload.packs||[];contentPackState.imports=payload.imports||[];contentPackState.error=null;}
    catalogState.available=true; catalogState.error=null;
  }catch(error){ catalogState.available=false; catalogState.error=error.message; }
}

async function refreshDefinitionRows({keepSelection=false,preserveSearchFocus=false}={}){
  if(catalogState.kind==='move_keywords'){
    const rows=localMoveKeywordRows(catalogState.query); catalogState.loading=false; catalogState.error=null; catalogState.rows=rows; catalogState.total=rows.length;
    if(!catalogState.selected && rows.length)catalogState.selected={definition:rows[0],versions:[]};
    else if(catalogState.selected){const current=moveKeywordCatalogEntry(catalogState.selected.definition?.id); catalogState.selected=current?{definition:current,versions:[]}:null;}
    render(); return;
  }
  if(!catalogState.available){ await loadCatalogStatus(); if(!catalogState.available){ render(); return; } }
  const requestSeq=++catalogRequestSeq;
  const querySnapshot=catalogState.query;
  catalogState.loading=true; catalogState.error=null;
  // Do not rebuild the entire screen while the user is typing. Replacing the input node
  // was the cause of the v0.3 one-character-at-a-time search bug.
  if(!preserveSearchFocus) render();
  try{
    const params=new URLSearchParams({kind:catalogState.kind,q:querySnapshot,limit:'80'});
    const response=await fetch(`/api/definitions?${params}`,{cache:'no-store'});
    if(!response.ok) throw new Error((await response.json().catch(()=>({}))).error||'Could not load definitions');
    const payload=await response.json();
    // Ignore stale results when the query changed while this request was in flight.
    if(requestSeq!==catalogRequestSeq || querySnapshot!==catalogState.query) return;
    catalogState.rows=payload.rows||[]; catalogState.total=payload.total||0;
    if(!keepSelection || !catalogState.selected || catalogState.selected.definition?.kind!==catalogState.kind){ catalogState.selected=null; }
    if(catalogState.rows.length && !catalogState.selected) await loadDefinitionDetail(catalogState.rows[0].id,false);
  }catch(error){
    if(requestSeq!==catalogRequestSeq) return;
    catalogState.error=error.message; catalogState.rows=[]; catalogState.total=0;
  }
  if(requestSeq!==catalogRequestSeq) return;
  catalogState.loading=false; render();
  if(preserveSearchFocus){
    requestAnimationFrame(()=>{
      const input=document.getElementById('definition-search-input');
      if(input){ input.focus(); const n=input.value.length; try{input.setSelectionRange(n,n);}catch{} }
    });
  }
}

async function loadDefinitionDetail(id,rerender=true){
  if(catalogState.kind==='move_keywords'){const entry=moveKeywordCatalogEntry(id); catalogState.selected=entry?{definition:entry,versions:[]}:null; if(rerender!==false)render(); return;}
  if(!catalogState.available) return;
  try{
    const response=await fetch(`/api/definitions/${encodeURIComponent(catalogState.kind)}/${encodeURIComponent(id)}`,{cache:'no-store'});
    if(!response.ok) throw new Error('Definition detail unavailable');
    catalogState.selected=await response.json();
  }catch(error){ catalogState.error=error.message; }
  if(rerender) render();
}

function setDefinitionKind(kind){ catalogState.kind=kind; catalogState.query=''; catalogState.selected=null; refreshDefinitionRows(); }
function setDefinitionQuery(value){ catalogState.query=value; clearTimeout(catalogQueryTimer); catalogQueryTimer=setTimeout(()=>refreshDefinitionRows({keepSelection:true,preserveSearchFocus:true}),600); }
async function setActiveRuleset(id){
  try{
    const response=await fetch('/api/rulesets/active',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
    if(!response.ok) throw new Error((await response.json().catch(()=>({}))).error||'Could not switch ruleset');
    const payload=await response.json(); catalogState.status={...catalogState.status,...payload,activeRulesetId:id}; catalogState.selected=null; itemCatalogState={loading:false,error:null,query:'',items:[]};
    await refreshDefinitionRows(); toast(`Ruleset: ${payload.ruleset?.name||id}`);
  }catch(error){ toast(error.message,'error'); }
}

async function refreshContentPacks(){
  contentPackState.loading=true; contentPackState.error=null; render();
  try{
    const response=await fetch('/api/content-packs',{cache:'no-store'}); const payload=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(payload.error||'Could not load content packs.');
    contentPackState.packs=payload.packs||[]; contentPackState.imports=payload.imports||[];
  }catch(error){contentPackState.error=error.message;}
  contentPackState.loading=false; render();
}
function chooseContentPackFile(){document.getElementById('content-pack-file')?.click();}
async function importContentPackFile(input){
  const file=input?.files?.[0]; if(!file)return;
  input.value='';
  if(!file.name.toLowerCase().endsWith('.ptucp'))return toast('Choose a .ptucp content pack.','error');
  contentPackState.loading=true;contentPackState.error=null;render();
  try{
    const response=await fetch('/api/content-packs/import',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-PTU-Filename':encodeURIComponent(file.name)},body:file});
    const payload=await response.json().catch(()=>({})); if(!response.ok)throw new Error(payload.error||'Content pack import failed.');
    await loadCatalogStatus(); catalogState.selected=null; invalidateItemCatalog(); await refreshDefinitionRows({keepSelection:false});
    const r=payload.result||{}, counts=Object.entries(r.definitionCounts||{}).map(([k,v])=>`${v} ${k}`).join(', ');
    toast(`Pack imported: ${r.pack?.name||file.name}${counts?` · ${counts}`:''}`);
  }catch(error){contentPackState.error=error.message;toast(error.message,'error');render();}
  finally{contentPackState.loading=false;}
}

function contentPackIdsUsedByState(snapshot){
  const out=new Set();
  const visit=value=>{
    if(!value)return;
    if(Array.isArray(value)){value.forEach(visit);return;}
    if(typeof value!=='object')return;
    for(const [key,v] of Object.entries(value)){
      if((key==='contentPackId'||key==='content_pack_id'||key==='speciesContentPackId')&&typeof v==='string'&&v.trim())out.add(v.trim());
      visit(v);
    }
  };
  visit(snapshot); return out;
}
async function setContentPackEnabledUi(packId,enabled){
  const pack=(contentPackState.packs||[]).find(p=>p.id===packId); if(!pack)return;
  const used=contentPackIdsUsedByState(state).has(packId);
  if(!enabled){
    const ok=await styledConfirm({title:`Disable ${pack.name}?`,message:`<p>This removes the pack from <strong>${esc(catalogState.status?.ruleset?.name||'the active Ruleset')}</strong> without deleting it.</p>${used?'<div class="dialog-warning">The active Trainer save references definitions from this pack. Existing entries are kept, but some rules or lookups may become unavailable until the pack is enabled again.</div>':''}`,confirmLabel:'Disable Pack',tone:'gold'});
    if(!ok)return;
  }
  contentPackState.loading=true;contentPackState.error=null;render();
  try{
    const response=await fetch(`/api/content-packs/${encodeURIComponent(packId)}/enabled`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled,rulesetId:catalogState.status?.activeRulesetId})});
    const payload=await response.json().catch(()=>({})); if(!response.ok)throw new Error(payload.error||'Could not update Content Pack state.');
    await loadCatalogStatus(); catalogState.selected=null; itemCatalogState={loading:false,error:null,query:'',items:[]}; await refreshDefinitionRows({keepSelection:false});
    toast(`${pack.name} ${enabled?'enabled':'disabled'} in the active Ruleset.`);
  }catch(error){contentPackState.error=error.message;toast(error.message,'error');render();}
  finally{contentPackState.loading=false;}
}
async function uninstallContentPackUi(packId){
  const pack=(contentPackState.packs||[]).find(p=>p.id===packId); if(!pack)return;
  if(!pack.removable)return toast('Bundled Content Packs can be disabled, but not uninstalled.','error');
  const used=contentPackIdsUsedByState(state).has(packId);
  const ok=await styledConfirm({title:`Uninstall ${pack.name}?`,message:`<p>This permanently removes the imported pack and its definitions from this computer. A Definition SQLite backup is created first.</p>${used?'<div class="dialog-warning">The active Trainer save references this pack. Disabling is safer; uninstalling may leave those references unresolved until the pack is installed again.</div>':'<div class="dialog-warning">You can reinstall it later by importing the same .ptucp file.</div>'}`,confirmLabel:'Uninstall Pack',danger:true});
  if(!ok)return;
  contentPackState.loading=true;contentPackState.error=null;render();
  try{
    const response=await fetch(`/api/content-packs/${encodeURIComponent(packId)}`,{method:'DELETE'}); const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||'Could not uninstall Content Pack.');
    await loadCatalogStatus(); catalogState.selected=null; itemCatalogState={loading:false,error:null,query:'',items:[]}; await refreshDefinitionRows({keepSelection:false});
    toast(`${pack.name} uninstalled. A backup was created before removal.`);
  }catch(error){contentPackState.error=error.message;toast(error.message,'error');render();}
  finally{contentPackState.loading=false;}
}
function contentPackManager(){
  const packs=contentPackState.packs||[], recent=contentPackState.imports||[];
  const rulesetName=catalogState.status?.ruleset?.name||catalogState.status?.activeRulesetId||'active Ruleset';
  return `<div class="content-pack-manager">
    <div class="content-pack-heading"><div><strong>Desktop Content Packs</strong><small>Enable or disable packs per Ruleset. Imported <code>.ptucp</code> packs can also be uninstalled; bundled packs remain part of the application.</small><small>Managing: <strong>${esc(rulesetName)}</strong></small></div><div class="content-pack-actions"><input id="content-pack-file" type="file" accept=".ptucp,application/zip" hidden onchange="importContentPackFile(this)"/><button class="btn btn-success" onclick="chooseContentPackFile()" ${contentPackState.loading?'disabled':''}>${contentPackState.loading?'Working…':'⬆ Import .ptucp'}</button><button class="btn" onclick="refreshContentPacks()">↻ Packs</button></div></div>
    ${contentPackState.error?`<div class="alert alert-danger">${esc(contentPackState.error)}</div>`:''}
    <div class="content-pack-grid">${packs.map(p=>`<div class="content-pack-card"><div class="content-pack-card-title"><strong>${esc(p.name)}</strong><small>${esc(p.id)} · v${esc(p.version)}</small></div><span>${p.enabled?chip('ACTIVE','chip-green'):chip('DISABLED','chip-blue')}</span><small>${esc(p.kind||'custom')} · priority ${esc(p.priority)} · ${p.imported?'imported':'bundled'}</small><div class="content-pack-card-actions"><button class="mini-action" onclick="setContentPackEnabledUi('${p.id}',${p.enabled?'false':'true'})">${p.enabled?'Disable':'Enable'}</button>${p.removable?`<button class="mini-action danger" onclick="uninstallContentPackUi('${p.id}')">Uninstall</button>`:''}</div>${(p.requiredBy||[]).length?`<small class="content-pack-required">Required by: ${esc((p.requiredBy||[]).map(x=>x.name||x.id).join(', '))}</small>`:''}</div>`).join('')||'<p class="muted">No content packs installed.</p>'}</div>
    ${recent.length?`<details class="content-pack-history"><summary>Recent imports (${recent.length})</summary>${recent.slice(0,8).map(i=>`<div><strong>${esc(i.pack_id)}</strong> <span>v${esc(i.pack_version)}</span><small>${esc(new Date(i.imported_at).toLocaleString())} · backup ${esc(i.backup_filename||'—')}</small></div>`).join('')}</details>`:''}
  </div>`;
}

function migrateState(input){
  const data = input && typeof input === 'object' ? input : defaultState();
  if(data.version === 1) data.version = 2;
  if(data.version !== 2) throw new Error(`Unsupported save version: ${data.version}`);
  data.ui ||= {screen:'dashboard',trainerTab:'profile',toast:null,round:1,scene:1,day:1,gmOverride:false};
  data.ui.trainerTab ||= 'profile';
  data.ui.inCombat=!!data.ui.inCombat;
  data.ui.combat=normalizePokemonCombatUiState(data.ui.combat);
  data.ui.toast = null;
  // v1.9 replaces the old prototype XP curve with PTU Trainer Experience (10 XP per Level, or GM Milestones).
  if(Number(data.trainer?.nextExp||0)>10){ data.trainer.exp=0; data.trainer.nextExp=10; }
  state=data; ensureTrainerDetails(data.trainer);
  data.pokemon=Array.isArray(data.pokemon)?data.pokemon:[];
  for(const p of data.pokemon){
    p.details=p.details&&typeof p.details==='object'?p.details:{};
    p.details.gender=normalizePokemonGender(p.details.gender??p.gender??p.sex??'None');
    p.details.isShiny=!!(p.details.isShiny??p.details.is_shiny??p.isShiny??p.is_shiny??false);
    p.tempHp=Math.max(0,Number(p.tempHp??p.details.tempHp??0));p.details.tempHp=p.tempHp;
    p.details.formTempHpBySource=p.details.formTempHpBySource&&typeof p.details.formTempHpBySource==='object'&&!Array.isArray(p.details.formTempHpBySource)?p.details.formTempHpBySource:{};
    const storedPokemonNotes=p.details.notes;
    p.details.notes=Array.isArray(storedPokemonNotes)?storedPokemonNotes.map(value=>String(value??'')).join('\n'):typeof storedPokemonNotes==='string'?storedPokemonNotes.replace(/\r\n?/g,'\n'):'';
  }
  data.inventory=Array.isArray(data.inventory)?data.inventory:[];
  if(!data.inventory.some(i=>i.id==='two-handed-sword'))data.inventory.push({id:'two-handed-sword',icon:'⚔️',name:'Two-Handed Sword',category:'weapon',price:6000,qty:0,consumable:false,equipSlot:'mainHand',mechanics:{kind:'weapon',quality:'Fine',weaponClass:'large_melee',hands:2,metal:true,range:'Melee',acModifier:1,dbModifier:2,weaponMoves:{adept:'backswing',master:'slice'},tags:['Melee','Large Melee','Two-Handed','Sword']}});
  return data;
}

async function loadState(){
  if(location.protocol === 'http:' || location.protocol === 'https:'){
    try{
      const response = await fetch('/api/state',{cache:'no-store'});
      if(response.ok){
        const payload = await response.json();
        persistenceMode = payload.persistence || 'sqlite';
        const loaded = migrateState(payload.state);
        localStorage.setItem(STORAGE_KEY,JSON.stringify(loaded));
        return loaded;
      }
    }catch(e){ console.warn('SQLite API unavailable; using browser fallback.',e); }
  }
  try{
    const raw=localStorage.getItem(STORAGE_KEY) || localStorage.getItem(V07_STORAGE_KEY) || localStorage.getItem(PREVIOUS_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if(raw){
      persistenceMode='browser-fallback';
      return migrateState(JSON.parse(raw));
    }
  }catch(e){ console.warn('Could not load browser save',e); }
  persistenceMode='browser-fallback';
  return defaultState();
}

function persist(){
  const snapshot=JSON.parse(JSON.stringify(state));
  snapshot.version=2;
  if(snapshot.ui) snapshot.ui.toast=null;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(snapshot));
  if(persistenceMode==='sqlite' && (location.protocol==='http:' || location.protocol==='https:')){
    saveQueue=saveQueue.catch(()=>{}).then(async()=>{
      const response=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:snapshot})});
      if(!response.ok){ const problem=await response.json().catch(()=>({})); throw new Error(problem.error||`Save failed (${response.status})`); }
      const result=await response.json(); lastSavedAt=result.savedAt||new Date().toISOString();
    }).catch(error=>{
      console.error('SQLite save failed; browser copy remains available.',error);
      persistenceMode='browser-fallback';
    });
  }
}
function commit(message){ invalidateTrainerReference(); persist(); if(message) toast(message); else render(); if(state.ui.screen==='trainer')setTimeout(()=>loadTrainerReferenceData(true),0); }
async function resetState(){
  if(!(await styledConfirm({title:'Reset campaign',message:'<p>This restores the original sample campaign and replaces the current working state.</p><div class=\"dialog-warning\">A SQLite revision remains available when server-backed persistence is active.</div>',confirmLabel:'Reset sample campaign',danger:true}))) return;
  if(persistenceMode==='sqlite'){
    try{
      const response=await fetch('/api/reset',{method:'POST'});
      if(!response.ok) throw new Error('Reset failed');
      const payload=await response.json(); state=migrateState(payload.state); localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); render(); return;
    }catch(error){ console.warn(error); }
  }
  state=defaultState(); persist(); render();
}
function toast(message,type='success'){
  state.ui.toast={message,type}; render();
  clearTimeout(window.__toastTimer);
  window.__toastTimer=setTimeout(()=>{state.ui.toast=null; render();},2200);
}
function persistenceLabel(){ return persistenceMode==='sqlite'?'SQLite autosave':'Browser fallback'; }
function esc(s){ return String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m])); }
function uid(prefix){ return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function initials(name){ return String(name||'?').trim().split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'?'; }
function personPortrait(entity,className='avatar',tag='div'){
  const node=tag==='span'?'span':'div';
  const src=String(entity?.portraitDataUrl||'').trim();
  if(src.startsWith('data:image/')) return `<${node} class="${className} has-portrait"><img src="${esc(src)}" alt="${esc(entity?.name||'Portrait')}"/></${node}>`;
  return `<${node} class="${className}">${esc(entity?.initials||initials(entity?.name))}</${node}>`;
}
function loadPortraitImage(dataUrl){
  return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('The selected image could not be decoded.'));image.src=dataUrl;});
}
async function portraitDataUrlFromFile(file){
  if(!file)throw new Error('No image selected.');
  if(!['image/jpeg','image/png','image/webp'].includes(String(file.type||'').toLowerCase()))throw new Error('Use a JPG, PNG, or WebP image.');
  if(Number(file.size||0)>10*1024*1024)throw new Error('Portrait images must be 10 MB or smaller before compression.');
  const original=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('The selected image could not be read.'));reader.readAsDataURL(file);});
  const image=await loadPortraitImage(original);
  const maxSide=384; const width=Math.max(1,Number(image.naturalWidth||image.width||1)),height=Math.max(1,Number(image.naturalHeight||image.height||1));
  const scale=Math.min(1,maxSide/Math.max(width,height)); const outW=Math.max(1,Math.round(width*scale)),outH=Math.max(1,Math.round(height*scale));
  const canvas=document.createElement('canvas');canvas.width=outW;canvas.height=outH;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image processing is unavailable in this window.');
  ctx.drawImage(image,0,0,outW,outH);
  const encoded=canvas.toDataURL('image/webp',0.76);
  if(!encoded.startsWith('data:image/'))throw new Error('Image compression failed.');
  return encoded;
}
async function uploadTrainerPortrait(input){
  const file=input?.files?.[0];if(!file)return;
  try{trainer().portraitDataUrl=await portraitDataUrlFromFile(file);commit('Trainer portrait updated.');}
  catch(error){toast(error.message||'Could not update Trainer portrait.','error');}
  finally{if(input)input.value='';}
}
async function removeTrainerPortrait(){
  if(!trainer().portraitDataUrl)return;trainer().portraitDataUrl=null;commit('Trainer portrait removed.');
}
async function uploadNpcPortrait(id,input){
  const n=state.npcs.find(x=>x.id===id),file=input?.files?.[0];if(!n||!file)return;
  try{n.portraitDataUrl=await portraitDataUrlFromFile(file);commit(`${n.name} portrait updated.`);}
  catch(error){toast(error.message||'Could not update NPC portrait.','error');}
  finally{if(input)input.value='';}
}
function removeNpcPortrait(id){const n=state.npcs.find(x=>x.id===id);if(!n?.portraitDataUrl)return;n.portraitDataUrl=null;commit(`${n.name} portrait removed.`);}
const TRAINER_SKILLS=[
  'Acrobatics','Athletics','Combat','Intimidate','Stealth','Survival',
  'General Education','Medicine Education','Occult Education','Pokémon Education','Technology Education','Guile','Perception',
  'Charm','Command','Focus','Intuition'
];
const SKILL_RANK_NAMES={1:'Pathetic',2:'Untrained',3:'Novice',4:'Adept',5:'Expert',6:'Master'};
const TRAINER_STAT_KEYS=['hp','attack','defense','spAttack','spDefense','speed'];
function trainer(){ return state.trainer; }
function rankValue(name){ return Number(trainer().details?.skillRanks?.[name]||2); }
function trainerMaxAp(t=trainer()){ return 5+Math.floor(Number(t.level||1)/5); }
function trainerBoundAp(t=trainer()){return (t?.details?.features||[]).some(f=>pokemonCombatSlug(f.id||f.name)==='silent-assassin'&&f.bound===true)?2:0;}
function trainerDerived(t=trainer()){
  const resolved=trainerResolved();
  if(resolved?.derived && t?.id===trainer()?.id) return {...resolved.derived,healingHpLimit:injuryHealingHpLimit(resolved.derived.maxHp,t.details?.injuries)};
  const st=t.stats||{}; const hp=Number(st.hp||0),def=Number(st.defense||0),spd=Number(st.spDefense||0),spe=Number(st.speed||0);
  const ath=rankValue('Athletics'), acro=rankValue('Acrobatics'), combat=rankValue('Combat');
  const overland=3+Math.floor((ath+acro)/2), power=4+(ath>=3?1:0)+(combat>=4?1:0);
  return {
    maxHp:Number(t.level||1)*2+hp*3+10,
    physicalEvasion:Math.min(6,Math.floor(def/5)), specialEvasion:Math.min(6,Math.floor(spd/5)), speedEvasion:Math.min(6,Math.floor(spe/5)),
    maxAp:trainerMaxAp(t), power, overland, swim:Math.floor(overland/2), highJump:(acro>=4?1:0)+(acro>=6?1:0), longJump:Math.floor(acro/2),throwingRange:4+ath,initiative:spe,damageReduction:0,healingHpLimit:injuryHealingHpLimit(Number(t.level||1)*2+hp*3+10,t.details?.injuries)
  };
}
function backgroundSkillRankMap(background){
  const ranks=Object.fromEntries(TRAINER_SKILLS.map(k=>[k,2]));
  const bg=background||{};
  if(TRAINER_SKILLS.includes(bg.adept))ranks[bg.adept]=4;
  if(TRAINER_SKILLS.includes(bg.novice))ranks[bg.novice]=3;
  for(const skill of (bg.pathetic||[]))if(TRAINER_SKILLS.includes(skill))ranks[skill]=1;
  return ranks;
}
function syncBackgroundSkillRanks(t,{force=false}={}){
  const td=t.details||{}; const baseline=backgroundSkillRankMap(td.background);
  td.skillRanks=td.skillRanks||{};
  if(force||Number(td.backgroundRanksAppliedVersion||0)<2){
    const affected=new Set([td.background?.adept,td.background?.novice,...(td.background?.pathetic||[])].filter(Boolean));
    for(const skill of affected)td.skillRanks[skill]=baseline[skill];
    td.backgroundRanksAppliedVersion=2;
  }
  return baseline;
}
function ensureTrainerDetails(t=trainer()){
  t.details=t.details||{};
  const storedNotes=t.details.notes;
  t.details.notes=Array.isArray(storedNotes)?storedNotes.map(value=>String(value??'')).join('\n'):typeof storedNotes==='string'?storedNotes.replace(/\r\n?/g,'\n'):'';
  t.details.background=t.details.background||{name:'Custom Background',adept:'Athletics',novice:'Command',pathetic:['Guile','Intuition','Focus']};
  t.details.skillRanks=t.details.skillRanks||{};
  const legacySkillMap={'General Education':'Education','Medicine Education':'Medicine','Technology Education':'Technology'};
  for(const skill of TRAINER_SKILLS){
    if(t.details.skillRanks[skill]==null){
      const raw=t.skills?.[skill]??t.skills?.[legacySkillMap[skill]]??'2d6'; const m=String(raw).match(/(\d+)d6/); t.details.skillRanks[skill]=Math.max(1,Math.min(6,Number(m?.[1]||2)));
    }
  }
  syncBackgroundSkillRanks(t);
  t.details.features=Array.isArray(t.details.features)?t.details.features:[]; t.details.edges=Array.isArray(t.details.edges)?t.details.edges:[]; t.details.moves=Array.isArray(t.details.moves)?t.details.moves:[];
  t.details.injuries=Math.max(0,Number(t.details.injuries||0)); t.details.combatStages=t.details.combatStages||{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0};
  t.equipment=t.equipment&&typeof t.equipment==='object'?t.equipment:{};
  for(const slot of ['head','body','mainHand','offHand','feet','accessory'])if(!(slot in t.equipment))t.equipment[slot]=null;
  const d=trainerDerived(t); if(t.details.currentHp==null)t.details.currentHp=d.maxHp; t.details.currentHp=Math.max(0,Math.min(d.maxHp,Number(t.details.currentHp||0)));
  t.details.tempHp=Math.max(0,Number(t.details.tempHp||0));
  const availableMaxAp=d.availableMaxAp??Math.max(0,d.maxAp-trainerBoundAp(t));
  if(t.details.currentAp==null)t.details.currentAp=availableMaxAp; t.details.currentAp=Math.max(0,Math.min(availableMaxAp,Number(t.details.currentAp||0)));
  t.derived={...(t.derived||{}),maxHp:d.maxHp,physicalEvasion:d.physicalEvasion,specialEvasion:d.specialEvasion,speedEvasion:d.speedEvasion,maxAp:d.maxAp,power:d.power,overland:d.overland,swim:d.swim,highJump:d.highJump,longJump:d.longJump};
  return t.details;
}
function activePokemon(){ return state.pokemon.filter(p=>!p.storage); }
function storedPokemon(){ return state.pokemon.filter(p=>p.storage); }
function pokemon(id=state.selectedPokemonId){ return state.pokemon.find(p=>p.id===id)||state.pokemon[0]; }
function roster(id=state.selectedRosterId){ return state.rosters.find(r=>r.id===id)||state.rosters[0]; }
function rosterMembers(id){ return state.pokemon.filter(p=>p.rosterIds.includes(id)); }
function inventoryItem(id){ return state.inventory.find(i=>i.id===id); }
function ownedInventory(){ return (state.inventory||[]).filter(i=>Number(i.qty||0)>0); }
function supportsAutomatedItemUse(item){return ['potion','super-potion','oran-berry'].includes(item?.id);}
function pokemonPortraitUrl(p){
  const speciesId=String(p?.details?.speciesDefinitionId||'').trim();
  if(speciesId){const formState=p?.details?.formState||{baseFormId:'base',activeFormId:null};const params=new URLSearchParams();if(formState.baseFormId&&formState.baseFormId!=='base')params.set('base',formState.baseFormId);if(formState.activeFormId)params.set('active',formState.activeFormId);if(p?.details?.isShiny)params.set('shiny','1');const qs=params.toString();return `/api/pokemon/portrait/${encodeURIComponent(speciesId)}${qs?'?'+qs:''}`;}
  return p?.img||'creatures/default.svg';
}
function pokemonPortraitTag(p,extra=''){
  const src=pokemonPortraitUrl(p), fallback=esc(p?.img||'creatures/default.svg');
  return `<img ${extra} src="${esc(src)}" loading="lazy" alt="${esc(p?.species||p?.name||'Pokémon')}" onerror="this.onerror=null;this.src='${fallback}'"/>`;
}
function itemDescription(i){ return String(i?.description||i?.effectText||'').trim(); }
function itemIconHtml(icon,fallback='◆',extra=''){
  const raw=String(icon||'').trim();
  if(/^(?:data:image\/|https?:\/\/)/i.test(raw))return `<span class="item-art-wrap ${esc(extra)}"><img class="item-art-icon" src="${esc(raw)}" loading="lazy" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"/><span class="item-icon-fallback" hidden>${esc(fallback)}</span></span>`;
  return `<span class="item-icon-glyph ${esc(extra)}">${esc(raw||fallback)}</span>`;
}
function slotFallbackIcon(slot){return slot==='head'?'🧢':slot==='body'?'🧥':slot==='mainHand'?'🥊':slot==='offHand'?'🛡️':slot==='feet'?'👟':'🔷';}
function equippedItemIcon(value,slot){
  if(!value)return itemIconHtml('',slotFallbackIcon(slot));
  const stored=typeof value==='object'?(inventoryItem(value.inventoryItemId||value.id)||null):null;
  return itemIconHtml((typeof value==='object'&&value.icon)||stored?.icon||'',slotFallbackIcon(slot),'equipment-item-art');
}
const ITEM_SLOT_LABELS={head:'Head',body:'Body',mainHand:'Main Hand',offHand:'Off Hand',feet:'Feet',accessory:'Accessory'};
function normalizeItemSlot(slot){
  const key=String(slot||'').trim();
  return ({head:'head',body:'body',main_hand:'mainHand',mainhand:'mainHand',mainHand:'mainHand',off_hand:'offHand',offhand:'offHand',offHand:'offHand',feet:'feet',foot:'feet',accessory:'accessory'})[key]||({head:'head',body:'body',main_hand:'mainHand',mainhand:'mainHand',off_hand:'offHand',offhand:'offHand',feet:'feet',foot:'feet',accessory:'accessory'})[key.toLowerCase()]||null;
}
function itemEquipmentSlots(i){
  const values=[...(Array.isArray(i?.equipmentSlots)?i.equipmentSlots:[]),i?.equipSlot].map(normalizeItemSlot).filter(Boolean);
  return [...new Set(values)];
}
function itemUsageBadges(i){
  const out=[];
  if(i?.trainerUsable)out.push(chip('TRAINER','chip-blue'));
  if(i?.pokemonHeldUsable)out.push(chip('POKÉMON HELD','chip-purple'));
  for(const slot of itemEquipmentSlots(i))out.push(chip(`EQUIP · ${ITEM_SLOT_LABELS[slot]||slot}`,'chip-green'));
  return out.join('');
}
function itemSearchMetadata(i){
  return [i?.name,i?.category,itemDescription(i),i?.trainerUsable?'trainer':'',i?.pokemonHeldUsable?'pokemon held':'',...itemEquipmentSlots(i).map(s=>ITEM_SLOT_LABELS[s]||s)].join(' ').toLowerCase();
}
function typeBadge(t){ const c=TYPE_COLORS[t]||'#777'; const text=t==='electric'?'#503c00':'#fff'; return `<span class="type-badge" style="background:${c};color:${text}">${esc(t).toUpperCase()}</span>`; }
function chip(text,cls=''){ return `<span class="chip ${cls}">${text}</span>`; }
function injuryHealingHpLimit(maxHp,injuries){const count=Math.max(0,Math.min(10,Math.trunc(Number(injuries)||0)));return Math.floor(Math.max(0,Number(maxHp)||0)*(10-count)/10);}
function hpTone(p){ const pct=p.hp/p.maxHp; return pct<=0?'red':pct<.2?'red':pct<=.5?'yellow':'green'; }
function tempHpValue(holder){ return Math.max(0,Number(holder?.tempHp||0)); }
function loyaltyHearts(value){ const loyalty=Math.max(0,Math.min(6,Math.trunc(Number(value)||0))); return `${'♥'.repeat(loyalty)}${'♡'.repeat(Math.max(0,6-loyalty))}`; }
function normalizePokemonGender(value){ const raw=String(value??'').trim().toLowerCase(); if(['male','m','masculino','♂'].includes(raw))return 'Male'; if(['female','f','feminino','♀'].includes(raw))return 'Female'; return 'None'; }
function pokemonGenderLabel(value){ const gender=normalizePokemonGender(value); return gender==='Male'?'♂ Male':gender==='Female'?'♀ Female':'— None'; }
function progress(v,m,t='green'){ return `<div class="progress"><span class="progress-${t}" style="width:${Math.max(0,Math.min(100,v/m*100))}%"></span></div>`; }
function section(title,body,action=''){ return `<section class="section-card"><header class="section-title"><strong>${title}</strong><span>${action}</span></header><div class="section-body">${body}</div></section>`; }
function heading(ey,h,p,action=''){ return `<div class="page-heading"><div><p class="eyebrow">${ey}</p><h1>${h}</h1><p>${p}</p></div>${action}</div>`; }

const nav=[
 ['dashboard','⌂','Home'],['trainer','🪪','Trainer'],['rosters','◉','Rosters'],['combat','⚔','Combat'],['creature','🐾','Creatures'],
 ['storage','▣','Storage'],['inventory','🎒','Items'],['shop','🛒','Shop'],['library','📚','Pokédex & Rules'],['npcs','📓','NPCs'],['levelup','✦','Level Up'],['editor','✎','Editors']
];
function route(screen){ if(screen==='pokemonbuilder'){ beginPokemonBuilder(); return; } if(screen==='levelup'){ beginTrainerProgression(); return; } state.ui.screen=screen; persist(); render(); if(screen==='creature') setTimeout(()=>loadCreatureReferenceData(true),0); if(screen==='combat'&&ensurePokemonCombatUi().activePokemonId) setTimeout(()=>loadPokemonCombatReferenceData(ensurePokemonCombatUi().activePokemonId,true),0); if(screen==='trainer') setTimeout(()=>loadTrainerReferenceData(true),0); if(screen==='shop'&&['Weapon Store','Gear Store'].includes(state.shop?.preset))setTimeout(()=>loadItemCatalog().then(render),0); }
function selectPokemon(id,go=false){ const changed=state.selectedPokemonId!==id; state.selectedPokemonId=id; if(changed){state.ui.creatureTab='sheet'; invalidateCreatureReference();} persist(); if(go) state.ui.screen='creature'; render(); if(go) setTimeout(()=>loadCreatureReferenceData(),0); }
function selectRoster(id){ state.selectedRosterId=id; persist(); render(); }
function selectNpc(id){ state.selectedNpcId=id; persist(); render(); }

function shell(content){
  const t=trainer();
  const toastHtml=state.ui.toast?`<div class="toast ${state.ui.toast.type==='error'?'toast-error':''}">${esc(state.ui.toast.message)}</div>`:'';
  return `<div class="app-backdrop"><div class="pokedex-shell"><aside class="hardware-rail"><div class="lens"><span></span></div><div class="hardware-dots"><i></i><i></i></div></aside><div class="app-window"><header class="topbar"><div class="brand"><span class="brand-mark">◉</span><strong>PTU Companion</strong><span class="prototype-label functional">BETA v2.1.0-beta.30</span><span class="persistence-badge">${persistenceLabel()}</span></div><div class="top-actions"><button onclick="openGlobalActions()">⚙</button><button class="trainer-mini trainer-switcher-button" onclick="openTrainerSwitcher()" title="Switch Trainer">${personPortrait(t,'trainer-mini-avatar','span')}<small>${esc(t.name)}</small><b class="trainer-switch-caret">⌄</b></button></div></header><div class="app-layout"><nav class="sidebar">${nav.map(n=>`<button class="${state.ui.screen===n[0]?'active':''}" onclick="route('${n[0]}')"><span>${n[1]}</span>${n[2]}</button>`).join('')}<div class="sidebar-footer"><button onclick="openSaveTools()">⇄ Save Tools</button></div></nav><main class="screen-content">${content}</main></div><footer class="shell-footer">Desktop beta · ${persistenceLabel()} <span>●</span></footer></div><div class="hardware-bottom"></div></div>${toastHtml}<div id="modal-root"></div></div>`;
}

function creatureRosterPortrait(p){
  const rosters=[...new Set(p.rosterIds||[])].map(id=>state.rosters.find(r=>r.id===id)).filter(Boolean);
  if(!rosters.length)return {html:pokemonPortraitTag(p),label:'No roster'};
  const colors=rosters.map(r=>/^#[0-9a-f]{6}$/i.test(String(r.color||''))?r.color:'#64748b');
  const slice=100/colors.length, stops=colors.map((color,index)=>`${color} ${index*slice}% ${(index+1)*slice}%`).join(',');
  const label=`Rosters: ${rosters.map(r=>String(r.name||'Roster')).join(', ')}`;
  return {html:`<span class="creature-roster-portrait" title="${esc(label)}" style="--roster-ring:conic-gradient(${stops})">${pokemonPortraitTag(p)}</span>`,label};
}

function creatureCard(p,compact=false){
  const roster=creatureRosterPortrait(p);
  return `<button class="creature-card ${compact?'compact':''} ${p.storage?'stored':''}" aria-label="${esc(`${p.name}, Level ${p.level}, ${roster.label}`)}" onclick="selectPokemon('${p.id}')">${roster.html}<div class="creature-card-meta"><strong>${esc(p.name)}</strong><span>Lv. ${p.level}</span>${compact?'':`<div class="type-row">${p.types.map(typeBadge).join('')}</div>`}</div>${p.injuries>0?`<span class="injury-dot" title="${p.injuries} injuries">${p.injuries}</span>`:''}</button>`;
}
function focusCreaturePortrait(){ requestAnimationFrame(()=>{ const header=document.getElementById('creature-portrait'); if(header){header.focus({preventScroll:true});header.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});} }); }

function creatureSelectorCard(p,selectedId){
  const selected=p.id===selectedId;
  return `<button type="button" class="creature-card compact ${p.storage?'stored':''} ${selected?'selected':''}" aria-pressed="${selected}" onclick="selectPokemon('${p.id}');focusCreaturePortrait()">${pokemonPortraitTag(p)}<div class="creature-card-meta"><strong>${esc(p.name)}</strong><span>Lv. ${p.level} · ${p.storage?'Stored':'Carried'}</span></div></button>`;
}


function dashboard(){
  const t=trainer(), active=activePokemon();
  return `<div class="page">${heading('ACTIVE CAMPAIGN','Trainer Command Center','Your campaign state now persists between sessions.','<button class="btn btn-primary" onclick="route(\'levelup\')">✦ Guided Level-Up</button>')}
  <div class="dashboard-grid">
  ${section('ACTIVE TRAINER',`<div class="trainer-summary">${personPortrait(t,'avatar')}<div><h2>${esc(t.name)}</h2>${chip(esc(t.title),'chip-gold')}<p>Level <strong>${t.level}</strong></p></div></div><div class="trainer-xp-bank"><div><strong>${Number(t.exp||0)} Trainer XP</strong><small>Experience Bank · 10 XP = Level Up · Edge 1 XP · Feature 2 XP</small></div>${progress(Math.min(Number(t.exp||0),10),10,'blue')}</div><div class="summary-kpis"><div><span>💰</span><strong>₽ ${t.money.toLocaleString()}</strong><small>Money</small></div><div><span>💎</span><strong>${t.ptuPoints}</strong><small>PTU Points</small></div><div><span>⭐</span><strong>${t.badges}</strong><small>Badges</small></div></div><button class="btn btn-ghost full" onclick="editTrainer()">Edit Trainer</button>`)}
  ${section('ACTIVE ROSTERS',`<div class="roster-tabs-mini">${state.rosters.filter(r=>r.active).map(r=>`<span style="border-color:${r.color}"><b>${esc(r.name)}</b><small>${rosterMembers(r.id).length}/${r.maxMembers}</small></span>`).join('')}</div><div class="creature-strip">${active.slice(0,6).map(p=>creatureCard(p,true)).join('')}</div>`)}
  ${section('RECENT CREATURES',`<div class="recent-list">${active.slice(0,3).map(p=>`<button onclick="selectPokemon('${p.id}',true)">${pokemonPortraitTag(p)}<div><strong>${esc(p.name)}</strong><div>${p.types.map(typeBadge).join('')}</div></div><div class="recent-hp"><small>HP ${p.hp}/${p.maxHp}${tempHpValue(p)?` +${tempHpValue(p)} Temp`:''}</small>${progress(p.hp,p.maxHp,hpTone(p))}</div></button>`).join('')}</div>`)}
  ${section('BACKPACK',`<div class="inventory-mini">${state.inventory.filter(i=>i.qty>0).slice(0,6).map(i=>`<div><span>${i.icon}</span><strong>${esc(i.name)}</strong><em>× ${i.qty}</em></div>`).join('')}</div>`)}
  ${section('SHOP',`<div class="shop-promo"><div class="shop-bag">🛍️</div><div><h3>Poké Mart</h3><p>Purchase items using your trainer's real saved money.</p><button class="btn btn-gold" onclick="route('shop')">Browse catalog</button></div></div>`)}
  ${section('CAMPAIGN STATE',`<div class="ruleset-card"><div class="row-between"><strong>PTU Core + Campaign</strong>${chip('ACTIVE','chip-green')}</div><dl><div><dt>Round</dt><dd>${state.ui.round}</dd></div><div><dt>Scene</dt><dd>${state.ui.scene}</dd></div><div><dt>Day</dt><dd>${state.ui.day}</dd></div></dl><div class="row-gap"><button class="btn ${state.ui.inCombat?'btn-danger':'btn-success'}" onclick="setPokemonBattleState(${state.ui.inCombat?'false':'true'})">${state.ui.inCombat?'End Battle':'Start Battle'}</button><button class="btn btn-ghost" onclick="nextRound()">Next Round</button><button class="btn btn-ghost" onclick="endScene()">End Scene</button><button class="btn btn-ghost" onclick="newDay()">New Day</button></div></div>`)}
  </div></div>`;
}

function trainerTabButton(id,label){return `<button class="${(state.ui.trainerTab||'profile')===id?'active':''}" onclick="setTrainerTab('${id}')">${label}</button>`;}
function trainerEngineBanner(){
  if(trainerReferenceState.loading)return `<div class="flow-note trainer-engine-note"><strong>Trainer Rules Engine:</strong> recalculating Features, Edges, GM Grants, equipment and Moves…</div>`;
  if(trainerReferenceState.error)return `<div class="builder-validation bad"><strong>Trainer Rules Engine unavailable:</strong> ${esc(trainerReferenceState.error)}</div>`;
  const r=trainerResolved();if(!r)return `<div class="flow-note trainer-engine-note"><strong>Trainer Rules Engine:</strong> loading resolved sheet…</div>`;
  const unresolved=r.unresolvedChoices?.length||0;const silentAssassinBound=trainerBoundAp()>0;return `<div class="flow-note trainer-engine-note"><strong>Resolved Trainer active.</strong> ${r.modifiers?.length||0} automatic modifier(s), ${r.abilities?.length||0} Ability/Abilities, ${r.moves?.length||0} resolved Move(s)${unresolved?`, ${unresolved} choice(s) still need configuration`:''}.</div>${silentAssassinBound?'<div class="flow-note"><strong>Silent Assassin (Bound):</strong> Struggle and Weapon Attacks Flinch targets on Accuracy Roll 18+; Ghost-Type Damage is optional.</div>':''}`;
}
function trainerMoveResolvedCard(m,td,{combat=false}={}){
  const def=m.definition||{};const dmg=m.resolvedDamage||{};const manualIndex=(td.moves||[]).findIndex(x=>String(x.id||'')===String(m.id||''));
  const sourceTone={feature:'chip-blue',edge:'chip-purple',weapon:'chip-gold',gm:'chip-red',gm_grant:'chip-red',equipment:'chip-gold',manual:'chip-neutral',manual_ruleset:'chip-neutral'};
  const sources=(m.sources||[]).map(src=>chip(esc(String(src.name||src.label||src.kind||'SOURCE').toUpperCase()),sourceTone[src.kind]||'chip-blue')).join('');
  const damage=dmg.damaging?`<div class="trainer-damage-box"><strong>${esc(dmg.expression||'Damage roll')}</strong><small>DB ${dmg.baseDb}${dmg.finalDb!==dmg.baseDb?` → <b>DB ${dmg.finalDb}</b>`:''}${dmg.stab?' · STAB':''}</small>${(dmg.breakdown||[]).map(x=>`<span><em>${esc(x.label)}</em><b>${esc(x.value)}</b></span>`).join('')}</div>`:`<div class="trainer-damage-box status"><strong>Status Move</strong><small>No damage roll.</small></div>`;
  return `<article class="trainer-move-card ${combat?'combat-move-card':''}"><div class="row-between"><div><h3>${esc(m.name)}</h3><div class="row-gap">${def.type?typeBadge(String(def.type).toLowerCase()):''}${sources}${m.automatic?chip('AUTO','chip-green'):''}</div></div>${!combat&&manualIndex>=0?`<button class="btn btn-danger btn-small" onclick="removeTrainerMove(${manualIndex})">Remove manual source</button>`:''}</div>${damage}<dl class="detail-dl">${def.category?`<div><dt>Class</dt><dd>${esc(def.category)}</dd></div>`:''}${def.frequency?`<div><dt>Frequency</dt><dd>${esc(def.frequency)}</dd></div>`:''}${(dmg.resolvedAc??def.ac)!=null?`<div><dt>AC</dt><dd>${esc(dmg.resolvedAc??def.ac)}${dmg.weapon?.acModifier?` <small>(weapon ${dmg.weapon.acModifier>0?'+':''}${dmg.weapon.acModifier})</small>`:''}</dd></div>`:''}${dmg.accuracyModifier?`<div><dt>Accuracy Roll</dt><dd>${dmg.accuracyModifier>0?'+':''}${esc(dmg.accuracyModifier)}</dd></div>`:''}${(dmg.resolvedRange||def.range)?`<div><dt>Range</dt><dd>${esc(dmg.resolvedRange||def.range)}</dd></div>`:''}${dmg.weapon?`<div><dt>Weapon</dt><dd>${esc(dmg.weapon.name)} · ${esc(dmg.weapon.quality)} ${esc(dmg.weapon.weaponClassLabel||'')}</dd></div><div><dt>Qualified by</dt><dd>${esc(dmg.weapon.qualification?.skill||'Combat')} · ${esc(dmg.weapon.qualification?.rankName||'')}</dd></div>`:''}</dl>${def.effect?`<p>${esc(def.effect)}</p>`:''}</article>`;
}
function trainerScreen(){
  const t=trainer(); const td=ensureTrainerDetails(t); const der=trainerDerived(t); const resolved=trainerResolved(); const tab=state.ui.trainerTab||'profile';
  const tabs=`<div class="tabbar trainer-tabs">${trainerTabButton('profile','Profile')}${trainerTabButton('skills','Skills')}${trainerTabButton('stats','Stats')}${trainerTabButton('features','Features')}${trainerTabButton('edges','Edges')}${trainerTabButton('abilities','Abilities')}${trainerTabButton('moves','Moves')}${trainerTabButton('combat','Combat')}${trainerTabButton('history','History')}</div>`;
  const head=heading('TRAINER SHEET',esc(t.name),'Trainer build with mechanically resolved Features, Edges, GM Grants, equipment and Moves.',`<div class="row-gap"><span class="chip ${state.ui.gmOverride?'chip-red':'chip-yellow'}">◈ GM Override ${state.ui.gmOverride?'ON':'available'}</span><button class="btn btn-ghost" onclick="toggleGmOverride()">Toggle</button></div>`);
  let body='';
  if(tab==='profile'){
    const bg=td.background||{};
    body=`<div class="trainer-grid trainer-tab-content">
      ${section('PROFILE',`<div class="trainer-summary large">${personPortrait(t,'avatar')}<div><h2>${esc(t.name)}</h2>${chip(esc(t.title),'chip-gold')}<p>Level <strong>${t.level}</strong></p></div></div><div class="trainer-xp-bank"><div><strong>${Number(t.exp||0)} Trainer XP</strong><small>Experience Bank · 10 XP = Level Up · Edge 1 XP · Feature 2 XP</small></div>${progress(Math.min(Number(t.exp||0),10),10,'blue')}</div><div class="two-up"><div class="mini-stat"><span class="stat-dot"></span><span>Money</span><strong>₽${t.money.toLocaleString()}</strong></div><div class="mini-stat"><span class="stat-dot"></span><span>Max AP</span><strong>${der.maxAp}</strong></div></div><div class="trainer-xp-controls"><strong>Trainer XP Bank: ${Number(t.exp||0)}</strong><div class="row-gap"><button class="btn btn-ghost btn-small" onclick="changeTrainerExperience(-5)">−5</button><button class="btn btn-ghost btn-small" onclick="changeTrainerExperience(-1)">−1</button><button class="btn btn-ghost btn-small" onclick="changeTrainerExperience(1)">＋1</button><button class="btn btn-ghost btn-small" onclick="changeTrainerExperience(5)">＋5</button><button class="btn btn-primary btn-small" onclick="editTrainerExperience()">Set XP</button></div><small>XP is stored independently from Level. Normal Level Up spends 10 XP and keeps any remainder.</small></div><div class="row-gap"><button class="btn btn-primary" onclick="editTrainer()">Edit Profile</button><label class="btn btn-ghost file-label portrait-upload">📷 Portrait<input type="file" accept="image/jpeg,image/png,image/webp" onchange="uploadTrainerPortrait(this)"/></label>${t.portraitDataUrl?`<button class="btn btn-ghost" onclick="removeTrainerPortrait()">Remove portrait</button>`:''}<button class="btn btn-ghost" onclick="createTrainerProfile()">＋ New Trainer</button><button class="btn btn-danger" onclick="resetTrainerSheet()">Reset Sheet</button><button class="btn btn-danger" onclick="deleteTrainerProfile()">Delete Trainer</button></div>`)}
      ${section('BACKGROUND',`<h3>${esc(bg.name||'Unnamed Background')}</h3><div class="background-ranks"><span>${chip('ADEPT','chip-blue')} ${esc(bg.adept||'—')}</span><span>${chip('NOVICE','chip-green')} ${esc(bg.novice||'—')}</span><span>${chip('PATHETIC','chip-red')} ${(bg.pathetic||[]).map(esc).join(', ')||'—'}</span></div><p class="muted">Background rank choices remain the base Skill values; Edges, equipment and GM Grants are layered on top by the resolver.</p><button class="btn btn-ghost full" onclick="openTrainerBackgroundEditor()">Edit Background</button>`)}
      ${section('TRAINER NOTES',td.notes.trim()?`<div class="flow-note trainer-notes-block">${esc(td.notes).replace(/\n/g,'<br>')}</div>`:'<p class="muted">No Trainer notes yet.</p>',`<button class="btn btn-ghost btn-small" onclick="editTrainerNotes()">${td.notes.trim()?'Edit Notes':'Add Notes'}</button>`)}
      ${section('GM GRANTS',`<div class="grant-list">${t.gmGrants.map(g=>`<div><span>${g.type==='fixed'?'◆':'◇'}</span><div><strong>${esc(g.label)}</strong><small>${esc(g.type)} grant · ${esc(gmGrantTargetLabel(g.target))} · ${esc(g.createdAt)}</small></div><button class="icon-btn" onclick="removeGmGrant('${g.id}')">×</button></div>`).join('')||'<p class="muted">No GM grants.</p>'}</div><button class="btn btn-primary full" onclick="addGmGrant()">＋ Add GM Grant</button>`)}
      ${section('RESOLVED SUMMARY',`<div class="summary-kpis"><div><span>♥</span><strong>${td.currentHp}/${der.maxHp}</strong><small>HP</small></div><div><span>◆</span><strong>${td.currentAp}/${der.availableMaxAp??(der.maxAp-trainerBoundAp())}</strong><small>AP${trainerBoundAp()?` · ${trainerBoundAp()} Bound`:''}</small></div><div><span>⚔</span><strong>${resolved?.moves?.length??td.moves.length}</strong><small>Moves</small></div></div><dl class="detail-dl"><div><dt>Features</dt><dd>${td.features.length}</dd></div><div><dt>Edges</dt><dd>${td.edges.length}</dd></div><div><dt>Abilities</dt><dd>${resolved?.abilities?.length||0}</dd></div><div><dt>Damage Reduction</dt><dd>${der.damageReduction||0}</dd></div></dl>${trainerEngineBanner()}`)}
    </div>`;
  }else if(tab==='skills'){
    const categories={BODY:['Acrobatics','Athletics','Combat','Intimidate','Stealth','Survival'],MIND:['General Education','Medicine Education','Occult Education','Pokémon Education','Technology Education','Guile','Perception'],SPIRIT:['Charm','Command','Focus','Intuition']};
    body=`<div class="trainer-tab-content">${section('RESOLVED SKILL RANKS & BONUSES',`<div class="trainer-skill-board">${Object.entries(categories).map(([cat,list])=>`<div><h3>${cat}</h3>${list.map(skill=>{const rs=resolved?.skills?.[skill];const rv=rs?.rank??rankValue(skill);const bonus=rs?.flatBonus||0;return `<button class="trainer-skill-row" onclick="openTrainerSkillEditor('${skill}')"><span>${esc(skill)}${bonus?` <em class="resolved-bonus">${bonus>0?'+':''}${bonus}</em>`:''}</span><strong>${esc(SKILL_RANK_NAMES[rv]||`Rank ${rv}`)}</strong><small>${esc(rs?.expression||`${rv}d6`)}</small></button>`}).join('')}</div>`).join('')}</div><div class="flow-note"><strong>Resolved check:</strong> Skill rank dice + static bonuses from Edges, equipment and GM Grants. Context-dependent bonuses remain listed separately instead of being applied universally.</div>${trainerEngineBanner()}`)}`;
    if(resolved?.contextualEffects?.length)body+=section('CONTEXTUAL EFFECTS',`<div class="effect-source-list">${resolved.contextualEffects.slice(0,18).map(x=>`<div><strong>${esc(x.source?.name||'Rule effect')}</strong><span>${esc(x.note||x.target||'Context-dependent effect')}</span></div>`).join('')}</div>`);
    body+='</div>';
  }else if(tab==='stats'){
    const rows=[['HP','hp'],['Attack','attack'],['Defense','defense'],['Sp. Attack','spAttack'],['Sp. Defense','spDefense'],['Speed','speed']];
    body=`<div class="trainer-tab-content trainer-stats-layout">${section('RESOLVED BASIC STATS',`<div class="trainer-stat-table resolved-stat-table">${rows.map(([label,key])=>{const base=resolved?.stats?.base?.[key]??Number(t.stats[key]||0);const eff=resolved?.stats?.effective?.[key]??base;const combat=resolved?.stats?.combat?.[key]??eff;const stage=resolved?.stats?.stages?.[key]||0;return `<div><span>${label}<small>Base ${base}${eff!==base?` · permanent ${eff}`:''}${stage?` · CS ${stage>0?'+':''}${stage}`:''}</small></span><strong>${key==='hp'?eff:combat}</strong></div>`}).join('')}</div><button class="btn btn-primary full" onclick="openTrainerStatsEditor()">Edit Base Stats</button><p class="muted">Feature Stat Tags and GM modifiers are not written into the base value; they are layered here so removing a source cleanly reverses its effect.</p>`)}${section('DERIVED COMBAT STATS',`<dl class="detail-dl"><div><dt>Maximum HP</dt><dd>${der.maxHp}</dd></div><div><dt>Initiative</dt><dd>${der.initiative??resolved?.stats?.combat?.speed??t.stats.speed}</dd></div><div><dt>Physical Evasion</dt><dd>${der.physicalEvasion}</dd></div><div><dt>Special Evasion</dt><dd>${der.specialEvasion}</dd></div><div><dt>Speed Evasion</dt><dd>${der.speedEvasion}</dd></div><div><dt>Damage Reduction</dt><dd>${der.damageReduction||0}</dd></div><div><dt>Accuracy Roll Modifier</dt><dd>${(der.accuracyBonus||0)>0?'+':''}${der.accuracyBonus||0}</dd></div><div><dt>Damage Roll Bonus</dt><dd>${(resolved?.damageRollBonus||0)>0?'+':''}${resolved?.damageRollBonus||0}</dd></div><div><dt>Maximum AP</dt><dd>${der.maxAp}</dd></div></dl>`)}${section('CAPABILITIES',`<dl class="detail-dl"><div><dt>Power</dt><dd>${der.power}</dd></div><div><dt>Overland</dt><dd>${der.overland}</dd></div><div><dt>Swim</dt><dd>${der.swim}</dd></div><div><dt>High Jump</dt><dd>${der.highJump}</dd></div><div><dt>Long Jump</dt><dd>${der.longJump}</dd></div><div><dt>Throwing Range</dt><dd>${der.throwingRange??'—'}</dd></div></dl>${(resolved?.grantedCapabilities||[]).length?`<p class="muted"><strong>Granted:</strong> ${resolved.grantedCapabilities.map(c=>esc(c.name)).join(', ')}</p>`:''}`)}${section('ACTIVE MODIFIERS',`${resolved?.modifiers?.length?`<div class="modifier-ledger">${resolved.modifiers.map(m=>`<div><strong>${esc(m.source?.name||'Modifier')}</strong><span>${esc(m.target)} ${m.value>=0?'+':''}${m.value}</span></div>`).join('')}</div>`:'<p class="muted">No resolved static modifiers.</p>'}${trainerEngineBanner()}`)}</div>`;
  }else if(tab==='features'||tab==='edges'){
    const isFeatures=tab==='features';const arr=isFeatures?td.features:td.edges;const kind=isFeatures?'features':'edges';
    const cards=arr.map((f,i)=>{const unresolved=(resolved?.unresolvedChoices||[]).filter(u=>u.source?.kind===(isFeatures?'feature':'edge')&&u.source?.id===f.id);const tags=(f.tags||[]).map(t=>chip(esc(t),String(t).startsWith('+')?'chip-green':'chip-neutral')).join('');const selected=trainerSelectionSummary(f);const silentAssassin=isFeatures&&pokemonCombatSlug(f.id||f.name)==='silent-assassin';return `<article class="trainer-option-card"><div><strong>${esc(f.name)}${f.rank>1?` · Rank ${f.rank}`:''}</strong>${f.trainingFeature?chip('TRAINING FEATURE','chip-gold'):chip(isFeatures?'FEATURE':'EDGE',isFeatures?'chip-blue':'chip-purple')}${tags}<small>${esc(f.sourceLabel||f.contentPackId||'Ruleset')}</small></div>${silentAssassin?`<div class="row-gap">${f.bound?chip('BOUND · 2 AP committed','chip-gold'):chip('UNBOUND','chip-neutral')}<button class="btn btn-small ${f.bound?'btn-ghost':'btn-primary'}" onclick="toggleSilentAssassinBound(${i})">${f.bound?'Unbind · Free Action':'Bind · Standard Action · 2 AP'}</button><small>Dead Silent and the Stealth bonus stay active while unbound.</small></div>`:''}${selected.length? `<div class="trainer-choice-summary">${selected.map(x=>chip(esc(x),'chip-gold')).join('')}</div>`:''}<p>${esc(f.effect||f.prerequisites||'Definition linked to active Ruleset.')}</p>${unresolved.length?`<div class="choice-warning">⚠ ${unresolved.map(u=>esc(u.message)).join(' ')}</div>`:''}<div class="row-gap">${unresolved.length?`<button class="btn btn-gold btn-small" onclick="configureTrainerDefinition('${kind}',${i})">Configure</button>`:''}<button class="btn btn-danger btn-small" onclick="removeTrainerDefinition('${kind}',${i})">Remove</button></div></article>`}).join('')||`<p class="muted">No Trainer ${isFeatures?'Features':'Edges'} recorded yet.</p>`;
    body=`<div class="trainer-tab-content">${section(isFeatures?'TRAINER FEATURES':'TRAINER EDGES',`<div class="trainer-option-grid">${cards}</div><div class="row-gap"><button class="btn btn-primary" onclick="openTrainerDefinitionPicker('${kind}')">＋ Add ${isFeatures?'Feature':'Edge'}</button><button class="btn btn-gold" onclick="openTrainerDefinitionPicker('${kind}',false,'manual_ruleset',true)">★ Buy ${isFeatures?'Feature · 2 XP':'Edge · 1 XP'}</button>${isFeatures?`<button class="btn btn-gold" onclick="openTrainerDefinitionPicker('features',true)">＋ Set Training Feature</button>`:''}</div><div class="flow-note"><strong>Automatic impact:</strong> fixed Stat Tags, compiled modifiers, granted Moves/Abilities and supported deterministic rules are recalculated from these sources. Choice-based and contextual text is flagged instead of guessed.</div>${trainerEngineBanner()}`)}</div>`;
  }else if(tab==='abilities'){
    const abilities=(resolved?.abilities||[]);
    const abilityCards=abilities.map(a=>{const def=a.definition||{};const src=a.source||{};const effect=def.effect||def.raw?.effect_text||'Ability is resolved on this Trainer.';const sourceLabel=src.name||src.id||src.kind||def.packName||def.sourceId||'Ruleset';return `<article class="trainer-option-card trainer-ability-card"><div><strong>${esc(a.name||a.id||'Ability')}</strong>${chip('ABILITY','chip-purple')}${a.automatic?chip('AUTO','chip-green'):''}<small>${esc(sourceLabel)}</small></div><p>${esc(effect)}</p>${def.packName||def.sourceId?`<div class="trainer-choice-summary">${chip(esc(def.packName||def.sourceId),'chip-neutral')}</div>`:''}</article>`}).join('')||'<p class="muted">No Trainer Abilities resolved yet. Abilities granted by Features, Edges and other supported rules will appear here automatically.</p>';
    body=`<div class="trainer-tab-content">${section('RESOLVED TRAINER ABILITIES',`<div class="flow-note"><strong>Automatic provenance:</strong> Abilities granted by Trainer Features, Edges and other resolved effects appear here with their source. Removing the source removes the automatic Ability when appropriate.</div><div class="trainer-option-grid trainer-ability-grid">${abilityCards}</div>${trainerEngineBanner()}`)}</div>`;
  }else if(tab==='moves'){
    const cards=(resolved?.moves||[]).map(m=>trainerMoveResolvedCard(m,td)).join('')||'<p class="muted">No Trainer Moves resolved yet.</p>';
    body=`<div class="trainer-tab-content">${section('RESOLVED TRAINER MOVES',`<div class="flow-note"><strong>Automatic provenance:</strong> Moves granted by Features and Edges now appear automatically beside manually recorded, Weapon and GM-granted Moves. Removing the source removes its automatic contribution.</div><div class="trainer-move-grid">${cards}</div><button class="btn btn-primary" onclick="openTrainerMoveSourcePicker()">＋ Add Trainer Move manually</button>${trainerEngineBanner()}`)}</div>`;
  }else if(tab==='combat'){
    const stages=td.combatStages||{};const moveCards=(resolved?.moves||[]).map(m=>trainerMoveResolvedCard(m,td,{combat:true})).join('')||'<p class="muted">No Trainer Moves resolved.</p>';
    const sa=resolved?.struggleAttack;const struggleCard=sa?`<article class="trainer-move-card struggle-attack-card"><div class="trainer-move-head"><div><span class="eyebrow">CURRENT STRUGGLE ATTACK</span><h3>${esc(sa.name||'Struggle Attack')}</h3></div><div>${typeBadge(String(sa.type||'normal').toLowerCase())}${chip(esc(sa.category||'Physical'),sa.category==='Special'?'chip-purple':'chip-red')}</div></div><div class="move-metrics"><span>AC <b>${sa.ac}</b></span><span>DB <b>${sa.finalDb}</b></span><span>Range <b>${esc(sa.range||'Melee')}</b></span><span>Roll <b>${esc(sa.expression||'—')}</b></span></div><p>${sa.weapon?`Modified by <strong>${esc(sa.weapon.name)}</strong> · ${esc(sa.weapon.weaponClassLabel||sa.weapon.weaponClass||'Weapon')}.`:'Unarmed PTU Struggle Attack.'} ${sa.qualification?`DB qualification: <strong>${esc(sa.qualification.skill)}</strong> (${esc(SKILL_RANK_NAMES[sa.qualification.rank]||`Rank ${sa.qualification.rank}`)})${sa.qualification.source&&sa.qualification.source!=='Base Struggle rules'?` via ${esc(sa.qualification.source)}`:''}.`:''}</p>${sa.accuracyModifier?`<p class="muted">Accuracy Roll modifier: ${sa.accuracyModifier>0?'+':''}${sa.accuracyModifier}.</p>`:''}${sa.options?.length?`<div class="trainer-choice-summary">${sa.options.map(o=>chip(`${esc(o.type)} · ${esc(o.category)}${o.range?` · ${esc(o.range)}`:''}`, 'chip-blue')).join('')}</div><p class="muted">Alternative Struggle forms granted by Capabilities; choose when the rule allows.</p>`:''}<details><summary>Calculation</summary><div class="damage-breakdown">${(sa.breakdown||[]).map(x=>`<div><span>${esc(x.label)}</span><b>${esc(x.value)}</b></div>`).join('')}</div></details></article>`:'<p class="muted">Struggle Attack could not be resolved.</p>';
    body=`<div class="trainer-tab-content trainer-combat-layout">${section('ACTIVE STATE',`<label>Current HP<div class="hp-control"><div class="hp-readout"><strong>${td.currentHp}/${der.maxHp}${td.tempHp?` +${td.tempHp} Temp`:''}</strong><small>${Math.round(td.currentHp/der.maxHp*100)}% normal HP${td.tempHp?` · ${td.tempHp} Temporary HP`:''}${td.injuries?` · Injuries limit healing to ${der.healingHpLimit} HP`:''}</small></div>${progress(td.currentHp,der.maxHp,td.currentHp/der.maxHp<.2?'red':td.currentHp/der.maxHp<=.5?'yellow':'green')}<div class="hp-actions"><button onclick="changeTrainerHp(-5)">−5</button><button onclick="changeTrainerHp(-1)">−1</button><button onclick="changeTrainerHp(1)">+1</button><button onclick="changeTrainerHp(5)">+5</button></div></div></label><label>Injuries<div class="stepper compact"><button onclick="changeTrainerInjury(-1)">−</button><strong>${td.injuries}</strong><button onclick="changeTrainerInjury(1)">＋</button></div></label><label>Action Points<div class="stepper compact"><button onclick="changeTrainerAp(-1)">−</button><strong>${td.currentAp}/${der.availableMaxAp??(der.maxAp-trainerBoundAp())}</strong><button onclick="changeTrainerAp(1)">＋</button></div>${trainerBoundAp()?`<small>${trainerBoundAp()} AP committed to Bound Features</small>`:``}</label><div class="combat-summary-strip"><span>Initiative <b>${der.initiative??0}</b></span><span>DR <b>${der.damageReduction||0}</b></span><span>Accuracy <b>${(der.accuracyBonus||0)>0?'+':''}${der.accuracyBonus||0}</b></span><span>Damage <b>${(resolved?.damageRollBonus||0)>0?'+':''}${resolved?.damageRollBonus||0}</b></span><span>Phys Evade <b>${der.physicalEvasion}</b></span><span>Spec Evade <b>${der.specialEvasion}</b></span></div>`)}${section('COMBAT STAGES',`<div class="stage-grid">${Object.entries(stages).map(([k,v])=>`<div><span>${esc(k)}</span><button onclick="changeTrainerStage('${k}',-1)">−</button><b class="${v>0?'positive':v<0?'negative':''}">${v>0?'+':''}${v}</b><button onclick="changeTrainerStage('${k}',1)">＋</button></div>`).join('')}</div><p class="muted">Attack, Defense, Special Attack, Special Defense and Speed are recalculated using the current PTU Combat Stage multiplier before Move damage is shown.</p>`)}${section('EQUIPMENT',`<div class="equipment-grid">${Object.entries(t.equipment||{}).map(([slot,name])=>`<div>${equippedItemIcon(name,slot)}<small>${esc(ITEM_SLOT_LABELS[slot]||slot)}</small><strong>${esc(name&&typeof name==='object'?name.name:(name||'Empty'))}</strong></div>`).join('')}</div>${resolved?.equipment?.length?`<div class="effect-source-list">${resolved.equipment.map(e=>`<div><strong>${esc(e.definition.name)}</strong><span>${esc(e.definition.effect||'Resolved equipment')}</span></div>`).join('')}</div>`:''}`)}${section('STRUGGLE ATTACK',struggleCard)}${section('TRAINER MOVES · RESOLVED DAMAGE',`<div class="trainer-move-grid combat-move-grid">${moveCards}</div>${trainerEngineBanner()}`)}</div>`;
  }else{
    body=`<div class="trainer-tab-content">${section('TRAINER HISTORY',`<div class="timeline">${t.history.slice().reverse().map(h=>`<div><b>${esc(h.date)}</b><strong>${esc(h.title)}</strong><span>${esc(h.detail)}</span></div>`).join('')}</div>`)}</div>`;
  }
  return `<div class="page">${head}${tabs}${body}</div>`;
}

function setTrainerTab(tab){const valid=['profile','skills','stats','features','edges','abilities','moves','combat','history'];state.ui.trainerTab=valid.includes(tab)?tab:'profile';persist();render();setTimeout(()=>loadTrainerReferenceData(false),0);}

async function openTrainerProfileEditor(){return editTrainer();}
async function openTrainerBackgroundEditor(){
  const bg=ensureTrainerDetails().background; const opts=TRAINER_SKILLS.map(x=>({value:x,label:x}));
  const values=await styledForm({title:'Edit Trainer Background',subtitle:'Custom Backgrounds store the PTU rank adjustments directly.',fields:[{name:'name',label:'Background name',value:bg.name},{name:'adept',label:'Adept Skill',type:'select',value:bg.adept,options:opts},{name:'novice',label:'Novice Skill',type:'select',value:bg.novice,options:opts},{name:'pathetic1',label:'Pathetic Skill 1',type:'select',value:bg.pathetic?.[0],options:opts},{name:'pathetic2',label:'Pathetic Skill 2',type:'select',value:bg.pathetic?.[1],options:opts},{name:'pathetic3',label:'Pathetic Skill 3',type:'select',value:bg.pathetic?.[2],options:opts}],submitLabel:'Save Background'}); if(!values)return;
  const chosen=[values.adept,values.novice,values.pathetic1,values.pathetic2,values.pathetic3]; if(new Set(chosen).size!==5)return toast('Background Skill choices must be different.','error');
  const td=ensureTrainerDetails(); const previous=[td.background?.adept,td.background?.novice,...(td.background?.pathetic||[])].filter(Boolean); for(const skill of previous)td.skillRanks[skill]=2; td.background={name:values.name?.trim()||'Custom Background',adept:values.adept,novice:values.novice,pathetic:[values.pathetic1,values.pathetic2,values.pathetic3]}; td.backgroundRanksAppliedVersion=0; syncBackgroundSkillRanks(trainer(),{force:true}); commit('Trainer Background updated and applied to Skill ranks.');
}
async function openTrainerSkillEditor(skill){
  const current=rankValue(skill); const result=await styledForm({title:`Edit ${skill}`,subtitle:'Correction editor for the saved Trainer sheet.',fields:[{name:'rank',label:'Skill Rank',type:'select',value:current,options:Object.entries(SKILL_RANK_NAMES).map(([value,label])=>({value,label:`${label} · ${value}d6`}))}],submitLabel:'Apply Rank'}); if(!result)return; ensureTrainerDetails().skillRanks[skill]=Number(result.rank); ensureTrainerDetails(); commit(`${skill} updated to ${SKILL_RANK_NAMES[result.rank]}.`);
}
async function openTrainerStatsEditor(){
  const t=trainer(); const result=await styledForm({title:'Edit Trainer Stats',subtitle:'Correction/respec editor. Trainer creation budget validation is intentionally separate.',fields:TRAINER_STAT_KEYS.map(k=>({name:k,label:prettyStat(k),type:'number',min:1,max:999,value:Number(t.stats[k]||1)})),submitLabel:'Apply Stats'}); if(!result)return; for(const k of TRAINER_STAT_KEYS){if(!Number.isFinite(result[k])||result[k]<1)return toast(`${prettyStat(k)} must be at least 1.`,'error');t.stats[k]=Math.floor(result[k]);} ensureTrainerDetails(); commit('Trainer Stats recalculated.');
}
let trainerPickerState={kind:null,trainingFeature:false,moveSourceKind:'manual_ruleset',xpPurchase:false,query:'',seq:0};
const TRAINER_TYPES=['Bug','Dark','Dragon','Electric','Fairy','Fighting','Fire','Flying','Ghost','Grass','Ground','Ice','Normal','Poison','Psychic','Rock','Steel','Water'];
function trainerRankedLimit(def){for(const tag of (def?.raw?.tags||[])){const m=String(tag).match(/^Ranked\s+(\d+)/i);if(m)return Number(m[1]);}return null;}
function trainerDefinitionRepeatabilityUi(def){
  const limit=trainerRankedLimit(def);if(limit)return {repeatable:true,maxRanks:limit,kind:'ranked'};
  const id=String(def?.id||'').toLowerCase();
  const distinctType=new Set(['elemental-connection','type-ace']);
  const repeated=new Set(['basic-skills','adept-skills','expert-skills','master-skills','skill-stunt','skill-enhancement','virtuoso']);
  if(distinctType.has(id))return {repeatable:true,maxRanks:null,kind:'distinct_type'};
  if(repeated.has(id)||/may be taken multiple times/i.test(String(def?.effect||'')))return {repeatable:true,maxRanks:null,kind:'multiple'};
  return {repeatable:false,maxRanks:1,kind:'single'};
}
function trainerSelectionSummary(record){
  const s=record?.selections||{},parts=[];
  if(s.statTag)parts.push(`Stat: ${prettyStat(s.statTag)}`);
  if(s.type)parts.push(`Type: ${s.type}`);
  if(s.skill)parts.push(`Skill: ${s.skill}`);
  if(s.category)parts.push(`Category: ${s.category}`);
  if(s.ability)parts.push(`Ability: ${s.ability}`);
  if(Array.isArray(s.skills)&&s.skills.length)parts.push(`Skills: ${s.skills.join(', ')}`);
  if(Array.isArray(s.moves)&&s.moves.length)parts.push(`Moves: ${s.moves.map(x=>x?.name||x).join(', ')}`);
  if(Array.isArray(s.entities)&&s.entities.length)parts.push(`Choices: ${s.entities.map(x=>x?.name||x).join(', ')}`);
  return parts;
}
function trainerSelectionConflict(arr,def,selections){
  const id=String(def?.id||'').toLowerCase();const same=arr.filter(x=>String(x.id||'').toLowerCase()===id);
  if(id==='elemental-connection'||id==='type-ace')return same.some(x=>String(x.selections?.type||'').toLowerCase()===String(selections?.type||'').toLowerCase())?`That Type is already selected for ${def.name}.`:null;
  if(id==='virtuoso')return same.some(x=>x.selections?.skill===selections?.skill)?`That Skill is already selected for ${def.name}.`:null;
  if(id==='skill-enhancement'){
    const used=new Set(same.flatMap(x=>x.selections?.skills||[]));const repeated=(selections?.skills||[]).find(s=>used.has(s));return repeated?`${repeated} already receives Skill Enhancement.`:null;
  }
  return null;
}
async function trainerDefinitionSelections(kind,def,rankNumber=1){
  const tags=def?.raw?.tags||[]; const id=String(def?.id||''); const fields=[];
  const choiceStatTag=tags.find(t=>/^\+(?:Any(?: Stat)?|.*\s+or\s+.*)$/i.test(String(t)));
  if(choiceStatTag){let options=TRAINER_STAT_KEYS;const raw=String(choiceStatTag).replace(/^\+\d*\s*/,'').trim();if(/\s+or\s+/i.test(raw)&&!/Any/i.test(raw)){const key=v=>({'hp':'hp','attack':'attack','defense':'defense','special attack':'spAttack','spatk':'spAttack','special defense':'spDefense','spdef':'spDefense','speed':'speed'})[String(v).trim().toLowerCase()]||null;const parsed=raw.split(/\s+or\s+/i).map(key).filter(Boolean);if(parsed.length)options=parsed;}fields.push({name:'statTag',label:`[${choiceStatTag}] bonus`,type:'select',value:options[0],options:options.map(k=>({value:k,label:prettyStat(k)}))});}
  if(id==='type-expertise')fields.push({name:'type',label:'Type Expertise',type:'select',value:'Ghost',options:TRAINER_TYPES.map(x=>({value:x,label:x}))});
  if(id==='skill-enhancement'){
    const opts=TRAINER_SKILLS.map(x=>({value:x,label:x}));fields.push({name:'skill1',label:'Skill 1',type:'select',value:TRAINER_SKILLS[0],options:opts},{name:'skill2',label:'Skill 2',type:'select',value:TRAINER_SKILLS[1],options:opts});
  }
  if(id==='categoric-inclination')fields.push({name:'category',label:'Skill Category',type:'select',value:'Body',options:['Body','Mind','Spirit'].map(x=>({value:x,label:x}))});
  if(['basic-skills','adept-skills','expert-skills','master-skills'].includes(id))fields.push({name:'skill',label:'Skill to rank up',type:'select',value:TRAINER_SKILLS[0],options:TRAINER_SKILLS.map(x=>({value:x,label:x}))});
  if(id==='elemental-connection')fields.push({name:'type',label:'Elemental Type',type:'select',value:'Normal',options:TRAINER_TYPES.map(x=>({value:x,label:x}))});
  if(id==='type-ace')fields.push({name:'type',label:'Type Ace Type',type:'select',value:'Normal',options:TRAINER_TYPES.map(x=>({value:x,label:x}))});
  if(id==='virtuoso')fields.push({name:'skill',label:'Master Skill',type:'select',value:TRAINER_SKILLS[0],options:TRAINER_SKILLS.map(x=>({value:x,label:x}))});
  if(id==='athletic-moves'){
    const rank1=['Bind','Block','Slam','Strength'],rank2=['Body Slam','Take Down','Extreme Speed','Hold Back'],rank3=['Mega Kick','Facade','Retaliate','Bide'];
    const pool=[...rank1,...(rankNumber>=2?rank2:[]),...(rankNumber>=3?rank3:[])];const opts=pool.map(x=>({value:x,label:x}));
    fields.push({name:'move1',label:`Athlete Move 1 · Rank ${rankNumber}`,type:'select',value:pool[0],options:opts},{name:'move2',label:`Athlete Move 2 · Rank ${rankNumber}`,type:'select',value:pool[1],options:opts});
  }
  const abilityChoice=String(def?.effect||'').match(/Choose\s+(.+?)\.\s*You gain the (?:Chosen|chosen) Ability/i);
  if(abilityChoice){const names=abilityChoice[1].replace(/,?\s+or\s+/gi,',').split(',').map(x=>x.trim()).filter(Boolean);if(names.length)fields.push({name:'ability',label:'Granted Ability',type:'select',value:names[0],options:names.map(x=>({value:x,label:x}))});}
  const choiceEffect=(def?.compiledEffects||[]).find(e=>e.kind==='choose_and_grant_entity'&&Array.isArray(e.options)&&e.options.filter(o=>o.id).length>0);
  if(choiceEffect && id!=='athletic-moves'){
    const opts=choiceEffect.options.filter(o=>o.id).map(o=>({value:o.id,label:o.name||o.id})); const count=Math.max(1,Math.min(3,Number(choiceEffect.count||1)));
    for(let i=0;i<count;i++)fields.push({name:`entity${i+1}`,label:`${choiceEffect.entity_kind||'Choice'} ${i+1}`,type:'select',value:opts[i%opts.length]?.value,options:opts});
  }
  if(!fields.length)return {};
  const values=await styledForm({title:`Configure ${def.name}`,subtitle:'These selections are stored with this Feature/Edge so its mechanical effects can be resolved automatically.',fields,submitLabel:'Apply Choices',tone:'blue'});if(!values)return null;
  const selections={};
  if(values.statTag)selections.statTag=values.statTag;if(values.type)selections.type=values.type;if(values.ability)selections.ability=values.ability;if(values.category)selections.category=values.category;if(values.skill)selections.skill=values.skill;
  if(values.skill1||values.skill2){if(values.skill1===values.skill2){toast('Choose two different Skills.','error');return null;}selections.skills=[values.skill1,values.skill2];}
  if(values.move1||values.move2){if(values.move1===values.move2){toast('Choose two different Moves.','error');return null;}selections.moves=[values.move1,values.move2];}
  const entityKeys=Object.keys(values).filter(k=>/^entity\d+$/.test(k));if(entityKeys.length){const entities=entityKeys.map(k=>values[k]).filter(Boolean);if(new Set(entities).size!==entities.length){toast('Choose different granted entries.','error');return null;}selections.entities=entities;}
  return selections;
}
async function openTrainerDefinitionPicker(kind,trainingFeature=false,moveSourceKind='manual_ruleset',xpPurchase=false){trainerPickerState={kind,trainingFeature,moveSourceKind,xpPurchase,query:'',seq:0};const xpCost=kind==='features'?2:kind==='edges'?1:0;modal(`<label class="training-search">Search ${esc(kind)}<input id="trainer-definition-search" placeholder="Type a name…" oninput="scheduleTrainerDefinitionSearch(this.value)"/></label>${xpPurchase?`<div class="flow-note"><strong>Trainer XP purchase:</strong> ${xpCost} XP will be spent from the current bank of ${Number(trainer().exp||0)} XP after prerequisites are validated.</div>`:''}<div id="trainer-definition-results"><p class="muted">Loading Ruleset definitions…</p></div>`,{title:xpPurchase?`Buy Trainer ${kind==='edges'?'Edge':'Feature'} · ${xpCost} XP`:trainingFeature?'Choose Training Feature':`Add Trainer ${kind==='moves'?'Move':kind==='edges'?'Edge':'Feature'}`,subtitle:xpPurchase?'This is a campaign advancement purchase and spends Trainer XP.': 'Definitions are resolved from the active Ruleset.'});await refreshTrainerDefinitionPicker('');}
function scheduleTrainerDefinitionSearch(q){trainerPickerState.query=q;clearTimeout(window.__trainerPickerTimer);window.__trainerPickerTimer=setTimeout(()=>refreshTrainerDefinitionPicker(q),350);}
async function refreshTrainerDefinitionPicker(q=''){const kind=trainerPickerState.kind,seq=++trainerPickerState.seq,box=document.getElementById('trainer-definition-results');if(!kind||!box)return;box.innerHTML='<p class="muted">Searching…</p>';try{const params=new URLSearchParams({kind,q:trainerPickerState.trainingFeature?(q||'Training'):q,limit:trainerPickerState.trainingFeature?'200':'50'});const res=await fetch(`/api/definitions?${params}`,{cache:'no-store'});const payload=await res.json();if(seq!==trainerPickerState.seq||!document.getElementById('trainer-definition-results'))return;let available=payload.rows||[];if(trainerPickerState.trainingFeature)available=available.filter(r=>r.trainingFeature||(r.tags||[]).some(t=>String(t).toLowerCase()==='training'));const rows=available.map(r=>{const profession=r.profession;const meta=profession?` · ${profession.salary_weekly!=null?'₽'+profession.salary_weekly+'/week':''}${profession.hours?' · '+profession.hours:''}`:'';const xpMeta=trainerPickerState.xpPurchase?` · Cost ${kind==='features'?2:1} XP`:'';return `<button class="definition-pick-row" onclick="addTrainerDefinition('${kind}','${String(r.id).replace(/'/g,"\\'")}')"><span><strong>${esc(r.name||r.displayName||r.id)}</strong><small>${esc(r.packName||r.sourceId||'Active Ruleset')}${esc(meta)}${esc(xpMeta)}</small></span><b>${trainerPickerState.xpPurchase?'★':'＋'}</b></button>`}).join('');document.getElementById('trainer-definition-results').innerHTML=rows||'<p class="muted">No matching Training Features in the active Ruleset.</p>';}catch(e){if(box)box.innerHTML=`<div class="builder-validation bad">${esc(e.message)}</div>`;}}
async function addTrainerDefinition(kind,id){
  try{
    const res=await fetch(`/api/definitions/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`,{cache:'no-store'});const payload=await res.json();if(!res.ok)throw new Error(payload.error||'Definition unavailable');
    const def=payload.definition||payload;const td=ensureTrainerDetails();const name=def.name||payload.name||id;
    if(kind==='features'||kind==='edges'){
      const arr=kind==='features'?td.features:td.edges; const repeat=trainerDefinitionRepeatabilityUi(def); const limit=repeat.maxRanks; const existing=arr.filter(x=>x.id===id).length;
      if(existing && !repeat.repeatable && !(kind==='features'&&trainerPickerState.trainingFeature))return toast(`${name} is already recorded.`,'error');
      if(limit && existing>=limit)return toast(`${name} already has all ${limit} allowed rank(s).`,'error');
      const rankNumber=trainerRankedLimit(def)?existing+1:1; const selections=await trainerDefinitionSelections(kind,def,rankNumber); if(selections===null)return;
      const conflict=trainerSelectionConflict(arr,def,selections);if(conflict)return toast(conflict,'error');
      if(trainerPickerState.xpPurchase){return await purchaseTrainerDefinitionWithXp(kind,id,name,selections);}
      const record={id,name,definitionVersionId:def.versionId||def.definitionVersionId||null,contentPackId:def.contentPackId||null,sourceLabel:def.packName||def.sourceId||'Active Ruleset',prerequisites:def.prerequisites||'',effect:def.effect||'',tags:def.raw?.tags||[],compiledEffects:def.compiledEffects||[],semanticAutomation:def.semanticAutomation||null,selections,rank:rankNumber,addedAt:new Date().toISOString()};
      if(kind==='features'){
        if(trainerPickerState.trainingFeature){td.features=td.features.filter(x=>!x.trainingFeature);record.trainingFeature=true;td.trainingFeature=id;}
        td.features.push(record);
      }else td.edges.push(record);
      closeModal();trainer().history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:`Trainer ${kind==='edges'?'Edge':'Feature'} added`,detail:`${name}${limit?` · Rank ${rankNumber}`:''}`});commit(`${name}${limit?` Rank ${rankNumber}`:''} added; sheet effects recalculated.`);return;
    }
    if(kind==='moves'){
      if(td.moves.some(x=>x.id===id&&x.sourceKind===trainerPickerState.moveSourceKind))return toast(`${name} is already recorded from this source.`,'error');
      const sourceMap={feature:'Feature',edge:'Edge',weapon:'Weapon',gm:'GM Grant',manual:'Manual',manual_ruleset:'Ruleset'};
      td.moves.push({id,name,definitionVersionId:def.versionId||def.definitionVersionId||null,contentPackId:def.contentPackId||null,sourceLabel:`${sourceMap[trainerPickerState.moveSourceKind]||'Trainer Move'} · ${def.packName||def.sourceId||'Active Ruleset'}`,prerequisites:def.prerequisites||'',effect:def.effect||'',type:def.type||null,category:def.category||def.damageClass||null,frequency:def.frequency||null,ac:def.ac??null,damageBase:def.damageBase??def.damage_base??null,range:def.range||null,sourceKind:trainerPickerState.moveSourceKind,addedAt:new Date().toISOString()});
      closeModal();trainer().history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Trainer Move added',detail:name});commit(`${name} added to Trainer Moves.`);
    }
  }catch(e){toast(e.message,'error');}
}


async function purchaseTrainerDefinitionWithXp(kind,id,name,selections={}){
  let manualConfirm=false;
  for(let attempt=0;attempt<2;attempt++){
    const response=await fetch('/api/trainer/xp-purchase',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trainer:trainer(),kind,id,selections,manualConfirm,gmOverride:!!state.ui.gmOverride})});
    const payload=await response.json();
    if(response.ok){state.trainer=payload.updatedTrainer;ensureTrainerDetails(state.trainer);invalidateTrainerReference();closeModal();persist();toast(`${name} purchased for ${payload.preview?.cost|| (kind==='features'?2:1)} Trainer XP. ${Number(state.trainer.exp||0)} XP remaining.`);setTimeout(()=>loadTrainerReferenceData(true),0);render();return;}
    const preview=payload.preview||{};
    if(preview.manualRequired&&!manualConfirm&&!state.ui.gmOverride){manualConfirm=!!(await styledConfirm({title:'Manual prerequisite check',message:`<p><strong>${esc(name)}</strong> has a prerequisite the Rules Engine cannot prove automatically.</p><div class="dialog-warning">${esc((preview.prerequisite?.reasons||[]).join(' ')||'Confirm the table requirement is satisfied.')}</div><p>This purchase will spend ${preview.cost|| (kind==='features'?2:1)} Trainer XP.</p>`,confirmLabel:'Confirm & buy',tone:'gold'}));if(manualConfirm)continue;return;}
    throw new Error((preview.errors||[]).join(' ')||payload.error||'Trainer XP purchase failed.');
  }
}
async function editTrainerExperience(){
  const t=trainer();const v=await styledForm({title:'Trainer Experience Bank',subtitle:'Set the Trainer XP currently available for Level Up or campaign purchases.',fields:[{name:'exp',label:'Trainer XP',type:'number',min:0,step:1,value:Number(t.exp||0)}],submitLabel:'Save XP'});if(!v)return;const next=Math.max(0,Math.floor(Number(v.exp)||0)),before=Number(t.exp||0);if(next===before)return; t.exp=next;t.nextExp=10;t.history||=[];t.history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Trainer XP Bank adjusted',detail:`${before} → ${next} XP`});commit(`Trainer XP Bank set to ${next}.`);
}
function changeTrainerExperience(delta){const t=trainer(),before=Math.max(0,Number(t.exp||0)),next=Math.max(0,Math.floor(before+Number(delta||0)));if(next===before)return;t.exp=next;t.nextExp=10;t.history||=[];t.history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Trainer XP Bank adjusted',detail:`${before} → ${next} XP`});commit(`Trainer XP ${Number(delta)>=0?'+':''}${Number(delta)} · ${next} available.`);}

function openTrainerMoveSourcePicker(){
  modal(`<div class="move-source-picker"><button onclick="closeModal();openTrainerDefinitionPicker('moves',false,'feature')"><span>✦</span><strong>Feature</strong><small>Move granted or learned through a Feature.</small></button><button onclick="closeModal();openTrainerDefinitionPicker('moves',false,'edge')"><span>◇</span><strong>Edge</strong><small>Move granted by an Edge.</small></button><button onclick="closeModal();openTrainerDefinitionPicker('moves',false,'weapon')"><span>⚔</span><strong>Weapon</strong><small>Weapon Move or Move used through equipped weapon rules.</small></button><button onclick="closeModal();openTrainerDefinitionPicker('moves',false,'gm')"><span>◈</span><strong>GM Grant</strong><small>Move granted directly by the GM.</small></button><button onclick="closeModal();openTrainerDefinitionPicker('moves',false,'manual')"><span>＋</span><strong>Other / Manual</strong><small>Any other campaign source.</small></button></div>`,{title:'Add Trainer Move',subtitle:'Choose why this Trainer knows the Move. The source remains attached to the sheet.'});
}

async function configureTrainerDefinition(kind,index){
  const td=ensureTrainerDetails(),arr=kind==='features'?td.features:td.edges,item=arr[index];if(!item)return;
  try{const res=await fetch(`/api/definitions/${encodeURIComponent(kind)}/${encodeURIComponent(item.id)}`,{cache:'no-store'});const payload=await res.json();if(!res.ok)throw new Error(payload.error||'Definition unavailable');const def=payload.definition||payload;const rankNumber=Number(item.rank||arr.filter((x,i)=>i<=index&&x.id===item.id).length||1);const selections=await trainerDefinitionSelections(kind,def,rankNumber);if(selections===null)return;const others=arr.filter((_,i)=>i!==index);const conflict=trainerSelectionConflict(others,def,selections);if(conflict)return toast(conflict,'error');item.selections={...(item.selections||{}),...selections};item.tags=def.raw?.tags||item.tags||[];item.compiledEffects=def.compiledEffects||item.compiledEffects||[];commit(`${item.name} choices updated; sheet effects recalculated.`);}catch(e){toast(e.message,'error');}
}

async function removeTrainerDefinition(kind,index){const td=ensureTrainerDetails(),arr=kind==='features'?td.features:td.edges,item=arr[index];if(!item)return;if(!(await styledConfirm({title:`Remove ${kind==='features'?'Feature':'Edge'}`,message:`<p>Remove <strong>${esc(item.name)}</strong> from the Trainer sheet?</p><div class="dialog-warning">This is a sheet-correction action. Automatic retraining/refund rules are not inferred here.</div>`,confirmLabel:'Remove',danger:true})))return;if(kind==='features'&&pokemonCombatSlug(item.id||item.name)==='silent-assassin'&&item.bound){const d=trainerDerived();item.bound=false;td.currentAp=Math.min(d.maxAp,td.currentAp+2);}arr.splice(index,1);if(item.trainingFeature)td.trainingFeature=null;commit(`${item.name} removed.`);}
async function removeTrainerMove(index){const td=ensureTrainerDetails(),m=td.moves[index];if(!m)return;if(!(await styledConfirm({title:'Remove Trainer Move',message:`<p>Remove <strong>${esc(m.name)}</strong> from the Trainer Move list?</p>`,confirmLabel:'Remove',danger:true})))return;td.moves.splice(index,1);commit(`${m.name} removed from Trainer Moves.`);}
function changeTrainerHp(delta){
  const td=ensureTrainerDetails(),d=trainerDerived(); const amount=Number(delta)||0; td.tempHp=Math.max(0,Number(td.tempHp||0));
  if(amount>0){ const missing=Math.max(0,d.healingHpLimit-td.currentHp); const restored=Math.min(amount,missing); td.currentHp+=restored; td.tempHp+=Math.max(0,amount-restored); }
  else if(amount<0){ let damage=-amount; const absorbed=Math.min(td.tempHp,damage); td.tempHp-=absorbed; damage-=absorbed; td.currentHp=Math.max(0,td.currentHp-damage); }
  commit(td.tempHp?`Trainer HP: ${td.currentHp}/${d.maxHp} +${td.tempHp} Temporary HP`:`Trainer HP: ${td.currentHp}/${d.maxHp}`);
}
function changeTrainerInjury(delta){const td=ensureTrainerDetails();td.injuries=Math.max(0,Math.min(10,td.injuries+delta));commit();}
function toggleSilentAssassinBound(index){const td=ensureTrainerDetails(),feature=td.features[index];if(!feature||pokemonCombatSlug(feature.id||feature.name)!=='silent-assassin')return;const d=trainerDerived();if(feature.bound){feature.bound=false;td.currentAp=Math.min(d.maxAp,td.currentAp+2);commit('Silent Assassin unbound; its 2 AP are available again.');return;}if(td.currentAp<2)return toast('Bind Silent Assassin requires 2 available AP.','error');td.currentAp-=2;feature.bound=true;commit('Silent Assassin Bound · 2 AP committed.');}
function changeTrainerAp(delta){const td=ensureTrainerDetails(),d=trainerDerived();td.currentAp=Math.max(0,Math.min(d.availableMaxAp??(d.maxAp-trainerBoundAp()),td.currentAp+delta));commit();}
function changeTrainerStage(key,delta){const td=ensureTrainerDetails();td.combatStages[key]=Math.max(-6,Math.min(6,Number(td.combatStages[key]||0)+delta));commit();}

function rostersScreen(){
  const r=roster(); const memberIds=new Set(rosterMembers(r.id).map(p=>p.id)); const selected=pokemon();
  return `<div class="page">${heading('ROSTERS','Team Organization','Multiple rosters can be active at once. A Pokémon may belong to several rosters.',`<div class="row-gap"><button class="btn btn-ghost" onclick="editRoster('${r.id}')">✎ Edit Roster</button><button class="btn btn-danger" onclick="deleteRoster('${r.id}')">🗑 Delete Roster</button><button class="btn btn-primary" onclick="createRoster()">＋ Create Roster</button></div>`)}
  <div class="roster-selector">${state.rosters.map(x=>`<button class="${x.id===r.id?'active':''}" style="--accent:${x.color}" onclick="selectRoster('${x.id}')"><strong>${esc(x.name)}</strong>${chip(esc(x.role),x.role==='COMBAT'?'chip-green':x.role==='COMPANY'?'chip-blue':'chip-yellow')}${x.active===false?chip('HIDDEN','chip-neutral'):''}<b>${rosterMembers(x.id).length}/${x.maxMembers}</b></button>`).join('')}</div>
  <div class="roster-layout">
  ${section(`${esc(r.name.toUpperCase())} — ${rosterMembers(r.id).length}/${r.maxMembers}`,`<div class="roster-grid">${rosterMembers(r.id).map(p=>creatureCard(p)).join('')||'<p class="muted">This roster is empty.</p>'}</div><h3 class="subhead">Available Pokémon</h3><div class="available-grid">${state.pokemon.filter(p=>!p.storage && !memberIds.has(p.id)).map(p=>`<div class="roster-add-wrap">${creatureCard(p,true)}<button class="btn btn-ghost full" onclick="addPokemonToRoster('${p.id}','${r.id}')">＋ Add</button></div>`).join('')||'<p class="muted">All carried Pokémon are already assigned.</p>'}</div>`)}
  ${section('SELECTED POKÉMON',selected?`<div class="detail-hero">${pokemonPortraitTag(selected)}<div><h2>${esc(selected.name)}</h2><p>${esc(selected.species)} · Lv. ${selected.level}</p><div>${selected.types.map(typeBadge).join('')}</div></div></div><dl class="detail-dl"><div><dt>Poké Ball</dt><dd>${esc(selected.ball)}</dd></div><div><dt>Loyalty</dt><dd>${loyaltyHearts(selected.loyalty)}</dd></div><div><dt>Sex</dt><dd>${esc(pokemonGenderLabel(selected.details?.gender))}</dd></div><div><dt>Injuries</dt><dd>${selected.injuries}</dd></div></dl><h4>Roster memberships</h4><div class="membership-list">${state.rosters.map(x=>`<span><i style="background:${x.color}"></i>${esc(x.name)} ${selected.rosterIds.includes(x.id)?chip('MEMBER','chip-green'):`<button class="mini-action" onclick="addPokemonToRoster('${selected.id}','${x.id}')">Add</button>`}</span>`).join('')}</div><div class="row-gap selected-pokemon-actions"><button class="btn btn-primary" onclick="selectPokemon('${selected.id}',true)">🐾 Open in Creatures</button>${selected.rosterIds.includes(r.id)?`<button class="btn btn-danger" onclick="removePokemonFromRoster('${selected.id}','${r.id}')">Remove from ${esc(r.name)}</button>`:''}</div>`:`<div class="empty-state"><p>No Pokémon in this Trainer profile yet.</p><button class="btn btn-primary" onclick="route('pokemonbuilder')">＋ Create Pokémon</button></div>`)}
  </div></div>`;
}

function moveSourceInfo(move={}){
  const src=String(move.source||move.sourceKind||'current_species').toLowerCase();
  const map={
    current_species:['NATURAL','chip-blue','Level-Up / Species'],
    pre_evolution:['PRE-EVO','chip-purple','Pre-Evolution'],
    evolution:['EVOLUTION','chip-yellow','Evolution'],
    gm_override:['GM OVERRIDE','chip-red','GM Override'],
    tm:['TM','chip-green','TM'], hm:['HM','chip-green','HM'], tm_hm:['TM/HM','chip-green','TM/HM'],
    tutor:['MOVE TUTOR','chip-purple','Move Tutor'], natural_tutor:['NATURAL TUTOR','chip-blue','Natural Tutor'],
    egg_tutor:['EGG TUTOR','chip-yellow','Egg Tutor'], archive_tutor:['ARCHIVE TUTOR','chip-purple','Archive Tutor'], advanced_connection:['ADVANCED CONNECTION','chip-blue','Advanced Connection']
  };
  const [label,tone,longLabel]=map[src]||[src.replaceAll('_',' ').toUpperCase(),'chip-gray',src.replaceAll('_',' ')];
  return {src,label,tone,longLabel};
}
function statDisplayName(key){return ({hp:'HP',attack:'Attack',defense:'Defense',special_attack:'Sp. Attack',special_defense:'Sp. Defense',speed:'Speed'})[key]||key;}
function normalizeNaturewalkTerrains(c){
  if(!c)return []; const source=typeof c==='string'?c:(c.terrains??c.terrain??'');
  const fromName=typeof c==='string'?c:String(c.name||''); const nameMatch=fromName.match(/^naturewalk\s*(?:\[([^\]]+)\]|\(([^)]+)\))$/i);
  const raw=(source===''&&nameMatch)?(nameMatch[1]||nameMatch[2]):source; const values=(Array.isArray(raw)?raw:[raw]).flatMap(v=>String(v??'').split(/[,;|/]/)).map(v=>v.trim()).filter(Boolean);
  const seen=new Set(); return values.filter(v=>{const k=v.toLocaleLowerCase();if(seen.has(k))return false;seen.add(k);return true;});
}
function formatCapability(c){if(!c)return '—'; if(typeof c==='string'&&!/^naturewalk(?:\s|\[|\(|$)/i.test(c.trim()))return c; if(c?.kind==='jump')return `${c.name||'Jump'} ${c.high??'?'}/${c.long??'?'}`; const id=String(c?.capability_id||c?.id||c?.name||c||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); if(id==='naturewalk'||/^naturewalk(?:\s|\[|\(|$)/i.test(String(c?.name||c||'').trim())){const terrains=normalizeNaturewalkTerrains(c);return terrains.length?`Naturewalk [${terrains.join(', ')}]`:'Naturewalk';} return `${c.name||c.capability_id||'Capability'}${c.value!=null?` ${c.value}`:''}`;}
function abilitySlotLabel(index){return index===0?'Starting Ability':index===1?'Level 20 Ability':index===2?'Level 40 Ability':`Ability ${index+1}`;}
async function setCreatureTab(tab){
  const valid=['sheet','moves','abilities','species','type','pokedex']; state.ui.creatureTab=valid.includes(tab)?tab:'sheet'; persist(); render();
  // Always resolve a fresh creature model when entering a reference-backed tab. This avoids stale
  // Ability/Modifier data after progression, Poké Edge purchases/refunds, Held Item changes, etc.
  if(state.ui.creatureTab!=='sheet') await loadCreatureReferenceData(true);
}
async function loadCreatureReferenceData(force=false){
  const p=pokemon(); if(!p?.details?.speciesDefinitionId)return;
  if(!force&&creatureReferenceState.pokemonId===p.id&&creatureReferenceState.data)return;
  creatureReferenceState={pokemonId:p.id,loading:true,error:null,data:null}; render();
  try{
    const response=await fetch('/api/pokemon/reference-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:p,rulesetId:catalogState.status?.activeRulesetId})});
    const payload=await response.json(); if(!response.ok)throw new Error(payload.error||'Unable to load Pokémon reference data');
    const resolvedMax=Number(payload?.resolvedCreature?.stats?.breakdown?.maxHp);
    if(Number.isFinite(resolvedMax)&&resolvedMax>0&&Number(p.maxHp)!==resolvedMax){ p.maxHp=resolvedMax;p.hp=Math.min(Number(p.hp||0),resolvedMax);await revalidatePokemonFormAfterDirectHpMutation(p.id,{hpChanged:true,tempHpChanged:false,silent:true});persist(); }
    creatureReferenceState={pokemonId:p.id,loading:false,error:null,data:payload};
  }catch(error){creatureReferenceState={pokemonId:p.id,loading:false,error:error.message,data:null};}
  render();
}
function creatureReferencePlaceholder(){
  if(creatureReferenceState.loading)return section('LOADING','<p class="muted">Resolving Species, Moves, Abilities and Type data from the active Ruleset…</p>');
  if(creatureReferenceState.error)return section('REFERENCE DATA ERROR',`<div class="builder-validation bad">${esc(creatureReferenceState.error)}</div><button class="btn btn-primary" onclick="loadCreatureReferenceData(true)">Retry</button>`);
  return section('REFERENCE DATA','<p class="muted">Open this tab again to load the Ruleset-backed reference data.</p>');
}
/* Stage A.9 compatibility anchor: function creatureMovesTab(p){ */
function creatureMovesTab(p,data){
  if(!data)return creatureReferencePlaceholder();
  const d=p.details||{}; const poolLimit=Number(d.tutorMovePoolLimit??3); const nonNatural=(d.moves||[]).filter(m=>['tm','hm','tm_hm','tutor','egg_tutor','archive_tutor'].includes(String(m.source||'').toLowerCase())&&!m.countsAsNatural).length;
  const mixed=data.modifierSummary?.twistedPower?.active?data.modifierSummary.twistedPower:null;
  const cards=(data.moves||[]).map(({record:m,definition:def,resolvedDamage:rd,effectiveAc,accuracyTrainingRanks=0},moveIndex)=>{
    const src=moveSourceInfo(m);
    const keywordHtml=moveKeywordReferenceHtml(def||m); /* moveKeywordReferenceHtml(def||payload||mv) compatibility marker */
    /*
function creatureProgressionTab
    */
    const damage=rd?`<div class="resolved-damage-box"><div class="row-between"><strong>${esc(rd.finalRoll)}</strong>${rd.mixedPowerBonus?chip(`MIXED POWER +${rd.mixedPowerBonus}`,'chip-purple'):''}</div><small>DB ${rd.baseDamageBase}${rd.stabDamageBaseBonus?` + STAB ${rd.stabDamageBaseBonus}`:''} → DB ${rd.finalDamageBase} · ${esc(rd.primaryStat.name)} ${rd.primaryStat.value}${rd.mixedPowerBonus?` · Mixed Power +${rd.mixedPowerBonus}`:''}</small></div>`:'';
    const contestType=def?.contestType||def?.raw?.contest_type||null;
    const contestEffect=def?.contestEffect||def?.raw?.contest_effect||null;
    const contest=(contestType||contestEffect)?`<div class="move-contest-box"><strong>Contest</strong><div>${contestType?`<span><small>Type</small><b>${esc(contestType)}</b></span>`:''}${contestEffect?`<span><small>Effect</small><b>${esc(contestEffect)}</b></span>`:''}</div></div>`:'';
    return `<article class="known-move-card"><div class="row-between"><div><h3>${esc(m.name)}</h3><div class="row-gap">${def?.type?typeBadge(String(def.type).toLowerCase()):m.typeHint?typeBadge(String(m.typeHint).toLowerCase()):''}${chip(src.label,src.tone)}${accuracyTrainingRanks?chip(`ACCURACY TRAINING -${accuracyTrainingRanks}`,'chip-gold'):''}${m.countsAsNatural&&['tm','tutor','natural_tutor','egg_tutor'].includes(src.src)?chip('COUNTS AS NATURAL','chip-green'):''}</div></div><div class="move-metrics">${def?.frequency?`<span><small>Frequency</small><b>${esc(def.frequency)}</b></span>`:''}${def?.ac!=null?`<span><small>AC</small><b>${esc(effectiveAc??def.ac)}${accuracyTrainingRanks?` <del>${esc(def.ac)}</del>`:''}</b></span>`:''}${def?.damageBase!=null?`<span><small>DB</small><b>${esc(def.damageBase)}</b></span>`:''}${def?.range?`<span class="move-range-metric"><small>Range</small><b>${esc(def.range)}</b></span>`:''}</div></div>${damage}<p>${esc(def?.effect||'No resolved effect text available in this Ruleset.')}</p>${contest}${keywordHtml}<small>Learned via ${esc(src.longLabel)}${m.learnedAt?` · Lv. ${m.learnedAt}`:''}${m.sourceSpeciesName?` · ${esc(m.sourceSpeciesName)}`:''}${accuracyTrainingRanks?` · Accuracy Training applied`:''}</small><button class="btn btn-ghost btn-small" onclick="usePokemonMoveForForms('${p.id}',${moveIndex})">Use Move</button></article>`;
  }).join('')||'<p class="muted">No known Moves recorded.</p>';
  const modifierNote=mixed?`<div class="flow-note"><strong>Mixed Power / Twisted Power active:</strong> Physical Move damage rolls gain +${mixed.physicalDamageBonus} from half Sp. Attack; Special Move damage rolls gain +${mixed.specialDamageBonus} from half Attack. The stored Attack and Sp. Attack Stats are not changed.</div>`:'';
  return `<div class="creature-tab-content"><div class="training-kpis"><div><strong>${(d.moves||[]).filter(m=>!m.connectionGrant?.moveSlotExempt).length} / ${Number(data?.resolvedCreature?.moveLimit?.effective??d.moveLimitEffective??6)}</strong><span>Known Move slots</span><small>Move Limit remains rules-resolved, not hardcoded.</small></div><div><strong>${nonNatural} / ${poolLimit}</strong><span>Non-natural TM/Tutor pool</span><small>Natural Tutor and Level-Up-natural Moves do not count.</small></div><div><strong>${Number(d.tutorPointsRemaining??0)}</strong><span>Tutor Points</span><small>${Number(d.tutorPointsSpent??0)} spent / ${Number(d.tutorPointsEarned??0)} earned</small></div></div>${modifierNote}<div class="known-move-grid">${cards}</div></div>`;
}
function abilitySourcePresentation(a){
  const kind=String(a?.sourceKind||'');
  if(a?.grantSource?.sourceId==='mixed-power'||a?.sourceId==='mixed-power') return {label:'GRANTED BY MIXED POWER',tone:'chip-purple',detail:'Granted by Poké Edge: Mixed Power'};
  if(kind==='species_starting') return {label:'STARTING ABILITY',tone:'chip-blue',detail:'Species starting Ability'};
  if(kind==='level_choice'&&Number(a?.unlockLevel)===20) return {label:'LEVEL 20 CHOICE',tone:'chip-gold',detail:'Chosen in the Level 20 Ability slot'};
  if(kind==='level_choice'&&Number(a?.unlockLevel)===40) return {label:'LEVEL 40 CHOICE',tone:'chip-gold',detail:'Chosen in the Level 40 Ability slot'};
  if(kind==='poke_edge') return {label:'POKÉ EDGE GRANT',tone:'chip-purple',detail:a?.sourceLabel||'Granted by Poké Edge'};
  if(kind==='held_item') return {label:'HELD ITEM',tone:'chip-green',detail:a?.sourceLabel||'Granted by Held Item'};
  if(a?.grantSource) return {label:'GRANTED',tone:'chip-green',detail:a?.sourceLabel||'Granted by another effect'};
  return {label:a?.sourceLabel||abilitySlotLabel(a?.index||0),tone:'chip-blue',detail:a?.sourceLabel||abilitySlotLabel(a?.index||0)};
}
function creatureAbilitiesTab(p,data){
  if(!data)return creatureReferencePlaceholder();
  const cards=(data.abilities||[]).map((a,abilityIndex)=>{const src=abilitySourcePresentation(a);return `<article class="ability-card"><div class="row-between"><div><h3>${esc(a.name)}</h3>${chip(src.label,src.tone)}</div>${a.definition?.sourceId?chip(esc(a.definition.sourceId),'chip-gray'):''}</div><p>${esc(a.definition?.effect||'No resolved effect text available.')}</p><small>${esc(src.detail)}. ${a.definition?`Source: ${esc(a.definition.packName||a.definition.sourceId||'Ruleset')}${a.definition.sourcePage?` · p. ${a.definition.sourcePage}`:''}`:'Definition not resolved in active Ruleset.'}</small>${['schooling','power-construct'].includes(formEventSlug(a.name))?`<button class="btn btn-gold btn-small" onclick="usePokemonAbilityForForms('${p.id}',${abilityIndex})">Use Ability</button>`:''}</article>`}).join('')||'<p class="muted">No Abilities recorded.</p>';
  const sourceLegend=`<div class="ability-source-legend">${chip('STARTING ABILITY','chip-blue')}${chip('LEVEL CHOICE','chip-gold')}${chip('GRANTED','chip-green')}${chip('POKÉ EDGE GRANT','chip-purple')}</div>`;
  const unresolved=data.abilitySlotStatus?.unresolved||[];
  const warning=unresolved.length?`<div class="builder-validation bad"><strong>Native Ability slot needs attention.</strong><ul>${unresolved.map(x=>`<li>${esc(x.label)}${x.unlockLevel?` (unlocked at Lv. ${x.unlockLevel})`:''} has no recorded selection.</li>`).join('')}</ul><small>This can happen on a save created before the resolved Ability model. Use Edit Native Ability Slots to repair it.</small></div>`:'';
  return `<div class="creature-tab-content"><div class="row-between ability-tab-actions"><div><strong>${(data.abilities||[]).length} resolved Abilities</strong><small>Native slots and granted Abilities are merged without duplicates.</small></div><button class="btn btn-primary" onclick="openAbilityCorrection()">Edit Native Ability Slots</button></div>${warning}${sourceLegend}<div class="ability-card-grid">${cards}</div></div>`;
}
function creatureSpeciesTab(p,data){
  if(!data)return creatureReferencePlaceholder();
  const sp=data.species,d=p.details||{},resolved=data.resolvedCreature||{},statBreakdown=resolved.stats?.breakdown||null;
  const base=statBreakdown?.speciesBase||sp.baseStats||{}; const nat=statBreakdown?.natureAdjusted||d.natureAdjustedBaseStats||{};
  const levelAlloc=statBreakdown?.levelAllocation||d.statAllocations||{}; const edgeAlloc=statBreakdown?.bonusAllocation||{}; const final=statBreakdown?.permanentFinal||d.finalStats||{};
  const baseBonus=statBreakdown?.baseBonus||{}; const exempt=statBreakdown?.baseRelations?.exemptStats||d.baseRelationExemptStats||['hp'];
  const rows=['hp','attack','defense','special_attack','special_defense','speed'].map(k=>{
    const edgePoints=Number(edgeAlloc[k]||0),baseBoost=Number(baseBonus[k]||0),totalAlloc=Number(levelAlloc[k]||0)+edgePoints;
    const source=[]; if(baseBoost)source.push(chip(`BASE +${baseBoost}`,'chip-gold')); if(edgePoints)source.push(chip(`EDGE +${edgePoints}`,'chip-purple')); if(exempt.includes(k))source.push(chip('RELATION EXEMPT','chip-yellow'));
    return `<div><strong>${statDisplayName(k)}</strong><span>${base[k]??'—'}${baseBoost?` +${baseBoost}`:''}</span><span>${nat[k]??'—'}</span><span>+${totalAlloc}</span><b>${final[k]??'—'}</b><i>${source.join(' ')}</i></div>`;
  }).join('');
  const resolvedCaps=resolved.capabilities||sp.capabilities||[]; const caps=resolvedCaps.map(c=>chip(esc(formatCapability(c)),String(c.name||'').toLowerCase()==='underdog'?'chip-gold':'chip-blue')).join(' ');
  const resolvedSkills=resolved.skills||[];
  const skills=(resolvedSkills.length?resolvedSkills:(sp.raw?.skills||[]).map(x=>({name:x.skill,dice:x.dice,modifier:x.modifier,defaultDice:x.dice,pokeEdgeRanks:0}))).map(x=>`<span><b>${esc(x.name||x.skill)}</b> ${x.dice}d6${x.modifier>0?`+${x.modifier}`:x.modifier<0?x.modifier:''}${x.pokeEdgeRanks?` ${chip(`SKILL IMPROVEMENT +${x.pokeEdgeRanks}`,'chip-purple')}`:''}</span>`).join('') || `<span>${esc(sp.raw?.skills_text||'No skills parsed.')}</span>`;
  const edges=(d.pokeEdges||[]).map(e=>{const alloc=e.statAllocation||{};const allocated=Object.entries(alloc).filter(([,v])=>Number(v)>0).map(([k,v])=>`${statDisplayName(k)} +${v}`).join(', ');return `<div class="ledger-row"><span>◆</span><div><strong>${esc(e.name)}</strong><small>${e.targetStat?`Bound to ${e.targetStat==='attack'?'Attack':'Special Attack'} · `:''}${e.targetNote?`${esc(e.targetNote)} · `:''}${allocated?`${esc(allocated)} · `:''}${e.cost??0} TP${e.id==='mixed-power'?' · Grants Twisted Power':''}</small></div>${chip(e.id==='attack-conflict'?'BASE RELATION':e.id==='mixed-power'?'DAMAGE MODIFIER':['underdogs-strength','realized-potential','mixed-sweeper'].includes(e.id)?'STAT MODIFIER':e.id==='skill-improvement'?'SKILL MODIFIER':'POKÉ EDGE',e.id==='attack-conflict'?'chip-yellow':e.id==='mixed-power'?'chip-purple':['underdogs-strength','realized-potential','mixed-sweeper','skill-improvement'].includes(e.id)?'chip-gold':'chip-blue')}</div>`}).join('')||'<p class="muted">No Poké Edges.</p>';
  const mixed=data.modifierSummary?.twistedPower?.active?`<div class="modifier-callout"><strong>Mixed Power / Twisted Power</strong><span>Physical damage +${data.modifierSummary.twistedPower.physicalDamageBonus} · Special damage +${data.modifierSummary.twistedPower.specialDamageBonus}</span><small>This modifies damage rolls only; Attack and Special Attack values remain unchanged.</small></div>`:'';
  const edgeNote=statBreakdown?.applied?.length?`<div class="flow-note"><strong>Resolved Poké Edge Stats:</strong> ${statBreakdown.applied.map(x=>x.kind==='base_stat_bonus'?`${esc(x.name)}: +1 to every Base Stat`:`${esc(x.name)}: ${Object.entries(x.stats||{}).filter(([,v])=>Number(v)>0).map(([k,v])=>`${statDisplayName(k)} +${v}`).join(', ')}`).join(' · ')}</div>`:'';
  const unresolved=statBreakdown?.unresolved?.length?`<div class="builder-validation bad"><strong>Poké Edge configuration needed.</strong><ul>${statBreakdown.unresolved.map(x=>`<li>${esc(x.name)} requires ${x.expected} allocated Stat Point${x.expected===1?'':'s'}; this legacy record has ${x.spent}.</li>`).join('')}</ul><small>Refund and acquire the Edge again to record its allocation.</small></div>`:'';
  const evolutionLock=resolved.evolutionLocked?`<div class="builder-validation bad"><strong>Evolution locked:</strong> ${esc(resolved.evolutionLockSource||"Underdog's Strength")} prevents this Pokémon from evolving under normal rules.</div>`:'';
  return `<div class="creature-tab-content species-tab-layout">${section('PERMANENT STAT BUILD',`${unresolved}${evolutionLock}<div class="species-stat-table"><div class="head"><strong>Stat</strong><span>Species</span><span>Nature Base</span><span>Allocation</span><b>Final</b><i>Sources</i></div>${rows}</div><div class="flow-note"><strong>Base Relations exemptions:</strong> ${exempt.map(statDisplayName).join(', ')}. Poké Edge Stat bonuses are included in the resolved Final column.</div>${edgeNote}${mixed}<button class="btn btn-primary" onclick="beginPokemonRestat()">↺ Redistribute Stats</button>`)}${section('CAPABILITIES',`<div class="capability-cloud">${caps||'<span class="muted">No parsed Capabilities.</span>'}</div>${resolved.capabilityModifiers?.length?`<div class="flow-note"><strong>Poké Edge modifiers:</strong> ${resolved.capabilityModifiers.map(m=>`${esc(m.targetName)} +${m.value}`).join(' · ')}</div>`:''}`)}${section('SPECIES SKILLS',`<div class="species-skill-grid">${skills}</div>${resolved.skillModifiers?.length?`<div class="flow-note"><strong>Skill Improvement:</strong> ${resolved.skillModifiers.map(m=>`${esc(m.targetName)} +${m.value} Rank`).join(' · ')}</div>`:''}`)}${section('POKÉ EDGES',`<div class="training-ledger">${edges}</div>`)}</div>`;
}

function creatureTypeTab(p,data){
  if(!data)return creatureReferencePlaceholder();
  const pr=Array.isArray(data.typeProfile)?data.typeProfile:[]; const groups={immune:[],resistant:[],weak:[],neutral:[]}; for(const row of pr){let rel=String(row.relation||'neutral').toLowerCase(); if(rel==='resist')rel='resistant'; (groups[rel]||groups.neutral).push(row);}
  const renderRows=(rows,empty)=>rows.length?rows.map(r=>`<div>${typeBadge(String(r.attack_type||r.attackType||'').toLowerCase())}<strong>×${r.multiplier??r.combat_multiplier??1}</strong>${Number(r.netSteps)<=-2?chip(`${Math.abs(Number(r.netSteps))}× RESIST`,'chip-blue'):''}</div>`).join(''):`<p class="muted">${empty}</p>`;
  return `<div class="creature-tab-content"><div class="type-hero"><div>${p.types.map(typeBadge).join(' ')}</div><p>Defensive profile uses the PTU effectiveness scale resolved from the active Ruleset data. Dual-type resistance steps are combined before the final multiplier is selected.</p></div><div class="type-profile-grid">${section('IMMUNITIES',renderRows(groups.immune,'No immunities.'))}${section('RESISTANCES',renderRows(groups.resistant,'No resistances.'))}${section('WEAKNESSES',renderRows(groups.weak,'No weaknesses.'))}</div></div>`;
}
function creaturePokedexTab(p,data){
  if(!data)return creatureReferencePlaceholder();
  const sp=data.species,raw=sp.raw||{}; const dex=sp.dexNumber??raw.dex_number??raw.display_dex_id??'—';
  return `<div class="creature-tab-content pokedex-layout">${section('SPECIES PROFILE',`<dl class="detail-dl"><div><dt>Species</dt><dd>${esc(sp.name)}</dd></div><div><dt>National Dex</dt><dd>${esc(dex)}</dd></div><div><dt>Height</dt><dd>${esc(raw.height?.raw||raw.height_text||'—')}</dd></div><div><dt>Weight</dt><dd>${esc(raw.weight?.raw||raw.weight_text||'—')}</dd></div><div><dt>Gender Ratio</dt><dd>${esc(raw.gender_ratio?.raw||raw.gender_ratio_text||'—')}</dd></div><div><dt>Egg Group</dt><dd>${esc((raw.egg_groups||[]).join(' / ')||raw.egg_group_text||'—')}</dd></div><div><dt>Diet</dt><dd>${esc(raw.diet?.values?.join(', ')||raw.diet_text||'—')}</dd></div><div><dt>Habitat</dt><dd>${esc((raw.habitats||[]).join(', ')||raw.habitat_text||'—')}</dd></div></dl>`)}${section('PTU SOURCE',`<dl class="detail-dl"><div><dt>Content Pack</dt><dd>${esc(sp.packName||sp.contentPackId||'—')}</dd></div><div><dt>Source</dt><dd>${esc(sp.sourceId||'—')}</dd></div><div><dt>Page</dt><dd>${esc(sp.sourcePage??'—')}</dd></div><div><dt>Completeness</dt><dd>${esc(sp.completeness||raw.mechanical_completeness||'—')}</dd></div></dl>`)}${section('POKÉDEX ENTRIES',`<div class="flow-note"><strong>Flavor-text pack not bundled yet.</strong> The data model and tab are ready for game-specific English Pokédex entries, but the supplied PTU books do not contain that external flavor-text catalog.</div>`)}</div>`;
}

function heldItemEffectHtml(effect){
  if(!effect)return '<span class="muted">No automated Held Item effect resolved.</span>';
  const bits=[];
  if(effect.speedEvasionBonus)bits.push(`Speed Evasion +${effect.speedEvasionBonus}`);
  if(effect.grantedAbilities?.length)bits.push(`Grants ${effect.grantedAbilities.join(', ')}`);
  if(effect.conditionalDamageBonusSuperEffective)bits.push(`+${effect.conditionalDamageBonusSuperEffective} damage when Super Effective`);
  if(effect.preventsEvolution)bits.push('Prevents evolution');
  if(effect.hpStealRecoveryMultiplier>1)bits.push(`HP-steal recovery ×${effect.hpStealRecoveryMultiplier}`);
  if(effect.speedMultiplier!==1)bits.push(`Speed ×${effect.speedMultiplier}`);
  if(effect.removeGroundImmunity)bits.push('Removes Ground immunity');
  for(const [k,v] of Object.entries(effect.statBonuses||{}))bits.push(`${statDisplayName(k)} +${v}`);
  if(effect.defaultCombatStage)bits.push(`${statDisplayName(effect.defaultCombatStage.stat)} default CS +${effect.defaultCombatStage.value}`);
  return `<div class="held-effect-summary"><strong>${esc(effect.name||'Held Item')}</strong><p>${esc(effect.effectText||'')}</p>${bits.length?`<div>${bits.map(x=>chip(esc(x),'chip-green')).join(' ')}</div>`:''}${effect.automation==='manual'?chip('MANUAL EFFECT','chip-yellow'):chip(String(effect.automation||'resolved').toUpperCase(),'chip-blue')}${(effect.warnings||[]).map(w=>`<small>⚠ ${esc(w)}</small>`).join('')}</div>`;
}
let heldItemPickerState={loading:false,error:null,items:[]};
async function openHeldItemPicker(){
  const p=pokemon(); if(!p)return;
  heldItemPickerState={loading:true,error:null,items:[]};
  modal('<h2>Pokémon Held Item</h2><p class="muted">Loading eligible Held Items from the backpack…</p>');
  try{
    const response=await fetch('/api/pokemon/held-item-options',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:p,inventory:state.inventory})});
    const payload=await response.json(); if(!response.ok)throw new Error(payload.error||'Could not load Held Items.');
    heldItemPickerState={loading:false,error:null,items:payload.items||[]};
    const rows=(payload.items||[]).map(x=>`<article class="held-picker-item"><div><span class="item-icon">${esc(x.icon||'◆')}</span><div><strong>${esc(x.name)}</strong><small>Backpack ×${x.qty} · ${esc(x.definition?.category||'Held Item')}</small></div></div><p>${esc(x.definition?.effect||x.effect?.effectText||'')}</p><div>${x.effect?.automation==='manual'?chip('MANUAL','chip-yellow'):chip(String(x.effect?.automation||'RESOLVED').toUpperCase(),'chip-green')}</div><button class="btn btn-primary" onclick="equipHeldItem('${esc(x.inventoryId)}')">Equip</button></article>`).join('')||'<p class="muted">No Pokémon-compatible Held Items are currently in the Backpack.</p>';
    modal(`<h2>Pokémon Held Item</h2><p class="muted">A Pokémon normally has one active Held Item. Equipping one in play is a Standard Action and causes the Pokémon to forfeit its next turn.</p>${p.heldItem?`<div class="flow-note"><strong>Current:</strong> ${esc(p.heldItem)} <button class="btn btn-ghost" onclick="unequipHeldItem()">Return to Backpack</button></div>`:''}<div class="held-picker-grid">${rows}</div><div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Close</button></div>`);
  }catch(e){modal(`<h2>Pokémon Held Item</h2><div class="builder-validation bad">${esc(e.message)}</div><button class="btn btn-ghost" onclick="closeModal()">Close</button>`)}
}
async function heldConfigForItem(itemId){
  const statOptions=[{value:'hp',label:'HP'},{value:'attack',label:'Attack'},{value:'defense',label:'Defense'},{value:'special_attack',label:'Special Attack'},{value:'special_defense',label:'Special Defense'},{value:'speed',label:'Speed'}];
  if(itemId==='eviolite'){
    const v=await styledForm({title:'Configure Eviolite',subtitle:'Choose two different Stats to receive the Eviolite bonus.',fields:[{name:'a',label:'First Stat',type:'select',value:'defense',options:statOptions},{name:'b',label:'Second Stat',type:'select',value:'special_defense',options:statOptions}],submitLabel:'Use Eviolite'}); if(!v)return null; if(v.a===v.b){toast('Eviolite requires two different Stats.','error');return null;} return {stats:[v.a,v.b]};
  }
  if(itemId==='choice-item'){
    const v=await styledForm({title:'Configure Choice Item',subtitle:'Choose which offensive/defensive Stat this item is bound to.',fields:[{name:'stat',label:'Bound Stat',type:'select',value:'attack',options:statOptions.filter(x=>x.value!=='hp')}],submitLabel:'Use Choice Item'}); if(!v)return null; return {stat:v.stat};
  }
  return {};
}
function returnHeldItemToBackpack(p){
  if(!p?.heldItem)return;
  const d=p.details||{}; const invId=d.heldItemInventoryId||d.heldItemDefinitionId||String(p.heldItem).toLowerCase().replace(/[^a-z0-9]+/g,'-');
  let item=state.inventory.find(i=>i.id===invId) || state.inventory.find(i=>i.name===p.heldItem);
  if(item)item.qty+=1; else state.inventory.push({id:invId,icon:'◆',name:p.heldItem,category:'held',price:0,qty:1,consumable:false,equipSlot:null});
  p.heldItem=null; delete d.heldItemDefinitionId; delete d.heldItemInventoryId; delete d.heldItemConfig; delete d.heldItemEffectSnapshot; delete d.heldItemDefinitionSnapshot;
}
async function equipHeldItem(inventoryId){
  const p=pokemon(), inv=inventoryItem(inventoryId); if(!p||!inv||inv.qty<=0)return toast('Held Item is not available in the Backpack.','error');
  const config=await heldConfigForItem(inventoryId); if(config==null)return;
  try{
    const response=await fetch('/api/pokemon/held-item-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:p,inventoryItem:inv,config})});
    const payload=await response.json(); if(!response.ok||!payload.valid)return toast((payload.errors||[payload.error||'Held Item configuration is invalid.']).join(' '),'error');
    if(p.heldItem)returnHeldItemToBackpack(p);
    inv.qty-=1; p.heldItem=inv.name; p.details=p.details||{}; p.details.heldItemDefinitionId=payload.definition.id; p.details.heldItemInventoryId=inv.id; p.details.heldItemConfig=config; p.details.heldItemEffectSnapshot=payload.effect; if(payload.definition.custom)p.details.heldItemDefinitionSnapshot=payload.definition; else delete p.details.heldItemDefinitionSnapshot;
    p.details.heldItemHistory=Array.isArray(p.details.heldItemHistory)?p.details.heldItemHistory:[]; p.details.heldItemHistory.push({date:new Date().toISOString(),action:'equip',item:inv.name,definitionId:payload.definition.id,config});
    closeModal(); creatureReferenceState={pokemonId:null,loading:false,error:null,data:null}; commit(`${inv.name} equipped to ${p.name}.`); await loadCreatureReferenceData(true);
  }catch(e){toast(e.message,'error')}
}
async function unequipHeldItem(){const p=pokemon();if(!p?.heldItem)return;const name=p.heldItem;returnHeldItemToBackpack(p);closeModal();creatureReferenceState={pokemonId:null,loading:false,error:null,data:null};commit(`${name} returned to the Backpack.`);await loadCreatureReferenceData(true);}
async function deletePokemon(id=state.selectedPokemonId){
  const p=pokemon(id); if(!p)return;
  if(!(await styledConfirm({title:'Delete Pokémon',message:`<p>Delete <strong>${esc(p.name)}</strong> (${esc(p.species)}) from this Trainer?</p><div class="dialog-warning">This removes the Pokémon from every Roster and Storage. Any Held Item is returned to the Backpack.</div>`,confirmLabel:'Continue',danger:true})))return;
  if(!(await styledConfirm({title:'Permanent deletion',message:`<p>This permanently removes <strong>${esc(p.name)}</strong> from the active profile.</p><p class="muted">Recovery is only possible through a previous save revision.</p>`,confirmLabel:`Delete ${p.name}`,danger:true})))return;
  returnHeldItemToBackpack(p);
  state.pokemon=state.pokemon.filter(x=>x.id!==p.id);
  trainer().history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Pokémon deleted',detail:`${p.name} (${p.species}) was permanently removed from the Trainer profile.`});
  state.selectedPokemonId=state.pokemon[0]?.id||null; creatureReferenceState={pokemonId:null,loading:false,error:null,data:null}; state.ui.screen=state.pokemon.length?'creature':'dashboard'; commit(`${p.name} deleted.`);
}


function pokemonFormCurrentState(p){
  const raw=p?.details?.formState||{};
  return {baseFormId:raw.baseFormId||'base',activeFormId:raw.activeFormId||null};
}
function pokemonFormOptionCard(form,{current=false,action='',actionLabel='Apply',tone='btn-primary'}={}){
  const requirements=pokemonFormRequirementText(form?.requirements);
  return `<article class="ability-card"><div class="row-between"><div><h3>${esc(form?.name||'Canonical Base')}</h3>${form?.mode?chip(form.mode==='permanent'?'PERMANENT':'TRANSFORMATION',form.mode==='permanent'?'chip-purple':'chip-gold'):chip('CANONICAL BASE','chip-blue')}${current?chip('CURRENT','chip-green'):''}</div></div><p><strong>Requirements:</strong> ${esc(requirements)}</p>${form?.notes?`<p class="muted">${esc(form.notes)}</p>`:''}${action?`<button class="btn ${tone} btn-small" onclick="${action}">${esc(actionLabel)}</button>`:''}</article>`;
}
let pokemonFormsUiCache={pokemonId:null,forms:[]};
async function openPokemonFormsManager(){
  const p=pokemon(); if(!p?.details?.speciesDefinitionId)return toast('This Pokémon is not linked to a Species definition.','error');
  if(creatureReferenceState.pokemonId!==p.id||!creatureReferenceState.data)await loadCreatureReferenceData(true);
  const data=creatureReferenceState.pokemonId===p.id?creatureReferenceState.data:null;
  let formPayload=null;
  try{
    const response=await fetch('/api/pokemon/forms/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:p,gmOverride:!!state.ui.gmOverride,rulesetId:catalogState.status?.activeRulesetId})});
    formPayload=await response.json().catch(()=>null);
  }catch{}
  const forms=Array.isArray(formPayload?.baseSpecies?.forms)?formPayload.baseSpecies.forms:(Array.isArray(data?.species?.forms)?data.species.forms:[]);
  if(!forms.length)return toast(creatureReferenceState.error||formPayload?.error||'This Species has no alternate Forms in the active Ruleset.','error');
  pokemonFormsUiCache={pokemonId:p.id,forms};
  const stateForm=pokemonFormCurrentState(p); const permanent=forms.filter(form=>form.mode==='permanent'); const transformations=forms.filter(form=>form.mode==='transformation');
  const permanentCards=[pokemonFormOptionCard(null,{current:stateForm.baseFormId==='base',action:stateForm.baseFormId==='base'?'':"setPokemonPermanentForm('base')",actionLabel:'Use Canonical Base'})].concat(permanent.map(form=>pokemonFormOptionCard(form,{current:stateForm.baseFormId===form.id,action:stateForm.baseFormId===form.id?'':`setPokemonPermanentForm('${esc(form.id)}')`,actionLabel:'Use as Permanent Form'}))).join('');
  const transformationCards=transformations.map(form=>pokemonFormOptionCard(form,{current:stateForm.activeFormId===form.id,action:`togglePokemonTransformation('${esc(form.id)}')`,actionLabel:stateForm.activeFormId===form.id?'Deactivate Transformation':'Activate Transformation',tone:stateForm.activeFormId===form.id?'btn-ghost':'btn-gold'})).join('')||'<p class="muted">No temporary transformation Forms are defined.</p>';
  const resolution=formPayload?.formState?formPayload:data?.formResolution; const applied=resolution?.applied||[]; const warnings=resolution?.warnings||[]; const errors=resolution?.errors||[];
  modal(`<div class="flow-note"><strong>Current resolution:</strong> ${applied.length?applied.map(form=>esc(form.name)).join(' → '):'Canonical Base'}.</div>${errors.length?`<div class="builder-validation bad"><strong>Current Form needs attention</strong><ul>${errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul><small>You can use the choices below to recover to a valid Form state.</small></div>`:''}${warnings.length?`<div class="builder-validation bad"><strong>Form warnings</strong><ul>${warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:''}<h3>Permanent / Base Form</h3><div class="ability-card-grid">${permanentCards}</div><h3>Temporary Transformation</h3><div class="ability-card-grid">${transformationCards}</div>${pokemonFormLifecycleControls(forms,stateForm,p)}<div class="flow-note"><strong>Persistence:</strong> the permanent Form and active transformation are stored on this individual Pokémon. Transformation state can be cleared without changing the permanent Form.</div>`,{title:`Pokémon Forms · ${p.name}`,subtitle:'Resolved from the active Campaign Ruleset'});
}
async function applyPokemonFormState(nextState,form=null,{manualOverride=false}={}){
  const p=pokemon(); if(!p)return;
  const approvals=new Set(p.details?.manualFormApprovals||[]); const manual=pokemonFormManualRequirements(form?.requirements,[]); if(manualOverride)manual.forEach(req=>approvals.add(req.key)); const missing=manual.filter(req=>!approvals.has(req.key));
  if(missing.length){
    const ok=await styledConfirm({title:'Confirm Form Requirement',message:`<p>This Form has manual condition${missing.length===1?'':'s'}:</p><ul>${missing.map(req=>`<li>${esc(req.label)}</li>`).join('')}</ul><p>Confirm that the condition is currently satisfied.</p>`,confirmLabel:'Confirm & Apply',tone:'gold'});
    if(!ok){openPokemonFormsManager();return;}
    missing.forEach(req=>approvals.add(req.key));
  }
  try{
    const response=await fetch('/api/pokemon/forms/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:p,formState:nextState,manualFormApprovals:[...approvals],gmOverride:!!state.ui.gmOverride,rulesetId:catalogState.status?.activeRulesetId})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.valid){
      const errors=payload.errors||payload.formResolution?.errors||[payload.error||'This Form cannot be applied.'];
      modal(`<div class="builder-validation bad"><strong>Form requirements are not satisfied.</strong><ul>${errors.map(error=>`<li>${esc(error)}</li>`).join('')}</ul></div><div class="flow-note"><strong>GM Override:</strong> ${state.ui.gmOverride?'enabled — unmet requirements may be accepted with an explicit warning.':'disabled — enable it only if the GM intends to bypass the requirement.'}</div>`,{title:'Pokémon Form not applied',tone:'red'}); return;
    }
    p.details ||= {}; p.details.formState={...payload.formState}; p.details.manualFormApprovals=[...approvals];
    const connectionResponse=await fetch('/api/pokemon/training-action-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'revalidate_connections',pokemon:p,rulesetId:catalogState.status?.activeRulesetId})}); const connectionPayload=await connectionResponse.json();
    if(connectionResponse.ok&&connectionPayload.valid){p.details=connectionPayload.details;if(connectionPayload.resultRecord?.refundedTutorPoints)toast(`Advanced Connection removed; ${connectionPayload.resultRecord.refundedTutorPoints} Tutor Point(s) refunded.`,'info');}
    if(Array.isArray(payload.species?.types))p.types=payload.species.types.map(type=>String(type).toLowerCase());
    if(payload.species?.name)p.species=payload.species.name;
    closeModal(); invalidateCreatureReference(); await commit(`${p.name} Form updated.`); await loadCreatureReferenceData(true);
  }catch(error){toast(error.message,'error');}
}
async function setPokemonPermanentForm(formId){
  const p=pokemon(); if(!p)return; const data=creatureReferenceState.pokemonId===p.id?creatureReferenceState.data:null;
  const forms=pokemonFormsUiCache.pokemonId===p.id?pokemonFormsUiCache.forms:(data?.species?.forms||[]); const form=formId==='base'?null:forms.find(x=>x.id===formId&&x.mode==='permanent');
  if(formId!=='base'&&!form)return toast('Permanent Form is not available in the active Ruleset.','error');
  const current=pokemonFormCurrentState(p); await applyPokemonFormState({baseFormId:formId||'base',activeFormId:current.activeFormId},form);
}
async function togglePokemonTransformation(formId){
  const p=pokemon(); if(!p)return; const data=creatureReferenceState.pokemonId===p.id?creatureReferenceState.data:null; const current=pokemonFormCurrentState(p);
  if(current.activeFormId===formId)return applyPokemonFormState({baseFormId:current.baseFormId,activeFormId:null},null);
  const forms=pokemonFormsUiCache.pokemonId===p.id?pokemonFormsUiCache.forms:(data?.species?.forms||[]); const form=forms.find(x=>x.id===formId&&x.mode==='transformation');
  if(!form)return toast('Transformation Form is not available in the active Ruleset.','error');
  await applyPokemonFormState({baseFormId:current.baseFormId,activeFormId:formId},form);
}
async function toggleAegislashStanceManually(){
  const p=pokemon();if(!p)return;
  const current=pokemonFormCurrentState(p),formId='sword-stance';
  let forms=pokemonFormsUiCache.pokemonId===p.id?pokemonFormsUiCache.forms:[];
  if(!forms.length){try{const response=await fetch('/api/pokemon/forms/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:p,gmOverride:!!state.ui.gmOverride,rulesetId:catalogState.status?.activeRulesetId})});const payload=await response.json();forms=payload?.baseSpecies?.forms||[];}catch(error){return toast(error.message||'Could not load Aegislash Forms.','error');}}
  const form=forms.find(row=>row.id===formId&&row.mode==='transformation');if(!form)return toast('Aegislash Sword Stance is not available in the active Ruleset.','error');
  pokemonFormsUiCache={pokemonId:p.id,forms};if(current.activeFormId===formId)return applyPokemonFormState({baseFormId:current.baseFormId,activeFormId:null},null);
  await applyPokemonFormState({baseFormId:current.baseFormId,activeFormId:formId},form,{manualOverride:true});
}
function pokemonFormSummaryBlock(p,data){
  const forms=Array.isArray(data?.species?.forms)?data.species.forms:[]; const isShiny=!!p?.details?.isShiny; const isAegislash=formEventSlug(p?.species).includes('aegislash')||formEventSlug(p?.details?.speciesDefinitionId).includes('aegislash'); if(!forms.length&&!isShiny&&!isAegislash)return '';
  const current=pokemonFormCurrentState(p); const base=forms.find(form=>form.id===current.baseFormId); const active=forms.find(form=>form.id===current.activeFormId); const warnings=data?.formResolution?.warnings||[]; const presentation=data?.formResolution?.presentation||data?.presentation||null;
  const resolvedTypes=(data?.species?.types||p.types||[]).map(type=>typeBadge(String(type).toLowerCase())).join(' ');
  const appearance=isShiny?(presentation?.artwork?.hasDedicatedShinyArtwork?'Shiny artwork':'Shiny state · normal artwork fallback'):'Normal';
  const stanceActive=current.activeFormId==='sword-stance';const stanceButton=isAegislash?`<button class="btn ${stanceActive?'btn-ghost':'btn-gold'} btn-small" onclick="toggleAegislashStanceManually()">${stanceActive?'Return to Shield Stance':'Switch to Sword Stance'}</button><small>Manual control · no combat or action cost required.</small>`:'';
  return section('POKÉMON FORM & APPEARANCE',`<dl class="detail-dl"><div><dt>Permanent Form</dt><dd>${esc(base?.name||'Canonical Base')}</dd></div><div><dt>Active Transformation</dt><dd>${esc(active?.name||(current.activeFormId==='sword-stance'?'Sword Stance':'None'))}</dd></div><div><dt>Shiny</dt><dd>${isShiny?'Yes':'No'}${isShiny?' '+chip('★ SHINY','chip-gold'):''}</dd></div><div><dt>Artwork</dt><dd>${esc(appearance)}</dd></div><div><dt>Resolved Types</dt><dd>${resolvedTypes||'—'}</dd></div></dl>${warnings.length?`<div class="builder-validation bad"><ul>${warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:'<p class="muted">Form mechanics and Shiny presentation are independent layers. Missing dedicated Shiny artwork falls back to the best normal artwork without clearing Shiny state.</p>'}${stanceButton}`,forms.length?`<button class="btn btn-gold btn-small" onclick="openPokemonFormsManager()">Manage Forms</button>`:'');
}

function pokemonFormCombatPresentation(p,data){
  if(!p?.details?.speciesDefinitionId)return null;
  const forms=Array.isArray(data?.species?.forms)?data.species.forms:[];const current=pokemonFormCurrentState(p);const label=pokemonFormStateLabel(current,forms);
  const recent=(trainer()?.history||[]).slice().reverse().find(entry=>entry?.title==='Pokémon Form changed'&&String(entry?.detail||'').startsWith(`${p.name}:`))||null;
  return {current,label,recent,forms};
}
function pokemonFormCombatIndicator(p,data){
  const model=pokemonFormCombatPresentation(p,data);if(!model)return '';
  const tone=model.current.activeFormId?'chip-purple':'chip-blue';const recent=model.recent?`<small>Latest transition: ${esc(model.recent.detail)}</small>`:'<small>No automatic Form transition recorded yet.</small>';
  return `<div class="flow-note form-combat-indicator"><div class="row-between"><strong>Current Form</strong>${chip(esc(model.label),tone)}</div>${recent}</div>`;
}

let pokemonCombatReferenceState={pokemonId:null,loading:false,error:null,data:null};
function pokemonCombatDefaultUi(){return {version:1,active:false,rosterId:null,activePokemonId:null,participantIds:[],participants:{},log:[]};}
function normalizePokemonCombatUiState(value){
  const base=pokemonCombatDefaultUi(),src=value&&typeof value==='object'?value:{};const out={...base,...src};
  out.version=1;out.active=!!out.active;out.rosterId=out.rosterId||null;out.activePokemonId=out.activePokemonId||null;
  out.participantIds=Array.isArray(out.participantIds)?[...new Set(out.participantIds.map(String).filter(Boolean))]:[];
  out.participants=out.participants&&typeof out.participants==='object'?out.participants:{};out.log=Array.isArray(out.log)?out.log.slice(-120):[];
  return out;
}
function ensurePokemonCombatUi(){state.ui ||= {};state.ui.combat=normalizePokemonCombatUiState(state.ui.combat);const c=state.ui.combat;if(!c.rosterId)c.rosterId=state.selectedRosterId||state.rosters?.find(r=>r.active!==false)?.id||state.rosters?.[0]?.id||null;return c;}
function pokemonCombatParticipant(id,{create=true}={}){
  const c=ensurePokemonCombatUi(),key=String(id||'');if(!key)return null;let row=c.participants[key];
  if(!row&&create){row={pokemonId:key,joinedAt:new Date().toISOString(),turn:{round:0,used:{standard:false,shift:false,swift:false},conversions:[]},frequency:{sceneNumber:Number(state.ui.scene||1),dayNumber:Number(state.ui.day||1),scene:{},day:{},eot:{}},conditions:{curledUp:false},moveState:{rollout:{active:false,hits:0,nextDb:3,lastDb:null,lastResult:null}},extended:{},log:[]};c.participants[key]=row;}
  if(!row)return null;row.turn ||= {round:0,used:{standard:false,shift:false,swift:false},conversions:[]};row.turn.used ||= {standard:false,shift:false,swift:false};row.turn.conversions ||= [];
  row.frequency ||= {sceneNumber:Number(state.ui.scene||1),dayNumber:Number(state.ui.day||1),scene:{},day:{},eot:{}};row.frequency.scene ||= {};row.frequency.day ||= {};row.frequency.eot ||= {};
  row.conditions ||= {curledUp:false};row.moveState ||= {};row.moveState.rollout ||= {active:false,hits:0,nextDb:3,lastDb:null,lastResult:null};row.extended ||= {};row.log=Array.isArray(row.log)?row.log:[];return row;
}
function pokemonCombatSyncBoundaries(row){if(!row)return;const f=row.frequency||(row.frequency={});const scene=Number(state.ui.scene||1),day=Number(state.ui.day||1);if(Number(f.sceneNumber)!==scene){f.sceneNumber=scene;f.scene={};}if(Number(f.dayNumber)!==day){f.dayNumber=day;f.day={};f.sceneNumber=scene;f.scene={};}f.eot ||= {};}
function pokemonCombatTurn(id,{reset=false}={}){const row=pokemonCombatParticipant(id);if(!row)return null;const round=Number(state.ui.round||1);if(reset||Number(row.turn.round)!==round){row.turn={round,used:{standard:false,shift:false,swift:false},conversions:[],bonus:{standard:0},bonusUsed:{standard:0}};}row.turn.used ||= {standard:false,shift:false,swift:false};row.turn.conversions ||= [];row.turn.bonus ||= {standard:0};row.turn.bonusUsed ||= {standard:0};return row.turn;}
function pokemonCombatLog(id,title,detail,kind='event'){
  const c=ensurePokemonCombatUi(),entry={id:uid('combat'),at:new Date().toISOString(),round:Number(state.ui.round||1),scene:Number(state.ui.scene||1),day:Number(state.ui.day||1),pokemonId:id||null,title,detail,kind};c.log.push(entry);c.log=c.log.slice(-120);const row=id?pokemonCombatParticipant(id,{create:false}):null;if(row){row.log.push(entry);row.log=row.log.slice(-60);}return entry;
}
function pokemonCombatStageValue(value,stage){const cs=Math.max(-6,Math.min(6,Math.trunc(Number(stage)||0))),multiplier=Number((cs>=0?1+cs*.2:1+cs*.1).toFixed(1));return Math.floor((Number(value)||0)*multiplier);}
function pokemonCombatSlug(value){return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
function pokemonCombatParseFrequency(text){const raw=String(text||'At-Will').trim();if(!raw||/^at-will$/i.test(raw))return {kind:'at-will',limit:null,label:raw||'At-Will'};let m=raw.match(/\bScene(?:\s*x\s*(\d+))?/i);if(m)return {kind:'scene',limit:Number(m[1]||1),label:raw};m=raw.match(/\bDaily(?:\s*x\s*(\d+))?/i);if(m)return {kind:'daily',limit:Number(m[1]||1),label:raw};if(/\bEOT\b/i.test(raw))return {kind:'eot',limit:1,label:raw};return {kind:'informational',limit:null,label:raw};}
function pokemonCombatActionCostForMove(def={}){const text=String(def.range||'');if(/\bFull Action\b/i.test(text))return 'Full Action';if(/\bSwift Action\b/i.test(text))return 'Swift Action';if(/\bShift Action\b/i.test(text))return 'Shift Action';if(/\bFree Action\b/i.test(text))return 'Free Action';return 'Standard Action';}
function pokemonCombatStandardRemaining(turn){if(!turn)return 0;const base=turn.used?.standard?0:1,bonus=Math.max(0,Number(turn.bonus?.standard||0)),bonusUsed=Math.max(0,Number(turn.bonusUsed?.standard||0));return Math.max(0,base+bonus-bonusUsed);}
function pokemonCombatSpendStandardToken(turn){if(!turn)return {valid:false,reason:'No combat turn is available.'};turn.used ||= {standard:false,shift:false,swift:false};turn.bonus ||= {standard:0};turn.bonusUsed ||= {standard:0};if(!turn.used.standard){turn.used.standard=true;return {valid:true,spent:'Standard Action',token:'base-standard'};}if(Number(turn.bonusUsed.standard||0)<Number(turn.bonus.standard||0)){turn.bonusUsed.standard=Number(turn.bonusUsed.standard||0)+1;return {valid:true,spent:'Bonus Standard Action',token:'bonus-standard'};}return {valid:false,reason:'Standard Action already spent this turn.'};}
function pokemonCombatCanSpendAction(id,cost){const turn=pokemonCombatTurn(id);if(!turn)return {valid:false,reason:'No combat turn is available.'};const used=turn.used||{},standardRemaining=pokemonCombatStandardRemaining(turn);if(cost==='Free Action')return {valid:true};if(cost==='Full Action')return !used.standard&&!used.shift?{valid:true}:{valid:false,reason:'Full Action needs the base Standard and Shift Actions available.'};if(cost==='Standard Action')return standardRemaining>0?{valid:true}:{valid:false,reason:'Standard Action already spent this turn.'};if(cost==='Swift Action')return !used.swift||standardRemaining>0?{valid:true}:{valid:false,reason:'Swift Action already spent and no Standard Action is available for conversion.'};if(cost==='Shift Action')return !used.shift||standardRemaining>0?{valid:true}:{valid:false,reason:'Shift Action already spent and no Standard Action is available for conversion.'};return {valid:true,informational:true};}
function pokemonCombatSpendAction(id,cost){const check=pokemonCombatCanSpendAction(id,cost);if(!check.valid)return check;const turn=pokemonCombatTurn(id),used=turn.used;if(cost==='Free Action')return {valid:true,spent:'Free Action'};if(cost==='Full Action'){used.standard=true;used.shift=true;return {valid:true,spent:'Full Action'};}if(cost==='Standard Action')return pokemonCombatSpendStandardToken(turn);if(cost==='Swift Action'){if(!used.swift){used.swift=true;return {valid:true,spent:'Swift Action'};}const standard=pokemonCombatSpendStandardToken(turn);if(!standard.valid)return standard;const conversion=standard.token==='bonus-standard'?'Bonus Standard → Swift':'Standard → Swift';turn.conversions.push(conversion);return {valid:true,spent:standard.token==='bonus-standard'?'Bonus Standard Action → Swift Action':'Standard Action → Swift Action'};}if(cost==='Shift Action'){if(!used.shift){used.shift=true;return {valid:true,spent:'Shift Action'};}const standard=pokemonCombatSpendStandardToken(turn);if(!standard.valid)return standard;const conversion=standard.token==='bonus-standard'?'Bonus Standard → Shift':'Standard → Shift';turn.conversions.push(conversion);return {valid:true,spent:standard.token==='bonus-standard'?'Bonus Standard Action → Shift Action':'Standard Action → Shift Action'};}return {valid:true,spent:null,informational:true};}
function pokemonCombatFrequencyKey(row){return pokemonCombatSlug(row?.definition?.id||row?.record?.id||row?.definition?.name||row?.record?.name||'move');}
function pokemonCombatFrequencyAvailability(id,key,frequency){const row=pokemonCombatParticipant(id);if(!row)return {valid:false,reason:'Combatant is not in the session.'};pokemonCombatSyncBoundaries(row);const parsed=pokemonCombatParseFrequency(frequency);if(parsed.kind==='at-will'||parsed.kind==='informational')return {valid:true,parsed};if(parsed.kind==='scene'){const used=Number(row.frequency.scene[key]||0);return used<parsed.limit?{valid:true,parsed,used}:{valid:false,parsed,used,reason:`${parsed.label} exhausted for this Scene.`};}if(parsed.kind==='daily'){const used=Number(row.frequency.day[key]||0);return used<parsed.limit?{valid:true,parsed,used}:{valid:false,parsed,used,reason:`${parsed.label} exhausted for this Day.`};}if(parsed.kind==='eot'){const last=Number(row.frequency.eot[key]||0);const round=Number(state.ui.round||1);return !last||round-last>=2?{valid:true,parsed,last}:{valid:false,parsed,last,reason:'EOT Move is not available on the immediately following turn.'};}return {valid:true,parsed};}
function pokemonCombatSpendFrequency(id,key,frequency){const check=pokemonCombatFrequencyAvailability(id,key,frequency);if(!check.valid)return check;const row=pokemonCombatParticipant(id),parsed=check.parsed;if(parsed.kind==='scene')row.frequency.scene[key]=Number(row.frequency.scene[key]||0)+1;else if(parsed.kind==='daily')row.frequency.day[key]=Number(row.frequency.day[key]||0)+1;else if(parsed.kind==='eot')row.frequency.eot[key]=Number(state.ui.round||1);return {...check,spent:parsed.kind};}
const POKEMON_COMBAT_TRACKED_ACTION_COSTS=new Set(['Full Action','Standard Action','Shift Action','Swift Action','Free Action']);
function pokemonCombatNonMoveSpec(sourceKind,sourceKey,label,actionCost=null,frequency='At-Will'){
  return {sourceKind:String(sourceKind||'source'),sourceKey:String(sourceKey||label||'source'),label:String(label||sourceKey||sourceKind||'Source'),actionCost:actionCost?String(actionCost):null,frequency:String(frequency||'At-Will')};
}
function pokemonCombatAbilityResourceSpec(name){
  const slug=pokemonCombatSlug(name);
  if(slug==='schooling')return pokemonCombatNonMoveSpec('ability','schooling','Schooling','Free Action','Daily');
  if(slug==='power-construct')return pokemonCombatNonMoveSpec('ability','power-construct','Power Construct','Swift Action','Daily');
  return null;
}
function pokemonCombatFormActionResourceSpec(actionId){
  const slug=pokemonCombatSlug(actionId);
  if(slug==='stance-change-full-action')return pokemonCombatNonMoveSpec('form','stance-change-full-action','Stance Change','Full Action','At-Will');
  if(slug==='ice-face-hail-restore')return pokemonCombatNonMoveSpec('ability','ice-face-hail-restore','Ice Face · Hail restore','Standard Action','At-Will');
  if(slug==='weapon-bond-relinquish')return pokemonCombatNonMoveSpec('capability','weapon-bond-relinquish','Weapon Bond · relinquish','Extended Action','At-Will');
  return null;
}
function pokemonCombatCapabilityResourceSpec(capability,mode='activate'){
  if(pokemonCombatSlug(capability)==='weapon-bond')return pokemonCombatNonMoveSpec('capability',mode==='relinquish'?'weapon-bond-relinquish':'weapon-bond','Weapon Bond','Extended Action','At-Will');
  return null;
}
function pokemonCombatNonMoveResourceKey(spec={}){return `nonmove:${pokemonCombatSlug(spec.sourceKind||'source')}:${pokemonCombatSlug(spec.sourceKey||spec.label||'source')}`;}
function pokemonCombatNonMoveAvailability(id,spec={}){
  const normalized=pokemonCombatNonMoveSpec(spec.sourceKind,spec.sourceKey,spec.label,spec.actionCost,spec.frequency),parsed=pokemonCombatParseFrequency(normalized.frequency),trackedAction=POKEMON_COMBAT_TRACKED_ACTION_COSTS.has(normalized.actionCost),trackedFrequency=['scene','daily','eot'].includes(parsed.kind),needsLedger=trackedAction||trackedFrequency,row=pokemonCombatParticipant(id,{create:false});
  if(needsLedger&&!row)return {valid:false,spec:normalized,reason:'Put this Pokémon in Combat before spending its action or Scene/Daily resource.'};
  const action=trackedAction?pokemonCombatCanSpendAction(id,normalized.actionCost):{valid:true,informational:!!normalized.actionCost};if(!action.valid)return {...action,spec:normalized};
  const key=pokemonCombatNonMoveResourceKey(normalized),frequency=trackedFrequency?pokemonCombatFrequencyAvailability(id,key,normalized.frequency):{valid:true,parsed};if(!frequency.valid)return {...frequency,spec:normalized,key};
  return {valid:true,spec:normalized,key,parsed,trackedAction,trackedFrequency,needsLedger,action,frequency};
}
function pokemonCombatActionDelta(before={},after={}){
  const beforeUsed=before.used||{},afterUsed=after.used||{},tokens=['standard','shift','swift'].filter(key=>!beforeUsed[key]&&!!afterUsed[key]),beforeConversions=Array.isArray(before.conversions)?before.conversions:[],afterConversions=Array.isArray(after.conversions)?after.conversions:[],beforeBonusUsed=Number(before.bonusUsed?.standard||0),afterBonusUsed=Number(after.bonusUsed?.standard||0);
  return {tokens,conversions:afterConversions.slice(beforeConversions.length),bonusStandardUsed:Math.max(0,afterBonusUsed-beforeBonusUsed)};
}
function pokemonCombatFrequencyValue(row,key,kind){if(kind==='scene')return Number(row?.frequency?.scene?.[key]||0);if(kind==='daily')return Number(row?.frequency?.day?.[key]||0);if(kind==='eot')return Number(row?.frequency?.eot?.[key]||0);return 0;}
function pokemonCombatRefundActionDelta(id,delta={}){
  const turn=pokemonCombatTurn(id);if(!turn)return false;let changed=false;for(const token of (delta.tokens||[])){if(turn.used?.[token]){turn.used[token]=false;changed=true;}}const bonusUsed=Math.max(0,Number(delta.bonusStandardUsed||0));if(bonusUsed){turn.bonusUsed ||= {standard:0};turn.bonusUsed.standard=Math.max(0,Number(turn.bonusUsed.standard||0)-bonusUsed);changed=true;}
  for(const conversion of (delta.conversions||[])){const index=turn.conversions?.lastIndexOf(conversion)??-1;if(index>=0){turn.conversions.splice(index,1);changed=true;}}return changed;
}
function pokemonCombatSpendNonMoveResource(id,spec={},options={}){
  const check=pokemonCombatNonMoveAvailability(id,spec);if(!check.valid)return check;if(!check.needsLedger)return {...check,tracked:false,transaction:null,spentLabel:check.spec.actionCost||check.spec.frequency||'Informational'};
  const row=pokemonCombatParticipant(id,{create:false});row.resourceTransactions=Array.isArray(row.resourceTransactions)?row.resourceTransactions:[];row.resourceSequence=Number(row.resourceSequence||0);const turn=pokemonCombatTurn(id),beforeTurn={round:turn.round,used:{...turn.used},conversions:[...(turn.conversions||[])],bonus:{...(turn.bonus||{})},bonusUsed:{...(turn.bonusUsed||{})}},frequencyBefore=pokemonCombatFrequencyValue(row,check.key,check.parsed.kind);
  const action=check.trackedAction?pokemonCombatSpendAction(id,check.spec.actionCost):{valid:true,spent:null};if(!action.valid)return action;const frequency=check.trackedFrequency?pokemonCombatSpendFrequency(id,check.key,check.spec.frequency):{valid:true,spent:null,parsed:check.parsed};if(!frequency.valid){pokemonCombatRefundActionDelta(id,pokemonCombatActionDelta(beforeTurn,pokemonCombatTurn(id)));return frequency;}
  const afterTurn=pokemonCombatTurn(id),actionDelta=pokemonCombatActionDelta(beforeTurn,afterTurn),frequencyAfter=pokemonCombatFrequencyValue(row,check.key,check.parsed.kind),transaction={id:`resource-${++row.resourceSequence}`,sourceKind:check.spec.sourceKind,sourceKey:check.spec.sourceKey,key:check.key,label:check.spec.label,actionCost:check.spec.actionCost,frequency:check.spec.frequency,frequencyKind:check.parsed.kind,actionSpent:action.spent||null,actionDelta,frequencyBefore,frequencyAfter,round:Number(state.ui.round||1),scene:Number(state.ui.scene||1),day:Number(state.ui.day||1),refunded:false};row.resourceTransactions.push(transaction);row.resourceTransactions=row.resourceTransactions.slice(-24);
  if(options.log!==false)pokemonCombatLog(id,'Resource spent',`${check.spec.label} · ${action.spent||check.spec.actionCost||'no turn action'}${check.trackedFrequency?` · ${check.spec.frequency}`:''}.`,'resource');return {...check,tracked:true,transaction,action,frequency,spentLabel:[action.spent,check.trackedFrequency?check.spec.frequency:null].filter(Boolean).join(' · ')};
}
function pokemonCombatRefundNonMoveResourceCore(id,transactionId,options={}){
  const row=pokemonCombatParticipant(id,{create:false});if(!row)return {valid:false,reason:'Combatant is not in the session.'};row.resourceTransactions=Array.isArray(row.resourceTransactions)?row.resourceTransactions:[];const tx=row.resourceTransactions.find(item=>item.id===transactionId);if(!tx)return {valid:false,reason:'Resource transaction was not found.'};if(tx.refunded)return {valid:false,reason:'This resource spend was already refunded.'};pokemonCombatSyncBoundaries(row);let changed=false;
  if(Number(tx.round)===Number(state.ui.round||1))changed=pokemonCombatRefundActionDelta(id,tx.actionDelta)||changed;
  if(tx.frequencyKind==='scene'&&Number(tx.scene)===Number(state.ui.scene||1)){const current=Number(row.frequency.scene[tx.key]||0);if(current>0){row.frequency.scene[tx.key]=Math.max(0,current-1);changed=true;}}
  if(tx.frequencyKind==='daily'&&Number(tx.day)===Number(state.ui.day||1)){const current=Number(row.frequency.day[tx.key]||0);if(current>0){row.frequency.day[tx.key]=Math.max(0,current-1);changed=true;}}
  if(tx.frequencyKind==='eot'&&Number(row.frequency.eot[tx.key]||0)===Number(tx.frequencyAfter||0)){if(Number(tx.frequencyBefore||0)>0)row.frequency.eot[tx.key]=Number(tx.frequencyBefore);else delete row.frequency.eot[tx.key];changed=true;}
  tx.refunded=true;tx.refundedRound=Number(state.ui.round||1);tx.refundedScene=Number(state.ui.scene||1);tx.refundedDay=Number(state.ui.day||1);if(options.log!==false)pokemonCombatLog(id,'Resource refunded',`${tx.label} action/frequency spend was corrected.${changed?'':' Its boundary had already reset.'}`,'resource');return {valid:true,changed,transaction:tx};
}
async function pokemonCombatRefundNonMoveResource(id,transactionId){const p=pokemon(id),result=pokemonCombatRefundNonMoveResourceCore(id,transactionId);if(!result.valid)return toast(result.reason,'error');await commit(`${p?.name||'Pokémon'} resource spend corrected.`);render();toast(result.changed?'Resource spend refunded.':'Resource spend was already reset by a combat boundary.');return result;}
function pokemonCombatNonMoveTransactionRefundable(tx={}){if(tx.refunded)return false;if((tx.actionDelta?.tokens||[]).length&&Number(tx.round)===Number(state.ui.round||1))return true;if(tx.frequencyKind==='scene'&&Number(tx.scene)===Number(state.ui.scene||1))return true;if(tx.frequencyKind==='daily'&&Number(tx.day)===Number(state.ui.day||1))return true;if(tx.frequencyKind==='eot'&&Number(tx.round)<=Number(state.ui.round||1))return true;return false;}
function pokemonCombatNonMoveResourcePanel(id){const row=pokemonCombatParticipant(id,{create:false}),items=(row?.resourceTransactions||[]).slice().reverse().filter(pokemonCombatNonMoveTransactionRefundable).slice(0,4);if(!items.length)return '';return `<div class="flow-note"><strong>Recent Ability/Form resource spends</strong><small>Use Undo only to correct a mistaken activation. Scene/Day boundaries still reset resources normally.</small><div class="row-gap">${items.map(tx=>`<button class="btn btn-ghost btn-small" onclick="pokemonCombatRefundNonMoveResource('${id}','${tx.id}')">Undo ${esc(tx.label)} · ${esc([tx.actionSpent,tx.frequencyKind==='scene'||tx.frequencyKind==='daily'?tx.frequency:null].filter(Boolean).join(' · ')||'resource')}</button>`).join('')}</div></div>`;}
async function pokemonCombatApplyNonMoveFormEvent(id,event,spec,{message=null}={}){
  const p=pokemon(id);if(!p)return null;let spend=null;if(spec){const availability=pokemonCombatNonMoveAvailability(id,spec);if(!availability.valid){toast(availability.reason,'error');return {valid:false,errors:[availability.reason]};}spend=pokemonCombatSpendNonMoveResource(id,spec,{log:false});if(!spend.valid){toast(spend.reason||'Resource could not be spent.','error');return {valid:false,errors:[spend.reason||'Resource could not be spent.']};}}
  const payload=await applyPokemonFormGameEventUi(id,event,{silent:false,commitAfter:false});const meaningful=!!payload?.valid&&(!!payload.changed||(payload.effects||[]).length>0||(payload.appliedRules||[]).length>0);if(!meaningful){if(spend?.transaction)pokemonCombatRefundNonMoveResourceCore(id,spend.transaction.id,{log:false});if(payload?.valid)toast('No source lifecycle change was triggered; action/frequency was not spent.');return payload;}
  if(spend?.transaction)pokemonCombatLog(id,'Resource spent',`${spend.spec.label} · ${spend.action?.spent||spend.spec.actionCost||'no turn action'}${spend.trackedFrequency?` · ${spend.spec.frequency}`:''}.`,'resource');await commit(message||`${p.name} source action applied.`);render();return payload;
}
const POKEMON_COMBAT_ABILITY_ACTION_ALLOWLIST=Object.freeze({
  'dodge':{label:'Dodge',actionCost:'Free Action',frequency:'Daily',trigger:'The user is hit by a Damaging Move',effectKind:'abstract-miss',source:'Pokemon Tabletop United 1.05 Core p.316'},
  'parry':{label:'Parry',actionCost:'Free Action',frequency:'Scene',trigger:'The user is hit by a Melee Attack',effectKind:'abstract-miss',source:'Pokemon Tabletop United 1.05 Core p.325'},
  'effect-spore':{label:'Effect Spore',actionCost:'Free Action',frequency:'Scene',trigger:'The user is hit by a Melee Attack',effectKind:'abstract-status-roll',requiresPhysicalD6:true,source:'Pokemon Tabletop United 1.05 Core p.316'},
  'stalwart':{label:'Stalwart',actionCost:'Free Action',frequency:'Scene',trigger:'The user receives Massive Damage',effectKind:'self-stages',stageChanges:{attack:1,spAttack:1,defense:1,spDefense:1},source:'New Abilities and Moves p.3'},
});
function pokemonCombatAbilityActionSpec(rowOrName){
  const name=typeof rowOrName==='string'?rowOrName:rowOrName?.name||rowOrName?.definition?.name||'';const slug=pokemonCombatSlug(name),base=POKEMON_COMBAT_ABILITY_ACTION_ALLOWLIST[slug];if(!base)return null;
  return {...base,slug,resource:pokemonCombatNonMoveSpec('ability',`combat-${slug}`,base.label,base.actionCost,base.frequency)};
}
function pokemonCombatAbilityActionSourceMatches(row,spec=pokemonCombatAbilityActionSpec(row)){
  if(!row||!spec)return false;const effect=String(row.definition?.effect||'').toLowerCase().replace(/[^a-z0-9+]+/g,' ');
  if(spec.slug==='dodge')return effect.includes('triggering move instead misses');
  if(spec.slug==='parry')return effect.includes('attack instead misses');
  if(spec.slug==='effect-spore')return effect.includes('roll 1d6')&&effect.includes('poison')&&effect.includes('paraly')&&effect.includes('sleep');
  if(spec.slug==='stalwart')return effect.includes('attack')&&effect.includes('special attack')&&effect.includes('defense')&&effect.includes('special defense')&&(effect.includes('increase by 1 cs')||effect.includes('increase by 1 combat stage'));
  return false;
}
function pokemonCombatEffectSporeStatus(physicalD6){const roll=Number(physicalD6);if(!Number.isInteger(roll)||roll<1||roll>6)return null;if(roll<=2)return 'Poisoned';if(roll<=4)return 'Paralyzed';return 'Asleep';}
function pokemonCombatAbilityActionAvailability(id,row){
  const spec=pokemonCombatAbilityActionSpec(row);if(!spec)return {valid:false,reason:'This Ability has no source-explicit Combat automation.',spec:null};if(!pokemonCombatAbilityActionSourceMatches(row,spec))return {valid:false,reason:'The active Ruleset definition differs from the audited source signature; use it manually.',spec};
  const resource=pokemonCombatNonMoveAvailability(id,spec.resource);return {...resource,spec};
}
function pokemonCombatAbilityActionCard(id,row,index){
  const spec=pokemonCombatAbilityActionSpec(row);if(!spec)return '';const available=pokemonCombatAbilityActionAvailability(id,row),def=row.definition||{},roll=spec.requiresPhysicalD6?chip('physical d6','chip-gold'):'';
  return `<article class="ability-card"><div class="row-between"><div><h3>${esc(spec.label)}</h3><div class="row-gap">${chip(esc(spec.frequency),available.valid?'chip-green':'chip-red')}${chip(esc(spec.actionCost),'chip-blue')}${roll}</div></div>${chip('SOURCE-EXPLICIT','chip-purple')}</div><p>${esc(def.effect||'No resolved effect text available.')}</p><small>Trigger: ${esc(spec.trigger)} · ${esc(spec.source)}</small>${available.valid?'':`<div class="builder-validation bad">${esc(available.reason||'Unavailable')}</div>`}<button class="btn ${available.valid?'btn-primary':'btn-disabled'} full" ${available.valid?'':'disabled'} onclick="pokemonCombatOpenAbilityAction('${id}',${Number(index)})">Use ${esc(spec.label)}</button></article>`;
}
function pokemonCombatAbilityActionPanel(id,data){
  const cards=(data?.abilities||[]).map((row,index)=>pokemonCombatAbilityActionCard(id,row,index)).filter(Boolean);return cards.length?`<div class="ability-card-grid">${cards.join('')}</div><div class="flow-note"><small>Only audited source-explicit Abilities appear here. Triggers are confirmed manually; opponent state remains abstract and all random rolls remain physical.</small></div>`:'<p class="muted">No audited source-explicit Combat Ability actions are available for this Pokémon.</p>';
}
async function pokemonCombatOpenAbilityAction(id,index){
  const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,row=(data?.abilities||[])[Number(index)],p=pokemon(id);if(!row||!p)return toast('Ability reference data is unavailable.','error');const available=pokemonCombatAbilityActionAvailability(id,row);if(!available.valid)return toast(available.reason,'error');const spec=available.spec;
  const rollField=spec.requiresPhysicalD6?`<label>Effect roll · physical d6<input id="combat-ability-physical-d6" type="number" min="1" max="6" step="1" placeholder="required"></label>`:'';
  modal(`<div class="flow-note"><strong>${esc(spec.label)}</strong><small>${esc(spec.frequency)} · ${esc(spec.actionCost)} · ${esc(spec.trigger)}</small></div><div class="form-grid"><label>Did the source trigger occur?<select id="combat-ability-trigger-confirm"><option value="">Choose…</option><option value="yes">Yes</option><option value="no">No</option></select></label>${rollField}</div><div class="flow-note"><small>${spec.effectKind==='abstract-miss'?'The triggering attack will be recorded as missing; no opponent entity is created.':spec.effectKind==='abstract-status-roll'?'Roll the d6 physically. The resulting status is logged against the abstract attacker only.':'Only the controlled Pokémon state is changed.'}</small></div><button class="btn btn-primary full" onclick="pokemonCombatResolveAbilityAction('${id}',${Number(index)})">Apply ${esc(spec.label)}</button>`,{title:`Combat Ability · ${spec.label}`,subtitle:'Source-explicit Ability action · physical dice only.'});
}
async function pokemonCombatResolveAbilityAction(id,index){
  const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,row=(data?.abilities||[])[Number(index)],p=pokemon(id);if(!row||!p)return toast('Ability reference data is unavailable.','error');const available=pokemonCombatAbilityActionAvailability(id,row);if(!available.valid)return toast(available.reason,'error');const spec=available.spec,trigger=String(document.getElementById('combat-ability-trigger-confirm')?.value||'');if(trigger!=='yes')return toast('Confirm that the Ability trigger occurred before spending its resource.','error');
  const rawD6=document.getElementById('combat-ability-physical-d6')?.value,physicalD6=rawD6===''||rawD6==null?null:Number(rawD6);if(spec.requiresPhysicalD6&&pokemonCombatEffectSporeStatus(physicalD6)==null)return toast('Enter the physical d6 result from 1 to 6.','error');
  const spend=pokemonCombatSpendNonMoveResource(id,spec.resource,{log:false});if(!spend.valid)return toast(spend.reason||'Ability resource could not be spent.','error');let outcome='';
  if(spec.effectKind==='self-stages'){pokemonCombatApplyCombatStages(id,spec.stageChanges,spec.label);outcome='Attack, Special Attack, Defense and Special Defense +1 CS';}
  else if(spec.effectKind==='abstract-miss'){outcome='triggering attack treated as a miss';pokemonCombatLog(id,'Defensive Ability',`${p.name} used ${spec.label}; ${outcome}.`,'ability');}
  else if(spec.effectKind==='abstract-status-roll'){const status=pokemonCombatEffectSporeStatus(physicalD6);outcome=`physical d6 ${physicalD6} · abstract attacker ${status}`;pokemonCombatLog(id,'Ability effect roll',`${p.name} used Effect Spore · ${outcome}. No opponent state was persisted.`,'ability');}
  if(spend.transaction)pokemonCombatLog(id,'Resource spent',`${spec.label} · ${spend.action?.spent||spec.actionCost}${spend.trackedFrequency?` · ${spec.frequency}`:''}.`,'resource');const detail=`${p.name} used ${spec.label} · ${outcome} · ${spend.spentLabel||spec.actionCost}`;closeModal();await commit(detail);render();toast(`${spec.label} recorded.`,'success');return {valid:true,spec,outcome,physicalD6,transaction:spend.transaction||null};
}
function pokemonCombatSprintManeuverResourceSpec(){return pokemonCombatNonMoveSpec('maneuver','sprint','Sprint Maneuver','Standard Action','At-Will');}
function pokemonCombatSprintAbilityResourceSpec(){return pokemonCombatNonMoveSpec('ability','combat-sprint','Sprint Ability','Swift Action','Scene');}
function pokemonCombatSprintAbilityRow(data){return (data?.abilities||[]).find(row=>pokemonCombatSlug(row?.name||row?.definition?.name)==='sprint')||null;}
function pokemonCombatSprintAbilitySourceMatches(row){
  if(!row||pokemonCombatSlug(row?.name||row?.definition?.name)!=='sprint')return false;const effect=String(row.definition?.effect||'').toLowerCase().replace(/[^a-z0-9+]+/g,' ');return effect.includes('2 speed combat stages')&&effect.includes('overland speed')&&effect.includes('increased by +2');
}
function pokemonCombatSprintCompositeAvailability(id,data,{withAbility=false}={}){
  const maneuver=pokemonCombatSprintManeuverResourceSpec(),maneuverCheck=pokemonCombatNonMoveAvailability(id,maneuver);if(!maneuverCheck.valid)return {...maneuverCheck,maneuver,withAbility};if(!withAbility)return {valid:true,maneuver,maneuverCheck,withAbility:false};
  const abilityRow=pokemonCombatSprintAbilityRow(data);if(!abilityRow)return {valid:false,maneuver,withAbility:true,reason:'This Pokémon does not have the Sprint Ability.'};if(!pokemonCombatSprintAbilitySourceMatches(abilityRow))return {valid:false,maneuver,withAbility:true,abilityRow,reason:'The active Sprint Ability definition differs from the audited PTU source; use the Maneuver without automated Ability spending.'};
  const turn=pokemonCombatTurn(id);if(!turn)return {valid:false,maneuver,withAbility:true,abilityRow,reason:'No combat turn is available.'};if(turn.used?.swift)return {valid:false,maneuver,withAbility:true,abilityRow,reason:'Swift Action already spent. The Standard Action is reserved for the Sprint Maneuver and cannot also convert into this Swift Action.'};
  const ability=pokemonCombatSprintAbilityResourceSpec(),key=pokemonCombatNonMoveResourceKey(ability),frequency=pokemonCombatFrequencyAvailability(id,key,ability.frequency);if(!frequency.valid)return {...frequency,maneuver,ability,abilityRow,key,withAbility:true};return {valid:true,maneuver,ability,abilityRow,key,frequency,maneuverCheck,withAbility:true};
}
function pokemonCombatSprintSpendResources(id,data,{withAbility=false,log=true}={}){
  const check=pokemonCombatSprintCompositeAvailability(id,data,{withAbility});if(!check.valid)return check;const maneuverSpend=pokemonCombatSpendNonMoveResource(id,check.maneuver,{log:false});if(!maneuverSpend.valid)return maneuverSpend;if(!withAbility){if(log)pokemonCombatLog(id,'Resource spent','Sprint Maneuver · Standard Action.','resource');return {...check,maneuverSpend,transactions:[maneuverSpend.transaction].filter(Boolean)};}
  const abilitySpend=pokemonCombatSpendNonMoveResource(id,check.ability,{log:false});if(!abilitySpend.valid){if(maneuverSpend.transaction)pokemonCombatRefundNonMoveResourceCore(id,maneuverSpend.transaction.id,{log:false});return abilitySpend;}const participant=pokemonCombatParticipant(id,{create:false}),compositeId=`sprint-composite-${Number(participant?.resourceSequence||0)}`;if(maneuverSpend.transaction){maneuverSpend.transaction.compositeId=compositeId;maneuverSpend.transaction.compositeRole='maneuver';}if(abilitySpend.transaction){abilitySpend.transaction.compositeId=compositeId;abilitySpend.transaction.compositeRole='ability';}
  if(log)pokemonCombatLog(id,'Resources spent','Sprint Maneuver · Standard Action · Sprint Ability · Swift Action · Scene.','resource');return {...check,maneuverSpend,abilitySpend,compositeId,transactions:[maneuverSpend.transaction,abilitySpend.transaction].filter(Boolean)};
}
async function pokemonCombatUseSprintManeuver(id,useAbility=false){
  const p=pokemon(id),data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null;if(!p||!data)return toast('Sprint reference data is unavailable.','error');const spent=pokemonCombatSprintSpendResources(id,data,{withAbility:!!useAbility,log:true});if(!spent.valid)return toast(spent.reason||'Sprint resources are unavailable.','error');pokemonCombatLog(id,'Sprint Maneuver',`${p.name} used Sprint · Movement Speeds +50% for the rest of this turn.${useAbility?' Sprint Ability activated.':''}`,'maneuver');if(useAbility)pokemonCombatApplyCombatStages(id,{speed:2},'Sprint Ability');const detail=`${p.name} used Sprint Maneuver · Standard Action${useAbility?' · Sprint Ability · Scene · Swift Action · Speed +2 CS':''}`;await commit(detail);render();toast(useAbility?'Sprint Maneuver + Ability recorded.':'Sprint Maneuver recorded.','success');return {valid:true,withAbility:!!useAbility,spent};
}
function pokemonCombatSprintManeuverPanel(id,data){
  const abilityRow=pokemonCombatSprintAbilityRow(data),maneuver=pokemonCombatSprintCompositeAvailability(id,data,{withAbility:false}),combined=abilityRow?pokemonCombatSprintCompositeAvailability(id,data,{withAbility:true}):null;const button=(label,available,onclick,tone='btn-primary')=>`<button class="btn ${available.valid?tone:'btn-disabled'} full" ${available.valid?'':`disabled title="${esc(available.reason||'Unavailable')}"`} onclick="${onclick}">${label}</button>`;let ability='';
  if(abilityRow){const sourceOk=pokemonCombatSprintAbilitySourceMatches(abilityRow);ability=`<div class="flow-note"><strong>Sprint Ability</strong><small>${sourceOk?'Scene · Swift Action · when this Pokémon uses Sprint. Activate together to gain +2 Speed Combat Stages.':'The active Ruleset Sprint definition differs from the audited source; automated Ability activation is disabled.'}</small>${button('Sprint + Ability · Standard + Swift · Scene',combined||{valid:false,reason:'Unavailable'},`pokemonCombatUseSprintManeuver('${id}',true)`,'btn-gold')}</div>`;}
  return `<div class="ability-card-grid"><article class="ability-card"><div class="row-between"><div><h3>Sprint Maneuver</h3><div class="row-gap">${chip('Standard Action',maneuver.valid?'chip-blue':'chip-red')}${chip('Self','chip-green')}</div></div>${chip('CORE MANEUVER','chip-purple')}</div><p>Increase Movement Speeds by 50% for the rest of this turn.</p><small>PTU Core p.242 · transient movement effect is logged, not invented as a persistent capability mutation.</small>${button('Use Sprint · Standard Action',maneuver,`pokemonCombatUseSprintManeuver('${id}',false)`)}</article></div>${ability}<div class="flow-note"><small>The Sprint Ability passive +2 Overland Speed remains source information; this Combat layer automates only the triggered +2 Speed Combat Stages.</small></div>`;
}
function pokemonCombatViciousAbilityResourceSpec(){return pokemonCombatNonMoveSpec('ability','combat-vicious','Vicious',null,'Scene');}
function pokemonCombatViciousAbilityRow(data){return pokemonCombatResolveDefinition(data?.abilities,'Vicious');}
function pokemonCombatViciousHoneClawsRow(data){return pokemonCombatResolveDefinition(data?.moves,'Hone Claws');}
function pokemonCombatViciousAbilitySourceMatches(row){
  if(!row||pokemonCombatSlug(row?.name||row?.definition?.name)!=='vicious')return false;const frequency=String(row.definition?.frequency||row.record?.frequency||row.frequency||'');if(frequency&&!/\bScene\b/i.test(frequency))return false;const effect=String(row.definition?.effect||'').toLowerCase().replace(/[^a-z0-9+]+/g,' ');return effect.includes('connection hone claws')&&effect.includes('another standard action this round')&&effect.includes('critical hit range')&&effect.includes('remainder of the encounter');
}
function pokemonCombatViciousHoneClawsSourceMatches(row){
  if(!row||pokemonCombatSlug(row?.definition?.name||row?.record?.name)!=='hone-claws')return false;const def=row.definition||row.record||{},frequency=String(def.frequency||'');if(frequency&&!/^at-will$/i.test(frequency.trim()))return false;const range=String(def.range||'');if(range&&!/\bself\b/i.test(range))return false;const effect=String(def.effect||'').toLowerCase().replace(/[^a-z0-9+]+/g,' ');return effect.includes('accuracy is raised by +1')&&effect.includes('attack combat stage');
}
function pokemonCombatViciousRecordMoveUse(id,moveRow){
  const ledger=pokemonCombatParticipant(id,{create:false});if(!ledger)return;ledger.triggerWindows ||= {};const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,abilityRow=pokemonCombatViciousAbilityRow(data),name=moveRow?.definition?.name||moveRow?.record?.name||'';
  if(pokemonCombatSlug(name)==='hone-claws'&&pokemonCombatViciousAbilitySourceMatches(abilityRow)&&pokemonCombatViciousHoneClawsSourceMatches(moveRow)){ledger.triggerWindows.vicious={round:Number(state.ui.round||1),scene:Number(state.ui.scene||1),day:Number(state.ui.day||1),move:'Hone Claws'};return ledger.triggerWindows.vicious;}
  delete ledger.triggerWindows.vicious;return null;
}
function pokemonCombatViciousAvailability(id,data,choice='extra-standard'){
  const abilityRow=pokemonCombatViciousAbilityRow(data),moveRow=pokemonCombatViciousHoneClawsRow(data);if(!abilityRow)return {valid:false,reason:'This Pokémon does not have Vicious.'};if(!moveRow)return {valid:false,abilityRow,reason:'Hone Claws is not available in this Pokémon Move list.'};if(!pokemonCombatViciousAbilitySourceMatches(abilityRow))return {valid:false,abilityRow,moveRow,reason:'The active Vicious definition differs from the audited PTU source.'};if(!pokemonCombatViciousHoneClawsSourceMatches(moveRow))return {valid:false,abilityRow,moveRow,reason:'The active Hone Claws definition differs from the audited PTU source.'};const ledger=pokemonCombatParticipant(id,{create:false});if(!ledger)return {valid:false,abilityRow,moveRow,reason:'Put this Pokémon in Combat first.'};const pending=ledger.triggerWindows?.vicious,round=Number(state.ui.round||1),scene=Number(state.ui.scene||1),day=Number(state.ui.day||1);if(!pending||Number(pending.round)!==round||Number(pending.scene)!==scene||Number(pending.day)!==day)return {valid:false,abilityRow,moveRow,reason:'Use Hone Claws this round to open the Vicious trigger.'};if(Number(ledger.viciousActivation?.scene||-1)===scene)return {valid:false,abilityRow,moveRow,reason:'Vicious has already been activated this Scene.'};if(choice==='critical-range'&&Number(ledger.conditions?.viciousCriticalRangeBonus||0)>0)return {valid:false,abilityRow,moveRow,reason:'Vicious Critical Hit Range +2 is already active for this combat encounter.'};if(!['extra-standard','critical-range'].includes(choice))return {valid:false,abilityRow,moveRow,reason:'Unknown Vicious choice.'};const resource=pokemonCombatViciousAbilityResourceSpec(),resourceCheck=pokemonCombatNonMoveAvailability(id,resource);if(!resourceCheck.valid)return {...resourceCheck,abilityRow,moveRow,resource,pending};return {valid:true,abilityRow,moveRow,resource,resourceCheck,pending,choice};
}
async function pokemonCombatUseVicious(id,choice){
  const p=pokemon(id),data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null;if(!p||!data)return toast('Vicious reference data is unavailable.','error');const check=pokemonCombatViciousAvailability(id,data,choice);if(!check.valid)return toast(check.reason||'Vicious is unavailable.','error');const spent=pokemonCombatSpendNonMoveResource(id,check.resource,{log:false});if(!spent.valid)return toast(spent.reason||'Vicious resource is unavailable.','error');const ledger=pokemonCombatParticipant(id,{create:false}),turn=pokemonCombatTurn(id);ledger.viciousActivation={scene:Number(state.ui.scene||1),round:Number(state.ui.round||1),choice,transactionId:spent.transaction?.id||null};delete ledger.triggerWindows.vicious;
  let effectLabel='';if(choice==='extra-standard'){turn.bonus ||= {standard:0};turn.bonusUsed ||= {standard:0};turn.bonus.standard=Number(turn.bonus.standard||0)+1;effectLabel='another Standard Action this round';}else{ledger.conditions ||= {};ledger.conditions.viciousCriticalRangeBonus=2;effectLabel='Critical Hit Range +2 for the remainder of this combat encounter';}
  if(spent.transaction){spent.transaction.effectChoice=choice;spent.transaction.effectApplied=true;spent.transaction.triggerMove='Hone Claws';}
  pokemonCombatLog(id,'Vicious',`${p.name} activated Vicious after Hone Claws · Scene · Special · ${effectLabel}.`,'ability');await applyPokemonFormGameEventUi(id,{kind:'ability-used',ability:'Vicious'},{silent:true,commitAfter:false});await commit(`${p.name} activated Vicious · ${effectLabel}.`);render();toast(`Vicious: ${effectLabel}.`,'success');return {valid:true,spent,choice};
}
function pokemonCombatViciousPanel(id,data){
  const abilityRow=pokemonCombatViciousAbilityRow(data),moveRow=pokemonCombatViciousHoneClawsRow(data);if(!abilityRow||!moveRow||!pokemonCombatViciousAbilitySourceMatches(abilityRow)||!pokemonCombatViciousHoneClawsSourceMatches(moveRow))return '';const extra=pokemonCombatViciousAvailability(id,data,'extra-standard'),critical=pokemonCombatViciousAvailability(id,data,'critical-range'),ledger=pokemonCombatParticipant(id,{create:false}),pending=ledger?.triggerWindows?.vicious,critActive=Number(ledger?.conditions?.viciousCriticalRangeBonus||0)>0;const button=(label,available,choice)=>`<button class="btn ${available.valid?'btn-gold':'btn-disabled'} full" ${available.valid?'':`disabled title="${esc(available.reason||'Unavailable')}"`} onclick="pokemonCombatUseVicious('${id}','${choice}')">${label}</button>`;return `<article class="ability-card"><div class="row-between"><div><h3>Vicious + Hone Claws</h3><div class="row-gap">${chip('Scene','chip-green')}${chip('Special','chip-blue')}${chip('Connection · Hone Claws','chip-purple')}</div></div>${chip('SOURCE-EXPLICIT','chip-purple')}</div><p>After this Pokémon uses Hone Claws, activate Vicious and choose one Core effect.</p><small>PTU Core p.335 · choose another Standard Action this round, or Critical Hit Range +2 for the remainder of the encounter. The trigger window closes after another Move or the round boundary.</small>${critActive?`<div class="flow-note"><strong>Vicious critical range active</strong><small>Critical Hit Range +2 remains recorded until this Pokémon leaves the current Combat session.</small></div>`:''}${pending?'':`<div class="flow-note"><small>Use Hone Claws to open the Vicious trigger.</small></div>`}${button('Vicious · another Standard Action this round',extra,'extra-standard')}${button('Vicious · Critical Hit Range +2',critical,'critical-range')}</article>`;
}
const PTU_COMBAT_SOURCE_PRECEDENCE=[{"id":"ptu-core-1.05","rank":100,"label":"PTU 1.05 Core"},{"id":"ptu-1.05-editation","rank":110,"label":"PTU 1.05 Editation"},{"id":"ptu-may-2015-playtest","rank":120,"label":"PTU May 2015 Playtest Packet"},{"id":"ptu-september-2015-playtest","rank":130,"label":"PTU September 2015 Playtest Packet"},{"id":"ptu-february-2016-playtest","rank":140,"label":"February 2016 Playtest Packet"}];
const PTU_COMBAT_SOURCE_OVERRIDES={"quick-curl":{"sourceId":"ptu-february-2016-playtest","frequency":"Scene – Free Action","effect":"Connection – Defense Curl. The user may activate this Ability to use Defense Curl as a Standard Action Interrupt and gain +10 Damage Reduction for 1 full round."},"electrodash":{"sourceId":"ptu-february-2016-playtest","frequency":"Scene x2 – Swift Action","effect":"The user may make a Sprint Action as a Free Action.","bonus":"The user may free itself from the Stuck condition as a Shift Action. The user does not provoke Attacks of Opportunity when Sprinting."},"prime-fury":{"sourceId":"ptu-february-2016-playtest","frequency":"Scene – Swift Action","effect":"The user becomes Enraged, and gains +1 Combat Stage in each of Attack and Special Attack."},"hydration":{"sourceId":"ptu-february-2016-playtest","frequency":"Scene – Swift Action","effect":"The user is cured of one Status Affliction. Hydration’s Frequency is ignored if used during Rainy Weather."},"ice-body":{"sourceId":"ptu-february-2016-playtest","frequency":"Daily x5 – Swift Action","effect":"The user gains a Tick of Hit Points. Ice Body may only be used while the user is under 50% Hit Points or in Hailing Weather.","bonus":"The user is immune to Hit Point loss from Hail."}};
function pokemonCombatSourceKey(row){const d=row?.definition||row?.record||row||{};return String(row?.sourceId||row?.source_id||d.sourceId||d.source_id||row?.source||d.source||d.sourceTitle||d.source_title||'').toLowerCase();}
function pokemonCombatSourceRank(row){const key=pokemonCombatSourceKey(row);const found=PTU_COMBAT_SOURCE_PRECEDENCE.find(s=>key.includes(s.id)||key.includes(s.label.toLowerCase()));return found?.rank||100;}
function pokemonCombatSourceOverride(row){const name=pokemonCombatSlug(row?.name||row?.definition?.name||row?.record?.name),override=PTU_COMBAT_SOURCE_OVERRIDES[name],d=row?.definition||row?.record||{};return override?{...row,definition:{...d,...override}}:row;}
function pokemonCombatResolveDefinition(rows,name){const wanted=pokemonCombatSlug(name);const candidates=(rows||[]).filter(row=>pokemonCombatSlug(row?.name||row?.definition?.name||row?.record?.name)===wanted).map(pokemonCombatSourceOverride);return candidates.map((row,index)=>({row,rank:pokemonCombatSourceRank(row),index})).sort((a,b)=>b.rank-a.rank||b.index-a.index)[0]?.row||null;}
function pokemonCombatResolvedSource(row){const rank=pokemonCombatSourceRank(row);return PTU_COMBAT_SOURCE_PRECEDENCE.find(s=>s.rank===rank)||PTU_COMBAT_SOURCE_PRECEDENCE[0];}
function pokemonCombatElectrodashDefinition(rows){return pokemonCombatResolveDefinition(rows,'Electrodash');}

function pokemonCombatSourcePrecedencePanel(data){const rows=[['Quick Curl',pokemonCombatQuickCurlAbilityRow(data)],['Electrodash',pokemonCombatElectrodashDefinition(data?.abilities)],['Prime Fury',pokemonCombatResolveDefinition(data?.abilities,'Prime Fury')],['Hydration',pokemonCombatHydrationRow(data)],['Ice Body',pokemonCombatIceBodyRow(data)],['Vicious',pokemonCombatViciousAbilityRow(data)],['Hone Claws',pokemonCombatViciousHoneClawsRow(data)]].filter(([,row])=>row);if(!rows.length)return '';return `<details class="flow-note"><summary><strong>Resolved PTU sources</strong></summary><small>Core → 1.05 Editation → May 2015 → September 2015 → February 2016. Guards inspect the resolved winner.</small><div class="detail-dl">${rows.map(([name,row])=>{const source=pokemonCombatResolvedSource(row);return `<div><dt>${esc(name)}</dt><dd>${esc(source.label)}</dd></div>`;}).join('')}</div></details>`;}
function pokemonCombatElectrodashResourceSpec(){return pokemonCombatNonMoveSpec('ability','combat-electrodash','Electrodash','Swift Action','Scene x2');}
function pokemonCombatElectrodashAvailability(id,data){const row=pokemonCombatElectrodashDefinition(data?.abilities);if(!row)return {valid:false,reason:'This Pokémon does not have Electrodash.'};const effect=String(row.definition?.effect||'').toLowerCase();if(!effect.includes('sprint action as a free action'))return {valid:false,row,reason:'The resolved Electrodash definition is not the audited February 2016 version.'};const resource=pokemonCombatElectrodashResourceSpec(),check=pokemonCombatNonMoveAvailability(id,resource);return check.valid?{valid:true,row,resource}:{...check,row,resource};}
async function pokemonCombatUseElectrodashSprint(id){const p=pokemon(id),data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,check=pokemonCombatElectrodashAvailability(id,data);if(!check.valid)return toast(check.reason||'Electrodash is unavailable.','error');const spent=pokemonCombatSpendNonMoveResource(id,check.resource,{log:false});if(!spent.valid)return toast(spent.reason,'error');const ledger=pokemonCombatParticipant(id);ledger.conditions.electrodashSprintRound=Number(state.ui.round||1);pokemonCombatLog(id,'Electrodash',`${p.name} used Sprint as a Free Action · February 2016 Electrodash · ${spent.action?.spent||'Swift Action'} · Scene x2.`,'ability');await commit(`${p.name} used Electrodash + Sprint.`);render();return {valid:true,spent};}
function pokemonCombatElectrodashClearStuckAvailability(id,data){const row=pokemonCombatElectrodashDefinition(data?.abilities),ledger=pokemonCombatParticipant(id,{create:false});if(!row||!ledger?.conditions?.stuck)return {valid:false,row,reason:'This Pokémon is not Stuck.'};const bonus=String(row.definition?.bonus||'').toLowerCase();if(!bonus.includes('free itself from the stuck condition'))return {valid:false,row,reason:'The resolved Electrodash definition does not grant Stuck removal.'};return pokemonCombatCanSpendAction(id,'Shift Action');}
async function pokemonCombatUseElectrodashClearStuck(id){const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,check=pokemonCombatElectrodashClearStuckAvailability(id,data);if(!check.valid)return toast(check.reason||'Stuck removal is unavailable.','error');const spent=pokemonCombatSpendAction(id,'Shift Action'),ledger=pokemonCombatParticipant(id);ledger.conditions.stuck=false;pokemonCombatLog(id,'Electrodash',`${pokemon(id)?.name||id} cleared Stuck · ${spent.spent}.`,'ability');await commit(`${pokemon(id)?.name||'Pokémon'} cleared Stuck with Electrodash.`);render();return {valid:true,spent};}
function pokemonCombatSetStuck(id,stuck){const ledger=pokemonCombatParticipant(id);ledger.conditions.stuck=!!stuck;pokemonCombatLog(id,stuck?'Stuck':'Stuck cleared',`${pokemon(id)?.name||id} was marked ${stuck?'Stuck':'not Stuck'} manually.`,'condition');commit(`${pokemon(id)?.name||'Pokémon'} Stuck state updated.`);render();}
function pokemonCombatElectrodashPanel(id,data){const available=pokemonCombatElectrodashAvailability(id,data),clear=pokemonCombatElectrodashClearStuckAvailability(id,data);if(!available.row)return '';const button=(label,check,fn)=>`<button class="btn ${check.valid?'btn-gold':'btn-disabled'} full" ${check.valid?'':'disabled'} onclick="${fn}">${label}</button>`;return `<article class="ability-card"><h3>Electrodash + Sprint</h3><p>February 2016: Sprint is a Free Action; no Attacks of Opportunity while Sprinting.</p>${button('Use Electrodash + Sprint · Free + Swift · Scene x2',available,`pokemonCombatUseElectrodashSprint('${id}')`)}${button('Electrodash · clear Stuck · Shift Action',clear,`pokemonCombatUseElectrodashClearStuck('${id}')`)}</article>`;}
function pokemonCombatPrimeFuryResourceSpec(){return pokemonCombatNonMoveSpec('ability','combat-prime-fury','Prime Fury','Swift Action','Scene');}
function pokemonCombatPrimeFuryAvailability(id,data){const row=pokemonCombatResolveDefinition(data?.abilities,'Prime Fury');if(!row)return {valid:false,reason:'This Pokémon does not have Prime Fury.'};const effect=String(row.definition?.effect||'').toLowerCase();if(!effect.includes('becomes enraged')||!effect.includes('special attack'))return {valid:false,row,reason:'The resolved Prime Fury definition is not the audited February 2016 version.'};const resource=pokemonCombatPrimeFuryResourceSpec(),check=pokemonCombatNonMoveAvailability(id,resource);return check.valid?{valid:true,row,resource}:{...check,row,resource};}
async function pokemonCombatUsePrimeFury(id){const p=pokemon(id),data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,check=pokemonCombatPrimeFuryAvailability(id,data);if(!check.valid)return toast(check.reason||'Prime Fury is unavailable.','error');const spent=pokemonCombatSpendNonMoveResource(id,check.resource,{log:false});if(!spent.valid)return toast(spent.reason,'error');pokemonCombatApplySelfStatuses(id,['Enraged'],'Prime Fury');pokemonCombatApplyCombatStages(id,{attack:1,spAttack:1},'Prime Fury');pokemonCombatLog(id,'Prime Fury',`${p.name} became Enraged · Attack +1 CS · Special Attack +1 CS.`,'ability');await commit(`${p.name} used Prime Fury.`);render();return {valid:true,spent};}
function pokemonCombatPrimeFuryPanel(id,data){const available=pokemonCombatPrimeFuryAvailability(id,data),enraged=!!pokemonCombatParticipant(id,{create:false})?.conditions?.enraged;if(!available.row)return '';return `<article class="ability-card"><h3>Prime Fury</h3><p>February 2016: become Enraged; Attack and Special Attack each rise by +1 Combat Stage.</p>${enraged?'<div class="flow-note"><small>Enraged is active.</small></div>':''}<button class="btn ${available.valid?'btn-gold':'btn-disabled'} full" ${available.valid?'':'disabled'} onclick="pokemonCombatUsePrimeFury('${id}')">Use Prime Fury · Swift Action · Scene</button></article>`;}
function pokemonCombatHydrationRow(data){return pokemonCombatResolveDefinition(data?.abilities,'Hydration');}
function pokemonCombatIceBodyRow(data){return pokemonCombatResolveDefinition(data?.abilities,'Ice Body');}
function pokemonCombatSetWeather(value){state.ui.weather=['rain','hail'].includes(value)?value:'clear';commit(`Combat weather set to ${state.ui.weather}.`);render();}
function pokemonCombatSetStatusAffliction(id,status,active){const ledger=pokemonCombatParticipant(id),items=new Set(ledger.conditions.statusAfflictions||[]);active?items.add(status):items.delete(status);ledger.conditions.statusAfflictions=[...items];pokemonCombatLog(id,active?'Status Affliction marked':'Status Affliction cleared',`${status} ${active?'marked active':'cleared'} manually.`,'condition');commit(`${pokemon(id)?.name||'Pokémon'} Status Affliction updated.`);render();}
function pokemonCombatHydrationAvailability(id,data){const row=pokemonCombatHydrationRow(data),frequency=state.ui.weather==='rain'?'At-Will':'Scene',resource=pokemonCombatNonMoveSpec('ability','combat-hydration','Hydration','Swift Action',frequency),check=pokemonCombatNonMoveAvailability(id,resource),afflictions=pokemonCombatParticipant(id,{create:false})?.conditions?.statusAfflictions||[];if(!row)return {valid:false,reason:'This Pokémon does not have Hydration.'};const effect=String(row.definition?.effect||'').toLowerCase();if(!effect.includes('cured of one status affliction')||!effect.includes('rainy weather'))return {valid:false,row,reason:'Resolved Hydration differs from the audited February 2016 definition.'};return check.valid?{valid:true,row,resource,afflictions}:{...check,row,resource,afflictions};}
async function pokemonCombatUseHydration(id,status){const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,check=pokemonCombatHydrationAvailability(id,data);if(!check.valid)return toast(check.reason||'Hydration is unavailable.','error');if(!check.afflictions.includes(status))return toast('Select one currently marked Status Affliction to cure.','error');const spent=pokemonCombatSpendNonMoveResource(id,check.resource,{log:false});if(!spent.valid)return toast(spent.reason||'Hydration resource could not be spent.','error');pokemonCombatSetStatusAffliction(id,status,false);pokemonCombatLog(id,'Hydration',`${status} cured · Swift Action · ${state.ui.weather==='rain'?'Frequency ignored in Rainy Weather':'Scene'}.`,'ability');await commit(`${pokemon(id)?.name||'Pokémon'} used Hydration.`);render();return {valid:true,spent,status};}
function pokemonCombatIceBodyAvailability(id,data){const row=pokemonCombatIceBodyRow(data),p=pokemon(id),max=Number(p?.maxHp||p?.maxHP||p?.max_hp||0),hp=Number(p?.hp||0),weather=state.ui.weather,resource=pokemonCombatNonMoveSpec('ability','combat-ice-body','Ice Body','Swift Action','Daily x5'),check=pokemonCombatNonMoveAvailability(id,resource);if(!row)return {valid:false,reason:'This Pokémon does not have Ice Body.'};const effect=String(row.definition?.effect||'').toLowerCase(),bonus=String(row.definition?.bonus||'').toLowerCase();if(!effect.includes('tick of hit points')||!effect.includes('under 50% hit points')||!bonus.includes('immune to hit point loss from hail'))return {valid:false,row,reason:'Resolved Ice Body differs from the audited February 2016 definition.'};if(!(max>0)||!(hp*2<max||weather==='hail'))return {valid:false,row,resource,reason:'Ice Body can be used only below 50% HP or in Hailing Weather.'};return check.valid?{valid:true,row,resource,hp,max,tick:Math.max(1,Math.floor(max/10))}:{...check,row,resource,hp,max};}
async function pokemonCombatUseIceBody(id){const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,check=pokemonCombatIceBodyAvailability(id,data);if(!check.valid)return toast(check.reason||'Ice Body is unavailable.','error');const spent=pokemonCombatSpendNonMoveResource(id,check.resource,{log:false});if(!spent.valid)return toast(spent.reason||'Ice Body resource could not be spent.','error');const healing=await pokemonCombatApplyHpGain(id,check.tick,'Ice Body');pokemonCombatLog(id,'Ice Body',`${healing.applied} HP restored (one Tick: ${check.tick}) · Daily x5 · Swift Action.`,'ability');await commit(`${pokemon(id)?.name||'Pokémon'} used Ice Body.`);render();return {valid:true,spent,healing,tick:check.tick};}
function pokemonCombatHydrationIceBodyPanel(id,data){const hydration=pokemonCombatHydrationAvailability(id,data),ice=pokemonCombatIceBodyAvailability(id,data);if(!hydration.row&&!ice.row)return '';const known=['Paralyzed','Burned','Frozen','Poisoned','Badly Poisoned','Asleep'],marked=new Set(hydration.afflictions||[]),statuses=known.map(status=>`<label class="chip"><input type="checkbox" ${marked.has(status)?'checked':''} onchange="pokemonCombatSetStatusAffliction('${id}','${status}',this.checked)"> ${status}</label>`).join(' '),weather=String(state.ui.weather||'clear');return `<article class="ability-card"><h3>Combat Weather</h3><label>Current weather<select onchange="pokemonCombatSetWeather(this.value)"><option value="clear" ${weather==='clear'?'selected':''}>Clear / other</option><option value="rain" ${weather==='rain'?'selected':''}>Rainy</option><option value="hail" ${weather==='hail'?'selected':''}>Hail</option></select></label><small>Weather is a manually tracked session fact.</small></article>${hydration.row?`<article class="ability-card"><h3>Hydration</h3><p>February 2016: cure one Status Affliction · Scene – Swift Action; frequency is ignored during Rainy Weather.</p><div class="row-gap">${statuses}</div><button class="btn ${hydration.valid&&marked.size?'btn-gold':'btn-disabled'} full" ${hydration.valid&&marked.size?'':'disabled'} onclick="pokemonCombatUseHydration('${id}',${marked.size?JSON.stringify([...marked][0]):"''"})">Use Hydration · Swift Action · ${hydration.resource?.frequency||'Scene'}</button>${hydration.valid?'':`<small>${esc(hydration.reason||'Unavailable')}</small>`}</article>`:''}${ice.row?`<article class="ability-card"><h3>Ice Body</h3><p>February 2016: heal one Tick (${ice.tick||'1/10 max HP'}) · Daily x5 · Swift Action. May be used below 50% HP or during Hail; user is immune to HP loss from Hail.</p><button class="btn ${ice.valid?'btn-gold':'btn-disabled'} full" ${ice.valid?'':'disabled'} onclick="pokemonCombatUseIceBody('${id}')">Use Ice Body · Swift Action · Daily x5</button>${ice.valid?'':`<small>${esc(ice.reason||'Unavailable')}</small>`}</article>`:''}`;}
function pokemonCombatQuickCurlAbilityResourceSpec(){return pokemonCombatNonMoveSpec('ability','combat-quick-curl','Quick Curl','Free Action','Scene');}
function pokemonCombatQuickCurlDefenseResourceSpec(variant='core'){return pokemonCombatNonMoveSpec('move','defense-curl-quick-curl','Defense Curl via Quick Curl',variant==='february-2016'?'Standard Action':'Swift Action','At-Will');}
function pokemonCombatQuickCurlAbilityRow(data){return pokemonCombatResolveDefinition(data?.abilities,'Quick Curl');}
function pokemonCombatQuickCurlDefenseMoveRow(data){return pokemonCombatResolveDefinition(data?.moves,'Defense Curl');}
function pokemonCombatQuickCurlVariant(row){const effect=String(row?.definition?.effect||'').toLowerCase().replace(/[^a-z0-9+]+/g,' ');if(effect.includes('standard action interrupt')&&effect.includes('10 damage reduction'))return 'february-2016';if(effect.includes('use defense curl as a swift action'))return 'core';return null;}
function pokemonCombatQuickCurlAbilitySourceMatches(row){return pokemonCombatQuickCurlVariant(row)!==null;}
function pokemonCombatQuickCurlDefenseSourceMatches(row){if(!row||pokemonCombatSlug(row?.definition?.name||row?.record?.name)!=='defense-curl')return false;const frequency=String(row.definition?.frequency||row.record?.frequency||'At-Will');return !frequency||/^at-will$/i.test(frequency.trim());}
function pokemonCombatQuickCurlAvailability(id,data){const abilityRow=pokemonCombatQuickCurlAbilityRow(data),moveRow=pokemonCombatQuickCurlDefenseMoveRow(data),variant=pokemonCombatQuickCurlVariant(abilityRow);if(!abilityRow||!variant)return {valid:false,reason:'The resolved Quick Curl definition is not an audited supplied-source variant.'};if(!moveRow||!pokemonCombatQuickCurlDefenseSourceMatches(moveRow))return {valid:false,abilityRow,reason:'Defense Curl is not available from the active Ruleset.'};const ledger=pokemonCombatParticipant(id,{create:false});if(!ledger)return {valid:false,reason:'Put this Pokémon in Combat first.'};if(ledger.moveState?.rollout?.active)return {valid:false,reason:'Rollout is active; the user must continue Rollout.'};const ability=pokemonCombatQuickCurlAbilityResourceSpec(),abilityCheck=pokemonCombatNonMoveAvailability(id,ability),defense=pokemonCombatQuickCurlDefenseResourceSpec(variant),defenseCheck=pokemonCombatNonMoveAvailability(id,defense);return abilityCheck.valid&&defenseCheck.valid?{valid:true,abilityRow,moveRow,variant,ability,defense}:{valid:false,abilityRow,moveRow,variant,ability,defense,reason:abilityCheck.reason||defenseCheck.reason};}
function pokemonCombatQuickCurlSpendResources(id,data,{log=true}={}){const check=pokemonCombatQuickCurlAvailability(id,data);if(!check.valid)return check;const sequence=Number(pokemonCombatParticipant(id,{create:false})?.resourceSequence||0),compositeId=`quick-curl-composite-${sequence}`,abilitySpend=pokemonCombatSpendNonMoveResource(id,check.ability,{log:false});if(!abilitySpend.valid)return abilitySpend;const defenseSpend=pokemonCombatSpendNonMoveResource(id,check.defense,{log:false});if(!defenseSpend.valid){pokemonCombatRefundNonMoveResourceCore(id,abilitySpend.transaction?.id,{log:false});return defenseSpend;}for(const [transaction,role] of [[abilitySpend.transaction,'ability'],[defenseSpend.transaction,'move']])if(transaction){transaction.compositeId=compositeId;transaction.compositeRole=role;}if(log)pokemonCombatLog(id,'Resources spent',`Quick Curl · Scene Free · Defense Curl · ${defenseSpend.action?.spent||check.defense.actionCost}.`,'resource');return {...check,abilitySpend,defenseSpend,compositeId,transactions:[abilitySpend.transaction,defenseSpend.transaction].filter(Boolean)};}
async function pokemonCombatUseQuickCurlDefenseCurl(id){const p=pokemon(id),data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,spent=pokemonCombatQuickCurlSpendResources(id,data,{log:true});if(!spent.valid)return toast(spent.reason||'Quick Curl is unavailable.','error');const ledger=pokemonCombatParticipant(id),action=spent.defenseSpend.action?.spent||spent.defense.actionCost;ledger.conditions.curledUp=true;if(spent.variant==='february-2016')ledger.conditions.quickCurlDrRound=Number(state.ui.round||1);pokemonCombatLog(id,'Quick Curl',`${p.name} used resolved ${spent.variant==='february-2016'?'February 2016':'Core'} Quick Curl · ${action}.`,'ability');await pokemonCombatDispatchMoveFormEvent(id,spent.moveRow);await commit(`${p.name} used Quick Curl + Defense Curl.`);render();return {valid:true,spent};}
function pokemonCombatQuickCurlPanel(id,data){const available=pokemonCombatQuickCurlAvailability(id,data);if(!available.abilityRow)return '';const feb=available.variant==='february-2016',label=feb?'Defense Curl · Standard Interrupt + DR 10':'Defense Curl · Swift Action';return `<article class="ability-card"><h3>Quick Curl + Defense Curl</h3><p>${feb?'February 2016 override: use Defense Curl as a Standard Action Interrupt; +10 DR is tracked for this round.':'Core: use Defense Curl as a Swift Action.'}</p><button class="btn ${available.valid?'btn-gold':'btn-disabled'} full" ${available.valid?'':'disabled'} onclick="pokemonCombatUseQuickCurlDefenseCurl('${id}')">${label}</button></article>`;}
function pokemonCombatRolloutAfterResult(current={},hit=false,usedDb=3){if(!hit)return {active:false,hits:0,nextDb:3,lastDb:Number(usedDb||3),lastResult:'miss'};const hits=Number(current.hits||0)+1;return {active:true,hits,nextDb:Math.min(15,Number(usedDb||3)+4),lastDb:Number(usedDb||3),lastResult:'hit'};}
function pokemonCombatDefenseCurlModifier({curledUp=false,moveName='',knowsRollMove=false}={}){const rolling=['rollout','ice-ball'].includes(pokemonCombatSlug(moveName));return {accuracyPenalty:curledUp&&!rolling?-4:0,damageBonus:curledUp&&rolling?10:0,slowed:!!curledUp&&!knowsRollMove,criticalImmune:!!curledUp};}
function pokemonCombatMoveAvailability(id,row){const ledger=pokemonCombatParticipant(id);if(!ledger)return {valid:false,reason:'Add the Pokémon to Combat first.'};const name=pokemonCombatSlug(row?.definition?.name||row?.record?.name);if(ledger.moveState.rollout?.active&&name!=='rollout')return {valid:false,reason:'Rollout is active; the user must continue Rollout until it misses or has no valid target.'};const action=pokemonCombatActionCostForMove(row?.definition||{}),actionCheck=pokemonCombatCanSpendAction(id,action);if(!actionCheck.valid)return {...actionCheck,action};const frequency=row?.definition?.frequency||row?.record?.frequency||'At-Will';const key=pokemonCombatFrequencyKey(row),freqCheck=pokemonCombatFrequencyAvailability(id,key,frequency);if(!freqCheck.valid)return {...freqCheck,action,key,frequency};return {valid:true,action,key,frequency,frequencyParsed:freqCheck.parsed};}
function pokemonCombatRandomInt(){throw new Error('Digital dice are disabled in Combat. Roll physical dice and enter the result.');}
function pokemonCombatRollDiceExpression(){throw new Error('Digital damage rolling is disabled in Combat. Roll physical dice and enter the Damage Roll result.');}
function pokemonCombatDoubleDamageDiceExpression(expression){
  const raw=String(expression||'').replace(/\s+/g,'');if(!raw)return null;const m=raw.match(/^(\d+)d(\d+)([+-]\d+)?$/i);if(!m)return `${raw} twice`;
  const count=Number(m[1])*2,sides=Number(m[2]),flat=Number(m[3]||0)*2;return `${count}d${sides}${flat>0?`+${flat}`:flat<0?String(flat):''}`;
}
const POKEMON_COMBAT_DRAINING_MOVES=new Set(['absorb','drain-punch','draining-kiss','dream-eater','giga-drain','horn-leech','leech-life','mega-drain']);
function pokemonCombatOutcomeSpec(name){
  const slug=pokemonCombatSlug(name);
  if(POKEMON_COMBAT_DRAINING_MOVES.has(slug))return {kind:'drain-half',requiresTargetDamage:true};
  if(slug==='fury-cutter')return {kind:'fury-cutter',requiresTargetDamage:true};
  if(slug==='fell-stinger')return {kind:'fell-stinger',requiresTargetFainted:true};
  if(slug==='close-combat')return {kind:'close-combat'};
  if(slug==='leaf-storm')return {kind:'leaf-storm',requiresDamageDealt:true};
  if(slug==='petal-dance')return {kind:'petal-dance',requiresDamageDealt:true};
  if(slug==='charge-beam')return {kind:'charge-beam',requiresExtraD20:true};
  return {kind:'none'};
}
function pokemonCombatFuryCutterState(ledger){
  if(!ledger)return {active:false,hits:0,nextDb:4,lastDb:null,lastResult:null};
  ledger.moveState ||= {};ledger.moveState.furyCutter ||= {active:false,hits:0,nextDb:4,lastDb:null,lastResult:null};return ledger.moveState.furyCutter;
}
function pokemonCombatResetFuryCutter(ledger,result='broken'){
  if(!ledger)return null;const current=pokemonCombatFuryCutterState(ledger);ledger.moveState.furyCutter={active:false,hits:0,nextDb:4,lastDb:current.lastDb??null,lastResult:result};return ledger.moveState.furyCutter;
}
function pokemonCombatFuryCutterAfterResult(current={},outcome={}){
  const usedDb=Math.max(4,Number(outcome.usedDb||4));const hit=!!outcome.hit,damaged=Number(outcome.targetDamage||0)>0,sameTarget=outcome.sameTarget!==false;
  if(!hit)return {active:false,hits:0,nextDb:4,lastDb:usedDb,lastResult:'miss'};
  if(!damaged)return {active:false,hits:0,nextDb:4,lastDb:usedDb,lastResult:'no-damage'};
  const continuing=!!current.active&&sameTarget,hits=continuing?Number(current.hits||0)+1:1;return {active:true,hits,nextDb:Math.min(16,usedDb+4),lastDb:usedDb,lastResult:continuing?'continued-hit':'new-target-hit'};
}
function pokemonCombatOutcomeUiFields(spec,ledger){
  if(spec.kind==='fury-cutter'){
    const fury=pokemonCombatFuryCutterState(ledger),same=fury.active?`<label>Same target as current Fury Cutter chain?<select id="combat-same-target"><option value="">Choose…</option><option value="yes">Yes</option><option value="no">No · new abstract target</option></select></label>`:'';
    return `${same}<label>Damage actually taken by target<input id="combat-target-damage-dealt" type="number" min="0" step="1" placeholder="required on a hit"></label>`;
  }
  if(spec.requiresTargetDamage)return `<label>Damage actually taken by target<input id="combat-target-damage-dealt" type="number" min="0" step="1" placeholder="required on a hit"></label>`;
  if(spec.requiresTargetFainted)return `<label>Did this Move knock out the target?<select id="combat-target-fainted"><option value="">Choose…</option><option value="no">No</option><option value="yes">Yes</option></select></label>`;
  if(spec.requiresDamageDealt)return `<label>Did this Move deal damage?<select id="combat-damage-dealt"><option value="">Choose…</option><option value="yes">Yes</option><option value="no">No</option></select></label>`;
  if(spec.requiresExtraD20)return `<label>Effect roll · physical d20<input id="combat-extra-d20" type="number" min="1" max="20" step="1" placeholder="required on a hit"></label>`;
  return '';
}
async function pokemonCombatApplyHpGain(id,amount,source){
  const p=pokemon(id),requested=Math.max(0,Math.floor(Number(amount)||0));if(!p||requested<=0)return {requested,applied:0,before:Number(p?.hp||0),after:Number(p?.hp||0)};
  const before=Number(p.hp||0);await changeHp(id,requested);const after=Number(pokemon(id)?.hp||before),applied=Math.max(0,after-before);pokemonCombatLog(id,'HP gained',`${p.name} gained ${requested} HP from ${source}${applied!==requested?` · ${applied} restored to regular HP; remaining healing followed campaign HP/THP rules`:''}.`,'move-outcome');return {requested,applied,before,after};
}
function pokemonCombatApplyCombatStages(id,changes={},source='Move effect'){
  const p=pokemon(id);if(!p)return {changes:{}};p.combatStages ||= {};const labels={attack:'Attack',defense:'Defense',spAttack:'Special Attack',spDefense:'Special Defense',speed:'Speed',accuracy:'Accuracy',evasion:'Evasion'},applied={};
  for(const [key,deltaRaw] of Object.entries(changes||{})){const delta=Number(deltaRaw||0);if(!delta)continue;const before=Math.max(-6,Math.min(6,Number(p.combatStages[key]||0))),after=Math.max(-6,Math.min(6,before+delta));p.combatStages[key]=after;applied[key]={before,after,applied:after-before,label:labels[key]||key};}
  const parts=Object.values(applied).map(row=>`${row.label} ${row.before>=0?'+':''}${row.before} → ${row.after>=0?'+':''}${row.after}`);if(parts.length)pokemonCombatLog(id,'Combat Stages',`${p.name} · ${parts.join(' · ')} from ${source}.`,'move-outcome');return {changes:applied};
}
function pokemonCombatApplyAttackStages(id,amount,source){
  const result=pokemonCombatApplyCombatStages(id,{attack:Number(amount||0)},source),row=result.changes.attack||{before:0,after:0,applied:0};return {before:row.before,after:row.after,applied:row.applied};
}
function pokemonCombatApplySelfStatuses(id,statuses=[],source='Move effect'){
  const p=pokemon(id),ledger=pokemonCombatParticipant(id);if(!p||!ledger)return {statuses:[]};ledger.conditions ||= {};const applied=[];for(const raw of statuses){const key=pokemonCombatSlug(raw).replace(/-/g,'');if(!key)continue;ledger.conditions[key]=true;applied.push(String(raw));}if(applied.length)pokemonCombatLog(id,'Status applied',`${p.name} became ${applied.join(' and ')} from ${source}.`,'move-outcome');return {statuses:applied};
}
function pokemonCombatChargeBeamRaisesSpAttack(extraD20){const roll=Number(extraD20);return Number.isInteger(roll)&&roll>=7&&roll<=20;}
async function pokemonCombatApplyMoveOutcome(id,{name,hit,targetDamage=null,targetFainted=null,sameTarget=null,usedDb=null,damageDealt=null,extraD20=null}={}){
  const p=pokemon(id),ledger=pokemonCombatParticipant(id),slug=pokemonCombatSlug(name),spec=pokemonCombatOutcomeSpec(name),effects=[];if(!p||!ledger)return {effects};
  if(slug!=='fury-cutter'&&pokemonCombatFuryCutterState(ledger).active){pokemonCombatResetFuryCutter(ledger,'different-move');effects.push({kind:'fury-cutter-reset',reason:'different-move'});}
  if(spec.kind==='fury-cutter'){const current={...pokemonCombatFuryCutterState(ledger)},next=pokemonCombatFuryCutterAfterResult(current,{hit,targetDamage,sameTarget,usedDb});ledger.moveState.furyCutter=next;effects.push({kind:'fury-cutter',before:current,after:{...next}});}
  if(spec.kind==='drain-half'&&hit&&Number(targetDamage||0)>0){const heal=Math.floor(Number(targetDamage)/2),result=await pokemonCombatApplyHpGain(id,heal,name);effects.push({kind:'heal',amount:heal,result});}
  if(spec.kind==='fell-stinger'&&hit&&targetFainted===true){const result=pokemonCombatApplyAttackStages(id,2,'Fell Stinger');effects.push({kind:'attack-cs',amount:2,result});}
  if(spec.kind==='close-combat'&&hit){const result=pokemonCombatApplyCombatStages(id,{defense:-1,spDefense:-1},'Close Combat');effects.push({kind:'combat-stages',changes:{defense:-1,spDefense:-1},result});}
  if(spec.kind==='leaf-storm'&&hit&&damageDealt===true){const result=pokemonCombatApplyCombatStages(id,{spAttack:-2},'Leaf Storm');effects.push({kind:'combat-stages',changes:{spAttack:-2},result});}
  if(spec.kind==='petal-dance'&&hit&&damageDealt===true){const result=pokemonCombatApplySelfStatuses(id,['Enraged','Confused'],'Petal Dance');effects.push({kind:'self-status',statuses:['Enraged','Confused'],result});}
  if(spec.kind==='charge-beam'&&hit&&pokemonCombatChargeBeamRaisesSpAttack(extraD20)){const result=pokemonCombatApplyCombatStages(id,{spAttack:1},'Charge Beam');effects.push({kind:'combat-stages',changes:{spAttack:1},result,physicalEffectRoll:Number(extraD20)});}
  return {effects,spec};
}
function pokemonCombatKnowsRollMove(data){return (data?.moves||[]).some(row=>['rollout','ice-ball'].includes(pokemonCombatSlug(row?.definition?.name||row?.record?.name)));}
async function loadPokemonCombatReferenceData(id=ensurePokemonCombatUi().activePokemonId,force=false){const p=pokemon(id);if(!p?.details?.speciesDefinitionId){pokemonCombatReferenceState={pokemonId:id||null,loading:false,error:'This Pokémon is not linked to a PTU Species definition.',data:null};render();return;}if(!force&&pokemonCombatReferenceState.pokemonId===id&&pokemonCombatReferenceState.data)return;pokemonCombatReferenceState={pokemonId:id,loading:true,error:null,data:null};render();try{const response=await fetch('/api/pokemon/reference-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:p,rulesetId:catalogState.status?.activeRulesetId})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Unable to load combat reference data');pokemonCombatReferenceState={pokemonId:id,loading:false,error:null,data:payload};}catch(error){pokemonCombatReferenceState={pokemonId:id,loading:false,error:error.message,data:null};}render();}
function pokemonCombatSelectRoster(id){const c=ensurePokemonCombatUi();c.rosterId=id||null;state.selectedRosterId=id||state.selectedRosterId;persist();render();}
async function pokemonCombatAdd(id){const p=pokemon(id);if(!p||p.storage)return toast('Only a carried Pokémon can enter Combat.','error');const c=ensurePokemonCombatUi();const fresh=!c.participantIds.includes(p.id);if(fresh)c.participantIds.push(p.id);pokemonCombatParticipant(p.id);c.active=true;c.activePokemonId=p.id;state.ui.inCombat=true;if(fresh&&p.details?.speciesDefinitionId)await applyPokemonFormGameEventUi(p.id,{kind:'battle-start'},{silent:true,commitAfter:false});pokemonCombatTurn(p.id,{reset:true});pokemonCombatLog(p.id,'Entered Combat',`${p.name} joined the combat session.`,'session');await commit(`${p.name} entered Combat.`);await loadPokemonCombatReferenceData(p.id,true);}
async function pokemonCombatRemove(id){const p=pokemon(id),c=ensurePokemonCombatUi();if(!p)return;if(p.details?.speciesDefinitionId)await applyPokemonFormGameEventUi(p.id,{kind:'battle-end'},{silent:true,commitAfter:false});c.participantIds=c.participantIds.filter(x=>x!==p.id);delete c.participants[p.id];if(c.activePokemonId===p.id)c.activePokemonId=c.participantIds[0]||null;if(!c.participantIds.length){c.active=false;state.ui.inCombat=false;}pokemonCombatReferenceState={pokemonId:null,loading:false,error:null,data:null};pokemonCombatLog(p.id,'Left Combat',`${p.name} left the combat session.`,'session');commit(`${p.name} left Combat.`);if(c.activePokemonId)setTimeout(()=>loadPokemonCombatReferenceData(c.activePokemonId,true),0);}
async function pokemonCombatEndSession(){const c=ensurePokemonCombatUi();for(const id of [...c.participantIds]){const p=pokemon(id);if(p?.details?.speciesDefinitionId)await applyPokemonFormGameEventUi(id,{kind:'battle-end'},{silent:true,commitAfter:false});}pokemonCombatLog(null,'Combat ended',`Session ended in Round ${state.ui.round}.`,'session');c.active=false;c.activePokemonId=null;c.participantIds=[];c.participants={};state.ui.inCombat=false;pokemonCombatReferenceState={pokemonId:null,loading:false,error:null,data:null};commit('Combat session ended.');}
function pokemonCombatActivate(id){const c=ensurePokemonCombatUi();if(!c.participantIds.includes(id))return;c.activePokemonId=id;pokemonCombatTurn(id);persist();render();setTimeout(()=>loadPokemonCombatReferenceData(id,true),0);}
function pokemonCombatBeginTurn(id){const c=ensurePokemonCombatUi();if(!c.participantIds.includes(id))return;c.activePokemonId=id;const row=pokemonCombatParticipant(id),wasRound=Number(row.turn?.round||0);pokemonCombatTurn(id,{reset:wasRound!==Number(state.ui.round||1)});pokemonCombatLog(id,'Turn active',`${pokemon(id)?.name||id} is active in Round ${state.ui.round}.`,'turn');persist();render();}
function pokemonCombatOnRoundAdvance(){const c=state.ui?.combat;if(!c?.active)return;c.activePokemonId=null;pokemonCombatLog(null,'Round advanced',`Round ${state.ui.round} began.`,'boundary');}
function pokemonCombatOnSceneAdvance(){const c=state.ui?.combat;if(!c)return;for(const id of (c.participantIds||[])){const row=pokemonCombatParticipant(id);if(!row)continue;row.frequency.sceneNumber=Number(state.ui.scene||1);row.frequency.scene={};row.frequency.eot={};row.turn={round:0,used:{standard:false,shift:false,swift:false},conversions:[],bonus:{standard:0},bonusUsed:{standard:0}};row.triggerWindows={};row.viciousActivation=null;row.moveState.rollout={active:false,hits:0,nextDb:3,lastDb:null,lastResult:null};row.moveState.furyCutter={active:false,hits:0,nextDb:4,lastDb:null,lastResult:null};}if(c.active)pokemonCombatLog(null,'Scene advanced',`Scene ${state.ui.scene} began; Scene frequencies, Rollout and Fury Cutter chains reset.`,'boundary');}
function pokemonCombatOnDayAdvance(){const c=state.ui?.combat;if(!c)return;for(const id of (c.participantIds||[])){const row=pokemonCombatParticipant(id);if(!row)continue;row.frequency.dayNumber=Number(state.ui.day||1);row.frequency.day={};row.frequency.sceneNumber=Number(state.ui.scene||1);row.frequency.scene={};row.frequency.eot={};row.turn={round:0,used:{standard:false,shift:false,swift:false},conversions:[],bonus:{standard:0},bonusUsed:{standard:0}};row.triggerWindows={};row.viciousActivation=null;row.moveState.rollout={active:false,hits:0,nextDb:3,lastDb:null,lastResult:null};row.moveState.furyCutter={active:false,hits:0,nextDb:4,lastDb:null,lastResult:null};}if(c.active)pokemonCombatLog(null,'Day advanced',`Day ${state.ui.day} began; Daily/Scene frequencies and chained Move state reset.`,'boundary');}
async function pokemonCombatStopCurledUp(id){const row=pokemonCombatParticipant(id);if(!row?.conditions?.curledUp)return;const spent=pokemonCombatSpendAction(id,'Swift Action');if(!spent.valid)return toast(spent.reason,'error');row.conditions.curledUp=false;pokemonCombatLog(id,'Curled Up ended',`${pokemon(id)?.name||id} stopped being Curled Up · ${spent.spent}.`,'condition');commit(`${pokemon(id)?.name||'Pokémon'} stopped being Curled Up.`);render();}
function pokemonCombatEndRollout(id,reason='No valid target'){const row=pokemonCombatParticipant(id);if(!row)return;row.moveState.rollout={active:false,hits:0,nextDb:3,lastDb:row.moveState.rollout?.lastDb??null,lastResult:'no-target'};pokemonCombatLog(id,'Rollout chain ended',`${reason}; Rollout returns to DB 3 on the next use.`,'move-state');commit('Rollout chain ended.');render();}
function pokemonMoveIsDamaging(row){const def=row?.definition||{};return ['physical','special'].includes(String(def.category||def.class||'').toLowerCase())||!!row?.resolvedDamage;}
async function pokemonCombatDispatchMoveFormEvent(id,row){const p=pokemon(id),def=row?.definition||{};if(!p)return;pokemonCombatViciousRecordMoveUse(id,row);const tags=moveKeywordEntries(def||row?.record||{}).map(entry=>entry.name);const payload=await applyPokemonFormGameEventUi(id,{kind:'move-used',move:def.name||row?.record?.name||row?.record?.id||'',moveClass:def.category||def.class||null,damaging:pokemonMoveIsDamaging(row),raisesDefenseCombatStages:pokemonMoveRaisesDefenseCombatStages(def),tags},{silent:true,commitAfter:false});if(payload?.changed&&pokemonCombatReferenceState.pokemonId===id)await loadPokemonCombatReferenceData(id,true);}
async function pokemonCombatUseNoRoll(id,index){
  const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,row=(data?.moves||[])[Number(index)],p=pokemon(id);if(!row||!p)return toast('Move reference data is unavailable.','error');const available=pokemonCombatMoveAvailability(id,row);if(!available.valid)return toast(available.reason,'error');const action=pokemonCombatSpendAction(id,available.action);if(!action.valid)return toast(action.reason,'error');const freq=pokemonCombatSpendFrequency(id,available.key,available.frequency);if(!freq.valid)return toast(freq.reason,'error');const name=row.definition?.name||row.record?.name||'Move',ledger=pokemonCombatParticipant(id);
  if(pokemonCombatSlug(name)!=='fury-cutter'&&pokemonCombatFuryCutterState(ledger).active)pokemonCombatResetFuryCutter(ledger,'different-move');
  if(pokemonCombatSlug(name)==='defense-curl'){ledger.conditions.curledUp=true;pokemonCombatLog(id,'Defense Curl',`${p.name} became Curled Up · immune to Critical Hits · DR 10${pokemonCombatKnowsRollMove(data)?' · Rollout/Ice Ball prevent Slowed while Curled Up':' · Slowed'} · ${action.spent}.`,'condition');}else pokemonCombatLog(id,'Move used',`${p.name} used ${name} · ${action.spent}${available.frequency?` · ${available.frequency}`:''}.`,'move');await pokemonCombatDispatchMoveFormEvent(id,row);await commit(`${p.name} used ${name}.`);render();
}
async function pokemonCombatOpenMove(id,index){
  const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,row=(data?.moves||[])[Number(index)],p=pokemon(id);if(!row||!p)return toast('Move reference data is unavailable.','error');const available=pokemonCombatMoveAvailability(id,row);if(!available.valid)return toast(available.reason,'error');
  const def=row.definition||{},name=def.name||row.record?.name||'Move';if(pokemonCombatSlug(name)==='defense-curl'||(def.ac==null&&!row.resolvedDamage))return pokemonCombatUseNoRoll(id,index);
  const slug=pokemonCombatSlug(name),ledger=pokemonCombatParticipant(id),spec=pokemonCombatOutcomeSpec(name),dynamic=slug==='rollout'||slug==='fury-cutter',rollState=ledger?.moveState?.rollout||{nextDb:3},fury=pokemonCombatFuryCutterState(ledger),damaging=!!row.resolvedDamage||['physical','special'].includes(String(def.category||def.class||'').toLowerCase());
  const baseDb=slug==='rollout'?Number(rollState.nextDb||3):slug==='fury-cutter'?Number(fury.active?fury.nextDb:4):Number(row.resolvedDamage?.baseDamageBase??def.damageBase??0),stab=Number(row.resolvedDamage?.stabDamageBaseBonus||0),finalDb=damaging?Math.max(1,Math.min(28,dynamic?baseDb+stab:Number(row.resolvedDamage?.finalDamageBase??baseDb+stab))):null;
  const chart=damaging?await pokemonCombatDamageChart(finalDb,row):null,diceExpr=chart?.rolled_damage||chart?.rolledDamage||row.resolvedDamage?.damageChart?.rolled_damage||row.resolvedDamage?.damageChart?.rolledDamage||null,critExpr=pokemonCombatDoubleDamageDiceExpression(diceExpr);
  let furyAlternate='';if(slug==='fury-cutter'&&fury.active){const altDb=4,altFinal=Math.max(1,Math.min(28,altDb+stab)),altChart=await pokemonCombatDamageChart(altFinal,row),altExpr=altChart?.rolled_damage||altChart?.rolledDamage||null;furyAlternate=`<div class="flow-note"><strong>Fury Cutter target continuity</strong><small>Same abstract target: base DB ${baseDb} → final DB ${finalDb}${diceExpr?` (${esc(diceExpr)})`:''}. New abstract target: base DB 4 → final DB ${altFinal}${altExpr?` (${esc(altExpr)})`:''}. Choose the correct target continuity before rolling the physical damage dice.</small></div>`;}
  const outcomeFields=pokemonCombatOutcomeUiFields(spec,ledger),damageFields=damaging?`<label>Physical Damage Roll<input id="combat-manual-damage-roll" type="number" min="0" step="1" placeholder="required on a hit"></label>`:'',criticalField=damaging?`<label>Critical Hit?<select id="combat-critical-result"><option value="">Choose…</option><option value="no">No</option><option value="yes">Yes</option></select></label>`:'';
  modal(`<div class="flow-note"><strong>${esc(name)}</strong><small>${esc(available.frequency||'At-Will')} · ${esc(available.action)}${slug==='rollout'?` · current Rollout DB ${baseDb}`:slug==='fury-cutter'?` · current Fury Cutter base DB ${baseDb}`:''}${finalDb?` · final DB ${finalDb}`:''}</small></div>${furyAlternate}<div class="form-grid"><label>Natural d20 · physical die<input id="combat-natural-roll" type="number" min="1" max="20" step="1" placeholder="${def.ac==null?'not required':'required'}"></label><label>Final attack result<select id="combat-hit-result"><option value="">Choose…</option><option value="hit">Hit</option><option value="miss">Miss</option></select></label>${criticalField}${damageFields}${outcomeFields}</div>${damaging&&diceExpr?`<div class="flow-note"><strong>Roll physical damage dice</strong><small>Normal: ${esc(diceExpr)}${critExpr?` · Critical: ${esc(critExpr)}`:''}. Enter the rolled Damage Base component only; the app adds this Pokémon's known attacking Stat and local bonuses afterward.</small></div>`:''}<div class="flow-note"><small>The Combat screen never generates attack or damage dice. The opposing Pokémon/NPC remains abstract. Outcome fields appear only when this Move's source-explicit effect needs information from that abstract target.</small></div><button class="btn btn-primary full" onclick="pokemonCombatResolveMove('${id}',${Number(index)})">Record ${esc(name)}</button>`,{title:`Combat · ${name}`,subtitle:'Physical dice only · record the outcome before spending action/frequency.'});
}
async function pokemonCombatDamageChart(db,row){const existing=row?.resolvedDamage?.damageChart;if(existing&&Number(row?.resolvedDamage?.finalDamageBase)===Number(db))return existing;try{const response=await fetch(`/api/damage-base/${encodeURIComponent(db)}`,{cache:'no-store'});if(response.ok)return await response.json();}catch{}return null;}
async function pokemonCombatResolveMove(id,index){
  const data=pokemonCombatReferenceState.pokemonId===id?pokemonCombatReferenceState.data:null,row=(data?.moves||[])[Number(index)],p=pokemon(id);if(!row||!p)return toast('Move reference data is unavailable.','error');const available=pokemonCombatMoveAvailability(id,row);if(!available.valid)return toast(available.reason,'error');
  const def=row.definition||{},name=def.name||row.record?.name||'Move',slug=pokemonCombatSlug(name),ledger=pokemonCombatParticipant(id),spec=pokemonCombatOutcomeSpec(name),damaging=!!row.resolvedDamage||['physical','special'].includes(String(def.category||def.class||'').toLowerCase());
  const naturalRaw=document.getElementById('combat-natural-roll')?.value,natural=naturalRaw===''||naturalRaw==null?null:Number(naturalRaw);if(natural!=null&&(!Number.isInteger(natural)||natural<1||natural>20))return toast('Natural d20 must be a physical die result from 1 to 20.','error');if(def.ac!=null&&natural==null)return toast('Enter the natural d20 result from the physical Accuracy die.','error');
  const hitRaw=String(document.getElementById('combat-hit-result')?.value||'');if(!['hit','miss'].includes(hitRaw))return toast('Confirm whether the Move hit or missed.','error');const hit=hitRaw==='hit',criticalRaw=damaging?String(document.getElementById('combat-critical-result')?.value||''):'';if(damaging&&hit&&!['yes','no'].includes(criticalRaw))return toast('Confirm whether the hit was Critical.','error');const critical=!!(damaging&&hit&&criticalRaw==='yes');
  const manualDamageRaw=damaging?document.getElementById('combat-manual-damage-roll')?.value:null,manualDamage=manualDamageRaw===''||manualDamageRaw==null?null:Number(manualDamageRaw);if(damaging&&hit&&(manualDamage==null||!Number.isInteger(manualDamage)||manualDamage<0))return toast('Enter the physical Damage Roll result for this hit.','error');
  const dealtRaw=document.getElementById('combat-target-damage-dealt')?.value,targetDamage=dealtRaw===''||dealtRaw==null?null:Number(dealtRaw);if(targetDamage!=null&&(!Number.isInteger(targetDamage)||targetDamage<0))return toast('Damage actually taken by the target must be a non-negative whole number.','error');if(hit&&spec.requiresTargetDamage&&targetDamage==null)return toast('Enter the damage actually taken by the abstract target for this Move effect.','error');
  const damageDealtRaw=String(document.getElementById('combat-damage-dealt')?.value||'');if(hit&&spec.requiresDamageDealt&&!['yes','no'].includes(damageDealtRaw))return toast('Confirm whether this Move actually dealt damage.','error');const damageDealt=spec.requiresDamageDealt?(hit&&damageDealtRaw==='yes'):null;
  const extraD20Raw=document.getElementById('combat-extra-d20')?.value,extraD20=extraD20Raw===''||extraD20Raw==null?null:Number(extraD20Raw);if(extraD20!=null&&(!Number.isInteger(extraD20)||extraD20<1||extraD20>20))return toast('The extra effect d20 must be a physical die result from 1 to 20.','error');if(hit&&spec.requiresExtraD20&&extraD20==null)return toast('Roll the Move effect d20 physically and enter the natural result.','error');
  const sameTargetRaw=String(document.getElementById('combat-same-target')?.value||''),furyBefore=slug==='fury-cutter'?{...pokemonCombatFuryCutterState(ledger)}:null;if(slug==='fury-cutter'&&hit&&furyBefore.active&&!['yes','no'].includes(sameTargetRaw))return toast('Confirm whether Fury Cutter is continuing against the same abstract target.','error');const sameTarget=slug==='fury-cutter'?(furyBefore.active&&hit?sameTargetRaw==='yes':true):null;
  const faintedRaw=String(document.getElementById('combat-target-fainted')?.value||'');if(hit&&spec.requiresTargetFainted&&!['yes','no'].includes(faintedRaw))return toast('Confirm whether this Move knocked out the abstract target.','error');const targetFainted=spec.requiresTargetFainted?faintedRaw==='yes':null;
  const action=pokemonCombatSpendAction(id,available.action);if(!action.valid)return toast(action.reason,'error');const freq=pokemonCombatSpendFrequency(id,available.key,available.frequency);if(!freq.valid)return toast(freq.reason,'error');
  let damage=null;if(hit&&damaging){const baseDb=slug==='rollout'?Number(ledger.moveState.rollout?.nextDb||3):slug==='fury-cutter'?Number(furyBefore.active&&sameTarget?furyBefore.nextDb:4):Number(row.resolvedDamage?.baseDamageBase??def.damageBase??0),stab=Number(row.resolvedDamage?.stabDamageBaseBonus||0),finalDb=Math.max(1,Math.min(28,(slug==='rollout'||slug==='fury-cutter')?baseDb+stab:Number(row.resolvedDamage?.finalDamageBase??baseDb+stab))),chart=await pokemonCombatDamageChart(finalDb,row),diceExpr=chart?.rolled_damage||chart?.rolledDamage||row.resolvedDamage?.damageChart?.rolled_damage||row.resolvedDamage?.damageChart?.rolledDamage||null,rolledExpression=critical?pokemonCombatDoubleDamageDiceExpression(diceExpr):diceExpr,stat=Number(row.resolvedDamage?.primaryStat?.value||0),mixed=Number(row.resolvedDamage?.mixedPowerBonus||0),knowsRoll=pokemonCombatKnowsRollMove(data),curl=pokemonCombatDefenseCurlModifier({curledUp:!!ledger.conditions.curledUp,moveName:name,knowsRollMove:knowsRoll}),bonus=Number(curl.damageBonus||0),total=Number(manualDamage||0)+stat+mixed+bonus;damage={baseDb,finalDb,diceExpr,rolledExpression,manualRoll:Number(manualDamage||0),stat,mixed,bonus,total,targetDamage};}
  if(slug==='rollout'){const usedDb=Number(damage?.baseDb??ledger.moveState.rollout?.nextDb??3);ledger.moveState.rollout=pokemonCombatRolloutAfterResult(ledger.moveState.rollout,hit,usedDb);}await pokemonCombatApplyMoveOutcome(id,{name,hit,targetDamage,targetFainted,sameTarget,usedDb:damage?.baseDb??null,damageDealt,extraD20});
  const accuracyText=natural==null?'no Accuracy Roll':`physical d20 ${natural}${def.ac!=null?` · Move AC ${row.effectiveAc??def.ac}`:''}`;let detail=`${p.name} used ${name} · ${accuracyText} · reported ${hit?(critical?'CRITICAL HIT':'HIT'):'MISS'} · ${action.spent}`;
  if(damage){detail+=` · DB ${damage.finalDb}${damage.rolledExpression?` · physical ${damage.rolledExpression}`:''} = ${damage.manualRoll} + Stat ${damage.stat}${damage.mixed?` + Mixed ${damage.mixed}`:''}${damage.bonus?` + Defense Curl ${damage.bonus}`:''} = ${damage.total} before unknown target defenses/effectiveness`;if(damage.targetDamage!=null)detail+=` · target actually took ${damage.targetDamage}`;}
  if(slug==='rollout')detail+=hit?` · next Rollout DB ${ledger.moveState.rollout.nextDb}`:' · Rollout chain reset to DB 3';if(slug==='fury-cutter'){const fury=ledger.moveState.furyCutter;detail+=fury.active?` · Fury Cutter chain ${fury.hits} hit${fury.hits===1?'':'s'} · next base DB ${fury.nextDb}`:` · Fury Cutter reset to DB 4 (${fury.lastResult})`;}
  if(spec.kind==='drain-half'&&hit)detail+=` · drain healing ${Math.floor(Number(targetDamage||0)/2)} HP`;if(spec.kind==='fell-stinger'&&hit)detail+=targetFainted?' · Fell Stinger KO confirmed · Attack +2 CS':' · Fell Stinger KO not confirmed';if(spec.requiresDamageDealt&&hit)detail+=damageDealt?' · damage dealt confirmed':' · no damage dealt';if(spec.kind==='charge-beam'&&hit)detail+=` · Charge Beam effect physical d20 ${extraD20}${pokemonCombatChargeBeamRaisesSpAttack(extraD20)?' · Special Attack +1 CS':' · no Special Attack increase'}`;pokemonCombatLog(id,critical?'Critical Hit':hit?'Move hit':'Move missed',detail,'move');await pokemonCombatDispatchMoveFormEvent(id,row);closeModal();await commit(detail);render();toast(hit?(critical?'Critical Hit recorded.':'Hit recorded.'):'Miss recorded.',hit?'success':'error');
}
function pokemonCombatMoveCard(id,row,index,data){const def=row.definition||{},name=def.name||row.record?.name||row.record?.id||'Move',available=pokemonCombatMoveAvailability(id,row),action=available.action||pokemonCombatActionCostForMove(def),frequency=def.frequency||row.record?.frequency||'At-Will',ledger=pokemonCombatParticipant(id),rollout=pokemonCombatSlug(name)==='rollout'?ledger?.moveState?.rollout:null,dynamicDb=rollout?Number(rollout.nextDb||3):null;return `<article class="known-move-card"><div class="row-between"><div><h3>${esc(name)}</h3><div class="row-gap">${def.type?typeBadge(String(def.type).toLowerCase()):''}${chip(esc(frequency),available.valid?'chip-green':'chip-red')}${chip(esc(action),'chip-blue')}</div></div><div class="move-metrics">${row.effectiveAc!=null?`<span><small>AC</small><b>${esc(row.effectiveAc)}</b></span>`:''}${row.accuracyRollBonus?`<span><small>ACC Roll</small><b>${row.accuracyRollBonus>0?'+':''}${row.accuracyRollBonus}</b></span>`:''}${row.resolvedDamage?.finalDamageBase!=null?`<span><small>DB</small><b>${dynamicDb??row.resolvedDamage.finalDamageBase}</b></span>`:''}</div></div>${rollout?.active?`<div class="flow-note"><strong>Rollout chain</strong><small>${rollout.hits} successful hit${rollout.hits===1?'':'s'} · next base DB ${rollout.nextDb}</small></div>`:''}<p>${esc(def.effect||'No resolved effect text available.')}</p>${available.valid?'':`<div class="builder-validation bad">${esc(available.reason||'Unavailable')}</div>`}<button class="btn ${available.valid?'btn-primary':'btn-disabled'} full" ${available.valid?'':'disabled'} onclick="pokemonCombatOpenMove('${id}',${index})">Use ${esc(name)}</button></article>`;}
function pokemonCombatActionStrip(id){const turn=pokemonCombatTurn(id),used=turn?.used||{},standardRemaining=pokemonCombatStandardRemaining(turn),standardTotal=1+Math.max(0,Number(turn?.bonus?.standard||0)),standardSpent=Math.max(0,standardTotal-standardRemaining);const status=(label,isUsed)=>chip(`${label} ${isUsed?'USED':'READY'}`,isUsed?'chip-gray':'chip-green'),standard=chip(`STANDARD ${standardRemaining>0?`${standardRemaining} READY`:'USED'}${standardTotal>1?` · ${standardSpent}/${standardTotal} spent`:''}`,standardRemaining>0?'chip-green':'chip-gray');return `<div class="row-gap">${standard}${status('SHIFT',used.shift)}${status('SWIFT',used.swift)}${chip('FREE ∞','chip-blue')}</div>${turn?.conversions?.length?`<small>Conversions: ${esc(turn.conversions.join(', '))}</small>`:''}`;}
function pokemonCombatConditionPanel(id,data){const row=pokemonCombatParticipant(id),rollout=row?.moveState?.rollout||{},knowsRoll=pokemonCombatKnowsRollMove(data),curl=pokemonCombatDefenseCurlModifier({curledUp:!!row?.conditions?.curledUp,moveName:'',knowsRollMove:knowsRoll});const parts=[];if(row?.conditions?.stuck)parts.push(`<div class="flow-note"><strong>Stuck</strong><small>Controlled status. Electrodash can remove it as a Shift Action.</small><button class="btn btn-ghost btn-small" onclick="pokemonCombatSetStuck('${id}',false)">Clear manually</button></div>`);else parts.push(`<button class="btn btn-ghost btn-small" onclick="pokemonCombatSetStuck('${id}',true)">Mark Stuck</button>`);if(Number(row?.conditions?.quickCurlDrRound)===Number(state.ui.round||1))parts.push(`<div class="flow-note"><strong>Quick Curl</strong><small>+10 Damage Reduction for this round.</small></div>`);if(Number(row?.conditions?.electrodashSprintRound)===Number(state.ui.round||1))parts.push(`<div class="flow-note"><strong>Electrodash Sprint</strong><small>Sprint was a Free Action; no Attacks of Opportunity while Sprinting this round.</small></div>`);if(Number(row?.conditions?.viciousCriticalRangeBonus||0)>0)parts.push(`<div class="flow-note"><strong>Vicious</strong><small>Critical Hit Range +${Number(row.conditions.viciousCriticalRangeBonus)} for all attacks · remains until this Pokémon leaves the current Combat session.</small></div>`);if(row?.conditions?.curledUp)parts.push(`<div class="flow-note"><strong>Curled Up</strong><small>Critical immunity · DR 10${curl.slowed?' · Slowed':' · Rollout/Ice Ball known: not Slowed'} · Rollout/Ice Ball gain +10 Damage and ignore the Curled Up Accuracy penalty.</small><button class="btn btn-ghost btn-small" onclick="pokemonCombatStopCurledUp('${id}')">Stop Curled Up · Swift Action</button></div>`);if(rollout.active)parts.push(`<div class="flow-note"><strong>Rollout locked</strong><small>${rollout.hits} consecutive hit${rollout.hits===1?'':'s'} · next base DB ${rollout.nextDb}. Other Moves are disabled until Rollout misses or no target can be hit.</small><button class="btn btn-ghost btn-small" onclick="pokemonCombatEndRollout('${id}')">No valid target · end chain</button></div>`);return parts.join('')||'<p class="muted">No tracked combat condition or chained Move state.</p>'; }
function pokemonCombatScreen(){const c=ensurePokemonCombatUi(),rosters=(state.rosters||[]).filter(r=>r.active!==false),selectedRoster=rosters.find(r=>r.id===c.rosterId)||rosters[0]||null;if(selectedRoster&&c.rosterId!==selectedRoster.id)c.rosterId=selectedRoster.id;const candidates=selectedRoster?rosterMembers(selectedRoster.id).filter(p=>!p.storage):[];const activeId=c.activePokemonId&&c.participantIds.includes(c.activePokemonId)?c.activePokemonId:c.participantIds[0]||null,active=activeId?pokemon(activeId):null;if(activeId&&c.activePokemonId!==activeId)c.activePokemonId=activeId;const rosterPicker=`<div class="form-grid"><label>Roster<select onchange="pokemonCombatSelectRoster(this.value)">${rosters.map(r=>`<option value="${esc(r.id)}" ${r.id===c.rosterId?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label><label>Pokémon<select id="combat-add-pokemon"><option value="">Choose a Pokémon…</option>${candidates.filter(p=>!c.participantIds.includes(p.id)).map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.species)} · Lv. ${p.level}</option>`).join('')}</select></label></div><button class="btn btn-primary" onclick="pokemonCombatAdd(document.getElementById('combat-add-pokemon').value)">＋ Put Pokémon in Combat</button>`;const participantBar=c.participantIds.length?`<div class="row-gap">${c.participantIds.map(id=>{const p=pokemon(id);return p?`<button class="btn ${id===activeId?'btn-gold':'btn-ghost'} btn-small" onclick="pokemonCombatActivate('${id}')">${esc(p.name)} · ${p.hp}/${p.maxHp}</button>`:''}).join('')}</div>`:'<p class="muted">No Pokémon in this combat session yet.</p>';let body=`${section('COMBAT ROSTER',`${rosterPicker}${participantBar}`)}`;if(active){const ref=pokemonCombatReferenceState.pokemonId===active.id?pokemonCombatReferenceState:null;if(!ref?.data&&!ref?.loading)setTimeout(()=>loadPokemonCombatReferenceData(active.id),0);const data=ref?.data;const temp=tempHpValue(active),formIndicator=data?pokemonFormCombatIndicator(active,data):'',formActions=data?pokemonFormLifecycleControls(data.species?.forms||[],pokemonFormCurrentState(active),active):'';const header=`<div class="creature-header">${pokemonPortraitTag(active)}<div><p class="eyebrow">ACTIVE COMBATANT</p><h1>${esc(active.name)}</h1><p>${esc(active.species)} · Lv. ${active.level}</p></div><div class="creature-vitals"><strong>HP ${active.hp}/${active.maxHp}${temp?` +${temp} TEMP`:''}</strong>${progress(active.hp,active.maxHp,hpTone(active))}</div></div>`;body+=section('ACTIVE COMBATANT',`${header}${formIndicator}${formActions}<div class="battle-controls"><div class="hp-actions"><button onclick="changeHp('${active.id}',-5)">−5 HP</button><button onclick="changeHp('${active.id}',-1)">−1 HP</button><button onclick="changeHp('${active.id}',1)">+1 HP</button><button onclick="changeHp('${active.id}',5)">+5 HP</button></div></div>${pokemonCombatActionStrip(active.id)}${pokemonCombatNonMoveResourcePanel(active.id)}<div class="row-gap"><button class="btn btn-primary" onclick="pokemonCombatBeginTurn('${active.id}')">Begin / Focus Turn</button><button class="btn btn-danger btn-small" onclick="pokemonCombatRemove('${active.id}')">Remove from Combat</button></div>`);body+=section('TRACKED COMBAT STATE',data?pokemonCombatConditionPanel(active.id,data):ref?.error?`<div class="builder-validation bad">${esc(ref.error)}</div>`:'<p class="muted">Loading PTU combat data…</p>');const sources=data?pokemonCombatSourcePrecedencePanel(data):'';if(sources)body+=section('RULESET SOURCE RESOLUTION',sources);body+=section('MANEUVERS',data?pokemonCombatSprintManeuverPanel(active.id,data):'<p class="muted">Maneuver data is loading from the active Ruleset.</p>');body+=section('AVAILABLE ABILITIES',data?pokemonCombatAbilityActionPanel(active.id,data):'<p class="muted">Ability definitions are loading from the active Ruleset.</p>');const primeFury=data?pokemonCombatPrimeFuryPanel(active.id,data):'';if(primeFury)body+=section('PRIME FURY',primeFury);const hydrationIceBody=data?pokemonCombatHydrationIceBodyPanel(active.id,data):'';if(hydrationIceBody)body+=section('HYDRATION · ICE BODY · WEATHER',hydrationIceBody);const electrodash=data?pokemonCombatElectrodashPanel(active.id,data):'';if(electrodash)body+=section('ELECTRODASH · SPRINT',electrodash);const quickCurl=data?pokemonCombatQuickCurlPanel(active.id,data):'';if(quickCurl)body+=section('QUICK CURL · DEFENSE CURL',quickCurl);const vicious=data?pokemonCombatViciousPanel(active.id,data):'';if(vicious)body+=section('VICIOUS · HONE CLAWS',vicious);body+=section('AVAILABLE MOVES',data?`<div class="known-move-grid">${(data.moves||[]).map((row,index)=>pokemonCombatMoveCard(active.id,row,index,data)).join('')||'<p class="muted">No Moves recorded.</p>'}</div>`:'<p class="muted">Move definitions are loading from the active Ruleset.</p>');}
  const recent=(c.log||[]).slice().reverse().slice(0,20);body+=section('COMBAT LOG',recent.length?`<div class="timeline">${recent.map(entry=>`<div><b>R${entry.round}</b><strong>${esc(entry.title)}</strong><span>${esc(entry.detail)}</span></div>`).join('')}</div>`:'<p class="muted">Accuracy rolls, hit/miss/critical results, chained Move state and combat boundaries will appear here.</p>');const controls=`<div class="row-gap"><button class="btn btn-ghost" onclick="nextRound()">Next Round</button><button class="btn btn-ghost" onclick="endScene()">End Scene</button><button class="btn btn-ghost" onclick="newDay()">New Day</button>${c.active?`<button class="btn btn-danger" onclick="pokemonCombatEndSession()">End Combat</button>`:''}</div>`;return `<div class="page">${heading('COMBAT','Combat Session Ledger',`Round ${state.ui.round} · Scene ${state.ui.scene} · Day ${state.ui.day}. Shared Pokémon action/frequency ledger with real attack rolls.`,controls)}${body}</div>`;}

function creatureScreen(){
  const p=pokemon(); if(!p)return `<div class="page">${heading('POKÉMON','No Pokémon','Create a Pokémon to begin.','<button class="btn btn-primary" onclick="route(\'pokemonbuilder\')">＋ Create Pokémon</button>')}</div>`; const choices=state.pokemon||[]; const selectionPanel=`<details class="section-card creature-selector-accordion"><summary class="section-title">POKÉMON · ${choices.length}</summary><div class="section-body storage-grid creature-selector-grid">${choices.map(x=>creatureSelectorCard(x,p.id)).join('')}</div></details>`; const stages=p.combatStages; const d=p.details||{}; const fs=d.finalStats||null; const rulesBuilt=!!d.createdFromDefinition; const activeTab=state.ui.creatureTab||'sheet'; const data=creatureReferenceState.pokemonId===p.id?creatureReferenceState.data:null; const effectiveFs=data?.resolvedCreature?.stats?.effective||fs; const resolvedSpecies=data?.species||null; const resolvedTypes=(resolvedSpecies?.types||p.types||[]).map(type=>String(type).toLowerCase()); const resolvedSpeciesName=resolvedSpecies?.name||p.species; const tempHp=tempHpValue(p); const rawPokemonNotes=d.notes; const pokemonNotes=Array.isArray(rawPokemonNotes)?rawPokemonNotes.map(value=>String(value??'')).join('\n'):typeof rawPokemonNotes==='string'?rawPokemonNotes.replace(/\r\n?/g,'\n'):'';
  const statBlock=fs?`<div class="definition-stat-grid">${[['HP','hp',null],['Attack','attack','attack'],['Defense','defense','defense'],['Sp. Atk','special_attack','spAttack'],['Sp. Def','special_defense','spDefense'],['Speed','speed','speed']].map(([label,k,stageKey])=>{const permanent=Number(effectiveFs?.[k]??fs[k]),stage=stageKey?Number(stages?.[stageKey]||0):0,value=stageKey?pokemonCombatStageValue(permanent,stage):permanent;return `<div><small>${label}</small><strong>${value}</strong>${stage?`<em>CS ${stage>0?'+':''}${stage} · permanent ${permanent}</em>`:effectiveFs&&Number(effectiveFs[k])!==Number(fs[k])?`<em>base ${fs[k]}</em>`:''}</div>`}).join('')}</div><div class="flow-note"><strong>Stat source:</strong> permanent PTU build${data?.heldItem?.effect?' + active Held Item modifiers':''}, then Combat Stages. Max HP never receives Combat Stages. Post-stage Held Item bonuses do not rewrite the saved allocation.</div>`:`<p class="muted">Legacy/sample Pokémon: final PTU Stat allocation has not been attached to this instance yet.</p>`;
  const moveBlock=d.moves?.length?`<div class="move-rows">${d.moves.map(m=>{const src=moveSourceInfo(m);return `<div><b>${esc(m.name)}</b><span>${m.typeHint?typeBadge(String(m.typeHint).toLowerCase()):''} ${chip(src.label,src.tone)}${m.connectionGrant?.moveSlotExempt?chip('FREE SLOT','chip-blue'):''}</span></div>`}).join('')}</div><div class="flow-note"><strong>Move slots:</strong> ${d.moves.filter(m=>!m.connectionGrant?.moveSlotExempt).length}/${data?.resolvedCreature?.moveLimit?.effective??d.moveLimitEffective??6}. Non-natural TM/Tutor pool: ${(d.moves||[]).filter(m=>['tm','hm','tm_hm','tutor','egg_tutor','archive_tutor'].includes(String(m.source||'').toLowerCase())&&!m.countsAsNatural).length}/${Number(d.tutorMovePoolLimit??3)}.</div>`:`<div class="move-rows"><div><b>Shadow Claw</b><span>${typeBadge('ghost')} Physical</span></div><div><b>Damage</b><span><strong>2d6+23</strong></span></div><div><b>Resolution</b><span>DB 4 + STAB 2 → DB 6 → 2d6+8 + Attack 15</span></div></div><p class="muted">Sample/legacy resolved output.</p>`;
  const abilities=(data?.abilities?.map(a=>a.name)||(d.abilities||[])).filter(Boolean);
  const progressionBlock=rulesBuilt?`<div class="ability-summary">${abilities.map(a=>chip(esc(a),'chip-blue')).join(' ')||'<span class="muted">No Abilities recorded.</span>'}</div><dl class="detail-dl"><div><dt>Nature</dt><dd>${esc(d.nature||'—')}</dd></div><div><dt>Experience</dt><dd>${Number(d.experience??0).toLocaleString()} EXP</dd></div><div><dt>Tutor Points</dt><dd>${Number(d.tutorPointsRemaining??0)} remaining / ${Number(d.tutorPointsEarned??0)} earned</dd></div><div><dt>Move Limit</dt><dd>${Number(data?.resolvedCreature?.moveLimit?.effective??d.moveLimitEffective??6)}</dd></div><div><dt>Poké Edges</dt><dd>${Array.isArray(d.pokeEdges)?d.pokeEdges.length:0}</dd></div><div><dt>Trained Moves</dt><dd>${Array.isArray(d.trainingHistory)?d.trainingHistory.filter(x=>x.action==='learn_move').length:0}</dd></div><div><dt>Build Engine</dt><dd>${esc(d.buildEngineVersion||'linked definition')}</dd></div></dl>${d.evolutionNotice?`<div class="builder-rule-note"><strong>Evolution reference:</strong> ${esc(d.evolutionNotice.message||'')}</div>`:''}`:`<p class="muted">This sample Pokémon predates the rules-backed creator.</p>`;
  const formSummaryBlock=pokemonFormSummaryBlock(p,data);
  const formCombatIndicator=pokemonFormCombatIndicator(p,data)+(data?pokemonFormLifecycleControls(data.species?.forms||[],pokemonFormCurrentState(p),p):'');
  const sheet=`<div class="creature-detail-grid">${section('ACTIVE STATE',`${formCombatIndicator}<div class="battle-controls"><label>Current HP <div class="hp-control"><div class="hp-readout"><strong>${p.hp}/${p.maxHp}${tempHp?` +${tempHp} Temp`:''}</strong><small>${Math.round((p.hp/p.maxHp)*100)}% normal HP${tempHp?` · ${tempHp} Temporary HP`:''}</small></div>${progress(p.hp,p.maxHp,hpTone(p))}<div class="hp-actions"><button onclick="changeHp('${p.id}',-5)">−5</button><button onclick="changeHp('${p.id}',-1)">−1</button><button onclick="changeHp('${p.id}',1)">+1</button><button onclick="changeHp('${p.id}',5)">+5</button></div></div></label><label>Injuries <div class="stepper compact"><button onclick="changeInjury('${p.id}',-1)">−</button><strong>${p.injuries}</strong><button onclick="changeInjury('${p.id}',1)">＋</button></div></label></div>`,`<button class="btn btn-ghost btn-small" onclick="editPokemonIdentity('${p.id}')">✎ Edit Identity</button>`)}${formSummaryBlock}${section('PTU COMBAT STATS',statBlock)}${section('COMBAT STAGES',`<div class="stage-grid">${Object.entries(stages).map(([k,v])=>`<div><span>${esc(k)}</span><button onclick="changeStage('${p.id}','${k}',-1)">−</button><b class="${v>0?'positive':v<0?'negative':''}">${v>0?'+':''}${v}</b><button onclick="changeStage('${p.id}','${k}',1)">＋</button></div>`).join('')}</div>`)}${section('MOVES',moveBlock)}${section('ABILITIES & PROGRESSION',progressionBlock)}${section('POKÉMON NOTES',pokemonNotes.trim()?`<div class="flow-note pokemon-notes-block">${esc(pokemonNotes).replace(/\n/g,'<br>')}</div>`:'<p class="muted">No Pokémon notes yet.</p>',`<button class="btn btn-ghost btn-small" onclick="editPokemonNotes('${p.id}')">${pokemonNotes.trim()?'Edit Notes':'Add Notes'}</button>`)}${section('ITEM & STORAGE',`<dl class="detail-dl"><div><dt>Held Item</dt><dd>${esc(p.heldItem||'None')}</dd></div><div><dt>Poké Ball</dt><dd>${esc(p.ball)}</dd></div><div><dt>Storage State</dt><dd>${p.storage?'Stored':'Carried'}</dd></div><div><dt>Sex</dt><dd>${esc(pokemonGenderLabel(d.gender))}</dd></div>${d.nature?`<div><dt>Nature</dt><dd>${esc(d.nature)}</dd></div>`:''}${d.speciesDefinitionId?`<div><dt>PTU Definition</dt><dd>${esc(d.speciesDefinitionId)}</dd></div>`:''}</dl>${p.heldItem?heldItemEffectHtml(data?.heldItem?.effect||d.heldItemEffectSnapshot):'<p class="muted">Select a compatible Held Item directly from the Trainer Backpack.</p>'}<div class="row-gap"><button class="btn btn-gold" onclick="openHeldItemPicker()">${p.heldItem?'Change Held Item':'Equip Held Item'}</button>${p.heldItem?'<button class="btn btn-ghost" onclick="unequipHeldItem()">Return to Backpack</button>':''}</div>${p.storage?`<button class="btn btn-primary full" onclick="withdrawPokemon('${p.id}')">Withdraw</button>`:`<button class="btn ${p.injuries>0?'btn-disabled':'btn-primary'} full" onclick="storePokemon('${p.id}')" ${p.injuries>0?'disabled':''}>${p.injuries>0?'Storage blocked by Injury':'Move to Storage'}</button>`}`)}${section('BATTLE CYCLE',`<div class="summary-kpis"><div><span>↻</span><strong>${state.ui.round}</strong><small>Round</small></div><div><span>◫</span><strong>${state.ui.scene}</strong><small>Scene</small></div><div><span>☀</span><strong>${state.ui.day}</strong><small>Day</small></div></div><div class="row-gap"><button class="btn ${state.ui.inCombat?'btn-danger':'btn-success'}" onclick="setPokemonBattleState(${state.ui.inCombat?'false':'true'})">${state.ui.inCombat?'End Battle':'Start Battle'}</button><button class="btn btn-ghost" onclick="nextRound()">Next Round</button><button class="btn btn-ghost" onclick="endScene()">End Scene</button><button class="btn btn-ghost" onclick="newDay()">New Day</button></div>`)}</div>`;
  const content=activeTab==='moves'?creatureMovesTab(p,data):activeTab==='abilities'?creatureAbilitiesTab(p,data):activeTab==='species'?creatureSpeciesTab(p,data):activeTab==='type'?creatureTypeTab(p,data):activeTab==='pokedex'?creaturePokedexTab(p,data):sheet;
  const tabs=['sheet','moves','abilities','species','type','pokedex'];
  return `<div class="page">${heading('POKÉMON','Creature Sheet','Active state and permanent data for the selected Pokémon.',rulesBuilt?`<div class="row-gap"><button class="btn btn-success" onclick="beginPokemonProgression()">✦ Progress Pokémon</button><button class="btn btn-gold" onclick="beginPokemonTraining()">◆ Advanced Training</button><button class="btn btn-primary" onclick="route('pokemonbuilder')">＋ Create Pokémon</button><button class="btn btn-danger" onclick="deletePokemon('${p.id}')">Delete Pokémon</button></div>`:`<div class="row-gap"><button class="btn btn-primary" onclick="route('pokemonbuilder')">＋ Create Pokémon</button><button class="btn btn-danger" onclick="deletePokemon('${p.id}')">Delete Pokémon</button></div>`)}${selectionPanel}<div id="creature-portrait" class="creature-header" tabindex="-1">${pokemonPortraitTag(p)}<div><p class="eyebrow">INDIVIDUAL CREATURE SHEET</p><h1>${esc(p.name)}</h1><p>${esc(resolvedSpeciesName)} · Lv. ${p.level}</p><div>${resolvedTypes.map(typeBadge).join(' ')}</div></div><div class="creature-vitals"><strong>HP ${p.hp}/${p.maxHp}${tempHp?` +${tempHp} TEMP`:''}</strong>${progress(p.hp,p.maxHp,hpTone(p))}${p.injuries?`<small>Injuries limit healing to ${injuryHealingHpLimit(p.maxHp,p.injuries)} HP</small>`:''}${tempHp?chip(`TEMP HP +${tempHp}`,'chip-blue'):''}${d.isShiny?chip('★ SHINY','chip-gold'):''}${p.injuries>=5?chip('HEAVILY INJURED','chip-red'):p.injuries>0?chip(`${p.injuries} INJURIES`,'chip-yellow'):chip('HEALTHY','chip-green')}<span>Loyalty ${loyaltyHearts(p.loyalty)}</span><span>Sex ${esc(pokemonGenderLabel(p.details?.gender))}</span></div></div><div class="tabbar creature-tabs">${tabs.map(tab=>`<button class="${activeTab===tab?'active':''}" onclick="setCreatureTab('${tab}')">${tab==='pokedex'?'Pokédex':tab[0].toUpperCase()+tab.slice(1)}</button>`).join('')}</div>${content}</div>`;
}

function storageScreen(){
  const carried=activePokemon(), stored=storedPokemon(), p=pokemon();
  return `<div class="page">${heading('STORAGE','Pokémon Storage','Only injury-free Pokémon can enter Storage. Held items return to the Trainer backpack.','<button class="btn btn-primary" onclick="route(\'pokemonbuilder\')">＋ Create Pokémon</button>')}<div class="storage-warning">⚠ Pokémon with one or more Injuries cannot be stored.</div><div class="storage-layout">
  ${section(`CARRIED / AVAILABLE · ${carried.length}`,`<div class="storage-pane-note">Pokémon currently available to the Trainer.</div><div class="storage-grid">${carried.map(x=>`<div class="storage-entry ${x.id===p.id?'selected':''}">${creatureCard(x,true)}<button class="btn ${x.injuries>0?'btn-disabled':'btn-ghost'} full" ${x.injuries>0?'disabled':''} onclick="storePokemon('${x.id}')">${x.injuries>0?'Injured':'Store →'}</button></div>`).join('')}</div>`)}
  ${section(`STORED · ${stored.length}`,`<div class="storage-pane-note">Long-term storage. Cards wrap across the full pane width.</div><div class="storage-grid">${stored.map(x=>`<div class="storage-entry ${x.id===p.id?'selected':''}">${creatureCard(x,true)}<button class="btn btn-primary full" onclick="withdrawPokemon('${x.id}')">← Withdraw</button></div>`).join('')||'<p class="muted">Storage is empty.</p>'}</div>`)}
  </div>${p?section('SELECTED POKÉMON',`<div class="storage-selected-summary">${pokemonPortraitTag(p)}<div><strong>${esc(p.name)}</strong><span>${esc(p.species)} · Lv. ${p.level}</span><div>${(p.types||[]).map(typeBadge).join(' ')}</div></div><button class="btn btn-primary" onclick="selectPokemon('${p.id}',true)">🐾 Open in Creatures</button></div>`):''}<div class="flow-note"><strong>Implemented invariant:</strong> Storage resets current HP to maximum, resets combat stages, preserves permanent data, and returns a Held Item to the Backpack.</div></div>`;
}

function inventoryScreen(){
  const p=pokemon(), owned=ownedInventory();
  const actions=`<div class="row-gap"><button class="btn btn-primary" onclick="openBackpackItemPicker()">＋ Add game item</button><button class="btn btn-gold" onclick="createCustomItem()">＋ Custom Item</button></div>`;
  const rows=owned.map(i=>{
    const description=itemDescription(i),slots=itemEquipmentSlots(i);
    const equipLabel=slots.length===1?`Equip · ${ITEM_SLOT_LABELS[slots[0]]||slots[0]}`:'Equip…';
    const itemAction=i.consumable&&p?(supportsAutomatedItemUse(i)?`<button class="btn btn-ghost item-primary-action" onclick="useItem('${i.id}','${p.id}')">Use on ${esc(p.name)}</button>`:`<small class="item-use-unavailable" title="No effect or quantity change is automated for this item.">Effect not automated</small>`):slots.length?`<button class="btn btn-primary item-primary-action" onclick="equipTrainerItem('${i.id}')">${esc(equipLabel)}</button>`:'';
    return `<div class="item-row owned-item-row">${itemIconHtml(i.icon,'◆','owned-item-art')}<div class="owned-item-copy"><div class="owned-item-title"><strong>${esc(i.name)}</strong>${i.custom?chip('CUSTOM','chip-purple'):chip(esc(i.category||'Item'))}</div><small>${esc(i.category||'Item')}${Number(i.price||0)>0?` · ₽${Number(i.price).toLocaleString()}`:''}${i.sourcePage?` · p. ${esc(i.sourcePage)}`:''}</small>${itemUsageBadges(i)?`<div class="item-usage-tags">${itemUsageBadges(i)}</div>`:''}${description?`<p>${esc(description)}</p>`:''}</div><div class="owned-item-actions"><div class="item-qty-controls"><button class="mini-action" title="Remove one" onclick="adjustInventoryQuantity('${i.id}',-1)">−</button><b>× ${Number(i.qty||0)}</b><button class="mini-action" title="Add one" onclick="adjustInventoryQuantity('${i.id}',1)">＋</button></div>${itemAction}</div></div>`;
  }).join('');
  return `<div class="page">${heading('ITEMS','Backpack & Equipment','The backpack shows only items the Trainer actually owns. Catalog entries now expose Trainer/Pokémon usability and every known equipment slot.',actions)}<div class="inventory-layout">
  ${section(`BACKPACK · ${owned.length} ITEM TYPES`,`<div class="item-list">${rows||'<div class="empty-state"><p>The backpack is empty.</p><button class="btn btn-primary" onclick="openBackpackItemPicker()">＋ Add an item from the PTU catalog</button></div>'}</div>`)}
  ${section('EQUIPMENT',`<div class="equipment-grid large">${Object.entries(trainer().equipment||{}).map(([slot,name])=>`<div><small>${esc(ITEM_SLOT_LABELS[slot]||slot)}</small>${equippedItemIcon(name,slot)}<strong>${esc(name&&typeof name==='object'?name.name:(name||'Empty'))}</strong>${name&&!(typeof name==='object'&&name.reservedBy)?`<button class="btn btn-ghost btn-small" onclick="unequipTrainerItem('${slot}')">Unequip</button>`:''}</div>`).join('')}</div><div class="flow-note"><strong>Resolved equipment effects:</strong> bonuses from structured custom Trainer equipment appear on the Trainer Skills tab while equipped; other item effects remain manual.</div>`)}
  </div></div>`;
}

async function loadItemCatalog(force=false){
  if(!force && itemCatalogState.items.length) return itemCatalogState.items;
  itemCatalogState.loading=true; itemCatalogState.error=null;
  try{
    const ruleset=catalogState.status?.activeRulesetId||'';
    const params=new URLSearchParams(); if(ruleset)params.set('ruleset',ruleset);
    const response=await fetch(`/api/items/catalog?${params}`,{cache:'no-store'});
    const payload=await response.json(); if(!response.ok)throw new Error(payload.error||'Unable to load item catalog');
    itemCatalogState.items=payload.items||[];
  }catch(error){ itemCatalogState.error=error.message; itemCatalogState.items=[]; }
  itemCatalogState.loading=false; return itemCatalogState.items;
}
async function openBackpackItemPicker(){
  itemCatalogState.query='';
  modal('<div class="loading-card compact-loading"><span class="spinner"></span><strong>Loading complete PTU item catalog…</strong></div>',{title:'Add Game Item',subtitle:'Every item available in the active Ruleset is searchable here.'});
  await loadItemCatalog(); renderBackpackItemPicker();
}
function renderBackpackItemPicker(){
  if(itemCatalogState.error){ modal(`<div class="builder-validation bad"><strong>Catalog unavailable</strong><span>${esc(itemCatalogState.error)}</span></div><button class="btn btn-primary full" onclick="openBackpackItemPicker()">Retry</button>`,{title:'Add Game Item'}); return; }
  const q=String(itemCatalogState.query||'').trim().toLowerCase();
  const filtered=itemCatalogState.items.filter(i=>!q||itemSearchMetadata(i).includes(q));
  const rows=filtered.map(i=>`<article class="catalog-add-item">${itemIconHtml(i.icon,'◆','catalog-item-art')}<div><strong>${esc(i.name)}</strong><small>${esc(i.category||'Item')}${Number(i.price||0)>0?` · ₽${Number(i.price).toLocaleString()}`:i.priceText?` · ${esc(i.priceText)}`:''}${i.sourcePage?` · p. ${esc(i.sourcePage)}`:''}</small>${itemUsageBadges(i)?`<div class="item-usage-tags">${itemUsageBadges(i)}</div>`:''}${itemDescription(i)?`<p>${esc(itemDescription(i))}</p>`:''}</div><button class="btn btn-primary btn-small" onclick="addCatalogItemToBackpack('${esc(i.id)}')">＋ Add</button></article>`).join('');
  modal(`<div class="catalog-add-toolbar"><input id="backpack-item-search" value="${esc(itemCatalogState.query)}" oninput="filterBackpackItemPicker(this.value)" placeholder="Search item, category, effect, Trainer, Head, Accessory…" autocomplete="off"/><span>${filtered.length} / ${itemCatalogState.items.length}</span></div><div class="catalog-add-list">${rows||'<p class="muted">No matching items.</p>'}</div>`,{title:'Add Game Item',subtitle:`${itemCatalogState.items.length} catalogued items in the active Ruleset. Usability and equipment slots are shown before adding.`});
}
function filterBackpackItemPicker(value){
  itemCatalogState.query=value; renderBackpackItemPicker();
  requestAnimationFrame(()=>{const el=document.getElementById('backpack-item-search');if(el){el.focus();const n=el.value.length;try{el.setSelectionRange(n,n);}catch{}}});
}
function addCatalogItemToBackpack(id){
  const source=itemCatalogState.items.find(i=>i.id===id); if(!source)return;
  let item=state.inventory.find(i=>i.definitionId===source.definitionId||i.id===source.id);
  if(item)item.qty=Number(item.qty||0)+1;
  else state.inventory.push({...structuredClone(source),qty:1});
  persist(); render(); renderBackpackItemPicker();
}
function adjustInventoryQuantity(id,delta){
  const item=inventoryItem(id); if(!item)return;
  item.qty=Math.max(0,Number(item.qty||0)+Number(delta||0)); persist(); render();
}
async function createCustomItem(){
  const f=await styledForm({title:'Create Custom Item',subtitle:'Set item compatibility and, for Trainer equipment, an optional Skill bonus applied while equipped.',submitLabel:'Add to Backpack',tone:'yellow',fields:[
    {name:'name',label:'Item name',value:'Custom Item',placeholder:'Ancient Key'},
    {name:'category',label:'Category',value:'Custom',placeholder:'Held Item, medicine, gear…'},
    {name:'price',label:'Price',type:'number',value:0,min:0,max:999999},
    {name:'description',label:'Description',type:'textarea',rows:5,placeholder:'What the item is, what it does narratively, owner notes…'},
    {name:'trainerUsable',label:'Can the Trainer equip this item?',type:'select',value:'no',options:[{value:'no',label:'No'},{value:'yes',label:'Yes'}]},
    {name:'equipmentSlot',label:'Trainer equipment slot',type:'select',value:'accessory',options:Object.entries(ITEM_SLOT_LABELS).map(([value,label])=>({value,label}))},
    {name:'skillBonusEnabled',label:'Add a Skill bonus while equipped?',type:'select',value:'no',options:[{value:'no',label:'No'},{value:'yes',label:'Yes'}]},
    {name:'skillBonusSkill',label:'Skill receiving the bonus',type:'select',value:TRAINER_SKILLS[0],options:TRAINER_SKILLS.map(value=>({value,label:value}))},
    {name:'skillBonusValue',label:'Skill bonus',type:'number',value:1,min:-99,max:99},
    {name:'pokemonHeldUsable',label:'Can a Pokémon hold this item?',type:'select',value:'no',options:[{value:'no',label:'No'},{value:'yes',label:'Yes'}],help:'This only enables equipping the item. Its effect is resolved separately.'},
    {name:'qty',label:'Quantity',type:'number',value:1,min:1,max:999}
  ]});
  if(!f)return; const name=String(f.name||'').trim(); if(!name)return toast('Custom Item needs a name.','error');
  const trainerUsable=f.trainerUsable==='yes';
  const mechanics=f.skillBonusEnabled==='yes'?{skillBonuses:[{skill:String(f.skillBonusSkill||TRAINER_SKILLS[0]),value:Number(f.skillBonusValue)||0}]}:null;
  state.inventory.push({id:uid('custom-item'),definitionId:null,icon:'◆',name,category:String(f.category||'').trim()||'Custom',price:Math.max(0,Number(f.price)||0),priceText:null,qty:Math.max(1,Number(f.qty)||1),consumable:false,equipSlot:null,description:String(f.description||'').trim(),custom:true,trainerUsable,pokemonHeldUsable:f.pokemonHeldUsable==='yes',equipmentSlots:trainerUsable?[String(f.equipmentSlot||'accessory')]:[],mechanics,config:{}});
  commit(`${name} added to the Backpack.`);
}

function isWeaponStoreItem(item){
  const shops=Array.isArray(item?.shopCategories)?item.shopCategories:[];
  return item?.shopVisible!==false && (shops.includes('Weapon Store') || (item?.contentPackId==='campaign-homebrew-custom-weapons' && item?.mechanics?.kind==='weapon'));
}
function isGearStoreItem(item){
  const shops=Array.isArray(item?.shopCategories)?item.shopCategories:[];
  return item?.shopVisible!==false && (shops.includes('Gear Store') || item?.contentPackId==='campaign-homebrew-trainer-gear');
}
function isCatalogStore(name){return name==='Weapon Store'||name==='Gear Store';}
function matchesCurrentStore(item,name=state.shop?.preset){return name==='Weapon Store'?isWeaponStoreItem(item):name==='Gear Store'?isGearStoreItem(item):true;}
function shopLookupItem(id){
  return inventoryItem(id) || itemCatalogState.items.find(i=>i.id===id||i.definitionId===id) || null;
}
function currentShopCatalog(){
  const shop=state.shop;
  if(shop.mode==='sell') return state.inventory.filter(i=>Number(i.qty||0)>0 && (!isCatalogStore(shop.preset)||matchesCurrentStore(i,shop.preset)));
  if(isCatalogStore(shop.preset)) return itemCatalogState.items.filter(i=>matchesCurrentStore(i,shop.preset));
  return state.inventory;
}
function ensureCatalogStore(){
  if(!isCatalogStore(state.shop?.preset)||itemCatalogState.loading||itemCatalogState.items.length)return;
  loadItemCatalog().then(()=>{if(state.ui.screen==='shop'&&isCatalogStore(state.shop.preset))render();});
}

function shopScreen(){
  const shop=state.shop; const cart=shop.cart; const shopItems=currentShopCatalog();
  if(isCatalogStore(shop.preset))ensureCatalogStore();
  const subtotal=Object.entries(cart).reduce((sum,[id,q])=>sum+(shopLookupItem(id)?.price||0)*q,0); const total=Math.max(0,Math.round(subtotal*(1+shop.discountPct/100)));
  const catalogHtml=isCatalogStore(shop.preset)&&shop.mode==='buy'&&!shopItems.length
    ? `<div class="loading-card compact-loading"><span class="spinner"></span><strong>${itemCatalogState.error?esc(itemCatalogState.error):`Loading ${esc(shop.preset)} catalog…`}</strong></div>`
    : shopItems.map(i=>{const pct=shop.mode==='sell'?-50:shop.discountPct; const unit=Math.max(0,Math.round(Number(i.price||0)*(1+pct/100))); const owned=Number(inventoryItem(i.id)?.qty||0); return `<article class="shop-item">${itemIconHtml(i.icon,'◆','shop-item-art')}<div><h3>${esc(i.name)}</h3><p>${i.mechanics?.kind==='weapon'?`${esc(i.mechanics.quality||'Weapon')} · ${esc(String(i.mechanics.weaponClass||'').replaceAll('_',' '))} · ${i.mechanics.hands===2?'Two-Handed':'One-Handed'}${i.mechanics.weaponMoves?.adept?` · Adept: ${esc(i.mechanics.weaponMoves.adept)}`:''}${i.mechanics.weaponMoves?.master?` · Master: ${esc(i.mechanics.weaponMoves.master)}`:''}`:shop.mode==='buy'?(itemDescription(i)||'Trainer equipment.'):`Backpack quantity: ${owned}`}</p></div>${chip(`${pct>0?'+':''}${pct}%`,pct<=0?'chip-green':'chip-red')}<div class="price-line"><small>Base ₽${Number(i.price||0).toLocaleString()}</small><strong>₽${unit.toLocaleString()}</strong></div><button class="btn btn-primary" onclick="addCart('${i.id}')" ${shop.mode==='sell'&&owned<=0?'disabled':''}>＋ Cart</button></article>`}).join('');
  const cartHtml=subtotal?Object.entries(cart).map(([id,q])=>{const i=shopLookupItem(id);if(!i)return '';return `<div>${itemIconHtml(i.icon,'◆','cart-item-art')}<strong>${esc(i.name)}</strong><b>×${q}</b><em>₽${Number(i.price||0)*q}</em><button class="icon-btn" onclick="removeCart('${id}')">×</button></div>`}).join(''):'<div class="empty-cart">🛒<p>Your cart is empty.</p></div>';
  return `<div class="page">${heading('SHOP',esc(shop.preset),'Cart, pricing and inventory transactions now modify saved campaign state.',`<div class="segmented"><button class="${shop.mode==='buy'?'active':''}" onclick="setShopMode('buy')">Buy</button><button class="${shop.mode==='sell'?'active':''}" onclick="setShopMode('sell')">Sell</button></div>`)}<div class="shop-presets"><button class="${shop.preset==='Poké Mart'?'active':''}" onclick="setShopPreset('Poké Mart',0)">Poké Mart</button><button class="${shop.preset==='Weapon Store'?'active':''}" onclick="setShopPreset('Weapon Store',0)">⚔ Weapon Store</button><button class="${shop.preset==='Gear Store'?'active':''}" onclick="setShopPreset('Gear Store',0)">🛡 Gear Store</button><button class="${shop.preset==='Black Market'?'active':''}" onclick="setShopPreset('Black Market',25)">Black Market</button><button class="${shop.preset==='Special Deals'?'active':''}" onclick="setShopPreset('Special Deals',-15)">Special Deals</button></div>
  ${isCatalogStore(shop.preset)?`<div class="flow-note"><strong>${esc(shop.preset)}:</strong> ${shop.mode==='buy'?`${shopItems.length} ${shop.preset==='Weapon Store'?'weapon':'equipment'} definitions from enabled Content Packs are available for purchase.`:`Only owned ${esc(shop.preset)} items are shown for sale.`}</div>`:''}
  <div class="shop-layout"><div class="shop-catalog">${catalogHtml}</div>
  ${section(`${shop.mode==='buy'?'CHECKOUT':'SELL ORDER'} · ₽${trainer().money.toLocaleString()} available`,`<div class="cart-list">${cartHtml}</div><label class="discount-control">Transaction modifier <input type="number" value="${shop.mode==='sell'?-50:shop.discountPct}" onchange="setShopDiscount(Number(this.value))" ${shop.mode==='sell'?'disabled':''}/> %</label><div class="checkout-total"><span>Base subtotal</span><b>₽${subtotal}</b><span>TOTAL</span><strong>₽${total}</strong>${shop.mode==='buy'?`<span>After purchase</span><b class="${trainer().money-total<0?'negative':''}">₽${trainer().money-total}</b>`:`<span>After sale</span><b>₽${trainer().money+total}</b>`}</div><button class="btn btn-success full" onclick="checkout()" ${!subtotal?'disabled':''}>✓ ${shop.mode==='buy'?'Checkout':'Sell Items'}</button>`)}
  </div></div>`;
}

function npcsScreen(){
  const n=state.npcs.find(x=>x.id===state.selectedNpcId)||state.npcs[0];
  if(!n)return `<div class="page">${heading('NPC JOURNAL','People & Campaign Notes','Create, edit and persist campaign NPC notes.','<button class="btn btn-primary" onclick="addNpc()">＋ Add NPC</button>')}${section('NPCS','<div class="empty-state"><p>No NPCs recorded for this Trainer yet.</p><button class="btn btn-primary" onclick="addNpc()">＋ Add first NPC</button></div>')}</div>`;
  return `<div class="page">${heading('NPC JOURNAL','People & Campaign Notes','Create, edit and persist campaign NPC notes.','<button class="btn btn-primary" onclick="addNpc()">＋ Add NPC</button>')}<div class="npc-layout">
  ${section('NPCS',`<div class="npc-list">${state.npcs.map(x=>`<button class="${x.id===n.id?'active':''}" onclick="selectNpc('${x.id}')">${personPortrait(x,'npc-avatar')}<div><strong>${esc(x.name)}</strong><small>${esc(x.role)}</small></div>${chip(esc(x.tag),x.tag==='Ally'?'chip-green':x.tag==='Merchant'?'chip-yellow':'chip-blue')}</button>`).join('')}</div>`)}
  ${section('NPC DETAILS',`<div class="npc-hero">${personPortrait(n,'npc-avatar big')}<div><h2>${esc(n.name)}</h2><p>${esc(n.role)}</p>${chip(esc(n.tag),'chip-yellow')}</div></div><div class="npc-about"><h3>About</h3><p>${esc(n.description)}</p><dl><div><dt>Affiliation</dt><dd>${esc(n.affiliation)}</dd></div><div><dt>Last Seen</dt><dd>${esc(n.lastSeen)}</dd></div></dl></div><div class="row-gap"><button class="btn btn-primary" onclick="editNpc('${n.id}')">Edit NPC</button><label class="btn btn-ghost file-label portrait-upload">📷 Portrait<input type="file" accept="image/jpeg,image/png,image/webp" onchange="uploadNpcPortrait('${n.id}',this)"/></label>${n.portraitDataUrl?`<button class="btn btn-ghost" onclick="removeNpcPortrait('${n.id}')">Remove portrait</button>`:''}<button class="btn btn-danger" onclick="deleteNpc('${n.id}')">Delete</button></div>`)}
  ${section('NOTES',`<div class="sticky-grid">${n.notes.map((note,idx)=>`<div class="sticky s${idx%4}">${esc(note)}<small>Campaign note</small></div>`).join('')}<button class="sticky add" onclick="addNpcNote('${n.id}')">＋ Add note</button></div>`)}
  </div></div>`;
}

function levelupScreen(){
  const t=trainer(), ps=trainerProgressState, p=ps.preview, d=ps.draft||blankTrainerProgressDraft();
  if(ps.loading&&!p)return `<div class="page">${heading('TRAINER PROGRESSION',`Trainer Level ${t.level} → ${Math.min(50,t.level+1)}`,'Loading PTU progression rewards from the active Ruleset…')}<div class="loading-card"><span class="spinner"></span><strong>Resolving level rewards and prerequisites…</strong></div></div>`;
  if(ps.error&&!p)return `<div class="page">${heading('TRAINER PROGRESSION','Rules Engine unavailable','The guided level-up could not be resolved.')}<div class="builder-validation bad">${esc(ps.error)}</div><button class="btn btn-primary" onclick="refreshTrainerProgressionPreview()">Retry</button></div>`;
  if(!p)return `<div class="page">${heading('TRAINER PROGRESSION',`Trainer Level ${t.level}`,'Open the guided PTU level-up wizard to continue.')}<button class="btn btn-primary" onclick="beginTrainerProgression()">Start Progression</button></div>`;
  const r=p.rewards||{}; const milestone=r.milestone||{};
  const normalSpent=TRAINER_STAT_KEYS.reduce((sum,k)=>sum+Number(d.statAllocations?.[k]||0),0);
  const offenseSpent=Number(d.offensiveStatAllocations?.attack||0)+Number(d.offensiveStatAllocations?.spAttack||0);
  const chosenCards=(kind,list)=> (list||[]).map((x,i)=>`<article class="progress-selected-card"><div><strong>${esc(x.name||x.id)}</strong>${x.manualConfirm?chip('MANUAL CONFIRMED','chip-yellow'):''}<small>${kind==='features'?'Feature':kind==='skillEdges'?'Bonus Skill Edge':'Edge'}${x.rank>1?` · Rank ${x.rank}`:''}</small></div><button class="icon-btn danger" onclick="removeTrainerProgressChoice('${kind}',${i})" title="Remove">×</button></article>`).join('')||'<p class="muted">No selection required/recorded.</p>';
  const statRows=TRAINER_STAT_KEYS.map(k=>`<div class="progress-stat-row"><span>${prettyStat(k)}</span><b>${Number(t.stats?.[k]||0)}</b><div class="stepper compact"><button onclick="adjustTrainerProgressStat('${k}',-1,false)" ${Number(d.statAllocations?.[k]||0)<=0?'disabled':''}>−</button><strong>+${Number(d.statAllocations?.[k]||0)}</strong><button onclick="adjustTrainerProgressStat('${k}',1,false)" ${normalSpent>=Number(r.baseStatPoints||0)?'disabled':''}>＋</button></div><em>${Number(t.stats?.[k]||0)+Number(d.statAllocations?.[k]||0)+((k==='attack'||k==='spAttack')?Number(d.offensiveStatAllocations?.[k]||0):0)}</em></div>`).join('');
  const milestoneHtml=milestone.required?`<div class="milestone-choice-grid">${(milestone.options||[]).map(o=>`<button class="milestone-choice ${d.milestoneChoice===o.id?'selected':''}" onclick="setTrainerMilestoneChoice('${o.id}')"><span>${d.milestoneChoice===o.id?'✓':'◇'}</span><div><strong>${esc(o.label)}</strong><small>${esc(o.description)}</small></div></button>`).join('')}</div>`:`<div class="flow-note"><strong>No milestone choice at Level ${p.nextLevel}.</strong> Standard level rewards apply.</div>`;
  const rewardPills=[`+${r.baseStatPoints||0} Stat Point`,r.featureCount?`+${r.featureCount} Feature${r.featureCount>1?'s':''}`:null,r.edgeCount?`+${r.edgeCount} Edge${r.edgeCount>1?'s':''}`:null,r.skillEdgeCount?`+${r.skillEdgeCount} Bonus Skill Edge`:null,r.generalFeatureCount?`+${r.generalFeatureCount} General Feature`:null,r.milestoneEdgeCount?`+${r.milestoneEdgeCount} Milestone Edges`:null,r.offensiveStatPoints?`+${r.offensiveStatPoints} Attack/Sp. Atk Stat Point${r.offensiveStatPoints>1?'s':''}`:null,r.skillRankUnlock?`${r.skillRankUnlock} Skills unlocked`:null].filter(Boolean);
  const validation=p.valid?`<div class="builder-validation good"><strong>✓ Ready to advance to Level ${p.nextLevel}</strong><span>All deterministic PTU rewards and selected prerequisites validate.</span></div>`:`<div class="builder-validation bad"><strong>Progression needs attention</strong><ul>${(p.errors||[]).map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`;
  return `<div class="page">${heading('TRAINER PROGRESSION',`Level ${t.level} → ${p.nextLevel}`,'Guided PTU advancement: exact level rewards, prerequisite checks, milestone choices and persistent history.','<button class="btn btn-ghost" onclick="cancelTrainerProgression()">Cancel</button>')}
  <div class="trainer-progress-hero"><div><span class="eyebrow">LEVEL REWARDS</span><h2>${esc(t.name)}</h2><p>Trainer XP Bank: <strong>${Number(t.exp||0)}</strong> · ${p.milestoneLevelUp?'Milestone Level Up · 0 XP':'Normal Level Up · spends 10 XP'} · projected remainder ${Math.max(0,Number(t.exp||0)-Number(p.xpCost||0))} XP.</p>${state.ui.gmOverride?`<div class="levelup-source-toggle"><button class="btn ${!d.milestoneLevelUp?'btn-primary':'btn-ghost'} btn-small" onclick="setTrainerLevelUpMode('xp')">Spend 10 XP</button><button class="btn ${d.milestoneLevelUp?'btn-gold':'btn-ghost'} btn-small" onclick="setTrainerLevelUpMode('milestone')">GM Milestone · 0 XP</button></div>`:''}</div><div class="reward-pill-wrap">${rewardPills.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>
  <div class="trainer-progress-layout">
    ${section('1 · MILESTONE BONUS',milestoneHtml)}
    ${section('2 · STAT POINT',`<div class="progress-stat-list" role="region" tabindex="0" aria-label="Trainer stat allocation table. Swipe horizontally to view all columns.">${statRows}</div><div class="budget-line"><span>Normal Stat budget</span><strong class="${normalSpent===Number(r.baseStatPoints||0)?'positive':'negative'}">${normalSpent} / ${r.baseStatPoints||0}</strong></div>${r.offensiveStatPoints?`<div class="offense-allocation"><h4>Milestone Offensive Stat Points</h4><p>These points may only be spent on Attack or Special Attack.</p><div class="offense-stat-grid">${['attack','spAttack'].map(k=>`<div><span>${prettyStat(k)}</span><div class="stepper"><button onclick="adjustTrainerProgressStat('${k}',-1,true)" ${Number(d.offensiveStatAllocations?.[k]||0)<=0?'disabled':''}>−</button><strong>+${Number(d.offensiveStatAllocations?.[k]||0)}</strong><button onclick="adjustTrainerProgressStat('${k}',1,true)" ${offenseSpent>=Number(r.offensiveStatPoints||0)?'disabled':''}>＋</button></div></div>`).join('')}</div><div class="budget-line"><span>Offensive budget</span><strong class="${offenseSpent===Number(r.offensiveStatPoints||0)?'positive':'negative'}">${offenseSpent} / ${r.offensiveStatPoints}</strong></div></div>`:''}`)}
    ${r.totalFeatures?section(`3 · FEATURES · ${d.features.length}/${r.totalFeatures}`,`<div class="progress-selected-list">${chosenCards('features',d.features)}</div><div class="row-gap">${d.features.length<r.totalFeatures?`<button class="btn btn-primary" onclick="openTrainerProgressionPicker('feature')">＋ Choose Feature</button>`:''}${r.generalFeatureCount&&d.features.length<r.totalFeatures?`<button class="btn btn-gold" onclick="openTrainerProgressionPicker('generalFeature')">＋ Choose General Feature</button>`:''}</div><p class="muted">Prerequisites are evaluated against the projected post-level-up sheet. Choice-based effects are configured before the Feature is added.</p>`):''}
    ${(r.totalEdges||r.totalSkillEdges)?section(`4 · EDGES · ${(d.edges.length+d.skillEdges.length)}/${(r.totalEdges||0)+(r.totalSkillEdges||0)}`,`${r.totalEdges?`<h4>Regular / Milestone Edges · ${d.edges.length}/${r.totalEdges}</h4><div class="progress-selected-list">${chosenCards('edges',d.edges)}</div>${d.edges.length<r.totalEdges?`<button class="btn btn-primary" onclick="openTrainerProgressionPicker('edge')">＋ Choose Edge</button>`:''}`:''}${r.totalSkillEdges?`<h4 class="subhead">Bonus Skill Edge · ${d.skillEdges.length}/${r.totalSkillEdges}</h4><div class="progress-selected-list">${chosenCards('skillEdges',d.skillEdges)}</div>${d.skillEdges.length<r.totalSkillEdges?`<button class="btn btn-purple" onclick="openTrainerProgressionPicker('skillEdge')">＋ Choose Skill Edge</button>`:''}<p class="muted">The Level ${p.nextLevel} bonus Skill Edge cannot be used to purchase the Skill Rank unlocked at that same milestone.</p>`:''}`):''}
    ${section('5 · VALIDATION & APPLY',`${validation}<dl class="summary-dl"><div><dt>New Level</dt><dd>${p.nextLevel}</dd></div><div><dt>XP Cost</dt><dd>${Number(p.xpCost||0)}</dd></div><div><dt>XP After</dt><dd>${Math.max(0,Number(t.exp||0)-Number(p.xpCost||0))}</dd></div><div><dt>Normal Stat Point</dt><dd>${normalSpent}/${r.baseStatPoints||0}</dd></div><div><dt>Features</dt><dd>${d.features.length}/${r.totalFeatures||0}</dd></div><div><dt>Edges</dt><dd>${d.edges.length}/${r.totalEdges||0}</dd></div><div><dt>Bonus Skill Edges</dt><dd>${d.skillEdges.length}/${r.totalSkillEdges||0}</dd></div>${milestone.required?`<div><dt>Milestone</dt><dd>${esc((milestone.options||[]).find(x=>x.id===d.milestoneChoice)?.label||'Not selected')}</dd></div>`:''}</dl><button class="btn btn-success full" onclick="applyTrainerProgression()" ${p.valid?'':'disabled'}>${p.milestoneLevelUp?'✓ Apply Milestone Level':'✓ Apply Level '+p.nextLevel+' · Spend '+Number(p.xpCost||0)+' XP'}</button><div class="flow-note"><strong>GM Override:</strong> ${state.ui.gmOverride?'ON — prerequisite and class-cap validation may be bypassed.':'OFF — active Ruleset prerequisites are enforced where they can be evaluated deterministically.'}</div>`) }
  </div></div>`;
}

function definitionArtworkSrc(d){
  if(!d)return '';
  const raw=d.raw||{};
  if(d.kind==='species'){
    if(window.PTU_ANDROID_BUILD){
      const packed=window.__PTU_SPECIES_PORTRAIT__?.(d.id); if(packed)return packed;
      const slug=String(d.id||d.name||'').toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'');
      return slug?`https://play.pokemonshowdown.com/sprites/gen5/${encodeURIComponent(slug)}.png`:'';
    }
    return d.id?`/api/pokemon/portrait/${encodeURIComponent(d.id)}`:'';
  }
  return String(d.artwork||d.icon||d.image||d.portraitDataUrl||raw.icon_data_url||raw.icon_url||raw.image_data_url||raw.image_url||raw.artwork_url||raw.portrait_data_url||'').trim();
}
function definitionArtworkHtml(d,{detail=false}={}){
  const src=definitionArtworkSrc(d); if(!src)return '';
  const cls=detail?'definition-artwork-detail':'definition-artwork-thumb';
  return `<span class="${cls}"><img src="${esc(src)}" loading="lazy" alt="${esc(d.name||'Definition')}" onerror="this.closest('span').hidden=true"/></span>`;
}
function definitionModalBody(d){
  const facts=[];
  if(d.type)facts.push(['Type',d.type]); if(d.category)facts.push(['Category',d.category]); if(d.frequency)facts.push(['Frequency',d.frequency]);
  if(d.damageBase!=null)facts.push(['Damage Base',d.damageBase]); if(d.ac!=null)facts.push(['AC',d.ac]); if(d.range)facts.push(['Range',d.range]);
  let body=`<div class="rule-reference-hero">${definitionArtworkHtml(d,{detail:true})}<div><h3>${esc(d.name||d.id)}</h3><small>${esc(d.kind||'PTU definition')}${d.sourcePage?` · p. ${esc(d.sourcePage)}`:''}</small></div></div>`;
  if(facts.length)body+=`<dl class="detail-dl rule-reference-facts">${facts.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  if(d.prerequisites)body+=`<div class="definition-section-label">PREREQUISITES</div><div class="definition-text">${esc(d.prerequisites)}</div>`;
  if(d.effect)body+=`<div class="definition-section-label">EFFECT</div><div class="definition-text">${esc(d.effect)}</div>`;
  if(d.rawText&&!d.effect)body+=`<div class="definition-section-label">SOURCE TEXT</div><div class="definition-text">${esc(d.rawText)}</div>`;
  body+=`<div class="definition-section-label">SOURCE</div><div class="definition-text">${esc(d.packName||d.contentPackId||d.sourceId||'Active Ruleset')}${d.sourcePage?` · page ${esc(d.sourcePage)}`:''}</div>`;
  return body;
}
async function openRuleDefinitionModal(kind,id,title='Rule Reference'){
  if(kind==='move_keywords'){openMoveKeywordInfo(id);return;}
  if(!id)return toast('No linked definition is available for this entry.','error');
  try{
    const response=await fetch(`/api/definitions/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`,{cache:'no-store'});
    const payload=await response.json().catch(()=>({})); if(!response.ok)throw new Error(payload.error||'Definition unavailable');
    const d=payload.definition||payload; modal(definitionModalBody(d),{title,subtitle:'Resolved from the active Campaign Ruleset.'});
  }catch(error){toast(error.message||'Definition unavailable.','error');}
}
function definitionSummaryText(d){
  if(d.kind==='species') return `${d.type||'Unknown type'}${d.completeness?` · ${d.completeness}`:''}`;
  if(d.kind==='moves') return `${d.type||'—'} · ${d.category||'—'}${d.damageBase!=null?` · DB ${d.damageBase}`:''}${d.ac!=null?` · AC ${d.ac}`:''}`;
  if(d.kind==='items') return `${d.category||'Item'}${d.price!=null?` · ₽${Number(d.price).toLocaleString()}`:''}`;
  return [d.parentClass,d.category,d.frequency].filter(Boolean).join(' · ') || 'PTU definition';
}
function definitionRow(d){
  const tags=[];
  if(d.type) tags.push(`<span class="chip chip-blue">${esc(d.type)}</span>`);
  if(d.category) tags.push(`<span class="chip">${esc(d.category)}</span>`);
  if(d.needsReview) tags.push(`<span class="chip chip-yellow">REVIEW</span>`);
  if(d.pinned) tags.push(`<span class="chip chip-purple">PINNED</span>`);
  return `<button class="definition-row ${catalogState.selected?.definition?.id===d.id?'selected':''}" onclick="loadDefinitionDetail('${esc(d.id)}')">${definitionArtworkHtml(d)}<div class="definition-row-copy"><h3>${esc(d.name)}</h3><div class="definition-row-meta">${tags.join('')}</div><p>${esc(d.effect||definitionSummaryText(d))}</p></div><div class="definition-source"><strong>${esc(d.packName||d.contentPackId)}</strong>${d.sourcePage?`<br/>p. ${d.sourcePage}`:''}</div></button>`;
}
function definitionDetail(){
  const payload=catalogState.selected; if(!payload?.definition) return `<div class="definition-detail-empty"><div><h3>Select a definition</h3><p>Its resolved version and source history will appear here.</p></div></div>`;
  const d=payload.definition, versions=payload.versions||[], raw=d.raw||{};
  let body='';
  if(d.kind==='move_keywords'){
    body+=`<div class="definition-tags">${chip('MOVE KEYWORD','chip-blue')} ${chip(`PTU Core 1.05 · p. ${d.sourcePage}`,'chip-neutral')}</div>`;
    body+=`<div class="definition-section-label">DESCRIPTION</div><div class="definition-text">${esc(d.effect||'')}</div>`;
    if(d.reference)body+=`<div class="definition-section-label">REFERENCE</div><div class="definition-text">${esc(d.reference)}</div>`;
  } else if(d.kind==='species'){
    const stats=d.baseStats||{};
    body+=`<div class="definition-status">${(d.types||[]).map(t=>typeBadge(String(t).toLowerCase())).join(' ')} ${d.enabledForCreation===false?chip('BROWSE ONLY','chip-yellow'):chip('CREATION READY','chip-green')} ${d.completeness?chip(esc(d.completeness)):''}</div>`;
    body+=`<div class="definition-stat-grid">${[['HP',stats.hp],['Attack',stats.attack],['Defense',stats.defense],['Sp. Atk',stats.special_attack],['Sp. Def',stats.special_defense],['Speed',stats.speed]].map(([k,v])=>`<div><small>${k}</small><strong>${v??'—'}</strong></div>`).join('')}</div>`;
    if((d.abilities||[]).length) body+=`<div class="definition-section-label">ABILITY SLOTS</div><div class="definition-tags">${d.abilities.map(a=>`<span>${esc(a.slot||'Ability')}: <b>${esc(a.name||a.ability_id||'—')}</b></span>`).join('')}</div>`;
    if(raw.evolution_text||d.evolutionText) body+=`<div class="definition-section-label">EVOLUTION</div><div class="definition-text">${esc(raw.evolution_text||d.evolutionText)}</div>`;
    if((d.levelUpMoves||[]).length) body+=`<div class="definition-section-label">LEVEL-UP MOVE PREVIEW</div><div class="definition-tags">${d.levelUpMoves.slice(0,12).map(m=>`<span>Lv ${esc(m.level)} · ${esc(m.move)}</span>`).join('')}</div>`;
    if(d.capabilitiesText) body+=`<div class="definition-section-label">CAPABILITIES</div><div class="definition-text">${esc(d.capabilitiesText)}</div>`;
    if(d.skillsText) body+=`<div class="definition-section-label">SKILLS</div><div class="definition-text">${esc(d.skillsText)}</div>`;
  } else {
    const facts=[];
    if(d.type) facts.push(['Type',d.type]); if(d.category) facts.push(['Category',d.category]); if(d.frequency) facts.push(['Frequency',d.frequency]); if(d.damageBase!=null) facts.push(['Damage Base',d.damageBase]); if(d.ac!=null) facts.push(['AC',d.ac]); if(d.range) facts.push(['Range',d.range]); if(d.price!=null) facts.push(['Price',`₽${Number(d.price).toLocaleString()}`]);
    if(facts.length) body+=`<div class="definition-stat-grid">${facts.map(([k,v])=>`<div><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join('')}</div>`;
    if(d.prerequisites) body+=`<div class="definition-section-label">PREREQUISITES</div><div class="definition-text">${esc(d.prerequisites)}</div>`;
    if(d.effect) body+=`<div class="definition-section-label">EFFECT</div><div class="definition-text">${esc(d.effect)}</div>`;
    if(d.rawText && !d.effect) body+=`<div class="definition-section-label">SOURCE TEXT</div><div class="definition-text">${esc(d.rawText)}</div>`;
    if(d.semanticAutomation) body+=`<div class="definition-section-label">SEMANTIC AUTOMATION</div><div class="definition-tags"><span>${esc(d.semanticAutomation.level||'unknown')}</span><span>Prereq: ${esc(d.semanticAutomation.prerequisite_status||'—')}</span><span>Effect: ${esc(d.semanticAutomation.effect_coverage||'—')}</span></div>`;
  }
  if(d.kind==='species' && d.enabledForCreation!==false) body+=`<div class="definition-action-row"><button class="btn btn-success" onclick="beginPokemonBuilder('${esc(d.id)}')">＋ Create Pokémon from ${esc(d.name)}</button></div>`;
  body+=`<div class="definition-section-label">ACTIVE SOURCE</div><div class="definition-text"><strong>${esc(d.packName||d.contentPackId)}</strong>${d.sourcePage?` · page ${d.sourcePage}`:''}<br/><small>${esc(d.versionId)}</small></div>`;
  if(versions.length>1) body+=`<div class="definition-section-label">AVAILABLE VERSIONS (${versions.length})</div><div class="definition-tags">${versions.map(v=>`<span title="${esc(v.versionId)}">${esc(v.packName||v.contentPackId)}</span>`).join('')}</div>`;
  return `<div class="definition-hero"><div class="definition-hero-main">${definitionArtworkHtml(d,{detail:true})}<div><h2>${esc(d.name)}</h2><p>${esc(d.id)} · ${esc(d.kind)}</p></div></div>${d.needsReview?chip('NEEDS REVIEW','chip-yellow'):chip('RESOLVED','chip-green')}</div>${body}`;
}
function libraryScreen(){
  if(!catalogState.available && !catalogState.loading){
    return `<div class="page">${heading('REAL PTU DATA','Pokédex & Rules Library','This screen reads the prepared PTU definition database through the active Campaign Ruleset.')}<div class="alert alert-danger">The definition database is available when the app is started with <strong>RUN_FUNCTIONAL_PREVIEW.bat</strong>. Direct-file browser mode keeps campaign mocks but cannot query SQLite.</div><button class="btn btn-primary" onclick="loadCatalogStatus().then(()=>refreshDefinitionRows())">Retry connection</button></div>`;
  }
  const st=catalogState.status||{}, active=st.ruleset||{}; const counts=st.counts||{};
  return `<div class="page">${heading('REAL PTU DATA','Pokédex & Rules Library','Resolved definitions now come from the v1.0 PTU seed database instead of UI mock data.',catalogState.loading?chip('LOADING','chip-yellow'):chip('SQLITE + RULESET','chip-green'))}
    <div class="ruleset-summary"><div class="row-between"><div><strong>Active Ruleset</strong><div>${esc(active.name||st.activeRulesetId||'Loading...')}</div></div><small>${esc(active.description||'Highest enabled priority resolves each logical definition.')}</small></div><div class="catalog-counts">${DEFINITION_KINDS.map(([k,l])=>`<span><b>${k==='move_keywords'?MOVE_KEYWORD_CATALOG.length:(counts[k]??'—')}/* kind==='move_keywords'?MOVE_KEYWORD_CATALOG.length */</b> ${l}</span>`).join('')}</div></div>
    ${contentPackManager()}
    <div class="definition-toolbar"><label>Search definitions<input id="definition-search-input" value="${esc(catalogState.query)}" oninput="setDefinitionQuery(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();clearTimeout(catalogQueryTimer);refreshDefinitionRows({keepSelection:true,preserveSearchFocus:true})}" placeholder="Search by name, effect, type..." autocomplete="off"/></label><label>Campaign Ruleset<select onchange="setActiveRuleset(this.value)">${catalogState.rulesets.map(r=>`<option value="${esc(r.id)}" ${r.id===st.activeRulesetId?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label><button class="btn btn-primary definition-refresh" onclick="refreshDefinitionRows({keepSelection:true})">↻ Refresh</button></div>
    <div class="definition-kind-tabs">${DEFINITION_KINDS.map(([k,l])=>`<button class="${catalogState.kind===k?'active':''}" onclick="setDefinitionKind('${k}')">${l}</button>`).join('')}</div>
    <div class="definition-layout">${section(`RESOLVED ${DEFINITION_KINDS.find(x=>x[0]===catalogState.kind)?.[1]?.toUpperCase()||''} · ${catalogState.total}`,catalogState.error?`<div class="alert alert-danger">${esc(catalogState.error)}</div>`:`<div class="definition-list">${catalogState.loading?'<p class="muted">Resolving active versions…</p>':catalogState.rows.map(definitionRow).join('')||'<p class="muted">No matching definitions.</p>'}</div>`)}${section('RESOLVED DETAIL',definitionDetail())}</div>
  </div>`;
}

function blankPokemonAllocations(){ return {hp:0,attack:0,defense:0,special_attack:0,special_defense:0,speed:0}; }
function builderResetForm(definition=null){
  const d=definition?.definition||definition||null;
  const firstBasic=(d?.abilities||[]).find(a=>(a?.slot_category||'').toLowerCase()==='basic' && (a?.name||a?.ability_id));
  pokemonBuilderState.preview=null; pokemonBuilderState.formResolution=null; pokemonBuilderState.resolvedSpecies=null;
  pokemonBuilderState.form={
    nickname:d?.name||'',level:1,ball:'Poké Ball',loyalty:3,gender:'None',nature:'Hardy',location:'carried',
    allocations:blankPokemonAllocations(),selectedAbilities:firstBasic?[firstBasic.name||firstBasic.ability_id]:[],selectedMoves:[],gmMoves:[],moveLimitModifier:0,baseFormId:'base',manualFormApprovals:[],isShiny:false
  };
  pokemonBuilderState.movesTouched=false;
}
async function refreshPokemonBuilderSpecies({preserveFocus=false}={}){
  if(!catalogState.available){ await loadCatalogStatus(); }
  if(!catalogState.available){ pokemonBuilderState.error='Definition database unavailable. Start with RUN_FUNCTIONAL_PREVIEW.bat.'; render(); return; }
  const seq=++pokemonBuilderRequestSeq, query=pokemonBuilderState.query;
  pokemonBuilderState.loading=true; pokemonBuilderState.error=null;
  if(!preserveFocus) render();
  try{
    const params=new URLSearchParams({kind:'species',q:query,limit:'60'});
    const response=await fetch(`/api/definitions?${params}`,{cache:'no-store'});
    if(!response.ok) throw new Error('Could not search species');
    const payload=await response.json();
    if(seq!==pokemonBuilderRequestSeq || query!==pokemonBuilderState.query) return;
    pokemonBuilderState.rows=payload.rows||[]; pokemonBuilderState.total=payload.total||0;
  }catch(error){ if(seq!==pokemonBuilderRequestSeq)return; pokemonBuilderState.error=error.message; pokemonBuilderState.rows=[]; pokemonBuilderState.total=0; }
  if(seq!==pokemonBuilderRequestSeq)return;
  pokemonBuilderState.loading=false; render();
  if(preserveFocus) requestAnimationFrame(()=>{const el=document.getElementById('pokemon-builder-search');if(el){el.focus();const n=el.value.length;try{el.setSelectionRange(n,n)}catch{}}});
}
function setPokemonBuilderQuery(value){ pokemonBuilderState.query=value; clearTimeout(pokemonBuilderTimer); pokemonBuilderTimer=setTimeout(()=>refreshPokemonBuilderSpecies({preserveFocus:true}),450); }
async function selectPokemonBuilderSpecies(id){
  try{
    const response=await fetch(`/api/definitions/species/${encodeURIComponent(id)}`,{cache:'no-store'});
    if(!response.ok) throw new Error('Species definition unavailable');
    pokemonBuilderState.selected=await response.json(); builderResetForm(pokemonBuilderState.selected); render();
    await refreshPokemonBuildPreview({autoAllocate:true,autoMoves:true});
  }catch(error){ pokemonBuilderState.error=error.message; render(); }
}
async function beginPokemonBuilder(id=null){
  pokemonBuilderState={query:'',rows:[],total:0,selected:null,loading:false,error:null,preview:null,previewLoading:false,formResolution:null,resolvedSpecies:null,gmMoveQuery:'',gmMoveRows:[],gmMoveLoading:false,movesTouched:false,form:{nickname:'',level:1,ball:'Poké Ball',loyalty:3,gender:'None',nature:'Hardy',location:'carried',allocations:blankPokemonAllocations(),selectedAbilities:[],selectedMoves:[],gmMoves:[],moveLimitModifier:0,baseFormId:'base',manualFormApprovals:[],isShiny:false}};
  state.ui.screen='pokemonbuilder'; persist();
  if(id){ await selectPokemonBuilderSpecies(id); }
  else { render(); refreshPokemonBuilderSpecies(); }
}
function schedulePokemonBuildPreview(){ clearTimeout(pokemonBuildPreviewTimer); pokemonBuildPreviewTimer=setTimeout(()=>refreshPokemonBuildPreview(),120); }
async function refreshPokemonBuildPreview({autoAllocate=false,autoMoves=false}={}){
  const d=pokemonBuilderState.selected?.definition; if(!d) return;
  const seq=++pokemonBuildPreviewSeq; const f=pokemonBuilderState.form;
  pokemonBuilderState.previewLoading=true;
  try{
    const response=await fetch('/api/pokemon/build-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      speciesId:d.id,rulesetId:catalogState.status?.activeRulesetId||null,level:Number(f.level)||1,nature:f.nature,gender:f.gender,
      formState:{baseFormId:f.baseFormId||'base',activeFormId:null},manualFormApprovals:f.manualFormApprovals||[],isShiny:!!f.isShiny,
      allocations:f.allocations,selectedAbilities:f.selectedAbilities,selectedMoves:f.selectedMoves,gmMoves:f.gmMoves||[],
      moveLimitModifier:Number(f.moveLimitModifier)||0,gmOverride:!!state.ui.gmOverride,autoAllocate,autoSelectMoves:!!autoMoves
    })});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){ pokemonBuilderState.formResolution=payload.formResolution||null; pokemonBuilderState.resolvedSpecies=payload.formResolution?.species||null; throw new Error((payload.formResolution?.errors||[]).join(' ')||payload.error||'Could not resolve Pokémon build'); }
    if(seq!==pokemonBuildPreviewSeq) return;
    const preview=payload.preview; pokemonBuilderState.formResolution=payload.formResolution||null; pokemonBuilderState.resolvedSpecies=payload.formResolution?.species||payload.species||null;
    pokemonBuilderState.experience=payload.experience||null;
    if(autoAllocate) f.allocations={...preview.statAllocations};
    f.selectedMoves=[...(preview.selectedMoves||[])];
    pokemonBuilderState.preview=preview;
    pokemonBuilderState.error=null;
  }catch(error){ if(seq!==pokemonBuildPreviewSeq)return; pokemonBuilderState.error=error.message; pokemonBuilderState.preview=null; }
  if(seq!==pokemonBuildPreviewSeq)return;
  pokemonBuilderState.previewLoading=false; render();
}
function setPokemonBuilderField(field,value){
  const f=pokemonBuilderState.form;
  if(field==='level') f.level=Math.max(1,Math.min(100,Number(value)||1));
  else if(field==='loyalty') f.loyalty=Math.max(0,Math.min(6,Number(value)||0));
  else if(field==='moveLimitModifier') f.moveLimitModifier=Number(value)||0;
  else f[field]=value;
  render();
  if(field==='level'){ clearTimeout(pokemonBuildPreviewTimer); pokemonBuildPreviewTimer=setTimeout(()=>refreshPokemonBuildPreview({autoMoves:!pokemonBuilderState.movesTouched}),120); }
  else if(['nature','moveLimitModifier','baseFormId','gender'].includes(field)) schedulePokemonBuildPreview();
}
function adjustPokemonBuilderStat(stat,delta){
  const a=pokemonBuilderState.form.allocations||(pokemonBuilderState.form.allocations=blankPokemonAllocations());
  a[stat]=Math.max(0,(Number(a[stat])||0)+Number(delta||0)); render(); schedulePokemonBuildPreview();
}
function autoAllocatePokemonBuilderStats(){ refreshPokemonBuildPreview({autoAllocate:true}); }
function setPokemonBuilderAbility(index,value){
  const arr=[...(pokemonBuilderState.form.selectedAbilities||[])]; arr[index]=value; pokemonBuilderState.form.selectedAbilities=arr.filter((v,i)=>i<=index || v); render(); schedulePokemonBuildPreview();
}
function togglePokemonBuilderMove(key){
  pokemonBuilderState.movesTouched=true;
  const arr=new Set(pokemonBuilderState.form.selectedMoves||[]); if(arr.has(key)) arr.delete(key); else arr.add(key); pokemonBuilderState.form.selectedMoves=[...arr]; render(); schedulePokemonBuildPreview();
}
async function searchPokemonBuilderGmMoves(){
  if(!state.ui.gmOverride) return toast('Enable GM Override to add an arbitrary Move.','error');
  const q=String(pokemonBuilderState.gmMoveQuery||'').trim();
  if(!q){ pokemonBuilderState.gmMoveRows=[]; render(); return; }
  pokemonBuilderState.gmMoveLoading=true; render();
  try{
    const params=new URLSearchParams({kind:'moves',q,limit:'30'});
    const response=await fetch(`/api/definitions?${params}`,{cache:'no-store'});
    if(!response.ok) throw new Error('Could not search Moves');
    const payload=await response.json(); pokemonBuilderState.gmMoveRows=payload.rows||[];
  }catch(error){ toast(error.message,'error'); }
  pokemonBuilderState.gmMoveLoading=false; render();
}
function setPokemonBuilderGmMoveQuery(value){ pokemonBuilderState.gmMoveQuery=value; }
function addPokemonBuilderGmMove(id,name,type=''){
  if(!state.ui.gmOverride) return toast('Enable GM Override to add an arbitrary Move.','error');
  const key=`gm:${id}`; const gmMoves=pokemonBuilderState.form.gmMoves||(pokemonBuilderState.form.gmMoves=[]);
  if(!gmMoves.some(m=>m.key===key)) gmMoves.push({key,id,name,type,source:'gm_override'});
  pokemonBuilderState.movesTouched=true;
  const selected=new Set(pokemonBuilderState.form.selectedMoves||[]); selected.add(key); pokemonBuilderState.form.selectedMoves=[...selected];
  render(); schedulePokemonBuildPreview();
}
function removePokemonBuilderGmMove(key){
  pokemonBuilderState.movesTouched=true;
  const gm=(pokemonBuilderState.form.gmMoves||[]).find(m=>m.key===key);
  const canonical=String(gm?.id||key.replace(/^gm:/,'')).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const previewMove=(pokemonBuilderState.preview?.eligibleMoves||[]).find(m=>m.key===canonical);
  const hasNonGmSource=(previewMove?.sources||[]).some(s=>s.sourceKind!=='gm_override');
  pokemonBuilderState.form.gmMoves=(pokemonBuilderState.form.gmMoves||[]).filter(m=>m.key!==key);
  if(!hasNonGmSource) pokemonBuilderState.form.selectedMoves=(pokemonBuilderState.form.selectedMoves||[]).filter(k=>k!==key && k!==canonical);
  render(); schedulePokemonBuildPreview();
}
function builderStatLabel(k){ return ({hp:'HP',attack:'Attack',defense:'Defense',special_attack:'Sp. Atk',special_defense:'Sp. Def',speed:'Speed'})[k]||k; }
function builderNatureOptions(current){
  const names=['Cuddly','Distracted','Proud','Decisive','Patient','Desperate','Lonely','Adamant','Naughty','Brave','Stark','Bold','Impish','Lax','Relaxed','Curious','Modest','Mild','Rash','Quiet','Dreamy','Calm','Gentle','Careful','Sassy','Skittish','Timid','Hasty','Jolly','Naive','Composed','Hardy','Docile','Bashful','Quirky','Serious'];
  return names.map(n=>`<option ${n===current?'selected':''}>${n}</option>`).join('');
}
function useRecommendedPokemonBuilderMoves(){
  pokemonBuilderState.movesTouched=false;
  refreshPokemonBuildPreview({autoMoves:true});
}

function pokemonFormRequirementText(node){
  if(!node)return 'No additional requirements.';
  if(Array.isArray(node.all))return node.all.map(pokemonFormRequirementText).filter(Boolean).join(' AND ');
  if(Array.isArray(node.any))return `One of: ${node.any.map(pokemonFormRequirementText).filter(Boolean).join(' OR ')}`;
  if(node.not)return `Not: ${pokemonFormRequirementText(node.not)}`;
  const value=node.value;
  const label=typeof value==='object'?(value?.label||value?.name||value?.id||value?.key||JSON.stringify(value)):value;
  return ({
    min_level:`Level ${Number(value)}+`,max_level:`Level ${Number(value)} or lower`,gender:`Gender: ${label}`,
    held_item:`Held Item: ${label}`,ability:`Ability: ${label}`,capability:`Capability: ${label}`,
    tag:`Tag: ${label}`,flag:`State flag: ${label}`,manual:`Manual confirmation: ${label}`,never:'Unavailable'
  })[String(node.kind||'').toLowerCase()]||`Requirement: ${label??node.kind??'custom condition'}`;
}
function pokemonFormApprovalKey(value){
  const raw=typeof value==='object'?(value?.id||value?.key||JSON.stringify(value)):value;
  return String(raw||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
function pokemonFormManualRequirements(node,out=[]){
  if(!node)return out;
  if(Array.isArray(node.all))node.all.forEach(child=>pokemonFormManualRequirements(child,out));
  else if(Array.isArray(node.any))node.any.forEach(child=>pokemonFormManualRequirements(child,out));
  else if(node.not)pokemonFormManualRequirements(node.not,out);
  else if(String(node.kind||'').toLowerCase()==='manual'){
    const value=node.value; const key=pokemonFormApprovalKey(value);
    if(key&&!out.some(x=>x.key===key))out.push({key,label:typeof value==='object'?(value?.label||value?.id||value?.key||'Manual condition'):String(value||'Manual condition')});
  }
  return out;
}
function setPokemonBuilderBaseForm(formId){
  pokemonBuilderState.form.baseFormId=formId||'base';
  pokemonBuilderState.form.manualFormApprovals=[];
  pokemonBuilderState.formResolution=null; pokemonBuilderState.resolvedSpecies=null;
  render(); refreshPokemonBuildPreview({autoMoves:!pokemonBuilderState.movesTouched});
}
function togglePokemonBuilderFormManualApproval(key,checked){
  const approvals=new Set(pokemonBuilderState.form.manualFormApprovals||[]);
  if(checked)approvals.add(String(key));else approvals.delete(String(key));
  pokemonBuilderState.form.manualFormApprovals=[...approvals];
  refreshPokemonBuildPreview({autoMoves:!pokemonBuilderState.movesTouched});
}

function pokemonBuilderScreen(){
  const selected=pokemonBuilderState.selected?.definition||null, f=pokemonBuilderState.form, pv=pokemonBuilderState.preview;
  const stats=selected?.baseStats||{}; const abilities=selected?.abilities||[];
  const statKeys=['hp','attack','defense','special_attack','special_defense','speed'];
  const evo=pv?.evolutionNotice;
  const evolutionWarning=evo?(Number(evo.minimumLevel)&&Number(f.level)<Number(evo.minimumLevel)
    ? `<div class="builder-rule-note"><strong>Evolution notice:</strong> ${esc(evo.message)} This is informational only and does not block direct creation.</div>`
    : `<div class="flow-note"><strong>Evolution:</strong> ${esc(evo.message)}</div>`):'';
  const formDefs=Array.isArray(selected?.forms)?selected.forms:[];
  const permanentForms=formDefs.filter(form=>form.mode==='permanent');
  const selectedPermanent=permanentForms.find(form=>form.id===(f.baseFormId||'base'))||null;
  const formRequirements=selectedPermanent?pokemonFormRequirementText(selectedPermanent.requirements):'Canonical Species form; no additional requirements.';
  const manualRequirements=selectedPermanent?pokemonFormManualRequirements(selectedPermanent.requirements,[]):[];
  const approvals=new Set(f.manualFormApprovals||[]);
  const formResolution=pokemonBuilderState.formResolution;
  const formMessages=[...(formResolution?.errors||[]),...(formResolution?.warnings||[])];
  const formBuilderBlock=permanentForms.length?`<div class="builder-rule-note"><div class="row-between"><div><strong>Pokémon Form</strong><small>Choose the permanent/base Form used by the rules preview and saved creature.</small></div>${f.baseFormId&&f.baseFormId!=='base'?chip('PERMANENT FORM','chip-purple'):chip('CANONICAL BASE','chip-blue')}</div><label>Permanent / Base Form<select onchange="setPokemonBuilderBaseForm(this.value)"><option value="base" ${(f.baseFormId||'base')==='base'?'selected':''}>Canonical Base</option>${permanentForms.map(form=>`<option value="${esc(form.id)}" ${f.baseFormId===form.id?'selected':''}>${esc(form.name)}</option>`).join('')}</select></label><p class="muted"><strong>Requirements:</strong> ${esc(formRequirements)}</p>${selectedPermanent?.notes?`<p class="muted">${esc(selectedPermanent.notes)}</p>`:''}${manualRequirements.length?`<div class="form-grid">${manualRequirements.map(req=>`<label><input type="checkbox" ${approvals.has(req.key)?'checked':''} onchange="togglePokemonBuilderFormManualApproval('${esc(req.key)}',this.checked)"/> Confirm: ${esc(req.label)}</label>`).join('')}</div>`:''}${formMessages.length?`<div class="builder-validation ${formResolution?.valid?'ok':'bad'}"><ul>${formMessages.map(message=>`<li>${esc(message)}</li>`).join('')}</ul></div>`:''}</div>`:'';
  const statRows=pv?statKeys.map(k=>`<div class="builder-stat-row ${pv.baseRelations?.violations?.some(v=>v.higher===k||v.lower===k)?'invalid':''}"><strong>${builderStatLabel(k)}</strong><span>Base ${pv.baseStats[k]}</span><span>Nature ${pv.natureAdjustedBaseStats[k]}</span><div class="builder-stat-step"><button onclick="adjustPokemonBuilderStat('${k}',-5)">−5</button><button onclick="adjustPokemonBuilderStat('${k}',-1)">−1</button><b>+${pv.statAllocations[k]}</b><button onclick="adjustPokemonBuilderStat('${k}',1)">+1</button><button onclick="adjustPokemonBuilderStat('${k}',5)">+5</button></div><em>${pv.finalStats[k]}</em></div>`).join(''):'';
  const abilitySelectors=pv?(pv.abilitySlots||[]).map((slot,i)=>`<label>${esc(slot.label)}<select onchange="setPokemonBuilderAbility(${i},this.value)"><option value="">Choose...</option>${(slot.options||[]).map(a=>`<option value="${esc(a.name)}" ${(f.selectedAbilities||[])[i]===a.name?'selected':''}>${esc(a.name)} · ${esc(a.category)}</option>`).join('')}</select><small>Allowed: ${slot.allowedCategories.map(x=>esc(x)).join(' / ')}</small></label>`).join(''):'';
  const moveRows=pv?(pv.eligibleMoves||[]).map(m=>{const srcs=m.sources||[];const hasCurrent=srcs.some(s=>s.sourceKind==='current_species');const hasPre=srcs.some(s=>s.sourceKind==='pre_evolution');const hasGm=srcs.some(s=>s.sourceKind==='gm_override');const tags=[hasGm?chip('GM','chip-red'):'',hasPre?chip('PRE-EVO','chip-purple'):'',hasCurrent?(m.isEvolution?chip('EVO','chip-yellow'):(m.numericLevel!=null?chip(`Lv ${esc(m.numericLevel)}`,'chip-blue'):chip('CURRENT','chip-blue'))):''].filter(Boolean).join(' ');return `<label class="builder-move-option ${m.isEvolution?'evo':''} ${hasPre&&!hasCurrent?'pre-evo':''} ${hasGm&&!hasCurrent&&!hasPre?'gm-move':''}"><input type="checkbox" ${f.selectedMoves.includes(m.key)?'checked':''} onchange="togglePokemonBuilderMove('${esc(m.key)}')"/><span><strong>${esc(m.name)}</strong><small>${esc(m.eligibilityReason||'Available Move')}${m.typeHint?` · ${esc(m.typeHint)}`:''}</small></span><span class="move-source-tags">${tags}</span></label>`}).join(''):'';
  const ancestryNames=(pv?.preEvolutionSpecies||[]).map(a=>a.name).filter(Boolean);
  const gmMoveControls=state.ui.gmOverride?`<div class="gm-move-builder"><div class="row-between"><div><strong>GM Move Override</strong><small>Add any resolved Move definition regardless of Species compatibility.</small></div>${chip('GM OVERRIDE','chip-red')}</div><div class="gm-move-search"><input value="${esc(pokemonBuilderState.gmMoveQuery||'')}" oninput="setPokemonBuilderGmMoveQuery(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();searchPokemonBuilderGmMoves()}" placeholder="Search any Move..."/><button class="btn btn-ghost" onclick="searchPokemonBuilderGmMoves()">Search</button></div>${pokemonBuilderState.gmMoveLoading?'<p class="muted">Searching Moves…</p>':`<div class="gm-move-results">${(pokemonBuilderState.gmMoveRows||[]).slice(0,12).map(m=>`<button onclick="addPokemonBuilderGmMove('${esc(m.id)}','${esc(m.name)}','${esc(m.type||'')}')"><span><strong>${esc(m.name)}</strong><small>${esc(m.type||'')} ${esc(m.category||'')}</small></span>＋</button>`).join('')}</div>`}${(f.gmMoves||[]).length?`<div class="gm-selected-moves">${f.gmMoves.map(m=>`<span>${esc(m.name)} <button onclick="removePokemonBuilderGmMove('${esc(m.key)}')">×</button></span>`).join('')}</div>`:''}</div>`:'';
  const validation=pv?`<div class="builder-validation ${pv.valid?'ok':'bad'}"><strong>${pv.valid?'✓ Build valid':'⚠ Build needs attention'}</strong>${pv.errors?.length?`<ul>${pv.errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`:'<span>All currently implemented PTU creation checks pass.</span>'}${pv.baseRelations?.overridden?'<span>GM Override is currently bypassing Base Relations violations.</span>':''}</div>`:'';
  const createSection=selected&&pv?`${validation}<dl class="detail-dl"><div><dt>Species</dt><dd>${esc(selected.name)}</dd></div><div><dt>Ruleset</dt><dd>${esc(catalogState.status?.ruleset?.name||catalogState.status?.activeRulesetId||'Active Ruleset')}</dd></div><div><dt>Final HP</dt><dd>${pv.maxHp}</dd></div><div><dt>Tutor Points</dt><dd>${pv.tutorPoints.earned}</dd></div><div><dt>Abilities</dt><dd>${(f.selectedAbilities||[]).filter(Boolean).map(esc).join(', ')||'—'}</dd></div><div><dt>Moves</dt><dd>${f.selectedMoves.length}</dd></div><div><dt>Sex</dt><dd>${esc(pokemonGenderLabel(f.gender))}</dd></div><div><dt>Shiny</dt><dd>${f.isShiny?'Yes':'No'}</dd></div><div><dt>Location</dt><dd>${esc(f.location)}</dd></div></dl><button class="btn ${pv.valid?'btn-success':'btn-disabled'} full" onclick="createPokemonFromBuilder()" ${(!pv.valid||selected.enabledForCreation===false)?'disabled':''}>Create Rules-Validated Pokémon</button>`:`<button class="btn btn-disabled full" disabled>${selected?'Resolving build…':'Select a Species'}</button>`;
  return `<div class="page">${heading('PTU CORE RULES','Create Pokémon','Nature, HP-exempt Base Relations, Level + 10 Stat Points, Abilities, evolution-history Moves, GM Move overrides and Tutor Points are resolved by the v1.0 Pokémon Rules Engine.',"<button class=\"btn btn-ghost\" onclick=\"route('creature')\">Cancel</button>")}
    <div class="pokemon-builder-layout v05">
      ${section('1 · CHOOSE SPECIES',`<label class="builder-search-label">Search Species<input id="pokemon-builder-search" value="${esc(pokemonBuilderState.query)}" oninput="setPokemonBuilderQuery(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();clearTimeout(pokemonBuilderTimer);refreshPokemonBuilderSpecies({preserveFocus:true})}" placeholder="Sableye, Pikachu, Charcadet..." autocomplete="off"/></label><div class="builder-search-meta">${pokemonBuilderState.loading?'Searching…':`${pokemonBuilderState.total} matching definitions`}</div>${pokemonBuilderState.error?`<div class="alert alert-danger">${esc(pokemonBuilderState.error)}</div>`:''}<div class="builder-species-list">${pokemonBuilderState.rows.map(d=>`<button class="${selected?.id===d.id?'selected':''}" onclick="selectPokemonBuilderSpecies('${esc(d.id)}')"><div><strong>${esc(d.name)}</strong><small>${(d.types||[]).map(t=>esc(t)).join(' / ')||'Unknown Type'}</small></div>${d.enabledForCreation===false?chip('BROWSE ONLY','chip-yellow'):chip('READY','chip-green')}</button>`).join('')||'<p class="muted">Type a species name or press Enter to load the catalog.</p>'}</div>`)}
      ${section('2 · SPECIES & IDENTITY',selected?`<div class="builder-species-hero"><img class="builder-species-portrait" src="${esc(definitionArtworkSrc(selected)||'creatures/default.svg')}" onerror="this.onerror=null;this.src='creatures/default.svg'" alt="${esc(selected.name)}"/><div><h2>${esc(selected.name)}</h2><div>${(selected.types||[]).map(t=>typeBadge(String(t).toLowerCase())).join(' ')}</div><small>${esc(selected.packName||selected.contentPackId)}</small></div></div><div class="form-grid"><label>Nickname<input value="${esc(f.nickname)}" onchange="setPokemonBuilderField('nickname',this.value)"/></label><label>Level<input type="number" min="1" max="100" value="${esc(f.level)}" onchange="setPokemonBuilderField('level',this.value)"/></label><label>Nature<select onchange="setPokemonBuilderField('nature',this.value)">${builderNatureOptions(f.nature)}</select></label><label>Poké Ball<input value="${esc(f.ball)}" onchange="setPokemonBuilderField('ball',this.value)"/></label><label>Loyalty<input type="number" min="0" max="6" value="${esc(f.loyalty)}" onchange="setPokemonBuilderField('loyalty',this.value)"/></label><label>Sex<select onchange="setPokemonBuilderField('gender',this.value)"><option value="None" ${normalizePokemonGender(f.gender)==='None'?'selected':''}>None</option><option value="Male" ${normalizePokemonGender(f.gender)==='Male'?'selected':''}>Male</option><option value="Female" ${normalizePokemonGender(f.gender)==='Female'?'selected':''}>Female</option></select></label><label>Shiny<select onchange="setPokemonBuilderField('isShiny',this.value==='yes')"><option value="no" ${!f.isShiny?'selected':''}>No</option><option value="yes" ${f.isShiny?'selected':''}>Yes — Shiny appearance</option></select></label><label>Initial Location<select onchange="setPokemonBuilderField('location',this.value)"><option value="carried" ${f.location==='carried'?'selected':''}>Carried / Available</option><option value="storage" ${f.location==='storage'?'selected':''}>Storage</option></select></label></div>${formBuilderBlock}${evolutionWarning}`:'<div class="definition-detail-empty"><div><h3>Select a Species</h3><p>The resolved PTU definition will appear here.</p></div></div>')}
      ${section('3 · PTU STAT ALLOCATION',selected?(pokemonBuilderState.previewLoading&&!pv?'<p class="muted">Resolving PTU build…</p>':pv?`<div class="builder-budget"><div><small>Level-Up Stat Points</small><strong>${pv.statBudget.spent} / ${pv.statBudget.total}</strong><span class="${pv.statBudget.remaining===0?'positive':pv.statBudget.remaining<0?'negative':''}">${pv.statBudget.remaining} remaining</span></div><div><small>Calculated Max HP</small><strong>${pv.maxHp}</strong><span>Level + (HP × 3) + 10</span></div><div><small>Tutor Points</small><strong>${pv.tutorPoints.earned}</strong><span>Unspent at creation</span></div></div><div class="builder-stat-table" role="region" tabindex="0" aria-label="Stat allocation table. Swipe horizontally to view all columns."><div class="builder-stat-head"><span>Stat</span><span>Species</span><span>Nature</span><span>Added</span><span>Final</span></div>${statRows}</div><div class="row-gap"><button class="btn btn-ghost" onclick="autoAllocatePokemonBuilderStats()">Auto-balance legal stats</button>${state.ui.gmOverride?chip('GM OVERRIDE ON','chip-red'):chip('BASE RELATIONS · HP EXEMPT','chip-green')}</div><div class="flow-note"><strong>Campaign rule:</strong> HP may be raised freely and is ignored when validating Base Relations. Attack, Defense, Special Attack, Special Defense, and Speed still follow their normal relative ordering.</div>${pv.baseRelations?.violations?.length?`<div class="builder-rule-note"><strong>Base Relations:</strong><ul>${pv.baseRelations.violations.map(v=>`<li>${esc(v.message)}</li>`).join('')}</ul></div>`:''}`:'<p class="muted">Waiting for rules preview…</p>'):'<p class="muted">Choose a Species first.</p>')}
      ${section('4 · ABILITIES',selected&&pv?`<div class="builder-ability-grid">${abilitySelectors||'<p class="muted">No parsed native Ability options.</p>'}</div><div class="builder-rule-note"><strong>Progression:</strong> 1 Basic Ability initially; a second Ability unlocks at Level 20 from Basic/Advanced; a third unlocks at Level 40 from any native Ability. Extra Abilities granted by Features are not capped by this progression model.</div>`:'<p class="muted">Choose a Species first.</p>')}
      ${section('5 · MOVES & MOVE HISTORY',selected&&pv?`<div class="row-between builder-move-summary"><div><strong>${f.selectedMoves.length} / ${pv.moveLimit.effective} selected</strong><small>Base Move Limit ${pv.moveLimit.base}${pv.moveLimit.modifier?` ${pv.moveLimit.modifier>0?'+':''}${pv.moveLimit.modifier}`:''}${pv.moveLimit.abilityModifier?` · selected Ability +${pv.moveLimit.abilityModifier}`:''} · ${pokemonBuilderState.movesTouched?'Manual selection':'Recommended auto-selection'}</small></div><div class="row-gap"><button class="btn btn-ghost btn-small" onclick="useRecommendedPokemonBuilderMoves()">Use recommended</button><label class="move-limit-mod">Rules modifier <input type="number" value="${esc(f.moveLimitModifier)}" onchange="setPokemonBuilderField('moveLimitModifier',this.value)"/></label></div></div>${ancestryNames.length?`<div class="flow-note"><strong>Pre-evolution history:</strong> Moves from ${ancestryNames.map(esc).join(' → ')} are available as natural historical choices and are never auto-selected.</div>`:''}<div class="builder-move-list">${moveRows||'<p class="muted">No natural Moves were resolved for this Species/evolution history.</p>'}</div>${gmMoveControls}<div class="builder-rule-note"><strong>Move rules:</strong> Current-species Level-Up Moves use normal Level eligibility. Moves from pre-evolutions are available as creation-history choices because an evolved Pokémon may retain Moves learned in earlier forms. With GM Override enabled, any Move in the active Ruleset may be explicitly added. The default PTU Move Limit remains resolved rather than hardcoded.</div>`:'<p class="muted">Choose a Species first.</p>')}
      ${section('6 · VALIDATE & CREATE',createSection)}
    </div></div>`;
}
function createPokemonFromBuilder(){
  const d=pokemonBuilderState.selected?.definition, f=pokemonBuilderState.form, pv=pokemonBuilderState.preview; if(!d) return toast('Select a Species first.','error');
  if(d.enabledForCreation===false) return toast('This Species is not enabled for character creation.','error');
  if(!pv?.valid) return toast('Resolve the PTU build validation issues before creating this Pokémon.','error');
  const level=Math.max(1,Math.min(100,Number(f.level)||1)); const loyalty=Math.max(0,Math.min(6,Number(f.loyalty)||0));
  const id=uid('pokemon'); const resolvedDefinition=pokemonBuilderState.resolvedSpecies||d; const name=(String(f.nickname||'').trim()||resolvedDefinition.name||d.name); const types=(resolvedDefinition.types||d.types||[]).map(t=>String(t).toLowerCase());
  const linkedRulesetId=catalogState.status?.activeRulesetId||null;
  const eligibleByKey=new Map((pv.eligibleMoves||[]).map(m=>[m.key,m]));
  const selectedMoveRecords=(f.selectedMoves||[]).map(k=>eligibleByKey.get(k)).filter(Boolean).map(m=>({key:m.key,id:m.id,name:m.name,learnedAt:m.level,isEvolution:m.isEvolution,typeHint:m.typeHint||null,source:m.sourceKind||'natural',sourceSpeciesId:m.sourceSpeciesId||null,sourceSpeciesName:m.sourceSpeciesName||null,availableSources:m.sources||[],gmOverride:(m.sources||[]).some(s=>s.sourceKind==='gm_override')}));
  const finalStats=pv.finalStats;
  const p={id,name,species:resolvedDefinition.name||d.name,level,types,hp:pv.maxHp,maxHp:pv.maxHp,tempHp:0,injuries:0,ball:String(f.ball||'Poké Ball'),heldItem:null,img:'creatures/default.svg',storage:f.location==='storage',loyalty,rosterIds:[],combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0},details:{
    speciesDefinitionId:d.id,speciesVersionId:d.versionId,speciesContentPackId:d.contentPackId,linkedRulesetId,
    formState:{schemaVersion:1,baseFormId:f.baseFormId||'base',activeFormId:null},manualFormApprovals:[...(f.manualFormApprovals||[])],isShiny:!!f.isShiny,
    nature:f.nature,gender:normalizePokemonGender(f.gender),ability:(f.selectedAbilities||[])[0]||'',abilities:[...(f.selectedAbilities||[])].filter(Boolean),
    abilityRecords:[...(f.selectedAbilities||[])].filter(Boolean).map((name,index)=>({name,sourceKind:index===0?'species_starting':'level_choice',sourceLabel:index===0?'Starting Ability':index===1?'Level 20 Ability':index===2?'Level 40 Ability':`Native Ability ${index+1}`,unlockLevel:index===0?1:index===1?20:index===2?40:null,selectedAtLevel:level,sourceId:d.id,sourceVersionId:d.versionId})),
    experience:Number(pokemonBuilderState.experience?.cumulative_exp??0),
    baseStats:pv.baseStats,natureAdjustedBaseStats:pv.natureAdjustedBaseStats,statAllocations:pv.statAllocations,finalStats,
    tutorPointsEarned:pv.tutorPoints.earned,tutorPointsSpent:0,tutorPointsRemaining:pv.tutorPoints.remaining,
    moveLimitBase:pv.moveLimit.base,moveLimitModifier:pv.moveLimit.modifier,moveLimitEffective:pv.moveLimit.effective,moves:selectedMoveRecords,
    evolutionNotice:pv.evolutionNotice||null,createdFromDefinition:true,buildEngineVersion:'1.5.0',hpBaseRelationsExempt:true,baseRelationsOverridden:!!pv.baseRelations?.overridden
  }};
  state.pokemon.push(p); state.selectedPokemonId=id; trainer().history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Pokémon registered',detail:`${name} · ${d.name} · Lv. ${level} · PTU v1.5 rules build`}); state.ui.screen='creature'; invalidateCreatureReference(); commit(`${name} created with PTU Core stat validation.`); setTimeout(()=>loadCreatureReferenceData(true),0);
}



/* --- v0.9 Pokémon progression / evolution --- */
function resetPokemonProgressState(){
  const p=pokemon();
  pokemonProgressState={pokemonId:p?.id||null,loading:false,error:null,preview:null,evolutionCandidates:[],form:{
    progressMode:'xp',expGain:0,targetLevel:Math.min(100,(p?.level||1)+1),newStatAllocations:blankPokemonAllocations(),evolutionSpeciesId:'',evolutionAllocations:blankPokemonAllocations(),
    selectedAbilities:null,selectedMoves:null,manualEvolutionCondition:false
  }};
}
async function beginPokemonProgression(){
  const p=pokemon();
  if(!p?.details?.createdFromDefinition) return toast('This Pokémon must be linked to a PTU Species definition before using progression.','error');
  resetPokemonProgressState(); state.ui.screen='pokemonprogress'; persist(); render(); await refreshPokemonProgressionPreview();
}
function schedulePokemonProgressionPreview(){ clearTimeout(pokemonProgressTimer); pokemonProgressTimer=setTimeout(()=>refreshPokemonProgressionPreview(),120); }
async function refreshPokemonProgressionPreview({resetSelections=false}={}){
  const p=pokemon(pokemonProgressState.pokemonId); if(!p) return;
  const seq=++pokemonProgressSeq; const f=pokemonProgressState.form; pokemonProgressState.loading=true;
  if(resetSelections){ f.selectedAbilities=null; f.selectedMoves=null; }
  try{
    const response=await fetch('/api/pokemon/progression-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      pokemon:p,rulesetId:p.details?.linkedRulesetId||catalogState.status?.activeRulesetId||null,expGain:f.progressMode==='xp'?(Number(f.expGain)||0):0,targetLevel:f.progressMode==='level'?Number(f.targetLevel)||p.level:null,
      newStatAllocations:f.newStatAllocations,evolutionSpeciesId:f.evolutionSpeciesId||null,evolutionAllocations:f.evolutionAllocations,
      selectedAbilities:f.selectedAbilities,selectedMoves:f.selectedMoves,manualEvolutionCondition:!!f.manualEvolutionCondition,gmOverride:!!state.ui.gmOverride
    })});
    const payload=await response.json().catch(()=>({})); if(!response.ok) throw new Error(payload.error||'Could not resolve Pokémon progression');
    if(seq!==pokemonProgressSeq) return;
    pokemonProgressState.preview=payload.preview; pokemonProgressState.evolutionCandidates=payload.evolutionCandidates||[]; pokemonProgressState.error=null;
    if(f.selectedAbilities==null) f.selectedAbilities=[...(payload.preview.selectedAbilities||[])];
    if(f.selectedMoves==null) f.selectedMoves=[...(payload.preview.selectedMoves||[])];
  }catch(error){ if(seq!==pokemonProgressSeq)return; pokemonProgressState.error=error.message; pokemonProgressState.preview=null; }
  if(seq!==pokemonProgressSeq)return; pokemonProgressState.loading=false; render();
}
function setPokemonProgressExp(value){ pokemonProgressState.form.expGain=Math.max(0,Number(value)||0); render(); schedulePokemonProgressionPreview(); }
function setPokemonProgressMode(mode){ const p=pokemon(pokemonProgressState.pokemonId); const f=pokemonProgressState.form; f.progressMode=mode==='level'?'level':'xp'; if(f.progressMode==='level' && (!f.targetLevel || Number(f.targetLevel)<Number(p?.level||1))) f.targetLevel=Math.min(100,Number(p?.level||1)+1); render(); schedulePokemonProgressionPreview(); }
function setPokemonProgressTargetLevel(value){ const p=pokemon(pokemonProgressState.pokemonId); pokemonProgressState.form.targetLevel=Math.max(Number(p?.level||1),Math.min(100,Number(value)||Number(p?.level||1))); render(); schedulePokemonProgressionPreview(); }
function adjustPokemonProgressStat(stat,delta,evolution=false){
  const key=evolution?'evolutionAllocations':'newStatAllocations'; const a=pokemonProgressState.form[key]||(pokemonProgressState.form[key]=blankPokemonAllocations());
  a[stat]=Math.max(0,(Number(a[stat])||0)+Number(delta||0)); render(); schedulePokemonProgressionPreview();
}
function setPokemonProgressAbility(index,value){ const a=[...(pokemonProgressState.form.selectedAbilities||[])]; a[index]=value; pokemonProgressState.form.selectedAbilities=a; render(); schedulePokemonProgressionPreview(); }
function togglePokemonProgressMove(key){ const set=new Set(pokemonProgressState.form.selectedMoves||[]); if(set.has(key)) set.delete(key); else set.add(key); pokemonProgressState.form.selectedMoves=[...set]; render(); schedulePokemonProgressionPreview(); }
function selectPokemonEvolution(id){
  const f=pokemonProgressState.form; f.evolutionSpeciesId=id||''; f.manualEvolutionCondition=false; f.selectedAbilities=null; f.selectedMoves=null;
  f.evolutionAllocations=blankPokemonAllocations(); render(); schedulePokemonProgressionPreview();
}
function toggleEvolutionCondition(value){ pokemonProgressState.form.manualEvolutionCondition=!!value; render(); schedulePokemonProgressionPreview(); }
function useSuggestedEvolutionRestat(){
  const suggested=pokemonProgressState.preview?.suggestedEvolutionAllocations; if(!suggested)return;
  pokemonProgressState.form.evolutionAllocations={...suggested}; render(); schedulePokemonProgressionPreview();
}
function pokemonProgressStatRows(pv,evolved){
  const alloc=evolved?(pokemonProgressState.form.evolutionAllocations||blankPokemonAllocations()):(pokemonProgressState.form.newStatAllocations||blankPokemonAllocations());
  return ['hp','attack','defense','special_attack','special_defense','speed'].map(k=>{
    const label=statDisplayName(k); const adjustedBase=pv.adjustedBaseStats?.[k]??pv.natureAdjustedBaseStats?.[k]??pv.baseStats?.[k]??0; const existing=pv.previousStatAllocations?.[k]||0; const add=Number(alloc[k]||0); const final=pv.resolvedFinalStats?.[k]??pv.finalStats?.[k];
    return `<div class="pokemon-progress-stat-row"><span class="pokemon-progress-stat-name"><strong>${esc(label)}</strong>${k==='hp'?'<small>HP exempt from Base Relations</small>':''}</span><em class="pokemon-progress-stat-base" title="Species Base after Nature and other resolved base adjustments">${adjustedBase}</em><em class="pokemon-progress-stat-before">${existing}</em><div class="pokemon-progress-stepper"><button type="button" aria-label="Remove one ${esc(label)} point" onclick="adjustPokemonProgressStat('${k}',-1,${evolved})" ${add<=0?'disabled':''}>−</button><b>${add}</b><button type="button" aria-label="Add one ${esc(label)} point" onclick="adjustPokemonProgressStat('${k}',1,${evolved})">＋</button></div><strong class="pokemon-progress-stat-final">${final??'—'}</strong></div>`;
  }).join('');
}
async function openPokemonProgressAbilityInfo(index){
  const pv=pokemonProgressState.preview,f=pokemonProgressState.form; const slot=pv?.abilitySlots?.[index]; const name=(f.selectedAbilities||[])[index];
  if(!slot||!name)return toast('Choose an Ability first.','error'); const option=(slot.options||[]).find(a=>a.name===name); const id=option?.id||String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  await openRuleDefinitionModal('abilities',id,`${name} · Ability`);
}
async function openPokemonProgressMoveInfo(key){
  const m=(pokemonProgressState.preview?.movePool||[]).find(x=>x.key===key); if(!m)return toast('Move reference unavailable.','error');
  const id=m.id||String(m.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); await openRuleDefinitionModal('moves',id,`${m.name} · Move`);
}
function pokemonProgressionScreen(){
  const p=pokemon(pokemonProgressState.pokemonId); if(!p) return `<div class="page"><p>No Pokémon selected.</p></div>`;
  const pv=pokemonProgressState.preview, f=pokemonProgressState.form; const err=pokemonProgressState.error;
  const levelFloor=pv?Number(pv.targetLevelFloor||0):0, nextFloor=pv?.nextLevelExperience!=null?Number(pv.nextLevelExperience):null;
  const levelProgress=nextFloor!=null?progress(Math.max(0,Number(pv.totalExperience)-levelFloor),Math.max(1,nextFloor-levelFloor),'blue'):'';
  const progressionInput=f.progressMode==='level'
    ? `<label class="progress-exp-input">Target Level <input type="number" min="${Number(p.level)}" max="100" value="${esc(f.targetLevel??Math.min(100,Number(p.level)+1))}" onchange="setPokemonProgressTargetLevel(this.value)"/></label>`
    : `<label class="progress-exp-input">EXP to add <input type="number" min="0" value="${esc(f.expGain)}" onchange="setPokemonProgressExp(this.value)"/></label>`;
  const expBlock=pv?`<div class="progress-mode-toggle"><button class="${f.progressMode==='xp'?'active':''}" onclick="setPokemonProgressMode('xp')">Add EXP</button><button class="${f.progressMode==='level'?'active':''}" onclick="setPokemonProgressMode('level')">Go to Level</button></div><div class="progression-exp-card"><div><small>CURRENT</small><strong>Lv. ${pv.currentLevel}</strong><span>${Number(pv.currentExperience).toLocaleString()} EXP</span></div><b>${f.progressMode==='level'?`TARGET Lv. ${pv.targetLevel}`:`＋ ${Number(pv.experienceGain||0).toLocaleString()} EXP`}</b><div><small>RESULT</small><strong>Lv. ${pv.targetLevel}</strong><span>${Number(pv.totalExperience).toLocaleString()} EXP</span></div></div>${levelProgress}<div class="flow-note"><strong>Resolved gain:</strong> +${Number(pv.experienceGain||0).toLocaleString()} EXP from the PTU Experience table.</div>`:`<p class="muted">Resolving EXP table…</p>`;
  const rewards=pv?`<div class="reward-grid"><div><span>📈</span><strong>${pv.rewards.statPoints}</strong><small>Stat Point${pv.rewards.statPoints===1?'':'s'}</small></div><div><span>◆</span><strong>+${pv.rewards.tutorPoints}</strong><small>Tutor Points</small></div><div><span>✦</span><strong>${pv.rewards.abilityUnlockLevels.length?pv.rewards.abilityUnlockLevels.join(', '):'—'}</strong><small>Ability unlock levels</small></div><div><span>↟</span><strong>${pv.levelsGained}</strong><small>Levels gained</small></div></div>`:'';
  const evolutionOptions=pv?`<div class="evolution-choice-grid"><button class="evolution-choice ${!f.evolutionSpeciesId?'selected':''}" onclick="selectPokemonEvolution('')"><strong>Stay ${esc(p.species)}</strong><small>Do not evolve during this progression.</small></button>${pokemonProgressState.evolutionCandidates.map(e=>{const edgeLocked=!!e.blockedByPokeEdge&&!state.ui.gmOverride;const locked=(!e.levelEligible&&!state.ui.gmOverride)||edgeLocked;const lockReason=edgeLocked?` · Blocked by ${esc(e.blockedByPokeEdge)}`:(!e.levelEligible&&!state.ui.gmOverride?' · Level requirement not met':'');return `<button class="evolution-choice ${f.evolutionSpeciesId===e.target.id?'selected':''} ${locked?'locked':''}" onclick="selectPokemonEvolution('${esc(e.target.id)}')" ${locked?'disabled':''}><strong>→ ${esc(e.target.name)}</strong><div>${(e.target.types||[]).map(t=>typeBadge(String(t).toLowerCase())).join(' ')}</div><small>${e.toMinLevel!=null?`Minimum Lv. ${e.toMinLevel}`:'Evolution'}${e.conditionText?` · ${esc(e.conditionText)}`:''}${e.sourceTitle?` · PTU source: ${esc(e.sourceTitle)}`:''}${lockReason}</small></button>`}).join('')}</div>`:'';
  const selectedEvolution=pokemonProgressState.evolutionCandidates.find(e=>e.target.id===f.evolutionSpeciesId);
  const conditionConfirm=selectedEvolution?.manualConditionRequired?`<label class="condition-confirm"><input type="checkbox" ${f.manualEvolutionCondition?'checked':''} onchange="toggleEvolutionCondition(this.checked)"/> I confirm the non-Level evolution condition is satisfied: <strong>${esc(selectedEvolution.conditionText)}</strong></label>`:'';
  const statSection=pv?`${pv.evolved?`<div class="flow-note"><strong>Evolution re-Stat:</strong> PTU reapplies the new form's Base Stats and Nature, then redistributes Level + 10 Stat Points. Your campaign rule continues to exempt HP from Base Relations.</div><button class="btn btn-ghost btn-small" onclick="useSuggestedEvolutionRestat()">Use suggested re-Stat</button>`:`<div class="flow-note"><strong>Normal Level-Up:</strong> existing Stat allocation is preserved; distribute only the ${pv.rewards.statPoints} newly earned point${pv.rewards.statPoints===1?'':'s'}.</div>`}<div class="pokemon-progress-stat-table"><div class="pokemon-progress-stat-head"><span>Stat</span><span>Adjusted Base</span><span>Existing alloc.</span><span>${pv.evolved?'Re-Stat allocation':'New points'}</span><span>Final</span></div><div class="pokemon-progress-stat-list">${pokemonProgressStatRows(pv,pv.evolved)}</div></div><div class="builder-budget ${pv.evolved?(pv.statBudget.spent===pv.statBudget.required?'ok':'warn'):(pv.statBudget.newPointsSpent===pv.statBudget.newPointsRequired?'ok':'warn')}"><strong>${pv.evolved?`${pv.statBudget.spent}/${pv.statBudget.required} total Stat Points`:`${pv.statBudget.newPointsSpent}/${pv.statBudget.newPointsRequired} new Stat Points`}</strong></div>`:'';
  const abilityRows=pv?pv.abilitySlots.map((slot,i)=>`<div class="ability-choice"><span class="ability-choice-label"><strong>${esc(slot.label)}</strong><small>Unlocked Lv. ${slot.unlockLevel}</small></span><select aria-label="${esc(slot.label)}" onchange="setPokemonProgressAbility(${i},this.value)"><option value="">Choose…</option>${slot.options.map(a=>`<option value="${esc(a.name)}" ${(f.selectedAbilities||[])[i]===a.name?'selected':''}>${esc(a.name)} · ${esc(a.category)}</option>`).join('')}</select><button type="button" class="rule-info-button" onclick="openPokemonProgressAbilityInfo(${i})" ${(f.selectedAbilities||[])[i]?'':'disabled'} title="View Ability description">ⓘ Details</button></div>`).join(''):'';
  const newMoveSet=new Set(pv?.newMoveKeys||[]); const existingSet=new Set(pv?.existingMoveKeys||[]);
  const moveRows=pv?(pv.movePool||[]).map(m=>`<div class="builder-move-option progress-move-option ${newMoveSet.has(m.key)?'new-progression-move':''}"><input type="checkbox" aria-label="Select ${esc(m.name)}" ${(f.selectedMoves||[]).includes(m.key)?'checked':''} onchange="togglePokemonProgressMove('${esc(m.key)}')"/><button type="button" class="progress-move-info" onclick="openPokemonProgressMoveInfo('${esc(m.key)}')"><strong>${esc(m.name)}</strong><small>${existingSet.has(m.key)?'Already known':esc(m.eligibilityReason||'Newly available')} · click for full description</small></button><span class="move-source-tags">${existingSet.has(m.key)?chip('KNOWN','chip-blue'):chip(pv.evolved?'EVOLUTION':'NEW','chip-green')}</span></div>`).join(''):'';
  const validation=pv?(pv.valid?`<div class="builder-validation ok"><strong>✓ Progression is valid</strong><span>Ready to apply to ${esc(p.name)}.</span></div>`:`<div class="builder-validation bad"><strong>⚠ Progression needs attention</strong><ul>${pv.errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`):'';
  return `<div class="page">${heading('POKÉMON PROGRESSION',`${esc(p.name)} · Lv. ${p.level}`,'Add EXP, resolve level rewards, learn Moves, unlock Abilities, and optionally evolve using the active PTU ruleset.','<button class="btn btn-ghost" onclick="route(\'creature\')">← Back to Sheet</button>')}
    <div class="pokemon-progress-grid">
      ${section('1 · EXPERIENCE',`${expBlock}${progressionInput}${rewards}`)}
      ${section('2 · EVOLUTION',`${evolutionOptions}${conditionConfirm}${pv?.evolved?`<div class="flow-note"><strong>Selected:</strong> ${esc(p.species)} → ${esc(pv.targetSpecies.name)}. Evolution is optional; direct creation rules remain separate.</div>`:''}`)}
      ${section('3 · STATS',statSection||'<p class="muted">Resolve progression first.</p>')}
      ${section('4 · ABILITIES',abilityRows||'<p class="muted">No Ability slots resolved.</p>')}
      ${section(`5 · MOVES · ${(f.selectedMoves||[]).length}/${pv?.moveLimit?.effective??6}`,`<div class="builder-move-list">${moveRows||'<p class="muted">No Move changes are available.</p>'}</div><div class="builder-rule-note"><strong>Move retention:</strong> known Moves stay selected by default. Newly unlocked or Evolution Moves are optional; uncheck an old Move when you need room under the current Move Limit.</div>`)}
      ${section('6 · REVIEW & APPLY',`${err?`<div class="builder-validation bad">${esc(err)}</div>`:''}${validation}${pv?`<dl class="detail-dl"><div><dt>Level</dt><dd>${pv.currentLevel} → ${pv.targetLevel}</dd></div><div><dt>EXP</dt><dd>${Number(pv.currentExperience).toLocaleString()} → ${Number(pv.totalExperience).toLocaleString()}</dd></div><div><dt>Species</dt><dd>${esc(p.species)} → ${esc(pv.targetSpecies.name)}</dd></div><div><dt>Max HP</dt><dd>${p.maxHp} → ${pv.resolvedMaxHp??pv.maxHp}</dd></div><div><dt>Tutor Points</dt><dd>${pv.tutorPoints.remaining} remaining / ${pv.tutorPoints.earned} earned</dd></div></dl><button class="btn ${pv.valid?'btn-success':'btn-disabled'} full" onclick="applyPokemonProgression()" ${pv.valid?'':'disabled'}>Apply Progression</button>`:''}`)}
    </div></div>`;
}
async function applyPokemonProgression(){
  const p=pokemon(pokemonProgressState.pokemonId), pv=pokemonProgressState.preview, f=pokemonProgressState.form; if(!p||!pv?.valid) return toast('Resolve progression validation issues first.','error');
  const oldLevel=p.level, oldSpecies=p.species, oldMax=p.maxHp, d=p.details||(p.details={});
  const pool=new Map((pv.movePool||[]).map(m=>[m.key,m]));
  const moves=(f.selectedMoves||[]).map(k=>pool.get(k)).filter(Boolean).map(m=>({
    key:m.key,id:m.id||null,name:m.name,learnedAt:m.level??pv.targetLevel,isEvolution:!!m.isEvolution,typeHint:m.typeHint||null,
    source:m.existing?(m.sourceKind||'existing'):(m.sourceKind||'level_up'),sourceSpeciesId:m.sourceSpeciesId||pv.targetSpecies.id||null,
    sourceSpeciesName:m.sourceSpeciesName||pv.targetSpecies.name||null,availableSources:m.availableSources||m.sources||[],gmOverride:false
  }));
  p.level=pv.targetLevel; p.species=pv.targetSpecies.name; p.types=(pv.targetSpecies.types||p.types).map(t=>String(t).toLowerCase()); p.maxHp=Number(pv.resolvedMaxHp??pv.maxHp); p.hp=Math.min(p.hp,p.maxHp);
  d.experience=pv.totalExperience; d.speciesDefinitionId=pv.targetSpecies.id; d.speciesVersionId=pv.targetSpecies.versionId; d.speciesContentPackId=pv.targetSpecies.contentPackId;
  if(pv.evolved){d.formState={schemaVersion:1,baseFormId:'base',activeFormId:null};d.manualFormApprovals=[];}
  d.baseStats=pv.baseStats; d.natureAdjustedBaseStats=pv.natureAdjustedBaseStats; d.statAllocations=pv.statAllocations; d.finalStats=pv.finalStats;
  d.abilities=[...(f.selectedAbilities||[])].filter(Boolean); d.ability=d.abilities[0]||''; d.moveLimitEffective=pv.moveLimit.effective;
  d.abilityRecords=d.abilities.map((name,index)=>({name,sourceKind:index===0?'species_starting':'level_choice',sourceLabel:index===0?'Starting Ability':index===1?'Level 20 Ability':index===2?'Level 40 Ability':`Native Ability ${index+1}`,unlockLevel:index===0?1:index===1?20:index===2?40:null,selectedAtLevel:p.level,sourceId:pv.targetSpecies.id,sourceVersionId:pv.targetSpecies.versionId}));
  d.moves=moves;
  d.tutorPointsEarned=pv.tutorPoints.earned; d.tutorPointsSpent=pv.tutorPoints.spent; d.tutorPointsRemaining=pv.tutorPoints.remaining;
  const edgeRemovals=Array.isArray(pv.pokeEdgeChanges?.remove)?pv.pokeEdgeChanges.remove:[];
  const edgeRefund=Math.max(0,Number(pv.pokeEdgeChanges?.tutorPointRefund||0));
  if(edgeRemovals.length){
    const removalInstances=new Set(edgeRemovals.map(x=>String(x.instanceId||'')).filter(Boolean));
    const removalIds=new Set(edgeRemovals.map(x=>String(x.id||'')).filter(Boolean));
    d.pokeEdges=(Array.isArray(d.pokeEdges)?d.pokeEdges:[]).filter(edge=>!removalInstances.has(String(edge?.instanceId||'')) && !(edge?.instanceId==null&&removalIds.has(String(edge?.id||''))));
    d.tutorPointsSpent=Math.max(0,Number(d.tutorPointsSpent||0)-edgeRefund);
    d.tutorPointsRemaining=Math.max(0,Number(d.tutorPointsEarned||0)-d.tutorPointsSpent);
  }
  const connectionResponse=await fetch('/api/pokemon/training-action-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'revalidate_connections',pokemon:p,rulesetId:catalogState.status?.activeRulesetId})}); const connectionPayload=await connectionResponse.json();
  if(connectionResponse.ok&&connectionPayload.valid)p.details=connectionPayload.details;
  d.buildEngineVersion='1.5.0'; d.hpBaseRelationsExempt=true; d.baseRelationsOverridden=!!pv.baseRelations?.overridden;
  if(!pv.evolved)await revalidatePokemonFormAfterDirectHpMutation(p.id,{hpChanged:true,tempHpChanged:false,silent:true});
  d.progressionHistory=Array.isArray(d.progressionHistory)?d.progressionHistory:[];
  d.progressionHistory.push({date:new Date().toISOString(),fromLevel:oldLevel,toLevel:p.level,expGain:pv.experienceGain,fromSpecies:oldSpecies,toSpecies:p.species,evolved:pv.evolved,statPointsGained:pv.rewards.statPoints,tutorPointsGained:pv.rewards.tutorPoints,pokeEdgesRemoved:edgeRemovals.map(x=>x.name||x.id),tutorPointsRefunded:edgeRefund,abilityUnlockLevels:pv.rewards.abilityUnlockLevels,abilitiesAfter:[...d.abilities]});
  if(pv.evolved) d.evolutionNotice=null;
  trainer().history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:pv.evolved?'Pokémon evolved':'Pokémon progressed',detail:`${p.name}: ${oldSpecies} Lv. ${oldLevel} → ${p.species} Lv. ${p.level}; +${pv.experienceGain} EXP${connectionPayload?.resultRecord?.refundedTutorPoints?`; Advanced Connection removed; +${connectionPayload.resultRecord.refundedTutorPoints} TP`:''}`});
  state.ui.screen='creature'; invalidateCreatureReference(); commit(`${p.name} progression applied.${pv.evolved?` Evolved into ${p.species}.`:''}${edgeRemovals.length?` ${edgeRemovals.map(x=>x.name||x.id).join(', ')} removed and ${edgeRefund} Tutor Point${edgeRefund===1?'':'s'} refunded.`:''}`); setTimeout(()=>loadCreatureReferenceData(true),0);
}


function pokemonRestatScreen(){
  const p=pokemon(pokemonRestatState.pokemonId)||pokemon(); const pv=pokemonRestatState.preview;
  if(!p?.details?.speciesDefinitionId)return `<div class="page">${heading('STAT CORRECTION','Redistribute Pokémon Stats','This correction tool is available only for rules-backed Pokémon.')}</div>`;
  const a=pokemonRestatState.allocations||p.details.statAllocations||{}; const budget=pv?.statBudget||{total:Object.values(a).reduce((x,y)=>x+Number(y||0),0),spent:Object.values(a).reduce((x,y)=>x+Number(y||0),0),remaining:0};
  const relationModel=pv?.resolvedStatEffects?.baseRelations||pv?.baseRelations;
  const rows=['hp','attack','defense','special_attack','special_defense','speed'].map(k=>`<div class="restat-row ${relationModel?.violations?.some(v=>v.higher===k||v.lower===k)?'invalid':''}"><strong>${statDisplayName(k)}</strong><span>${pv?.resolvedStatEffects?.natureAdjusted?.[k]??pv?.natureAdjustedBaseStats?.[k]??p.details.natureAdjustedBaseStats?.[k]??'—'}</span><button onclick="adjustPokemonRestatStat('${k}',-1)">−</button><b>${a[k]??0}</b><button onclick="adjustPokemonRestatStat('${k}',1)">＋</button><em>${pv?.resolvedFinalStats?.[k]??pv?.finalStats?.[k]??p.details.finalStats?.[k]??'—'}</em>${relationModel?.exemptStats?.includes(k)?chip('EXEMPT','chip-yellow'):''}</div>`).join('');
  const errors=pv?.errors?.length?`<div class="builder-validation bad"><strong>Build needs attention</strong><ul>${pv.errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:`<div class="builder-validation good"><strong>Ready to apply</strong><p>Allocation budget and current Base Relations are valid.</p></div>`;
  return `<div class="page">${heading('STAT CORRECTION',`${esc(p.name)} · Redistribute Stats`,`Correct the permanent Level-Up Stat allocation without changing the Pokémon's Level, Nature, Moves, Abilities, Poké Edges or campaign history. This is an app correction/respec convenience, not a claim that PTU grants free Pokémon retraining.`,`<button class="btn btn-ghost" onclick="cancelPokemonRestat()">← Back to Species</button>`)}
  <div class="restat-kpis"><div><strong>${budget.spent} / ${budget.total}</strong><span>Stat Points allocated</span><small>${budget.remaining} remaining</small></div><div><strong>${pv?.resolvedMaxHp??pv?.maxHp??p.maxHp}</strong><span>Resulting Max HP</span><small>Current HP will only clamp downward if needed.</small></div><div><strong>${(relationModel?.exemptStats||p.details.baseRelationExemptStats||['hp']).map(statDisplayName).join(', ')}</strong><span>Relation exemptions</span><small>HP is campaign-exempt; Attack Conflict adds its bound offensive Stat.</small></div></div>
  ${section('PERMANENT STAT ALLOCATION',`<div class="restat-table"><div class="restat-head"><strong>Stat</strong><span>Nature Base</span><i></i><b>Points</b><i></i><em>Final</em><i></i></div>${rows}</div><div class="flow-note"><strong>Attack Conflict:</strong> when owned, its chosen Attack or Special Attack is hard-bound and removed from Base Relations for this Pokémon, just like the app's HP exemption.</div>`)}
  ${section('VALIDATE & APPLY',`${errors}<div class="row-gap"><button class="btn btn-ghost" onclick="resetPokemonRestat()">Reset current allocation</button><button class="btn btn-success" onclick="applyPokemonRestat()" ${pv&&!pv.valid&&!state.ui.gmOverride?'disabled':''}>Apply redistribution</button></div>`)}</div>`;
}
async function beginPokemonRestat(){
  const p=pokemon(); if(!p?.details?.speciesDefinitionId)return toast('Stat redistribution requires a rules-backed Pokémon.','error');
  pokemonRestatState={pokemonId:p.id,loading:false,error:null,preview:null,allocations:{...(p.details.statAllocations||{})}}; state.ui.screen='pokemonrestat'; persist(); render(); await refreshPokemonRestatPreview();
}
async function refreshPokemonRestatPreview(){
  const p=pokemon(pokemonRestatState.pokemonId); if(!p)return; pokemonRestatState.loading=true; pokemonRestatState.error=null;
  try{const response=await fetch('/api/pokemon/restat-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:p,allocations:pokemonRestatState.allocations,gmOverride:state.ui.gmOverride,rulesetId:catalogState.status?.activeRulesetId})}); const payload=await response.json(); if(!response.ok)throw new Error(payload.error||'Unable to validate redistribution'); pokemonRestatState.preview=payload.preview;}
  catch(error){pokemonRestatState.error=error.message;} finally{pokemonRestatState.loading=false;render();}
}
function adjustPokemonRestatStat(key,delta){const a=pokemonRestatState.allocations||(pokemonRestatState.allocations={}); a[key]=Math.max(0,Number(a[key]||0)+delta); refreshPokemonRestatPreview();}
function resetPokemonRestat(){const p=pokemon(pokemonRestatState.pokemonId); pokemonRestatState.allocations={...(p?.details?.statAllocations||{})}; refreshPokemonRestatPreview();}
function cancelPokemonRestat(){state.ui.screen='creature';state.ui.creatureTab='species';persist();render();loadCreatureReferenceData(true);}
async function applyPokemonRestat(){
  const p=pokemon(pokemonRestatState.pokemonId),pv=pokemonRestatState.preview;if(!p||!pv)return;if(!pv.valid&&!state.ui.gmOverride)return toast('Resolve the Stat allocation errors first.','error');
  const oldMax=p.maxHp; p.details.statAllocations={...pv.statAllocations}; p.details.natureAdjustedBaseStats={...pv.natureAdjustedBaseStats}; p.details.finalStats={...pv.finalStats}; p.details.baseRelationExemptStats=[...(pv.resolvedStatEffects?.baseRelations?.exemptStats||pv.baseRelations?.exemptStats||['hp'])]; p.maxHp=Number(pv.resolvedMaxHp??pv.maxHp);p.hp=Math.min(p.hp,p.maxHp);await revalidatePokemonFormAfterDirectHpMutation(p.id,{hpChanged:true,tempHpChanged:false,silent:true});
  p.details.progressionHistory=Array.isArray(p.details.progressionHistory)?p.details.progressionHistory:[]; p.details.progressionHistory.push({date:new Date().toISOString(),action:'stat_redistribution',oldMaxHp:oldMax,newMaxHp:p.maxHp,gmOverride:!!state.ui.gmOverride,allocations:{...pv.statAllocations}});
  trainer().history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Pokémon Stats redistributed',detail:`${p.name}: permanent Stat allocation corrected${state.ui.gmOverride?' with GM Override':''}.`}); state.ui.screen='creature';state.ui.creatureTab='species'; creatureReferenceState={pokemonId:null,loading:false,error:null,data:null}; await commit(`${p.name} Stat allocation updated.`); await loadCreatureReferenceData(true);
}
function trainingStatusChip(edge){
  if(edge.exhausted) return chip('MAXED','chip-gray');
  if(edge.prerequisite?.valid===true) return chip('ELIGIBLE','chip-green');
  if(edge.prerequisite?.valid===false) return chip('LOCKED','chip-red');
  return chip('MANUAL CHECK','chip-yellow');
}
function trainingMethodLabel(method){ return method==='tutor'?'Move Tutor':method==='egg_tutor'?'Egg Tutor':'TM / HM'; }
function pokemonTrainingScreen(){
  const p=pokemon(pokemonTrainingState.pokemonId)||pokemon(); const o=pokemonTrainingState.options; const q=String(pokemonTrainingState.query||'').trim().toLowerCase();
  if(!p) return `<div class="page">${heading('TRAINING','Advanced Pokémon Training','Select a Pokémon first.')}</div>`;
  const header=heading('TUTOR POINTS & POKÉ EDGES',`${esc(p.name)} · Advanced Training`,`Spend Tutor Points on Poké Edges and compatible TM/HM, Tutor, and Egg Tutor Moves. Effects that cannot yet be executed are preserved as permanent rule records.`,`<button class="btn btn-ghost" onclick="route('creature')">← Back to Sheet</button>`);
  if(pokemonTrainingState.loading&&!o) return `<div class="page">${header}${section('LOADING','<p class="muted">Resolving training options from the active Ruleset…</p>')}</div>`;
  if(pokemonTrainingState.error) return `<div class="page">${header}${section('ERROR',`<div class="builder-validation bad">${esc(pokemonTrainingState.error)}</div><button class="btn btn-primary" onclick="refreshPokemonTrainingOptions()">Retry</button>`)}</div>`;
  if(!o) return `<div class="page">${header}</div>`;
  const edges=(o.edges||[]).filter(e=>!q||`${e.name} ${e.prerequisites||''} ${e.effect||''}`.toLowerCase().includes(q));
  const moveRows=(o.moveTeaching?.[pokemonTrainingState.moveMethod]||[]).filter(m=>!q||`${m.name} ${m.type||''}`.toLowerCase().includes(q));
  const edgeCards=edges.map(e=>{
    const noTarget=e.targetRequired && !(e.targetOptions||[]).length;
    const locked=e.exhausted || noTarget || (!e.affordable&&!state.ui.gmOverride) || (e.prerequisite?.valid===false&&!state.ui.gmOverride);
    const manual=e.prerequisite?.valid==null;
    const underdogFlag=e.requiresUnderdog?(e.isUnderdog?chip('UNDERDOG ✓','chip-green'):chip('UNDERDOG REQUIRED','chip-red')):'';
    let action='';
    if(e.id==='attack-conflict'&&!e.exhausted){
      action=`<div class="attack-conflict-choice"><button class="btn ${locked?'btn-disabled':'btn-primary'}" ${locked?'disabled':''} onclick="acquirePokeEdge('${e.id}','attack')">Bind to Attack</button><button class="btn ${locked?'btn-disabled':'btn-primary'}" ${locked?'disabled':''} onclick="acquirePokeEdge('${e.id}','special_attack')">Bind to Sp. Attack</button></div>`;
    } else if(e.allocationRequired){
      action=`<button class="btn ${locked?'btn-disabled':manual?'btn-gold':'btn-primary'} full" ${locked?'disabled':''} onclick="acquirePokeEdge('${e.id}')">${e.exhausted?'Maximum reached':manual?'Confirm & Allocate':'Allocate '+e.allocationPoints+' Stat Point'+(e.allocationPoints===1?'':'s')}</button>`;
    } else if(e.targetRequired){
      const label=e.targetKind==='move'?'Move':e.targetKind==='skill'?'Skill':e.targetKind==='ability'?'Ability':'Capability';
      const options=(e.targetOptions||[]).map(o=>`<option value="${esc(o.id)}">${esc(o.label)}</option>`).join('');
      action=`<div class="edge-target-picker"><label>${label}<select id="edge-target-${esc(e.id)}" ${locked?'disabled':''}>${options||'<option value="">No valid unused target</option>'}</select></label><button class="btn ${locked?'btn-disabled':manual?'btn-gold':'btn-primary'}" ${locked?'disabled':''} onclick="acquirePokeEdge('${e.id}')">${e.exhausted?'Maximum reached':noTarget?'No valid target':manual?'Confirm & Acquire':'Acquire Poké Edge'}</button></div>`;
    } else {
      action=`<button class="btn ${locked?'btn-disabled':manual?'btn-gold':'btn-primary'} full" ${locked?'disabled':''} onclick="acquirePokeEdge('${e.id}')">${e.exhausted?'Maximum reached':manual?'Confirm & Acquire':'Acquire Poké Edge'}</button>`;
    }
    return `<article class="training-card"><div class="row-between"><div><h3>${esc(e.name)} ${e.nextRank>1?`· Rank ${e.nextRank}`:''}</h3><small>${e.cost} Tutor Point${e.cost===1?'':'s'} · ${esc(e.sourceId||'Ruleset')}</small></div><div class="row-gap">${underdogFlag}${trainingStatusChip(e)}</div></div><p><strong>Prerequisites:</strong> ${esc(e.prerequisites||'None')}</p><p>${esc(e.effect||'No effect text available.')}</p>${e.prerequisite?.reasons?.length?`<div class="mini-warning">${e.prerequisite.reasons.map(esc).join(' · ')}</div>`:''}${action}</article>`;
  }).join('')||'<p class="muted">No Poké Edges match this filter.</p>';
  const moveCards=moveRows.map(m=>{
    const blocked=m.alreadyKnown || (m.method==='egg_tutor'&&o.eggTutorUsed&&!state.ui.gmOverride) || (!m.tutorRestriction?.valid&&!state.ui.gmOverride) || (o.tutorPoints.remaining<m.cost&&!state.ui.gmOverride);
    return `<article class="training-move"><div><strong>${esc(m.name)}</strong><div class="row-gap">${m.type?typeBadge(m.type):''}${m.naturalTutor?chip('NATURAL','chip-green'):''}${m.countsAgainstTutorPool?chip('TM/TUTOR POOL','chip-purple'):chip('NATURAL POOL','chip-blue')}</div><small>${trainingMethodLabel(m.method)}${m.code?` · ${esc(m.code)}`:''} · Cost ${m.cost} TP</small></div><div>${m.frequency?`<small>${esc(m.frequency)}</small>`:''}${m.damageBase!=null?`<small>DB ${m.damageBase}</small>`:''}</div>${pokemonTrainingState.moveMethod==='egg_tutor'&&o.eggTutorUsed?'<p class="mini-warning">Egg Tutor has already been used for this Pokémon.</p>':''}${m.tutorRestriction?.applies&&m.tutorRestriction?.message?`<p class="mini-warning ${m.tutorRestriction.valid?'ok':''}">${esc(m.tutorRestriction.message)}</p>`:''}<button class="btn ${blocked?'btn-disabled':'btn-primary'}" ${blocked?'disabled':''} onclick="learnPokemonTrainingMove('${m.id}')">${m.alreadyKnown?'Known':o.eggTutorUsed&&m.method==='egg_tutor'?'Already used':'Learn'}</button></article>`;
  }).join('')||'<p class="muted">No compatible Moves match this filter.</p>';
  const owned=(p.details?.pokeEdges||[]).map((e,index)=>`<div class="ledger-row edge-owned-row"><span>◆</span><div><strong>${esc(e.name)}</strong><small>${e.rank>1?`Rank ${e.rank} · `:''}${e.cost} TP${e.targetNote?` · ${esc(e.targetNote)}`:''}</small></div><div class="row-gap">${chip(e.gmOverride?'GM OVERRIDE':'POKÉ EDGE',e.gmOverride?'chip-red':'chip-blue')}<button class="btn btn-danger btn-small" onclick="refundPokeEdge(${index})">Refund</button></div></div>`).join('')||'<p class="muted">No Poké Edges acquired yet.</p>';
  const trained=(p.details?.moves||[]).filter(m=>['tm','hm','tm_hm','tutor','natural_tutor','egg_tutor','archive_tutor'].includes(String(m.source||'').toLowerCase())).map(m=>{const src=moveSourceInfo(m);return `<div class="ledger-row"><span>↗</span><div><strong>${esc(m.name)}</strong><small>Learned through ${esc(src.longLabel)} · Lv. ${m.learnedAt||p.level}${m.cost!=null?` · ${m.cost} TP`:''}</small></div><div class="row-gap">${chip(src.label,src.tone)}${m.countsAsNatural?chip('NATURAL','chip-green'):chip('POOL','chip-purple')}</div></div>`}).join('')||'<p class="muted">No Moves learned through advanced training yet.</p>';
  return `<div class="page">${header}
    <div class="training-kpis"><div><strong>${o.tutorPoints.remaining}</strong><span>Tutor Points remaining</span><small>${o.tutorPoints.spent} spent / ${o.tutorPoints.earned} earned</small></div><div><strong>${o.tutorMovePool.used} / ${o.tutorMovePool.limit}</strong><span>TM / Tutor Move Pool</span><small>Natural Tutor and Level-Up-listed Moves do not consume this pool.</small></div><div><strong>${o.moveSlots?.used??(p.details?.moves||[]).length} / ${o.moveSlots?.limit??p.details?.moveLimitEffective??6}</strong><span>Move slots used</span><small>Moves granted by Advanced Connection are free slots.</small></div></div>
    <label class="training-search">Search training options<input id="pokemon-training-search" value="${esc(pokemonTrainingState.query)}" oninput="setPokemonTrainingQuery(this.value)" placeholder="Move or Poké Edge…"/></label>
    <div class="training-layout">
      ${section(`POKÉ EDGES · ${(o.edges||[]).length}`,`<div class="training-edge-grid">${edgeCards}</div><div class="flow-note"><strong>Rule behavior:</strong> level/capability prerequisites are evaluated by the local Rules Engine. Ambiguous or narrative prerequisites require explicit confirmation. Use Refund for sheet-correction mistakes. In the tabletop rules, Corrective Learning is the explicit Mentor feature that removes a Poké Edge/Feature effect and refunds its Tutor Points.</div>`)}
      ${section('MOVE TRAINING',`<div class="segmented training-tabs"><button class="${pokemonTrainingState.moveMethod==='tm_hm'?'active':''}" onclick="setPokemonTrainingMethod('tm_hm')">TM / HM</button><button class="${pokemonTrainingState.moveMethod==='tutor'?'active':''}" onclick="setPokemonTrainingMethod('tutor')">Tutor</button><button class="${pokemonTrainingState.moveMethod==='egg_tutor'?'active':''}" onclick="setPokemonTrainingMethod('egg_tutor')">Egg Tutor</button></div><div class="training-move-list">${moveCards}</div><div class="flow-note"><strong>Teaching transaction:</strong> v1.5 records compatibility, Tutor Point cost, Move Pool use and replacement. Availability/consumption of the physical TM or the Trainer Feature performing the tutoring remains a table confirmation until Trainer Features and real shop inventory are linked.</div>`)}
    </div>
    <div class="training-layout ledger-layout">${section('OWNED POKÉ EDGES',`<div class="training-ledger">${owned}</div>`)}${section('TRAINED MOVES',`<div class="training-ledger">${trained}</div>`)}</div>
  </div>`;
}
async function beginPokemonTraining(){
  const p=pokemon(); if(!p?.details?.speciesDefinitionId) return toast('Advanced Training requires a rules-backed Pokémon.','error');
  pokemonTrainingState={pokemonId:p.id,loading:false,error:null,options:null,moveMethod:'tm_hm',query:''}; state.ui.screen='pokemontraining'; persist(); render(); await refreshPokemonTrainingOptions();
}
async function refreshPokemonTrainingOptions(){
  const p=pokemon(pokemonTrainingState.pokemonId); if(!p)return;
  pokemonTrainingState.loading=true; pokemonTrainingState.error=null; render();
  try{ const response=await fetch('/api/pokemon/training-options',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:p,rulesetId:catalogState.status?.activeRulesetId})}); const payload=await response.json(); if(!response.ok)throw new Error(payload.error||'Unable to resolve training options'); pokemonTrainingState.options=payload; }
  catch(error){pokemonTrainingState.error=error.message;} finally{pokemonTrainingState.loading=false;render();}
}
function setPokemonTrainingMethod(method){pokemonTrainingState.moveMethod=['tm_hm','tutor','egg_tutor'].includes(method)?method:'tm_hm';render();}
function setPokemonTrainingQuery(value){pokemonTrainingState.query=value;render();}
async function acquirePokeEdge(edgeId,targetStat=null){
  const p=pokemon(pokemonTrainingState.pokemonId); const edge=(pokemonTrainingState.options?.edges||[]).find(e=>e.id===edgeId); if(!p||!edge)return;
  let manualConfirm=false;
  if(edge.prerequisite?.valid==null){
    manualConfirm=!!(await styledConfirm({title:'Manual prerequisite check',message:`<p><strong>${esc(edge.name)}</strong> has a prerequisite that still depends on table context.</p><div class="dialog-warning">${esc(edge.prerequisites||edge.prerequisite?.reasons?.join(' · ')||'Manual prerequisite')}</div><p>Confirm that this Pokémon qualifies?</p>`,confirmLabel:'Qualifies',tone:'gold'}));
    if(!manualConfirm&&!state.ui.gmOverride)return;
  }
  let targetNote=''; let targetId=''; let targetKind=edge.targetKind||null; let statAllocation=null;
  if(edge.id==='attack-conflict'){
    if(!['attack','special_attack'].includes(targetStat))return toast('Attack Conflict must be bound to Attack or Special Attack.','error');
    targetNote=targetStat==='attack'?'Attack':'Special Attack'; targetId=targetStat; targetKind='stat';
  } else if(edge.targetRequired){
    const select=document.getElementById(`edge-target-${edge.id}`); targetId=select?.value||''; targetNote=select?.selectedOptions?.[0]?.textContent||'';
    if(!targetId)return toast(`${edge.name} requires a valid target selection.`,'error');
  } else if(/choose|select|pick|increase one|target move|different skill|movement capability/i.test(edge.effect||'') && !edge.allocationRequired){
    const v=await styledForm({title:`${edge.name} · Target`,subtitle:'This rule requires a target that is not yet structurally typed by the parser.',fields:[{name:'target',label:'Chosen target',placeholder:'Skill, Stat, Move, Ability, or Capability'}],submitLabel:'Use Target'}); if(!v)return; targetNote=String(v.target||'').trim();
  }
  if(edge.allocationRequired){
    const allowed=new Set(edge.allocationAllowedStats||[]); const points=Number(edge.allocationPoints||0);
    const statLabels={hp:'HP',attack:'Attack',defense:'Defense',special_attack:'Special Attack',special_defense:'Special Defense',speed:'Speed'};
    const fields=['hp','attack','defense','special_attack','special_defense','speed'].filter(k=>allowed.has(k)).map(k=>({name:k,label:statLabels[k],type:'number',value:0,min:0,max:points}));
    const allocation=await styledForm({title:`${edge.name} · Stat Allocation`,subtitle:`Distribute exactly ${points} bonus Stat Point${points===1?'':'s'}. These points are recorded on this Poké Edge and participate in Base Relations.`,fields,submitLabel:'Apply & Acquire'}); if(!allocation)return;
    statAllocation=Object.fromEntries(['hp','attack','defense','special_attack','special_defense','speed'].map(k=>[k,Math.max(0,Number(allocation[k]||0))]));
    const used=Object.values(statAllocation).reduce((a,b)=>a+b,0); if(used!==points)return toast(`${edge.name} requires exactly ${points} Stat Point${points===1?'':'s'}; you allocated ${used}.`,'error');
  }
  const response=await fetch('/api/pokemon/training-action-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'acquire_edge',pokemon:p,edgeId,targetNote,targetId,targetKind,targetStat,statAllocation,manualConfirm,gmOverride:state.ui.gmOverride,rulesetId:catalogState.status?.activeRulesetId})}); const payload=await response.json();
  if(!response.ok||!payload.valid) return toast((payload.errors||[payload.error||'Unable to acquire Poké Edge']).join(' '),'error');
  p.details=payload.details; if(Number(payload?.resolvedStatEffects?.maxHp)>0){p.maxHp=Number(payload.resolvedStatEffects.maxHp);p.hp=Math.min(p.hp,p.maxHp);await revalidatePokemonFormAfterDirectHpMutation(p.id,{hpChanged:true,tempHpChanged:false,silent:true});} invalidateCreatureReference(); trainer().history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Poké Edge acquired',detail:`${p.name}: ${payload.resultRecord.name} (${payload.cost} TP)`}); await commit(`${p.name} acquired ${payload.resultRecord.name}.`); await refreshPokemonTrainingOptions();
}
async function refundPokeEdge(edgeIndex){
  const p=pokemon(pokemonTrainingState.pokemonId); const edge=p?.details?.pokeEdges?.[edgeIndex]; if(!p||!edge)return;
  if(!(await styledConfirm({title:'Refund Poké Edge',message:`<p>Refund <strong>${esc(edge.name)}${edge.targetNote?` (${esc(edge.targetNote)})`:''}</strong>?</p><div class="dialog-warning">This is a sheet-correction convenience and returns ${Number(edge.cost||0)} Tutor Point${Number(edge.cost||0)===1?'':'s'}.</div>`,confirmLabel:'Refund Edge',tone:'gold'}))) return;
  const response=await fetch('/api/pokemon/training-action-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refund_edge',pokemon:p,edgeIndex,edgeInstanceId:edge.instanceId||null,rulesetId:catalogState.status?.activeRulesetId})});
  const payload=await response.json(); if(!response.ok||!payload.valid) return toast((payload.errors||[payload.error||'Unable to refund Poké Edge']).join(' '),'error');
  p.details=payload.details; if(Number(payload?.resolvedStatEffects?.maxHp)>0){p.maxHp=Number(payload.resolvedStatEffects.maxHp);p.hp=Math.min(p.hp,p.maxHp);await revalidatePokemonFormAfterDirectHpMutation(p.id,{hpChanged:true,tempHpChanged:false,silent:true});} invalidateCreatureReference(); trainer().history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Poké Edge refunded',detail:`${p.name}: ${edge.name}${edge.targetNote?` (${edge.targetNote})`:''}; +${payload.resultRecord?.refundedTutorPoints||0} TP`}); await commit(`${edge.name} refunded for ${p.name}.`); await refreshPokemonTrainingOptions();
}
async function learnPokemonTrainingMove(moveId){
  const p=pokemon(pokemonTrainingState.pokemonId); const o=pokemonTrainingState.options; const method=pokemonTrainingState.moveMethod; const move=(o?.moveTeaching?.[method]||[]).find(m=>m.id===moveId); if(!p||!move)return;
  if(!(await styledConfirm({title:`Teach ${move.name}`,message:`<p><strong>${esc(trainingMethodLabel(method))}</strong> → ${esc(p.name)}</p><p>This records the PTU training transaction. Confirm that the required TM/HM or tutoring Feature is available at the table.</p>`,confirmLabel:'Teach Move'}))) return;
  let replaceMoveId=null; const known=p.details?.moves||[]; const slotMoves=known.filter(m=>!m.connectionGrant?.moveSlotExempt); const limit=Number(o?.moveSlots?.limit??p.details?.moveLimitEffective??6);
  if(slotMoves.length>=limit){
    const v=await styledForm({title:'Move Limit reached',subtitle:`${p.name} uses ${slotMoves.length}/${limit} Move slots. Choose one to replace.`,fields:[{name:'move',label:'Replace Move',type:'select',value:slotMoves[0]?.id||'',options:slotMoves.map(m=>({value:m.id||String(m.name).toLowerCase().replace(/[^a-z0-9]+/g,'-'),label:m.name}))}],submitLabel:'Replace & Teach'}); if(!v)return; replaceMoveId=v.move;
  }
  const response=await fetch('/api/pokemon/training-action-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'learn_move',pokemon:p,method,moveId,replaceMoveId,gmOverride:state.ui.gmOverride,rulesetId:catalogState.status?.activeRulesetId})}); const payload=await response.json();
  if(!response.ok||!payload.valid) return toast((payload.errors||[payload.error||'Unable to learn Move']).join(' '),'error');
  p.details=payload.details; invalidateCreatureReference(); trainer().history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Move trained',detail:`${p.name}: ${payload.resultRecord.name} via ${trainingMethodLabel(method)} (${payload.cost} TP)`}); await commit(`${p.name} learned ${payload.resultRecord.name}.`); await refreshPokemonTrainingOptions();
}
function openAbilityCorrection(){
  const p=pokemon(); const data=creatureReferenceState.pokemonId===p?.id?creatureReferenceState.data:null;
  if(!p||!data) return toast('Open the Abilities tab and wait for Ruleset data to load first.','error');
  const slots=data.abilitySlots||[]; if(!slots.length) return toast('No native Ability slots are available for this Pokémon.','error');
  const current=p.details?.abilities||[];
  const rows=slots.map((slot,i)=>`<label class="ability-correction-row"><span><strong>${esc(slot.label)}</strong><small>Unlocked Lv. ${slot.unlockLevel} · ${esc((slot.allowedCategories||[]).join(' / '))}</small></span><select id="ability-correction-${i}"><option value="">Choose…</option>${(slot.options||[]).map(a=>`<option value="${esc(a.name)}" ${current[i]===a.name?'selected':''}>${esc(a.name)} · ${esc(a.category)}</option>`).join('')}</select></label>`).join('');
  modal(`<h2>Edit Native Ability Slots</h2><p class="muted">Use this to repair a missed Level 20/40 choice or correct a filling mistake. Granted Abilities such as Twisted Power are resolved separately and are not removed here.</p><div class="ability-correction-list">${rows}</div><div class="flow-note"><strong>GM Override:</strong> ${state.ui.gmOverride?'enabled — non-standard native choices can be accepted':'disabled — each choice must match the Species slot rules'}.</div><div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="applyAbilityCorrection()">Apply Ability Slots</button></div>`);
}
async function applyAbilityCorrection(){
  const p=pokemon(); const data=creatureReferenceState.pokemonId===p?.id?creatureReferenceState.data:null; if(!p||!data)return;
  const selected=(data.abilitySlots||[]).map((_,i)=>document.getElementById(`ability-correction-${i}`)?.value||'');
  try{
    const response=await fetch('/api/pokemon/ability-correction-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pokemon:p,selectedAbilities:selected,gmOverride:!!state.ui.gmOverride,rulesetId:catalogState.status?.activeRulesetId})});
    const payload=await response.json(); if(!response.ok||!payload.valid) return toast((payload.errors||[payload.error||'Unable to update Ability slots']).join(' '),'error');
    p.details=payload.details; closeModal(); invalidateCreatureReference(); commit(`${p.name} Ability slots updated.`); await loadCreatureReferenceData(true);
  }catch(error){toast(error.message||'Unable to update Ability slots.','error');}
}

function editorScreen(){
  const guidance=(evolutionGuidanceState?.customSuggestions||[]);
  const guideHtml=guidance.length?guidance.map(g=>`<div><strong>${esc(g.label)}</strong><span>${g.minimumLevels.slice(1).map((lvl,i)=>`Stage ${i+1} → ${i+2}: Lv. ${lvl}`).join(' · ')}</span><small>${Number(g.observedFamilies||0)} matching families in supplied PTU data</small></div>`).join(''):`<div><strong>Loading PTU guidance…</strong><span>Authoring suggestions will appear when the local definition server is available.</span></div>`;
  return `<div class="page editor-page">${heading('WINDOWS CONTENT EDITOR','Rules & Content Studio','Interactive mock editor remains available while real pack editing is implemented later.','<div class="row-gap"><button class="btn btn-gold" onclick="downloadJson(state,\'ptu-debug-state.json\')">Export State</button><button class="btn btn-primary" onclick="toast(\'Draft saved locally\')">Save Draft</button></div>')}<div class="editor-tabs"><button class="active">⚡ Move Editor</button><button>✦ Ability Editor</button><button>🐾 Species Editor</button><button>▦ Content Library</button></div><div class="editor-workspace">
  ${section('MOVE DEFINITION','<div class="form-grid"><label>Move Name<input value="Thunder Fang"/></label><label>Type<select><option>Electric</option></select></label><label>Category<select><option>Physical</option></select></label><label>Frequency<select><option>EOT</option></select></label><label>AC<input value="2"/></label><label>Damage Base<input value="6"/></label><label class="span-2">Range<input value="Melee, 1 Target"/></label><label class="span-2">Effect<textarea>The target may become Paralyzed on a high roll.</textarea></label></div><div class="toggle-grid"><label><input type="checkbox" checked/> Makes Contact</label><label><input type="checkbox"/> Interrupt</label><label><input type="checkbox" checked/> Affected by Guard</label></div>')}
  ${section('LIVE RESOLVED PREVIEW',`<div class="move-preview-big"><div class="row-between"><h2>Thunder Fang</h2><div>${typeBadge('electric')} ${chip('PHYSICAL','chip-red')}</div></div><div class="editor-formula">DB 6 → STAB 8 → <strong>2d6 + 23</strong></div><p>Editor values are mock content; the production rules engine will resolve formulas.</p></div>`)}
  ${section('VALIDATION','<ul class="validation-list"><li>✓ Required fields complete</li><li>✓ Damage Base is valid</li><li>✓ Type reference resolves</li><li>✓ Frequency is structured</li><li class="warn">⚠ Effect remains partially narrative</li></ul>')}
  ${section('PTU EVOLUTION AUTHORING GUIDE',`<div class="flow-note"><strong>Source policy:</strong> progression Levels come from <code>ptu_evolution_edges</code>, which is built from the enabled PTU materials. The canonical/current video-game Pokédex relationship table never supplies progression Levels.</div><div class="evolution-template-grid">${guideHtml}</div><p class="muted">These are authoring suggestions derived from observed patterns in the supplied PTU material, not hard rules. Custom Species may override the suggested minimum Level and add item, TM, gender, friendship, or narrative conditions.</p>`)}
  ${section('NEXT IMPLEMENTATION STEP','<p>This editor is intentionally not mutating the PTU Content Pack registry yet. The functional MVP focuses first on campaign/profile state.</p><button class="btn btn-ghost full" onclick="openSaveTools()">Open Save Tools</button>')}
  </div></div>`;
}

function render({preserveScroll=true}={}){
  const screens={dashboard,trainer:trainerScreen,rosters:rostersScreen,combat:pokemonCombatScreen,creature:creatureScreen,pokemonbuilder:pokemonBuilderScreen,pokemonprogress:pokemonProgressionScreen,pokemontraining:pokemonTrainingScreen,pokemonrestat:pokemonRestatScreen,storage:storageScreen,inventory:inventoryScreen,shop:shopScreen,library:libraryScreen,npcs:npcsScreen,levelup:levelupScreen,editor:editorScreen};
  const f=screens[state.ui.screen]||dashboard;
  const previous=document.querySelector('.screen-content');
  const sameScreen=lastRenderedScreen===state.ui.screen;
  const scroll=previous&&preserveScroll&&sameScreen?{top:previous.scrollTop,left:previous.scrollLeft}:null;
  const nestedScroll=previous&&preserveScroll&&sameScreen?[...previous.querySelectorAll('*')].flatMap(el=>{if(!el.scrollTop&&!el.scrollLeft)return[];const path=[];for(let node=el;node&&node!==previous;node=node.parentElement)path.unshift(Array.prototype.indexOf.call(node.parentElement.children,node));return[{path,top:el.scrollTop,left:el.scrollLeft}];}):[];
  const active=document.activeElement;
  const focusState=active&&active.id?{id:active.id,start:active.selectionStart,end:active.selectionEnd}:null;
  document.getElementById('app').innerHTML=shell(f());
  lastRenderedScreen=state.ui.screen;
  requestAnimationFrame(()=>{
    const current=document.querySelector('.screen-content');
    if(current){ if(scroll){current.scrollTop=scroll.top;current.scrollLeft=scroll.left;} else current.scrollTop=0; }
    if(focusState){ const el=document.getElementById(focusState.id); if(el){el.focus(); try{if(focusState.start!=null)el.setSelectionRange(focusState.start,focusState.end??focusState.start)}catch{}} }
    if(current){for(const saved of nestedScroll){const el=saved.path.reduce((parent,index)=>parent?.children[index]??null,current);if(el){el.scrollTop=saved.top;el.scrollLeft=saved.left;}}}
  });
}

async function editPokemonIdentity(id=state.selectedPokemonId){
  const p=pokemon(id); if(!p)return; p.details=p.details||{};
  const currentGender=normalizePokemonGender(p.details.gender??p.gender??p.sex??'None'); const currentShiny=!!p.details.isShiny;
  const values=await styledForm({title:'Edit Pokémon Identity',subtitle:`Species remains ${p.species}. Change the Pokémon's displayed name, Loyalty, Sex, and Shiny appearance state.`,fields:[{name:'name',label:'Name / Nickname',value:p.name||p.species||''},{name:'loyalty',label:'Loyalty',type:'number',min:0,max:6,value:Math.max(0,Math.min(6,Number(p.loyalty)||0))},{name:'gender',label:'Sex',type:'select',value:currentGender,options:[{value:'None',label:'None'},{value:'Male',label:'Male'},{value:'Female',label:'Female'}]},{name:'shiny',label:'Shiny',type:'select',value:currentShiny?'yes':'no',options:[{value:'no',label:'No'},{value:'yes',label:'Yes — Shiny appearance'}]}],submitLabel:'Save Changes'});
  if(!values)return;
  const name=String(values.name||'').trim(); if(!name)return toast('Pokémon name cannot be empty.','error');
  const loyalty=Math.max(0,Math.min(6,Math.trunc(Number(values.loyalty)||0))); const gender=normalizePokemonGender(values.gender); const shiny=String(values.shiny)==='yes'; const oldName=p.name; const oldLoyalty=Number(p.loyalty||0); const oldGender=currentGender; const oldShiny=currentShiny;
  p.name=name; p.loyalty=loyalty; p.details.nickname=name; p.details.gender=gender; p.details.isShiny=shiny;
  trainer().history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Pokémon identity updated',detail:`${oldName} → ${name}; Loyalty ${oldLoyalty} → ${loyalty}; Sex ${oldGender} → ${gender}; Shiny ${oldShiny?'Yes':'No'} → ${shiny?'Yes':'No'}`});
  if(oldShiny!==shiny)invalidateCreatureReference(); await commit(`${name} updated · Loyalty ${loyalty} · Sex ${gender}${shiny?' · Shiny':''}.`); if(oldShiny!==shiny)setTimeout(()=>loadCreatureReferenceData(true),0);
}

async function editPokemonNotes(id=state.selectedPokemonId){
  const p=pokemon(id); if(!p)return;
  p.details=p.details&&typeof p.details==='object'?p.details:{};
  const stored=p.details.notes;
  const current=Array.isArray(stored)?stored.map(value=>String(value??'')).join('\n'):typeof stored==='string'?stored.replace(/\r\n?/g,'\n'):'';
  const values=await styledForm({title:`Pokémon Notes · ${p.name}`,subtitle:'Freeform notes stored only with this individual Pokémon.',fields:[{name:'notes',label:'Notes',type:'textarea',rows:10,value:current,placeholder:'Habits, injuries, clues, training reminders…'}],submitLabel:'Save Notes'});
  if(!values)return;
  const next=String(values.notes??'').replace(/\r\n?/g,'\n');
  if(next===current)return;
  p.details.notes=next;
  persist();
  toast(`${p.name} notes updated.`);
}


function formEventSlug(value){return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
function syncPokemonTempHpPersistence(p){
  if(!p)return;p.details=p.details&&typeof p.details==='object'?p.details:{};p.tempHp=Math.max(0,Number(p.tempHp??p.details.tempHp??0));p.details.tempHp=p.tempHp;
  if(!p.details.formTempHpBySource||typeof p.details.formTempHpBySource!=='object'||Array.isArray(p.details.formTempHpBySource))p.details.formTempHpBySource={};
}

function clearPokemonFormTempHpTracking(p){
  if(!p)return;syncPokemonTempHpPersistence(p);p.tempHp=0;p.details.tempHp=0;p.details.formTempHpBySource={};delete p.details.formTempHpBlockOtherSources;
}
function pokemonFormStateSnapshot(p){
  const state=p?.details?.formState||{};return {baseFormId:formEventSlug(state.baseFormId||'base')||'base',activeFormId:state.activeFormId==null?null:(formEventSlug(state.activeFormId)||null)};
}
function pokemonFormStateLabel(formState={},forms=[]){
  const display=id=>{const key=formEventSlug(id||'base')||'base';if(key==='base')return 'Canonical Base';const match=(forms||[]).find(form=>formEventSlug(form?.id)===key);return match?.name||String(id||'Canonical Base');};
  const base=display(formState.baseFormId||'base'),active=formState.activeFormId==null?null:display(formState.activeFormId);return active?`${base} + ${active}`:base;
}
function pokemonFormAppliedRuleSummary(payload){
  const notes=[];for(const transition of (payload?.transitions||[]))for(const rule of (transition?.appliedRules||[])){const bits=[rule.frequency,rule.actionCost].filter(Boolean);if(bits.length)notes.push(bits.join(' · '));}
  return [...new Set(notes)].join('; ');
}
function recordPokemonFormLifecycleFeedback(p,beforeState,payload,event,{silent=false}={}){
  if(!p||!payload?.valid)return {formChanged:false,blockedTempHp:0};
  const afterState=pokemonFormStateSnapshot(p);const formChanged=beforeState.baseFormId!==afterState.baseFormId||beforeState.activeFormId!==afterState.activeFormId;
  const blockedTempHp=Math.max(0,Number(payload?.hpAdjustment?.blockedTempHp||0));const history=trainer()?.history;const formDefinitions=Array.isArray(payload?.baseSpecies?.forms)?payload.baseSpecies.forms:[];
  if(formChanged&&Array.isArray(history)){
    const ruleSummary=pokemonFormAppliedRuleSummary(payload);history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Pokémon Form changed',detail:`${p.name}: ${pokemonFormStateLabel(beforeState,formDefinitions)} → ${pokemonFormStateLabel(afterState,formDefinitions)}${ruleSummary?` · ${ruleSummary}`:''}`});
    if(!silent)toast(`${p.name}: Form ${pokemonFormStateLabel(beforeState,formDefinitions)} → ${pokemonFormStateLabel(afterState,formDefinitions)}.`);
  }
  if(blockedTempHp>0&&Array.isArray(history)){
    history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Temporary HP blocked',detail:`${p.name}: ${blockedTempHp} Temporary HP blocked by the active Form source rule.`});
    if(!silent)toast(`${p.name}: ${blockedTempHp} Temporary HP blocked by the active Form rule.`,'error');
  }
  return {formChanged,blockedTempHp};
}
async function revalidatePokemonFormAfterDirectHpMutation(id,{hpChanged=true,tempHpChanged=false,silent=true}={}){
  const p=pokemon(id);if(!p?.details?.speciesDefinitionId)return null;let payload=null;
  if(hpChanged)payload=await applyPokemonFormGameEventUi(id,{kind:'hp-changed'},{silent,commitAfter:false});
  if(tempHpChanged)payload=await applyPokemonFormGameEventUi(id,{kind:'temp-hp-changed'},{silent,commitAfter:false});
  return payload;
}

async function applyPokemonFormGameEventUi(id,event,{silent=false,commitAfter=true,message=null}={}){
  const p=pokemon(id);if(!p)return null;syncPokemonTempHpPersistence(p);
  if(!p.details?.speciesDefinitionId)return null;const beforeFormState=pokemonFormStateSnapshot(p);
  try{
    const response=await fetch('/api/pokemon/forms/apply-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      pokemon:p,event,rulesetId:catalogState.status?.activeRulesetId||p.details.linkedRulesetId||null,gmOverride:!!state.ui.gmOverride,
      currentHp:p.hp,maxHp:p.maxHp,tempHp:p.tempHp,tempHpBySource:p.details.formTempHpBySource||{},inCombat:!!state.ui.inCombat,
      manualFormApprovals:p.details.manualFormApprovals||[]
    })});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.valid){
      if(!silent)toast((payload.errors||[payload.error||'Form event could not be applied.']).join(' '),'error');
      return payload;
    }
    if(payload.pokemon){Object.assign(p,payload.pokemon);syncPokemonTempHpPersistence(p);}
    const feedback=recordPokemonFormLifecycleFeedback(p,beforeFormState,payload,event,{silent});
    if(payload.changed){invalidateCreatureReference();if(commitAfter)commit(message||`${p.name} state updated.${feedback.formChanged?' Form changed.':''}`);}
    else if(!silent&&commitAfter)toast('No Pokémon Form lifecycle change was triggered.');
    return {...payload,lifecycleFeedback:feedback};
  }catch(error){if(!silent)toast(error.message,'error');return null;}
}
function pokemonMoveRaisesDefenseCombatStages(def={}){
  const category=String(def?.category||def?.class||def?.raw?.category||'').toLowerCase();if(category!=='status')return false;
  const effect=String(def?.effect||def?.raw?.effect||'');
  return /(?:raise|raises|raised|increase|increases|increased|gain|gains)\b[^.\n]{0,90}\bDefense\b[^.\n]{0,40}\bCombat Stage/i.test(effect)
    || /\bDefense\b[^.\n]{0,40}\bCombat Stage[^.\n]{0,90}(?:raise|increase|gain)/i.test(effect);
}
async function usePokemonMoveForForms(id,index){
  const p=pokemon(id);const data=creatureReferenceState.pokemonId===id?creatureReferenceState.data:null;const row=(data?.moves||[])[Number(index)];if(!p||!row)return toast('Move reference data is unavailable.','error');
  const def=row.definition||{};const tags=moveKeywordEntries(def||row.record||{}).map(entry=>entry.name);
  const payload=await applyPokemonFormGameEventUi(id,{kind:'move-used',move:def.name||row.record?.name||row.record?.id||'',moveClass:def.category||def.class||null,damaging:pokemonMoveIsDamaging(row),raisesDefenseCombatStages:pokemonMoveRaisesDefenseCombatStages(def),tags},{message:`${p.name} used ${def.name||row.record?.name||'a Move'}.`});
  if(payload?.changed&&state.selectedPokemonId===id&&state.ui.screen==='creature')await loadCreatureReferenceData(true);
}
async function usePokemonNamedAbilityForForms(id,ability){const p=pokemon(id);if(!p)return;const spec=pokemonCombatAbilityResourceSpec(ability);await pokemonCombatApplyNonMoveFormEvent(id,{kind:'ability-used',ability},spec,{message:`${p.name} used ${ability}.`});}
async function usePokemonAbilityForForms(id,index){
  const p=pokemon(id);const data=creatureReferenceState.pokemonId===id?creatureReferenceState.data:null;const row=(data?.abilities||[])[Number(index)];if(!p||!row)return toast('Ability reference data is unavailable.','error');
  await usePokemonNamedAbilityForForms(id,row.name);
}
async function usePokemonCapabilityForForms(id,capability,triggerItem){
  const p=pokemon(id);if(!p)return;
  const hasItem=!triggerItem||formEventSlug(p.heldItem)===formEventSlug(triggerItem)||(state.inventory||[]).some(item=>Number(item.qty||0)>0&&formEventSlug(item.name)===formEventSlug(triggerItem));
  if(!hasItem&&!state.ui.gmOverride)return toast(`${triggerItem} is required for ${capability}.`,'error');
  const spec=pokemonCombatCapabilityResourceSpec(capability,'activate');await pokemonCombatApplyNonMoveFormEvent(id,{kind:'capability-used',capability,triggerItem},spec,{message:`${p.name} used ${capability}.`});
}
async function usePokemonFormActionForForms(id,actionId,extra={}){const p=pokemon(id);if(!p)return;const spec=pokemonCombatFormActionResourceSpec(actionId);await pokemonCombatApplyNonMoveFormEvent(id,{kind:'form-action',actionId,...extra},spec,{message:`${p.name} Form action applied.`});}
function pokemonFormLifecycleControls(forms,stateForm,p){
  const ids=new Set((forms||[]).map(form=>formEventSlug(form.id))),buttons=[];const button=(label,onclick,spec,tone='btn-ghost')=>{const available=spec?pokemonCombatNonMoveAvailability(p.id,spec):{valid:true};return `<button class="btn ${available.valid?tone:'btn-disabled'} btn-small" ${available.valid?'':`disabled title="${esc(available.reason||'Unavailable')}"`} onclick="${onclick}">${label}</button>`;};
  if(ids.has('schooling')&&stateForm.activeFormId!=='schooling')buttons.push(button('Schooling · Daily Free Action',`usePokemonNamedAbilityForForms('${p.id}','Schooling')`,pokemonCombatAbilityResourceSpec('Schooling'),'btn-gold'));
  if((ids.has('complete-from-10-percent')||ids.has('complete-from-50-percent'))&&!String(stateForm.activeFormId||'').startsWith('complete-from-'))buttons.push(button('Power Construct · Daily Swift Action',`usePokemonNamedAbilityForForms('${p.id}','Power Construct')`,pokemonCombatAbilityResourceSpec('Power Construct'),'btn-gold'));
  if(ids.has('noice-face'))buttons.push(button('Restore Ice Face · Standard Action · Hail',`usePokemonFormActionForForms('${p.id}','ice-face-hail-restore',{weather:'Hail'})`,pokemonCombatFormActionResourceSpec('ice-face-hail-restore')));
  if(ids.has('crowned-sword'))buttons.push(stateForm.activeFormId==='crowned-sword'?button('Relinquish Crowned Sword · Extended Action',`usePokemonFormActionForForms('${p.id}','weapon-bond-relinquish')`,pokemonCombatFormActionResourceSpec('weapon-bond-relinquish')):button('Weapon Bond · Ancestral Sword · Extended Action',`usePokemonCapabilityForForms('${p.id}','Weapon Bond','Ancestral Sword')`,pokemonCombatCapabilityResourceSpec('Weapon Bond'),'btn-gold'));
  if(ids.has('crowned-shield'))buttons.push(stateForm.activeFormId==='crowned-shield'?button('Relinquish Crowned Shield · Extended Action',`usePokemonFormActionForForms('${p.id}','weapon-bond-relinquish')`,pokemonCombatFormActionResourceSpec('weapon-bond-relinquish')):button('Weapon Bond · Ancestral Shield · Extended Action',`usePokemonCapabilityForForms('${p.id}','Weapon Bond','Ancestral Shield')`,pokemonCombatCapabilityResourceSpec('Weapon Bond'),'btn-gold'));
  return buttons.length?`<div class="flow-note"><strong>Source lifecycle actions</strong><div class="row-gap">${buttons.join('')}</div><small>Combat Actions and Scene/Daily uses share the Pokémon Combat ledger. Extended Actions remain source-labeled but are not converted into turn actions.</small></div>`:'';
}
async function setPokemonBattleState(active){
  state.ui.inCombat=!!active;const event={kind:active?'battle-start':'battle-end'};
  for(const p of activePokemon())if(p?.details?.speciesDefinitionId)await applyPokemonFormGameEventUi(p.id,event,{silent:true,commitAfter:false});
  commit(active?'Battle started. Form battle-start hooks applied.':'Battle ended. Out-of-combat Form state revalidated.');
}


/* --- Battle state --- */
async function changeHp(id,delta){
  const p=pokemon(id);if(!p)return;
  if(p.details?.speciesDefinitionId){
    const payload=await applyPokemonFormGameEventUi(id,{kind:'hp-adjust',delta:Number(delta)||0},{silent:true,commitAfter:false});
    if(payload?.valid){const updated=pokemon(id);commit(updated.tempHp?`${updated.name} HP: ${updated.hp}/${updated.maxHp} +${updated.tempHp} Temporary HP`:`${updated.name} HP: ${updated.hp}/${updated.maxHp}`);return;}
  }
  const amount=Number(delta)||0;p.tempHp=tempHpValue(p);p.hp=Math.max(0,Math.min(Number(p.maxHp||0),Number(p.hp||0)));
  if(amount>0){const missing=Math.max(0,injuryHealingHpLimit(p.maxHp,p.injuries)-p.hp);const restored=Math.min(amount,missing);p.hp+=restored;p.tempHp+=Math.max(0,amount-restored);}
  else if(amount<0){let damage=-amount;const absorbed=Math.min(p.tempHp,damage);p.tempHp-=absorbed;damage-=absorbed;p.hp=Math.max(0,p.hp-damage);}
  syncPokemonTempHpPersistence(p);commit(p.tempHp?`${p.name} HP: ${p.hp}/${p.maxHp} +${p.tempHp} Temporary HP`:`${p.name} HP: ${p.hp}/${p.maxHp}`);
}
function changeInjury(id,delta){ const p=pokemon(id); p.injuries=Math.max(0,Math.min(10,p.injuries+delta)); commit(`${p.name} injuries: ${p.injuries}`); }
function changeStage(id,key,delta){ const p=pokemon(id); p.combatStages[key]=Math.max(-6,Math.min(6,(p.combatStages[key]||0)+delta)); commit(); }
function nextRound(){ state.ui.round+=1; pokemonCombatOnRoundAdvance(); commit(`Round ${state.ui.round}`); }
async function endScene(){ state.ui.scene+=1; state.ui.round=1; for(const p of state.pokemon){Object.keys(p.combatStages).forEach(k=>p.combatStages[k]=0);if(p?.details?.speciesDefinitionId)await applyPokemonFormGameEventUi(p.id,{kind:'scene-end'},{silent:true,commitAfter:false});} pokemonCombatOnSceneAdvance(); commit(`Scene ${state.ui.scene}. Combat stages reset; Form scene-end hooks applied.`); }
function newDay(){ state.ui.day+=1; state.ui.scene=1; state.ui.round=1; pokemonCombatOnDayAdvance(); commit(`Day ${state.ui.day}`); }

/* --- Rosters / Storage --- */
function addPokemonToRoster(pid,rid){ const p=pokemon(pid), r=roster(rid); if(p.storage) return toast('Stored Pokémon must be withdrawn first.','error'); if(p.rosterIds.includes(rid)) return; if(rosterMembers(rid).length>=r.maxMembers) return toast(`${r.name} is full.`,'error'); p.rosterIds.push(rid); commit(`${p.name} added to ${r.name}.`); }
function removePokemonFromRoster(pid,rid){ const p=pokemon(pid), r=roster(rid); p.rosterIds=p.rosterIds.filter(x=>x!==rid); commit(`${p.name} removed from ${r.name}.`); }
async function createRoster(){
  const values=await styledForm({title:'Create Roster',subtitle:'A Pokémon may belong to multiple Rosters at the same time.',fields:[{name:'name',label:'Roster name',value:''},{name:'role',label:'Role',type:'select',value:'OTHER',options:['COMBAT','COMPANY','MOUNT','INVESTIGATION','OTHER']},{name:'max',label:'Maximum members',type:'number',min:1,max:99,value:6}],submitLabel:'Create Roster'}); if(!values||!String(values.name||'').trim())return;
  const name=String(values.name).trim(),role=String(values.role||'OTHER').toUpperCase(),max=Math.max(1,Number(values.max)||6);
  const colors=['#0b7b4b','#2f6dda','#e99a19','#704170','#E62829'];
  const id=uid('roster'); state.rosters.push({id,name,role,maxMembers:max,active:true,color:colors[state.rosters.length%colors.length]}); state.selectedRosterId=id; commit(`Roster ${name} created.`);
}
async function editRoster(id=state.selectedRosterId){
  const r=roster(id); if(!r)return;
  const memberCount=rosterMembers(r.id).length;
  const values=await styledForm({title:`Edit Roster · ${r.name}`,subtitle:'Roster identity and capacity can change without removing Pokémon memberships.',fields:[{name:'name',label:'Roster name',value:r.name||''},{name:'role',label:'Role',type:'select',value:String(r.role||'OTHER').toUpperCase(),options:['COMBAT','COMPANY','MOUNT','INVESTIGATION','OTHER']},{name:'max',label:'Maximum members',type:'number',min:Math.max(1,memberCount),max:99,value:Math.max(memberCount,Number(r.maxMembers)||6),help:memberCount?`This roster currently has ${memberCount} member${memberCount===1?'':'s'}.`:''},{name:'status',label:'Dashboard status',type:'select',value:r.active===false?'hidden':'active',options:[{value:'active',label:'Active — show on dashboard'},{value:'hidden',label:'Hidden — keep roster, hide from dashboard'}]},{name:'color',label:'Roster color',type:'color',value:/^#[0-9a-f]{6}$/i.test(String(r.color||''))?r.color:'#2f6dda'}],submitLabel:'Save Roster'});
  if(!values)return;
  const name=String(values.name||'').trim(); if(!name)return toast('Roster name cannot be empty.','error');
  const allowedRoles=new Set(['COMBAT','COMPANY','MOUNT','INVESTIGATION','OTHER']); const role=String(values.role||'OTHER').toUpperCase(); if(!allowedRoles.has(role))return toast('Choose a valid Roster role.','error');
  const max=Math.max(1,Math.min(99,Math.trunc(Number(values.max)||0))); if(max<memberCount)return toast(`${r.name} currently has ${memberCount} member${memberCount===1?'':'s'}; remove members before lowering the limit below that count.`,'error');
  const color=/^#[0-9a-f]{6}$/i.test(String(values.color||''))?String(values.color):r.color;
  r.name=name; r.role=role; r.maxMembers=max; r.active=String(values.status||'active')!=='hidden'; r.color=color;
  commit(`Roster ${name} updated.`);
}
async function deleteRoster(id=state.selectedRosterId){
  const r=roster(id); if(!r)return;
  if(state.rosters.length<=1)return toast('Create another Roster before deleting the final Roster.','error');
  const memberCount=rosterMembers(r.id).length;
  const ok=await styledConfirm({title:`Delete Roster · ${r.name}?`,message:`<p>Deleting a Roster does not delete any Pokémon. It only removes this Roster and its membership links.</p>${memberCount?`<div class="dialog-warning">${memberCount} Pokémon ${memberCount===1?'is':'are'} currently assigned here. ${memberCount===1?'It':'They'} will remain in this Trainer profile and in any other Rosters.</div>`:'<div class="dialog-warning">The Roster is empty; only the Roster itself will be removed.</div>'}`,confirmLabel:'Delete Roster',danger:true});
  if(!ok)return;
  state.rosters=state.rosters.filter(x=>x.id!==r.id);
  for(const p of state.pokemon)p.rosterIds=(p.rosterIds||[]).filter(rid=>rid!==r.id);
  if(state.selectedRosterId===r.id||!state.rosters.some(x=>x.id===state.selectedRosterId))state.selectedRosterId=state.rosters[0]?.id||null;
  commit(`Roster ${r.name} deleted. Pokémon were kept.`);
}
async function storePokemon(id){
  const p=pokemon(id); if(p.injuries>0) return toast(`${p.name} cannot enter Storage with Injuries.`,'error');
  if(p.heldItem) returnHeldItemToBackpack(p);
  p.storage=true;p.hp=p.maxHp;clearPokemonFormTempHpTracking(p);Object.keys(p.combatStages).forEach(k=>p.combatStages[k]=0);
  await revalidatePokemonFormAfterDirectHpMutation(id,{hpChanged:true,tempHpChanged:true,silent:true});commit(`${p.name} moved to Storage. Temporary HP and Form THP provenance cleared.`);
}
async function withdrawPokemon(id){
  const p=pokemon(id);if(!p)return;p.storage=false;p.hp=Math.min(p.maxHp,Math.max(Number(p.hp||0),injuryHealingHpLimit(p.maxHp,p.injuries)));clearPokemonFormTempHpTracking(p);
  await revalidatePokemonFormAfterDirectHpMutation(id,{hpChanged:true,tempHpChanged:true,silent:true});commit(`${p.name} withdrawn from Storage. Temporary HP and Form state revalidated.`);
}

/* --- Inventory --- */
async function useItem(itemId,pid){
  const i=inventoryItem(itemId),p=pokemon(pid);if(!i||i.qty<=0)return toast('No item available.','error');
  if(supportsAutomatedItemUse(i)&&p.hp>=injuryHealingHpLimit(p.maxHp,p.injuries))return toast(`${p.name} is already at its current healing limit; ${i.name} was not used.`,'error');
  const healing=i.id==='potion'?20:i.id==='super-potion'?50:i.id==='oran-berry'?10:null;
  if(healing==null)return toast(`${i.name} use is not automated in this prototype.`,'error');
  if(p.details?.speciesDefinitionId){
    const payload=await applyPokemonFormGameEventUi(pid,{kind:'hp-adjust',delta:healing},{silent:false,commitAfter:false});if(!payload?.valid)return;
  }else p.hp=Math.min(injuryHealingHpLimit(p.maxHp,p.injuries),p.hp+healing);
  i.qty-=1;commit(`${i.name} used on ${p.name}.`);
}

/* --- Shop --- */
function trainerEquipmentPayload(item,config=null){
  return {id:item.id,name:item.name,icon:item.icon||null,definitionId:item.definitionId||null,inventoryItemId:item.id,mechanics:item.mechanics||null,config:config??item.config??{}};
}
async function equipmentConfigForItem(item){
  const spec=item?.equipmentConfig;const fields=Array.isArray(spec?.fields)?spec.fields:[];
  if(!fields.length)return structuredClone(item?.config||{});
  const prepared=fields.map(field=>{const options=Array.isArray(field.options)?field.options:[];const current=item?.config?.[field.name];const first=options[0];const fallback=typeof first==='object'?first.value:first;return {...field,value:current??field.value??fallback??''};});
  const values=await styledForm({title:`Configure ${item.name}`,subtitle:'This configuration belongs to the equipped copy and is used by the Trainer Rules Engine.',fields:prepared,submitLabel:'Equip'});
  return values?values:null;
}
function returnEquippedToBackpack(value){
  if(!value||typeof value!=='object'||value.reservedBy)return;
  const id=value.inventoryItemId||value.id;const inv=inventoryItem(id);if(inv)inv.qty=(inv.qty||0)+1;
}
async function equipTrainerItem(id){
  const item=inventoryItem(id),slots=itemEquipmentSlots(item);if(!item||!slots.length||item.qty<=0)return toast('That equipment is not available in the Backpack.','error');
  let slot=slots[0];
  if(slots.length>1){
    const choice=await styledForm({title:`Equip ${item.name}`,subtitle:'This item can occupy more than one Trainer equipment slot. Choose where this copy is being worn/held.',fields:[{name:'slot',label:'Equipment Slot',type:'select',value:slot,options:slots.map(value=>({value,label:ITEM_SLOT_LABELS[value]||value}))}],submitLabel:'Equip'});
    if(!choice)return;slot=normalizeItemSlot(choice.slot);if(!slot)return;
  }
  const configured=await equipmentConfigForItem(item);if(configured===null)return;
  const t=trainer();ensureTrainerDetails(t);
  if(slot==='offHand'&&t.equipment.offHand?.reservedBy==='mainHand'){
    returnEquippedToBackpack(t.equipment.mainHand);t.equipment.mainHand=null;t.equipment.offHand=null;
  }
  const old=t.equipment[slot];if(old)returnEquippedToBackpack(old);
  if(slot==='mainHand'&&item.mechanics?.hands===2){
    const off=t.equipment.offHand;if(off&&!off.reservedBy)returnEquippedToBackpack(off);
    t.equipment.offHand={name:`Reserved · ${item.name}`,icon:item.icon||null,reservedBy:'mainHand',inventoryItemId:item.id};
  }else if(slot==='mainHand'&&t.equipment.offHand?.reservedBy==='mainHand')t.equipment.offHand=null;
  item.qty-=1;t.equipment[slot]={...trainerEquipmentPayload(item,configured),equippedSlot:slot};
  t.history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Equipment changed',detail:`Equipped ${item.name} · ${ITEM_SLOT_LABELS[slot]||slot}`});
  commit(`${item.name} equipped in ${ITEM_SLOT_LABELS[slot]||slot}; Trainer rules recalculated.`);
}
async function unequipTrainerItem(slot){
  const t=trainer();ensureTrainerDetails(t);const value=t.equipment[slot];if(!value)return;
  if(value?.reservedBy){toast('This slot is occupied by a two-handed weapon. Unequip the Main Hand item instead.','error');return;}
  returnEquippedToBackpack(value);t.equipment[slot]=null;
  if(slot==='mainHand'&&t.equipment.offHand?.reservedBy==='mainHand')t.equipment.offHand=null;
  commit(`${typeof value==='object'?value.name:value} returned to Backpack.`);
}
function setShopPreset(name,pct){
  state.shop.preset=name; state.shop.discountPct=pct; state.shop.cart={}; persist(); render();
  if(isCatalogStore(name)) loadItemCatalog().then(()=>{if(state.ui.screen==='shop'&&state.shop.preset===name)render();});
}
function setShopMode(mode){ state.shop.mode=mode; state.shop.cart={}; persist(); render(); if(isCatalogStore(state.shop.preset)&&mode==='buy')loadItemCatalog().then(render); }
function setShopDiscount(pct){ state.shop.discountPct=Math.max(-100,Math.min(500,pct||0)); commit(); }
function addCart(id){
  const i=shopLookupItem(id); if(!i)return toast('Shop item is unavailable.','error');
  if(state.shop.mode==='sell'){ const owned=inventoryItem(id); const already=state.shop.cart[id]||0; if(!owned||already>=Number(owned.qty||0)) return toast('Cannot sell more than you own.','error'); }
  state.shop.cart[id]=(state.shop.cart[id]||0)+1; commit();
}
function removeCart(id){ if(!state.shop.cart[id])return; state.shop.cart[id]-=1; if(state.shop.cart[id]<=0) delete state.shop.cart[id]; commit(); }
function ensureInventoryItemForPurchase(id){
  let owned=inventoryItem(id); if(owned)return owned;
  const source=shopLookupItem(id); if(!source)return null;
  owned={...structuredClone(source),qty:0}; state.inventory.push(owned); return owned;
}
function checkout(){
  const shop=state.shop; const base=Object.entries(shop.cart).reduce((sum,[id,q])=>sum+(shopLookupItem(id)?.price||0)*q,0); const pct=shop.mode==='sell'?-50:shop.discountPct; const total=Math.max(0,Math.round(base*(1+pct/100)));
  if(shop.mode==='buy'){
    if(trainer().money<total) return toast('Insufficient trainer money.','error');
    const purchased=[]; for(const [id,q] of Object.entries(shop.cart)){const item=ensureInventoryItemForPurchase(id);if(!item)return toast(`Shop item ${id} is unavailable.`,'error');purchased.push([item,q]);}
    trainer().money-=total; for(const [item,q] of purchased)item.qty=Number(item.qty||0)+Number(q||0); trainer().history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Shop purchase',detail:`${Object.values(shop.cart).reduce((a,b)=>a+b,0)} items · ${shop.preset} · ₽${total}`});
    shop.cart={}; commit(`Purchase completed for ₽${total}.`);
  }else{
    for(const [id,q] of Object.entries(shop.cart)){ const item=inventoryItem(id); if(!item||Number(item.qty||0)<q) return toast(`Not enough ${item?.name||id}.`,'error'); }
    trainer().money+=total; Object.entries(shop.cart).forEach(([id,q])=>inventoryItem(id).qty-=q); trainer().history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Item sale',detail:`Sold items · ${shop.preset} · ₽${total}`}); shop.cart={}; commit(`Items sold for ₽${total}.`);
  }
}

/* --- Trainer / GM grants / level up --- */
function toggleGmOverride(){ state.ui.gmOverride=!state.ui.gmOverride; commit(`GM Override ${state.ui.gmOverride?'enabled':'disabled'}.`); if(state.ui.screen==='pokemonbuilder') schedulePokemonBuildPreview(); }
async function editTrainer(){
  const t=trainer(); const values=await styledForm({title:'Edit Trainer Profile',subtitle:'Permanent profile details. Mechanical progression remains tracked separately.',fields:[{name:'name',label:'Trainer name',value:t.name},{name:'title',label:'Title / concept',value:t.title},{name:'money',label:'Money',type:'number',min:0,value:t.money},{name:'badges',label:'Badges',type:'number',min:0,value:t.badges}],submitLabel:'Save Profile'}); if(!values)return; t.name=String(values.name||'').trim()||t.name; t.title=String(values.title||'').trim()||t.title; if(Number.isFinite(values.money)&&values.money>=0)t.money=Math.floor(values.money); if(Number.isFinite(values.badges)&&values.badges>=0)t.badges=Math.floor(values.badges); commit('Trainer updated.');
}
async function editTrainerNotes(){
  const td=ensureTrainerDetails();
  const values=await styledForm({title:'Trainer Notes',subtitle:'Freeform campaign notes stored only with this Trainer profile.',fields:[{name:'notes',label:'Notes',type:'textarea',rows:10,value:td.notes,placeholder:'Contacts, goals, clues, reminders…'}],submitLabel:'Save Notes'});
  if(!values)return;
  const next=String(values.notes??'').replace(/\r\n?/g,'\n');
  if(next===td.notes)return;
  td.notes=next;
  persist();
  toast('Trainer notes updated.');
}
const GM_RESOURCE_TARGETS=[
  ['resource.edge','Extra Edge'],['resource.feature','Extra Feature'],['resource.stat_point','Extra Stat Point'],['resource.skill_edge','Extra Skill Edge'],['resource.training_feature','Extra Training Feature'],['resource.trainer_move','Extra Trainer Move']
];
function gmFixedTargets(){
  const stats=TRAINER_STAT_KEYS.map(k=>[`stat.${k}`,`Stat · ${prettyStat(k)}`]);
  const skills=TRAINER_SKILLS.map(k=>[`skill.${k}`,`Skill · ${k}`]);
  const caps=[['capability.power','Capability · Power'],['capability.overland','Capability · Overland'],['capability.swim','Capability · Swim'],['capability.highJump','Capability · High Jump'],['capability.longJump','Capability · Long Jump'],['capability.throwingRange','Capability · Throwing Range']];
  return [...stats,...skills,...caps,['derived.maxHp','Derived · Maximum HP'],['derived.maxAp','Derived · Maximum AP'],['evasion.physical','Evasion · Physical'],['evasion.special','Evasion · Special'],['evasion.speed','Evasion · Speed']];
}
function gmGrantTargetLabel(target){
  const all=[...GM_RESOURCE_TARGETS,...gmFixedTargets()]; return all.find(x=>x[0]===target)?.[1]||target||'Unlinked';
}
async function addGmGrant(){
  const step1=await styledForm({title:'Add GM Grant',subtitle:'Choose whether the grant is a fixed modifier or an extra build resource.',fields:[{name:'type',label:'Grant type',type:'select',value:'fixed',options:[{value:'fixed',label:'Fixed Grant'},{value:'resource',label:'Resource Grant'}]}],submitLabel:'Continue',tone:'gold'}); if(!step1)return;
  const type=step1.type==='resource'?'resource':'fixed'; const targets=type==='resource'?GM_RESOURCE_TARGETS:gmFixedTargets();
  const values=await styledForm({title:type==='resource'?'Resource Grant':'Fixed Grant',subtitle:type==='resource'?'The resource is bound to a known Trainer-sheet resource so it can survive respecs.':'Bind the permanent modifier to an existing Trainer-sheet field.',fields:[{name:'target',label:type==='resource'?'Resource':'Target',type:'select',value:targets[0]?.[0],options:targets.map(([value,label])=>({value,label}))},{name:'amount',label:type==='resource'?'Quantity':'Modifier',type:'number',value:type==='resource'?1:2},{name:'note',label:'Campaign note',placeholder:'Why the GM granted this'}],submitLabel:'Add Grant',tone:'gold'}); if(!values)return;
  const amount=Number(values.amount); if(!Number.isFinite(amount)||amount===0)return toast('Grant value must be a non-zero number.','error'); const target=String(values.target||''); const targetLabel=gmGrantTargetLabel(target); const value=`${amount>0?'+':''}${amount}`; const note=String(values.note||'').trim(); const label=`${value} ${targetLabel}${note?` · ${note}`:''}`;
  trainer().gmGrants.push({id:uid('gm'),type,label,target,value,createdAt:new Date().toISOString().slice(0,10)}); trainer().history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'GM Grant',detail:label}); commit('GM grant added.');
}
async function removeGmGrant(id){ if(!state.ui.gmOverride) return toast('Enable GM Override to remove a GM grant.','error'); const g=trainer().gmGrants.find(x=>x.id===id); if(!g)return; if(!(await styledConfirm({title:'Remove GM Grant',message:`<p>Remove <strong>${esc(g.label)}</strong> from the permanent campaign record?</p>`,confirmLabel:'Remove Grant',danger:true})))return; trainer().gmGrants=trainer().gmGrants.filter(x=>x.id!==id); commit('GM grant removed.'); }
function prettyStat(k){ return ({hp:'HP',attack:'Attack',defense:'Defense',spAttack:'Sp. Attack',spDefense:'Sp. Defense',speed:'Speed'})[k]||k; }
async function beginTrainerProgression(){
  const t=trainer(); if(Number(t.level||1)>=50){state.ui.screen='levelup';trainerProgressState={trainerId:t.id,loading:false,error:null,preview:{valid:false,errors:['Trainer is already at the maximum Level of 50.'],nextLevel:50,rewards:{baseStatPoints:0,totalFeatures:0,totalEdges:0,totalSkillEdges:0,milestone:{required:false,options:[]}}},draft:blankTrainerProgressDraft(),pickerKind:null,pickerQuery:''};persist();render();return;}
  trainerProgressState={trainerId:t.id,loading:true,error:null,preview:null,draft:blankTrainerProgressDraft(),pickerKind:null,pickerQuery:''}; state.ui.screen='levelup'; persist(); render(); await refreshTrainerProgressionPreview();
}
async function refreshTrainerProgressionPreview(){
  const t=trainer(); if(!t?.id)return; if(trainerProgressState.trainerId!==t.id)trainerProgressState={trainerId:t.id,loading:false,error:null,preview:null,draft:blankTrainerProgressDraft(),pickerKind:null,pickerQuery:''};
  trainerProgressState.loading=true; trainerProgressState.error=null; render();
  try{
    const response=await fetch('/api/trainer/progression-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trainer:t,draft:trainerProgressState.draft,gmOverride:!!state.ui.gmOverride,includeOptions:false})});
    const payload=await response.json(); if(!response.ok)throw new Error(payload.error||'Trainer progression preview unavailable');
    trainerProgressState.preview=payload.preview; trainerProgressState.loading=false; render();
  }catch(error){trainerProgressState.loading=false;trainerProgressState.error=error.message;render();}
}
function adjustTrainerProgressStat(stat,delta,offensive=false){
  if(!TRAINER_STAT_KEYS.includes(stat))return; const d=trainerProgressState.draft; const p=trainerProgressState.preview; if(!d||!p)return;
  const bucket=offensive?d.offensiveStatAllocations:d.statAllocations; const allowed=offensive?['attack','spAttack']:TRAINER_STAT_KEYS; if(!allowed.includes(stat))return;
  const budget=Number(offensive?p.rewards?.offensiveStatPoints:p.rewards?.baseStatPoints)||0; const spent=allowed.reduce((s,k)=>s+Number(bucket[k]||0),0); const current=Number(bucket[stat]||0); if(delta>0&&spent>=budget)return; bucket[stat]=Math.max(0,current+delta); refreshTrainerProgressionPreview();
}
function setTrainerMilestoneChoice(choice){
  trainerProgressState.draft.milestoneChoice=choice; trainerProgressState.draft.offensiveStatAllocations={attack:0,spAttack:0};
  // A milestone choice can change the number/type of granted Features or Edges; clear only over-budget selections.
  const level=Number(trainerProgressState.preview?.nextLevel||trainer().level+1); if(level===5){trainerProgressState.draft.features=[];} if([10,20,30,40].includes(level)){trainerProgressState.draft.features=[];trainerProgressState.draft.edges=[];}
  refreshTrainerProgressionPreview();
}
function setTrainerLevelUpMode(mode){if(!trainerProgressState.draft)return;if(mode==='milestone'&&!state.ui.gmOverride)return toast('Enable GM Override to confirm a milestone Level Up.','error');trainerProgressState.draft.milestoneLevelUp=mode==='milestone';refreshTrainerProgressionPreview();}
function progressionOptionSet(kind){
  const sets=trainerProgressState.preview?.optionSets||{}; return kind==='feature'?sets.features||[]:kind==='generalFeature'?sets.generalFeatures||[]:kind==='edge'?sets.edges||[]:sets.skillEdges||[];
}
function progressionKindLabel(kind){return kind==='generalFeature'?'General Feature':kind==='feature'?'Feature':kind==='skillEdge'?'Bonus Skill Edge':'Edge';}
function renderTrainerProgressionPicker(query=''){
  trainerProgressState.pickerQuery=query; const kind=trainerProgressState.pickerKind; const rows=progressionOptionSet(kind); const q=String(query||'').trim().toLowerCase(); const filtered=rows.filter(x=>!q||`${x.name} ${x.parentClass||''} ${x.prerequisites||''} ${x.effect||''}`.toLowerCase().includes(q)).slice(0,100);
  const box=document.getElementById('trainer-progress-picker-results'); if(!box)return;
  box.innerHTML=filtered.map(row=>{const status=row.classBlocked?['CLASS CAP','chip-red']:row.milestoneBlocked?['MILESTONE LOCK','chip-red']:row.manual?['MANUAL CHECK','chip-yellow']:row.valid?['ELIGIBLE','chip-green']:['LOCKED','chip-red'];const reason=[...(row.prerequisite?.reasons||[]),row.duplicate?.exhausted?'Already at maximum allowed rank.':'',row.classBlocked?'Trainer already has four Classes.':''].filter(Boolean).join(' ');return `<button class="progress-option-row ${row.valid?'':'disabled'}" onclick="chooseTrainerProgressionDefinition('${kind}','${String(row.id).replace(/'/g,"\\'")}')" ${row.valid?'':'disabled'}><div><strong>${esc(row.name)}</strong><span>${chip(status[0],status[1])}${row.parentClass?chip(esc(row.parentClass),'chip-blue'):''}</span><small>${esc(row.prerequisites||'No prerequisites')}</small>${reason?`<em>${esc(reason)}</em>`:''}</div><b>${row.duplicate?.nextRank>1?`Rank ${row.duplicate.nextRank}`:'＋'}</b></button>`;}).join('')||'<p class="muted">No matching eligible definitions in this Ruleset.</p>';
}
async function loadTrainerProgressionOptions(){
  const response=await fetch('/api/trainer/progression-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trainer:trainer(),draft:trainerProgressState.draft,gmOverride:!!state.ui.gmOverride,includeOptions:true})});
  const payload=await response.json(); if(!response.ok)throw new Error(payload.error||'Could not load progression options');
  trainerProgressState.preview=payload.preview; return payload.preview.optionSets||{};
}
async function openTrainerProgressionPicker(kind){
  trainerProgressState.pickerKind=kind; trainerProgressState.pickerQuery=''; modal('<div class="loading-card compact-loading"><span class="spinner"></span><strong>Checking Ruleset prerequisites…</strong></div>',{title:`Choose ${progressionKindLabel(kind)}`,subtitle:'Eligibility is evaluated against the projected Trainer sheet at the new Level.'});
  try{await loadTrainerProgressionOptions();modal(`<label class="training-search">Search ${esc(progressionKindLabel(kind))}<input id="trainer-progress-picker-search" placeholder="Name, class or prerequisite…" oninput="renderTrainerProgressionPicker(this.value)"/></label><div class="picker-legend">${chip('ELIGIBLE','chip-green')} ${chip('MANUAL CHECK','chip-yellow')} ${chip('LOCKED','chip-red')}</div><div id="trainer-progress-picker-results" class="progress-option-list"></div>`,{title:`Choose ${progressionKindLabel(kind)}`,subtitle:'Eligibility is evaluated against the projected Trainer sheet at the new Level.'});requestAnimationFrame(()=>renderTrainerProgressionPicker(''));}catch(error){modal(`<div class="builder-validation bad">${esc(error.message)}</div><button class="btn btn-primary" onclick="openTrainerProgressionPicker('${kind}')">Retry</button>`,{title:`Choose ${progressionKindLabel(kind)}`});}
}
async function chooseTrainerProgressionDefinition(kind,id){
  const row=progressionOptionSet(kind).find(x=>String(x.id)===String(id)); if(!row||!row.valid)return;
  let manualConfirm=false; if(row.manual&&!state.ui.gmOverride){manualConfirm=!!(await styledConfirm({title:'Manual prerequisite check',message:`<p><strong>${esc(row.name)}</strong> has a prerequisite the current engine cannot prove automatically.</p><div class="dialog-warning">${esc((row.prerequisite?.reasons||[]).join(' ')||row.prerequisites||'Confirm the table requirement is satisfied.')}</div>`,confirmLabel:'I confirm it is satisfied',tone:'gold'})); if(!manualConfirm){openTrainerProgressionPicker(kind);return;}}
  try{
    const definitionKind=(kind==='feature'||kind==='generalFeature')?'features':'edges'; const response=await fetch(`/api/definitions/${encodeURIComponent(definitionKind)}/${encodeURIComponent(id)}`,{cache:'no-store'}); const payload=await response.json(); if(!response.ok)throw new Error(payload.error||'Definition unavailable'); const def=payload.definition||payload;
    const rank=Number(row.duplicate?.nextRank||1); const selections=await trainerDefinitionSelections(definitionKind,def,rank); if(selections===null){openTrainerProgressionPicker(kind);return;}
    const record={id:def.id,name:def.name,rank,selections,manualConfirm,rewardBucket:kind}; if(kind==='feature'||kind==='generalFeature')trainerProgressState.draft.features.push(record); else if(kind==='skillEdge')trainerProgressState.draft.skillEdges.push(record); else trainerProgressState.draft.edges.push(record);
    closeModal(); await refreshTrainerProgressionPreview();
  }catch(error){toast(error.message,'error');}
}
function removeTrainerProgressChoice(kind,index){const list=trainerProgressState.draft?.[kind];if(!Array.isArray(list))return;list.splice(index,1);refreshTrainerProgressionPreview();}
function cancelTrainerProgression(){invalidateTrainerProgression();state.ui.screen='trainer';state.ui.trainerTab='history';persist();render();setTimeout(()=>loadTrainerReferenceData(true),0);}
async function applyTrainerProgression(){
  const p=trainerProgressState.preview; if(!p?.valid)return toast('Complete the progression requirements first.','error');
  try{
    const response=await fetch('/api/trainer/progression-apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({trainer:trainer(),draft:trainerProgressState.draft,gmOverride:!!state.ui.gmOverride})}); const payload=await response.json(); if(!response.ok)throw new Error(payload.error||payload.preview?.errors?.join(' ')||'Could not apply Trainer progression');
    state.trainer=payload.updatedTrainer; ensureTrainerDetails(state.trainer); invalidateTrainerReference(); invalidateTrainerProgression(); state.ui.screen='trainer'; state.ui.trainerTab='history'; persist(); toast(`Trainer reached Level ${state.trainer.level}. ${Number(state.trainer.exp||0)} Trainer XP remain.`); setTimeout(()=>loadTrainerReferenceData(true),0);
  }catch(error){toast(error.message,'error');}
}

/* --- NPCs --- */
async function addNpc(){ const v=await styledForm({title:'Add NPC',fields:[{name:'name',label:'NPC name'},{name:'role',label:'Role',value:'Contact'},{name:'tag',label:'Tag',value:'Ally'},{name:'description',label:'Description',type:'textarea',rows:3}],submitLabel:'Create NPC'}); if(!v||!String(v.name||'').trim())return; const name=String(v.name).trim(),n={id:uid('npc'),initials:name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase(),name,role:String(v.role||'Contact'),tag:String(v.tag||'Ally'),affiliation:'',lastSeen:'',description:String(v.description||''),portraitDataUrl:null,notes:[]}; state.npcs.push(n); state.selectedNpcId=n.id; commit('NPC created.'); }
async function editNpc(id){ const n=state.npcs.find(x=>x.id===id); if(!n)return; const v=await styledForm({title:'Edit NPC',fields:[{name:'name',label:'Name',value:n.name},{name:'role',label:'Role',value:n.role},{name:'tag',label:'Tag',value:n.tag},{name:'affiliation',label:'Affiliation',value:n.affiliation||''},{name:'lastSeen',label:'Last seen',value:n.lastSeen||''},{name:'description',label:'Description',type:'textarea',rows:4,value:n.description||''}],submitLabel:'Save NPC'}); if(!v)return; n.name=String(v.name||n.name); n.role=String(v.role||n.role); n.tag=String(v.tag||n.tag); n.affiliation=String(v.affiliation||''); n.lastSeen=String(v.lastSeen||''); n.description=String(v.description||''); n.initials=n.name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase(); commit('NPC updated.'); }
async function deleteNpc(id){ const n=state.npcs.find(x=>x.id===id); if(!n)return; if(!(await styledConfirm({title:'Delete NPC',message:`<p>Delete <strong>${esc(n.name)}</strong> and its local notes?</p>`,confirmLabel:'Delete NPC',danger:true})))return; state.npcs=state.npcs.filter(x=>x.id!==id); state.selectedNpcId=state.npcs[0]?.id||null; commit('NPC deleted.'); }
async function addNpcNote(id){ const n=state.npcs.find(x=>x.id===id); if(!n)return; const v=await styledForm({title:`Add note · ${n.name}`,fields:[{name:'note',label:'Note',type:'textarea',rows:4}],submitLabel:'Add Note'}); if(!v||!String(v.note||'').trim())return; n.notes.push(String(v.note).trim()); commit('Note added.'); }

/* --- Trainer profiles --- */
function blankTrainerStateClient(name,title='Trainer'){
  const clean=defaultState(); const id=`trainer-${Date.now()}-${Math.random().toString(16).slice(2,7)}`;
  clean.activeProfileId=id; clean.trainer={...clean.trainer,id,name,title,level:1,exp:0,nextExp:10,money:5000,ptuPoints:0,badges:0,portraitDataUrl:null,stats:{hp:10,attack:5,defense:5,spAttack:5,spDefense:5,speed:5},derived:{},skills:{},equipment:{head:null,body:null,mainHand:null,offHand:null,feet:null,accessory:null},modifiers:[],gmGrants:[],history:[],details:{background:{name:'New Background',adept:'Athletics',novice:'Command',pathetic:['Guile','Intuition','Focus']},skillRanks:{...Object.fromEntries(TRAINER_SKILLS.map(k=>[k,2])),Athletics:4,Command:3,Guile:1,Intuition:1,Focus:1},backgroundRanksAppliedVersion:2,features:[],edges:[],moves:[],trainingFeature:null,currentHp:null,tempHp:0,injuries:0,currentAp:null,combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}}};
  clean.pokemon=[]; clean.rosters=[{id:`${id}-personal`,name:'Personal Team',role:'COMBAT',maxMembers:6,active:true,color:'#0b7b4b'}]; clean.inventory=clean.inventory.map(i=>({...i,qty:0})); clean.npcs=[]; clean.selectedPokemonId=null; clean.selectedRosterId=clean.rosters[0].id; clean.selectedNpcId=null; clean.shop={preset:'Poké Mart',discountPct:0,mode:'buy',cart:{}}; clean.ui={screen:'trainer',creatureTab:'sheet',trainerTab:'profile',toast:null,round:1,scene:1,day:1,gmOverride:false}; return clean;
}
async function fetchProfiles(){
  if(persistenceMode!=='sqlite') return {activeProfileId:state.activeProfileId,profiles:[{id:state.activeProfileId,name:trainer().name,title:trainer().title,level:trainer().level,portraitDataUrl:trainer().portraitDataUrl||null,active:true}]};
  const r=await fetch('/api/profiles',{cache:'no-store'}); if(!r.ok)throw new Error('Could not load Trainer profiles'); return r.json();
}
async function openTrainerSwitcher(){
  try{const data=await fetchProfiles(); const rows=(data.profiles||[]).map(p=>`<button class="profile-switch-row ${p.id===data.activeProfileId?'active':''}" onclick="switchTrainerProfile('${String(p.id).replace(/'/g,"\\'")}')">${personPortrait({name:p.name,portraitDataUrl:p.portraitDataUrl},'profile-avatar','span')}<span><strong>${esc(p.name)}</strong><small>${esc(p.title||'Trainer')} · Lv. ${p.level}</small></span>${p.id===data.activeProfileId?chip('ACTIVE','chip-green'):'<b>Switch</b>'}</button>`).join(''); modal(`<div class="profile-switch-list">${rows}</div><div class="modal-actions horizontal"><button class="btn btn-primary" onclick="closeModal();createTrainerProfile()">＋ New Trainer</button><button class="btn btn-ghost" onclick="closeModal();resetTrainerSheet()">Reset Active Sheet</button><button class="btn btn-danger" onclick="closeModal();deleteTrainerProfile()">Delete Active Trainer</button></div><p class="muted">Each Trainer profile has its own Pokémon, Rosters, Backpack, NPC notes and campaign state. Only one profile is loaded at a time.</p>`,{title:'Trainer Profiles',subtitle:'Switch the active Trainer without loading every campaign profile into memory.'});}catch(e){toast(e.message,'error');}
}
async function switchTrainerProfile(id){
  if(id===state.activeProfileId){closeModal();return;} if(persistenceMode!=='sqlite')return toast('Multiple Trainer profiles require the SQLite preview server.','error');
  try{await saveQueue; const r=await fetch('/api/profiles/active',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});const payload=await r.json();if(!r.ok)throw new Error(payload.error||'Unable to switch Trainer');state=migrateState(payload.state);invalidateTrainerReference();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));closeModal();render();toast(`Active Trainer: ${trainer().name}`);setTimeout(()=>loadTrainerReferenceData(true),0);}catch(e){toast(e.message,'error');}
}
async function createTrainerProfile(){
  const v=await styledForm({title:'Create Trainer',subtitle:'Creates a separate offline profile with its own Pokémon, Rosters, Backpack and notes.',fields:[{name:'name',label:'Trainer name',placeholder:'Trainer name'},{name:'title',label:'Concept / title',value:'Trainer'}],submitLabel:'Create Trainer'}); if(!v||!String(v.name||'').trim())return;
  if(persistenceMode==='sqlite'){
    try{await saveQueue;const r=await fetch('/api/profiles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:String(v.name).trim(),title:String(v.title||'Trainer').trim()})});const payload=await r.json();if(!r.ok)throw new Error(payload.error||'Unable to create Trainer');state=migrateState(payload.state);invalidateTrainerReference();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));render();toast(`${trainer().name} created.`);setTimeout(()=>loadTrainerReferenceData(true),0);return;}catch(e){return toast(e.message,'error');}
  }
  state=migrateState(blankTrainerStateClient(String(v.name).trim(),String(v.title||'Trainer').trim()));invalidateTrainerReference();persist();render();toast(`${trainer().name} created in browser fallback.`);
}
async function deleteTrainerProfile(){
  const targetId=String(state.activeProfileId||trainer()?.id||'');
  if(!targetId)return toast('No active Trainer to delete.','error');
  const targetName=trainer()?.name||'this Trainer';
  let profileCount=1;
  try{const profileData=await fetchProfiles();profileCount=Math.max(1,Number(profileData?.profiles?.length||1));}catch{}
  const lastProfile=profileCount<=1;
  const message=lastProfile
    ? `<p>Delete <strong>${esc(targetName)}</strong> and all campaign data owned by this Trainer?</p><div class="dialog-warning">This is the last Trainer. Pokémon, Rosters, Storage, Backpack, NPCs and revisions owned by it will be removed. A new blank Trainer will be created so the app remains usable. Content Packs and global settings are preserved.</div>`
    : `<p>Delete <strong>${esc(targetName)}</strong> and all campaign data owned by this Trainer?</p><div class="dialog-warning">Pokémon, Rosters, Storage, Backpack, NPCs and revisions owned by it will be removed. Other Trainers, Content Packs and global settings are preserved. Another Trainer will become active automatically.</div>`;
  if(!(await styledConfirm({title:'Delete Trainer',message,confirmLabel:'Delete Trainer',danger:true})))return;
  if(persistenceMode==='sqlite'){
    try{
      await saveQueue;
      const response=await fetch(`/api/profiles/${encodeURIComponent(targetId)}`,{method:'DELETE'});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||'Unable to delete Trainer');
      state=migrateState(payload.state);
      invalidateTrainerReference();
      localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
      closeModal();
      render();
      toast(payload.replacementCreated?'Trainer deleted. A new blank Trainer was created.':`Trainer deleted. Active Trainer: ${trainer().name}`);
      setTimeout(()=>loadTrainerReferenceData(true),0);
      return;
    }catch(error){return toast(error.message,'error');}
  }
  state=migrateState(blankTrainerStateClient('New Trainer','Trainer'));
  invalidateTrainerReference();
  persist();
  closeModal();
  render();
  toast('Trainer deleted. A new blank Trainer was created.');
  setTimeout(()=>loadTrainerReferenceData(true),0);
}
async function resetTrainerSheet(){
  if(!(await styledConfirm({title:'Reset Trainer Sheet',message:'<p>Reset the active Trainer mechanical build to a clean Level 1 sheet?</p><div class="dialog-warning">Pokémon, Rosters, Backpack, money, badges, NPCs and GM Grants are preserved. Stats, Background, Skills, Features, Edges, Trainer Moves and combat state are reset.</div>',confirmLabel:'Reset Sheet',danger:true})))return;
  const t=trainer(), grants=[...(t.gmGrants||[])], history=[...(t.history||[])], keep={name:t.name,title:t.title,money:t.money,badges:t.badges}; t.level=1;t.exp=0;t.nextExp=10;t.ptuPoints=0;t.stats={hp:10,attack:5,defense:5,spAttack:5,spDefense:5,speed:5};t.derived={};t.skills={};t.equipment={head:null,body:null,mainHand:null,offHand:null,feet:null,accessory:null};t.modifiers=[];t.gmGrants=grants;t.history=history;t.details={background:{name:'New Background',adept:'Athletics',novice:'Command',pathetic:['Guile','Intuition','Focus']},skillRanks:{...Object.fromEntries(TRAINER_SKILLS.map(k=>[k,2])),Athletics:4,Command:3,Guile:1,Intuition:1,Focus:1},backgroundRanksAppliedVersion:2,features:[],edges:[],moves:[],trainingFeature:null,currentHp:null,tempHp:0,injuries:0,currentAp:null,combatStages:{attack:0,defense:0,spAttack:0,spDefense:0,speed:0,accuracy:0,evasion:0}};Object.assign(t,keep);ensureTrainerDetails(t);t.history.push({id:uid('h'),date:new Date().toISOString().slice(0,10),title:'Trainer sheet reset',detail:'Mechanical Trainer build reset; campaign assets and GM Grants preserved.'});state.ui.trainerTab='profile';commit('Trainer sheet reset.');
}

/* --- Save/import/export --- */
function downloadJson(data,filename){ const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},100); }
function exportSave(){ downloadJson(state,`ptu-companion-${trainer().name.replace(/\W+/g,'-').toLowerCase()}.json`); toast('Save exported.'); }
function importSaveFile(file){ const reader=new FileReader(); reader.onload=()=>{try{const data=JSON.parse(reader.result); if(!data||![1,2].includes(data.version)||!data.trainer||!Array.isArray(data.pokemon)) throw new Error('Unsupported save format'); state=migrateState(data); invalidateTrainerReference(); persist(); render(); toast('Save imported.'); if(state.ui.screen==='trainer')setTimeout(()=>loadTrainerReferenceData(true),0);}catch(e){toast(`Import failed: ${e.message}`,'error');}}; reader.readAsText(file); }
async function restoreRevision(id){
  if(persistenceMode!=='sqlite') return toast('Revision restore requires the SQLite server.','error');
  if(!(await styledConfirm({title:'Restore campaign revision',message:'<p>Restore this SQLite campaign revision?</p><div class=\"dialog-warning\">The current state will remain available as a newer revision.</div>',confirmLabel:'Restore Revision',tone:'gold'}))) return;
  try{
    const response=await fetch(`/api/revisions/${id}/restore`,{method:'POST'});
    if(!response.ok) throw new Error('Restore failed');
    const payload=await response.json(); state=migrateState(payload.state); invalidateTrainerReference(); localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); render(); toast('Revision restored.'); if(state.ui.screen==='trainer')setTimeout(()=>loadTrainerReferenceData(true),0);
  }catch(error){ toast(error.message,'error'); }
}
async function openSaveTools(){
  let revisionHtml='<p class="muted">Revision history is available when running through RUN_FUNCTIONAL_PREVIEW.</p>';
  if(persistenceMode==='sqlite'){
    try{
      const response=await fetch('/api/revisions?limit=8',{cache:'no-store'});
      const payload=await response.json();
      revisionHtml=(payload.revisions||[]).length?`<div class="revision-list">${payload.revisions.map(r=>`<div><span><strong>#${r.id}</strong><small>${new Date(r.created_at).toLocaleString()}</small></span><button class="mini-action" onclick="closeModal();restoreRevision(${r.id})">Restore</button></div>`).join('')}</div>`:'<p class="muted">No revisions yet.</p>';
    }catch(error){ revisionHtml='<p class="negative">Could not load revisions.</p>'; }
  }
  modal(`<h2>Save & Campaign Tools</h2><p><strong>Persistence:</strong> ${persistenceLabel()}. The server-backed mode stores normalized campaign data in <code>data/ptu_companion.sqlite3</code> and maintains up to 30 semantic revisions.</p><div class="modal-actions"><button class="btn btn-primary" onclick="exportSave();closeModal()">Export JSON Save</button><label class="btn btn-success file-label">Import JSON<input type="file" accept="application/json,.json" onchange="importSaveFile(this.files[0]);closeModal()"/></label><button class="btn btn-danger" onclick="closeModal();resetState()">Reset Sample Campaign</button></div><hr/><h3>Current save</h3><dl class="detail-dl"><div><dt>Trainer</dt><dd>${esc(trainer().name)}</dd></div><div><dt>Pokémon</dt><dd>${state.pokemon.length}</dd></div><div><dt>Rosters</dt><dd>${state.rosters.length}</dd></div><div><dt>NPCs</dt><dd>${state.npcs.length}</dd></div></dl><hr/><h3>SQLite revisions</h3>${revisionHtml}`);
}
function openGlobalActions(){ modal(`<h2>Prototype Controls</h2><div class="modal-actions"><button class="btn btn-primary" onclick="closeModal();openSaveTools()">Save / Import / Export</button><button class="btn btn-ghost" onclick="closeModal();toggleGmOverride()">Toggle GM Override</button><button class="btn btn-ghost" onclick="closeModal();route('editor')">Open Editors</button></div><p class="muted">v2.0.1 hotfixes Combat rendering with empty equipment slots while retaining v2.0 linked Backgrounds, repeatable Trainer choices and equipped weapons into the resolved Trainer model. Combat includes Weapon Moves and alternate qualification Skills such as Apparition.</p>`); }
let styledDialogResolver=null;
let styledFormSpec=null;
function modal(body,opts={}){
  const root=document.getElementById('modal-root'); if(!root)return;
  const title=opts.title||''; const subtitle=opts.subtitle||''; const tone=opts.tone||'blue';
  root.innerHTML=`<div class="modal-backdrop" role="presentation"><div class="modal-card modal-themed tone-${tone}" role="dialog" aria-modal="true"><div class="modal-accent"></div><button class="modal-close" onclick="closeModal()">×</button>${title?`<header class="modal-header"><span class="modal-orb">◉</span><div><h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div></header>`:''}<div class="modal-content">${body}</div></div></div>`;
  requestAnimationFrame(()=>root.querySelector('input,select,textarea,button')?.focus());
}
function closeModal(cancelDialog=true){
  const root=document.getElementById('modal-root'); if(root)root.innerHTML='';
  if(cancelDialog&&styledDialogResolver){ const r=styledDialogResolver; styledDialogResolver=null; styledFormSpec=null; r(null); }
}
function resolveStyledDialog(value){ const r=styledDialogResolver; styledDialogResolver=null; styledFormSpec=null; closeModal(false); if(r)r(value); }
function styledConfirm({title='Confirm',message='',confirmLabel='Confirm',cancelLabel='Cancel',tone='blue',danger=false}={}){
  return new Promise(resolve=>{styledDialogResolver=resolve; modal(`<div class="dialog-message">${message}</div><div class="modal-actions horizontal"><button class="btn btn-ghost" onclick="resolveStyledDialog(false)">${esc(cancelLabel)}</button><button class="btn ${danger?'btn-danger':'btn-primary'}" onclick="resolveStyledDialog(true)">${esc(confirmLabel)}</button></div>`,{title,tone:danger?'red':tone});});
}
function styledForm({title='Edit',subtitle='',fields=[],submitLabel='Save',tone='blue'}={}){
  return new Promise(resolve=>{styledDialogResolver=resolve; styledFormSpec={fields}; const html=`<form class="styled-form" onsubmit="event.preventDefault();submitStyledForm()">${fields.map((f,i)=>{const id=`styled-field-${i}`; const val=f.value??''; if(f.type==='textarea')return `<label>${esc(f.label)}<textarea id="${id}" rows="${f.rows||4}" placeholder="${esc(f.placeholder||'')}">${esc(val)}</textarea>${f.help?`<small>${esc(f.help)}</small>`:''}</label>`; if(f.type==='select')return `<label>${esc(f.label)}<select id="${id}">${(f.options||[]).map(o=>{const ov=typeof o==='object'?o.value:o,ol=typeof o==='object'?o.label:o; return `<option value="${esc(ov)}" ${String(ov)===String(val)?'selected':''}>${esc(ol)}</option>`}).join('')}</select>${f.help?`<small>${esc(f.help)}</small>`:''}</label>`; return `<label>${esc(f.label)}<input id="${id}" type="${esc(f.type||'text')}" value="${esc(val)}" ${f.min!=null?`min="${f.min}"`:''} ${f.max!=null?`max="${f.max}"`:''} placeholder="${esc(f.placeholder||'')}"/>${f.help?`<small>${esc(f.help)}</small>`:''}</label>`;}).join('')}<div class="modal-actions horizontal"><button type="button" class="btn btn-ghost" onclick="resolveStyledDialog(null)">Cancel</button><button type="submit" class="btn btn-primary">${esc(submitLabel)}</button></div></form>`; modal(html,{title,subtitle,tone});});
}
function submitStyledForm(){ if(!styledDialogResolver||!styledFormSpec)return; const out={}; styledFormSpec.fields.forEach((f,i)=>{const el=document.getElementById(`styled-field-${i}`); let v=el?.value??''; if(f.type==='number')v=Number(v); out[f.name||`field${i}`]=v;}); resolveStyledDialog(out); }

/* expose handlers used by inline events */
Object.assign(window,{openMoveKeywordInfo,openPokemonFormsManager,setPokemonPermanentForm,togglePokemonTransformation,toggleAegislashStanceManually,route,selectPokemon,selectRoster,selectNpc,editPokemonIdentity,editPokemonNotes,changeHp,changeInjury,changeStage,nextRound,endScene,newDay,addPokemonToRoster,removePokemonFromRoster,createRoster,editRoster,deleteRoster,storePokemon,withdrawPokemon,useItem,equipTrainerItem,unequipTrainerItem,setShopPreset,setShopMode,setShopDiscount,addCart,removeCart,checkout,toggleGmOverride,editTrainer,editTrainerNotes,editTrainerExperience,changeTrainerExperience,addGmGrant,removeGmGrant,setTrainerTab,openTrainerBackgroundEditor,openTrainerSkillEditor,openTrainerStatsEditor,openTrainerDefinitionPicker,openTrainerMoveSourcePicker,scheduleTrainerDefinitionSearch,refreshTrainerDefinitionPicker,addTrainerDefinition,configureTrainerDefinition,removeTrainerDefinition,removeTrainerMove,changeTrainerHp,changeTrainerInjury,changeTrainerAp,toggleSilentAssassinBound,changeTrainerStage,beginTrainerProgression,refreshTrainerProgressionPreview,adjustTrainerProgressStat,setTrainerMilestoneChoice,setTrainerLevelUpMode,openTrainerProgressionPicker,renderTrainerProgressionPicker,chooseTrainerProgressionDefinition,removeTrainerProgressChoice,cancelTrainerProgression,applyTrainerProgression,addNpc,editNpc,deleteNpc,addNpcNote,exportSave,importSaveFile,openSaveTools,openGlobalActions,openTrainerSwitcher,switchTrainerProfile,createTrainerProfile,deleteTrainerProfile,resetTrainerSheet,closeModal,resolveStyledDialog,submitStyledForm,resetState,restoreRevision,downloadJson,beginPokemonBuilder,setPokemonBuilderQuery,refreshPokemonBuilderSpecies,selectPokemonBuilderSpecies,setPokemonBuilderField,setPokemonBuilderBaseForm,togglePokemonBuilderFormManualApproval,adjustPokemonBuilderStat,autoAllocatePokemonBuilderStats,setPokemonBuilderAbility,togglePokemonBuilderMove,refreshPokemonBuildPreview,createPokemonFromBuilder,beginPokemonProgression,refreshPokemonProgressionPreview,beginPokemonTraining,refreshPokemonTrainingOptions,setCreatureTab,loadCreatureReferenceData,loadTrainerReferenceData,beginPokemonRestat,refreshPokemonRestatPreview,adjustPokemonRestatStat,resetPokemonRestat,cancelPokemonRestat,applyPokemonRestat,setPokemonTrainingMethod,setPokemonTrainingQuery,acquirePokeEdge,refundPokeEdge,learnPokemonTrainingMove,setPokemonProgressExp,setPokemonProgressMode,setPokemonProgressTargetLevel,adjustPokemonProgressStat,setPokemonProgressAbility,togglePokemonProgressMove,openPokemonProgressAbilityInfo,openPokemonProgressMoveInfo,selectPokemonEvolution,toggleEvolutionCondition,useSuggestedEvolutionRestat,applyPokemonProgression,openHeldItemPicker,equipHeldItem,unequipHeldItem,openBackpackItemPicker,renderBackpackItemPicker,filterBackpackItemPicker,addCatalogItemToBackpack,adjustInventoryQuantity,createCustomItem,deletePokemon,chooseContentPackFile,importContentPackFile,refreshContentPacks,setContentPackEnabledUi,uninstallContentPackUi});

function startDesktopHeartbeat(){
  if(typeof fetch!=='function') return;
  const beat=()=>fetch('/api/desktop/heartbeat',{method:'POST',cache:'no-store'}).catch(()=>{});
  beat();
  if(typeof setInterval==='function') setInterval(beat,10000);
}

async function boot(){
  startDesktopHeartbeat();
  try{ state=await loadState(); }
  catch(error){ console.error(error); state=defaultState(); persistenceMode='browser-fallback'; }
  await loadCatalogStatus();
  render();
  if(state.ui.screen==='trainer')setTimeout(()=>loadTrainerReferenceData(true),0);
  if(catalogState.available) refreshDefinitionRows();
}
boot();
