/**
 * Dive world — the approved reef plate (dive2.py), plus the pieces that move.
 *
 * The plate is the teal ruins, statue, coral and seabed with the mockup's
 * lighting baked in. Kelp sways, one fish crosses, bubbles rise, and a dim
 * pass of the god rays shimmers over the plate. Reduced motion and Effects
 * Low hold the plate still and skip the particles.
 *
 * The shark glide, the abyss statue and the find chest stay gameplay looks.
 * Nothing is tinted or washed over the pixels at draw time.
 *
 * LOOKS ONLY: every choice here is by depth — no rolls, no odds.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { DRAGON_DEPTH } from '@/play/dive-fx-model';
import { Drift, Flicker, MoteRise, SpriteSwap, Sway } from '@/play/pixel-ambient';
import { ART_PT } from '@/play/pixel-theme';
import { AtlasSprite, DIVE_FRAMES, MOCKUP_DIVE, MOCKUP_PLATE, placePlate, type DiveFrame } from '@/play/pixel-atlas';
import { CausticWash, DitherPool, ParallaxLayer, useParallaxBob } from '@/play/pixel-fx';

export const WALL_W = 34;

/** Where the surface waterline sits, as a share of the scene height. */
export const WATERLINE = 0.24;

/** Mockup bubble radii (dive2.py), one per rise. */
const BUBBLE_R = [2, 1, 2, 3, 2] as const;

/**
 * A round outlined pixel ring (dive2 `bubble`): #8ff8e2 stroke and one white
 * highlight. Radii match the script (1, 2, 3 art px).
 */
export function BubbleRing({ r }: { r: number }) {
  const radius = r <= 1 ? 1 : r >= 3 ? 3 : 2;
  const rows =
    radius === 1
      ? ['.o.', 'oWo', '.o.']
      : radius === 3
        ? ['..ooo..', '.W...o.', 'o.....o', 'o.....o', 'o.....o', '.o...o.', '..ooo..']
        : ['.ooo.', 'oW..o', 'o...o', 'o...o', '.ooo.'];
  const k = ART_PT;
  const n = rows.length;
  return (
    <View style={{ width: n * k, height: n * k }}>
      {rows.map((row, y) =>
        row.split('').map((cell, x) =>
          cell === '.' ? null : (
            <View
              key={`${x}-${y}`}
              style={{
                position: 'absolute',
                left: x * k,
                top: y * k,
                width: k,
                height: k,
                backgroundColor: cell === 'W' ? '#FFFFFF' : '#8FF8E2',
              }}
            />
          ),
        ),
      )}
    </View>
  );
}

function frameBox(frame: string): { w: number; h: number } {
  const rect = DIVE_FRAMES[frame as DiveFrame];
  return { w: rect.w * ART_PT, h: rect.h * ART_PT };
}

/** Plate bands in art pixels. They overlap so a bob does not open a seam. */
const PLATE_BANDS = [
  { y0: 0, y1: 168, factor: 0.25 },
  { y0: 152, y1: 292, factor: 0.5 },
  { y0: 276, y1: MOCKUP_PLATE.h, factor: 1 },
] as const;

/**
 * One horizontal slice of the reef plate. The bitmap is the same atlas frame,
 * clipped, so parallax costs no extra file.
 */
