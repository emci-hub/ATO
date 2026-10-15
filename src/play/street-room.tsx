/**
 * Streetwear Hideout — 3/4 top-down room, map-driven spots, room life, slim strip.
 *
 * Art is the swappable greybox under assets/art/rooms/ (hideout-td-*). Spots /
 * walk / lights come from hideout-td.map.json. Spot labels are Departure Mono
 * mustard tags; each fades to 40% after its first tap. "Show labels" in Info
 * restores them.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PET_METER_MAX } from '@/play/pet';
import { GRADE_LABEL, WARMTH_MAX, type Grade } from '@/play/pet-eggs';
import { LOFT_WINDOW_POS, LOFT_WINDOW_SIZE, ROOM_ART, SPOT_ICON_ART } from '@/play/hideout-art';
import {
  HIDEOUT_LIGHTS,
  HIDEOUT_NIGHT,
  HIDEOUT_SPOTS,
  HIDEOUT_SPOT_HIT_PT,
  HIDEOUT_TILE,
  hideoutLabelAnchor,
  occluderProps,
  parseIsoGeom,
  type HideoutProp,
  type HideoutScale,
  type HideoutSpot,
} from '@/play/hideout-iso';
import type { HideoutRoomId } from '@/play/hideout-progress';
import { PIXEL, PIXEL_FONT, pixelRenderStyle } from '@/play/pixel-theme';
import { AmbientSprite, Drift, Twinkle } from '@/play/street-ambient';
import { KEEP_TRAVEL_PT } from '@/play/play-motion';
import { tapHaptic } from '@/play/street-feel';
import { tipAnchorRef } from '@/play/ftue/tip-anchors';
import { STREET, STREET_FONT, StreetFrame, streetButtonPiece, streetButtonText } from '@/play/street-ui';

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

function Layer({
  source,
  w,
  h,
}: {
  source: unknown;
  w: number;
  h: number;
}) {
  if (!source) return null;
  return (
    <Image source={source as never} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, ...pixelRenderStyle }} contentFit="fill" transition={0} />
  );
}

function NeonLayers({
  a,
  b,
  w,
  h,
  alive,
  gentle,
}: {
  a: unknown;
  b: unknown;
  w: number;
  h: number;
  alive: boolean;
  gentle: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(t);
    t.value = 0;
    if (!alive) return;
    const keep = { reduceMotion: ReduceMotion.Never };
    const ms = gentle ? 2200 : 1600;
    t.value = withRepeat(withSequence(withTiming(1, { duration: ms, ...keep }), withTiming(0, { duration: ms, ...keep })), -1);
    return () => cancelAnimation(t);
  }, [alive, gentle, t]);
  const aStyle = useAnimatedStyle(() => ({ opacity: 0.85 - t.value * 0.25 }));
  const bStyle = useAnimatedStyle(() => ({ opacity: 0.45 + t.value * 0.5 }));
  return (
    <>
      {a ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h }, aStyle]}>
          <Image source={a as never} style={{ width: w, height: h, ...pixelRenderStyle }} contentFit="fill" transition={0} />
        </Animated.View>
      ) : null}
      {b ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h }, bStyle]}>
          <Image source={b as never} style={{ width: w, height: h, ...pixelRenderStyle }} contentFit="fill" transition={0} />
        </Animated.View>
      ) : null}
    </>
  );
}

/** Map-driven 3/4 room stack: back, floor, neon A/B, props. Occluder crops are a sibling. */
export function StreetRoomArt({
  left,
  top,
  scale,
  alive,
  room = 'hideout',
  night = false,
  gentle = false,
  lampOn = false,
}: {
  left: number;
  top: number;
  scale: HideoutScale;
  alive: boolean;
  room?: HideoutRoomId;
  night?: boolean;
  gentle?: boolean;
  lampOn?: boolean;
}) {
  const art = ROOM_ART[room];
  const w = scale.canvasW;
  const h = scale.canvasH;
  const k = scale.pt;
  const win = room === 'loft' ? art : null;
  return (
    <View style={{ position: 'absolute', left, top, width: w, height: h }}>
      <Layer source={art.back ?? art.shell} w={w} h={h} />
      <Layer source={art.floor} w={w} h={h} />
      {win?.windowDay || win?.windowNight ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: LOFT_WINDOW_POS[0] * k,
            top: LOFT_WINDOW_POS[1] * k,
            width: LOFT_WINDOW_SIZE[0] * k,
            height: LOFT_WINDOW_SIZE[1] * k,
          }}>
          <Image
            source={(night ? win.windowNight : win.windowDay) as never}
            style={{ width: LOFT_WINDOW_SIZE[0] * k, height: LOFT_WINDOW_SIZE[1] * k, ...pixelRenderStyle }}
            contentFit="fill"
            transition={0}
          />
        </View>
      ) : null}
      <NeonLayers a={art.neonA} b={art.neonB} w={w} h={h} alive={alive} gentle={gentle} />
      <Layer source={art.props} w={w} h={h} />
      {night && lampOn && art.glow ? <Layer source={art.glow} w={w} h={h} /> : null}
    </View>
  );
}

