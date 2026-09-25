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
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
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
    // Spread targets across the whole creep list (not just the newest, which
    // bunch at the path entrance) and drift them every hop.
    const b: StressPoint =
      to.length > 0
        ? to[(Math.floor((i * to.length) / Math.max(1, count)) + hop) % to.length]
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

/* ------------------------------------------------------- auto benchmark --- */

/** One benchmark stage: hold this many creeps on the board at this FX level. */
export type BenchStage = { creeps: number; fx: StressFxLevel };

/** A real wave tops out at 11 creeps; 40 is the heavy worst case. */
export const BENCH_STAGES: readonly BenchStage[] = [
  { creeps: 11, fx: 0 },
  { creeps: 11, fx: 12 },
  { creeps: 11, fx: 24 },
  { creeps: 40, fx: 0 },
  { creeps: 40, fx: 12 },
  { creeps: 40, fx: 24 },
];
/** Per stage: 1.5s to fill the board and settle, then 4s measured. */
export const BENCH_SETTLE_MS = 1_500;
export const BENCH_MEASURE_MS = 4_000;

export type BenchResult = BenchStage & {
  fps: number;
  worstMs: number;
  renders: number;
  avgCreeps: number;
};

export type BenchHost = {
  /** Commit counter the screen increments once per board commit. */
  commitCountRef: MutableRefObject<number>;
  setFx: (level: StressFxLevel) => void;
  /** Creeps currently on the board. */
  creepCount: () => number;
  /** Queue creeps so the board heads toward `target` (no-op when at/over). */
  topUpCreeps: (target: number) => void;
  /** Called once when the run starts (e.g. force god mode on). */
  onStart: () => void;
  /** Called once when the run ends or is cancelled (restore state). */
  onEnd: () => void;
};

export type BenchState = {
  running: boolean;
  /** 0-based stage index while running, else -1. */
  stage: number;
  results: BenchResult[];
};

/** Runs every `BENCH_STAGES` stage back to back on one rAF loop and records
 * fps / worst frame / renders per second / average creeps for each. Only
 * re-renders the caller on stage changes and at the end. */
export function useFxBenchmark(host: BenchHost): {
  state: BenchState;
  start: () => void;
  cancel: () => void;
  clear: () => void;
} {
  const hostRef = useRef(host);
  hostRef.current = host;
  const [state, setState] = useState<BenchState>({ running: false, stage: -1, results: [] });
  const stopRef = useRef<(() => void) | null>(null);

  const cancel = useCallback(() => {
    stopRef.current?.();
  }, []);

  const start = useCallback(() => {
    if (stopRef.current) return;
    const h = hostRef.current;
    h.onStart();
    const results: BenchResult[] = [];
    let stage = 0;
    let stageStart = -1;
    let last = -1;
    let frames = 0;
    let worst = 0;
    let creepSum = 0;
    let creepSamples = 0;
    let raf = 0;
    let finished = false;

    const beginStage = (index: number) => {
      const s = BENCH_STAGES[index];
      hostRef.current.setFx(s.fx);
      hostRef.current.topUpCreeps(s.creeps);
      setState({ running: true, stage: index, results: [...results] });
    };

    const topUp = setInterval(() => {
      const s = BENCH_STAGES[stage];
      if (s) hostRef.current.topUpCreeps(s.creeps);
    }, 400);

    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      clearInterval(topUp);
      stopRef.current = null;
      hostRef.current.setFx(0);
      hostRef.current.onEnd();
      setState({ running: false, stage: -1, results: [...results] });
    };
    stopRef.current = finish;

    const loop = (now: number) => {
      if (stageStart < 0) {
        stageStart = now;
        last = now;
      }
      const t = now - stageStart;
      if (t >= BENCH_SETTLE_MS) {
        if (frames === 0 && creepSamples === 0) {
          // First measured frame of this stage — zero the commit counter.
          hostRef.current.commitCountRef.current = 0;
          last = now;
        } else {
          const gap = now - last;
          if (gap > worst) worst = gap;
        }
        last = now;
        frames += 1;
        creepSum += hostRef.current.creepCount();
        creepSamples += 1;
      } else {
        last = now;
      }
      if (t >= BENCH_SETTLE_MS + BENCH_MEASURE_MS) {
        const secs = (t - BENCH_SETTLE_MS) / 1000;
        results.push({
          ...BENCH_STAGES[stage],
          fps: Math.round((frames - 1) / secs),
          worstMs: Math.round(worst),
          renders: Math.round(hostRef.current.commitCountRef.current / secs),
          avgCreeps: Math.round(creepSum / Math.max(1, creepSamples)),
        });
        stage += 1;
        frames = 0;
        worst = 0;
        creepSum = 0;
        creepSamples = 0;
        stageStart = now;
        if (stage >= BENCH_STAGES.length) {
          finish();
          return;
        }
        beginStage(stage);
      }
      raf = requestAnimationFrame(loop);
    };
    beginStage(0);
    raf = requestAnimationFrame(loop);
  }, []);

  const clear = useCallback(() => {
    setState((prev) => (prev.running ? prev : { running: false, stage: -1, results: [] }));
  }, []);

  useEffect(() => () => stopRef.current?.(), []);

  return { state, start, cancel, clear };
}

