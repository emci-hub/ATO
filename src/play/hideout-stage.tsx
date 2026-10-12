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
import { HideoutRoomBar } from '@/play/hideout-bar';
import { HideoutTease } from '@/play/hideout-tease';
import { HideoutTravelTag, HideoutZzz } from '@/play/hideout-zzz';
import {
  HIDEOUT_DISSOLVE_MS,
  neighborRooms,
  roomDef,
  type HideoutProgressInput,
  type HideoutRoomId,
  type HideoutState,
} from '@/play/hideout-progress';
import {
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
import { kitDrawable } from '@/play/street-ambient';
import { ClipImage } from '@/play/sheet-sprite';

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
      {id === 'hideout' ? (
        <ClipImage drawable={kitDrawable('room-hideout-iso')} />
      ) : (
        <Image source={src} style={{ width: scale.canvasW, height: scale.canvasH, ...pixelRenderStyle }} contentFit="fill" transition={0} />
      )}
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
  const art = ROOM_ART.loft;
  const k = scale.pt;
  const lamp = { left: origin.left + 196 * k, top: origin.top + 148 * k, w: 28 * k, h: 48 * k };
  return (
    <View style={{ position: 'absolute', left: origin.left, top: origin.top, width: scale.canvasW, height: scale.canvasH }}>
      <Place source={art.shell} left={0} top={0} w={scale.canvasW} h={scale.canvasH} />
      <Place
        source={night ? art.windowNight : art.windowDay}
        left={LOFT_WINDOW_POS[0] * k}
        top={LOFT_WINDOW_POS[1] * k}
        w={LOFT_WINDOW_SIZE[0] * k}
        h={LOFT_WINDOW_SIZE[1] * k}
      />
      <Place source={art.bed} left={132 * k} top={188 * k} w={64 * k} h={28 * k} />
      <Place source={art.lamp} left={200 * k} top={152 * k} w={18 * k} h={36 * k} />
      {night && lampOn ? <Place source={art.glow} left={0} top={0} w={scale.canvasW} h={scale.canvasH} /> : null}
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
  behind,
  expeditionBackMs,
  onView,
  onTease,
  onLamp,
  onCall,
  coach,
  onCoachSeen,
}: {
  hideout: HideoutState;
  progress: HideoutProgressInput;
  presence: Presence;
  viewed: HideoutRoomId;
  scale: HideoutScale;
  origin: HideoutOrigin;
  width: number;
  night: boolean;
  behind: boolean;
  expeditionBackMs: number | null;
  onView: (id: HideoutRoomId) => void;
  onTease: () => void;
  onLamp: () => void;
  onCall: () => void;
  coach: boolean;
  onCoachSeen: () => void;
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
    () => ({ left: origin.left - scale.canvasW * 0.92, top: origin.top }),
    [origin.left, origin.top, scale.canvasW],
  );
  const rightSnapOrigin = useMemo(
    () => ({ left: origin.left + scale.canvasW * 0.92, top: origin.top }),
    [origin.left, origin.top, scale.canvasW],
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
          <StreetRoomArt left={origin.left} top={origin.top} scale={scale} alive />
        ) : liveIsLoft ? (
          <LiveLoft scale={scale} origin={origin} night={night} lampOn={hideout.lamp_on} onLamp={onLamp} />
        ) : (
          <SnapshotRoom id={viewed} scale={scale} origin={origin} night={night} />
        )}
      </Animated.View>

      {liveIsHideout ? (
        <HideoutTease hideout={hideout} progress={progress} scale={scale} origin={origin} onPress={onTease} />
      ) : null}

      {liveIsHideout && behind ? <StreetRoomFront left={origin.left} top={origin.top} scale={scale} /> : null}
      {liveIsLoft && behind && ROOM_ART.loft.front ? (
        <Place source={ROOM_ART.loft.front} left={origin.left} top={origin.top} w={scale.canvasW} h={scale.canvasH} />
      ) : null}

      {petHere && presence.asleep ? (
        <HideoutZzz x={origin.left + (presence.room === 'loft' ? 164 : 160) * k - 8} y={origin.top + (presence.room === 'loft' ? 176 : 186) * k - 36} />
      ) : null}

      {presence.away ? (
        <HideoutTravelTag
          x={origin.left + 88 * k}
          y={origin.top + 200 * k}
          text={expeditionBackMs != null ? expeditionCallCopy(expeditionBackMs) : 'Out on a trip'}
        />
      ) : null}

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
        <HideoutRoomBar hideout={hideout} petRoom={presence.room} viewed={viewed} onSelect={onView} />
        <Pressable
          onPress={onCall}
          accessibilityRole="button"
          accessibilityLabel={
            presence.away
              ? expeditionBackMs != null
                ? expeditionCallCopy(expeditionBackMs)
                : 'Out on a trip'
              : `Call pet to ${roomDef(viewed).label}`
          }
          style={{
            alignSelf: 'center',
            marginBottom: 4,
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: STREET.ink,
            borderWidth: 1,
            borderColor: STREET.mustard,
          }}>
          <Text style={{ color: STREET.paper, fontFamily: STREET_FONT.regular, fontSize: 12 }}>
            {presence.away ? 'Out on a trip' : `Call to ${roomDef(viewed).label}`}
          </Text>
        </Pressable>
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
