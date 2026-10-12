/**
 * Underground (Streetwear art style) — the subway world behind the Dive pet,
 * and the line map that replaces the depth pips. Paint only: nothing here
 * reads or changes odds, finds or charges.
 *
 * Motion v2: KEEP idle life (`cuts.motion`) runs unless Motion is Off.
 * REPLACE pans (the crossing train, sliding doors) need `cuts.parallax`.
 * Under vestibularSafe the doors / enter-exit become a crossfade.
 */
import { useEffect, useRef } from 'react';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
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

import type { DiveWorldCuts } from '@/play/dive-fx-model';
import { hideoutIntegerScale } from '@/play/hideout-iso';
import { KEEP_TRAVEL_PT } from '@/play/play-motion';
import { streetStop } from '@/play/dive-street-names';
import { uiDrawable, type UiPiece } from '@/art/art';
import { ClipImage } from '@/play/sheet-sprite';
import { AmbientSprite, Drift } from '@/play/street-ambient';
import { STREET, STREET_FONT } from '@/play/street-ui';

/** Backdrop art (all stops are 256×320). Stage at 4 dpx → ~341×427pt on 3x. */
const STOP_CANVAS: readonly [number, number] = [256, 320];
/** Train art 256×80; it crosses every TRAIN_PERIOD_MS. */
const TRAIN_ASPECT = 256 / 80;
const TRAIN_CROSS_MS = 1600;
const TRAIN_PERIOD_MS = 9000;

function kit(name: UiPiece) {
  return uiDrawable(name);
}

/** The current stop, cover-fit, darkening as the ride goes down. */
export function StreetUndergroundWorld({
  width,
  height,
  depth,
  cuts,
}: {
  width: number;
  height: number;
  depth: number;
  cuts: DiveWorldCuts;
}) {
  const stop = streetStop(depth);
  const scale = hideoutIntegerScale({
    availW: width,
    availH: height,
    pixelRatio: PixelRatio.get(),
    canvas: STOP_CANVAS,
    content: [0, 0, STOP_CANVAS[0], STOP_CANVAS[1]],
  });
  const art = { w: scale.canvasW, h: scale.canvasH };
  const shade = Math.min(0.45, depth * 0.08);
  const pulse = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(pulse);
    pulse.value = 1;
    if (!cuts.motion) return;
    // In-place breathe so Reduced never sits still (no pan).
    pulse.value = withRepeat(withSequence(withTiming(1.03, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1);
    return () => cancelAnimation(pulse);
  }, [cuts.motion, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const flicker = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(flicker);
    flicker.value = 0;
    if (!cuts.motion) return;
    // A tired fluorescent tube: two quick dips, then steady for ~3s.
    flicker.value = withRepeat(
      withSequence(
        withDelay(2600, withTiming(0.35, { duration: 60 })),
        withTiming(0, { duration: 80 }),
        withTiming(0.25, { duration: 50 }),
        withTiming(0, { duration: 120 }),
      ),
      -1,
    );
    return () => cancelAnimation(flicker);
  }, [cuts.motion, flicker]);
  const flickerStyle = useAnimatedStyle(() => ({ opacity: flicker.value }));

  const train = useSharedValue(0);
  const trainW = Math.round(width * 1.1);
  const trainH = Math.round(trainW / TRAIN_ASPECT);
  useEffect(() => {
    cancelAnimation(train);
    train.value = 0;
    if (!cuts.parallax) return;
    train.value = withRepeat(
      withSequence(
        withDelay(TRAIN_PERIOD_MS - TRAIN_CROSS_MS, withTiming(1, { duration: TRAIN_CROSS_MS, easing: Easing.inOut(Easing.quad) })),
        withTiming(0, { duration: 0 }),
      ),
      -1,
    );
    return () => cancelAnimation(train);
  }, [cuts.parallax, train]);
  const trainStyle = useAnimatedStyle(() => ({
    opacity: train.value > 0 && train.value < 1 ? 0.85 : 0,
    transform: [{ translateX: -trainW + train.value * (width + trainW) }],
  }));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.world]}>
      <Animated.View
        style={[
          { position: 'absolute', width: art.w, height: art.h, left: (width - art.w) / 2, top: (height - art.h) / 2 },
          pulseStyle,
        ]}>
        <ClipImage drawable={kit(stop.art)} />
      </Animated.View>
      {cuts.parallax ? (
        <Animated.View style={[styles.train, { width: trainW, height: trainH, top: height * 0.42 }, trainStyle]}>
          <ClipImage drawable={kit('stop-train')} />
        </Animated.View>
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#05060c', opacity: shade }]} />
      {cuts.motion ? <Animated.View style={[StyleSheet.absoluteFill, styles.flicker, flickerStyle]} /> : null}
    </View>
  );
}

