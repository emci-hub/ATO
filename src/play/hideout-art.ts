/**
 * Swappable Hideout room art + maps (3/4 top-down, layout A).
 *
 * Placeholders until Sprite Smith art lands at sprite-smith-out. Replace the
 * files under `assets/play/rooms/` and, if names change, the requires in
 * `ROOM_ART`. Maps use the 264×576 / 12px footprint schema
 * (hideout-td.map.json): floor 20×36 tiles, door gap 4, occluders as ONE
 * combined layer per time/neon state with per-prop crop + sortY.
 * Tease pieces are Hideout *wall* overlays, not floor props.
 *
 * Do not pack these into the Streetwear ui-kit until the real art ships —
 * placeholders stay loose so they can swap without a sheet rebuild.
 */
import type { ImageSourcePropType } from 'react-native';

import hideoutMap from '@/assets/play/rooms/hideout-td.map.json';
import loftMap from '@/assets/play/rooms/loft-td.map.json';
import undergroundMap from '@/assets/play/rooms/underground-td.map.json';
import teaseLayout from '@/assets/play/rooms/hideout-tease.json';
import { HIDEOUT_ART_PLACEHOLDER, type HideoutRoomId } from '@/play/hideout-progress';

export const HIDEOUT_ART_SWAP = 'src/play/hideout-art.ts';

type Rect = { pos: readonly [number, number]; size: readonly [number, number] };

export type HideoutTeaseLayout = {
  boarded: Rect;
  tarp: Rect;
  scaffold: Rect;
  sign: Rect;
};

function asRect(v: { pos: number[]; size: number[] }): Rect {
  return {
    pos: [v.pos[0] ?? 0, v.pos[1] ?? 0],
    size: [v.size[0] ?? 0, v.size[1] ?? 0],
  };
}

export const HIDEOUT_TEASE: HideoutTeaseLayout = {
  boarded: asRect(teaseLayout.boarded),
  tarp: asRect(teaseLayout.tarp),
  scaffold: asRect(teaseLayout.scaffold),
  sign: asRect(teaseLayout.sign),
};

export type RoomArtKey =
  | 'back'
  | 'floor'
  | 'props'
  | 'front'
  | 'neonA'
  | 'neonB'
  | 'occludeDayA'
  | 'occludeDayB'
  | 'occludeNightA'
  | 'occludeNightB'
  | 'windowDay'
  | 'windowNight'
  | 'glow'
  | 'snapshot'
  | 'shell';

export const ROOM_ART: Record<
  HideoutRoomId,
  Partial<Record<RoomArtKey, ImageSourcePropType>> & { placeholder: boolean; map: unknown }
