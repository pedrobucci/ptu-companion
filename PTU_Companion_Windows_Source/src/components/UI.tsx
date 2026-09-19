import type { ReactNode } from 'react'
import type { PokemonType } from '../types'

export function Section({title, action, children, className=''}:{title:string;action?:ReactNode;children:ReactNode;className?:string}) {
  return <section className={`section-card ${className}`}>
    <header className="section-title"><strong>{title}</strong><span>{action}</span></header>
    <div className="section-body">{children}</div>
  </section>
}

export function TypeBadge({type}:{type:PokemonType}) { return <span className={`type-badge type-${type}`}>{type.toUpperCase()}</span> }
export function Chip({children,tone='neutral'}:{children:ReactNode;tone?:'neutral'|'green'|'yellow'|'gold'|'red'|'blue'|'purple'}) { return <span className={`chip chip-${tone}`}>{children}</span> }
export function IconButton({children,title,onClick}:{children:ReactNode;title:string;onClick?:()=>void}) { return <button className="icon-btn" onClick={onClick} title={title}>{children}</button> }
export function PrimaryButton({children,onClick,variant='primary',disabled=false}:{children:ReactNode;onClick?:()=>void;variant?:'primary'|'danger'|'success'|'gold'|'ghost';disabled?:boolean}) { return <button disabled={disabled} className={`btn btn-${variant}`} onClick={onClick}>{children}</button> }
export function MiniStat({label,value,kind}:{label:string;value:string|number;kind?:string}) { return <div className="mini-stat"><span className={`stat-dot ${kind||''}`}></span><span>{label}</span><strong>{value}</strong></div> }
export function Progress({value,max,tone='green'}:{value:number;max:number;tone?:string}) { const p=Math.max(0,Math.min(100,(value/max)*100)); return <div className="progress"><span className={`progress-${tone}`} style={{width:`${p}%`}} /></div> }
export function Empty({children}:{children:ReactNode}) { return <div className="empty-state">{children}</div> }
