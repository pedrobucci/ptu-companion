import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const PACK_ID = 'campaign-homebrew-fakemon-1-leva';
const PACK_VERSION = '2.0.1';
const SOURCE_ID = 'fakemon-1-leva';
const PRIORITY = 180;
const ASSET_DIR = join(root, 'seed', 'content-packs', PACK_ID, 'assets', 'species');

const slug = (s) => String(s || '').trim().toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const parseList = (s) => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const unique = (arr, key = (x) => typeof x === 'string' ? x.toLowerCase() : JSON.stringify(x)) => {
  const seen = new Set();
  return arr.filter((x) => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; });
};
const parseLevel = (text) => String(text || '').split('|').map(x => x.trim()).filter(Boolean).map(x => {
  const m = x.match(/^(\S+)\s+(.+)$/); return { level: m ? m[1] : '—', move: m ? m[2] : x };
});
const parseTmText = (text) => String(text || '').split('|').map(x => x.trim()).filter(Boolean).map(x => {
  const m = x.match(/^(\d+)\s+(.+)$/); return { code: m ? m[1].padStart(2,'0') : '', move: m ? m[2] : x };
});
const parseTutorText = (text) => unique(String(text || '').split(',').map(x => x.trim()).filter(Boolean).map(x => {
  const natural = /\(N\)$/i.test(x); return { move: x.replace(/\s*\(N\)$/i,''), note: natural ? 'N' : null };
}), x => `${x.move.toLowerCase()}|${x.note || ''}`);
const skill = (name,dice,modifier=0) => ({skill:name,dice,modifier});
const movement = (name,value) => ({name,value,kind:'movement'});
const special = (name,value=null,extra={}) => ({name,...(value == null ? {} : {value}),kind:'special',...extra});
const jump = (high,long) => ({name:'Jump',high,long,kind:'jump',component_capability_ids:['high-jump','long-jump'],reference_status:'resolved_composite'});
const power = (value) => ({name:'Power',value,kind:'power'});
const naturewalk = (...terrain) => special('Naturewalk',null,{terrain});

const TM_CLEF = '01 Work Up|03 Psyshock|04 Calm Mind|06 Toxic|10 Hidden Power|11 Sunny Day|13 Ice Beam|14 Blizzard|15 Hyper Beam|16 Light Screen|17 Protect|18 Rain Dance|20 Safeguard|21 Frustration|22 Solar Beam|24 Thunderbolt|25 Thunder|27 Return|29 Psychic|30 Shadow Ball|31 Brick Break|32 Double Team|33 Reflect|35 Flamethrower|38 Fire Blast|42 Facade|44 Rest|45 Attract|48 Round|49 Echoed Voice|52 Focus Blast|56 Fling|57 Charge Beam|68 Giga Impact|73 Thunder Wave|77 Psych Up|85 Dream Eater|86 Grass Knot|87 Swagger|88 Sleep Talk|90 Substitute|99 Dazzling Gleam|100 Confide';
const TUTOR_CLEF = 'After You, Body Slam, Bounce, Counter, Covet, Defense Curl, Disarming Voice (N), Double-Edge, Drain Punch, Dynamic Punch, Endeavor, Fire Punch, Focus Punch, Gravity, Heal Bell, Helping Hand, Hyper Voice, Ice Punch, Icy Wind, Iron Tail, Knock Off, Laser Focus, Last Resort, Magic Coat, Mega Kick, Mega Punch, Mimic, Mud-Slap, Recycle, Role Play, Rollout, Seismic Toss, Shock Wave, Signal Beam, Snatch, Snore, Soft-Boiled, Spotlight (N), Stealth Rock, Telekinesis, Thunder Punch, Trick, Uproar, Water Pulse, Wonder Room, Zen Headbutt';
const TM_PANTHER = '06 Toxic|10 Hidden Power|11 Sunny Day|12 Taunt|17 Protect|18 Rain Dance|21 Frustration|27 Return|30 Shadow Ball|32 Double Team|40 Aerial Ace|41 Torment|42 Facade|44 Rest|45 Attract|46 Thief|48 Round|49 Echoed Voice|63 Embargo|65 Shadow Claw|66 Payback|73 Thunder Wave|77 Psych Up|85 Dream Eater|86 Grass Knot|87 Swagger|88 Sleep Talk|89 U-Turn|90 Substitute|95 Snarl|97 Dark Pulse|100 Confide';
const EGG_PANTHER = 'Charm, Copycat, Covet, Encore, Feint Attack, Fake Tears, Foul Play, Pay Day, Yawn, Charge Beam, Shock Wave, Eerie Impulse';
const TUTOR_PANTHORE = 'Covet, Foul Play, Gunk Shot, Hyper Voice, Iron Tail, Knock Off, Role Play, Seed Bomb, Snatch, Snore, Spite, Trick, Fury Cutter, Magnet Rise, Mud-Slap, Shock Wave, Signal Beam';
const TUTOR_PANZEUS = 'Electric Terrain (N), Fury Cutter, Iron Tail, Laser Focus, Magnet Rise, Mud-Slap, Shock Wave, Signal Beam, Snore, Superpower, Throat Chop, Covet, Foul Play, Gunk Shot, Hyper Voice, Knock Off, Role Play, Seed Bomb, Snatch, Spite, Trick';

