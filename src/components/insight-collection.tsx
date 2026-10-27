import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { PlusPop } from '@/components/plus-pop';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { useTheme } from '@/hooks/use-theme';
import { INSIGHT_COLLECTION_TOTAL, collectionPercent } from '@/lib/insight-collection';
import { loadCollection, recordInsightSeen } from '@/lib/insight-collection-store';
import { BAR_FILL, EASE_OUT, haptic } from '@/lib/motion-tokens';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * "Insights seen" (PHASE-09): how many of the stored insights this account has
 * had as its daily focus, out of all of them, kept on the phone only. It
 * counts the title the focus card reports (`shownTitle`). The bar fills over
 * 1 s; a new one adds a Light haptic and a "+1". Never a rank or a deadline.
 * Reduce Motion: the bar and number simply update; the haptic stays.
 */
export function InsightCollection({
  userId,
  shownTitle,
  forceReduceMotion = false,
}: {
  userId: string;
  shownTitle: string | null;
  forceReduceMotion?: boolean;
}) {
  const theme = useTheme();
  const rm = useMotionReduced(forceReduceMotion);
  const [seen, setSeen] = useState<number | null>(null);
  const [plus, setPlus] = useState(0);
  const fill = useSharedValue(0);

  useEffect(() => {
    let live = true;
    setSeen(null);
    void loadCollection(userId).then((ids) => {
      if (live) setSeen(ids.length);
    });
    return () => {
      live = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!shownTitle) return;
    let live = true;
    void recordInsightSeen(userId, shownTitle).then(({ ids, added }) => {
      if (!live) return;
      setSeen(ids.length);
      if (added) {
        haptic.commit();
        setPlus((n) => n + 1);
      }
    });
    return () => {
      live = false;
    };
  }, [userId, shownTitle]);

  const total = INSIGHT_COLLECTION_TOTAL;
  const ratio = seen ? Math.min(1, seen / total) : 0;
  useEffect(() => {
    if (seen === null) return;
    if (rm) {
      cancelAnimation(fill);
      fill.value = ratio;
      return;
    }
    fill.value = withTiming(ratio, { duration: BAR_FILL.durationMs, easing: EASE_OUT });
    return () => cancelAnimation(fill);
  }, [seen, ratio, rm, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  if (seen === null) return null;
  const percent = collectionPercent(seen, total);
  const label =
    seen === 0
      ? `Insights seen: none yet, out of ${total}. Each daily focus you load adds one.`
      : `Insights seen: ${seen} of ${total}, ${percent} percent.`;

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: controlBorderColor(theme) }]}
      testID="insight-collection">
      <View accessible accessibilityLabel={label} style={styles.body}>
        <View style={styles.head}>
          <ThemedText type="smallBold">Insights seen</ThemedText>
          <View style={styles.count}>
            <ThemedText type="smallBold">{`${seen} / ${total}`}</ThemedText>
            <PlusPop label="+1" trigger={plus} forceReduceMotion={forceReduceMotion} />
          </View>
        </View>
        <View style={[styles.track, { backgroundColor: theme.backgroundSelected, borderColor: controlBorderColor(theme) }]}>
          <Animated.View style={[styles.fill, { backgroundColor: theme.accent }, fillStyle]} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {seen === 0 ? 'Each daily focus you load adds one.' : `${percent}% of the collection.`}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, borderWidth: 1, padding: Spacing.three },
  body: { gap: Spacing.two },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  count: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  track: { height: 8, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
