/**
 * Pet auras (save v34) — Rune circle, Fire, Water, Earth, Thunder.
 *
 * Bought per style. A pet wears any combination it owns. Each worn aura has
 * its own colourway: match the equipped sword, or pick one from
 * `data/aura-colours.json`. The art is one drawing per style in two code
 * ramps (grey + green); the colourway swaps the palette on device, so every
 * colourway costs no extra art. Single colours are free. Two-colour sets
 * (main + a different second colour) cost tokens once per colour, like a
 * finish's extra colour. `PLAY_EVERYTHING_FREE` is applied by the store.
 *
 * Old saves: `blaze`/`bubbles`/`spiky` are Fire/Water/Thunder, and the old
 * element / `#hex` colours land on the nearest colourway (`legacyAuraTint`).
 */
import rawAuras from './data/auras.json';
import rawColours from './data/aura-colours.json';
import { swordElement } from '@/play/swords';

export const AURA_STYLES = ['rune', 'fire', 'water', 'earth', 'thunder'] as const;
export type AuraStyle = (typeof AURA_STYLES)[number];

/** Furthest back first. Fire is closest to the body. */
export const AURA_PAINT_ORDER: readonly AuraStyle[] = ['rune', 'water', 'earth', 'thunder', 'fire'];

/** Pre-v34 style ids still found in old saves. */
export const LEGACY_AURA_STYLES: Readonly<Record<string, AuraStyle>> = rawAuras.legacy_styles as Record<string, AuraStyle>;

export type AuraStyleDef = {
  id: AuraStyle;
  name: string;
  frames: number;
  fps: number;
  price: number;
  pass_price: number;
};

export type AuraConfig = {
  currency: string;
  fps: number;
  fallback_element: string;
  quiet_foil: number;
  styles: readonly AuraStyleDef[];
  legacy_styles: Record<string, string>;
};

export type AuraRefusal = 'style' | 'tokens';

export type AuraWear = { style: AuraStyle; color: AuraTint };

export type AuraPlan =
  | { ok: true; cost: number; owned: AuraStyle[]; worn: AuraWear[] }
  | { ok: false; reason: AuraRefusal };

export type Rgb = [number, number, number];

export function auraConfig(): AuraConfig {
  return rawAuras as AuraConfig;
}

export function auraStyles(): readonly AuraStyleDef[] {
  return auraConfig().styles;
}

export function auraStyle(id: string | null | undefined): AuraStyleDef | null {
  if (!id) return null;
  return auraStyles().find((row) => row.id === id) ?? null;
}

export function isAuraStyle(id: unknown): id is AuraStyle {
  return typeof id === 'string' && auraStyle(id) != null;
}

export function auraPrice(id: AuraStyle, pass: boolean): number {
  const row = auraStyle(id);
  if (!row) return 0;
  return pass ? row.pass_price : row.price;
}

export function auraFrameCount(id: AuraStyle): number {
  return auraStyle(id)?.frames ?? 8;
}

/** Playback speed of one style's loop. */
export function auraStyleFps(id: AuraStyle): number {
  return auraStyle(id)?.fps ?? auraConfig().fps;
}

export function auraFps(): number {
  return auraConfig().fps;
}

/** Card-face foil opacity while an aura is worn, so the two don't fight. */
export function quietFoilOpacity(): number {
  return auraConfig().quiet_foil;
}

/* --------------------------------------------------------------- colours --- */

type ColourFile = {
  version: number;
  mix_price: number;
  mix_pass_price: number;
  sword_map: Record<string, string>;
  ramps: Record<string, string[]>;
  natural: Record<string, [string, string]>;
  colourways: { id: string; name: string; group: string; main: string | null; pairs?: Record<string, string> }[];
};

const COLOURS = rawColours as unknown as ColourFile;
const HEX = /^#[0-9A-Fa-f]{6}$/;

export const AURA_COLOUR_IDS = COLOURS.colourways.map((c) => c.id);
export type AuraColourId = 'natural' | 'ember' | 'azure' | 'verdant' | 'violet' | 'gold' | 'chrome' | 'neon' | 'spectrum';

