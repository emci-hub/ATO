/** PixelLab / ATO direction name normalisation. Raw exports stay untouched; packed JSON uses n/ne/e/…. */

export const LONG_DIRS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const;

export const SHORT_DIRS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;

export const LONG_TO_SHORT: Record<string, (typeof SHORT_DIRS)[number]> = {
  north: 'n',
  'north-east': 'ne',
  northeast: 'ne',
  east: 'e',
  'south-east': 'se',
  southeast: 'se',
  south: 's',
  'south-west': 'sw',
  southwest: 'sw',
  west: 'w',
  'north-west': 'nw',
  northwest: 'nw',
  n: 'n',
  ne: 'ne',
  e: 'e',
  se: 'se',
  s: 's',
  sw: 'sw',
  w: 'w',
  nw: 'nw',
};

export const SHORT_TO_LONG: Record<string, (typeof LONG_DIRS)[number]> = {
  n: 'north',
  ne: 'north-east',
  e: 'east',
  se: 'south-east',
  s: 'south',
  sw: 'south-west',
  w: 'west',
  nw: 'north-west',
};

export const HASH_SUFFIX = /-[0-9a-f]{8}$/;
export const HASH_ANY = /-[0-9a-f]{8}(?=\/|$)/g;

export function stripHash(name: string): string {
  return name.replace(HASH_SUFFIX, '');
}

export function toShortDir(name: string): string {
  const n = stripHash(name).toLowerCase();
  return LONG_TO_SHORT[n] ?? n;
}

export function toLongDir(name: string): string {
  const n = stripHash(name).toLowerCase();
  return SHORT_TO_LONG[n] ?? n;
}

export function byCompassLong(a: string, b: string): number {
  const ia = LONG_DIRS.indexOf(stripHash(a) as (typeof LONG_DIRS)[number]);
  const ib = LONG_DIRS.indexOf(stripHash(b) as (typeof LONG_DIRS)[number]);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

/** Packed JSON frame key: `<clip>/<dir>/<NNN>` with short dirs. */
export function atlasFrameKey(clip: string, dir: string, frame: number): string {
  return `${clip}/${toShortDir(dir)}/${String(frame).padStart(3, '0')}`;
}

/** Legacy PLAY_SHEETS frame key: `<longDir>/frame_NNN` (rotations: just the facing). */
export function legacyFrameKey(dir: string, frame: number | null): string {
  const long = toLongDir(dir);
  if (frame == null) return long;
  return `${long}/frame_${String(frame).padStart(3, '0')}`;
}

export function kebab(s: string): string {
  return s
    .replace(/['’]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export const SW_WALK_ORDER = ['north', 'east', 'south', 'west'] as const;
export const SW_DIRS = ['east', 'west'] as const;

export const CORE_CLIP_NAMES = new Set(
  ['idle', 'walk', 'rotations', 'breathing_idle', 'hover_idle', 'walking', 'divine_flight'].map((s) =>
    s.toLowerCase(),
  ),
);

export function isCoreClip(action: string): boolean {
  const n = action.toLowerCase();
  if (n === 'rotations') return true;
  if (CORE_CLIP_NAMES.has(n)) return true;
  if (n.includes('idle') || n.includes('walk') || n.includes('hover') || n.includes('breathing')) return true;
  return false;
}

export const DEFAULT_MS: Record<string, number> = {
  walk: 100,
  idle: 150,
  rotations: 150,
};

export function clipMs(action: string): number {
  const n = action.toLowerCase();
  if (n.includes('walk') || n.includes('run') || n.includes('flight')) return 100;
  if (n.includes('idle') || n.includes('hover') || n.includes('breath')) return 150;
  return 100;
}
