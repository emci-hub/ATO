/**
 * Next-room tease on the Hideout's locked *side wall* (near the room bar /
 * Loft side). Not on the floor.
 *
 *   before build → boarded door only
 *   during build → tarp + scaffold leaning outside + sign in front with a bar
 *   after unveil → nothing (the Loft is enterable)
 */
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { HIDEOUT_TEASE, TEASE_ART } from '@/play/hideout-art';
import {
  buildProgress01,
  roomGateParts,
  nextBuildRoom,
  roomStage,
  roomTokenPrice,
  type HideoutProgressInput,
  type HideoutRoomId,
  type HideoutState,
  type RoomBuild,
} from '@/play/hideout-progress';
import { pixelRenderStyle } from '@/play/pixel-theme';
import type { HideoutScale } from '@/play/hideout-iso';
import { STREET, STREET_FONT } from '@/play/street-ui';

function Place({
  source,
  left,
  top,
  w,
  h,
}: {
  source: number;
  left: number;
  top: number;
  w: number;
  h: number;
}) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left, top, width: w, height: h }}>
      <Image source={source} style={{ width: w, height: h, ...pixelRenderStyle }} contentFit="fill" transition={0} />
    </View>
  );
}

export function HideoutTease({
  hideout,
  progress,
  scale,
  origin,
  onPress,
}: {
  hideout: HideoutState;
  progress: HideoutProgressInput;
  scale: HideoutScale;
  origin: { left: number; top: number };
  onPress: () => void;
}) {
  // Loft, then Garage, then Rooftop use the same boarded wall.
  const next: HideoutRoomId = nextBuildRoom(hideout);
  const stage = roomStage(next, hideout);
  if (stage === 'hidden' || stage === 'done') return null;
  const k = scale.pt;
  const at = (pos: readonly [number, number], size: readonly [number, number]) => ({
    left: origin.left + pos[0] * k,
    top: origin.top + pos[1] * k,
    w: size[0] * k,
    h: size[1] * k,
  });
  const boarded = at(HIDEOUT_TEASE.boarded.pos, HIDEOUT_TEASE.boarded.size);
  const tarp = at(HIDEOUT_TEASE.tarp.pos, HIDEOUT_TEASE.tarp.size);
  const scaffold = at(HIDEOUT_TEASE.scaffold.pos, HIDEOUT_TEASE.scaffold.size);
  const sign = at(HIDEOUT_TEASE.sign.pos, HIDEOUT_TEASE.sign.size);
  const building = stage === 'building';
  const build = hideout.builds[next] as RoomBuild | undefined;
  const pct = build ? buildProgress01(build) : 0;
  const parts = roomGateParts(next, progress);
  const gateLine = parts.map((p) => `${p.label} ${p.have}/${p.need}`).join(' · ');
  const a11y = building
    ? `${next} under construction, ${Math.round(pct * 100)} percent`
    : `${next} boarded. ${gateLine}. ${roomTokenPrice(next)} tokens to start.`;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <Place source={TEASE_ART.boarded as number} {...boarded} />
      {building ? (
        <>
          <Place source={TEASE_ART.tarp as number} {...tarp} />
          <Place source={TEASE_ART.scaffold as number} {...scaffold} />
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={a11y}
            style={{ position: 'absolute', left: sign.left, top: sign.top, width: sign.w, height: sign.h }}>
            <Image source={TEASE_ART.sign} style={{ width: sign.w, height: sign.h, ...pixelRenderStyle }} contentFit="fill" transition={0} />
            <View
              style={{
                position: 'absolute',
                left: 4,
                right: 4,
                bottom: 4,
                height: Math.max(4, 5 * k),
                backgroundColor: '#3A2A18',
              }}>
              <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', backgroundColor: STREET.ink }} />
            </View>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={a11y}
          hitSlop={8}
          style={{ position: 'absolute', left: boarded.left, top: boarded.top, width: boarded.w, height: boarded.h }}
        />
      )}
    </View>
  );
}

export function HideoutTeaseSheetCopy(input: {
  room: HideoutRoomId;
  stage: 'tease' | 'building';
  progress: HideoutProgressInput;
  build?: RoomBuild | null;
  tokens: number;
}): { title: string; body: string; canStart: boolean; price: number } {
  const price = roomTokenPrice(input.room);
  const parts = roomGateParts(input.room, input.progress);
  const gateOk = parts.some((p) => p.ok) || parts.length === 0;
  const lines = parts.map((p) => `${p.ok ? '✓' : '·'} ${p.label} ${p.have}/${p.need}`);
  if (input.stage === 'building' && input.build) {
    const left = Math.max(0, input.build.duration_ms - input.build.elapsed_ms - input.build.speedup_ms);
    const h = Math.floor(left / 3_600_000);
    const m = Math.ceil((left % 3_600_000) / 60_000);
    return {
      title: `Building the ${input.room}`,
      body: `Counted time left: ${h > 0 ? `${h}h ${m}m` : `${m}m`}. A deep Dive (depth 3+) or a first-time Defend clear knocks an hour off, up to half the timer.`,
      canStart: false,
      price,
    };
  }
  return {
    title: `Boarded: ${input.room}`,
    body: `${lines.join('\n')}\n\n${price} tokens to start (placeholder price). ${gateOk ? (input.tokens >= price ? 'Ready to build.' : 'Not enough tokens yet.') : 'Any one requirement unlocks it.'}`,
    canStart: gateOk && input.tokens >= price,
    price,
  };
}

export function HideoutTeaseHint({ text }: { text: string }) {
  return (
    <View style={{ marginTop: 6, paddingHorizontal: 10 }}>
      <Text style={{ color: STREET.muted, fontSize: 11, fontFamily: STREET_FONT.regular }}>{text}</Text>
    </View>
  );
}
