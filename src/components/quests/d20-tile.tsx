import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Glass } from '@/components/quests/glass';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { EASE_IN_OUT, EASE_OUT, haptic } from '@/lib/motion-tokens';
import { rollPasses } from '@/lib/quests/d20';
import { STAT_LABEL, UI_COPY, fmt } from '@/lib/quests/strings';
import { QT, QT_RADIUS, QT_TYPE } from '@/lib/quests/theme';
import type { QuestCheck } from '@/lib/quests/types';

const FLIP_MS = 700;
const HIT_STOP_MS = 120;

/**
 * The d20 tile: it flips twice (700 ms), holds for 120 ms, then lands. A win
 * sparkles with a Success haptic (a natural 20 gets the Heavy one); a miss
 * shakes 2 px three times with a Warning haptic. A miss is another branch, never
 * a game over. Reduce Motion: the number fades in, the haptics stay.
 * `value` is the party stat at the moment of the roll.
 */
export function D20Tile({ roll, check, value }: { roll: number; check: QuestCheck; value: number }) {
  const rm = useMotionReduced();
  const success = rollPasses(roll, value, check.dc);
  const [faceUp, setFaceUp] = useState(rm);
  const [landed, setLanded] = useState(false);

  const turn = useSharedValue(0);
  const shake = useSharedValue(0);
  const glow = useSharedValue(0);
  const burst = useSharedValue(0);
  const fade = useSharedValue(rm ? 0 : 1);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const land = () => {
      setLanded(true);
      if (success) {
        if (roll >= 20) haptic.stamp();
        else haptic.success();
      } else {
        haptic.fail();
      }
    };
    if (rm) {
      fade.value = withTiming(1, { duration: 300 });
      timers.push(setTimeout(land, 300));
    } else {
      turn.value = withTiming(720, { duration: FLIP_MS, easing: EASE_IN_OUT });
      timers.push(setTimeout(() => setFaceUp(true), FLIP_MS / 2));
      timers.push(
        setTimeout(() => {
          land();
          glow.value = withSequence(withTiming(1, { duration: 120 }), withTiming(success ? 0.5 : 0.2, { duration: 400 }));
          if (success) {
            burst.value = withTiming(1, { duration: 500, easing: EASE_OUT });
          } else {
            shake.value = withSequence(
              withTiming(2, { duration: 40 }),
              withTiming(-2, { duration: 40 }),
              withTiming(2, { duration: 40 }),
              withTiming(-2, { duration: 40 }),
              withTiming(2, { duration: 40 }),
              withTiming(0, { duration: 40 }),
            );
          }
        }, FLIP_MS + HIT_STOP_MS),
      );
    }
    return () => timers.forEach(clearTimeout);
    // Runs once per tile: a new roll is a new tile (the screen keys it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tile = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${turn.value}deg` }, { translateX: shake.value }],
  }));
  const face = useAnimatedStyle(() => ({ opacity: fade.value }));
  const halo = useAnimatedStyle(() => ({ opacity: glow.value }));
  const sparkle = useAnimatedStyle(() => ({
    opacity: burst.value > 0 && burst.value < 1 ? 1 - burst.value : 0,
    transform: [{ scale: 0.4 + burst.value }],
  }));

  const tint = success ? QT.teal : QT.rose;
  const total = roll + value;
  const sum = fmt(UI_COPY.d20Sum, { roll, stat: STAT_LABEL[check.stat], total, dc: check.dc });
  const outcome = success ? UI_COPY.d20Win : UI_COPY.d20Lose;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={landed ? `${fmt(UI_COPY.d20Roll, { roll })}. ${sum}. ${outcome}` : fmt(UI_COPY.d20Roll, { roll })}
    >
      <View style={styles.tileWrap}>
        <Animated.View pointerEvents="none" style={[styles.halo, { backgroundColor: tint }, halo]} />
        <Animated.View style={tile}>
          <Glass radius={QT_RADIUS.tile} shadow={false} style={styles.tile}>
            <Animated.Text style={[styles.number, { color: faceUp ? tint : QT.sky }, face]}>{faceUp ? roll : 'd20'}</Animated.Text>
          </Glass>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.sparkle, sparkle]}>
          <Svg width={72} height={72} viewBox="0 0 24 24">
            <Path d="M12 1 L13.5 10.5 L23 12 L13.5 13.5 L12 23 L10.5 13.5 L1 12 L10.5 10.5 Z" fill={QT.sky} />
          </Svg>
        </Animated.View>
      </View>
      <View style={styles.words}>
        <Text style={styles.sum}>{sum}</Text>
        {landed || rm ? <Text style={[styles.outcome, { color: tint }]}>{outcome}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  tileWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  tile: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  number: { ...QT_TYPE.number, fontSize: 30 },
  halo: { position: 'absolute', width: 64, height: 64, borderRadius: QT_RADIUS.tile + 4 },
  sparkle: { position: 'absolute' },
  words: { flex: 1, gap: 2 },
  sum: { ...QT_TYPE.small, color: QT.sub },
  outcome: { ...QT_TYPE.ui },
});
