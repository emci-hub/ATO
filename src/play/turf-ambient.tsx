/**
 * Turf War ambient layer (step T4, 2026-10-17): small loops between the baked board and the units.
 *   A neon pools flicker (the `ato-glow` layer, cropped per pool)   B barrel fire: flame + smoke + firelight
 *   C cone lamps blink                                              D pigeons perch, peck and flap off near a creep
 *   E steam from the vent grate
 * Every loop runs on its own Reanimated clock on the UI thread — NOT inside the sim `<Svg>` that re-renders every
 * 100 ms. fx-quality: Full = all, Minimal = half (every other site, no smoke / steam), Off or Motion Off = a still
 * frame. Reduce Motion = half speed, and a pigeon just fades instead of flying. Nothing here changes size or taps:
 * the layer is pointer-events none and sits under the units. Placement data = meta.boards.ato.ambient.
 */
import { Image as ExpoImage } from 'expo-image';
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { boardSheet } from '@/art/art';
import { useFxQuality } from '@/play/fx-quality';
import { usePlayMotion } from '@/play/play-motion';
import { pixelRenderStyle } from '@/play/pixel-theme';
import { playSheetArt } from '@/play/sheet-sprite';
import { PLAY_SHEETS } from '@/play/generated-play-sheets';
import { STREETWEAR_META } from '@/play/skin';
import {
  LAMP_CORE,
  LAMP_HALO,
  PIGEON_FLY_MS,
  PIGEON_RETURN_MS,
  SMOKE_LIFT,
  TURF_ART_PX,
  ambientShare,
  pigeonScared,
  turfAmbientMeta,
  type AmbientClip,
  type AmbientPoint,
  type AmbientRect,
  type TurfAmbientMeta,
} from '@/play/turf-ambient-layout';

const AMBER = '#FFB347';
const AMBER_CORE = '#FFE9A8';

type Env = { k: number; animate: boolean; speed: number; sheet: (id: string) => string | undefined };

/** A crop of one packed frame at the board scale: an overflow-hidden box around the whole sheet image. */
function frameBox(sheetKey: string, frameKey: string) {
  const sheet = PLAY_SHEETS[sheetKey];
  const rect = sheet?.frames[frameKey];
  const source = playSheetArt(sheetKey);
  if (!sheet || !rect || !source) return null;
  return { sheet, rect, source };
}

/** The `ato-glow` / `ato-fire` layers, cropped to one pool, flickering (still = a fixed mid glow). */
function LightCrop({ sheetKey, rect, k, keys, env, opacity }: { sheetKey: string; rect: AmbientRect; k: number; keys: number[]; env: Env; opacity: number }) {
  const o = useSharedValue(opacity);
  useEffect(() => {
    cancelAnimation(o);
    o.value = opacity;
    if (!env.animate) return;
    const step = 110 / env.speed;
    o.value = withRepeat(withSequence(...keys.map((v) => withTiming(v * opacity, { duration: step, easing: Easing.linear }))), -1, false);
    return () => cancelAnimation(o);
  }, [o, opacity, env.animate, env.speed, keys]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  const frame = frameBox(sheetKey, 'img');
  if (!frame) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left: rect.x * k, top: rect.y * k, width: rect.w * k, height: rect.h * k, overflow: 'hidden' }, style]}>
      <ExpoImage
        source={frame.source}
        contentFit="fill"
        transition={0}
        style={{ ...pixelRenderStyle, position: 'absolute', left: -(frame.rect.x + rect.x) * k, top: -(frame.rect.y + rect.y) * k, width: frame.sheet.sheetW * k, height: frame.sheet.sheetH * k }}
      />
    </Animated.View>
  );
}