const SPECIES = [
 {id:'panthore',name:'Panthore',page:1,types:['Electric','Dark'],stats:[5,5,3,5,3,6],
  abilities:[['basic','Run Away'],['advanced','Cute Charm'],['advanced','Limber'],['advanced','Vanguard'],['high','Vicious']],
  caps:[movement('Overland',6),movement('Swim',3),jump(2,1),power(3),special('Darkvision'),special('Tracker'),special('Stealth'),special('Underdog')],
  skills:[skill('Athletics',2,1),skill('Acrobatics',2,2),skill('Combat',2,2),skill('Stealth',3),skill('Perception',3),skill('Focus',2)],
  evo:'1 - Panthore; 2 - Panzeus Minimum 20',height:'0.6m (Small)',weight:'20kg (2)',gender:'50% M / 50% F',egg:'Field',hatch:'7 days',diet:'Omnivore',habitat:'Forest, Grassland',
  levels:'1 Scratch|3 Growl|6 Charge|10 Bite|12 Fury Swipes|15 Pursuit|19 Torment|21 Fake Out|24 Hone Claws|28 Assurance|30 Night Slash|33 Thunderbolt|37 Volt Switch|39 Snatch|42 Nasty Plot|46 Sucker Punch|49 Wild Charge',
  tms:TM_PANTHER,eggs:EGG_PANTHER,tutors:TUTOR_PANTHORE},
 {id:'panzeus',name:'Panzeus',page:2,types:['Electric','Dark'],stats:[8,10,8,10,8,11],
  abilities:[['basic','Intimidate'],['advanced','Frighten'],['advanced','Limber'],['advanced','Vanguard'],['high','Vicious']],
  caps:[movement('Overland',8),movement('Swim',6),jump(2,2),power(7),special('Darkvision'),special('Tracker'),special('Stealth'),special('Mountable',1)],
  skills:[skill('Athletics',4,1),skill('Acrobatics',4,1),skill('Combat',4),skill('Stealth',5),skill('Perception',4,2),skill('Focus',3)],
  evo:'1 - Panthore; 2 - Panzeus Minimum 20',height:'1.4m (Large)',weight:'120kg (4)',gender:'50% M / 50% F',egg:'Field',hatch:'7 days',diet:'Carnivore',habitat:'Forest, Grassland',
  levels:'4 Scratch|4 Growl|6 Charge|10 Bite|12 Fury Swipes|15 Pursuit|19 Torment|21 Fake Out|24 Hone Claws|28 Assurance|30 Night Slash|33 Thunderbolt|37 Volt Switch|39 Snatch|42 Nasty Plot|46 Sucker Punch|49 Wild Charge',
  tms:TM_PANTHER,eggs:EGG_PANTHER,tutors:TUTOR_PANZEUS},
 {id:'clefable-w',name:'Clefable W.',page:3,types:['Ghost','Normal'],stats:[11,10,10,12,10,7],
  abilities:[['basic','Cute Charm'],['basic','Magic Guard'],['advanced','Friend Guard'],['advanced','Frisk'],['high','Unaware']],
  caps:[movement('Overland',6),movement('Swim',4),movement('Levitate',3),jump(2,2),power(4),special('Magnetic'),naturewalk('Cave')],
  skills:[skill('Athletics',3),skill('Acrobatics',3,2),skill('Combat',2,2),skill('Stealth',3),skill('Perception',4,1),skill('Focus',4,3),skill('General',5,2),skill('Occult',5,2),skill('Medicine',4,2),skill('Guile',6)],
  evo:'1 - Cleffa; 2 - Clefairy Minimum 10; 3 - Clefable W. Minimum 20',height:'1.3m (Medium)',weight:'40kg (3)',gender:'25% M / 75% F',egg:'Fairy',diet:'Herbivore',habitat:'Cave, Mountain',
  levels:'7 Sing|10 Rollout|13 Defense Curl|16 Follow Me|19 Bestow|22 Wake-Up Slap|25 Minimize|28 Night Shade|31 Metronome|34 Spite|37 Shadow Sneak|40 Body Slam|43 Moonlight|46 Moonblast|49 Hex|50 Meteor Mash|55 Curse|58 After You|60 Shadow Ball',
  tms:TM_CLEF,eggs:'',tutors:TUTOR_CLEF},
 {id:'clefable-k',name:'Clefable K.',page:4,types:['Electric','Fighting'],stats:[11,14,8,14,8,7],
  abilities:[['basic','Volt Absorb'],['basic','Magic Guard'],['advanced','Friend Guard'],['advanced','Frisk'],['high','Vicious']],
  caps:[movement('Overland',6),movement('Swim',4),movement('Levitate',3),jump(2,2),power(4),special('Magnetic'),naturewalk('Cave')],
  skills:[skill('Athletics',6,2),skill('Acrobatics',6,2),skill('Combat',6,2),skill('Stealth',3),skill('Perception',4,1),skill('Focus',5,3)],
  evo:'1 - Cleffa; 2 - Clefairy Minimum 10; 3 - Clefable K. Minimum 20',height:'1.3m (Medium)',weight:'40kg (3)',gender:'25% M / 75% F',egg:'Fairy',diet:'Herbivore',habitat:'Cave, Mountain',
  levels:'1 Scratch|1 Spark|5 Hone Claws|8 Quick Attack|12 Fury Swipes|15 Volt Switch|19 Snarl|22 Fake Out|26 Charge|29 Thunder Punch|33 Slash|36 Wild Charge|40 Quick Guard|43 Plasma Fists|47 Focus Punch|50 Discharge',
  tms:TM_CLEF,eggs:'',tutors:TUTOR_CLEF},
 {id:'greavard',name:'Greavard',page:5,dex:971,types:['Ghost'],stats:[6,8,6,4,5,5],
  abilities:[['basic','Pick Up'],['basic','Run Away'],['advanced','Friend Guard'],['advanced','Fluffy'],['high','Defeatist']],
  caps:[movement('Overland',5),movement('Swim',2),jump(0,0),power(4),special('Darkvision'),special('Tracker'),special('Deadly Silent'),special('Underdog'),special('Phasing')],
  skills:[skill('Athletics',3),skill('Acrobatics',2,-2),skill('Combat',2),skill('Stealth',3,2),skill('Perception',3,1),skill('Focus',3)],
  evo:'1 - Greavard; 2 - Houndstone Minimum 25',height:'0.6m (Small)',weight:'25kg (2)',gender:'50% M / 50% F',egg:'Field',hatch:'7 days',diet:'Terravore',habitat:'Forest, Grassland',
  levels:'1 Tackle|1 Growl|3 Lick|6 Tail Whip|6 Bite|9 Roar|12 Headbutt|16 Dig|24 Rest|28 Crunch|32 Play Rough|37 Helping Hand|41 Phantom Force|46 Charm|52 Double-Edge',
  tms:'17 Protect|46 Thief|42 Facade|78 Bulldoze|11 Sunny Day|18 Rain Dance|37 Sandstorm|88 Sleep Talk|44 Rest|90 Substitute|30 Shadow Ball|05 Roar|61 Will-O-Wisp|85 Dream Eater|87 Swagger',
  eggs:'Ally Switch, Destiny Bond, Disable, Howl, Memento, Shadow Sneak, Yawn',
  tutors:'Take Down, Charm, Mud-Slap, Scary Face, Fire Fang, Thunder Fang, Ice Fang, Confuse Ray, Hex, Snarl, Mud Shot, Night Shade, Endure, Dig, Psychic Fangs, Stomping Tantrum, Crunch, Trick, Play Rough, Helping Hand, Phantom Force, Tera Blast, Uproar, Poltergeist, Pain Split, Double-Edge, Endeavor, Headbutt, Zen Headbutt, Ominous Wind, Smokescreen (N), Shadow Sneak (N), Snarl (N)'},
 {id:'houndstone',name:'Houndstone',page:6,dex:972,types:['Ghost'],stats:[7,10,10,5,10,7],
  abilities:[['basic','Pick Up'],['basic','Sand Rush'],['advanced','Friend Guard'],['advanced','Fluffy'],['high','Defeatist']],
  caps:[movement('Overland',6),movement('Swim',3),jump(0,0),power(8),special('Darkvision'),special('Tracker'),special('Deadly Silent'),special('Phasing')],
  skills:[skill('Athletics',5,1),skill('Acrobatics',1,-1),skill('Combat',5,1),skill('Stealth',6),skill('Perception',5,1),skill('Focus',5)],
  evo:'1 - Greavard; 2 - Houndstone Minimum 25',height:'0.6m (Small)',weight:'25kg (2)',gender:'50% M / 50% F',egg:'Field',hatch:'7 days',diet:'Terravore',habitat:'Forest, Grassland',
  levels:'Evolution Last Respects|3 Lick|6 Tail Whip|6 Bite|9 Roar|12 Headbutt|16 Dig|24 Rest|28 Crunch|36 Play Rough|41 Helping Hand|46 Phantom Force|51 Charm|58 Double-Edge',
  tms:'17 Protect|46 Thief|42 Facade|78 Bulldoze|11 Sunny Day|18 Rain Dance|37 Sandstorm|88 Sleep Talk|44 Rest|90 Substitute|30 Shadow Ball|05 Roar|61 Will-O-Wisp|85 Dream Eater|87 Swagger|68 Giga Impact|15 Hyper Beam|65 Shadow Claw|01 Work Up',
  eggs:'Ally Switch, Destiny Bond, Disable, Howl, Memento, Shadow Sneak, Yawn',
  tutors:'Take Down, Charm, Mud-Slap, Scary Face, Fire Fang, Thunder Fang, Ice Fang, Confuse Ray, Hex, Snarl, Mud Shot, Night Shade, Endure, Dig, Psychic Fangs, Stomping Tantrum, Crunch, Trick, Play Rough, Helping Hand, Phantom Force, Tera Blast, Uproar, Poltergeist, Pain Split, Double-Edge, Endeavor, Headbutt, Zen Headbutt, Ominous Wind, Smokescreen (N), Shadow Sneak (N), Snarl (N), Tackle (N), Growl (N), Body Press, Seed Bomb'},
 {id:'maschiff',name:'Maschiff',page:7,dex:942,types:['Dark'],stats:[5,6,6,3,6,3],
  abilities:[['basic','Run Away'],['basic','Intimidate'],['advanced','Friend Guard'],['advanced','Frighten'],['high','Stakeout']],
  caps:[movement('Overland',5),movement('Swim',2),jump(1,1),power(4),special('Darkvision'),special('Tracker'),special('Stealth'),special('Underdog'),naturewalk('Urban')],
  skills:[skill('Athletics',3),skill('Acrobatics',2),skill('Combat',3),skill('Stealth',3),skill('Perception',3),skill('Focus',1)],
  evo:'1 - Maschiff; 2 - Mabosstiff Minimum 25',height:'0.5m (Small)',weight:'16kg (2)',gender:'50% M / 50% F',egg:'Field',hatch:'7 days',diet:'Omnivore',habitat:'Urban, Grassland',
  levels:'1 Tackle|1 Leer|1 Scary Face|4 Lick|7 Snarl|10 Hone Claws|14 Bite|18 Roar|22 Headbutt|26 Payback|31 Crunch|35 Swagger|39 Reversal|43 Jaw Lock|49 Double-Edge',
  tms:'17 Protect|46 Thief|42 Facade|95 Snarl|11 Sunny Day|18 Rain Dance|88 Sleep Talk|44 Rest|12 Taunt|97 Dark Pulse|90 Substitute|05 Roar',
  eggs:'Destiny Bond, Endeavor, Play Rough, Retaliate',
  tutors:'Take Down, Charm, Fake Tears, Scary Face, Fire Fang, Thunder Fang, Ice Fang, Trailblaze, Endure, Dig, Psychic Fangs, Body Slam, Crunch, Play Rough, Helping Hand, Reversal, Tera Blast, Lash Out, Double-Edge, Endeavor, Headbutt, Rock Smash, Knock Off, Dark Pulse, Seed Bomb, Swagger, Charm (N), Focus Energy (N), Bounce (N), Lunge (N), Taunt (N)'},
 {id:'mabosstiff',name:'Mabosstiff',page:8,dex:943,types:['Dark'],stats:[8,12,9,6,7,9],
  abilities:[['basic','Guard Dog'],['basic','Intimidate'],['advanced','Friend Guard'],['advanced','Frighten'],['high','Stakeout']],
  caps:[movement('Overland',7),movement('Swim',3),jump(1,1),power(9),special('Darkvision'),special('Tracker'),special('Stealth'),naturewalk('Urban')],
  skills:[skill('Athletics',4),skill('Acrobatics',3),skill('Combat',5,2),skill('Stealth',5),skill('Perception',5),skill('Focus',4)],
  evo:'1 - Maschiff; 2 - Mabosstiff Minimum 25',height:'0.5m (Small)',weight:'16kg (2)',gender:'50% M / 50% F',egg:'Field',hatch:'7 days',diet:'Omnivore',habitat:'Urban, Grassland',
  levels:'Evolution Comeuppance|4 Lick|7 Snarl|10 Hone Claws|14 Bite|18 Roar|22 Headbutt|26 Payback|34 Crunch|39 Swagger|43 Reversal|48 Jaw Lock|55 Double-Edge|60 Outrage',
  tms:'17 Protect|46 Thief|42 Facade|95 Snarl|11 Sunny Day|18 Rain Dance|88 Sleep Talk|44 Rest|12 Taunt|97 Dark Pulse|90 Substitute|05 Roar|93 Wild Charge|68 Giga Impact|15 Hyper Beam',
  eggs:'Destiny Bond, Endeavor, Play Rough, Retaliate',
  tutors:'Take Down, Charm (N), Fake Tears, Scary Face, Fire Fang, Thunder Fang, Ice Fang, Trailblaze, Endure, Dig, Psychic Fangs, Body Slam, Crunch (N), Play Rough, Helping Hand, Reversal, Tera Blast, Lash Out, Double-Edge, Endeavor, Headbutt, Rock Smash, Knock Off, Dark Pulse, Seed Bomb, Swagger (N), Focus Energy (N), Bounce (N), Lunge (N), Taunt (N), Hyper Voice, Outrage, Spite, Pain Split, Curse, Skull Bash, Tackle (N), Leer (N)'},
 {id:'fidough',name:'Fidough',page:9,dex:926,types:['Fairy'],stats:[4,6,7,3,6,7],
  abilities:[['basic','Own Tempo'],['basic','Cute Charm'],['advanced','Friend Guard'],['advanced','Frisk'],['high','Klutz']],
  caps:[movement('Overland',5),movement('Swim',2),jump(1,1),power(3),special('Alluring'),special('Tracker'),special('Underdog')],
  skills:[skill('Athletics',2),skill('Acrobatics',3),skill('Combat',3),skill('Stealth',1,-2),skill('Perception',3),skill('Focus',3)],
  evo:'1 - Fidough; 2 - Dachsbun Minimum 15',height:'0.3m (Small)',weight:'10.9kg (1)',gender:'50% M / 50% F',egg:'Field, Mineral',hatch:'3 days',diet:'Omnivore',habitat:'Grassland',
  levels:'1 Tackle|1 Growl|3 Lick|6 Tail Whip|8 Covet|11 Bite|15 Baby-Doll Eyes|18 Play Rough|22 Work Up|26 Baton Pass|30 Roar|33 Double-Edge|36 Charm|40 Crunch|45 Last Resort',
  tms:'17 Protect|42 Facade|11 Sunny Day|18 Rain Dance|88 Sleep Talk|99 Dazzling Gleam|44 Rest|90 Substitute|05 Roar|77 Psych Up|01 Work Up|43 Flame Charge',
  eggs:'Copycat, Howl, Sweet Scent (N), Wish, Yawn',
  tutors:'Draining Kiss (N), Snarl (N), Bounce (N), Wish (N), Take Down, Charm, Agility, Mud-Slap, Fire Fang, Thunder Fang, Ice Fang, Trailblaze, Mud Shot, Endure, Dig, Psychic Fangs, Body Slam, Stomping Tantrum, Crunch, Play Rough, Helping Hand, Baton Pass, Misty Terrain, Tera Blast, Double-Edge, Endeavor, Alluring Voice'},
 {id:'dachsbun',name:'Dachsbun',page:10,dex:927,types:['Fairy'],stats:[6,8,12,5,8,10],
  abilities:[['basic','Well-Baked Body'],['basic','Blessed Touch'],['advanced','Friend Guard'],['advanced','Frisk'],['high','Aroma Veil']],
  caps:[movement('Overland',7),movement('Swim',3),jump(1,1),power(5),special('Alluring'),special('Tracker')],
  skills:[skill('Athletics',4),skill('Acrobatics',5),skill('Combat',4),skill('Stealth',1),skill('Perception',5),skill('Focus',5)],
  evo:'1 - Fidough; 2 - Dachsbun Minimum 15',height:'0.5m (Small)',weight:'14.9kg (1)',gender:'50% M / 50% F',egg:'Field, Mineral',hatch:'3 days',diet:'Omnivore',habitat:'Grassland',
  levels:'1 Tackle|1 Growl|3 Lick|6 Tail Whip|8 Covet|11 Bite|15 Baby-Doll Eyes|18 Play Rough|22 Work Up|26 Baton Pass|30 Roar|33 Double-Edge|36 Charm|40 Crunch|45 Last Resort',
  tms:'17 Protect|42 Facade|11 Sunny Day|18 Rain Dance|88 Sleep Talk|99 Dazzling Gleam|44 Rest|90 Substitute|05 Roar|77 Psych Up|01 Work Up|43 Flame Charge|15 Hyper Beam|68 Giga Impact',
  eggs:'Copycat, Howl, Sweet Scent (N), Wish, Yawn',
  tutors:'Draining Kiss (N), Snarl (N), Bounce (N), Wish (N), Take Down, Charm, Agility, Mud-Slap, Fire Fang, Thunder Fang, Ice Fang, Trailblaze, Mud Shot, Endure, Dig, Psychic Fangs, Body Slam, Stomping Tantrum, Crunch, Play Rough, Helping Hand, Baton Pass, Misty Terrain, Tera Blast, Double-Edge, Endeavor, Alluring Voice, Scary Face, Seed Bomb, Body Press'},
 {id:'zorua-hisui',name:'Hisuian Zorua',page:11,dex:570,variant:'Hisui',types:['Normal','Ghost'],stats:[4,6,4,9,4,7],
  abilities:[['basic','Illusion'],['advanced','Weird Power'],['advanced','Cute Tears'],['advanced','Pickpocket'],['high','Courage']],
  caps:[movement('Overland',5),movement('Swim',2),jump(1,1),power(1),special('Darkvision'),special('Illusionist'),naturewalk('Forest','Urban'),special('Pack Mon'),special('Deadly Silent'),special('Phasing'),special('Tracker'),special('Underdog')],
  skills:[skill('Athletics',2),skill('Acrobatics',3,1),skill('Combat',2),skill('Stealth',4,1),skill('Perception',2),skill('Focus',2,1)],
  evo:'1 - Hisuian Zorua; 2 - Hisuian Zoroark Minimum 30',height:'0.7m (Small)',weight:'12.5kg (1)',gender:'87.5% M / 12.5% F',egg:'Field',hatch:'10 days',diet:'Omnivore',habitat:'Urban, Forest',
  levels:'1 Leer|1 Scratch|5 Lick|9 Fake Tears|13 Shadow Sneak|17 Feint Attack|21 Curse|25 Taunt|29 Shadow Ball|33 Torment|37 Agility|41 Bitter Malice|45 Phantom Force|49 Nasty Plot|53 Imprison|57 Night Daze',
  tms:'04 Calm Mind|05 Roar|06 Toxic|10 Hidden Power|11 Sunny Day|12 Taunt|17 Protect|18 Rain Dance|21 Frustration|27 Return|30 Shadow Ball|32 Double Team|40 Aerial Ace|41 Torment|42 Facade|44 Rest|45 Attract|46 Thief|48 Round|56 Fling|63 Embargo|66 Payback|75 Swords Dance|77 Psych Up|86 Grass Knot|87 Swagger|88 Sleep Talk|89 U-Turn|90 Substitute|95 Snarl|97 Dark Pulse|100 Confide',
  eggs:'Comeuppance, Detect, Extrasensory, Memento',
  tutors:'Bounce, Counter, Covet, Foul Play, Hyper Voice, Knock Off, Snatch, Snore, Spite, Sucker Punch, Trick, Uproar, Take Down, Fake Tears, Agility, Confuse Ray, Hex, Swift, Icy Wind, Night Shade, Endure, Snowscape, Dig, Shadow Claw, Imprison, Will-O-Wisp, Nasty Plot, Sludge Bomb, Phantom Force, Giga Impact, Hyper Beam, Tera Blast, Focus Punch, Burning Jealousy, Lash Out, Pain Split, Skitter Smack, Curse'},
 {id:'zoroark-hisui',name:'Hisuian Zoroark',page:12,dex:571,variant:'Hisui',types:['Normal','Ghost'],stats:[6,10,6,13,6,11],
  abilities:[['basic','Illusion'],['advanced','Weird Power'],['advanced','Pride'],['advanced','Pickpocket'],['high','Shadow Tag']],
  caps:[movement('Overland',5),movement('Swim',2),jump(1,1),power(1),special('Darkvision'),special('Illusionist'),naturewalk('Forest','Urban'),special('Pack Mon'),special('Deadly Silent'),special('Phasing'),special('Tracker')],
  skills:[skill('Athletics',3,1),skill('Acrobatics',4,2),skill('Combat',4),skill('Stealth',5,4),skill('Perception',3),skill('Focus',3,2)],
  evo:'1 - Hisuian Zorua; 2 - Hisuian Zoroark Minimum 30',height:'1.6m (Medium)',weight:'81.1kg (4)',gender:'87.5% M / 12.5% F',egg:'Field',hatch:'10 days',diet:'Omnivore',habitat:'Urban, Forest',
  levels:'Evolution Shadow Claw|5 Lick|9 Fake Tears|13 Shadow Sneak|17 Feint Attack|21 Curse|25 Taunt|29 Shadow Ball|33 Torment|37 Agility|41 Bitter Malice|45 Phantom Force|49 Nasty Plot|53 Imprison|57 Night Daze',
  tms:'04 Calm Mind|05 Roar|06 Toxic|10 Hidden Power|11 Sunny Day|12 Taunt|17 Protect|18 Rain Dance|21 Frustration|27 Return|30 Shadow Ball|32 Double Team|40 Aerial Ace|41 Torment|42 Facade|44 Rest|45 Attract|46 Thief|48 Round|56 Fling|63 Embargo|66 Payback|75 Swords Dance|77 Psych Up|86 Grass Knot|87 Swagger|88 Sleep Talk|89 U-Turn|90 Substitute|95 Snarl|97 Dark Pulse|100 Confide',
  eggs:'Comeuppance, Detect, Extrasensory, Memento',
  tutors:'Bounce, Counter, Covet, Foul Play, Hyper Voice, Knock Off, Snatch, Snore, Spite, Sucker Punch, Trick, Uproar, Take Down, Fake Tears, Agility, Confuse Ray, Hex, Swift, Icy Wind, Night Shade, Endure, Snowscape, Dig, Shadow Claw, Imprison, Will-O-Wisp, Nasty Plot, Sludge Bomb, Phantom Force, Giga Impact, Hyper Beam, Tera Blast, Focus Punch, Burning Jealousy, Lash Out, Pain Split, Skitter Smack, Curse, Fling, Scary Face'},
 {id:'urania',name:'Urania',page:13,types:['Bug','Rock'],stats:[10,3,18,3,18,4],
  abilities:[['basic','Compound Eyes'],['advanced','Shield Dust'],['advanced','Full Guard'],['advanced','Aroma Veil'],['high','Néctar Queen']],
  caps:[movement('Overland',4),movement('Swim',1),jump(5,4),movement('Sky',7),power(10),special('Darkvision'),special('Illusionist'),special('Alluring'),special('Honey Gather')],
  skills:[skill('Athletics',5),skill('Acrobatics',6),skill('Combat',5),skill('Stealth',4),skill('Perception',6,3),skill('Focus',5)],
  evo:'Single Stage',height:'1.82m (Medium)',weight:'81.1kg (4)',gender:'100% F',egg:'Undiscovered',diet:'Nectarivore',habitat:'Forest',
  levels:'1 Leech Life|1 Sleep Powder|1 Poison Powder|1 Stun Spore|7 Rage Powder|10 Powder|14 Gust|18 Silver Wind|20 Ancient Power|25 Rock Throw|31 Bug Buzz|34 Rock Slide|37 Quiver Dance|41 Stone Edge',
  tms:'06 Toxic|09 Venoshock|10 Hidden Power|11 Sunny Day|17 Protect|20 Safeguard|21 Frustration|23 Smack Down|26 Earthquake|27 Return|32 Double Team|34 Sludge Wave|36 Sludge Bomb|37 Sandstorm|39 Rock Tomb|42 Facade|44 Rest|45 Attract|48 Round|69 Rock Polish|71 Stone Edge|74 Gyro Ball|78 Bulldoze|80 Rock Slide|83 Infestation|87 Swagger|88 Sleep Talk|90 Substitute|100 Confide',
  eggs:'',tutors:'Bug Bite, Morning Sun, Air Cutter, Defog, Signal Beam, Giga Drain, Ominous Wind, Struggle Bug, Secret Power, Zen Headbutt, Guard Split, Power Split, Rock Blast, Stealth Rock, Earth Power, Magnitude, Silk Trap (N)'}
];