> = {
  hideout: {
    placeholder: HIDEOUT_ART_PLACEHOLDER,
    map: hideoutMap,
    back: require('@/assets/play/rooms/hideout-td-back.png'),
    floor: require('@/assets/play/rooms/hideout-td-floor.png'),
    props: require('@/assets/play/rooms/hideout-td-props.png'),
    neonA: require('@/assets/play/rooms/hideout-td-neon-a.png'),
    neonB: require('@/assets/play/rooms/hideout-td-neon-b.png'),
    occludeDayA: require('@/assets/play/rooms/hideout-td-occlude-day-a.png'),
    occludeDayB: require('@/assets/play/rooms/hideout-td-occlude-day-b.png'),
    occludeNightA: require('@/assets/play/rooms/hideout-td-occlude-night-a.png'),
    occludeNightB: require('@/assets/play/rooms/hideout-td-occlude-night-b.png'),
    snapshot: require('@/assets/play/rooms/hideout-td-back.png'),
  },
  loft: {
    placeholder: HIDEOUT_ART_PLACEHOLDER,
    map: loftMap,
    back: require('@/assets/play/rooms/loft-td-back.png'),
    floor: require('@/assets/play/rooms/loft-td-floor.png'),
    props: require('@/assets/play/rooms/loft-td-props.png'),
    neonA: require('@/assets/play/rooms/loft-td-neon-a.png'),
    neonB: require('@/assets/play/rooms/loft-td-neon-b.png'),
    occludeDayA: require('@/assets/play/rooms/loft-td-occlude-day-a.png'),
    occludeDayB: require('@/assets/play/rooms/loft-td-occlude-day-b.png'),
    occludeNightA: require('@/assets/play/rooms/loft-td-occlude-night-a.png'),
    occludeNightB: require('@/assets/play/rooms/loft-td-occlude-night-b.png'),
    windowDay: require('@/assets/play/rooms/loft-td-window-day.png'),
    windowNight: require('@/assets/play/rooms/loft-td-window-night.png'),
    glow: require('@/assets/play/rooms/loft-td-glow.png'),
    snapshot: require('@/assets/play/rooms/loft-td-back.png'),
  },
  garage: {
    placeholder: true,
    map: loftMap,
    shell: require('@/assets/play/rooms/neighbor-boarded-td.png'),
    snapshot: require('@/assets/play/rooms/neighbor-boarded-td.png'),
  },
  rooftop: {
    placeholder: true,
    map: loftMap,
    shell: require('@/assets/play/rooms/neighbor-boarded-td.png'),
    snapshot: require('@/assets/play/rooms/neighbor-boarded-td.png'),
  },
};

export const UNDERGROUND_ART: Partial<Record<RoomArtKey, ImageSourcePropType>> & {
  placeholder: boolean;
  map: unknown;
} = {
  placeholder: true,
  map: undergroundMap,
  back: require('@/assets/play/rooms/underground-td-back.png'),
  floor: require('@/assets/play/rooms/underground-td-floor.png'),
  props: require('@/assets/play/rooms/underground-td-props.png'),
  neonA: require('@/assets/play/rooms/underground-td-neon-a.png'),
  neonB: require('@/assets/play/rooms/underground-td-neon-b.png'),
  occludeDayA: require('@/assets/play/rooms/underground-td-occlude-day-a.png'),
  occludeDayB: require('@/assets/play/rooms/underground-td-occlude-day-b.png'),
  occludeNightA: require('@/assets/play/rooms/underground-td-occlude-night-a.png'),
  occludeNightB: require('@/assets/play/rooms/underground-td-occlude-night-b.png'),
  snapshot: require('@/assets/play/rooms/underground-td-back.png'),
};

export const TEASE_ART = {
  boarded: require('@/assets/play/rooms/boarded.png') as ImageSourcePropType,
  tarp: require('@/assets/play/rooms/tarp.png') as ImageSourcePropType,
  scaffold: require('@/assets/play/rooms/scaffold.png') as ImageSourcePropType,
  sign: require('@/assets/play/rooms/build-sign.png') as ImageSourcePropType,
};

export const BAR_ART: Record<HideoutRoomId, ImageSourcePropType> = {
  hideout: require('@/assets/play/rooms/bar-hideout.png'),
  loft: require('@/assets/play/rooms/bar-loft.png'),
  garage: require('@/assets/play/rooms/bar-garage.png'),
  rooftop: require('@/assets/play/rooms/bar-rooftop.png'),
};

export const BAR_MARKER_ART: ImageSourcePropType = require('@/assets/play/rooms/bar-marker.png');

export const ZZZ_ART: readonly ImageSourcePropType[] = [
  require('@/assets/play/rooms/zzz-0.png'),
  require('@/assets/play/rooms/zzz-1.png'),
  require('@/assets/play/rooms/zzz-2.png'),
];

export const NEIGHBOR_BOARDED_ART: ImageSourcePropType = require('@/assets/play/rooms/neighbor-boarded-td.png');

export const LOFT_WINDOW_POS: readonly [number, number] = [72, 24];
export const LOFT_WINDOW_SIZE: readonly [number, number] = [120, 84];
