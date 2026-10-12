/**
 * Room bar — one icon per room, pet-head marker on the room the pet is in.
 * VoiceOver: each icon plus a "Pet is in Loft" live label.
 */
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { BAR_ART, BAR_MARKER_ART } from '@/play/hideout-art';
import {
  HIDEOUT_ROOM_IDS,
  roomDef,
  roomStage,
  type HideoutRoomId,
  type HideoutState,
} from '@/play/hideout-progress';
import { pixelRenderStyle } from '@/play/pixel-theme';
import { STREET, STREET_FONT } from '@/play/street-ui';
import { EDGE_ZONE } from '@/play/edge-back';

export function HideoutRoomBar({
  hideout,
  petRoom,
  viewed,
  onSelect,
}: {
  hideout: HideoutState;
  petRoom: HideoutRoomId;
  viewed: HideoutRoomId;
  onSelect: (id: HideoutRoomId) => void;
}) {
  const vis = HIDEOUT_ROOM_IDS.filter((id) => roomStage(id, hideout) !== 'hidden');
  const petLabel = `Pet is in ${roomDef(petRoom).label}`;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: EDGE_ZONE + 8,
        paddingVertical: 6,
        gap: 10,
      }}
      accessibilityRole="tablist"
      accessibilityLabel={`Rooms. ${petLabel}`}>
      <Text
        accessibilityLiveRegion="polite"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
        {petLabel}
      </Text>
      {vis.map((id) => {
        const stage = roomStage(id, hideout);
        const selected = viewed === id;
        const petHere = petRoom === id;
        const locked = stage === 'tease' || stage === 'building';
        return (
          <Pressable
            key={id}
            onPress={() => onSelect(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled: false }}
            accessibilityLabel={`${roomDef(id).label}${petHere ? ', pet is here' : ''}${locked ? ', locked' : ''}`}
            style={{
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: locked ? 0.72 : 1,
              borderWidth: selected ? 2 : 0,
              borderColor: STREET.mustard,
            }}>
            <Image source={BAR_ART[id]} style={{ width: 28, height: 28, ...pixelRenderStyle }} contentFit="contain" transition={0} />
            {petHere ? (
              <View style={{ position: 'absolute', right: 0, top: -2, width: 16, height: 16 }}>
                <Image source={BAR_MARKER_ART} style={{ width: 16, height: 16, ...pixelRenderStyle }} contentFit="contain" transition={0} />
              </View>
            ) : null}
            <Text style={{ color: STREET.paper, fontSize: 9, fontFamily: STREET_FONT.regular }} numberOfLines={1}>
              {roomDef(id).label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