/** `sword` follows the equipped sword. `two:<id>` is the two-colour set of that colourway. */
export type AuraTint = 'sword' | AuraColourId | `two:${AuraColourId}`;

export type AuraColourway = { id: AuraColourId; name: string; group: string };

/** Colourways in picker order, grouped by `group`. */
export function auraColourways(): readonly AuraColourway[] {
  return COLOURS.colourways.map((c) => ({ id: c.id as AuraColourId, name: c.name, group: c.group }));
}

/** The single-colour category: every colourway except Natural (Natural only exists as a pair). */
export function auraSingleColourways(): readonly AuraColourway[] {
  return auraColourways().filter((c) => c.id !== 'natural');
}

export function isAuraColourId(id: unknown): id is AuraColourId {
  return typeof id === 'string' && AURA_COLOUR_IDS.includes(id);
}

export function isAuraTint(id: unknown): id is AuraTint {
  if (id === 'sword') return true;
  if (typeof id !== 'string') return false;
  if (id.startsWith('two:')) return isAuraColourId(id.slice(4));
  return isAuraColourId(id) && id !== 'natural';
}

/** Split a tint into its colourway and whether it is the two-colour set. */
export function auraTintParts(tint: AuraTint): { colour: AuraColourId | 'sword'; two: boolean } {
  if (tint === 'sword') return { colour: 'sword', two: false };
  if (tint.startsWith('two:')) return { colour: tint.slice(4) as AuraColourId, two: true };
  return { colour: tint as AuraColourId, two: false };
}

export function auraTintFor(colour: AuraColourId, two: boolean): AuraTint {
  return two ? (`two:${colour}` as AuraTint) : (colour as AuraTint);
}

/** A two-colour set is the paid category (once per colour). */
export function auraTintIsMix(tint: AuraTint): boolean {
  return auraTintParts(tint).two;
}

export function auraTintLabel(tint: AuraTint): string {
  const { colour, two } = auraTintParts(tint);
  if (colour === 'sword') return 'Sword';
  const name = COLOURS.colourways.find((c) => c.id === colour)?.name ?? colour;
  return two ? `${name} pair` : name;
}

export function auraMixPrice(pass: boolean): number {
  return pass ? COLOURS.mix_pass_price : COLOURS.mix_price;
}

/** The colours a pair tint adds on top of what a pet owns. */
export function parseAuraMixes(raw: unknown): AuraColourId[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isAuraColourId))];
}

