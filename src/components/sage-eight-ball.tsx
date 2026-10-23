import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Vibration, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppearance } from '@/lib/theme/context';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import {
  EIGHT_BALL_CALM_FLASHES,
  EIGHT_BALL_CALM_STEP_MS,
  EIGHT_BALL_COPY_REVIEWED,
  eightBallReelTiming,
  pickEightBallFlashes,
  rollEightBall,
} from '@/lib/sage-eight-ball';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * Original glazed orb — not Mattel's black ball / blue triangular window.
 * Kenney Shape Characters has a circle body, but that sprite is the pixel
 * companion, not an 8-ball, so this stays a tiny View stack instead.
 * Views (not SVG) so Sage's first paint does not parse react-native-svg.
 */
function SageOrb({
  size,
  spin,
  marked,
  thinking = false,
}: {
  size: number;
  spin: number;
  marked?: boolean;
  /** Reduce Motion only: a soft opacity pulse while the answer is picked. */
  thinking?: boolean;
}) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const rotate = useSharedValue(0);
  const nudge = useSharedValue(0);
  const pop = useSharedValue(1);
  const glow = useSharedValue(1);

  // Reduce Motion: no movement at all — the ball "thinks" by glowing softly.
  useEffect(() => {
    cancelAnimation(glow);
    if (reduceMotion && thinking) {
      glow.value = withRepeat(
        withSequence(withTiming(0.45, { duration: 350 }), withTiming(1, { duration: 350 })),
        -1,
        false,
      );
    } else {
      glow.value = withTiming(1, { duration: 150 });
    }
  }, [reduceMotion, thinking, glow]);

  // A turning circle barely reads, and since the polish pass the closed ball
  // is 26px (emci 2026-10-06: "what happened to its animation?"). So the shake
  // moves the ball side to side and pops it, scaled to its size; the turn
  // mostly shows on the 8.
  useEffect(() => {
    if (spin === 0 || reduceMotion) return;
    cancelAnimation(rotate);
    cancelAnimation(nudge);
    cancelAnimation(pop);
    rotate.value = 0;
    nudge.value = 0;
    pop.value = 1;
    const shift = Math.max(4, size * 0.22);
    rotate.value = withSequence(
      withTiming(28, { duration: 110 }),
      withTiming(-24, { duration: 130 }),
      withTiming(18, { duration: 130 }),
      withTiming(-10, { duration: 120 }),
      withTiming(0, { duration: 160 }),
    );
    nudge.value = withSequence(
      withTiming(shift, { duration: 90 }),
      withTiming(-shift, { duration: 110 }),
      withTiming(shift * 0.7, { duration: 110 }),
      withTiming(-shift * 0.4, { duration: 110 }),
      withTiming(0, { duration: 130 }),
    );
    pop.value = withSequence(withTiming(1.18, { duration: 160 }), withTiming(0.96, { duration: 220 }), withTiming(1, { duration: 270 }));
  }, [spin, reduceMotion, rotate, nudge, pop, size]);

  const motion = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ translateX: nudge.value }, { rotate: `${rotate.value}deg` }, { scale: pop.value }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, motion]}>
      <View
        style={[
          styles.orb,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.accentFill,
            borderColor: theme.text,
          },
        ]}>
        <View
          style={[
            styles.orbShine,
            {
              left: size * 0.16,
              top: size * 0.16,
              width: size * 0.44,
              height: size * 0.26,
              borderRadius: size / 2,
              backgroundColor: theme.onAccent,
            },
          ]}
        />
        {marked ? (
          <ThemedText
            style={[
              styles.orbGlyph,
              { color: theme.onAccent, fontSize: Math.round(size * 0.44) },
            ]}>
            8
          </ThemedText>
        ) : null}
      </View>
    </Animated.View>
  );
}

/** One line of the reel. Two lines of answer text fit, with room. */
const REEL_ROW_H = 64;
/** How much of the rows above and below shows through the window. */
const REEL_PEEK = 18;
const REEL_WINDOW_H = REEL_ROW_H + REEL_PEEK * 2;
/** Stepped fade over the peek (no gradient package: bands of the card colour). */
const REEL_FADE_STEPS = [0.92, 0.7, 0.45, 0.2] as const;

