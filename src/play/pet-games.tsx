/**
 * Pet mini-games (v20 → v25 harder → v26 Part C, 2026-09-30) — two short
 * vector rounds. Rules live in `pet-game-rules.ts`; records in game-records.ts.
 *
 *   Catch the food — food falls; tap it to catch it. Counts as feeding.
 *   Tap to train   — a marker sweeps a bar; tap inside the lit zone. Counts
 *                    as training.
 *
 * v26: a level (Easy / Normal / Hard / Insane), a combo multiplier shown big
 * (×2 / ×3 / ×5), a live score, and the pet ON SCREEN (existing clips only):
 *   - Catch: it stands at the bottom, dashes toward each catch and hops (a
 *     golden catch plays its skill clip: the happy beat); a bomb plays its hurt
 *     clip (or a red flash when it has none); at ×3 and up a soft glow lights up.
 *   - Train: a Streetwear punching bag is the training dummy; a hit plays the
 *     pet's attack clip and swings the bag; a miss plays "oof" (hurt) and makes
 *     it stumble; a perfect hit (the middle of the zone) plays its skill clip
 *     and adds a flash and a small shake.
 *   - M2 look: the pet wears its real grade / element aura, finish and shiny
 *     ring, as in the Hideout; the food, bomb and dummy are library sprites.
 *   - Reduced motion or Effects Low: still poses, no shake.
 * The daily challenge passes a seeded `rng`, so its pattern is fixed per date.
 * Each game reports once, when the round ends: the outcome and its score.
 *
 * Both rounds mount full screen (the Play sheet is only the hub). They share
 * one plate: Dive's top chrome, a framed stage that fills the safe area, and
 * a framed dock. Catch wears the Hideout's own room (wall, floor, neon);
 * Train wears the pet-room plate. Both are darkened so the food, the pet, and
 * the dummy stay in front. The path dither, dust and sparkle stay.
 */
import { Image } from 'expo-image';
import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Path, Polygon, RadialGradient, Stop } from 'react-native-svg';

import { ART, ROOM, getArtSource } from '@/art/art';
import { GAME_LABEL } from '@/play/game-records';
import { Flicker, MoteRise, Twinkle } from '@/play/pixel-ambient';
import { AtlasSprite, MOCKUP_ROOM, placePlate } from '@/play/pixel-atlas';
import { ART_PT, PIXEL, PIXEL_CAPTION_PT, pixelBodyLine, pixelRenderStyle } from '@/play/pixel-theme';
import { DitherPool, useHitJuice } from '@/play/pixel-fx';
import { PixelBody, PixelFrame, PixelLabel, usePixelFonts } from '@/play/pixel-ui';
import type { PetState } from '@/play/pet';
import type { Grade, ShinyStyle } from '@/play/pet-eggs';
import { GlimmerGlow, GradeAura, ShinyOverlay } from '@/play/pet-looks';
import { petPose, petPoseMs, type PetPose } from '@/play/pet-actor';
import { roleGroundAt } from '@/play/skin';
import { GameScreen, useStageFrame } from '@/play/stage-layout';
import { PetAnimSprite, type PetArt, type PetFace } from '@/play/pet-anim-sprite';
import type { PetWear } from '@/play/pet-cosmetics';
import { alertHaptic, rewardHaptic, tapHaptic } from '@/play/street-feel';
import {
  CATCH,
  COMBO_STEPS,
  DASH,
  DASH_LANES,
  EMPTY_CATCH,
  POWERUP,
  TRAIN,
  TRAIN_PERFECT_SHARE,
  catchFood,
  catchOutcome,
  catchPowerKind,
  catchScore,
  catchSpawnGapMs,
  catchSpawnKind,
  catchSpeedMult,
  comboMult,
  dailySeed,
  dashOutcome,
  dashReaches,
  dashScore,
  dashSpawnGapMs,
  dashSpawnKind,
  dashSpeedMult,
  magnetFood,
  missFood,
  seededRng,
  startTrain,
  tapBomb,
  trainOutcome,
  trainScore,
  trainTap,
  trainZoneHit,
  trainZoneMode,
  trainZoneSegments,
  type CatchTally,
  type Difficulty,
  type PowerKind,
  type RoundGame,
  type RoundOutcome,
  type SpawnKind,
  type TrainTally,
  type ZoneMode,
} from '@/play/pet-game-rules';

const TICK_MS = 40;
const GAME_PET_BOX = 64;

/** What the games need to draw the pet (existing art only). */
export type GamePet = {
  pet: PetState;
  art: PetArt;
  wear: PetWear;
  eggColor: string;
  recolor: string | null;
  /** Its glow colour (the Legend element / grade colour); lights up behind it at a ×3 combo. */
  glow: string;
  /** Its real look, as the Hideout draws it (M2): grade aura, shiny ring, glimmer, sword-element aura. */
  grade?: Grade | null;
  shiny?: boolean;
  shinyStyle?: ShinyStyle | null;
  glimmer?: boolean;
  auraElement?: string | null;
};

export type GameProps = {
  onDone: (outcome: RoundOutcome, score: number) => void;
  /** Back to the Pet room. The round does not count. */
  onBack: () => void;
  level?: Difficulty;
  /** Seeded for the daily challenge; Math.random otherwise. */
  rng?: () => number;
  gamePet?: GamePet | null;
  /** Reduced motion or Effects Low: still poses, no shake, ambient held. */
  still?: boolean;
  /**
   * M3 practice: no clock, no end, no strikes; it never calls `onDone`, so nothing
   * is counted (no tokens, care, record or daily). Leave with Back.
   */
  practice?: boolean;
};

/* ---------------------------------------------------------- the pet --- */

type Act = { pose: PetPose | null; face: PetFace; startedAt: number; loop: boolean };

/** The pet in a game: holds an idle loop, plays one-shots on request. */
function useGameActor(gp: GamePet | null | undefined) {
  const idle = gp ? petPose(gp.art.kit, 'idle') : null;
  const [act, setAct] = useState<Act>({ pose: idle, face: 'e', startedAt: Date.now(), loop: true });
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  // `skill` is the "happy" beat (a golden catch, a perfect hit); `hurt` is "oof". Both are existing clips.
  const play = (want: 'dash' | 'attack' | 'hurt' | 'skill', face: PetFace) => {
    if (!gp) return;
    const pose = petPose(gp.art.kit, want);
    if (!pose && want === 'skill') {
      play('dash', face); // a pet without a skill clip still moves for the happy beat
      return;
    }
    if (!pose) {
      // No such clip: a hurt is a red flash; anything else just faces.
      if (want === 'hurt') {
        setFlash(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setFlash(false), 260);
      }
      setAct((a) => ({ ...a, face }));
      return;
    }
    setAct({ pose, face, startedAt: Date.now(), loop: false });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setAct({ pose: idle, face, startedAt: Date.now(), loop: true }),
      petPoseMs(gp.art.kit, pose),
    );
  };
  return { act, flash, play };
}

/** The ×3-combo light behind the pet: a soft radial pool in its colour (not a flat square). */
function ComboGlow({ color, still }: { color: string; still: boolean }) {
  const r = GAME_PET_BOX * 0.7;
  return (
    <View pointerEvents="none" style={[styles.glow, still && styles.glowStill]}>
      <Svg width={r * 2} height={r * 2}>
        <Defs>
          <RadialGradient id="combo-glow" cx="50%" cy="55%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.6} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={r} cy={r} rx={r} ry={r} fill="url(#combo-glow)" />
      </Svg>
    </View>
  );
}

/**
 * Memoized: the games re-render every tick; the pet only when its act changes.
 * M2: the pet wears what it wears in the Hideout (grade aura, sword-element aura,
 * finish, shiny ring, glimmer), through the same `PetAnimSprite` + overlays.
 */
const GamePetSprite = memo(function GamePetSprite({
  gp,
  act,
  flash,
  still,
  glow,
}: {
  gp: GamePet;
  act: Act;
  flash: boolean;
  still: boolean;
  glow: boolean;
}) {
  const groundAt = gp.pet.stage === 'egg' ? 1 : roleGroundAt(gp.art.role);
  return (
    <View style={{ width: GAME_PET_BOX, height: GAME_PET_BOX }}>
      {glow ? <ComboGlow color={gp.glow} still={still} /> : null}
      <GradeAura grade={gp.grade ?? null} size={GAME_PET_BOX} animate={!still} trail={null} />
      <PetAnimSprite
        pet={gp.pet}
        art={gp.art}
        wear={gp.wear}
        eggColor={gp.eggColor}
        pose={act.pose}
        face={act.face}
        startedAt={act.startedAt}
        loop={act.loop}
        box={GAME_PET_BOX}
        animate={!still}
        recolor={gp.recolor}
        lockColour={gp.shiny === true}
        reduceMotion={still}
        auraElement={gp.auraElement ?? null}
      />
      {gp.shiny ? <ShinyOverlay size={GAME_PET_BOX} groundAt={groundAt} animate={!still} style={gp.shinyStyle ?? null} /> : null}
      {!gp.shiny && gp.glimmer ? <GlimmerGlow size={GAME_PET_BOX} groundAt={groundAt} animate={!still} /> : null}
      {flash ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.hurtFlash]} /> : null}
    </View>
  );
});

