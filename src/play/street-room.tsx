/**
 * Streetwear Hideout room (emci 2026-10-11) — the full-height street room on
 * the pet plate, its tappable spots, and its ambient life.
 *
 * The art is fitted at pack time to the plate (197×426 art px, MOCKUP_PLATE),
 * so every rect below is in plate art px, the same frame the pet's feet line,
 * nameplate and speech bubble use. Spots sit ABOVE the art and BELOW the pet:
 * where they overlap, a tap on the pet stays a tap on the pet.
 *
 * Spots call the screen's own `openIcon` / Stash sheet — the same handlers the
 * buttons use; nothing new happens. The first time, each spot shows a small
 * label; one tap on any spot hides them (device-local flag).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PET_METER_MAX } from '@/play/pet';
import { WARMTH_MAX } from '@/play/pet-eggs';
import { MOCKUP_PLATE } from '@/play/pixel-atlas';
import { ART_PT } from '@/play/pixel-theme';
import { ClipImage } from '@/play/sheet-sprite';
import { AmbientSprite, Drift, Twinkle, kitDrawable } from '@/play/street-ambient';
import { STREET_MOTION, tapHaptic } from '@/play/street-feel';
import { STREET, STREET_FONT } from '@/play/street-ui';

export type StreetSpotId = 'feed' | 'play' | 'expedition' | 'dive' | 'den';

/** Spot rects in plate art px: [x, y, w, h], plus the object + action words. */
export const STREET_SPOTS: readonly { id: StreetSpotId; rect: [number, number, number, number]; thing: string; action: string; tagSide?: boolean }[] = [
  { id: 'expedition', rect: [22, 169, 60, 114], thing: 'Door', action: 'Explore' },
  { id: 'den', rect: [97, 224, 64, 64], thing: 'Chair', action: 'Stash' },
  { id: 'play', rect: [9, 324, 38, 64], thing: 'Boombox', action: 'Play' },
  { id: 'dive', rect: [77, 329, 44, 30], thing: 'Manhole', action: 'Underground', tagSide: true },
  { id: 'feed', rect: [155, 366, 38, 32], thing: 'Bowl', action: 'Feed' },
];

const SEEN_KEY = 'ato.street.hideoutSpotsSeen';

export type StreetRoomSpotsProps = {
  onSpot: (id: StreetSpotId) => void;
  /** The coach's suggested action (colour only, so Reduce Motion stays still). */
  pulse: StreetSpotId | null;
  /** Short state notes ("Ride in progress", "7/10 tokens", "Back in 4m"). */
  notes: Partial<Record<StreetSpotId, string>>;
};

/** The room art, covering the plate. */
export function StreetRoomArt({ left, top, alive }: { left: number; top: number; alive: boolean }) {
  const k = ART_PT;
  return (
    <Animated.View
      entering={alive ? FadeIn.duration(STREET_MOTION.sheet) : undefined}
      style={{ position: 'absolute', left, top, width: MOCKUP_PLATE.w * k, height: MOCKUP_PLATE.h * k }}>
      <ClipImage drawable={kitDrawable('room-hideout-full')} />
    </Animated.View>
  );
}

