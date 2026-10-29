import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GradientFill } from '@/components/quests/glass';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { EASE_OUT, PLUS_POP } from '@/lib/motion-tokens';
import { STAT_LABEL, UI_COPY, fmt } from '@/lib/quests/strings';
import { QT, QT_BAR, QT_SPACE, QT_TYPE } from '@/lib/quests/theme';
import { STATS, type Stat } from '@/lib/quests/types';
import type { StatChange } from '@/lib/quests/view';

const MAX = 6;
/** Floating ±1 markers leave 120 ms apart, left to right. */
const FLOAT_GAP_MS = 120;

function Bar({ stat, value, change, order, beatKey }: { stat: Stat; value: number; change: number; order: number; beatKey: number }) {
  const rm = useMotionReduced();
  const shown = useSharedValue(value);
  const float = useSharedValue(0);
  const glow = useSharedValue(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      shown.value = value;
      return;
    }
    if (rm) {
      // Reduce Motion: the bar jumps and glows for 300 ms.
      shown.value = value;
      glow.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 220 }));
    } else {
      shown.value = withTiming(value, { duration: 350, easing: EASE_OUT });
    }
  }, [value, rm, shown, glow]);

  useEffect(() => {
    if (!change) return;
    float.value = 0;
    float.value = withDelay(order * FLOAT_GAP_MS, withTiming(1, { duration: PLUS_POP.durationMs }));
  }, [change, beatKey, order, float]);

  const fill = useAnimatedStyle(() => ({ width: `${(shown.value / MAX) * 100}%` }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value * 0.6 }));
  const popStyle = useAnimatedStyle(() => {
    const t = float.value;
    const live = t > 0 && t < 1;
    return {
      opacity: live ? 1 - t : 0,
      transform: [{ translateY: rm ? 0 : -PLUS_POP.risePt * t }],
    };
  });

  const color = QT_BAR.fill[stat];
  return (
    <View
      style={styles.stat}
      accessible
      accessibilityLabel={fmt(UI_COPY.statValue, { stat: STAT_LABEL[stat], n: value, max: MAX })}
    >
      <View style={styles.head}>
        <Text style={styles.name} numberOfLines={1}>
          {STAT_LABEL[stat]}
        </Text>
        <Text style={styles.num}>
          {value}/{MAX}
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: color }, fill]}>
          {stat === 'renown' ? <GradientFill stops={[{ offset: 0, color: QT.cyan }, { offset: 1, color: QT_BAR.renownEnd }]} radius={QT_BAR.radius} /> : null}
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.glow, { backgroundColor: color }, glowStyle]} />
      </View>
      <Animated.Text pointerEvents="none" style={[styles.pop, { color: change > 0 ? QT.teal : QT.rose }, popStyle]}>
        {change > 0 ? `+${change}` : `${change}`}
      </Animated.Text>
    </View>
  );
}

/** The three party bars ("n/6" each). `changes` come from one beat and animate once. */
export function StatBars({
  stats,
  changes,
  beatKey,
}: {
  stats: Record<Stat, number>;
  changes: readonly StatChange[];
  /** Counts up with every beat, so the same +1 twice in a row still floats. */
  beatKey: number;
}) {
  return (
    <View style={styles.row}>
      {STATS.map((stat, i) => (
        <Bar
          key={stat}
          stat={stat}
          value={stats[stat]}
          change={changes.find((c) => c.stat === stat)?.delta ?? 0}
          order={i}
          beatKey={beatKey}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: QT_SPACE.cardGap, paddingHorizontal: QT_SPACE.gutter },
  stat: { flex: 1, gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { ...QT_TYPE.label, color: QT.sub, flexShrink: 1 },
  num: { ...QT_TYPE.number, color: QT.text, fontSize: 16 },
  track: { height: QT_BAR.height, borderRadius: QT_BAR.radius, backgroundColor: QT.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: QT_BAR.radius, overflow: 'hidden' },
  glow: { ...StyleSheet.absoluteFillObject },
  pop: { position: 'absolute', right: 0, top: -6, ...QT_TYPE.number, fontSize: 16 },
});
