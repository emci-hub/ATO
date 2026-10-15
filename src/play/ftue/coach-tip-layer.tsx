/**
 * The coach tip: a pulsing ring on one control + a few words (Divecore Phase 4, emci 2026-10-14).
 *
 * Drawn by `GameScreen` over everything, `pointerEvents="none"` — it can not block a tap and, being
 * absolutely placed, can not resize a region. GameScreen's root listens for any touch (the touch
 * still reaches what was tapped) and calls `onSeen`, so "tap anywhere" dismisses it.
 * The ring breathes slowly; with Reduce Motion it breathes slower and smaller — never still.
 */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  FadeIn,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { tipPlacement, type CoachTipDef, type Rect } from '@/play/ftue/coach-tips';
import { measureTipAnchor } from '@/play/ftue/tip-anchors';
import { NEON } from '@/play/neon-viper';
import { noticeReduceMotion } from '@/play/notify/notify';
import { STREET_FONT, useStreetFonts } from '@/play/street-ui';

const RING_PAD = 6;
const BUBBLE_H = 40;
const BUBBLE_MAX_W = 260;
const REMEASURE_MS = 400;

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a == null || b == null) return a === b;
  return Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
}

export function CoachTipLayer({ tip, onShown }: { tip: CoachTipDef; onShown?: (shown: boolean) => void }) {
  useStreetFonts();
  const reduced = noticeReduceMotion();
  const [rect, setRect] = useState<Rect | null>(null);
  const [layer, setLayer] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const layerRef = useRef<View>(null);
  const last = useRef<Rect | null>(null);

  // Measure now and keep following the control (the room's camera can drift the egg a little).
  useEffect(() => {
    let live = true;
    const run = () =>
      measureTipAnchor(tip.anchor, (r) => {
        if (!live || sameRect(last.current, r)) return;
        last.current = r;
        setRect(r);
      });
    run();
    const timer = setInterval(run, REMEASURE_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [tip.anchor]);

  useEffect(() => {
    // iOS ignores live regions; Android reads the one on the bubble.
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(tip.text);
  }, [tip.id, tip.text]);

  const onLayout = (e: LayoutChangeEvent) => {
    layerRef.current?.measureInWindow((x, y, width, height) => setLayer({ x, y, width, height }));
    void e;
  };

  // Ring: slow breathe. Reduce Motion = longer, smaller, still moving.
  const t = useSharedValue(0);
  useEffect(() => {
    const ms = reduced ? 2400 : 1400;
    t.value = 0;
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: ms, reduceMotion: ReduceMotion.Never }),
        withTiming(0, { duration: ms, reduceMotion: ReduceMotion.Never }),
      ),
      -1,
    );
    return () => cancelAnimation(t);
  }, [reduced, t]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + 0.45 * t.value,
    transform: [{ scale: 1 + (reduced ? 0.03 : 0.08) * t.value }],
  }));

  // A tip only counts as seen once it is actually on screen (not null, not in another room).
  const visible =
    rect != null &&
    layer != null &&
    rect.x >= layer.x &&
    rect.y >= layer.y &&
    rect.x + rect.width <= layer.x + layer.width &&
    rect.y + rect.height <= layer.y + layer.height;
  useEffect(() => {
    onShown?.(visible);
    return () => onShown?.(false);
  }, [visible, onShown]);

  let ring: React.ReactNode = null;
  let bubble: React.ReactNode = null;
  if (rect && layer && visible) {
    const local: Rect = { x: rect.x - layer.x, y: rect.y - layer.y, width: rect.width, height: rect.height };
    const bubbleW = Math.min(BUBBLE_MAX_W, layer.width - 16);
    const place = tipPlacement(local, layer, bubbleW, BUBBLE_H);
    ring = (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            left: local.x - RING_PAD,
            top: local.y - RING_PAD,
            width: local.width + RING_PAD * 2,
            height: local.height + RING_PAD * 2,
          },
          ringStyle,
        ]}
      />
    );
    bubble = (
      <Animated.View
        entering={FadeIn.duration(reduced ? 240 : 180).reduceMotion(ReduceMotion.Never)}
        pointerEvents="none"
        accessibilityLiveRegion="polite"
        style={[styles.bubble, { left: place.left, top: place.top, width: bubbleW, height: BUBBLE_H }]}>
        <Text style={styles.text} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {tip.text}
        </Text>
      </Animated.View>
    );
  }

  return (
    <View ref={layerRef} pointerEvents="none" onLayout={onLayout} style={StyleSheet.absoluteFill}>
      {ring}
      {bubble}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderRadius: 14, borderWidth: 3, borderColor: NEON.cyan },
  bubble: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NEON.cyanBorder,
    backgroundColor: NEON.panel,
  },
  text: { fontFamily: STREET_FONT.bold, fontSize: 15, color: NEON.textPrimary },
});