/** Room life: string lights, city windows, boombox notes, a moth, a pigeon on the sill. */
export function StreetRoomLife({ left, top, alive }: { left: number; top: number; alive: boolean }) {
  const k = ART_PT;
  const at = (x: number) => left + x * k;
  const y = (v: number) => top + v * k;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 9 }, (_, i) => (
        <Twinkle key={`l${i}`} x={at(13 + i * 21)} y={y(147)} size={2 * k} ms={1400 + (i % 4) * 380} delay={i * 170} alive={alive} color="#FFE29A" />
      ))}
      {[[50, 40], [62, 52], [76, 34], [90, 60]].map(([x, v], i) => (
        <Twinkle key={`w${i}`} x={at(x)} y={y(v)} size={k * 1.5} ms={2600 + i * 700} delay={i * 900} alive={alive} color="#FCD34D" />
      ))}
      <Drift alive={alive} size={26} x0={at(26)} y0={y(318)} x1={at(34)} y1={y(268)} ms={2600} rest={1200}>
        <AmbientSprite name="amb-note" size={26} />
      </Drift>
      <Drift alive={alive} size={26} x0={at(34)} y0={y(318)} x1={at(20)} y1={y(272)} ms={3100} rest={1700} delay={1300}>
        <AmbientSprite name="amb-note2" size={26} />
      </Drift>
      <Drift alive={alive} size={22} x0={at(120)} y0={y(160)} x1={at(150)} y1={y(140)} ms={3800} rest={2400} delay={800}>
        <AmbientSprite name="amb-moth" size={22} />
      </Drift>
      <Drift alive={alive} size={30} x0={at(40)} y0={y(70)} x1={at(110)} y1={y(70)} ms={8000} rest={11000} delay={4000} bob={2}>
        <AmbientSprite name="amb-pigeon" size={30} />
      </Drift>
    </View>
  );
}

