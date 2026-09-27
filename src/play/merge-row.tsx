/**
 * Inline Merge — the React half: the two-tap flow for Dress rows and the
 * on-row success / miss feedback. Pure rules live in `merge-inline.ts`.
 *
 * Flow per row: tap Merge → armed ("Tap again · 55%", lapses after
 * `MERGE_ARM_MS`) → tap again → the button reads "Rolling…" for the same paced
 * beat Dive uses (`usePacedAction`; "Skip Dive delays" still skips it) → the
 * result lands on the row: a green glow + "✓ Merged ★3", or a red flash, a
 * small shake and "✗ Missed · spare spent". Only one row is armed at a time, and
 * every Merge button is locked while a roll or its cooldown runs.
 *
 * Reduce motion: no shake and no fading glow — the row takes a flat tint for
 * the same duration, and the result text says what happened.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { usePacedAction } from '@/play/action-pacing';
import {
  MERGE_ARM_MS,
  MERGE_RESULT_MS,
  mergeFeedbackLabel,
  mergeResultRowKey,
  type MergeButtonState,
  type MergeRowFeedback,
} from '@/play/merge-inline';
import type { MergeOutcome, MergeTarget } from '@/play/playStore';

/** Result colours. Deliberately not the pink Merge button colour, so a miss
 * reads as "that went wrong", not "that's the button". */
export const MERGE_OK_COLOR = '#39E58C';
export const MERGE_MISS_COLOR = '#FF4D6D';

/**
 * Owns the whole screen's inline-merge state, so only one row can be armed or
 * rolling at once. Rows ask `buttonState(key)` / `feedbackFor(key)` and call
 * `press(key, target)`.
 */
export function useInlineMerge(
  skipDelays: boolean,
  onMerge: (target: MergeTarget) => Promise<MergeOutcome | null>,
) {
  const { act, busy } = usePacedAction(skipDelays);
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const [rollingKey, setRollingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<MergeRowFeedback | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(
    () => () => {
      if (armTimer.current) clearTimeout(armTimer.current);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    [],
  );

  const press = useCallback(
    (key: string, target: MergeTarget) => {
      if (busy) return;
      if (armTimer.current) clearTimeout(armTimer.current);
      // First tap (or a tap on a different row): arm this row only.
      if (armedKey !== key) {
        setArmedKey(key);
        armTimer.current = setTimeout(() => setArmedKey(null), MERGE_ARM_MS);
        return;
      }
      // Second tap on the armed row: roll.
      setArmedKey(null);
      setRollingKey(key);
      act('Merging…', async () => {
        const outcome = await onMerge(target);
        setRollingKey(null);
        if (outcome) {
          seq.current += 1;
          const next: MergeRowFeedback = {
            key: mergeResultRowKey(key, target, outcome),
            success: outcome.success,
            toStar: outcome.success ? outcome.toStar : null,
            seq: seq.current,
          };
          setFeedback(next);
          // iOS VoiceOver ignores `accessibilityLiveRegion`; say it explicitly.
          AccessibilityInfo.announceForAccessibility(mergeFeedbackLabel(next));
          if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
          feedbackTimer.current = setTimeout(() => setFeedback(null), MERGE_RESULT_MS);
        }
        return outcome != null;
      });
    },
    [act, armedKey, busy, onMerge],
  );

  const buttonState = (key: string): MergeButtonState =>
    rollingKey === key ? 'rolling' : armedKey === key ? 'armed' : 'idle';

  const feedbackFor = (key: string): MergeRowFeedback | null =>
    feedback && feedback.key === key ? feedback : null;

  return { busy, press, buttonState, feedbackFor };
}

/**
 * Wraps one Dress row and plays its merge result: a glow for success, a flash
 * plus a small shake for a miss. Replays for every new result (`seq`).
 */
export function MergeFeedbackRow({
  feedback,
  reduceMotion,
  style,
  children,
}: {
  feedback: MergeRowFeedback | null;
  reduceMotion: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const flash = useSharedValue(0);
  const shake = useSharedValue(0);
  const lastSeq = useRef(0);
  const success = feedback?.success ?? true;

  useEffect(() => {
    if (!feedback || feedback.seq === lastSeq.current) return;
    lastSeq.current = feedback.seq;
    const hold = MERGE_RESULT_MS - 300;
    if (reduceMotion) {
      // Flat tint on, flat tint off — no fade, no movement. `ReduceMotion.Never`
      // is required: Reanimated's default (`System`) SKIPS `withDelay` when the
      // phone's reduce-motion setting is on, which collapsed this hold to a
      // single frame. Nothing here moves, so holding the tint is safe.
      flash.value = withSequence(
        withTiming(0.22, { duration: 0, reduceMotion: ReduceMotion.Never }),
        withDelay(
          hold,
          withTiming(0, { duration: 0, reduceMotion: ReduceMotion.Never }),
          ReduceMotion.Never,
        ),
      );
      return;
    }
    flash.value = withSequence(
      withTiming(0.38, { duration: 140 }),
      withDelay(250, withTiming(0, { duration: hold - 390 })),
    );
    if (!feedback.success) {
      shake.value = withSequence(
        withTiming(-6, { duration: 45 }),
        withRepeat(withTiming(6, { duration: 70 }), 4, true),
        withTiming(0, { duration: 45 }),
      );
    }
  }, [feedback, reduceMotion, flash, shake]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  return (
    <Animated.View style={[style, shakeStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.flash,
          { backgroundColor: success ? MERGE_OK_COLOR : MERGE_MISS_COLOR },
          flashStyle,
        ]}
      />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flash: {
    borderRadius: 6,
  },
});
