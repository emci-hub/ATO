import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Text as SvgText } from 'react-native-svg';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppearance } from '@/lib/theme/context';
import { rollEightBall } from '@/lib/sage-eight-ball';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * Original glazed orb — not Mattel's black ball / blue triangular window.
 * Kenney Shape Characters has a circle body, but that sprite is the pixel
 * companion, not an 8-ball, so this stays a tiny SVG instead.
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
      withTiming(16, { duration: 60 }),
      withTiming(-14, { duration: 70 }),
      withTiming(10, { duration: 70 }),
      withTiming(-6, { duration: 60 }),
      withTiming(0, { duration: 80 }),
    );
    nudge.value = withSequence(
      withTiming(2.5, { duration: 50 }),
      withTiming(-2.5, { duration: 50 }),
      withTiming(1.5, { duration: 50 }),
      withTiming(0, { duration: 60 }),
    );
  }, [spin, reduceMotion, rotate, nudge]);

  const motion = useAnimatedStyle(() => ({
    transform: [{ translateX: nudge.value }, { rotate: `${rotate.value}deg` }],
  }));

  const glyph = 14;

  return (
    <Animated.View style={[{ width: size, height: size }, motion]}>
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Circle cx="16" cy="16" r="15" fill={theme.accentFill} />
        <Ellipse cx="12" cy="11" rx="7" ry="4.2" fill={theme.onAccent} opacity="0.28" />
        <Circle
          cx="16"
          cy="16"
          r="15"
          fill="none"
          stroke={theme.text}
          strokeOpacity="0.14"
          strokeWidth="1"
        />
        {marked ? (
          <SvgText
            x="16"
            y="21"
            textAnchor="middle"
            fontSize={glyph}
            fontWeight="700"
            fill={theme.onAccent}>
            8
          </SvgText>
        ) : null}
      </Svg>
    </Animated.View>
  );
}

/**
 * Small collapsible 8-ball at the top of Sage. Lives above the chat so an
 * expanded answer shrinks the thread a little instead of inserting a bubble.
 */
export function SageEightBall() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [spin, setSpin] = useState(0);

  function roll() {
    setAnswer((prev) => rollEightBall(prev));
    setSpin((n) => n + 1);
  }

  function toggle() {
    if (!open && answer == null) roll();
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
            <ThemedText style={styles.answer}>{answer}</ThemedText>
          </View>
          <ThemedPressable
            accessibilityRole="button"
            accessibilityLabel="Ask again"
            onPress={roll}
            style={[styles.askAgain, { borderColor: controlBorderColor(theme) }]}>
            <ThemedText type="smallBold">Ask again</ThemedText>
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
});