/** The big combo badge (only while ×2 or more). Departure Mono, hard shadow. */
function ComboBadge({ mult }: { mult: number }) {
  if (mult <= 1) return null;
  return (
    <View pointerEvents="none" style={styles.combo} accessibilityLabel={`Combo times ${mult}`}>
      <PixelLabel
        color={mult >= 5 ? PIXEL.amberHi : PIXEL.amber}
        numberOfLines={1}
        accessibilityRole="text"
        style={mult >= 5 ? styles.comboTop : undefined}>
        {`×${mult} COMBO`}
      </PixelLabel>
    </View>
  );
}

/* ------------------------------------------------------- shared plate --- */

/** Night wall, so a cropped room plate does not fall back to a flat colour. */
const DOJO = '#140E1C';
/** Ink over the plate. The actors sit above this, so they stay the bright layer. */
const SCRIM = 'rgba(5,7,13,0.42)';
/** Catch's room is the Hideout's own, so the scrim can be lighter (the food has a dark outline). */
const CATCH_SCRIM = 'rgba(5,7,13,0.3)';

/**
 * The Catch room is the Hideout's wall, floor and neon glow at the Hideout's own
 * scale (1 pt per art px, no furniture: nothing sits where the food falls).
 */
const CATCH_ROOM_W = 352;
const CATCH_ROOM_H = 576;
const CATCH_ROOM_LAYERS = [getArtSource(ROOM.hideout.back), getArtSource(ROOM.hideout.floor)] as const;
const CATCH_ROOM_NEON = getArtSource(ROOM.hideout.neonA);

/** Room dust, in shares of the stage. */
const ARENA_MOTES = [
  { x: 0.14, y: 0.42, ms: 3600, delay: 0 },
  { x: 0.76, y: 0.34, ms: 4200, delay: 700 },
  { x: 0.38, y: 0.58, ms: 3900, delay: 1400 },
] as const;

/**
 * Stage atmosphere. DitherPool is one path of Bayer cells (not an SVG
 * Pattern). Dust and the sparkle are the room's. `alive` is false under Reduce
 * Motion and Effects Low: the pool holds, the sparkle rests, particles are not mounted.
 */
type ArenaKind = RoundGame;

/**
 * The Hideout's wall, floor and neon glow behind Catch: top-anchored so the brick
 * and the window show above the floor the pet stands on; a tall stage anchors the
 * floor's end to the bottom instead. Crops left and right when the stage is narrow.
 */
function CatchRoom({ width, height }: { width: number; height: number }) {
  // Uniform scale (never stretched): 1 on a normal phone, a little more on a wide stage so no bare band shows at the sides.
  const s = Math.max(1, width / CATCH_ROOM_W);
  const w = Math.ceil(CATCH_ROOM_W * s);
  const h = Math.ceil(CATCH_ROOM_H * s);
  const left = Math.round((width - w) / 2);
  const top = height > h - 16 ? Math.round(height - h) : 0;
  const frame = { position: 'absolute' as const, left, top, width: w, height: h, ...pixelRenderStyle };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {CATCH_ROOM_LAYERS.map((src, i) =>
        src ? <Image key={i} source={src} contentFit="fill" style={frame} /> : null,
      )}
      {CATCH_ROOM_NEON ? <Image source={CATCH_ROOM_NEON} contentFit="fill" style={[frame, styles.roomNeon]} /> : null}
    </View>
  );
}

/**
 * The place behind the round. Catch wears the Hideout's room (above).
 * Train clips the pet room (window, lamp, brick). A short stage hides the
 * ceiling, so the window and lamp glow are pinned when the crop cuts them off.
 * An ink scrim sits on the art; the pet, food, and dummy do not.
 */
function ArenaDressing({
  kind,
  alive,
  width,
  height,
}: {
  kind: ArenaKind;
  alive: boolean;
  width: number;
  height: number;
}) {
  if (width < 8 || height < 8) return null;
  if (kind === 'catch' || kind === 'dash') {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <CatchRoom width={width} height={height} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: CATCH_SCRIM }]} />
      </View>
    );
  }
  const k = ART_PT;
  const origin = placePlate(width, height, MOCKUP_ROOM.feet, 16);
  const artTop = Math.max(0, -origin.top / k);
  const pinCeiling = artTop > MOCKUP_ROOM.sky.y;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', left: origin.left, top: origin.top }}>
        <AtlasSprite atlas="room" frame="plate" />
        <View style={{ position: 'absolute', left: MOCKUP_ROOM.glow.x * k, top: MOCKUP_ROOM.glow.y * k }}>
          <Flicker alive={alive} peak={0.55} ms={480}>
            <AtlasSprite atlas="room" frame="glow" />
          </Flicker>
        </View>
        <View style={{ position: 'absolute', left: MOCKUP_ROOM.sky.x * k, top: MOCKUP_ROOM.sky.y * k }}>
          <Twinkle alive={alive} ms={1100} rest={1}>
            <AtlasSprite atlas="room" frame="sky" />
          </Twinkle>
        </View>
      </View>
      <View style={{ position: 'absolute', left: 6, bottom: 6 }}>
        <AtlasSprite atlas="dive" frame="crate" />
      </View>
      <View style={{ position: 'absolute', left: 34, bottom: 16 }}>
        <AtlasSprite atlas="dive" frame="crate-small" />
      </View>
      <View style={{ position: 'absolute', right: 8, bottom: 8 }}>
        <AtlasSprite atlas="dive" frame="chest" />
      </View>
      {pinCeiling ? (
        <>
          <View style={{ position: 'absolute', left: 10, top: 8 }}>
            <Twinkle alive={alive} ms={1100} rest={1}>
              <AtlasSprite atlas="room" frame="sky" />
            </Twinkle>
          </View>
          <View style={styles.lampClip}>
            <Flicker alive={alive} peak={0.5} ms={520}>
              <AtlasSprite atlas="room" frame="glow" scale={1} />
            </Flicker>
          </View>
        </>
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} />
    </View>
  );
}

function ArenaAmbient({
  kind,
  alive,
  width,
  height,
}: {
  kind: ArenaKind;
  alive: boolean;
  width: number;
  height: number;
}) {
  if (width < 8 || height < 8) return null;
  const k = ART_PT;
  const artW = Math.max(8, Math.round(width / k));
  const artH = Math.max(8, Math.round(height / k));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <DitherPool
        alive={alive}
        cx={Math.round(artW / 2)}
        cy={Math.max(8, artH - 12)}
        rx={Math.max(12, Math.round(artW * 0.42))}
        ry={14}
        color={PIXEL.amber}
        lit={2}
        gain={kind === 'train' ? 0.28 : 0.2}
      />
      {ARENA_MOTES.map((m, i) => (
        <MoteRise
          key={`m${i}`}
          alive={alive}
          left={m.x * width}
          top={m.y * height}
          distance={28 + i * 10}
          ms={m.ms}
          delay={m.delay}>
          <AtlasSprite atlas="room" frame="mote" />
        </MoteRise>
      ))}
      <View style={{ position: 'absolute', left: width * 0.62, top: height * 0.16 }}>
        <Twinkle alive={alive} ms={900} rest={1}>
          <AtlasSprite atlas="room" frame="sparkle" />
        </Twinkle>
      </View>
    </View>
  );
}

/**
 * Full-screen minigame, the same stack as Dive: top chrome, a stage that
 * takes the leftover safe-area height, and a framed dock.
 */
