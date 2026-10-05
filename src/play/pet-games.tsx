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
 *   - Catch: it stands at the bottom, dashes toward each catch and hops; a
 *     bomb plays its hurt clip (or a red flash when it has none); at ×3 and up
 *     it glows.
 *   - Train: a dungeon crate is the training dummy; a hit plays the pet's
 *     attack clip and knocks the crate back; a miss makes it stumble; a
 *     perfect hit (the middle of the zone) adds a flash and a small shake.
 *   - Reduced motion or Effects Low: still poses, no shake.
 * The daily challenge passes a seeded `rng`, so its pattern is fixed per date.
 * Each game reports once, when the round ends: the outcome and its score.
 *
 * Both rounds mount full screen (the Play sheet is only the hub). They share
 * one plate: Dive's top chrome, a framed stage that fills the safe area, and
 * a framed dock. Catch wears the reef plate; Train wears the pet-room plate.
 * Both are darkened so the food, the pet, and the dummy stay in front. The
 * path dither, caustic sparkles, dust, and bubbles stay. No new tileset.
 */
import { Image } from 'expo-image';
import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { BubbleRing } from '@/play/dive-world';
import { GAME_LABEL } from '@/play/game-records';
import { PLAY_ART } from '@/play/generated-play-assets';
import { Drift, Flicker, MoteRise, Sway, Twinkle } from '@/play/pixel-ambient';
import { AtlasSprite, MOCKUP_DIVE, MOCKUP_ROOM, placePlate } from '@/play/pixel-atlas';
import { ART_PT, PIXEL } from '@/play/pixel-theme';
import { CausticWash, DitherPool, useHitJuice } from '@/play/pixel-fx';
import { PixelBody, PixelFrame, PixelLabel, usePixelFonts } from '@/play/pixel-ui';
import type { PetState } from '@/play/pet';
import { petPose, petPoseMs, type PetPose } from '@/play/pet-actor';
import { PetAnimSprite, type PetArt, type PetFace } from '@/play/pet-anim-sprite';
import type { PetWear } from '@/play/pet-cosmetics';
import {
  CATCH,
  EMPTY_CATCH,
  TRAIN,
  TRAIN_PERFECT_SHARE,
  catchFood,
  catchOutcome,
  catchScore,
  catchSpawnGapMs,
  catchSpawnKind,
  catchSpeedMult,
  comboMult,
  dailySeed,
  missFood,
  seededRng,
  startTrain,
  tapBomb,
  trainOutcome,
  trainScore,
  trainTap,
  type CatchTally,
  type Difficulty,
  type RoundOutcome,
  type SpawnKind,
  type TrainTally,
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
  /** Its glow colour (the Legend element / grade colour). */
  glow: string;
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
  const play = (want: 'dash' | 'attack' | 'hurt', face: PetFace) => {
    if (!gp) return;
    const pose = petPose(gp.art.kit, want);
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

/** Memoized: the games re-render every tick; the pet only when its act changes. */
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
  return (
    <View style={{ width: GAME_PET_BOX, height: GAME_PET_BOX }}>
      {glow ? (
        <View
          pointerEvents="none"
          style={[styles.glow, { backgroundColor: gp.glow }, still && styles.glowStill]}
        />
      ) : null}
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
      />
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

/** Deepest water cell. Shows at the crop when the reef plate does not cover the stage. */
const ARENA = '#0B3E48';
/** Night wall, so a cropped room plate does not fall back to teal. */
const DOJO = '#140E1C';
/** Ink over the plate. The actors sit above this, so they stay the bright layer. */
const SCRIM = 'rgba(5,7,13,0.42)';

/** Bubble rises, in shares of the stage. Radii match Dive's mockup rings. */
const ARENA_BUBBLES = [
  { x: 0.2, y: 0.78, r: 2, ms: 4200, delay: 0 },
  { x: 0.7, y: 0.66, r: 1, ms: 5000, delay: 420 },
  { x: 0.46, y: 0.86, r: 3, ms: 5400, delay: 860 },
  { x: 0.84, y: 0.58, r: 2, ms: 4600, delay: 180 },
] as const;

/** Room dust, in shares of the stage. */
const ARENA_MOTES = [
  { x: 0.14, y: 0.42, ms: 3600, delay: 0 },
  { x: 0.76, y: 0.34, ms: 4200, delay: 700 },
  { x: 0.38, y: 0.58, ms: 3900, delay: 1400 },
] as const;

/**
 * Stage atmosphere. DitherPool is one path of Bayer cells (not an SVG
 * Pattern). CausticWash is a few cycling sparkles — a wide cell would paint
 * column bars, so that component stays small. Bubbles are Dive's rings;
 * dust and the sparkle are the room's. `alive` is false under Reduce Motion
 * and Effects Low: the pool holds, the sparkle rests, particles are not mounted.
 */
type ArenaKind = 'catch' | 'train';

/**
 * The place behind the round. Catch clips the reef plate (ruins, kelp, seabed).
 * Train clips the pet room (window, lamp, brick). A short stage hides the
 * ceiling, so the window, lamp glow, and a ruin head are pinned when the crop
 * cuts them off. An ink scrim sits on the art; the pet, food, and dummy do not.
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
  const k = ART_PT;
  const anchor = kind === 'catch' ? MOCKUP_DIVE.feet : MOCKUP_ROOM.feet;
  const origin = placePlate(width, height, anchor, 16);
  const artTop = Math.max(0, -origin.top / k);
  const pinCeiling = artTop > (kind === 'catch' ? 48 : MOCKUP_ROOM.sky.y);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', left: origin.left, top: origin.top }}>
        <AtlasSprite atlas={kind === 'catch' ? 'dive' : 'room'} frame="plate" />
        {kind === 'catch' ? (
          <View style={{ position: 'absolute', left: MOCKUP_DIVE.shimmer.x * k, top: MOCKUP_DIVE.shimmer.y * k }}>
            <Flicker alive={alive} peak={0.4} ms={1400}>
              <AtlasSprite atlas="dive" frame="shimmer" />
            </Flicker>
          </View>
        ) : (
          <>
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
          </>
        )}
      </View>
      {kind === 'catch' ? (
        <>
          <View style={{ position: 'absolute', left: -12, bottom: 4 }}>
            <Sway alive={alive} deg={2.2} ms={2400}>
              <AtlasSprite atlas="dive" frame="weed" />
            </Sway>
          </View>
          <View style={{ position: 'absolute', right: -8, bottom: 12 }}>
            <AtlasSprite atlas="dive" frame="coral" />
          </View>
          {pinCeiling ? (
            <View style={styles.ruinClip}>
              <View style={{ position: 'absolute', left: -16, top: -8 }}>
                <AtlasSprite atlas="dive" frame="statue-deep" scale={1} />
              </View>
            </View>
          ) : null}
          <View style={{ position: 'absolute', left: width * 0.12, top: height * 0.2, opacity: 0.55 }}>
            <Drift alive={alive} dx={Math.min(96, width * 0.28)} dy={4} ms={7200}>
              <AtlasSprite atlas="dive" frame="fish0" />
            </Drift>
          </View>
        </>
      ) : (
        <>
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
        </>
      )}
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
        color={kind === 'train' ? PIXEL.amber : PIXEL.cyan}
        lit={2}
        gain={kind === 'train' ? 0.28 : 0.4}
      />
      {kind === 'catch' ? <CausticWash alive={alive} width={width} height={height} /> : null}
      {ARENA_BUBBLES.map((b, i) => (
        <MoteRise
          key={`b${i}`}
          alive={alive}
          left={b.x * width}
          top={b.y * height}
          distance={Math.min(120, height * 0.35)}
          ms={b.ms}
          delay={b.delay}>
          <BubbleRing r={b.r} />
        </MoteRise>
      ))}
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
  const labelPt = screenW < 400 ? 13 : 16;
  const label = { fontSize: labelPt, lineHeight: labelPt + 4 };
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };
  return (
    <Animated.View style={[styles.screen, style]}>
      <View style={styles.top}>
        <PixelFrame align="stretch" padded={false} enter>
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
      <View style={styles.stageWrap}>
        <PixelFrame align="stretch" padded={false} glow fill={kind === 'catch' ? ARENA : DOJO} border={PIXEL.cyan} grow>
          <View style={styles.stage} onLayout={onLayout}>
            <ArenaDressing kind={kind} alive={alive} width={box.width} height={box.height} />
            <ArenaAmbient kind={kind} alive={alive} width={box.width} height={box.height} />
            {children}
          </View>
        </PixelFrame>
      </View>
      <View style={styles.dock}>
        <PixelFrame align="stretch" padded={false}>
          <View style={styles.dockPad}>{dock}</View>
        </PixelFrame>
      </View>
    </Animated.View>
  );
}

/** Catch or Train, full screen. The daily pattern is seeded once per mount. */
export function PetGameHost({
  kind,
  level,
  daily,
  ymd,
  gamePet,
  still,
  onBack,
  onDone,
}: {
  kind: 'catch' | 'train';
  level: Difficulty;
  daily: boolean;
  ymd: string;
  gamePet: GamePet | null;
  still: boolean;
  onBack: () => void;
  onDone: (outcome: RoundOutcome, score: number) => void;
}) {
  const rngRef = useRef<(() => number) | null>(null);
  if (rngRef.current == null) rngRef.current = daily ? seededRng(dailySeed(ymd, kind)) : Math.random;
  const props: GameProps = { onDone, onBack, level, rng: rngRef.current, gamePet, still };
  return kind === 'catch' ? <CatchFoodGame {...props} /> : <TapTrainGame {...props} />;
}

/* ------------------------------------------------------ Catch the food --- */

export const CATCH_ROUND_MS = CATCH.roundMs;
const FOOD_SIZE = 40;
const FOOD_COLORS = ['#FF6B6B', '#FFD86B', '#7CE38B'] as const;

type Food = { id: number; x: number; y: number; speed: number; color: string; kind: SpawnKind };

function FoodShape({ color, golden = false }: { color: string; golden?: boolean }) {
  return (
    <Svg width={FOOD_SIZE} height={FOOD_SIZE} viewBox="0 0 40 40">
      {golden ? <Circle cx="20" cy="23" r="17" fill="#FFF3B0" fillOpacity={0.5} /> : null}
      <Circle cx="20" cy="23" r="13" fill={color} />
      <Circle cx="15" cy="19" r="3.5" fill="#FFFFFF" fillOpacity={0.45} />
      <Path d="M20 10 Q24 4 29 6 Q26 11 20 10 Z" fill="#7CE38B" />
    </Svg>
  );
}

export function CatchFoodGame({ onDone, onBack, level = 'normal', rng = Math.random, gamePet = null, still = false }: GameProps) {
  usePixelFonts();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [items, setItems] = useState<Food[]>([]);
  const [tally, setTally] = useState<CatchTally>(EMPTY_CATCH);
  const [leftMs, setLeftMs] = useState<number>(CATCH.roundMs);
  const [bombFlash, setBombFlash] = useState(false);
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
    onDoneRef.current(catchOutcome(tallyRef.current), catchScore(tallyRef.current, level));
  };

  useEffect(() => {
    let nextId = 0;
    let sinceSpawn = 0;
    const r = rngRef.current;
    const id = setInterval(() => {
      if (doneRef.current) return;
      elapsedRef.current += TICK_MS;
      const elapsed = elapsedRef.current;
      sinceSpawn += TICK_MS;
      let missed = 0;
      let next = itemsRef.current
        .map((f) => ({ ...f, y: f.y + (f.speed * TICK_MS) / 1000 }))
        .filter((f) => {
          if (f.y < 1.05) return true;
          if (f.kind !== 'bomb') missed += 1; // food that fell past = a miss
          return false;
        });
      if (sinceSpawn >= catchSpawnGapMs(elapsed, level) && elapsed < CATCH.roundMs - 800) {
        sinceSpawn = 0;
        const kind = catchSpawnKind(elapsed, r(), level);
        const speed = (0.32 + r() * 0.08) * catchSpeedMult(elapsed, level);
        next = [...next, { id: nextId++, x: 0.08 + r() * 0.84, y: -0.1, speed, kind, color: FOOD_COLORS[nextId % FOOD_COLORS.length] }];
      }
      itemsRef.current = next;
      setItems(next);
      if (missed > 0) {
        let t = tallyRef.current;
        for (let i = 0; i < missed; i += 1) t = missFood(t);
        setT(t);
      }
      const left = Math.max(0, CATCH.roundMs - elapsed);
      setLeftMs(left);
      if (left <= 0) finish();
    }, TICK_MS);
    return () => clearInterval(id);
    // The round's level and rng are fixed for its whole life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tapItem = (itemId: number) => {
    if (doneRef.current) return;
    const item = itemsRef.current.find((f) => f.id === itemId);
    if (!item) return;
    itemsRef.current = itemsRef.current.filter((f) => f.id !== itemId);
    setItems(itemsRef.current);
    if (item.kind === 'bomb') {
      const next = tapBomb(tallyRef.current);
      setT(next);
      setBombFlash(true);
      setTimeout(() => setBombFlash(false), 80);
      play('hurt', 'front');
      if (!still) juice.play();
      if (next.over) finish();
      return;
    }
    const next = catchFood(tallyRef.current, elapsedRef.current, item.kind === 'golden');
    setT(next);
    // The pet dashes toward the catch and hops.
    const toward = Math.max(0.08, Math.min(0.92, item.x + 0.04));
    play('dash', toward < petX.value ? 'w' : 'e');
    if (!still) {
      petX.value = withTiming(toward, { duration: 220, easing: Easing.out(Easing.quad) });
      petHop.value = withSequence(withTiming(-12, { duration: 120 }), withTiming(0, { duration: 180, easing: Easing.bounce }));
    } else {
      petX.value = toward;
    }
  };

  const petStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: petX.value * Math.max(0, box.width - GAME_PET_BOX) }, { translateY: petHop.value }],
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
      status={`caught ${tally.caught} · 💣 ${tally.strikes}/${CATCH.bombStrikes} · ${Math.ceil(leftMs / 1000)}s`}
      onBack={onBack}
      alive={!still}
      dock={
        <PixelBody size="sm" numberOfLines={3} style={styles.hint}>
          {`Catch half of the food to pass. Golden = +${CATCH.goldenPoints}. Catches in a row build the combo — a miss or a 💣 resets it. ${CATCH.bombStrikes} 💣 end the round.`}
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
          ? items.map((f) => (
              <Pressable
                key={f.id}
                onPressIn={() => tapItem(f.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={f.kind === 'bomb' ? 'Bomb — don’t tap' : f.kind === 'golden' ? 'Golden food' : 'Catch food'}
                style={[styles.food, { left: f.x * (box.width - FOOD_SIZE), top: f.y * Math.max(0, box.height - FOOD_SIZE) }]}>
                {f.kind === 'bomb' ? (
                  <Text style={styles.emojiItem}>💣</Text>
                ) : (
                  <FoodShape color={f.kind === 'golden' ? '#FFD700' : f.color} golden={f.kind === 'golden'} />
                )}
              </Pressable>
            ))
          : null}
        {bombFlash ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.bombFlash]} /> : null}
        <ComboBadge mult={mult} />
      </View>
    </GamePlate>
  );
}

