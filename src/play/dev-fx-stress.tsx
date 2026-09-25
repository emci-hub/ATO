/**
 * Dev kit only — FPS readout + synthetic FX stress (EFFECTS_PLAN.md build step 1).
 *
 * Measures what the attack-effects system can afford on a real phone before any
 * effect is built. Three pieces, all display-only (never touch `DefendLive`):
 *
 * - `useFpsMeter` counts JS-thread frames with `requestAnimationFrame` over a 1s
 *   window (fps + worst frame gap) and reads a caller-owned commit counter, so
 *   the readout also shows how many times per second the board re-rendered.
 * - `FpsOverlay` draws that readout over the board's top-left corner.
 * - `StressFxLayer` draws N fake effects inside the board `<Svg>`, each built the
 *   way the real FX layer will be (3 stacked strokes for glow + a 3-ring impact =
 *   6 primitives), re-jagged every tick. The caller drives `tick` from its own
 *   state, so every tick re-renders the whole board — the worst case the real FX
 *   layer would hit if it stored effects in screen state the way shots do today.
 */
import { useEffect, useState, type MutableRefObject } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Circle, G, Path } from 'react-native-svg';

/** Stress levels the dev row cycles through: off, the planned cap, 2x the cap. */
export const STRESS_FX_LEVELS = [0, 12, 24] as const;
export type StressFxLevel = (typeof STRESS_FX_LEVELS)[number];

export function nextStressFxLevel(level: StressFxLevel): StressFxLevel {
  const i = STRESS_FX_LEVELS.indexOf(level);
  return STRESS_FX_LEVELS[(i + 1) % STRESS_FX_LEVELS.length];
}

/** SVG primitives one stress effect draws (3 glow strokes + 3 impact rings). */
export const STRESS_FX_PRIMITIVES = 6;

export type FpsStats = {
  /** JS-thread frames in the last second. */
  fps: number;
  /** Longest gap between two frames in that second, ms. */
  worstMs: number;
  /** Board commits per second (from the caller's counter). */
  renders: number;
};

/** 1s-window frame meter. Resets `commitCountRef` at every window edge; the
 * caller increments it once per commit. Null while disabled. */
export function useFpsMeter(
  enabled: boolean,
  commitCountRef: MutableRefObject<number>,
): FpsStats | null {
  const [stats, setStats] = useState<FpsStats | null>(null);
  useEffect(() => {
    if (!enabled) {
      setStats(null);
      return;
    }
    let raf = 0;
    let frames = 0;
    let worst = 0;
    let last = -1;
    let windowStart = -1;
    commitCountRef.current = 0;
    const loop = (now: number) => {
      if (windowStart < 0) {
        windowStart = now;
        last = now;
      } else {
        const gap = now - last;
        last = now;
        frames += 1;
        if (gap > worst) worst = gap;
        const elapsed = now - windowStart;
        if (elapsed >= 1000) {
          const secs = elapsed / 1000;
          setStats({
            fps: Math.round(frames / secs),
            worstMs: Math.round(worst),
            renders: Math.round(commitCountRef.current / secs),
          });
          frames = 0;
          worst = 0;
          windowStart = now;
          commitCountRef.current = 0;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled, commitCountRef]);
  return stats;
}

/** Green at a smooth 55+, yellow 40-54, red below 40. */
function fpsColor(fps: number): string {
  if (fps >= 55) return '#34D399';
  if (fps >= 40) return '#FACC15';
  return '#F87171';
}

export function FpsOverlay({ stats, fxCount }: { stats: FpsStats | null; fxCount: number }) {
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Text style={[styles.main, { color: stats ? fpsColor(stats.fps) : '#E5E7EB' }]}>
        {stats ? `${stats.fps} fps · worst ${stats.worstMs}ms` : 'measuring…'}
      </Text>
      <Text style={styles.sub}>
        {`${stats?.renders ?? 0} renders/s · fx ${fxCount} (${fxCount * STRESS_FX_PRIMITIVES} shapes)`}
      </Text>
    </View>
  );
}

export type StressPoint = { x: number; y: number };

/** Element palette from EFFECTS_PLAN.md (Ember, Tide, Spark, Root, Void). */
const STRESS_COLORS = ['#FB923C', '#38BDF8', '#FACC15', '#34D399', '#A78BFA'] as const;

/** Cheap deterministic 0..1 noise so each tick re-jags without Math.random. */
function noise(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function jaggedPath(a: StressPoint, b: StressPoint, tick: number, seed: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  let d = `M${a.x.toFixed(1)} ${a.y.toFixed(1)}`;
  const SEGMENTS = 6;
  for (let s = 1; s < SEGMENTS; s += 1) {
    const t = s / SEGMENTS;
    const off = (noise(tick, seed, s) - 0.5) * 4;
    d += ` L${(a.x + dx * t + nx * off).toFixed(1)} ${(a.y + dy * t + ny * off).toFixed(1)}`;
  }
  return `${d} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

/** `count` fake effects from `from` anchors to `to` anchors (board units). A
 * missing anchor list falls back to a noise point on the board. Targets hop
 * every ~8 ticks so the layer never settles into a static picture. */
export function StressFxLayer({
  count,
  tick,
  from,
  to,
}: {
  count: number;
  tick: number;
  from: readonly StressPoint[];
  to: readonly StressPoint[];
}) {
  const hop = Math.floor(tick / 8);
  const effects = [];
  for (let i = 0; i < count; i += 1) {
    const a: StressPoint =
      from.length > 0
        ? from[i % from.length]
        : { x: 10 + noise(i, 1, 0) * 80, y: 10 + noise(i, 2, 0) * 80 };
    const b: StressPoint =
      to.length > 0
        ? to[(i * 7 + hop) % to.length]
        : { x: 10 + noise(i, hop, 3) * 80, y: 10 + noise(i, hop, 4) * 80 };
    const color = STRESS_COLORS[i % STRESS_COLORS.length];
    const d = jaggedPath(a, b, tick, i);
    const pulse = 1 + noise(tick, i, 9) * 1.5;
    effects.push(
      <G key={`stress-${i}`}>
        <Path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeOpacity={0.18} strokeLinecap="round" strokeLinejoin="round" />
        <Path d={d} fill="none" stroke={color} strokeWidth={0.9} strokeOpacity={0.45} strokeLinecap="round" strokeLinejoin="round" />
        <Path d={d} fill="none" stroke="#FFFFFF" strokeWidth={0.35} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={b.x} cy={b.y} r={pulse * 2.2} fill={color} fillOpacity={0.15} />
        <Circle cx={b.x} cy={b.y} r={pulse * 1.2} fill="none" stroke={color} strokeWidth={0.5} strokeOpacity={0.7} />
        <Circle cx={b.x} cy={b.y} r={0.6} fill="#FFFFFF" />
      </G>,
    );
  }
  return <G>{effects}</G>;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 4,
    left: 4,
    zIndex: 20,
    elevation: 20,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  main: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sub: { fontSize: 11, color: '#E5E7EB', fontVariant: ['tabular-nums'] },
});