function GamePlate({
  kind,
  title,
  score,
  status,
  onBack,
  alive,
  dock,
  children,
  style,
}: {
  kind: ArenaKind;
  title: string;
  score: string;
  status: string;
  onBack: () => void;
  alive: boolean;
  dock: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  usePixelFonts();
  const { width: screenW } = useWindowDimensions();
  const [box, setBox] = useState({ width: 0, height: 0 });
  // Stage layout: the playfield's region is fixed from the frame (fullscreen arena).
  const frame = useStageFrame('pet-game');
  const labelPt = screenW < 400 ? 13 : 16;
  const label = { fontSize: labelPt, lineHeight: labelPt + 4 };
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };
  return (
    <Animated.View style={[styles.screen, style]}>
      <GameScreen
        frame={frame}
        help="pet-game"
        background={PIXEL.ink}
        topBar={
      <View style={styles.top}>
        <PixelFrame streetPiece="panel" align="stretch" padded={false} enter>
          <View style={styles.topPad}>
            <View style={styles.topRow}>
              <Pressable
                onPress={onBack}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Back to the Pet room"
                style={styles.backHit}>
                <PixelLabel color={PIXEL.cyan} numberOfLines={1} style={label}>
                  {'< Pet'}
                </PixelLabel>
              </Pressable>
              <PixelLabel numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.topTitle, label]}>
                {title}
              </PixelLabel>
              <View style={styles.scoreSlot}>
                <PixelBody size="sm" color={PIXEL.amber} numberOfLines={1}>
                  {score}
                </PixelBody>
              </View>
            </View>
            <PixelBody size="sm" color={PIXEL.dim} numberOfLines={1} style={styles.statusLine}>
              {status}
            </PixelBody>
          </View>
        </PixelFrame>
      </View>
        }
        stage={
      <View style={styles.stageWrap}>
        <PixelFrame align="stretch" padded={false} glow fill={DOJO} border={PIXEL.cyan} grow>
          <View style={styles.stage} onLayout={onLayout}>
            <ArenaDressing kind={kind} alive={alive} width={box.width} height={box.height} />
            <ArenaAmbient kind={kind} alive={alive} width={box.width} height={box.height} />
            {children}
          </View>
        </PixelFrame>
      </View>
        }
        dock={
      <View style={styles.dock}>
        <PixelFrame streetPiece="panel" align="stretch" padded={false}>
          <View style={styles.dockPad}>{dock}</View>
        </PixelFrame>
      </View>
        }
      />
    </Animated.View>
  );
}

/* ------------------------------------------- countdown, pops, result card --- */

const COUNT_STEP_MS = 700;

/** What the result card says once the round is counted (built by the Pet room). */
export type RoundCardData = { pass: boolean; strong: boolean; lines: string[] };

/**
 * 3-2-1 before a round. Returns the number on screen (0 = go), so the game
 * starts its clock only when it hits 0. Under `still` it is the same count
 * without the pulse.
 */
function useCountdown(): number {
  const [n, setN] = useState(3);
  useEffect(() => {
    if (n <= 0) return;
    const id = setTimeout(() => setN((v) => v - 1), COUNT_STEP_MS);
    return () => clearTimeout(id);
  }, [n]);
  return n;
}

