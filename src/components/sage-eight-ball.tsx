import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppearance } from '@/lib/theme/context';
import {
  EIGHT_BALL_FLASH_DELAYS_MS,
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

  useEffect(() => {
    if (spin === 0 || reduceMotion) return;
    cancelAnimation(rotate);
    cancelAnimation(nudge);
    rotate.value = 0;
    nudge.value = 0;
    rotate.value = withSequence(
      withTiming(16, { duration: 150 }),
      withTiming(-14, { duration: 175 }),
      withTiming(10, { duration: 175 }),
      withTiming(-6, { duration: 150 }),
      withTiming(0, { duration: 200 }),
    );
    nudge.value = withSequence(
      withTiming(2.5, { duration: 125 }),
      withTiming(-2.5, { duration: 125 }),
      withTiming(1.5, { duration: 125 }),
      withTiming(0, { duration: 150 }),
    );
  }, [spin, reduceMotion, rotate, nudge]);

  const motion = useAnimatedStyle(() => ({
    transform: [{ translateX: nudge.value }, { rotate: `${rotate.value}deg` }],
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

/**
 * Small collapsible 8-ball at the top of Sage. Lives above the chat so an
 * expanded answer shrinks the thread a little instead of inserting a bubble.
 */
export function SageEightBall() {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [spin, setSpin] = useState(0);
  const [rolling, setRolling] = useState(false);
  const rollingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    let i = 0;
    const tick = () => {
      if (i < flashes.length) {
        setAnswer(flashes[i]!);
        const delay = EIGHT_BALL_FLASH_DELAYS_MS[i] ?? 100;
        i += 1;
        timerRef.current = setTimeout(tick, delay);
        return;
      }
      setAnswer(next);
      rollingRef.current = false;
      setRolling(false);
      timerRef.current = null;
    };
    tick();
  }

  function toggle() {
    setOpen((value) => !value);
  }

  return (
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
          <View style={styles.answerRow}>
            <SageOrb size={28} spin={spin} marked />
            <ThemedText
              style={styles.answer}
              themeColor={answer ? undefined : 'textSecondary'}>
              {answer ?? 'Tap Ask to shake.'}
            </ThemedText>
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
  );
}

const styles = StyleSheet.create({
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