/**
 * Life on the line: drifting dust everywhere, plus one thing per stop — a
 * pigeon on the Platform, a rat in the Tunnels, drips and steam in the Sewers,
 * wisps in the Ghost Station, sparks at The Core. KEEP idle life needs
 * `cuts.motion`. Big crossings shrink under vestibularSafe (no parallax).
 */
export function StopAmbience({ width, height, depth, cuts }: { width: number; height: number; depth: number; cuts: DiveWorldCuts }) {
  const w = width;
  const h = height;
  const motes = cuts.motion;
  const critters = cuts.motion;
  const band = streetStop(depth).art;
  const dust = [0.12, 0.31, 0.54, 0.73, 0.9].map((x, i) => (
    <Drift key={`m${i}`} alive={motes} size={3} x0={x * w} y0={h * 0.85} x1={x * w + 14} y1={h * 0.18} ms={6400 + i * 900} delay={i * 1100}>
      <View style={styles.mote} />
    </Drift>
  ));
  let extra: React.ReactNode = null;
  if (band === 'stop-platform') {
    extra = (
      <>
        <Drift alive={critters} size={36} x0={cuts.parallax ? -40 : w * 0.2} y0={h * 0.8} x1={cuts.parallax ? w + 40 : w * 0.2 + KEEP_TRAVEL_PT} y1={h * 0.8} ms={9000} rest={6000} delay={2000} bob={2}>
          <AmbientSprite name="amb-pigeon" size={36} />
        </Drift>
        <Drift alive={critters} size={28} x0={w + 30} y0={h * 0.22} x1={-30} y1={h * 0.34} ms={5200} rest={13000} delay={7000}>
          <AmbientSprite name="amb-plane" size={28} flip />
        </Drift>
      </>
    );
  } else if (band === 'stop-tunnels') {
    extra = (
      <>
        <Drift alive={critters} size={34} x0={cuts.parallax ? w + 40 : w * 0.7} y0={h * 0.84} x1={cuts.parallax ? -40 : w * 0.7 - KEEP_TRAVEL_PT} y1={h * 0.84} ms={2600} rest={8000} delay={1500} bob={1}>
          <AmbientSprite name="amb-rat-run" size={34} flip />
        </Drift>
        <Drift alive={motes} size={22} x0={w * 0.2} y0={h * 0.3} x1={w * 0.34} y1={h * 0.22} ms={3600} rest={2500}>
          <AmbientSprite name="amb-moth" size={22} />
        </Drift>
      </>
    );
  } else if (band === 'stop-sewers') {
    extra = (
      <>
        {[0.28, 0.5, 0.71].map((x, i) => (
          <Drift key={`d${i}`} alive={motes} size={18} x0={x * w} y0={h * 0.12} x1={x * w} y1={h * 0.58} ms={1400 + i * 450} rest={900 + i * 700} delay={i * 600}>
            <AmbientSprite name="amb-drip" size={18} />
          </Drift>
        ))}
        <Drift alive={motes} size={40} x0={w * 0.62} y0={h * 0.8} x1={w * 0.58} y1={h * 0.45} ms={4200} rest={1800}>
          <AmbientSprite name="amb-steam" size={40} />
        </Drift>
      </>
    );
  } else if (band === 'stop-ghost') {
    extra = [0.2, 0.47, 0.8].map((x, i) => (
      <Drift key={`g${i}`} alive={motes} size={26} x0={x * w} y0={h * 0.7} x1={x * w + (i % 2 ? -18 : 18)} y1={h * 0.25} ms={5200 + i * 1300} delay={i * 1500}>
        <AmbientSprite name="amb-wisp" size={26} />
      </Drift>
    ));
  } else if (band === 'stop-core') {
    extra = [0.18, 0.34, 0.5, 0.64, 0.8, 0.9].map((x, i) => (
      <Drift key={`s${i}`} alive={motes} size={16} x0={x * w} y0={h * 0.88} x1={x * w + (i % 2 ? 10 : -10)} y1={h * 0.4} ms={1500 + i * 260} rest={400 + i * 300} delay={i * 330}>
        <AmbientSprite name="amb-spark" size={16} />
      </Drift>
    ));
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {dust}
      {extra}
    </View>
  );
}

