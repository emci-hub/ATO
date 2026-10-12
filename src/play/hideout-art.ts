/**
 * Swappable Hideout room art + maps (3/4 top-down, layout A).
 *
 * Placeholders until Sprite Smith art lands at sprite-smith-out. Replace the
 * files under `assets/art/rooms/` (ids in the art registry) and, if names
 * change, the `ART.room.*` paths in `ROOM_ART` (a missing id is a type error).
 * Maps use the 264×576 / 12px schema
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
import { ART, getArtSource, type ArtId } from '@/art/art';
import { HIDEOUT_ART_PLACEHOLDER, type HideoutRoomId } from '@/play/hideout-progress';

function png(id: ArtId): ImageSourcePropType {
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
    back: png(ART.room.hideout.back),
    floor: png(ART.room.hideout.floor),
    props: png(ART.room.hideout.props),
    neonA: png(ART.room.hideout.neonA),
    neonB: png(ART.room.hideout.neonB),
    occludeDayA: png(ART.room.hideout.occluderDayA),
    occludeDayB: png(ART.room.hideout.occluderDayB),
    occludeNightA: png(ART.room.hideout.occluderNightA),
    occludeNightB: png(ART.room.hideout.occluderNightB),
    snapshot: png(ART.room.hideout.back),
  },
  loft: {
    placeholder: HIDEOUT_ART_PLACEHOLDER,
    map: loftMap,
    back: png(ART.room.loft.back),
    floor: png(ART.room.loft.floor),
    props: png(ART.room.loft.props),
    neonA: png(ART.room.loft.neonA),
    neonB: png(ART.room.loft.neonB),
    occludeDayA: png(ART.room.loft.occluderDayA),
    occludeDayB: png(ART.room.loft.occluderDayB),
    occludeNightA: png(ART.room.loft.occluderNightA),
    occludeNightB: png(ART.room.loft.occluderNightB),
    windowDay: png(ART.room.loft.windowDay),
    windowNight: png(ART.room.loft.windowNight),
    glow: png(ART.room.loft.glow),
    snapshot: png(ART.room.loft.back),
  },
  garage: {
    placeholder: true,
    map: loftMap,
    shell: png(ART.room.hideout.neighborBoardedTd),
    snapshot: png(ART.room.hideout.neighborBoardedTd),
  },
  rooftop: {
    placeholder: true,
    map: loftMap,
    shell: png(ART.room.hideout.neighborBoardedTd),
    snapshot: png(ART.room.hideout.neighborBoardedTd),
  },
};

export const UNDERGROUND_ART: Partial<Record<RoomArtKey, ImageSourcePropType>> & {
  placeholder: boolean;
  map: unknown;
} = {
  placeholder: true,
  map: undergroundMap,
  back: png(ART.room.underground.back),
  floor: png(ART.room.underground.floor),
  props: png(ART.room.underground.props),
  neonA: png(ART.room.underground.neonA),
  neonB: png(ART.room.underground.neonB),
  occludeDayA: png(ART.room.underground.occluderDayA),
  occludeDayB: png(ART.room.underground.occluderDayB),
  occludeNightA: png(ART.room.underground.occluderNightA),
  occludeNightB: png(ART.room.underground.occluderNightB),
  snapshot: png(ART.room.underground.back),
};

export const TEASE_ART = {
  boarded: png(ART.room.hideout.boarded),
  tarp: png(ART.room.hideout.tarp),
  scaffold: png(ART.room.hideout.scaffold),
  sign: png(ART.room.hideout.buildSign),
};

export const BAR_ART: Record<HideoutRoomId, ImageSourcePropType> = {
  hideout: png(ART.ui.markers.streetwear.barHideout),
  loft: png(ART.ui.markers.streetwear.barLoft),
  garage: png(ART.ui.markers.streetwear.barGarage),
  rooftop: png(ART.ui.markers.streetwear.barRooftop),
};

export const BAR_MARKER_ART: ImageSourcePropType = png(ART.ui.markers.streetwear.barMarker);

export const ZZZ_ART: readonly ImageSourcePropType[] = [
  png(ART.room.hideout.zzz0),
  png(ART.room.hideout.zzz1),
  png(ART.room.hideout.zzz2),
];

export const NEIGHBOR_BOARDED_ART: ImageSourcePropType = png(ART.room.hideout.neighborBoardedTd);

export const LOFT_WINDOW_POS: readonly [number, number] = [72, 24];
export const LOFT_WINDOW_SIZE: readonly [number, number] = [120, 84];
