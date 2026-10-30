import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';

import { cardIsShareable, useAlmanacCard } from '@/components/almanac/use-almanac-card';
import { ShareCardSheet, type SharePerson } from '@/components/share-card';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { useTheme } from '@/hooks/use-theme';
import { monthlyShifts, type TraitShift } from '@/lib/almanac/shift';
import type { AlmanacDay } from '@/hooks/use-almanac-day';
import { BAR_FILL, EASE_OUT } from '@/lib/motion-tokens';
import { controlBorderColor } from '@/lib/theme/chrome';
import { fetchTraitHistory } from '@/lib/trait-history-store';

export const MONTH_SHIFT_TITLE = 'What shifted';

const W = 220;
const ROW = 16;
const HALF = W / 2;

/** A mini diverging chart: a bar per trait, left = toward the low pole, right = toward the high pole. */
export function ShiftChart({ shifts, forceReduceMotion = false }: { shifts: readonly TraitShift[]; forceReduceMotion?: boolean }) {
  const theme = useTheme();
  const rm = useMotionReduced(forceReduceMotion);
  const grow = useSharedValue(rm ? 1 : 0);
  useEffect(() => {
    // Reduce Motion: the same grow, at half speed (never still).
    const duration = rm ? BAR_FILL.durationMs * 2 : BAR_FILL.durationMs;
    grow.value = 0;
    grow.value = withTiming(1, { duration, easing: EASE_OUT });
    return () => cancelAnimation(grow);
  }, [rm, grow, shifts]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.value }] }));
  const height = shifts.length * ROW + 4;
  return (
    <View accessible accessibilityLabel={shifts.map((s) => `Moved toward ${s.toward}`).join('. ')}>
      <Animated.View style={style}>
        <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`}>
          <Line x1={HALF} y1={0} x2={HALF} y2={height} stroke={theme.textSecondary} strokeOpacity={0.4} />
          {shifts.map((shift, i) => {
            const len = Math.max(4, Math.min(1, Math.abs(shift.delta) * 2.5) * (HALF - 4));
            const x = shift.delta > 0 ? HALF : HALF - len;
            return <Rect key={shift.axis} x={x} y={2 + i * ROW} width={len} height={ROW - 6} rx={2} fill={theme.accent} />;
          })}
        </Svg>
      </Animated.View>
    </View>
  );
}

/**
 * You, monthly: the biggest moves of the last month as a small chart, with the
 * Almanac's "then and now" line (a `you.month` card). Nothing renders when the
 * Almanac has no month card today or nothing moved.
 */
export function MonthShift({ day, me }: { day: AlmanacDay | null; me: SharePerson }) {
  const theme = useTheme();
  const shown = useAlmanacCard('you.month', day);
  const [shifts, setShifts] = useState<TraitShift[] | null>(null);
  const [sharing, setSharing] = useState(false);
  const userId = day?.ctx.userId;

  useEffect(() => {
    setShifts(null);
    if (!userId || !shown) return;
    let live = true;
    const since = new Date(Date.now() - 62 * 86_400_000).toISOString();
    fetchTraitHistory(userId, since)
      .then((rows) => live && setShifts(monthlyShifts(rows, new Date())))
      .catch(() => live && setShifts([]));
    return () => {
      live = false;
    };
  }, [userId, shown]);

  if (!shown) return null;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{MONTH_SHIFT_TITLE}</ThemedText>
      {shifts && shifts.length > 0 ? (
        <>
          <ShiftChart shifts={shifts} />
          <View style={styles.labels}>
            {shifts.map((s) => (
              <ThemedText key={s.axis} type="small" themeColor="textSecondary">
                {`More ${s.toward}`}
              </ThemedText>
            ))}
          </View>
        </>
      ) : null}
      <ThemedText>{shown.text}</ThemedText>
      {cardIsShareable(shown.card, day?.ctx.leans) ? (
        <>
          <ThemedPressable
            accessibilityRole="button"
            accessibilityLabel="Share what shifted"
            onPress={() => setSharing(true)}
            style={[styles.chip, { borderColor: controlBorderColor(theme), borderRadius: theme.cutCorners ? 0 : 999 }]}>
            <ThemedText type="smallBold">Share</ThemedText>
          </ThemedPressable>
          <ShareCardSheet visible={sharing} onClose={() => setSharing(false)} me={me} content={{ kind: 'line', text: shown.text }} />
        </>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, gap: Spacing.two },
  labels: { gap: Spacing.half },
  chip: { alignSelf: 'flex-end', borderWidth: 1, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three },
});
