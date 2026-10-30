import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  Keyframe,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Glass } from '@/components/quests/glass';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { AXIS_SHORT_NAME } from '@/lib/axis-poles';
import { EASE_OUT, SPRING_POP, haptic } from '@/lib/motion-tokens';
import { UI_COPY, fmt } from '@/lib/quests/strings';
import { QT, QT_BAR, QT_RADIUS, QT_SPACE, QT_TYPE } from '@/lib/quests/theme';
import type { SaidCard as SaidCardModel } from '@/lib/quests/view';

/** Cards rise one after another, 400 ms apart. */
export const SAID_STAGGER_MS = 400;

/**
 * One "What your choices said" card: an emblem that pops with an amber glow
 * (Medium haptic), the phrase the player kept picking, the evidence line, a
 * consistency bar that fills over 600 ms, a ☐ Apply tick (never pre-ticked)
 * and "Not me" (the card dims and folds away over 200 ms). Reduce Motion:
 * the card fades and the emblem simply appears. `applyOff` (the Apply switch
 * is off, or the run is saved) leaves the tick shown but not tappable.
 */
export function SaidCard({
  card,
  index,
  ticked,
  notMe,
  onTick,
  onNotMe,
  applyOff = false,
}: {
  card: SaidCardModel;
  index: number;
  ticked: boolean;
  notMe: boolean;
  onTick: () => void;
  onNotMe: () => void;
  applyOff?: boolean;
}) {
  const rm = useMotionReduced();
  const delay = index * SAID_STAGGER_MS;
  const pop = useSharedValue(rm ? 1 : 0);
  const bar = useSharedValue(rm ? card.consistency : 0);
  const dim = useSharedValue(notMe ? 0.45 : 1);

  useEffect(() => {
    // Haptics stay under Reduce Motion; only the motion is dropped.
    const id = setTimeout(haptic.reveal, rm ? delay : delay + 350);
    if (!rm) {
      pop.value = withDelay(delay + 350, withSpring(1, SPRING_POP));
      bar.value = withDelay(delay + 450, withTiming(card.consistency, { duration: 600, easing: EASE_OUT }));
    }
    return () => clearTimeout(id);
    // One reveal per card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    dim.value = withTiming(notMe ? 0.45 : 1, { duration: 200 });
  }, [notMe, dim]);

  const emblem = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ scale: 0.5 + 0.5 * pop.value }] }));
  const fill = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));
  const card$ = useAnimatedStyle(() => ({ opacity: dim.value }));

  const name = AXIS_SHORT_NAME[card.axis];
  const evidence = fmt(UI_COPY.saidEvidence, { scenes: card.scenes, same: card.same });
  const quote = fmt(UI_COPY.saidQuote, { phrase: card.phrase });

  return (
    <Animated.View
      entering={
        rm
          ? FadeIn.delay(delay).duration(300)
          : new Keyframe({
              0: { opacity: 0, transform: [{ translateY: 16 }, { scale: 0.97 }] },
              100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
            })
              .delay(delay)
              .duration(450)
      }
      layout={rm ? undefined : LinearTransition.duration(200)}
    >
      <Animated.View style={card$}>
        <Glass style={styles.card}>
          <View style={styles.head}>
            <Animated.View style={[styles.emblem, emblem]}>
              <Text style={styles.emblemText}>{name.slice(0, 1)}</Text>
            </Animated.View>
            <View style={styles.headText}>
              <Text style={styles.axis}>{name}</Text>
              {notMe ? null : (
                <Animated.Text exiting={FadeOut.duration(200)} style={styles.quote}>
                  {quote}
                </Animated.Text>
              )}
            </View>
          </View>

          {notMe ? null : (
            <Animated.View exiting={FadeOut.duration(200)} style={styles.body}>
              <Text style={styles.evidence}>{evidence}</Text>
              <View
                accessible
                accessibilityLabel={`${UI_COPY.saidConsistency}: ${Math.round(card.consistency * 100)} percent`}
                style={styles.barBox}
              >
                <Text style={styles.small}>{UI_COPY.saidConsistency}</Text>
                <View style={styles.track}>
                  <Animated.View style={[styles.fill, fill]} />
                </View>
              </View>
            </Animated.View>
          )}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`${UI_COPY.saidApply}: ${name}`}
              accessibilityState={{ checked: ticked, disabled: notMe || applyOff }}
              disabled={notMe || applyOff}
              onPress={() => {
                haptic.press();
                onTick();
              }}
              style={[styles.action, (notMe || applyOff) && styles.off]}
            >
              <Text style={[styles.box, ticked && styles.boxOn]}>{ticked ? '☑' : '☐'}</Text>
              <Text style={styles.actionText}>{UI_COPY.saidApply}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={notMe ? `${UI_COPY.saidNotMeUndo}: ${name}` : `${UI_COPY.saidNotMe}: ${name}`}
              accessibilityState={{ disabled: applyOff }}
              disabled={applyOff}
              onPress={() => {
                haptic.press();
                onNotMe();
              }}
              style={styles.action}
            >
              <Text style={styles.actionText}>{notMe ? UI_COPY.saidNotMeUndo : UI_COPY.saidNotMe}</Text>
            </Pressable>
          </View>
        </Glass>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { padding: QT_SPACE.pad, gap: 12 },
  head: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  headText: { flex: 1, gap: 4 },
  emblem: {
    width: 52,
    height: 52,
    borderRadius: QT_RADIUS.tile,
    backgroundColor: 'rgba(249,194,43,0.16)',
    borderWidth: 1.5,
    borderColor: QT.amber,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: QT.amber,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  emblemText: { ...QT_TYPE.number, color: QT.amberSoft, fontSize: 26 },
  axis: { ...QT_TYPE.h2, color: QT.text },
  quote: { ...QT_TYPE.small, color: QT.sub, fontStyle: 'italic' },
  body: { gap: 10 },
  evidence: { ...QT_TYPE.small, color: QT.text },
  barBox: { gap: 6 },
  small: { ...QT_TYPE.label, color: QT.sub },
  track: { height: QT_BAR.height, borderRadius: QT_BAR.radius, backgroundColor: QT.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: QT_BAR.radius, backgroundColor: QT.amber },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  action: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: QT_RADIUS.pill,
    borderWidth: 1,
    borderColor: QT.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  off: { opacity: 0.5 },
  box: { color: QT.sub, fontSize: 20 },
  boxOn: { color: QT.amber },
  actionText: { ...QT_TYPE.ui, color: QT.text },
});
