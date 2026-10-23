/**
 * Pet finishes (save v30, reworked 2026-10-14) — holo and reverse holo, picked, never rolled.
 *
 * Holo is back ON the pet (`PetHolo`): prism bands + a shine sweep + glints.
 * Reverse holo is a foil rim round the pet + the same sweep and glints; the body
 * keeps its own colours. The card only keeps a quiet foil border.
 *
 * Every colour set lives in `data/finishes.json`: prism / rim colours (single
 * colour or mix), shine sweep colours, glint colours. Classic stays the only
 * shiny the egg roll and Shine Stones can produce.
 *
 * Token math (an active day ≈ 80–115 tokens: pet cap plus one Defend clear plus tending):
 *   holo = 450 (about 4–6 days at that pace)
 *   reverse holo = 450
 *   single colours = free
 *   each mix (prism / rim mix, iridescent or neon sweep) = 150 once, a Tide Pass pays 110
 *   Tide Pass prices are explicit in the config (340 / 340 / 110)
 * `PLAY_EVERYTHING_FREE` is applied by the store (cost 0, everything wearable).
 *
 * Saves from before the rework keep working: an old named colour is mapped to the
 * nearest new one (`migrate` in the data file) — a migration, never a wipe.
 */
import rawFinishes from './data/finishes.json';

export const FINISH_KINDS = ['none', 'holo', 'reverse'] as const;
export type FinishKind = (typeof FINISH_KINDS)[number];
export type WornFinishKind = Exclude<FinishKind, 'none'>;

export type FinishGroup = 'Single colour' | 'Mix';

export type FinishColor = {
  id: string;
  name: string;
  group: FinishGroup;
  /** Dark → light, or the order a mix plays in. */
  stops: readonly string[];
  /** The card border's glare. Lightest stop for a single colour, white for a mix. */
  glare: string;
  /** How many times the stop list is laid across the card border band. */
  repeats: number;
  /** Hard stripes vs soft blends (the card border uses soft). */
  hard: boolean;
  pass_only: boolean;
};

export type SweepColour = {
  id: string;
  name: string;
  group: FinishGroup;
  core?: string;
  mid?: string;
  outer?: string;
};

export type GlintColour = { id: string; name: string; core?: string; arm?: string; tip?: string };

export type FinishPaint = {
  /** Foil painted in a quiet border round the card. */
  border_opacity: number;
  glare_opacity: number;
  /** Prism mix toward the band colour: with a sweep (holo) vs alone. */
  prism_strength: number;
  prism_strength_alone: number;
  /** Opacity of the prism band layer laid over the sprite with the overlay blend (Fabric). */
  prism_overlay_opacity: number;
  /** Shine sweep mix: core / mid / outer. */
  sweep_core: number;
  sweep_mid: number;
  sweep_outer: number;
  /** Prism blend where Fabric supports it; else a plain wash at `wash_opacity`. */
  blend: string;
  wash_opacity: number;
};

export type FinishConfig = {
  currency: string;
  earn_per_round: number;
  earn_daily_cap: number;
  active_day_tokens_min: number;
  active_day_tokens_max: number;
  /** Mid active-day budget used to set the kind price (unlock_days × this). */
  active_day_tokens: number;
  unlock_days: number;
  unlock_days_min: number;
  unlock_days_max: number;
  extra_color_share_den: number;
  prices: { holo: number; reverse: number; extra_color: number };
  pass_prices: { holo: number; reverse: number; extra_color: number };
  paint: FinishPaint;
  /** Gyro tilt for the card border glare. Off keeps the slow drift only. */
  tilt: boolean;
  tilt_max_deg: number;
  /** Idle border crawl while the phone is still, or when the gyro reads nothing. */
  drift_ms: number;
  defaults: { prism: string; sweep: string; glint: string };
  migrate: Record<string, string>;
};

export type FinishWallet = {
  holo: boolean;
  reverse: boolean;
  /** Mixes owned: prism ids, and `sweep:<id>` for the mix sweeps. Singles are free. */
  colors: string[];
};

export type FinishMotion = 'off' | 'still' | 'sweep';

export type FinishRefusal = 'kind' | 'color' | 'pass' | 'tokens';

/** A finish being worn: holo or reverse, with its three colours. */
export type PetFinish = { kind: WornFinishKind; color: string; sweep: string; glint: string };