/** One looping clip: a strip image slid on the UI thread, whole frames only. `at` = top-left in art px. */
function ClipLoop({ sheetKey, clip, at, env, delay = 0, opacity = 1, still = 0 }: { sheetKey: string; clip: AmbientClip; at: AmbientPoint; env: Env; delay?: number; opacity?: number; still?: number }) {
  const { k } = env;
  const frames = clip.frames;
  const fps = clip.fps;
  const t = useSharedValue(still);
  useEffect(() => {
    cancelAnimation(t);
    if (!env.animate || frames < 2) {
      t.value = still;
      return;
    }
    // withRepeat restarts from the start value, so an animated loop always starts at frame 0 (desync = the delay).
    t.value = 0;
    t.value = withDelay(delay, withRepeat(withTiming(frames, { duration: (frames * 1000) / (fps * env.speed), easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [t, env.animate, env.speed, frames, fps, delay, still]);
  const first = PLAY_SHEETS[sheetKey]?.frames.frame_000;
  const second = PLAY_SHEETS[sheetKey]?.frames.frame_001;
  const stride = first && second ? second.x - first.x : (first?.w ?? 0);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: -Math.min(frames - 1, Math.floor(t.value)) * stride * k }] }), [frames, stride, k]);
  const frame = frameBox(sheetKey, 'frame_000');
  if (!frame || !first) return null;
  return (
    <View pointerEvents="none" style={[styles.abs, { left: at.x * k, top: at.y * k, width: clip.w * k, height: clip.h * k, overflow: 'hidden', opacity }]}>
      <Animated.View style={[styles.abs, { left: -first.x * k, top: -first.y * k, width: frame.sheet.sheetW * k, height: frame.sheet.sheetH * k }, slide]}>
        <ExpoImage source={frame.source} contentFit="fill" transition={0} style={{ ...pixelRenderStyle, width: '100%', height: '100%' }} />
      </Animated.View>
    </View>
  );
}

/** The cone's amber lamp: a bright core and a soft halo, on for 0.5 s every 1.2 s (still = on). */
function ConeLamp({ at, env, delay }: { at: AmbientPoint; env: Env; delay: number }) {
  const { k } = env;
  const o = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(o);
    o.value = 1;
    if (!env.animate) return;
    const s = env.speed;
    o.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 40 / s }), withDelay(500 / s, withTiming(0, { duration: 40 / s })), withDelay(620 / s, withTiming(0, { duration: 0 }))), -1, false),
    );
    return () => cancelAnimation(o);
  }, [o, env.animate, env.speed, delay]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  const halo = LAMP_HALO * k;
  const core = LAMP_CORE * k;
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left: (at.x - LAMP_HALO / 2) * k, top: (at.y - LAMP_HALO / 2) * k, width: halo, height: halo }, style]}>
      <View style={{ width: halo, height: halo, borderRadius: halo / 2, backgroundColor: AMBER, opacity: 0.28 }} />
      <View style={{ position: 'absolute', left: (halo - core) / 2, top: (halo - core) / 2, width: core, height: core, backgroundColor: AMBER_CORE }} />
    </Animated.View>
  );
}

