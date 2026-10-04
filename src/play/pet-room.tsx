/**
 * Pet room (overhaul, 2026-09-29) — the pet lives in a room scene, never a
 * still picture (Tamagotchi / Pou / Talking Tom). The room is pixel art from
 * the room atlas: plank walls, brick floor, a window whose sky follows the
 * phone's clock, and props the pet walks to. Ambient loops (lamp, clouds,
 * plant, motes) freeze when Reduce Motion is on or effects are low.
 *
 * The pet wanders, turns, idles, sits, sometimes shows off (its attack/skill
 * clip), sleeps at night — all decided by `planPetStep` (pet-actor.ts) from
 * its mood and form. Tapping it: a hop, a heart, it faces you, it talks.
 * Above its head a status bubble (emoji + word) follows it; the corner shows
 * both meters in hearts; a coach strip says what it needs, with a button.
 *
 * Reduced motion: it idles in place (no walking, hops or drift), bubbles
 * appear and fade without typing — status and talking still work.
 */
import { useEffect, useRef, useState } from 'react';
import { PixelRatio, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import type { PetCoachTip } from '@/play/coach';
import { quietFoilOpacity } from '@/play/auras';
import { FinishPlate, cardFoilOpacity, useFinishLease, windowFoilOpacity } from '@/play/finish-foil';
import { FxLayer, FX_ULTIMATE_LIFE_MS, type FxEvent } from '@/play/fx-layer';
import { useFxQuality } from '@/play/fx-quality';
import { ELEMENT_COLOR, type Element } from '@/play/kits';
import { NEON } from '@/play/neon-viper';
import { PET_BRANCH_TINT, PET_METER_MAX, PET_STAGE_LABEL, type PetState } from '@/play/pet';
import {
  PET_BED_X,
  PET_ROOM_BOX,
  petMoodKind,
  petPose,
  planPetStep,
  sharpPetBox,
  type PetPose,
  type PetStep,
} from '@/play/pet-actor';
import { PetAnimSprite, usePetArt, type PetFace } from '@/play/pet-anim-sprite';
import {
  EGG_COLOR,
  EGG_LABEL,
  EGG_TYPES,
  GRADE_COLOR,
  GRADE_LABEL,
  GRADE_STARS,
  WARMTH_MAX,
  nameplateText,
  type EggType,
} from '@/play/pet-eggs';
import { EggShape } from '@/play/pet-figure';
import { GlimmerGlow, GradeAura, ShinyOverlay } from '@/play/pet-looks';
import { wornLook, type PetWear } from '@/play/pet-cosmetics';
import { PET_STATUS_WORD, isEvolvingSoon, petStatusLabel, type PetStatus } from '@/play/pet-status';
import { Drift, Rise, SpriteSwap, Sway } from '@/play/pixel-ambient';
import { AtlasFill, AtlasSprite, ROOM_FRAMES, type RoomFrame } from '@/play/pixel-atlas';
import { ART_PT, PIXEL, snapArt } from '@/play/pixel-theme';
import {
  PixelBody,
  PixelButton,
  PixelFrame,
  PixelHearts,
  PixelLabel,
  PixelNameplate,
  usePixelFonts,
} from '@/play/pixel-ui';
import { PET_TALK_HOLD_MS, PET_TALK_TYPE_MS } from '@/play/pet-talk';
import { roleFootAt } from '@/play/skin';

/** Feet line, as a share of the room height. */
const FLOOR_AT = 0.8;
// The nameplate hangs BELOW the feet line. The floor ring runs from feet-8 to
// feet+6, so +8 clears it and the sprite for every stage (it used to sit at -4
// and covered the pet's feet — Crimson Oni, Child).
const PLATE_BELOW_FEET = 8;
/** v26 nameplate text size — Tiny5 at 3.5pt per font pixel (cap stays over 16pt). */
export const NAMEPLATE_FONT = 28;

function plateStatus(status: PetStatus, stage: PetState['stage'], stageLeftMs: number | null): string {
  if (status === 'egg' && stage === 'egg' && isEvolvingSoon('egg', stageLeftMs)) return 'Hatching soon';
  return PET_STATUS_WORD[status];
}

/** A 5×5 art-pixel star. Tiny5 has no star glyph. */
function PixelStar({ color }: { color: string }) {
  const p = ART_PT;
  const rows = [
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0],
  ];
  return (
    <View style={{ width: 5 * p, height: 5 * p }}>
      {rows.map((row, y) =>
        row.map((on, x) =>
          on ? (
            <View key={`${x}-${y}`} style={{ position: 'absolute', left: x * p, top: y * p, width: p, height: p, backgroundColor: color }} />
          ) : null,
        ),
      )}
    </View>
  );
}


