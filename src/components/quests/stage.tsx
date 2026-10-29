import { useEffect } from 'react';
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
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { AtlasSprite, frameBox, hasArt } from '@/components/quests/atlas-sprite';
import { useMotionActive } from '@/hooks/use-motion-active';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { DUR, EASE_IN_OUT, EASE_OUT, pixelSnap } from '@/lib/motion-tokens';
import { ATLAS_ANIMS } from '@/lib/quests/art-keys';
import { UI_COPY } from '@/lib/quests/strings';
import { ART_PX, QT } from '@/lib/quests/theme';

/**
 * The pixel stage (ATO-BUILD PHASE-16, real art from PHASE-22). Layers, back to front: far plate,
 * light/glow, mid plate, ground strip, ambient clips, props, NPCs, hero, dust motes, vignette +
 * tint. A plate is 194 x 100 art pixels; the stage scales it by `sc` points per art pixel (2 at
 * 1x, more only when the screen is wider than the plate) and centres it, so the art is never
 * resampled up to a 380 pt wide screen; a wider phone scales a little (2.1x at 390 pt). The ending location is one finished card instead.
 *
 * ONE frame callback per screen lives here. It keeps a millisecond clock (quarter speed under
 * Reduce Motion) that every clip, the glow pulse, the neon buzz and the parallax read, and a step
 * count (12 a second) for the dust motes. All pixel motion goes through `pixelSnap`. Reduce
 * Motion: quarter speed, half the particles, no neon off-frame, and the hop turns into a 400 ms
 * react flash; ambient motion is slowed, never switched off.
 */
const STEP_MS = 83;
const GROUND = 12 * ART_PX * 2; // the 24 art px ground strip, in points at 1x (dust motes stay above it)
const PLATE_W = 194;
const PLATE_H = 100;
const FLOOR_Y = 94; // art px from the plate top where the feet stand
const GROUND_H = 24;
const TRAVEL = 3; // parallax swing, art px peak to peak
const GLOW_LEVELS = [0.55, 0.8, 1, 0.8]; // 4 levels at 250 ms
const BUZZ_AT = [0, 9000, 15500, 27500, 34500, 48000]; // neon off-frames, 6 to 14 s apart
const BUZZ_LOOP = 56000;

interface Palette {
  farTop: string;
  farBottom: string;
  glow: string;
}

const PALETTES: Record<string, Palette> = {
  lantern: { farTop: '#08162E', farBottom: '#0B5E65', glow: '#22D3EE' },
  masquerade: { farTop: '#1E0B16', farBottom: '#7A3045', glow: '#F9C22B' },
  city: { farTop: '#150D36', farBottom: '#4B2A7A', glow: '#22D3EE' },
};
const paletteFor = (location: string): Palette => PALETTES[location.split('.')[0]] ?? PALETTES.lantern;

interface Ambient {
  /** Clip name, e.g. `amb.lantern.drip`. */
  name: string;
  /** Top-left in plate art pixels. */
  x: number;
  y: number;
  opacity?: number;
}

const DRIP_X: Record<string, number> = {
  'lantern.flooded-gate': 28,
  'lantern.tunnel-fork': 150,
  'lantern.toll-bridge': 20,
  'lantern.singing-lake': 96,
  'lantern.ceiling-crack': 120,
};

/** Which looping scenery a location has (positions in plate art pixels). */
function ambientFor(location: string, props: { id: string; x: number }[]): Ambient[] {
  const out: Ambient[] = [];
  if (location in DRIP_X) out.push({ name: 'amb.lantern.drip', x: DRIP_X[location], y: 44 });
  if (location === 'masquerade.ballroom') out.push({ name: 'amb.masquerade.dancers', x: 49, y: 46 });
  if (location === 'masquerade.balcony') out.push({ name: 'amb.masquerade.curtain', x: 0, y: 4 });
  if (location.startsWith('masquerade.')) {
    for (const p of props) if (p.id === 'candelabra') out.push({ name: 'amb.masquerade.candle-flame', x: p.x - 8, y: FLOOR_Y - 45 - 14 });
  }
  if (location === 'city.night-street' || location === 'city.rooftop') {
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) out.push({ name: 'amb.city.rain', x: c * 64, y: r * 64, opacity: 0.45 });
  }
  if (location === 'city.cancelled-platform') out.push({ name: 'amb.city.train', x: 0, y: 56, opacity: 0.9 });
  return out;
}

const NPC_X: Record<number, number[]> = { 1: [0.7], 2: [0.66, 0.86], 3: [0.5, 0.68, 0.86] };
const heroX = (npcs: number) => (npcs >= 3 ? 0.2 : npcs > 0 ? 0.3 : 0.5);

