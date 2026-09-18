import type { Creature } from '../types'
import { TypeBadge } from './UI'

export default function CreatureCard({creature, selected=false, compact=false, onClick}:{creature:Creature;selected?:boolean;compact?:boolean;onClick?:()=>void}) {
  return <button className={`creature-card ${selected?'selected':''} ${compact?'compact':''}`} onClick={onClick}>
    <img src={creature.image} alt="" />
    <div className="creature-card-meta">
      <strong>{creature.name}</strong>
      <span>Lv. {creature.level}</span>
      {!compact && <div className="type-row">{creature.types.map(t=><TypeBadge key={t} type={t}/>)}</div>}
    </div>
    {creature.injured && <span className="injury-dot" title="Injured">!</span>}
  </button>
}
