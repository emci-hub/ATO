import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { GradientFill, Glass } from '@/components/quests/glass';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { DUR, ENTER, EASE_OUT, haptic } from '@/lib/motion-tokens';
import { UI_COPY, APPROACH_LABEL } from '@/lib/quests/strings';
import { QT, QT_RADIUS, QT_SPACE, QT_TYPE } from '@/lib/quests/theme';
import type { Approach, QuestChoice, Stat } from '@/lib/quests/types';
import { checkBadge } from '@/lib/quests/view';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Hold 250 ms (or double-tap) to choose. */
export const HOLD_MS = 250;
const RING = { size: 30, stroke: 3 } as const;
const RING_R = (RING.size - RING.stroke) / 2;
const RING_LEN = 2 * Math.PI * RING_R;

/**
 * True when VoiceOver, TalkBack or Switch Control is on. Then one activation
 * chooses (R17): nobody has to hold.
 */
export function useAssistiveTouch(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    const read = () => {
      AccessibilityInfo.isScreenReaderEnabled().then((v) => alive && setOn((p) => p || v)).catch(() => {});
      // iOS only, and missing from the RN typings.
      const info = AccessibilityInfo as unknown as { isSwitchControlEnabled?: () => Promise<boolean> };
      if (Platform.OS === 'ios' && typeof info.isSwitchControlEnabled === 'function') {
        info.isSwitchControlEnabled().then((v) => alive && v && setOn(true)).catch(() => {});
      }
    };
    read();
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (v) => setOn(v));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}

/** The approach glyph: explore, hold steady, talk, act, wait. The player sees this, never the trait. */
export function ApproachIcon({ approach }: { approach: Approach }) {
  const common = { stroke: '#041014', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      {approach === 'explore' ? <Path d="M12 3 L21 12 L12 21 L3 12 Z" {...common} /> : null}
      {approach === 'steady' ? <Path d="M5 4 H19 V20 H5 Z M9 9 H15 M9 13 H15" {...common} /> : null}
      {approach === 'talk' ? <Path d="M4 5 H20 V16 H11 L6 20 V16 H4 Z" {...common} /> : null}
      {approach === 'act' ? <Path d="M5 19 L19 5 M5 5 L19 19 M4 20 L8 16 M20 20 L16 16" {...common} /> : null}
      {approach === 'wait' ? <Path d="M7 3 H17 L12 12 L17 21 H7 L12 12 Z" {...common} /> : null}
    </Svg>
  );
}

export type ChoiceState = 'idle' | 'selected' | 'dimmed';

/**
 * One choice: an approach tile on the left, the label, an optional hint, an
 * inline d20 badge, and a hold ring on the right. Tap picks it; holding for
 * 250 ms or a double-tap chooses it. The ring fills while you hold.
 */