/**
 * Habbo-style room surround: the iso diamond sits in a rectangle, so the
 * leftover viewport is a tiled night brick (palette only, integer cells) plus
 * a radial vignette that keeps the room the lit focus.
 */
export function StreetRoomYard({ width, height, scale }: { width: number; height: number; scale: HideoutScale }) {
  const pt = scale.pt;
  const bw = Math.max(2, Math.round(10 * pt));
  const bh = Math.max(2, Math.round(5 * pt));
  const m = Math.max(1, Math.round(pt));
  const pw = bw * 2 + m;
  const ph = (bh + m) * 2;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Defs>
          <Pattern id="hideoutBricks" x={0} y={0} width={pw} height={ph} patternUnits="userSpaceOnUse">
            <Rect x={0} y={0} width={pw} height={ph} fill="#08090F" />
            <Rect x={m} y={m} width={bw - m} height={bh} fill="#1C1522" />
            <Rect x={bw + m} y={m} width={bw - m} height={bh} fill="#251A28" />
            <Rect x={m - bw / 2} y={bh + m * 2} width={bw - m} height={bh} fill="#16111C" />
            <Rect x={m + bw / 2} y={bh + m * 2} width={bw - m} height={bh} fill="#1C1522" />
            <Rect x={m + bw + bw / 2} y={bh + m * 2} width={bw - m} height={bh} fill="#221824" />
          </Pattern>
          <RadialGradient id="hideoutVignette" cx="50%" cy="46%" rx="62%" ry="54%">
            <Stop offset="0" stopColor={HIDEOUT_NIGHT} stopOpacity="0.12" />
            <Stop offset="0.55" stopColor={HIDEOUT_NIGHT} stopOpacity="0.42" />
            <Stop offset="1" stopColor={HIDEOUT_NIGHT} stopOpacity="0.92" />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#hideoutBricks)" />
        <Rect width={width} height={height} fill="url(#hideoutVignette)" />
      </Svg>
    </View>
  );
}

function CropFromLayer({
  source,
  crop,
  scale,
}: {
  source: unknown;
  crop: HideoutProp['crop'];
  scale: HideoutScale;
}) {
  const k = scale.pt;
  const [x, y, w, h] = crop;
  if (!source || w <= 0 || h <= 0) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x * k,
        top: y * k,
        width: w * k,
        height: h * k,
        overflow: 'hidden',
      }}>
      <Image
        source={source as never}
        style={{
          position: 'absolute',
          left: -x * k,
          top: -y * k,
          width: scale.canvasW,
          height: scale.canvasH,
          ...pixelRenderStyle,
        }}
        contentFit="fill"
        transition={0}
      />
    </View>
  );
}

/**
 * Combined occluder layer (one image per time/neon state). Crops each
 * prop whose sortY is in front of the pet's feet and pulses neon A/B.
 */
export function StreetRoomFront({
  left,
  top,
  scale,
  room = 'hideout',
  night = false,
  feetX,
  feetY,
  alive = true,
  gentle = false,
}: {
  left: number;
  top: number;
  scale: HideoutScale;
  room?: HideoutRoomId;
  night?: boolean;
  feetX: number;
  feetY: number;
  alive?: boolean;
  gentle?: boolean;
}) {
  const art = ROOM_ART[room];
  const geom = parseIsoGeom(art.map, { sleepOnBed: room === 'loft' });
  const props = occluderProps(geom, feetX, feetY);
  if (props.length === 0) return null;
  const a = night ? art.occludeNightA : art.occludeDayA;
  const b = night ? art.occludeNightB : art.occludeDayB;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left, top, width: scale.canvasW, height: scale.canvasH }}>
      {props.map((p) => (
        <CropFromLayer key={`${p.id}-a`} source={a} crop={p.crop} scale={scale} />
      ))}
      {b ? (
        <NeonOccludeCrops source={b} props={props} scale={scale} alive={alive} gentle={gentle} />
      ) : null}
    </View>
  );
}

