const coreDecisions = {
  'moves:focus-punch': {
    id: 'GM_DECISION_92',
    effect: 'Declare Focus Punch as a Priority (Limited) action at the start of the round. At the end of the round, the user may Shift and use Focus Punch unless a single attack dealt damage to the user equal to at least 25% of their maximum HP. If interrupted, Focus Punch does not expend its frequency.',
  },
  'moves:mind-reader': {
    id: 'GM_DECISION_93',
    effect: "The target is Read until the end of the user's next turn. The user may consume Read to automatically hit the read target with an attack, or to make an attack by the read target against the user automatically miss. With Telepathy, the user automatically succeeds at mind reading against the read target and can listen to its surface thoughts while it remains Read. Mind Reader automatically misses against targets with Mindlock.",
  },
  'moves:roar': {
    id: 'GM_DECISION_94',
    effect: 'On declaring Roar, the user does nothing and cannot Shift. At the end of the round, the user Shifts and uses Roar. Targets hit immediately Shift away from the user with their highest usable movement capability, toward their Trainer if possible. An owned Pokémon that ends this Shift within 6 meters of its Poké Ball is immediately recalled. Its Trainer may send out a replacement without losing their Pokémon turn.',
  },
  'moves:spider-web': {
    id: 'GM_DECISION_95',
    effect: 'Spider Web cannot miss. The target is Stuck and Trapped. When the target loses Stuck, it also loses the Trapped condition from this Spider Web.',
  },
  'items:luxury-ball': {
    id: 'GM_DECISION_97',
    effect: 'Capture modifier −5. The caught Pokémon starts with higher happiness as a narrative effect. The GM sets its starting Loyalty using the usual rules.',
    raw: {capture_modifier: -5},
  },
};

const februaryMummy = {
  id: 'GM_DECISION_96',
  effect: 'Disable one of the attacker’s Abilities for the rest of the Scene or until the attacker switches out.',
};

// Core pp. 351, 366, 368, 386, 397, 405, 406, 409. A variable DB
// was extracted together with AC, or the move header lacked structured fields.
const coreMoveFields = {
  fling: {ac: 2},
  frustration: {ac: 2},
  magnitude: {ac: 2},
  'mat-block': {category: 'Status'},
  return: {ac: 2},
  round: {ac: 2},
  'spit-up': {ac: 2},
  'triple-kick': {ac: 3},
};

// PTU 1.05 Editation p. 63 supersedes these fields when enabled.
const editationCoreMoves = {
  aeroblast: {frequency: 'Scene'},
  astonish: {damageBase: 6},
  judgment: {frequency: 'Scene'},
  'luster-purge': {frequency: 'EOT'},
  'mist-ball': {frequency: 'EOT'},
  'mystical-fire': {damageBase: 8},
  rage: {damageBase: 6},
  'seed-flare': {range: '6, Ranged Blast 3, Smite, Spirit Surge'},
  'shock-wave': {frequency: 'EOT'},
  'spacial-rend': {frequency: 'Scene x2'},
  spark: {damageBase: 7},
  'stored-power': {frequency: 'Scene x2'},
};

const editationSuMoMoves = {
  'leech-life': {frequency: 'EOT'},
  'power-trip': {frequency: 'Scene x2'},
  'thunder-wave': {ac: 2},
};

export function normalizeLote241Definition(definition, {editationEnabled = false} = {}) {
  const {kind, id, contentPackId, sourceId} = definition;
  let decision;
  let fields;
  if (contentPackId === 'ptu-core-1.05' && sourceId === 'core') {
    decision = coreDecisions[`${kind}:${id}`];
    if (kind === 'moves') {
      fields = coreMoveFields[id];
      if (editationEnabled && !definition.pinned) fields = editationCoreMoves[id] ?? fields;
    }
  } else if (kind === 'abilities' && id === 'mummy' &&
      contentPackId === 'ptu-february-2016-playtest' && sourceId === 'feb2016') {
    decision = februaryMummy;
  } else if (kind === 'moves' && contentPackId === 'ptu-sumo-references' &&
      sourceId === 'sumo' && editationEnabled && !definition.pinned) {
    fields = editationSuMoMoves[id];
  } else if (kind === 'moves' && id === 'steam-eruption' &&
      contentPackId === 'ptu-1.05-editation' && sourceId === 'edit') {
    fields = {ac: 3, damageBase: 11};
  }
  if (!decision && !fields) return definition;
  const out = {...definition, ...fields};
  if (decision) Object.assign(out, {effect: decision.effect, catalogDecision: decision.id});
  if (!definition.raw) return out;
  out.raw = {...definition.raw};
  if (decision) {
    Object.assign(out.raw, decision.raw, {effect_text: decision.effect});
    if (Array.isArray(out.raw.effect_parts)) {
      out.raw.effect_parts = out.raw.effect_parts.map(part => part.kind === 'effect' ? {...part, text: decision.effect} : part);
    }
  }
  if (fields?.ac != null) Object.assign(out.raw, {ac: fields.ac, ac_text: String(fields.ac)});
  if (fields?.category) out.raw.class = fields.category;
  if (fields?.damageBase != null) {
    out.raw.damage_base = fields.damageBase;
    // DB rendering resolves the dice from the table. Clear stale printed dice.
    out.raw.damage_dice = null;
    out.raw.damage_set = null;
  }
  if (fields?.range) out.raw.range_text = fields.range;
  if (fields?.frequency) {
    const isEot = fields.frequency === 'EOT';
    out.raw.frequency_text = fields.frequency;
    out.raw.frequency = {...out.raw.frequency, raw: fields.frequency, scope: isEot ? 'eot' : 'scene', uses: isEot ? null : fields.frequency === 'Scene' ? 1 : 2};
  }
  return out;
}
