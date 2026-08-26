import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { crisisCardContent } from '@/lib/crisis/copy';
import { useCrisisRegion } from '@/lib/crisis/region-context';
import { setCrisisActive } from '@/lib/kenney/gesture-actions';

/**
 * Static crisis card. Shown in place of any AI content when a message is
 * crisis-flagged. onDismiss ("I'm okay, keep going") returns the user to the
 * normal flow — nothing is logged or recorded.
 *
 * While this card is mounted, event gestures are hard-disabled (hands stay
 * hidden, no pose, no exception). That is intentional, not a missed case.
 */
export function CrisisCard({ onDismiss }: { onDismiss?: () => void }) {
  const theme = useTheme();
  const { region } = useCrisisRegion();
  const content = crisisCardContent(region);

  useEffect(() => {
    setCrisisActive(true);
    return () => setCrisisActive(false);
  }, []);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold" style={styles.intro}>
        {content.intro}
      </ThemedText>

      <ThemedText style={styles.body}>{content.body}</ThemedText>

      {content.fallback ? (
        <ThemedText style={styles.body}>{content.fallback}</ThemedText>
      ) : (
        <View style={styles.actions}>
          {content.actions.map((action) => (
            <View key={action.label} style={styles.actionRow}>
              <ThemedText style={styles.actionIcon}>{action.icon}</ThemedText>
              <ThemedText type="smallBold">{action.label}</ThemedText>
            </View>
          ))}
        </View>
      )}

      {content.note ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          {content.note}
        </ThemedText>
      ) : null}

      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.dismiss,
            { borderColor: theme.backgroundSelected, borderWidth: 1 },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {content.dismiss}
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
