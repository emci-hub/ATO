/**
 * Shared motion tokens (ATO-BUILD §1.3). Every animated primitive imports its
 * timings, easings and haptics from here, so the app moves one way.
 *
 * Reduce Motion is "gentle, never still" (§1.4): the primitives branch on
 * `useMotionReduced` and keep BREATH; haptics and information cues stay.
 */
import * as Haptics from 'expo-haptics';
import { Easing } from 'react-native-reanimated';

export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
/** The "pop": overshoots a little, then settles. */
export const EASE_BACK = Easing.bezier(0.34, 1.56, 0.64, 1);
export const UI_IN = Easing.out(Easing.cubic);
export const UI_OUT = Easing.in(Easing.quad);

export const SPRING_POP = { damping: 12, stiffness: 220 } as const;

/** Durations in ms. Anything that blocks input is `BLOCKING_MAX_MS` or less. */
export const DUR = {
  micro: 100,
  small: 220,
  beat: 500,
  scene: 400,
} as const;
export const BLOCKING_MAX_MS = 900;

export const ENTER = {
  duration: 500,
  translateY: 16,
  scaleFrom: 0.98,
  opacityFrom: 0,
  staggerMs: 80,
} as const;

export const PRESS = {
  scaleDown: 0.94,
  downMs: 90,
} as const;

export const PLUS_POP = {
  risePt: 34,
  durationMs: 1000,
} as const;

export const SHEEN = {
  durationMs: 2600,
  /** The hero's gold key word sweeps slower (PHASE-08). */
  heroMs: 3000,
  opacity: 0.35,
} as const;

export const LIVING_BG = {
  blobAMs: 9000,
  blobBMs: 11000,
  translateA: 40,
  translateB: -30,
  scale: 1.1,
} as const;

/** The Reduce Motion "alive" fallback: opacity .85 ↔ 1 over 8 s (4 s each way). */
export const BREATH = {
  low: 0.85,
  high: 1,
  cycleMs: 8000,
} as const;

/** Gold: a trait that has settled firmly, and "I tried it". */
export const MOTION_GOLD = '#F9C22B';

/** Pixel layers move in whole art pixels (1 art px = 2 pt). */
export function pixelSnap(x: number): number {
  'worklet';
  return Math.round(x / 2) * 2;
}

/**
 * One haptics map. Each call swallows its own error (a phone without a haptic
 * engine must never break a tap).
 */
export const haptic = {
  /** press / select */
  press: () => void Haptics.selectionAsync().catch(() => {}),
  /** commit */
  commit: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  /** success: step done, stat up (once per beat), "I tried it" */
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  /** reveal swap / emblem */
  reveal: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  /** stamp / d20 crit */
  stamp: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  /** d20 fail */
  fail: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
} as const;
