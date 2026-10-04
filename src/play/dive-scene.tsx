/**
 * Dive scene (v21 → overhaul 2026-09-29) — the scene IS the Dive screen
 * (Dave the Diver / Downwell feel), drawn in code + existing art only.
 *
 *   - Camera: Deeper scrolls the world down one zone band; a mid layer of
 *     plankton/specks moves faster (parallax), so it feels like sinking.
 *   - Zones (neon): Shallows light blue with light rays, Reef teal, Trench
 *     navy, Abyss near-black with drifting specks, Hadal violet-black.
 *   - Life: rising bubbles, up to 5 faint fish outlines (react-native-svg),
 *     the pet swimming on its walk clip with a bubble trail.
 *   - Finds rise from the pet, glow in their rarity colour and fly into the
 *     haul row; rare-or-better also flash (inside the existing cooldown).
 *   - Tension: the edges close in as the SHOWN bust % climbs, with a slow
 *     heartbeat over 40%.
 *   - Bust: shake, the pet's hurt clip (or a red flash), lost finds sink into
 *     the dark, saved ones stay glowing, then the pet dashes back up.
 *   - Surface: a splash and sunlight, the haul counts up, shells fly to the
 *     counter, the pet's skill clip as a victory pose.
 *
 * It only READS the shown %; it never computes or changes odds, and nothing
 * here waits on an animation before Surface/Deeper can resolve.
 * Reduced motion: no parallax, shake, pulse, bubbles or fish — simple fades.
 * FX Low (dive-fx-level.ts): the cut list — fish, parallax, bubble count and
 * trail, rays, the pulse.
 *
 * v25 (2026-09-30) — a sunken ruin (dive-world.tsx): the dive starts at the
 * surface (sky, waterline, the pet on the rim), the pet jumps in with a
 * splash and the camera follows; a shaft of dungeon walls (parallax) and
 * props per zone, the Abyss dragon, the Shark Tide Knight in the Reef and
 * Trench; the pet tilts head-down as it sinks and bobs while you decide;
 * finds burst out of a crate / chest. Cut order on Low: shark, dragon,
 * parallax (then props, trail) — see `diveWorldCuts`.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PixelRatio, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
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
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { DiveFxLevel } from '@/play/dive-fx-level';
import {
  DIVE_DEPTH_INK,
  DIVE_MAX_DEPTH,
  GLOW_COLOR,
  REVEAL_FLASH_MS,
  REVEAL_FLY_MS,
  REVEAL_HOLD_RARE_MS,
  REVEAL_RISE_MS,
  RAYS_UNTIL_DEPTH,
  SHARK_DEPTHS,
  diveWorldCuts,
  findBoxArt,
  findGlow,
  isRareOrBetter,
  revealMs,
  vignetteFor,
  type FindGlow,
} from '@/play/dive-fx-model';
import { FindIcon } from '@/play/dive-hud';
import { AbyssDragon, BOX_OPEN, Caustics, DiveWater, FindBox, LightRays, ShaftWalls, SharkGlide, SurfaceSky, WALL_W, WATERLINE, ZoneProps } from '@/play/dive-world';
import { SpriteSwap } from '@/play/pixel-ambient';
import { findName } from '@/play/dive-loot';
import { PIXEL } from '@/play/pixel-theme';
import { PixelBody, PixelFrame, PixelLabel } from '@/play/pixel-ui';
import type { PetState } from '@/play/pet';
import { petPose, sharpPetBox, type PetPose } from '@/play/pet-actor';
import { PetAnimSprite, usePetArt, type PetArt, type PetFace } from '@/play/pet-anim-sprite';
import type { Grade } from '@/play/pet-eggs';
import { GradeAura, ShinyOverlay } from '@/play/pet-looks';
import type { PetWear } from '@/play/pet-cosmetics';

const PET_WANT_BOX = 112;
const SLOT = 40;
const ROW_PAD = 12;
const ICON = 36;
const FIND_BOX = 44;

export type DiveZone = 'Shallows' | 'Reef' | 'Trench' | 'Abyss' | 'Hadal';

/** Depth (Deepers survived) → zone. Abyss is depth 4; Hadal (5) needs Oxygen. */
export function diveZone(depth: number): DiveZone {
  if (depth <= 0) return 'Shallows';
  if (depth <= 2) return 'Reef';
  if (depth === 3) return 'Trench';
  if (depth === 4) return 'Abyss';
  return 'Hadal';
}