/** v26 "Maxed aura": Pumped can't add more pounce, so the pet glows gold. */
function MaxedAura({ size, animate }: { size: number; animate: boolean }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(pulse);
    pulse.value = 0;
    if (!animate) return;
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1);
    return () => cancelAnimation(pulse);
  }, [animate, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: 0.22 + pulse.value * 0.18 }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: -size * 0.1,
          top: -size * 0.1,
          width: size * 1.2,
          height: size * 1.2,
          borderRadius: size,
          backgroundColor: '#FFD700',
          shadowColor: '#FFD700',
          shadowOpacity: 0.9,
          shadowRadius: 16,
        },
        style,
      ]}
    />
  );
}
const HORIZON_AT = 0.6;
const TAP_FACE_MS = 1400;
const AURA_EVERY_MS = 1400;

export type RoomSpeech = { text: string; key: number } | null;

/* ------------------------------------------------------------ backdrop --- */

function propBox(frame: RoomFrame): { w: number; h: number } {
  const rect = ROOM_FRAMES[frame];
  return { w: rect.w * ART_PT, h: rect.h * ART_PT };
}

function sit(w: number, h: number, cx: number, bottom: number): { left: number; top: number } {
  return { left: snapArt(cx - w / 2), top: snapArt(bottom - h) };
}

