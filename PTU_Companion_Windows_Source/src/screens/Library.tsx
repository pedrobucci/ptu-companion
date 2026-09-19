import { useEffect, useMemo, useState } from 'react'
import { Chip, Section } from '../components/UI'

type Kind='species'|'moves'|'abilities'|'features'|'edges'|'poke_edges'|'capabilities'|'items'
type Def={id:string;name:string;kind:Kind;type?:string|null;category?:string|null;effect?:string|null;packName?:string|null;needsReview?:boolean;damageBase?:number|null;ac?:number|null;price?:number|null;types?:string[];baseStats?:Record<string,number>|null}
const kinds:Array<[Kind,string]>=[['species','Pokédex'],['moves','Moves'],['abilities','Abilities'],['features','Features'],['edges','Edges'],['poke_edges','Poké Edges'],['capabilities','Capabilities'],['items','Items']]

export default function Library(){
 const [kind,setKind]=useState<Kind>('species'), [query,setQuery]=useState(''), [rows,setRows]=useState<Def[]>([]), [selected,setSelected]=useState<any>(null), [status,setStatus]=useState<any>(null), [rulesets,setRulesets]=useState<any[]>([]), [loading,setLoading]=useState(false), [error,setError]=useState('')
 const active=status?.activeRulesetId
 useEffect(()=>{ Promise.all([fetch('/api/definitions/status').then(r=>r.json()),fetch('/api/rulesets').then(r=>r.json())]).then(([s,r])=>{setStatus(s);setRulesets(r.rulesets||[])}).catch(e=>setError(e.message)) },[])
 useEffect(()=>{ const t=setTimeout(async()=>{setLoading(true);try{const p=new URLSearchParams({kind,q:query,limit:'60'});const r=await fetch('/api/definitions?'+p);const j=await r.json();setRows(j.rows||[]); if(j.rows?.length) setSelected(await fetch(`/api/definitions/${kind}/${j.rows[0].id}`).then(x=>x.json()));}catch(e:any){setError(e.message)}finally{setLoading(false)}},180);return()=>clearTimeout(t)},[kind,query,active])
 const counts=status?.counts||{}
 async function switchRuleset(id:string){const r=await fetch('/api/rulesets/active',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});const j=await r.json();setStatus((s:any)=>({...s,...j,activeRulesetId:id}))}
 const selectedDef=selected?.definition
 return <div className="page">
   <div className="page-heading"><div><p className="eyebrow">REAL PTU DATA</p><h1>Pokédex & Rules Library</h1><p>Read-only browser for definitions resolved from the active Campaign Ruleset.</p></div><Chip tone="green">SQLite + Ruleset</Chip></div>
   {error&&<div className="alert alert-danger">{error}</div>}
   <div className="ruleset-summary"><div className="row-between"><div><strong>Active Ruleset</strong><div>{status?.ruleset?.name||'Loading…'}</div></div><select value={active||''} onChange={e=>switchRuleset(e.target.value)}>{rulesets.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div><div className="catalog-counts">{kinds.map(([k,l])=><span key={k}><b>{counts[k]??'—'}</b> {l}</span>)}</div></div>
   <div className="definition-toolbar"><label>Search<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, effect, type…"/></label></div>
   <div className="definition-kind-tabs">{kinds.map(([k,l])=><button key={k} className={kind===k?'active':''} onClick={()=>setKind(k)}>{l}</button>)}</div>
   <div className="definition-layout">
    <Section title={`${kinds.find(x=>x[0]===kind)?.[1].toUpperCase()} · ${rows.length}${loading?' · Loading…':''}`}><div className="definition-list">{rows.map(d=><button className={'definition-row '+(selectedDef?.id===d.id?'selected':'')} key={d.id} onClick={async()=>setSelected(await fetch(`/api/definitions/${kind}/${d.id}`).then(x=>x.json()))}><div><h3>{d.name}</h3><p>{d.effect||[d.type,d.category].filter(Boolean).join(' · ')}</p></div><div className="definition-source">{d.packName}</div></button>)}</div></Section>
    <Section title="RESOLVED DETAIL">{selectedDef?<><div className="definition-hero"><div><h2>{selectedDef.name}</h2><p>{selectedDef.versionId}</p></div></div>{selectedDef.type&&<p><b>Type:</b> {selectedDef.type}</p>}{selectedDef.category&&<p><b>Category:</b> {selectedDef.category}</p>}{selectedDef.effect&&<div className="definition-text">{selectedDef.effect}</div>}{selectedDef.baseStats&&<div className="definition-stat-grid">{Object.entries(selectedDef.baseStats).map(([k,v])=><div key={k}><small>{k}</small><strong>{String(v)}</strong></div>)}</div>}</>:<p>Select a definition.</p>}</Section>
   </div>
 </div>
}
