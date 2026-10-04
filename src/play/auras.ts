/**
 * Pet auras (save v31) — Blaze, Spiky, Rune, Bubbles.
 *
 * Bought per style. The colour is the equipped sword's element, from
 * `swords.json`, with the sample ramp (pale mid-tones deepened). Frames are
 * generated from the pet's alpha. Classic stays the only rolled shiny.
 * `PLAY_EVERYTHING_FREE` is applied by the store (cost 0, everything wearable).
 */
import rawAuras from './data/auras.json';
import { swordElement } from '@/play/swords';

export const AURA_STYLES = ['blaze', 'spiky', 'rune', 'bubbles'] as const;
export type AuraStyle = (typeof AURA_STYLES)[number];

export type AuraStyleDef = {
  id: AuraStyle;
  name: string;
  frames: number;
  price: number;
  pass_price: number;
};

export type AuraConfig = {
  currency: string;
  fps: number;
  fallback_element: string;
  quiet_foil: number;
  luma_deepen_at: number;
  deepen_mix: number;
  styles: readonly AuraStyleDef[];
};

export type AuraRefusal = 'style' | 'tokens';

export type AuraPlan =
  | { ok: true; cost: number; owned: AuraStyle[]; style: AuraStyle | 'none' }
  | { ok: false; reason: AuraRefusal };

const HEX = /^#[0-9A-Fa-f]{6}$/;

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
  return auraStyle(id)?.frames ?? 6;
}

export function auraFps(): number {
  return auraConfig().fps;
}

/** Card-face foil opacity while an aura is worn, so the two don't fight. */
export function quietFoilOpacity(): number {
  return auraConfig().quiet_foil;
}

export function parseAuraStyle(raw: unknown): AuraStyle | 'none' {
  return isAuraStyle(raw) ? raw : 'none';
}

export function parseAuraOwned(raw: unknown): AuraStyle[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isAuraStyle))];
}

export function planAuraWear(input: {
  owned: readonly AuraStyle[];
  tokens: number;
  pass: boolean;
  free: boolean;
  style: AuraStyle | 'none';
}): AuraPlan {
  const owned = [...input.owned];
  if (input.style === 'none') return { ok: true, cost: 0, owned, style: 'none' };
  if (!isAuraStyle(input.style)) return { ok: false, reason: 'style' };
  const have = owned.includes(input.style);
  const cost = input.free || have ? 0 : auraPrice(input.style, input.pass);
  if (input.tokens < cost) return { ok: false, reason: 'tokens' };
  if (!have) owned.push(input.style);
  return { ok: true, cost, owned, style: input.style };
}

export function auraConfigErrors(): string[] {
  const cfg = auraConfig();
  const errors: string[] = [];
  if (cfg.currency !== 'tokens') errors.push('currency');
  if (cfg.fps !== 8) errors.push('fps');
  if (!(cfg.quiet_foil > 0 && cfg.quiet_foil < 0.4)) errors.push('quiet');
  if (!swordElement(cfg.fallback_element)) errors.push('fallback');
  const ids = new Set<string>();
  if (cfg.styles.length !== 4) errors.push('styles');
  for (const row of cfg.styles) {
    if (ids.has(row.id)) errors.push(`dup ${row.id}`);
    ids.add(row.id);
    if (!row.name.trim()) errors.push(`name ${row.id}`);
    if (row.id === 'blaze' ? row.frames !== 8 : row.frames !== 6) errors.push(`frames ${row.id}`);
    if (!(row.price > 0) || !(row.pass_price > 0) || row.pass_price >= row.price) errors.push(`price ${row.id}`);
  }
  const expect: Record<string, [number, number]> = {
    blaze: [900, 675],
    spiky: [450, 340],
    rune: [300, 225],
    bubbles: [300, 225],
  };
  for (const [id, [price, pass]] of Object.entries(expect)) {
    const row = auraStyle(id);
    if (!row || row.price !== price || row.pass_price !== pass) errors.push(`tune ${id}`);
  }
  for (const banned of ['halo', 'zap', 'smoke']) {
    if (ids.has(banned)) errors.push(banned);
  }
  return errors;
}