const NEW_MOVES = [
 {id:'poltergeist',name:'Poltergeist',page:14,type:'Ghost',frequency:'Daily x2',ac:3,db:15,damage:'4d10+20 / 45',class:'Physical',range:'Ranged 6, 1 Target',effect:'The user attacks by controlling the target’s held item. This Move fails if the target is not holding an item.',contest_type:'Smart',contest_effect:'Sabotage'},
 {id:'last-respects',name:'Last Respects',page:14,type:'Ghost',frequency:'Scene x2',ac:2,db:2,damage:'1d6+3 / 7',class:'Physical',range:'Cone 4',effect:'For each ally that has fainted during this battle, raise this Move’s Damage Base by +4, to a maximum Damage Base of 22.',contest_type:'Tough',contest_effect:'Reliable'},
 {id:'comeuppance',name:'Comeuppance',page:14,type:'Dark',frequency:'Scene',ac:null,db:null,damage:null,class:'Physical',range:'Any, 1 Target, Reaction',effect:'Reaction: when the user is hit by a damaging Special Attack or Attack Move, resolve the triggering Move as if the user resisted it one step further. If the user is not fainted afterward, the triggering foe loses HP equal to twice the HP the user lost. This effect is Physical, cannot miss, and cannot affect a target immune to Dark.',contest_type:'Tough',contest_effect:'Double Time'},
 {id:'alluring-voice',name:'Alluring Voice',page:14,type:'Fairy',frequency:'Scene x2',ac:2,db:8,damage:'2d8+10 / 19',class:'Special',range:'Ranged 6, 1 Target',effect:'If the target increased any Combat Stage during its previous turn, the target becomes Confused.',contest_type:'Beauty',contest_effect:'Attention Grabber'},
 {id:'snowscape',name:'Snowscape',page:15,type:'Ice',frequency:'Daily x2',ac:null,db:null,damage:null,class:'Status',range:'Field, Weather',effect:'The weather becomes a Snowstorm for 5 rounds. Ice-Type Pokémon gain +20 Damage Reduction. Snowstorm counts as Hail for Abilities and Moves that reference Hail.',contest_type:'Beauty',contest_effect:'Desperation'},
 {id:'burning-jealousy',name:'Burning Jealousy',page:15,type:'Fire',frequency:'Scene',ac:2,db:6,damage:'2d6+8 / 15',class:'Special',range:'Burst 3',effect:'If a target increased any Combat Stage during its previous turn, that target is Burned.',contest_type:'Smart',contest_effect:'Sabotage'},
 {id:'skitter-smack',name:'Skitter Smack',page:15,type:'Bug',frequency:'Scene x2',ac:3,db:6,damage:'2d6+8 / 15',class:'Special',range:'Ranged 6, 1 Target',effect:'Lower the target’s Special Attack by 2 Combat Stages.',contest_type:'Tough',contest_effect:'Sabotage'},
 {id:'silk-trap',name:'Silk Trap',page:15,type:'Bug',frequency:'Scene',ac:null,db:null,damage:null,class:'Status',range:'Self, Interrupt, Shield, Trigger, Friendly',effect:'Trigger: the user would be hit by a Move. The user is not hit and takes no damage or effects from that Move. Afterward, all targets in Burst 1 are Slowed and Trapped.',contest_type:'Beautiful',contest_effect:'Inversed Appeal'}
];

