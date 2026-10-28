import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { cardIsShareable, useAlmanacCard } from '@/components/almanac/use-almanac-card';
import { ShareCardSheet, type SharePerson } from '@/components/share-card';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AlmanacDay } from '@/hooks/use-almanac-day';
import { controlBorderColor } from '@/lib/theme/chrome';

export const WEEK_RECAP_TITLE = 'Your week in you';
export const RECAP_SHARE_LABEL = 'Share';

/**
 * You, Sundays (the Almanac's `you.week` cards carry the weekday): a short
 * recap line above the seven-day counts. Nothing renders on other days or when
 * the Almanac has no week card. Shares only a card whose leans are shareable.
 */
export function WeekRecap({ day, me }: { day: AlmanacDay | null; me: SharePerson }) {
  const theme = useTheme();
  const shown = useAlmanacCard('you.week', day);
  const [sharing, setSharing] = useState(false);
  if (!shown) return null;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{WEEK_RECAP_TITLE}</ThemedText>
      <ThemedText>{shown.text}</ThemedText>
      {cardIsShareable(shown.card, day?.ctx.leans) ? (
        <>
          <ThemedPressable
            accessibilityRole="button"
            accessibilityLabel="Share your week"
            onPress={() => setSharing(true)}
            style={[styles.chip, { borderColor: controlBorderColor(theme), borderRadius: theme.cutCorners ? 0 : 999 }]}>
            <ThemedText type="smallBold">{RECAP_SHARE_LABEL}</ThemedText>
          </ThemedPressable>
          <ShareCardSheet
            visible={sharing}
            onClose={() => setSharing(false)}
            me={me}
            content={{ kind: 'line', text: shown.text }}
          />
        </>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, gap: Spacing.two },
  chip: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
});