export type Rgb = [number, number, number];

function hexRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixToward(col: Rgb, target: Rgb, t: number): Rgb {
  return [
    col[0] + (target[0] - col[0]) * t,
    col[1] + (target[1] - col[1]) * t,
    col[2] + (target[2] - col[2]) * t,
  ];
}

/** Sample ramp. Pale sword colours (luma > 0.75) are pulled toward ink so the three tones separate. */
export function swordRamp(element: string): { core: Rgb; mid: Rgb; tip: Rgb } {
  const cfg = auraConfig();
  const hex = swordElement(element)?.color;
  let mid: Rgb = hex && HEX.test(hex) ? hexRgb(hex) : hexRgb('#E85D04');
  const l = (0.3 * mid[0] + 0.59 * mid[1] + 0.11 * mid[2]) / 255;
  if (l > cfg.luma_deepen_at) mid = mixToward(mid, [40, 32, 8], cfg.deepen_mix);
  return {
    core: mixToward(mid, [255, 255, 255], 0.8),
    mid,
    tip: mixToward(mid, [12, 6, 10], 0.62),
  };
}

function hash(x: number, y: number, s: number): number {
  let n = (x * 374761393 + y * 668265263 + s * 1442677579) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export type AuraPixel = { x: number; y: number; col: Rgb };
export type AuraFrame = { pixels: AuraPixel[]; sparks: { x: number; y: number }[] };

type Field = { dist: Float32Array; nx: Int16Array; ny: Int16Array; W: number; H: number; pad: number };

function euclidField(opaque: Uint8Array, w: number, h: number, pad: number): Field {
  const pts: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!opaque[y * w + x]) continue;
    const edge =
      x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
      !opaque[y * w + (x - 1)] || !opaque[y * w + (x + 1)] ||
      !opaque[(y - 1) * w + x] || !opaque[(y + 1) * w + x];
    if (edge) pts.push(x, y);
  }
  const W = w + pad * 2;
  const H = h + pad * 2;
  const dist = new Float32Array(W * H);
  const nx = new Int16Array(W * H);
  const ny = new Int16Array(W * H);
  dist.fill(99);
  for (let y = -pad; y < h + pad; y++) {
    for (let x = -pad; x < w + pad; x++) {
      const xi = x + pad;
      const yi = y + pad;
      const ixy = yi * W + xi;
      if (x >= 0 && y >= 0 && x < w && y < h && opaque[y * w + x]) {
        dist[ixy] = 0;
        nx[ixy] = x;
        ny[ixy] = y;
        continue;
      }
      let m = 99;
      let bx = x;
      let by = y;
      for (let i = 0; i < pts.length; i += 2) {
        const d = Math.hypot(x - pts[i], y - pts[i + 1]);
        if (d < m) {
          m = d;
          bx = pts[i];
          by = pts[i + 1];
        }
      }
      dist[ixy] = m;
      nx[ixy] = bx;
      ny[ixy] = by;
    }
  }
  return { dist, nx, ny, W, H, pad };
}

function opaqueBox(opaque: Uint8Array, w: number, h: number) {
  let minx = w;
  let miny = h;
  let maxx = 0;
  let maxy = 0;
  let n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!opaque[y * w + x]) continue;
    n++;
    if (x < minx) minx = x;
    if (y < miny) miny = y;
    if (x > maxx) maxx = x;
    if (y > maxy) maxy = y;
  }
  if (!n) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1 };
}

/**
 * Spiky, Rune, and Bubbles were drawn for a ~20px pet. Bigger sheet frames
 * scale those. Blaze stays in art pixels: a thin outline hugging the pet.
 */
export function auraLayout(boxH: number): { scale: number; pad: number } {
  const scale = Math.max(1, boxH / 20);
  return { scale, pad: Math.max(16, Math.ceil(10 * scale + 4)) };
}

