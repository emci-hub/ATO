/**
 * Multi-room Hideout stage: one live room + static neighbor snapshots.
 *
 * Full motion: a short horizontal slide. Reduced / OS RM: 150ms dissolve, no
 * slide. Walk loops keep running. Paging starts outside the iOS edge-back zone.
 *
 * Loft: window art (day/night) drives ambient light. Lamp tap toggles the
 * baked warm-glow overlay at night — no code spotlight.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  LOFT_WINDOW_POS,
  LOFT_WINDOW_SIZE,
  NEIGHBOR_BOARDED_ART,
  ROOM_ART,
} from '@/play/hideout-art';
import { HideoutTease } from '@/play/hideout-tease';
import { HideoutTravelTag, HideoutZzz } from '@/play/hideout-zzz';
import {
  HIDEOUT_DISSOLVE_MS,
  neighborRooms,
  type HideoutProgressInput,
  type HideoutRoomId,
  type HideoutState,
} from '@/play/hideout-progress';
import {
  isoSleepPoint,
  parseIsoGeom,
  type HideoutOrigin,
  type HideoutScale,
  type IsoRoomGeom,
} from '@/play/hideout-iso';
import { expeditionCallCopy, type Presence } from '@/play/hideout-presence';
import { pixelRenderStyle } from '@/play/pixel-theme';
import { usePlayMotion } from '@/play/play-motion';
import { EDGE_ZONE } from '@/play/edge-back';
import { StreetRoomArt, StreetRoomFront } from '@/play/street-room';

function Place({
  source,
  left,
  top,
  w,
  h,
}: {
  source: unknown;
  left: number;
  top: number;
  w: number;
  h: number;
}) {
  if (!source) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left, top, width: w, height: h }}>
      <Image source={source as never} style={{ width: w, height: h, ...pixelRenderStyle }} contentFit="fill" transition={0} />
    </View>
  );
}

export function roomGeom(id: HideoutRoomId): IsoRoomGeom {
  const art = ROOM_ART[id];
  return parseIsoGeom(art.map, { sleepOnBed: id === 'loft' });
}

function SnapshotRoom({
  id,
  scale,
  origin,
  night,
}: {
  id: HideoutRoomId;
  scale: HideoutScale;
  origin: HideoutOrigin;
  night: boolean;
}) {
  const art = ROOM_ART[id];
  const src = art.snapshot ?? art.shell ?? NEIGHBOR_BOARDED_ART;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: origin.left,
        top: origin.top,
        width: scale.canvasW,
        height: scale.canvasH,
        opacity: 0.55,
      }}>
      <Image source={src} style={{ width: scale.canvasW, height: scale.canvasH, ...pixelRenderStyle }} contentFit="fill" transition={0} />
      {id === 'loft' && art.windowNight && art.windowDay ? (
        <Place
          source={night ? art.windowNight : art.windowDay}
          left={LOFT_WINDOW_POS[0] * scale.pt}
          top={LOFT_WINDOW_POS[1] * scale.pt}
          w={LOFT_WINDOW_SIZE[0] * scale.pt}
          h={LOFT_WINDOW_SIZE[1] * scale.pt}
        />
      ) : null}
    </View>
  );
}

function LiveRoom({
  room,
  scale,
  origin,
  night,
  lampOn,
}: {
  room: Exclude<HideoutRoomId, 'hideout'>;
  scale: HideoutScale;
  origin: HideoutOrigin;
  night: boolean;
  lampOn: boolean;
}) {
  // The lamp has no tap area of its own: Light is on the left rail (hideout-rails.tsx).
  return (
    <View style={{ position: 'absolute', left: origin.left, top: origin.top, width: scale.canvasW, height: scale.canvasH }}>
      <StreetRoomArt left={0} top={0} scale={scale} alive room={room} night={night} lampOn={lampOn} />
    </View>
  );
}

export function HideoutStageChrome({
  hideout,
  progress,
  presence,
  viewed,
  scale,
  origin,
  width,
  night,
  feetX,
  feetY,
  expeditionBackMs,
  onView,
  onTease,
  walkBounds,
}: {
  hideout: HideoutState;
  progress: HideoutProgressInput;
  presence: Presence;
  viewed: HideoutRoomId;
  scale: HideoutScale;
  origin: HideoutOrigin;
  width: number;
  night: boolean;
  feetX: number;
  feetY: number;
  expeditionBackMs: number | null;
  onView: (id: HideoutRoomId) => void;
  onTease: () => void;
  /** Rail walk bounds (art px): the sleeping Zzz sits where the clamped pet sleeps. */
  walkBounds?: { minX: number; maxX: number };
}) {
  const motion = usePlayMotion();
  const fade = useSharedValue(1);
  const slide = useSharedValue(0);
  const prev = useRef(viewed);
  const neighbors = neighborRooms(viewed, hideout);

  useEffect(() => {
    if (prev.current === viewed) return;
    const keepWalk = { reduceMotion: ReduceMotion.Never };
    cancelAnimation(fade);
    cancelAnimation(slide);
    if (motion.cosmeticsStill) {
      fade.value = 1;
      slide.value = 0;
    } else if (motion.vestibularSafe) {
      fade.value = 0;
      fade.value = withTiming(1, {
        duration: HIDEOUT_DISSOLVE_MS,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.Never,
      });
      slide.value = 0;
    } else {
      fade.value = 1;
      slide.value = 24;
      slide.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic), ...keepWalk });
    }
    prev.current = viewed;
  }, [viewed, motion.cosmeticsStill, motion.vestibularSafe, fade, slide]);

  const liveStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateX: slide.value }],
  }));

  const liveIsHideout = viewed === 'hideout';
  // Loft, Garage and Rooftop are live once built; a room still being built stays a dimmed snapshot.
  const liveRoom = viewed !== 'hideout' && hideout.rooms_unlocked[viewed] ? viewed : null;
  const petHere = presence.room === viewed && !presence.away;
  const k = scale.pt;

  useEffect(() => {
    // Neighbor shells are already required in ROOM_ART — keep the live room
    // as the only mounted walker; snapshots are static Images.
    void neighbors;
  }, [neighbors]);

  const leftSnapOrigin = useMemo(
    () => ({ left: Math.min(origin.left - scale.canvasW * 0.92, -scale.canvasW), top: origin.top }),
    [origin.left, origin.top, scale.canvasW],
  );
  const rightSnapOrigin = useMemo(
    // Off-screen until the swipe brings it in (a narrow room used to show it as a peek).
    () => ({ left: Math.max(origin.left + scale.canvasW * 0.92, width), top: origin.top }),
    [origin.left, origin.top, scale.canvasW, width],
  );

  const startX = useRef(0);
  const tracking = useRef(false);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {neighbors.left ? (
        <SnapshotRoom id={neighbors.left} scale={scale} origin={leftSnapOrigin} night={night} />
      ) : null}
      {neighbors.right ? (
        <SnapshotRoom id={neighbors.right} scale={scale} origin={rightSnapOrigin} night={night} />
      ) : null}

      <Animated.View
        style={[StyleSheet.absoluteFill, liveStyle]}
        onStartShouldSetResponder={(e) => {
          const x = e.nativeEvent.locationX;
          return x > EDGE_ZONE && x < width - EDGE_ZONE;
        }}
        onResponderGrant={(e) => {
          startX.current = e.nativeEvent.pageX;
          tracking.current = true;
        }}
        onResponderRelease={(e) => {
          if (!tracking.current) return;
          tracking.current = false;
          const dx = e.nativeEvent.pageX - startX.current;
          if (Math.abs(dx) < 48) return;
          const want = dx < 0 ? neighbors.right : neighbors.left;
          if (want) onView(want);
        }}>
        {liveIsHideout ? (
          <StreetRoomArt
            left={origin.left}
            top={origin.top}
            scale={scale}
            alive
            room="hideout"
            night={night}
            gentle={motion.vestibularSafe}
          />
        ) : liveRoom ? (
          <LiveRoom room={liveRoom} scale={scale} origin={origin} night={night} lampOn={hideout.lamp_on} />
        ) : (
          <SnapshotRoom id={viewed} scale={scale} origin={origin} night={night} />
        )}
      </Animated.View>

      {liveIsHideout ? (
        <HideoutTease hideout={hideout} progress={progress} scale={scale} origin={origin} onPress={onTease} />
      ) : null}

      {liveIsHideout && petHere ? (
        <StreetRoomFront
          left={origin.left}
          top={origin.top}
          scale={scale}
          room="hideout"
          night={night}
          feetX={feetX}
          feetY={feetY}
          gentle={motion.vestibularSafe}
        />
      ) : null}
      {liveRoom && petHere ? (
        <StreetRoomFront
          left={origin.left}
          top={origin.top}
          scale={scale}
          room={liveRoom}
          night={night}
          feetX={feetX}
          feetY={feetY}
          gentle={motion.vestibularSafe}
        />
      ) : null}

      {petHere && presence.asleep ? (
        (() => {
          const geom = roomGeom(presence.room);
          const sp = isoSleepPoint(geom);
          // Same clamp the planner applies to the Hideout cushion (the Loft bed sits clear of the rails).
          const sx = walkBounds && !geom.sleepOnBed ? Math.min(Math.max(sp[0], walkBounds.minX), walkBounds.maxX) : sp[0];
          return <HideoutZzz x={origin.left + sx * k - 8} y={origin.top + sp[1] * k - 36} />;
        })()
      ) : null}

      {presence.away ? (
        <HideoutTravelTag
          x={origin.left + (scale.canvasW / k / 2 - 40) * k}
          y={origin.top + 200 * k}
          text={expeditionBackMs != null ? expeditionCallCopy(expeditionBackMs) : 'Out on a trip'}
        />
      ) : null}

    </View>
  );
}
