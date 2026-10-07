import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** What a screen reader reads on the icon. */
export const AI_BADGE_A11Y = 'Written by AI. Tap for details.';
/** What one tap on the icon shows (emci, 2026-10-07). Clear voice. */
export const AI_BADGE_DESCRIPTION =
  'AI wrote this from your answers. It can get things wrong, so keep what fits you and skip the rest.';

/**
 * The AI mark (emci, 2026-10-07): a small sparkle icon on every surface that
 * still shows text a model wrote. One tap opens a short description under it;
 * another tap closes it. Stored copy (the Focus · try · watch bank, the
 * category cards, the daily lines, Today's Pick) never carries it, so the icon
 * only ever means "a model wrote this".
 *
 * Where it is today: the Story fold, the one mounted surface that renders
 * generateText output. Sage title, Explore observations, the Sage insight
 * spend, Rolls and Legends are not mounted anywhere right now; each gets the
 * icon when it comes back. Talk is a placeholder with no AI and gets it when
 * it is rebuilt.
 */
export function AiBadge() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={AI_BADGE_A11Y}
        accessibilityState={{ expanded: open }}
        hitSlop={10}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [
          styles.icon,
          {
            borderColor: theme.textSecondary,
            borderRadius: theme.cutCorners ? 0 : 999,
            backgroundColor: open ? theme.backgroundSelected : 'transparent',
          },
          pressed && styles.pressed,
        ]}>
        <MaterialCommunityIcons name="creation" size={13} color={theme.textSecondary} />
        <ThemedText type="code" themeColor="textSecondary" style={styles.label}>
          AI
        </ThemedText>
      </Pressable>
      {open ? (
        <View
          style={[
            styles.note,
            { backgroundColor: theme.backgroundSelected, borderRadius: theme.cutCorners ? 0 : 10 },
          ]}>
          <ThemedText type="small" themeColor="textSecondary">
            {AI_BADGE_DESCRIPTION}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    gap: Spacing.one,
  },
  icon: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    borderWidth: 1,
    paddingHorizontal: Spacing.one + Spacing.half,
    paddingVertical: Spacing.half,
  },
  label: {
    fontSize: 10,
    lineHeight: 13,
  },
  note: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});
