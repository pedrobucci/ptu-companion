import type { Creature, Item, Roster } from './types'

export const creatures: Creature[] = [
  { id:'sparkit', name:'Sparkit', species:'Voltkit', level:18, types:['electric'], hp:56, maxHp:56, injured:false, loyalty:4, ball:'Ultra Ball', image:'/creatures/sparkit.svg', stats:{hp:56,attack:42,defense:38,spAttack:54,spDefense:41,speed:64}, moves:['Thunder Fang','Quick Attack','Nuzzle','Volt Switch'], abilities:['Static Field','Motor Drive'] },
  { id:'drakion', name:'Drakion', species:'Ember Drake', level:18, types:['dragon','fire'], hp:72, maxHp:72, injured:false, loyalty:5, ball:'Great Ball', image:'/creatures/drakion.svg', stats:{hp:72,attack:58,defense:49,spAttack:61,spDefense:46,speed:52}, moves:['Dragon Claw','Flame Burst','Roar','Agility'], abilities:['Blaze','Intimidate'] },
  { id:'gempy', name:'Gempy', species:'Impurro', level:17, types:['dark','ghost'], hp:28, maxHp:48, injured:true, loyalty:4, ball:'Dusk Ball', image:'/creatures/gempy.svg', stats:{hp:48,attack:24,defense:22,spAttack:41,spDefense:27,speed:44}, moves:['Shadow Claw','Astonish','Hex','Taunt'], abilities:['Levitate','Prankster'] },
  { id:'voltix', name:'Voltix', species:'Aquavolt', level:17, types:['water'], hp:64, maxHp:64, injured:false, loyalty:3, ball:'Poké Ball', image:'/creatures/voltix.svg', stats:{hp:64,attack:36,defense:44,spAttack:55,spDefense:47,speed:50}, moves:['Water Pulse','Aqua Jet','Ice Beam','Protect'], abilities:['Torrent'] },
  { id:'rocky', name:'Rocky', species:'Terranox', level:16, types:['ground'], hp:78, maxHp:78, injured:false, loyalty:4, ball:'Heavy Ball', image:'/creatures/rocky.svg', stats:{hp:78,attack:60,defense:66,spAttack:24,spDefense:45,speed:28}, moves:['Bulldoze','Rock Tomb','Protect','Dig'], abilities:['Sturdy'] },
  { id:'florin', name:'Florin', species:'Leafin', level:16, types:['grass'], hp:54, maxHp:54, injured:false, loyalty:4, ball:'Friend Ball', image:'/creatures/florin.svg', stats:{hp:54,attack:39,defense:42,spAttack:57,spDefense:51,speed:48}, moves:['Razor Leaf','Growth','Synthesis','Magical Leaf'], abilities:['Overgrow'] },
  { id:'snowbell', name:'Snowbell', species:'Frostkin', level:15, types:['ice','fairy'], hp:49, maxHp:49, injured:false, loyalty:3, ball:'Premier Ball', image:'/creatures/snowbell.svg', stats:{hp:49,attack:31,defense:37,spAttack:55,spDefense:58,speed:52}, moves:['Icy Wind','Draining Kiss','Charm','Aurora Beam'], abilities:['Snow Cloak'] },
  { id:'emberpup', name:'Emberpup', species:'Flarepup', level:15, types:['fire'], hp:50, maxHp:50, injured:false, loyalty:3, ball:'Poké Ball', image:'/creatures/emberpup.svg', stats:{hp:50,attack:52,defense:38,spAttack:45,spDefense:36,speed:55}, moves:['Flame Wheel','Bite','Roar','Quick Attack'], abilities:['Flash Fire'] },
]

export const rosters: Roster[] = [
  { id:'personal', name:'Personal Team', role:'COMBAT', accent:'#0b7b4b', maxMembers:6, creatureIds:['sparkit','drakion','gempy','voltix','rocky','florin'] },
  { id:'company', name:'Company Team', role:'COMPANY', accent:'#2f6dda', maxMembers:6, creatureIds:['sparkit','gempy','voltix','snowbell','rocky','drakion'] },
  { id:'mounts', name:'Mounts', role:'MOUNT', accent:'#e99a19', maxMembers:6, creatureIds:['drakion','rocky','florin'] },
]

export const items: Item[] = [
  { id:'potion', name:'Potion', category:'medicine', price:300, quantity:24, icon:'🧪', description:'Restores 20 HP.' },
  { id:'super-potion', name:'Super Potion', category:'medicine', price:700, quantity:12, icon:'🧴', description:'Restores 50 HP.' },
  { id:'poke-ball', name:'Poké Ball', category:'pokeball', price:200, quantity:36, icon:'🔴', description:'Standard capture device.' },
  { id:'great-ball', name:'Great Ball', category:'pokeball', price:600, quantity:18, icon:'🔵', description:'Improved capture device.' },
  { id:'oran-berry', name:'Oran Berry', category:'berry', price:100, quantity:15, icon:'🫐', description:'Small restorative berry.' },
  { id:'escape-rope', name:'Escape Rope', category:'general', price:550, quantity:7, icon:'🪢', description:'A sturdy emergency rope.' },
  { id:'running-shoes', name:'Running Shoes', category:'general', price:1200, quantity:1, icon:'👟', description:'Improves movement.', equipSlot:'feet' },
  { id:'focus-charm', name:'Focus Charm', category:'battle', price:1250, quantity:1, icon:'🔷', description:'A charm that sharpens focus.', equipSlot:'accessory' },
  { id:'trainer-cap', name:'Trainer Cap', category:'general', price:850, quantity:1, icon:'🧢', description:'Classic field cap.', equipSlot:'head' },
  { id:'windbreaker', name:'Windbreaker', category:'general', price:1100, quantity:1, icon:'🧥', description:'Protective field jacket.', equipSlot:'body' },
  { id:'power-glove', name:'Power Glove', category:'battle', price:1750, quantity:1, icon:'🥊', description:'Reinforced combat glove.', equipSlot:'main-hand' },
  { id:'guard-shield', name:'Guard Shield', category:'battle', price:1500, quantity:1, icon:'🛡️', description:'Compact off-hand shield.', equipSlot:'off-hand' },
]

export const moveDefinitions = [
  { name:'Thunder Fang', type:'electric', category:'Physical', frequency:'EOT', ac:2, db:6, range:'Melee, 1 Target', effect:'The target may become Paralyzed on a high roll.', tags:['Bite','Contact','Electric'] },
  { name:'Shadow Claw', type:'ghost', category:'Physical', frequency:'At-Will', ac:2, db:7, range:'Melee, 1 Target', effect:'High Critical Hit range.', tags:['Blade','Contact'] },
  { name:'Water Pulse', type:'water', category:'Special', frequency:'At-Will', ac:2, db:6, range:'6, 1 Target', effect:'May confuse the target.', tags:['Pulse'] },
]
