import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** What the pill says, and what a screen reader reads. */
export const AI_BADGE_LABEL = 'AI';
export const AI_BADGE_A11Y = 'Written by AI';

/**
 * A small "AI" pill on every surface that still shows text a model wrote
 * (emci, 2026-10-07). Stored copy — the Focus · try · watch bank, the
 * category cards, the daily lines, Today's Pick — never carries it, so the
 * pill only ever means "a model wrote this".
 *
 * Where it is today: the Story fold, the one mounted surface that renders
 * generateText output. Sage title, Explore observations, the Sage insight
 * spend, Rolls and Legends are not mounted anywhere right now; each gets the
 * pill when it comes back. Talk is a placeholder with no AI and gets it when
 * it is rebuilt.
 */
export function AiBadge() {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={AI_BADGE_A11Y}
      style={[
        styles.pill,
        {
          borderColor: theme.textSecondary,
          borderRadius: theme.cutCorners ? 0 : 999,
        },
      ]}>
      <ThemedText type="code" themeColor="textSecondary" style={styles.text}>
        {AI_BADGE_LABEL}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  text: {
    fontSize: 11,
    lineHeight: 14,
  },
});