/** The big 3-2-1, over the stage (a float layer: no region resizes). */
function CountdownVeil({ n, still }: { n: number; still: boolean }) {
  const s = useSharedValue(1);
  useEffect(() => {
    if (still || n <= 0) return;
    s.value = 1.5;
    s.value = withTiming(1, { duration: COUNT_STEP_MS - 100, easing: Easing.out(Easing.quad) });
  }, [n, still, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  if (n <= 0) return null;
  return (
    <View pointerEvents="none" style={styles.countVeil} accessibilityLiveRegion="polite" accessibilityLabel={`Starting in ${n}`}>
      <Animated.View style={style}>
        <PixelLabel color={PIXEL.amberHi} numberOfLines={1} style={styles.countText}>
          {`${n}`}
        </PixelLabel>
      </Animated.View>
    </View>
  );
}

/** A "+n" that floats up and fades where the score came from. */
type Pop = { id: number; left: number; top: number; text: string };
const POP_MS = 700;

function PopText({ pop, still }: { pop: Pop; still: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!still) p.value = withTiming(1, { duration: POP_MS, easing: Easing.out(Easing.quad) });
  }, [p, still]);
  const style = useAnimatedStyle(() => ({ opacity: 1 - p.value * p.value, transform: [{ translateY: -28 * p.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.pop, { left: pop.left, top: pop.top }, style]}>
      <PixelLabel color={PIXEL.amberHi} numberOfLines={1}>
        {pop.text}
      </PixelLabel>
    </Animated.View>
  );
}

/** Pops that clean themselves up (timers cleared on unmount). */
function usePops() {
  const [pops, setPops] = useState<Pop[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  useEffect(() => {
    const live = timers.current;
    return () => {
      live.forEach(clearTimeout);
      live.clear();
    };
  }, []);
  const add = (left: number, top: number, text: string) => {
    const id = idRef.current++;
    setPops((p) => [...p.slice(-5), { id, left, top, text }]);
    const t = setTimeout(() => {
      timers.current.delete(t);
      setPops((p) => p.filter((x) => x.id !== id));
    }, POP_MS + 60);
    timers.current.add(t);
  };
  return { pops, add };
}

/** Combo progress to the next tier (a thin fixed-height strip; full at the top tier). */
function ComboStrip({ game, streak }: { game: RoundGame; streak: number }) {
  const [a, b, c] = COMBO_STEPS[game];
  const bounds = [0, a, b, c];
  const tier = streak >= c ? 3 : streak >= b ? 2 : streak >= a ? 1 : 0;
  const frac = tier === 3 ? 1 : (streak - bounds[tier]) / (bounds[tier + 1] - bounds[tier]);
  return (
    <View
      pointerEvents="none"
      style={styles.comboStrip}
      accessibilityLabel={tier === 3 ? 'Combo at the top' : `Combo progress ${streak} of ${bounds[tier + 1]}`}>
      <View style={[styles.comboFill, { width: `${Math.round(frac * 100)}%` }, tier === 3 && styles.comboFillTop]} />
    </View>
  );
}

/** The result card, over the finished game: what it paid, the medal and the record. */
function RoundCard({ card, still, onContinue }: { card: RoundCardData; still: boolean; onContinue: () => void }) {
  useEffect(() => {
    if (!still && card.pass) rewardHaptic();
  }, [card.pass, still]);
  return (
    <View style={styles.cardVeil} accessibilityViewIsModal>
      <PixelFrame align="stretch" padded={false} glow={card.strong} fill={PIXEL.ink} border={card.pass ? PIXEL.amber : PIXEL.cyan}>
        <View style={styles.cardPad}>
          <PixelLabel color={card.pass ? PIXEL.amberHi : PIXEL.cyan} numberOfLines={1} accessibilityRole="header">
            {card.pass ? 'ROUND PASSED' : 'NOT THIS TIME'}
          </PixelLabel>
          {card.lines.map((l, i) => (
            <PixelBody key={i} size="sm" color={i === 0 ? PIXEL.text : PIXEL.dim} style={styles.cardLine}>
              {l}
            </PixelBody>
          ))}
          <Pressable
            onPress={onContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue"
            style={({ pressed }) => [{ width: '100%', minHeight: 56, opacity: pressed ? 0.92 : 1 }]}>
            {({ pressed }) => (
              <PixelFrame
                fill={PIXEL.cyan}
                border={PIXEL.ink}
                bevel="cyan"
                sunk={pressed}
                glow={false}
                lined={false}
                padded={false}
                align="center"
                minHeight={56}
                style={{ width: '100%', height: 56 }}>
                <PixelLabel color={PIXEL.onFill} shadowColor={PIXEL.cyanLo} numberOfLines={1}>
                  CONTINUE
                </PixelLabel>
              </PixelFrame>
            )}
          </Pressable>
        </View>
      </PixelFrame>
    </View>
  );
}

/** Catch or Train, full screen. The daily pattern is seeded once per mount. */
export function PetGameHost({
  kind,
  level,
  daily,
  practice = false,
  ymd,
  gamePet,
  still,
  card = null,
  onContinue,
  onBack,
  onDone,
}: {
  kind: RoundGame;
  level: Difficulty;
  daily: boolean;
  practice?: boolean;
  ymd: string;
  gamePet: GamePet | null;
  still: boolean;
  /** Set once the round is counted: the result card shows over the finished game. */
  card?: RoundCardData | null;
  onContinue: () => void;
  onBack: () => void;
  onDone: (outcome: RoundOutcome, score: number) => void;
}) {
  const rngRef = useRef<(() => number) | null>(null);
  if (rngRef.current == null) rngRef.current = daily ? seededRng(dailySeed(ymd, kind)) : Math.random;
  const props: GameProps = { onDone, onBack, level, rng: rngRef.current, gamePet, still, practice };
  return (
    <View style={styles.hostFill}>
      {kind === 'catch' ? <CatchFoodGame {...props} /> : kind === 'dash' ? <LaneDashGame {...props} /> : <TapTrainGame {...props} />}
      {card ? <RoundCard card={card} still={still} onContinue={onContinue} /> : null}
    </View>
  );
}

/* ------------------------------------------------------ Catch the food --- */

export const CATCH_ROUND_MS = CATCH.roundMs;
const FOOD_SIZE = 40;
const FOOD_COLORS = ['#FF6B6B', '#FFD86B', '#7CE38B'] as const;

type ItemKind = SpawnKind | PowerKind;
type Food = { id: number; x: number; y: number; speed: number; color: string; kind: ItemKind };

/** A pickup's shapes: a shield (library sprite) and a horseshoe magnet (drawn), each in a cyan ring so neither reads as food or a bomb. */
const SHIELD_SPRITE = getArtSource(ART.icon.streetwear.shield);

function PowerShape({ kind }: { kind: PowerKind }) {
  return (
    <View style={styles.foodArt}>
      <Svg width={FOOD_SIZE} height={FOOD_SIZE} viewBox="0 0 40 40" style={StyleSheet.absoluteFill}>
        <Circle cx={20} cy={20} r={18} fill="rgba(5,7,13,0.55)" stroke="#5CE1FF" strokeWidth={2.5} />
        {kind === 'magnet' ? (
          <>
            <Path d="M12 10 V22 A8 8 0 0 0 28 22 V10" stroke="#FF3B5C" strokeWidth={6} fill="none" />
            <Path d="M12 10 V15 M28 10 V15" stroke="#EAF6FF" strokeWidth={6} fill="none" />
          </>
        ) : null}
      </Svg>
      {kind === 'shield' && SHIELD_SPRITE ? (
        <Image source={SHIELD_SPRITE} contentFit="contain" style={styles.powerImg} />
      ) : null}
    </View>
  );
}

/** What is active, over the stage (an absolute chip row: no region resizes). */
function PowerChips({ shield, magnetSec }: { shield: boolean; magnetSec: number }) {
  if (!shield && magnetSec <= 0) return null;
  return (
    <View
      pointerEvents="none"
      style={styles.powerChips}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${shield ? 'Shield ready. ' : ''}${magnetSec > 0 ? `Magnet ${magnetSec} seconds` : ''}`}>
      {shield ? (
        <PixelLabel color={PIXEL.cyan} numberOfLines={1}>
          SHIELD
        </PixelLabel>
      ) : null}
      {magnetSec > 0 ? (
        <PixelLabel color={PIXEL.amberHi} numberOfLines={1}>
          {`MAGNET ${magnetSec}s`}
        </PixelLabel>
      ) : null}
    </View>
  );
}

/** A five-point star (golden food), so it reads by shape as well as colour. */
const STAR_POINTS = Array.from({ length: 10 }, (_, i) => {
  const a = (-90 + i * 36) * (Math.PI / 180);
  const r = i % 2 === 0 ? 17 : 7.5;
  return `${(20 + r * Math.cos(a)).toFixed(1)},${(22 + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');

/** Streetwear food (pizza, donut, burger), one per FOOD_COLORS slot; golden is the library star, the bomb the library bomb. */
const FOOD_SPRITES = [ART.icon.streetwear.pizza, ART.icon.streetwear.donut, ART.icon.streetwear.burger].map((id) => getArtSource(id));
const STAR_SPRITE = getArtSource(ART.icon.streetwear.star);
const BOMB_SPRITE = getArtSource(ART.icon.streetwear.bomb);

/**
 * Normal food is a snack sprite; golden is the star sprite on a pale star halo, so it
 * reads by shape as well as colour; the bomb keeps its own shape + a red X.
 */
function FoodShape({ color, golden = false }: { color: string; golden?: boolean }) {
  if (golden) {
    return (
      <View style={styles.foodArt}>
        <Svg width={FOOD_SIZE} height={FOOD_SIZE} viewBox="0 0 40 40" style={StyleSheet.absoluteFill}>
          <Polygon points={STAR_POINTS} fill="#FFF3B0" fillOpacity={0.5} stroke="#FFF3B0" strokeWidth={4} strokeLinejoin="round" />
        </Svg>
        {STAR_SPRITE ? <Image source={STAR_SPRITE} contentFit="contain" style={styles.foodImg} /> : null}
      </View>
    );
  }
  const sprite = FOOD_SPRITES[Math.max(0, FOOD_COLORS.indexOf(color as (typeof FOOD_COLORS)[number]))];
  return sprite ? <Image source={sprite} contentFit="contain" style={styles.foodImg} /> : null;
}

/** The bomb: the library bomb with a red X over its body (a shape cue that survives greyscale; not the emoji). */
function BombShape() {
  return (
    <View style={styles.foodArt}>
      {BOMB_SPRITE ? <Image source={BOMB_SPRITE} contentFit="contain" style={styles.foodImg} /> : null}
      <Svg width={FOOD_SIZE} height={FOOD_SIZE} viewBox="0 0 40 40" style={StyleSheet.absoluteFill}>
        <Path d="M12 22 L24 34 M24 22 L12 34" stroke="#05070D" strokeWidth={6} strokeLinecap="round" />
        <Path d="M12 22 L24 34 M24 22 L12 34" stroke="#FF3B5C" strokeWidth={3.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

/**
 * One falling item. The fall runs on the UI thread (one linear timing from the
 * spawn to past the floor), so the field is not re-rendered every tick; the
 * game's own clock still decides misses.
 */
const FoodItem = memo(function FoodItem({
  f,
  boxW,
  boxH,
  onPress,
}: {
  f: Food;
  boxW: number;
  boxH: number;
  onPress: (id: number) => void;
}) {
  const y = useSharedValue(f.y);
  useEffect(() => {
    y.value = withTiming(1.05, { duration: ((1.05 - f.y) / f.speed) * 1000, easing: Easing.linear });
    // The fall is fixed at spawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fall = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * Math.max(0, boxH - FOOD_SIZE) }] }));
  return (
    <Animated.View style={[styles.food, { left: f.x * (boxW - FOOD_SIZE) }, fall]}>
      <Pressable
        onPressIn={() => onPress(f.id)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          f.kind === 'bomb'
            ? 'Bomb — don’t tap'
            : f.kind === 'golden'
              ? 'Golden star food'
              : f.kind === 'shield'
                ? 'Shield power-up'
                : f.kind === 'magnet'
                  ? 'Magnet power-up'
                  : 'Catch food'
        }
        style={styles.foodHit}>
        {f.kind === 'bomb' ? (
          <BombShape />
        ) : f.kind === 'shield' || f.kind === 'magnet' ? (
          <PowerShape kind={f.kind} />
        ) : (
          <FoodShape color={f.kind === 'golden' ? '#FFD700' : f.color} golden={f.kind === 'golden'} />
        )}
      </Pressable>
    </Animated.View>
  );
});

export function CatchFoodGame({ onDone, onBack, level = 'normal', rng = Math.random, gamePet = null, still = false, practice = false }: GameProps) {
  usePixelFonts();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const boxRef = useRef(box);
  boxRef.current = box;
  // M3 power-ups: a shield absorbs the next bomb tap; a magnet collects falling food for a few seconds (score-only).
  const [shield, setShield] = useState(false);
  const [magnetSec, setMagnetSec] = useState(0);
  const shieldRef = useRef(false);
  const magnetUntilRef = useRef(0);
  const [items, setItems] = useState<Food[]>([]);
  const [tally, setTally] = useState<CatchTally>(EMPTY_CATCH);
  const [leftSec, setLeftSec] = useState<number>(Math.ceil(CATCH.roundMs / 1000));
  const [bombFlash, setBombFlash] = useState(false);
  const bombTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdown = useCountdown();
  const { pops, add: addPop } = usePops();
  const petWobble = useSharedValue(0);
  const petSquash = useSharedValue(1);
  const itemsRef = useRef<Food[]>([]);
  const tallyRef = useRef<CatchTally>(EMPTY_CATCH);
  const elapsedRef = useRef(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const rngRef = useRef(rng);
  const { act, flash, play } = useGameActor(gamePet);
  const petX = useSharedValue(0.5);
  const petHop = useSharedValue(0);
  const juice = useHitJuice();

  const setT = (next: CatchTally) => {
    tallyRef.current = next;
    setTally(next);
  };
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    itemsRef.current = [];
    setItems([]);
    onDoneRef.current(catchOutcome(tallyRef.current), catchScore(tallyRef.current, level));
  };

  useEffect(
    () => () => {
      if (bombTimer.current) clearTimeout(bombTimer.current);
    },
    [],
  );

  // The clock starts when the 3-2-1 is over; the seeded pattern is drawn only from here.
  const playing = countdown <= 0;
  useEffect(() => {
    if (!playing) return;
    let nextId = 0;
    let sinceSpawn = 0;
    const r = rngRef.current;
    const id = setInterval(() => {
      if (doneRef.current) return;
      elapsedRef.current += TICK_MS;
      const elapsed = elapsedRef.current;
      sinceSpawn += TICK_MS;
      // Practice holds the ramp at its middle, so a long session never outruns the player.
      const ramp = practice ? Math.min(elapsed, CATCH.roundMs / 2) : elapsed;
      const magnetOn = magnetUntilRef.current > elapsed;
      let missed = 0;
      let dodged = 0;
      const pulled: Food[] = [];
      let next = itemsRef.current
        .map((f) => ({ ...f, y: f.y + (f.speed * TICK_MS) / 1000 }))
        .filter((f) => {
          // Magnet: food past the pull line is collected (score only; not caught, not missed).
          if (magnetOn && (f.kind === 'food' || f.kind === 'golden') && f.y >= POWERUP.magnetFromY && f.y < 1.05) {
            pulled.push(f);
            return false;
          }
          if (f.y < 1.05) return true;
          if (f.kind === 'food' || f.kind === 'golden') missed += 1; // food that fell past = a miss
          else if (f.kind === 'bomb') dodged += 1; // a bomb that fell past = a near-miss for the pet
          return false; // a pickup that fell past is just gone
        });
      let spawned = false;
      if (sinceSpawn >= catchSpawnGapMs(ramp, level) && (practice || elapsed < CATCH.roundMs - 800)) {
        sinceSpawn = 0;
        let kind: ItemKind = catchSpawnKind(ramp, r(), level);
        if (kind === 'food') kind = catchPowerKind(ramp, r()) ?? 'food';
        const speed = (0.32 + r() * 0.08) * catchSpeedMult(ramp, level);
        next = [...next, { id: nextId++, x: 0.08 + r() * 0.84, y: -0.1, speed, kind, color: FOOD_COLORS[nextId % FOOD_COLORS.length] }];
        spawned = true;
      }
      itemsRef.current = next;
      // Only a spawn or a fall-through changes what is mounted; the fall itself is on the UI thread.
      if (spawned || missed + dodged > 0) setItems(next);
      if (pulled.length > 0) {
        let t = tallyRef.current;
        for (const f of pulled) {
          const before = catchScore(t, level);
          t = magnetFood(t, f.kind === 'golden');
          const gained = catchScore(t, level) - before;
          const b = boxRef.current;
          if (gained > 0) addPop(f.x * (b.width - FOOD_SIZE), f.y * Math.max(0, b.height - FOOD_SIZE), `+${gained}`);
        }
        setT(t);
        setItems(next);
        if (!still) tapHaptic();
      }
      if (missed > 0) {
        let t = tallyRef.current;
        for (let i = 0; i < missed; i += 1) t = missFood(t);
        setT(t);
      }
      setMagnetSec(magnetOn ? Math.ceil((magnetUntilRef.current - elapsed) / 1000) : 0);
      if (dodged > 0 && !still) {
        petWobble.value = withSequence(
          withTiming(-7, { duration: 60 }),
          withTiming(7, { duration: 90 }),
          withTiming(-4, { duration: 80 }),
          withTiming(0, { duration: 70 }),
        );
      }
      const left = Math.max(0, CATCH.roundMs - elapsed);
      if (!practice) setLeftSec(Math.ceil(left / 1000));
      if (!practice && left <= 0) finish();
    }, TICK_MS);
    return () => clearInterval(id);
    // The round's level and rng are fixed for its whole life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const tapItem = (itemId: number) => {
    if (doneRef.current) return;
    const item = itemsRef.current.find((f) => f.id === itemId);
    if (!item) return;
    itemsRef.current = itemsRef.current.filter((f) => f.id !== itemId);
    setItems(itemsRef.current);
    const spot = { left: item.x * (box.width - FOOD_SIZE), top: item.y * Math.max(0, box.height - FOOD_SIZE) };
    if (item.kind === 'shield' || item.kind === 'magnet') {
      if (item.kind === 'shield') {
        shieldRef.current = true;
        setShield(true);
      } else {
        magnetUntilRef.current = elapsedRef.current + POWERUP.magnetMs;
        setMagnetSec(Math.ceil(POWERUP.magnetMs / 1000));
      }
      addPop(spot.left, spot.top, item.kind === 'shield' ? 'SHIELD' : 'MAGNET');
      if (!still) rewardHaptic();
      return;
    }
    if (item.kind === 'bomb' && shieldRef.current) {
      // The shield takes the hit: no strike, no penalty, the streak holds.
      shieldRef.current = false;
      setShield(false);
      addPop(spot.left, spot.top, 'BLOCKED');
      if (!still) tapHaptic();
      return;
    }
    if (item.kind === 'bomb') {
      const scoreBefore = catchScore(tallyRef.current, level);
      const hit = tapBomb(tallyRef.current);
      // Practice has no strikes: the round never ends on bombs.
      const next = practice ? { ...hit, strikes: 0, over: false } : hit;
      setT(next);
      setBombFlash(true);
      if (bombTimer.current) clearTimeout(bombTimer.current);
      bombTimer.current = setTimeout(() => setBombFlash(false), 80);
      play('hurt', 'front');
      if (!still) {
        juice.play();
        alertHaptic();
      }
      const lost = scoreBefore - catchScore(next, level);
      if (lost > 0) addPop(item.x * (box.width - FOOD_SIZE), item.y * Math.max(0, box.height - FOOD_SIZE), `−${lost}`);
      if (next.over && !practice) finish();
      return;
    }
    const before = catchScore(tallyRef.current, level);
    const next = catchFood(tallyRef.current, elapsedRef.current, item.kind === 'golden');
    setT(next);
    const gained = catchScore(next, level) - before;
    if (gained > 0) addPop(item.x * (box.width - FOOD_SIZE), item.y * Math.max(0, box.height - FOOD_SIZE), `+${gained}`);
    // The pet dashes toward the catch and hops.
    const toward = Math.max(0.08, Math.min(0.92, item.x + 0.04));
    play(item.kind === 'golden' ? 'skill' : 'dash', toward < petX.value ? 'w' : 'e');
    if (!still) {
      if (item.kind === 'golden') rewardHaptic();
      else tapHaptic();
      petX.value = withTiming(toward, { duration: 220, easing: Easing.out(Easing.quad) });
      petHop.value = withSequence(withTiming(-12, { duration: 120 }), withTiming(0, { duration: 180, easing: Easing.bounce }));
      petSquash.value = withSequence(withTiming(1.18, { duration: 80 }), withTiming(1, { duration: 140 }));
    } else {
      petX.value = toward;
    }
  };

  const petStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: petX.value * Math.max(0, box.width - GAME_PET_BOX) },
      { translateY: petHop.value },
      { rotate: `${petWobble.value}deg` },
      { scale: petSquash.value },
    ],
  }));
  const mult = comboMult('catch', tally.chain);
  const onField = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  return (
    <GamePlate
      kind="catch"
      title={GAME_LABEL.catch}
      score={`${catchScore(tally, level)}`}
      status={
        practice
          ? `practice · caught ${tally.caught} · best streak ${tally.bestChain}`
          : `caught ${tally.caught} · 💣 ${tally.strikes}/${CATCH.bombStrikes} · ${leftSec}s`
      }
      onBack={onBack}
      alive={!still}
      dock={
        <PixelBody size="sm" numberOfLines={3} style={styles.hint}>
          {practice
            ? 'Practice: no clock, no strikes, nothing counts. Shield blocks a 💣, magnet pulls food in. Back to leave.'
            : `Catch half of the food to pass. Golden = +${CATCH.goldenPoints}. A miss or a 💣 resets the combo; ${CATCH.bombStrikes} 💣 end it. Magnet food scores but is not caught.`}
        </PixelBody>
      }>
      <View style={styles.playfield} onLayout={onField}>
        {gamePet && box.width > 0 ? (
          <Animated.View pointerEvents="none" style={[styles.catchPet, petStyle]}>
            <Animated.View style={juice.shakeStyle}>
              <GamePetSprite gp={gamePet} act={act} flash={flash} still={still} glow={mult >= 3} />
            </Animated.View>
          </Animated.View>
        ) : null}
        {box.width > 0
          ? items.map((f) => <FoodItem key={f.id} f={f} boxW={box.width} boxH={box.height} onPress={tapItem} />)
          : null}
        {bombFlash ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.bombFlash]} /> : null}
        <ComboStrip game="catch" streak={tally.chain} />
        <PowerChips shield={shield} magnetSec={magnetSec} />
        <ComboBadge mult={mult} />
        {pops.map((p) => (
          <PopText key={p.id} pop={p} still={still} />
        ))}
        <CountdownVeil n={countdown} still={still} />
      </View>
    </GamePlate>
  );
}

/* -------------------------------------------------------- Tap to train --- */

export const TRAIN_REPS = TRAIN.taps;
/** Where a Train "+n" floats up from (over the crate side of the floor). */
const TRAIN_POP_X = 190;
const TRAIN_POP_Y = 60;
/** The Train dummy: the library's Streetwear punching bag (it hangs, so it swings from the top). */
const DUMMY_ART = getArtSource(ART.prop.streetwear.punchingBag);
const DUMMY_SIZE = 64;

function randomZone(width: number, r: () => number): number {
  return width / 2 + 0.05 + r() * (1 - width - 0.1);
}

export function TapTrainGame({ onDone, onBack, level = 'normal', rng = Math.random, gamePet = null, still = false, practice = false }: GameProps) {
  usePixelFonts();
  const start = startTrain(level);
  // The marker runs on a shared value (no re-render per tick); `markerRef` is the logical position for hit tests.
  const markerSv = useSharedValue(0);
  const [barW, setBarW] = useState(0);
  const countdown = useCountdown();
  const { pops, add: addPop } = usePops();
  const [tally, setTally] = useState<TrainTally>(start);
  const rngRef = useRef(rng);
  const [flash, setFlashState] = useState<'hit' | 'perfect' | 'miss' | null>(null);
  const markerRef = useRef(0);
  const dirRef = useRef(1);
  const tallyRef = useRef<TrainTally>(start);
  // M3: the lit zone is one segment, a drifting segment, or two half-width segments. The base centre is re-rolled
  // after every tap; the segments live on shared values (no re-render per tick), `segsRef` is the logical hit test.
  // Lazy: the seeded daily rng takes exactly one draw here, however often the screen re-renders.
  const baseRef = useRef<number>(-1);
  if (baseRef.current < 0) baseRef.current = randomZone(start.zone, rngRef.current);
  const stillRef = useRef(still);
  stillRef.current = still;
  const modeRef = useRef<ZoneMode>('single');
  const phaseRef = useRef(0);
  const practiceTapsRef = useRef(0);
  const segsRef = useRef(trainZoneSegments('single', baseRef.current, start.zone, 0));
  const zoneCSv = useSharedValue(segsRef.current[0].center);
  const zoneC2Sv = useSharedValue(0.5);
  const zoneWSv = useSharedValue(segsRef.current[0].width);
  const splitSv = useSharedValue(0);
  const [zoneMode, setZoneMode] = useState<ZoneMode>('single');
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const { act, flash: hurtFlash, play } = useGameActor(gamePet);
  const knock = useSharedValue(0);
  const stumble = useSharedValue(0);
  const juice = useHitJuice();

  const applyZone = () => {
    const segs = trainZoneSegments(modeRef.current, baseRef.current, tallyRef.current.zone, phaseRef.current);
    segsRef.current = segs;
    zoneCSv.value = segs[0].center;
    zoneWSv.value = segs[0].width;
    if (segs[1]) zoneC2Sv.value = segs[1].center;
    splitSv.value = segs[1] ? 1 : 0;
  };

  const playing = countdown <= 0;
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (doneRef.current) return;
      if (modeRef.current === 'moving' && !stillRef.current) {
        phaseRef.current += TICK_MS;
        applyZone();
      }
      let p = markerRef.current + (dirRef.current * tallyRef.current.speed * TICK_MS) / 1000;
      if (p >= 1) {
        p = 1;
        dirRef.current = -1;
      } else if (p <= 0) {
        p = 0;
        dirRef.current = 1;
      }
      markerRef.current = p;
      markerSv.value = p;
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, markerSv]);

  const tap = () => {
    if (doneRef.current || !playing) return;
    const { hit, perfect } = trainZoneHit(segsRef.current, markerRef.current);
    const scoreBefore = trainScore(tallyRef.current, level);
    const tapped = trainTap(tallyRef.current, hit, level, perfect);
    // Practice never ends and never ramps: the zone and speed stay at the level's start.
    const next: TrainTally = practice
      ? { ...tapped, over: false, taps: 0, missStreak: 0, zone: start.zone, speed: start.speed }
      : tapped;
    tallyRef.current = next;
    setTally(next);
    setFlashState(perfect ? 'perfect' : hit ? 'hit' : 'miss');
    const gained = trainScore(next, level) - scoreBefore;
    if (hit && gained > 0) addPop(TRAIN_POP_X, TRAIN_POP_Y,`+${gained}`);
    if (!still) {
      if (perfect) rewardHaptic();
      else if (hit) tapHaptic();
      else alertHaptic();
    }
    if (hit) {
      play(perfect ? 'skill' : 'attack', 'e');
      if (!still) {
        knock.value = withSequence(withTiming(18, { duration: 90 }), withTiming(0, { duration: 260, easing: Easing.bounce }));
        if (perfect) juice.play();
      }
    } else {
      play('hurt', 'e'); // "oof": its hurt clip, or the red flash when it has none
      if (!still) stumble.value = withSequence(withTiming(-8, { duration: 90 }), withTiming(0, { duration: 200 }));
    }
    baseRef.current = randomZone(next.zone, rngRef.current);
    phaseRef.current = 0;
    practiceTapsRef.current += 1;
    // Practice cycles through the zone waves the level uses (15 taps), so every kind can be rehearsed.
    modeRef.current = trainZoneMode(level, practice ? practiceTapsRef.current % TRAIN.taps : next.taps);
    setZoneMode(modeRef.current);
    applyZone();
    if (next.over) {
      doneRef.current = true;
      onDoneRef.current(trainOutcome(next), trainScore(next, level));
    }
  };

  const crateStyle = useAnimatedStyle(() => ({ transform: [{ translateX: knock.value }, { rotate: `${knock.value * 0.6}deg` }] }));
  const petStyle = useAnimatedStyle(() => ({ transform: [{ translateX: stumble.value }] }));
  const flashVeil = useAnimatedStyle(() => ({ opacity: juice.flash.value }));
  const markerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: markerSv.value * barW }] }));
  const zoneAStyle = useAnimatedStyle(() => ({ left: (zoneCSv.value - zoneWSv.value / 2) * barW, width: zoneWSv.value * barW }));
  const coreAStyle = useAnimatedStyle(() => ({
    left: (zoneCSv.value - zoneWSv.value * TRAIN_PERFECT_SHARE) * barW,
    width: zoneWSv.value * TRAIN_PERFECT_SHARE * 2 * barW,
  }));
  const zoneBStyle = useAnimatedStyle(() => ({
    opacity: splitSv.value,
    left: (zoneC2Sv.value - zoneWSv.value / 2) * barW,
    width: zoneWSv.value * barW,
  }));
  const coreBStyle = useAnimatedStyle(() => ({
    opacity: splitSv.value,
    left: (zoneC2Sv.value - zoneWSv.value * TRAIN_PERFECT_SHARE) * barW,
    width: zoneWSv.value * TRAIN_PERFECT_SHARE * 2 * barW,
  }));
  const mult = comboMult('train', tally.streak);

  const modeNote =
    zoneMode === 'moving' ? (still ? 'The zone shrinks…' : 'The zone drifts now…') : zoneMode === 'split' ? 'Two zones now: hit either.' : 'The zone shrinks…';
  const hint =
    flash === 'perfect'
      ? `PERFECT! ${modeNote}`
      : flash === 'hit'
        ? `Hit! ${modeNote}`
        : flash === 'miss'
          ? practice
            ? 'Missed — no penalty in practice.'
            : `Missed — ${TRAIN.missStreakEnd} in a row ends it.`
          : practice
            ? 'Practice: no limit, nothing counts. The zone cycles through its waves. Back to leave.'
            : `Tap in the lit zone (the bright middle is a perfect hit). ${TRAIN.passHits} hits out of ${TRAIN.taps} to pass.`;
  const hintColor = flash === 'miss' ? '#FF3B5C' : flash === 'hit' || flash === 'perfect' ? '#7CE38B' : PIXEL.dim;

  return (
    <GamePlate
      kind="train"
      title={GAME_LABEL.train}
      score={`${trainScore(tally, level)}`}
      status={
        practice
          ? `practice · hits ${tally.hits} · best streak ${tally.bestStreak}`
          : `hits ${tally.hits}/${TRAIN.passHits} · tap ${Math.min(tally.taps + 1, TRAIN.taps)}/${TRAIN.taps}${tally.missStreak > 0 ? ` · misses ${tally.missStreak}/${TRAIN.missStreakEnd}` : ''}`
      }
      onBack={onBack}
      alive={!still}
      style={juice.shakeStyle}
      dock={
        <>
          <PixelBody size="sm" numberOfLines={2} color={hintColor} style={styles.hint}>
            {hint}
          </PixelBody>
          <PixelFrame align="stretch" padded={false} glow={false} lined={false} fill={PIXEL.ink} border={PIXEL.cyan} minHeight={36}>
            <View style={styles.bar} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
              <Animated.View style={[styles.zone, zoneAStyle]} />
              <Animated.View style={[styles.zone, zoneBStyle]} />
              <Animated.View style={[styles.zoneCore, coreAStyle]} />
              <Animated.View style={[styles.zoneCore, coreBStyle]} />
              <Animated.View style={[styles.marker, markerStyle]} />
            </View>
          </PixelFrame>
          <Pressable
            onPressIn={tap}
            accessibilityRole="button"
            accessibilityLabel="Tap to train"
            style={({ pressed }) => [{ width: '100%', minHeight: 72, opacity: pressed ? 0.92 : 1 }]}>
            {({ pressed }) => (
              <PixelFrame
                fill={PIXEL.cyan}
                border={PIXEL.ink}
                bevel="cyan"
                sunk={pressed}
                glow={false}
                lined={false}
                padded={false}
                align="center"
                minHeight={72}
                pulse
                style={{ width: '100%', height: 72 }}>
                <PixelLabel color={PIXEL.onFill} shadowColor={PIXEL.cyanLo} numberOfLines={1}>
                  TAP
                </PixelLabel>
              </PixelFrame>
            )}
          </Pressable>
        </>
      }>
      <View style={styles.playfield}>
        <View style={styles.trainFloor}>
          {gamePet ? (
            <Animated.View style={petStyle}>
              <GamePetSprite gp={gamePet} act={act} flash={hurtFlash} still={still} glow={mult >= 3} />
            </Animated.View>
          ) : (
            <View style={{ width: GAME_PET_BOX }} />
          )}
          {DUMMY_ART ? (
            <View style={styles.dummy}>
              <View pointerEvents="none" style={styles.dummyShadow} />
              <Animated.View style={[styles.dummySwing, crateStyle]}>
                <Image source={DUMMY_ART} contentFit="contain" style={styles.dummyArt} accessibilityLabel="Training dummy" />
              </Animated.View>
            </View>
          ) : null}
        </View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.perfectFlash, flashVeil]} />
        <ComboStrip game="train" streak={tally.streak} />
        <ComboBadge mult={mult} />
        {pops.map((p) => (
          <PopText key={p.id} pop={p} still={still} />
        ))}
        <CountdownVeil n={countdown} still={still} />
      </View>
    </GamePlate>
  );
}

