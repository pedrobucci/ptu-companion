const capabilityId = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function splitTerrainValue(value) {
  if (Array.isArray(value)) return value.flatMap(splitTerrainValue);
  if (value == null) return [];
  if (typeof value === 'object') {
    if ('name' in value) return splitTerrainValue(value.name);
    if ('terrain' in value) return splitTerrainValue(value.terrain);
    return [];
  }
  return String(value)
    .split(/[,;|/]/)
    .map(part => part.trim())
    .filter(Boolean);
}

function terrainsFromNaturewalkName(name) {
  const text = String(name || '').trim();
  const match = text.match(/^naturewalk\s*(?:\[([^\]]+)\]|\(([^)]+)\))$/i);
  return match ? splitTerrainValue(match[1] || match[2]) : [];
}

export function isNaturewalkCapability(capability) {
  if (!capability) return false;
  if (typeof capability === 'string') return /^naturewalk(?:\s|\[|\(|$)/i.test(capability.trim());
  const id = capabilityId(capability.capability_id || capability.id);
  return id === 'naturewalk' || /^naturewalk(?:\s|\[|\(|$)/i.test(String(capability.name || '').trim());
}

export function normalizeNaturewalkTerrains(capability) {
  if (!isNaturewalkCapability(capability)) return [];
  const raw = typeof capability === 'string'
    ? terrainsFromNaturewalkName(capability)
    : capability.terrains ?? capability.terrain ?? terrainsFromNaturewalkName(capability.name);
  const seen = new Set();
  const result = [];
  for (const terrain of splitTerrainValue(raw)) {
    const key = terrain.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(terrain);
  }
  return result;
}

export function normalizeCapability(capability) {
  if (!isNaturewalkCapability(capability)) {
    return capability && typeof capability === 'object' ? {...capability} : capability;
  }
  const terrains = normalizeNaturewalkTerrains(capability);
  const source = capability && typeof capability === 'object' ? capability : {};
  return {
    ...source,
    name: 'Naturewalk',
    kind: source.kind || 'special',
    capability_id: source.capability_id || 'naturewalk',
    terrain: terrains,
    terrains
  };
}

export function normalizeCapabilities(capabilities) {
  return (Array.isArray(capabilities) ? capabilities : []).map(normalizeCapability);
}

export function formatCapabilityLabel(capability) {
  if (!capability) return '—';
  const normalized = normalizeCapability(capability);
  if (typeof normalized === 'string') return normalized;
  if (normalized.kind === 'jump') return `${normalized.name || 'Jump'} ${normalized.high ?? '?'}/${normalized.long ?? '?'}`;
  if (isNaturewalkCapability(normalized)) {
    const terrains = normalizeNaturewalkTerrains(normalized);
    return terrains.length ? `Naturewalk [${terrains.join(', ')}]` : 'Naturewalk';
  }
  return `${normalized.name || normalized.capability_id || 'Capability'}${normalized.value != null ? ` ${normalized.value}` : ''}`;
}