/** A perched pigeon: bobs and pecks; flaps off (wing frames on a short arc + fade) when a creep is near, returns later. */
function Pigeon({ site, clip, env, index, creepsRef, running, reduced }: { site: AmbientPoint; clip: AmbientClip; env: Env; index: number; creepsRef: { current: () => AmbientPoint[] }; running: boolean; reduced: boolean }) {
  const { k } = env;
  const sheetKey = env.sheet('ato-pigeon');
  const fly = useSharedValue(0);
  // Linear twin of `fly`: the wing frames follow clock time, not the eased arc, so the flap keeps one pace.
  const flap = useSharedValue(0);
  const vis = useSharedValue(1);
  const peck = useSharedValue(0);
  const away = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toward = site.x > TURF_ART_PX / 2 ? -1 : 1;

  useEffect(() => {
    cancelAnimation(peck);
    peck.value = 0;
    if (!env.animate) return;
    const s = env.speed;
    peck.value = withDelay(
      (index * 900) / s,
      withRepeat(withSequence(withDelay(2300 / s, withTiming(1, { duration: 120 / s })), withTiming(0, { duration: 160 / s }), withTiming(1, { duration: 120 / s }), withTiming(0, { duration: 160 / s })), -1, false),
    );
    return () => cancelAnimation(peck);
  }, [peck, env.animate, env.speed, index]);

  // Watching for creeps: only while a wave runs. A pigeon already away still comes back (its timer is not tied to `running`).
  useEffect(() => {
    if (!running || !env.animate) return;
    const id = setInterval(() => {
      if (away.current || !pigeonScared(site, creepsRef.current())) return;
      away.current = true;
      fly.value = reduced ? 0 : withTiming(1, { duration: PIGEON_FLY_MS, easing: Easing.out(Easing.quad) });
      flap.value = reduced ? 0 : withTiming(1, { duration: PIGEON_FLY_MS, easing: Easing.linear });
      vis.value = withTiming(0, { duration: reduced ? 500 : 750 });
      timer.current = setTimeout(() => {
        fly.value = 0;
        flap.value = 0;
        vis.value = withTiming(1, { duration: 600 });
        away.current = false;
        timer.current = null;
      }, PIGEON_RETURN_MS);
    }, 150);
    return () => clearInterval(id);
  }, [running, env.animate, site, creepsRef, fly, flap, vis, reduced]);
  // Quality Off / Motion Off: a perched bird, never mid-flight. On unmount: stop the timer and the animations.
  useEffect(() => {
    if (!env.animate) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      away.current = false;
      cancelAnimation(fly);
      cancelAnimation(flap);
      cancelAnimation(vis);
      fly.value = 0;
      flap.value = 0;
      vis.value = 1;
    }
  }, [env.animate, fly, flap, vis]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      cancelAnimation(fly);
      cancelAnimation(flap);
      cancelAnimation(vis);
    },
    [fly, flap, vis],
  );

  const style = useAnimatedStyle(() => {
    const f = fly.value;
    return {
      opacity: vis.value,
      transform: [{ translateX: toward * f * 36 * k }, { translateY: peck.value * 2 * k - f * 30 * k }, { scaleX: toward < 0 ? -1 : 1 }],
    };
  });
  // Wing flap: frame 0 = perched; while it flies off (never under Reduce Motion, where `flap` stays 0) frames 1..n-1 loop at the clip's fps.
  const wingFrames = clip.frames - 1;
  const frameMs = 1000 / clip.fps;
  const first = sheetKey ? PLAY_SHEETS[sheetKey]?.frames.frame_000 : undefined;
  const second = sheetKey ? PLAY_SHEETS[sheetKey]?.frames.frame_001 : undefined;
  const stride = first && second ? second.x - first.x : 0;
  const wings = useAnimatedStyle(() => {
    const t = flap.value;
    const idx = t > 0 && wingFrames > 0 ? 1 + (Math.floor((t * PIGEON_FLY_MS) / frameMs) % wingFrames) : 0;
    return { transform: [{ translateX: -idx * stride * k }] };
  }, [wingFrames, frameMs, stride, k]);
  const frame = sheetKey ? frameBox(sheetKey, 'frame_000') : null;
  if (!frame) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left: (site.x - clip.ax) * k, top: (site.y - clip.ay) * k, width: clip.w * k, height: clip.h * k, overflow: 'hidden' }, style]}>
      <Animated.View style={[styles.abs, { left: -frame.rect.x * k, top: -frame.rect.y * k, width: frame.sheet.sheetW * k, height: frame.sheet.sheetH * k }, wings]}>
        <ExpoImage source={frame.source} contentFit="fill" transition={0} style={{ ...pixelRenderStyle, width: '100%', height: '100%' }} />
      </Animated.View>
    </Animated.View>
  );
}

/** Irregular flicker keys per light: neon pools slow and soft, firelight quick and deeper. */
const POOL_KEYS: number[][] = [
  [1, 0.8, 1, 0.55, 0.95, 0.7, 1, 0.9],
  [0.9, 1, 0.65, 1, 0.85, 0.6, 1, 0.95],
  [1, 0.9, 0.8, 1, 0.7, 0.95, 0.85, 1],
  [0.85, 1, 0.9, 0.6, 1, 0.8, 1, 0.7],
  [1, 0.7, 1, 0.9, 0.6, 1, 0.8, 0.95],
];
const FIRE_KEYS: number[][] = [
  [1, 0.7, 0.95, 0.55, 1, 0.8, 0.6, 0.9],
  [0.8, 1, 0.6, 0.9, 1, 0.55, 0.85, 1],
  [0.95, 0.6, 1, 0.8, 0.7, 1, 0.5, 0.9],
];

