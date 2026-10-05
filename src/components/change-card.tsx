import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAccountDataEpoch } from '@/lib/account-data-epoch';
import { AXIS_POLE_NAME, AXIS_SHORT_NAME } from '@/lib/axis-poles';
import { CHANGE_EMPTY, CHANGE_LABEL, CHANGE_LEDE, traitChanges, type TraitChange } from '@/lib/trait-change';
import { fetchTraitHistory } from '@/lib/trait-history-store';
import type { TraitAxis } from '@/lib/traits';

/**
 * Explore: what actually moved in this person's answers lately. One plain read
 * of `trait_history`, no model call. Hidden while loading or on a failed read —
 * an error box here would be noise on a screen that works without it.
 */
export function ChangeCard({ userId }: { userId: string }) {
  const dataEpoch = useAccountDataEpoch();
  const [changes, setChanges] = useState<TraitChange[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTraitHistory(userId)
      .then((rows) => {
        if (!cancelled) setChanges(traitChanges(rows));
      })
      .catch((err) => {
        console.log('[change-card] history error:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, dataEpoch]);

  if (!changes) return null;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{CHANGE_LABEL}</ThemedText>
      {changes.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {CHANGE_EMPTY}
        </ThemedText>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {CHANGE_LEDE}
          </ThemedText>
          <View style={styles.rows}>
            {changes.map((change) => (
              <View key={change.axis} style={styles.change}>
                <ThemedText type="smallBold">
                  {AXIS_SHORT_NAME[change.axis]}, toward{' '}
                  {change.delta > 0 ? AXIS_POLE_NAME[change.axis].high : AXIS_POLE_NAME[change.axis].low}
                </ThemedText>
                <DriftTrack axis={change.axis} from={change.from} to={change.to} />
                <ThemedText type="small" themeColor="textSecondary">
                  {change.line}
                </ThemedText>
              </View>
            ))}
          </View>
        </>
      )}
    </ThemedView>
  );
}

/**
 * One trait as a track: a hollow dot where it stood, a filled dot where it is
 * now, the trait's two end words underneath. Positions only, no numbers.
 */
function DriftTrack({ axis, from, to }: { axis: TraitAxis; from: number; to: number }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const x = (v: number) => 7 + Math.min(1, Math.max(0, v)) * Math.max(0, width - 14);
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.track}>
      {width > 0 ? (
        <Svg width={width} height={16}>
          <Rect x={0} y={6} width={width} height={4} rx={2} fill={theme.backgroundSelected} />
          <Line x1={x(from)} y1={8} x2={x(to)} y2={8} stroke={theme.accent} strokeWidth={2} />
          <Circle cx={x(from)} cy={8} r={5} fill={theme.backgroundElement} stroke={theme.textSecondary} strokeWidth={1.5} strokeDasharray="2 1.5" />
          <Circle cx={x(to)} cy={8} r={6} fill={theme.accent} />
        </Svg>
      ) : null}
      <View style={styles.ends}>
        <ThemedText type="code" themeColor="textSecondary">
          {AXIS_POLE_NAME[axis].low}
        </ThemedText>
        <ThemedText type="code" themeColor="textSecondary">
          {AXIS_POLE_NAME[axis].high}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  change: {
    gap: Spacing.one,
  },
  track: {
    gap: Spacing.half,
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  rows: {
    gap: Spacing.three,
  },
});
