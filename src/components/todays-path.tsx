import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { PlusPop } from '@/components/plus-pop';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { useTheme } from '@/hooks/use-theme';
import { PATH_STEP_LABELS, PATH_TITLE, pathState, type PathInput } from '@/lib/home-path';
import { EASE_OUT, SPRING_POP, haptic } from '@/lib/motion-tokens';

/** Bar fill time (§1.3 / PHASE-08). It never blocks a tap, so it may pass 900 ms. */
const BAR_MS = 1000;
/** A Reduce Motion change is a fade of 300 ms or less (§1.4). */
const RM_FADE_MS = 300;

/**
 * Home: "Today's path" (PHASE-08). Three steps: check in, read today's insight,
 * answer a few questions. It only READS those; it awards nothing. The one token
 * amount it can show ("+N ✦") is what the server paid for the check-in, passed
 * in as `earned`.
 *
 * Motion: a ticked box pops in with SPRING_POP, the bar fills over 1 s, "+N ✦"
 * floats up. Light haptic per step, Success when the last one lands (not on
 * first paint). Reduce Motion: the box and bar fade, "+N ✦" fades in place.
 */
export function TodaysPath({
  input,
  earned,
}: {
  input: PathInput;
  /** The tokens the check-in just paid, with a counter that changes per award. */
  earned: { amount: number; nonce: number } | null;
}) {
  const state = pathState(input);
  const rm = useMotionReduced();
  const theme = useTheme();

  const fill = useSharedValue(state.fraction);
  const fade = useSharedValue(1);
  const first = useRef(true);
  const prevCount = useRef(state.count);
  // An award that was already there when this card mounted is old news: only a
  // new one may float up (PlusPop plays on mount for any trigger above 0).
  const mountedNonce = useRef(earned?.nonce ?? 0);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      fill.value = state.fraction;
      return;
    }
    cancelAnimation(fill);
    if (rm) {
      fill.value = state.fraction;
      fade.value = 0.4;
      fade.value = withTiming(1, { duration: RM_FADE_MS });
    } else {
      fill.value = withTiming(state.fraction, { duration: BAR_MS, easing: EASE_OUT });
    }
    if (state.count > prevCount.current) {
      if (state.allDone) haptic.success();
      else haptic.commit();
    }
    prevCount.current = state.count;
  }, [state.count, state.fraction, state.allDone, rm, fill, fade]);

  const bar = useAnimatedStyle(() => ({ width: `${fill.value * 100}%`, opacity: fade.value }));

  return (
    <ThemedView
      type="backgroundElement"
      style={styles.card}
      accessible
      accessibilityLabel={`${PATH_TITLE}: ${state.count} of 3 done`}>
      <View style={styles.head}>
        <ThemedText type="smallBold">{PATH_TITLE}</ThemedText>
        <ThemedText type="code" themeColor="textSecondary">
          {state.count} of 3
        </ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <Animated.View style={[styles.fillBar, { backgroundColor: theme.accentFill }, bar]} />
      </View>
      {PATH_STEP_LABELS.map((label, i) => (
        <View key={label} style={styles.step}>
          <Check done={state.done[i]} rm={rm} />
          <ThemedText type="small" style={state.done[i] ? { color: theme.textSecondary } : undefined}>
            {label}
          </ThemedText>
          {i === 0 && earned ? (
            <View style={styles.popHost}>
              <PlusPop label={`+${earned.amount} ✦`} trigger={earned.nonce > mountedNonce.current ? earned.nonce : 0} />
            </View>
          ) : null}
        </View>
      ))}
    </ThemedView>
  );
}

function Check({ done, rm }: { done: boolean; rm: boolean }) {
  const theme = useTheme();
  const pop = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    if (rm) {
      pop.value = withTiming(done ? 1 : 0, { duration: RM_FADE_MS });
      return;
    }
    pop.value = withSpring(done ? 1 : 0, SPRING_POP);
  }, [done, rm, pop]);
  const mark = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value),
    transform: rm ? [] : [{ scale: pop.value }],
  }));
  return (
    <View
      style={[styles.box, { borderColor: done ? theme.accentFill : theme.border }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Animated.View style={mark}>
        <MaterialCommunityIcons name="check" size={16} color={theme.accentFill} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 6, borderRadius: 99, overflow: 'hidden' },
  fillBar: { height: 6, borderRadius: 99 },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 32 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popHost: { marginLeft: 'auto', width: 72, height: 24, alignItems: 'center', justifyContent: 'center' },
});
