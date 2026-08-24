import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  CRISIS_ACTIONS,
  CRISIS_BODY,
  CRISIS_DISMISS,
  CRISIS_INTRO,
  CRISIS_NOTE,
} from '@/lib/crisis/copy';

/**
 * Static crisis card. Shown in place of any AI content when a message is
 * crisis-flagged. onDismiss ("I'm okay, keep going") returns the user to the
 * normal flow — nothing is logged or recorded.
 */
export function CrisisCard({ onDismiss }: { onDismiss?: () => void }) {
  const theme = useTheme();

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold" style={styles.intro}>
        {CRISIS_INTRO}
      </ThemedText>

      <ThemedText style={styles.body}>{CRISIS_BODY}</ThemedText>

      <View style={styles.actions}>
        {CRISIS_ACTIONS.map((action) => (
          <View key={action.label} style={styles.actionRow}>
            <ThemedText style={styles.actionIcon}>{action.icon}</ThemedText>
            <ThemedText type="smallBold">{action.label}</ThemedText>
          </View>
        ))}
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        {CRISIS_NOTE}
      </ThemedText>

      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.dismiss,
            { borderColor: theme.backgroundSelected, borderWidth: 1 },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {CRISIS_DISMISS}
          </ThemedText>
        </Pressable>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  intro: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  actionIcon: {
    fontSize: 18,
  },
  note: {
    textAlign: 'center',
  },
  dismiss: {
    alignSelf: 'stretch',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});
