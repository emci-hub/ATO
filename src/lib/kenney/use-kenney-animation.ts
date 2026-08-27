import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewStyle } from 'react-native';
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  type AnimatedStyle,
} from 'react-native-reanimated';

import { manifestFor } from './registry';
import type { TapMood } from './tap-moods';
import type { KenneyRecipe } from './types';

export interface KenneyAnimation {
  /** Reanimated style for the whole composed group (breathe/bob/tilt). */
  style: AnimatedStyle<ViewStyle>;
  /** Temporary part state swaps (blink/gesture) to merge over the recipe. */
  overrides: Record<string, string>;
  /** Plays a quick squash (tap feedback). */
  squash: () => void;
  /**
   * Plays an event-driven gesture on the hand part: shows `state` for ~1.75s,
   * then restores the recipe's default (hidden at rest). This is the same
   * override mechanism the blink loop uses — no new infrastructure.
   */
  gesture: (state: string) => void;
  /**
   * One-time milestone celebration: a louder burst (bigger scale pulse +
   * glow-ring flash) layered on top of the normal idle motion. Uses the same
   * shared values / withSequence as the daily gestures — just bigger and
   * rarer. Call when a presence milestone (7/21) first crosses.
   */
  celebrate: () => void;
  /**
   * Nav-pixel tap mood: instant hand swap + a short matching motion (under
   * ~1s). Re-calling interrupts the in-flight mood and starts the new one —
   * no queue, no startup delay.
   */
  playTapMood: (mood: TapMood) => void;
}

const DEFAULT_OVERRIDES: Record<string, string> = {};

/**
 * The generic animation layer. It never inspects which family is active — it
 * only reads the manifest's declared animation groups and applies them to the
 * composed result.
 *
 * Discrete swaps: each group cycles the part between its manifest-declared
 * states on a jittered interval, holds briefly, then restores the recipe's
 * chosen state. Procedural: idle breathe (scale pulse), bob (translateY), and
 * tilt, all looping, plus a squash on demand for tap feedback.
 */
