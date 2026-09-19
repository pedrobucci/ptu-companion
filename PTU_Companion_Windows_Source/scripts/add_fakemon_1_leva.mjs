import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const dbPath=join(root,'seed','definitions','ptu_seed_v1.0.sqlite3');
const db=new DatabaseSync(dbPath);
const slug=s=>String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const hasDef=(kind,id)=>!!db.prepare('select 1 from definition_versions where definition_kind=? and logical_id=? limit 1').get(kind,id);
const moveRec=(level,move,type_hint=null)=>({level:String(level),move,type_hint,move_id:slug(move),reference_status:hasDef('moves',slug(move))?'resolved_final_normalization':'unresolved_source_reference'});
const tmRec=(code,move)=>({code:String(code).padStart(2,'0'),move,move_id:slug(move),reference_status:hasDef('moves',slug(move))?'resolved_final_normalization':'unresolved_source_reference'});
const tutorRec=(move,note=null)=>({move,move_id:slug(move),note,reference_status:hasDef('moves',slug(move))?'resolved_final_normalization':'unresolved_source_reference'});
const ability=(slot,name,category,index)=>({slot,name,ability_id:slug(name),slot_category:category,slot_index:index,reference_status:hasDef('abilities',slug(name))?'resolved_final_normalization':'unresolved_source_reference'});
const capMove=(name,value)=>({name,value,kind:'movement',capability_id:slug(name),reference_status:hasDef('capabilities',slug(name))?'resolved_final_normalization':'unresolved_source_reference'});
const capSpecial=(name,value=null)=>({name,...(value!=null?{value}:{}),kind:'special',capability_id:slug(name),reference_status:hasDef('capabilities',slug(name))?'resolved_final_normalization':'unresolved_source_reference'});
const jump=(high,long)=>({name:'Jump',high,long,kind:'jump',component_capability_ids:['high-jump','long-jump'],reference_status:'resolved_composite'});
const skill=(skill,dice,modifier=0)=>({skill,dice,modifier});
const tmCommon=`01 Work Up, 03 Psyshock, 04 Calm Mind, 06 Toxic, 10 Hidden Power, 11 Sunny Day, 13 Ice Beam, 14 Blizzard, 15 Hyper Beam, 16 Light Screen, 17 Protect, 18 Rain Dance, 20 Safeguard, 21 Frustration, 22 Solar Beam, 24 Thunderbolt, 25 Thunder, 27 Return, 29 Psychic, 30 Shadow Ball, 31 Brick Break, 32 Double Team, 33 Reflect, 35 Flamethrower, 38 Fire Blast, 42 Facade, 44 Rest, 45 Attract, 48 Round, 49 Echoed Voice, 52 Focus Blast, 56 Fling, 57 Charge Beam, 68 Giga Impact, 73 Thunder Wave, 77 Psych Up, 85 Dream Eater, 86 Grass Knot, 87 Swagger, 88 Sleep Talk, 90 Substitute, 99 Dazzling Gleam, 100 Confide`;
const parseTm=text=>text.split(',').map(s=>s.trim()).filter(Boolean).map(s=>{const m=s.match(/^(\d+)\s+(.+)$/);return m?tmRec(m[1],m[2]):tmRec('',s)});
const tutorClef=`After You, Body Slam, Bounce, Counter, Covet, Defense Curl, Disarming Voice (N), Double-Edge, Drain Punch, Dynamic Punch, Endeavor, Fire Punch, Focus Punch, Gravity, Heal Bell, Helping Hand, Hyper Voice, Ice Punch, Icy Wind, Iron Tail, Knock Off, Laser Focus, Last Resort, Magic Coat, Mega Kick, Mega Punch, Mimic, Mud-Slap, Recycle, Role Play, Rollout, Seismic Toss, Shock Wave, Signal Beam, Snatch, Snore, Soft-Boiled, Spotlight (N), Stealth Rock, Telekinesis, Thunder Punch, Trick, Uproar, Water Pulse, Wonder Room, Zen Headbutt`;
const parseTutor=text=>text.split(',').map(s=>s.trim()).filter(Boolean).map(s=>{const natural=/\(N\)$/i.test(s);const name=s.replace(/\s*\(N\)$/i,'');return tutorRec(name,natural?'N':null)});
const parseEgg=text=>text.split(',').map(s=>s.trim()).filter(Boolean).map(m=>({move:m,move_id:slug(m),reference_status:hasDef('moves',slug(m))?'resolved_final_normalization':'unresolved_source_reference'}));
const packId='campaign-homebrew-fakemon-1-leva'; const sourceId='fakemon-1-leva'; const priority=180;
const species=[
  {
    id:'panthore',display_name:'Panthore',source_page:1,types:['Electric','Dark'],base_stats:{hp:5,attack:5,defense:3,special_attack:5,special_defense:3,speed:6},
    ability_slots:[ability('Basic Ability 1','Run Away','basic',1),ability('Advanced Ability 1','Cute Charm','advanced',1),ability('Advanced Ability 2','Limber','advanced',2),ability('Advanced Ability 3','Vanguard','advanced',3),ability('High Ability','Vicious','high',1)],
    capabilities:[capMove('Overland',6),capMove('Swim',3),jump(2,1),{name:'Power',value:3,kind:'power',capability_id:'power',reference_status:'resolved_final_normalization'},capSpecial('Darkvision'),capSpecial('Tracker'),capSpecial('Stealth'),capSpecial('Underdog')],
    skills:[skill('Athletics',2,1),skill('Acrobatics',2,2),skill('Combat',2,2),skill('Stealth',3,0),skill('Perception',3,0),skill('Focus',2,0)],
    evolution_text:'1 - Panthore; 2 - Panzeus Minimum 20',height_text:"0.6m (Small)",weight_text:'20kg (2)',gender_ratio_text:'50% M / 50% F',egg_group_text:'Field',diet_text:'Omnivore',habitat_text:'Forest, Grassland',
    level_up_moves:[moveRec(1,'Scratch','Normal'),moveRec(3,'Growl','Normal'),moveRec(6,'Charge','Electric'),moveRec(10,'Bite','Dark'),moveRec(12,'Fury Swipes','Normal'),moveRec(15,'Pursuit','Dark'),moveRec(19,'Torment','Dark'),moveRec(21,'Fake Out','Normal'),moveRec(24,'Hone Claws','Dark'),moveRec(28,'Assurance','Dark'),moveRec(30,'Night Slash','Dark'),moveRec(33,'Thunderbolt','Electric'),moveRec(37,'Volt Switch','Electric'),moveRec(39,'Snatch','Dark'),moveRec(42,'Nasty Plot','Dark'),moveRec(46,'Sucker Punch','Dark'),moveRec(49,'Wild Charge','Electric')],
    tm_moves:parseTm('06 Toxic, 10 Hidden Power, 11 Sunny Day, 12 Taunt, 17 Protect, 18 Rain Dance, 21 Frustration, 27 Return, 30 Shadow Ball, 32 Double Team, 40 Aerial Ace, 41 Torment, 42 Facade, 44 Rest, 45 Attract, 46 Thief, 48 Round, 49 Echoed Voice, 63 Embargo, 65 Shadow Claw, 66 Payback, 73 Thunder Wave, 77 Psych Up, 85 Dream Eater, 86 Grass Knot, 87 Swagger, 88 Sleep Talk, 89 U-Turn, 90 Substitute, 95 Snarl, 97 Dark Pulse, 100 Confide'),
    egg_moves:parseEgg('Charm, Copycat, Covet, Encore, Feint Attack, Fake Tears, Foul Play, Pay Day, Yawn, Charge Beam, Shock Wave, Eeire Impulse'),
    tutor_moves:parseTutor('Covet, Foul Play, Gunk Shot, Hyper Voice, Iron Tail, Knock Off, Role Play, Seed Bomb, Snatch, Snore, Spite, Trick, Fury Cutter, Magnet Rise, Mud-Slap, Shock Wave, Signal Beam'),needs_review:true,
    raw_notes:['Source spells “Eeire Impulse”; preserved as unresolved instead of silently correcting it.']
  },
  {
    id:'panzeus',display_name:'Panzeus',source_page:2,types:['Electric','Dark'],base_stats:{hp:8,attack:10,defense:8,special_attack:10,special_defense:8,speed:11},
    ability_slots:[ability('Basic Ability 1','Intimidate','basic',1),ability('Advanced Ability 1','Frighten','advanced',1),ability('Advanced Ability 2','Limber','advanced',2),ability('Advanced Ability 3','Vanguard','advanced',3),ability('High Ability','Vicious','high',1)],
    capabilities:[capMove('Overland',8),capMove('Swim',6),jump(2,2),{name:'Power',value:7,kind:'power',capability_id:'power',reference_status:'resolved_final_normalization'},capSpecial('Darkvision'),capSpecial('Tracker'),capSpecial('Stealth'),capSpecial('Mountable',1)],
    skills:[skill('Athletics',4,1),skill('Acrobatics',4,1),skill('Combat',4,0),skill('Stealth',5,0),skill('Perception',4,2),skill('Focus',3,0)],
    evolution_text:'1 - Panthore; 2 - Panzeus Minimum 20',height_text:'1.4m (Large)',weight_text:'120kg (4)',gender_ratio_text:'50% M / 50% F',egg_group_text:'Field',diet_text:'Carnivore',habitat_text:'Forest, Grassland',
    level_up_moves:[moveRec(1,'Scratch','Normal'),moveRec(3,'Growl','Normal'),moveRec(6,'Charge','Electric'),moveRec(10,'Bite','Dark'),moveRec(12,'Fury Swipes','Normal'),moveRec(15,'Pursuit','Dark'),moveRec(19,'Torment','Dark'),moveRec(21,'Fake Out','Normal'),moveRec(24,'Hone Claws','Dark'),moveRec(28,'Assurance','Dark'),moveRec(30,'Night Slash','Dark'),moveRec(33,'Thunderbolt','Electric'),moveRec(37,'Volt Switch','Electric'),moveRec(39,'Snatch','Dark'),moveRec(42,'Nasty Plot','Dark'),moveRec(46,'Sucker Punch','Dark'),moveRec(49,'Wild Charge','Electric')],
    tm_moves:parseTm('06 Toxic, 10 Hidden Power, 11 Sunny Day, 12 Taunt, 17 Protect, 18 Rain Dance, 21 Frustration, 27 Return, 30 Shadow Ball, 32 Double Team, 40 Aerial Ace, 41 Torment, 42 Facade, 44 Rest, 45 Attract, 46 Thief, 48 Round, 49 Echoed Voice, 63 Embargo, 65 Shadow Claw, 66 Payback, 73 Thunder Wave, 77 Psych Up, 85 Dream Eater, 86 Grass Knot, 87 Swagger, 88 Sleep Talk, 89 U-Turn, 90 Substitute, 95 Snarl, 97 Dark Pulse, 100 Confide'),
    egg_moves:parseEgg('Charm, Copycat, Covet, Encore, Feint Attack, Fake Tears, Foul Play, Pay Day, Yawn, Charge Beam, Shock Wave, Eeire Impulse'),
    tutor_moves:parseTutor('Electric Terrain (N), Fury Cutter, Iron Tail, Laser Focus, Magnet Rise, Mud-Slap, Shock Wave, Signal Beam, Snore, Superpower, Throat Chop, Covet, Foul Play, Gunk Shot, Hyper Voice, Knock Off, Role Play, Seed Bomb, Snatch, Spite, Trick'),needs_review:true,
    raw_notes:['Source text concatenates “Throat ChopCovet”; normalized as two tutor entries, and source spelling “Eeire Impulse” remains unresolved.']
  },
  {
    id:'clefable-w',display_name:'Clefable W.',source_page:3,types:['Ghost','Normal'],base_stats:{hp:11,attack:10,defense:10,special_attack:12,special_defense:10,speed:7},
    ability_slots:[ability('Basic Ability 1','Cute Charm','basic',1),ability('Basic Ability 2','Magic Guard','basic',2),ability('Adv Ability 1','Friend Guard','advanced',1),ability('Adv Ability 2','Frisk','advanced',2),ability('High Ability','Unaware','high',1)],
    capabilities:[capMove('Overland',6),capMove('Swim',4),capMove('Levitate',3),jump(2,2),{name:'Power',value:4,kind:'power',capability_id:'power',reference_status:'resolved_final_normalization'},capSpecial('Magnetic'),{name:'Naturewalk',kind:'special',capability_id:'naturewalk',terrain:['Cave'],reference_status:'resolved_final_normalization'}],
    skills:[skill('Athletics',3,0),skill('Acrobatics',3,2),skill('Combat',2,2),skill('Stealth',3,0),skill('Perception',4,1),skill('Focus',4,3),skill('General',5,2),skill('Occult',5,2),skill('Medicine',4,2),skill('Guile',6,0)],
    evolution_text:'1 - Cleffa; 2 - Clefairy Minimum 10; 3 - Clefable Minimum 20',height_text:"4’ 3” / 1.3m (Medium)",weight_text:'88.2 lbs / 40kg (3)',gender_ratio_text:'25% M / 75% F',egg_group_text:'Fairy',diet_text:'Herbivore',habitat_text:'Cave, Mountain',
    level_up_moves:[moveRec(7,'Sing','Normal'),moveRec(10,'Rollout','Rock'),moveRec(13,'Defense Curl','Normal'),moveRec(16,'Follow Me','Normal'),moveRec(19,'Bestow','Normal'),moveRec(22,'Wake-Up Slap','Fighting'),moveRec(25,'Minimize','Normal'),moveRec(28,'Night Shade','Ghost'),moveRec(31,'Metronome','Normal'),moveRec(34,'Spite','Ghost'),moveRec(37,'Shadow Sneak','Ghost'),moveRec(40,'Body Slam','Normal'),moveRec(43,'Moonlight','Fairy'),moveRec(46,'Moonblast','Fairy'),moveRec(49,'Hex','Ghost'),moveRec(50,'Meteor Mash','Steel'),moveRec(55,'Curse','Ghost'),moveRec(58,'After You','Normal'),moveRec(60,'Shadow Ball','Ghost')],
    tm_moves:parseTm(tmCommon),egg_moves:[],tutor_moves:parseTutor(tutorClef),needs_review:false,
    raw_notes:['App identifier “Clefable W.” distinguishes this supplied table variant. The source evolution line itself says “Clefable Minimum 20”.']
  },
  {
    id:'clefable-k',display_name:'Clefable K.',source_page:4,types:['Electric','Fighting'],base_stats:{hp:11,attack:14,defense:8,special_attack:14,special_defense:8,speed:7},
    ability_slots:[ability('Basic Ability 1','Volt Absorb','basic',1),ability('Basic Ability 2','Magic Guard','basic',2),ability('Adv Ability 1','Friend Guard','advanced',1),ability('Adv Ability 2','Frisk','advanced',2),ability('High Ability','Vicious','high',1)],
    capabilities:[capMove('Overland',6),capMove('Swim',4),capMove('Levitate',3),jump(2,2),{name:'Power',value:4,kind:'power',capability_id:'power',reference_status:'resolved_final_normalization'},capSpecial('Magnetic'),{name:'Naturewalk',kind:'special',capability_id:'naturewalk',terrain:['Cave'],reference_status:'resolved_final_normalization'}],
    skills:[skill('Athletics',6,2),skill('Acrobatics',6,2),skill('Combat',6,2),skill('Stealth',3,0),skill('Perception',4,1),skill('Focus',5,3)],
    evolution_text:'1 - Cleffa; 2 - Clefairy Minimum 10; 3 - Clefable Minimum 20',height_text:"4’ 3” / 1.3m (Medium)",weight_text:'88.2 lbs / 40kg (3)',gender_ratio_text:'25% M / 75% F',egg_group_text:'Fairy',diet_text:'Herbivore',habitat_text:'Cave, Mountain',
    level_up_moves:[moveRec(1,'Scratch','Normal'),moveRec(1,'Spark','Electric'),moveRec(5,'Hone Claws','Dark'),moveRec(8,'Quick Attack','Normal'),moveRec(12,'Fury Swipes','Normal'),moveRec(15,'Volt Switch','Electric'),moveRec(19,'Snarl','Dark'),moveRec(22,'Fake Out','Normal'),moveRec(26,'Charge','Electric'),moveRec(29,'Thunder Punch','Electric'),moveRec(33,'Slash','Normal'),moveRec(36,'Wild Charge','Electric'),moveRec(40,'Quick Guard','Fighting'),moveRec(43,'Plasma Fists','Electric'),moveRec(47,'Focus Punch','Fighting'),moveRec(50,'Discharge','Electric')],
    tm_moves:parseTm(tmCommon),egg_moves:[],tutor_moves:parseTutor(tutorClef),needs_review:false,
    raw_notes:['App identifier “Clefable K.” distinguishes this supplied table variant. The source evolution line itself says “Clefable Minimum 20”.']
  }
];

