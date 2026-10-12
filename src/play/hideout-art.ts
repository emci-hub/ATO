/**
 * Swappable Hideout room art + maps (3/4 top-down, layout A).
 *
 * Placeholders until Sprite Smith art lands at sprite-smith-out. Replace the
 * files under `assets/art/rooms/` (ids in the art registry) and, if names
 * change, the `png('…')` ids in `ROOM_ART`. Maps use the 264×576 / 12px schema
 * (hideout-td.map.json): floor 20×36 tiles, door gap 4, occluders as ONE
 * combined layer per time/neon state with per-prop crop + sortY.
 * Tease pieces are Hideout *wall* overlays, not floor props.
 *
 * Do not pack these into the Streetwear ui-kit until the real art ships —
 * placeholders stay loose so they can swap without a sheet rebuild.
 */
import type { ImageSourcePropType } from 'react-native';

import hideoutMap from '@/assets/art/rooms/hideout/hideout-td.map.json';
import loftMap from '@/assets/art/rooms/loft/loft-td.map.json';
import undergroundMap from '@/assets/art/rooms/underground/underground-td.map.json';
import teaseLayout from '@/assets/art/rooms/hideout/hideout-tease.json';
import { getArtSource } from '@/art/art';
import { HIDEOUT_ART_PLACEHOLDER, type HideoutRoomId } from '@/play/hideout-progress';

function png(id: string): ImageSourcePropType {
  const src = getArtSource(id);
  if (!src) throw new Error(`art library missing ${id} — run npm run art:registry`);
  return src;
}

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
    back: png('room.hideout.back'),
    floor: png('room.hideout.floor'),
    props: png('room.hideout.props'),
    neonA: png('room.hideout.neon-a'),
    neonB: png('room.hideout.neon-b'),
    occludeDayA: png('room.hideout.occluder-day-a'),
    occludeDayB: png('room.hideout.occluder-day-b'),
    occludeNightA: png('room.hideout.occluder-night-a'),
    occludeNightB: png('room.hideout.occluder-night-b'),
    snapshot: png('room.hideout.back'),
  },
  loft: {
    placeholder: HIDEOUT_ART_PLACEHOLDER,
    map: loftMap,
    back: png('room.loft.back'),
    floor: png('room.loft.floor'),
    props: png('room.loft.props'),
    neonA: png('room.loft.neon-a'),
    neonB: png('room.loft.neon-b'),
    occludeDayA: png('room.loft.occluder-day-a'),
    occludeDayB: png('room.loft.occluder-day-b'),
    occludeNightA: png('room.loft.occluder-night-a'),
    occludeNightB: png('room.loft.occluder-night-b'),
    windowDay: png('room.loft.window-day'),
    windowNight: png('room.loft.window-night'),
    glow: png('room.loft.glow'),
    snapshot: png('room.loft.back'),
  },
  garage: {
    placeholder: true,
    map: loftMap,
    shell: png('room.hideout.neighbor-boarded-td'),
    snapshot: png('room.hideout.neighbor-boarded-td'),
  },
  rooftop: {
    placeholder: true,
    map: loftMap,
    shell: png('room.hideout.neighbor-boarded-td'),
    snapshot: png('room.hideout.neighbor-boarded-td'),
  },
};

export const UNDERGROUND_ART: Partial<Record<RoomArtKey, ImageSourcePropType>> & {
  placeholder: boolean;
  map: unknown;
} = {
  placeholder: true,
  map: undergroundMap,
  back: png('room.underground.back'),
  floor: png('room.underground.floor'),
  props: png('room.underground.props'),
  neonA: png('room.underground.neon-a'),
  neonB: png('room.underground.neon-b'),
  occludeDayA: png('room.underground.occluder-day-a'),
  occludeDayB: png('room.underground.occluder-day-b'),
  occludeNightA: png('room.underground.occluder-night-a'),
  occludeNightB: png('room.underground.occluder-night-b'),
  snapshot: png('room.underground.back'),
};

export const TEASE_ART = {
  boarded: png('room.hideout.boarded'),
  tarp: png('room.hideout.tarp'),
  scaffold: png('room.hideout.scaffold'),
  sign: png('room.hideout.build-sign'),
};

export const BAR_ART: Record<HideoutRoomId, ImageSourcePropType> = {
  hideout: png('ui.markers.streetwear.bar-hideout'),
  loft: png('ui.markers.streetwear.bar-loft'),
  garage: png('ui.markers.streetwear.bar-garage'),
  rooftop: png('ui.markers.streetwear.bar-rooftop'),
};

export const BAR_MARKER_ART: ImageSourcePropType = png('ui.markers.streetwear.bar-marker');

export const ZZZ_ART: readonly ImageSourcePropType[] = [
  png('room.hideout.zzz-0'),
  png('room.hideout.zzz-1'),
  png('room.hideout.zzz-2'),
];

export const NEIGHBOR_BOARDED_ART: ImageSourcePropType = png('room.hideout.neighbor-boarded-td');

export const LOFT_WINDOW_POS: readonly [number, number] = [72, 24];
export const LOFT_WINDOW_SIZE: readonly [number, number] = [120, 84];
