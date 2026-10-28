import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Sheen } from '@/components/sheen';
import { ThemedText } from '@/components/themed-text';
import { TraitConstellation } from '@/components/trait-constellation';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { EASE_BACK, EASE_IN_OUT, HOLO, SPRING_POP, STAMP, haptic } from '@/lib/motion-tokens';
import type { TraitTrack } from '@/lib/trait-stability';

/**
 * The holo reveal (PHASE-10), for a legend just met. The card turns 0 → 90°,
 * swaps the hall's "?" cover for the art, turns back to 0° and grows to 1.04
 * (1 s, Medium haptic at the swap), with an automatic sheen (no gesture tilt).
 * The "MET ✦" stamp lands at 1 s (scale 2.2 → 1, −14° → −8°, 450 ms, Heavy
 * haptic). Reduce Motion (§1.4): a 300 ms cross-fade, and the stamp only fades
 * in over 200 ms; haptics stay. A legend opened later (not fresh) shows plain.
 *
 * `onDone` fires when the card has finished turning: the screen keeps the
 * hall's frames locked until then, so a second tap is ignored (R07).
 */
export function HoloCard({
  fresh,
  color,
  matchPercent,
  matchTracks,
  onDone,
  children,
  forceReduceMotion = false,
}: {
  /** A reveal just landed: play the turn and the stamp (once per mount). */
  fresh: boolean;
  /** The hall's colour. */
  color: string;
  /** 0–100; 0 hides the match row. */
  matchPercent: number;
  /** The reader's tracks on the matched axes only ("why this legend fits"). */
  matchTracks: readonly TraitTrack[];
  onDone?: () => void;
  children: ReactNode;
  forceReduceMotion?: boolean;
}) {
  const rm = useMotionReduced(forceReduceMotion);
  const [faceUp, setFaceUp] = useState(!fresh);
  // Decided at mount, so the sheen wrapper never swaps in mid-turn.
  const [stamped] = useState(fresh);
  const played = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);
  const fade = useSharedValue(1);
  const stampScale = useSharedValue<number>(STAMP.scaleFrom);
  const stampRotate = useSharedValue<number>(STAMP.rotateFrom);
  const stampOpacity = useSharedValue(0);

  useEffect(() => {
    if (!fresh || played.current) return;
    played.current = true;
    if (rm) {
      const half = HOLO.reducedFadeMs / 2;
      fade.value = withTiming(0, { duration: half, easing: EASE_IN_OUT });
      timers.current.push(
        setTimeout(() => {
          haptic.reveal();
          setFaceUp(true);
          fade.value = withTiming(1, { duration: half, easing: EASE_IN_OUT });
        }, half),
      );
      stampScale.value = 1;
      stampRotate.value = STAMP.rotateTo;
      stampOpacity.value = withDelay(HOLO.reducedFadeMs, withTiming(1, { duration: STAMP.reducedFadeMs }));
      timers.current.push(setTimeout(haptic.stamp, HOLO.reducedFadeMs));
      timers.current.push(setTimeout(() => doneRef.current?.(), HOLO.reducedFadeMs));
    } else {
      const half = HOLO.totalMs / 2;
      rotate.value = withTiming(90, { duration: half, easing: EASE_IN_OUT });
      timers.current.push(
        setTimeout(() => {
          haptic.reveal();
          setFaceUp(true);
          rotate.value = -90;
          rotate.value = withTiming(0, { duration: half, easing: EASE_IN_OUT });
          scale.value = withSequence(
            withTiming(HOLO.scaleTo, { duration: half, easing: EASE_IN_OUT }),
            withTiming(1, { duration: 150, easing: EASE_IN_OUT }),
          );
        }, half),
      );
      stampOpacity.value = withDelay(STAMP.delayMs, withTiming(1, { duration: 60 }));
      stampScale.value = withDelay(STAMP.delayMs, withSpring(1, SPRING_POP));
      stampRotate.value = withDelay(
        STAMP.delayMs,
        withTiming(STAMP.rotateTo, { duration: STAMP.durationMs, easing: EASE_BACK }),
      );
      timers.current.push(setTimeout(haptic.stamp, STAMP.delayMs));
      timers.current.push(setTimeout(() => doneRef.current?.(), HOLO.totalMs));
    }
  }, [fresh, rm, rotate, scale, fade, stampScale, stampRotate, stampOpacity]);

  // Only leaving the card stops the turn (the screen flips `fresh` off at `onDone`,
  // while the stamp is still landing).
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.length = 0;
      played.current = false;
      [rotate, scale, fade, stampScale, stampRotate, stampOpacity].forEach(cancelAnimation);
    };
  }, [rotate, scale, fade, stampScale, stampRotate, stampOpacity]);

  const faceStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ perspective: HOLO.perspective }, { rotateY: `${rotate.value}deg` }, { scale: scale.value }],
  }));
  const stampStyle = useAnimatedStyle(() => ({
    opacity: stampOpacity.value,
    transform: [{ rotate: `${stampRotate.value}deg` }, { scale: stampScale.value }],
  }));

  const face = (
    <Animated.View style={faceStyle}>
      {faceUp ? (
        <>
          {matchPercent > 0 ? (
            <View
              style={styles.matchRow}
              accessible
              accessibilityLabel={`Match ${matchPercent} percent. The traits you share are shown as stars.`}>
              <View style={styles.matchText}>
                <ThemedText type="smallBold" style={{ color }}>
                  Match {matchPercent}%
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Why this legend fits
                </ThemedText>
              </View>
              {matchTracks.length > 0 ? <TraitConstellation tracks={matchTracks} size={72} variant="mini" /> : null}
            </View>
          ) : null}
          {children}
        </>
      ) : (
        <View style={[styles.cover, { borderColor: color, backgroundColor: `${color}18` }]}>
          <MaterialCommunityIcons name="help" size={64} color={color} />
        </View>
      )}
    </Animated.View>
  );

  return (
    <View style={styles.wrap}>
      {stamped ? <Sheen borderRadius={14}>{face}</Sheen> : face}
      {stamped ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.stamp, { borderColor: color }, stampStyle]}>
          <ThemedText type="smallBold" style={{ color }}>
            MET ✦
          </ThemedText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  cover: {
    minHeight: 220,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44, marginBottom: 8 },
  matchText: { flexShrink: 1 },
  stamp: {
    position: 'absolute',
    top: 10,
    right: 12,
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
