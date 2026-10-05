import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TraitShape } from '@/components/trait-shape';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Me } from '@/lib/me';
import { traitShapePoints } from '@/lib/trait-shape';
import type { TraitTrack } from '@/lib/trait-stability';

/**
 * Questions: where you are in the 48, drawn (polish pass, emci 2026-10-05).
 * Three bars of 16 ticks — earlier sets full, the current one filling, later
 * ones empty — and the small shape gaining a point for every trait answered.
 * Also used for a round: one bar.
 */
export function SetProgress({
  title,
  bars,
  size,
  me,
  tracks,
  footnote,
}: {
  title: string;
  /** Answered count per bar, e.g. [16, 5, 0]. */
  bars: readonly number[];
  /** Ticks per bar (16). */
  size: number;
  me: Me;
  tracks: readonly TraitTrack[];
  footnote?: string;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.head}>
        <View style={styles.text}>
          <ThemedText type="smallBold">{title}</ThemedText>
          {footnote ? (
            <ThemedText type="small" themeColor="textSecondary">
              {footnote}
            </ThemedText>
          ) : null}
        </View>
        <TraitShape points={traitShapePoints(me, tracks)} size={52} />
      </View>
      <View style={styles.bars}>
        {bars.map((filled, i) => (
          <TickBar key={i} filled={filled} total={size} />
        ))}
      </View>
    </ThemedView>
  );
}

/** One bar of `total` ticks, the first `filled` of them lit. */
export function TickBar({ filled, total }: { filled: number; total: number }) {
  const theme = useTheme();
  return (
    <View style={styles.bar} accessible accessibilityLabel={`${filled} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.tick,
            {
              backgroundColor: i < filled ? theme.accent : theme.backgroundSelected,
              borderRadius: theme.cutCorners ? 0 : 2,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  bars: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
  },
  tick: {
    flex: 1,
    height: 8,
  },
});
