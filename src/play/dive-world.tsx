/**
 * Dive world — pixel scenery the Dive scene sinks through.
 *
 * Far water, a mid lattice / arch / statue, and a near seabed with seaweed
 * and coral. Art is the underwater atlas (ansimuz, recolored onto Resurrect
 * 64). Deeper bands use darker frames baked into the atlas. Nothing is tinted
 * or washed over the pixels at draw time.
 *
 * Parallax is a speed on the layer (`speed` < 1 lags behind the camera).
 * Reduced motion and Effects Low pass speed 1, so the layers stay locked.
 *
 * LOOKS ONLY: every choice here is by band index — no rolls, no odds.
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

import { DIVE_DEPTH_INK, DIVE_PROPS, DRAGON_DEPTH } from '@/play/dive-fx-model';
import { Drift, Sway } from '@/play/pixel-ambient';
import { ART_PT } from '@/play/pixel-theme';
import { AtlasFill, AtlasSprite, DIVE_FRAMES, type DiveFrame } from '@/play/pixel-atlas';

export const WALL_W = 34;

/** Where the surface waterline sits, as a share of the scene height. */
export const WATERLINE = 0.24;

const MID: readonly { frame: DiveFrame; side: 0 | 1 }[] = [
  { frame: 'lattice', side: 0 },
  { frame: 'statue', side: 0 },
  { frame: 'arch', side: 1 },
  { frame: 'totem', side: 1 },
  { frame: 'kelp', side: 0 },
  { frame: 'lattice-deep', side: 1 },
];

function frameBox(frame: string): { w: number; h: number } {
  const rect = DIVE_FRAMES[frame as DiveFrame];
  return { w: rect.w * ART_PT, h: rect.h * ART_PT };
}

/** The water column: one precolored background per depth. */
export function DiveWater({ width, band, speed }: { width: number; band: number; speed: number }) {
  const bandH = band * speed;
  return (
    <>
      {DIVE_DEPTH_INK.map((ink, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, top: i * bandH, width, height: bandH + ART_PT, overflow: 'hidden', backgroundColor: ink }}>
          <AtlasFill atlas="dive" frame={`bg${i}`} width={width} height={bandH + ART_PT} />
        </View>
      ))}
    </>
  );
}

/** Mid layer: lattice, arch, statue, totem. Laid out in the sped-up space. */
export function ShaftWalls({
  width,
  band,
  depth,
  speed,
  alive,
}: {
  width: number;
  band: number;
  depth: number;
  speed: number;
  alive: boolean;
}) {
  const bandH = band * speed;
  const bands = [depth - 1, depth, depth + 1, depth + 2].filter((i) => i >= 0 && i < MID.length);
  return (
    <>
      {bands.map((i) => {
        const spec = MID[i];
        if (!spec) return null;
        const box = frameBox(spec.frame);
        const left = spec.side === 0 ? -ART_PT * 8 : Math.max(0, width - box.w + ART_PT * 8);
        return (
          <View key={i} pointerEvents="none" style={[styles.abs, { left, top: i * bandH + bandH * 0.12 }]}>
            {spec.frame === 'kelp' ? (
              <Sway alive={alive} deg={1.2} ms={2200}>
                <AtlasSprite atlas="dive" frame={spec.frame} />
              </Sway>
            ) : (
              <AtlasSprite atlas="dive" frame={spec.frame} />
            )}
          </View>
        );
      })}
    </>
  );
}

function propSway(frame: string): number {
  if (frame.startsWith('weed')) return 3;
  if (frame.startsWith('coral')) return 1;
  return 0;
}