/* -------------------------------------------------------- Tap to train --- */

export const TRAIN_REPS = TRAIN.taps;
const CRATE_ART = PLAY_ART['tiles/scribble-dungeons/crate'];

function randomZone(width: number, r: () => number): number {
  return width / 2 + 0.05 + r() * (1 - width - 0.1);
}

export function TapTrainGame({ onDone, onBack, level = 'normal', rng = Math.random, gamePet = null, still = false }: GameProps) {
  usePixelFonts();
  const start = startTrain(level);
  const [marker, setMarker] = useState(0);
  const [tally, setTally] = useState<TrainTally>(start);
  const rngRef = useRef(rng);
  const [zone, setZone] = useState(() => randomZone(start.zone, rngRef.current));
  const [flash, setFlashState] = useState<'hit' | 'perfect' | 'miss' | null>(null);
  const markerRef = useRef(0);
  const dirRef = useRef(1);
  const tallyRef = useRef<TrainTally>(start);
  const zoneRef = useRef(zone);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const { act, flash: hurtFlash, play } = useGameActor(gamePet);
  const knock = useSharedValue(0);
  const stumble = useSharedValue(0);
  const juice = useHitJuice();

  useEffect(() => {
    const id = setInterval(() => {
      if (doneRef.current) return;
      let p = markerRef.current + (dirRef.current * tallyRef.current.speed * TICK_MS) / 1000;
      if (p >= 1) {
        p = 1;
        dirRef.current = -1;
      } else if (p <= 0) {
        p = 0;
        dirRef.current = 1;
      }
      markerRef.current = p;
      setMarker(p);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const tap = () => {
    if (doneRef.current) return;
    const width = tallyRef.current.zone;
    const off = Math.abs(markerRef.current - zoneRef.current);
    const hit = off <= width / 2;
    const perfect = hit && off <= width * TRAIN_PERFECT_SHARE;
    const next = trainTap(tallyRef.current, hit, level, perfect);
    tallyRef.current = next;
    setTally(next);
    setFlashState(perfect ? 'perfect' : hit ? 'hit' : 'miss');
    if (hit) {
      play('attack', 'e');
      if (!still) {
        knock.value = withSequence(withTiming(18, { duration: 90 }), withTiming(0, { duration: 260, easing: Easing.bounce }));
        if (perfect) juice.play();
      }
    } else if (!still) {
      stumble.value = withSequence(withTiming(-8, { duration: 90 }), withTiming(0, { duration: 200 }));
    }
    const nextZone = randomZone(next.zone, rngRef.current);
    zoneRef.current = nextZone;
    setZone(nextZone);
    if (next.over) {
      doneRef.current = true;
      onDoneRef.current(trainOutcome(next), trainScore(next, level));
    }
  };

  const crateStyle = useAnimatedStyle(() => ({ transform: [{ translateX: knock.value }, { rotate: `${knock.value * 0.6}deg` }] }));
  const petStyle = useAnimatedStyle(() => ({ transform: [{ translateX: stumble.value }] }));
  const flashVeil = useAnimatedStyle(() => ({ opacity: juice.flash.value }));
  const mult = comboMult('train', tally.streak);

  const hint =
    flash === 'perfect'
      ? 'PERFECT! Right in the middle.'
      : flash === 'hit'
        ? 'Hit! The zone shrinks…'
        : flash === 'miss'
          ? `Missed — ${TRAIN.missStreakEnd} in a row ends it.`
          : `Tap in the lit zone (the bright middle is a perfect hit). ${TRAIN.passHits} hits out of ${TRAIN.taps} to pass.`;
  const hintColor = flash === 'miss' ? '#FF3B5C' : flash === 'hit' || flash === 'perfect' ? '#7CE38B' : PIXEL.dim;

  return (
    <GamePlate
      kind="train"
      title={GAME_LABEL.train}
      score={`${trainScore(tally, level)}`}
      status={`hits ${tally.hits}/${TRAIN.passHits} · tap ${Math.min(tally.taps + 1, TRAIN.taps)}/${TRAIN.taps}${tally.missStreak > 0 ? ` · misses ${tally.missStreak}/${TRAIN.missStreakEnd}` : ''}`}
      onBack={onBack}
      alive={!still}
      style={juice.shakeStyle}
      dock={
        <>
          <PixelBody size="sm" numberOfLines={2} color={hintColor} style={styles.hint}>
            {hint}
          </PixelBody>
          <PixelFrame align="stretch" padded={false} glow={false} lined={false} fill={PIXEL.ink} border={PIXEL.cyan} minHeight={36}>
            <View style={styles.bar}>
              <View style={[styles.zone, { left: `${(zone - tally.zone / 2) * 100}%`, width: `${tally.zone * 100}%` }]} />
              <View
                style={[
                  styles.zoneCore,
                  { left: `${(zone - tally.zone * TRAIN_PERFECT_SHARE) * 100}%`, width: `${tally.zone * TRAIN_PERFECT_SHARE * 2 * 100}%` },
                ]}
              />
              <View style={[styles.marker, { left: `${marker * 100}%` }]} />
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
          {CRATE_ART ? (
            <Animated.View style={crateStyle}>
              <Image source={CRATE_ART} contentFit="contain" style={styles.crate} accessibilityLabel="Training dummy" />
            </Animated.View>
          ) : null}
        </View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.perfectFlash, flashVeil]} />
        <ComboBadge mult={mult} />
      </View>
    </GamePlate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: PIXEL.ink },
  top: { flexGrow: 0, flexShrink: 0, paddingHorizontal: 8, paddingTop: 4 },
  topPad: { width: '100%', paddingHorizontal: 10, paddingVertical: 6, gap: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  backHit: { width: 72, minHeight: 44, justifyContent: 'center' },
  topTitle: { flex: 1, minWidth: 0, textAlign: 'center' },
  scoreSlot: { width: 72, alignItems: 'flex-end' },
  statusLine: { textAlign: 'center' },
  stageWrap: { flex: 1, minHeight: 0, paddingHorizontal: 8, paddingVertical: 6 },
  stage: { flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' },
  ruinClip: { position: 'absolute', right: 4, top: 4, width: 72, height: 88, overflow: 'hidden', opacity: 0.55 },
  lampClip: { position: 'absolute', right: 4, top: 4, width: 88, height: 120, overflow: 'hidden', opacity: 0.7 },
  dock: { flexGrow: 0, flexShrink: 0, width: '100%', paddingHorizontal: 8, paddingBottom: 8 },
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
    width: FOOD_SIZE,
    height: FOOD_SIZE,
  },
  hint: { textAlign: 'center' },
  crate: { width: 56, height: 56 },
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
    backgroundColor: PIXEL.amber,
  },
  emojiItem: { fontSize: 30, textAlign: 'center' },
  bombFlash: { backgroundColor: '#FF3B5C', opacity: 0.4 },
  perfectFlash: { backgroundColor: '#FFFFFF' },
  hurtFlash: { backgroundColor: '#FF3B5C', opacity: 0.45 },
  glow: {
    position: 'absolute',
    left: -ART_PT * 2,
    top: -ART_PT * 2,
    right: -ART_PT * 2,
    bottom: -ART_PT * 2,
    opacity: 0.28,
  },
  glowStill: { opacity: 0.22 },
  combo: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  comboTop: { fontSize: 28, lineHeight: 34 },
});
