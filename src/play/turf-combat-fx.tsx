/**
 * Turf War combat-effects layer (step T5, 2026-10-17): the one-shot hit flash, the death pop and the leak pulse,
 * plus the board shake hook. It sits ABOVE the units `<Svg>` and is NOT inside it: each effect runs once on its own
 * Reanimated clock on the UI thread, and only this layer re-renders when one starts or ends (never the 100 ms board).
 * `pointerEvents none`, fills the board, draws nothing outside it. Rules + timings: `turf-combat-fx-rules.ts`.
 * The caller decides WHETHER an effect plays (`combatFxFlags`: Effects Quality + Reduce Motion / Motion Off).
 *
 * T6 (2026-10-17) adds the boss effects to the same layer: the entrance sigil at the spawn, the ability telegraphs
 * (one-shot wind-ups that then hold still until the ability goes off), the boss death blast and the bigger boss
 * flash. Rules + timings: `turf-boss-fx-rules.ts` (`bossFxFlags` decides what plays).
 *
 * T7 (2026-10-17) adds the polish beats to the same layer: the wave-start portal, the wave-clear close at the exit, the
 * win sparks over the towers and the leak replay (views in `turf-beat-fx.tsx`, rules in `turf-beat-fx-rules.ts`,
 * `beatFxFlags` decides what plays). The exit ring has a still version for Reduce Motion / Motion Off (fade only).
 */
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { ClipImage } from '@/play/sheet-sprite';
import { type ClipDrawable } from '@/play/skin';
import {
  BOSS_DEATH_MS,
  BOSS_DEATH_SHAKE_MS,
  BOSS_DEATH_SHAKE_PT,
  BOSS_DEATH_SOFT_FROM,
  BOSS_FLASH_MS,
  BOSS_FLASH_OPACITY,
  BOSS_FX,
  BOSS_SUMMON_FADE_MS,
  BOSS_SUMMON_MS,
  BOSS_TELEGRAPHS,
  ENRAGE_WINDUP_MS,
  TELEGRAPH_FADE_MS,
  TELEGRAPH_MIN_MS,
  type BossAbility,
} from '@/play/turf-boss-fx-rules';
import {
  DEATH_POP_FX,
  DEATH_POP_MS,
  HIT_FLASH_MS,
  LEAK_PULSE_MS,
  LEAK_SHAKE_MS,
  LEAK_SHAKE_PT,
  MAX_FLASHES,
} from '@/play/turf-combat-fx-rules';
import { LeakReplay, PortalBeat, SparksBeat, BEAT_STILL_FADE_MS } from '@/play/turf-beat-fx';
import { LOSE_BEAT_MS, PORTAL_MS, WAVE_CLEAR_MS, WIN_SPARK_MS, WIN_SPARK_STAGGER_MS } from '@/play/turf-beat-fx-rules';
import { Strip } from '@/play/turf-fx-strip';

/** Board units (0..100) box: top-left + square edge, the same box the creep sprite was drawn in. */
export type FxBox = { x: number; y: number; size: number };

