const SLOT_ALIASES={
  head:'head',body:'body',main_hand:'mainHand',mainhand:'mainHand',mainHand:'mainHand',
  off_hand:'offHand',offhand:'offHand',offHand:'offHand',feet:'feet',foot:'feet',accessory:'accessory'
};

// PTU Core item extraction stores Trainer/Pokémon usability reliably, but several
// wearable/tool items do not explicitly carry their Equipment Slot in the parsed
// definition. These overrides fill only deterministic slot metadata; they do not
// invent automatic mechanical effects.
const TRAINER_EQUIPMENT_OVERRIDES={
  'dark-vision-goggles':{slots:['head']},
  'fancy-clothes':{slots:['body']},
  'flippers':{slots:['feet']},
  'gas-mask':{slots:['head']},
  'heavy-armor':{slots:['body']},
  'helmet':{slots:['head']},
  'jungle-boots':{slots:['feet']},
  'light-armor':{slots:['body']},
  'mega-ring':{slots:['accessory']},
  're-breather':{slots:['head']},
  'running-shoes':{slots:['feet']},
  'snow-boots':{slots:['feet']},
  'stealth-clothes':{slots:['body']},
  'sunglasses':{slots:['head']},

  // Focus is usually an Accessory, but Core explicitly allows it to be crafted
  // as Head, Hand, or Off-Hand equipment too.
  'focus':{slots:['accessory','head','mainHand','offHand']},

  // Core describes these as two-handed pieces of equipment.
  'fishing-rod':{slots:['mainHand'],hands:2},
  'old-rod':{slots:['mainHand'],hands:2},
  'good-rod':{slots:['mainHand'],hands:2},
  'super-rod':{slots:['mainHand'],hands:2},
  'glue-cannon':{slots:['mainHand'],hands:2},
  'hand-net':{slots:['mainHand'],hands:2},
  'hand-net-50-hp':{slots:['mainHand'],hands:2},
  'hand-net-100-hp':{slots:['mainHand'],hands:2},
  'hand-net-200-hp':{slots:['mainHand'],hands:2},
  'weighted-nets':{slots:['mainHand'],hands:2},
  'weighted-net-50-hp':{slots:['mainHand'],hands:2},
  'weighted-net-80-hp':{slots:['mainHand'],hands:2},
  'weighted-net-150-hp':{slots:['mainHand'],hands:2},

  // Trainer-compatible Held Items. Most are already tagged by the parser; these
  // explicit entries make the desktop catalog resilient to older/legacy saves.
  'expert-belt':{slots:['accessory']},
  'flame-orb':{slots:['offHand']},
  'focus-band':{slots:['accessory']},
  'focus-sash':{slots:['accessory']},
  'go-goggles':{slots:['head']},
  'iron-ball':{slots:['mainHand','offHand']},
  'kings-rock':{slots:['head']}
};

export function normalizeEquipmentSlot(slot){
  if(slot==null)return null;
  const key=String(slot).trim();
  return SLOT_ALIASES[key]||SLOT_ALIASES[key.toLowerCase()]||null;
}

export function itemUsageMetadata(definition){
  const raw=definition?.raw||{};
  const id=String(definition?.id||raw.id||'');
  const override=TRAINER_EQUIPMENT_OVERRIDES[id]||null;
  const parsedSlots=Array.isArray(raw.equipment_slots)?raw.equipment_slots.map(normalizeEquipmentSlot).filter(Boolean):[];
  const overrideSlots=(override?.slots||[]).map(normalizeEquipmentSlot).filter(Boolean);
  const slots=[...new Set(overrideSlots.length?overrideSlots:parsedSlots)];
  const trainerUsable=override?true:raw.trainer_usable===true;
  const pokemonHeldUsable=raw.pokemon_held_usable===true;
  const hands=Number(override?.hands||0)||null;
  // Content Packs may define full deterministic equipment/weapon mechanics.
  // Preserve this payload when turning a catalog Item into a Backpack item so
  // imported weapons follow exactly the same runtime path as built-in weapons.
  const rawMechanics=raw.mechanics&&typeof raw.mechanics==='object'?{...raw.mechanics}:null;
  if(rawMechanics && !rawMechanics.kind && rawMechanics.weaponClass) rawMechanics.kind='weapon';
  if(rawMechanics && !rawMechanics.hands && hands) rawMechanics.hands=hands;
  const mechanics=rawMechanics || (hands?{kind:'equipment',hands}:null);
  return {
    trainerUsable,
    pokemonHeldUsable,
    equipmentSlots:slots,
    equipSlot:slots[0]||null,
    mechanics
  };
}

export function equipmentSlotLabel(slot){
  return ({head:'Head',body:'Body',mainHand:'Main Hand',offHand:'Off Hand',feet:'Feet',accessory:'Accessory'})[normalizeEquipmentSlot(slot)]||String(slot||'');
}

export {TRAINER_EQUIPMENT_OVERRIDES};