function RoomBackdrop({
  width,
  height,
  night,
  pantry,
  alive,
}: {
  width: number;
  height: number;
  night: boolean;
  pantry: number;
  alive: boolean;
}) {
  const horizon = snapArt(height * HORIZON_AT);
  const floorY = snapArt(height * FLOOR_AT);
  const wallH = Math.max(ART_PT, horizon);
  const floorH = Math.max(ART_PT, height - horizon);
  const win = propBox('window-night');
  const lamp = propBox('lamp');
  const bed = propBox('bed');
  const bowl = propBox('bowl');
  const bush = propBox('bush');
  const rug = propBox('rug');
  const plant = propBox('plant');
  const shelf = propBox('shelf');
  const picture = propBox('picture');
  const pool = propBox('pool');
  const treat = propBox('treat');
  const baseH = propBox('base').h;
  const winX = snapArt(Math.max(ART_PT * 2, width * 0.06));
  const winY = snapArt(Math.min(Math.max(72, height * 0.08), Math.max(ART_PT, horizon - win.h - ART_PT * 2)));
  const bedCx = width * PET_BED_X;
  const lampLeft = snapArt(Math.min(width - lamp.w - ART_PT * 2, bedCx + bed.w / 2 + ART_PT * 4));
  const lampCx = lampLeft + lamp.w / 2;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', left: 0, top: 0, width, height: wallH, backgroundColor: '#3e3546', overflow: 'hidden' }}>
        <AtlasFill atlas="room" frame="wall" width={width} height={wallH} />
      </View>
      <View style={{ position: 'absolute', left: 0, top: horizon, width, height: floorH, backgroundColor: '#4c3e24', overflow: 'hidden' }}>
        <AtlasFill atlas="room" frame="floor" width={width} height={floorH} />
      </View>
      <View style={{ position: 'absolute', left: 0, top: horizon - baseH / 2, width, height: baseH, overflow: 'hidden' }}>
        <AtlasFill atlas="room" frame="base" width={width} height={baseH} />
      </View>
      <View style={{ position: 'absolute', left: winX, top: winY, width: win.w, height: win.h }}>
        <AtlasSprite atlas="room" frame={night ? 'window-night' : 'window-day'} />
        <View style={{ position: 'absolute', left: 12, top: 10, right: 12, bottom: 22, overflow: 'hidden' }}>
          <Drift alive={alive} dx={16} dy={3} ms={5200}>
            <AtlasSprite atlas="room" frame="cloud" />
          </Drift>
        </View>
        <View style={{ position: 'absolute', left: (win.w - plant.w) / 2, top: win.h - plant.h - 4 }}>
          <Sway alive={alive} deg={2} ms={1800}>
            <AtlasSprite atlas="room" frame="plant" />
          </Sway>
        </View>
      </View>
      <View style={{ position: 'absolute', ...sit(picture.w, picture.h, width * 0.62, horizon - 28) }}>
        <AtlasSprite atlas="room" frame="picture" />
      </View>
      <View style={{ position: 'absolute', ...sit(shelf.w, shelf.h, width * 0.46, horizon - 4) }}>
        <AtlasSprite atlas="room" frame="shelf" />
      </View>
      <View style={{ position: 'absolute', left: lampLeft, top: snapArt(floorY - lamp.h) }}>
        <SpriteSwap atlas="room" frames={['lamp', 'lamp-hot']} alive={alive} ms={160} />
      </View>
      <View style={{ position: 'absolute', ...sit(pool.w, pool.h, lampCx, floorY) }}>
        <AtlasSprite atlas="room" frame="pool" />
      </View>
      <View style={{ position: 'absolute', ...sit(rug.w, rug.h, width * 0.5, floorY) }}>
        <AtlasSprite atlas="room" frame="rug" />
      </View>
      <View style={{ position: 'absolute', ...sit(bed.w, bed.h, bedCx, floorY) }}>
        <AtlasSprite atlas="room" frame="bed" />
      </View>
      <View style={{ position: 'absolute', ...sit(bush.w, bush.h, width * 0.06, floorY) }}>
        <Sway alive={alive} deg={2.2} ms={2000}>
          <AtlasSprite atlas="room" frame="bush" />
        </Sway>
      </View>
      <View style={{ position: 'absolute', ...sit(bowl.w, bowl.h, width * 0.16, floorY) }}>
        <AtlasSprite atlas="room" frame="bowl" />
        {pantry > 0 ? (
          <View style={{ position: 'absolute', left: (bowl.w - treat.w) / 2, top: -treat.h + 4 }}>
            <AtlasSprite atlas="room" frame="treat" />
          </View>
        ) : null}
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, top: horizon, bottom: 0 }}>
        {[0.22, 0.4, 0.58, 0.74].map((x, i) => (
          <Rise key={i} alive={alive} x={width * x} distance={Math.max(48, wallH * 0.35)} ms={4600 + i * 700} delay={i * 600}>
            <AtlasSprite atlas="room" frame="mote" />
          </Rise>
        ))}
      </View>
    </View>
  );
}

/** God aura: a soft glow, plus a slow pulse from the effects layer (skipped
 * when Effects Quality is Off or motion is reduced). Moved from the old card. */
function GodAura({ element, size, reduceMotion }: { element: Element; size: number; reduceMotion: boolean }) {
  const quality = useFxQuality();
  const color = ELEMENT_COLOR[element];
  const animate = quality !== 'off' && !reduceMotion;
  const [now, setNow] = useState(() => Date.now());
  const eventsRef = useRef<FxEvent[]>([]);
  const seqRef = useRef(0);
  useEffect(() => {
    if (!animate) return;
    let last = 0;
    const id = setInterval(() => {
      const t = Date.now();
      if (t - last >= AURA_EVERY_MS) {
        last = t;
        eventsRef.current = [
          ...eventsRef.current.filter((fx) => t - fx.bornAt < fx.lifeMs),
          {
            id: ++seqRef.current,
            bornAt: t,
            lifeMs: FX_ULTIMATE_LIFE_MS * 2,
            behavior: 'slow',
            element,
            secondary: null,
            ultimate: true,
            from: { x: 50, y: 50 },
            points: [{ x: 50, y: 50 }],
            arc: null,
            radius: 44,
            center: { x: 50, y: 50 },
            centredOnSource: true,
          },
        ];
      }
      setNow(t);
    }, 60);
    return () => clearInterval(id);
  }, [animate, element]);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ position: 'absolute', left: -size * 0.2, top: -size * 0.2 }}
      pointerEvents="none">
      <Circle cx="50" cy="50" r="46" fill={color} fillOpacity={0.06} />
      <Circle cx="50" cy="50" r="38" fill={color} fillOpacity={0.08} />
      {animate ? <FxLayer events={eventsRef.current} now={now} quality={quality} /> : null}
    </Svg>
  );
}