export interface StageProps {
  /** An art key such as `lantern.flooded-gate`, or an ending key such as `lantern.ending-singing-deep`. */
  location: string;
  tint?: string;
  cast?: string[];
  /** Props the scene places, x in plate art pixels. */
  props?: { id: string; x: number }[];
  /** The stage hero (a QUEST_HERO_KEYS slug). */
  hero?: string;
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

/** A 1 art px glint on the water that comes and goes (the lake shimmer). */
function Glint({ i, left, top, w, sc, tick }: { i: number; left: number; top: number; w: number; sc: number; tick: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: (Math.floor(tick.value / 330) + i) % 3 === 0 ? 0.7 : 0.12 }));
  return <Animated.View pointerEvents="none" style={[styles.glint, { left, top, width: w * sc, height: sc }, style]} />;
}

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
  props,
  hero = 'druid',
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
  const camp = location.split('.')[0];

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

  // Scale: 2 pt per art px, more only to cover a wider stage. The plate is centred, sits on the
  // bottom edge and overscans by at least the parallax swing, so its sides never show; a taller
  // stage shows the dark backdrop gradient above it (never a resampled plate).
  const isEnding = hasArt(`end.${location}`);
  const hasPlate = hasArt(`plate.${location}.far`);
  const sc = Math.max(ART_PX, width / (PLATE_W - 4));
  const plateW = PLATE_W * sc;
  const plateH = PLATE_H * sc;
  const plateLeft = (width - plateW) / 2;
  const plateTop = height - plateH;
  const floorY = plateTop + FLOOR_Y * sc;

  // Parallax: far 1 art px per 500 ms, mid 1 art px per 250 ms, swinging back and forth.
  const farStyle = useAnimatedStyle(() => {
    const t = (tick.value / 500) % (TRAVEL * 2);
    return { transform: [{ translateX: pixelSnap(-((t < TRAVEL ? t : TRAVEL * 2 - t) - TRAVEL / 2) * sc) }] };
  });
  const midStyle = useAnimatedStyle(() => {
    const t = (tick.value / 250) % (TRAVEL * 2);
    return { transform: [{ translateX: pixelSnap(-((t < TRAVEL ? t : TRAVEL * 2 - t) - TRAVEL / 2) * sc) }] };
  });

  // Light: lantern and ballroom glow pulses in 4 levels at 250 ms; the city glow is a neon buzz
  // (two levels 1600 ms apart, one 80 ms off-frame every 6 to 14 s, none under Reduce Motion).
  const neon = camp === 'city';
  const glowStyle = useAnimatedStyle(() => {
    if (neon) {
      const phase = tick.value % BUZZ_LOOP;
      let off = false;
      for (let i = 0; i < BUZZ_AT.length; i++) if (phase >= BUZZ_AT[i] && phase < BUZZ_AT[i] + 80) off = true;
      return { opacity: off && !rm ? 0 : Math.floor(tick.value / 1600) % 2 === 0 ? 0.9 : 0.65 };
    }
    return { opacity: GLOW_LEVELS[Math.floor(tick.value / 250) % 4] };
  });

  // The hero hops (or flashes) when a choice is committed.
  const hopY = useSharedValue(0);
  const react = useSharedValue(0);
  const heroStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pixelSnap(hopY.value) }] }));
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
      withTiming(-2 * sc, { duration: 60 }),
      withTiming(-2 * sc, { duration: 60 }),
      withTiming(0, { duration: 120, easing: EASE_OUT }),
    );
  }, [hopKey, rm, sc, hopY, react]);

  const count = rm ? 10 : 20;
  const fade = FadeIn.duration(rm ? 300 : DUR.beat);
  // Layers only enter one by one on the ending; otherwise the whole plate fades as one.
  const enter = (i: number) => (assemble ? FadeIn.delay(i * 180).duration(rm ? 200 : 320) : undefined);
  const groundName = `plate.${location}.ground`;
  const hasGround = hasArt(groundName);
  const npcs = (cast ?? []).filter((n) => hasArt(`npc.${n}.idle`));
  const npcShown = npcs.slice(0, 3);
  const slots = NPC_X[npcShown.length] ?? [];
  const heroName = ATLAS_ANIMS[`hero.${hero}.idle`] ? hero : 'druid';
  const heroTalks = typing && !npcSpeaking && !!ATLAS_ANIMS[`hero.${heroName}.talk`];
  const heroClip = `hero.${heroName}.${heroTalks ? 'talk' : 'idle'}`;
  const heroBox = frameBox(heroClip, sc);
  const heroFootX = width * heroX(npcs.length);
  const ambient = hasPlate ? ambientFor(location, props ?? []) : [];
  const endBox = isEnding ? frameBox(`end.${location}`, Math.max(ART_PX, height / 116, width / 192)) : null;

  return (
    <View style={[styles.stage, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* key: a new location is a new plate that fades in over 500 ms (300 under Reduce Motion). */}
      <Animated.View key={location} entering={assemble ? undefined : fade} style={StyleSheet.absoluteFill}>
        {isEnding && endBox ? (
          <Animated.View entering={enter(0)} style={[styles.layer, { left: (width - endBox.w) / 2, top: (height - endBox.h) / 2, width: endBox.w, height: endBox.h }]}>
            <AtlasSprite name={`end.${location}`} sc={Math.max(ART_PX, height / 116, width / 192)} />
          </Animated.View>
        ) : null}

        {!isEnding ? (
          <Animated.View entering={enter(0)} style={StyleSheet.absoluteFill}>
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id="far" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={pal.farTop} />
                  <Stop offset="1" stopColor={pal.farBottom} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={width} height={height} fill="url(#far)" />
            </Svg>
          </Animated.View>
        ) : null}

        {hasPlate ? (
          <>
            <Animated.View entering={enter(0)} style={[styles.layer, { left: plateLeft, top: plateTop, width: plateW, height: plateH }, farStyle]}>
              <AtlasSprite name={`plate.${location}.far`} sc={sc} />
            </Animated.View>

            <Animated.View entering={enter(1)} pointerEvents="none" style={[StyleSheet.absoluteFill, glowStyle]}>
              <Svg width={width} height={height}>
                <Defs>
                  <RadialGradient id="glow" cx="0.5" cy="0.55" r="0.55">
                    <Stop offset="0" stopColor={pal.glow} stopOpacity={0.3} />
                    <Stop offset="1" stopColor={pal.glow} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect x={0} y={0} width={width} height={height} fill="url(#glow)" />
              </Svg>
            </Animated.View>

            <Animated.View entering={enter(2)} style={[styles.layer, { left: plateLeft, top: plateTop, width: plateW, height: plateH }, midStyle]}>
              <AtlasSprite name={`plate.${location}.mid`} sc={sc} />
            </Animated.View>

            {hasGround ? (
              <Animated.View entering={enter(3)} style={[styles.layer, { left: plateLeft, top: plateTop + (PLATE_H - GROUND_H) * sc }]}>
                <AtlasSprite name={groundName} sc={sc} />
              </Animated.View>
            ) : null}

            <Animated.View entering={enter(3)} pointerEvents="none" style={StyleSheet.absoluteFill}>
              {ambient.map((a, i) => (
                <AtlasSprite
                  key={`${a.name}-${i}`}
                  name={a.name}
                  sc={sc}
                  elapsed={tick}
                  style={{ position: 'absolute', left: plateLeft + a.x * sc, top: plateTop + a.y * sc, opacity: a.opacity ?? 1 }}
                />
              ))}
              {location === 'lantern.singing-lake'
                ? [0, 1, 2, 3, 4, 5].map((i) => (
                    <Glint key={i} i={i} sc={sc} tick={tick} w={5 + (i % 3) * 2} left={plateLeft + (30 + i * 23) * sc} top={plateTop + (66 + (i % 3) * 3) * sc} />
                  ))
                : null}
            </Animated.View>

            {(props ?? []).map((p, i) => {
              const box = frameBox(`prop.${camp}.${p.id}`, sc);
              return box ? (
                <Animated.View key={`${p.id}-${i}`} entering={enter(4)} style={[styles.layer, { left: plateLeft + p.x * sc - box.footX, top: floorY - box.footY }]}>
                  <AtlasSprite name={`prop.${camp}.${p.id}`} sc={sc} />
                </Animated.View>
              ) : null;
            })}

            {npcShown.map((n, i) => {
              const talks = typing && npcSpeaking && i === 0;
              const clip = `npc.${n}.${talks ? 'talk' : 'idle'}`;
              const box = frameBox(clip, sc);
              if (!box) return null;
              // NPC art faces right; they stand to the hero's right and face left (mirrored foot x).
              return (
                <Animated.View
                  key={n}
                  entering={enter(5)}
                  style={[styles.layer, { left: width * slots[i] - (box.w - box.footX), top: floorY - box.footY }]}
                >
                  <AtlasSprite name={clip} sc={sc} elapsed={tick} flip />
                </Animated.View>
              );
            })}

            {heroBox ? (
              <Animated.View entering={enter(6)} style={[styles.layer, { left: heroFootX - heroBox.footX, top: floorY - heroBox.footY }, heroStyle]}>
                <AtlasSprite name={heroClip} sc={sc} elapsed={tick} />
                <Animated.View pointerEvents="none" style={[styles.reactWash, reactStyle]} />
              </Animated.View>
            ) : null}

            <Animated.View entering={enter(7)} pointerEvents="none" style={StyleSheet.absoluteFill}>
              {Array.from({ length: count }, (_, i) => (
                <Particle key={i} i={i} w={width} h={height} step={step} color={pal.glow} />
              ))}
            </Animated.View>
          </>
        ) : null}

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
      {__DEV__ && !hasPlate && !isEnding ? <Text style={styles.placeholder}>{UI_COPY.placeholderPlate}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: '100%', overflow: 'hidden', backgroundColor: QT.bg },
  layer: { position: 'absolute' },
  particle: { position: 'absolute', left: 0, top: 0, width: ART_PX, height: ART_PX },
  glint: { position: 'absolute', backgroundColor: '#A5F3FC' },
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
