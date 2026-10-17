/**
 * Turf War combat-effects layer (step T5, 2026-10-17): the one-shot hit flash, the death pop and the leak pulse,
 * plus the board shake hook. It sits ABOVE the units `<Svg>` and is NOT inside it: each effect runs once on its own
 * Reanimated clock on the UI thread, and only this layer re-renders when one starts or ends (never the 100 ms board).
 * `pointerEvents none`, fills the board, draws nothing outside it. Rules + timings: `turf-combat-fx-rules.ts`.
 * The caller decides WHETHER an effect plays (`combatFxFlags`: Effects Quality + Reduce Motion / Motion Off).
 */
import { Image as ExpoImage } from 'expo-image';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { SHEET } from '@/art/art';
import { PLAY_SHEETS } from '@/play/generated-play-sheets';
import { pixelRenderStyle } from '@/play/pixel-theme';
import { ClipImage, playSheetArt } from '@/play/sheet-sprite';
import { STREETWEAR_META, type ClipDrawable } from '@/play/skin';
import {
  DEATH_POP_FX,
  DEATH_POP_MS,
  HIT_FLASH_MS,
  LEAK_PULSE_MS,
  LEAK_SHAKE_MS,
  LEAK_SHAKE_PT,
  MAX_FLASHES,
} from '@/play/turf-combat-fx-rules';

/** Board units (0..100) box: top-left + square edge, the same box the creep sprite was drawn in. */
export type FxBox = { x: number; y: number; size: number };

export type TurfCombatFxHandle = {
  /** White tint over one creep sprite for HIT_FLASH_MS. */
  flash: (drawable: ClipDrawable, box: FxBox) => void;
  /** The death pop centred on a creep's body (board units). */
  pop: (x: number, y: number) => void;
  /** Red ring at the path end (board units). */
  leak: (x: number, y: number) => void;
  /** Drop everything (restage / leave). */
  clear: () => void;
};

type Item =
  | { kind: 'flash'; id: number; drawable: ClipDrawable; box: FxBox }
  | { kind: 'pop'; id: number; x: number; y: number }
  | { kind: 'leak'; id: number; x: number; y: number };

const LIFE: Record<Item['kind'], number> = { flash: HIT_FLASH_MS, pop: DEATH_POP_MS, leak: LEAK_PULSE_MS };
/** The pop is drawn at 1.4× its native pixels (picked at stop 1); the board is 512 art px across. */
const POP_SCALE = 1.4;
const TURF_BOARD_ART_PX = 512;
const LEAK_RED = '#EF4444';

function popSheetKey(): string | undefined {
  const [el, beat] = DEATH_POP_FX.split('/');
  return (SHEET.fx as Record<string, Record<string, string> | undefined>)[el]?.[beat];
}

function Flash({ item, unit }: { item: Extract<Item, { kind: 'flash' }>; unit: number }) {
  const o = useSharedValue(0.85);
  useEffect(() => {
    o.value = withTiming(0, { duration: HIT_FLASH_MS, easing: Easing.in(Easing.quad) });
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  const { box } = item;
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left: box.x * unit, top: box.y * unit, width: box.size * unit, height: box.size * unit }, style]}>
      <ClipImage drawable={item.drawable} tintColor="#FFFFFF" />
    </Animated.View>
  );
}

