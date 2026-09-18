import type { ReactNode } from 'react'
import type { ScreenId } from '../types'

const nav: Array<[ScreenId,string,string]> = [
 ['dashboard','⌂','Home'],['trainer','🪪','Trainer'],['rosters','◉','Rosters'],['creature','🐾','Creatures'],['storage','▣','Storage'],['inventory','🎒','Items'],['shop','🛒','Shop'],['library','📚','Pokédex & Rules'],['npcs','📓','NPCs'],['levelup','✦','Level Up'],['editor','✎','Editors']
]

export default function AppShell({screen,onNavigate,children}:{screen:ScreenId;onNavigate:(s:ScreenId)=>void;children:ReactNode}) {
  return <div className="app-backdrop">
    <div className="pokedex-shell">
      <aside className="hardware-rail">
        <div className="lens"><span /></div>
        <div className="hardware-dots"><i/><i/></div>
      </aside>
      <div className="app-window">
        <header className="topbar">
          <div className="brand"><span className="brand-mark">◉</span><strong>PTU Companion</strong><span className="prototype-label">FUNCTIONAL v0.4</span></div>
          <div className="top-actions"><button>⌕</button><button>🔔<b>3</b></button><div className="trainer-mini"><span>AR</span><small>Alex Rowan</small></div></div>
        </header>
        <div className="app-layout">
          <nav className="sidebar">
            {nav.map(([id,icon,label])=><button key={id} className={screen===id?'active':''} onClick={()=>onNavigate(id)}><span>{icon}</span>{label}</button>)}
            <div className="sidebar-footer">⚙ Settings</div>
          </nav>
          <main className="screen-content">{children}</main>
        </div>
        <footer className="shell-footer">Stay prepared. Train smart. Build your story. <span>●</span></footer>
      </div>
      <div className="hardware-bottom"></div>
    </div>
  </div>
}
