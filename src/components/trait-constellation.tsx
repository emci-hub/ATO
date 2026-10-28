import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBreath } from '@/hooks/use-breath';
import { useMotionActive } from '@/hooks/use-motion-active';
import { useTheme } from '@/hooks/use-theme';
import { EASE_IN_OUT, EASE_OUT, SPRING_POP, haptic } from '@/lib/motion-tokens';
import {
  GOLD_COLOR,
  VARIANT_MOTION,
  constellationModel,
  type ConstellationModel,
  type ConstellationStar,
  type ConstellationVariant,
} from '@/lib/trait-constellation';
import { shapeGeometry, traitShapePoints } from '@/lib/trait-shape';
import type { TraitTrack } from '@/lib/trait-stability';
import type { TraitAxis } from '@/lib/traits';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const TWO_PI = Math.PI * 2;
const TWINKLE_MS = 4000;
const BRIGHTEN_DELAY_MS = 1600;

/**
 * "Your constellation" (ATO-BUILD PHASE-03): one star per trait that has a
 * track, placed like the points on "Your shape", joined by a line. Size and
 * brightness follow how clear the lean is; a firmly settled trait is gold.
 * No numbers on it, and nothing here calls a model.
 *
 * Motion (hero and header): the line draws in, stars twinkle, halos pulse,
 * stars in `changedAxes` brighten once, `ghostTracks` morph into `tracks`.
 * Mini and badge sit still. Reduce Motion: a 300 ms fade-in, then the whole
 * figure breathes over 8 s; no twinkle, halo or morph, and a colour change is a
 * 300 ms fade. Loops pause when the screen is unfocused or the app is in the
 * background. At most 16 stars + 16 halos + 3 other nodes animate.
 */
export function TraitConstellation({
  tracks,
  size,
  variant = 'hero',
  changedAxes,
  ghostTracks,
  forceReduceMotion = false,
  accent,
}: {
  tracks: readonly TraitTrack[];
  size: number;
  variant?: ConstellationVariant;
  /** Axes that just moved: each brightens once. */
  changedAxes?: readonly TraitAxis[];
  /** Last week's tracks: the figure morphs from these to `tracks`. */
  ghostTracks?: readonly TraitTrack[];
  forceReduceMotion?: boolean;
  /** Replaces the mode's accent (the Almanac's season tint on Home). */
  accent?: string;
}) {
  const model = useMemo(() => constellationModel(tracks, size, variant), [tracks, size, variant]);
  if (model.count === 0) {
    // Too small to hold the card (mini, badge): leave the space empty.
    return variant === 'mini' || variant === 'badge' ? null : <EmptyConstellation size={size} />;
  }
  return (
    <Sky
      model={model}
      size={size}
      variant={variant}
      changedAxes={changedAxes}
      ghostTracks={ghostTracks}
      forceReduceMotion={forceReduceMotion}
      accent={accent}
    />
  );
}