function enrich(s){
  const unresolved=[...s.ability_slots.filter(a=>a.reference_status!=='resolved_final_normalization').map(a=>`ability:${a.name}`),...s.level_up_moves.filter(m=>m.reference_status!=='resolved_final_normalization').map(m=>`move:${m.move}`),...s.tm_moves.filter(m=>m.reference_status!=='resolved_final_normalization').map(m=>`move:${m.move}`),...s.tutor_moves.filter(m=>m.reference_status!=='resolved_final_normalization').map(m=>`move:${m.move}`),...s.egg_moves.filter(m=>m.reference_status!=='resolved_final_normalization').map(m=>`move:${m.move}`)];
  return {
    id:s.id,display_name:s.display_name,dex_number:null,variant_index:null,enabled:true,source_id:sourceId,source_title:'Fakemon 1 leva',source_kind:'homebrew_species',source_priority:priority,source_page:s.source_page,
    types:s.types,base_stats:s.base_stats,ability_slots:s.ability_slots,capabilities_text:s.capabilities.map(c=>c.name+(c.value!=null?` ${c.value}`:'' )).join(', '),skills_text:s.skills.map(x=>`${x.skill} ${x.dice}d6${x.modifier>0?`+${x.modifier}`:x.modifier<0?x.modifier:''}`).join(', '),evolution_text:s.evolution_text,
    level_up_moves:s.level_up_moves,tm_moves_text:'See parsed tm_moves',egg_moves_text:'See parsed egg_moves',tutor_moves_text:'See parsed tutor_moves',height_text:s.height_text,weight_text:s.weight_text,gender_ratio_text:s.gender_ratio_text,egg_group_text:s.egg_group_text,diet_text:s.diet_text,habitat_text:s.habitat_text,
    raw_text:`Imported from user-supplied Fakemon 1 leva.pdf, page ${s.source_page}.`,needs_review:!!s.needs_review,skills:s.skills,capabilities:s.capabilities,evolution:[],tm_moves:s.tm_moves,egg_moves:s.egg_moves,tutor_moves:s.tutor_moves,mechanical_completeness:'complete',missing_mechanical_fields:[],enabled_for_character_creation:true,reference_validation:{unresolved},search_aliases:[s.display_name,s.id],display_dex_id:null,logical_id:s.id,definition_version_id:`species:${s.id}@fakemon1leva`,content_pack_id:packId,data_notes:s.raw_notes||[]
  };
}

