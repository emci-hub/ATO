/**
 * One packed fx strip on the Turf War board (moved out of `turf-combat-fx.tsx` in T7, 2026-10-17, so the T5/T6 layer and
 * the T7 beats share it). A one-shot on its own Reanimated clock — never a loop, never inside the sim `<Svg>`.
 */
import { Image as ExpoImage } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { SHEET } from '@/art/art';
import { PLAY_SHEETS } from '@/play/generated-play-sheets';
import { pixelRenderStyle } from '@/play/pixel-theme';
import { playSheetArt } from '@/play/sheet-sprite';
import { STREETWEAR_META } from '@/play/skin';
import { TELEGRAPH_FADE_MS } from '@/play/turf-boss-fx-rules';

/** The baked board is 512 art px across. */
export const TURF_BOARD_ART_PX = 512;

export function fxSheetKey(fx: string): string | undefined {
  const [el, beat] = fx.split('/');
  return (SHEET.fx as Record<string, Record<string, string> | undefined>)[el]?.[beat];
}

/**
 * Whole frames only, frame rects read from the packed atlas. Plays `from`..last over `ms`, then (with `holdMs`) keeps the
 * last frame for that long, or (with `holdOpen`) until `ending`, then fades. `still` shows one frame (`stillFrame`, else
 * the last), fading in and out (the Reduce Motion version: no motion, no flash).
 */
export function Strip({
  fx,
  x,
  y,
  unit,
  scale,
  ms,
  from = 0,
  holdMs = 0,
  fadeMs = 0,
  holdOpen = false,
  ending = false,
  still = false,
  stillFrame,
}: {
  fx: string;
  x: number;
  y: number;
  unit: number;
  scale: number;
  ms: number;
  from?: number;
  holdMs?: number;
  fadeMs?: number;
  holdOpen?: boolean;
  ending?: boolean;
  still?: boolean;
  stillFrame?: number;
}) {
  const sheetKey = fxSheetKey(fx);
  const meta = STREETWEAR_META.fx[fx];
  const sheet = sheetKey ? PLAY_SHEETS[sheetKey] : undefined;
  const source = sheetKey ? playSheetArt(sheetKey) : undefined;
  const n = meta?.frames ?? 0;
  const last = Math.max(0, n - 1);
  const first = still ? Math.min(stillFrame ?? last, last) : Math.min(from, last);
  const t = useSharedValue(first);
  const o = useSharedValue(still ? 0 : 1);
  useEffect(() => {
    if (n === 0) return;
    if (still) {
      // Fade in, hold, fade out (a held telegraph fades out on `ending` below).
      o.value = holdOpen ? withTiming(1, { duration: 150 }) : withSequence(withTiming(1, { duration: 150 }), withDelay(Math.max(0, ms + holdMs - 150), withTiming(0, { duration: fadeMs })));
      return;
    }
    t.value = withTiming(n, { duration: ms * ((n - first) / n), easing: Easing.linear });
    if (!holdOpen && fadeMs > 0) o.value = withDelay(ms + holdMs, withTiming(0, { duration: fadeMs }));
  }, [t, o, n, first, ms, holdMs, fadeMs, holdOpen, still]);
  useEffect(() => {
    if (ending) o.value = withTiming(0, { duration: TELEGRAPH_FADE_MS });
  }, [ending, o]);
  const rects = sheet ? Array.from({ length: n }, (_, i) => sheet.frames[`frame_${String(i).padStart(3, '0')}`]) : [];
  const xs = rects.map((r) => r?.x ?? 0);
  const ys = rects.map((r) => r?.y ?? 0);
  const cell = rects[0]?.w ?? 1;
  // Native art pixels × the board scale (512 art px across the board) × scale, as in the stop-1 samples.
  const edge = (meta?.cell ?? cell) * scale * ((unit * 100) / TURF_BOARD_ART_PX);
  const k = edge / cell;
  const slide = useAnimatedStyle(() => {
    const i = Math.min(n - 1, Math.max(0, Math.floor(t.value)));
    return { transform: [{ translateX: -(xs[i] ?? 0) * k }, { translateY: -(ys[i] ?? 0) * k }] };
  });
  const fade = useAnimatedStyle(() => ({ opacity: o.value }));
  if (!sheet || !source || !meta || n === 0) return null;
  const left = x * unit - meta.anchorX * edge;
  const top = y * unit - meta.anchorY * edge;
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left, top, width: edge, height: edge, overflow: 'hidden' }, fade]}>
      <Animated.View style={[styles.abs, { left: 0, top: 0, width: sheet.sheetW * k, height: sheet.sheetH * k }, slide]}>
        <ExpoImage source={source} contentFit="fill" transition={0} style={{ ...pixelRenderStyle, width: '100%', height: '100%' }} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
});
