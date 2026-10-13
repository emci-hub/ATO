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
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { HIDEOUT_CONTROL_PT, HideoutRoomBar } from '@/play/hideout-bar';
import { HideoutTease } from '@/play/hideout-tease';
import { HideoutTravelTag, HideoutZzz } from '@/play/hideout-zzz';
import {
  HIDEOUT_DISSOLVE_MS,
  HIDEOUT_ROOM_IDS,
  neighborRooms,
  roomDef,
  roomStage,
  type HideoutProgressInput,
  type HideoutRoomId,
  type HideoutState,
} from '@/play/hideout-progress';
import {
  HIDEOUT_SPOT_HIT_PT,
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
import { STREET, STREET_FONT } from '@/play/street-ui';
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

function LiveLoft({
  scale,
  origin,
  night,
  lampOn,
  onLamp,
}: {
  scale: HideoutScale;
  origin: HideoutOrigin;
  night: boolean;
  lampOn: boolean;
  onLamp: () => void;
}) {
  const geom = roomGeom('loft');
  const k = scale.pt;
  const lampHot = geom.hotspots.find((h) => h.id === 'lamp' || h.kind === 'lamp');
  const fp = lampHot?.footprint ?? ([19, 10, 1, 2] as const);
  const hit = HIDEOUT_SPOT_HIT_PT;
  const fw = Math.max(hit, fp[2] * geom.tile * k);
  const fh = Math.max(hit, fp[3] * geom.tile * k);
  const lamp = {
    left: origin.left + fp[0] * geom.tile * k + (fp[2] * geom.tile * k) / 2 - fw / 2,
    top: origin.top + fp[1] * geom.tile * k + (fp[3] * geom.tile * k) / 2 - fh / 2,
    width: fw,
    height: fh,
    minWidth: hit,
    minHeight: hit,
  };
  return (
    <View style={{ position: 'absolute', left: origin.left, top: origin.top, width: scale.canvasW, height: scale.canvasH }}>
      <StreetRoomArt left={0} top={0} scale={scale} alive room="loft" night={night} lampOn={lampOn} />
      <Pressable
        onPress={onLamp}
        accessibilityRole="button"
        accessibilityLabel={night ? (lampOn ? 'Lamp on, tap to dim' : 'Lamp off, tap to light') : 'Lamp'}
        style={{ position: 'absolute', ...lamp }}
      />
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
  onLamp,
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
  onLamp: () => void;
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
  const liveIsLoft = viewed === 'loft' && hideout.rooms_unlocked.loft;
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
        ) : liveIsLoft ? (
          <LiveLoft scale={scale} origin={origin} night={night} lampOn={hideout.lamp_on} onLamp={onLamp} />
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
      {liveIsLoft && petHere ? (
        <StreetRoomFront
          left={origin.left}
          top={origin.top}
          scale={scale}
          room="loft"
          night={night}
          feetX={feetX}
          feetY={feetY}
          gentle={motion.vestibularSafe}
        />
      ) : null}

      {petHere && presence.asleep ? (
        <HideoutZzz
          x={origin.left + isoSleepPoint(roomGeom(presence.room))[0] * k - 8}
          y={origin.top + isoSleepPoint(roomGeom(presence.room))[1] * k - 36}
        />
      ) : null}

      {presence.away ? (
        <HideoutTravelTag
          x={origin.left + 88 * k}
          y={origin.top + 200 * k}
          text={expeditionBackMs != null ? expeditionCallCopy(expeditionBackMs) : 'Out on a trip'}
        />
      ) : null}

    </View>
  );
}

/**
 * Room + Call buttons and the first-run swipe hint. Drawn by PetRoom ABOVE the aura
 * mask (StreetRoomAuraClip), so the side-gutter column and the hint are never painted over.
 */
export function HideoutStageControls({
  hideout,
  presence,
  viewed,
  scale,
  origin,
  expeditionBackMs,
  onView,
  onCall,
  coach,
  onCoachSeen,
  controlsSide,
}: {
  hideout: HideoutState;
  presence: Presence;
  viewed: HideoutRoomId;
  scale: HideoutScale;
  origin: HideoutOrigin;
  expeditionBackMs: number | null;
  onView: (id: HideoutRoomId) => void;
  onCall: () => void;
  coach: boolean;
  onCoachSeen: () => void;
  controlsSide: boolean;
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View
        style={
          controlsSide
            ? {
                position: 'absolute',
                right: Math.max(4, (origin.left - HIDEOUT_CONTROL_PT) / 2),
                // Lower half of the room, beside the floor; ends at the room's bottom edge at the latest.
                top: Math.min(
                  origin.top + scale.canvasH * 0.45,
                  origin.top + scale.canvasH - (HIDEOUT_ROOM_IDS.filter((id) => roomStage(id, hideout) !== 'hidden').length + 1) * (HIDEOUT_CONTROL_PT + 10) - 6,
                ),
              }
            : { position: 'absolute', left: 0, right: 0, bottom: 0 }
        }
        pointerEvents="box-none">
        <HideoutRoomBar
          hideout={hideout}
          petRoom={presence.room}
          viewed={viewed}
          onSelect={onView}
          direction={controlsSide ? 'column' : 'row'}
          callLabel={presence.away ? 'Away' : 'Call'}
          callA11y={
            presence.away
              ? expeditionBackMs != null
                ? expeditionCallCopy(expeditionBackMs)
                : 'Out on a trip'
              : `Call pet to ${roomDef(viewed).label}`
          }
          onCall={onCall}
        />
      </View>

      {coach ? (
        <Pressable
          onPress={onCoachSeen}
          accessibilityRole="button"
          accessibilityLabel="Swipe between rooms. The bar shows where your pet is."
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,9,15,0.72)', justifyContent: 'flex-end', padding: 24 }]}>
          <Text style={{ color: STREET.paper, fontFamily: STREET_FONT.regular, fontSize: 16, textAlign: 'center' }}>
            Swipe for rooms. The bar marks where your pet is.
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
