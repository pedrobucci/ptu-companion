import { useMemo, useState } from 'react'
import { creatures, rosters } from '../mockData'
import CreatureCard from '../components/CreatureCard'
import { Chip, Section, TypeBadge } from '../components/UI'

export default function Rosters(){
 const [selectedRoster,setSelectedRoster]=useState(rosters[0].id); const [selectedCreature,setSelectedCreature]=useState('sparkit')
 const roster=rosters.find(r=>r.id===selectedRoster)!; const selected=creatures.find(c=>c.id===selectedCreature)!
 const members=useMemo(()=>roster.creatureIds.map(id=>creatures.find(c=>c.id===id)!).filter(Boolean),[roster])
 return <div className="page"><div className="page-heading"><div><p className="eyebrow">ROSTERS</p><h1>Team Organization</h1><p>A Pokémon can belong to multiple rosters while remaining one persistent creature.</p></div><button className="btn btn-primary">＋ Create Roster</button></div>
  <div className="roster-selector">{rosters.map(r=><button key={r.id} className={selectedRoster===r.id?'active':''} style={{'--accent':r.accent} as any} onClick={()=>setSelectedRoster(r.id)}><strong>{r.name}</strong><Chip tone={r.role==='MOUNT'?'yellow':r.role==='COMPANY'?'blue':'green'}>{r.role}</Chip><b>{r.creatureIds.length}/{r.maxMembers}</b></button>)}</div>
  <div className="roster-layout"><Section title={`${roster.name.toUpperCase()} — ${members.length}/${roster.maxMembers}`} action={<span className="muted">Drag & drop concept</span>}><div className="roster-grid">{members.map(c=><CreatureCard key={c.id} creature={c} selected={c.id===selectedCreature} onClick={()=>setSelectedCreature(c.id)}/>)}</div><h3 className="subhead">Available Creatures</h3><div className="available-grid">{creatures.map(c=><CreatureCard key={c.id} creature={c} compact selected={c.id===selectedCreature} onClick={()=>setSelectedCreature(c.id)}/>)}</div></Section>
   <Section title="CREATURE DETAILS" className="roster-detail"><div className="detail-hero"><img src={selected.image}/><div><h2>{selected.name}</h2><p>{selected.species} · Lv. {selected.level}</p><div>{selected.types.map(t=><TypeBadge key={t} type={t}/>)}</div></div></div><dl className="detail-dl"><div><dt>Poké Ball</dt><dd>{selected.ball}</dd></div><div><dt>Loyalty</dt><dd>{'♥'.repeat(selected.loyalty)}{'♡'.repeat(5-selected.loyalty)}</dd></div><div><dt>Storage</dt><dd>{selected.injured?<Chip tone="red">Blocked: injured</Chip>:<Chip tone="green">Available</Chip>}</dd></div></dl><h4>Roster memberships</h4><div className="membership-list">{rosters.filter(r=>r.creatureIds.includes(selected.id)).map(r=><span key={r.id}><i style={{background:r.accent}}/>{r.name}<Chip tone="neutral">{r.role}</Chip></span>)}</div></Section></div>
 </div>
}
