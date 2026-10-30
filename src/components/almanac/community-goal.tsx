import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { communityEventFor, communityLine, eventYear, nextGoal } from '@/lib/almanac/community';
import type { DayTheme } from '@/lib/almanac/resolve';
import { fetchEventTotal } from '@/lib/daily-pick/store';

/**
 * Home, build and peak days of a global event. One bar of everyone's seasonal
 * Picks this year. Hidden, never an error, while wave117 is missing, the phone is
 * offline, or fewer than 20 people have answered. A total only; no one's answer.
 */
export function CommunityGoal({ theme: day }: { theme: DayTheme }) {
  const theme = useTheme();
  const event = communityEventFor(day);
  const year = event ? eventYear(event, day.ymd) : Number(day.ymd.slice(0, 4));
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    setTotal(null);
    if (!event) return;
    let live = true;
    void fetchEventTotal(event, year).then((n) => {
      if (live) setTotal(n);
    });
    return () => {
      live = false;
    };
  }, [event, year]);

  if (!event || total == null) return null;
  const goal = nextGoal(total);
  const share = Math.min(1, total / goal);
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="small" themeColor="textSecondary">
        {communityLine(event, total, goal)}
      </ThemedText>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: goal, now: total }}
        style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { width: `${Math.round(share * 100)}%`, backgroundColor: theme.accent }]} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