/** How the pet reacts to the shown bust % (null = no Deeper on offer). */
export type DiveMood = 'calm' | 'nervous' | 'shake';
export function diveMood(bustPct: number | null): DiveMood {
  if (bustPct == null || bustPct < 25) return 'calm';
  if (bustPct <= 40) return 'nervous';
  return 'shake';
}

/** The last surface / bust. `lost` sink away, `saved` stay (a bust); `ids`
 * is the banked haul (a surface). `finds` / `shells` drive the count-up. */
export type DiveSceneEvent = {
  kind: 'bust' | 'surface';
  key: number;
  finds: number;
  shells: number;
  ids: readonly string[];
  lost: readonly string[];
  saved: readonly string[];
} | null;

/** A new find to reveal: rises from the pet into haul slot `slot`. */
export type DiveReveal = { id: string; key: number; glow: FindGlow; slot: number } | null;

/* --------------------------------------------------------------- life --- */

function Bubble({
  x,
  height,
  dur,
  delay,
  alive,
}: {
  x: number;
  height: number;
  dur: number;
  delay: number;
  alive: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.linear }), -1));
    return () => cancelAnimation(t);
  }, [t, dur, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value > 0 ? 0.55 * (1 - t.value * 0.6) : 0,
    transform: [{ translateY: height - t.value * (height + 30) }, { translateX: Math.sin(t.value * 12) * 4 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left: x, top: 0 }, style]}>
      <SpriteSwap atlas="dive" frames={['bubble', 'bubble2']} alive={alive} ms={220} />
    </Animated.View>
  );
}

function Fish({
  y,
  width,
  size,
  dur,
  delay,
  rightward,
}: {
  y: number;
  width: number;
  size: number;
  dur: number;
  delay: number;
  rightward: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.linear }), -1));
    return () => cancelAnimation(t);
  }, [t, dur, delay]);
  const style = useAnimatedStyle(() => {
    const p = rightward ? t.value : 1 - t.value;
    return {
      transform: [
        { translateX: -size * 2 + p * (width + size * 4) },
        { translateY: Math.sin(t.value * 18) * 3 },
        { scaleX: rightward ? 1 : -1 },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { top: y, left: 0 }, style]}>
      <SpriteSwap atlas="dive" frames={['fish0', 'fish2']} alive ms={180} />
    </Animated.View>
  );
}

/** A lost find sinking into the dark (bust). */
function Sinking({ id, left, top, drop, reduceMotion }: { id: string; left: number; top: number; drop: number; reduceMotion: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(reduceMotion ? 0 : 250, withTiming(1, { duration: reduceMotion ? 400 : 1000, easing: Easing.in(Easing.quad) }));
  }, [t, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: reduceMotion ? [] : [{ translateY: t.value * drop }, { rotate: `${t.value * 40}deg` }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left, top }, style]}>
      <FindIcon id={id} size={ICON} dim />
    </Animated.View>
  );
}

/** The pet in the water: turns left/right in step with the sway, with a
 * bubble trail behind it. Its own state, so a turn never redraws the scene. */