export type TurfCombatFxHandle = {
  /** White tint over one creep sprite for HIT_FLASH_MS (a boss: brighter, BOSS_FLASH_MS). */
  flash: (drawable: ClipDrawable, box: FxBox, boss?: boolean) => void;
  /** The death pop centred on a creep's body (board units). */
  pop: (x: number, y: number) => void;
  /** Red ring at the path end (board units). `still` (Reduce Motion / Motion Off): full size, fade only. */
  leak: (x: number, y: number, still?: boolean) => void;
  /** T6: the entrance sigil at the spawn (board units, the sigil's ground point). */
  summon: (x: number, y: number, mode: 'anim' | 'still') => void;
  /** T6: the boss death blast centred on the boss's body (board units). */
  bossDeath: (x: number, y: number, mode: 'full' | 'soft') => void;
  /** T6: a boss ability telegraph (once per key until it ends). `windUpMs` = real ms until the ability goes off. */
  telegraph: (key: string, ability: BossAbility, x: number, y: number, radiusUnits: number, windUpMs: number, mode: 'anim' | 'still') => void;
  /** T6: the ability went off (or can't any more): fade the telegraph — never before it showed TELEGRAPH_MIN_MS. */
  endTelegraph: (key: string) => void;
  /** T7: the wave-start portal at the path start (`close` false) or the wave-clear close at the exit (`close` true). */
  portal: (x: number, y: number, mode: 'anim' | 'still', close: boolean) => void;
  /** T7: win sparks over each point (board units), one after another (WIN_SPARK_STAGGER_MS apart). */
  sparks: (points: readonly { x: number; y: number }[], mode: 'anim' | 'still') => void;
  /** T7: the leak replay — the leaker's ghost walks `points` (board units, ending at the exit), then the exit ring. */
  leakReplay: (points: readonly { x: number; y: number }[], drawable: ClipDrawable | null, size: number, mode: 'anim' | 'still') => void;
  /** Drop everything (restage / leave). */
  clear: () => void;
};

type Item =
  | { kind: 'flash'; id: number; drawable: ClipDrawable; box: FxBox; boss: boolean }
  | { kind: 'pop'; id: number; x: number; y: number }
  | { kind: 'leak'; id: number; x: number; y: number; still: boolean }
  | { kind: 'portal'; id: number; x: number; y: number; still: boolean; close: boolean }
  | { kind: 'sparks'; id: number; x: number; y: number; still: boolean }
  | { kind: 'replay'; id: number; points: readonly { x: number; y: number }[]; drawable: ClipDrawable | null; size: number; still: boolean }
  | { kind: 'summon'; id: number; x: number; y: number; still: boolean }
  | { kind: 'bossDeath'; id: number; x: number; y: number; soft: boolean }
  | {
      kind: 'telegraph';
      id: number;
      key: string;
      ability: BossAbility;
      x: number;
      y: number;
      radius: number;
      windUpMs: number;
      still: boolean;
      bornAt: number;
      ending: boolean;
    };

/** Auto-removal per kind (ms); a telegraph has none — `endTelegraph` (or `clear`) removes it. */
const LIFE: Record<Exclude<Item['kind'], 'telegraph'>, number> = {
  flash: HIT_FLASH_MS,
  pop: DEATH_POP_MS,
  leak: LEAK_PULSE_MS,
  summon: BOSS_SUMMON_MS + BOSS_SUMMON_FADE_MS,
  bossDeath: BOSS_DEATH_MS,
  portal: PORTAL_MS + BEAT_STILL_FADE_MS,
  sparks: WIN_SPARK_MS + BEAT_STILL_FADE_MS,
  replay: LOSE_BEAT_MS,
};
/** The pop is drawn at 1.4× its native pixels (picked at stop 1); the board is 512 art px across. */
const POP_SCALE = 1.4;
/** The T6 boss sheets are drawn 1:1 on the 512 art px board (as in the stop-1 samples). */
const BOSS_SCALE = 1;
const LEAK_RED = '#EF4444';

function Flash({ item, unit }: { item: Extract<Item, { kind: 'flash' }>; unit: number }) {
  const o = useSharedValue(item.boss ? BOSS_FLASH_OPACITY : 0.85);
  useEffect(() => {
    o.value = withTiming(0, { duration: item.boss ? BOSS_FLASH_MS : HIT_FLASH_MS, easing: Easing.in(Easing.quad) });
  }, [o, item.boss]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  const { box } = item;
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left: box.x * unit, top: box.y * unit, width: box.size * unit, height: box.size * unit }, style]}>
      <ClipImage drawable={item.drawable} tintColor="#FFFFFF" />
    </Animated.View>
  );
}

