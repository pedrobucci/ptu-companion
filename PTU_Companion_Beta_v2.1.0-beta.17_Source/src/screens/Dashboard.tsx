import { creatures, items, rosters } from '../mockData'
import type { ScreenId } from '../types'
import CreatureCard from '../components/CreatureCard'
import { Chip, PrimaryButton, Progress, Section, TypeBadge } from '../components/UI'

export default function Dashboard({go}:{go:(s:ScreenId)=>void}) {
  const active=rosters[0]
  const rosterCreatures=active.creatureIds.map(id=>creatures.find(c=>c.id===id)!).filter(Boolean)
  return <div className="page dashboard-page">
    <div className="page-heading"><div><p className="eyebrow">ACTIVE CAMPAIGN</p><h1>Trainer Command Center</h1><p>Quick access to your trainer, rosters, inventory and campaign tools.</p></div><PrimaryButton onClick={()=>go('levelup')}>✦ Guided Level-Up</PrimaryButton></div>
    <div className="dashboard-grid">
      <Section title="ACTIVE TRAINER" action={<button className="link-btn" onClick={()=>go('trainer')}>Open sheet →</button>}>
        <div className="trainer-summary">
          <div className="avatar">AR</div><div><h2>Alex Rowan</h2><Chip tone="gold">Rookie Tamer</Chip><p>Level <strong>18</strong></p></div>
        </div>
        <Progress value={2450} max={3600} tone="blue"/><div className="muted row-between"><span>2,450 XP</span><span>3,600 XP</span></div>
        <div className="summary-kpis"><div><span>💰</span><strong>₽ 12,500</strong><small>Money</small></div><div><span>💎</span><strong>240</strong><small>PTU Points</small></div><div><span>⭐</span><strong>4</strong><small>Badges</small></div></div>
      </Section>
      <Section title="ACTIVE ROSTERS" action={<button className="link-btn" onClick={()=>go('rosters')}>Manage →</button>}>
        <div className="roster-tabs-mini">{rosters.map(r=><span key={r.id} style={{borderColor:r.accent}}><b>{r.name}</b><small>{r.creatureIds.length}/{r.maxMembers}</small></span>)}</div>
        <div className="creature-strip">{rosterCreatures.map(c=><CreatureCard key={c.id} creature={c} compact onClick={()=>go('creature')}/>)}</div>
      </Section>
      <Section title="RECENT CREATURES" action={<button className="link-btn" onClick={()=>go('creature')}>View all →</button>}>
        <div className="recent-list">{creatures.slice(0,3).map(c=><button key={c.id} onClick={()=>go('creature')}><img src={c.image}/><div><strong>{c.name}</strong><div>{c.types.map(t=><TypeBadge key={t} type={t}/>)}</div></div><div className="recent-hp"><small>HP {c.hp}/{c.maxHp}</small><Progress value={c.hp} max={c.maxHp} tone={c.hp/c.maxHp<.5?'yellow':'green'}/></div></button>)}</div>
      </Section>
      <Section title="BACKPACK" action={<button className="link-btn" onClick={()=>go('inventory')}>View all →</button>}><div className="inventory-mini">{items.slice(0,6).map(i=><div key={i.id}><span>{i.icon}</span><strong>{i.name}</strong><em>× {i.quantity}</em></div>)}</div></Section>
      <Section title="SHOP" action={<button className="link-btn" onClick={()=>go('shop')}>Visit shop →</button>}><div className="shop-promo"><div className="shop-bag">🛍️</div><div><h3>Poké Mart</h3><p>Restock healing items, Poké Balls and field gear.</p><PrimaryButton variant="gold" onClick={()=>go('shop')}>Browse catalog</PrimaryButton></div></div></Section>
      <Section title="RULESET STATUS"><div className="ruleset-card"><div className="row-between"><strong>PTU Core + Campaign</strong><Chip tone="green">ACTIVE</Chip></div><dl><div><dt>Core</dt><dd>1.05</dd></div><div><dt>Playtests</dt><dd>Enabled</dd></div><div><dt>Homebrew</dt><dd>Campaign Pack</dd></div></dl></div></Section>
    </div>
  </div>
}
