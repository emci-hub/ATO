/**
 * Pet room — the approved mockup plate (room2.py): dusk plank wall, wainscot,
 * night window, picture, lamp, brick floor, rug, bed and bowl. The live pet
 * stands on the rug. Lamp flicker, window twinkle, dust motes and a sparkle
 * freeze when Reduce Motion is on or effects are low.
 *
 * The pet wanders, turns, idles, sits, sometimes shows off (its attack/skill
 * clip), sleeps at night — all decided by `planPetStep` (pet-actor.ts) from
 * its mood and form. Tapping it: a hop, a heart, it faces you, it talks.
 * Above its head a status bubble (emoji + word) follows it; the corner shows
 * both meters in hearts; a coach strip says what it needs, with a button.
 *
 * Motion v2: the pet keeps walking unless in-game Motion is Off. OS Reduce
 * Motion only gentles vestibular effects. Streetwear uses the isometric
 * Hideout map (2D floor wander). Classic is unchanged except the shared
 * motion flags.
 */
import { useEffect, useRef, useState } from 'react';
import { PixelRatio, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  FadeInDown,
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import type { PetCoachTip } from '@/play/coach';
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
import {
  HIDEOUT_IDLE_FACES,
  HIDEOUT_MARGIN_PT,
  HIDEOUT_NIGHT,
  hideoutFace,
  HIDEOUT_HERO_FIGURE_PX,
  HIDEOUT_STAGE_SCALE,
  hideoutHeroArtPx,
  hideoutCameraTop,
  hideoutCoverRestTop,
  hideoutCoverScale,
  hideoutIntegerScale,
  hideoutPetBox,
  hideoutStageOrigin,
  hideoutTargetPoint,
  planHideoutStep,
  type HideoutScale,
} from '@/play/hideout-iso';
import { usePlayLoopAlive } from '@/play/play-loop';
import { usePlayMotion } from '@/play/play-motion';
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
import { Flicker, MoteRise, Twinkle } from '@/play/pixel-ambient';
import { DitherPool, LampCycle, useHitJuice } from '@/play/pixel-fx';
import { AtlasSprite, MOCKUP_PLATE, MOCKUP_ROOM, placePlate } from '@/play/pixel-atlas';
import { ART_PT, PIXEL, PIXEL_FEED_H, PIXEL_FEED_W, snapArt } from '@/play/pixel-theme';
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
import { roleFootAt, roleGroundAt } from '@/play/skin';
import {
  StreetRoomArt,
  StreetRoomAuraClip,
  StreetRoomFront,
  StreetRoomLife,
  StreetRoomSpots,
  StreetRoomYard,
  StreetSpeechBubble,
  StreetStatusStrip,
  type StreetRoomSpotsProps,
} from '@/play/street-room';
import {
  HIDEOUT_CEILING_ART_PX,
  HIDEOUT_CONTROL_COMPACT_PT,
  HIDEOUT_ROW_RESERVE_PT,
  HIDEOUT_SIDE_COLUMN_PT,
} from '@/play/hideout-bar';
import { HideoutStageChrome, HideoutStageControls, roomGeom } from '@/play/hideout-stage';
import type { HideoutProgressInput, HideoutRoomId, HideoutState } from '@/play/hideout-progress';
import type { Presence } from '@/play/hideout-presence';
import { STREET_MOTION } from '@/play/street-feel';
import { STREET_FONT, streetUiOn } from '@/play/street-ui';

// The nameplate hangs BELOW the feet line. The floor ring runs from feet-8 to
// feet+6, so +8 clears it and the sprite for every stage (it used to sit at -4
// and covered the pet's feet — Crimson Oni, Child).
const PLATE_BELOW_FEET = 8;
/** Room under the feet kept clear for the grade nameplate (stars + the word). */
const NAME_RESERVE = 84;
/** Nameplate text size — Departure Mono at 2pt per font pixel (cap stays 16pt). */
export const NAMEPLATE_FONT = 22;

function plateStatus(status: PetStatus, stage: PetState['stage'], stageLeftMs: number | null): string {
  if (status === 'egg' && stage === 'egg' && isEvolvingSoon('egg', stageLeftMs)) return 'Hatching soon';
  return PET_STATUS_WORD[status];
}

/** A 5×5 art-pixel star. Departure Mono has no star glyph. */
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
const TAP_FACE_MS = 1400;
const AURA_EVERY_MS = 1400;

export type RoomSpeech = { text: string; key: number } | null;

/* ------------------------------------------------------------ backdrop --- */

function roomOrigin(width: number, height: number) {
  return placePlate(width, height, MOCKUP_ROOM.feet, NAME_RESERVE);
}

function hideoutOrigin(width: number, height: number, scale: HideoutScale) {
  return hideoutStageOrigin(width, height, scale);
}

function RoomBackdrop({
  width,
  height,
  alive,
  scale,
  gentle,
  minimal,
  skipArt,
}: {
  width: number;
  height: number;
  alive: boolean;
  scale: HideoutScale | null;
  gentle: boolean;
  minimal: boolean;
  skipArt?: boolean;
}) {
  const origin = roomOrigin(width, height);
  const k = ART_PT;
  if (streetUiOn() && scale) {
    const iso = hideoutOrigin(width, height, scale);
    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: HIDEOUT_NIGHT }]}>
        <StreetRoomYard width={width} height={height} scale={scale} />
        {skipArt ? null : <StreetRoomArt left={iso.left} top={iso.top} scale={scale} alive={alive} gentle={gentle} />}
        {skipArt ? null : <StreetRoomLife left={iso.left} top={iso.top} scale={scale} alive={alive} gentle={gentle} minimal={minimal} />}
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', left: origin.left, top: origin.top }}>
        <AtlasSprite atlas="room" frame="plate" />
        <DitherPool alive={alive} cx={158} cy={322} rx={70} ry={18} color="#F9C22B" lit={2} gain={0.42} />
        <View style={{ position: 'absolute', left: MOCKUP_ROOM.glow.x * k, top: MOCKUP_ROOM.glow.y * k }}>
          <Flicker alive={alive} peak={0.65} ms={480}>
            <AtlasSprite atlas="room" frame="glow" />
          </Flicker>
        </View>
        <View style={{ position: 'absolute', left: 175 * k, top: 158 * k }}>
          <LampCycle alive={alive} />
        </View>
        <View style={{ position: 'absolute', left: MOCKUP_ROOM.sky.x * k, top: MOCKUP_ROOM.sky.y * k }}>
          <Twinkle alive={alive} ms={1100}>
            <AtlasSprite atlas="room" frame="sky" />
          </Twinkle>
        </View>
        {MOCKUP_ROOM.motes.map((m, i) => (
          <MoteRise key={i} alive={alive} left={m.x * k} top={m.y * k} distance={28 + i * 10} ms={3600 + i * 500} delay={i * 700}>
            <AtlasSprite atlas="room" frame="mote" />
          </MoteRise>
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
      <PixelFrame streetPiece="panel" align="stretch">
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
  sceneActive = true,
  onTapPet,
  streetSpots,
  onCoach,
  recolor = null,
  onBadge,
  onPickEgg,
  tide = false,
  name = null,
  buffs = [],
  maxedAura = false,
  auraElement = null,
  juiceKey = 0,
  hideoutStage = null,
  stageSize,
  roomOutside = false,
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
  /** False when the Hideout tab is not focused (pauses room loops). */
  sceneActive?: boolean;
  onTapPet: () => void;
  /** Streetwear Hideout: tappable room spots (pet-screen wires the handlers). */
  streetSpots?: StreetRoomSpotsProps;
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
  /** Bumps when Feed lands a treat, to flash and shake the pet. */
  juiceKey?: number;
  hideoutStage?: {
    hideout: HideoutState;
    progress: HideoutProgressInput;
    presence: Presence;
    viewed: HideoutRoomId;
    expeditionBackMs: number | null;
    onView: (id: HideoutRoomId) => void;
    onTease: () => void;
    onLamp: () => void;
    onCall: () => void;
    onCoachSeen: () => void;
  } | null;
  /** Stage layout: the fixed stage size from the GameScreen frame (no measuring, no resizing). */
  stageSize?: { width: number; height: number };
  /** Stage layout: the status strip and the Hideout / Loft / Call row live outside the room
   * (NoticeLane + their own row); the room fills the whole stage and a camera follows the pet. */
  roomOutside?: boolean;
}) {
  // Departure Mono / Rajdhani. Hold the room until they are in, so labels never paint in a fallback face.
  const fontsReady = usePixelFonts();
  const motion = usePlayMotion();
  const loopAlive = usePlayLoopAlive(sceneActive);
  // Effects Low (Settings): auras and sparkles hold still. Walk KEeps unless Off.
  const fxFull = useFxQuality() === 'full';
  const fxMinimal = useFxQuality() === 'minimal';
  const fxAnimate = !motion.cosmeticsStill && fxFull && loopAlive;
  const walkOn = !motion.cosmeticsStill && loopAlive;
  const hit = useHitJuice();
  const hitSeen = useRef(juiceKey);
  const playHit = useRef(hit.play);
  playHit.current = hit.play;
  useEffect(() => {
    if (hitSeen.current === juiceKey) return;
    hitSeen.current = juiceKey;
    if (!fxAnimate) return;
    playHit.current();
  }, [fxAnimate, juiceKey]);
  const [measured, setMeasured] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    if (stageSize) return;
    setMeasured({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
  };
  const real = stageSize ?? measured;
  const streetRoom = streetUiOn();
  const pr = PixelRatio.get();
  // Hideout room + Call buttons: a column in the right gutter when the room leaves one
  // (the room then uses the full stage height), else a row under the room that the
  // room is fitted above so the manhole and door stay clear.
  const fullFit =
    streetRoom && real.width > 0 && real.height > 0
      ? hideoutIntegerScale({ availW: real.width - HIDEOUT_MARGIN_PT * 2, availH: real.height, pixelRatio: pr })
      : null;
  const controlsMode: 'side' | 'ceiling' | 'row' = !hideoutStage || !fullFit
    ? 'row'
    : (real.width - fullFit.canvasW) / 2 >= HIDEOUT_SIDE_COLUMN_PT
      ? 'side'
      : HIDEOUT_CEILING_ART_PX * fullFit.pt >= HIDEOUT_CONTROL_COMPACT_PT
        ? 'ceiling'
        : 'row';
  const barReserve = hideoutStage && controlsMode === 'row' && !roomOutside ? HIDEOUT_ROW_RESERVE_PT : 0;
  const cover = streetRoom && roomOutside;
  const hideoutScale =
    cover && real.width > 0 && real.height > 0
      ? hideoutCoverScale({ availW: real.width, availH: real.height, pixelRatio: pr })
      : streetRoom && real.width > 0 && real.height > 0
      ? hideoutIntegerScale({
          availW: real.width - HIDEOUT_MARGIN_PT * 2,
          availH: Math.max(1, real.height - barReserve),
          pixelRatio: pr,
        })
      : null;
  const hideoutPt = hideoutScale?.pt ?? 0;
  const width = real.width;
  const height = real.height;

  const art = usePetArt(pet);
  const away = status === 'away';
  const egg = pet.stage === 'egg';
  const box =
    streetRoom && hideoutScale
      ? hideoutPetBox(hideoutHeroArtPx(pet.stage), hideoutScale, pr)
      : egg
        ? PET_ROOM_BOX.egg
        : sharpPetBox(PET_ROOM_BOX[pet.stage], art.cellPx, pr);
  const footAt = egg ? 1 : roleFootAt(art.role);
  // Floor effects (ring, glimmer, shiny ring) centre on the ground point, not the toe edge.
  const groundAt = egg ? 1 : roleGroundAt(art.role);
  // Cover: the room's own layer is as tall as the room; the camera slides it (roomTop ≤ 0).
  const roomLayerH = cover && hideoutScale ? Math.max(height, hideoutScale.canvasH) : height;
  const origin = cover && hideoutScale
    ? { left: Math.round((width - hideoutScale.canvasW) / 2), top: hideoutScale.canvasH > height ? 0 : Math.round((height - hideoutScale.canvasH) / 2) }
    : streetRoom && hideoutScale
    ? hideoutOrigin(Math.max(width, 1), Math.max(height - barReserve, 1), hideoutScale)
    : roomOrigin(Math.max(width, 1), Math.max(height, 1));
  const k = hideoutScale?.pt ?? ART_PT;
  const floorY = streetRoom && hideoutScale ? origin.top + 224 * k : origin.top + MOCKUP_ROOM.feet * ART_PT;
  const plateW = streetRoom && hideoutScale ? hideoutScale.canvasW : MOCKUP_PLATE.w * ART_PT;
  const plateLeft = origin.left;
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
  const startFeet = hideoutTargetPoint('cushion');
  const [feet, setFeet] = useState({ x: startFeet[0], y: startFeet[1] });
  const x = useSharedValue(0.5);
  const artX = useSharedValue(startFeet[0]);
  const artY = useSharedValue(startFeet[1]);
  const hop = useSharedValue(0);
  const drift = useSharedValue(0);
  const squash = useSharedValue(1);
  const heart = useSharedValue(0);
  const xRef = useRef(0.5);
  const artXRef = useRef(startFeet[0]);
  const artYRef = useRef(startFeet[1]);
  // Read inside the walk loop without restarting it on every hunger change.
  const hungerRef = useRef(pet.hunger);
  hungerRef.current = pet.hunger;
  const faceRef = useRef<PetFace>('e');
  const faceTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tapUntilRef = useRef(0);

  // The behaviour loop. Street Hideout: 2D roam on the walk polygon (every
  // kit / stage / skin). Classic: the 0..1 rug. Walk unless Motion is Off.
  useEffect(() => {
    const playBounce = (amount: number, ms: number, hopAct: boolean) => {
      cancelAnimation(hop);
      if (amount > 0) {
        const hops = Math.max(1, Math.round(ms / 360));
        hop.value = withRepeat(
          withSequence(
            withTiming(-amount, { duration: 180, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
            withTiming(0, { duration: 180, easing: Easing.in(Easing.quad), reduceMotion: ReduceMotion.Never }),
          ),
          hops,
        );
      } else if (hopAct) {
        hop.value = withSequence(withTiming(-14, { duration: 200 }), withTiming(0, { duration: 260, easing: Easing.bounce }));
      } else {
        hop.value = withTiming(0, { duration: 150 });
      }
    };
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
      if (!walkOn) {
        setAct({ pose: petPose(art.kit, 'idle'), loop: true, startedAt: Date.now(), face: faceRef.current, squash: false });
        timer = setTimeout(run, 4000);
        return;
      }
      const iso = streetRoom && hideoutPt > 0;
      if (iso) {
        // Live feet, not the previous dest — otherwise a skipped tween (OS RM)
        // or a restarted effect plans the next step from the wrong place.
        const fromX = artX.value;
        const fromY = artY.value;
        const step = planHideoutStep({
          kit: art.kit,
          mood,
          branch: pet.branch,
          stage: pet.stage,
          x: fromX,
          y: fromY,
          rng: Math.random,
          hungry: hungerRef.current <= 1,
          geom: hideoutStage ? roomGeom(hideoutStage.presence.room) : undefined,
        });
        const path = step.path.length >= 2 ? step.path : ([[fromX, fromY], [step.toX, step.toY]] as const);
        const dx0 = path[Math.min(1, path.length - 1)][0] - fromX;
        const dy0 = path[Math.min(1, path.length - 1)][1] - fromY;
        let face: PetFace = hideoutFace(dx0, dy0, faceRef.current);
        if (step.act === 'idle' && Math.abs(step.toX - fromX) < 2 && Math.abs(step.toY - fromY) < 2 && Math.random() < 0.3) {
          face = HIDEOUT_IDLE_FACES[Math.floor(Math.random() * HIDEOUT_IDLE_FACES.length)] ?? 's';
        }
        faceRef.current = face;
        setAct({ pose: step.pose, loop: step.loop, startedAt: Date.now(), face, squash: step.squash });
        squash.value = withTiming(step.squash ? 0.92 : 1, { duration: 300, reduceMotion: ReduceMotion.Never });
        cancelAnimation(artX);
        cancelAnimation(artY);
        for (const t of faceTimers.current) clearTimeout(t);
        faceTimers.current = [];
        if (step.toX !== fromX || step.toY !== fromY) {
          // KEEP locomotion under OS Reduce Motion. Reanimated's default
          // ReduceMotion.System skips withTiming and the pet teleports.
          const keepWalk = { easing: Easing.linear, reduceMotion: ReduceMotion.Never };
          const xSegs: ReturnType<typeof withTiming>[] = [];
          const ySegs: ReturnType<typeof withTiming>[] = [];
          let px = fromX;
          let py = fromY;
          let delay = 0;
          const total = Math.max(
            1e-3,
            path.slice(1).reduce((s, p, i) => {
              const a = i === 0 ? ([fromX, fromY] as const) : path[i];
              return s + Math.hypot(p[0] - a[0], p[1] - a[1]);
            }, 0),
          );
          for (let i = 1; i < path.length; i += 1) {
            const nx = path[i][0];
            const ny = path[i][1];
            const dist = Math.hypot(nx - px, ny - py);
            const ms = Math.max(16, Math.round((step.ms * dist) / total));
            xSegs.push(withTiming(nx, { duration: ms, ...keepWalk }));
            ySegs.push(withTiming(ny, { duration: ms, ...keepWalk }));
            if (i > 1) {
              const segFace = hideoutFace(nx - px, ny - py, faceRef.current);
              const at = delay;
              faceTimers.current.push(
                setTimeout(() => {
                  faceRef.current = segFace;
                  setAct((prev) => ({ ...prev, face: segFace }));
                }, at),
              );
            }
            delay += ms;
            px = nx;
            py = ny;
          }
          artX.value = (xSegs.length === 1 ? xSegs[0]! : withSequence(...xSegs)) as number;
          artY.value = (ySegs.length === 1 ? ySegs[0]! : withSequence(...ySegs)) as number;
        }
        artXRef.current = step.toX;
        artYRef.current = step.toY;
        playBounce(step.act === 'wander' ? 0 : step.bounce, step.ms, false);
        timer = setTimeout(run, step.ms);
        return;
      }
      let step: PetStep = planPetStep({
        kit: art.kit,
        mood,
        branch: pet.branch,
        stage: pet.stage,
        x: xRef.current,
        rng: Math.random,
      });
      if (step.act === 'sleep' && Math.abs(xRef.current - PET_BED_X) > 0.02) {
        step = { ...step, act: 'wander', pose: petPose(art.kit, 'walk'), toX: PET_BED_X, ms: 2600, squash: false };
      }
      let face = faceRef.current;
      if (step.toX > xRef.current + 0.01) face = 'e';
      else if (step.toX < xRef.current - 0.01) face = 'w';
      else if (step.act === 'idle' && Math.random() < 0.3) face = face === 'e' ? 'w' : 'e';
      faceRef.current = face;
      setAct({ pose: step.pose, loop: step.loop, startedAt: Date.now(), face, squash: step.squash });
      squash.value = withTiming(step.squash ? 0.92 : 1, { duration: 300 });
      if (step.toX !== xRef.current) {
        x.value = withTiming(step.toX, { duration: step.ms, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
        xRef.current = step.toX;
      }
      playBounce(step.bounce, step.ms, step.act === 'hop');
      timer = setTimeout(run, step.ms);
    };
    run();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      for (const t of faceTimers.current) clearTimeout(t);
      faceTimers.current = [];
    };
  }, [width, away, egg, art.kit, mood, pet.branch, pet.stage, walkOn, streetRoom, hideoutPt, artX, artY, x, hop, squash, hideoutStage]);

  // Depth vs props follows the live feet, not only the step's destination.
  useEffect(() => {
    if (!streetRoom || away || egg) return;
    const tick = () => {
      setFeet({ x: artX.value, y: artY.value });
    };
    tick();
    const id = setInterval(tick, 80);
    return () => clearInterval(id);
  }, [streetRoom, away, egg, artX, artY, hideoutStage]);

  // Deep drifts: a slow float. KEEP under Reduce Motion, smaller travel.
  useEffect(() => {
    cancelAnimation(drift);
    drift.value = 0;
    if (!walkOn || away) return;
    if (pet.branch === 'deep' && !egg && !asleep) {
      const amp = motion.vestibularSafe ? 3 : 6;
      drift.value = withRepeat(
        withSequence(
          withTiming(-amp, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
    }
  }, [pet.branch, egg, asleep, walkOn, away, drift, motion.vestibularSafe]);

  // Tap: hop, a heart, face you. Walk pauses; hop stays unless Motion is Off.
  useEffect(() => {
    if (tapKey === 0) return;
    tapUntilRef.current = Date.now() + TAP_FACE_MS;
    cancelAnimation(x);
    cancelAnimation(artX);
    cancelAnimation(artY);
    xRef.current = x.value;
    artXRef.current = artX.value;
    artYRef.current = artY.value;
    if (!egg && !asleep) {
      setAct((prev) => ({ ...prev, pose: petPose(art.kit, 'idle'), loop: true, face: 'front', startedAt: Date.now() }));
    }
    const back = setTimeout(() => setAct((prev) => ({ ...prev, face: faceRef.current })), TAP_FACE_MS);
    heart.value = 0;
    heart.value = withTiming(1, { duration: motion.vestibularSafe ? 600 : 900 });
    if (walkOn) {
      cancelAnimation(hop);
      hop.value = withSequence(
        withTiming(motion.vestibularSafe ? -8 : -18, { duration: 170, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 280, easing: Easing.bounce }),
      );
    }
    return () => clearTimeout(back);
  }, [tapKey, egg, asleep, art.kit, heart, hop, walkOn, motion.vestibularSafe, x, artX, artY]);

  const isoPt = hideoutScale?.pt ?? ART_PT;
  // Stage layout camera (emci 2026-10-14): the room fills the stage and its layer slides so the
  // pet stays in view — the floor first, lazily (no move while the pet is inside the band).
  // Reduce Motion: the same glide, slower — gentle, never a jump.
  const camRoomH = cover && hideoutScale ? hideoutScale.canvasH : 0;
  const camTop = useSharedValue(cover && camRoomH > height ? hideoutCoverRestTop(height, camRoomH) : 0);
  const camGentle = motion.vestibularSafe;
  useAnimatedReaction(
    () => (cover && camRoomH > height ? artY.value * isoPt : -1),
    (feetY) => {
      if (feetY < 0) {
        camTop.value = 0;
        return;
      }
      const next = hideoutCameraTop(height, camRoomH, feetY, camTop.value);
      if (Math.abs(next - camTop.value) > 1) {
        camTop.value = withTiming(next, {
          duration: camGentle ? 900 : 600,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.Never,
        });
      }
    },
    [cover, camRoomH, height, isoPt, camGentle],
  );
  const camStyle = useAnimatedStyle(() => ({ transform: [{ translateY: camTop.value }] }));
  const isoOn = !!(streetRoom && hideoutScale);
  const ox = origin.left;
  const oy = origin.top;
  const petStyle = useAnimatedStyle(() => {
    if (isoOn) {
      // Feet = origin + art * pt. Wrap top-left = feet - (box/2, footAt*box).
      // Do NOT also apply the classic-room `top = floorY - footAt*box` on the
      // wrap — that double-counted origin, footAt, and a phantom y=224 floor line.
      return {
        transform: [
          { translateX: ox + artX.value * isoPt - box / 2 },
          { translateY: oy + artY.value * isoPt - footAt * box + hop.value + drift.value },
        ],
      };
    }
    return {
      transform: [
        { translateX: plateLeft + x.value * plateW - box / 2 },
        { translateY: hop.value + drift.value },
      ],
    };
  });
  // Street Hideout speech bubble: follows the pet's LIVE feet on the UI thread (the
  // walk runs on shared values, so a render-time snapshot was left behind). Bottom of
  // the bubble sits just above the pet's head; clamped inside the room horizontally.
  // Fit the bubble to its line (11 pt pixel label ≈ 7 pt per char) so the tail stays over the pet.
  const speechBubbleW = speech ? Math.min(200, Math.max(64, speech.text.length * 7 + 22)) : 200;
  const speechRoomW = hideoutScale ? hideoutScale.canvasW : width;
  // The drawn figure (~106 art px grown, × stage scale) stands on its feet: the head is
  // that far above them, whatever the sprite cell's padding.
  const figurePt = HIDEOUT_HERO_FIGURE_PX * HIDEOUT_STAGE_SCALE[pet.stage] * isoPt;
  const isoSpeechStyle = useAnimatedStyle(() => {
    const cx = ox + artX.value * isoPt;
    const headY = oy + artY.value * isoPt - figurePt + hop.value + drift.value;
    const left = Math.min(Math.max(cx - 24, ox + 4), ox + speechRoomW - speechBubbleW - 4);
    return { transform: [{ translateX: left }, { translateY: headY - 6 }] };
  });
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
    const center = plateLeft + x.value * plateW;
    const want = Math.min(Math.max(10, center - speechW / 2), Math.max(10, width - 10 - speechW));
    return { transform: [{ translateX: want - (center - box / 2) }] };
  });

  // v26 nameplate: on the ring at the pet's feet, walking with it; wider than
  // a small pet so "★★★★ Legendary" always fits, and kept inside the room.
  const nameW = Math.min(Math.max(120, box), Math.max(120, width - 16));
  const plateStyle = useAnimatedStyle(() => {
    const center = plateLeft + x.value * plateW;
    const want = Math.min(Math.max(8, center - nameW / 2), Math.max(8, width - 8 - nameW));
    return { transform: [{ translateX: want - (center - box / 2) }] };
  });

  if (!fontsReady) return <View style={styles.room} />;

  const meterLabel = { fontSize: 16, lineHeight: 20 } as const;

  return (
    <View style={[styles.room, streetRoom && { backgroundColor: HIDEOUT_NIGHT }]}>
      {/* Meters, the scene, and the coach are three rows. None is positioned
          on top of another, so a short phone cannot stack them. */}
      {roomOutside ? null : (
      <View style={styles.metersSlot} pointerEvents="box-none">
      {streetRoom ? (
        <StreetStatusStrip
          egg={egg}
          picking={picking}
          hunger={pet.hunger}
          mood={pet.mood}
          warmth={pet.warmth}
          stageLabel={PET_STAGE_LABEL[pet.stage]}
          name={name}
          grade={grade}
          shiny={pet.shiny}
          reduceMotion={motion.cosmeticsStill}
        />
      ) : (
      <PixelFrame streetPiece="panel" align="stretch" enter style={[styles.meters, streetUiOn() && styles.streetMeters]}>
        <View style={styles.meterHead}>
        <View style={styles.meterMain} accessible accessibilityLabel={`Hunger ${pet.hunger} of ${PET_METER_MAX}, mood ${pet.mood} of ${PET_METER_MAX}`}>
        {picking ? (
          <PixelLabel>Pick an egg</PixelLabel>
        ) : egg ? (
          <View style={styles.meterRow} accessibilityLabel={`Warmth ${pet.warmth} of ${WARMTH_MAX}`}>
            <PixelLabel color={PIXEL.cyan} style={meterLabel}>Warmth</PixelLabel>
            <PixelHearts value={pet.warmth} max={WARMTH_MAX} color={PIXEL.amber} />
          </View>
        ) : (
          <View style={styles.meterBlock}>
            <View style={styles.meterRow}>
              <PixelLabel color={PIXEL.cyan} style={meterLabel}>Hunger</PixelLabel>
              <PixelHearts value={pet.hunger} max={PET_METER_MAX} />
            </View>
            <View style={styles.meterRow}>
              <PixelLabel color={PIXEL.cyan} style={meterLabel}>Mood</PixelLabel>
              <PixelHearts value={pet.mood} max={PET_METER_MAX} />
            </View>
          </View>
        )}
        </View>
        <View style={styles.meterSide}>
        {!picking ? (
          <PixelFrame glow={false} style={styles.stageBadge}>
            <PixelLabel style={meterLabel}>{PET_STAGE_LABEL[pet.stage]}</PixelLabel>
          </PixelFrame>
        ) : null}
        <PixelFrame glow={false} style={styles.foodChip}>
          <View accessible accessibilityLabel={`${pantry} ${pantry === 1 ? 'treat' : 'treats'} in the pantry`}>
            <PixelLabel color={PIXEL.amber} style={meterLabel}>{`×${pantry}`}</PixelLabel>
          </View>
        </PixelFrame>
        </View>
        </View>
      </PixelFrame>
      )}
      {streetRoom ? null : (
        buffs.map((b) => (
          <PixelFrame key={b.key} style={styles.buffChip}>
            <View accessible accessibilityLabel={b.a11y}>
              <PixelLabel color={PIXEL.amber}>{b.text}</PixelLabel>
            </View>
          </PixelFrame>
        ))
      )}
      </View>
      )}

      <View style={stageSize ? [styles.stageFixed, { width: stageSize.width, height: stageSize.height }] : styles.stage} onLayout={onLayout}>
      <Animated.View style={cover ? [styles.roomLayer, { height: roomLayerH }, camStyle] : StyleSheet.absoluteFill}>
      {width > 0 ? (
        <RoomBackdrop
          width={width}
          height={height}
          alive={loopAlive && !motion.cosmeticsStill}
          scale={hideoutScale}
          gentle={motion.vestibularSafe}
          minimal={fxMinimal}
          skipArt={!!hideoutStage}
        />
      ) : null}
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
        <View style={[styles.awayBubble, { left: snapArt(plateLeft + plateW * PET_BED_X - 80), top: snapArt(floorY - 64) }]}>
          <PixelNameplate>{plateStatus(status, pet.stage, stageLeftMs)}</PixelNameplate>
        </View>
      ) : null}

      {width > 0 && hideoutStage && hideoutScale ? (
        <HideoutStageChrome
          hideout={hideoutStage.hideout}
          progress={hideoutStage.progress}
          presence={hideoutStage.presence}
          viewed={hideoutStage.viewed}
          scale={hideoutScale}
          origin={origin}
          width={width}
          night={night}
          feetX={feet.x}
          feetY={feet.y}
          expeditionBackMs={hideoutStage.expeditionBackMs}
          onView={hideoutStage.onView}
          onTease={hideoutStage.onTease}
          onLamp={hideoutStage.onLamp}
        />
      ) : null}

      {width > 0 && !away && !picking && (!hideoutStage || (hideoutStage.presence.room === hideoutStage.viewed && !hideoutStage.presence.away)) ? (
        <Animated.View pointerEvents={streetRoom ? 'box-none' : 'auto'} style={[styles.petWrap, { top: isoOn ? 0 : top, width: box, height: box }, petStyle]}>
          {streetRoom ? null : (
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                left: box * 0.2,
                top: groundAt * box - 8,
                width: box * 0.6,
                borderColor: ringColor,
                borderWidth: look.ring === 'thick' ? 4 : 2,
                borderStyle: look.ring === 'dashed' ? 'dashed' : 'solid',
              },
            ]}
          />
          )}
          {pet.stage === 'god' && aura && !streetRoom ? <GodAura element={aura} size={box * 1.4} reduceMotion={motion.cosmeticsStill} /> : null}
          {maxedAura ? <MaxedAura size={box} animate={fxAnimate} /> : null}
          <GradeAura grade={grade} size={box} animate={fxAnimate} trail={act.face === 'e' || act.face === 'w' ? act.face : null} />
          <Pressable
            onPress={onTapPet}
            accessibilityRole="button"
            accessibilityLabel={`Your pet. ${label}. Tap to say hi.`}
            accessibilityElementsHidden={streetRoom}
            importantForAccessibility={streetRoom ? 'no-hide-descendants' : 'auto'}
            // Streetwear: the sprite box is mostly transparent and would cover
            // the room spots — touches pass through; the figure gets its own hit box below.
            pointerEvents={streetRoom ? 'box-none' : 'auto'}
            style={StyleSheet.absoluteFill}>
            <Animated.View pointerEvents={streetRoom ? 'none' : 'auto'} style={[StyleSheet.absoluteFill, bodyStyle]}>
              <Animated.View style={[StyleSheet.absoluteFill, hit.shakeStyle]}>
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
                animate={walkOn}
                recolor={revealed ? recolor : null}
                lockColour={revealed && pet.shiny}
                foilMotion="sweep"
                reduceMotion={motion.cosmeticsStill}
                reverseHost
                auraElement={auraElement}
                flash={hit.flash}
                hideoutFx={streetRoom}
              />
              </Animated.View>
            </Animated.View>
          </Pressable>
          {streetRoom ? (
            <Pressable
              onPress={onTapPet}
              accessibilityRole="button"
              accessibilityLabel={`Your pet. ${label}. Tap to say hi.`}
              style={{ position: 'absolute', left: box * 0.3, width: box * 0.4, top: footAt * box - box * 0.42, height: box * 0.42 }}
            />
          ) : null}
          {revealed && pet.shiny ? <ShinyOverlay size={box} groundAt={groundAt} animate={fxAnimate} style={pet.shiny_style} /> : null}
          {revealed && !pet.shiny && pet.glimmer ? <GlimmerGlow size={box} groundAt={groundAt} animate={fxAnimate} /> : null}
          {asleep ? <Text style={[styles.zzz, { left: box * 0.6, top: box * 0.25 }]}>💤</Text> : null}
          <Animated.View style={[styles.heart, { left: box / 2 - 16, top: box * 0.22 }, heartStyle]} pointerEvents="none">
            <AtlasSprite atlas="room" frame="heart" />
          </Animated.View>
          <View pointerEvents="none" style={{ position: 'absolute', right: -6, top: box * 0.4 }}>
            <Twinkle alive={fxAnimate} ms={700} rest={1}>
              <AtlasSprite atlas="room" frame="sparkle" />
            </Twinkle>
          </View>
          {streetRoom ? null : (
          <Animated.View
            pointerEvents="box-none"
            style={[styles.bubbleColumn, { bottom: box - box * 0.18 + 6, left: 0, width: speechW }, speechStyle]}>
            <SpeechBubble speech={speech} reduceMotion={motion.vestibularSafe} speaker={name} />
            <PixelNameplate label={false}>
              <View style={styles.nameRow}>
                {name ? <PixelLabel color={PIXEL.cyan}>{name}</PixelLabel> : null}
                {name ? <View style={styles.moodPip} /> : null}
                <PixelBody size="sm" color="#C7DCD0" numberOfLines={1}>
                  {plateStatus(status, pet.stage, stageLeftMs)}
                </PixelBody>
              </View>
            </PixelNameplate>
          </Animated.View>
          )}
          {streetRoom ? null : revealed && grade ? (
            <Animated.View
              pointerEvents="box-none"
              style={[styles.plateWrap, { top: footAt * box + PLATE_BELOW_FEET, left: 0, width: nameW }, plateStyle]}>
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
                  <PixelLabel color={GRADE_COLOR[grade]} numberOfLines={1} style={streetRoom ? styles.streetPlateGrade : undefined}>
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
      {streetRoom && hideoutScale ? (
        <StreetRoomAuraClip left={origin.left} top={origin.top} scale={hideoutScale} stageW={width} stageH={cover ? roomLayerH : Math.max(1, height - barReserve)} />
      ) : null}
      {streetRoom && hideoutScale && !hideoutStage ? (
        <StreetRoomFront left={origin.left} top={origin.top} scale={hideoutScale} feetX={feet.x} feetY={feet.y} night={night} gentle={motion.vestibularSafe} />
      ) : null}
      {width > 0 && streetSpots && hideoutScale && !picking && (!hideoutStage || hideoutStage.viewed === 'hideout') ? (
        <StreetRoomSpots
          {...streetSpots}
          left={origin.left}
          top={origin.top}
          scale={hideoutScale}
          still={motion.cosmeticsStill}
          gentle={motion.vestibularSafe}
          // Buttons stay put on their furniture: no dodging the pet (it made them jump on every redraw).
          petHit={null}
        />
      ) : null}
      {streetRoom && hideoutScale && speech ? (
        <Animated.View pointerEvents="none" style={[styles.speechAnchor, isoSpeechStyle]}>
          <StreetSpeechBubble text={speech.text} anchored width={speechBubbleW} />
        </Animated.View>
      ) : null}
      {width > 0 && hideoutStage && hideoutScale && !roomOutside ? (
        <HideoutStageControls
          hideout={hideoutStage.hideout}
          presence={hideoutStage.presence}
          viewed={hideoutStage.viewed}
          scale={hideoutScale}
          origin={origin}
          expeditionBackMs={hideoutStage.expeditionBackMs}
          onView={hideoutStage.onView}
          onCall={hideoutStage.onCall}
          coach={!hideoutStage.hideout.coach_swipe_seen}
          onCoachSeen={hideoutStage.onCoachSeen}
          controlsMode={controlsMode}
        />
      ) : null}
      </Animated.View>
      </View>

      {streetRoom ? null : (
      <View style={styles.coachSlot}>
      <PixelFrame streetPiece="panel" align="stretch" enter style={[styles.coach, streetRoom && styles.streetCoach]}>
        <Animated.View
          key={streetRoom ? coach.tip : 'coach'}
          entering={streetRoom && !reduceMotion ? FadeInDown.duration(STREET_MOTION.sheet) : undefined}
          style={styles.coachRow}>
          <View style={styles.coachCopy}>
            <PixelBody
              color={PIXEL.text}
              style={[styles.coachText, streetRoom && styles.streetCoachText]}
              numberOfLines={streetRoom ? 2 : 3}>
              {coach.tip}
            </PixelBody>
            {streetRoom ? null : (
              <PixelBody size="sm" color={PIXEL.dim} numberOfLines={1}>
                {pantry === 1 ? '1 treat left' : `${pantry} treats left`}
              </PixelBody>
            )}
          </View>
          {coach.button ? (
            <PixelButton
              label={coach.button}
              hug
              onPress={onCoach}
              width={coach.button.toLowerCase() === 'feed' ? PIXEL_FEED_W : undefined}
              height={streetRoom ? 44 : coach.button.toLowerCase() === 'feed' ? PIXEL_FEED_H : undefined}
              style={styles.coachButton}
            />
          ) : null}
        </Animated.View>
      </PixelFrame>
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  room: { flex: 1, minHeight: 0, backgroundColor: '#2e222f' },
  metersSlot: { flexGrow: 0, flexShrink: 0, paddingHorizontal: 8, paddingTop: 6, gap: 8 },
  stage: { flex: 1, minHeight: 0, overflow: 'hidden' },
  // Stage layout: the frame's fixed size (no flex leftover); the room layer slides inside it.
  stageFixed: { overflow: 'hidden' },
  roomLayer: { position: 'absolute', left: 0, right: 0, top: 0 },
  speechAnchor: { position: 'absolute', left: 0, top: 0, width: 0, height: 0 },
  coachSlot: { flexGrow: 0, flexShrink: 0, paddingHorizontal: 8, paddingBottom: 6 },
  buffChip: { alignSelf: 'flex-end' },
  foodChip: { flexGrow: 0 },
  plateWrap: { position: 'absolute', alignItems: 'center' },
  meters: { alignSelf: 'stretch' },
  streetMeters: { paddingHorizontal: 10, paddingVertical: 4 },
  // Street sizing: plates 13/12pt, coach 14pt.
  streetPlateName: { fontFamily: STREET_FONT.bold, fontSize: 13, lineHeight: 16 },
  streetPlateBody: { fontSize: 12, lineHeight: 15 },
  streetPlateGrade: { fontFamily: STREET_FONT.bold, fontSize: 12, lineHeight: 15 },
  streetCoachText: { fontSize: 14, lineHeight: 18 },
  streetCoach: { paddingHorizontal: 12 },
  streetBuffRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, marginTop: -2 },
  streetBuff: { maxWidth: '100%', flexShrink: 1, backgroundColor: 'rgba(26, 26, 29, 0.92)', borderWidth: 2, borderColor: '#000', paddingHorizontal: 8, paddingVertical: 2 },
  streetBuffText: { fontFamily: STREET_FONT.bold, fontSize: 12, lineHeight: 16, color: '#E0A526' },
  meterHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  meterMain: { flexGrow: 1, flexShrink: 1, minWidth: 180, gap: 4 },
  meterSide: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  meterBlock: { gap: 4 },
  meterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stageBadge: { flexGrow: 0 },
  coach: {},
  coachRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  coachCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 120, gap: 2 },
  coachText: { textAlign: 'left' },
  coachButton: { flexGrow: 0, flexShrink: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: ART_PT * 2 },
  moodPip: { width: ART_PT * 2, height: ART_PT * 2, backgroundColor: '#91DB69' },
  pressed: { opacity: 0.82 },
  petWrap: { position: 'absolute', left: 0 },
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