/* ------------------------------------------------------------- bubbles --- */

/** A speech bubble that types out, holds, then fades. */
function SpeechBubble({
  speech,
  reduceMotion,
  speaker = null,
}: {
  speech: RoomSpeech;
  reduceMotion: boolean;
  speaker?: string | null;
}) {
  const [shown, setShown] = useState('');
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (!speech) {
      opacity.value = 0;
      return;
    }
    const full = speech.text;
    let typer: ReturnType<typeof setInterval> | null = null;
    if (reduceMotion) {
      setShown(full);
      opacity.value = 1;
    } else {
      opacity.value = withTiming(1, { duration: 150 });
      let i = 0;
      setShown('');
      typer = setInterval(() => {
        i += 1;
        setShown(full.slice(0, i));
        if (i >= full.length && typer) clearInterval(typer);
      }, PET_TALK_TYPE_MS);
    }
    const typeMs = reduceMotion ? 0 : full.length * PET_TALK_TYPE_MS;
    const fade = setTimeout(() => {
      opacity.value = reduceMotion ? 0 : withTiming(0, { duration: 400 });
    }, typeMs + PET_TALK_HOLD_MS);
    return () => {
      if (typer) clearInterval(typer);
      clearTimeout(fade);
    };
  }, [speech, opacity, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!speech) return null;
  return (
    <Animated.View
      style={style}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityLabel={speaker ? `${speaker} says ${shown}` : shown}>
      <PixelFrame align="stretch">
        <PixelBody style={styles.speechText}>{shown || ' '}</PixelBody>
      </PixelFrame>
    </Animated.View>
  );
}

/* ---------------------------------------------------------------- room --- */

