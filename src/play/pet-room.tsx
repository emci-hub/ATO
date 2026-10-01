/**
 * Pet room (overhaul, 2026-09-29) — the pet lives in a room scene, never a
 * still picture (Tamagotchi / Pou / Talking Tom). Drawn in code + existing
 * art only: an SVG neon room (wall, floor grid, a window whose sky follows
 * the phone's clock, a bed and a bowl) and the existing bush prop.
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
import { Image } from 'expo-image';
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
import Svg, { Circle, Defs, Ellipse, Line, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Fonts } from '@/constants/theme';
import type { PetCoachTip } from '@/play/coach';
import { FxLayer, FX_ULTIMATE_LIFE_MS, type FxEvent } from '@/play/fx-layer';
import { useFxQuality } from '@/play/fx-quality';
import { ELEMENT_COLOR, type Element } from '@/play/kits';
import { NEON } from '@/play/neon-viper';
import { PET_BRANCH_TINT, PET_METER_MAX, type PetState } from '@/play/pet';
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
  EGG_EMOJI,
  EGG_LABEL,
  EGG_TYPES,
  GRADE_COLOR,
  GRADE_LABEL,
  WARMTH_MAX,
  nameplateText,
  type EggType,
} from '@/play/pet-eggs';
import { EggShape } from '@/play/pet-figure';
import { GradeAura, ShinyOverlay } from '@/play/pet-looks';
import { wornLook, type PetWear } from '@/play/pet-cosmetics';
import { heartsText, petStatusLabel, type PetStatus } from '@/play/pet-status';
import { PET_TALK_HOLD_MS, PET_TALK_TYPE_MS } from '@/play/pet-talk';
import { roleFootAt, skinArt } from '@/play/skin';

/** Feet line, as a share of the room height. */
const FLOOR_AT = 0.8;
/** v26 nameplate text size (it may shrink a touch to fit, never below 90%). */
export const NAMEPLATE_FONT = 11;


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