/** A flat red ring (an ellipse on the ground) growing out of the exit and fading. Never full-screen. */
function Leak({ item, unit }: { item: Extract<Item, { kind: 'leak' }>; unit: number }) {
  // Still (T7 motion audit): the ring shows at full size and only fades.
  const p = useSharedValue(item.still ? 1 : 0);
  const fade = useSharedValue(1);
  useEffect(() => {
    if (item.still) fade.value = withTiming(0, { duration: LEAK_PULSE_MS, easing: Easing.in(Easing.quad) });
    else p.value = withTiming(1, { duration: LEAK_PULSE_MS, easing: Easing.out(Easing.quad) });
  }, [p, fade, item.still]);
  const r = 12 * unit;
  const style = useAnimatedStyle(() => ({ opacity: item.still ? fade.value : 1 - p.value * p.value, transform: [{ scaleX: 0.3 + 0.7 * p.value }, { scaleY: (0.3 + 0.7 * p.value) * 0.6 }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left: item.x * unit - r, top: item.y * unit - r, width: 2 * r, height: 2 * r, borderRadius: r, borderWidth: 4, borderColor: LEAK_RED, backgroundColor: 'rgba(239,68,68,0.22)' }, style]} />
  );
}

/** Hex colour + alpha → rgba(). */
function tint(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * A Bound Boss skill telegraph around its pad: the ring marks the real skill radius (board units, the same circle
 * the engine tests). One wind-up over `windUpMs` (none when `still`), then it holds until the skill goes off.
 *   fill  (burst)      — an amber disc grows to the ring.
 *   close (slow_pulse) — a cyan ring closes in from 1.4× to the radius.
 *   lock  (focus_beam) — a magenta lock-on ring with four ticks narrows on the pad.
 */
function SkillTelegraph({ item, unit }: { item: Extract<Item, { kind: 'telegraph' }>; unit: number }) {
  const def = BOSS_TELEGRAPHS[item.ability];
  const p = useSharedValue(item.still ? 1 : 0);
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withTiming(1, { duration: 120 });
    if (!item.still) p.value = withTiming(1, { duration: Math.max(0, item.windUpMs), easing: Easing.in(Easing.quad) });
  }, [p, o, item.still, item.windUpMs]);
  useEffect(() => {
    if (item.ending) o.value = withTiming(0, { duration: TELEGRAPH_FADE_MS });
  }, [item.ending, o]);
  const fade = useAnimatedStyle(() => ({ opacity: o.value }));
  const grow = useAnimatedStyle(() => ({ transform: [{ scale: Math.max(0.01, p.value) }] }));
  const close = useAnimatedStyle(() => ({ transform: [{ scale: 1.4 - 0.4 * p.value }], opacity: 0.5 + 0.5 * p.value }));
  const lock = useAnimatedStyle(() => ({ transform: [{ scale: 1.8 - 0.8 * p.value }] }));
  const r = item.radius * unit;
  const box = { left: item.x * unit - r, top: item.y * unit - r, width: 2 * r, height: 2 * r };
  const lockR = Math.min(r, 9 * unit);
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, box, fade]}>
      {def.look === 'fill' ? (
        <>
          <View style={[styles.fill, { borderRadius: r, borderWidth: 2, borderColor: tint(def.color, 0.8) }]} />
          <Animated.View style={[styles.fill, { borderRadius: r, borderWidth: 3, borderColor: def.color, backgroundColor: tint(def.color, 0.28) }, grow]} />
        </>
      ) : def.look === 'close' ? (
        <Animated.View style={[styles.fill, { borderRadius: r, borderWidth: 3, borderColor: def.color, backgroundColor: tint(def.color, 0.14) }, close]} />
      ) : (
        <Animated.View style={[styles.abs, { left: r - lockR, top: r - lockR, width: 2 * lockR, height: 2 * lockR }, lock]}>
          <View style={[styles.fill, { borderRadius: lockR, borderWidth: 2, borderColor: def.color }]} />
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.abs,
                { backgroundColor: def.color },
                i % 2 === 0
                  ? { left: lockR - 1.5, top: i === 0 ? -6 : 2 * lockR - 2, width: 3, height: 8 }
                  : { top: lockR - 1.5, left: i === 1 ? 2 * lockR - 2 : -6, width: 8, height: 3 },
              ]}
            />
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}