function SwimmingPet({
  pet,
  art,
  wear,
  eggColor,
  pose,
  box,
  turn,
  trail,
  grade,
  shiny,
  recolor,
  tilt,
  auraElement = null,
}: {
  pet: PetState;
  art: PetArt;
  wear: PetWear;
  eggColor: string;
  pose: { pose: PetPose | null; loop: boolean; at: number };
  box: number;
  turn: boolean;
  trail: boolean;
  /** v23 — looks only: the grade glow, a shiny's colours, a 3★ dye. */
  grade: Grade | null;
  shiny: boolean;
  recolor: string | null;
  /** v25 — 0..1 head-down while sinking. */
  tilt: SharedValue<number>;
  auraElement?: string | null;
}) {
  const [face, setFace] = useState<PetFace>('e');
  const facingEast = face === 'e';
  const tiltStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.value * (facingEast ? 32 : -32)}deg` }] }));
  useEffect(() => {
    if (!turn) return;
    const id = setInterval(() => setFace((f) => (f === 'e' ? 'w' : 'e')), 1300);
    return () => clearInterval(id);
  }, [turn]);
  return (
    <>
      <GradeAura grade={grade} size={box} animate={turn} trail={face === 'front' ? null : face} />
      {trail
        ? [0, 1, 2].map((i) => (
            <Bubble key={i} x={face === 'e' ? box * 0.2 : box * 0.75} height={box * 0.6} dur={1400 + i * 300} delay={i * 450} alive={turn} />
          ))
        : null}
      <Animated.View style={tiltStyle}>
        <PetAnimSprite
          pet={pet}
          art={art}
          wear={wear}
          eggColor={eggColor}
          pose={pose.pose}
          face={face}
          startedAt={pose.at}
          loop={pose.loop}
          box={box}
          animate
          recolor={recolor}
          lockColour={shiny}
          auraElement={auraElement}
        />
      </Animated.View>
      {shiny ? <ShinyOverlay size={box} footAt={0.75} animate={turn} /> : null}
    </>
  );
}

/* -------------------------------------------------------------- scene --- */

export function DiveScene({
  pet,
  wear,
  eggColor,
  depth,
  maxDepth,
  bustPct,
  away,
  haul,
  reveal,
  event,
  reduceMotion,
  fxLevel,
  children,
  grade = null,
  shiny = false,
  recolor = null,
  atSurface = false,
  auraElement = null,
}: {
  pet: PetState;
  wear: PetWear;
  eggColor: string;
  /** Deepers survived in the active run (0 when not diving). */
  depth: number;
  /** Deepers this run allows (4, or 5 with Oxygen). */
  maxDepth: number;
  /** The SHOWN bust % of the next Deeper (Safer path), or null. */
  bustPct: number | null;
  away: boolean;
  /** The active run's haul (empty when not diving). */
  haul: readonly string[];
  reveal: DiveReveal;
  /** The last surface / bust, to play it once. */
  event: DiveSceneEvent;
  reduceMotion: boolean;
  fxLevel: DiveFxLevel;
  /** HUD drawn over the scene (top bar). */
  children?: ReactNode;
  /** v23 — the pet's grade glow and shiny / dye colours (looks only). */
  grade?: Grade | null;
  shiny?: boolean;
  recolor?: string | null;
  /** v25 — no run: the pet waits on the rim above the water. */
  atSurface?: boolean;
  auraElement?: string | null;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
  const { width, height } = size;
  const full = fxLevel === 'full' && !reduceMotion;
  const cuts = diveWorldCuts(fxLevel, reduceMotion);
  const band = Math.max(1, height * 0.9);
  // Far water lags, the ruins lag less. Locked together when parallax is off.
  const bgSpeed = cuts.parallax ? 0.42 : 1;
  const midSpeed = cuts.parallax ? 0.72 : 1;

  // -- Camera: one band per Deeper; after a bust it waits for the pet to
  // shoot up, then rises. Reduced motion snaps.
  const cam = useSharedValue(depth);
  const lastEventKey = useRef(event?.key ?? 0);
  useEffect(() => {
    const freshBust = event?.kind === 'bust' && event.key !== lastEventKey.current;
    if (reduceMotion) {
      cam.value = depth;
      return;
    }
    cam.value = freshBust
      ? withDelay(750, withTiming(depth, { duration: 650, easing: Easing.inOut(Easing.cubic) }))
      : withTiming(depth, { duration: 800, easing: Easing.inOut(Easing.cubic) });
  }, [cam, depth, event?.key, event?.kind, reduceMotion]);

  const worldStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -cam.value * band }] }));
  const bgStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -cam.value * band * bgSpeed }] }));
  const wallStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -cam.value * band * midSpeed }] }));

  // -- The pet: swims (walk clip) with a gentle sway; reacts to the shown %.
  const art = usePetArt(pet);
  const box = pet.stage === 'egg' ? 70 : sharpPetBox(PET_WANT_BOX, art.cellPx, PixelRatio.get());
  const petX = width / 2;
  const petY = height * 0.42;
  const edgeX = Math.max(WALL_W + box / 2, width * 0.24);
  const edgeY = height * WATERLINE - box * 0.42;
  const swimPose = petPose(art.kit, 'walk');
  const [pose, setPose] = useState<{ pose: PetPose | null; loop: boolean; at: number }>(() => ({ pose: swimPose, loop: true, at: Date.now() }));
  const [hurtFlash, setHurtFlash] = useState(false);
  const sway = useSharedValue(0);
  const lift = useSharedValue(0);
  const wiggle = useSharedValue(0);
  const shake = useSharedValue(0);
  const mood = diveMood(bustPct);

  // -- v25: the surface. perch 1 = on the rim, 0 = in the water; sky 1 =
  // above the waterline in view. A dive start jumps in with a splash and the
  // camera follows under; the end of a dive climbs back out.
  const perch = useSharedValue(atSurface ? 1 : 0);
  const sky = useSharedValue(atSurface ? 1 : 0);
  const skySplash = useSharedValue(0);
  const lastSurface = useRef(atSurface);
  useEffect(() => {
    if (lastSurface.current === atSurface) return;
    lastSurface.current = atSurface;
    const to = atSurface ? 1 : 0;
    if (reduceMotion) {
      perch.value = to;
      sky.value = to;
      return;
    }
    if (atSurface) {
      // After the surface / bust beat has played in the water.
      sky.value = withDelay(1900, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
      perch.value = withDelay(2100, withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }));
    } else {
      perch.value = withTiming(0, { duration: 750, easing: Easing.inOut(Easing.quad) });
      skySplash.value = 0;
      skySplash.value = withDelay(420, withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }));
      sky.value = withDelay(550, withTiming(0, { duration: 650, easing: Easing.inOut(Easing.cubic) }));
    }
  }, [atSurface, perch, reduceMotion, sky, skySplash]);

  // -- v25: head-down while sinking (a Deeper), a gentle bob while deciding.
  const tilt = useSharedValue(0);
  const bob = useSharedValue(0);
  const lastDepth = useRef(depth);
  useEffect(() => {
    const deeper = depth > lastDepth.current;
    lastDepth.current = depth;
    if (!deeper || !cuts.motion) return;
    tilt.value = withSequence(withTiming(1, { duration: 220 }), withDelay(450, withTiming(0, { duration: 350 })));
  }, [depth, tilt, cuts.motion]);
  useEffect(() => {
    cancelAnimation(bob);
    bob.value = 0;
    if (!cuts.motion || away) return;
    bob.value = withRepeat(
      withSequence(
        withTiming(5, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(-5, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    return () => cancelAnimation(bob);
  }, [bob, cuts.motion, away]);

  useEffect(() => {
    cancelAnimation(sway);
    sway.value = 0;
    if (reduceMotion || away) return;
    sway.value = withRepeat(
      withSequence(
        withTiming(18, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
        withTiming(-18, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    return () => cancelAnimation(sway);
  }, [sway, reduceMotion, away]);

  useEffect(() => {
    cancelAnimation(wiggle);
    wiggle.value = 0;
    if (reduceMotion || away || mood === 'calm') return;
    const half = mood === 'nervous' ? 200 : 60;
    wiggle.value = withRepeat(
      withSequence(withTiming(1, { duration: half }), withTiming(-1, { duration: half * 2 }), withTiming(0, { duration: half })),
      -1,
    );
    return () => cancelAnimation(wiggle);
  }, [wiggle, mood, reduceMotion, away]);

  // -- Bust / surface sequences, once per event.
  const [shown, setShown] = useState<{ finds: number; shells: number } | null>(null);
  const sun = useSharedValue(0);
  const splash = useSharedValue(0);
  const fly = useSharedValue(0);
  useEffect(() => {
    if (!event || event.key === lastEventKey.current) return;
    lastEventKey.current = event.key;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const now = () => Date.now();
    if (event.kind === 'bust') {
      setShown(null);
      const hurt = petPose(art.kit, 'hurt');
      if (hurt) setPose({ pose: hurt, loop: false, at: now() });
      else setHurtFlash(true);
      if (!reduceMotion) {
        shake.value = withSequence(
          ...[8, -8, 6, -6, 4, -4, 0].map((v) => withTiming(v, { duration: 45 })),
        );
        lift.value = withSequence(
          withDelay(500, withTiming(-height * 0.5, { duration: 320, easing: Easing.out(Easing.quad) })),
          withDelay(450, withTiming(0, { duration: 420, easing: Easing.inOut(Easing.quad) })),
        );
      }
      timers.push(
        setTimeout(() => {
          setHurtFlash(false);
          setPose({ pose: petPose(art.kit, 'dash'), loop: true, at: now() });
        }, 500),
      );
      timers.push(setTimeout(() => setPose({ pose: swimPose, loop: true, at: now() }), 1700));
    } else {
      const target = { finds: event.finds, shells: event.shells };
      const victory = petPose(art.kit, 'skill');
      setPose({ pose: victory ?? swimPose, loop: victory == null, at: now() });
      timers.push(setTimeout(() => setPose({ pose: swimPose, loop: true, at: now() }), 1800));
      sun.value = withSequence(withTiming(0.55, { duration: 300 }), withDelay(600, withTiming(0, { duration: 900 })));
      if (reduceMotion) {
        setShown(target);
      } else {
        splash.value = 0;
        splash.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) });
        fly.value = 0;
        fly.value = withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) });
        lift.value = withSequence(withTiming(-14, { duration: 180 }), withTiming(0, { duration: 260, easing: Easing.bounce }));
        const steps = Math.max(target.finds, 1);
        let i = 0;
        setShown({ finds: 0, shells: 0 });
        const id = setInterval(() => {
          i += 1;
          const t = Math.min(1, i / steps);
          setShown({ finds: Math.round(target.finds * t), shells: Math.round(target.shells * t) });
          if (t >= 1) clearInterval(id);
        }, 160);
        timers.push(id as unknown as ReturnType<typeof setTimeout>);
      }
    }
    return () => timers.forEach((t) => clearTimeout(t));
    // swimPose/art are stable per pet; replay keyed on the event only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.key]);

  // A new dive clears the last result.
  useEffect(() => {
    if (haul.length > 0) setShown(null);
  }, [haul.length]);

  const petStyle = useAnimatedStyle(() => {
    const t = wiggle.value;
    const p = perch.value;
    const water = 1 - p;
    // The jump / climb arcs up over the rim between the two spots.
    const arc = p > 0 && p < 1 ? -Math.sin(Math.PI * p) * 70 : 0;
    return {
      transform: [
        { translateX: (sway.value + (mood === 'shake' ? t * 2.5 : 0)) * water + (edgeX - petX) * p },
        { translateY: lift.value + bob.value * water + (edgeY - petY) * p + arc },
        { rotate: mood === 'nervous' ? `${t * 6}deg` : '0deg' },
      ],
    };
  });
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const sunStyle = useAnimatedStyle(() => ({ opacity: sun.value }));
  const splashStyle = useAnimatedStyle(() => ({ opacity: splash.value > 0 && splash.value < 1 ? 1 - splash.value : 0 }));
  const flyStyle = useAnimatedStyle(() => ({
    opacity: fly.value > 0 && fly.value < 1 ? 1 : 0,
    transform: [{ translateX: fly.value * (width / 2 - 40) }, { translateY: -fly.value * (petY - 30) }],
  }));

  // -- Find reveal: rise from the pet, glow, (rare: flash + hold), fly to the
  // haul row. The slot shows the find once the reveal lands.
  const rv = useSharedValue(0);
  const flash = useSharedValue(0);
  const [landedKey, setLandedKey] = useState(reveal?.key ?? 0);
  const rowY = height - ROW_PAD - ICON;
  const slotX = (slot: number) => ROW_PAD + slot * SLOT;
  useEffect(() => {
    if (!reveal) return;
    if (reduceMotion) {
      setLandedKey(reveal.key);
      return;
    }
    const rare = isRareOrBetter(reveal.glow);
    rv.value = 0;
    rv.value = withSequence(
      withTiming(1, { duration: REVEAL_RISE_MS, easing: Easing.out(Easing.quad) }),
      withDelay(rare ? REVEAL_HOLD_RARE_MS : 0, withTiming(2, { duration: REVEAL_FLY_MS, easing: Easing.in(Easing.quad) })),
    );
    if (rare && fxLevel === 'full') {
      flash.value = withSequence(withTiming(0.4, { duration: REVEAL_FLASH_MS / 2 }), withTiming(0, { duration: REVEAL_FLASH_MS / 2 }));
    }
    const id = setTimeout(() => setLandedKey(reveal.key), revealMs(reveal.glow));
    return () => clearTimeout(id);
  }, [reveal, reduceMotion, rv, flash, fxLevel]);
  const revealTo = reveal ? slotX(reveal.slot) : 0;
  // v25: the find bursts out of a crate / chest on the right-hand ledge.
  const boxX = width - WALL_W - FIND_BOX - 8;
  const boxY = petY + 24;
  const revealStyle = useAnimatedStyle(() => {
    const v = rv.value;
    const startX = boxX + (FIND_BOX - ICON) / 2;
    const startY = boxY;
    const riseY = startY - 64;
    // Hidden while the box shakes; rises out once it bursts.
    const r = v <= BOX_OPEN ? 0 : Math.min(1, (v - BOX_OPEN) / (1 - BOX_OPEN));
    const x = v <= 1 ? startX : startX + (revealTo - startX) * (v - 1);
    const y = v <= 1 ? startY + (riseY - startY) * r : riseY + (rowY - riseY) * (v - 1);
    return {
      opacity: v > BOX_OPEN && v < 2 ? 1 : 0,
      transform: [{ translateX: x }, { translateY: y }, { scale: v <= 1 ? 0.6 + r * 0.6 : 1.2 - (v - 1) * 0.2 }],
    };
  });
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  // -- Tension: edges close in with the shown %, a heartbeat over 40%.
  const vig = vignetteFor(bustPct);
  const beat = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(beat);
    beat.value = 1;
    if (!vig.pulse || !full) return;
    beat.value = withRepeat(
      withSequence(
        withTiming(0.72, { duration: 120 }),
        withTiming(1, { duration: 140 }),
        withTiming(0.82, { duration: 110 }),
        withTiming(1, { duration: 480 }),
      ),
      -1,
    );
    return () => cancelAnimation(beat);
  }, [beat, vig.pulse, full]);
  const vigStyle = useAnimatedStyle(() => ({ opacity: beat.value }));

  // -- What the haul row shows.
  const revealing = reveal != null && reveal.key !== landedKey;
  const rowItems: { id: string; hidden: boolean }[] =
    haul.length > 0
      ? haul.map((id, i) => ({ id, hidden: revealing && reveal?.slot === i }))
      : event?.kind === 'surface' && shown
        ? event.ids.map((id) => ({ id, hidden: false }))
        : event?.kind === 'bust'
          ? event.saved.map((id) => ({ id, hidden: false }))
          : [];
  const sinking = haul.length === 0 && event?.kind === 'bust' ? event.lost : [];

  const caption = away
    ? 'Your pet is away on an expedition — diving solo.'
    : haul.length > 0
      ? revealing
        ? null
        : `Found ${findName(haul[haul.length - 1])}`
      : event?.kind === 'bust'
        ? event.saved.length > 0
          ? `Bust — the haul sank. Your pet saved ${event.saved.length === 1 ? 'your best find' : `${event.saved.length} finds`}.`
          : 'Bust — the haul sank. Your pet is fine.'
        : event?.kind === 'surface' && shown && event.finds === 0 && event.ids.length > 0
          ? `Back up! ${event.ids.length} ${event.ids.length === 1 ? 'sighting' : 'sightings'} for the Logbook${shown.shells > 0 ? ` · +${shown.shells} shells` : ''}`
        : event?.kind === 'surface' && shown
          ? `Back up! ${shown.finds} ${shown.finds === 1 ? 'find' : 'finds'}${shown.shells > 0 ? ` · +${shown.shells} shells` : ''}`
          : null;
  const lastId = haul.length > 0 ? haul[haul.length - 1] : null;
  const rareFind =
    lastId && caption?.startsWith('Found ') && isRareOrBetter(findGlow(lastId)) ? findName(lastId) : null;

  const worldH = band * (DIVE_MAX_DEPTH + 1) + height;
  const bubbleCount = reduceMotion ? 0 : full ? 8 : 4;
  const fishCount = full ? Math.min(5, 3 + Math.floor(Math.min(depth, 4) / 2)) : 0;

  return (
    <Animated.View style={[styles.scene, shakeStyle]} onLayout={onLayout} accessibilityLabel={`${diveZone(depth)}, depth ${depth} of ${maxDepth}`}>
      {width > 0 ? (
        <>
          {/* Far water. Lags behind the camera when parallax is on. */}
          <Animated.View
            pointerEvents="none"
            style={[styles.abs, { left: 0, top: 0, width, height: band * (DIVE_MAX_DEPTH + 1) * bgSpeed + height }, bgStyle]}>
            <DiveWater width={width} band={band} speed={bgSpeed} />
            {fxLevel === 'full' ? <Caustics width={width} band={band} speed={bgSpeed} alive={full} /> : null}
          </Animated.View>

          {/* Mid ruins: lattice, arch, statue. A little faster than the water. */}
          <Animated.View
            pointerEvents="none"
            style={[styles.abs, { left: 0, top: 0, width, height: band * (DIVE_MAX_DEPTH + 1) * midSpeed + height }, wallStyle]}>
            <ShaftWalls width={width} band={band} depth={depth} speed={midSpeed} alive={full} />
          </Animated.View>

          {/* Near seabed, coral and the abyss statue. Locked to the camera. */}
          <Animated.View pointerEvents="none" style={[styles.abs, { left: 0, top: 0, width, height: worldH }, worldStyle]}>
            {cuts.dragon ? <AbyssDragon width={width} band={band} /> : null}
            {cuts.props ? <ZoneProps width={width} band={band} depth={depth} alive={full} /> : null}
          </Animated.View>

          {/* Pack fish, in the Reef and the Trench. Cut with the shark slot. */}
          {fxLevel === 'full' && depth <= RAYS_UNTIL_DEPTH ? <LightRays width={width} alive={full} /> : null}

          {cuts.shark && !atSurface && SHARK_DEPTHS.includes(depth) ? (
            <SharkGlide key={depth} width={width} height={height} rightward={depth % 2 === 1} />
          ) : null}

          {Array.from({ length: fishCount }, (_, i) => (
            <Fish
              key={i}
              y={height * (0.18 + ((i * 0.17) % 0.55))}
              width={width}
              size={10 + (i % 3) * 4}
              dur={9000 + i * 2300}
              delay={i * 1700}
              rightward={i % 2 === 0}
            />
          ))}
          {Array.from({ length: bubbleCount }, (_, i) => (
            <Bubble key={i} x={((i * 29 + 7) % 90) * (width / 100) + 8} height={height} dur={4200 + (i % 4) * 900} delay={i * 600} alive={full} />
          ))}

          {/* v25: the surface — sky, sun, the rim and the waterline. */}
          <SurfaceSky width={width} height={height} sky={sky} splash={skySplash} edgeX={edgeX} />

          {/* The pet (not while it's away on an expedition). */}
          {!away ? (
            <Animated.View pointerEvents="none" style={[styles.abs, { left: petX - box / 2, top: petY - box / 2, width: box, height: box }, petStyle]}>
              <SwimmingPet
                pet={pet}
                art={art}
                wear={wear}
                eggColor={eggColor}
                pose={pose}
                box={box}
                turn={!reduceMotion}
                trail={cuts.trail && pet.stage !== 'egg'}
                tilt={tilt}
                grade={grade}
                shiny={shiny}
                recolor={recolor}
                auraElement={auraElement}
              />
              {hurtFlash ? <View style={[StyleSheet.absoluteFill, styles.hurt]} /> : null}
            </Animated.View>
          ) : null}

          {/* Sunlight + splash on a surface. */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sunStyle]}>
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#FFF6C8" stopOpacity={1} />
                  <Stop offset="0.6" stopColor="#FFF6C8" stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={width} height={height} fill="url(#sun)" />
            </Svg>
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.abs, { left: 0, top: 0, width, height: 90 }, splashStyle]}>
            <Svg width={width} height={90}>
              {[-3, -2, -1, 1, 2, 3].map((k) => (
                <Ellipse key={k} cx={width / 2 + k * 22} cy={60 - Math.abs(k) * 6} rx={4} ry={7} fill="#FFFFFF" fillOpacity={0.8} />
              ))}
              <Ellipse cx={width / 2} cy={70} rx={60} ry={8} fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={2} />
            </Svg>
          </Animated.View>

          {/* Tension: edges close in with the shown %. */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, vigStyle]}>
            <Svg width={width} height={height}>
              <Defs>
                <RadialGradient id="vig" cx={width / 2} cy={height / 2} rx={width * 0.85} ry={height * 0.75} gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor="#000000" stopOpacity={0} />
                  <Stop offset={String(vig.clear)} stopColor="#000000" stopOpacity={0} />
                  <Stop offset="1" stopColor="#000000" stopOpacity={vig.edge} />
                </RadialGradient>
              </Defs>
              <Rect x={0} y={0} width={width} height={height} fill="url(#vig)" />
            </Svg>
          </Animated.View>

          {/* A rare find's flash. */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />

          {/* The find on its way to the haul row, out of its crate / chest. */}
          {reveal && revealing ? (
            <FindBox art={findBoxArt(depth)} x={boxX} y={boxY} glow={GLOW_COLOR[reveal.glow]} rv={rv} />
          ) : null}
          {reveal && revealing ? (
            <Animated.View pointerEvents="none" style={[styles.abs, { left: 0, top: 0 }, revealStyle]}>
              <View style={[styles.revealGlow, { backgroundColor: GLOW_COLOR[reveal.glow] }]} />
              <FindIcon id={reveal.id} size={ICON} />
            </Animated.View>
          ) : null}

          {/* Shells flying to the counter on a surface. */}
          {event?.kind === 'surface' && event.shells > 0 && !reduceMotion ? (
            <Animated.View pointerEvents="none" style={[styles.abs, { left: width / 2 - 14, top: petY }, flyStyle]}>
              <PixelBody color={PIXEL.amber}>{`+${event.shells}`}</PixelBody>
            </Animated.View>
          ) : null}

          {/* The haul row, along the bottom. */}
          <View pointerEvents="none" style={[styles.row, { top: rowY }]}>
            {rowItems.map((item, i) => (
              <View
                key={`${item.id}-${i}`}
                style={[styles.slot, item.hidden && styles.hidden]}
                accessible
                accessibilityLabel={findName(item.id)}>
                <FindIcon id={item.id} size={ICON} />
              </View>
            ))}
          </View>
          {sinking.map((id, i) => (
            <Sinking key={`${id}-${i}-${event?.key}`} id={id} left={slotX(event?.saved.length ?? 0) + i * SLOT} top={rowY} drop={height * 0.4} reduceMotion={reduceMotion} />
          ))}
          {caption ? (
            <View pointerEvents="none" style={[styles.caption, { bottom: ROW_PAD + ICON + 8 }]}>
              {rareFind ? (
                <PixelFrame fill={PIXEL.ink} border={PIXEL.amber}>
                  <PixelLabel color={PIXEL.amber}>Rare find</PixelLabel>
                  <PixelBody>{rareFind}</PixelBody>
                </PixelFrame>
              ) : (
                <PixelFrame>
                  <PixelBody style={styles.captionText}>{caption}</PixelBody>
                </PixelFrame>
              )}
            </View>
          ) : null}
        </>
      ) : null}
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1, overflow: 'hidden', backgroundColor: DIVE_DEPTH_INK[0] },
  abs: { position: 'absolute' },
  hurt: { backgroundColor: '#FF3B5C', opacity: 0.35, borderRadius: 999 },
  flash: { backgroundColor: '#FFFFFF' },
  revealGlow: {
    position: 'absolute',
    left: -8,
    top: -8,
    width: ICON + 16,
    height: ICON + 16,
    borderRadius: (ICON + 16) / 2,
    opacity: 0.35,
  },
  row: { position: 'absolute', left: ROW_PAD, right: ROW_PAD, flexDirection: 'row' },
  slot: { width: SLOT },
  hidden: { opacity: 0 },
  caption: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  captionText: { textAlign: 'center' },
});
