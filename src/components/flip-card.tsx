import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { PressPop } from '@/components/press-pop';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useBreath } from '@/hooks/use-breath';
import { useTheme } from '@/hooks/use-theme';
import { EASE_IN_OUT, FLIP, haptic } from '@/lib/motion-tokens';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * FLIP (PHASE-09): one face at a time. rotateY 0 → 90°, swap faces, → 0 again
 * (perspective 900, 700 ms, EASE_IN_OUT), with a Light haptic at the swap. A
 * 44 pt button flips it; both faces can be read by VoiceOver through that
 * button, so the card is never a gesture-only control. Reduce Motion (§1.4):
 * no rotation, the faces cross-fade (250 ms in total) and the card breathes.
 */
export function FlipCard({
  front,
  back,
  toBackLabel,
  toFrontLabel,
  forceReduceMotion = false,
}: {
  front: ReactNode;
  /** Nothing yet (e.g. the Try pick is still loading): the front stands alone, no button. */
  back?: ReactNode;
  /** The button on the front face. */
  toBackLabel: string;
  /** The button on the back face. */
  toFrontLabel: string;
  forceReduceMotion?: boolean;
}) {
  const theme = useTheme();
  const { rm, style: breath } = useBreath(forceReduceMotion);
  const [showBack, setShowBack] = useState(false);
  const busy = useRef(false);
  const showBackRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotate = useSharedValue(0);
  const fade = useSharedValue(1);
  const half = rm ? FLIP.reducedFadeMs : FLIP.totalMs / 2;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      cancelAnimation(rotate);
      cancelAnimation(fade);
    },
    [rotate, fade],
  );

  const flip = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    const swap = () => {
      haptic.commit();
      showBackRef.current = !showBackRef.current;
      setShowBack(showBackRef.current);
      // Focus stays on the button, so say which face is up now.
      AccessibilityInfo.announceForAccessibility(showBackRef.current ? toBackLabel : toFrontLabel);
      if (rm) {
        fade.value = withTiming(1, { duration: half, easing: EASE_IN_OUT });
      } else {
        rotate.value = -90;
        rotate.value = withTiming(0, { duration: half, easing: EASE_IN_OUT });
      }
      timer.current = setTimeout(() => {
        busy.current = false;
      }, half);
    };
    if (rm) fade.value = withTiming(0, { duration: half, easing: EASE_IN_OUT });
    else rotate.value = withTiming(90, { duration: half, easing: EASE_IN_OUT });
    timer.current = setTimeout(swap, half);
  }, [rm, half, rotate, fade, toBackLabel, toFrontLabel]);

  const faceStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ perspective: FLIP.perspective }, { rotateY: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.wrap, breath]}>
      {/* Both faces stay mounted (a card mid-load keeps its state); the hidden one takes no space. */}
      <Animated.View style={faceStyle}>
        <View style={showBack ? styles.off : undefined}>{front}</View>
        <View style={showBack ? undefined : styles.off}>{back}</View>
      </Animated.View>
      {back ? (
      <PressPop
        onPress={flip}
        accessibilityRole="button"
        accessibilityLabel={showBack ? toFrontLabel : toBackLabel}
        accessibilityHint="Turns the card over"
        testID="flip-card-button"
        style={[styles.button, { borderColor: controlBorderColor(theme) }]}>
        <View style={styles.buttonInner}>
          <ThemedText type="smallBold">{showBack ? toFrontLabel : toBackLabel}</ThemedText>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {showBack ? '‹' : '›'}
          </ThemedText>
        </View>
      </PressPop>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  off: { display: 'none' },
  button: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, minHeight: 44 },
});
