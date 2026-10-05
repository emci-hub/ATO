import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadDailyLineState } from '@/lib/daily-line/state';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { localYmd } from '@/lib/local-date';
import {
  POLISH_COPY_REVIEWED,
  YOUR_WEEK_ANSWERS,
  YOUR_WEEK_DAYS,
  YOUR_WEEK_ME,
  YOUR_WEEK_TITLE,
  yourWeekLine,
} from '@/lib/polish-copy';
import { fetchTraitHistory } from '@/lib/trait-history-store';
import type { TraitSource } from '@/lib/traits';
import { lastSevenDays } from '@/lib/week-strip';

/** The sources a question answer writes (the intake bank, rounds, the grid). */
const ANSWER_SOURCES: ReadonlySet<TraitSource> = new Set<TraitSource>(['self_situation', 'self_scenario', 'self_grid']);

/**
 * You: the last seven days in three counts (polish pass, emci 2026-10-05) —
 * days the app's line was opened and "That's me" taps (both already on the
 * phone), and answers given (one read of the answer log). Counts of what you
 * did, never a score about you. No model call.
 */
export function YourWeekCard({ me }: { me: { id: string; timezone?: string | null } }) {
  const theme = useTheme();
  const [week, setWeek] = useState<{ days: number; me: number; answers: number | null } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const today = localYmd(new Date(), me.timezone || 'UTC');
      const since = Date.now() - 7 * 86_400_000;
      loadDailyLineState(me.id)
        .then((state) => {
          if (cancelled) return;
          const summary = lastSevenDays(today, state.days);
          setWeek((prev) => ({ days: summary.daysOpened, me: summary.thatsMe, answers: prev?.answers ?? null }));
        })
        .catch((err) => console.log('[your-week] line state error:', err));
      // Answers only: a tap, a confirm or a settings slider is not an answer.
      fetchTraitHistory(me.id, new Date(since).toISOString())
        .then((rows) => {
          if (cancelled) return;
          const answers = rows.filter((row) => ANSWER_SOURCES.has(row.source)).length;
          setWeek((prev) => ({ days: prev?.days ?? 0, me: prev?.me ?? 0, answers }));
        })
        .catch((err) => console.log('[your-week] history error:', err));
      return () => {
        cancelled = true;
      };
    }, [me.id, me.timezone]),
  );

  if (!week) return null;

  const stats: { value: number | null; label: string }[] = [
    { value: week.days, label: YOUR_WEEK_DAYS },
    { value: week.answers, label: YOUR_WEEK_ANSWERS },
    { value: week.me, label: YOUR_WEEK_ME },
  ];

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{YOUR_WEEK_TITLE}</ThemedText>
      <View style={styles.stats}>
        {stats.map((stat) => (
          <View
            key={stat.label}
            style={[
              styles.stat,
              { backgroundColor: theme.backgroundSelected, borderRadius: theme.cutCorners ? 0 : Math.min(theme.radius, 12) },
            ]}>
            <ThemedText type="subheading">{stat.value ?? '–'}</ThemedText>
            <ThemedText type="code" themeColor="textSecondary">
              {stat.label}
            </ThemedText>
          </View>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {yourWeekLine(week.days)}
      </ThemedText>
      {!POLISH_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
        <ThemedText type="code" themeColor="textSecondary">
          Draft copy — waiting on emci review.
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    padding: Spacing.two,
    gap: Spacing.half,
  },
});