db.exec('BEGIN IMMEDIATE');
try{
  db.prepare(`INSERT OR REPLACE INTO content_sources(id,title,kind,priority,raw_json) VALUES(?,?,?,?,?)`).run(sourceId,'Fakemon 1 leva','homebrew_species',priority,JSON.stringify({id:sourceId,title:'Fakemon 1 leva',kind:'homebrew_species',priority,filename:'Fakemon 1 leva.pdf',available:true,note:'User-supplied campaign material imported in prototype v1.4.'}));
  db.prepare(`INSERT OR REPLACE INTO content_packs(id,name,version,priority,kind,browse_only,archive_filename,archive_sha256,manifest_json) VALUES(?,?,?,?,?,?,?,?,?)`).run(packId,'Campaign Homebrew — Fakemon 1 leva','1.0.0',priority,'homebrew_species',0,null,null,JSON.stringify({id:packId,name:'Campaign Homebrew — Fakemon 1 leva',version:'1.0.0',kind:'homebrew_species',source_id:sourceId}));
  const pos=Number(db.prepare("select coalesce(max(position),0)+1 as p from campaign_ruleset_packs where ruleset_id='all-provided-material'").get().p);
  db.prepare(`INSERT OR REPLACE INTO campaign_ruleset_packs(ruleset_id,pack_id,enabled,priority,position) VALUES(?,?,?,?,?)`).run('all-provided-material',packId,1,priority,pos);
  const stmt=db.prepare(`INSERT OR REPLACE INTO definition_versions(version_id,definition_kind,logical_id,content_pack_id,source_id,priority,source_page,needs_review,raw_json) VALUES(?,?,?,?,?,?,?,?,?)`);
  for(const s of species){const raw=enrich(s);stmt.run(raw.definition_version_id,'species',s.id,packId,sourceId,priority,s.source_page,raw.needs_review?1:0,JSON.stringify(raw));}
  // Evolution families and edges. Variant Clefables are explicit app-normalized branches; raw source text remains preserved in each definition.
  const families=[
    {id:'evofam-fakemon1leva-panthore',stages:[{stage:1,name:'Panthore',ref:'panthore',min:null,cond:null},{stage:2,name:'Panzeus',ref:'panzeus',min:20,cond:'Minimum 20'}]},
    {id:'evofam-fakemon1leva-clefable-w',stages:[{stage:1,name:'Cleffa',ref:'cleffa',min:null,cond:null},{stage:2,name:'Clefairy',ref:'clefairy',min:10,cond:'Minimum 10'},{stage:3,name:'Clefable W.',ref:'clefable-w',min:20,cond:'Minimum 20'}]},
    {id:'evofam-fakemon1leva-clefable-k',stages:[{stage:1,name:'Cleffa',ref:'cleffa',min:null,cond:null},{stage:2,name:'Clefairy',ref:'clefairy',min:10,cond:'Minimum 10'},{stage:3,name:'Clefable K.',ref:'clefable-k',min:20,cond:'Minimum 20'}]}
  ];
  const famStmt=db.prepare(`INSERT OR REPLACE INTO ptu_evolution_families(id,source_id,edges_status,raw_json) VALUES(?,?,?,?)`);
  const edgeStmt=db.prepare(`INSERT INTO ptu_evolution_edges(family_id,from_species_name,to_species_name,to_min_level,condition_text,mapping_confidence,source_id,raw_json) VALUES(?,?,?,?,?,?,?,?)`);
  // Remove any prior v1.4 edges for idempotency.
  db.prepare(`DELETE FROM ptu_evolution_edges WHERE source_id=?`).run(sourceId);
  db.prepare(`DELETE FROM ptu_evolution_families WHERE source_id=?`).run(sourceId);
  for(const f of families){
    famStmt.run(f.id,sourceId,'safe',JSON.stringify({id:f.id,source_id:sourceId,source_pages:[...new Set(species.filter(s=>f.stages.some(st=>st.ref===s.id)).map(s=>s.source_page))],source_species_ids:f.stages.map(s=>s.ref),stages:f.stages.map(s=>({stage:s.stage,species_name:s.name,species_ref_key:s.ref,min_level:s.min,condition_text:s.cond,raw_segment:s.name+(s.min?` Minimum ${s.min}`:''),parse_status:'parsed'})),edges_status:'safe',raw_texts:['Normalized from Fakemon 1 leva.pdf']}));
    for(let i=1;i<f.stages.length;i++){
      const a=f.stages[i-1],b=f.stages[i]; const raw={family_id:f.id,from_species_name:a.name,from_ref_key:a.ref,to_species_name:b.name,to_ref_key:b.ref,to_min_level:b.min,condition_text:b.cond,mapping_confidence:'safe_single_predecessor',source_id:sourceId,edge_id:`${sourceId}:${a.ref}>${b.ref}:${b.min??'na'}`};
      edgeStmt.run(f.id,a.name,b.name,b.min,b.cond,'safe_single_predecessor',sourceId,JSON.stringify(raw));
    }
  }
  db.exec('COMMIT');
}catch(e){db.exec('ROLLBACK');throw e}
console.log('Added Fakemon 1 leva pack and species:',species.map(s=>s.id).join(', '));