const NEW_ABILITIES = [
 {id:'guard-dog',name:'Guard Dog',page:16,frequency:'Static',effect:'The user is immune to Moves and Abilities that would force it to run away from battle. When affected by Intimidate or Frighten, the user gains the corresponding Combat Stages instead of losing them.'},
 {id:'well-baked-body',name:'Well-Baked Body',page:16,frequency:'Static',effect:'The user is immune to Fire-Type damage. When hit by a Fire-Type Move, the user gains +1 Defense Combat Stage.'},
 {id:'nectar-queen',name:'Néctar Queen',page:16,frequency:'Static',effect:'The user may consume Honey to gain a Digestion Buff as if it had consumed Leftovers. Whenever the user spends that Digestion Buff to regain HP, it also gains 1 Tick of Temporary HP.'}
];

const FAMILIES = [
 {id:'evofam-fakemon1leva-panthore',stages:[['Panthore','panthore',null],['Panzeus','panzeus',20]]},
 {id:'evofam-fakemon1leva-clefable-w',stages:[['Cleffa','cleffa',null],['Clefairy','clefairy',10],['Clefable W.','clefable-w',20]]},
 {id:'evofam-fakemon1leva-clefable-k',stages:[['Cleffa','cleffa',null],['Clefairy','clefairy',10],['Clefable K.','clefable-k',20]]},
 {id:'evofam-fakemon1leva-greavard',stages:[['Greavard','greavard',null],['Houndstone','houndstone',25]]},
 {id:'evofam-fakemon1leva-maschiff',stages:[['Maschiff','maschiff',null],['Mabosstiff','mabosstiff',25]]},
 {id:'evofam-fakemon1leva-fidough',stages:[['Fidough','fidough',null],['Dachsbun','dachsbun',15]]},
 {id:'evofam-fakemon1leva-zorua-hisui',stages:[['Hisuian Zorua','zorua-hisui',null],['Hisuian Zoroark','zoroark-hisui',30]]}
];