function RoomBackdrop({ width, height, night, pantry }: { width: number; height: number; night: boolean; pantry: number }) {
  const horizon = height * HORIZON_AT;
  const winX = width * 0.07;
  const winY = height * 0.1;
  const winW = Math.min(150, width * 0.34);
  const winH = height * 0.24;
  const cx = width / 2;
  const floorLines = [0.08, 0.2, 0.36, 0.58, 0.86];
  const rays = [-1.2, -0.7, -0.3, 0, 0.3, 0.7, 1.2];
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="roomWall" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0C1630" />
          <Stop offset="1" stopColor="#070B18" />
        </LinearGradient>
        <LinearGradient id="roomFloor" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0B1426" />
          <Stop offset="1" stopColor="#04070F" />
        </LinearGradient>
        <LinearGradient id="roomSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={night ? '#070B26' : '#2E9BE0'} />
          <Stop offset="1" stopColor={night ? '#1B1F4A' : '#A8E6FF'} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={horizon} fill="url(#roomWall)" />
      <Rect x={0} y={horizon} width={width} height={height - horizon} fill="url(#roomFloor)" />
      {/* Neon strip along the ceiling and the skirting. */}
      <Line x1={0} y1={2} x2={width} y2={2} stroke={NEON.pink} strokeOpacity={0.55} strokeWidth={2} />
      <Line x1={0} y1={horizon} x2={width} y2={horizon} stroke={NEON.cyan} strokeOpacity={0.4} strokeWidth={1.5} />
      {floorLines.map((t) => (
        <Line
          key={t}
          x1={0}
          y1={horizon + (height - horizon) * t}
          x2={width}
          y2={horizon + (height - horizon) * t}
          stroke={NEON.cyan}
          strokeOpacity={0.1}
        />
      ))}
      {rays.map((r) => (
        <Line key={r} x1={cx + r * width * 0.12} y1={horizon} x2={cx + r * width * 0.9} y2={height} stroke={NEON.cyan} strokeOpacity={0.08} />
      ))}
      {/* Window: the sky follows the phone's clock. */}
      <Rect x={winX} y={winY} width={winW} height={winH} rx={8} fill="url(#roomSky)" stroke={NEON.cyanBorder} strokeWidth={2} />
      <Line x1={winX + winW / 2} y1={winY} x2={winX + winW / 2} y2={winY + winH} stroke={NEON.cyanBorder} strokeWidth={1.5} />
      {night ? (
        <>
          <Circle cx={winX + winW * 0.72} cy={winY + winH * 0.32} r={winH * 0.12} fill="#F4F1C9" />
          <Circle cx={winX + winW * 0.2} cy={winY + winH * 0.25} r={1.4} fill="#FFFFFF" />
          <Circle cx={winX + winW * 0.35} cy={winY + winH * 0.6} r={1.1} fill="#FFFFFF" />
          <Circle cx={winX + winW * 0.85} cy={winY + winH * 0.7} r={1.2} fill="#FFFFFF" />
        </>
      ) : (
        <Circle cx={winX + winW * 0.72} cy={winY + winH * 0.32} r={winH * 0.14} fill="#FFF3B0" />
      )}
      {/* Bed (where it sleeps) and the food bowl. */}
      <Ellipse cx={width * PET_BED_X} cy={height * FLOOR_AT + 4} rx={width * 0.13} ry={12} fill={NEON.violet} fillOpacity={0.45} />
      <Ellipse cx={width * PET_BED_X} cy={height * FLOOR_AT + 1} rx={width * 0.1} ry={7} fill={NEON.violet} fillOpacity={0.35} />
      <Ellipse cx={width * 0.16} cy={height * FLOOR_AT + 8} rx={20} ry={7} fill={pantry > 0 ? NEON.pink : NEON.cyanDim} fillOpacity={0.7} />
    </Svg>
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
    opacity.value = withTiming(1, { duration: 150 });
    const full = speech.text;
    let typer: ReturnType<typeof setInterval> | null = null;
    if (reduceMotion) {
      setShown(full);
    } else {
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
      opacity.value = withTiming(0, { duration: 400 });
    }, typeMs + PET_TALK_HOLD_MS);
    return () => {
      if (typer) clearInterval(typer);
      clearTimeout(fade);
    };
  }, [speech, opacity, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!speech) return null;
  return (
    <Animated.View style={[styles.speech, style]} pointerEvents="none" accessibilityLiveRegion="polite">
      {speaker ? <Text style={styles.speaker}>{speaker}</Text> : null}
      <Text style={styles.speechText}>{shown || ' '}</Text>
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
  name = null,
  buffs = [],
  maxedAura = false,
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
  /** v24 — the name it goes by (status and speech bubbles). */
  name?: string | null;
  /** v26 — active medal buffs for the corner (icon + uses / "Maxed aura"). */
  buffs?: readonly { key: string; text: string; a11y: string }[];
  /** v26 — Pumped is a "Maxed aura": a gold glow behind the pet. */
  maxedAura?: boolean;
}) {
  // Effects Low (Settings): auras and sparkles hold still.
  const fxFull = useFxQuality() === 'full';
  const fxAnimate = !reduceMotion && fxFull;
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

  return (
    <View style={styles.room} onLayout={onLayout}>
      {width > 0 ? <RoomBackdrop width={width} height={height} night={night} pantry={pantry} /> : null}
      {width > 0 ? (
        <Image
          source={skinArt('prop.bush')}
          contentFit="contain"
          style={[styles.plant, { left: width * 0.86 - 28, top: floorY - 52 }]}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {width > 0 && pantry > 0 ? (
        <Text style={[styles.bowlFood, { left: width * 0.16 - 11, top: floorY - 16 }]}>🍤</Text>
      ) : null}

      {/* Corner: both meters, always — and the active medal buffs (v26). */}
      <View style={styles.corner} pointerEvents="box-none">
      <View style={styles.meters} accessible accessibilityLabel={`Hunger ${pet.hunger} of ${PET_METER_MAX}, mood ${pet.mood} of ${PET_METER_MAX}`}>
        {picking ? (
          <Text style={styles.meterText}>Pick an egg</Text>
        ) : egg ? (
          <Text style={styles.meterText} accessibilityLabel={`Warmth ${pet.warmth} of ${WARMTH_MAX}`}>
            Warmth <Text style={styles.heartsText}>{'🔥'.repeat(pet.warmth)}{'·'.repeat(WARMTH_MAX - pet.warmth)}</Text>
          </Text>
        ) : (
          <>
            <Text style={styles.meterText}>
              Hunger <Text style={styles.heartsText}>{heartsText(pet.hunger)}</Text>
            </Text>
            <Text style={styles.meterText}>
              Mood <Text style={styles.heartsText}>{heartsText(pet.mood)}</Text>
            </Text>
          </>
        )}
      </View>
      {buffs.map((b) => (
        <View key={b.key} style={styles.buffChip} accessible accessibilityLabel={b.a11y}>
          <Text style={styles.buffText}>{b.text}</Text>
        </View>
      ))}
      </View>

      {/* Coach: what it needs, and the button that does it. */}
      <View style={styles.coach}>
        <Text style={styles.coachText} numberOfLines={3}>
          {coach.tip}
        </Text>
        {coach.button ? (
          <Pressable
            onPress={onCoach}
            accessibilityRole="button"
            style={({ pressed }) => [styles.coachButton, pressed && styles.pressed]}>
            <Text style={styles.coachButtonText}>{coach.button}</Text>
          </Pressable>
        ) : null}
      </View>

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
              <Text style={styles.eggPickLabel}>{EGG_EMOJI[e]} {EGG_LABEL[e]}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {width > 0 && away ? (
        <View style={[styles.awayBubble, { left: width * PET_BED_X - 50, top: floorY - 60 }]}>
          <Text style={styles.statusText}>{label}</Text>
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
              />
            </Animated.View>
          </Pressable>
          {revealed && pet.shiny ? <ShinyOverlay size={box} footAt={footAt} animate={fxAnimate} /> : null}
          {asleep ? <Text style={[styles.zzz, { left: box * 0.6, top: box * 0.25 }]}>💤</Text> : null}
          <Animated.Text style={[styles.heart, { left: box / 2 - 10, top: box * 0.3 }, heartStyle]} pointerEvents="none">
            ❤
          </Animated.Text>
          {/* Speech on top, then the status bubble — one column anchored just
              above the pet's head, wider than the pet (so nothing truncates at
              Baby size) and kept inside the room. The name sits on its own
              line over the status. */}
          <Animated.View
            pointerEvents="box-none"
            style={[styles.bubbleColumn, { bottom: box - box * 0.18 + 6, left: 0, width: speechW }, speechStyle]}>
            <SpeechBubble speech={speech} reduceMotion={reduceMotion} speaker={name} />
            <View style={styles.bubbleRow}>
              <View style={styles.statusBubble}>
                {name ? (
                  <Text style={styles.statusName} numberOfLines={1}>
                    {name}
                  </Text>
                ) : null}
                <Text style={styles.statusText}>{label}</Text>
              </View>
            </View>
          </Animated.View>
          {/* v26: the grade is a nameplate on the ring at its feet — stars AND
              the word, always (never colour alone). The bubble above keeps only
              the name and mood. Tap: the pet's card. */}
          {revealed && grade ? (
            <Animated.View
              pointerEvents="box-none"
              style={[styles.plateWrap, { top: footAt * box - 4, left: 0, width: plateW }, plateStyle]}>
              <Pressable
                onPress={onBadge}
                disabled={!onBadge}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`${GRADE_LABEL[grade]}${pet.shiny ? ' shiny' : ''} — open its card`}
                style={[styles.badge, { borderColor: GRADE_COLOR[grade] }]}>
                <Text
                  style={[styles.badgeText, { color: GRADE_COLOR[grade] }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.9}>
                  {nameplateText(grade, pet.shiny)}
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  room: { flex: 1, overflow: 'hidden', backgroundColor: NEON.ink },
  plant: { position: 'absolute', width: 56, height: 56 },
  bowlFood: { position: 'absolute', fontSize: 16 },
  corner: { position: 'absolute', top: 10, right: 10, alignItems: 'flex-end', gap: 4 },
  buffChip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(5, 7, 13, 0.72)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  buffText: { fontFamily: Fonts.monoBold, fontSize: 11, color: '#FFE9A8' },
  plateWrap: { position: 'absolute', alignItems: 'center' },
  meters: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(5, 7, 13, 0.72)',
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    gap: 2,
  },
  meterText: { fontFamily: Fonts.monoBold, fontSize: 12, color: NEON.textPrimary },
  heartsText: { color: '#FF5A8A', letterSpacing: 1 },
  coach: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 7, 13, 0.8)',
    borderWidth: 1,
    borderColor: NEON.cyanBorder,
  },
  coachText: { flex: 1, fontFamily: Fonts.monoBold, fontSize: 13, color: NEON.textPrimary },
  coachButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#0E7490',
  },
  coachButtonText: { fontFamily: Fonts.monoBold, fontSize: 12, color: '#FFFFFF' },
  pressed: { opacity: 0.75 },
  petWrap: { position: 'absolute', left: 0 },
  ring: { position: 'absolute', height: 14, borderRadius: 999, opacity: 0.7 },
  zzz: { position: 'absolute', fontSize: 18 },
  heart: { position: 'absolute', fontSize: 20, color: '#FF5A8A' },
  bubbleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10, borderWidth: 1, backgroundColor: 'rgba(5, 7, 13, 0.85)' },
  badgeText: { fontFamily: Fonts.monoBold, fontSize: NAMEPLATE_FONT },
  eggRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around' },
  eggPick: { alignItems: 'center', gap: 4 },
  eggPickLabel: { fontFamily: Fonts.monoBold, fontSize: 12, color: NEON.textPrimary },
  bubbleColumn: { position: 'absolute', alignItems: 'center', gap: 6 },
  statusBubble: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 7, 13, 0.85)',
    borderWidth: 1,
    borderColor: NEON.cyanBorder,
  },
  awayBubble: {
    position: 'absolute',
    width: 100,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 7, 13, 0.85)',
    borderWidth: 1,
    borderColor: NEON.cyanBorder,
  },
  statusText: { fontFamily: Fonts.monoBold, fontSize: 13, color: NEON.textPrimary },
  statusName: { fontFamily: Fonts.monoBold, fontSize: 11, color: NEON.cyan },
  speech: {
    minWidth: 60,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F1FBFF',
  },
  speaker: { fontFamily: Fonts.monoBold, fontSize: 10, color: '#0E7490', textAlign: 'center' },
  speechText: { fontFamily: Fonts.monoBold, fontSize: 13, color: '#05070D', textAlign: 'center' },
});