function Telegraph({ item, unit }: { item: Extract<Item, { kind: 'telegraph' }>; unit: number }) {
  if (BOSS_TELEGRAPHS[item.ability].look === 'sigil') {
    // The enrage sigil charges once (ENRAGE_WINDUP_MS), then holds its last frame until the enrage fires.
    return <Strip fx={BOSS_FX.enrage} x={item.x} y={item.y} unit={unit} scale={BOSS_SCALE} ms={ENRAGE_WINDUP_MS} holdOpen ending={item.ending} still={item.still} />;
  }
  return <SkillTelegraph item={item} unit={unit} />;
}

function ItemView({ item, unit }: { item: Item; unit: number }) {
  switch (item.kind) {
    case 'flash':
      return <Flash item={item} unit={unit} />;
    case 'pop':
      return <Strip fx={DEATH_POP_FX} x={item.x} y={item.y} unit={unit} scale={POP_SCALE} ms={DEATH_POP_MS} />;
    case 'leak':
      return <Leak item={item} unit={unit} />;
    case 'summon':
      return <Strip fx={BOSS_FX.summon} x={item.x} y={item.y} unit={unit} scale={BOSS_SCALE} ms={BOSS_SUMMON_MS} fadeMs={BOSS_SUMMON_FADE_MS} still={item.still} />;
    case 'bossDeath':
      return <Strip fx={BOSS_FX.death} x={item.x} y={item.y} unit={unit} scale={BOSS_SCALE} ms={BOSS_DEATH_MS} from={item.soft ? BOSS_DEATH_SOFT_FROM : 0} />;
    case 'telegraph':
      return <Telegraph item={item} unit={unit} />;
    case 'portal':
      return <PortalBeat x={item.x} y={item.y} unit={unit} close={item.close} still={item.still} />;
    case 'sparks':
      return <SparksBeat x={item.x} y={item.y} unit={unit} still={item.still} />;
    case 'replay':
      return <LeakReplay points={item.points} drawable={item.drawable} size={item.size} unit={unit} still={item.still} />;
  }
}

