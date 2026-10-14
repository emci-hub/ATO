import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TryTodayPick } from '@/lib/daily-insights';
import { controlBorderColor } from '@/lib/theme/chrome';
import { useAppearance } from '@/lib/theme/context';

import { ContextLine, ScriptLines } from './script-parts';

const DID_IT = 'Did it ✓';
const DONE_TODAY = 'Done today ✓';

function daysLabel(n: number): string {
  return n === 1 ? '1 day' : `${n} days`;
}

/**
 * 🎯 Try this today. Stored copy (lib/daily-insights), so no AI badge.
 * The streak is gentle: 0 just hides the 🔥 line, never a "you lost it".
 */
export function TryTodayCard({
  pick,
  streak,
  done,
  onDone,
}: {
  pick: TryTodayPick;
  streak: number;
  done: boolean;
  onDone: () => Promise<number | null>;
}) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const pressing = useRef(false);
  const scale = useSharedValue(1);
  const fade = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: fade.value }));

  const modeLabel = pick.line.mode === 'stretch' ? 'Stretch' : 'Strength';
  const whyText = pick.whyLine.replace(/^This is your /, '');
  const label = `Try this today. ${modeLabel}. ${pick.line.text} Why you: ${whyText}`;

  const press = async () => {
    // Two taps in one frame: only the first buzzes and announces.
    if (done || pressing.current) return;
    pressing.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Reduce Motion: an instant state change only, no scale or fade.
    if (!reduceMotion) {
      scale.value = withSequence(withTiming(1.06, { duration: 120 }), withTiming(1, { duration: 160 }));
      fade.value = withSequence(withTiming(0.6, { duration: 120 }), withTiming(1, { duration: 200 }));
    }
    const next = await onDone();
    pressing.current = false;
    if (next == null) return; // not marked (new day loading, or a save error)
    AccessibilityInfo.announceForAccessibility(
      next > 0 ? `Marked done. Streak ${daysLabel(next)}.` : 'Marked done.',
    );
  };

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: controlBorderColor(theme) }]}
      testID="try-today-card">
      <View accessible accessibilityLabel={label} style={styles.body}>
        <View style={styles.headRow}>
          <ContextLine emoji="🎯" label="Try this today" />
          <View style={[styles.chip, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
            <ThemedText type="code">{modeLabel}</ThemedText>
          </View>
        </View>
        <ScriptLines text={pick.line.text} type="subheading" />
        <View style={styles.why}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Why you
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {whyText}
          </ThemedText>
        </View>
      </View>

      <Animated.View style={animated}>
        <Pressable
          onPress={() => void press()}
          disabled={done}
          accessibilityRole="button"
          accessibilityLabel={done ? DONE_TODAY : DID_IT}
          accessibilityHint={done ? 'Already marked for today' : "Marks today's try as done"}
          accessibilityState={{ disabled: done, checked: done }}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.backgroundSelected, borderColor: controlBorderColor(theme) },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="smallBold">{done ? DONE_TODAY : DID_IT}</ThemedText>
        </Pressable>
      </Animated.View>

      {streak > 0 ? (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLabel={`Streak ${daysLabel(streak)}`}>
          🔥 {daysLabel(streak)}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  body: { gap: Spacing.two },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  chip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  why: { gap: Spacing.half },
  button: {
    alignSelf: 'flex-start',
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  pressed: { opacity: 0.8 },
});
