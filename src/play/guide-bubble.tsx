/**
 * The guide bubble (Divecore finish step 5): one fixed 76 pt box in a GameScreen's float layer, with the step's
 * words and a "Got it" button (44 pt). It never sits in flow, so no region resizes; the wrapper is `box-none`, so
 * only the bubble itself takes touches. Fades in (shorter under Reduce Motion, none with motion Off); never pulses.
 */
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { guideStep, type GuideScreen } from '@/play/guide';
import { guideInputOf } from '@/play/guide-input';
import { dismissGuideStep, useGuideStore } from '@/play/guide-store';
import { usePlayMotion } from '@/play/play-motion';
import type { PlayView } from '@/play/playStore';
import { tapHaptic } from '@/play/street-feel';
import { STREET, STREET_FONT, useStreetFonts } from '@/play/street-ui';

export const GUIDE_BUBBLE_HEIGHT = 76;

/**
 * A screen drops this into its float layer. It reads the phone-only guide state (nothing shows until it has loaded),
 * picks the step for `screen` from the live view, and draws the bubble — or nothing. `active` is the screen's own
 * "nothing is open over me" test (sheets, ceremonies, runs, Settings, a coach tip).
 */
export function GuideHost({
  screen,
  view,
  active,
  bottom,
  sideInset,
}: {
  screen: GuideScreen;
  view: PlayView;
  active: boolean;
  bottom: number;
  sideInset: number;
}) {
  const store = useGuideStore();
  if (!active || !store.loaded) return null;
  const step = guideStep(screen, guideInputOf(view), store);
  if (!step) return null;
  return (
    <GuideBubble
      text={step.text}
      stepKey={`${step.id}:${step.text}`}
      bottom={bottom}
      sideInset={sideInset}
      onGotIt={() => dismissGuideStep(step.id)}
    />
  );
}

export function GuideBubble({
  text,
  stepKey,
  bottom,
  sideInset,
  onGotIt,
}: {
  text: string;
  /** Changes with the step (the screen reader announces each new step once). */
  stepKey: string;
  /** Gap above the bottom of the float layer (clears the dock). */
  bottom: number;
  /** Space kept free on both sides (the Hideout's rails). */
  sideInset: number;
  onGotIt: () => void;
}) {
  useStreetFonts();
  const motion = usePlayMotion();
  useEffect(() => {
    // iOS ignores live regions, so it is told; Android reads the live region (not both).
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
  }, [stepKey, text]);
  const entering = motion.cosmeticsStill
    ? undefined
    : FadeIn.duration(motion.vestibularSafe ? 120 : 180).reduceMotion(ReduceMotion.Never);
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom, left: sideInset, right: sideInset }]}>
      <Animated.View key={stepKey} entering={entering} style={styles.bubble} accessibilityLiveRegion="polite">
        <Text style={styles.text} numberOfLines={3} maxFontSizeMultiplier={1.2}>
          {text}
        </Text>
        <Pressable
          onPress={() => {
            tapHaptic();
            onGotIt();
          }}
          accessibilityRole="button"
          accessibilityLabel="Got it, hide this tip"
          hitSlop={4}
          style={({ pressed }) => [styles.gotIt, pressed && styles.pressed]}>
          <Text style={styles.gotItText} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            Got it
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', height: GUIDE_BUBBLE_HEIGHT, justifyContent: 'center' },
  bubble: {
    height: GUIDE_BUBBLE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 6,
    backgroundColor: STREET.ink,
    borderWidth: 2,
    borderColor: STREET.mustard,
  },
  text: { flex: 1, minWidth: 0, fontFamily: STREET_FONT.bold, fontSize: 14, lineHeight: 18, color: STREET.paper },
  gotIt: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: STREET.mustard },
  gotItText: { fontFamily: STREET_FONT.bold, fontSize: 11, color: STREET.ink, textTransform: 'uppercase' },
  pressed: { opacity: 0.82 },
});
