/**
 * Turf War element ground rings (Divecore step (c), 2026-10-22): a looping twin ring under every element-tagged tower,
 * hero tower and the helper, in the element's colour. Display only — no rules, saves or taps. Art: five baked sheets
 * (`ring<element>/status`, a 64x32 ring in a 64 art px cell, 8 frames @ 8 fps) made in PixelLab, see
 * `art-src/pixellab/fx.turf-ring.streetwear`. The Archer (no element) gets none.
 * Each ring loops on its own Reanimated clock on the UI thread — never inside the sim `<Svg>`. Effects Quality: Full = all
 * loop, Minimal = every other ring loops (the rest hold a still frame), Off or Motion Off = a still frame; Reduce Motion =
 * half speed. The layer sits under the units' `<Svg>`, so towers draw on top; the helper's ring is a sibling overlay.
 */
import { Image as ExpoImage } from 'expo-image';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { SHEET } from '@/art/art';
import { useFxQuality } from '@/play/fx-quality';
import { PLAY_SHEETS } from '@/play/generated-play-sheets';
import type { Element } from '@/play/kits';
import { pixelRenderStyle } from '@/play/pixel-theme';
import { usePlayMotion } from '@/play/play-motion';
import { playSheetArt } from '@/play/sheet-sprite';
import { STREETWEAR_META } from '@/play/skin';
import { ambientShare } from '@/play/turf-ambient-layout';

/** The baked board is 512 art px across (same as `turf-fx-strip.tsx`). */
const BOARD_ART_PX = 512;
/** The ring sheet's cell in art px (the 64x32 ring sits in the centre band). */
export const RING_CELL_PX = 64;
/** Ring size per tower level (1-3), as a multiple of the cell: the ring is about 0.73 of the tower's drawn box. */
export const RING_LEVEL_SCALE = [0.875, 1.06, 1.25] as const;
/** A hero tower is drawn at about 16 x 1.25 units; the helper smaller. */
export const RING_HERO_SCALE = 1.25;
export const RING_HELPER_SCALE = 1.1;

export type TurfRingSpec = { id: string; x: number; y: number; element: Element; scale: number };

export function ringFx(element: Element): string {
  return `ring${element}/status`;
}

function ringSheetKey(element: Element): string | undefined {
  const [el, beat] = ringFx(element).split('/');
  return (SHEET.fx as Record<string, Record<string, string> | undefined>)[el]?.[beat];
}

/** The ring's box edge on a board `boardSide` px across, in px (native art px x scale x the board scale). */
export function ringEdgePx(boardSide: number, scale: number): number {
  return (RING_CELL_PX * scale * boardSide) / BOARD_ART_PX;
}

/** One ring filling its (square) parent: whole frames slid on the UI thread by a share of the sheet. */
export const TurfRingFill = memo(function TurfRingFill({ element, animate, speed = 1, still = 0 }: { element: Element; animate: boolean; speed?: number; still?: number }) {
  const sheetKey = ringSheetKey(element);
  const meta = (STREETWEAR_META.fx as Record<string, { frames: number; fps: number } | undefined>)[ringFx(element)];
  const sheet = sheetKey ? PLAY_SHEETS[sheetKey] : undefined;
  const source = sheetKey ? playSheetArt(sheetKey) : undefined;
  const n = meta?.frames ?? 0;
  const t = useSharedValue(still);
  useEffect(() => {
    cancelAnimation(t);
    if (n < 2 || !meta || !animate) {
      t.value = still;
      return;
    }
    t.value = 0;
    t.value = withRepeat(withTiming(n, { duration: (n * 1000) / (meta.fps * speed), easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [t, n, meta, animate, speed, still]);
  const rects = sheet ? Array.from({ length: n }, (_, i) => sheet.frames[`frame_${String(i).padStart(3, '0')}`]) : [];
  const xs = rects.map((r) => r?.x ?? 0);
  const ys = rects.map((r) => r?.y ?? 0);
  const sheetW = sheet?.sheetW ?? 1;
  const sheetH = sheet?.sheetH ?? 1;
  const slide = useAnimatedStyle(() => {
    const i = Math.min(n - 1, Math.max(0, Math.floor(t.value)));
    return { transform: [{ translateX: `${-((xs[i] ?? 0) / sheetW) * 100}%`}, { translateY: `${-((ys[i] ?? 0) / sheetH) * 100}%` }] };
  }, [n, sheetW, sheetH, element]);
  const cell = rects[0]?.w ?? 1;
  if (!sheet || !source || !meta || n === 0) return null;
  return (
    <View pointerEvents="none" style={styles.clip}>
      <Animated.View style={[styles.abs, { left: 0, top: 0, width: `${(sheetW / cell) * 100}%`, height: `${(sheetH / cell) * 100}%` }, slide]}>
        <ExpoImage source={source} contentFit="fill" transition={0} style={{ ...pixelRenderStyle, width: '100%', height: '100%' }} />
      </Animated.View>
    </View>
  );
});

/** A small stable number from a ring id. */
function ringHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h;
}

type TurfGroundRingsProps = { boardSide: number; rings: readonly TurfRingSpec[] };

/** The static rings under towers and hero towers (the list changes only on build / sell, never per sim tick). */
export const TurfGroundRings = memo(function TurfGroundRings({ boardSide, rings }: TurfGroundRingsProps) {
  const quality = useFxQuality();
  const motion = usePlayMotion();
  const share = ambientShare(quality);
  const animate = share.animate && !motion.cosmeticsStill;
  const speed = motion.vestibularSafe ? 0.5 : 1;
  const unit = boardSide / 100;
  return (
    <View pointerEvents="none" style={styles.fill}>
      {rings.map((r) => {
        const edge = ringEdgePx(boardSide, r.scale);
        // Per-ring, not per-index: selling a tower must not make the others jump (still frame, Minimal's every-other).
        const h = ringHash(r.id);
        return (
          <View key={r.id} pointerEvents="none" style={[styles.abs, { left: r.x * unit - edge / 2, top: r.y * unit - edge / 2, width: edge, height: edge }]}>
            <TurfRingFill key={r.element} element={r.element} animate={animate && !(share.everyOther && h % 2 === 1)} speed={speed} still={h % 8} />
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  abs: { position: 'absolute' },
  clip: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
