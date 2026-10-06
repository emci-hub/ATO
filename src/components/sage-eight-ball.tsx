import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
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
  EIGHT_BALL_COPY_REVIEWED,
  EIGHT_BALL_REEL_SETTLE_MS,
  EIGHT_BALL_REEL_SPIN_MS,
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
function SageOrb({ size, spin, marked }: { size: number; spin: number; marked?: boolean }) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const rotate = useSharedValue(0);
  const nudge = useSharedValue(0);
  const pop = useSharedValue(1);

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

/** One line of the reel window. Two lines of answer text fit, with room. */
const REEL_ROW_H = 64;

/**
 * The slot reel: `strip` stacked in a one-row window. On a new `runId` it
 * snaps to the top (the old answer), spins down the strip on an ease-out
 * curve, runs a little past the last row and settles back onto it, then calls
 * `onDone`. A strip of one line just shows it.
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
  const y = useSharedValue(0);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    cancelAnimation(y);
    if (strip.length <= 1) {
      y.value = 0;
      return;
    }
    const target = -(strip.length - 1) * REEL_ROW_H;
    if (!spinning) {
      y.value = target;
      return;
    }
    y.value = 0;
    y.value = withSequence(
      withTiming(target - REEL_ROW_H * 0.28, {
        duration: EIGHT_BALL_REEL_SPIN_MS,
        easing: Easing.bezier(0.12, 0.72, 0.2, 1),
      }),
      withTiming(target, { duration: EIGHT_BALL_REEL_SETTLE_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
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
      style={styles.reelWindow}
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
  const opening = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function roll() {
    if (rollingRef.current) return;
    const next = rollEightBall(answer);
    setSpin((n) => n + 1);
    if (reduceMotion) {
      setAnswer(next);
      return;
    }
    rollingRef.current = true;
    setRolling(true);
    const flashes = pickEightBallFlashes(next, answer);
    landing.current = next;
    // The strip starts on the answer showing now, runs through the fillers
    // and ends on the real one (SlotReel).
    setStrip([...(answer ? [answer] : []), ...flashes, next]);
    setRunId((n) => n + 1);
  }

  // Reduce Motion switched on mid-spin unmounts the reel before it lands.
  useEffect(() => {
    if (reduceMotion && rollingRef.current) landed();
  }, [reduceMotion]);

  function landed() {
    const next = landing.current;
    // The strip stays where it stopped (on this answer) until the next run.
    if (next) setAnswer(next);
    rollingRef.current = false;
    setRolling(false);
  }

  function toggle() {
    // Closing mid-spin unmounts the reel before it lands: land it now so Ask
    // is never left disabled.
    if (rollingRef.current) landed();
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
      setOpen(true);
      roll();
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
      entering={reduceMotion ? undefined : ZoomIn.springify().damping(14)}
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
            <SageOrb size={28} spin={spin} marked />
            {/* The reel only while it spins or still rests on the current answer. */}
            {!reduceMotion && strip.length > 0 && (rolling || strip[strip.length - 1] === answer) ? (
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
    height: REEL_ROW_H,
    overflow: 'hidden',
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
