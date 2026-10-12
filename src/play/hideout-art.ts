/**
 * Swappable Hideout room art + maps (Phase 2).
 *
 * Real Loft art drops in here: replace the files under `assets/play/rooms/`
 * and, if names change, the requires in `ROOM_ART`. Maps use the same schema
 * as `hideout-iso.map.json`. Tease pieces are Hideout *wall* overlays, not
 * floor props.
 *
 * Do not pack these into the Streetwear ui-kit until the real art ships —
 * placeholders stay loose so they can swap without a sheet rebuild.
 */
import type { ImageSourcePropType } from 'react-native';

import hideoutMap from '@/assets/play/skins/streetwear/ui/rooms/hideout-iso.map.json';
import loftMap from '@/assets/play/rooms/loft-iso.map.json';
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
  | 'shell'
  | 'front'
  | 'windowDay'
  | 'windowNight'
  | 'glow'
  | 'bed'
  | 'lamp'
  | 'snapshot';

export const ROOM_ART: Record<
  HideoutRoomId,
  Partial<Record<RoomArtKey, ImageSourcePropType>> & { placeholder: boolean; map: unknown }
> = {
  hideout: {
    placeholder: false,
    map: hideoutMap,
  },
  loft: {
    placeholder: HIDEOUT_ART_PLACEHOLDER,
    map: loftMap,
    shell: require('@/assets/play/rooms/loft-iso.png'),
    front: require('@/assets/play/rooms/loft-iso-front.png'),
    windowDay: require('@/assets/play/rooms/loft-window-day.png'),
    windowNight: require('@/assets/play/rooms/loft-window-night.png'),
    glow: require('@/assets/play/rooms/loft-glow.png'),
    bed: require('@/assets/play/rooms/loft-bed.png'),
    lamp: require('@/assets/play/rooms/loft-lamp.png'),
    snapshot: require('@/assets/play/rooms/loft-iso.png'),
  },
  garage: {
    placeholder: true,
    map: loftMap,
    shell: require('@/assets/play/rooms/neighbor-boarded.png'),
    snapshot: require('@/assets/play/rooms/neighbor-boarded.png'),
  },
  rooftop: {
    placeholder: true,
    map: loftMap,
    shell: require('@/assets/play/rooms/neighbor-boarded.png'),
    snapshot: require('@/assets/play/rooms/neighbor-boarded.png'),
  },
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

export const NEIGHBOR_BOARDED_ART: ImageSourcePropType = require('@/assets/play/rooms/neighbor-boarded.png');

export const LOFT_WINDOW_POS: readonly [number, number] = [156, 72];
export const LOFT_WINDOW_SIZE: readonly [number, number] = [48, 40];