/** The tappable spots (accessible buttons, at least 48pt with slop). */
export function StreetRoomSpots({
  left,
  top,
  onSpot,
  pulse,
  notes,
  still,
}: StreetRoomSpotsProps & { left: number; top: number; still: boolean }) {
  const k = ART_PT;
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(SEEN_KEY)
      .then((v) => {
        if (live) setSeen(v === '1');
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const press = (id: StreetSpotId) => {
    tapHaptic();
    if (!seen) {
      setSeen(true);
      AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
    }
    onSpot(id);
  };
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {STREET_SPOTS.map((s) => {
        const [x, y, w, h] = s.rect;
        const note = notes[s.id];
        const slopX = Math.max(0, (48 - w * k) / 2);
        const slopY = Math.max(0, (48 - h * k) / 2);
        return (
          <Pressable
            key={s.id}
            onPress={() => press(s.id)}
            hitSlop={{ left: slopX, right: slopX, top: slopY, bottom: slopY }}
            accessibilityRole="button"
            accessibilityLabel={`${s.thing}, ${s.action}${note ? `, ${note}` : ''}`}
            style={({ pressed }) => [
              styles.spot,
              { left: left + x * k, top: top + y * k, width: w * k, height: h * k },
              pressed && styles.pressed,
            ]}>
            {pulse === s.id ? <PulseRing still={still} /> : null}
            {/* Tags only on the first visit or for the coach's hint; notes stay in the a11y label. */}
            {!seen || pulse === s.id ? (
              <View style={s.tagSide ? styles.tagSide : styles.tagWrap} pointerEvents="none">
                <Text style={[styles.tag, pulse === s.id && styles.tagHot]} numberOfLines={1}>
                  {note && !s.tagSide ? `${s.action} · ${note}` : s.action}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** The coach's suggested spot: a mustard ring that breathes (still under Reduce Motion — the
 * ring itself is the cue, colour not motion). */
function PulseRing({ still }: { still: boolean }) {
  const t = useSharedValue(1);
  useEffect(() => {
    if (still) {
      t.value = 1;
      return;
    }
    t.value = withRepeat(withSequence(withTiming(0.35, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
    return () => cancelAnimation(t);
  }, [still, t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pulse, style]} />;
}

/** One small meter: label + 4 cells; the row pops when the value changes. */
function Cells({ label, value, max, color, still }: { label: string; value: number; max: number; color: string; still: boolean }) {
  const pop = useSharedValue(1);
  const last = useRef(value);
  useEffect(() => {
    if (last.current === value) return;
    last.current = value;
    if (still) return;
    pop.value = withSequence(withTiming(1.18, { duration: 110 }), withTiming(1, { duration: 160 }));
  }, [pop, still, value]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <View style={styles.meter}>
      <Text style={styles.meterLabel}>{label}</Text>
      <Animated.View style={[styles.cells, style]}>
        {Array.from({ length: max }, (_, i) => (
          <View key={i} style={[styles.cell, i < value ? { backgroundColor: color } : null]} />
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * Streetwear Hideout status strip — one slim row (≈40pt) instead of the hearts
 * panel: Hunger + Mood (or Warmth for an egg), the stage and the treats left.
 * Same screen-reader words as the Classic panel.
 */
export function StreetStatusStrip({
  egg,
  picking,
  hunger,
  mood,
  warmth,
  stageLabel,
  pantry,
  reduceMotion,
}: {
  egg: boolean;
  picking: boolean;
  hunger: number;
  mood: number;
  warmth: number;
  stageLabel: string;
  pantry: number;
  reduceMotion: boolean;
}) {
  const low = (v: number) => (v <= 1 ? STREET.red : STREET.mustard);
  return (
    <View style={styles.strip}>
      <View
        style={styles.stripMain}
        accessible
        accessibilityLabel={
          egg ? `Warmth ${warmth} of ${WARMTH_MAX}` : `Hunger ${hunger} of ${PET_METER_MAX}, mood ${mood} of ${PET_METER_MAX}`
        }>
        {picking ? (
          <Text style={styles.stripText}>Pick an egg</Text>
        ) : egg ? (
          <Cells label="Warmth" value={warmth} max={WARMTH_MAX} color={STREET.mustard} still={reduceMotion} />
        ) : (
          <>
            <Cells label="Hunger" value={hunger} max={PET_METER_MAX} color={low(hunger)} still={reduceMotion} />
            <Cells label="Mood" value={mood} max={PET_METER_MAX} color={low(mood)} still={reduceMotion} />
          </>
        )}
      </View>
      {!picking ? <Text style={styles.stage}>{stageLabel}</Text> : null}
      <Text style={styles.pantry} accessibilityLabel={`${pantry} ${pantry === 1 ? 'treat' : 'treats'} in the pantry`}>
        {`×${pantry}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 8,
    marginTop: 4,
    paddingHorizontal: 12,
    minHeight: 40,
    backgroundColor: 'rgba(26, 26, 29, 0.92)',
    borderWidth: 2,
    borderColor: '#000',
  },
  stripMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  stripText: { fontFamily: STREET_FONT.bold, fontSize: 13, color: STREET.paper },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meterLabel: { fontFamily: STREET_FONT.bold, fontSize: 12, color: STREET.muted, textTransform: 'uppercase' },
  cells: { flexDirection: 'row', gap: 2 },
  cell: { width: 9, height: 12, backgroundColor: '#3f3f46', borderWidth: 1, borderColor: '#000' },
  stage: {
    fontFamily: STREET_FONT.bold,
    fontSize: 12,
    color: STREET.ink,
    backgroundColor: STREET.mustard,
    paddingHorizontal: 6,
    paddingVertical: 1,
    textTransform: 'uppercase',
    overflow: 'hidden',
  },
  pantry: { fontFamily: STREET_FONT.bold, fontSize: 13, color: STREET.mustard },
  spot: { position: 'absolute', borderRadius: 4 },
  pulse: { borderWidth: 2, borderColor: STREET.mustard, borderStyle: 'dashed' },
  pressed: { backgroundColor: 'rgba(224, 165, 38, 0.18)' },
  tagWrap: { position: 'absolute', left: -40, right: -40, top: -22, alignItems: 'center' },
  // The manhole sits under the pet's grade plate: its tag goes beside it, clear of the plate.
  tagSide: { position: 'absolute', left: '100%', marginLeft: 26, top: 6, width: 130, alignItems: 'flex-start' },
  tag: {
    fontFamily: STREET_FONT.bold,
    fontSize: 11,
    color: STREET.ink,
    backgroundColor: STREET.paper,
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 5,
    paddingVertical: 1,
    textTransform: 'uppercase',
    overflow: 'hidden',
  },
  tagHot: { backgroundColor: STREET.mustard },
});