/** One style, every frame, from an alpha mask (0 = clear). Opaque cells are never painted. */
export function auraFramesFromAlpha(
  alpha: Uint8Array,
  w: number,
  h: number,
  style: AuraStyle,
  element: string,
): { frames: AuraFrame[]; pad: number } {
  const opaque = new Uint8Array(w * h);
  for (let i = 0; i < alpha.length; i++) if (alpha[i] >= 40) opaque[i] = 1;
  const box = opaqueBox(opaque, w, h);
  const layout = auraLayout(box.h);
  const field = euclidField(opaque, w, h, layout.pad);
  const ramp = swordRamp(element);
  const frames = auraFrameCount(style);
  const out: AuraFrame[] = [];
  for (let frame = 0; frame < frames; frame++) out.push(paintFrame(opaque, w, h, box, field, ramp, style, frame, layout.scale));
  return { frames: out, pad: layout.pad };
}

function paintFrame(
  opaque: Uint8Array,
  w: number,
  h: number,
  box: { x: number; y: number; w: number; h: number },
  field: Field,
  ramp: { core: Rgb; mid: Rgb; tip: Rgb },
  style: AuraStyle,
  frame: number,
  scale: number,
): AuraFrame {
  const f = frame % (style === 'blaze' ? 8 : 6);
  const u = (n: number) => n * scale;
  const px = (n: number) => Math.max(1, Math.round(n * scale));
  const map = new Map<number, AuraPixel & { pri: number }>();
  const paint = (x: number, y: number, col: Rgb, pri: number) => {
    if (x >= 0 && y >= 0 && x < w && y < h && opaque[y * w + x]) return;
    const k = (y + 2048) * 8192 + (x + 2048);
    const prev = map.get(k);
    if (prev && prev.pri > pri) return;
    map.set(k, { x, y, col, pri });
  };
  const nearestY = (x: number, y: number) => {
    const X = x + field.pad;
    const Y = y + field.pad;
    if (X < 0 || Y < 0 || X >= field.W || Y >= field.H) return box.y;
    return field.ny[Y * field.W + X];
  };
  const ringAt = (target: number, thick = 1) => {
    const pts: { x: number; y: number; ox: number; oy: number }[] = [];
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const band = Math.max(0, (thick - 1) / 2);
    for (let Y = 0; Y < field.H; Y++) for (let X = 0; X < field.W; X++) {
      const d = field.dist[Y * field.W + X];
      if (thick <= 1) {
        if (Math.round(d) !== Math.round(target)) continue;
      } else if (Math.abs(d - target) > band + 0.5) continue;
      const x = X - field.pad;
      const y = Y - field.pad;
      pts.push({ x, y, ox: field.nx[Y * field.W + X], oy: field.ny[Y * field.W + X] });
    }
    pts.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
    return pts;
  };
  if (style === 'blaze') {
    for (let Y = 0; Y < field.H; Y++) for (let X = 0; X < field.W; X++) {
      const d = field.dist[Y * field.W + X];
      if (d < 0.9 || d > 8) continue;
      const x = X - field.pad;
      const y = Y - field.pad;
      if (y < box.y - 1 || y > box.y + box.h) continue;
      const oy = nearestY(x, y);
      const t = (oy - box.y) / Math.max(1, box.h);
      let maxR = t < 0.22 ? 2.5 : t < 0.5 ? 4.4 : 6.1;
      if (Math.abs(x - field.nx[Y * field.W + X]) >= Math.abs(y - oy)) maxR += 0.8;
      if (d > maxR) continue;
      const col = d < 1.7 ? ramp.core : d > maxR - 1.05 ? ramp.tip : ramp.mid;
      paint(x, y, col, 1);
    }
    const tops: { x: number; y: number }[] = [];
    for (let x = box.x; x < box.x + box.w; x++) {
      for (let y = box.y; y < box.y + box.h; y++) {
        if (!opaque[y * w + x]) continue;
        tops.push({ x, y });
        break;
      }
    }
    const headY = tops.reduce((m, t) => Math.min(m, t.y), box.y + box.h);
    const head = tops.filter((t) => t.y <= headY + 2);
    const count = Math.min(5, Math.max(4, head.length));
    for (let i = 0; i < count; i++) {
      if (!head.length) break;
      const c = head[Math.round((i * (head.length - 1)) / Math.max(1, count - 1))];
      const flick = hash(i, f, 17);
      if (i === count - 1 && flick < 0.35) continue;
      const len = 6 + (flick > 0.66 ? 2 : flick > 0.33 ? 1 : 0);
      const drift = flick < 0.25 ? -1 : flick > 0.8 ? 1 : 0;
      for (let s = 1; s <= len; s++) {
        const tx = c.x + (s > 2 ? drift : 0);
        const ty = c.y - s;
        const col = s < len * 0.55 ? ramp.mid : ramp.tip;
        paint(tx, ty, col, 6);
        if (s <= 3) paint(tx + (i % 2 === 0 ? 1 : -1), ty, col, 6);
      }
    }
  }
  const thick = Math.max(1, Math.round(scale * 0.45));
  if (style === 'spiky') {
    const ring = ringAt(u(3), thick);
    for (const p of ring) paint(p.x, p.y, ramp.mid, 2);
    const spine = ringAt(u(3));
    const spikes = 7;
    for (let i = 0; i < spikes; i++) {
      const p = spine[Math.floor((i * spine.length) / spikes)];
      if (!p) continue;
      let ux = p.x - p.ox;
      let uy = p.y - p.oy;
      const len = Math.hypot(ux, uy) || 1;
      ux /= len;
      uy /= len;
      const slen = Math.round(u(2) + (uy < -0.25 ? px(1) : 0) + (f % 3 === i % 3 ? px(1) : 0));
      for (let s = 1; s <= slen; s++) {
        paint(Math.round(p.x + ux * s), Math.round(p.y + uy * s), s === slen ? ramp.tip : ramp.mid, 4);
      }
    }
  }
  if (style === 'rune') {
    const bands = [ringAt(u(4)), ringAt(u(5)), ringAt(u(6))];
    const n = 7;
    const white: Rgb = [255, 255, 255];
    const arm = px(1);
    for (let i = 0; i < n; i++) {
      const ring = bands[i % 3];
      if (!ring.length) continue;
      const p = ring[Math.floor((i * ring.length) / n) % ring.length];
      const t = (f + i) % 6;
      if (t === 3) continue;
      const peak = t === 0;
      for (let dy = -arm; dy <= arm; dy++) for (let dx = -arm; dx <= arm; dx++) {
        if (dx !== 0 && dy !== 0) continue;
        paint(p.x + dx, p.y + dy, peak && dx === 0 && dy === 0 ? white : ramp.mid, peak ? 5 : 3);
      }
    }
  }
  if (style === 'bubbles') {
    const ring = ringAt(u(4));
    const n = 7;
    for (let i = 0; i < n; i++) {
      if (!ring.length) break;
      const p = ring[(Math.floor((i * ring.length) / n) + f * 2) % ring.length];
      const rad = i % 3 === 0 ? Math.max(2, Math.round(u(2))) : px(1);
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        const m = Math.abs(dx) + Math.abs(dy);
        if (m !== rad && !(rad > 1 && m === 0)) continue;
        paint(p.x + dx, p.y + dy, m === 0 ? ramp.core : ramp.mid, 4);
      }
    }
  }
  const sparks: { x: number; y: number }[] = [];
  if (style === 'blaze') {
    for (let i = 0; i < 4; i++) {
      const x = box.x - 1 + Math.floor(hash(i, frame, 81) * (box.w + 2));
      const y = box.y - 2 - ((frame + i * 2) % 5);
      if (x >= 0 && y >= 0 && x < w && y < h && opaque[y * w + x]) continue;
      const stroke = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const sx = x + dx;
        const sy = y + dy;
        return sx >= 0 && sy >= 0 && sx < w && sy < h && opaque[sy * w + sx] === 1;
      });
      if (stroke) continue;
      sparks.push({ x, y });
    }
  }
  return { pixels: [...map.values()].map(({ x, y, col }) => ({ x, y, col })), sparks };
}
