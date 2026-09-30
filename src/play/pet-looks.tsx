/**
 * Pet looks (2026-09-30) — grade, shiny and dye, all LOOKS ONLY.
 *
 *   - Grade never recolours the sprite. It is a glow BEHIND the pet: Common
 *     none; Rare a blue glow; Epic a purple aura + drifting sparkles;
 *     Legendary a gold aura + motes + a trail. Shown in the room and in Dive.
 *   - Shiny and the 3★ dye DO recolour the sprite: a copy of the sprite filled
 *     with the colour, laid on top with `mixBlendMode: 'hue'` (keeps the art's
 *     light and shade, swaps the hue). If blend modes are missing at runtime
 *     (old architecture), it falls back to the tint wash (the same copy at
 *     ~38% opacity, as the form tints already work). Dev can force either.
 *   - A shiny's colour is its own: dyes and Wardrobe tints never apply.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { GRADE_COLOR, HERO_DYE_COLOR, HERO_SHINY_COLOR, type Grade } from '@/play/pet-eggs';

/* --------------------------------------------------------- blend mode --- */

export type ShinyLook = 'auto' | 'blend' | 'wash';

/** Blend modes need the New Architecture (Fabric). */
const BLEND_SUPPORTED = (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager != null;

let lookOverride: ShinyLook = 'auto';
const lookListeners = new Set<(look: ShinyLook) => void>();

/** Dev: force the blend or the wash to compare them on a device. */
export function setShinyLook(look: ShinyLook): void {
  lookOverride = look;
  lookListeners.forEach((fn) => fn(look));
}
export function getShinyLook(): ShinyLook {
  return lookOverride;
}

/** Whether the recolour uses the hue blend (else the tint wash). */
export function useBlendRecolor(): boolean {
  const [look, setLook] = useState(lookOverride);
  useEffect(() => {
    lookListeners.add(setLook);
    return () => {
      lookListeners.delete(setLook);
    };
  }, []);
  if (look === 'blend') return true;
  if (look === 'wash') return false;
  return BLEND_SUPPORTED;
}

/** The sprite recolour for a pet: shiny first, else a worn 3★ dye, else none. */
export function petRecolor(hero: string | null, shiny: boolean, dyeOn: boolean): string | null {
  if (!hero) return null;
  if (shiny) return HERO_SHINY_COLOR[hero] ?? null;
  return dyeOn ? (HERO_DYE_COLOR[hero] ?? null) : null;
}

/* -------------------------------------------------------- grade aura --- */

function Mote({ size, color, delay, radius }: { size: number; color: string; delay: number; radius: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1));
    return () => cancelAnimation(t);
  }, [t, delay]);
  const style = useAnimatedStyle(() => {
    const a = t.value * Math.PI * 2;
    return {
      opacity: 0.35 + 0.5 * Math.abs(Math.sin(a * 2)),
      transform: [{ translateX: Math.cos(a) * radius }, { translateY: Math.sin(a) * radius * 0.55 - t.value * 6 }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.mote, { left: size / 2 - 3, top: size / 2 - 3 }, style]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
    </Animated.View>
  );
}

/**
 * The grade glow behind a pet of `size`. `trail` = facing for the Legendary
 * trail ('e' trails to the west). Still when `animate` is false.
 */
export function GradeAura({
  grade,
  size,
  animate,
  trail,
}: {
  grade: Grade | null;
  size: number;
  animate: boolean;
  trail?: 'e' | 'w' | null;
}) {
  if (!grade || grade === 'common') return null;
  const color = GRADE_COLOR[grade];
  const r = size * 0.62;
  const box = r * 2;
  const motes = !animate ? 0 : grade === 'epic' ? 4 : grade === 'legendary' ? 6 : 0;
  return (
    <View pointerEvents="none" style={[styles.aura, { left: size / 2 - r, top: size / 2 - r, width: box, height: box }]}>
      <Svg width={box} height={box}>
        <Defs>
          <RadialGradient id={`aura-${grade}`} cx="50%" cy="55%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={grade === 'rare' ? 0.35 : 0.5} />
            <Stop offset="0.6" stopColor={color} stopOpacity={grade === 'rare' ? 0.12 : 0.22} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r} fill={`url(#aura-${grade})`} />
      </Svg>
      {Array.from({ length: motes }, (_, i) => (
        <Mote key={i} size={box} color={color} delay={i * (2400 / Math.max(1, motes))} radius={r * 0.7} />
      ))}
      {grade === 'legendary' && trail ? (
        <View style={[styles.trail, { top: r * 1.1, [trail === 'e' ? 'left' : 'right']: r * 0.15 }]}>
          {[0.5, 0.32, 0.18].map((o, i) => (
            <View key={i} style={[styles.trailDot, { backgroundColor: color, opacity: o, width: 8 - i * 2, height: 8 - i * 2 }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------- shiny --- */

function Twinkle({ x, y, delay }: { x: number; y: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 700 }), withTiming(0, { duration: 900 })), -1),
    );
    return () => cancelAnimation(t);
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ scale: 0.6 + t.value * 0.6 }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.twinkle, { left: x, top: y }, style]}>
      <Text style={styles.twinkleText}>✦</Text>
    </Animated.View>
  );
}

/** A shiny's sparkles and the gold ring at its feet (still when not animating). */
export function ShinyOverlay({ size, footAt, animate }: { size: number; footAt: number; animate: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Ellipse
          cx={size / 2}
          cy={footAt * size}
          rx={size * 0.3}
          ry={size * 0.07}
          fill="none"
          stroke="#FFD86B"
          strokeWidth={2}
          strokeOpacity={0.9}
        />
      </Svg>
      {animate
        ? [
            [0.18, 0.2],
            [0.72, 0.28],
            [0.3, 0.6],
            [0.8, 0.62],
          ].map(([x, y], i) => <Twinkle key={i} x={x * size} y={y * size} delay={i * 420} />)
        : (
          <Text style={[styles.twinkleText, styles.twinkleStill, { left: size * 0.72, top: size * 0.22 }]}>✦</Text>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  aura: { position: 'absolute' },
  mote: { position: 'absolute' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  trail: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 4 },
  trailDot: { borderRadius: 4 },
  twinkle: { position: 'absolute' },
  twinkleText: { color: '#FFF6C8', fontSize: 14, textShadowColor: '#FFD86B', textShadowRadius: 6 },
  twinkleStill: { position: 'absolute' },
});
