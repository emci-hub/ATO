/**
 * Pet mini-games (v20 → v25 harder, 2026-09-30) — two short vector rounds, no
 * new art. Both can be failed now; the rules live in `pet-game-rules.ts`.
 *
 *   Catch the food — food falls for 20s; tap a piece to catch it. Counts as
 *                    feeding (+2 hunger).
 *   Tap to train   — a marker sweeps a bar; tap while it is inside the lit
 *                    zone, 10 tries that speed up. Counts as training
 *                    (+1 training, +2 mood).
 *
 * Each game only reports its score once, when the round ends; the rules
 * (minimum score, tokens, daily cap) live in `finishPetRound`.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Fonts } from '@/constants/theme';
import { NEON } from '@/play/neon-viper';
import {
  CATCH,
  EMPTY_CATCH,
  START_TRAIN,
  TRAIN,
  catchFood,
  catchOutcome,
  catchSpawnGapMs,
  catchSpawnKind,
  catchSpeedMult,
  missFood,
  tapBomb,
  trainOutcome,
  trainTap,
  type CatchTally,
  type RoundOutcome,
  type SpawnKind,
  type TrainTally,
} from '@/play/pet-game-rules';

const TICK_MS = 40;

/* ------------------------------------------------------ Catch the food --- */

export const CATCH_ROUND_MS = CATCH.roundMs;
const CATCH_AREA_H = 300;
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