export const TurfCombatFx = memo(
  forwardRef<TurfCombatFxHandle, { boardSide: number }>(function TurfCombatFx({ boardSide }, ref) {
    const [items, setItems] = useState<Item[]>([]);
    const seq = useRef(0);
    const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
    /** Live telegraphs by key → their item id + when they started (wall ms), so a second start is ignored and an end
     * waits (and ends only that item, never a newer one under the same key). */
    const telegraphs = useRef(new Map<string, { id: number; bornAt: number }>());
    const later = useCallback((ms: number, fn: () => void) => {
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        fn();
      }, ms);
      timers.current.add(timer);
    }, []);
    const add = useCallback(
      (item: Item) => {
        setItems((prev) => {
          const next = [...prev, item];
          if (item.kind !== 'flash') return next;
          const flashes = next.filter((i) => i.kind === 'flash');
          if (flashes.length <= MAX_FLASHES) return next;
          const drop = new Set(flashes.slice(0, flashes.length - MAX_FLASHES).map((i) => i.id));
          return next.filter((i) => !drop.has(i.id));
        });
        if (item.kind === 'telegraph') return;
        const life =
          item.kind === 'flash' && item.boss ? BOSS_FLASH_MS : item.kind === 'portal' && item.close ? WAVE_CLEAR_MS + BEAT_STILL_FADE_MS : LIFE[item.kind];
        later(life + 40, () => setItems((prev) => prev.filter((i) => i.id !== item.id)));
      },
      [later],
    );
    useImperativeHandle(
      ref,
      () => ({
        flash: (drawable, box, boss = false) => add({ kind: 'flash', id: ++seq.current, drawable, box, boss }),
        pop: (x, y) => add({ kind: 'pop', id: ++seq.current, x, y }),
        leak: (x, y, still = false) => add({ kind: 'leak', id: ++seq.current, x, y, still }),
        summon: (x, y, mode) => add({ kind: 'summon', id: ++seq.current, x, y, still: mode === 'still' }),
        bossDeath: (x, y, mode) => add({ kind: 'bossDeath', id: ++seq.current, x, y, soft: mode === 'soft' }),
        telegraph: (key, ability, x, y, radiusUnits, windUpMs, mode) => {
          if (telegraphs.current.has(key)) return;
          const bornAt = Date.now();
          const id = ++seq.current;
          telegraphs.current.set(key, { id, bornAt });
          add({ kind: 'telegraph', id, key, ability, x, y, radius: radiusUnits, windUpMs, still: mode === 'still', bornAt, ending: false });
        },
        endTelegraph: (key) => {
          const live = telegraphs.current.get(key);
          if (live == null) return;
          telegraphs.current.delete(key);
          const { id, bornAt } = live;
          // A wind-up is never cut short: it shows at least TELEGRAPH_MIN_MS, then fades.
          const wait = Math.max(0, TELEGRAPH_MIN_MS - (Date.now() - bornAt));
          later(wait, () => {
            setItems((prev) => prev.map((i) => (i.id === id && i.kind === 'telegraph' ? { ...i, ending: true } : i)));
            later(TELEGRAPH_FADE_MS + 40, () => setItems((prev) => prev.filter((i) => i.id !== id)));
          });
        },
        portal: (x, y, mode, close) => add({ kind: 'portal', id: ++seq.current, x, y, still: mode === 'still', close }),
        sparks: (points, mode) =>
          points.forEach((pt, i) => later(i * WIN_SPARK_STAGGER_MS, () => add({ kind: 'sparks', id: ++seq.current, x: pt.x, y: pt.y, still: mode === 'still' }))),
        leakReplay: (points, drawable, size, mode) =>
          add({ kind: 'replay', id: ++seq.current, points, drawable, size, still: mode === 'still' }),
        clear: () => {
          for (const t of timers.current) clearTimeout(t);
          timers.current.clear();
          telegraphs.current.clear();
          setItems([]);
        },
      }),
      [add, later],
    );
    useEffect(
      () => () => {
        for (const t of timers.current) clearTimeout(t);
      },
      [],
    );
    const unit = boardSide / 100;
    return (
      <View pointerEvents="none" style={styles.fill}>
        {items.map((item) => (
          <ItemView key={item.id} item={item} unit={unit} />
        ))}
      </View>
    );
  }),
);

/** Board shake for the leak (and, T6, the boss death): a few short sideways steps on the board container (stage
 * content only — the regions around the stage never move). The caller only calls `shake()` when the effect flags
 * allow a shake (`combatFxFlags(...).shake` / `bossFxFlags(...).shake`). */
export function useBoardShake() {
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: dx.value }, { translateY: dy.value }] }));
  const shake = useCallback(
    (kind: 'leak' | 'bossDeath' = 'leak') => {
      const s = (kind === 'bossDeath' ? BOSS_DEATH_SHAKE_MS : LEAK_SHAKE_MS) / 4;
      const a = kind === 'bossDeath' ? BOSS_DEATH_SHAKE_PT : LEAK_SHAKE_PT;
      dx.value = withSequence(withTiming(a, { duration: s }), withTiming(-a, { duration: s }), withTiming(a / 2, { duration: s }), withTiming(0, { duration: s }));
      dy.value = withSequence(withTiming(-a / 2, { duration: s }), withTiming(a / 2, { duration: s }), withTiming(0, { duration: 2 * s }));
    },
    [dx, dy],
  );
  return { style, shake };
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  abs: { position: 'absolute' },
});
