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
 */
import { Image } from 'expo-image';
import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { PLAY_ART } from '@/play/generated-play-assets';
import { ART_PT, PIXEL } from '@/play/pixel-theme';
import { DitherPool, useHitJuice } from '@/play/pixel-fx';
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
  missFood,
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
  level?: Difficulty;
  /** Seeded for the daily challenge; Math.random otherwise. */
  rng?: () => number;
  gamePet?: GamePet | null;
  /** Reduced motion or Effects Low: still poses, no shake. */
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

/* ------------------------------------------------------ Catch the food --- */

export const CATCH_ROUND_MS = CATCH.roundMs;
const CATCH_AREA_H = 320;
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

export function CatchFoodGame({ onDone, level = 'normal', rng = Math.random, gamePet = null, still = false }: GameProps) {
  usePixelFonts();
  const [width, setWidth] = useState(0);
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
    transform: [{ translateX: petX.value * Math.max(0, width - GAME_PET_BOX) }, { translateY: petHop.value }],
  }));
  const mult = comboMult('catch', tally.chain);

  return (
    <View style={styles.game}>
      <View style={styles.hudRow}>
        <PixelBody size="sm" color={PIXEL.cyan} numberOfLines={1}>
          {catchScore(tally, level)} pts · caught {tally.caught}
        </PixelBody>
        <PixelBody size="sm" color={PIXEL.cyan} numberOfLines={1}>
          {`💣 ${tally.strikes}/${CATCH.bombStrikes} · ${Math.ceil(leftMs / 1000)}s`}
        </PixelBody>
      </View>
      <PixelFrame align="stretch" padded={false} glow={false} fill="#0B3E48" border={PIXEL.cyan}>
      <View style={[styles.area, { height: CATCH_AREA_H }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <DitherPool alive={!still} cx={70} cy={130} rx={56} ry={22} color={PIXEL.cyan} lit={2} gain={0.4} />
        {gamePet && width > 0 ? (
          <Animated.View pointerEvents="none" style={[styles.catchPet, petStyle]}>
            <Animated.View style={juice.shakeStyle}>
              <GamePetSprite gp={gamePet} act={act} flash={flash} still={still} glow={mult >= 3} />
            </Animated.View>
          </Animated.View>
        ) : null}
        {width > 0
          ? items.map((f) => (
              <Pressable
                key={f.id}
                onPressIn={() => tapItem(f.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={f.kind === 'bomb' ? 'Bomb — don’t tap' : f.kind === 'golden' ? 'Golden food' : 'Catch food'}
                style={[styles.food, { left: f.x * (width - FOOD_SIZE), top: f.y * (CATCH_AREA_H - FOOD_SIZE) }]}>
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
      </PixelFrame>
      <PixelBody size="sm" numberOfLines={3} style={styles.hint}>
        {`Catch half of the food to pass. Golden = +${CATCH.goldenPoints}. Catches in a row build the combo — a miss or a 💣 resets it. ${CATCH.bombStrikes} 💣 end the round.`}
      </PixelBody>
    </View>
  );
}

/* -------------------------------------------------------- Tap to train --- */

export const TRAIN_REPS = TRAIN.taps;
const CRATE_ART = PLAY_ART['tiles/scribble-dungeons/crate'];

function randomZone(width: number, r: () => number): number {
  return width / 2 + 0.05 + r() * (1 - width - 0.1);
}

export function TapTrainGame({ onDone, level = 'normal', rng = Math.random, gamePet = null, still = false }: GameProps) {
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
    <Animated.View style={[styles.game, juice.shakeStyle]}>
      <View style={styles.hudRow}>
        <PixelBody size="sm" color={PIXEL.cyan} numberOfLines={1}>
          {trainScore(tally, level)} pts · hits {tally.hits}/{TRAIN.passHits}
        </PixelBody>
        <PixelBody size="sm" color={PIXEL.cyan} numberOfLines={1}>
          {`Tap ${Math.min(tally.taps + 1, TRAIN.taps)}/${TRAIN.taps}${tally.missStreak > 0 ? ` · misses ${tally.missStreak}/${TRAIN.missStreakEnd}` : ''}`}
        </PixelBody>
      </View>
      <PixelFrame align="stretch" padded={false} glow={false} fill="#0B3E48" border={PIXEL.cyan}>
        <View style={styles.arena}>
          <DitherPool alive={!still} cx={64} cy={28} rx={48} ry={12} color={PIXEL.cyan} lit={2} gain={0.35} />
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
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.perfectFlash, flashVeil]} />
          <ComboBadge mult={mult} />
        </View>
      </PixelFrame>
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
      <PixelBody size="sm" numberOfLines={2} color={hintColor} style={styles.hint}>
        {hint}
      </PixelBody>
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  game: { width: '100%', gap: 8 },
  hudRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  area: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  catchPet: { position: 'absolute', left: 0, bottom: 4 },
  food: {
    position: 'absolute',
    width: FOOD_SIZE,
    height: FOOD_SIZE,
  },
  hint: { textAlign: 'center' },
  arena: {
    height: 110,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    overflow: 'hidden',
    position: 'relative',
    paddingBottom: 6,
  },
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