export type FinishPlan =
  | { ok: true; cost: number; wallet: FinishWallet; kind: FinishKind; color: string | null; sweep: string; glint: string }
  | { ok: false; reason: FinishRefusal };

const HEX = /^#[0-9A-Fa-f]{6}$/;

type RawColour = { id: string; group: FinishGroup; name: string; stops: string[] };
type RawFile = {
  prism: RawColour[];
  sweep: (SweepColour & { group: FinishGroup })[];
  glint: GlintColour[];
};

const FILE = rawFinishes as unknown as RawFile;

export function finishConfig(): FinishConfig {
  return rawFinishes as unknown as FinishConfig;
}

const COLORS: readonly FinishColor[] = FILE.prism.map((c) => ({
  id: c.id,
  name: c.name,
  group: c.group,
  stops: c.stops,
  glare: c.group === 'Mix' ? '#FFFFFF' : (c.stops[c.stops.length - 1] ?? '#FFFFFF'),
  repeats: c.stops.length >= 5 ? 1 : 2,
  hard: false,
  pass_only: false,
}));

/** Prism / rim colours, in picker order (single colours first, then mixes). */
export function finishColors(): readonly FinishColor[] {
  return COLORS;
}

export function finishColor(id: string | null | undefined): FinishColor | null {
  if (!id) return null;
  return COLORS.find((c) => c.id === id) ?? null;
}

export function isFinishColor(id: unknown): id is string {
  return typeof id === 'string' && finishColor(id) != null;
}

export function finishSweeps(): readonly SweepColour[] {
  return FILE.sweep;
}

export function finishSweep(id: string | null | undefined): SweepColour | null {
  if (!id) return null;
  return FILE.sweep.find((c) => c.id === id) ?? null;
}

export function finishGlints(): readonly GlintColour[] {
  return FILE.glint;
}

export function finishGlint(id: string | null | undefined): GlintColour | null {
  if (!id) return null;
  return FILE.glint.find((c) => c.id === id) ?? null;
}

/** A colour you buy with tokens: a mix (single colours are free). */
export function isShopFinishColor(id: string): boolean {
  const color = finishColor(id);
  return color != null && color.group === 'Mix';
}

/** Wallet key of a mix sweep. */
export function sweepWalletKey(id: string): string {
  return `sweep:${id}`;
}

/** Old named colours (moonpearl, scarab…) land on the nearest new one. */
export function migrateFinishColor(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  if (isFinishColor(id)) return id;
  const to = finishConfig().migrate[id];
  return to && isFinishColor(to) ? to : null;
}

export function emptyFinishWallet(): FinishWallet {
  return { holo: false, reverse: false, colors: [] };
}

export function parseFinishWallet(raw: unknown): FinishWallet {
  const empty = emptyFinishWallet();
  if (!raw || typeof raw !== 'object') return empty;
  const row = raw as Record<string, unknown>;
  const colors: string[] = [];
  if (Array.isArray(row.colors)) {
    for (const item of row.colors) {
      if (typeof item !== 'string') continue;
      if (item.startsWith('sweep:')) {
        const sweep = finishSweep(item.slice(6));
        if (sweep?.group === 'Mix' && !colors.includes(item)) colors.push(item);
        continue;
      }
      const mapped = migrateFinishColor(item);
      if (mapped && isShopFinishColor(mapped) && !colors.includes(mapped)) colors.push(mapped);
    }
  }
  return { holo: row.holo === true, reverse: row.reverse === true, colors };
}

/** A stored pet finish. Anything unreadable is none (old saves included); old colours are migrated. */
export function parsePetFinish(raw: Record<string, unknown>): {
  finish_kind: FinishKind;
  finish_color: string | null;
  finish_sweep: string;
  finish_glint: string;
} {
  const cfg = finishConfig();
  const kind = raw.finish_kind === 'holo' || raw.finish_kind === 'reverse' ? raw.finish_kind : 'none';
  const color = migrateFinishColor(raw.finish_color);
  const sweep = typeof raw.finish_sweep === 'string' && finishSweep(raw.finish_sweep) ? raw.finish_sweep : cfg.defaults.sweep;
  const glint = typeof raw.finish_glint === 'string' && finishGlint(raw.finish_glint) ? raw.finish_glint : cfg.defaults.glint;
  if (kind === 'none' || color == null) return { finish_kind: 'none', finish_color: null, finish_sweep: sweep, finish_glint: glint };
  return { finish_kind: kind, finish_color: color, finish_sweep: sweep, finish_glint: glint };
}