function NeonOccludeCrops({
  source,
  props,
  scale,
  alive,
  gentle,
}: {
  source: unknown;
  props: readonly HideoutProp[];
  scale: HideoutScale;
  alive: boolean;
  gentle: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(t);
    t.value = 0;
    if (!alive) return;
    const keep = { reduceMotion: ReduceMotion.Never };
    const ms = gentle ? 2200 : 1600;
    t.value = withRepeat(withSequence(withTiming(1, { duration: ms, ...keep }), withTiming(0, { duration: ms, ...keep })), -1);
    return () => cancelAnimation(t);
  }, [alive, gentle, t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value * 0.55 }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {props.map((p) => (
        <CropFromLayer key={`${p.id}-b`} source={source} crop={p.crop} scale={scale} />
      ))}
    </Animated.View>
  );
}

/**
 * Night even-odd overlay: the stage minus the room picture. Sits above the pet
 * so auras/FX that spill past the room's edges are clipped; labels and
 * prop-front stay siblings above this layer. (It used to cut out only the
 * floor silhouette, which painted over the 3/4 room's walls, window and tall
 * props — 2026-10-12.)
 */
export function StreetRoomAuraClip({
  left,
  top,
  scale,
  stageW,
  stageH,
}: {
  left: number;
  top: number;
  scale: HideoutScale;
  stageW: number;
  stageH: number;
}) {
  const w = scale.canvasW;
  const h = scale.canvasH;
  const outer = `M0 0H${stageW}V${stageH}H0Z`;
  const inner = `M${left} ${top}H${left + w}V${top + h}H${left}Z`;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={stageW} height={stageH} style={StyleSheet.absoluteFill}>
        <Path d={`${outer}${inner}`} fill={HIDEOUT_NIGHT} fillRule="evenodd" />
      </Svg>
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
  const moth0 = at(178, 90); // by the window (352-wide room)
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
    t.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 700, reduceMotion: ReduceMotion.Never }),
        withTiming(1, { duration: 700, reduceMotion: ReduceMotion.Never }),
      ),
      -1,
    );
    return () => cancelAnimation(t);
  }, [still, t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pulse, style]} />;
}