function imageData(id) {
  const p = join(ASSET_DIR, `${id}.webp`);
  return existsSync(p) ? `data:image/webp;base64,${readFileSync(p).toString('base64')}` : null;
}
function hasTable(db,name){ return !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(name); }
function applyDb(dbPath) {
  if (!existsSync(dbPath)) { console.warn(`Skipping missing database: ${dbPath}`); return; }
  const db = new DatabaseSync(dbPath);
  for (const table of ['content_sources','content_packs','campaign_ruleset_packs','definition_versions','ptu_evolution_families','ptu_evolution_edges']) {
    if (!hasTable(db,table)) throw new Error(`${dbPath}: missing required table ${table}`);
  }
  const hasDef=(kind,id)=>!!db.prepare('SELECT 1 FROM definition_versions WHERE definition_kind=? AND logical_id=? LIMIT 1').get(kind,id);
  const refStatus=(kind,id)=>hasDef(kind,id)?'resolved_final_normalization':'unresolved_source_reference';
  const moveRec=(x)=>({level:String(x.level),move:x.move,move_id:slug(x.move),reference_status:refStatus('moves',slug(x.move))});
  const tmRec=(x)=>({code:x.code,move:x.move,move_id:slug(x.move),reference_status:refStatus('moves',slug(x.move))});
  const tutorRec=(x)=>({move:x.move,move_id:slug(x.move),...(x.note?{note:x.note}:{}),reference_status:refStatus('moves',slug(x.move))});
  const eggRec=(name)=>({move:name,move_id:slug(name),reference_status:refStatus('moves',slug(name))});
  const abilities=(items)=> {
    const count={basic:0,advanced:0,high:0};
    return items.map(([category,name]) => {
      count[category]=(count[category]||0)+1;
      const label=category==='basic'?'Basic Ability':category==='advanced'?'Advanced Ability':'High Ability';
      return {slot:category==='high'?label:`${label} ${count[category]}`,name,ability_id:slug(name),slot_category:category,slot_index:count[category],reference_status:refStatus('abilities',slug(name))};
    });
  };
  const caps=(items)=>items.map(c=>{
    if(c.reference_status) return c;
    if(c.kind==='jump') return c;
    const id=slug(c.name);
    return {...c,capability_id:id,reference_status:refStatus('capabilities',id)};
  });
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT OR REPLACE INTO content_sources(id,title,kind,priority,raw_json) VALUES(?,?,?,?,?)')
      .run(SOURCE_ID,'Fakemon 1 leva','homebrew_species',PRIORITY,JSON.stringify({id:SOURCE_ID,title:'Fakemon 1 leva',kind:'homebrew_species',priority:PRIORITY,filename:'Fakemon 1 leva.pdf',available:true,note:'Campaign species, regional forms, moves and abilities normalized from the user-supplied PDF.'}));
    db.prepare('INSERT OR REPLACE INTO content_packs(id,name,version,priority,kind,browse_only,archive_filename,archive_sha256,manifest_json) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(PACK_ID,'Campaign Homebrew — Fakemon 1 leva',PACK_VERSION,PRIORITY,'homebrew_species',0,`${PACK_ID}-${PACK_VERSION}.ptucp`,null,JSON.stringify({format_version:1,id:PACK_ID,name:'Campaign Homebrew — Fakemon 1 leva',version:PACK_VERSION,priority:PRIORITY,kind:'homebrew_species',source_ids:[SOURCE_ID]}));
    const existing=db.prepare("SELECT position FROM campaign_ruleset_packs WHERE ruleset_id='all-provided-material' AND pack_id=?").get(PACK_ID);
    const position=existing?.position ?? Number(db.prepare("SELECT COALESCE(MAX(position),0)+1 AS p FROM campaign_ruleset_packs WHERE ruleset_id='all-provided-material'").get().p);
    db.prepare('INSERT OR REPLACE INTO campaign_ruleset_packs(ruleset_id,pack_id,enabled,priority,position) VALUES(?,?,?,?,?)')
      .run('all-provided-material',PACK_ID,1,PRIORITY,position);
    db.prepare('DELETE FROM definition_versions WHERE content_pack_id=?').run(PACK_ID);
    const insertDef=db.prepare('INSERT OR REPLACE INTO definition_versions(version_id,definition_kind,logical_id,content_pack_id,source_id,priority,source_page,needs_review,raw_json) VALUES(?,?,?,?,?,?,?,?,?)');
    for(const m of NEW_MOVES){
      const raw={logical_id:m.id,id:m.id,display_name:m.name,name:m.name,type:m.type,frequency_text:m.frequency,ac:m.ac,damage_base:m.db,damage_text:m.damage,class:m.class,range_text:m.range,effect_text:m.effect,contest_type:m.contest_type,contest_effect:m.contest_effect,source_id:SOURCE_ID,source_title:'Fakemon 1 leva',source_page:m.page,content_pack_id:PACK_ID,enabled:true,needs_review:false};
      insertDef.run(`moves:${m.id}@fakemon1leva-v2`,'moves',m.id,PACK_ID,SOURCE_ID,PRIORITY,m.page,0,JSON.stringify(raw));
    }
    for(const a of NEW_ABILITIES){
      const raw={logical_id:a.id,id:a.id,display_name:a.name,name:a.name,frequency_text:a.frequency,effect_text:a.effect,source_id:SOURCE_ID,source_title:'Fakemon 1 leva',source_page:a.page,content_pack_id:PACK_ID,enabled:true,needs_review:false};
      insertDef.run(`abilities:${a.id}@fakemon1leva-v2`,'abilities',a.id,PACK_ID,SOURCE_ID,PRIORITY,a.page,0,JSON.stringify(raw));
    }
    for(const s of SPECIES){
      const stats={hp:s.stats[0],attack:s.stats[1],defense:s.stats[2],special_attack:s.stats[3],special_defense:s.stats[4],speed:s.stats[5]};
      const level=unique(parseLevel(s.levels).map(moveRec),x=>`${x.level}|${x.move_id}`);
      const tm=unique(parseTmText(s.tms).map(tmRec),x=>`${x.code}|${x.move_id}`);
      const tutor=parseTutorText(s.tutors).map(tutorRec);
      const egg=unique(parseList(s.eggs).map(eggRec),x=>x.move_id);
      const ability_slots=abilities(s.abilities);
      const capabilities=caps(s.caps);
      const unresolved=[...ability_slots.filter(x=>x.reference_status!=='resolved_final_normalization').map(x=>`ability:${x.name}`),...level.filter(x=>x.reference_status!=='resolved_final_normalization').map(x=>`move:${x.move}`),...tm.filter(x=>x.reference_status!=='resolved_final_normalization').map(x=>`move:${x.move}`),...tutor.filter(x=>x.reference_status!=='resolved_final_normalization').map(x=>`move:${x.move}`),...egg.filter(x=>x.reference_status!=='resolved_final_normalization').map(x=>`move:${x.move}`)];
      const raw={id:s.id,logical_id:s.id,display_name:s.name,dex_number:s.dex??null,variant_index:s.variant?1:null,regional_form:s.variant??null,enabled:true,source_id:SOURCE_ID,source_title:'Fakemon 1 leva',source_kind:'homebrew_species',source_priority:PRIORITY,source_page:s.page,types:s.types,base_stats:stats,ability_slots,capabilities_text:capabilities.map(c=>c.kind==='jump'?`Jump ${c.high}/${c.long}`:c.value!=null?`${c.name} ${c.value}`:c.name).join(', '),skills_text:s.skills.map(x=>`${x.skill} ${x.dice}d6${x.modifier>0?`+${x.modifier}`:x.modifier<0?x.modifier:''}`).join(', '),evolution_text:s.evo,level_up_moves:level,tm_moves_text:'See parsed tm_moves',egg_moves_text:'See parsed egg_moves',tutor_moves_text:'See parsed tutor_moves',height_text:s.height,weight_text:s.weight,gender_ratio_text:s.gender,egg_group_text:s.egg,hatch_rate_text:s.hatch??null,diet_text:s.diet,habitat_text:s.habitat,raw_text:`Imported and normalized from Fakemon 1 leva.pdf, page ${s.page}.`,needs_review:false,skills:s.skills,capabilities,evolution:[],tm_moves:tm,egg_moves:egg,tutor_moves:tutor,mechanical_completeness:'complete',missing_mechanical_fields:[],enabled_for_character_creation:true,reference_validation:{unresolved:unique(unresolved)},search_aliases:unique([s.name,s.id,s.variant?`${s.name.replace(/^Hisuian /,'')} Hisui`:null].filter(Boolean)),display_dex_id:s.dex?`#${s.dex}${s.variant?'-H':''}`:null,definition_version_id:`species:${s.id}@fakemon1leva-v2`,content_pack_id:PACK_ID,portrait_data_url:imageData(s.id),data_notes:['Spelling and list-boundary errors were normalized to the project Pokédex conventions.',...(s.id==='zorua-hisui'||s.id==='zoroark-hisui'?['Owner-approved correction: the source PDF Fairy typing is a typo; Hisuian Zorua and Hisuian Zoroark use Normal/Ghost.']:['Source mechanics were otherwise preserved.'])]};
      insertDef.run(raw.definition_version_id,'species',s.id,PACK_ID,SOURCE_ID,PRIORITY,s.page,0,JSON.stringify(raw));
    }
    db.prepare('DELETE FROM ptu_evolution_edges WHERE source_id=?').run(SOURCE_ID);
    db.prepare('DELETE FROM ptu_evolution_families WHERE source_id=?').run(SOURCE_ID);
    const famStmt=db.prepare('INSERT OR REPLACE INTO ptu_evolution_families(id,source_id,edges_status,raw_json) VALUES(?,?,?,?)');
    const edgeStmt=db.prepare('INSERT INTO ptu_evolution_edges(family_id,from_species_name,to_species_name,to_min_level,condition_text,mapping_confidence,source_id,raw_json) VALUES(?,?,?,?,?,?,?,?)');
    for(const f of FAMILIES){
      const stages=f.stages.map(([name,ref,min],i)=>({stage:i+1,species_name:name,species_ref_key:ref,min_level:min,condition_text:min?`Minimum ${min}`:null,raw_segment:min?`${name} Minimum ${min}`:name,parse_status:'parsed'}));
      famStmt.run(f.id,SOURCE_ID,'safe',JSON.stringify({id:f.id,source_id:SOURCE_ID,source_species_ids:stages.map(x=>x.species_ref_key),stages,edges_status:'safe',raw_texts:['Normalized from Fakemon 1 leva.pdf']}));
      for(let i=1;i<stages.length;i++){const a=stages[i-1],b=stages[i];const edge={family_id:f.id,from_species_name:a.species_name,from_ref_key:a.species_ref_key,to_species_name:b.species_name,to_ref_key:b.species_ref_key,to_min_level:b.min_level,condition_text:b.condition_text,mapping_confidence:'safe_single_predecessor',source_id:SOURCE_ID,edge_id:`${SOURCE_ID}:${a.species_ref_key}>${b.species_ref_key}:${b.min_level??'na'}`};edgeStmt.run(f.id,a.species_name,b.species_name,b.min_level,b.condition_text,'safe_single_predecessor',SOURCE_ID,JSON.stringify(edge));}
    }
    db.exec('COMMIT');
    console.log(`Updated ${dbPath}: ${SPECIES.length} species, ${NEW_MOVES.length} moves, ${NEW_ABILITIES.length} abilities; pack ${PACK_VERSION}.`);
  } catch(e) { db.exec('ROLLBACK'); throw e; } finally { db.close(); }
}

const defaults=[
  join(root,'seed','definitions','ptu_seed_v1.0.sqlite3'),
  join(root,'data','definitions','ptu_definitions.sqlite3'),
  resolve(root,'..','seed','ptu_seed_v1.0.sqlite3')
];
const cli=process.argv.slice(2).map(p=>resolve(process.cwd(),p));
for(const dbPath of (cli.length?cli:defaults)) applyDb(dbPath);