export function PetRoom({
  pet,
  wear,
  aura,
  eggColor,
  status,
  coach,
  night,
  pantry,
  stageLeftMs,
  speech,
  tapKey,
  reduceMotion,
  onTapPet,
  onCoach,
  recolor = null,
  onBadge,
  onPickEgg,
  tide = false,
  name = null,
  buffs = [],
  maxedAura = false,
  auraElement = null,
}: {
  pet: PetState;
  wear: PetWear;
  /** God aura element (null below God). */
  aura: Element | null;
  eggColor: string;
  status: PetStatus;
  coach: PetCoachTip;
  night: boolean;
  pantry: number;
  /** Time left in the stage (the egg's "Hatching soon" label). */
  stageLeftMs: number | null;
  speech: RoomSpeech;
  /** Bumped by the screen on each tap, to replay the hop + heart. */
  tapKey: number;
  reduceMotion: boolean;
  onTapPet: () => void;
  onCoach: () => void;
  /** v23 — shiny / 3★ dye recolour of the sprite. */
  recolor?: string | null;
  /** v23 — tap the star badge: open the pet's card. */
  onBadge?: () => void;
  /** v23 — the egg picker: tap one of the three eggs. */
  onPickEgg?: (egg: EggType) => void;
  /** v28 — Tide Pass is on: a looks-only pill by the nameplate. */
  tide?: boolean;
  /** v24 — the name it goes by (status and speech bubbles). */
  name?: string | null;
  /** v26 — active medal buffs for the corner (icon + uses / "Maxed aura"). */
  buffs?: readonly { key: string; text: string; a11y: string }[];
  /** v26 — Pumped is a "Maxed aura": a gold glow behind the pet. */
  maxedAura?: boolean;
  /** Equipped sword element. The pet aura colour follows it. */
  auraElement?: string | null;
}) {
  // Tiny5 / Inter. Hold the room until they are in, so labels never paint in a fallback face.
  const fontsReady = usePixelFonts();
  // Effects Low (Settings): auras and sparkles hold still.
  const fxFull = useFxQuality() === 'full';
  const fxAnimate = !reduceMotion && fxFull;
  useFinishLease((pet.finish_kind === 'holo' || pet.finish_kind === 'reverse') && pet.finish_color != null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
  const { width, height } = size;

  const art = usePetArt(pet);
  const away = status === 'away';
  const egg = pet.stage === 'egg';
  const box = egg ? PET_ROOM_BOX.egg : sharpPetBox(PET_ROOM_BOX[pet.stage], art.cellPx, PixelRatio.get());
  const footAt = egg ? 1 : roleFootAt(art.role);
  const floorY = height * FLOOR_AT;
  const top = floorY - footAt * box;
  const mood = petMoodKind(pet.hunger, pet.mood, night);
  const asleep = mood === 'asleep' && !egg;
  const picking = egg && pet.egg == null;
  const revealed = pet.hero != null && !egg && pet.stage !== 'baby';
  const grade = revealed ? pet.grade : null;

  // What it is doing (React: which clip) and where (Reanimated: position).
  const [act, setAct] = useState<{ pose: PetPose | null; loop: boolean; startedAt: number; face: PetFace; squash: boolean }>(
    () => ({ pose: petPose(art.kit, 'idle'), loop: true, startedAt: Date.now(), face: 'e', squash: false }),
  );
  const x = useSharedValue(0.5);
  const hop = useSharedValue(0);
  const drift = useSharedValue(0);
  const squash = useSharedValue(1);
  const heart = useSharedValue(0);
  const xRef = useRef(0.5);
  const faceRef = useRef<PetFace>('e');
  const tapUntilRef = useRef(0);

  // The behaviour loop: plan a step, play it, plan the next.
  useEffect(() => {
    if (width <= 0 || away || egg) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;
    const run = () => {
      if (!alive) return;
      const now = Date.now();
      if (now < tapUntilRef.current) {
        timer = setTimeout(run, tapUntilRef.current - now);
        return;
      }
      let step: PetStep = planPetStep({ kit: art.kit, mood, branch: pet.branch, stage: pet.stage, x: xRef.current, rng: Math.random });
      if (reduceMotion) step = { ...step, act: step.act === 'sleep' ? 'sleep' : 'idle', pose: petPose(art.kit, 'idle'), toX: xRef.current, bounce: 0, drift: false, loop: true, ms: 4000 };
      if (step.act === 'sleep' && Math.abs(xRef.current - PET_BED_X) > 0.02 && !reduceMotion) {
        step = { ...step, act: 'wander', pose: petPose(art.kit, 'walk'), toX: PET_BED_X, ms: 2600, squash: false };
      }
      let face = faceRef.current;
      if (step.toX > xRef.current + 0.01) face = 'e';
      else if (step.toX < xRef.current - 0.01) face = 'w';
      else if (step.act === 'idle' && Math.random() < 0.3) face = face === 'e' ? 'w' : 'e'; // look around
      faceRef.current = face;
      setAct({ pose: step.pose, loop: step.loop, startedAt: Date.now(), face, squash: step.squash });
      squash.value = withTiming(step.squash ? 0.92 : 1, { duration: 300 });
      if (step.toX !== xRef.current) {
        x.value = withTiming(step.toX, { duration: step.ms, easing: Easing.linear });
        xRef.current = step.toX;
      }
      cancelAnimation(hop);
      if (step.bounce > 0) {
        const hops = Math.max(1, Math.round(step.ms / 360));
        hop.value = withRepeat(
          withSequence(
            withTiming(-step.bounce, { duration: 180, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }),
          ),
          hops,
        );
      } else if (step.act === 'hop') {
        hop.value = withSequence(withTiming(-14, { duration: 200 }), withTiming(0, { duration: 260, easing: Easing.bounce }));
      } else {
        hop.value = withTiming(0, { duration: 150 });
      }
      timer = setTimeout(run, step.ms);
    };
    run();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [width, away, egg, art.kit, mood, pet.branch, pet.stage, reduceMotion, x, hop, squash]);

  // Deep drifts: a slow float.
  useEffect(() => {
    cancelAnimation(drift);
    drift.value = 0;
    if (reduceMotion || away) return;
    if (pet.branch === 'deep' && !egg && !asleep) {
      drift.value = withRepeat(
        withSequence(
          withTiming(-6, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
    }
  }, [pet.branch, egg, asleep, reduceMotion, away, drift]);

  // Tap: hop, a heart, face you.
  useEffect(() => {
    if (tapKey === 0) return;
    tapUntilRef.current = Date.now() + TAP_FACE_MS;
    // Stop mid-walk so it faces you where it stands.
    cancelAnimation(x);
    xRef.current = x.value;
    if (!egg && !asleep) {
      setAct((prev) => ({ ...prev, pose: petPose(art.kit, 'idle'), loop: true, face: 'front', startedAt: Date.now() }));
    }
    const back = setTimeout(() => setAct((prev) => ({ ...prev, face: faceRef.current })), TAP_FACE_MS);
    heart.value = 0;
    heart.value = withTiming(1, { duration: reduceMotion ? 600 : 900 });
    if (!reduceMotion) {
      cancelAnimation(hop);
      hop.value = withSequence(
        withTiming(-18, { duration: 170, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 280, easing: Easing.bounce }),
      );
    }
    return () => clearTimeout(back);
  }, [tapKey, egg, asleep, art.kit, heart, hop, reduceMotion, x]);

  const petStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value * width - box / 2 },
      { translateY: hop.value + drift.value },
    ],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - squash.value) * box * 0.5 }, { scaleY: squash.value }],
  }));
  const heartStyle = useAnimatedStyle(() => ({
    opacity: heart.value > 0 && heart.value < 1 ? 1 - heart.value : 0,
    transform: [{ translateY: -heart.value * 36 }, { scale: 0.8 + heart.value * 0.5 }],
  }));

  const look = wornLook(wear);
  const ringColor = PET_BRANCH_TINT[pet.branch] ?? NEON.cyanBorder;
  const label = petStatusLabel(status, pet.stage, stageLeftMs);
  // Speech bubble: 240pt wide, grows upward, kept inside the room — it
  // leans right of the pet near the left wall and left near the right wall.
  const speechW = Math.min(240, Math.max(120, width - 20));
  // Follows the pet's LIVE position (not the walk's destination) on the UI
  // thread, clamped so the bubble never leaves the room.
  const speechStyle = useAnimatedStyle(() => {
    const center = x.value * width;
    const want = Math.min(Math.max(10, center - speechW / 2), Math.max(10, width - 10 - speechW));
    return { transform: [{ translateX: want - (center - box / 2) }] };
  });

  // v26 nameplate: on the ring at the pet's feet, walking with it; wider than
  // a small pet so "★★★★ Legendary" always fits, and kept inside the room.
  const plateW = Math.min(Math.max(120, box), Math.max(120, width - 16));
  const plateStyle = useAnimatedStyle(() => {
    const center = x.value * width;
    const want = Math.min(Math.max(8, center - plateW / 2), Math.max(8, width - 8 - plateW));
    return { transform: [{ translateX: want - (center - box / 2) }] };
  });

  if (!fontsReady) return <View style={styles.room} onLayout={onLayout} />;

  return (
    <View style={styles.room} onLayout={onLayout}>
      {width > 0 ? <RoomBackdrop width={width} height={height} night={night} pantry={pantry} alive={fxAnimate} /> : null}

      {/* Corner: both meters, always — and the active medal buffs (v26). */}
      <View style={styles.corner} pointerEvents="box-none">
      <PixelFrame align="stretch" enter style={styles.meters}>
        <View style={styles.meterHead}>
        <View style={styles.meterMain} accessible accessibilityLabel={`Hunger ${pet.hunger} of ${PET_METER_MAX}, mood ${pet.mood} of ${PET_METER_MAX}`}>
        {picking ? (
          <PixelLabel>Pick an egg</PixelLabel>
        ) : egg ? (
          <View style={styles.meterRow} accessibilityLabel={`Warmth ${pet.warmth} of ${WARMTH_MAX}`}>
            <PixelLabel>Warmth</PixelLabel>
            <PixelHearts value={pet.warmth} max={WARMTH_MAX} color={PIXEL.amber} />
          </View>
        ) : (
          <View style={styles.meterBlock}>
            <View style={styles.meterRow}>
              <PixelLabel>Hunger</PixelLabel>
              <PixelHearts value={pet.hunger} max={PET_METER_MAX} />
            </View>
            <View style={styles.meterRow}>
              <PixelLabel>Mood</PixelLabel>
              <PixelHearts value={pet.mood} max={PET_METER_MAX} />
            </View>
          </View>
        )}
        </View>
        {!picking ? (
          <PixelFrame style={styles.stageBadge}>
            <PixelLabel>{PET_STAGE_LABEL[pet.stage]}</PixelLabel>
          </PixelFrame>
        ) : null}
        </View>
      </PixelFrame>
      {buffs.map((b) => (
        <PixelFrame key={b.key} style={styles.buffChip}>
          <View accessible accessibilityLabel={b.a11y}>
            <PixelLabel color={PIXEL.amber}>{b.text}</PixelLabel>
          </View>
        </PixelFrame>
      ))}
      </View>

      {/* Coach: what it needs, and the button that does it. */}
      <PixelFrame align="stretch" enter style={styles.coach}>
        <View style={styles.coachRow}>
          <PixelBody style={styles.coachText} numberOfLines={3}>
            {coach.tip}
          </PixelBody>
          {coach.button ? (
            <PixelButton label={coach.button} onPress={onCoach} style={styles.coachButton} />
          ) : null}
        </View>
      </PixelFrame>

      {width > 0 && picking && onPickEgg ? (
        <View style={[styles.eggRow, { top: floorY - 96 }]}>
          {EGG_TYPES.map((e) => (
            <Pressable
              key={e}
              onPress={() => onPickEgg(e)}
              accessibilityRole="button"
              accessibilityLabel={`${EGG_LABEL[e]} egg — see its heroes and odds`}
              style={({ pressed }) => [styles.eggPick, pressed && styles.pressed]}>
              <EggShape size={70} color={EGG_COLOR[e]} />
              <PixelLabel>{EGG_LABEL[e]}</PixelLabel>
            </Pressable>
          ))}
        </View>
      ) : null}

      {width > 0 && away ? (
        <View style={[styles.awayBubble, { left: snapArt(width * PET_BED_X - 80), top: snapArt(floorY - 64) }]}>
          <PixelNameplate>{plateStatus(status, pet.stage, stageLeftMs)}</PixelNameplate>
        </View>
      ) : null}

      {width > 0 && !away && !picking ? (
        <Animated.View style={[styles.petWrap, { top, width: box, height: box }, petStyle]}>
          {/* Floor ring (form colour; a worn ring cosmetic changes its style). */}
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                left: box * 0.2,
                top: footAt * box - 8,
                width: box * 0.6,
                borderColor: ringColor,
                borderWidth: look.ring === 'thick' ? 4 : 2,
                borderStyle: look.ring === 'dashed' ? 'dashed' : 'solid',
              },
            ]}
          />
          {pet.stage === 'god' && aura ? <GodAura element={aura} size={box * 1.4} reduceMotion={reduceMotion} /> : null}
          {maxedAura ? <MaxedAura size={box} animate={fxAnimate} /> : null}
          <GradeAura grade={grade} size={box} animate={fxAnimate} trail={act.face === 'front' ? null : act.face} />
          {pet.finish_color && (pet.finish_kind === 'holo' || pet.finish_kind === 'reverse') ? (
            <View
              pointerEvents="none"
              style={[
                styles.foilMat,
                pet.finish_kind === 'reverse'
                  ? { left: -box * 0.22, top: box * 0.46, width: box * 1.44, height: box * 0.46, borderRadius: box * 0.23 }
                  : { left: -box * 0.06, top: box * 0.1, width: box * 1.12, height: box * 0.86, borderRadius: 22 },
              ]}>
              <FinishPlate
                colorId={pet.finish_color}
                motion="sweep"
                reduceMotion={reduceMotion}
                opacity={
                  pet.auras.length > 0
                    ? quietFoilOpacity()
                    : pet.finish_kind === 'reverse'
                      ? cardFoilOpacity()
                      : windowFoilOpacity()
                }
              />
            </View>
          ) : null}
          <Pressable
            onPress={onTapPet}
            accessibilityRole="button"
            accessibilityLabel={`Your pet. ${label}. Tap to say hi.`}
            style={StyleSheet.absoluteFill}>
            <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
              <PetAnimSprite
                pet={pet}
                art={art}
                wear={wear}
                eggColor={eggColor}
                pose={act.pose}
                face={act.face}
                startedAt={act.startedAt}
                loop={act.loop}
                asleep={asleep}
                box={box}
                animate
                recolor={revealed ? recolor : null}
                lockColour={revealed && pet.shiny}
                foilMotion="sweep"
                reduceMotion={reduceMotion}
                reverseHost
                auraElement={auraElement}
              />
            </Animated.View>
          </Pressable>
          {revealed && pet.shiny ? <ShinyOverlay size={box} footAt={footAt} animate={fxAnimate} style={pet.shiny_style} /> : null}
          {revealed && !pet.shiny && pet.glimmer ? <GlimmerGlow size={box} footAt={footAt} animate={fxAnimate} /> : null}
          {asleep ? <Text style={[styles.zzz, { left: box * 0.6, top: box * 0.25 }]}>💤</Text> : null}
          <Animated.View style={[styles.heart, { left: box / 2 - 16, top: box * 0.22 }, heartStyle]} pointerEvents="none">
            <AtlasSprite atlas="room" frame="heart" />
          </Animated.View>
          {/* Speech on top, then the status bubble — one column anchored just
              above the pet's head, wider than the pet (so nothing truncates at
              Baby size) and kept inside the room. The name sits on its own
              line over the status. */}
          <Animated.View
            pointerEvents="box-none"
            style={[styles.bubbleColumn, { bottom: box - box * 0.18 + 6, left: 0, width: speechW }, speechStyle]}>
            <SpeechBubble speech={speech} reduceMotion={reduceMotion} speaker={name} />
            <PixelNameplate>
              {name ? `${name} · ${plateStatus(status, pet.stage, stageLeftMs)}` : plateStatus(status, pet.stage, stageLeftMs)}
            </PixelNameplate>
          </Animated.View>
          {/* v26: the grade is a nameplate on the ring at its feet — stars AND
              the word, always (never colour alone). The bubble above keeps only
              the name and mood. Tap: the pet's card. */}
          {revealed && grade ? (
            <Animated.View
              pointerEvents="box-none"
              style={[styles.plateWrap, { top: footAt * box + PLATE_BELOW_FEET, left: 0, width: plateW }, plateStyle]}>
              <PixelNameplate
                label={false}
                onPress={onBadge}
                accessibilityLabel={`${nameplateText(grade, pet.shiny)} — open its card`}>
                <View style={styles.gradeRow}>
                  <View style={styles.starRow}>
                    {Array.from({ length: GRADE_STARS[grade] }, (_, i) => (
                      <PixelStar key={i} color={GRADE_COLOR[grade]} />
                    ))}
                  </View>
                  <PixelLabel color={GRADE_COLOR[grade]} numberOfLines={1}>
                    {GRADE_LABEL[grade]}
                    {pet.shiny ? ' shiny' : ''}
                  </PixelLabel>
                </View>
              </PixelNameplate>
              {tide ? (
                <PixelNameplate>
                  <PixelLabel color="#4FFFD2">Tide</PixelLabel>
                </PixelNameplate>
              ) : null}
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  room: { flex: 1, overflow: 'hidden', backgroundColor: NEON.ink },
  corner: { position: 'absolute', top: 8, left: 8, right: 8, alignItems: 'stretch', gap: 8 },
  buffChip: { alignSelf: 'flex-end' },
  plateWrap: { position: 'absolute', alignItems: 'center' },
  meters: { alignSelf: 'stretch' },
  meterHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meterMain: { flex: 1, gap: 4 },
  meterBlock: { gap: 4 },
  meterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stageBadge: { flexGrow: 0 },
  coach: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
  },
  coachRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coachText: { flex: 1, textAlign: 'left' },
  coachButton: { flexGrow: 0 },
  pressed: { opacity: 0.82 },
  petWrap: { position: 'absolute', left: 0 },
  foilMat: { position: 'absolute', overflow: 'hidden' },
  ring: { position: 'absolute', height: 14, borderRadius: 999, opacity: 0.7 },
  zzz: { position: 'absolute', fontSize: 18 },
  heart: { position: 'absolute' },
  gradeRow: { alignItems: 'center', gap: 4 },
  starRow: { flexDirection: 'row', gap: ART_PT },
  eggRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around' },
  eggPick: { alignItems: 'center', gap: 4, minHeight: 48 },
  bubbleColumn: { position: 'absolute', alignItems: 'center', gap: 8 },
  awayBubble: { position: 'absolute', width: 160, alignItems: 'center' },
  speechText: { textAlign: 'center' },
});