/** Same short buzz the Reveal card uses (reveal-card.tsx); no extra package. */
function oneLightHaptic() {
  if (Platform.OS === 'web') return;
  Vibration.vibrate(10);
}

/**
 * The slot reel: `strip` stacked in a framed window that shows a sliver of the
 * rows above and below, faded at the edges. On a new `runId` it snaps to the
 * first row (the old answer), spins fast and steady (linear), then brakes on
 * an ease-out cubic onto the last row and calls `onDone`. The brake starts at
 * the spin's speed (eightBallReelTiming), so the stop reads as one motion.
 */
function SlotReel({
  strip,
  runId,
  spinning,
  onDone,
}: {
  strip: readonly string[];
  runId: number;
  /** False when the card reopens on a reel that already landed: no replay. */
  spinning: boolean;
  onDone: () => void;
}) {
  const theme = useTheme();
  const y = useSharedValue(REEL_PEEK);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    cancelAnimation(y);
    const rowY = (row: number) => REEL_PEEK - row * REEL_ROW_H;
    if (strip.length <= 1) {
      y.value = rowY(0);
      return;
    }
    const steps = strip.length - 1;
    if (!spinning) {
      y.value = rowY(steps);
      return;
    }
    const timing = eightBallReelTiming(steps);
    y.value = rowY(0);
    y.value = withSequence(
      // Fast and steady.
      withTiming(rowY(timing.spinRows), { duration: timing.spinMs, easing: Easing.linear }),
      // Then the brake onto the answer.
      withTiming(rowY(steps), { duration: timing.stopMs, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(callDone)();
      }),
    );
    function callDone() {
      done.current();
    }
    // A new run (runId), not a re-render, restarts the spin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const moving = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View
      style={[styles.reelWindow, { borderColor: controlBorderColor(theme) }]}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={spinning ? 'Shaking' : strip[strip.length - 1]}>
      <Animated.View style={moving}>
        {strip.map((line, i) => (
          <View
            key={`${runId}-${i}`}
            style={styles.reelRow}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <ThemedText
              style={styles.answer}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              maxFontSizeMultiplier={1.4}>
              {line}
            </ThemedText>
          </View>
        ))}
      </Animated.View>
      {/* Top and bottom fade over the peeking rows. */}
      <View pointerEvents="none" style={[styles.reelFade, styles.reelFadeTop]}>
        {REEL_FADE_STEPS.map((o) => (
          <View key={`t${o}`} style={[styles.reelFadeBand, { backgroundColor: theme.backgroundElement, opacity: o }]} />
        ))}
      </View>
      <View pointerEvents="none" style={[styles.reelFade, styles.reelFadeBottom]}>
        {[...REEL_FADE_STEPS].reverse().map((o) => (
          <View key={`b${o}`} style={[styles.reelFadeBand, { backgroundColor: theme.backgroundElement, opacity: o }]} />
        ))}
      </View>
    </View>
  );
}

/**
 * Reduce Motion's answer: no reel and nothing moves. The line cross-fades
 * through `lines` (a few others, then the real answer) one step at a time,
 * about a second in all, then calls `onDone`. Opacity only.
 */
function CalmReel({ lines, runId, onDone }: { lines: readonly string[]; runId: number; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const fade = useSharedValue(1);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    setIndex(0);
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      if (step >= lines.length) {
        clearInterval(timer);
        done.current();
        return;
      }
      setIndex(step);
    }, EIGHT_BALL_CALM_STEP_MS);
    return () => clearInterval(timer);
    // A new run restarts it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  useEffect(() => {
    fade.value = 0.15;
    fade.value = withTiming(1, { duration: Math.round(EIGHT_BALL_CALM_STEP_MS * 0.7) });
  }, [index, fade]);

  const shown = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <View style={styles.calmWindow} accessible accessibilityLiveRegion="polite" accessibilityLabel="Thinking">
      <Animated.View style={shown}>
        <ThemedText style={styles.answer} numberOfLines={2}>
          {lines[index]}
        </ThemedText>
      </Animated.View>
    </View>
  );
}

