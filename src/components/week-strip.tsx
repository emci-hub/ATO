import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadDailyLineState } from '@/lib/daily-line/state';
import { WEEK_STRIP_TITLE } from '@/lib/polish-copy';
import { useAppearance } from '@/lib/theme/context';
import { weekDots, type WeekDot } from '@/lib/week-strip';

/**
 * Home: this week as seven dots, filled for each day today's line was opened
 * (the history is already on the phone — no read, no model call). Replaces the
 * old "N days in a row" text. Today's dot breathes unless Reduce Motion is on.
 */
export function WeekStrip({
  userId,
  todayYmd,
  refreshKey,
}: {
  userId: string;
  todayYmd: string;
  /** Changes when today's line lands or is reacted to. */
  refreshKey?: unknown;
}) {
  const [dots, setDots] = useState<WeekDot[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDailyLineState(userId)
      .then((state) => {
        if (!cancelled) setDots(weekDots(todayYmd, state.days));
      })
      .catch((err) => console.log('[week-strip] load error:', err));
    return () => {
      cancelled = true;
    };
  }, [userId, todayYmd, refreshKey]);

  if (!dots) return null;
  const opened = dots.filter((dot) => dot.opened).length;

  return (
    <ThemedView
      type="backgroundElement"
      style={styles.card}
      accessible
      accessibilityLabel={`${WEEK_STRIP_TITLE}: opened on ${opened} of 7 days`}>
      <View style={styles.head}>
        <ThemedText type="smallBold">{WEEK_STRIP_TITLE}</ThemedText>
        <ThemedText type="code" themeColor="textSecondary">
          {opened} of 7
        </ThemedText>
      </View>
      <View style={styles.row}>
        {dots.map((dot) => (
          <View key={dot.ymd} style={styles.day}>
            <ThemedText type="code" themeColor="textSecondary" style={styles.letter}>
              {dot.letter}
            </ThemedText>
            <Dot dot={dot} />
          </View>
        ))}
      </View>
    </ThemedView>
  );
}

function Dot({ dot }: { dot: WeekDot }) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const glow = useSharedValue(1);
  useEffect(() => {
    if (!dot.isToday || reduceMotion) {
      cancelAnimation(glow);
      glow.value = 1;
      return;
    }
    glow.value = withRepeat(withTiming(1.12, { duration: 1100 }), -1, true);
  }, [dot.isToday, reduceMotion, glow]);
  const breathe = useAnimatedStyle(() => ({ transform: [{ scale: glow.value }] }));

  const filled = dot.opened;
  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: filled ? theme.accent : 'transparent',
          borderColor: dot.isToday ? theme.accent : theme.border,
          borderStyle: filled || dot.isToday ? 'solid' : 'dashed',
          borderWidth: dot.isToday && !filled ? 2 : filled ? 0 : 1.5,
          opacity: dot.future ? 0.45 : 1,
          borderRadius: theme.cutCorners ? 4 : 999,
        },
        dot.isToday ? breathe : null,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    alignItems: 'center',
    gap: Spacing.one,
    flex: 1,
  },
  letter: {
    fontSize: 11,
  },
  dot: {
    width: 26,
    height: 26,
  },
});
