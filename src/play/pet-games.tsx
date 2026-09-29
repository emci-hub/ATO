/**
 * Pet mini-games (v20, 2026-09-29) — two short vector rounds, no new art.
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

const TICK_MS = 40;

/* ------------------------------------------------------ Catch the food --- */

export const CATCH_ROUND_MS = 20_000;
const CATCH_SPAWN_MS = 650;
const CATCH_AREA_H = 300;
const FOOD_SIZE = 40;
const FOOD_COLORS = ['#FF6B6B', '#FFD86B', '#7CE38B'] as const;

type Food = { id: number; x: number; y: number; speed: number; color: string };

function FoodShape({ color }: { color: string }) {
  return (
    <Svg width={FOOD_SIZE} height={FOOD_SIZE} viewBox="0 0 40 40">
      <Circle cx="20" cy="23" r="13" fill={color} />
      <Circle cx="15" cy="19" r="3.5" fill="#FFFFFF" fillOpacity={0.45} />
      <Path d="M20 10 Q24 4 29 6 Q26 11 20 10 Z" fill="#7CE38B" />
    </Svg>
  );
}

export function CatchFoodGame({ onDone }: { onDone: (score: number) => void }) {
  const [width, setWidth] = useState(0);
  const [foods, setFoods] = useState<Food[]>([]);
  const [score, setScore] = useState(0);
  const [leftMs, setLeftMs] = useState(CATCH_ROUND_MS);
  const foodsRef = useRef<Food[]>([]);
  const scoreRef = useRef(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let nextId = 0;
    let sinceSpawn = CATCH_SPAWN_MS;
    let elapsed = 0;
    const id = setInterval(() => {
      if (doneRef.current) return;
      elapsed += TICK_MS;
      sinceSpawn += TICK_MS;
      let next = foodsRef.current
        .map((f) => ({ ...f, y: f.y + (f.speed * TICK_MS) / 1000 }))
        .filter((f) => f.y < 1.05);
      if (sinceSpawn >= CATCH_SPAWN_MS && elapsed < CATCH_ROUND_MS - 800) {
        sinceSpawn = 0;
        // Falls a little faster as the round goes on.
        const speed = 0.32 + 0.28 * (elapsed / CATCH_ROUND_MS) + Math.random() * 0.08;
        next = [
          ...next,
          {
            id: nextId++,
            x: 0.08 + Math.random() * 0.84,
            y: -0.1,
            speed,
            color: FOOD_COLORS[nextId % FOOD_COLORS.length],
          },
        ];
      }
      foodsRef.current = next;
      setFoods(next);
      const left = Math.max(0, CATCH_ROUND_MS - elapsed);
      setLeftMs(left);
      if (left <= 0) {
        doneRef.current = true;
        onDoneRef.current(scoreRef.current);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const catchFood = (foodId: number) => {
    if (doneRef.current) return;
    if (!foodsRef.current.some((f) => f.id === foodId)) return;
    foodsRef.current = foodsRef.current.filter((f) => f.id !== foodId);
    setFoods(foodsRef.current);
    scoreRef.current += 1;
    setScore(scoreRef.current);
  };

  return (
    <View>
      <View style={styles.hudRow}>
        <Text style={styles.hudText}>Caught {score}</Text>
        <Text style={styles.hudText}>{Math.ceil(leftMs / 1000)}s</Text>
      </View>
      <View
        style={[styles.area, { height: CATCH_AREA_H }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0
          ? foods.map((f) => (
              <Pressable
                key={f.id}
                onPressIn={() => catchFood(f.id)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Catch food"
                style={[
                  styles.food,
                  {
                    left: f.x * (width - FOOD_SIZE),
                    top: f.y * (CATCH_AREA_H - FOOD_SIZE),
                  },
                ]}>
                <FoodShape color={f.color} />
              </Pressable>
            ))
          : null}
      </View>
      <Text style={styles.hint}>Tap the food before it falls away.</Text>
    </View>
  );
}

/* -------------------------------------------------------- Tap to train --- */

export const TRAIN_REPS = 10;
const ZONE_WIDTH = 0.22;

function randomZone(): number {
  return ZONE_WIDTH / 2 + 0.05 + Math.random() * (1 - ZONE_WIDTH - 0.1);
}

export function TapTrainGame({ onDone }: { onDone: (score: number) => void }) {
  const [marker, setMarker] = useState(0);
  const [zone, setZone] = useState(randomZone);
  const [rep, setRep] = useState(0);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null);
  const markerRef = useRef(0);
  const dirRef = useRef(1);
  const repRef = useRef(0);
  const scoreRef = useRef(0);
  const zoneRef = useRef(zone);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const id = setInterval(() => {
      if (doneRef.current) return;
      // Sweeps faster with every try.
      const speed = 0.9 + repRef.current * 0.09;
      let p = markerRef.current + (dirRef.current * speed * TICK_MS) / 1000;
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
    const hit = Math.abs(markerRef.current - zoneRef.current) <= ZONE_WIDTH / 2;
    if (hit) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
    }
    setFlash(hit ? 'hit' : 'miss');
    repRef.current += 1;
    setRep(repRef.current);
    const nextZone = randomZone();
    zoneRef.current = nextZone;
    setZone(nextZone);
    if (repRef.current >= TRAIN_REPS) {
      doneRef.current = true;
      onDoneRef.current(scoreRef.current);
    }
  };

  return (
    <View>
      <View style={styles.hudRow}>
        <Text style={styles.hudText}>Hits {score}</Text>
        <Text style={styles.hudText}>
          Try {Math.min(rep + 1, TRAIN_REPS)}/{TRAIN_REPS}
        </Text>
      </View>
      <View style={styles.bar}>
        <View
          style={[
            styles.zone,
            { left: `${(zone - ZONE_WIDTH / 2) * 100}%`, width: `${ZONE_WIDTH * 100}%` },
          ]}
        />
        <View style={[styles.marker, { left: `${marker * 100}%` }]} />
      </View>
      <Text style={[styles.hint, flash === 'hit' && styles.hit, flash === 'miss' && styles.miss]}>
        {flash === 'hit' ? 'Nice!' : flash === 'miss' ? 'Missed — next one.' : 'Tap when the marker is in the lit zone.'}
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
});
