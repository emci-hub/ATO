/**
 * Pet finishes (save v30) — holo and reverse holo, picked, never rolled.
 *
 * Every name, stop, glare, opacity and price lives in `data/finishes.json`.
 * Classic stays the only shiny the egg roll and Shine Stones can produce.
 * A Tide Pass discounts the token prices and is the only way to wear Starpearl.
 * `PLAY_EVERYTHING_FREE` is applied by the store (cost 0, everything wearable).
 *
 * Token math (an active day ≈ 80–115 tokens: pet cap plus one Defend clear plus tending):
 *   holo = 450 (about 4–6 days at that pace; includes one shop colour)
 *   reverse holo = 450
 *   each extra named colour = 150 (a third of a kind unlock)
 *   Tide Pass prices are explicit in the config (340 / 340 / 110)
 * The first colour you do not already own is included in a kind's unlock.
 */
import rawFinishes from './data/finishes.json';

export const FINISH_KINDS = ['none', 'holo', 'reverse'] as const;
export type FinishKind = (typeof FINISH_KINDS)[number];
export type WornFinishKind = Exclude<FinishKind, 'none'>;

export type FinishColor = {
  id: string;
  name: string;
  stops: readonly string[];
  glare: string;
  /** How many times the stop list is laid across the band. */
  repeats: number;
  /** Hard stripes (Quicksilver) vs soft blends (Moonpearl). */
  hard: boolean;
  pass_only: boolean;
};

export type FinishPaint = {
  /** Foil painted in the art window (holo) or across the card face (reverse). */
  window_opacity: number;
  reverse_opacity: number;
  /** Light sheen on the sprite itself. Overlay, never dodge. */
  sheen_opacity: number;
  sheen_opacity_on_shiny: number;
  /** Plain wash when Fabric blend modes are unavailable. */
  sheen_wash_opacity: number;
  glare_opacity: number;
  sheen_blend: string;
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
  /** Gyro tilt for the glare and the bands. Off keeps the slow drift only. */
  tilt: boolean;
  /** Clamp for the tilt effect, degrees. The bands shift; they do not flip. */
  tilt_max_deg: number;
  /** Idle band crawl while the phone is still, or when the gyro reads nothing. */
  drift_ms: number;
  colors: readonly FinishColor[];
};

export type FinishWallet = {
  holo: boolean;
  reverse: boolean;
  /** Shop colours owned. Starpearl is never stored here. */
  colors: string[];
};

export type FinishMotion = 'off' | 'still' | 'sweep';

export type FinishRefusal = 'kind' | 'color' | 'pass' | 'tokens';

export type FinishPlan =
  | { ok: true; cost: number; wallet: FinishWallet; kind: FinishKind; color: string | null }
  | { ok: false; reason: FinishRefusal };

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function finishConfig(): FinishConfig {
  return rawFinishes as FinishConfig;
}

export function finishColors(): readonly FinishColor[] {
  return finishConfig().colors;
}

export function finishColor(id: string | null | undefined): FinishColor | null {
  if (!id) return null;
  return finishColors().find((c) => c.id === id) ?? null;
}

export function isFinishColor(id: unknown): id is string {
  return typeof id === 'string' && finishColor(id) != null;
}

/** A colour you buy with tokens (not the Tide Pass exclusive). */
export function isShopFinishColor(id: string): boolean {
  const color = finishColor(id);
  return color != null && !color.pass_only;
}

export function emptyFinishWallet(): FinishWallet {
  return { holo: false, reverse: false, colors: [] };
}

export function parseFinishWallet(raw: unknown): FinishWallet {
  const empty = emptyFinishWallet();
  if (!raw || typeof raw !== 'object') return empty;
  const row = raw as Record<string, unknown>;
  const colors = Array.isArray(row.colors)
    ? [...new Set(row.colors.filter((id): id is string => typeof id === 'string' && isShopFinishColor(id)))]
    : [];
  return { holo: row.holo === true, reverse: row.reverse === true, colors };
}