/** A pet's worn finish as one value (null when none). */
export function petFinishOf(pet: {
  finish_kind: FinishKind;
  finish_color: string | null;
  finish_sweep?: string;
  finish_glint?: string;
}): PetFinish | null {
  if (pet.finish_kind === 'none' || !pet.finish_color) return null;
  const cfg = finishConfig();
  return {
    kind: pet.finish_kind,
    color: pet.finish_color,
    sweep: pet.finish_sweep ?? cfg.defaults.sweep,
    glint: pet.finish_glint ?? cfg.defaults.glint,
  };
}

export function finishWornLabel(kind: string | null | undefined, color: string | null | undefined): string | null {
  if ((kind !== 'holo' && kind !== 'reverse') || !color) return null;
  const name = finishColor(color)?.name;
  if (!name) return null;
  return kind === 'reverse' ? `Reverse holo ${name}` : `Holo ${name}`;
}

/** Token price; with a Tide Pass the config's `pass_prices` row is used. */
export function finishPrice(what: 'holo' | 'reverse' | 'extra_color', pass: boolean): number {
  const cfg = finishConfig();
  return pass ? cfg.pass_prices[what] : cfg.prices[what];
}

/** Quiet foil border opacity on the card. */
export function borderOpacity(): number {
  return finishConfig().paint.border_opacity;
}

export function glareOpacity(): number {
  return finishConfig().paint.glare_opacity;
}

/** Map a gyro delta (radians) into −1..1, clamped to `maxDeg`. */
export function clampTilt(deltaRad: number, maxDeg: number): number {
  const max = (maxDeg * Math.PI) / 180;
  if (!(max > 0)) return 0;
  const clamped = Math.min(max, Math.max(-max, deltaRad));
  return clamped / max;
}

function hexRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix two #RRGGBB colours. `t` is the weight of `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = hexRgb(a);
  const pb = hexRgb(b);
  const ch = (i: number) => Math.round(pa[i] + (pb[i] - pa[i]) * t);
  return `#${[0, 1, 2].map((i) => ch(i).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Dark gap between foil bands, tinted by the palette so each colour stays its own. */
export function foilGap(stops: readonly string[]): string {
  return mixHex('#070B14', stops[0] ?? '#070B14', 0.3);
}

/** Band pitch in the foil's 100-unit space. */
export function foilBandPitch(color: { hard: boolean; repeats: number }): number {
  if (color.hard) return 11;
  return Math.max(22, 42 - (Math.max(1, color.repeats) - 1) * 7);
}

export function foilAngle(color: { hard: boolean }): number {
  return color.hard ? 72 : 112;
}

export type FoilStripe = { x: number; w: number; color: string };

/** Saturated bands with a dark gap, wide enough to slide without showing an edge. */
export function foilStripes(color: FinishColor): FoilStripe[] {
  const pitch = foilBandPitch(color);
  const band = pitch * (color.hard ? 0.5 : 0.62);
  const stripes: FoilStripe[] = [];
  let x = -36;
  let i = 0;
  while (x < 170) {
    stripes.push({ x, w: band, color: color.stops[i % color.stops.length] ?? '#FFFFFF' });
    x += pitch;
    i += 1;
  }
  return stripes;
}

export type FoilSparkle = { x: number; y: number; r: number; o: number };

/** Stable glitter for one colour. Same id, same dots. */
export function foilSparkles(id: string, count = 28): FoilSparkle[] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h >>> 0) % 10000) / 10000;
  };
  return Array.from({ length: count }, () => ({
    x: rand() * 100,
    y: rand() * 100,
    r: 0.35 + rand() * 0.85,
    o: 0.3 + rand() * 0.5,
  }));
}

/**
 * The card border foil sweeps only on a surface that asked for it, and only
 * while in-game Motion is not Off and Effects are Full. (The holo on the pet
 * itself never stops: Reduce Motion plays its gentle loop.)
 */
export function finishSweepRuns(input: {
  motion: FinishMotion;
  reduceMotion: boolean;
  osReduceMotion: boolean;
  fxFull: boolean;
}): boolean {
  void input.osReduceMotion;
  return input.motion === 'sweep' && !input.reduceMotion && input.fxFull;
}

export type GradientStop = { offset: number; color: string };

/** Lay the colour list across 0..1. Hard stripes duplicate each edge so the join is instant. */
export function bandStops(colors: readonly string[], repeats: number, hard: boolean): GradientStop[] {
  const times = Math.max(1, Math.floor(repeats));
  const n = colors.length * times;
  if (!hard) {
    if (n <= 1) return [{ offset: 0, color: colors[0] ?? '#FFFFFF' }];
    return Array.from({ length: n }, (_, i) => ({
      offset: i / (n - 1),
      color: colors[i % colors.length],
    }));
  }
  const eps = 0.0008;
  const stops: GradientStop[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = i / n;
    const b = (i + 1) / n;
    const color = colors[i % colors.length];
    stops.push({ offset: i === 0 ? 0 : Math.min(1, a + eps), color });
    stops.push({ offset: i === n - 1 ? 1 : b, color });
  }
  return stops;
}

export function stopsFor(color: FinishColor): GradientStop[] {
  return bandStops(color.stops, color.repeats, color.hard);
}

/** The mixes a finish uses that are not in the wallet yet (prism / rim mix, mix sweep). */
export function unownedMixes(wallet: FinishWallet, color: FinishColor, sweep: SweepColour): string[] {
  const out: string[] = [];
  if (color.group === 'Mix' && !wallet.colors.includes(color.id)) out.push(color.id);
  const key = sweepWalletKey(sweep.id);
  if (sweep.group === 'Mix' && !wallet.colors.includes(key)) out.push(key);
  return out;
}

/**
 * What wearing `kind` + `color` (+ sweep, glint) costs and which unlocks it grants.
 * Unlocking a kind is 450 (340 with a Tide Pass); each new mix is 150 (110). Single
 * colours, sweeps and glints are free.
 */
export function planFinishWear(input: {
  wallet: FinishWallet;
  tokens: number;
  pass: boolean;
  free: boolean;
  kind: FinishKind;
  color: string | null;
  sweep?: string | null;
  glint?: string | null;
}): FinishPlan {
  const wallet = input.wallet;
  const defaults = finishConfig().defaults;
  const sweepId = input.sweep ?? defaults.sweep;
  const glintId = input.glint ?? defaults.glint;
  if (input.kind === 'none') {
    return { ok: true, cost: 0, wallet, kind: 'none', color: null, sweep: sweepId, glint: glintId };
  }
  if (input.kind !== 'holo' && input.kind !== 'reverse') return { ok: false, reason: 'kind' };
  const color = finishColor(input.color);
  const sweep = finishSweep(sweepId);
  const glint = finishGlint(glintId);
  if (!color || !sweep || !glint) return { ok: false, reason: 'color' };

  const ownsKind = input.kind === 'holo' ? wallet.holo : wallet.reverse;
  const fresh = unownedMixes(wallet, color, sweep);
  let cost = 0;
  if (!input.free) {
    if (!ownsKind) cost += finishPrice(input.kind, input.pass);
    cost += fresh.length * finishPrice('extra_color', input.pass);
  }
  if (input.tokens < cost) return { ok: false, reason: 'tokens' };

  return {
    ok: true,
    cost,
    wallet: {
      holo: wallet.holo || input.kind === 'holo',
      reverse: wallet.reverse || input.kind === 'reverse',
      colors: [...wallet.colors, ...fresh],
    },
    kind: input.kind,
    color: color.id,
    sweep: sweep.id,
    glint: glint.id,
  };
}

/** Config shape the offline check re-validates. Exported so a bad file fails in one place. */
export function finishConfigErrors(): string[] {
  const cfg = finishConfig();
  const errors: string[] = [];
  if (cfg.currency !== 'tokens') errors.push('currency');
  const ids = new Set<string>();
  if (FILE.prism.length < 8) errors.push('colors');
  for (const color of FILE.prism) {
    if (ids.has(color.id)) errors.push(`dup ${color.id}`);
    ids.add(color.id);
    if (!color.name.trim()) errors.push(`name ${color.id}`);
    if (color.group !== 'Single colour' && color.group !== 'Mix') errors.push(`group ${color.id}`);
    if (color.group === 'Single colour' && color.stops.length !== 4) errors.push(`single stops ${color.id}`);
    if (color.group === 'Mix' && color.stops.length < 3) errors.push(`mix stops ${color.id}`);
    if (color.stops.some((stop) => !HEX.test(stop))) errors.push(`stops ${color.id}`);
  }
  const sweepIds = new Set<string>();
  for (const sweep of FILE.sweep) {
    if (sweepIds.has(sweep.id)) errors.push(`dup sweep ${sweep.id}`);
    sweepIds.add(sweep.id);
    for (const hex of [sweep.core, sweep.mid, sweep.outer]) {
      if (hex != null && !HEX.test(hex)) errors.push(`sweep hex ${sweep.id}`);
    }
    const fixed = sweep.core != null;
    const derived = sweep.id === 'match' || sweep.id === 'iris';
    if (!fixed && !derived) errors.push(`sweep colours ${sweep.id}`);
  }
  const glintIds = new Set<string>();
  for (const glint of FILE.glint) {
    if (glintIds.has(glint.id)) errors.push(`dup glint ${glint.id}`);
    glintIds.add(glint.id);
    for (const hex of [glint.core, glint.arm, glint.tip]) {
      if (hex != null && !HEX.test(hex)) errors.push(`glint hex ${glint.id}`);
    }
    if (glint.id !== 'match' && (!glint.core || !glint.arm || !glint.tip)) errors.push(`glint colours ${glint.id}`);
  }
  for (const [from, to] of Object.entries(cfg.migrate)) {
    if (!isFinishColor(to) || isFinishColor(from)) errors.push(`migrate ${from}`);
  }
  if (!isFinishColor(cfg.defaults.prism) || !finishSweep(cfg.defaults.sweep) || !finishGlint(cfg.defaults.glint)) {
    errors.push('defaults');
  }
  const paint = cfg.paint;
  if (!(paint.border_opacity > 0 && paint.border_opacity <= 0.8)) errors.push('border opacity');
  if (paint.glare_opacity < 0.5 || paint.glare_opacity > 0.6) errors.push('glare');
  if (!(paint.prism_strength > 0 && paint.prism_strength < paint.prism_strength_alone)) errors.push('prism strength');
  if (!(paint.sweep_core > paint.sweep_mid && paint.sweep_mid > paint.sweep_outer && paint.sweep_outer > 0)) {
    errors.push('sweep mix');
  }
  if (!(paint.prism_overlay_opacity > 0.3 && paint.prism_overlay_opacity <= 1)) errors.push('prism overlay');
  if (paint.blend !== 'overlay') errors.push('blend');
  if (paint.wash_opacity <= 0 || paint.wash_opacity > 0.2) errors.push('wash');
  if (cfg.tilt !== true && cfg.tilt !== false) errors.push('tilt');
  if (cfg.tilt_max_deg !== 15) errors.push('tilt degrees');
  if (cfg.drift_ms < 8000 || cfg.drift_ms > 20000) errors.push('drift');
  if (cfg.prices.reverse !== cfg.prices.holo) errors.push('reverse price');
  if (cfg.unlock_days < cfg.unlock_days_min || cfg.unlock_days > cfg.unlock_days_max) errors.push('days');
  if (cfg.prices.extra_color * cfg.extra_color_share_den !== cfg.prices.holo) errors.push('extra color');
  if (cfg.active_day_tokens < cfg.active_day_tokens_min || cfg.active_day_tokens > cfg.active_day_tokens_max) {
    errors.push('active day');
  }
  if (cfg.prices.holo !== cfg.unlock_days * cfg.active_day_tokens) errors.push('holo price');
  const dayLo = cfg.unlock_days_min * cfg.active_day_tokens_min;
  const dayHi = cfg.unlock_days_max * cfg.active_day_tokens_max;
  if (cfg.prices.holo < dayLo || cfg.prices.holo > dayHi) errors.push('holo vs active day');
  if (cfg.pass_prices.holo !== cfg.pass_prices.reverse) errors.push('pass holo/reverse');
  if (cfg.pass_prices.extra_color >= cfg.pass_prices.holo) errors.push('pass extra');
  return errors;
}
