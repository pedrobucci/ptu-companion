import { creatures, items } from '../mockData'
import { Chip, MiniStat, Progress, Section } from '../components/UI'
import CreatureCard from '../components/CreatureCard'

export default function Trainer(){
 const equip=items.filter(i=>i.equipSlot)
 return <div className="page">
  <div className="page-heading"><div><p className="eyebrow">TRAINER SHEET</p><h1>Alex Rowan</h1><p>Profile, skills, combat data, equipment and campaign history.</p></div><Chip tone="yellow">◈ GM Override available</Chip></div>
  <div className="tabbar"><button className="active">Profile</button><button>Skills</button><button>Stats</button><button>Features</button><button>Edges</button><button>Combat</button><button>History</button></div>
  <div className="trainer-grid">
   <Section title="PROFILE" className="profile-card"><div className="trainer-summary large"><div className="avatar">AR</div><div><h2>Alex Rowan ♂</h2><Chip tone="gold">Rookie Tamer</Chip><p>Level <strong>18</strong></p></div></div><Progress value={2450} max={3600} tone="blue"/><div className="two-up"><MiniStat label="Money" value="₽12,500" kind="money"/><MiniStat label="PTU Points" value="240" kind="points"/></div></Section>
   <Section title="ACTIVE ROSTER"><div className="creature-strip six">{creatures.slice(0,6).map(c=><CreatureCard key={c.id} creature={c} compact/>)}</div></Section>
   <Section title="TEMPORARY MODIFIERS"><div className="modifier-list"><span>🍀 Well Rested <b>+5% XP</b></span><span>🥗 Nutritious Meal <b>+10 HP</b></span><span>🎯 Training Focus <b>+1 Accuracy</b></span><span className="danger">🩹 Minor Injury <b>-1 Speed</b></span></div></Section>
   <Section title="SKILLS"><div className="skill-columns"><div><h4>BODY</h4>{['Athletics 4d6','Acrobatics 3d6','Combat 4d6','Intimidate 3d6'].map(x=><span key={x}>{x}</span>)}</div><div><h4>MIND</h4>{['Education 3d6','Medicine 2d6','Technology 4d6','Perception 3d6'].map(x=><span key={x}>{x}</span>)}</div><div><h4>SPIRIT</h4>{['Charm 2d6','Command 4d6','Focus 4d6','Stealth 5d6+2'].map(x=><span key={x}>{x}</span>)}</div></div></Section>
   <Section title="DERIVED STATS"><div className="stat-stack"><MiniStat label="HP" value="56 / 56" kind="hp"/><MiniStat label="Attack" value="42 +3" kind="atk"/><MiniStat label="Defense" value="38" kind="def"/><MiniStat label="Sp. Attack" value="51 +5" kind="spa"/><MiniStat label="Sp. Defense" value="46" kind="spd"/><MiniStat label="Speed" value="58" kind="speed"/></div></Section>
   <Section title="CAPABILITIES"><div className="cap-grid"><Chip tone="blue">Overland 7</Chip><Chip tone="blue">Swim 3</Chip><Chip tone="purple">Power 5</Chip><Chip tone="green">Jump 2/2</Chip><Chip>Throwing 7</Chip><Chip>Naturewalk</Chip></div></Section>
   <Section title="TRAINER MOVES"><div className="move-rows"><div><b>Quick Command</b><span>At-Will</span></div><div><b>Rally</b><span>Scene x2</span></div><div><b>Focus</b><span>At-Will</span></div><div><b>Weapon Move: Strike</b><span>2d6+18</span></div></div></Section>
   <Section title="EQUIPMENT"><div className="equipment-grid">{equip.slice(0,6).map(i=><div key={i.id}><span>{i.icon}</span><small>{i.equipSlot}</small><strong>{i.name}</strong></div>)}</div></Section>
  </div>
 </div>
}
