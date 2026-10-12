/**
 * Attack effects layer — EFFECTS_PLAN step 5 (+ procedural fire for step 7).
 *
 * Draws one short-lived effect per kit hit (`KitHit` from the engine) inside
 * the board `<Svg>`, in board units (0..100). Pure presentation: damage was
 * already applied by the engine, and nothing here feeds back into it.
 *
 * Every effect is built from a handful of SVG primitives so the measured cap
 * holds (12 effects ≈ 72 shapes was smooth on device, 2026-09-26):
 *   Full    — glow = 3 stacked strokes (wide faint, mid, thin white core) +
 *             an impact ring + small element accents (flames, shards, thorns).
 *   Minimal — one coloured stroke + one impact ring. No glow, no accents.
 *   Off     — the caller draws nothing (damage numbers carry the colour).
 *
 * Shape by behavior (burst bolt, splash blast, dot sting, slow pulse, chain
 * polyline, pull vortex; ultimates bigger/longer, AoE ones centred on the
 * pad), colour by element (`ELEMENT_COLOR`), and a per-element line style:
 * Spark re-jags every frame, Void is a dark core with a violet rim, Ember gets
 * flame licks, Tide an ice shard, Root thorns.
 */
import type { ReactNode } from 'react';
import { Circle, G, Path } from 'react-native-svg';

import { artSkin } from '@/play/art-skin';
import type { FxQuality } from '@/play/fx-quality';
import type { KitHit } from '@/play/kit-combat';
import { ELEMENT_COLOR, type Element } from '@/play/kits';
import { SheetSprite, sheetFrame } from '@/play/sheet-sprite';
import { STREETWEAR_META } from '@/play/skin';

export type FxPoint = { x: number; y: number };

/** One drawable effect, resolved to board positions by the screen. */
export type FxEvent = {
  id: number;
  bornAt: number;
  lifeMs: number;
  behavior: KitHit['behavior'];
  element: Element | null;
  secondary: Element | null;
  ultimate: boolean;
  from: FxPoint;
  /** Hit positions in order (chain = bounce order; first = primary). */
  points: FxPoint[];
  /** Spark arc end, if the arc jumped. */
  arc: FxPoint | null;
  /** Blast / AoE radius (0 = none) and where it is centred. */
  radius: number;
  center: FxPoint;
  /** The area is centred on the firing pad (area ultimates), so there is no
   * travelling bolt first. */
  centredOnSource: boolean;
  /** The Avatar's own weapon hit (sword / melee). Streetwear draws its element
   * slash at the target instead of a travelling shot. Optional: towers omit it. */
  melee?: boolean;
};

export const FX_LIFE_MS = 280;
export const FX_ULTIMATE_LIFE_MS = 560;

const NEUTRAL = '#E5E7EB';
const VOID_CORE = '#1E1B4B';

function colorOf(element: Element | null): string {
  return element ? ELEMENT_COLOR[element] : NEUTRAL;
}

