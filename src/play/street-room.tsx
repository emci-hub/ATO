/**
 * Streetwear Hideout — isometric room, map-driven spots, room life, slim strip.
 *
 * Art is rooms/hideout-iso (packed ui-kit). Spots / walk / lights come from
 * hideout-iso.map.json. Spot labels are Departure Mono mustard tags; each
 * fades to 40% after its first tap. "Show labels" in Info restores them.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PET_METER_MAX } from '@/play/pet';
import { GRADE_LABEL, WARMTH_MAX, type Grade } from '@/play/pet-eggs';
import {
  HIDEOUT_DECALS,
  HIDEOUT_LIGHTS,
  HIDEOUT_SPOTS,
  hideoutLabelAnchor,
  type HideoutScale,
  type HideoutSpot,
} from '@/play/hideout-iso';
import { PIXEL_FONT } from '@/play/pixel-theme';
import { ClipImage } from '@/play/sheet-sprite';
import { AmbientSprite, Drift, Twinkle, kitDrawable } from '@/play/street-ambient';
import { KEEP_TRAVEL_PT } from '@/play/play-motion';
import { tapHaptic } from '@/play/street-feel';
import { STREET } from '@/play/street-ui';

export type StreetSpotId = 'feed' | 'play' | 'expedition' | 'dive' | 'den';

const SEEN_KEY = 'ato.street.hideoutSpotsSeen.v2';
const SHOW_KEY = 'ato.street.hideoutShowLabels';

const listeners = new Set<() => void>();
let showAllLabels = false;

function emitLabels() {
  for (const fn of listeners) fn();
}

export function setHideoutShowLabels(on: boolean): void {
  showAllLabels = on;
  emitLabels();
  AsyncStorage.setItem(SHOW_KEY, on ? '1' : '0').catch(() => {});
}

export function useHideoutShowLabels(): boolean {
  const [on, setOn] = useState(showAllLabels);
  useEffect(() => {
    const fn = () => setOn(showAllLabels);
    listeners.add(fn);
    AsyncStorage.getItem(SHOW_KEY)
      .then((v) => {
        if (v === '1') {
          showAllLabels = true;
          setOn(true);
        }
      })
      .catch(() => {});
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return on;
}

export type StreetRoomSpotsProps = {
  onSpot: (id: StreetSpotId) => void;
  pulse: StreetSpotId | null;
  notes: Partial<Record<StreetSpotId, string>>;
};

export function StreetRoomArt({
  left,
  top,
  scale,
  alive,
}: {
  left: number;
  top: number;
  scale: HideoutScale;
  alive: boolean;
}) {
  const k = scale.pt;
  return (
    <View style={{ position: 'absolute', left, top, width: scale.canvasW, height: scale.canvasH }}>
      <ClipImage drawable={kitDrawable('room-hideout-iso')} />
      {HIDEOUT_DECALS.map((d) => (
        <View
          key={d.id}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: Math.round(d.pos[0] * k),
            top: Math.round(d.pos[1] * k),
          }}>
          <ClipImage drawable={kitDrawable(`room-hideout-iso-${d.id}`)} />
        </View>
      ))}
    </View>
  );
}

export function StreetRoomFront({ left, top, scale }: { left: number; top: number; scale: HideoutScale }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left, top, width: scale.canvasW, height: scale.canvasH }}>
      <ClipImage drawable={kitDrawable('room-hideout-iso-front')} />
    </View>
  );
}

/** String-light twinkles + boombox notes + a moth. Travel capped under vestibularSafe. */
export function StreetRoomLife({
  left,
  top,
  scale,
  alive,
  gentle,
  minimal,
}: {
  left: number;
  top: number;
  scale: HideoutScale;
  alive: boolean;
  gentle: boolean;
  minimal: boolean;
}) {
  const k = scale.pt;
  const lights = minimal ? HIDEOUT_LIGHTS.filter((_, i) => i % 2 === 0) : HIDEOUT_LIGHTS;
  const travel = gentle ? Math.min(18, KEEP_TRAVEL_PT) : 28;
  const at = (x: number, y: number) => ({ x: left + x * k, y: top + y * k });
  const boom = at(40, 170);
  const moth0 = at(130, 90);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {lights.map(([x, y], i) => (
        <Twinkle
          key={`l${i}`}
          x={left + x * k}
          y={top + y * k}
          size={2 * k}
          ms={1400 + (i % 4) * 380}
          delay={i * 170}
          alive={alive}
          color="#FFE29A"
        />
      ))}
      <Drift
        alive={alive}
        size={22}
        x0={boom.x}
        y0={boom.y}
        x1={boom.x + travel}
        y1={boom.y - travel}
        ms={2600}
        rest={1200}>
        <AmbientSprite name="amb-note" size={22} />
      </Drift>
      {minimal ? null : (
        <Drift
          alive={alive}
          size={22}
          x0={boom.x + 8}
          y0={boom.y}
          x1={boom.x - travel * 0.6}
          y1={boom.y - travel}
          ms={3100}
          rest={1700}
          delay={1300}>
          <AmbientSprite name="amb-note2" size={22} />
        </Drift>
      )}
      <Drift
        alive={alive}
        size={20}
        x0={moth0.x}
        y0={moth0.y}
        x1={moth0.x + (gentle ? 16 : 28)}
        y1={moth0.y - 12}
        ms={3800}
        rest={2400}
        delay={800}>
        <AmbientSprite name="amb-moth" size={20} />
      </Drift>
    </View>
  );
}

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