/** Unvisited chip bob — KEEP loop; amplitude ≤1.04, smaller under vestibularSafe. */
function ChipBob({ still, gentle, children }: { still: boolean; gentle: boolean; children: ReactNode }) {
  const t = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(t);
    t.value = 1;
    if (still) return;
    const peak = gentle ? 1.015 : 1.03;
    t.value = withRepeat(
      withSequence(
        withTiming(peak, { duration: 900, reduceMotion: ReduceMotion.Never }),
        withTiming(1, { duration: 900, reduceMotion: ReduceMotion.Never }),
      ),
      -1,
    );
    return () => cancelAnimation(t);
  }, [still, gentle, t]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: t.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function StreetRoomSpots({
  left,
  top,
  scale,
  onSpot,
  pulse,
  notes,
  still,
  gentle = false,
  petHit,
}: StreetRoomSpotsProps & {
  left: number;
  top: number;
  scale: HideoutScale;
  still: boolean;
  /** OS RM / in-game Reduced — smaller idle bob. */
  gentle?: boolean;
  /** Pet hit box in screen pt — chip must not cover the figure. */
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
  const hit = HIDEOUT_SPOT_HIT_PT;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {HIDEOUT_SPOTS.map((s) => {
        const note = notes[s.coach];
        const faded = !showAll && seen[s.id] && pulse !== s.coach;
        const unvisited = !seen[s.id];
        const anchor = hideoutLabelAnchor(s.id);
        const label = s.action;
        const hot = pulse === s.coach;
        const variant = hot ? 'primary' : 'secondary';
        const chipW = Math.max(hit, s.id === 'manhole' ? 132 : 108);
        const chipH = hit;
        const [ecx, ecy, erx, ery] = s.ellipse;
        const [fc, fr, fw, fh] = s.footprint;
        const tile = HIDEOUT_TILE;
        const footW = Math.max(hit, fw * tile * k);
        const footH = Math.max(hit, fh * tile * k);
        const footLeft = left + fc * tile * k + (fw * tile * k) / 2 - footW / 2;
        const footTop = top + fr * tile * k + (fh * tile * k) / 2 - footH / 2;
        const cx = left + anchor[0] * k;
        const cy = top + anchor[1] * k;
        let leftPt = Math.round(cx - chipW / 2);
        let topPt = Math.round(cy - chipH / 2);
        if (petHit) {
          const overlap =
            leftPt < petHit.x + petHit.w &&
            leftPt + chipW > petHit.x &&
            topPt < petHit.y + petHit.h &&
            topPt + chipH > petHit.y;
          if (overlap) topPt = Math.round(petHit.y - chipH - 6);
        }
        // The app's kit button (same family as FEED / INFO): slate, mustard when something is
        // new there; icon + label. Pulse ring + press state live on the button, not the 48 pt
        // hit area around it.
        const face = (pressed: boolean) => (
          <StreetFrame piece={streetButtonPiece(variant, pressed)} style={[styles.chip, faded && styles.chipFaded]}>
            {hot ? <PulseRing still={still} /> : null}
            {SPOT_ICON_ART[s.id] ? (
              <Image source={SPOT_ICON_ART[s.id]} style={styles.chipIcon} contentFit="contain" transition={0} />
            ) : null}
            <Text style={[styles.chipText, { color: streetButtonText(variant) }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {label}
            </Text>
          </StreetFrame>
        );
        return (
          <View key={s.id} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <Svg
              pointerEvents="none"
              style={{ position: 'absolute', left: left + (ecx - erx) * k, top: top + (ecy - ery) * k, width: erx * 2 * k, height: ery * 2 * k }}>
              <Ellipse
                cx={erx * k}
                cy={ery * k}
                rx={erx * k}
                ry={ery * k}
                fill="none"
                stroke={PIXEL.cyan}
                strokeWidth={1.5}
                strokeOpacity={faded ? 0.28 : 0.7}
              />
            </Svg>
            <Pressable
              onPress={() => press(s)}
              accessibilityRole="button"
              accessibilityLabel={`${s.thing}, ${s.action}${note ? `, ${note}` : ''}`}
              style={({ pressed }) => [
                styles.spot,
                {
                  left: Math.round(footLeft),
                  top: Math.round(footTop),
                  width: Math.round(footW),
                  height: Math.round(footH),
                  minWidth: hit,
                  minHeight: hit,
                },
                pressed && styles.chipPressed,
              ]}
            />
            <Pressable
              ref={s.coach === 'dive' ? tipAnchorRef('hatch') : undefined}
              onPress={() => press(s)}
              accessibilityRole="button"
              accessibilityLabel={`${s.thing}, ${s.action}${note ? `, ${note}` : ''}`}
              style={[
                styles.spot,
                styles.chipHit,
                { left: leftPt, top: topPt, width: chipW, height: chipH, minWidth: hit, minHeight: hit },
              ]}>
              {({ pressed }) =>
                unvisited && !still ? (
                  <ChipBob still={still} gentle={gentle}>
                    {face(pressed)}
                  </ChipBob>
                ) : (
                  face(pressed)
                )
              }
            </Pressable>
          </View>
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
/** Speech bubble. `anchored`: sits on its parent's bottom-left (the parent follows the pet). */
export function StreetSpeechBubble({
  text,
  left = 0,
  top = 0,
  anchored = false,
  width = 200,
}: {
  text: string;
  left?: number;
  top?: number;
  anchored?: boolean;
  /** Anchored bubbles need an explicit width (their parent is 0 wide). */
  width?: number;
}) {
  return (
    <View pointerEvents="none" style={[styles.bubble, anchored ? { left: 0, bottom: 0, width } : { left, top }]}>
      <Text style={styles.bubbleText} maxFontSizeMultiplier={1.2}>
        {text}
      </Text>
      <View style={styles.tail} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Fixed regions: one row, one height — a name, a stage or a grade chip appearing never
  // adds a second row (that resized the room below).
  strip: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    height: 36,
    overflow: 'hidden',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 8,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(26, 26, 29, 0.92)',
    borderWidth: 2,
    borderColor: '#000',
  },
  stripMain: { flexGrow: 1, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  stripText: { fontFamily: PIXEL_FONT.label, fontSize: 12, color: STREET.paper, includeFontPadding: false },
  name: {
    fontFamily: PIXEL_FONT.label,
    fontSize: 12,
    color: STREET.paper,
    textTransform: 'uppercase',
    includeFontPadding: false,
    flexShrink: 1,
    minWidth: 0,
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
  chipHit: { alignItems: 'center', justifyContent: 'center' },
  pulse: { borderWidth: 2, borderColor: PIXEL.cyan, borderStyle: 'dashed' },
  // The visible kit button stays compact; the Pressable around it keeps the 48 pt tap area.
  chip: {
    height: 30,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingLeft: 8,
    paddingRight: 11,
  },
  chipFaded: { opacity: 0.82 },
  // Press flash on the prop's own tap area (footprint).
  chipPressed: { backgroundColor: PIXEL.glow },
  chipIcon: { width: 18, height: 18, ...pixelRenderStyle },
  chipText: {
    fontFamily: STREET_FONT.bold,
    fontSize: 13,
    lineHeight: 16,
    includeFontPadding: false,
    flexShrink: 1,
  },
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
