/**
 * Dive scene (v21) — the pet diving, drawn from existing art only.
 *
 * Board grass tiles (with a strip of pad tiles on the floor) under a depth
 * tint: Shallows (no Deepers yet) → Reef (1-2) → Trench (3) → Abyss (4, the
 * last Deeper). At Trench and Abyss the tiles go dark except a soft light
 * around the pet. The pet (line look + branch tint + stage scale) sinks one
 * step per Deeper, rises when a haul is banked, and pops up empty-handed on a
 * bust. It reacts to the SHOWN bust % only — calm bob under 25%, nervous
 * wiggle 25-40%, shake over 40% — and never touches the odds or the % text.
 * Reduced motion = still poses (position snaps, no loops).
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Image } from 'expo-image';

import { Fonts } from '@/constants/theme';
import { NEON } from '@/play/neon-viper';
import type { PetState } from '@/play/pet';
import { PetFigure, petBoxSize } from '@/play/pet-figure';
import { skinArt } from '@/play/skin';

const SCENE_H = 210;
const TILE_COLS = 8;
const PET_BASE_BOX = 80;
const TOP_PAD = 10;
const BOTTOM_PAD = 16;
const MAX_DEPTH = 4;

export type DiveZone = 'Shallows' | 'Reef' | 'Trench' | 'Abyss';

/** Depth (Deepers survived) → zone. Abyss is the last Deeper (depth 4). */
export function diveZone(depth: number): DiveZone {
  if (depth <= 0) return 'Shallows';
  if (depth <= 2) return 'Reef';
  if (depth === 3) return 'Trench';
  return 'Abyss';
}

/** How the pet reacts to the shown bust % (null = no Deeper on offer). */
export type DiveMood = 'calm' | 'nervous' | 'shake';
export function diveMood(bustPct: number | null): DiveMood {
  if (bustPct == null || bustPct < 25) return 'calm';
  if (bustPct <= 40) return 'nervous';
  return 'shake';
}

/** Flat tint for the lit zones; Trench/Abyss use the lamp gradient instead. */
const ZONE_TINT: Record<DiveZone, number> = {
  Shallows: 0.2,
  Reef: 0.42,
  Trench: 0.8,
  Abyss: 0.9,
};
const WATER = '3, 26, 51';

export type DiveSceneEvent = { kind: 'bust' | 'surface'; key: number } | null;

export function DiveScene({
  pet,
  eggColor,
  depth,
  bustPct,
  away,
  event,
  reduceMotion,
}: {
  pet: PetState;
  eggColor: string;
  /** Deepers survived in the active run (0 when not diving). */
  depth: number;
  /** The bust % shown for the next Deeper, or null. */
  bustPct: number | null;
  away: boolean;
  /** The last surface / bust, to play the rise or the pop-up once. */
  event: DiveSceneEvent;
  reduceMotion: boolean;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const zone = diveZone(depth);
  const box = petBoxSize(pet, PET_BASE_BOX);
  const travel = Math.max(0, SCENE_H - box - TOP_PAD - BOTTOM_PAD);
  const targetY = TOP_PAD + (Math.min(MAX_DEPTH, depth) / MAX_DEPTH) * travel;
  const mood = diveMood(bustPct);

  // Position (sink / rise / pop) and the mood loop are separate values so a
  // new % never restarts the sinking, and vice versa.
  const y = useSharedValue(targetY);
  const loop = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      y.value = targetY;
      return;
    }
    if (event?.kind === 'bust' && depth === 0) {
      // Pop up empty-handed: a quick overshoot to the surface.
      y.value = withSequence(
        withTiming(TOP_PAD - 8, { duration: 320, easing: Easing.out(Easing.quad) }),
        withTiming(targetY, { duration: 220, easing: Easing.inOut(Easing.quad) }),
      );
      return;
    }
    y.value = withTiming(targetY, { duration: 650, easing: Easing.inOut(Easing.cubic) });
  }, [depth, event?.key, event?.kind, reduceMotion, targetY, y]);

  useEffect(() => {
    cancelAnimation(loop);
    loop.value = 0;
    if (reduceMotion || away) return;
    const half = mood === 'calm' ? 900 : mood === 'nervous' ? 200 : 55;
    loop.value = withRepeat(
      withSequence(
        withTiming(1, { duration: half, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: half * 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: half, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    return () => cancelAnimation(loop);
  }, [away, loop, mood, reduceMotion]);

  const petStyle = useAnimatedStyle(() => {
    const t = loop.value;
    if (mood === 'calm') return { transform: [{ translateY: y.value + t * 3 }] };
    if (mood === 'nervous') return { transform: [{ translateY: y.value }, { rotate: `${t * 6}deg` }] };
    return { transform: [{ translateY: y.value }, { translateX: t * 2.5 }] };
  });

  const tile = width > 0 ? width / TILE_COLS : 0;
  const rows = tile > 0 ? Math.ceil(SCENE_H / tile) : 0;
  const grass = skinArt('map.grass');
  const pad = skinArt('map.pad');
  const lamp = zone === 'Trench' || zone === 'Abyss';
  const lampCy = targetY + box / 2;
  const caption =
    away
      ? 'Your pet is away on an expedition.'
      : event?.kind === 'bust' && depth === 0
        ? 'Popped up empty-handed.'
        : event?.kind === 'surface' && depth === 0
          ? 'Back up with the haul!'
          : null;

  return (
    <View
      style={styles.scene}
      onLayout={onLayout}
      accessibilityLabel={`${zone}${away ? ', your pet is away' : ''}`}>
      {tile > 0 ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: rows * TILE_COLS }, (_, i) => {
            const row = Math.floor(i / TILE_COLS);
            const col = i % TILE_COLS;
            const floor = row === rows - 1 && pad != null;
            const source = floor ? pad : grass;
            if (!source) return null;
            return (
              <Image
                key={i}
                source={source}
                contentFit="fill"
                style={{ position: 'absolute', left: col * tile, top: row * tile, width: tile + 0.5, height: tile + 0.5 }}
              />
            );
          })}
        </View>
      ) : null}

      {lamp && width > 0 ? (
        <Svg width={width} height={SCENE_H} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient
              id="diveLamp"
              cx={width / 2}
              cy={lampCy}
              rx={Math.max(box, 70) * 1.25}
              ry={Math.max(box, 70) * 1.25}
              fx={width / 2}
              fy={lampCy}
              gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={`rgb(${WATER})`} stopOpacity={0.12} />
              <Stop offset="0.55" stopColor={`rgb(${WATER})`} stopOpacity={0.45} />
              <Stop offset="1" stopColor={`rgb(${WATER})`} stopOpacity={ZONE_TINT[zone]} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={SCENE_H} fill="url(#diveLamp)" />
        </Svg>
      ) : (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(${WATER}, ${ZONE_TINT[zone]})` }]}
        />
      )}

      {!away ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.pet, { left: width / 2 - box / 2, width: box, height: box }, petStyle]}>
          <PetFigure pet={pet} baseBox={PET_BASE_BOX} eggColor={eggColor} />
        </Animated.View>
      ) : null}

      <Text style={styles.zone}>{zone}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    height: SCENE_H,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: `rgb(${WATER})`,
    borderWidth: 1,
    borderColor: NEON.cyanBorder,
  },
  pet: {
    position: 'absolute',
    top: 0,
  },
  zone: {
    position: 'absolute',
    top: 8,
    left: 10,
    fontFamily: Fonts.monoBold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  caption: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