export function StreetRoomSpots({
  left,
  top,
  scale,
  onSpot,
  pulse,
  notes,
  still,
  petHit,
}: StreetRoomSpotsProps & {
  left: number;
  top: number;
  scale: HideoutScale;
  still: boolean;
  /** Pet hit box in screen pt — slop must not overlap it. */
  petHit: { x: number; y: number; w: number; h: number } | null;
}) {
  const k = scale.pt;
  const showAll = useHideoutShowLabels();
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(SEEN_KEY)
      .then((v) => {
        if (!live || !v) return;
        try {
          const ids = JSON.parse(v) as string[];
          const next: Record<string, boolean> = {};
          for (const id of ids) next[id] = true;
          setSeen(next);
        } catch {
          // ignore
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const press = (spot: HideoutSpot) => {
    tapHaptic();
    if (!seen[spot.id]) {
      const next = { ...seen, [spot.id]: true };
      setSeen(next);
      AsyncStorage.setItem(SEEN_KEY, JSON.stringify(Object.keys(next))).catch(() => {});
    }
    onSpot(spot.coach);
  };
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {HIDEOUT_SPOTS.map((s) => {
        const [x, y, w, h] = s.rect;
        const note = notes[s.coach];
        const leftPt = left + x * k;
        const topPt = top + y * k;
        const width = w * k;
        const height = h * k;
        let slopX = Math.max(0, (48 - width) / 2);
        let slopY = Math.max(0, (48 - height) / 2);
        if (petHit) {
          const hitL = leftPt - slopX;
          const hitR = leftPt + width + slopX;
          const hitT = topPt - slopY;
          const hitB = topPt + height + slopY;
          const overlap =
            hitL < petHit.x + petHit.w && hitR > petHit.x && hitT < petHit.y + petHit.h && hitB > petHit.y;
          if (overlap) {
            slopX = 0;
            slopY = 0;
          }
        }
        const faded = !showAll && seen[s.id] && pulse !== s.coach;
        const anchor = hideoutLabelAnchor(s.id);
        return (
          <Pressable
            key={s.id}
            onPress={() => press(s)}
            hitSlop={{ left: slopX, right: slopX, top: slopY, bottom: slopY }}
            accessibilityRole="button"
            accessibilityLabel={`${s.thing}, ${s.action}${note ? `, ${note}` : ''}`}
            style={({ pressed }) => [
              styles.spot,
              { left: leftPt, top: topPt, width, height },
              pressed && styles.pressed,
            ]}>
            {pulse === s.coach ? <PulseRing still={still} /> : null}
            <View
              pointerEvents="none"
              style={[
                styles.tagWrap,
                {
                  left: left + anchor[0] * k - leftPt - 40,
                  top: top + anchor[1] * k - topPt - 14,
                  opacity: faded ? 0.4 : 1,
                },
              ]}>
              <View style={styles.dot} />
              <Text style={[styles.tag, pulse === s.coach && styles.tagHot]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {s.id === 'manhole' ? 'manhole · Underground' : s.action}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Cells({
  label,
  value,
  max,
  color,
  still,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  still: boolean;
}) {
  const pop = useSharedValue(1);
  const last = useRef(value);
  useEffect(() => {
    if (last.current === value) return;
    last.current = value;
    if (still) return;
    pop.value = withSequence(withTiming(1.04, { duration: 110 }), withTiming(1, { duration: 160 }));
  }, [pop, still, value]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <View style={styles.meter}>
      <Text style={styles.meterLabel} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
      <Animated.View style={[styles.cells, style]}>
        {Array.from({ length: max }, (_, i) => (
          <View key={i} style={[styles.cell, i < value ? { backgroundColor: color } : null]} />
        ))}
      </Animated.View>
    </View>
  );
}

/** Slim Hideout strip: name · stage · Hunger · Mood · grade chip. */
export function StreetStatusStrip({
  egg,
  picking,
  hunger,
  mood,
  warmth,
  stageLabel,
  name,
  grade,
  shiny,
  reduceMotion,
}: {
  egg: boolean;
  picking: boolean;
  hunger: number;
  mood: number;
  warmth: number;
  stageLabel: string;
  name?: string | null;
  grade?: Grade | null;
  shiny?: boolean;
  reduceMotion: boolean;
}) {
  const low = (v: number) => (v <= 1 ? STREET.red : STREET.mustard);
  return (
    <View style={styles.strip}>
      {name ? (
        <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {name}
        </Text>
      ) : null}
      {!picking ? (
        <Text style={styles.stage} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {stageLabel}
        </Text>
      ) : null}
      <View
        style={styles.stripMain}
        accessible
        accessibilityLabel={
          egg ? `Warmth ${warmth} of ${WARMTH_MAX}` : `Hunger ${hunger} of ${PET_METER_MAX}, mood ${mood} of ${PET_METER_MAX}`
        }>
        {picking ? (
          <Text style={styles.stripText} maxFontSizeMultiplier={1.2}>
            Pick an egg
          </Text>
        ) : egg ? (
          <Cells label="Warmth" value={warmth} max={WARMTH_MAX} color={STREET.mustard} still={reduceMotion} />
        ) : (
          <>
            <Cells label="Hunger" value={hunger} max={PET_METER_MAX} color={low(hunger)} still={reduceMotion} />
            <Cells label="Mood" value={mood} max={PET_METER_MAX} color={low(mood)} still={reduceMotion} />
          </>
        )}
      </View>
      {grade ? (
        <Text style={styles.grade} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {GRADE_LABEL[grade]}
          {shiny ? ' ★' : ''}
        </Text>
      ) : null}
    </View>
  );
}

/** Paper speech bubble with a tail — coach tip or a spoken line. */
export function StreetSpeechBubble({ text, left, top }: { text: string; left: number; top: number }) {
  return (
    <View pointerEvents="none" style={[styles.bubble, { left, top }]}>
      <Text style={styles.bubbleText} maxFontSizeMultiplier={1.2}>
        {text}
      </Text>
      <View style={styles.tail} />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 8,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 36,
    backgroundColor: 'rgba(26, 26, 29, 0.92)',
    borderWidth: 2,
    borderColor: '#000',
  },
  stripMain: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  stripText: { fontFamily: PIXEL_FONT.label, fontSize: 12, color: STREET.paper, includeFontPadding: false },
  name: {
    fontFamily: PIXEL_FONT.label,
    fontSize: 12,
    color: STREET.paper,
    textTransform: 'uppercase',
    includeFontPadding: false,
    flexShrink: 1,
  },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meterLabel: { fontFamily: PIXEL_FONT.label, fontSize: 11, color: STREET.muted, textTransform: 'uppercase', includeFontPadding: false },
  cells: { flexDirection: 'row', gap: 2 },
  cell: { width: 8, height: 10, backgroundColor: '#3f3f46', borderWidth: 1, borderColor: '#000' },
  stage: {
    fontFamily: PIXEL_FONT.label,
    fontSize: 11,
    color: STREET.ink,
    backgroundColor: STREET.mustard,
    paddingHorizontal: 5,
    paddingVertical: 1,
    textTransform: 'uppercase',
    includeFontPadding: false,
    overflow: 'hidden',
  },
  grade: {
    fontFamily: PIXEL_FONT.label,
    fontSize: 10,
    color: STREET.ink,
    backgroundColor: STREET.paper,
    paddingHorizontal: 5,
    paddingVertical: 1,
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
  spot: { position: 'absolute', borderRadius: 4 },
  pulse: { borderWidth: 2, borderColor: STREET.mustard, borderStyle: 'dashed' },
  pressed: { backgroundColor: 'rgba(224, 165, 38, 0.18)' },
  tagWrap: { position: 'absolute', width: 80, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: STREET.mustard, marginBottom: 2 },
  tag: {
    fontFamily: PIXEL_FONT.label,
    fontSize: 10,
    color: STREET.mustard,
    includeFontPadding: false,
    textTransform: 'uppercase',
  },
  tagHot: { color: STREET.paper },
  bubble: {
    position: 'absolute',
    maxWidth: 200,
    backgroundColor: STREET.paper,
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  bubbleText: {
    fontFamily: PIXEL_FONT.label,
    fontSize: 11,
    color: STREET.ink,
    includeFontPadding: false,
  },
  tail: {
    position: 'absolute',
    left: 16,
    bottom: -8,
    width: 10,
    height: 8,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: STREET.paper,
  },
});