/**
 * Small collapsible 8-ball. Back (emci, 2026-10-04) on the Questions tab, below
 * the question set — it left with Talk's chat on 2026-09-14. Entirely on the
 * phone: fixed answers (lib/sage-eight-ball.ts), no model call, no quota, no
 * tokens, nothing saved. Closed until you open it; the shake respects Reduce
 * Motion and a roll can't be skipped mid-reel.
 */
export function SageEightBall() {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [spin, setSpin] = useState(0);
  const [rolling, setRolling] = useState(false);
  // The reel strip and which run it is; the real answer lands when it settles.
  const [strip, setStrip] = useState<string[]>([]);
  const [runId, setRunId] = useState(0);
  const landing = useRef<string | null>(null);
  const rollingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opening = useRef(false);
  // The first roll after opening waits for the card's zoom-in to finish.
  const rollAfterZoom = useRef(false);
  const rollRef = useRef<() => void>(() => {});

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    };
  }, []);

  // Drops a first roll still waiting on the zoom-in (closed, reopened or
  // Ask tapped meanwhile), so it can never fire later on its own.
  function cancelPendingZoomRoll() {
    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = null;
    rollAfterZoom.current = false;
  }

  function roll() {
    if (rollingRef.current) return;
    cancelPendingZoomRoll();
    const next = rollEightBall(answer);
    rollingRef.current = true;
    setRolling(true);
    landing.current = next;
    if (reduceMotion) {
      // No shake, no reel: a short cross-fade through a few answers (CalmReel)
      // while the ball glows (SageOrb thinking), then a light haptic.
      setStrip([...pickEightBallFlashes(next, answer, EIGHT_BALL_CALM_FLASHES), next]);
      setRunId((n) => n + 1);
      return;
    }
    setSpin((n) => n + 1);
    const flashes = pickEightBallFlashes(next, answer);
    // The strip starts on the answer showing now, runs through the fillers
    // and ends on the real one (SlotReel).
    setStrip([...(answer ? [answer] : []), ...flashes, next]);
    setRunId((n) => n + 1);
  }
  rollRef.current = roll;

  // Reduce Motion switched either way mid-roll swaps the reel for the calm
  // view (or back) before it lands: land it now so Ask is never stuck.
  useEffect(() => {
    if (rollingRef.current) landed();
  }, [reduceMotion]);

  function landed() {
    const next = landing.current;
    // The strip stays where it stopped (on this answer) until the next run.
    if (next) setAnswer(next);
    rollingRef.current = false;
    setRolling(false);
  }

  function calmLanded() {
    oneLightHaptic();
    // VoiceOver does not read live regions: say the answer that landed.
    if (landing.current) AccessibilityInfo.announceForAccessibility(landing.current);
    landed();
  }

  // Called when the card's zoom-in finishes, or by a fallback timer (the
  // entering callback is not guaranteed on every platform).
  function zoomFinished() {
    if (zoomTimerRef.current) {
      clearTimeout(zoomTimerRef.current);
      zoomTimerRef.current = null;
    }
    if (!rollAfterZoom.current) return;
    rollAfterZoom.current = false;
    rollRef.current();
  }

  function toggle() {
    // Closing mid-spin unmounts the reel before it lands: land it now so Ask
    // is never left disabled.
    if (rollingRef.current) landed();
    // Closing before the zoom-in finished: no roll may fire on a closed card.
    cancelPendingZoomRoll();
    setOpen((value) => !value);
  }

  // Tapping the closed ball shakes it, then opens straight into a first
  // answer (emci 2026-10-05: "add its animation back"). Reduce Motion: it
  // just opens and answers.
  function openWithShake() {
    if (opening.current) return;
    if (reduceMotion) {
      setOpen(true);
      roll();
      return;
    }
    opening.current = true;
    setSpin((n) => n + 1);
    timerRef.current = setTimeout(() => {
      opening.current = false;
      cancelPendingZoomRoll();
      // The reel starts only once the card has zoomed in.
      rollAfterZoom.current = true;
      setOpen(true);
      zoomTimerRef.current = setTimeout(zoomFinished, ZOOM_FALLBACK_MS);
    }, OPEN_SHAKE_MS);
  }

  // Closed, it is one round button in the Questions header (polish pass,
  // 2026-10-05); open, a full-width card under the header.
  if (!open) {
    return (
      <ThemedPressable
        accessibilityRole="button"
        accessibilityLabel="8-ball"
        accessibilityState={{ expanded: false }}
        onPress={openWithShake}
        hitSlop={6}
        style={[styles.orbButton, { borderColor: controlBorderColor(theme), backgroundColor: theme.backgroundElement }]}>
        <SageOrb size={26} spin={spin} marked />
      </ThemedPressable>
    );
  }

  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : ZoomIn.springify()
              .damping(14)
              .withCallback((finished) => {
                if (finished) runOnJS(zoomFinished)();
              })
      }
      style={styles.cardOpen}>
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedPressable
        accessibilityRole="button"
        accessibilityLabel="8-ball"
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={styles.header}>
        <View style={styles.headerLabel}>
          <SageOrb size={18} spin={spin} />
          <ThemedText type="smallBold">8-ball</ThemedText>
        </View>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.textSecondary}
        />
      </ThemedPressable>
      {open ? (
        <View style={styles.body}>
          {!EIGHT_BALL_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
            <ThemedText type="code" themeColor="textSecondary">
              Draft copy — waiting on emci review.
            </ThemedText>
          ) : null}
          <View style={styles.answerRow}>
            <SageOrb size={28} spin={spin} marked thinking={rolling} />
            {/* Reduce Motion: the calm cross-fade while it thinks. Otherwise the
                reel, while it spins or still rests on the current answer. */}
            {reduceMotion && rolling && strip.length > 0 ? (
              <CalmReel lines={strip} runId={runId} onDone={calmLanded} />
            ) : !reduceMotion && strip.length > 0 && (rolling || strip[strip.length - 1] === answer) ? (
              <SlotReel strip={strip} runId={runId} spinning={rolling} onDone={landed} />
            ) : (
              <ThemedText
                style={styles.answer}
                themeColor={answer ? undefined : 'textSecondary'}>
                {answer ?? 'Tap Ask to shake.'}
              </ThemedText>
            )}
          </View>
          <ThemedPressable
            accessibilityRole="button"
            accessibilityLabel={answer ? 'Ask again' : 'Ask'}
            accessibilityState={{ disabled: rolling, busy: rolling }}
            disabled={rolling}
            onPress={roll}
            style={[
              styles.askAgain,
              { borderColor: controlBorderColor(theme) },
              rolling && styles.askAgainBusy,
            ]}>
            <ThemedText type="smallBold">{answer ? 'Ask again' : 'Ask'}</ThemedText>
          </ThemedPressable>
        </View>
      ) : null}
    </ThemedView>
    </Animated.View>
  );
}

/** How long the closed ball shakes before it opens. Matches SageOrb's shake. */
const OPEN_SHAKE_MS = 650;
/** Start the first reel anyway if the zoom-in callback never arrives. */
const ZOOM_FALLBACK_MS = 900;

const styles = StyleSheet.create({
  orbButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardOpen: {
    width: '100%',
  },
  card: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  headerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  body: {
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  answer: {
    flex: 1,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: 600,
  },
  reelWindow: {
    flex: 1,
    // + the 1px top and bottom border, so the landed row sits dead centre.
    height: REEL_WINDOW_H + 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  reelFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: REEL_PEEK,
  },
  reelFadeTop: {
    top: 0,
  },
  reelFadeBottom: {
    bottom: 0,
  },
  reelFadeBand: {
    flex: 1,
  },
  calmWindow: {
    flex: 1,
    height: REEL_ROW_H,
    justifyContent: 'center',
  },
  reelRow: {
    height: REEL_ROW_H,
    justifyContent: 'center',
  },
  askAgain: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  askAgainBusy: {
    opacity: 0.5,
  },
  orb: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  orbShine: {
    position: 'absolute',
    opacity: 0.28,
  },
  orbGlyph: {
    fontWeight: '700',
  },
});
