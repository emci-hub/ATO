/**
 * Room controls — one kit button per room (+ pet-head marker on the room the pet is
 * in) and the Call button, all in the app's kit-button style (same family as FEED /
 * INFO and the room's hotspot buttons). A column in the side gutter when the room
 * leaves room for it, else compact in the room's dark ceiling band, else a row under
 * the room (emci 2026-10-12/13, layout C, 352-wide room).
 * VoiceOver: each button plus a "Pet is in Loft" live label.
 */
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { BAR_ART, BAR_MARKER_ART, CALL_ICON_ART, LOCK_ICON_ART } from '@/play/hideout-art';
import {
  HIDEOUT_ROOM_IDS,
  roomDef,
  roomStage,
  type HideoutRoomId,
  type HideoutState,
} from '@/play/hideout-progress';
import { pixelRenderStyle } from '@/play/pixel-theme';
import { STREET_FONT, StreetFrame, streetButtonPiece, streetButtonText } from '@/play/street-ui';
import { EDGE_ZONE } from '@/play/edge-back';

/** One control button (44 pt HIG floor on both sides). */
export const HIDEOUT_CONTROL_PT = 52;
/** Gutter a side column needs (button + breathing room). */
export const HIDEOUT_SIDE_COLUMN_PT = HIDEOUT_CONTROL_PT + 12;
/** Height the row takes under the room when there is no side gutter. */
export const HIDEOUT_ROW_RESERVE_PT = HIDEOUT_CONTROL_PT + 12;
/** Compact button (44 pt HIG floor) for the room's dark ceiling band. */
export const HIDEOUT_CONTROL_COMPACT_PT = 44;
/** Art px of dark ceiling above the back wall the compact row sits in. */
// 38 (not the full 46): the 44 pt row (2 pt down) then ends above the Loft window top at art y 40.
export const HIDEOUT_CEILING_ART_PX = 38;

function ControlButton({
  size = HIDEOUT_CONTROL_PT,
  icon,
  label,
  selected,
  dim,
  marker,
  lock,
  onPress,
  a11yRole,
  a11yLabel,
}: {
  size?: number;
  icon: unknown;
  label: string;
  selected: boolean;
  dim?: boolean;
  marker?: boolean;
  lock?: boolean;
  onPress: () => void;
  a11yRole: 'tab' | 'button';
  a11yLabel: string;
}) {
  const variant = selected ? 'primary' : 'secondary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={a11yRole}
      accessibilityState={a11yRole === 'tab' ? { selected, disabled: false } : undefined}
      accessibilityLabel={a11yLabel}
      style={{ width: size, height: size }}>
      {({ pressed }) => (
        <StreetFrame
          piece={streetButtonPiece(variant, pressed)}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingBottom: 3,
            opacity: dim ? 0.78 : 1,
          }}>
          <Image source={icon as number} style={{ width: size * 0.46, height: size * 0.46, ...pixelRenderStyle }} contentFit="contain" transition={0} />
          <Text
            style={{ color: streetButtonText(variant), fontSize: size < HIDEOUT_CONTROL_PT ? 9 : 10, lineHeight: size < HIDEOUT_CONTROL_PT ? 10 : 12, fontFamily: STREET_FONT.bold, marginTop: 1 }}
            numberOfLines={1}
            maxFontSizeMultiplier={1.1}>
            {label}
          </Text>
          {marker ? (
            <View style={{ position: 'absolute', right: -4, top: -6, width: 16, height: 16 }}>
              <Image source={BAR_MARKER_ART} style={{ width: 16, height: 16, ...pixelRenderStyle }} contentFit="contain" transition={0} />
            </View>
          ) : null}
          {lock ? (
            <View style={{ position: 'absolute', left: -4, top: -6, width: 14, height: 14 }}>
              <Image source={LOCK_ICON_ART} style={{ width: 14, height: 14, ...pixelRenderStyle }} contentFit="contain" transition={0} />
            </View>
          ) : null}
        </StreetFrame>
      )}
    </Pressable>
  );
}

export function HideoutRoomBar({
  hideout,
  petRoom,
  viewed,
  onSelect,
  direction = 'row',
  compact = false,
  callLabel,
  callA11y,
  onCall,
}: {
  hideout: HideoutState;
  petRoom: HideoutRoomId;
  viewed: HideoutRoomId;
  onSelect: (id: HideoutRoomId) => void;
  direction?: 'row' | 'column';
  /** 44 pt buttons, no outer padding (the room's ceiling band). */
  compact?: boolean;
  callLabel: string;
  callA11y: string;
  onCall: () => void;
}) {
  const vis = HIDEOUT_ROOM_IDS.filter((id) => roomStage(id, hideout) !== 'hidden');
  const petLabel = `Pet is in ${roomDef(petRoom).label}`;
  return (
    <View
      style={{
        flexDirection: direction,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: direction === 'row' && !compact ? EDGE_ZONE + 8 : 0,
        paddingVertical: compact ? 0 : 6,
        gap: compact ? 6 : 10,
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
          <ControlButton
            key={id}
            size={compact ? HIDEOUT_CONTROL_COMPACT_PT : HIDEOUT_CONTROL_PT}
            icon={BAR_ART[id]}
            label={roomDef(id).label}
            selected={selected}
            dim={locked}
            marker={petHere}
            lock={locked}
            onPress={() => onSelect(id)}
            a11yRole="tab"
            a11yLabel={`${roomDef(id).label}${petHere ? ', pet is here' : ''}${locked ? ', locked' : ''}`}
          />
        );
      })}
      <ControlButton size={compact ? HIDEOUT_CONTROL_COMPACT_PT : HIDEOUT_CONTROL_PT} icon={CALL_ICON_ART} label={callLabel} selected={false} onPress={onCall} a11yRole="button" a11yLabel={callA11y} />
    </View>
  );
}
