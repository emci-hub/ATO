import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { rollEightBall } from '@/lib/sage-eight-ball';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * Small collapsible 8-ball at the top of Sage. Lives above the chat so an
 * expanded answer shrinks the thread a little instead of inserting a bubble.
 */
export function SageEightBall() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  function toggle() {
    if (!open && answer == null) setAnswer(rollEightBall());
    setOpen((value) => !value);
  }

  function askAgain() {
    setAnswer((prev) => rollEightBall(prev));
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
          <MaterialCommunityIcons
            name="numeric-8-circle-outline"
            size={18}
            color={theme.textSecondary}
          />
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
          <ThemedText style={styles.answer}>{answer}</ThemedText>
          <ThemedPressable
            accessibilityRole="button"
            accessibilityLabel="Ask again"
            onPress={askAgain}
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
  answer: {
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
