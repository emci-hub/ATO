import { useEffect, useMemo, useState } from 'react';
import type { ViewStyle } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  type AnimatedStyle,
} from 'react-native-reanimated';

import { manifestFor } from './registry';
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const trigger = (state: string) => {
      if (!enabled) return;
      if (timer) clearTimeout(timer);
      setOverrides((prev) => ({ ...prev, hand: state }));
      timer = setTimeout(() => {
        setOverrides((prev) => {
          if (!('hand' in prev)) return prev;
          const next = { ...prev };
          delete next.hand;
          return next;
        });
      }, 1750);
    };
    return trigger;
  }, [enabled]);

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
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
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

  return { style, overrides, squash, gesture };
}