export function useKenneyAnimation(
  recipe: KenneyRecipe,
  enabled = true,
): KenneyAnimation {
  const manifest = manifestFor(recipe.source);
  const [overrides, setOverrides] = useState(DEFAULT_OVERRIDES);

  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const squashScaleY = useSharedValue(1);
  // Tap-mood overlay — composed on top of idle so a tap never has to wait
  // for the breathe/bob loop, and unused channels can snap to rest without
  // mixing one mood's motion into the next.
  const tapScale = useSharedValue(1);
  const tapY = useSharedValue(0);
  const tapRotate = useSharedValue(0);
  const handTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const holdHand = useCallback((state: string, ms: number) => {
    if (handTimerRef.current) clearTimeout(handTimerRef.current);
    setOverrides((prev) => ({ ...prev, hand: state }));
    handTimerRef.current = setTimeout(() => {
      handTimerRef.current = undefined;
      setOverrides((prev) => {
        if (!('hand' in prev)) return prev;
        const next = { ...prev };
        delete next.hand;
        return next;
      });
    }, ms);
  }, []);

  useEffect(
    () => () => {
      if (handTimerRef.current) clearTimeout(handTimerRef.current);
    },
    [],
  );

  // --- Discrete state swaps (blink / gesture) ------------------------------
  // The rest state is whatever the recipe declares (hands default to hidden).
  // A manifest animation group schedules its own cycle; event-driven gestures
  // arrive via `gesture(state)` and use the same override mechanism.
  useEffect(() => {
    if (!enabled) return;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    };

    for (const group of Object.values(manifest.animations)) {
      const part = manifest.parts.find((p) => p.id === group.part);
      if (!part) continue;
      const resting = recipe.parts[group.part];
      const alternates = group.states.filter((s) => part.states[s] && s !== resting);
      if (alternates.length === 0) continue;

      const schedule = (): void => {
        const jitter = (group.jitterMs ?? 0) * Math.random();
        later(() => {
          const target = alternates[Math.floor(Math.random() * alternates.length)];
          setOverrides((prev) => (prev[group.part] === target ? prev : { ...prev, [group.part]: target }));
          later(() => {
            setOverrides((prev) => {
              if (!(group.part in prev)) return prev;
              const next = { ...prev };
              delete next[group.part];
              return next;
            });
            schedule();
          }, group.holdMs ?? 600);
        }, group.intervalMs + jitter);
      };
      schedule();
    }

    return () => {
      for (const timer of timers) clearTimeout(timer);
      setOverrides(DEFAULT_OVERRIDES);
    };
  }, [manifest, recipe.parts, enabled]);

  // Event-driven gesture: hold the given state ~1.5–2s, then restore.
  const gesture = useMemo(() => {
    const trigger = (state: string) => {
      if (!enabled) return;
      holdHand(state, 1750);
    };
    return trigger;
  }, [enabled, holdHand]);

  // --- Procedural transforms ------------------------------------------------
  useEffect(() => {
    if (!enabled) return;
    scale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    translateY.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    rotate.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(-0.6, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    return () => {
      scale.value = 1;
      translateY.value = 0;
      rotate.value = 0;
    };
  }, [enabled, scale, translateY, rotate]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value + tapY.value },
      { rotate: `${rotate.value + tapRotate.value}deg` },
      { scale: scale.value * tapScale.value },
      { scaleY: squashScaleY.value },
    ],
  }));

  const squash = useMemo(
    () => () => {
      squashScaleY.value = withSequence(
        withTiming(0.94, { duration: 90 }),
        withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) }),
      );
    },
    [squashScaleY],
  );

  // Milestone celebration: a louder, rarer burst than the daily gestures.
  // Reuses scale/squash shared values + a hand override — no new machinery.
  const celebrate = useMemo(() => {
    const run = () => {
      if (!enabled) return;
      // Bigger, punchier scale pulse.
      scale.value = withSequence(
        withTiming(1.25, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(0.92, { duration: 140, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.08, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }),
      );
      // Both hands up (peace) for the celebration, then back to hidden.
      holdHand('peace', 1600);
    };
    return run;
  }, [enabled, scale, holdHand]);

  const playTapMood = useMemo(() => {
    const play = (mood: TapMood) => {
      if (!enabled) return;
      // Interrupt-and-restart: drop any in-flight tap motion so a rapid
      // re-tap never queues or frankensteins two moods. Hands swap in the
      // same tick — no delay before the gesture is visible.
      cancelAnimation(tapScale);
      cancelAnimation(tapY);
      cancelAnimation(tapRotate);
      tapScale.value = 1;
      tapY.value = 0;
      tapRotate.value = 0;

      holdHand(mood.hand, mood.durationMs);

      const ease = Easing.inOut(Easing.sin);
      if (mood.id === 'wave') {
        tapRotate.value = withSequence(
          withTiming(12, { duration: 90, easing: Easing.out(Easing.quad) }),
          withTiming(-12, { duration: 130, easing: ease }),
          withTiming(9, { duration: 120, easing: ease }),
          withTiming(-6, { duration: 120, easing: ease }),
          withTiming(0, { duration: 140, easing: Easing.out(Easing.quad) }),
        );
      } else if (mood.id === 'thumbsUp') {
        tapY.value = withSequence(
          withTiming(-5, { duration: 140, easing: Easing.out(Easing.quad) }),
          withTiming(-2, { duration: 200, easing: ease }),
          withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) }),
        );
        tapScale.value = withSequence(
          withTiming(1.1, { duration: 140, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) }),
        );
      } else if (mood.id === 'happyBounce') {
        tapY.value = withSequence(
          withTiming(-7, { duration: 120, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 110, easing: ease }),
          withTiming(-4, { duration: 120, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) }),
        );
        tapScale.value = withSequence(
          withTiming(1.14, { duration: 120, easing: Easing.out(Easing.quad) }),
          withTiming(0.96, { duration: 110, easing: ease }),
          withTiming(1.06, { duration: 120, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
        );
      } else {
        // hug: open hands + squeeze-in (the pack has no wrap-around pose).
        tapScale.value = withSequence(
          withTiming(0.88, { duration: 160, easing: Easing.out(Easing.quad) }),
          withTiming(0.9, { duration: 220, easing: ease }),
          withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) }),
        );
        tapY.value = withSequence(
          withTiming(2, { duration: 160, easing: ease }),
          withTiming(0, { duration: 460, easing: Easing.out(Easing.quad) }),
        );
      }
    };
    return play;
  }, [enabled, holdHand, tapScale, tapY, tapRotate]);

  return { style, overrides, squash, gesture, celebrate, playTapMood };
}