/** One plain-English verdict line for a finished run. */
export function benchVerdict(results: readonly BenchResult[]): string {
  const at = (creeps: number, fx: number) =>
    results.find((r) => r.creeps === creeps && r.fx === fx);
  const real12 = at(11, 12);
  const real0 = at(11, 0);
  const heavy0 = at(40, 0);
  const heavy12 = at(40, 12);
  if (!real12 || !real0) return 'Test stopped early — run it again.';
  const fxCost = real0.fps - real12.fps;
  const crowdCost = heavy0 ? real0.fps - heavy0.fps : 0;
  const cap =
    real12.fps >= 50
      ? 'A 12-effect cap is safe on this phone.'
      : real12.fps >= 40
        ? 'A 12-effect cap is OK but tight.'
        : 'A 12-effect cap is too heavy — lower it.';
  const blame =
    heavy0 && heavy12
      ? crowdCost > fxCost
        ? ' Crowds cost more than effects, so step 2 (fewer redraws) matters most.'
        : ' Effects cost more than crowds, so the effect cap matters most.'
      : '';
  return `${cap}${blame}`;
}

/** Shareable text version of a finished run (paste into chat). */
export function benchReport(results: readonly BenchResult[]): string {
  const lines = results.map(
    (r) =>
      `${r.creeps} creeps (avg ${r.avgCreeps}) · FX ${r.fx === 0 ? 'off' : r.fx}: ${r.fps} fps, worst ${r.worstMs}ms, ${r.renders} renders/s`,
  );
  return ['ATO FPS test', ...lines, benchVerdict(results)].join('\n');
}

/** Auto-send state for a finished run (`play_dev_logs`). */
export type BenchSendStatus = 'sending' | 'sent' | 'failed' | null;

export function BenchPanel({
  state,
  sendStatus,
  onCancel,
  onShare,
  onClose,
}: {
  state: BenchState;
  sendStatus: BenchSendStatus;
  onCancel: () => void;
  onShare: () => void;
  onClose: () => void;
}) {
  if (!state.running && state.results.length === 0) return null;
  const current = state.running ? BENCH_STAGES[state.stage] : null;
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>
        {current
          ? `Testing ${state.stage + 1}/${BENCH_STAGES.length}: ${current.creeps} creeps · FX ${current.fx === 0 ? 'off' : current.fx}…`
          : 'FPS test results'}
      </Text>
      {state.results.map((r) => (
        <Text key={`${r.creeps}-${r.fx}`} style={styles.row}>
          <Text style={{ color: fpsColor(r.fps) }}>{`${r.fps} fps`}</Text>
          {`  ·  ${r.creeps} creeps · FX ${r.fx === 0 ? 'off' : r.fx} · worst ${r.worstMs}ms`}
        </Text>
      ))}
      {!state.running ? <Text style={styles.verdict}>{benchVerdict(state.results)}</Text> : null}
      {!state.running && sendStatus ? (
        <Text style={styles.row}>
          {sendStatus === 'sending'
            ? 'Sending results…'
            : sendStatus === 'sent'
              ? 'Results sent — nothing else to do.'
              : "Couldn't send — use Share results instead."}
        </Text>
      ) : null}
      <View style={styles.panelButtons}>
        {state.running ? (
          <Text onPress={onCancel} style={styles.panelButton} accessibilityRole="button">
            Stop
          </Text>
        ) : (
          <>
            <Text onPress={onShare} style={styles.panelButton} accessibilityRole="button">
              Share results
            </Text>
            <Text onPress={onClose} style={styles.panelButton} accessibilityRole="button">
              Close
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 4,
  },
  panelTitle: { fontSize: 14, fontWeight: '600', color: '#E5E7EB' },
  row: { fontSize: 13, color: '#E5E7EB', fontVariant: ['tabular-nums'] },
  verdict: { fontSize: 13, color: '#E5E7EB', marginTop: 4 },
  panelButtons: { flexDirection: 'row', gap: 16, marginTop: 6 },
  panelButton: { fontSize: 14, fontWeight: '600', color: '#38BDF8', paddingVertical: 6 },
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