/** A stored pet finish. Anything unreadable is none (old saves included). */
export function parsePetFinish(raw: Record<string, unknown>): { finish_kind: FinishKind; finish_color: string | null } {
  const kind = raw.finish_kind === 'holo' || raw.finish_kind === 'reverse' ? raw.finish_kind : 'none';
  const color = typeof raw.finish_color === 'string' && isFinishColor(raw.finish_color) ? raw.finish_color : null;
  if (kind === 'none' || color == null) return { finish_kind: 'none', finish_color: null };
  return { finish_kind: kind, finish_color: color };
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

/** Sheen laid on the sprite. A shiny stays inside the 30–35% cap. */
export function sheenOpacity(onShiny: boolean, blend: boolean): number {
  const paint = finishConfig().paint;
  if (!blend) return paint.sheen_wash_opacity;
  if (onShiny) return paint.sheen_opacity_on_shiny;
  return paint.sheen_opacity;
}

export function glareOpacity(): number {
  return finishConfig().paint.glare_opacity;
}

export function reverseOpacity(): number {
  return finishConfig().paint.reverse_opacity;
}

export function windowOpacity(): number {
  return finishConfig().paint.window_opacity;
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

/** Band pitch in the foil's 100-unit space. Hard (Quicksilver) is narrower. */
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
 * The sweep runs only on a surface that asked for it, and only while neither
 * Reduce Motion (the Play override or the OS) nor Low effects is on.
 */
export function finishSweepRuns(input: {
  motion: FinishMotion;
  reduceMotion: boolean;
  osReduceMotion: boolean;
  fxFull: boolean;
}): boolean {
  return input.motion === 'sweep' && !input.reduceMotion && !input.osReduceMotion && input.fxFull;
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

/**
 * What wearing `kind` + `color` costs and which unlocks it grants.
 * Starpearl needs a Tide Pass (or the free flag) and is not added to the wallet.
 * Unlocking a kind includes one shop colour you do not already own.
 */
export function planFinishWear(input: {
  wallet: FinishWallet;
  tokens: number;
  pass: boolean;
  free: boolean;
  kind: FinishKind;
  color: string | null;
}): FinishPlan {
  const wallet = input.wallet;
  if (input.kind === 'none') return { ok: true, cost: 0, wallet, kind: 'none', color: null };
  if (input.kind !== 'holo' && input.kind !== 'reverse') return { ok: false, reason: 'kind' };
  const color = finishColor(input.color);
  if (!color) return { ok: false, reason: 'color' };
  if (color.pass_only && !input.pass && !input.free) return { ok: false, reason: 'pass' };

  const ownsKind = input.kind === 'holo' ? wallet.holo : wallet.reverse;
  const ownsColor = color.pass_only || wallet.colors.includes(color.id);
  let cost = 0;
  if (!input.free) {
    if (!ownsKind && !ownsColor) cost = finishPrice(input.kind, input.pass);
    else if (!ownsKind) cost = finishPrice(input.kind, input.pass);
    else if (!ownsColor) cost = finishPrice('extra_color', input.pass);
  }
  if (input.tokens < cost) return { ok: false, reason: 'tokens' };

  const colors =
    color.pass_only || wallet.colors.includes(color.id) ? wallet.colors : [...wallet.colors, color.id];
  return {
    ok: true,
    cost,
    wallet: {
      holo: wallet.holo || input.kind === 'holo',
      reverse: wallet.reverse || input.kind === 'reverse',
      colors,
    },
    kind: input.kind,
    color: color.id,
  };
}

/** Config shape the offline check re-validates. Exported so a bad file fails in one place. */
export function finishConfigErrors(): string[] {
  const cfg = finishConfig();
  const errors: string[] = [];
  if (cfg.currency !== 'tokens') errors.push('currency');
  const ids = new Set<string>();
  if (cfg.colors.length < 2) errors.push('colors');
  for (const color of cfg.colors) {
    if (ids.has(color.id)) errors.push(`dup ${color.id}`);
    ids.add(color.id);
    if (!color.name.trim()) errors.push(`name ${color.id}`);
    if (color.stops.length < 2 || color.stops.some((stop) => !HEX.test(stop))) errors.push(`stops ${color.id}`);
    if (!HEX.test(color.glare)) errors.push(`glare ${color.id}`);
    if (!(color.repeats >= 1)) errors.push(`repeats ${color.id}`);
  }
  const moon = finishColor('moonpearl');
  const silver = finishColor('quicksilver');
  const star = finishColor('starpearl');
  if (!moon || moon.hard || moon.repeats > 2) errors.push('moonpearl bands');
  if (!silver || !silver.hard || silver.repeats <= (moon?.repeats ?? 0)) errors.push('quicksilver bands');
  if (!star?.pass_only) errors.push('starpearl');
  if (cfg.colors.some((color) => color.pass_only && color.id !== 'starpearl')) errors.push('pass gate');
  const paint = cfg.paint;
  if (paint.window_opacity < 0.85 || paint.window_opacity > 1) errors.push('window opacity');
  if (paint.sheen_opacity < 0.28 || paint.sheen_opacity > 0.4) errors.push('sheen opacity');
  if (paint.sheen_opacity_on_shiny < 0.3 || paint.sheen_opacity_on_shiny > 0.35) errors.push('shiny cap');
  if (paint.sheen_wash_opacity <= 0 || paint.sheen_wash_opacity > 0.2) errors.push('sheen wash');
  if (paint.glare_opacity < 0.5 || paint.glare_opacity > 0.6) errors.push('glare');
  if (paint.reverse_opacity < 0.8 || paint.reverse_opacity > 1) errors.push('reverse opacity');
  if (paint.sheen_blend !== 'overlay') errors.push('sheen blend');
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
