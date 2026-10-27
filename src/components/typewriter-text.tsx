import { useEffect, useState } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useMotionActive } from '@/hooks/use-motion-active';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { revealCount, splitAtKeyWord } from '@/lib/insights-typewriter';
import { MOTION_GOLD, TYPEWRITER } from '@/lib/motion-tokens';

const GLOW_RADIUS = 8;

/**
 * The first line of a freshly loaded insight (PHASE-09): 28 steps over 1.4 s
 * after a 400 ms delay, then a 3 s glow loop on one key word. The layout is
 * reserved up front (unrevealed letters are transparent, not missing), so
 * nothing jumps, and VoiceOver reads the whole line at once. `animate` is false
 * for an insight that was already there: plain text. Reduce Motion: no
 * typewriter and no glow, the full text fades in over 300 ms.
 */
export function TypewriterText({
  text,
  animate,
  style,
  forceReduceMotion = false,
}: {
  text: string;
  animate: boolean;
  style?: StyleProp<TextStyle>;
  forceReduceMotion?: boolean;
}) {
  const rm = useMotionReduced(forceReduceMotion);
  const active = useMotionActive();
  const typing = animate && !rm;
  const [step, setStep] = useState(typing ? 0 : TYPEWRITER.steps);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!typing) {
      setStep(TYPEWRITER.steps);
      return;
    }
    setStep(0);
    let tick: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
      let n = 0;
      tick = setInterval(() => {
        n += 1;
        setStep(n);
        if (n >= TYPEWRITER.steps && tick) clearInterval(tick);
      }, TYPEWRITER.totalMs / TYPEWRITER.steps);
    }, TYPEWRITER.delayMs);
    return () => {
      clearTimeout(start);
      if (tick) clearInterval(tick);
    };
  }, [typing, text]);

  const glowing = !rm && active && step >= TYPEWRITER.steps;
  useEffect(() => {
    if (!glowing) {
      cancelAnimation(glow);
      glow.value = 0;
      return;
    }
    glow.value = withRepeat(
      withSequence(
        withTiming(GLOW_RADIUS, { duration: TYPEWRITER.glowMs / 2, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: TYPEWRITER.glowMs / 2, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
    return () => cancelAnimation(glow);
  }, [glowing, glow]);
  const glowStyle = useAnimatedStyle(() => ({ textShadowRadius: glow.value }));

  const [before, key, after] = splitAtKeyWord(text);
  const shown = revealCount(step, text.length);
  const part = (s: string, offset: number) => {
    const visible = Math.min(s.length, Math.max(0, shown - offset));
    return [s.slice(0, visible), s.slice(visible)] as const;
  };
  const [bVis, bHid] = part(before, 0);
  const [kVis, kHid] = part(key, before.length);
  const [aVis, aHid] = part(after, before.length + key.length);

  const body = (
    <ThemedText style={style} accessibilityLabel={text}>
      {bVis}
      {bHid ? <Text style={styles.hidden}>{bHid}</Text> : null}
      {key ? (
        <>
          <Animated.Text style={[glowStyle, styles.glow]}>{kVis}</Animated.Text>
          {kHid ? <Text style={styles.hidden}>{kHid}</Text> : null}
        </>
      ) : null}
      {aVis}
      {aHid ? <Text style={styles.hidden}>{aHid}</Text> : null}
    </ThemedText>
  );
  return animate && rm ? <Animated.View entering={FadeIn.duration(300)}>{body}</Animated.View> : body;
}

const styles = StyleSheet.create({
  hidden: { color: 'transparent' },
  glow: { textShadowColor: MOTION_GOLD, textShadowOffset: { width: 0, height: 0 } },
});