export function CatchFoodGame({ onDone }: { onDone: (outcome: RoundOutcome) => void }) {
  const [width, setWidth] = useState(0);
  const [items, setItems] = useState<Food[]>([]);
  const [tally, setTally] = useState<CatchTally>(EMPTY_CATCH);
  const [leftMs, setLeftMs] = useState<number>(CATCH.roundMs);
  const [flash, setFlash] = useState<'bomb' | 'combo' | null>(null);
  const itemsRef = useRef<Food[]>([]);
  const tallyRef = useRef<CatchTally>(EMPTY_CATCH);
  const elapsedRef = useRef(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const setT = (next: CatchTally) => {
    tallyRef.current = next;
    setTally(next);
  };
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current(catchOutcome(tallyRef.current));
  };

  useEffect(() => {
    let nextId = 0;
    let sinceSpawn = 0;
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
      if (sinceSpawn >= catchSpawnGapMs(elapsed) && elapsed < CATCH.roundMs - 800) {
        sinceSpawn = 0;
        const kind = catchSpawnKind(elapsed, Math.random());
        const speed = (0.32 + Math.random() * 0.08) * catchSpeedMult(elapsed);
        next = [...next, { id: nextId++, x: 0.08 + Math.random() * 0.84, y: -0.1, speed, kind, color: FOOD_COLORS[nextId % FOOD_COLORS.length] }];
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
      setFlash('bomb');
      setTimeout(() => setFlash(null), 250);
      if (next.over) finish();
      return;
    }
    const next = catchFood(tallyRef.current, elapsedRef.current, item.kind === 'golden');
    setT(next);
    if (next.chain > 0 && next.chain % CATCH.comboEvery === 0) {
      setFlash('combo');
      setTimeout(() => setFlash(null), 350);
    }
  };

  return (
    <View>
      <View style={styles.hudRow}>
        <Text style={styles.hudText}>
          Caught {tally.caught} · {tally.points} pts
        </Text>
        <Text style={styles.hudText}>
          💣 {tally.strikes}/{CATCH.bombStrikes} · {Math.ceil(leftMs / 1000)}s
        </Text>
      </View>
      <View style={[styles.area, { height: CATCH_AREA_H }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
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
        {flash === 'bomb' ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.bombFlash]} /> : null}
        {flash === 'combo' ? (
          <Text pointerEvents="none" style={styles.comboText}>
            Combo +1!
          </Text>
        ) : null}
      </View>
      <Text style={styles.hint}>
        Catch half of the food to pass. Golden = +3. Don’t tap 💣 — three ends the round.
      </Text>
    </View>
  );
}

/* -------------------------------------------------------- Tap to train --- */

export const TRAIN_REPS = TRAIN.taps;

function randomZone(width: number): number {
  return width / 2 + 0.05 + Math.random() * (1 - width - 0.1);
}

export function TapTrainGame({ onDone }: { onDone: (outcome: RoundOutcome) => void }) {
  const [marker, setMarker] = useState(0);
  const [tally, setTally] = useState<TrainTally>(START_TRAIN);
  const [zone, setZone] = useState(() => randomZone(TRAIN.zoneStart));
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null);
  const markerRef = useRef(0);
  const dirRef = useRef(1);
  const tallyRef = useRef<TrainTally>(START_TRAIN);
  const zoneRef = useRef(zone);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

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
    const hit = Math.abs(markerRef.current - zoneRef.current) <= width / 2;
    const next = trainTap(tallyRef.current, hit);
    tallyRef.current = next;
    setTally(next);
    setFlash(hit ? 'hit' : 'miss');
    const nextZone = randomZone(next.zone);
    zoneRef.current = nextZone;
    setZone(nextZone);
    if (next.over) {
      doneRef.current = true;
      onDoneRef.current(trainOutcome(next));
    }
  };

  return (
    <View>
      <View style={styles.hudRow}>
        <Text style={styles.hudText}>
          Hits {tally.hits} · need {TRAIN.passHits}
        </Text>
        <Text style={styles.hudText}>
          Tap {Math.min(tally.taps + 1, TRAIN.taps)}/{TRAIN.taps}
          {tally.missStreak > 0 ? ` · misses ${tally.missStreak}/${TRAIN.missStreakEnd}` : ''}
        </Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.zone, { left: `${(zone - tally.zone / 2) * 100}%`, width: `${tally.zone * 100}%` }]} />
        <View style={[styles.marker, { left: `${marker * 100}%` }]} />
      </View>
      <Text style={[styles.hint, flash === 'hit' && styles.hit, flash === 'miss' && styles.miss]}>
        {flash === 'hit'
          ? 'Nice! The zone shrinks…'
          : flash === 'miss'
            ? `Missed — ${TRAIN.missStreakEnd} in a row ends it.`
            : `Tap in the lit zone. ${TRAIN.passHits} hits out of ${TRAIN.taps} to pass.`}
      </Text>
      <Pressable
        onPressIn={tap}
        accessibilityRole="button"
        accessibilityLabel="Tap to train"
        style={({ pressed }) => [styles.tapButton, pressed && styles.pressed]}>
        <Text style={styles.tapText}>TAP</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hudRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  hudText: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: NEON.cyan,
  },
  area: {
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 234, 255, 0.04)',
  },
  food: {
    position: 'absolute',
    width: FOOD_SIZE,
    height: FOOD_SIZE,
  },
  hint: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: NEON.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  hit: { color: '#7CE38B' },
  miss: { color: NEON.pink },
  bar: {
    height: 36,
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 234, 255, 0.04)',
  },
  zone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(124, 227, 139, 0.35)',
  },
  marker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 4,
    marginLeft: -2,
    backgroundColor: NEON.cyan,
  },
  tapButton: {
    marginTop: 12,
    minHeight: 72,
    borderWidth: 1,
    borderColor: NEON.cyan,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NEON.cyanSoft,
  },
  tapText: {
    fontFamily: Fonts.monoBold,
    fontSize: 22,
    letterSpacing: 4,
    color: NEON.cyan,
  },
  pressed: { opacity: 0.7 },
  emojiItem: { fontSize: 30, textAlign: 'center' },
  bombFlash: { backgroundColor: 'rgba(255, 60, 80, 0.35)' },
  comboText: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    fontFamily: Fonts.monoBold,
    fontSize: 16,
    color: '#FFD700',
  },
});