/* ---------------------------------------------------------- Lane dash --- */

type LaneItem = { id: number; lane: number; y: number; speed: number; color: string; kind: SpawnKind };

/** One falling item in a lane (not tappable: you move the pet, not the item). */
const LaneFall = memo(function LaneFall({ f, boxW, boxH }: { f: LaneItem; boxW: number; boxH: number }) {
  const y = useSharedValue(f.y);
  useEffect(() => {
    y.value = withTiming(1.05, { duration: ((1.05 - f.y) / f.speed) * 1000, easing: Easing.linear });
    // The fall is fixed at spawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fall = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * Math.max(0, boxH - FOOD_SIZE) }] }));
  const left = ((f.lane + 0.5) / DASH_LANES) * boxW - FOOD_SIZE / 2;
  return (
    <Animated.View pointerEvents="none" style={[styles.food, { left }, fall]}>
      {f.kind === 'bomb' ? <BombShape /> : <FoodShape color={f.kind === 'golden' ? '#FFD700' : f.color} golden={f.kind === 'golden'} />}
    </Animated.View>
  );
});

/**
 * Lane dash (M3): the pet stands in one of 3 lanes; tap a lane to step there.
 * Food in the pet's lane is caught, a bomb in its lane is a strike, food that
 * falls past in another lane is missed. Catch's pass rule, combo and score
 * (`dashOutcome` / `dashScore`); it trains the pet like Tap to train.
 */
export function LaneDashGame({ onDone, onBack, level = 'normal', rng = Math.random, gamePet = null, still = false, practice = false }: GameProps) {
  usePixelFonts();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const boxRef = useRef(box);
  boxRef.current = box;
  const [items, setItems] = useState<LaneItem[]>([]);
  const [tally, setTally] = useState<CatchTally>(EMPTY_CATCH);
  const [leftSec, setLeftSec] = useState<number>(Math.ceil(CATCH.roundMs / 1000));
  const [bombFlash, setBombFlash] = useState(false);
  const bombTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdown = useCountdown();
  const { pops, add: addPop } = usePops();
  const petWobble = useSharedValue(0);
  const petLane = useSharedValue(1);
  const laneRef = useRef(1);
  const itemsRef = useRef<LaneItem[]>([]);
  const tallyRef = useRef<CatchTally>(EMPTY_CATCH);
  const elapsedRef = useRef(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const rngRef = useRef(rng);
  const { act, flash, play } = useGameActor(gamePet);
  const juice = useHitJuice();

  const setT = (next: CatchTally) => {
    tallyRef.current = next;
    setTally(next);
  };
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    itemsRef.current = [];
    setItems([]);
    onDoneRef.current(dashOutcome(tallyRef.current), dashScore(tallyRef.current, level));
  };

  useEffect(
    () => () => {
      if (bombTimer.current) clearTimeout(bombTimer.current);
    },
    [],
  );

  const popAt = (f: LaneItem, text: string) => {
    const b = boxRef.current;
    addPop(((f.lane + 0.5) / DASH_LANES) * b.width - FOOD_SIZE / 2, f.y * Math.max(0, b.height - FOOD_SIZE), text);
  };

  const playing = countdown <= 0;
  useEffect(() => {
    if (!playing) return;
    let nextId = 0;
    let sinceSpawn = 0;
    const r = rngRef.current;
    const id = setInterval(() => {
      if (doneRef.current) return;
      elapsedRef.current += TICK_MS;
      const elapsed = elapsedRef.current;
      const ramp = practice ? Math.min(elapsed, DASH_RAMP_HOLD_MS) : elapsed;
      sinceSpawn += TICK_MS;
      let t = tallyRef.current;
      let missed = 0;
      let dodged = 0;
      let changed = false;
      const pet = laneRef.current;
      const next: LaneItem[] = [];
      for (const raw of itemsRef.current) {
        const f = { ...raw, y: raw.y + (raw.speed * TICK_MS) / 1000 };
        if (dashReaches(f.lane, pet, f.y)) {
          changed = true;
          if (f.kind === 'bomb') {
            const hit = tapBomb(t);
            t = practice ? { ...hit, strikes: 0, over: false } : hit;
            setBombFlash(true);
            if (bombTimer.current) clearTimeout(bombTimer.current);
            bombTimer.current = setTimeout(() => setBombFlash(false), 80);
            play('hurt', 'front');
            if (!still) {
              juice.play();
              alertHaptic();
            }
            popAt(f, `−${CATCH.bombPenalty}`);
          } else {
            const before = dashScore(t, level);
            t = catchFood(t, elapsed, f.kind === 'golden');
            const gained = dashScore(t, level) - before;
            if (gained > 0) popAt(f, `+${gained}`);
            play(f.kind === 'golden' ? 'skill' : 'dash', 'e');
            if (!still) {
              if (f.kind === 'golden') rewardHaptic();
              else tapHaptic();
            }
          }
          continue;
        }
        if (f.y >= 1.05) {
          changed = true;
          if (f.kind === 'bomb') dodged += 1;
          else missed += 1;
          continue;
        }
        next.push(f);
      }
      for (let i = 0; i < missed; i += 1) t = missFood(t);
      if (dodged > 0 && !still) {
        petWobble.value = withSequence(withTiming(-5, { duration: 60 }), withTiming(5, { duration: 90 }), withTiming(0, { duration: 70 }));
      }
      if (sinceSpawn >= dashSpawnGapMs(ramp, level) && (practice || elapsed < DASH.roundMs - 800)) {
        sinceSpawn = 0;
        const kind = dashSpawnKind(ramp, r(), level);
        const lane = Math.min(DASH_LANES - 1, Math.floor(r() * DASH_LANES));
        const speed = (0.32 + r() * 0.08) * dashSpeedMult(ramp, level);
        next.push({ id: nextId++, lane, y: -0.1, speed, kind, color: FOOD_COLORS[nextId % FOOD_COLORS.length] });
        changed = true;
      }
      itemsRef.current = next;
      if (t !== tallyRef.current) setT(t);
      if (changed) setItems(next);
      const left = Math.max(0, DASH.roundMs - elapsed);
      if (!practice) setLeftSec(Math.ceil(left / 1000));
      if (!practice && (left <= 0 || t.over)) finish();
    }, TICK_MS);
    return () => clearInterval(id);
    // The round's level and rng are fixed for its whole life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const stepTo = (lane: number) => {
    if (doneRef.current || !playing || lane === laneRef.current) return;
    const east = lane > laneRef.current;
    laneRef.current = lane;
    if (still) petLane.value = lane;
    else petLane.value = withTiming(lane, { duration: 110, easing: Easing.out(Easing.quad) });
    play('dash', east ? 'e' : 'w');
    if (!still) tapHaptic();
  };

  const petStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: ((petLane.value + 0.5) / DASH_LANES) * box.width - GAME_PET_BOX / 2 },
      { rotate: `${petWobble.value}deg` },
    ],
  }));
  const mult = comboMult('dash', tally.chain);
  const onField = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  return (
    <GamePlate
      kind="dash"
      title={GAME_LABEL.dash}
      score={`${dashScore(tally, level)}`}
      status={
        practice
          ? `practice · caught ${tally.caught} · best streak ${tally.bestChain}`
          : `caught ${tally.caught} · 💣 ${tally.strikes}/${CATCH.bombStrikes} · ${leftSec}s`
      }
      onBack={onBack}
      alive={!still}
      dock={
        <PixelBody size="sm" numberOfLines={2} style={styles.hint}>
          {practice
            ? 'Practice: nothing counts, no clock. Tap a lane to step there. Back to leave.'
            : `Tap a lane to step there. Catch half of the food to pass; a 💣 in your lane is a strike.`}
        </PixelBody>
      }>
      <View style={styles.playfield} onLayout={onField}>
        {box.width > 0 ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {[1, 2].map((i) => (
              <View key={i} style={[styles.laneLine, { left: (i / DASH_LANES) * box.width }]} />
            ))}
          </View>
        ) : null}
        {gamePet && box.width > 0 ? (
          <Animated.View pointerEvents="none" style={[styles.catchPet, petStyle]}>
            <Animated.View style={juice.shakeStyle}>
              <GamePetSprite gp={gamePet} act={act} flash={flash} still={still} glow={mult >= 3} />
            </Animated.View>
          </Animated.View>
        ) : null}
        {box.width > 0 ? items.map((f) => <LaneFall key={f.id} f={f} boxW={box.width} boxH={box.height} />) : null}
        {bombFlash ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.bombFlash]} /> : null}
        {/* Three full-height lane buttons on top: a tap anywhere in a lane steps the pet there. */}
        <View style={styles.laneRow}>
          {Array.from({ length: DASH_LANES }, (_, i) => (
            <Pressable
              key={i}
              onPressIn={() => stepTo(i)}
              accessibilityRole="button"
              accessibilityLabel={`Lane ${i + 1} of ${DASH_LANES}: step here`}
              style={styles.laneHit}
            />
          ))}
        </View>
        <ComboStrip game="dash" streak={tally.chain} />
        <ComboBadge mult={mult} />
        {pops.map((p) => (
          <PopText key={p.id} pop={p} still={still} />
        ))}
        <CountdownVeil n={countdown} still={still} />
      </View>
    </GamePlate>
  );
}