export type TurfAmbientProps = {
  /** The packed board id (`ato`, or a theme's `ato-<theme>`, turf-theme.ts `turfBoardArtId`). */
  mapId: string;
  /** Board side in pt (the layer fills the board). */
  boardSide: number;
  /** Creep positions in board units 0–100, read on demand (never stored in React state). */
  getCreeps: () => AmbientPoint[];
  /** A wave is running (pigeons watch for creeps only then). */
  running: boolean;
};

export const TurfAmbient = memo(function TurfAmbient({ mapId, boardSide, getCreeps, running }: TurfAmbientProps) {
  const quality = useFxQuality();
  const motion = usePlayMotion();
  const creepsRef = useRef(getCreeps);
  creepsRef.current = getCreeps;
  const meta: TurfAmbientMeta | null = turfAmbientMeta((STREETWEAR_META as unknown as { boards?: unknown }).boards, mapId);
  if (!meta) return null;
  const share = ambientShare(quality);
  const animate = share.animate && !motion.cosmeticsStill;
  const speed = motion.vestibularSafe ? 0.5 : 1;
  const k = boardSide / TURF_ART_PX;
  const sheet = (id: string) => boardSheet(id);
  const env: Env = { k, animate, speed, sheet };
  /** Minimal: every other site animates; the others hold a still frame (a flameless barrel must keep its flame). */
  const envAt = (i: number): Env => (share.everyOther && i % 2 === 1 ? { ...env, animate: false } : env);
  // T8: each theme has its own light layers (`ato-glow`, `ato-rooftop-glow`, …); the clips below are shared.
  const glowKey = sheet(`${mapId}-glow`);
  const fireKey = sheet(`${mapId}-fire`);
  const flameKey = sheet('ato-flame');
  const smokeKey = sheet('ato-smoke');
  const steamKey = sheet('ato-steam');
  return (
    <View pointerEvents="none" style={styles.fill}>
      {glowKey ? meta.pools.map((rect, i) => <LightCrop key={`pool-${i}`} sheetKey={glowKey} rect={rect} k={k} keys={POOL_KEYS[i % POOL_KEYS.length]!} env={envAt(i)} opacity={0.85} />) : null}
      {fireKey ? meta.fires.map((rect, i) => <LightCrop key={`fire-${i}`} sheetKey={fireKey} rect={rect} k={k} keys={FIRE_KEYS[i % FIRE_KEYS.length]!} env={envAt(i)} opacity={0.9} />) : null}
      {share.smokeSteam && steamKey && meta.vent ? (
        <ClipLoop sheetKey={steamKey} clip={meta.clips.steam} at={{ x: meta.vent.x - meta.clips.steam.ax, y: meta.vent.y - meta.clips.steam.ay }} env={env} opacity={0.9} still={4} />
      ) : null}
      {share.smokeSteam && smokeKey
        ? meta.barrels.map((b, i) => b.smoke === false ? null : (
            <ClipLoop key={`smoke-${i}`} sheetKey={smokeKey} clip={meta.clips.smoke} at={{ x: b.x - meta.clips.smoke.ax, y: b.y - SMOKE_LIFT - meta.clips.smoke.ay }} env={env} delay={i * 700} opacity={0.8} still={4 + i * 3} />
          ))
        : null}
      {flameKey
        ? meta.barrels.map((b, i) => (
            <ClipLoop key={`flame-${i}`} sheetKey={flameKey} clip={meta.clips.flame} at={{ x: b.x - meta.clips.flame.ax, y: b.y - meta.clips.flame.ay }} env={envAt(i)} delay={i * 180} still={i * 2} />
          ))
        : null}
      {meta.cones.map((c, i) => (
        <ConeLamp key={`lamp-${i}`} at={c} env={envAt(i)} delay={i * 400} />
      ))}
      {meta.pigeons.map((p, i) => (
        <Pigeon key={`pigeon-${i}`} site={p} clip={meta.clips.pigeon} env={envAt(i)} index={i} creepsRef={creepsRef} running={running} reduced={motion.vestibularSafe} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  abs: { position: 'absolute' },
});
