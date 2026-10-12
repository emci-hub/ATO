/**
 * Shared Zzz overlay (Phase 2). 3 frames at 4fps, rising with a fade.
 * Reduced (or OS RM): fade only — no rise. Off: static first frame.
 * Not per-pet art.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ZZZ_ART } from '@/play/hideout-art';
import { HIDEOUT_ZZZ_FPS } from '@/play/hideout-progress';
import { pixelRenderStyle } from '@/play/pixel-theme';
import { usePlayMotion } from '@/play/play-motion';

const FRAME_MS = Math.round(1000 / HIDEOUT_ZZZ_FPS);
const RISE_PT = 14;

export function HideoutZzz({
  x,
  y,
  size = 28,
}: {
  x: number;
  y: number;
  size?: number;
}) {
  const motion = usePlayMotion();
  const frame = useSharedValue(0);
  const fade = useSharedValue(1);
  const rise = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(frame);
    cancelAnimation(fade);
    cancelAnimation(rise);
    frame.value = 0;
    fade.value = 1;
    rise.value = 0;
    if (motion.cosmeticsStill) return;
    const keep = { reduceMotion: ReduceMotion.Never };
    frame.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0, ...keep }),
        withTiming(0, { duration: FRAME_MS, ...keep }),
        withTiming(1, { duration: 0, ...keep }),
        withTiming(1, { duration: FRAME_MS, ...keep }),
        withTiming(2, { duration: 0, ...keep }),
        withTiming(2, { duration: FRAME_MS, ...keep }),
      ),
      -1,
    );
    // Reduced / OS RM: fade still runs (Never). Rise is the vestibular bit.
    fade.value = withRepeat(
      withSequence(
        withTiming(1, { duration: FRAME_MS * 1.5, easing: Easing.inOut(Easing.quad), ...keep }),
        withTiming(0.35, { duration: FRAME_MS * 1.5, easing: Easing.inOut(Easing.quad), ...keep }),
      ),
      -1,
    );
    if (!motion.vestibularSafe) {
      rise.value = withRepeat(
        withSequence(
          withTiming(-RISE_PT, { duration: FRAME_MS * 3, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      );
    }
    return () => {
      cancelAnimation(frame);
      cancelAnimation(fade);
      cancelAnimation(rise);
    };
  }, [motion.cosmeticsStill, motion.vestibularSafe, frame, fade, rise]);

  const wrap = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: rise.value }],
  }));
  const f0 = useAnimatedStyle(() => ({ opacity: Math.round(frame.value) === 0 ? 1 : 0 }));
  const f1 = useAnimatedStyle(() => ({ opacity: Math.round(frame.value) === 1 ? 1 : 0 }));
  const f2 = useAnimatedStyle(() => ({ opacity: Math.round(frame.value) === 2 ? 1 : 0 }));

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x, top: y, width: size, height: size * 1.3 }, wrap]}>
      {[f0, f1, f2].map((st, i) => (
        <Animated.View key={i} style={[StyleSheet.absoluteFill, st]}>
          <Image source={ZZZ_ART[i]} style={{ width: size, height: size * 1.3, ...pixelRenderStyle }} contentFit="contain" transition={0} />
        </Animated.View>
      ))}
    </Animated.View>
  );
}

/** Empty bed / bowl travel tag while the pet is on an Expedition. */
export function HideoutTravelTag({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: '#1A1424', borderWidth: 1, borderColor: '#5EEAD4' }}>
      <Text style={{ color: '#F5E6C8', fontSize: 11 }}>{text}</Text>
    </View>
  );
}