/** The pop strip, played once: whole frames only, frame rects read from the packed atlas. */
function Pop({ item, unit }: { item: Extract<Item, { kind: 'pop' }>; unit: number }) {
  const sheetKey = popSheetKey();
  const meta = STREETWEAR_META.fx[DEATH_POP_FX];
  const sheet = sheetKey ? PLAY_SHEETS[sheetKey] : undefined;
  const source = sheetKey ? playSheetArt(sheetKey) : undefined;
  const n = meta?.frames ?? 0;
  const t = useSharedValue(0);
  useEffect(() => {
    if (n > 0) t.value = withTiming(n, { duration: DEATH_POP_MS, easing: Easing.linear });
  }, [t, n]);
  const rects = sheet ? Array.from({ length: n }, (_, i) => sheet.frames[`frame_${String(i).padStart(3, '0')}`]) : [];
  const xs = rects.map((r) => r?.x ?? 0);
  const ys = rects.map((r) => r?.y ?? 0);
  const cell = rects[0]?.w ?? 1;
  // Native art pixels × the board scale (512 art px across the board) × POP_SCALE, as in the stop-1 samples.
  const edge = (meta?.cell ?? cell) * POP_SCALE * ((unit * 100) / TURF_BOARD_ART_PX);
  const k = edge / cell;
  const slide = useAnimatedStyle(() => {
    const i = Math.min(n - 1, Math.max(0, Math.floor(t.value)));
    return { transform: [{ translateX: -(xs[i] ?? 0) * k }, { translateY: -(ys[i] ?? 0) * k }] };
  });
  if (!sheet || !source || !meta || n === 0) return null;
  const left = item.x * unit - meta.anchorX * edge;
  const top = item.y * unit - meta.anchorY * edge;
  return (
    <View pointerEvents="none" style={[styles.abs, { left, top, width: edge, height: edge, overflow: 'hidden' }]}>
      <Animated.View style={[styles.abs, { left: 0, top: 0, width: sheet.sheetW * k, height: sheet.sheetH * k }, slide]}>
        <ExpoImage source={source} contentFit="fill" transition={0} style={{ ...pixelRenderStyle, width: '100%', height: '100%' }} />
      </Animated.View>
    </View>
  );
}

/** A flat red ring (an ellipse on the ground) growing out of the exit and fading. Never full-screen. */
function Leak({ item, unit }: { item: Extract<Item, { kind: 'leak' }>; unit: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: LEAK_PULSE_MS, easing: Easing.out(Easing.quad) });
  }, [p]);
  const r = 12 * unit;
  const style = useAnimatedStyle(() => ({ opacity: 1 - p.value * p.value, transform: [{ scaleX: 0.3 + 0.7 * p.value }, { scaleY: (0.3 + 0.7 * p.value) * 0.6 }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left: item.x * unit - r, top: item.y * unit - r, width: 2 * r, height: 2 * r, borderRadius: r, borderWidth: 4, borderColor: LEAK_RED, backgroundColor: 'rgba(239,68,68,0.22)' }, style]} />
  );
}

export const TurfCombatFx = memo(
  forwardRef<TurfCombatFxHandle, { boardSide: number }>(function TurfCombatFx({ boardSide }, ref) {
    const [items, setItems] = useState<Item[]>([]);
    const seq = useRef(0);
    const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
    const add = useCallback((item: Item) => {
      setItems((prev) => {
        const next = [...prev, item];
        if (item.kind !== 'flash') return next;
        const flashes = next.filter((i) => i.kind === 'flash');
        if (flashes.length <= MAX_FLASHES) return next;
        const drop = new Set(flashes.slice(0, flashes.length - MAX_FLASHES).map((i) => i.id));
        return next.filter((i) => !drop.has(i.id));
      });
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }, LIFE[item.kind] + 40);
      timers.current.add(timer);
    }, []);
    useImperativeHandle(
      ref,
      () => ({
        flash: (drawable, box) => add({ kind: 'flash', id: ++seq.current, drawable, box }),
        pop: (x, y) => add({ kind: 'pop', id: ++seq.current, x, y }),
        leak: (x, y) => add({ kind: 'leak', id: ++seq.current, x, y }),
        clear: () => {
          for (const t of timers.current) clearTimeout(t);
          timers.current.clear();
          setItems([]);
        },
      }),
      [add],
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
        {items.map((item) =>
          item.kind === 'flash' ? <Flash key={item.id} item={item} unit={unit} /> : item.kind === 'pop' ? <Pop key={item.id} item={item} unit={unit} /> : <Leak key={item.id} item={item} unit={unit} />,
        )}
      </View>
    );
  }),
);

/** Board shake for the leak: a few short sideways steps on the board container (stage content only — the regions
 * around the stage never move). The caller only calls `shake()` when `combatFxFlags(...).shake` is true. */
export function useBoardShake() {
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: dx.value }, { translateY: dy.value }] }));
  const shake = useCallback(() => {
    const s = LEAK_SHAKE_MS / 4;
    const a = LEAK_SHAKE_PT;
    dx.value = withSequence(withTiming(a, { duration: s }), withTiming(-a, { duration: s }), withTiming(a / 2, { duration: s }), withTiming(0, { duration: s }));
    dy.value = withSequence(withTiming(-a / 2, { duration: s }), withTiming(a / 2, { duration: s }), withTiming(0, { duration: 2 * s }));
  }, [dx, dy]);
  return { style, shake };
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  abs: { position: 'absolute' },
});
