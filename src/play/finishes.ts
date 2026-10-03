/**
 * Pet finishes (save v30) — holo and reverse holo, picked, never rolled.
 *
 * Every name, stop, glare, opacity and price lives in `data/finishes.json`.
 * Classic stays the only shiny the egg roll and Shine Stones can produce.
 * A Tide Pass discounts the token prices and is the only way to wear Starpearl.
 * `PLAY_EVERYTHING_FREE` is applied by the store (cost 0, everything wearable).
 *
 * Token math (the pet mini-game cap, the daily budget Part E prices against):
 *   holo = unlock_days × PET_TOKENS_DAILY_CAP  (6 × 30 = 180, inside 5–7 days)
 *   reverse holo = the same
 *   each extra named colour = that price / 3  (60 = 2 days)
 *   Tide Pass pays (1 − 1/4) of those prices (135 and 45)
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
  holo_opacity: number;
  holo_opacity_on_shiny: number;
  glare_opacity: number;
  reverse_opacity: number;
  fallback_opacity: number;
  holo_blend: string;
  holo_blend_fallback: string;
  reverse_blend: string;
};

export type FinishConfig = {
  currency: string;
  earn_per_round: number;
  earn_daily_cap: number;
  unlock_days: number;
  unlock_days_min: number;
  unlock_days_max: number;
  extra_color_share_den: number;
  prices: { holo: number; reverse: number; extra_color: number };
  pass_discount_num: number;
  pass_discount_den: number;
  paint: FinishPaint;
  sweep_ms: number;
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

/** Token price after the Tide Pass discount. Pass pays `(den − num) / den`. */
export function finishPrice(what: 'holo' | 'reverse' | 'extra_color', pass: boolean): number {
  const cfg = finishConfig();
  const base = cfg.prices[what];
  if (!pass) return base;
  return Math.round((base * (cfg.pass_discount_den - cfg.pass_discount_num)) / cfg.pass_discount_den);
}

export function holoFoilOpacity(onShiny: boolean, blend: boolean): number {
  const paint = finishConfig().paint;
  if (onShiny) return paint.holo_opacity_on_shiny;
  return blend ? paint.holo_opacity : paint.fallback_opacity;
}

export function glareOpacity(): number {
  return finishConfig().paint.glare_opacity;
}

export function reverseOpacity(): number {
  return finishConfig().paint.reverse_opacity;
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
  if (paint.holo_opacity < 0.35 || paint.holo_opacity > 0.5) errors.push('holo opacity');
  if (paint.holo_opacity_on_shiny < 0.3 || paint.holo_opacity_on_shiny > 0.35) errors.push('shiny cap');
  if (paint.glare_opacity < 0.5 || paint.glare_opacity > 0.6) errors.push('glare');
  if (paint.reverse_opacity !== 0.4) errors.push('reverse opacity');
  if (paint.holo_blend !== 'color-dodge' || paint.holo_blend_fallback !== 'overlay') errors.push('holo blend');
  if (paint.reverse_blend !== 'screen') errors.push('reverse blend');
  if (cfg.prices.holo !== cfg.unlock_days * cfg.earn_daily_cap) errors.push('holo price');
  if (cfg.prices.reverse !== cfg.prices.holo) errors.push('reverse price');
  if (cfg.unlock_days < cfg.unlock_days_min || cfg.unlock_days > cfg.unlock_days_max) errors.push('days');
  if (cfg.prices.extra_color * cfg.extra_color_share_den !== cfg.prices.holo) errors.push('extra color');
  return errors;
}
