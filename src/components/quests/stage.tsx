import { memo, useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useBreath } from '@/hooks/use-breath';
import { useMotionActive } from '@/hooks/use-motion-active';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { DUR, EASE_IN_OUT, EASE_OUT, pixelSnap } from '@/lib/motion-tokens';
import { UI_COPY } from '@/lib/quests/strings';
import { ART_PX, QT } from '@/lib/quests/theme';

/**
 * The pixel stage (ATO-BUILD PHASE-16). Layers, back to front: far, light/glow,
 * mid, ambient particles (20 or fewer), NPC, hero, front occluder, vignette +
 * tint. The real plates arrive with the atlas (PHASE-22); until then every
 * layer is drawn in code with a dev-only "PLACEHOLDER" label.
 *
 * ONE frame callback per screen lives here. It only counts steps (12 a second);
 * parallax, particles and the idle bob read that count. All pixel motion goes
 * through `pixelSnap`. Reduce Motion: quarter speed, half the particles, the
 * hero keeps BREATH, and the hop turns into a 400 ms react flash.
 */
const STEP_MS = 83;
const GROUND = 12 * ART_PX * 2; // a 24 art px ground strip
const FIGURE = 64 * ART_PX; // the 64 art px figure

interface Palette {
  farTop: string;
  farBottom: string;
  mid: string;
  glow: string;
  ground: string;
}

const PALETTES: Record<string, Palette> = {
  lantern: { farTop: '#08162E', farBottom: '#0B5E65', mid: '#050A14', glow: '#22D3EE', ground: '#0A1A26' },
  masquerade: { farTop: '#1E0B16', farBottom: '#7A3045', mid: '#12060D', glow: '#F9C22B', ground: '#241018' },
  city: { farTop: '#150D36', farBottom: '#4B2A7A', mid: '#0B0718', glow: '#22D3EE', ground: '#120C26' },
};
const paletteFor = (location: string): Palette => PALETTES[location.split('.')[0]] ?? PALETTES.lantern;

export interface StageProps {
  /** An art key such as `lantern.flooded-gate`. */
  location: string;
  tint?: string;
  cast?: string[];
  height: number;
  /** The text is typing: the hero idles and the speaker talks. */
  typing?: boolean;
  /** The current speaker is the NPC, not the hero. */
  npcSpeaking?: boolean;
  /** Changes when a choice is committed: the hero hops (or flashes). */
  hopKey?: number;
  /** Changes on a Rewind: a cyan scanline sweeps the plate. */
  rewindKey?: number;
  /** The ending: layers assemble one by one and a light sweeps across. */
  assemble?: boolean;
  /** Hides the loops (an overlay such as the chapter card is up). */
  paused?: boolean;
}

function Particle({
  i,
  w,
  h,
  step,
  color,
}: {
  i: number;
  w: number;
  h: number;
  step: SharedValue<number>;
  color: string;
}) {
  const x0 = (((i * 37) % 97) / 97) * w;
  const span = Math.max(40, h - GROUND);
  const y0 = (((i * 61) % 89) / 89) * span;
  const speed = (0.15 + ((i * 13) % 7) * 0.05) * ART_PX;
  const alpha = 0.3 + 0.2 * (i % 3);
  const style = useAnimatedStyle(() => {
    const raw = (y0 - step.value * speed) % span;
    const y = raw < 0 ? raw + span : raw;
    return {
      opacity: alpha,
      transform: [{ translateX: pixelSnap(x0 + Math.sin(step.value * 0.05 + i) * 3) }, { translateY: pixelSnap(y) }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.particle, { backgroundColor: color }, style]} />;
}

/** A stand-in figure (head, body, feet) until the real 64 px sprites land. */
const Figure = memo(function Figure({ body, accent }: { body: string; accent: string }) {
  return (
    <Svg width={FIGURE * 0.5} height={FIGURE} viewBox="0 0 32 64">
      <Ellipse cx={16} cy={61} rx={12} ry={3} fill="#000" opacity={0.35} />
      <Rect x={9} y={22} width={14} height={30} rx={4} fill={body} />
      <Rect x={9} y={50} width={5} height={10} fill={accent} />
      <Rect x={18} y={50} width={5} height={10} fill={accent} />
      <Circle cx={16} cy={13} r={9} fill={accent} />
      <Rect x={13} y={11} width={2} height={2} fill="#05070D" />
      <Rect x={18} y={11} width={2} height={2} fill="#05070D" />
    </Svg>
  );
});

function Scanline({ rewindKey, height, rm }: { rewindKey: number; height: number; rm: boolean }) {
  const y = useSharedValue(-4);
  const fade = useSharedValue(0);
  useEffect(() => {
    if (!rewindKey) return;
    if (rm) {
      // Reduce Motion: a 150 ms cross-fade of a flat wash instead of a sweep.
      fade.value = withSequence(withTiming(0.35, { duration: 75 }), withTiming(0, { duration: 75 }));
      return;
    }
    y.value = -4;
    fade.value = 1;
    y.value = withTiming(height, { duration: 300, easing: EASE_IN_OUT });
    fade.value = withDelay(260, withTiming(0, { duration: 40 }));
  }, [rewindKey, rm, height, y, fade]);
  const line = useAnimatedStyle(() => ({ opacity: rm ? 0 : fade.value, transform: [{ translateY: pixelSnap(y.value) }] }));
  const wash = useAnimatedStyle(() => ({ opacity: rm ? fade.value : 0 }));
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.wash, wash]} />
      <Animated.View pointerEvents="none" style={[styles.scanline, line]} />
    </>
  );
}