function PlateSlice({ y0, y1 }: { y0: number; y1: number }) {
  const k = ART_PT;
  const h = (y1 - y0) * k;
  return (
    <View style={{ width: MOCKUP_PLATE.w * k, height: h, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', top: -y0 * k, left: 0 }}>
        <AtlasSprite atlas="dive" frame="plate" />
      </View>
    </View>
  );
}

/**
 * The mockup reef. Three slices bob at 0.25 / 0.5 / 1×, snapped to 2pt.
 * `alive` is full effects with motion allowed; otherwise the slices sit still.
 */
export function MockupReef({ width, height, alive }: { width: number; height: number; alive: boolean }) {
  const origin = placePlate(width, height, MOCKUP_DIVE.feet, 24);
  const k = ART_PT;
  const bob = useParallaxBob(alive);
  return (
    <View pointerEvents="none" style={[styles.abs, { left: origin.left, top: origin.top, width: MOCKUP_PLATE.w * k, height: MOCKUP_PLATE.h * k, overflow: 'hidden' }]}>
      {PLATE_BANDS.map((band) => (
        <ParallaxLayer
          key={band.factor}
          bob={bob}
          factor={band.factor}
          style={[styles.abs, { top: band.y0 * k, left: 0 }]}>
          <PlateSlice y0={band.y0} y1={band.y1} />
          {band.factor === 0.25 ? (
            <View style={[styles.abs, { left: 0, top: -band.y0 * k, width: MOCKUP_PLATE.w * k, height: 180 * k }]}>
              <CausticWash alive={alive} width={MOCKUP_PLATE.w * k} height={160 * k} />
            </View>
          ) : null}
        </ParallaxLayer>
      ))}
      <ParallaxLayer bob={bob} factor={0.25} style={[styles.abs, { left: MOCKUP_DIVE.shimmer.x * k, top: MOCKUP_DIVE.shimmer.y * k }]}>
        <Flicker alive={alive} peak={0.42} ms={1400}>
          <AtlasSprite atlas="dive" frame="shimmer" />
        </Flicker>
      </ParallaxLayer>
      <ParallaxLayer bob={bob} factor={1} style={[styles.abs, { left: 0, top: 0 }]}>
        <DitherPool alive={alive} cx={128} cy={278} rx={28} ry={16} color="#30E1B9" />
      </ParallaxLayer>
      <ParallaxLayer bob={bob} factor={1} style={[styles.abs, { left: MOCKUP_DIVE.weed.x * k, top: MOCKUP_DIVE.weed.y * k }]}>
        <Sway alive={alive} deg={2.2} ms={2400}>
          <AtlasSprite atlas="dive" frame="weed" />
        </Sway>
      </ParallaxLayer>
      <ParallaxLayer bob={bob} factor={0.5} style={[styles.abs, { left: MOCKUP_DIVE.fish.x * k, top: MOCKUP_DIVE.fish.y * k }]}>
        <Drift alive={alive} dx={72} dy={6} ms={6400}>
          <SpriteSwap atlas="dive" frames={['fish0', 'fish2']} alive={alive} ms={220} />
        </Drift>
      </ParallaxLayer>
      {MOCKUP_DIVE.bubbles.map((b, i) => (
        <MoteRise key={i} alive={alive} left={b.x * k} top={b.y * k} distance={80 + (i % 3) * 24} ms={4200 + i * 500} delay={i * 380}>
          <BubbleRing r={BUBBLE_R[i] ?? 2} />
        </MoteRise>
      ))}
    </View>
  );
}

/** The old tiled water column. The plate above is the reef; this stays empty. */
export function DiveWater(_props: { width: number; band: number; speed: number }) {
  return null;
}

/** The old mid ruins. The statue and arch are baked into the plate. */
export function ShaftWalls(_props: { width: number; band: number; depth: number; speed: number; alive: boolean }) {
  return null;
}

/** The old per-band props. Kelp and coral sit on the plate. */
export function ZoneProps(_props: { width: number; band: number; depth: number; alive: boolean }) {
  return null;
}

/** Caustics are the baked light on the plate, not a dotted line. */
export function Caustics(_props: { width: number; band: number; speed: number; alive: boolean }) {
  return null;
}

/** God rays are the baked shimmer, not dashed shafts. */
export function LightRays(_props: { width: number; alive: boolean }) {
  return null;
}

/** The Abyss: the pack's statue, in the dark frame, full pixels. */
export function AbyssDragon({ width, band }: { width: number; band: number }) {
  const box = frameBox('statue-deep');
  return (
    <View
      pointerEvents="none"
      style={[styles.abs, { left: (width - box.w) / 2, top: DRAGON_DEPTH * band + band * 0.12 }]}>
      <AtlasSprite atlas="dive" frame="statue-deep" />
    </View>
  );
}

/** A pack fish gliding past (Reef and Trench). Still when it isn't mounted. */
export function SharkGlide({ width, height, rightward }: { width: number; height: number; rightward: boolean }) {
  const t = useSharedValue(0);
  const box = frameBox('fish-big');
  useEffect(() => {
    t.value = 0;
    t.value = withRepeat(
      withSequence(withDelay(4000, withTiming(1, { duration: 11000, easing: Easing.linear })), withTiming(0, { duration: 0 })),
      -1,
    );
    return () => cancelAnimation(t);
  }, [t]);
  const style = useAnimatedStyle(() => {
    const p = rightward ? t.value : 1 - t.value;
    const moving = t.value > 0.02 && t.value < 0.98;
    return {
      opacity: moving ? 1 : 0,
      transform: [{ translateX: -box.w + p * (width + box.w * 2) }, { translateY: Math.sin(t.value * 9) * 6 }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left: 0, top: height * 0.26 }, style]}>
      <AtlasSprite atlas="dive" frame="fish-big" />
    </Animated.View>
  );
}

/** The surface rim used to slide a sky over the water. The reef plate stays. */
export function SurfaceSky(_props: {
  width: number;
  height: number;
  sky: SharedValue<number>;
  splash: SharedValue<number>;
  edgeX: number;
}) {
  return null;
}

/** The crate / chest a find bursts out of. `rv` is the scene's reveal clock. */
export const BOX_OPEN = 0.45;
export function FindBox({
  art,
  x,
  y,
  glow,
  rv,
}: {
  art: string;
  x: number;
  y: number;
  glow: string;
  rv: SharedValue<number>;
}) {
  const box = frameBox(art);
  const boxStyle = useAnimatedStyle(() => {
    const v = rv.value;
    return {
      opacity: v > 0 && v < 1.6 ? 1 : 0,
      transform: [{ rotate: v < BOX_OPEN ? `${Math.sin(v * 60) * 9}deg` : '0deg' }],
    };
  });
  const burstStyle = useAnimatedStyle(() => {
    const v = rv.value;
    const b = v < BOX_OPEN ? 0 : Math.min(1, (v - BOX_OPEN) / (1 - BOX_OPEN));
    return { opacity: b > 0 && v < 1.4 ? 0.7 * (1 - b * 0.6) : 0, transform: [{ scale: 0.4 + b * 1.6 }] };
  });
  return (
    <View pointerEvents="none" style={[styles.abs, { left: x, top: y, width: box.w, height: box.h }]}>
      <Animated.View
        style={[
          styles.abs,
          {
            left: -box.w / 2,
            top: -box.h / 2,
            width: box.w * 2,
            height: box.h * 2,
            borderRadius: box.w,
            backgroundColor: glow,
          },
          burstStyle,
        ]}
      />
      <Animated.View style={boxStyle}>
        <AtlasSprite atlas="dive" frame={art} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
});
