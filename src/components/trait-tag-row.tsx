import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The one trait tag row on a stored card (emci, 2026-10-07): a chip per tag,
 * e.g. "Reassurance: Watchful", or "General" for a starter. It is the card's
 * only tag or label — never render a second one, and never a sentence here.
 */
export function TraitTagRow({ tags }: { tags: readonly string[] }) {
  const theme = useTheme();
  if (tags.length === 0) return null;
  return (
    <View style={styles.row} accessibilityLabel={`Traits: ${tags.join(', ')}`}>
      {tags.map((tag) => (
        <View
          key={tag}
          style={[
            styles.chip,
            {
              backgroundColor: theme.backgroundSelected,
              borderRadius: theme.cutCorners ? 0 : 999,
            },
          ]}>
          <ThemedText type="code" themeColor="textSecondary" style={styles.text} numberOfLines={1}>
            {tag}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    maxWidth: '100%',
  },
  text: {
    fontSize: 11,
    lineHeight: 15,
  },
});
