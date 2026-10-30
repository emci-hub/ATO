import { Image } from 'expo-image';
import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { ATLAS_ANIMS, ATLAS_FRAMES, ATLAS_SIZES } from '@/lib/quests/art-keys';

/**
 * One frame (or a looping clip) of a Quests atlas (ATO-BUILD PHASE-22): an expo-image of the
 * whole sheet inside an `overflow: hidden` View, offset by -frame.x / -frame.y. The sheets are
 * pre-scaled x2, so at `sc` = 2 pt per art pixel one atlas pixel is one point.
 *
 * A clip's frame index comes from the stage's single frame callback: `elapsed` is its
 * (Reduce-Motion-scaled) millisecond clock, and `floor(elapsed / ms) % n` picks the frame on
 * the UI thread, so the clip never re-renders React.
 */
// Order matches ATLAS_NAMES in art-keys.ts.
const SHEETS = [
  require('../../../assets/quests/lantern.png'),
  require('../../../assets/quests/masquerade.png'),
  require('../../../assets/quests/city.png'),
  require('../../../assets/quests/shared.png'),
];

export interface FrameBox {
  /** Drawn size in points. */
  w: number;
  h: number;
  /** The foot point inside that box, in points. */
  footX: number;
  footY: number;
}

/** Size and foot point of a frame, or of a clip's first frame. Null when the art does not exist. */
export function frameBox(name: string, sc: number): FrameBox | null {
  const f = ATLAS_FRAMES[`${name}.0`] ?? ATLAS_FRAMES[name];
  if (!f) return null;
  const u = sc / f[9];
  return { w: f[3] * u, h: f[4] * u, footX: (f[10] - f[5]) * u, footY: (f[11] - f[6]) * u };
}

export const hasArt = (name: string): boolean => !!(ATLAS_FRAMES[name] ?? ATLAS_FRAMES[`${name}.0`]);

export interface AtlasSpriteProps {
  /** A frame (`plate.lantern.flooded-gate.far`) or a clip (`npc.rook.idle`). */
  name: string;
  /** Points per art pixel. */
  sc: number;
  /** The stage clock in ms; only clips read it. */
  elapsed?: SharedValue<number>;
  /** Mirror left-right (an NPC that faces the hero). */
  flip?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const AtlasSprite = memo(function AtlasSprite({ name, sc, elapsed, flip = false, style }: AtlasSpriteProps) {
  const clip = ATLAS_ANIMS[name];
  const n = clip ? clip.n : 1;
  // ms is one time for every frame, or a list with one time per frame.
  const times = useMemo(() => {
    const list = !clip ? [1] : typeof clip.ms === 'number' ? Array.from({ length: clip.n }, () => clip.ms as number) : [...clip.ms];
    const cum: number[] = [];
    let t = 0;
    for (const d of list) cum.push((t += d));
    return cum;
  }, [clip]);
  const first = ATLAS_FRAMES[clip ? `${name}.0` : name];
  const k = first ? first[9] : 2;
  const u = sc / k;
  const offsets = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < n; i++) {
      const f = ATLAS_FRAMES[clip ? `${name}.${i}` : name];
      xs.push(f ? -f[1] * u : 0);
      ys.push(f ? -f[2] * u : 0);
    }
    return { xs, ys };
  }, [name, clip, n, u]);
  const idle = useSharedValue(0);
  const clock = elapsed ?? idle;
  const move = useAnimatedStyle(() => {
    let i = 0;
    if (n > 1) {
      const t = clock.value % times[n - 1];
      while (i < n - 1 && t >= times[i]) i++;
    }
    return { transform: [{ translateX: offsets.xs[i] }, { translateY: offsets.ys[i] }] };
  });
  if (!first) return null;
  const [atlas, , , w, h] = first;
  const [sheetW, sheetH] = ATLAS_SIZES[atlas];
  return (
    <View
      pointerEvents="none"
      style={[{ width: w * u, height: h * u, overflow: 'hidden' }, flip ? styles.flip : null, style]}
    >
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: sheetW * u, height: sheetH * u }, move]}>
        <Image source={SHEETS[atlas]} style={StyleSheet.absoluteFill} contentFit="fill" />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  flip: { transform: [{ scaleX: -1 }] },
});
