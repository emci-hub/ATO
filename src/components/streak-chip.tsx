import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadDailyLineState } from '@/lib/daily-line/state';
import { streakGlowLabel, streakWithRest } from '@/lib/home-path';
import { MOTION_GOLD } from '@/lib/motion-tokens';

export const STREAK_REST_NOTE = 'Rest day kept';

/**
 * Home: "N-day glow" (PHASE-08). Days the line was opened in a row; one free
 * rest day a week keeps it going. No repair to buy, no warning when it is
 * about to end, nothing shown at 0. Static: no motion of its own.
 */
export function StreakChip({
  userId,
  todayYmd,
  refreshKey,
}: {
  userId: string;
  todayYmd: string;
  /** Changes when today's line lands or is reacted to. */
  refreshKey?: unknown;
}) {
  const theme = useTheme();
  const [glow, setGlow] = useState<{ streak: number; rested: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDailyLineState(userId)
      .then((state) => {
        if (cancelled) return;
        const { streak, restDays } = streakWithRest(
          state.days.map((day) => day.ymd),
          todayYmd,
        );
        setGlow({ streak, rested: restDays.length > 0 });
      })
      .catch((err) => console.log('[streak-chip] load error:', err));
    return () => {
      cancelled = true;
    };
  }, [userId, todayYmd, refreshKey]);

  if (!glow || glow.streak < 1) return null;
  const label = streakGlowLabel(glow.streak);

  return (
    <ThemedView
      type="backgroundElement"
      style={styles.chip}
      accessible
      accessibilityLabel={glow.rested ? `${label}. ${STREAK_REST_NOTE}.` : label}>
      <View style={[styles.spark, { backgroundColor: MOTION_GOLD }]} />
      <ThemedText type="smallBold">{label}</ThemedText>
      {glow.rested ? (
        <View style={styles.rest}>
          <MaterialCommunityIcons name="weather-night" size={16} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            {STREAK_REST_NOTE}
          </ThemedText>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.two,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  spark: { width: 10, height: 10, borderRadius: 5 },
  rest: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