function LightSweep({ width, rm }: { width: number; rm: boolean }) {
  const x = useSharedValue(-width * 0.6);
  const flash = useSharedValue(0);
  useEffect(() => {
    if (rm) {
      // Reduce Motion: a brightness fade, no travel.
      flash.value = withSequence(withTiming(0.28, { duration: 300 }), withTiming(0, { duration: 300 }));
      return;
    }
    x.value = withDelay(500, withTiming(width * 1.2, { duration: 900, easing: EASE_IN_OUT }));
    return () => cancelAnimation(x);
  }, [rm, width, x, flash]);
  const band = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { skewX: '-20deg' }], opacity: rm ? 0 : 0.22 }));
  const wash = useAnimatedStyle(() => ({ opacity: rm ? flash.value : 0 }));
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.wash, { backgroundColor: '#FFFFFF' }, wash]} />
      <Animated.View pointerEvents="none" style={[styles.sweep, band]} />
    </>
  );
}

export function Stage({
  location,
  tint,
  cast,
  height,
  typing = false,
  npcSpeaking = false,
  hopKey = 0,
  rewindKey = 0,
  assemble = false,
  paused = false,
}: StageProps) {
  const { width } = useWindowDimensions();
  const rm = useMotionReduced();
  const active = useMotionActive() && !paused;
  const pal = paletteFor(location);
  const { style: breathStyle } = useBreath(false, false);
  const { style: glowStyle } = useBreath(false, true);

  const step = useSharedValue(0);
  const tick = useSharedValue(0);
  const speed = useSharedValue(1);
  useEffect(() => {
    speed.value = rm ? 0.25 : 1;
  }, [rm, speed]);
  const frame = useFrameCallback((info) => {
    'worklet';
    tick.value += (info.timeSincePreviousFrame ?? 16) * speed.value;
    const s = Math.floor(tick.value / STEP_MS);
    if (s !== step.value) step.value = s;
  }, false);
  useEffect(() => {
    frame.setActive(active);
    return () => frame.setActive(false);
  }, [active, frame]);

  // Parallax: far 1 art px per 500 ms, mid 1 art px per 250 ms, wrapping over 4 art px.
  const farStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pixelSnap(-(((step.value * STEP_MS) / 500) % 4) * ART_PX) }],
  }));
  const midStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pixelSnap(-(((step.value * STEP_MS) / 250) % 4) * ART_PX) }],
  }));

  // Hero idle bob and NPC talk bob, in whole art pixels.
  const hopY = useSharedValue(0);
  const react = useSharedValue(0);
  const heroStyle = useAnimatedStyle(() => {
    const slow = rm ? 36 : 12;
    const bob = typing ? (step.value % 2 === 0 ? -ART_PX : 0) : Math.floor(step.value / slow) % 2 === 0 ? 0 : -ART_PX;
    return { transform: [{ translateY: pixelSnap(bob + hopY.value) }] };
  });
  const npcStyle = useAnimatedStyle(() => {
    const talk = typing && npcSpeaking;
    const bob = talk ? (Math.floor(step.value / 2) % 2 === 0 ? -ART_PX : 0) : 0;
    return { transform: [{ translateY: pixelSnap(bob) }] };
  });
  const reactStyle = useAnimatedStyle(() => ({ opacity: react.value }));
  useEffect(() => {
    if (!hopKey) return;
    if (rm) {
      // Reduce Motion: no hop; a react frame (a cyan wash on the hero) for 400 ms.
      react.value = withSequence(withTiming(1, { duration: 100 }), withDelay(200, withTiming(0, { duration: 100 })));
      return;
    }
    // H3 react: up 2 art px, hold, land (60 / 60 / 120 ms).
    hopY.value = withSequence(
      withTiming(-2 * ART_PX, { duration: 60 }),
      withTiming(-2 * ART_PX, { duration: 60 }),
      withTiming(0, { duration: 120, easing: EASE_OUT }),
    );
  }, [hopKey, rm, hopY, react]);

  const count = rm ? 10 : 20;
  const fade = FadeIn.duration(rm ? 300 : DUR.beat);
  // Layers only enter one by one on the ending; otherwise the whole plate fades as one.
  const enter = (i: number) => (assemble ? FadeIn.delay(i * 180).duration(rm ? 200 : 320) : undefined);
  const pad = 8 * ART_PX;
  const groundY = height - GROUND;
  const hasNpc = (cast?.length ?? 0) > 0;

  return (
    <View style={[styles.stage, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* key: a new location is a new plate that fades in over 500 ms (300 under Reduce Motion). */}
      <Animated.View key={location} entering={assemble ? undefined : fade} style={StyleSheet.absoluteFill}>
        <Animated.View entering={enter(0)} style={[styles.layer, { left: -pad, width: width + pad * 2 }, farStyle]}>
          <Svg width={width + pad * 2} height={height}>
            <Defs>
              <LinearGradient id="far" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={pal.farTop} />
                <Stop offset="1" stopColor={pal.farBottom} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={width + pad * 2} height={height} fill="url(#far)" />
          </Svg>
        </Animated.View>

        <Animated.View entering={enter(1)} style={[StyleSheet.absoluteFill, glowStyle]}>
          <Svg width={width} height={height}>
            <Defs>
              <RadialGradient id="glow" cx="0.5" cy="0.55" r="0.55">
                <Stop offset="0" stopColor={pal.glow} stopOpacity={0.42} />
                <Stop offset="1" stopColor={pal.glow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={width} height={height} fill="url(#glow)" />
          </Svg>
        </Animated.View>

        <Animated.View entering={enter(2)} style={[styles.layer, { left: -pad, width: width + pad * 2 }, midStyle]}>
          <Svg width={width + pad * 2} height={height}>
            <Path
              d={`M0 0 H${width + pad * 2} V${height * 0.18} Q${width * 0.7} ${height * 0.34} ${width * 0.5} ${height * 0.16} Q${width * 0.25} ${height * 0.3} 0 ${height * 0.14} Z`}
              fill={pal.mid}
              opacity={0.92}
            />
            <Rect x={width * 0.08} y={height * 0.18} width={6} height={groundY - height * 0.18} fill={pal.mid} opacity={0.85} />
            <Rect x={width * 0.9} y={height * 0.16} width={6} height={groundY - height * 0.16} fill={pal.mid} opacity={0.85} />
          </Svg>
        </Animated.View>

        <Animated.View entering={enter(3)} style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: count }, (_, i) => (
            <Particle key={i} i={i} w={width} h={height} step={step} color={pal.glow} />
          ))}
        </Animated.View>

        <Animated.View entering={enter(4)} style={[styles.ground, { height: GROUND, backgroundColor: pal.ground }]} />

        {hasNpc ? (
          <Animated.View entering={enter(5)} style={[styles.figure, { left: width * 0.62, bottom: GROUND - 6 }, npcStyle]}>
            <Figure body="#3B2A66" accent="#A5B4FC" />
          </Animated.View>
        ) : null}

        <Animated.View entering={enter(6)} style={[styles.figure, { left: width * 0.16, bottom: GROUND - 6 }, breathStyle]}>
          <Animated.View style={heroStyle}>
            <Figure body="#0B5E65" accent="#5EEAD4" />
            <Animated.View pointerEvents="none" style={[styles.reactWash, reactStyle]} />
          </Animated.View>
        </Animated.View>

        <Animated.View entering={enter(7)} pointerEvents="none" style={[styles.occluder, { top: groundY - 2 }]}>
          <Svg width={width} height={GROUND + 2}>
            <Path d={`M0 ${GROUND} L0 14 L${width * 0.12} 4 L${width * 0.2} 16 L${width * 0.06} ${GROUND} Z`} fill={pal.mid} />
            <Path
              d={`M${width} ${GROUND} L${width} 10 L${width * 0.88} 2 L${width * 0.8} 14 L${width * 0.94} ${GROUND} Z`}
              fill={pal.mid}
            />
          </Svg>
        </Animated.View>

        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={width} height={height}>
            <Defs>
              <RadialGradient id="vig" cx="0.5" cy="0.5" r="0.75">
                <Stop offset="0.55" stopColor="#000" stopOpacity={0} />
                <Stop offset="1" stopColor="#000" stopOpacity={0.55} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={width} height={height} fill="url(#vig)" />
          </Svg>
        </View>
        {tint ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: 0.12 }]} /> : null}
      </Animated.View>

      {assemble ? <LightSweep width={width} rm={rm} /> : null}
      <Scanline rewindKey={rewindKey} height={height} rm={rm} />
      {__DEV__ ? <Text style={styles.placeholder}>{UI_COPY.placeholderPlate}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: '100%', overflow: 'hidden', backgroundColor: QT.bg },
  layer: { position: 'absolute', top: 0, bottom: 0 },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  figure: { position: 'absolute' },
  occluder: { position: 'absolute', left: 0, right: 0 },
  particle: { position: 'absolute', left: 0, top: 0, width: ART_PX, height: ART_PX },
  reactWash: { ...StyleSheet.absoluteFillObject, backgroundColor: QT.cyan, opacity: 0, borderRadius: 8 },
  wash: { ...StyleSheet.absoluteFillObject, backgroundColor: QT.cyan, opacity: 0 },
  scanline: { position: 'absolute', left: 0, right: 0, top: 0, height: 3, backgroundColor: QT.sky },
  sweep: { position: 'absolute', top: -20, bottom: -20, width: 80, backgroundColor: '#FFFFFF' },
  placeholder: {
    position: 'absolute',
    top: 6,
    left: 8,
    color: QT.amberSoft,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    opacity: 0.8,
  },
});