/**
 * Subway doors — the stop-to-stop transition (a "barn door" wipe, the
 * standard door-close cut): the doors slide shut (200ms), the next stop's
 * sign shows (160ms), the doors open on the new stop (220ms). 580ms total,
 * inside the Dive's 650ms action pace; fire-and-forget, never awaited.
 * Plays when `cue` rises to a new stop (not on mount, bust or head up).
 * Full: barn-door slide. vestibularSafe (`gentle`): crossfade + sign.
 */
export function SubwayDoors({
  cue,
  label,
  alive,
  gentle = false,
  width,
  height,
}: {
  cue: number;
  label: string;
  alive: boolean;
  gentle?: boolean;
  width: number;
  height: number;
}) {
  const t = useSharedValue(0);
  const last = useRef(cue);
  useEffect(() => {
    const prev = last.current;
    last.current = cue;
    if (cue === prev || cue < 0 || !alive) return;
    t.value = 0;
    t.value = withSequence(
      withTiming(1, { duration: gentle ? 180 : 200, easing: Easing.in(Easing.quad) }),
      withDelay(gentle ? 120 : 160, withTiming(2, { duration: gentle ? 180 : 220, easing: Easing.out(Easing.quad) })),
      withTiming(0, { duration: 0 }),
    );
  }, [alive, cue, gentle, t]);
  const half = width / 2 + 2;
  const leftStyle = useAnimatedStyle(() => {
    const v = t.value;
    const shut = v <= 1 ? v : 2 - v;
    return gentle
      ? { opacity: shut }
      : { transform: [{ translateX: -half + shut * half }] };
  });
  const rightStyle = useAnimatedStyle(() => {
    const v = t.value;
    const shut = v <= 1 ? v : 2 - v;
    return gentle
      ? { opacity: shut }
      : { transform: [{ translateX: width - shut * half }] };
  });
  const signStyle = useAnimatedStyle(() => ({ opacity: t.value > 0.85 && t.value < 1.5 ? 1 : 0 }));
  if (!alive || width <= 0) return null;
  const door = (
    <>
      <View style={[styles.doorWindow, { height: height * 0.32, top: height * 0.18 }]} />
      <View style={styles.doorStripe} />
    </>
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.door, { width: half, height }, leftStyle]}>{door}</Animated.View>
      <Animated.View style={[styles.door, { width: half, height }, rightStyle]}>{door}</Animated.View>
      <Animated.View style={[styles.signWrap, signStyle]}>
        <View style={styles.sign}>
          <Text style={styles.signText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

/** Short map label; a stop that repeats the one before shows no name. */
function mapName(i: number): string {
  const name = streetStop(i).name;
  if (i > 0 && streetStop(i - 1).name === name) return '';
  return name.replace(/^The /, '').replace(/ Station$/, '');
}

/** Full-width subway line: one column per stop, the dot over its name. */
export function StreetLineMap({ depth, max }: { depth: number; max: number }) {
  const stops = Array.from({ length: max + 1 }, (_, i) => i);
  const n = stops.length;
  const edge = `${50 / n}%` as const;
  // Percent of the track itself (dot 0 → dot n-1).
  const done = n > 1 ? `${(Math.max(0, Math.min(depth, max)) / (n - 1)) * 100}%` : '0%';
  return (
    <View style={styles.map} accessible accessibilityLabel={`${streetStop(depth).name}, stop ${depth + 1} of ${max + 1}`}>
      <View style={[styles.track, { left: edge, right: edge }]}>
        <View style={[styles.trackOn, { width: done as `${number}%` }]} />
      </View>
      {stops.map((i) => (
        <View key={i} style={styles.stopCol}>
          <View style={styles.dotSlot}>
            <View style={[styles.dot, i <= depth && styles.dotOn, i === depth && styles.dotHere]} />
          </View>
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={[styles.mapName, i === depth && styles.mapNameHere]}>
            {mapName(i)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Enter / leave the Underground through the manhole. Full: a dramatic drop
 * into the hole. vestibularSafe: a crossfade. Never a hard cut.
 */
export function ManholeTransit({
  mode,
  gentle,
  onDone,
}: {
  mode: 'off' | 'cover' | 'reveal';
  gentle: boolean;
  onDone?: () => void;
}) {
  const t = useSharedValue(mode === 'reveal' ? 1 : 0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (mode === 'off') return;
    const to = mode === 'cover' ? 1 : 0;
    t.value = mode === 'cover' ? 0 : 1;
    t.value = withTiming(to, { duration: gentle ? 280 : 520, easing: Easing.inOut(Easing.cubic) });
    const id = setTimeout(() => done.current?.(), gentle ? 300 : 540);
    return () => clearTimeout(id);
  }, [mode, gentle, t]);
  const style = useAnimatedStyle(() => {
    const v = t.value;
    if (gentle) return { opacity: v, backgroundColor: '#05060c' };
    return {
      opacity: v,
      backgroundColor: '#05060c',
      transform: [{ translateY: (1 - v) * -80 }, { scale: 1 + v * 0.35 }],
    };
  });
  if (mode === 'off') return null;
  return <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFill, style]} />;
}

const styles = StyleSheet.create({
  world: { overflow: 'hidden', backgroundColor: '#0b1020' },
  train: { position: 'absolute', left: 0 },
  flicker: { backgroundColor: '#000' },
  map: { flexDirection: 'row', width: '100%', paddingVertical: 2 },
  // The track runs centre-to-centre behind the dots (dot slot is 16pt tall).
  track: { position: 'absolute', top: 2 + 6, height: 4, backgroundColor: '#4b5563', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#000' },
  trackOn: { height: '100%', backgroundColor: STREET.mustard },
  stopCol: { flex: 1, alignItems: 'center', gap: 2 },
  dotSlot: { height: 16, alignItems: 'center', justifyContent: 'center' },
  mapName: { fontFamily: STREET_FONT.regular, fontSize: 11, lineHeight: 14, color: '#9AA3AD', textAlign: 'center' },
  mapNameHere: { fontFamily: STREET_FONT.bold, color: STREET.mustard },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#000', backgroundColor: '#4b5563' },
  dotOn: { backgroundColor: STREET.mustard },
  dotHere: { width: 14, height: 14, borderRadius: 7, backgroundColor: STREET.paper, borderColor: STREET.mustard },
  mote: { width: 3, height: 3, backgroundColor: '#e8e4da', opacity: 0.7 },
  door: { position: 'absolute', left: 0, top: 0, backgroundColor: '#9aa3ad', borderLeftWidth: 3, borderRightWidth: 3, borderColor: '#1a1a1d' },
  doorWindow: { position: 'absolute', left: '18%', right: '18%', backgroundColor: '#1d2b44', borderWidth: 3, borderColor: '#1a1a1d' },
  doorStripe: { position: 'absolute', left: 0, right: 0, bottom: '12%', height: 8, backgroundColor: STREET.mustard },
  signWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  sign: { backgroundColor: STREET.mustard, borderWidth: 3, borderColor: '#000', paddingHorizontal: 16, paddingVertical: 6 },
  signText: { fontFamily: STREET_FONT.bold, fontSize: 20, color: STREET.ink, textTransform: 'uppercase' },
  stopName: { fontFamily: STREET_FONT.bold, fontSize: 15, color: STREET.paper, textTransform: 'uppercase', textAlign: 'center' },
});
