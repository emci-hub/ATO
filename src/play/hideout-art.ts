/**
 * Swappable Hideout room art + maps (3/4 top-down, layout A).
 *
 * Placeholders until Sprite Smith art lands at sprite-smith-out. Replace the
 * files under `assets/art/rooms/` (ids in the art registry) and, if names
 * change, the `ROOM.<room>.<slot>` layers (skeleton: src/art/skeletons.ts) and `ART.*` extras
 * in `ROOM_ART` (a missing id is a type error).
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
import { ART, ROOM, getArtSource, type ArtId } from '@/art/art';
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
    back: png(ROOM.hideout.back),
    floor: png(ROOM.hideout.floor),
    props: png(ROOM.hideout.props),
    neonA: png(ROOM.hideout.neonA),
    neonB: png(ROOM.hideout.neonB),
    occludeDayA: png(ROOM.hideout.occluderDayA),
    occludeDayB: png(ROOM.hideout.occluderDayB),
    occludeNightA: png(ROOM.hideout.occluderNightA),
    occludeNightB: png(ROOM.hideout.occluderNightB),
    snapshot: png(ROOM.hideout.back),
  },
  loft: {
    placeholder: HIDEOUT_ART_PLACEHOLDER,
    map: loftMap,
    back: png(ROOM.loft.back),
    floor: png(ROOM.loft.floor),
    props: png(ROOM.loft.props),
    neonA: png(ROOM.loft.neonA),
    neonB: png(ROOM.loft.neonB),
    occludeDayA: png(ROOM.loft.occluderDayA),
    occludeDayB: png(ROOM.loft.occluderDayB),
    occludeNightA: png(ROOM.loft.occluderNightA),
    occludeNightB: png(ROOM.loft.occluderNightB),
    windowDay: png(ROOM.loft.windowDay),
    windowNight: png(ROOM.loft.windowNight),
    glow: png(ROOM.loft.glow),
    snapshot: png(ROOM.loft.back),
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
  back: png(ROOM.underground.back),
  floor: png(ROOM.underground.floor),
  props: png(ROOM.underground.props),
  neonA: png(ROOM.underground.neonA),
  neonB: png(ROOM.underground.neonB),
  occludeDayA: png(ROOM.underground.occluderDayA),
  occludeDayB: png(ROOM.underground.occluderDayB),
  occludeNightA: png(ROOM.underground.occluderNightA),
  occludeNightB: png(ROOM.underground.occluderNightB),
  snapshot: png(ROOM.underground.back),
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