function noise(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function straight(a: FxPoint, b: FxPoint): string {
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

function jagged(a: FxPoint, b: FxPoint, seed: number, frame: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const segs = Math.max(3, Math.min(7, Math.round(len / 4)));
  let d = `M${a.x.toFixed(1)} ${a.y.toFixed(1)}`;
  for (let i = 1; i < segs; i += 1) {
    const t = i / segs;
    const off = (noise(seed, frame, i) - 0.5) * 3.2;
    d += ` L${(a.x + dx * t + nx * off).toFixed(1)} ${(a.y + dy * t + ny * off).toFixed(1)}`;
  }
  return `${d} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

function linePath(element: Element | null, a: FxPoint, b: FxPoint, seed: number, frame: number): string {
  return element === 'spark' ? jagged(a, b, seed, frame) : straight(a, b);
}

function lerp(a: FxPoint, b: FxPoint, t: number): FxPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** A glowing stroke: 3 layers on Full, 1 on Minimal. Void swaps the white
 * core for a dark one (it reads as a hole, not a light). */
function GlowStroke({
  d,
  element,
  width,
  fade,
  quality,
  k,
}: {
  d: string;
  element: Element | null;
  width: number;
  fade: number;
  quality: FxQuality;
  k: string;
}) {
  const c = colorOf(element);
  if (quality === 'minimal') {
    return <Path key={k} d={d} fill="none" stroke={c} strokeWidth={width} strokeOpacity={0.9 * fade} strokeLinecap="round" strokeLinejoin="round" />;
  }
  const core = element === 'void' ? VOID_CORE : '#FFFFFF';
  return (
    <G key={k}>
      <Path d={d} fill="none" stroke={c} strokeWidth={width * 3} strokeOpacity={0.18 * fade} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={d} fill="none" stroke={c} strokeWidth={width * 1.6} strokeOpacity={0.5 * fade} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={d} fill="none" stroke={core} strokeWidth={width * 0.6} strokeOpacity={fade} strokeLinecap="round" strokeLinejoin="round" />
    </G>
  );
}

/** Small element accent at an impact point (Full only). Fire is drawn as
 * vector flame licks — the sprite sheet in the plan's step 7 would replace
 * this once its art is generated. */
function Accent({ element, at, size, fade, seed, frame }: { element: Element | null; at: FxPoint; size: number; fade: number; seed: number; frame: number }) {
  const c = colorOf(element);
  switch (element) {
    case 'ember': {
      const flames = [];
      for (let i = 0; i < 3; i += 1) {
        const x = at.x + (i - 1) * size * 0.7;
        const h = size * (1.4 + noise(seed, frame, i) * 0.8);
        flames.push(
          <Path
            key={`f${i}`}
            d={`M${(x - size * 0.4).toFixed(1)} ${at.y.toFixed(1)} Q${x.toFixed(1)} ${(at.y - h * 1.2).toFixed(1)} ${(x + size * 0.4).toFixed(1)} ${at.y.toFixed(1)} Z`}
            fill={i === 1 ? '#FDE68A' : c}
            fillOpacity={0.85 * fade}
          />,
        );
      }
      return <G>{flames}</G>;
    }
    case 'tide':
      return (
        <Path
          d={`M${at.x} ${at.y - size * 1.3} L${at.x + size * 0.6} ${at.y} L${at.x} ${at.y + size * 1.3} L${at.x - size * 0.6} ${at.y} Z`}
          fill="#E0F2FE"
          fillOpacity={0.9 * fade}
        />
      );
    case 'root':
      return (
        <Path
          d={`M${at.x - size} ${at.y + size * 0.6} L${at.x - size * 0.5} ${at.y - size} L${at.x} ${at.y + size * 0.6} L${at.x + size * 0.5} ${at.y - size} L${at.x + size} ${at.y + size * 0.6}`}
          fill="none"
          stroke={c}
          strokeWidth={0.5}
          strokeOpacity={fade}
          strokeLinejoin="round"
        />
      );
    case 'void':
      return <Circle cx={at.x} cy={at.y} r={size * 0.9} fill={VOID_CORE} fillOpacity={0.85 * fade} />;
    default:
      return null;
  }
}

function renderOne(fx: FxEvent, now: number, quality: FxQuality) {
  const k = Math.max(0, Math.min(1, (now - fx.bornAt) / fx.lifeMs));
  const fade = 1 - k;
  const frame = Math.floor(now / 50);
  const full = quality === 'full';
  const c = colorOf(fx.element);
  const w = fx.ultimate ? 1.1 : 0.7;
  const primary = fx.points[0] ?? fx.center;
  const parts: ReactNode[] = [];
  const impactRing = (at: FxPoint, r: number, key: string) => (
    <Circle key={key} cx={at.x} cy={at.y} r={r} fill="none" stroke={c} strokeWidth={0.6} strokeOpacity={0.8 * fade} />
  );

  // Area ultimates (dot / slow / pull) and splashes: a blast at the centre.
  if (fx.radius > 0) {
    const travel = fx.centredOnSource ? 1 : Math.min(1, k / 0.3);
    if (!fx.centredOnSource && travel < 1) {
      const head = lerp(fx.from, fx.center, travel);
      parts.push(<GlowStroke key="bolt" k="bolt" d={straight(lerp(fx.from, fx.center, Math.max(0, travel - 0.35)), head)} element={fx.element} width={w} fade={1} quality={quality} />);
    } else {
      const t = fx.centredOnSource ? k : (k - 0.3) / 0.7;
      const r = fx.radius * (0.35 + 0.65 * t);
      const f = 1 - t;
      parts.push(<Circle key="disc" cx={fx.center.x} cy={fx.center.y} r={r} fill={c} fillOpacity={(full ? 0.16 : 0.1) * f} />);
      parts.push(
        <Circle
          key="ring"
          cx={fx.center.x}
          cy={fx.center.y}
          r={r}
          fill="none"
          stroke={c}
          strokeWidth={fx.ultimate ? 1 : 0.7}
          strokeOpacity={0.9 * f}
          strokeDasharray={fx.behavior === 'pull' ? '2 2' : undefined}
        />,
      );
      if (full && fx.secondary) {
        parts.push(<Circle key="ring2" cx={fx.center.x} cy={fx.center.y} r={r * 0.7} fill="none" stroke={colorOf(fx.secondary)} strokeWidth={0.6} strokeOpacity={0.7 * f} />);
      }
      if (full) parts.push(<Accent key="acc" element={fx.element} at={fx.center} size={fx.ultimate ? 2 : 1.4} fade={f} seed={fx.id} frame={frame} />);
    }
    return <G key={`fx-${fx.id}`}>{parts}</G>;
  }

  if (fx.behavior === 'chain') {
    const chain = [fx.from, ...fx.points];
    for (let i = 0; i < chain.length - 1; i += 1) {
      parts.push(
        <GlowStroke key={`c${i}`} k={`c${i}`} d={linePath(fx.element, chain[i], chain[i + 1], fx.id * 31 + i, frame)} element={fx.element} width={w * (1 - i * 0.08)} fade={fade} quality={quality} />,
      );
    }
    if (full) parts.push(impactRing(chain[chain.length - 1], 1.2 + k * 1.5, 'imp'));
    return <G key={`fx-${fx.id}`}>{parts}</G>;
  }

  // Single-target shapes: a fast bolt, then the impact.
  const travel = Math.min(1, k / 0.35);
  const head = lerp(fx.from, primary, travel);
  if (travel < 1) {
    const tail = lerp(fx.from, primary, Math.max(0, travel - 0.4));
    parts.push(<GlowStroke key="bolt" k="bolt" d={linePath(fx.element, tail, head, fx.id, frame)} element={fx.element} width={w} fade={1} quality={quality} />);
  } else {
    const t = (k - 0.35) / 0.65;
    const f = 1 - t;
    if (fx.behavior === 'burst' && fx.element === 'spark') {
      parts.push(<GlowStroke key="beam" k="beam" d={jagged(fx.from, primary, fx.id, frame)} element={fx.element} width={w * 0.8} fade={f} quality={quality} />);
    }
    if (fx.behavior === 'pull') {
      // Vortex: a dashed ring shrinking onto the target.
      parts.push(<Circle key="vortex" cx={primary.x} cy={primary.y} r={4.5 * (1 - t) + 0.8} fill="none" stroke={c} strokeWidth={0.6} strokeDasharray="1.5 1.5" strokeOpacity={0.9 * f} />);
      if (fx.element === 'void') parts.push(<Circle key="hole" cx={primary.x} cy={primary.y} r={1.6} fill={VOID_CORE} fillOpacity={0.9 * f} />);
    } else if (fx.behavior === 'slow') {
      parts.push(<Circle key="pulse" cx={primary.x} cy={primary.y} r={1.5 + t * 3.5} fill={c} fillOpacity={0.15 * f} stroke={c} strokeWidth={0.5} strokeOpacity={0.8 * f} />);
    } else {
      parts.push(impactRing(primary, 1 + t * (fx.ultimate ? 5 : 2.5), 'imp'));
    }
    if (full) parts.push(<Accent key="acc" element={fx.element} at={primary} size={fx.ultimate ? 1.8 : 1.2} fade={f} seed={fx.id} frame={frame} />);
  }
  if (fx.arc) {
    parts.push(<GlowStroke key="arc" k="arc" d={jagged(primary, fx.arc, fx.id + 7, frame)} element="spark" width={0.45} fade={fade} quality={quality} />);
  }
  return <G key={`fx-${fx.id}`}>{parts}</G>;
}

/* ------------------------------------------------ Streetwear sprite fx ---- */
/* With the Streetwear art style on, each hit plays the element's packed
 * PixelLab sprite (one colour AND one shape per element) instead of the vector
 * strokes: a projectile that turns to face its flight, then the element's hit,
 * or its burst for an area. Timing is the same `lifeMs` as the vector path, so
 * nothing about the fight changes; the sprite's frames are spread over it. */

/** Board-unit sizes of the sprite cells (a cell includes its padding). */
const SW_SHOT_UNITS = 6;
const SW_HIT_UNITS = 8;
const SW_HIT_ULT_UNITS = 12;
/** Burst cell edge per unit of blast radius (the ring art fills ~80% of the cell). */
const SW_BURST_PER_RADIUS = 2.4;
/** The weapon slash cell (96px art) on a melee hit, in board units. */
const SW_SLASH_UNITS = 16;

function swKey(element: Element | null, kind: string): string | null {
  const el = element ?? 'plain';
  if (STREETWEAR_META.fx[`${el}/${kind}`]) return `${el}/${kind}`;
  return STREETWEAR_META.fx[`plain/${kind}`] ? `plain/${kind}` : null;
}

/** One sprite frame at progress `t` (0..1), anchored on `at`, optionally rotated. */
function swSprite(key: string, t: number, at: FxPoint, size: number, angle: number | null, id: string) {
  const meta = STREETWEAR_META.fx[key];
  if (!meta) return null;
  const n = meta.frames;
  const i = meta.loop ? Math.floor(t * n * 2) % n : Math.min(n - 1, Math.max(0, Math.floor(t * n)));
  const frame = sheetFrame(`sheets/streetwear/fx/${key}`, `frame_${String(i).padStart(3, '0')}`);
  if (!frame) return null;
  const sprite = <SheetSprite key={id} frame={frame} x={at.x - meta.anchorX * size} y={at.y - meta.anchorY * size} size={size} />;
  return angle == null ? sprite : <G key={id} transform={`rotate(${angle.toFixed(1)} ${at.x.toFixed(1)} ${at.y.toFixed(1)})`}>{sprite}</G>;
}

function headingDeg(a: FxPoint, b: FxPoint): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/** The Streetwear sprite version of one effect, or null to fall back to vector. */
function renderSprite(fx: FxEvent, now: number) {
  if (fx.behavior === 'chain') return null; // chain lightning keeps its vector bolts
  const k = Math.max(0, Math.min(1, (now - fx.bornAt) / fx.lifeMs));
  // A weapon hit: the element's slash sweeps over the target (no travelling bolt),
  // then the hit pop under it; an area weapon hit still bursts.
  if (fx.melee && fx.radius <= 0) {
    const slash = swKey(fx.element, 'slash');
    const hitKey = swKey(fx.element, 'hit');
    const target = fx.points[0] ?? fx.center;
    if (!slash && !hitKey) return null;
    return (
      <G key={`fx-${fx.id}`}>
        {slash ? swSprite(slash, k, target, SW_SLASH_UNITS * (fx.ultimate ? 1.3 : 1), headingDeg(fx.from, target), 'slash') : null}
        {hitKey && k > 0.35 ? swSprite(hitKey, (k - 0.35) / 0.65, target, SW_HIT_UNITS, null, 'hit') : null}
      </G>
    );
  }
  const shot = swKey(fx.element, 'shot');
  const target = fx.radius > 0 ? fx.center : (fx.points[0] ?? fx.center);
  const travelEnd = fx.radius > 0 ? 0.3 : 0.35;
  const parts: ReactNode[] = [];
  if (!fx.centredOnSource && k < travelEnd) {
    if (!shot) return null;
    const head = lerp(fx.from, target, k / travelEnd);
    parts.push(swSprite(shot, k / travelEnd, head, SW_SHOT_UNITS, headingDeg(fx.from, target), 'shot'));
  } else {
    const t = fx.centredOnSource ? k : (k - travelEnd) / (1 - travelEnd);
    if (fx.radius > 0) {
      const burst = swKey(fx.element, 'burst');
      if (!burst) return null;
      parts.push(swSprite(burst, t, target, fx.radius * SW_BURST_PER_RADIUS, null, 'burst'));
    } else {
      const hit = swKey(fx.element, 'hit');
      if (!hit) return null;
      parts.push(swSprite(hit, t, target, fx.ultimate ? SW_HIT_ULT_UNITS : SW_HIT_UNITS, null, 'hit'));
    }
  }
  return <G key={`fx-${fx.id}`}>{parts}</G>;
}

/** All live effects. The caller prunes expired ones and enforces the cap. */
export function FxLayer({ events, now, quality }: { events: readonly FxEvent[]; now: number; quality: FxQuality }) {
  if (quality === 'off' || events.length === 0) return null;
  const sprites = artSkin() === 'streetwear';
  return <G>{events.map((fx) => (sprites ? renderSprite(fx, now) : null) ?? renderOne(fx, now, quality))}</G>;
}