function EmptyConstellation({ size }: { size: number }) {
  return (
    <ThemedView type="backgroundElement" style={[styles.empty, { minWidth: Math.min(size, 280) }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Answer a few questions to light your first stars"
        accessibilityHint="Opens Questions"
        onPress={() => router.push('/intake-sweep')}
        style={styles.emptyPress}>
        <ThemedText type="smallBold">Answer a few questions to light your first stars</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Questions ›
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function Sky({
  model,
  size,
  variant,
  changedAxes,
  ghostTracks,
  forceReduceMotion,
  accent: accentOverride,
}: {
  model: ConstellationModel;
  size: number;
  variant: ConstellationVariant;
  changedAxes?: readonly TraitAxis[];
  ghostTracks?: readonly TraitTrack[];
  forceReduceMotion: boolean;
  accent?: string;
}) {
  const theme = useTheme();
  const accent = accentOverride ?? theme.accent;
  const { rm, style: breath } = useBreath(forceReduceMotion);
  const active = useMotionActive();
  const motion = VARIANT_MOTION[variant];
  const anim = motion.live && !rm;
  const hasGhost = !!ghostTracks && ghostTracks.length > 0;

  // Fade in (300 ms) in every mode; Reduce Motion then breathes via `breath`.
  const enter = useSharedValue(motion.live ? 0 : 1);
  useEffect(() => {
    if (!motion.live) return;
    enter.value = withTiming(1, { duration: 300 });
  }, [motion.live, enter]);
  const enterStyle = useAnimatedStyle(() => ({ opacity: enter.value }));

  // One clock drives every twinkle and halo: a single loop, UI thread.
  const clock = useSharedValue(0);
  const runClock = anim && active;
  useEffect(() => {
    if (!runClock) {
      cancelAnimation(clock);
      return;
    }
    clock.value = 0; // restart a full cycle after a pause, so nothing pops
    clock.value = withRepeat(withTiming(1, { duration: TWINKLE_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [runClock, clock]);

  // The line draws in (1 = undrawn, 0 = drawn).
  const draw = useSharedValue(anim && motion.line ? 1 : 0);
  useEffect(() => {
    if (!anim || !motion.line) {
      draw.value = 0;
      return;
    }
    draw.value = 1;
    draw.value = withDelay(300, withTiming(0, { duration: 1400, easing: EASE_IN_OUT }));
    return () => cancelAnimation(draw);
  }, [anim, motion.line, draw]);

  // Weekly morph: ghost points → current points (0 → 1).
  const morph = useSharedValue(hasGhost && anim ? 0 : 1);
  useEffect(() => {
    if (!hasGhost || !anim) {
      morph.value = 1;
      return;
    }
    morph.value = 0;
    morph.value = withDelay(400, withTiming(1, { duration: 1200, easing: EASE_IN_OUT }));
    return () => cancelAnimation(morph);
  }, [hasGhost, anim, morph]);

  const to = useMemo(() => model.geo.coords.flatMap((c) => [c.x, c.y]), [model]);
  const from = useMemo(() => {
    if (!hasGhost) return to;
    const ghost = shapeGeometry(traitShapePoints(null, ghostTracks, new Date()), size, size * 0.42);
    return ghost.coords.flatMap((c) => [c.x, c.y]);
  }, [hasGhost, ghostTracks, size, to]);
  const lineLen = Math.ceil(size * 4);
  const hasLine = motion.line && model.path !== null;
  const lineProps = useAnimatedProps(() => {
    const m = morph.value;
    let d = '';
    for (let i = 0; i < to.length; i += 2) {
      const x = from[i] + (to[i] - from[i]) * m;
      const y = from[i + 1] + (to[i + 1] - from[i + 1]) * m;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    return { d: d + 'Z', strokeDashoffset: draw.value * lineLen };
  });

  const changed = useMemo(() => new Set(changedAxes ?? []), [changedAxes]);
  const index = (axis: TraitAxis) => model.geo.coords.findIndex((c) => c.axis === axis);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={model.label}
      style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, enterStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, breath]}>
          <Svg width={size} height={size}>
            <Circle
              cx={model.geo.cx}
              cy={model.geo.cy}
              r={model.geo.outer}
              fill="none"
              stroke={theme.border}
              strokeWidth={0.75}
              strokeOpacity={0.5}
            />
            {hasLine ? (
              <AnimatedPath
                animatedProps={lineProps}
                fill="none"
                stroke={accent}
                strokeOpacity={0.55}
                strokeWidth={variant === 'mini' ? 1 : 1.5}
                strokeLinejoin="round"
                strokeDasharray={[lineLen, lineLen]}
              />
            ) : null}
            {model.stars.map((star) => {
              const i = index(star.axis);
              return (
                <Star
                  key={star.axis}
                  star={star}
                  index={i}
                  fx={from[i * 2]}
                  fy={from[i * 2 + 1]}
                  morph={morph}
                  clock={clock}
                  anim={anim}
                  rm={rm}
                  halo={motion.halos && anim}
                  bright={motion.live && changed.has(star.axis)}
                  active={active}
                  accent={accent}
                />
              );
            })}
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function Star({
  star,
  index,
  fx,
  fy,
  morph,
  clock,
  anim,
  rm,
  halo,
  bright,
  active,
  accent,
}: {
  star: ConstellationStar;
  index: number;
  fx: number;
  fy: number;
  morph: { value: number };
  clock: { value: number };
  anim: boolean;
  rm: boolean;
  halo: boolean;
  bright: boolean;
  active: boolean;
  accent: string;
}) {
  const { x, y, radius, brightness, phase, gold } = star;
  const pulse = useSharedValue(1);
  const goldP = useSharedValue(gold ? 1 : 0);

  // A colour change is a fade: 300 ms in Reduce Motion, 600 ms otherwise.
  useEffect(() => {
    if (bright) return;
    goldP.value = withTiming(gold ? 1 : 0, { duration: rm ? 300 : 600 });
  }, [gold, rm, bright, goldP]);

  // "Brightened": scale 1 → 1.8 → 1.25 plus gold, once, then a Light haptic.
  useEffect(() => {
    if (!bright) {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    const buzz = setTimeout(() => {
      if (active) haptic.commit();
    }, BRIGHTEN_DELAY_MS);
    if (rm) {
      goldP.value = withTiming(1, { duration: 300 });
    } else {
      pulse.value = withDelay(
        BRIGHTEN_DELAY_MS,
        withSequence(withTiming(1.8, { duration: 300, easing: EASE_OUT }), withSpring(1.25, SPRING_POP)),
      );
      goldP.value = withDelay(BRIGHTEN_DELAY_MS, withTiming(1, { duration: 600 }));
    }
    return () => {
      clearTimeout(buzz);
      cancelAnimation(pulse);
    };
    // `active` is read once when the timer fires; it must not replay the beat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bright, rm, pulse, goldP]);

  const starProps = useAnimatedProps(() => {
    const m = morph.value;
    const twinkle = anim ? 0.85 + 0.15 * Math.sin(TWO_PI * (clock.value + phase)) : 1;
    return {
      cx: fx + (x - fx) * m,
      cy: fy + (y - fy) * m,
      r: radius * pulse.value,
      opacity: brightness * twinkle,
      fill: interpolateColor(goldP.value, [0, 1], [accent, GOLD_COLOR]),
    };
  });
  const haloProps = useAnimatedProps(() => {
    const m = morph.value;
    const s = 0.5 + 0.5 * Math.sin(TWO_PI * (clock.value - index * 0.125));
    return {
      cx: fx + (x - fx) * m,
      cy: fy + (y - fy) * m,
      r: radius * 2.6 * (1 + 0.35 * s),
      fillOpacity: 0.2 - 0.15 * s,
    };
  });

  return (
    <>
      {halo ? <AnimatedCircle animatedProps={haloProps} fill={gold ? GOLD_COLOR : accent} /> : null}
      <AnimatedCircle animatedProps={starProps} />
    </>
  );
}

const styles = StyleSheet.create({
  empty: {
    borderRadius: Spacing.three,
  },
  emptyPress: {
    minHeight: 44,
    padding: Spacing.four,
    gap: Spacing.one,
    justifyContent: 'center',
  },
});