function hueOf(hex: string): { h: number; s: number; v: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

const HUE_OF: Record<string, number> = { ember: 20, gold: 48, verdant: 130, azure: 210, violet: 275, neon: 320 };

/**
 * Anything saved before v34 (an element name, a `#RRGGBB`) lands on the nearest
 * single colourway. New tints pass through unchanged.
 */
export function legacyAuraTint(raw: unknown): AuraTint {
  if (isAuraTint(raw)) return raw;
  if (typeof raw !== 'string') return 'sword';
  const byElement = COLOURS.sword_map[raw];
  if (byElement) return byElement as AuraTint;
  if (HEX.test(raw)) {
    const { h, s, v } = hueOf(raw);
    if (s < 0.18) return v > 0.5 ? 'chrome' : 'violet';
    let best = 'ember';
    let bestDist = Infinity;
    for (const [id, hue] of Object.entries(HUE_OF)) {
      const dist = Math.min(Math.abs(h - hue), 360 - Math.abs(h - hue));
      if (dist < bestDist) {
        bestDist = dist;
        best = id;
      }
    }
    return best as AuraTint;
  }
  return 'sword';
}

export function canonAuraTint(color: unknown): AuraTint {
  return legacyAuraTint(color);
}

/** One tint → the two 5-stop ramps (dark → light) a style is painted with. */
export function auraRamps(style: AuraStyle, tint: AuraTint, sword: string | null): { main: string[]; second: string[] } {
  const parts = auraTintParts(tint);
  let colour: string = parts.colour;
  let two = parts.two;
  if (colour === 'sword') {
    const element = sword && swordElement(sword) ? sword : auraConfig().fallback_element;
    colour = COLOURS.sword_map[element] ?? COLOURS.sword_map[auraConfig().fallback_element] ?? 'ember';
    two = false;
  }
  const row = COLOURS.colourways.find((c) => c.id === colour);
  if (!row || colour === 'natural') {
    const [main, second] = COLOURS.natural[style] ?? COLOURS.natural.fire;
    return { main: COLOURS.ramps[main], second: COLOURS.ramps[second] };
  }
  const main = COLOURS.ramps[row.main ?? 'ember'];
  if (!two) return { main, second: main };
  const pair = row.pairs?.[style] ?? row.pairs?.default ?? row.main ?? 'ember';
  return { main, second: COLOURS.ramps[pair] ?? main };
}

/** Kept for callers that want the equipped sword's element or the fallback. */
export function auraElementOf(color: AuraTint, sword: string | null): string {
  if (color !== 'sword') return color;
  return sword && swordElement(sword) ? sword : auraConfig().fallback_element;
}

/* --------------------------------------------------------------- parsing --- */

export function parseAuraStyle(raw: unknown): AuraStyle | 'none' {
  if (typeof raw === 'string' && LEGACY_AURA_STYLES[raw]) return LEGACY_AURA_STYLES[raw];
  return isAuraStyle(raw) ? raw : 'none';
}

export function parseAuraOwned(raw: unknown): AuraStyle[] {
  if (!Array.isArray(raw)) return [];
  const out: AuraStyle[] = [];
  for (const item of raw) {
    const style = parseAuraStyle(item);
    if (style !== 'none' && !out.includes(style)) out.push(style);
  }
  return out;
}

/** v32+ `auras`, or a v31 `aura_style` as one sword-coloured wear. Old styles and colours are migrated. */
export function parseAuraWears(raw: { auras?: unknown; aura_style?: unknown }): AuraWear[] {
  if (Array.isArray(raw.auras)) {
    const out: AuraWear[] = [];
    for (const row of raw.auras) {
      if (!row || typeof row !== 'object') continue;
      const style = parseAuraStyle((row as { style?: unknown }).style);
      const color = (row as { color?: unknown }).color;
      if (style === 'none' || out.some((wear) => wear.style === style)) continue;
      out.push({ style, color: legacyAuraTint(color) });
    }
    return out;
  }
  const legacy = parseAuraStyle(raw.aura_style);
  return legacy === 'none' ? [] : [{ style: legacy, color: 'sword' }];
}

/** Furthest aura first, so Fire paints last and sits against the body. */
export function auraPaintOrder(worn: readonly AuraWear[]): AuraWear[] {
  return [...worn].sort((a, b) => AURA_PAINT_ORDER.indexOf(a.style) - AURA_PAINT_ORDER.indexOf(b.style));
}

/* ----------------------------------------------------------------- plans --- */

/** Turn one owned style on or off. Other worn styles stay. Colour defaults to the sword. */
export function planAuraWear(input: {
  owned: readonly AuraStyle[];
  worn: readonly AuraWear[];
  tokens: number;
  pass: boolean;
  free: boolean;
  style: AuraStyle;
  on: boolean;
}): AuraPlan {
  const owned = [...input.owned];
  const worn = input.worn.filter((wear) => isAuraStyle(wear.style));
  if (!isAuraStyle(input.style)) return { ok: false, reason: 'style' };
  if (!input.on) return { ok: true, cost: 0, owned, worn: worn.filter((wear) => wear.style !== input.style) };
  if (worn.some((wear) => wear.style === input.style)) return { ok: true, cost: 0, owned, worn: [...worn] };
  const have = owned.includes(input.style);
  const cost = input.free || have ? 0 : auraPrice(input.style, input.pass);
  if (input.tokens < cost) return { ok: false, reason: 'tokens' };
  if (!have) owned.push(input.style);
  return { ok: true, cost, owned, worn: [...worn, { style: input.style, color: 'sword' }] };
}

export type AuraColourPlan =
  | { ok: true; cost: number; mixes: AuraColourId[]; tint: AuraTint }
  | { ok: false; reason: 'tint' | 'tokens' };

/** Colour change. Single colours are free; a two-colour set costs once per colour. */
export function planAuraColour(input: {
  tint: unknown;
  mixes: readonly AuraColourId[];
  tokens: number;
  pass: boolean;
  free: boolean;
}): AuraColourPlan {
  if (!isAuraTint(input.tint)) return { ok: false, reason: 'tint' };
  const tint = input.tint;
  const parts = auraTintParts(tint);
  if (!parts.two) return { ok: true, cost: 0, mixes: [...input.mixes], tint };
  const colour = parts.colour as AuraColourId;
  if (input.mixes.includes(colour)) return { ok: true, cost: 0, mixes: [...input.mixes], tint };
  const cost = input.free ? 0 : auraMixPrice(input.pass);
  if (input.tokens < cost) return { ok: false, reason: 'tokens' };
  return { ok: true, cost, mixes: [...input.mixes, colour], tint };
}

export function auraConfigErrors(): string[] {
  const cfg = auraConfig();
  const errors: string[] = [];
  if (cfg.currency !== 'tokens') errors.push('currency');
  if (cfg.fps !== 8) errors.push('fps');
  if (!(cfg.quiet_foil > 0 && cfg.quiet_foil < 0.4)) errors.push('quiet');
  if (!swordElement(cfg.fallback_element)) errors.push('fallback');
  const ids = new Set<string>();
  if (cfg.styles.length !== AURA_STYLES.length) errors.push('styles');
  for (const row of cfg.styles) {
    if (ids.has(row.id)) errors.push(`dup ${row.id}`);
    ids.add(row.id);
    if (!(AURA_STYLES as readonly string[]).includes(row.id)) errors.push(`unknown ${row.id}`);
    if (!row.name.trim()) errors.push(`name ${row.id}`);
    if (row.frames !== 8) errors.push(`frames ${row.id}`);
    if (!(row.fps >= 4 && row.fps <= 12)) errors.push(`fps ${row.id}`);
    if (!(row.price > 0) || !(row.pass_price > 0) || row.pass_price >= row.price) errors.push(`price ${row.id}`);
  }
  const expect: Record<string, [number, number]> = {
    fire: [900, 675],
    thunder: [450, 340],
    rune: [300, 225],
    water: [300, 225],
    earth: [300, 225],
  };
  for (const [id, [price, pass]] of Object.entries(expect)) {
    const row = auraStyle(id);
    if (!row || row.price !== price || row.pass_price !== pass) errors.push(`tune ${id}`);
  }
  for (const banned of ['halo', 'zap', 'smoke', 'blaze', 'spiky', 'bubbles']) {
    if (ids.has(banned)) errors.push(banned);
  }
  for (const [from, to] of Object.entries(cfg.legacy_styles)) {
    if (!isAuraStyle(to) || isAuraStyle(from)) errors.push(`legacy ${from}`);
  }
  if (COLOURS.mix_pass_price >= COLOURS.mix_price) errors.push('mix price');
  for (const [id, ramp] of Object.entries(COLOURS.ramps)) {
    if (ramp.length !== 5 || ramp.some((hex) => !HEX.test(hex))) errors.push(`ramp ${id}`);
  }
  for (const style of AURA_STYLES) {
    const pair = COLOURS.natural[style];
    if (!pair || pair.some((id) => !COLOURS.ramps[id])) errors.push(`natural ${style}`);
  }
  for (const row of COLOURS.colourways) {
    if (row.id === 'natural') continue;
    if (!row.main || !COLOURS.ramps[row.main]) errors.push(`colourway ${row.id}`);
    for (const pair of Object.values(row.pairs ?? {})) if (!COLOURS.ramps[pair]) errors.push(`pair ${row.id}`);
  }
  for (const [element, id] of Object.entries(COLOURS.sword_map)) {
    if (!isAuraColourId(id) || id === 'natural') errors.push(`sword ${element}`);
  }
  return errors;
}