export function ChoiceCard({
  choice,
  stats,
  index,
  state,
  onSelect,
  onChoose,
}: {
  choice: QuestChoice;
  stats: Record<Stat, number>;
  index: number;
  state: ChoiceState;
  onSelect: () => void;
  onChoose: () => void;
}) {
  const rm = useMotionReduced();
  const assistive = useAssistiveTouch();
  const badge = useMemo(() => (choice.check ? checkBadge(choice.check, stats) : null), [choice.check, stats]);

  const fill = useSharedValue(0);
  const dim = useSharedValue(state === 'dimmed' ? 0.35 : 1);
  useEffect(() => {
    dim.value = withTiming(state === 'dimmed' ? 0.35 : 1, { duration: DUR.small });
  }, [state, dim]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RING_LEN * (1 - fill.value) }));

  // The gesture is built once, so it reads the newest props through this ref.
  const latest = useRef({ onSelect, onChoose, selected: state === 'selected', dimmed: state === 'dimmed' });
  latest.current = { onSelect, onChoose, selected: state === 'selected', dimmed: state === 'dimmed' };
  useEffect(() => {
    if (state === 'idle') fill.value = withTiming(0, { duration: 120 });
  }, [state, fill]);

  const gesture = useMemo(() => {
    const beginHold = () => {
      fill.value = withTiming(1, { duration: HOLD_MS });
    };
    const endHold = () => {
      cancelAnimation(fill);
      if (!latest.current.selected) fill.value = withTiming(0, { duration: 120 });
    };
    // A card that is fading out while another is being committed does nothing.
    const choose = () => {
      if (latest.current.dimmed) return;
      haptic.commit();
      fill.value = 1;
      latest.current.onChoose();
    };
    const select = () => {
      if (!latest.current.dimmed) latest.current.onSelect();
    };
    const hold = Gesture.LongPress()
      .minDuration(HOLD_MS)
      // A vertical drag past this scrolls the list instead of choosing.
      .maxDistance(10)
      .onBegin(() => {
        runOnJS(beginHold)();
      })
      .onStart(() => {
        runOnJS(choose)();
      })
      .onFinalize(() => {
        runOnJS(endHold)();
      });
    const twice = Gesture.Tap()
      .numberOfTaps(2)
      .maxDistance(10)
      .onEnd((_e, ok) => {
        if (ok) runOnJS(choose)();
      });
    const once = Gesture.Tap()
      .numberOfTaps(1)
      .maxDistance(10)
      .onEnd((_e, ok) => {
        if (ok) runOnJS(select)();
      });
    // The single tap waits for the double tap to fail, so two quick taps choose.
    return Gesture.Race(hold, Gesture.Exclusive(twice, once));
  }, [fill]);

  const choose = () => {
    haptic.commit();
    fill.value = 1;
    onChoose();
  };

  const entering = rm ? FadeIn.duration(300) : FadeInDown.delay(index * ENTER.staggerMs).duration(ENTER.duration).easing(EASE_OUT);
  const label = [choice.label, APPROACH_LABEL[choice.approach], choice.hint, badge?.a11y].filter(Boolean).join('. ');

  const body = (
    <Glass radius={QT_RADIUS.choice} ring={state === 'selected'} shadow={false} style={styles.card}>
      <View style={styles.tile}>
        <GradientFill radius={QT_RADIUS.tile} />
        <ApproachIcon approach={choice.approach} />
      </View>
      <View style={styles.middle}>
        <Text style={styles.label}>{choice.label}</Text>
        {choice.hint ? <Text style={styles.hint}>{choice.hint}</Text> : null}
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge.text}</Text>
          </View>
        ) : null}
        {state === 'selected' && !assistive ? <Text style={styles.hold}>{UI_COPY.holdToChoose}</Text> : null}
      </View>
      <View style={styles.ringBox}>
        <Svg width={RING.size} height={RING.size}>
          <Circle cx={RING.size / 2} cy={RING.size / 2} r={RING_R} stroke={QT.track} strokeWidth={RING.stroke} fill="none" />
          <AnimatedCircle
            cx={RING.size / 2}
            cy={RING.size / 2}
            r={RING_R}
            stroke={state === 'selected' ? QT.amber : QT.cyan}
            strokeWidth={RING.stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={RING_LEN}
            animatedProps={ringProps}
            rotation={-90}
            originX={RING.size / 2}
            originY={RING.size / 2}
          />
        </Svg>
      </View>
    </Glass>
  );

  return (
    <Animated.View entering={entering} style={styles.wrap}>
      <Animated.View style={dimStyle}>
        {assistive ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityActions={[{ name: 'choose', label: UI_COPY.chooseAction }]}
            onAccessibilityAction={(e) => e.nativeEvent.actionName === 'choose' && choose()}
            onPress={choose}
            disabled={state === 'dimmed'}
          >
            {body}
          </Pressable>
        ) : (
          <GestureDetector gesture={gesture}>
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityHint={UI_COPY.chooseHint}
              accessibilityActions={[{ name: 'choose', label: UI_COPY.chooseAction }]}
              onAccessibilityAction={(e) => e.nativeEvent.actionName === 'choose' && choose()}
              accessibilityState={{ selected: state === 'selected', disabled: state === 'dimmed' }}
            >
              {body}
            </View>
          </GestureDetector>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, minHeight: 68 },
  tile: {
    width: 46,
    height: 46,
    borderRadius: QT_RADIUS.tile,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1, gap: 4 },
  label: { ...QT_TYPE.ui, color: QT.text },
  hint: { ...QT_TYPE.small, color: QT.sub },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: QT_RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(249,194,43,0.5)',
    backgroundColor: 'rgba(249,194,43,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { ...QT_TYPE.label, color: QT.amberSoft, letterSpacing: 0.8 },
  hold: { ...QT_TYPE.small, color: QT.amberSoft },
  ringBox: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: QT_SPACE.gutter - 14 },
});
