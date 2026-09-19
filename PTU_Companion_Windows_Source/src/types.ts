export type ScreenId =
  | 'dashboard'
  | 'trainer'
  | 'rosters'
  | 'creature'
  | 'storage'
  | 'inventory'
  | 'shop'
  | 'library'
  | 'npcs'
  | 'levelup'
  | 'editor'

export type PokemonType =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic'
  | 'bug' | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy'

export interface Creature {
  id: string
  name: string
  species: string
  level: number
  types: PokemonType[]
  hp: number
  maxHp: number
  injured: boolean
  loyalty: number
  ball: string
  image: string
  stats: Record<'hp'|'attack'|'defense'|'spAttack'|'spDefense'|'speed', number>
  moves: string[]
  abilities: string[]
}

export interface Item {
  id: string
  name: string
  category: 'medicine'|'pokeball'|'tm'|'berry'|'battle'|'key'|'treasure'|'general'
  price: number
  quantity: number
  icon: string
  description: string
  equipSlot?: 'head'|'body'|'main-hand'|'off-hand'|'feet'|'accessory'
}

export interface Roster {
  id: string
  name: string
  role: string
  accent: string
  maxMembers: number
  creatureIds: string[]
}
