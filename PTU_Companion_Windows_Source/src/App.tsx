import { useState } from 'react'
import AppShell from './components/AppShell'
import type { ScreenId } from './types'
import Dashboard from './screens/Dashboard'
import Trainer from './screens/Trainer'
import Rosters from './screens/Rosters'
import Creature from './screens/Creature'
import Storage from './screens/Storage'
import Inventory from './screens/Inventory'
import Shop from './screens/Shop'
import Library from './screens/Library'
import Npcs from './screens/Npcs'
import LevelUp from './screens/LevelUp'
import Editor from './screens/Editor'

export default function App(){
 const [screen,setScreen]=useState<ScreenId>('dashboard')
 let content
 switch(screen){
  case 'trainer': content=<Trainer/>; break
  case 'rosters': content=<Rosters/>; break
  case 'creature': content=<Creature/>; break
  case 'storage': content=<Storage/>; break
  case 'inventory': content=<Inventory/>; break
  case 'shop': content=<Shop/>; break
  case 'library': content=<Library/>; break
  case 'npcs': content=<Npcs/>; break
  case 'levelup': content=<LevelUp/>; break
  case 'editor': content=<Editor/>; break
  default: content=<Dashboard go={setScreen}/>;
 }
 return <AppShell screen={screen} onNavigate={setScreen}>{content}</AppShell>
}