/** Near layer: seabed tiles plus seaweed and coral, in world space. */
export function ZoneProps({
  width,
  band,
  depth,
  alive,
}: {
  width: number;
  band: number;
  depth: number;
  alive: boolean;
}) {
  const bands = [depth - 1, depth, depth + 1].filter((i) => i >= 0 && i < DIVE_PROPS.length);
  return (
    <>
      {bands.map((i) => {
        const bed = i >= 3 ? 'seabed-deep' : 'seabed';
        const bedH = frameBox(bed).h;
        return (
          <View key={i} pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.abs, { left: 0, top: (i + 1) * band - bedH, width, height: bedH, overflow: 'hidden' }]}>
              <AtlasFill atlas="dive" frame={bed} width={width} height={bedH} />
            </View>
            {DIVE_PROPS[i].map((p) => {
              const box = frameBox(p.frame);
              const left = p.x === 0 ? ART_PT * 4 : Math.max(ART_PT * 4, width - box.w - ART_PT * 4);
              const deg = propSway(p.frame);
              const sprite = <AtlasSprite atlas="dive" frame={p.frame} />;
              return (
                <View key={p.frame} style={[styles.abs, { left, top: i * band + p.y * band - box.h }]}>
                  {deg > 0 ? (
                    <Sway alive={alive} deg={deg} ms={1500 + i * 180}>
                      {sprite}
                    </Sway>
                  ) : (
                    sprite
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </>
  );
}

/** Caustic shimmer on the two sunlit bands. Holds still when `alive` is false. */
export function Caustics({
  width,
  band,
  speed,
  alive,
}: {
  width: number;
  band: number;
  speed: number;
  alive: boolean;
}) {
  const tile = frameBox('caustic');
  const count = Math.max(1, Math.ceil((width + tile.w * 2) / tile.w));
  return (
    <>
      {[0, 1].map((i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[
            styles.abs,
            { left: 0, top: i * band * speed + band * speed * 0.42, width, height: tile.h, overflow: 'hidden' },
          ]}>
          <Drift alive={alive} dx={tile.w} ms={2400 + i * 400}>
            <View style={{ flexDirection: 'row' }}>
              {Array.from({ length: count }, (_, k) => (
                <AtlasSprite key={k} atlas="dive" frame="caustic" />
              ))}
            </View>
          </Drift>
        </View>
      ))}
    </>
  );
}

/** A few light shafts. Static when `alive` is false; omit the component when effects are low. */
export function LightRays({ width, alive }: { width: number; alive: boolean }) {
  const spots = [0.16, 0.42, 0.68];
  return (
    <>
      {spots.map((x, i) => (
        <View key={i} pointerEvents="none" style={[styles.abs, { left: width * x, top: 8 }]}>
          <Drift alive={alive} dx={8 + i * 2} ms={3600 + i * 500}>
            <AtlasSprite atlas="dive" frame="ray" />
          </Drift>
        </View>
      ))}
    </>
  );
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

/** Pixel sky and waterline above the Shallows. `sky` 1 = shown. */
export function SurfaceSky({
  width,
  height,
  sky,
  splash,
}: {
  width: number;
  height: number;
  sky: SharedValue<number>;
  splash: SharedValue<number>;
  edgeX: number;
}) {
  const line = height * WATERLINE;
  const skyH = frameBox('sky').h;
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -(1 - sky.value) * (line + 40) }] }));
  const splashStyle = useAnimatedStyle(() => ({
    opacity: splash.value > 0 && splash.value < 1 ? 1 - splash.value : 0,
    transform: [{ translateY: -splash.value * 18 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left: 0, top: 0, width, height: line + skyH }, style]}>
      <View style={{ width, height: line + 8, backgroundColor: DIVE_DEPTH_INK[0] }} />
      <View style={[styles.abs, { left: 0, top: Math.max(0, line - skyH), width, height: skyH, overflow: 'hidden' }]}>
        <AtlasFill atlas="dive" frame="sky" width={width} height={skyH} />
      </View>
      <Animated.View style={[styles.abs, { left: width / 2 - 40, top: line - 10, width: 80, height: 24, flexDirection: 'row', justifyContent: 'space-between' }, splashStyle]}>
        {['bubble', 'bubble', 'bubble', 'bubble'].map((frame, i) => (
          <AtlasSprite key={i} atlas="dive" frame={frame} />
        ))}
      </Animated.View>
    </Animated.View>
  );
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