const DASH_RAMP_HOLD_MS = 12_000;

const styles = StyleSheet.create({
  laneRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  laneHit: { flex: 1 },
  laneLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(92,225,255,0.22)' },
  powerImg: { width: FOOD_SIZE - 12, height: FOOD_SIZE - 12, margin: 6, ...pixelRenderStyle },
  powerChips: { position: 'absolute', top: ART_PT * 2 + 6, left: 10, gap: 2 },
  screen: { flex: 1, minHeight: 0, backgroundColor: PIXEL.ink },
  top: { flex: 1, paddingHorizontal: 8, paddingTop: 4 },
  topPad: { width: '100%', paddingHorizontal: 10, paddingVertical: 6, gap: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  backHit: { width: 72, minHeight: 44, justifyContent: 'center' },
  topTitle: { flex: 1, minWidth: 0, textAlign: 'center' },
  scoreSlot: { width: 72, alignItems: 'flex-end' },
  // Larger Text: the line keeps a full line of height and shrinks to fit instead of clipping.
  statusLine: { textAlign: 'center', minHeight: pixelBodyLine(PIXEL_CAPTION_PT) },
  stageWrap: { flex: 1, minHeight: 0, paddingHorizontal: 8, paddingVertical: 6 },
  stage: { flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' },
  roomNeon: { opacity: 0.6 },
  lampClip: { position: 'absolute', right: 4, top: 4, width: 88, height: 120, overflow: 'hidden', opacity: 0.7 },
  dock: { flex: 1, width: '100%', paddingHorizontal: 8, paddingBottom: 8 },
  dockPad: { width: '100%', padding: 12, gap: 8 },
  playfield: { flex: 1, minHeight: 0, width: '100%', overflow: 'hidden', position: 'relative' },
  trainFloor: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingBottom: 8,
  },
  catchPet: { position: 'absolute', left: 0, bottom: 4 },
  food: {
    position: 'absolute',
    top: 0,
    width: FOOD_SIZE,
    height: FOOD_SIZE,
  },
  foodHit: { width: FOOD_SIZE, height: FOOD_SIZE },
  foodArt: { width: FOOD_SIZE, height: FOOD_SIZE },
  foodImg: { width: FOOD_SIZE, height: FOOD_SIZE, ...pixelRenderStyle },
  hostFill: { flex: 1, minHeight: 0, width: '100%' },
  countVeil: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 64, lineHeight: 72 },
  pop: { position: 'absolute' },
  comboStrip: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: ART_PT * 2,
    backgroundColor: 'rgba(5,7,13,0.55)',
  },
  comboFill: { height: '100%', backgroundColor: PIXEL.cyan },
  comboFillTop: { backgroundColor: PIXEL.amberHi },
  cardVeil: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(5,7,13,0.72)',
  },
  cardPad: { width: '100%', padding: 16, gap: 10, alignItems: 'stretch' },
  cardLine: { textAlign: 'center' },
  // Fixed regions: always 2 lines tall, so a longer hint never shrinks the playfield.
  hint: { textAlign: 'center', minHeight: pixelBodyLine(PIXEL_CAPTION_PT) * 2 },
  dummy: { width: DUMMY_SIZE, height: DUMMY_SIZE },
  dummyShadow: {
    position: 'absolute',
    left: DUMMY_SIZE * 0.2,
    width: DUMMY_SIZE * 0.6,
    bottom: 0,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(5,7,13,0.4)',
  },
  dummySwing: { width: DUMMY_SIZE, height: DUMMY_SIZE, transformOrigin: 'top' },
  dummyArt: { width: DUMMY_SIZE, height: DUMMY_SIZE, ...pixelRenderStyle },
  bar: {
    height: 36,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  zone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: PIXEL.cyanLo,
  },
  zoneCore: {
    position: 'absolute',
    top: ART_PT,
    bottom: ART_PT,
    backgroundColor: PIXEL.cyan,
  },
  marker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: ART_PT * 2,
    marginLeft: -ART_PT,
    left: 0,
    backgroundColor: PIXEL.amber,
  },
  bombFlash: { backgroundColor: '#FF3B5C', opacity: 0.4 },
  perfectFlash: { backgroundColor: '#FFFFFF' },
  hurtFlash: { backgroundColor: '#FF3B5C', opacity: 0.45 },
  // Centred on the pet's box (the pool is 1.4 boxes wide).
  glow: { position: 'absolute', left: -GAME_PET_BOX * 0.2, top: -GAME_PET_BOX * 0.2, opacity: 0.9 },
  glowStill: { opacity: 0.6 },
  combo: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  comboTop: { fontSize: 28, lineHeight: 34 },
});
