import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { ContinueButton, LineText } from '@/components/quests/dialogue';
import { Glass, GradientFill } from '@/components/quests/glass';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { BAR_FILL, EASE_OUT } from '@/lib/motion-tokens';
import { UI_COPY, fmt } from '@/lib/quests/strings';
import { QT, QT_BAR, QT_SPACE, QT_TYPE } from '@/lib/quests/theme';
import type { QuestEnding } from '@/lib/quests/types';
import { endingProgress } from '@/lib/quests/view';

/**
 * The ending: the title fades up after the plate has assembled and the light
 * has swept across (the stage does those), then the "Ending 2 of 4" bar fills.
 * Reduce Motion: a plain fade and the bar jumps.
 */
export function EndingCard({
  ending,
  found,
  total,
  onContinue,
}: {
  ending: QuestEnding;
  found: number;
  total: number;
  onContinue: () => void;
}) {
  const rm = useMotionReduced();
  const title = useSharedValue(0);
  const body = useSharedValue(0);
  const bar = useSharedValue(rm ? endingProgress(found, total) : 0);

  useEffect(() => {
    if (rm) {
      title.value = withTiming(1, { duration: 300 });
      body.value = withDelay(100, withTiming(1, { duration: 300 }));
      bar.value = endingProgress(found, total);
      return;
    }
    title.value = withDelay(900, withTiming(1, { duration: 500, easing: EASE_OUT }));
    body.value = withDelay(1300, withTiming(1, { duration: 400 }));
    bar.value = withDelay(1500, withTiming(endingProgress(found, total), { duration: BAR_FILL.durationMs, easing: EASE_OUT }));
  }, [rm, found, total, title, body, bar]);

  const titleStyle = useAnimatedStyle(() => ({ opacity: title.value, transform: [{ translateY: rm ? 0 : (1 - title.value) * 12 }] }));
  const bodyStyle = useAnimatedStyle(() => ({ opacity: body.value }));
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));
  const label = fmt(UI_COPY.endingOf, { n: found, total });

  return (
    <Glass style={styles.card}>
      <Text style={styles.kicker}>{UI_COPY.endingFound}</Text>
      <Animated.Text style={[styles.title, titleStyle]} accessibilityRole="header">
        {ending.title}
      </Animated.Text>
      <Animated.View style={[styles.lines, bodyStyle]}>
        {ending.lines.map((line, i) => (
          <LineText key={i} line={line} chars={null} />
        ))}
      </Animated.View>
      <View accessible accessibilityLabel={label} style={styles.progress}>
        <Text style={styles.small}>{label}</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, barStyle]}>
            <GradientFill radius={QT_BAR.radius} />
          </Animated.View>
        </View>
      </View>
      <ContinueButton onPress={onContinue} />
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: QT_SPACE.pad + 2, gap: 12 },
  kicker: { ...QT_TYPE.label, color: QT.amber },
  title: { ...QT_TYPE.h1, color: QT.text },
  lines: { gap: 8 },
  progress: { gap: 6 },
  small: { ...QT_TYPE.small, color: QT.sub },
  track: { height: QT_BAR.height, borderRadius: QT_BAR.radius, backgroundColor: QT.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: QT_BAR.radius, overflow: 'hidden' },
});
